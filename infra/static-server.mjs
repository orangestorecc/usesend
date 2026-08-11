#!/usr/bin/env node
/**
 * Servidor estático mínimo, sem dependências.
 * Serve o export de `apps/marketing` para o middleware do app reescrever.
 *
 *   node static-server.mjs <diretorio> [porta]
 */
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join, extname, normalize, resolve } from "node:path";

const ROOT = resolve(process.argv[2] ?? "./out");
const PORT = Number(process.argv[3] ?? process.env.PORT ?? 3001);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

async function resolveFile(urlPath) {
  // normalize + prefixo obrigatório: impede subir de diretório com "..".
  const clean = normalize(decodeURIComponent(urlPath.split("?")[0]));
  const candidate = resolve(join(ROOT, clean));
  if (!candidate.startsWith(ROOT)) return null;

  const tries = [
    candidate,
    `${candidate}.html`,
    join(candidate, "index.html"),
  ];
  for (const p of tries) {
    try {
      const s = await stat(p);
      if (s.isFile()) return { path: p, size: s.size };
    } catch {
      // tenta o próximo
    }
  }
  return null;
}

const server = createServer(async (req, res) => {
  const found = await resolveFile(req.url ?? "/");

  if (!found) {
    const notFound = await resolveFile("/404.html");
    if (notFound) {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      createReadStream(notFound.path).pipe(res);
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("404");
    return;
  }

  const type = TYPES[extname(found.path).toLowerCase()] ?? "application/octet-stream";
  const immutable = found.path.includes("/_next/static/");
  res.writeHead(200, {
    "Content-Type": type,
    "Content-Length": found.size,
    "Cache-Control": immutable
      ? "public, max-age=31536000, immutable"
      : "public, max-age=0, must-revalidate",
  });
  createReadStream(found.path).pipe(res);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`site estatico em http://127.0.0.1:${PORT} servindo ${ROOT}`);
});
