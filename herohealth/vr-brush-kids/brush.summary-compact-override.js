/* =========================================================
 * HeroHealth Brush Kids
 * /herohealth/vr-brush-kids/brush.summary-compact-override.js
 * PATCH v20260513-P43-BRUSH-KIDS-COMPACT-OVERRIDE
 *
 * Purpose:
 * - Force child-friendly compact summary
 * - Hide long research/teacher summary panels
 * - Keep only simple score, stars, clean, combo, zone, 3 badges, tip
 * ========================================================= */

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  const PATCH_ID = 'v20260513-P43-BRUSH-KIDS-COMPACT-OVERRIDE';

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

    const hasTitle = /ผลการแปรงฟันของฉัน/i.test(t);
    const hasEnd = /Clean Teeth\s*:|Replay Challenge|Best Score|Best Clean|เล่นอีกครั้ง|กลับ Hygiene Zone|Tooth Pet Rescue/i.test(t);
    const isPrep = /พร้อมแปรงฟัน|พร้อมแล้ว ไปเล่นจริง|ลายยาสีฟัน|Prep|ยังไม่ได้ใส่ยาสีฟัน/i.test(t);

    return hasTitle && hasEnd && !isPrep;
  }

  function n(v, d){
    const x = Number(v);
    return Number.isFinite(x) ? x : (d || 0);
  }

  function maxRegex(t, re){
    let max = 0;
    let m;
    re.lastIndex = 0;
    while((m = re.exec(t))){
      max = Math.max(max, n(m[1], 0));
    }
    return max;
  }

  function readJson(key){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }catch(_){
      return null;
    }
  }

  function metrics(){
    const t = text();
    const p40 = readJson('HHA_BRUSH_KIDS_SUMMARY_FINAL') || {};
    const pm = p40.metrics || {};
    const ps = p40.surface || {};

    const score = Math.max(
      n(pm.score, 0),
      maxRegex(t, /คะแนน\s*[\r\n\s:]*([0-9]+)/gi),
      maxRegex(t, /Best Score\s*[\r\n\s:]*([0-9]+)/gi)
    );

    const combo = Math.max(
      n(pm.combo, 0),
      n(pm.bestCombo, 0),
      maxRegex(t, /Combo\s*[\r\n\s:]*([0-9]+)/gi),
      maxRegex(t, /Max Combo\s*[\r\n\s:]*([0-9]+)/gi),
      maxRegex(t, /Best Combo\s*[\r\n\s:]*([0-9]+)/gi)
    );

    const clean = Math.max(
      n(pm.clean, 0),
      n(pm.cleanPct, 0),
      maxRegex(t, /Clean\s*[\r\n\s:]*([0-9]+)\s*%/gi),
      maxRegex(t, /Clean Teeth\s*[\r\n\s:]*([0-9]+)\s*%/gi),
      maxRegex(t, /Best Clean\s*[\r\n\s:]*([0-9]+)\s*%/gi)
    );

    const zoneMatch =
      t.match(/Zone\s*[\r\n\s]*([0-9]+)\s*\/\s*([0-9]+)/i) ||
      t.match(/แปรงครบ\s*:?\s*([0-9]+)\s*\/\s*([0-9]+)/i);

    const zoneDone = Math.max(
      n(pm.zoneDone, 0),
      zoneMatch ? n(zoneMatch[1], 0) : 0,
      clean >= 99 ? 6 : 0
    );

    const zoneTotal = Math.max(
      n(pm.zoneTotal, 6),
      zoneMatch ? n(zoneMatch[2], 6) : 6,
      6
    );

    let surface = Math.max(
      n(ps.pct, 0),
      n(pm.surfacePct, 0),
      maxRegex(t, /Surface Mastery\s*[\r\n\s:]*([0-9]+)\s*%/gi),
      maxRegex(t, /Mastery รวม\s*[\r\n\s:]*([0-9]+)\s*%/gi)
    );

    if(clean >= 99 && zoneDone >= zoneTotal){
      surface = 100;
    }

    return { score, combo, clean, zoneDone, zoneTotal, surface };
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
    if(DOC.getElementById('hha-brush-compact-override-style')) return;

    const style = DOC.createElement('style');
    style.id = 'hha-brush-compact-override-style';
    style.textContent = `
      body.hha-brush-compact-override{
        overflow-x:hidden !important;
        padding-bottom:calc(118px + env(safe-area-inset-bottom,0px)) !important;
      }

      /* ซ่อน summary ยาว/technical เดิม */
      body.hha-brush-compact-override #hha-brush-summary-final-card,
      body.hha-brush-compact-override #hha-summary-mount-rescue-card,
      body.hha-brush-compact-override #hha-summary-restore-card,
      body.hha-brush-compact-override #hha-summary-authority-surface-card,
      body.hha-brush-compact-override #hha-summary-repair-surface-card,
      body.hha-brush-compact-override #hha-brush-summary-bridge-note{
        display:none !important;
        visibility:hidden !important;
        pointer-events:none !important;
      }

      body.hha-brush-compact-override #hha-brush-summary-final-actions-clean,
      body.hha-brush-compact-override #hha-summary-mount-rescue-actions,
      body.hha-brush-compact-override #hha-summary-restore-actions,
      body.hha-brush-compact-override #hha-summary-authority-actions,
      body.hha-brush-compact-override #hha-brush-summary-final-actions{
        display:none !important;
        visibility:hidden !important;
        pointer-events:none !important;
      }

      #hha-brush-compact-override-card{
        width:min(720px,94vw);
        margin:18px auto 132px;
        border-radius:34px;
        border:4px solid #bdf4ff;
        background:
          radial-gradient(circle at 15% 10%,rgba(255,241,118,.25),transparent 28%),
          linear-gradient(180deg,#ffffff,#f0fdff);
        box-shadow:0 22px 58px rgba(23,56,79,.15);
        padding:22px;
        text-align:center;
        color:#17384f;
        font-family:inherit;
      }

      .hha-co-hero{
        font-size:54px;
        line-height:1;
        margin-bottom:6px;
      }

      .hha-co-title{
        margin:0;
        font-size:clamp(32px,5vw,52px);
        font-weight:1000;
        line-height:1.08;
        color:#12324b;
      }

      .hha-co-sub{
        margin:8px 0 16px;
        color:#5f7f92;
        font-size:17px;
        font-weight:900;
      }

      .hha-co-score{
        margin:10px auto 8px;
        width:max-content;
        max-width:100%;
        padding:12px 26px;
        border-radius:28px;
        background:linear-gradient(180deg,#fff7b7,#ffe066);
        color:#5b4200;
        font-size:clamp(50px,9vw,86px);
        font-weight:1000;
        line-height:1;
        box-shadow:0 12px 32px rgba(91,66,0,.12);
      }

      .hha-co-stars{
        font-size:42px;
        line-height:1;
        margin:8px 0 16px;
      }

      .hha-co-metrics{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:10px;
        margin:14px 0;
      }

      .hha-co-pill{
        min-height:74px;
        border-radius:22px;
        border:2px solid #cdeffc;
        background:#fff;
        display:grid;
        align-content:center;
        padding:10px;
      }

      .hha-co-label{
        color:#5f7f92;
        font-size:13px;
        font-weight:1000;
      }

      .hha-co-value{
        color:#12324b;
        font-size:clamp(24px,4vw,36px);
        font-weight:1000;
        line-height:1;
      }

      .hha-co-badges{
        display:grid;
        gap:9px;
        margin-top:14px;
      }

      .hha-co-badge{
        min-height:48px;
        border-radius:18px;
        border:2px solid #bbf7d0;
        background:rgba(236,253,245,.92);
        color:#166534;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        padding:10px 13px;
        font-size:16px;
        font-weight:1000;
      }

      .hha-co-tip{
        margin-top:14px;
        padding:12px 14px;
        border-radius:22px;
        background:#fff;
        border:2px dashed #bdf4ff;
        color:#37566e;
        font-size:15px;
        font-weight:900;
        line-height:1.45;
      }

      #hha-brush-compact-override-actions{
        position:fixed;
        left:50%;
        bottom:calc(10px + env(safe-area-inset-bottom,0px));
        transform:translateX(-50%);
        z-index:999999;
        width:min(94vw,760px);
        display:grid;
        grid-template-columns:1.1fr .9fr 1fr;
        gap:10px;
        padding:10px;
        border-radius:28px;
        background:rgba(255,255,255,.92);
        border:3px solid rgba(189,244,255,.9);
        box-shadow:0 18px 48px rgba(23,56,79,.18);
        backdrop-filter:blur(14px);
      }

      .hha-co-btn{
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

      .hha-co-btn.replay{
        background:linear-gradient(180deg,#fff2a8,#ffd84d);
        color:#5b4200;
      }

      .hha-co-btn.cooldown{
        background:linear-gradient(180deg,#effcff,#fff);
        border:2px solid #bdf4ff;
        color:#0f766e;
      }

      .hha-co-btn.zone{
        background:linear-gradient(180deg,#dcfff2,#baf4cf);
        color:#14532d;
      }

      @media (max-width:720px){
        body.hha-brush-compact-override{
          padding-bottom:calc(230px + env(safe-area-inset-bottom,0px)) !important;
        }

        .hha-co-metrics,
        #hha-brush-compact-override-actions{
          grid-template-columns:1fr;
        }

        #hha-brush-compact-override-card{
          margin-bottom:240px;
          padding:18px;
        }

        .hha-co-btn{
          min-height:50px;
          font-size:16px;
        }
      }
    `;

    DOC.head.appendChild(style);
  }

  function hideLongNativePanels(){
    const keywords = [
      'Tooth Pet Rescue',
      'Replay Challenge',
      'Daily Brush Challenge',
      'Brushing Surface Mastery',
      'Golden Smile Challenge',
      'Monster Hunter',
      'Fever Master',
      'Burst Master',
      'Pet Rescuer',
      'Boss Battle',
      'Cavity Storm',
      'Challenge Cards',
      'Surface Mastery:'
    ];

    Array.from(DOC.querySelectorAll('section,article,div')).forEach(el => {
      if(el.id === 'hha-brush-compact-override-card') return;
      if(el.closest('#hha-brush-compact-override-card')) return;
      if(el.closest('#hha-brush-compact-override-actions')) return;

      const t = text(el);
      if(!t || t.length > 2600) return;

      const hit = keywords.some(k => t.includes(k));
      if(!hit) return;

      el.style.display = 'none';
      el.style.visibility = 'hidden';
      el.style.pointerEvents = 'none';
      el.setAttribute('data-compact-hidden', '1');
    });

    Array.from(DOC.querySelectorAll('button,a')).forEach(el => {
      if(el.closest('#hha-brush-compact-override-actions')) return;

      const t = (el.textContent || '').trim();
      if(/เล่นอีกครั้ง|Cooldown|กลับ Hygiene Zone|คูลดาวน์/i.test(t)){
        el.style.display = 'none';
        el.style.visibility = 'hidden';
        el.style.pointerEvents = 'none';
      }
    });
  }

  function mountPoint(){
    const all = Array.from(DOC.querySelectorAll('main,section,article,div'));
    const candidates = all.filter(el => {
      const t = text(el);
      return /ผลการแปรงฟันของฉัน/.test(t) &&
             /เวลา|คะแนน|Combo|Clean|Plaque|Zone/.test(t) &&
             t.length < 1600;
    });

    if(candidates.length){
      return candidates[0];
    }

    return DOC.body;
  }

  function renderCard(){
    const m = metrics();

    let card = DOC.getElementById('hha-brush-compact-override-card');

    if(!card){
      card = DOC.createElement('section');
      card.id = 'hha-brush-compact-override-card';

      const anchor = mountPoint();

      if(anchor && anchor.parentElement && anchor !== DOC.body){
        anchor.parentElement.insertBefore(card, anchor.nextSibling);
      }else{
        DOC.body.insertBefore(card, DOC.body.firstChild);
      }
    }

    const cleanPass = m.clean >= 99;
    const comboPass = m.combo >= 30;
    const zonePass = m.zoneDone >= m.zoneTotal || m.surface >= 95;

    const stars = cleanPass && comboPass && zonePass
      ? '⭐⭐⭐'
      : cleanPass && zonePass
        ? '⭐⭐'
        : '⭐';

    let tip = 'ครั้งหน้า ลองแปรงช้า ๆ ให้ครบทุกจุดนะ';
    if(cleanPass && comboPass && zonePass){
      tip = 'สุดยอด! ฟันสะอาดครบทุกโซนแล้ว ครั้งหน้าลองรักษาคอมโบให้ยาวขึ้นนะ';
    }else if(!zonePass){
      tip = 'ครั้งหน้า ลองแปรงแนวเหงือกและด้านในให้ช้าลงนิดหนึ่งนะ';
    }else if(!comboPass){
      tip = 'ครั้งหน้า ลองแปรงต่อเนื่องเพื่อเก็บ Combo 30+ นะ';
    }

    card.innerHTML = `
      <div class="hha-co-hero">🪥✨</div>
      <h2 class="hha-co-title">เยี่ยมมาก!</h2>
      <p class="hha-co-sub">นี่คือผลการแปรงฟันของฉัน</p>

      <div class="hha-co-score">${m.score}</div>
      <div class="hha-co-stars">${stars}</div>

      <div class="hha-co-metrics">
        <div class="hha-co-pill">
          <div class="hha-co-label">Clean Teeth</div>
          <div class="hha-co-value">${m.clean}%</div>
        </div>
        <div class="hha-co-pill">
          <div class="hha-co-label">Combo</div>
          <div class="hha-co-value">${m.combo}+</div>
        </div>
        <div class="hha-co-pill">
          <div class="hha-co-label">แปรงครบ</div>
          <div class="hha-co-value">${m.zoneDone}/${m.zoneTotal}</div>
        </div>
      </div>

      <div class="hha-co-badges">
        <div class="hha-co-badge">
          <span>🦷 ฟันสะอาดมาก</span>
          <strong>${cleanPass ? 'ผ่าน' : 'ลองใหม่'}</strong>
        </div>
        <div class="hha-co-badge">
          <span>🔥 Combo 30+</span>
          <strong>${comboPass ? 'ผ่าน' : 'ลองใหม่'}</strong>
        </div>
        <div class="hha-co-badge">
          <span>✅ แปรงครบทุกโซน</span>
          <strong>${zonePass ? 'ผ่าน' : 'ลองใหม่'}</strong>
        </div>
      </div>

      <div class="hha-co-tip">💡 ${tip}</div>
    `;

    try{
      localStorage.setItem('HHA_BRUSH_KIDS_SUMMARY_COMPACT_OVERRIDE', JSON.stringify({
        patch: PATCH_ID,
        ts: new Date().toISOString(),
        metrics: m
      }));
    }catch(_){}
  }

  function renderActions(){
    let bar = DOC.getElementById('hha-brush-compact-override-actions');

    if(!bar){
      bar = DOC.createElement('nav');
      bar.id = 'hha-brush-compact-override-actions';
      bar.innerHTML = `
        <button type="button" class="hha-co-btn replay">↩️ เล่นอีกครั้ง</button>
        <button type="button" class="hha-co-btn cooldown">🧘 Cooldown</button>
        <button type="button" class="hha-co-btn zone">🏠 กลับ Hygiene Zone</button>
      `;
      DOC.body.appendChild(bar);
    }

    const replay = bar.querySelector('.replay');
    const cooldown = bar.querySelector('.cooldown');
    const zone = bar.querySelector('.zone');

    if(replay && !replay.__hhaCoBound){
      replay.__hhaCoBound = true;
      replay.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        go(launcherUrl());
      }, true);
    }

    if(cooldown && !cooldown.__hhaCoBound){
      cooldown.__hhaCoBound = true;
      cooldown.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        go(cooldownUrl());
      }, true);
    }

    if(zone && !zone.__hhaCoBound){
      zone.__hhaCoBound = true;
      zone.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        go(zoneUrl());
      }, true);
    }
  }

  function cleanupIfNotSummary(){
    const card = DOC.getElementById('hha-brush-compact-override-card');
    const bar = DOC.getElementById('hha-brush-compact-override-actions');

    if(card) card.remove();
    if(bar) bar.remove();

    DOC.documentElement.classList.remove('hha-brush-compact-override');
    if(DOC.body) DOC.body.classList.remove('hha-brush-compact-override');

    Array.from(DOC.querySelectorAll('[data-compact-hidden="1"]')).forEach(el => {
      el.style.display = '';
      el.style.visibility = '';
      el.style.pointerEvents = '';
      el.removeAttribute('data-compact-hidden');
    });
  }

  function apply(){
    if(!isSummary()){
      cleanupIfNotSummary();
      return;
    }

    DOC.documentElement.classList.add('hha-brush-compact-override');
    if(DOC.body) DOC.body.classList.add('hha-brush-compact-override');

    ensureStyle();
    renderCard();
    renderActions();

    setTimeout(hideLongNativePanels, 80);
    setTimeout(hideLongNativePanels, 400);
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
  }

  function boot(){
    observe();
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }

})();
