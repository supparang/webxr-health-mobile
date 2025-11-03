(function(){
return ()=> (s = s*16807 % 2147483647) / 2147483647;
}


function generateFor(dateStr){
const seed = parseInt(dateStr.replace(/-/g,''),10);
const r = rng(seed);


// pick 5 missions across zones (one per zone if possible)
const zones = [...new Set(GAMES.map(g=>g.zone))];
const picks = [];
for(const z of zones){
const inZone = GAMES.filter(g=>g.zone===z);
const g = inZone[Math.floor(r()*inZone.length)];
picks.push({ type:"clearGame", gameId:g.id, title:`เล่น ${g.title} ให้ผ่าน`, zone:z, done:false });
}
// Bonus: random score target on a random game
const bonusGame = GAMES[Math.floor(r()*GAMES.length)];
const targetStar = 1 + Math.floor(r()*3); // 1–3
picks.push({ type:"starGame", gameId:bonusGame.id, title:`ทำ ${bonusGame.title} ให้ได้ ${targetStar} ดาว`, zone:bonusGame.zone, targetStar, done:false, bonus:true });


return { date:dateStr, tasks:picks, completed:false, claimed:false };
}


function load(){
try{ return JSON.parse(localStorage.getItem(MKEY)); }catch{ return null; }
}
function save(m){ localStorage.setItem(MKEY, JSON.stringify(m)); }


function getToday(){
const k = todayKey();
let m = load();
if(!m || m.date!==k){ m = generateFor(k); save(m); }
return m;
}


function markGameClear(gameId, star){
const m = getToday();
let changed=false;
for(const t of m.tasks){
if(t.type==="clearGame" && t.gameId===gameId){ t.done=true; changed=true; }
if(t.type==="starGame" && t.gameId===gameId && star>=t.targetStar){ t.done=true; changed=true; }
}
if(changed){ m.completed = m.tasks.every(t=>t.done); save(m); }
return m;
}


function refresh(){ const m = generateFor(todayKey()); save(m); return m; }


window.MissionAPI = { getToday, markGameClear, refresh };
})();
