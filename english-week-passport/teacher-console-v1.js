(function(){
'use strict';
const VERSION='2026-08-09-TEACHER-CONSOLE-R2-FIRESTORE-DIRECT';
const cfg=window.EW_CONFIG||{};
const endpoint=String(cfg.firebaseTeacherUrl||`https://${cfg.firebaseRegion||'asia-southeast1'}-${cfg.firebaseProjectId||'englishweek-95869'}.cloudfunctions.net/englishWeekTeacher`).trim();
const $=id=>document.getElementById(id);
let teacherKey=sessionStorage.getItem('ew_teacher_key_r1')||'';
let data=null,refreshTimer=0;

function h(value){return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}
function pct(value){return value==null?'—':`${Math.round(Number(value)||0)}%`}
function signed(value){if(value==null)return '—';const n=Math.round(Number(value)||0);return `${n>0?'+':''}${n}%`}
function duration(ms){const sec=Math.max(0,Math.round(Number(ms||0)/1000));const min=Math.floor(sec/60);return min?`${min}m ${sec%60}s`:`${sec}s`}
function setStatus(message,bad){$('apiStatus').textContent=message;$('apiStatus').className='status'+(bad?' bad':'')}

async function call(action,payload){
  if(!/^https:\/\/asia-southeast1-englishweek-95869\.cloudfunctions\.net\/englishWeekTeacher$/i.test(endpoint))throw new Error('TEACHER_ENDPOINT_INVALID');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
    const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-EW-App-Id':cfg.appId||'ENGLISH-WEEK-PASSPORT-2026','X-EW-Teacher-Key':teacherKey},body:JSON.stringify({action,appId:cfg.appId||'ENGLISH-WEEK-PASSPORT-2026',...(payload||{})}),cache:'no-store',signal:controller.signal});
    let json=null;try{json=await response.json()}catch(_){throw new Error('INVALID_TEACHER_RESPONSE')}
    if(!response.ok||json?.ok===false)throw new Error(json?.error||`HTTP_${response.status}`);
    return json;
  }finally{clearTimeout(timer)}
}
function metricCard(value,label){return `<div class="card kpi"><strong>${h(value)}</strong><small>${h(label)}</small></div>`}
function renderOverview(){
  const o=data?.overview||{},t=o.totals||{},l=o.learning||{};
  $('kpis').innerHTML=[metricCard(t.participants||0,'Participants'),metricCard(t.preDone||0,'Pre complete'),metricCard(t.postDone||0,'Post complete'),metricCard(t.reflectionDone||0,'Reflections'),metricCard(t.summaryViewed||0,'Journey Summary'),metricCard(t.dataIssues||0,'Data issues')].join('');
  $('learning').innerHTML=[['Pre mean',pct(l.meanPre)],['Post mean',pct(l.meanPost)],['Mean gain',signed(l.meanGain)],['Paired N',l.pairedN||0]].map(([label,value])=>`<div class="metric"><strong>${h(value)}</strong><small>${h(label)}</small></div>`).join('');
  $('funnel').innerHTML=(o.funnel||[]).map(item=>`<div class="funnel-item"><div class="funnel-bar"><div class="funnel-fill" style="height:${Math.max(4,Number(item.pct||0))}%"></div></div><strong>${h(item.stage)}</strong><small>${Number(item.count||0)} • ${Number(item.pct||0)}%</small></div>`).join('');
  $('games').innerHTML=(o.games||[]).map(game=>`<div class="game-row"><div><strong>${h(game.title)}</strong><small>${h(game.skill)} • ${Number(game.players||0)} players • avg ${duration(game.avgDurationMs)}</small></div><div class="pill">${Number(game.avgBestAccuracy||0)}%<small>Avg</small></div><div class="pill">${Number(game.passed||0)}<small>Pass</small></div><div class="pill">${Number(game.avgAttempts||0)}<small>Try</small></div></div>`).join('');
  $('issues').innerHTML=(o.issues||[]).length?(o.issues||[]).map(issue=>`<div class="issue" data-player="${h(issue.playerId)}"><strong>${h(issue.name)} • ${h(issue.type)}</strong><small>${h(issue.detail)}</small></div>`).join(''):'<div class="good">✓ ไม่พบ Data Health issue จากกฎ R2</div>';
  renderParticipants();
}
function renderParticipants(){
  const query=$('searchInput').value.trim().toLowerCase(),stage=$('stageFilter').value;
  const rows=(data?.participants||[]).filter(row=>{const hay=`${row.playerId} ${row.nickname} ${row.fullName} ${row.groupName}`.toLowerCase();return (!query||hay.includes(query))&&(!stage||row.stage===stage)});
  $('participantBody').innerHTML=rows.map(row=>`<tr data-player="${h(row.playerId)}"><td><strong>${h(row.nickname)}</strong><br><small>${h(row.playerId)}</small></td><td>${h(row.groupName)}</td><td><strong>${h(row.stage)}</strong></td><td>${pct(row.preAccuracy)}</td><td>${pct(row.postAccuracy)}</td><td class="${row.learningGain!=null&&row.learningGain>=0?'good':'warn'}">${signed(row.learningGain)}</td><td>${pct(row.averageGameAccuracy)}</td><td>${Number(row.totalAttempts||0)}<br><small>${duration(row.totalDurationMs)}</small></td><td class="${row.reflectionDone?'good':'warn'}">${row.reflectionDone?'✓':'—'}</td><td class="${row.summaryViewed?'good':'warn'}">${row.summaryViewed?'✓':'—'}</td><td class="${row.summaryViewed&&row.certificateEligible?'good':'warn'}">${row.summaryViewed&&row.certificateEligible?'✓':'—'}</td></tr>`).join('');
}
async function refresh(){
  if(!teacherKey)return showLogin();
  setStatus('กำลังโหลด Firebase…',false);$('refreshBtn').disabled=true;
  try{const result=await call('overview');data=result;renderOverview();setStatus(`Firebase live • R2 • ${new Date(result.generatedAt||Date.now()).toLocaleTimeString('th-TH')}`,false);scheduleRefresh()}
  catch(error){console.error(error);setStatus(String(error?.message||error),true);if(/UNAUTHORIZED|SECRET_NOT_CONFIGURED/.test(String(error?.message||'')))showLogin(String(error?.message||error))}
  finally{$('refreshBtn').disabled=false}
}
function scheduleRefresh(){clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,15000)}
function showLogin(message){clearTimeout(refreshTimer);$('loginLayer').classList.remove('hidden');$('teacherKey').value='';$('loginError').textContent=message||'';setStatus('Teacher Console locked',true)}
async function login(){
  const value=$('teacherKey').value.trim();if(!value)return $('loginError').textContent='กรุณากรอก Teacher Key';
  teacherKey=value;$('loginBtn').disabled=true;$('loginError').textContent='กำลังตรวจสอบ Firebase Teacher API…';
  try{await call('health');sessionStorage.setItem('ew_teacher_key_r1',teacherKey);$('loginLayer').classList.add('hidden');$('loginError').textContent='';await refresh()}
  catch(error){teacherKey='';sessionStorage.removeItem('ew_teacher_key_r1');$('loginError').textContent=`เข้าไม่ได้: ${String(error?.message||error)}`}
  finally{$('loginBtn').disabled=false}
}
function lock(){teacherKey='';sessionStorage.removeItem('ew_teacher_key_r1');data=null;showLogin('ออกจาก Teacher Console แล้ว')}
async function openReport(playerId){
  $('reportModal').classList.remove('hidden');$('reportTitle').textContent='กำลังโหลด Participant Report…';$('reportSubtitle').textContent=playerId;$('reportContent').innerHTML='<div class="metric">กำลังอ่านข้อมูลจาก Firebase…</div>';
  try{
    const result=await call('participant_report',{playerId}),r=result.report||{},p=r.profile||{},pr=r.progress||{},a=r.assessments||{};
    $('reportTitle').textContent=p.nickname||p.fullName||playerId;$('reportSubtitle').textContent=`${playerId} • ${p.groupName||'English Week'}`;
    $('reportContent').innerHTML=`<div class="report-grid"><div class="metric"><strong>${pct(a.pre?.accuracy??(a.pre?.total?Number(a.pre.score||0)/Number(a.pre.total)*100:null))}</strong><small>Pre</small></div><div class="metric"><strong>${pct(a.post?.accuracy??(a.post?.total?Number(a.post.score||0)/Number(a.post.total)*100:null))}</strong><small>Post</small></div><div class="metric"><strong>${signed(a.learningGain)}</strong><small>Learning Gain</small></div><div class="metric"><strong>${Number(pr.totalScore||0)}</strong><small>Total Score</small></div></div><h3>Game Journey</h3><div class="journey-line">${(r.games||[]).map(g=>`<div class="journey-box"><strong>${h(g.title)}</strong><small>Best ${pct(g.bestAccuracy)} • First ${pct(g.firstAttemptAccuracy)}</small><small>${Number(g.attempts||0)} attempts • ${duration(g.durationMs)} • ${g.passed?'ผ่าน ✓':'ยังไม่ผ่าน'}</small></div>`).join('')}</div><h3>Reflection & Journey</h3><div class="report-grid"><div class="metric"><strong>${r.reflection?`${Number(r.reflection.confidence||0)}/5`:'—'}</strong><small>Confidence</small></div><div class="metric"><strong>${h(r.reflection?.mostUsefulMission||'—')}</strong><small>Most useful</small></div><div class="metric"><strong>${h(r.reflection?.helpedMost||'—')}</strong><small>Helped most</small></div><div class="metric"><strong>${r.journey?.summaryViewed?'✓':'—'}</strong><small>Summary viewed</small></div></div>${r.bonusLens?`<h3>Lens Hunt Bonus</h3><div class="report-grid"><div class="metric"><strong>${Number(r.bonusLens.score||0)}</strong><small>Score</small></div><div class="metric"><strong>${Number(r.bonusLens.correctContexts||0)}/5</strong><small>Context</small></div><div class="metric"><strong>${Number(r.bonusLens.totalScans||0)}</strong><small>Scans</small></div><div class="metric"><strong>${duration(r.bonusLens.durationMs)}</strong><small>Time</small></div></div>`:''}<h3>Recent Events</h3><div class="issues">${(r.recentEvents||[]).slice(0,20).map(ev=>`<div class="issue"><strong>${h(ev.eventName||ev.type||'event')} • ${h(ev.stageId||'')}</strong><small>${h(ev.createdAt||ev.eventAt||'')}</small></div>`).join('')||'<div>ยังไม่มี event</div>'}</div>`;
  }catch(error){console.error(error);$('reportContent').innerHTML=`<div class="bad">โหลด Participant Report ไม่สำเร็จ: ${h(error?.message||error)}</div>`}
}
function csvEscape(value){const text=String(value==null?'':value);return /[",\n]/.test(text)?`"${text.replaceAll('"','""')}"`:text}
function downloadCsv(filename,rows){if(!rows.length)return;const keys=Object.keys(rows[0]);const body=[keys.join(','),...rows.map(row=>keys.map(key=>csvEscape(row[key])).join(','))].join('\n');const blob=new Blob(['\ufeff'+body],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
async function exportRows(kind){try{setStatus(`กำลังเตรียม CSV ${kind}…`,false);const result=await call('export_rows',{kind});downloadCsv(`lexicon-x-${kind}-${new Date().toISOString().slice(0,10)}.csv`,result.rows||[]);setStatus(`Export ${kind} สำเร็จ`,false)}catch(error){setStatus(`Export ไม่สำเร็จ: ${String(error?.message||error)}`,true)}}

$('loginBtn').onclick=login;$('teacherKey').onkeydown=e=>{if(e.key==='Enter')login()};$('refreshBtn').onclick=refresh;$('lockBtn').onclick=lock;
$('searchInput').oninput=renderParticipants;$('stageFilter').onchange=renderParticipants;$('exportParticipantsBtn').onclick=()=>exportRows('participants');$('exportGamesBtn').onclick=()=>exportRows('games');
$('closeReportBtn').onclick=()=>$('reportModal').classList.add('hidden');$('reportModal').addEventListener('click',e=>{if(e.target===$('reportModal'))$('reportModal').classList.add('hidden')});
document.addEventListener('click',e=>{const row=e.target.closest?.('[data-player]');if(row?.dataset.player&&row.closest('#participantBody,#issues'))openReport(row.dataset.player)});
window.addEventListener('pagehide',()=>clearTimeout(refreshTimer));
if(teacherKey){$('loginLayer').classList.add('hidden');refresh()}else showLogin();
window.EW_TEACHER_CONSOLE=Object.freeze({VERSION,endpoint,refresh});
}());
