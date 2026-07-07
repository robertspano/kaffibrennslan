#!/usr/bin/env python3
"""Static server + tiny CMS backend for Kaffibrennslan (local editing).

- Serves the site with caching disabled.
- POST /api/save   -> writes content.json, then auto-commits & pushes to GitHub
                      (so the live site updates ~1 min later).
- POST /api/upload -> saves an uploaded image to assets/img/.

No password is required for requests from your own machine (localhost) — the
editor runs locally, which only you can reach. Requests from anywhere else must
send the password (KAFFI_ADMIN_PW), so a public tunnel can't be edited.
"""
import http.server, socketserver, json, os, sys, io, re, base64, secrets, subprocess, threading

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
ADMIN_PASSWORD = os.environ.get("KAFFI_ADMIN_PW", "kaffi2025")
ROOT = os.path.dirname(os.path.abspath(__file__))
CONTENT_PATH = os.path.join(ROOT, "content.json")
IMG_DIR = os.path.join(ROOT, "assets", "img")
MAX_SAVE = 512 * 1024
MAX_UPLOAD = 12 * 1024 * 1024
EXT = {"image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}


def publish():
    """Commit + push so GitHub Pages updates. Best-effort, never blocks the reply for long."""
    try:
        subprocess.run(["git", "add", "-A"], cwd=ROOT, timeout=20, capture_output=True)
        subprocess.run(["git", "commit", "-m", "Uppfæra efni frá ritli"], cwd=ROOT, timeout=20, capture_output=True)
        subprocess.run(["git", "push"], cwd=ROOT, timeout=60, capture_output=True)
    except Exception:
        pass


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def _is_local(self):
        ip = self.client_address[0] if self.client_address else ""
        return ip in ("127.0.0.1", "::1", "localhost", "::ffff:127.0.0.1")

    def _json(self, code, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self, limit):
        try:
            n = int(self.headers.get("Content-Length", 0))
        except ValueError:
            n = 0
        if n <= 0 or n > limit:
            return None
        try:
            return json.loads(self.rfile.read(n).decode("utf-8"))
        except Exception:
            return None

    def _authed(self, payload):
        return self._is_local() or payload.get("password") == ADMIN_PASSWORD

    def do_POST(self):
        path = self.path.split("?")[0]
        if path == "/api/save":
            return self._save()
        if path == "/api/upload":
            return self._upload()
        return self._json(404, {"ok": False, "error": "not found"})

    def _save(self):
        payload = self._read_body(MAX_SAVE)
        if payload is None:
            return self._json(400, {"ok": False, "error": "bad request"})
        if not self._authed(payload):
            return self._json(401, {"ok": False, "error": "rangt lykilorð"})
        content = payload.get("content")
        if not isinstance(content, dict):
            return self._json(400, {"ok": False, "error": "missing content"})
        try:
            text = json.dumps(content, ensure_ascii=False, indent=2)
            tmp = CONTENT_PATH + ".tmp"
            with io.open(tmp, "w", encoding="utf-8") as f:
                f.write(text + "\n")
            os.replace(tmp, CONTENT_PATH)
        except Exception as e:
            return self._json(500, {"ok": False, "error": str(e)})
        # publish to GitHub in the background so the reply is instant
        threading.Thread(target=publish, daemon=True).start()
        return self._json(200, {"ok": True, "published": True})

    def _upload(self):
        payload = self._read_body(MAX_UPLOAD)
        if payload is None:
            return self._json(400, {"ok": False, "error": "of stór eða ógild skrá"})
        if not self._authed(payload):
            return self._json(401, {"ok": False, "error": "rangt lykilorð"})
        data = payload.get("data", "")
        m = re.match(r"^data:([^;]+);base64,(.+)$", data, re.S)
        if not m:
            return self._json(400, {"ok": False, "error": "ógilt myndsnið"})
        mime = m.group(1).lower()
        if mime not in EXT:
            return self._json(400, {"ok": False, "error": "aðeins JPG, PNG, WEBP eða GIF"})
        try:
            raw = base64.b64decode(m.group(2))
        except Exception:
            return self._json(400, {"ok": False, "error": "gat ekki lesið mynd"})
        if not raw:
            return self._json(400, {"ok": False, "error": "tóm skrá"})
        stem = os.path.splitext(os.path.basename(payload.get("name", "mynd")))[0]
        stem = re.sub(r"[^a-zA-Z0-9_-]+", "-", stem).strip("-").lower()[:40] or "mynd"
        fname = "up-" + stem + "-" + secrets.token_hex(3) + "." + EXT[mime]
        try:
            os.makedirs(IMG_DIR, exist_ok=True)
            with open(os.path.join(IMG_DIR, fname), "wb") as f:
                f.write(raw)
        except Exception as e:
            return self._json(500, {"ok": False, "error": str(e)})
        return self._json(200, {"ok": True, "path": "assets/img/" + fname})


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as httpd:
    print("Kaffibrennslan CMS á http://localhost:%d" % PORT)
    print("Ritill:  http://localhost:%d/index.html?edit=1" % PORT)
    httpd.serve_forever()
