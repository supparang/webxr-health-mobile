// === /herohealth/vr-goodjunk/goodjunk-vr.enter-vr.js ===
// Map "Enter VR" to Cardboard cVR for DOM-based GoodJunkVR

(function(root){
  'use strict';
  const doc = root.document;
  if(!doc) return;

  function setView(view){
    const b = doc.body;
    b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
    b.classList.add(`view-${view}`);
  }

  async function goCVR(){
    setView('cvr');
    // best-effort fullscreen + landscape lock
    try{ await doc.documentElement.requestFullscreen?.(); }catch(e){}
    try{ await screen.orientation?.lock?.('landscape'); }catch(e){}
    // hint overlay ถ้ามี
    const hint = doc.querySelector('#vrHint');
    if(hint) hint.hidden = false;
  }

  // 1) ปุ่มใน viewbar ของคุณ
  const btn = doc.getElementById('btnEnterVR');
  if(btn){
    btn.addEventListener('click', (e)=>{ e.preventDefault(); goCVR(); }, { passive:false });
  }

  // 2) ปุ่มจาก vr-ui.js (ถ้าคุณใส่ data-vrui="enter-vr" ตามที่แนะนำ)
  doc.addEventListener('click', (e)=>{
    const b = e.target && e.target.closest('[data-vrui="enter-vr"]');
    if(!b) return;
    e.preventDefault();
    goCVR();
  }, { passive:false });

  // 3) รองรับ event (ถ้าใช้ vr-auto-cardboard ส่งมา)
  root.addEventListener('hha:enter_vr', ()=>{ goCVR(); }, { passive:true });

})(window);