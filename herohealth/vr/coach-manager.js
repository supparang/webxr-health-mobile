// === /herohealth/vr/coach-manager.js ===
// HeroHealth Coach Manager — PRODUCTION (Distinct per game)
// ✅ Auto-picks coach image set per game by URL/path or query gameMode
// ✅ Binds #coach-img / #coach-text / #coach-sub (optional)
// ✅ Reacts to events: hha:coach, hha:score, hha:judge, hha:end
// ✅ Uses images in /herohealth/img
//    Required global fallback: coach-fever.png, coach-happy.png, coach-neutral.png, coach-sad.png
//    Optional per game: hydration-*, plate-*, groups-*, goodjunk-* (same suffix set)

(function () {
  'use strict';

  const D = document;
  const elImg  = D.getElementById('coach-img');
  const elText = D.getElementById('coach-text');
  const elSub  = D.getElementById('coach-sub');

  if (!elImg && !elText && !elSub) return;

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function now(){ return (typeof performance!=='undefined' && performance.now) ? performance.now() : Date.now(); }

  // ---- detect game ----
  function detectGame(){
    const url = (location.pathname || '').toLowerCase();
    const q = new URL(location.href).searchParams;
    const gm = String(q.get('gameMode') || q.get('game') || '').toLowerCase();
    if (gm) return gm;

    if (url.includes('hydration')) return 'hydration';
    if (url.includes('plate')) return 'plate';
    if (url.includes('groups')) return 'groups';
    if (url.includes('goodjunk')) return 'goodjunk';
    return 'herohealth';
  }
  const GAME = detectGame();

  // ---- persona text per game ----
  const PERSONA = {
    hydration: {
      name:'Coach Aqua',
      start:'คุม GREEN ให้นิ่งก่อนนะ 💧',
      hint:'Tip: เก็บ 🛡️ ไว้ BLOCK ตอนท้ายพายุ',
      hype:'มันส์มาก! คุมโซนได้แล้ว! ✅',
      warn:'ระวัง BAD 🥤 อย่ารัวเกิน!',
      endWin:'ท้ายพายุแล้ว! เล็งแล้วค่อย BLOCK 🛡️',
      perfect:'PERFECT! จังหวะสวย ⚡'
    },
    plate: {
      name:'Chef Balance',
      start:'จัดจานให้บาลานซ์! 🍽️',
      hint:'Tip: เล็งหมวดให้ชัวร์ก่อน แล้วค่อยสปีด',
      hype:'บาลานซ์โคตรดี! 🔥',
      warn:'อย่าสับสนหมวดนะ! 👀',
      endWin:'ใกล้หมดเวลา! รีบแต่ต้องแม่น ⚡',
      perfect:'จัดจานเป๊ะ! ⭐'
    },
    groups: {
      name:'Captain Groups',
      start:'แยกหมวดอาหารให้แม่น! 🧠',
      hint:'Tip: ดูไอคอนก่อนยิง 0.3 วิ',
      hype:'จำหมวดได้ไวมาก! 🚀',
      warn:'ช้าลงนิดนึง แล้วค่อยยิง 🎯',
      endWin:'ช่วงท้าย! โฟกัสหมวดให้ถูก ✅',
      perfect:'ช็อตนี้โคตรแม่น! 🎯'
    },
    goodjunk: {
      name:'Coach Clean',
      start:'เก็บ GOOD หลบ JUNK! 🥦🥤',
      hint:'Tip: อย่ายิงมั่ว เลือกเป้าที่ชัวร์',
      hype:'สายคลีนตัวจริง! 🏆',
      warn:'JUNK มา! กันพลาดด้วย 🛡️',
      endWin:'ท้ายเกม! อย่าโดน JUNK เด็ดขาด 🔥',
      perfect:'หลบ/บล็อกสวยมาก! ⚡'
    },
    herohealth: {
      name:'Coach Hero',
      start:'เล็งกลางจอ แล้วค่อยยิง 🎯',
      hint:'Tip: ช้าแต่ชัวร์ = คะแนนพุ่ง',
      hype:'ดีมาก! ต่อเลย! 🔥',
      warn:'ระวังพลาดนะ!',
      endWin:'ใกล้หมดเวลาแล้ว!',
      perfect:'PERFECT! ⭐'
    }
  };

  const P = PERSONA[GAME] || PERSONA.herohealth;

  // ---- image resolver ----
  function imgPath(mood){
    const base = './img/';
    const suf =
      mood === 'happy' ? 'happy' :
      mood === 'sad' ? 'sad' :
      mood === 'fever' ? 'fever' :
      'neutral';

    const tryGame = `${base}${GAME}-${suf}.png`;
    const fallback = `${base}coach-${suf}.png`;
    return { tryGame, fallback };
  }

  function setImg(mood){
    if (!elImg) return;
    const { tryGame, fallback } = imgPath(mood);
    elImg.onerror = () => {
      elImg.onerror = null;
      elImg.src = fallback;
    };
    elImg.src = tryGame;
  }

  function setText(text, sub){
    if (elText && text != null) elText.textContent = String(text);
    if (elSub && sub != null) elSub.textContent = String(sub);
  }

  // ---- mood + spam guard ----
  let mood = 'neutral';
  let lastSayAt = 0;
  const SAY_GAP = 1100;

  function setMood(m){
    m = String(m||'neutral').toLowerCase();
    if (!['neutral','happy','sad','fever'].includes(m)) m='neutral';
    if (mood === m) return;
    mood = m;
    setImg(mood);
  }

  function say(text, sub){
    const t = now();
    if (t - lastSayAt < SAY_GAP) return;
    lastSayAt = t;
    setText(text, sub);
  }

  // ---- init ----
  setImg('neutral');
  if (elText && !String(elText.textContent||'').trim()) elText.textContent = P.start;
  if (elSub && !String(elSub.textContent||'').trim()) elSub.textContent = `${P.hint} • ${P.name}`;

  // ---- derived signals from score ----
  let lastScore = 0;
  let lastMiss = 0;
  let lastCombo = 0;

  // hha:coach (from ai-coach.js or game)
  window.addEventListener('hha:coach', (ev)=>{
    const d = ev.detail || {};
    if (d.mood) setMood(d.mood);
    if (d.text) {
      const sub = (d.sub != null) ? d.sub : (elSub ? elSub.textContent : '');
      say(d.text, sub);
    }
  }, { passive:true });

  // hha:judge (from game engine)
  window.addEventListener('hha:judge', (ev)=>{
    const d = ev.detail || {};
    const k = String(d.kind||'').toLowerCase();

    if (k === 'bad'){
      setMood('sad');
      say(P.warn, 'โฟกัส + เก็บ 🛡️ ไว้กัน');
      return;
    }
    if (k === 'good'){
      setMood('happy');
      say(P.hype, P.hint);
      return;
    }
    if (k === 'shield'){
      setMood('neutral');
      say('เยี่ยม! ได้ 🛡️', 'เก็บไว้ใช้ช่วงท้าย/ช่วงโหด');
      return;
    }
    if (k === 'perfect'){
      setMood('happy');
      say(P.perfect, 'จังหวะแบบนี้แหละ!');
      return;
    }
    if (k === 'streak'){
      setMood('happy');
      say('STREAK! 🔥', 'คอมโบกำลังมา!');
      return;
    }
    if (k === 'storm'){
      setMood('neutral');
      say('STORM มาแล้ว! 🌀', 'เตรียมทำ MINI ช่วงท้าย');
      return;
    }
    if (k === 'block'){
      setMood('neutral');
      say('BLOCK ✅', 'ดี! ถ้าช่วงท้ายจะนับ MINI');
      return;
    }
  }, { passive:true });

  // hha:score (continuous)
  window.addEventListener('hha:score', (ev)=>{
    const d = ev.detail || {};
    const score = Number(d.score||0);
    const miss  = Number(d.misses||0);
    const combo = Number(d.combo||0);
    const storm = !!d.stormActive;
    const left  = Number(d.stormLeftSec||0);

    // fever proxy: misses -> fever mood
    const fever = clamp(miss * 18, 0, 100);

    if (fever >= 70) setMood('fever');
    else if (miss > lastMiss) setMood('sad');
    else if (score > lastScore || combo > lastCombo) setMood('happy');
    else setMood('neutral');

    lastScore = score;
    lastMiss = miss;
    lastCombo = combo;

    const t = now();
    if (t - lastSayAt > 1700){
      if (storm){
        if (left <= 2.2) say(P.endWin, 'เล็งแล้วค่อย BLOCK / เก็บแต้มชัวร์');
        else say('STORM กำลังมา 🌀', 'เก็บ 🛡️ แล้วเตรียมช่วงท้าย');
      } else {
        // light idle encouragement
        if (combo >= 6) say('คอมโบโหดมาก! ⚡', 'อย่าพลาด BAD');
      }
    }
  }, { passive:true });

  // hha:end (summary)
  window.addEventListener('hha:end', (ev)=>{
    const d = ev.detail || {};
    const g = String(d.grade||'C').toUpperCase();
    if (g === 'SSS' || g === 'SS' || g === 'S'){
      setMood('happy');
      say(`โคตรเก่ง! ได้เกรด ${g} 🏆`, 'ลองโหมดโหดขึ้นมั้ย?');
    } else if (g === 'A' || g === 'B'){
      setMood('neutral');
      say(`ดีมาก! เกรด ${g} ✅`, 'เพิ่มความแม่น + ลด MISS อีกนิด');
    } else {
      setMood('sad');
      say(`ไม่เป็นไร เกรด ${g} 😅`, 'ช้าแต่ชัวร์ แล้วจะดีขึ้นเร็วมาก');
    }
  }, { passive:true });

})();