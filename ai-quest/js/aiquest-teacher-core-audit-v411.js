/* CSAI2102 AI Quest • Core Session Evidence Audit v4.1.1
   Audits ONLY core attempts from session_attempts:
   S1-S6 and B1-B2. AR evidence remains supplementary and is excluded here.
*/
(function(){
  'use strict';

  const ENDPOINT='https://script.google.com/macros/s/AKfycbwXSUHbhVbZtKcjNIDzs4TawAohdeInm1MxLpomVeST2JilOL3L0LWQtT4_Yb7fbJG9/exec';
  const SECTION='101';
  const ORDER=['s1','s2','b1','s3','s4','s5','b2','s6'];
  const LABEL={
    s1:'S1 • AI Awakening',
    s2:'S2 • Agent Builder',
    b1:'B1 • Rookie AI Boss',
    s3:'S3 • Search Maze',
    s4:'S4 • Route Cost Challenge',
    s5:'S5 • A* Rescue Mission',
    b2:'B2 • Search Arena Boss',
    s6:'S6 • Knowledge Base Forge'
  };

  function esc(v){return String(v??'').replace(/[&<>"']/g,s=>({'&':'&amp;','>':'&gt;','<':'&lt;','"':'&quot;',"'":'&#039;'}[s]));}
  function n(v,d=0){const x=Number(v);return Number.isFinite(x)?x:d;}
  function first(o,keys){
    o=o||{};
    for(const k of keys){if(o[k]!==undefined&&o[k]!==null&&o[k]!=='')return o[k];}
    const low={};Object.keys(o).forEach(k=>low[k.toLowerCase()]=o[k]);
    for(const k of keys){const v=low[String(k).toLowerCase()];if(v!==undefined&&v!==null&&v!=='')return v;}
    return '';
  }
  function canonical(row){
    const raw=String(first(row,['sessionId','missionId','session','mission'])||'').toLowerCase().trim();
    const map={m1:'s1',session1:'s1',mission1:'s1',m2:'s2',session2:'s2',mission2:'s2',
      boss1:'b1',rookieboss:'b1',m3:'s3',session3:'s3',mission3:'s3',m4:'s4',session4:'s4',mission4:'s4',
      m5:'s5',session5:'s5',mission5:'s5',boss2:'b2',searchboss:'b2',m6:'s6',session6:'s6',mission6:'s6'};
    return map[raw]||raw;
  }
  function dateValue(row){
    const v=first(row,['serverTs','timestamp','submittedAt','clientTs','time','createdAt']);
    const t=Date.parse(v); return Number.isFinite(t)?t:0;
  }
  function attemptsFrom(data){
    const candidates=[];
    function walk(x,depth){
      if(!x||depth>4)return;
      if(Array.isArray(x)){ if(x.length&&typeof x[0]==='object')candidates.push(x); x.slice(0,4).forEach(v=>walk(v,depth+1)); return; }
      if(typeof x==='object')Object.keys(x).forEach(k=>walk(x[k],depth+1));
    }
    walk(data,0);
    candidates.sort((a,b)=>score(b)-score(a));
    return candidates[0]||[];
    function score(arr){
      const sample=arr.find(v=>v&&typeof v==='object')||{};
      const keys=Object.keys(sample).join(' ').toLowerCase();
      return (keys.includes('session')?4:0)+(keys.includes('score')?3:0)+(keys.includes('student')?2:0)+Math.min(arr.length,50)/50;
    }
  }
  function ensureHost(){
    let host=document.getElementById('coreAuditV411');
    if(host)return host;
    host=document.createElement('section');
    host.id='coreAuditV411';
    host.className='card';
    const anchor=document.getElementById('overview');
    if(anchor&&anchor.parentNode)anchor.parentNode.insertBefore(host,anchor.nextSibling);
    else document.body.appendChild(host);
    return host;
  }
  function renderLoading(msg){ensureHost().innerHTML='<h2>Core Evidence Audit: S1–S6 / B1–B2</h2><div class="loading">'+esc(msg||'กำลังตรวจหลักฐานจาก session_attempts...')+'</div>';}
  function render(rows){
    const by={};ORDER.forEach(id=>by[id]=[]);
    const unknown=[];
    rows.forEach(r=>{
      const id=canonical(r);
      if(by[id])by[id].push(r); else unknown.push(r);
    });
    const body=ORDER.map(id=>{
      const list=by[id].slice().sort((a,b)=>dateValue(b)-dateValue(a));
      const latest=list[0];
      const students=new Set(list.map(a=>String(first(a,['studentId','student_id','id'])||'')).filter(Boolean));
      const latestScore=latest?n(first(latest,['score','Score']),0):'';
      const latestAcc=latest?first(latest,['accuracy','accuracyPct','accuracyPercent']):'';
      const when=latest?first(latest,['serverTs','timestamp','submittedAt','clientTs','time']):'';
      const ok=list.length>0;
      return '<tr><td><b>'+esc(LABEL[id])+'</b></td><td>'+ (ok?'<span class="pill good">ยืนยันแล้ว</span>':'<span class="pill warn">ยังไม่พบหลักฐาน</span>') +'</td><td>'+list.length+'</td><td>'+students.size+'</td><td>'+esc(latestScore===''?'-':latestScore)+'</td><td>'+esc(latestAcc===''?'-':latestAcc)+'%</td><td>'+esc(when||'-')+'</td></tr>';
    }).join('');
    const verified=ORDER.filter(id=>by[id].length>0).length;
    const missing=ORDER.filter(id=>!by[id].length);
    const unknownHtml=unknown.length?'<div class="loading" style="margin-top:12px"><b>ต้องแก้ mapping:</b> พบ '+unknown.length+' attempt ที่ sessionId/missionId ไม่ตรงมาตรฐาน เช่น <code>'+esc(String(first(unknown[0],['sessionId','missionId','session','mission'])||'(blank)'))+'</code></div>':'';
    ensureHost().innerHTML=''
      +'<div style="display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap">'
      +'<div><h2 style="margin:0">Core Evidence Audit: S1–S6 / B1–B2</h2><p class="muted">ตรวจเฉพาะเกมหลักจาก session_attempts — ไม่รวม AR</p></div>'
      +'<button class="btn primary" id="coreAuditRefreshV411">Audit ใหม่</button></div>'
      +'<div class="grid cols3" style="margin:10px 0"><div class="metric"><span class="muted">ด่านที่ยืนยันแล้ว</span><b>'+verified+'/8</b></div><div class="metric"><span class="muted">ยังต้องทดสอบ</span><b>'+missing.length+'</b></div><div class="metric"><span class="muted">Unknown mapping</span><b>'+unknown.length+'</b></div></div>'
      +'<div style="overflow:auto"><table><thead><tr><th>Core session</th><th>หลักฐาน</th><th>Attempts</th><th>Students</th><th>Latest score</th><th>Accuracy</th><th>Latest submitted</th></tr></thead><tbody>'+body+'</tbody></table></div>'
      +(missing.length?'<div class="loading" style="margin-top:12px"><b>ลำดับทดสอบต่อไป:</b> '+missing.map(x=>esc(LABEL[x])).join(' → ')+'</div>':'<div class="loading" style="margin-top:12px"><b>ครบแล้ว:</b> มีหลักฐานเกมหลักทุกด่าน S1–S6 และ B1–B2</div>')
      +unknownHtml;
    const btn=document.getElementById('coreAuditRefreshV411');if(btn)btn.onclick=load;
  }
  async function load(){
    renderLoading();
    try{
      const r=await fetch(ENDPOINT+'?action=teacherConsole&section='+SECTION+'&sessionId=all&includeTest=1&t='+Date.now(),{cache:'no-store'});
      const data=await r.json();
      render(attemptsFrom(data));
    }catch(err){ensureHost().innerHTML='<h2>Core Evidence Audit: S1–S6 / B1–B2</h2><div class="loading">อ่านข้อมูลไม่สำเร็จ: '+esc(err&&err.message||err)+'</div>';}
  }
  window.AIQuestCoreAuditV411={load};
  setTimeout(load,900);
})();
