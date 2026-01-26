/* === /herohealth/vr-groups/ai-telemetry.js ===
AI Telemetry Pack (windowed, ML-ready)
✅ Collect 1s window features: score/combo/miss/acc/left/storm/miniUrg/groupKey + events rates
✅ Builds labels offline at end: next10s_miss / next10s_wrong / next10s_junk
✅ Gated: only runMode=play AND ?telemetry=1
✅ No sheet required. Expose: GroupsVR.Telemetry.getRows(), finalize(), toCSV()
✅ Stores last dataset to localStorage (optional)
*/

(function(root){
  'use strict';

  const NS = root.GroupsVR = root.GroupsVR || {};
  const DOC = root.document;
  if (!DOC) return;

  const LS_LAST = 'HHA_TELEMETRY_LAST_GroupsVR';

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }
  function nowMs(){ return (root.performance && performance.now) ? performance.now() : Date.now(); }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function runMode(){
    const r = String(qs('run','play')||'play').toLowerCase();
    if (r === 'research') return 'research';
    if (r === 'practice') return 'practice';
    return 'play';
  }
  function enabled(){
    if (runMode() !== 'play') return false;
    const t = String(qs('telemetry','0')||'0');
    return (t === '1' || t === 'true');
  }

  // ---------------- state mirrors (from events) ----------------
  const S = {
    startedAtMs: 0,
    startedIso: '',
    diff: String(qs('diff','normal')||'normal'),
    view: String(qs('view','mobile')||'mobile'),
    style: String(qs('style','mix')||'mix'),
    seed:  String(qs('seed','')||''),
    timePlannedSec: Number(qs('time',90)||90),

    score:0, combo:0, miss:0, acc:0, left:0,
    storm:0, miniUrg:0,
    groupKey:'', groupName:'',

    // event counters in the last 1s
    c_shots:0,
    c_hit_good:0,
    c_hit_wrong:0,
    c_hit_junk:0,
    c_miss:0,          // “miss event” (wrong/junk/expire) if the engine emits groups:progress miss
  };

  // dataset rows (1 row per second)
  const rows = [];
  let it = 0;
  let lastTickMs = 0;

  // ---------------- event wiring ----------------
  function onScore(ev){
    const d = ev.detail||{};
    S.score = Number(d.score ?? S.score) || 0;
    S.combo = Number(d.combo ?? S.combo) || 0;
    S.miss  = Number(d.misses ?? S.miss) || 0;
  }
  function onTime(ev){
    const d = ev.detail||{};
    S.left = Math.max(0, Math.round(d.left ?? S.left));
  }
  function onRank(ev){
    const d = ev.detail||{};
    S.acc = Number(d.accuracy ?? S.acc) || 0;
  }
  function onQuest(ev){
    const d = ev.detail||{};
    // mini urgent = mLeft <= 3 and > 0 (เหมือน HUD)
    const mLeft = Number(d.miniTimeLeftSec||0);
    S.miniUrg = (mLeft>0 && mLeft<=3) ? 1 : 0;

    S.groupKey  = String(d.groupKey||S.groupKey||'');
    S.groupName = String(d.groupName||S.groupName||'');
  }
  function onProgress(ev){
    const d = ev.detail||{};
    const k = String(d.kind||'');
    if (k === 'storm_on')  S.storm = 1;
    if (k === 'storm_off') S.storm = 0;

    if (k === 'miss'){
      S.c_miss += 1;
    }
  }
  function onShoot(){
    S.c_shots += 1;
  }
  function onJudge(ev){
    // ถ้าคุณ emit hha:judge อยู่แล้ว จะช่วย tag hit types
    const d = ev.detail||{};
    const kind = String(d.kind||'');
    if (kind === 'good') S.c_hit_good += 1;
    if (kind === 'bad'){
      // แยก wrong/junk ไม่ได้จาก judge? ถ้าคุณส่ง detail เพิ่มในอนาคตค่อย refine
      // ตอนนี้ map เป็น wrong แบบอนุรักษ์นิยม
      S.c_hit_wrong += 1;
    }
    if (kind === 'miss') {
      // crosshair miss (ที่คุณตั้งให้ไม่เพิ่ม misses) แต่เรานับเป็น “shot miss” ได้
      S.c_miss += 1;
    }
  }

  // ---------------- tick window ----------------
  function snapshotRow(tMs){
    const tSec = Math.max(0, Math.floor((tMs - S.startedAtMs)/1000));

    // derived features
    const missRate10 = calcMissRate10(tMs); // miss delta per sec over last 10s
    const accBad = clamp((100 - S.acc) / 100, 0, 1);
    const comboN = clamp(S.combo / 10, 0, 1);
    const leftLow = clamp((12 - S.left) / 12, 0, 1);

    const r = {
      tSec,
      iso: new Date().toISOString(),

      // context
      diff: S.diff, view: S.view, style: S.style, seed: S.seed,
      groupKey: S.groupKey, groupName: S.groupName,

      // raw state
      score: S.score|0,
      combo: S.combo|0,
      miss:  S.miss|0,
      acc:   S.acc|0,
      left:  S.left|0,
      storm: S.storm|0,
      miniUrg: S.miniUrg|0,

      // 1s window event counts
      shots_1s: S.c_shots|0,
      hit_good_1s: S.c_hit_good|0,
      hit_wrong_1s:S.c_hit_wrong|0,
      hit_junk_1s: S.c_hit_junk|0,
      miss_evt_1s: S.c_miss|0,

      // features (ML-friendly)
      missRate10: +missRate10.toFixed(3),
      accBad: +accBad.toFixed(3),
      comboN: +comboN.toFixed(3),
      leftLow:+leftLow.toFixed(3),

      // labels placeholders (filled in finalize)
      y_next10_miss: null,
      y_next10_wrong:null,
      y_next10_junk: null
    };

    // reset 1s counters
    S.c_shots=0; S.c_hit_good=0; S.c_hit_wrong=0; S.c_hit_junk=0; S.c_miss=0;

    rows.push(r);
  }

  function calcMissRate10(tMs){
    // Use rows history (last <= 10s) for delta miss count
    if (rows.length < 2) return 0;
    const cut = Math.max(0, tMs - 10000);
    // find earliest row >= cut
    let i0 = rows.length-1;
    const t0 = tMs;
    while (i0>0){
      const rPrev = rows[i0-1];
      const prevMs = S.startedAtMs + (rPrev.tSec*1000);
      if (prevMs < cut) break;
      i0--;
    }
    const a = rows[i0];
    const b = rows[rows.length-1];
    const dt = Math.max(1, (b.tSec - a.tSec));
    const dm = Math.max(0, (b.miss - a.miss));
    return dm / dt; // misses per sec over last ~10s window
  }

  function finalizeLabels(){
    // labels from future 10s window:
    // y_next10_miss: any increase in miss within next 10s
    // y_next10_wrong/junk: using hit_wrong_1s / hit_junk_1s summed in future window
    for (let i=0;i<rows.length;i++){
      const baseMiss = rows[i].miss|0;
      let anyMiss = 0, anyWrong = 0, anyJunk = 0;

      for (let j=i+1; j<rows.length && (rows[j].tSec - rows[i].tSec) <= 10; j++){
        if ((rows[j].miss|0) > baseMiss) anyMiss = 1;
        if ((rows[j].hit_wrong_1s|0) > 0) anyWrong = 1;
        if ((rows[j].hit_junk_1s|0) > 0) anyJunk = 1;
      }
      rows[i].y_next10_miss = anyMiss;
      rows[i].y_next10_wrong= anyWrong;
      rows[i].y_next10_junk = anyJunk;
    }
    return rows;
  }

  function toCSV(){
    const cols = Object.keys(rows[0]||{});
    const esc = (v)=>{
      const s = (v==null)?'':String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
    };
    const out = [];
    out.push(cols.join(','));
    for (const r of rows){
      out.push(cols.map(c=>esc(r[c])).join(','));
    }
    return out.join('\n');
  }

  function saveLast(){
    try{
      localStorage.setItem(LS_LAST, JSON.stringify({
        meta:{
          createdIso: new Date().toISOString(),
          diff:S.diff, view:S.view, style:S.style, seed:S.seed,
          timePlannedSec:S.timePlannedSec
        },
        rows
      }));
    }catch(_){}
  }

  function start(){
    if (!enabled()) return false;

    S.startedAtMs = nowMs();
    S.startedIso = new Date().toISOString();

    // attach listeners
    root.addEventListener('hha:score', onScore, {passive:true});
    root.addEventListener('hha:time',  onTime,  {passive:true});
    root.addEventListener('hha:rank',  onRank,  {passive:true});
    root.addEventListener('quest:update', onQuest, {passive:true});
    root.addEventListener('groups:progress', onProgress, {passive:true});
    root.addEventListener('hha:shoot', onShoot, {passive:true});
    root.addEventListener('hha:judge', onJudge, {passive:true});

    // tick every 1000ms (aligned-ish)
    lastTickMs = nowMs();
    clearInterval(it);
    it = setInterval(()=>{
      const t = nowMs();
      // ensure we don’t spam if tab throttles
      if (t - lastTickMs >= 900){
        lastTickMs = t;
        snapshotRow(t);
      }
    }, 250);

    return true;
  }

  function stop(){
    clearInterval(it);
    it = 0;
  }

  // public API
  NS.Telemetry = {
    enabled,
    start,
    stop,
    getRows: ()=>rows.slice(),
    finalize: ()=>{
      finalizeLabels();
      saveLast();
      return rows.slice();
    },
    toCSV: ()=>{
      if (!rows.length) return '';
      return toCSV();
    },
    getLastFromStorage: ()=>{
      try{ return JSON.parse(localStorage.getItem(LS_LAST)||'null'); }
      catch(_){ return null; }
    }
  };

})(typeof window!=='undefined' ? window : globalThis);