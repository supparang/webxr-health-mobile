// === /herohealth/vr/ai-coach.js ===
// HHA AI Coach — PRODUCTION
// ✅ Export: createAICoach({ emit, game, runMode, enabled, cooldownMs, maxPerMinute })
// ✅ Emits: hha:coach { game, type:'tip'|'summary'|'debug', text, reason, level, at, ... }
// ✅ Safe: no DOM required; optional tiny toast UI (pointer-events none)
// ✅ Default OFF in research if you pass enabled=false

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC = ROOT.document;

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

function nowMs(){ return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }

function ensureToast(){
  if (!DOC) return null;
  let el = DOC.getElementById('hha-coach-toast');
  if (el) return el;

  el = DOC.createElement('div');
  el.id = 'hha-coach-toast';
  el.style.cssText = [
    'position:fixed',
    'left:12px',
    'top:12px',
    'z-index:80',
    'max-width:360px',
    'padding:10px 12px',
    'border-radius:16px',
    'border:1px solid rgba(148,163,184,.18)',
    'background:rgba(2,6,23,.60)',
    'backdrop-filter:blur(10px)',
    'box-shadow:0 18px 70px rgba(0,0,0,.35)',
    'color:#e5e7eb',
    'font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial',
    'pointer-events:none',
    'opacity:0',
    'transform:translateY(-6px)',
    'transition:opacity .18s ease, transform .18s ease',
    'white-space:pre-line'
  ].join(';');

  DOC.body.appendChild(el);
  return el;
}

function showToast(text, ms=1400){
  const el = ensureToast();
  if (!el) return;
  el.textContent = text;
  el.style.opacity = '1';
  el.style.transform = 'translateY(0px)';
  setTimeout(()=>{
    try{
      el.style.opacity = '0';
      el.style.transform = 'translateY(-6px)';
    }catch(_){}
  }, ms);
}

export function createAICoach(opts){
  const emitFn = (opts && typeof opts.emit === 'function') ? opts.emit : null;
  const game = String((opts && opts.game) || 'game');
  const runMode = String((opts && opts.runMode) || '').toLowerCase();
  const enabled = (opts && typeof opts.enabled === 'boolean') ? opts.enabled : true;

  const cooldownMs = clamp((opts && opts.cooldownMs) || 2800, 900, 15000);
  const maxPerMinute = clamp((opts && opts.maxPerMinute) || 8, 2, 30);

  const S = {
    started:false,
    lastTipAt:0,
    tipTimes:[],
    lastState:null,
    phase:'warmup'
  };

  function canTip(){
    const t = nowMs();
    // cooldown
    if (t - S.lastTipAt < cooldownMs) return false;
    // rate limit per minute
    S.tipTimes = S.tipTimes.filter(x => (t - x) < 60000);
    if (S.tipTimes.length >= maxPerMinute) return false;
    return true;
  }

  function emitCoach(payload){
    const out = Object.assign({
      game,
      at: Date.now()
    }, payload);

    try{
      if (emitFn) emitFn('hha:coach', out);
      else ROOT.dispatchEvent?.(new CustomEvent('hha:coach', { detail: out }));
    }catch(_){}
  }

  function tip(text, reason, level='info'){
    if (!enabled) return;
    if (!canTip()) return;

    const t = nowMs();
    S.lastTipAt = t;
    S.tipTimes.push(t);

    emitCoach({ type:'tip', text, reason, level });

    // optional toast (safe)
    showToast(`🤖 Coach: ${text}\n${reason ? `• เพราะ: ${reason}` : ''}`, 1500);
  }

  function decide(state){
    // state shape expected:
    // { skill, fatigue, frustration, inStorm, inEndWindow, waterZone, shield, misses, combo }
    const st = state || {};
    const skill = clamp(st.skill ?? 0.5, 0, 1);
    const fatigue = clamp(st.fatigue ?? 0, 0, 1);
    const frustration = clamp(st.frustration ?? 0, 0, 1);

    const inStorm = !!st.inStorm;
    const inEnd = !!st.inEndWindow;
    const zone = String(st.waterZone || '');
    const shield = (st.shield|0) || 0;
    const misses = (st.misses|0) || 0;
    const combo = (st.combo|0) || 0;

    // Phase
    if (fatigue < 0.20) S.phase = 'warmup';
    else if (fatigue < 0.70) S.phase = 'mid';
    else S.phase = 'late';

    // Priority tips (small & actionable)
    if (inStorm && inEnd){
      if (shield <= 0){
        tip('ช่วงท้ายพายุแล้ว! รีบหา 🛡️ ก่อน จะกัน BAD/🌩️ ได้', 'End Window ต้อง BLOCK เพื่อผ่าน Mini', 'warn');
        return;
      }
      if (zone === 'GREEN'){
        tip('พายุมาแล้ว ลองทำให้น้ำออกจาก GREEN (LOW/HIGH) เพื่อชาร์จ pressure', 'Mini ต้อง zone≠GREEN + pressureOK + BLOCKท้าย', 'info');
        return;
      }
      tip('ถือ 🛡️ ไว้แล้ว “BLOCK ตอนท้าย” ห้ามโดน BAD', 'โดน BAD ในพายุ = Mini fail', 'warn');
      return;
    }

    if (inStorm && shield <= 0){
      tip('พายุเริ่มแล้ว — โฟกัสเก็บ 🛡️ ก่อน', 'มีโล่แล้วผ่าน Mini ง่ายขึ้นมาก', 'info');
      return;
    }

    if (!inStorm && combo === 0 && frustration > 0.55){
      tip('ลอง “ยิงช้าลงแต่ชัวร์” ก่อน แล้วค่อยเร่งคอมโบ', 'ลด MISS จะทำให้เกมง่ายขึ้นทันที', 'info');
      return;
    }

    if (!inStorm && zone !== 'GREEN'){
      tip('พยายามคุม Water ให้กลับเข้า GREEN (45–65%)', 'อยู่ GREEN จะเก็บคะแนน/คอมโบเสถียรกว่า', 'info');
      return;
    }

    if (combo >= 10 && skill > 0.65){
      tip('ดีมาก! ลากคอมโบต่อไป เน้นยิง 💧 ต่อเนื่อง', 'คอมโบยาว = คะแนนพุ่ง + เกรดสูง', 'info');
      return;
    }

    if (misses >= 18 && frustration > 0.65){
      tip('ถ้ารู้สึกยาก: เลือกยิงเฉพาะเป้าใกล้กลางจอ และหยุดรัว', 'ลดความเสี่ยง MISS/โดน BAD', 'warn');
      return;
    }

    // light proactive hint
    if (S.phase === 'late' && !inStorm){
      tip('ช่วงท้ายจะมีพายุแรงขึ้น — เตรียม 🛡️ ไว้ 1–2 อัน', 'Boss/End Window ต้องใช้โล่', 'info');
      return;
    }
  }

  return {
    onStart(){
      S.started = true;
      S.lastTipAt = 0;
      S.tipTimes = [];
      S.lastState = null;
      emitCoach({ type:'debug', text:'AI Coach start' });
      if (enabled) showToast('🤖 Coach พร้อมแล้ว!', 900);
    },
    onUpdate(state){
      if (!enabled || !S.started) return;
      // throttle decisions a little (but still responsive)
      const last = S.lastState;
      S.lastState = state;

      // Avoid spamming when state barely changes
      if (last){
        const keySame =
          (!!last.inStorm === !!state.inStorm) &&
          (!!last.inEndWindow === !!state.inEndWindow) &&
          (String(last.waterZone) === String(state.waterZone)) &&
          ((last.shield|0) === (state.shield|0)) &&
          ((last.combo|0) === (state.combo|0));
        if (keySame && !canTip()) return;
      }

      decide(state);
    },
    onEnd(summary){
      emitCoach({ type:'summary', text:'จบเกมแล้ว', summary });
      if (enabled){
        const g = String(summary?.grade || 'C');
        showToast(`🤖 Coach: จบแล้ว! เกรด ${g}\nลองดู Tips ในสรุปผลได้เลย`, 1300);
      }
    }
  };
}