
/* Shared app helpers for VR Hygiene Pack */
window.APP = {
  lang: localStorage.getItem("lang") || "th",
  setLang(l){ this.lang = l; localStorage.setItem("lang", l); this.updateTexts(); },
  t(key){
    const dict = {
      th: {
        title: "Healthy Hero VR: อนามัยส่วนบุคคล",
        subtitle: "ศูนย์กลางเกม (Hub) – วิทยาศาสตร์ทันสมัย",
        start: "เริ่ม",
        howto: "วิธีเล่น",
        settings: "ตั้งค่า",
        back: "กลับ",
        difficulty: "ความยาก",
        easy: "ง่าย", normal: "ปกติ", hard: "ยาก",
        time: "เวลา", score: "คะแนน", stars: "ดาว",
        language: "ภาษา",
        thai: "ไทย", english: "อังกฤษ",
        play: "เข้าเล่น",
        handwash: "ล้างมือ 7 ขั้น",
        oral: "สุขภาพช่องปาก",
        foodsafety: "สุขลักษณะอาหาร",
        disease: "การป้องกันโรค",
        summary: "สรุปผล",
        tips: "คำแนะนำ",
        again: "เล่นอีกครั้ง",
        exit: "ออกสู่หน้าหลัก",
        timer_mode: "โหมดจับเวลา",
        practice_mode: "โหมดฝึก",
        toggle_vr: "Enter VR ในมุมบนซ้าย",
        ok: "ตกลง",
        good: "ดีมาก!", great: "เยี่ยม!",
        miss: "พลาด",
        select_mode: "เลือกโหมด",
        select_diff: "เลือกระดับความยาก",
        th_en: "ไทย/อังกฤษ",
      },
      en: {
        title: "Healthy Hero VR: Personal Hygiene",
        subtitle: "Hub – Modern Science Theme",
        start: "Start",
        howto: "How to Play",
        settings: "Settings",
        back: "Back",
        difficulty: "Difficulty",
        easy: "Easy", normal: "Normal", hard: "Hard",
        time: "Time", score: "Score", stars: "Stars",
        language: "Language",
        thai: "Thai", english: "English",
        play: "Play",
        handwash: "Handwash 7 Steps",
        oral: "Oral Health",
        foodsafety: "Food Safety",
        disease: "Disease Prevention",
        summary: "Summary",
        tips: "Tips",
        again: "Play Again",
        exit: "Exit to Hub",
        timer_mode: "Timed Mode",
        practice_mode: "Practice Mode",
        toggle_vr: "Use Enter VR (top-left)",
        ok: "OK",
        good: "Good!", great: "Great!",
        miss: "Miss",
        select_mode: "Choose Mode",
        select_diff: "Select Difficulty",
        th_en: "TH/EN",
      }
    };
    return dict[this.lang][key] || key;
  },
  updateTexts(){
    document.querySelectorAll("[data-i18n]").forEach(el=>{
      const key = el.getAttribute("data-i18n");
      el.textContent = APP.t(key);
    });
  },
  formatTime(sec){
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec/60);
    const s = sec%60;
    return `${m}:${s.toString().padStart(2,"0")}`;
  },
  stars(score,max){
    const p = max>0? (score/max): 0;
    if(p>=0.85) return 3;
    if(p>=0.6) return 2;
    if(p>=0.3) return 1;
    return 0;
  },
  vibrate(ms=40){ if(navigator.vibrate) navigator.vibrate(ms); },
  // basic sfx stub (no external files, using WebAudio beep)
  beep(freq=880, dur=0.08){
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(); const g = ac.createGain();
      o.type="square"; o.frequency.value=freq; o.connect(g); g.connect(ac.destination);
      g.gain.setValueAtTime(0.08, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime+dur);
      o.start(); o.stop(ac.currentTime+dur);
    } catch(e){}
  }
};

document.addEventListener("DOMContentLoaded", ()=>APP.updateTexts());

// Simple A-Frame helpers
AFRAME.registerComponent('clickable',{
  init(){
    this.el.setAttribute('class',(this.el.getAttribute('class')||"") + " clickable");
    this.el.addEventListener('click',()=>{
      APP.vibrate(15); APP.beep(880,0.05);
    });
  }
});

// Gaze cursor for mobile/VR
AFRAME.registerComponent('hud-label',{
  schema:{ text:{default:""}, y:{default:1.6} },
  init(){
    const t = this.data.text;
    const el = document.createElement('a-entity');
    el.setAttribute('text',`value:${t}; align:center; color:#fff; width:2.4`);
    el.setAttribute('position',`0 ${this.data.y} -1.6`);
    this.el.appendChild(el);
  }
});
