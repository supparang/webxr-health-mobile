// === /herohealth/hydration-vr/hydration.coach.js ===
// Hydration Coach Director — context-aware + throttle (PRODUCTION)
'use strict';

function emit(name, detail){
  try{ window.dispatchEvent(new CustomEvent(name, { detail })); }catch{}
}

function nowMs(){ return (typeof performance!=='undefined' ? performance.now() : Date.now()); }

export function createHydrationCoach(opts = {}){
  const run = String(opts.run || 'play').toLowerCase();
  const st = {
    lastSayAt: 0,
    lastZone: 'GREEN',
    lastFever: 0,
    lastMood: 'neutral'
  };

  function say(text, mood='neutral', force=false){
    const ts = nowMs();
    const minGap = force ? 0 : 1200;
    if (ts - st.lastSayAt < minGap) return;
    st.lastSayAt = ts;
    st.lastMood = mood;
    emit('hha:coach', { text, mood });
  }

  function onTick({sec, zone, feverPct}){
    st.lastZone = zone || st.lastZone;
    st.lastFever = Number(feverPct||0);

    if (sec === 60) say('เริ่มเลย! รักษาโซน GREEN ให้ได้นานที่สุด 💧', 'happy');
    if (sec === 30) say('ครึ่งทางแล้ว! โฟกัสน้ำดี หลีกเลี่ยงน้ำหวาน 🥤', 'neutral');

    if (zone === 'LOW')  say('น้ำต่ำไปนะ! เก็บ 💧 เพิ่มหน่อย', 'sad');
    if (zone === 'HIGH') say('น้ำหวานเยอะไป! รีบกลับเข้า GREEN นะ', 'sad');

    if (st.lastFever >= 70) say('ใจเย็น ๆ! พยายามเก็บน้ำดีแบบแม่น ๆ', 'sad');
    else if (st.lastFever >= 45) say('เริ่มร้อนแล้วนะ ลดพลาดลงอีกนิด 🔥', 'neutral');

    if (sec <= 10 && sec > 0) say(`เหลือ ${sec} วิ! เร่งอีกนิด!`, 'happy', true);
  }

  function onHit({good, perfect, power, bad, blocked}){
    if (power) return say('ได้พลังแล้ว! ใช้ให้คุ้ม 🛡️⭐', 'happy');
    if (blocked) return say('โล่ช่วยไว้! ระวังต่อไปนะ 🛡️', 'neutral');
    if (bad) return say('โอ๊ย! น้ำหวานโดนแล้ว 😵 หลบให้ไว!', 'sad', true);
    if (perfect) return say('เป๊ะมาก! คุมสมดุลได้สุด ๆ ✨', 'happy');
    if (good && run !== 'research') return say('ดีมาก! ไปต่อ 💧', 'happy');
  }

  function onQuest(kind){
    if (kind === 'goal') say('เคลียร์ GOAL แล้ว! เก่งมาก 🎉', 'happy', true);
    if (kind === 'mini') say('MINI ผ่านแล้ว! ต่อภารกิจถัดไป ⚡', 'happy', true);
  }

  return { say, onTick, onHit, onQuest };
}