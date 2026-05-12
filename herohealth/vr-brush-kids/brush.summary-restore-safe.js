/* =========================================================
 * HeroHealth Brush Kids
 * /herohealth/vr-brush-kids/brush.summary-restore-safe.js
 * PATCH v20260512-P39-BRUSH-KIDS-SUMMARY-RESTORE-SAFE
 *
 * Purpose:
 * - Undo over-hide from P38
 * - Restore real summary/result content
 * - Hide only known broken duplicate cards/notes
 * - Render one safe final summary block if content is missing
 * - Replace oversized bottom buttons with compact safe action bar
 * ========================================================= */

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  const PATCH_ID = 'v20260512-P39-BRUSH-KIDS-SUMMARY-RESTORE-SAFE';

  function qs(){
    try{ return new URLSearchParams(WIN.location.search || ''); }
    catch(_){ return new URLSearchParams(); }
  }

  function param(k, fallback){
    const p = qs();
    const v = p.get(k);
    return v === null || v === '' ? fallback : v;
  }

  function text(root){
    try{
      const r = root || DOC.body || DOC.documentElement;
      return r.innerText || r.textContent || '';
    }catch(_){
      return '';
    }
  }

  function isSummary(){
    const t = text();
    return /ผลการแปรงฟันของฉัน|Clean Teeth|Plaque|Combo|Cooldown|กลับ Hygiene Zone/i.test(t);
  }

  function safeNum(v, d){
    const n = Number(v);
    return Number.isFinite(n) ? n : (d || 0);
  }

  function maxRegex(t, re){
    let max = 0;
    let m;
    re.lastIndex = 0;
    while((m = re.exec(t))){
      max = Math.max(max, safeNum(m[1], 0));
    }
    return max;
  }

  function readJson(k){
    try{
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : null;
    }catch(_){
      return null;
    }
  }

  function deepGet(obj, path){
    try{
      return String(path).split('.').reduce((o,k)=>o && o[k], obj);
    }catch(_){
      return undefined;
    }
  }

  function maxField(sources, keys){
    let out = 0;
    sources.forEach(src => {
      keys.forEach(k => {
        const v = k.includes('.') ? deepGet(src, k) : src[k];
        out = Math.max(out, safeNum(v, 0));
      });
    });
    return out;
  }

  function collectSources(){
    const list = [];

    try{
      if(WIN.HHA_BRUSH_POLISH && typeof WIN.HHA_BRUSH_POLISH.summary === 'function'){
        list.push(WIN.HHA_BRUSH_POLISH.summary());
      }
    }catch(_){}

    [
      'HHA_BRUSH_KIDS_SUMMARY_FINAL_AUTHORITY',
      'HHA_BRUSH_KIDS_SUMMARY_REPAIRED',
      'HHA_BRUSH_KIDS_LAST_SUMMARY_BRIDGED',
      'HHA_BRUSH_KIDS_LAST_SUMMARY',
      'HHA_BRUSH_LAST_SUMMARY',
      'HHA_LAST_SUMMARY',
      'HHA_BRUSH_SUMMARY',
      'HHA_BRUSH_METRICS',
      'HHA_BRUSH_KIDS_METRICS'
    ].forEach(k => {
      const v = readJson(k);
      if(v) list.push(v);
    });

    [
      'HHA_BRUSH_SUMMARY',
      'HHA_BRUSH_METRICS',
      'HHA_BRUSH_KIDS_METRICS',
      'BRUSH_METRICS',
      'BrushMetrics',
      'HHA_LAST_SUMMARY'
    ].forEach(k => {
      try{
        if(WIN[k]) list.push(WIN[k]);
      }catch(_){}
    });

    return list.filter(Boolean);
  }

  function extract(){
    const t = text();
    const sources = collectSources();

    const score = Math.max(
      maxRegex(t, /คะแนน\s*[\r\n\s:]*([0-9]+)/gi),
      maxRegex(t, /Best Score\s*[\r\n\s:]*([0-9]+)/gi),
      maxField(sources, [
        'score',
        'bestScore',
        'finalScore',
        'metrics.score',
        'summary.score',
        'metrics.metrics.score'
      ])
    );

    const combo = Math.max(
      maxRegex(t, /Combo\s*[\r\n\s:]*([0-9]+)/gi),
      maxRegex(t, /Max Combo\s*[\r\n\s:]*([0-9]+)/gi),
      maxRegex(t, /Best Combo\s*[\r\n\s:]*([0-9]+)/gi),
      maxField(sources, [
        'combo',
        'bestCombo',
        'comboMax',
        'maxCombo',
        'metrics.combo',
        'metrics.bestCombo',
        'metrics.comboMax',
        'summary.bestCombo',
        'metrics.metrics.combo'
      ])
    );

    const clean = Math.max(
      maxRegex(t, /Clean\s*[\r\n\s:]*([0-9]+)\s*%/gi),
      maxRegex(t, /Clean Teeth\s*[\r\n\s:]*([0-9]+)\s*%/gi),
      maxRegex(t, /Best Clean\s*[\r\n\s:]*([0-9]+)\s*%/gi),
      maxField(sources, [
        'clean',
        'cleanPct',
        'cleanPercent',
        'bestClean',
        'metrics.clean',
        'metrics.cleanPct',
        'summary.cleanPct',
        'metrics.metrics.clean'
      ])
    );

    const plaque = Math.max(
      maxRegex(t, /Plaque\s*[\r\n\s:]*([0-9]+)\s*%/gi),
      maxField(sources, [
        'plaque',
        'plaquePct',
        'metrics.plaque',
        'summary.plaque'
      ])
    );

    const zoneMatch =
      t.match(/Zone\s*[\r\n\s]*([0-9]+)\s*\/\s*([0-9]+)/i) ||
      t.match(/แปรงครบ\s*:?\s*([0-9]+)\s*\/\s*([0-9]+)/i);

    const zoneDone = zoneMatch ? safeNum(zoneMatch[1], 6) : 6;
    const zoneTotal = zoneMatch ? safeNum(zoneMatch[2], 6) : 6;

    let surfacePct = Math.max(
      maxRegex(t, /Surface Mastery\s*[\r\n\s:]*([0-9]+)\s*%/gi),
      maxRegex(t, /Mastery รวม\s*[\r\n\s:]*([0-9]+)\s*%/gi),
      maxField(sources, [
        'surface.pct',
        'surface.percent',
        'metrics.surface.pct',
        'summary.surface.pct'
      ])
    );

    if(clean >= 99 && zoneDone >= zoneTotal){
      surfacePct = 100;
    }

    return {
      score,
      combo,
      clean,
      plaque,
      zoneDone,
      zoneTotal,
      surfacePct
    };
  }

  function baseHero(){
    try{
      const path = WIN.location.pathname || '';
      const marker = '/herohealth/';
      const idx = path.indexOf(marker);
      if(idx >= 0){
        return WIN.location.origin + path.slice(0, idx + marker.length);
      }
    }catch(_){}
    return WIN.location.origin + '/herohealth/';
  }

  function cleanUrl(raw){
    try{
      const s = String(raw || '').trim();
      if(!s) return '';
      return new URL(decodeURIComponent(s), baseHero()).toString();
    }catch(_){
      try{ return new URL(String(raw || ''), baseHero()).toString(); }
      catch(__){ return ''; }
    }
  }

  function toQuery(obj){
    const q = new URLSearchParams();
    Object.keys(obj).forEach(k => {
      const v = obj[k];
      if(v === undefined || v === null || v === '') return;
      q.set(k, String(v));
    });
    return q.toString();
  }

  function ctx(){
    return {
      pid: param('pid', 'anon'),
      name: param('name', 'Hero'),
      diff: param('diff', 'normal'),
      time: param('time', '120'),
      view: param('view', 'mobile'),
      zone: 'hygiene',
      cat: 'hygiene',
      game: 'brush',
      gameId: 'brush',
      variant: 'kids-vr',
      mode: param('mode', 'learn'),
      entry: 'brush-kids',
      theme: 'brush',
      seed: param('seed', String(Date.now()))
    };
  }

  function zoneUrl(){
    const explicit =
      cleanUrl(param('hub', '')) ||
      cleanUrl(param('back', '')) ||
      cleanUrl(param('return', ''));

    if(explicit && /hygiene-zone\.html/i.test(explicit)){
      return explicit;
    }

    const c = ctx();
    c.run = 'menu';
    c.hub = baseHero() + 'hub.html';

    return baseHero() + 'hygiene-zone.html?' + toQuery(c);
  }

  function launcherUrl(){
    const c = ctx();
    c.run = 'menu';
    c.hub = zoneUrl();

    return baseHero() + 'brush-vr-kids.html?' + toQuery(c);
  }

  function cooldownUrl(){
    const c = ctx();
    const z = zoneUrl();

    c.run = 'cooldown';
    c.phase = 'cooldown';
    c.cooldown = '1';
    c.once = '1';
    c.next = z;
    c.back = z;
    c.return = z;
    c.hub = z;

    return baseHero() + 'warmup-gate.html?' + toQuery(c);
  }

  function go(url){
    try{ WIN.location.href = url; }
    catch(_){
      try{ WIN.location.assign(url); }catch(__){}
    }
  }

  function ensureStyle(){
    if(DOC.getElementById('hha-summary-restore-safe-style')) return;

    const style = DOC.createElement('style');
    style.id = 'hha-summary-restore-safe-style';
    style.textContent = `
      html.hha-summary-restore-safe,
      body.hha-summary-restore-safe{
        min-height:100%;
        overflow-x:hidden !important;
      }

      body.hha-summary-restore-safe{
        padding-bottom:calc(118px + env(safe-area-inset-bottom,0px)) !important;
      }

      /* Undo broad hiding from P38 */
      body.hha-summary-restore-safe [data-authority-hidden-duplicate-surface="1"]{
        display:block !important;
        visibility:visible !important;
        pointer-events:auto !important;
      }

      /* Hide only known broken injected cards/notes */
      body.hha-summary-restore-safe #hha-summary-repair-surface-card,
      body.hha-summary-restore-safe #hha-brush-summary-bridge-note,
      body.hha-summary-restore-safe #hha-summary-authority-surface-card,
      body.hha-summary-restore-safe #hha-summary-authority-actions,
      body.hha-summary-restore-safe #hha-brush-summary-final-actions{
        display:none !important;
        visibility:hidden !important;
        pointer-events:none !important;
      }

      #hha-summary-restore-card{
        width:min(1120px,94vw);
        margin:18px auto 130px;
        border-radius:30px;
        border:3px solid #bdf4ff;
        background:linear-gradient(180deg,rgba(255,255,255,.98),rgba(240,253,255,.96));
        box-shadow:0 18px 48px rgba(23,56,79,.12);
        padding:18px;
        color:#17384f;
        font-family:inherit;
      }

      .hha-restore-title{
        font-size:clamp(28px,4vw,44px);
        line-height:1.1;
        font-weight:1000;
        margin:0 0 8px;
      }

      .hha-restore-sub{
        margin:0 0 14px;
        color:#5f7f92;
        font-weight:900;
      }

      .hha-restore-grid{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:10px;
        margin:12px 0 14px;
      }

      .hha-restore-metric{
        border-radius:20px;
        border:2px solid #cdeffc;
        background:#fff;
        padding:12px;
        min-height:76px;
        display:grid;
        align-content:center;
      }

      .hha-restore-label{
        color:#5f7f92;
        font-weight:1000;
        font-size:13px;
      }

      .hha-restore-value{
        color:#12324b;
        font-weight:1000;
        font-size:clamp(24px,3vw,34px);
        line-height:1;
      }

      .hha-restore-panel{
        border-radius:24px;
        border:2px solid #86efac;
        background:rgba(236,253,245,.86);
        padding:14px;
        margin-top:12px;
      }

      .hha-restore-panel h3{
        margin:0 0 10px;
        color:#14532d;
        font-size:20px;
        font-weight:1000;
      }

      .hha-surface-grid{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:10px;
      }

      .hha-surface-item{
        min-height:48px;
        border-radius:18px;
        border:2px solid #bbf7d0;
        background:#fff;
        color:#166534;
        padding:10px 12px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        font-weight:1000;
      }

      #hha-summary-restore-actions{
        position:fixed;
        left:50%;
        bottom:calc(10px + env(safe-area-inset-bottom,0px));
        transform:translateX(-50%);
        z-index:999999;
        width:min(94vw,860px);
        display:grid;
        grid-template-columns:1.1fr .9fr 1fr;
        gap:10px;
        padding:10px;
        border-radius:26px;
        background:rgba(255,255,255,.92);
        border:3px solid rgba(189,244,255,.9);
        box-shadow:0 18px 48px rgba(23,56,79,.18);
        backdrop-filter:blur(14px);
      }

      .hha-restore-btn{
        min-height:58px;
        border:0;
        border-radius:20px;
        padding:10px 14px;
        font-size:clamp(15px,2vw,21px);
        font-weight:1000;
        cursor:pointer;
        color:#17384f;
        box-shadow:0 10px 24px rgba(23,56,79,.12);
      }

      .hha-restore-btn.replay{
        background:linear-gradient(180deg,#fff2a8,#ffd84d);
        color:#5b4200;
      }

      .hha-restore-btn.cooldown{
        background:linear-gradient(180deg,#effcff,#fff);
        border:2px solid #bdf4ff;
        color:#0f766e;
      }

      .hha-restore-btn.zone{
        background:linear-gradient(180deg,#dcfff2,#baf4cf);
        color:#14532d;
      }

      @media (max-width:760px){
        body.hha-summary-restore-safe{
          padding-bottom:calc(230px + env(safe-area-inset-bottom,0px)) !important;
        }

        .hha-restore-grid,
        .hha-surface-grid,
        #hha-summary-restore-actions{
          grid-template-columns:1fr;
        }

        #hha-summary-restore-card{
          margin-bottom:240px;
          padding:14px;
          border-radius:24px;
        }

        .hha-restore-btn{
          min-height:50px;
          font-size:16px;
        }
      }
    `;

    DOC.head.appendChild(style);
  }

  function stopLayers(){
    [
      'hha-brush-polish-layer',
      'hha-brush-cvr-layer',
      'hha-brush-cvr-crosshair',
      'hha-brush-cvr-hint',
      'hha-brush-emergency-start'
    ].forEach(id => {
      const el = DOC.getElementById(id);
      if(el){
        try{ el.remove(); }catch(_){ el.style.display = 'none'; }
      }
    });

    Array.from(DOC.querySelectorAll('.hha-brush-target,.hha-brush-pop,.hha-brush-sparkle')).forEach(el => {
      try{ el.remove(); }catch(_){ el.style.display = 'none'; }
    });
  }

  function hideOversizedNativeActions(){
    Array.from(DOC.querySelectorAll('button,a')).forEach(el => {
      const t = (el.textContent || '').trim();
      if(/เล่นอีกครั้ง|Cooldown|กลับ Hygiene Zone/i.test(t)){
        if(!el.closest('#hha-summary-restore-actions')){
          el.style.display = 'none';
          el.style.visibility = 'hidden';
          el.style.pointerEvents = 'none';
        }
      }
    });
  }

  function renderCard(){
    const m = extract();

    let card = DOC.getElementById('hha-summary-restore-card');
    if(!card){
      card = DOC.createElement('section');
      card.id = 'hha-summary-restore-card';
      DOC.body.appendChild(card);
    }

    const surfaceDone = m.clean >= 99 && m.zoneDone >= m.zoneTotal ? 6 : Math.round((m.surfacePct / 100) * 6);
    const surfaceTotal = 6;
    const surfacePct = m.clean >= 99 && m.zoneDone >= m.zoneTotal ? 100 : m.surfacePct;

    card.innerHTML = `
      <h2 class="hha-restore-title">ผลการแปรงฟันของฉัน</h2>
      <p class="hha-restore-sub">สรุปผลแบบปลอดภัยหลังซ่อม Summary UI</p>

      <div class="hha-restore-grid">
        <div class="hha-restore-metric"><div class="hha-restore-label">คะแนน</div><div class="hha-restore-value">${m.score}</div></div>
        <div class="hha-restore-metric"><div class="hha-restore-label">Combo</div><div class="hha-restore-value">${m.combo}+</div></div>
        <div class="hha-restore-metric"><div class="hha-restore-label">Clean</div><div class="hha-restore-value">${m.clean}%</div></div>
        <div class="hha-restore-metric"><div class="hha-restore-label">Zone</div><div class="hha-restore-value">${m.zoneDone}/${m.zoneTotal}</div></div>
      </div>

      <div class="hha-restore-panel">
        <h3>🦷 Brushing Surface Mastery</h3>
        <div class="hha-surface-grid">
          <div class="hha-surface-item"><span>✅ 🙂 ด้านนอก</span><strong>${surfaceDone}/${surfaceTotal}</strong></div>
          <div class="hha-surface-item"><span>✅ ↕️ ด้านใน</span><strong>${surfaceDone}/${surfaceTotal}</strong></div>
          <div class="hha-surface-item"><span>✅ ↔️ ด้านบดเคี้ยว</span><strong>${surfaceDone}/${surfaceTotal}</strong></div>
          <div class="hha-surface-item"><span>✅ 🌿 แนวเหงือก</span><strong>${surfaceDone}/${surfaceTotal}</strong></div>
          <div class="hha-surface-item"><span>🧠 Mastery รวม</span><strong>${surfacePct}%</strong></div>
          <div class="hha-surface-item"><span>🔥 Best Combo</span><strong>${m.combo}+</strong></div>
        </div>
      </div>

      <div class="hha-restore-panel">
        <h3>🏆 Challenge Status</h3>
        <div class="hha-surface-grid">
          <div class="hha-surface-item"><span>🔥 Combo 30+</span><strong>${m.combo >= 30 ? 'ผ่าน' : 'ลองใหม่'}</strong></div>
          <div class="hha-surface-item"><span>✨ Clean Legend</span><strong>${m.clean >= 99 ? 'ได้แล้ว' : 'ยัง'}</strong></div>
          <div class="hha-surface-item"><span>🦷 Surface Master</span><strong>${surfacePct >= 95 ? 'ได้แล้ว' : 'ยัง'}</strong></div>
          <div class="hha-surface-item"><span>⭐ Mission Star</span><strong>ได้แล้ว</strong></div>
        </div>
      </div>
    `;

    try{
      localStorage.setItem('HHA_BRUSH_KIDS_SUMMARY_RESTORE_SAFE', JSON.stringify({
        patch: PATCH_ID,
        ts: new Date().toISOString(),
        metrics: m,
        surfacePct
      }));
    }catch(_){}
  }

  function renderActions(){
    let bar = DOC.getElementById('hha-summary-restore-actions');

    if(!bar){
      bar = DOC.createElement('nav');
      bar.id = 'hha-summary-restore-actions';
      bar.innerHTML = `
        <button type="button" class="hha-restore-btn replay">↩️ เล่นอีกครั้ง</button>
        <button type="button" class="hha-restore-btn cooldown">🧘 Cooldown</button>
        <button type="button" class="hha-restore-btn zone">🏠 กลับ Hygiene Zone</button>
      `;
      DOC.body.appendChild(bar);
    }

    const replay = bar.querySelector('.replay');
    const cooldown = bar.querySelector('.cooldown');
    const zone = bar.querySelector('.zone');

    if(replay && !replay.__hhaRestoreBound){
      replay.__hhaRestoreBound = true;
      replay.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        go(launcherUrl());
      }, true);
    }

    if(cooldown && !cooldown.__hhaRestoreBound){
      cooldown.__hhaRestoreBound = true;
      cooldown.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        go(cooldownUrl());
      }, true);
    }

    if(zone && !zone.__hhaRestoreBound){
      zone.__hhaRestoreBound = true;
      zone.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        go(zoneUrl());
      }, true);
    }
  }

  function apply(){
    if(!isSummary()) return;

    DOC.documentElement.classList.add('hha-summary-restore-safe');
    if(DOC.body) DOC.body.classList.add('hha-summary-restore-safe');

    ensureStyle();
    stopLayers();
    hideOversizedNativeActions();
    renderCard();
    renderActions();

    try{
      WIN.dispatchEvent(new CustomEvent('hha:brush-summary-restore-safe', {
        detail: {
          patch: PATCH_ID,
          metrics: extract(),
          replay: launcherUrl(),
          cooldown: cooldownUrl(),
          zone: zoneUrl()
        }
      }));
    }catch(_){}
  }

  function observe(){
    let timer = null;

    const run = () => {
      clearTimeout(timer);
      timer = setTimeout(apply, 120);
    };

    try{
      const mo = new MutationObserver(run);
      mo.observe(DOC.body || DOC.documentElement, {
        childList:true,
        subtree:true,
        attributes:true,
        characterData:true
      });
    }catch(_){}

    setTimeout(apply, 120);
    setTimeout(apply, 500);
    setTimeout(apply, 1200);
    setTimeout(apply, 2400);
    setTimeout(apply, 4200);
  }

  function expose(){
    WIN.HHA_BRUSH_SUMMARY_RESTORE_SAFE = {
      patch: PATCH_ID,
      apply,
      extract,
      urls: {
        launcher: launcherUrl,
        cooldown: cooldownUrl,
        zone: zoneUrl
      }
    };
  }

  function boot(){
    expose();
    observe();
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }

})();
