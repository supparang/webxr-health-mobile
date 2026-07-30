(()=>{'use strict';
if(window.__JUMPDUCK_FAILSAFE_V44__)return;
window.__JUMPDUCK_FAILSAFE_V44__=true;
const q=new URLSearchParams(location.search);
const nativeSetInterval=window.setInterval.bind(window);
const nativeClearInterval=window.clearInterval.bind(window);
const nativeSetTimeout=window.setTimeout.bind(window);
const nativeRAF=window.requestAnimationFrame.bind(window);
const trackedIntervals=new Set();
const deferredTracks=new Set();
let finalized=false;
let wallTimer=0;

/* Capture the core clock so the failsafe can stop it before the old finish path runs. */
window.setInterval=function(callback,delay,...args){
  const id=nativeSetInterval(callback,delay,...args);
  if(Number(delay)<=500)trackedIntervals.add(id);
  return id;
};
window.clearInterval=function(id){
  trackedIntervals.delete(id);
  return nativeClearInterval(id);
};

/* Defer MediaStreamTrack.stop while gameplay is visible. Some Android builds stall
   when a Pose inference is still in flight and the camera track is stopped. */
const TrackProto=window.MediaStreamTrack&&window.MediaStreamTrack.prototype;
const nativeTrackStop=TrackProto&&TrackProto.stop;
if(nativeTrackStop){
  TrackProto.stop=function(){
    const game=document.getElementById('game');
    const result=document.getElementById('result');
    const gameActive=game&&!game.classList.contains('hidden')&&result&&result.classList.contains('hidden')&&!finalized;
    if(gameActive){deferredTracks.add(this);return;}
    return nativeTrackStop.call(this);
  };
}

function releaseTracks(){
  deferredTracks.forEach(track=>{try{nativeTrackStop&&nativeTrackStop.call(track)}catch(_){}});
  deferredTracks.clear();
  try{document.getElementById('video')?.srcObject?.getTracks?.().forEach(track=>nativeTrackStop&&nativeTrackStop.call(track))}catch(_){ }
}
function stopSchedulers(){
  trackedIntervals.forEach(id=>{try{nativeClearInterval(id)}catch(_){}});
  trackedIntervals.clear();
  window.requestAnimationFrame=function(){return 0};
  const originalSetTimeout=window.setTimeout;
  window.setTimeout=function(callback,delay,...args){
    if(finalized&&typeof callback==='function'&&callback.name==='poseLoop')return 0;
    return originalSetTimeout(callback,delay,...args);
  };
}
function rankFor(accuracy){return accuracy>=90?'SS':accuracy>=80?'S':accuracy>=70?'A':accuracy>=60?'B':'C'}
function snapshot(reason){
  let state={};
  try{state=window.JumpDuckAPI?.getState?.()||{}}catch(_){ }
  const accuracy=Number.isFinite(Number(state.accuracy))?Number(state.accuracy):0;
  const stars=Number.isFinite(Number(state.stars))?Number(state.stars):(accuracy>=85?3:accuracy>=70?2:1);
  return {
    ...state,
    completed:true,
    passed:true,
    roundCompleted:true,
    forcedReplay:false,
    finishReason:reason,
    rank:state.rank||rankFor(accuracy),
    stars,
    missionReached:Math.max(1,Math.min(3,Number(state.missionReached)||1)),
    gameVersion:'jumpduck-production-v4.4-result-first-failsafe',
    resultFirstFailsafe:true,
    eventId:state.eventId||`HH-game-fitness-jumpduck-${q.get('studentId')||''}-${Date.now()}`
  };
}
function fillResult(payload){
  const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=String(value)};
  set('rank',payload.rank||'C');
  set('stars','⭐'.repeat(Math.max(1,Math.min(3,Number(payload.stars)||1))));
  set('finalScore',Number(payload.score)||0);
  set('finalAcc',`${Number(payload.accuracy)||0}%`);
  set('finalCombo',Number(payload.maxCombo)||0);
  set('finalGood',Number(payload.healthCoins)||0);
  set('finalPerfect',Number(payload.perfectCount)||0);
  set('finalMove',Number(payload.movementCount)||0);
  set('resultText',`สำเร็จ ${Number(payload.successfulEvents)||0}/${Number(payload.resolvedEvents)||0} • Miss ${Number(payload.missCount)||0} • ภารกิจ ${payload.missionReached}/3 • Reaction ${Number(payload.avgReactionMs)>0?`${Math.round(Number(payload.avgReactionMs))} ms`:'ไม่ได้วัดในรอบนี้'}`);
  const sync=document.getElementById('syncText');
  if(sync){
    const direct=window.parent===window||!q.get('studentId');
    sync.textContent=direct?`เล่นครบ 1 รอบ • พร้อมกลับ Passport\nทำสำเร็จ ${payload.missionReached} จาก 3 ภารกิจ`:'จบรอบแล้ว • กำลังส่งผลไปยัง Passport';
    sync.style.whiteSpace='pre-line';
  }
}
function publish(payload){
  window.__JUMPDUCK_LAST_RESULT__=payload;
  try{localStorage.setItem('HHA_JUMPDUCK_LAST_RESULT',JSON.stringify(payload))}catch(_){ }
  try{parent.postMessage({type:'HEROHEALTH_GAME_COMPLETE',payload,autoSubmit:true},location.origin)}catch(_){ }
}
function finalize(reason='failsafe'){
  if(finalized)return true;
  const result=document.getElementById('result');
  const game=document.getElementById('game');
  if(!result||!game)return false;
  finalized=true;
  if(wallTimer)nativeClearInterval(wallTimer);
  stopSchedulers();
  const payload=snapshot(reason);
  const time=document.getElementById('time');
  if(time)time.textContent='0';
  document.getElementById('finishRoundBtn')?.classList.add('hidden');
  game.classList.add('hidden');
  result.classList.remove('hidden');
  fillResult(payload);
  publish(payload);
  nativeRAF(()=>nativeSetTimeout(releaseTracks,80));
  return true;
}

/* Replace the public API with the result-first path. */
const priorAPI=window.JumpDuckAPI||{};
window.JumpDuckAPI={...priorAPI,version:'4.4',finish:finalize};

const finishBtn=document.getElementById('finishRoundBtn');
if(finishBtn){
  const handler=event=>{event.preventDefault();event.stopImmediatePropagation();finalize('manual-result-first')};
  finishBtn.addEventListener('pointerdown',handler,true);
  finishBtn.addEventListener('touchstart',handler,{capture:true,passive:false});
  finishBtn.addEventListener('click',handler,true);
}

/* The moment the display reaches 1 second, move to results before the legacy
   finish path or camera cleanup can stall the Android main thread. */
const timeEl=document.getElementById('time');
if(timeEl)new MutationObserver(()=>{
  const value=Number(timeEl.textContent);
  if(value<=1&&!finalized)finalize('one-second-result-first');
}).observe(timeEl,{childList:true,characterData:true,subtree:true});

const gameEl=document.getElementById('game');
if(gameEl)new MutationObserver(()=>{
  if(!gameEl.classList.contains('hidden')&&!finalized){
    const startedAt=Date.now();
    if(wallTimer)nativeClearInterval(wallTimer);
    wallTimer=nativeSetInterval(()=>{
      if(finalized){nativeClearInterval(wallTimer);return;}
      if(Date.now()-startedAt>=59000)finalize('wall-clock-result-first');
    },200);
  }
}).observe(gameEl,{attributes:true,attributeFilter:['class']});
})();
