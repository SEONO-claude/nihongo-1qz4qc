// 오프라인용 서비스 워커: 앱 파일을 폰에 저장해 두고 인터넷 없이도 연다.
// 인터넷이 될 때는 항상 새 파일을 받고, 그 사본을 저장해 둔다.
const VERSION = 'v43'
const CACHE = `nihongo-${VERSION}`
const FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './quiz.js',
  './level.js',
  './conjugate.js',
  './data/words.js',
  './data/adjectives.js',
  './data/nouns.js',
  './data/kanji.js',
  './data/highkanji.js',
  './data/grammar.js',
  './data/talk.js',
  './data/ono.js',
  './data/numbers.js',
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
  './images/cat-kuro.webp',
  './images/cat-shiro.webp',
  './images/cat-mikan.webp',
  './images/cat-moka.webp',
  './images/cat-hachi.webp',
  './images/cat-gin.webp',
  './images/cat-tora.webp',
  './images/cat-maru.webp',
  './images/cat-sabi.webp',
  './images/cat-mofu.webp',
  './images/cat-kuro-think.webp',
  './images/cat-kuro-cheer.webp',
  './images/cat-kuro-sad.webp',
  './images/cat-kuro-party.webp',
  './images/cat-shiro-think.webp',
  './images/cat-shiro-cheer.webp',
  './images/cat-shiro-sad.webp',
  './images/cat-shiro-party.webp',
  './images/cat-mikan-think.webp',
  './images/cat-mikan-cheer.webp',
  './images/cat-mikan-sad.webp',
  './images/cat-mikan-party.webp',
  './images/cat-moka-think.webp',
  './images/cat-moka-cheer.webp',
  './images/cat-moka-sad.webp',
  './images/cat-moka-party.webp',
  './images/cat-hachi-think.webp',
  './images/cat-hachi-cheer.webp',
  './images/cat-hachi-sad.webp',
  './images/cat-hachi-party.webp',
  './images/cat-gin-think.webp',
  './images/cat-gin-cheer.webp',
  './images/cat-gin-sad.webp',
  './images/cat-gin-party.webp',
  './images/cat-tora-think.webp',
  './images/cat-tora-cheer.webp',
  './images/cat-tora-sad.webp',
  './images/cat-tora-party.webp',
  './images/cat-maru-think.webp',
  './images/cat-maru-cheer.webp',
  './images/cat-maru-sad.webp',
  './images/cat-maru-party.webp',
  './images/cat-sabi-think.webp',
  './images/cat-sabi-cheer.webp',
  './images/cat-sabi-sad.webp',
  './images/cat-sabi-party.webp',
  './images/cat-mofu-think.webp',
  './images/cat-mofu-cheer.webp',
  './images/cat-mofu-sad.webp',
  './images/cat-mofu-party.webp',
  './images/cat-mike-mid.webp',
  './images/cat-mike-high.webp',
  './images/cat-kuro-mid.webp',
  './images/cat-kuro-high.webp',
  './images/cat-shiro-mid.webp',
  './images/cat-shiro-high.webp',
  './images/cat-mikan-mid.webp',
  './images/cat-mikan-high.webp',
  './images/cat-moka-mid.webp',
  './images/cat-moka-high.webp',
  './images/cat-hachi-mid.webp',
  './images/cat-hachi-high.webp',
  './images/cat-gin-mid.webp',
  './images/cat-gin-high.webp',
  './images/cat-tora-mid.webp',
  './images/cat-tora-high.webp',
  './images/cat-maru-mid.webp',
  './images/cat-maru-high.webp',
  './images/cat-sabi-mid.webp',
  './images/cat-sabi-high.webp',
  './images/cat-mofu-mid.webp',
  './images/cat-mofu-high.webp',
  './audio/bgm.mp3',
  './audio/bgm-01.mp3',
  './audio/bgm-02.mp3',
  './audio/bgm-03.mp3',
  './audio/bgm-04.mp3',
  './audio/bgm-05.mp3',
  './audio/bgm-06.mp3',
  './audio/bgm-07.mp3',
  './audio/bgm-08.mp3',
  './audio/bgm-09.mp3',
  './audio/bgm-10.mp3',
]

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()))
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
      fetch(req, { cache: 'no-cache' }).then(res => save(req, res))
        .catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html')))
    )
  } else {
    event.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => save(req, res)))
    )
  }
})
