// === VR Fitness — Shadow Breaker (Cute Targets + 4 Bosses) ===
// ใช้กับ play.html เวอร์ชันล่าสุด (window.__SB_CONFIG)
// ฟีเจอร์:
//  - เป้าน่ารัก: emoji + glow
//  - FEVER mode: combo ≥ 5 → FEVER!! (เป้าทอง + จอสั่นแรง)
//  - 4 บอสตามช่วงเวลาใน 1 เกม (timed mode): Boss 1–4 ยากขึ้นเรื่อย ๆ
//  - ปุ่ม Start / Pause / Resume / Retry + การ์ดสรุป + Download PDF

(function(){
  'use strict';

  // ---------- Helpers ----------
  function $(sel){ return document.querySelector(sel); }
  function injectCSSOnce(id, css){
    if(document.getElementById(id)) return;
    var st = document.createElement('style');
    st.id = id;
    st.textContent = css;
    document.head.appendChild(st);
  }
  function randFrom(arr){
    return arr[(Math.random()*arr.length)|0];
  }

  // ---------- Cute Target CSS ----------
  injectCSSOnce('sbTargetsCSS', ""
    + ".sb-target{position:absolute;transform:translate(-50%,-50%);"
    + "border-radius:999px;cursor:pointer;display:flex;align-items:center;justify-content:center;"
    + "font-weight:800;color:#0b1120;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"
    + "user-select:none;-webkit-user-select:none;touch-action:manipulation;"
    + "box-shadow:0 0 0 2px rgba(15,23,42,0.8),0 16px 40px rgba(15,23,42,0.95);"
    + "text-shadow:0 0 6px rgba(15,23,42,0.5);} "
    + ".sb-target span{font-size:32px;line-height:1;} "
    + ".sb-target-normal{"
      + "background:radial-gradient(circle at 30% 20%,#e0f2fe,#38bdf8);"
      + "border:2px solid rgba(59,130,246,0.95);"
    + "} "
    + ".sb-target-fever{"
      + "background:radial-gradient(circle at 30% 20%,#fef3c7,#facc15);"
      + "border:2px solid rgba(250,204,21,0.98);"
      + "box-shadow:0 0 22px rgba(250,204,21,0.9);"
    + "} "
    + ".sb-target-boss{"
      + "background:radial-gradient(circle at 30% 20%,#fee2e2,#f97316);"
      + "border:2px solid rgba(248,113,113,0.98);"
      + "box-shadow:0 0 26px rgba(248,113,113,0.9);"
    + "} "
    + ".sb-hit-fx{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);"
      + "font-size:18px;font-weight:800;color:#facc15;text-shadow:0 0 8px rgba(250,204,21,0.95);"
      + "pointer-events:none;animation:sbHitFloat 0.4s ease-out forwards;} "
    + ".sb-fever-banner{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);"
      + "padding:10px 18px;border-radius:999px;background:rgba(15,23,42,0.96);"
      + "border:2px solid rgba(250,204,21,1);color:#fef9c3;font-size:22px;font-weight:800;"
      + "letter-spacing:.18em;text-transform:uppercase;box-shadow:0 0 40px rgba(250,204,21,0.75);"
      + "pointer-events:none;animation:feverFlash 0.7s ease-out forwards;} "
    + ".sb-fever-banner span{margin-left:4px;}"
  );

  // ---------- Config from window.__SB_CONFIG ----------
  var cfg = (window.__SB_CONFIG || {});
  var duration   = typeof cfg.duration === 'number' ? cfg.duration : 90;
  var difficulty = (cfg.difficulty || 'normal').toLowerCase();
  var mode       = (cfg.mode || 'timed').toLowerCase();
  var lang       = (cfg.lang || 'th').toLowerCase();
  var sel        = cfg.selectors || {};

  function pickSel(s, fb){ return s || fb; }

  var arenaEl   = $(pickSel(sel.arena, '#sb-game'));
  var timeEl    = $(pickSel(sel.time, '#sbTime'));
  var scoreEl   = $(pickSel(sel.score, '#sbScore'));
  var hitEl     = $(pickSel(sel.hit, '#sbHit'));
  var missEl    = $(pickSel(sel.miss, '#sbMiss'));
  var comboEl   = $(pickSel(sel.combo, '#sbCombo'));
  var coachEl   = $(pickSel(sel.coach, '#sbCoach'));

  var btnStart  = $(pickSel(sel.btnStart, '#btnStart'));
  var btnPause  = $(pickSel(sel.btnPause, '#btnPause'));
  var btnResume = $(pickSel(sel.btnResume, '#btnResume'));

  var resultCard= $(pickSel(sel.resultCard, '#sbResultCard'));
  var resRankEl = $(pickSel(sel.resultRank, '#sbResultRank'));
  var resTitleEl= $(pickSel(sel.resultTitle, '#sbResultTitle'));
  var resScoreEl= $(pickSel(sel.resScore, '#sbResScore'));
  var resHitEl  = $(pickSel(sel.resHit, '#sbResHit'));
  var resMissEl = $(pickSel(sel.resMiss, '#sbResMiss'));
  var resComboEl= $(pickSel(sel.resCombo, '#sbResCombo'));
  var resAccEl  = $(pickSel(sel.resAcc, '#sbResAcc'));
  var resTimeEl = $(pickSel(sel.resTime, '#sbResTime'));
  var resModeEl = $(pickSel(sel.resMode, '#sbResMode'));
  var btnRetry  = $(pickSel(sel.btnRetry, '#btnRetry'));
  var btnBack   = $(pickSel(sel.btnBackMenu, '#btnBackMenu'));
  var btnPdf    = $(pickSel(sel.btnDownloadPdf, '#btnDownloadPdf'));

  if(!arenaEl){
    console.error('Shadow Breaker: arena element not found');
    if(coachEl){
      coachEl.textContent = (lang==='th'
        ? 'ไม่พบพื้นที่เล่น (arena) โปรดรีเฟรชหรือแจ้งผู้ดูแลระบบ'
        : 'Arena element not found. Please reload or contact admin.');
    }
    return;
  }

  // ---------- State ----------
  var state = 'idle'; // idle | running | paused | ended
  var timerId = null;
  var spawnId = null;
  var remaining = duration;
  var elapsedSec = 0;
  var score = 0;
  var hits = 0;
  var misses = 0;
  var combo = 0;
  var maxCombo = 0;
  var inFever = false;
  var feverUntil = 0;
  var lastResults = null;

  var targetIndex = 0;

  // cute target emojis
  var NORMAL_EMOJI = ['⭐','✨','🎯','💥','⚡','🔥'];
  var FEVER_EMOJI  = ['🌟','💫','💛','✨'];

  // spawn speed
  var baseSpawnInterval;
  if(difficulty === 'easy') baseSpawnInterval = 900;
  else if(difficulty === 'hard') baseSpawnInterval = 550;
  else baseSpawnInterval = 700;

  var targetLifetimeNormal = 1600;
  var targetLifetimeBoss   = 2400;

  // 4 บอสตาม progress ของเวลา (เฉพาะ timed mode)
  var bossPhase = 0;
  var bossSchedule = [0.12, 0.35, 0.65, 0.88]; // สัดส่วนเวลาเกม
  var bossCountSpawned = 0;

  // ---------- Boss Info ----------
  function getBossInfo(bossType){
    // bossType: 1–4
    switch(bossType){
      case 1:
        return {
          nameTh: 'บอสที่ 1: หุ่นซ้อมยาง',
          nameEn: 'Boss 1: Rubber Dummy',
          emoji: '🤖',
          hp: 3,
          baseScore: 8,
          bonus: 20
        };
      case 2:
        return {
          nameTh: 'บอสที่ 2: โล่คริสตัล',
          nameEn: 'Boss 2: Crystal Shield',
          emoji: '💎',
          hp: 4,
          baseScore: 9,
          bonus: 30
        };
      case 3:
        return {
          nameTh: 'บอสที่ 3: นาฬิกาสปีดรัน',
          nameEn: 'Boss 3: Speed Clock',
          emoji: '⏱️',
          hp: 5,
          baseScore: 10,
          bonus: 40
        };
      default:
        return {
          nameTh: 'บอสที่ 4: เงาซ้อนสุดท้าย',
          nameEn: 'Boss 4: Shadow King',
          emoji: '👑',
          hp: 6,
          baseScore: 12,
          bonus: 55
        };
    }
  }

  // ---------- UI ----------
  function setText(el, txt){
    if(!el) return;
    el.textContent = String(txt);
  }

  function updateHUD(){
    setText(timeEl, remaining);
    setText(scoreEl, score);
    setText(hitEl, hits);
    setText(missEl, misses);
    setText(comboEl, 'x' + combo);
  }

  function setCoach(msgTh, msgEn){
    if(!coachEl) return;
    coachEl.textContent = (lang === 'th' ? msgTh : msgEn);
  }

  function clearArena(){
    while(arenaEl.firstChild){
      arenaEl.removeChild(arenaEl.firstChild);
    }
  }

  function shakeArena(power){
    if(!arenaEl) return;
    var p = power || 1;
    var ms = 120 + p*60;
    var start = Date.now();
    var baseStyle = arenaEl.style.transform || '';
    var timer = setInterval(function(){
      var t = Date.now() - start;
      if(t >= ms){
        clearInterval(timer);
        arenaEl.style.transform = baseStyle;
        return;
      }
      var intensity = (1 - t/ms) * p;
      var dx = (Math.random()*2 - 1) * 6 * intensity;
      var dy = (Math.random()*2 - 1) * 6 * intensity;
      var rot = (Math.random()*2 - 1) * 2 * intensity;
      arenaEl.style.transform = baseStyle + ' translate('+dx+'px,'+dy+'px) rotate('+rot+'deg)';
    }, 16);
  }

  function showHitFX(text, color){
    var fx = document.createElement('div');
    fx.className = 'sb-hit-fx';
    fx.textContent = text || '+10';
    if(color) fx.style.color = color;
    arenaEl.appendChild(fx);
    setTimeout(function(){
      if(fx.parentNode === arenaEl) arenaEl.removeChild(fx);
    }, 400);
  }

  function showFeverBanner(){
    var banner = document.createElement('div');
    banner.className = 'sb-fever-banner';
    banner.innerHTML = 'FEVER<span>!!</span>';
    arenaEl.appendChild(banner);
    setTimeout(function(){
      if(banner.parentNode === arenaEl) arenaEl.removeChild(banner);
    }, 700);
  }

  function enterFever(){
    inFever = true;
    feverUntil = Date.now() + 6000;
    showFeverBanner();
    setCoach(
      'FEVER!! เป้าทองมาแล้ว แตะให้ทันทุกลูกเลย!! ✨',
      'FEVER!! Golden targets are here. Hit them all!! ✨'
    );
    shakeArena(2.2);
  }

  function checkFeverTimeout(){
    if(inFever && Date.now() > feverUntil){
      inFever = false;
      setCoach(
        'FEVER จบแล้ว ลองสะสมคอมโบใหม่นะ ✨',
        'FEVER ended. Build your combo again ✨'
      );
    }
  }

  // ---------- Spawn Targets ----------
  function spawnTarget(){
    if(state !== 'running') return;
    var rect = arenaEl.getBoundingClientRect();
    var w = rect.width;
    var h = rect.height;
    if(w < 50 || h < 50){
      arenaEl.style.minHeight = '320px';
      rect = arenaEl.getBoundingClientRect();
      w = rect.width; h = rect.height;
    }

    targetIndex += 1;

    // ตัดสินใจ: boss หรือไม่
    var isBoss = false;
    var bossType = 0;

    if(mode === 'timed'){
      var progress = (duration - remaining) / duration; // 0–1
      if(bossPhase < bossSchedule.length && progress >= bossSchedule[bossPhase]){
        isBoss = true;
        bossType = bossPhase + 1; // 1–4
        bossPhase += 1;
        bossCountSpawned += 1;
      }
    }

    // ถ้า endless mode → ใช้ pattern ทุก ๆ 25 เป้า
    if(!isBoss && mode === 'endless'){
      if(targetIndex % 25 === 0){
        isBoss = true;
        bossType = ((bossCountSpawned % 4) + 1);
        bossCountSpawned += 1;
      }
    }

    // ตัดสินใจ FEVER target เฉพาะถ้าไม่ใช่ boss
    var isFeverTarget = (!isBoss && inFever);

    // สร้างเป้า
    var el = document.createElement('div');
    el.className = 'sb-target ';
    var life = targetLifetimeNormal;
    var size;
    var emojiSpan = document.createElement('span');

    if(isBoss){
      var info = getBossInfo(bossType);
      el.className += 'sb-target-boss';
      size = 110 - bossType*4; // บอสสูงขึ้น ขนาดเล็กลงนิด
      life = targetLifetimeBoss - bossType*150;
      el.dataset.type = 'boss';
      el.dataset.bossType = String(bossType);
      el.dataset.hp = String(info.hp);
      emojiSpan.textContent = info.emoji;
      // coach announce boss
      setCoach(
        '⚠️ บอส ' + bossType + ' มาแล้ว: ' + info.nameTh,
        '⚠️ Boss ' + bossType + ' appeared: ' + info.nameEn
      );
      shakeArena(1.8);
    }else if(isFeverTarget){
      el.className += 'sb-target-fever';
      size = 76;
      el.dataset.type = 'fever';
      emojiSpan.textContent = randFrom(FEVER_EMOJI);
    }else{
      el.className += 'sb-target-normal';
      size = 68;
      el.dataset.type = 'normal';
      emojiSpan.textContent = randFrom(NORMAL_EMOJI);
    }

    el.style.width = size + 'px';
    el.style.height = size + 'px';

    var x = 15 + Math.random()*70;
    var y = 18 + Math.random()*60;
    el.style.left = x + '%';
    el.style.top  = y + '%';

    el.dataset.id = 't'+targetIndex;
    el.dataset.alive = '1';
    el.appendChild(emojiSpan);

    var timeoutId = setTimeout(function(){
      if(el.dataset.alive === '1'){
        el.dataset.alive = '0';
        if(el.parentNode === arenaEl) arenaEl.removeChild(el);
        misses += 1;
        combo = 0;
        updateHUD();
        setCoach(
          'พลาดไป 1 เป้า ลองจับจังหวะใหม่อีกครั้งนะ 👍',
          'You missed one. Find the rhythm and go again 👍'
        );
        shakeArena(0.8);
      }
    }, life);
    el.dataset.timeoutId = String(timeoutId);

    el.addEventListener('click', function(){
      if(state !== 'running') return;
      if(el.dataset.alive !== '1') return;

      var type = el.dataset.type || 'normal';

      // นับ hit / combo / score
      hits += 1;
      combo += 1;
      if(combo > maxCombo) maxCombo = combo;

      var gain = 10;

      if(type === 'boss'){
        var bossT = parseInt(el.dataset.bossType || '1', 10);
        var info = getBossInfo(bossT);
        var hp = parseInt(el.dataset.hp || '1', 10);
        hp -= 1;
        el.dataset.hp = String(hp);

        gain = info.baseScore + (inFever ? 6 : 0);

        if(hp <= 0){
          // สังหารบอส
          el.dataset.alive = '0';
          clearTimeout(timeoutId);
          if(el.parentNode === arenaEl) arenaEl.removeChild(el);
          gain += info.bonus;
          showHitFX('BOSS +' + gain, '#fee2e2');
          shakeArena(2.8);
          setCoach(
            'สุดยอด! ล้ม ' + info.nameTh + ' ได้แล้ว! 🎉',
            'Awesome! You defeated ' + info.nameEn + '! 🎉'
          );
        }else{
          // ยังไม่ตาย แสดง HP ที่เหลือบนเป้า
          emojiSpan.textContent = info.emoji;
          showHitFX('+'+gain, '#fee2e2');
          shakeArena(1.6);
        }
      }else if(type === 'fever'){
        gain = 18 + (inFever ? 7 : 0);
        el.dataset.alive = '0';
        clearTimeout(timeoutId);
        if(el.parentNode === arenaEl) arenaEl.removeChild(el);
        showHitFX('+'+gain, '#fef9c3');
        shakeArena(2.2);
      }else{
        // normal target
        gain = 10 + (inFever ? 5 : 0);
        el.dataset.alive = '0';
        clearTimeout(timeoutId);
        if(el.parentNode === arenaEl) arenaEl.removeChild(el);
        showHitFX('+'+gain, '#bfdbfe');
        shakeArena(inFever ? 1.8 : 1.2);
      }

      score += gain;

      // เข้า FEVER เมื่อ combo ≥ 5 และยังไม่อยู่ใน FEVER
      if(combo >= 5 && !inFever){
        enterFever();
      }

      updateHUD();
    });

    arenaEl.appendChild(el);
  }

  // ---------- Timer / Loop ----------
  function tickTimer(){
    if(state !== 'running') return;
    checkFeverTimeout();

    if(mode === 'timed'){
      remaining -= 1;
      if(remaining <= 0){
        remaining = 0;
        updateHUD();
        endGame('time');
        return;
      }
    }else{
      elapsedSec += 1;
    }
    updateHUD();
  }

  function startSpawnLoop(){
    if(spawnId) clearInterval(spawnId);
    var interval = baseSpawnInterval;
    spawnId = setInterval(function(){
      if(state === 'running'){
        spawnTarget();
      }
    }, interval);
  }

  function stopAllTimers(){
    if(timerId){ clearInterval(timerId); timerId = null; }
    if(spawnId){ clearInterval(spawnId); spawnId = null; }
  }

  // ---------- Control ----------
  function resetState(){
    stopAllTimers();
    state = 'idle';
    remaining = duration;
    elapsedSec = 0;
    score = 0;
    hits = 0;
    misses = 0;
    combo = 0;
    maxCombo = 0;
    inFever = false;
    feverUntil = 0;
    targetIndex = 0;
    bossPhase = 0;
    bossCountSpawned = 0;
    clearArena();
    updateHUD();
    if(resultCard) resultCard.style.display = 'none';
  }

  function startGame(){
    if(state === 'running') return;
    resetState();
    state = 'running';

    setCoach(
      'โค้ชพุ่ง: แตะเป้าให้ทัน เก็บคอมโบถึง 5 เพื่อเข้า FEVER และระวัง 4 บอสที่จะโผล่มาระหว่างเกม! 🔥',
      'Coach Pung: Hit every cute target, reach combo 5 for FEVER, and be ready for the 4 bosses! 🔥'
    );

    if(btnStart) btnStart.style.display = 'inline-flex';
    if(btnPause) btnPause.style.display = 'inline-flex';
    if(btnResume) btnResume.style.display = 'none';

    timerId = setInterval(tickTimer, 1000);
    startSpawnLoop();
    updateHUD();
  }

  function pauseGame(){
    if(state !== 'running') return;
    state = 'paused';
    stopAllTimers();
    setCoach(
      'พักหายใจลึกๆ ก่อน แล้วค่อยกด Resume ต่อ 💫',
      'Take a short break and press Resume when ready 💫'
    );
    if(btnPause) btnPause.style.display = 'none';
    if(btnResume) btnResume.style.display = 'inline-flex';
  }

  function resumeGame(){
    if(state !== 'paused') return;
    state = 'running';
    setCoach(
      'ลุยต่อ! บอสตัวถัดไปกำลังรออยู่ข้างหน้า 🔥',
      'Let’s go! The next boss is waiting ahead 🔥'
    );
    if(btnPause) btnPause.style.display = 'inline-flex';
    if(btnResume) btnResume.style.display = 'none';

    timerId = setInterval(tickTimer, 1000);
    startSpawnLoop();
  }

  function endGame(reason){
    if(state === 'ended') return;
    state = 'ended';
    stopAllTimers();
    clearArena();

    var usedTime;
    if(mode === 'timed'){
      usedTime = duration - remaining;
      if(usedTime < 0) usedTime = 0;
    }else{
      usedTime = elapsedSec;
    }

    var total = hits + misses;
    var acc = total > 0 ? (hits*100/total) : 0;

    var rank = 'C';
    var titleTh = 'ลองใหม่อีกครั้งได้นะ 💪';
    var titleEn = 'You can try again 💪';

    if(acc >= 95 && hits >= 80){
      rank = 'S';
      titleTh = 'สุดยอด! ระดับ Shadow Master! 🏆';
      titleEn = 'Amazing! Shadow Master level! 🏆';
    }else if(acc >= 85 && hits >= 40){
      rank = 'A';
      titleTh = 'เยี่ยมมาก! แม่นและไวมาก 👍';
      titleEn = 'Great! Very fast and accurate 👍';
    }else if(acc >= 70){
      rank = 'B';
      titleTh = 'ใช้ได้เลย! ถ้าซ้อมอีกนิดจะเทพแน่นอน ✨';
      titleEn = 'Good! A bit more practice and you’ll be great ✨';
    }

    lastResults = {
      mode: mode,
      difficulty: difficulty,
      duration: duration,
      usedTime: usedTime,
      score: score,
      hits: hits,
      misses: misses,
      maxCombo: maxCombo,
      accuracy: acc,
      rank: rank,
      finishedBy: reason || 'time',
      timestamp: new Date().toISOString(),
      bossesSpawned: bossCountSpawned
    };

    if(resRankEl)  resRankEl.textContent  = rank;
    if(resTitleEl) resTitleEl.textContent = (lang==='th' ? titleTh : titleEn);
    if(resScoreEl) resScoreEl.textContent = score;
    if(resHitEl)   resHitEl.textContent   = hits;
    if(resMissEl)  resMissEl.textContent  = misses;
    if(resComboEl) resComboEl.textContent = 'x' + maxCombo;
    if(resAccEl)   resAccEl.textContent   = acc.toFixed(1) + '%';
    if(resTimeEl)  resTimeEl.textContent  = usedTime + 's';
    if(resModeEl){
      var diffLabel = (difficulty==='easy' ? 'Easy'
        : difficulty==='hard' ? 'Hard' : 'Normal');
      var modeLabel = (mode==='endless' ? 'Endless' : 'Timed');
      resModeEl.textContent = modeLabel + ' · ' + diffLabel;
    }

    if(resultCard) resultCard.style.display = 'flex';

    if(btnStart)  btnStart.style.display  = 'inline-flex';
    if(btnPause)  btnPause.style.display  = 'none';
    if(btnResume) btnResume.style.display = 'none';

    // ripple effect
    var ripple = document.createElement('div');
    ripple.className = 'sb-finish-ripple';
    document.body.appendChild(ripple);
    setTimeout(function(){
      if(ripple.parentNode) ripple.parentNode.removeChild(ripple);
    }, 600);

    setCoach(
      'จบเกมแล้ว! ดูผลคะแนนด้านล่าง แล้วลองไต่ Rank ให้ถึง S ดูนะ 🔁',
      'Session finished! Check your stats and aim for Rank S next time 🔁'
    );
  }

  // ---------- PDF / Print ----------
  function openResultWindow(){
    if(!lastResults){
      alert(lang==='th'
        ? 'ยังไม่มีผลการเล่นล่าสุด กรุณาเล่นเกมให้จบหนึ่งรอบก่อน'
        : 'No recent result. Please finish one session first.');
      return;
    }
    var w = window.open('', '_blank');
    if(!w){
      alert(lang==='th'
        ? 'เบราว์เซอร์บล็อกหน้าต่างใหม่ โปรดอนุญาต Pop-up'
        : 'Popup blocked. Please allow pop-ups.');
      return;
    }
    var r = lastResults;
    var title = (lang==='th'
      ? 'รายงานผล VR Fitness — Shadow Breaker'
      : 'Report: VR Fitness — Shadow Breaker');

    var html = '<!doctype html><html><head><meta charset="utf-8"/>'
      + '<title>'+title+'</title>'
      + '<style>'
      + 'body{font-family:system-ui,Segoe UI,sans-serif;padding:20px;background:#0b1120;color:#e5e7eb;}'
      + 'h1{font-size:20px;margin-bottom:8px;}'
      + 'table{border-collapse:collapse;margin-top:8px;}'
      + 'td{padding:4px 8px;border:1px solid #334155;font-size:13px;}'
      + '</style>'
      + '</head><body>';
    html += '<h1>'+title+'</h1>';
    html += '<table>';
    html += '<tr><td>Timestamp</td><td>'+r.timestamp+'</td></tr>';
    html += '<tr><td>Mode</td><td>'+r.mode+'</td></tr>';
    html += '<tr><td>Difficulty</td><td>'+r.difficulty+'</td></tr>';
    html += '<tr><td>Duration</td><td>'+r.duration+' s</td></tr>';
    html += '<tr><td>Used Time</td><td>'+r.usedTime+' s</td></tr>';
    html += '<tr><td>Score</td><td>'+r.score+'</td></tr>';
    html += '<tr><td>Hits</td><td>'+r.hits+'</td></tr>';
    html += '<tr><td>Misses</td><td>'+r.misses+'</td></tr>';
    html += '<tr><td>Max Combo</td><td>'+r.maxCombo+'</td></tr>';
    html += '<tr><td>Accuracy</td><td>'+r.accuracy.toFixed(1)+'%</td></tr>';
    html += '<tr><td>Rank</td><td>'+r.rank+'</td></tr>';
    html += '<tr><td>Bosses Spawned</td><td>'+r.bossesSpawned+'</td></tr>';
    html += '</table>';
    html += '<p style="margin-top:12px;font-size:12px;">'
      + (lang==='th'
        ? 'ใช้คำสั่ง Print (Ctrl+P / Share → Print) แล้วเลือก Save as PDF เพื่อบันทึกไฟล์.'
        : 'Use Print (Ctrl+P or Share → Print) and choose "Save as PDF" to export.')
      + '</p>';
    html += '</body></html>';

    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  // ---------- Bind Buttons ----------
  if(btnStart){
    btnStart.addEventListener('click', function(){
      if(state === 'running') return;
      startGame();
    });
  }
  if(btnPause){
    btnPause.addEventListener('click', function(){
      pauseGame();
    });
  }
  if(btnResume){
    btnResume.addEventListener('click', function(){
      resumeGame();
    });
  }
  if(btnRetry){
    btnRetry.addEventListener('click', function(){
      startGame();
    });
  }
  if(btnPdf){
    btnPdf.addEventListener('click', function(){
      openResultWindow();
    });
  }

  // ---------- Initial Coach ----------
  setCoach(
    'พร้อมแล้วกด "เริ่มเล่น" เพื่อฝึก Shadow Breaker เป้าน่ารัก + 4 บอสใน 1 เกม 🔥',
    'Press "Start" to train with cute targets and 4 bosses in one session 🔥'
  );
  updateHUD();
})();