// LEXICON X Challenge • Secure Roster Import Authority V1
'use strict';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const db=getFirestore();
const VERSION='2026-08-13-ROSTER-IMPORT-V1';
const REGION='asia-southeast1';
const APP_ID='ENGLISH-WEEK-PASSPORT-2026';
const TEACHER_KEY=defineSecret('EW_TEACHER_KEY');
const PROFILE_COL='ewp_profiles';
const MAX_ROWS=400;

const clean=v=>String(v==null?'':v).replace(/\u00a0/g,' ').trim();
const nowIso=()=>new Date().toISOString();
function error(code,status=400){const e=new Error(code);e.code=code;e.status=status;return e}
function applyCors(req,res){
  const origin=clean(req.get('origin'));
  const allowed=!origin||origin==='https://supparang.github.io'||/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if(!allowed)throw error('ORIGIN_NOT_ALLOWED',403);
  res.set('Access-Control-Allow-Origin',origin||'*');
  res.set('Vary','Origin');
  res.set('Access-Control-Allow-Methods','POST,OPTIONS');
  res.set('Access-Control-Allow-Headers','Content-Type,X-EW-App-Id,X-EW-Teacher-Key');
  res.set('Cache-Control','no-store');
}
function requireTeacher(req){
  const expected=clean(TEACHER_KEY.value());
  if(!expected)throw error('TEACHER_SECRET_NOT_CONFIGURED',503);
  const supplied=clean(req.get('X-EW-Teacher-Key'));
  if(!supplied||supplied!==expected)throw error('TEACHER_UNAUTHORIZED',401);
}
function normalizeRow(raw,index){
  const playerId=clean(raw?.studentId||raw?.playerId||raw?.id).replace(/\s+/g,'');
  const fullName=clean(raw?.name||raw?.fullName||raw?.nickname).replace(/\s+/g,' ');
  const program=clean(raw?.program||raw?.groupName||raw?.major).toUpperCase();
  const cohort=clean(raw?.cohort||raw?.yearGroup||raw?.year);
  const eventDate=clean(raw?.eventDate||raw?.date);
  const sourceRound=clean(raw?.round||raw?.session);
  const active=raw?.active===false||String(raw?.active).toLowerCase()==='false'?false:true;
  if(!/^\d{8,13}$/.test(playerId))return {ok:false,index,error:'INVALID_STUDENT_ID',playerId};
  if(!fullName)return {ok:false,index,error:'NAME_REQUIRED',playerId};
  return {ok:true,index,value:{
    playerId,
    fullName,
    nickname:fullName,
    groupName:program||'English Week',
    program:program||'',
    cohort,
    sourceEventDate:eventDate,
    sourceRound,
    active,
    eligible:true,
    institution:'Faculty of Science',
    profileSource:'english-week-master-roster-2569',
    rosterVersion:'2026-08-13-master-roster-2051',
    updatedAt:nowIso()
  }};
}
async function importRows(rows,dryRun=false){
  if(!Array.isArray(rows))throw error('ROWS_REQUIRED');
  if(rows.length<1)throw error('ROWS_EMPTY');
  if(rows.length>MAX_ROWS)throw error('ROWS_EXCEED_BATCH_LIMIT');
  const normalized=rows.map(normalizeRow);
  const invalid=normalized.filter(r=>!r.ok);
  const valid=normalized.filter(r=>r.ok).map(r=>r.value);
  const duplicateIds=[];
  const seen=new Set();
  for(const row of valid){if(seen.has(row.playerId))duplicateIds.push(row.playerId);seen.add(row.playerId)}
  if(dryRun)return {ok:invalid.length===0&&duplicateIds.length===0,dryRun:true,received:rows.length,valid:valid.length,invalid,duplicateIds,version:VERSION};
  if(invalid.length)throw error('BATCH_HAS_INVALID_ROWS');
  if(duplicateIds.length)throw error('BATCH_HAS_DUPLICATE_IDS');

  const refs=valid.map(row=>db.collection(PROFILE_COL).doc(row.playerId));
  const snaps=valid.length?await db.getAll(...refs):[];
  let created=0,updated=0;
  const batch=db.batch();
  valid.forEach((row,i)=>{
    const ref=refs[i];
    const exists=Boolean(snaps[i]?.exists);
    if(exists)updated++;else created++;
    batch.set(ref,{
      ...row,
      ...(exists?{}:{createdAt:nowIso()}),
      importAudit:{importedAt:nowIso(),sourceVersion:VERSION},
      lastRosterImportAt:FieldValue.serverTimestamp()
    },{merge:true});
  });
  await batch.commit();
  return {ok:true,dryRun:false,received:rows.length,imported:valid.length,created,updated,version:VERSION};
}
async function verify(playerId){
  const id=clean(playerId).replace(/\s+/g,'');
  if(!id)throw error('PLAYER_ID_REQUIRED');
  const snap=await db.collection(PROFILE_COL).doc(id).get();
  return {ok:true,exists:snap.exists,playerId:id,profile:snap.exists?{playerId:id,...(snap.data()||{})}:null,version:VERSION};
}

export const englishWeekRosterImport=onRequest({region:REGION,timeoutSeconds:60,memory:'256MiB',maxInstances:3,cors:false,secrets:[TEACHER_KEY]},async(req,res)=>{
  try{
    applyCors(req,res);
    if(req.method==='OPTIONS')return res.status(204).send('');
    if(req.method!=='POST')throw error('METHOD_NOT_ALLOWED',405);
    requireTeacher(req);
    const payload=req.body&&typeof req.body==='object'?req.body:{};
    if(clean(payload.appId)&&clean(payload.appId)!==APP_ID)throw error('APP_ID_MISMATCH',403);
    const action=clean(payload.action||'import').toLowerCase();
    let result;
    if(action==='dry_run')result=await importRows(payload.rows,true);
    else if(action==='import')result=await importRows(payload.rows,false);
    else if(action==='verify')result=await verify(payload.playerId);
    else if(action==='health')result={ok:true,service:'LEXICON X Roster Import Authority',collection:PROFILE_COL,maxRows:MAX_ROWS,version:VERSION};
    else throw error('UNKNOWN_ACTION',404);
    return res.status(200).json(result);
  }catch(err){
    console.error('English Week roster import error',err);
    return res.status(Number(err.status||500)).json({ok:false,error:clean(err.code||err.message||'INTERNAL_ERROR'),version:VERSION,serverTime:nowIso()});
  }
});
