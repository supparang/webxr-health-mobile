(function GoodJunkBattleV2RuntimeUnstuckPatch(){
  'use strict';

  const PATCH_VERSION = 'v2.4.44-runtime-unstuck-target-timer-hitfix';

  const url = new URL(location.href);
  const params = url.searchParams;
  const isBattleRun = /goodjunk-battle-v2-run/i.test(location.pathname) || !!window.GJ_BATTLE_RUNTIME;
  if (!isBattleRun) return;

  const PLAYER_NAME = params.get('name') || window.GJ_PLAYER_NAME || window.MY_PLAYER_NAME || 'Hero';
  const TIME_LIMIT = Math.max(30, Number(params.get('time') || 90));
  const DIFF = params.get('diff') || 'normal';

  function $(sel, root){ return (root || document).querySelector(sel); }
  function $all(sel, root){ return Array.from((root || document).querySelectorAll(sel)); }
  function now(){ return Date.now(); }
  function safeNum(v, fallback){ const n = Number(v); return Number.isFinite(n) ? n : Number(fallback || 0); }

  function injectStyle(){
    if ($('#gjBattleRuntimeUnstuckStyle')) return;
    const style = document.createElement('style');
    style.id = 'gjBattleRuntimeUnstuckStyle';
    style.textContent = `
      html.gj-battle-runtime-unstuck,
      html.gj-battle-runtime-unstuck body{ overscroll-behavior:none !important; }
      html.gj-battle-runtime-unstuck .arena,
      html.gj-battle-runtime-unstuck #arena{ touch-action:none !important; user-select:none !important; -webkit-user-select:none !important; }
      html.gj-battle-runtime-unstuck .target{ pointer-events:auto !important; cursor:pointer !important; z-index:80 !important; }
      html.gj-battle-runtime-unstuck .target.gj-force-hit{ opacity:0 !important; transform:translate(-50%,-50%) scale(1.25) !important; }
      html.gj-battle-runtime-unstuck .gj-unstuck-badge{
        position:fixed; left:8px; bottom:8px; z-index:99999; padding:5px 8px; border-radius:999px;
        background:rgba(238,255,235,.92); border:2px solid rgba(85,217,120,.7); color:#2d723b;
        font:900 10px system-ui,sans-serif; pointer-events:none;
      }
    `;
    document.head.appendChild(style);
  }

  function badge(){
    if ($('.gj-unstuck-badge')) return;
    const el = document.createElement('div');
    el.className = 'gj-unstuck-badge';
    el.textContent = 'Battle Unstuck OK';
    document.body.appendChild(el);
  }

  function getRuntime(){
    window.GJ_BATTLE_RUNTIME = window.GJ_BATTLE_RUNTIME || {};
    window.GJ_BATTLE_RUNTIME.state = window.GJ_BATTLE_RUNTIME.state || {};
    return window.GJ_BATTLE_RUNTIME;
  }

  function getRuntimeState(){ return getRuntime().state; }

  function syncUi(){
    const s = getRuntimeState();

    const scoreEl = $('#score,[data-score]');
    const timerEl = $('#timer,[data-time]');
    const heartsEl = $('#hearts,[data-hearts]');
    const playerNameEl = $('#playerName');
    const goodEl = $('#goodCount');
    const junkEl = $('#junkCount');
    const missEl = $('#missCount');
    const powerEl = $('#attackCount');
    const battlePowerEl = $('#battlePower,[data-battle-power]');
    const powerFill = $('#powerFill');

    if (playerNameEl) playerNameEl.textContent = PLAYER_NAME;
    if (scoreEl) scoreEl.textContent = String(safeNum(s.score, 0));
    if (timerEl) timerEl.textContent = String(Math.max(0, safeNum(s.timeLeft, TIME_LIMIT)));

    const hearts = Math.max(0, Math.min(3, safeNum(s.hearts, 3)));
    if (heartsEl) heartsEl.textContent = '❤'.repeat(hearts) + '♡'.repeat(Math.max(0, 3 - hearts));

    if (goodEl) goodEl.textContent = 'Good ' + safeNum(s.good, 0);
    if (junkEl) junkEl.textContent = 'Junk ' + safeNum(s.junk, 0);
    if (missEl) missEl.textContent = 'Miss ' + safeNum(s.miss, 0);

    const power = Math.max(0, Math.min(5, safeNum(s.power || s.attackPower, 0)));
    if (powerEl) powerEl.textContent = 'Power ' + power + '/5';
    if (battlePowerEl) battlePowerEl.textContent = 'พลัง ' + power + '/5';
    if (powerFill) powerFill.style.width = ((power / 5) * 100) + '%';

    window.GJ_BATTLE_STATE = Object.assign({}, window.GJ_BATTLE_STATE || {}, {
      score:safeNum(s.score, 0),
      myScore:safeNum(s.score, 0),
      points:safeNum(s.score, 0),
      good:safeNum(s.good, 0),
      junk:safeNum(s.junk, 0),
      miss:safeNum(s.miss, 0),
      hearts,
      hp:hearts,
      lives:hearts,
      power,
      attackPower:power,
      timeLeft:Math.max(0, safeNum(s.timeLeft, TIME_LIMIT)),
      remaining:Math.max(0, safeNum(s.timeLeft, TIME_LIMIT)),
      ended:!!s.ended
    });

    try{
      window.dispatchEvent(new CustomEvent('gj:battle-state-updated', {detail:window.GJ_BATTLE_STATE}));
    }catch(_){}
  }

  function initRuntimeState(){
    const s = getRuntimeState();
    if (typeof s.running !== 'boolean') s.running = true;
    if (typeof s.ended !== 'boolean') s.ended = false;

    s.score = safeNum(s.score, 0);
    s.good = safeNum(s.good, 0);
    s.junk = safeNum(s.junk, 0);
    s.miss = safeNum(s.miss, 0);
    s.hearts = Math.max(1, Math.min(3, safeNum(s.hearts, 3)));
    s.power = Math.max(0, Math.min(5, safeNum(s.power || s.attackPower, 0)));

    if (!s.timeLeft || safeNum(s.timeLeft, 0) <= 0) s.timeLeft = TIME_LIMIT;

    s.spawnEvery = safeNum(s.spawnEvery, DIFF === 'hard' || DIFF === 'challenge' ? 650 : DIFF === 'easy' ? 1050 : 820);
    s.targetLife = safeNum(s.targetLife, DIFF === 'hard' || DIFF === 'challenge' ? 1800 : DIFF === 'easy' ? 3200 : 2400);

    syncUi();
  }

  function endGame(result, reason){
    const s = getRuntimeState();
    if (s.ended) return;
    s.ended = true;
    s.running = false;
    clearInterval(s.spawnTimer);
    clearInterval(s.clockTimer);

    const overlay = $('#resultOverlay');
    const op = window.GJ_BATTLE_OPPONENT || {};
    const opScore = safeNum(op.score || op.points, 0);

    let title = 'จบ Battle!';
    let icon = '💪';

    if (s.score > opScore){ title = 'ชนะ Battle!'; icon = '🏆'; }
    else if (s.score < opScore){ title = 'แพ้ Battle!'; icon = '💪'; }
    else { title = 'เสมอ Battle!'; icon = '🤝'; }

    const resultIcon = $('#resultIcon');
    const resultTitle = $('#resultTitle,[data-result-title]');
    const resultReason = $('#resultReason');

    if (resultIcon) resultIcon.textContent = icon;
    if (resultTitle) resultTitle.textContent = title;
    if (resultReason) resultReason.textContent = 'เหตุผล: ' + (reason || 'time-up');

    const resultMeName = $('#resultMeName');
    const resultMyScore = $('#resultMyScore');
    const resultMyMeta = $('#resultMyMeta');
    const resultOpName = $('#resultOpName');
    const resultOpScore = $('#resultOpScore');
    const resultOpMeta = $('#resultOpMeta');

    if (resultMeName) resultMeName.textContent = 'คุณ: ' + PLAYER_NAME;
    if (resultMyScore) resultMyScore.textContent = String(s.score);
    if (resultMyMeta) resultMyMeta.textContent = 'Good: ' + s.good + ' • Junk: ' + s.junk + ' • Miss: ' + s.miss;
    if (resultOpName) resultOpName.textContent = 'คู่แข่ง: ' + (op.name || op.playerName || op.displayName || 'รอคู่แข่ง...');
    if (resultOpScore) resultOpScore.textContent = String(opScore);
    if (resultOpMeta) resultOpMeta.textContent = 'Good: ' + safeNum(op.good, 0) + ' • Junk: ' + safeNum(op.junk, 0) + ' • Miss: ' + safeNum(op.miss, 0);

    if (overlay) overlay.classList.add('show');

    if (window.GJ_BATTLE_CORE && typeof window.GJ_BATTLE_CORE.forceRealtimeSync === 'function'){
      window.GJ_BATTLE_CORE.forceRealtimeSync('unstuck-end-game');
    }
  }

  function ensureClockLoop(){
    const s = getRuntimeState();
    if (s.ended) return;

    clearInterval(s.clockTimer);
    s.clockTimer = setInterval(function(){
      if (s.ended || s.running === false) return;

      s.timeLeft = Math.max(0, safeNum(s.timeLeft, TIME_LIMIT) - 1);
      if (s.timeLeft <= 0){
        s.timeLeft = 0;
        syncUi();
        endGame('timeup', 'time-up');
        return;
      }
      syncUi();
    }, 1000);
  }

  function cleanupStuckTargets(){
    const s = getRuntimeState();
    if (s.ended) return;

    const life = Math.max(1500, safeNum(s.targetLife, 2400));
    const ar = $('#arena') || $('.arena');
    if (!ar) return;

    $all('.target:not(.hit):not(.gj-force-hit)', ar).forEach(function(t){
      const born = safeNum(t.dataset.spawnedAt, 0);
      if (!born) t.dataset.spawnedAt = String(now());
      if (born && now() - born > life + 1200){
        if ((t.dataset.kind || t.dataset.type) === 'good') s.miss += 1;
        t.remove();
        syncUi();
      }
    });
  }

  function disableBlockingDialogs(){
    if (window.__GJ_BATTLE_DIALOG_PATCHED__) return;
    window.__GJ_BATTLE_DIALOG_PATCHED__ = true;

    const nativeAlert = window.alert;
    const nativeConfirm = window.confirm;

    window.alert = function(message){
      const msg = String(message || '');
      if (/GoodJunk|Battle|เริ่ม|เล่น|rematch|response/i.test(msg)) return;
      return nativeAlert.call(window, message);
    };

    window.confirm = function(message){
      const msg = String(message || '');
      if (/GoodJunk|Battle|เริ่ม|เล่น|rematch|response/i.test(msg)) return true;
      return nativeConfirm.call(window, message);
    };
  }

  function exposeApi(){
    const rt = getRuntime();
    rt.unstuckVersion = PATCH_VERSION;
    rt.endGame = rt.endGame || endGame;
    rt.syncBasicUI = rt.syncBasicUI || syncUi;
    rt.forceEndGame = endGame;

    window.GJ_BATTLE_RUNTIME_UNSTUCK_PATCH = {
      version:PATCH_VERSION,
      initRuntimeState,
      syncUi,
      ensureClockLoop,
      cleanupStuckTargets,
      endGame
    };
  }

  function boot(){
    document.documentElement.classList.add('gj-battle-runtime-unstuck');
    injectStyle();
    badge();
    disableBlockingDialogs();
    initRuntimeState();
    exposeApi();
    ensureClockLoop();

    setInterval(function(){
      const s = getRuntimeState();
      if (s.ended) return;
      cleanupStuckTargets();
      syncUi();
    }, 900);

    console.info('[GoodJunk Battle Runtime Unstuck Patch]', PATCH_VERSION, 'loaded');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
