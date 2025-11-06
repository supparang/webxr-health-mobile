// … imports คงเดิม …
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

// … GOOD / JUNK / TIME_BY_DIFF / caps คงเดิม …

// A) Slot grid — ย้าย “ลงล่าง” (ใต้ mini quest ที่ y≈1.70)
function buildSlots() {
  const xs = [-0.70,-0.42,-0.14, 0.14, 0.42, 0.70];
  const ys = [ 0.95, 1.10, 1.25, 1.40, 1.55 ]; // << ต่ำกว่าแผงเควส
  const slots = [];
  for (const x of xs) for (const y of ys)
    slots.push({ x, y, z: -(1.25 + Math.random()*0.35), used:false });
  return slots;
}
// takeFreeSlot / releaseSlot / bindOnce … คงเดิม

export async function boot({ host, duration, difficulty='normal', goal=40 } = {}) {
  // host safety … คงเดิม

  const sfx = new SFX('../assets/audio/');
  if (sfx.unlock) await sfx.unlock();
  if (sfx.attachPageVisibilityAutoMute) sfx.attachPageVisibilityAutoMute();

  const scene = $('a-scene') || document.body;
  const fever = new Fever(scene, null, { durationMs: 10000 });

  // B) ใช้ tQmain เป็น HUD เป้าหมายเดียว (ทีละข้อ)
  const mq = new MiniQuest(
    { tQmain: $('#tQmain') }, // << ใช้ main line
    { coach_start: $('#coach_start'), coach_good: $('#coach_good'),
      coach_warn: $('#coach_warn'), coach_fever: $('#coach_fever'),
      coach_quest: $('#coach_quest'), coach_clear: $('#coach_clear') }
  );
  mq.start(goal); // sequential by default

  const missions = new MissionDeck();
  missions.draw3?.();

  // … ส่วนที่เหลือ (duration, difficulty cfg, spawn, onHit, timers) เหมือนเวอร์ชันก่อน …
  //  — ไม่มีอะไรต้องแก้เพิ่มเติม นอกจาก buildSlots และ MiniQuest HUD ด้านบน
}
