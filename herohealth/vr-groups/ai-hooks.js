/* === /herohealth/vr-groups/ai-hooks.js ===
GroupsVR AI Hooks — Production (OFF by default)
✅ Works with groups-vr.html: AIHooks.attach({enabled, runMode, seed})
✅ Uses AIPredict (ai-predict.js) if present
✅ 2A: Miss-risk early warning (rate-limited)
✅ 2B: Mini-fail risk warning
✅ 2B+: Explainable micro-tips (why risk high)
✅ 2C: Deep-learning-ready dataset capture (sequence features 1Hz + end labels)
    - localStorage: HHA_GROUPS_DLSET_V1 (keeps last N sessions)
    - export JSON (button optional; function provided)
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;
  const NS = root.GroupsVR = root.GroupsVR || {};
  const $ = (id)=>DOC.getElementById(id);

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function nowMs(){ return (root.performance && performance.now) ? performance.now() : Date.now(); }
  function emit(name, detail){ try{ root.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){ } }

  // ---------- UI helpers ----------
  const RATE = {
    warnMs: 2800,
    tipMs:  1800
  };

  function coach(text, mood){
    emit('hha:coach', { text: String(text||''), mood: String(mood||'neutral') });
  }

  function setAIBadge(on, levelText){
    const el = $('aiBadge');
    if (!el) return;
    el.classList.toggle('on', !!on);
    el.textContent = on ? (levelText || 'AI') : 'AI OFF';
  }

  function bumpMiniFx(on){
    DOC.body.classList.toggle('fx-mini', !!on);
    if (on){
      setTimeout(()=>{ try{ DOC.body.classList.remove('fx-mini'); }catch(_){} }, 520);
    }
  }

  // ---------- Dataset store (2C) ----------
  const LS_SET = 'HHA_GROUPS_DLSET_V1';

  function loadSet(){
    try{ return JSON.parse(localStorage.getItem(LS_SET)||'{"sessions":[]}'); }
    catch(_){ return { sessions: [] }; }
  }
  function saveSet(obj){
    try{ localStorage.setItem(LS_SET, JSON.stringify(obj)); }catch(_){}
  }

  function downloadText(filename, text){
    try{
      const blob = new Blob([String(text||'')], {type:'application/json;charset=utf-8'});
      const a = DOC.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      DOC.body.appendChild(a);
      a.click();
      setTimeout(()=>{ try{ URL.revokeObjectURL(a.href); a.remove(); }catch(_){} }, 60);
      return true;
    }catch(_){
      return false;
    }
  }

  // ---------- Explainability (2B+) ----------
  // ใช้ heuristics + (ถ้ามี) weights name mapping จาก model.meta.featureNames
  function explainFromSignals(sig){
    // sig: {missRisk, miniFailRisk, tSec} + latest stats
    const why = [];
    if (sig.pressure >= 2) why.push('พลาดสะสมสูง');
    if (sig.combo <= 0 && sig.tSec >= 8) why.push('คอมโบหลุด');
    if (sig.accPct <= 60 && sig.tSec >= 10) why.push('ความแม่นต่ำ');
    if (sig.stormOn) why.push('อยู่ใน STORM');
    if (sig.miniOn && sig.miniLeftSec <= 3) why.push('MINI ใกล้หมดเวลา');
    if (sig.miniOn && sig.miniNeedRem >= 2) why.push('MINI ยังเหลืออีกเยอะ');
    if (sig.scoreRate < 7 && sig.tSec >= 12) why.push('สปีดเก็บแต้มช้า');

    if (why.length === 0){
      if (sig.missRisk >= 0.75) why.push('จังหวะเล็งยังไม่นิ่ง');
      if (sig.miniFailRisk >= 0.75) why.push('ต้องเร่งเก็บ MINI ให้ครบ');
    }
    return why.slice(0, 3).join(' + ');
  }

  // ---------- Core attach ----------
  const AIHooks = NS.AIHooks = NS.AIHooks || {};
  let attached = false;

  // running context
  const S = {
    enabled: false,
    runMode: 'play',
    seed: '',
    view: 'mobile',

    // latest stats
    tSec: 0,
    left: 0,
    score: 0,
    combo: 0,
    misses: 0,
    accPct: 0,
    grade: 'C',
    pressure: 0,
    stormOn: false,

    // mini
    miniOn: false,
    miniLeftSec: 0,
    miniNeedRem: 0,
    forbidJunk: false,

    // dataset (sequence)
    dlOn: false,
    featNames: [],
    seq: [],
    seqT0Iso: '',
    lastFeatAtSec: -1,

    // rate limits
    lastWarnAt: 0,
    lastTipAt: 0,
    lastMiniWarnAt: 0,

    // last prediction
    missRisk: 0,
    miniFailRisk: 0,
    gradeText: 'C',
    gradeProb: null
  };

  function setPredictEnabled(on){
    const P = NS.AIPredict;
    if (P && P.setEnabled) P.setEnabled(!!on);
  }

  function updatePressure(){
    const m = S.misses|0;
    let p = 0;
    if (m >= 14) p = 3;
    else if (m >= 9) p = 2;
    else if (m >= 5) p = 1;
    S.pressure = p;
  }

  function maybeWarn(){
    if (!S.enabled) return;

    const t = nowMs();
    // 2A: miss risk
    if (S.missRisk >= 0.78 && (t - S.lastWarnAt) > RATE.warnMs){
      S.lastWarnAt = t;
      const why = explainFromSignals(S);
      coach(`⚠️ ระวังพลาด! ${why ? '('+why+')' : ''}  ลอง “เล็งก่อนยิง”`, (S.pressure>=2 ? 'fever' : 'neutral'));
    }

    // 2B: mini fail risk (เฉพาะตอน miniOn)
    if (S.miniOn && S.miniFailRisk >= 0.76 && (t - S.lastMiniWarnAt) > RATE.warnMs){
      S.lastMiniWarnAt = t;
      const why = explainFromSignals(S);
      coach(`⏱️ MINI เสี่ยงไม่ผ่าน! ${why ? '('+why+')' : ''}  โฟกัส “ถูกหมู่” ก่อน`, 'fever');
      bumpMiniFx(true);
    }

    // 2B+: micro-tip (เบากว่า warn) — เมื่อ risk กลางๆ
    if ((S.missRisk >= 0.62 || (S.miniOn && S.miniFailRisk >= 0.62)) && (t - S.lastTipAt) > RATE.tipMs){
      S.lastTipAt = t;

      let tip = '';
      if (S.stormOn) tip = 'STORM: อย่ารีบยิง—เลือกเป้าใกล้ crosshair';
      else if (S.accPct <= 55) tip = 'ทริค: รอ “เห็นหมู่ชัด” แล้วค่อยยิง';
      else if (S.combo <= 0) tip = 'ทริค: ยิงทีละเป้า ไม่สาด';
      else if (S.miniOn && S.miniLeftSec <= 3) tip = 'MINI: รีบเก็บเป้าให้ครบก่อนหมดเวลา!';
      else tip = 'ทริค: เล็งกลางจอแล้วแตะยิงจังหวะนิ่ง';

      coach(`💡 ${tip}`, 'neutral');
    }
  }

  function onPredict(ev){
    if (!S.enabled) return;
    const d = ev.detail || {};
    if (!d) return;

    // normalize
    S.missRisk = clamp(d.missRisk ?? 0, 0, 1);
    S.miniFailRisk = clamp(d.miniFailRisk ?? 0, 0, 1);
    S.gradeText = String(d.gradeText || S.gradeText || 'C');
    S.gradeProb = d.gradeProb || null;

    // show badge
    const maxR = Math.max(S.missRisk, S.miniOn ? S.miniFailRisk : 0);
    const lvl = (maxR >= 0.85) ? 'AI 🔥' : (maxR >= 0.70 ? 'AI ⚠️' : (maxR >= 0.55 ? 'AI ✨' : 'AI'));
    setAIBadge(true, lvl);

    maybeWarn();
  }

  function onScore(ev){
    const d = ev.detail || {};
    S.score = Number(d.score ?? S.score) || 0;
    S.combo = Number(d.combo ?? S.combo) || 0;
    S.misses = Number(d.misses ?? S.misses) || 0;
    updatePressure();
  }

  function onTime(ev){
    const d = ev.detail || {};
    S.left = Number(d.left ?? S.left) || 0;
  }

  function onRank(ev){
    const d = ev.detail || {};
    S.accPct = Number(d.accuracy ?? S.accPct) || 0;
    S.grade = String(d.grade ?? S.grade ?? 'C');
  }

  function onProgress(ev){
    const d = ev.detail || {};
    if (!d) return;
    if (d.kind === 'storm_on') S.stormOn = true;
    if (d.kind === 'storm_off') S.stormOn = false;
    if (d.kind === 'miss') updatePressure();
  }

  function onQuest(ev){
    const d = ev.detail || {};
    // derive mini info
    const miniTitle = String(d.miniTitle || '');
    const miniOn = !!(miniTitle && miniTitle !== '—');
    S.miniOn = miniOn;
    S.miniLeftSec = Number(d.miniTimeLeftSec || 0) || 0;

    const now = Number(d.miniNow || 0) || 0;
    const tot = Number(d.miniTotal || 0) || 0;
    S.miniNeedRem = Math.max(0, (tot|0) - (now|0));

    // best-effort parse forbidJunk from text
    S.forbidJunk = miniTitle.includes('ห้าม') || miniTitle.includes('ขยะ');
  }

  // 2C: capture sequences from groups:features (1Hz)
  function onFeatures(ev){
    const d = ev.detail || {};
    if (!d || !Array.isArray(d.x)) return;

    const tSec = Number(d.tSec||0)|0;
    S.tSec = tSec;

    if (!S.dlOn) return;
    if (tSec === S.lastFeatAtSec) return;
    S.lastFeatAtSec = tSec;

    if (!S.featNames.length && Array.isArray(d.featureNames)) S.featNames = d.featureNames.slice(0);

    // store minimal row
    S.seq.push({
      tSec,
      x: d.x.slice(0),
      // optional “teacher signals” for analysis/debug (not used as labels)
      yHint: {
        missRisk: S.missRisk,
        miniFailRisk: S.miniFailRisk,
        acc: S.accPct,
        grade: S.grade
      }
    });

    // cap seq length
    if (S.seq.length > 240) S.seq.shift();
  }

  function buildDlSession(endSummary){
    const view = String(qs('view','mobile')||'mobile').toLowerCase();
    const diff = String(qs('diff','normal')||'normal').toLowerCase();
    const style= String(qs('style','mix')||'mix').toLowerCase();
    const seed = String(qs('seed','')||'');
    const run  = String(qs('run','play')||'play').toLowerCase();

    // labels (for deep learning)
    const label = {
      grade: String(endSummary.grade || endSummary.gradeText || S.grade || 'C'),
      acc: Number(endSummary.accuracyGoodPct ?? S.accPct ?? 0) || 0,
      misses: Number(endSummary.misses ?? S.misses ?? 0) || 0,
      score: Number(endSummary.scoreFinal ?? S.score ?? 0) || 0,
      miniCleared: Number(endSummary.miniCleared ?? 0) || 0,
      miniTotal: Number(endSummary.miniTotal ?? 0) || 0,
      goalsCleared: Number(endSummary.goalsCleared ?? 0) || 0,
      goalsTotal: Number(endSummary.goalsTotal ?? 0) || 0,
      pressureLevel: Number(endSummary.pressureLevel ?? S.pressure ?? 0) || 0
    };

    return {
      schema: 'HHA_GROUPS_DLSET_V1',
      createdIso: new Date().toISOString(),
      ctx: { run, view, diff, style, seed },
      featureNames: S.featNames.slice(0),
      seq: S.seq.slice(0),
      label,
      endSummary
    };
  }

  function onEnd(ev){
    const end = ev.detail || {};
    setAIBadge(false, 'AI OFF');

    // store DL session if enabled
    if (S.dlOn && S.seq && S.seq.length){
      const pack = loadSet();
      pack.sessions = Array.isArray(pack.sessions) ? pack.sessions : [];
      pack.sessions.unshift(buildDlSession(end));
      pack.sessions = pack.sessions.slice(0, 40); // keep last 40 sessions
      saveSet(pack);
      coach('📦 บันทึก DL dataset แล้ว (local) — พร้อม export', 'happy');
    }
  }

  // public export helpers
  AIHooks.exportDlLatest = function(){
    const pack = loadSet();
    const s = (pack.sessions && pack.sessions[0]) ? pack.sessions[0] : null;
    if (!s) return false;
    const fn = `groups-dl-${(s.ctx && s.ctx.seed) ? s.ctx.seed : Date.now()}.json`;
    return downloadText(fn, JSON.stringify(s, null, 2));
  };

  AIHooks.exportDlAll = function(){
    const pack = loadSet();
    const fn = `groups-dl-all-${Date.now()}.json`;
    return downloadText(fn, JSON.stringify(pack, null, 2));
  };

  AIHooks.clearDlSet = function(){
    try{ localStorage.removeItem(LS_SET); }catch(_){}
  };

  // attach
  AIHooks.attach = function(cfg){
    cfg = cfg || {};
    S.runMode = String(cfg.runMode || 'play').toLowerCase();
    S.seed = String(cfg.seed || '');
    S.enabled = !!cfg.enabled;
    S.view = String(qs('view','mobile')||'mobile').toLowerCase();

    // DL dataset toggle: ?dl=1 (play only; research/practice forced off)
    const dlParam = String(qs('dl','0')||'0');
    const wantDl = (dlParam === '1' || dlParam === 'true');
    S.dlOn = wantDl && S.enabled && (S.runMode === 'play');

    S.seq = [];
    S.featNames = [];
    S.lastFeatAtSec = -1;
    S.seqT0Iso = new Date().toISOString();

    // enable predictor
    setPredictEnabled(S.enabled);

    setAIBadge(S.enabled, S.enabled ? 'AI' : 'AI OFF');
    if (S.enabled){
      coach('🤖 AI เปิดแล้ว: จะช่วยเตือนก่อนพลาด + MINI เสี่ยง', 'neutral');
      if (S.dlOn) coach('🧠 DL dataset ON: กำลังเก็บลำดับข้อมูล 1Hz', 'happy');
    }

    if (attached) return;
    attached = true;

    // listeners
    root.addEventListener('ai:predict', onPredict, {passive:true});
    root.addEventListener('hha:score',  onScore,   {passive:true});
    root.addEventListener('hha:time',   onTime,    {passive:true});
    root.addEventListener('hha:rank',   onRank,    {passive:true});
    root.addEventListener('groups:progress', onProgress, {passive:true});
    root.addEventListener('quest:update', onQuest, {passive:true});
    root.addEventListener('groups:features', onFeatures, {passive:true});
    root.addEventListener('hha:end', onEnd, {passive:true});
  };

})(typeof window!=='undefined'?window:globalThis);