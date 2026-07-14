/* EAP 15 Production QA v20260714 */
(function(){
  'use strict';
  var VERSION='v20260714-EAP15-PRODUCTION-QA-V2';
  var ORDER=['S1','S2','S3','B1','S4','S5','S6','B2','S7','S8','S9','B3','S10','S11','S12','B4','S13','S14','S15','B5'];
  function check(id,pass,detail,severity){return{id:id,pass:!!pass,detail:String(detail==null?'':detail),severity:severity||'error'};}
  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function run(){
    var checks=[],pack=window.EAP_HERO_SESSION_CONTENT_PACK,bank=window.EAP_GOLD_AUTHORED_BANK,authority=window.EAPRoadmapLockGuard;
    checks.push(check('PACK_PRESENT',!!pack,pack&&pack.version||'missing'));
    checks.push(check('ROUTE_ORDER',!!pack&&JSON.stringify(pack.routeOrder)===JSON.stringify(ORDER),pack&&pack.routeOrder&&pack.routeOrder.join(' → ')));
    var normal=pack&&pack.routes?pack.routes.filter(function(r){return r.routeType==='normal_session';}):[];
    var bosses=pack&&pack.routes?pack.routes.filter(function(r){return r.routeType==='boss_gate';}):[];
    checks.push(check('NORMAL_SESSION_COUNT',normal.length===15,normal.length));
    checks.push(check('BOSS_COUNT',bosses.length===5,bosses.length));
    normal.forEach(function(route){
      var vocab=route.microLesson&&route.microLesson.vocabulary||[];
      checks.push(check(route.routeId+'_FOUR_SKILLS',route.missions&&route.missions.length===4,route.missions&&route.missions.length));
      checks.push(check(route.routeId+'_VOCAB_SPECIFIC',vocab.length>=6&&vocab.every(function(v){return v.meaningTH&&!/คำศัพท์สำคัญสำหรับภารกิจนี้/.test(v.meaningTH)&&v.example&&!/is useful in academic English/i.test(v.example);}),vocab.map(function(v){return v.term;}).join(', ')));
      checks.push(check(route.routeId+'_PROMPT_VARIANTS',route.missions.every(function(m){return Array.isArray(m.promptVariants)&&new Set(m.promptVariants).size>=4;}),'four unique variants per skill'));
      checks.push(check(route.routeId+'_ANTI_GUESS',route.missions.every(function(m){return m.antiMemorization&&m.antiMemorization.rotateDistractors&&m.antiMemorization.forbidCorrectLengthCue;}),'source-specific + answer-position rotation'));
      var mastery=Object.keys(route.skillContract||{}).filter(function(k){return ['Core','Support'].indexOf(route.skillContract[k])>=0;});
      checks.push(check(route.routeId+'_MASTERY_CONTRACT',mastery.length===2,JSON.stringify(route.skillContract)));
    });
    bosses.forEach(function(route){
      var speaking=(route.missions||[]).find(function(m){return m.skill==='speaking';})||{};
      checks.push(check(route.routeId+'_SPEAKING_REVIEW',speaking.teacherReviewRequired===true,'teacher review required'));
    });
    var sessions=bank&&bank.sessions?Object.keys(bank.sessions):[];
    checks.push(check('GOLD_BANK_15_SESSIONS',sessions.length===15,sessions.length));
    sessions.forEach(function(sid){
      var sources=bank.sessions[sid].sources||[];
      checks.push(check('S'+sid+'_SOURCE_COUNT',sources.length>=8,sources.length));
      sources.forEach(function(src){
        var set=src.choiceSet||[];
        checks.push(check(src.id+'_FOUR_CHOICES',set.length===4,set.length));
        checks.push(check(src.id+'_ONE_CORRECT',set.filter(function(x){return x.correct;}).length===1,'one correct'));
        checks.push(check(src.id+'_UNIQUE',new Set(set.map(function(x){return clean(x.text).toLowerCase();})).size===4,'unique choices'));
        checks.push(check(src.id+'_LENGTH_BALANCE',Number(src.choiceLengthSpread||0)<=12,src.choiceLengthSpread||0,'warning'));
      });
    });
    checks.push(check('AUTHORITY_PRESENT',!!authority,authority&&authority.version||'missing'));
    if(authority){
      var d=authority.diagnostics();
      checks.push(check('AUTHORITY_MODE',d.authorityMode==='live-sheet-only',d.authorityMode));
      checks.push(check('NO_LOCAL_EVIDENCE_AUTHORITY',d.acceptsLocalEvidence===false,d.acceptsLocalEvidence));
      checks.push(check('NO_COMPLETED_CACHE_AUTHORITY',d.acceptsCompletedSessionsCache===false,d.acceptsCompletedSessionsCache));
      if(typeof authority.testEvaluate==='function'){
        var localLike=[
          {routeId:'S1',skill:'reading',score:100,passed:true},
          {routeId:'S1',skill:'speaking',score:100,passed:true}
        ];
        var evaluated=authority.testEvaluate(localLike);
        checks.push(check('PURE_SERVER_RECORD_EVALUATOR',evaluated.current==='S2',evaluated.current));
        var pending=[
          {routeId:'S1',skill:'reading',score:100,passed:true},{routeId:'S1',skill:'speaking',score:100,passed:true},
          {routeId:'S2',skill:'reading',score:100,passed:true},{routeId:'S2',skill:'writing',score:100,passed:true},
          {routeId:'S3',skill:'reading',score:100,passed:true},{routeId:'S3',skill:'writing',score:100,passed:true},
          {routeId:'B1',skill:'reading',score:100,passed:true},{routeId:'B1',skill:'listening',score:100,passed:true},
          {routeId:'B1',skill:'writing',score:100,passed:true},{routeId:'B1',skill:'speaking',score:100,passed:true,teacherReviewStatus:'pending_teacher_review'}
        ];
        var ep=authority.testEvaluate(pending);
        checks.push(check('BOSS_PENDING_REVIEW_BLOCKS',ep.current==='B1',ep.current));
        pending[pending.length-1].teacherReviewStatus='reviewed';
        var er=authority.testEvaluate(pending);
        checks.push(check('BOSS_REVIEWED_ADVANCES',er.current==='S4',er.current));
      }
      checks.push(check('LIVE_SHEET_CONNECTED',d.liveVerified===true,d.liveVerified?'records='+d.liveRecordCount:'waiting for fresh player_resume','warning'));
    }
    var failed=checks.filter(function(c){return !c.pass;}),errors=failed.filter(function(c){return c.severity==='error';}),warnings=failed.filter(function(c){return c.severity==='warning';});
    var report={version:VERSION,ranAt:new Date().toISOString(),pass:errors.length===0,total:checks.length,passed:checks.length-failed.length,errors:errors,warnings:warnings,checks:checks};
    window.__EAP15_RELEASE_QA_LAST__=report;
    window.dispatchEvent(new CustomEvent('eap:release-qa-complete',{detail:report}));
    return Promise.resolve(report);
  }
  function show(){return run().then(function(report){var el=document.getElementById('eap15-release-qa-panel');if(!el){el=document.createElement('section');el.id='eap15-release-qa-panel';el.style.cssText='position:fixed;z-index:999999;inset:12px;overflow:auto;padding:18px;border-radius:18px;background:#07111f;color:#e5eef8;font:14px/1.45 system-ui;box-shadow:0 18px 60px #000a';document.body.appendChild(el);}var rows=report.checks.map(function(c){return '<tr><td>'+(c.pass?'✅':'❌')+'</td><td>'+clean(c.id)+'</td><td>'+clean(c.detail).replace(/[&<>]/g,function(x){return{'&':'&amp;','<':'&lt;','>':'&gt;'}[x];})+'</td></tr>';}).join('');el.innerHTML='<button id="eap15QaClose" style="float:right">ปิด</button><h2>EAP 15 Production QA — '+(report.pass?'PASS':'NOT READY')+'</h2><p>'+report.passed+'/'+report.total+' checks · '+report.errors.length+' errors · '+report.warnings.length+' warnings</p><table style="width:100%;border-collapse:collapse"><tbody>'+rows+'</tbody></table>';el.querySelector('#eap15QaClose').onclick=function(){el.remove();};return report;});}
  window.EAP15ReleaseQA={version:VERSION,run:run,show:show};
  if(new URLSearchParams(location.search).get('eapqa')==='1') window.addEventListener('load',function(){setTimeout(show,1200);});
})();
