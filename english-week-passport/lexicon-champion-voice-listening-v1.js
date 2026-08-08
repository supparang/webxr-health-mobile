(()=>{
'use strict';
const RELEASE='20260808-LCA47-VOICE-LISTENING-V2-LIFECYCLE';
const $=id=>document.getElementById(id);
let lastMic=null,lastBusy=false,timer=0,checkingTimer=0;
function injectStyle(){if($('lcaVoiceListeningStyle'))return;const s=document.createElement('style');s.id='lcaVoiceListeningStyle';s.textContent=`
.mic.voice-listening{position:relative;background:linear-gradient(90deg,#ff6b7e,#ff3f66)!important;color:#fff!important;box-shadow:0 0 0 0 rgba(255,80,110,.5);animation:lcaMicPulse 1.05s ease-out infinite}
.mic.voice-listening::before{content:'●';margin-right:7px;color:#fff;animation:lcaBlink .72s steps(1,end) infinite}
.mic.voice-checking{background:linear-gradient(90deg,#ffd666,#ffad5c)!important;color:#271627!important;animation:none!important}
.heard.voice-listening{border:1px solid #ff7892;background:#3d1830!important;color:#ffe6ec!important;font-weight:900}
.heard.voice-checking{border:1px solid #ffd666;background:#3a2c15!important;color:#fff0aa!important;font-weight:900}
@keyframes lcaMicPulse{0%{box-shadow:0 0 0 0 rgba(255,80,110,.5)}70%{box-shadow:0 0 0 11px rgba(255,80,110,0)}100%{box-shadow:0 0 0 0 rgba(255,80,110,0)}}
@keyframes lcaBlink{0%,45%{opacity:1}46%,100%{opacity:.25}}
`;document.head.appendChild(s)}
function state(){return window.LEXICON_CHAMPION_V47?.state}
function setListening(){const mic=$('mic'),heard=$('heard');if(!mic||!heard)return;clearTimeout(checkingTimer);mic.classList.remove('voice-checking');mic.classList.add('voice-listening');mic.textContent='กำลังฟัง... พูดได้เลย';heard.classList.remove('voice-checking');heard.classList.add('voice-listening');heard.textContent='🎙 Listening... พูดประโยคของคุณได้เลย'}
function setChecking(){const mic=$('mic'),heard=$('heard');if(!mic||!heard)return;mic.classList.remove('voice-listening');mic.classList.add('voice-checking');mic.textContent='⏳ กำลังตรวจคำตอบ...';heard.classList.remove('voice-listening');heard.classList.add('voice-checking');if(!/^ได้ยิน:/.test(heard.textContent||''))heard.textContent='⏳ กำลังตรวจสิ่งที่ได้ยิน...';checkingTimer=setTimeout(resetIdle,900)}
function resetIdle(){const mic=$('mic'),heard=$('heard');if(!mic)return;mic.classList.remove('voice-listening','voice-checking');mic.textContent='🎤 กดแล้วพูด';heard?.classList.remove('voice-listening','voice-checking')}
function bind(){const mic=$('mic');if(!mic){lastMic=null;lastBusy=false;return false}if(mic!==lastMic){lastMic=mic;lastBusy=Boolean(state()?.micBusy);mic.addEventListener('click',()=>setTimeout(()=>{if(state()?.micBusy)setListening()},0),{capture:false})}return true}
function poll(){clearTimeout(timer);if(document.hidden){timer=setTimeout(poll,500);return}const active=bind();if(active){const st=state(),busy=Boolean(st?.micBusy);if(busy&&!lastBusy)setListening();if(!busy&&lastBusy)setChecking();lastBusy=busy;timer=setTimeout(poll,120)}else{timer=setTimeout(poll,350)}}
injectStyle();poll();addEventListener('pagehide',()=>{clearTimeout(timer);clearTimeout(checkingTimer)},{once:true});
window.LEXICON_VOICE_LISTENING=Object.freeze({release:RELEASE});
})();