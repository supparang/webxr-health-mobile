/* =========================================================
   HeroHealth • GoodJunk Mobile Cooldown Gate Summary + Return
   FILE: /herohealth/goodjunk-mobile-cooldown-gate-summary-return-final.js
   PATCH: v20260526-GOODJUNK-MOBILE-COOLDOWN-GATE-SUMMARY-RETURN-FINAL

   PURPOSE:
   - ใช้กับ /herohealth/warmup-gate.html ตอน phase=cooldown
   - บังคับ GoodJunk mobile cooldown กลับหน้าเลือกโหมด GoodJunk
   - ดึง score/rank/stars/accuracy/combo/good/junk/fake/miss จาก URL + localStorage
   - แก้กรณี cooldown แสดงคะแนนหาย / กลับผิดหน้า
========================================================= */
(function(){
  'use strict';

  if (window.__GJ_MOBILE_COOLDOWN_GATE_SUMMARY_RETURN_FINAL__) return;
  window.__GJ_MOBILE_COOLDOWN_GATE_SUMMARY_RETURN_FINAL__ = true;

  const PATCH = 'v20260526-GOODJUNK-MOBILE-COOLDOWN-GATE-SUMMARY-RETURN-FINAL';
  const qs = new URLSearchParams(location.search || '');

  const GOODJUNK_LAUNCHER =
    'https://supparang.github.io/webxr-health-mobile/herohealth/goodjunk-launcher.html';

  const HUB_V2 =
    'https://supparang.github.io/webxr-health-mobile/herohealth/hub-v2.html';

  function get(k, fallback){
    const v = qs.get(k);
    return v === null || v === '' ? fallback : v;
  }

  function isGoodJunkCooldown(){
    const game = String(get('game', get('gameId', ''))).toLowerCase();
    const phase = String(get('phase', '')).toLowerCase();
    const mode = String(get('mode', '')).toLowerCase();

    return (
      phase === 'cooldown' &&
      (
        game === 'goodjunk' ||
        mode.includes('goodjunk') ||
        mode.includes('solo_boss') ||
        location.href.includes('game=goodjunk') ||
        location.href.includes('gameId=goodjunk')
      )
    );
  }

  if (!isGoodJunkCooldown()) return;

  function readJson(key){
    try{
      return JSON.parse(localStorage.getItem(key) || '{}') || {};
    }catch(_){
      return {};
    }
  }

  function firstValue(){
    for (let i = 0; i < arguments.length; i++){
      const v = arguments[i];
      if (v !== undefined && v !== null && String(v) !== '') return v;
    }
    return '';
  }

  function latestSummary(){
    const a = readJson('GJ_SOLO_BOSS_LAST_SUMMARY');
    const b = readJson('GJ_FULL_3D_VR_LAST_SUMMARY');
    const c = readJson('GJ_SOLO_BOSS_COOLDOWN_TARGET_LAST');

    return Object.assign({}, b, a, c);
  }

  const summary = latestSummary();

  function metric(name, fallback){
    return firstValue(
      get(name, ''),
      summary[name],
      fallback
    );
  }

  function metricAny(names, fallback){
    for (const n of names){
      const v = firstValue(get(n, ''), summary[n]);
      if (v !== '') return v;
    }
    return fallback;
  }

  const data = {
    score: metricAny(['score','points','totalScore'], '0'),
    rank: metricAny(['rank','levelRank'], ''),
    stars: metricAny(['stars','star'], ''),
    accuracy: metricAny(['accuracy','acc'], ''),
    goodHits: metricAny(['goodHits','good','goodFood','goodCount'], ''),
    junkHits: metricAny(['junkHits','junk','junkCount'], ''),
    fakeHits: metricAny(['fakeHits','fake','fakeCount'], ''),
    miss: metricAny(['miss','misses','watchOut'], '0'),
    bestCombo: metricAny(['bestCombo','combo','maxCombo'], ''),
    coins: metricAny(['coins','coin'], ''),
    badge: metricAny(['badge','badges'], ''),
    missionDone: metricAny(['missionDone','mission','missions'], '')
  };

  function buildLauncherUrl(){
    const u = new URL(GOODJUNK_LAUNCHER);

    u.searchParams.set('pid', get('pid', 'anon'));
    u.searchParams.set('name', get('name', get('nick', 'Hero')));
    u.searchParams.set('diff', get('diff', 'normal'));
    u.searchParams.set('time', get('time', '90'));
    u.searchParams.set('view', get('view', 'mobile'));

    u.searchParams.set('zone', 'nutrition');
    u.searchParams.set('cat', 'nutrition');
    u.searchParams.set('game', 'goodjunk');
    u.searchParams.set('gameId', 'goodjunk');
    u.searchParams.set('mode', 'solo');
    u.searchParams.set('entry', 'goodjunk-mobile-return');
    u.searchParams.set('theme', 'goodjunk');

    u.searchParams.set('from', 'cooldown');
    u.searchParams.set('v', '20260526-mobile-cooldown-return-final');

    return u.href;
  }

  const launcherUrl = buildLauncherUrl();

  function normalizeUrlOnce(){
    let changed = false;
    const live = new URL(location.href);

    function setParam(k, v){
      if (!v && v !== 0) return;
      if (live.searchParams.get(k) !== String(v)){
        live.searchParams.set(k, String(v));
        changed = true;
      }
    }

    setParam('game', 'goodjunk');
    setParam('gameId', 'goodjunk');
    setParam('zone', 'nutrition');
    setParam('cat', 'nutrition');
    setParam('phase', 'cooldown');
    setParam('mode', get('mode', 'solo_boss'));
    setParam('view', get('view', 'mobile'));

    setParam('hub', launcherUrl);
    setParam('next', launcherUrl);
    setParam('back', launcherUrl);
    setParam('launcher', launcherUrl);
    setParam('return', launcherUrl);

    setParam('score', data.score);
    setParam('miss', data.miss);

    if (data.rank !== '') setParam('rank', data.rank);
    if (data.stars !== '') setParam('stars', data.stars);
    if (data.accuracy !== '') setParam('accuracy', data.accuracy);
    if (data.goodHits !== '') setParam('goodHits', data.goodHits);
    if (data.junkHits !== '') setParam('junkHits', data.junkHits);
    if (data.fakeHits !== '') setParam('fakeHits', data.fakeHits);
    if (data.bestCombo !== '') setParam('bestCombo', data.bestCombo);
    if (data.coins !== '') setParam('coins', data.coins);
    if (data.badge !== '') setParam('badge', data.badge);
    if (data.missionDone !== '') setParam('missionDone', data.missionDone);

    setParam('from', 'goodjunk-mobile-cooldown-gate');
    setParam('gjReturnPatch', PATCH);

    if (changed){
      history.replaceState(null, '', live.pathname + '?' + live.searchParams.toString() + live.hash);
    }
  }

  function saveCheckpoint(){
    try{
      localStorage.setItem('GJ_MOBILE_COOLDOWN_GATE_RETURN_FINAL_LAST', JSON.stringify({
        patch: PATCH,
        href: location.href,
        launcherUrl: launcherUrl,
        data: data,
        savedAt: new Date().toISOString()
      }));
    }catch(_){}
  }

  function textOf(el){
    return String(el && el.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function patchReturnButtons(){
    const candidates = Array.from(document.querySelectorAll('button,a,[role="button"],.btn'));

    candidates.forEach(function(el){
      const t = textOf(el);

      const isReturnButton =
        /กลับหน้าเลือกเกม|กลับหน้าเลือกโหมด|กลับเลือกโหมด|กลับโหมด|เลือกโหมด|Nutrition Zone|หน้าหลัก|กลับหน้าหลัก|กลับ/i.test(t);

      if (!isReturnButton) return;
      if (el.__gjMobileCooldownReturnPatched) return;

      el.__gjMobileCooldownReturnPatched = true;

      if (el.tagName === 'A'){
        el.setAttribute('href', launcherUrl);
      }

      if (/Nutrition Zone/i.test(t)){
        el.textContent = 'กลับหน้าเลือกโหมด GoodJunk';
      }

      el.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

        location.href = launcherUrl;
        return false;
      }, true);
    });
  }

  function findTextNodeBox(labelRegex){
    const all = Array.from(document.querySelectorAll('div,span,p,b,strong,small,h1,h2,h3,section,article'));
    return all.find(function(el){
      return labelRegex.test(textOf(el));
    }) || null;
  }

  function createSummaryPanel(){
    if (document.getElementById('gjCooldownSummaryPanel')) return;

    const host =
      findTextNodeBox(/คูลดาวน์สำเร็จ|Cooldown/i) ||
      document.querySelector('main') ||
      document.body;

    const panel = document.createElement('section');
    panel.id = 'gjCooldownSummaryPanel';
    panel.setAttribute('data-goodjunk-cooldown-summary', PATCH);

    panel.style.cssText = [
      'margin:18px auto 0',
      'width:min(760px,calc(100% - 24px))',
      'border-radius:22px',
      'padding:14px',
      'background:rgba(255,255,255,.08)',
      'border:1px solid rgba(255,255,255,.14)',
      'box-shadow:0 16px 36px rgba(0,0,0,.18)',
      'color:#fff'
    ].join(';');

    const rankLine = data.rank || data.stars
      ? `<div class="gjcs-card"><span>Rank / Stars</span><b>${data.rank || '-'} ${data.stars ? '⭐'.repeat(Math.max(1, Math.min(5, Number(data.stars) || 1))) : ''}</b></div>`
      : '';

    panel.innerHTML = `
      <div style="font-size:12px;font-weight:1000;letter-spacing:.08em;color:#bae6fd;text-transform:uppercase;">
        GoodJunk Summary
      </div>
      <div style="margin-top:8px;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
        <div class="gjcs-card"><span>Score</span><b>${data.score || 0}</b></div>
        <div class="gjcs-card"><span>Accuracy</span><b>${data.accuracy !== '' ? data.accuracy + '%' : '-'}</b></div>
        <div class="gjcs-card"><span>Good</span><b>${data.goodHits || '-'}</b></div>
        <div class="gjcs-card"><span>Watch Out</span><b>${data.miss || 0}</b></div>
        ${rankLine}
        <div class="gjcs-card"><span>Best Combo</span><b>${data.bestCombo || '-'}</b></div>
        <div class="gjcs-card"><span>Coins</span><b>${data.coins || '-'}</b></div>
        <div class="gjcs-card"><span>Badge</span><b>${data.badge || '-'}</b></div>
      </div>
      <style>
        #gjCooldownSummaryPanel .gjcs-card{
          min-height:68px;
          border-radius:16px;
          padding:10px;
          background:rgba(15,23,42,.38);
          border:1px solid rgba(255,255,255,.12);
        }
        #gjCooldownSummaryPanel .gjcs-card span{
          display:block;
          color:#94a3b8;
          font-size:11px;
          font-weight:1000;
          text-transform:uppercase;
          letter-spacing:.05em;
        }
        #gjCooldownSummaryPanel .gjcs-card b{
          display:block;
          margin-top:5px;
          color:#fff;
          font-size:20px;
          line-height:1.05;
          word-break:break-word;
        }
        @media(max-width:720px){
          #gjCooldownSummaryPanel > div:nth-child(2){
            grid-template-columns:repeat(2,1fr) !important;
          }
          #gjCooldownSummaryPanel .gjcs-card{
            min-height:62px;
          }
          #gjCooldownSummaryPanel .gjcs-card b{
            font-size:18px;
          }
        }
      </style>
    `;

    try{
      host.insertAdjacentElement('afterend', panel);
    }catch(_){
      document.body.appendChild(panel);
    }
  }

  function patchPageLabels(){
    try{
      document.querySelectorAll('*').forEach(function(el){
        const t = textOf(el);
        if (t === 'พร้อมกลับ Nutrition Zone'){
          el.textContent = 'พร้อมกลับหน้าเลือกโหมด GoodJunk';
        }
        if (t === 'กลับหน้าเลือกเกม'){
          el.textContent = 'กลับหน้าเลือกโหมด GoodJunk';
        }
      });
    }catch(_){}
  }

  function boot(){
    normalizeUrlOnce();
    saveCheckpoint();

    patchReturnButtons();
    createSummaryPanel();
    patchPageLabels();

    let count = 0;
    const timer = setInterval(function(){
      count++;

      patchReturnButtons();
      createSummaryPanel();
      patchPageLabels();

      if (count > 240){
        clearInterval(timer);
      }
    }, 250);

    window.GJ_MOBILE_COOLDOWN_GATE_SUMMARY_RETURN_CHECK = function(){
      const snap = {
        patch: PATCH,
        isGoodJunkCooldown: isGoodJunkCooldown(),
        launcherUrl: launcherUrl,
        data: data,
        returnButtons: Array.from(document.querySelectorAll('button,a,[role="button"],.btn'))
          .filter(function(el){ return el.__gjMobileCooldownReturnPatched; })
          .map(function(el){ return textOf(el); }),
        hasSummaryPanel: !!document.getElementById('gjCooldownSummaryPanel')
      };

      console.log('[GJ_MOBILE_COOLDOWN_GATE_SUMMARY_RETURN_CHECK]', snap);
      return snap;
    };

    console.info('[GoodJunk Mobile Cooldown Gate Summary Return]', PATCH, 'loaded');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, {once:true});
  }else{
    boot();
  }
})();
