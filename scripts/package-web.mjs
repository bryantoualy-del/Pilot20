import {
  readdir,
  mkdir,
  copyFile,
  writeFile,
  rm,
  readFile,
} from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
const root = new URL("../", import.meta.url).pathname,
  out = path.join(root, "dist");
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const assets = [];
async function copy(dir) {
  for (const entry of await readdir(path.join(root, dir), {
    withFileTypes: true,
  })) {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) await copy(relative);
    else if (/\.(js|json|html|css|svg|webp|png|webmanifest)$/.test(entry.name)) {
      await mkdir(path.dirname(path.join(out, relative)), { recursive: true });
      await copyFile(path.join(root, relative), path.join(out, relative));
      assets.push(relative);
    }
  }
}
await copy("src");
await copy("web");
const hash = createHash("sha256");
for (const name of assets) {
  hash.update(name);
  hash.update(await readFile(path.join(root, name)));
}
const worker = `const VERSION='pilot20-v03-${hash.digest("hex").slice(0, 16)}';const ASSETS=${JSON.stringify(assets)};const BASE=new URL('./',self.location);self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(VERSION);await cache.addAll(ASSETS.map(p=>new URL(p,BASE).href));await self.skipWaiting();})()));self.addEventListener('activate',event=>event.waitUntil((async()=>{await Promise.all((await caches.keys()).filter(k=>k.startsWith('pilot20-v03-')&&k!==VERSION).map(k=>caches.delete(k)));await self.clients.claim();for(const c of await self.clients.matchAll())c.postMessage({type:'cache-ready'});})()));self.addEventListener('message',event=>{if(event.data?.type==='status')event.waitUntil((async()=>{const cache=await caches.open(VERSION);const ready=await cache.match(new URL('web/index.html',BASE).href);if(ready)event.source?.postMessage({type:'cache-ready'});})());});self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==BASE.origin)return;event.respondWith((async()=>{const cache=await caches.open(VERSION);const found=await cache.match(event.request,{ignoreSearch:true});if(found)return found;try{return await fetch(event.request);}catch(e){if(event.request.mode==='navigate')return Response.redirect(new URL('web/index.html',BASE).href);throw e;}})());});`;
await writeFile(path.join(out, "sw.js"), worker);
await writeFile(
  path.join(out, "index.html"),
  '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=./web/index.html"><a href="./web/index.html">Pilot20</a>',
);
console.log("Packaged " + assets.length + " local assets into dist/");
