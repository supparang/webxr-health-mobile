/* CSAI2102 AI Quest • Core Session Evidence Audit v5.0.0
   S6 and B2 were realigned to Minimax in curriculum v5.0.0.
   Earlier Knowledge Base Forge / old B2 records remain visible as history
   but do not certify the revised S6/B2 evidence requirement.
*/
(function(){
'use strict';
const ENDPOINT='https://script.google.com/macros/s/AKfycbwXSUHbhVbZtKcjNIDzs4TawAohdeInm1MxLpomVeST2JilOL3L0LWQtT4_Yb7fbJG9/exec',SECTION='101';
const ORDER=['s1','s2','s3','b1','s4','s5','s6','b2'];
const LABEL={s1:'S1 • AI Awakening',s2:'S2 • Agent Builder',s3:'S3 • Search Maze',b1:'B1 • Foundation Boss Gate',s4:'S4 • Route Cost Challenge',s5:'S5 • A* Rescue Mission',s6:'S6 • Minimax Arena',b2:'B2 • Search & Game AI Boss Gate'};
const esc=v=>String(v??'').replace(/[&<>"']/g,s=>({'&':'&amp;','>':'&gt;','<':'&lt;','"':'&quot;',"'":'&#039;'}[s]));
const n=(v,d=0)=>{const x=Number(v);return Number.isFinite(x)?x:d};
function first(o,keys){o=o||{};for(const k of keys){if(o[k]!==undefined&&o[k]!==null&&o[k]!=='')return o[k]}const low={};Object.keys(o).forEach(k=>low[k.toLowerCase()]=o[k]);for(const k of keys){const v=low[String(k).toLowerCase()];if(v!==undefined&&v!==null&&v!=='')return v}return ''}
function canonical(row){const raw=String(first(row,['sessionId','missionId','session','mission'])||'').toLowerCase().trim();const map={m1:'s1',session1:'s1',mission1:'s1',m2:'s2',session2:'s2',mission2:'s2',boss1:'b1',rookieboss:'b1',m3:'s3',session3:'s3',mission3:'s3',m4:'s4',session4:'s4',mission4:'s4',m5:'s5',session5:'s5',mission5:'s5',boss2:'b2',searchboss:'b2',m6:'s6',session6:'s6',mission6:'s6'};return map[raw]||raw}
function dateValue(row){const t=Date.parse(first(row,['serverTs','timestamp','submittedAt','clientTs','time','createdAt']));return Number.isFinite(t)?t:0}
function isV5Evidence(row,id){
 if(id!=='s6'&&id!=='b2')return true;
 const text=[first(row,['version','schemaVersion','gameVersion']),first(row,['missionTitle','title']),first(row,['extraJson','extra'])].join(' ').toLowerCase();
 return id==='s6'?/v5\.0|s6-minimax|minimax arena|alpha.?beta/.test(text):/v5\.0|search.?game ai|ucs.*a\*.*minimax|minimax.*a\*/.test(text);
}
function attemptsFrom(data){const candidates=[];function walk(x,d){if(!x||d>4)return;if(Array.isArray(x)){if(x.length&&typeof x[0]==='object')candidates.push(x);x.slice(0,4).forEach(v=>walk(v,d+1));return}if(typeof x==='object')Object.keys(x).forEach(k=>walk(x[k],d+1))}walk(data,0);candidates.sort((a,b)=>score(b)-score(a));return candidates[0]||[];function score(arr){const sample=arr.find(v=>v&&typeof v==='object')||{},keys=Object.keys(sample).join(' ').toLowerCase();return(keys.includes('session')?4:0)+(keys.includes('score')?3:0)+(keys.includes('student')?2:0)+Math.min(arr.length,50)/50}}
function host(){let x=document.getElementById('coreAuditV411');if(x)return x;x=document.createElement('section');x.id='coreAuditV411';x.className='card';const a=document.getElementById('overview');if(a&&a.parentNode)a.parentNode.insertBefore(x,a.nextSibling);else document.body.appendChild(x);return x}
function loading(m){host().innerHTML='<h2>Core Evidence Audit: S1–S6 / B1–B2</h2><div class="loading">'+esc(m||'กำลังตรวจหลักฐานจาก session_attempts...')+'</div>'}
function render(rows){
 const by={},legacy={};ORDER.forEach(id=>{by[id]=[];legacy[id]=[]});const unknown=[];
 rows.forEach(r=>{const id=canonical(r);if(!by[id]){unknown.push(r);return}(isV5Evidence(r,id)?by[id]:legacy[id]).push(r)});
 const body=ORDER.map(id=>{const list=by[id].slice().sort((a,b)=>dateValue(b)-dateValue(a)),old=legacy[id].slice().sort((a,b)=>dateValue(b)-dateValue(a)),latest=list[0],students=new Set(list.map(a=>String(first(a,['studentId','student_id','id'])||'')).filter(Boolean)),score=latest?n(first(latest,['score','Score']),0):'',acc=latest?first(latest,['accuracy','accuracyPct','accuracyPercent']):'',when=latest?first(latest,['serverTs','timestamp','submittedAt','clientTs','time']):'';let status=list.length?'<span class="pill good">ยืนยันแล้ว</span>':'<span class="pill warn">ยังไม่พบหลักฐาน</span>';if(!list.length&&old.length)status='<span class="pill warn">มีผลเก่า • ต้องทวนใหม่</span>';return '<tr><td><b>'+esc(LABEL[id])+'</b></td><td>'+status+'</td><td>'+list.length+(old.length?' <span class="muted">(เก่า '+old.length+')</span>':'')+'</td><td>'+students.size+'</td><td>'+esc(score===''?'-':score)+'</td><td>'+esc(acc===''?'-':acc)+'%</td><td>'+esc(when||'-')+'</td></tr>'}).join('');
 const verified=ORDER.filter(id=>by[id].length>0).length,missing=ORDER.filter(id=>!by[id].length),oldS6B2=legacy.s6.length+legacy.b2.length;
 host().innerHTML='<div style="display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap"><div><h2 style="margin:0">Core Evidence Audit: S1–S6 / B1–B2</h2><p class="muted">S6/B2 ต้องเป็นหลักฐาน Minimax curriculum v5.0.0; ผล Knowledge เดิมเก็บเป็นประวัติ</p></div><button class="btn primary" id="coreAuditRefreshV500">Audit ใหม่</button></div><div class="grid cols3" style="margin:10px 0"><div class="metric"><span class="muted">ด่านที่ยืนยันแล้ว</span><b>'+verified+'/8</b></div><div class="metric"><span class="muted">ยังต้องทดสอบ</span><b>'+missing.length+'</b></div><div class="metric"><span class="muted">S6/B2 ผลเก่า</span><b>'+oldS6B2+'</b></div></div><div style="overflow:auto"><table><thead><tr><th>Core session</th><th>หลักฐาน</th><th>Attempts</th><th>Students</th><th>Latest score</th><th>Accuracy</th><th>Latest submitted</th></tr></thead><tbody>'+body+'</tbody></table></div>'+(missing.length?'<div class="loading" style="margin-top:12px"><b>ลำดับทดสอบต่อไป:</b> '+missing.map(x=>esc(LABEL[x])).join(' → ')+'</div>':'<div class="loading" style="margin-top:12px"><b>ครบแล้ว:</b> มีหลักฐานเกมหลักตามหลักสูตร Minimax ทุกด่าน</div>');const b=document.getElementById('coreAuditRefreshV500');if(b)b.onclick=load;
}
async function load(){loading();try{const r=await fetch(ENDPOINT+'?action=teacherConsole&section='+SECTION+'&sessionId=all&includeTest=1&t='+Date.now(),{cache:'no-store'});render(attemptsFrom(await r.json()))}catch(err){host().innerHTML='<h2>Core Evidence Audit: S1–S6 / B1–B2</h2><div class="loading">อ่านข้อมูลไม่สำเร็จ: '+esc(err&&err.message||err)+'</div>'}}
window.AIQuestCoreAuditV411={load};setTimeout(load,900);
})();
