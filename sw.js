// 오프라인용 서비스 워커: 앱 파일을 폰에 저장해 두고 인터넷 없이도 연다.
// 인터넷이 될 때는 항상 새 파일을 받고, 그 사본을 저장해 둔다.
const VERSION = 'v10'
const CACHE = `nihongo-${VERSION}`
const FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './quiz.js',
  './conjugate.js',
  './data/words.js',
  './data/adjectives.js',
  './data/nouns.js',
  './data/kanji.js',
  './data/grammar.js',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './images/home.webp',
  './images/kanji.webp',
  './images/mascot.webp',
  './images/mascot-think.webp',
  './images/mascot-cheer.webp',
  './images/mascot-sad.webp',
  './images/mascot-party.webp',
]

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('nihongo-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

function save(request, res) {
  if (res.ok || res.type === 'opaque') {
    const copy = res.clone()
    caches.open(CACHE).then(cache => cache.put(request, copy))
  }
  return res
}

// 앱 파일: 인터넷이 되면 새 파일을 받아 저장하고, 안 되면(비행기 안) 저장해 둔 파일을 쓴다
// 웹 글꼴: 저장해 둔 것을 먼저 쓴다
self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET') return
  const sameOrigin = new URL(req.url).origin === self.location.origin
  if (sameOrigin) {
    event.respondWith(
      fetch(req).then(res => save(req, res))
        .catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html')))
    )
  } else {
    event.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => save(req, res)))
    )
  }
})
