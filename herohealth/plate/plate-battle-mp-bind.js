// === /herohealth/plate/plate-battle-mp-bind.js ===
// FULL PATCH v20260326-PLATE-BATTLE-MP-BIND-FULL

(function () {
  'use strict';

  let lastRoom = null;
  let started = false;
  let finished = false;
  let lastScoreSyncAt = 0;
  let lastHpSyncAt = 0;
  let localHp = 100;
  let enemyHp = 100;

  function el(id) {
    return document.getElementById(id);
  }

  function injectCss() {
    if (document.getElementById('plateBattleMpStyle')) return;
    const style = document.createElement('style');
    style.id = 'plateBattleMpStyle';
    style.textContent = `
      .plate-battle-mp-hud{
        position:fixed;
        top:max(12px, env(safe-area-inset-top));
        right:12px;
        z-index:85;
        pointer-events:none;
      }
      .plate-battle-mp-card{
        width:min(300px, calc(100vw - 24px));
        border-radius:18px;
        padding:12px;
        color:#f8fafc;
        background:linear-gradient(180deg, rgba(15,23,42,.94), rgba(2,6,23,.94));
        border:1px solid rgba(255,255,255,.12);
        box-shadow:0 14px 34px rgba(0,0,0,.34);
        backdrop-filter:blur(8px);
      }
      .plate-battle-mp-title{
        font-size:13px;
        font-weight:900;
        color:#dbeafe;
        margin-bottom:10px;
        letter-spacing:.2px;
      }
      .plate-battle-mp-row{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        padding:10px;
        border-radius:14px;
        border:1px solid rgba(255,255,255,.08);
        background:rgba(255,255,255,.04);
        margin-bottom:8px;
      }
      .plate-battle-mp-left{
        display:flex;
        align-items:center;
        gap:10px;
        min-width:0;
      }
      .plate-battle-role{
        width:26px;
        height:26px;
        border-radius:999px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        font-size:12px;
        font-weight:900;
        color:#fff;
      }
      .plate-battle-role.role-a{
        background:linear-gradient(180deg,#f97316,#ea580c);
      }
      .plate-battle-role.role-b{
        background:linear-gradient(180deg,#3b82f6,#1d4ed8);
      }
      .plate-battle-mp-sub{
        font-size:11px;
        color:#cbd5e1;
      }
      .plate-battle-mp-state{
        padding:4px 8px;
        border-radius:999px;
        font-size:11px;
        font-weight:900;
      }
      .plate-battle-mp-state.ok{
        background:#86efac;
        color:#052e16;
      }
      .plate-battle-mp-state.wait{
        background:#fde68a;
        color:#78350f;
      }
      .plate-battle-mp-state.done{
        background:#93c5fd;
        color:#082f49;
      }
      .plate-battle-mp-state.ko{
        background:#fecaca;
        color:#7f1d1d;
      }
      .plate-battle-mp-note{
        margin-top:4px;
        font-size:12px;
        color:#cbd5e1;
      }
      .plate-battle-mp-wait-layer{
        position:fixed;
        inset:0;
        z-index:120;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:18px;
        background:rgba(2,6,23,.68);
        backdrop-filter:blur(8px);
      }
      .plate-battle-mp-wait-card{
        width:min(520px,100%);
        border-radius:24px;
        padding:22px;
        text-align:center;
        color:#f8fafc;
        background:linear-gradient(180deg, rgba(15,23,42,.96), rgba(2,6,23,.96));
        border:1px solid rgba(255,255,255,.12);
        box-shadow:0 18px 50px rgba(0,0,0,.38);
      }
      .plate-battle-mp-wait-emoji{
        font-size:42px;
        margin-bottom:8px;
      }
    `;
    document.head.appendChild(style);
  }

  function injectDom() {
    if (el('plateBattleMpHud')) return;

    const hud = document.createElement('div');
    hud.id = 'plateBattleMpHud';
    hud.className = 'plate-battle-mp-hud';
    hud.hidden = true;
    hud.innerHTML = `
      <div class="plate-battle-mp-card">
        <div class="plate-battle-mp-title">⚔️ Battle Status</div>

        <div class="plate-battle-mp-row">
          <div class="plate-battle-mp-left">
            <span class="plate-battle-role role-a">A</span>
            <div>
              <div id="plateBattleAName">Player A</div>
              <div class="plate-battle-mp-sub">
                HP <strong id="plateBattleAHp">100</strong> • Score <strong id="plateBattleAScore">0</strong>
              </div>
            </div>
          </div>
          <div id="plateBattleAState" class="plate-battle-mp-state wait">รอ</div>
        </div>

        <div class="plate-battle-mp-row">
          <div class="plate-battle-mp-left">
            <span class="plate-battle-role role-b">B</span>
            <div>
              <div id="plateBattleBName">Player B</div>
              <div class="plate-battle-mp-sub">
                HP <strong id="plateBattleBHp">100</strong> • Score <strong id="plateBattleBScore">0</strong>
              </div>
            </div>
          </div>
          <div id="plateBattleBState" class="plate-battle-mp-state wait">รอ</div>
        </div>

        <div id="plateBattleMpNote" class="plate-battle-mp-note">กำลังรอผู้เล่นทั้งสองฝั่งพร้อม</div>
      </div>
    `;

    const wait = document.createElement('div');
    wait.id = 'plateBattleMpWaitLayer';
    wait.className = 'plate-battle-mp-wait-layer';
    wait.hidden = true;
    wait.innerHTML = `
      <div class="plate-battle-mp-wait-card">
        <div class="plate-battle-mp-wait-emoji">⏳</div>
        <h2 id="plateBattleMpWaitTitle">รออีกฝั่งจบเกม</h2>
        <p id="plateBattleMpWaitText">เครื่องนี้จบแล้ว กำลังรอผลสุดท้าย</p>
      </div>
    `;

    document.body.appendChild(hud);
    document.body.appendChild(wait);
  }

  function players(room) {
    const arr = Object.values(room?.players || {}).filter(Boolean);
    return {
      A: arr.find(p => String(p.role || '').toUpperCase() === 'A') || null,
      B: arr.find(p => String(p.role || '').toUpperCase() === 'B') || null
    };
  }

  function stateText(p) {
    if (!p) return { text: 'ยังไม่มี', cls: 'wait' };
    if (Number(p.hp || 0) <= 0) return { text: 'KO', cls: 'ko' };
    if (p.finished) return { text: 'จบแล้ว', cls: 'done' };
    if (p.ready) return { text: 'พร้อม', cls: 'ok' };
    return { text: 'รอ', cls: 'wait' };
  }

  function showHud(show) {
    const n = el('plateBattleMpHud');
    if (n) n.hidden = !show;
  }

  function showWait(show, title = 'รออีกฝั่งจบเกม', text = 'เครื่องนี้จบแล้ว กำลังรอผลสุดท้าย') {
    const layer = el('plateBattleMpWaitLayer');
    if (!layer) return;
    if (el('plateBattleMpWaitTitle')) el('plateBattleMpWaitTitle').textContent = title;
    if (el('plateBattleMpWaitText')) el('plateBattleMpWaitText').textContent = text;
    layer.hidden = !show;
  }

  function render(room) {
    lastRoom = room || null;
    if (!room) return;

    const { A, B } = players(room);
    const state = String(room?.meta?.state || '');
    const myRole = window.PLATE_MP?.getRole?.() || '';
    const me = myRole === 'A' ? A : B;
    const enemy = myRole === 'A' ? B : A;

    if (el('plateBattleAName')) el('plateBattleAName').textContent = A?.name || A?.pid || 'Player A';
    if (el('plateBattleBName')) el('plateBattleBName').textContent = B?.name || B?.pid || 'Player B';

    if (el('plateBattleAHp')) el('plateBattleAHp').textContent = String(Math.max(0, Math.round(Number(A?.hp ?? 100))));
    if (el('plateBattleBHp')) el('plateBattleBHp').textContent = String(Math.max(0, Math.round(Number(B?.hp ?? 100))));

    if (el('plateBattleAScore')) el('plateBattleAScore').textContent = String(Math.round(Number(A?.finalScore || A?.score || 0)));
    if (el('plateBattleBScore')) el('plateBattleBScore').textContent = String(Math.round(Number(B?.finalScore || B?.score || 0)));

    const aState = stateText(A);
    const bState = stateText(B);

    if (el('plateBattleAState')) {
      el('plateBattleAState').textContent = aState.text;
      el('plateBattleAState').className = `plate-battle-mp-state ${aState.cls}`;
    }
    if (el('plateBattleBState')) {
      el('plateBattleBState').textContent = bState.text;
      el('plateBattleBState').className = `plate-battle-mp-state ${bState.cls}`;
    }

    if (el('plateBattleMpNote')) {
      if (state === 'lobby') {
        el('plateBattleMpNote').textContent = 'กำลังรอผู้เล่นทั้งสองฝั่งพร้อม';
      } else if (state === 'playing') {
        el('plateBattleMpNote').textContent = 'สู้ได้เลย • ลด HP ฝั่งตรงข้ามให้ถึง 0';
      } else {
        el('plateBattleMpNote').textContent = 'กำลังสรุปผลการต่อสู้';
      }
    }

    showHud(true);

    if (state === 'playing' && !started) started = true;

    if (finished) {
      const bothFinished = !!(A?.finished && B?.finished);
      showWait(
        !bothFinished,
        'รออีกฝั่งจบเกม',
        bothFinished ? 'ครบทั้งสองฝั่งแล้ว' : 'เครื่องนี้จบแล้ว กำลังรอผลสุดท้าย'
      );
    }

    if (me) localHp = Math.max(0, Number(me.hp ?? localHp));
    if (enemy) enemyHp = Math.max(0, Number(enemy.hp ?? enemyHp));
  }

  function bindRoomEvents() {
    window.addEventListener('plate:multiplayer-room', ev => {
      const room = ev?.detail?.room || null;
      if (!room) return;
      render(room);
    });
  }

  function bindActionEvents() {
    window.addEventListener('plate:multiplayer-action', ev => {
      const action = ev?.detail?.action || null;
      if (!action) return;

      const myRole = window.PLATE_MP?.getRole?.() || '';
      const fromRole = String(action.role || '').toUpperCase();
      if (!fromRole || fromRole === myRole) return;

      if (action.type === 'hit') {
        applyRemoteDamage(Math.max(0, Number(action.damage || 0)), action);
      } else if (action.type === 'heal') {
        applyRemoteHeal(Math.max(0, Number(action.heal || 0)), action);
      } else if (action.type === 'block') {
        applyRemoteBlock(action);
      }
    });
  }

  function applyRemoteDamage(damage, action) {
    if (typeof window.__PLATE_BATTLE_REMOTE_HIT__ === 'function') {
      window.__PLATE_BATTLE_REMOTE_HIT__(damage, action);
      return;
    }

    localHp = Math.max(0, localHp - damage);
    try { window.__PLATE_BATTLE_SET_LOCAL_HP__?.(localHp); } catch {}
    syncHp(localHp);

    if (localHp <= 0) {
      try { window.__PLATE_BATTLE_FORCE_END__?.('lose'); } catch {}
    }
  }

  function applyRemoteHeal(heal, action) {
    if (typeof window.__PLATE_BATTLE_REMOTE_HEAL__ === 'function') {
      window.__PLATE_BATTLE_REMOTE_HEAL__(heal, action);
      return;
    }

    localHp = Math.min(100, localHp + heal);
    try { window.__PLATE_BATTLE_SET_LOCAL_HP__?.(localHp); } catch {}
    syncHp(localHp);
  }

  function applyRemoteBlock(action) {
    if (typeof window.__PLATE_BATTLE_REMOTE_BLOCK__ === 'function') {
      window.__PLATE_BATTLE_REMOTE_BLOCK__(action);
    }
  }

  async function waitForGate() {
    if (!window.__PLATE_MP_ENABLED__) return;
    if (!window.__PLATE_MP_LOCKED__) return;

    await new Promise(resolve => {
      window.addEventListener('plate:multiplayer-start', () => resolve(), { once: true });
    });
  }

  function canRunNow() {
    if (!window.__PLATE_MP_ENABLED__) return true;
    return !window.__PLATE_MP_LOCKED__;
  }

  function syncScore(score) {
    if (!window.PLATE_MP) return;
    const now = Date.now();
    if (now - lastScoreSyncAt < 120) return;
    lastScoreSyncAt = now;
    try {
      window.PLATE_MP.syncScore(Number(score || 0));
    } catch {}
  }

  function syncHp(hp) {
    if (!window.PLATE_MP) return;
    const now = Date.now();
    if (now - lastHpSyncAt < 120) return;
    lastHpSyncAt = now;
    try {
      window.PLATE_MP.syncHp(Math.max(0, Number(hp || 0)));
    } catch {}
  }

  function sendHit(damage, extra = {}) {
    try {
      window.PLATE_MP?.sendAction('hit', {
        damage: Math.max(0, Number(damage || 0)),
        ...extra
      });
    } catch {}
  }

  function sendHeal(heal, extra = {}) {
    try {
      window.PLATE_MP?.sendAction('heal', {
        heal: Math.max(0, Number(heal || 0)),
        ...extra
      });
    } catch {}
  }

  function sendBlock(extra = {}) {
    try {
      window.PLATE_MP?.sendAction('block', { ...extra });
    } catch {}
  }

  async function finishBattle(summary = {}) {
    if (!window.PLATE_MP || finished) return;
    finished = true;

    const result = summary.result || (
      Number(summary.hp || localHp) <= 0 ? 'lose'
      : Number(summary.enemyHp || enemyHp) <= 0 ? 'win'
      : 'draw'
    );

    try {
      await window.PLATE_MP.finish({
        finished: true,
        finishedAt: Date.now(),
        hp: Math.max(0, Number(summary.hp ?? localHp)),
        enemyHp: Math.max(0, Number(summary.enemyHp ?? enemyHp)),
        finalScore: Number(summary.score || 0),
        result
      });
    } catch {}

    showWait(true, 'รออีกฝั่งจบเกม', 'เครื่องนี้จบแล้ว กำลังรอผลสุดท้าย');

    await new Promise(resolve => {
      const handler = ev => {
        const room = ev?.detail?.room || null;
        const { A, B } = players(room || {});
        if (A?.finished && B?.finished) {
          window.removeEventListener('plate:multiplayer-room', handler);
          resolve();
        }
      };

      window.addEventListener('plate:multiplayer-room', handler);

      const roomNow = window.PLATE_MP?.getRoom?.() || lastRoom || null;
      if (roomNow) {
        const { A, B } = players(roomNow);
        if (A?.finished && B?.finished) {
          window.removeEventListener('plate:multiplayer-room', handler);
          resolve();
        }
      }
    });

    showWait(false);
  }

  async function bootstrap(startFn) {
    await waitForGate();
    if (typeof startFn === 'function') startFn();
  }

  function boot() {
    injectCss();
    injectDom();
    bindRoomEvents();
    bindActionEvents();

    const room = window.PLATE_MP?.getRoom?.() || null;
    if (room) render(room);
    setTimeout(() => {
      const r = window.PLATE_MP?.getRoom?.() || null;
      if (r) render(r);
    }, 400);
  }

  window.PlateBattleMP = {
    waitForGate,
    canRunNow,
    syncScore,
    syncHp,
    sendHit,
    sendHeal,
    sendBlock,
    finish: finishBattle,
    bootstrap,
    setLocalHp(v) {
      localHp = Math.max(0, Number(v || 0));
      syncHp(localHp);
    },
    getLocalHp() {
      return localHp;
    },
    getEnemyHp() {
      return enemyHp;
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();