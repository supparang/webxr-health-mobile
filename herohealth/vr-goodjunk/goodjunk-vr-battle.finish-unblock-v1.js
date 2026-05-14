/* =========================================================
   HeroHealth • GoodJunk Battle Finish Unblock v1
   FILE: /herohealth/vr-goodjunk/goodjunk-vr-battle.finish-unblock-v1.js
   PATCH: v20260514i

   Fix:
   - เล่น Battle ได้แล้ว แต่เวลา 0s แล้วค้าง
   - บังคับจบเกมเมื่อ timer = 0
   - เรียก end/summary function ที่มีอยู่ใน runtime เดิม
   - เขียนสถานะ ended กลับ Firebase แบบปลอดภัย
   ========================================================= */

(() => {
  'use strict';

  const PATCH_ID = 'v20260514i-finish-unblock-v1';
  if (window.__GJ_BATTLE_FINISH_UNBLOCK_V1__) return;
  window.__GJ_BATTLE_FINISH_UNBLOCK_V1__ = PATCH_ID;

  const qs = new URLSearchParams(location.search);

  const ROOM = cleanRoom(qs.get('roomId') || qs.get('room') || '');
  const PID = clean(qs.get('pid') || '');
  const NAME = clean(qs.get('name') || qs.get('nick') || 'Player');
  const MATCH_ID = clean(qs.get('matchId') || '');

  const LOG = '[GJ Battle Finish Unblock v1]';

  let db = null;
  let auth = null;
  let finished = false;
  let startedAt = Date.now();
  let watchTimer = null;

  boot();

  async function boot(){
    console.info(LOG, 'loaded', {
      patch: PATCH_ID,
      room: ROOM,
      pid: PID,
      name: NAME,
      matchId: MATCH_ID
    });

    try{
      await waitForDb().catch(() => null);
    }catch(_){}

    startedAt = Date.now();

    watchTimer = setInterval(checkFinish, 450);

    window.addEventListener('pagehide', () => {
      if (watchTimer) clearInterval(watchTimer);
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) checkFinish();
    });

    window.addEventListener('hha:battle:start-gameplay', () => {
      startedAt = Date.now();
      finished = false;
    });

    document.addEventListener('hha:battle:start-gameplay', () => {
      startedAt = Date.now();
      finished = false;
    });
  }

  async function waitForDb(){
    for (let i = 0; i < 50; i++){
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

    const timeText = getBodyText();

    const timeZero =
      /เวลา\s*0s/i.test(timeText) ||
      /เวลา\s*0\s*s/i.test(timeText) ||
      /0s\s*•/i.test(timeText) ||
      /time\s*0/i.test(timeText);

    const hasGameUi =
      /GoodJunk Battle/i.test(timeText) &&
      /Score/i.test(timeText) &&
      /Heart/i.test(timeText);

    const hasSummary =
      /ชนะ Battle/i.test(timeText) ||
      /แพ้ Battle/i.test(timeText) ||
      /Battle อีกครั้ง/i.test(timeText) ||
      /Export Logs/i.test(timeText);

    if (hasSummary) {
      finished = true;
      return;
    }

    if (timeZero && hasGameUi){
      finishGame('timer-zero-text');
      return;
    }

    // safety: ถ้า query time หมดจริง แต่ UI ไม่ยอม end
    const limitSec = Number(qs.get('time') || 0);
    if (limitSec > 0 && Date.now() - startedAt > (limitSec + 4) * 1000){
      finishGame('time-limit-safety');
    }
  }

  async function finishGame(reason){
    if (finished) return;
    finished = true;

    console.warn(LOG, 'force finish', reason);

    const result = collectLocalResult(reason);

    try{
      await writeResult(result);
    }catch(err){
      console.warn(LOG, 'write result failed', err);
    }

    dispatchFinish(result);

    callEndFunctions(result);

    setTimeout(() => {
      if (!hasSummaryVisible()){
        showFallbackSummary(result);
      }
    }, 900);
  }

  function collectLocalResult(reason){
    const text = getBodyText();

    const score = readNumberAfter(text, /score/i) || readNumberAfter(text, /คะแนน/i) || 0;
    const combo = readNumberAfter(text, /combo/i) || 0;
    const attack = readAttack(text);
    const heart = readHeart(text);

    return {
      roomId: ROOM,
      matchId: MATCH_ID || '',
      pid: PID || 'player',
      name: NAME || 'Player',
      score,
      combo,
      attack,
      heart,
      finished: true,
      reason,
      updatedAt: Date.now()
    };
  }

  function readNumberAfter(text, pattern){
    const lines = String(text || '').split(/\n|\r/).map(s => s.trim()).filter(Boolean);

    for (let i = 0; i < lines.length; i++){
      if (pattern.test(lines[i])){
        for (let j = i; j < Math.min(i + 3, lines.length); j++){
          const m = lines[j].match(/-?\d+/);
          if (m) return Number(m[0]);
        }
      }
    }

    return 0;
  }

  function readAttack(text){
    const m = String(text || '').match(/attack\s*(\d+)\s*\/\s*(\d+)/i);
    if (!m) return 0;
    return Number(m[1] || 0);
  }

  function readHeart(text){
    const m = String(text || '').match(/(❤️+)/);
    if (!m) return 0;
    return Array.from(m[1]).length;
  }

  async function writeResult(result){
    if (!db || !ROOM) return;

    const room = await db.ref(roomPath(ROOM)).get().then(s => s.val()).catch(() => null);

    const matchId =
      result.matchId ||
      clean(room?.activeMatchId || '') ||
      clean(room?.currentRun?.matchId || '') ||
      `${ROOM}-R1`;

    const key = safeKey(PID || 'player');
    const t = Date.now();

    const payload = {
      ...result,
      matchId,
      updatedAt:t
    };

    await db.ref(roomPath(ROOM)).update({
      status:'ended',
      phase:'ended',
      updatedAt:t,
      [`results/${key}`]: payload,
      [`currentRun/results/${key}`]: payload,
      [`currentRun/status`]:'ended',
      [`currentRun/phase`]:'ended',
      [`currentRun/endedAt`]:t
    }).catch(() => {});

    await db.ref(matchPath(ROOM, matchId)).update({
      status:'ended',
      phase:'ended',
      endedAt:t,
      updatedAt:t,
      [`playerResults/${key}`]: payload,
      [`results/${key}`]: payload
    }).catch(() => {});
  }

  function dispatchFinish(result){
    window.dispatchEvent(new CustomEvent('hha:battle:finish', { detail:result }));
    window.dispatchEvent(new CustomEvent('hha:battle:end', { detail:result }));
    window.dispatchEvent(new CustomEvent('hha:game:end', { detail:result }));

    document.dispatchEvent(new CustomEvent('hha:battle:finish', { detail:result }));
    document.dispatchEvent(new CustomEvent('hha:battle:end', { detail:result }));
    document.dispatchEvent(new CustomEvent('hha:game:end', { detail:result }));
  }

  function callEndFunctions(result){
    [
      'endGame',
      'finishGame',
      'finishBattle',
      'endBattle',
      'showSummary',
      'showBattleSummary',
      'openSummary',
      'renderSummary',
      'completeGame'
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

  function hasSummaryVisible(){
    const text = getBodyText();
    return (
      /ชนะ Battle/i.test(text) ||
      /แพ้ Battle/i.test(text) ||
      /Battle อีกครั้ง/i.test(text) ||
      /Export Logs/i.test(text)
    );
  }

  function showFallbackSummary(result){
    if (document.getElementById('gjBattleFinishFallback')) return;

    const box = document.createElement('div');
    box.id = 'gjBattleFinishFallback';
    box.innerHTML = `
      <div class="gjbf-card">
        <div class="gjbf-icon">🏁</div>
        <div class="gjbf-title">จบ Battle!</div>
        <div class="gjbf-sub">ระบบสรุปผลรอบนี้ให้เรียบร้อยแล้ว</div>

        <div class="gjbf-grid">
          <div><b>${escapeHtml(result.name)}</b><span>ผู้เล่น</span></div>
          <div><b>${Number(result.score || 0)}</b><span>คะแนน</span></div>
          <div><b>${Number(result.attack || 0)}</b><span>Attack</span></div>
          <div><b>${Number(result.combo || 0)}</b><span>Combo</span></div>
        </div>

        <div class="gjbf-actions">
          <button type="button" data-again>🔁 Battle อีกครั้ง</button>
          <button type="button" data-lobby>⚔️ กลับ Lobby</button>
        </div>
      </div>
    `;

    const css = document.createElement('style');
    css.textContent = `
      #gjBattleFinishFallback{
        position:fixed;
        inset:0;
        z-index:2147483200;
        display:grid;
        place-items:center;
        padding:18px;
        background:rgba(132,82,48,.45);
        backdrop-filter:blur(12px);
        font-family:system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;
      }
      #gjBattleFinishFallback .gjbf-card{
        width:min(620px,92vw);
        border:4px solid #ffbd77;
        border-radius:34px;
        background:#fffdf4;
        box-shadow:0 22px 60px rgba(91,45,17,.24);
        padding:26px 20px;
        text-align:center;
        color:#87311b;
      }
      #gjBattleFinishFallback .gjbf-icon{
        width:86px;
        height:86px;
        margin:0 auto 14px;
        border-radius:28px;
        display:grid;
        place-items:center;
        font-size:42px;
        border:4px solid #ffbd77;
        background:linear-gradient(180deg,#fff2dd,#ffd6a0);
      }
      #gjBattleFinishFallback .gjbf-title{
        font-size:clamp(34px,7vw,54px);
        line-height:1.1;
        font-weight:1000;
      }
      #gjBattleFinishFallback .gjbf-sub{
        margin-top:8px;
        font-size:16px;
        font-weight:900;
        color:#8a5a00;
      }
      #gjBattleFinishFallback .gjbf-grid{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:10px;
        margin-top:18px;
      }
      #gjBattleFinishFallback .gjbf-grid div{
        border:3px solid #ffcf93;
        border-radius:20px;
        background:#fffaf0;
        padding:12px;
      }
      #gjBattleFinishFallback .gjbf-grid b{
        display:block;
        font-size:30px;
      }
      #gjBattleFinishFallback .gjbf-grid span{
        display:block;
        margin-top:4px;
        font-size:13px;
        font-weight:900;
      }
      #gjBattleFinishFallback .gjbf-actions{
        display:flex;
        gap:10px;
        margin-top:18px;
        flex-wrap:wrap;
      }
      #gjBattleFinishFallback button{
        flex:1 1 180px;
        min-height:52px;
        border-radius:18px;
        border:3px solid #ffbd77;
        background:#fff;
        color:#87311b;
        font-size:16px;
        font-weight:1000;
      }
    `;

    document.head.appendChild(css);
    document.body.appendChild(box);

    box.querySelector('[data-again]').addEventListener('click', () => {
      location.reload();
    });

    box.querySelector('[data-lobby]').addEventListener('click', () => {
      const u = new URL('./goodjunk-battle-lobby.html', location.href);
      const keep = ['pid','name','diff','time','view','hub','zone','game','room','roomId'];
      keep.forEach(k => {
        const v = qs.get(k);
        if (v) u.searchParams.set(k,v);
      });
      location.href = u.toString();
    });
  }

  function getBodyText(){
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
