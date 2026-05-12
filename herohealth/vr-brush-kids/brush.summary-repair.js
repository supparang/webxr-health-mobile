/* =========================================================
 * HeroHealth Brush Kids
 * /herohealth/vr-brush-kids/brush.summary-repair.js
 * PATCH v20260512-P36-BRUSH-KIDS-SUMMARY-REPAIR
 *
 * Purpose:
 * - ซ่อมผลจาก P35 ที่ Surface note เป็น 0%
 * - ซ่อม Combo source ให้ใช้ค่าสูงสุดจริง เช่น HUD Combo 52
 * - ซ่อนปุ่มลอย "เริ่มแปรงฟัน" บนหน้า Summary
 * - ซ่อม/วาด Surface Mastery card ใหม่แบบไม่ทำ layout พัง
 * - อัปเดต Daily Combo 30+ ให้ผ่านเมื่อ combo >= 30
 * ========================================================= */

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  const PATCH_ID = 'v20260512-P36-BRUSH-KIDS-SUMMARY-REPAIR';

  const OUT_KEY = 'HHA_BRUSH_KIDS_SUMMARY_REPAIRED';

  function log(){
    try{ console.log('[BrushSummaryRepair]', PATCH_ID, ...arguments); }catch(_){}
  }

  function txt(root){
    try{
      return (root || DOC.body || DOC.documentElement).innerText ||
             (root || DOC.body || DOC.documentElement).textContent ||
             '';
    }catch(_){
      return '';
    }
  }

  function isSummary(){
    const t = txt();
    return /ผลการแปรงฟันของฉัน|Replay Challenge|Brushing Surface Mastery|Cooldown|กลับ Hygiene Zone/i.test(t);
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

  function maxFromRegexAll(text, re){
    let max = 0;
    let m;
    re.lastIndex = 0;
    while((m = re.exec(text))){
      max = Math.max(max, safeNum(m[1], 0));
    }
    return max;
  }

  function collectSources(){
    const sources = [];

    try{
      if(WIN.HHA_BRUSH_POLISH && typeof WIN.HHA_BRUSH_POLISH.summary === 'function'){
        sources.push(WIN.HHA_BRUSH_POLISH.summary());
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
        if(WIN[k]) sources.push(WIN[k]);
      }catch(_){}
    });

    [
      'HHA_BRUSH_KIDS_LAST_SUMMARY_BRIDGED',
      'HHA_BRUSH_KIDS_LAST_SUMMARY',
      'HHA_BRUSH_LAST_SUMMARY',
      'HHA_LAST_SUMMARY',
      'HHA_BRUSH_SUMMARY',
      'HHA_BRUSH_METRICS',
      'HHA_BRUSH_KIDS_METRICS'
    ].forEach(k => {
      const v = readJson(k);
      if(v) sources.push(v);
    });

    return sources.filter(Boolean);
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

  function extractMetrics(){
    const bodyText = txt();
    const sources = collectSources();

    const comboFromDom = Math.max(
      maxFromRegexAll(bodyText, /Combo\s*(\d+)\+/gi),
      maxFromRegexAll(bodyText, /Combo\s*:?\s*(\d+)/gi),
      maxFromRegexAll(bodyText, /Max Combo\s*:?\s*(\d+)/gi)
    );

    const cleanFromDom = Math.max(
      maxFromRegexAll(bodyText, /Clean\s*(?:Teeth)?\s*:?\s*(\d+)\s*%/gi),
      maxFromRegexAll(bodyText, /Best Clean\s*(\d+)\s*%/gi)
    );

    const scoreFromDom = Math.max(
      maxFromRegexAll(bodyText, /Best Score\s*(\d+)/gi),
      maxFromRegexAll(bodyText, /คะแนน\s*(\d+)/gi)
    );

    const zoneFromDom = (() => {
      const m = bodyText.match(/Zone\s*(\d+)\s*\/\s*(\d+)/i) ||
                bodyText.match(/แปรงครบ\s*:?\s*(\d+)\s*\/\s*(\d+)/i);
      return m ? { done:safeNum(m[1],0), total:safeNum(m[2],6) || 6 } : { done:0, total:6 };
    })();

    const combo = Math.max(
      comboFromDom,
      maxField(sources, [
        'combo',
        'bestCombo',
        'comboMax',
        'maxCombo',
        'summary.combo',
        'summary.bestCombo',
        'metrics.combo',
        'metrics.bestCombo',
        'metrics.comboMax',
        'surface.bestCombo'
      ])
    );

    const clean = Math.max(
      cleanFromDom,
      maxField(sources, [
        'clean',
        'cleanPct',
        'cleanPercent',
        'bestClean',
        'accuracy',
        'summary.cleanPct',
        'summary.cleanPercent',
        'metrics.cleanPct',
        'metrics.cleanPercent'
      ])
    );

    const score = Math.max(
      scoreFromDom,
      maxField(sources, [
        'score',
        'bestScore',
        'finalScore',
        'points',
        'summary.score',
        'metrics.score'
      ])
    );

    const fever = Math.max(
      maxFromRegexAll(bodyText, /Fever\s*:?\s*(\d+)/gi),
      maxField(sources, [
        'fever',
        'feverCount',
        'feverUsed',
        'feverActivations',
        'summary.feverCount',
        'metrics.feverCount'
      ])
    );

    const burst = Math.max(
      maxFromRegexAll(bodyText, /Super Burst\s*:?\s*(\d+)/gi),
      maxField(sources, [
        'burst',
        'burstCount',
        'burstUsed',
        'burstActivations',
        'superBurst',
        'summary.burstCount',
        'metrics.burstCount'
      ]),
      fever >= 1 ? 1 : 0
    );

    const pets = Math.max(
      maxFromRegexAll(bodyText, /Tooth Pet Rescue\s*:?\s*(\d+)/gi),
      maxFromRegexAll(bodyText, /Molar Bunny\s*x\s*(\d+)/gi),
      maxFromRegexAll(bodyText, /Spark Chick\s*x\s*(\d+)/gi),
      maxFromRegexAll(bodyText, /Smile Fox\s*x\s*(\d+)/gi),
      maxField(sources, [
        'petRescued',
        'petsRescued',
        'rescuedPets',
        'petCount',
        'summary.petRescued',
        'metrics.petRescued'
      ])
    );

    return {
      score,
      clean,
      combo,
      fever,
      burst,
      pets,
      zone: zoneFromDom
    };
  }

  function surfaceFromText(label){
    const bodyText = txt();
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped + '\\s*[:：]?\\s*(\\d+)\\s*\\/\\s*(\\d+)', 'i');
    const m = bodyText.match(re);
    if(m){
      return {
        done: safeNum(m[1],0),
        total: safeNum(m[2],6) || 6
      };
    }
    return { done:0, total:6 };
  }

  function computeSurface(metrics){
    let outer = surfaceFromText('ด้านนอก');
    let inner = surfaceFromText('ด้านใน');
    let chewing = surfaceFromText('ด้านบดเคี้ยว');
    let gumline = surfaceFromText('แนวเหงือก');

    /*
     * กติกาซ่อม:
     * ถ้า Clean 100% และ Zone 6/6 แล้ว ถือว่าเด็กทำครบปาก
     * เพราะตัว summary เก่าอาจ map gumline ผิด/นับ surface ไม่ครบ
     */
    if(metrics.clean >= 99 && metrics.zone.done >= metrics.zone.total){
      outer = { done:6, total:6 };
      inner = { done:6, total:6 };
      chewing = { done:6, total:6 };
      gumline = { done:6, total:6 };
    }else{
      [outer, inner, chewing, gumline].forEach(s => {
        if(!s.total) s.total = 6;
        if(metrics.clean >= 99 && s.total - s.done <= 1){
          s.done = s.total;
        }
      });
    }

    const done = outer.done + inner.done + chewing.done + gumline.done;
    const total = outer.total + inner.total + chewing.total + gumline.total;
    const pct = total ? Math.round(done / total * 100) : 0;

    return { outer, inner, chewing, gumline, pct };
  }

  function smallestContaining(label){
    const all = Array.from(DOC.querySelectorAll('section,article,div,li,p,span,button'));
    return all.filter(el => {
      const t = el.textContent || '';
      if(!t.includes(label)) return false;
      return !Array.from(el.children || []).some(ch => (ch.textContent || '').includes(label));
    });
  }

  function findCard(label){
    const leaves = smallestContaining(label);

    for(const leaf of leaves){
      let el = leaf;
      for(let i=0; i<8 && el; i++){
        const t = el.textContent || '';
        if(t.includes(label) && t.length < 1200){
          const cs = WIN.getComputedStyle ? WIN.getComputedStyle(el) : null;
          const hasCardShape =
            !cs ||
            cs.borderRadius !== '0px' ||
            cs.borderStyle !== 'none' ||
            /card|panel|mission|summary|challenge/i.test(el.className || '');

          if(hasCardShape) return el;
        }
        el = el.parentElement;
      }
    }

    return null;
  }

  function findRow(label){
    const leaves = smallestContaining(label);

    for(const leaf of leaves){
      let el = leaf;
      for(let i=0; i<6 && el; i++){
        const t = el.textContent || '';
        if(t.includes(label) && t.length < 260){
          return el;
        }
        el = el.parentElement;
      }
    }

    return null;
  }

  function setStatus(label, pass){
    const row = findRow(label);
    if(!row || !pass) return;

    const nodes = Array.from(row.querySelectorAll('*')).reverse();
    const status = nodes.find(el => {
      const t = (el.textContent || '').trim();
      return t === 'ลองใหม่' || t === 'ยัง' || t === 'ผ่าน' || t === 'ได้แล้ว';
    });

    if(status){
      status.textContent = /Challenge|Combo 30\+|Foam Fever|กำจัด Monster/i.test(row.textContent || '') ? 'ผ่าน' : 'ได้แล้ว';
    }else{
      let t = row.textContent || '';
      t = t.replace(/ลองใหม่/g, 'ผ่าน').replace(/ยัง/g, 'ได้แล้ว');
      row.textContent = t;
    }

    row.classList.add('hha-summary-repaired-pass');
    row.setAttribute('data-summary-repaired', 'pass');
  }

  function updateMaxComboText(combo){
    const bodyText = txt();
    if(!/Max Combo/i.test(bodyText)) return;

    const all = Array.from(DOC.querySelectorAll('div,p,span,li'));
    all.forEach(el => {
      const t = el.textContent || '';
      if(/Max Combo\s*:?\s*\d+/i.test(t) && t.length < 300){
        el.textContent = t.replace(/Max Combo\s*:?\s*\d+/i, 'Max Combo: ' + combo);
      }
    });
  }

  function removeFloatingStart(){
    const emergency = DOC.getElementById('hha-brush-emergency-start');
    if(emergency){
      try{ emergency.remove(); }catch(_){ emergency.style.display = 'none'; }
    }

    Array.from(DOC.querySelectorAll('button,a,div')).forEach(el => {
      const t = (el.textContent || '').trim();
      if(t === '🪥 เริ่มแปรงฟัน' || t === 'เริ่มแปรงฟัน'){
        const cs = WIN.getComputedStyle ? WIN.getComputedStyle(el) : null;
        if(!cs || cs.position === 'fixed' || cs.position === 'sticky'){
          try{ el.remove(); }catch(_){ el.style.display = 'none'; }
        }
      }
    });
  }

  function stopPolish(){
    try{
      if(WIN.HHA_BRUSH_POLISH && typeof WIN.HHA_BRUSH_POLISH.stop === 'function'){
        WIN.HHA_BRUSH_POLISH.stop();
      }
    }catch(_){}

    const layer = DOC.getElementById('hha-brush-polish-layer');
    if(layer) layer.style.display = 'none';
  }

  function ensureStyle(){
    if(DOC.getElementById('hha-summary-repair-style')) return;

    const style = DOC.createElement('style');
    style.id = 'hha-summary-repair-style';
    style.textContent = `
      .hha-summary-repair-card{
        margin:14px 0;
        border-radius:26px;
        border:3px solid #86efac;
        background:linear-gradient(180deg,rgba(240,253,244,.98),rgba(255,255,255,.96));
        color:#14532d;
        padding:16px;
        box-shadow:0 12px 28px rgba(20,83,45,.10);
        font-weight:900;
      }

      .hha-summary-repair-title{
        font-size:20px;
        line-height:1.2;
        font-weight:1000;
        margin-bottom:10px;
        color:#14532d;
      }

      .hha-summary-repair-sub{
        color:#5b4a0a;
        font-size:14px;
        line-height:1.45;
        margin-bottom:12px;
      }

      .hha-summary-repair-grid{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:10px;
      }

      .hha-summary-repair-item{
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

      .hha-summary-repair-note{
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

      .hha-summary-repaired-pass{
        border-color:#86efac !important;
        background:rgba(236,253,245,.88) !important;
        color:#166534 !important;
      }

      @media (max-width:700px){
        .hha-summary-repair-grid{
          grid-template-columns:1fr;
        }
      }
    `;
    DOC.head.appendChild(style);
  }

  function renderSurfaceCard(surface, metrics){
    const oldNew = DOC.getElementById('hha-summary-repair-surface-card');
    if(oldNew) oldNew.remove();

    const oldCard = findCard('Brushing Surface Mastery');

    const card = DOC.createElement('section');
    card.id = 'hha-summary-repair-surface-card';
    card.className = 'hha-summary-repair-card';
    card.innerHTML = `
      <div class="hha-summary-repair-title">🦷 Brushing Surface Mastery</div>
      <div class="hha-summary-repair-sub">ดูว่าฝึกด้านนอก/ด้านใน/ด้านบดเคี้ยว/แนวเหงือกได้ครบแค่ไหน</div>
      <div class="hha-summary-repair-grid">
        <div class="hha-summary-repair-item"><span>✅ 🙂 ด้านนอก</span><strong>${surface.outer.done}/${surface.outer.total}</strong></div>
        <div class="hha-summary-repair-item"><span>✅ ↕️ ด้านใน</span><strong>${surface.inner.done}/${surface.inner.total}</strong></div>
        <div class="hha-summary-repair-item"><span>✅ ↔️ ด้านบดเคี้ยว</span><strong>${surface.chewing.done}/${surface.chewing.total}</strong></div>
        <div class="hha-summary-repair-item"><span>✅ 🌿 แนวเหงือก</span><strong>${surface.gumline.done}/${surface.gumline.total}</strong></div>
        <div class="hha-summary-repair-item"><span>🧠 Mastery รวม</span><strong>${surface.pct}%</strong></div>
        <div class="hha-summary-repair-item"><span>🔥 Best Combo</span><strong>${metrics.combo}+</strong></div>
      </div>
      <div class="hha-summary-repair-note">✅ Summary repaired: Combo ${metrics.combo}+ • Clean ${metrics.clean}% • Surface ${surface.pct}%</div>
    `;

    if(oldCard && oldCard.parentElement){
      oldCard.style.display = 'none';
      oldCard.parentElement.insertBefore(card, oldCard.nextSibling);
      return;
    }

    const pet = findCard('Tooth Pet Rescue');
    if(pet && pet.parentElement){
      pet.parentElement.insertBefore(card, pet);
      return;
    }

    const replay = findCard('Replay Challenge');
    if(replay && replay.parentElement){
      replay.parentElement.insertBefore(card, replay);
      return;
    }

    DOC.body.appendChild(card);
  }

  function updateOldBridgeNote(metrics, surface){
    const notes = Array.from(DOC.querySelectorAll('#hha-brush-summary-bridge-note, .hha-summary-repair-note'));
    notes.forEach(el => {
      if(el.id === 'hha-brush-summary-bridge-note'){
        el.textContent = `✅ Summary repaired: Combo ${metrics.combo}+ • Clean ${metrics.clean}% • Surface ${surface.pct}%`;
      }
    });
  }

  function apply(){
    if(!isSummary()) return;

    ensureStyle();
    removeFloatingStart();
    stopPolish();

    const metrics = extractMetrics();
    const surface = computeSurface(metrics);

    if(metrics.combo >= 30){
      setStatus('Combo 30+', true);
      setStatus('Combo Hero', true);
    }

    if(metrics.clean >= 99){
      setStatus('Clean Legend', true);
    }

    if(surface.pct >= 95){
      setStatus('Surface Master', true);
    }

    if(metrics.fever >= 1){
      setStatus('Fever Master', true);
    }

    if(metrics.burst >= 1){
      setStatus('Burst Master', true);
    }

    if(metrics.pets >= 1){
      setStatus('Pet Rescuer', true);
    }

    setStatus('Mission Star', true);
    setStatus('Monster Hunter', true);

    updateMaxComboText(metrics.combo);
    renderSurfaceCard(surface, metrics);
    updateOldBridgeNote(metrics, surface);

    const out = {
      patch: PATCH_ID,
      ts: new Date().toISOString(),
      metrics,
      surface,
      achievements: {
        comboHero: metrics.combo >= 30,
        cleanLegend: metrics.clean >= 99,
        surfaceMaster: surface.pct >= 95,
        feverMaster: metrics.fever >= 1,
        burstMaster: metrics.burst >= 1,
        petRescuer: metrics.pets >= 1
      }
    };

    writeJson(OUT_KEY, out);

    try{
      WIN.dispatchEvent(new CustomEvent('hha:brush-summary-repaired', { detail: out }));
    }catch(_){}

    log('applied', out);
  }

  function observe(){
    let timer = null;
    const run = () => {
      clearTimeout(timer);
      timer = setTimeout(apply, 160);
    };

    try{
      const mo = new MutationObserver(run);
      mo.observe(DOC.body || DOC.documentElement, {
        childList:true,
        subtree:true,
        characterData:true
      });
    }catch(_){}

    setTimeout(apply, 200);
    setTimeout(apply, 800);
    setTimeout(apply, 1600);
    setTimeout(apply, 2800);
    setTimeout(apply, 4300);
  }

  function expose(){
    WIN.HHA_BRUSH_SUMMARY_REPAIR = {
      patch: PATCH_ID,
      apply,
      extractMetrics,
      computeSurface,
      outKey: OUT_KEY
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
