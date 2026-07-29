(()=>{
  'use strict';
  if(window.__HH_CAMERA_START_GUARD__)return;
  window.__HH_CAMERA_START_GUARD__='20260729-CAMERA-START-GUARD-V1';

  const media=navigator.mediaDevices;
  if(!media?.getUserMedia)return;

  const nativeGetUserMedia=media.getUserMedia.bind(media);
  const activeStreams=new Set();
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

  function stopStream(stream){
    if(!stream)return;
    try{stream.getTracks().forEach(track=>track.stop())}catch(_){}
    activeStreams.delete(stream);
  }

  function releaseAll(){
    [...activeStreams].forEach(stopStream);
    const video=document.getElementById('cam');
    const stream=video?.srcObject;
    if(stream)stopStream(stream);
  }

  function readableMessage(error){
    const name=String(error?.name||'');
    const raw=String(error?.message||'');
    if(name==='NotAllowedError'||name==='SecurityError'){
      return 'ยังไม่ได้อนุญาตใช้กล้อง กรุณาอนุญาต Camera ในการตั้งค่าเว็บไซต์แล้วลองใหม่';
    }
    if(name==='NotFoundError'||name==='DevicesNotFoundError'){
      return 'ไม่พบกล้องบนอุปกรณ์นี้';
    }
    if(name==='NotReadableError'||name==='TrackStartError'||/video source/i.test(raw)){
      return 'กล้องกำลังถูกแท็บหรือแอปอื่นใช้งาน กรุณาปิดแท็บเกมเก่าหรือแอปกล้อง แล้วกดเริ่มอีกครั้ง';
    }
    if(name==='OverconstrainedError'||name==='ConstraintNotSatisfiedError'){
      return 'กล้องไม่รองรับค่าที่ร้องขอ และโหมดพื้นฐานยังเปิดไม่สำเร็จ';
    }
    return raw||name||'เปิดกล้องไม่สำเร็จ';
  }

  async function guardedGetUserMedia(requested){
    releaseAll();
    await wait(160);

    const attempts=[
      requested,
      {video:{facingMode:{ideal:'user'}},audio:false},
      {video:true,audio:false}
    ];

    let lastError=null;
    for(let i=0;i<attempts.length;i++){
      if(i)await wait(i===1?420:720);
      try{
        const stream=await nativeGetUserMedia(attempts[i]);
        const track=stream.getVideoTracks?.()[0];
        if(!track||track.readyState!=='live'){
          stopStream(stream);
          throw new DOMException('No live video track','NotReadableError');
        }
        activeStreams.add(stream);
        track.addEventListener('ended',()=>activeStreams.delete(stream),{once:true});
        return stream;
      }catch(error){
        lastError=error;
        if(error?.name==='NotAllowedError'||error?.name==='SecurityError')break;
      }
    }

    throw new DOMException(readableMessage(lastError),'NotReadableError');
  }

  try{
    Object.defineProperty(media,'getUserMedia',{value:guardedGetUserMedia,writable:true,configurable:true});
  }catch(_){
    try{media.getUserMedia=guardedGetUserMedia}catch(__){}
  }

  window.HH_releaseCamera=releaseAll;
  addEventListener('pagehide',releaseAll);
  addEventListener('beforeunload',releaseAll);

  document.addEventListener('click',event=>{
    const target=event.target?.closest?.('#again');
    if(!target)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    releaseAll();
    location.reload();
  },true);
})();
