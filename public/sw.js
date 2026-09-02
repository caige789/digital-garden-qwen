/* 数字花园 Service Worker：静态缓存 + 离线可用 + 更新提示 */
const VERSION = "garden-v2.3.0";
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(["./", "./index.html", "./manifest.webmanifest"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => {
        self.clients.matchAll().then((cls) => cls.forEach((c) => c.postMessage({ type: "SW_UPDATE" })));
        return self.clients.claim();
      })
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (!url.protocol.startsWith("http")) return;

  if (url.origin !== location.origin) {
    e.respondWith(
      caches.open(RUNTIME_CACHE).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        try { const res = await fetch(req); if (res.ok) c.put(req, res.clone()); return res; } catch { return hit || Response.error(); }
      })
    );
    return;
  }

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req, { cache: "no-cache" })
        .then(async (res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
            return res;
          }
          // 服务器返回错误时回退缓存，绝不展示错误页/白屏
          return (await caches.match(req)) || (await caches.match("./index.html")) || res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match("./index.html")) || Response.error())
    );
    return;
  }

  e.respondWith(
    caches.open(RUNTIME_CACHE).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })
  );
});
