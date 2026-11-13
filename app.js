// ───── 진도 저장 (localStorage) ─────
const STORE_KEY = 'jp-study-progress'
const EMPTY = { seen: {}, seenKanji: [], learnedForms: [], wrong: [], learnedKanji: [], wrongKanji: [], lastStudy: '', studyDays: [], today: { date: '', cards: 0, quizzes: 0, xp: 0 }, xp: 0, sound: true, music: false, savedGrammar: [], seenHigh: [], seenGrammar: [], learnedGrammar: [], wrongGrammar: [], stages: {}, graduated: [], badges: [], bestCombo: 0, musicVol: 1, sfxVol: 1, buddy: 'mike', track: 'all', talkSeen: [], learnedTalk: [], wrongTalk: [], talkStamps: {}, learnedOno: [], wrongOno: [], review: {}, master: {}, chests: 0, mock: {}, autoSpeak: false, placed: false, openedOn: '' }

function loadProgress() {
  try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}') } }
  catch { return { ...EMPTY } }
}
function todayStr(offset = 0) {
  const d = new Date(); d.setDate(d.getDate() + offset)
  return d.toLocaleDateString('sv-SE')   // 내 기기 날짜, "2026-11-12" 모양
}
// 오늘 공부 도장: 카드를 보거나 문제를 풀었을 때만
function markStudy() {
  progress.lastStudy = todayStr()
  if (!progress.studyDays.includes(progress.lastStudy)) {
    progress.studyDays = [...progress.studyDays, progress.lastStudy].slice(-90)
    state.stampedNow = true
  }
}
function saveProgress() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(progress)) } catch { /* 저장이 막힌 브라우저 */ }
}
const progress = loadProgress()

// 오늘 한 공부 (날짜가 바뀌면 0부터)
function todayStats() {
  if (progress.today.date !== todayStr()) progress.today = { date: todayStr(), cards: 0, quizzes: 0, xp: 0 }
  for (const k of ['xp', 'correct', 'scenes', 'reviews', 'stages', 'grammar']) if (progress.today[k] === undefined) progress.today[k] = 0
  return progress.today
}
function bumpToday(key) { todayStats()[key]++; saveProgress() }

// 경험치(XP): 카드 1, 정답 10, 퀴즈 끝내기 20
function addXP(n, x, y) {
  todayStats().xp += n
  progress.xp = (progress.xp || 0) + n
  saveProgress()
  updateTop()
  if (x !== undefined) {
    const el = document.createElement('div')
    el.className = 'xpfloat'; el.textContent = `+${n} XP`
    el.style.left = x + 'px'; el.style.top = y + 'px'
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 1100)
  }
}

// ───── 소리 (효과음 · 배경음악) ─────
// 아이폰은 Web Audio 소리를 무음 모드에서 막지만, 오디오 플레이어(<audio>) 소리는 무음 모드에서도 낸다.
// 그래서 Web Audio는 쓰지 않는다. 효과음은 앱이 켜질 때 짧은 WAV 파일로 미리 만들어 두고 오디오 플레이어로 튼다.

// 소리 조각(PCM) → WAV 파일. 아이폰 사파리는 재생 중 음량을 바꿀 수 없어서, 음량을 바꾸면 그 크기로 파일을 다시 만든다.
function wavURL(pcm, rate, gain = 1) {
  const len = pcm.length, buf = new ArrayBuffer(44 + len * 2), v = new DataView(buf)
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF'); v.setUint32(4, 36 + len * 2, true); str(8, 'WAVEfmt '); v.setUint32(16, 16, true)
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true)
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, len * 2, true)
  for (let k = 0; k < len; k++) v.setInt16(44 + k * 2, Math.max(-1, Math.min(1, pcm[k] * gain)) * 32767, true)
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))
}

// 음 몇 개를 이어 붙인 짧은 소리를 WAV 파일로 만든다 (인터넷 필요 없음)
function renderTone(freqs, { dur = 0.13, type = 'triangle', gap = 0.09, vol = 0.3 } = {}, gain = 1) {
  const rate = 22050, len = Math.ceil(rate * ((freqs.length - 1) * gap + dur + 0.05))
  const pcm = new Float32Array(len)
  freqs.forEach((f, i) => {
    const start = Math.floor(i * gap * rate), n = Math.floor(dur * rate)
    for (let k = 0; k < n && start + k < len; k++) {
      const t = k / rate, ph = (f * t) % 1
      const wave = type === 'sine' ? Math.sin(2 * Math.PI * ph) : 1 - 4 * Math.abs(ph - 0.5)   // 삼각파
      const env = Math.min(1, t / 0.012) * Math.exp(-5 * t / dur)                              // 빠르게 켜지고 천천히 사라짐
      pcm[start + k] += wave * env * vol
    }
  })
  return wavURL(pcm, rate, gain)
}

const SFX_DEF = {
  good: [[659, 988], { gap: 0.08 }],
  combo: [[659, 880, 1175], { gap: 0.07 }],
  bad: [[247, 196], { type: 'sine', gap: 0.12, dur: 0.22, vol: 0.32 }],
  done: [[523, 659, 784, 1047, 1319], { gap: 0.09, dur: 0.22 }],
  tap: [[523], { dur: 0.05, vol: 0.12, type: 'sine' }],
  stamp: [[110, 82], { type: 'sine', gap: 0.05, dur: 0.2, vol: 0.5 }],
  open: [[392, 523, 659, 784, 1047, 1319], { gap: 0.075, dur: 0.26, vol: 0.26 }],
}
const SFX_URL = {}
// 효과음 음량을 바꾸면 모든 효과음을 그 크기로 다시 만든다
function buildSfx() {
  for (const u of Object.values(SFX_URL)) URL.revokeObjectURL(u)
  try { for (const [name, [f, o]] of Object.entries(SFX_DEF)) SFX_URL[name] = renderTone(f, o, progress.sfxVol ?? 1) } catch { /* 소리 없이 */ }
}
buildSfx()

function playSfx(name) {
  if (!progress.sound || !SFX_URL[name]) return
  try {
    const a = new Audio(SFX_URL[name])
    a.setAttribute('playsinline', '')
    a.play().catch(() => {})
  } catch { /* 소리를 낼 수 없는 기기 */ }
}
const SFX = Object.fromEntries(Object.keys(SFX_DEF).map(n => [n, () => playSfx(n)]))

// 배경음악: 11곡. 파일 자체를 작게(-26 LUFS) 만들어 두었다.
// 곡을 받으면 처음에는 mp3를 그대로 틀고, 다 풀리면 음량을 곱한 WAV로 바꾼다.
// 푸는 일(OfflineAudioContext)은 소리를 내지 않으므로 무음 모드와 상관없다.
const TRACKS = [
  { file: 'audio/bgm.mp3', name: '벚꽃 교실' },
  { file: 'audio/bgm-01.mp3', name: '벚꽃 산책' },
  { file: 'audio/bgm-02.mp3', name: '여름 축제' },
  { file: 'audio/bgm-03.mp3', name: '비 오는 도서관' },
  { file: 'audio/bgm-04.mp3', name: '별밤 기차' },
  { file: 'audio/bgm-05.mp3', name: '아침 등굣길' },
  { file: 'audio/bgm-06.mp3', name: '교토 찻집' },
  { file: 'audio/bgm-07.mp3', name: '눈 오는 날' },
  { file: 'audio/bgm-08.mp3', name: '바다 마을' },
  { file: 'audio/bgm-09.mp3', name: '집중 모드' },
  { file: 'audio/bgm-10.mp3', name: '픽셀 모험' },
]
// 한 파일로 묶은 페이지(claude.ai 링크)에는 첫 곡만 들어 있다
const TRACK_LIST = window.APP_AUDIO ? [0] : TRACKS.map((_, i) => i)
let bgm = null, bgmURL = null, bgmRawURL = null, bgmPCM = null, bgmRate = 22050
let trackNow = -1, trackLoading = 0
// progress.track: 'all' = 모든 곡 차례로(섞어서), 숫자 = 그 곡만 반복
function trackMode() { const t = progress.track ?? 'all'; return t === 'all' || !TRACK_LIST.includes(Number(t)) ? 'all' : Number(t) }
let shuffleOrder = []
function nextTrackIndex() {
  const m = trackMode()
  if (m !== 'all') return m
  if (!shuffleOrder.length) shuffleOrder = shuffle(TRACK_LIST.filter(i => i !== trackNow))
  return shuffleOrder.shift() ?? TRACK_LIST[0]
}
// 곡 하나를 받아 준비한다 (play: 준비되면 이어서 틀지)
function loadTrack(i, play) {
  const job = ++trackLoading
  trackNow = i; bgmPCM = null
  const ready = blob => {
    if (job !== trackLoading) return
    if (bgmURL && bgmURL !== bgmRawURL) URL.revokeObjectURL(bgmURL)
    if (bgmRawURL) URL.revokeObjectURL(bgmRawURL)
    bgmRawURL = bgmURL = URL.createObjectURL(blob)
    if (bgm) { bgm.src = bgmURL; try { bgm.volume = progress.musicVol ?? 1 } catch { /* 아이폰 */ } if (play) bgm.play().catch(() => {}) }
    blob.arrayBuffer().then(b => decodeBgm(b, job)).catch(() => {})
    updateNowPlaying()
  }
  if (window.APP_AUDIO) {
    try {
      const bin = atob(window.APP_AUDIO.split(',')[1]), bytes = new Uint8Array(bin.length)
      for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k)
      ready(new Blob([bytes], { type: 'audio/mpeg' }))
    } catch { /* 음악 없이 */ }
    return
  }
  fetch(TRACKS[i].file).then(r => r.ok ? r.blob() : null).then(b => { if (b) ready(b) }).catch(() => {})
}
async function decodeBgm(arrayBuf, job) {
  try {
    const AC = window.OfflineAudioContext || window.webkitOfflineAudioContext
    if (!AC) return
    const ctx = new AC(1, 1, 22050)
    const audio = await new Promise((res, rej) => { const p = ctx.decodeAudioData(arrayBuf, res, rej); if (p && p.then) p.then(res, rej) })
    if (job !== trackLoading) return
    const n = audio.length, ch = audio.numberOfChannels, mono = new Float32Array(n)
    for (let c = 0; c < ch; c++) { const d = audio.getChannelData(c); for (let i = 0; i < n; i++) mono[i] += d[i] / ch }
    bgmPCM = mono; bgmRate = audio.sampleRate
    rebuildBgm()
  } catch { /* 풀 수 없으면 mp3 그대로 (음량은 기기에 따라) */ }
}
// 음량에 맞는 음악 파일로 바꾸고, 듣던 곳에서 이어서 튼다
function rebuildBgm() {
  const vol = progress.musicVol ?? 1
  if (bgmPCM) {
    if (bgmURL && bgmURL !== bgmRawURL) URL.revokeObjectURL(bgmURL)
    bgmURL = wavURL(bgmPCM, bgmRate, vol)
  }
  if (!bgm) return
  try { bgm.volume = bgmPCM ? 1 : vol } catch { /* 아이폰은 읽기 전용 */ }
  if (bgm.src === bgmURL) return
  const t = bgm.currentTime || 0, playing = !bgm.paused
  bgm.src = bgmURL
  bgm.addEventListener('loadedmetadata', () => { try { bgm.currentTime = t % (bgm.duration || 1e9) } catch { /* 처음부터 */ } }, { once: true })
  if (playing) bgm.play().catch(() => {})
}
// 곡이 끝나면: 한 곡 반복이면 처음부터, 아니면 다음 곡
function onTrackEnd() {
  if (trackMode() !== 'all') { bgm.currentTime = 0; bgm.play().catch(() => {}); return }
  loadTrack(nextTrackIndex(), true)
}
// 같은 오디오 플레이어를 계속 쓴다 (아이폰은 한 번 화면을 눌러 튼 플레이어만 나중에 저절로 틀 수 있다)
function playBgm() {
  if (!progress.music) return
  try {
    if (!bgm) {
      bgm = new Audio(); bgm.setAttribute('playsinline', '')
      bgm.addEventListener('ended', onTrackEnd)
      if (bgmURL) bgm.src = bgmURL
    }
    if (!bgmURL) { loadTrack(trackNow >= 0 ? trackNow : nextTrackIndex(), true); return }
    bgm.play().catch(() => {})
  } catch { /* 소리를 낼 수 없는 기기 */ }
}
// 곡 고르기 / 다음 곡
function chooseTrack(mode) {
  progress.track = mode; saveProgress()
  shuffleOrder = []
  const i = mode === 'all' ? nextTrackIndex() : Number(mode)
  if (i === trackNow && bgm && !bgm.paused) return
  loadTrack(i, progress.music && !!bgm)
  if (progress.music && !bgm) playBgm()
}
function skipTrack() {
  if (trackMode() !== 'all') { progress.track = 'all'; saveProgress() }
  loadTrack(nextTrackIndex(), progress.music)
  if (progress.music && !bgm) playBgm()
}
function updateNowPlaying() {
  const el = document.getElementById('nowplaying')
  if (el) el.textContent = trackNow >= 0 ? TRACKS[trackNow].name : ''
  const sel = document.getElementById('tracksel')
  if (sel) sel.value = String(trackMode())
}
// 첫 곡은 미리 받아 둔다 (화면을 누르면 바로 나오게)
loadTrack(window.APP_AUDIO ? 0 : nextTrackIndex(), false)
function stopBgm() { if (bgm) bgm.pause() }

// 아이폰은 사용자가 화면을 누를 때만 소리를 시작할 수 있어서, 누를 때마다 배경음악이 꺼져 있으면 다시 켠다
function startAudio() {
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback' } catch { /* 지원 안 함 */ }
  if (progress.music && (!bgm || bgm.paused) && !document.hidden) playBgm()
}
for (const ev of ['touchend', 'click', 'keydown']) document.addEventListener(ev, startAudio, true)
// 다른 앱으로 가면 배경음악을 멈추고, 돌아오면 다시 튼다
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopBgm()
  else if (progress.music && bgm) bgm.play().catch(() => {})
})

// 벚꽃잎·별 터뜨리기
const PETAL_COLORS = ['#ff8fb1', '#ffb3c8', '#ffc23c', '#35a7ff', '#4cc27a', '#ff6b95']
function confetti(x, y, n = 28) {
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const box = document.createElement('div')
  box.className = 'confetti'
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, d = 80 + Math.random() * 180
    const p = document.createElement('i')
    p.style.cssText = `--x:${x}px;--y:${y}px;--s:${6 + Math.random() * 8}px;--c:${PETAL_COLORS[i % PETAL_COLORS.length]};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 60}px;--rot:${Math.random() * 540 - 270}deg;animation-delay:${Math.random() * 80}ms`
    box.appendChild(p)
  }
  document.body.appendChild(box)
  setTimeout(() => box.remove(), 1400)
}
function centerOf(el) {
  const r = el.getBoundingClientRect()
  return [r.left + r.width / 2, r.top + r.height / 2]
}
const GOAL = { cards: 10, quizzes: 1 }

// 연속으로 공부한 날 (오늘 아직 안 했으면 어제까지 센다)
function streak() {
  const days = new Set(progress.studyDays)
  let n = 0, i = days.has(todayStr()) ? 0 : -1
  while (days.has(todayStr(i))) { n++; i-- }
  return n
}

// 오늘의 한자: 날마다 하나씩, 1학년 교과서 순서부터 차례로
const KANJI_ORDER = [...GRADE1_ORDER, ...Object.keys(KANJI).filter(c => KANJI[c].grade > 1).sort((a, b) => KANJI[a].grade - KANJI[b].grade)]
function dailyKanji() {
  const d = Math.round((Date.parse(todayStr()) - Date.parse('2026-11-12')) / 86400000)
  const list = KANJI_ORDER.filter(c => isOpen('kanji', KANJI[c].grade))
  const n = list.length
  return list[((d % n) + n) % n]
}

// 그림: 앱에서는 images/ 파일, 한 파일로 묶은 페이지에서는 미리 넣어 둔 데이터
const IMAGES = window.APP_IMAGES || {
  home: 'images/home.webp', kanji: 'images/kanji.webp', quiz: 'images/quiz.webp',
  mascot: 'images/mascot.webp', think: 'images/mascot-think.webp', cheer: 'images/mascot-cheer.webp',
  sad: 'images/mascot-sad.webp', party: 'images/mascot-party.webp',
}
// 고양이 친구들 (묶은 페이지에서는 APP_IMAGES에 이미 들어 있다)
for (const id of ['kuro', 'shiro', 'mikan', 'moka', 'hachi', 'gin', 'tora', 'maru', 'sabi', 'mofu']) {
  IMAGES['cat-' + id] = IMAGES['cat-' + id] || `images/cat-${id}.webp`
  for (const m of ['think', 'cheer', 'sad', 'party']) IMAGES[`cat-${id}-${m}`] = IMAGES[`cat-${id}-${m}`] || `images/cat-${id}-${m}.webp`
}
// 중학교·고등학교 교복 (미케 포함 11마리)
for (const id of ['mike', 'kuro', 'shiro', 'mikan', 'moka', 'hachi', 'gin', 'tora', 'maru', 'sabi', 'mofu'])
  for (const o of ['mid', 'high']) IMAGES[`cat-${id}-${o}`] = IMAGES[`cat-${id}-${o}`] || `images/cat-${id}-${o}.webp`
// 미케 그림 (포즈가 없으면 기본 모습)
function mascot(mood = 'mascot', cls = 'mascot') {
  // 단짝이 미케가 아니면 그 고양이가 나온다 (표정: think 생각, cheer 정답, sad 응원, party 축하)
  const b = typeof buddy === 'function' ? buddy() : { id: 'mike', name: '미케' }
  const o = typeof outfit === 'function' ? outfit() : 'elem'
  const src = o !== 'elem' && IMAGES[`cat-${b.id}-${o}`] ? IMAGES[`cat-${b.id}-${o}`]
    : b.id === 'mike' ? (IMAGES[mood] || IMAGES.mascot) : (IMAGES[`cat-${b.id}-${mood}`] || catImage(b))
  return src ? `<img class="${cls}" src="${src}" alt="${b.name}" width="320" height="320">` : ''
}
const CHEERS = ['정답이에요', '잘했어요', '완벽해요', '좋아요, 그대로 가요', '역시 내 친구']
const ENCOURAGE = ['괜찮아요, 다음엔 맞힐 거예요', '아깝다, 한 번 더 봐요', '틀려도 괜찮아요', '이제 기억했죠']
const pickOne = list => list[Math.floor(Math.random() * list.length)]

// ───── 공통 ─────
const app = document.getElementById('app')
const state = { view: 'home', cardType: 'verb', cardIdx: { verb: 0, adj: 0, noun: 0, high: 0, ono: 0, num: 0 }, verb: 0, kanji: null, quiz: null, grade: 1, conjMode: 'one', conjGroup: 0, quizMode: 'verb', quizGrade: 0, grammarLevel: 'N5', grammarOpen: null, quizLevel: 'N5', quizTab: 'quest', stage: null, verbQuizLevel: 'all', talkScene: null, talkQuiz: 'all', showCasual: false, onoQuiz: 'all', numQuiz: 'all', mockLevel: 'N5' }

// ───── 퀘스트 진행 ─────
function stageStars(id) { return progress.stages[id] || 0 }
function stageUnlocked(i) { return i === 0 || stageStars(STAGES[i - 1].id) > 0 }
// 지금 도전할 스테이지: 열려 있고 아직 못 깬 첫 스테이지 (다 깼으면 마지막)
function currentStageIndex() {
  const i = STAGES.findIndex((s, k) => stageUnlocked(k) && !stageStars(s.id))
  return i < 0 ? STAGES.length - 1 : i
}
function schoolOf(id) { return SCHOOLS.find(s => s.id === id) }

function newQuiz() {
  // 잠긴 학년·수준·급수를 골라 두었으면 '전체'로
  if (state.quizGrade && !isOpen('kanji', state.quizGrade)) state.quizGrade = 0
  if (state.verbQuizLevel !== 'all' && !isOpen('verb', state.verbQuizLevel)) state.verbQuizLevel = 'all'
  if (LEVELS.includes(state.quizLevel) && !isOpen('grammar', state.quizLevel)) state.quizLevel = 'all'
  const wrong = { kanji: progress.wrongKanji, verb: progress.wrong, grammar: progress.wrongGrammar }
  const list = state.quizMode === 'stage' ? buildStageQuiz(STAGES.find(s => s.id === state.stage), wrong)
    : state.quizMode === 'kanji' ? buildKanjiQuiz(state.quizGrade, progress.wrongKanji)
    : state.quizMode === 'review' ? dueKeys().slice(0, 10).map(questionFromKey).filter(Boolean)
    : state.quizMode === 'fix' ? buildFixQuiz()
    : state.quizMode === 'place' ? buildPlacement()
    : state.quizMode === 'mock' ? buildMock(state.mockLevel)
    : state.quizMode === 'num' ? buildNumQuiz(state.numQuiz || 'all', progress.wrongKanji)
    : state.quizMode === 'ono' ? buildOnoQuiz(state.onoQuiz || 'all', progress.wrongOno)
    : state.quizMode === 'talk' ? buildTalkQuiz(state.talkQuiz || 'all', progress.wrongTalk)
    : state.quizMode === 'grammar' ? buildGrammarQuiz(state.quizLevel, progress.savedGrammar, progress.wrongGrammar)
    : buildVerbQuiz(progress.wrong, state.verbQuizLevel)
  state.quiz = { list, i: 0, picked: null, right: 0, missed: [], combo: 0, best: 0, xp: 0, built: [] }
}

// lucide 아이콘 (16px, 선 1.5)
const ICONS = {
  left: 'm15 18-6-6 6-6', right: 'm9 18 6-6-6-6',
  lock: 'M5 11h14v10H5z M8 11V7a4 4 0 0 1 8 0v4',
  sound: 'M11 5 6 9H2v6h4l5 4V5Z M15.5 8.5a5 5 0 0 1 0 7 M19 5a10 10 0 0 1 0 14',
  mute: 'M11 5 6 9H2v6h4l5 4V5Z M22 9l-6 6 M16 9l6 6',
  music: 'M9 18V5l12-2v13 M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M18 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  musicOff: 'M9 18V5l12-2v13 M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M18 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M3 3l18 18',
}
function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`
}

// ruby 짝 → 한 줄 HTML (표, 보기, 예문용)
function rubyHTML(pairs) {
  return pairs.map(([text, reading]) => reading ? `<ruby>${text}<rt>${reading}</rt></ruby>` : text).join('')
}

// ruby 짝 → 연습장 칸 (글자 하나에 칸 하나, 후리가나는 칸 위)
function masuRow(pairs, { clickable = false, size = '' } = {}) {
  const groups = pairs.map(([text, reading]) => {
    const cells = [...text].map(ch => `<span class="masu${reading ? '' : ' kana'}">${ch}</span>`).join('')
    // 설명이 있는 한자(초등 1026자)가 들어 있을 때만 누를 수 있다
    const tap = clickable && reading && [...text].some(ch => KANJI[ch])
    const on = tap && state.kanji === text ? ' on' : ''
    const attrs = tap ? ` data-kanji="${text}" role="button" tabindex="0" aria-label="${text} 자세히"` : ''
    return `<span class="masu-group${tap ? ' kj' : ''}${on}"${attrs}><span class="furi">${reading || ''}</span><span class="cells">${cells}</span></span>`
  }).join('')
  return `<div class="masu-row ${size}" lang="ja">${groups}</div>`
}

// 빨간 펜 동그라미 (정답 표시)
function maruSVG() {
  return `<svg class="maru" viewBox="0 0 120 60" preserveAspectRatio="none" aria-hidden="true">
    <path d="M14 34 C10 14 46 5 72 7 C100 9 116 21 111 36 C106 52 66 57 40 52 C22 49 9 40 17 26" pathLength="1"/></svg>`
}

// 하나마루(花丸): 다 맞혔을 때 선생님이 그려 주는 꽃 동그라미
function hanamaruSVG() {
  const c = 50, R = 24, petals = 9, sx = 1.06
  let spiral = ''
  const steps = 140, turns = 2.3
  for (let s = 0; s <= steps; s++) {
    const t = s / steps
    const a = -Math.PI / 2 + t * turns * 2 * Math.PI
    const r = R * (0.1 + 0.9 * t)
    spiral += `${s ? 'L' : 'M'}${(c + r * Math.cos(a) * sx).toFixed(1)} ${(c + r * Math.sin(a)).toFixed(1)}`
  }
  const Ro = R + 4, bump = 14
  let ring = ''
  for (let i = 0; i <= petals; i++) {
    const a = -Math.PI / 2 + i * 2 * Math.PI / petals
    const x = (c + Ro * Math.cos(a) * sx).toFixed(1), y = (c + Ro * Math.sin(a)).toFixed(1)
    if (i === 0) { ring += `M${x} ${y}`; continue }
    const m = a - Math.PI / petals
    ring += `Q${(c + (Ro + bump) * Math.cos(m) * sx).toFixed(1)} ${(c + (Ro + bump) * Math.sin(m)).toFixed(1)} ${x} ${y}`
  }
  return `<svg class="hanamaru" viewBox="0 0 100 100" role="img" aria-label="하나마루">
    <path class="spiral" d="${spiral}" pathLength="1"/><path class="ring" d="${ring}" pathLength="1"/></svg>`
}

// 퀴즈를 풀고 있는 중인지 (나갈 때 물어본다)
function quizBusy() {
  const qz = state.quiz
  return state.view === 'quiz' && qz && qz.list.length && qz.i > 0 && qz.i < qz.list.length && (SPECIAL.includes(state.quizMode) || state.quizTab === 'free')
}
const SPECIAL = ['stage', 'review', 'mock', 'fix', 'place']
function go(view, fromHistory) {
  if (view !== state.view && quizBusy() && !confirm('퀴즈를 그만둘까요?\n지금까지 푼 문제는 기록돼요')) { if (fromHistory) history.pushState({ v: state.view }, ''); return }
  if (!fromHistory && view !== state.view) history.pushState({ v: view }, '')
  state.view = view
  state.kanji = null
  if (view === 'quiz') {
    // 메뉴로 퀴즈에 오면 퀘스트 지도부터 (스테이지 중이었으면 그만둠)
    if (SPECIAL.includes(state.quizMode)) { state.quizMode = 'verb'; state.quizTab = 'quest' }
    newQuiz()
  }
  if (view === 'talk' && !fromHistory) state.talkScene = null
  render()
  window.scrollTo(0, 0)
}
// 휴대폰 뒤로 가기: 열린 창부터 닫고, 그다음 이전 화면으로
try { history.replaceState({ v: 'home' }, '') } catch { /* 무시 */ }
window.addEventListener('popstate', e => {
  const overlay = document.querySelector('.rcover, #soundpanel')
  if (overlay) { overlay.remove(); history.pushState({ v: state.view }, ''); return }
  const s = e.state || { v: 'home' }
  if (state.view === 'talk' && state.talkScene && s.v === 'talk' && !s.scene) { state.talkScene = null; render(); return }
  if (s.v === 'quiz' && state.view === 'quiz' && SPECIAL.includes(state.quizMode)) {
    if (quizBusy() && !confirm('퀴즈를 그만둘까요?\n지금까지 푼 문제는 기록돼요')) { history.pushState({ v: 'quiz' }, ''); return }
    state.quizMode = 'verb'; state.quizTab = 'quest'; render(); return
  }
  go(s.v, true)
  if (s.v === 'talk' && s.scene) { state.talkScene = s.scene; render() }
})

function render() {
  const navV = ['conj', 'kanji'].includes(state.view) ? 'cards' : state.view
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('on', b.dataset.go === navV))
  document.body.classList.toggle('quizzing', state.view === 'quiz' && !!state.quiz && state.quiz.i < state.quiz.list.length && (SPECIAL.includes(state.quizMode) || state.quizTab === 'free') && !(state.quizMode === 'mock' && state.mockIntro))
  app.dataset.view = state.view
  app.innerHTML = VIEWS[state.view]()
  // 한 번만 보여 줄 움직임은 그린 뒤 끈다
  if (state.view === 'home' && state.stampedNow) { state.stampedNow = false; setTimeout(SFX.stamp, 400) }
  state.slide = null
  // 화면을 옮겼을 때만 살짝 떠오르며 나타난다
  if (state.lastView !== state.view) {
    app.classList.remove('view-in'); void app.offsetWidth; app.classList.add('view-in')
    state.lastView = state.view
  }
  updateTop()
}

// 위쪽 줄: 오늘 XP, 효과음 켜기/끄기
function updateTop() {
  const xp = document.getElementById('xp')
  if (xp) xp.innerHTML = `오늘 <b class="num">${todayStats().xp}</b> XP`
  const s = document.getElementById('soundbtn')
  if (s) {
    s.innerHTML = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[progress.sound ? 'sound' : 'mute']}"/></svg>`
    s.setAttribute('aria-label', '소리 설정 (효과음)')
    s.classList.toggle('off', !progress.sound)
  }
  const m = document.getElementById('musicbtn')
  if (m) {
    m.innerHTML = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[progress.music ? 'music' : 'musicOff']}"/></svg>`
    m.setAttribute('aria-label', '소리 설정 (배경음악)')
    m.classList.toggle('off', !progress.music)
  }
}

function bar(label, done, total) {
  return `<div class="row prog"><div class="label">${label}<span class="num">${done} / ${total}</span></div>
    <div class="bar"><i style="width:${done / total * 100}%"></i></div></div>`
}

// ───── 홈 (진도) ─────
function homeView() {
  const date = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
  const weekday = new Date().toLocaleDateString('ko-KR', { weekday: 'long' })
  const t = todayStats(), s = streak()
  const nextSt = STAGES[currentStageIndex()]
  const allClear = STAGES.every(x => stageCleared(x.id))
  const lead = allClear ? `졸업 뒤 목표 · 마스터 별 ★ ${masterCount('g:')} / ${GRAMMAR.length}`
    : `다음 퀘스트 · ${schoolOf(nextSt.school).name} ${nextSt.name}` + (s >= 2 ? ` · ${s}일 연속` : '')

  // 다음 목표: 지금 스테이지를 통과하면 무엇이 열리는지
  const after = STAGES[currentStageIndex() + 1]
  const prizeCat = CATS.find(c => c.at === nextSt.id)
  const prizes = after && !allClear ? [{ kind: 'stage', label: `퀘스트 ${schoolOf(after.school).name} ${after.name}` }, ...(prizeCat ? [{ kind: 'cat', label: `새 친구 고양이` }] : []), ...unlocksAt(after.id)] : []
  const nextGoal = allClear ? '' : `
  <div class="panel nextgoal">
    <div class="eyebrow">다음 목표 <span class="num">· Lv.${playerLevel() + 1}까지 · 퀘스트 ${clearedCount()} / ${STAGES.length}</span></div>
    <div class="ngmain"><span class="smark">${schoolIcon(nextSt.school)}</span>
      <div><b>${schoolOf(nextSt.school).name} ${nextSt.name} 통과하기</b><small>${stageSize(nextSt)}문제 중 ${passNeed(nextSt)}개 이상 맞히면 통과</small></div>
      <button class="btn pri" data-act="questContinue">도전</button></div>
    ${prizes.length ? `<div class="ngprize"><span>통과하면 열려요</span>${prizes.map(u => `<span class="ktag ${u.kind}">${u.label}</span>`).join('')}</div>` : ''}
  </div>`

  const check = '<svg class="check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" pathLength="1"/></svg>'
  const goal = (label, n, max, c) => `<div class="goal${n >= max ? ' done' : ''}" style="--c:${c}">
    <span>${label}${n >= max ? check : ''}</span><span class="num">${Math.min(n, max)} / ${max}</span>
    <div class="bar"><i style="width:${Math.min(n, max) / max * 100}%"></i></div></div>`
  const hello = t.xp > 0 ? `오늘 ${t.xp} XP 모았어요` : s >= 2 ? `${s}일 연속이에요` : '같이 공부해요'
  const main = allClear ? '<button class="btn pri" data-act="startFix">오늘의 교정 10문제</button>' : '<button class="btn pri" data-act="questContinue">퀘스트 계속</button>'
  const second = !progress.placed && clearedCount() < 3 ? '<button class="btn" data-act="startPlace">실력 진단</button>'
    : allClear ? '<button class="btn" data-go="quiz">퀘스트 지도</button>' : '<button class="btn" data-act="startFix">교정 10문제</button>'

  return `
  <section class="hero">
    <img class="hero-img" src="${IMAGES.home}" alt="화창한 아침 교실, 창밖의 벚꽃과 책상 위의 한자 연습장" width="1600" height="905" fetchpriority="high">
    <button class="hero-mascot${state.catHop ? ' hop' : ''}" data-act="petCat" aria-label="${buddy().name} 쓰다듬기">${mascot(state.catHop ? 'cheer' : 'mascot', '')}<span class="says">${state.catSay || hello}</span></button>
    <div class="hero-text">
      <span class="hero-date">${date} ${weekday}</span>
      <span class="lvchip"><b class="num">Lv.${playerLevel()}</b>${rankName()}</span>
      <h1>오늘의 공부</h1>
      <p>${lead}</p>
      ${!progress.placed && clearedCount() < 3 ? '<p class="placehint">이미 일본어를 조금 안다면, 실력 진단으로 시작 학년을 건너뛰세요</p>' : ''}
      <div class="hero-actions">${main}${second}</div>
    </div>
  </section>
  ${correctionCardHTML()}
  ${missionsHTML(t, goal)}
  ${nextGoal}
  <div class="homegrid">${reviewCardHTML()}${mockCardHTML()}</div>
  <div class="panel">
    <div class="hd">나의 기록</div>
    ${bar('마스터한 문법 ★', masterCount('g:'), GRAMMAR.length)}
    ${bar('마스터한 한자 ★', masterCount('k:'), Object.keys(KANJI).length)}
    ${bar('회화 장면 도장', Object.keys(progress.talkStamps).length, typeof TALK === 'undefined' ? 20 : TALK.length)}
    ${bar('고양이 친구', CATS.filter(catOpen).length, CATS.length)}
    <button class="linkbtn" data-go="me">전체 기록 보기</button>
  </div>
  ${offlineReady ? '<p class="sub offline">인터넷 없이도 열 수 있어요</p>' : ''}`
}

// ───── 내 정보 · 설정 ─────
function meView() {
  const s = streak()
  const allK = progress.seenKanji.filter(c => KANJI[c]).length
  const kanjiQ = Object.values(KANJI).reduce((n, k) => n + 1 + k.examples.length, 0) + highKanjiKeys(Object.keys(HK_SETS)).length
  const wrong = progress.wrong.length + progress.wrongKanji.length + progress.wrongGrammar.length
  const days = new Set(progress.studyDays)
  const cells = Array.from({ length: 14 }, (_, n) => {
    const day = todayStr(n - 13), d = new Date(day)
    return `<span class="stampcell${n === 13 ? ' today' : ''}" title="${day}"><span class="stampday num">${d.getDate()}</span>${days.has(day) ? `<span class="stamp" lang="ja" style="--r:${((d.getDate() * 37) % 21) - 10}deg">済</span>` : ''}</span>`
  }).join('')
  const b = buddy()
  return `
  <div class="mehead">
    <img src="${catImage(b)}" alt="${b.name}" width="400" height="400">
    <div><span class="lvchip"><b class="num">Lv.${playerLevel()}</b>${rankName()}</span><h1>내 정보</h1>
      <p>별 <b class="num">${totalStars()}</b> · 총 <b class="num">${progress.xp || 0}</b> XP · 연속 <b class="num">${s}</b>일 · 단짝 ${b.name}</p></div>
  </div>
  <div class="panel stampcard"><div class="eyebrow">공부 도장 <span class="num">· 최근 14일</span></div><div class="stampgrid">${cells}</div>
    <div class="hint">카드를 보거나 문제를 풀면 그날 도장이 찍혀요</div></div>
  <div class="panel">
    <div class="hd">전체 기록</div>
    ${bar('마스터한 문법 ★', masterCount('g:'), GRAMMAR.length)}
    ${bar('마스터한 한자 ★', masterCount('k:'), Object.keys(KANJI).length)}
    ${bar('본 한자', allK, Object.keys(KANJI).length)}
    ${bar('본 JLPT 문법', progress.seenGrammar.filter(id => GRAMMAR.some(g => g.id === id)).length, GRAMMAR.length)}
    ${bar('동사 카드', seenCount('verb'), WORDS.length)}
    ${bar('형용사 카드', seenCount('adj'), ADJECTIVES.length)}
    ${bar('명사 카드', seenCount('noun'), NOUNS.length)}
    ${bar('의성어 도감', seenCount('ono'), ONO_CARDS.length || 150)}
    ${bar('회화 장면 도장', Object.keys(progress.talkStamps).length, typeof TALK === 'undefined' ? 20 : TALK.length)}
    ${bar('맞힌 한자 문제', progress.learnedKanji.length, kanjiQ)}
    ${bar('맞힌 문법 문제', progress.learnedGrammar.length, GRAMMAR.reduce((n, g) => n + grammarKeys(g).length, 0))}
    ${bar('고양이 친구', CATS.filter(catOpen).length, CATS.length)}
    ${bar('배지', progress.badges.length, BADGES.length)}
    <div class="row"><div class="label">다시 볼 문제<span class="num${wrong ? ' key' : ''}">${wrong}개</span></div></div>
  </div>
  <div class="panel melist">
    <div class="hd">설정</div>
    <button class="merow" data-act="meSound"><b>소리</b><span>배경음악 · 효과음 음량, 곡 고르기</span></button>
    <button class="merow" data-go="quiz"><b>고양이 친구 · 배지</b><span>퀘스트 지도 아래에서 볼 수 있어요</span></button>
  </div>
  <div class="panel melist">
    <div class="hd">기록 보관</div>
    <p class="menote">공부 기록은 이 휴대폰 안에만 저장돼요. 휴대폰을 바꾸거나 앱을 지우기 전에 내보내 두세요.</p>
    <button class="merow" data-act="meExport"><b>기록 내보내기</b><span>파일로 저장하거나 보내기</span></button>
    <button class="merow" data-act="meImport"><b>기록 가져오기</b><span>내보낸 파일로 되살리기</span></button>
    <input type="file" id="importfile" accept=".json,application/json" hidden>
    <button class="merow danger" data-act="meReset"><b>기록 초기화</b><span>처음부터 다시 시작</span></button>
  </div>
  <div class="panel melist">
    <div class="hd">앱 정보</div>
    <p class="menote"><b>개인정보</b> · 이 앱은 회원 가입이 없고, 공부 기록을 서버로 보내지 않아요. 모든 기록은 이 기기 안에만 있어요.</p>
    <p class="menote"><b>자료 출처</b> · 한자 읽기와 학년 자료는 KANJIDIC2(EDRDG, CC BY-SA 4.0)를 바탕으로 했어요. 예문과 설명, 그림은 이 앱을 위해 새로 만들었어요.</p>
    <p class="menote"><b>버전</b> · 1.0.0</p>
  </div>`
}
// 기록 내보내기·가져오기
async function exportProgress() {
  const text = JSON.stringify({ app: 'nihongo-study', v: 1, at: new Date().toISOString(), progress }, null, 0)
  const name = `nihongo-record-${todayStr()}.json`
  try {
    const file = new File([text], name, { type: 'application/json' })
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: '일본어 공부 기록' }); return }
  } catch { /* 공유 취소 → 내려받기 */ }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; a.click()
}
document.addEventListener('change', async e => {
  if (e.target.id !== 'importfile' || !e.target.files[0]) return
  try {
    const data = JSON.parse(await e.target.files[0].text())
    if (!data || data.app !== 'nihongo-study' || !data.progress) throw new Error('bad')
    if (!confirm('이 파일의 기록으로 바꿀까요?\n지금 기록은 덮어써져요')) return
    localStorage.setItem(STORE_KEY, JSON.stringify(data.progress)); location.reload()
  } catch { alert('이 앱에서 내보낸 기록 파일이 아니에요') }
})

// 단어 카드 ↔ 한자 표
function wordSeg(cur) {
  return `<div class="seg"><button class="${cur === 'cards' ? 'on' : ''}" data-go="cards">단어 카드</button><button class="${cur === 'kanji' ? 'on' : ''}" data-go="kanji">한자 표</button></div>`
}

// ───── 학년별 한자 ─────
function kanjiList(grade) {
  if (grade === 1) return [...GRADE1_ORDER]
  return Object.keys(KANJI).filter(c => KANJI[c].grade === grade)
}

function kanjiGrades() {
  const g = [...new Set(Object.values(KANJI).map(k => k.grade))].sort((a, b) => a - b)
  return [...g, ...[10, 11, 12].filter(x => highList(x).length)]
}
// 학년 탭: 잠긴 학년에는 자물쇠
function gradeTabs() {
  return kanjiGrades().map(g => { const open = isOpen('kanji', g)
    return `<button class="${g === state.grade ? 'on' : ''}${open ? '' : ' locked'}" data-act="grade" data-grade="${g}">${open ? '' : LOCK}${gradeName(g)}</button>` }).join('')
}

// 고등 한자: 단어 목록 (누르면 위에 읽기·뜻과 쓰인 한자 카드)
function highView() {
  if (!isOpen('kanji', state.grade)) return kanjiBanner('고등 한자') + `<div class="tabs">${gradeTabs()}</div>` + lockedPanel(kanjiPackLabel(state.grade), unlockHint('kanji', state.grade))
  const list = highList(state.grade)
  const seen = list.filter(e => progress.seenHigh.includes(e[0])).length
  const rows = list.map(([w, r, m]) => {
    const cls = ['hkrow', progress.seenHigh.includes(w) ? 'seen' : '', state.kanji === w ? 'on' : ''].join(' ')
    return `<button class="${cls}" data-kanji="${w}"><span class="hkw" lang="ja"><ruby>${w}<rt>${r}</rt></ruby></span><span class="hkm">${m}</span></button>`
  }).join('')
  const open = list.find(e => e[0] === state.kanji)
  const detail = open ? `<div class="panel" id="kdetail">
      <div class="hkhead"><span class="hkbig" lang="ja"><ruby>${open[0]}<rt>${open[1]}</rt></ruby></span><span class="hkm">${open[2]}</span></div>
      ${kanjiInfo(open[0])}</div>` : ''
  const tabs = gradeTabs()
  const NOTE = { 10: '단어 전체에 붙는 특수한 읽기예요. 한자 하나하나의 음으로는 읽을 수 없어요', 11: '네 글자로 된 관용 표현이에요', 12: '일본 사람도 자주 틀리는 읽기예요' }
  return `${wordSeg('kanji')}
  <section class="banner">
    <img src="${IMAGES.kanji}" alt="벚꽃 핀 학교 가는 길, 돌담 위의 빨간 란도셀" width="1680" height="720">
    <div class="banner-text"><h1>고등 한자</h1><p><span class="num">${progress.seenHigh.length} / ${[10, 11, 12].reduce((n, g) => n + highList(g).length, 0)}</span>개를 봤어요</p></div>
  </section>
  <div class="tabs">${tabs}</div>
  <div class="subbar"><p class="sub">${gradeLong(state.grade)} ${list.length}개 · 본 단어 <span class="num">${seen} / ${list.length}</span></p><button class="btn" data-act="kanjiQuiz">${gradeName(state.grade)} 한자 퀴즈</button></div>
  ${detail}
  <div class="panel"><p class="hknote">${NOTE[state.grade]}</p><div class="hklist">${rows}</div>
    <div class="hint">단어를 누르면 읽는 법과 쓰인 한자가 나와요 · 본 단어에는 빨간 점</div></div>`
}

function kanjiBanner(title) {
  const seg = wordSeg('kanji')
  const openK = kanjiGrades().filter(g => g <= 9 && isOpen('kanji', g)).reduce((n, g) => n + kanjiList(g).length, 0)
  return `${seg}<section class="banner">
    <img src="${IMAGES.kanji}" alt="벚꽃 핀 학교 가는 길, 돌담 위의 빨간 란도셀" width="1680" height="720">
    <div class="banner-text"><h1>${title}</h1><p>열린 한자 <span class="num">${openK} / ${Object.keys(KANJI).length}</span>자</p></div>
  </section>`
}

function kanjiView() {
  if (state.grade >= 10) return highView()
  if (!isOpen('kanji', state.grade)) return kanjiBanner(state.grade >= 7 ? '중학 상용 한자' : '초등 필수 한자') + `<div class="tabs">${gradeTabs()}</div>` + lockedPanel(kanjiPackLabel(state.grade), unlockHint('kanji', state.grade))
  const grades = kanjiGrades()
  const list = kanjiList(state.grade)
  const seen = list.filter(c => progress.seenKanji.includes(c)).length
  const tabs = gradeTabs()
  const sub = `${state.grade <= 6 ? `초등 ${state.grade}학년` : `중학 ${state.grade - 6}묶음 (자주 쓰는 순)`} 한자 ${list.length}자 · 본 한자 <span class="num">${seen} / ${list.length}</span>`
  const cells = list.map(c => {
    const cls = ['masu', 'kcell', progress.seenKanji.includes(c) ? 'seen' : '', state.kanji === c ? 'on' : ''].join(' ')
    return `<button class="${cls}" data-kanji="${c}" lang="ja" title="${KANJI[c].meaning}">${c}</button>`
  }).join('')
  const seenAll = progress.seenKanji.filter(c => KANJI[c]).length
  return `${wordSeg('kanji')}
  <section class="banner">
    <img src="${IMAGES.kanji}" alt="벚꽃 핀 학교 가는 길, 돌담 위의 빨간 란도셀" width="1680" height="720">
    <div class="banner-text"><h1>${state.grade >= 7 ? "중학 상용 한자" : "초등 필수 한자"}</h1><p><span class="num">${seenAll} / ${Object.keys(KANJI).length}</span>자를 봤어요</p></div>
  </section>
  <div class="tabs">${tabs}</div>
  <div class="subbar"><p class="sub">${sub}</p><button class="btn" data-act="kanjiQuiz">${gradeName(state.grade)} 한자 퀴즈</button></div>
  ${state.kanji && KANJI[state.kanji] ? `<div class="panel" id="kdetail">${kanjiInfo(state.kanji)}</div>` : ''}
  <div class="panel"><div class="kgrid">${cells}</div>
    <div class="hint">한자를 누르면 뜻과 읽는 법이 나와요 · 본 한자에는 빨간 점</div></div>`
}

// 한자 자세히: 큰 칸 + 훈독·음독·예
function kanjiInfo(text) {
  return [...text].filter(ch => KANJI[ch]).map(ch => {
    const k = KANJI[ch]
    const ex = k.examples.map(([w, r, m]) => `<span class="ex"><span lang="ja"><ruby>${w}<rt>${r}</rt></ruby></span> ${m}</span>`).join('')
    return `<div class="kinfo">
      <span class="masu xl" lang="ja">${ch}</span>
      <div>
        <div class="kname">${k.meaning}<span class="grade">${gradeLong(k.grade)}</span></div>
        <dl class="kv">
          <dt>훈독</dt><dd><span lang="ja">${k.kun.join('、') || '없음'}</span><small>일본 고유의 읽기 · 혼자 쓰일 때</small></dd>
          <dt>음독</dt><dd><span lang="ja">${k.on.join('、')}</span><small>중국에서 온 읽기 · 한자 두 개 단어일 때</small></dd>
          <dt>예</dt><dd>${ex}</dd>
        </dl>
      </div></div>`
  }).join('')
}

// ───── 단어 카드 (동사 · 형용사 · 명사) ─────
const NOUN_CATS = ['학교', '집', '음식', '몸', '자연·날씨', '시간', '사람·가족', '장소·마을', '동물·식물', '물건·놀이', '교통', '일·기타']
// 명사는 주제 순서로 모아 둔다
const NOUN_LIST = NOUNS.slice().sort((a, b) => NOUN_CATS.indexOf(a.cat) - NOUN_CATS.indexOf(b.cat))
// 고등 한자 단어 카드: 앞뒤의 같은 가나는 후리가나에서 빼고 칸만 그린다 (お巡りさん → お / 巡:まわ / りさん)
function splitRuby(w, r) {
  let a = 0, b = 0
  while (a < w.length - 1 && w[a] === r[a] && !/\p{Script=Han}/u.test(w[a])) a++
  while (b < w.length - a - 1 && w[w.length - 1 - b] === r[r.length - 1 - b] && !/\p{Script=Han}/u.test(w[w.length - 1 - b])) b++
  return [[w.slice(0, a), ''], [w.slice(a, w.length - b), r.slice(a, r.length - b)], [w.slice(w.length - b), '']].filter(p => p[0])
}
const HIGH_CARDS = typeof HIGH_KANJI === 'undefined' ? [] : Object.keys(HK_SETS).flatMap(s => (HIGH_KANJI[s] || []).map(([w, r, m], i) => (
  { id: `${s}:${i}`, set: s, kanji: w, reading: r, meaning: m, ruby: splitRuby(w, r), cat: HK_SETS[s] })))
// 의성어·의태어 카드: 가나 칸으로 보여 준다
const ONO_CARDS = (typeof ONO === 'undefined' ? [] : ONO).map(o => ({ ...o, kanji: o.word, reading: o.word, ruby: [[o.word, '']] }))
const NUM_CARDS = (typeof NUMBERS === 'undefined' ? [] : NUMBERS).map(n => ({ id: n.id, kanji: n.w, reading: n.r, ruby: [[n.w, n.r]], meaning: n.m, cat: numGroup(n.g).name, g: n.g, note: numGroup(n.g).note }))
const CARD_TYPES = {
  verb: { label: '동사', list: WORDS, prefix: '' },
  adj: { label: '형용사', list: ADJECTIVES, prefix: 'a:' },
  noun: { label: '명사', list: NOUN_LIST, prefix: 'n:' },
  high: { label: '고등 한자', list: HIGH_CARDS, prefix: 'h:' },
  ono: { label: '의성어', list: ONO_CARDS, prefix: 'o:' },
  num: { label: '숫자 읽기', list: NUM_CARDS, prefix: 'nu:' },
}
function cardOpen(type, x) {
  return type === 'verb' ? isOpen('verb', verbLevel(x)) : type === 'high' ? isOpen('kanji', HK_SET_GRADE[x.set]) : true
}
function openCards(type) { return CARD_TYPES[type].list.filter(x => cardOpen(type, x)) }
function cardList() { return openCards(state.cardType) }
function cardIndex() { return Math.min(state.cardIdx[state.cardType], Math.max(0, cardList().length - 1)) }
function seenKey(type, id) { return CARD_TYPES[type].prefix + id }
function seenCount(type) { return CARD_TYPES[type].list.filter(x => progress.seen[seenKey(type, x.id)]).length }

function optionText(x) {
  return `${x.kanji}${x.kanji !== x.reading ? ` (${x.reading})` : ''} · ${x.meaning}`
}
// 동사 목록은 초등/중학/고등으로 묶어 보여 준다
function verbOptions(selected) {
  return Object.entries(VERB_LEVELS).map(([lv, name]) => {
    const items = WORDS.map((x, i) => [x, i]).filter(([x]) => verbLevel(x) === lv)
    if (items.length && !isOpen('verb', lv)) return `<optgroup label="${name} 동사 ${items.length}개 · 잠김" disabled></optgroup>`
    return items.length ? `<optgroup label="${name} 동사 ${items.length}개">${items.map(([x, i]) => `<option value="${i}" ${i === selected ? 'selected' : ''}>${optionText(x)}</option>`).join('')}</optgroup>` : ''
  }).join('')
}
function cardOptions() {
  const list = cardList(), sel = cardIndex()
  if (state.cardType === 'verb') return verbOptions(sel)
  if (state.cardType === 'num') return NUMBER_GROUPS.map(g => {
    const items = list.map((x, i) => [x, i]).filter(([x]) => x.g === g.id)
    return items.length ? `<optgroup label="${g.name} ${items.length}개">${items.map(([x, i]) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${x.kanji} (${x.reading}) · ${x.meaning}</option>`).join('')}</optgroup>` : ''
  }).join('')
  if (state.cardType === 'ono') return ONO_CATS.map(c => {
    const items = list.map((x, i) => [x, i]).filter(([x]) => x.cat === c)
    return items.length ? `<optgroup label="${c} ${items.length}개">${items.map(([x, i]) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${x.word} · ${x.meaning}</option>`).join('')}</optgroup>` : ''
  }).join('')
  if (state.cardType === 'high') return Object.entries(HK_SETS).map(([s, name]) => {
    const items = list.map((x, i) => [x, i]).filter(([x]) => x.set === s)
    if (!items.length) return `<optgroup label="${name} ${highList(HK_SET_GRADE[s]).length}개 · 잠김" disabled></optgroup>`
    return `<optgroup label="${name} ${items.length}개">${items.map(([x, i]) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${optionText(x)}</option>`).join('')}</optgroup>`
  }).join('')
  if (state.cardType !== 'noun') return list.map((x, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${optionText(x)}</option>`).join('')
  return NOUN_CATS.map(cat => {
    const items = list.map((x, i) => [x, i]).filter(([x]) => x.cat === cat)
    return items.length ? `<optgroup label="${cat}">${items.map(([x, i]) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${optionText(x)}</option>`).join('')}</optgroup>` : ''
  }).join('')
}

// 글자 수에 맞춰 칸 크기를 고른다 (긴 가타카나 단어도 폰에 들어가게)
function cardSize(text) {
  const n = [...text].length
  return n <= 3 ? 'lg' : n <= 5 ? '' : n <= 6 ? 'sm' : 'xs'
}

// 형용사 카드: 네 가지 형태 표 (붙이는 부분은 흐리게)
function adjTable(a) {
  const cell = f => {
    const c = adjForm(a, f)
    return `<td><span class="jp" lang="ja">${rubyHTML(c.stem)}<span class="end">${c.ending}</span></span><span class="ko">${a.ko[FORMS.indexOf(f)]}</span></td>`
  }
  return `<table class="adjtable">
    <tr><th></th><th>긍정</th><th>부정</th></tr>
    <tr><th>현재</th>${cell('present')}${cell('negative')}</tr>
    <tr><th>과거</th>${cell('past')}${cell('pastNegative')}</tr>
  </table>
  <div class="rule"><p>${a.type === 'i'
    ? (a.reading === 'いい' ? 'いい는 예외예요. 과거와 부정에서는 よ-로 바뀌어요 (よかった, よくない)' : 'い형용사는 끝의 い를 빼고 かった·くない를 붙여요')
    : 'な형용사는 です·でした·じゃないです를 그대로 붙여요'}</p></div>`
}

function cardsView() {
  const type = state.cardType, list = cardList(), i = cardIndex(), w = list[i]
  const tabs = Object.entries(CARD_TYPES).map(([t, c]) => { const n = openCards(t).length
    return `<button class="${t === type ? 'on' : ''}${n ? '' : ' locked'}" data-act="cardType" data-type="${t}">${c.label}<span class="num">${n ? n : LOCK}</span></button>` }).join('')
  if (!w) return `<div class="tabs cardtabs">${tabs}</div>` + lockedPanel(`${CARD_TYPES[type].label} 카드 ${CARD_TYPES[type].list.length}장`, type === 'high' ? unlockHint('kanji', 10) : '')
  // 다음에 열릴 카드 묶음 안내
  const lockedN = CARD_TYPES[type].list.length - list.length
  const nextLock = lockedN && i === list.length - 1
    ? `<p class="locknote">${LOCK}다음 카드 ${lockedN}장은 ${type === 'verb' ? unlockHint('verb', Object.keys(UNLOCK_AT.verb).find(l => !isOpen('verb', l))) : unlockHint('kanji', [10, 11, 12].find(g => !isOpen('kanji', g)))}</p>` : ''
  const sub = type === 'verb' ? `${VERB_LEVELS[verbLevel(w)]} 동사 · ${GROUP_LABEL[w.group]}` : type === 'adj' ? ADJ_LABEL[w.type] : type === 'high' ? `고등 ${w.cat}` : type === 'ono' ? `${w.cat}${w.ko ? ' · ' + w.ko : ''}` : w.cat
  const hasKanji = w.ruby.some(p => p[1] && [...p[0]].some(ch => KANJI[ch]))
  const hint = [w.note ? w.note.replace(/\.$/, '') : '', hasKanji ? '한자를 누르면 음독과 훈독이 나와요' : ''].filter(Boolean).join(' · ')
  return `
  ${wordSeg('cards')}
  <div class="tabs cardtabs">${tabs}</div>
  ${type === 'verb' ? '<button class="linkbtn" data-go="conj">동사 변화표 전체 보기</button>' : ''}
  <div class="picker">
    <select data-act="pickCard" aria-label="${CARD_TYPES[type].label} 고르기">${cardOptions()}</select>
  </div>
  <div class="panel">
    <div class="hd">${CARD_TYPES[type].label} 카드<span class="num">${i + 1} / ${list.length}</span></div>
    <div class="stage${state.slide ? ' slide-' + state.slide : ''}">${masuRow(w.ruby, { clickable: true, size: cardSize(w.kanji) })}</div>
    <div class="mean">${w.meaning}<span>${sub}</span></div>
    ${hint ? `<div class="hint">${hint}</div>` : ''}
    ${type === 'adj' ? adjTable(w) : ''}
    ${type === 'ono' ? `<div class="onobox"><div class="onouse"><b>자주 쓰는 꼴</b><span lang="ja">${furi(w.use)}</span></div>
      <div class="onoex"><span class="jp" lang="ja">${gMark(w.example.jp)}</span><span class="ko">${w.example.ko}</span>
</div>
      <p class="onowhen">${w.when}</p></div>` : ''}
    ${state.kanji ? kanjiInfo(state.kanji) : ''}
    <div class="actions">
      <button class="btn" data-act="prevCard" ${i === 0 ? 'disabled' : ''}>${icon('left')}이전</button>
      ${type === 'verb' ? '<button class="btn" data-act="showConj">변화표 보기</button>' : ''}
      ${type === 'ono' ? '<button class="btn" data-act="onoQuiz">퀴즈</button>' : ''}
      ${type === 'num' ? '<button class="btn" data-act="numQuiz">퀴즈</button>' : ''}
      <button class="btn pri" data-act="nextCard" ${i === list.length - 1 ? 'disabled' : ''}>다음${icon('right')}</button>
    </div>
    ${nextLock}
  </div>`
}

function markSeen() {
  const w = cardList()[cardIndex()]
  if (!w) return
  state.cardIdx[state.cardType] = cardIndex()
  const key = seenKey(state.cardType, w.id)
  markStudy()
  progress.seen[key] = (progress.seen[key] || 0) + 1
  if (state.cardType === 'high' && !progress.seenHigh.includes(w.kanji)) progress.seenHigh.push(w.kanji)   // 한자 화면의 "본 단어"와 함께 센다
  todayStats().cards++
  addXP(1)
}

// ───── 동사 변화표 ─────
function conjView() {
  const modes = [['one', '동사 하나'], ['all', '전체 표']]
    .map(([m, label]) => `<button class="${state.conjMode === m ? 'on' : ''}" data-act="conjMode" data-mode="${m}">${label}</button>`).join('')
  return `<div class="tabs">${modes}</div>` + (state.conjMode === 'all' ? conjAllView() : conjOneView())
}

// 전체 표: 동사 30개 × 4형태. 어미(ます 등)는 흐리게 해서 바뀌는 부분이 보이게 한다.
function conjAllView() {
  if (state.conjLevel && state.conjLevel !== 'all' && !isOpen('verb', state.conjLevel)) state.conjLevel = 'all'
  const lvOK = w => isOpen('verb', verbLevel(w)) && (!state.conjLevel || state.conjLevel === 'all' || verbLevel(w) === state.conjLevel)
  const counts = [0, 1, 2, 3].map(g => WORDS.filter(w => lvOK(w) && (!g || w.group === g)).length)
  const levels = ['all', ...Object.keys(VERB_LEVELS)].map(l => { const open = l === 'all' || isOpen('verb', l)
    return `<button class="${(state.conjLevel || 'all') === l ? 'on' : ''}${open ? '' : ' locked'}" data-act="conjLevel" data-level="${l}" ${open ? '' : `disabled title="${unlockHint('verb', l)}"`}>${open ? '' : LOCK}${l === 'all' ? '열린 동사 전체' : VERB_LEVELS[l]}<span class="num">${l === 'all' ? WORDS.filter(w => isOpen('verb', verbLevel(w))).length : WORDS.filter(w => verbLevel(w) === l).length}</span></button>` }).join('')
  const filters = levels + '<span class="fsep"></span>' + [0, 1, 2, 3].map(g => `<button class="${state.conjGroup === g ? 'on' : ''}" data-act="conjGroup" data-group="${g}">${g ? `${g}그룹` : '모든 그룹'}<span class="num">${counts[g]}</span></button>`).join('')
  const form = (w, f) => `<td lang="ja">${rubyHTML(masuStem(w))}<span class="end">${ENDINGS[f]}</span></td>`
  const rows = WORDS.map((w, i) => ({ w, i })).filter(({ w }) => lvOK(w) && (!state.conjGroup || w.group === state.conjGroup))
    .map(({ w, i }) => `<tr data-verb="${i}" tabindex="0">
      <th scope="row"><span lang="ja">${rubyHTML(w.ruby)}</span><small>${w.meaning}${w.note ? ' · 예외' : ''}</small></th>
      ${FORMS.map(f => form(w, f)).join('')}</tr>`).join('')
  return `
  <div class="filters">${filters}</div>
  <div class="panel">
    <div class="tablewrap">
      <table class="alltable">
        <thead><tr><th>동사</th>${FORMS.map(f => `<th>${FORM_LABEL[f]}</th>`).join('')}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="hint">줄을 누르면 그 동사의 자세한 표로 가요 · 흐린 글자는 붙이는 부분</div>
  </div>`
}

function conjOneView() {
  const openN = WORDS.filter(x => isOpen('verb', verbLevel(x))).length   // 동사는 쉬운 수준부터 차례로 들어 있다
  if (state.verb >= openN) state.verb = openN - 1
  const w = WORDS[state.verb]
  const cell = f => {
    const c = conjugate(w, f)
    const i = FORMS.indexOf(f)
    const ko = f === 'present' ? `${w.ko[0]} / ${w.fut}` : w.ko[i]
    return `<td><span class="jp" lang="ja">${rubyHTML(c.pairs)}</span><span class="ko">${ko}</span></td>`
  }
  const now = conjugate(w, 'present')
  const options = verbOptions(state.verb)
  return `
  <div class="picker">
    <button class="btn icon-only" data-act="prevVerb" aria-label="이전 동사" ${state.verb === 0 ? 'disabled' : ''}>${icon('left')}</button>
    <select data-act="pickVerb" aria-label="동사 고르기">${options}</select>
    <button class="btn icon-only" data-act="nextVerb" aria-label="다음 동사" ${state.verb >= openN - 1 ? 'disabled' : ''}>${icon('right')}</button>
  </div>
  <div class="panel">
    <div class="verbhead">${masuRow(w.ruby, { size: 'sm' })}<div><div class="vmean">${w.meaning}</div><div class="vgroup">${VERB_LEVELS[verbLevel(w)]} 동사 · ${GROUP_LABEL[w.group]}</div></div></div>
    <table>
      <tr><th></th><th>긍정</th><th>부정</th></tr>
      <tr><th>현재·미래</th>${cell('present')}${cell('negative')}</tr>
      <tr><th>과거</th>${cell('past')}${cell('pastNegative')}</tr>
    </table>
    <div class="rule"><p>${ruleText(w)}</p>
      <span class="jp" lang="ja">${rubyHTML(w.ruby)} → ${rubyHTML(masuStem(w))} + ます</span></div>
    ${w.note ? `<div class="note">${w.note}</div>` : ''}
  </div>
  <div class="panel">
    <div class="hd">“${w.fut}”는 어떻게 말할까요</div>
    <div class="row"><span class="jp" lang="ja"><ruby>今<rt>いま</rt></ruby> ${rubyHTML(now.pairs)}</span><span class="dim">지금 ${w.ko[0]}</span></div>
    <div class="row"><span class="jp" lang="ja"><ruby>明日<rt>あした</rt></ruby> ${rubyHTML(now.pairs)}</span><span class="dim">내일 ${w.fut}</span></div>
    <div class="note">일본어에는 “~할 겁니다”만을 위한 형태가 없어요. 같은 ます형에 明日(내일) 같은 시간 단어를 붙이면 미래가 돼요.</div>
  </div>`
}

// ───── JLPT 문법 ─────
// {漢字|かんじ} → 후리가나
function furi(s) {
  return s.replace(/\{([^{}|]+)\|([^{}|]+)\}/g, '<ruby>$1<rt>$2</rt></ruby>')
}
const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

function grammarView() {
  const saved = progress.savedGrammar.filter(id => GRAMMAR.some(g => g.id === id))
  const lv = state.grammarLevel
  const tabs = [...LEVELS, 'saved'].map(l => {
    const n = l === 'saved' ? saved.length : GRAMMAR.filter(g => g.level === l).length
    return `<button class="${lv === l ? 'on' : ''}" data-act="grammarLevel" data-level="${l}">${l === 'saved' ? '★ 저장' : l}<span class="num">${n}</span></button>`
  }).join('')
  const ghero = `<div class="ghero">${mascot('mascot')}<div><h1>JLPT 문법</h1><p>주제별로 묶어 보고, 헷갈리는 짝까지 한 번에 · 어려운 건 ☆로 모아 두기</p></div></div>`
  const quizOpen = lv === 'saved' || isOpen('grammar', lv)
  const list = lv === 'saved' ? GRAMMAR.filter(g => saved.includes(g.id)) : GRAMMAR.filter(g => g.level === lv)
  const seen = list.filter(g => progress.seenGrammar.includes(g.id)).length
  const item = g => {
    const open = state.grammarOpen === g.id, star = saved.includes(g.id)
    const sim = (g.similar || []).map(id => GRAMMAR.find(x => x.id === id)).filter(Boolean)
    return `<div class="gitem${open ? ' open' : ''}${progress.seenGrammar.includes(g.id) ? ' seen' : ''}${(progress.master || {})['g:' + g.id] === 3 ? ' mastered' : ''}">
      <button class="ghead" data-act="grammarOpen" data-id="${g.id}" aria-expanded="${open}">
        <span class="gpattern" lang="ja">${furi(g.pattern)}</span>
        <span class="gmean">${g.meaning}</span>
        ${lv === 'saved' ? `<span class="glevel">${g.level}</span>` : ''}
      </button>
      ${open ? `<div class="gbody">
        <div class="gconnect"><b>접속</b>${g.connect}</div>
        <p class="gexplain">${g.explain}</p>
        ${g.examples.map(e => `<div class="gex"><span class="jp" lang="ja">${gMark(e.jp)}</span><span class="ko">${e.ko}</span></div>`).join('')}
        ${sim.length ? `<div class="gsim"><b>헷갈리는 짝</b><div class="gsimlist">${sim.map(x => `<button class="gsimbtn" data-act="grammarJump" data-id="${x.id}"><span lang="ja">${furi(x.pattern)}</span><small>${x.level} · ${x.meaning}</small></button>`).join('')}</div>${g.diff ? `<p>${g.diff}</p>` : ''}</div>` : ''}
        <button class="btn gstar${star ? ' on' : ''}" data-act="grammarStar" data-id="${g.id}">${star ? '★ 저장됨' : '☆ 헷갈려요, 저장'}</button>
      </div>` : ''}
    </div>`
  }
  // 급수 화면은 주제별로 묶는다 (주제가 없는 옛 데이터는 한 묶음)
  const THEME_ORDER = ['기본 문장', '조사', '지시·존재', '활용', '시간·순서', '이유·원인', '목적·수단', '조건·가정', '역접·양보', '추측·전달', '의지·계획', '의무·허가·금지', '희망·권유·부탁', '변화·경험·시도', '비교·정도', '한정·강조', '주고받기', '경어', '상황·관점', '나열·예시']
  let items
  if (lv === 'saved' || !list.some(g => g.theme)) items = list.map(item).join('')
  else {
    const groups = THEME_ORDER.map(t => [t, list.filter(g => g.theme === t)]).filter(([, a]) => a.length)
    const rest = list.filter(g => !THEME_ORDER.includes(g.theme))
    if (rest.length) groups.push(['기타', rest])
    items = groups.map(([t, a]) => `<div class="gtheme"><b>${t}</b><span class="num">${a.filter(g => progress.seenGrammar.includes(g.id)).length} / ${a.length}</span></div>${a.map(item).join('')}`).join('')
  }
  const empty = lv === 'saved' && !list.length
    ? `<div class="gempty">${mascot('think')}<p>헷갈리는 문법에서 <b>☆ 저장</b>을 누르면 여기에 모여요</p></div>` : ''
  return `
  ${ghero}
  <div class="tabs gtabs">${tabs}</div>
  ${list.length ? `<div class="subbar"><p class="sub">${lv === 'saved' ? `저장한 문법 ${list.length}개` : `${lv} 문법 ${list.length}개 · 본 문법 <span class="num">${seen} / ${list.length}</span>`}</p>
    ${quizOpen ? `<button class="btn" data-act="grammarQuiz">${lv === 'saved' ? '저장한 문법 퀴즈' : `${lv} 문법 퀴즈`}</button>` : `<span class="quizlock">${LOCK}퀴즈는 ${unlockHint('grammar', lv)}</span>`}</div>` : ''}
  <div class="panel glist">${items}${empty}</div>`
}

// ───── 단짝 고양이 ─────
// 쓰다듬으면 하는 말 (성격마다 조금씩 다르게)
const CAT_LINES = {
  mike: ['헷갈리는 건 내가 기억해 둘게요', '한 교시만 하고 가요', '어제 틀린 거, 오늘은 맞힐 거예요', '같이 하면 금방이에요'],
  kuro: ['흥, 오늘도 왔네요', '틀린 문제는 다 적어 뒀어요', '조금만 더 하면 별 세 개예요'],
  shiro: ['천천히 해도 괜찮아요', '오늘 공부, 반짝반짝 빛났어요', '쉬었다 가도 돼요'],
  mikan: ['한 판 더 가요', '정답 맞히면 점프할 거예요', '오늘 기운 넘쳐요'],
  moka: ['헷갈리는 짝부터 정리해 봐요', '오늘은 복습부터 어때요', '차분히 하나씩요'],
  hachi: ['달려 볼까요', '연속 정답 기록 깨 봐요', '준비 운동은 끝났어요'],
  gin: ['조용히, 꾸준히', '한 문제씩 쌓이고 있어요', '오늘도 수고했어요'],
  tora: ['어려운 것도 덤벼 봐요', '틀려도 다시 하면 돼요', '오늘은 몇 개 맞힐까요'],
  maru: ['조금만 하고 같이 쉬어요', '동글동글, 오늘도 한 교시', '졸리면 문제 하나만요'],
  sabi: ['저, 저기… 같이 공부해요', '조용히 응원하고 있어요', '오늘도 와 줘서 고마워요'],
  mofu: ['폭신하게 시작해 봐요', '천천히 와도 기다릴게요', '오늘 배운 거 꼭 안아 둘게요'],
}
// 오늘의 교정: 날마다 헷갈리는 문법 짝 하나를 단짝이 문제로 내 준다 (홈에서 바로 풀기)
function todayCorrection() {
  const openG = id => { const x = GRAMMAR.find(y => y.id === id); return x && isOpen('grammar', x.level) ? x : null }
  // 빈칸 바로 앞 글자가 같은 예문끼리만 짝을 지어, 모양만 보고 답이 드러나지 않게 한다
  const before = jp => { const i = jp.indexOf('［'); return i > 0 ? jp[i - 1] : '' }
  const pool = []
  for (const g of GRAMMAR) {
    if (!isOpen('grammar', g.level) || !g.diff) continue
    const sims = (g.similar || []).map(openG).filter(Boolean)
    g.examples.forEach((e, ei) => {
      if (!e.jp.includes('［')) return
      const ans = blankOf(e), opts = [ans]
      for (const x of sims) for (const y of x.examples) {
        const b = blankOf(y)
        if (b && before(y.jp) === before(e.jp) && !opts.some(o => plainJp(o) === plainJp(b))) { opts.push(b); break }
      }
      if (opts.length >= 2) pool.push({ g, e, ei, ans, opts, sims })
    })
  }
  if (!pool.length) return null
  const d = todayStr(), seed = [...d].reduce((n, ch) => (n * 37 + ch.charCodeAt(0)) % 100019, 11)
  const c = pool[seed % pool.length], opts = c.opts.slice(0, 3)
  if (seed % 2) opts.reverse()
  return { ...c, opts, key: `gf:${c.g.id}:${c.ei}` }
}
function correctionCardHTML() {
  const c = todayCorrection()
  if (!c) return ''
  const b = buddy(), done = state.fixDone
  const sent = furi(c.e.jp.replace(/［[^［］]*］/, '<span class="blank">（　　）</span>'))
  const btns = c.opts.map((o, i) => {
    const cls = done ? (o === c.ans ? ' ok' : i === done.i ? ' miss' : '') : ''
    return `<button class="choice fixopt${cls}" data-act="fixPick" data-i="${i}" lang="ja" ${done ? 'disabled' : ''}>${furi(o)}</button>`
  }).join('')
  return `<div class="panel fixcard">
    <div class="fixhead">${mascot(done ? (done.ok ? 'cheer' : 'sad') : 'think', 'fixcat')}<div><div class="eyebrow">${b.name}의 오늘의 교정</div><b>${done ? (done.ok ? '맞았어요, 이 짝은 안 헷갈리네요' : '헷갈렸죠, 내일 다시 나와요') : '빈칸에 맞는 것은'}</b></div></div>
    <div class="gsent fixsent" lang="ja">${sent}</div><p class="fixko">${c.e.ko}</p>
    <div class="fixopts">${btns}</div>
    ${done ? `<p class="fixdiff">${c.g.diff}</p><div class="actions"><button class="btn pri" data-act="startFix">교정 10문제 더 풀기</button></div>` : ''}
  </div>`
}
// 교정 10문제: 헷갈리는 짝이 오답으로 나오는 빈칸 문제만, 틀렸던 것 먼저
function buildFixQuiz() {
  const keys = GRAMMAR.filter(g => isOpen('grammar', g.level) && (g.similar || []).length).flatMap(g => g.examples.map((x, i) => x.jp.includes('［') ? `gf:${g.id}:${i}` : null).filter(Boolean))
  return pickKeys(progress.wrongGrammar, keys).map(k => { const q = makeGrammarQuestion(k); q.mode = 'grammar'; return q })
}
// 실력 진단(월반 시험): 단계마다 한자 1 + 문법 1, 연속으로 둘 다 맞힌 단계까지 건너뛴다
const PLACE_TIERS = [
  { kanji: 2, lv: 'N5', to: 'e3', label: '초등학교 3학년' },
  { kanji: 4, lv: 'N4', to: 'e5', label: '초등학교 5학년' },
  { kanji: 6, lv: 'N4', to: 'm1', label: '중학교 1학년' },
  { kanji: 8, lv: 'N3', to: 'm3', label: '중학교 3학년' },
  { kanji: 9, lv: 'N3', to: 'h1', label: '고등학교 1학년' },
  { kanji: 11, lv: 'N2', to: 'h3', label: '고등학교 3학년' },
]
function buildPlacement() {
  const out = []
  PLACE_TIERS.forEach((t, ti) => {
    const kk = t.kanji >= 10 ? highKanjiKeys([HK_GRADE[t.kanji]]).filter(k => k.endsWith(':r')) : kanjiPool(t.kanji).flatMap(c => readIndexes(c, t.kanji).map(i => `r:${c}:${i}`))
    const gk = GRAMMAR.filter(g => g.level === t.lv).flatMap(g => g.examples.map((x, i) => x.jp.includes('［') ? `gf:${g.id}:${i}` : null).filter(Boolean))
    for (const k of [shuffle(kk)[0], shuffle(gk)[0]]) { const q = k && questionFromKey(k); if (q) { q.tier = ti; out.push(q) } }
  })
  return out
}
function applyPlacement(qz) {
  let reached = -1
  for (let ti = 0; ti < PLACE_TIERS.length; ti++) {
    const qs = qz.list.filter(q => q.tier === ti)
    if (qs.length && qs.every(q => !qz.missed.includes(q))) reached = ti; else break
  }
  progress.placed = true
  if (reached < 0) { saveProgress(); return { label: '초등학교 1학년', skipped: 0 } }
  const t = PLACE_TIERS[reached], idx = stageIndex(t.to)
  let skipped = 0
  for (let i = 0; i < idx; i++) if (!stageCleared(STAGES[i].id)) { progress.stages[STAGES[i].id] = 1; skipped++ }
  for (const sc of SCHOOLS) if (stageCleared(sc.stages[sc.stages.length - 1].id) && !progress.graduated.includes(sc.id)) progress.graduated.push(sc.id)
  checkBadges(); saveProgress()
  return { label: t.label, skipped }
}
function placeResultHTML(p) {
  return `<div class="mockres pass"><div class="mockscore"><b>${p.label}</b></div>
    <p>${p.skipped ? `${p.skipped}칸을 건너뛰고 여기서 시작해요 · 건너뛴 칸은 별 1개로 채워 두었어요` : '처음부터 차근차근 시작해요'}</p>
    <div class="actions"><button class="btn pri" data-act="questContinue">여기서 시작</button></div></div>`
}

// ───── 성취감: 오늘의 미션 · 복습 · 모의고사 · 성적표 ─────
const MISSIONS = [
  { id: 'cards10', label: '단어 카드 10장 보기', need: 10, get: t => t.cards, c: 'var(--sky)' },
  { id: 'cards20', label: '단어 카드 20장 보기', need: 20, get: t => t.cards, c: 'var(--sky)' },
  { id: 'quiz1', label: '퀴즈 한 번 끝내기', need: 1, get: t => t.quizzes, c: 'var(--sun)' },
  { id: 'quiz2', label: '퀴즈 두 번 끝내기', need: 2, get: t => t.quizzes, c: 'var(--sun)' },
  { id: 'correct15', label: '정답 15개 맞히기', need: 15, get: t => t.correct, c: 'var(--leaf)' },
  { id: 'correct30', label: '정답 30개 맞히기', need: 30, get: t => t.correct, c: 'var(--leaf)' },
  { id: 'scene1', label: '회화 장면 하나 열어 보기', need: 1, get: t => t.scenes || 0, c: 'var(--mint)' },
  { id: 'grammar3', label: '문법 3개 펼쳐 보기', need: 3, get: t => t.grammar, c: 'var(--mint)' },
  { id: 'stage1', label: '퀘스트 한 칸 통과하기', need: 1, get: t => t.stages, c: 'var(--pink)' },
  { id: 'review1', label: '오늘 복습 끝내기', need: 1, get: t => t.reviews, c: 'var(--pink)', when: () => Object.keys(progress.review || {}).length > 0 },
]
// 날짜로 정해지는 오늘의 미션 3개 (쉬운 것 하나 + 나머지 둘)
function todayMissions() {
  const d = todayStr(), seed = [...d].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) % 100003, 7)
  const pool = MISSIONS.filter(m => !m.when || m.when())
  const easy = pool.filter(m => ['cards10', 'quiz1'].includes(m.id)), rest = pool.filter(m => !['cards10', 'quiz1'].includes(m.id))
  const out = [easy[seed % easy.length]]
  let k = seed
  while (out.length < 3 && rest.length) { k = (k * 1103 + 12345) % 100003; const m = rest.splice(k % rest.length, 1)[0]; if (!out.some(x => x.id.replace(/\d+/, '') === m.id.replace(/\d+/, ''))) out.push(m) }
  return out
}
function missionsHTML(t, goal) {
  const ms = todayMissions(), done = ms.filter(m => m.get(t) >= m.need).length
  const chest = t.chest ? `<div class="chestrow open"><span class="chest" lang="ja">宝</span><span>보물상자를 열었어요 · <b class="num">+${t.chest} XP</b></span></div>`
    : done === ms.length ? `<div class="chestrow ready"><span class="chest shake" lang="ja">宝</span><button class="btn pri" data-act="openChest">보물상자 열기</button></div>`
    : `<div class="chestrow"><span class="chest locked" lang="ja">宝</span><span>미션 3개를 마치면 보물상자가 열려요</span></div>`
  return `<div class="panel goals"><div class="eyebrow">오늘의 미션 <span class="num">· ${done} / ${ms.length}</span></div>
    ${ms.map(m => goal(m.label, m.get(t), m.need, m.c)).join('')}${chest}</div>`
}
function dueKeys() {
  const rv = progress.review || {}, today = todayStr()
  return Object.keys(rv).filter(k => !k.startsWith('gb:') && rv[k].due <= today).sort((a, b) => rv[a].due.localeCompare(rv[b].due))
}
function reviewCardHTML() {
  const rv = progress.review || {}, all = Object.values(rv), due = dueKeys().length
  const lv = [0, 1, 2].map(s => all.filter(r => r.step === s).length)
  return `<div class="panel challenge rvcard"><div class="eyebrow">기억 강도 복습</div>
    <div class="chbig"><b class="num">${due}</b><span>오늘 복습할 문제</span></div>
    <div class="memlv"><span class="w">약함 ${lv[0]}</span><span class="m">보통 ${lv[1]}</span><span class="s">강함 ${lv[2]}</span></div>
    <button class="btn pri" data-act="startReview" ${due ? '' : 'disabled'}>${due ? '복습 시작' : '오늘은 다 했어요'}</button>
    <p class="chnote">틀린 문제는 1일 · 3일 · 7일 뒤에 다시 나와요</p></div>`
}
const PASS_LINE = { N5: 80, N4: 90, N3: 95, N2: 90, N1: 100 }
function mockCardHTML() {
  const btns = LEVELS.slice().reverse().map(l => { const open = isOpen('grammar', l), best = (progress.mock || {})[l]
    return `<button class="mockbtn${open ? '' : ' locked'}${best >= PASS_LINE[l] ? ' passed' : ''}" data-act="startMock" data-level="${l}" ${open ? '' : 'disabled'}>${open ? '' : LOCK}<b>${l}</b><small>${best != null ? best + '점' : open ? '도전' : '잠김'}</small></button>` }).join('')
  return `<div class="panel challenge"><div class="eyebrow">JLPT 실력 체크 <span class="num">· 문자·문법 30문제</span></div>
    <div class="mockbtns">${btns}</div><p class="chnote">문자·문법만 점검해요(독해·청해 없음) · 합격선 수준이면 合 도장</p></div>`
}
// 모의고사 점수: 180점으로 환산, 합격선과 영역 최저점(3분의 1) 모두 넘으면 합격 예상
function mockScore(qz) {
  const secs = ['문자', '문법', '표현'].map(s => { const a = qz.list.filter(q => q.section === s); return { s, n: a.length, r: a.filter(q => !qz.missed.includes(q)).length } })
  const score = Math.round(qz.right / qz.list.length * 180)
  const pass = score >= PASS_LINE[state.mockLevel] && secs.every(x => !x.n || x.r / x.n >= 1 / 3)
  return { score, pass, secs, line: PASS_LINE[state.mockLevel] }
}
function mockResultHTML(m) {
  return `<div class="mockres${m.pass ? ' pass' : ''}">
    <div class="mockscore"><b class="num">${m.score}</b><span>/ 180</span>${m.pass ? '<span class="hanko passmark" lang="ja">合</span>' : ''}</div>
    <p>${m.pass ? `문자·문법은 ${state.mockLevel} 합격선 수준이에요 (${m.line}점)` : `합격선 ${m.line}점까지 ${Math.max(0, m.line - m.score)}점 · 조금만 더`}</p>
    <p class="chnote">180점 만점으로 바꾼 점수예요 · 실제 시험의 독해·청해는 들어 있지 않아요</p>
    <div class="mocksecs">${m.secs.map(x => `<div><span>${x.s}</span><b class="num">${x.r} / ${x.n}</b><i style="width:${x.n ? x.r / x.n * 100 : 0}%"></i></div>`).join('')}</div></div>`
}
function masterCount(prefix) { return Object.entries(progress.master || {}).filter(([k, v]) => v === 3 && k.startsWith(prefix)).length }

// 졸업 성적표: 그림으로 그려 길게 눌러 저장하거나 공유
async function showReportCard(schoolId) {
  const sc = schoolOf(schoolId) || SCHOOLS[0], stages = STAGES.filter(s => s.school === sc.id)
  const W = 1080, H = 1720, c = document.createElement('canvas'); c.width = W; c.height = H
  const g = c.getContext('2d')
  const load = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src })
  try { await document.fonts.ready } catch { /* 글꼴 없이 */ }
  const cat = await load(catImage(buddy()))
  g.fillStyle = '#fff9f0'; g.fillRect(0, 0, W, H)
  g.strokeStyle = '#c9a45c'; g.lineWidth = 10; g.strokeRect(40, 40, W - 80, H - 80)
  g.strokeStyle = '#e2c88f'; g.lineWidth = 3; g.strokeRect(62, 62, W - 124, H - 124)
  g.fillStyle = '#3a2e1f'; g.textAlign = 'center'
  g.font = '700 110px "Noto Serif JP", "Yu Mincho", serif'; g.fillText('成績表', W / 2, 230)
  g.font = '48px Jua, sans-serif'; g.fillText(`${sc.name} 일본어 성적표`, W / 2, 310)
  g.font = '34px Jua, sans-serif'; g.fillStyle = '#8b6d3f'; g.fillText(`Lv.${playerLevel()} · ${rankName()}`, W / 2, 370)
  // 학년별 별
  g.textAlign = 'left'
  stages.forEach((st, i) => {
    const y = 480 + i * 84, n = progress.stages[st.id] || 0
    g.fillStyle = '#3a2e1f'; g.font = '44px Jua, sans-serif'; g.fillText(st.name, 150, y)
    g.font = '58px sans-serif'
    for (let k = 0; k < 3; k++) { g.fillStyle = k < n ? '#ffc23c' : '#e8dcc6'; g.fillText('★', 620 + k * 80, y + 6) }
  })
  const y0 = 480 + (stages.length - 1) * 84 + 140
  g.strokeStyle = '#e2c88f'; g.lineWidth = 2; g.beginPath(); g.moveTo(150, y0 - 50); g.lineTo(W - 150, y0 - 50); g.stroke()
  const stats = [['모은 별', `${totalStars()} / ${STAGES.length * 3}`], ['총 경험치', `${progress.xp || 0} XP`], ['마스터한 문법', `${masterCount('g:')}개`], ['마스터한 한자', `${masterCount('k:')}개`], ['배지', `${progress.badges.length} / ${BADGES.length}`]]
  stats.forEach(([k, v], i) => { const y = y0 + i * 64; g.fillStyle = '#8b6d3f'; g.font = '38px Jua, sans-serif'; g.fillText(k, 150, y); g.fillStyle = '#3a2e1f'; g.textAlign = 'right'; g.fillText(v, 640, y); g.textAlign = 'left' })
  if (cat) g.drawImage(cat, W - 440, y0 - 40, 340, 340)
  // 도장
  g.save(); g.translate(W - 190, 200); g.rotate(-0.2)
  g.strokeStyle = '#d2402e'; g.lineWidth = 8; g.beginPath(); g.arc(0, 0, 90, 0, Math.PI * 2); g.stroke()
  g.fillStyle = '#d2402e'; g.textAlign = 'center'; g.font = '700 96px "Noto Serif JP", serif'; g.fillText('卒', 0, 34); g.restore()
  g.fillStyle = '#8b6d3f'; g.textAlign = 'left'; g.font = '32px Jua, sans-serif'
  g.fillText(new Date().toLocaleDateString('ko-KR'), 150, H - 150); g.fillText('미묘한 일본어', 150, H - 105)
  const url = c.toDataURL('image/png')
  const el = document.createElement('div')
  el.className = 'rcover'
  el.innerHTML = `<div class="rcbox"><img src="${url}" alt="${sc.name} 성적표"><p>그림을 길게 눌러 사진에 저장할 수 있어요</p>
    <div class="actions"><button class="btn pri" data-rc="share">공유하기</button><button class="btn" data-rc="close">닫기</button></div></div>`
  document.body.appendChild(el)
  el.addEventListener('click', async e => {
    const b = e.target.closest('[data-rc]')
    if (!b && e.target !== el) return
    if (!b || b.dataset.rc === 'close') { el.remove(); return }
    try {
      const blob = await (await fetch(url)).blob(), file = new File([blob], `seiseki-${sc.id}.png`, { type: 'image/png' })
      if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: '미묘한 일본어 성적표' })
      else { const a = document.createElement('a'); a.href = url; a.download = file.name; a.click() }
    } catch { /* 공유 취소 */ }
  })
}

// ───── 실생활 회화 ─────
function talkLineOf(key) { const [, sid, i] = key.split(':'); const s = talkScene(sid); return s && s.lines[Number(i)] }
// 문장 하나라도 퀴즈에서 맞히면 '익힘'
function talkLearned(sid, i) { return ['tw', 'tm', 'tb'].some(t => progress.learnedTalk.includes(`${t}:${sid}:${i}`)) }
function talkSeenCount(s) { return s.lines.filter((_, i) => talkLearned(s.id, i)).length }

function talkView() {
  const scenes = typeof TALK === 'undefined' ? [] : TALK
  const stamps = Object.keys(progress.talkStamps).length
  const head = `<div class="ghero thero">${mascot('mascot')}<div><h1>실생활 회화</h1><p>여행과 생활에서 바로 쓰는 문장 · 장면 퀴즈를 통과하면 도장</p></div></div>`
  if (!state.talkScene || !talkScene(state.talkScene)) {
    const board = scenes.map(s => `<span class="tcell${progress.talkStamps[s.id] ? ' on' : ''}" title="${s.name}"><span class="tstamp" lang="ja">${s.mark}</span></span>`).join('')
    const cards = scenes.map(s => {
      const seen = talkSeenCount(s), st = progress.talkStamps[s.id]
      return `<button class="tscene${st ? ' done' : ''}" data-act="talkOpen" data-id="${s.id}">
        <span class="tmark" lang="ja">${s.mark}</span>
        <span class="tbody"><b>${s.name}</b><small>${s.desc}</small><span class="tprog"><i style="width:${seen / s.lines.length * 100}%"></i></span></span>
        ${st ? '<span class="tdone" lang="ja">済</span>' : `<span class="num tcount">${seen}/${s.lines.length}</span>`}</button>`
    }).join('')
    return `${head}
    <div class="panel tboard"><div class="eyebrow">장면 도장판 <span class="num">· ${stamps} / ${scenes.length}</span></div><div class="tgrid">${board}</div>
      <div class="hint">장면마다 퀴즈 10문제 중 8개 이상 맞히면 도장이 찍혀요</div></div>
    <div class="subbar"><p class="sub">장면 ${scenes.length}개 · 문장 ${scenes.reduce((n, s) => n + s.lines.length, 0)}개</p><button class="btn" data-act="talkQuiz">모든 장면 퀴즈</button></div>
    <div class="tscenes">${cards}</div>`
  }
  const s = talkScene(state.talkScene), st = progress.talkStamps[s.id]
  const lines = s.lines.map((l, i) => {
    const jp = state.showCasual && l.casual ? l.casual : l.jp
    const seen = talkLearned(s.id, i)
    return `<div class="tline ${l.who}${seen ? ' seen' : ''}">
      <div class="twho">${l.who === 'me' ? '나' : '상대'} · ${l.when}</div>
      <div class="tbubble">
        <span class="jp" lang="ja">${furi(jp)}</span>
        <span class="ko">${l.ko}</span>
        ${l.note ? `<span class="tnote">${l.note}</span>` : ''}
      </div></div>`
  }).join('')
  return `
  <div class="tdetailhead"><button class="btn icon-only" data-act="talkBack" aria-label="장면 목록으로">${icon('left')}</button>
    <span class="tmark" lang="ja">${s.mark}</span><div><b>${s.name}</b><small>${s.desc}</small></div>${st ? '<span class="tdone" lang="ja">済</span>' : ''}</div>
  <div class="subbar"><button class="btn${state.showCasual ? ' on' : ''}" data-act="talkCasual">${state.showCasual ? '존댓말로 보기' : '반말로 보기'}</button><button class="btn pri" data-act="talkQuiz">${st ? '장면 퀴즈 다시' : '장면 퀴즈 · 도장 받기'}</button></div>
  <div class="panel tlines">${lines}</div>
  <p class="locknote">퀴즈에서 맞힌 문장에는 '익힘'이 표시돼요</p>`
}

// ───── 퀘스트 지도 ─────
// 학교 건물 아이콘: 초등학교 → 중학교 → 고등학교로 갈수록 커진다 (창문은 칸 색으로 비워 보이게)
const SCHOOL_ICON = {
  elem: '<svg class="schoolsvg" viewBox="0 0 24 24" aria-hidden="true"><path class="wall" d="M4 12h16v9H4z"/><path class="wall" d="M9 12V8.2L12 5l3 3.2V12z"/><path class="flag" d="M12 5V1.6"/><path class="wall" d="M12 1.6h3.2L12 3.4z"/><circle class="win" cx="12" cy="9.3" r="1.25"/><rect class="win" x="5.8" y="14" width="2.6" height="2.4" rx=".4"/><rect class="win" x="15.6" y="14" width="2.6" height="2.4" rx=".4"/><rect class="win" x="10.6" y="16.4" width="2.8" height="4.6" rx=".4"/></svg>',
  mid: '<svg class="schoolsvg" viewBox="0 0 24 24" aria-hidden="true"><path class="wall" d="M2.5 10h19v11h-19z"/><path class="wall" d="M9.2 10V6.3L12 3.5l2.8 2.8V10z"/><circle class="win" cx="12" cy="7.4" r="1.25"/><rect class="win" x="4.2" y="12" width="2.4" height="2.2" rx=".4"/><rect class="win" x="8.1" y="12" width="2.4" height="2.2" rx=".4"/><rect class="win" x="13.5" y="12" width="2.4" height="2.2" rx=".4"/><rect class="win" x="17.4" y="12" width="2.4" height="2.2" rx=".4"/><rect class="win" x="4.2" y="16" width="2.4" height="2.2" rx=".4"/><rect class="win" x="17.4" y="16" width="2.4" height="2.2" rx=".4"/><rect class="win" x="10.6" y="16.2" width="2.8" height="4.8" rx=".4"/></svg>',
  high: '<svg class="schoolsvg" viewBox="0 0 24 24" aria-hidden="true"><path class="wall" d="M1.5 9.5h21V21h-21z"/><path class="wall" d="M9.4 9.5V4h5.2v5.5z"/><path class="wall" d="M8.8 4.2 12 1.2l3.2 3z"/><circle class="win" cx="12" cy="6.4" r="1.3"/><rect class="win" x="3.2" y="11.4" width="2.2" height="2.1" rx=".4"/><rect class="win" x="6.8" y="11.4" width="2.2" height="2.1" rx=".4"/><rect class="win" x="15" y="11.4" width="2.2" height="2.1" rx=".4"/><rect class="win" x="18.6" y="11.4" width="2.2" height="2.1" rx=".4"/><rect class="win" x="3.2" y="15" width="2.2" height="2.1" rx=".4"/><rect class="win" x="6.8" y="15" width="2.2" height="2.1" rx=".4"/><rect class="win" x="15" y="15" width="2.2" height="2.1" rx=".4"/><rect class="win" x="18.6" y="15" width="2.2" height="2.1" rx=".4"/><rect class="win" x="10.5" y="15.6" width="3" height="5.4" rx=".4"/></svg>',
}
function schoolIcon(id) { return SCHOOL_ICON[id] || SCHOOL_ICON.elem }

const PAW = '<svg class="pawsvg" viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="15.6" rx="5.2" ry="4.3"/><ellipse cx="5.9" cy="10.2" rx="2.1" ry="2.5" transform="rotate(-18 5.9 10.2)"/><ellipse cx="9.7" cy="6.6" rx="2.2" ry="2.7" transform="rotate(-6 9.7 6.6)"/><ellipse cx="14.3" cy="6.6" rx="2.2" ry="2.7" transform="rotate(6 14.3 6.6)"/><ellipse cx="18.1" cy="10.2" rx="2.1" ry="2.5" transform="rotate(18 18.1 10.2)"/></svg>'
const LOCK = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11V7a5 5 0 0 1 10 0v4 M5 11h14v10H5z"/></svg>'
function starsHTML(n) { return `<span class="stars" aria-label="별 ${n}개">${[1, 2, 3].map(k => `<i class="${k <= n ? 'on' : ''}">★</i>`).join('')}</span>` }

function questView() {
  const cur = currentStageIndex(), curSt = STAGES[cur], curSc = schoolOf(curSt.school)
  const totalStars = STAGES.reduce((n, s) => n + stageStars(s.id), 0)
  const schools = SCHOOLS.map((s, si) => {
    const first = STAGES.findIndex(x => x.school === s.id)
    const color = `--c:var(--${s.color});--cd:var(--${s.color}-d);--ct:var(--${s.color}-t)`
    if (!stageUnlocked(first)) {
      return `<section class="school locked" style="${color}">
        <div class="schoolhd"><span class="smark">${schoolIcon(s.id)}</span><div><b>${s.name}</b><small>${SCHOOLS[si - 1].name} 졸업 시험을 통과하면 열려요</small></div>${LOCK}</div>
        <div class="reward">보상 미리보기 · ${s.reward}</div></section>`
    }
    const done = s.stages.filter(x => stageStars(x.id)).length
    const grad = done === s.stages.length
    const nodes = s.stages.map((st, k) => {
      const gi = first + k, open = stageUnlocked(gi), stars = stageStars(st.id), here = gi === cur && !grad
      const cls = ['node', st.boss ? 'boss' : '', stars ? 'clear' : open ? 'open' : 'lock', here ? 'here' : ''].join(' ')
      return `<div class="${cls}" style="--x:${Math.round(Math.sin(k * 1.2) * 64)}px">
        ${here ? `<div class="nodemascot">${mascot('mascot', '')}</div>` : ''}
        <button class="nodebtn" data-act="startStage" data-id="${st.id}" ${open ? '' : 'disabled'} aria-label="${s.name} ${st.name}">
          ${open ? (st.boss ? '<span lang="ja">卒</span>' : k + 1) : LOCK}</button>
        <span class="nname">${st.name}</span>${open ? starsHTML(stars) : ''}
      </div>`
    }).join('')
    return `<section class="school${grad ? ' grad' : ''}" style="${color}">
      <div class="schoolhd"><span class="smark">${schoolIcon(s.id)}</span><div><b>${s.name}</b><small>${grad ? '졸업했어요' : `${done} / ${s.stages.length} 통과`}</small></div>
        ${grad ? `<button class="gradbadge" data-act="reportCard" data-school="${s.id}">졸업 · 성적표</button>` : ''}</div>
      <div class="path">${nodes}</div></section>`
  }).join('')
  return `
  <div class="questhead">${mascot('mascot')}<div><span class="lvchip"><b class="num">Lv.${playerLevel()}</b>${rankName()}</span><h1>일본어 학교 퀘스트</h1>
    <p>모은 별 <b class="num">${totalStars}</b> / ${STAGES.length * 3} · 배지 <b class="num">${progress.badges.length}</b> / ${BADGES.length}</p></div></div>
  <div class="questbar"><button class="btn pri" data-act="questContinue">이어서 도전</button><button class="btn" data-act="quizTab" data-tab="free">자유 연습</button></div>
  ${schools}
  <section class="panel catbox">
    <div class="hd">고양이 친구들<span class="num">${CATS.filter(catOpen).length} / ${CATS.length}</span></div>
    <p class="cathint">친구를 누르면 단짝이 돼요 · 단짝은 홈과 퀴즈에서 함께해요</p>
    <div class="cats">${CATS.map(catCard).join('')}</div>
  </section>
  <section class="panel badgebox">
    <div class="hd">배지<span class="num">${progress.badges.length} / ${BADGES.length}</span></div>
    <div class="badges">${BADGES.map(b => badgeHTML(b, progress.badges.includes(b.id))).join('')}</div>
  </section>`
}

// 스테이지 결과 + 졸업장
function stageDoneView() {
  const qz = state.quiz, st = STAGES.find(s => s.id === state.stage), sc = schoolOf(st.school)
  const total = qz.list.length, passed = qz.stars > 0
  const nextIdx = STAGES.indexOf(STAGES.find(s => s.id === st.id)) + 1
  const next = STAGES[nextIdx]
  const diploma = qz.graduated ? `
    <div class="diploma">
      <div class="dtitle" lang="ja">卒業証書</div>
      <div class="dname">졸업장</div>
      <p>위 학생은 ${sc.name} 일본어 과정을<br>모두 마쳤으므로 이 졸업장을 드립니다</p>
      <div class="dfoot"><span>${new Date().toLocaleDateString('ko-KR')}</span><span class="hanko" lang="ja">卒</span></div>
    </div>
    <div class="actions"><button class="btn" data-act="reportCard" data-school="${sc.id}">성적표 저장 · 공유</button></div>` : ''
  const list = qz.missed.length
    ? `<div class="row">틀린 문제 ${qz.missed.length}개는 다음에 다시 나와요</div>${qz.missed.map(q => `<div class="row wrongrow">${q.review}</div>`).join('')}` : ''
  const nextBtn = passed && next
    ? `<button class="btn pri" data-act="startStage" data-id="${next.id}">${qz.graduated ? `${schoolOf(next.school).name} 입학하기` : `다음 · ${next.name}`}</button>`
    : passed ? '' : `<button class="btn pri" data-act="startStage" data-id="${st.id}">다시 도전</button>`
  return `
  <div class="panel">
    <div class="done${passed ? '' : ' fail'}">
      ${qz.right === total ? hanamaruSVG() : ''}
      ${mascot(qz.graduated ? 'party' : passed ? 'cheer' : 'sad')}
      <p>${qz.graduated ? (sc.id === 'high' ? '미묘한 일본어, 졸업' : `${sc.name} 졸업을 축하해요`) : passed ? `${st.name} 통과` : `${stageSize(st)}문제 중 ${passNeed(st)}개 이상 맞히면 통과예요`}</p>
      <div class="bigstars">${[1, 2, 3].map(k => `<i class="${k <= qz.stars ? 'on' : ''}" style="--d:${k * 220}ms">★</i>`).join('')}</div>
      <div class="stats">
        <div class="stat"><b class="num">${qz.right} / ${total}</b><small>맞힌 문제</small></div>
        <div class="stat"><b class="num">+${qz.xp}</b><small>얻은 XP</small></div>
        <div class="stat"><b class="num">${qz.best}</b><small>최고 연속</small></div>
      </div>
    </div>
    ${qz.levelUp ? `<div class="levelup"><span class="lvbig num">Lv.${qz.levelUp}</span><span>레벨 업 · ${rankName()}</span></div>` : ''}
    ${diploma}
    ${qz.graduated && sc.id !== 'high' ? `<div class="newcat grow"><div class="eyebrow">${sc.id === 'elem' ? '중학생이 됐어요' : '고등학생이 됐어요'}</div>
      <img src="${catImage(buddy())}" alt="${buddy().name}" width="400" height="400">
      <b>${buddy().name}도 ${sc.id === 'elem' ? '중학교' : '고등학교'} 교복으로 갈아입었어요</b><small>친구들 모두 함께 자랐어요</small></div>` : ''}
    ${rewardsHTML(qz)}
    ${list}
    <div class="actions">${nextBtn}<button class="btn" data-act="toMap">퀘스트 지도</button></div>
  </div>`
}

// ───── 퀴즈 ─────
function quizHeader() {
  if (['review', 'mock', 'fix', 'place'].includes(state.quizMode)) {
    const H = { review: ['mint', '기억 강도', '오늘 복습', '틀렸던 문제 다시'], mock: ['pink', 'JLPT', `${state.mockLevel} 실력 체크`, '문자 · 문법 30문제'],
      fix: ['sky', '헷갈리는 짝', '오늘의 교정', '빈칸 10문제'], place: ['sun', '월반 시험', '실력 진단', '12문제로 시작 학년 찾기'] }[state.quizMode]
    return `<div class="stagebar" style="--c:var(--${H[0]});--ct:var(--${H[0]}-t)">
      <button class="btn icon-only" data-go="home" aria-label="홈으로">${icon('left')}</button>
      <div class="stagename"><small>${H[1]}</small><b>${H[2]}</b></div>
      <span class="stagegoal">${H[3]}</span></div>`
  }
  if (state.quizMode === 'stage') {
    const st = STAGES.find(s => s.id === state.stage), sc = schoolOf(st.school)
    return `<div class="stagebar" style="--c:var(--${sc.color});--ct:var(--${sc.color}-t)">
      <button class="btn icon-only" data-act="toMap" aria-label="퀘스트 지도로">${icon('left')}</button>
      <div class="stagename"><small>${sc.name}</small><b>${st.name}</b></div>
      <span class="stagegoal">${stageSize(st)}문제 중 ${passNeed(st)}개 이상</span></div>`
  }
  const modes = [['verb', '동사'], ['kanji', '한자'], ['grammar', '문법'], ['talk', '회화'], ['num', '숫자'], ['ono', '의성어']]
    .map(([m, label]) => `<button class="${state.quizMode === m ? 'on' : ''}" data-act="quizMode" data-mode="${m}">${label}</button>`).join('')
  const back = `<button class="btn icon-only" data-act="quizTab" data-tab="quest" aria-label="퀘스트 지도로">${icon('left')}</button>`
  // 한 줄로: [←][동사 | 한자 | 문법] + 동사는 수준, 한자는 학년, 문법은 급수 고르기
  const grades = state.quizMode === 'verb'
    ? `<select class="gradesel" data-act="verbLevelSel" aria-label="동사 수준 고르기">${['all', 'elem', 'mid', 'high'].map(l => { const lock = l !== 'all' && !isOpen('verb', l); return `<option value="${l}" ${state.verbQuizLevel === l ? 'selected' : ''}${lock ? ' disabled' : ''}>${l === 'all' ? '열린 동사 전체' : `${VERB_LEVELS[l]} 동사${lock ? ' (잠김)' : ''}`}</option>` }).join('')}</select>`
    : state.quizMode === 'kanji'
    ? `<select class="gradesel" data-act="quizGradeSel" aria-label="학년 고르기">${[0, ...kanjiGrades()].map(g => { const lock = g > 0 && !isOpen('kanji', g); return `<option value="${g}" ${state.quizGrade === g ? 'selected' : ''}${lock ? ' disabled' : ''}>${g ? (g <= 6 ? `초등 ${g}학년` : g <= 9 ? `중학 ${g - 6}묶음` : gradeLong(g)) + (lock ? ' (잠김)' : '') : '열린 한자 전체'}</option>` }).join('')}</select>`
    : state.quizMode === 'num'
    ? `<select class="gradesel" data-act="numQuizSel" aria-label="묶음 고르기"><option value="all">모든 숫자 읽기</option>${NUMBER_GROUPS.map(g => `<option value="${g.id}" ${state.numQuiz === g.id ? 'selected' : ''}>${g.name}</option>`).join('')}</select>`
    : state.quizMode === 'ono'
    ? `<select class="gradesel" data-act="onoQuizSel" aria-label="분류 고르기"><option value="all">모든 의성어</option>${ONO_CATS.map(c => `<option value="${c}" ${state.onoQuiz === c ? 'selected' : ''}>${c}</option>`).join('')}</select>`
    : state.quizMode === 'talk'
    ? `<select class="gradesel" data-act="talkQuizSel" aria-label="장면 고르기"><option value="all">모든 장면</option>${(typeof TALK === 'undefined' ? [] : TALK).map(s => `<option value="${s.id}" ${state.talkQuiz === s.id ? 'selected' : ''}>${s.name}${progress.talkStamps[s.id] ? ' · 도장' : ''}</option>`).join('')}</select>`
    : state.quizMode === 'grammar'
    ? `<select class="gradesel" data-act="quizLevelSel" aria-label="급수 고르기">${[...LEVELS, 'all', 'saved'].map(l => { const lock = LEVELS.includes(l) && !isOpen('grammar', l); return `<option value="${l}" ${state.quizLevel === l ? 'selected' : ''}${lock ? ' disabled' : ''}>${l === 'all' ? '열린 급수 전체' : l === 'saved' ? `★ 저장한 문법 (${progress.savedGrammar.length})` : l + (lock ? ' (잠김)' : '')}</option>` }).join('')}</select>`
    : ''
  return `<div class="quizbar">${back}<div class="tabs">${modes}</div>${grades}</div>`
}

// 퀴즈 메뉴: 스테이지를 푸는 중이거나 자유 연습이면 문제 화면, 아니면 퀘스트 지도
function quizPage() {
  return SPECIAL.includes(state.quizMode) || state.quizTab === 'free' ? quizView() : questView()
}

// 위쪽 진행 막대 + 연속 정답
function quizTop(qz) {
  const answered = qz.picked !== null && qz.i < qz.list.length
  const pct = Math.min(100, (qz.i + (answered ? 1 : 0)) / qz.list.length * 100)
  return `<div class="qtop"><div class="qbar" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
    <span class="combo${qz.comboPop ? ' pop' : ''}">${qz.combo >= 2 ? `${qz.combo}연속 정답` : `${Math.min(qz.i + 1, qz.list.length)} / ${qz.list.length}`}</span></div>`
}

function quizView() {
  const qz = state.quiz
  if (state.quizMode === 'mock' && state.mockIntro) return quizHeader() + `<div class="panel mockintro">
    <div class="gempty">${mascot('think')}<p><b>${state.mockLevel} 실력 체크</b><br>문자 10 · 문법 15 · 표현 5, 모두 30문제 · 10분쯤 걸려요</p>
    <ul><li>JLPT의 <b>문자·문법</b> 부분만 점검해요. 독해·청해는 들어 있지 않아요</li><li>문제마다 바로 정답을 알려 줘요</li><li>중간에 나가면 이번 점수는 남지 않아요</li></ul>
    <button class="btn pri" data-act="mockGo">시작하기</button></div></div>`
  if (!qz.list.length && state.quizMode === 'review') return quizHeader() + `<div class="panel"><div class="gempty">${mascot('cheer')}<p>오늘 복습할 문제가 없어요<br>틀린 문제는 1일 · 3일 · 7일 뒤에 다시 나와요</p><button class="btn pri" data-go="home">홈으로</button></div></div>`
  if (!qz.list.length) return quizHeader() + `
  <div class="panel"><div class="gempty">${mascot('think')}<p>저장한 문법이 아직 없어요.<br><b>문법</b> 메뉴에서 헷갈리는 문법에 <b>☆ 저장</b>을 눌러 보세요</p>
    <button class="btn pri" data-go="grammar">문법 보러 가기</button></div></div>`
  if (qz.i >= qz.list.length) return quizHeader() + (state.quizMode === 'stage' ? stageDoneView() : quizDoneView())
  const q = qz.list[qz.i]
  const answered = qz.picked !== null
  const ok = answered && q.choices[qz.picked].ok
  const plen = c => [...c.html.replace(/<rt>.*?<\/rt>/g, '').replace(/<[^>]+>/g, '')].length
  const maxLen = Math.max(...q.choices.map(plen))
  const isKo = q.choices.some(c => c.ko)
  const oneCol = isKo ? maxLen > 12 : maxLen > 8
  const fsAll = oneCol ? (isKo ? 16 : 18) : Math.max(15, Math.min(20, Math.floor((isKo ? 160 : 148) / Math.max(maxLen, 1))))
  const buttons = q.choices.map((c, i) => {
    let cls = 'choice'
    if (answered && c.ok) cls += ' ok'
    else if (answered && i === qz.picked) cls += ' miss'
    // 글자 수에 맞춰 크기를 정해 항상 한 줄에 들어가게 한다 (폰 보기 칸 안쪽 폭 약 148px)
    if (oneCol) cls += ' wrap'
    return `<button class="${cls}" data-pick="${i}" style="--fs:${fsAll}px" ${c.ko ? '' : 'lang="ja"'} ${answered ? 'disabled' : ''}>${c.html}${answered && c.ok ? maruSVG() : ''}</button>`
  }).join('')
  // 문장 배열: 아래 조각을 눌러 위 줄에 차례로 놓고, 놓은 조각을 누르면 되돌린다
  let body = `<div class="choices${oneCol ? ' one' : ''}">${buttons}</div>`
  if (q.order) {
    const built = qz.built || (qz.built = [])
    const placed = built.map((pi, k) => `<button class="opiece" data-act="unplace" data-k="${k}" lang="ja" ${answered ? 'disabled' : ''}>${q.order.parts[pi]}</button>`).join('')
    const pool = q.order.mix.map(pi => built.includes(pi) ? `<span class="opiece ghost" aria-hidden="true">${q.order.parts[pi]}</span>`
      : `<button class="opiece" data-act="place" data-p="${pi}" lang="ja" ${answered ? 'disabled' : ''}>${q.order.parts[pi]}</button>`).join('')
    body = `<div class="oline${answered ? (ok ? ' ok' : ' miss') : ''}">${placed || '<span class="ohint">아래 조각을 눌러 여기에 차례로 놓아요</span>'}</div>
      ${answered ? '' : `<div class="opool">${pool}</div>`}
      ${answered ? '' : `<button class="btn pri ocheck" data-act="checkOrder" ${built.length === q.order.parts.length ? '' : 'disabled'}>확인</button>`}`
  }
  const mood = !answered ? 'think' : ok ? 'cheer' : 'sad'
  const say = !answered ? q.prompt : ok ? qz.say : qz.say
  const last = qz.i === qz.list.length - 1
  const sheet = answered ? `
  <div class="feedback ${ok ? 'good' : 'bad'}" role="status">
    <div class="in">
      ${mascot(ok ? 'cheer' : 'sad', 'fmascot')}
      <div class="ftext"><b>${ok ? '정답이에요' : '아쉬워요'}${ok && qz.justMastered ? '<span class="masterpop">★ 마스터</span>' : ''}</b><span>${ok ? (q.right || '') : q.wrong}</span></div>
      <button class="btn pri" data-act="nextQ" id="nextbtn">${last ? '결과 보기' : '계속'}</button>
    </div>
  </div>` : ''
  return quizHeader() + quizTop(qz) + `
  <div class="panel qcard">
    <div class="qhead">${mascot(mood)}<div class="bubble" ${answered ? '' : 'aria-live="polite"'}>${say}</div></div>
    <div class="q">${q.head}</div>
    ${body}
    ${sheet}
  </div>`
}

function quizDoneView() {
  const qz = state.quiz
  const total = qz.list.length
  const perfect = qz.right === total
  const list = qz.missed.length
    ? `<div class="row">틀린 문제 ${qz.missed.length}개는 다음 퀴즈에 다시 나와요</div>
       ${qz.missed.map(q => `<div class="row wrongrow">${q.review}</div>`).join('')}`
    : ''
  return `
  <div class="panel">
    <div class="done">
      ${perfect ? hanamaruSVG() : ''}
      ${mascot(perfect ? 'party' : qz.right >= total * 0.6 ? 'cheer' : 'mascot')}
      <p>${perfect ? '모두 맞혔어요' : qz.right >= total * 0.6 ? '잘했어요' : '한 번 더 해 봐요'}</p>
      <div class="stats">
        <div class="stat"><b class="num">${qz.right} / ${total}</b><small>맞힌 문제</small></div>
        <div class="stat"><b class="num">+${qz.xp}</b><small>얻은 XP</small></div>
        <div class="stat"><b class="num">${qz.best}</b><small>최고 연속</small></div>
      </div>
    </div>
    ${qz.mock ? mockResultHTML(qz.mock) : ''}
    ${qz.place ? placeResultHTML(qz.place) : ''}
    ${qz.newStamp ? `<div class="talkstampwin"><span class="tstamp big" lang="ja">${qz.newStamp.mark}</span><div><b>${qz.newStamp.name} 도장</b><small>장면 도장 ${Object.keys(progress.talkStamps).length} / ${TALK.length}</small></div></div>` : ''}
    ${state.quizMode === 'talk' && state.talkQuiz !== 'all' && !qz.newStamp && !progress.talkStamps[state.talkQuiz] ? `<p class="locknote">10문제 중 8개 이상 맞히면 장면 도장을 받아요</p>` : ''}
    ${rewardsHTML(qz)}
    ${list}
    <div class="actions"><button class="btn pri" data-act="restartQuiz">다시 풀기</button><button class="btn" data-go="home">처음으로</button></div>
  </div>`
}

function pick(i) {
  const qz = state.quiz
  if (qz.picked !== null) return
  const btn = document.querySelector(`[data-pick="${i}"]`)
  const [x, y] = btn ? centerOf(btn) : [innerWidth / 2, innerHeight / 2]
  qz.picked = i
  const q = qz.list[qz.i]
  const m = q.mode || state.quizMode
  const learned = m === 'kanji' ? 'learnedKanji' : m === 'grammar' ? 'learnedGrammar' : m === 'talk' ? 'learnedTalk' : m === 'ono' ? 'learnedOno' : 'learnedForms'
  const wrong = m === 'kanji' ? 'wrongKanji' : m === 'grammar' ? 'wrongGrammar' : m === 'talk' ? 'wrongTalk' : m === 'ono' ? 'wrongOno' : 'wrong'
  const ok = q.choices[i].ok
  markStudy()
  // 기억 강도 복습: 틀리면 내일, 맞히면 3일 → 7일 뒤, 세 번 넘기면 끝
  const rv = progress.review || (progress.review = {})
  if (!ok) rv[q.key] = { step: 0, due: todayStr(1) }
  else if (rv[q.key] && rv[q.key].due <= todayStr()) { const r = rv[q.key]; r.step++; if (r.step >= 3) delete rv[q.key]; else r.due = todayStr(r.step === 1 ? 3 : 7) }
  // 마스터 별: 같은 문법·한자·문장을 3번 연속 맞히면 금별
  const mi = masterItem(q.key), ms = progress.master || (progress.master = {})
  qz.justMastered = false
  if (ok) { const before = ms[mi] || 0; ms[mi] = Math.min(3, before + 1); if (before < 3 && ms[mi] === 3) qz.justMastered = true; todayStats().correct++ }
  else if ((ms[mi] || 0) < 3) ms[mi] = 0
  if (ok) {
    qz.right++
    qz.combo++; qz.best = Math.max(qz.best, qz.combo); qz.comboPop = qz.combo >= 2
    progress.bestCombo = Math.max(progress.bestCombo || 0, qz.combo)
    qz.say = qz.combo >= 3 ? `${qz.combo}연속이에요, 대단해요` : pickOne(CHEERS)
    if (!progress[learned].includes(q.key)) progress[learned].push(q.key)
    progress[wrong] = progress[wrong].filter(k => k !== q.key)
  } else {
    qz.combo = 0; qz.comboPop = false
    qz.say = pickOne(ENCOURAGE)
    qz.missed.push(q)
    if (!progress[wrong].includes(q.key)) progress[wrong].push(q.key)
  }
  saveProgress()
  render()
  if (ok) {
    const gain = qz.combo >= 3 ? 15 : 10
    qz.xp += gain
    ;(qz.combo >= 3 ? SFX.combo : SFX.good)()
    confetti(x, y, qz.combo >= 3 ? 40 : 24)
    addXP(gain, x, y - 20)
  } else {
    SFX.bad()
  }
  const next = document.getElementById('nextbtn')
  if (next) next.focus({ preventScroll: true })
}

// ───── 이벤트 ─────
const VIEWS = { me: meView, home: homeView, kanji: kanjiView, cards: cardsView, conj: conjView, grammar: grammarView, talk: talkView, quiz: quizPage }

function startStage(id) {
  if (state.view !== 'quiz' || !SPECIAL.includes(state.quizMode)) history.pushState({ v: 'quiz' }, '')
  state.stage = id; state.quizMode = 'stage'; state.view = 'quiz'; state.kanji = null
  newQuiz(); render(); window.scrollTo(0, 0)
}

const ACTIONS = {
  prevCard() { state.cardIdx[state.cardType]--; state.kanji = null; state.slide = 'prev'; markSeen(); SFX.tap() },
  nextCard() { state.cardIdx[state.cardType]++; state.kanji = null; state.slide = 'next'; markSeen(); SFX.tap() },
  sound() { toggleSoundPanel(); return true },
  music() { toggleSoundPanel(); return true },
  grammarLevel(btn) { state.grammarLevel = btn.dataset.level; state.grammarOpen = null },
  startStage(btn) { startStage(btn.dataset.id); return true },
  questContinue() { startStage(STAGES[currentStageIndex()].id); return true },
  toMap() { state.quizMode = 'verb'; state.quizTab = 'quest'; state.view = 'quiz'; render(); window.scrollTo(0, 0); return true },
  quizTab(btn) {
    state.quizTab = btn.dataset.tab
    if (state.quizMode === 'stage') state.quizMode = 'verb'
    if (state.quizTab === 'free') newQuiz()
    window.scrollTo(0, 0)
  },
  grammarQuiz() { if (state.grammarLevel !== 'saved' && !isOpen('grammar', state.grammarLevel)) return; state.quizMode = 'grammar'; state.quizLevel = state.grammarLevel; go('quiz'); return true },
  grammarOpen(btn) {
    const id = btn.dataset.id
    state.grammarOpen = state.grammarOpen === id ? null : id
    if (state.grammarOpen) todayStats().grammar++
    if (state.grammarOpen && !progress.seenGrammar.includes(id)) { progress.seenGrammar.push(id); addXP(2) }
    saveProgress()
    SFX.tap()
  },
  grammarJump(btn) {
    const g = GRAMMAR.find(x => x.id === btn.dataset.id)
    if (!g) { SFX.bad(); return true }
    state.grammarLevel = g.level; state.grammarOpen = g.id
    if (!progress.seenGrammar.includes(g.id)) { progress.seenGrammar.push(g.id); addXP(2) }
    render()
    const el = document.querySelector(`[data-act="grammarOpen"][data-id="${g.id}"]`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    SFX.tap()
    return true
  },
  grammarStar(btn) {
    const id = btn.dataset.id, s = progress.savedGrammar
    progress.savedGrammar = s.includes(id) ? s.filter(x => x !== id) : [...s, id]
    saveProgress()
    if (progress.savedGrammar.includes(id)) { const [x, y] = centerOf(btn); confetti(x, y, 10); SFX.good() }
  },
  showConj() { state.verb = state.cardIdx.verb; state.conjMode = 'one'; go('conj'); return true },
  cardType(btn) { state.cardType = btn.dataset.type; state.kanji = null; markSeen() },
  prevVerb() { state.verb-- },
  nextVerb() { state.verb++ },
  nextQ() {
    const qz = state.quiz
    qz.i++; qz.picked = null; qz.comboPop = false; qz.built = []
    window.scrollTo(0, 0)
    if (qz.i >= qz.list.length && !qz.counted) {
      qz.counted = true
      let bonus = 0
      if (state.quizMode === 'stage') {
        // 별: 다 맞히면 3개, 하나 틀리면 2개, 80% 이상이면 1개(통과)
        const total = qz.list.length
        qz.stars = qz.right === total ? 3 : qz.right >= total - 1 ? 2 : qz.right >= Math.ceil(total * PASS / 10) ? 1 : 0
        const st = STAGES.find(s => s.id === state.stage)
        const firstClear = qz.stars > 0 && !stageCleared(st.id)
        if (qz.stars > stageStars(st.id)) progress.stages[st.id] = qz.stars
        const next = STAGES[stageIndex(st.id) + 1]
        if (firstClear && next) qz.unlocked = [{ kind: 'stage', label: `${schoolOf(next.school).name} ${next.name}` }, ...unlocksAt(next.id)]
        if (firstClear) { qz.levelUp = playerLevel(); todayStats().stages++ }
        if (firstClear) qz.newCat = CATS.find(c => c.at === st.id)
        if (qz.stars && st.boss && !progress.graduated.includes(st.school)) { progress.graduated.push(st.school); qz.graduated = true }
        bonus = qz.stars * 10 + (qz.graduated ? 100 : 0)
      }
      if (state.quizMode === 'talk' && state.talkQuiz !== 'all' && qz.right >= Math.ceil(qz.list.length * 0.8) && !progress.talkStamps[state.talkQuiz]) {
        progress.talkStamps[state.talkQuiz] = todayStr(); qz.newStamp = talkScene(state.talkQuiz); bonus += 30
      }
      if (state.quizMode === 'review') todayStats().reviews++
      if (state.quizMode === 'place') qz.place = applyPlacement(qz)
      if (state.quizMode === 'mock') {
        const sc = mockScore(qz); qz.mock = sc
        if (!progress.mock[state.mockLevel] || sc.score > progress.mock[state.mockLevel]) progress.mock[state.mockLevel] = sc.score
        if (sc.pass) bonus += 50
      }
      qz.xp += 20 + bonus
      bumpToday('quizzes')
      qz.newBadges = checkBadges()
      saveProgress()
      render()
      addXP(20 + bonus)
      SFX.done()
      confetti(innerWidth / 2, innerHeight * 0.35, qz.right === qz.list.length ? 70 : 36)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return true
    }
  },
  todayKanji() { const c = dailyKanji(); state.grade = KANJI[c].grade; go('kanji'); openKanjiChar(c); return true },
  grade(btn) { state.grade = Number(btn.dataset.grade); state.kanji = null },
  conjMode(btn) { state.conjMode = btn.dataset.mode },
  quizMode(btn) { state.quizMode = btn.dataset.mode; newQuiz() },
  quizGrade(btn) { state.quizGrade = Number(btn.dataset.grade); newQuiz() },
  restartQuiz() { newQuiz() },
  mockGo() { state.mockIntro = false; window.scrollTo(0, 0) },
  startFix() { history.pushState({ v: 'quiz' }, ''); state.quizMode = 'fix'; state.view = 'quiz'; newQuiz(); render(); window.scrollTo(0, 0); return true },
  startPlace() { history.pushState({ v: 'quiz' }, ''); state.quizMode = 'place'; state.view = 'quiz'; newQuiz(); render(); window.scrollTo(0, 0); return true },
  fixPick(btn) {
    if (state.fixDone) return true
    const c = todayCorrection(); if (!c) return true
    const i = Number(btn.dataset.i), ok = c.opts[i] === c.ans
    state.fixDone = { i, ok }
    markStudy()
    const rv = progress.review || (progress.review = {})
    if (ok) { todayStats().correct++; if (!progress.learnedGrammar.includes(c.key)) progress.learnedGrammar.push(c.key); addXP(10) }
    else { rv[c.key] = { step: 0, due: todayStr(1) }; if (!progress.wrongGrammar.includes(c.key)) progress.wrongGrammar.push(c.key) }
    saveProgress(); ok ? SFX.good() : SFX.bad()
    if (ok) { const [x, y] = centerOf(btn); confetti(x, y, 24) }
  },
  meExport() { exportProgress(); return true },
  meImport() { document.getElementById('importfile')?.click(); return true },
  meReset() {
    if (!confirm('모든 공부 기록을 지울까요?\n별, 고양이 친구, 배지, 복습 기록이 모두 사라지고 되돌릴 수 없어요')) return true
    if (!confirm('정말 지울까요? 먼저 "기록 내보내기"로 저장해 두는 걸 권해요')) return true
    try { localStorage.removeItem(STORE_KEY) } catch { /* 무시 */ }
    location.reload(); return true
  },
  meSound() { toggleSoundPanel(); return true },
  petCat() {
    const b = buddy(), lines = CAT_LINES[b.id] || CAT_LINES.mike
    let say; do { say = pickOne(lines) } while (lines.length > 1 && say === state.catSay)
    state.catSay = say; state.catHop = true
    SFX.tap(); render()
    clearTimeout(state.catHopTimer)
    state.catHopTimer = setTimeout(() => { state.catHop = false; if (state.view === 'home') render() }, 1400)
    return true
  },
  startReview() { history.pushState({ v: 'quiz' }, ''); state.quizMode = 'review'; state.view = 'quiz'; newQuiz(); render(); window.scrollTo(0, 0); return true },
  startMock(btn) { if (!isOpen('grammar', btn.dataset.level)) return true; history.pushState({ v: 'quiz' }, ''); state.mockLevel = btn.dataset.level; state.mockIntro = true; state.quizMode = 'mock'; state.view = 'quiz'; newQuiz(); render(); window.scrollTo(0, 0); return true },
  openChest(btn) {
    const t = todayStats()
    if (t.chest || todayMissions().some(m => m.get(t) < m.need)) return true
    const gain = 30 + Math.floor(Math.random() * 11) * 5
    t.chest = gain; progress.chests = (progress.chests || 0) + 1
    const [x, y] = centerOf(btn)
    confetti(x, y, 60); SFX.done(); addXP(gain, x, y - 30)
    checkBadges(); saveProgress(); render()
    return true
  },
  reportCard(btn) { showReportCard(btn.dataset.school); return true },
  numQuiz() { const w = cardList()[cardIndex()]; state.quizMode = 'num'; state.numQuiz = w ? w.g : 'all'; state.quizTab = 'free'; go('quiz'); return true },
  onoQuiz() { const w = cardList()[cardIndex()]; state.quizMode = 'ono'; state.onoQuiz = w ? w.cat : 'all'; state.quizTab = 'free'; go('quiz'); return true },
  talkOpen(btn) { history.pushState({ v: 'talk', scene: btn.dataset.id }, ''); state.talkScene = btn.dataset.id; todayStats().scenes = (todayStats().scenes || 0) + 1; saveProgress(); SFX.tap(); window.scrollTo(0, 0) },
  talkBack() { history.back(); return true },
  talkCasual() { state.showCasual = !state.showCasual; SFX.tap() },
  talkQuiz() { state.quizMode = 'talk'; state.talkQuiz = state.talkScene || 'all'; state.quizTab = 'free'; go('quiz'); return true },
  place(btn) { const qz = state.quiz; if (qz.picked !== null) return true; qz.built.push(Number(btn.dataset.p)); SFX.tap() },
  unplace(btn) { const qz = state.quiz; if (qz.picked !== null) return true; qz.built.splice(Number(btn.dataset.k), 1); SFX.tap() },
  checkOrder() {
    const qz = state.quiz, q = qz.list[qz.i]
    if (!q || !q.order || qz.built.length !== q.order.parts.length) return true
    pick(qz.built.every((v, i) => v === i) ? 0 : 1)
    return true
  },
  setBuddy(btn) {
    const c = catById(btn.dataset.id)
    if (!catOpen(c)) return true
    progress.buddy = c.id; saveProgress()
    render()
    const card = document.querySelector(`.catcard[data-id="${c.id}"]`) || document.querySelector('.newcat')
    if (card) { const [x, y] = centerOf(card); confetti(x, y, 24) }
    SFX.good()
    return true
  },
  kanjiQuiz() { if (!isOpen('kanji', state.grade)) return; state.quizMode = 'kanji'; state.quizGrade = state.grade; go('quiz'); return true },
  pickCard(el) { state.cardIdx[state.cardType] = Number(el.value); state.kanji = null; markSeen() },
  conjGroup(btn) { state.conjGroup = Number(btn.dataset.group) },
  conjLevel(btn) { state.conjLevel = btn.dataset.level },
}

function openVerb(row) {
  state.verb = Number(row.dataset.verb)
  state.conjMode = 'one'
  render()
  window.scrollTo(0, 0)
}

function openKanjiChar(c) { openKanji({ dataset: { kanji: c } }) }

function openKanji(el) {
  state.kanji = state.kanji === el.dataset.kanji ? null : el.dataset.kanji
  if (state.kanji) {
    for (const ch of state.kanji) {
      if (KANJI[ch] && !progress.seenKanji.includes(ch)) progress.seenKanji.push(ch)
    }
    if (state.grade >= 10 && state.view === 'kanji' && !progress.seenHigh.includes(state.kanji)) progress.seenHigh.push(state.kanji)
    saveProgress()
  }
  render()
  const detail = document.getElementById('kdetail')
  if (detail) detail.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

document.addEventListener('click', e => {
  const goBtn = e.target.closest('[data-go]')
  if (goBtn) {
    if (goBtn.dataset.go === 'cards') { go('cards'); markSeen(); return }
    return go(goBtn.dataset.go)
  }
  const act = e.target.closest('button[data-act]')
  if (act && ACTIONS[act.dataset.act]) { if (!ACTIONS[act.dataset.act](act)) render(); return }
  const choice = e.target.closest('[data-pick]')
  if (choice) return pick(Number(choice.dataset.pick))
  const kj = e.target.closest('[data-kanji]')
  if (kj) return openKanji(kj)
  const vr = e.target.closest('tr[data-verb]')
  if (vr) openVerb(vr)
})

document.addEventListener('keydown', e => {
  // 퀴즈: 1~4 키로 고르기, Enter로 계속
  if (state.view === 'quiz' && state.quiz && state.quiz.i < state.quiz.list.length && !e.target.closest?.('select')) {
    const n = Number(e.key)
    if (state.quiz.picked === null && !state.quiz.list[state.quiz.i].order && n >= 1 && n <= state.quiz.list[state.quiz.i].choices.length) { e.preventDefault(); return pick(n - 1) }
  }
  const vr = e.target.closest && e.target.closest('tr[data-verb]')
  if (vr && e.key === 'Enter') { e.preventDefault(); openVerb(vr); return }
  const kj = e.target.closest && e.target.closest('.masu-group[data-kanji]')
  if (kj && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openKanji(kj) }
})

document.addEventListener('change', e => {
  if (e.target.matches('select[data-act="pickVerb"]')) { state.verb = Number(e.target.value); render() }
  if (e.target.matches('select[data-act="pickCard"]')) { ACTIONS.pickCard(e.target); render() }
  if (e.target.matches('select[data-act="quizGradeSel"]')) { state.quizGrade = Number(e.target.value); newQuiz(); render() }
  if (e.target.matches('select[data-act="quizLevelSel"]')) { state.quizLevel = e.target.value; newQuiz(); render() }
  if (e.target.matches('select[data-act="onoQuizSel"]')) { state.onoQuiz = e.target.value; newQuiz(); render() }
  if (e.target.matches('select[data-act="numQuizSel"]')) { state.numQuiz = e.target.value; newQuiz(); render() }
  if (e.target.matches('select[data-act="talkQuizSel"]')) { state.talkQuiz = e.target.value; newQuiz(); render() }
  if (e.target.matches('select[data-act="verbLevelSel"]')) { state.verbQuizLevel = e.target.value; newQuiz(); render() }
})

// ───── 오프라인 (홈 화면에 추가해서 쓸 때) ─────
let offlineReady = false

// ───── 소리 설정: 배경음악·효과음 음량을 따로 ─────
const VOL_ICON = {
  music: on => ICONS[on ? 'music' : 'musicOff'],
  sfx: on => ICONS[on ? 'sound' : 'mute'],
}
function volNow(kind) { return kind === 'music' ? (progress.music ? progress.musicVol ?? 1 : 0) : (progress.sound ? progress.sfxVol ?? 1 : 0) }
function volRow(kind, label) {
  const v = Math.round(volNow(kind) * 100)
  return `<div class="sp-row" data-kind="${kind}">
    <button class="sp-mute" data-mute="${kind}" aria-label="${label} ${v ? '끄기' : '켜기'}"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${VOL_ICON[kind](v > 0)}"/></svg></button>
    <label class="sp-name" for="vol-${kind}">${label}</label>
    <input id="vol-${kind}" type="range" min="0" max="100" step="5" value="${v}" style="--v:${v}%">
    <span class="sp-val num">${v}</span></div>`
}
function setVol(kind, v, done) {
  const on = v > 0
  if (kind === 'music') { if (on) progress.musicVol = v; progress.music = on }
  else { if (on) progress.sfxVol = v; progress.sound = on }
  updateTop()
  if (!done) return
  saveProgress()
  if (kind === 'music') { if (on) { rebuildBgm(); playBgm() } else stopBgm() }
  else if (on) { buildSfx(); SFX.good() }
}
function toggleSoundPanel() {
  const old = document.getElementById('soundpanel')
  if (old) { old.remove(); return }
  const el = document.createElement('div')
  el.id = 'soundpanel'
  el.className = 'soundpanel'
  el.setAttribute('role', 'dialog')
  el.setAttribute('aria-label', '소리 설정')
  const draw = () => {
    el.innerHTML = `<div class="sp-head"><b>소리 설정</b><button class="sp-close" data-close aria-label="닫기"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12 M18 6 6 18"/></svg></button></div>
      ${volRow('music', '배경음악')}
      ${TRACK_LIST.length > 1 ? `<div class="sp-track">
        <select id="tracksel" aria-label="곡 고르기"><option value="all" ${trackMode() === 'all' ? 'selected' : ''}>모든 곡 섞어 듣기</option>${TRACK_LIST.map(i => `<option value="${i}" ${trackMode() === i ? 'selected' : ''}>${TRACKS[i].name} (한 곡 반복)</option>`).join('')}</select>
        <button class="sp-next" data-skip aria-label="다음 곡"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l9 7-9 7z M18 5v14"/></svg></button></div>
        <p class="sp-now">지금 · <b id="nowplaying">${trackNow >= 0 ? TRACKS[trackNow].name : ''}</b></p>` : ''}
      ${volRow('sfx', '효과음')}
      <p class="sp-note">0으로 내리면 꺼져요 · 전체 크기는 폰 음량 버튼으로</p>`
  }
  draw()
  el.addEventListener('input', e => {
    const r = e.target.closest('input[type=range]'); if (!r) return
    const row = r.closest('.sp-row'), v = Number(r.value)
    row.querySelector('.sp-val').textContent = v
    r.style.setProperty('--v', v + '%')
    setVol(row.dataset.kind, v / 100, false)
    row.querySelector('.sp-mute path').setAttribute('d', VOL_ICON[row.dataset.kind](v > 0))
  })
  el.addEventListener('change', e => {
    if (e.target.id === 'tracksel') { chooseTrack(e.target.value === 'all' ? 'all' : Number(e.target.value)); return }
    const r = e.target.closest('input[type=range]'); if (!r) return
    setVol(r.closest('.sp-row').dataset.kind, Number(r.value) / 100, true)
  })
  el.addEventListener('click', e => {
    e.stopPropagation()
    if (e.target.closest('[data-close]')) { el.remove(); return }
    if (e.target.closest('[data-skip]')) { skipTrack(); SFX.tap(); return }
    const m = e.target.closest('[data-mute]')
    if (m) {
      const kind = m.dataset.mute
      setVol(kind, volNow(kind) > 0 ? 0 : (kind === 'music' ? progress.musicVol : progress.sfxVol) || 0.6, true)
      draw()
    }
  })
  document.body.appendChild(el)
}
// 창 밖을 누르면 닫는다
document.addEventListener('click', e => {
  const p = document.getElementById('soundpanel')
  if (p && !p.contains(e.target) && !e.target.closest('.soundbtn')) p.remove()
}, true)

// ───── 오프닝: 앱을 켤 때 한 번 ─────
// 연습장 칸이 튀어나오고 → 안내선이 그어지고 → 미케가 올라오고 → 日 도장이 쾅 → 제목이 한 글자씩
// 아이폰은 화면을 눌러야 소리가 나므로, "눌러서 시작"을 누를 때 팡파르와 배경음악이 함께 시작된다
function showOpening() {
  try { if (sessionStorage.getItem('opened')) return } catch { /* 저장 못 하면 매번 보여 준다 */ }
  if (progress.openedOn === todayStr()) return   // 하루 첫 실행에만 오프닝
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches
  const s = streak()
  const title = '미묘한 일본어'
  const el = document.createElement('div')
  el.id = 'opening'
  el.setAttribute('role', 'dialog')
  el.setAttribute('aria-label', '미묘한 일본어 시작 화면')
  el.innerHTML = `
    <div class="op-petals" aria-hidden="true">${Array.from({ length: 16 }, (_, i) => `<i style="--l:${(i * 37) % 100}%;--d:${((i * 0.43) % 3).toFixed(2)}s;--t:${5 + (i % 5)}s;--s:${9 + (i % 4) * 3}px;--c:${PETAL_COLORS[i % 3]}"></i>`).join('')}</div>
    <div class="op-cell">
      <div class="op-inner">
        <svg class="op-guide" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 4V96" pathLength="1"/><path d="M4 50H96" pathLength="1"/></svg>
        <img class="op-mascot" src="${catImage(buddy())}" alt="" width="320" height="320">
      </div>
      <span class="op-hanko">${PAW}</span>
    </div>
    <h1 class="op-title">${[...title].map((c, i) => c === ' ' ? '<span class="sp"> </span>' : `<span style="--i:${i}">${c}</span>`).join('')}</h1>
    <p class="op-tag">뜻은 알죠. 읽는 법만 고쳐요</p>
    <p class="op-sub"><span class="lvchip"><b class="num">Lv.${playerLevel()}</b>${rankName()}</span>${s >= 2 ? `<span class="op-streak">${s}일 연속</span>` : ''}</p>
    <div class="op-btns"><button class="btn pri op-start" data-snd="on">소리 켜고 시작</button><button class="btn op-quiet" data-snd="off">조용히 시작</button></div>`
  document.body.appendChild(el)
  document.documentElement.classList.add('opening')
  // 도장이 찍히는 순간 꽃잎이 터진다
  setTimeout(() => { const h = el.querySelector('.op-hanko'); if (h && el.isConnected) { const [x, y] = centerOf(h); confetti(x, y, 30) } }, reduce ? 0 : 1080)
  const close = e => {
    if (el.classList.contains('out')) return
    const b = e && e.target && e.target.closest ? e.target.closest('[data-snd]') : null
    if (b) { const on = b.dataset.snd === 'on'; progress.music = on; progress.sound = on; if (on) { buildSfx(); playBgm() } else stopBgm(); updateTop() }
    progress.openedOn = todayStr(); saveProgress()
    el.classList.add('out')
    SFX.open()
    try { sessionStorage.setItem('opened', '1') } catch { /* 무시 */ }
    confetti(innerWidth / 2, innerHeight * 0.45, 46)
    setTimeout(() => { el.remove(); document.documentElement.classList.remove('opening') }, 560)
  }
  el.addEventListener('click', close)
  el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); close() } })
  el.querySelector('.op-start').focus({ preventScroll: true })
}

// 예전 기록으로 이미 딴 배지는 조용히 채워 둔다
checkBadges(); saveProgress()

// 화면을 먼저 그린다. 오프라인 준비가 실패해도 앱은 열려야 한다.
render()
showOpening()

// claude.ai 미리보기처럼 막힌 곳에서는 serviceWorker를 읽기만 해도 오류가 나므로 전부 try 안에서 한다
try {
  if (window.isSecureContext && /^https:|^http:\/\/localhost/.test(location.href) && !window.APP_IMAGES) {
    navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(() => {
      offlineReady = true
      if (state.view === 'home') render()
    }).catch(() => {})
  }
} catch { /* 서비스 워커를 쓸 수 없는 곳 */ }
