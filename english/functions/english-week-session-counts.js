// LEXICON X Challenge • Lightweight Teacher Session Counts
'use strict';
import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const db=getFirestore();
const auth=getAuth();
const VERSION='2026-08-18-TEACHER-SESSION-COUNTS-V1';
const REGION='asia-southeast1';
const APP_ID='ENGLISH-WEEK-PASSPORT-2026';
const SESSION_IDS=Object.freeze(['D1-AM','D1-PM','D2-AM','D2-PM','D3-AM','D3-PM']);
const COL=Object.freeze({progress:'ewp_progress',teacherRoles:'ewp_teacher_roles'});
const clean=v=>String(v==null?'':v).trim();
const nowIso=()=>new Date().toISOString();
function error(code,status=400){const e=new Error(code);e.code=code;e.status=status;return e}
function applyCors(req,res){
  const origin=clean(req.get('origin'));
  const allowed=!origin||origin==='https://supparang.github.io'||/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if(!allowed)throw error('ORIGIN_NOT_ALLOWED',403);
  res.set('Access-Control-Allow-Origin',origin||'*');
  res.set('Vary','Origin');
  res.set('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.set('Access-Control-Allow-Headers','Content-Type,Authorization,X-EW-App-Id');
  res.set('Cache-Control','no-store');
}
async function requireTeacher(req){
  const raw=clean(req.get('authorization'));
  if(!/^Bearer\s+/i.test(raw))throw error('TEACHER_SIGN_IN_REQUIRED',401);
  const token=raw.replace(/^Bearer\s+/i,'').trim();
  if(!token)throw error('TEACHER_SIGN_IN_REQUIRED',401);
  let decoded;
  try{decoded=await auth.verifyIdToken(token)}catch(_){throw error('TEACHER_TOKEN_INVALID',401)}
  if(!decoded?.uid)throw error('TEACHER_TOKEN_INVALID',401);
  const snap=await db.collection(COL.teacherRoles).doc(decoded.uid).get();
  const role=snap.exists?(snap.data()||{}):null;
  if(!role||role.active!==true||role.role!=='teacher')throw error('TEACHER_ROLE_REQUIRED',403);
  return {uid:decoded.uid,email:clean(decoded.email)};
}
async function countSessions(){
  const entries=await Promise.all(SESSION_IDS.map(async sessionId=>{
    const q=db.collection(COL.progress).where('attendanceSessionId','==',sessionId);
    const snap=await q.count().get();
    return [sessionId,Number(snap.data().count||0)];
  }));
  return Object.fromEntries(entries);
}
export const englishWeekSessionCounts=onRequest({region:REGION,timeoutSeconds:30,memory:'128MiB',maxInstances:5,cors:false},async(req,res)=>{
  try{
    applyCors(req,res);
    if(req.method==='OPTIONS')return res.status(204).send('');
    if(!['GET','POST'].includes(req.method))throw error('METHOD_NOT_ALLOWED',405);
    const appId=clean(req.get('X-EW-App-Id')||req.query?.appId||req.body?.appId);
    if(appId&&appId!==APP_ID)throw error('APP_ID_MISMATCH',403);
    const teacher=await requireTeacher(req);
    const counts=await countSessions();
    const total=SESSION_IDS.reduce((sum,id)=>sum+Number(counts[id]||0),0);
    return res.status(200).json({ok:true,mode:'firebase',counts,total,sessions:SESSION_IDS,teacher:{uid:teacher.uid,email:teacher.email},generatedAt:nowIso(),version:VERSION});
  }catch(err){
    console.error('English Week session counts error',err);
    return res.status(Number(err.status||500)).json({ok:false,mode:'firebase',error:clean(err.code||err.message||'INTERNAL_ERROR'),serverTime:nowIso(),version:VERSION});
  }
});
