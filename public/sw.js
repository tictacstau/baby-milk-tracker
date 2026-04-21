const CACHE_NAME = 'teambaby-v1';
const FIREBASE_HOSTS = [
  'firestore.googleapis.com',
  'firebase.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebaseio.com',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    fetch('/asset-manifest.json')
      .then((res) => res.json())
      .then((manifest) => {
        const urls = [
          '/',
          '/index.html',
          '/site.webmanifest',
          '/favicon.svg',
          '/favicon.ico',
          '/favicon-32x32.png',
          '/favicon-16x16.png',
          '/apple-touch-icon.png',
          '/android-chrome-192x192.png',
          '/android-chrome-512x512.png',
        ];
        Object.values(manifest.files || {}).forEach((url) => {
          if (!url.endsWith('.map')) urls.push(url);
        });
        return caches.open(CACHE_NAME).then((cache) => cache.addAll(urls));
      })
      .catch(() => caches.open(CACHE_NAME))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function isFirebaseRequest(url) {
  return FIREBASE_HOSTS.some((host) => url.hostname.includes(host));
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (isFirebaseRequest(url)) return;
  if (event.request.method !== 'GET') return;

  // HTML navigation — network first, fall back to cached index.html
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Static assets — cache first, network fallback
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return res;
      });
    })
  );
});
