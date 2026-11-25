PrintReady AI v35
=================
Keep all files in this folder together.

LOCAL ACCOUNTS
  Start the backend with python server.py and open http://localhost:8000.
  On first run, choose Create an account. Usernames and salted password hashes are stored in data/printready.db.
  A successful sign-in opens the workspace. Protected pages and APIs require a session; use Sign out in the top bar.
  The login screen requires the backend and is not available from file:// or Live Server alone.

NEW in v35: voice - your pals talk and listen (all pages)
  Click the 🎤 button in the round button row above the pals to open "Talk to your pal".
  VOICE OUTPUT (pals talk): click a pal and it says its line out loud, each pal with its own pitch (Bamboo low,
    Chirpy squeaky). The guided tour reads each step, and the little pop-up messages are read too.
    The panel lets you pick the voice, the "cuteness" (pitch) and the speed, and switch talking off.
    It picks the cutest English voice your browser has. In Microsoft Edge the best ones are "Ana (natural)" (a young
    voice) and "Jenny (natural)" - choose them in the Voice list. Natural voices ignore the pitch slider.
  VOICE INPUT (say commands): tap the big mic, allow the microphone when Edge asks, then say for example:
    "open studio", "open dashboard", "use the demo model", "wireframe", "x-ray", "heat map", "toolpath", "solid",
    "front view", "reset view", "export G code", "print report", "lay flat", "heal", "fit to bed", "slicer settings",
    "colours", "material PETG", "add printer" (dashboard), "take the tour", "help", "stop talking", "voice off".
    Say "help" and the pal tells you what it understands. "Upload" cannot open the file picker by voice (browsers
    only allow that with a real click) - it highlights the button instead.
  SAFETY: voice can NEVER start, pause, resume or cancel a print or send a file to a printer.
  Notes: voice input in Edge/Chrome sends your voice to the browser's online speech service, so it needs internet
    and microphone permission (use http://localhost:8000 - opening the file directly asks again every time).
    It does not work in Firefox. Settings are remembered in your browser (pr_voice).
  Source: src/js/voice.js (+ the panel styles at the end of src/css/fx.css).

NEW in v34: real database (SQLite)
  python server.py now keeps everything in ONE file: data/printready.db - uploaded models, recent-models list,
  statistics, slicer settings, print history and your printers. SQLite is built into Python, so nothing to install.
  * Your old data is imported automatically the first time you start v34 on a folder that has a 'data' folder from
    v32/v33 (copy that data folder into this one first). The old files (files/, records.json, ...) are left
    untouched as a backup - once you have checked everything, you may delete them.
  * Back up = copy data/printready.db (while the server is stopped). Start fresh = delete data/printready.db.
  * Browse it yourself: VS Code extension "SQLite Viewer", or DB Browser for SQLite. Tables: files, kv (records,
    stats, settings), history, printers. Printer API keys are inside this file, so keep the data folder private.
  * The AR share files stay as plain files in data/ar (the separate port 8001 server reads them).
  * The website uses the local server for sign-in and its APIs; model preview still works in browser storage when pages are opened directly.

NEW in v33: source files + build step (for easy editing)
  The pages (index.html, dashboard.html, studio.html, login.html) are generated from source and served by python server.py.
  They are now GENERATED from readable source files:
    src/js/*.js    fx.js (floating emojis, blobs, pals), badge.js (green "build loaded" badge), tour.js,
                   ui.js, qr.js, studio-app.js, dashboard-app.js, plus small per-page scripts
    src/css/*.css  fx.css (the cute effects) and small per-page style files
    src/img/*.png  the four pal pictures (Bamboo, Pip, Foxy, Chirpy)
    src/pages/*.html  the page layouts with markers such as @@INLINE js/ui.js@@ where code gets inlined
  To change something: edit the file in src/, then run   python build.py   (or double-click build.bat),
  and reload the page. Do NOT edit the generated index/dashboard/studio.html directly - they are overwritten.
  The build number is VERSION at the top of build.py (shown in the green badge). Needs no installs.
  Checked: building with VERSION=32 reproduces the v32 pages byte for byte, so nothing changed in behaviour.

EASY WAY (recommended - remembers your models, any size)
  1. Open a terminal in this folder (in VS Code: Terminal > New Terminal)
  2. Run:   python server.py        (Mac/Linux: python3 server.py)
     (or double-click start.bat on Windows)
  3. Open   http://localhost:8000   in your browser
  Your uploaded models are saved in the database file data/printready.db next to server.py.
  Press Ctrl+C in the terminal to stop.

NO-SERVER WAY
  Open index.html with VS Code Live Server. Models up to 1.5 MB are remembered
  in the browser; bigger ones need the server.

Studio: upload .stl/.obj, Toolpath view, Export G-code (2 walls + supports), Print report (PDF).

NEW in v32: a guided tour (first visit, or click the 🐾 button above the pals) and sound effects (🔊 button mutes them).

NEW in v32: connect real printers (needs python server.py)
  Dashboard > Printer Fleet > "+ Add printer"
    Klipper / Moonraker (Mainsail, Fluidd): address like http://192.168.1.50:7125
    OctoPrint: address like http://octopi.local plus the API key (OctoPrint Settings > API)
  Live status shows every 5 seconds. In Studio use "Send to printer" - it only UPLOADS the G-code
  and only starts a print if you confirm a second prompt. Bambu Lab printers are not supported yet.
  Printer addresses and API keys are stored in the 'data' folder on your computer.

NEW in v32: start and cancel prints (needs python server.py)
  * Studio > Send to printer: after the upload you are asked separately "Start printing NOW?".
    Cancel keeps the file on the printer without starting. The server refuses to start unless the
    printer reports idle (not printing, offline or in error).
  * Dashboard > Printer Fleet: a "Cancel print" button appears on a printer that is printing/paused
    and asks for confirmation. Only start prints when the bed is clear and filament is loaded.

NEW in v32: Pause / Resume (needs python server.py)
  Dashboard > Printer Fleet: a printing printer shows Pause, Cancel print; a paused one shows Resume, Cancel print.
  Resume asks for confirmation. The server only accepts a command that matches the printer's real state.

NEW in v32: real dashboard statistics
  The four cards at the top of the Dashboard now show your real numbers (counted over ALL your uploads):
  Models Analysed (+ uploads per day), Printability Checks (average score of analysed models),
  Printing Hours Est. (total estimated print time) and Filament Needed (total grams / metres).
  Until you upload your first model they show demo values. 'Clear my uploads' also resets these totals.

NEW in v32
  * Dashboard statistics are cumulative: every upload is counted, even though only the last 8 models are kept.
  * Printer webcam: click the camera button on a printer card (Klipper/Moonraker and OctoPrint webcams;
    the stream is loaded directly from the printer, so you must be on the same network).

NEW in v32: print history (needs python server.py)
  Dashboard > "Print history" card (under Printer Fleet) lists uploads, starts, pauses, resumes and cancels
  sent to your printers - including failures (printer offline, command refused). Saved in data/history.json.
  The Clear button on the card empties it.

v32: the Print history card has a cute new look (mascot, colour-coded timeline, chat-bubble entries).

v32: cute makeover for the 4 stat cards (pal mascots, pastel colours) and the Printer Fleet panel (animal avatars, striped progress bars, temperature pills).

NEW in v32: Slicer settings (Studio)
  Click the gear button (above the pals, next to the tour and sound buttons) to set, in plain English:
  layer height, infill %, number of walls, nozzle and bed temperature, print speed, and whether supports are on.
  The slicer, the G-code header, the time/filament estimates and the PDF report all follow your settings.
  With python server.py they are also saved in data/settings.json; otherwise in your browser.

NEW in v32: material presets + cooling fan
  In the Slicer settings (gear button) pick a Material - PLA, PLA+, Silk PLA, PETG, ABS or TPU - to fill in
  nozzle/bed temperature, speed and fan in one click. Edit any number and it switches to 'Custom'.
  The G-code now controls the part-cooling fan (off for the first 2 layers, then your fan %, off at the end).
  Presets are common starting points - always check your filament spool's recommended temperatures.

NEW in v32: retraction settings
  Slicer settings (gear button) now have Retraction (mm) and Retract speed (mm/s). The G-code pulls the filament
  back before every travel move and pushes it forward again afterwards, which reduces stringing.
  Typical: 0.5-1 mm for direct-drive printers, 4-6 mm for Bowden tube printers, 0 = off.
  Each material preset sets its own values (PETG 1.2 mm, TPU 0.5 mm, PLA 0.8 mm).

NEW in v32: filament colours + AR (augmented reality)
=====================================================
1) COLOUR PREVIEW (works anywhere)
   Studio > the paint-palette button (above the pals) > pick a filament colour and a finish
   (Matte, Silk, Metallic, Translucent, Glow) or any custom colour. The 3D viewer shows it immediately.

2) VIEW IN AR (needs python server.py + a phone)
   a) Start the app:  python server.py
      The terminal prints an "AR share page" link (port 8001). It can ONLY show one 3D model.
   b) Studio > palette button > "View in AR". A window shows a 3D preview (needs internet - it uses
      Google's free model-viewer) and a link AND a QR code for your phone (just scan it with the phone camera).
   c) Phones only allow AR on a secure https address. Easiest free way:
        - install "cloudflared" (Cloudflare Tunnel, free, no account needed for a quick tunnel)
        - run:  cloudflared tunnel --url http://localhost:8001
        - copy the https://....trycloudflare.com address it prints and paste it into the box in the AR window.
          The link in the window becomes https://....trycloudflare.com/ar/<secret>/  - open it on your phone.
      Alternative if you have your own certificate (for example made with mkcert):
        python server.py --ar-cert cert.pem --ar-key key.pem
   d) On the phone tap "View in your room (AR)". Android uses Google's AR (Chrome / Scene Viewer),
      iPhone uses AR Quick Look. Move the phone slowly so it can find a table or floor.
      The model appears at its real printed size and in the colour you chose.

SAFETY (please read)
  * Port 8000 is the main app. It controls your printers. NEVER put a tunnel or port-forward on 8000.
  * Port 8001 is the AR share page. It only serves the current model behind a secret link
    (stored in data/ar/token.txt - delete the file to get a new link). Stop sharing any time by pressing
    Ctrl+C, or run  python server.py --no-ar  to turn the AR share page off completely.
  * Screen colours never match real filament exactly, especially silk, metallic and glow types.
  * Not supported yet: several colours per model (one colour for the whole model).

v32: the AR window now shows a QR code for the phone link. It updates when you paste your https tunnel address. Built-in generator, no internet needed for the QR itself.

v32 - big fix-up: uploads, dead buttons and a proper test pass
  * Studio always starts with the DEMO model, and now has two clear buttons: "Upload my model" and "Use demo model".
    You can also drop a file ANYWHERE on any page (a pink "Drop your model here" screen appears), or use the
    "Quick Upload" button in the top bar. On the Dashboard the big upload box and Quick Upload now work too and
    open the model in the Studio.
  * Understands .STL (binary, ASCII, odd exports), .OBJ and .3MF. CAD files (STEP etc.) and broken files get a
    clear message telling you what to do. Choosing the same file twice works.
  * Every button and link now does something useful: sidebar links, notifications bell, Grid/List, project search,
    viewer toolbar icons, Stage/Assembly tabs, Diagnostics, Auto-Heal, Auto Center, Lay Flat (really lays the model
    on its largest flat side), fullscreen, material shortcuts on the landing page, Pricing, Subscribe, boop buttons.
    Things that are not built yet say so in a friendly note instead of doing nothing.

v32 - 3MF plates keep their layout
  3MF files with several objects now keep each object's position and rotation from the plate (build items,
  components and transforms are applied, and units are converted). Colours, materials and print settings
  stored in the 3MF are still ignored - you get the shapes only.

v32 - Studio panels now tell the truth
  * Mesh Integrity Audit is calculated from YOUR model: open (non-manifold) edges, inverted normals, a score,
    and the "Valid mesh / Needs repair" badge. Self-intersections are shown as "not checked" (not measured yet).
  * The scale buttons 50% / 75% / 150% now really scale the model, and "Fit Bed" fits it to the 256 mm plate.
  * Loading a new model always starts at 100% scale. Models bigger than the plate show a warning.
  * The built-in demo kitten is now a clean, watertight mesh.

v32 - Auto-Heal can now repair
  Studio > Auto-Heal: removes broken (zero-area) and duplicate triangles, FLIPS inside-out normals and FILLS simple holes
  (each hole is closed with a fan of triangles). It reports exactly what it did. Holes with complicated shapes or models
  over ~150,000 triangles are not filled - use Meshmixer or 3D Builder for those. Always check the result before printing.
