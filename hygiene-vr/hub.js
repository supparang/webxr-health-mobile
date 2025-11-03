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
