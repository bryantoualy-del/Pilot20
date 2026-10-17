import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
const root = path.resolve(process.env.PILOT20_WEB_ROOT ?? "dist"),
  port = Number(process.env.PORT ?? 4173),
  types = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".json": "application/json",
    ".css": "text/css",
    ".svg": "image/svg+xml",
    ".webp":"image/webp",
    ".png":"image/png",
    ".webmanifest": "application/manifest+json",
  };
http
  .createServer(async (req, res) => {
    try {
      const name = decodeURIComponent(
          new URL(req.url, "http://localhost").pathname,
        ),
        file = path.resolve(root, "." + name);
      if (file !== root && !file.startsWith(root + path.sep)) {
        res.writeHead(403).end();
        return;
      }
      const target = (await stat(file)).isDirectory()
        ? path.join(file, "index.html")
        : file;
      res
        .writeHead(200, {
          "Content-Type":
            types[path.extname(target)] ?? "application/octet-stream",
          "Cache-Control": "no-cache",
          "X-Content-Type-Options": "nosniff",
        })
        .end(await readFile(target));
    } catch {
      res.writeHead(404).end("Not found");
    }
  })
  .listen(port, "127.0.0.1", () =>
    console.log("Pilot20: http://127.0.0.1:" + port + "/web/index.html"),
  );
