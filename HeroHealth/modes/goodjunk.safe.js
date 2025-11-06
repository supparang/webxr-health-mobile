// === modes/goodjunk.safe.js — Production (12 fixes/features) ===
import { Difficulty }   from '../vr/difficulty.js';
import { Emoji }        from '../vr/emoji-sprite.js';
import { Fever }        from '../vr/fever.js';
import { MiniQuest }    from '../vr/miniquest.js';
import { MissionDeck }  from '../vr/mission.js';
import { Particles, AdvancedFX } from '../vr/particles.js';
import { SFX }          from '../vr/sfx.js';

const $ = s => document.querySelector(s);
const sample = arr => arr[Math.floor(Math.random()*arr.length)];
const clamp  = (n,a,b)=>Math.max(a,Math.min(b,n));
const now = ()=>performance.now();

// 1) กลุ่มละ 20 อย่าง
const GOOD = ['🍎','🍏','🍇','🍓','🍍','🍉','🍐','🍊','🫐','🥝','🍋','🍒','🍈','🥭','🍑','🥗','🐟','🥜','🍚','🍞'];
const JUNK = ['🍔','🍟','🍕','🌭','🍗','🥓','🍩','🍪','🧁','🍰','🍫','🍬','🍭','🥤','🧋','🍹','🍨','🍧','🍿','🥮'];

const TIME_BY_DIFF = { easy: 45, normal: 60, hard: 75 };
const MAX_ACTIVE_BY_DIFF   = { easy: 4,  normal: 6,  hard: 8 };
const SPAWN_BUDGET_PER_SEC = { easy: 4,  normal: 6,  hard: 8 };
const GOOD_RATE            = 0.70;
const GOLDEN_RATE          = 0.07; // 11) Golden item 7%

// --- Twemoji fallback (7) ---
const USE_EMOJI_SVG = (()=>{
  const u = new URL(location.href);
  const v = (u.searchParams.get('emoji')||'').toLowerCase();
  return v==='svg'; // เปิดด้วย ?emoji=svg
})();
function toCodePoints(str){
  const pts=[];
  for (const ch of str){ const cp = ch.codePointAt(0).toString(16); pts.push(cp); }
  return pts.join('-');
}
function twemojiURL(ch){ return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${toCodePoints(ch)}.svg`; }

// สร้างอีโมจิ (รองรับ Twemoji เมื่อเปิดโหมด svg)
function makeEmojiNode(char, {scale=0.58}={}){
  if (!USE_EMOJI_SVG){
    if (typeof Emoji?.fromChar === 'function') return Emoji.fromChar(char, { size:96, scale, glow:true, shadow:true });
    if (typeof Emoji?.create   === 'function') {
      const type = GOOD.includes(char) ? 'GOOD' : (JUNK.includes(char) ? 'JUNK' : 'STAR');
      return Emoji.create({ type, size: scale });
    }
    const el=document.createElement('a-entity');
    el.setAttribute('text', { value: char, align:'center', width: 2.2*scale, color:'#fff' });
    return el;
  } else {
    const img=document.createElement('a-image');
    img.setAttribute('src', twemojiURL(char));
    img.setAttribute('width',  0.40*scale*2.0);
    img.setAttribute('height', 0.40*scale*2.0);
    return img;
  }
}

// ===== เป้าอยู่ “ล่าง-กลางจอ” (spawnHost @ y=0.40 → local yBase ~0.60) =====
function buildSlots(yBase = 0.60) {
  const xs = [-0.70,-0.42,-0.14, 0.14, 0.42, 0.70];
  const ys = [ yBase, yBase+0.15, yBase+0.30, yBase+0.45, yBase+0.60 ];
  const slots = [];
  for (const x of xs) for (const y of ys)
    slots.push({ x, y, z: -(1.20 + Math.random()*0.30), used:false });
  return slots;
}
function takeFreeSlot(slots){ const free = slots.filter(s=>!s.used); if(!free.length) return null; const s=free[Math.floor(Math.random()*free.length)]; s.used=true; return s; }
function releaseSlot(slots, slot){ if (slot) slot.used = false; }

export async function boot({ host, duration, difficulty='normal', goal=40 } = {}) {
  // host safety
  if (!host){
    const wrap = $('a-scene') || document.body;
    const auto = document.createElement('a-entity');
    auto.id = 'spawnHost';
    wrap.appendChild(auto);
    host = auto;
  }

  const sfx = new SFX('../assets/audio/');
  if (sfx.unlock) await sfx.unlock();
  if (sfx.attachPageVisibilityAutoMute) sfx.attachPageVisibilityAutoMute();

  // 9) SFX control from UI
  window.addEventListener('hha:muteToggle', e=> sfx.mute?.(!!(e.detail?.muted)));
  window.addEventListener('hha:volChange', e=> sfx.setVolume?.(Number(e.detail?.vol)||1));

  const scene = $('a-scene') || document.body;
  const fever = new Fever(scene, null, { durationMs: 10000 });  // 4) BGM เฉพาะ Fever (ใน SFX.feverStart/End)

  // Mini Quest (บนสุด, แสดงทีละข้อ) 5)
  const mq = new MiniQuest(
    { tQmain: $('#tQmain') },
    { coach_start: $('#coach_start'), coach_good: $('#coach_good'),
      coach_warn: $('#coach_warn'), coach_fever: $('#coach_fever'),
      coach_quest: $('#coach_quest'), coach_clear: $('#coach_clear') }
  );
  mq.start(goal);

  const missions = new MissionDeck();
  missions.draw3?.();

  // เวลาเล่นตามระดับ (fallback
