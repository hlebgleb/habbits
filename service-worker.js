// Service Worker для PWA и Push-уведомлений

const CACHE_NAME = 'habbits-v1';
const urlsToCache = [
    '/',
    '/gleb',
    '/styles.css',
    '/app.js',
    '/database-config.js',
    '/notion-api.js',
    '/manifest.json'
];

// Установка Service Worker
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching app shell');
                return cache.addAll(urlsToCache);
            })
            .then(() => self.skipWaiting())
    );
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Service Worker...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch с кэшированием (network first, fallback to cache)
self.addEventListener('fetch', (event) => {
    // Пропускаем API запросы
    if (event.request.url.includes('/api/')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Кэшируем новый ответ
                if (response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Если сеть недоступна, берём из кэша
                return caches.match(event.request);
            })
    );
});

// Обработка Push-уведомлений
self.addEventListener('push', (event) => {
    console.log('[SW] Push received:', event);

    let data = {
        title: 'Трекер Привычек',
        body: 'Не забудь отметить привычки за сегодня!',
        icon: '/icons/icon.svg',
        badge: '/icons/icon.svg',
        tag: 'habits-reminder',
        data: {
            url: '/gleb'
        }
    };

    if (event.data) {
        try {
            data = { ...data, ...event.data.json() };
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: data.icon,
        badge: data.badge,
        tag: data.tag,
        data: data.data,
        vibrate: [200, 100, 200],
        requireInteraction: true,
        actions: [
            {
                action: 'open',
                title: 'Открыть'
            },
            {
                action: 'dismiss',
                title: 'Позже'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Клик по уведомлению
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked:', event);

    event.notification.close();

    if (event.action === 'dismiss') {
        return;
    }

    const urlToOpen = event.notification.data?.url || '/gleb';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Если есть открытое окно, фокусируемся на нём
                for (const client of clientList) {
                    if (client.url.includes('/gleb') && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Иначе открываем новое окно
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});
