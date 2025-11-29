// === /HeroHealth/vr/quest-serial.js ===
// ระบบ Mini Quest แบบต่อเนื่อง สำหรับ Good vs Junk VR
// ใช้ร่วมกับ GameEngine.js (อิงตัวแปร global: window.score, window.combo, window.misses ฯลฯ)

'use strict';

// ตัวช่วย: ส่ง event ออก UI / โค้ช
function emit(name, detail) {
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch (e) {}
}

// รางวัลแต่ละเควสต์
function reward(kind) {
  if (kind === 'fever') {
    // เปิดโหมด Fever ผ่านฟังก์ชัน global ที่ GameEngine.js สร้างให้
    if (typeof window.feverStart === 'function') {
      window.feverStart();
    }
  } else if (kind === 'bonus150') {
    window.score = (window.score | 0) + 150;
    emit('hha:score', { score: window.score, combo: window.combo | 0 });
    if (typeof window.popupText === 'function') {
      window.popupText('+150', { y: 1.0 }, '#ffe08a');
    }
  } else if (kind === 'bonus250') {
    window.score = (window.score | 0) + 250;
    emit('hha:score', { score: window.score, combo: window.combo | 0 });
    if (typeof window.popupText === 'function') {
      window.popupText('+250', { y: 1.0 }, '#ffd166');
    }
  }
}

function txt(s) {
  return (typeof s === 'function') ? s() : (s || 'Mini Quest');
}

function hud(s) {
  emit('hha:quest', { text: txt(s) });
}

// ตัวแปรสะสมสถิติ (ใช้คำนวณบางเควสต์)
let totalGood    = 0;
let totalBad     = 0;
let feverStarted = 0;

function noteGood() { totalGood++; }
function noteBad()  { totalBad++;  }
function noteFever(){ feverStarted++; }

// ธนาคาร 10 เควสต์
const BANK = [
  {
    id: 'good-streak',
    reward: 'fever',
    mk: () => ({ need: 10, have: 0 }),
    label: s => `Mini Quest — เก็บของดีติดกัน ${s.have}/${s.need} ชิ้น เพื่อเปิด FEVER!`,
    onGood: s => { s.have++; return s.have >= s.need; },
    onBad:  s => { s.have = 0; return false; },
    tick:   s => false
  },
  {
    id: 'no-junk',
    reward: 'bonus150',
    mk: () => ({ t: 15, ok: true }),
    label: s => `Mini Quest — หลีกเลี่ยงของขยะให้ครบ ${s.t} วิ`,
    onGood: s => false,
    onBad:  s => { s.ok = false; return false; },
    tick:   s => { s.t--; return (s.t <= 0 && s.ok); }
  },
  {
    id: 'reach-combo',
    reward: 'fever',
    mk: () => ({ need: 12 }),
    label: s => `Mini Quest — ทำคอมโบให้ถึง x${s.need}`,
    onGood: s => (window.combo | 0) >= s.need,
    onBad:  s => false,
    tick:   s => (window.combo | 0) >= s.need
  },
  {
    id: 'score-in-time',
    reward: 'bonus150',
    mk: () => ({ t: 12, base: window.score | 0, need: 200 }),
    label: s => {
      const gained = (window.score | 0) - s.base;
      const remain = Math.max(0, s.need - gained);
      return `Mini Quest — เก็บเพิ่มอีก ${remain} คะแนน ใน ${s.t} วิ`;
    },
    onGood: s => ((window.score | 0) - s.base) >= s.need,
    onBad:  s => false,
    tick:   s => {
      s.t--;
      if (s.t <= 0) {
        return ((window.score | 0) - s.base) >= s.need;
      }
      return false;
    }
  },
  {
    id: 'limited-bad',
    reward: 'bonus150',
    mk: () => ({ t: 14, m: 1, bad: 0 }),
    label: s => `Mini Quest — อย่ากดของขยะเกิน ${s.m} ครั้ง ใน ${s.t} วิ`,
    onGood: s => false,
    onBad:  s => { s.bad++; return false; },
    tick:   s => { s.t--; return (s.t <= 0 && s.bad <= s.m); }
  },
  {
    id: 'collect-good',
    reward: 'bonus150',
    mk: () => ({ base: totalGood, need: 25 }),
    label: s => {
      const gained = totalGood - s.base;
      const remain = Math.max(0, s.need - gained);
      return `Mini Quest — สะสมของดีให้ครบ ${s.need} ชิ้น (อีก ${remain})`;
    },
    onGood: s => (totalGood - s.base) >= s.need,
    onBad:  s => false,
    tick:   s => (totalGood - s.base) >= s.need
  },
  {
    id: 'fever-count',
    reward: 'bonus250',
    mk: () => ({ base: feverStarted, need: 1 }),
    label: s => `Mini Quest — เปิด FEVER ให้ได้ ${s.need} ครั้ง`,
    onGood: s => false,
    onBad:  s => false,
    tick:   s => (feverStarted - s.base) >= s.need
  },
  {
    id: 'fever-hold',
    reward: 'bonus150',
    mk: () => ({ t: 8, counting: false }),
    label: s => `Mini Quest — รักษา FEVER ให้นาน ${s.t} วิ`,
    onGood: s => false,
    onBad:  s => false,
    tick:   s => {
      if (window.FEVER_ACTIVE) {
        s.counting = true;
        s.t--;
        if (s.t <= 0) return true;
      }
      return false;
    }
  },
  {
    id: 'miss-guard',
    reward: 'bonus150',
    mk: () => ({ t: 15, baseMiss: window.misses | 0, m: 1 }),
    label: s => `Mini Quest — ห้ามพลาดเกิน ${s.m} ครั้งใน ${s.t} วิ`,
    onGood: s => false,
    onBad:  s => false,
    tick:   s => {
      s.t--;
      const used = (window.misses | 0) - s.baseMiss;
      return (s.t <= 0 && used <= s.m);
    }
  },
  {
    id: 'finish-with-combo',
    reward: 'bonus250',
    mk: () => ({ need: 8 }),
    label: s => `Mini Quest — รักษาคอมโบให้ถึงตอนจบเควสต์ (≥ x${s.need})`,
    onGood: s => false,
    onBad:  s => false,
    tick:   s => (window.combo | 0) >= s.need
  }
];

// util random
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// สถานะเควสต์ชุดปัจจุบัน
let queue = [];      // ธนาคารเควสต์ที่สุ่มมา 3 อัน
let idx   = 0;       // index ของเควสต์ปัจจุบันใน queue
let cur   = null;    // definition ปัจจุบัน
let st    = null;    // state ภายในของเควสต์ปัจจุบัน
let tickId = null;   // setInterval สำหรับ tick

function pick3() {
  queue = shuffle(BANK.slice()).slice(0, 3);
  idx = 0;
}

function mount(i) {
  cur = queue[i];
  st  = cur.mk();
  hud(() => cur.label(st));

  if (tickId) clearInterval(tickId);
  tickId = setInterval(() => {
    if (!window.running || !cur) return;
    if (cur.tick(st)) {
      done();
    } else {
      hud(() => cur.label(st));
    }
  }, 1000);
}

function done() {
  if (!cur) return;

  const rw = cur.reward;
  clearInterval(tickId);
  tickId = null;

  reward(rw);

  idx++;
  if (idx >= queue.length) {
    pick3();
    idx = 0;
  }

  setTimeout(() => {
    mount(idx);
  }, 1100);
}

// public singleton
export const Quest = {
  start() {
    totalGood    = 0;
    totalBad     = 0;
    feverStarted = 0;
    pick3();
    mount(0);
  },
  stop() {
    if (tickId) clearInterval(tickId);
    tickId = null;
    cur = null;
    st  = null;
  },
  onGood() {
    noteGood();
    if (!cur) return;
    if (cur.onGood(st)) {
      done();
    } else {
      hud(() => cur.label(st));
    }
  },
  onBad() {
    noteBad();
    if (!cur) return;
    if (cur.onBad(st)) {
      done();
    } else {
      hud(() => cur.label(st));
    }
  },
  onFever() {
    noteFever();
  }
};

export default Quest;
