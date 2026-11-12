// ───── 레벨링: 퀘스트를 통과해야 다음 공부가 열린다 ─────
// 각 내용은 퀘스트의 어느 스테이지와 함께 열리는지 적어 둔다.
// 그 스테이지가 열리면(= 바로 앞 스테이지를 통과하면) 한자·동사·문법·카드·퀴즈가 함께 열린다.
const UNLOCK_AT = {
  kanji: { 1: 'e1', 2: 'e2', 3: 'e3', 4: 'e4', 5: 'e5', 6: 'e6', 7: 'm1', 8: 'm2', 9: 'm3', 10: 'h1', 11: 'h2', 12: 'h3' },
  verb: { elem: 'e1', mid: 'm1', high: 'h1' },
  grammar: { N5: 'e1', N4: 'e5', N3: 'm2', N2: 'h2', N1: 'h3' },
}
const HK_SET_GRADE = { jukuji: 10, yoji: 11, nandoku: 12 }

function stageIndex(id) { return STAGES.findIndex(s => s.id === id) }
function stageCleared(id) { return (progress.stages[id] || 0) > 0 }
function clearedCount() { return STAGES.filter(s => stageCleared(s.id)).length }
function totalStars() { return STAGES.reduce((n, s) => n + (progress.stages[s.id] || 0), 0) }

function isOpen(kind, key) {
  const at = UNLOCK_AT[kind] && UNLOCK_AT[kind][key]
  if (!at) return true
  const i = stageIndex(at)
  return i <= 0 || stageCleared(STAGES[i - 1].id)
}

// "퀘스트 초등학교 3학년을 통과하면 열려요"
function unlockHint(kind, key) {
  const prev = STAGES[stageIndex(UNLOCK_AT[kind][key]) - 1]
  return `퀘스트 ${schoolOf(prev.school).name} ${prev.name}을 통과하면 열려요`
}

// 한자 학년 하나를 부르는 이름과 크기 (새로 열림 목록용)
function kanjiPackLabel(g) {
  if (g >= 10) return `고등 ${HK_SETS[HK_GRADE[g]]} ${highList(g).length}개`
  return `${g <= 6 ? `초등 ${g}학년` : `중${g - 6}`} 한자 ${kanjiList(g).length}자`
}

// 이 스테이지가 열릴 때 함께 열리는 것들
function unlocksAt(stageId) {
  const out = []
  for (const [g, id] of Object.entries(UNLOCK_AT.kanji)) if (id === stageId) out.push({ kind: 'kanji', label: kanjiPackLabel(Number(g)) })
  for (const [lv, id] of Object.entries(UNLOCK_AT.verb)) if (id === stageId) out.push({ kind: 'verb', label: `${VERB_LEVELS[lv]} 동사 ${WORDS.filter(w => verbLevel(w) === lv).length}개` })
  for (const [lv, id] of Object.entries(UNLOCK_AT.grammar)) if (id === stageId) out.push({ kind: 'grammar', label: `${lv} 문법 ${GRAMMAR.filter(g => g.level === lv).length}개` })
  return out
}

// 레벨과 칭호: 지금 도전 중인 학년이 곧 내 학년
function playerLevel() { return clearedCount() + 1 }
function rankName() {
  if (STAGES.every(s => stageCleared(s.id))) return '고등학교 졸업 · 일본어 마스터'
  const st = STAGES[currentStageIndex()]
  return `${schoolOf(st.school).name} ${st.boss ? '졸업반' : st.name}`
}

// ───── 배지 ─────
// mark: 도장에 새길 한자 한 글자
const BADGES = [
  { id: 'first', mark: '始', name: '첫걸음', desc: '퀘스트 첫 스테이지 통과', ok: () => clearedCount() >= 1 },
  { id: 'perfect', mark: '満', name: '만점', desc: '스테이지 10문제 모두 맞히기', ok: () => Object.values(progress.stages).includes(3) },
  { id: 'combo10', mark: '連', name: '10연속', desc: '퀴즈 10문제 연속 정답', ok: () => (progress.bestCombo || 0) >= 10 },
  { id: 'streak3', mark: '三', name: '사흘 연속', desc: '3일 연속 공부', ok: () => streak() >= 3 },
  { id: 'streak7', mark: '七', name: '일주일 연속', desc: '7일 연속 공부', ok: () => streak() >= 7 },
  { id: 'kanji100', mark: '百', name: '한자 100자', desc: '한자 100자 보기', ok: () => progress.seenKanji.filter(c => KANJI[c]).length >= 100 },
  { id: 'kanji1000', mark: '千', name: '한자 1000자', desc: '한자 1000자 보기', ok: () => progress.seenKanji.filter(c => KANJI[c]).length >= 1000 },
  { id: 'star20', mark: '星', name: '별 20개', desc: '퀘스트 별 20개 모으기', ok: () => totalStars() >= 20 },
  { id: 'elem', mark: '小', name: '초등 졸업', desc: '초등학교 졸업 시험 통과', ok: () => progress.graduated.includes('elem') },
  { id: 'mid', mark: '中', name: '중학 졸업', desc: '중학교 졸업 시험 통과', ok: () => progress.graduated.includes('mid') },
  { id: 'high', mark: '高', name: '고등 졸업', desc: '고등학교 졸업 시험 통과', ok: () => progress.graduated.includes('high') },
  { id: 'allstars', mark: '輝', name: '별 전부', desc: `별 ${STAGES.length * 3}개 모두 모으기`, ok: () => totalStars() >= STAGES.length * 3 },
]
function earnedBadges() { return BADGES.filter(b => progress.badges.includes(b.id)) }
// 새로 딴 배지를 기록하고 돌려준다
function checkBadges() {
  const fresh = BADGES.filter(b => !progress.badges.includes(b.id) && b.ok())
  for (const b of fresh) progress.badges.push(b.id)
  return fresh
}
function badgeHTML(b, on, isNew) {
  return `<div class="badge${on ? ' on' : ''}${isNew ? ' new' : ''}">
    <span class="bmark" lang="ja">${on ? b.mark : LOCK}</span>
    <b>${b.name}</b><small>${b.desc}</small></div>`
}

// 잠긴 화면: 무엇이 기다리는지 보여 주고 퀘스트로 보낸다
function lockedPanel(title, hint) {
  return `<div class="panel lockpanel">
    ${mascot('think')}
    <div><b>${LOCK}${title}</b><p>${hint}</p>
    <button class="btn pri" data-act="questContinue">퀘스트 하러 가기</button></div></div>`
}

// "새로 열렸어요" + "새 배지" (퀴즈 결과 화면)
function rewardsHTML(qz) {
  const un = qz.unlocked || [], bs = qz.newBadges || []
  if (!un.length && !bs.length) return ''
  return `<div class="rewards">
    ${un.length ? `<div class="newopen"><div class="eyebrow">새로 열렸어요</div>
      <ul>${un.map((u, i) => `<li style="--d:${600 + i * 180}ms"><span class="ktag ${u.kind}">${{ stage: '퀘스트', kanji: '한자', verb: '동사', grammar: '문법' }[u.kind]}</span>${u.label}</li>`).join('')}</ul></div>` : ''}
    ${bs.length ? `<div class="newbadges"><div class="eyebrow">새 배지</div><div class="badges">${bs.map(b => badgeHTML(b, true, true)).join('')}</div></div>` : ''}
  </div>`
}
