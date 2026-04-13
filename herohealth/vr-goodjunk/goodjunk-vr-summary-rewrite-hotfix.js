(function () {
  'use strict';

  const W = window;
  const D = document;

  function qs(name, fallback = '') {
    try {
      return new URL(location.href).searchParams.get(name) ?? fallback;
    } catch (_) {
      return fallback;
    }
  }

  function clean(v, fallback = '') {
    const s = String(v ?? '').trim();
    return s || fallback;
  }

  function sumNum() {
    for (let i = 0; i < arguments.length; i++) {
      const n = Number(arguments[i]);
      if (Number.isFinite(n)) return n;
    }
    return 0;
  }

  function summaryStat(label, value) {
    return `<div class="gjsb-stat"><div class="k">${label}</div><div class="v">${value}</div></div>`;
  }

  function getCtx() {
    return W.__GJ_RUN_CTX__ || {};
  }

  function getMode() {
    const ctx = getCtx();
    return clean(ctx.mode, clean(qs('mode', 'solo'), 'solo')).toLowerCase();
  }

  function isMultiMode(mode) {
    return ['duet', 'race', 'battle', 'coop'].includes(mode);
  }

  function getUi() {
    const ui = W.ui || {};
    return {
      summary: ui.summary || D.getElementById('summary'),
      summaryCard: ui.summaryCard || D.getElementById('summaryCard'),
      sumTitle: ui.sumTitle || D.getElementById('sumTitle'),
      sumSub: ui.sumSub || D.getElementById('sumSub'),
      sumMedal: ui.sumMedal || D.getElementById('sumMedal'),
      sumGrade: ui.sumGrade || D.getElementById('sumGrade'),
      sumStars: ui.sumStars || D.getElementById('sumStars'),
      sumGrid: ui.sumGrid || D.getElementById('sumGrid'),
      sumCoach: ui.sumCoach || D.getElementById('sumCoach'),
      sumNextHint: ui.sumNextHint || D.getElementById('sumNextHint'),
      sumExportBox: ui.sumExportBox || D.getElementById('sumExportBox'),
      btnReplay: ui.btnReplay || D.getElementById('btnReplay'),
      btnCooldown: ui.btnCooldown || D.getElementById('btnCooldown'),
      btnHub: ui.btnHub || D.getElementById('btnHub')
    };
  }

  function getState() {
    return W.state || {};
  }

  function saveSummary(mode, payload) {
    const ctx = getCtx();
    const item = {
      ts: Date.now(),
      source: 'goodjunk-vr-summary-rewrite-hotfix',
      mode,
      pid: clean(ctx.pid, 'anon'),
      gameId: clean(ctx.gameId, 'goodjunk'),
      ...payload
    };

    try { localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(item)); } catch (_) {}
    try { localStorage.setItem(`HHA_LAST_SUMMARY:${mode}:${item.pid}`, JSON.stringify(item)); } catch (_) {}
    try { localStorage.setItem(`HHA_LAST_SUMMARY:${item.gameId}:${item.pid}`, JSON.stringify(item)); } catch (_) {}
  }

  function setBadge(ui, text, medal, stars) {
    if (ui.sumMedal) ui.sumMedal.textContent = medal;
    if (ui.sumGrade) {
      ui.sumGrade.textContent = text;
      ui.sumGrade.className = 'gjsb-grade b';
    }
    if (ui.sumStars) ui.sumStars.textContent = stars;
  }

  function renderDuet(ui, state) {
    const myScore = sumNum(state.score, state.meScore, 0);
    const partnerScore = sumNum(state.partnerScore, state.otherScore, 0);
    const teamScore = sumNum(state.teamScore, myScore + partnerScore, 0);
    const myMiss = sumNum(state.miss, 0);
    const partnerMiss = sumNum(state.partnerMiss, 0);
    const teamMiss = sumNum(state.teamMiss, myMiss + partnerMiss, 0);
    const myCombo = sumNum(state.bestStreak, state.streak, 0);
    const partnerCombo = sumNum(state.partnerBestStreak, 0);
    const teamCombo = sumNum(state.teamCombo, Math.max(myCombo, partnerCombo), 0);
    const goodHit = sumNum(state.hitsGood, state.goodHit, 0);
    const junkHit = sumNum(state.hitsBad, state.junkHit, 0);
    const partnerReady = !!(state.partnerPid || state.partnerName || partnerScore || partnerMiss || partnerCombo);
    const partnerLabel = clean(state.partnerName, clean(state.partnerPid, 'Partner'));

    if (ui.sumTitle) ui.sumTitle.textContent = 'Duet Complete!';
    if (ui.sumSub) ui.sumSub.textContent = partnerReady ? 'à¸ªà¸£à¸¸à¸›à¸œà¸¥à¸à¸²à¸£à¹€à¸¥à¹ˆà¸™à¹à¸šà¸š 2 à¸„à¸™' : 'à¸£à¸­à¸œà¸¥à¸ˆà¸²à¸à¸œà¸¹à¹‰à¹€à¸¥à¹ˆà¸™à¸­à¸µà¸à¸à¹ˆà¸²à¸¢';
    setBadge(ui, partnerReady ? 'TEAM' : 'WAIT', partnerReady ? 'ðŸ¤' : 'â³', partnerReady ? 'â­â­' : 'â­');

    if (ui.sumGrid) {
      ui.sumGrid.innerHTML = [
        summaryStat('à¹‚à¸«à¸¡à¸”', 'Duet'),
        summaryStat('à¸„à¸°à¹à¸™à¸™à¹€à¸£à¸²', myScore),
        summaryStat('à¸„à¸°à¹à¸™à¸™à¹€à¸žà¸·à¹ˆà¸­à¸™', partnerReady ? partnerScore : 'à¸£à¸­à¸œà¸¥'),
        summaryStat('à¸„à¸°à¹à¸™à¸™à¸£à¸§à¸¡à¸—à¸µà¸¡', teamScore),
        summaryStat('Miss à¸£à¸§à¸¡à¸—à¸µà¸¡', teamMiss),
        summaryStat('Best Team Combo', teamCombo),
        summaryStat('à¹à¸•à¸°à¸‚à¸­à¸‡à¸”à¸µ', goodHit),
        summaryStat('à¹‚à¸”à¸™ junk', junkHit)
      ].join('');
    }

    if (ui.sumCoach) ui.sumCoach.textContent = partnerReady ? 'à¸ªà¸£à¸¸à¸›à¸„à¸°à¹à¸™à¸™à¸„à¸£à¸šà¸—à¸±à¹‰à¸‡à¸ªà¸­à¸‡à¸à¹ˆà¸²à¸¢à¹à¸¥à¹‰à¸§' : 'à¸ªà¹ˆà¸‡à¸œà¸¥à¸‚à¸­à¸‡à¹€à¸£à¸²à¹à¸¥à¹‰à¸§ à¸à¸³à¸¥à¸±à¸‡à¸£à¸­à¸œà¸¥à¸ˆà¸²à¸à¹€à¸žà¸·à¹ˆà¸­à¸™';
    if (ui.sumNextHint) ui.sumNextHint.textContent = partnerReady ? `à¹€à¸£à¸² ${myScore} â€¢ ${partnerLabel} ${partnerScore} â€¢ à¸£à¸§à¸¡à¸—à¸µà¸¡ ${teamScore}` : 'à¸«à¸™à¹‰à¸²à¸ªà¸£à¸¸à¸›à¸™à¸µà¹‰à¸ˆà¸°à¸­à¸±à¸›à¹€à¸”à¸•à¹€à¸­à¸‡à¹€à¸¡à¸·à¹ˆà¸­à¹€à¸žà¸·à¹ˆà¸­à¸™à¸ªà¹ˆà¸‡à¸œà¸¥à¸„à¸£à¸š';
    if (ui.sumExportBox) ui.sumExportBox.innerHTML = `<strong>duet summary</strong><br>me: ${myScore}<br>partner: ${partnerReady ? partnerScore : '-'}<br>team: ${teamScore}`;

    if (ui.btnReplay) ui.btnReplay.textContent = 'ðŸ¤ à¹€à¸¥à¹ˆà¸™ Duet à¹ƒà¸«à¸¡à¹ˆ';
    if (ui.btnCooldown) ui.btnCooldown.textContent = 'ðŸ§Š à¹„à¸› Cooldown';
    if (ui.btnHub) ui.btnHub.textContent = 'ðŸ  à¸à¸¥à¸±à¸š HUB';

    saveSummary('duet', {
      result: partnerReady ? 'pair-finished' : 'waiting-partner',
      score: myScore,
      partnerScore,
      teamScore,
      teamMiss,
      teamCombo,
      goodHit,
      junkHit,
      partnerName: partnerLabel
    });
  }

  function renderRace(ui, state) {
    const score = sumNum(state.score, 0);
    const miss = sumNum(state.miss, 0);
    const rank = sumNum(state.rank, 1);
    const leaderScore = sumNum(state.leaderScore, state.score, 0);
    const goodHit = sumNum(state.hitsGood, 0);
    const junkHit = sumNum(state.hitsBad, 0);

    if (ui.sumTitle) ui.sumTitle.textContent = 'Race Complete!';
    if (ui.sumSub) ui.sumSub.textContent = 'สรุปผลการแข่งขัน';
    setBadge(ui, `#${rank}`, '🏁', rank === 1 ? '⭐⭐⭐' : '⭐⭐');

    if (ui.sumGrid) {
      ui.sumGrid.innerHTML = [
        summaryStat('โหมด', 'Race'),
        summaryStat('อันดับ', `#${rank}`),
        summaryStat('คะแนน', score),
        summaryStat('Leader Score', leaderScore),
        summaryStat('Miss', miss),
        summaryStat('แตะของดี', goodHit),
        summaryStat('โดน junk', junkHit),
        summaryStat('ผลลัพธ์', 'finished')
      ].join('');
    }

    if (ui.sumCoach) ui.sumCoach.textContent = 'รอบหน้าลองเร่งจังหวะช่วงต้นเกม';
    if (ui.sumNextHint) ui.sumNextHint.textContent = 'เป้าหมายต่อไป: ดันอันดับให้สูงขึ้น';
    if (ui.sumExportBox) ui.sumExportBox.innerHTML = `<strong>race summary</strong><br>mode: race<br>rank: ${rank}`;

    if (ui.btnReplay) ui.btnReplay.textContent = '🏁 เล่น Race ใหม่';
    if (ui.btnCooldown) ui.btnCooldown.textContent = '🧊 ไป Cooldown';
    if (ui.btnHub) ui.btnHub.textContent = '🏠 กลับ HUB';

    saveSummary('race', {
      result: 'finished',
      score,
      rank,
      leaderScore,
      miss,
      goodHit,
      junkHit
    });
  }

  function renderBattle(ui, state) {
    const score = sumNum(state.score, 0);
    const enemyScore = sumNum(state.enemyScore, 0);
    const attacksSent = sumNum(state.attacksSent, 0);
    const attacksReceived = sumNum(state.attacksReceived, 0);
    const miss = sumNum(state.miss, 0);
    const verdict = score >= enemyScore ? 'WIN' : 'LOSE';

    if (ui.sumTitle) ui.sumTitle.textContent = 'Battle Complete!';
    if (ui.sumSub) ui.sumSub.textContent = 'สรุปผลการดวล';
    setBadge(ui, verdict, '⚔️', verdict === 'WIN' ? '⭐⭐⭐' : '⭐');

    if (ui.sumGrid) {
      ui.sumGrid.innerHTML = [
        summaryStat('โหมด', 'Battle'),
        summaryStat('ผลแพ้ชนะ', verdict),
        summaryStat('คะแนนเรา', score),
        summaryStat('คะแนนคู่แข่ง', enemyScore),
        summaryStat('โจมตีที่ส่ง', attacksSent),
        summaryStat('โจมตีที่รับ', attacksReceived),
        summaryStat('Miss', miss),
        summaryStat('ผลลัพธ์', verdict)
      ].join('');
    }

    if (ui.sumCoach) ui.sumCoach.textContent = verdict === 'WIN' ? 'คุมเกมได้ดีมาก' : 'รอบหน้าลองเก็บคอมโบให้ยาวขึ้น';
    if (ui.sumNextHint) ui.sumNextHint.textContent = 'เป้าหมายต่อไป: ใช้ soft attack ให้คุ้มจังหวะ';
    if (ui.sumExportBox) ui.sumExportBox.innerHTML = `<strong>battle summary</strong><br>mode: battle<br>result: ${verdict}`;

    if (ui.btnReplay) ui.btnReplay.textContent = '⚔️ เล่น Battle ใหม่';
    if (ui.btnCooldown) ui.btnCooldown.textContent = '🧊 ไป Cooldown';
    if (ui.btnHub) ui.btnHub.textContent = '🏠 กลับ HUB';

    saveSummary('battle', {
      result: verdict,
      score,
      enemyScore,
      attacksSent,
      attacksReceived,
      miss
    });
  }

  function renderCoop(ui, state) {
    const teamScore = sumNum(state.teamScore, state.score, 0);
    const teamGoal = sumNum(state.teamGoal, 0);
    const teamGoalMax = sumNum(state.teamGoalMax, 100);
    const contribution = sumNum(state.contribution, 0);
    const teamMiss = sumNum(state.teamMiss, state.miss, 0);
    const goodHit = sumNum(state.hitsGood, 0);
    const junkHit = sumNum(state.hitsBad, 0);

    if (ui.sumTitle) ui.sumTitle.textContent = 'Co-op Complete!';
    if (ui.sumSub) ui.sumSub.textContent = 'สรุปผลการช่วยกันเล่น';
    setBadge(ui, 'TEAM', '🫶', teamGoal >= teamGoalMax ? '⭐⭐⭐' : '⭐⭐');

    if (ui.sumGrid) {
      ui.sumGrid.innerHTML = [
        summaryStat('โหมด', 'Co-op'),
        summaryStat('Team Score', teamScore),
        summaryStat('Team Goal', `${teamGoal}/${teamGoalMax}`),
        summaryStat('Contribution', contribution),
        summaryStat('Team Miss', teamMiss),
        summaryStat('แตะของดี', goodHit),
        summaryStat('โดน junk', junkHit),
        summaryStat('ผลลัพธ์', 'finished')
      ].join('');
    }

    if (ui.sumCoach) ui.sumCoach.textContent = 'ช่วยกันเล่นได้ดีมาก';
    if (ui.sumNextHint) ui.sumNextHint.textContent = 'เป้าหมายต่อไป: ทำ Team Goal ให้เต็ม';
    if (ui.sumExportBox) ui.sumExportBox.innerHTML = `<strong>coop summary</strong><br>mode: coop<br>teamGoal: ${teamGoal}/${teamGoalMax}`;

    if (ui.btnReplay) ui.btnReplay.textContent = '🫶 เล่น Co-op ใหม่';
    if (ui.btnCooldown) ui.btnCooldown.textContent = '🧊 ไป Cooldown';
    if (ui.btnHub) ui.btnHub.textContent = '🏠 กลับ HUB';

    saveSummary('coop', {
      result: 'finished',
      teamScore,
      teamGoal,
      teamGoalMax,
      contribution,
      teamMiss,
      goodHit,
      junkHit
    });
  }

  function rewriteSummaryNow() {
    const mode = getMode();
    if (!isMultiMode(mode)) return false;

    const ui = getUi();
    const state = getState();

    if (!ui.summary) return false;
    if (!ui.summary.classList.contains('show')) return false;

    if (['duet','race','battle','coop'].includes(mode)) {
      const textNodes = [
        ui.sumTitle,
        ui.sumSub,
        ui.sumCoach,
        ui.sumNextHint,
        ui.sumExportBox
      ].filter(Boolean);

      textNodes.forEach((node) => {
        const txt = String(node.textContent || '');
        if (/Rage Finale|Boss Medal|Boss Clear|Junk King|Run Variant/i.test(txt)) {
          node.textContent = '';
        }
      });
    }

    if (mode === 'duet') renderDuet(ui, state);
    else if (mode === 'race') renderRace(ui, state);
    else if (mode === 'battle') renderBattle(ui, state);
    else if (mode === 'coop') renderCoop(ui, state);

    if (ui.summaryCard) ui.summaryCard.scrollTop = 0;
    return true;
  }

  function installObserver() {
    const ui = getUi();
    if (!ui.summary) return false;
    if (ui.summary.__gjSummaryRewriteInstalled) return true;

    ui.summary.__gjSummaryRewriteInstalled = true;

    const observer = new MutationObserver(() => {
      rewriteSummaryNow();
    });

    observer.observe(ui.summary, {
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
      subtree: true
    });

    W.__GJ_SUMMARY_REWRITE_OBSERVER__ = observer;
    return true;
  }

  function boot() {
    let tries = 0;
    const maxTries = 120;

    function tick() {
      tries += 1;
      const installed = installObserver();
      rewriteSummaryNow();
      if (installed || tries >= maxTries) return;
      setTimeout(tick, 250);
    }

    tick();
  }

  W.GJSummaryRewriteHotfix = {
    rewriteSummaryNow,
    installObserver,
    boot
  };

  boot();
})();
