/* =========================================================
   HeroHealth • GoodJunk Battle Finish Unblock v2 Hard Summary
   FILE: /herohealth/vr-goodjunk/goodjunk-vr-battle.finish-unblock-v2-hard-summary.js
   PATCH: v20260514k

   Fix:
   - เวลา 0s แล้วค้างใน gameplay
   - Summary ไม่เปิด
   - จับค่า Score / Combo / Attack / Heart จาก DOM
   - เขียน results ลง Firebase
   - แสดง fallback summary ทันทีถ้า runtime เดิมไม่แสดง
   ========================================================= */

(() => {
  'use strict';

  const PATCH_ID = 'v20260514k-finish-unblock-v2-hard-summary';
  if (window.__GJ_BATTLE_FINISH_UNBLOCK_V2__) return;
  window.__GJ_BATTLE_FINISH_UNBLOCK_V2__ = PATCH_ID;

  const qs = new URLSearchParams(location.search);

  const ROOM = cleanRoom(qs.get('roomId') || qs.get('room') || '');
  const PID = clean(qs.get('pid') || '');
  const NAME = clean(qs.get('name') || qs.get('nick') || 'Player');
  const URL_MATCH = clean(qs.get('matchId') || '');
  const URL_HOST_PID = clean(qs.get('hostPid') || '');

  const LOG = '[GJ Battle Finish Unblock v2]';

  let db = null;
  let auth = null;
  let finished = false;
  let startedAt = Date.now();
  let watchTimer = null;
  let zeroSeenAt = 0;

  boot();

  async function boot(){
    console.info(LOG, 'loaded', {
      patch: PATCH_ID,
      room: ROOM,
      pid: PID,
      name: NAME,
      matchId: URL_MATCH,
      hostPid: URL_HOST_PID
    });

    waitForDb().catch(err => console.warn(LOG, 'Firebase optional wait failed', err));

    window.addEventListener('hha:battle:start-gameplay', resetStartClock);
    document.addEventListener('hha:battle:start-gameplay', resetStartClock);

    window.addEventListener('hha:game:start', resetStartClock);
    document.addEventListener('hha:game:start', resetStartClock);

    watchTimer = setInterval(checkFinish, 300);

    window.addEventListener('pagehide', () => {
      if (watchTimer) clearInterval(watchTimer);
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) checkFinish();
    });

    setTimeout(checkFinish, 800);
  }

  function resetStartClock(){
    startedAt = Date.now();
    zeroSeenAt = 0;
    finished = false;
  }

  async function waitForDb(){
    for (let i = 0; i < 60; i++){
      if (window.HHA_FIREBASE_READY){
        const fb = await window.HHA_FIREBASE_READY;
        if (fb && fb.db && fb.auth && fb.auth.currentUser){
          db = fb.db;
          auth = fb.auth;
          return;
        }
      }
      await sleep(200);
    }
  }

  function checkFinish(){
    if (finished) return;

    const text = bodyText();

    if (hasSummaryText(text)){
      finished = true;
      return;
    }

    const timeIsZero = isTimeZero(text);
    const inBattleUi = isBattleGameplay(text);

    if (timeIsZero && inBattleUi){
      if (!zeroSeenAt) zeroSeenAt = Date.now();

      if ((Date.now() - zeroSeenAt) > 650){
        finishNow('timer-zero-hard-detect');
      }
      return;
    }

    const limitSec = Number(qs.get('time') || 0);
    if (limitSec > 0 && Date.now() - startedAt > (limitSec + 5) * 1000 && inBattleUi){
      finishNow('time-limit-safety-hard');
    }
  }

  function isTimeZero(text){
    const t = String(text || '').replace(/\s+/g, ' ');

    return (
      /เวลา\s*0s/i.test(t) ||
      /เวลา\s*0\s*s/i.test(t) ||
      /เวลา\s*0\b/i.test(t) ||
      /\b0s\s*•/i.test(t) ||
      /time\s*0/i.test(t)
    );
  }

  function isBattleGameplay(text){
    const t = String(text || '');

    return (
      /GoodJunk Battle/i.test(t) &&
      (
        /PLAYER/i.test(t) ||
        /SCORE/i.test(t) ||
        /COMBO/i.test(t) ||
        /HEART/i.test(t) ||
        /ATTACK/i.test(t) ||
        /RIVAL/i.test(t)
      )
    );
  }

  function hasSummaryText(text){
    return (
      /ชนะ Battle/i.test(text) ||
      /แพ้ Battle/i.test(text) ||
      /เสมอ Battle/i.test(text) ||
      /จบ Battle/i.test(text) ||
      /Battle อีกครั้ง/i.test(text) ||
      /Export Logs/i.test(text)
    );
  }

  async function finishNow(reason){
    if (finished) return;
    finished = true;

    console.warn(LOG, 'FORCE FINISH', reason);

    const result = collectResult(reason);

    await writeResult(result).catch(err => {
      console.warn(LOG, 'write result failed', err);
    });

    dispatchEndEvents(result);
    callNativeEndFunctions(result);

    setTimeout(() => {
      if (!hasSummaryText(bodyText())){
        showHardSummary(result);
      }
    }, 350);

    setTimeout(() => {
      if (!hasSummaryText(bodyText())){
        showHardSummary(result);
      }
    }, 900);
  }

  function collectResult(reason){
    const text = bodyText();

    const playerName = readBlockValue(text, 'PLAYER') || NAME || 'Player';
    const score = readBlockNumber(text, 'SCORE') || readBlockNumber(text, 'Score') || 0;
    const combo = readBlockNumber(text, 'COMBO') || readBlockNumber(text, 'Combo') || 0;
    const attackNow = readFractionFirst(text, 'ATTACK') || 0;
    const heartLeft = countFirstHearts(text);

    const rivalName = readAfterThaiLabel(text, 'คู่แข่ง') || 'Rival';
    const rivalScore = readRivalScore(text) || 0;

    const winner =
      score > rivalScore ? playerName :
      rivalScore > score ? rivalName :
      'เสมอ';

    return {
      roomId: ROOM,
      matchId: URL_MATCH,
      pid: PID || 'player',
      name: playerName,
      score,
      combo,
      attack: attackNow,
      heart: heartLeft,
      rivalName,
      rivalScore,
      winner,
      finished: true,
      reason,
      patch: PATCH_ID,
      updatedAt: Date.now()
    };
  }

  function readBlockValue(text, label){
    const lines = linesOf(text);
    const idx = lines.findIndex(x => x.toUpperCase() === label.toUpperCase());
    if (idx >= 0 && lines[idx + 1]) return clean(lines[idx + 1]);
    return '';
  }

  function readBlockNumber(text, label){
    const lines = linesOf(text);
    const idx = lines.findIndex(x => x.toUpperCase() === label.toUpperCase());

    if (idx >= 0){
      for (let i = idx + 1; i < Math.min(idx + 4, lines.length); i++){
        const n = firstNumber(lines[i]);
        if (Number.isFinite(n)) return n;
      }
    }

    const re = new RegExp(label + '\\s*\\n?\\s*(-?\\d+)', 'i');
    const m = String(text || '').match(re);
    return m ? Number(m[1]) : 0;
  }

  function readFractionFirst(text, label){
    const re = new RegExp(label + '[\\s\\S]{0,60}?(\\d+)\\s*\\/\\s*(\\d+)', 'i');
    const m = String(text || '').match(re);
    return m ? Number(m[1]) : 0;
  }

  function countFirstHearts(text){
    const m = String(text || '').match(/❤️+/);
    if (!m) return 0;
    return Array.from(m[0]).length;
  }

  function readAfterThaiLabel(text, label){
    const re = new RegExp(label + '\\s*\\n?\\s*([^\\n\\r]+)', 'i');
    const m = String(text || '').match(re);
    if (!m) return '';
    return clean(m[1]).slice(0, 40);
  }

  function readRivalScore(text){
    const lines = linesOf(text);
    const idx = lines.findIndex(x => /คู่แข่ง/i.test(x));
    if (idx >= 0){
      for (let i = idx; i < Math.min(idx + 8, lines.length); i++){
        if (/score/i.test(lines[i])){
          for (let j = i + 1; j < Math.min(i + 4, lines.length); j++){
            const n = firstNumber(lines[j]);
            if (Number.isFinite(n)) return n;
          }
        }
      }
    }
    return 0;
  }

  async function writeResult(result){
    if (!db || !ROOM) return;

    const room = await db.ref(roomPath(ROOM)).get().then(s => s.val()).catch(() => null);

    const matchId =
      clean(result.matchId || '') ||
      clean(room?.activeMatchId || '') ||
      clean(room?.currentRun?.matchId || '') ||
      `${ROOM}-R1`;

    const key = safeKey(PID || 'player');
    const t = Date.now();

    const payload = {
      ...result,
      matchId,
      updatedAt: t
    };

    await db.ref(roomPath(ROOM)).update({
      status: 'ended',
      phase: 'ended',
      updatedAt: t,
      endedAt: t,

      [`results/${key}`]: payload,
      [`playerResults/${key}`]: payload,

      'currentRun/status': 'ended',
      'currentRun/phase': 'ended',
      'currentRun/endedAt': t,
      [`currentRun/results/${key}`]: payload,
      [`currentRun/playerResults/${key}`]: payload
    }).catch(() => {});

    await db.ref(matchPath(ROOM, matchId)).update({
      status: 'ended',
      phase: 'ended',
      endedAt: t,
      updatedAt: t,

      [`results/${key}`]: payload,
      [`playerResults/${key}`]: payload
    }).catch(() => {});
  }

  function dispatchEndEvents(result){
    [
      'hha:battle:finish',
      'hha:battle:end',
      'hha:battle:force-summary',
      'hha:game:end',
      'hha:summary:open'
    ].forEach(name => {
      window.dispatchEvent(new CustomEvent(name, { detail: result }));
      document.dispatchEvent(new CustomEvent(name, { detail: result }));
    });
  }

  function callNativeEndFunctions(result){
    [
      'endGame',
      'finishGame',
      'finishBattle',
      'endBattle',
      'showSummary',
      'showBattleSummary',
      'openSummary',
      'renderSummary',
      'completeGame',
      'gameOver',
      'showGameOver'
    ].forEach(fn => {
      try{
        if (typeof window[fn] === 'function'){
          window[fn](result);
        }
      }catch(err){
        console.warn(LOG, `call ${fn} failed`, err);
      }
    });
  }

  function showHardSummary(result){
    let old = document.getElementById('gjBattleHardSummary');
    if (old) old.remove();

    hideGameplayBehind();

    const title =
      result.winner === 'เสมอ'
        ? 'เสมอ Battle!'
        : result.winner === result.name
          ? 'ชนะ Battle!'
          : 'จบ Battle!';

    const box = document.createElement('div');
    box.id = 'gjBattleHardSummary';

    box.innerHTML = `
      <div class="gjbs-card">
        <div class="gjbs-medal">${result.winner === result.name ? '🏅' : '🏁'}</div>
        <h1>${escapeHtml(title)}</h1>
        <div class="gjbs-note">รอบที่ 1 • ระบบสรุปผลอัตโนมัติ</div>

        <div class="gjbs-board">
          <div class="gjbs-player mine">
            <div class="gjbs-label">คุณ: ${escapeHtml(result.name)}</div>
            <div class="gjbs-score">${Number(result.score || 0)}</div>
            <div class="gjbs-meta">
              หัวใจ: ${'❤️'.repeat(Math.max(0, Number(result.heart || 0))) || '—'}<br>
              Combo: ${Number(result.combo || 0)}<br>
              Attack: ${Number(result.attack || 0)}
            </div>
          </div>

          <div class="gjbs-player rival">
            <div class="gjbs-label">คู่แข่ง: ${escapeHtml(result.rivalName || 'Rival')}</div>
            <div class="gjbs-score">${Number(result.rivalScore || 0)}</div>
            <div class="gjbs-meta">
              คะแนนคู่แข่งจากหน้าจอนี้<br>
              หากอีกเครื่องส่งผลแล้วจะซิงก์ภายหลัง
            </div>
          </div>
        </div>

        <div class="gjbs-stats">
          <div><b>${Number(result.score || 0)}</b><span>Score</span></div>
          <div><b>${Number(result.combo || 0)}</b><span>Combo</span></div>
          <div><b>${Number(result.attack || 0)}</b><span>Attack</span></div>
        </div>

        <div class="gjbs-actions">
          <button type="button" data-again>🔁 Battle อีกครั้ง</button>
          <button type="button" data-lobby>⚔️ กลับ Lobby</button>
          <button type="button" data-hub>🏠 Hub</button>
        </div>
      </div>
    `;

    const css = document.createElement('style');
    css.textContent = `
      #gjBattleHardSummary{
        position:fixed;
        inset:0;
        z-index:2147483800;
        display:grid;
        place-items:center;
        padding:18px;
        background:rgba(132,82,48,.50);
        backdrop-filter:blur(13px);
        font-family:system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;
      }
      #gjBattleHardSummary .gjbs-card{
        width:min(760px,94vw);
        max-height:92dvh;
        overflow:auto;
        border:4px solid #ffbd77;
        border-radius:34px;
        background:#fffdf4;
        box-shadow:0 22px 60px rgba(91,45,17,.26);
        padding:26px 20px;
        color:#87311b;
        text-align:center;
      }
      #gjBattleHardSummary .gjbs-medal{
        width:78px;
        height:78px;
        margin:0 auto 10px;
        display:grid;
        place-items:center;
        border-radius:24px;
        border:4px solid #ffbd77;
        background:linear-gradient(180deg,#fff2dd,#ffd6a0);
        font-size:40px;
      }
      #gjBattleHardSummary h1{
        margin:0;
        font-size:clamp(34px,7vw,54px);
        line-height:1.1;
        font-weight:1000;
      }
      #gjBattleHardSummary .gjbs-note{
        margin:14px 0;
        padding:12px;
        border:3px dashed #ffbd77;
        border-radius:20px;
        font-weight:1000;
        color:#8a5a00;
      }
      #gjBattleHardSummary .gjbs-board{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:12px;
        margin-top:12px;
      }
      #gjBattleHardSummary .gjbs-player{
        border:3px solid #ffbd77;
        border-radius:22px;
        background:#fff8e9;
        padding:14px;
        text-align:left;
      }
      #gjBattleHardSummary .gjbs-player.mine{
        background:#fffbe2;
      }
      #gjBattleHardSummary .gjbs-label{
        font-weight:1000;
        font-size:16px;
      }
      #gjBattleHardSummary .gjbs-score{
        margin-top:8px;
        font-size:38px;
        font-weight:1000;
      }
      #gjBattleHardSummary .gjbs-meta{
        margin-top:6px;
        font-size:14px;
        line-height:1.5;
        font-weight:900;
      }
      #gjBattleHardSummary .gjbs-stats{
        display:grid;
        grid-template-columns:repeat(3,1fr);
        gap:10px;
        margin-top:14px;
      }
      #gjBattleHardSummary .gjbs-stats div{
        border:3px solid #ffcf93;
        border-radius:18px;
        padding:12px;
        background:#fffaf0;
      }
      #gjBattleHardSummary .gjbs-stats b{
        display:block;
        font-size:28px;
      }
      #gjBattleHardSummary .gjbs-stats span{
        display:block;
        font-size:13px;
        font-weight:900;
      }
      #gjBattleHardSummary .gjbs-actions{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        margin-top:16px;
      }
      #gjBattleHardSummary button{
        flex:1 1 170px;
        min-height:52px;
        border-radius:18px;
        border:3px solid #ffbd77;
        background:#fff;
        color:#87311b;
        font-size:16px;
        font-weight:1000;
      }
      @media (max-width:640px){
        #gjBattleHardSummary .gjbs-board{
          grid-template-columns:1fr;
        }
        #gjBattleHardSummary .gjbs-stats{
          grid-template-columns:1fr;
        }
      }
    `;

    document.head.appendChild(css);
    document.body.appendChild(box);

    box.querySelector('[data-again]').addEventListener('click', () => {
      location.reload();
    });

    box.querySelector('[data-lobby]').addEventListener('click', () => {
      const u = new URL('./goodjunk-battle-lobby.html', location.href);
      copyParams(u, ['pid','name','nick','diff','time','view','hub','zone','cat','game','gameId','theme','room','roomId']);
      u.searchParams.set('mode','battle');
      u.searchParams.set('entry','battle');
      u.searchParams.set('recommendedMode','battle');
      location.href = u.toString();
    });

    box.querySelector('[data-hub]').addEventListener('click', () => {
      const hub = qs.get('hub') || '../nutrition-zone.html';
      location.href = hub;
    });
  }

  function hideGameplayBehind(){
    Array.from(document.querySelectorAll('body > *')).forEach(el => {
      if (el.id === 'gjBattleHardSummary') return;
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
      el.setAttribute('data-gjbs-bg', '1');
    });
  }

  function copyParams(u, keys){
    keys.forEach(k => {
      const v = qs.get(k);
      if (v) u.searchParams.set(k, v);
    });
  }

  function linesOf(text){
    return String(text || '')
      .split(/\n|\r/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  function firstNumber(s){
    const m = String(s || '').match(/-?\d+/);
    return m ? Number(m[0]) : NaN;
  }

  function bodyText(){
    return document.body ? String(document.body.innerText || document.body.textContent || '') : '';
  }

  function roomPath(roomId){
    return `hha-battle/goodjunk/battleRooms/${safeKey(roomId)}`;
  }

  function matchPath(roomId, matchId){
    return `${roomPath(roomId)}/matches/${safeKey(matchId)}`;
  }

  function safeKey(raw){
    return String(raw || '').trim().replace(/[.#$/\[\]]/g,'_').slice(0,96) || 'key';
  }

  function clean(v){
    return String(v ?? '').trim();
  }

  function cleanRoom(v){
    let s = clean(v).toUpperCase();
    s = s.replace(/\s+/g,'').replace(/[^A-Z0-9-]/g,'');

    if (!s) return '';

    if (!s.startsWith('GJ-BT-')){
      s = 'GJ-BT-' + s
        .replace(/^GJ-BT/i,'')
        .replace(/^GJBT/i,'')
        .replace(/^BT/i,'')
        .replace(/^-/, '');
    }

    return s.slice(0,16);
  }

  function escapeHtml(s){
    return String(s ?? '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#39;");
  }

  function sleep(ms){
    return new Promise(resolve => setTimeout(resolve, ms));
  }
})();
