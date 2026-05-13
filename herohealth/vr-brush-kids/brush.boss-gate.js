/* =========================================================
 * HeroHealth Brush Kids
 * /herohealth/vr-brush-kids/brush.boss-gate.js
 * PATCH v20260513-P44-BRUSH-KIDS-REAL-BOSS-GATE
 *
 * Purpose:
 * - ทำให้บอสมีเงื่อนไขชนะ/แพ้จริง
 * - ไม่ให้ Clean 100% อย่างเดียวปลดล็อกชนะบอสอัตโนมัติ
 * - คำนวณ Boss Outcome จากหลาย metric
 * - ส่งผลให้ summary/compact summary ใช้ boss result ที่ยุติธรรมกว่า
 * ========================================================= */

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  const PATCH_ID = 'v20260513-P44-BRUSH-KIDS-REAL-BOSS-GATE';
  const OUT_KEY = 'HHA_BRUSH_KIDS_BOSS_GATE';

  function text(root){
    try{
      const r = root || DOC.body || DOC.documentElement;
      return r.innerText || r.textContent || '';
    }catch(_){
      return '';
    }
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

  function firstRegex(t, re, fallback){
    const m = t.match(re);
    return m ? safeNum(m[1], fallback || 0) : (fallback || 0);
  }

  function readJson(key){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }catch(_){
      return null;
    }
  }

  function writeJson(key, value){
    try{
      localStorage.setItem(key, JSON.stringify(value));
    }catch(_){}
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

    [
      'HHA_BRUSH_KIDS_SUMMARY_FINAL',
      'HHA_BRUSH_KIDS_SUMMARY_COMPACT',
      'HHA_BRUSH_KIDS_SUMMARY_COMPACT_OVERRIDE',
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

    try{
      if(WIN.HHA_BRUSH_POLISH && typeof WIN.HHA_BRUSH_POLISH.summary === 'function'){
        list.push(WIN.HHA_BRUSH_POLISH.summary());
      }
    }catch(_){}

    return list.filter(Boolean);
  }

  function isSummary(){
    const t = text();

    const hasSummary =
      /ผลการแปรงฟันของฉัน|Clean Teeth|Replay Challenge|Best Score|Best Clean|Tooth Pet Rescue/i.test(t);

    const isPrep =
      /พร้อมแปรงฟัน|พร้อมแล้ว ไปเล่นจริง|Prep|ลายยาสีฟัน|ยังไม่ได้ใส่ยาสีฟัน/i.test(t);

    return hasSummary && !isPrep;
  }

  function difficulty(){
    const d = String(param('diff', 'normal')).toLowerCase();
    if(['easy','normal','hard','challenge'].includes(d)) return d;
    return 'normal';
  }

  function thresholds(){
    const diff = difficulty();

    const table = {
      easy: {
        clean: 75,
        zone: 4,
        combo: 10,
        bossHits: 14,
        monsters: 4,
        stormBlocked: 1,
        maxMiss: 8,
        label: 'Easy Boss'
      },
      normal: {
        clean: 85,
        zone: 5,
        combo: 20,
        bossHits: 22,
        monsters: 6,
        stormBlocked: 2,
        maxMiss: 6,
        label: 'Normal Boss'
      },
      hard: {
        clean: 90,
        zone: 5,
        combo: 30,
        bossHits: 28,
        monsters: 8,
        stormBlocked: 2,
        maxMiss: 4,
        label: 'Hard Boss'
      },
      challenge: {
        clean: 95,
        zone: 6,
        combo: 40,
        bossHits: 34,
        monsters: 10,
        stormBlocked: 3,
        maxMiss: 3,
        label: 'Challenge Boss'
      }
    };

    return table[diff] || table.normal;
  }

  function extractMetrics(){
    const t = text();
    const sources = collectSources();

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
        'summary.cleanPct'
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
        'summary.bestCombo'
      ])
    );

    const zoneMatch =
      t.match(/Zone\s*[\r\n\s]*([0-9]+)\s*\/\s*([0-9]+)/i) ||
      t.match(/แปรงครบ\s*:?\s*([0-9]+)\s*\/\s*([0-9]+)/i);

    const zoneDone = Math.max(
      zoneMatch ? safeNum(zoneMatch[1], 0) : 0,
      maxField(sources, [
        'zoneDone',
        'metrics.zoneDone',
        'summary.zoneDone'
      ]),
      clean >= 99 ? 6 : 0
    );

    const zoneTotal = Math.max(
      zoneMatch ? safeNum(zoneMatch[2], 6) : 6,
      maxField(sources, [
        'zoneTotal',
        'metrics.zoneTotal',
        'summary.zoneTotal'
      ]),
      6
    );

    const bossHits = Math.max(
      maxRegex(t, /Boss Battle\s*:\s*Brush Hits\s*([0-9]+)/gi),
      maxRegex(t, /Brush Hits\s*([0-9]+)/gi),
      maxField(sources, [
        'bossHits',
        'brushHits',
        'bossBrushHits',
        'metrics.bossHits',
        'metrics.brushHits',
        'summary.bossHits'
      ])
    );

    const monsters = Math.max(
      maxRegex(t, /Monsters Hit\s*:\s*([0-9]+)/gi),
      maxRegex(t, /Monsters Hit\s*([0-9]+)/gi),
      maxRegex(t, /กำจัด Monster\s*([0-9]+)/gi),
      maxField(sources, [
        'monsters',
        'monstersHit',
        'monsterHits',
        'metrics.monstersHit',
        'summary.monstersHit'
      ])
    );

    const fever = Math.max(
      maxRegex(t, /Fever\s*:\s*([0-9]+)/gi),
      maxRegex(t, /Fever\s*([0-9]+)/gi),
      maxField(sources, [
        'fever',
        'feverCount',
        'metrics.fever',
        'metrics.feverCount'
      ])
    );

    const stormHit = Math.max(
      firstRegex(t, /Cavity Storm\s*:\s*โดน\s*([0-9]+)/i, 0),
      maxField(sources, [
        'stormHit',
        'cavityStormHit',
        'metrics.stormHit'
      ])
    );

    const stormBlocked = Math.max(
      firstRegex(t, /Cavity Storm\s*:\s*โดน\s*[0-9]+\s*•\s*กันได้\s*([0-9]+)/i, 0),
      firstRegex(t, /กันได้\s*([0-9]+)/i, 0),
      maxField(sources, [
        'stormBlocked',
        'cavityStormBlocked',
        'blockedStorm',
        'metrics.stormBlocked'
      ])
    );

    const misses = Math.max(
      firstRegex(t, /Boss\s*:\s*ชนะแล้ว\s*•\s*พลาด\s*([0-9]+)/i, 0),
      firstRegex(t, /Boss\s*:\s*แพ้\s*•\s*พลาด\s*([0-9]+)/i, 0),
      firstRegex(t, /พลาด\s*([0-9]+)/i, 0),
      maxField(sources, [
        'miss',
        'misses',
        'bossMiss',
        'metrics.miss',
        'metrics.misses'
      ])
    );

    return {
      clean,
      combo,
      zoneDone,
      zoneTotal,
      bossHits,
      monsters,
      fever,
      stormHit,
      stormBlocked,
      misses
    };
  }

  function judge(metrics){
    const th = thresholds();

    const checks = {
      clean: metrics.clean >= th.clean,
      zone: metrics.zoneDone >= th.zone,
      combo: metrics.combo >= th.combo,
      bossHits: metrics.bossHits >= th.bossHits,
      monsters: metrics.monsters >= th.monsters,
      stormBlocked: metrics.stormBlocked >= th.stormBlocked,
      misses: metrics.misses <= th.maxMiss
    };

    const passedCount = Object.keys(checks).filter(k => checks[k]).length;

    /*
     * Boss win rule:
     * ต้องผ่าน core checks สำคัญ และผ่านอย่างน้อย 6/7 เงื่อนไข
     */
    const corePass =
      checks.clean &&
      checks.zone &&
      checks.bossHits &&
      checks.monsters;

    const win =
      corePass &&
      passedCount >= 6;

    let stars = 1;
    if(win && metrics.clean >= 95 && metrics.combo >= th.combo && metrics.misses <= Math.max(2, th.maxMiss - 2)){
      stars = 3;
    }else if(win){
      stars = 2;
    }else if(metrics.clean >= 70 && metrics.zoneDone >= 4){
      stars = 1;
    }else{
      stars = 0;
    }

    const reasons = [];

    if(!checks.clean) reasons.push(`Clean ต้องได้อย่างน้อย ${th.clean}%`);
    if(!checks.zone) reasons.push(`ต้องแปรงอย่างน้อย ${th.zone}/${metrics.zoneTotal || 6} โซน`);
    if(!checks.combo) reasons.push(`ต้องทำ Combo อย่างน้อย ${th.combo}+`);
    if(!checks.bossHits) reasons.push(`ต้อง Brush Hits ใส่บอสอย่างน้อย ${th.bossHits}`);
    if(!checks.monsters) reasons.push(`ต้องกำจัด Monster อย่างน้อย ${th.monsters} ตัว`);
    if(!checks.stormBlocked) reasons.push(`ต้องกัน Cavity Storm อย่างน้อย ${th.stormBlocked} ครั้ง`);
    if(!checks.misses) reasons.push(`พลาดได้ไม่เกิน ${th.maxMiss} ครั้ง`);

    let childTip = 'เก่งมาก! ฟันสะอาดขึ้นเยอะเลย';
    if(win && stars >= 3){
      childTip = 'สุดยอด! ชนะบอสแบบฟันสะอาดมาก';
    }else if(win){
      childTip = 'ชนะบอสแล้ว! ครั้งหน้าลองทำคอมโบให้ยาวขึ้นนะ';
    }else if(!checks.stormBlocked){
      childTip = 'เกือบแล้ว! ครั้งหน้าลองกัน Cavity Storm ให้ได้มากขึ้นนะ';
    }else if(!checks.monsters){
      childTip = 'เกือบแล้ว! ครั้งหน้าช่วยกำจัด Monster ให้มากขึ้นนะ';
    }else if(!checks.combo){
      childTip = 'เกือบแล้ว! ลองแปรงต่อเนื่องเพื่อทำ Combo ให้มากขึ้นนะ';
    }else{
      childTip = 'เกือบแล้ว! ลองแปรงให้ครบทุกโซนและเล็งบอสให้มากขึ้นนะ';
    }

    return {
      patch: PATCH_ID,
      diff: difficulty(),
      thresholds: th,
      checks,
      passedCount,
      win,
      stars,
      reasons,
      childTip
    };
  }

  function result(){
    const metrics = extractMetrics();
    const outcome = judge(metrics);

    const out = {
      patch: PATCH_ID,
      ts: new Date().toISOString(),
      metrics,
      outcome
    };

    writeJson(OUT_KEY, out);

    try{
      WIN.dispatchEvent(new CustomEvent('hha:brush-boss-gate', {
        detail: out
      }));
    }catch(_){}

    return out;
  }

  function ensureStyle(){
    if(DOC.getElementById('hha-brush-boss-gate-style')) return;

    const style = DOC.createElement('style');
    style.id = 'hha-brush-boss-gate-style';
    style.textContent = `
      #hha-brush-boss-gate-card{
        margin:12px 0;
        border-radius:22px;
        border:3px solid #bdf4ff;
        background:linear-gradient(180deg,#ffffff,#f0fdff);
        padding:14px;
        color:#17384f;
        font-weight:900;
      }

      #hha-brush-boss-gate-card.win{
        border-color:#86efac;
        background:linear-gradient(180deg,#f0fdf4,#ffffff);
        color:#14532d;
      }

      #hha-brush-boss-gate-card.lose{
        border-color:#fde68a;
        background:linear-gradient(180deg,#fffbeb,#ffffff);
        color:#6b4f00;
      }

      .hha-boss-gate-title{
        font-size:20px;
        font-weight:1000;
        margin-bottom:8px;
      }

      .hha-boss-gate-grid{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:8px;
        margin-top:10px;
      }

      .hha-boss-gate-item{
        border-radius:16px;
        border:2px solid rgba(189,244,255,.9);
        background:#fff;
        padding:8px 10px;
        display:flex;
        justify-content:space-between;
        gap:10px;
        font-weight:1000;
      }

      .hha-boss-gate-tip{
        margin-top:10px;
        border-radius:16px;
        background:#fff;
        border:2px dashed #bdf4ff;
        padding:10px;
      }

      @media (max-width:720px){
        .hha-boss-gate-grid{
          grid-template-columns:1fr;
        }
      }
    `;
    DOC.head.appendChild(style);
  }

  function findInsertAnchor(){
    const selectors = [
      '#hha-brush-compact-override-card',
      '#hha-brush-compact-card',
      '#hha-brush-summary-final-card'
    ];

    for(const sel of selectors){
      const el = DOC.querySelector(sel);
      if(el) return el;
    }

    const all = Array.from(DOC.querySelectorAll('section,article,div'));
    return all.find(el => {
      const t = text(el);
      return /ผลการแปรงฟันของฉัน/.test(t) && t.length < 1800;
    }) || DOC.body;
  }

  function render(){
    if(!isSummary()) return;

    const out = result();
    const metrics = out.metrics;
    const outcome = out.outcome;
    const th = outcome.thresholds;

    ensureStyle();

    let card = DOC.getElementById('hha-brush-boss-gate-card');

    if(!card){
      card = DOC.createElement('section');
      card.id = 'hha-brush-boss-gate-card';

      const anchor = findInsertAnchor();

      if(anchor && anchor.parentElement && anchor !== DOC.body){
        anchor.parentElement.insertBefore(card, anchor.nextSibling);
      }else{
        DOC.body.appendChild(card);
      }
    }

    card.className = outcome.win ? 'win' : 'lose';

    const status = outcome.win ? 'ชนะบอสแล้ว!' : 'ยังไม่ชนะบอส';
    const icon = outcome.win ? '👑🪥' : '🦷⚡';
    const starText = outcome.stars > 0 ? '⭐'.repeat(outcome.stars) : 'ลองใหม่';

    card.innerHTML = `
      <div class="hha-boss-gate-title">${icon} Boss Result: ${status}</div>
      <div>ระดับ: <strong>${outcome.diff}</strong> • ดาวบอส: <strong>${starText}</strong></div>

      <div class="hha-boss-gate-grid">
        <div class="hha-boss-gate-item"><span>Clean</span><strong>${metrics.clean}% / ${th.clean}%</strong></div>
        <div class="hha-boss-gate-item"><span>Zone</span><strong>${metrics.zoneDone}/${metrics.zoneTotal} / ${th.zone}+</strong></div>
        <div class="hha-boss-gate-item"><span>Combo</span><strong>${metrics.combo}+ / ${th.combo}+</strong></div>
        <div class="hha-boss-gate-item"><span>Boss Hits</span><strong>${metrics.bossHits} / ${th.bossHits}</strong></div>
        <div class="hha-boss-gate-item"><span>Monsters</span><strong>${metrics.monsters} / ${th.monsters}</strong></div>
        <div class="hha-boss-gate-item"><span>Storm Block</span><strong>${metrics.stormBlocked} / ${th.stormBlocked}</strong></div>
        <div class="hha-boss-gate-item"><span>Miss</span><strong>${metrics.misses} / ≤ ${th.maxMiss}</strong></div>
        <div class="hha-boss-gate-item"><span>ผ่านเงื่อนไข</span><strong>${outcome.passedCount}/7</strong></div>
      </div>

      <div class="hha-boss-gate-tip">💡 ${outcome.childTip}</div>
    `;
  }

  function patchCompactSummary(){
    /*
     * ถ้ามี compact summary อยู่ ให้เปลี่ยน badge/ข้อความให้ใช้ผลบอสจริง
     */
    if(!isSummary()) return;

    const out = result();
    const outcome = out.outcome;

    const compact = DOC.getElementById('hha-brush-compact-override-card') ||
                    DOC.getElementById('hha-brush-compact-card');

    if(!compact) return;

    const badges = Array.from(compact.querySelectorAll('.hha-co-badge,.hha-compact-badge'));

    const bossBadge = badges.find(el => /บอส|Boss/i.test(text(el)));

    if(!bossBadge){
      const badge = DOC.createElement('div');
      badge.className = compact.id === 'hha-brush-compact-override-card' ? 'hha-co-badge' : 'hha-compact-badge';
      badge.innerHTML = `
        <span>${outcome.win ? '👑 ชนะบอส' : '⚡ ท้าทายบอสอีกครั้ง'}</span>
        <strong>${outcome.win ? 'ผ่าน' : 'ลองใหม่'}</strong>
      `;

      const list = compact.querySelector('.hha-co-badges,.hha-compact-badges');
      if(list) list.appendChild(badge);
    }

    const tip = compact.querySelector('.hha-co-tip,.hha-compact-tip');
    if(tip){
      tip.textContent = '💡 ' + outcome.childTip;
    }
  }

  function apply(){
    if(!isSummary()) return;

    result();
    render();
    setTimeout(patchCompactSummary, 120);
    setTimeout(patchCompactSummary, 500);
  }

  function observe(){
    let timer = null;
    const run = () => {
      clearTimeout(timer);
      timer = setTimeout(apply, 140);
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
    setTimeout(apply, 600);
    setTimeout(apply, 1400);
    setTimeout(apply, 2600);
  }

  function expose(){
    WIN.HHA_BRUSH_BOSS_GATE = {
      patch: PATCH_ID,
      result,
      judge,
      extractMetrics,
      thresholds,
      apply
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