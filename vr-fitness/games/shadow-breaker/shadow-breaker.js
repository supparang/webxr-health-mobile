// === VR Fitness — Shadow Breaker (DOM version / Hybrid) ===
// - ใช้กับ play.html เวอร์ชันล่าสุด (window.__SB_CONFIG)
// - รองรับ: PC / Mobile / VR (ผ่าน layout โมด "vr-mode")
// - ฟีเจอร์หลัก:
//   • เป้าโดนแตะ → คะแนน + คอมโบ + จอสั่น
//   • combo ≥ 5 → เข้าสู่ FEVER mode (เป้าทอง + FEVER!! กลางจอ + สั่นแรงขึ้น)
//   • ปุ่ม Start / Pause / Resume / Retry
//   • แสดงผลหลังจบ (Score, Hit, Miss, Combo สูงสุด, Accuracy, เวลา)
//   • ปุ่ม Download PDF (เปิดหน้าสรุปสำหรับ Print เป็น PDF)

(function(){
  'use strict';

  // ----- Small helpers -----
  function $(sel){ return document.querySelector(sel); }
  function injectCSSOnce(id, css){
    if(document.getElementById(id)) return;
    var st = document.createElement('style');
    st.id = id;
    st.textContent = css;
    document.head.appendChild(st);
  }

  // ----- Inject CSS ของเป้า / FEVER overlay -----
  injectCSSOnce('sbTargetsCSS', ""
    + ".sb-target{position:absolute;transform:translate(-50%,-50%);"
    + "border-radius:999px;cursor:pointer;display:flex;align-items:center;justify-content:center;"
    + "font-weight:700;color:#0b1120;font-family:system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;"
    + "box-shadow:0 0 0 2px rgba(15,23,42,0.85),0 12px 28px rgba(15,23,42,0.9);"
    + "user-select:none;-webkit-user-select:none;touch-action:manipulation;}"
    + ".sb-target-normal{background:radial-gradient(circle at 30% 20%,#e0f2fe,#38bdf8);}"
    + ".sb-target-fever{background:radial-gradient(circle at 30% 20%,#fef08a,#facc15);}"
    + ".sb-target-boss{background:radial-gradient(circle at 30% 20%,#fee2e2,#f97316);}"
    + ".sb-hit-fx{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);"
    + "font-size:18px;font-weight:800;color:#facc15;text-shadow:0 0 8px rgba(250,204,21,0.9);"
    + "pointer-events:none;animation:sbHitFloat 0.4s ease-out forwards;}"
    + ".sb-fever-banner{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);"
    + "padding:10px 18px;border-radius:999px;background:rgba(15,23,42,0.96);"
    + "border:2px solid rgba(250,204,21,1);color:#fef9c3;font-size:22px;font-weight:800;"
    + "letter-spacing:.18em;text-transform:uppercase;box-shadow:0 0 40px rgba(250,204,21,0.75);"
    + "pointer-events:none;animation:feverFlash 0.7s ease-out forwards;}"
    + ".sb-fever-banner span{margin-left:4px;}"
  );

  // ----- อ่าน config จาก window.__SB_CONFIG -----
  var cfg = (window.__SB_CONFIG || {});
  var duration = typeof cfg.duration === 'number' ? cfg.duration : 90;
  var difficulty = (cfg.difficulty || 'normal').toLowerCase();
  var mode = (cfg.mode || 'timed').toLowerCase();
  var lang = (cfg.lang || 'th').toLowerCase();
  var sel = cfg.selectors || {};

  // selector fallback
  function pick(selStr, fallback){ return selStr || fallback; }

  var arenaEl   = $(pick(sel.arena, '#sb-game'));
  var timeEl    = $(pick(sel.time, '#sbTime'));
  var scoreEl   = $(pick(sel.score, '#sbScore'));
  var hitEl     = $(pick(sel.hit, '#sbHit'));
  var missEl    = $(pick(sel.miss, '#sbMiss'));
  var comboEl   = $(pick(sel.combo, '#sbCombo'));
  var coachEl   = $(pick(sel.coach, '#sbCoach'));

  var btnStart  = $(pick(sel.btnStart, '#btnStart'));
  var btnPause  = $(pick(sel.btnPause, '#btnPause'));
  var btnResume = $(pick(sel.btnResume, '#btnResume'));
  var resultCard= $(pick(sel.resultCard, '#sbResultCard'));
  var resRankEl = $(pick(sel.resultRank, '#sbResultRank'));
  var resTitleEl= $(pick(sel.resultTitle, '#sbResultTitle'));
  var resScoreEl= $(pick(sel.resScore, '#sbResScore'));
  var resHitEl  = $(pick(sel.resHit, '#sbResHit'));
  var resMissEl = $(pick(sel.resMiss, '#sbResMiss'));
  var resComboEl= $(pick(sel.resCombo, '#sbResCombo'));
  var resAccEl  = $(pick(sel.resAcc, '#sbResAcc'));
  var resTimeEl = $(pick(sel.resTime, '#sbResTime'));
  var resModeEl = $(pick(sel.resMode, '#sbResMode'));
  var btnRetry  = $(pick(sel.btnRetry, '#btnRetry'));
  var btnBack   = $(pick(sel.btnBackMenu, '#btnBackMenu'));
  var btnPdf    = $(pick(sel.btnDownloadPdf, '#btnDownloadPdf'));

  if(!arenaEl){
    console.error('Shadow Breaker: arena element not found');
    if(coachEl){ coachEl.textContent = (lang==='th'
      ? 'ไม่พบพื้นที่เล่น (arena) โปรดรีเฟรชหรือแจ้งผู้ดูแลระบบ'
      : 'Arena element not found. Please reload or contact admin.'
    );}
    return;
  }

  // ----- สถานะเกม -----
  var state = 'idle'; // idle | running | paused | ended
  var timerId = null;
  var spawnId = null;
  var remaining = duration;
  var startTimestamp = 0;
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

  // spawn config
  var baseSpawnInterval;
  if(difficulty === 'easy') baseSpawnInterval = 900;
  else if(difficulty === 'hard') baseSpawnInterval = 550;
  else baseSpawnInterval = 700;

  var targetLifetimeNormal = 1600;
  var targetLifetimeBoss   = 2400;
  var bossEvery = 18; // ทุกๆ 18 เป้าสุ่ม 1 บอส
  var spawnCount = 0;

  // ----- helper UI -----
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
    var ms = 120 + p*40;
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
    if(!arenaEl) return;
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
    feverUntil = Date.now() + 6000; // 6 วิ
    showFeverBanner();
    setCoach(
      'FEVER!! แตะเป้าทองให้ทันนะ!! ✨',
      'FEVER!! Smash those golden targets!! ✨'
    );
    shakeArena(2);
  }

  function checkFeverTimeout(){
    if(inFever && Date.now() > feverUntil){
      inFever = false;
      setCoach(
        'โค้ชพุ่ง: ลองเก็บคอมโบให้ถึง 5 อีกที เพื่อเข้าช่วง FEVER!',
        'Coach: Build combo to 5 again for the next FEVER!'
      );
    }
  }

  // ----- Target spawn & click -----
  function spawnTarget(){
    if(state !== 'running') return;
    if(!arenaEl) return;
    var rect = arenaEl.getBoundingClientRect();
    var w = rect.width;
    var h = rect.height;
    if(w < 50 || h < 50){
      arenaEl.style.minHeight = '320px';
      rect = arenaEl.getBoundingClientRect();
      w = rect.width; h = rect.height;
    }

    spawnCount += 1;
    targetIndex += 1;

    // ตัดสินใจว่าเป็น boss / fever / ปกติ
    var isBoss = (spawnCount % bossEvery === 0);
    var isFeverTarget = inFever && !isBoss;

    var size = isBoss ? 96 : 68;
    if(isFeverTarget) size = 72;

    var x = 15 + Math.random()*70; // %
    var y = 18 + Math.random()*60; // %
    var el = document.createElement('div');
    el.className = 'sb-target ';
    if(isBoss) el.className += 'sb-target-boss';
    else if(isFeverTarget) el.className += 'sb-target-fever';
    else el.className += 'sb-target-normal';

    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.left = x + '%';
    el.style.top = y + '%';

    if(isBoss){
      el.textContent = 'B';
      el.dataset.hp = '3';
    }else if(isFeverTarget){
      el.textContent = '★';
    }else{
      el.textContent = '';
    }

    el.dataset.id = 't'+targetIndex;
    el.dataset.type = isBoss ? 'boss' : (isFeverTarget ? 'fever' : 'normal');
    el.dataset.alive = '1';

    var lifetime = isBoss ? targetLifetimeBoss : targetLifetimeNormal;
    var timeoutId = setTimeout(function(){
      // หมดเวลาแต่ยังอยู่ → นับพลาด
      if(el.dataset.alive === '1'){
        el.dataset.alive = '0';
        if(el.parentNode === arenaEl) arenaEl.removeChild(el);
        misses += 1;
        combo = 0;
        updateHUD();
        setCoach(
          'พลาดไป 1 เป้า… ลองโฟกัสใหม่อีกที 👍',
          'You missed one target… refocus and go again 👍'
        );
        shakeArena(0.6);
      }
    }, lifetime);
    el.dataset.timeoutId = String(timeoutId);

    el.addEventListener('click', function(ev){
      if(state !== 'running') return;
      if(el.dataset.alive !== '1') return;
      el.dataset.alive = '0';
      clearTimeout(timeoutId);
      if(el.parentNode === arenaEl) arenaEl.removeChild(el);

      var t = el.dataset.type || 'normal';
      var base = 10;
      if(t === 'boss') base = 25;
      else if(t === 'fever') base = 18;

      var gain = base;
      if(inFever) gain += 5;

      hits += 1;
      combo += 1;
      if(combo > maxCombo) maxCombo = combo;
      score += gain;

      var fxText = '+' + gain;
      var fxColor = (t === 'boss') ? '#fee2e2' : (inFever ? '#fef9c3' : '#bfdbfe');
      showHitFX(fxText, fxColor);
      shakeArena(inFever ? 2 : 1);

      // ถ้าเป็น boss ให้พูดพิเศษ
      if(t === 'boss'){
        setCoach(
          'เยี่ยม! ล้มบอสได้แล้ว! 🔥',
          'Great! Boss defeated! 🔥'
        );
      }else if(combo >= 5 && !inFever){
        enterFever(); // combo ≥ 5 → guaranteed FEVER
      }else if(combo === 1){
        setCoach(
          'เริ่มคอมโบแล้ว! ลองดูว่าจะไปได้ถึงเท่าไหร่ ✨',
          'Combo started! Let’s see how far you can go ✨'
        );
      }

      updateHUD();
    });

    arenaEl.appendChild(el);
  }

  // ----- Timer & loop -----
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
      // endless → ใช้ elapsed แทน
      elapsedSec += 1;
    }
    updateHUD();
  }

  function startSpawnLoop(){
    if(spawnId) clearInterval(spawnId);
    var interval = baseSpawnInterval;
    if(mode === 'endless'){
      interval = baseSpawnInterval; // สามารถปรับ scaling ตามเวลาภายหลังได้
    }
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

  // ----- Control -----
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
    spawnCount = 0;
    clearArena();
    updateHUD();
    if(resultCard) resultCard.style.display = 'none';
  }

  function startGame(){
    if(state === 'running') return;
    resetState();
    state = 'running';
    startTimestamp = Date.now();
    setCoach(
      'โค้ชพุ่ง: แตะเป้าที่โผล่มาให้ไวที่สุด! ถ้าได้คอมโบ 5 ขึ้นไปจะเข้า FEVER!!',
      'Coach: Tap every target fast! Reach combo 5 to enter FEVER!!'
    );

    // ปุ่มแสดงผล
    if(btnStart) btnStart.style.display = 'none';
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
      'พักก่อน หายใจลึกๆ แล้วค่อยกด Resume ต่อ 💫',
      'Paused. Take a breath and hit Resume when ready 💫'
    );
    if(btnPause) btnPause.style.display = 'none';
    if(btnResume) btnResume.style.display = 'inline-flex';
  }

  function resumeGame(){
    if(state !== 'paused') return;
    state = 'running';
    setCoach(
      'ลุยต่อ! เก็บคอมโบให้ถึง FEVER อีกครั้ง! 🔥',
      'Let’s continue! Build combo to FEVER again! 🔥'
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
      titleTh = 'สุดยอด! ระดับจอมยุทธ์ Shadow! 🏆';
      titleEn = 'Amazing! Shadow master level! 🏆';
    }else if(acc >= 85 && hits >= 40){
      rank = 'A';
      titleTh = 'เยี่ยมมาก! ความแม่นยำสูง 👍';
      titleEn = 'Great job! High accuracy 👍';
    }else if(acc >= 70){
      rank = 'B';
      titleTh = 'ใช้ได้เลย! ถ้าซ้อมอีกนิดจะยิ่งดี ✨';
      titleEn = 'Good! With more practice you’ll be great ✨';
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
      timestamp: new Date().toISOString()
    };

    if(resRankEl) resRankEl.textContent = rank;
    if(resTitleEl) resTitleEl.textContent = (lang==='th' ? titleTh : titleEn);
    if(resScoreEl) resScoreEl.textContent = score;
    if(resHitEl) resHitEl.textContent = hits;
    if(resMissEl) resMissEl.textContent = misses;
    if(resComboEl) resComboEl.textContent = 'x' + maxCombo;
    if(resAccEl) resAccEl.textContent = acc.toFixed(1) + '%';
    if(resTimeEl) resTimeEl.textContent = usedTime + 's';
    if(resModeEl){
      var diffLabel = (difficulty==='easy' ? 'Easy'
        : difficulty==='hard' ? 'Hard' : 'Normal');
      var modeLabel = (mode==='endless' ? 'Endless' : 'Timed');
      resModeEl.textContent = modeLabel + ' · ' + diffLabel;
    }
    if(resultCard) resultCard.style.display = 'flex';

    if(btnStart) btnStart.style.display = 'inline-flex';
    if(btnPause) btnPause.style.display = 'none';
    if(btnResume) btnResume.style.display = 'none';

    // ripple FX
    var ripple = document.createElement('div');
    ripple.className = 'sb-finish-ripple';
    document.body.appendChild(ripple);
    setTimeout(function(){
      if(ripple.parentNode) ripple.parentNode.removeChild(ripple);
    }, 600);

    setCoach(
      'จบเกมแล้ว! ดูผลคะแนนด้านล่าง แล้วลองเล่นใหม่อีกครั้งได้เลย 🔁',
      'Session finished! Check your results below and try again 🔁'
    );
  }

  // ----- Download "PDF" (เปิดหน้า Print ได้) -----
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
    html += '</table>';
    html += '<p style="margin-top:12px;font-size:12px;">'
      + (lang==='th'
        ? 'สามารถใช้คำสั่ง Print (Ctrl+P / Share → Print) แล้วเลือก Save as PDF เพื่อบันทึกไฟล์.'
        : 'Use the Print command (Ctrl+P or Share → Print) and choose "Save as PDF" to export.')
      + '</p>';
    html += '</body></html>';

    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  // ----- Bind ปุ่ม -----
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

  // ---- Auto message ตอนโหลดเสร็จ ----
  setCoach(
    'พร้อมแล้วกดปุ่ม "เริ่มเล่น" ด้านล่าง เพื่อเริ่มทดสอบ Shadow Breaker 🔥',
    'Press "Start" below when you are ready to train with Shadow Breaker 🔥'
  );
  updateHUD();
})();