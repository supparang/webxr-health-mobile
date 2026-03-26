/* === /herohealth/plate/plate-coop.js ===
   HeroHealth Plate Coop Engine
   HOST-AUTHORITATIVE WIRED VERSION + QR UI
   PATCH v20260323-PLATE-COOP-JS-COMPAT-FINAL
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

const clamp = (v, a, b) => {
  v = Number(v);
  if (!Number.isFinite(v)) v = a;
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
  const end = DOC.getElementById('endOverlay');
  const lobby = DOC.getElementById('lobbyOverlay');
  return !!(
    (end && end.getAttribute('aria-hidden') === 'false') ||
    (lobby && lobby.getAttribute('aria-hidden') === 'false')
  );
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

function gradeOf(acc){
  if(acc >= 90) return 'S';
  if(acc >= 75) return 'A';
  if(acc >= 60) return 'B';
  if(acc >= 40) return 'C';
  return 'D';
}

function friendlyPhaseLabel(phase){
  switch(String(phase || '').toLowerCase()){
    case 'warm': return 'WARM';
    case 'trick': return 'TRICK';
    case 'boss': return 'BOSS';
    case 'wait': return 'WAIT';
    default: return String(phase || 'PLAY').toUpperCase();
  }
}

function friendlyTargetText(label){
  const raw = String(label || '').trim();
  if(!raw) return 'รอเริ่มเกม';
  if(String(S.match.phase || '').toLowerCase() === 'boss'){
    return `BOSS: เติม ${raw}`;
  }
  return `เก็บ ${raw}`;
}

function coachText(kind, data = {}){
  const who = String(data.who || '').trim();
  const target = String(data.target || '').trim();
  switch(String(kind || '')){
    case 'wait': return 'สร้างห้องหรือเข้าห้องก่อน แล้วรอทั้งสองคนกดพร้อม';
    case 'ready': return 'ทั้งสองคนพร้อมแล้ว ให้ Host กดเริ่มเกม';
    case 'warm': return `${who ? who + ': ' : ''}เก็บ “${target || 'หมู่เป้าหมาย'}”`;
    case 'trick': return `${who ? who + ': ' : ''}ระวังตัวหลอกนะ`;
    case 'boss': return 'ช่วยกันเติมจานให้ครบ 5 หมู่';
    case 'good': return `${who ? who + ' ' : ''}เยี่ยมมาก!`;
    case 'wrong': return `${who ? who + ' ' : ''}ลองใหม่อีกนิดนะ`;
    case 'miss': return `${who ? who + ' ' : ''}ไม่เป็นไร ยังทันอยู่`;
    case 'fever': return 'Fever มาแล้ว! ช่วยกันเก็บแต้ม';
    case 'sync': return 'กำลังซิงก์ข้อมูลห้อง...';
    case 'join': return 'เข้าห้องแล้ว รออีกฝ่ายหรือกดพร้อม';
    case 'end': return 'จบเกมแล้ว สรุปผลพร้อม cooldown';
    default: return 'Coop 2 เครื่อง: ช่วยกันเติมจานให้ครบ 💪';
  }
}

function setCoach(kind, data = {}){
  setText('coachMsg', coachText(kind, data));
}

function getDifficultyPreset(diff='normal', pro=false){
  const d = String(diff || 'normal').toLowerCase();

  let preset = {
    warm:  { targetCorrectP: 0.82, spawnPerSec: 0.82, ttl: 3.6, capBonus: 0, wrongPenalty: 4, bossBonus: 6 },
    trick: { targetCorrectP: 0.58, spawnPerSec: 1.02, ttl: 2.9, capBonus: 1, wrongPenalty: 4, bossBonus: 6 },
    boss:  { targetCorrectP: 0.68, spawnPerSec: 1.15, ttl: 2.45, capBonus: 1, wrongPenalty: 6, bossBonus: 6 }
  };

  if(d === 'easy'){
    preset = {
      warm:  { targetCorrectP: 0.88, spawnPerSec: 0.70, ttl: 4.0, capBonus: 0, wrongPenalty: 2, bossBonus: 4 },
      trick: { targetCorrectP: 0.66, spawnPerSec: 0.88, ttl: 3.3, capBonus: 0, wrongPenalty: 3, bossBonus: 4 },
      boss:  { targetCorrectP: 0.76, spawnPerSec: 0.98, ttl: 2.9, capBonus: 0, wrongPenalty: 4, bossBonus: 4 }
    };
  } else if(d === 'hard'){
    preset = {
      warm:  { targetCorrectP: 0.78, spawnPerSec: 0.94, ttl: 3.25, capBonus: 0, wrongPenalty: 4, bossBonus: 7 },
      trick: { targetCorrectP: 0.52, spawnPerSec: 1.15, ttl: 2.55, capBonus: 1, wrongPenalty: 5, bossBonus: 7 },
      boss:  { targetCorrectP: 0.62, spawnPerSec: 1.28, ttl: 2.15, capBonus: 2, wrongPenalty: 7, bossBonus: 8 }
    };
  }

  if(pro){
    for(const k of ['warm','trick','boss']){
      preset[k].spawnPerSec *= 1.08;
      preset[k].ttl *= 0.94;
      preset[k].wrongPenalty += 1;
      if(k !== 'warm') preset[k].capBonus += 1;
    }
  }

  return preset;
}

const S = {
  mount: null,
  ctx: null,
  rng: null,

  running: false,
  started: false,
  paused: false,
  ended: false,

  room: {
    roomId: '',
    myRole: '',
    isHost: false,
    readyA: false,
    readyB: false
  },

  roomApi: null,
  netApi: null,
  qr: null,

  unsubRoom: null,
  unsubState: null,
  unsubAction: null,

  sync: {
    enabled: false,
    actionIds: new Set()
  },

  raf: 0,
  lastTick: 0,

  match: {
    phase: 'wait',
    phaseIndex: 0,
    phaseList: ['warm','trick','boss'],
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

    bossCompleted: false,
    diffPreset: null
  },

  contrib: {
    A: { score:0, ok:0, wrong:0, hits:0 },
    B: { score:0, ok:0, wrong:0, hits:0 }
  },

  ai: null,
  hub: '../hub.html',
  cooldownEnabled: false,
  cooldownDone: false
};

function isHost(){
  return !!S.room.isHost;
}

function myRole(){
  return String(S.room.myRole || '').trim() || '-';
}

function roleName(role){
  return role === 'A' || role === 'B' ? role : '-';
}

function plateCountDistinct(){
  let n = 0;
  for(let i=1;i<=5;i++){
    if((S.match.counts[i] || 0) > 0) n++;
  }
  return n;
}

function resetCounts(){
  for(let i=1;i<=5;i++) S.match.counts[i] = 0;
}

function pick(arr){
  return arr[(S.rng() * arr.length) | 0];
}

function pickMissingGroup(){
  const missing = GROUPS.filter(g => (S.match.counts[g.id] || 0) <= 0);
  if(missing.length) return pick(missing);
  return pick(GROUPS);
}

function chooseTarget(){
  const P = S.match.diffPreset || getDifficultyPreset(S.ctx?.diff, S.ctx?.pro);
  const phase = S.match.phase;
  const targetCorrectP =
    phase === 'warm' ? P.warm.targetCorrectP :
    phase === 'trick' ? P.trick.targetCorrectP :
    P.boss.targetCorrectP;

  const isCorrect = S.rng() < targetCorrectP;

  if(isCorrect){
    const g = S.match.targetGroup;
    return {
      groupId: g.id,
      label: g.label,
      emoji: pick(g.good),
      good: true
    };
  }

  if(phase === 'boss' && S.rng() < 0.5){
    const wrong = pick(WRONG_POOL);
    return { groupId: 0, label: 'ตัวหลอก', emoji: wrong, good: false };
  }

  const other = pick(GROUPS.filter(g => g.id !== S.match.targetGroup.id));
  return {
    groupId: other.id,
    label: other.label,
    emoji: pick(other.good),
    good: false
  };
}

function phasePreset(){
  const P = S.match.diffPreset || getDifficultyPreset(S.ctx?.diff, S.ctx?.pro);
  if(S.match.phase === 'warm') return P.warm;
  if(S.match.phase === 'trick') return P.trick;
  return P.boss;
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

  if(hudTop && intersect(r, hudTop)){
    top = Math.max(top, hudTop.bottom + (isMobile ? 12 : 10));
  }

  if(hudBottom && intersect(r, hudBottom)){
    bottom = Math.min(bottom, hudBottom.top - (isMobile ? 16 : 12));
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

function showPhaseBanner(text){
  const d = DOC.createElement('div');
  d.className = 'phaseBanner';
  d.textContent = text;
  DOC.getElementById('app')?.appendChild(d);
  setTimeout(()=>{ try{ d.remove(); }catch(_){} }, 950);
}

function updateRoomQrUi(roomId=''){
  if(!S.roomApi) return;

  const id = String(roomId || S.room.roomId || '').trim().toUpperCase();
  const joinUrl = id ? S.roomApi.getJoinUrl(id, location.href) : '';

  if(S.qr?.updateJoinUrlText){
    S.qr.updateJoinUrlText(DOC.getElementById('joinUrlText'), joinUrl);
  } else {
    setText('joinUrlText', joinUrl ? `join url: ${joinUrl}` : 'join url: -');
  }

  if(!joinUrl){
    if(S.qr?.clearRoomQr){
      S.qr.clearRoomQr(DOC.getElementById('qrMount'));
    } else {
      const qr = DOC.getElementById('qrMount');
      if(qr) qr.textContent = 'QR code จะแสดงตรงนี้เมื่อสร้างห้องแล้ว';
    }
    return;
  }

  if(S.qr?.renderRoomQr){
    S.qr.renderRoomQr(DOC.getElementById('qrMount'), joinUrl, {
      size: 220,
      label: 'Scan to Join Room'
    });
  } else {
    const qr = DOC.getElementById('qrMount');
    if(qr) qr.textContent = 'QR code placeholder';
  }
}

function setPhase(index){
  S.match.phaseIndex = clamp(index, 0, S.match.phaseList.length - 1);
  S.match.phase = S.match.phaseList[S.match.phaseIndex];
  S.match.phaseTimeLeft = S.match.phaseDurations[S.match.phaseIndex];

  if(S.match.phase === 'warm'){
    S.match.targetGroup = pick(GROUPS);
    setCoach('warm', { who: myRole(), target: S.match.targetGroup.label });
    showPhaseBanner('WARM • เริ่มเก็บก่อน');
  } else if(S.match.phase === 'trick'){
    S.match.targetGroup = pick(GROUPS);
    setCoach('trick', { who: myRole(), target: S.match.targetGroup.label });
    showPhaseBanner('TRICK • ระวังตัวหลอก');
  } else {
    S.match.targetGroup = pickMissingGroup();
    setCoach('boss', { who: myRole(), target: S.match.targetGroup.label });
    showPhaseBanner('BOSS • ช่วยกันเติมจานให้ครบ');
  }

  updateHud();
  void broadcastState('PHASE_CHANGE');
}

function createTarget(){
  if(!S.started || overlayOpen()) return;

  const safe = safeSpawnRect();
  const x = safe.left + S.rng() * safe.width;
  const y = safe.top + S.rng() * safe.height;

  const info = chooseTarget();
  const id = String(S.match.nextId++);
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
  const preset = phasePreset();
  const ttlMs = (S.match.feverOn ? (preset.ttl * 0.9) : preset.ttl) * 1000;

  S.mount.appendChild(el);
  S.match.targets.set(id, {
    id, el, x, y, born, ttlMs,
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
  S.match.targets.delete(t.id);
  try{
    t.el.classList.add(mode === 'hit' ? 'hit' : 'expire');
    t.el.removeEventListener('pointerdown', onHit);
    setTimeout(()=>{ try{ t.el.remove(); }catch(_){} }, 140);
  }catch(_){
    try{ t.el.remove(); }catch(__){}
  }
}

function clearTargets(){
  for(const t of S.match.targets.values()){
    try{
      t.el.removeEventListener('pointerdown', onHit);
      t.el.remove();
    }catch(_){}
  }
  S.match.targets.clear();
}

function contribution(role){
  return role === 'B' ? S.contrib.B : S.contrib.A;
}

function teamAccuracyPct(){
  return S.match.shots > 0 ? Math.round((S.match.hits / S.match.shots) * 100) : 0;
}

function updateHud(){
  setText('uiScore', S.match.score);
  setText('uiCombo', S.match.combo);
  setText('uiComboMax', S.match.comboMax);
  setText('uiMiss', S.match.miss);
  setText('uiAcc', `${teamAccuracyPct()}%`);
  setText('uiGrade', gradeOf(teamAccuracyPct()));
  setText('uiTime', Math.ceil(Math.max(0, S.match.totalTimeLeft)));
  setText('uiShield', S.match.shield);
  setText('uiFever', `${Math.round(S.match.fever)}%`);
  setText('uiTargetText', friendlyTargetText(S.match.targetGroup?.label));
  setText('uiPhase', friendlyPhaseLabel(S.match.phase));
  setText('uiP1', S.contrib.A.score);
  setText('uiP2', S.contrib.B.score);
  setText('uiRole', roleName(myRole()));
  setText('uiRoom', S.room.roomId || '-');

  const phaseTotal = Math.max(1, S.match.phaseDurations[S.match.phaseIndex] || 1);
  const phaseDone = S.started
    ? Math.round(((phaseTotal - S.match.phaseTimeLeft) / phaseTotal) * 100)
    : 0;
  setText('uiPhaseProg', S.started ? `${Math.max(0, phaseTotal - Math.ceil(S.match.phaseTimeLeft))}/${phaseTotal}` : '0/0');
  setWidth('uiGoalFill', phaseDone);
  setWidth('uiFeverFill', S.match.fever);

  for(let i=1;i<=5;i++){
    setText(`uiG${i}`, S.match.counts[i] || 0);
  }

  setText('readyAState', S.room.readyA ? 'A พร้อมแล้ว' : (S.room.roomId ? 'A เข้าห้องแล้ว' : 'ยังไม่เข้า'));
  setText('readyBState', S.room.readyB ? 'B พร้อมแล้ว' : (S.room.roomId ? 'B เข้าห้องแล้ว' : 'ยังไม่เข้า'));
  setText('lobbyMyRole', roleName(myRole()));
  setText('lobbyRoomCode', S.room.roomId || '-');
  setText('lobbyHostState', isHost() ? 'YES' : 'NO');

  const startBtn = DOC.getElementById('btnHostStart');
  if(startBtn) startBtn.disabled = !(isHost() && S.room.readyA && S.room.readyB);
}

function showPop(x, y, text){
  try{
    const r = S.mount.getBoundingClientRect();
    const d = DOC.createElement('div');
    d.className = 'phaseBanner';
    d.style.top = `${y - r.top}px`;
    d.style.left = `${x - r.left}px`;
    d.style.transform = 'translate(-50%,-50%)';
    d.style.fontSize = '16px';
    d.style.padding = '8px 12px';
    d.textContent = text;
    S.mount.appendChild(d);
    setTimeout(()=>{ try{ d.remove(); }catch(_){} }, 560);
  }catch(_){}
}

function applyCorrect(role, t){
  const preset = phasePreset();
  let add = 10 + Math.min(10, S.match.combo);
  if(S.match.phase === 'boss') add += preset.bossBonus;
  if(S.match.feverOn) add += 4;

  S.match.hits++;
  S.match.shots++;
  S.match.combo++;
  S.match.comboMax = Math.max(S.match.comboMax, S.match.combo);
  S.match.score += add;

  const c = contribution(role);
  c.score += add;
  c.ok += 1;
  c.hits += 1;

  S.match.fever = clamp(S.match.fever + 14, 0, 100);

  if(t.kind === 'shield'){
    S.match.shield = Math.min(3, S.match.shield + 1);
  }

  if(t.groupId >= 1 && t.groupId <= 5){
    const before = S.match.plateHave;
    S.match.counts[t.groupId] = (S.match.counts[t.groupId] || 0) + 1;
    S.match.plateHave = plateCountDistinct();
    if(before < 5 && S.match.plateHave === 5){
      S.match.score += 30;
      c.score += 30;
      showPop(t.x, t.y, 'ครบ 5 หมู่! +30');
    }
  }

  if(S.match.phase === 'boss'){
    S.match.targetGroup = pickMissingGroup();
  }

  if(S.match.fever >= 100 && !S.match.feverOn){
    S.match.feverOn = true;
    S.match.feverTimer = 6;
    setCoach('fever');
  }

  if(S.match.phase === 'boss' && S.match.plateHave >= 5 && !S.match.bossCompleted){
    S.match.bossCompleted = true;
    setTimeout(()=>{
      if(!S.ended) endGame('boss-complete');
    }, 350);
  }

  showPop(t.x, t.y, `+${add}`);
}

function applyWrong(role){
  const preset = phasePreset();
  const penalty = preset.wrongPenalty;

  S.match.shots++;
  S.match.wrong++;
  S.match.combo = 0;

  const c = contribution(role);
  c.wrong += 1;

  if(S.match.shield > 0){
    S.match.shield--;
  } else {
    S.match.score = Math.max(0, S.match.score - penalty);
    c.score = Math.max(0, c.score - penalty);
    S.match.miss++;
  }
}

function canControlLocalAction(){
  return isHost();
}

async function onHit(ev){
  if(!S.running || !S.started || S.paused || S.ended) return;
  const el = ev.currentTarget;
  const t = S.match.targets.get(String(el.dataset.id));
  if(!t) return;

  const role = myRole() === 'B' ? 'B' : 'A';

  if(!canControlLocalAction()){
    setCoach('sync');
    try{
      await S.netApi?.sendHit({
        targetId: t.id,
        targetGroupId: t.groupId,
        targetLabel: t.label,
        good: !!t.good,
        kind: t.kind || 'food'
      });
    }catch(_){}
    return;
  }

  if(t.good && t.groupId === S.match.targetGroup.id){
    applyCorrect(role, t);
    setCoach('good', { who: role, target: S.match.targetGroup?.label });
  } else {
    applyWrong(role);
    setCoach('wrong', { who: role, target: S.match.targetGroup?.label });
  }

  removeTarget(t, 'hit');
  updateHud();
  await broadcastState('TARGET_HIT');
}

function updateFever(dt){
  if(!S.match.feverOn) return;
  S.match.feverTimer -= dt;
  if(S.match.feverTimer <= 0){
    S.match.feverOn = false;
    S.match.fever = 0;
  }
}

async function updateTargets(dt){
  if(!S.started) return;
  if(!isHost()) return;

  const now = nowMs();

  for(const t of Array.from(S.match.targets.values())){
    if(now - t.born >= t.ttlMs){
      if(t.good && t.groupId === S.match.targetGroup.id){
        S.match.miss++;
        S.match.combo = 0;
        setCoach('miss', { target: S.match.targetGroup?.label });
      }
      removeTarget(t, 'expire');
    }
  }

  if(overlayOpen()) return;

  const preset = phasePreset();
  let spawnPerSec = preset.spawnPerSec;
  if(S.ctx?.view === 'mobile') spawnPerSec *= 0.90;

  S.match.spawnAcc += spawnPerSec * dt;

  let cap = (S.ctx?.view === 'mobile') ? 5 : 7;
  if(S.match.phase === 'trick') cap += (preset.capBonus || 0);
  if(S.match.phase === 'boss') cap += (preset.capBonus || 0);

  while(S.match.spawnAcc >= 1){
    S.match.spawnAcc -= 1;
    if(S.match.targets.size < cap){
      createTarget();
    }
  }
}

async function phaseAdvance(){
  clearTargets();
  S.match.spawnAcc = 0;

  if(S.match.phaseIndex < S.match.phaseList.length - 1){
    setPhase(S.match.phaseIndex + 1);
  } else {
    endGame('time');
  }
}

function buildSummary(){
  const acc = teamAccuracyPct();
  return {
    game: 'platev1',
    mode: 'coop',
    reason: 'end',
    reasonDetail: S.match.bossCompleted ? 'boss-complete' : 'time',
    phase: S.match.phase,
    scoreFinal: S.match.score,
    grade: gradeOf(acc),
    accPct: acc,
    plateHave: S.match.plateHave,
    counts: { ...S.match.counts },
    team: {
      ok: S.match.hits,
      wrong: S.match.wrong,
      miss: S.match.miss,
      comboMax: S.match.comboMax
    },
    players: {
      A: { ...S.contrib.A },
      B: { ...S.contrib.B }
    },
    diff: S.ctx.diff,
    pro: !!S.ctx.pro,
    view: S.ctx.view,
    seed: S.ctx.seed,
    pid: S.ctx.pid,
    roomId: S.room.roomId || ''
  };
}

async function endGame(reason){
  if(S.ended) return;
  S.ended = true;
  S.running = false;
  try{ cancelAnimationFrame(S.raf); }catch(_){}
  clearTargets();

  const sum = buildSummary();
  sum.reason = reason || 'end';

  saveJson(`HHA_LAST_SUMMARY:platev1:${S.ctx.pid || 'anon'}`, sum);
  saveJson('HHA_LAST_SUMMARY', { ...sum, game:'platev1' });

  setText('endTitle', 'Coop จบแล้ว 🎉');
  setText('endSub', `mode=coop • diff=${S.ctx.diff} • view=${S.ctx.view} • phase=${friendlyPhaseLabel(S.match.phase)}`);
  setText('endGrade', sum.grade);
  setText('endScore', sum.scoreFinal);
  setText('endP1', S.contrib.A.score);
  setText('endP2', S.contrib.B.score);

  const doneKey = `HHA_GATE_DONE:platev1:cooldown:${dayKey()}:${S.ctx.pid || 'anon'}`;
  S.cooldownDone = !!localStorage.getItem(doneKey);

  const btnNextCooldown = DOC.getElementById('btnNextCooldown');
  if(S.cooldownEnabled && !S.cooldownDone){
    btnNextCooldown?.style.removeProperty('display');
  } else {
    btnNextCooldown?.style.setProperty('display', 'none');
  }

  DOC.getElementById('endOverlay')?.setAttribute('aria-hidden', 'false');
  setCoach('end');

  if(isHost()){
    try{ await S.roomApi?.hostEnd(sum, S.room.roomId); }catch(_){}
    await broadcastState('MATCH_END', sum);
  }
}

function buildCooldownUrl(){
  try{
    const u = new URL('../warmup-gate.html', location.href);
    u.searchParams.set('phase', 'cooldown');
    u.searchParams.set('gatePhase', 'cooldown');
    u.searchParams.set('cat', 'nutrition');
    u.searchParams.set('theme', 'platev1');
    u.searchParams.set('game', 'platev1');
    u.searchParams.set('mode', 'coop');
    u.searchParams.set('pid', String(S.ctx.pid || 'anon'));
    u.searchParams.set('hub', String(S.hub || '../hub.html'));
    u.searchParams.set('next', String(S.hub || '../hub.html'));
    return u.toString();
  }catch(_){
    return String(S.hub || '../hub.html');
  }
}

function wireEndButtons(){
  DOC.getElementById('btnCopy')?.addEventListener('click', async ()=>{
    const sum = buildSummary();
    const text =
`Plate Coop Summary
room=${sum.roomId}
teamScore=${sum.scoreFinal}
grade=${sum.grade}
plateHave=${sum.plateHave}/5
A=${sum.players.A.score}
B=${sum.players.B.score}
A_ok=${sum.players.A.ok}
A_wrong=${sum.players.A.wrong}
B_ok=${sum.players.B.ok}
B_wrong=${sum.players.B.wrong}
reasonDetail=${sum.reasonDetail}`;
    try{
      await copyToClipboard(text);
      setCoach('good');
    }catch(_){}
  });

  DOC.getElementById('btnReplay')?.addEventListener('click', ()=>{
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

  DOC.getElementById('btnNextCooldown')?.addEventListener('click', ()=>{
    location.href = buildCooldownUrl();
  });
}

async function broadcastState(source='STATE_UPDATE', summary=null){
  if(!S.netApi || !S.room.roomId || !isHost()) return;

  const payload = {
    source,
    roomId: S.room.roomId,
    hostId: S.ctx.pid,
    game: 'platev1',
    mode: 'coop',
    started: S.started,
    ended: S.ended,
    players: {
      A: { ready: S.room.readyA },
      B: { ready: S.room.readyB }
    },
    config: {
      diff: S.ctx.diff,
      pro: !!S.ctx.pro,
      time: S.ctx.time,
      seed: S.ctx.seed
    },
    match: {
      phase: S.match.phase,
      phaseIndex: S.match.phaseIndex,
      phaseTimeLeft: S.match.phaseTimeLeft,
      totalTimeLeft: S.match.totalTimeLeft,
      targetGroupId: S.match.targetGroup?.id || 0,
      targetLabel: S.match.targetGroup?.label || '',
      teamScore: S.match.score,
      combo: S.match.combo,
      comboMax: S.match.comboMax,
      miss: S.match.miss,
      hits: S.match.hits,
      wrong: S.match.wrong,
      shots: S.match.shots,
      fever: S.match.fever,
      feverOn: S.match.feverOn,
      shield: S.match.shield,
      counts: { ...S.match.counts },
      plateHave: S.match.plateHave,
      bossCompleted: S.match.bossCompleted
    },
    contrib: {
      A: { ...S.contrib.A },
      B: { ...S.contrib.B }
    },
    summary: summary || null,
    updatedAt: Date.now()
  };

  try{
    await S.netApi.publishState(payload);
  }catch(_){}
}

function applyRemoteState(state){
  if(!state || typeof state !== 'object') return;

  if(state.players){
    S.room.readyA = !!state.players.A?.ready;
    S.room.readyB = !!state.players.B?.ready;
  }

  if(state.started != null) S.started = !!state.started;
  if(state.ended != null) S.ended = !!state.ended;

  if(state.match){
    const m = state.match;
    S.match.phase = m.phase || S.match.phase;
    S.match.phaseIndex = Number.isFinite(m.phaseIndex) ? m.phaseIndex : S.match.phaseIndex;
    S.match.phaseTimeLeft = Number.isFinite(m.phaseTimeLeft) ? m.phaseTimeLeft : S.match.phaseTimeLeft;
    S.match.totalTimeLeft = Number.isFinite(m.totalTimeLeft) ? m.totalTimeLeft : S.match.totalTimeLeft;
    S.match.score = Number(m.teamScore ?? S.match.score);
    S.match.combo = Number(m.combo ?? S.match.combo);
    S.match.comboMax = Number(m.comboMax ?? S.match.comboMax);
    S.match.miss = Number(m.miss ?? S.match.miss);
    S.match.hits = Number(m.hits ?? S.match.hits);
    S.match.wrong = Number(m.wrong ?? S.match.wrong);
    S.match.shots = Number(m.shots ?? S.match.shots);
    S.match.fever = Number(m.fever ?? S.match.fever);
    S.match.feverOn = !!m.feverOn;
    S.match.shield = Number(m.shield ?? S.match.shield);
    S.match.counts = { ...S.match.counts, ...(m.counts || {}) };
    S.match.plateHave = Number(m.plateHave ?? S.match.plateHave);
    S.match.bossCompleted = !!m.bossCompleted;

    const gid = Number(m.targetGroupId || 0);
    const found = GROUPS.find(g => g.id === gid);
    if(found) S.match.targetGroup = found;
  }

  if(state.contrib){
    S.contrib.A = { ...S.contrib.A, ...(state.contrib.A || {}) };
    S.contrib.B = { ...S.contrib.B, ...(state.contrib.B || {}) };
  }

  if(state.summary && S.ended){
    setText('endScore', state.summary.scoreFinal ?? S.match.score);
  }

  updateHud();
}

async function handleActionAsHost(action){
  if(!action || !isHost()) return;
  if(!action.id) return;
  if(S.sync.actionIds.has(action.id)) return;
  S.sync.actionIds.add(action.id);

  if(S.sync.actionIds.size > 5000){
    const arr = Array.from(S.sync.actionIds).slice(-2000);
    S.sync.actionIds.clear();
    for(const id of arr) S.sync.actionIds.add(id);
  }

  if(action.type === 'PLAYER_READY'){
    return;
  }

  if(action.type === 'HOST_START'){
    if(!S.started) await startGame();
    return;
  }

  if(action.type === 'PLAYER_HIT'){
    const role = action.role === 'B' ? 'B' : 'A';

    const fake = {
      id: action.payload?.targetId || '',
      groupId: Number(action.payload?.targetGroupId || 0),
      label: String(action.payload?.targetLabel || ''),
      good: !!action.payload?.good,
      kind: String(action.payload?.kind || 'food'),
      x: 0,
      y: 0
    };

    if(fake.good && fake.groupId === S.match.targetGroup?.id){
      applyCorrect(role, fake);
      setCoach('good', { who: role, target: S.match.targetGroup?.label });
    } else {
      applyWrong(role);
      setCoach('wrong', { who: role, target: S.match.targetGroup?.label });
    }

    updateHud();
    await broadcastState('REMOTE_TARGET_HIT');
    return;
  }

  if(action.type === 'PLAYER_MISS'){
    const role = action.role === 'B' ? 'B' : 'A';
    S.match.miss += 1;
    contribution(role).wrong += 1;
    S.match.combo = 0;
    setCoach('miss', { who: role, target: S.match.targetGroup?.label });
    updateHud();
    await broadcastState('REMOTE_TARGET_MISS');
    return;
  }

  if(action.type === 'PLAYER_LEAVE'){
    return;
  }
}

function cleanupSubscriptions(){
  try{ S.unsubRoom?.(); }catch(_){}
  try{ S.unsubState?.(); }catch(_){}
  try{ S.unsubAction?.(); }catch(_){}
  S.unsubRoom = null;
  S.unsubState = null;
  S.unsubAction = null;
}

function subscribeRoomAndNet(roomId){
  cleanupSubscriptions();

  if(S.roomApi){
    try{
      S.unsubRoom = S.roomApi.subscribeRoom(roomId, (roomState)=>{
        if(!roomState) return;

        S.room.roomId = roomState.roomId || S.room.roomId;
        S.room.isHost = roomState.hostId === S.ctx.pid;
        S.room.readyA = !!roomState.players?.A?.ready;
        S.room.readyB = !!roomState.players?.B?.ready;

        if(roomState.players?.A?.id === S.ctx.pid) S.room.myRole = 'A';
        else if(roomState.players?.B?.id === S.ctx.pid) S.room.myRole = 'B';

        updateRoomQrUi(S.room.roomId);

        if(roomState.started && !S.started){
          DOC.getElementById('lobbyOverlay')?.setAttribute('aria-hidden', 'true');
          S.started = true;
        }

        if(roomState.ended && roomState.summary && !S.ended){
          S.ended = true;
          setText('endTitle', 'Coop จบแล้ว 🎉');
          setText('endSub', `mode=coop • diff=${S.ctx.diff} • view=${S.ctx.view}`);
          setText('endGrade', roomState.summary.grade || 'D');
          setText('endScore', roomState.summary.scoreFinal || 0);
          setText('endP1', roomState.summary.players?.A?.score || 0);
          setText('endP2', roomState.summary.players?.B?.score || 0);
          DOC.getElementById('endOverlay')?.setAttribute('aria-hidden', 'false');
        }

        updateHud();
      });
    }catch(_){}
  }

  if(S.netApi){
    try{
      S.netApi.setRoom(roomId);
      S.unsubState = S.netApi.onState((state)=>{
        if(!state) return;
        applyRemoteState(state);
      });
    }catch(_){}

    try{
      S.unsubAction = S.netApi.onAction((action)=>{
        void handleActionAsHost(action);
      });
    }catch(_){}
  }
}

async function createRoomReal(){
  if(!S.roomApi) throw new Error('roomApi missing');

  const room = await S.roomApi.createRoom({
    diff: S.ctx.diff,
    pro: !!S.ctx.pro,
    time: S.ctx.time,
    seed: S.ctx.seed
  });

  S.room.roomId = room.roomId;
  S.room.myRole = 'A';
  S.room.isHost = true;
  S.room.readyA = !!room.players?.A?.ready;
  S.room.readyB = !!room.players?.B?.ready;

  if(S.netApi){
    S.netApi.setRoom(room.roomId);
    S.netApi.setRole?.('A');
    S.netApi.setHost?.(true);
    S.sync.enabled = true;
  }

  subscribeRoomAndNet(room.roomId);
  updateRoomQrUi(room.roomId);
  updateHud();
  setCoach('join');
}

async function joinRoomReal(code){
  if(!S.roomApi) throw new Error('roomApi missing');

  const result = await S.roomApi.joinRoom(code);
  const room = result.room;
  const role = result.role;

  S.room.roomId = room.roomId;
  S.room.myRole = role;
  S.room.isHost = room.hostId === S.ctx.pid;
  S.room.readyA = !!room.players?.A?.ready;
  S.room.readyB = !!room.players?.B?.ready;

  if(S.netApi){
    S.netApi.setRoom(room.roomId);
    S.netApi.setRole?.(role);
    S.netApi.setHost?.(S.room.isHost);
    S.sync.enabled = true;
  }

  subscribeRoomAndNet(room.roomId);
  updateRoomQrUi(room.roomId);
  updateHud();
  setCoach('join');
}

async function markReadyReal(){
  if(!S.roomApi) throw new Error('roomApi missing');
  const room = await S.roomApi.markReady(true);

  S.room.readyA = !!room.players?.A?.ready;
  S.room.readyB = !!room.players?.B?.ready;
  updateHud();

  if(S.netApi){
    try{ await S.netApi.sendReady(true); }catch(_){}
  }

  setCoach((S.room.readyA && S.room.readyB) ? 'ready' : 'wait');
}

async function startGame(){
  if(S.started || !(S.room.readyA && S.room.readyB)) return;

  if(S.netApi && isHost()){
    try{
      await S.netApi.sendHostStart({
        diff: S.ctx.diff,
        pro: !!S.ctx.pro,
        time: S.ctx.time,
        seed: S.ctx.seed
      });
    }catch(_){}
  }

  if(S.roomApi && isHost()){
    try{
      await S.roomApi.hostStart(S.room.roomId);
    }catch(_){}
  }

  S.started = true;
  S.ended = false;
  DOC.getElementById('lobbyOverlay')?.setAttribute('aria-hidden', 'true');

  const total = S.ctx.time;
  const warm = Math.max(12, Math.round(total * 0.34));
  const trick = Math.max(10, Math.round(total * 0.33));
  const boss = Math.max(8, total - warm - trick);

  S.match.phaseDurations = [warm, trick, boss];
  S.match.totalTimeLeft = total;
  S.match.phaseIndex = 0;
  S.match.spawnAcc = 0;
  S.match.score = 0;
  S.match.combo = 0;
  S.match.comboMax = 0;
  S.match.miss = 0;
  S.match.hits = 0;
  S.match.wrong = 0;
  S.match.shots = 0;
  S.match.fever = 0;
  S.match.feverOn = false;
  S.match.feverTimer = 0;
  S.match.shield = 0;
  S.match.nextId = 1;
  S.match.bossCompleted = false;
  clearTargets();
  resetCounts();
  S.match.plateHave = 0;
  S.contrib.A = { score:0, ok:0, wrong:0, hits:0 };
  S.contrib.B = { score:0, ok:0, wrong:0, hits:0 };

  setPhase(0);
  S.lastTick = performance.now();
  await broadcastState('MATCH_START');
}

function wireLobbyButtons(){
  DOC.getElementById('btnCreateRoom')?.addEventListener('click', async ()=>{
    try{
      await createRoomReal();
    }catch(err){
      console.error(err);
      setCoach('sync');
    }
  });

  DOC.getElementById('btnJoinRoom')?.addEventListener('click', async ()=>{
    try{
      const code = DOC.getElementById('joinRoomInput')?.value || '';
      await joinRoomReal(code);
    }catch(err){
      console.error(err);
      setCoach('sync');
    }
  });

  DOC.getElementById('joinRoomInput')?.addEventListener('keydown', async (ev)=>{
    if(ev.key !== 'Enter') return;
    try{
      const code = DOC.getElementById('joinRoomInput')?.value || '';
      await joinRoomReal(code);
    }catch(err){
      console.error(err);
      setCoach('sync');
    }
  });

  DOC.getElementById('btnReadyA')?.addEventListener('click', async ()=>{
    try{
      await markReadyReal();
    }catch(err){
      console.error(err);
    }
  });

  DOC.getElementById('btnReadyB')?.addEventListener('click', async ()=>{
    try{
      await markReadyReal();
    }catch(err){
      console.error(err);
    }
  });

  DOC.getElementById('btnReadyMe')?.addEventListener('click', async ()=>{
    try{
      await markReadyReal();
    }catch(err){
      console.error(err);
    }
  });

  DOC.getElementById('btnHostStart')?.addEventListener('click', async ()=>{
    try{
      if(!isHost()) return;
      if(!(S.room.readyA && S.room.readyB)) return;
      await startGame();
    }catch(err){
      console.error(err);
    }
  });

  DOC.getElementById('btnLeaveRoom')?.addEventListener('click', async ()=>{
    try{
      if(S.roomApi && S.room.roomId){
        await S.roomApi.leaveRoom(S.room.roomId);
      }
      if(S.netApi && S.room.roomId){
        await S.netApi.sendLeave();
      }
    }catch(err){
      console.error(err);
    }

    DOC.getElementById('lobbyOverlay')?.setAttribute('aria-hidden', 'false');
    S.started = false;
    S.ended = false;
    clearTargets();
    cleanupSubscriptions();
    S.room.roomId = '';
    S.room.myRole = '';
    S.room.isHost = false;
    S.room.readyA = false;
    S.room.readyB = false;
    S.match.phase = 'wait';
    S.match.targetGroup = null;

    if(S.netApi){
      S.netApi.setRoom('');
      S.netApi.setRole?.('');
      S.netApi.setHost?.(false);
    }

    updateRoomQrUi('');
    updateHud();
    setCoach('wait');
  });
}

async function autoJoinFromQueryRoom(){
  const qRoom = new URL(location.href).searchParams.get('room');
  const roomId = String(qRoom || '').trim().toUpperCase();
  if(!roomId || !S.roomApi) return;

  try{
    const result = await S.roomApi.joinRoom(roomId);
    const room = result.room;
    const role = result.role;

    S.room.roomId = room.roomId;
    S.room.myRole = role;
    S.room.isHost = room.hostId === S.ctx.pid;
    S.room.readyA = !!room.players?.A?.ready;
    S.room.readyB = !!room.players?.B?.ready;

    if(S.netApi){
      S.netApi.setRoom(room.roomId);
      S.netApi.setRole?.(role);
      S.netApi.setHost?.(S.room.isHost);
      S.sync.enabled = true;
    }

    subscribeRoomAndNet(room.roomId);
    updateRoomQrUi(room.roomId);
    updateHud();
    setCoach('join');
  } catch (err) {
    console.error('[plate-coop] autoJoinFromQueryRoom failed:', err);
    setCoach('sync');
  }
}

async function loop(ts){
  if(!S.running) return;

  if(S.paused || overlayOpen()){
    S.lastTick = ts;
    S.raf = requestAnimationFrame(loop);
    return;
  }

  if(!S.started){
    S.lastTick = ts;
    S.raf = requestAnimationFrame(loop);
    return;
  }

  const dt = Math.min(0.05, Math.max(0.001, (ts - S.lastTick) / 1000));
  S.lastTick = ts;

  if(isHost()){
    S.match.totalTimeLeft = Math.max(0, S.match.totalTimeLeft - dt);
    S.match.phaseTimeLeft = Math.max(0, S.match.phaseTimeLeft - dt);

    updateFever(dt);
    await updateTargets(dt);
    updateHud();

    if(S.match.phaseTimeLeft <= 0){
      await phaseAdvance();
      if(!S.running) return;
    }

    await broadcastState('HOST_TICK');
  } else {
    updateHud();
  }

  S.raf = requestAnimationFrame(loop);
}

function boot(ctx){
  S.ctx = {
    mount: ctx.mount,
    view: String(ctx.view || 'mobile').toLowerCase(),
    run: String(ctx.run || 'play').toLowerCase(),
    diff: String(ctx.diff || 'normal').toLowerCase(),
    mode: 'coop',
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
  S.match.diffPreset = getDifficultyPreset(S.ctx.diff, S.ctx.pro);

  S.roomApi = ctx.roomApi || null;
  S.netApi = ctx.netApi || null;
  S.qr = ctx.qr || null;

  S.running = true;
  S.started = false;
  S.paused = false;
  S.ended = false;

  S.room.roomId = '';
  S.room.myRole = '';
  S.room.isHost = false;
  S.room.readyA = false;
  S.room.readyB = false;

  S.match.phase = 'wait';
  S.match.phaseIndex = 0;
  S.match.phaseDurations = [0,0,0];
  S.match.phaseTimeLeft = 0;
  S.match.totalTimeLeft = 0;
  S.match.targetGroup = null;
  S.match.spawnAcc = 0;
  S.match.score = 0;
  S.match.combo = 0;
  S.match.comboMax = 0;
  S.match.miss = 0;
  S.match.hits = 0;
  S.match.wrong = 0;
  S.match.shots = 0;
  S.match.fever = 0;
  S.match.feverOn = false;
  S.match.feverTimer = 0;
  S.match.shield = 0;
  S.match.nextId = 1;
  S.match.bossCompleted = false;
  clearTargets();
  resetCounts();
  S.match.plateHave = 0;

  S.contrib.A = { score:0, ok:0, wrong:0, hits:0 };
  S.contrib.B = { score:0, ok:0, wrong:0, hits:0 };

  wireEndButtons();
  wireLobbyButtons();
  updateRoomQrUi('');
  updateHud();
  setCoach('wait');

  WIN.__PLATE_SET_PAUSED__ = function(on){
    S.paused = !!on;
    if(!S.paused) S.lastTick = performance.now();
  };

  WIN.__PLATE_COOP_START__ = function(){
    if(isHost() && S.room.readyA && S.room.readyB){
      void startGame();
    }
  };

  void autoJoinFromQueryRoom();

  DOC.getElementById('lobbyOverlay')?.setAttribute('aria-hidden', 'false');
  DOC.getElementById('endOverlay')?.setAttribute('aria-hidden', 'true');

  S.lastTick = performance.now();
  S.raf = requestAnimationFrame(loop);
}

WIN.PlateCoop = WIN.PlateCoop || {};
WIN.PlateCoop.boot = boot;

export { boot };