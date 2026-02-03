// === /herohealth/badges-panel.js ===
// Tiny badges viewer for HeroHealth HUB + PID tools (NO override)
// ✅ Shows pid from URL (?pid=) or localStorage fallback
// ✅ Buttons: New PID (only if missing), Copy, Clear
// ✅ Badge Gallery unchanged (reads HHA_BADGES_V1)

(function(){
  'use strict';
  const DOC = document;

  const LS_BADGES = 'HHA_BADGES_V1';
  const LS_PID = 'HHA_PID_V1';

  function loadBadges(){
    try{ return JSON.parse(localStorage.getItem(LS_BADGES)||'{}') || {}; }catch(_){ return {}; }
  }

  function savePid(pid){
    try{
      if(pid && String(pid).trim()) localStorage.setItem(LS_PID, String(pid).trim());
      else localStorage.removeItem(LS_PID);
    }catch(_){}
  }

  function loadPid(){
    try{ return String(localStorage.getItem(LS_PID)||'').trim(); }catch(_){ return ''; }
  }

  function getQS(){
    try{ return new URL(location.href).searchParams; }catch(_){ return new URLSearchParams(); }
  }

  function getPidFromUrl(){
    const q = getQS();
    return String(q.get('pid')||'').trim();
  }

  function getPid(){
    return getPidFromUrl() || loadPid() || '';
  }

  function setPidInUrlIfMissing(newPid){
    // เติม pid เฉพาะตอนยังไม่มี (NO override)
    const u = new URL(location.href);
    const cur = String(u.searchParams.get('pid')||'').trim();
    if(cur) return { changed:false, pid:cur, url:u.toString() };

    u.searchParams.set('pid', String(newPid||'').trim());
    return { changed:true, pid:String(newPid||'').trim(), url:u.toString() };
  }

  function clearPidInUrl(){
    const u = new URL(location.href);
    const had = u.searchParams.has('pid');
    u.searchParams.delete('pid');
    return { changed:had, url:u.toString() };
  }

  function makePid(){
    // short readable token
    // example: P-8K2FQ-7D
    const a = Math.random().toString(36).slice(2,7).toUpperCase();
    const b = Math.random().toString(36).slice(2,4).toUpperCase();
    return `P-${a}-${b}`;
  }

  function fmt(ts){
    try{
      const d = new Date(ts||Date.now());
      return d.toLocaleDateString('th-TH', { year:'numeric', month:'short', day:'2-digit' });
    }catch(_){ return ''; }
  }

  function ensure(){
    let box = DOC.getElementById('hhaBadges');
    if(box) return box;

    box = DOC.createElement('section');
    box.id = 'hhaBadges';
    box.style.border='1px solid rgba(148,163,184,.18)';
    box.style.borderRadius='22px';
    box.style.padding='14px';
    box.style.background='rgba(2,6,23,.45)';
    box.style.backdropFilter='blur(10px)';
    box.style.webkitBackdropFilter='blur(10px)';
    box.style.boxShadow='0 18px 60px rgba(0,0,0,.35)';
    box.style.color='rgba(229,231,235,.95)';

    box.innerHTML = `
      <!-- PID panel -->
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;">
        <div>
          <div style="font-weight:950;font-size:16px;display:flex;gap:8px;align-items:center;">
            🆔 Participant
          </div>
          <div id="hhaPidValue" style="margin-top:6px;font-weight:950;font-size:14px;color:rgba(229,231,235,.95);">
            —
          </div>
          <div style="margin-top:4px;color:rgba(148,163,184,1);font-size:12px;">
            ใช้ ?pid=... (ไม่ override) • fallback: localStorage
          </div>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
          <button id="hhaPidNew"
            style="border:1px solid rgba(148,163,184,.22);background:rgba(2,6,23,.35);color:rgba(229,231,235,.95);border-radius:14px;padding:8px 10px;font-weight:950;cursor:pointer;">
            New PID
          </button>
          <button id="hhaPidCopy"
            style="border:1px solid rgba(148,163,184,.22);background:rgba(2,6,23,.35);color:rgba(229,231,235,.95);border-radius:14px;padding:8px 10px;font-weight:950;cursor:pointer;">
            Copy
          </button>
          <button id="hhaPidClear"
            style="border:1px solid rgba(148,163,184,.22);background:rgba(2,6,23,.35);color:rgba(229,231,235,.95);border-radius:14px;padding:8px 10px;font-weight:950;cursor:pointer;">
            Clear
          </button>
        </div>
      </div>

      <div style="height:12px"></div>

      <!-- Badge gallery header -->
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
        <div style="font-weight:950;font-size:16px;">🎖 Badge Gallery</div>
        <button id="hhaBadgeReset"
          style="border:1px solid rgba(148,163,184,.22);background:rgba(2,6,23,.35);color:rgba(229,231,235,.95);border-radius:14px;padding:8px 10px;font-weight:900;cursor:pointer;">
          Reset
        </button>
      </div>

      <div id="hhaBadgeGrid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:12px;"></div>
      <div style="margin-top:10px;color:rgba(148,163,184,1);font-size:12px;">
        เก็บเหรียญจากทุกเกมใน HeroHealth (localStorage)
      </div>
    `;
    return box;
  }

  function renderPid(box){
    const el = box.querySelector('#hhaPidValue');
    if(!el) return;

    const pidUrl = getPidFromUrl();
    const pid = getPid();

    if(pidUrl){
      // ถ้ามาจาก URL ให้จำเป็น fallback ด้วย
      savePid(pidUrl);
    }

    el.textContent = pid ? pid : '— (ยังไม่มี pid)';
  }

  function renderBadges(box){
    const grid = box.querySelector('#hhaBadgeGrid');
    if(!grid) return;
    grid.innerHTML = '';

    const data = loadBadges();
    const items = [];

    for(const game of Object.keys(data)){
      const badges = data[game] || {};
      for(const id of Object.keys(badges)){
        items.push({ game, id, ts: badges[id]?.ts || 0 });
      }
    }
    items.sort((a,b)=> (b.ts||0) - (a.ts||0));

    if(!items.length){
      const empty = DOC.createElement('div');
      empty.style.gridColumn='1 / -1';
      empty.style.color='rgba(148,163,184,1)';
      empty.style.fontWeight='900';
      empty.textContent = 'ยังไม่มีเหรียญ — ไปปราบบอสก่อน! 🔥';
      grid.appendChild(empty);
      return;
    }

    for(const it of items.slice(0, 20)){
      const card = DOC.createElement('div');
      card.style.border='1px solid rgba(148,163,184,.16)';
      card.style.borderRadius='18px';
      card.style.padding='10px';
      card.style.background='rgba(2,6,23,.35)';
      card.innerHTML = `
        <div style="font-weight:950">${it.id}</div>
        <div style="margin-top:4px;color:rgba(148,163,184,1);font-size:12px;">
          game: ${it.game} • ${fmt(it.ts)}
        </div>
      `;
      grid.appendChild(card);
    }
  }

  async function copyText(txt){
    try{
      await navigator.clipboard.writeText(String(txt||''));
      return true;
    }catch(_){
      // fallback: select-copy (old browsers)
      try{
        const ta = DOC.createElement('textarea');
        ta.value = String(txt||'');
        ta.style.position='fixed';
        ta.style.left='-9999px';
        DOC.body.appendChild(ta);
        ta.select();
        DOC.execCommand('copy');
        ta.remove();
        return true;
      }catch(__){
        return false;
      }
    }
  }

  function bind(box){
    // PID buttons
    box.querySelector('#hhaPidNew')?.addEventListener('click', ()=>{
      const pid = makePid();
      const res = setPidInUrlIfMissing(pid);
      if(!res.changed){
        // NO override — ถ้ามีอยู่แล้ว แค่จำค่าเป็น fallback และแจ้ง
        savePid(res.pid);
        renderPid(box);
        alert('มี pid อยู่แล้ว (ไม่ override): ' + res.pid + '\nถ้าจะเปลี่ยน ให้กด Clear ก่อน');
        return;
      }
      savePid(res.pid);
      location.href = res.url;
    });

    box.querySelector('#hhaPidCopy')?.addEventListener('click', async ()=>{
      const pid = getPid();
      if(!pid){
        alert('ยังไม่มี pid ให้คัดลอก');
        return;
      }
      const ok = await copyText(pid);
      if(!ok) alert('คัดลอกไม่สำเร็จ');
    });

    box.querySelector('#hhaPidClear')?.addEventListener('click', ()=>{
      // ลบจาก URL และ localStorage fallback
      savePid('');
      const res = clearPidInUrl();
      if(res.changed){
        location.href = res.url;
      }else{
        renderPid(box);
      }
    });

    // Badge reset
    box.querySelector('#hhaBadgeReset')?.addEventListener('click', ()=>{
      try{ localStorage.removeItem(LS_BADGES); }catch(_){}
      renderBadges(box);
    });

    // Refresh triggers (คุณเติม event เพิ่มได้)
    window.addEventListener('brush:badge', ()=>renderBadges(box));
    window.addEventListener('hha:badge', ()=>renderBadges(box)); // เผื่อมาตรฐานใหม่ในอนาคต
    window.addEventListener('popstate', ()=>renderPid(box));      // เปลี่ยน URL แล้ว update
  }

  function mount(selector){
    const host = DOC.querySelector(selector) || DOC.body;
    const box = ensure();
    host.appendChild(box);

    renderPid(box);
    renderBadges(box);
    bind(box);
  }

  window.HHA_BadgesPanel = { mount };
})();