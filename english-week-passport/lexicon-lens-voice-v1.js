(()=>{'use strict';
const VERSION='2026-08-12-LENS-VOICE-V2-POST-ANSWER-SPEECH-GATE';
let token=0,speaking=false,lastMission='',lastQuestion='',answerSpeaking=false,minAudibleUntil=0;
const synth=window.speechSynthesis;
const nativeSetTimeout=window.setTimeout.bind(window);
function englishVoice(){const voices=synth?.getVoices?.()||[];return voices.find(v=>/^en-(US|GB)/i.test(v.lang))||voices.find(v=>/^en/i.test(v.lang))||null;}
function estimateMs(text,rate=.9){const value=String(text||'').trim();const words=value?value.split(/\s+/).length:0;return Math.min(14000,Math.max(1200,650+(words*410/Math.max(.55,rate))+(value.length*20/Math.max(.55,rate))));}
function stop(){token++;speaking=false;answerSpeaking=false;minAudibleUntil=0;try{synth?.cancel()}catch(_){}}
function speak(text,{rate=.9,onEnd,kind='teacher'}={}){
  if(!text||!synth){onEnd?.();return;}
  const my=++token;
  try{synth.cancel()}catch(_){}
  const u=new SpeechSynthesisUtterance(text);u.lang='en-US';u.rate=rate;u.pitch=1;const v=englishVoice();if(v)u.voice=v;
  speaking=true;answerSpeaking=kind==='answer';minAudibleUntil=Date.now()+estimateMs(text,rate);
  let ended=false;
  const finish=()=>{if(ended||my!==token)return;ended=true;const wait=()=>{if(Date.now()<minAudibleUntil){nativeSetTimeout(wait,80);return;}speaking=false;if(kind==='answer')answerSpeaking=false;onEnd?.();};wait();};
  u.onend=finish;u.onerror=finish;
  try{synth.speak(u)}catch(_){speaking=false;if(kind==='answer')answerSpeaking=false;minAudibleUntil=0;onEnd?.();}
  nativeSetTimeout(()=>{if(my===token&&speaking){minAudibleUntil=0;finish();}},18000);
}
function speechBusy(){return Boolean(speaking||answerSpeaking||(synth&&(synth.speaking||synth.pending))||Date.now()<minAudibleUntil);}
function missionText(){const count=document.getElementById('missionCount')?.textContent?.trim()||'';const clue=document.getElementById('clueText')?.textContent?.trim()||'';const hint=document.getElementById('hintText')?.textContent?.trim()||'';if(!/^MISSION/i.test(count)||!clue||/complete/i.test(clue))return null;return {key:count+'|'+clue,text:`${count.replace('/','of')}. ${clue} Hint: ${hint}`};}
function speakMission(){const m=missionText();if(!m||m.key===lastMission)return;lastMission=m.key;const scan=document.getElementById('reticle');if(scan)scan.style.opacity='.72';speak(m.text,{rate:.88,onEnd:()=>{if(scan)scan.style.opacity='1';}});}
function speakQuestion(layer){const q=layer.querySelector('.card p strong')?.textContent?.trim();if(!q||q===lastQuestion)return;lastQuestion=q;const buttons=[...layer.querySelectorAll('.option')];buttons.forEach(b=>b.disabled=true);speak(q,{rate:.88,onEnd:()=>buttons.forEach(b=>b.disabled=false)});}
function feedbackFor(button){
  if(button.classList.contains('correct'))return 'Excellent. That is correct. Get ready for the next mission.';
  if(button.classList.contains('wrong'))return 'Not quite. Listen to the question and try again.';
  const layer=document.getElementById('questionLayer');
  const good=layer?.querySelector('.option.correct');
  if(good&&good===button)return 'Excellent. That is correct. Get ready for the next mission.';
  return '';
}
function installAnswerVoice(){
  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('#questionLayer .option');if(!button||button.disabled)return;
    nativeSetTimeout(()=>{
      const text=feedbackFor(button);if(!text)return;
      const siblings=[...document.querySelectorAll('#questionLayer .option')];siblings.forEach(b=>b.disabled=true);
      speak(text,{rate:.88,kind:'answer',onEnd:()=>{siblings.forEach(b=>{if(document.contains(b))b.disabled=false;});}});
    },0);
  },true);
}
function installTransitionGuard(){
  if(window.__LEXICON_LENS_SPEECH_TRANSITION_GUARD__)return;window.__LEXICON_LENS_SPEECH_TRANSITION_GUARD__=VERSION;
  window.setTimeout=function(fn,delay,...args){
    const ms=Number(delay)||0;
    if(typeof fn!=='function'||ms<180||ms>6000)return nativeSetTimeout(fn,ms,...args);
    const layer=document.getElementById('questionLayer');
    if(!layer||layer.classList.contains('hidden'))return nativeSetTimeout(fn,ms,...args);
    const started=Date.now();
    return nativeSetTimeout(function guarded(){
      if(speechBusy()&&Date.now()-started<19000)return nativeSetTimeout(guarded,80);
      return nativeSetTimeout(()=>fn(...args),260);
    },ms);
  };
}
const obs=new MutationObserver(()=>{const q=document.getElementById('questionLayer');if(q&&!q.classList.contains('hidden')){speakQuestion(q);return;}nativeSetTimeout(speakMission,80);});
function boot(){if(!synth)return;installTransitionGuard();installAnswerVoice();obs.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class']});document.getElementById('startBtn')?.addEventListener('click',()=>nativeSetTimeout(speakMission,700));window.addEventListener('pagehide',stop);document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});nativeSetTimeout(speakMission,500);console.info('[LEXICON X] Lens Voice V2 post-answer speech gate ready');}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
window.LEXICON_LENS_VOICE=Object.freeze({version:VERSION,replayMission:()=>{lastMission='';speakMission();},stop,speechBusy});
})();