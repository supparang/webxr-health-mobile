/* Run: node test_uxq_receiver_reflection_full_fields_staging.js
 * Isolated Apps Script receiver unit test, synthetic student only.
 * Does not access real Google Sheets, Apps Script or network.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'sgnal-hunt/apps-script/UXQuestStudentReceiver-v4-Artifacts.gs'),'utf8');
const saved=[],headers=[],cache={};
function getRange(r,c,n,m){
 return {
   getDisplayValues(){
     return r===1?[headers]:saved.slice(r-2,r-2+n).map(row=>row.slice(c-1,c-1+m));
   },
   setValues(values){
     if(r===1)headers.splice(0,headers.length,...values[0]);
     else saved[r-2]=values[0];
   },
   createTextFinder(value){
     return {matchEntireCell(){return this},findNext(){
       return saved.find(x=>String(x[c-1])===String(value))||null;
     }};
   }
 };
}
const sheet={
 getLastRow:()=>saved.length+(headers.length?1:0),getLastColumn:()=>headers.length,
 getRange,setFrozenRows(){}
};
const globals={
 Utilities:{formatDate:()=>'2026-10-26T12:00:00+07:00'},
 ContentService:{MimeType:{JSON:'JSON'},createTextOutput(text){
   return {text,setMimeType(){return this}};
 }},
 SpreadsheetApp:{getActiveSpreadsheet(){return {
   getSheetByName(){return sheet},insertSheet(){return sheet}
 }}},
 LockService:{getScriptLock(){return {waitLock(){},releaseLock(){}}}},
 CacheService:{getScriptCache(){return {
   get:k=>cache[k],put:(k,v)=>{cache[k]=v}
 }}},
 console:{error(e){throw e}},
 Date,Number,String,Boolean,Math,JSON,Object,Array
};
const context=vm.createContext(globals);
vm.runInContext(code,context);
const fields=Array.from({length:8},(_,i)=>({
 key:'evidence'+i,label:'Studio '+i,required:true,value:'Detailed evidence' // overwritten below
}));
fields.forEach((item,i)=>{item.value='Detailed evidence '+i+' for student task flow';});
fields.push({key:'reflection',label:'Weekly Reflection W7',required:true,
 value:'I changed the wireframe based on a user test and plan another validation.'});
const payload={
 app:'ux-quest',eventType:'artifact_submitted',eventId:'synthetic-e1',
 attemptId:'synthetic-a1',courseId:'UXQ-ACT1-2026',studentId:'QA_ONLY',
 studentName:'Synthetic Test',section:'201',missionId:'w7',
 schema:'uxq.studio-artifact.v1',artifactSubmitted:true,
 problemSeen:'Observed issue',uxReason:'Task evidence',
 fixAndTest:'Fixed path',artifactFields:fields
};
const row=context.UXQ_normalizeArtifact_(payload);
assert.equal(JSON.parse(row.artifactFields).length,9);
assert.equal(JSON.parse(row.artifactFields)[8].key,'reflection');
assert.equal(JSON.parse(row.rawJson).artifactFields[8].key,'reflection');
assert.equal(JSON.parse(row.rawJson).reflectionSource,'explicit_artifact_field');
assert.equal(row.reflection,fields[8].value);
const event={postData:{contents:JSON.stringify(payload)}};
const first=JSON.parse(context.UXQ_receivePost_(event).text);
assert.equal(first.ok,true);
assert.equal(first.duplicate,false);
assert.equal(saved.length,1);
assert.equal(JSON.parse(context.UXQ_receivePost_(event).text).duplicate,true);
assert.equal(saved.length,1,'resubmitted event ID cannot duplicate saved row');
const without=context.UXQ_normalizeArtifact_({
 ...payload,eventId:'synthetic-e2',artifactFields:fields.slice(0,8),reflection:''
});
assert.equal(without.reflection,'','must not invent Reflection from problem/reason/fix');
assert.equal(JSON.parse(without.rawJson).reflectionSource,'absent');
const uncertain=context.UXQ_normalizeArtifact_({
 ...payload,eventId:'synthetic-e3',artifactFields:fields.slice(0,8),
 reflection:'Legacy top-level text'
});
assert.equal(JSON.parse(uncertain.rawJson).reflectionSource,'top_level_unverified');
assert.equal(JSON.parse(uncertain.artifactFields).length,8);
const large=context.UXQ_normalizeArtifact_({...payload,eventId:'synthetic-large',
 artifactFields:Array.from({length:9},(_,i)=>({
   key:i===8?'reflection':'field'+i,value:'x'.repeat(3900)
 }))});
assert.equal(JSON.parse(large.rawJson).artifactFields.length,9);
assert.equal(JSON.parse(large.artifactFields).length,9);
assert.throws(()=>context.UXQ_normalizeArtifact_({...payload,
 artifactFields:Array.from({length:20},(_,i)=>({
  key:i===19?'reflection':'field'+i,value:'X'.repeat(4000)
 }))}),/artifact_json_too_large/);
assert.equal(saved.length,1,'oversize detection never writes to fake Sheet');
assert.ok(headers.includes('rawJson')&&headers.includes('artifactFields'));
console.log('PASS: nine saved fields, Reflection source, dedup, legacy unverified, size guard, no production Sheet');
