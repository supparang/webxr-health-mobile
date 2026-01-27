// === /herohealth/vr/ai-coach.js ===
// AI Coach — PRODUCTION (explainable micro-tips + rate-limit + safe UI)
// ✅ Exports: createAICoach
// ✅ Silent in research mode by default (deterministic-friendly)
// ✅ Shows small toast overlay (non-blocking) + emits hha:coach
//
// Usage:
//   import { createAICoach } from '../vr/ai-coach.js';
//   const AICOACH = createAICoach({ emit, game:'hydration', cooldownMs:3000 });
//   AICOACH.onStart(); AICOACH.onUpdate(ctx); AICOACH.onEnd(summary);

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function nowMs(){ return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }

// -------------------- UI (toast) --------------------
function ensureCoachUI(){
  if (!DOC || DOC.getElementById('hha-coach-toast')) return;

  const style = DOC.createElement('style');
  style.id = 'hha-coach-style';
  style.textContent = `
  #hha-coach-toast{
    position:fixed;
    left:50%;
    bottom: calc(14px + env(safe-area-inset-bottom, 0px));
    transform: translateX(-50%);
    z-index: 80;
    pointer-events:none;
    width:min(92vw, 560px);
    display:flex;
    justify-content:center;
    align-items:flex-end;
    gap:10px;
  }
  .hha-coach-bubble{
    pointer-events:none;
    width:100%;
    border-radius: 18px;
    border: 1px solid rgba(148,163,184,.18);
    background: rgba(2,6,23,.68);
    color: #e5e7eb;
    backdrop-filter: blur(10px);
    box-shadow: 0 18px 70px rgba(0,0,0,.35);
    padding: 10px 12px;
    display:flex;
    gap:10px;
    align-items:flex-start;
    opacity:0;
    transform: translateY(8px);
    transition: opacity .18s ease, transform .18s ease;
  }
  .hha-coach-bubble.show{ opacity:1; transform: translateY(0); }
  .hha-coach-ico{
    flex:0 0 auto;
    width:34px;height:34px;
    border-radius: 999px;
    display:flex;align-items:center;justify-content:center;
    background: rgba(148,163,184,.12);
    border:1px solid rgba(148,163,184,.14);
    font-size:18px;
  }
  .hha-coach-txt{ font-size:14px; line-height:1.35; }
  .hha-coach-sub{ font-size:12px; opacity:.85; margin-top:2px; white-space:pre-wrap; }
  `;
  DOC.head.appendChild(style);

  const wrap = DOC.createElement('div');
  wrap.id = 'hha-coach-toast';
  wrap.innerHTML = `
    <div class="hha-coach-bubble" id="hhaCoachBubble" aria-live="polite">
      <div class="hha-coach-ico" id="hhaCoachIco">🧑‍🏫</div>
      <div class="hha-coach-txt">
        <div id="hhaCoachText">พร้อมลุย!</div>
        <div class="hha-coach-sub" id="hhaCoachSub"></div>
      </div>
    </div>
  `;
  DOC.body.appendChild(wrap);
}

function showToast(icon, text, sub='', ttlMs=2200){
  if (!DOC) return;
  ensureCoachUI();
  const bubble = DOC.getElementById('hhaCoachBubble');
  const ico = DOC.getElementById('hhaCoachIco');
  const t = DOC.getElementById('hhaCoachText');
  const s = DOC.getElementById('hhaCoachSub');
  if (!bubble || !t) return;

  if (ico) ico.textContent = icon || '🧑‍🏫';
  t.textContent = String(text || '');
  if (s) s.textContent = String(sub || '');

  bubble.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=>{
    try{ bubble.classList.remove('show'); }catch(_){}
  }, clamp(ttlMs, 900, 6000));
}

// -------------------- Coach core --------------------
export function createAICoach(cfg={}){
  const emit = (typeof cfg.emit === 'function')
    ? cfg.emit
    : (name, detail)=>{ try{ ROOT.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){ } };

  const game = String(cfg.game || 'game');
  const cooldownMs = clamp(cfg.cooldownMs ?? 3000, 1200, 10000);

  // ✅ research mode = silent by default
  const run = String(qs('run', qs('runMode','play'))).toLowerCase();
  const silentByParam = String(qs('coach', '1')) === '0';
  const silent = silentByParam || (run === 'research');

  const state = {
    started:false,
    lastSayAt:0,
    lastKey:'',
    lastStormState:false
  };

  function say(key, icon, text, sub='', ttlMs=2200){
    if (silent) return false;

    const t = nowMs();
    if (t - state.lastSayAt < cooldownMs) return false;
    if (key && key === state.lastKey && t - state.lastSayAt < cooldownMs*1.6) return false;

    state.lastSayAt = t;
    state.lastKey = key || '';

    emit('hha:coach', { game, key, icon, text, sub, ttlMs });
    showToast(icon, text, sub, ttlMs);
    return true;
  }

  function onStart(){
    state.started = true;
    state.lastStormState = false;
    say('start', '💧', 'เริ่มเลย! ยิง 💧 เพื่อคุมน้ำให้อยู่ GREEN', 'ทิป: อย่ารัว—เล็งนิดนึงแล้วค่อยยิง', 2400);
  }

  // ctx from hydration.safe.js:
  // { skill, fatigue, frustration, inStorm, inEndWindow, waterZone, shield, misses, combo }
  function onUpdate(ctx={}){
    if (!state.started) return;

    const waterZone = String(ctx.waterZone || '').toUpperCase();
    const inStorm = !!ctx.inStorm;
    const inEnd = !!ctx.inEndWindow;
    const shield = ctx.shield|0;
    const misses = ctx.misses|0;
    const combo = ctx.combo|0;

    const skill = clamp(ctx.skill ?? 0.5, 0, 1);
    const frustration = clamp(ctx.frustration ?? 0.0, 0, 1);
    const fatigue = clamp(ctx.fatigue ?? 0.0, 0, 1);

    // --- storm enter/exit cues (only on edges) ---
    if (inStorm && !state.lastStormState){
      state.lastStormState = true;
      say('storm_enter', '🌀', 'พายุมาแล้ว!', 'ต้องทำ LOW/HIGH + ห้ามโดน BAD แล้วค่อย BLOCK ช่วงท้าย', 2400);
      return;
    }
    if (!inStorm && state.lastStormState){
      state.lastStormState = false;
      if (frustration >= 0.55){
        say('storm_exit', '✅', 'พักหายใจนิดนึง แล้วเก็บคอมโบต่อ', 'โฟกัสยิง 💧 เป้าชัวร์ ๆ', 2100);
        return;
      }
    }

    // --- end window cue (high priority) ---
    if (inStorm && inEnd){
      if (shield <= 0){
        say('end_no_shield', '⚠️', 'ช่วงท้ายแล้ว แต่ไม่มีโล่!', 'รีบเก็บ 🛡️ แล้วค่อย BLOCK ไม่งั้น MINI ผ่านยาก', 2300);
      } else {
        say('end_have_shield', '🛡️', 'ช่วงท้ายพายุ! พร้อม BLOCK', `โล่ที่มี: ${shield} — อย่ายิง BAD ถ้าไม่มีโล่`, 2200);
      }
      return;
    }

    // --- water zone guidance ---
    if (!inStorm){
      if (waterZone === 'LOW'){
        say('zone_low', '🥶', 'น้ำ LOW! ยิง 💧 เพิ่มเพื่อดันกลับเข้า GREEN', 'อย่าเผลอยิง BAD เดี๋ยวแกว่งหนัก', 2200);
        return;
      }
      if (waterZone === 'HIGH'){
        say('zone_high', '🔥', 'น้ำ HIGH! คุมให้กลับเข้า GREEN', 'เล็งให้ชัวร์—คอมโบช่วยให้คุมง่ายขึ้น', 2200);
        return;
      }
    } else {
      if (waterZone === 'GREEN'){
        say('storm_need_out', '🎯', 'ในพายุ ต้องหลุด GREEN ก่อน!', 'ทำให้น้ำเป็น LOW หรือ HIGH แล้วค่อยเก็บแต้ม MINI', 2200);
        return;
      }
    }

    // --- performance coaching ---
    if (misses >= 20 && frustration >= 0.55){
      say('many_miss', '💥', 'MISS เยอะไปนิด ลองช้าลง', 'เล็งค้าง 0.2–0.4 วิ แล้วค่อยยิง จะนิ่งขึ้นมาก', 2300);
      return;
    }
    if (combo >= 12 && skill >= 0.65){
      say('combo_good', '⚡', 'คอมโบสวยมาก! ลากต่อเลย', 'คอมโบยาว ๆ = เกรดพุ่ง + คุมเกมง่ายขึ้น', 2000);
      return;
    }
    if (fatigue >= 0.75){
      say('fatigue', '🧊', 'ใกล้จบแล้ว! เก็บแต้มแบบปลอดภัย', 'เลือกยิงเป้าชัวร์ ๆ ไม่ต้องเสี่ยง', 2000);
      return;
    }
  }

  function onEnd(summary={}){
    if (silent) return;
    const grade = String(summary.grade || '').toUpperCase();
    const acc = Number(summary.accuracyGoodPct || 0);
    const miss = Number(summary.misses || 0);
    const stage = summary.stageCleared|0;

    let icon='🏁', text='จบเกมแล้ว!', sub='';
    if (grade === 'SSS' || grade === 'SS'){
      icon='🏆'; text=`โหดมาก! เกรด ${grade}`; sub=`Accuracy ${acc.toFixed(1)}% • MISS ${miss}`;
    } else if (grade === 'S' || grade === 'A'){
      icon='✨'; text=`เยี่ยม! เกรด ${grade}`; sub=`อีกนิดจะขึ้น SS — ลด MISS และลากคอมโบ`;
    } else {
      icon='💪'; text=`สู้ต่อได้! เกรด ${grade || 'C'}`; sub=`ทิป: ช้าลงนิด + เล็งก่อนยิง จะผ่าน Stage ได้ง่ายขึ้น`;
    }

    if (stage <= 1) sub += `\nเป้าหมายถัดไป: ผ่าน Stage 2 (Storm Mini)`;
    else if (stage === 2) sub += `\nเป้าหมายถัดไป: เคลียร์ Boss (Stage 3)`;
    else sub += `\nเป้าหมายถัดไป: ลากคอมโบให้ยาวขึ้น!`;

    showToast(icon, text, sub, 3600);
    emit('hha:coach', { game, key:'end', icon, text, sub, ttlMs:3600 });
  }

  return { onStart, onUpdate, onEnd };
}