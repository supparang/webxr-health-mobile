'use strict';

/* =========================================================
 * /herohealth/vr-goodjunk/goodjunk.safe.battle.js
 * GoodJunk Battle Safe Bridge
 * FULL PATCH v20260405-gjb-safe-bridge-r1
 * ========================================================= */
(function(){
  const W = window;
  const D = document;

  if (W.__GJ_BATTLE_SAFE_BRIDGE_LOADED__) return;
  W.__GJ_BATTLE_SAFE_BRIDGE_LOADED__ = true;

  const LAST_SUMMARY_KEY = 'GJ_BATTLE_LAST_SUMMARY';
  const LAST_SUMMARY_KEY_PID = 'GJ_BATTLE_LAST_SUMMARY:';

  function num(v, d=0){
    v = Number(v);
    return Number.isFinite(v) ? v : d;
  }

  function clamp(v, a, b){
    v = num(v, a);
    return Math.max(a, Math.min(b, v));
  }

  function cleanText(v, max=200){
    return String(v == null ? '' : v).trim().slice(0, max);
  }

  function cleanPid(v){
    return String(v == null ? '' : v)
      .trim()
      .replace(/[.#$[\]/]/g, '-')
      .slice(0, 120);
  }

  function nowIso(){
    try { return new Date().toISOString(); }
    catch { return ''; }
  }

  function qs(k, fb=''){
    try{
      const v = new URL(location.href).searchParams.get(k);
      return v == null || v === '' ? fb : v;
    }catch{
      return fb;
    }
  }

  function readJson(key, fb=null){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fb;
    }catch{
      return fb;
    }
  }

  function writeJson(key, val){
    try{
      localStorage.setItem(key, JSON.stringify(val));
    }catch{}
  }

  function escCsv(v){
    const s = String(v == null ? '' : v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function normalizeRoomPlayersMap(playersObj){
    const out = {};
    const src = playersObj && typeof playersObj === 'object' ? playersObj : {};
    Object.keys(src).forEach((key) => {
      const p = src[key] || {};
      const pid = cleanPid(p.pid || p.uid || p.playerId || key);
      out[key] = {
        key,
        pid,
        uid: cleanPid(p.uid || p.playerId || pid || key),
        name: cleanText(p.name || p.nick || p.displayName || pid || 'Player', 80),
        score: num(p.score, 0),
        miss: num(p.miss, 0),
        bestStreak: num(p.bestStreak, 0),
        hp: num(p.hp, 100),
        maxHp: Math.max(1, num(p.maxHp, 100)),
        attackCharge: num(p.attackCharge, 0),
        maxAttackCharge: Math.max(1, num(p.maxAttackCharge, 100)),
        attackReady: !!p.attackReady,
        guardActive: !!p.guardActive,
        guardUntil: num(p.guardUntil, 0),
        junkRainUntil: num(p.junkRainUntil, 0),

        attacksUsed: num(p.attacksUsed, 0),
        damageDealt: num(p.damageDealt, 0),
        damageTaken: num(p.damageTaken, 0),
        koCount: num(p.koCount, 0),

        guardsUsed: num(p.guardsUsed, 0),
        perfectGuardCount: num(p.perfectGuardCount, 0),
        blockedDamage: num(p.blockedDamage, 0),
        counterBonusUsed: num(p.counterBonusUsed, 0),

        junkRainSent: num(p.junkRainSent, 0),
        junkRainReceived: num(p.junkRainReceived, 0),

        drainUsed: num(p.drainUsed, 0),
        chargeDrained: num(p.chargeDrained, 0),
        chargeLostToDrain: num(p.chargeLostToDrain, 0),

        counterTriggered: num(p.counterTriggered, 0),
        counterDamageDealt: num(p.counterDamageDealt, 0),
        counterDamageTaken: num(p.counterDamageTaken, 0),

        finisherUsed: num(p.finisherUsed, 0),
        finisherBonusDamage: num(p.finisherBonusDamage, 0),
        bestAttackCombo: num(p.bestAttackCombo, 0),

        rageTriggered: !!p.rageTriggered,
        rageStartedAt: num(p.rageStartedAt, 0),
        rageAttackBonusDamage: num(p.rageAttackBonusDamage, 0),
        rageFinisherUsed: num(p.rageFinisherUsed, 0),
        rageFinisherBonusDamage: num(p.rageFinisherBonusDamage, 0),

        leadChanges: num(p.leadChanges, 0),
        comebackCount: num(p.comebackCount, 0),
        biggestLead: num(p.biggestLead, 0),
        biggestDeficit: num(p.biggestDeficit, 0),

        koByAttack: num(p.koByAttack, 0),
        koTaken: num(p.koTaken, 0),
        endedByKo: !!p.endedByKo,

        raw: p
      };
    });
    return out;
  }

  function statePlayers(){
    const st = W.state || {};
    if (Array.isArray(st.players)) return st.players;
    if (st.players && typeof st.players === 'object'){
      return Object.values(normalizeRoomPlayersMap(st.players));
    }
    return [];
  }

  function inferPid(summary){
    return cleanPid(
      summary?.pid ||
      summary?.playerPid ||
      summary?.raw?.pid ||
      qs('pid') ||
      qs('playerId') ||
      'anon'
    );
  }

  function inferName(summary){
    return cleanText(
      summary?.name ||
      summary?.playerName ||
      summary?.raw?.name ||
      qs('name') ||
      qs('nick') ||
      'Player',
      80
    );
  }

  function inferRoomId(summary){
    return cleanText(
      summary?.roomId ||
      summary?.raw?.roomId ||
      qs('roomId') ||
      qs('room') ||
      '-',
      80
    );
  }

  function inferPlayers(summary){
    if (Array.isArray(summary?.players)) return summary.players;
    if (summary?.players && typeof summary.players === 'object'){
      return Object.values(normalizeRoomPlayersMap(summary.players));
    }
    if (summary?.raw?.players && typeof summary.raw.players === 'object'){
      return Object.values(normalizeRoomPlayersMap(summary.raw.players));
    }
    return statePlayers();
  }

  function resolveSelfAndOpp(players, pid, name){
    let me =
      players.find((p) => cleanPid(p.pid || p.uid) === cleanPid(pid)) ||
      players.find((p) => cleanText(p.name || '', 80) === cleanText(name || '', 80)) ||
      players[0] ||
      null;

    let opp =
      players.find((p) => p !== me) ||
      null;

    return { me, opp };
  }

  function inferResult(rank, score, oppScore){
    const r = String(rank || '');
    if (r === '1') return 'win';
    if (r === '2') return 'lose';
    if (num(score, 0) > num(oppScore, 0)) return 'win';
    if (num(score, 0) < num(oppScore, 0)) return 'lose';
    return 'draw';
  }

  function buildSummary(input){
    const rawInput = input && typeof input === 'object' ? input : {};
    const players = inferPlayers(rawInput);
    const pid = inferPid(rawInput);
    const name = inferName(rawInput);
    const roomId = inferRoomId(rawInput);
    const { me, opp } = resolveSelfAndOpp(players, pid, name);

    const st = W.state || {};
    const score = me ? num(me.score, num(rawInput.score, num(st.score, 0))) : num(rawInput.score, num(st.score, 0));
    const miss = me ? num(me.miss, num(rawInput.miss, num(st.miss, 0))) : num(rawInput.miss, num(st.miss, 0));
    const bestStreak = me ? num(me.bestStreak, num(rawInput.bestStreak, num(st.bestStreak, 0))) : num(rawInput.bestStreak, num(st.bestStreak, 0));
    const hp = me ? num(me.hp, num(rawInput.hp, num(st.hp, 100))) : num(rawInput.hp, num(st.hp, 100));
    const maxHp = me ? Math.max(1, num(me.maxHp, num(rawInput.maxHp, num(st.maxHp, 100)))) : Math.max(1, num(rawInput.maxHp, num(st.maxHp, 100)));

    const opponentScore = opp ? num(opp.score, num(rawInput.opponentScore, 0)) : num(rawInput.opponentScore, 0);
    const opponentName = opp ? cleanText(opp.name || opp.pid || 'Opponent', 80) : cleanText(rawInput.opponentName || 'Opponent', 80);

    const rank = cleanText(rawInput.rank || rawInput.place || '', 12) || (score >= opponentScore ? '1' : '2');
    const result = cleanText(rawInput.result || inferResult(rank, score, opponentScore), 24);

    const summary = {
      mode: 'battle',
      game: 'goodjunk',
      roomId,
      pid,
      name,
      players: players.map((p) => ({
        pid: cleanPid(p.pid || p.uid || ''),
        name: cleanText(p.name || '', 80),
        score: num(p.score, 0),
        miss: num(p.miss, 0),
        bestStreak: num(p.bestStreak, 0),
        hp: num(p.hp, 100),
        maxHp: Math.max(1, num(p.maxHp, 100)),
        attackCharge: num(p.attackCharge, 0),
        maxAttackCharge: Math.max(1, num(p.maxAttackCharge, 100)),
        attackReady: !!p.attackReady,
        raw: p.raw || {}
      })),
      score,
      miss,
      bestStreak,
      hp,
      maxHp,
      opponentScore,
      opponentName,
      rank,
      result,

      attacksUsed: me ? num(me.attacksUsed, 0) : num(rawInput.attacksUsed, num(st.attacksUsed, 0)),
      damageDealt: me ? num(me.damageDealt, 0) : num(rawInput.damageDealt, num(st.damageDealt, 0)),
      damageTaken: me ? num(me.damageTaken, 0) : num(rawInput.damageTaken, num(st.damageTaken, 0)),
      koCount: me ? num(me.koCount, 0) : num(rawInput.koCount, num(st.koCount, 0)),

      guardsUsed: me ? num(me.guardsUsed, 0) : num(rawInput.guardsUsed, num(st.guardsUsed, 0)),
      perfectGuardCount: me ? num(me.perfectGuardCount, 0) : num(rawInput.perfectGuardCount, num(st.perfectGuardCount, 0)),
      blockedDamage: me ? num(me.blockedDamage, 0) : num(rawInput.blockedDamage, num(st.blockedDamage, 0)),
      counterBonusUsed: me ? num(me.counterBonusUsed, 0) : num(rawInput.counterBonusUsed, num(st.counterBonusUsed, 0)),

      junkRainSent: me ? num(me.junkRainSent, 0) : num(rawInput.junkRainSent, num(st.junkRainSent, 0)),
      junkRainReceived: me ? num(me.junkRainReceived, 0) : num(rawInput.junkRainReceived, num(st.junkRainReceived, 0)),

      drainUsed: me ? num(me.drainUsed, 0) : num(rawInput.drainUsed, num(st.drainUsed, 0)),
      chargeDrained: me ? num(me.chargeDrained, 0) : num(rawInput.chargeDrained, num(st.chargeDrained, 0)),
      chargeLostToDrain: me ? num(me.chargeLostToDrain, 0) : num(rawInput.chargeLostToDrain, num(st.chargeLostToDrain, 0)),

      counterTriggered: me ? num(me.counterTriggered, 0) : num(rawInput.counterTriggered, num(st.counterTriggered, 0)),
      counterDamageDealt: me ? num(me.counterDamageDealt, 0) : num(rawInput.counterDamageDealt, num(st.counterDamageDealt, 0)),
      counterDamageTaken: me ? num(me.counterDamageTaken, 0) : num(rawInput.counterDamageTaken, num(st.counterDamageTaken, 0)),

      finisherUsed: me ? num(me.finisherUsed, 0) : num(rawInput.finisherUsed, num(st.finisherUsed, 0)),
      finisherBonusDamage: me ? num(me.finisherBonusDamage, 0) : num(rawInput.finisherBonusDamage, num(st.finisherBonusDamage, 0)),
      bestAttackCombo: me ? num(me.bestAttackCombo, 0) : num(rawInput.bestAttackCombo, num(st.bestAttackCombo, 0)),

      rageTriggered: me ? !!me.rageTriggered : !!(rawInput.rageTriggered || st.rageTriggered),
      rageAttackBonusDamage: me ? num(me.rageAttackBonusDamage, 0) : num(rawInput.rageAttackBonusDamage, num(st.rageAttackBonusDamage, 0)),
      rageFinisherUsed: me ? num(me.rageFinisherUsed, 0) : num(rawInput.rageFinisherUsed, num(st.rageFinisherUsed, 0)),
      rageFinisherBonusDamage: me ? num(me.rageFinisherBonusDamage, 0) : num(rawInput.rageFinisherBonusDamage, num(st.rageFinisherBonusDamage, 0)),

      leadChanges: me ? num(me.leadChanges, 0) : num(rawInput.leadChanges, num(st.leadChanges, 0)),
      comebackCount: me ? num(me.comebackCount, 0) : num(rawInput.comebackCount, num(st.comebackCount, 0)),
      biggestLead: me ? num(me.biggestLead, 0) : num(rawInput.biggestLead, num(st.biggestLead, 0)),
      biggestDeficit: me ? num(me.biggestDeficit, 0) : num(rawInput.biggestDeficit, num(st.biggestDeficit, 0)),

      koByAttack: me ? num(me.koByAttack, 0) : num(rawInput.koByAttack, num(st.koByAttack, 0)),
      koTaken: me ? num(me.koTaken, 0) : num(rawInput.koTaken, num(st.koTaken, 0)),
      endedByKo: me ? !!me.endedByKo : !!(rawInput.endedByKo || st.endedByKo),

      ts_iso: nowIso(),
      raw: {
        ...rawInput,
        current: { ...(st || {}) },
        players
      }
    };

    return summary;
  }

  function saveLastSummary(summary){
    if (!summary) return;
    writeJson(LAST_SUMMARY_KEY, summary);
    if (summary.pid){
      writeJson(LAST_SUMMARY_KEY_PID + summary.pid, summary);
    }
  }

  function loadLastSummary(pid=''){
    return readJson(pid ? (LAST_SUMMARY_KEY_PID + pid) : LAST_SUMMARY_KEY, null);
  }

  function summaryToCsv(summary){
    const row = {
      ts_iso: summary.ts_iso || '',
      roomId: summary.roomId || '',
      pid: summary.pid || '',
      name: summary.name || '',
      rank: summary.rank || '',
      result: summary.result || '',
      score: summary.score || 0,
      opponentScore: summary.opponentScore || 0,
      miss: summary.miss || 0,
      bestStreak: summary.bestStreak || 0,
      hp: summary.hp || 0,
      maxHp: summary.maxHp || 0,

      attacksUsed: summary.attacksUsed || 0,
      damageDealt: summary.damageDealt || 0,
      damageTaken: summary.damageTaken || 0,
      koCount: summary.koCount || 0,

      guardsUsed: summary.guardsUsed || 0,
      perfectGuardCount: summary.perfectGuardCount || 0,
      blockedDamage: summary.blockedDamage || 0,
      counterBonusUsed: summary.counterBonusUsed || 0,

      junkRainSent: summary.junkRainSent || 0,
      junkRainReceived: summary.junkRainReceived || 0,

      drainUsed: summary.drainUsed || 0,
      chargeDrained: summary.chargeDrained || 0,
      chargeLostToDrain: summary.chargeLostToDrain || 0,

      counterTriggered: summary.counterTriggered || 0,
      counterDamageDealt: summary.counterDamageDealt || 0,
      counterDamageTaken: summary.counterDamageTaken || 0,

      finisherUsed: summary.finisherUsed || 0,
      finisherBonusDamage: summary.finisherBonusDamage || 0,
      bestAttackCombo: summary.bestAttackCombo || 0,

      rageTriggered: summary.rageTriggered ? 1 : 0,
      rageAttackBonusDamage: summary.rageAttackBonusDamage || 0,
      rageFinisherUsed: summary.rageFinisherUsed || 0,
      rageFinisherBonusDamage: summary.rageFinisherBonusDamage || 0,

      leadChanges: summary.leadChanges || 0,
      comebackCount: summary.comebackCount || 0,
      biggestLead: summary.biggestLead || 0,
      biggestDeficit: summary.biggestDeficit || 0,

      koByAttack: summary.koByAttack || 0,
      koTaken: summary.koTaken || 0,
      endedByKo: summary.endedByKo ? 1 : 0
    };

    const headers = Object.keys(row);
    const values = headers.map((h) => escCsv(row[h]));
    return `${headers.join(',')}\n${values.join(',')}\n`;
  }

  function downloadText(filename, text, mime='text/plain;charset=utf-8'){
    try{
      const blob = new Blob([text], { type:mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(url);
      }, 0);
    }catch(err){
      console.warn('[BattleSafe] downloadText failed:', err);
    }
  }

  function exportSummary(summary, kind='json'){
    if (!summary) return;
    const stamp = (summary.ts_iso || nowIso()).replace(/[:.]/g, '-');
    const base = `goodjunk-battle-${summary.pid || 'anon'}-${stamp}`;

    if (kind === 'csv'){
      downloadText(`${base}.csv`, summaryToCsv(summary), 'text/csv;charset=utf-8');
      return;
    }

    downloadText(`${base}.json`, JSON.stringify(summary, null, 2), 'application/json;charset=utf-8');
  }

  function tryShowSummary(summary){
    if (!summary) return false;

    if (typeof W.showSummary === 'function'){
      try{
        W.showSummary({ summary });
        return true;
      }catch(err){
        console.warn('[BattleSafe] window.showSummary failed:', err);
      }
    }

    if (typeof W.renderBattleSummary === 'function'){
      try{
        W.renderBattleSummary(summary);
        return true;
      }catch(err){
        console.warn('[BattleSafe] window.renderBattleSummary failed:', err);
      }
    }

    return false;
  }

  function finishGame(input){
    const summary = buildSummary(input);
    saveLastSummary(summary);
    W.__GJ_BATTLE_LAST_SUMMARY__ = summary;
    tryShowSummary(summary);
    return summary;
  }

  function showSummary(input){
    return finishGame(input);
  }

  function hideSummary(){
    if (typeof W.hideSummary === 'function'){
      try { W.hideSummary(); } catch {}
    }
  }

  function wireButtons(){
    D.addEventListener('click', (ev) => {
      const t = ev.target;
      if (!(t instanceof HTMLElement)) return;

      if (t.id === 'btnExport'){
        const summary = W.__GJ_BATTLE_LAST_SUMMARY__ || loadLastSummary(inferPid({}));
        if (summary) exportSummary(summary, 'json');
      }
    });
  }

  function onFinishEvent(ev){
    try{
      const detail = ev && ev.detail ? ev.detail : {};
      const input = detail.summary || detail;
      finishGame(input);
    }catch(err){
      console.warn('[BattleSafe] onFinishEvent failed:', err);
    }
  }

  function restoreLastSummaryOnLoad(){
    const q = new URLSearchParams(location.search);
    const restore = q.get('showLastSummary') || '';
    if (!restore) return;

    const summary = loadLastSummary(q.get('pid') || '');
    if (!summary) return;

    setTimeout(() => {
      tryShowSummary(summary);
    }, 60);
  }

  W.BattleSafe = {
    buildSummary,
    finishGame,
    showSummary,
    hideSummary,
    exportSummary,
    loadLastSummary
  };

  W.addEventListener('battle:finish', onFinishEvent);
  W.addEventListener('hha:battle:finish', onFinishEvent);

  wireButtons();
  restoreLastSummaryOnLoad();
})();