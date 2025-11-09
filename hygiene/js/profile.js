(function(){
const KEY = "HygieneProfile.v1";
const DEFAULT = { name:"Player", coins:0, xp:0, stars:{}, clears:{}, badges:[], lastSeen:Date.now() };
function load(){ try{ return JSON.parse(localStorage.getItem(KEY)) || {...DEFAULT}; }catch{ return {...DEFAULT}; } }
function save(p){ localStorage.setItem(KEY, JSON.stringify(p)); }
function levelFromXP(xp){ return 1 + Math.floor(xp/500); }
function award(gameId, star){ const p=load(); const prev=p.stars[gameId]||0; if(star>prev){p.stars[gameId]=star; p.xp+=(star-prev)*150;} p.clears[gameId]=(p.clears[gameId]||0)+1; p.coins += 10*star; p.lastSeen=Date.now(); save(p); return p; }
function reset(){ localStorage.removeItem(KEY); }
function getSummary(){ const p=load(); const stars=Object.values(p.stars).reduce((a,b)=>a+b,0); const clears=Object.values(p.clears).reduce((a,b)=>a+b,0); return { level:levelFromXP(p.xp), coins:p.coins, stars, clears, profile:p }; }
window.ProfileAPI = { load, save, award, reset, levelFromXP, getSummary };
})();
