// === /herohealth/hydration-vr/hydration.coach.js ===
// Coach: ส่งข้อความไป HUD ผ่าน event hha:coach
// moods: neutral | happy | sad
'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

function emit(name, detail){ try{ ROOT.dispatchEvent(new CustomEvent(name,{detail})); }catch{} }
function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export function createHydrationCoach(opts={}){
  const run = String(opts.run||'play').toLowerCase();
  const isResearch = (run==='research');

  let lastSayAt = 0;

  function say(text, mood='neutral', force=false){
    const now = Date.now();
    if(!force && (now - lastSayAt) < (isResearch ? 2200 : 1400)) return;
    lastSayAt = now;

    emit('hha:coach', {
      text: String(text||''),
      mood: String(mood||'neutral'),
      ts: now
    });
  }

  function onHit(e={}){
    if(e.power) say('ได้พลังแล้ว! ใช้ให้คุ้ม!', 'happy');
    else if(e.blocked) say('โล่ช่วยไว้! ระวังน้ำหวาน!', 'neutral');
    else if(e.bad) say('โอ๊ย! น้ำหวานทำเสียสมดุล!', 'sad');
    else if(e.good && e.perfect) say('Perfect! สมดุลดีมาก!', 'happy');
    else if(e.good) say('ดี! รักษาสมดุลไว้!', 'neutral');
    else if(e.boss) say('โดนบอสแล้ว! ไปต่อ!', 'happy');
  }

  function onQuest(kind){
    if(kind==='goal') say('Goal ผ่านแล้ว! สุดยอด!', 'happy', true);
    else if(kind==='mini') say('Mini ผ่าน! เก่งมาก!', 'happy', true);
    else if(kind==='all') say('เคลียร์ครบ! โคตรเทพ! 🔥', 'happy', true);
  }

  function onTick(info={}){
    // เบา ๆ: เตือนโซน
    const sec = Number(info.sec||0);
    const zone = String(info.zone||'');
    if(sec>0 && sec%12===0){
      if(zone==='LOW') say('น้ำต่ำไป! เก็บน้ำดีเพิ่มนะ!', 'sad');
      else if(zone==='HIGH') say('น้ำมากไป! ระวังน้ำหวาน!', 'sad');
      else if(zone==='GREEN') say('GREEN อยู่! ไปต่อ!', 'neutral');
    }

    // RAID hints
    if(info.boss && info.phase===2 && sec%7===0){
      say('จำไว้: คอมโบถึงก่อน แล้วค่อยยิงบอส!', 'neutral');
    }
    if(info.boss && info.phase===3 && sec%5===0){
      say('FINAL! อย่าออก GREEN นาน!', 'sad');
    }
  }

  return { say, onHit, onQuest, onTick };
}

export default { createHydrationCoach };
