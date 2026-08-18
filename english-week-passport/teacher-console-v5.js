(function(){
'use strict';
const VERSION='2026-08-18-TEACHER-CONSOLE-V5-XLS-EXPORT-R1';
const $=id=>document.getElementById(id);
const SESSION_IDS=['D1-AM','D1-PM','D2-AM','D2-PM','D3-AM','D3-PM'];
const PAGE_SIZE=50, LIMIT=300, CHUNK=30, REFRESH_COOLDOWN_MS=30000, REWARD_LIMIT=28, BONUS_PASS=80;
const COL={profiles:'ewp_profiles',progress:'ewp_progress',summary:'ewp_game_summary',checkpoints:'ewp_assessment_checkpoints',assessments:'ewp_assessments',teacherRoles:'ewp_teacher_roles',rewards:'ewp_bonus_rewards'};
const GAMES=[
 {id:'word_match',title:'LexiMatch Navigator',pass:55},
 {id:'category_forest',title:'Category Forest',pass:60},
 {id:'sentence_city',title:'Sentence City',pass:60},
 {id:'word_detective',title:'Conversation Quest',pass:60},
 {id:'final_boss',title:'LEXICON Champion Arena',pass:60}
];
let teacher=null,currentSession='D1-AM',rows=[],rewardRows=[],page=1,lastRefreshAt=0,refreshing=false;
const clean=v=>String(v==null?'':v).trim();
const n=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const h=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const xml=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
const ts=v=>{try{return typeof v?.toMillis==='function'?v.toMillis():(v?.seconds?Number(v.seconds)*1000:new Date(v||0).getTime()||0)}catch(_){return 0}};
const chunks=(a,size=CHUNK)=>{const o=[];for(let i=0;i<a.length;i+=size)o.push(a.slice(i,i+size));return o};
const docs=s=>s.docs.map(d=>({id:d.id,...(d.data()||{})}));
function status(text,bad=false){const el=$('apiStatus');if(!el)return;el.textContent=text;el.className='status'+(bad?' bad':'')}
function scoreOf(x){if(!x)return null;for(const k of ['accuracy','accuracyPct','percent','percentage'])if(Number.isFinite(Number(x[k])))return n(x[k]);if(n(x.total)>0&&Number.isFinite(Number(x.score)))return Math.round(n(x.score)/n(x.total)*100);return null}
function gameAverage(scores){const a=GAMES.map(g=>Number(scores?.[g.id])).filter(Number.isFinite);return a.length===GAMES.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length):a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length):0}
function stageLabel(p,summaryViewed){if(!p.preDone)return'Pre-Challenge';const a=Array.isArray(p.passed)?p.passed:[];if(!a.includes('word_match'))return'Game 1';if(!a.includes('category_forest'))return'Game 2';if(!a.includes('sentence_city'))return'Game 3';if(!a.includes('word_detective'))return'Game 4';if(!a.includes('final_boss'))return'Game 5';if(!p.postDone)return'Post-Challenge';if(!p.reflectionDone&&!p.finalReflection)return'Final Reflection';if(!summaryViewed)return'Journey Summary';return'Complete'}
async function verifyTeacher(user){if(!user||user.isAnonymous)throw new Error('TEACHER_SIGN_IN_REQUIRED');const snap=await firebase.firestore().collection(COL.teacherRoles).doc(user.uid).get();const r=snap.exists?snap.data():null;if(!r||r.active!==true||r.role!=='teacher')throw new Error('TEACHER_ROLE_REQUIRED');teacher=user;return r}
async function readByIds(col,ids){if(!ids.length)return[];const db=firebase.firestore(),fp=firebase.firestore.FieldPath.documentId();const snaps=await Promise.all(chunks([...new Set(ids)]).map(part=>db.collection(col).where(fp,'in',part).get()));return snaps.flatMap(docs)}
async function selectiveCheckpoints(progress,summaryMap){const keys=[];progress.forEach(p=>{const id=clean(p.playerId||p.id),s=summaryMap.get(id)||{};if(p.preDone&&!Number.isFinite(Number(s.preAccuracy)))keys.push(`${id}__pre`);if(p.postDone&&!Number.isFinite(Number(s.postAccuracy)))keys.push(`${id}__post`)});return readByIds(COL.checkpoints,keys)}
async function selectiveAssessments(progress,summaryMap,checkpointMap){
 const ids=[];
 progress.forEach(p=>{
  const id=clean(p.playerId||p.id),s=summaryMap.get(id)||{};
  const preCp=checkpointMap.get(`${id}__pre`),postCp=checkpointMap.get(`${id}__post`);
  const needPre=Boolean(p.preDone)&&!Number.isFinite(Number(s.preAccuracy))&&scoreOf(preCp)==null;
  const needPost=Boolean(p.postDone)&&!Number.isFinite(Number(s.postAccuracy))&&scoreOf(postCp)==null;
  if(needPre||needPost)ids.push(id);
 });
 const unique=[...new Set(ids)].filter(Boolean);if(!unique.length)return[];
 const db=firebase.firestore();
 const snaps=await Promise.all(chunks(unique).map(part=>db.collection(COL.assessments).where('playerId','in',part).get()));
 return snaps.flatMap(docs);
}
function latestAssessmentMap(assessments){
 const map=new Map();
 assessments.forEach(a=>{
  const id=clean(a.playerId),type=clean(a.assessmentType||a.type).toLowerCase();
  if(!id||!['pre','post'].includes(type))return;
  const key=`${id}__${type}`,prev=map.get(key);
  const at=ts(a.submittedAt||a.updatedAt||a.createdAt),prevAt=prev?ts(prev.submittedAt||prev.updatedAt||prev.createdAt):-1;
  if(!prev||at>=prevAt)map.set(key,a);
 });
 return map;
}
async function loadSession(sessionId){
 const db=firebase.firestore();
 const progressSnap=await db.collection(COL.progress).where('attendanceSessionId','==',sessionId).limit(LIMIT).get();
 const progress=docs(progressSnap),ids=progress.map(p=>clean(p.playerId||p.id)).filter(Boolean);
 const [profiles,summaries,rewards]=await Promise.all([
   readByIds(COL.profiles,ids),readByIds(COL.summary,ids),
   db.collection(COL.rewards).where('sessionId','==',sessionId).limit(LIMIT).get().then(docs)
 ]);
 const pm=new Map(profiles.map(x=>[clean(x.playerId||x.id),x]));
 const sm=new Map(summaries.map(x=>[clean(x.playerId||x.id),x]));
 const cps=await selectiveCheckpoints(progress,sm),cm=new Map(cps.map(x=>[x.id,x]));
 const assessments=await selectiveAssessments(progress,sm,cm),am=latestAssessmentMap(assessments);
 rows=progress.map(p=>{
   const id=clean(p.playerId||p.id),profile=pm.get(id)||{},s=sm.get(id)||{};
   const preCp=cm.get(`${id}__pre`),postCp=cm.get(`${id}__post`),preAss=am.get(`${id}__pre`),postAss=am.get(`${id}__post`);
   const pre=Number.isFinite(Number(s.preAccuracy))?n(s.preAccuracy):(scoreOf(preCp)!=null?scoreOf(preCp):scoreOf(preAss));
   const post=Number.isFinite(Number(s.postAccuracy))?n(s.postAccuracy):(scoreOf(postCp)!=null?scoreOf(postCp):scoreOf(postAss));
   const cert=Boolean(p.certificateEligible||p.certificate?.certificateId);
   const summaryViewed=Boolean(p.summaryViewed||cert);
   const scores=s.bestScores&&typeof s.bestScores==='object'?s.bestScores:(p.bestScores||{});
   return {playerId:id,nickname:clean(profile.nickname||profile.fullName||p.nickname||id),fullName:clean(profile.fullName||profile.nickname||p.nickname||id),sessionId,stage:stageLabel(p,summaryViewed),preDone:Boolean(p.preDone||pre!=null),postDone:Boolean(p.postDone||post!=null),preAccuracy:pre,postAccuracy:post,learningGain:pre!=null&&post!=null?post-pre:null,bestScores:scores,avg:gameAverage(scores),reflectionDone:Boolean(p.reflectionDone||p.finalReflection),summaryViewed,certificateEligible:cert,certificateId:clean(p.certificate?.certificateId),finishedAt:p.finishedAt};
 }).sort((a,b)=>a.fullName.localeCompare(b.fullName));
 rewardRows=rewards.filter(r=>r.completed===true&&n(r.bonusScore,-1)>=BONUS_PASS);
 page=1;
}
function authoritativeEligible(){
 const finish=new Map(rows.filter(r=>r.summaryViewed&&r.certificateEligible&&ts(r.finishedAt)>0).map(r=>[r.playerId,r]));
 return rewardRows.filter(r=>finish.has(clean(r.playerId))&&ts(r.firstCompletedAt)>0&&n(r.bonusScore,-1)>=BONUS_PASS).map(r=>{
   const f=finish.get(clean(r.playerId));
   return {...r,finish:f,qualifiedAtMs:Math.max(ts(f.finishedAt),ts(r.firstCompletedAt))};
 }).sort((a,b)=>a.qualifiedAtMs-b.qualifiedAtMs||clean(a.playerId).localeCompare(clean(b.playerId))).slice(0,REWARD_LIMIT);
}
function overview(){
 const total=rows.length,pre=rows.filter(r=>r.preDone).length,post=rows.filter(r=>r.postDone).length,refl=rows.filter(r=>r.reflectionDone).length,cert=rows.filter(r=>r.certificateEligible).length;
 const paired=rows.filter(r=>r.preAccuracy!=null&&r.postAccuracy!=null),mean=a=>a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length):null;
 const issues=[];rows.forEach(r=>{if(r.preDone&&r.preAccuracy==null)issues.push(`${r.playerId}: Pre score missing`);if(r.postDone&&r.postAccuracy==null)issues.push(`${r.playerId}: Post score missing`);if(r.postDone&&!r.reflectionDone)issues.push(`${r.playerId}: Reflection pending`);if(r.reflectionDone&&!r.summaryViewed)issues.push(`${r.playerId}: Summary pending`)});
 return {total,pre,post,refl,cert,issues,meanPre:mean(paired.map(r=>r.preAccuracy)),meanPost:mean(paired.map(r=>r.postAccuracy)),gain:mean(paired.map(r=>r.learningGain)),pairedN:paired.length};
}
function render(){
 const o=overview();
 $('kpis').innerHTML=[[o.total,`Participants • ${currentSession}`],[o.pre,'Pre complete'],[o.post,'Post complete'],[o.refl,'Reflections'],[o.cert,'Certificates'],[o.issues.length,'Data issues']].map(([v,l])=>`<div class="card kpi"><strong>${h(v)}</strong><small>${h(l)}</small></div>`).join('');
 $('learning').innerHTML=[['Pre mean',o.meanPre==null?'—':o.meanPre+'%'],['Post mean',o.meanPost==null?'—':o.meanPost+'%'],['Mean gain',o.gain==null?'—':(o.gain>0?'+':'')+o.gain+'%'],['Paired N',o.pairedN]].map(([l,v])=>`<div class="metric"><strong>${h(v)}</strong><small>${h(l)}</small></div>`).join('');
 $('games').innerHTML=GAMES.map(g=>{const p=rows.filter(r=>Number.isFinite(Number(r.bestScores?.[g.id]))),avg=p.length?Math.round(p.reduce((s,r)=>s+n(r.bestScores[g.id]),0)/p.length):0,pass=p.filter(r=>n(r.bestScores[g.id])>=g.pass).length;return `<div class="game-row"><div><strong>${h(g.title)}</strong><small>${p.length} players • pass ${g.pass}%</small></div><div class="pill">${avg}%<small>Avg</small></div><div class="pill">${pass}<small>Pass</small></div></div>`}).join('');
 $('issues').innerHTML=o.issues.length?o.issues.map(x=>`<div class="issue">${h(x)}</div>`).join(''):'<div class="good">✓ No current data-health issue</div>';
 renderRewards();renderParticipants();renderSessions();
 if($('exportXlsBtn'))$('exportXlsBtn').disabled=!rows.length;
}
function renderSessions(){$('sessionFilter').value=currentSession;$('sessionCounts').innerHTML=SESSION_IDS.map(id=>`<button class="session-chip ${id===currentSession?'active':''}" data-session="${id}"><strong>${id===currentSession?rows.length:'—'}</strong><span>${id}</span></button>`).join('');document.querySelectorAll('[data-session]').forEach(b=>b.onclick=()=>switchSession(b.dataset.session))}
function renderRewards(){
 const winners=authoritativeEligible(),claimed=winners.filter(r=>r.rewardClaimed===true).length,bonusDone=new Set(rewardRows.map(r=>clean(r.playerId))).size;
 $('rewardPanel').innerHTML=`<div class="reward-head"><div><strong>🎁 Event Reward • First ${REWARD_LIMIT} Finishers + Bonus</strong><div class="note">Eligible = Journey complete + Lens Hunt ≥${BONUS_PASS}%. Rank by qualifiedAt (the later of Journey finishedAt and qualifying Bonus firstCompletedAt).</div></div><span class="status">${winners.length}/${REWARD_LIMIT} eligible • ${claimed} claimed • ${bonusDone} qualifying bonus timestamps</span></div><div class="reward-list">${winners.length?winners.map((r,i)=>`<div class="reward-row"><span class="reward-rank">#${i+1}</span><div><strong>${h(r.finish.nickname||r.playerId)}</strong><small>${h(r.playerId)} • Bonus ${n(r.bonusScore)}%</small></div><span class="${r.rewardClaimed?'good':'warn'}">${r.rewardClaimed?'Received ✓':'Eligible'}</span><button class="btn reward-claim" data-id="${h(r.id)}" ${r.rewardClaimed?'disabled':''}>${r.rewardClaimed?'Claimed':'Mark claimed'}</button></div>`).join(''):'<div class="note">No server-authoritative eligible player yet.</div>'}</div>`;
 document.querySelectorAll('.reward-claim').forEach(b=>b.onclick=()=>claimReward(b.dataset.id));
}
function filtered(){const q=clean($('searchInput').value).toLowerCase(),st=clean($('stageFilter').value);return rows.filter(r=>(!q||`${r.playerId} ${r.fullName}`.toLowerCase().includes(q))&&(!st||r.stage===st))}
function renderParticipants(){const list=filtered(),pages=Math.max(1,Math.ceil(list.length/PAGE_SIZE));page=Math.min(page,pages);const start=(page-1)*PAGE_SIZE,part=list.slice(start,start+PAGE_SIZE);$('participantBody').innerHTML=part.map(r=>`<tr><td><strong>${h(r.fullName)}</strong><br><small>${h(r.playerId)}</small></td><td>${h(r.stage)}</td><td>${r.preAccuracy==null?'—':Math.round(r.preAccuracy)+'%'}</td><td>${r.postAccuracy==null?'—':Math.round(r.postAccuracy)+'%'}</td><td>${r.learningGain==null?'—':(r.learningGain>0?'+':'')+Math.round(r.learningGain)+'%'}</td><td>${r.avg}%</td><td>${r.reflectionDone?'✓':'—'}</td><td>${r.summaryViewed?'✓':'—'}</td><td>${r.certificateEligible?'✓':'—'}</td></tr>`).join('');$('pageInfo').textContent=`${list.length?start+1:0}–${Math.min(start+PAGE_SIZE,list.length)} / ${list.length}`;$('prevPageBtn').disabled=page<=1;$('nextPageBtn').disabled=page>=pages}
function bangkokDate(v){
 const ms=typeof v==='number'?v:ts(v);if(!ms)return'';
 try{
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(new Date(ms));
  const m=Object.fromEntries(parts.map(p=>[p.type,p.value]));return `${m.year}-${m.month}-${m.day} ${m.hour}:${m.minute}:${m.second}`;
 }catch(_){return new Date(ms).toISOString()}
}
function xlsCell(value,style='Cell'){
 if(value==null||value==='')return `<Cell ss:StyleID="${style}"><Data ss:Type="String"></Data></Cell>`;
 if(typeof value==='number'&&Number.isFinite(value))return `<Cell ss:StyleID="${style}"><Data ss:Type="Number">${value}</Data></Cell>`;
 return `<Cell ss:StyleID="${style}"><Data ss:Type="String">${xml(value)}</Data></Cell>`;
}
function xlsRow(values,style='Cell'){return `<Row>${values.map(v=>xlsCell(v,style)).join('')}</Row>`}
function xlsSheet(name,headers,data,widths=[]){
 const cols=headers.map((_,i)=>`<Column ss:AutoFitWidth="0" ss:Width="${Number(widths[i]||90)}"/>`).join('');
 const body=data.map(r=>xlsRow(r)).join('');
 return `<Worksheet ss:Name="${xml(name)}"><Table>${cols}${xlsRow(headers,'Header')}${body}</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane><ActivePane>2</ActivePane><ProtectObjects>False</ProtectObjects><ProtectScenarios>False</ProtectScenarios></WorksheetOptions></Worksheet>`;
}
function buildXlsWorkbook(list){
 const o=overview(),winners=authoritativeEligible();
 const participantHeaders=['Session','Player ID','Name','Stage','Pre %','Post %','Gain (pp)','Game 1 %','Game 2 %','Game 3 %','Game 4 %','Game 5 %','Game Avg %','Reflection','Journey Summary','Certificate','Certificate ID','Finished At (Bangkok)'];
 const participantData=list.map(r=>[
  r.sessionId,r.playerId,r.fullName,r.stage,
  r.preAccuracy==null?'':Math.round(r.preAccuracy),r.postAccuracy==null?'':Math.round(r.postAccuracy),r.learningGain==null?'':Math.round(r.learningGain),
  ...GAMES.map(g=>Number.isFinite(Number(r.bestScores?.[g.id]))?Math.round(n(r.bestScores[g.id])):''),
  Math.round(r.avg),r.reflectionDone?'Yes':'No',r.summaryViewed?'Yes':'No',r.certificateEligible?'Yes':'No',r.certificateId,bangkokDate(r.finishedAt)
 ]);
 const gameOverview=GAMES.map((g,i)=>{
  const p=rows.filter(r=>Number.isFinite(Number(r.bestScores?.[g.id]))),avg=p.length?Math.round(p.reduce((s,r)=>s+n(r.bestScores[g.id]),0)/p.length):0,pass=p.filter(r=>n(r.bestScores[g.id])>=g.pass).length;
  return [`Game ${i+1}: ${g.title}`,`${p.length} players`,`${avg}% average`,`${pass} pass`,`Pass threshold ${g.pass}%`];
 });
 const overviewData=[
  ['Exported At (Bangkok)',bangkokDate(Date.now())],['Session',currentSession],['Search Filter',clean($('searchInput').value)||'(none)'],['Stage Filter',clean($('stageFilter').value)||'(all)'],['Exported Participants',list.length],['Session Participants',o.total],['Pre Complete',o.pre],['Post Complete',o.post],['Reflections',o.refl],['Certificates',o.cert],['Paired N',o.pairedN],['Pre Mean %',o.meanPre==null?'':o.meanPre],['Post Mean %',o.meanPost==null?'':o.meanPost],['Mean Gain (pp)',o.gain==null?'':o.gain],['Data Issues',o.issues.length],['Reward Eligible',winners.length],['Reward Claimed',winners.filter(r=>r.rewardClaimed===true).length],['',''],['Game Analytics','','','',''],...gameOverview
 ];
 const rewardData=winners.map((r,i)=>[i+1,clean(r.playerId),r.finish?.fullName||r.finish?.nickname||clean(r.playerId),n(r.bonusScore),bangkokDate(r.qualifiedAtMs),r.rewardClaimed===true?'Claimed':'Eligible']);
 const sheets=[
  xlsSheet('Participants',participantHeaders,participantData,[75,95,190,110,65,65,70,70,70,70,70,70,80,80,95,85,125,145]),
  xlsSheet('Overview',['Metric','Value','Detail 1','Detail 2','Detail 3'],overviewData,[180,110,140,110,140]),
  xlsSheet('Rewards',['Rank','Player ID','Name','Bonus %','Qualified At (Bangkok)','Reward Status'],rewardData,[55,95,190,75,150,95])
 ];
 return `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40"><DocumentProperties xmlns="urn:schemas-microsoft-com:office:office"><Author>LEXICON X Teacher Console</Author><Created>${new Date().toISOString()}</Created></DocumentProperties><Styles><Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="10"/></Style><Style ss:ID="Cell"><Alignment ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D7E3EC"/></Borders></Style><Style ss:ID="Header"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#2468D8" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#174B9A"/></Borders></Style></Styles>${sheets.join('')}</Workbook>`;
}
function exportXls(){
 try{
  if(!teacher){status('Teacher sign-in required',true);return}
  const list=filtered();if(!list.length){status('ไม่มีข้อมูลสำหรับ Export XLS',true);return}
  const workbook=buildXlsWorkbook(list),blob=new Blob(['\ufeff',workbook],{type:'application/vnd.ms-excel;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  const stamp=new Date().toISOString().slice(0,10).replaceAll('-','');
  a.href=url;a.download=`LEXICON_X_${currentSession}_${stamp}.xls`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);
  status(`XLS exported • ${list.length} players • ${currentSession}`);
 }catch(e){console.error(e);status(`XLS export failed • ${clean(e.message||e)}`,true)}
}
async function claimReward(id){if(!confirm('Confirm reward received?'))return;try{await firebase.firestore().collection(COL.rewards).doc(id).update({rewardClaimed:true,rewardClaimedAt:firebase.firestore.FieldValue.serverTimestamp(),claimedBy:teacher.uid,claimedByEmail:teacher.email||'',updatedAt:firebase.firestore.FieldValue.serverTimestamp()});const r=rewardRows.find(x=>x.id===id);if(r)r.rewardClaimed=true;renderRewards();status('Reward claimed ✓')}catch(e){status(clean(e.message||e),true)}}
async function refresh(force=false){
 if(refreshing)return;const wait=REFRESH_COOLDOWN_MS-(Date.now()-lastRefreshAt);if(!force&&lastRefreshAt&&wait>0){status(`Read budget guard • refresh again in ${Math.ceil(wait/1000)}s`);return}
 refreshing=true;$('refreshBtn').disabled=true;status(`Loading ${currentSession}…`);
 try{await loadSession(currentSession);lastRefreshAt=Date.now();render();status(`Ready • ${currentSession} • ${rows.length} players • Read-Budget V5`)}catch(e){console.error(e);status(clean(e.message||e),true)}finally{refreshing=false;$('refreshBtn').disabled=false}
}
async function switchSession(id){if(!SESSION_IDS.includes(id)||id===currentSession)return;currentSession=id;lastRefreshAt=0;await refresh(true)}
async function login(){try{$('loginError').textContent='';const email=clean($('teacherEmail').value),pass=$('teacherPassword').value;const cred=await firebase.auth().signInWithEmailAndPassword(email,pass);await verifyTeacher(cred.user);$('loginLayer').classList.add('hidden');await refresh(true)}catch(e){$('loginError').textContent=clean(e.message||e)}}
function bind(){
 $('loginBtn').onclick=login;$('lockBtn').onclick=()=>firebase.auth().signOut();$('refreshBtn').onclick=()=>refresh(false);if($('exportXlsBtn')){$('exportXlsBtn').onclick=exportXls;$('exportXlsBtn').disabled=true}$('sessionFilter').onchange=e=>switchSession(e.target.value);$('searchInput').oninput=()=>{page=1;renderParticipants()};$('stageFilter').onchange=()=>{page=1;renderParticipants()};$('prevPageBtn').onclick=()=>{page=Math.max(1,page-1);renderParticipants()};$('nextPageBtn').onclick=()=>{page+=1;renderParticipants()};
 firebase.auth().onAuthStateChanged(async user=>{if(!user||user.isAnonymous){teacher=null;$('loginLayer').classList.remove('hidden');return}try{await verifyTeacher(user);$('loginLayer').classList.add('hidden');if(!rows.length)await refresh(true)}catch(e){teacher=null;$('loginLayer').classList.remove('hidden');$('loginError').textContent=clean(e.message||e)}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
window.EW_TEACHER_CONSOLE_V5=Object.freeze({version:VERSION,refresh,exportXls,readBudget:'progress+profiles+summary+rewards; selective checkpoints + assessment fallback',cooldownMs:REFRESH_COOLDOWN_MS,rewardLimit:REWARD_LIMIT,bonusPass:BONUS_PASS});
})();
