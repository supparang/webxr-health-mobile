/* === /herohealth/vr/coach-manager.js ===
HeroHealth Coach Manager — FULL GAME (PRODUCTION) — Image Mode A
✅ Uses your current filenames:
   ./img/hydration-happy.png / hydration-neutral.png / hydration-sad.png / hydration-fever.png
   ./img/groups-*.png / plate-*.png / goodjunk-*.png
✅ Fallback: ./img/coach-happy.png ... (standard set)
✅ Unique coach identity per game (lines + style)
✅ Listens: hha:score, hha:judge, quest:update, hha:end
*/
(function (root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  // -------- helpers --------
  function qs(name, def){
    try{ return (new URL(location.href)).searchParams.get(name) ?? def; }catch{ return def; }
  }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function now(){ return performance.now(); }
  function setText(el, t){ try{ if(el) el.textContent = String(t); }catch{} }

  // -------- detect gameKey --------
  function detectGameKey(){
    const override = String(qs('game','')||'').toLowerCase().trim();
    if (override) return override;

    const p = String(location.pathname||'').toLowerCase();
    if (p.includes('hydration')) return 'hydration';
    if (p.includes('vr-groups') || p.includes('groups')) return 'groups';
    if (p.includes('plate')) return 'plate';
    if (p.includes('goodjunk')) return 'goodjunk';
    return 'default';
  }
  const gameKey = detectGameKey();

  // -------- DOM binds (flex) --------
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

  // -------- style inject --------
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

  function cardEl(){
    return coachText ? (coachText.closest('.coachCard') || coachText.parentElement) : null;
  }
  function pulse(){
    const el = cardEl();
    if (!el) return;
    el.classList.remove('hha-coach-pulse');
    void el.offsetWidth;
    el.classList.add('hha-coach-pulse');
  }
  function shake(){
    const el = cardEl();
    if (!el) return;
    el.classList.remove('hha-coach-shake');
    void el.offsetWidth;
    el.classList.add('hha-coach-shake');
  }

  // -------- per-game personality --------
  const GAME = {
    hydration: {
      icon:'💧', name:'Hydra Coach',
      tagline:'คุม GREEN ให้เนียน • ใช้ Shield แบบมีจังหวะ',
      lines:{
        start:'พร้อมลุย! คุม GREEN ให้ครบ แล้วค่อยโหดใน Storm 💧',
        happy:'โคตรดี! จังหวะนิ่งขึ้นแล้ว 💚',
        neutral:'นิ่งไว้… โฟกัสกลางจอ 🎯',
        sad:'MISS มาแล้ว! เก็บ 🛡️ เผื่อท้ายพายุ',
        fever:'เดือดแล้ว! รีเซ็ตจังหวะเดี๋ยวนี้ 😵‍💫',
        stormIn:'STORM มา! เตรียม “Shield Timing” 🌀',
        stormEnd:'ท้ายพายุ! ต้อง BLOCK ให้ได้ตอนนี้!! ⚠️',
        perfect:'PERFECT! จังหวะเทพ ⚡',
        streak:'STREAK! ต่อเนื่องโหด 🔥'
      }
    },
    groups: {
      icon:'🥗', name:'Food Master',
      tagline:'จำ 5 หมู่ • กันหลอก/สลับ • คอมโบคือชีวิต',
      lines:{
        start:'วันนี้เราเป็นเซียน 5 หมู่! 🥗',
        happy:'แม่นมาก! จำหมู่ได้จริง 💯',
        neutral:'ดูหมู่ก่อนยิง… อย่าหลง 👀',
        sad:'เริ่มหลุดแล้วนะ ตั้งสติ 😅',
        fever:'หัวร้อน! หายใจลึก ๆ 😤',
        stormIn:'โหมดปั่นมา! ระวังสลับ/หลอก 🌪️',
        stormEnd:'โค้งสุดท้าย! ยิงแต่ชัวร์! ⚠️',
        perfect:'คมจัด! ✨',
        streak:'สตรีคโหดมาก! 🔥'
      }
    },
    plate: {
      icon:'🍽️', name:'Plate Guardian',
      tagline:'บาลานซ์จาน • มินิสั้นแต่โหด • ห้ามพลาด',
      lines:{
        start:'จัดจานให้เป๊ะ! 🍽️',
        happy:'บาลานซ์สวย! 🌟',
        neutral:'ทีละเป้า… ชัวร์ก่อน 🎯',
        sad:'MISS เยอะไปนะ ลดความรีบ 😵',
        fever:'แตกแล้ว! รีเซ็ตจังหวะ 💢',
        stormIn:'เข้าช่วงเร่งสปีด! ⏱️',
        stormEnd:'ท้ายรอบ! เก็บแต้มให้สุด! ⚠️',
        perfect:'Perfect plate! 🏆',
        streak:'สตรีคสวย! 🔥'
      }
    },
    goodjunk: {
      icon:'🚫', name:'Junk Buster',
      tagline:'เก็บดี • หลีกขยะ • ชนะด้วยวินัย',
      lines:{
        start:'เกมนี้วัดวินัย! 🚫',
        happy:'สะอาดมาก! ✅',
        neutral:'ชัวร์ก่อนยิง… อย่าหลง 🧠',
        sad:'เริ่มพลาดแล้วนะ ระวัง! 😬',
        fever:'โหมดเดือด! ห้ามพลาดซ้ำ! 🔥',
        stormIn:'จังหวะโหดมาแล้ว! ⚡',
        stormEnd:'ท้ายรอบ! อย่าเผลอแตะ junk! ⚠️',
        perfect:'Perfect discipline! ✨',
        streak:'สตรีคโหด! 🔥'
      }
    },
    default: {
      icon:'🧠', name:'Hero Coach',
      tagline:'เล่นให้สนุก • วัดสกิล • เก็บข้อมูลได้',
      lines:{ start:'เริ่มเลย! 🎮', happy:'เยี่ยม!', neutral:'ไปต่อ', sad:'ระวังพลาด', fever:'โหมดเดือด!' }
    }
  };
  const C = GAME[gameKey] || GAME.default;

  // -------- Image resolver (MODE A) --------
  function candidateImages(mood){
    // MODE A: flat naming you have
    const b = `./img/${gameKey}-${mood}.png`;
    // fallback set
    const c = `./img/coach-${mood}.png`;
    return [b,c];
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
        img.src = url;
      })();
    });
  }

  // -------- mood engine --------
  const S = {
    mood:'neutral',
    lastLineAt:0,
    stormActive:false,
    stormLeft:0,
    inEndWindow:false
  };

  function setCoachLine(text, sub){
    if (coachText) setText(coachText, text);
    if (coachSub)  setText(coachSub, sub ?? C.tagline);
  }

  function moodFromScore(d){
    const misses = Number(d.misses ?? 0) || 0;
    const combo  = Number(d.combo ?? 0) || 0;
    const grade  = String(d.grade ?? 'C');
    const acc    = Number(d.accuracyGoodPct ?? 0) || 0;

    if (misses >= 12 || acc < 45) return 'fever';
    if (misses >= 6 || (combo<=1 && acc < 60)) return 'sad';
    if (combo >= 8 || grade === 'S' || grade === 'SS' || grade === 'SSS' || acc >= 85) return 'happy';
    return 'neutral';
  }

  async function setMood(mood, lineKey, forceLine){
    mood = String(mood||'neutral').toLowerCase();
    if (!['happy','neutral','sad','fever'].includes(mood)) mood='neutral';

    const t = now();
    const allowLine = forceLine || (t - S.lastLineAt > 650);
    if (allowLine){
      const line =
        (lineKey && C.lines[lineKey]) ? C.lines[lineKey] :
        (C.lines[mood] || C.lines.neutral || C.lines.start || 'ไปต่อ!');
      setCoachLine(`${C.icon} ${line}`, C.tagline);
      S.lastLineAt = t;
    }

    if (S.mood !== mood){
      S.mood = mood;
      pulse();
      if (coachImg){
        const src = await resolveImage(mood);
        if (src) coachImg.src = src;
      }
    } else {
      pulse();
    }
  }

  // init
  setCoachLine(`${C.icon} ${C.lines.start}`, C.tagline);
  setMood('neutral', null, false);

  // events
  root.addEventListener('hha:judge', (ev)=>{
    const d = ev.detail || {};
    const kind = String(d.kind||'');

    if (kind === 'bad'){ shake(); setMood('sad','sad',true); }
    if (kind === 'perfect' || kind === 'block'){ setMood('happy','perfect',true); }
    if (kind === 'streak'){ setMood('happy','streak',true); }
    if (kind === 'storm-in'){ setMood('neutral','stormIn',true); }
  }, { passive:true });

  root.addEventListener('hha:score', (ev)=>{
    const d = ev.detail || {};
    S.stormActive = !!d.stormActive;
    S.stormLeft   = Number(d.stormLeftSec ?? 0) || 0;

    const inferredEnd = (S.stormActive && S.stormLeft <= 1.2 + 0.05);
    S.inEndWindow = !!d.stormInEndWindow || inferredEnd;

    if (S.stormActive && S.inEndWindow){
      setMood('fever','stormEnd',false);
      return;
    }
    if (S.stormActive && S.stormLeft > 0 && S.stormLeft <= 5.0){
      setMood('neutral','stormIn',false);
      return;
    }

    setMood(moodFromScore(d), null, false);
  }, { passive:true });

  root.addEventListener('quest:update', (ev)=>{
    const d = ev.detail || {};
    const t = now();
    if (t - S.lastLineAt < 900) return;

    const goalNow  = Number(d.goalNow ?? 0) || 0;
    const goalNeed = Number(d.goalNeed ?? 0) || 0;
    if (goalNeed > 0){
      const pct = clamp(goalNow/goalNeed, 0, 1);
      if (pct >= 0.85 && pct < 1.0){
        setCoachLine(`${C.icon} ใกล้แล้ว! อีกนิดเดียว! 🔥`, C.tagline);
        S.lastLineAt = t;
      } else if (pct >= 1.0){
        setCoachLine(`${C.icon} GOAL สำเร็จ! สวยมาก! 🏁`, C.tagline);
        S.lastLineAt = t;
        setMood('happy','happy',false);
      }
    }
  }, { passive:true });

  root.addEventListener('hha:end', (ev)=>{
    const d = ev.detail || {};
    const grade = String(d.grade || 'C');
    const acc = Number(d.accuracyGoodPct || 0) || 0;
    const miss = Number(d.misses || 0) || 0;

    let mood='neutral';
    if (grade==='SSS'||grade==='SS'||grade==='S'||acc>=85) mood='happy';
    else if (miss>=10||acc<50) mood='fever';
    else if (miss>=6||acc<65) mood='sad';

    setMood(mood, mood, true);
    setCoachLine(`${C.icon} จบเกมแล้ว! Grade ${grade} • Acc ${acc.toFixed(1)}% • Miss ${miss}`, C.tagline);
  }, { passive:true });

})(window);