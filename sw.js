const CACHE_NAME = 'fittracker-cache-v4';

const urlsToCache = [
  './',
  './index.html',
  './core.js',
  './foodtrack.html',
  './foodtrack.js',
  './train.html',
  './train.js',
  './skincare.html',
  './skincare.js',
  './summary.html',
  './summary.js',
  './trip.html',
  './trip.js',
  './manifest.json',
  './addons.html',
  './addons.js',
  './finance.html',
  './finance.js',
  './gear.html',
  './gear.js',
  './focus.html',
  './focus.js',
  './car.html',
  './car.js'
];

// 1. ติดตั้งและเก็บไฟล์ทั้งหมดลง Cache
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

// 2. ลบ Cache เวอร์ชันเก่าทิ้งอัตโนมัติ
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. ดึงไฟล์จากเน็ตก่อน ถ้าออฟไลน์ค่อยดึงจาก Cache (Network-First)
self.addEventListener('fetch', (event) => {
  // ข้ามการแคช API ภายนอก (GitHub API, Gemini, OpenStreetMap)
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const resClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
