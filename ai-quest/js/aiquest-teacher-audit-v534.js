/*
  CSAI2102 AI Quest — Honest Audit Patch + Module 3 Live QA v5.3.4
  --------------------------------------------------------------------
  Runs after Teacher Safe Runtime v5.3.3.
  - Shows “–” when latest accuracy is absent (does not coerce empty to 0%).
  - Preserves separate evidence vs passed status.
  - Adds a bounded, non-polling Module 3 graded QA chain panel.
  - No MutationObserver and no recurring refresh loop.
*/
(function(){
  'use strict';

  const VERSION='v5.3.4-audit-accuracy-and-live-qa';
  const CORE=[
    ['s1','S1 • AI Awakening'],['s2','S2 • Agent Builder'],['s3','S3 • Search Maze'],['b1','B1 • Foundation Boss Gate'],
    ['s4','S4 • Route Cost Challenge'],['s5','S5 • A* Rescue Mission'],['s6','S6 • Minimax Arena'],['b2','B2 • Search & Game AI Boss Gate']
  ];
  const PHASE2=[['s7','S7 • Knowledge Base Forge'],['s8','S8 • Uncertainty & Bayes Lab'],['s9','S9 • Expert System Studio'],['b3','B3 • Reasoning & Knowledge Boss']];
  const $=(id)=>document.getElementById(id);
  const esc=(value)=>String(value==null?'':value).replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const num=(value,fallback=0)=>{const n=Number(value);return Number.isFinite(n)?n:fallback;};
  const arr=(value)=>Array.isArray(value)?value:[];
  const obj=(value)=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};

  function api(){return window.AIQUEST_TEACHER_SAFE_V533||window.AIQUEST_TEACHER_SAFE_V532||null;}
  function canonical(value){
    const raw=String(value||'').toLowerCase().trim().replace(/[\s_\-:]+/g,'');
    const map={m1:'s1',session1:'s1',mission1:'s1',s1:'s1',m2:'s2',session2:'s2',mission2:'s2',s2:'s2',m3:'s3',session3:'s3',mission3:'s3',s3:'s3',boss1:'b1',rookieboss:'b1',b1:'b1',m4:'s4',session4:'s4',mission4:'s4',s4:'s4',m5:'s5',session5:'s5',mission5:'s5',s5:'s5',m6:'s6',session6:'s6',mission6:'s6',s6:'s6',boss2:'b2',searchboss:'b2',b2:'b2',m7:'s7',session7:'s7',mission7:'s7',s7:'s7',m8:'s8',session8:'s8',mission8:'s8',s8:'s8',m9:'s9',session9:'s9',mission9:'s9',s9:'s9',boss3:'b3',reasoningboss:'b3',b3:'b3'};
    return map[raw]||raw;
  }
  function dateValue(value){const n=Date.parse(value||'');return Number.isFinite(n)?n:0;}
  function latestText(value){const n=dateValue(value);return n?new Date(n).toLocaleString():(value||'-');}
  function practice(attempt){const a=obj(attempt);return String(a.runMode||'').toLowerCase()==='practice'||a.isPractice===true;}
  function extraText(attempt){
    const a=obj(attempt);let extra=a.extraJson||a.extra||'';
    if(extra&&typeof extra==='object'){try{extra=JSON.stringify(extra);}catch(error){extra='';}}
    return [a.schemaVersion,a.version,a.gameVersion,a.missionTitle,a.title,a.sessionTitle,extra].join(' ').toLowerCase();
  }
  function currentCore(attempt,id){
    if(id!=='s6'&&id!=='b2')return true;
    const text=extraText(attempt);
    if(id==='s6')return /v5\.0|s6-minimax|minimax arena|alpha.?beta/.test(text);
    return /v5\.0|search.?game ai|ucs.*a\*.*minimax|minimax.*a\*/.test(text);
  }
  function passed(attempt){
    const a=obj(attempt);const status=String(a.gateStatus||a.status||'').toLowerCase();
    return a.mastered===true||a.bossWin===true||num(a.stars)>=1||num(a.score)>=60||/pass|master/.test(status);
  }
  function accuracy(attempt){
    const a=obj(attempt);
    const keys=['accuracy','accuracyPct','accuracyPercent'];
    for(const key of keys){
      const raw=a[key];
      if(raw===undefined||raw===null||String(raw).trim()==='')continue;
      const value=Number(raw);
      if(Number.isFinite(value))return Math.round(value);
    }
    return null;
  }
  function allAttempts(){
    const target=api();
    return arr(target&&target.state&&target.state.students).flatMap((student)=>arr(student.attempts).map((attempt)=>Object.assign({studentId:student.studentId,studentName:student.studentName,section:student.section},attempt)));
  }
  function pill(ok,label){return `<span class="pill ${ok?'good':'warn'}">${esc(label)}</span>`;}
  function rows(order,isCore){
    const attempts=allAttempts();
    return order.map(([id,label])=>{
      const raw=attempts.filter((attempt)=>canonical(attempt.sessionId||attempt.missionId)===id);
      const graded=raw.filter((attempt)=>!practice(attempt));
      const eligible=isCore?graded.filter((attempt)=>currentCore(attempt,id)):graded;
      const legacy=isCore?graded.filter((attempt)=>!currentCore(attempt,id)):[];
      const latest=eligible.slice().sort((a,b)=>dateValue(b.serverTs||b.clientTs||b.timestamp)-dateValue(a.serverTs||a.clientTs||a.timestamp))[0]||{};
      return {
        id,label,eligible,legacy,latest,
        best:eligible.reduce((max,attempt)=>Math.max(max,num(attempt.score)),0),
        everPassed:eligible.some(passed),
        learners:new Set(eligible.map((attempt)=>String(attempt.studentId||'')).filter(Boolean))
      };
    });
  }
  function renderAudit(hostId,title,subtitle,order,isCore){
    const host=$(hostId);if(!host)return;
    const list=rows(order,isCore);
    const evidence=list.filter((row)=>row.eligible.length).length;
    const passes=list.filter((row)=>row.everPassed).length;
    const excluded=list.reduce((sum,row)=>sum+row.legacy.length,0);
    const body=list.map((row)=>{
      const has=row.eligible.length>0;
      const acc=accuracy(row.latest);
      const notes=[];
      if(row.legacy.length)notes.push(`ผลเก่า ${row.legacy.length}`);
      if(!has&&row.legacy.length)notes.push('ต้องทวนใหม่');
      return `<tr><td><b>${esc(row.label)}</b></td><td>${pill(has,has?'มีข้อมูล':'ไม่มีข้อมูล')}${notes.length?`<br><span class="muted">${esc(notes.join(' • '))}</span>`:''}</td><td>${has?pill(row.everPassed,row.everPassed?'เคยผ่าน':'ยังไม่ผ่าน'):'-'}</td><td>${row.eligible.length}</td><td>${row.learners.size}</td><td>${has?esc(`${row.best} / ${num(row.latest.score)}`):'-'}</td><td>${has&&acc!==null?esc(acc)+'%':'–'}</td><td>${has?esc(latestText(row.latest.serverTs||row.latest.clientTs||row.latest.timestamp)):'-'}</td></tr>`;
    }).join('');
    host.innerHTML=`<div class="card-head"><div><h2>${esc(title)}</h2><p class="muted">${esc(subtitle)} • Preview/Practice ไม่นับเป็นหลักฐานผ่าน${isCore?' • S6/B2 คัดเฉพาะ Minimax curriculum':''}</p></div><div><span class="pill ${evidence===list.length?'good':'warn'}">หลักฐาน ${evidence}/${list.length}</span><span class="pill ${passes===list.length?'good':'warn'}">เคยผ่าน ${passes}/${list.length}</span>${excluded?`<span class="pill warn">ตัดผลเก่า ${excluded}</span>`:''}</div></div><div class="table-wrap"><table><thead><tr><th>Session</th><th>หลักฐาน</th><th>สถานะผ่าน</th><th>Attempts</th><th>Students</th><th>Best / Latest</th><th>Latest accuracy</th><th>Latest submitted</th></tr></thead><tbody>${body}</tbody></table></div>`;
  }
  function injectStyle(){
    if($('aiquestV534Style'))return;
    const style=document.createElement('style');style.id='aiquestV534Style';
    style.textContent='.qaGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:12px}.qaStep{padding:12px;border:1px solid rgba(148,163,184,.2);border-radius:14px;background:rgba(30,41,59,.72)}.qaStep b{display:block;margin-bottom:5px}.qaStep .muted{font-size:12px}.qaStep.ready{border-color:rgba(52,211,153,.42)}.qaStep.wait{border-color:rgba(245,158,11,.35)}.qaActions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}@media(max-width:900px){.qaGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.qaGrid{grid-template-columns:1fr}}';
    document.head.appendChild(style);
  }
  function injectQA(){
    injectStyle();
    const phaseRows=rows(PHASE2,false);
    const lookup=Object.fromEntries(phaseRows.map((row)=>[row.id,row]));
    const s7=lookup.s7||{};const s8=lookup.s8||{};const s9=lookup.s9||{};const b3=lookup.b3||{};
    const steps=[
      ['S7 • Knowledge Base Forge',s7.eligible&&s7.eligible.length,s7.everPassed,'เล่น S7 แบบ Graded แล้วส่งผล'],
      ['S8 • Uncertainty & Bayes',s8.eligible&&s8.eligible.length,s8.everPassed,s7.everPassed?'S7 ผ่านแล้ว — ทดสอบ S8 แบบ Graded':'รอ S7 ผ่านก่อน'],
      ['S9 • Expert System Studio',s9.eligible&&s9.eligible.length,s9.everPassed,s8.everPassed?'S8 ผ่านแล้ว — ทดสอบ S9 แบบ Graded':'รอ S8 ผ่านก่อน'],
      ['B3 • Reasoning & Knowledge Boss',b3.eligible&&b3.eligible.length,b3.everPassed,s9.everPassed?'S9 ผ่านแล้ว — ทดสอบ B3 แบบ Graded':'รอ S9 ผ่านก่อน']
    ];
    let host=$('module3QABox');
    if(!host){host=document.createElement('section');host.id='module3QABox';host.className='card';const anchor=$('phase2AuditBox');if(anchor&&anchor.parentNode)anchor.parentNode.insertBefore(host,anchor.nextSibling);else document.querySelector('.wrap')?.appendChild(host);}
    host.innerHTML=`<div class="card-head"><div><h2>Module 3 Live QA Chain</h2><p class="muted">ตรวจรอบ Graded จริงตามลำดับ S7 → S8 → S9 → B3; Lab และ Preview จะไม่ทำให้ขั้นใดผ่าน</p></div><span class="pill ${steps.every((step)=>step[2])?'good':'warn'}">ผ่านจริง ${steps.filter((step)=>step[2]).length}/4</span></div><div class="qaGrid">${steps.map(([label,evidence,passedValue,note])=>`<div class="qaStep ${passedValue?'ready':'wait'}"><b>${esc(label)}</b>${pill(!!evidence,evidence?'มี graded evidence':'รอ graded evidence')} ${evidence?pill(!!passedValue,passedValue?'เคยผ่าน':'ยังไม่ผ่าน'):''}<div class="muted" style="margin-top:8px">${esc(note)}</div></div>`).join('')}</div><div class="qaActions"><a class="btn primary" href="./phase2-v531.html?release=20260704-module3-graded-qa">เปิด Module 3 Graded Route</a><a class="btn" href="./phase2-v531.html?preview=1&release=20260704-module3-qa-preview">เปิด Preview แยกสำหรับตรวจหน้าจอ</a><span class="muted">หลังจบแต่ละด่านให้กด Refresh Google Sheets เพื่อตรวจ evidence และ unlock step ถัดไป</span></div>`;
  }
  function patch(){
    const target=api();
    if(!target||!target.state||target.state.loading)return false;
    if(!arr(target.state.students).length)return false;
    renderAudit('coreAuditBox','Core Evidence Audit: S1–S6 / B1–B2','แยกการบันทึกข้อมูลออกจากผลผ่านจริง',CORE,true);
    renderAudit('phase2AuditBox','Module 3 Evidence Audit: S7–S9 / B3','แยก Module 3 ออกจาก Core อย่างชัดเจน',PHASE2,false);
    injectQA();
    const status=$('loadState');
    if(status&&status.textContent&&status.textContent.includes('โหลดข้อมูลแล้ว')&&!status.textContent.includes('Honest Audit v5.3.4'))status.textContent+=' • Honest Audit v5.3.4';
    return true;
  }
  function waitForInitial(tries){
    if(patch())return;
    if(tries<24)setTimeout(()=>waitForInitial(tries+1),500);
  }
  function init(){
    const target=api();
    if(!target){setTimeout(init,120);return;}
    if(!target.__v534Wrapped){
      const original=target.load;
      target.load=async function(){const result=await original.apply(this,arguments);patch();return result;};
      target.__v534Wrapped=true;
      const refresh=$('refreshBtn');if(refresh)refresh.onclick=()=>target.load();
    }
    waitForInitial(0);
  }
  init();
  window.AIQUEST_TEACHER_AUDIT_V534={VERSION,patch};
})();