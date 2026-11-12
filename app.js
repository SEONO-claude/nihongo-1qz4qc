// ───── 진도 저장 (localStorage) ─────
const STORE_KEY = 'jp-study-progress'
const EMPTY = { seen: {}, seenKanji: [], learnedForms: [], wrong: [], learnedKanji: [], wrongKanji: [], lastStudy: '', studyDays: [], today: { date: '', cards: 0, quizzes: 0, xp: 0 }, xp: 0, sound: true, savedGrammar: [], seenGrammar: [] }

function loadProgress() {
  try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}') } }
  catch { return { ...EMPTY } }
}
function todayStr(offset = 0) {
  const d = new Date(); d.setDate(d.getDate() + offset)
  return d.toLocaleDateString('sv-SE')   // 내 기기 날짜, "2026-11-12" 모양
}
function saveProgress() {
  progress.lastStudy = todayStr()
  if (!progress.studyDays.includes(progress.lastStudy)) {
    progress.studyDays = [...progress.studyDays, progress.lastStudy].slice(-90)
    state.stampedNow = true   // 오늘 도장이 방금 찍힘 → 홈에서 "쾅" 하고 보여 준다
  }
  try { localStorage.setItem(STORE_KEY, JSON.stringify(progress)) } catch { /* 저장이 막힌 브라우저 */ }
}
const progress = loadProgress()

// 오늘 한 공부 (날짜가 바뀌면 0부터)
function todayStats() {
  if (progress.today.date !== todayStr()) progress.today = { date: todayStr(), cards: 0, quizzes: 0, xp: 0 }
  if (progress.today.xp === undefined) progress.today.xp = 0
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

// ───── 효과음 (기기 안에서 바로 만듦, 인터넷 필요 없음) ─────
let audioCtx = null
// 아이폰: 무음 모드에서도 앱 효과음이 나게 'playback'으로 설정 (효과음 버튼으로 끌 수 있음).
// 아이폰은 사용자가 화면을 처음 누를 때 소리를 켜 줘야 해서, 첫 터치에 소리 없는 소리를 한 번 낸다.
function audio() {
  if (!audioCtx) {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback' } catch { /* 지원 안 함 */ }
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  if (audioCtx.state !== 'running') audioCtx.resume().catch(() => {})
  return audioCtx
}
function unlockAudio() {
  if (!progress.sound) return
  try {
    const c = audio(), b = c.createBuffer(1, 1, 22050), s = c.createBufferSource()
    s.buffer = b; s.connect(c.destination); s.start(0)
  } catch { /* 소리를 낼 수 없는 기기 */ }
}
for (const ev of ['touchend', 'pointerdown', 'keydown']) document.addEventListener(ev, unlockAudio, { once: true, passive: true, capture: true })

function tone(freqs, { dur = 0.13, type = 'triangle', gap = 0.09, vol = 0.16 } = {}) {
  if (!progress.sound) return
  try {
    audio()
    const t0 = audioCtx.currentTime + 0.02
    freqs.forEach((f, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain()
      const s = t0 + i * gap
      o.type = type; o.frequency.setValueAtTime(f, s)
      g.gain.setValueAtTime(0.0001, s)
      g.gain.exponentialRampToValueAtTime(vol, s + 0.012)
      g.gain.exponentialRampToValueAtTime(0.0001, s + dur)
      o.connect(g); g.connect(audioCtx.destination)
      o.start(s); o.stop(s + dur + 0.03)
    })
  } catch { /* 소리를 낼 수 없는 기기 */ }
}
const SFX = {
  good: () => tone([659, 988], { gap: 0.08 }),
  combo: () => tone([659, 880, 1175], { gap: 0.07 }),
  bad: () => tone([247, 196], { type: 'sine', gap: 0.12, dur: 0.2, vol: 0.14 }),
  done: () => tone([523, 659, 784, 1047, 1319], { gap: 0.09, dur: 0.2 }),
  tap: () => tone([523], { dur: 0.05, vol: 0.05, type: 'sine' }),
  stamp: () => tone([110, 82], { type: 'sine', gap: 0.05, dur: 0.18, vol: 0.25 }),
}

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
  const n = KANJI_ORDER.length
  return KANJI_ORDER[((d % n) + n) % n]
}

// 그림: 앱에서는 images/ 파일, 한 파일로 묶은 페이지에서는 미리 넣어 둔 데이터
const IMAGES = window.APP_IMAGES || {
  home: 'images/home.webp', kanji: 'images/kanji.webp', quiz: 'images/quiz.webp',
  mascot: 'images/mascot.webp', think: 'images/mascot-think.webp', cheer: 'images/mascot-cheer.webp',
  sad: 'images/mascot-sad.webp', party: 'images/mascot-party.webp',
}
// 미케 그림 (포즈가 없으면 기본 모습)
function mascot(mood = 'mascot', cls = 'mascot') {
  const src = IMAGES[mood] || IMAGES.mascot
  return src ? `<img class="${cls}" src="${src}" alt="미케" width="320" height="320">` : ''
}
const CHEERS = ['정답이에요', '잘했어요', '완벽해요', '좋아요, 그대로 가요', '역시 미케 친구']
const ENCOURAGE = ['괜찮아요, 다음엔 맞힐 거예요', '아깝다, 한 번 더 봐요', '틀려도 괜찮아요', '이제 기억했죠']
const pickOne = list => list[Math.floor(Math.random() * list.length)]

// ───── 공통 ─────
const app = document.getElementById('app')
const state = { view: 'home', cardType: 'verb', cardIdx: { verb: 0, adj: 0, noun: 0 }, verb: 0, kanji: null, quiz: null, grade: 1, conjMode: 'one', conjGroup: 0, quizMode: 'verb', quizGrade: 0, grammarLevel: 'N5', grammarOpen: null }

function newQuiz() {
  const list = state.quizMode === 'kanji'
    ? buildKanjiQuiz(state.quizGrade, progress.wrongKanji)
    : buildVerbQuiz(progress.wrong)
  state.quiz = { list, i: 0, picked: null, right: 0, missed: [], combo: 0, best: 0, xp: 0 }
}

// lucide 아이콘 (16px, 선 1.5)
const ICONS = {
  left: 'm15 18-6-6 6-6', right: 'm9 18 6-6-6-6',
  sound: 'M11 5 6 9H2v6h4l5 4V5Z M15.5 8.5a5 5 0 0 1 0 7 M19 5a10 10 0 0 1 0 14',
  mute: 'M11 5 6 9H2v6h4l5 4V5Z M22 9l-6 6 M16 9l6 6',
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
    const tap = clickable && reading
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

function go(view) {
  state.view = view
  state.kanji = null
  if (view === 'quiz') newQuiz()
  render()
  window.scrollTo(0, 0)
}

function render() {
  document.querySelectorAll('.top nav button').forEach(b => b.classList.toggle('on', b.dataset.go === state.view))
  app.classList.toggle('wide', state.view === 'conj' && state.conjMode === 'all')
  app.classList.toggle('homewide', state.view === 'home')
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
    s.setAttribute('aria-label', progress.sound ? '효과음 끄기' : '효과음 켜기')
  }
}

function bar(label, done, total) {
  return `<div class="row prog"><div class="label">${label}<span class="num">${done} / ${total}</span></div>
    <div class="bar"><i style="width:${done / total * 100}%"></i></div></div>`
}

// ───── 홈 (진도) ─────
function homeView() {
  const formTotal = WORDS.length * FORMS.length
  const g1 = progress.seenKanji.filter(c => KANJI[c] && KANJI[c].grade === 1).length
  const allK = progress.seenKanji.filter(c => KANJI[c]).length
  const totalK = Object.keys(KANJI).length
  const date = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
  const wrong = progress.wrong.length + progress.wrongKanji.length
  const kanjiQ = Object.values(KANJI).reduce((n, k) => n + 1 + k.examples.length, 0)
  const weekday = new Date().toLocaleDateString('ko-KR', { weekday: 'long' })
  const t = todayStats(), s = streak(), studiedToday = progress.studyDays.includes(todayStr())
  const lead = s >= 2 ? `${s}일째 이어서 공부하고 있어요` : studiedToday ? '오늘 도장을 찍었어요' : '오늘 첫 도장을 찍어 보세요'

  // 오늘의 한자
  const dk = dailyKanji(), k = KANJI[dk], [ew, er, em] = k.examples[0]
  const todayKanji = `
  <button class="panel daily" data-act="todayKanji" aria-label="오늘의 한자 ${dk} 자세히">
    <span class="eyebrow">오늘의 한자 <span class="num">· 초등 ${k.grade}학년</span></span>
    <span class="daily-body">
      <span class="masu xl" lang="ja">${dk}</span>
      <span class="daily-text">
        <span class="kname">${k.meaning}</span>
        <span class="dim" lang="ja">${readingsText(k)}</span>
        <span class="daily-ex"><span lang="ja"><ruby>${ew}<rt>${er}</rt></ruby></span> ${em}</span>
      </span>
    </span>
  </button>`

  // 공부 도장 카드: 최근 14일
  const days = new Set(progress.studyDays)
  const cells = Array.from({ length: 14 }, (_, n) => {
    const day = todayStr(n - 13), d = new Date(day)
    const stamped = days.has(day), isToday = n === 13
    return `<span class="stampcell${isToday ? ' today' : ''}" title="${day}">
      <span class="stampday num">${d.getDate()}</span>
      ${stamped ? `<span class="stamp${isToday && state.stampedNow ? ' new' : ''}" lang="ja" style="--r:${((d.getDate() * 37) % 21) - 10}deg">済</span>` : ''}
    </span>`
  }).join('')
  const stampCard = `
  <div class="panel stampcard">
    <div class="eyebrow">공부 도장 <span class="num">· 연속 ${s}일</span></div>
    <div class="stampgrid">${cells}</div>
    <div class="hint">카드를 보거나 퀴즈를 풀면 그날 도장이 찍혀요</div>
  </div>`

  // 오늘의 목표
  const check = '<svg class="check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" pathLength="1"/></svg>'
  const goal = (label, n, max, c) => `<div class="goal${n >= max ? ' done' : ''}" style="--c:${c}">
    <span>${label}${n >= max ? check : ''}</span><span class="num">${Math.min(n, max)} / ${max}</span>
    <div class="bar"><i style="width:${Math.min(n, max) / max * 100}%"></i></div></div>`
  const hello = t.xp > 0 ? `오늘 ${t.xp} XP 모았어요` : s >= 2 ? `${s}일 연속이에요` : '같이 공부해요'

  return `
  <section class="hero">
    <img class="hero-img" src="${IMAGES.home}" alt="화창한 아침 교실, 창밖의 벚꽃과 책상 위의 한자 연습장" width="1600" height="905" fetchpriority="high">
    <div class="hero-mascot">${mascot('mascot', '')}<span class="says">${hello}</span></div>
    <div class="hero-text">
      <span class="hero-date">${date} ${weekday}</span>
      <h1>오늘의 공부</h1>
      <p>${lead}</p>
      <div class="hero-actions">
        <button class="btn pri" data-go="quiz">퀴즈 시작</button>
        <button class="btn" data-go="cards">단어 카드</button>
      </div>
    </div>
  </section>
  <div class="homegrid">${todayKanji}${stampCard}</div>
  <div class="panel goals">
    <div class="eyebrow">오늘의 목표</div>
    ${goal('단어 카드 보기', t.cards, GOAL.cards, 'var(--sky)')}
    ${goal('퀴즈 한 번 끝내기', t.quizzes, GOAL.quizzes, 'var(--sun)')}
  </div>
  <div class="panel">
    <div class="hd">지금까지</div>
    ${bar('초등 한자 전체', allK, totalK)}
    ${bar('1학년 한자', g1, GRADE1_ORDER.length)}
    ${bar('동사 카드', seenCount('verb'), WORDS.length)}
    ${bar('형용사 카드', seenCount('adj'), ADJECTIVES.length)}
    ${bar('명사 카드', seenCount('noun'), NOUNS.length)}
    ${bar('맞힌 동사 형태', progress.learnedForms.length, formTotal)}
    ${bar('맞힌 한자 문제', progress.learnedKanji.length, kanjiQ)}
    ${bar('본 JLPT 문법', progress.seenGrammar.filter(id => GRAMMAR.some(g => g.id === id)).length, GRAMMAR.length)}
    <div class="row"><div class="label">다시 볼 문제<span class="num${wrong ? ' key' : ''}">${wrong}개</span></div></div>
  </div>
  ${offlineReady ? '<p class="sub offline">인터넷 없이도 열 수 있어요</p>' : ''}`
}

// ───── 학년별 한자 ─────
function kanjiList(grade) {
  if (grade === 1) return [...GRADE1_ORDER]
  return Object.keys(KANJI).filter(c => KANJI[c].grade === grade)
}

function kanjiView() {
  const grades = [...new Set(Object.values(KANJI).map(k => k.grade))].sort((a, b) => a - b)
  const list = kanjiList(state.grade)
  const seen = list.filter(c => progress.seenKanji.includes(c)).length
  const tabs = grades.map(g => `<button class="${g === state.grade ? 'on' : ''}" data-act="grade" data-grade="${g}">${g}학년</button>`).join('')
  const sub =`${state.grade}학년 한자 ${list.length}자 · 본 한자 <span class="num">${seen} / ${list.length}</span>`
  const cells = list.map(c => {
    const cls = ['masu', 'kcell', progress.seenKanji.includes(c) ? 'seen' : '', state.kanji === c ? 'on' : ''].join(' ')
    return `<button class="${cls}" data-kanji="${c}" lang="ja" title="${KANJI[c].meaning}">${c}</button>`
  }).join('')
  const seenAll = progress.seenKanji.filter(c => KANJI[c]).length
  return `
  <section class="banner">
    <img src="${IMAGES.kanji}" alt="벚꽃 핀 학교 가는 길, 돌담 위의 빨간 란도셀" width="1680" height="720">
    <div class="banner-text"><h1>초등 필수 한자</h1><p><span class="num">${seenAll} / ${Object.keys(KANJI).length}</span>자를 봤어요</p></div>
  </section>
  <div class="tabs">${tabs}</div>
  <div class="subbar"><p class="sub">${sub}</p><button class="btn" data-act="kanjiQuiz">${state.grade}학년 한자 퀴즈</button></div>
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
        <div class="kname">${k.meaning}<span class="grade">초등 ${k.grade}학년</span></div>
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
const CARD_TYPES = {
  verb: { label: '동사', list: WORDS, prefix: '' },
  adj: { label: '형용사', list: ADJECTIVES, prefix: 'a:' },
  noun: { label: '명사', list: NOUN_LIST, prefix: 'n:' },
}
function cardList() { return CARD_TYPES[state.cardType].list }
function cardIndex() { return state.cardIdx[state.cardType] }
function seenKey(type, id) { return CARD_TYPES[type].prefix + id }
function seenCount(type) { return CARD_TYPES[type].list.filter(x => progress.seen[seenKey(type, x.id)]).length }

function optionText(x) {
  return `${x.kanji}${x.kanji !== x.reading ? ` (${x.reading})` : ''} · ${x.meaning}`
}
function verbOptions(selected) {
  return WORDS.map((x, i) => `<option value="${i}" ${i === selected ? 'selected' : ''}>${optionText(x)}</option>`).join('')
}
function cardOptions() {
  const list = cardList(), sel = cardIndex()
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
  const tabs = Object.entries(CARD_TYPES).map(([t, c]) => `<button class="${t === type ? 'on' : ''}" data-act="cardType" data-type="${t}">${c.label}<span class="num">${c.list.length}</span></button>`).join('')
  const sub = type === 'verb' ? GROUP_LABEL[w.group] : type === 'adj' ? ADJ_LABEL[w.type] : w.cat
  const hasKanji = w.ruby.some(p => p[1])
  const hint = [w.note ? w.note.replace(/\.$/, '') : '', hasKanji ? '한자를 누르면 음독과 훈독이 나와요' : ''].filter(Boolean).join(' · ')
  return `
  <div class="tabs cardtabs">${tabs}</div>
  <div class="picker">
    <select data-act="pickCard" aria-label="${CARD_TYPES[type].label} 고르기">${cardOptions()}</select>
  </div>
  <div class="panel">
    <div class="hd">${CARD_TYPES[type].label} 카드<span class="num">${i + 1} / ${list.length}</span></div>
    <div class="stage${state.slide ? ' slide-' + state.slide : ''}">${masuRow(w.ruby, { clickable: true, size: cardSize(w.kanji) })}</div>
    <div class="mean">${w.meaning}<span>${sub}</span></div>
    ${hint ? `<div class="hint">${hint}</div>` : ''}
    ${type === 'adj' ? adjTable(w) : ''}
    ${state.kanji ? kanjiInfo(state.kanji) : ''}
    <div class="actions">
      <button class="btn" data-act="prevCard" ${i === 0 ? 'disabled' : ''}>${icon('left')}이전</button>
      ${type === 'verb' ? '<button class="btn" data-act="showConj">변화표 보기</button>' : ''}
      <button class="btn pri" data-act="nextCard" ${i === list.length - 1 ? 'disabled' : ''}>다음${icon('right')}</button>
    </div>
  </div>`
}

function markSeen() {
  const w = cardList()[cardIndex()]
  const key = seenKey(state.cardType, w.id)
  progress.seen[key] = (progress.seen[key] || 0) + 1
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
  const counts = [0, 1, 2, 3].map(g => g ? WORDS.filter(w => w.group === g).length : WORDS.length)
  const filters = [0, 1, 2, 3].map(g => `<button class="${state.conjGroup === g ? 'on' : ''}" data-act="conjGroup" data-group="${g}">${g ? `${g}그룹` : '전체'}<span class="num">${counts[g]}</span></button>`).join('')
  const form = (w, f) => `<td lang="ja">${rubyHTML(masuStem(w))}<span class="end">${ENDINGS[f]}</span></td>`
  const rows = WORDS.map((w, i) => ({ w, i })).filter(({ w }) => !state.conjGroup || w.group === state.conjGroup)
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
    <button class="btn icon-only" data-act="nextVerb" aria-label="다음 동사" ${state.verb === WORDS.length - 1 ? 'disabled' : ''}>${icon('right')}</button>
  </div>
  <div class="panel">
    <div class="verbhead">${masuRow(w.ruby, { size: 'sm' })}<div><div class="vmean">${w.meaning}</div><div class="vgroup">${GROUP_LABEL[w.group]}</div></div></div>
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
  const list = lv === 'saved' ? GRAMMAR.filter(g => saved.includes(g.id)) : GRAMMAR.filter(g => g.level === lv)
  const seen = list.filter(g => progress.seenGrammar.includes(g.id)).length
  const items = list.map(g => {
    const open = state.grammarOpen === g.id, star = saved.includes(g.id)
    return `<div class="gitem${open ? ' open' : ''}${progress.seenGrammar.includes(g.id) ? ' seen' : ''}">
      <button class="ghead" data-act="grammarOpen" data-id="${g.id}" aria-expanded="${open}">
        <span class="gpattern" lang="ja">${furi(g.pattern)}</span>
        <span class="gmean">${g.meaning}</span>
        ${lv === 'saved' ? `<span class="glevel">${g.level}</span>` : ''}
      </button>
      ${open ? `<div class="gbody">
        <div class="gconnect"><b>접속</b>${g.connect}</div>
        <p class="gexplain">${g.explain}</p>
        ${g.examples.map(e => `<div class="gex"><span class="jp" lang="ja">${furi(e.jp)}</span><span class="ko">${e.ko}</span></div>`).join('')}
        <button class="btn gstar${star ? ' on' : ''}" data-act="grammarStar" data-id="${g.id}">${star ? '★ 저장됨' : '☆ 헷갈려요, 저장'}</button>
      </div>` : ''}
    </div>`
  }).join('')
  const empty = lv === 'saved' && !list.length
    ? `<div class="gempty">${mascot('think')}<p>헷갈리는 문법에서 <b>☆ 저장</b>을 누르면 여기에 모여요</p></div>` : ''
  return `
  <div class="ghero">${mascot('mascot')}<div><h1>JLPT 문법</h1><p>N5 기초부터 N1 핵심까지 · 헷갈리는 건 저장해 두고 다시 봐요</p></div></div>
  <div class="tabs gtabs">${tabs}</div>
  ${lv !== 'saved' && list.length ? `<p class="sub">${lv} 문법 ${list.length}개 · 본 문법 <span class="num">${seen} / ${list.length}</span></p>` : ''}
  <div class="panel glist">${items}${empty}</div>`
}

// ───── 퀴즈 ─────
function quizHeader() {
  const modes = [['verb', '동사 변화'], ['kanji', '한자']]
    .map(([m, label]) => `<button class="${state.quizMode === m ? 'on' : ''}" data-act="quizMode" data-mode="${m}">${label}</button>`).join('')
  // 한 줄로: [동사 변화 | 한자] + 한자일 때 학년 고르기
  const grades = state.quizMode === 'kanji'
    ? `<select class="gradesel" data-act="quizGradeSel" aria-label="학년 고르기">${[0, 1, 2, 3, 4, 5, 6].map(g => `<option value="${g}" ${state.quizGrade === g ? 'selected' : ''}>${g ? `${g}학년` : '전체 학년'}</option>`).join('')}</select>`
    : ''
  return `<div class="quizbar"><div class="tabs">${modes}</div>${grades}</div>`
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
  if (qz.i >= qz.list.length) return quizHeader() + quizDoneView()
  const q = qz.list[qz.i]
  const answered = qz.picked !== null
  const ok = answered && q.choices[qz.picked].ok
  const buttons = q.choices.map((c, i) => {
    let cls = 'choice'
    if (answered && c.ok) cls += ' ok'
    else if (answered && i === qz.picked) cls += ' miss'
    // 긴 보기(気をつけませんでした 등)는 글자를 줄여 한 줄에 넣는다
    const len = c.html.replace(/<rt>.*?<\/rt>/g, '').replace(/<[^>]+>/g, '').length
    if (len >= 9) cls += ' long'
    if (len >= 11) cls += ' xlong'
    return `<button class="${cls}" data-pick="${i}" ${c.ko ? '' : 'lang="ja"'} ${answered ? 'disabled' : ''}>${c.html}${answered && c.ok ? maruSVG() : ''}</button>`
  }).join('')
  const mood = !answered ? 'think' : ok ? 'cheer' : 'sad'
  const say = !answered ? q.prompt : ok ? qz.say : qz.say
  const last = qz.i === qz.list.length - 1
  const sheet = answered ? `
  <div class="feedback ${ok ? 'good' : 'bad'}" role="status">
    <div class="in">
      ${mascot(ok ? 'cheer' : 'sad', 'fmascot')}
      <div class="ftext"><b>${ok ? '정답이에요' : '아쉬워요 · 다시 볼 문제에 넣었어요'}</b><span>${ok ? (q.right || '') : q.wrong}</span></div>
      <button class="btn pri" data-act="nextQ" id="nextbtn">${last ? '결과 보기' : '계속'}</button>
    </div>
  </div>` : ''
  return quizHeader() + quizTop(qz) + `
  <div class="panel qcard">
    <div class="qhead">${mascot(mood)}<div class="bubble" ${answered ? '' : 'aria-live="polite"'}>${say}</div></div>
    <div class="q">${q.head}</div>
    <div class="choices">${buttons}</div>
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
  const kanji = state.quizMode === 'kanji'
  const learned = kanji ? 'learnedKanji' : 'learnedForms'
  const wrong = kanji ? 'wrongKanji' : 'wrong'
  const ok = q.choices[i].ok
  if (ok) {
    qz.right++
    qz.combo++; qz.best = Math.max(qz.best, qz.combo); qz.comboPop = qz.combo >= 2
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
const VIEWS = { home: homeView, kanji: kanjiView, cards: cardsView, conj: conjView, grammar: grammarView, quiz: quizView }

const ACTIONS = {
  prevCard() { state.cardIdx[state.cardType]--; state.kanji = null; state.slide = 'prev'; markSeen(); SFX.tap() },
  nextCard() { state.cardIdx[state.cardType]++; state.kanji = null; state.slide = 'next'; markSeen(); SFX.tap() },
  sound() { progress.sound = !progress.sound; saveProgress(); updateTop(); SFX.tap(); return true },
  grammarLevel(btn) { state.grammarLevel = btn.dataset.level; state.grammarOpen = null },
  grammarOpen(btn) {
    const id = btn.dataset.id
    state.grammarOpen = state.grammarOpen === id ? null : id
    if (state.grammarOpen && !progress.seenGrammar.includes(id)) { progress.seenGrammar.push(id); addXP(2) }
    SFX.tap()
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
    qz.i++; qz.picked = null; qz.comboPop = false
    window.scrollTo(0, 0)
    if (qz.i >= qz.list.length && !qz.counted) {
      qz.counted = true
      qz.xp += 20
      bumpToday('quizzes')
      render()
      addXP(20)
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
  kanjiQuiz() { state.quizMode = 'kanji'; state.quizGrade = state.grade; go('quiz'); return true },
  pickCard(el) { state.cardIdx[state.cardType] = Number(el.value); state.kanji = null; markSeen() },
  conjGroup(btn) { state.conjGroup = Number(btn.dataset.group) },
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
    if (state.quiz.picked === null && n >= 1 && n <= state.quiz.list[state.quiz.i].choices.length) { e.preventDefault(); return pick(n - 1) }
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
})

// ───── 오프라인 (홈 화면에 추가해서 쓸 때) ─────
let offlineReady = false

// 화면을 먼저 그린다. 오프라인 준비가 실패해도 앱은 열려야 한다.
render()

// claude.ai 미리보기처럼 막힌 곳에서는 serviceWorker를 읽기만 해도 오류가 나므로 전부 try 안에서 한다
try {
  if (window.isSecureContext && /^https:|^http:\/\/localhost/.test(location.href) && !window.APP_IMAGES) {
    navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(() => {
      offlineReady = true
      if (state.view === 'home') render()
    }).catch(() => {})
  }
} catch { /* 서비스 워커를 쓸 수 없는 곳 */ }
