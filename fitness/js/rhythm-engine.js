// === /fitness/js/rhythm-engine.js
// Rhythm Boxer Engine (3 lanes + Bloom/Fever + SFX)
// ใช้ร่วมกับ rhythm-boxer.html และ rhythm-boxer.js
'use strict';

export function initRhythmEngine () {
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  // ----- VIEW -----
  const viewMenu   = $('#view-menu');
  const viewPlay   = $('#view-play');
  const viewResult = $('#view-result');

  if (!viewMenu || !viewPlay) {
    console.warn('[RhythmBoxer] Missing views, abort init()');
    return;
  }

  // ----- HUD (PLAY) -----
  const elTrackLabel = $('#stat-track');
  const elMode       = $('#stat-mode');
  const elDiff       = $('#stat-diff');
  const elScore      = $('#stat-score');
  const elCombo      = $('#stat-combo');
  const elPerfect    = $('#stat-perfect');
  const elMiss       = $('#stat-miss');
  const elTime       = $('#stat-time');

  // BLOOM / FEVER
  const elBloomFill  = $('#bloom-fill');
  const elBloomLabel = $('#bloom-label');

  // LANES
  const laneLow  = $('#lane-low');
  const laneMid  = $('#lane-mid');
  const laneHigh = $('#lane-high');
  const hitLine  = $('#hit-line');        // เส้นตีโน้ต (เอา offsetTop ไว้อ้างอิง)

  const lanes = { low: laneLow, mid: laneMid, high: laneHigh };

  // ----- RESULT VIEW -----
  const resMode    = $('#res-mode');
  const resDiff    = $('#res-diff');
  const resTrack   = $('#res-track');
  const resScore   = $('#res-score');
  const resCombo   = $('#res-maxcombo');
  const resPerfect = $('#res-perfect');
  const resMiss    = $('#res-miss');
  const resAcc     = $('#res-accuracy');

  // ----- MENU CONTROL -----
  const selDiff  = $('#difficulty');   // <select>
  const selTrack = $('#track');        // <select>

  const btnStartNormal   = $('[data-action="start-normal"]');
  const btnStartResearch = $('[data-action="start-research"]');

  // ----- PLAY / RESULT BUTTON -----
  const btnStopEarly = $('[data-action="stop-early"]');
  const btnPlayAgain = $('[data-action="play-again"]');
  const btnBackMenu2 = $('#btn-back-menu'); // ปุ่มกลับเมนูในหน้า Result

  // ----- AUDIO (ใช้ไฟล์ตาม list ที่ส่งมา) -----
  // bgm: warm-up = warm-up.mp3, dance = combo.mp3, cooldown = clear.mp3
  const bgmWarmup = $('#bgm-warmup');   // src="./sfx/warm-up.mp3"
  const bgmDance  = $('#bgm-dance');    // src="./sfx/combo.mp3"
  const bgmCool   = $('#bgm-cool');     // src="./sfx/clear.mp3"

  // sfx: กดโดน / perfect / miss / จบรอบ
  const sfxHit     = $('#sfx-hit');      // src="./sfx/hit.mp3"
  const sfxPerfect = $('#sfx-perfect');  // src="./sfx/perfect.mp3"
  const sfxMiss    = $('#sfx-miss');     // src="./sfx/miss.mp3"
  const sfxClear   = $('#sfx-clear');    // src="./sfx/clear.mp3" หรือ heavy.wav ก็ได้

  const BGM_BY_TRACK = {
    warmup:   bgmWarmup,
    dance:    bgmDance,
    cooldown: bgmCool
  };

  // ----- CONFIG -----

  // ความยาก (อยากให้ช่วงเพลงยาวขึ้น/สั้นลง ปรับ lenSeconds ได้)
  const DIFF_CONFIG = {
    easy: {
      label: 'ง่าย',
      bpm: 90,
      spawnPerBeat: 0.75,   // โอกาสมีโน้ตต่อ 1 beat
      lenSeconds: 90,       // ความยาวฐาน (warmup ใช้ * 0.8, dance * 1.0, cooldown * 0.6)
      perfectWindow: 0.11,  // วินาที
      goodWindow: 0.20
    },
    normal: {
      label: 'ปกติ',
      bpm: 110,
      spawnPerBeat: 1.0,
      lenSeconds: 120,
      perfectWindow: 0.08,
      goodWindow: 0.16
    },
    hard: {
      label: 'ยาก',
      bpm: 130,
      spawnPerBeat: 1.4,
      lenSeconds: 150,
      perfectWindow: 0.07,
      goodWindow: 0.13
    }
  };

  // เลือกเพลง
  const TRACK_CONFIG = {
    warmup:   { label: 'Track 1 — Warm-up Mix',    phase: 'warmup'   },
    dance:    { label: 'Track 2 — Dance Groove',   phase: 'dance'    },
    cooldown: { label: 'Track 3 — Cool Down',      phase: 'cooldown' }
  };

  // track length multiplier (คูณกับ lenSeconds ตาม diff)
  const TRACK_LENGTH = {
    warmup:   0.8,
    dance:    1.0,
    cooldown: 0.6
  };

  // คะแนน Bloom / Fever
  const BLOOM_GAIN = {
    perfect: 4,
    good: 2,
    miss: -5
  };

  // Mapping ปุ่มบนคีย์บอร์ด → เลน
  const KEY_LANE = {
    KeyS:      'low',
    KeyD:      'mid',
    KeyF:      'high',
    ArrowLeft: 'low',
    ArrowDown: 'mid',
    ArrowRight:'high'
  };

  // ----- STATE -----
  let running = false;
  let mode   = 'normal';   // 'normal' | 'research'
  let diffId = 'normal';
  let trackId = 'warmup';

  let configDiff  = DIFF_CONFIG[diffId];
  let configTrack = TRACK_CONFIG[trackId];

  let startTime = 0;
  let elapsed   = 0;
  let totalLen  = 0;
  let rafId     = 0;

  const notes = [];        // schedule ทั้งหมด
  const activeNotes = [];  // ที่ spawn แล้ว

  let bloomValue = 0;      // 0..100

  // stats
  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let perfectCount = 0;
  let missCount = 0;
  let hitCount = 0;

  function clamp (v, min, max) {
    return v < min ? min : (v > max ? max : v);
  }

  function showView (which) {
    [viewMenu, viewPlay, viewResult].forEach(v => v && v.classList.add('hidden'));
    if (which === 'menu'   && viewMenu)   viewMenu.classList.remove('hidden');
    if (which === 'play'   && viewPlay)   viewPlay.classList.remove('hidden');
    if (which === 'result' && viewResult) viewResult.classList.remove('hidden');
  }

  function resetStats () {
    score = 0;
    combo = 0;
    maxCombo = 0;
    perfectCount = 0;
    missCount = 0;
    hitCount = 0;
    bloomValue = 0;
    updateHUD();
    updateBloom();
  }

  function stopAllBgm () {
    [bgmWarmup, bgmDance, bgmCool].forEach(a => {
      if (!a) return;
      try { a.pause(); a.currentTime = 0; } catch (e) {}
    });
  }

  function playBgm (id) {
    stopAllBgm();
    const el = BGM_BY_TRACK[id];
    if (!el) return;
    try {
      el.currentTime = 0;
      el.play().catch(() => {});
    } catch (e) {}
  }

  function playSfx (el) {
    if (!el) return;
    try {
      el.currentTime = 0;
      el.play().catch(() => {});
    } catch (e) {}
  }

  function updateHUD () {
    if (elMode)       elMode.textContent       = mode === 'research' ? 'วิจัย' : 'ปกติ';
    if (elDiff)       elDiff.textContent       = DIFF_CONFIG[diffId]?.label || '-';
    if (elTrackLabel) elTrackLabel.textContent = TRACK_CONFIG[trackId]?.label || '';
    if (elScore)      elScore.textContent      = String(score);
    if (elCombo)      elCombo.textContent      = String(combo);
    if (elPerfect)    elPerfect.textContent    = String(perfectCount);
    if (elMiss)       elMiss.textContent       = String(missCount);
  }

  function updateBloom () {
    const v = clamp(bloomValue, 0, 100);
    if (elBloomFill) {
      elBloomFill.style.width = v + '%';
    }
    if (elBloomLabel) {
      if (v >= 80)      elBloomLabel.textContent = 'FEVER';
      else if (v >=40)  elBloomLabel.textContent = 'GROOVE';
      else              elBloomLabel.textContent = 'BLOOM';
    }
  }

  function clearLanes () {
    Object.values(lanes).forEach(host => {
      if (!host) return;
      while (host.firstChild) host.removeChild(host.firstChild);
    });
    notes.length = 0;
    activeNotes.length = 0;
  }

  // ----- NOTE SCHEDULER -----
  function scheduleNotes () {
    clearLanes();
    configDiff  = DIFF_CONFIG[diffId];
    configTrack = TRACK_CONFIG[trackId] || TRACK_CONFIG.warmup;

    const diff = configDiff;
    const mult = TRACK_LENGTH[trackId] || 1;
    const lenSec = diff.lenSeconds * mult;
    totalLen = lenSec;

    const beatSec = 60 / diff.bpm;
    const totalBeats = Math.floor(lenSec / beatSec);
    const spawnPerBeat = diff.spawnPerBeat;

    let idCounter = 0;
    for (let i = 0; i < totalBeats; i++) {
      const beatTime = i * beatSec;

      // 0/1 โน้ตต่อ beat (ง่าย) สามารถเพิ่ม pattern ทีหลังได้
      const notesThisBeat = Math.random() < spawnPerBeat ? 1 : 0;
      for (let j = 0; j < notesThisBeat; j++) {
        const lane = ['low', 'mid', 'high'][Math.floor(Math.random() * 3)];
        const t = beatTime + j * (beatSec / (notesThisBeat || 1));
        notes.push({
          id: idCounter++,
          time: t,
          lane,
          spawned: false,
          resolved: false,
          dom: null
        });
      }
    }
  }

  function spawnNote (n) {
    const host = lanes[n.lane];
    if (!host) return;

    const el = document.createElement('div');
    el.className = 'rb-note rb-note-' + n.lane;   // แต่ง glow ใน rhythm-boxer.css
    el.dataset.id = String(n.id);
    host.appendChild(el);

    n.dom = el;
    n.spawned = true;
    activeNotes.push(n);
  }

  function despawnNote (n) {
    if (n.dom && n.dom.parentNode) {
      n.dom.parentNode.removeChild(n.dom);
    }
    n.dom = null;
    n.spawned = false;
    const idx = activeNotes.indexOf(n);
    if (idx !== -1) activeNotes.splice(idx, 1);
  }

  function registerMiss (n) {
    if (n.resolved) return;
    n.resolved = true;
    missCount++;
    combo = 0;
    bloomValue += BLOOM_GAIN.miss;
    updateBloom();
    updateHUD();
    playSfx(sfxMiss);
    despawnNote(n);
  }

  // อัปเดตตำแหน่ง note ทุก frame
  function updateNotes (dt, nowSec) {
    const scrollWindow = 1.4; // วินาที ตั้งแต่โผล่จนถึงเส้นตี
    const hitY = hitLine ? hitLine.offsetTop :
      (viewPlay ? viewPlay.clientHeight - 80 : 400);

    // spawn ใหม่
    for (const n of notes) {
      if (n.resolved || n.spawned) continue;
      if (nowSec >= n.time - scrollWindow) spawnNote(n);
    }

    // เลื่อนลง + ตรวจ miss
    for (const n of activeNotes.slice()) {
      if (!n.dom) continue;

      const t = (nowSec - (n.time - scrollWindow)) / scrollWindow;
      const clamped = clamp(t, 0, 1.1);
      const y = hitY * clamped;
      n.dom.style.transform = `translateY(${y}px)`;

      const late = nowSec - n.time;
      if (!n.resolved && late > configDiff.goodWindow) {
        registerMiss(n);
      }
    }
  }

  // กดปุ่ม / แตะหน้าจอ → ตี lane
  function registerHit (lane) {
    if (!running) return;

    const nowSec = elapsed;
    const diff = configDiff;

    let best = null;
    let bestAbs = Infinity;

    for (const n of notes) {
      if (n.resolved || n.lane !== lane) continue;
      const d = nowSec - n.time;
      const ad = Math.abs(d);
      if (ad < bestAbs) {
        bestAbs = ad;
        best = n;
      }
    }

    if (!best) {
      // ไม่มีโน้ตในเลน → miss เปล่า
      missCount++;
      combo = 0;
      bloomValue += BLOOM_GAIN.miss;
      updateBloom();
      updateHUD();
      playSfx(sfxMiss);
      return;
    }

    const ad = bestAbs;
    let grade = 'miss';
    let gain = BLOOM_GAIN.miss;
    let scoreGain = 0;

    if (ad <= diff.perfectWindow) {
      grade = 'perfect';
      gain = BLOOM_GAIN.perfect;
      scoreGain = 300;
      perfectCount++;
      playSfx(sfxPerfect);
      best.dom && best.dom.classList.add('rb-hit-perfect');
    } else if (ad <= diff.goodWindow) {
      grade = 'good';
      gain = BLOOM_GAIN.good;
      scoreGain = 150;
      playSfx(sfxHit);
      best.dom && best.dom.classList.add('rb-hit-good');
    } else {
      // ช้า/เร็วเกิน → miss
      missCount++;
      combo = 0;
      bloomValue += BLOOM_GAIN.miss;
      updateBloom();
      updateHUD();
      playSfx(sfxMiss);
      return;
    }

    best.resolved = true;
    hitCount++;

    combo++;
    if (combo > maxCombo) maxCombo = combo;

    score += scoreGain;
    bloomValue += gain;
    updateBloom();
    updateHUD();

    // ให้ note แตก/หายช้า ๆ
    setTimeout(() => despawnNote(best), 120);
  }

  // ----- GAME LOOP -----
  function loop (ts) {
    if (!running) return;
    if (!startTime) startTime = ts;
    elapsed = (ts - startTime) / 1000;

    if (elTime) {
      const remain = Math.max(0, totalLen - elapsed);
      elTime.textContent = remain.toFixed(1) + 's';
    }

    updateNotes(0, elapsed);

    if (elapsed >= totalLen + 1) {
      endGame('time');
      return;
    }

    rafId = window.requestAnimationFrame(loop);
  }

  function startGame (selectedMode) {
    mode   = selectedMode || 'normal';
    diffId = selDiff?.value  || 'normal';
    trackId = selTrack?.value || 'warmup';

    resetStats();
    scheduleNotes();
    updateHUD();
    updateBloom();

    showView('play');
    running = true;
    startTime = 0;
    elapsed = 0;

    if (rafId) cancelAnimationFrame(rafId);
    playBgm(trackId);
    rafId = requestAnimationFrame(loop);
  }

  function endGame (reason) {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    stopAllBgm();
    playSfx(sfxClear);

    if (viewResult) {
      if (resMode)    resMode.textContent    = mode === 'research' ? 'วิจัย' : 'ปกติ';
      if (resDiff)    resDiff.textContent    = DIFF_CONFIG[diffId]?.label || '-';
      if (resTrack)   resTrack.textContent   = TRACK_CONFIG[trackId]?.label || '-';
      if (resScore)   resScore.textContent   = String(score);
      if (resCombo)   resCombo.textContent   = String(maxCombo);
      if (resPerfect) resPerfect.textContent = String(perfectCount);
      if (resMiss)    resMiss.textContent    = String(missCount);
      if (resAcc) {
        const total = hitCount + missCount;
        const acc = total > 0 ? (hitCount / total * 100) : 0;
        resAcc.textContent = acc.toFixed(1) + '%';
      }
    }

    showView('result');
  }

  // ----- BIND EVENTS -----
  btnStartNormal && btnStartNormal.addEventListener('click', () => {
    startGame('normal');
  });

  btnStartResearch && btnStartResearch.addEventListener('click', () => {
    startGame('research');
  });

  btnStopEarly && btnStopEarly.addEventListener('click', () => {
    if (!running) return;
    endGame('manual');
  });

  btnPlayAgain && btnPlayAgain.addEventListener('click', () => {
    startGame(mode);
  });

  btnBackMenu2 && btnBackMenu2.addEventListener('click', () => {
    showView('menu');
  });

  // คีย์บอร์ด: S / D / F และลูกศร ซ้าย-กลาง-ขวา
  document.addEventListener('keydown', (ev) => {
    const lane = KEY_LANE[ev.code];
    if (!lane) return;
    ev.preventDefault();
    registerHit(lane);
  });

  // mobile / mouse tap บนแต่ละเลน
  ['low', 'mid', 'high'].forEach(lane => {
    const host = lanes[lane];
    if (!host) return;
    host.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      registerHit(lane);
    });
  });

  // ----- INIT -----
  showView('menu');
}
