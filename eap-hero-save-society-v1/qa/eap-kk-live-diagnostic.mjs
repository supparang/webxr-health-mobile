import fs from 'node:fs';
import vm from 'node:vm';

const endpoint='https://script.google.com/macros/s/AKfycbwxHHHw6Pk4rMdDnTM_6jxcL2GYdABc0hHFOlc8r_NS4D-siLYv0P-OZg3cfINE9A8X5A/exec';
const root='eap-hero-save-society-v1';
class MockCustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail;}}
const context={window:{dispatchEvent(){}},CustomEvent:MockCustomEvent};
context.window.CustomEvent=MockCustomEvent;
context.globalThis=context.window;
vm.createContext(context);
for(const file of [
  'eap-content-data-s01-s03-v20260714.js','eap-content-data-s04-s06-v20260714.js','eap-content-data-s07-s09-v20260714.js','eap-content-data-s10-s12-v20260714.js','eap-content-data-s13-s15-v20260714.js','eap-content-data-bosses-v20260714.js','eap-session-content-pack-v20260708.js'
]) vm.runInContext(fs.readFileSync(`${root}/${file}`,'utf8'),context,{filename:file});
const pack=context.window.EAP_HERO_SESSION_CONTENT_PACK;
if(!pack?.routes) throw new Error('content pack unavailable');
const order=['S1','S2','S3','B1','S4','S5','S6','B2','S7','S8','S9','B3','S10','S11','S12','B4','S13','S14','S15','B5'];
const skills=['reading','listening','writing','speaking'];
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const bool=v=>v===true||String(v).toLowerCase()==='true'||String(v)==='1';
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const norm=v=>{const raw=clean(v?.routeId||v).toUpperCase();let m=raw.match(/^S(?:ESSION)?\s*0?(1[0-5]|[1-9])$/i);if(m)return `S${Number(m[1])}`;m=raw.match(/^B(?:OSS)?\s*0?([1-5])$/i);if(m)return `B${Number(m[1])}`;return raw;};
const route=id=>pack.routes.find(r=>norm(r.routeId)===id);
const required=id=>{const r=route(id);if(!r)return[];if(r.routeType==='boss_gate')return [...skills];const c=r.skillContract||{};return skills.filter(s=>['core','support','integrated'].includes(clean(c[s]).toLowerCase()));};
const reviewPass=(row,rid,sk)=>{if(!/^B[1-5]$/.test(rid)||sk!=='speaking')return true;const st=clean(row.teacherReviewStatus||row.reviewStatus||row.reviewFlag).toLowerCase();if(!st||/pending|revise|revision|rework|needs[_ -]?work|not[_ -]?reviewed/.test(st))return false;return /reviewed|approved|accepted|pass|passed|complete|completed/.test(st);};
const rowPass=row=>{const rid=norm(row.routeId||row.sessionId||row.session),sk=clean(row.skill||row.skillName).toLowerCase(),score=Math.max(num(row.bestScore),num(row.latestScore),num(row.score));return Boolean(rid&&sk&&(bool(row.passed)||score>=60)&&reviewPass(row,rid,sk));};
function evaluate(records){const best={};for(const row of records||[]){const rid=norm(row.routeId||row.sessionId||row.session),sk=clean(row.skill||row.skillName).toLowerCase();if(!order.includes(rid)||!skills.includes(sk))continue;const score=Math.max(num(row.bestScore),num(row.latestScore),num(row.score));const item={score,passed:rowPass(row),reviewStatus:row.teacherReviewStatus||row.reviewStatus||row.reviewFlag||'',rawPassed:row.passed};const key=`${rid}|${sk}`;if(!best[key]||item.score>best[key].score||item.passed)best[key]=item;}
 const statuses={};let current='B5';for(const rid of order){const req=required(rid),missing=req.filter(sk=>!best[`${rid}|${sk}`]?.passed);statuses[rid]={required:req,missing,complete:req.length>0&&missing.length===0,skills:Object.fromEntries(req.map(sk=>[sk,best[`${rid}|${sk}`]||null]))};if(current==='B5'&&!statuses[rid].complete)current=rid;}
 return {current,statuses};}
function parseResponse(text){const raw=String(text||'').trim();try{return JSON.parse(raw);}catch(_){}const m=raw.match(/^[^(]+\((.*)\);?$/s);if(m)return JSON.parse(m[1]);throw new Error(`Cannot parse Apps Script response: ${raw.slice(0,500)}`);}
async function get(action,params={}){const u=new URL(endpoint);u.searchParams.set('action',action);Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,String(v)));u.searchParams.set('_',Date.now());const r=await fetch(u,{redirect:'follow',signal:AbortSignal.timeout(60000)});const t=await r.text();if(!r.ok)throw new Error(`${action} HTTP ${r.status}: ${t.slice(0,300)}`);return parseResponse(t);}
const identities=[{studentId:'50',studentName:'KK',section:'122'},{studentId:'2',studentName:'KAT',section:'122'}];
const output={generatedAt:new Date().toISOString(),endpoint,identities:[]};
for(const p of identities){const resume=await get('player_resume',p);const ev=evaluate(resume.records||[]);output.identities.push({profile:p,resumeMeta:{ok:resume.ok,version:resume.version,authorityMode:resume.authorityMode,studentId:resume.studentId,studentName:resume.studentName,section:resume.section,recordCount:(resume.records||[]).length,generatedAt:resume.generatedAt,scannedSheets:resume.scannedSheets},currentRoute:ev.current,statuses:ev.statuses,records:resume.records||[]});}
const roster=await get('teacher_students',{section:'122',q:'KK'}).catch(error=>({ok:false,error:String(error)}));output.teacherStudents=roster;
fs.writeFileSync('eap-kk-live-diagnostic.json',JSON.stringify(output,null,2));
console.log(JSON.stringify({identities:output.identities.map(x=>({profile:x.profile,resumeMeta:x.resumeMeta,currentRoute:x.currentRoute,firstFive:Object.fromEntries(['S1','S2','S3','B1','S4'].map(k=>[k,x.statuses[k]]))})),teacherStudents:roster},null,2));
