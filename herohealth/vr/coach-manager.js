// === /herohealth/vr/coach-manager.js ===
// HeroHealth Coach Manager — PRODUCTION
// ✅ Auto-picks coach image set per game by URL/path
// ✅ Binds #coach-img / #coach-text / #coach-sub (optional)
// ✅ Reacts to events: hha:coach, hha:score, hha:judge, hha:end
// ✅ Uses your existing images in /herohealth/img
//    Required (global fallback): coach-fever.png, coach-happy.png, coach-neutral.png, coach-sad.png
//    Optional per game: hydration-*, plate-*, groups-*, goodjunk-*  (same suffix names)

(function () {
  'use strict';

  const D = document;

  const elImg  = D.getElementById('coach-img');
  const elText = D.getElementById('coach-text');
  const elSub  = D.getElementById('coach-sub');

  if (!elImg && !elText && !elSub) return;

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function detectGame(){
    const url = (location.pathname || '').toLowerCase();
    const q = new URL(location.href).searchParams;
    const gm = String(q.get('gameMode') || '').toLowerCase();
    if (gm) return gm;

    if (url.includes('hydration')) return 'hydration';
    if (url.includes('plate')) return 'plate';
    if (url.includes('groups')) return 'groups';
    if (url.includes('goodjunk')) return 'goodjunk';
    return 'herohealth';
  }

  const GAME = detectGame();

  // image resolver (prefer per-game set, fallback to generic coach-*)
  function imgPath(mood){
    const base = './img/';
    const suf =
      mood === 'happy' ? 'happy' :
      mood === 'sad' ? 'sad' :
      mood === 'fever' ? 'fever' :
      'neutral';

    // Try game-specific
    const tryGame = `${base}${GAME}-${suf}.png`;
    const fallback = `${base}coach-${suf}.png`;

    // We can’t sync-check file existence reliably without fetch; use optimistic swap:
    // If image fails to load, onerror will swap to fallback.
    return { tryGame, fallback };
  }

  function setImg(mood){
    if (!elImg) return;
    const { tryGame, fallback } = imgPath(mood);
    elImg.onerror = () => {
      // prevent loop
      elImg.onerror = null;
      elImg.src = fallback;
    };
    elImg.src = tryGame;
  }

  // mood state
  let mood = 'neutral';
  let lastSayAt = 0;

  function say(text, sub){
    if (elText && text) elText.textContent = String(text);
    if (elSub && sub != null) elSub.textContent = String(sub);
    lastSayAt = performance.now();
  }

  // initial
  setImg('neutral');
  if (elSub && !elSub.textContent.trim()){
    elSub.textContent = `GAME: ${GAME} • Tip: เล็งกลางจอ`;
  }

  // --- event bindings ---
  window.addEventListener('hha:coach', (ev)=>{
    const d = ev.detail || {};
    if (d.mood) {
      mood = String(d.mood).toLowerCase();
      if (!['neutral','happy','sad','fever'].includes(mood)) mood = 'neutral';
      setImg(mood);
    }
    if (d.text) say(d.text, d.sub ?? elSub?.textContent);
  }, { passive:true });

  // simple heuristics from score/judge
  let lastScore = 0;
  let lastMiss = 0;

  function setMood(m){
    m = String(m||'neutral');
    if (mood === m) return;
    mood = m;
    setImg(mood);
  }

  window.addEventListener('hha:judge', (ev)=>{
    const d = ev.detail || {};
    const k = String(d.kind||'');
    if (k === 'bad') {
      setMood('sad');
      say('โอ๊ย! ระวัง BAD 🥤', `โฟกัส + เก็บ 🛡️ ไว้กัน`);
    }
    if (k === 'good') {
      setMood('happy');
      const t = performance.now();
      if (t - lastSayAt > 1200) say('ดีมาก! ยิง 💧 ต่อ!', `รักษาโซน GREEN`);
    }
    if (k === 'shield') {
      setMood('neutral');
      const t = performance.now();
      if (t - lastSayAt > 1200) say('เยี่ยม! ได้ 🛡️', `เอาไว้ BLOCK ตอนท้ายพายุ`);
    }
    if (k === 'perfect') {
      setMood('happy');
      say('PERFECT! บล็อกถูกจังหวะ! ⚡', `ทำแบบนี้ตอนท้ายพายุ`);
    }
    if (k === 'streak') {
      setMood('happy');
      say('STREAK! โคตรมันส์! 🔥', `คอมโบกำลังมา`);
    }
  }, { passive:true });

  window.addEventListener('hha:score', (ev)=>{
    const d = ev.detail || {};
    const score = Number(d.score||0);
    const miss  = Number(d.misses||0);
    const storm = !!d.stormActive;
    const left  = Number(d.stormLeftSec||0);
    const wz    = String(d.waterZone||'').toUpperCase();

    // fever proxy: more misses -> more fever
    const fever = clamp(miss * 18, 0, 100);

    // mood logic
    if (fever >= 70) setMood('fever');
    else if (miss > lastMiss) setMood('sad');
    else if (score > lastScore) setMood('happy');
    else setMood('neutral');

    lastScore = score;
    lastMiss = miss;

    // gentle coaching text occasionally
    const t = performance.now();
    if (t - lastSayAt > 1800){
      if (storm){
        if (left <= 2.2) say('ท้ายพายุแล้ว! ต้อง BLOCK ให้ได้! ⏱️', `น้ำต้องไม่ใช่ GREEN (${wz})`);
        else say('STORM มาแล้ว! เตรียมทำ MINI 🌀', `ให้น้ำเป็น LOW/HIGH แล้วค่อย BLOCK`);
      } else {
        if (wz === 'GREEN') say('ดี! อยู่ GREEN แล้ว สะสมเวลาต่อ ✅', `อย่าเผลอโดน BAD`);
        else say('ดันน้ำเข้า GREEN 💧', `ยิง GOOD เพื่อคุมโซน`);
      }
    }
  }, { passive:true });

  window.addEventListener('hha:end', (ev)=>{
    const d = ev.detail || {};
    const g = String(d.grade||'C');
    if (g === 'SSS' || g === 'SS' || g === 'S') {
      setMood('happy');
      say(`โคตรเก่ง! ได้เกรด ${g} 🏆`, 'ลองโหมดยากขึ้นมั้ย?');
    } else if (g === 'A' || g === 'B') {
      setMood('neutral');
      say(`ดีมาก! เกรด ${g} ✅`, 'คุม GREEN ให้ยาวขึ้น + เก็บ 🛡️');
    } else {
      setMood('sad');
      say(`ไม่เป็นไร เกรด ${g} 😅`, 'โฟกัสยิง 💧 และหลบ 🥤');
    }
  }, { passive:true });

})();