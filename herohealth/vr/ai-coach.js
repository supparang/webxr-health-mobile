// === /herohealth/vr/ai-coach.js ===
// HHA AI Coach — Universal (rate-limited, explainable micro-tips)
// ✅ onStart/onUpdate/onEnd
// ✅ emits: hha:coach { text, sub, mood }
// ✅ deterministic-friendly (no randomness by default)

'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export function createAICoach(cfg = {}){
  const emit = cfg.emit || (()=>{});
  const game = String(cfg.game || 'hha');
  const cooldownMs = Math.max(800, Number(cfg.cooldownMs||2500));

  const st = {
    lastAt: 0,
    lastKey: '',
    started: false
  };

  function say(key, text, sub='', mood='neutral'){
    const now = Date.now();
    if (now - st.lastAt < cooldownMs && key === st.lastKey) return;
    if (now - st.lastAt < cooldownMs && key !== st.lastKey){
      // still allow if urgent keys
      const urgent = /end|storm|danger|fail/.test(key);
      if (!urgent) return;
    }
    st.lastAt = now;
    st.lastKey = key;

    emit('hha:coach', { game, key, text, sub, mood });
    // auto-bind to DOM if present (optional)
    try{
      const t = document.getElementById('coach-text');
      const s = document.getElementById('coach-sub');
      if (t) t.textContent = text;
      if (s) s.textContent = sub || '';
    }catch(_){}
  }

  function onStart(){
    st.started = true;
    say('start', 'เริ่มเลย! เล็งกลางจอแล้วค่อยยิง 💧', 'Tip: ยิงเป็นจังหวะ จะคอมโบยาวขึ้น', 'happy');
  }

  function onUpdate(x){
    if (!st.started) return;
    const skill = clamp(x.skill,0,1);
    const fat = clamp(x.fatigue,0,1);
    const fru = clamp(x.frustration,0,1);

    if (x.inEndWindow){
      say('end-window',
        '⏳ ช่วงท้ายพายุ! เตรียม BLOCK ด้วย 🛡️',
        'ถ้าโดน BAD ตอนนี้โดยไม่มีโล่ = Mini พังทันที',
        'sad'
      );
      return;
    }

    if (x.inStorm && x.shield<=0){
      say('storm-no-shield',
        '🌀 ตอนนี้เป็นพายุ แต่โล่หมดแล้ว!',
        'พยายามเก็บ 🛡️ ก่อนเข้าท้ายพายุ',
        'neutral'
      );
    }

    if (fru > 0.68 || x.misses > 18){
      say('frustrated',
        '💡 ลดการรัว: เล็งค้าง 0.3 วิ แล้วค่อยยิง',
        'ยิง “ชัวร์ ๆ” ก่อน จะลด MISS ได้เร็ว',
        'neutral'
      );
      return;
    }

    if (skill < 0.45){
      say('low-skill',
        '🎯 โฟกัสยิง 💧 ก่อน แล้วค่อยรับมือ 🥤',
        'อย่ากดรัว จะคุม water ได้ง่ายขึ้น',
        'neutral'
      );
      return;
    }

    if (skill > 0.78 && x.combo >= 10){
      say('good-flow',
        '🔥 ฟอร์มดีมาก! ลากคอมโบต่อเนื่อง',
        'เป้าต่อไป: ผ่าน Mini ทุกพายุ',
        'happy'
      );
      return;
    }

    if (fat > 0.8){
      say('fatigue',
        '😮‍💨 ใกล้จบแล้ว! เล่นนิ่ง ๆ จะพาเกรดขึ้น',
        'อย่าเสี่ยงยิง BAD',
        'neutral'
      );
    }
  }

  function onEnd(sum){
    const grade = String(sum?.grade || 'C');
    if (grade==='SSS' || grade==='SS' || grade==='S'){
      say('end-good', `🏁 จบเกม! เกรด ${grade} สุดยอด`, 'ครั้งหน้า: ผ่าน Mini ให้ครบทุกพายุ', 'happy');
    } else if (grade==='A' || grade==='B'){
      say('end-mid', `🏁 จบเกม! เกรด ${grade}`, 'โฟกัสลด MISS + คุม GREEN ให้เสถียร', 'neutral');
    } else {
      say('end-low', `🏁 จบเกม! เกรด ${grade}`, 'ลองปรับ lock=120 ยิงง่ายขึ้น แล้วค่อยลด lock ทีหลัง', 'sad');
    }
  }

  return { onStart, onUpdate, onEnd };
}