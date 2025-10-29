// === Hero Health Academy — game/modes/goodjunk.js
// Mode: Good vs Trash
// - DOM-spawn (ใช้ #spawnHost ของ main)
// - Anti-repeat emoji (ไม่ซ้ำติดกัน 2 ชิ้นล่าสุด)
// - Golden Assist (สุ่มเล็กน้อย / ช่วยคัมแบ็ก)
// - Dynamic lifetime + end-phase speedup (ช่วงท้ายเร็วขึ้น)
// - Soft penalty (ไม่หักแรงเกิน, คอมโบถูกรีเซ็ตที่ ScoreSystem)
// - Freeze-on-bad 300ms (กันผู้เล่นกดรัวผิด)
// - Mini-quests (Eat Good / Avoid Junk) อัปเดตผ่าน HUD

export const name = 'goodjunk';

/* Pools */
const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍜','🍖','🍗','🧂','🍭','🧁'];

/* Local state (ต่อรันของโหมดนี้เท่านั้น) */
let _state = null;           // STATE จาก main
let _hud = null;             // HUD จาก main
let _startT = 0;             // performance.now()
let _lastPicks = [];         // anti-repeat (จำ 2 ตัวหลังสุด)
let _quest = {               // mini-quests
  eatGood:   { need: 10, progress: 0 },
  avoidJunk: { need: 6,  progress: 0 },
};
let _nextQuestAnnounce = 0;

/* ---------- Lifecycle ---------- */
export function init(STATE, hud, opts = {}) {
  _state = STATE;
  _hud = hud;
  _startT = (performance?.now?.() || Date.now());
  _lastPicks.length = 0;

  // Reset quests
  _quest = {
    eatGood:   { need: 10, progress: 0 },
    avoidJunk: { need: 6,  progress: 0 },
  };
  _pushQuests();

  // แสดงเป้าหมาย
  try { _hud.setTarget('ผลไม้/ผัก/โปรตีนดี', _quest.eatGood.progress, _quest.eatGood.need); } catch {}
  try { _hud.showTarget(); } catch {}
}

export function cleanup() {
  _state = null;
  _hud = null;
}

/* per-frame tick (เรียกจาก main.loop) */
export function tick(STATE, { sfx = {}, fx = {}, power }, hud) {
  const t = performance?.now?.() || Date.now();
  if (t > _nextQuestAnnounce) {
    _nextQuestAnnounce = t + 500; // ลดงาน DOM
    _pushQuests();
  }
}

/* ---------- Spawn meta picker ---------- */
export function pickMeta(control = { life: 3000 }, STATE) {
  const now = performance?.now?.() || Date.now();
  const elapsed = Math.max(0, (now - _startT) / 1000);
  const remain  = Math.max(0, (STATE?.endAt ? (STATE.endAt - (performance?.now?.() || Date.now())) / 1000 : 0));
  const endPhase = remain <= 15;

  // เริ่มอัตรา 65/35 แล้วปรับเล็กน้อยตามคอมโบ
  let goodBias = 0.65;
  const combo = (STATE?.combo|0);
  if (combo > 10) goodBias -= 0.07;
  if (combo > 20) goodBias -= 0.05;

  // อายุชิ้น เร็วขึ้นช่วงท้าย
  const baseLife = Math.max(1200, control.life || 3000);
  let life = Math.min(baseLife, 2600);
  if (elapsed > 20) life -= 200;
  if (elapsed > 35) life -= 200;
  if (endPhase)     life -= 300;
  life = Math.max(700, life);

  // Golden Assist เมื่อคอมโบตก/พลาดบ่อย
  const bad = (STATE?.stats?.bad|0);
  const goldenChance = Math.min(0.25, 0.06 + (combo === 0 ? 0.08 : 0) + Math.min(0.1, bad * 0.01));

  const useGood = Math.random() < goodBias;
  const char = pickEmoji(useGood ? GOOD : JUNK);
  const golden = useGood && Math.random() < goldenChance;

  const aria = useGood ? 'Healthy food' : 'Junk food';
  const label = char;

  return { char, label, aria, good: !!useGood, golden, life };
}

/* ---------- On hit ---------- */
/** คืนค่า: "perfect" | "good" | "bad" | "ok" */
export function onHit(meta, { sfx = {}, fx = {}, power }, STATE, hud) {
  // ตัดสินแบบง่าย: ของดี → 35% perfect, ที่เหลือ good / ของเสีย → bad
  let outcome = meta.good ? (Math.random() < 0.35 ? 'perfect' : 'good') : 'bad';

  // Golden → perfect + บัฟ
  if (meta.golden && meta.good && outcome !== 'bad') {
    outcome = 'perfect';
    try { power?.apply?.('x2', 5); } catch {}
    try { hud?.toast?.('×2 Boost (5s)!'); } catch {}
  }

  // ถ้า bad → freeze 300ms กันรัวผิด
  if (outcome === 'bad') {
    try { hud?.flashDanger?.(); } catch {}
    const t = (performance?.now?.() || Date.now());
    STATE.freezeUntil = t + 300;
  }

  return outcome;
}

/* ---------- FX hooks (optional) ---------- */
export const fx = {
  onSpawn(el, STATE) {
    // ปล่อยว่าง: main จะ tilt 3D ให้แล้ว
  },
  onHit(x, y, meta, STATE) {
    try {
      const HFX = (window.HHA_FX || {});
      if (meta.golden && meta.good) {
        HFX.shatter3D?.(x, y, { shards: 28, sparks: 18 });
      } else if (meta.good) {
        HFX.shatter3D?.(x, y, { shards: 18, sparks: 8 });
      } else {
        HFX.shatter3D?.(x, y, { shards: 10, sparks: 4 });
      }
    } catch {}
  }
};

/* ---------- Helpers ---------- */
function pickEmoji(pool){
  if (!Array.isArray(pool) || pool.length === 0) return '🍎';
  let choice = pool[(Math.random()*pool.length)|0];

  // anti-repeat: ไม่ซ้ำ 2 ตัวล่าสุด
  let tries = 0;
  while (_lastPicks.includes(choice) && tries < 6) {
    choice = pool[(Math.random()*pool.length)|0];
    tries++;
  }
  _lastPicks.push(choice);
  if (_lastPicks.length > 2) _lastPicks.shift();
  return choice;
}

function _pushQuests(){
  if (!_hud) return;
  const list = [
    {
      key: 'eatGood',
      name: 'Eat Healthy',
      icon: '🥗',
      need: _quest.eatGood.need,
      progress: _quest.eatGood.progress,
      done: _quest.eatGood.progress >= _quest.eatGood.need
    },
    {
      key: 'avoidJunk',
      name: 'Avoid Junk',
      icon: '🚫🍔',
      need: _quest.avoidJunk.need,
      progress: _quest.avoidJunk.progress,
      done: _quest.avoidJunk.progress >= _quest.avoidJunk.need
    }
  ];
  _hud.setQuestChips(list);
}

/* ---------- เสริม: อัปเดตเควสต์หลังผู้เล่นกดโดน ---------- */
/* เรียกจาก main หลังได้ outcome/meta (ไม่บังคับ แต่แนะนำ) */
export function postHitForQuest(outcome, meta){
  if (!_hud || !meta) return;
  if (meta.good && (outcome === 'good' || outcome === 'perfect')) {
    _quest.eatGood.progress = Math.min(_quest.eatGood.need, _quest.eatGood.progress + 1);
    if (_quest.eatGood.progress === _quest.eatGood.need) {
      try { _hud.toast('Quest: Eat Healthy ✓'); } catch {}
    }
    // กลไกง่าย: ทุก 2 Good → นับเลี่ยง Junk +1
    if ((_quest.eatGood.progress % 2) === 0) {
      _quest.avoidJunk.progress = Math.min(_quest.avoidJunk.need, _quest.avoidJunk.progress + 1);
      if (_quest.avoidJunk.progress === _quest.avoidJunk.need) {
        try { _hud.toast('Quest: Avoid Junk ✓'); } catch {}
      }
    }
    _pushQuests();
  }
}
