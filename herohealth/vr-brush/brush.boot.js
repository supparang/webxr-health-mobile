// === /herohealth/vr-brush/brush.boot.js ===
// BrushVR BOOT — PRODUCTION (HHA Standard-ish) — v20260210a
// ✅ Detect view: pc/mobile/vr/cvr (NO override if ?view exists)
// ✅ Tap-to-start overlay works (mobile/cvr)
// ✅ Builds ctx from query + pass-through
// ✅ Starts engine exactly once (window.BrushVR.boot)
// ✅ On hha:end => show End Summary overlay + Back HUB (always)
// ✅ Does NOT emit hha:start (engine emits it)

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  // -----------------------------
  // QS utils
  // -----------------------------
  function sp(){
    try{ return new URL(location.href).searchParams; }
    catch{ return new URLSearchParams(); }
  }
  function qs(k, d=null){
    try{ return sp().get(k) ?? d; }
    catch{ return d; }
  }
  function qn(k, d=0){
    const v = Number(qs(k, d));
    return Number.isFinite(v) ? v : d;
  }
  function ql(k){
    const v = (qs(k,'')||'').trim().toLowerCase();
    return v;
  }

  // -----------------------------
  // detect view (NO override if ?view exists)
  // -----------------------------
  function detectView(){
    const v = (qs('view','')||'').trim().toLowerCase();
    if(v) return v;

    const ua = navigator.userAgent || '';
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua) || (Math.min(screen.width, screen.height) <= 520);
    return isMobile ? 'mobile' : 'pc';
  }

  function applyViewToBody(view){
    try{
      DOC.body.setAttribute('data-view', view);
      DOC.body.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
      DOC.body.classList.add('view-' + view);
    }catch(_){}
  }

  // -----------------------------
  // ctx builder (pass-through)
  // -----------------------------
  function buildCtx(){
    const view = detectView();

    // run: play | research (default play)
    const run = (ql('run') || 'play');
    const diff = (ql('diff') || 'normal');

    // time: seconds
    const time = qn('time', 90);

    // seed: deterministic in research if provided, else auto
    const seedRaw = qs('seed', '');
    const seed =
      (seedRaw && String(seedRaw).trim() !== '') ? seedRaw :
      String(Date.now());

    // research meta passthrough
    const ctx = {
      game: 'brush',
      view,
      run,
      diff,
      time,
      seed,

      // pass-through (optional)
      hub: qs('hub','') || '',
      pid: qs('pid','') || '',
      studyId: qs('studyId','') || '',
      phase: qs('phase','') || '',
      conditionGroup: qs('conditionGroup','') || '',
      log: qs('log','') || '',

      // raw params (useful for logging/debug)
      url: location.href
    };

    return ctx;
  }

  // -----------------------------
  // End summary overlay
  // -----------------------------
  function ensureEndOverlay(){
    let el = DOC.getElementById('brushEndOverlay');
    if(el) return el;

    el = DOC.createElement('div');
    el.id = 'brushEndOverlay';
    el.style.position = 'fixed';
    el.style.inset = '0';
    el.style.zIndex = '9999';
    el.style.display = 'none';
    el.style.placeItems = 'center';
    el.style.background = 'rgba(2,6,23,.62)';
    el.style.backdropFilter = 'blur(10px)';

    el.innerHTML = `
      <div style="width:min(720px,92vw);border:1px solid rgba(148,163,184,.18);border-radius:22px;padding:18px 16px;background:rgba(2,6,23,.80);box-shadow:0 18px 60px rgba(0,0,0,.45);">
        <div style="font-weight:950;font-size:18px;">สรุปผล BrushVR</div>
        <div id="be-sub" style="margin-top:6px;color:rgba(148,163,184,1);font-size:13px;line-height:1.5;">—</div>

        <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div style="border:1px solid rgba(148,163,184,.18);border-radius:16px;padding:10px;background:rgba(2,6,23,.35);">
            <div style="color:rgba(148,163,184,1);font-size:12px;">Rank / Score</div>
            <div id="be-score" style="margin-top:4px;font-weight:900;">—</div>
          </div>
          <div style="border:1px solid rgba(148,163,184,.18);border-radius:16px;padding:10px;background:rgba(2,6,23,.35);">
            <div style="color:rgba(148,163,184,1);font-size:12px;">Max Combo</div>
            <div id="be-combo" style="margin-top:4px;font-weight:900;">—</div>
          </div>

          <div style="grid-column:1/-1;border:1px solid rgba(148,163,184,.18);border-radius:16px;padding:10px;background:rgba(2,6,23,.35);">
            <div style="color:rgba(148,163,184,1);font-size:12px;">Coverage (Q1–Q4)</div>
            <div id="be-cov" style="margin-top:6px;font-weight:900;">—</div>
          </div>

          <div style="grid-column:1/-1;border:1px solid rgba(148,163,184,.18);border-radius:16px;padding:10px;background:rgba(2,6,23,.35);">
            <div style="color:rgba(148,163,184,1);font-size:12px;">Badges</div>
            <div id="be-badges" style="margin-top:6px;font-weight:900;">—</div>
          </div>
        </div>

        <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;">
          <button id="be-restart" style="padding:10px 14px;border-radius:16px;border:1px solid rgba(148,163,184,.22);background:rgba(34,197,94,.22);color:rgba(229,231,235,.95);font-weight:900;cursor:pointer;">Restart</button>
          <button id="be-back" style="padding:10px 14px;border-radius:16px;border:1px solid rgba(148,163,184,.22);background:rgba(2,6,23,.40);color:rgba(229,231,235,.95);font-weight:900;cursor:pointer;">Back HUB</button>
        </div>
      </div>
    `;

    DOC.body.appendChild(el);

    el.querySelector('#be-restart')?.addEventListener('click', ()=>location.reload());
    el.querySelector('#be-back')?.addEventListener('click', ()=>{
      const hub = (qs('hub','')||'').trim();
      if(hub) location.href = hub;
      else history.back();
    });

    return el;
  }

  function showEndSummary(summary){
    const el = ensureEndOverlay();
    const sub = el.querySelector('#be-sub');
    const beScore = el.querySelector('#be-score');
    const beCombo = el.querySelector('#be-combo');
    const beCov = el.querySelector('#be-cov');
    const beBadges = el.querySelector('#be-badges');

    const rank = summary?.rank ?? '—';
    const scoreTotal = summary?.scoreTotal ?? summary?.score ?? '—';
    const maxCombo = summary?.rhythm?.maxCombo ?? summary?.maxCombo ?? '—';
    const cov = summary?.coverage || {};
    const covText = ['q1','q2','q3','q4'].map(k=>`${k.toUpperCase()} ${Math.round(cov[k]||0)}%`).join('  •  ');

    const badges = (summary?.badgesEarned && summary.badgesEarned.length)
      ? summary.badgesEarned.join(', ')
      : '-';

    if(sub){
      const reason = summary?.reason ? ` • ${summary.reason}` : '';
      sub.textContent = `จบเกมแล้ว${reason}`;
    }
    if(beScore) beScore.textContent = `Rank ${rank} • Score ${scoreTotal}`;
    if(beCombo) beCombo.textContent = String(maxCombo);
    if(beCov) beCov.textContent = covText || '—';
    if(beBadges) beBadges.textContent = badges;

    el.style.display = 'grid';
  }

  // -----------------------------
  // Tap-to-start gate
  // -----------------------------
  function showTapStart(on){
    const tap = DOC.getElementById('tapStart');
    if(!tap) return;
    tap.style.display = on ? 'grid' : 'none';
    tap.style.pointerEvents = on ? 'auto' : 'none';
  }

  // -----------------------------
  // Start engine once
  // -----------------------------
  let started = false;

  function start(){
    if(started) return;
    started = true;

    const ctx = buildCtx();
    applyViewToBody(ctx.view);

    // hide tap overlay
    showTapStart(false);

    // guard engine exists
    if(!WIN.BrushVR || typeof WIN.BrushVR.boot !== 'function'){
      console.warn('[BrushVR BOOT] missing window.BrushVR.boot');
      // show a minimal error overlay instead of silent fail
      const e = DOC.createElement('div');
      e.style.position='fixed'; e.style.inset='0'; e.style.zIndex='9999';
      e.style.display='grid'; e.style.placeItems='center';
      e.style.background='rgba(2,6,23,.72)';
      e.innerHTML = `<div style="width:min(560px,92vw);border:1px solid rgba(148,163,184,.18);border-radius:22px;padding:16px;background:rgba(2,6,23,.82);color:rgba(229,231,235,.95);">
        <div style="font-weight:950">BrushVR Error</div>
        <div style="margin-top:6px;color:rgba(148,163,184,1);font-size:13px;line-height:1.5;">
          ไม่พบ Engine (<code>window.BrushVR.boot</code>)<br/>ตรวจลำดับสคริปต์: brush.safe.js ต้องมาก่อน brush.boot.js
        </div>
      </div>`;
      DOC.body.appendChild(e);
      return;
    }

    // listen end event (engine emits)
    WIN.addEventListener('hha:end', (ev)=>{
      try{
        const summary = ev?.detail?.summary || null;
        showEndSummary(summary);
      }catch(_){}
    }, { once:true });

    // start engine
    try{
      WIN.BrushVR.boot(ctx);
    }catch(err){
      console.error('[BrushVR BOOT] boot crash', err);
      const e = DOC.createElement('pre');
      e.style.position='fixed'; e.style.inset='12px'; e.style.zIndex='9999';
      e.style.background='rgba(2,6,23,.85)';
      e.style.border='1px solid rgba(148,163,184,.22)';
      e.style.borderRadius='16px';
      e.style.padding='12px';
      e.style.color='rgba(229,231,235,.95)';
      e.style.overflow='auto';
      e.textContent = String(err?.stack || err || 'Unknown error');
      DOC.body.appendChild(e);
    }
  }

  // -----------------------------
  // init
  // -----------------------------
  function init(){
    const view = detectView();
    applyViewToBody(view);

    // mobile/cvr => require tap to start
    const needsTap = (view === 'mobile' || view === 'cvr');

    // bind tap button
    const tapBtn = DOC.getElementById('tapBtn');
    if(tapBtn){
      tapBtn.addEventListener('click', (ev)=>{
        ev.preventDefault();
        start();
      }, { passive:false });
    }

    showTapStart(needsTap);

    // pc => autostart quickly
    if(!needsTap){
      // allow layout settle
      setTimeout(start, 50);
    }
  }

  if(DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', init);
  else init();

})();