self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  const message = event.data ? event.data.json() : {}
  event.waitUntil(
    self.registration.showNotification(message.title ?? 'Электронный колледж', {
      body: message.body ?? '',
      data: { url: message.url ?? '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = new URL(event.notification.data?.url ?? '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const openWindow = windows.find((client) => client.url.startsWith(self.location.origin))
      if (openWindow) {
        openWindow.navigate(targetUrl)
        return openWindow.focus()
      }
      return self.clients.openWindow(targetUrl)
    }),
  )
})
