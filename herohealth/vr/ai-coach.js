// === /herohealth/vr/ai-coach.js ===
// HHA AI Coach — PRODUCTION (Explainable + Rate-limited)
// ✅ createAICoach({ emit, game, cooldownMs })
// ✅ Safe: never throws (best-effort DOM + event)
// ✅ Explainable micro-tips: short, actionable
// ✅ Rate-limit + de-dup + urgency override (storm/endWindow)
// ✅ Works across PC/Mobile/cVR/Cardboard
//
// Emits (optional):
// - hha:coach { game, level, code, message, why, action, ts }
//
// Optional DOM targets (if present):
// - #aiCoachToast  (container)
// - #aiCoachText   (message)
// - #aiCoachWhy    (why/explain)
// - #aiCoachAction (action)
//
// If not present, it just emits events.

'use strict';

export function createAICoach(opts = {}) {
  const WIN = (typeof window !== 'undefined') ? window : globalThis;
  const DOC = WIN.document;

  const emit = typeof opts.emit === 'function'
    ? opts.emit
    : (name, detail) => { try { WIN.dispatchEvent(new CustomEvent(name, { detail })); } catch(_){} };

  const game = String(opts.game || 'game').toLowerCase();
  const cooldownMs = clampNum(opts.cooldownMs, 3000, 120000, 3500);

  // --- state ---
  const S = {
    started: false,
    ended: false,
    lastTipAt: 0,
    lastKey: '',
    shown: Object.create(null),

    // mild learning: keep a small rolling "skill impression"
    emaSkill: 0.45,
    emaFrustration: 0.25,

    // toast refs
    toastEl: null,
    textEl: null,
    whyEl: null,
    actionEl: null,
    hideTimer: null,
    mounted: false
  };

  function clampNum(v, a, b, d){
    v = Number(v);
    if (!Number.isFinite(v)) v = d;
    return Math.max(a, Math.min(b, v));
  }

  function nowMs(){ try{ return Date.now(); }catch(_){ return 0; } }

  function qs(id){
    try{ return DOC && DOC.getElementById(id); }catch(_){ return null; }
  }

  function clearTimeoutSafe(){
    try{ if (S.hideTimer) clearTimeout(S.hideTimer); }catch(_){}
    S.hideTimer = null;
  }

  function ensureToast(){
    if (!DOC || S.mounted) return;
    S.mounted = true;

    // If host page provides its own toast nodes, use them
    const host = qs('aiCoachToast');
    const t = qs('aiCoachText');
    const w = qs('aiCoachWhy');
    const a = qs('aiCoachAction');

    if (host && t) {
      S.toastEl = host; S.textEl = t; S.whyEl = w; S.actionEl = a;
      return;
    }

    // Otherwise: mount a minimal toast (safe-area aware)
    try{
      const wrap = DOC.createElement('div');
      wrap.id = 'aiCoachToast';
      wrap.style.cssText = [
        'position:fixed',
        'left:calc(12px + env(safe-area-inset-left,0px))',
        'right:calc(12px + env(safe-area-inset-right,0px))',
        'top:calc(12px + env(safe-area-inset-top,0px))',
        'z-index:92',
        'pointer-events:none',
        'display:none'
      ].join(';');

      const card = DOC.createElement('div');
      card.style.cssText = [
        'margin:0 auto',
        'max-width:720px',
        'border-radius:18px',
        'border:1px solid rgba(148,163,184,.18)',
        'background:rgba(2,6,23,.70)',
        'backdrop-filter:blur(10px)',
        'box-shadow:0 18px 70px rgba(0,0,0,.35)',
        'padding:10px 12px',
        'color:rgba(229,231,235,.95)',
        'font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial'
      ].join(';');

      const title = DOC.createElement('div');
      title.textContent = '🤖 Coach Tip';
      title.style.cssText = 'font-weight:900;font-size:12px;opacity:.92;letter-spacing:.2px;margin-bottom:6px';

      const msg = DOC.createElement('div');
      msg.id = 'aiCoachText';
      msg.style.cssText = 'font-weight:900;font-size:14px;line-height:1.25';

      const why = DOC.createElement('div');
      why.id = 'aiCoachWhy';
      why.style.cssText = 'margin-top:6px;font-size:12px;opacity:.86;white-space:pre-line';

      const act = DOC.createElement('div');
      act.id = 'aiCoachAction';
      act.style.cssText = 'margin-top:6px;font-size:12px;font-weight:900;opacity:.92';

      card.appendChild(title);
      card.appendChild(msg);
      card.appendChild(why);
      card.appendChild(act);
      wrap.appendChild(card);
      DOC.body.appendChild(wrap);

      S.toastEl = wrap;
      S.textEl = msg;
      S.whyEl = why;
      S.actionEl = act;
    }catch(_){}
  }

  function showToast(message, why, action, ms=2500){
    ensureToast();
    if (!S.toastEl || !S.textEl) return;

    try{
      clearTimeoutSafe();
      S.textEl.textContent = String(message || '');
      if (S.whyEl) S.whyEl.textContent = String(why || '');
      if (S.actionEl) S.actionEl.textContent = action ? ('ทำเลย: ' + String(action)) : '';

      S.toastEl.style.display = 'block';
      S.hideTimer = setTimeout(()=>{
        try{ if (S.toastEl) S.toastEl.style.display = 'none'; }catch(_){}
      }, clampNum(ms, 900, 7000, 2600));
    }catch(_){}
  }

  function dedupKey(key){
    return String(key || '').slice(0, 120);
  }

  function canSpeak(key, urgent=false){
    const t = nowMs();

    // urgent: override cooldown (but still avoid repeating exact same key too frequently)
    if (urgent){
      if (S.lastKey === key && (t - S.lastTipAt) < 900) return false;
      return true;
    }

    if ((t - S.lastTipAt) < cooldownMs) return false;
    if (S.shown[key]) return false;
    return true;
  }

  function speak(payload, urgent=false){
    const key = dedupKey(payload.code || payload.key || payload.message);
    if (!key) return;
    if (!canSpeak(key, urgent)) return;

    const t = nowMs();
    S.lastTipAt = t;
    S.lastKey = key;
    S.shown[key] = 1;

    const detail = {
      game,
      level: payload.level || 'info',
      code: key,
      message: payload.message || '',
      why: payload.why || '',
      action: payload.action || '',
      ts: t
    };

    emit('hha:coach', detail);
    showToast(detail.message, detail.why, detail.action, urgent ? 3200 : 2500);
  }

  // ----------------- tip logic (explainable rules) -----------------
  function onStart(){
    S.started = true;
    S.ended = false;
    S.lastTipAt = 0;
    S.lastKey = '';
    S.shown = Object.create(null);

    speak({
      level:'info',
      code:'start',
      message: game === 'hydration'
        ? 'เริ่มแล้ว! ยิง 💧 เพื่อคุม “โซน GREEN” และเก็บ 🛡️ ไว้ทำ Storm Mini'
        : 'เริ่มแล้ว! โฟกัสความแม่น + คอมโบ',
      why: 'เริ่มด้วยเป้าหมายง่าย ๆ ก่อน แล้วค่อยทำมินิเควส',
      action: 'เล็งนิ่ง 0.3–0.5 วิ แล้วค่อยยิง'
    }, true);
  }

  function onEnd(summary){
    S.ended = true;

    const grade = String(summary?.grade || '').toUpperCase();
    const acc = Number(summary?.accuracyGoodPct || 0);
    const miss = Number(summary?.misses || 0);

    let msg = grade ? `จบเกมแล้ว — เกรด ${grade}` : 'จบเกมแล้ว!';
    let why = `Accuracy ${acc.toFixed(1)}% • Miss ${miss|0}`;
    let action = 'ลองอีกรอบ: ลดการรัว + เลือกยิงเป้าที่ชัวร์';

    if (acc < 60) action = 'โฟกัส “ยิงให้โดน” ก่อนคอมโบ (ช้าลงนิดนึง)';
    else if (acc >= 80 && miss <= 10) action = 'เยี่ยม! รอบหน้าไปล่าคอมโบยาว ๆ';

    speak({ level:'end', code:'end', message: msg, why, action }, true);
  }

  function onUpdate(m = {}){
    if (!S.started || S.ended) return;

    // Normalize inputs
    const skill = clampNum(m.skill, 0, 1, 0.45);
    const fatigue = clampNum(m.fatigue, 0, 1, 0.0);
    const frustration = clampNum(m.frustration, 0, 1, 0.25);
    const inStorm = !!m.inStorm;
    const inEndWindow = !!m.inEndWindow;
    const waterZone = String(m.waterZone || '').toUpperCase();
    const shield = (Number(m.shield)||0)|0;
    const misses = (Number(m.misses)||0)|0;
    const combo = (Number(m.combo)||0)|0;

    // Small smoothing
    S.emaSkill = S.emaSkill*0.88 + skill*0.12;
    S.emaFrustration = S.emaFrustration*0.90 + frustration*0.10;

    // ---- Urgent storm end-window coaching
    if (game === 'hydration' && inStorm && inEndWindow){
      if (shield <= 0){
        speak({
          level:'urgent',
          code:'storm_end_no_shield',
          message:'⚠️ End Window มาแล้ว แต่ไม่มี 🛡️!',
          why:'Storm Mini ต้อง “BLOCK ช่วงท้าย” ถ้าไม่มีโล่จะกันไม่ได้',
          action:'รอบหน้าเก็บ 🛡️ ก่อนพายุ 1–2 อัน'
        }, true);
      } else {
        speak({
          level:'urgent',
          code:'storm_end_block_now',
          message:'⏳ End Window! ใช้ 🛡️ BLOCK เป้า BAD/⚡ ตอนนี้',
          why:'ผ่าน Mini ต้อง zone OK + pressure OK + end window + block สำเร็จ',
          action:'เล็ง BAD/⚡ แล้ว “ยิง 1–2 ครั้งแบบชัวร์”'
        }, true);
      }
      return;
    }

    // ---- Hydration zone guidance
    if (game === 'hydration'){
      if (!inStorm && waterZone && waterZone !== 'GREEN'){
        speak({
          level:'hint',
          code:'zone_back_to_green',
          message:`ตอนนี้โซน ${waterZone} — ดันกลับ GREEN`,
          why:'Stage 1 ต้องสะสมเวลาอยู่ GREEN ให้ครบตามเป้า',
          action:'เลือกยิง 💧 ต่อเนื่อง 2–4 เป้า'
        });
      }

      if (!inStorm && waterZone === 'GREEN' && combo >= 10){
        speak({
          level:'praise',
          code:'green_combo_keep',
          message:'ดีมาก! GREEN + คอมโบกำลังสวย 🔥',
          why:'ความนิ่งทำให้ Accuracy สูงและผ่าน Stage 1 เร็ว',
          action:'อย่ารัว—คุมจังหวะยิงให้คงที่'
        });
      }

      if (!inStorm && shield === 0 && fatigue < 0.75){
        speak({
          level:'hint',
          code:'get_shield',
          message:'เก็บ 🛡️ ไว้ทำ Storm Mini นะ',
          why:'Mini ต้อง BLOCK ช่วงท้ายพายุ ถ้าไม่มีโล่จะยากมาก',
          action:'เห็น 🛡️ ให้ยิงก่อน 1 อัน'
        });
      }
    }

    // ---- Accuracy / frustration coaching (universal)
    if (S.emaSkill < 0.45 && misses >= 8){
      speak({
        level:'tip',
        code:'slow_down_accuracy',
        message:'ลดการรัว แล้ว “ล็อกเป้า” ก่อนยิง',
        why:'Miss เยอะทำให้คอมโบตกและคะแนนไม่โต',
        action:'เล็งนิ่ง 0.3–0.5 วิ แล้วยิงทีละนัด'
      });
    }

    if (S.emaFrustration > 0.62 && fatigue < 0.85){
      speak({
        level:'tip',
        code:'reset_breath',
        message:'พัก 2 วิ แล้วเริ่มใหม่แบบนิ่ง ๆ',
        why:'ความรีบทำให้หลุดเป้าง่าย โดยเฉพาะบนมือถือ/cVR',
        action:'โฟกัสเป้ากลางจอ แล้วค่อยยิง'
      });
    }

    if (S.emaSkill > 0.78 && combo >= 14 && misses < 8){
      speak({
        level:'praise',
        code:'push_combo',
        message:'โห ดุเดือด! ลากคอมโบให้ยาวกว่าเดิม',
        why:'ตอนนี้นิ่งมาก—คอมโบยาว = เกรดพุ่ง',
        action:'เลือกยิงเป้าใกล้กัน ลดการส่ายกล้อง'
      });
    }
  }

  // external stage hook (optional)
  function onStage(stage){
    const s = (Number(stage)||0)|0;

    if (s === 2){
      speak({
        level:'info',
        code:'stage2_mini',
        message:'เข้าสู่ Stage 2: เป้าคือผ่าน Storm Mini อย่างน้อย 1 ครั้ง',
        why:'ต้องทำ LOW/HIGH + pressure + End Window + BLOCK (ห้ามโดน BAD)',
        action:'เก็บ 🛡️ แล้วรอพายุ'
      }, true);
    }

    if (s === 3){
      speak({
        level:'info',
        code:'stage3_boss',
        message:'เข้าสู่ Stage 3: เตรียมเคลียร์ BOSS ⚡',
        why:'ช่วงท้ายพายุจะเป็น Boss Window — ต้อง BLOCK ให้ครบ',
        action:'เก็บ 🛡️ ไว้ แล้วค่อยยิงตอน Boss Window'
      }, true);
    }
  }

  return {
    onStart,
    onUpdate,
    onEnd,
    onStage,
    speak: (payload, urgent=false) => speak(payload || {}, !!urgent)
  };
}