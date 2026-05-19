/* =============================================
   CLUB Scheduler -- Service Worker
   Caches app shell for offline use
   ============================================= */

const CACHE_NAME = 'club-scheduler-v005';

const ASSETS = [
  './index.html?v=005',
  './ui.css?v=005',
  './rounds.css?v=005',
  './main.js?v=005',
  './HomeScreen.js?v=005',
  './home.js?v=005',
  './settings.js?v=005',
  './players.js?v=005',
  './rounds.js?v=005',
  './games.js?v=005',
  './summary.js?v=005',
  './dashboard.js?v=005',
  './viewer.js?v=005',
  './report.js?v=005',
  './profile.js?v=005',
  './auth.js?v=005',
  './authUI.js?v=005',
  './subscription.js?v=005',
  './supabase.js?v=005',
  './importPlayers.js?v=005',
  './engjap.js?v=005',
  './ExportCSS.js?v=005',
  './build.js?v=005',
  './app.js?v=005',
  './github.js?v=005',
  './help.js?v=005',
  './snapshot.js?v=005',
  './manifest.json?v=005',
  './male.png?v=005',
  './female.png?v=005',
  './win-cup.png?v=005',
  './lock.png?v=005',
  './unlock.png?v=005',
  './icon-192.png?v=005',
  './icon-512.png?v=005',
  './help_en.json?v=005',
  './help_jp.json?v=005',
  './help_kr.json?v=005',
  './help_zh.json?v=005',
  './help_vi.json?v=005'
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
        return cached || caches.match('./index.html?v=005');
      });
    })
  );
});
