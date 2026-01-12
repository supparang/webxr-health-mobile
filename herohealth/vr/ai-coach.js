// === /herohealth/vr/ai-coach.js ===
// AI Coach — PRODUCTION (explainable micro-tips, rate-limited, deterministic-friendly)
// ✅ createAICoach({ emit, game, cooldownMs })
// ✅ onStart(), onUpdate(state), onEnd(summary)
// ✅ Emits: hha:coach { type:'tip'|'praise'|'warn'|'stage', game, text, why, t }
//
// Notes:
// - ไม่บังคับ UI เอง แค่ "emit" อีเวนต์ให้ HUD/overlay ที่เกมมีอยู่ไปแสดง
// - ตั้งใจให้ปลอดภัยกับ research: ไม่สุ่ม, ไม่เปลี่ยนเกมเพลย์โดยตรง (แค่ให้คำแนะนำ)
// - ถ้าไม่ต้องการให้พูดเลย: ใส่ ?coach=0 หรือ window.HHA_COACH=false

export function createAICoach(opts = {}) {
  const WIN = window;
  const DOC = document;

  const emit = (typeof opts.emit === 'function')
    ? opts.emit
    : (name, detail)=>{ try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){ } };

  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };
  const clamp=(v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  const enabledByQuery = (() => {
    const q = String(qs('coach','1')).toLowerCase();
    if (q === '0' || q === 'false') return false;
    if (WIN && WIN.HHA_COACH === false) return false;
    return true;
  })();

  const CFG = {
    game: String(opts.game || qs('gameMode', qs('game','')) || 'game').toLowerCase(),
    cooldownMs: clamp(opts.cooldownMs ?? 3000, 800, 15000),
    // กัน spam เพิ่ม: เปลี่ยนสถานการณ์เล็กน้อยไม่ต้องพูดทุกเฟรม
    minDeltaMs: 500,
    // ถ้าผู้เล่นทำดีต่อเนื่อง จะ praise ได้
    praiseCooldownMs: 5500
  };

  const S = {
    started:false,
    ended:false,
    t0:0,
    lastUpdateAt:0,
    lastSayAt:0,
    lastPraiseAt:0,

    // memory flags
    lastZone:'',
    lastInStorm:false,
    lastInEnd:false,
    lastShield:-1,
    lastCombo:0,
    lastMisses:0,

    // debounced “needs”
    needStage1:false,
    needStage2:false,
    needStage3:false
  };

  function say(type, text, why){
    if (!enabledByQuery) return;
    const now = Date.now();
    if (now - S.lastSayAt < CFG.cooldownMs) return;
    S.lastSayAt = now;

    emit('hha:coach', {
      type,
      game: CFG.game,
      text: String(text || ''),
      why: String(why || ''),
      t: new Date(now).toISOString()
    });
  }

  function praise(text, why){
    if (!enabledByQuery) return;
    const now = Date.now();
    if (now - S.lastPraiseAt < CFG.praiseCooldownMs) return;
    S.lastPraiseAt = now;
    // praise ก็ยังเคารพ cooldown หลักด้วย (กันถี่)
    if (now - S.lastSayAt < Math.min(CFG.cooldownMs, 2200)) return;

    emit('hha:coach', {
      type:'praise',
      game: CFG.game,
      text: String(text || ''),
      why: String(why || ''),
      t: new Date(now).toISOString()
    });
    S.lastSayAt = now;
  }

  // ---------- Rules (explainable) ----------
  function ruleHydrationTips(st){
    // st ที่ Hydration ส่งมา:
    // skill, fatigue, frustration, inStorm, inEndWindow, waterZone, shield, misses, combo
    const zone = String(st.waterZone || '');
    const inStorm = !!st.inStorm;
    const inEnd = !!st.inEndWindow;
    const shield = Number(st.shield ?? 0) | 0;
    const misses = Number(st.misses ?? 0) | 0;
    const combo  = Number(st.combo ?? 0) | 0;
    const skill  = clamp(st.skill ?? 0.5, 0, 1);
    const fatigue = clamp(st.fatigue ?? 0, 0, 1);
    const frus = clamp(st.frustration ?? 0, 0, 1);

    // 0) ช่วงต้นเกม: แนะนำโฟกัส GREEN
    if (!inStorm && zone !== 'GREEN' && fatigue < 0.25 && skill < 0.55){
      say('tip',
        'โฟกัสยิง 💧 เพื่อดึงน้ำกลับเข้า GREEN ก่อนนะ',
        'Stage 1 ต้องคุม GREEN สะสมให้ครบเวลา'
      );
      return;
    }

    // 1) เข้าพายุครั้งแรก: บอกกติกา mini
    if (inStorm && !S.lastInStorm){
      say('warn',
        'STORM มาแล้ว! ทำให้น้ำเป็น LOW/HIGH แล้วเก็บ 🛡️ ไว้ BLOCK ช่วงท้าย (End Window)',
        'Mini จะผ่านเมื่อ zone≠GREEN + pressure พอ + อยู่ End Window และ BLOCK ได้'
      );
      return;
    }

    // 2) ใกล้ End Window แต่ไม่มีโล่
    if (inStorm && inEnd && shield <= 0){
      say('warn',
        'End Window แล้ว แต่ไม่มี 🛡️! รีบเก็บโล่ก่อน แล้วค่อย BLOCK 🥤/🌩️',
        'ถ้า BLOCK ได้ใน End Window จะนับผ่าน mini และกันโดน BAD'
      );
      return;
    }

    // 3) Boss window: กระตุ้นให้ block ให้ครบ
    if (inStorm && inEnd && shield > 0 && skill >= 0.55){
      // โหมดนี้พูดได้ถ้ากำลังเล่นดีพอ
      say('tip',
        'ช่วงท้ายพายุคือเวลาทอง! เก็บคอมโบไว้ แล้ว BLOCK ให้คุ้ม',
        'End Window + BLOCK คือ key ของ Stage 2/3'
      );
      return;
    }

    // 4) MISS เยอะ / หงุดหงิด
    if (misses - S.lastMisses >= 4 || frus > 0.72){
      say('tip',
        'ช้าลงนิด—เล็งให้ชัวร์แล้วค่อยยิง จะลด MISS ได้เยอะ',
        'MISS สูงทำให้คะแนนตกและคอมโบขาด'
      );
      return;
    }

    // 5) เล่นดี: คอมโบยาว
    if (combo >= 12 && combo > S.lastCombo){
      praise('คอมโบกำลังสวย! ลากต่ออีกนิด เกรดจะพุ่งเลย',
        'คอมโบยาวช่วยดันคะแนนและสะท้อนความแม่นยำ'
      );
      return;
    }

    // 6) โซน GREEN นาน: ชม
    if (!inStorm && zone === 'GREEN' && skill >= 0.62 && fatigue < 0.5){
      // ชมไม่บ่อย
      praise('คุม GREEN ได้ดีมาก 👍',
        'Stage 1 ผ่านไวเมื่อคุมสมดุลน้ำได้นิ่ง'
      );
      return;
    }

    // 7) ปลายเกม (fatigue สูง): สรุปเป้าหมาย
    if (fatigue > 0.78 && !inStorm && S.lastInStorm){
      say('tip',
        'ท้ายเกมแล้ว โฟกัส “ยิงชัวร์” + เก็บโล่รอพายุรอบสุดท้าย',
        'ช่วงท้ายพายุมักเป็นจังหวะผ่าน Stage 2/3 ได้ง่าย'
      );
      return;
    }
  }

  function onStart(){
    if (!enabledByQuery) return;
    S.started = true;
    S.ended = false;
    S.t0 = Date.now();
    S.lastUpdateAt = 0;
    S.lastSayAt = 0;
    S.lastPraiseAt = 0;
    S.lastZone = '';
    S.lastInStorm = false;
    S.lastInEnd = false;
    S.lastShield = -1;
    S.lastCombo = 0;
    S.lastMisses = 0;

    // เปิดเกม: กล่าวสั้น ๆ
    say('tip',
      'เป้าหมาย: คุม GREEN → ผ่าน STORM mini → เคลียร์ BOSS ด้วย 🛡️',
      'เล่นแบบเป็นขั้นจะผ่านไวและสนุกกว่า'
    );
  }

  function onUpdate(state = {}){
    if (!enabledByQuery || !S.started || S.ended) return;

    const now = Date.now();
    if (now - S.lastUpdateAt < CFG.minDeltaMs) return;
    S.lastUpdateAt = now;

    // Hydration-specific rule set
    ruleHydrationTips(state);

    // update memory
    S.lastZone = String(state.waterZone || S.lastZone);
    S.lastInStorm = !!state.inStorm;
    S.lastInEnd = !!state.inEndWindow;
    S.lastShield = (Number(state.shield ?? S.lastShield) | 0);
    S.lastCombo = (Number(state.combo ?? S.lastCombo) | 0);
    S.lastMisses = (Number(state.misses ?? S.lastMisses) | 0);
  }

  function onEnd(summary = {}){
    if (!enabledByQuery) return;
    S.ended = true;

    const grade = String(summary.grade || '');
    const acc = Number(summary.accuracyGoodPct || 0);
    const miss = Number(summary.misses || 0);
    const stage = Number(summary.stageCleared || 0);

    if (stage >= 3){
      say('praise',
        `จบแบบโหด! ผ่านครบ Stage 1–3 🎉 (เกรด ${grade || '—'})`,
        'คุมสมดุล + ผ่านพายุ + เคลียร์บอสได้ครบ'
      );
    } else if (stage === 2){
      say('tip',
        `ดีมาก! ผ่านถึง Stage 2 แล้ว เหลือเคลียร์บอสอีกนิด`,
        'เก็บ 🛡️ ไว้ช่วงท้ายพายุ แล้ว BLOCK 🌩️ ให้ครบ'
      );
    } else if (stage === 1){
      say('tip',
        `ผ่าน Stage 1 แล้ว ต่อไปต้องผ่านพายุ (STORM mini)`,
        'ทำให้น้ำเป็น LOW/HIGH แล้ว BLOCK ช่วง End Window'
      );
    } else {
      say('tip',
        `รอบหน้าโฟกัสคุม GREEN ก่อนนะ (Acc ${acc.toFixed(0)}%, Miss ${miss})`,
        'Stage 1 เป็นฐาน ถ้าผ่านไว เกมจะมันขึ้นทันที'
      );
    }
  }

  return { onStart, onUpdate, onEnd };
}

// Default export (optional convenience)
export default { createAICoach };