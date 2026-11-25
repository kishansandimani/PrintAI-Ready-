#!/usr/bin/env python3
"""PrintReady AI build step (Python standard library only).

Reads the page templates in src/pages/*.html, replaces every marker
    @@INLINE js/xyz.js@@     with the file's text (from src/)
    @@IMG name.png@@         with a base64 data URI of src/img/name.png
    @@VERSION@@              with VERSION below
and writes the three standalone pages (index.html, dashboard.html, studio.html)
next to this file.  Run:  python build.py
"""
import base64, os, re, sys

VERSION = 35          # <- bump this every version; shown in the green "build vNN loaded" badge

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'src')
PAGES = ['index', 'dashboard', 'studio', 'login']


def read(rel):
    with open(os.path.join(SRC, rel), encoding='utf-8', newline='') as f:
        return f.read()


def build_page(name, version):
    text = read(os.path.join('pages', name + '.html'))
    text = re.sub(r'@@INLINE ([\w./-]+)@@', lambda m: read(m.group(1)), text)

    def img(m):
        with open(os.path.join(SRC, 'img', m.group(1)), 'rb') as f:
            return 'data:image/png;base64,' + base64.b64encode(f.read()).decode()
    text = re.sub(r'@@IMG ([\w.-]+)@@', img, text)
    text = text.replace('@@VERSION@@', str(version))
    left = re.findall(r'@@(?:INLINE|IMG)[^@]*@@', text)
    if left:
        sys.exit('Unresolved marker in %s: %s' % (name, left[0]))
    return text


def main():
    version = int(sys.argv[1]) if len(sys.argv) > 1 else VERSION
    for name in PAGES:
        out = build_page(name, version)
        with open(os.path.join(HERE, name + '.html'), 'w', encoding='utf-8', newline='') as f:
            f.write(out)
        print('built %s.html (%d KB)' % (name, len(out.encode('utf-8')) // 1024))
    print('PrintReady build v%d done.' % version)


if __name__ == '__main__':
    main()
