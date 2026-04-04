// /herohealth/vr-groups/groups.solo.core.js
// Groups Solo Core Engine
// PATCH v20260404-groups-solo-core-r1

import {
  GROUPS_CATEGORIES,
  GROUPS_ITEMS,
  getDiffPreset,
  createBlankCategoryStats,
  pickRandomCategory,
  getCoachLine
} from './groups.data.js';

import {
  buildGroupsSummary,
  saveGroupsSummary,
  renderGroupsSummary
} from './groups.summary.js';

export const GROUPS_PATCH_CORE = 'v20260404-groups-solo-core-r1';

const FEVER_MS = 6000;
const PRACTICE_MS = 15000;

export function createGroupsSoloCore({
  ctx,
  ui,
  renderer,
  logger,
  ai,
  options = {}
} = {}){
  if (!ctx) throw new Error('createGroupsSoloCore requires ctx');
  if (!ui) throw new Error('createGroupsSoloCore requires ui');
  if (!renderer) throw new Error('createGroupsSoloCore requires renderer');

  const patch = options.patch || GROUPS_PATCH_CORE;
  const onBack = typeof options.onBack === 'function' ? options.onBack : null;
  const onReplay = typeof options.onReplay === 'function' ? options.onReplay : null;

  const rng = mulberry32(hashString(String(ctx.seed || Date.now())));
  const presetBase = getDiffPreset(ctx.diff || 'normal');
  let preset = { ...presetBase };

  const state = {
    phase: 'idle',
    running: false,
    practiceUsed: false,
    timeLeftMs: 0,
    goalCat: null,
    goalNeed: 0,
    goalDone: 0,
    score: 0,
    correct: 0,
    wrong: 0,
    miss: 0,
    streak: 0,
    bestStreak: 0,
    feverUntil: 0,
    feverCount: 0,
    items: new Map(),
    itemSeq: 0,
    loopId: 0,
    lastTs: 0,
    nextSpawnAt: 0,
    reactionSamples: [],
    statsByCat: createBlankCategoryStats(),
    centerShootHintShown: false,
    destroyed: false
  };

  const bound = {
    resize: null,
    pagehide: null,
    beforeunload: null,
    visibility: null,
    shoot: null,
    btnStartPractice: null,
    btnStartMain: null,
    btnGoHubIntro: null,
    btnReplayTop: null,
    btnReplaySummary: null,
    btnBackTop: null,
    btnBackSummary: null,
    btnRecenter: null
  };

  function boot(){
    if (state.destroyed) return api;

    if (ctx.debug) {
      window.__GROUPS_SOLO_CORE__ = api;
    }

    setCtxUi();
    renderer.mount();
    refreshStageRect();
    bindEvents();
    updateHud();

    showCoach(getCoachLine('intro', rng) || 'โค้ช: พร้อมแล้ว แตะ “เริ่มฝึกเลย” ได้เลย ✨');
    log('session_start', {
      patch,
      ctx: {
        pid: ctx.pid,
        name: ctx.name,
        studyId: ctx.studyId,
        diff: ctx.diff,
        timeSec: ctx.timeSec,
        seed: ctx.seed,
        hub: ctx.hub,
        view: ctx.view,
        run: ctx.run
      }
    });

    return api;
  }

  function destroy(){
    if (state.destroyed) return;
    state.destroyed = true;
    stopLoop();
    clearAllItems();
    flushLogs();

    unbindEvents();
    try{ renderer.destroy(); }catch{}
  }

  function bindEvents(){
    bound.resize = () => {
      refreshStageRect();
      setDebug();
    };
    bound.pagehide = () => flushLogs();
    bound.beforeunload = () => flushLogs();
    bound.visibility = () => {
      if (document.hidden) flushLogs();
    };
    bound.shoot = (ev) => onCrosshairShoot(ev);

    window.addEventListener('resize', bound.resize);
    window.addEventListener('pagehide', bound.pagehide, { passive:true });
    window.addEventListener('beforeunload', bound.beforeunload, { passive:true });
    document.addEventListener('visibilitychange', bound.visibility);
    window.addEventListener('hha:shoot', bound.shoot);

    bindClick(ui.btnStartPractice, 'btnStartPractice', () => startPractice());
    bindClick(ui.btnStartMain, 'btnStartMain', () => startMain());
    bindClick(ui.btnGoHubIntro, 'btnGoHubIntro', () => goHub());
    bindClick(ui.btnReplayTop, 'btnReplayTop', () => replay());
    bindClick(ui.btnReplaySummary, 'btnReplaySummary', () => replay());
    bindClick(ui.btnBackTop, 'btnBackTop', () => goHub());
    bindClick(ui.btnBackSummary, 'btnBackSummary', () => goHub());
    bindClick(ui.btnRecenter, 'btnRecenter', () => {
      renderer.showBanner('รีเซ็ตมุมมองแล้ว 🎯', 1200);
    });
  }

  function unbindEvents(){
    if (bound.resize) window.removeEventListener('resize', bound.resize);
    if (bound.pagehide) window.removeEventListener('pagehide', bound.pagehide);
    if (bound.beforeunload) window.removeEventListener('beforeunload', bound.beforeunload);
    if (bound.visibility) document.removeEventListener('visibilitychange', bound.visibility);
    if (bound.shoot) window.removeEventListener('hha:shoot', bound.shoot);

    unbindClick(ui.btnStartPractice, bound.btnStartPractice);
    unbindClick(ui.btnStartMain, bound.btnStartMain);
    unbindClick(ui.btnGoHubIntro, bound.btnGoHubIntro);
    unbindClick(ui.btnReplayTop, bound.btnReplayTop);
    unbindClick(ui.btnReplaySummary, bound.btnReplaySummary);
    unbindClick(ui.btnBackTop, bound.btnBackTop);
    unbindClick(ui.btnBackSummary, bound.btnBackSummary);
    unbindClick(ui.btnRecenter, bound.btnRecenter);
  }

  function bindClick(el, key, fn){
    if (!el) return;
    bound[key] = fn;
    el.addEventListener('click', fn);
  }

  function unbindClick(el, fn){
    if (!el || !fn) return;
    el.removeEventListener('click', fn);
  }

  function setCtxUi(){
    if (ui.ctxLine) {
      ui.ctxLine.textContent = `run=${ctx.run} • diff=${ctx.diff} • time=${ctx.timeSec} • view=${ctx.view}`;
    }
    if (ui.chipPlayer) {
      ui.chipPlayer.textContent = ctx.name || ctx.pid || 'anon';
    }
    if (ui.phaseTag) {
      ui.phaseTag.textContent = 'Practice';
    }
    if (ui.goalTag) {
      ui.goalTag.textContent = '🎯 เป้าหมายตอนนี้';
    }
    if (ui.goalTitle) {
      ui.goalTitle.textContent = 'แตะอาหารให้ถูกหมู่';
    }
    if (ui.goalSub) {
      ui.goalSub.textContent = 'ฝึกสั้นก่อน 15 วินาที แล้วค่อยเริ่มรอบจริง';
    }
  }

  function refreshStageRect(){
    renderer.refreshRect();
  }

  function startPractice(){
    stopLoop();
    resetRun(true);

    state.phase = 'practice';
    state.practiceUsed = true;
    state.timeLeftMs = PRACTICE_MS;
    state.running = true;
    state.lastTs = 0;
    state.nextSpawnAt = 0;
    state.goalNeed = 2;
    state.goalDone = 0;
    state.goalCat = pickCategory();

    hideOverlay(ui.introOverlay);
    hideOverlay(ui.midOverlay);
    hideOverlay(ui.summaryOverlay);

    setText(ui.phaseTag, 'Practice');
    setText(ui.goalSub, 'รอบฝึก 15 วินาที • ยังไม่คิดคะแนนจริง');
    showCoach('โค้ช: แตะอาหารให้ตรงกับหมู่ที่กำหนดนะ 💡');

    updateGoalText();
    updateHud();

    log('practice_start');
    loop(0);
  }

  function finishPractice(){
    state.running = false;
    stopLoop();
    clearAllItems();

    state.phase = 'ready';
    setText(ui.phaseTag, 'Ready');
    showOverlay(ui.midOverlay);
    renderer.showBanner('ฝึกเสร็จแล้ว!', 1200);
    showCoach(getCoachLine('ready', rng) || 'โค้ช: เก่งมาก! รอบต่อไปจะนับคะแนนจริงแล้ว 🚀');

    log('practice_end');
  }

  function startMain(){
    stopLoop();
    clearAllItems();

    state.phase = 'playing';
    state.running = true;
    state.timeLeftMs = Number(ctx.timeSec || 80) * 1000;
    state.lastTs = 0;
    state.nextSpawnAt = 0;
    state.goalNeed = presetBase.goalNeed;
    state.goalDone = 0;
    state.goalCat = pickCategory();
    state.centerShootHintShown = false;

    preset = ai?.adjustSpawn
      ? ai.adjustSpawn({ ...presetBase }, {
          wrong: state.wrong,
          streak: state.streak,
          miss: state.miss
        })
      : { ...presetBase };

    hideOverlay(ui.midOverlay);
    hideOverlay(ui.summaryOverlay);

    setText(ui.phaseTag, 'Main Run');
    setText(ui.goalSub, 'รอบจริง • เก็บให้ถูกหมู่ เร็วและแม่นที่สุด');

    const aiRoundInfo = ai?.onRoundStart ? ai.onRoundStart({ ctx, state: snapshotState() }) : null;
    const coachMsg = ai?.coachTip ? ai.coachTip({ wrong: state.wrong, miss: state.miss, streak: state.streak }) : '';
    showCoach(coachMsg || 'โค้ช: เริ่มรอบจริงแล้ว ลุยเลย! 🌟');

    updateGoalText();
    updateHud();

    log('main_start', { aiRoundInfo });
    loop(0);
  }

  function loop(ts){
    if (!state.running || state.destroyed) return;

    const now = ts || performance.now();
    if (!state.lastTs) state.lastTs = now;

    const dt = Math.min(48, Math.max(0, now - state.lastTs));
    state.lastTs = now;
    state.timeLeftMs = Math.max(0, state.timeLeftMs - dt);

    if (state.timeLeftMs <= 0){
      if (state.phase === 'practice') finishPractice();
      else finishGame();
      return;
    }

    refreshStageRect();

    if (now >= state.nextSpawnAt){
      spawnItem(now);
      state.nextSpawnAt = now + getSpawnEvery();
    }

    updateItems(dt, now);
    updateHud();
    setDebug();

    state.loopId = requestAnimationFrame(loop);
  }

  function stopLoop(){
    if (state.loopId){
      cancelAnimationFrame(state.loopId);
      state.loopId = 0;
    }
  }

  function getSpawnEvery(){
    if (state.phase === 'practice') return Math.round(preset.spawnMs * 1.15);
    return preset.spawnMs;
  }

  function getLifeMs(){
    if (state.phase === 'practice') return Math.round(preset.lifeMs * 1.16);
    return preset.lifeMs;
  }

  function getMaxItems(){
    if (state.phase === 'practice') return Math.max(3, preset.maxItems - 1);
    return preset.maxItems;
  }

  function spawnItem(now){
    if (state.items.size >= getMaxItems()) return;

    const data = GROUPS_ITEMS[Math.floor(rng() * GROUPS_ITEMS.length)];
    const size = Math.round(randRange(
      state.phase === 'practice' ? preset.sizeMax - 2 : preset.sizeMin,
      preset.sizeMax
    ));

    const safe = renderer.getSafeSpawnBounds({
      padLeft: 12,
      padRight: 12,
      padTop: 54,
      padBottom: 72
    });

    const x = randRange(safe.left, Math.max(safe.left + 1, safe.right - size));
    const y = -size - randRange(8, 40);

    const speedMul = state.phase === 'practice' ? 0.8 : 1;
    const vx = randRange(-34, 34) * (ctx.view === 'pc' ? 1 : 0.88);
    const vy = randRange(preset.speedMin, preset.speedMax) * speedMul;
    const ttl = Math.round(getLifeMs() * randRange(0.92, 1.08));

    const id = `fg-${++state.itemSeq}`;
    const item = {
      id,
      data,
      x,
      y,
      vx,
      vy,
      size,
      bornAt: now,
      ttl,
      dead: false,
      el: null
    };

    renderer.addItem(item, (itemId, hitTs) => {
      hitItem(itemId, hitTs);
    });

    state.items.set(id, item);
    renderer.drawItem(item);

    log('target_spawn', {
      itemId: id,
      item: data.id,
      group: data.group,
      phase: state.phase
    });
  }

  function updateItems(dt, now){
    const rect = renderer.getStageRect();
    const maxX = Math.max(0, rect.width);
    const maxY = Math.max(0, rect.height);

    state.items.forEach((item) => {
      if (!item || item.dead) return;

      item.x += (item.vx * dt) / 1000;
      item.y += (item.vy * dt) / 1000;

      if (item.x <= 6){
        item.x = 6;
        item.vx *= -1;
      } else if (item.x >= maxX - item.size - 6){
        item.x = maxX - item.size - 6;
        item.vx *= -1;
      }

      const age = now - item.bornAt;
      const fadeAt = item.ttl * 0.72;
      if (age > fadeAt){
        const left = Math.max(0.2, 1 - ((age - fadeAt) / (item.ttl - fadeAt + 1)));
        renderer.setItemOpacity(item, left);
      }

      if (age >= item.ttl || item.y > maxY - 40){
        const missedTarget = state.goalCat && item.data.group === state.goalCat.id;
        removeItem(item, missedTarget ? 'miss-target' : 'timeout');

        if (missedTarget && state.phase === 'playing'){
          state.miss += 1;
          state.streak = 0;
          state.statsByCat[state.goalCat.id].miss += 1;

          showCoach(getCoachLine('miss', rng) || 'โค้ช: อุ๊ย หลุดเป้าหมายไปแล้ว ลองใหม่อีกครั้งนะ');
          renderer.popFx(
            Math.max(40, item.x + item.size / 2),
            Math.max(60, Math.min(maxY - 90, item.y)),
            'MISS',
            'bad'
          );

          log('target_miss', {
            itemId: item.id,
            group: item.data.group,
            targetGroup: state.goalCat.id
          });

          maybeAiCoach();
        }

        updateHud();
        return;
      }

      renderer.drawItem(item);
    });
  }

  function hitItem(id, hitTs){
    const item = state.items.get(id);
    if (!item || item.dead) return;
    if (state.phase === 'summary' || state.phase === 'idle' || state.phase === 'ready') return;

    const isMatch = !!state.goalCat && item.data.group === state.goalCat.id;
    const reactionMs = Math.max(0, Math.round((hitTs || performance.now()) - item.bornAt));

    if (isMatch){
      if (state.phase === 'playing'){
        const fever = isFeverOn();
        const base = 10;
        const comboBonus = Math.min(8, state.streak);
        const scoreGain = (fever ? 2 : 1) * (base + comboBonus);

        state.score += scoreGain;
        state.correct += 1;
        state.goalDone += 1;
        state.streak += 1;
        state.bestStreak = Math.max(state.bestStreak, state.streak);
        state.statsByCat[item.data.group].correct += 1;
        pushReaction(reactionMs);

        renderer.setItemGlow(item, 'good');
        renderer.popFx(item.x + item.size/2, item.y + 16, fever ? `+${scoreGain} FEVER` : `+${scoreGain}`, 'good');

        if (state.streak > 0 && state.streak % 5 === 0){
          state.feverUntil = performance.now() + FEVER_MS;
          state.feverCount += 1;
          renderer.showBanner('FEVER!', 1200);
          showCoach(getCoachLine('fever', rng) || 'โค้ช: สุดยอด! เข้า FEVER แล้ว คะแนนคูณ 2 🔥');
          log('fever_start', { streak: state.streak });
        } else {
          showCoach(getCoachLine('playGood', rng) || 'โค้ช: เยี่ยมมาก! ถูกหมู่แล้ว ✅');
        }

        if (state.goalDone >= state.goalNeed){
          nextGoal();
        }
      } else {
        showCoach(getCoachLine('practiceGood', rng) || 'โค้ช: ถูกต้องเลย แบบนี้แหละ 💡');
      }

      log('target_hit_correct', {
        itemId: item.id,
        group: item.data.group,
        phase: state.phase,
        reactionMs
      });

      removeItem(item, 'hit-correct');
    } else {
      if (state.phase === 'playing'){
        state.wrong += 1;
        state.streak = 0;
        state.score = Math.max(0, state.score - 4);
        state.statsByCat[item.data.group].wrong += 1;

        renderer.setItemGlow(item, 'bad');
        renderer.popFx(item.x + item.size/2, item.y + 16, '-4', 'bad');
        showCoach(getCoachLine('playWrong', rng) || 'โค้ช: คนละหมู่นะ ลองดูไอคอนกับชื่อหมู่ใหม่อีกที');
      } else {
        showCoach(getCoachLine('practiceWrong', rng) || 'โค้ช: อันนี้ยังไม่ใช่หมู่เป้าหมายนะ');
      }

      log('target_hit_wrong', {
        itemId: item.id,
        group: item.data.group,
        targetGroup: state.goalCat?.id || '',
        phase: state.phase,
        reactionMs
      });

      removeItem(item, 'hit-wrong');
      maybeAiCoach();
    }

    updateHud();
  }

  function nextGoal(){
    const prev = state.goalCat;
    state.goalDone = 0;

    let next = pickCategory(prev?.id);
    if (prev && next.id === prev.id && GROUPS_CATEGORIES.length > 1){
      next = pickCategory(prev.id);
    }

    state.goalCat = next;
    updateGoalText();
    renderer.showBanner(`เป้าหมายใหม่: ${next.short} ${next.name}`, 1300);
    showCoach(`โค้ช: ต่อไปเก็บ ${next.short} ${next.name} ${next.icon}`);
    log('goal_change', { targetGroup: next.id });
  }

  function pickCategory(avoidId = ''){
    return pickRandomCategory(rng, avoidId);
  }

  function updateGoalText(){
    if (!state.goalCat) return;

    setText(ui.goalTitle, `เก็บ ${state.goalCat.short} ${state.goalCat.name} ${state.goalCat.icon}`);
    setText(ui.goalTag, `🎯 ${state.goalCat.short}`);

    if (state.phase === 'practice'){
      setText(ui.goalSub, `รอบฝึก • แตะให้ถูกหมู่จำนวน ${state.goalNeed} ชิ้น`);
    } else if (state.phase === 'playing'){
      setText(ui.goalSub, `รอบจริง • แตะให้ถูกหมู่จำนวน ${state.goalNeed} ชิ้นต่อเป้าหมาย`);
    }

    setText(ui.statGoal, `${state.goalDone} / ${state.goalNeed}`);
    renderer.setGoalProgress(state.goalDone, state.goalNeed);
  }

  function updateHud(){
    setText(ui.chipTime, formatTime(state.timeLeftMs));
    setText(ui.chipScore, String(state.score | 0));
    setText(ui.chipStreak, String(state.streak | 0));
    setText(ui.statAcc, `${Math.round(calcAccuracy())}%`);
    setText(ui.statMiss, String(state.miss | 0));
    setText(ui.statFever, isFeverOn()
      ? `${Math.max(1, Math.ceil((state.feverUntil - performance.now()) / 1000))}s`
      : 'Ready'
    );

    updateGoalText();
  }

  function finishGame(){
    state.running = false;
    stopLoop();
    clearAllItems();
    state.phase = 'summary';

    const summary = buildGroupsSummary({
      ctx,
      patch,
      state: snapshotState(),
      reactionSamples: state.reactionSamples
    });

    saveGroupsSummary(summary);
    renderGroupsSummary(ui, summary);

    showOverlay(ui.summaryOverlay);
    showCoach(summary.lead);

    log('summary_view', { summary });
    log('session_end', { summary });
    flushLogs();
  }

  function replay(){
    log('replay_click');
    flushLogs();

    if (onReplay){
      onReplay();
      return;
    }

    const u = new URL(location.href);
    u.searchParams.set('seed', String(Date.now()));
    location.href = u.toString();
  }

  function goHub(){
    log('return_hub_click');
    flushLogs();

    if (onBack){
      onBack();
      return;
    }

    location.href = ctx.hub;
  }

  function onCrosshairShoot(ev){
    if (!(ctx.view === 'cvr' || ctx.view === 'vr')) return;

    const detail = ev && ev.detail ? ev.detail : {};
    const x = Number.isFinite(detail.clientX) ? detail.clientX : window.innerWidth / 2;
    const y = Number.isFinite(detail.clientY) ? detail.clientY : window.innerHeight / 2;

    const itemId = renderer.getItemIdAtClientPoint(x, y);

    if (itemId){
      hitItem(itemId, performance.now());
    } else if (!state.centerShootHintShown) {
      state.centerShootHintShown = true;
      showCoach('โค้ช: เล็งกากบาทไว้กลางเป้าแล้วค่อยยิงนะ 🎯');
    }
  }

  function removeItem(item, reason){
    if (!item || item.dead) return;
    item.dead = true;
    state.items.delete(item.id);
    renderer.removeItem(item);

    log('target_remove', {
      itemId: item.id,
      reason
    });
  }

  function clearAllItems(){
    renderer.clearItems();
    state.items.clear();
  }

  function resetRun(keepMetrics = false){
    clearAllItems();
    renderer.hideBanner();

    if (!keepMetrics){
      state.score = 0;
      state.correct = 0;
      state.wrong = 0;
      state.miss = 0;
      state.streak = 0;
      state.bestStreak = 0;
      state.feverUntil = 0;
      state.feverCount = 0;
      state.reactionSamples = [];
      state.statsByCat = createBlankCategoryStats();
    }

    updateHud();
  }

  function maybeAiCoach(){
    const msg = ai?.coachTip
      ? ai.coachTip({
          wrong: state.wrong,
          miss: state.miss,
          streak: state.streak
        })
      : '';

    if (msg) showCoach(msg);
  }

  function pushReaction(ms){
    state.reactionSamples.push(ms);
    if (state.reactionSamples.length > 24){
      state.reactionSamples.shift();
    }
  }

  function calcAccuracy(){
    const total = state.correct + state.wrong + state.miss;
    if (!total) return 0;
    return (state.correct / total) * 100;
  }

  function isFeverOn(){
    return performance.now() < state.feverUntil;
  }

  function showCoach(text){
    setText(ui.coachBubble, text || '');
  }

  function showOverlay(el){
    if (el) el.classList.add('show');
  }

  function hideOverlay(el){
    if (el) el.classList.remove('show');
  }

  function setDebug(){
    if (!ctx.debug || !ui.debugPanel) return;

    const dbgR = renderer.debugInfo();
    ui.debugPanel.textContent =
      `PATCH: ${patch}\n` +
      `phase: ${state.phase}\n` +
      `view: ${ctx.view}\n` +
      `timeLeftMs: ${Math.round(state.timeLeftMs)}\n` +
      `items: ${state.items.size}\n` +
      `score: ${state.score}\n` +
      `correct/wrong/miss: ${state.correct}/${state.wrong}/${state.miss}\n` +
      `goal: ${state.goalCat ? state.goalCat.id : '-'} ${state.goalDone}/${state.goalNeed}\n` +
      `fever: ${isFeverOn() ? 'on' : 'off'}\n` +
      `seed: ${ctx.seed}` +
      `\nrenderer.stage: ${dbgR.stage.width}x${dbgR.stage.height}` +
      `\nrenderer.safe: L${dbgR.safe.left} R${dbgR.safe.right} T${dbgR.safe.top} B${dbgR.safe.bottom}` +
      `\nrenderer.items: ${dbgR.activeCount}`;
  }

  function snapshotState(){
    return {
      phase: state.phase,
      running: state.running,
      practiceUsed: state.practiceUsed,
      timeLeftMs: state.timeLeftMs,
      goalCat: state.goalCat,
      goalNeed: state.goalNeed,
      goalDone: state.goalDone,
      score: state.score,
      correct: state.correct,
      wrong: state.wrong,
      miss: state.miss,
      streak: state.streak,
      bestStreak: state.bestStreak,
      feverUntil: state.feverUntil,
      feverCount: state.feverCount,
      statsByCat: cloneStats(state.statsByCat)
    };
  }

  function getState(){
    return snapshotState();
  }

  function flushLogs(){
    if (!logger?.flush) return null;
    return logger.flush({
      final_state: snapshotState()
    });
  }

  function log(type, detail = {}){
    if (!logger?.event) return null;
    return logger.event(type, detail, {
      phase: state.phase,
      score: state.score,
      correct: state.correct,
      wrong: state.wrong,
      miss: state.miss,
      streak: state.streak
    });
  }

  const api = {
    patch,
    boot,
    destroy,
    startPractice,
    startMain,
    finishGame,
    replay,
    goHub,
    getState
  };

  return api;
}

function setText(el, text){
  if (el) el.textContent = String(text ?? '');
}

function cloneStats(stats = {}){
  return Object.fromEntries(
    Object.entries(stats).map(([k, v]) => [
      k,
      {
        correct: Number(v?.correct || 0),
        wrong: Number(v?.wrong || 0),
        miss: Number(v?.miss || 0)
      }
    ])
  );
}

function formatTime(ms){
  const total = Math.max(0, Math.ceil(Number(ms || 0) / 1000));
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function randRange(min, max){
  return min + (Math.random() * 0 + 1) * (max - min);
}

function hashString(input){
  let h = 2166136261 >>> 0;
  const str = String(input || '');
  for (let i = 0; i < str.length; i += 1){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a){
  return function(){
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}