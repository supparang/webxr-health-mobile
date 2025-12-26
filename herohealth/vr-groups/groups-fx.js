/* === /herohealth/vr-groups/groups-fx.js ===
Food Groups VR — FX Layer (PRODUCTION / classic script)
✅ Creates missing DOM FX nodes:
   - .stun-overlay (center card)
   - .lock-ring (progress + charge)
   - .group-banner (group change)
✅ Handles events:
   - groups:stun { on:boolean, sec?:number, reason?:string }
   - groups:lock { x?:px, y?:px, p?:0..1, c?:0..1, lock?:boolean, targetEl?:HTMLElement }
   - groups:group_change { group:number, label:string, hint?:string }
   - hha:time { left:number } -> panic class when <= 10
   - hha:judge { text:string, kind?:'good'|'bad'|'warn' } (optional tiny toast)
   - hha:score { ... } -> power fill pulse (optional)
*/

(function (root) {
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  // ---------------- utils ----------------
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function qs(sel){ return DOC.querySelector(sel); }
  function ce(tag, cls){ const e=DOC.createElement(tag); if(cls) e.className=cls; return e; }

  const html = DOC.documentElement;

  // ---------------- ensure stun overlay ----------------
  function ensureStun(){
    let ov = qs('.stun-overlay');
    if (!ov){
      ov = ce('div','stun-overlay');
      ov.style.display = 'none';
      const card = ce('div','stun-card');
      const title = ce('div','stun-title'); title.textContent = 'STUN!';
      const sub = ce('div','stun-sub'); sub.textContent = 'หยุดชั่วคราว…';
      card.appendChild(title); card.appendChild(sub);
      ov.appendChild(card);
      DOC.body.appendChild(ov);
    }
    return ov;
  }

  // ---------------- ensure lock ring ----------------
  function ensureLockRing(){
    let ring = qs('.lock-ring');
    if (!ring){
      ring = ce('div','lock-ring');
      ring.style.display = 'none';

      const core = ce('div','lock-core');
      const prog = ce('div','lock-prog');
      const charge = ce('div','lock-charge');

      ring.appendChild(core);
      ring.appendChild(prog);
      ring.appendChild(charge);

      DOC.body.appendChild(ring);
    }
    return ring;
  }

  // ---------------- ensure group banner ----------------
  function ensureBanner(){
    let b = qs('.group-banner');
    if (!b){
      b = ce('div','group-banner');
      b.style.display = 'none';
      const t = ce('div','group-banner-text'); t.textContent = 'หมู่ ?';
      const s = ce('div','group-banner-sub');  s.textContent = '';
      b.appendChild(t);
      b.appendChild(s);
      DOC.body.appendChild(b);
    }
    return b;
  }

  // ---------------- tiny judge toast (optional) ----------------
  function ensureJudge(){
    let j = qs('.fg-judge-toast');
    if (!j){
      j = ce('div','fg-judge-toast');
      Object.assign(j.style,{
        position:'fixed',
        left:'50%',
        bottom:'calc(16px + env(safe-area-inset-bottom,0px))',
        transform:'translateX(-50%)',
        zIndex:16,
        pointerEvents:'none',
        padding:'10px 14px',
        borderRadius:'999px',
        border:'1px solid rgba(148,163,184,.18)',
        background:'rgba(2,6,23,.78)',
        color:'rgba(229,231,235,.92)',
        fontWeight:'900',
        fontSize:'13px',
        opacity:'0',
        transition:'opacity .12s ease, transform .12s ease',
        boxShadow:'0 18px 60px rgba(0,0,0,.35)',
        backdropFilter:'blur(10px)',
        maxWidth:'92vw',
        whiteSpace:'nowrap',
        overflow:'hidden',
        textOverflow:'ellipsis',
      });
      DOC.body.appendChild(j);
    }
    return j;
  }

  // ---------------- afterimage burst ----------------
  function afterimageAt(xpx, ypx, emoji){
    // two afterimages for "VR feel"
    const a1 = ce('div','fg-afterimage a1');
    const a2 = ce('div','fg-afterimage a2');
    a1.style.setProperty('--x', xpx + 'px');
    a1.style.setProperty('--y', ypx + 'px');
    a2.style.setProperty('--x', xpx + 'px');
    a2.style.setProperty('--y', ypx + 'px');

    const i1 = ce('div','fg-afterimage-inner'); i1.textContent = emoji || '✨';
    const i2 = ce('div','fg-afterimage-inner'); i2.textContent = emoji || '✨';

    a1.appendChild(i1); a2.appendChild(i2);
    DOC.body.appendChild(a1); DOC.body.appendChild(a2);

    setTimeout(()=>{ a1.remove(); }, 220);
    setTimeout(()=>{ a2.remove(); }, 260);
  }

  // ---------------- public helpers used by engine (optional) ----------------
  root.GroupsFX = root.GroupsFX || {};
  root.GroupsFX.flashSwap = function(){
    html.classList.add('swapflash');
    setTimeout(()=>html.classList.remove('swapflash'), 160);
  };
  root.GroupsFX.flashStun = function(){
    html.classList.add('stunflash');
    setTimeout(()=>html.classList.remove('stunflash'), 240);
  };

  // ---------------- init nodes ----------------
  const stunOv = ensureStun();
  const lockRing = ensureLockRing();
  const banner = ensureBanner();
  const judgeToast = ensureJudge();

  const stunTitle = stunOv.querySelector('.stun-title');
  const stunSub   = stunOv.querySelector('.stun-sub');

  const bannerText = banner.querySelector('.group-banner-text');
  const bannerSub  = banner.querySelector('.group-banner-sub');

  let judgeTimer = 0;
  function showJudge(text, kind){
    clearTimeout(judgeTimer);
    judgeToast.textContent = String(text || '');
    // simple tint by kind
    if (kind === 'good'){
      judgeToast.style.borderColor = 'rgba(34,197,94,.22)';
    } else if (kind === 'bad'){
      judgeToast.style.borderColor = 'rgba(239,68,68,.22)';
    } else if (kind === 'warn'){
      judgeToast.style.borderColor = 'rgba(245,158,11,.25)';
    } else {
      judgeToast.style.borderColor = 'rgba(148,163,184,.18)';
    }
    judgeToast.style.opacity = '1';
    judgeToast.style.transform = 'translateX(-50%) translateY(0)';
    judgeTimer = setTimeout(()=>{
      judgeToast.style.opacity = '0';
      judgeToast.style.transform = 'translateX(-50%) translateY(4px)';
    }, 520);
  }

  // ---------------- lock ring state ----------------
  let lockHideT = 0;
  let lockedTarget = null;

  function setRingPos(xpx, ypx){
    lockRing.style.left = xpx + 'px';
    lockRing.style.top  = ypx + 'px';
  }
  function setRing(p,c){
    lockRing.style.setProperty('--p', clamp(p,0,1));
    lockRing.style.setProperty('--c', clamp(c,0,1));
  }
  function showRing(){
    lockRing.style.display = 'block';
    clearTimeout(lockHideT);
    lockHideT = setTimeout(()=>{ lockRing.style.display='none'; }, 260);
  }

  function setLockHighlight(targetEl, on){
    if (lockedTarget && lockedTarget !== targetEl){
      lockedTarget.classList.remove('lock');
    }
    lockedTarget = targetEl || lockedTarget;
    if (lockedTarget){
      if (on) lockedTarget.classList.add('lock');
      else lockedTarget.classList.remove('lock');
    }
  }

  // ---------------- events ----------------

  // Stun on/off
  root.addEventListener('groups:stun', (ev)=>{
    const d = ev.detail || {};
    const on = !!d.on;

    if (on){
      stunTitle.textContent = 'STUN!';
      const reason = d.reason ? String(d.reason) : 'โดนขยะ/กับดัก ⚠️';
      const sec = (d.sec|0);
      stunSub.textContent = sec > 0 ? `${reason} (${sec}s)` : reason;

      stunOv.style.display = 'flex';
      stunOv.classList.remove('pop');
      // reflow then add pop
      void stunOv.offsetWidth;
      stunOv.classList.add('pop');

      root.GroupsFX.flashStun();
    } else {
      stunOv.style.display = 'none';
      html.classList.remove('stunflash');
    }
  }, { passive:true });

  // Lock ring update
  root.addEventListener('groups:lock', (ev)=>{
    const d = ev.detail || {};
    const x = (d.x != null ? Number(d.x) : (root.innerWidth * 0.5));
    const y = (d.y != null ? Number(d.y) : (root.innerHeight * 0.5));
    const p = (d.p != null ? Number(d.p) : 0);
    const c = (d.c != null ? Number(d.c) : 0);

    setRingPos(x, y);
    setRing(p, c);
    showRing();

    if (d.targetEl) setLockHighlight(d.targetEl, !!d.lock);
    else if (typeof d.lock === 'boolean') setLockHighlight(null, !!d.lock);

    // subtle afterimage when lock completes
    if (d.lock === true){
      afterimageAt(x, y, '🎯');
    }
  }, { passive:true });

  // Group change banner
  let bannerHideT = 0;
  root.addEventListener('groups:group_change', (ev)=>{
    const d = ev.detail || {};
    const label = d.label ? String(d.label) : 'หมู่ ?';
    const hint  = d.hint ? String(d.hint) : 'ยิงให้ถูกหมู่นี้เพื่อเก็บพลัง ✨';

    bannerText.textContent = label;
    bannerSub.textContent  = hint;

    banner.style.display = 'block';
    banner.classList.remove('pop');
    void banner.offsetWidth;
    banner.classList.add('pop');

    root.GroupsFX.flashSwap();

    clearTimeout(bannerHideT);
    bannerHideT = setTimeout(()=>{ banner.style.display='none'; }, 920);
  }, { passive:true });

  // Time panic (endgame)
  root.addEventListener('hha:time', (ev)=>{
    const d = ev.detail || {};
    const left = (d.left|0);
    if (left <= 10 && left > 0) html.classList.add('panic');
    else html.classList.remove('panic');
  }, { passive:true });

  // Judge toast (optional)
  root.addEventListener('hha:judge', (ev)=>{
    const d = ev.detail || {};
    if (!d.text) return;
    showJudge(d.text, d.kind);
  }, { passive:true });

  // Score pulse: when power changes, give pulse if power-fill exists
  let lastPulseAt = 0;
  root.addEventListener('groups:power', ()=>{
    const now = performance.now();
    if (now - lastPulseAt < 90) return;
    lastPulseAt = now;

    const fill = qs('.power-fill');
    if (!fill) return;
    fill.classList.remove('pulse');
    void fill.offsetWidth;
    fill.classList.add('pulse');
  }, { passive:true });

})(window);