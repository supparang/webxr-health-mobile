(()=>{
'use strict';
const RELEASE='20260809-LCA47-VOICE-RECOGNITION-CONTRACT-V3-CONTINUOUS-AGGREGATE-STOPALL';
const Native=window.SpeechRecognition||window.webkitSpeechRecognition;
if(!Native||window.__LCA_VOICE_RECOGNITION_CONTRACT__){return;}
const active=new Set();
function norm(t){return String(t||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim()}
function similarity(target,heard){const a=norm(target).split(' ').filter(Boolean),b=norm(heard).split(' ').filter(Boolean);let hit=0;const used=new Set();for(const w of a){const i=b.findIndex((x,j)=>x===w&&!used.has(j));if(i>=0){used.add(i);hit++}}return Math.round(hit/Math.max(1,a.length)*100)}
function passState(transcript){const mission=window.LEXICON_CHAMPION_V47?.mission;if(!mission?.bossAnswer)return {pass:false,score:0,key:false};const score=similarity(mission.bossAnswer,transcript);const words=new Set(norm(transcript).split(' ').filter(Boolean));const key=Array.isArray(mission.keywords)&&mission.keywords.length>0&&mission.keywords.every(k=>words.has(norm(k)));return {pass:score>=52||key,score,key}}
function makeSyntheticEvent(nativeEvent,transcript){const alt={transcript:String(transcript||'').trim(),confidence:1};const result={0:alt,length:1,isFinal:false};return {resultIndex:0,results:[result],nativeEvent}}
function aggregateTranscript(event){const parts=[];try{for(let i=0;i<event.results.length;i++){const t=String(event.results[i]?.[0]?.transcript||'').trim();if(t)parts.push(t)}}catch(_){}return parts.join(' ').replace(/\s+/g,' ').trim()}
function stopNative(native,mode='abort'){try{mode==='stop'?native.stop():native.abort()}catch(_){}active.delete(native)}
function stopAll(){for(const native of [...active])stopNative(native,'abort');return true}
function WrappedRecognition(){const native=new Native();try{native.continuous=true}catch(_){}let userOnResult=null,stopTimer=0,stopping=false;const schedulePassStop=(transcript)=>{const p=passState(transcript);if(!p.pass||stopping)return;clearTimeout(stopTimer);stopTimer=setTimeout(()=>{if(stopping)return;stopping=true;stopNative(native,'stop')},250)};const proxy=new Proxy(native,{set(target,prop,value){if(prop==='onresult'){userOnResult=typeof value==='function'?value:null;target.onresult=userOnResult?function(event){const transcript=aggregateTranscript(event);if(!transcript){userOnResult.call(proxy,event);return}userOnResult.call(proxy,makeSyntheticEvent(event,transcript));schedulePassStop(transcript)}:null;return true}if(prop==='onend'){target.onend=typeof value==='function'?function(event){clearTimeout(stopTimer);stopping=false;active.delete(native);return value.call(proxy,event)}:value;return true}try{target[prop]=value;return true}catch(_){return false}},get(target,prop){if(prop==='onresult')return userOnResult;if(prop==='start')return function(){stopping=false;clearTimeout(stopTimer);try{target.continuous=true}catch(_){}active.add(native);return target.start()};if(prop==='stop')return function(){stopping=true;clearTimeout(stopTimer);stopNative(native,'stop')};if(prop==='abort')return function(){stopping=true;clearTimeout(stopTimer);stopNative(native,'abort')};const value=target[prop];return typeof value==='function'?value.bind(target):value}});return proxy}
WrappedRecognition.prototype=Native.prototype;
try{window.SpeechRecognition=WrappedRecognition}catch(_){}
try{window.webkitSpeechRecognition=WrappedRecognition}catch(_){}
window.__LCA_VOICE_RECOGNITION_CONTRACT__=Object.freeze({release:RELEASE,native:Native.name||'SpeechRecognition',continuous:true,aggregate:true,autoStopOnPass:true,threshold:52,stopAll});
console.info('[LEXICON Champion] Voice Recognition Contract V3 ready');
})();