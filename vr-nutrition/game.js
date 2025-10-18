// ─── Mouse Laser control (Desktop) ───
(function setupMouseLaser(){
  const scene    = document.querySelector("a-scene");
  const camEl    = document.getElementById("playerCam");
  const mouseRig = document.getElementById("mouseRig");
  const laserEl  = document.getElementById("mouseLaser");
  if(!scene || !camEl || !mouseRig || !laserEl) return;

  // ป้องกันคลิกที่ UI DOM โดนสคริปต์นี้
  const isUiClick = (ev) => {
    const t = ev.target;
    return !!(t.closest && t.closest("#menuBar, .hud, .overlay, .targetBox, button, .btn, .tag"));
  };

  // ใช้ THREE อย่างปลอดภัย (เผื่อบางบราวเซอร์ expose แค่ AFRAME.THREE)
  const THREE_NS = window.THREE || (window.AFRAME && AFRAME.THREE);

  function updateLaser(){
    try{
      // อยู่ใน VR → ซ่อนเลเซอร์เมาส์
      if (scene.is && scene.is("vr-mode")) { laserEl.setAttribute("visible","false"); return; }

      const rc = mouseRig.components && mouseRig.components.raycaster;
      if(!rc) return;
      rc.refreshObjects();
      const hit = rc.intersections && rc.intersections[0];

      if(THREE_NS && hit && hit.point && hit.object && hit.object.el && hit.object.el.classList.contains("clickable")){
        // world position ของกล้อง
        const start = new THREE_NS.Vector3();
        camEl.object3D.getWorldPosition(start);
        const end = hit.point.clone();
        laserEl.setAttribute("line", `start: ${start.x} ${start.y} ${start.z}; end: ${end.x} ${end.y} ${end.z}; color: #0ff`);
        laserEl.setAttribute("visible", "true");
      } else {
        // ถ้าไม่มี THREE ให้ซ่อนเส้น แต่คลิกยังใช้ได้ตามปกติ
        laserEl.setAttribute("visible", "false");
      }
    }catch(e){
      // กัน error ฆ่าโค้ดส่วนอื่น
      laserEl.setAttribute("visible","false");
    }
  }

  // อัปเดตเส้นเมื่อเมาส์ขยับ + fallback interval
  scene.addEventListener("loaded", ()=> {
    scene.addEventListener("mousemove", updateLaser);
  });
  const laserTimer = setInterval(updateLaser, 120);

  // คลิกซ้าย = เลือกเป้าหมายที่เล็งอยู่ (ยกเว้นคลิกบน UI)
  window.addEventListener("mousedown", (e)=>{
    if(e.button !== 0) return;                 // left button only
    if (scene.is && scene.is("vr-mode")) return; // ใน VR ใช้จ้องตามเดิม
    if (isUiClick(e)) return;                  // ให้ปุ่ม UI ทำงานตามปกติ

    try{
      const rc = mouseRig.components.raycaster;
      rc.refreshObjects();
      const hit = rc.intersections && rc.intersections[0];
      if(hit && hit.object && hit.object.el && hit.object.el.classList.contains("clickable")){
        hit.object.el.emit("click");
      }
    }catch(_){}
  }, {capture:false});

  scene.addEventListener("enter-vr", ()=> laserEl.setAttribute("visible","false"));
  scene.addEventListener("exit-vr",  ()=> laserEl.setAttribute("visible","false"));

  // กัน memory leak
  window.addEventListener("beforeunload", ()=> clearInterval(laserTimer));
})();
