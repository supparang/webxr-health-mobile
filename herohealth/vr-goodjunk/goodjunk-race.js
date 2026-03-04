// === /herohealth/vr-goodjunk/goodjunk-race.js ===
// GoodJunkVR RACE Controller — teacher countdown + shareable startAt
// FULL v20260304f-RACE-STARTAT-OVERLAY
'use strict';

(function(){
  const WIN = window;
  const DOC = document;

  const qs = (k, d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } };
  const clamp = (v,a,b)=>{ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b, v)); };
  const nowMs = ()=> (performance && performance.now) ? performance.now() : Date.now();

  const mode = String(qs('mode','')).toLowerCase();
  if(mode !== 'race') return;

  // Safety: ensure wait=1 was applied by run page
  try{
    if(typeof WIN.__GJ_SET_PAUSED__ === 'function') WIN.__GJ_SET_PAUSED__(true);
  }catch(e){}

  const host = (String(qs('host','0')) === '1');
  const startIn = clamp(qs('startIn', host ? '8' : '0'), 0, 60); // seconds
  let startAt = Number(qs('startAt','')) || 0; // epoch ms

  const overlay = DOC.createElement('div');
  overlay.style.position='fixed';
  overlay.style.inset='0';
  overlay.style.zIndex='300';
  overlay.style.display='flex';
  overlay.style.alignItems='center';
  overlay.style.justifyContent='center';
  overlay.style.padding='14px';
  overlay.style.background='rgba(2,6,23,.72)';
  overlay.style.backdropFilter='blur(8px)';
  overlay.style.webkitBackdropFilter='blur(8px)';

  overlay.innerHTML = `
    <div style="
      width:min(760px, 100%);
      border:1px solid rgba(148,163,184,.18);
      background:rgba(2,6,23,.78);
      border-radius:22px;
      padding:14px 14px;
      box-shadow:0 26px 90px rgba(0,0,0,.55);
      color:rgba(229,231,235,.96);
      font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;
    ">
      <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
        <div style="font:1000 18px/1.2 system-ui;">🏁 RACE — เริ่มพร้อมกัน</div>
        <div style="opacity:.8; font-weight:900;">mode=race</div>
      </div>

      <div style="height:10px"></div>

      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <div style="flex:1; min-width:220px; border:1px solid rgba(148,163,184,.14); background:rgba(148,163,184,.06); border-radius:18px; padding:10px 12px;">
          <div style="opacity:.85; font-weight:900;">สถานะ</div>
          <div style="height:6px"></div>
          <div id="raceStatus" style="font:1000 16px/1.2 system-ui;">รอ start…</div>
          <div style="height:10px"></div>
          <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
            <div style="font:1000 56px/1 system-ui;" id="raceCount">—</div>
            <div style="opacity:.85; font-weight:900;" id="raceSub">วินาที</div>
          </div>
        </div>

        <div style="flex:1; min-width:220px; border:1px solid rgba(148,163,184,.14); background:rgba(148,163,184,.06); border-radius:18px; padding:10px 12px;">
          <div style="opacity:.85; font-weight:900;">ลิงก์เริ่มพร้อมกัน</div>
          <div style="height:6px"></div>
          <div style="opacity:.85; font-weight:900; font-size:12px; line-height:1.35;">
            วิธีใช้: ให้ทุกคนเปิด “ลิงก์เดียวกัน” ที่มี startAt เหมือนกัน แล้วระบบจะนับถอยหลังและเริ่มเอง
          </div>
          <div style="height:10px"></div>
          <input id="raceLink" readonly value="" style="
            width:100%;
            border:1px solid rgba(148,163,184,.18);
            background:rgba(2,6,23,.55);
            color:rgba(229,231,235,.96);
            border-radius:14px;
            padding:10px 12px;
            font-weight:900;
          "/>
          <div style="height:10px"></div>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button id="btnMake" style="
              border-radius:16px; border:1px solid rgba(34,197,94,.28);
              background:rgba(34,197,94,.14); color:rgba(229,231,235,.96);
              padding:10px 12px; font-weight:1000; cursor:pointer; min-height:42px;
            ">สร้าง startAt ใหม่</button>

            <button id="btnCopy" style="
              border-radius:16px; border:1px solid rgba(148,163,184,.22);
              background:rgba(148,163,184,.10); color:rgba(229,231,235,.96);
              padding:10px 12px; font-weight:1000; cursor:pointer; min-height:42px;
            ">คัดลอกลิงก์</button>

            <button id="btnStartNow" style="
              border-radius:16px; border:1px solid rgba(239,68,68,.28);
              background:rgba(239,68,68,.14); color:rgba(229,231,235,.96);
              padding:10px 12px; font-weight:1000; cursor:pointer; min-height:42px;
            ">เริ่มเดี๋ยวนี้</button>
          </div>
        </div>
      </div>

      <div style="height:10px"></div>
      <div style="opacity:.75; font-weight:900; font-size:12px;">
        Tip: เปิดเป็นครูใช้ <b>?mode=race&host=1</b> เพื่อกดสร้างลิงก์ แล้วส่งให้เด็กทุกคนเปิดลิงก์เดียวกัน
      </div>
    </div>
  `;
  DOC.body.appendChild(overlay);

  const $ = (id)=> overlay.querySelector('#'+id);
  const statusEl = $('raceStatus');
  const countEl  = $('raceCount');
  const subEl    = $('raceSub');
  const linkEl   = $('raceLink');
  const btnMake  = $('btnMake');
  const btnCopy  = $('btnCopy');
  const btnStartNow = $('btnStartNow');

  function buildLink(startAtMs){
    const u = new URL(location.href);
    u.searchParams.set('mode','race');
    u.searchParams.set('wait','1');
    u.searchParams.set('startAt', String(Math.round(startAtMs)));
    u.searchParams.delete('host');
    u.searchParams.delete('startIn');
    return u.toString();
  }

  function refreshLink(){
    if(startAt>0) linkEl.value = buildLink(startAt);
    else linkEl.value = '(ยังไม่มี startAt) กด “สร้าง startAt ใหม่”';
  }

  function setStatus(s, n){
    if(statusEl) statusEl.textContent = s;
    if(countEl) countEl.textContent = (n==null) ? '—' : String(n);
  }

  async function copyText(txt){
    try{
      await navigator.clipboard.writeText(txt);
      setStatus('คัดลอกแล้ว ✅', null);
    }catch(e){
      // fallback: select
      try{
        linkEl.focus(); linkEl.select();
        document.execCommand('copy');
        setStatus('คัดลอกแล้ว ✅', null);
      }catch(_){}
    }
  }

  function startGameNow(){
    try{ WIN.__GJ_START_NOW__?.(); }catch(e){}
    try{ WIN.__GJ_SET_PAUSED__?.(false); }catch(e){}
    overlay.remove();
  }

  btnStartNow.addEventListener('click', ()=>{
    startAt = 0;
    startGameNow();
  });

  btnCopy.addEventListener('click', ()=>{
    if(startAt<=0) return;
    copyText(buildLink(startAt));
  });

  btnMake.addEventListener('click', ()=>{
    // Make a startAt in the near future (client epoch-based)
    const lead = clamp(qs('lead', String(startIn || 8)), 3, 20);
    startAt = Date.now() + lead*1000;
    refreshLink();
    if(host){
      // auto-copy for host if possible
      copyText(buildLink(startAt));
    }
  });

  // Auto create startAt if host & missing
  if(host && startAt<=0){
    const lead = clamp(String(startIn || 8), 3, 20);
    startAt = Date.now() + lead*1000;
  }
  refreshLink();

  // Countdown loop
  let started = false;
  function tick(){
    if(started) return;
    if(startAt<=0){
      setStatus(host ? 'ครู: พร้อมสร้าง startAt' : 'รอลิงก์ที่มี startAt', null);
      requestAnimationFrame(tick);
      return;
    }

    const msLeft = startAt - Date.now();
    const sLeft = Math.ceil(msLeft/1000);

    if(msLeft > 0){
      setStatus('นับถอยหลัง…', sLeft);
      if(subEl) subEl.textContent = 'วินาที';
      requestAnimationFrame(tick);
      return;
    }

    started = true;
    setStatus('GO! 🚀', 0);
    if(subEl) subEl.textContent = '';
    setTimeout(startGameNow, 60);
  }
  requestAnimationFrame(tick);
})();