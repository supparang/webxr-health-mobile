/* === /herohealth/vr/coach-manager.js ===
HeroHealth Coach Manager — FULL GAME (PRODUCTION)
✅ Per-game unique coach identity (name/emoji/style/lines)
✅ Auto-detect gameKey from URL + optional override (?game=hydration)
✅ Mood: happy / neutral / sad / fever (+ optional: hype/panic as overlay text)
✅ Listens to: hha:score, hha:judge, quest:update, hha:storm, hha:end
✅ Smart image lookup:
   1) ./img/coach/<game>/<mood>.png
   2) ./img/<game>-<mood>.png (your current)
   3) ./img/coach-<mood>.png  (fallback standard)
✅ Safe: if elements missing → no crash
*/
(function (root){
  'use strict';

  const DOC = root.document;
  if (!DOC) return;

  // ---------------------- helpers ----------------------
  function qs(name, def){
    try{ return (new URL(location.href)).searchParams.get(name) ?? def; }catch{ return def; }
  }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function now(){ return performance.now(); }
  function setText(el, t){ try{ if(el) el.textContent = String(t); }catch{} }
  function setHTML(el, t){ try{ if(el) el.innerHTML = String(t); }catch{} }

  // ---------------------- detect game ----------------------
  function detectGameKey(){
    const override = String(qs('game','')||'').toLowerCase().trim();
    if (override) return override;

    const p = String(location.pathname||'').toLowerCase();
    // match your repo routes
    if (p.includes('hydration')) return 'hydration';
    if (p.includes('vr-groups') || p.includes('groups')) return 'groups';
    if (p.includes('plate')) return 'plate';
    if (p.includes('goodjunk')) return 'goodjunk';
    return 'default';
  }

  const gameKey = detectGameKey();

  // ---------------------- DOM binds ----------------------
  // รองรับทั้ง coachCard (แบบ hydration html) และ HUD กลางอื่น ๆ
  const coachImg =
    DOC.getElementById('coach-img') ||
    DOC.querySelector('.coachCard img') ||
    DOC.querySelector('[data-coach-img]') ||
    null;

  const coachText =
    DOC.getElementById('coach-text') ||
    DOC.querySelector('.coachText') ||
    DOC.querySelector('[data-coach-text]') ||
    null;

  const coachSub =
    DOC.getElementById('coach-sub') ||
    DOC.querySelector('.coachSub') ||
    DOC.querySelector('[data-coach-sub]') ||
    null;

  // ถ้าเกมบางไฟล์ยังไม่มีรูป/กล่องโค้ช → ก็ยังทำงานส่วนอื่นได้ (ไม่พัง)
  // ---------------------- style inject (soft animation) ----------------------
  (function inject(){
    const id='hha-coach-style';
    if (DOC.getElementById(id)) return;
    const st = DOC.createElement('style');
    st.id=id;
    st.textContent = `
      .hha-coach-pulse{ animation: hhaCoachPulse .45s ease-out 1; }
      @keyframes hhaCoachPulse{
        0%{ transform: translateZ(0) scale(1); filter:saturate(1) brightness(1); }
        50%{ transform: translateZ(0) scale(1.02); filter:saturate(1.18) brightness(1.08); }
        100%{ transform: translateZ(0) scale(1); filter:saturate(1) brightness(1); }
      }
      .hha-coach-shake{ animation: hhaCoachShake .25s linear 1; }
      @keyframes hhaCoachShake{
        0%{ transform: translateZ(0) translateX(0); }
        25%{ transform: translateZ(0) translateX(2px); }
        50%{ transform: translateZ(0) translateX(-2px); }
        75%{ transform: translateZ(0) translateX(2px); }
        100%{ transform: translateZ(0) translateX(0); }
      }
    `;
    DOC.head.appendChild(st);
  })();

  function pulse(){
    const card = coachText ? coachText.closest('.coachCard') : null;
    if (!card) return;
    card.classList.remove('hha-coach-pulse');
    void card.offsetWidth;
    card.classList.add('hha-coach-pulse');
  }
  function shake(){
    const card = coachText ? coachText.closest('.coachCard') : null;
    if (!card) return;
    card.classList.remove('hha-coach-shake');
    void card.offsetWidth;
    card.classList.add('hha-coach-shake');
  }

  // ---------------------- per-game identity (unique) ----------------------
  // คุณสามารถปรับคำพูดให้เข้ากับธีมเกมได้เต็มที่
  const GAME = {
    hydration: {
      name: 'Hydra Coach',
      icon: '💧',
      tagline: 'คุม GREEN ให้เนียน • ใช้ Shield แบบมีจังหวะ',
      tips: [
        'ยิง 💧 ติด ๆ เพื่อดันน้ำเข้ากลาง',
        'เก็บ 🛡️ ไว้สำหรับท้าย Storm',
        'ท้ายพายุคือเวลา “ทำแต้ม”',
      ],
      lines: {
        start: 'พร้อมลุย! คุม GREEN ให้ครบ แล้วค่อยไปโหดใน Storm 💧',
        happy: 'โคตรดี! คุมจังหวะได้แล้ว 💚',
        neutral: 'นิ่งไว้… โฟกัสกลางจอ 🎯',
        sad: 'ระวัง MISS! เก็บ Shield ก่อนนะ 🛡️',
        fever: 'เดือดแล้ว! อย่าแตกจังหวะ 😵‍💫',
        stormIn: 'STORM มาแล้ว! เตรียม “โหมดโหด” 🌀',
        stormEnd: 'ท้ายพายุ! ใช้ Shield BLOCK ตอนนี้!! ⚠️',
        perfect: 'PERFECT! จังหวะเทพมาก ⚡',
        streak: 'STREAK! ยิงต่อเนื่องแบบนี้แหละ 🔥'
      }
    },

    groups: {
      name: 'Food Master',
      icon: '🥗',
      tagline: 'จับคู่หมู่อาหารให้ไว • กันหลอก/สลับ/สตัน',
      tips: [
        'อ่านไอคอนให้ทันก่อนยิง',
        'ระวัง decoy / swap',
        'คอมโบคือคะแนนหลัก',
      ],
      lines: {
        start: 'วันนี้เราจะเป็นเซียน 5 หมู่! 🥗',
        happy: 'แม่นมาก! จำหมู่ได้แล้วนี่ 💯',
        neutral: 'ตั้งสติ… ดูหมู่ก่อนยิง 👀',
        sad: 'พลาดได้ แต่อย่าเผลอยิงมั่ว 😅',
        fever: 'หัวร้อนแล้ว! หายใจลึก ๆ 😤',
        stormIn: 'โหมดปั่นมา! ระวังสลับ/หลอก 🌪️',
        stormEnd: 'โค้งสุดท้าย! ยิงที่ชัวร์เท่านั้น! ⚠️',
        perfect: 'คมจัด! จำได้จริง! ✨',
        streak: 'ต่อเนื่องโหดมาก! 🔥'
      }
    },

    plate: {
      name: 'Plate Guardian',
      icon: '🍽️',
      tagline: 'บาลานซ์จาน • จบมินิให้ไว • ห้ามพลาดขยะ',
      tips: [
        'เล็งให้ตรงก่อนยิง',
        'มินิช่วงเวลาสั้น = ต้องเร็วและนิ่ง',
        'อย่าให้ HUD บังเป้า',
      ],
      lines: {
        start: 'จัดจานให้เป๊ะ! 🍽️',
        happy: 'บาลานซ์สวย! ไปต่อเลย 🌟',
        neutral: 'โฟกัส… ทีละเป้า 🎯',
        sad: 'ช้าลงนิด แต่อย่า MISS ซ้ำ 😵',
        fever: 'แตกแล้ว! รีเซ็ตจังหวะเดี๋ยวนี้ 💢',
        stormIn: 'เข้าช่วงเร่งสปีด! ⏱️',
        stormEnd: 'ท้ายรอบ! เก็บแต้มให้สุด! ⚠️',
        perfect: 'Perfect plate! 🏆',
        streak: 'สตรีคโหด! 🔥'
      }
    },

    goodjunk: {
      name: 'Junk Buster',
      icon: '🚫',
      tagline: 'เก็บดี • หลีกขยะ • ชนะด้วยวินัย',
      tips: [
        'อย่าหลงไปยิง junk',
        'ใช้ Shield กันจังหวะพลาด',
        'คุม miss ให้ต่ำที่สุด',
      ],
      lines: {
        start: 'เกมนี้วัดวินัย! 🚫',
        happy: 'สะอาดมาก! ดีจัด! ✅',
        neutral: 'ชัวร์ก่อนยิง… อย่าหลง 🧠',
        sad: 'เริ่มพลาดแล้วนะ ระวัง! 😬',
        fever: 'โหมดเดือด! ห้ามพลาดซ้ำ! 🔥',
        stormIn: 'จังหวะโหดมาแล้ว! ⚡',
        stormEnd: 'ท้ายรอบ! อย่าเผลอแตะ junk! ⚠️',
        perfect: 'Perfect discipline! ✨',
        streak: 'สตรีคสวย! 🔥'
      }
    },

    default: {
      name: 'Hero Coach',
      icon: '🧠',
      tagline: 'เล่นให้สนุก • วัดสกิล • เก็บข้อมูลวิจัยได้',
      tips: ['โฟกัสที่เป้า', 'อย่ายิงมั่ว', 'คอมโบคือเพื่อนรัก'],
      lines: {
        start: 'เริ่มเลย! 🎮',
        happy: 'เยี่ยม!',
        neutral: 'ไปต่อ',
        sad: 'ระวังพลาด',
        fever: 'โหมดเดือด!'
      }
    }
  };

  const C = GAME[gameKey] || GAME.default;

  // ---------------------- image resolver (supports your current filenames) ----------------------
  function candidateImages(mood){
    // 1) organized folder
    const a = `./img/coach/${gameKey}/${mood}.png`;
    // 2) your current flat naming
    const b = `./img/${gameKey}-${mood}.png`;
    // 3) legacy/global set (you have: coach-happy.png etc.)
    const c = `./img/coach-${mood}.png`;
    // 4) if someone still uses /herohealth/img/coach/<mood>.png
    const d = `./img/coach/${mood}.png`;
    return [a,b,c,d];
  }

  function resolveImage(mood){
    mood = String(mood||'neutral').toLowerCase();
    const list = candidateImages(mood);

    return new Promise(resolve=>{
      let i=0;
      (function test(){
        if (i>=list.length) return resolve('');
        const url = list[i++];
        const img = new Image();
        img.onload = ()=> resolve(url);
        img.onerror = ()=> test();
        img.src = url + (url.includes('?') ? '' : `?v=${Date.now()}`); // cache bust safe
      })();
    });
  }

  // ---------------------- mood engine ----------------------
  const S = {
    mood: 'neutral',
    lastLineAt: 0,
    lastKindAt: 0,
    lastScore: null,
    lastJudge: null,
    stormActive: false,
    stormLeft: 0,
    inEndWindow: false,
    combo: 0,
    misses: 0,
    grade: 'C',
    acc: 0,
    shield: 0,
    greenHold: null
  };

  // “คุมอารมณ์” จากภาพรวม
  function moodFromScore(d){
    const misses = Number(d.misses ?? d.miss ?? 0) || 0;
    const combo  = Number(d.combo ?? 0) || 0;
    const grade  = String(d.grade ?? 'C');
    const acc    = Number(d.accuracyGoodPct ?? d.accuracy ?? 0) || 0;

    // fever: miss หนัก/ยาว หรือ acc ต่ำมาก
    if (misses >= 12 || acc < 45) return 'fever';
    // sad: เริ่มพลาด/คอมโบไม่ขึ้น
    if (misses >= 6 || (combo<=1 && acc < 60)) return 'sad';
    // happy: คอมโบดี/เกรดดี/แม่น
    if (combo >= 8 || grade === 'S' || grade === 'SS' || grade === 'SSS' || acc >= 85) return 'happy';
    return 'neutral';
  }

  function setCoachLine(text, sub){
    if (coachText) setText(coachText, text);
    if (coachSub)  setText(coachSub, sub ?? C.tagline);
  }

  async function setCoachMood(mood, lineKey, forceLine){
    mood = String(mood||'neutral').toLowerCase();
    if (!['happy','neutral','sad','fever'].includes(mood)) mood = 'neutral';

    const t = now();
    const allowLine = forceLine || (t - S.lastLineAt > 650); // กันสแปมคำพูด
    if (allowLine){
      const line =
        (lineKey && C.lines && C.lines[lineKey]) ? C.lines[lineKey] :
        (C.lines && C.lines[mood]) ? C.lines[mood] :
        (C.lines && C.lines.neutral) ? C.lines.neutral :
        (C.lines && C.lines.start) ? C.lines.start :
        'ไปต่อ!';
      setCoachLine(`${C.icon} ${line}`, C.tagline);
      S.lastLineAt = t;
    }

    if (S.mood === mood) {
      // แค่ pulse เบา ๆ
      pulse();
      return;
    }

    S.mood = mood;
    pulse();

    if (coachImg){
      const src = await resolveImage(mood);
      if (src) coachImg.src = src;
    }
  }

  // ---------------------- event hooks ----------------------
  // start default
  setCoachLine(`${C.icon} ${C.lines.start}`, C.tagline);
  setCoachMood('neutral', null, false);

  // hha:judge (instant feedback)
  root.addEventListener('hha:judge', (ev)=>{
    const d = ev.detail || {};
    const kind = String(d.kind || '');

    // เอฟเฟกต์ตามเหตุการณ์
    if (kind === 'bad'){ shake(); setCoachMood('sad', 'sad', true); }
    if (kind === 'good'){ setCoachMood(S.mood === 'fever' ? 'sad' : S.mood, 'neutral', false); }
    if (kind === 'shield' || kind === 'block'){ setCoachMood('happy', 'perfect', true); }
    if (kind === 'perfect'){ setCoachMood('happy', 'perfect', true); }
    if (kind === 'streak'){ setCoachMood('happy', 'streak', true); }

    // storm enter (บางเกมส่ง judge storm-in)
    if (kind === 'storm-in'){ setCoachMood('neutral', 'stormIn', true); }
  }, { passive:true });

  // hha:storm (บางเกม emit แยก)
  root.addEventListener('hha:storm', (ev)=>{
    const d = ev.detail || {};
    const st = String(d.state||'');
    if (st === 'enter'){ setCoachMood('neutral', 'stormIn', true); }
    if (st === 'exit'){ setCoachMood('happy', 'happy', true); }
  }, { passive:true });

  // hha:score (main driver)
  root.addEventListener('hha:score', (ev)=>{
    const d = ev.detail || {};
    S.stormActive = !!d.stormActive;
    S.stormLeft = Number(d.stormLeftSec ?? 0) || 0;

    // บางเกมส่งมาเป็น stormInEndWindow แล้วดีมาก
    // ถ้าไม่ส่ง → คำนวณเองจาก stormLeft (<= 1.2s ถือว่า end window)
    const inferredEnd = (S.stormActive && S.stormLeft <= 1.2 + 0.05);
    S.inEndWindow = !!d.stormInEndWindow || inferredEnd;

    S.combo  = Number(d.combo ?? 0) || 0;
    S.misses = Number(d.misses ?? 0) || 0;
    S.grade  = String(d.grade ?? 'C');
    S.acc    = Number(d.accuracyGoodPct ?? 0) || 0;
    S.shield = Number(d.shield ?? 0) || 0;

    // storm talk
    if (S.stormActive && S.inEndWindow){
      setCoachMood('fever', 'stormEnd', false);
      return;
    }
    if (S.stormActive && S.stormLeft > 0 && S.stormLeft <= 5.0){
      setCoachMood('neutral', 'stormIn', false);
      return;
    }

    // normal mood inference
    const m = moodFromScore(d);
    setCoachMood(m, null, false);
  }, { passive:true });

  // quest:update (optionally echo goal/mini)
  root.addEventListener('quest:update', (ev)=>{
    const d = ev.detail || {};
    // ถ้าอยากให้โค้ชพูดบ้างเป็นช่วง ๆ
    const t = now();
    if (t - S.lastLineAt < 900) return;

    // กระตุ้นตอน goal ใกล้จบ
    const goalNow = Number(d.goalNow ?? 0) || 0;
    const goalNeed = Number(d.goalNeed ?? 0) || 0;
    if (goalNeed > 0){
      const pct = clamp(goalNow/goalNeed, 0, 1);
      if (pct >= 0.85 && pct < 1.0){
        setCoachLine(`${C.icon} ใกล้แล้ว! อีกนิดเดียว! 🔥`, C.tagline);
        S.lastLineAt = t;
      }
      if (pct >= 1.0){
        setCoachLine(`${C.icon} GOAL สำเร็จ! สวยมาก! 🏁`, C.tagline);
        S.lastLineAt = t;
        setCoachMood('happy', 'happy', false);
      }
    }
  }, { passive:true });

  // hha:end (final)
  root.addEventListener('hha:end', (ev)=>{
    const d = ev.detail || {};
    const grade = String(d.grade || 'C');
    const acc = Number(d.accuracyGoodPct || 0) || 0;
    const miss = Number(d.misses || 0) || 0;

    let mood = 'neutral';
    if (grade === 'SSS' || grade === 'SS' || grade === 'S' || acc >= 85) mood = 'happy';
    else if (miss >= 10 || acc < 50) mood = 'fever';
    else if (miss >= 6 || acc < 65) mood = 'sad';

    setCoachMood(mood, mood, true);
    setCoachLine(`${C.icon} จบเกมแล้ว! Grade ${grade} • Acc ${acc.toFixed(1)}% • Miss ${miss}`, C.tagline);
  }, { passive:true });

})(window);