// === /herohealth/vr-goodjunk/goodjunk-race.js ===
// GoodJunkVR RACE Controller — teacher countdown + shareable startAt + race result submit + restart/reset aware
// FULL PATCH v20260327-RACE-CONTROLLER-MODEFIX-CORECHECK
'use strict';

(function(){
  const WIN = window;
  const DOC = document;

  const qs = (k, d='') => {
    try { return (new URL(location.href)).searchParams.get(k) ?? d; }
    catch(e){ return d; }
  };

  const clamp = (v,a,b) => {
    v = Number(v);
    if(!Number.isFinite(v)) v = a;
    return Math.max(a, Math.min(b, v));
  };

  const clean = (v) => String(v || '').trim();

  function inferRaceMode() {
    const rawMode = clean(qs('mode', ''));
    if (rawMode) return rawMode.toLowerCase();

    const path = String(location.pathname || '').toLowerCase();
    if (path.includes('goodjunk-race')) return 'race';

    return 'race';
  }

  const mode = inferRaceMode();
  if (mode !== 'race') return;

  const room = clean(qs('room', qs('roomId', 'NO_ROOM'))) || 'NO_ROOM';
  const pid  = clean(qs('pid', 'anon')) || 'anon';
  const nick = clean(qs('nick', qs('name', pid))) || pid;
  const host = (String(qs('host','0')) === '1');

  const startIn = clamp(qs('startIn', host ? '8' : '0'), 0, 60);
  let startAt = Number(qs('startAt','')) || 0;

  const RACE_ROOT = `herohealth/goodjunk/race/${room}`;
  const RESULT_PATH = `${RACE_ROOT}/results`;
  const PRESENCE_PATH = `${RACE_ROOT}/presence`;
  const CONTROL_PATH = `${RACE_ROOT}/control`;

  let db = null;
  let submitted = false;
  let started = false;
  let presenceTimer = null;
  let lastResetAt = 0;
  let lastRestartAt = 0;
  let overlayRemoved = false;

  function markShellReady(note) {
    WIN.__GJ_RACE_ENGINE_READY__ = true;
    try {
      if (typeof WIN.GJRaceShellReady === 'function') {
        WIN.GJRaceShellReady({ note: note || 'race-controller-ready' });
      }
    } catch(_) {}
    try {
      WIN.GJRaceSafe?.markEngineReady?.({ note: note || 'race-controller-ready' });
    } catch(_) {}
  }

  function dispatchSummary(detail) {
    try { WIN.dispatchEvent(new CustomEvent('gj:race-summary', { detail })); } catch(_) {}
    try { WIN.dispatchEvent(new CustomEvent('gj:summary', { detail })); } catch(_) {}
    try { WIN.dispatchEvent(new CustomEvent('hha:summary', { detail })); } catch(_) {}
    try { WIN.postMessage({ type: 'gj:race-summary', detail }, '*'); } catch(_) {}
    try { WIN.GJRaceSafe?.emitSummary?.(detail); } catch(_) {}
  }

  function getDb(){
    db = WIN.HHA_FIREBASE_DB || null;
    return db;
  }

  function dbRef(path){
    const _db = getDb();
    if(!_db) return null;
    return _db.ref(path);
  }

  function hasCoreApi() {
    return (
      typeof WIN.__GJ_SET_PAUSED__ === 'function' ||
      typeof WIN.__GJ_START_NOW__ === 'function' ||
      typeof WIN.__GJ_GET_SCORE__ === 'function'
    );
  }

  function setPaused(v){
    try{
      if(typeof WIN.__GJ_SET_PAUSED__ === 'function') {
        WIN.__GJ_SET_PAUSED__(!!v);
      }
    }catch(_){}
  }

  function removeOverlay() {
    if (overlayRemoved) return;
    overlayRemoved = true;
    try { overlay.remove(); } catch(_) {}
  }

  function startGameNow(){
    const hasStartNow = typeof WIN.__GJ_START_NOW__ === 'function';

    try {
      WIN.__GJ_START_NOW__?.();
    } catch(err) {
      console.error('[GJ-RACE] __GJ_START_NOW__ failed', err);
    }

    setPaused(false);

    if (hasStartNow) {
      markShellReady('start-now');
      removeOverlay();
      return;
    }

    setStatus('ยังไม่พบ game core', null);
    if (subEl) subEl.textContent = 'ตรวจไฟล์ core';
    const debug = [
      'ยังไม่พบ __GJ_START_NOW__',
      'ไฟล์นี้เป็น race controller เท่านั้น',
      'ต้องมี core game โหลดมาก่อน เช่นไฟล์เกมหลักของ GoodJunk',
      '',
      'required:',
      '- __GJ_SET_PAUSED__',
      '- __GJ_START_NOW__',
      '- __GJ_GET_SCORE__ / stats getters'
    ].join('\n');

    if (debugEl) debugEl.textContent = debug;
    console.warn('[GJ-RACE] core api missing; controller loaded but game core not found');
  }

  function buildLink(startAtMs){
    const u = new URL(location.href);
    u.searchParams.set('mode','race');
    u.searchParams.set('wait','1');
    u.searchParams.set('startAt', String(Math.round(startAtMs)));
    u.searchParams.delete('host');
    u.searchParams.delete('startIn');
    return u.toString();
  }

  function refreshLink(){
    if(startAt > 0) linkEl.value = buildLink(startAt);
    else linkEl.value = '(ยังไม่มี startAt) กด “สร้าง startAt ใหม่”';
  }

  function setStatus(s, n){
    if(statusEl) statusEl.textContent = s;
    if(countEl) countEl.textContent = (n==null) ? '—' : String(n);
  }

  async function copyText(txt){
    try{
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(txt);
      } else {
        linkEl.focus();
        linkEl.select();
        document.execCommand('copy');
      }
      setStatus('คัดลอกแล้ว ✅', null);
    }catch(e){
      console.warn('[GJ-RACE] copy failed', e);
    }
  }

  function readGameMetrics(){
    const score = Number(WIN.__GJ_GET_SCORE__?.() ?? 0);
    const shots = Number(WIN.__GJ_GET_SHOTS__?.() ?? 0);
    const hits = Number(WIN.__GJ_GET_HITS__?.() ?? 0);
    const missTotal = Number(WIN.__GJ_GET_MISS__?.() ?? 0);
    const finishMs = Number(WIN.__GJ_GET_FINISH_MS__?.() ?? 0);
    const accPct = shots > 0 ? Math.round((hits / shots) * 100) : 0;
    return { score, shots, hits, missTotal, accPct, finishMs };
  }

  function publishPresence(state='waiting'){
    const r = dbRef(`${PRESENCE_PATH}/${pid}`);
    if(!r) return;
    const row = { pid, nick, room, state, at: Date.now() };
    r.set(row);
    try { r.onDisconnect().remove(); } catch(_){}
  }

  function submitRaceResult(reason='finish'){
    if(submitted) return;
    submitted = true;

    const m = readGameMetrics();
    const payload = {
      pid,
      nick,
      room,
      mode: 'race',
      reason,
      score: Number(m.score || 0),
      shots: Number(m.shots || 0),
      hits: Number(m.hits || 0),
      missTotal: Number(m.missTotal || 0),
      accPct: Number(m.accPct || 0),
      finishMs: Number(m.finishMs || 0),
      at: Date.now(),
      final: true
    };

    const r = dbRef(`${RESULT_PATH}/${pid}`);
    if(r) r.set(payload);

    dispatchSummary(payload);
    publishPresence('finished');
  }

  function writeStartAtToFirebase(ms){
    const r = dbRef(CONTROL_PATH);
    if(!r) return;
    r.update({
      room,
      hostPid: pid,
      hostNick: nick,
      startAt: Number(ms || 0),
      updatedAt: Date.now()
    });
  }

  function hardReloadForNewRound(){
    const u = new URL(location.href);
    u.searchParams.delete('startAt');
    u.searchParams.set('mode', 'race');
    location.href = u.toString();
  }

  function watchControlFromFirebase(){
    const r = dbRef(CONTROL_PATH);
    if(!r) return;

    r.on('value', (snap)=>{
      const j = snap.val() || {};

      const nextStartAt = Number(j.startAt || 0);
      const resetAt = Number(j.resetAt || 0);
      const restartAt = Number(j.restartAt || 0);

      if(resetAt > 0 && resetAt !== lastResetAt){
        lastResetAt = resetAt;
        submitted = false;
        started = false;
        setPaused(true);
        hardReloadForNewRound();
        return;
      }

      if(restartAt > 0 && restartAt !== lastRestartAt){
        lastRestartAt = restartAt;
        submitted = false;
        started = false;
        setPaused(true);
        hardReloadForNewRound();
        return;
      }

      if(nextStartAt > 0) {
        startAt = nextStartAt;
        refreshLink();
      }
    });
  }

  setPaused(true);

  const overlay = DOC.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.zIndex = '300';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.padding = '14px';
  overlay.style.background = 'rgba(2,6,23,.72)';
  overlay.style.backdropFilter = 'blur(8px)';
  overlay.style.webkitBackdropFilter = 'blur(8px)';

  overlay.innerHTML = `
    <div style="
      width:min(760px, 100%);
      border:1px solid rgba(148,163,184,.18);
      background:rgba(2,6,23,.78);
      border-radius:22px;
      padding:14px 14px;
      box-shadow:0 26px 90px rgba(0,0,0,.55);
      color:rgba(229,231,235,.96);
      font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;
    ">
      <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
        <div style="font:1000 18px/1.2 system-ui;">🏁 RACE — เริ่มพร้อมกัน</div>
        <div style="opacity:.8; font-weight:900;">mode=race</div>
      </div>

      <div style="height:10px"></div>

      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <div style="flex:1; min-width:220px; border:1px solid rgba(148,163,184,.14); background:rgba(148,163,184,.06); border-radius:18px; padding:10px 12px;">
          <div style="opacity:.85; font-weight:900;">สถานะ</div>
          <div style="height:6px"></div>
          <div id="raceStatus" style="font:1000 16px/1.2 system-ui;">รอ start…</div>
          <div style="height:10px"></div>
          <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
            <div style="font:1000 56px/1 system-ui;" id="raceCount">—</div>
            <div style="opacity:.85; font-weight:900;" id="raceSub">วินาที</div>
          </div>
        </div>

        <div style="flex:1; min-width:220px; border:1px solid rgba(148,163,184,.14); background:rgba(148,163,184,.06); border-radius:18px; padding:10px 12px;">
          <div style="opacity:.85; font-weight:900;">ลิงก์เริ่มพร้อมกัน</div>
          <div style="height:6px"></div>
          <div style="opacity:.85; font-weight:900; font-size:12px; line-height:1.35;">
            วิธีใช้: ให้ทุกคนเปิด “ลิงก์เดียวกัน” ที่มี startAt เหมือนกัน แล้วระบบจะนับถอยหลังและเริ่มเอง
          </div>
          <div style="height:10px"></div>
          <input id="raceLink" readonly value="" style="
            width:100%;
            border:1px solid rgba(148,163,184,.18);
            background:rgba(2,6,23,.55);
            color:rgba(229,231,235,.96);
            border-radius:14px;
            padding:10px 12px;
            font-weight:900;
          "/>
          <div style="height:10px"></div>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button id="btnMake" style="
              border-radius:16px; border:1px solid rgba(34,197,94,.28);
              background:rgba(34,197,94,.14); color:rgba(229,231,235,.96);
              padding:10px 12px; font-weight:1000; cursor:pointer; min-height:42px;
            ">สร้าง startAt ใหม่</button>

            <button id="btnCopy" style="
              border-radius:16px; border:1px solid rgba(148,163,184,.22);
              background:rgba(148,163,184,.10); color:rgba(229,231,235,.96);
              padding:10px 12px; font-weight:1000; cursor:pointer; min-height:42px;
            ">คัดลอกลิงก์</button>

            <button id="btnStartNow" style="
              border-radius:16px; border:1px solid rgba(239,68,68,.28);
              background:rgba(239,68,68,.14); color:rgba(229,231,235,.96);
              padding:10px 12px; font-weight:1000; cursor:pointer; min-height:42px;
            ">เริ่มเดี๋ยวนี้</button>
          </div>
        </div>
      </div>

      <div style="height:10px"></div>
      <div style="opacity:.75; font-weight:900; font-size:12px;">
        Tip: เปิดเป็นครูใช้ <b>?mode=race&host=1</b> เพื่อกดสร้างลิงก์ แล้วส่งให้เด็กทุกคนเปิดลิงก์เดียวกัน
      </div>

      <div id="raceDebug" style="
        margin-top:12px;
        padding-top:10px;
        border-top:1px dashed rgba(148,163,184,.18);
        opacity:.9;
        white-space:pre-wrap;
        word-break:break-word;
        font-size:12px;
        line-height:1.5;
      "></div>
    </div>
  `;
  DOC.body.appendChild(overlay);

  const $ = (id) => overlay.querySelector('#'+id);
  const statusEl = $('raceStatus');
  const countEl  = $('raceCount');
  const subEl    = $('raceSub');
  const linkEl   = $('raceLink');
  const btnMake  = $('btnMake');
  const btnCopy  = $('btnCopy');
  const btnStartNow = $('btnStartNow');
  const debugEl = $('raceDebug');

  if (debugEl) {
    debugEl.textContent =
      [
        `[PATCH] v20260327-RACE-CONTROLLER-MODEFIX-CORECHECK`,
        `[MODE] ${mode}`,
        `[ROOM] ${room}`,
        `[PID] ${pid}`,
        `[NICK] ${nick}`,
        `[HOST] ${host ? '1' : '0'}`,
        `[HAS_DB] ${getDb() ? 'yes' : 'no'}`,
        `[HAS_CORE_API] ${hasCoreApi() ? 'yes' : 'no'}`
      ].join('\n');
  }

  btnStartNow.addEventListener('click', ()=>{
    startAt = 0;
    writeStartAtToFirebase(0);
    started = true;
    publishPresence('playing');
    startGameNow();
  });

  btnCopy.addEventListener('click', ()=>{
    if(startAt <= 0) return;
    copyText(buildLink(startAt));
  });

  btnMake.addEventListener('click', ()=>{
    const lead = clamp(qs('lead', String(startIn || 8)), 3, 20);
    startAt = Date.now() + lead * 1000;
    refreshLink();
    writeStartAtToFirebase(startAt);
    if(host){
      copyText(buildLink(startAt));
    }
  });

  if(host && startAt <= 0){
    const lead = clamp(String(startIn || 8), 3, 20);
    startAt = Date.now() + lead * 1000;
  }

  refreshLink();

  if(getDb()){
    publishPresence('waiting');
    watchControlFromFirebase();

    clearInterval(presenceTimer);
    presenceTimer = setInterval(()=>{
      publishPresence(started ? 'playing' : 'waiting');
    }, 1500);
  }

  function tick(){
    if(started) return;

    if(startAt <= 0){
      setStatus(host ? 'ครู: พร้อมสร้าง startAt' : 'รอลิงก์ที่มี startAt', null);
      requestAnimationFrame(tick);
      return;
    }

    const msLeft = startAt - Date.now();
    const sLeft = Math.ceil(msLeft / 1000);

    if(msLeft > 0){
      setStatus('นับถอยหลัง…', sLeft);
      if(subEl) subEl.textContent = 'วินาที';
      requestAnimationFrame(tick);
      return;
    }

    started = true;
    setStatus('GO! 🚀', 0);
    if(subEl) subEl.textContent = '';
    publishPresence('playing');
    setTimeout(startGameNow, 60);
  }

  requestAnimationFrame(tick);
  markShellReady('overlay-mounted');

  WIN.addEventListener('hha:end', ()=>{
    submitRaceResult('finish');
  });

  WIN.addEventListener('pagehide', ()=>{
    if(!submitted){
      try{
        const m = readGameMetrics();
        if(Number(m.score || 0) > 0 || Number(m.shots || 0) > 0){
          submitRaceResult('pagehide');
        }
      }catch(_){}
    }
    try { clearInterval(presenceTimer); } catch(_){}
  });
})();