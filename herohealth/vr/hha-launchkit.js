// === /herohealth/vr/hha-launchkit.js ===
// HHA LaunchKit — PACK 27
// ✅ Auto-resume last view + params
// ✅ Device Gate (pc/mobile/cardboard/cvr)
// ✅ Pre-run checklist overlay helpers
// ✅ Safe fullscreen/orientation request (user gesture only)
// ✅ Canonicalize query params

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const KEY = {
    last: 'HHA_LAST_LAUNCH',           // global
    lastByGame: (g)=>`HHA_LAST_${g}_LAUNCH`, // per game
  };

  function qsGet(u, k, def=null){
    try{ return u.searchParams.get(k) ?? def; }catch(_){ return def; }
  }
  function qsSet(u, k, v){
    try{
      if (v===null || v===undefined || v==='') u.searchParams.delete(k);
      else u.searchParams.set(k, String(v));
    }catch(_){}
  }
  function now(){ return Date.now(); }

  function isTouch(){
    return ('ontouchstart' in root) || (navigator.maxTouchPoints>0);
  }
  function isMobileUA(){
    const ua = navigator.userAgent || '';
    return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  }
  function isLikelyMobile(){
    // heuristic: touch + small-ish viewport OR mobile UA
    const w = Math.min(root.innerWidth||9999, root.innerHeight||9999);
    return isMobileUA() || (isTouch() && w < 860);
  }

  async function requestFullscreenAndLandscape(){
    // must be called from user gesture
    try{
      const el = DOC.documentElement;
      if (!DOC.fullscreenElement && el.requestFullscreen){
        await el.requestFullscreen({navigationUI:'hide'});
      }
    }catch(_){}
    try{
      if (screen.orientation && screen.orientation.lock){
        await screen.orientation.lock('landscape');
      }
    }catch(_){}
  }

  function canCardboard(){
    // Cardboard split mode: requires touch + small device ideally
    return isTouch() && isLikelyMobile();
  }
  function canCVR(){
    // cVR (crosshair strict): also best on mobile, but allow desktop (for testing)
    return true;
  }

  function inferDefaultView(){
    // If mobile => mobile, else pc
    return isLikelyMobile() ? 'mobile' : 'pc';
  }

  function normalizeView(v){
    v = String(v||'').toLowerCase();
    if (v==='pc'||v==='mobile'||v==='cardboard'||v==='cvr') return v;
    return '';
  }

  function canonicalize(url, schema){
    // schema: { allow:[keys], defaults:{}, rename:{old:new}, clamp:{} }
    const u = new URL(url.toString());
    const allow = (schema && schema.allow) || [];
    const defaults = (schema && schema.defaults) || {};
    const rename = (schema && schema.rename) || {};
    const clampMap = (schema && schema.clamp) || {};

    // rename
    Object.keys(rename).forEach(oldKey=>{
      const nk = rename[oldKey];
      const val = qsGet(u, oldKey, null);
      if (val!=null){
        qsSet(u, nk, val);
        u.searchParams.delete(oldKey);
      }
    });

    // apply defaults
    Object.keys(defaults).forEach(k=>{
      if (!u.searchParams.has(k)) qsSet(u, k, defaults[k]);
    });

    // clamp numeric
    Object.keys(clampMap).forEach(k=>{
      const mm = clampMap[k] || {};
      const v = Number(qsGet(u,k,''));
      if (!Number.isFinite(v)) return;
      const min = Number(mm.min ?? v);
      const max = Number(mm.max ?? v);
      const vv = Math.max(min, Math.min(max, v));
      qsSet(u,k, String(Math.round(vv)));
    });

    // remove unknowns if allow list provided
    if (allow.length){
      const keep = new Set(allow);
      // always keep hub/run/diff/time/seed/view/ts/practice/log/sessionId etc. if included
      Array.from(u.searchParams.keys()).forEach(k=>{
        if (!keep.has(k)) u.searchParams.delete(k);
      });
    }

    return u;
  }

  function saveLast(game, obj){
    try{
      const payload = Object.assign({ t: now(), game: game||'' }, obj||{});
      localStorage.setItem(KEY.last, JSON.stringify(payload));
      if (game) localStorage.setItem(KEY.lastByGame(game), JSON.stringify(payload));
    }catch(_){}
  }
  function loadLast(game){
    try{
      const raw = game ? localStorage.getItem(KEY.lastByGame(game)) : null;
      const raw2 = localStorage.getItem(KEY.last);
      const s = raw || raw2;
      if (!s) return null;
      const obj = JSON.parse(s);
      return obj && typeof obj==='object' ? obj : null;
    }catch(_){}
    return null;
  }

  function buildResumeURL(opts){
    // opts: { game, baseUrl, currentUrl, preferGameKey, patch:{...}, schema }
    const cur = new URL(opts.currentUrl || location.href);
    const base = new URL(opts.baseUrl || cur.toString());
    const game = opts.game || '';
    const last = loadLast(game);
    const schema = opts.schema || null;

    // merge priority: current explicit params > last saved > defaults
    const keys = (schema && schema.allow) ? schema.allow : [];

    const out = new URL(base.toString());

    const pick = (k)=>{
      const vCur = qsGet(cur,k,null);
      if (vCur!=null) return vCur;
      if (last && last[k]!=null) return String(last[k]);
      return qsGet(out,k,null);
    };

    keys.forEach(k=>{
      const v = pick(k);
      if (v!=null) qsSet(out,k,v);
    });

    // patch overrides
    const patch = opts.patch || {};
    Object.keys(patch).forEach(k=> qsSet(out,k, patch[k]) );

    // ensure ts
    if (!out.searchParams.get('ts')) qsSet(out,'ts', String(now()));

    return schema ? canonicalize(out, schema) : out;
  }

  function gateDecision(view){
    view = normalizeView(view);
    if (!view) return { ok:true, view: inferDefaultView(), reason:'no-view' };

    if (view==='cardboard' && !canCardboard()){
      return { ok:false, view: inferDefaultView(), reason:'cardboard-not-supported' };
    }
    if (view==='cvr' && !canCVR()){
      return { ok:false, view: inferDefaultView(), reason:'cvr-not-supported' };
    }
    return { ok:true, view, reason:'ok' };
  }

  function attachHasVRUI(){
    // best effort: if vr-ui present -> mark class for HUD safe padding
    setTimeout(()=>{
      try{
        const has = DOC.querySelector('[data-hha-vrui], .hha-vrui, .vrui, .a-enter-vr-button, button[data-enter-vr]');
        if (has) DOC.body.classList.add('has-vrui');
      }catch(_){}
    }, 300);
  }

  function makeChecklistText(view){
    view = normalizeView(view) || inferDefaultView();
    if (view==='pc'){
      return `Checklist (PC)
• ใช้เมาส์คลิกเป้า
• ถ้าจอเล็ก: ซูม 100% (อย่าซูม browser)
• เป้าต้องกระจายทั่วจอ (ถ้ากองมุมเดียว = reload)`;
    }
    if (view==='mobile'){
      return `Checklist (Mobile)
• ถือแนวนอน (แนะนำ)
• แตะยิงให้ชัวร์ อย่ารัวมั่ว
• ถ้า Safari/Chrome ซ่อนแถบไม่สุด: แตะเริ่มใหม่อีกครั้ง`;
    }
    if (view==='cardboard'){
      return `Checklist (VR Cardboard - Split)
• กดเข้า Fullscreen ก่อน (สำคัญมาก)
• ล็อกแนวนอน (best-effort)
• จัดมือถือให้นิ่ง แล้วกด Recenter/Calibrate
• ถ้าเวียนหัว: หยุดพัก 10–20 วิ`;
    }
    return `Checklist (cVR - Crosshair Strict)
• กด Fullscreen/แนวนอน
• ยิงจาก crosshair กลางจอเท่านั้น (แตะยิง)
• ถ้าเล็งไม่ตรง: กด Calibrate Center`;
  }

  function showChecklistOverlay(text, opts){
    // opts: { onContinue, onSwitch(view), onClose }
    const id='hhaChecklistOverlay';
    let el = DOC.getElementById(id);
    if (el) el.remove();

    el = DOC.createElement('div');
    el.id=id;
    el.style.cssText = `
      position:fixed; inset:0; z-index:130;
      display:flex; align-items:center; justify-content:center;
      padding:16px;
      background:rgba(2,6,23,.84);
      backdrop-filter: blur(10px);
      color:#e5e7eb;
      font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;
    `;
    el.innerHTML = `
      <div style="
        width:min(920px,100%);
        border-radius:22px;
        border:1px solid rgba(148,163,184,.18);
        background:rgba(2,6,23,.72);
        box-shadow:0 24px 90px rgba(0,0,0,.55);
        padding:16px;">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
          <div>
            <div style="font-weight:900;font-size:16px;">Pre-Run Checklist ✅</div>
            <div style="opacity:.9;font-size:12px;margin-top:4px;">อ่าน 3 วิ แล้วกด Continue — เข้าเกมแบบโหดแต่แฟร์ 😈</div>
          </div>
          <button id="hhaChkClose" style="all:unset;cursor:pointer;padding:10px 12px;border-radius:14px;border:1px solid rgba(148,163,184,.18);background:rgba(15,23,42,.62);font-weight:900;">✖</button>
        </div>
        <pre style="margin:12px 0 0 0;white-space:pre-wrap;background:rgba(15,23,42,.70);border:1px solid rgba(148,163,184,.14);border-radius:14px;padding:12px;font-size:12px;line-height:1.35;">${escapeHtml(text)}</pre>
        <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:14px;">
          <button id="hhaChkContinue" style="all:unset;cursor:pointer;padding:10px 12px;border-radius:14px;border:1px solid rgba(34,197,94,.26);background:rgba(34,197,94,.16);font-weight:900;">🔥 Continue</button>
          <button id="hhaChkPC" style="all:unset;cursor:pointer;padding:10px 12px;border-radius:14px;border:1px solid rgba(148,163,184,.18);background:rgba(15,23,42,.62);font-weight:900;">🖥️ Switch PC</button>
          <button id="hhaChkMobile" style="all:unset;cursor:pointer;padding:10px 12px;border-radius:14px;border:1px solid rgba(148,163,184,.18);background:rgba(15,23,42,.62);font-weight:900;">📱 Switch Mobile</button>
          <button id="hhaChkCard" style="all:unset;cursor:pointer;padding:10px 12px;border-radius:14px;border:1px solid rgba(148,163,184,.18);background:rgba(15,23,42,.62);font-weight:900;">🕶️ Switch Cardboard</button>
          <button id="hhaChkCVR" style="all:unset;cursor:pointer;padding:10px 12px;border-radius:14px;border:1px solid rgba(148,163,184,.18);background:rgba(15,23,42,.62);font-weight:900;">🎯 Switch cVR</button>
        </div>
      </div>
    `;
    DOC.body.appendChild(el);

    const $ = (id)=>DOC.getElementById(id);
    $('hhaChkClose')?.addEventListener('click', ()=>{ el.remove(); opts?.onClose?.(); });
    $('hhaChkContinue')?.addEventListener('click', ()=>{ el.remove(); opts?.onContinue?.(); });
    $('hhaChkPC')?.addEventListener('click', ()=>{ opts?.onSwitch?.('pc'); });
    $('hhaChkMobile')?.addEventListener('click', ()=>{ opts?.onSwitch?.('mobile'); });
    $('hhaChkCard')?.addEventListener('click', ()=>{ opts?.onSwitch?.('cardboard'); });
    $('hhaChkCVR')?.addEventListener('click', ()=>{ opts?.onSwitch?.('cvr'); });
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, (m)=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }

  root.HHA_LaunchKit = {
    canonicalize,
    saveLast,
    loadLast,
    buildResumeURL,
    gateDecision,
    requestFullscreenAndLandscape,
    attachHasVRUI,
    makeChecklistText,
    showChecklistOverlay,
    inferDefaultView,
    normalizeView,
    isLikelyMobile,
    canCardboard,
  };
})(window);