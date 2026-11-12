// 퀴즈: 10문제. 지난번에 틀린 문제가 먼저 나온다.
// 문제 모양 (두 종류 공통):
//   { key, head: 위에 보여줄 HTML, prompt: 질문, choices: [{ html, ok }], right: 맞혔을 때 한마디, wrong: 틀렸을 때 설명, review: 결과 화면 한 줄 }
const QUIZ_SIZE = 10

function shuffle(list) {
  const a = list.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function wordById(id) { return WORDS.find(w => w.id === id) }

// 레벨링(level.js)이 있으면 잠긴 내용은 '전체' 퀴즈에서 뺀다
function opened(kind, key) { return typeof isOpen !== 'function' || isOpen(kind, key) }

// 틀린 문제 먼저, 나머지는 무작위로 채운다
function pickKeys(wrongKeys, allKeys) {
  const valid = new Set(allKeys)
  const keys = shuffle(wrongKeys.filter(k => valid.has(k))).slice(0, QUIZ_SIZE)
  for (const k of shuffle(allKeys)) {
    if (keys.length >= QUIZ_SIZE) break
    if (!keys.includes(k)) keys.push(k)
  }
  return shuffle(keys)
}

// ───── 동사 변화 퀴즈 ─────
function makeVerbQuestion(key) {
  const [id, form] = key.split(':')
  const word = wordById(id)
  // 현재 긍정이면 절반은 "먹을 겁니다"(미래)로 묻는다
  const future = form === 'present' && Math.random() < 0.5
  const prompt = future ? word.fut : word.ko[FORMS.indexOf(form)]

  const answer = conjugate(word, form)
  const others = shuffle(FORMS.filter(f => f !== form)).slice(0, 2).map(f => conjugate(word, f))
  const mistake = commonMistake(word, form)
  const seen = new Set(), choices = []
  for (const c of [answer, ...others, mistake]) {
    if (!seen.has(c.kanji)) { seen.add(c.kanji); choices.push({ html: rubyHTML(c.pairs), ok: c === answer }) }
  }
  const futureTip = future ? '미래(“~할 겁니다”)도 ます형을 그대로 써요' : ''
  return {
    key,
    head: masuRow(word.ruby, { size: 'sm' }),
    prompt: `“${prompt}”는`,
    choices: shuffle(choices),
    right: futureTip,
    wrong: [ruleText(word, form).replace(/\.$/, ''), futureTip].filter(Boolean).join(' · '),
    review: `<span class="jp" lang="ja">${rubyHTML(answer.pairs)}</span><span class="dim">${prompt}</span>`,
  }
}

// 동사 수준: elem 초등, mid 중학, high 고등
const VERB_LEVELS = { elem: '초등', mid: '중학', high: '고등' }
function verbLevel(w) { return w.level || 'elem' }
function verbKeys(level) {
  return WORDS.filter(w => level === 'all' ? opened('verb', verbLevel(w)) : verbLevel(w) === level).flatMap(w => FORMS.map(f => `${w.id}:${f}`))
}
function buildVerbQuiz(wrongKeys, level = 'all') {
  return pickKeys(wrongKeys, verbKeys(level)).map(makeVerbQuestion)
}

// ───── 퀘스트: 초등학교 → 중학교 → 고등학교 ─────
// 스테이지마다 10문제를 여러 종류에서 섞어 낸다. part: { t: 'kanji'|'verb'|'grammar', n, ... }
const SCHOOLS = [
  { id: 'elem', name: '초등학교', mark: '小', color: 'pink', reward: '졸업장 · 중학 한자 1110자 · 중학 동사 · N4 문법',
    stages: [
      { id: 'e1', name: '1학년', parts: [{ t: 'kanji', grades: [1], n: 5 }, { t: 'num', groups: ['tsu', 'nin'], n: 2 }, { t: 'verb', level: 'elem', n: 1 }, { t: 'grammar', levels: ['N5'], n: 2 }] },
      { id: 'e2', name: '2학년', parts: [{ t: 'kanji', grades: [2], n: 4 }, { t: 'num', groups: ['ka'], n: 2 }, { t: 'verb', level: 'elem', n: 2 }, { t: 'grammar', levels: ['N5'], n: 2 }] },
      { id: 'e3', name: '3학년', parts: [{ t: 'kanji', grades: [3], n: 4 }, { t: 'num', groups: ['gatsu', 'ji'], n: 2 }, { t: 'verb', level: 'elem', n: 2 }, { t: 'grammar', levels: ['N5'], n: 2 }] },
      { id: 'e4', name: '4학년', parts: [{ t: 'kanji', grades: [4], n: 3 }, { t: 'num', groups: ['hon', 'hiki'], n: 2 }, { t: 'verb', level: 'elem', n: 2 }, { t: 'grammar', levels: ['N5'], n: 3 }] },
      { id: 'e5', name: '5학년', parts: [{ t: 'kanji', grades: [5], n: 3 }, { t: 'num', groups: ['kai', 'big'], n: 2 }, { t: 'verb', level: 'elem', n: 2 }, { t: 'grammar', levels: ['N4'], n: 3 }] },
      { id: 'e6', name: '6학년', parts: [{ t: 'kanji', grades: [6], n: 3 }, { t: 'num', groups: ['etc', 'ka', 'hon'], n: 2 }, { t: 'verb', level: 'elem', n: 2 }, { t: 'grammar', levels: ['N4'], n: 3 }] },
      { id: 'ef', name: '졸업 시험', boss: true, parts: [{ t: 'kanji', grades: [1, 2, 3, 4, 5, 6], n: 7 }, { t: 'num', groups: 'all', n: 4 }, { t: 'verb', level: 'elem', n: 3 }, { t: 'grammar', levels: ['N5', 'N4'], n: 6 }] },
    ] },
  { id: 'mid', name: '중학교', mark: '中', color: 'sky', reward: '졸업장 · 고등 한자 · 고등 동사 · N2 문법',
    stages: [
      { id: 'm1', name: '1학년', parts: [{ t: 'kanji', grades: [7], n: 4 }, { t: 'verb', level: 'mid', n: 3 }, { t: 'grammar', levels: ['N4'], n: 3 }] },
      { id: 'm2', name: '2학년', parts: [{ t: 'kanji', grades: [8], n: 4 }, { t: 'verb', level: 'mid', n: 3 }, { t: 'grammar', levels: ['N4', 'N3'], n: 3 }] },
      { id: 'm3', name: '3학년', parts: [{ t: 'kanji', grades: [9], n: 4 }, { t: 'verb', level: 'mid', n: 3 }, { t: 'grammar', levels: ['N3'], n: 3 }] },
      { id: 'mf', name: '졸업 시험', boss: true, parts: [{ t: 'kanji', grades: [7, 8, 9], n: 8 }, { t: 'verb', level: 'mid', n: 6 }, { t: 'grammar', levels: ['N4', 'N3'], n: 6 }] },
    ] },
  { id: 'high', name: '고등학교', mark: '高', color: 'leaf', reward: '졸업장 · JLPT 마스터',
    stages: [
      // 고등학교 한자: 새 한자 대신 특수 읽기(숙자훈) → 사자숙어 → 틀리기 쉬운 읽기
      { id: 'h1', name: '1학년', parts: [{ t: 'hkanji', sets: ['jukuji'], n: 4 }, { t: 'verb', level: 'high', n: 3 }, { t: 'grammar', levels: ['N3'], n: 3 }] },
      { id: 'h2', name: '2학년', parts: [{ t: 'hkanji', sets: ['yoji'], n: 4 }, { t: 'verb', level: 'high', n: 3 }, { t: 'grammar', levels: ['N2'], n: 3 }] },
      { id: 'h3', name: '3학년', parts: [{ t: 'hkanji', sets: ['nandoku'], n: 4 }, { t: 'verb', level: 'high', n: 3 }, { t: 'grammar', levels: ['N2', 'N1'], n: 3 }] },
      { id: 'hf', name: '졸업 시험', boss: true, parts: [{ t: 'hkanji', sets: ['jukuji', 'yoji', 'nandoku'], n: 8 }, { t: 'verb', level: 'high', n: 6 }, { t: 'grammar', levels: ['N2', 'N1'], n: 6 }] },
    ] },
]
const STAGES = SCHOOLS.flatMap(s => s.stages.map(st => ({ ...st, school: s.id })))
const PASS = 8   // 10문제 중 8개 이상이면 통과 (졸업 시험 20문제는 16개)
function stageSize(st) { return st.parts.reduce((n, p) => n + p.n, 0) }
function passNeed(st) { return Math.ceil(stageSize(st) * PASS / 10) }

// 한자 학년 이름: 1~6 = 초등, 7~9 = 중1~중3 (중학 한자는 자주 쓰는 순으로 세 묶음)
// 10~12 = 고1~고3 (특수 읽기 · 사자숙어 · 틀리기 쉬운 읽기 단어 목록)
const HK_GRADE = { 10: 'jukuji', 11: 'yoji', 12: 'nandoku' }
function gradeName(g) { return g <= 6 ? `${g}학년` : g <= 9 ? `중${g - 6}` : `고${g - 9}` }
function gradeLong(g) { return g <= 6 ? `초등 ${g}학년` : g <= 9 ? `중학 한자 (중${g - 6})` : `고등 ${HK_SETS[HK_GRADE[g]]}` }
function highList(g) { return typeof HIGH_KANJI === 'undefined' ? [] : HIGH_KANJI[HK_GRADE[g]] || [] }

// ───── 고등 한자: 숙자훈 · 사자숙어 · 틀리기 쉬운 읽기 ─────
// 문제 키 "hk:yoji:12:r" (읽기 고르기), "hk:yoji:12:m" (뜻 고르기)
const HK_SETS = { jukuji: '특수 읽기', yoji: '사자숙어', nandoku: '틀리기 쉬운 읽기' }
function highKanjiKeys(sets) {
  if (typeof HIGH_KANJI === 'undefined') return []
  return sets.flatMap(s => (HIGH_KANJI[s] || []).flatMap((_, i) => [`hk:${s}:${i}:r`, `hk:${s}:${i}:m`]))
}
function makeHighKanjiQuestion(key) {
  const [, s, i, type] = key.split(':')
  const list = HIGH_KANJI[s]
  const [w, r, m] = list[Number(i)]
  const tag = ` <span class="gqlv">${HK_SETS[s]}</span>`
  const review = `<span class="jp" lang="ja"><ruby>${w}<rt>${r}</rt></ruby></span><span class="dim">${m}</span>`
  const right = `${w}(${r}) = ${m}`
  if (type === 'r') {
    const others = shuffle(list.map(e => e[1]).filter(x => x !== r && Math.abs(x.length - r.length) <= 2))
    const misses = shuffle(nearMisses(r))
    const picks = new Set([r])
    if (misses[0]) picks.add(misses[0])
    for (const x of others) { if (picks.size >= 4) break; picks.add(x) }
    for (const x of misses) { if (picks.size >= 4) break; picks.add(x) }
    return { key, review, right, wrong: right, mode: 'kanji',
      head: wordCells(w), prompt: `읽는 법은 <span class="dim">· ${m}</span>${tag}`,
      choices: shuffle([...picks].map(x => ({ html: x, ok: x === r }))) }
  }
  // 읽기를 보여 주고 그렇게 읽는 낱말 고르기 (한국어 뜻 고르기는 쓰지 않는다)
  const others = shuffle([...new Set(list.filter(e => e[1] !== r && e[0] !== w && Math.abs(e[0].length - w.length) <= 1).map(e => e[0]))]).slice(0, 3)
  return { key, review, right, wrong: right, mode: 'kanji',
    head: `<div class="gq" lang="ja">「${r}」</div>`, prompt: `이렇게 읽는 낱말은${tag}`,
    choices: shuffle([w, ...others].map(x => ({ html: x, ok: x === w }))) }
}

function partQuestions(part, wrong) {
  let keys = [], make
  if (part.t === 'hkanji') {
    keys = highKanjiKeys(part.sets)
    if (keys.length) return pickKeys(wrong.kanji, keys).slice(0, part.n).map(makeHighKanjiQuestion)
    part = { t: 'kanji', grades: [7, 8, 9], n: part.n }   // 데이터가 없을 때
  }
  if (part.t === 'kanji') {
    const maxGrade = Math.max(...part.grades)
    let pool = Object.keys(KANJI).filter(c => part.grades.includes(KANJI[c].grade))
    if (!pool.length) pool = Object.keys(KANJI).filter(c => KANJI[c].grade >= 4 && KANJI[c].grade <= 6)   // 중학 한자가 아직 없을 때
    keys = pool.flatMap(c => [`m:${c}`, ...readIndexes(c, maxGrade).map(i => `r:${c}:${i}`)])
    make = k => { const q = k.startsWith('r:') ? makeReadQuestion(k, pool) : makeMeaningQuestion(k, pool); q.mode = 'kanji'; return q }
    return pickKeys(wrong.kanji, keys).slice(0, part.n).map(make)
  }
  if (part.t === 'num') return pickKeys(wrong.kanji, numKeys(part.groups)).slice(0, part.n).map(makeNumQuestion)
  if (part.t === 'verb') {
    keys = verbKeys(part.level)
    if (!keys.length) keys = verbKeys('elem')   // 아직 그 수준 동사가 없으면 초등 동사로
    return pickKeys(wrong.verb, keys).slice(0, part.n).map(k => { const q = makeVerbQuestion(k); q.mode = 'verb'; return q })
  }
  const pool = GRAMMAR.filter(g => part.levels.includes(g.level))
  keys = pool.flatMap(grammarKeys)
  return pickKeys(wrong.grammar, keys).slice(0, part.n).map(k => { const q = makeGrammarQuestion(k); q.mode = 'grammar'; return q })
}

function buildStageQuiz(stage, wrong) {
  return shuffle(stage.parts.flatMap(p => partQuestions(p, wrong)))
}

// ───── 한자 퀴즈 ─────
// 읽기 문제 키 "r:学:0" (한자, 예문 번호), 뜻 문제 키 "m:学"
const O_ROW = 'おこごそぞとどのほぼぽもよょろ'
const VOICE = { か:'が', き:'ぎ', く:'ぐ', け:'げ', こ:'ご', さ:'ざ', し:'じ', す:'ず', せ:'ぜ', そ:'ぞ', た:'だ', ち:'ぢ', つ:'づ', て:'で', と:'ど', は:'ば', ひ:'び', ふ:'ぶ', へ:'べ', ほ:'ぼ' }

// 초보가 헷갈리는 읽기: 장음 빼기/넣기, っ 빼기, 탁음 바꾸기
function nearMisses(r) {
  const out = new Set()
  for (let i = 1; i < r.length; i++) {
    if (r[i] === 'う' && O_ROW.includes(r[i - 1])) out.add(r.slice(0, i) + r.slice(i + 1))
    if (r[i] === 'っ') out.add(r.slice(0, i) + r.slice(i + 1))
  }
  for (let i = 0; i < r.length; i++) {
    const v = VOICE[r[i]]
    if (v) out.add(r.slice(0, i) + v + r.slice(i + 1))
    const back = Object.keys(VOICE).find(k => VOICE[k] === r[i])
    if (back) out.add(r.slice(0, i) + back + r.slice(i + 1))
  }
  for (let i = 0; i < r.length; i++) {
    if (O_ROW.includes(r[i]) && r[i + 1] !== 'う') out.add(r.slice(0, i + 1) + 'う' + r.slice(i + 1))
  }
  out.delete(r)
  return [...out]
}

// 한자 칸만 있는 단어 (후리가나 없음)
function wordCells(w) {
  return `<div class="masu-row sm plain" lang="ja">${[...w].map(ch => `<span class="masu${/\p{Script=Han}/u.test(ch) ? '' : ' kana'}">${ch}</span>`).join('')}</div>`
}

function readingsText(k) {
  return [k.on.length ? `음독 ${k.on.join('、')}` : '', k.kun.length ? `훈독 ${k.kun.join('、')}` : ''].filter(Boolean).join(' · ')
}

function makeReadQuestion(key, pool) {
  const [, c, i] = key.split(':')
  const k = KANJI[c]
  const [w, r, m] = k.examples[Number(i)]
  const len = r.length
  const others = shuffle(pool.flatMap(x => KANJI[x].examples.map(e => e[1])).filter(x => x !== r && Math.abs(x.length - len) <= 1))
  const misses = shuffle(nearMisses(r))
  const picks = new Set([r])
  if (misses[0]) picks.add(misses[0])
  for (const x of others) { if (picks.size >= 4) break; picks.add(x) }
  for (const x of misses) { if (picks.size >= 4) break; picks.add(x) }
  return {
    key,
    head: wordCells(w),
    prompt: `읽는 법은 <span class="dim">· ${m}</span>`,
    choices: shuffle([...picks].map(x => ({ html: x, ok: x === r }))),
    right: `${c} ${k.meaning}`,
    wrong: `${w} = ${r} · ${c}: ${readingsText(k)}`,
    review: `<span class="jp" lang="ja"><ruby>${w}<rt>${r}</rt></ruby></span><span class="dim">${m}</span>`,
  }
}

// "m:六" — 한국어 뜻 대신, 읽기를 보여 주고 그렇게 읽는 낱말을 고른다.
// 같은 한자의 다른 낱말(六つ ↔ 六月)이 꼭 오답으로 들어가서 "한 글자 여러 읽기"를 가려내게 한다
function makeMeaningQuestion(key, pool) {
  const c = key.split(':')[1]
  const k = KANJI[c]
  const ex = k.examples
  const [w, r, m] = ex[[...key].reduce((n, ch) => n + ch.charCodeAt(0), 0) % ex.length]
  const picks = [w]
  for (const e of ex) if (e[0] !== w && e[1] !== r && !picks.includes(e[0])) picks.push(e[0])
  const others = shuffle(pool.filter(x => x !== c).flatMap(x => KANJI[x].examples).filter(e => e[1] !== r && Math.abs(e[0].length - w.length) <= 1))
  for (const e of others) { if (picks.length >= 4) break; if (!picks.includes(e[0])) picks.push(e[0]) }
  const rest = ex.filter(e => e[0] !== w).map(e => `${e[0]}(${e[1]})`).join(' · ')
  return {
    key,
    head: `<div class="gq" lang="ja">「${r}」</div>`,
    prompt: '이렇게 읽는 낱말은',
    choices: shuffle(picks.map(x => ({ html: x, ok: x === w }))),
    right: `${w} = ${r}${rest ? ` · ${rest}` : ''}`,
    wrong: `${w} = ${r} · ${c}: ${readingsText(k)}${rest ? ` · ${rest}` : ''}`,
    review: `<span class="jp" lang="ja"><ruby>${w}<rt>${r}</rt></ruby></span><span class="dim">${m}</span>`,
  }
}

// ───── 문법 퀴즈 ─────
// 문제 키: "ga:n4_temiru" 뜻 고르기, "gc:n4_temiru" 일본어 고르기, "gb:n4_temiru:0" 예문 속 문법 찾기
function grammarById(id) { return GRAMMAR.find(g => g.id === id) }

// level: 'N5'~'N1', 'all', 'saved'
function grammarPool(level, saved) {
  if (level === 'saved') return GRAMMAR.filter(g => saved.includes(g.id))
  return GRAMMAR.filter(g => level === 'all' ? opened('grammar', g.level) : g.level === level)
}

// 오답 보기는 같은 급수에서 고른다 (모자라면 전체에서)
function grammarOthers(g, pool, key) {
  const same = shuffle(GRAMMAR.filter(x => x.id !== g.id && x.level === g.level))
  const rest = shuffle(GRAMMAR.filter(x => x.id !== g.id && x.level !== g.level))
  const picks = [], seen = new Set([key(g)])
  for (const x of [...same, ...rest]) {
    if (picks.length >= 3) break
    if (!seen.has(key(x))) { seen.add(key(x)); picks.push(x) }
  }
  return picks
}

// 문법 하나에서 나오는 문제들
//   ga 뜻 고르기 · gc 일본어 고르기 · gb 예문 속 문법 찾기   (알아보기)
//   gf 빈칸 채우기 · gj 접속 형태 · go 문장 배열            (직접 말해 보기)
function grammarKeys(g) {
  const k = [`ga:${g.id}`, `gc:${g.id}`, ...g.examples.map((_, i) => `gb:${g.id}:${i}`)]
  g.examples.forEach((e, i) => { if (e.jp.includes('［')) k.push(`gf:${g.id}:${i}`) })
  if (g.conn) k.push(`gj:${g.id}`)
  if (g.order) k.push(`go:${g.id}`)
  return k
}
// 예문 표시: ［ ］ 표시는 지우거나(문제) 칠해서(설명) 보여 준다
function gText(s) { return furi(s.replace(/［|］/g, '')) }
function gMark(s) { return furi(s).replace(/［([^［］]*)］/, '<mark class="gmark">$1</mark>') }
function blankOf(e) { const m = e.jp.match(/［([^［］]*)］/); return m ? m[1] : null }
const plainJp = s => s.replace(/\{([^{}|]+)\|[^{}|]+\}/g, '$1')

function makeGrammarQuestion(qkey) {
  const [type, id, ex] = qkey.split(':')
  const g = grammarById(id)
  const lvTag = ` <span class="gqlv">${g.level}</span>`
  const sim = (g.similar || []).map(grammarById).filter(Boolean)
  const diff = g.diff ? ` · ${g.diff}` : ''
  if (type === 'gf') {
    // 빈칸: 정답은 ［ ］ 속 글자, 오답은 헷갈리는 짝 → 같은 급수 순서로
    const e = g.examples[Number(ex)], ans = blankOf(e)
    const cands = [...sim, ...shuffle(GRAMMAR.filter(x => x.level === g.level && x !== g))]
      .map(x => x.examples.map(blankOf).find(Boolean)).filter(Boolean)
    const picks = [ans]
    for (const c of cands) { if (picks.length >= 4) break; if (!picks.some(x => plainJp(x) === plainJp(c))) picks.push(c) }
    return {
      key: qkey,
      head: `<div class="gsent" lang="ja">${furi(e.jp.replace(/［[^［］]*］/, '<span class="blank">（　　）</span>'))}</div>`,
      prompt: `빈칸에 들어갈 말은 <span class="dim">· ${e.ko}</span>${lvTag}`,
      choices: shuffle(picks.map(x => ({ html: furi(x), ok: x === ans }))),
      right: `${furi(g.pattern)} = ${g.meaning}`,
      wrong: `${furi(g.pattern)} = ${g.meaning}${diff}`,
      review: `<span class="jp" lang="ja">${gMark(e.jp)}</span><span class="dim">${e.ko}</span>`,
      kind: 'blank',
    }
  }
  if (type === 'gj') {
    const c = g.conn
    return {
      key: qkey,
      head: `<div class="gsent" lang="ja">${furi(c.before)}<span class="blank">（　　）</span>${furi(c.after)}</div>`,
      prompt: `알맞은 형태는 <span class="dim">· ${g.connect}</span>${lvTag}`,
      choices: shuffle([c.ok, ...c.bad].map(x => ({ html: furi(x), ok: x === c.ok }))),
      right: `${furi(g.pattern)} · ${g.connect}`,
      wrong: `${furi(g.pattern)} · 접속: ${g.connect}`,
      review: `<span class="jp" lang="ja">${furi(c.before)}<mark class="gmark">${furi(c.ok)}</mark>${furi(c.after)}</span><span class="dim">${g.connect}</span>`,
    }
  }
  if (type === 'go') {
    // 배열: 조각을 눌러 순서대로 놓는다 (choices는 맞음/틀림 두 칸만 쓰고, 화면은 order로 그린다)
    const parts = g.order.jp.split(' / ')
    let mix = shuffle(parts.map((_, i) => i))
    if (mix.every((v, i) => v === i)) mix = [...mix.slice(1), mix[0]]
    return {
      key: qkey,
      head: `<div class="gq ko">${g.order.ko}</div>`,
      prompt: `순서대로 놓아 문장을 만들어요${lvTag}`,
      order: { parts: parts.map(furi), mix },
      choices: [{ html: '', ok: true }, { html: '', ok: false }],
      right: `${furi(g.pattern)} = ${g.meaning}`,
      wrong: `${gText(g.order.jp.replace(/ \/ /g, ''))}`,
      review: `<span class="jp" lang="ja">${gText(g.order.jp.replace(/ \/ /g, ''))}</span><span class="dim">${g.order.ko}</span>`,
    }
  }
  const plainPattern = x => x.pattern.replace(/\{([^{}|]+)\|[^{}|]+\}/g, '$1')
  const review = `<span class="jp" lang="ja">${furi(g.pattern)}</span><span class="dim">${g.meaning}</span>`
  const right = `${furi(g.pattern)} = ${g.meaning}`
  const wrong = `${furi(g.pattern)} = ${g.meaning} · ${g.explain.replace(/\.$/, '')}`
  const lv = ` <span class="gqlv">${g.level}</span>`
  if (type === 'ga') {
    const others = grammarOthers(g, null, x => x.meaning)
    return {
      key: qkey, review, right, wrong,
      head: `<div class="gq" lang="ja">${furi(g.pattern)}</div>`,
      prompt: '이 문법의 뜻은' + lv,
      choices: shuffle([g, ...others].map(x => ({ html: x.meaning, ok: x === g, ko: true }))),
    }
  }
  if (type === 'gc') {
    const others = grammarOthers(g, null, plainPattern)
    return {
      key: qkey, review, right, wrong,
      head: `<div class="gq ko">${g.meaning}</div>`,
      prompt: '일본어로 하면' + lv,
      choices: shuffle([g, ...others].map(x => ({ html: furi(x.pattern), ok: x === g }))),
    }
  }
  // gb: 예문 속 문법 찾기
  const e = g.examples[Number(ex)]
  const others = grammarOthers(g, null, plainPattern)
  return {
    key: qkey, review, right: `${right} · ${e.ko}`, wrong: `${right} · ${e.ko}`,
    head: `<div class="gsent" lang="ja">${gText(e.jp)}</div>`,
    prompt: '쓰인 문법은' + lv,
    choices: shuffle([g, ...others].map(x => ({ html: furi(x.pattern), ok: x === g }))),
  }
}

function buildGrammarQuiz(level, saved, wrongKeys) {
  const pool = grammarPool(level, saved)
  return pickKeys(wrongKeys, pool.flatMap(grammarKeys)).map(makeGrammarQuestion)
}

// grade 0 = 전체
function kanjiPool(grade) {
  return Object.keys(KANJI).filter(c => grade ? KANJI[c].grade === grade : opened('kanji', KANJI[c].grade))
}

// 학년을 골랐으면 그 학년까지 배운 한자로만 된 예문을 읽기 문제로 쓴다
function readIndexes(c, grade) {
  const ex = KANJI[c].examples
  if (!grade) return ex.map((_, i) => i)
  const fits = ex.map((e, i) => [...e[0]].every(ch => !KANJI[ch] || KANJI[ch].grade <= grade) ? i : -1).filter(i => i >= 0)
  return fits.length ? fits : [0]
}

function buildKanjiQuiz(grade, wrongKeys) {
  if (grade >= 10) return pickKeys(wrongKeys, highKanjiKeys([HK_GRADE[grade]])).map(makeHighKanjiQuestion)
  const pool = kanjiPool(grade)
  const all = pool.flatMap(c => [`m:${c}`, ...readIndexes(c, grade).map(i => `r:${c}:${i}`)])
  return pickKeys(wrongKeys, all).map(k => k.startsWith('r:') ? makeReadQuestion(k, pool) : makeMeaningQuestion(k, pool))
}

// ───── 실생활 회화 ─────
// 문제 키: "tw:konbini:3" 이럴 때 뭐라고 할까 · "tm:konbini:0" 들은 말 뜻 · "tb:konbini:5" 문장 조립
function talkScene(id) { return (typeof TALK === 'undefined' ? [] : TALK).find(s => s.id === id) }
function talkKeys(sceneId) {
  const scenes = typeof TALK === 'undefined' ? [] : sceneId === 'all' ? TALK : TALK.filter(s => s.id === sceneId)
  return scenes.flatMap(s => s.lines.flatMap((l, i) => l.who === 'me'
    ? [`tw:${s.id}:${i}`, `tb:${s.id}:${i}`] : [`tm:${s.id}:${i}`]))
}
function makeTalkQuestion(key) {
  const [type, sid, idx] = key.split(':')
  const s = talkScene(sid), l = s.lines[Number(idx)]
  const tag = ` <span class="gqlv">${s.name}</span>`
  const review = `<span class="jp" lang="ja">${furi(l.jp)}</span><span class="dim">${l.ko}</span>`
  const right = l.note || l.ko, wrong = `${furi(l.jp)} = ${l.ko}${l.note ? ' · ' + l.note : ''}`
  // 오답 보기는 같은 장면에서 먼저, 모자라면 다른 장면에서
  const others = (pick, same) => {
    const pool = [...shuffle(s.lines.filter(x => x !== l && same(x))), ...shuffle(TALK.filter(x => x !== s).flatMap(x => x.lines).filter(same))]
    const out = [], seen = new Set([pick(l)])
    for (const x of pool) { if (out.length >= 3) break; if (!seen.has(pick(x))) { seen.add(pick(x)); out.push(pick(x)) } }
    return out
  }
  if (type === 'tw') {
    const opts = [l.jp, ...others(x => x.jp, x => x.who === 'me')]
    return { key, mode: 'talk', review, right, wrong,
      head: `<div class="gq ko">${l.when}</div>`, prompt: `이럴 때 뭐라고 할까요${tag}`,
      choices: shuffle(opts.map(x => ({ html: furi(x), ok: x === l.jp }))) }
  }
  if (type === 'tm') {
    const opts = [l.ko, ...others(x => x.ko, () => true)]
    return { key, mode: 'talk', review, right: l.when, wrong: `${furi(l.jp)} = ${l.ko}`,
      head: `<div class="gsent" lang="ja">${furi(l.jp)}</div>`, prompt: `상대가 한 말의 뜻은 <span class="dim">· ${l.when}</span>${tag}`,
      choices: shuffle(opts.map(x => ({ html: x, ok: x === l.ko, ko: true }))) }
  }
  const parts = l.parts.split(' / ')
  let mix = shuffle(parts.map((_, i) => i))
  if (mix.every((v, i) => v === i)) mix = [...mix.slice(1), mix[0]]
  return { key, mode: 'talk', review, right, wrong,
    head: `<div class="gq ko">${l.ko}</div>`, prompt: `순서대로 놓아 문장을 완성해요 <span class="dim">· ${l.when}</span>${tag}`,
    order: { parts: parts.map(furi), mix }, choices: [{ html: '', ok: true }, { html: '', ok: false }] }
}
function buildTalkQuiz(sceneId, wrongKeys) {
  return pickKeys(wrongKeys, talkKeys(sceneId)).map(makeTalkQuestion)
}

// ───── 의성어·의태어 ─────
// 문제 키: "om:dokidoki" 뜻 고르기 · "ow:dokidoki" 상황 보고 고르기 · "of:dokidoki" 예문 빈칸
const ONO_CATS = ['감정', '사람 모습', '날씨·자연', '소리', '움직임', '상태·촉감', '맛·식감']
function onoList() { return typeof ONO === 'undefined' ? [] : ONO }
function onoById(id) { return onoList().find(o => o.id === id) }
function onoKeys(cat) {
  return onoList().filter(o => cat === 'all' || o.cat === cat).flatMap(o => [`om:${o.id}`, `ow:${o.id}`, `of:${o.id}`])
}
function makeOnoQuestion(key) {
  const [type, id] = key.split(':')
  const o = onoById(id)
  const tag = ` <span class="gqlv">${o.cat}</span>`
  // 오답은 같은 분류에서 먼저 (같은 말이 두 뜻일 때는 빼고)
  const pool = [...shuffle(onoList().filter(x => x !== o && x.cat === o.cat)), ...shuffle(onoList().filter(x => x.cat !== o.cat))]
  const pick3 = f => { const out = [], seen = new Set([f(o)]); for (const x of pool) { if (out.length >= 3) break; if (x.word === o.word) continue; if (!seen.has(f(x))) { seen.add(f(x)); out.push(f(x)) } } return out }
  const right = `${o.word} = ${o.meaning}${o.ko ? ` (${o.ko})` : ''}`
  const review = `<span class="jp" lang="ja">${o.word}</span><span class="dim">${o.meaning}${o.ko ? ` · ${o.ko}` : ''}</span>`
  const ex = `${furi(o.example.jp.replace(/［|］/g, ''))} · ${o.example.ko}`
  if (type === 'om') return { key, mode: 'ono', review, right: ex, wrong: `${right} · 예: ${ex}`,
    head: `<div class="gq onoq" lang="ja">${o.word}</div>`, prompt: `무슨 뜻일까요${tag}`,
    choices: shuffle([o.meaning, ...pick3(x => x.meaning)].map(x => ({ html: x, ok: x === o.meaning, ko: true }))) }
  if (type === 'ow') return { key, mode: 'ono', review, right, wrong: `${right} · 예: ${ex}`,
    head: `<div class="gq ko">${o.when}</div>`, prompt: `이럴 때 쓰는 말은${tag}`,
    choices: shuffle([o.word, ...pick3(x => x.word)].map(x => ({ html: x, ok: x === o.word }))) }
  return { key, mode: 'ono', review, right, wrong: right,
    head: `<div class="gsent" lang="ja">${furi(o.example.jp.replace(/［[^［］]*］/, '<span class="blank">（　　）</span>'))}</div>`,
    prompt: `빈칸에 알맞은 말은 <span class="dim">· ${o.example.ko}</span>${tag}`,
    choices: shuffle([o.word, ...pick3(x => x.word)].map(x => ({ html: x, ok: x === o.word }))) }
}
function buildOnoQuiz(cat, wrongKeys) { return pickKeys(wrongKeys, onoKeys(cat)).map(makeOnoQuestion) }

// ───── 숫자 읽기: 날짜·개수·조수사 ─────
// "nm:5" 낱말 → 읽기 · "nw:5" 읽기 → 낱말 (같은 묶음 낱말이 오답)
function numById(id) { return typeof NUMBERS === 'undefined' ? null : NUMBERS.find(n => n.id === id) }
function numGroup(id) { return NUMBER_GROUPS.find(g => g.id === id) }
function numKeys(groups) {
  if (typeof NUMBERS === 'undefined') return []
  return NUMBERS.filter(n => groups === 'all' || groups.includes(n.g)).flatMap(n => [`nm:${n.id}`, `nw:${n.id}`])
}
function makeNumQuestion(key) {
  const [type, id] = key.split(':')
  const n = numById(id), grp = numGroup(n.g)
  const okR = new Set([n.r, ...n.alt])
  const tag = ` <span class="gqlv">${grp.name}</span>`
  const review = `<span class="jp" lang="ja"><ruby>${n.w}<rt>${n.r}</rt></ruby></span><span class="dim">${n.m}</span>`
  const right = `${n.w} = ${n.r}${n.alt.length ? ` (${n.alt.join('·')}도 맞아요)` : ''}`
  const wrong = `${right} · ${grp.note}`
  const same = NUMBERS.filter(x => x.g === n.g && x !== n)
  if (type === 'nw') {
    // 읽기를 보고 낱말 고르기: 오답 낱말은 그 읽기로 읽히지 않는 것만
    const picks = [n.w]
    for (const x of shuffle(same)) { if (picks.length >= 4) break; if (!x.alt.includes(n.r) && x.r !== n.r && !picks.includes(x.w)) picks.push(x.w) }
    return { key, review, right, wrong, mode: 'kanji',
      head: `<div class="gq" lang="ja">「${n.r}」</div>`, prompt: `이렇게 읽는 것은${tag}`,
      choices: shuffle(picks.map(x => ({ html: x, ok: x === n.w }))) }
  }
  const picks = [n.r]
  const add = x => { if (picks.length < 4 && x && !okR.has(x) && !picks.includes(x)) picks.push(x) }
  shuffle(n.bad).forEach(add)
  shuffle(same.map(x => x.r).filter(x => Math.abs(x.length - n.r.length) <= 2)).forEach(add)
  shuffle(nearMisses(n.r)).forEach(add)
  return { key, review, right, wrong, mode: 'kanji',
    head: wordCells(n.w), prompt: `읽는 법은 <span class="dim">· ${n.m}</span>${tag}`,
    choices: shuffle(picks.map(x => ({ html: x, ok: x === n.r }))) }
}
function buildNumQuiz(group, wrongKeys) { return pickKeys(wrongKeys, numKeys(group === 'all' ? 'all' : [group])).map(makeNumQuestion) }

// ───── 문제 키 하나로 문제 다시 만들기 (복습·모의고사) ─────
function keyMode(k) {
  if (/^(r|m|hk|nm|nw):/.test(k)) return 'kanji'
  if (/^g[abcfjo]:/.test(k)) return 'grammar'
  if (/^t[wmb]:/.test(k)) return 'talk'
  if (/^o[mwf]:/.test(k)) return 'ono'
  return 'verb'
}
function questionFromKey(k) {
  try {
    const mode = keyMode(k)
    let q
    if (k.startsWith('hk:')) q = makeHighKanjiQuestion(k)
    else if (/^n[mw]:/.test(k)) { if (!numById(k.split(':')[1])) return null; q = makeNumQuestion(k) }
    else if (mode === 'kanji') { const c = k.split(':')[1]; if (!KANJI[c]) return null; const pool = kanjiPool(KANJI[c].grade); q = k.startsWith('r:') ? makeReadQuestion(k, pool) : makeMeaningQuestion(k, pool) }
    else if (mode === 'grammar') { if (!grammarById(k.split(':')[1])) return null; q = makeGrammarQuestion(k) }
    else if (mode === 'talk') { if (!talkScene(k.split(':')[1])) return null; q = makeTalkQuestion(k) }
    else if (mode === 'ono') { if (!onoById(k.split(':')[1])) return null; q = makeOnoQuestion(k) }
    else { if (!wordById(k.split(':')[0])) return null; q = makeVerbQuestion(k) }
    q.mode = mode
    return q
  } catch { return null }
}
// 마스터 별을 세는 단위: 문법은 문법 하나, 한자는 글자 하나, 회화는 문장 하나
function masterItem(k) {
  const p = k.split(':')
  if (/^(r|m):/.test(k)) return 'k:' + p[1]
  if (k.startsWith('hk:')) return 'h:' + p[1] + ':' + p[2]
  if (/^n[mw]:/.test(k)) return 'n:' + p[1]
  if (/^g/.test(p[0])) return 'g:' + p[1]
  if (/^t/.test(p[0])) return 't:' + p[1] + ':' + p[2]
  if (/^o/.test(p[0])) return 'o:' + p[1]
  return 'v:' + p[0]
}

// ───── JLPT 모의고사: 문자 10 · 문법 15 · 표현 5 ─────
const MOCK_KANJI = { N5: [1, 2], N4: [3, 4], N3: [5, 6, 7], N2: [8, 9], N1: [9, 10, 11, 12] }
function buildMock(level) {
  const tag = (q, sec) => { q.section = sec; return q }
  const grades = MOCK_KANJI[level]
  const kk = grades.flatMap(g => g >= 10 ? highKanjiKeys([HK_GRADE[g]]).filter(k => k.endsWith(':r'))
    : kanjiPool(g).flatMap(c => readIndexes(c, g).map(i => `r:${c}:${i}`)))
  const gk = GRAMMAR.filter(g => g.level === level).flatMap(grammarKeys).filter(k => /^g[fjo]:/.test(k))
  const tk = talkKeys('all').filter(k => /^t[wm]:/.test(k))
  const qs = [
    ...shuffle(kk).slice(0, 40).map(questionFromKey).filter(Boolean).slice(0, 10).map(q => tag(q, '문자')),
    ...shuffle(gk).slice(0, 40).map(questionFromKey).filter(Boolean).slice(0, 15).map(q => tag(q, '문법')),
    ...shuffle(tk).slice(0, 40).map(questionFromKey).filter(Boolean).slice(0, 5).map(q => tag(q, '표현')),
  ]
  return qs
}
