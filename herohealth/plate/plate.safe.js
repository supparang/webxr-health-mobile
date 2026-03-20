/* === /herohealth/plate/plate.safe.js ===
   HeroHealth Plate Engine
   FINAL PATCH v20260320-PLATE-SAFE-MODULE-COMPACT-CHILD-FRIENDLY
*/
'use strict';

const WIN = window;
const DOC = document;

const GROUPS = [
  { id:1, key:'protein', label:'โปรตีน', icon:'🐟', good:['🐟','🥚','🍗','🫘'] },
  { id:2, key:'carb',    label:'ข้าว/แป้ง', icon:'🍚', good:['🍚','🍞','🥔','🍠'] },
  { id:3, key:'veg',     label:'ผัก', icon:'🥦', good:['🥦','🥬','🥕','🥒'] },
  { id:4, key:'fruit',   label:'ผลไม้', icon:'🍎', good:['🍎','🍌','🍉','🍇'] },
  { id:5, key:'fat',     label:'ไขมันดี', icon:'🥑', good:['🥑','🥜','🫒','🥥'] }
];

const WRONG_POOL = ['🍩','🥤','🍟','🧁','🍭','🍔','🍫'];

const clamp = (v,a,b)=>{
  v = Number(v);
  if(!Number.isFinite(v)) v = a;
  return Math.max(a, Math.min(b, v));
};

function xmur3(str){
  str = String(str || '');
  let h = 1779033703 ^ str.length;
  for(let i=0;i<str.length;i++){
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function(){
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  };
}

function sfc32(a,b,c,d){
  return function(){
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

function makeRng(seedStr){
  const s = xmur3(String(seedStr || '0'));
  return sfc32(s(), s(), s(), s());
}

function rectOf(el){
  try{
    if(!el) return null;
    const r = el.getBoundingClientRect?.();
    if(!r) return null;
    if(!Number.isFinite(r.left) || !Number.isFinite(r.top)) return null;
    return r;
  }catch(_){
    return null;
  }
}

function intersect(a, b){
  if(!a || !b) return false;
  return !(
    a.right <= b.left ||
    a.left >= b.right ||
    a.bottom <= b.top ||
    a.top >= b.bottom
  );
}

function overlayOpen(){
  const el = DOC.getElementById('endOverlay');
  return !!(el && el.getAttribute('aria-hidden') === 'false');
}

function drawerOpen(){
  const el = DOC.getElementById('plateDrawer');
  return !!(el && el.getAttribute('aria-hidden') === 'false');
}

function childCoachText(kind, data = {}){
  const target = String(data.target || '').trim();
  switch(String(kind || '')){
    case 'warm': return `WARM: ยิง “${target || 'หมู่เป้าหมาย'}” ชัด ๆ`;
    case 'trick': return 'TRICK: ดูดี ๆ ก่อนยิง มีตัวหลอกนะ';
    case 'boss': return 'BOSS: เติมจานให้ครบ 5 หมู่';
    case 'good': return 'ดีมาก! เก็บต่อเลย';
    case 'wrong': return 'เกือบถูกแล้ว ลองใหม่อีกครั้ง';
    case 'miss': return 'ไม่เป็นไร ลองใหม่อีกครั้ง';
    case 'shield': return 'ได้โล่แล้ว! กันพลาดได้ 1 ครั้ง';
    case 'fever': return 'Fever มาแล้ว! รีบเก็บแต้ม';
    case 'phase-clear': return 'ผ่านด่านแล้ว ไปต่อเลย';
    default: return 'เริ่มเลย! ยิงอาหารให้ครบ 5 หมู่ 🥦🍚🐟';
  }
}

function friendlyPhaseLabel(phase){
  switch(String(phase || '').toLowerCase()){
    case 'warm': return 'WARM';
    case 'trick': return 'TRICK';
    case 'boss': return 'BOSS';
    default: return String(phase || 'PLAY').toUpperCase();
  }
}

function friendlyTargetText(label){
  const raw = String(label || '').trim();
  if(!raw) return 'ยิงหมู่เป้าหมาย';
  return `ยิง “${raw}”`;
}

function gradeOf(acc){
  if(acc >= 90) return 'S';
  if(acc >= 75) return 'A';
  if(acc >= 60) return 'B';
  if(acc >= 40) return 'C';
  return 'D';
}

function setText(id, text){
  const el = DOC.getElementById(id);
  if(el) el.textContent = String(text ?? '');
}

function setWidth(id, pct){
  const el = DOC.getElementById(id);
  if(el) el.style.width = `${clamp(pct, 0, 100)}%`;
}

function nowMs(){
  return (performance && performance.now) ? performance.now() : Date.now();
}

function copyToClipboard(text){
  try{
    if(navigator.clipboard?.writeText){
      return navigator.clipboard.writeText(text);
    }
  }catch(_){}
  return Promise.reject(new Error('clipboard unavailable'));
}

function dayKey(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function saveJson(key, value){
  try{ localStorage.setItem(key, JSON.stringify(value)); }catch(_){}
}

const S = {
  mount: null,
  ctx: null,
  rng: null,

  running: false,
  paused: false,
  ended: false,

  raf: 0,
  lastTick: 0,

  phase: 'warm',
  phaseIndex: 0,
  phaseList: ['warm', 'trick', 'boss'],
  phaseDurations: [0,0,0],
  phaseTimeLeft: 0,
  totalTimeLeft: 0,

  targetGroup: null,
  spawnAcc: 0,

  targets: new Map(),
  nextId: 1,

  score: 0,
  combo: 0,
  comboMax: 0,
  miss: 0,
  hits: 0,
  wrong: 0,
  shots: 0,

  fever: 0,
  feverOn: false,
  feverTimer: 0,
  shield: 0,

  counts: { 1:0, 2:0, 3:0, 4:0, 5:0 },
  plateHave: 0,

  coop: {
    enabled: false,
    active: 'A',
    turnLeft: 0,
    turnLen: 12,
    A: { score:0, ok:0, wrong:0 },
    B: { score:0, ok:0, wrong:0 }
  },

  ai: null,
  hub: '../hub.html',
  cooldownEnabled: false,
  cooldownDone: false,

  targetCorrectP: 0.72,
  spawnPerSec: 0.95,
  ttl: 3.2,
  missLimit: 999
};

function setCoach(kind, data = {}){
  setText('coachMsg', childCoachText(kind, data));
}

function plateCountDistinct(){
  let n = 0;
  for(let i=1;i<=5;i++){
    if((S.counts[i] || 0) > 0) n++;
  }
  return n;
}

function resetCounts(){
  for(let i=1;i<=5;i++) S.counts[i] = 0;
}

function pick(arr){
  return arr[(S.rng() * arr.length) | 0];
}

function showPhaseBanner(kind){
  let text = 'เริ่มเลย';
  if(kind === 'warm') text = 'WARM • เริ่มเก็บก่อน';
  else if(kind === 'trick') text = 'TRICK • ระวังตัวหลอก';
  else if(kind === 'boss') text = 'BOSS • เติมจานให้ครบ';

  const d = DOC.createElement('div');
  d.className = 'phaseBanner';
  d.textContent = text;
  DOC.getElementById('app')?.appendChild(d);
  setTimeout(()=>{ try{ d.remove(); }catch(_){} }, 950);
}

function setPhase(index){
  S.phaseIndex = clamp(index, 0, S.phaseList.length - 1);
  S.phase = S.phaseList[S.phaseIndex];
  S.phaseTimeLeft = S.phaseDurations[S.phaseIndex];

  if(S.phase === 'warm'){
    S.targetCorrectP = 0.78;
    S.spawnPerSec = 0.90;
    S.ttl = 3.4;
    S.targetGroup = pick(GROUPS);
    setCoach('warm', { target: S.targetGroup.label });
    showPhaseBanner('warm');
  } else if(S.phase === 'trick'){
    S.targetCorrectP = 0.65;
    S.spawnPerSec = 1.00;
    S.ttl = 3.0;
    S.targetGroup = pick(GROUPS);
    setCoach('trick', { target: S.targetGroup.label });
    showPhaseBanner('trick');
  } else {
    S.targetCorrectP = 0.72;
    S.spawnPerSec = 1.05;
    S.ttl = 2.8;
    S.targetGroup = pick(GROUPS);
    setCoach('boss', { target: S.targetGroup.label });
    showPhaseBanner('boss');
  }

  if(S.ctx?.view === 'mobile'){
    S.spawnPerSec *= 0.90;
    S.ttl += 0.24;
    S.missLimit += 2;
  }

  updateHud();
}

function safeSpawnRect(){
  const layer = S.mount;
  const r = layer.getBoundingClientRect();

  const isMobile = (S.ctx?.view === 'mobile');
  const isVRLike = (S.ctx?.view === 'cvr' || S.ctx?.view === 'vr');

  const padX = isMobile ? 14 : 18;
  let left = r.left + padX;
  let right = r.right - padX;

  let top = r.top + (isMobile ? 128 : 118);
  let bottom = r.bottom - (isMobile ? 118 : 92);

  const hudTop = rectOf(DOC.getElementById('hudTop'));
  const hudBottom = rectOf(DOC.getElementById('hudBottom'));
  const drawer = rectOf(DOC.getElementById('plateDrawer'));

  if(hudTop && intersect(r, hudTop)){
    top = Math.max(top, hudTop.bottom + (isMobile ? 12 : 10));
  }

  if(hudBottom && intersect(r, hudBottom)){
    bottom = Math.min(bottom, hudBottom.top - (isMobile ? 16 : 12));
  }

  if(drawerOpen() && drawer && intersect(r, drawer)){
    bottom = Math.min(bottom, drawer.top - 12);
  }

  if(overlayOpen()){
    return {
      left: r.left + 9999,
      right: r.left + 10000,
      top: r.top + 9999,
      bottom: r.top + 10000,
      width: 1,
      height: 1
    };
  }

  if(isVRLike){
    top += 8;
    bottom -= 6;
  }

  const minHeight = isMobile ? 180 : 160;
  if(bottom - top < minHeight){
    top = Math.max(r.top + 96, top - 18);
    bottom = Math.min(r.bottom - 88, bottom + 18);
  }

  return {
    left, right, top, bottom,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top)
  };
}

function chooseTarget(){
  const isCorrect = S.rng() < S.targetCorrectP;
  if(isCorrect){
    const g = S.targetGroup;
    return {
      groupId: g.id,
      label: g.label,
      emoji: pick(g.good),
      good: true
    };
  }

  if(S.phase === 'boss' && S.rng() < 0.5){
    const wrong = pick(WRONG_POOL);
    return {
      groupId: 0,
      label: 'ตัวหลอก',
      emoji: wrong,
      good: false
    };
  }

  const other = pick(GROUPS.filter(g => g.id !== S.targetGroup.id));
  return {
    groupId: other.id,
    label: other.label,
    emoji: pick(other.good),
    good: false
  };
}

function createTarget(){
  if(overlayOpen()) return;
  if(drawerOpen()) return;

  const safe = safeSpawnRect();
  const x = safe.left + S.rng() * safe.width;
  const y = safe.top + S.rng() * safe.height;

  const info = chooseTarget();
  const id = String(S.nextId++);
  const el = DOC.createElement('button');
  el.type = 'button';
  el.className = 'plateTarget';
  el.dataset.id = id;
  el.textContent = info.emoji;

  if(info.good && S.rng() < 0.08){
    el.dataset.kind = 'shield';
    info.kind = 'shield';
  } else {
    info.kind = 'food';
  }

  el.style.left = `${x}px`;
  el.style.top = `${y}px`;

  const born = nowMs();
  const ttlMs = (S.feverOn ? (S.ttl * 0.9) : S.ttl) * 1000;

  S.mount.appendChild(el);
  S.targets.set(id, {
    id, el, x, y,
    born, ttlMs,
    good: info.good,
    groupId: info.groupId,
    label: info.label,
    emoji: info.emoji,
    kind: info.kind
  });

  el.addEventListener('pointerdown', onHit, { passive:true });
}

function removeTarget(t, mode){
  if(!t || !t.el) return;
  S.targets.delete(t.id);
  try{
    t.el.classList.add(mode === 'hit' ? 'hit' : 'expire');
    t.el.removeEventListener('pointerdown', onHit);
    setTimeout(()=>{ try{ t.el.remove(); }catch(_){} }, 140);
  }catch(_){
    try{ t.el.remove(); }catch(__){}
  }
}

function awardCorrect(t){
  S.hits++;
  S.shots++;
  S.combo++;
  S.comboMax = Math.max(S.comboMax, S.combo);

  let add = 10 + Math.min(10, S.combo);
  if(S.phase === 'boss') add += 4;
  if(S.feverOn) add += 4;

  S.score += add;
  S.fever = clamp(S.fever + 14, 0, 100);

  if(t.kind === 'shield'){
    S.shield = Math.min(3, S.shield + 1);
    setCoach('shield');
  } else {
    setCoach('good', { target: S.targetGroup?.label });
  }

  if(t.groupId >= 1 && t.groupId <= 5){
    S.counts[t.groupId] = (S.counts[t.groupId] || 0) + 1;
    S.plateHave = plateCountDistinct();
  }

  if(S.coop.enabled){
    const p = S.coop.active;
    S.coop[p].score += add;
    S.coop[p].ok += 1;
  }

  showPop(t.x, t.y, `+${add}`);
  if(S.fever >= 100 && !S.feverOn){
    S.feverOn = true;
    S.feverTimer = 6;
    setCoach('fever');
  }
}

function awardWrong(){
  S.shots++;
  S.wrong++;
  S.combo = 0;

  if(S.shield > 0){
    S.shield--;
  } else {
    S.score = Math.max(0, S.score - 3);
    S.miss++;
  }

  if(S.coop.enabled){
    const p = S.coop.active;
    S.coop[p].wrong += 1;
  }

  setCoach('wrong', { target: S.targetGroup?.label });
}

function onHit(ev){
  if(!S.running || S.paused || S.ended) return;
  const el = ev.currentTarget;
  const t = S.targets.get(String(el.dataset.id));
  if(!t) return;

  if(t.good && t.groupId === S.targetGroup.id){
    awardCorrect(t);
    removeTarget(t, 'hit');
  } else {
    awardWrong();
    removeTarget(t, 'hit');
  }

  updateHud();
}

function showPop(x, y, text){
  try{
    const r = S.mount.getBoundingClientRect();
    const d = DOC.createElement('div');
    d.className = 'popScore';
    d.textContent = text;
    d.style.left = `${x - r.left}px`;
    d.style.top = `${y - r.top}px`;
    S.mount.appendChild(d);
    setTimeout(()=>{ try{ d.remove(); }catch(_){} }, 560);
  }catch(_){}
}

function accuracyPct(){
  return S.shots > 0 ? Math.round((S.hits / S.shots) * 100) : 0;
}

function updateHud(){
  setText('uiScore', S.score);
  setText('uiCombo', S.combo);
  setText('uiComboMax', S.comboMax);
  setText('uiMiss', S.miss);
  setText('uiPlateHave', S.plateHave);
  setText('uiAcc', `${accuracyPct()}%`);
  setText('uiGrade', gradeOf(accuracyPct()));
  setText('uiTime', Math.ceil(Math.max(0, S.totalTimeLeft)));
  setText('uiShield', S.shield);
  setText('uiFever', `${Math.round(S.fever)}%`);
  setText('uiTargetText', friendlyTargetText(S.targetGroup?.label));
  setText('uiPhase', friendlyPhaseLabel(S.phase));

  const phaseTotal = Math.max(1, S.phaseDurations[S.phaseIndex] || 1);
  const phaseDone = Math.round(((phaseTotal - S.phaseTimeLeft) / phaseTotal) * 100);
  setText('uiPhaseProg', `${Math.max(0, phaseTotal - Math.ceil(S.phaseTimeLeft))}/${phaseTotal}`);
  setWidth('uiGoalFill', phaseDone);
  setWidth('uiFeverFill', S.fever);

  for(let i=1;i<=5;i++){
    setText(`uiG${i}`, S.counts[i] || 0);
  }

  if(S.coop.enabled){
    setText('uiCoopA', S.coop.A.score);
    setText('uiCoopB', S.coop.B.score);
    setText('uiTurnLeft', Math.ceil(S.coop.turnLeft));
    setText('uiTurnActive', S.coop.active);
  }
}

function clearTargets(){
  for(const t of S.targets.values()){
    try{
      t.el.removeEventListener('pointerdown', onHit);
      t.el.remove();
    }catch(_){}
  }
  S.targets.clear();
}

function phaseAdvance(){
  clearTargets();
  S.spawnAcc = 0;

  if(S.phaseIndex < S.phaseList.length - 1){
    setCoach('phase-clear');
    setPhase(S.phaseIndex + 1);
  } else {
    endGame('time');
  }
}

function updateTargets(dt){
  const now = nowMs();

  for(const t of Array.from(S.targets.values())){
    if(now - t.born >= t.ttlMs){
      if(t.good && t.groupId === S.targetGroup.id){
        if(S.shield > 0){
          S.shield--;
        } else {
          S.miss++;
          S.combo = 0;
        }
        setCoach('miss', { target: S.targetGroup?.label });
      }
      removeTarget(t, 'expire');
    }
  }

  if(overlayOpen()) return;
  if(drawerOpen()) return;

  S.spawnAcc += S.spawnPerSec * dt;
  const cap = (S.ctx?.view === 'mobile') ? 5 : 7;

  while(S.spawnAcc >= 1){
    S.spawnAcc -= 1;
    if(S.targets.size < cap){
      createTarget();
    }
  }
}

function updateFever(dt){
  if(!S.feverOn) return;
  S.feverTimer -= dt;
  if(S.feverTimer <= 0){
    S.feverOn = false;
    S.fever = 0;
  }
}

function updateCoop(dt){
  if(!S.coop.enabled) return;
  S.coop.turnLeft -= dt;
  if(S.coop.turnLeft <= 0){
    S.coop.active = (S.coop.active === 'A') ? 'B' : 'A';
    S.coop.turnLeft = S.coop.turnLen;
  }
}

function loop(ts){
  if(!S.running) return;
  if(S.paused || overlayOpen()){
    S.lastTick = ts;
    S.raf = requestAnimationFrame(loop);
    return;
  }

  const dt = Math.min(0.05, Math.max(0.001, (ts - S.lastTick) / 1000));
  S.lastTick = ts;

  S.totalTimeLeft = Math.max(0, S.totalTimeLeft - dt);
  S.phaseTimeLeft = Math.max(0, S.phaseTimeLeft - dt);

  updateFever(dt);
  updateCoop(dt);
  updateTargets(dt);
  updateHud();

  if(S.phaseTimeLeft <= 0){
    phaseAdvance();
    if(!S.running) return;
  }

  S.raf = requestAnimationFrame(loop);
}

function buildCooldownUrl(){
  try{
    const u = new URL('../cooldown-gate.html', location.href);
    u.searchParams.set('gatePhase', 'cooldown');
    u.searchParams.set('cat', 'nutrition');
    u.searchParams.set('theme', 'platev1');
    u.searchParams.set('game', 'platev1');
    u.searchParams.set('pid', String(S.ctx.pid || 'anon'));
    u.searchParams.set('hub', String(S.hub || '../hub.html'));
    u.searchParams.set('next', String(S.hub || '../hub.html'));
    return u.toString();
  }catch(_){
    return String(S.hub || '../hub.html');
  }
}

function buildSummary(){
  const acc = accuracyPct();
  return {
    game: 'platev1',
    reason: 'end',
    phase: S.phase,
    scoreFinal: S.score,
    grade: gradeOf(acc),
    accPct: acc,
    ok: S.hits,
    wrong: S.wrong,
    miss: S.miss,
    comboMax: S.comboMax,
    plateHave: S.plateHave,
    counts: { ...S.counts },
    mode: S.ctx.mode,
    diff: S.ctx.diff,
    view: S.ctx.view,
    seed: S.ctx.seed,
    pid: S.ctx.pid
  };
}

function endGame(reason){
  if(S.ended) return;
  S.ended = true;
  S.running = false;
  try{ cancelAnimationFrame(S.raf); }catch(_){}
  clearTargets();

  const sum = buildSummary();
  sum.reason = reason || 'end';

  saveJson(`HHA_LAST_SUMMARY:platev1:${S.ctx.pid || 'anon'}`, sum);
  saveJson('HHA_LAST_SUMMARY', { ...sum, game:'platev1' });

  const endOverlay = DOC.getElementById('endOverlay');
  const btnNextCooldown = DOC.getElementById('btnNextCooldown');

  setText('endTitle', 'เก่งมาก! จบเกมแล้ว 🎉');
  setText('endSub', `mode=${S.ctx.mode} • diff=${S.ctx.diff} • view=${S.ctx.view} • phase=${friendlyPhaseLabel(S.phase)}`);
  setText('endGrade', sum.grade);
  setText('endScore', sum.scoreFinal);
  setText('endOk', sum.ok);
  setText('endWrong', sum.wrong);

  if(S.coop.enabled){
    DOC.getElementById('coopSummary')?.classList.remove('is-hidden');
    setText('endCoopA', S.coop.A.score);
    setText('endCoopB', S.coop.B.score);
    setText('endCoopAStats', `${S.coop.A.ok} / ${S.coop.A.wrong}`);
    setText('endCoopBStats', `${S.coop.B.ok} / ${S.coop.B.wrong}`);
  } else {
    DOC.getElementById('coopSummary')?.classList.add('is-hidden');
  }

  const doneKey = `HHA_GATE_DONE:platev1:cooldown:${dayKey()}:${S.ctx.pid || 'anon'}`;
  S.cooldownDone = !!localStorage.getItem(doneKey);

  if(S.cooldownEnabled && !S.cooldownDone){
    btnNextCooldown?.classList.remove('is-hidden');
  } else {
    btnNextCooldown?.classList.add('is-hidden');
  }

  endOverlay?.setAttribute('aria-hidden', 'false');
}

function wireEndButtons(){
  const btnCopy = DOC.getElementById('btnCopy');
  const btnReplay = DOC.getElementById('btnReplay');
  const btnBackHub2 = DOC.getElementById('btnBackHub2');
  const btnNextCooldown = DOC.getElementById('btnNextCooldown');

  btnCopy?.addEventListener('click', async ()=>{
    const sum = buildSummary();
    const text =
`Plate V1 Summary
score=${sum.scoreFinal}
grade=${sum.grade}
ok=${sum.ok}
wrong=${sum.wrong}
miss=${sum.miss}
acc=${sum.accPct}%
comboMax=${sum.comboMax}
plateHave=${sum.plateHave}/5`;
    try{
      await copyToClipboard(text);
      setCoach('good');
    }catch(_){}
  });

  btnReplay?.addEventListener('click', ()=>{
    try{
      const u = new URL(location.href);
      if(S.ctx.run !== 'research'){
        u.searchParams.set('seed', String((Date.now() ^ (Math.random()*1e9))|0));
      }
      location.href = u.toString();
    }catch(_){
      location.reload();
    }
  });

  btnBackHub2?.addEventListener('click', ()=>{
    location.href = String(S.hub || '../hub.html');
  });

  btnNextCooldown?.addEventListener('click', ()=>{
    location.href = buildCooldownUrl();
  });
}

function boot(ctx){
  S.ctx = {
    mount: ctx.mount,
    view: String(ctx.view || 'mobile').toLowerCase(),
    run: String(ctx.run || 'play').toLowerCase(),
    diff: String(ctx.diff || 'normal').toLowerCase(),
    mode: String(ctx.mode || 'solo').toLowerCase(),
    seed: String(ctx.seed || Date.now()),
    pid: String(ctx.pid || 'anon'),
    time: clamp(ctx.time || 90, 30, 300),
    pro: !!ctx.pro
  };
  S.mount = ctx.mount;
  S.ai = ctx.ai || null;
  S.hub = String(ctx.hub || '../hub.html');
  S.cooldownEnabled = !!ctx.cooldown;

  S.rng = makeRng(S.ctx.seed);

  S.running = true;
  S.paused = false;
  S.ended = false;

  S.score = 0;
  S.combo = 0;
  S.comboMax = 0;
  S.miss = 0;
  S.hits = 0;
  S.wrong = 0;
  S.shots = 0;
  S.fever = 0;
  S.feverOn = false;
  S.feverTimer = 0;
  S.shield = 0;
  S.spawnAcc = 0;
  S.nextId = 1;
  S.targets.clear();
  resetCounts();
  S.plateHave = 0;
  S.missLimit = 999;

  S.coop.enabled = (S.ctx.mode === 'coop');
  S.coop.active = 'A';
  S.coop.turnLen = 12;
  S.coop.turnLeft = S.coop.turnLen;
  S.coop.A = { score:0, ok:0, wrong:0 };
  S.coop.B = { score:0, ok:0, wrong:0 };

  const total = S.ctx.time;
  const warm = Math.max(12, Math.round(total * 0.34));
  const trick = Math.max(10, Math.round(total * 0.33));
  const boss = Math.max(8, total - warm - trick);
  S.phaseDurations = [warm, trick, boss];
  S.totalTimeLeft = total;

  setPhase(0);
  updateHud();
  wireEndButtons();

  WIN.__PLATE_SET_PAUSED__ = function(on){
    S.paused = !!on;
    if(!S.paused) S.lastTick = performance.now();
  };

  const endOverlay = DOC.getElementById('endOverlay');
  if(endOverlay) endOverlay.setAttribute('aria-hidden', 'true');

  setCoach('warm', { target: S.targetGroup?.label });

  S.lastTick = performance.now();
  S.raf = requestAnimationFrame(loop);
}

WIN.PlateVR = WIN.PlateVR || {};
WIN.PlateVR.boot = boot;

export { boot };