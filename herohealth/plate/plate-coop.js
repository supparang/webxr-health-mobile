/* === /herohealth/plate/plate-coop.js ===
   HeroHealth Plate Coop Engine
   HOST-AUTHORITATIVE WIRED VERSION + QR UI
   PATCH v20260321-PLATE-COOP-JS-WIRED-QR
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