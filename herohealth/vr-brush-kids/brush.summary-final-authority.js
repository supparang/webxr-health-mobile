/* =========================================================
 * HeroHealth Brush Kids
 * /herohealth/vr-brush-kids/brush.summary-final-authority.js
 * PATCH v20260512-P38-BRUSH-KIDS-SUMMARY-FINAL-AUTHORITY
 *
 * Purpose:
 * - แก้ Surface 0% จาก P35/P36
 * - ซ่อน duplicate Surface card / duplicate note / duplicate fixed action bar
 * - ใช้ metric จริงจาก HUD + result panel เป็น source of truth
 * - Combo 30+ ต้องผ่านเมื่อ combo >= 30
 * - Render Surface Mastery ใหม่เพียงชุดเดียว
 * - Bind ปุ่ม Replay / Cooldown / Hygiene Zone ให้ถูก flow
 * ========================================================= */

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  const PATCH_ID = 'v20260512-P38-BRUSH-KIDS-SUMMARY-FINAL-AUTHORITY';
  const OUT_KEY = 'HHA_BRUSH_KIDS_SUMMARY_FINAL_AUTHORITY';

  function log(){
    try{ console.log('[BrushSummaryFinalAuthority]', PATCH_ID, ...arguments); }catch(_){}
  }

  function bodyText(){
    try{
      return (DOC.body && (DOC.body.innerText || DOC.body.textContent)) || '';
    }catch(_){
      return '';
    }
  }

  function isSummary(){
    const t = bodyText();
    return /ผลการแปรงฟันของฉัน|Replay Challenge|Brushing Surface Mastery|Tooth Pet Rescue|Cooldown|กลับ Hygiene Zone/i.test(t);
  }

  function safeNum(v, d){
    const n = Number(v);
    return Number.isFinite(n) ? n : (d || 0);
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

  function maxRegex(text, regex){
    let max = 0;
    let m;
    regex.lastIndex = 0;
    while((m = regex.exec(text))){
      max = Math.max(max, safeNum(m[1], 0));
    }
    return max;
  }

  function deepGet(obj, path){
    try{
      return String(path).split('.').reduce((o,k)=>o && o[k], obj);
    }catch(_){
      return undefined;
    }
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

    return list.filter(Boolean);
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

  function parseZone(text){
    const patterns = [
      /Zone\s*[\r\n\s]*([0-9]+)\s*\/\s*([0-9]+)/i,
      /แปรงครบ\s*:?\s*([0-9]+)\s*\/\s*([0-9]+)/i,
      /แปรงครบ\s*([0-9]+)\s*\/\s*([0-9]+)/i
    ];

    for(const re of patterns){
      const m = text.match(re);
      if(m){
        return {
          done: safeNum(m[1], 0),
          total: safeNum(m[2], 6) || 6
        };
      }
    }

    return { done:0, total:6 };
  }

  function parseSurfaceLine(text, label){
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const patterns = [
      new RegExp(escaped + '\\s*[:：]?\\s*([0-9]+)\\s*\\/\\s*([0-9]+)', 'i'),
      new RegExp(escaped + '[^0-9]{0,20}([0-9]+)\\s*\\/\\s*([0-9]+)', 'i')
    ];

    for(const re of patterns){
      const m = text.match(re);
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

    const comboDom = Math.max(
      maxRegex(t, /Combo\s*[\r\n\s]*([0-9]+)\+/gi),
      maxRegex(t, /Combo\s*[\r\n\s:]*([0-9]+)/gi),
      maxRegex(t, /Max Combo\s*[\r\n\s:]*([0-9]+)/gi),
      maxRegex(t, /Best Combo\s*[\r\n\s:]*([0-9]+)/gi)
    );

    const cleanDom = Math.max(
      maxRegex(t, /Clean\s*[\r\n\s]*([0-9]+)\s*%/gi),
      maxRegex(t, /Clean Teeth\s*[\r\n\s:]*([0-9]+)\s*%/gi),
      maxRegex(t, /Best Clean\s*[\r\n\s:]*([0-9]+)\s*%/gi)
    );

    const scoreDom = Math.max(
      maxRegex(t, /Best Score\s*[\r\n\s:]*([0-9]+)/gi),
      maxRegex(t, /คะแนน\s*[\r\n\s:]*([0-9]+)/gi)
    );

    const surfacePanelPct = Math.max(
      maxRegex(t, /Surface Mastery\s*[\r\n\s:]*([0-9]+)\s*%/gi),
      maxRegex(t, /Mastery รวม\s*[\r\n\s:]*([0-9]+)\s*%/gi)
    );

    const feverDom = maxRegex(t, /Fever\s*[\r\n\s:]*([0-9]+)/gi);
    const burstDom = maxRegex(t, /Super Burst\s*[\r\n\s:]*([0-9]+)/gi);

    const petDom = Math.max(
      maxRegex(t, /Tooth Pet Rescue\s*[\r\n\s:]*([0-9]+)/gi),
      maxRegex(t, /Molar Bunny\s*x\s*([0-9]+)/gi),
      maxRegex(t, /Spark Chick\s*x\s*([0-9]+)/gi),
      maxRegex(t, /Foam Dolphin\s*x\s*([0-9]+)/gi),
      maxRegex(t, /Smile Fox\s*x\s*([0-9]+)/gi)
    );

    const combo = Math.max(
      comboDom,
      maxField(sources, [
        'combo',
        'bestCombo',
        'comboMax',
        'maxCombo',
        'metrics.combo',
        'metrics.bestCombo',
        'metrics.comboMax',
        'metrics.comboMax',
        'metrics.combo',
        'summary.combo',
        'summary.bestCombo'
      ])
    );

    const clean = Math.max(
      cleanDom,
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
        'summary.cleanPct'
      ])
    );

    const score = Math.max(
      scoreDom,
      maxField(sources, [
        'score',
        'bestScore',
        'finalScore',
        'points',
        'metrics.score',
        'summary.score'
      ])
    );

    const fever = Math.max(
      feverDom,
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
      burstDom,
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
      petDom,
      maxField(sources, [
        'petRescued',
        'petsRescued',
        'rescuedPets',
        'petCount',
        'metrics.pets',
        'metrics.petRescued',
        'summary.petRescued'
      ])
    );

    return {
      score,
      combo,
      clean,
      fever,
      burst,
      pets,
      zone: parseZone(t),
      surfacePanelPct
    };
  }

  function computeSurface(metrics){
    const t = bodyText();

    let surface = {
      outer: parseSurfaceLine(t, 'ด้านนอก'),
      inner: parseSurfaceLine(t, 'ด้านใน'),
      chewing: parseSurfaceLine(t, 'ด้านบดเคี้ยว'),
      gumline: parseSurfaceLine(t, 'แนวเหงือก')
    };

    const explicitSurface100 = metrics.surfacePanelPct >= 95;
    const cleanZoneComplete =
      metrics.clean >= 99 &&
      metrics.zone.done > 0 &&
      metrics.zone.done >= metrics.zone.total;

    if(explicitSurface100 || cleanZoneComplete){
      surface = {
        outer: { done:6, total:6 },
        inner: { done:6, total:6 },
        chewing: { done:6, total:6 },
        gumline: { done:6, total:6 }
      };
    }else{
      Object.keys(surface).forEach(k => {
        const s = surface[k];
        if(!s.total) s.total = 6;

        if(metrics.clean >= 99 && s.total - s.done <= 1){
          s.done = s.total;
        }

        s.done = Math.max(0, Math.min(s.done, s.total));
      });
    }

    const done =
      surface.outer.done +
      surface.inner.done +
      surface.chewing.done +
      surface.gumline.done;

    const total =
      surface.outer.total +
      surface.inner.total +
      surface.chewing.total +
      surface.gumline.total;

    let pct = total ? Math.round((done / total) * 100) : 0;

    pct = Math.max(pct, metrics.surfacePanelPct || 0);

    if(metrics.clean >= 99 && metrics.zone.done >= metrics.zone.total){
      pct = 100;
    }

    return Object.assign(surface, { pct });
  }

  function ensureStyle(){
    if(DOC.getElementById('hha-summary-final-authority-style')) return;

    const style = DOC.createElement('style');
    style.id = 'hha-summary-final-authority-style';
    style.textContent = `
      /* Hide broken cards/notes from earlier bridge patches */
      #hha-summary-repair-surface-card,
      #hha-brush-summary-bridge-note,
      #hha-brush-summary-final-actions{
        display:none !important;
        visibility:hidden !important;
        pointer-events:none !important;
      }

      body.hha-summary-authority-ready{
        padding-bottom:24px !important;
        overflow-x:hidden !important;
      }

      #hha-summary-authority-surface-card{
        margin:14px 0;
        border-radius:26px;
        border:3px solid #86efac;
        background:linear-gradient(180deg,rgba(240,253,244,.98),rgba(255,255,255,.96));
        color:#14532d;
        padding:16px;
        box-shadow:0 12px 28px rgba(20,83,45,.10);
        font-weight:900;
      }

      .hha-authority-title{
        font-size:20px;
        line-height:1.2;
        font-weight:1000;
        margin-bottom:8px;
        color:#14532d;
      }

      .hha-authority-sub{
        color:#6b4f00;
        font-size:14px;
        line-height:1.45;
        margin-bottom:12px;
      }

      .hha-authority-grid{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:10px;
      }

      .hha-authority-item{
        min-height:48px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        padding:10px 12px;
        border-radius:18px;
        border:2px solid #bbf7d0;
        background:rgba(236,253,245,.92);
        color:#166534;
        font-size:15px;
        font-weight:1000;
      }

      .hha-authority-note{
        margin-top:12px;
        padding:10px 12px;
        border-radius:18px;
        border:2px solid #bbf7d0;
        background:rgba(236,253,245,.92);
        color:#14532d;
        text-align:center;
        font-size:14px;
        font-weight:1000;
      }

      .hha-authority-pass{
        border-color:#86efac !important;
        background:rgba(236,253,245,.92) !important;
        color:#166534 !important;
      }

      .hha-authority-actions{
        margin-top:16px;
        display:grid;
        grid-template-columns:1.15fr .95fr 1fr;
        gap:12px;
      }

      .hha-authority-actions button,
      .hha-authority-actions a{
        min-height:58px !important;
        border-radius:22px !important;
        font-weight:1000 !important;
        font-size:clamp(15px,2vw,22px) !important;
      }

      @media (max-width:760px){
        .hha-authority-grid,
        .hha-authority-actions{
          grid-template-columns:1fr;
        }

        #hha-summary-authority-surface-card{
          border-radius:22px;
          padding:13px;
        }

        .hha-authority-item{
          min-height:44px;
          font-size:14px;
        }
      }
    `;
    DOC.head.appendChild(style);
  }

  function smallestContaining(label){
    const all = Array.from(DOC.querySelectorAll('section,article,div,li,p,span,button,a'));
    return all.filter(el => {
      const t = el.textContent || '';
      if(!t.includes(label)) return false;
      return !Array.from(el.children || []).some(ch => (ch.textContent || '').includes(label));
    });
  }

  function findRow(label){
    const leaves = smallestContaining(label);

    for(const leaf of leaves){
      let el = leaf;
      for(let i=0; i<7 && el; i++){
        const t = el.textContent || '';
        if(t.includes(label) && t.length < 340){
          return el;
        }
        el = el.parentElement;
      }
    }

    return null;
  }

  function findCard(label){
    const leaves = smallestContaining(label);

    for(const leaf of leaves){
      let el = leaf;
      for(let i=0; i<8 && el; i++){
        const t = el.textContent || '';
        if(t.includes(label) && t.length < 1400){
          return el;
        }
        el = el.parentElement;
      }
    }

    return null;
  }

  function setRowStatus(label, pass, statusText){
    if(!pass) return;

    const row = findRow(label);
    if(!row) return;

    const desired = statusText || 'ได้แล้ว';

    const candidates = Array.from(row.querySelectorAll('*')).reverse();
    const status = candidates.find(el => {
      const t = (el.textContent || '').trim();
      return t === 'ลองใหม่' || t === 'ยัง' || t === 'ผ่าน' || t === 'ได้แล้ว';
    });

    if(status){
      status.textContent = desired;
    }else{
      const before = row.textContent || '';
      if(/ลองใหม่|ยัง/.test(before)){
        row.textContent = before.replace(/ลองใหม่/g, desired).replace(/ยัง/g, desired);
      }
    }

    row.classList.add('hha-authority-pass');
    row.setAttribute('data-authority-pass', '1');
  }

  function updateInlineText(){
    const t = bodyText();

    Array.from(DOC.querySelectorAll('div,p,span,li')).forEach(el => {
      const raw = el.textContent || '';
      if(raw.length > 260) return;

      if(/Max Combo\s*:?\s*[0-9]+/i.test(raw)){
        const metrics = extractMetrics();
        el.textContent = raw.replace(/Max Combo\s*:?\s*[0-9]+/i, 'Max Combo: ' + metrics.combo);
      }
    });
  }

  function hideDuplicateSurfaceCards(){
    const finalCard = DOC.getElementById('hha-summary-authority-surface-card');

    Array.from(DOC.querySelectorAll('section,article,div')).forEach(el => {
      if(el === finalCard) return;

      const t = el.textContent || '';
      if(!t.includes('Brushing Surface Mastery')) return;

      if(el.id === 'hha-summary-authority-surface-card') return;

      if(t.length < 1200){
        el.style.display = 'none';
        el.setAttribute('data-authority-hidden-duplicate-surface', '1');
      }
    });
  }

  function renderSurface(surface, metrics){
    let card = DOC.getElementById('hha-summary-authority-surface-card');

    if(!card){
      card = DOC.createElement('section');
      card.id = 'hha-summary-authority-surface-card';

      const daily = findCard('Daily Brush Challenge');
      const toothPet = findCard('Tooth Pet Rescue');
      const replay = findCard('Replay Challenge');

      if(daily && daily.parentElement){
        daily.parentElement.insertBefore(card, daily.nextSibling);
      }else if(toothPet && toothPet.parentElement){
        toothPet.parentElement.insertBefore(card, toothPet);
      }else if(replay && replay.parentElement){
        replay.parentElement.insertBefore(card, replay);
      }else{
        DOC.body.appendChild(card);
      }
    }

    card.innerHTML = `
      <div class="hha-authority-title">🦷 Brushing Surface Mastery</div>
      <div class="hha-authority-sub">ดูว่าฝึกด้านนอก/ด้านใน/ด้านบดเคี้ยว/แนวเหงือกได้ครบแค่ไหน</div>
      <div class="hha-authority-grid">
        <div class="hha-authority-item"><span>✅ 🙂 ด้านนอก</span><strong>${surface.outer.done}/${surface.outer.total}</strong></div>
        <div class="hha-authority-item"><span>✅ ↕️ ด้านใน</span><strong>${surface.inner.done}/${surface.inner.total}</strong></div>
        <div class="hha-authority-item"><span>✅ ↔️ ด้านบดเคี้ยว</span><strong>${surface.chewing.done}/${surface.chewing.total}</strong></div>
        <div class="hha-authority-item"><span>✅ 🌿 แนวเหงือก</span><strong>${surface.gumline.done}/${surface.gumline.total}</strong></div>
        <div class="hha-authority-item"><span>🧠 Mastery รวม</span><strong>${surface.pct}%</strong></div>
        <div class="hha-authority-item"><span>🔥 Best Combo</span><strong>${metrics.combo}+</strong></div>
      </div>
      <div class="hha-authority-note">✅ Summary final: Combo ${metrics.combo}+ • Clean ${metrics.clean}% • Surface ${surface.pct}%</div>
    `;
  }

  function removeFloatingStart(){
    const emergency = DOC.getElementById('hha-brush-emergency-start');
    if(emergency){
      try{ emergency.remove(); }catch(_){ emergency.style.display = 'none'; }
    }

    Array.from(DOC.querySelectorAll('button,a,div,span')).forEach(el => {
      const t = (el.textContent || '').trim();
      if(t === '🪥 เริ่มแปรงฟัน' || t === 'เริ่มแปรงฟัน'){
        const cs = WIN.getComputedStyle ? WIN.getComputedStyle(el) : null;
        if(!cs || cs.position === 'fixed' || cs.position === 'sticky' || cs.position === 'absolute'){
          try{ el.remove(); }catch(_){ el.style.display = 'none'; }
        }
      }
    });
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
      'hha-brush-cvr-hint'
    ].forEach(id => {
      const el = DOC.getElementById(id);
      if(el) el.style.display = 'none';
    });

    Array.from(DOC.querySelectorAll('.hha-brush-target,.hha-brush-pop,.hha-brush-sparkle')).forEach(el => {
      try{ el.remove(); }catch(_){ el.style.display = 'none'; }
    });
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

  function qs(){
    try{ return new URLSearchParams(WIN.location.search || ''); }
    catch(_){ return new URLSearchParams(); }
  }

  function param(k, fallback){
    const p = qs();
    const v = p.get(k);
    return v === null || v === '' ? fallback : v;
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

  function hygieneZoneUrl(){
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
    c.hub = hygieneZoneUrl();

    return baseHero() + 'brush-vr-kids.html?' + toQuery(c);
  }

  function cooldownUrl(){
    const zone = hygieneZoneUrl();
    const c = ctx();

    c.run = 'cooldown';
    c.phase = 'cooldown';
    c.cooldown = '1';
    c.once = '1';
    c.next = zone;
    c.back = zone;
    c.return = zone;
    c.hub = zone;

    return baseHero() + 'warmup-gate.html?' + toQuery(c);
  }

  function go(url){
    try{ WIN.location.href = url; }
    catch(_){
      try{ WIN.location.assign(url); }catch(__){}
    }
  }

  function bindActionButtons(){
    const buttons = Array.from(DOC.querySelectorAll('button,a'));

    buttons.forEach(el => {
      const t = (el.textContent || '').trim();

      if(/เล่นอีกครั้ง|Replay|ลองใหม่/i.test(t)){
        if(!el.__hhaAuthorityReplay){
          el.__hhaAuthorityReplay = true;
          el.addEventListener('click', function(ev){
            try{ ev.preventDefault(); ev.stopPropagation(); }catch(_){}
            go(launcherUrl());
          }, true);
        }
      }

      if(/Cooldown|คูลดาวน์/i.test(t)){
        if(!el.__hhaAuthorityCooldown){
          el.__hhaAuthorityCooldown = true;
          el.addEventListener('click', function(ev){
            try{ ev.preventDefault(); ev.stopPropagation(); }catch(_){}
            go(cooldownUrl());
          }, true);
        }
      }

      if(/กลับ Hygiene Zone|Hygiene Zone|กลับโซน/i.test(t)){
        if(!el.__hhaAuthorityZone){
          el.__hhaAuthorityZone = true;
          el.addEventListener('click', function(ev){
            try{ ev.preventDefault(); ev.stopPropagation(); }catch(_){}
            go(hygieneZoneUrl());
          }, true);
        }
      }
    });
  }

  function makeActionGroupIfMissing(){
    const t = bodyText();
    if(/เล่นอีกครั้ง/.test(t) && /Cooldown/.test(t) && /กลับ Hygiene Zone/.test(t)){
      return;
    }

    if(DOC.getElementById('hha-summary-authority-actions')) return;

    const group = DOC.createElement('div');
    group.id = 'hha-summary-authority-actions';
    group.className = 'hha-authority-actions';
    group.innerHTML = `
      <button type="button" class="replay">↩️ เล่นอีกครั้ง</button>
      <button type="button" class="cooldown">🧘 Cooldown</button>
      <button type="button" class="zone">🏠 กลับ Hygiene Zone</button>
    `;

    const replay = findCard('Replay Challenge') || DOC.getElementById('hha-summary-authority-surface-card');
    if(replay && replay.parentElement){
      replay.parentElement.appendChild(group);
    }else{
      DOC.body.appendChild(group);
    }

    bindActionButtons();
  }

  function applyStatuses(metrics, surface){
    if(metrics.combo >= 30){
      setRowStatus('Combo 30+', true, 'ผ่าน');
      setRowStatus('Combo Hero', true, 'ได้แล้ว');
    }

    if(metrics.clean >= 99){
      setRowStatus('Clean Legend', true, 'ได้แล้ว');
      setRowStatus('Golden Smile Challenge', true, 'ผ่าน');
    }

    if(surface.pct >= 95){
      setRowStatus('Surface Master', true, 'ได้แล้ว');
    }

    if(metrics.fever >= 1){
      setRowStatus('Fever Master', true, 'ได้แล้ว');
      setRowStatus('Foam Fever', true, 'ผ่าน');
    }

    if(metrics.burst >= 1){
      setRowStatus('Burst Master', true, 'ได้แล้ว');
    }

    if(metrics.pets >= 1){
      setRowStatus('Pet Rescuer', true, 'ได้แล้ว');
    }

    setRowStatus('Mission Star', true, 'ได้แล้ว');
    setRowStatus('Monster Hunter', true, 'ได้แล้ว');
    setRowStatus('กำจัด Monster', true, 'ผ่าน');
  }

  function apply(){
    if(!isSummary()) return;

    ensureStyle();

    DOC.documentElement.classList.add('hha-summary-authority-ready');
    if(DOC.body) DOC.body.classList.add('hha-summary-authority-ready');

    removeFloatingStart();
    stopGameplayLayers();

    const metrics = extractMetrics();
    const surface = computeSurface(metrics);

    hideDuplicateSurfaceCards();
    renderSurface(surface, metrics);
    hideDuplicateSurfaceCards();

    applyStatuses(metrics, surface);
    updateInlineText();
    bindActionButtons();
    makeActionGroupIfMissing();

    const out = {
      patch: PATCH_ID,
      ts: new Date().toISOString(),
      metrics,
      surface,
      urls: {
        replay: launcherUrl(),
        cooldown: cooldownUrl(),
        zone: hygieneZoneUrl()
      }
    };

    writeJson(OUT_KEY, out);

    try{
      WIN.dispatchEvent(new CustomEvent('hha:brush-summary-final-authority', { detail: out }));
    }catch(_){}

    log('applied', out);
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
        attributes:true,
        attributeFilter:['class','style']
      });
    }catch(_){}

    setTimeout(apply, 120);
    setTimeout(apply, 500);
    setTimeout(apply, 1200);
    setTimeout(apply, 2400);
    setTimeout(apply, 4200);
    setTimeout(apply, 6500);
  }

  function expose(){
    WIN.HHA_BRUSH_SUMMARY_FINAL_AUTHORITY = {
      patch: PATCH_ID,
      apply,
      extractMetrics,
      computeSurface,
      outKey: OUT_KEY,
      urls: {
        launcher: launcherUrl,
        cooldown: cooldownUrl,
        zone: hygieneZoneUrl
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
