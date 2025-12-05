// === /herohealth/vr-goodjunk/GameEngine.js ===
// Hero Health — Good vs Junk VR (QuestDirector Edition)
// 2025-12-05 Production Build

'use strict';

import { makeQuestDirector } from './quest-director.js';
import { GOODJUNK_GOALS, GOODJUNK_MINIS } from './quest-defs-goodjunk.js';

const A = window.AFRAME;
if (!A) console.error('[GoodJunkVR] AFRAME not found');

export const GameEngine = (() => {
  // ---------- State ----------
  let state = {
    score: 0,
    goodHits: 0,
    miss: 0,
    combo: 0,
    comboMax: 0,
    timeLeft: 60,
  };

  let diffKey = 'normal';
  let qdir = null;
  let spawnLoop = null;

  const FEVER_SCORE_BONUS = 2;
  const SPAWN_INTERVAL = 1200; // ms
  const MAX_TARGETS = 5;
  let feverMode = false;
  let targets = [];

  // ---------- Helper ----------
  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }

  // ---------- Quest + HUD ----------
  function emitScore() {
    window.dispatchEvent(new CustomEvent('hha:score', {
      detail: {
        score: state.score,
        combo: state.combo,
        misses: state.miss
      }
    }));
  }

  function emitCoach(msg, ms = 1800) {
    window.dispatchEvent(new CustomEvent('hha:coach', { detail: { text: msg, ms } }));
  }

  function updateQuest() {
    if (qdir) qdir.update(state);
  }

  // ---------- Target System ----------
  function spawnTarget() {
    const root = document.querySelector('#target-root') || document.querySelector('a-scene');
    if (!root) return;
    if (targets.length >= MAX_TARGETS) return;

    const isGood = Math.random() < 0.65;
    const emoji = isGood ? '🍎' : '🍔';
    const color = isGood ? '#22c55e' : '#f97316';

    const el = document.createElement('a-entity');
    el.setAttribute('text', {
      value: emoji,
      align: 'center',
      color: color,
      width: 4
    });
    el.setAttribute('position', `${rand(-2.2, 2.2)} ${rand(1.2, 2.4)} -3`);
    el.setAttribute('data-hha-tgt', isGood ? 'good' : 'junk');
    root.appendChild(el);

    const fallSpeed = 0.012;
    const lifespan = 4500;
    const born = performance.now();

    function tick() {
      const t = performance.now() - born;
      const y = 2.4 - (t * fallSpeed);
      el.object3D.position.y = y;
      if (y < 0.5) {
        el.remove();
        removeTarget(el);
        state.miss++;
        state.combo = 0;
        emitScore();
        updateQuest();
        emitCoach('พลาดเป้า! โฟกัสใหม่นะ 👀');
      } else if (t < lifespan) {
        requestAnimationFrame(tick);
      }
    }
    requestAnimationFrame(tick);

    el.addEventListener('click', () => {
      removeTarget(el);
      el.remove();

      if (isGood) {
        const gain = feverMode ? 200 : 100;
        state.score += gain;
        state.goodHits++;
        state.combo++;
        state.comboMax = Math.max(state.comboMax, state.combo);

        if (state.combo > 0 && state.combo % 10 === 0) {
          emitCoach('สุดยอด! คอมโบ x' + state.combo + ' 🔥');
        }

        emitScore();
        updateQuest();
      } else {
        state.miss++;
        state.combo = 0;
        emitScore();
        updateQuest();
        emitCoach('อย่าเลือกของขยะนะ 🥺');
      }
    });

    targets.push(el);
  }

  function removeTarget(el) {
    const i = targets.indexOf(el);
    if (i >= 0) targets.splice(i, 1);
  }

  // ---------- Game Control ----------
  function start(diff = 'normal', duration = 60) {
    diffKey = diff;
    state = {
      score: 0,
      goodHits: 0,
      miss: 0,
      combo: 0,
      comboMax: 0,
      timeLeft: duration
    };

    qdir = makeQuestDirector({
      diff,
      goalDefs: GOODJUNK_GOALS,
      miniDefs: GOODJUNK_MINIS,
      maxGoals: 2,
      maxMini: 3
    });
    qdir.start({ timeLeft: duration });

    // clear old
    if (spawnLoop) clearInterval(spawnLoop);
    targets.forEach(t => t.remove());
    targets = [];

    // start spawn loop
    spawnLoop = setInterval(() => {
      spawnTarget();
    }, SPAWN_INTERVAL);

    emitCoach('เริ่มเกม! เลือกของดีเข้าร่างกาย 💪');
  }

  function tickTime(secLeft) {
    state.timeLeft = secLeft;
    updateQuest();
  }

  function stop() {
    if (spawnLoop) clearInterval(spawnLoop);
    spawnLoop = null;

    const sum = qdir ? qdir.summary() : {
      goalsCleared: 0, goalsTotal: 0, miniCleared: 0, miniTotal: 0
    };

    window.dispatchEvent(new CustomEvent('hha:end', {
      detail: {
        scoreFinal: state.score,
        comboMax: state.comboMax,
        misses: state.miss,
        goalsCleared: sum.goalsCleared,
        goalsTotal: sum.goalsTotal,
        miniCleared: sum.miniCleared,
        miniTotal: sum.miniTotal
      }
    }));

    emitCoach('จบเกมแล้ว! เยี่ยมมาก 🎉');
  }

  return {
    start,
    tickTime,
    stop
  };
})();
