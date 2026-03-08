'use strict';

import { buildCooldownUrlForCurrentGame } from '../gate/helpers/gate-link.js';

const W = window, D = document;
const qs = (k, d='')=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
const clamp = (v,a,b)=>Math.max(a,Math.min(b, Number(v)||0));
const now = ()=> (performance && performance.now) ? performance.now() : Date.now();

const RUN  = String(qs('run','play')).toLowerCase();
const DIFF = String(qs('diff','normal')).toLowerCase();
const TIME = clamp(qs('time','80'), 30, 180);
const PID  = String(qs('pid','anon'));
const HUB  = String(qs('hub','../hub.html'));
const SEED = String(qs('seed', String(Date.now())));

const UI = {
  stage: D.getElementById('stage'),
  mouthBoard: D.getElementById('mouthBoard'),
  targetLayer: D.getElementById('targetLayer'),

  pillStage: D.getElementById('pillStage'),
  pillQuest: D.getElementById('pillQuest'),
  pillTime: D.getElementById('pillTime'),
  pillScore: D.getElementById('pillScore'),
  pillMiss: D.getElementById('pillMiss'),
  pillCombo: D.getElementById('pillCombo'),
  pillAcc: D.getElementById('pillAcc'),
  pillCoach: D.getElementById('pillCoach'),
  pillRisk: D.getElementById('pillRisk'),

  btnStart: D.getElementById('btnStart'),
  btnHelp: D.getElementById('btnHelp'),
  btnCloseHelp: D.getElementById('btnCloseHelp'),

  panelHelp: D.getElementById('panelHelp'),
  panelEnd: D.getElementById('panelEnd'),
  endSummary: D.getElementById('endSummary'),
  heatmap: D.getElementById('heatmap'),
  reasonChips: D.getElementById('reasonChips'),
  stars: D.getElementById('stars'),
  selfRubric: D.getElementById('selfRubric'),
  rubricDesc: D.getElementById('rubricDesc'),
  improveChips: D.getElementById('improveChips'),
  aiTipPill: D.getElementById('aiTipPill'),
  aiCauseChips: D.getElementById('aiCauseChips'),
  aiMetaText: D.getElementById('aiMetaText'),

  btnReplay: D.getElementById('btnReplay'),
  btnCooldown: D.getElementById('btnCooldown'),
  btnBack: D.getElementById('btnBack'),
};

const REASONS = [
  { id:'rush', label:'ฉันรีบเกินไป' },
  { id:'wrongzone', label:'ฉันแปรงผิดตำแหน่ง' },
  { id:'skip', label:'ฉันข้ามบางจุด' },
  { id:'analysis', label:'ฉันวิเคราะห์ผิด' },
];

const IMPROVES = [
  { id:'slow', label:'ช้าลงนิดและดูตำแหน่งก่อน' },
  { id:'full', label:'เก็บให้ครบทุกด้าน' },
  { id:'care', label:'ระวังจุดฟันกรามมากขึ้น' },
  { id:'analyze', label:'อ่านหลักฐานก่อนตอบ' },
];

const TARGETS_A = [
  { id:'front',  x:22, y:38, good:true,  label:'ด้านหน้า' },
  { id:'front2', x:42, y:34, good:true,  label:'ด้านหน้า' },
  { id:'molar',  x:72, y:40, good:true,  label:'ฟันกราม' },
  { id:'back',   x:26, y:68, good:true,  label:'ด้านหลัง' },
  { id:'gum',    x:64, y:68, good:false, label:'โดนเหงือกแรงไป' },
  { id:'skip',   x:50, y:52, good:false, label:'ข้ามตำแหน่ง' },
];

const TARGETS_B = [
  { id:'sugar',    x:24, y:34, good:true,  label:'หลักฐาน: กินหวาน', icon:'🍬', kind:'evidence' },
  { id:'night',    x:52, y:30, good:true,  label:'หลักฐาน: ไม่แปรงก่อนนอน', icon:'🌙', kind:'evidence' },
  { id:'no_brush', x:74, y:38, good:true,  label:'หลักฐาน: แปรงไม่ครบ', icon:'🚫🪥', kind:'evidence' },
  { id:'badB1',    x:34, y:66, good:false, label:'เก็บผิดจุด', icon:'⚠️', kind:'hazard' },
  { id:'badB2',    x:64, y:66, good:false, label:'รีบเกินไป', icon:'⚠️', kind:'hazard' },
];

const ANALYSIS_CHOICES = [
  {
    id:'a',
    label:'เพราะถ้าไม่แปรงก่อนนอน คราบอาหารและแบคทีเรียจะค้างอยู่นาน เสี่ยงฟันผุและกลิ่นปาก',
    correct:true
  },
  {
    id:'b',
    label:'เพราะฟันจะโตเร็วขึ้นตอนนอนถ้าแปรงฟัน',
    correct:false
  },
  {
    id:'c',
    label:'เพราะยาสีฟันทำงานเฉพาะตอนนอนเท่านั้น',
    correct:false
  }
];

const S = {
  started:false,
  ended:false,
  paused:false,
  endFlowRedirected:false,

  score:0,
  miss:0,
  combo:0,
  comboMax:0,
  good:0,
  taps:0,

  timeLeft: TIME,
  startMs: 0,
  lastMs: 0,
  raf: 0,

  stage:'A',
  selfReason:'',
  selfRating:0,
  improvePick:'',
  aiSnapshot:null,

  evidenceCollected: new Set(),
  analysisAnswered: false,
  analysisCorrect: false,

  zoneStats: {
    front: { hit:0, miss:0 },
    back:  { hit:0, miss:0 },
    molar: { hit:0, miss:0 },
    gum:   { hit:0, miss:0 },
  },

  spawned: [],
  spawnClock: 0
};

function accPct(){
  return S.taps ? Math.round((S.good / S.taps) * 100) : 0;
}

function setEndPanelScrollMode(on){
  const app = D.getElementById('app');
  const card = UI.panelEnd?.querySelector('.panel-card');

  if (on){
    D.body.style.overflow = 'hidden';
    if (app) app.style.overflow = 'visible';
    try{ UI.panelEnd?.scrollTo(0,0); }catch{}
    try{ card?.scrollTo(0,0); }catch{}
  } else {
    D.body.style.overflow = '';
    if (app) app.style.overflow = '';
    try{ UI.panelEnd?.scrollTo(0,0); }catch{}
    try{ card?.scrollTo(0,0); }catch{}
  }
}

function buildBrushCooldownUrl(){
  const endSummary = UI.endSummary?.textContent?.trim() || '';
  const rubric = UI.selfRubric?.textContent?.trim() || '';
  const rubricDesc = UI.rubricDesc?.textContent?.trim() || '';
  const aiTip = UI.aiTipPill?.textContent?.trim() || '';
  const aiMeta = UI.aiMetaText?.textContent?.trim() || '';

  return buildCooldownUrlForCurrentGame({
    cat: 'hygiene',
    game: 'brush',
    theme: 'brush',
    fallbackHub: '../hub.html',
    extras: {
      endSummary,
      rubric,
      rubricDesc,
      aiTip,
      aiMeta,
      scoreFinal: S.score,
      missFinal: S.miss,
      accFinal: accPct(),
      comboMax: S.comboMax,
      pid: PID,
      seed: SEED
    }
  });
}

function goBrushCooldown(){
  location.href = buildBrushCooldownUrl();
}

function goCooldownOnce(){
  if (S.endFlowRedirected) return;
  S.endFlowRedirected = true;
  goBrushCooldown();
}

function coach(text){
  if (UI.pillCoach) UI.pillCoach.textContent = `COACH: ${text}`;
}

function stageQuestText(){
  if (S.stage === 'A') return 'แตะตำแหน่งที่ควรแปรง';
  if (S.stage === 'B') return `เก็บหลักฐาน ${S.evidenceCollected.size}/3`;
  return S.analysisAnswered ? 'ตอบแล้ว' : 'ตอบคำถามวิเคราะห์';
}

function hud(){
  UI.pillStage && (UI.pillStage.textContent = `STAGE: ${S.stage}`);
  UI.pillQuest && (UI.pillQuest.textContent = `QUEST: ${stageQuestText()}`);
  UI.pillTime && (UI.pillTime.textContent = `TIME: ${Math.max(0, Math.ceil(S.timeLeft))}`);
  UI.pillScore && (UI.pillScore.textContent = `SCORE: ${S.score}`);
  UI.pillMiss && (UI.pillMiss.textContent = `MISS: ${S.miss}`);
  UI.pillCombo && (UI.pillCombo.textContent = `COMBO: ${S.combo}`);
  UI.pillAcc && (UI.pillAcc.textContent = `ACC: ${accPct()}%`);

  const risk = Math.min(100, Math.round((S.miss / Math.max(1, S.good + S.miss)) * 100));
  UI.pillRisk && (UI.pillRisk.textContent = `RISK: ${risk}%`);
}

function clearTargets(){
  S.spawned.forEach(el => { try{ el.remove(); }catch{} });
  S.spawned = [];
  if (UI.targetLayer) UI.targetLayer.innerHTML = '';
}

function clearAnalysisPanel(){
  const old = D.getElementById('analysisPanel');
  if (old) old.remove();
}

function resetGame(){
  S.started = false;
  S.ended = false;
  S.paused = false;
  S.endFlowRedirected = false;

  S.score = 0;
  S.miss = 0;
  S.combo = 0;
  S.comboMax = 0;
  S.good = 0;
  S.taps = 0;
  S.timeLeft = TIME;
  S.stage = 'A';
  S.selfReason = '';
  S.selfRating = 0;
  S.improvePick = '';
  S.aiSnapshot = null;
  S.spawnClock = 0;
  S.lastMs = 0;

  S.evidenceCollected = new Set();
  S.analysisAnswered = false;
  S.analysisCorrect = false;

  S.zoneStats = {
    front: { hit:0, miss:0 },
    back:  { hit:0, miss:0 },
    molar: { hit:0, miss:0 },
    gum:   { hit:0, miss:0 },
  };

  cancelAnimationFrame(S.raf);
  clearTargets();
  clearAnalysisPanel();
  setEndPanelScrollMode(false);
  UI.panelEnd?.classList.add('hidden');

  if (UI.mouthBoard){
    UI.mouthBoard.classList.remove('is-live');
    UI.mouthBoard.style.outline = '';
    UI.mouthBoard.style.boxShadow = '';
  }

  hud();
  coach('เริ่มจากด้านหน้าก่อน');
}

function zoneKey(id){
  if (String(id).startsWith('front')) return 'front';
  if (String(id).startsWith('back')) return 'back';
  if (String(id).startsWith('molar')) return 'molar';
  if (String(id).startsWith('gum')) return 'gum';
  return 'gum';
}

function maybeAdvanceStage(){
  if (S.stage === 'A' && S.score >= 60){
    S.stage = 'B';
    coach('ดีมาก! ต่อไปเก็บหลักฐานว่าอะไรทำให้ฟันผุ');
    clearTargets();
    S.spawnClock = 0;
  } else if (S.stage === 'B' && S.evidenceCollected.size >= 3){
    S.stage = 'C';
    coach('ครบหลักฐานแล้ว ต่อไปตอบคำถามวิเคราะห์');
    clearTargets();
    openAnalysisPanel();
  }
}

function registerHit(target){
  const zKey = zoneKey(target.id);
  S.taps++;

  if (target.good){
    S.good++;
    S.score += target.kind === 'evidence' ? 15 : 10;
    S.combo++;
    S.comboMax = Math.max(S.comboMax, S.combo);
    if (S.zoneStats[zKey]) S.zoneStats[zKey].hit++;

    if (target.kind === 'evidence') {
      S.evidenceCollected.add(target.id);
      coach(`เก็บหลักฐานแล้ว ${S.evidenceCollected.size}/3`);
    }
  } else {
    S.miss++;
    S.combo = 0;
    S.score = Math.max(0, S.score - 2);
    if (S.zoneStats[zKey]) S.zoneStats[zKey].miss++;
    coach(target.label || 'ช้าลงนิดแล้วดูตำแหน่ง');
  }

  maybeAdvanceStage();
  hud();
}

function currentSpawnPool(){
  if (S.stage === 'A') return TARGETS_A;
  if (S.stage === 'B') {
    return TARGETS_B.filter(t => t.kind !== 'evidence' || !S.evidenceCollected.has(t.id));
  }
  return [];
}

function spawnTarget(){
  if (!UI.targetLayer || !UI.mouthBoard) return;
  if (S.stage === 'C') return;

  const pool = currentSpawnPool();
  if (!pool.length) return;

  const target = pool[Math.floor(Math.random() * pool.length)];
  const el = D.createElement('button');
  el.type = 'button';
  el.className = `brush-target ${target.good ? 'good' : 'bad'}`;
  el.textContent = target.icon || (target.good ? '🫧' : '⚠️');
  el.title = target.label;
  el.style.position = 'absolute';
  el.style.left = `${target.x}%`;
  el.style.top = `${target.y}%`;
  el.style.transform = 'translate(-50%, -50%)';
  el.style.border = '1px solid rgba(148,163,184,.28)';
  el.style.borderRadius = '999px';
  el.style.minWidth = '52px';
  el.style.minHeight = '52px';
  el.style.fontSize = target.kind === 'evidence' ? '22px' : '24px';
  el.style.fontWeight = '900';
  el.style.cursor = 'pointer';
  el.style.pointerEvents = 'auto';
  el.style.background = target.good
    ? (target.kind === 'evidence' ? 'rgba(251,191,36,.18)' : 'rgba(34,197,94,.18)')
    : 'rgba(239,68,68,.18)';
  el.style.color = '#fff';
  el.style.boxShadow = '0 6px 18px rgba(0,0,0,.22)';

  const removeLater = setTimeout(()=>{
    try{ el.remove(); }catch{}
    S.spawned = S.spawned.filter(x => x !== el);
  }, target.kind === 'evidence' ? 1500 : 1100);

  el.addEventListener('pointerdown', (e)=>{
    e.preventDefault();
    clearTimeout(removeLater);
    registerHit(target);
    try{ el.remove(); }catch{}
    S.spawned = S.spawned.filter(x => x !== el);
  }, { passive:false });

  UI.targetLayer.appendChild(el);
  S.spawned.push(el);
}

function openAnalysisPanel(){
  if (!UI.targetLayer) return;
  clearAnalysisPanel();

  const wrap = D.createElement('div');
  wrap.id = 'analysisPanel';
  wrap.style.position = 'absolute';
  wrap.style.left = '50%';
  wrap.style.top = '50%';
  wrap.style.transform = 'translate(-50%,-50%)';
  wrap.style.width = 'min(520px,92%)';
  wrap.style.maxWidth = '92%';
  wrap.style.background = 'rgba(2,6,23,.88)';
  wrap.style.border = '1px solid rgba(148,163,184,.20)';
  wrap.style.borderRadius = '20px';
  wrap.style.padding = '16px';
  wrap.style.boxShadow = '0 18px 60px rgba(0,0,0,.35)';
  wrap.style.zIndex = '20';

  const title = D.createElement('h3');
  title.textContent = 'Stage C: วิเคราะห์';
  title.style.margin = '0 0 8px';
  title.style.fontSize = '18px';

  const p = D.createElement('p');
  p.textContent = 'ทำไม “ก่อนนอน” จึงเป็นเวลาสำคัญมากในการแปรงฟัน?';
  p.style.margin = '0 0 12px';
  p.style.color = 'rgba(229,231,235,.82)';

  const list = D.createElement('div');
  list.style.display = 'grid';
  list.style.gap = '8px';

  ANALYSIS_CHOICES.forEach(choice=>{
    const b = D.createElement('button');
    b.className = 'btn';
    b.textContent = choice.label;
    b.style.textAlign = 'left';
    b.style.whiteSpace = 'normal';
    b.addEventListener('click', ()=>{
      S.analysisAnswered = true;
      S.analysisCorrect = !!choice.correct;
      S.taps++;
      if (choice.correct){
        S.good++;
        S.score += 25;
        S.combo++;
        S.comboMax = Math.max(S.comboMax, S.combo);
        coach('ตอบถูก! เข้าใจเหตุผลของการแปรงฟัน');
      } else {
        S.miss++;
        S.combo = 0;
        coach('ยังไม่ถูก ลองทบทวนหลักฐานอีกครั้ง');
      }
      hud();
      clearAnalysisPanel();
      endGame(choice.correct ? 'analysis-pass' : 'analysis-wrong');
    });
    list.appendChild(b);
  });

  wrap.appendChild(title);
  wrap.appendChild(p);
  wrap.appendChild(list);
  UI.targetLayer.appendChild(wrap);
}

function loop(){
  if (!S.started || S.ended || S.paused) return;

  const t = now();
  const dt = S.lastMs ? (t - S.lastMs) / 1000 : 0.016;
  S.lastMs = t;

  S.timeLeft = Math.max(0, S.timeLeft - dt);
  S.spawnClock += dt;

  hud();

  if (S.timeLeft <= 0){
    endGame('timeout');
    return;
  }

  const spawnEvery =
    DIFF === 'hard' ? 0.55 :
    DIFF === 'easy' ? 0.95 :
    0.75;

  if (S.stage !== 'C' && S.spawnClock >= spawnEvery){
    S.spawnClock = 0;
    spawnTarget();
  }

  S.raf = requestAnimationFrame(loop);
}

function renderHeatmap(){
  if (!UI.heatmap) return;
  UI.heatmap.innerHTML = '';

  Object.entries(S.zoneStats).forEach(([k,v])=>{
    const total = v.hit + v.miss;
    const pct = total ? Math.round((v.hit / total) * 100) : 0;
    const cls = pct >= 80 ? 'good' : pct >= 55 ? 'mid' : 'bad';

    const card = D.createElement('div');
    card.className = `hm ${cls}`;
    card.innerHTML = `<div class="t">${k}</div><div class="v">${pct}%</div>`;
    UI.heatmap.appendChild(card);
  });
}

function renderChips(container, list, get, set){
  if (!container) return;
  container.innerHTML = '';
  list.forEach(o=>{
    const b = D.createElement('button');
    b.className = `chip ${get()===o.id?'on':''}`;
    b.textContent = o.label;
    b.addEventListener('click', ()=>{
      set(o.id);
      renderChips(container, list, get, set);
    });
    container.appendChild(b);
  });
}

function renderStars(){
  if (!UI.stars) return;
  UI.stars.innerHTML = '';
  for(let i=1;i<=5;i++){
    const b = D.createElement('button');
    b.className = `star ${S.selfRating>=i?'on':''}`;
    b.textContent = '★';
    b.addEventListener('click', ()=>{
      S.selfRating = i;
      renderStars();
    });
    UI.stars.appendChild(b);
  }
}

function autoReasonSuggestion(){
  if (S.stage === 'C' && !S.analysisCorrect) return 'analysis';
  if (S.zoneStats.gum.miss > 1) return 'wrongzone';
  if (S.miss >= 5) return 'rush';
  return 'skip';
}

function autoImproveSuggestion(){
  if (S.stage === 'C' && !S.analysisCorrect) return 'analyze';
  if (S.zoneStats.molar.miss > 0) return 'care';
  if (accPct() < 70) return 'slow';
  return 'full';
}

function renderAIExplain(){
  const risk = Math.min(100, Math.round((S.miss / Math.max(1, S.good + S.miss)) * 100));
  let tip = 'แปรงให้ครบทุกด้านและคุมจังหวะ';
  const causes = [];

  if (S.zoneStats.molar.miss > 0) causes.push('ฟันกรามยังพลาดบ่อย');
  if (S.zoneStats.gum.miss > 0) causes.push('แนวเหงือกยังกดผิดตำแหน่ง');
  if (S.stage === 'C' && !S.analysisCorrect) causes.push('การวิเคราะห์เหตุผลยังไม่แม่น');
  if (risk >= 35) causes.push('ความเสี่ยงจากการกดพลาดยังสูง');

  if (S.stage === 'C' && S.analysisCorrect) tip = 'ดีมาก เข้าใจเหตุผลของการแปรงก่อนนอนแล้ว';
  else if (S.stage === 'C') tip = 'อ่านหลักฐานให้ช้าลงก่อนตอบ';
  else if (S.miss >= 5) tip = 'ลดความเร็วลง แล้วมองตำแหน่งก่อนแตะ';

  S.aiSnapshot = { tip, causes, risk };

  UI.aiTipPill && (UI.aiTipPill.textContent = `AI TIP: ${tip}`);
  if (UI.aiCauseChips){
    UI.aiCauseChips.innerHTML = '';
    causes.slice(0,3).forEach(c=>{
      const el = D.createElement('div');
      el.className = 'chip on';
      el.textContent = c;
      UI.aiCauseChips.appendChild(el);
    });
  }
  UI.aiMetaText && (UI.aiMetaText.textContent =
    `หลักฐาน: score ${S.score} • miss ${S.miss} • acc ${accPct()}% • risk ${risk}% • evidence ${S.evidenceCollected.size}/3 • analysis ${S.analysisCorrect ? 'pass' : 'not-pass'}`
  );
}

function endGame(reason='complete'){
  if (S.ended) return;
  S.ended = true;
  S.started = false;
  cancelAnimationFrame(S.raf);
  clearTargets();
  clearAnalysisPanel();

  if (!S.selfReason) S.selfReason = autoReasonSuggestion();
  if (!S.improvePick) S.improvePick = autoImproveSuggestion();

  renderHeatmap();
  renderStars();
  renderChips(UI.reasonChips, REASONS, ()=>S.selfReason, v=>S.selfReason=v);
  renderChips(UI.improveChips, IMPROVES, ()=>S.improvePick, v=>S.improvePick=v);
  renderAIExplain();

  const pass = accPct() >= 70 && S.score >= 100 && S.analysisCorrect;
  UI.selfRubric && (UI.selfRubric.textContent = `RUBRIC: ${pass ? 'PASS' : 'TRY AGAIN'}`);
  UI.rubricDesc && (UI.rubricDesc.textContent =
    `Score ${S.score} • Acc ${accPct()}% • Miss ${S.miss} • ComboMax ${S.comboMax} • Evidence ${S.evidenceCollected.size}/3 • Analysis ${S.analysisCorrect ? 'PASS' : 'NOT PASS'}`
  );

  if (UI.endSummary){
    UI.endSummary.innerHTML =
      `Mode <b>${RUN}</b> • Diff <b>${DIFF}</b><br>` +
      `SCORE <b>${S.score}</b> • ACC <b>${accPct()}%</b> • MISS <b>${S.miss}</b><br>` +
      `หลักฐาน <b>${S.evidenceCollected.size}/3</b> • วิเคราะห์ <b>${S.analysisCorrect ? 'ถูก' : 'ยังไม่ถูก'}</b><br>` +
      `จบด้วย: <b>${reason}</b><br>` +
      `<b>${pass ? 'แนะนำ: ไป Cooldown' : 'แนะนำ: เล่นใหม่และเก็บให้ครบ'}</b>`;
  }

  if (UI.btnCooldown){
    UI.btnCooldown.textContent = '➡ ไป Cooldown';
    UI.btnCooldown.disabled = false;
  }

  UI.panelEnd?.classList.remove('hidden');
  setEndPanelScrollMode(true);
}

function startGame(){
  resetGame();
  S.started = true;
  S.startMs = now();
  S.lastMs = 0;

  if (UI.mouthBoard){
    UI.mouthBoard.classList.add('is-live');
    UI.mouthBoard.style.outline = '2px solid rgba(34,211,238,.45)';
    UI.mouthBoard.style.boxShadow = '0 0 0 4px rgba(34,211,238,.10), 0 10px 30px rgba(0,0,0,.28)';
  }

  coach('เริ่มจากด้านหน้าก่อน');
  hud();
  S.raf = requestAnimationFrame(loop);
}

function goHub(){
  location.href = HUB;
}

UI.btnHelp?.addEventListener('click', ()=> UI.panelHelp?.classList.remove('hidden'));
UI.btnCloseHelp?.addEventListener('click', ()=> UI.panelHelp?.classList.add('hidden'));
UI.btnStart?.addEventListener('click', startGame);
UI.btnReplay?.addEventListener('click', ()=>{
  UI.panelEnd?.classList.add('hidden');
  setEndPanelScrollMode(false);
  startGame();
});
UI.btnCooldown?.addEventListener('click', goCooldownOnce);
UI.btnBack?.addEventListener('click', goHub);

resetGame();