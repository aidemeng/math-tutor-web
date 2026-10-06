// Retire the previous network cache of authenticated API responses.
self.addEventListener('activate', event => event.waitUntil(caches.delete('tutor-media')));
