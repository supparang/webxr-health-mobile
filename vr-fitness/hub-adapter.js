<script>
/* ======================================================================================
   HUB ADAPTER (Universal) — v1.2
   ใช้ไฟล์เดียวครอบทุกเกมให้ทำงานร่วมกับ Hub หน้าเดียว:
   - รับ "hub:pause" เพื่อ pause/resume เกม (รองรับ A-Frame อัตโนมัติ + hook เสริม)
   - ส่ง "game:ready", "game:score", "game:end" กลับไปให้ Hub ผ่าน postMessage
   - ปลดล็อกเสียงครั้งแรก (Autoplay guard)
   - ไม่ผูกกับ engine ใด ๆ โดยตรง: ถ้าเกมมี window.Game ก็จะเรียก setPaused()/pause()/resume()
   วิธีใช้ในแต่ละเกม:
     1) ใส่ <script src=".../hub-adapter.js"></script> ในหน้าเล่นของเกม (หลังโหลดเอนจิน/เกมหลัก)
     2) จุดอัปเดตคะแนน เรียก  HubScoreTick(score, combo, timeLeft, stars)
     3) ตอนจบเกม เรียก     HubGameEnd({ score, maxCombo, stars, time })
     4) ถ้ามีโค้ด init เสร็จแล้ว ให้เรียก HubGameReady() (หรือปล่อยให้ DOMContentLoaded ส่งให้)
   ====================================================================================== */

(function(){
  // ---------- Utils ----------
  const isAframe = !!document.querySelector("a-scene");
  const scene    = isAframe ? document.querySelector("a-scene") : null;
  const hasGame  = !!window.Game;

  function tryCall(obj, names, ...args){
    for(const n of names){
      const fn = obj && obj[n];
      if(typeof fn === "function"){ try{ return fn.apply(obj, args); }catch(e){} }
    }
    return undefined;
  }

  function unlockAudioOnce(){
    if (window._hubAudioUnlocked) return;
    window._hubAudioUnlocked = true;
    try {
      if(window.Howler && Howler.ctx && Howler.state !== "running"){
        Howler.ctx.resume();
      }
    } catch(e){}
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if(AC){
        const ac = new AC();
        const o  = ac.createOscillator(); o.connect(ac.destination);
        o.start(); o.stop();
        setTimeout(()=>ac.close(), 60);
      }
    } catch(e){}
  }

  // ---------- Pause/Resume bridge ----------
  function setPaused(p){
    // A-Frame
    if(isAframe && scene){
      p ? scene.pause() : scene.play();
    }
    // Game object รูปแบบต่าง ๆ
    if(hasGame){
      // รองรับรูปแบบทั่วไปหลายแบบ
      if(tryCall(window.Game, ["setPaused"], !!p) !== undefined) return;
      if(p){
        if(tryCall(window.Game, ["pause","onPause"]) !== undefined) return;
      }else{
        if(tryCall(window.Game, ["resume","onResume","play"]) !== undefined) return;
      }
    }
    // ถ้าต้องการหยุด loop เอง ให้เกมผูกฟังก์ชันเหล่านี้:
    // window.Game.setPaused = (flag)=>{ ... }
  }

  // ---------- Messaging to Hub ----------
  function postToHub(payload){ try{ parent.postMessage(payload, "*"); }catch(e){} }

  // เรียกเมื่อตัวเกมพร้อมเริ่ม (เรียกอัตโนมัติหลัง DOMContentLoaded; แต่คุณสามารถเรียกเองซ้ำได้)
  function HubGameReady(){ postToHub({ type:"game:ready" }); }
  // ระหว่างเล่น เรียกคาบ ๆ เพื่อให้ Hub แสดง Overlay HUD ได้
  function HubScoreTick(score, combo, timeLeft, stars){
    postToHub({ type:"game:score", score, combo, timeLeft, stars });
  }
  // จบเกมแล้วส่งสรุปผล
  function HubGameEnd(summary){
    // summary = { score, maxCombo, stars, time }
    postToHub(Object.assign({ type:"game:end" }, summary||{}));
  }

  // ----- Expose API ให้เกมเรียกใช้ -----
  window.HubGameReady = HubGameReady;
  window.HubScoreTick = HubScoreTick;
  window.HubGameEnd   = HubGameEnd;

  // ----- รับจาก Hub -----
  window.addEventListener("message", (ev)=>{
    const msg = ev.data||{};
    if(msg.type === "hub:pause"){
      setPaused(!!msg.value);
    }
  });

  // ----- Autoplay Guard: ปลดล็อกเสียงหลัง interaction ครั้งแรก -----
  window.addEventListener("pointerdown", unlockAudioOnce, { once:true, capture:true });

  // ----- ส่ง ready อัตโนมัติเมื่อโหลดเสร็จ -----
  if(document.readyState === "complete" || document.readyState === "interactive"){
    setTimeout(HubGameReady, 0);
  }else{
    window.addEventListener("DOMContentLoaded", HubGameReady, { once:true });
  }

  // ----- ช่วยเพิ่ม: ฟัง page visibility เพื่อพักเองด้วย (ช่วยกรณีเปิดเกมเดี่ยว) -----
  document.addEventListener("visibilitychange", ()=>{
    if(document.hidden) setPaused(true); else setPaused(false);
  });

})();
</script>
