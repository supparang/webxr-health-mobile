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
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍜','🍖','🍗','🍟','🧂','🍭','🧁'];

/* Local state (lives only inside this module per run) */
let _state = null;           // ref STATE from main
let _hud = null;             // ref HUD from main
let _startT = 0;             // ms (performance.now)
let _lastPicks = [];         // last 2 chars to avoid repeats
let _quest = {               // mini-quests progress
  eatGood: { need: 10, progress: 0 },
  avoidJunk: { need: 6, progress: 0, /* นับจาก "ไม่กด Junk" ที่หมดอายุ */ },
};
let _nextQuestAnnounce = 0;

/* ---------- Lifecycle ---------- */

export function init(STATE, hud, opts = {}) {
  _state = STATE;
  _hud = hud;
  _startT = (performance?.now?.() || Date.now());

  _lastPicks.length = 0;

  // Reset/seed quests
  _quest = {
    eatGood:   { need: 10, progress: 0 },
    avoidJunk: { need: 6, progress: 0 },
  };
  _pushQuests();

  // แสดง Target เล็กน้อยให้เข้าใจ (เป้าหมาย = กินอาหารดี)
  try { _hud.setTarget('ผลไม้/ผัก/โปรตีนดี', _quest.eatGood.progress, _quest.eatGood.need); } catch {}
  try { _hud.showTarget(); } catch {}
}

export function cleanup(/*STATE, hud*/) {
  // ไม่มี interval ภายในโหมดนี้ (ลูปหลักอยู่ใน main)
  _state = null;
  _hud = null;
}

/* per-frame tick (เรียกจาก main.loop) */
export function tick(STATE, { sfx = {}, fx = {}, power }, hud) {
  // อัปเดต quest chip อย่างห่าง ๆ (ทุก ~500ms) เพื่อลดงาน DOM
  const t = performance?.now?.() || Date.now();
  if (t > _nextQuestAnnounce) {
    _nextQuestAnnounce = t + 500;
    _pushQuests();
  }
}

/* ---------- Spawn meta picker ---------- */
/** main.js จะเรียก pickMeta() เพื่อสร้างข้อมูล spawn แต่ละชิ้น */
export function pickMeta(control = { life: 3000 }, STATE) {
  // เวลาผ่านไปเท่าไร
  const now = performance?.now?.() || Date.now();
  const elapsed = Math.max(0, (now - _startT) / 1000);           // sec
  const remain = Math.max(0, (STATE?.endAt ? (STATE.endAt - (performance?.now?.() || Date.now())) / 1000 : 0));
  const endPhase = remain <= 15;                                  // ช่วงท้ายเกม

  // โอกาสสแปวนประเภท GOOD/JUNK (เริ่มอัตรา 65/35 และปรับเล็กน้อย)
  let goodBias = 0.65;
  // ถ้าคอมโบสูง ให้เพิ่ม Junk บ้างเพื่อท้าทาย
  if (STATE?.combo > 10) goodBias -= 0.07;
  if (STATE?.combo > 20) goodBias -= 0.05;

  // ช่วงท้าย เร่งเร็วขึ้นและลดอายุ
  const baseLife = Math.max(1200, control.life || 3000);
  let life = Math.min(baseLife, 2600);
  if (elapsed > 20) life -= 200;
  if (elapsed > 35) life -= 200;
  if (endPhase) life -= 300;                      // end-phase speedup
  life = Math.max(700, life);

  // โอกาส Golden Assist:
  // - ถ้าคอมโบตก 0 หรือผู้เล่นพลาดบ่อย → เพิ่มโอกาสช่วยขึ้นเล็กน้อย
  // - จำกัดไม่ให้ถี่เกินไป
  const combo = (STATE?.combo|0);
  const bad = (STATE?.stats?.bad|0);
  const goldenChance =
    Math.min(0.25, 0.06 + (combo === 0 ? 0.08 : 0) + Math.min(0.1, bad * 0.01));

  const useGood = Math.random() < goodBias;
  const char = pickEmoji(useGood ? GOOD : JUNK);
  const golden = useGood && Math.random() < goldenChance;

  const aria = useGood ? 'Healthy food' : 'Junk food';
  const label = char; // ใช้ emoji เป็น label โดยตรง (อ่านง่าย/ใหญ่)

  return { char, label, aria, good: !!useGood, golden, life };
}

/* ---------- On hit ---------- */
/**
 * @returns "perfect" | "good" | "bad" | "ok"
 * main.js จะใช้ผลนี้ไปอัปเดตคะแนน/คอมโบ/เอฟเฟกต์ต่อ
 */
export function onHit(meta, { sfx = {}, fx = {}, power }, STATE, hud) {
  // วัด "เร็ว" = perfect, อื่น ๆ = good
  // (ง่าย ๆ: randomช่วยก่อน ถัดไปอาจเพิ่ม timestamp ใน meta เพื่อตัดตาม life%)
  let outcome = meta.good ? (Math.random() < 0.35 ? 'perfect' : 'good') : 'bad';

  // Golden ช่วย: ถ้าถูกกับของดี → ให้ผล perfect และบัฟเล็ก ๆ
  if (meta.golden && meta.good && outcome !== 'bad') {
    outcome = 'perfect';
    try { power?.apply?.('x2', 5); } catch {}
    try { hud?.toast?.('×2 Boost (5s)!'); } catch {}
  }

  // ถ้าเป็น bad → freeze-on-bad 300ms เพื่อกันรัวผิด
  if (outcome === 'bad') {
    try { hud?.flashDanger?.(); } catch {}
    // freeze
    const t = (performance?.now?.() || Date.now());
    STATE.freezeUntil = t + 300;
  }

  return outcome;
}

/* ---------- FX hooks (optional) ---------- */
export const fx = {
  onSpawn(el, STATE) {
    // ทำให้ของดี/ทอง มีแสง/วิบวับเล็กน้อย
    // (ใช้ class / style ตรง ๆ เพื่อไม่ผูกกับ lib)
    // meta ไม่ถูกส่งมาที่นี่โดยตรงจาก main ตอนสร้าง el
    // แต่เราสามารถเพิ่มจาก data-* ภายหลังหากต้องการ
    // (ปล่อยว่าง: main จะเรียก FX.add3DTilt ให้แล้ว)
  },
  onHit(x, y, meta, STATE) {
    try {
      // ใช้เอฟเฟกต์รวมที่ main นำเข้าไว้ (ถ้ามี)
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
  // anti-repeat: ไม่ซ้ำ 2 ตัวล่าสุด
  if (!Array.isArray(pool) || pool.length === 0) return '🍎';
  let choice = pool[(Math.random()*pool.length)|0];

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
      done: _quest.avoidJunk.progress >= _quest.av
