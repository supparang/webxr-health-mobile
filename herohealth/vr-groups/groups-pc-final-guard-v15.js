// === /herohealth/vr-groups/groups-pc-final-guard-v15.js ===
// HeroHealth Groups PC — v1.5 Final QA Guard
// Adds stuck-state watcher, rescue panel, summary verification, safe return fallback.

(function(){
  'use strict';

  const VERSION = 'v1.5-pc-final-qa-guard-20260514';
  if(window.__HHA_GROUPS_PC_GUARD_V15__) return;
  window.__HHA_GROUPS_PC_GUARD_V15__ = true;

  const WIN = window;
  const DOC = document;

  const state = {
    startedAt:Date.now(),
    lastSig:'',
    lastProgressAt:Date.now(),
    rescueShown:false,
    errorCount:0,
    lastError:'',
    summaryChecked:false,
    timer:null
  };

  const $ = id => DOC.getElementById(id);

  function qs(name,fallback=''){
    try{return new URL(location.href).searchParams.get(name) || fallback;}
    catch(e){return fallback;}
  }

  function api(){ return WIN.HHA_GROUPS_PC_V1 || null; }

  function gs(){
    try{
      const a = api();
      return a && typeof a.getState === 'function' ? (a.getState() || {}) : {};
    }catch(e){ return {}; }
  }

  function zoneUrl(){
    const hub = qs('hub','');
    if(hub && hub.includes('nutrition-zone.html')) return hub;

    const u = new URL('https://supparang.github.io/webxr-health-mobile/herohealth/nutrition-zone.html');
    ['pid','name','diff','time','view','seed','studyId','conditionGroup'].forEach(k=>{
      const v = qs(k,'');
      if(v) u.searchParams.set(k,v);
    });
    u.searchParams.set('zone','nutrition');
    u.searchParams.set('from','groups-pc-v15');
    u.searchParams.set('hub','https://supparang.github.io/webxr-health-mobile/herohealth/hub.html');
    return u.toString();
  }

  function injectStyle(){
    if($('groups-pc-v15-style')) return;

    const s = DOC.createElement('style');
    s.id = 'groups-pc-v15-style';
    s.textContent = `
      .pc-v15-toast{
        position:fixed;
        left:50%;
        bottom:24px;
        z-index:2147482500;
        width:min(560px,calc(100vw - 32px));
        transform:translateX(-50%);
        border-radius:24px;
        padding:13px 16px;
        background:rgba(36,78,104,.96);
        color:#fff;
        box-shadow:0 22px 66px rgba(35,81,107,.34);
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        font-size:14px;
        line-height:1.35;
        font-weight:900;
        text-align:center;
        display:none;
      }

      .pc-v15-toast.show{display:block;animation:pcv15Toast .22s ease both;}

      @keyframes pcv15Toast{
        from{opacity:0;transform:translateX(-50%) translateY(8px);}
        to{opacity:1;transform:translateX(-50%) translateY(0);}
      }

      .pc-v15-rescue{
        position:fixed;
        right:18px;
        bottom:18px;
        z-index:2147482600;
        width:min(420px,calc(100vw - 36px));
        border-radius:30px;
        padding:16px;
        background:linear-gradient(145deg,rgba(255,255,255,.98),rgba(239,251,255,.96));
        color:#244e68;
        box-shadow:0 28px 84px rgba(35,81,107,.36);
        border:2px solid rgba(255,255,255,.92);
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        display:none;
      }

      .pc-v15-rescue.show{display:block;animation:pcv15Rescue .22s ease both;}

      @keyframes pcv15Rescue{
        from{opacity:0;transform:translateY(10px) scale(.98);}
        to{opacity:1;transform:translateY(0) scale(1);}
      }

      .pc-v15-rescue h3{margin:0;font-size:19px;font-weight:1000;}
      .pc-v15-rescue p{margin:8px 0 13px;color:#7193a8;font-size:13px;line-height:1.35;font-weight:850;}
      .pc-v15-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
      .pc-v15-actions button{border:0;border-radius:999px;padding:11px 10px;font:inherit;font-size:13px;font-weight:1000;background:#fff;box-shadow:0 10px 26px rgba(35,81,107,.14);color:#244e68;cursor:pointer;}
      .pc-v15-actions button.primary{background:linear-gradient(135deg,#ffb347,#ff8f3d);color:#fff;}
      .pc-v15-actions button.zone{background:linear-gradient(135deg,#eaffda,#ffffff);}
    `;
    DOC.head.appendChild(s);
  }

  function ensureUi(){
    if(!$('pcv15Toast')){
      const t = DOC.createElement('div');
      t.id = 'pcv15Toast';
      t.className = 'pc-v15-toast';
      DOC.body.appendChild(t);
    }

    if(!$('pcv15Rescue')){
      const r = DOC.createElement('div');
      r.id = 'pcv15Rescue';
      r.className = 'pc-v15-rescue';
      r.innerHTML = `
        <h3>🛟 PC Rescue</h3>
        <p id="pcv15RescueText">ถ้าเกมค้างหรือปุ่มไม่ตอบสนอง ใช้ปุ่มด้านล่างเพื่อกู้สถานะ</p>
        <div class="pc-v15-actions">
          <button id="pcv15Continue" class="primary" type="button">เล่นต่อ</button>
          <button id="pcv15End" type="button">จบเกม</button>
          <button id="pcv15Replay" type="button">เริ่มใหม่</button>
          <button id="pcv15Zone" class="zone" type="button">Nutrition Zone</button>
        </div>
      `;
      DOC.body.appendChild(r);
    }
  }

  function toast(msg, ms=2400){
    const el = $('pcv15Toast');
    if(!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el.__timer);
    el.__timer = setTimeout(()=>el.classList.remove('show'), ms);
  }

  function showRescue(reason){
    const box = $('pcv15Rescue');
    const txt = $('pcv15RescueText');
    if(!box) return;

    state.rescueShown = true;
    if(txt) txt.textContent = reason || 'ตรวจพบว่าเกมอาจค้างหรือไม่มีความคืบหน้า';
    box.classList.add('show');
  }

  function hideRescue(){
    const box = $('pcv15Rescue');
    if(box) box.classList.remove('show');
    state.rescueShown = false;
  }

  function signature(s){
    return [
      s.mode,
      s.score,
      s.correct,
      s.miss,
      s.combo,
      s.items,
      s.phase
    ].join('|');
  }

  function guardCore(){
    if(api()) return true;
    if(Date.now() - state.startedAt > 2400){
      showRescue('ยังไม่พบ Core เกม PC อาจโหลด groups-pc.html ไม่ครบ ลองเริ่มใหม่หรือกลับ Nutrition Zone');
    }
    return false;
  }

  function guardStuck(s){
    if(!s || s.mode !== 'game' || s.ended) return;

    const sig = signature(s);
    if(sig !== state.lastSig){
      state.lastSig = sig;
      state.lastProgressAt = Date.now();
      if(state.rescueShown) hideRescue();
    }

    const noProgress = Date.now() - state.lastProgressAt;
    if(noProgress > 15000 && !state.rescueShown){
      showRescue('ดูเหมือนเกมไม่มีความคืบหน้านานเกินไป ถ้าอาหารไม่ตกหรือคลิกไม่ได้ ให้กดจบเกม/เริ่มใหม่');
    }
  }

  function guardSummary(s){
    if(!s || s.mode !== 'summary' || state.summaryChecked) return;
    state.summaryChecked = true;

    setTimeout(()=>{
      try{
        const raw = localStorage.getItem('HHA_GROUPS_PC_SUMMARY');
        if(!raw) toast('ยังไม่พบ PC summary ในเครื่อง แต่หน้าสรุปยังใช้งานได้');
      }catch(e){
        toast('อ่าน PC summary storage ไม่สำเร็จ');
      }

      const zoneBtn = $('zoneBtn');
      if(zoneBtn && !zoneBtn.__pcv15){
        zoneBtn.__pcv15 = true;
        zoneBtn.addEventListener('click', ()=>{
          setTimeout(()=>{
            if(location.href.includes('groups-pc.html')) location.href = zoneUrl();
          },250);
        });
      }
    },420);
  }

  function loop(){
    if(!guardCore()) return;

    const s = gs();
    guardStuck(s);
    guardSummary(s);
  }

  function installEvents(){
    $('pcv15Continue')?.addEventListener('click', ()=>{
      hideRescue();
      toast('กลับเข้าเกมแล้ว');
    });

    $('pcv15End')?.addEventListener('click', ()=>{
      hideRescue();
      try{
        const a = api();
        if(a && typeof a.end === 'function'){
          a.end('pc-v15-rescue-end');
          return;
        }
      }catch(e){}
      location.reload();
    });

    $('pcv15Replay')?.addEventListener('click', ()=>{
      const u = new URL(location.href);
      u.searchParams.set('seed', String(Date.now()));
      u.searchParams.set('v', VERSION);
      location.href = u.toString();
    });

    $('pcv15Zone')?.addEventListener('click', ()=>{
      location.href = zoneUrl();
    });

    WIN.addEventListener('groups-pc:judge', ()=>{
      state.lastProgressAt = Date.now();
      if(state.rescueShown) hideRescue();
    });

    WIN.addEventListener('groups:end', ()=>{
      state.lastProgressAt = Date.now();
      setTimeout(()=>guardSummary(gs()), 350);
    });

    WIN.addEventListener('error', ev=>{
      state.errorCount += 1;
      state.lastError = String(ev.message || 'error').slice(0,160);
      if(state.errorCount >= 2 && !state.rescueShown) showRescue('ตรวจพบ error ซ้ำใน PC Solo ถ้าเล่นต่อไม่ได้ให้ใช้ปุ่มกู้สถานะ');
    });

    WIN.addEventListener('unhandledrejection', ev=>{
      state.errorCount += 1;
      state.lastError = String((ev.reason && ev.reason.message) || ev.reason || 'promise error').slice(0,160);
      if(state.errorCount >= 2 && !state.rescueShown) showRescue('ตรวจพบ promise error ซ้ำใน PC Solo ถ้าเล่นต่อไม่ได้ให้ใช้ปุ่มกู้สถานะ');
    });

    let taps = [];
    DOC.addEventListener('pointerdown', ev=>{
      if(ev.clientX > 100 || ev.clientY > 100) return;
      const t = Date.now();
      taps = taps.filter(x=>t-x<900);
      taps.push(t);
      if(taps.length >= 3){
        taps = [];
        showRescue('เปิด PC Rescue ด้วยการคลิกมุมซ้ายบน 3 ครั้ง');
      }
    }, {passive:true});
  }

  function expose(){
    WIN.HHA_GROUPS_PC_V15_QA = {
      version:VERSION,
      showRescue,
      hideRescue,
      zoneUrl,
      getState:()=>({
        version:VERSION,
        coreLoaded:Boolean(api()),
        rescueShown:state.rescueShown,
        errorCount:state.errorCount,
        lastError:state.lastError,
        gameState:gs()
      })
    };
  }

  function init(){
    injectStyle();
    ensureUi();
    installEvents();
    expose();

    state.timer = setInterval(loop, 1000);

    setTimeout(()=>{
      if(api()) toast('Groups PC พร้อมเล่นแล้ว', 1400);
    },900);

    console.info('[Groups PC v1.5] final QA guard installed', VERSION);
  }

  if(DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
