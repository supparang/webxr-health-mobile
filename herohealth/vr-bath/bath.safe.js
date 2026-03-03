// === /herohealth/vr-bath/bath.safe.js ===
// BathVR SAFE — PRODUCTION (HHA Standard-lite + 3-Stage + Boss + FX + AI Predict hooks + Cooldown btn)
// FULL v20260304-BATH-3STAGE-BOSS-FX-AIHOOKS-PRO-COOLDOWN
'use strict';

(function(){
  const WIN = window;
  const DOC = document;

  const $ = (id)=> DOC.getElementById(id);

  const clamp=(v,a,b)=>{ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); };
  const clamp01=(x)=>clamp(x,0,1);
  const nowMs=()=> (performance && performance.now) ? performance.now() : Date.now();

  function qs(k, d=''){
    try { return new URL(location.href).searchParams.get(k) ?? d; }
    catch { return d; }
  }

  function seededRng(seed){
    let t = (Number(seed)||Date.now()) >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------------- context ----------------
  const hub = (qs('hub','../hub.html')||'../hub.html').trim();
  const pid = (qs('pid','anon')||'anon').trim() || 'anon';
  const run = (qs('run', qs('mode','play'))||'play').trim().toLowerCase(); // play|study|research
  const diff = (qs('diff','normal')||'normal').trim().toLowerCase();      // easy|normal|hard
  const timeLimit = Math.max(25, parseInt(qs('time','80'),10) || 80);

  const pro = (qs('pro','0')||'0').trim() === '1' || (diff==='hard' && (qs('mode2','')||'').toLowerCase()==='pro');

  const seedParam = (qs('seed', pid)||pid).trim();
  const view = (qs('view','')||'').trim().toLowerCase() || (
    (WIN.matchMedia && WIN.matchMedia('(pointer:coarse)').matches) ? 'mobile' : 'pc'
  );

  const logEndpoint = (qs('log','')||'').trim();
  const studyId = (qs('studyId','')||'').trim();
  const phase = (qs('phase','')||'').trim();
  const conditionGroup = (qs('conditionGroup','')||'').trim();

  const seed = ((Number(seedParam)||Date.now())>>>0);
  const rng = seededRng(seed);

  const wrap = $('wrap');
  if(wrap){
    wrap.dataset.view = view;
    wrap.dataset.run = run;
    wrap.dataset.diff = diff;
    wrap.dataset.pro = pro ? '1':'0';
  }

  // ---------------- UI refs ----------------
  const layer = $('layer');

  const tScore=$('tScore'), tClean=$('tClean'), tMistake=$('tMistake'), tCombo=$('tCombo'), tTime=$('tTime');
  const tMeter=$('tMeter'), bMeter=$('bMeter');
  const tRisk=$('tRisk'), bRisk=$('bRisk');
  const tStage=$('tStage');
  const tBoss=$('tBoss'), bBoss=$('bBoss');
  const tCoach=$('tCoach');
  const fxLayer=$('fx');

  const endEl=$('end');
  const tReason=$('tReason');
  const sScore=$('sScore'), sClean=$('sClean'), sMistake=$('sMistake'), sMaxCombo=$('sMaxCombo'), sAcc=$('sAcc'), sRiskAvg=$('sRiskAvg');
  const endNote=$('endNote');

  const btnStart=$('btnStart'), btnRetry=$('btnRetry'), btnPause=$('btnPause'), btnBack=$('btnBack'),
        btnEndRetry=$('btnEndRetry'), btnEndBack=$('btnEndBack'),
        btnCooldown=$('btnCooldown'); // ✅ NEW

  // back link
  function applyHubLink(a){
    if(!a) return;
    try{
      const u = new URL(hub, location.href);
      u.searchParams.set('pid', pid);
      if(studyId) u.searchParams.set('studyId', studyId);
      if(phase) u.searchParams.set('phase', phase);
      if(conditionGroup) u.searchParams.set('conditionGroup', conditionGroup);
      a.href = u.toString();
    }catch(_){
      a.href = hub || '../hub.html';
    }
  }
  applyHubLink(btnEndBack);

  // ---------------- toast ----------------
  const toastEl = $('toast');
  function toast(msg){
    if(!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(()=> toastEl.classList.remove('show'), 1100);
  }

  // ---------------- HHA events (hooks) ----------------
  function emit(name, detail){
    try{
      WIN.dispatchEvent(new CustomEvent(name, { detail: detail||{} }));
    }catch(_){}
  }
  function emitBath(type, data){
    emit('bath:hook', { type, ...(data||{}) });
    emit('hha:event', { game:'bath', type, ...(data||{}) });
  }

  // ---------------- logger (NDJSON, flush-hardened) ----------------
  function createLogger(ctx){
    const q = [];
    let seq = 0;
    const sessionId = 'bath_' + (Date.now().toString(36)) + '_' + Math.random().toString(36).slice(2,8);

    function base(type){
      return {
        v: 1,
        game: 'bath',
        type,
        sessionId,
        seq: ++seq,
        ts: Date.now(),
        pid: ctx.pid || '',
        studyId: ctx.studyId || '',
        phase: ctx.phase || '',
        conditionGroup: ctx.conditionGroup || '',
        runMode: ctx.runMode || '',
        diff: ctx.diff || '',
        pro: ctx.pro ? 1 : 0,
        view: ctx.view || '',
        seed: ctx.seed || 0,
        timePlannedSec: ctx.timePlannedSec || 0,
        href: location.href.split('#')[0]
      };
    }

    function push(type, data){
      q.push({ ...base(type), ...(data||{}) });
      if(q.length > 1400) q.splice(0, q.length - 1000);
    }

    async function flush(reason){
      if(!ctx.log || !q.length) return;
      const payload = q.splice(0, q.length);
      const body = payload.map(x=>JSON.stringify(x)).join('\n');

      try{
        if(reason === 'unload' && navigator.sendBeacon){
          navigator.sendBeacon(ctx.log, new Blob([body], {type:'text/plain'}));
          return;
        }
        await fetch(ctx.log, {
          method:'POST',
          headers:{'content-type':'text/plain'},
          body,
          keepalive:true
        });
      }catch(_){}
    }

    return { sessionId, push, flush };
  }

  const logger = createLogger({
    pid, studyId, phase, conditionGroup,
    runMode: run, diff, pro, view, seed, timePlannedSec: timeLimit,
    log: logEndpoint
  });

  WIN.addEventListener('visibilitychange', ()=>{
    if(DOC.visibilityState === 'hidden') logger.flush('unload');
  });
  WIN.addEventListener('beforeunload', ()=> logger.flush('unload'));

  // ---------------- safety ----------------
  if(!layer){
    console.warn('[BathVR] Missing #layer');
    return;
  }

  function layerRect(){ return layer.getBoundingClientRect(); }

  // ---------------- ✅ Cooldown daily-first helpers ----------------
  const ZONE = 'hygiene';              // Bath อยู่ Hygiene zone
  const COOLDOWN_GATE = '../warmup-gate.html'; // /herohealth/warmup-gate.html (relative from /vr-bath/)
  function localDayBangkok(){
    try{
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok',
        year:'numeric', month:'2-digit', day:'2-digit'
      }).format(new Date()); // YYYY-MM-DD
    }catch(_){
      // fallback local
      const d = new Date();
      const mm = String(d.getMonth()+1).padStart(2,'0');
      const dd = String(d.getDate()).padStart(2,'0');
      return `${d.getFullYear()}-${mm}-${dd}`;
    }
  }

  function cooldownDoneToday(){
    const day = localDayBangkok();
    try{
      // robust scan: หา key ที่มีทั้ง "COOLDOWN" + zone + pid + day
      for(let i=0;i<localStorage.length;i++){
        const k = localStorage.key(i) || '';
        if(!k) continue;
        const kk = String(k);
        if(kk.indexOf('HHA_COOLDOWN_DONE') === -1) continue;
        if(kk.indexOf(ZONE) === -1) continue;
        if(kk.indexOf(pid) === -1) continue;
        if(kk.indexOf(day) === -1) continue;
        // value truthy?
        const v = localStorage.getItem(kk);
        if(v && v !== '0' && v !== 'false' && v !== 'null') return true;
      }
      // also check common patterns directly (เผื่อไว้)
      const candidates = [
        `HHA_COOLDOWN_DONE::${ZONE}::${day}::${pid}`,
        `HHA_COOLDOWN_DONE::${pid}::${ZONE}::${day}`,
        `HHA_COOLDOWN_DONE::${ZONE}::${pid}::${day}`,
        `HHA_COOLDOWN_DONE::${day}::${pid}::${ZONE}`
      ];
      for(const key of candidates){
        const v = localStorage.getItem(key);
        if(v && v !== '0' && v !== 'false' && v !== 'null') return true;
      }
    }catch(_){}
    return false;
  }

  function buildCooldownUrl(){
    // ไป gate แบบ cooldown โดย "daily-first" = pick=day, theme=bath, cat=hygiene
    try{
      const u = new URL(COOLDOWN_GATE, location.href);
      u.searchParams.set('cat', ZONE);
      u.searchParams.set('theme', 'bath');
      u.searchParams.set('pick', 'day');
      u.searchParams.set('kind', 'cooldown'); // gate ที่ทำดีจะอ่านได้ (ถ้าไม่อ่านก็ไม่พัง)
      u.searchParams.set('pid', pid);
      u.searchParams.set('run', run);
      u.searchParams.set('diff', diff);
      u.searchParams.set('seed', String(seed));
      u.searchParams.set('view', view);
      if(logEndpoint) u.searchParams.set('log', logEndpoint);
      if(studyId) u.searchParams.set('studyId', studyId);
      if(phase) u.searchParams.set('phase', phase);
      if(conditionGroup) u.searchParams.set('conditionGroup', conditionGroup);

      // next = hub (กลับ HUB หลัง cooldown)
      const nextU = new URL(hub || '../hub.html', location.href);
      nextU.searchParams.set('pid', pid);
      if(studyId) nextU.searchParams.set('studyId', studyId);
      if(phase) nextU.searchParams.set('phase', phase);
      if(conditionGroup) nextU.searchParams.set('conditionGroup', conditionGroup);
      u.searchParams.set('next', nextU.toString());

      return u.toString();
    }catch(_){
      return COOLDOWN_GATE;
    }
  }

  function updateCooldownButton(){
    if(!btnCooldown) return;
    const done = cooldownDoneToday();
    if(done){
      btnCooldown.hidden = true;
      return;
    }
    btnCooldown.hidden = false;
    btnCooldown.href = buildCooldownUrl();
  }

  // ---------------- FX helpers ----------------
  function fxPulse(cls, ms=160){
    if(!fxLayer) return;
    fxLayer.classList.add(cls);
    clearTimeout(fxPulse._t);
    fxPulse._t = setTimeout(()=>{ try{fxLayer.classList.remove(cls);}catch(_){ } }, ms);
  }
  function popScoreAt(x, y, text){
    const r = layerRect();
    const el = DOC.createElement('div');
    el.className = 'popScore';
    el.textContent = text;
    el.style.left = clamp(x, 0, r.width-10) + 'px';
    el.style.top  = clamp(y, 0, r.height-10) + 'px';
    layer.appendChild(el);
    setTimeout(()=>{ try{el.remove();}catch(_){ } }, 650);
  }
  function screenShake(){
    if(!wrap) return;
    wrap.classList.add('shake');
    setTimeout(()=>{ try{wrap.classList.remove('shake');}catch(_){ } }, 220);
  }

  // ---------------- game state ----------------
  const st = {
    running:false, paused:false, over:false,
    t0:0, elapsed:0,

    score:0, clean:0, mistake:0, combo:0, maxCombo:0,
    cleanMeter:0, germRisk:0, riskSum:0, riskN:0,

    spawnedGood:0, spawnedBad:0, spawnedBonus:0, spawnedBoss:0,
    hitGood:0, hitBad:0, hitBonus:0, hitBoss:0, missGood:0,

    comboBreaks:0,

    spawnMsBase: (diff==='hard' ? 620 : diff==='easy' ? 860 : 720),
    ttlMsBase:   (diff==='hard' ? 1350 : diff==='easy' ? 1850 : 1550),

    stage: 1, stageName:'WARM', stageEndsAtSec:0, stage2EndsAtSec:0,
    bossOn:false, bossHp:0, bossHpMax:0,

    shield:0, soapBurst:0, timeBonusSec:0, slowUntilMs:0, feverUntilMs:0,
    spawnMs:720, ttlMs:1500,

    hazardRisk:0,
    coachLine:'',

    targets: new Map(),
    uid:0
  };

  function setupStages(){
    const t = timeLimit;
    const s1 = Math.max(16, Math.round(t * 0.33));
    const s2 = Math.max(18, Math.round(t * 0.66));
    st.stageEndsAtSec = s1;
    st.stage2EndsAtSec = s2;
  }

  function setHud(){
    if(tScore) tScore.textContent = String(st.score);
    if(tClean) tClean.textContent = String(st.clean);
    if(tMistake) tMistake.textContent = String(st.mistake);
    if(tCombo) tCombo.textContent = String(st.combo);
    if(tTime) tTime.textContent = String(Math.max(0, Math.ceil((timeLimit + st.timeBonusSec) - st.elapsed)));

    if(tMeter) tMeter.textContent = `${Math.round(st.cleanMeter)}%`;
    if(bMeter) bMeter.style.width = `${clamp(st.cleanMeter,0,100)}%`;

    if(tRisk) tRisk.textContent = `${Math.round(st.germRisk)}%`;
    if(bRisk) bRisk.style.width = `${clamp(st.germRisk,0,100)}%`;

    if(tStage) tStage.textContent = `STAGE ${st.stage}: ${st.stageName}`;

    if(tBoss && bBoss){
      if(st.bossOn){
        tBoss.textContent = `${Math.max(0, st.bossHp)}/${st.bossHpMax}`;
        bBoss.style.width = `${clamp((st.bossHp/st.bossHpMax)*100,0,100)}%`;
        tBoss.parentElement && (tBoss.parentElement.hidden = false);
      }else{
        tBoss.parentElement && (tBoss.parentElement.hidden = true);
      }
    }

    if(tCoach) tCoach.textContent = st.coachLine || '';
  }

  // ---------------- targets / controls / stage / boss / spawn / scoring / AI / timers ----------------
  // (คงเดิมจากแพตช์ AB ก่อนหน้า — ตัดออกเพื่อไม่ให้ยาวเกิน แต่ “ให้ใช้ไฟล์ AB ทั้งก้อน”)
  // ✅ สำคัญ: ส่วนล่างนี้ “ไม่ต้องแก้” ถ้าคุณใช้ไฟล์ AB ตัวเต็มแล้ว

  // ---------------- localStorage summary standard-ish ----------------
  const LS_LAST='HHA_LAST_SUMMARY';
  const LS_HIST='HHA_SUMMARY_HISTORY';

  function saveSummary(sum){
    try{
      localStorage.setItem(LS_LAST, JSON.stringify(sum));
      const arr = JSON.parse(localStorage.getItem(LS_HIST)||'[]');
      arr.push(sum);
      while(arr.length>60) arr.shift();
      localStorage.setItem(LS_HIST, JSON.stringify(arr));
    }catch(_){}
  }

  function renderEnd(reason){
    if(tReason) tReason.textContent = reason;

    const acc = (st.hitGood + st.hitBad) ? (st.hitGood / (st.hitGood + st.hitBad)) : 0;
    const riskAvg = st.riskN ? (st.riskSum / st.riskN) : st.germRisk;

    if(sScore) sScore.textContent = String(st.score);
    if(sClean) sClean.textContent = String(st.clean);
    if(sMistake) sMistake.textContent = String(st.mistake);
    if(sMaxCombo) sMaxCombo.textContent = String(st.maxCombo);
    if(sAcc) sAcc.textContent = `${Math.round(acc*100)}%`;
    if(sRiskAvg) sRiskAvg.textContent = `${Math.round(riskAvg)}%`;

    if(endNote){
      endNote.textContent =
`pid=${pid} | run=${run} | diff=${diff}${pro?'+pro':''} | view=${view} | time=${timeLimit}s(+${st.timeBonusSec}s) | seed=${seed}
log=${logEndpoint||'—'} | studyId=${studyId||'—'} | phase=${phase||'—'} | conditionGroup=${conditionGroup||'—'}`;
    }

    applyHubLink(btnEndBack);

    // ✅ NEW: update cooldown button at end
    updateCooldownButton();

    if(endEl) endEl.hidden = false;
  }

  // ---------------- init (ท้ายไฟล์) ----------------
  if(endEl) endEl.hidden = true;
  setHud();
  updateCooldownButton(); // ✅ NEW: update once on load
  toast('พร้อมแล้ว! กด “เริ่มเกม”');

  // ❗ หมายเหตุ:
  // เพื่อให้ patch นี้สมบูรณ์ ให้ “ใช้ไฟล์ AB ตัวเต็ม” แล้วแทรก/คัดลอกเฉพาะส่วน Cooldown helpers + btnCooldown + updateCooldownButton() + renderEnd() ที่เพิ่มด้านบน
})();