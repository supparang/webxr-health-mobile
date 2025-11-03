(function(){
const $ = (s,root=document)=>root.querySelector(s);
const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));


// --- UI init ---
window.addEventListener('DOMContentLoaded', init);


function init(){
const prof = ProfileAPI.load();
renderHeader(prof);
render2D();
renderSummary();
bindMission();
bindModeButtons();


const urlMode = new URLSearchParams(location.search).get('mode');
if(urlMode==='vr') switchTo3D();
else switchTo2D();


$('#btnReset').addEventListener('click', ()=>{ if(confirm('ลบโปรไฟล์/ภารกิจวันนี้?')){ ProfileAPI.reset(); localStorage.removeItem('HygieneMissions.v1'); location.reload(); } });
}


function renderHeader(p){
$('#playerName').textContent = p.name||'Player';
$('#playerLevel').textContent = `Lv.${ProfileAPI.levelFromXP(p.xp)}`;
$('#playerCoins').textContent = p.coins;
}


// --- Missions ---
function bindMission(){
const m = MissionAPI.getToday();
$('#missionDate').textContent = m.date;
renderMissionList(m);
$('#btnRefresh').addEventListener('click', ()=>{ const m2 = MissionAPI.refresh(); renderMissionList(m2); toast('สุ่มภารกิจใหม่แล้ว'); });
}


function renderMissionList(m){
const ul = $('#missionList'); ul.innerHTML='';
m.tasks.forEach((t,i)=>{
const li = document.createElement('li');
const g = GAMES.find(x=>x.id===t.gameId);
li.className='task';
li.innerHTML = `<span class="tag">${emojiForZone(t.zone)}</span> ${t.title} <span class="muted">(${g?g.title:'?'} )</span>` + (t.bonus?` <span class="bonus">BONUS</span>`:'');
if(t.done) li.classList.add('done');
ul.appendChild(li);
});
const done = m.tasks.filter(t=>t.done).length;
const total = m.tasks.length;
$('#missionBar').style.width = `${(done/total)*100}%`;
$('#missionStatus').textContent = `${done}/${total} เสร็จแล้ว` + (m.completed? ' • เยี่ยมมาก! รับโบนัสได้':'');
}


function emojiForZone(id){ return (ZONES.find(z=>z.id===id)||{emoji:'🧩'}).emoji; }


// --- 2D Menu ---
