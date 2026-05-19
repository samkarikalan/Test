/* =============================================
   CLUB Scheduler -- Service Worker
   Caches app shell for offline use
   ============================================= */

const CACHE_NAME = 'club-scheduler-v007';

const ASSETS = [
  './index.html?v=007',
  './ui.css?v=007',
  './rounds.css?v=007',
  './main.js?v=007',
  './HomeScreen.js?v=007',
  './home.js?v=007',
  './settings.js?v=007',
  './players.js?v=007',
  './rounds.js?v=007',
  './games.js?v=007',
  './summary.js?v=007',
  './dashboard.js?v=007',
  './viewer.js?v=007',
  './report.js?v=007',
  './profile.js?v=007',
  './auth.js?v=007',
  './authUI.js?v=007',
  './subscription.js?v=007',
  './supabase.js?v=007',
  './importPlayers.js?v=007',
  './engjap.js?v=007',
  './ExportCSS.js?v=007',
  './build.js?v=007',
  './app.js?v=007',
  './github.js?v=007',
  './help.js?v=007',
  './snapshot.js?v=007',
  './manifest.json?v=007',
  './male.png?v=007',
  './female.png?v=007',
  './win-cup.png?v=007',
  './lock.png?v=007',
  './unlock.png?v=007',
  './icon-192.png?v=007',
  './icon-512.png?v=007',
  './help_en.json?v=007',
  './help_jp.json?v=007',
  './help_kr.json?v=007',
  './help_zh.json?v=007',
  './help_vi.json?v=007'
];

/* ── Install: cache all assets (safe -- one failure won't block install) ── */
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return Promise.all(
        ASSETS.map(function(url) {
          return cache.add(url).catch(function(e) {
            console.warn('SW: failed to cache', url, e);
          });
        })
      );
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

/* ── Message: SKIP_WAITING from page ── */
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/* ── Activate: clean up old caches and claim all clients ── */
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) { return key !== CACHE_NAME; })
            .map(function(key) { return caches.delete(key); })
      );
    }).then(function() {
      return self.clients.claim();
    }).then(function() {
      // Tell all open tabs to reload so they get the new version
      return self.clients.matchAll({ type: 'window' }).then(function(clients) {
        clients.forEach(function(client) { client.navigate(client.url); });
      });
    })
  );
});

/* ── Fetch: network first, cache as offline fallback ── */
self.addEventListener('fetch', function(event) {
  // Always go to network for API calls
  if (event.request.url.includes('supabase.co')) return;
  if (event.request.url.includes('workers.dev')) return;
  if (event.request.url.includes('/db/')) return;
  if (event.request.url.includes('/auth/')) return;
  if (event.request.url.includes('/sub/')) return;
  if (event.request.url.includes('/generate-round')) return;

  event.respondWith(
    fetch(event.request).then(function(response) {
      // Got fresh response — update cache and return it
      if (response && response.status === 200 && response.type === 'basic') {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone);
        });
      }
      return response;
    }).catch(function() {
      // Offline — serve from cache
      return caches.match(event.request).then(function(cached) {
        return cached || caches.match('./index.html?v=007');
      });
    })
  );
});
