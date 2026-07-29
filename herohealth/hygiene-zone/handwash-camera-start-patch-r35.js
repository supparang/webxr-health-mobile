(()=>{
'use strict';
const RELEASE='20260729-HANDWASH-CAMERA-USER-GESTURE-R35';
const NativeBlob=window.Blob;
function patchRuntime(source){
 if(typeof source!=='string'||!source.includes('20260716-HANDWASH-WHO-V4-R1'))return source;
 let out=source;
 const replace=(before,after,label)=>{
  if(!out.includes(before)){console.warn('[Handwash Camera R35] hook missing:',label);return false;}
  out=out.replace(before,after);return true;
 };
 replace('let handsModel = null;','let handsModel=null;let detectionLoopStarted=false;let cameraStarting=false;','camera-state');
 replace("addEventListener('online', flushOutbox);\nstartCamera();\nflushOutbox();","addEventListener('online',flushOutbox);addEventListener('pagehide',stopCamera);\ndocument.documentElement.dataset.handwashCamera='waiting-user';\nel.detectStatus.textContent='แตะเริ่มเพื่อเปิดกล้อง';\nflushOutbox();",'defer-auto-camera');
 replace(
 `function startRun(){
saveProfile();
resetRun(false);
state.running = true;`,
 `async function startRun(){
if(cameraStarting)return;
const cameraOK=await startCamera();
if(!cameraOK){
 state.running=false;
 el.startOverlay.classList.add('show');
 el.startBtn.disabled=false;
 el.startBtn.textContent='ลองเปิดกล้องอีกครั้ง';
 return;
}
saveProfile();
resetRun(false);
state.running = true;`,
 'start-run-camera-gate');
 replace(
 `async function startCamera(){
if (!navigator.mediaDevices?.getUserMedia) {
el.detectStatus.textContent = 'Tap Assist';
return;
}
try{
stream = await navigator.mediaDevices.getUserMedia({
video:{facingMode:'user',width:{ideal:1280},height:{ideal:720}},audio:false
});
el.video.srcObject = stream;
await el.video.play();
state.cameraReady = true;
initHands();
}catch(error){
el.detectStatus.textContent = 'เปิดกล้องไม่ได้';
showToast('ใช้ Tap Assist ได้ แต่ผลจะระบุว่าเป็นโหมดช่วย');
}
}`,
 `async function startCamera(){
if(cameraStarting)return false;
if(stream?.active&&stream.getVideoTracks?.().some(track=>track.readyState==='live')&&el.video.readyState>=2){
 state.cameraReady=true;document.documentElement.dataset.handwashCamera='ready';return true;
}
if(!navigator.mediaDevices?.getUserMedia){
 state.cameraReady=false;document.documentElement.dataset.handwashCamera='unsupported';el.detectStatus.textContent='เครื่องไม่รองรับกล้อง';showToast('อุปกรณ์นี้ไม่รองรับการเปิดกล้อง');return false;
}
cameraStarting=true;state.cameraReady=false;document.documentElement.dataset.handwashCamera='requesting';el.detectStatus.textContent='กำลังเปิดกล้อง…';
try{
 try{stream?.getTracks?.().forEach(track=>track.stop())}catch(_){ }
 stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'user'},width:{ideal:640,max:1280},height:{ideal:480,max:720},frameRate:{ideal:24,max:30}},audio:false});
 el.video.setAttribute('playsinline','');el.video.muted=true;el.video.srcObject=stream;
 await el.video.play();
 const track=stream.getVideoTracks?.()[0];if(!track||track.readyState!=='live')throw new Error('camera_track_not_live');
 track.addEventListener('ended',()=>{state.cameraReady=false;document.documentElement.dataset.handwashCamera='ended';el.detectStatus.textContent='กล้องหยุดทำงาน';},{once:true});
 state.cameraReady=true;document.documentElement.dataset.handwashCamera='ready';el.detectStatus.textContent='กำลังโหลดตัวตรวจมือ…';
 if(!handsModel)initHands();else{state.detectorReady=true;el.detectStatus.textContent='รอมือ 2 ข้าง';if(!detectionLoopStarted){detectionLoopStarted=true;detectLoop();}}
 return true;
}catch(error){
 state.cameraReady=false;const name=String(error?.name||'');const busy=name==='NotReadableError'||name==='AbortError';const denied=name==='NotAllowedError'||name==='SecurityError';
 document.documentElement.dataset.handwashCamera=busy?'busy':denied?'denied':'failed';
 el.detectStatus.textContent=busy?'กล้องถูกแท็บอื่นใช้อยู่':denied?'ยังไม่ได้อนุญาตกล้อง':'เปิดกล้องไม่ได้';
 showToast(busy?'ปิดแท็บเกมเก่า แล้วแตะลองเปิดกล้องอีกครั้ง':denied?'กดอนุญาตใช้กล้อง แล้วแตะลองใหม่':'ตรวจสิทธิ์กล้อง แล้วแตะลองใหม่');
 console.error('[Handwash Camera R35] camera start failed',error);return false;
}finally{cameraStarting=false;}
}`,
 'robust-start-camera');
 replace(
 `state.detectorReady = true;
el.detectStatus.textContent = 'รอมือ 2 ข้าง';
detectLoop();`,
 `state.detectorReady=true;document.documentElement.dataset.handwashDetector='ready';el.detectStatus.textContent='รอมือ 2 ข้าง';if(!detectionLoopStarted){detectionLoopStarted=true;detectLoop();}`,
 'single-detect-loop');
 replace(
 `}catch(error){
el.detectStatus.textContent = 'Tap Assist';
}
}`,
 `}catch(error){state.detectorReady=false;document.documentElement.dataset.handwashDetector='failed';el.detectStatus.textContent='โหลดตัวตรวจมือไม่ได้';showToast('โหลดระบบตรวจมือไม่สำเร็จ กรุณาลองใหม่');console.error('[Handwash Camera R35] detector init failed',error);}
}`,
 'detector-error');
 replace(
 `function stopCamera(){try{stream?.getTracks?.().forEach(t=>t.stop())}catch(_){}}`,
 `function stopCamera(){try{stream?.getTracks?.().forEach(t=>t.stop())}catch(_){ }try{el.video.pause();el.video.srcObject=null}catch(_){ }stream=null;state.cameraReady=false;document.documentElement.dataset.handwashCamera='stopped';}`,
 'stop-camera-release');
 document.documentElement.dataset.handwashCameraPatch=RELEASE;
 console.info('[Handwash Camera R35] compiled runtime patched for user-gesture camera startup');
 return out;
}
function PatchedBlob(parts,options){
 try{
  if(options&&String(options.type||'').includes('javascript')&&Array.isArray(parts)&&parts.length===1&&typeof parts[0]==='string'){
   return new NativeBlob([patchRuntime(parts[0])],options);
  }
 }catch(error){console.error('[Handwash Camera R35] runtime patch failed',error);}
 return new NativeBlob(parts,options);
}
PatchedBlob.prototype=NativeBlob.prototype;Object.setPrototypeOf(PatchedBlob,NativeBlob);window.Blob=PatchedBlob;
document.documentElement.dataset.handwashCameraPatch=RELEASE;
})();