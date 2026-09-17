/* AddPlates service worker.

   This exists so the app can receive push notifications - iOS will not deliver
   one to a web app without a service worker to receive it. It does nothing else,
   ON PURPOSE.

   A service worker's usual job is caching, and this whole app is a single HTML
   file. A caching mistake here means a phone keeps serving the old copy after a
   deploy, forever, with no error to say so. So version 1 ships with NO fetch
   handler at all: a worker without one does not intercept any request, and the
   network behaves exactly as it did before it existed. Prove it installs and
   updates cleanly first; give it power over what loads later, if ever.

   Bump SW_VERSION on every change, so `navigator.serviceWorker` telling you a
   new worker took over actually means something. */
const SW_VERSION = "sw-1";

self.addEventListener("install", () => {
  /* Take over on the next page load rather than waiting for every tab to close.
     Without this a new worker can sit in "waiting" for days and a deploy looks
     like it never happened. */
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    /* Nothing is cached today. Clearing anyway means a cache left behind by a
       future version can never outlive the worker that created it - the escape
       hatch is in place before there is anything to escape from. */
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    } catch (err) { /* caches unavailable - nothing to clean */ }
    await self.clients.claim();
  })());
});

/* No fetch listener. See the note at the top - this is the safety property, not
   an omission. */

self.addEventListener("message", (e) => {
  if (e.data === "sw-version" && e.source) e.source.postMessage({swVersion: SW_VERSION});
});
