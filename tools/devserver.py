"""Локальный сервер для разработки: отдаёт файлы игры без кэширования.

Ещё принимает PUT /release/... — так страницы из tools/ сохраняют обложки
и кадры видео прямо в папку release/. Слушает только 127.0.0.1.

Запуск: python3 tools/devserver.py [порт]
"""
import functools
import http.server
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RELEASE = os.path.join(ROOT, "release")
SAFE = re.compile(r"^/release/([A-Za-z0-9_\-]+/)*[A-Za-z0-9_\-]+\.(png|txt)$")


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_PUT(self):
        if not SAFE.match(self.path):
            self.send_error(403, "only /release/*.png|txt")
            return
        dest = os.path.normpath(os.path.join(ROOT, self.path.lstrip("/")))
        if not dest.startswith(RELEASE + os.sep):
            self.send_error(403)
            return
        length = int(self.headers.get("Content-Length", 0))
        if length > 20 * 1024 * 1024:
            self.send_error(413)
            return
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, "wb") as f:
            f.write(self.rfile.read(length))
        self.send_response(201)
        self.end_headers()

    def log_message(self, fmt, *args):
        if self.command != "PUT":
            super().log_message(fmt, *args)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8770
    handler = functools.partial(Handler, directory=ROOT)
    http.server.ThreadingHTTPServer(("127.0.0.1", port), handler).serve_forever()
