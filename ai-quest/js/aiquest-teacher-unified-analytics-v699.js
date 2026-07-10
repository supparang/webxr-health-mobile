/* CSAI2102 Teacher Console — Unified Analytics Filter v6.9.9
   - all lower analytics use the same visible cohort as Data Accuracy v698
   - hide-test toggle updates phase, review, misconception and course audit together
   - recomputes 20-mission evidence from student attempts instead of stale server aggregates
*/
(()=>{'use strict';
  if(window.__AIQUEST_TEACHER_UNIFIED_ANALYTICS_V699__)return;
  window.__AIQUEST_TEACHER_UNIFIED_ANALYTICS_V699__=true;
  const VERSION='v6.9.9';
  const runtime=()=>window.AIQUEST_TEACHER_SAFE_V533||window.AIQUEST_TEACHER_SAFE_V532||null;
  const v698=()=>window.AIQUEST_TEACHER_DATA_ACCURACY_V698||null;
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const num=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
  const arr=v=>Array.isArray(v)?v:[];
  const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
  const parse=v=>{if(v&&typeof v==='object')return v;if(typeof v==='string'){try{return JSON.parse(v)}catch(e){return {}}}return {}};
  const stamp=a=>Date.parse(String(a?.serverTs||a?.clientTs||a?.timestamp||''))||0;
  const ORDER=['s1','s2','s3','b1','s4','s5','s6','b2','s7','s8','s9','b3','s10','s11','s12','b4','s13','s14','s15','b5'];
  const TITLES={s1:'S1 • AI Spotter',s2:'S2 • Agent Builder',s3:'S3 • Search Maze',b1:'B1 • Foundation Boss',s4:'S4 • Route Cost',s5:'S5 • A* Rescue',s6:'S6 • Minimax Arena',b2:'B2 • Search & Game Boss',s7:'S7 • Knowledge Base',s8:'S8 • Bayes & Uncertainty',s9:'S9 • Expert System',b3:'B3 • Knowledge Boss',s10:'S10 • ML Pipeline',s11:'S11 • Supervised Learning',s12:'S12 • Unsupervised Learning',b4:'B4 • Machine Learning Boss',s13:'S13 • Neural Network',s14:'S14 • GenAI / RAG',s15:'S15 • Deployment & Governance',b5:'B5 • Final AI Quest Boss'};
  const PHASES=[['Foundation',['s1','s2','s3','b1']],['Search & Game AI',['s4','s5','s6','b2']],['Knowledge & Reasoning',['s7','s8','s9','b3']],['Machine Learning',['s10','s11','s12','b4']],['Modern AI & Governance',['s13','s14','s15','b5']]];
  const canonical=v=>{const r=String(v||'').toLowerCase().trim().replace(/[\s_\-:]+/g,'');const m={m1:'s1',session1:'s1',mission1:'s1',m2:'s2',session2:'s2',mission2:'s2',m3:'s3',session3:'s3',mission3:'s3',boss1:'b1',m4:'s4',session4:'s4',mission4:'s4',m5:'s5',session5:'s5',mission5:'s5',m6:'s6',session6:'s6',mission6:'s6',boss2:'b2',m7:'s7',session7:'s7',mission7:'s7',m8:'s8',session8:'s8',mission8:'s8',m9:'s9',session9:'s9',mission9:'s9',boss3:'b3',m10:'s10',session10:'s10',mission10:'s10',m11:'s11',session11:'s11',mission11:'s11',m12:'s12',session12:'s12',mission12:'s12',boss4:'b4',m13:'s13',session13:'s13',mission13:'s13',m14:'s14',session14:'s14',mission14:'s14',m15:'s15',session15:'s15',mission15:'s15',boss5:'b5'};return m[r]||r;};
  function attemptMeta(a){const e=parse(a?.extraJson||a?.extra),raw=obj(e.raw||a?.raw),x=Object.assign({},e,parse(raw.extraJson),obj(raw.extraJson));return {a:Object.assign({},raw,a),x};}
  function passed(a){const s=String(a?.gateStatus||a?.status||'').toLowerCase();return a?.mastered===true||a?.bossWin===true||num(a?.stars)>=1||num(a?.score)>=60||/pass|master/.test(s);}
  function cohort(){
    const app=runtime(),all=arr(app?.state?.students),hide=!!document.getElementById('aqHideTestV698')?.checked,isTest=v698()?.isTestStudent||(()=>false);
    return hide?all.filter(s=>!isTest(s)):all.slice();
  }
  const attempts=s=>arr(s?.attempts).filter(a=>a&&typeof a==='object'&&Number.isFinite(Number(a.score)));
  function latest(s){return attempts(s).slice().sort((a,b)=>stamp(b)-stamp(a))[0]||null;}
  function latestBySession(s,id){return attempts(s).filter(a=>canonical(a.sessionId||a.missionId)===id).sort((a,b)=>stamp(b)-stamp(a))[0]||null;}
  function set(id,html){const el=document.getElementById(id);if(el)el.innerHTML=html;}
  function renderPhase(){
    const students=cohort().filter(s=>attempts(s).length),den=students.length||1;
    const html=PHASES.map(([label,ids])=>{let completed=0,total=students.length*ids.length;students.forEach(s=>ids.forEach(id=>{const a=latestBySession(s,id);if(a&&passed(a))completed++;}));const pct=total?Math.round(completed/total*100):0;return `<div class="progress-row"><b>${esc(label)}</b><span>${pct}%</span><div class="bar"><i style="width:${Math.max(2,pct)}%"></i></div><div class="muted" style="font-size:12px;margin-top:5px">ผ่าน ${completed}/${total||0} mission records • ${students.length} active learners</div></div>`;}).join('');
    set('phaseBox',html||'<div class="loading">ยังไม่มีข้อมูลผู้เรียนจริง</div>');
  }
  function renderReview(){
    const rows=cohort().map(s=>({s,a:latest(s)})).filter(x=>x.a).filter(({s,a})=>num(a.score)<70||arr(s.risks).length).sort((x,y)=>num(x.a.score)-num(y.a.score)).slice(0,20);
    set('reviewBox',rows.length?`<div class="table-wrap"><table><thead><tr><th>Student</th><th>Latest</th><th>Session</th><th>Focus</th></tr></thead><tbody>${rows.map(({s,a})=>{const m=attemptMeta(a),focus=m.x.selectedCaseTrap||m.x.selectedCaseSkill||arr(s.risks)[0]||'score / reflection review';return `<tr><td><b>${esc(s.studentId)}</b><br><span class="muted">${esc(s.studentName)}</span></td><td>${esc(a.score)}</td><td>${esc(canonical(a.sessionId||a.missionId).toUpperCase())}</td><td>${esc(focus)}</td></tr>`;}).join('')}</tbody></table></div>`:'<div class="loading">ไม่มีผู้เรียนใน cohort ที่ต้องทบทวนเป็นพิเศษ</div>');
  }
  function renderMis(){
    const counts=new Map();cohort().forEach(s=>attempts(s).forEach(a=>{const m=attemptMeta(a),values=[m.x.selectedCaseTrap,m.x.selectedCaseSkill,...arr(s.misconceptions).map(v=>v?.key||v?.label||v)];values.filter(Boolean).forEach(v=>counts.set(String(v),(counts.get(String(v))||0)+1));}));
    const items=[...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,14);set('misBox',items.length?items.map(([k,n])=>`<span class="pill blue" style="margin:3px">${esc(k)} • ${n}</span>`).join(''):'<div class="loading">ยังไม่มี review focus จาก cohort นี้</div>');
  }
  function renderCourseAudit(){
    const students=cohort(),all=students.flatMap(s=>attempts(s).map(a=>Object.assign({studentId:s.studentId},a)));
    const body=ORDER.map(id=>{const rows=all.filter(a=>canonical(a.sessionId||a.missionId)===id),latestRow=rows.slice().sort((a,b)=>stamp(b)-stamp(a))[0],learners=new Set(rows.map(a=>String(a.studentId))),best=rows.reduce((m,a)=>Math.max(m,num(a.score)),0),ok=rows.some(passed);return `<tr><td><b>${esc(TITLES[id])}</b></td><td>${rows.length?'<span class="pill good">มีข้อมูล</span>':'<span class="pill warn">ไม่มีข้อมูล</span>'}</td><td>${rows.length}</td><td>${learners.size}</td><td>${rows.length?best:'—'}</td><td>${latestRow?num(latestRow.score):'—'}</td><td>${rows.length?(ok?'เคยผ่าน':'ยังไม่ผ่าน'):'—'}</td></tr>`;}).join('');
    set('coreAuditBox',`<div class="card-head"><div><h2>Course Evidence Audit — 20 Missions</h2><p class="muted">คำนวณใหม่จาก cohort ที่มองเห็น • ซ่อนข้อมูลทดสอบมีผลกับตารางนี้ด้วย</p></div><span class="pill blue">Unified v699</span></div><div class="table-wrap"><table><thead><tr><th>Mission</th><th>Evidence</th><th>Attempts</th><th>Learners</th><th>Best</th><th>Latest</th><th>Status</th></tr></thead><tbody>${body}</tbody></table></div>`);
  }
  function renderQuality(){
    const rows=[];cohort().forEach(s=>attempts(s).forEach(a=>{const m=attemptMeta(a),audit=obj(m.x.challengeAudit);if(!audit.version)return;rows.push({studentId:s.studentId,studentName:s.studentName,id:canonical(a.sessionId||a.missionId),score:num(a.score),ts:stamp(a),version:audit.version,uc:audit.uniqueCorrect,ud:audit.uniqueDistractors,slots:arr(audit.slots).join('/')});}));
    rows.sort((a,b)=>b.ts-a.ts);const latest=rows.slice(0,20);set('phase2AuditBox',`<div class="card-head"><div><h2>Challenge Quality Audit</h2><p class="muted">attempt ล่าสุดที่มี challengeAudit • ตรวจ version, uniqueness และ answer-slot balance</p></div><span class="pill ${latest.length?'good':'warn'}">${latest.length} records</span></div>${latest.length?`<div class="table-wrap"><table><thead><tr><th>Student</th><th>Mission</th><th>Score</th><th>Version</th><th>Unique C/D</th><th>Slots</th></tr></thead><tbody>${latest.map(r=>`<tr><td>${esc(r.studentId)}<br><span class="muted">${esc(r.studentName)}</span></td><td>${esc(r.id.toUpperCase())}</td><td>${r.score}</td><td>${esc(r.version)}</td><td>${esc(r.uc??'—')} / ${esc(r.ud??'—')}</td><td>${esc(r.slots||'—')}</td></tr>`).join('')}</tbody></table></div>`:'<div class="loading">ยังไม่มี challengeAudit ใน cohort นี้</div>'}`);
  }
  function renderAll(){renderPhase();renderReview();renderMis();renderCourseAudit();renderQuality();}
  function boot(){
    const badge=document.querySelector('.brand .row');if(badge&&!document.getElementById('aqUnifiedBadgeV699'))badge.insertAdjacentHTML('beforeend','<span id="aqUnifiedBadgeV699" class="pill good">✓ Unified Analytics v699</span>');
    document.getElementById('aqHideTestV698')?.addEventListener('change',()=>setTimeout(renderAll,0));
    document.getElementById('refreshBtn')?.addEventListener('click',()=>setTimeout(renderAll,1000));
    let tries=0;const timer=setInterval(()=>{tries++;const app=runtime();if(app?.state&&Array.isArray(app.state.students)){renderAll();if(app.state.students.length||tries>30)clearInterval(timer);}if(tries>60)clearInterval(timer);},400);
    window.addEventListener('aiquest:cohort-change',renderAll);
    console.log('[AIQuest] Unified analytics active',VERSION);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.AIQUEST_TEACHER_UNIFIED_ANALYTICS_V699={VERSION,renderAll,cohort};
})();