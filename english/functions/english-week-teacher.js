// LEXICON X Challenge • Teacher Analytics Authority R2
// Firestore Direct schema alignment + real attempt analytics
'use strict';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore } from 'firebase-admin/firestore';

const db=getFirestore();
const VERSION='2026-08-09-TEACHER-AUTHORITY-R2-FIRESTORE-DIRECT';
const REGION='asia-southeast1';
const APP_ID='ENGLISH-WEEK-PASSPORT-2026';
const TEACHER_KEY=defineSecret('EW_TEACHER_KEY');
const COL=Object.freeze({
  profiles:'ewp_profiles',progress:'ewp_progress',assessments:'ewp_assessments',
  gameResults:'ewp_game_results',gameSummary:'ewp_game_summary',events:'ewp_events',certificates:'ewp_certificates'
});
const GAME_STAGES=Object.freeze([
  {id:'word_match',title:'LexiMatch Navigator',skill:'Vocabulary'},
  {id:'category_forest',title:'Category Forest',skill:'Categorization'},
  {id:'sentence_city',title:'Sentence City',skill:'Sentence Building'},
  {id:'word_detective',title:'Conversation Quest AR',skill:'Conversation'},
  {id:'final_boss',title:'LEXICON Champion Arena',skill:'Integrated English'}
]);
const clean=v=>String(v==null?'':v).trim();
const num=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const nowIso=()=>new Date().toISOString();
function error(code,status=400){const e=new Error(code);e.code=code;e.status=status;return e}
function applyCors(req,res){
  const origin=clean(req.get('origin'));
  const allowed=!origin||origin==='https://supparang.github.io'||/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if(!allowed)throw error('ORIGIN_NOT_ALLOWED',403);
  res.set('Access-Control-Allow-Origin',origin||'*');res.set('Vary','Origin');
  res.set('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.set('Access-Control-Allow-Headers','Content-Type,X-EW-App-Id,X-EW-Teacher-Key');
  res.set('Cache-Control','no-store');
}
function requireTeacher(req){
  const expected=clean(TEACHER_KEY.value());if(!expected)throw error('TEACHER_SECRET_NOT_CONFIGURED',503);
  const supplied=clean(req.get('X-EW-Teacher-Key'));if(!supplied||supplied!==expected)throw error('TEACHER_UNAUTHORIZED',401);
}
const docs=s=>s.docs.map(d=>({id:d.id,...(d.data()||{})}));
function latest(rows,predicate){return rows.filter(predicate).sort((a,b)=>clean(b.submittedAt||b.createdAt||b.updatedAt).localeCompare(clean(a.submittedAt||a.createdAt||a.updatedAt)))[0]||null}
function accuracy(row){if(!row)return null;if(Number.isFinite(Number(row.accuracy)))return Math.round(Number(row.accuracy));const total=num(row.total),score=num(row.score);return total>0?Math.round(score/total*100):0}
function groupBy(rows,key='playerId'){const m=new Map();for(const r of rows){const k=clean(r[key]);if(!k)continue;if(!m.has(k))m.set(k,[]);m.get(k).push(r)}return m}
function stageLabel(p){
  if(!p?.preDone)return 'Pre-Challenge';const passed=Array.isArray(p.passed)?p.passed:[];
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
function aggregatePlayerGames(results){
  return GAME_STAGES.map(stage=>{
    const attempts=results.filter(r=>clean(r.stageId)===stage.id).sort((a,b)=>clean(a.submittedAt).localeCompare(clean(b.submittedAt)));
    const accuracies=attempts.map(r=>accuracy(r)??0);
    return {...stage,players:attempts.length?1:0,attempts:attempts.length,retryCount:Math.max(0,attempts.length-1),
      bestAccuracy:accuracies.length?Math.max(...accuracies):0,firstAttemptAccuracy:accuracies[0]||0,
      durationMs:attempts.reduce((n,r)=>n+Math.max(0,num(r.durationMs)),0),passed:attempts.some(r=>r.passed===true),
      lastPlayedAt:clean(attempts.at(-1)?.submittedAt),lastResultId:clean(attempts.at(-1)?.receiptId||attempts.at(-1)?.id)};
  });
}
async function readBase(){
  const [profiles,progress,assessments,gameResults,gameSummary,events]=await Promise.all(
    [COL.profiles,COL.progress,COL.assessments,COL.gameResults,COL.gameSummary,COL.events].map(c=>db.collection(c).get().then(docs))
  );
  return {profiles,progress,assessments,gameResults,gameSummary,events};
}
function participantRows(base){
  const profiles=new Map(base.profiles.map(r=>[clean(r.playerId||r.id),r]));
  const progress=new Map(base.progress.map(r=>[clean(r.playerId||r.id),r]));
  const assessments=groupBy(base.assessments),results=groupBy(base.gameResults);
  const ids=new Set([...profiles.keys(),...progress.keys()]);
  return [...ids].filter(Boolean).map(playerId=>{
    const profile=profiles.get(playerId)||{},p=progress.get(playerId)||{},a=assessments.get(playerId)||[];
    const pre=latest(a,r=>clean(r.assessmentType).toLowerCase()==='pre'),post=latest(a,r=>clean(r.assessmentType).toLowerCase()==='post');
    const games=aggregatePlayerGames(results.get(playerId)||[]),played=games.filter(g=>g.attempts>0);
    const preAccuracy=accuracy(pre),postAccuracy=accuracy(post);
    return {
      playerId,nickname:clean(profile.nickname||profile.fullName||playerId),fullName:clean(profile.fullName||profile.nickname||playerId),
      groupName:clean(profile.groupName||'English Week'),active:profile.active!==false,stage:stageLabel(p),
      passedCount:Array.isArray(p.passed)?p.passed.length:0,preDone:Boolean(p.preDone),postDone:Boolean(p.postDone),
      preAccuracy,postAccuracy,learningGain:preAccuracy!=null&&postAccuracy!=null?postAccuracy-preAccuracy:null,
      averageGameAccuracy:played.length?Math.round(played.reduce((n,g)=>n+g.bestAccuracy,0)/played.length):0,
      totalAttempts:games.reduce((n,g)=>n+g.attempts,0),totalDurationMs:games.reduce((n,g)=>n+g.durationMs,0),
      reflectionDone:Boolean(p.reflectionDone||p.finalReflection),reflectionConfidence:p.finalReflection?num(p.finalReflection.confidence):null,
      summaryViewed:Boolean(p.summaryViewed),certificateEligible:Boolean(p.certificateEligible),certificateId:clean(p.certificate?.certificateId),
      totalScore:num(p.totalScore),lastSeenAt:clean(profile.lastSeenAt||p.updatedAt||profile.updatedAt),updatedAt:clean(p.updatedAt||profile.updatedAt)
    };
  }).sort((a,b)=>a.groupName.localeCompare(b.groupName)||a.fullName.localeCompare(b.fullName));
}
function aggregateOverview(base,participants){
  const total=participants.length,completed=k=>participants.filter(r=>r[k]).length,mean=xs=>xs.length?Math.round(xs.reduce((a,b)=>a+b,0)/xs.length):0;
  const resultsByStage=new Map(GAME_STAGES.map(s=>[s.id,base.gameResults.filter(r=>clean(r.stageId)===s.id)]));
  const games=GAME_STAGES.map(stage=>{
    const rows=resultsByStage.get(stage.id)||[],byPlayer=groupBy(rows),players=[...byPlayer.values()].map(aggregate=>aggregatePlayerGames(aggregate).find(g=>g.id===stage.id));
    return {...stage,players:players.length,passed:players.filter(g=>g.passed).length,avgBestAccuracy:mean(players.map(g=>g.bestAccuracy)),
      avgAttempts:players.length?Number((players.reduce((n,g)=>n+g.attempts,0)/players.length).toFixed(1)):0,
      avgDurationMs:players.length?Math.round(players.reduce((n,g)=>n+g.durationMs,0)/players.length):0};
  });
  const funnel=[['Roster',total],['Pre',completed('preDone')],['Game 1',participants.filter(r=>r.passedCount>=1).length],
    ['Game 2',participants.filter(r=>r.passedCount>=2).length],['Game 3',participants.filter(r=>r.passedCount>=3).length],
    ['Game 4',participants.filter(r=>r.passedCount>=4).length],['Game 5',participants.filter(r=>r.passedCount>=5).length],
    ['Post',completed('postDone')],['Reflection',completed('reflectionDone')],['Summary',completed('summaryViewed')],
    ['Certificate',participants.filter(r=>r.summaryViewed&&r.certificateEligible).length]]
    .map(([stage,count])=>({stage,count,pct:total?Math.round(count/total*100):0}));
  const issues=[];for(const r of participants){
    if(r.postDone&&!r.reflectionDone)issues.push({playerId:r.playerId,name:r.nickname,type:'REFLECTION_PENDING',detail:'Post สำเร็จแล้ว แต่ยังไม่มี Final Reflection'});
    if(r.reflectionDone&&!r.summaryViewed)issues.push({playerId:r.playerId,name:r.nickname,type:'SUMMARY_PENDING',detail:'Reflection สำเร็จแล้ว แต่ยังไม่ได้ยืนยัน Journey Summary'});
    if(r.summaryViewed&&!r.certificateEligible)issues.push({playerId:r.playerId,name:r.nickname,type:'CERTIFICATE_MISMATCH',detail:'Journey Summary สำเร็จ แต่ Certificate ยังไม่ eligible'});
    if(r.preDone&&r.passedCount===0&&!r.postDone)issues.push({playerId:r.playerId,name:r.nickname,type:'PROGRESS_STALLED',detail:'ทำ Pre แล้ว แต่ยังไม่มีเกมที่ผ่าน'});
  }
  const pre=participants.map(r=>r.preAccuracy).filter(v=>v!=null),post=participants.map(r=>r.postAccuracy).filter(v=>v!=null),gains=participants.map(r=>r.learningGain).filter(v=>v!=null);
  return {totals:{participants:total,preDone:completed('preDone'),postDone:completed('postDone'),reflectionDone:completed('reflectionDone'),
    summaryViewed:completed('summaryViewed'),certificatesReady:participants.filter(r=>r.summaryViewed&&r.certificateEligible).length,dataIssues:issues.length},
    learning:{meanPre:mean(pre),meanPost:mean(post),meanGain:mean(gains),pairedN:gains.length},funnel,games,issues:issues.slice(0,100)};
}
async function handleOverview(){const base=await readBase(),participants=participantRows(base);return {ok:true,mode:'firebase',overview:aggregateOverview(base,participants),participants,generatedAt:nowIso(),version:VERSION}}
async function handleParticipantReport(payload){
  const playerId=clean(payload.playerId);if(!playerId)throw error('PLAYER_ID_REQUIRED');
  const [profileSnap,progressSnap,assSnap,resultSnap,eventSnap,summarySnap]=await Promise.all([
    db.collection(COL.profiles).doc(playerId).get(),db.collection(COL.progress).doc(playerId).get(),
    db.collection(COL.assessments).where('playerId','==',playerId).get(),db.collection(COL.gameResults).where('playerId','==',playerId).get(),
    db.collection(COL.events).where('playerId','==',playerId).get(),db.collection(COL.gameSummary).doc(playerId).get()
  ]);
  if(!profileSnap.exists&&!progressSnap.exists)throw error('PLAYER_NOT_FOUND',404);
  const assessments=docs(assSnap),attempts=docs(resultSnap).sort((a,b)=>clean(a.submittedAt).localeCompare(clean(b.submittedAt)));
  const events=docs(eventSnap).sort((a,b)=>clean(b.createdAt||b.eventAt).localeCompare(clean(a.createdAt||a.eventAt))).slice(0,100);
  const pre=latest(assessments,r=>clean(r.assessmentType).toLowerCase()==='pre'),post=latest(assessments,r=>clean(r.assessmentType).toLowerCase()==='post');
  const preAccuracy=accuracy(pre),postAccuracy=accuracy(post),p=progressSnap.exists?(progressSnap.data()||{}):{};
  const lens=latest(events,r=>clean(r.stageId)==='bonus_lens'&&(clean(r.eventName)==='lens_result_summary'||clean(r.type)==='lens_result_summary'));
  return {ok:true,mode:'firebase',report:{playerId,profile:profileSnap.exists?(profileSnap.data()||{}):{},progress:p,
    assessments:{pre,post,learningGain:preAccuracy!=null&&postAccuracy!=null?postAccuracy-preAccuracy:null},
    games:aggregatePlayerGames(attempts),attempts,bonusLens:lens?.payload||(summarySnap.exists?summarySnap.data()?.bonusBest:null)||null,
    reflection:p.finalReflection||null,journey:{summaryViewed:Boolean(p.summaryViewed),summaryViewedAt:p.summaryViewedAt||''},recentEvents:events},
    generatedAt:nowIso(),version:VERSION};
}
async function handleExport(payload){
  const kind=clean(payload.kind||'participants').toLowerCase(),base=await readBase();
  if(kind==='participants')return {ok:true,mode:'firebase',kind,rows:participantRows(base),version:VERSION};
  if(kind==='games'){
    const rows=[];for(const [playerId,attempts] of groupBy(base.gameResults)){for(const g of aggregatePlayerGames(attempts)){if(g.attempts)rows.push({playerId,stageId:g.id,
      bestAccuracy:g.bestAccuracy,firstAttemptAccuracy:g.firstAttemptAccuracy,passed:g.passed,attempts:g.attempts,retryCount:g.retryCount,durationMs:g.durationMs,lastResultId:g.lastResultId,lastPlayedAt:g.lastPlayedAt})}}
    return {ok:true,mode:'firebase',kind,rows,version:VERSION};
  }
  throw error('EXPORT_KIND_UNSUPPORTED');
}
async function route(action,payload){
  if(action==='health')return {ok:true,mode:'firebase',service:'LEXICON X Teacher Analytics Authority',schema:'firestore-direct-v1',version:VERSION,serverTime:nowIso()};
  if(action==='overview'||action==='participants')return handleOverview();
  if(action==='participant_report')return handleParticipantReport(payload);
  if(action==='export_rows')return handleExport(payload);
  throw error('UNKNOWN_ACTION',404);
}
export const englishWeekTeacher=onRequest({region:REGION,timeoutSeconds:60,memory:'256MiB',maxInstances:5,cors:false,secrets:[TEACHER_KEY]},async(req,res)=>{
  try{
    applyCors(req,res);if(req.method==='OPTIONS')return res.status(204).send('');
    if(!['GET','POST'].includes(req.method))throw error('METHOD_NOT_ALLOWED',405);
    requireTeacher(req);
    const payload={...(req.query||{}),...(req.body&&typeof req.body==='object'?req.body:{})};
    if(clean(payload.appId)&&clean(payload.appId)!==APP_ID)throw error('APP_ID_MISMATCH',403);
    return res.status(200).json(await route(clean(payload.action||'health'),payload));
  }catch(err){
    console.error('English Week Teacher error',err);
    return res.status(Number(err.status||500)).json({ok:false,mode:'firebase',error:clean(err.code||err.message||'INTERNAL_ERROR'),version:VERSION,serverTime:nowIso()});
  }
});
