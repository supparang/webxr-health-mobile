/* UX Quest Item Analytics Logger v4
 * Add after uxq-classroom-config and before mission scripts.
 * Sends item-level evidence to the existing write-only receiver.
 */
(function(w){'use strict';
var VERSION='20260718-UXQ-ITEM-ANALYTICS-V4';
var queueKey='uxq_item_analytics_queue_v4';
function s(v){return v==null?'':String(v).trim()}
function n(v){var x=Number(v);return isFinite(x)?x:null}
function id(prefix){return prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10)}
function profile(){try{return JSON.parse(localStorage.getItem('uxq_identity_v1')||localStorage.getItem('uxq_profile')||'{}')}catch(e){return{}}}
function endpoint(){var c=w.UXQ_CLASSROOM_CONFIG||w.UXQ_CONFIG||{};return c.receiverUrl||c.endpoint||c.analyticsEndpoint||''}
function enqueue(x){var q=[];try{q=JSON.parse(localStorage.getItem(queueKey)||'[]')}catch(e){}q.push(x);localStorage.setItem(queueKey,JSON.stringify(q.slice(-500)))}
function post(payload){var url=endpoint();if(!url){enqueue(payload);return Promise.resolve({queued:true,reason:'NO_ENDPOINT'})}return fetch(url,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)}).then(function(){return{ok:true}}).catch(function(){enqueue(payload);return{queued:true,reason:'NETWORK'}})}
function base(type,extra){var p=profile();return Object.assign({
 action:type,event_type:type,logged_at:new Date().toISOString(),event_id:id('evt'),
 participant_id:s(p.participantId||p.studentId),student_id:s(p.studentId||p.id),student_name:s(p.studentName||p.name),section:s(p.section),
 game:'UX Quest',course:'CSAI2601',source_url:location.href,game_version:s(w.UXQ_VERSION||VERSION),logger_version:VERSION
},extra||{})}
function logItem(x){x=x||{};var started=n(x.startedAt||x.questionStartedAt);var elapsed=n(x.responseTimeMs);if(elapsed==null&&started!=null)elapsed=Math.max(0,Date.now()-started);var payload=base('uxq_item_response',{
 sheet_target:'UXQuest_Item_Responses',attempt_id:s(x.attemptId),mission_id:s(x.missionId||x.mission),boss_id:s(x.bossId),question_id:s(x.questionId),question_version:s(x.questionVersion||'1'),concept:s(x.concept),difficulty_tag:s(x.difficultyTag),option_order:Array.isArray(x.optionOrder)?x.optionOrder.join('|'):s(x.optionOrder),selected_option:s(x.selectedOption),correct_option:s(x.correctOption),is_correct:!!x.isCorrect,response_time_ms:elapsed,reason_id:s(x.reasonId),selected_reason:s(x.selectedReason),correct_reason:s(x.correctReason),reason_correct:!!x.reasonCorrect,hint_used:Number(x.hintUsed||0),retry_number:Number(x.retryNumber||0),rapid_flag:x.rapidFlag!=null?!!x.rapidFlag:(elapsed!=null&&elapsed<2500)
 });return post(payload)}
function reflectionQuality(x){var q=0;if(s(x.problemSeen).length>=15)q++;if(s(x.uxReason).length>=20)q++;if(s(x.fixAndTest).length>=20)q++;var all=[x.problemSeen,x.uxReason,x.fixAndTest,x.reflectionText].join(' ');if((all.match(/เพราะ|หลักฐาน|evidence|ทดสอบ|เปลี่ยน|reason/gi)||[]).length>=2)q++;return Math.min(4,q)}
function logReflection(x){x=x||{};return post(base('uxq_reflection',{
 sheet_target:'UXQuest_Reflections',attempt_id:s(x.attemptId),mission_id:s(x.missionId||x.mission),problem_seen:s(x.problemSeen),ux_reason:s(x.uxReason),fix_and_test:s(x.fixAndTest),reflection_text:s(x.reflectionText),quality_auto:reflectionQuality(x),version:VERSION
 }))}
function flush(){var q=[];try{q=JSON.parse(localStorage.getItem(queueKey)||'[]')}catch(e){}if(!q.length)return Promise.resolve({sent:0});localStorage.removeItem(queueKey);return q.reduce(function(p,x){return p.then(function(r){return post(x).then(function(){r.sent++;return r})})},Promise.resolve({sent:0}))}
w.UXQItemAnalytics={version:VERSION,logItem:logItem,logReflection:logReflection,flush:flush,reflectionQuality:reflectionQuality};
w.addEventListener('online',flush);setTimeout(flush,1200);
})(window);
