// === /herohealth/badges-panel.js ===
// HeroHealth Badge Gallery + PID tools (V2: badges by pid, backward-compatible)
//
// Storage:
// - Legacy/global: HHA_BADGES_V1
// - New/by pid:   HHA_BADGES_BY_PID_V2   shape: { [pid]: { [game]: { [badgeId]: {ts:number, meta?:any} } } }
//
// PID:
// - URL param: ?pid=...
// - Fallback: localStorage HHA_PID_V1
//
// UI:
// ✅ PID tools (New/Copy/Clear) — NO override
// ✅ View toggle: "This PID" vs "Global"
// ✅ Migrate: Global -> This PID (only missing)
// ✅ Reset Global / Reset This PID

(function(){
  'use strict';
  const DOC = document;

  const LS_BADGES_V1 = 'HHA_BADGES_V1';
  const LS_BADGES_V2 = 'HHA_BADGES_BY_PID_V2';
  const LS_PID = 'HHA_PID_V1';

  // ---------------- PID helpers ----------------
  function getQS(){
    try{ return new URL(location.href).searchParams; }catch(_){ return new URLSearchParams(); }
  }
  function getPidFromUrl(){
    const q = getQS();
    return String(q.get('pid')||'').trim();
  }
  function loadPid(){
    try{ return String(localStorage.getItem(LS_PID)||'').trim(); }catch(_){ return ''; }
  }
  function savePid(pid){
    try{
      if(pid && String(pid).trim()) localStorage.setItem(LS_PID, String(pid).trim());
      else localStorage.removeItem(LS_PID);
    }catch(_){}
  }
  function getPid(){
    const p = getPidFromUrl() || loadPid() || '';
    if(getPidFromUrl()) savePid(getPidFromUrl()); // remember URL pid as fallback
    return p;
  }

  function setPidInUrlIfMissing(newPid){
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
    const a = Math.random().toString(36).slice(2,7).toUpperCase();
    const b = Math.random().toString(36).slice(2,4).toUpperCase();
    return `P-${a}-${b}`;
  }

  // ---------------- badge store ----------------
  function loadV1(){
    try{ return JSON.parse(localStorage.getItem(LS_BADGES_V1)||'{}') || {}; }catch(_){ return {}; }
  }
  function saveV1(obj){
    try{ localStorage.setItem(LS_BADGES_V1, JSON.stringify(obj||{})); }catch(_){}
  }

  function loadV2(){
    try{ return JSON.parse(localStorage.getItem(LS_BADGES_V2)||'{}') || {}; }catch(_){ return {}; }
  }
  function saveV2(obj){
    try{ localStorage.setItem(LS_BADGES_V2, JSON.stringify(obj||{})); }catch(_){}
  }

  function ensurePidBucket(v2, pid){
    if(!v2[pid]) v2[pid] = {};
    return v2[pid];
  }

  // normalized: convert either V1 or V2 slice to flat list items
  function flattenBadges(obj){
    const items = [];
    for(const game of Object.keys(obj||{})){
      const badges = obj[game] || {};
      for(const id of Object.keys(badges)){
        const b = badges[id] || {};
        items.push({ game, id, ts: Number(b.ts||0), meta: b.meta || null });
      }
    }
    items.sort((a,b)=> (b.ts||0) - (a.ts||0));
    return items;
  }

  function fmt(ts){
    try{
      const d = new Date(ts||Date.now());
      return d.toLocaleDateString('th-TH', { year:'numeric', month:'short', day:'2-digit' });
    }catch(_){ return ''; }
  }

  // ---------------- UI ----------------
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
          <div style="font-weight:950;font-size:16px;display:flex;gap:8px;align-items:center;">🆔 Participant</div>
          <div id="hhaPidValue" style="margin-top:6px;font-weight:950;font-size:14px;">—</div>
          <div style="margin-top:4px;color:rgba(148,163,184,1);font-size:12px;">ใช้ ?pid=... (ไม่ override) • fallback: localStorage</div>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
          <button id="hhaPidNew"  style="border:1px solid rgba(148,163,184,.22);background:rgba(2,6,23,.35);color:rgba(229,231,235,.95);border-radius:14px;padding:8px 10px;font-weight:950;cursor:pointer;">New PID</button>
          <button id="hhaPidCopy" style="border:1px solid rgba(148,163,184,.22);background:rgba(2,6,23,.35);color:rgba(229,231,235,.95);border-radius:14px;padding:8px 10px;font-weight:950;cursor:pointer;">Copy</button>
          <button id="hhaPidClear"style="border:1px solid rgba(148,163,184,.22);background:rgba(2,6,23,.35);color:rgba(229,231,235,.95);border-radius:14px;padding:8px 10px;font-weight:950;cursor:pointer;">Clear</button>
        </div>
      </div>

      <div style="height:12px"></div>

      <!-- Badges header -->
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
        <div>
          <div style="font-weight:950;font-size:16px;">🎖 Badge Gallery</div>
          <div id="hhaBadgeScopeText" style="margin-top:4px;color:rgba(148,163,184,1);font-size:12px;">—</div>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
          <button id="hhaScopePid" style="border:1px solid rgba(148,163,184,.22);background:rgba(2,6,23,.35);color:rgba(229,231,235,.95);border-radius:14px;padding:8px 10px;font-weight:950;cursor:pointer;">This PID</button>
          <button id="hhaScopeGlobal" style="border:1px solid rgba(148,163,184,.22);background:rgba(2,6,23,.35);color:rgba(229,231,235,.95);border-radius:14px;padding:8px 10px;font-weight:950;cursor:pointer;">Global</button>
          <button id="hhaMigrate" style="border:1px solid rgba(148,163,184,.22);background:rgba(2,6,23,.35);color:rgba(229,231,235,.95);border-radius:14px;padding:8px 10px;font-weight:950;cursor:pointer;">Migrate</button>
        </div>
      </div>

      <div id="hhaBadgeGrid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:12px;"></div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
        <button id="hhaResetPid" style="border:1px solid rgba(148,163,184,.22);background:rgba(2,6,23,.35);color:rgba(229,231,235,.95);border-radius:14px;padding:8px 10px;font-weight:900;cursor:pointer;">Reset This PID</button>
        <button id="hhaResetGlobal" style="border:1px solid rgba(148,163,184,.22);background:rgba(2,6,23,.35);color:rgba(229,231,235,.95);border-radius:14px;padding:8px 10px;font-weight:900;cursor:pointer;">Reset Global</button>
      </div>

      <div style="margin-top:10px;color:rgba(148,163,184,1);font-size:12px;">
        V2: แยกเหรียญตาม pid • ยังอ่าน/โชว์ Global (V1) ได้
      </div>
    `;
    return box;
  }

  // scope state per mount (default: pid if available else global)
  function getScope(box){
    return box.dataset.scope || '';
  }
  function setScope(box, scope){
    box.dataset.scope = scope;
  }

  function renderPid(box){
    const el = box.querySelector('#hhaPidValue');
    if(!el) return;
    const pid = getPid();
    el.textContent = pid ? pid : '— (ยังไม่มี pid)';
  }

  function renderScopeText(box){
    const pid = getPid();
    const scope = getScope(box);
    const txt = box.querySelector('#hhaBadgeScopeText');
    if(!txt) return;

    if(scope === 'pid'){
      if(pid) txt.textContent = `scope: pid = ${pid} (V2)`;
      else txt.textContent = 'scope: pid (ยังไม่มี pid — สร้างก่อน)';
    }else{
      txt.textContent = 'scope: global (V1)';
    }

    // button affordance
    const bPid = box.querySelector('#hhaScopePid');
    const bG = box.querySelector('#hhaScopeGlobal');
    if(bPid) bPid.style.opacity = (scope==='pid') ? '1' : '.65';
    if(bG) bG.style.opacity = (scope==='global') ? '1' : '.65';
  }

  function getBadgeObjectForScope(box){
    const pid = getPid();
    const scope = getScope(box);

    if(scope === 'pid'){
      if(!pid) return { obj:{}, label:'pid-missing' };
      const v2 = loadV2();
      const bucket = v2[pid] || {};
      return { obj: bucket, label:'pid' };
    }
    // global
    return { obj: loadV1(), label:'global' };
  }

  function renderBadges(box){
    const grid = box.querySelector('#hhaBadgeGrid');
    if(!grid) return;
    grid.innerHTML = '';

    const { obj, label } = getBadgeObjectForScope(box);
    const items = flattenBadges(obj);

    if(label === 'pid-missing'){
      const empty = DOC.createElement('div');
      empty.style.gridColumn='1 / -1';
      empty.style.color='rgba(148,163,184,1)';
      empty.style.fontWeight='900';
      empty.textContent = 'ยังไม่มี pid — กด New PID ก่อน แล้วค่อยเก็บเหรียญ 🔥';
      grid.appendChild(empty);
      return;
    }

    if(!items.length){
      const empty = DOC.createElement('div');
      empty.style.gridColumn='1 / -1';
      empty.style.color='rgba(148,163,184,1)';
      empty.style.fontWeight='900';
      empty.textContent = (getScope(box)==='pid')
        ? 'PID นี้ยังไม่มีเหรียญ — ไปปราบบอสก่อน! 🔥'
        : 'ยังไม่มีเหรียญ (Global) — ไปปราบบอสก่อน! 🔥';
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

  // --------- MIGRATE: V1 -> V2[pid] (only missing) ----------
  function migrateGlobalToPid(pid){
    if(!pid) return { ok:false, msg:'ไม่มี pid' };

    const v1 = loadV1();
    const v2 = loadV2();
    const bucket = ensurePidBucket(v2, pid);

    let moved = 0;
    for(const game of Object.keys(v1)){
      const g1 = v1[game] || {};
      if(!bucket[game]) bucket[game] = {};
      const g2 = bucket[game];

      for(const badgeId of Object.keys(g1)){
        if(g2[badgeId]) continue; // only missing
        g2[badgeId] = g1[badgeId];
        moved++;
      }
    }

    saveV2(v2);
    return { ok:true, moved };
  }

  function resetPidBadges(pid){
    if(!pid) return { ok:false, msg:'ไม่มี pid' };
    const v2 = loadV2();
    if(v2[pid]){
      delete v2[pid];
      saveV2(v2);
      return { ok:true };
    }
    return { ok:true };
  }

  // ---------------- bind ----------------
  function bind(box){
    // initial scope
    const hasPid = !!getPid();
    if(!getScope(box)) setScope(box, hasPid ? 'pid' : 'global');

    // scope buttons
    box.querySelector('#hhaScopePid')?.addEventListener('click', ()=>{
      setScope(box, 'pid');
      renderScopeText(box);
      renderBadges(box);
    });
    box.querySelector('#hhaScopeGlobal')?.addEventListener('click', ()=>{
      setScope(box, 'global');
      renderScopeText(box);
      renderBadges(box);
    });

    // pid buttons
    box.querySelector('#hhaPidNew')?.addEventListener('click', ()=>{
      const pid = makePid();
      const res = setPidInUrlIfMissing(pid);
      if(!res.changed){
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
      if(!pid){ alert('ยังไม่มี pid ให้คัดลอก'); return; }
      const ok = await copyText(pid);
      if(!ok) alert('คัดลอกไม่สำเร็จ');
    });

    box.querySelector('#hhaPidClear')?.addEventListener('click', ()=>{
      savePid('');
      const res = clearPidInUrl();
      if(res.changed) location.href = res.url;
      else{
        renderPid(box);
        // if pid cleared, auto fallback to global
        setScope(box, 'global');
        renderScopeText(box);
        renderBadges(box);
      }
    });

    // migrate button
    box.querySelector('#hhaMigrate')?.addEventListener('click', ()=>{
      const pid = getPid();
      if(!pid){
        alert('ยังไม่มี pid — สร้าง pid ก่อนแล้วค่อย migrate');
        return;
      }
      const r = migrateGlobalToPid(pid);
      if(!r.ok){ alert(r.msg || 'migrate ไม่สำเร็จ'); return; }
      alert(`Migrate เสร็จ ✅\nย้าย/คัดลอกเข้า pid=${pid} เพิ่ม ${r.moved} เหรียญ (เฉพาะที่ยังไม่มี)`);
      // switch to pid scope after migrate
      setScope(box, 'pid');
      renderScopeText(box);
      renderBadges(box);
    });

    // reset pid/global
    box.querySelector('#hhaResetPid')?.addEventListener('click', ()=>{
      const pid = getPid();
      if(!pid){ alert('ยังไม่มี pid'); return; }
      if(!confirm('Reset เหรียญของ PID นี้ทั้งหมด?')) return;
      resetPidBadges(pid);
      setScope(box, 'pid');
      renderScopeText(box);
      renderBadges(box);
    });

    box.querySelector('#hhaResetGlobal')?.addEventListener('click', ()=>{
      if(!confirm('Reset เหรียญ Global (V1) ทั้งหมด?')) return;
      try{ localStorage.removeItem(LS_BADGES_V1); }catch(_){}
      setScope(box, 'global');
      renderScopeText(box);
      renderBadges(box);
    });

    // refresh triggers (รองรับหลาย event)
    const rerender = ()=>{
      // if PID appears, default scope could stay; but refresh text & badges
      renderPid(box);
      renderScopeText(box);
      renderBadges(box);
    };
    window.addEventListener('popstate', rerender);
    window.addEventListener('hha:badge', rerender);
    window.addEventListener('brush:badge', rerender);
  }

  function mount(selector){
    const host = DOC.querySelector(selector) || DOC.body;
    const box = ensure();
    host.appendChild(box);

    // init render
    renderPid(box);
    renderScopeText(box);
    renderBadges(box);
    bind(box);
  }

  window.HHA_BadgesPanel = { mount };
})();