// === /herohealth/badges-panel.js ===
// Tiny badges viewer for HeroHealth HUB
(function(){
  'use strict';
  const DOC = document;
  const LS = 'HHA_BADGES_V1';

  function load(){
    try{ return JSON.parse(localStorage.getItem(LS)||'{}') || {}; }catch(_){ return {}; }
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
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
        <div style="font-weight:950;font-size:16px;">🎖 Badge Gallery</div>
        <button id="hhaBadgeReset" style="border:1px solid rgba(148,163,184,.22);background:rgba(2,6,23,.35);color:rgba(229,231,235,.95);border-radius:14px;padding:8px 10px;font-weight:900;cursor:pointer;">Reset</button>
      </div>
      <div id="hhaBadgeGrid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:12px;"></div>
      <div style="margin-top:10px;color:rgba(148,163,184,1);font-size:12px;">เก็บเหรียญจากทุกเกมใน HeroHealth (localStorage)</div>
    `;
    return box;
  }

  function render(box){
    const grid = box.querySelector('#hhaBadgeGrid');
    if(!grid) return;
    grid.innerHTML = '';

    const data = load();
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
        <div style="margin-top:4px;color:rgba(148,163,184,1);font-size:12px;">game: ${it.game} • ${fmt(it.ts)}</div>
      `;
      grid.appendChild(card);
    }
  }

  function mount(selector){
    const host = DOC.querySelector(selector) || DOC.body;
    const box = ensure();
    host.appendChild(box);
    render(box);

    box.querySelector('#hhaBadgeReset')?.addEventListener('click', ()=>{
      try{ localStorage.removeItem(LS); }catch(_){}
      render(box);
    });

    window.addEventListener('brush:badge', ()=>render(box));
  }

  window.HHA_BadgesPanel = { mount };
})();