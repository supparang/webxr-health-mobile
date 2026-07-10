/* CSAI2102 Teacher Console — Challenge v711/v712.8 Adapter
   Version: v7.11.1
   - normalizes nested challenge-v711 payloads before legacy console renders
   - latest attempt by serverTs/clientTs
   - exposes selected case, risk, trap, challenge audit and reflection prompts
   - replaces obsolete zero skill breakdown with challenge evidence
*/
(function(){
  'use strict';
  if(window.AIQUEST_TEACHER_CHALLENGE_V711_ADAPTER)return;
  const VERSION='v7.11.1';
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
  const arr=v=>Array.isArray(v)?v:[];
  const num=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
  const ts=a=>Date.parse((a&&a.serverTs)||(a&&a.clientTs)||(a&&a.timestamp)||'')||0;
  const parse=v=>{if(v&&typeof v==='object')return v;if(typeof v==='string'){try{return JSON.parse(v)}catch(e){return {}}}return {}};
  function unwrap(attempt){
    const a=obj(attempt), e=parse(a.extraJson||a.extra), raw=obj(e.raw||a.raw), nested=parse((raw.extraJson)||e.extraJson);
    const x=Object.assign({},e,nested,obj(raw.extraJson));
    return {a,e,raw,x};
  }
  function isChallenge(attempt){const u=unwrap(attempt);return /challenge-v711/i.test(String(u.a.schemaVersion||u.raw.schemaVersion||u.e.schemaVersion||''))||/challenge71(1|2)/i.test(String(u.x.contentVersion||''));}
  function normalizeAttempt(attempt){
    const u=unwrap(attempt),a=u.a,raw=u.raw,x=u.x;
    const out=Object.assign({},raw,a);
    out.extraJson=Object.assign({},x,{challengeAudit:obj(x.challengeAudit),replayAudit:obj(x.replayAudit)});
    out.schemaVersion=out.schemaVersion||raw.schemaVersion||u.e.schemaVersion;
    out.serverTs=out.serverTs||a.serverTs||raw.serverTs;
    out.clientTs=out.clientTs||a.clientTs||raw.clientTs;
    out.sessionId=String(out.sessionId||out.missionId||'').toLowerCase();
    out.missionId=String(out.missionId||out.sessionId||'').toLowerCase();
    return out;
  }
  function latestAttempt(attempts){
    return arr(attempts).map(normalizeAttempt).sort((a,b)=>{
      const time=ts(b)-ts(a);if(time)return time;
      const bc=isChallenge(b)?1:0,ac=isChallenge(a)?1:0;if(bc!==ac)return bc-ac;
      return num(b.score)-num(a.score);
    })[0]||{};
  }
  function normalizeStudent(student){
    const s=obj(student), attempts=arr(s.attempts).map(normalizeAttempt), latest=latestAttempt(attempts), x=obj(latest.extraJson), audit=obj(x.challengeAudit);
    s.attempts=attempts;
    s.attemptCount=Math.max(num(s.attemptCount),attempts.length);
    s.latestScore=num(latest.score,num(s.latestScore));
    s.bestScore=Math.max(num(s.bestScore),...attempts.map(a=>num(a.score)));
    s.mastered=attempts.some(a=>a.mastered===true)||!!s.mastered;
    const focus=[x.selectedCaseSkill,x.selectedCaseTrap,x.selectedCaseRisk,x.selectedCaseContext].filter(Boolean);
    s.risks=focus.length?focus:arr(s.risks);
    s.latestReflection={
      reflectionPrompt1:x.reflectionPrompt1||'Reflection 1',reflection1:latest.reflection1||'',
      reflectionPrompt2:x.reflectionPrompt2||'Reflection 2',reflection2:latest.reflection2||'',
      reflectionPrompt3:x.reflectionPrompt3||'Reflection 3',reflection3:latest.reflection3||''
    };
    s.__challengeLatest=latest;
    s.__challengeAudit=audit;
    return s;
  }
  function normalizePayload(payload){
    const p=obj(payload), data=obj(p.data||p);
    ['allStudents','students'].forEach(key=>{if(Array.isArray(data[key]))data[key]=data[key].map(normalizeStudent);if(Array.isArray(p[key]))p[key]=p[key].map(normalizeStudent);});
    return payload;
  }
  const nativeFetch=window.fetch.bind(window);
  window.fetch=async function(input,init){
    const response=await nativeFetch(input,init),url=String(typeof input==='string'?input:(input&&input.url)||'');
    if(!/action=teacherConsole/i.test(url))return response;
    try{
      const clone=response.clone(),json=await clone.json(),normalized=normalizePayload(json);
      return new Response(JSON.stringify(normalized),{status:response.status,statusText:response.statusText,headers:{'Content-Type':'application/json; charset=utf-8'}});
    }catch(e){return response;}
  };
  function fmtTime(a){const n=ts(a);return n?new Date(n).toLocaleString('th-TH'):'—';}
  function pill(text,kind='blue'){return `<span class="pill ${kind}">${esc(text)}</span>`;}
  function renderDetail(student){
    const latest=student.__challengeLatest||latestAttempt(student.attempts),x=obj(latest.extraJson),audit=obj(x.challengeAudit),replay=obj(x.replayAudit),cards=arr(replay.cards);
    const prompts=[1,2,3].map(i=>({q:x['reflectionPrompt'+i]||('Reflection '+i),a:latest['reflection'+i]||''}));
    const caseHtml=[x.selectedCaseContext,x.selectedCaseSkill,x.selectedCaseRisk,x.selectedCaseTrap].filter(Boolean).map((v,i)=>pill(v,i===2?'warn':'blue')).join(' ');
    const auditHtml=`<div class="grid cols3"><div class="metric"><span>Content version</span><b style="font-size:17px">${esc(x.contentVersion||'—')}</b></div><div class="metric"><span>Challenge version</span><b style="font-size:17px">${esc(audit.version||'—')}</b></div><div class="metric"><span>Latest submitted</span><b style="font-size:15px">${esc(fmtTime(latest))}</b></div></div>`;
    const quality=`<div class="grid cols3"><div class="metric"><span>Unique correct</span><b>${esc(audit.uniqueCorrect??'—')}</b></div><div class="metric"><span>Unique distractors</span><b>${esc(audit.uniqueDistractors??'—')}</b></div><div class="metric"><span>Answer slots</span><b style="font-size:18px">${esc(arr(audit.slots).join(' / ')||'—')}</b></div></div>`;
    const cardRows=cards.length?cards.map((c,i)=>`<tr><td>${i+1}</td><td><b>${esc(c.concept||'—')}</b><br><span class="muted">${esc(c.context||'')}</span></td><td>${esc(c.risk||'—')}<br><span class="muted">${esc(c.trap||'')}</span></td><td>${esc(c.correct||'—')}</td><td>${arr(c.distractors).map(d=>`• ${esc(d)}`).join('<br>')}</td><td>${num(c.answerSlot)+1}</td></tr>`).join(''):'<tr><td colspan="6">ไม่มี replayAudit ใน attempt นี้</td></tr>';
    const modal=document.getElementById('detailModal'),box=document.getElementById('detailBox');if(!modal||!box)return;
    box.innerHTML=`<div class="detail-header row"><div><h2>${esc(student.studentId)} • ${esc(student.studentName)}</h2><p class="muted">Section ${esc(student.section||'101')} • ${esc((latest.sessionId||latest.missionId||'').toUpperCase())}</p></div><button class="btn" id="closeDetail711">ปิด</button></div>
    <div class="grid cols3"><div class="metric"><span>Score</span><b>${esc(latest.score??'—')}</b></div><div class="metric"><span>Correct</span><b>${esc(latest.correct??'—')}/${esc(latest.total??'—')}</b></div><div class="metric"><span>Mastery</span><b style="font-size:18px">${latest.mastered?'TRUE':'FALSE'}</b></div></div>
    <section class="detail-section"><h3>Selected case</h3><p>${caseHtml||'<span class="muted">ไม่มี selected case metadata</span>'}</p></section>
    <section class="detail-section"><h3>Challenge evidence</h3>${auditHtml}${quality}<p class="muted">${esc(audit.antiGuessPolish||'')}</p></section>
    <section class="detail-section"><h3>Reflection Evidence</h3>${prompts.map((r,i)=>`<div class="reflection"><b>${i+1}) ${esc(r.q)}</b><p>${esc(r.a)||'<span class="muted">ยังไม่มีคำตอบ</span>'}</p></div>`).join('')}</section>
    <section class="detail-section"><h3>Replay Audit — ${cards.length} cards</h3><div class="table-wrap"><table><thead><tr><th>#</th><th>Concept / Context</th><th>Risk / Trap</th><th>Correct</th><th>Distractors</th><th>Slot</th></tr></thead><tbody>${cardRows}</tbody></table></div></section>`;
    modal.classList.add('open');document.getElementById('closeDetail711').onclick=()=>modal.classList.remove('open');
  }
  document.addEventListener('click',event=>{
    const btn=event.target.closest&&event.target.closest('.detailBtn');if(!btn)return;
    setTimeout(()=>{
      const api=window.AIQUEST_TEACHER_SAFE_V533,state=api&&api.state;if(!state)return;
      const rows=arr(state.students).filter(s=>true);const idx=num(btn.dataset.index,-1);if(idx>=0&&rows[idx])renderDetail(rows[idx]);
    },0);
  });
  window.AIQUEST_TEACHER_CHALLENGE_V711_ADAPTER={VERSION,normalizePayload,normalizeAttempt,latestAttempt,renderDetail};
})();