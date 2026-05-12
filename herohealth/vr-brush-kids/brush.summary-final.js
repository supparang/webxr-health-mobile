/* =========================================================
 * HeroHealth Brush Kids
 * /herohealth/vr-brush-kids/brush.summary-final.js
 * PATCH v20260512-P40-BRUSH-KIDS-SUMMARY-FINAL-CONSOLIDATED
 *
 * Purpose:
 * - Replace P35-P39 summary patches with ONE clean final controller
 * - No broad hiding
 * - No duplicate surface cards
 * - No duplicate action bars
 * - Fix Combo 30+ / Surface / Clean / Cooldown routing
 * ========================================================= */

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  const PATCH_ID = 'v20260512-P40-BRUSH-KIDS-SUMMARY-FINAL-CONSOLIDATED';
  const OUT_KEY = 'HHA_BRUSH_KIDS_SUMMARY_FINAL';

  function qs(){
    try{ return new URLSearchParams(WIN.location.search || ''); }
    catch(_){ return new URLSearchParams(); }
  }

  function param(k, fallback){
    const p = qs();
    const v = p.get(k);
    return v === null || v === '' ? fallback : v;
  }

  function bodyText(){
    try{
      return DOC.body ? (DOC.body.innerText || DOC.body.textContent || '') : '';
    }catch(_){
      return '';
    }
  }

  function isSummary(){
    const t = bodyText();
    return /ผลการแปรงฟันของฉัน|Clean Teeth|Replay Challenge|Tooth Pet Rescue|Cooldown|กลับ Hygiene Zone/i.test(t);
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

  function writeJson(k, v){
    try{ localStorage.setItem(k, JSON.stringify(v)); }catch(_){}
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
        const v = k.indexOf('.') >= 0 ? deepGet(src, k) : src[k];
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

    [
      'HHA_BRUSH_KIDS_LAST_SUMMARY',
      'HHA_BRUSH_LAST_SUMMARY',
      'HHA_LAST_SUMMARY',
      'HHA_BRUSH_SUMMARY',
      'HHA_BRUSH_METRICS',
      'HHA_BRUSH_KIDS_METRICS',

      /* old patch outputs, read only as fallback */
      'HHA_BRUSH_KIDS_LAST_SUMMARY_BRIDGED',
      'HHA_BRUSH_KIDS_SUMMARY_REPAIRED',
      'HHA_BRUSH_KIDS_SUMMARY_FINAL_AUTHORITY',
      'HHA_BRUSH_KIDS_SUMMARY_RESTORE_SAFE'
    ].forEach(k => {
      const v = readJson(k);
      if(v) list.push(v);
    });

    return list.filter(Boolean);
  }

  function parseZone(t){
    const m =
      t.match(/Zone\s*[\r\n\s]*([0-9]+)\s*\/\s*([0-9]+)/i) ||
      t.match(/แปรงครบ\s*:?\s*([0-9]+)\s*\/\s*([0-9]+)/i);

    if(m){
      return {
        done: safeNum(m[1], 0),
        total: safeNum(m[2], 6) || 6
      };
    }

    return { done:0, total:6 };
  }

  function parseSurfaceLine(t, label){
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const patterns = [
      new RegExp(escaped + '\\s*[:：]?\\s*([0-9]+)\\s*\\/\\s*([0-9]+)', 'i'),
      new RegExp(escaped + '[^0-9]{0,24}([0-9]+)\\s*\\/\\s*([0-9]+)', 'i')
    ];

    for(const re of patterns){
      const m = t.match(re);
      if(m){
        return {
          done: safeNum(m[1], 0),
          total: safeNum(m[2], 6) || 6
        };
      }
    }

    return { done:0, total:6 };
  }

  function extractMetrics(){
    const t = bodyText();
    const sources = collectSources();

    const score = Math.max(
      maxRegex(t, /คะแนน\s*[\r\n\s:]*([0-9]+)/gi),
      maxRegex(t, /Best Score\s*[\r\n\s:]*([0-9]+)/gi),
      maxField(sources, [
        'score',
        'bestScore',
        'finalScore',
        'points',
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
        'summary.combo',
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
        'accuracy',
        'metrics.clean',
        'metrics.cleanPct',
        'metrics.cleanPercent',
        'summary.clean',
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

    const fever = Math.max(
      maxRegex(t, /Fever\s*[\r\n\s:]*([0-9]+)/gi),
      maxField(sources, [
        'fever',
        'feverCount',
        'feverUsed',
        'feverActivations',
        'metrics.fever',
        'metrics.feverCount',
        'summary.feverCount'
      ])
    );

    const burst = Math.max(
      maxRegex(t, /Super Burst\s*[\r\n\s:]*([0-9]+)/gi),
      maxField(sources, [
        'burst',
        'burstCount',
        'burstUsed',
        'burstActivations',
        'superBurst',
        'metrics.burst',
        'metrics.burstCount',
        'summary.burstCount'
      ]),
      fever >= 1 ? 1 : 0
    );

    const pets = Math.max(
      maxRegex(t, /Tooth Pet Rescue\s*[\r\n\s:]*([0-9]+)/gi),
      maxRegex(t, /Molar Bunny\s*x\s*([0-9]+)/gi),
      maxRegex(t, /Spark Chick\s*x\s*([0-9]+)/gi),
      maxRegex(t, /Foam Dolphin\s*x\s*([0-9]+)/gi),
      maxRegex(t, /Smile Fox\s*x\s*([0-9]+)/gi),
      maxField(sources, [
        'petRescued',
        'petsRescued',
        'rescuedPets',
        'petCount',
        'metrics.petRescued',
        'summary.petRescued'
      ])
    );

    const zone = parseZone(t);

    let surfacePct = Math.max(
      maxRegex(t, /Surface Mastery\s*[\r\n\s:]*([0-9]+)\s*%/gi),
      maxRegex(t, /Mastery รวม\s*[\r\n\s:]*([0-9]+)\s*%/gi),
      maxField(sources, [
        'surface.pct',
        'surface.percent',
        'surfacePercent',
        'metrics.surface.pct',
        'summary.surface.pct'
      ])
    );

    if(clean >= 99 && zone.done >= zone.total){
      surfacePct = 100;
    }

    return {
      score,
      combo,
      clean,
      plaque,
      fever,
      burst,
      pets,
      zoneDone: zone.done || (clean >= 99 ? 6 : 0),
      zoneTotal: zone.total || 6,
      surfacePct
    };
  }

  function computeSurface(metrics){
    const t = bodyText();

    let outer = parseSurfaceLine(t, 'ด้านนอก');
    let inner = parseSurfaceLine(t, 'ด้านใน');
    let chewing = parseSurfaceLine(t, 'ด้านบดเคี้ยว');
    let gumline = parseSurfaceLine(t, 'แนวเหงือก');

    const cleanComplete = metrics.clean >= 99;
    const zoneComplete = metrics.zoneDone >= metrics.zoneTotal;

    if(cleanComplete && zoneComplete){
      outer = { done:6, total:6 };
      inner = { done:6, total:6 };
      chewing = { done:6, total:6 };
      gumline = { done:6, total:6 };
    }else{
      [outer, inner, chewing, gumline].forEach(s => {
        if(!s.total) s.total = 6;
        s.done = Math.max(0, Math.min(s.done, s.total));

        if(cleanComplete && s.total - s.done <= 1){
          s.done = s.total;
        }
      });
    }

    const done = outer.done + inner.done + chewing.done + gumline.done;
    const total = outer.total + inner.total + chewing.total + gumline.total;
    let pct = total ? Math.round((done / total) * 100) : 0;

    pct = Math.max(pct, metrics.surfacePct || 0);

    if(cleanComplete && zoneComplete){
      pct = 100;
    }

    return { outer, inner, chewing, gumline, pct };
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
    Object.keys(obj || {}).forEach(k => {
      const v = obj[k];
      if(v === undefined || v === null || v === '') return;
      q.set(k, String(v));
    });
    return q.toString();
  }

  function ctx(){
    const out = {
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

    ['studyId','conditionGroup','log','api','runMode','nick'].forEach(k => {
      const v = param(k, '');
      if(v) out[k] = v;
    });

    return out;
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
    if(DOC.getElementById('hha-brush-summary-final-style')) return;

    const style = DOC.createElement('style');
    style.id = 'hha-brush-summary-final-style';
    style.textContent = `
      html.hha-brush-summary-final,
      body.hha-brush-summary-final{
        min-height:100%;
        overflow-x:hidden !important;
      }

      body.hha-brush-summary-final{
        padding-bottom:calc(118px + env(safe-area-inset-bottom,0px)) !important;
      }

      /* Hide only known injected old patch artifacts */
      #hha-summary-repair-surface-card,
      #hha-summary-authority-surface-card,
      #hha-summary-restore-card,
      #hha-brush-summary-bridge-note,
      #hha-summary-authority-actions,
      #hha-summary-restore-actions,
      #hha-brush-summary-final-actions{
        display:none !important;
        visibility:hidden !important;
        pointer-events:none !important;
      }

      #hha-brush-summary-final-card{
        width:min(1120px,94vw);
        margin:18px auto 132px;
        border-radius:30px;
        border:3px solid #bdf4ff;
        background:linear-gradient(180deg,rgba(255,255,255,.98),rgba(240,253,255,.96));
        box-shadow:0 18px 48px rgba(23,56,79,.12);
        padding:18px;
        color:#17384f;
        font-family:inherit;
      }

      .hha-final-title{
        margin:0 0 8px;
        font-size:clamp(30px,4vw,46px);
        line-height:1.08;
        font-weight:1000;
        color:#12324b;
      }

      .hha-final-sub{
        margin:0 0 14px;
        color:#5f7f92;
        font-weight:900;
      }

      .hha-final-grid{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:10px;
        margin:12px 0 14px;
      }

      .hha-final-metric{
        min-height:76px;
        border-radius:20px;
        border:2px solid #cdeffc;
        background:#fff;
        padding:12px;
        display:grid;
        align-content:center;
      }

      .hha-final-label{
        color:#5f7f92;
        font-weight:1000;
        font-size:13px;
      }

      .hha-final-value{
        color:#12324b;
        font-weight:1000;
        font-size:clamp(24px,3vw,34px);
        line-height:1;
      }

      .hha-final-panel{
        border-radius:24px;
        border:2px solid #86efac;
        background:rgba(236,253,245,.88);
        padding:14px;
        margin-top:12px;
      }

      .hha-final-panel h3{
        margin:0 0 10px;
        color:#14532d;
        font-size:20px;
        font-weight:1000;
      }

      .hha-final-surface-grid{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:10px;
      }

      .hha-final-item{
        min-height:48px;
        border-radius:18px;
        border:2px solid #bbf7d0;
        background:#fff;
        color:#166534;
        padding:10px 12px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        font-weight:1000;
      }

      #hha-brush-summary-final-actions-clean{
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

      .hha-final-btn{
        min-height:58px;
        border:0;
        border-radius:20px;
        padding:10px 14px;
        font-size:clamp(15px,2vw,21px);
        font-weight:1000;
        cursor:pointer;
        color:#17384f;
        box-shadow:0 10px 24px rgba(23,56,79,.12);
        touch-action:manipulation;
      }

      .hha-final-btn.replay{
        background:linear-gradient(180deg,#fff2a8,#ffd84d);
        color:#5b4200;
      }

      .hha-final-btn.cooldown{
        background:linear-gradient(180deg,#effcff,#fff);
        border:2px solid #bdf4ff;
        color:#0f766e;
      }

      .hha-final-btn.zone{
        background:linear-gradient(180deg,#dcfff2,#baf4cf);
        color:#14532d;
      }

      .hha-final-pass{
        border-color:#86efac !important;
        background:rgba(236,253,245,.92) !important;
        color:#166534 !important;
      }

      @media (max-width:760px){
        body.hha-brush-summary-final{
          padding-bottom:calc(230px + env(safe-area-inset-bottom,0px)) !important;
        }

        .hha-final-grid,
        .hha-final-surface-grid,
        #hha-brush-summary-final-actions-clean{
          grid-template-columns:1fr;
        }

        #hha-brush-summary-final-card{
          margin-bottom:240px;
          padding:14px;
          border-radius:24px;
        }

        .hha-final-btn{
          min-height:50px;
          font-size:16px;
        }
      }
    `;

    DOC.head.appendChild(style);
  }

  function stopGameplayLayers(){
    try{
      if(WIN.HHA_BRUSH_POLISH && typeof WIN.HHA_BRUSH_POLISH.stop === 'function'){
        WIN.HHA_BRUSH_POLISH.stop();
      }
    }catch(_){}

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

  function hideNativeActionButtons(){
    Array.from(DOC.querySelectorAll('button,a')).forEach(el => {
      if(el.closest('#hha-brush-summary-final-actions-clean')) return;

      const t = (el.textContent || '').trim();
      if(/เล่นอีกครั้ง|Cooldown|กลับ Hygiene Zone|คูลดาวน์/i.test(t)){
        el.style.display = 'none';
        el.style.visibility = 'hidden';
        el.style.pointerEvents = 'none';
      }
    });
  }

  function setOldRowStatus(label, pass, statusText){
    if(!pass) return;

    const all = Array.from(DOC.querySelectorAll('div,li,p,span,button,a'));
    const row = all.find(el => {
      const t = el.textContent || '';
      return t.includes(label) && t.length < 320;
    });

    if(!row) return;

    const desired = statusText || 'ได้แล้ว';

    const nodes = Array.from(row.querySelectorAll('*')).reverse();
    const status = nodes.find(el => {
      const t = (el.textContent || '').trim();
      return t === 'ลองใหม่' || t === 'ยัง' || t === 'ผ่าน' || t === 'ได้แล้ว';
    });

    if(status){
      status.textContent = desired;
    }else{
      row.textContent = (row.textContent || '')
        .replace(/ลองใหม่/g, desired)
        .replace(/ยัง/g, desired);
    }

    row.classList.add('hha-final-pass');
  }

  function renderFinalCard(metrics, surface){
    let card = DOC.getElementById('hha-brush-summary-final-card');

    if(!card){
      card = DOC.createElement('section');
      card.id = 'hha-brush-summary-final-card';

      const anchor =
        Array.from(DOC.querySelectorAll('main,section,article,div')).find(el => {
          const t = el.textContent || '';
          return /ผลการแปรงฟันของฉัน/.test(t) && t.length < 1200;
        });

      if(anchor && anchor.parentElement){
        anchor.parentElement.insertBefore(card, anchor.nextSibling);
      }else{
        DOC.body.appendChild(card);
      }
    }

    card.innerHTML = `
      <h2 class="hha-final-title">ผลการแปรงฟันของฉัน</h2>
      <p class="hha-final-sub">สรุปผลสุดท้ายแบบรวม metric เดียว ไม่ซ้อน patch</p>

      <div class="hha-final-grid">
        <div class="hha-final-metric">
          <div class="hha-final-label">คะแนน</div>
          <div class="hha-final-value">${metrics.score}</div>
        </div>
        <div class="hha-final-metric">
          <div class="hha-final-label">Combo</div>
          <div class="hha-final-value">${metrics.combo}+</div>
        </div>
        <div class="hha-final-metric">
          <div class="hha-final-label">Clean</div>
          <div class="hha-final-value">${metrics.clean}%</div>
        </div>
        <div class="hha-final-metric">
          <div class="hha-final-label">Zone</div>
          <div class="hha-final-value">${metrics.zoneDone}/${metrics.zoneTotal}</div>
        </div>
      </div>

      <div class="hha-final-panel">
        <h3>🦷 Brushing Surface Mastery</h3>
        <div class="hha-final-surface-grid">
          <div class="hha-final-item"><span>✅ 🙂 ด้านนอก</span><strong>${surface.outer.done}/${surface.outer.total}</strong></div>
          <div class="hha-final-item"><span>✅ ↕️ ด้านใน</span><strong>${surface.inner.done}/${surface.inner.total}</strong></div>
          <div class="hha-final-item"><span>✅ ↔️ ด้านบดเคี้ยว</span><strong>${surface.chewing.done}/${surface.chewing.total}</strong></div>
          <div class="hha-final-item"><span>✅ 🌿 แนวเหงือก</span><strong>${surface.gumline.done}/${surface.gumline.total}</strong></div>
          <div class="hha-final-item"><span>🧠 Mastery รวม</span><strong>${surface.pct}%</strong></div>
          <div class="hha-final-item"><span>🔥 Best Combo</span><strong>${metrics.combo}+</strong></div>
        </div>
      </div>

      <div class="hha-final-panel">
        <h3>🏆 Challenge Status</h3>
        <div class="hha-final-surface-grid">
          <div class="hha-final-item"><span>🔥 Combo 30+</span><strong>${metrics.combo >= 30 ? 'ผ่าน' : 'ลองใหม่'}</strong></div>
          <div class="hha-final-item"><span>✨ Clean Legend</span><strong>${metrics.clean >= 99 ? 'ได้แล้ว' : 'ยัง'}</strong></div>
          <div class="hha-final-item"><span>🦷 Surface Master</span><strong>${surface.pct >= 95 ? 'ได้แล้ว' : 'ยัง'}</strong></div>
          <div class="hha-final-item"><span>🌈 Burst Master</span><strong>${metrics.burst >= 1 ? 'ได้แล้ว' : 'ยัง'}</strong></div>
          <div class="hha-final-item"><span>🐾 Pet Rescuer</span><strong>${metrics.pets >= 1 ? 'ได้แล้ว' : 'ยัง'}</strong></div>
          <div class="hha-final-item"><span>⭐ Mission Star</span><strong>ได้แล้ว</strong></div>
        </div>
      </div>

      <div class="hha-final-panel">
        <h3>✅ Summary Final</h3>
        <div class="hha-final-item">
          <span>Combo ${metrics.combo}+ • Clean ${metrics.clean}% • Surface ${surface.pct}%</span>
          <strong>${PATCH_ID}</strong>
        </div>
      </div>
    `;
  }

  function renderActions(){
    let bar = DOC.getElementById('hha-brush-summary-final-actions-clean');

    if(!bar){
      bar = DOC.createElement('nav');
      bar.id = 'hha-brush-summary-final-actions-clean';
      bar.setAttribute('aria-label', 'Brush Kids final summary actions');
      bar.innerHTML = `
        <button type="button" class="hha-final-btn replay">↩️ เล่นอีกครั้ง</button>
        <button type="button" class="hha-final-btn cooldown">🧘 Cooldown</button>
        <button type="button" class="hha-final-btn zone">🏠 กลับ Hygiene Zone</button>
      `;
      DOC.body.appendChild(bar);
    }

    const replay = bar.querySelector('.replay');
    const cooldown = bar.querySelector('.cooldown');
    const zone = bar.querySelector('.zone');

    if(replay && !replay.__hhaFinalBound){
      replay.__hhaFinalBound = true;
      replay.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        go(launcherUrl());
      }, true);
    }

    if(cooldown && !cooldown.__hhaFinalBound){
      cooldown.__hhaFinalBound = true;
      cooldown.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        go(cooldownUrl());
      }, true);
    }

    if(zone && !zone.__hhaFinalBound){
      zone.__hhaFinalBound = true;
      zone.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        go(zoneUrl());
      }, true);
    }
  }

  function applyStatuses(metrics, surface){
    if(metrics.combo >= 30){
      setOldRowStatus('Combo 30+', true, 'ผ่าน');
      setOldRowStatus('Combo Hero', true, 'ได้แล้ว');
    }

    if(metrics.clean >= 99){
      setOldRowStatus('Clean Legend', true, 'ได้แล้ว');
      setOldRowStatus('Golden Smile Challenge', true, 'ผ่าน');
    }

    if(surface.pct >= 95){
      setOldRowStatus('Surface Master', true, 'ได้แล้ว');
    }

    if(metrics.fever >= 1){
      setOldRowStatus('Fever Master', true, 'ได้แล้ว');
      setOldRowStatus('Foam Fever', true, 'ผ่าน');
    }

    if(metrics.burst >= 1){
      setOldRowStatus('Burst Master', true, 'ได้แล้ว');
    }

    if(metrics.pets >= 1){
      setOldRowStatus('Pet Rescuer', true, 'ได้แล้ว');
    }

    setOldRowStatus('Mission Star', true, 'ได้แล้ว');
    setOldRowStatus('Monster Hunter', true, 'ได้แล้ว');
    setOldRowStatus('กำจัด Monster', true, 'ผ่าน');
  }

  function apply(){
    if(!isSummary()) return;

    DOC.documentElement.classList.add('hha-brush-summary-final');
    if(DOC.body) DOC.body.classList.add('hha-brush-summary-final');

    ensureStyle();
    stopGameplayLayers();

    const metrics = extractMetrics();
    const surface = computeSurface(metrics);

    renderFinalCard(metrics, surface);
    renderActions();
    hideNativeActionButtons();
    applyStatuses(metrics, surface);

    const out = {
      patch: PATCH_ID,
      ts: new Date().toISOString(),
      metrics,
      surface,
      urls: {
        replay: launcherUrl(),
        cooldown: cooldownUrl(),
        zone: zoneUrl()
      }
    };

    writeJson(OUT_KEY, out);

    try{
      WIN.dispatchEvent(new CustomEvent('hha:brush-summary-final', { detail: out }));
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
        characterData:true,
        attributes:true
      });
    }catch(_){}

    setTimeout(apply, 120);
    setTimeout(apply, 500);
    setTimeout(apply, 1200);
    setTimeout(apply, 2400);
    setTimeout(apply, 4200);
  }

  function expose(){
    WIN.HHA_BRUSH_SUMMARY_FINAL = {
      patch: PATCH_ID,
      apply,
      extractMetrics,
      computeSurface,
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
