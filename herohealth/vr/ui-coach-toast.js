// === /herohealth/vr/ui-coach-toast.js ===
// Coach Toast UI — PRODUCTION
// ✅ Listens: window 'hha:coach' { type,key,text,why,stage,urgent,priority,ts }
// ✅ Non-blocking (pointer-events:none)
// ✅ Rate-limit UI + collapse duplicates
// ✅ Safe-area aware (uses CSS vars already set in page)
// ✅ Works all views (pc/mobile/cardboard/cvr)

'use strict';

(function(){
  const WIN = window;
  const DOC = document;
  if (!DOC || WIN.__HHA_COACH_TOAST_LOADED__) return;
  WIN.__HHA_COACH_TOAST_LOADED__ = true;

  const CFG = Object.assign({
    maxStack: 2,         // show up to 2 toasts
    baseMs: 4200,        // default duration
    urgentMs: 5600,      // urgent duration
    minGapMs: 850,       // minimal gap between toasts
    dedupeMs: 3500,      // if same key repeats within this -> ignore
    hideWhyByDefault: false,
    // 위치: top-center by default
    anchor: 'top',       // 'top' | 'bottom'
  }, WIN.HHA_COACH_TOAST_CONFIG || {});

  const STATE = {
    lastAt: 0,
    lastKey: '',
    seen: new Map(), // key -> t
    stack: [],
  };

  // ---------- mount ----------
  function mount(){
    if (DOC.getElementById('hhaCoachToastRoot')) return;

    const root = DOC.createElement('div');
    root.id = 'hhaCoachToastRoot';
    root.setAttribute('aria-live','polite');
    root.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:110;pointer-events:none;';
    DOC.body.appendChild(root);

    const style = DOC.createElement('style');
    style.id = 'hhaCoachToastStyle';
    style.textContent = `
      .hha-coach-wrap{
        position:fixed;
        left:0; right:0;
        ${CFG.anchor === 'bottom' ? 'bottom:0;' : 'top:0;'}
        z-index:110;
        pointer-events:none;
        display:flex;
        justify-content:center;
        padding:
          calc(10px + var(--sat)) calc(12px + var(--sar))
          calc(10px + var(--sab)) calc(12px + var(--sal));
      }

      .hha-coach-stack{
        width:min(920px, 100%);
        display:flex;
        flex-direction:column;
        gap:10px;
        pointer-events:none;
        align-items:stretch;
      }

      .hha-coach-toast{
        pointer-events:none;
        border-radius:18px;
        border:1px solid rgba(148,163,184,.18);
        background: rgba(2,6,23,.72);
        backdrop-filter: blur(10px);
        box-shadow: 0 22px 80px rgba(0,0,0,.55);
        padding:12px 12px;
        display:flex;
        gap:12px;
        align-items:flex-start;
        transform: translate3d(0,-6px,0);
        opacity:0;
        animation: hhaCoachIn 220ms ease-out forwards;
      }

      body.cardboard .hha-coach-wrap{
        /* Cardboard: ลดความสูง/ย้ายขึ้นให้ชิดบน */
        padding-top: calc(6px + var(--sat));
      }

      body.view-cvr .hha-coach-wrap{
        /* cVR: กันชน crosshair กลางจอ -> อยู่บนสุดเสมอ */
        padding-top: calc(8px + var(--sat));
      }

      @keyframes hhaCoachIn{
        to{ transform: translate3d(0,0,0); opacity:1; }
      }

      .hha-coach-toast.out{
        animation: hhaCoachOut 180ms ease-in forwards;
      }
      @keyframes hhaCoachOut{
        to{ transform: translate3d(0,-8px,0); opacity:0; }
      }

      .hha-coach-badge{
        width:40px; height:40px;
        border-radius:14px;
        display:flex; align-items:center; justify-content:center;
        border:1px solid rgba(148,163,184,.14);
        background: rgba(15,23,42,.62);
        font-size:20px;
        flex:0 0 auto;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,.02);
      }

      .hha-coach-main{ flex:1; min-width:0; }

      .hha-coach-top{
        display:flex;
        justify-content:space-between;
        gap:10px;
        align-items:flex-start;
      }

      .hha-coach-title{
        font-weight:900;
        letter-spacing:.2px;
        color: rgba(229,231,235,.96);
        font-size:13px;
        line-height:1.25;
        margin:0;
      }

      .hha-coach-why{
        margin-top:6px;
        color: rgba(148,163,184,.95);
        font-size:12px;
        line-height:1.25;
        white-space:pre-line;
      }

      .hha-coach-tags{
        display:flex;
        flex-wrap:wrap;
        gap:6px;
        justify-content:flex-end;
      }

      .hha-tag{
        display:inline-flex;
        align-items:center;
        gap:6px;
        padding:6px 10px;
        border-radius:999px;
        border:1px solid rgba(148,163,184,.14);
        background: rgba(15,23,42,.55);
        font-size:11px;
        font-weight:900;
        color: rgba(229,231,235,.92);
      }

      .hha-tag.urgent{
        border-color: rgba(245,158,11,.26);
        background: rgba(245,158,11,.12);
      }
      .hha-tag.warn{
        border-color: rgba(239,68,68,.26);
        background: rgba(239,68,68,.10);
      }
      .hha-tag.cheer{
        border-color: rgba(34,197,94,.26);
        background: rgba(34,197,94,.12);
      }
      .hha-tag.stage{
        border-color: rgba(34,211,238,.26);
        background: rgba(34,211,238,.10);
      }
    `;
    DOC.head.appendChild(style);

    const wrap = DOC.createElement('div');
    wrap.className = 'hha-coach-wrap';
    wrap.innerHTML = `<div class="hha-coach-stack" id="hhaCoachToastStack"></div>`;
    root.appendChild(wrap);
  }

  function clamp(n,a,b){ n=Number(n)||0; return n<a?a:(n>b?b:n); }
  function now(){ return performance.now ? performance.now() : Date.now(); }

  function badgeFor(type){
    const t = String(type||'tip');
    if (t==='warn') return '⚠️';
    if (t==='cheer') return '🔥';
    if (t==='stage') return '🧭';
    return '💡';
  }

  function addToast(payload){
    mount();
    const stack = DOC.getElementById('hhaCoachToastStack');
    if (!stack) return;

    const t = now();
    const key = String(payload.key || '');
    const type = String(payload.type || 'tip');
    const urgent = !!payload.urgent;

    // global rate limit
    if (t - STATE.lastAt < CFG.minGapMs) return;

    // key dedupe
    const prev = STATE.seen.get(key) || 0;
    if (key && (t - prev) < CFG.dedupeMs) return;

    STATE.lastAt = t;
    if (key) STATE.seen.set(key, t);

    const title = String(payload.text || '').trim();
    if (!title) return;

    const why = String(payload.why || '').trim();
    const stage = payload.stage ? String(payload.stage) : '';

    const toast = DOC.createElement('div');
    toast.className = 'hha-coach-toast';

    const tags = [];
    if (urgent) tags.push({ cls:'urgent', text:'URGENT' });
    if (type==='warn') tags.push({ cls:'warn', text:'WARN' });
    if (type==='cheer') tags.push({ cls:'cheer', text:'GOOD' });
    if (type==='stage') tags.push({ cls:'stage', text:`STAGE ${stage || ''}`.trim() });

    toast.innerHTML = `
      <div class="hha-coach-badge">${badgeFor(type)}</div>
      <div class="hha-coach-main">
        <div class="hha-coach-top">
          <p class="hha-coach-title"></p>
          <div class="hha-coach-tags"></div>
        </div>
        <div class="hha-coach-why" style="${CFG.hideWhyByDefault || !why ? 'display:none;' : ''}"></div>
      </div>
    `;

    toast.querySelector('.hha-coach-title').textContent = title;
    const whyEl = toast.querySelector('.hha-coach-why');
    if (whyEl && why){
      whyEl.textContent = why;
      if (!CFG.hideWhyByDefault) whyEl.style.display = '';
    }

    const tagsEl = toast.querySelector('.hha-coach-tags');
    if (tagsEl){
      tagsEl.innerHTML = tags.map(tg=>`<span class="hha-tag ${tg.cls}">${tg.text}</span>`).join('');
    }

    // push to DOM
    stack.prepend(toast);

    // trim stack
    while (stack.children.length > CFG.maxStack){
      const last = stack.lastElementChild;
      if (last) last.remove();
      else break;
    }

    // auto remove
    const ms = urgent ? CFG.urgentMs : CFG.baseMs;
    setTimeout(()=>{
      toast.classList.add('out');
      setTimeout(()=>{ try{ toast.remove(); }catch(_){ } }, 220);
    }, clamp(ms, 1200, 12000));
  }

  WIN.addEventListener('hha:coach', (ev)=>{
    const d = ev?.detail || {};
    addToast(d);
  }, { passive:true });

})();