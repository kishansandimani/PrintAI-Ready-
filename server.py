#!/usr/bin/env python3
"""PrintReady AI - tiny local server (Python standard library only).
Run:  python server.py        then open  http://localhost:8000
Everything is stored in ONE SQLite database file: ./data/printready.db (models, records, stats, settings,
print history, printers). Old v33 plain files in ./data are imported automatically the first time.
The AR share files (data/ar) stay as plain files because the separate AR server reads them."""
import http.server, socketserver, json, os, re, sys, time, secrets, socket, ssl, sqlite3, threading, urllib.parse, urllib.request, urllib.error, hashlib, hmac, http.cookies

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, "data")
FILES = os.path.join(DATA, "files")          # only used to import models saved by v33 and older
RECORDS = os.path.join(DATA, "records.json")  # old v33 files, imported once (then left untouched as a backup)
STATS = os.path.join(DATA, "stats.json")
HISTORY = os.path.join(DATA, "history.json")
SETTINGS = os.path.join(DATA, "settings.json")
PRINTERS = os.path.join(DATA, "printers.json")
DB_PATH = os.path.join(DATA, "printready.db")
AR_DIR = os.path.join(DATA, "ar")
AR_PORT = 8001
AR_HTTPS = False
AR_RUNNING = [False]
MAX_FILE = 300 * 1024 * 1024
os.makedirs(AR_DIR, exist_ok=True)
os.makedirs(DATA, exist_ok=True)


# ---------------- database (SQLite, part of Python - no installs) ----------------
DB_LOCK = threading.Lock()   # one writer at a time; the server handles requests in several threads

def db():
    c = sqlite3.connect(DB_PATH, timeout=30)
    c.execute("PRAGMA journal_mode=WAL")
    c.execute("PRAGMA synchronous=NORMAL")
    return c

def init_db():
    with DB_LOCK, db() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated INTEGER);
        CREATE TABLE IF NOT EXISTS files (id TEXT PRIMARY KEY, name TEXT NOT NULL, size INTEGER, created INTEGER, data BLOB NOT NULL);
        CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY AUTOINCREMENT, t INTEGER, printer TEXT, action TEXT, file TEXT, ok INTEGER, note TEXT);
        CREATE TABLE IF NOT EXISTS printers (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL, name TEXT, type TEXT, url TEXT, key TEXT);
        CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, salt BLOB NOT NULL, password_hash BLOB NOT NULL, created INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
        """)
        migrate_old_files(c)
    c.close()

def kv_get(key, default):
    c = db()
    try:
        r = c.execute("SELECT value FROM kv WHERE key=?", (key,)).fetchone()
        return r[0].encode("utf8") if r else default
    finally:
        c.close()

def kv_put(key, body, conn=None):
    text = body.decode("utf8") if isinstance(body, bytes) else body
    if conn is not None:
        conn.execute("INSERT INTO kv(key,value,updated) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated=excluded.updated", (key, text, int(time.time() * 1000)))
        return
    with DB_LOCK, db() as c:
        kv_put(key, text, c)
    c.close()

def migrate_old_files(c):
    """One-time import of the plain files that v33 and older kept in ./data. The old files are NOT deleted."""
    if c.execute("SELECT 1 FROM kv WHERE key='_migrated_v34'").fetchone():
        return
    n = {"files": 0, "docs": 0, "history": 0, "printers": 0, "skipped": 0}
    for key, fp in (("records", RECORDS), ("stats", STATS), ("settings", SETTINGS)):
        try:
            raw = open(fp, "rb").read()
            json.loads(raw)
            kv_put(key, raw, c)
            n["docs"] += 1
        except FileNotFoundError:
            pass
        except Exception:
            n["skipped"] += 1
    try:
        for e in json.load(open(HISTORY, encoding="utf8")):
            c.execute("INSERT INTO history(t,printer,action,file,ok,note) VALUES(?,?,?,?,?,?)",
                      (e.get("t"), e.get("printer"), e.get("action"), e.get("file", ""), 1 if e.get("ok", True) else 0, e.get("note", "")))
            n["history"] += 1
    except Exception:
        pass
    try:
        for p in json.load(open(PRINTERS, encoding="utf8")):
            c.execute("INSERT OR IGNORE INTO printers(id,name,type,url,key) VALUES(?,?,?,?,?)", (p["id"], p["name"], p["type"], p["url"], p.get("key", "")))
            n["printers"] += 1
    except Exception:
        pass
    if os.path.isdir(FILES):
        for fn in os.listdir(FILES):
            m = re.fullmatch(r"(\d{1,20})\.bin", fn)
            if not m:
                continue
            try:
                fid = m.group(1)
                data = open(os.path.join(FILES, fn), "rb").read()
                try:
                    name = open(os.path.join(FILES, fid + ".name"), encoding="utf8").read()
                except Exception:
                    name = fid
                c.execute("INSERT OR REPLACE INTO files(id,name,size,created,data) VALUES(?,?,?,?,?)", (fid, name[:200], len(data), int(os.path.getmtime(os.path.join(FILES, fn)) * 1000), data))
                n["files"] += 1
            except Exception:
                n["skipped"] += 1
    kv_put("_migrated_v34", json.dumps(n), c)
    if n["files"] or n["docs"] or n["history"] or n["printers"]:
        print("  Imported your old data into printready.db: %(files)d models, %(docs)d settings/records files, %(history)d history entries, %(printers)d printers (old files left in place as a backup)." % n)


# ---------------- printers (Klipper/Moonraker and OctoPrint over your local network) ----------------
def load_printers():
    c = db()
    try:
        return [{"id": r[0], "name": r[1], "type": r[2], "url": r[3], "key": r[4] or ""} for r in c.execute("SELECT id,name,type,url,key FROM printers ORDER BY seq")]
    finally:
        c.close()

def add_printer(p):
    with DB_LOCK, db() as c:
        c.execute("INSERT INTO printers(id,name,type,url,key) VALUES(?,?,?,?,?)", (p["id"], p["name"], p["type"], p["url"], p.get("key", "")))
    c.close()

def delete_printer(pid):
    with DB_LOCK, db() as c:
        c.execute("DELETE FROM printers WHERE id=?", (pid,))
    c.close()

def public(p):
    return {"id": p["id"], "name": p["name"], "type": p["type"], "url": p["url"], "hasKey": bool(p.get("key"))}

def fetch_json(url, key=None, timeout=4):
    req = urllib.request.Request(url, headers={"X-Api-Key": key} if key else {})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())

def printer_status(p):
    base, key = p["url"], p.get("key")
    try:
        if p["type"] == "moonraker":
            d = fetch_json(base + "/printer/objects/query?extruder&heater_bed&print_stats&display_status", key)["result"]["status"]
            ps = d.get("print_stats", {})
            st = {"standby": "idle", "complete": "done", "cancelled": "idle"}.get(ps.get("state", "standby"), ps.get("state", "idle"))
            return {"state": st, "file": ps.get("filename") or "", "progress": round((d.get("display_status", {}).get("progress") or 0) * 100),
                    "nozzle": round(d.get("extruder", {}).get("temperature", 0)), "nozzleTarget": round(d.get("extruder", {}).get("target", 0)),
                    "bed": round(d.get("heater_bed", {}).get("temperature", 0)), "bedTarget": round(d.get("heater_bed", {}).get("target", 0))}
        a = fetch_json(base + "/api/printer", key)
        fl = a.get("state", {}).get("flags", {})
        st = "error" if fl.get("error") else "paused" if fl.get("paused") else "printing" if fl.get("printing") else "idle"
        j = fetch_json(base + "/api/job", key)
        t = a.get("temperature", {})
        return {"state": st, "file": (j.get("job", {}).get("file", {}) or {}).get("name") or "", "progress": round((j.get("progress", {}).get("completion") or 0)),
                "nozzle": round(t.get("tool0", {}).get("actual") or 0), "nozzleTarget": round(t.get("tool0", {}).get("target") or 0),
                "bed": round(t.get("bed", {}).get("actual") or 0), "bedTarget": round(t.get("bed", {}).get("target") or 0)}
    except urllib.error.HTTPError as e:
        return {"state": "error" if e.code in (401, 403) else "offline", "error": "HTTP %d" % e.code}
    except Exception as e:
        return {"state": "offline", "error": str(e)[:80]}

def printer_cmd(p, action, name=None):
    h = {"X-Api-Key": p["key"]} if p.get("key") else {}
    if p["type"] == "moonraker":
        url = p["url"] + ("/printer/print/start?filename=" + urllib.parse.quote(name) if action == "start" else "/printer/print/" + action)
        req = urllib.request.Request(url, data=b"", headers=h, method="POST")
    else:
        h["Content-Type"] = "application/json"
        if action == "start":
            url, body = p["url"] + "/api/files/local/" + urllib.parse.quote(name), {"command": "select", "print": True}
        elif action == "cancel":
            url, body = p["url"] + "/api/job", {"command": "cancel"}
        else:
            url, body = p["url"] + "/api/job", {"command": "pause", "action": action}
        req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=h, method="POST")
    with urllib.request.urlopen(req, timeout=10) as r:
        return r.status

def printer_webcam(p):
    try:
        if p["type"] == "moonraker":
            d = fetch_json(p["url"] + "/server/webcams/list", p.get("key"))
            u = next((w.get("stream_url") for w in d["result"]["webcams"] if w.get("enabled", True) and w.get("stream_url")), None)
        else:
            w = fetch_json(p["url"] + "/api/settings", p.get("key")).get("webcam", {})
            u = w.get("streamUrl") if w.get("webcamEnabled", True) else None
        return urllib.parse.urljoin(p["url"] + "/", u) if u else None
    except Exception:
        return None

def log_event(p, action, name="", ok=True, note=""):
    try:
        with DB_LOCK, db() as c:
            c.execute("INSERT INTO history(t,printer,action,file,ok,note) VALUES(?,?,?,?,?,?)", (int(time.time() * 1000), p["name"], action, name, 1 if ok else 0, note))
            c.execute("DELETE FROM history WHERE id NOT IN (SELECT id FROM history ORDER BY id DESC LIMIT 200)")
        c.close()
    except Exception as e:
        print("  (could not write history: %s)" % e)

def history_json():
    c = db()
    try:
        rows = c.execute("SELECT t,printer,action,file,ok,note FROM history ORDER BY id").fetchall()
    finally:
        c.close()
    return json.dumps([{"t": r[0], "printer": r[1], "action": r[2], "file": r[3], "ok": bool(r[4]), "note": r[5]} for r in rows]).encode()

def multipart(fields, fname, data):
    b = "----pr%d" % time.time_ns()
    out = b""
    for k, v in fields.items():
        out += ("--%s\r\nContent-Disposition: form-data; name=\"%s\"\r\n\r\n%s\r\n" % (b, k, v)).encode()
    out += ("--%s\r\nContent-Disposition: form-data; name=\"file\"; filename=\"%s\"\r\nContent-Type: application/octet-stream\r\n\r\n" % (b, fname)).encode() + data + ("\r\n--%s--\r\n" % b).encode()
    return out, "multipart/form-data; boundary=" + b

def printer_upload(p, fname, data, start):
    key = p.get("key")
    if p["type"] == "moonraker":
        url, fields = p["url"] + "/server/files/upload", {"print": "true" if start else "false"}
    else:
        url, fields = p["url"] + "/api/files/local", {"print": "true" if start else "false", "select": "true" if start else "false"}
    body, ctype = multipart(fields, fname, data)
    h = {"Content-Type": ctype}
    if key:
        h["X-Api-Key"] = key
    with urllib.request.urlopen(urllib.request.Request(url, data=body, headers=h, method="POST"), timeout=60) as r:
        return r.status

# ---------------- AR share (tiny separate server that can ONLY show one model behind a secret link) ----------------
def ar_token():
    fp = os.path.join(AR_DIR, "token.txt")
    if os.path.exists(fp):
        t = open(fp).read().strip()
        if re.fullmatch(r"[A-Za-z0-9_-]{8,40}", t):
            return t
    t = secrets.token_urlsafe(9)
    open(fp, "w").write(t)
    return t

AR_TOKEN = ar_token()

def lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

AR_PAGE = """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>__NAME__ in AR</title><script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js"></script>
<style>body{margin:0;font-family:system-ui,sans-serif;background:linear-gradient(160deg,#fff4fb,#f3eaff 55%,#e7f4ff);color:#4a2a8a;min-height:100vh;display:flex;flex-direction:column}
header{padding:14px 18px}h1{margin:0;font-size:20px;background:linear-gradient(90deg,#7c3aed,#ff5fa8);-webkit-background-clip:text;background-clip:text;color:transparent}small{color:#9a8cb8}
model-viewer{flex:1;min-height:60vh;width:100%;--poster-color:transparent}
.ar{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);border:0;border-radius:999px;padding:14px 26px;font:700 16px system-ui;color:#fff;background:linear-gradient(90deg,#7c3aed,#ff5fa8);box-shadow:0 10px 24px rgba(124,58,237,.4)}
.note{padding:12px 18px 20px;font-size:13px;color:#7a6a99}.chip{display:inline-block;background:#fff;border-radius:999px;padding:3px 10px;margin-right:6px;box-shadow:0 3px 8px rgba(124,58,237,.15)}</style></head>
<body><header><h1>__NAME__</h1><small><span class="chip">__SIZE__</span><span class="chip">__COLOR__</span></small></header>
<model-viewer src="/ar/__TOKEN__/model.glb" ar ar-modes="webxr scene-viewer quick-look" ar-scale="fixed" camera-controls touch-action="pan-y" shadow-intensity="1" exposure="1.1" auto-rotate alt="__NAME__">
<button slot="ar-button" class="ar">View in your room (AR)</button></model-viewer>
<div class="note">Shown at its real printed size. Tap the button, point your camera at a table or desk and move your phone slowly so it can find the surface. Colours on screens never match filament exactly.</div></body></html>"""

class ARHandler(http.server.BaseHTTPRequestHandler):
    def _out(self, code, body, ctype="text/plain"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        base = "/ar/" + AR_TOKEN
        model = os.path.join(AR_DIR, "model.glb")
        if path in (base, base + "/"):
            if not os.path.exists(model):
                return self._out(404, b"No model shared yet - click View in AR in the Studio first.")
            try:
                meta = json.load(open(os.path.join(AR_DIR, "meta.json"), encoding="utf8"))
            except Exception:
                meta = {}
            esc = lambda x: str(x).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")
            html = AR_PAGE.replace("__TOKEN__", AR_TOKEN).replace("__NAME__", esc(meta.get("name", "3D model"))).replace("__SIZE__", esc(meta.get("size", ""))).replace("__COLOR__", esc(meta.get("color", "")))
            return self._out(200, html.encode("utf8"), "text/html; charset=utf-8")
        if path == base + "/model.glb" and os.path.exists(model):
            return self._out(200, open(model, "rb").read(), "model/gltf-binary")
        self._out(404, b"Not found")

    def log_message(self, *a):
        pass

def start_ar_server():
    try:
        socketserver.ThreadingTCPServer.allow_reuse_address = True
        srv = socketserver.ThreadingTCPServer(("0.0.0.0", AR_PORT), ARHandler)
        if AR_HTTPS:
            ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            ctx.load_cert_chain(AR_HTTPS[0], AR_HTTPS[1])
            srv.socket = ctx.wrap_socket(srv.socket, server_side=True)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        return True
    except Exception as e:
        print("  (AR share server not started: %s)" % e)
        return False

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def _send(self, code=200, body=b"", ctype="application/json", extra=None):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def _file_id(self, path):
        m = re.fullmatch(r"/api/files/(\d{1,20})", path)
        return m.group(1) if m else None

    def _body(self, limit):
        n = int(self.headers.get("Content-Length") or 0)
        if n > limit:
            return None
        return self.rfile.read(n)

    def _printer_route(self, path):
        m = re.fullmatch(r"/api/printers/(\d{1,20})(/status|/print|/start|/cancel|/pause|/resume|/webcam)?", path)
        return (m.group(1), m.group(2)) if m else (None, None)

    def _session_user(self):
        try:
            jar = http.cookies.SimpleCookie(self.headers.get("Cookie", ""))
            token = jar.get("pr_session").value if jar.get("pr_session") else ""
        except Exception:
            token = ""
        if not token:
            return None
        digest = hashlib.sha256(token.encode("ascii", "ignore")).hexdigest()
        now = int(time.time())
        with DB_LOCK:
            c = db()
            try:
                row = c.execute("SELECT users.id, users.username FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires>?", (digest, now)).fetchone()
                c.execute("DELETE FROM sessions WHERE expires<=?", (now,))
                c.commit()
            finally:
                c.close()
        return {"id": row[0], "username": row[1]} if row else None

    def _set_session(self, user_id):
        token = secrets.token_urlsafe(32)
        digest = hashlib.sha256(token.encode("ascii")).hexdigest()
        expires = int(time.time()) + 30 * 24 * 60 * 60
        with DB_LOCK:
            c = db()
            try:
                c.execute("INSERT INTO sessions(token_hash,user_id,expires) VALUES(?,?,?)", (digest, user_id, expires))
                c.commit()
            finally:
                c.close()
        self._send(200, json.dumps({"ok": True}).encode(), extra={"Set-Cookie": "pr_session=%s; Path=/; HttpOnly; SameSite=Lax; Max-Age=%d" % (token, 30 * 24 * 60 * 60)})

    def _auth_json(self, body_limit=8192):
        try:
            raw = self._body(body_limit)
            data = json.loads(raw or b"{}")
            if not isinstance(data, dict):
                raise ValueError
            return data
        except Exception:
            return None

    def _login(self, data):
        if not data:
            return self._send(400, b'{"error":"Enter a username and password."}')
        username = str(data.get("username", "")).strip().lower()
        password = data.get("password", "")
        if not re.fullmatch(r"[a-z0-9_.-]{3,32}", username) or not isinstance(password, str) or len(password) > 1024:
            return self._send(400, b'{"error":"Enter a valid username and password."}')
        c = db()
        try:
            row = c.execute("SELECT id,salt,password_hash FROM users WHERE username=?", (username,)).fetchone()
        finally:
            c.close()
        candidate = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes(row[1]) if row else b"printready-invalid-user", 310000)
        if not row or not hmac.compare_digest(candidate, bytes(row[2])):
            return self._send(401, b'{"error":"Username or password is incorrect."}')
        return self._set_session(row[0])

    def _register(self, data):
        if not data:
            return self._send(400, b'{"error":"Enter a username and password."}')
        username = str(data.get("username", "")).strip().lower()
        password = data.get("password", "")
        if not re.fullmatch(r"[a-z0-9_.-]{3,32}", username):
            return self._send(400, b'{"error":"Use 332 letters, numbers, dots, dashes, or underscores for the username."}')
        if not isinstance(password, str) or len(password) < 10 or len(password) > 1024:
            return self._send(400, b'{"error":"Password must be at least 10 characters."}')
        salt = secrets.token_bytes(16)
        digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 310000)
        try:
            with DB_LOCK:
                c = db()
                try:
                    cur = c.execute("INSERT INTO users(username,salt,password_hash,created) VALUES(?,?,?,?)", (username, salt, digest, int(time.time())))
                    user_id = cur.lastrowid
                    c.commit()
                finally:
                    c.close()
        except sqlite3.IntegrityError:
            return self._send(409, b'{"error":"That username is already registered."}')
        return self._set_session(user_id)

    def _auth_page(self, path):
        user = self._session_user()
        if path == "/login.html":
            if user:
                self.send_response(302); self.send_header("Location", "/index.html"); self.end_headers(); return True
            return False
        if not user:
            self.send_response(302); self.send_header("Location", "/login.html"); self.end_headers(); return True
        return False

    def do_POST(self):
        u = urllib.parse.urlparse(self.path)
        if u.path == "/api/auth/login":
            return self._login(self._auth_json())
        if u.path == "/api/auth/register":
            return self._register(self._auth_json())
        if u.path == "/api/auth/logout":
            user = self._session_user()
            if user:
                try:
                    jar = http.cookies.SimpleCookie(self.headers.get("Cookie", "")); token = jar.get("pr_session").value
                    digest = hashlib.sha256(token.encode("ascii", "ignore")).hexdigest()
                    with DB_LOCK, db() as c: c.execute("DELETE FROM sessions WHERE token_hash=?", (digest,))
                except Exception:
                    pass
            return self._send(200, b'{"ok":true}', extra={"Set-Cookie": "pr_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"})
        if not self._session_user():
            self.close_connection = True
            return self._send(401, b'{"error":"Sign in to continue."}')
        if u.path == "/api/printers":
            try:
                d = json.loads(self._body(65536) or b"{}")
                url = str(d.get("url", "")).strip().rstrip("/")
                if d.get("type") not in ("moonraker", "octoprint") or not re.match(r"https?://", url) or not str(d.get("name", "")).strip():
                    raise ValueError
            except Exception:
                return self._send(400, b'{"error":"need name, type (moonraker|octoprint) and an http(s) url"}')
            p = {"id": str(time.time_ns() // 1000), "name": str(d["name"]).strip()[:60], "type": d["type"], "url": url, "key": str(d.get("key", "")).strip()}
            add_printer(p)
            return self._send(200, json.dumps(public(p)).encode())
        pid, sub = self._printer_route(u.path)
        if pid and sub in ("/start", "/cancel", "/pause", "/resume"):
            p = next((x for x in load_printers() if x["id"] == pid), None)
            if not p:
                return self._send(404, b'{"error":"unknown printer"}')
            state = printer_status(p).get("state")
            if sub == "/start":
                if state not in ("idle", "done"):
                    log_event(p, "start", q0 if (q0 := urllib.parse.parse_qs(u.query).get("name", [""])[0]) else "", False, "refused: printer is " + str(state))
                    return self._send(409, json.dumps({"error": "printer is '%s' - it must be idle to start a print" % state}).encode())
                q = urllib.parse.parse_qs(u.query)
                name = re.sub(r"[^\w.\- ]", "_", q.get("name", [""])[0])[:80]
                if not name.lower().endswith((".gcode", ".gco", ".g")):
                    return self._send(400, b'{"error":"need a .gcode file name"}')
            else:
                need = {"/cancel": ("printing", "paused"), "/pause": ("printing",), "/resume": ("paused",)}[sub]
                if state not in need:
                    return self._send(409, json.dumps({"error": "cannot %s - printer is '%s'" % (sub[1:], state)}).encode())
                name = None
            try:
                printer_cmd(p, sub[1:], name)
                log_event(p, sub[1:], name or "")
                return self._send(200, b'{"ok":true}')
            except urllib.error.HTTPError as e:
                log_event(p, sub[1:], name or "", False, "HTTP %d" % e.code)
                return self._send(502, json.dumps({"error": "printer answered HTTP %d" % e.code}).encode())
            except Exception as e:
                log_event(p, sub[1:], name or "", False, "unreachable")
                return self._send(502, json.dumps({"error": "could not reach printer: " + str(e)[:80]}).encode())
        if pid and sub == "/print":
            p = next((x for x in load_printers() if x["id"] == pid), None)
            if not p:
                return self._send(404, b'{"error":"unknown printer"}')
            q = urllib.parse.parse_qs(u.query)
            name = re.sub(r"[^\w.\- ]", "_", q.get("name", ["model.gcode"])[0])[:80] or "model.gcode"
            body = self._body(MAX_FILE)
            if not body:
                return self._send(400, b'{"error":"empty file"}')
            try:
                code = printer_upload(p, name, body, q.get("start", ["0"])[0] == "1")
                log_event(p, "uploaded", name, True, "%d KB" % (len(body) // 1024))
                return self._send(200, json.dumps({"ok": True, "status": code}).encode())
            except urllib.error.HTTPError as e:
                log_event(p, "uploaded", name, False, "HTTP %d" % e.code)
                return self._send(502, json.dumps({"error": "printer answered HTTP %d" % e.code}).encode())
            except Exception as e:
                log_event(p, "uploaded", name, False, "unreachable")
                return self._send(502, json.dumps({"error": "could not reach printer: " + str(e)[:80]}).encode())
        self._send(404, b'{"error":"not found"}')

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path == "/api/auth/status":
            user = self._session_user()
            c = db()
            try: count = c.execute("SELECT COUNT(*) FROM users").fetchone()[0]
            finally: c.close()
            return self._send(200, json.dumps({"authenticated": bool(user), "username": user["username"] if user else "", "userCount": count}).encode())
        if path == "/login.html":
            if self._auth_page(path): return
        elif not self._session_user():
            if path.startswith("/api/"):
                return self._send(401, b'{"error":"Sign in to continue."}')
            self.send_response(302); self.send_header("Location", "/login.html"); self.end_headers(); return
        safe_path = urllib.parse.unquote(path)
        if safe_path.startswith("/data/") or safe_path in ("/server.py", "/build.py"):
            return self._send(404, b"not found", "text/plain")
        if path == "/api/printers":
            return self._send(200, json.dumps([public(p) for p in load_printers()]).encode())
        pid, sub = self._printer_route(path)
        if pid and sub == "/webcam":
            p = next((x for x in load_printers() if x["id"] == pid), None)
            if not p:
                return self._send(404, b'{"error":"unknown printer"}')
            return self._send(200, json.dumps({"url": printer_webcam(p)}).encode())
        if pid and sub == "/status":
            p = next((x for x in load_printers() if x["id"] == pid), None)
            if not p:
                return self._send(404, b'{"error":"unknown printer"}')
            return self._send(200, json.dumps(printer_status(p)).encode())
        if path == "/api/ping":
            return self._send(200, b'{"ok":true}')
        if path == "/api/records":
            return self._send(200, kv_get("records", b"[]"))
        if path == "/api/ar":
            return self._send(200, json.dumps({"token": AR_TOKEN, "port": AR_PORT, "lanIp": lan_ip(), "https": bool(AR_HTTPS), "running": AR_RUNNING[0], "hasModel": os.path.exists(os.path.join(AR_DIR, "model.glb"))}).encode())
        if path == "/api/settings":
            return self._send(200, kv_get("settings", b"{}"))
        if path == "/api/history":
            return self._send(200, history_json())
        if path == "/api/stats":
            return self._send(200, kv_get("stats", b"{}"))
        fid = self._file_id(path)
        if fid:
            c = db()
            try:
                r = c.execute("SELECT name, data FROM files WHERE id=?", (fid,)).fetchone()
            finally:
                c.close()
            if not r:
                return self._send(404, b'{"error":"not found"}')
            return self._send(200, bytes(r[1]), "application/octet-stream", {"X-Name": urllib.parse.quote(r[0])})
        return super().do_GET()

    def do_PUT(self):
        path = urllib.parse.urlparse(self.path).path
        if not self._session_user():
            self.close_connection = True
            return self._send(401, b'{"error":"Sign in to continue."}')
        if path == "/api/ar":
            body = self._body(120 * 1024 * 1024)
            if not body or body[:4] != b"glTF":
                return self._send(400, b'{"error":"expected a .glb file"}')
            try:
                meta = json.loads(urllib.parse.unquote(self.headers.get("X-Meta", "{}")))
            except Exception:
                meta = {}
            open(os.path.join(AR_DIR, "model.glb"), "wb").write(body)
            json.dump({k: str(meta.get(k, ""))[:120] for k in ("name", "size", "color")}, open(os.path.join(AR_DIR, "meta.json"), "w", encoding="utf8"))
            return self._send(200, json.dumps({"ok": True, "token": AR_TOKEN, "port": AR_PORT, "lanIp": lan_ip(), "https": bool(AR_HTTPS), "running": AR_RUNNING[0], "path": "/ar/" + AR_TOKEN + "/"}).encode())
        if path == "/api/settings":
            body = self._body(64 * 1024)
            try:
                if not isinstance(json.loads(body or b"{}"), dict):
                    raise ValueError
            except Exception:
                return self._send(400, b'{"error":"bad json"}')
            kv_put("settings", body)
            return self._send(200, b'{"ok":true}')
        if path == "/api/stats":
            body = self._body(1024 * 1024)
            try:
                if not isinstance(json.loads(body or b"{}"), dict):
                    raise ValueError
            except Exception:
                return self._send(400, b'{"error":"bad json"}')
            kv_put("stats", body)
            return self._send(200, b'{"ok":true}')
        if path == "/api/records":
            body = self._body(8 * 1024 * 1024)
            try:
                json.loads(body or b"[]")
            except Exception:
                return self._send(400, b'{"error":"bad json"}')
            kv_put("records", body)
            return self._send(200, b'{"ok":true}')
        fid = self._file_id(path)
        if fid:
            body = self._body(MAX_FILE)
            if body is None:
                return self._send(413, b'{"error":"file too large"}')
            name = urllib.parse.unquote(self.headers.get("X-Name", fid))[:200]
            with DB_LOCK, db() as c:
                c.execute("INSERT OR REPLACE INTO files(id,name,size,created,data) VALUES(?,?,?,?,?)", (fid, name, len(body), int(time.time() * 1000), sqlite3.Binary(body)))
            c.close()
            return self._send(200, b'{"ok":true}')
        self._send(404, b'{"error":"not found"}')

    def do_DELETE(self):
        if not self._session_user():
            self.close_connection = True
            return self._send(401, b'{"error":"Sign in to continue."}')
        if urllib.parse.urlparse(self.path).path == "/api/history":
            with DB_LOCK, db() as c:
                c.execute("DELETE FROM history")
            c.close()
            return self._send(200, b'{"ok":true}')
        pid, sub = self._printer_route(urllib.parse.urlparse(self.path).path)
        if pid and not sub:
            delete_printer(pid)
            return self._send(200, b'{"ok":true}')
        fid = self._file_id(urllib.parse.urlparse(self.path).path)
        if not fid:
            return self._send(404, b'{"error":"not found"}')
        with DB_LOCK, db() as c:
            c.execute("DELETE FROM files WHERE id=?", (fid,))
        c.close()
        self._send(200, b'{"ok":true}')

    def log_message(self, fmt, *args):
        if "/api/" not in (args[0] if args else ""):
            sys.stderr.write("  " + fmt % args + "\n")

if __name__ == "__main__":
    args = sys.argv[1:]
    port = 8000
    no_ar = "--no-ar" in args
    i = 0
    while i < len(args):
        a = args[i]
        if a == "--ar-port" and i + 1 < len(args):
            AR_PORT = int(args[i + 1])
            i += 2
        elif a == "--ar-cert" and i + 3 < len(args) and args[i + 2] == "--ar-key":
            AR_HTTPS = (args[i + 1], args[i + 3])
            i += 4
        elif a.isdigit():
            port = int(a)
            i += 1
        else:
            i += 1
    init_db()
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("127.0.0.1", port), Handler) as srv:
        print(f"PrintReady AI running at http://localhost:{port}  (Ctrl+C to stop)")
        print(f"Everything is saved in the database: {DB_PATH}")
        if not no_ar:
            AR_RUNNING[0] = start_ar_server()
            if AR_RUNNING[0]:
                print(f"AR share page (only shows one 3D model): {'https' if AR_HTTPS else 'http'}://{lan_ip()}:{AR_PORT}/ar/{AR_TOKEN}/")
        try:
            srv.serve_forever()
        except KeyboardInterrupt:
            print("\nBye! 🐾")
