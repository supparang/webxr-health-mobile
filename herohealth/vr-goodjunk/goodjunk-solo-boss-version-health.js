// === /herohealth/vr-goodjunk/goodjunk-solo-boss-version-health.js ===
// GoodJunk Solo Boss Final QA Guard + Version Health
// PATCH v8.41.6-FINAL-QA-GUARD-VERSION-HEALTH
// ✅ checks addon globals
// ✅ checks script src/version query
// ✅ checks script order
// ✅ checks critical APIs
// ✅ debugBoss=1 health panel
// ✅ localStorage deploy report
// ✅ emits gj:version-health-ready / gj:version-health-report
// ✅ no backend / no Apps Script

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  const QS = new URLSearchParams(location.search || '');

  const PATCH = 'v8.41.6-FINAL-QA-GUARD-VERSION-HEALTH';

  const CFG = {
    debug: QS.get('debugBoss') === '1',
    enabled: QS.get('versionHealth') !== '0',
    strict: QS.get('strictHealth') === '1'
  };

  const EXPECTED = [
    {
      id:'ultimate',
      label:'Ultimate',
      file:'goodjunk-solo-boss-ultimate.js',
      query:'v8401',
      global:'GoodJunkSoloBossUltimate',
      short:'GJSU',
      required:true,
      apis:['start','tick','makeFoodSuggestion','hit','end']
    },
    {
      id:'drama',
      label:'Drama',
      file:'goodjunk-solo-boss-drama.js',
      query:'v8402',
      global:'GoodJunkSoloBossDrama',
      required:true,
      apis:['start','hitBoss','goodHit','warnAttack','end']
    },
    {
      id:'juice',
      label:'Juice',
      file:'goodjunk-solo-boss-juice.js',
      query:'v8403',
      global:'GoodJunkSoloBossJuice',
      required:true,
      apis:['unlockAudio','toggleSound','center','flash','shake']
    },
    {
      id:'reward',
      label:'Reward',
      file:'goodjunk-solo-boss-reward.js',
      query:'v8404',
      global:'GoodJunkSoloBossReward',
      required:true,
      apis:['showSummary','calculateSummary','replay','backToZone']
    },
    {
      id:'rewardPolish',
      label:'Reward Polish',
      file:'goodjunk-solo-boss-reward-polish.js',
      query:'v8415',
      global:'GoodJunkSoloBossRewardPolish',
      alias:'GJRP',
      required:true,
      apis:['applyPolish','createPolishSection']
    },
    {
      id:'director',
      label:'Director',
      file:'goodjunk-solo-boss-director.js',
      query:'v8405',
      global:'GoodJunkSoloBossDirector',
      alias:'GJBD',
      required:true,
      apis:['start','end','getModifiers','directFood','coach']
    },
    {
      id:'shim',
      label:'Shim',
      file:'goodjunk-solo-boss-shim.js',
      query:'v8406',
      global:'GoodJunkSoloBossShim',
      alias:'GJBS',
      required:true,
      apis:['start','end','makeFood','hit','miss','forceSummary','getModifiers']
    },
    {
      id:'merge',
      label:'Merge',
      file:'goodjunk-solo-boss-merge.js',
      query:'v8407',
      global:'GoodJunkSoloBossMerge',
      alias:'GJBM',
      required:true,
      apis:['start','end','bindExisting','hit','miss','spawnInto']
    },
    {
      id:'foodbank',
      label:'FoodBank',
      file:'goodjunk-solo-boss-foodbank.js',
      query:'v8413',
      global:'GoodJunkSoloBossFoodBank',
      alias:'GJFB',
      required:true,
      apis:['chooseFood','getTypeWeights','getWave','patchShim']
    },
    {
      id:'visualVariety',
      label:'Visual Variety',
      file:'goodjunk-solo-boss-visual-variety.js',
      query:'v8414',
      global:'GoodJunkSoloBossVisualVariety',
      alias:'GJVV',
      required:true,
      apis:['setPattern','burstParticles','beam']
    },
    {
      id:'main',
      label:'Main',
      file:'goodjunk-solo-boss-main.js',
      query:'v8410',
      global:'GoodJunkSoloBossMain',
      alias:'GJSBM',
      required:true,
      apis:['startGame','endGame','spawnFood','updateHUD']
    },
    {
      id:'mobilePolish',
      label:'Mobile Polish',
      file:'goodjunk-solo-boss-mobile-polish.js',
      query:'v8412',
      global:'GoodJunkSoloBossMobilePolish',
      alias:'GJMP',
      required:true,
      apis:['polishAllFoods','showHint','patchShim']
    },
    {
      id:'guard',
      label:'Guard',
      file:'goodjunk-solo-boss-guard.js',
      query:'v8408',
      global:'GoodJunkSoloBossGuard',
      alias:'GJBG',
      required:true,
      apis:['checkHealth','safeStart','forceSummary']
    },
    {
      id:'versionHealth',
      label:'Version Health',
      file:'goodjunk-solo-boss-version-health.js',
      query:'v8416',
      global:'GoodJunkSoloBossVersionHealth',
      alias:'GJVH',
      required:true,
      apis:['runCheck','renderPanel','getReport']
    }
  ];

  const REQUIRED_ORDER = [
    'ultimate',
    'drama',
    'juice',
    'reward',
    'rewardPolish',
    'director',
    'shim',
    'merge',
    'foodbank',
    'visualVariety',
    'main',
    'mobilePolish',
    'guard',
    'versionHealth'
  ];

  const state = {
    bootAt: Date.now(),
    report:null,
    panel:null,
    compact:false,
    issues:[],
    lastSavedAt:0,
    interval:null
  };

  function nowIso(){
    return new Date().toISOString();
  }

  function esc(s){
    return String(s ?? '').replace(/[&<>"']/g, ch => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[ch]));
  }

  function getGlobal(name){
    try{
      return WIN[name];
    }catch(e){
      return null;
    }
  }

  function findScript(file){
    const scripts = Array.from(DOC.querySelectorAll('script[src]'));
    return scripts.find(s => String(s.getAttribute('src') || '').includes(file)) || null;
  }

  function scriptIndex(file){
    const scripts = Array.from(DOC.querySelectorAll('script[src]'));
    return scripts.findIndex(s => String(s.getAttribute('src') || '').includes(file));
  }

  function scriptSrc(file){
    const s = findScript(file);
    return s ? String(s.getAttribute('src') || '') : '';
  }

  function hasQuery(src, query){
    if(!src || !query) return false;
    return src.includes(query);
  }

  function checkApis(obj, apis){
    const missing = [];

    (apis || []).forEach(api => {
      if(!obj || typeof obj[api] !== 'function'){
        missing.push(api);
      }
    });

    return missing;
  }

  function checkOne(item){
    const obj = getGlobal(item.global);
    const aliasObj = item.alias ? getGlobal(item.alias) : null;
    const src = scriptSrc(item.file);
    const hasScript = Boolean(src);
    const queryOk = hasScript ? hasQuery(src, item.query) : false;
    const globalOk = Boolean(obj);
    const aliasOk = item.alias ? Boolean(aliasObj) : true;
    const apiMissing = checkApis(obj || aliasObj, item.apis);
    const orderIndex = scriptIndex(item.file);

    const ok =
      hasScript &&
      queryOk &&
      globalOk &&
      aliasOk &&
      apiMissing.length === 0;

    return {
      id:item.id,
      label:item.label,
      file:item.file,
      query:item.query,
      global:item.global,
      alias:item.alias || '',
      required:Boolean(item.required),
      src,
      hasScript,
      queryOk,
      globalOk,
      aliasOk,
      apiMissing,
      orderIndex,
      ok,
      version:(obj && obj.version) || (aliasObj && aliasObj.version) || ''
    };
  }

  function checkOrder(results){
    const found = results
      .filter(r => r.hasScript)
      .map(r => ({
        id:r.id,
        index:r.orderIndex
      }))
      .filter(x => x.index >= 0);

    const issues = [];

    for(let i = 0; i < REQUIRED_ORDER.length - 1; i++){
      const a = REQUIRED_ORDER[i];
      const b = REQUIRED_ORDER[i + 1];

      const ra = found.find(x => x.id === a);
      const rb = found.find(x => x.id === b);

      if(!ra || !rb) continue;

      if(ra.index > rb.index){
        issues.push({
          type:'order',
          message:`${a} should load before ${b}`,
          before:a,
          after:b
        });
      }
    }

    return issues;
  }

  function checkRuntime(){
    const runtime = {
      rewardLayer:Boolean(DOC.getElementById('gjRewardLayer')),
      mainRoot:Boolean(DOC.getElementById('gjSoloBossMain')),
      playArea:Boolean(DOC.getElementById('gjSoloBossArea')),
      startBtn:Boolean(DOC.getElementById('gjmStartBtn')),
      backBtn:Boolean(DOC.getElementById('shellBackBtn')),
      hudScore:Boolean(DOC.getElementById('gjmScore')),
      hudTime:Boolean(DOC.getElementById('gjmTime')),
      hudLives:Boolean(DOC.getElementById('gjmLives')),
      hudCombo:Boolean(DOC.getElementById('gjmCombo')),
      urlRun:QS.get('run') || '',
      urlMode:QS.get('mode') || QS.get('entry') || '',
      urlView:QS.get('view') || '',
      hasHub:Boolean(QS.get('hub')),
      debugBoss:CFG.debug
    };

    runtime.ok =
      runtime.mainRoot &&
      runtime.playArea &&
      runtime.startBtn &&
      runtime.backBtn &&
      runtime.hudScore &&
      runtime.hudTime &&
      runtime.hudLives &&
      runtime.hudCombo;

    return runtime;
  }

  function buildIssues(results, orderIssues, runtime){
    const issues = [];

    results.forEach(r => {
      if(r.required && !r.hasScript){
        issues.push({
          level:'error',
          id:r.id,
          type:'missing-script',
          message:`Missing script: ${r.file}`
        });
      }

      if(r.hasScript && !r.queryOk){
        issues.push({
          level:'warn',
          id:r.id,
          type:'version-query',
          message:`Script query may be stale: ${r.file} expected ${r.query}`,
          src:r.src
        });
      }

      if(r.required && !r.globalOk){
        issues.push({
          level:'error',
          id:r.id,
          type:'missing-global',
          message:`Missing global: ${r.global}`
        });
      }

      if(r.alias && !r.aliasOk){
        issues.push({
          level:'warn',
          id:r.id,
          type:'missing-alias',
          message:`Missing alias: ${r.alias}`
        });
      }

      if(r.apiMissing.length){
        issues.push({
          level:'error',
          id:r.id,
          type:'missing-api',
          message:`Missing API on ${r.label}: ${r.apiMissing.join(', ')}`
        });
      }
    });

    orderIssues.forEach(o => {
      issues.push({
        level:'error',
        id:'script-order',
        type:'script-order',
        message:o.message
      });
    });

    if(!runtime.mainRoot){
      issues.push({
        level:'error',
        id:'runtime',
        type:'missing-main-root',
        message:'Missing #gjSoloBossMain'
      });
    }

    if(!runtime.playArea){
      issues.push({
        level:'error',
        id:'runtime',
        type:'missing-play-area',
        message:'Missing #gjSoloBossArea'
      });
    }

    if(!runtime.backBtn){
      issues.push({
        level:'warn',
        id:'runtime',
        type:'missing-back-button',
        message:'Missing #shellBackBtn'
      });
    }

    if(!runtime.hasHub){
      issues.push({
        level:'warn',
        id:'runtime',
        type:'missing-hub-param',
        message:'No hub parameter found; back button will use fallback.'
      });
    }

    return issues;
  }

  function scoreHealth(issues){
    const errors = issues.filter(i => i.level === 'error').length;
    const warns = issues.filter(i => i.level === 'warn').length;

    let score = 100;
    score -= errors * 12;
    score -= warns * 4;

    score = Math.max(0, Math.min(100, score));

    let status = 'READY';
    if(errors > 0) status = 'NEEDS FIX';
    else if(warns > 0) status = 'OK WITH WARNINGS';

    return {
      score,
      status,
      errors,
      warns
    };
  }

  function runCheck(){
    const results = EXPECTED.map(checkOne);
    const orderIssues = checkOrder(results);
    const runtime = checkRuntime();
    const issues = buildIssues(results, orderIssues, runtime);
    const health = scoreHealth(issues);

    const report = {
      patch:PATCH,
      checkedAt:nowIso(),
      pageUrl:location.href,
      health,
      runtime,
      results,
      orderIssues,
      issues,
      expectedOrder:REQUIRED_ORDER.slice()
    };

    state.report = report;
    state.issues = issues;

    saveReport(report);

    WIN.dispatchEvent(new CustomEvent('gj:version-health-report', {
      detail:report
    }));

    return report;
  }

  function saveReport(report){
    const t = Date.now();
    if(t - state.lastSavedAt < 1200) return;

    state.lastSavedAt = t;

    try{
      localStorage.setItem('GJ_SOLO_BOSS_VERSION_HEALTH_LAST', JSON.stringify(report));
    }catch(e){}
  }

  function ensureStyle(){
    if(DOC.getElementById('gjVersionHealthStyle')) return;

    const css = DOC.createElement('style');
    css.id = 'gjVersionHealthStyle';
    css.textContent = `
      .gjvh-panel{
        position:fixed;
        left:10px;
        top:calc(70px + env(safe-area-inset-top));
        z-index:100200;
        width:min(390px, calc(100vw - 20px));
        max-height:calc(100dvh - 92px);
        overflow:auto;
        border-radius:20px;
        background:rgba(15,23,42,.92);
        color:#e5e7eb;
        border:1px solid rgba(255,255,255,.18);
        box-shadow:0 18px 48px rgba(15,23,42,.36);
        font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;
        font-size:11px;
        line-height:1.35;
        pointer-events:auto;
      }

      .gjvh-head{
        position:sticky;
        top:0;
        z-index:2;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        padding:10px;
        background:rgba(15,23,42,.96);
        border-bottom:1px solid rgba(255,255,255,.14);
      }

      .gjvh-head b{
        color:#fde68a;
        font-size:12px;
      }

      .gjvh-head button{
        border:0;
        border-radius:999px;
        padding:6px 9px;
        background:rgba(255,255,255,.12);
        color:#fff;
        font-size:11px;
        font-weight:900;
        cursor:pointer;
      }

      .gjvh-body{
        padding:10px;
      }

      .gjvh-score{
        display:grid;
        grid-template-columns:74px 1fr;
        gap:10px;
        align-items:center;
        margin-bottom:10px;
      }

      .gjvh-ring{
        width:70px;
        height:70px;
        border-radius:999px;
        display:grid;
        place-items:center;
        background:conic-gradient(#22c55e var(--p), rgba(255,255,255,.12) 0);
        box-shadow:inset 0 0 0 8px rgba(15,23,42,.94);
        color:#fff;
        font-size:18px;
        font-weight:1000;
      }

      .gjvh-status{
        font-weight:1000;
        font-size:14px;
      }

      .gjvh-status.ready{ color:#86efac; }
      .gjvh-status.warn{ color:#fcd34d; }
      .gjvh-status.bad{ color:#fca5a5; }

      .gjvh-meta{
        margin-top:4px;
        color:#cbd5e1;
        font-size:10px;
      }

      .gjvh-grid{
        display:grid;
        gap:5px;
      }

      .gjvh-row{
        display:grid;
        grid-template-columns:20px 86px 1fr;
        gap:6px;
        align-items:start;
        padding:6px;
        border-radius:10px;
        background:rgba(255,255,255,.06);
      }

      .gjvh-row.ok{ background:rgba(34,197,94,.10); }
      .gjvh-row.warn{ background:rgba(250,204,21,.10); }
      .gjvh-row.bad{ background:rgba(239,68,68,.12); }

      .gjvh-row .name{
        color:#fff;
        font-weight:900;
      }

      .gjvh-row .detail{
        color:#cbd5e1;
        word-break:break-word;
      }

      .gjvh-section-title{
        margin:12px 0 6px;
        color:#93c5fd;
        font-weight:1000;
        text-transform:uppercase;
        letter-spacing:.06em;
      }

      .gjvh-issue{
        padding:7px;
        border-radius:10px;
        margin-bottom:5px;
        background:rgba(255,255,255,.06);
      }

      .gjvh-issue.error{
        background:rgba(239,68,68,.13);
        color:#fecaca;
      }

      .gjvh-issue.warn{
        background:rgba(250,204,21,.12);
        color:#fde68a;
      }

      .gjvh-runtime{
        white-space:pre-wrap;
        background:rgba(255,255,255,.06);
        border-radius:10px;
        padding:8px;
        color:#cbd5e1;
      }

      .gjvh-collapsed .gjvh-body{
        display:none;
      }

      .gjvh-collapsed{
        width:auto;
        max-width:calc(100vw - 20px);
      }

      .gjvh-collapsed .gjvh-head{
        border-bottom:0;
      }

      @media (max-width:720px){
        .gjvh-panel{
          top:calc(62px + env(safe-area-inset-top));
          width:min(360px, calc(100vw - 16px));
          left:8px;
          font-size:10.5px;
        }

        .gjvh-row{
          grid-template-columns:18px 74px 1fr;
        }
      }
    `;

    DOC.head.appendChild(css);
  }

  function renderPanel(report){
    if(!CFG.debug) return;

    ensureStyle();

    report = report || state.report || runCheck();

    let panel = DOC.getElementById('gjVersionHealthPanel');
    if(!panel){
      panel = DOC.createElement('section');
      panel.id = 'gjVersionHealthPanel';
      panel.className = 'gjvh-panel';
      DOC.body.appendChild(panel);
      state.panel = panel;
    }

    panel.classList.toggle('gjvh-collapsed', state.compact);

    const h = report.health;
    const statusCls = h.status === 'READY' ? 'ready' : h.status === 'OK WITH WARNINGS' ? 'warn' : 'bad';
    const p = `${h.score}%`;

    const rows = report.results.map(r => {
      const rowCls = r.ok ? 'ok' : (r.hasScript && r.globalOk ? 'warn' : 'bad');
      const icon = r.ok ? '✅' : (rowCls === 'warn' ? '⚠️' : '❌');

      const details = [
        r.hasScript ? 'script' : 'no script',
        r.queryOk ? r.query : 'query?',
        r.globalOk ? 'global' : 'no global',
        r.alias ? (r.aliasOk ? r.alias : `${r.alias}?`) : '',
        r.apiMissing.length ? `missing: ${r.apiMissing.join(',')}` : '',
        r.version ? `ver: ${r.version}` : ''
      ].filter(Boolean).join(' · ');

      return `
        <div class="gjvh-row ${rowCls}">
          <div>${icon}</div>
          <div class="name">${esc(r.label)}</div>
          <div class="detail">${esc(details)}</div>
        </div>
      `;
    }).join('');

    const issuesHtml = report.issues.length
      ? report.issues.slice(0, 12).map(i => `
          <div class="gjvh-issue ${i.level === 'error' ? 'error' : 'warn'}">
            <b>${esc(i.type)}</b><br>${esc(i.message)}
          </div>
        `).join('')
      : `<div class="gjvh-issue">✅ No issues detected</div>`;

    const runtimeText =
`mainRoot: ${report.runtime.mainRoot}
playArea: ${report.runtime.playArea}
startBtn: ${report.runtime.startBtn}
backBtn: ${report.runtime.backBtn}
rewardLayer: ${report.runtime.rewardLayer}

run: ${report.runtime.urlRun || '-'}
mode: ${report.runtime.urlMode || '-'}
view: ${report.runtime.urlView || '-'}
hub: ${report.runtime.hasHub}`;

    panel.innerHTML = `
      <div class="gjvh-head">
        <b>GoodJunk Version Health</b>
        <div>
          <button type="button" id="gjvhRefreshBtn">Refresh</button>
          <button type="button" id="gjvhToggleBtn">${state.compact ? 'Open' : 'Hide'}</button>
        </div>
      </div>

      <div class="gjvh-body">
        <div class="gjvh-score">
          <div class="gjvh-ring" style="--p:${p}">${h.score}</div>
          <div>
            <div class="gjvh-status ${statusCls}">${esc(h.status)}</div>
            <div class="gjvh-meta">
              errors: ${h.errors} · warnings: ${h.warns}<br>
              ${esc(PATCH)}
            </div>
          </div>
        </div>

        <div class="gjvh-section-title">Files / Globals / APIs</div>
        <div class="gjvh-grid">${rows}</div>

        <div class="gjvh-section-title">Issues</div>
        ${issuesHtml}

        <div class="gjvh-section-title">Runtime</div>
        <div class="gjvh-runtime">${esc(runtimeText)}</div>
      </div>
    `;

    const refresh = DOC.getElementById('gjvhRefreshBtn');
    const toggle = DOC.getElementById('gjvhToggleBtn');

    if(refresh){
      refresh.addEventListener('click', function(){
        renderPanel(runCheck());
      });
    }

    if(toggle){
      toggle.addEventListener('click', function(){
        state.compact = !state.compact;
        renderPanel(state.report);
      });
    }
  }

  function getReport(){
    return state.report || runCheck();
  }

  function expose(){
    WIN.GoodJunkSoloBossVersionHealth = {
      version:PATCH,
      runCheck,
      renderPanel,
      getReport,
      getState:()=>({
        patch:PATCH,
        compact:state.compact,
        report:state.report,
        issues:state.issues
      })
    };

    WIN.GJVH = WIN.GoodJunkSoloBossVersionHealth;
  }

  function boot(){
    if(!CFG.enabled) return;

    expose();

    setTimeout(() => {
      const report = runCheck();
      renderPanel(report);

      WIN.dispatchEvent(new CustomEvent('gj:version-health-ready', {
        detail:{
          patch:PATCH,
          report
        }
      }));

      if(CFG.strict && report.health.errors > 0){
        console.error('[GoodJunk Version Health] Strict health failed:', report);
      }
    }, 700);

    clearInterval(state.interval);
    state.interval = setInterval(() => {
      const report = runCheck();
      if(CFG.debug) renderPanel(report);
    }, CFG.debug ? 3000 : 10000);
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot);
  }else{
    boot();
  }
})();
