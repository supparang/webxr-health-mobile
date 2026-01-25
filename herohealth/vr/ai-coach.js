// === /herohealth/vr/ai-coach.js ===
// AI Coach (HHA Standard) — PRODUCTION
// ✅ Rate-limit tips (cooldown)
// ✅ Writes to Water panel tip (#water-tip) + optional toast overlay
// ✅ Emits: hha:coach {game, key, text, level}
// ✅ Pure advice only — never changes gameplay state (research-safe)

'use strict';

export function createAICoach(cfg = {}){
  const emit = typeof cfg.emit === 'function' ? cfg.emit : ()=>{};
  const game = String(cfg.game || 'game');
  const cooldownMs = Math.max(900, Number(cfg.cooldownMs || 3200));

  const DOC = (typeof window !== 'undefined') ? window.document : null;

  const S = {
    started: false,
    ended: false,
    lastSpeakAt: 0,
    lastKey: '',
    streakSame: 0,
    toastMounted: false,
    prefer: String(cfg.prefer || 'both') // 'water' | 'toast' | 'both'
  };

  function now(){ return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }

  function qs(sel){ try{ return DOC?.querySelector(sel) || null; }catch(_){ return null; } }
  function gid(id){ try{ return DOC?.getElementById(id) || null; }catch(_){ return null; } }

  function mountToast(){
    if (!DOC || S.toastMounted) return;
    S.toastMounted = true;

    if (gid('hha-coach-toast')) return;

    const wrap = DOC.createElement('div');
    wrap.id = 'hha-coach-toast';
    wrap.style.cssText = [
      'position:fixed',
      'left:calc(12px + env(safe-area-inset-left,0px))',
      'right:calc(12px + env(safe-area-inset-right,0px))',
      'top:calc(72px + env(safe-area-inset-top,0px))', // กันชนกับปุ่ม ENTER VR/RECENTER
      'z-index:110',
      'pointer-events:none',
      'display:flex',
      'justify-content:flex-end'
    ].join(';');

    const card = DOC.createElement('div');
    card.style.cssText = [
      'max-width:min(520px, 100%)',
      'background:rgba(2,6,23,.78)',
      'border:1px solid rgba(148,163,184,.18)',
      'border-radius:16px',
      'box-shadow:0 18px 70px rgba(0,0,0,.45)',
      'backdrop-filter:blur(10px)',
      'padding:10px 12px',
      'color:#e5e7eb',
      'font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial',
      'font-size:13px',
      'line-height:1.25',
      'opacity:0',
      'transform:translateY(-6px)',
      'transition:opacity .18s ease, transform .18s ease'
    ].join(';');

    const title = DOC.createElement('div');
    title.textContent = '🧑‍🚀 Coach';
    title.style.cssText = 'font-weight:900;letter-spacing:.2px;margin-bottom:4px;opacity:.95';

    const msg = DOC.createElement('div');
    msg.id = 'hha-coach-msg';
    msg.textContent = '—';

    card.appendChild(title);
    card.appendChild(msg);
    wrap.appendChild(card);
    DOC.body.appendChild(wrap);
  }

  function showToast(text){
    if (!DOC) return;
    mountToast();
    const wrap = gid('hha-coach-toast');
    const card = wrap?.firstElementChild;
    const msg = gid('hha-coach-msg');
    if (!wrap || !card || !msg) return;

    msg.textContent = String(text || '');
    requestAnimationFrame(()=>{
      card.style.opacity = '1';
      card.style.transform = 'translateY(0px)';
    });

    // auto-hide
    setTimeout(()=>{
      try{
        card.style.opacity = '0';
        card.style.transform = 'translateY(-6px)';
      }catch(_){}
    }, 1500);
  }

  function setWaterTip(text){
    if (!DOC) return;
    const el = gid('water-tip');
    if (!el) return;
    el.textContent = String(text || '');
  }

  function speak(key, text, level='tip'){
    if (S.ended) return false;

    const t = now();
    const tooSoon = (t - S.lastSpeakAt) < cooldownMs;

    // กันซ้ำถี่: ถ้าคีย์เดิมติดกัน ให้ทนขึ้น
    if (key === S.lastKey) S.streakSame++;
    else S.streakSame = 0;

    const extraHold = Math.min(2600, S.streakSame * 650);
    if (tooSoon || (t - S.lastSpeakAt) < (cooldownMs + extraHold)) return false;

    S.lastSpeakAt = t;
    S.lastKey = key;

    // Emit to telemetry/UI hook
    emit('hha:coach', { game, key, text, level });

    // Render (default: both)
    if (S.prefer === 'water' || S.prefer === 'both') setWaterTip(text);
    if (S.prefer === 'toast' || S.prefer === 'both') showToast(text);

    return true;
  }

  // --------- Public API ----------
  function onStart(){
    S.started = true;
    S.ended = false;
    S.lastSpeakAt = 0;
    S.lastKey = '';
    S.streakSame = 0;

    // friendly first tip (แต่ไม่สแปม)
    speak('start', '💧 ยิงน้ำให้คุมให้อยู่ GREEN ให้นาน ๆ — เก็บ 🛡️ ไว้ทำพายุ!', 'intro');
  }

  // ctx shape (from hydration.safe.js):
  // {skill, fatigue, frustration, inStorm, inEndWindow, waterZone, shield, misses, combo}
  function onUpdate(ctx = {}){
    if (!S.started || S.ended) return;

    const inStorm = !!ctx.inStorm;
    const inEnd = !!ctx.inEndWindow;
    const zone = String(ctx.waterZone || '').toUpperCase();
    const shield = Number(ctx.shield || 0);
    const miss = Number(ctx.misses || 0);
    const combo = Number(ctx.combo || 0);
    const frus = Number(ctx.frustration || 0);
    const fatigue = Number(ctx.fatigue || 0);
    const skill = Number(ctx.skill || 0);

    // --- High-priority: End Window / Boss vibe
    if (inStorm && inEnd){
      if (shield <= 0){
        speak('end_no_shield', '⏳ End Window มาแล้ว! แต่ไม่มี 🛡️ — รอบหน้าเก็บโล่ก่อนพายุ แล้วค่อย BLOCK', 'urgent');
        return;
      }
      if (zone === 'GREEN'){
        speak('end_green', '⚠️ ตอนพายุ ต้องให้น้ำ “ไม่ GREEN” (LOW/HIGH) แล้วค่อย BLOCK ช่วงท้าย', 'urgent');
        return;
      }
      speak('end_block', '✅ ช่วงท้ายพายุ! รอ 🌩️/🥤 แล้วใช้ 🛡️ BLOCK ให้ติด End Window', 'urgent');
      return;
    }

    // --- Storm guidance (non-end)
    if (inStorm){
      if (zone === 'GREEN'){
        // วิธีแฟร์: บอกให้ “หลุด GREEN” ไม่ต้องบอกให้โดน BAD
        speak('storm_leave_green', '🌀 Storm: ต้องออกจาก GREEN → ยิง 💧 ให้น้อยลง + รอจังหวะใช้ 🛡️ ช่วย', 'tip');
        return;
      }
      if (shield <= 0){
        speak('storm_get_shield', '🛡️ Storm: เหลือโล่ 0 — โฟกัสเก็บ 🛡️ ก่อน จะผ่าน Mini ง่ายมาก', 'tip');
        return;
      }
      // พอเข้าฟอร์มแล้ว
      if (combo >= 8){
        speak('storm_combo', '🔥 ทำดี! คุมโซน LOW/HIGH ได้แล้ว — เก็บคอมโบต่อ แล้วรอ End Window ค่อย BLOCK', 'praise');
        return;
      }
      // ไม่ต้องพูดทุกเฟรม
      return;
    }

    // --- Stage1 guidance (no storm)
    if (!inStorm){
      if (zone !== 'GREEN'){
        speak('stage1_back_green', '🎯 Stage1: กลับไป GREEN ให้ได้ — ยิง 💧 ต่อเนื่องแบบ “ช้าแต่ชัวร์”', 'tip');
        return;
      }
      if (combo >= 10){
        speak('stage1_combo', '⚡ เยี่ยม! GREEN + คอมโบยาว ๆ = ผ่าน Stage1 เร็วมาก', 'praise');
        return;
      }
    }

    // --- Skill/Frustration helper
    if (frus > 0.62 || miss >= 18){
      speak('calm', '🧠 อย่ารัว: เล็งค้างนิดนึงแล้วค่อยยิง — MISS จะลดฮวบ', 'tip');
      return;
    }
    if (fatigue > 0.78){
      speak('fatigue', '😮‍💨 ใกล้จบแล้ว! โฟกัสยิงเป้าที่ชัวร์ก่อน คอมโบไม่ต้องยาวก็ชนะได้', 'tip');
      return;
    }
    if (skill > 0.78 && miss <= 6){
      speak('pro', '🏆 คุณเริ่ม “นิ่ง” แล้ว — ลองลากคอมโบให้ยาวขึ้น เกรดจะพุ่ง', 'praise');
      return;
    }
  }

  function onEnd(summary){
    S.ended = true;

    // สรุปสั้น ๆ (ไม่สแปม)
    try{
      const grade = String(summary?.grade || 'C');
      const acc = Number(summary?.accuracyGoodPct || 0);
      const miss = Number(summary?.misses || 0);
      const minis = Number(summary?.stormSuccess || 0);

      let msg = `จบแล้ว! เกรด ${grade} • Accuracy ${acc.toFixed(0)}% • Miss ${miss}`;
      if (minis > 0) msg += ` • ผ่าน Mini ${minis}`;
      showToast('🎉 ' + msg);
    }catch(_){}
  }

  return { onStart, onUpdate, onEnd };
}