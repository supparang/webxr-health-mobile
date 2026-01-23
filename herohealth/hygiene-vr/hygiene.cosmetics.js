// === /herohealth/hygiene-vr/hygiene.cosmetics.js ===
// Cosmetics (skins/effects/bg) unlocked by level or badges
// Applies CSS vars on :root and/or body classes
// Exposes: window.HHA_HW_COS = { getState(), apply(), list(), setActive(id), unlock(id), canUnlock(id, ctx) }

'use strict';

(function(){
  const WIN = window;
  const DOC = document;

  const K = 'HHA_HW_COS_STATE';

  const COS = [
    { id:'base',    name:'Classic Clean', req:{ level:1 }, vars:{ '--hw-accent':'#22c55e', '--hw-glow':'rgba(34,197,94,.20)' } },
    { id:'aqua',    name:'Aqua Splash',   req:{ level:3 }, vars:{ '--hw-accent':'#22d3ee', '--hw-glow':'rgba(34,211,238,.18)' } },
    { id:'violet',  name:'Violet Aura',   req:{ level:6 }, vars:{ '--hw-accent':'#a78bfa', '--hw-glow':'rgba(167,139,250,.18)' } },
    { id:'sunset',  name:'Sunset Soap',   req:{ level:10}, vars:{ '--hw-accent':'#f59e0b', '--hw-glow':'rgba(245,158,11,.16)' } },
    // special: unlocked by weekly trophy or badge event
    { id:'trophy',  name:'Golden Trophy', req:{ flag:'weekly_trophy' }, vars:{ '--hw-accent':'#fbbf24', '--hw-glow':'rgba(251,191,36,.18)' } },
  ];

  function load(fb){
    try{ const s = localStorage.getItem(K); return s? JSON.parse(s): fb; }catch{ return fb; }
  }
  function save(obj){ try{ localStorage.setItem(K, JSON.stringify(obj)); }catch{} }

  function getState(){
    const st = load(null) || {};
    const unlocked = Array.isArray(st.unlocked) ? st.unlocked : ['base'];
    const active = String(st.active || 'base');
    return { unlocked: Array.from(new Set(unlocked)), active };
  }

  function canUnlock(item, ctx){
    const xp = ctx?.xpState || WIN.HHA_HW_XP?.get?.();
    const lvl = Number(xp?.level||1);
    const flags = ctx?.flags || load({}).flags || {};

    if(item.req?.level && lvl < item.req.level) return false;
    if(item.req?.flag && !flags[item.req.flag]) return false;
    return true;
  }

  function unlock(id){
    const st = getState();
    if(!st.unlocked.includes(id)) st.unlocked.push(id);
    save({ ...load({}), unlocked: st.unlocked, active: st.active, flags: load({}).flags||{} });
  }

  function setActive(id){
    const st = getState();
    if(!st.unlocked.includes(id)) return false;
    save({ ...load({}), unlocked: st.unlocked, active:id, flags: load({}).flags||{} });
    apply();
    return true;
  }

  function setFlag(flag, val=true){
    const raw = load({});
    raw.flags = raw.flags || {};
    raw.flags[flag] = !!val;
    save(raw);
  }

  function apply(){
    const st = getState();
    const item = COS.find(x=>x.id===st.active) || COS[0];
    const root = DOC.documentElement;
    if(item?.vars){
      Object.keys(item.vars).forEach(k=> root.style.setProperty(k, item.vars[k]));
    }
    WIN.dispatchEvent(new CustomEvent('hha:cosmetic', { detail:{ active:item?.id, name:item?.name } }));
    return item;
  }

  function list(){ return COS.slice(); }

  WIN.HHA_HW_COS = { getState, apply, list, setActive, unlock, canUnlock, setFlag };
})();