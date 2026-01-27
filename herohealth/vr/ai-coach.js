// === /herohealth/vr/ai-coach.js ===
// AI Coach — PRODUCTION v1.0
// ✅ createAICoach({ emit, game, cooldownMs })
// ✅ Methods: onStart(), onUpdate(state), onEnd(summary)
// ✅ Explainable micro-tips + rate-limit
// ✅ Safe: no-op if emit missing

'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export function createAICoach(cfg){
  const emit = (cfg && typeof cfg.emit === 'function') ? cfg.emit : (()=>{});
  const game = String((cfg && cfg.game) || 'game');
  const cooldownMs = clamp((cfg && cfg.cooldownMs) || 2800, 900, 12000);

  const S = {
    t0: 0,
    lastSayAt: 0,
    lastKey: '',
    lastStorm: false,
    lastEndWindow: false,
    lastZone: '',
    nHints: 0,
    nPraises: 0
  };

  function now(){ return (typeof performance !== 'undefined' ? performance.now() : Date.now()); }

  function say(type, text, extra){
    const t = now();
    if (t - S.lastSayAt < cooldownMs) return false;

    const key = type + '|' + text;
    if (key === S.lastKey && (t - S.lastSayAt) < cooldownMs*2.2) return false;

    S.lastSayAt = t;
    S.lastKey = key;

    emit('hha:coach', Object.assign({
      game,
      type,        // tip | praise | warn | explain
      text
    }, extra || {}));

    return true;
  }

  function tip(text, extra){ if (say('tip', text, extra)) S.nHints++; }
  function praise(text, extra){ if (say('praise', text, extra)) S.nPraises++; }
  function warn(text, extra){ say('warn', text, extra); }
  function explain(text, extra){ say('explain', text, extra); }

  function onStart(){
    S.t0 = now();
    S.lastSayAt = 0;
    S.lastKey = '';
    S.lastStorm = false;
    S.lastEndWindow = false;
    S.lastZone = '';
    S.nHints = 0;
    S.nPraises = 0;

    // เริ่มเกม: สั้น กระชับ
    tip('เริ่มเลย! ยิง 💧 เพื่อคุมให้อยู่ GREEN และเก็บ 🛡️ ไว้ BLOCK ตอนพายุ 🌪️');
  }

  function onUpdate(st){
    // st: {skill, fatigue, frustration, inStorm, inEndWindow, waterZone, shield, misses, combo}
    st = st || {};
    const inStorm = !!st.inStorm;
    const inEnd = !!st.inEndWindow;
    const zone = String(st.waterZone || '');
    const shield = (st.shield|0);
    const misses = (st.misses|0);
    const combo = (st.combo|0);

    const skill = clamp(st.skill, 0, 1);
    const fatigue = clamp(st.fatigue, 0, 1);
    const frustration = clamp(st.frustration, 0, 1);

    // 1) Storm transitions
    if (inStorm && !S.lastStorm){
      S.lastStorm = true;
      warn('STORM! ต้องทำ LOW/HIGH ให้สำเร็จ แล้วรอช่วงท้ายเพื่อ BLOCK 🛡️');
      return;
    }
    if (!inStorm && S.lastStorm){
      S.lastStorm = false;
      praise('ผ่านพายุแล้ว! เก็บคอมโบต่อและเตรียมพายุถัดไป');
      return;
    }

    // 2) End Window ping (สำคัญมาก)
    if (inEnd && !S.lastEndWindow){
      S.lastEndWindow = true;
      warn(shield>0 ? 'END WINDOW! ตอนนี้แหละ BLOCK ด้วย 🛡️' : 'END WINDOW! รีบหา 🛡️ หรือหลบ BAD ให้ได้');
      return;
    }
    if (!inEnd && S.lastEndWindow){
      S.lastEndWindow = false;
      // ไม่ต้องพูดทุกครั้ง
    }

    // 3) Zone coaching (อธิบายเหตุผลแบบ explainable)
    if (zone && zone !== S.lastZone){
      S.lastZone = zone;
      if (!inStorm){
        if (zone === 'GREEN') praise('ดีมาก! อยู่ GREEN แล้ว คะแนนจะไหลลื่น');
        else if (zone === 'LOW') explain('ตอนนี้ LOW: ยิง 💧 จะช่วยดันกลับเข้า GREEN (คุมสมดุลน้ำ)');
        else if (zone === 'HIGH') explain('ตอนนี้ HIGH: ยิง 💧 จะช่วยดึงกลับเข้า GREEN (อย่าพลาด BAD)');
      }
      return;
    }

    // 4) Tactical tips (ไม่ถี่เกิน)
    if (inStorm){
      if (shield <= 0){
        tip('พายุนี้หา 🛡️ ก่อน! ช่วงท้ายต้องใช้ BLOCK ถึงจะผ่าน Mini');
        return;
      }
      if (zone === 'GREEN'){
        tip('ในพายุอย่าอยู่ GREEN นะ! ต้อง LOW หรือ HIGH ให้ได้ก่อน แล้วค่อย BLOCK ตอนท้าย');
        return;
      }
      // ถ้าเล่นดีขึ้น ให้ชมเป็นระยะ
      if (skill >= 0.78 && combo >= 8){
        praise('ฟอร์มดีมาก! คอมโบยาว ๆ แบบนี้ เกรดพุ่งแน่นอน');
        return;
      }
    } else {
      // นอกพายุ: ถ้าพลาดเยอะ → แนะนำแบบลดหัวร้อน
      if (misses >= 12 && frustration >= 0.55){
        tip('MISS เริ่มเยอะ: ช้าลงนิด เล็งให้ชัวร์ก่อนยิง จะคุม GREEN ง่ายขึ้น');
        return;
      }
      if (combo >= 10 && skill >= 0.75){
        praise('สุดยอด! คอมโบเกิน 10 แล้ว รักษาจังหวะนี้ไว้');
        return;
      }
      if (fatigue >= 0.75 && S.nHints <= 3){
        tip('ใกล้จบแล้ว! โฟกัสยิงเป้าที่ชัวร์ จะรักษาเกรดได้ดี');
        return;
      }
    }
  }

  function onEnd(summary){
    summary = summary || {};
    const grade = String(summary.grade || '');
    const acc = Number(summary.accuracyGoodPct || 0);
    const miss = Number(summary.misses || 0);
    const stage = Number(summary.stageCleared || 0);

    if (grade === 'SSS' || grade === 'SS'){
      praise(`โหดมาก! ได้เกรด ${grade} — Accuracy ${acc.toFixed(1)}%`);
      return;
    }

    if (stage < 1){
      tip('รอบหน้าโฟกัส “คุม GREEN” ก่อนนะ ผ่าน Stage1 แล้วเกมจะลื่นขึ้นมาก');
      return;
    }
    if (stage < 2){
      tip('รอบหน้า: ตอนพายุให้ทำ LOW/HIGH ก่อน แล้วรอ END WINDOW เพื่อ BLOCK 🛡️');
      return;
    }
    if (stage < 3){
      tip('รอบหน้า: เก็บ 🛡️ เผื่อไว้ 1–2 อัน แล้วค่อย BLOCK ตอน Boss Window ให้ครบ');
      return;
    }

    // default
    tip(`จบแล้ว! เกรด ${grade} | MISS ${miss} | Accuracy ${acc.toFixed(1)}% — รอบหน้าลองลด MISS ลงอีกนิด`);
  }

  return { onStart, onUpdate, onEnd };
}
