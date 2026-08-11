(()=>{'use strict';
const VERSION='2026-08-11-LENS-VOICE-V1';
let token=0,speaking=false,lastMission='',lastQuestion='';
const synth=window.speechSynthesis;
function englishVoice(){const voices=synth?.getVoices?.()||[];return voices.find(v=>/^en-(US|GB)/i.test(v.lang))||voices.find(v=>/^en/i.test(v.lang))||null;}
function stop(){token++;speaking=false;try{synth?.cancel()}catch(_){}}
function speak(text,{rate=.9,onEnd}={}){if(!text||!synth){onEnd?.();return;}const my=++token;stop();const u=new SpeechSynthesisUtterance(text);u.lang='en-US';u.rate=rate;u.pitch=1;const v=englishVoice();if(v)u.voice=v;speaking=true;u.onend=()=>{if(my+1!==token)return;speaking=false;onEnd?.();};u.onerror=()=>{speaking=false;onEnd?.();};try{synth.speak(u)}catch(_){speaking=false;onEnd?.();}}
function missionText(){const count=document.getElementById('missionCount')?.textContent?.trim()||'';const clue=document.getElementById('clueText')?.textContent?.trim()||'';const hint=document.getElementById('hintText')?.textContent?.trim()||'';if(!/^MISSION/i.test(count)||!clue||/complete/i.test(clue))return null;return {key:count+'|'+clue,text:`${count.replace('/','of')}. ${clue} Hint: ${hint}`};}
function speakMission(){const m=missionText();if(!m||m.key===lastMission)return;lastMission=m.key;const scan=document.getElementById('reticle');if(scan)scan.style.opacity='.72';speak(m.text,{rate:.88,onEnd:()=>{if(scan)scan.style.opacity='1';}});}
function speakQuestion(layer){const q=layer.querySelector('.card p strong')?.textContent?.trim();if(!q||q===lastQuestion)return;lastQuestion=q;const buttons=[...layer.querySelectorAll('.option')];buttons.forEach(b=>b.disabled=true);speak(q,{rate:.88,onEnd:()=>buttons.forEach(b=>b.disabled=false)});}
const obs=new MutationObserver(()=>{const q=document.getElementById('questionLayer');if(q&&!q.classList.contains('hidden')){speakQuestion(q);return;}setTimeout(speakMission,80);});
function boot(){if(!synth)return;obs.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class']});document.getElementById('startBtn')?.addEventListener('click',()=>setTimeout(speakMission,700));window.addEventListener('pagehide',stop);document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});setTimeout(speakMission,500);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
window.LEXICON_LENS_VOICE=Object.freeze({version:VERSION,replayMission:()=>{lastMission='';speakMission();},stop});
})();