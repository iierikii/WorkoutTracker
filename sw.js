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
const SW_VERSION = "sw-2";

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

/* A push arrives with the app closed - this is the whole reason the worker
   exists. `userVisibleOnly` was set when subscribing, so a push MUST result in
   a visible notification; showing nothing gets the subscription revoked. Hence
   the fallback text rather than an early return on bad data. */
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) {
    try { d = { body: e.data.text() }; } catch (err2) { d = {}; }
  }
  e.waitUntil(self.registration.showNotification(d.title || "Rest over \u2014 next set", {
    body: d.body || "Time for the next one.",
    tag: d.tag || "addplates-rest",     /* replaces an earlier one rather than stacking */
    renotify: true,
    icon: "icon-192.png",
    badge: "icon-192.png",
    data: { url: d.url || "./" }
  }));
});

/* Tapping it should land you back in the workout, not open a second copy. */
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const want = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all){ if ("focus" in c) return c.focus(); }
    if (self.clients.openWindow) return self.clients.openWindow(want);
  })());
});

/* iOS can retire a subscription on its own. Clearing it here means the app can
   tell the difference between "off" and "quietly stopped working". */
self.addEventListener("pushsubscriptionchange", (e) => {
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) c.postMessage({ pushSubscriptionLost: true });
  })());
});

self.addEventListener("message", (e) => {
  if (e.data === "sw-version" && e.source) e.source.postMessage({swVersion: SW_VERSION});
});
