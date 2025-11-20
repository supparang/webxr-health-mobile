// === fitness/js/rhythm-engine.js
// Rhythm Boxer — 3 Lanes + Bloom Bar + SFX (2025-11-20)

'use strict';

/**
 * สร้าง engine สำหรับ Rhythm Boxer
 *
 * options:
 *  - diff: 'easy' | 'normal' | 'hard'
 *  - track: { id, name, bpm, duration, phaseLabel }
 *  - root: element พื้นที่เล่น (optional, ถ้าไม่ส่งจะหา .rb-play-root เอง)
 *  - laneRoot: element ที่ใช้วางโน้ต (optional, ถ้าไม่ส่งจะหา #rb-lanes)
 *  - hitline: element เส้น timing (optional, ถ้าไม่ส่งจะหา .rb-hitline)
 *  - onUpdateHUD(stats)
 *  - onBloomChange(bloom)    // 0..1
 *  - onEnd(result)
 *  - sfx: {
 *      bgmWarmup?, bgmDance?, bgmCool?,
 *      hit?, perfect?, miss?, clear?, combo?
 *    }                       // HTMLAudioElement แต่ละตัว (ไม่จำเป็นต้องส่งครบ)
 */
export function initRhythmEngine(options = {}) {
  const diff  = options.diff  || 'easy';
  const track = options.track || {
    id: 'track1',
    name: 'Track 1 — Warm-up Mix',
    bpm: 105,
    duration: 60,
    phaseLabel: 'WARM UP'
  };

  const root     = options.root     || document.querySelector('.rb-play-root') || document.body;
  const laneRoot = options.laneRoot || document.getElementById('rb-lanes') || root;
  const hitline  = options.hitline  || root.querySelector('.rb-hitline');

  const onHUD   = typeof options.onUpdateHUD === 'function' ? options.onUpdateHUD : noop;
  const onBloom = typeof options.onBloomChange === 'function' ? options.onBloomChange : noop;
  const onEnd   = typeof options.onEnd === 'function' ? options.onEnd : noop;
  const sfx     = options.sfx || {};

  // ----- ค่าคงที่หลัก -----
  const LANES = [0, 1, 2]; // LOW / MID / HIGH

  // เวลาเดินทางจากจุดเกิด → เส้น hit (วินาที)
  const NOTE_TRAVEL_TIME = 1.6;

  // window สำหรับ Perfect / Good / Miss (วินาที)
  const HIT_WINDOW = {
    perfect: 0.08,
    good:    0.18,
    miss:    0.26
  };

  // Bloom bar: 0..1
  const BLOOM_DELTA = {
    perfect: 0.04,
    good:    0.02,
    miss:   -0.06
  };

  // ความหนาแน่นโน้ตพื้นฐานแต่ละเลนตามระดับความยาก
  function pickDensity(track, diff) {
    // base = ความน่าจะเป็นที่เลนนั้นจะ "อยากออก" โน้ตในแต่ละ beat
    if (diff === 'easy') {
      return [0.35, 0.25, 0.20];
    }
    if (diff === 'normal') {
      return [0.55, 0.45, 0.40];
    }
    // hard
    return [0.75, 0.65, 0.60];
  }

  // ---------- สถานะภายใน ----------
  const notes = [];      // ทั้งหมดของเพลง
  let activeNotes = [];  // ที่ spawn แล้ว และยังไม่จบ
  let running  = false;
  let started  = false;
  let startT   = 0;      // performance.now (ms)
  let elapsed  = 0;      // วินาที

  const stats = {
    mode: 'normal',
    diff,
    trackName: track.name,
    phase: track.phaseLabel || 'WARM UP',
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfect: 0,
    miss: 0,
    timeLeft: track.duration,
    timeElapsed: 0
  };

  let bloom = 0;  // 0..1

  // ---------- เตรียม layout lanes ----------
  prepareLanes(laneRoot, hitline);

  // สร้าง pattern โน้ตทั้งเพลง
  generateAllNotes();

  // เรียก HUD ครั้งแรก
  onHUD({ ...stats, bloom });

  // ---------- API ที่ส่งออก ----------
  const api = {
    start,
    stop,
    isRunning: () => running,
    getStats: () => ({ ...stats, bloom }),
    registerHitFromKey
  };

  attachKeyboard(api);

  return api;

  // =====================================================================
  //                                CORE
  // =====================================================================

  function start() {
    if (started) return;
    started = true;
    running = true;
    startT  = performance.now();
    elapsed = 0;

    // reset stats
    stats.score = 0;
    stats.combo = 0;
    stats.maxCombo = 0;
    stats.perfect = 0;
    stats.miss = 0;
    stats.timeLeft = track.duration;
    stats.timeElapsed = 0;
    bloom = 0;
    onBloom(bloom);

    // reset state notes
    activeNotes = [];
    for (const n of notes) {
      n.spawned = false;
      n.hit = false;
      n.judged = false;
      n.el = null;
    }

    playPhaseBGM(track.phaseLabel);

    requestAnimationFrame(tick);
  }

  function stop(reason = 'finished') {
    if (!running && !started) return;
    running = false;
    started = false;

    stopAllBGM();

    // ลบโน้ตที่เหลือจากจอ
    for (const n of activeNotes) {
      if (n.el && n.el.parentNode) {
        n.el.parentNode.removeChild(n.el);
      }
    }
    activeNotes = [];

    onEnd({
      ...stats,
      bloom,
      reason
    });
  }

  function tick(nowMs) {
    if (!running) return;

    elapsed = (nowMs - startT) / 1000;
    stats.timeElapsed = Math.min(elapsed, track.duration);
    stats.timeLeft = Math.max(track.duration - elapsed, 0);

    // spawn โน้ตที่ถึงเวลา
    spawnNotesUpTo(elapsed);

    // อัพเดทตำแหน่งโน้ตที่กำลังตก
    updateActiveNotes(elapsed);

    // auto miss ถ้าเลย window
    autoJudgeMiss(elapsed);

    // HUD
    onHUD({ ...stats, bloom });

    // จบเพลง
    if (elapsed >= track.duration + 1.0) {
      sfx.clear && safePlay(sfx.clear);
      stop('finished');
      return;
    }

    requestAnimationFrame(tick);
  }

  // =====================================================================
  //                           NOTE GENERATION
  // =====================================================================

  function generateAllNotes() {
    notes.length = 0;
    const beat = 60 / track.bpm;
    const densities = pickDensity(track, diff);

    const startOffset = 2.0;               // ช่วงก่อนโน้ตแรก
    const endTime = track.duration - 0.8;  // buffer ท้ายเพลง

    // จำกัดจำนวนโน้ตพร้อมกันต่อ 1 beat ตามระดับความยาก
    const maxSimul =
      diff === 'easy'   ? 1 :
      diff === 'normal' ? 2 : 3;

    // โอกาสที่จะยอมให้ “chord” (มากกว่า 1 เลน)
    const chordBias =
      diff === 'easy'   ? 0.05 :
      diff === 'normal' ? 0.25 : 0.5;

    let t = startOffset;

    while (t < endTime) {
      const candidates = [];

      for (let lane = 0; lane < 3; lane++) {
        if (Math.random() < densities[lane]) {
          candidates.push(lane);
        }
      }

      if (candidates.length > 0) {
        let lanesToUse = [...candidates];

        // ไม่เกิน maxSimul
        while (lanesToUse.length > maxSimul) {
          const idx = (Math.random() * lanesToUse.length) | 0;
          lanesToUse.splice(idx, 1);
        }

        // easy/normal → ลดโอกาส chord อีกชั้น
        if (lanesToUse.length > 1 && Math.random() > chordBias && diff !== 'hard') {
          const onlyOne = lanesToUse[(Math.random() * lanesToUse.length) | 0];
          lanesToUse = [onlyOne];
        }

        for (const lane of lanesToUse) {
          notes.push({
            id: notes.length,
            lane,
            time: t,                          // เวลา “ต้องตี”
            spawnTime: t - NOTE_TRAVEL_TIME,  // เวลาเริ่มตก
            spawned: false,
            hit: false,
            judged: false,
            el: null
          });
        }
      }

      t += beat;
    }

    notes.sort((a, b) => a.time - b.time);
  }

  function spawnNotesUpTo(tNow) {
    for (const n of notes) {
      if (n.spawned) continue;
      if (tNow >= n.spawnTime) {
        n.spawned = true;
        const el = makeNoteElement(n);
        n.el = el;
        activeNotes.push(n);
      } else {
        // notes ถัดไปยังไม่ถึงเวลาเพราะ sort แล้ว
        break;
      }
    }
  }

  function updateActiveNotes(tNow) {
    const areaRect = laneRoot.getBoundingClientRect();
    const hitRect  = hitline
      ? hitline.getBoundingClientRect()
      : { top: areaRect.bottom - 32 };

    const travel = hitRect.top - areaRect.top; // px

    for (const n of activeNotes) {
      if (!n.el) continue;
      const life = (tNow - n.spawnTime) / NOTE_TRAVEL_TIME;
      const clamped = Math.min(Math.max(life, 0), 1.2);

      const y = areaRect.top + travel * clamped;
      const localY = y - areaRect.top;

      n.el.style.transform = `translate3d(0, ${localY}px, 0)`;
      n.el.dataset.life = clamped.toFixed(3);
    }

    // ลบโน้ตที่เลยไปไกลมาก (ลด DOM)
    activeNotes = activeNotes.filter(n => {
      if (!n.judged && (tNow - n.time) > HIT_WINDOW.miss + 0.4) {
        // ควรโดน auto-miss ใน autoJudgeMiss แล้ว แต่กันเผื่อไว้
        markMiss(n);
      }
      if (!n.el) return false;
      const life = parseFloat(n.el.dataset.life || '0');
      if (life > 1.3) {
        if (n.el.parentNode) n.el.parentNode.removeChild(n.el);
        return false;
      }
      return true;
    });
  }

  function autoJudgeMiss(tNow) {
    for (const n of notes) {
      if (n.judged) continue;
      const dt = tNow - n.time;
      if (dt > HIT_WINDOW.miss) {
        // ยังไม่ถูกตีภายใน miss window → นับ miss
        markMiss(n);
      }
    }
  }

  // =====================================================================
  //                                HIT LOGIC
  // =====================================================================

  function registerHitFromKey(lane) {
    if (!running) return;
    const tNow = elapsed;

    // หา note ที่อยู่ใกล้เวลานี้ที่สุดใน lane นั้น
    let best = null;
    let bestDt = Infinity;

    for (const n of notes) {
      if (n.lane !== lane) continue;
      if (n.judged) continue;
      const dt = Math.abs(tNow - n.time);
      if (dt < bestDt) {
        bestDt = dt;
        best = n;
      }
    }

    if (!best || bestDt > HIT_WINDOW.miss) {
      // whiff
      whiff();
      return;
    }

    // Perfect / Good / Miss (แบบ hit ช้า/เร็วมาก ๆ)
    const signedDt = tNow - best.time;
    let grade = 'miss';
    if (bestDt <= HIT_WINDOW.perfect) grade = 'perfect';
    else if (bestDt <= HIT_WINDOW.good) grade = 'good';

    if (grade === 'miss') {
      markMiss(best);
    } else {
      markHit(best, grade, signedDt);
    }
  }

  function markHit(note, grade, signedDt) {
    note.judged = true;
    note.hit = true;

    if (note.el) {
      note.el.classList.add('rb-note-hit', `rb-note-${grade}`);
      // เพิ่มนิดหน่อยให้เห็น effect ก่อนลบ
      setTimeout(() => {
        if (note.el && note.el.parentNode) note.el.parentNode.removeChild(note.el);
        note.el = null;
      }, 160);
    }

    stats.combo += 1;
    stats.maxCombo = Math.max(stats.maxCombo, stats.combo);

    const base = grade === 'perfect' ? 100 : 60;
    const comboBonus = Math.floor(stats.combo / 5) * 5;
    stats.score += base + comboBonus;

    if (grade === 'perfect') stats.perfect += 1;

    applyBloomDelta(grade);

    if (grade === 'perfect') {
      sfx.perfect && safePlay(sfx.perfect);
    } else {
      sfx.hit && safePlay(sfx.hit);
    }

    // combo SFX เล็กน้อย
    if (stats.combo > 0 && stats.combo % 10 === 0 && sfx.combo) {
      safePlay(sfx.combo);
    }
  }

  function markMiss(note) {
    note.judged = true;
    note.hit = false;
    stats.miss += 1;
    stats.combo = 0;

    if (note.el) {
      note.el.classList.add('rb-note-miss');
      setTimeout(() => {
        if (note.el && note.el.parentNode) note.el.parentNode.removeChild(note.el);
        note.el = null;
      }, 140);
    }

    applyBloomDelta('miss');
    sfx.miss && safePlay(sfx.miss);
  }

  function whiff() {
    // กดผิดจังหวะจนไม่โดนโน้ตไหนเลย
    stats.miss += 1;
    stats.combo = 0;
    applyBloomDelta('miss');
    sfx.miss && safePlay(sfx.miss);
  }

  function applyBloomDelta(kind) {
    const delta = BLOOM_DELTA[kind] || 0;
    bloom = clamp(bloom + delta, 0, 1);
    onBloom(bloom);
  }

  // =====================================================================
  //                              DOM HELPERS
  // =====================================================================

  function prepareLanes(rootEl, hitEl) {
    if (!rootEl) return;

    rootEl.classList.add('rb-lanes');

    // สร้าง lanes ถ้ายังไม่มี
    if (!rootEl.querySelector('.rb-lane')) {
      for (let lane = 0; lane < 3; lane++) {
        const laneEl = document.createElement('div');
        laneEl.className = 'rb-lane';
        laneEl.dataset.lane = String(lane);
        rootEl.appendChild(laneEl);
      }
    }

    if (hitEl) {
      hitEl.classList.add('rb-hitline-visible');
    }
  }

  function makeNoteElement(note) {
    const laneEl = laneRoot.querySelector(`.rb-lane[data-lane="${note.lane}"]`) || laneRoot;

    const el = document.createElement('div');
    el.className = 'rb-note';
    el.dataset.id = String(note.id);
    el.dataset.lane = String(note.lane);

    // เลือก emoji ต่างกันนิด ๆ
    const emoji =
      note.lane === 0 ? '💧' :
      note.lane === 1 ? '✨' : '🔥';

    el.textContent = emoji;

    laneEl.appendChild(el);
    return el;
  }

  // =====================================================================
  //                               SFX / BGM
  // =====================================================================

  function playPhaseBGM(phase) {
    stopAllBGM();
    if (!sfx) return;
    const ph = (phase || '').toLowerCase();
    if (ph.includes('warm')) {
      sfx.bgmWarmup && loopPlay(sfx.bgmWarmup);
    } else if (ph.includes('cool')) {
      sfx.bgmCool && loopPlay(sfx.bgmCool);
    } else {
      sfx.bgmDance && loopPlay(sfx.bgmDance);
    }
  }

  function stopAllBGM() {
    ['bgmWarmup', 'bgmDance', 'bgmCool'].forEach(key => {
      const a = sfx[key];
      if (!a) return;
      a.pause();
      a.currentTime = 0;
    });
  }

  // =====================================================================
  //                            INPUT HANDLING
  // =====================================================================

  function attachKeyboard(api) {
    window.addEventListener('keydown', (ev) => {
      const key = ev.key.toLowerCase();
      let lane = null;
      // mapping แบบ B: S / D / F = LOW / MID / HIGH และ Space = ทั้งหมด
      if (key === 's' || key === 'arrowleft') lane = 0;
      else if (key === 'd' || key === 'arrowdown') lane = 1;
      else if (key === 'f' || key === 'arrowright') lane = 2;
      else if (key === ' ') {
        // Space → เลือก lane มีโน้ตใกล้สุด
        lane = pickBestLaneForSpace();
      }

      if (lane != null) {
        ev.preventDefault();
        api.registerHitFromKey(lane);
      }
    }, { passive: false });
  }

  function pickBestLaneForSpace() {
    const tNow = elapsed;
    let bestLane = 1;
    let bestDt = Infinity;
    for (const lane of LANES) {
      for (const n of notes) {
        if (n.lane !== lane || n.judged) continue;
        const dt = Math.abs(tNow - n.time);
        if (dt < bestDt) {
          bestDt = dt;
          bestLane = lane;
        }
      }
    }
    return bestLane;
  }
}

// =======================================================================
//                            SMALL HELPERS
// =======================================================================

function clamp(v, a, b) {
  return v < a ? a : (v > b ? b : v);
}
function noop() {}
function safePlay(aud) {
  try {
    aud.currentTime = 0;
    const p = aud.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch (e) { /* ignore */ }
}
function loopPlay(aud) {
  try {
    aud.loop = true;
    const p = aud.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch (e) { /* ignore */ }
}
