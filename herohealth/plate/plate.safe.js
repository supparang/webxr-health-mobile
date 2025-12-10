// === /herohealth/plate/plate.safe.js ===
// Plate Game Engine — Research + Quest Progress Display
// Updated: 2025-12-10 (Goal/MiniQuest + visual quota display)

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { Particles } from '../vr/particles.js';
import { setFever, setShield, ensureFeverBar } from '../vr/ui-fever.js';
import { Quest } from './plate.quest.js';

export async function boot(opts = {}) {
  const diff = opts.difficulty || 'normal';
  const dur  = opts.duration  || 60;

  // ---------- CONFIG ----------
  const QUOTA = {
    easy:   [1, 1, 2, 2, 1],
    normal: [1, 1, 2, 2, 1],
    hard:   [1, 1, 2, 2, 1]
  }[diff] || [1, 1, 2, 2, 1];

  let score = 0, combo = 0, comboMax = 0, misses = 0;
  let fever = 0, feverActive = false;
  let platesDone = 0;
  let totalCounts = [0,0,0,0,0];
  let plateCounts = [0,0,0,0,0];
  const need = [...QUOTA];

  const questDeck = new Quest({
    goalCount: 2,
    miniCount: 3
  });

  // ---------- Factory Boot ----------
  const ctrl = await factoryBoot({
    modeKey: 'plate',
    difficulty: diff,
    duration: dur,
    onHit,
    onExpire,
    onEnd
  });

  ensureFeverBar();

  // ---------- GAME LOGIC ----------
  function onHit(ev) {
    const ch = ev.char || '';
    const g  = ev.group || 0;
    const x  = ev.cx || (window.innerWidth/2);
    const y  = ev.cy || (window.innerHeight/2);

    if (g > 0) {
      score += 10;
      combo++; comboMax = Math.max(combo, comboMax);
      totalCounts[g-1] += 1;
      plateCounts[g-1] += 1;

      Particles.burstAt(x, y, { good: true });
      Particles.scorePop(x, y, '+10', { good: true });

      pushQuest();
      checkPlate();
    } else {
      score = Math.max(0, score - 5);
      combo = 0;
      misses++;
      Particles.burstAt(x, y, { bad: true });
      Particles.scorePop(x, y, '-5', { bad: true });
    }

    syncHUD();
  }

  function onExpire(ev) {
    // ถ้าเป้าดีหลุดจอ จะถือว่า LATE
    if (ev?.isGood) Particles.scorePop(ev.cx, ev.cy, 'LATE', { good: true });
  }

  function checkPlate() {
    const complete = need.every((n, i) => plateCounts[i] >= n);
    if (complete) {
      platesDone++;
      plateCounts = [0,0,0,0,0];
      questDeck.clearGoalStep();
      pushQuest('เสิร์ฟจานสมดุลสำเร็จแล้ว 🎯');
      window.dispatchEvent(new CustomEvent('quest:cleared', { detail:{ cleared:[{type:'goal'}] } }));
      maybeFinish();
    }
  }

  function maybeFinish() {
    const q = questDeck.getProgress('mini');
    const g = questDeck.getProgress('goals');
    const doneAll = q.every(m => m.done) && g.every(m => m.done);
    if (doneAll) {
      setTimeout(() => endGame(), 1800);
    }
  }

  function onEnd() { endGame(); }

  function endGame() {
    ctrl.stop?.();

    const data = {
      mode: 'Balanced Plate',
      difficulty: diff,
      duration: dur,
      score, comboMax, misses,
      platesDone,
      totalCounts,
      groupCounts: totalCounts,
      goalsCleared: questDeck.countDone('goals'),
      goalsTotal:   questDeck.total('goals'),
      questsCleared: questDeck.countDone('mini'),
      questsTotal:   questDeck.total('mini'),
      grade: computeGrade(score)
    };

    window.dispatchEvent(new CustomEvent('hha:end', { detail:data }));
  }

  function computeGrade(v){
    if (v >= 200) return 'SSS';
    if (v >= 150) return 'SS';
    if (v >= 120) return 'S';
    if (v >= 100) return 'A';
    if (v >= 70)  return 'B';
    return 'C';
  }

  function pushQuest(hint) {
    const goals = questDeck.getProgress('goals');
    const minis = questDeck.getProgress('mini');
    const quotaNeed = [...need];
    const quotaHave = [...plateCounts];

    window.dispatchEvent(new CustomEvent('quest:update', {
      detail: {
        goal: goals.find(g => !g.done) || goals[0] || null,
        mini: minis.find(m => !m.done) || minis[0] || null,
        goalsAll: goals,
        minisAll: minis,
        hint: hint || '',
        quotaNeed,
        quotaHave
      }
    }));
  }

  function syncHUD() {
    const data = {
      score,
      combo,
      comboMax,
      misses,
      platesDone,
      grade: computeGrade(score),
      totalCounts,
      goalsCleared: questDeck.countDone('goals'),
      goalsTotal:   questDeck.total('goals'),
      questsCleared: questDeck.countDone('mini'),
      questsTotal:   questDeck.total('mini')
    };
    window.dispatchEvent(new CustomEvent('hha:stat', { detail:data }));
  }
}