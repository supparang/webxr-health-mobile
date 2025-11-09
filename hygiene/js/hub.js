import { $, $$, toast, emojiForZone } from './util.js';


window.addEventListener('DOMContentLoaded', init);


function init(){
renderHeader(ProfileAPI.load());
render2D();
renderSummary();
bindMission();
bindModeButtons();
const urlMode = new URLSearchParams(location.search).get('mode');
if(urlMode==='vr') switchTo3D(); else switchTo2D();
$('#btnReset').addEventListener('click', ()=>{ if(confirm('ลบโปรไฟล์/ภารกิจวันนี้?')){ ProfileAPI.reset(); localStorage.removeItem('HygieneMissions.v1'); location.reload(); } });
window.addEventListener('message', onResultMessage, false);
}


function renderHeader(p){ $('#playerName').textContent=p.name||'Player'; $('#playerLevel').textContent=`Lv.${ProfileAPI.levelFromXP(p.xp)}`; $('#playerCoins').textContent=p.coins; }
function renderSummary(){ const s=ProfileAPI.getSummary(); $('#summary').innerHTML=`<div>ระดับ: <b>Lv.${s.level}</b> • เหรียญ: <b>${s.coins}</b>⭐</div><div>รวมดาว: <b>${s.stars}</b> • เล่นผ่านทั้งหมด: <b>${s.clears}</b></div>`; }


// ---- Missions
function bindMission(){ const m=MissionAPI.getToday(); $('#missionDate').textContent=m.date; renderMissionList(m); $('#btnRefresh').addEventListener('click', ()=>{ const m2=MissionAPI.refresh(); renderMissionList(m2); toast('สุ่มภารกิจใหม่แล้ว'); }); }
function renderMissionList(m){ const ul=$('#missionList'); ul.innerHTML=''; m.tasks.forEach(t=>{ const g=GAMES.find(x=>x.id===t.gameId); const li=document.createElement('li'); li.className='task'+(t.done?' done':''); li.innerHTML=`<span class="tag">${emojiForZone(t.zone)}</span> ${t.title} <span class="muted">(${g?g.title:'?'})</span>`+(t.bonus?` <span class="bonus">BONUS</span>`:''); ul.appendChild(li);}); const done=m.tasks.filter(t=>t.done).length, total=m.tasks.length; $('#missionBar').style.width=`${(done/total)*100}%`; $('#missionStatus').textContent=`${done}/${total} เสร็จแล้ว`+(done===total?' • เยี่ยมมาก! รับโบนัสได้':''); }


// ---- 2D Menu
function render2D(){ const host=$('#zones'); host.innerHTML=''; const ztpl=$('#zoneTpl'); const gtpl=$('#gameCardTpl'); for(const z of ZONES){ const znode=ztpl.content.cloneNode(true); $('.zone-title',znode).textContent=`${z.emoji} ${z.name}`; $('.zone-meta',znode).textContent=z.desc; const grid=$('[data-zone-grid]',znode); for(const g of GAMES.filter(x=>x.zone===z.id)){ const card=gtpl.content.cloneNode(true); $('[data-ico]',card).textContent=g.emoji; $('[data-title]',card).textContent=g.title; $('[data-desc]',card).textContent=g.desc; const meta=`[${z.name}] • ดาว: ${ProfileAPI.load().stars[g.id]||0} • เคลียร์: ${ProfileAPI.load().clears[g.id]||0}`; $('[data-meta]',card).textContent=meta; card.querySelector('.game').addEventListener('click', ()=>launchGame(g)); grid.appendChild(card);} host.appendChild(znode);} }


// ---- 3D Portals (A‑Frame generated)
function buildPortals(){ const host=document.getElementById('portalHost'); host.innerHTML=''; const radius=4.2; let angle=0; const step=(Math.PI*2)/ZONES.length; for(const z of ZONES){ const x=Math.cos(angle)*radius, y=1.5, zpos=-3+Math.sin(angle)*radius; angle+=step; const label=`${z.emoji} ${z.name}`; const portal=document.createElement('a-entity'); portal.setAttribute('position',`${x} 1 ${zpos}`); portal.innerHTML=`<a-cylinder color="#9ec5fe" radius="0.8" height="1.4" opacity="0.7"></a-cylinder><a-text value="${label}" align="center" color="#1f2937" position="0 1.1 0" width="3"></a-text>`; host.appendChild(portal); const hit=document.createElement('a-ring'); hit.setAttribute('position','0 0.8 0'); hit.setAttribute('radius-inner','0.6'); hit.setAttribute('radius-outer','0.7'); hit.setAttribute('color','#2563eb'); portal.appendChild(hit); hit.addEventListener('click', ()=>{ const first=GAMES.find(g=>g.zone===z.id); if(first) launchGame(first);}); } }


function switchTo2D(){ $('#menu2d').classList.remove('hidden'); $('#menu3d').classList.add('hidden'); $('#mode2d').classList.add('on'); $('#mode3d').classList.remove('on'); }
function switchTo3D(){ $('#menu2d').classList.add('hidden'); $('#menu3d').classList.remove('hidden'); $('#mode2d').classList.remove('on'); $('#mode3d').classList.add('on'); buildPortals(); }
function bindModeButtons(){ $('#mode2d').addEventListener('click', switchTo2D); $('#mode3d').addEventListener('click', switchTo3D); }


function launchGame(g){ sessionStorage.setItem('HygieneOutbound', JSON.stringify({ gameId:g.id, t:Date.now() })); location.href=g.url; }


function onResultMessage(ev){ const d=ev.data||{}; if(d.type==='HYGIENE_RESULT'&&d.gameId){ ProfileAPI.award(d.gameId, Math.max(0,Math.min(3,d.star|0))); MissionAPI.markGameClear(d.gameId, d.star|0); renderHeader(ProfileAPI.load()); render2D(); bindMission(); renderSummary(); toast('อัปเดตผลสำเร็จแล้ว!'); } }
