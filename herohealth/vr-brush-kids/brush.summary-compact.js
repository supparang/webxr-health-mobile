/* =========================================================
 * HeroHealth Brush Kids
 * /herohealth/vr-brush-kids/brush.summary-compact.js
 * PATCH v20260513-P42-BRUSH-KIDS-COMPACT-SUMMARY
 *
 * Purpose:
 * - Make summary child-friendly and compact
 * - Hide detailed/research-style summary panels
 * - Show only essential results for children
 * ========================================================= */

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  const PATCH_ID = 'v20260513-P42-BRUSH-KIDS-COMPACT-SUMMARY';

  function text(root){
    try{
      const r = root || DOC.body || DOC.documentElement;
      return r.innerText || r.textContent || '';
    }catch(_){
      return '';
    }
  }

  function isSummary(){
    return /ผลการแปรงฟันของฉัน|Clean|Combo|Zone|Cooldown|กลับ Hygiene Zone/i.test(text());
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

  function readP40(){
    try{
      const raw = localStorage.getItem('HHA_BRUSH_KIDS_SUMMARY_FINAL');
      return raw ? JSON.parse(raw) : null;
    }catch(_){
      return null;
    }
  }

  function getMetrics(){
    const t = text();
    const p40 = readP40();

    const pMetrics = p40 && p40.metrics ? p40.metrics : {};
    const pSurface = p40 && p40.surface ? p40.surface : {};

    const score = Math.max(
      safeNum(pMetrics.score, 0),
      maxRegex(t, /คะแนน\s*[\r\n\s:]*([0-9]+)/gi),
      maxRegex(t, /Best Score\s*[\r\n\s:]*([0-9]+)/gi)
    );

    const combo = Math.max(
      safeNum(pMetrics.combo, 0),
      safeNum(pMetrics.bestCombo, 0),
      maxRegex(t, /Combo\s*[\r\n\s:]*([0-9]+)/gi),
      maxRegex(t, /Best Combo\s*[\r\n\s:]*([0-9]+)/gi),
      maxRegex(t, /Max Combo\s*[\r\n\s:]*([0-9]+)/gi)
    );

    const clean = Math.max(
      safeNum(pMetrics.clean, 0),
      safeNum(pMetrics.cleanPct, 0),
      maxRegex(t, /Clean\s*[\r\n\s:]*([0-9]+)\s*%/gi),
      maxRegex(t, /Clean Teeth\s*[\r\n\s:]*([0-9]+)\s*%/gi)
    );

    const zoneText =
      t.match(/Zone\s*[\r\n\s]*([0-9]+)\s*\/\s*([0-9]+)/i) ||
      t.match(/แปรงครบ\s*:?\s*([0-9]+)\s*\/\s*([0-9]+)/i);

    const zoneDone = Math.max(
      safeNum(pMetrics.zoneDone, 0),
      zoneText ? safeNum(zoneText[1], 0) : 0,
      clean >= 99 ? 6 : 0
    );

    const zoneTotal = Math.max(
      safeNum(pMetrics.zoneTotal, 6),
      zoneText ? safeNum(zoneText[2], 6) : 6,
      6
    );

    let surface = Math.max(
      safeNum(pSurface.pct, 0),
      safeNum(pMetrics.surfacePct, 0),
      maxRegex(t, /Surface Mastery\s*[\r\n\s:]*([0-9]+)\s*%/gi),
      maxRegex(t, /Mastery รวม\s*[\r\n\s:]*([0-9]+)\s*%/gi)
    );

    if(clean >= 99 && zoneDone >= zoneTotal){
      surface = 100;
    }

    return {
      score,
      combo,
      clean,
      zoneDone,
      zoneTotal,
      surface
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
    if(DOC.getElementById('hha-brush-summary-compact-style')) return;

    const style = DOC.createElement('style');
    style.id = 'hha-brush-summary-compact-style';
    style.textContent = `
      body.hha-brush-summary-compact{
        overflow-x:hidden !important;
        padding-bottom:calc(120px + env(safe-area-inset-bottom,0px)) !important;
      }

      /* ซ่อน summary แบบยาว แต่ไม่ซ่อน header หลัก */
      #hha-brush-summary-final-card,
      #hha-summary-mount-rescue-card,
      #hha-summary-restore-card,
      #hha-summary-authority-surface-card,
      #hha-summary-repair-surface-card,
      #hha-brush-summary-bridge-note{
        display:none !important;
        visibility:hidden !important;
        pointer-events:none !important;
      }

      #hha-brush-summary-final-actions-clean,
      #hha-summary-mount-rescue-actions,
      #hha-summary-restore-actions,
      #hha-summary-authority-actions,
      #hha-brush-summary-final-actions{
        display:none !important;
        visibility:hidden !important;
        pointer-events:none !important;
      }

      #hha-brush-compact-card{
        width:min(760px,94vw);
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

      .hha-compact-hero{
        font-size:54px;
        line-height:1;
        margin-bottom:6px;
      }

      .hha-compact-title{
        margin:0;
        font-size:clamp(30px,5vw,48px);
        font-weight:1000;
        line-height:1.08;
        color:#12324b;
      }

      .hha-compact-sub{
        margin:8px 0 16px;
        color:#5f7f92;
        font-size:17px;
        font-weight:900;
      }

      .hha-compact-score{
        margin:10px auto 8px;
        width:max-content;
        max-width:100%;
        padding:12px 26px;
        border-radius:28px;
        background:linear-gradient(180deg,#fff7b7,#ffe066);
        color:#5b4200;
        font-size:clamp(48px,9vw,82px);
        font-weight:1000;
        line-height:1;
        box-shadow:0 12px 32px rgba(91,66,0,.12);
      }

      .hha-compact-stars{
        font-size:40px;
        line-height:1;
        margin:8px 0 16px;
      }

      .hha-compact-metrics{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:10px;
        margin:14px 0;
      }

      .hha-compact-pill{
        min-height:74px;
        border-radius:22px;
        border:2px solid #cdeffc;
        background:#fff;
        display:grid;
        align-content:center;
        padding:10px;
      }

      .hha-compact-label{
        color:#5f7f92;
        font-size:13px;
        font-weight:1000;
      }

      .hha-compact-value{
        color:#12324b;
        font-size:clamp(24px,4vw,36px);
        font-weight:1000;
        line-height:1;
      }

      .hha-compact-badges{
        display:grid;
        gap:9px;
        margin-top:14px;
      }

      .hha-compact-badge{
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

      .hha-compact-tip{
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

      #hha-brush-compact-actions{
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

      .hha-compact-btn{
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

      .hha-compact-btn.replay{
        background:linear-gradient(180deg,#fff2a8,#ffd84d);
        color:#5b4200;
      }

      .hha-compact-btn.cooldown{
        background:linear-gradient(180deg,#effcff,#fff);
        border:2px solid #bdf4ff;
        color:#0f766e;
      }

      .hha-compact-btn.zone{
        background:linear-gradient(180deg,#dcfff2,#baf4cf);
        color:#14532d;
      }

      @media (max-width:720px){
        body.hha-brush-summary-compact{
          padding-bottom:calc(230px + env(safe-area-inset-bottom,0px)) !important;
        }

        .hha-compact-metrics,
        #hha-brush-compact-actions{
          grid-template-columns:1fr;
        }

        #hha-brush-compact-card{
          margin-bottom:240px;
          padding:18px;
        }

        .hha-compact-btn{
          min-height:50px;
          font-size:16px;
        }
      }
    `;

    DOC.head.appendChild(style);
  }

  function hideNativeActionButtons(){
    Array.from(DOC.querySelectorAll('button,a')).forEach(el => {
      if(el.closest('#hha-brush-compact-actions')) return;

      const t = (el.textContent || '').trim();
      if(/เล่นอีกครั้ง|Cooldown|กลับ Hygiene Zone|คูลดาวน์/i.test(t)){
        el.style.display = 'none';
        el.style.visibility = 'hidden';
        el.style.pointerEvents = 'none';
      }
    });
  }

  function renderCompactCard(){
    const m = getMetrics();

    let card = DOC.getElementById('hha-brush-compact-card');
    if(!card){
      card = DOC.createElement('section');
      card.id = 'hha-brush-compact-card';

      const header = Array.from(DOC.querySelectorAll('main,section,article,div')).find(el => {
        const t = text(el);
        return /ผลการแปรงฟันของฉัน/.test(t) && t.length < 1200;
      });

      if(header && header.parentElement){
        header.parentElement.insertBefore(card, header.nextSibling);
      }else{
        DOC.body.appendChild(card);
      }
    }

    const stars = m.clean >= 99 && m.combo >= 30 ? '⭐⭐⭐' : (m.clean >= 80 ? '⭐⭐' : '⭐');
    const surfacePass = m.surface >= 95;
    const comboPass = m.combo >= 30;
    const cleanPass = m.clean >= 99;

    let tip = 'ครั้งหน้า ลองแปรงช้า ๆ ให้ครบทุกจุดนะ';
    if(cleanPass && comboPass && surfacePass){
      tip = 'สุดยอด! ฟันสะอาดครบทุกโซนแล้ว ครั้งหน้าลองรักษาคอมโบให้ยาวขึ้นนะ';
    }else if(!surfacePass){
      tip = 'ครั้งหน้า ลองแปรงแนวเหงือกและด้านในให้ช้าลงนิดหนึ่งนะ';
    }else if(!comboPass){
      tip = 'ครั้งหน้า ลองแปรงต่อเนื่องเพื่อเก็บ Combo 30+ นะ';
    }

    card.innerHTML = `
      <div class="hha-compact-hero">🪥✨</div>
      <h2 class="hha-compact-title">เยี่ยมมาก!</h2>
      <p class="hha-compact-sub">นี่คือผลการแปรงฟันของฉัน</p>

      <div class="hha-compact-score">${m.score}</div>
      <div class="hha-compact-stars">${stars}</div>

      <div class="hha-compact-metrics">
        <div class="hha-compact-pill">
          <div class="hha-compact-label">Clean Teeth</div>
          <div class="hha-compact-value">${m.clean}%</div>
        </div>
        <div class="hha-compact-pill">
          <div class="hha-compact-label">Combo</div>
          <div class="hha-compact-value">${m.combo}+</div>
        </div>
        <div class="hha-compact-pill">
          <div class="hha-compact-label">แปรงครบ</div>
          <div class="hha-compact-value">${m.zoneDone}/${m.zoneTotal}</div>
        </div>
      </div>

      <div class="hha-compact-badges">
        <div class="hha-compact-badge">
          <span>🦷 ฟันสะอาดมาก</span>
          <strong>${cleanPass ? 'ผ่าน' : 'ลองใหม่'}</strong>
        </div>
        <div class="hha-compact-badge">
          <span>🔥 Combo 30+</span>
          <strong>${comboPass ? 'ผ่าน' : 'ลองใหม่'}</strong>
        </div>
        <div class="hha-compact-badge">
          <span>✅ แปรงครบทุกโซน</span>
          <strong>${surfacePass ? 'ผ่าน' : 'ลองใหม่'}</strong>
        </div>
      </div>

      <div class="hha-compact-tip">💡 ${tip}</div>
    `;

    try{
      localStorage.setItem('HHA_BRUSH_KIDS_SUMMARY_COMPACT', JSON.stringify({
        patch: PATCH_ID,
        ts: new Date().toISOString(),
        metrics: m
      }));
    }catch(_){}
  }

  function renderActions(){
    let bar = DOC.getElementById('hha-brush-compact-actions');
    if(!bar){
      bar = DOC.createElement('nav');
      bar.id = 'hha-brush-compact-actions';
      bar.innerHTML = `
        <button type="button" class="hha-compact-btn replay">↩️ เล่นอีกครั้ง</button>
        <button type="button" class="hha-compact-btn cooldown">🧘 Cooldown</button>
        <button type="button" class="hha-compact-btn zone">🏠 กลับ Hygiene Zone</button>
      `;
      DOC.body.appendChild(bar);
    }

    const replay = bar.querySelector('.replay');
    const cooldown = bar.querySelector('.cooldown');
    const zone = bar.querySelector('.zone');

    if(replay && !replay.__hhaCompactBound){
      replay.__hhaCompactBound = true;
      replay.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        go(launcherUrl());
      }, true);
    }

    if(cooldown && !cooldown.__hhaCompactBound){
      cooldown.__hhaCompactBound = true;
      cooldown.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        go(cooldownUrl());
      }, true);
    }

    if(zone && !zone.__hhaCompactBound){
      zone.__hhaCompactBound = true;
      zone.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        go(zoneUrl());
      }, true);
    }
  }

  function apply(){
    if(!isSummary()) return;

    DOC.documentElement.classList.add('hha-brush-summary-compact');
    if(DOC.body) DOC.body.classList.add('hha-brush-summary-compact');

    ensureStyle();
    hideNativeActionButtons();
    renderCompactCard();
    renderActions();
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
