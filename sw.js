/* =============================================
   CLUB Scheduler -- Service Worker
   Caches app shell for offline use
   ============================================= */

const CACHE_NAME = 'club-scheduler-v006';

const ASSETS = [
  './index.html?v=006',
  './ui.css?v=006',
  './rounds.css?v=006',
  './main.js?v=006',
  './HomeScreen.js?v=006',
  './home.js?v=006',
  './settings.js?v=006',
  './players.js?v=006',
  './rounds.js?v=006',
  './games.js?v=006',
  './summary.js?v=006',
  './dashboard.js?v=006',
  './viewer.js?v=006',
  './report.js?v=006',
  './profile.js?v=006',
  './auth.js?v=006',
  './authUI.js?v=006',
  './subscription.js?v=006',
  './supabase.js?v=006',
  './importPlayers.js?v=006',
  './engjap.js?v=006',
  './ExportCSS.js?v=006',
  './build.js?v=006',
  './app.js?v=006',
  './github.js?v=006',
  './help.js?v=006',
  './snapshot.js?v=006',
  './manifest.json?v=006',
  './male.png?v=006',
  './female.png?v=006',
  './win-cup.png?v=006',
  './lock.png?v=006',
  './unlock.png?v=006',
  './icon-192.png?v=006',
  './icon-512.png?v=006',
  './help_en.json?v=006',
  './help_jp.json?v=006',
  './help_kr.json?v=006',
  './help_zh.json?v=006',
  './help_vi.json?v=006'
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
        return cached || caches.match('./index.html?v=006');
      });
    })
  );
});
