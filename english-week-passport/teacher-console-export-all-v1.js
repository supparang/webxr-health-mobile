(function(){
'use strict';
const VERSION='2026-08-18-TEACHER-EXPORT-ALL-V1';
const SESSION_IDS=['D1-AM','D1-PM','D2-AM','D2-PM','D3-AM','D3-PM'];
const LIMIT=300,CHUNK=30,BONUS_PASS=80,REWARD_LIMIT=28;
const COL={profiles:'ewp_profiles',progress:'ewp_progress',summary:'ewp_game_summary',checkpoints:'ewp_assessment_checkpoints',assessments:'ewp_assessments',teacherRoles:'ewp_teacher_roles',rewards:'ewp_bonus_rewards'};
const GAMES=[
 {id:'word_match',title:'LexiMatch Navigator',pass:55},
 {id:'category_forest',title:'Category Forest',pass:60},
 {id:'sentence_city',title:'Sentence City',pass:60},
 {id:'word_detective',title:'Conversation Quest',pass:60},
 {id:'final_boss',title:'LEXICON Champion Arena',pass:60}
];
const $=id=>document.getElementById(id);
const clean=v=>String(v==null?'':v).trim();
const n=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const xml=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
const ts=v=>{try{return typeof v?.toMillis==='function'?v.toMillis():(v?.seconds?Number(v.seconds)*1000:new Date(v||0).getTime()||0)}catch(_){return 0}};
const chunks=(a,size=CHUNK)=>{const out=[];for(let i=0;i<a.length;i+=size)out.push(a.slice(i,i+size));return out};
const docs=s=>s.docs.map(d=>({id:d.id,...(d.data()||{})}));
function status(text,bad=false){const el=$('apiStatus');if(!el)return;el.textContent=text;el.className='status'+(bad?' bad':'')}
function scoreOf(x){if(!x)return null;for(const k of ['accuracy','accuracyPct','percent','percentage'])if(Number.isFinite(Number(x[k])))return n(x[k]);if(n(x.total)>0&&Number.isFinite(Number(x.score)))return Math.round(n(x.score)/n(x.total)*100);return null}
function gameAverage(scores){const a=GAMES.map(g=>Number(scores?.[g.id])).filter(Number.isFinite);return a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length):0}
function stageLabel(p,summaryViewed){if(!p.preDone)return'Pre-Challenge';const a=Array.isArray(p.passed)?p.passed:[];if(!a.includes('word_match'))return'Game 1';if(!a.includes('category_forest'))return'Game 2';if(!a.includes('sentence_city'))return'Game 3';if(!a.includes('word_detective'))return'Game 4';if(!a.includes('final_boss'))return'Game 5';if(!p.postDone)return'Post-Challenge';if(!p.reflectionDone&&!p.finalReflection)return'Final Reflection';if(!summaryViewed)return'Journey Summary';return'Complete'}
async function verifyTeacher(){const user=firebase.auth().currentUser;if(!user||user.isAnonymous)throw new Error('TEACHER_SIGN_IN_REQUIRED');const snap=await firebase.firestore().collection(COL.teacherRoles).doc(user.uid).get();const role=snap.exists?snap.data():null;if(!role||role.active!==true||role.role!=='teacher')throw new Error('TEACHER_ROLE_REQUIRED');return user}
async function readByIds(col,ids){if(!ids.length)return[];const db=firebase.firestore(),fp=firebase.firestore.FieldPath.documentId();const snaps=await Promise.all(chunks([...new Set(ids)]).map(part=>db.collection(col).where(fp,'in',part).get()));return snaps.flatMap(docs)}
async function selectiveCheckpoints(progress,summaryMap){const keys=[];progress.forEach(p=>{const id=clean(p.playerId||p.id),s=summaryMap.get(id)||{};if(p.preDone&&!Number.isFinite(Number(s.preAccuracy)))keys.push(`${id}__pre`);if(p.postDone&&!Number.isFinite(Number(s.postAccuracy)))keys.push(`${id}__post`)});return readByIds(COL.checkpoints,keys)}
async function selectiveAssessments(progress,summaryMap,checkpointMap){const ids=[];progress.forEach(p=>{const id=clean(p.playerId||p.id),s=summaryMap.get(id)||{},preCp=checkpointMap.get(`${id}__pre`),postCp=checkpointMap.get(`${id}__post`);const needPre=Boolean(p.preDone)&&!Number.isFinite(Number(s.preAccuracy))&&scoreOf(preCp)==null;const needPost=Boolean(p.postDone)&&!Number.isFinite(Number(s.postAccuracy))&&scoreOf(postCp)==null;if(needPre||needPost)ids.push(id)});const unique=[...new Set(ids)].filter(Boolean);if(!unique.length)return[];const db=firebase.firestore(),snaps=await Promise.all(chunks(unique).map(part=>db.collection(COL.assessments).where('playerId','in',part).get()));return snaps.flatMap(docs)}
function latestAssessmentMap(assessments){const map=new Map();assessments.forEach(a=>{const id=clean(a.playerId),type=clean(a.assessmentType||a.type).toLowerCase();if(!id||!['pre','post'].includes(type))return;const key=`${id}__${type}`,prev=map.get(key),at=ts(a.submittedAt||a.updatedAt||a.createdAt),prevAt=prev?ts(prev.submittedAt||prev.updatedAt||prev.createdAt):-1;if(!prev||at>=prevAt)map.set(key,a)});return map}
async function loadSessionData(sessionId){
 const db=firebase.firestore();
 const progress=docs(await db.collection(COL.progress).where('attendanceSessionId','==',sessionId).limit(LIMIT).get());
 const ids=progress.map(p=>clean(p.playerId||p.id)).filter(Boolean);
 const [profiles,summaries,rewards]=await Promise.all([
  readByIds(COL.profiles,ids),
  readByIds(COL.summary,ids),
  db.collection(COL.rewards).where('sessionId','==',sessionId).limit(LIMIT).get().then(docs)
 ]);
 const pm=new Map(profiles.map(x=>[clean(x.playerId||x.id),x])),sm=new Map(summaries.map(x=>[clean(x.playerId||x.id),x]));
 const cps=await selectiveCheckpoints(progress,sm),cm=new Map(cps.map(x=>[x.id,x]));
 const assessments=await selectiveAssessments(progress,sm,cm),am=latestAssessmentMap(assessments);
 const rows=progress.map(p=>{
  const id=clean(p.playerId||p.id),profile=pm.get(id)||{},s=sm.get(id)||{},preCp=cm.get(`${id}__pre`),postCp=cm.get(`${id}__post`),preAss=am.get(`${id}__pre`),postAss=am.get(`${id}__post`);
  const pre=Number.isFinite(Number(s.preAccuracy))?n(s.preAccuracy):(scoreOf(preCp)!=null?scoreOf(preCp):scoreOf(preAss));
  const post=Number.isFinite(Number(s.postAccuracy))?n(s.postAccuracy):(scoreOf(postCp)!=null?scoreOf(postCp):scoreOf(postAss));
  const cert=Boolean(p.certificateEligible||p.certificate?.certificateId),summaryViewed=Boolean(p.summaryViewed||cert),scores=s.bestScores&&typeof s.bestScores==='object'?s.bestScores:(p.bestScores||{});
  return {playerId:id,nickname:clean(profile.nickname||profile.fullName||p.nickname||id),fullName:clean(profile.fullName||profile.nickname||p.nickname||id),sessionId,stage:stageLabel(p,summaryViewed),preDone:Boolean(p.preDone||pre!=null),postDone:Boolean(p.postDone||post!=null),preAccuracy:pre,postAccuracy:post,learningGain:pre!=null&&post!=null?post-pre:null,bestScores:scores,avg:gameAverage(scores),reflectionDone:Boolean(p.reflectionDone||p.finalReflection),summaryViewed,certificateEligible:cert,certificateId:clean(p.certificate?.certificateId),finishedAt:p.finishedAt};
 }).sort((a,b)=>a.fullName.localeCompare(b.fullName));
 const rewardRows=rewards.filter(r=>r.completed===true&&n(r.bonusScore,-1)>=BONUS_PASS);
 return {sessionId,rows,rewardRows};
}
function eligibleRewards(bundle){const finish=new Map(bundle.rows.filter(r=>r.summaryViewed&&r.certificateEligible&&ts(r.finishedAt)>0).map(r=>[r.playerId,r]));return bundle.rewardRows.filter(r=>finish.has(clean(r.playerId))&&ts(r.firstCompletedAt)>0&&n(r.bonusScore,-1)>=BONUS_PASS).map(r=>{const f=finish.get(clean(r.playerId));return {...r,finish:f,qualifiedAtMs:Math.max(ts(f.finishedAt),ts(r.firstCompletedAt))}}).sort((a,b)=>a.qualifiedAtMs-b.qualifiedAtMs||clean(a.playerId).localeCompare(clean(b.playerId))).slice(0,REWARD_LIMIT)}
function overview(rows){const total=rows.length,pre=rows.filter(r=>r.preDone).length,post=rows.filter(r=>r.postDone).length,refl=rows.filter(r=>r.reflectionDone).length,cert=rows.filter(r=>r.certificateEligible).length,paired=rows.filter(r=>r.preAccuracy!=null&&r.postAccuracy!=null),mean=a=>a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length):null;return {total,pre,post,refl,cert,pairedN:paired.length,meanPre:mean(paired.map(r=>r.preAccuracy)),meanPost:mean(paired.map(r=>r.postAccuracy)),gain:mean(paired.map(r=>r.learningGain))}}
function bangkokDate(v){const ms=typeof v==='number'?v:ts(v);if(!ms)return'';try{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(new Date(ms)),m=Object.fromEntries(parts.map(p=>[p.type,p.value]));return `${m.year}-${m.month}-${m.day} ${m.hour}:${m.minute}:${m.second}`}catch(_){return new Date(ms).toISOString()}}
function xlsCell(value,style='Cell'){if(value==null||value==='')return `<Cell ss:StyleID="${style}"><Data ss:Type="String"></Data></Cell>`;if(typeof value==='number'&&Number.isFinite(value))return `<Cell ss:StyleID="${style}"><Data ss:Type="Number">${value}</Data></Cell>`;return `<Cell ss:StyleID="${style}"><Data ss:Type="String">${xml(value)}</Data></Cell>`}
function xlsRow(values,style='Cell'){return `<Row>${values.map(v=>xlsCell(v,style)).join('')}</Row>`}
function xlsSheet(name,headers,data,widths=[]){const cols=headers.map((_,i)=>`<Column ss:AutoFitWidth="0" ss:Width="${Number(widths[i]||90)}"/>`).join(''),body=data.map(r=>xlsRow(r)).join('');return `<Worksheet ss:Name="${xml(name)}"><Table>${cols}${xlsRow(headers,'Header')}${body}</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane><ActivePane>2</ActivePane><ProtectObjects>False</ProtectObjects><ProtectScenarios>False</ProtectScenarios></WorksheetOptions></Worksheet>`}
const PARTICIPANT_HEADERS=['Session','Player ID','Name','Stage','Pre %','Post %','Gain (pp)','Game 1 %','Game 2 %','Game 3 %','Game 4 %','Game 5 %','Game Avg %','Reflection','Journey Summary','Certificate','Certificate ID','Finished At (Bangkok)'];
const PARTICIPANT_WIDTHS=[75,95,190,110,65,65,70,70,70,70,70,70,80,80,95,85,125,145];
function participantData(rows){return rows.map(r=>[r.sessionId,r.playerId,r.fullName,r.stage,r.preAccuracy==null?'':Math.round(r.preAccuracy),r.postAccuracy==null?'':Math.round(r.postAccuracy),r.learningGain==null?'':Math.round(r.learningGain),...GAMES.map(g=>Number.isFinite(Number(r.bestScores?.[g.id]))?Math.round(n(r.bestScores[g.id])):''),Math.round(r.avg),r.reflectionDone?'Yes':'No',r.summaryViewed?'Yes':'No',r.certificateEligible?'Yes':'No',r.certificateId,bangkokDate(r.finishedAt)])}
function buildWorkbook(bundles){
 const allRows=bundles.flatMap(b=>b.rows),allRewards=bundles.flatMap(b=>eligibleRewards(b).map((r,i)=>({...r,sessionId:b.sessionId,rank:i+1}))),summaryRows=bundles.map(b=>{const o=overview(b.rows),eligible=eligibleRewards(b);return [b.sessionId,o.total,o.pre,o.post,o.refl,o.cert,o.pairedN,o.meanPre==null?'':o.meanPre,o.meanPost==null?'':o.meanPost,o.gain==null?'':o.gain,eligible.length,eligible.filter(r=>r.rewardClaimed===true).length]}),all=overview(allRows);
 summaryRows.push(['ALL',all.total,all.pre,all.post,all.refl,all.cert,all.pairedN,all.meanPre==null?'':all.meanPre,all.meanPost==null?'':all.meanPost,all.gain==null?'':all.gain,allRewards.length,allRewards.filter(r=>r.rewardClaimed===true).length]);
 const rewardData=allRewards.map(r=>[r.sessionId,r.rank,clean(r.playerId),r.finish?.fullName||r.finish?.nickname||clean(r.playerId),n(r.bonusScore),bangkokDate(r.qualifiedAtMs),r.rewardClaimed===true?'Claimed':'Eligible']);
 const sheets=[
  xlsSheet('Round Summary',['Session','Participants','Pre Complete','Post Complete','Reflections','Certificates','Paired N','Pre Mean %','Post Mean %','Mean Gain (pp)','Reward Eligible','Reward Claimed'],summaryRows,[80,85,85,85,85,85,70,80,80,90,90,90]),
  xlsSheet('All Participants',PARTICIPANT_HEADERS,participantData(allRows),PARTICIPANT_WIDTHS),
  xlsSheet('Rewards All',['Session','Rank','Player ID','Name','Bonus %','Qualified At (Bangkok)','Reward Status'],rewardData,[75,55,95,190,75,150,95]),
  ...bundles.map(b=>xlsSheet(b.sessionId,PARTICIPANT_HEADERS,participantData(b.rows),PARTICIPANT_WIDTHS))
 ];
 return `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40"><DocumentProperties xmlns="urn:schemas-microsoft-com:office:office"><Author>LEXICON X Teacher Console</Author><Created>${new Date().toISOString()}</Created></DocumentProperties><Styles><Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="10"/></Style><Style ss:ID="Cell"><Alignment ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D7E3EC"/></Borders></Style><Style ss:ID="Header"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#2468D8" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#174B9A"/></Borders></Style></Styles>${sheets.join('')}</Workbook>`;
}
async function exportAll(){
 const btn=$('exportAllXlsBtn'),single=$('exportXlsBtn'),refresh=$('refreshBtn');
 try{
  await verifyTeacher();
  if(btn)btn.disabled=true;if(single)single.disabled=true;if(refresh)refresh.disabled=true;
  const bundles=[];
  for(let i=0;i<SESSION_IDS.length;i++){
   const sid=SESSION_IDS[i];status(`Export All • กำลังอ่าน ${sid} (${i+1}/${SESSION_IDS.length})…`);bundles.push(await loadSessionData(sid));
  }
  const total=bundles.reduce((s,b)=>s+b.rows.length,0);if(!total)throw new Error('NO_PARTICIPANT_DATA');
  status(`Export All • กำลังสร้าง Excel ${total} records…`);
  const workbook=buildWorkbook(bundles),blob=new Blob(['\ufeff',workbook],{type:'application/vnd.ms-excel;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a'),stamp=new Date().toISOString().slice(0,10).replaceAll('-','');
  a.href=url;a.download=`LEXICON_X_ALL_6_ROUNDS_${stamp}.xls`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  status(`XLS exported • All 6 Rounds • ${total} participant records`);
 }catch(e){console.error(e);status(`Export All failed • ${clean(e.message||e)}`,true)}finally{if(btn)btn.disabled=false;if(single)single.disabled=false;if(refresh)refresh.disabled=false}
}
function bind(){const btn=$('exportAllXlsBtn');if(btn)btn.addEventListener('click',exportAll)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
window.EW_TEACHER_EXPORT_ALL_V1=Object.freeze({version:VERSION,exportAll,sessions:[...SESSION_IDS]});
})();
