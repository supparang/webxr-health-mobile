(function(){
'use strict';

const VERSION='2026-08-14-TEACHER-CONSOLE-V3-ASSESSMENT-FALLBACK';
const $=id=>document.getElementById(id);
const SESSION_IDS=Object.freeze(['D1-AM','D1-PM','D2-AM','D2-PM','D3-AM','D3-PM']);
const PAGE_SIZE=50;
const HARD_SESSION_LIMIT=300;
const IN_QUERY_CHUNK=30;
const COL=Object.freeze({
  profiles:'ewp_profiles',progress:'ewp_progress',assessments:'ewp_assessments',
  gameResults:'ewp_game_results',gameSummary:'ewp_game_summary',events:'ewp_events',
  certificates:'ewp_certificates',teacherRoles:'ewp_teacher_roles'
});
const GAME_STAGES=Object.freeze([
  {id:'word_match',title:'LexiMatch Navigator',skill:'Vocabulary'},
  {id:'category_forest',title:'Category Forest',skill:'Categorization'},
  {id:'sentence_city',title:'Sentence City',skill:'Sentence Building'},
  {id:'word_detective',title:'Conversation Quest AR',skill:'Conversation'},
  {id:'final_boss',title:'LEXICON Champion Arena',skill:'Integrated English'}
]);
const MISSION_NAMES=Object.freeze({word_match:'LexiMatch Navigator',category_forest:'Category Forest',sentence_city:'Sentence City',word_detective:'Conversation Quest AR',final_boss:'LEXICON Champion Arena',bonus_lens:'Lexicon Lens Hunt'});
const HELPED_NAMES=Object.freeze({vocabulary:'Vocabulary',context:'Context',speaking:'Speaking',movement:'Movement',strategy:'Strategy'});

let currentTeacher=null;
let currentSession='D1-AM';
let currentPage=1;
let rows=[];
let sessionCounts={};
let refreshing=false;

const h=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const clean=v=>String(v==null?'':v).trim();
const num=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const nowTime=()=>new Date().toLocaleTimeString('th-TH');
function pct(v){return v==null?'—':`${Math.round(num(v))}%`}
function signed(v){if(v==null)return '—';const n=Math.round(num(v));return `${n>0?'+':''}${n}%`}
function duration(ms){const s=Math.max(0,Math.round(num(ms)/1000));const m=Math.floor(s/60);return m?`${m}m ${s%60}s`:`${s}s`}
function setStatus(text,bad=false){$('apiStatus').textContent=text;$('apiStatus').className='status'+(bad?' bad':'')}
function chunks(values,size=IN_QUERY_CHUNK){const out=[];for(let i=0;i<values.length;i+=size)out.push(values.slice(i,i+size));return out}
function docs(snap){return snap.docs.map(d=>({id:d.id,...(d.data()||{})}))}
function stageLabel(p){
  if(!p?.preDone)return 'Pre-Challenge';
  const passed=Array.isArray(p.passed)?p.passed:[];
  if(!passed.includes('word_match'))return 'Game 1';
  if(!passed.includes('category_forest'))return 'Game 2';
  if(!passed.includes('sentence_city'))return 'Game 3';
  if(!passed.includes('word_detective'))return 'Game 4';
  if(!passed.includes('final_boss'))return 'Game 5';
  if(!p?.postDone)return 'Post-Challenge';
  if(!p?.reflectionDone&&!p?.finalReflection)return 'Final Reflection';
  if(!p?.summaryViewed)return 'Journey Summary';
  return 'Complete';
}
function gameAverage(bestScores){
  const vals=GAME_STAGES.map(g=>num(bestScores?.[g.id],NaN)).filter(Number.isFinite);
  return vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):0;
}
function totalAttempts(summary){
  if(Number.isFinite(Number(summary?.totalGameAttempts)))return num(summary.totalGameAttempts);
  return Object.values(summary?.attemptCounts||{}).reduce((s,v)=>s+num(v),0);
}
function totalDuration(summary){
  if(Number.isFinite(Number(summary?.totalGameDurationMs)))return num(summary.totalGameDurationMs);
  return Object.values(summary?.durationMsByStage||{}).reduce((s,v)=>s+num(v),0);
}
function assessmentAccuracy(a){
  if(!a)return null;
  if(Number.isFinite(Number(a.accuracy)))return num(a.accuracy);
  if(Number.isFinite(Number(a.percent)))return num(a.percent);
  const total=num(a.total||a.totalQuestions||a.itemCount,0);
  const score=num(a.score||a.correct||a.correctCount,0);
  return total>0?Math.round(score/total*100):null;
}
function latestAssessment(records,type){
  return records
    .filter(a=>clean(a.assessmentType||a.type||a.phase).toLowerCase()===type)
    .sort((a,b)=>clean(b.submittedAt||b.updatedAt||b.createdAt).localeCompare(clean(a.submittedAt||a.updatedAt||a.createdAt)))[0]||null;
}

async function verifyTeacher(user){
  if(!user)throw new Error('TEACHER_SIGN_IN_REQUIRED');
  await user.getIdToken(true);
  const snap=await firebase.firestore().collection(COL.teacherRoles).doc(user.uid).get();
  const role=snap.exists?(snap.data()||{}):null;
  if(!role||role.active!==true||role.role!=='teacher'){
    const detail=`TEACHER_ROLE_REQUIRED | uid=${user.uid} | role=${role?.role??'missing'} | active=${String(role?.active??'missing')}`;
    throw new Error(detail);
  }
  return role;
}

async function readByIds(collectionName,ids){
  if(!ids.length)return [];
  const db=firebase.firestore();
  const fp=firebase.firestore.FieldPath.documentId();
  const snaps=await Promise.all(chunks(ids).map(part=>db.collection(collectionName).where(fp,'in',part).get()));
  return snaps.flatMap(docs);
}
async function readByPlayerIds(collectionName,ids){
  if(!ids.length)return [];
  const db=firebase.firestore();
  const snaps=await Promise.all(chunks(ids).map(part=>db.collection(collectionName).where('playerId','in',part).get()));
  return snaps.flatMap(docs);
}

async function countSessions(){
  const db=firebase.firestore();
  const counts={};
  await Promise.all(SESSION_IDS.map(async id=>{
    try{
      if(typeof db.collection(COL.progress).where('attendanceSessionId','==',id).count==='function'){
        const snap=await db.collection(COL.progress).where('attendanceSessionId','==',id).count().get();
        counts[id]=num(snap.data()?.count);
      }else{
        const snap=await db.collection(COL.progress).where('attendanceSessionId','==',id).limit(HARD_SESSION_LIMIT).get();
        counts[id]=snap.size;
      }
    }catch(_){counts[id]=null}
  }));
  sessionCounts=counts;
  renderSessionCounts();
}

async function loadSession(sessionId){
  if(!SESSION_IDS.includes(sessionId))throw new Error('SESSION_REQUIRED');
  const db=firebase.firestore();
  const progressSnap=await db.collection(COL.progress)
    .where('attendanceSessionId','==',sessionId)
    .limit(HARD_SESSION_LIMIT)
    .get();
  const progress=docs(progressSnap);
  const ids=progress.map(p=>clean(p.playerId||p.id)).filter(Boolean);
  const [profiles,summaries,assessments]=await Promise.all([
    readByIds(COL.profiles,ids),
    readByIds(COL.gameSummary,ids),
    readByPlayerIds(COL.assessments,ids)
  ]);
  const pMap=new Map(profiles.map(x=>[clean(x.playerId||x.id),x]));
  const sMap=new Map(summaries.map(x=>[clean(x.playerId||x.id),x]));
  const aMap=new Map();
  for(const a of assessments){
    const playerId=clean(a.playerId);
    if(!playerId)continue;
    if(!aMap.has(playerId))aMap.set(playerId,[]);
    aMap.get(playerId).push(a);
  }
  rows=progress.map(p=>{
    const playerId=clean(p.playerId||p.id),profile=pMap.get(playerId)||{},summary=sMap.get(playerId)||{};
    const playerAssessments=aMap.get(playerId)||[];
    const preAssessment=latestAssessment(playerAssessments,'pre');
    const postAssessment=latestAssessment(playerAssessments,'post');
    const preAccuracy=Number.isFinite(Number(summary.preAccuracy))?num(summary.preAccuracy):assessmentAccuracy(preAssessment);
    const postAccuracy=Number.isFinite(Number(summary.postAccuracy))?num(summary.postAccuracy):assessmentAccuracy(postAssessment);
    const gain=preAccuracy!=null&&postAccuracy!=null?postAccuracy-preAccuracy:null;
    const bestScores=(summary.bestScores&&typeof summary.bestScores==='object')?summary.bestScores:(p.bestScores||{});
    const cert=Boolean(p.certificateEligible||p.certificate?.certificateId);
    return {
      playerId,
      nickname:clean(profile.nickname||profile.fullName||playerId),
      fullName:clean(profile.fullName||profile.nickname||playerId),
      groupName:clean(profile.groupName||'English Week'),
      sessionId:sessionId,
      stage:stageLabel(p),
      preDone:Boolean(p.preDone),postDone:Boolean(p.postDone),
      preAccuracy,postAccuracy,learningGain:gain,
      bestScores,averageGameAccuracy:gameAverage(bestScores),
      totalAttempts:totalAttempts(summary),totalDurationMs:totalDuration(summary),
      reflectionDone:Boolean(p.reflectionDone||p.finalReflection),
      summaryViewed:Boolean(p.summaryViewed),certificateEligible:cert,
      totalScore:num(p.totalScore||summary.totalScore),updatedAt:clean(p.updatedAt||summary.updatedAt)
    };
  }).sort((a,b)=>a.fullName.localeCompare(b.fullName));
  currentPage=1;
  sessionCounts[sessionId]=rows.length;
}

function filteredRows(){
  const q=clean($('searchInput')?.value).toLowerCase();
  const stage=clean($('stageFilter')?.value);
  return rows.filter(r=>{
    const hay=`${r.playerId} ${r.nickname} ${r.fullName} ${r.groupName}`.toLowerCase();
    return (!q||hay.includes(q))&&(!stage||r.stage===stage);
  });
}
function overview(){
  const total=rows.length;
  const completed=k=>rows.filter(r=>r[k]).length;
  const mean=xs=>xs.length?Math.round(xs.reduce((a,b)=>a+b,0)/xs.length):null;
  const pre=rows.map(r=>r.preAccuracy).filter(v=>v!=null),post=rows.map(r=>r.postAccuracy).filter(v=>v!=null),gains=rows.map(r=>r.learningGain).filter(v=>v!=null);
  const funnel=[['Roster',total],['Pre',completed('preDone')],['Game 1',rows.filter(r=>(r.bestScores?.word_match??null)!=null).length],['Game 2',rows.filter(r=>(r.bestScores?.category_forest??null)!=null).length],['Game 3',rows.filter(r=>(r.bestScores?.sentence_city??null)!=null).length],['Game 4',rows.filter(r=>(r.bestScores?.word_detective??null)!=null).length],['Game 5',rows.filter(r=>(r.bestScores?.final_boss??null)!=null).length],['Post',completed('postDone')],['Reflection',completed('reflectionDone')],['Summary',completed('summaryViewed')],['Certificate',completed('certificateEligible')]].map(([stage,count])=>({stage,count,pct:total?Math.round(count/total*100):0}));
  const games=GAME_STAGES.map(g=>{
    const played=rows.filter(r=>Number.isFinite(Number(r.bestScores?.[g.id])));
    return {...g,players:played.length,passed:played.filter(r=>num(r.bestScores[g.id])>=(g.id==='final_boss'?65:70)).length,avgBestAccuracy:mean(played.map(r=>num(r.bestScores[g.id])))??0};
  });
  const issues=[];
  for(const r of rows){
    if(r.preDone&&r.preAccuracy==null)issues.push({playerId:r.playerId,name:r.nickname,type:'PRE_SCORE_MISSING',detail:'Pre สำเร็จแล้ว แต่ยังไม่พบคะแนนจาก Assessment หรือ Summary'});
    if(r.postDone&&r.postAccuracy==null)issues.push({playerId:r.playerId,name:r.nickname,type:'POST_SCORE_MISSING',detail:'Post สำเร็จแล้ว แต่ยังไม่พบคะแนนจาก Assessment หรือ Summary'});
    if(r.postDone&&!r.reflectionDone)issues.push({playerId:r.playerId,name:r.nickname,type:'REFLECTION_PENDING',detail:'Post สำเร็จแล้ว แต่ยังไม่มี Final Reflection'});
    if(r.reflectionDone&&!r.summaryViewed)issues.push({playerId:r.playerId,name:r.nickname,type:'SUMMARY_PENDING',detail:'Reflection สำเร็จแล้ว แต่ยังไม่ได้ยืนยัน Journey Summary'});
    if(r.summaryViewed&&!r.certificateEligible)issues.push({playerId:r.playerId,name:r.nickname,type:'CERTIFICATE_MISMATCH',detail:'Journey Summary สำเร็จ แต่ Certificate ยังไม่พร้อม'});
    if(r.preDone&&r.stage==='Game 1')issues.push({playerId:r.playerId,name:r.nickname,type:'PROGRESS_STALLED',detail:'ทำ Pre แล้ว แต่ยังไม่ผ่าน Game 1'});
  }
  return {total,preDone:completed('preDone'),postDone:completed('postDone'),reflectionDone:completed('reflectionDone'),summaryViewed:completed('summaryViewed'),certificates:completed('certificateEligible'),issues,meanPre:mean(pre),meanPost:mean(post),meanGain:mean(gains),pairedN:gains.length,funnel,games};
}
function metricCard(value,label){return `<div class="card kpi"><strong>${h(value)}</strong><small>${h(label)}</small></div>`}
function renderSessionCounts(){
  const el=$('sessionCounts');if(!el)return;
  el.innerHTML=SESSION_IDS.map(id=>`<button class="session-chip ${currentSession===id?'active':''}" data-session="${id}"><strong>${sessionCounts[id]==null?'—':sessionCounts[id]}</strong><span>${id}</span></button>`).join('');
  if($('sessionFilter'))$('sessionFilter').value=currentSession;
}
function renderOverview(){
  const o=overview();
  $('kpis').innerHTML=[metricCard(o.total,`Participants • ${currentSession}`),metricCard(o.preDone,'Pre complete'),metricCard(o.postDone,'Post complete'),metricCard(o.reflectionDone,'Reflections'),metricCard(o.certificates,'Certificates'),metricCard(o.issues.length,'Data issues')].join('');
  $('learning').innerHTML=[['Pre mean',pct(o.meanPre)],['Post mean',pct(o.meanPost)],['Mean gain',signed(o.meanGain)],['Paired N',o.pairedN]].map(([label,value])=>`<div class="metric"><strong>${h(value)}</strong><small>${h(label)}</small></div>`).join('');
  $('funnel').innerHTML=o.funnel.map(item=>`<div class="funnel-item"><div class="funnel-bar"><div class="funnel-fill" style="height:${Math.max(4,item.pct)}%"></div></div><strong>${h(item.stage)}</strong><small>${item.count} • ${item.pct}%</small></div>`).join('');
  $('games').innerHTML=o.games.map(g=>`<div class="game-row"><div><strong>${h(g.title)}</strong><small>${h(g.skill)} • ${g.players} players</small></div><div class="pill">${g.avgBestAccuracy}%<small>Avg</small></div><div class="pill">${g.passed}<small>Pass</small></div><div class="pill">—<small>Try*</small></div></div>`).join('');
  $('issues').innerHTML=o.issues.length?o.issues.slice(0,100).map(i=>`<div class="issue" data-player="${h(i.playerId)}"><strong>${h(i.name)} • ${h(i.type)}</strong><small>${h(i.detail)}</small></div>`).join(''):'<div class="good">✓ ไม่พบ Data Health issue ในรอบนี้</div>';
  renderParticipants();renderSessionCounts();
}
function renderParticipants(){
  const list=filteredRows();
  const pages=Math.max(1,Math.ceil(list.length/PAGE_SIZE));currentPage=Math.min(Math.max(1,currentPage),pages);
  const start=(currentPage-1)*PAGE_SIZE,paged=list.slice(start,start+PAGE_SIZE);
  $('participantBody').innerHTML=paged.map(r=>`<tr data-player="${h(r.playerId)}"><td><strong>${h(r.nickname)}</strong><br><small>${h(r.playerId)}</small></td><td><strong>${h(r.sessionId)}</strong><br><small>${h(r.groupName)}</small></td><td><strong>${h(r.stage)}</strong></td><td>${pct(r.preAccuracy)}</td><td>${pct(r.postAccuracy)}</td><td class="${r.learningGain!=null&&r.learningGain>=0?'good':'warn'}">${signed(r.learningGain)}</td><td>${pct(r.averageGameAccuracy)}</td><td>${r.totalAttempts}<br><small>${duration(r.totalDurationMs)}</small></td><td class="${r.reflectionDone?'good':'warn'}">${r.reflectionDone?'✓':'—'}</td><td class="${r.summaryViewed?'good':'warn'}">${r.summaryViewed?'✓':'—'}</td><td class="${r.certificateEligible?'good':'warn'}">${r.certificateEligible?'✓':'—'}</td></tr>`).join('');
  $('pageInfo').textContent=list.length?`${start+1}–${Math.min(start+PAGE_SIZE,list.length)} / ${list.length}`:'0–0 / 0';
  $('prevPageBtn').disabled=currentPage<=1;$('nextPageBtn').disabled=currentPage>=pages;
}

async function refresh(){
  if(!currentTeacher||refreshing)return;
  refreshing=true;$('refreshBtn').disabled=true;setStatus(`กำลังโหลด ${currentSession}…`);
  try{
    await verifyTeacher(currentTeacher);
    await loadSession(currentSession);
    renderOverview();
    setStatus(`Firebase live • ${currentSession} • ${rows.length} คน • ${nowTime()}`);
    countSessions().catch(()=>{});
  }catch(error){
    console.error(error);setStatus(clean(error?.message||error),true);
    if(/TEACHER_ROLE_REQUIRED|permission-denied/i.test(clean(error?.message||error)))showLogin(`สิทธิ์ Teacher ไม่ผ่าน: ${clean(error?.message||error)}`);
  }finally{refreshing=false;$('refreshBtn').disabled=false}
}
function showLogin(message=''){ $('loginLayer').classList.remove('hidden');$('loginError').textContent=message;setStatus('Teacher Console locked',true) }
async function login(){
  const email=clean($('teacherEmail').value),password=$('teacherPassword').value;
  if(!email||!password){$('loginError').textContent='กรุณากรอก Email และ Password';return}
  $('loginBtn').disabled=true;$('loginError').textContent='กำลังตรวจสอบบัญชี Teacher…';
  try{
    const cred=await firebase.auth().signInWithEmailAndPassword(email,password);
    await verifyTeacher(cred.user);currentTeacher=cred.user;$('loginLayer').classList.add('hidden');$('loginError').textContent='';await refresh();
  }catch(error){
    console.error(error);currentTeacher=null;await firebase.auth().signOut().catch(()=>{});$('loginError').textContent=`เข้าไม่ได้: ${clean(error?.message||error)}`;
  }finally{$('loginBtn').disabled=false}
}
async function lock(){currentTeacher=null;rows=[];await firebase.auth().signOut().catch(()=>{});showLogin('ออกจาก Teacher Console แล้ว')}

async function openReport(playerId){
  $('reportModal').classList.remove('hidden');$('reportTitle').textContent='กำลังโหลด Participant Report…';$('reportSubtitle').textContent=playerId;$('reportContent').innerHTML='<div class="metric">กำลังอ่านข้อมูลเฉพาะผู้เล่นคนนี้…</div>';
  try{
    const db=firebase.firestore();
    const [profileSnap,progressSnap,summarySnap,certSnap,assSnap,resultSnap,eventSnap]=await Promise.all([
      db.collection(COL.profiles).doc(playerId).get(),db.collection(COL.progress).doc(playerId).get(),db.collection(COL.gameSummary).doc(playerId).get(),db.collection(COL.certificates).doc(playerId).get(),
      db.collection(COL.assessments).where('playerId','==',playerId).get(),
      db.collection(COL.gameResults).where('playerId','==',playerId).get(),
      db.collection(COL.events).where('playerId','==',playerId).limit(100).get()
    ]);
    const profile=profileSnap.exists?(profileSnap.data()||{}):{},progress=progressSnap.exists?(progressSnap.data()||{}):{},summary=summarySnap.exists?(summarySnap.data()||{}):{},cert=certSnap.exists?(certSnap.data()||{}):{};
    const assessments=docs(assSnap),results=docs(resultSnap),events=docs(eventSnap);
    const pre=latestAssessment(assessments,'pre'),post=latestAssessment(assessments,'post'),preA=Number.isFinite(Number(summary.preAccuracy))?num(summary.preAccuracy):assessmentAccuracy(pre),postA=Number.isFinite(Number(summary.postAccuracy))?num(summary.postAccuracy):assessmentAccuracy(post);
    const gameBoxes=GAME_STAGES.map(g=>{const attempts=results.filter(r=>clean(r.stageId)===g.id);const scores=attempts.map(a=>Number.isFinite(Number(a.accuracy))?num(a.accuracy):(num(a.total)>0?Math.round(num(a.score)/num(a.total)*100):0));const best=scores.length?Math.max(...scores):num(progress.bestScores?.[g.id]);const dur=attempts.reduce((s,a)=>s+num(a.durationMs),0)||num(summary.durationMsByStage?.[g.id]);return `<div class="journey-box"><strong>${h(g.title)}</strong><small>Best ${pct(best)} • ${attempts.length||num(summary.attemptCounts?.[g.id])} attempts</small><small>${duration(dur)}</small></div>`}).join('');
    const reflection=progress.finalReflection||null;
    $('reportTitle').textContent=clean(profile.nickname||profile.fullName||playerId);$('reportSubtitle').textContent=`${playerId} • ${currentSession}`;
    $('reportContent').innerHTML=`<div class="report-grid"><div class="metric"><strong>${pct(preA)}</strong><small>Pre</small></div><div class="metric"><strong>${pct(postA)}</strong><small>Post</small></div><div class="metric"><strong>${signed(preA!=null&&postA!=null?postA-preA:null)}</strong><small>Gain</small></div><div class="metric"><strong>${num(progress.totalScore||summary.totalScore)}</strong><small>Total Score</small></div></div><h3>Game Journey</h3><div class="journey-line">${gameBoxes}</div><h3>Reflection & Certificate</h3><div class="report-grid"><div class="metric"><strong>${reflection?`${num(reflection.confidence)}/5`:'—'}</strong><small>Confidence</small></div><div class="metric"><strong>${h(MISSION_NAMES[reflection?.mostUsefulMission]||reflection?.mostUsefulMission||'—')}</strong><small>Most useful</small></div><div class="metric"><strong>${h(HELPED_NAMES[reflection?.helpedMost]||reflection?.helpedMost||'—')}</strong><small>Helped most</small></div><div class="metric"><strong>${h(cert.certificateId||progress.certificate?.certificateId||'—')}</strong><small>Certificate</small></div></div><h3>Recent Events</h3><div class="issues">${events.sort((a,b)=>clean(b.createdAt||b.eventAt).localeCompare(clean(a.createdAt||a.eventAt))).slice(0,20).map(e=>`<div class="issue"><strong>${h(e.eventName||e.type||'event')} • ${h(e.stageId||'')}</strong><small>${h(e.createdAt||e.eventAt||'')}</small></div>`).join('')||'<div>ยังไม่มี event</div>'}</div>`;
  }catch(error){console.error(error);$('reportContent').innerHTML=`<div class="bad">โหลดรายงานไม่สำเร็จ: ${h(error?.message||error)}</div>`}
}
function csvEscape(v){const s=String(v??'');return /[",\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s}
function exportCsv(){
  const list=filteredRows();const out=list.map(r=>({playerId:r.playerId,name:r.fullName,sessionId:r.sessionId,stage:r.stage,pre:r.preAccuracy,post:r.postAccuracy,gain:r.learningGain,gameAvg:r.averageGameAccuracy,attempts:r.totalAttempts,durationMs:r.totalDurationMs,reflection:r.reflectionDone,summary:r.summaryViewed,certificate:r.certificateEligible,totalScore:r.totalScore}));
  if(!out.length)return;const keys=Object.keys(out[0]);const body=[keys.join(','),...out.map(r=>keys.map(k=>csvEscape(r[k])).join(','))].join('\n');const blob=new Blob(['\ufeff'+body],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`lexicon-x-${currentSession}-${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

$('loginBtn').onclick=login;$('teacherPassword').onkeydown=e=>{if(e.key==='Enter')login()};$('refreshBtn').onclick=refresh;$('lockBtn').onclick=lock;
$('sessionFilter').onchange=async e=>{currentSession=e.target.value;currentPage=1;await refresh()};
$('searchInput').oninput=()=>{currentPage=1;renderParticipants()};$('stageFilter').onchange=()=>{currentPage=1;renderParticipants()};
$('prevPageBtn').onclick=()=>{if(currentPage>1){currentPage--;renderParticipants()}};$('nextPageBtn').onclick=()=>{currentPage++;renderParticipants()};
$('exportParticipantsBtn').onclick=exportCsv;$('exportGamesBtn').onclick=exportCsv;
$('closeReportBtn').onclick=()=>$('reportModal').classList.add('hidden');$('reportModal').addEventListener('click',e=>{if(e.target===$('reportModal'))$('reportModal').classList.add('hidden')});
document.addEventListener('click',e=>{const chip=e.target.closest?.('[data-session]');if(chip){currentSession=chip.dataset.session;currentPage=1;$('sessionFilter').value=currentSession;refresh();return}const row=e.target.closest?.('[data-player]');if(row?.dataset.player&&row.closest('#participantBody,#issues'))openReport(row.dataset.player)});

firebase.auth().onAuthStateChanged(async user=>{
  if(!user){showLogin();return}
  try{await verifyTeacher(user);currentTeacher=user;$('loginLayer').classList.add('hidden');await refresh()}catch(error){console.warn(error);showLogin(clean(error?.message||error))}
});
window.EW_TEACHER_CONSOLE=Object.freeze({VERSION,get session(){return currentSession},refresh});
}());