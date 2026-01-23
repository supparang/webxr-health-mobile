// === /herohealth/hub/hha-hygiene-store.js ===
// Hygiene Progress + Store (Coins/Stars) for HUB
// Reads: HHA_HYGIENE_STORY, HHA_HYGIENE_REWARDS
// Writes: HHA_HYGIENE_UNLOCKS (cosmetics/title unlocks)

(function(){
  'use strict';

  const LS_STORY  = 'HHA_HYGIENE_STORY';
  const LS_REWARD = 'HHA_HYGIENE_REWARDS';
  const LS_UNLOCK = 'HHA_HYGIENE_UNLOCKS';

  const clamp = (v,min,max)=>Math.max(min, Math.min(max, Number(v)||0));

  function loadJson(key, fb){
    try{ const s = localStorage.getItem(key); return s ? JSON.parse(s) : fb; }catch{ return fb; }
  }
  function saveJson(key, obj){
    try{ localStorage.setItem(key, JSON.stringify(obj)); }catch{}
  }

  function todayKey(){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const da= String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${da}`;
  }

  function getStory(){
    const fb = { unlockedDay:1, lastDayPlayed:1, clearedDays:[] };
    const s = loadJson(LS_STORY, fb);
    if(!s || typeof s !== 'object') return fb;
    if(!Array.isArray(s.clearedDays)) s.clearedDays = [];
    s.unlockedDay = clamp(s.unlockedDay||1, 1, 3);
    s.lastDayPlayed = clamp(s.lastDayPlayed||1, 1, 3);
    return s;
  }

  function getRewards(){
    const fb = { coins:0, stars:0, lastEarnIso:'', byDay:{} };
    const r = loadJson(LS_REWARD, fb);
    if(!r || typeof r !== 'object') return fb;
    if(!r.byDay || typeof r.byDay !== 'object') r.byDay = {};
    r.coins = clamp(r.coins||0, 0, 1e9);
    r.stars = clamp(r.stars||0, 0, 1e9);
    return r;
  }

  function getUnlocks(){
    const fb = {
      owned: {},          // id -> true
      equipped: {         // current cosmetic selection
        frame: 'frame-default',
        aura:  'aura-off',
        badge: 'badge-none',
        title: 'title-none'
      },
      daily: { lastClaimKey:'', streak:0 } // optional daily claim
    };
    const u = loadJson(LS_UNLOCK, fb);
    if(!u || typeof u !== 'object') return fb;
    if(!u.owned || typeof u.owned !== 'object') u.owned = {};
    if(!u.equipped || typeof u.equipped !== 'object') u.equipped = fb.equipped;
    if(!u.daily || typeof u.daily !== 'object') u.daily = fb.daily;
    return u;
  }

  // --- Store items: cosmetic only (no gameplay effect)
  const ITEMS = [
    { id:'frame-default', name:'กรอบเป้า: มาตรฐาน', desc:'ใช้ได้เสมอ', priceCoin:0, priceStar:0, type:'frame', icon:'🟦', always:true },
    { id:'frame-soap',    name:'กรอบเป้า: สบู่วิ้ง', desc:'กรอบเขียวสบู่ + วิ้งเบา ๆ', priceCoin:40, priceStar:0, type:'frame', icon:'🧼' },
    { id:'frame-ice',     name:'กรอบเป้า: น้ำแข็ง', desc:'กรอบฟ้าเย็น ๆ', priceCoin:50, priceStar:0, type:'frame', icon:'🧊' },

    { id:'aura-off',      name:'Aura: ปิด', desc:'ไม่มีออร่า', priceCoin:0, priceStar:0, type:'aura', icon:'⚪', always:true },
    { id:'aura-spark',    name:'Aura: ประกาย', desc:'ออร่าประกายรอบ HUD', priceCoin:0, priceStar:4, type:'aura', icon:'✨' },
    { id:'aura-hero',     name:'Aura: ฮีโร่', desc:'ออร่าฮีโร่ (พาสเทล)', priceCoin:0, priceStar:7, type:'aura', icon:'🌈' },

    { id:'badge-none',    name:'Badge: ไม่มี', desc:'ไม่โชว์แบดจ์', priceCoin:0, priceStar:0, type:'badge', icon:'—', always:true },
    { id:'badge-day1',    name:'Badge: Day 1', desc:'ผ่าน Day 1', priceCoin:0, priceStar:2, type:'badge', icon:'📚' },
    { id:'badge-day2',    name:'Badge: Day 2', desc:'ผ่าน Day 2', priceCoin:0, priceStar:3, type:'badge', icon:'🍛' },
    { id:'badge-day3',    name:'Badge: Day 3', desc:'ผ่าน Day 3', priceCoin:0, priceStar:5, type:'badge', icon:'🛝' },

    { id:'title-none',     name:'ฉายา: (ว่าง)', desc:'ไม่ติดฉายา', priceCoin:0, priceStar:0, type:'title', icon:'🏷️', always:true },
    { id:'title-clean',    name:'ฉายา: มือสะอาด', desc:'โชว์ในสรุปผล', priceCoin:80, priceStar:0, type:'title', icon:'🧼' },
    { id:'title-combo',    name:'ฉายา: คอมโบเทพ', desc:'โชว์ในสรุปผล', priceCoin:0,  priceStar:6, type:'title', icon:'🔥' },
  ];

  // helper
  function $(sel, root=document){ return root.querySelector(sel); }
  function el(tag, cls){ const e=document.createElement(tag); if(cls) e.className=cls; return e; }

  function canAfford(rew, item){
    return (rew.coins >= (item.priceCoin||0)) && (rew.stars >= (item.priceStar||0));
  }

  function buyItem(){
    // no-op; actual buy handled in click
  }

  function equip(unlocks, item){
    unlocks.equipped[item.type] = item.id;
    saveJson(LS_UNLOCK, unlocks);
  }

  function render(root){
    const story = getStory();
    const rew = getRewards();
    const unlocks = getUnlocks();

    // ensure defaults owned
    ITEMS.forEach(it=>{
      if(it.always) unlocks.owned[it.id] = true;
    });
    saveJson(LS_UNLOCK, unlocks);

    root.innerHTML = '';

    // header
    const head = el('div','hh-card-head');
    head.innerHTML = `
      <div class="hh-title">🧼 Hygiene Progress & Store</div>
      <div class="hh-sub">COIN <b id="hhCoins">${rew.coins}</b> • ⭐ <b id="hhStars">${rew.stars}</b> • Unlocked Day <b>${story.unlockedDay}</b>/3</div>
    `;
    root.appendChild(head);

    // progress row
    const prog = el('div','hh-row');
    const cleared = new Set(story.clearedDays || []);
    for(let d=1; d<=3; d++){
      const c = el('div','hh-chip');
      const ok = cleared.has(d);
      const lock = (d > story.unlockedDay);
      c.dataset.day = String(d);
      c.classList.add(ok?'ok':(lock?'lock':'open'));
      c.innerHTML = `<div class="k">Day ${d}</div><div class="v">${ok?'✅ Cleared':(lock?'🔒 Locked':'🟡 Ready')}</div>`;
      prog.appendChild(c);
    }
    root.appendChild(prog);

    // equipped
    const eq = el('div','hh-eq');
    eq.innerHTML = `
      <div class="hh-sub">Equipped: 
        <span class="pill">Frame: <b>${unlocks.equipped.frame}</b></span>
        <span class="pill">Aura: <b>${unlocks.equipped.aura}</b></span>
        <span class="pill">Badge: <b>${unlocks.equipped.badge}</b></span>
        <span class="pill">Title: <b>${unlocks.equipped.title}</b></span>
      </div>
    `;
    root.appendChild(eq);

    // store grid
    const grid = el('div','hh-grid');
    ITEMS.forEach(item=>{
      const owned = !!unlocks.owned[item.id];
      const card = el('button','hh-item');
      card.type='button';
      card.classList.toggle('owned', owned);
      card.innerHTML = `
        <div class="i">${item.icon}</div>
        <div class="n">${item.name}</div>
        <div class="d">${item.desc}</div>
        <div class="p">${(item.priceCoin||0)>0?`🪙${item.priceCoin}`:''} ${(item.priceStar||0)>0?`⭐${item.priceStar}`:''}</div>
        <div class="a">${owned ? '✅ Owned / Click to Equip' : (canAfford(rew,item)?'🛒 Buy':'⛔ Not enough')}</div>
      `;
      card.addEventListener('click', ()=>{
        const r2 = getRewards();
        const u2 = getUnlocks();
        ITEMS.forEach(it=>{ if(it.always) u2.owned[it.id]=true; });

        const has = !!u2.owned[item.id];
        if(has){
          equip(u2, item);
          render(root);
          return;
        }
        if(!canAfford(r2,item)) return;

        // purchase
        r2.coins -= (item.priceCoin||0);
        r2.stars -= (item.priceStar||0);
        u2.owned[item.id] = true;
        equip(u2, item);

        saveJson(LS_REWARD, r2);
        saveJson(LS_UNLOCK, u2);

        render(root);
      }, {passive:true});
      grid.appendChild(card);
    });
    root.appendChild(grid);

    // quick play buttons (optional)
    const actions = el('div','hh-actions');
    actions.innerHTML = `
      <button class="hh-btn" type="button" data-go="day1">▶ เล่น Day 1</button>
      <button class="hh-btn" type="button" data-go="day2">▶ เล่น Day 2</button>
      <button class="hh-btn" type="button" data-go="day3">▶ เล่น Day 3</button>
    `;
    actions.addEventListener('click', (e)=>{
      const b = e.target.closest('button[data-go]');
      if(!b) return;
      const d = Number(b.dataset.go.replace('day','')) || 1;

      const st = getStory();
      const allow = (d <= st.unlockedDay);
      if(!allow) return;

      // IMPORTANT: point this URL to your hygiene launcher or run page as you want
      // Here: assumes you launch hygiene via /herohealth/hygiene-vr-launcher.html
      const u = new URL('./hygiene-vr-launcher.html', location.href);
      u.searchParams.set('day', String(d));
      // keep hub param if current hub has it
      u.searchParams.set('hub', location.href.split('#')[0]);
      location.href = u.toString();
    }, {passive:true});
    root.appendChild(actions);
  }

  // public mount
  WIN.HHA_HygieneStore = {
    mount(selector){
      const root = document.querySelector(selector);
      if(!root) return;
      render(root);
    }
  };
})();