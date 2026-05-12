/* =========================================================
 * HeroHealth Brush Kids
 * /herohealth/vr-brush-kids/brush.summary-bridge.js
 * PATCH v20260512-P35-BRUSH-KIDS-SUMMARY-METRIC-BRIDGE
 *
 * Purpose:
 * - รวม metric จาก core game + polish + localStorage + DOM summary
 * - แก้ achievement ที่ไม่ปลดล็อกเพราะ field ไม่ตรงกัน
 * - แก้ surface mastery เช่น gumline 5/6 ทั้งที่ clean 100%
 * - หยุด polish targets เมื่อเข้าหน้า summary
 * ========================================================= */

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  const PATCH_ID = 'v20260512-P35-BRUSH-KIDS-SUMMARY-METRIC-BRIDGE';

  const LS_OUT = 'HHA_BRUSH_KIDS_LAST_SUMMARY_BRIDGED';

  const LS_KEYS = [
    'HHA_BRUSH_KIDS_LAST_SUMMARY',
    'HHA_BRUSH_LAST_SUMMARY',
    'HHA_LAST_SUMMARY',
    'HHA_BRUSH_SUMMARY',
    'HHA_BRUSH_METRICS',
    'HHA_BRUSH_KIDS_METRICS'
  ];

  const THRESHOLDS = {
    comboHero: 30,
    cleanLegend: 99,
    surfaceMaster: 95,
    feverMaster: 1,
    burstMaster: 1,
    petRescuer: 1
  };

  function log(){
    try{ console.log('[BrushSummaryBridge]', PATCH_ID, ...arguments); }catch(_){}
  }

  function safeNum(v, d){
    const n = Number(v);
    return Number.isFinite(n) ? n : (d || 0);
  }

  function maxNum(){
    let out = 0;
    for(let i=0; i<arguments.length; i++){
      const n = safeNum(arguments[i], 0);
      if(n > out) out = n;
    }
    return out;
  }

  function safeJson(text){
    try{
      if(!text) return null;
      return JSON.parse(text);
    }catch(_){
      return null;
    }
  }

  function localGet(k){
    try{ return localStorage.getItem(k); }catch(_){ return null; }
  }

  function localSet(k, v){
    try{ localStorage.setItem(k, JSON.stringify(v)); }catch(_){}
  }

  function deepGet(obj, path){
    try{
      return String(path).split('.').reduce((o,k)=>o && o[k], obj);
    }catch(_){
      return undefined;
    }
  }

  function anyValue(obj, keys){
    if(!obj) return undefined;
    for(const k of keys){
      const v = k.indexOf('.') >= 0 ? deepGet(obj, k) : obj[k];
      if(v !== undefined && v !== null && v !== '') return v;
    }
    return undefined;
  }

  function text(){
    try{ return DOC.body ? DOC.body.innerText || DOC.body.textContent || '' : ''; }
    catch(_){ return ''; }
  }

  function isSummaryVisible(){
    const t = text();
    return /Replay Challenge|Brushing Surface Mastery|เล่นอีกครั้ง|Cooldown|กลับ Hygiene Zone|Mastery รวม/i.test(t);
  }

  function parsePercentNear(label){
    const t = text();
    const idx = t.indexOf(label);
    if(idx < 0) return 0;
    const part = t.slice(idx, idx + 180);
    const m = part.match(/(\d+(?:\.\d+)?)\s*%/);
    return m ? safeNum(m[1], 0) : 0;
  }

  function parseBestScore(){
    const t = text();
    const m = t.match(/Best Score\s+(\d+)/i);
    return m ? safeNum(m[1], 0) : 0;
  }

  function parsePlayedRounds(){
    const t = text();
    const m = t.match(/เล่นแล้ว\s+(\d+)\s*รอบ/i);
    return m ? safeNum(m[1], 0) : 0;
  }

  function parseComboFromDom(){
    const t = text();
    const m = t.match(/Combo\s*(\d+)\+/i) || t.match(/Combo\s+(\d+)/i);
    return m ? safeNum(m[1], 0) : 0;
  }

  function hasUnlockedText(label){
    const row = findRow(label);
    if(!row) return false;
    return /ได้แล้ว|✅/.test(row.textContent || '');
  }

  function parseSurface(label){
    const row = findRow(label);
    if(!row) return { done:0, total:6 };

    const raw = row.textContent || '';
    const m = raw.match(/(\d+)\s*\/\s*(\d+)/);
    if(!m) return { done:0, total:6 };

    return {
      done: safeNum(m[1], 0),
      total: safeNum(m[2], 6) || 6
    };
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

    LS_KEYS.forEach(k => {
      const v = safeJson(localGet(k));
      if(v) sources.push(v);
    });

    return sources.filter(Boolean);
  }

  function getMaxFromSources(sources, keys){
    let out = 0;

    sources.forEach(src => {
      keys.forEach(k => {
        const v = anyValue(src, [k]);
        out = Math.max(out, safeNum(v, 0));
      });
    });

    return out;
  }

  function normalizeSurface(sources, cleanPct){
    const surface = {
      outer: parseSurface('ด้านนอก'),
      inner: parseSurface('ด้านใน'),
      chewing: parseSurface('ด้านบดเคี้ยว'),
      gumline: parseSurface('แนวเหงือก')
    };

    sources.forEach(src => {
      const candidates = [
        src.surface,
        src.surfaces,
        src.surfaceMastery,
        src.mastery,
        src.surfaceCounts
      ].filter(Boolean);

      candidates.forEach(s => {
        if(!s) return;

        const map = {
          outer: ['outer','outside','ด้านนอก'],
          inner: ['inner','inside','ด้านใน'],
          chewing: ['chewing','occlusal','bite','ด้านบดเคี้ยว'],
          gumline: ['gumline','gum','gums','แนวเหงือก']
        };

        Object.keys(map).forEach(key => {
          map[key].forEach(name => {
            const raw = s[name];
            if(!raw) return;

            if(typeof raw === 'number'){
              surface[key].done = Math.max(surface[key].done, safeNum(raw, 0));
            }else if(typeof raw === 'object'){
              surface[key].done = Math.max(
                surface[key].done,
                safeNum(raw.done, 0),
                safeNum(raw.clean, 0),
                safeNum(raw.cleaned, 0),
                safeNum(raw.count, 0)
              );
              surface[key].total = Math.max(
                surface[key].total || 6,
                safeNum(raw.total, 6),
                safeNum(raw.max, 6)
              );
            }
          });
        });
      });
    });

    Object.keys(surface).forEach(key => {
      const s = surface[key];

      if(!s.total || s.total < 1) s.total = 6;
      s.done = Math.min(s.total, Math.max(0, s.done));

      /*
       * Bridge rule:
       * ถ้า clean รวมสูงมาก แต่ surface ขาดแค่ 1 จุด
       * ให้ถือว่าเป็น hit-radius mismatch ไม่ใช่เด็กเล่นผิด
       */
      if(cleanPct >= 99 && s.total - s.done <= 1){
        s.done = s.total;
      }
    });

    const totalDone =
      surface.outer.done +
      surface.inner.done +
      surface.chewing.done +
      surface.gumline.done;

    const totalMax =
      surface.outer.total +
      surface.inner.total +
      surface.chewing.total +
      surface.gumline.total;

    const percent = totalMax > 0 ? Math.round((totalDone / totalMax) * 100) : 0;

    return {
      outer: surface.outer,
      inner: surface.inner,
      chewing: surface.chewing,
      gumline: surface.gumline,
      percent
    };
  }

  function normalize(){
    const sources = collectSources();

    let score = maxNum(
      parseBestScore(),
      getMaxFromSources(sources, [
        'score',
        'bestScore',
        'finalScore',
        'points',
        'summary.score',
        'metrics.score'
      ])
    );

    let cleanPct = maxNum(
      parsePercentNear('Best Clean'),
      parsePercentNear('Mastery รวม'),
      getMaxFromSources(sources, [
        'clean',
        'bestClean',
        'cleanPct',
        'cleanPercent',
        'cleanliness',
        'accuracy',
        'summary.cleanPct',
        'summary.cleanPercent',
        'metrics.cleanPct',
        'metrics.cleanPercent'
      ])
    );

    let bestCombo = maxNum(
      parseComboFromDom(),
      getMaxFromSources(sources, [
        'combo',
        'bestCombo',
        'comboMax',
        'maxCombo',
        'summary.combo',
        'summary.bestCombo',
        'metrics.combo',
        'metrics.bestCombo',
        'metrics.comboMax'
      ])
    );

    let feverCount = maxNum(
      getMaxFromSources(sources, [
        'fever',
        'feverCount',
        'feverUsed',
        'feverActivations',
        'summary.feverCount',
        'metrics.feverCount'
      ]),
      hasUnlockedText('Fever Master') ? 1 : 0
    );

    let burstCount = maxNum(
      getMaxFromSources(sources, [
        'burst',
        'burstCount',
        'burstUsed',
        'burstActivations',
        'rainbowBurst',
        'summary.burstCount',
        'metrics.burstCount'
      ]),
      /*
       * ใน Brush Kids ตอนนี้ Fever/Burst เป็นระบบใกล้กัน
       * ถ้า Fever Master ได้แล้ว แต่ Burst ไม่ส่ง field มา ให้ bridge เป็น 1
       */
      feverCount >= 1 ? 1 : 0
    );

    let petRescued = maxNum(
      getMaxFromSources(sources, [
        'petRescued',
        'petsRescued',
        'rescuedPets',
        'petCount',
        'molarBunny',
        'summary.petRescued',
        'metrics.petRescued'
      ]),
      hasUnlockedText('Pet Rescuer') ? 1 : 0
    );

    const playedRounds = maxNum(
      parsePlayedRounds(),
      getMaxFromSources(sources, [
        'played',
        'rounds',
        'playedRounds',
        'attempts',
        'summary.playedRounds'
      ])
    );

    const surface = normalizeSurface(sources, cleanPct);
    cleanPct = Math.max(cleanPct, surface.percent);

    const achievements = {
      stormBlocker: hasUnlockedText('Storm Blocker'),
      monsterHunter: hasUnlockedText('Monster Hunter'),
      feverMaster: feverCount >= THRESHOLDS.feverMaster || hasUnlockedText('Fever Master'),
      comboHero: bestCombo >= THRESHOLDS.comboHero || hasUnlockedText('Combo Hero'),
      cleanLegend: cleanPct >= THRESHOLDS.cleanLegend || hasUnlockedText('Clean Legend'),
      missionStar: score > 0 && cleanPct >= 80 || hasUnlockedText('Mission Star'),
      petRescuer: petRescued >= THRESHOLDS.petRescuer || hasUnlockedText('Pet Rescuer'),
      surfaceMaster: surface.percent >= THRESHOLDS.surfaceMaster || hasUnlockedText('Surface Master'),
      burstMaster: burstCount >= THRESHOLDS.burstMaster || hasUnlockedText('Burst Master')
    };

    return {
      patch: PATCH_ID,
      ts: new Date().toISOString(),
      score,
      cleanPct: Math.round(cleanPct),
      bestCombo,
      feverCount,
      burstCount,
      petRescued,
      playedRounds,
      surface,
      achievements
    };
  }

  function smallestElementsContaining(label){
    const all = Array.from(DOC.querySelectorAll('div,span,p,li,button,article,section'));
    return all.filter(el => {
      const t = el.textContent || '';
      if(!t.includes(label)) return false;
      return !Array.from(el.children || []).some(ch => (ch.textContent || '').includes(label));
    });
  }

  function findRow(label){
    const labels = smallestElementsContaining(label);

    for(const leaf of labels){
      let el = leaf;
      for(let i=0; i<7 && el; i++){
        const t = el.textContent || '';
        if(
          t.includes(label) &&
          (
            /ยัง|ได้แล้ว|✅|⭐|\d+\s*\/\s*\d+|\d+\s*%/.test(t)
          ) &&
          t.length < 220
        ){
          return el;
        }
        el = el.parentElement;
      }
    }

    const all = Array.from(DOC.querySelectorAll('div,span,p,li,button,article'));
    return all.find(el => {
      const t = el.textContent || '';
      return t.includes(label) && t.length < 220;
    }) || null;
  }

  function findStatusNode(row){
    if(!row) return null;

    const all = Array.from(row.querySelectorAll('*'));
    return all.reverse().find(el => {
      const t = (el.textContent || '').trim();
      return t === 'ยัง' || t === 'ได้แล้ว';
    }) || null;
  }

  function markUnlocked(label, unlocked){
    if(!unlocked) return;

    const row = findRow(label);
    if(!row) return;

    const status = findStatusNode(row);

    if(status){
      status.textContent = 'ได้แล้ว';
    }else{
      const before = row.textContent || '';
      if(before.includes('ยัง')){
        row.textContent = before.replace(/ยัง/g, 'ได้แล้ว');
      }
    }

    row.classList.add('hha-bridge-unlocked');
    row.setAttribute('data-bridge-unlocked', '1');
  }

  function updateSurfaceRow(label, item){
    const row = findRow(label);
    if(!row || !item) return;

    const done = safeNum(item.done, 0);
    const total = safeNum(item.total, 6) || 6;
    const text = row.textContent || '';

    if(/\d+\s*\/\s*\d+/.test(text)){
      row.textContent = text.replace(/\d+\s*\/\s*\d+/, `${done}/${total}`);
    }

    row.classList.toggle('hha-bridge-unlocked', done >= total);
    row.setAttribute('data-bridge-surface', done >= total ? 'complete' : 'partial');
  }

  function updatePercentRow(label, percent){
    const row = findRow(label);
    if(!row) return;

    const t = row.textContent || '';
    if(/\d+\s*%/.test(t)){
      row.textContent = t.replace(/\d+\s*%/, `${Math.round(percent)}%`);
    }

    row.classList.toggle('hha-bridge-unlocked', percent >= THRESHOLDS.surfaceMaster);
  }

  function addBridgeNote(summary){
    if(DOC.getElementById('hha-brush-summary-bridge-note')) return;

    const anchor = findRow('Replay Challenge') || findRow('Brushing Surface Mastery');
    if(!anchor) return;

    const note = DOC.createElement('div');
    note.id = 'hha-brush-summary-bridge-note';
    note.textContent = `✅ Summary checked: Combo ${summary.bestCombo}+ • Clean ${summary.cleanPct}% • Surface ${summary.surface.percent}%`;
    note.style.cssText = [
      'margin:12px 0',
      'padding:10px 12px',
      'border-radius:18px',
      'background:rgba(236,253,245,.96)',
      'border:2px solid rgba(134,239,172,.9)',
      'color:#14532d',
      'font-weight:1000',
      'font-size:13px',
      'text-align:center'
    ].join(';');

    try{
      anchor.parentElement.insertBefore(note, anchor.nextSibling);
    }catch(_){}
  }

  function ensureStyle(){
    if(DOC.getElementById('hha-brush-summary-bridge-style')) return;

    const style = DOC.createElement('style');
    style.id = 'hha-brush-summary-bridge-style';
    style.textContent = `
      .hha-bridge-unlocked{
        border-color:#86efac !important;
        background:rgba(236,253,245,.82) !important;
        color:#166534 !important;
      }

      [data-bridge-surface="complete"]{
        border-color:#86efac !important;
        background:rgba(236,253,245,.82) !important;
      }

      [data-bridge-surface="partial"]{
        border-color:#fde68a !important;
        background:rgba(255,251,235,.82) !important;
      }
    `;
    DOC.head.appendChild(style);
  }

  function stopPolishOnSummary(){
    if(!isSummaryVisible()) return;

    try{
      if(WIN.HHA_BRUSH_POLISH && typeof WIN.HHA_BRUSH_POLISH.stop === 'function'){
        WIN.HHA_BRUSH_POLISH.stop();
      }
    }catch(_){}

    const layer = DOC.getElementById('hha-brush-polish-layer');
    if(layer){
      try{ layer.style.display = 'none'; }catch(_){}
    }
  }

  function apply(){
    if(!isSummaryVisible()) return null;

    ensureStyle();
    stopPolishOnSummary();

    const summary = normalize();

    updateSurfaceRow('ด้านนอก', summary.surface.outer);
    updateSurfaceRow('ด้านใน', summary.surface.inner);
    updateSurfaceRow('ด้านบดเคี้ยว', summary.surface.chewing);
    updateSurfaceRow('แนวเหงือก', summary.surface.gumline);
    updatePercentRow('Mastery รวม', summary.surface.percent);

    markUnlocked('Fever Master', summary.achievements.feverMaster);
    markUnlocked('Combo Hero', summary.achievements.comboHero);
    markUnlocked('Clean Legend', summary.achievements.cleanLegend);
    markUnlocked('Mission Star', summary.achievements.missionStar);
    markUnlocked('Pet Rescuer', summary.achievements.petRescuer);
    markUnlocked('Surface Master', summary.achievements.surfaceMaster);
    markUnlocked('Burst Master', summary.achievements.burstMaster);

    localSet(LS_OUT, summary);

    try{
      WIN.dispatchEvent(new CustomEvent('hha:brush-summary-bridged', {
        detail: summary
      }));
    }catch(_){}

    addBridgeNote(summary);

    log('applied', summary);
    return summary;
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
        characterData:true
      });
    }catch(_){}

    setTimeout(apply, 250);
    setTimeout(apply, 900);
    setTimeout(apply, 1800);
    setTimeout(apply, 3200);
  }

  function expose(){
    WIN.HHA_BRUSH_SUMMARY_BRIDGE = Object.assign({}, WIN.HHA_BRUSH_SUMMARY_BRIDGE || {}, {
      patch: PATCH_ID,
      thresholds: THRESHOLDS,
      collectSources,
      normalize,
      apply,
      outKey: LS_OUT
    });
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
