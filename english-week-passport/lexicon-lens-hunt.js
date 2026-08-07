(function(){
'use strict';

const VERSION='2026-08-07-LEXICON-LENS-HUNT-V1.1';
const STAGE_ID='bonus_lens';
const MISSION_COUNT=5;
const cfg=window.EW_CONFIG||{};
const authority=window.EW_AUTHORITY;
const rotation=window.EW_ROTATION;
const params=new URLSearchParams(location.search);

const BANK=Object.freeze([
  {id:'umbrella',level:'A2',clue:'Find something people use when it rains.',hint:'It keeps rain above your head.',question:'Which sentence uses “umbrella” correctly?',options:['I carry an umbrella when it rains.','I eat an umbrella for lunch.','I write homework with an umbrella.'],answer:0},
  {id:'bottle',level:'A2',clue:'Find something that can hold drinking water.',hint:'You may carry it in your bag.',question:'Which sentence is correct?',options:['Please fill your bottle with water.','Please wear your bottle on your feet.','Please open the bottle with a keyboard.'],answer:0},
  {id:'keyboard',level:'A2+',clue:'Find a device used to type letters into a computer.',hint:'It has many keys.',question:'Which instruction is natural?',options:['Type your answer on the keyboard.','Drink your answer from the keyboard.','Wear the keyboard when it rains.'],answer:0},
  {id:'ticket',level:'A2+',clue:'Find something that shows permission to enter or travel.',hint:'You may need it before a journey or event.',question:'Which sentence is correct?',options:['Keep your ticket in a safe place.','Cook your ticket before travelling.','Charge your ticket with water.'],answer:0},
  {id:'map',level:'A2+',clue:'Find something that helps people understand where places are.',hint:'It shows locations and routes.',question:'Which sentence is most appropriate?',options:['Check the map before choosing your route.','Taste the map before choosing your route.','Recycle the map to hear music.'],answer:0},
  {id:'notebook',level:'A2',clue:'Find something students can use to write notes.',hint:'It contains paper pages.',question:'Which sentence is correct?',options:['Write the new words in your notebook.','Use your notebook to wash your hands.','Drive your notebook to school.'],answer:0},
  {id:'charger',level:'B1',clue:'Find something used when a phone battery is low.',hint:'It supplies electrical power to a device.',question:'Which sentence best fits the situation?',options:['I need a charger because my battery is almost empty.','I need a charger because my shoes are wet.','I need a charger because the classroom is noisy.'],answer:0},
  {id:'recycle',level:'B1',clue:'Find a place where recyclable waste should be put.',hint:'Look for a bin or station connected with reducing waste.',question:'Which statement shows responsible behaviour?',options:['Put recyclable materials in the correct recycling bin.','Leave recyclable materials on the floor.','Mix every type of waste without checking.'],answer:0},
  {id:'backpack',level:'A2+',clue:'Find something students carry on their back to hold belongings.',hint:'Books and personal items often go inside it.',question:'Which sentence is natural?',options:['My notebook is inside my backpack.','My backpack is inside my pencil.','I download my backpack every morning.'],answer:0},
  {id:'headphones',level:'B1',clue:'Find something people wear over or in their ears to listen privately.',hint:'It can help you hear audio without disturbing others.',question:'Which sentence best describes responsible use?',options:['Use headphones when you need to listen without disturbing others.','Use headphones to charge your notebook.','Use headphones to cross the road without looking.'],answer:0},
  {id:'plant',level:'B1',clue:'Find a living thing that grows and usually has leaves.',hint:'It needs suitable light and water.',question:'Which sentence expresses a sensible action?',options:['Water the plant when the soil is dry.','Upload the plant before it grows.','Use a password to drink the plant.'],answer:0},
  {id:'sign',level:'B1+',clue:'Find something that gives people written or visual directions or rules.',hint:'People read it to know what to do or where to go.',question:'Which sentence shows evidence-based action?',options:['Read the sign carefully before deciding where to go.','Ignore every sign because directions are never useful.','Use the sign only after reaching the wrong place.'],answer:0}
]);

const el=id=>document.getElementById(id);
const video=el('camera');
const canvas=el('scanCanvas');
const ctx=canvas.getContext('2d',{willReadFrequently:true});
const intro=el('intro');
const questionLayer=el('questionLayer');
const manualLayer=el('manualLayer');
const summaryLayer=el('summaryLayer');
const notice=el('notice');
const clueText=el('clueText');
const hintText=el('hintText');
const missionCount=el('missionCount');
const progressBar=el('progressBar');
const scoreText=el('scoreText');
const levelText=el('levelText');
const scanLabel=el('scanLabel');

let identity=null;
let assignment=null;
let stream=null;
let track=null;
let raf=0;
let lastDecodeAt=0;
let lastCode='';
let lastCodeAt=0;
let scanEnabled=false;
let torchOn=false;
let missions=[];
let index=0;
let score=0;
let startedAt=0;
let missionStartedAt=0;
let wrongScans=0;
let totalScans=0;
let correctContexts=0;
let records=[];
let saving=false;
let savedReceipt='';

function h(value){return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}
function now(){return Date.now()}
function setNotice(message,type){notice.textContent=message;notice.className='notice'+(type?' '+type:'')}
function readIdentity(){
  try{const value=JSON.parse(localStorage.getItem(cfg.cacheKeys?.identity||'ew_passport_identity_v1')||'null');if(value?.playerId)return value}catch(_){}
  const playerId=params.get('pid')||params.get('playerId')||'';
  if(!playerId)return null;
  const nickname=params.get('nickname')||params.get('name')||'Lens Player';
  const value={playerId,nickname,fullName:nickname};
  try{localStorage.setItem(cfg.cacheKeys?.identity||'ew_passport_identity_v1',JSON.stringify(value))}catch(_){}
  return value;
}
function qaBypass(){return params.get('debug')==='1'&&/^(QA|TEST)[-_]|^99\d{4,}$/i.test(String(identity?.playerId||''))}
function selectMissions(){
  if(rotation?.sample)return rotation.sample(BANK,MISSION_COUNT,STAGE_ID,'lens-missions');
  return BANK.slice(0,MISSION_COUNT);
}
function current(){return missions[index]||null}
function codeFor(item){return 'LXH:'+item.id}
function parseCode(raw){
  const text=String(raw||'').trim();
  const match=text.match(/^LXH:([a-z0-9_-]+)$/i);
  return match?match[1].toLowerCase():'';
}
function stopCamera(){
  scanEnabled=false;cancelAnimationFrame(raf);raf=0;
  if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;track=null;video.srcObject=null;torchOn=false;
}
function goPassport(){stopCamera();const q=new URLSearchParams({resume:'passport',fromGame:STAGE_ID,v:'20260807-lens2'});if(savedReceipt)q.set('receipt',savedReceipt);location.replace('./index.html?'+q.toString())}
function logEvent(eventName,payload){
  if(!identity?.playerId||typeof authority?.submitEvent!=='function')return;
  Promise.resolve(authority.submitEvent({playerId:identity.playerId,stageId:STAGE_ID,eventName,payload:{...(payload||{}),missionIndex:index+1,passportRotation:assignment?.passportRotation||'',assessmentRotation:assignment?.assessmentRotation||''},sourceVersion:VERSION})).catch(()=>{});
}
async function validateAccess(){
  identity=readIdentity();
  if(!identity?.playerId){showBlocked('กรุณาเข้าสู่ Passport ก่อนเปิด Bonus Mission');return false}
  assignment=rotation?.getAssignment?.(identity.playerId)||null;
  if(qaBypass())return true;
  try{
    const result=await authority?.resume?.(identity.playerId,identity.nickname||identity.fullName||'');
    if(!result?.ok)throw new Error(result?.error||'RESUME_FAILED');
    const passed=Array.isArray(result.progress?.passed)?result.progress.passed:[];
    if(!passed.includes('word_detective')){showBlocked('Bonus Mission จะเปิดหลังผ่าน Game 4 • Conversation Quest AR');return false}
    return true;
  }catch(error){showBlocked('ตรวจสอบสิทธิ์จาก Firebase ไม่สำเร็จ • '+String(error?.message||error));return false}
}
function showBlocked(message){
  intro.classList.remove('hidden');intro.innerHTML='<section class="card"><div class="hero">🔒</div><h1>Lens Hunt ยังไม่พร้อม</h1><p>'+h(message)+'</p><button id="blockedBack" class="btn primary" type="button">กลับ Passport</button></section>';el('blockedBack').onclick=goPassport;
}
function updateHud(){
  const item=current();missionCount.textContent=`MISSION ${Math.min(index+1,MISSION_COUNT)} / ${MISSION_COUNT}`;levelText.textContent=item?.level||'A2–B1+';scoreText.textContent=String(score);progressBar.style.width=`${Math.round(index/MISSION_COUNT*100)}%`;
  clueText.textContent=item?.clue||'Mission complete';hintText.textContent=item?.hint||'';
}
async function startCamera(){
  if(!navigator.mediaDevices?.getUserMedia){setNotice('อุปกรณ์นี้ไม่รองรับ Camera API • ใช้รหัสทดสอบแทน','bad');intro.classList.add('hidden');prepareGame(false);return}
  el('startBtn').disabled=true;el('startBtn').textContent='กำลังเปิดกล้องหลัง…';
  try{
    stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}});
    track=stream.getVideoTracks()[0]||null;video.srcObject=stream;await video.play();intro.classList.add('hidden');prepareGame(true);logEvent('lens_camera_started',{cameraLabel:track?.label||'',width:video.videoWidth,height:video.videoHeight});
    if(!window.jsQR)setNotice('QR decoder โหลดไม่สำเร็จ • ใช้ “ใส่รหัสทดสอบ” ชั่วคราว','bad');
  }catch(error){
    console.error(error);intro.classList.add('hidden');prepareGame(false);setNotice(error?.name==='NotAllowedError'?'ไม่ได้รับอนุญาตใช้กล้อง • เปิดสิทธิ์ Camera หรือใช้รหัสทดสอบ':'เปิดกล้องหลังไม่สำเร็จ • ใช้รหัสทดสอบได้','bad');logEvent('lens_camera_failed',{error:String(error?.name||error?.message||error)});
  }finally{if(el('startBtn')){el('startBtn').disabled=false;el('startBtn').textContent='📷 เปิดกล้องหลังและเริ่มภารกิจ'}}
}
function prepareGame(cameraReady){
  missions=selectMissions();index=0;score=0;wrongScans=0;totalScans=0;correctContexts=0;records=[];startedAt=now();missionStartedAt=now();scanEnabled=Boolean(cameraReady);updateHud();setNotice(cameraReady?'ค้นหา QR Station ที่ตรงกับคำใบ้ แล้วเล็งให้อยู่กลางกรอบ':'Camera fallback • แตะ “ใส่รหัสทดสอบ” เพื่อจำลองการสแกน');scanLabel.textContent=cameraReady?'เล็ง QR ให้อยู่กลางกรอบ':'Camera fallback พร้อมใช้งาน';logEvent('lens_mission_started',{missionIds:missions.map(item=>item.id),cameraReady:Boolean(cameraReady)});if(cameraReady)scanLoop();
}
function scanLoop(timestamp){
  raf=requestAnimationFrame(scanLoop);if(!scanEnabled||!video.videoWidth||timestamp-lastDecodeAt<130)return;lastDecodeAt=timestamp;
  const targetWidth=Math.min(720,video.videoWidth);const ratio=targetWidth/video.videoWidth;const targetHeight=Math.max(1,Math.round(video.videoHeight*ratio));
  if(canvas.width!==targetWidth||canvas.height!==targetHeight){canvas.width=targetWidth;canvas.height=targetHeight}
  try{ctx.drawImage(video,0,0,targetWidth,targetHeight);const image=ctx.getImageData(0,0,targetWidth,targetHeight);const result=window.jsQR?.(image.data,targetWidth,targetHeight,{inversionAttempts:'dontInvert'});if(result?.data)handleScan(result.data,'camera')}catch(_){}
}
function handleScan(raw,source){
  if(!current()||questionLayer.classList.contains('hidden')===false||summaryLayer.classList.contains('hidden')===false)return;
  const markerId=parseCode(raw);if(!markerId){if(source==='manual')setNotice('รูปแบบรหัสไม่ถูกต้อง • ตัวอย่าง LXH:umbrella','bad');return}
  const stamp=now();const fingerprint=markerId+'|'+index;if(lastCode===fingerprint&&stamp-lastCodeAt<1400)return;lastCode=fingerprint;lastCodeAt=stamp;
  const known=BANK.find(item=>item.id===markerId);totalScans+=1;
  if(!known){wrongScans+=1;setNotice('QR นี้ไม่ใช่ Station ของ Lexicon Lens Hunt','bad');logEvent('lens_scan_unknown',{markerId,source,totalScans});return}
  const item=current();
  if(markerId!==item.id){wrongScans+=1;setNotice('ยังไม่ใช่คำตอบของคำใบ้นี้ • ลองค้นหาจุดอื่น','bad');logEvent('lens_scan_wrong',{expectedId:item.id,scannedId:markerId,source,totalScans});if(navigator.vibrate)navigator.vibrate([35,45,35]);return}
  scanEnabled=false;const searchMs=now()-missionStartedAt;setNotice('พบ Clue ถูกต้อง ✓ • ตอบ Context Question ต่อ','good');logEvent('lens_clue_found',{itemId:item.id,source,searchMs,wrongScans,totalScans});if(navigator.vibrate)navigator.vibrate(55);showQuestion(item,searchMs,source);
}
function showQuestion(item,searchMs,source){
  const order=rotation?.order?rotation.order(item.options.map((text,i)=>({text,i})),`${STAGE_ID}:${item.id}`,'context-options'):item.options.map((text,i)=>({text,i}));
  questionLayer.innerHTML=`<section class="card"><div class="hero">✅</div><h1>${h(item.id.replaceAll('_',' '))}</h1><p><strong>${h(item.question)}</strong></p><div class="question-options">${order.map(option=>`<button class="option" type="button" data-original="${option.i}">${h(option.text)}</button>`).join('')}</div></section>`;
  questionLayer.classList.remove('hidden');questionLayer.querySelectorAll('.option').forEach(button=>button.onclick=()=>answerContext(button,item,searchMs,source));
}
function answerContext(button,item,searchMs,source){
  if(questionLayer.dataset.answered==='1')return;questionLayer.dataset.answered='1';const selected=Number(button.dataset.original);const correct=selected===item.answer;
  questionLayer.querySelectorAll('.option').forEach(node=>{const n=Number(node.dataset.original);node.disabled=true;if(n===item.answer)node.classList.add('correct');else if(node===button)node.classList.add('wrong')});
  const searchPoints=wrongScans===0?8:wrongScans===1?6:4;const languagePoints=correct?12:4;const earned=searchPoints+languagePoints;score+=earned;if(correct)correctContexts+=1;scoreText.textContent=String(score);
  const record={itemId:item.id,level:item.level,markerCode:codeFor(item),source,searchMs,wrongScans,totalScansAtAnswer:totalScans,contextSelected:selected,contextCorrect:correct,searchPoints,languagePoints,earned};records.push(record);
  logEvent('lens_context_answer',{itemId:item.id,selected,correct,searchPoints,languagePoints,earned,searchMs,wrongScans});
  setTimeout(()=>{questionLayer.classList.add('hidden');questionLayer.dataset.answered='0';index+=1;wrongScans=0;missionStartedAt=now();if(index>=MISSION_COUNT)finishGame();else{updateHud();setNotice('Mission ใหม่พร้อมแล้ว • อ่านคำใบ้แล้วค้นหา QR Station ต่อ');scanEnabled=Boolean(stream);}},900);
}
function openManual(){
  const item=current();if(!item)return;
  manualLayer.innerHTML=`<section class="card"><div class="hero">⌨️</div><h1>QA Marker Input</h1><p>ใช้เฉพาะการทดสอบเมื่อไม่มี QR อยู่ตรงหน้า ตัวอย่างรหัส: <strong>LXH:umbrella</strong></p><div class="manual"><input id="manualCode" autocomplete="off" autocapitalize="characters" placeholder="LXH:..."><button id="manualSubmit" type="button">สแกน</button></div><button id="manualClose" class="btn secondary" type="button">ปิด</button>${qaBypass()?`<p class="mini">QA hint ของ mission นี้: <strong>${h(codeFor(item))}</strong></p>`:''}</section>`;
  manualLayer.classList.remove('hidden');const submit=()=>{const value=el('manualCode').value.trim();manualLayer.classList.add('hidden');handleScan(value,'manual')};el('manualSubmit').onclick=submit;el('manualCode').onkeydown=e=>{if(e.key==='Enter')submit()};el('manualClose').onclick=()=>manualLayer.classList.add('hidden');setTimeout(()=>el('manualCode')?.focus(),80);
}
async function toggleTorch(){
  if(!track)return setNotice('ไฟฉายใช้ได้เมื่อเปิดกล้องหลังเท่านั้น');
  try{const cap=track.getCapabilities?.()||{};if(!cap.torch)return setNotice('กล้องเครื่องนี้ไม่รองรับการควบคุมไฟฉาย');torchOn=!torchOn;await track.applyConstraints({advanced:[{torch:torchOn}]});el('torchBtn').textContent=torchOn?'🔦 ปิดไฟฉาย':'🔦 ไฟฉาย'}catch(error){setNotice('เปิดไฟฉายไม่สำเร็จบนอุปกรณ์นี้','bad')}
}
function summaryPayload(){
  const durationMs=Math.max(0,now()-startedAt);const accuracy=Math.round(score/100*100);return {score,total:100,durationMs,clientPoints:score,answers:[{itemId:'__summary__',kind:'lexicon_lens_hunt',gameId:STAGE_ID,missionCount:MISSION_COUNT,correctContexts,totalScans,cameraUsed:Boolean(stream),score,accuracy,durationMs,missionIds:missions.map(item=>item.id),sourceVersion:VERSION},...records],sourceVersion:VERSION,passportRotation:assignment?.passportRotation,assessmentRotation:assignment?.assessmentRotation,randomSeed:assignment?.randomSeed};
}
async function finishGame(){
  scanEnabled=false;progressBar.style.width='100%';clueText.textContent='Bonus Mission Complete';hintText.textContent='กำลังบันทึก Learning Analytics ไป Firebase';setNotice('ภารกิจครบ 5 จุดแล้ว • กำลังบันทึกผล…','good');
  const payload=summaryPayload();logEvent('lens_game_completed',{score:payload.score,correctContexts,totalScans,durationMs:payload.durationMs});showSummary(payload,false);await saveResult(payload);
}
function showSummary(payload,saved,errorMessage){
  const passed=payload.score>=60;summaryLayer.innerHTML=`<section class="card"><div class="hero">${passed?'🏆':'🔎'}</div><h1>Lexicon Lens Hunt Complete</h1><p style="text-align:center">Bonus Mission ไม่ใช้ล็อก Certificate</p><div class="summary-grid"><div class="stat"><strong>${payload.score}/100</strong><small>Bonus Score</small></div><div class="stat"><strong>${correctContexts}/${MISSION_COUNT}</strong><small>Context Correct</small></div><div class="stat"><strong>${totalScans}</strong><small>QR Scans</small></div><div class="stat"><strong>${Math.round(payload.durationMs/1000)}s</strong><small>เวลา</small></div></div><div class="rule">${saved?'✅ บันทึก Firebase Analytics สำเร็จ'+(savedReceipt?` • ${h(savedReceipt)}`:''):errorMessage?'⚠ '+h(errorMessage):'⏳ กำลังบันทึกผลไป Firebase…'}</div>${errorMessage?'<button id="retrySave" class="btn primary" type="button">ลองบันทึกอีกครั้ง</button>':''}<button id="summaryBack" class="btn secondary" type="button">กลับ Passport</button></section>`;summaryLayer.classList.remove('hidden');el('summaryBack').onclick=goPassport;if(el('retrySave'))el('retrySave').onclick=()=>saveResult(payload);
}
async function saveResult(payload){
  if(saving)return;saving=true;try{
    if(typeof authority?.submitEvent!=='function')throw new Error('FIREBASE_AUTHORITY_NOT_READY');
    const response=await authority.submitEvent({playerId:identity.playerId,stageId:STAGE_ID,eventName:'lens_result_summary',payload:{...payload,passed:payload.score>=60,nickname:identity.nickname||identity.fullName||'Player'},sourceVersion:VERSION});
    if(!response?.ok)throw new Error(response?.error||'SAVE_FAILED');
    if(response.mode!=='firebase')throw new Error(response.firebaseError||'FIREBASE_RECEIPT_REQUIRED');
    savedReceipt=response.eventId||'firebase-event-saved';
    try{
      const key=`ew_bonus_lens_best::${identity.playerId}`;const old=JSON.parse(localStorage.getItem(key)||'null');if(!old||Number(payload.score)>Number(old.score||0))localStorage.setItem(key,JSON.stringify({score:payload.score,receipt:savedReceipt,at:new Date().toISOString()}));
    }catch(_){}
    showSummary(payload,true,'');
  }catch(error){console.error(error);showSummary(payload,false,'บันทึก Firebase ไม่สำเร็จ: '+String(error?.message||error));}finally{saving=false}
}

el('backBtn').onclick=goPassport;el('introBackBtn').onclick=goPassport;el('startBtn').onclick=startCamera;el('manualBtn').onclick=openManual;el('torchBtn').onclick=toggleTorch;window.addEventListener('pagehide',stopCamera);document.addEventListener('visibilitychange',()=>{if(document.hidden)scanEnabled=false;else if(stream&&!questionLayer.classList.contains('hidden'))scanEnabled=false;else if(stream&&current())scanEnabled=true});

(async()=>{const ok=await validateAccess();if(ok){missions=selectMissions();updateHud();logEvent('lens_page_ready',{bankSize:BANK.length,missionCount:MISSION_COUNT,debug:qaBypass()})}})();

window.LEXICON_LENS_HUNT=Object.freeze({VERSION,STAGE_ID,BANK,markerCodes:BANK.map(codeFor)});
}());