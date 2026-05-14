/* =========================================================
   HeroHealth • GoodJunk Battle Summary Fix v3 Real Results
   FILE: /herohealth/vr-goodjunk/goodjunk-vr-battle.summary-fix-v3-real-results.js
   PATCH: v20260514n

   Fix:
   - Summary ดึงชื่อคู่แข่งผิดเป็น SFX
   - คะแนนคู่แข่งถูก copy เป็นคะแนนเรา
   - อ่านผลจริงจาก Firebase: players / runtimeScores / progress / results
   - ถ้าผลคู่แข่งยังไม่มา จะขึ้น "รอผลคู่แข่ง" ไม่เอาคะแนนเราไปแทน
   ========================================================= */

(() => {
  'use strict';

  const PATCH_ID = 'v20260514n-summary-fix-v3-real-results';
  if (window.__GJ_BATTLE_SUMMARY_FIX_V3__) return;
  window.__GJ_BATTLE_SUMMARY_FIX_V3__ = PATCH_ID;

  const qs = new URLSearchParams(location.search);

  const ROOM = cleanRoom(qs.get('roomId') || qs.get('room') || '');
  const PID = clean(qs.get('pid') || '');
  const NAME = clean(qs.get('name') || qs.get('nick') || 'Player');
  const URL_MATCH = clean(qs.get('matchId') || '');

  const LOG = '[GJ Battle Summary Fix v3]';

  let db = null;
  let auth = null;
  let fixed = false;
  let pollTimer = null;

  boot();

  async function boot(){
    console.info(LOG, 'loaded', {
      patch: PATCH_ID,
      room: ROOM,
      pid: PID,
      name: NAME,
      matchId: URL_MATCH
    });

    waitForDb().catch(err => console.warn(LOG, 'Firebase optional wait failed', err));

    pollTimer = setInterval(checkSummary, 450);

    window.addEventListener('pagehide', () => {
      if (pollTimer) clearInterval(pollTimer);
    });

    setTimeout(checkSummary, 600);
    setTimeout(checkSummary, 1200);
    setTimeout(checkSummary, 2200);
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

  async function checkSummary(){
    if (fixed) return;

    const text = bodyText();

    const hasWrongSummary =
      /เสมอ Battle/i.test(text) ||
      /ชนะ Battle/i.test(text) ||
      /แพ้ Battle/i.test(text) ||
      /จบ Battle/i.test(text) ||
      /คู่แข่ง:\s*🔈\s*SFX/i.test(text) ||
      /Battle อีกครั้ง/i.test(text);

    if (!hasWrongSummary) return;

    const result = await buildRealSummary();

    showFixedSummary(result);
    fixed = true;

    if (pollTimer) clearInterval(pollTimer);
  }

  async function buildRealSummary(){
    const local = collectLocalResult();

    let room = null;
    let match = null;

    if (db && ROOM){
      room = await db.ref(roomPath(ROOM)).get().then(s => s.val()).catch(() => null);

      const matchId =
        URL_MATCH ||
        clean(room?.activeMatchId || '') ||
        clean(room?.currentRun?.matchId || '') ||
        `${ROOM}-R1`;

      match = await db.ref(matchPath(ROOM, matchId)).get().then(s => s.val()).catch(() => null);
    }

    const players = normalizePlayers(room);
    const myKey = findMyKey(players);
    const rivalKey = findRivalKey(players, myKey);

    const myPlayer = players[myKey] || {};
    const rivalPlayer = players[rivalKey] || {};

    const remoteScores = {
      ...(room?.runtimeScores || {}),
      ...(room?.progress || {}),
      ...(room?.results || {}),
      ...(room?.currentRun?.runtimeScores || {}),
      ...(room?.currentRun?.progress || {}),
      ...(room?.currentRun?.results || {}),
      ...(match?.runtimeScores || {}),
      ...(match?.progress || {}),
      ...(match?.results || {}),
      ...(match?.playerResults || {})
    };

    const myRemote = remoteScores[myKey] || remoteScores[safeKey(PID)] || null;
    const rivalRemote = rivalKey ? remoteScores[rivalKey] : findRivalScoreObject(remoteScores, myKey);

    const myName = clean(myRemote?.name || myPlayer.name || myPlayer.nick || NAME || 'Player');
    const rivalName = clean(rivalRemote?.name || rivalPlayer.name || rivalPlayer.nick || 'รอผลคู่แข่ง');

    const myScore = numberOr(
      myRemote?.score,
      local.score,
      0
    );

    const myCombo = numberOr(
      myRemote?.combo,
      myRemote?.bestStreak,
      local.combo,
      0
    );

    const myHeart = numberOr(
      myRemote?.heart,
      local.heart,
      0
    );

    const myAttack = numberOr(
      myRemote?.attack,
      local.attack,
      0
    );

    const rivalHasScore = !!rivalRemote && Number.isFinite(Number(rivalRemote.score));
    const rivalScore = rivalHasScore ? Number(rivalRemote.score) : 0;
    const rivalCombo = numberOr(rivalRemote?.combo, rivalRemote?.bestStreak, 0);
    const rivalHeart = numberOr(rivalRemote?.heart, 0);
    const rivalAttack = numberOr(rivalRemote?.attack, 0);

    let outcome = 'รอผลคู่แข่ง';
    let title = 'จบ Battle!';

    if (rivalHasScore){
      if (myScore > rivalScore){
        outcome = 'win';
        title = 'ชนะ Battle!';
      }else if (myScore < rivalScore){
        outcome = 'lose';
        title = 'แพ้ Battle!';
      }else{
        outcome = 'draw';
        title = 'เสมอ Battle!';
      }
    }

    return {
      title,
      outcome,
      roomId: ROOM,
      matchId: URL_MATCH || clean(room?.activeMatchId || room?.currentRun?.matchId || ''),
      myName,
      myScore,
      myCombo,
      myHeart,
      myAttack,
      rivalName,
      rivalScore,
      rivalCombo,
      rivalHeart,
      rivalAttack,
      rivalHasScore,
      patch: PATCH_ID
    };
  }

  function normalizePlayers(room){
    const raw = room?.players || {};
    const out = {};

    Object.entries(raw).forEach(([k, v]) => {
      if (!v) return;
      out[k] = {
        ...v,
        pid: clean(v.pid || v.id || k),
        name: clean(v.name || v.nick || v.displayName || v.pid || k),
        role: clean(v.role || '')
      };
    });

    return out;
  }

  function findMyKey(players){
    const pidKey = safeKey(PID);

    if (players[pidKey]) return pidKey;

    const found = Object.entries(players).find(([_, p]) => {
      return clean(p.pid) === PID || clean(p.id) === PID;
    });

    return found ? found[0] : pidKey;
  }

  function findRivalKey(players, myKey){
    const entries = Object.entries(players);

    const rival = entries.find(([k, p]) => {
      if (k === myKey) return false;
      if (clean(p.pid) === PID) return false;
      if (clean(p.name).toLowerCase() === clean(NAME).toLowerCase()) return false;
      return true;
    });

    return rival ? rival[0] : '';
  }

  function findRivalScoreObject(scores, myKey){
    const entries = Object.entries(scores || {});

    const found = entries.find(([k, v]) => {
      if (!v) return false;
      if (k === myKey) return false;
      if (clean(v.pid) === PID) return false;
      if (clean(v.name).toLowerCase() === clean(NAME).toLowerCase()) return false;
      if (!Number.isFinite(Number(v.score))) return false;
      return true;
    });

    return found ? found[1] : null;
  }

  function collectLocalResult(){
    const state = window.HHA_GJ_BATTLE_LOCAL_STATE || null;

    if (state && typeof state === 'object'){
      return {
        score: numberOr(state.score, 0),
        combo: numberOr(state.combo, state.bestStreak, 0),
        heart: numberOr(state.heart, 0),
        attack: numberOr(state.attack, 0)
      };
    }

    const text = bodyText();

    return {
      score: readBlockNumber(text, 'SCORE') || 0,
      combo: readBlockNumber(text, 'COMBO') || 0,
      heart: countHearts(text),
      attack: readFractionFirst(text, 'ATTACK') || 0
    };
  }

  function showFixedSummary(result){
    let old = document.getElementById('gjBattleSummaryFixV3');
    if (old) old.remove();

    const medal =
      result.outcome === 'win' ? '🏅' :
      result.outcome === 'lose' ? '🥈' :
      result.outcome === 'draw' ? '🏁' :
      '⏳';

    const rivalScoreText = result.rivalHasScore ? String(result.rivalScore) : '—';
    const rivalNote = result.rivalHasScore
      ? 'ผลจาก Firebase / เครื่องคู่แข่ง'
      : 'ยังไม่พบผลจากเครื่องคู่แข่ง';

    const box = document.createElement('div');
    box.id = 'gjBattleSummaryFixV3';
    box.innerHTML = `
      <div class="gjbs3-card">
        <div class="gjbs3-medal">${medal}</div>
        <h1>${escapeHtml(result.title)}</h1>

        <div class="gjbs3-note">
          รอบที่ 1 • สรุปผลจากข้อมูลจริงของผู้เล่น ไม่อ่านจากปุ่ม SFX
        </div>

        <div class="gjbs3-board">
          <div class="gjbs3-player mine">
            <div class="gjbs3-label">คุณ: ${escapeHtml(result.myName)}</div>
            <div class="gjbs3-score">${Number(result.myScore || 0)}</div>
            <div class="gjbs3-meta">
              หัวใจ: ${heartText(result.myHeart)}<br>
              Combo: ${Number(result.myCombo || 0)}<br>
              Attack: ${Number(result.myAttack || 0)}
            </div>
          </div>

          <div class="gjbs3-player rival">
            <div class="gjbs3-label">คู่แข่ง: ${escapeHtml(result.rivalName)}</div>
            <div class="gjbs3-score">${escapeHtml(rivalScoreText)}</div>
            <div class="gjbs3-meta">
              ${escapeHtml(rivalNote)}<br>
              Combo: ${Number(result.rivalCombo || 0)}<br>
              Attack: ${Number(result.rivalAttack || 0)}
            </div>
          </div>
        </div>

        <div class="gjbs3-stats">
          <div><b>${Number(result.myScore || 0)}</b><span>My Score</span></div>
          <div><b>${escapeHtml(rivalScoreText)}</b><span>Rival Score</span></div>
          <div><b>${escapeHtml(result.outcome)}</b><span>Result</span></div>
        </div>

        <div class="gjbs3-actions">
          <button type="button" data-again>🔁 Battle อีกครั้ง</button>
          <button type="button" data-lobby>⚔️ กลับ Lobby</button>
          <button type="button" data-hub>🏠 Hub</button>
        </div>
      </div>
    `;

    const css = document.createElement('style');
    css.textContent = `
      #gjBattleSummaryFixV3{
        position:fixed;
        inset:0;
        z-index:2147484100;
        display:grid;
        place-items:center;
        padding:18px;
        background:rgba(132,82,48,.55);
        backdrop-filter:blur(14px);
        font-family:system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;
      }

      #gjBattleSummaryFixV3 .gjbs3-card{
        width:min(780px,94vw);
        max-height:92dvh;
        overflow:auto;
        border:4px solid #ffbd77;
        border-radius:34px;
        background:#fffdf4;
        box-shadow:0 22px 60px rgba(91,45,17,.28);
        padding:26px 20px;
        color:#87311b;
        text-align:center;
      }

      #gjBattleSummaryFixV3 .gjbs3-medal{
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

      #gjBattleSummaryFixV3 h1{
        margin:0;
        font-size:clamp(34px,7vw,54px);
        line-height:1.1;
        font-weight:1000;
      }

      #gjBattleSummaryFixV3 .gjbs3-note{
        margin:14px 0;
        padding:12px;
        border:3px dashed #ffbd77;
        border-radius:20px;
        font-weight:1000;
        color:#8a5a00;
      }

      #gjBattleSummaryFixV3 .gjbs3-board{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:12px;
        margin-top:12px;
      }

      #gjBattleSummaryFixV3 .gjbs3-player{
        border:3px solid #ffbd77;
        border-radius:22px;
        background:#fff8e9;
        padding:14px;
        text-align:left;
      }

      #gjBattleSummaryFixV3 .gjbs3-player.mine{
        background:#fffbe2;
      }

      #gjBattleSummaryFixV3 .gjbs3-label{
        font-weight:1000;
        font-size:16px;
      }

      #gjBattleSummaryFixV3 .gjbs3-score{
        margin-top:8px;
        font-size:40px;
        font-weight:1000;
      }

      #gjBattleSummaryFixV3 .gjbs3-meta{
        margin-top:6px;
        font-size:14px;
        line-height:1.5;
        font-weight:900;
      }

      #gjBattleSummaryFixV3 .gjbs3-stats{
        display:grid;
        grid-template-columns:repeat(3,1fr);
        gap:10px;
        margin-top:14px;
      }

      #gjBattleSummaryFixV3 .gjbs3-stats div{
        border:3px solid #ffcf93;
        border-radius:18px;
        padding:12px;
        background:#fffaf0;
      }

      #gjBattleSummaryFixV3 .gjbs3-stats b{
        display:block;
        font-size:26px;
      }

      #gjBattleSummaryFixV3 .gjbs3-stats span{
        display:block;
        font-size:13px;
        font-weight:900;
      }

      #gjBattleSummaryFixV3 .gjbs3-actions{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        margin-top:16px;
      }

      #gjBattleSummaryFixV3 button{
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
        #gjBattleSummaryFixV3 .gjbs3-board,
        #gjBattleSummaryFixV3 .gjbs3-stats{
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
      location.href = qs.get('hub') || '../nutrition-zone.html';
    });
  }

  function copyParams(u, keys){
    keys.forEach(k => {
      const v = qs.get(k);
      if (v) u.searchParams.set(k, v);
    });
  }

  function readBlockNumber(text, label){
    const lines = String(text || '').split(/\n|\r/).map(s => s.trim()).filter(Boolean);
    const idx = lines.findIndex(x => x.toUpperCase() === label.toUpperCase());

    if (idx >= 0){
      for (let i = idx + 1; i < Math.min(idx + 4, lines.length); i++){
        const n = firstNumber(lines[i]);
        if (Number.isFinite(n)) return n;
      }
    }

    return 0;
  }

  function readFractionFirst(text, label){
    const re = new RegExp(label + '[\\s\\S]{0,60}?(\\d+)\\s*\\/\\s*(\\d+)', 'i');
    const m = String(text || '').match(re);
    return m ? Number(m[1]) : 0;
  }

  function countHearts(text){
    const m = String(text || '').match(/❤️+/);
    if (!m) return 0;
    return Array.from(m[0]).length;
  }

  function heartText(n){
    const count = Math.max(0, Math.min(5, Number(n || 0)));
    return count ? '❤️'.repeat(count) : '—';
  }

  function firstNumber(s){
    const m = String(s || '').match(/-?\d+/);
    return m ? Number(m[0]) : NaN;
  }

  function numberOr(...vals){
    for (const v of vals){
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
    return 0;
  }

  function roomPath(roomId){
    return `hha-battle/goodjunk/battleRooms/${safeKey(roomId)}`;
  }

  function matchPath(roomId, matchId){
    return `${roomPath(roomId)}/matches/${safeKey(matchId)}`;
  }

  function bodyText(){
    return document.body ? String(document.body.innerText || document.body.textContent || '') : '';
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
