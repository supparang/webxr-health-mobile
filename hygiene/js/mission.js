(function(){
const MKEY = "HygieneMissions.v1";
function todayKey(){ return new Date().toISOString().slice(0,10); }
function rng(seed){ let s=seed%2147483647; if(s<=0)s+=2147483646; return ()=> (s = s*16807 % 2147483647) / 2147483647; }
function generateFor(dateStr){ const r=rng(parseInt(dateStr.replace(/-/g,''),10)); const zones=[...new Set(GAMES.map(g=>g.zone))]; const tasks=[]; for(const z of zones){ const inZone=GAMES.filter(g=>g.zone===z); const g=inZone[Math.floor(r()*inZone.length)]; tasks.push({ type:"clearGame", gameId:g.id, title:`เล่น ${g.title} ให้ผ่าน`, zone:z, done:false }); } const bonus=GAMES[Math.floor(r()*GAMES.length)]; const targetStar=1+Math.floor(r()*3); tasks.push({ type:"starGame", gameId:bonus.id, title:`ทำ ${bonus.title} ให้ได้ ${targetStar} ดาว`, zone:bonus.zone, targetStar, done:false, bonus:true }); return { date:dateStr, tasks, completed:false, claimed:false }; }
function load(){ try{ return JSON.parse(localStorage.getItem(MKEY)); }catch{ return null; } }
function save(m){ localStorage.setItem(MKEY, JSON.stringify(m)); }
function getToday(){ const k=todayKey(); let m=load(); if(!m||m.date!==k){ m=generateFor(k); save(m);} return m; }
function markGameClear(gameId, star){ const m=getToday(); let changed=false; for(const t of m.tasks){ if(t.type==='clearGame'&&t.gameId===gameId){t.done=true; changed=true;} if(t.type==='starGame'&&t.gameId===gameId&&star>=t.targetStar){t.done=true; changed=true;} } if(changed){ m.completed=m.tasks.every(t=>t.done); save(m);} return m; }
function refresh(){ const m=generateFor(todayKey()); save(m); return m; }
window.MissionAPI = { getToday, markGameClear, refresh };
})();
