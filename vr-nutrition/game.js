(() => {
  const $  = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ... (โค้ดเดิมของคุณทั้งชุด 4 โหมด เหมือนเวอร์ชันก่อนหน้า) ...
  // 👉 จุดสำคัญ: เพิ่ม 3 อย่างนี้

  // 1) ฟังก์ชันยูทิลิตี้โชว์/ซ่อนสรุปผลแบบไม่กินคลิก
  function showSummary() { $("#summary").classList.add("show"); }
  function hideSummary() { $("#summary").classList.remove("show"); }

  // 2) ปรับ lifecycle ให้คุมการบล็อกคลิกฉาก
  const sceneEl = () => $("#scene");

  function startGame(){
    // (บล็อกเดิมของ startGame ที่คุณมีอยู่แล้ว) ...
    // --- เริ่มจากค่าเริ่มต้น/ตั้ง target/plate quota/รีเซ็ต HUD ตามเดิม ---

    // ปลดบล็อกคลิกให้ฉาก เพื่อให้ยิงในฉากได้
    sceneEl() && sceneEl().classList.remove("blocked");
    $("#summary").classList.remove("show");
    // เรียก loop()/timerTick() ตามเดิม
  }

  function pauseGame(){
    // (โค้ดเดิม pause)
  }

  function endGame(){
    // (โค้ดสรุปคะแนนเดิม) ...
    $("#summary").classList.add("show");
    // หลังจบเกม กลับไปบล็อกคลิกฉาก เพื่อให้คลิก UI ได้ง่าย
    sceneEl() && sceneEl().classList.add("blocked");
  }

  // 3) GLOBAL UI FALLBACK (ให้ปุ่มใน index เรียกได้ชัวร์)
  function _how(){
    const th = {
      goodjunk: "จ้อง/คลิก อาหารที่ดี (ผลไม้ ผัก น้ำ) หลีกเลี่ยงขยะ (เบอร์เกอร์ โซดา โดนัท) รักษาคอมโบ!",
      groups:   "ดู 'หมู่เป้าหมาย' มุมขวาบน แล้วเก็บอาหารที่อยู่ในหมู่นั้น",
      hydration:"เก็บ 💧 น้ำเปล่า! หลีกเลี่ยงโซดา/ขนมหวาน เก็บต่อเนื่องได้เวลาบวก",
      plate:    "เก็บตามโควตา Plate (ขวาบน) ครบชุดรับโบนัส!"
    };
    const en = {
      goodjunk: "Gaze/click healthy foods; avoid junk. Keep combo!",
      groups:   "Follow the 'Target Group' (top-right) and collect foods from that group.",
      hydration:"Collect water! Avoid soda/sugary snacks. Streak adds extra time.",
      plate:    "Fill the plate quota (top-right). Completing a set gives bonus!"
    };
    const msg = (window.APP_VR_NUTRITION?.lang === "th" ? th : en)[window.APP_VR_NUTRITION?.mode || "goodjunk"];
    alert(msg);
  }

  window.GAME_UI = {
    start:  () => startGame(),
    pause:  () => pauseGame(),
    restart:() => { hideSummary(); /* รีเซ็ตสถานะเดิมก่อนเริ่มใหม่ */ 
                    // เคลียร์ตัวจับเวลา/รีเซ็ตตัวแปรตามบล็อกเดิม แล้ว:
                    startGame(); },
    how:    () => _how(),
    setMode:(m)=> { typeof setMode==="function" ? setMode(m) : (window.APP_VR_NUTRITION.mode=m); },
    setDiff:(d)=> { typeof setDiff==="function" ? setDiff(d) : (window.APP_VR_NUTRITION.difficulty=d); 
                    $("#difficulty").textContent = window.APP_VR_NUTRITION.difficulty; },
    toggleLang: () => {
      const app = window.APP_VR_NUTRITION; app.lang = (app.lang==="th"?"en":"th");
      localStorage.setItem("vrn_lang", app.lang);
      if (typeof applyLang==="function") applyLang();
    },
    toggleVoice: () => {
      const app = window.APP_VR_NUTRITION; app.voiceOn = !app.voiceOn;
      localStorage.setItem("vrn_voiceOn", JSON.stringify(app.voiceOn));
      if (typeof applyLang==="function") applyLang();
    }
  };

  // ----------------------------------------------------------
  // NOTE:
  // - ให้แน่ใจว่าในโค้ดเดิมของคุณ เรียก endGame()/pauseGame()/startGame()
  //   ที่ประกาศไว้ข้างบนแทนตัวเก่า (หรือย้ายบอดี้เดิมมาใส่ฟังก์ชันเหล่านี้)
  // - ถ้าไฟล์ของคุณมีชื่อฟังก์ชันซ้ำ ให้ใช้ชื่อเดียวกันเพื่อแทนที่
  // ----------------------------------------------------------
})();
