/* =========================================================
   EAP Hero Report Safe Fallback v20260709
   V1
   - Fixes the classroom-critical case where clicking My Learning Report
     leaves the page blank/dark because the core report renderer fails or
     returns an empty app shell.
   - If the app is blank shortly after a Report/My Learning Report click,
     render a compact, read-only learning report from local/cloud-restored
     EAP_HERO_PROGRESS_V3.
   - UI-only fallback. Does not change scores, pass/fail, Sheet rows,
     evidence, teacher review, or unlock rules.
========================================================= */
(function(){
  'use strict';

  var VERSION = 'v20260709-EAP-REPORT-SAFE-FALLBACK-V1-BLANK-REPORT-RECOVERY';
  var STATE_KEY = 'EAP_HERO_PROGRESS_V3';
  var PROFILE_KEY = 'EAP_HERO_PLAYER_PROFILE_V1';
  var STYLE_ID = 'eap-report-safe-fallback-style-v1';
  var PAGE_ID = 'eap-report-safe-fallback-page';
  var PASS = 60;
  var SKILLS = ['Reading','Listening','Writing','Speaking'];

  function text(v){ return String(v == null ? '' : v).replace(/\s+/g,' ').trim(); }
  function lower(v){ return text(v).toLowerCase(); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]; }); }
  function read(k,f){ try{ var raw=localStorage.getItem(k); return raw ? JSON.parse(raw) : f; }catch(_){ return f; } }
  function app(){ return document.getElementById('app') || document.body; }
  function score(v){ var n=Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0; }
  function bool(v){ return v === true || String(v).toUpperCase() === 'TRUE' || String(v) === '1' || String(v).toLowerCase() === 'yes'; }
  function sid(v){ var raw=text(v).toUpperCase(); if(/^\d+$/.test(raw)) return 'S'+Number(raw); if(/^S(?:ESSION)?\s*\d+$/i.test(raw)) return 'S'+(raw.match(/\d+/)||[''])[0]; if(/^B(?:OSS)?\s*\d+$/i.test(raw)) return 'B'+(raw.match(/\d+/)||[''])[0]; return raw; }
  function sn(v){ var m=sid(v).match(/^S(\d+)$/); return m ? Number(m[1]) : 0; }

  function addStyle(){
    if(document.getElementById(STYLE_ID)) return;
    var style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent = `
      #${PAGE_ID}{width:min(1060px,calc(100vw - 28px));margin:24px auto;padding:20px;border-radius:22px;background:#f8fbff;color:#102033;font-family:Arial,'Noto Sans Thai',sans-serif;box-shadow:0 18px 48px rgba(0,0,0,.20)}
      #${PAGE_ID} h1{margin:0 0 6px;font-size:clamp(28px,4vw,42px);font-weight:950}
      #${PAGE_ID} .sub{margin:0 0 14px;color:#526071;font-weight:750;line-height:1.45}
      #${PAGE_ID} .top{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:14px 0}
      #${PAGE_ID} .stat{padding:13px;border:1px solid #d8e5f3;border-radius:16px;background:#fff}
      #${PAGE_ID} .stat b{display:block;font-size:22px;color:#0f2947}
      #${PAGE_ID} .routes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}
      #${PAGE_ID} .card{padding:13px;border:1px solid #d8e5f3;border-radius:16px;background:#fff}
      #${PAGE_ID} .card.done{border-color:#86efac;background:#f0fdf4}
      #${PAGE_ID} .card.current{border-color:#67e8f9;box-shadow:0 0 0 2px rgba(103,232,249,.26)}
      #${PAGE_ID} .title{font-weight:950;font-size:17px;color:#102033;margin-bottom:4px}
      #${PAGE_ID} .skills{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
      #${PAGE_ID} .pill{display:inline-flex;padding:5px 8px;border-radius:999px;background:#e2e8f0;color:#334155;font-size:12px;font-weight:900}
      #${PAGE_ID} .pill.pass{background:#dcfce7;color:#047857}.pill.todo{background:#fff7ed;color:#a85f00}
      #${PAGE_ID} .actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}
      #${PAGE_ID} button{border:0;border-radius:14px;padding:12px 14px;font-weight:950;cursor:pointer;background:#8ee9e3;color:#102033}
      #${PAGE_ID} .ghost{background:#e2e8f0}
      @media(max-width:760px){#${PAGE_ID}{margin:10px 8px;width:calc(100vw - 16px);padding:14px}.top,.routes{grid-template-columns:1fr!important}#${PAGE_ID} button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function profile(state){
    var p=Object.assign({}, state.profile||{}, state.player||{}, state.user||{}, read(PROFILE_KEY,{}));
    return {
      studentId:text(p.studentId||p.id||state.studentId||''),
      studentName:text(p.studentName||p.name||state.studentName||state.playerName||'Student'),
      section:text(p.section||state.section||'122')||'122'
    };
  }

  function routeOrder(){
    var pack=window.EAP_HERO_SESSION_CONTENT_PACK;
    if(pack && Array.isArray(pack.routeOrder) && pack.routeOrder.length) return pack.routeOrder.map(sid);
    return ['S1','S2','S3','B1','S4','S5','S6','B2','S7','S8','S9','B3','S10','S11','S12','B4','S13','S14','S15','B5'];
  }

  function routeTitle(id){
    var pack=window.EAP_HERO_SESSION_CONTENT_PACK;
    var r=pack && Array.isArray(pack.routes) ? pack.routes.find(function(x){ return sid(x.routeId)===sid(id); }) : null;
    if(r) return text(r.title||r.routeTitle||id);
    var map={S1:'Academic Hero Awakening',S2:'Vocabulary Lab',S3:'Main Idea Hunter',B1:'Boss Gate 1',S4:'Keyword Scanner',S5:'Critical Reading',S6:'Summary Builder',B2:'Boss Gate 2',S7:'Academic Tone Battle'};
    return map[sid(id)] || sid(id);
  }

  function statusRows(state){
    var sp=state.sessionProgress||{};
    var rs=state.routeStatus||{};
    return routeOrder().map(function(id){
      var row=sp[id]||rs[id]||sp[sn(id)]||{};
      var scores=row.scores||{};
      var passed=Array.isArray(row.passed)?row.passed.map(function(x){return text(x).toLowerCase();}):[];
      var required=Array.isArray(row.required)?row.required.map(text):[];
      if(!required.length){ required = sid(id).charAt(0)==='B' ? SKILLS : ['Reading','Writing']; }
      var complete = row.complete===true || row.completed===true || (required.length && required.every(function(sk){ return score(scores[sk])>=PASS || passed.indexOf(sk.toLowerCase())>=0; }));
      return {id:sid(id), title:routeTitle(id), required:required, scores:scores, passed:passed, complete:complete};
    });
  }

  function currentRoute(state, rows){
    var c=sid(state.currentRoute||state.currentCloudRoute||localStorage.getItem('EAP_HERO_ACTIVE_ROUTE')||'');
    if(c) return c;
    var first=rows.find(function(r){ return !r.complete; });
    return first ? first.id : 'S1';
  }

  function render(){
    addStyle();
    var state=read(STATE_KEY,{});
    var p=profile(state);
    var rows=statusRows(state);
    var current=currentRoute(state, rows);
    var done=rows.filter(function(r){return r.complete;}).length;
    var currentRow=rows.find(function(r){return r.id===current;}) || rows[0];
    var htmlRows=rows.map(function(r){
      var cls='card'+(r.complete?' done':'')+(r.id===current?' current':'');
      var skills=r.required.map(function(sk){
        var sc=score(r.scores&&r.scores[sk]);
        var pass=sc>=PASS || r.passed.indexOf(text(sk).toLowerCase())>=0;
        return '<span class="pill '+(pass?'pass':'todo')+'">'+esc(sk)+' '+(pass?'✓':'○')+(sc?(' '+sc):'')+'</span>';
      }).join('');
      return '<div class="'+cls+'"><div class="title">'+esc(r.id)+' · '+esc(r.title)+'</div><div>'+(r.complete?'ผ่านแล้ว':'ยังไม่ครบ')+'</div><div class="skills">'+skills+'</div></div>';
    }).join('');
    app().innerHTML='<section id="'+PAGE_ID+'">'+
      '<h1>My Learning Report</h1>'+ 
      '<p class="sub">รายงานสำรองจาก Cloud/local state ใช้เมื่อหน้ารายงานหลักโหลดไม่สำเร็จ คะแนนจริงยังอ้างอิงจาก Sheet/Cloud Resume</p>'+ 
      '<div class="top"><div class="stat"><b>'+esc(p.studentName)+'</b>ผู้เรียน · ID '+esc(p.studentId)+'</div><div class="stat"><b>'+esc(done)+'/'+esc(rows.length)+'</b>Routes completed</div><div class="stat"><b>'+esc(currentRow.id)+'</b>'+esc(currentRow.title)+'</div></div>'+ 
      '<div class="actions"><button data-eap-report-safe="continue">▶ Continue</button><button class="ghost" data-eap-report-safe="home">🏠 หน้าแรก</button><button class="ghost" data-eap-report-safe="map">🗺️ Map</button></div>'+ 
      '<div class="routes">'+htmlRows+'</div>'+ 
      '</section>';
  }

  function isBlankAfterReport(){
    var root=app();
    var t=text(root.innerText||'');
    if(document.getElementById(PAGE_ID)) return false;
    if(!t) return true;
    if(t.length < 20 && !/EAP Hero|Student Lobby|Session|Report|Profile|Map/i.test(t)) return true;
    return false;
  }

  function afterReportClick(){
    setTimeout(function(){ if(isBlankAfterReport()) render(); }, 900);
    setTimeout(function(){ if(isBlankAfterReport()) render(); }, 2500);
  }

  function go(action){
    try{
      if(action==='map' && window.EAPHero && typeof window.EAPHero.map==='function') return window.EAPHero.map();
      if(action==='home' && window.EAPHero && typeof window.EAPHero.home==='function') return window.EAPHero.home();
      if(action==='continue' && window.EAPHero && typeof window.EAPHero.continue==='function') return window.EAPHero.continue();
    }catch(_){}
    if(action==='continue' || action==='home') location.href=location.pathname+'?v=report-safe-home-'+Date.now();
  }

  document.addEventListener('click', function(e){
    var safe=e.target && e.target.closest && e.target.closest('[data-eap-report-safe]');
    if(safe){ e.preventDefault(); go(safe.getAttribute('data-eap-report-safe')); return; }
    var node=e.target && e.target.closest && e.target.closest('button,a');
    if(!node) return;
    var label=lower(node.textContent||'');
    if(/my learning report|learning report|report/.test(label)) afterReportClick();
  }, true);

  window.EAPReportSafeFallback = { version:VERSION, render:render, recover:afterReportClick };
})();