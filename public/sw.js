// The service worker exists so the workspace can be installed to a home screen
// and still open when the signal drops. It is deliberately small: there is no
// build step generating a precache manifest, because the two rules below are
// enough for how this app is actually shipped.
//
//   1. The page itself is fetched from the network first. A deploy has to be
//      picked up the next time somebody opens the app, and an app shell served
//      from a cache that never checks is how a PWA ends up months behind.
//   2. Everything under /assets/ is content-hashed by Vite, so a given URL can
//      never change what it holds. Those are cached on first use and served
//      from the cache for ever after.
//
// Nothing else is touched. Supabase — the REST calls, the realtime socket, the
// storage downloads — passes straight through, because a cached answer about
// what the shop is doing is worse than no answer at all.

const VERSION = 'boba-bear-v2'
const SHELL = `${VERSION}-shell`
const ASSETS = `${VERSION}-assets`

// What an installed app needs to paint something on a cold, offline start.
const SHELL_URLS = [
  '/',
  '/site.webmanifest',
  '/logo-mark.png',
  '/logo-lockup.png',
  '/favicon.ico',
  '/icon-apple-180.png',
  '/icon-192.png',
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL)
      // One missing icon must not take the whole install down with it.
      .then(cache => Promise.allSettled(SHELL_URLS.map(url => cache.add(url))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(name => !name.startsWith(VERSION)).map(name => caches.delete(name))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', event => {
  // The page asking to be updated now rather than on the next cold start.
  if (event.data === 'skip-waiting') { self.skipWaiting(); return }

  // The page telling us which hashed files it is actually running on.
  //
  // A worker installed on the first visit did not exist when that visit's
  // script and stylesheet were fetched, so it never saw them and could not
  // cache them. Without this, an app added to a home screen and then taken out
  // of signal paints the shell and boots nothing: you would have had to load it
  // twice, online, before it worked once offline.
  if (event.data && event.data.type === 'cache-assets' && Array.isArray(event.data.urls)) {
    event.waitUntil(caches.open(ASSETS).then(cache => Promise.allSettled(
      event.data.urls.map(url => cache.match(url).then(hit => hit ? undefined : cache.add(url))),
    )))
  }
})

const isAsset = url => url.pathname.startsWith('/assets/')

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Anything that is not this app's own origin is somebody else's business:
  // Supabase, Google Fonts. Let the browser do what it would have done.
  if (url.origin !== self.location.origin) return

  // The document. Network first, and the cached shell only if the network is
  // genuinely unavailable — so a deploy lands on the next open.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone()
          void caches.open(SHELL).then(cache => cache.put('/', copy))
          return response
        })
        .catch(() => caches.match('/').then(hit => hit ?? Response.error())),
    )
    return
  }

  // Hashed assets. The URL is the version, so a hit is always correct.
  if (isAsset(url)) {
    event.respondWith(
      caches.match(request).then(hit => hit ?? fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone()
          void caches.open(ASSETS).then(cache => cache.put(request, copy))
        }
        return response
      })),
    )
    return
  }

  // Icons and the manifest: whatever is cached, refreshed quietly behind it.
  if (SHELL_URLS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then(hit => {
        const live = fetch(request).then(response => {
          if (response.ok) {
            const copy = response.clone()
            void caches.open(SHELL).then(cache => cache.put(request, copy))
          }
          return response
        }).catch(() => hit ?? Response.error())
        return hit ?? live
      }),
    )
  }
})
