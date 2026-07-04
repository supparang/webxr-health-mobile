/* EAP Hero Portfolio Record Adapter v4
   Runs before the core UI. It harmonizes current/legacy record aliases:
   session -> number, sessionId -> S<number>, output, skill, at.
   It removes only records with no recoverable session or an explicit
   zero-score browser-migration marker. */
(function(){
  'use strict';
  var KEYS=['EAP_HERO_PROGRESS_V3','EAP_HERO_SAVE_SOCIETY_V2_COMPACT','EAP_HERO_SAVE_SOCIETY_V1'];
  var RELOAD='EAP_HERO_PORTFOLIO_RECORD_ADAPTER_RELOAD_V4';
  var nativeSet=Storage.prototype.setItem, writing=false;
  function parse(v){try{return JSON.parse(v)}catch(_){return null}}
  function str(v){try{return JSON.stringify(v)}catch(_){return ''}}
  function t(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
  function obj(v){return v&&typeof v==='object'}
  function plain(v){return obj(v)&&!Array.isArray(v)}
  function validDate(v){var d=v instanceof Date?v:new Date(v);return !Number.isNaN(d.getTime())}
  function asIso(v){if(v==null||v==='')return new Date().toISOString();if(typeof v==='number'){var n=v<100000000000?v*1000:v;var dn=new Date(n);return validDate(dn)?dn.toISOString():new Date().toISOString()}var d=new Date(String(v));return validDate(d)?d.toISOString():new Date().toISOString()}
  function output(e){
    if(!plain(e))return '';
    var xs=[e.output,e.answer,e.studentAnswer,e.response,e.transcript,e.speakingNote,e.note,e.reflection,e.text,e.value,e.writtenResponse,e.userResponse];
    for(var i=0;i<xs.length;i++){var r=t(xs[i]);if(r)return r}
    var ns=[e.evidence,e.result,e.task,e.data,e.payload];
    for(var j=0;j<ns.length;j++){if(plain(ns[j])){var inr=output(ns[j]);if(inr)return inr}}
    return '';
  }
  function session(e){
    if(!plain(e))return null;
    var xs=[e.session,e.sessionId,e.sessionCode,e.sessionKey,e.sessionNo,e.sessionNumber,e.sid,e.missionId,e.mission,e.missionTitle,e.sessionTitle,e.taskId,e.abilityTaskId,e.rawEvidenceId,e.evidenceId,e.id,e.title,e.prompt];
    for(var i=0;i<xs.length;i++){
      var v=t(xs[i]);if(!v)continue;
      var b=v.match(/(?:^|\b)(?:BG|B)([1-5])(?:\b|_)/i);if(b)return {boss:true,value:'B'+Number(b[1])};
      var s=v.match(/(?:^|\b)S(?:ession)?\s*0?([1-9]|1[0-5])(?:\b|_)/i);if(s)return {boss:false,value:Number(s[1])};
      if(/^0?([1-9]|1[0-5])$/.test(v))return {boss:false,value:Number(v)};
    }
    var body=output(e).toLowerCase();
    if(/my academic goal is/.test(body)&&/(i will practi[cs]e by|practice action|each week)/.test(body))return {boss:false,value:1};
    if(e.boss&&e.boss.gate)return {boss:true,value:'B'+Number(e.boss.gate)};
    return null;
  }
  function skill(e){var raw=t(e.skill||e.skillName||e.type||''),m=raw.match(/\b(reading|writing|listening|speaking)\b/i);if(m)return m[1][0].toUpperCase()+m[1].slice(1).toLowerCase();var s=t(e.evidenceType||e.taskId||e.rawEvidenceId||'').match(/(reading|writing|listening|speaking)/i);return s?s[1][0].toUpperCase()+s[1].slice(1).toLowerCase():raw}
  function recordLike(e){return plain(e)&&!!(e.score!=null||e.output!=null||e.answer!=null||e.studentAnswer!=null||e.evidenceType||e.taskId||e.rawEvidenceId||e.sessionId||e.session||e.skill)}
  function normalize(e){
    if(!recordLike(e))return {drop:false,changed:false};
    var out=output(e), s=session(e);
    if(Number(e.score)===0&&/completed legacy evidence retained after browser-storage migration|legacy evidence retained|browser-storage migration/.test(out.toLowerCase()))return {drop:true,changed:false};
    if(!s)return {drop:true,changed:false};
    var changed=false;
    if(s.boss){if(e.session!==s.value){e.session=s.value;changed=true}if(e.sessionId!==s.value){e.sessionId=s.value;changed=true}}
    else {if(Number(e.session)!==s.value){e.session=s.value;changed=true}if(e.sessionId!=='S'+s.value){e.sessionId='S'+s.value;changed=true}}
    var k=skill(e);
    if(!s.boss&&s.value===1&&k.toLowerCase()==='reading'&&/my academic goal is/.test(out.toLowerCase())&&/(i will practi[cs]e by|practice action|each week)/.test(out.toLowerCase()))k='Speaking';
    if(k&&e.skill!==k){e.skill=k;changed=true}
    if(out&&e.output!==out){e.output=out;changed=true}
    if(!e.output&&(e.score!=null||e.evidenceType)){e.output='Saved activity evidence.';changed=true}
    var stamp=asIso(e.at||e.occurredAt||e.createdAt||e.submittedAt||e.timestamp||e.time||e.date);if(e.at!==stamp){e.at=stamp;changed=true}if(!e.occurredAt){e.occurredAt=stamp;changed=true}
    return {drop:false,changed:changed};
  }
  function walk(v,seen){
    if(!obj(v))return false;seen=seen||[];if(seen.indexOf(v)>=0)return false;seen.push(v);var changed=false;
    if(Array.isArray(v)){var next=[];v.forEach(function(x){if(plain(x)){var q=normalize(x);if(q.drop){changed=true;return}if(q.changed)changed=true}if(walk(x,seen))changed=true;next.push(x)});if(next.length!==v.length)v.splice.apply(v,[0,v.length].concat(next));return changed}
    Object.keys(v).forEach(function(k){if(obj(v[k])&&walk(v[k],seen))changed=true});return changed;
  }
  function normalizeState(raw){var state=typeof raw==='string'?parse(raw):raw;if(!obj(state))return {state:state,changed:false};return {state:state,changed:walk(state,[])}}
  function repair(){var changed=false;KEYS.forEach(function(key){var raw=localStorage.getItem(key);if(!raw)return;var r=normalizeState(raw);if(r.changed){writing=true;try{nativeSet.call(localStorage,key,str(r.state))}finally{writing=false}changed=true}});return changed}
  function intercept(){if(Storage.prototype.setItem.__eapPortfolioRecordAdapterV4)return;var original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,val){if(!writing&&KEYS.indexOf(key)>=0&&typeof val==='string'){var r=normalizeState(val);if(r.changed)val=str(r.state)}return original.call(this,key,val)};Storage.prototype.setItem.__eapPortfolioRecordAdapterV4=true}
  function hideRows(){Array.prototype.slice.call(document.querySelectorAll('#app tr')).forEach(function(row){var b=t(row.textContent).toLowerCase();if(/sundefined|snull|snan/.test(b))row.remove()})}
  function boot(){intercept();var changed=repair();hideRows();if(changed&&!sessionStorage.getItem(RELOAD)){sessionStorage.setItem(RELOAD,'1');setTimeout(function(){location.reload()},80)}}
  var timer;function schedule(){clearTimeout(timer);timer=setTimeout(boot,25)}
  window.EAPPortfolioRecordAdapterV4={run:boot,normalize:normalizeState};schedule();window.addEventListener('load',schedule);new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
})();
