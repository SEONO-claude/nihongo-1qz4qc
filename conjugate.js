// 동사 → ます형 변화
// 모든 결과는 ruby 짝 배열로 만든다. 그래야 후리가나를 그대로 붙일 수 있다.

// 1그룹: 끝 글자를 い단으로 (飲む → 飲み)
const I_ROW = { 'う':'い', 'く':'き', 'ぐ':'ぎ', 'す':'し', 'つ':'ち', 'ぬ':'に', 'ぶ':'び', 'む':'み', 'る':'り' }

const FORMS = ['present', 'past', 'negative', 'pastNegative']
const ENDINGS = { present: 'ます', past: 'ました', negative: 'ません', pastNegative: 'ませんでした' }
const FORM_LABEL = { present: '현재·미래 긍정', past: '과거 긍정', negative: '현재·미래 부정', pastNegative: '과거 부정' }
const GROUP_LABEL = { 1: '1그룹 (う동사)', 2: '2그룹 (る동사)', 3: '3그룹 (불규칙)' }

// ます를 붙이기 직전 모양 (食べる → 食べ, 飲む → 飲み, 来る → 来(き))
function masuStem(word) {
  const pairs = word.ruby.map(p => p.slice())
  const last = pairs[pairs.length - 1]
  if (word.group === 3) {
    if (word.reading.endsWith('する')) last[0] = last[0].slice(0, -2) + 'し'   // 勉強する → 勉強し
    else return [['来', 'き']]                                                 // 来る → 来(き): 읽는 법도 바뀐다
  } else if (word.group === 2) {
    last[0] = last[0].slice(0, -1)                                             // 食べる → 食べ
  } else {
    const end = last[0].slice(-1)
    last[0] = last[0].slice(0, -1) + I_ROW[end]                                // 飲む → 飲み
  }
  return pairs.filter(([text]) => text !== '')
}

function pairsToText(pairs) {
  return { kanji: pairs.map(p => p[0]).join(''), reading: pairs.map(p => p[1] || p[0]).join('') }
}

function conjugate(word, form) {
  const pairs = [...masuStem(word), [ENDINGS[form], '']]
  return { pairs, ...pairsToText(pairs) }
}

// 초보가 자주 하는 실수: 사전형에 ます를 그대로 붙인다 (飲むました)
function commonMistake(word, form) {
  const pairs = [...word.ruby.map(p => p.slice()), [ENDINGS[form], '']]
  return { pairs, ...pairsToText(pairs) }
}

// ───── 형용사 ─────
// い형용사: 高いです / 高かったです / 高くないです / 高くなかったです (いい는 よ-로 바뀜)
// な형용사: 静かです / 静かでした / 静かじゃないです / 静かじゃなかったです
const ADJ_ENDINGS = {
  i: { present: 'いです', past: 'かったです', negative: 'くないです', pastNegative: 'くなかったです' },
  na: { present: 'です', past: 'でした', negative: 'じゃないです', pastNegative: 'じゃなかったです' },
}
const ADJ_LABEL = { i: 'い형용사', na: 'な형용사' }

// 어미를 붙이기 직전 모양 (高い → 高, 大きい → 大き, いい → よ)
function adjStem(a, form) {
  if (a.type === 'na') return a.ruby.map(p => p.slice())
  if (a.reading === 'いい') return form === 'present' ? [['い', '']] : [['よ', '']]
  const pairs = a.ruby.map(p => p.slice())
  const last = pairs[pairs.length - 1]
  last[0] = last[0].slice(0, -1)
  return pairs.filter(([t]) => t !== '')
}

function adjForm(a, form) {
  const pairs = [...adjStem(a, form), [ADJ_ENDINGS[a.type][form], '']]
  return { pairs, ending: ADJ_ENDINGS[a.type][form], stem: adjStem(a, form), ...pairsToText(pairs) }
}

// 규칙 설명 (한국어)
function ruleText(word, form) {
  const ending = form ? ENDINGS[form] : 'ます'
  if (word.group === 2) return `2그룹은 끝의 る를 빼고 ${ending}를 붙여요.`
  if (word.group === 3) {
    if (word.reading.endsWith('する')) return `3그룹: する는 し로 바뀌고 ${ending}를 붙여요.`
    return `3그룹: 来る(くる)는 来(き)로 바뀌고 ${ending}를 붙여요. 읽는 법이 く → き로 바뀌어요.`
  }
  const end = word.reading.slice(-1)
  return `1그룹은 끝 글자 ${end} → ${I_ROW[end]} 로 바꾼 뒤 ${ending}를 붙여요.`
}
