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

function buildVerbQuiz(wrongKeys) {
  const all = WORDS.flatMap(w => FORMS.map(f => `${w.id}:${f}`))
  return pickKeys(wrongKeys, all).map(makeVerbQuestion)
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

function makeMeaningQuestion(key, pool) {
  const c = key.split(':')[1]
  const k = KANJI[c]
  const others = shuffle(pool.filter(x => x !== c).map(x => KANJI[x].meaning)).filter(x => x !== k.meaning)
  const picks = [k.meaning, ...new Set(others)].slice(0, 4)
  const [w, r] = k.examples[0]
  return {
    key,
    head: `<span class="masu xl" lang="ja">${c}</span>`,
    prompt: '뜻과 음은',
    choices: shuffle(picks.map(x => ({ html: x, ok: x === k.meaning, ko: true }))),
    right: readingsText(k),
    wrong: `${c} = ${k.meaning} · 예: ${w}(${r})`,
    review: `<span class="jp" lang="ja">${c}</span><span class="dim">${k.meaning}</span>`,
  }
}

// ───── 문법 퀴즈 ─────
// 문제 키: "ga:n4_temiru" 뜻 고르기, "gc:n4_temiru" 일본어 고르기, "gb:n4_temiru:0" 예문 속 문법 찾기
function grammarById(id) { return GRAMMAR.find(g => g.id === id) }

// level: 'N5'~'N1', 'all', 'saved'
function grammarPool(level, saved) {
  if (level === 'saved') return GRAMMAR.filter(g => saved.includes(g.id))
  return GRAMMAR.filter(g => level === 'all' || g.level === level)
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

function makeGrammarQuestion(qkey) {
  const [type, id, ex] = qkey.split(':')
  const g = grammarById(id)
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
    head: `<div class="gsent" lang="ja">${furi(e.jp)}</div>`,
    prompt: '쓰인 문법은' + lv,
    choices: shuffle([g, ...others].map(x => ({ html: furi(x.pattern), ok: x === g }))),
  }
}

function buildGrammarQuiz(level, saved, wrongKeys) {
  const pool = grammarPool(level, saved)
  const all = pool.flatMap(g => [`ga:${g.id}`, `gc:${g.id}`, ...g.examples.map((_, i) => `gb:${g.id}:${i}`)])
  return pickKeys(wrongKeys, all).map(makeGrammarQuestion)
}

// grade 0 = 전체
function kanjiPool(grade) {
  return Object.keys(KANJI).filter(c => !grade || KANJI[c].grade === grade)
}

// 학년을 골랐으면 그 학년까지 배운 한자로만 된 예문을 읽기 문제로 쓴다
function readIndexes(c, grade) {
  const ex = KANJI[c].examples
  if (!grade) return ex.map((_, i) => i)
  const fits = ex.map((e, i) => [...e[0]].every(ch => !KANJI[ch] || KANJI[ch].grade <= grade) ? i : -1).filter(i => i >= 0)
  return fits.length ? fits : [0]
}

function buildKanjiQuiz(grade, wrongKeys) {
  const pool = kanjiPool(grade)
  const all = pool.flatMap(c => [`m:${c}`, ...readIndexes(c, grade).map(i => `r:${c}:${i}`)])
  return pickKeys(wrongKeys, all).map(k => k.startsWith('r:') ? makeReadQuestion(k, pool) : makeMeaningQuestion(k, pool))
}
