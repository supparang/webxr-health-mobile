(function GoodJunkBattleV2RuntimeUnstuckPatch(){
  'use strict';

  const PATCH_VERSION = 'v2.4.36-runtime-unstuck-target-timer-hitfix';

  const url = new URL(location.href);
  const params = url.searchParams;

  const isBattleRun =
    /goodjunk-battle-v2-run/i.test(location.pathname) ||
    !!window.GJ_BATTLE_RUNTIME;

  if (!isBattleRun) return;

  const PLAYER_NAME =
    params.get('name') ||
    window.GJ_PLAYER_NAME ||
    window.MY_PLAYER_NAME ||
    'Hero';

  const TIME_LIMIT = Math.max(30, Number(params.get('time') || 90));
  const DIFF = params.get('diff') || 'normal';

  function $(sel, root){
    return (root || document).querySelector(sel);
  }

  function $all(sel, root){
    return Array.from((root || document).querySelectorAll(sel));
  }

  function now(){
    return Date.now();
  }

  function emit(name, detail){
    try{
      window.dispatchEvent(new CustomEvent(name, {
        detail: Object.assign({
          version: PATCH_VERSION,
          at: now()
        }, detail || {})
      }));
    }catch(_){}
  }

  function toast(msg){
    let el = $('#toast');

    if (!el){
      el = document.createElement('div');
      el.id = 'toast';
      el.style.cssText = [
        'position:fixed',
        'left:50%',
        'bottom:calc(84px + env(safe-area-inset-bottom))',
        'transform:translateX(-50%) translateY(16px)',
        'z-index:999999',
        'max-width:92vw',
        'padding:10px 14px',
        'border-radius:999px',
        'background:rgba(0,0,0,.82)',
        'color:#fff',
        'font:900 13px system-ui,sans-serif',
        'text-align:center',
        'opacity:0',
        'pointer-events:none',
        'transition:opacity .18s ease, transform .18s ease'
      ].join(';');
      document.body.appendChild(el);
    }

    el.textContent = msg;
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';

    clearTimeout(toast._t);
    toast._t = setTimeout(function(){
      el.style.opacity = '0';
      el.style.transform = 'translateX(-50%) translateY(16px)';
    }, 1100);
  }

  function injectStyle(){
    if ($('#gjBattleRuntimeUnstuckStyle')) return;

    const style = document.createElement('style');
    style.id = 'gjBattleRuntimeUnstuckStyle';
    style.textContent = `
      html.gj-battle-runtime-unstuck,
      html.gj-battle-runtime-unstuck body{
        overscroll-behavior:none !important;
      }

      html.gj-battle-runtime-unstuck .arena,
      html.gj-battle-runtime-unstuck #arena{
        touch-action:none !important;
        user-select:none !important;
        -webkit-user-select:none !important;
      }

      html.gj-battle-runtime-unstuck .target{
        pointer-events:auto !important;
        cursor:pointer !important;
        z-index:80 !important;
      }

      html.gj-battle-runtime-unstuck .target.gj-force-hit{
        opacity:0 !important;
        transform:translate(-50%,-50%) scale(1.25) !important;
      }

      html.gj-battle-runtime-unstuck .gj-unstuck-badge{
        position:fixed;
        left:8px;
        bottom:8px;
        z-index:99999;
        padding:5px 8px;
        border-radius:999px;
        background:rgba(238,255,235,.92);
        border:2px solid rgba(85,217,120,.7);
        color:#2d723b;
        font:900 10px system-ui,sans-serif;
        pointer-events:none;
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
    return window.GJ_BATTLE_RUNTIME || null;
  }

  function getRuntimeState(){
    const rt = getRuntime();
    if (rt && rt.state) return rt.state;

    window.GJ_BATTLE_RUNTIME = window.GJ_BATTLE_RUNTIME || {};
    window.GJ_BATTLE_RUNTIME.state = window.GJ_BATTLE_RUNTIME.state || {};
    return window.GJ_BATTLE_RUNTIME.state;
  }

  function safeNum(v, fallback){
    const n = Number(v);
    return Number.isFinite(n) ? n : Number(fallback || 0);
  }

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

    emit('gj:battle-state-updated', window.GJ_BATTLE_STATE);
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

    if (!s.timeLeft || safeNum(s.timeLeft, 0) <= 0){
      s.timeLeft = TIME_LIMIT;
    }

    s.spawnEvery = safeNum(
      s.spawnEvery,
      DIFF === 'hard' || DIFF === 'challenge' ? 650 : DIFF === 'easy' ? 1050 : 820
    );

    s.targetLife = safeNum(
      s.targetLife,
      DIFF === 'hard' || DIFF === 'challenge' ? 1800 : DIFF === 'easy' ? 3200 : 2400
    );

    syncUi();
  }

  const foodGood = ['🍎','🥦','🥚','🍚','🐟','🥕','🍌','🥛','🍊','🌽'];
  const foodJunk = ['🍩','🍟','🍔','🥤','🍰','🍭','🍬','🧁','🍕','🍪'];

  function pick(arr){
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function rand(min, max){
    return Math.random() * (max - min) + min;
  }

  function arena(){
    return $('#arena') || $('.arena');
  }

  function floatingText(text, x, y, good){
    const ar = arena();
    if (!ar) return;

    const el = document.createElement('div');
    el.className = 'floating-text';
    el.textContent = text;
    el.style.position = 'absolute';
    el.style.left = x + '%';
    el.style.top = y + '%';
    el.style.zIndex = '120';
    el.style.transform = 'translate(-50%,-50%)';
    el.style.fontWeight = '1000';
    el.style.fontSize = '20px';
    el.style.pointerEvents = 'none';
    el.style.color = good ? '#247a39' : '#9b2c22';
    el.style.textShadow = '0 2px 0 rgba(255,255,255,.8)';
    ar.appendChild(el);

    el.animate([
      { opacity:1, transform:'translate(-50%,-50%) scale(1)' },
      { opacity:0, transform:'translate(-50%,-110%) scale(1.18)' }
    ], {
      duration:650,
      easing:'ease-out',
      fill:'forwards'
    });

    setTimeout(function(){
      el.remove();
    }, 700);
  }

  function coreSync(reason){
    if (window.GJ_BATTLE_CORE && typeof window.GJ_BATTLE_CORE.forceRealtimeSync === 'function'){
      window.GJ_BATTLE_CORE.forceRealtimeSync(reason || 'unstuck');
    }
  }

  function endGame(result, reason){
    const rt = getRuntime();
    const s = getRuntimeState();

    if (s.ended) return;

    if (rt && typeof rt.endGame === 'function' && rt.endGame !== endGame){
      try{
        rt.endGame(result || 'timeup', reason || 'time-up');
        return;
      }catch(_){}
    }

    s.ended = true;
    s.running = false;

    clearInterval(s.spawnTimer);
    clearInterval(s.clockTimer);

    const overlay = $('#resultOverlay');
    const op = window.GJ_BATTLE_OPPONENT || {};
    const opScore = safeNum(op.score || op.points, 0);

    let title = 'จบ Battle!';
    let icon = '💪';

    if (s.score > opScore){
      title = 'ชนะ Battle!';
      icon = '🏆';
    }else if (s.score < opScore){
      title = 'แพ้ Battle!';
      icon = '💪';
    }else{
      title = 'เสมอ Battle!';
      icon = '🤝';
    }

    const resultIcon = $('#resultIcon');
    const resultTitle = $('#resultTitle,[data-result-title]');
    const resultReason = $('#resultReason');

    const resultMeName = $('#resultMeName');
    const resultMyScore = $('#resultMyScore');
    const resultMyMeta = $('#resultMyMeta');

    const resultOpName = $('#resultOpName');
    const resultOpScore = $('#resultOpScore');
    const resultOpMeta = $('#resultOpMeta');

    if (resultIcon) resultIcon.textContent = icon;
    if (resultTitle) resultTitle.textContent = title;
    if (resultReason) resultReason.textContent = 'เหตุผล: ' + (reason || 'time-up');

    if (resultMeName) resultMeName.textContent = 'คุณ: ' + PLAYER_NAME;
    if (resultMyScore) resultMyScore.textContent = String(s.score);
    if (resultMyMeta) resultMyMeta.textContent = 'Good: ' + s.good + ' • Junk: ' + s.junk + ' • Miss: ' + s.miss;

    if (resultOpName) resultOpName.textContent = 'คู่แข่ง: ' + (op.name || op.playerName || op.displayName || 'รอคู่แข่ง...');
    if (resultOpScore) resultOpScore.textContent = String(opScore);
    if (resultOpMeta){
      resultOpMeta.textContent =
        'Good: ' + safeNum(op.good, 0) +
        ' • Junk: ' + safeNum(op.junk, 0) +
        ' • Miss: ' + safeNum(op.miss, 0);
    }

    if (overlay) overlay.classList.add('show');

    coreSync('unstuck-end-game');

    emit('gj:battle-ended', {
      result:result || 'timeup',
      reason:reason || 'time-up',
      score:s.score
    });
  }

  function applyHit(target){
    if (!target || target.classList.contains('gj-force-hit') || target.classList.contains('hit')) return false;

    const s = getRuntimeState();
    if (s.ended) return false;

    const kind = target.dataset.kind || target.dataset.type || (target.classList.contains('junk') ? 'junk' : 'good');
    const x = safeNum(target.dataset.x, 50);
    const y = safeNum(target.dataset.y, 50);

    target.classList.add('gj-force-hit', 'hit');

    if (kind === 'good'){
      const gain = 10 + (s.power >= 4 ? 4 : 0);
      s.good += 1;
      s.score += gain;
      s.power = Math.min(5, safeNum(s.power, 0) + 1);

      floatingText('+' + gain, x, y, true);

      emit('gj:good-collected', {
        score:gain,
        power:1,
        kind:'good',
        source:'unstuck-patch'
      });

      emit('hha:score', {
        type:'good',
        score:gain,
        points:gain
      });
    }else{
      if (s.shieldActive){
        s.junk += 1;
        floatingText('BLOCK', x, y, true);
        emit('gj:junk-blocked', { kind:'junk', source:'unstuck-patch' });
      }else{
        s.junk += 1;
        s.miss += 1;
        s.hearts = Math.max(0, safeNum(s.hearts, 3) - 1);
        s.score = Math.max(0, safeNum(s.score, 0) - 4);

        floatingText('-❤', x, y, false);

        emit('gj:junk-hit', {
          damage:1,
          kind:'junk',
          source:'unstuck-patch'
        });

        emit('hha:miss', {
          type:'junk',
          damage:1
        });

        if (s.hearts <= 0){
          setTimeout(function(){
            endGame('lose', 'heart-zero');
          }, 120);
        }
      }
    }

    syncUi();
    coreSync('unstuck-target-hit');

    setTimeout(function(){
      target.remove();
    }, 110);

    return true;
  }

  function spawnTarget(forcedKind){
    const ar = arena();
    const s = getRuntimeState();

    if (!ar || !s.running || s.ended) return null;

    const kind = forcedKind || (Math.random() < 0.68 ? 'good' : 'junk');
    const x = rand(12, 88);
    const y = rand(16, 80);

    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'target ' + (kind === 'junk' ? 'bad junk' : 'good');
    item.dataset.kind = kind;
    item.dataset.type = kind;
    item.dataset.x = String(x);
    item.dataset.y = String(y);
    item.dataset.spawnedAt = String(now());
    item.textContent = kind === 'good' ? pick(foodGood) : pick(foodJunk);

    item.style.left = x + '%';
    item.style.top = y + '%';
    item.style.pointerEvents = 'auto';

    item.addEventListener('pointerdown', function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      applyHit(item);
    }, { passive:false });

    item.addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      applyHit(item);
    }, { passive:false });

    item.addEventListener('touchstart', function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      applyHit(item);
    }, { passive:false });

    ar.appendChild(item);

    setTimeout(function(){
      if (!item.parentNode || s.ended) return;

      if ((item.dataset.kind || item.dataset.type) === 'good'){
        s.miss += 1;
        floatingText('MISS', x, y, false);
        emit('hha:miss', {
          type:'miss-good',
          damage:0
        });
      }

      item.remove();
      syncUi();
      coreSync('unstuck-target-timeout');
    }, Math.max(1200, safeNum(s.targetLife, 2400)));

    return item;
  }

  function ensureSpawnLoop(){
    const s = getRuntimeState();

    if (s.ended) return;

    clearInterval(s.spawnTimer);

    s.spawnTimer = setInterval(function(){
      const ar = arena();
      if (!ar || s.ended || !s.running) return;

      const activeTargets = $all('.target:not(.hit):not(.gj-force-hit)', ar);

      if (activeTargets.length < 3){
        spawnTarget();
      }
    }, Math.max(520, safeNum(s.spawnEvery, 820)));

    if ($all('.target:not(.hit):not(.gj-force-hit)', arena()).length === 0){
      for (let i = 0; i < 3; i++){
        setTimeout(function(){
          spawnTarget();
        }, i * 240);
      }
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
    const ar = arena();
    if (!ar) return;

    $all('.target:not(.hit):not(.gj-force-hit)', ar).forEach(function(t){
      const born = safeNum(t.dataset.spawnedAt, 0);
      if (born && now() - born > life + 1200){
        if ((t.dataset.kind || t.dataset.type) === 'good'){
          s.miss += 1;
        }
        t.remove();
        syncUi();
      }
    });
  }

  function bindArenaFallbackHit(){
    const ar = arena();
    if (!ar || ar.dataset.gjUnstuckArenaBound === '1') return;

    ar.dataset.gjUnstuckArenaBound = '1';

    ar.addEventListener('pointerdown', function(ev){
      if (ev.target && ev.target.classList && ev.target.classList.contains('target')) return;

      const targets = $all('.target:not(.hit):not(.gj-force-hit)', ar);
      if (!targets.length) return;

      const p = { x:ev.clientX, y:ev.clientY };
      let best = null;
      let dist = Infinity;

      targets.forEach(function(t){
        const r = t.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const d = Math.hypot(cx - p.x, cy - p.y);

        if (d < dist){
          dist = d;
          best = t;
        }
      });

      if (best && dist <= 52){
        ev.preventDefault();
        ev.stopPropagation();
        applyHit(best);
      }
    }, { passive:false, capture:true });
  }

  function disableBlockingDialogs(){
    if (window.__GJ_BATTLE_DIALOG_PATCHED__) return;
    window.__GJ_BATTLE_DIALOG_PATCHED__ = true;

    const nativeAlert = window.alert;
    const nativeConfirm = window.confirm;

    window.alert = function(message){
      const msg = String(message || '');
      if (/GoodJunk|Battle|เริ่ม|เล่น|rematch|response/i.test(msg)){
        toast(msg.slice(0, 80));
        return;
      }
      return nativeAlert.call(window, message);
    };

    window.confirm = function(message){
      const msg = String(message || '');
      if (/GoodJunk|Battle|เริ่ม|เล่น|rematch|response/i.test(msg)){
        toast(msg.slice(0, 80));
        return true;
      }
      return nativeConfirm.call(window, message);
    };
  }

  function exposeApi(){
    const rt = getRuntime() || {};
    window.GJ_BATTLE_RUNTIME = rt;

    rt.unstuckVersion = PATCH_VERSION;
    rt.applyHit = applyHit;
    rt.spawnTarget = rt.spawnTarget || spawnTarget;
    rt.forceSpawnTarget = spawnTarget;
    rt.endGame = rt.endGame || endGame;
    rt.syncBasicUI = rt.syncBasicUI || syncUi;

    window.GJ_BATTLE_RUNTIME_UNSTUCK_PATCH = {
      version:PATCH_VERSION,
      initRuntimeState,
      syncUi,
      spawnTarget,
      applyHit,
      ensureSpawnLoop,
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
    bindArenaFallbackHit();

    /*
     * สำคัญ: บังคับ restart loop เพราะ runtime เดิมบางครั้งสร้างเป้าแล้ว loop ไม่เดิน
     */
    ensureClockLoop();
    ensureSpawnLoop();

    setInterval(function(){
      const s = getRuntimeState();
      if (s.ended) return;

      cleanupStuckTargets();

      const ar = arena();
      const active = ar ? $all('.target:not(.hit):not(.gj-force-hit)', ar).length : 0;

      if (active === 0 && s.running !== false){
        spawnTarget();
      }

      syncUi();
    }, 900);

    toast('Battle runtime แก้ค้างแล้ว');

    emit('gj:battle-runtime-unstuck-ready', {
      player:PLAYER_NAME
    });

    console.info('[GoodJunk Battle Runtime Unstuck Patch]', PATCH_VERSION, 'loaded');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
