(function(){
'use strict';
const cfg=window.CQ_V24_CONFIG||{};
const {PID='guest',RUN='1',MISSION_SET='CQ-DEMO',DIALOGUES=[],RNG=Math.random}=cfg;
if(!DIALOGUES.length){document.body.innerHTML='<main style="padding:24px;color:white">Conversation bank failed to load.</main>';throw new Error('CQ_BANK_NOT_LOADED')}
const $=id=>document.getElementById(id);
const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
const AR_SOURCES=[
  {version:'0.10.22',module:'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm',wasm:'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm'},
  {version:'0.10.14',module:'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm',wasm:'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'}
];
const state={
  index:0,score:0,turnAttempts:0,firstCorrect:0,speakingPassed:0,speechScores:[],
  selectedText:'',selectedReply:'',locked:false,audioOn:true,stream:null,handLandmarker:null,
  handDelegate:'',handVersion:'',lastVideoTime:-1,lastDetectAt:0,hoverIndex:-1,hoverSince:0,
  raf:0,recognition:null,rendered:[],arInitToken:0,pinchLatched:false,arAttempt:0,
  micBusy:false,micPermissionReady:false,micToken:0,speechTimer:0
};
window.CONVERSATION_QUEST={version:'2.4.3-final-reliability',state,dialogues:DIALOGUES};

function syncViewport(){const h=Math.round(window.visualViewport?.height||window.innerHeight);document.documentElement.style.setProperty('--app-height',h+'px')}
syncViewport();
window.visualViewport?.addEventListener('resize',syncViewport);
window.visualViewport?.addEventListener('scroll',syncViewport);
window.addEventListener('orientationchange',()=>setTimeout(syncViewport,120));

function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
function withTimeout(promise,ms,label){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label||'TIMEOUT')),ms)})]).finally(()=>clearTimeout(timer))}
function speak(text){
  if(!state.audioOn||!('speechSynthesis'in window))return;
  window.speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text);u.lang='en-US';u.rate=.84;u.pitch=1.03;
  window.speechSynthesis.speak(u);
}
async function waitForSpeechIdle(maxWait=1200){
  const started=performance.now();
  window.speechSynthesis?.cancel();
  while(window.speechSynthesis?.speaking&&performance.now()-started<maxWait)await sleep(60);
  await sleep(260);
}
function show(name){['intro','mission','summary'].forEach(id=>$(id).classList.toggle('hidden',id!==name))}
function normalize(text){return String(text).toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9\s]/g,' ').replace(/\bim\b/g,'i am').replace(/\bill\b/g,'i will').replace(/\byoure\b/g,'you are').replace(/\s+/g,' ').trim()}
function similarity(target,heard){const a=normalize(target).split(' ').filter(Boolean),b=normalize(heard).split(' ').filter(Boolean);if(!a.length)return 0;const used=new Set();let hits=0;for(const word of a){let found=-1;for(let i=0;i<b.length;i++){if(!used.has(i)&&b[i]===word){found=i;break}}if(found>=0){used.add(found);hits++}}return Math.round((hits/a.length*.85+Math.min(1,b.length/Math.max(1,a.length))*.15)*100)}
function keywordResult(heard){const words=new Set(normalize(heard).split(' ').filter(Boolean));const required=DIALOGUES[state.index]?.keywords||[];const matched=required.filter(w=>words.has(normalize(w)));return{required,matched,passed:required.length>0&&matched.length===required.length}}
function shuffled(item){const out=item.choices.map((text,i)=>({text,correct:i===item.answer}));for(let i=out.length-1;i>0;i--){const j=Math.floor(RNG()*(i+1));[out[i],out[j]]=[out[j],out[i]]}return out}

function pauseHandDetection(){cancelAnimationFrame(state.raf);state.raf=0;$('cursor').style.display='none';state.hoverIndex=-1;state.hoverSince=0}
function resumeHandDetection(){if(state.handLandmarker&&state.stream&&!$('mission').classList.contains('speaking-focus'))detectLoop()}
function enterChoiceMode(){$('mission').classList.remove('speaking-focus');$('choices').hidden=false;$('speakGate').classList.remove('show');$('playarea').scrollTop=0;requestAnimationFrame(resumeHandDetection)}
function enterSpeakingMode(){pauseHandDetection();$('mission').classList.add('speaking-focus');$('choices').hidden=true;$('speakGate').classList.add('show');requestAnimationFrame(()=>{$('playarea').scrollTop=0;$('mic').focus({preventScroll:true})});syncViewport()}
function renderTurn(){
  state.locked=false;state.selectedText='';state.selectedReply='';state.turnAttempts=0;state.hoverIndex=-1;state.hoverSince=0;state.pinchLatched=false;
  enterChoiceMode();
  const item=DIALOGUES[state.index];
  $('turn').textContent=`${state.index+1} / ${DIALOGUES.length}`;$('score').textContent=state.score;$('speaking').textContent=`${state.speakingPassed} / ${DIALOGUES.length}`;
  $('line').textContent=item.line;$('feedback').className='feedback';$('feedback').textContent='เลือกคำตอบที่เหมาะสมก่อน แล้วจึงพูดประโยคที่เลือก';
  $('heard').textContent='ยังไม่ได้เริ่มพูด';$('meter').style.width='0';
  state.rendered=shuffled(item);$('choices').innerHTML='';
  state.rendered.forEach((option,i)=>{const b=document.createElement('button');b.type='button';b.className='choice';b.dataset.index=String(i);b.innerHTML=`${option.text}<span class="progress"></span>`;b.addEventListener('click',()=>choose(i));$('choices').appendChild(b)});
  speak(item.line);
}
function choose(i){
  if(state.locked||state.selectedText)return;
  const picked=state.rendered[i],buttons=[...document.querySelectorAll('.choice')];if(!picked||!buttons[i])return;
  state.turnAttempts++;buttons[i].classList.add(picked.correct?'correct':'wrong');
  if(!picked.correct){$('feedback').className='feedback bad';$('feedback').textContent='คำตอบนี้ยังไม่เหมาะสม • เลือกใหม่อีกครั้ง';setTimeout(()=>buttons[i]?.classList.remove('wrong'),800);return}
  if(state.turnAttempts===1)state.firstCorrect++;
  state.selectedText=picked.text;state.selectedReply=DIALOGUES[state.index].reply;state.score+=150;$('score').textContent=state.score;
  $('target').textContent=state.selectedText;$('keywordHint').textContent='คำสำคัญ: '+DIALOGUES[state.index].keywords.join(' • ');
  $('feedback').className='feedback good';$('feedback').textContent='เลือกถูกแล้ว แต่ยังไม่ผ่าน • ต้องพูดประโยคนี้';
  enterSpeakingMode();setTimeout(()=>speak(state.selectedText),220);
}

function resetMic(message='🎤 กดแล้วพูด'){
  clearTimeout(state.speechTimer);state.speechTimer=0;state.micBusy=false;
  $('mic').disabled=false;$('mic').classList.remove('listening');$('mic').textContent=message;
}
async function warmMicPermission(){
  if(state.micPermissionReady||!navigator.mediaDevices?.getUserMedia)return;
  const stream=await withTimeout(navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false}),7000,'MIC_PERMISSION_TIMEOUT');
  stream.getTracks().forEach(track=>track.stop());state.micPermissionReady=true;
}
function evaluateSpeech(best){
  const passed=best.score>=60||best.keys.passed;
  if(passed){passSpeaking(Math.max(best.score,best.keys.passed?60:0),best.text,best.keys);return true}
  if(best.text){
    const missing=(best.keys.required||[]).filter(w=>!best.keys.matched.includes(w));
    $('feedback').className='feedback bad';$('feedback').textContent=`ยังไม่ผ่าน (${best.score}%) • ลองเน้นคำ: ${missing.join(', ')||'คำสำคัญ'}`;
    speak('Please try again. '+state.selectedText);
  }else{
    $('feedback').className='feedback bad';$('feedback').textContent='ยังไม่ได้ยินประโยค • กดไมค์แล้วพูดใหม่';
  }
  return false;
}
async function runRecognitionCycle(token,autoRetryLeft){
  if(token!==state.micToken||!state.selectedText||state.locked)return;
  const rec=new Recognition();state.recognition=rec;rec.lang='en-US';rec.interimResults=true;rec.continuous=false;rec.maxAlternatives=5;
  let best={text:'',score:0,keys:{required:[],matched:[],passed:false}},ended=false,hadError=false,speechStarted=false;
  const finishCycle=()=>{if(ended)return;ended=true;clearTimeout(state.speechTimer);state.speechTimer=0};
  rec.onstart=()=>{if(token!==state.micToken)return;$('mic').textContent='🔴 พูดได้เลย';$('heard').textContent='กำลังฟัง… พูดประโยคด้านบนให้จบ';$('feedback').className='feedback';$('feedback').textContent='กำลังฟังเสียงของคุณ…'};
  rec.onspeechstart=()=>{speechStarted=true;$('mic').textContent='🔴 กำลังรับเสียง…'};
  rec.onresult=e=>{
    for(let r=e.resultIndex;r<e.results.length;r++)for(let a=0;a<e.results[r].length;a++){
      const text=e.results[r][a].transcript,score=similarity(state.selectedText,text),keys=keywordResult(text);
      if(keys.matched.length>best.keys.matched.length||(keys.matched.length===best.keys.matched.length&&score>best.score))best={text,score,keys};
    }
    const keyText=best.keys.required.length?` • คำสำคัญ ${best.keys.matched.length}/${best.keys.required.length}`:'';
    $('heard').textContent=`ได้ยิน: “${best.text}” • ${best.score}%${keyText}`;$('meter').style.width=Math.max(best.score,best.keys.passed?100:0)+'%';
  };
  rec.onspeechend=()=>{setTimeout(()=>{try{rec.stop()}catch{}},320)};
  rec.onerror=e=>{
    if(e.error==='aborted')return;
    hadError=e.error!=='no-speech';
    if(e.error==='not-allowed'||e.error==='service-not-allowed'){
      $('heard').textContent='ยังไม่ได้อนุญาตไมโครโฟน';$('feedback').className='feedback bad';$('feedback').textContent='เปิดสิทธิ์ไมโครโฟนใน Chrome แล้วลองใหม่';
    }else if(e.error!=='no-speech'){
      $('heard').textContent='ฟังไม่สำเร็จ: '+e.error;$('feedback').className='feedback bad';$('feedback').textContent='ระบบเสียงสะดุด • กดไมค์แล้วลองใหม่';
    }
  };
  rec.onend=async()=>{
    finishCycle();if(token!==state.micToken||state.locked)return;
    if(evaluateSpeech(best)){resetMic();return}
    const canAutoRetry=autoRetryLeft>0&&!best.text&&!hadError;
    if(canAutoRetry){
      $('mic').textContent='🎤 ลองฟังอีกครั้ง…';$('heard').textContent=speechStarted?'ยังจับคำไม่ได้ • เตรียมพูดอีกครั้ง':'ยังไม่พบเสียง • เตรียมไมค์ใหม่';
      await sleep(650);if(token!==state.micToken)return;await runRecognitionCycle(token,autoRetryLeft-1);return;
    }
    resetMic();
  };
  try{
    rec.start();
    state.speechTimer=setTimeout(()=>{try{rec.stop()}catch{}},8500);
  }catch(e){finishCycle();resetMic();$('heard').textContent='เริ่มไมโครโฟนไม่สำเร็จ';$('feedback').className='feedback bad';$('feedback').textContent='รอสักครู่แล้วกดไมค์ใหม่';console.warn(e)}
}
async function beginRecognition(){
  if(!state.selectedText||state.locked||state.micBusy)return;
  if(!Recognition){$('heard').textContent='อุปกรณ์นี้ไม่รองรับ Speech Recognition';$('feedback').className='feedback bad';$('feedback').textContent='กรุณาเปิดด้วย Chrome บน Android';return}
  state.micBusy=true;$('mic').disabled=true;$('mic').classList.add('listening');$('mic').textContent='⏳ เตรียมไมค์…';
  $('heard').textContent='รอสักครู่ แล้วเริ่มพูดเมื่อขึ้น “พูดได้เลย”';$('feedback').className='feedback';$('feedback').textContent='กำลังเตรียมระบบรับเสียง…';
  const token=++state.micToken;
  try{try{state.recognition?.abort()}catch{}await waitForSpeechIdle();await warmMicPermission();if(token!==state.micToken)return;$('mic').disabled=false;$('mic').textContent='🎤 เตรียมพูด…';await sleep(350);await runRecognitionCycle(token,1)}
  catch(e){console.warn(e);if(token!==state.micToken)return;resetMic();$('heard').textContent=e?.name==='NotAllowedError'?'ยังไม่ได้อนุญาตไมโครโฟน':'เตรียมไมโครโฟนไม่สำเร็จ';$('feedback').className='feedback bad';$('feedback').textContent='ตรวจสิทธิ์ไมโครโฟน แล้วกดใหม่อีกครั้ง'}
}
function passSpeaking(match,heard,keys){
  if(state.locked)return;state.locked=true;state.micToken++;try{state.recognition?.abort()}catch{}resetMic();
  state.speakingPassed++;state.speechScores.push(match);state.score+=250+Math.round(match*2);
  $('score').textContent=state.score;$('speaking').textContent=`${state.speakingPassed} / ${DIALOGUES.length}`;
  $('feedback').className='feedback good';$('feedback').textContent=`พูดผ่าน ${match}% • ${state.selectedReply}`;
  $('heard').textContent=`ผ่านแล้ว: “${heard}” • คำสำคัญ ${keys.matched.length}/${keys.required.length}`;speak(state.selectedReply);
  setTimeout(()=>{state.index++;if(state.index<DIALOGUES.length)renderTurn();else finish()},2100);
}
function finish(){
  stopCamera();const accuracy=Math.round(state.firstCorrect/DIALOGUES.length*100),avg=Math.round(state.speechScores.reduce((a,b)=>a+b,0)/Math.max(1,state.speechScores.length));
  $('accuracy').textContent=accuracy+'%';$('speakingPassed').textContent=`${state.speakingPassed}/${DIALOGUES.length}`;$('finalScore').textContent=state.score;$('speechAvg').textContent=avg+'%';
  $('grade').textContent=accuracy===100&&avg>=85?'S':avg>=70?'A':'B';$('summaryText').textContent=`เลือกคำตอบและพูดผ่านครบ ${state.speakingPassed} จาก ${DIALOGUES.length} ช่วงสนทนา`;
  $('missionSetSummary').textContent=`Mission Set ${MISSION_SET} • ผู้เล่น ${PID} • Run ${RUN}`;show('summary');$('summaryScroll').scrollTop=0;syncViewport();
}

async function requestCamera(){
  const constraints={video:{facingMode:'user',width:{ideal:480,max:640},height:{ideal:360,max:480},frameRate:{ideal:24,max:30}},audio:false};
  return withTimeout(navigator.mediaDevices.getUserMedia(constraints),9000,'CAMERA_TIMEOUT');
}
async function startCamera(){
  if(!navigator.mediaDevices?.getUserMedia){setTouchMode('เบราว์เซอร์ไม่รองรับกล้อง');return}
  try{
    if(!state.stream)state.stream=await requestCamera();
    $('video').srcObject=state.stream;await withTimeout($('video').play(),5000,'VIDEO_PLAY_TIMEOUT');
    $('handStatus').textContent='กล้องพร้อม • กำลังโหลด AR…';$('retryAR').classList.remove('show');await setupHands();
  }catch(e){console.warn(e);setTouchMode('เปิดกล้องหรือ AR ไม่สำเร็จ')}
}
async function createHand(vision,fileset,delegate){
  return vision.HandLandmarker.createFromOptions(fileset,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',delegate},runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:.38,minHandPresenceConfidence:.38,minTrackingConfidence:.38});
}
async function loadVisionSource(source,token){
  $('handStatus').textContent=`โหลด AR Engine ${source.version}…`;
  const vision=await withTimeout(import(source.module),12000,'AR_MODULE_TIMEOUT');if(token!==state.arInitToken)throw new Error('AR_CANCELLED');
  const fileset=await withTimeout(vision.FilesetResolver.forVisionTasks(source.wasm),12000,'AR_WASM_TIMEOUT');if(token!==state.arInitToken)throw new Error('AR_CANCELLED');
  return{vision,fileset};
}
async function setupHands(){
  pauseHandDetection();const token=++state.arInitToken;state.arAttempt++;let lastError=null;
  try{try{state.handLandmarker?.close?.()}catch{}state.handLandmarker=null;state.lastVideoTime=-1;state.lastDetectAt=0;
    for(const source of AR_SOURCES){
      let runtime;
      try{runtime=await loadVisionSource(source,token)}catch(e){lastError=e;console.warn('AR source failed',source.version,e);continue}
      for(const delegate of ['GPU','CPU']){
        try{
          $('handStatus').textContent=`เปิด AR ${source.version} (${delegate})…`;
          const hand=await withTimeout(createHand(runtime.vision,runtime.fileset,delegate),14000,'AR_MODEL_TIMEOUT');
          if(token!==state.arInitToken){try{hand?.close?.()}catch{}throw new Error('AR_CANCELLED')}
          state.handLandmarker=hand;state.handDelegate=delegate;state.handVersion=source.version;lastError=null;break;
        }catch(e){lastError=e;console.warn('Hand delegate failed',source.version,delegate,e)}
      }
      if(state.handLandmarker)break;
    }
    if(lastError||!state.handLandmarker)throw lastError||new Error('HAND_INIT_FAILED');
    $('handStatus').textContent=`AR Ready • ${state.handVersion}/${state.handDelegate} • ชี้ค้างหรือจีบ`;$('retryAR').classList.remove('show');resumeHandDetection();
  }catch(e){if(String(e?.message).includes('AR_CANCELLED'))return;console.warn(e);setTouchMode('AR โหลดไม่สำเร็จ')}
}
function setTouchMode(reason){pauseHandDetection();$('handStatus').textContent=`Touch Mode • ${reason}`;$('retryAR').classList.add('show')}
function detectLoop(){
  cancelAnimationFrame(state.raf);
  const loop=()=>{
    if(!state.handLandmarker||!state.stream||$('mission').classList.contains('speaking-focus'))return;
    const v=$('video'),now=performance.now();
    try{
      if(now-state.lastDetectAt>=45&&v.readyState>=2&&v.currentTime!==state.lastVideoTime){
        state.lastDetectAt=now;state.lastVideoTime=v.currentTime;const result=state.handLandmarker.detectForVideo(v,now);
        if(result.landmarks?.length){const lm=result.landmarks[0],tip=lm[8],thumb=lm[4],x=(1-tip.x)*innerWidth,y=tip.y*innerHeight,pinch=Math.hypot(tip.x-thumb.x,tip.y-thumb.y)<.06;$('cursor').style.display='block';$('cursor').style.left=x+'px';$('cursor').style.top=y+'px';$('cursor').classList.toggle('pinch',pinch);const target=document.elementFromPoint(x,y)?.closest('.choice');updateHover(target,pinch)}
        else{$('cursor').style.display='none';updateHover(null,false)}
      }
    }catch(e){console.warn(e);try{state.handLandmarker?.close?.()}catch{}state.handLandmarker=null;setTouchMode('AR หยุดทำงาน');return}
    state.raf=requestAnimationFrame(loop);
  };
  state.raf=requestAnimationFrame(loop);
}
function updateHover(target,pinch){
  const buttons=[...document.querySelectorAll('.choice')],i=target?buttons.indexOf(target):-1;
  buttons.forEach((b,j)=>{b.classList.toggle('hover',j===i&&!b.disabled);if(j!==i){const p=b.querySelector('.progress');if(p)p.style.width='0'}});
  if(i<0||buttons[i]?.disabled||state.selectedText){state.hoverIndex=-1;state.hoverSince=0;state.pinchLatched=pinch;return}
  if(i!==state.hoverIndex){state.hoverIndex=i;state.hoverSince=performance.now();state.pinchLatched=pinch}
  const elapsed=performance.now()-state.hoverSince,bar=buttons[i].querySelector('.progress');if(bar)bar.style.width=Math.min(100,elapsed/8)+'%';
  const pinchEdge=pinch&&!state.pinchLatched;state.pinchLatched=pinch;if(pinchEdge||elapsed>=800)choose(i);
}
function stopAR(){pauseHandDetection();state.arInitToken++;try{state.handLandmarker?.close?.()}catch{}state.handLandmarker=null;state.handDelegate='';state.handVersion='';state.lastVideoTime=-1}
function stopCamera(){state.micToken++;clearTimeout(state.speechTimer);try{state.recognition?.abort()}catch{}resetMic();stopAR();state.stream?.getTracks().forEach(t=>t.stop());state.stream=null;$('video').srcObject=null}
async function retryAR(){
  if(state.micBusy)return;stopAR();$('retryAR').classList.remove('show');$('handStatus').textContent='กำลังเริ่ม AR ใหม่…';
  state.stream?.getTracks().forEach(t=>t.stop());state.stream=null;$('video').srcObject=null;await sleep(220);await startCamera();
}
async function startGame(){state.index=0;state.score=0;state.turnAttempts=0;state.firstCorrect=0;state.speakingPassed=0;state.speechScores=[];show('mission');renderTurn();startCamera()}
function hub(){stopCamera();location.href='./game-test-hub.html?v=20260806-cq-v243-final-reliability'}
function bind(){
  $('start').addEventListener('click',startGame);$('replay').addEventListener('click',startGame);
  $('speakQuestion').addEventListener('click',()=>speak(DIALOGUES[state.index]?.line||''));$('sample').addEventListener('click',()=>speak(state.selectedText));
  $('mic').addEventListener('click',beginRecognition);$('retryAR').addEventListener('click',retryAR);
  $('audio').addEventListener('click',()=>{state.audioOn=!state.audioOn;$('audio').textContent=state.audioOn?'🔊':'🔇';if(!state.audioOn)window.speechSynthesis?.cancel()});
  $('back').addEventListener('click',hub);$('hubIntro').addEventListener('click',hub);$('hubSummary').addEventListener('click',hub);
  $('missionSetIntro').textContent=`Mission Set ${MISSION_SET} • Run ${RUN}`;$('versionLabel').textContent='GAME 4 • Final Reliability V2.4.3';
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseHandDetection();else resumeHandDetection()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
