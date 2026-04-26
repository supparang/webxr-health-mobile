// === /herohealth/hydration-vr/hydration-coach-ui.js ===
// Hydration Coach UI — v20260426-COACH-UI
// ✅ non-blocking AI coach overlay
// ✅ listens to hha:coach event
// ✅ can be called directly via showHydrationCoachTip()
// ✅ mobile / PC / cVR / Cardboard safe
// ✅ no dependency

'use strict';

const WIN = window;
const DOC = document;

let mounted = false;
let hideTimer = null;
let lastShownAt = 0;

function safeText(v){
  return String(v == null ? '' : v).replace(/[<>&]/g, m => ({
    '<':'&lt;',
    '>':'&gt;',
    '&':'&amp;'
  }[m]));
}

function ensureStyle(){
  if (DOC.getElementById('hha-hydration-coach-style')) return;

  const st = DOC.createElement('style');
  st.id = 'hha-hydration-coach-style';
  st.textContent = `
#hha-hydration-coach{
  position:fixed;
  right:calc(12px + env(safe-area-inset-right, 0px));
  top:50%;
  transform:translateY(-50%);
  z-index:72;
  width:min(340px, calc(100vw - 24px));
  pointer-events:none;
  font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;
  color:rgba(229,231,235,.95);
  opacity:0;
  translate: 14px 0;
  transition:opacity .22s ease, translate .22s ease, transform .22s ease;
  filter:drop-shadow(0 18px 42px rgba(0,0,0,.45));
}

#hha-hydration-coach.show{
  opacity:1;
  translate:0 0;
}

#hha-hydration-coach .coachCard{
  border-radius:18px;
  border:1px solid rgba(34,211,238,.20);
  background:rgba(2,6,23,.68);
  backdrop-filter:blur(12px);
  padding:12px 13px;
}

#hha-hydration-coach .coachTop{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  margin-bottom:7px;
}

#hha-hydration-coach .coachName{
  font-size:12px;
  font-weight:900;
  letter-spacing:.2px;
  display:flex;
  align-items:center;
  gap:7px;
}

#hha-hydration-coach .coachTag{
  font-size:10px;
  font-weight:900;
  padding:4px 8px;
  border-radius:999px;
  border:1px solid rgba(148,163,184,.16);
  background:rgba(15,23,42,.55);
  color:rgba(229,231,235,.85);
}

#hha-hydration-coach .coachText{
  font-size:13px;
  line-height:1.28;
  font-weight:800;
  color:rgba(248,250,252,.96);
}

#hha-hydration-coach .coachReason{
  margin-top:7px;
  font-size:11px;
  line-height:1.25;
  color:rgba(203,213,225,.86);
}

/* type colors */
#hha-hydration-coach.type-risk_low .coachCard{
  border-color:rgba(245,158,11,.24);
}
#hha-hydration-coach.type-risk_high .coachCard{
  border-color:rgba(239,68,68,.24);
}
#hha-hydration-coach.type-frustration .coachCard{
  border-color:rgba(168,85,247,.28);
}
#hha-hydration-coach.type-challenge_up .coachCard{
  border-color:rgba(34,197,94,.28);
}

/* mobile: move lower but above buttons/gauge */
body.view-mobile #hha-hydration-coach{
  top:auto;
  right:calc(10px + env(safe-area-inset-right, 0px));
  bottom:calc(112px + env(safe-area-inset-bottom, 0px));
  transform:none;
  width:min(330px, calc(100vw - 20px));
}

/* cVR/cardboard: center and compact */
body.view-cvr #hha-hydration-coach,
body.cardboard #hha-hydration-coach{
  left:50%;
  right:auto;
  top:auto;
  bottom:calc(118px + env(safe-area-inset-bottom, 0px));
  transform:translateX(-50%);
  width:min(320px, calc(100vw - 24px));
}

body.cardboard #hha-hydration-coach .coachReason,
body.view-cvr #hha-hydration-coach .coachReason{
  display:none;
}

@media (max-height:560px){
  #hha-hydration-coach{
    top:auto;
    right:calc(10px + env(safe-area-inset-right, 0px));
    bottom:calc(92px + env(safe-area-inset-bottom, 0px));
    transform:none;
  }
  #hha-hydration-coach .coachCard{
    padding:9px 10px;
    border-radius:15px;
  }
  #hha-hydration-coach .coachReason{
    display:none;
  }
  #hha-hydration-coach .coachText{
    font-size:12px;
  }
}
`;
  DOC.head.appendChild(st);
}

export function ensureHydrationCoachUI(){
  if (mounted && DOC.getElementById('hha-hydration-coach')) return;

  ensureStyle();

  let root = DOC.getElementById('hha-hydration-coach');
  if (!root){
    root = DOC.createElement('div');
    root.id = 'hha-hydration-coach';
    root.innerHTML = `
      <div class="coachCard" role="status" aria-live="polite">
        <div class="coachTop">
          <div class="coachName">🤖 AI Coach</div>
          <div class="coachTag" id="hha-coach-tag">TIP</div>
        </div>
        <div class="coachText" id="hha-coach-text">พร้อมช่วยคุมสมดุลน้ำ</div>
        <div class="coachReason" id="hha-coach-reason">AI จะเตือนเมื่อเห็นความเสี่ยงระหว่างเล่น</div>
      </div>
    `;
    DOC.body.appendChild(root);
  }

  mounted = true;
}

function labelForType(type){
  if (type === 'risk_low') return 'LOW RISK';
  if (type === 'risk_high') return 'HIGH RISK';
  if (type === 'frustration') return 'HELP';
  if (type === 'challenge_up') return 'CHALLENGE';
  return 'TIP';
}

export function showHydrationCoachTip(tip, options = {}){
  try{
    ensureHydrationCoachUI();

    const now = performance.now();
    const minGap = Number(options.minGapMs || 1600);
    if (now - lastShownAt < minGap) return false;
    lastShownAt = now;

    const root = DOC.getElementById('hha-hydration-coach');
    const tag = DOC.getElementById('hha-coach-tag');
    const text = DOC.getElementById('hha-coach-text');
    const reason = DOC.getElementById('hha-coach-reason');

    if (!root || !text) return false;

    const type = String(tip?.type || 'tip');
    const msg = String(tip?.text || 'คุมสมดุลน้ำให้อยู่ใน GREEN');
    const why = String(tip?.reason || '');

    root.classList.remove('type-risk_low','type-risk_high','type-frustration','type-challenge_up');
    root.classList.add(`type-${type}`);

    if (tag) tag.textContent = labelForType(type);
    text.innerHTML = safeText(msg);
    if (reason) reason.innerHTML = why ? safeText(why) : 'AI วิเคราะห์จาก accuracy, miss, water zone และจังหวะ storm';

    root.classList.add('show');

    clearTimeout(hideTimer);
    hideTimer = setTimeout(()=>{
      try{ root.classList.remove('show'); }catch(_){}
    }, Number(options.durationMs || 4200));

    return true;
  }catch(_){
    return false;
  }
}

export function hideHydrationCoachTip(){
  try{
    const root = DOC.getElementById('hha-hydration-coach');
    if (root) root.classList.remove('show');
    clearTimeout(hideTimer);
  }catch(_){}
}

/* Auto listen to hha:coach */
try{
  WIN.addEventListener('hha:coach', (ev)=>{
    const detail = ev && ev.detail ? ev.detail : null;
    if (!detail) return;
    showHydrationCoachTip(detail);
  });
}catch(_){}

/* Debug hook */
try{
  WIN.HHA_HYDRATION_COACH_UI = {
    ensureHydrationCoachUI,
    showHydrationCoachTip,
    hideHydrationCoachTip
  };
}catch(_){}