// === /herohealth/vr-groups/ml-trace.js ===
// PACK 18 — ML/DL Trace Logger (local, downloadable)
// ✅ Captures sequence for DL: ticks (1Hz), ai signals, judge events, and end summary
// ✅ Stores localStorage (ring buffer) + Download JSONL
// ✅ Safe: research/practice OK (still logs), but AI signals may be absent when disabled

(function(root){
  'use strict';
  const DOC = root.document;
  if(!DOC) return;

  const NS = root.GroupsVR = root.GroupsVR || {};
  const LS_KEY = 'HHA_MLTRACE_GROUPS_LATEST';
  const LS_HIST = 'HHA_MLTRACE_GROUPS_HISTORY';

  function nowIso(){ return new Date().toISOString(); }
  function emit(name, detail){ try{ root.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){ } }

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }

  function safeJsonParse(s, def){
    try{ return JSON.parse(s); }catch(_){ return def; }
  }

  function downloadText(filename, text){
    try{
      const blob = new Blob([text], { type: 'application/jsonl;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = DOC.createElement('a');
      a.href = url;
      a.download = filename;
      DOC.body.appendChild(a);
      a.click();
      setTimeout(()=>{ try{ a.remove(); URL.revokeObjectURL(url); }catch(_){} }, 150);
      return true;
    }catch(_){
      return false;
    }
  }

  // ---- trace state ----
  let trace = null;

  function startNewTrace(){
    const ctx = (NS.getResearchCtx && typeof NS.getResearchCtx==='function') ? NS.getResearchCtx() : {};
    const t0 = nowIso();
    trace = {
      meta: Object.assign({
        traceVersion: '18A',
        projectTag: 'HeroHealth',
        gameTag: 'GroupsVR',
        startedIso: t0,
        runMode: String(qs('run','play')||'play'),
        diff: String(qs('diff','normal')||'normal'),
        style: String(qs('style','mix')||'mix'),
        view: String(qs('view','mobile')||'mobile'),
        seed: String(qs('seed','')||''),
        timePlannedSec: Number(qs('time',90)||90),
      }, ctx),
      seq: [],       // time series (tick + ai + judge)
      end: null
    };
  }

  function ensure(){
    if(!trace) startNewTrace();
  }

  function pushRow(kind, payload){
    ensure();
    trace.seq.push(Object.assign({
      kind,
      tsIso: nowIso()
    }, payload || {}));

    // keep reasonable size
    if (trace.seq.length > 1200) trace.seq.splice(0, trace.seq.length - 1200);
  }

  function saveLatest(){
    if(!trace) return;
    try{ localStorage.setItem(LS_KEY, JSON.stringify(trace)); }catch(_){}
  }

  function saveHistory(finalTrace){
    try{
      const hist = safeJsonParse(localStorage.getItem(LS_HIST)||'[]', []);
      hist.unshift(finalTrace);
      localStorage.setItem(LS_HIST, JSON.stringify(hist.slice(0, 20)));
    }catch(_){}
  }

  // ---- listeners ----
  function onStart(ev){
    startNewTrace();
    pushRow('start', { detail: ev.detail || {} });
    saveLatest();
  }

  function onTick(ev){
    const d = ev.detail||{};
    // minimal features for DL
    pushRow('tick', {
      tSec: d.tSec|0,
      left: d.left|0,
      score: d.score|0,
      combo: d.combo|0,
      miss: d.miss|0,
      acc: Number(d.acc||0),
      grade: String(d.grade||'C'),
      pressure: d.pressure|0,
      stormOn: d.stormOn ? 1 : 0
    });
    saveLatest();
  }

  function onAI(ev){
    const d = ev.detail||{};
    pushRow('ai', {
      band: String(d.band||''),
      risk: Number(d.riskMissNext5s||0),
      tipId: String(d.tipId||''),
      reasons: (d.reasons && Array.isArray(d.reasons)) ? d.reasons.slice(0,6) : []
    });
    saveLatest();
  }

  function onJudge(ev){
    const d = ev.detail||{};
    pushRow('judge', {
      jKind: String(d.kind||''),
      text: String(d.text||''),
      x: Math.round(Number(d.x||0)),
      y: Math.round(Number(d.y||0))
    });
    saveLatest();
  }

  function onEnd(ev){
    ensure();
    trace.end = Object.assign({ endedIso: nowIso() }, ev.detail||{});
    saveLatest();
    saveHistory(trace);

    emit('hha:coach', { text:'📦 บันทึก ML Trace แล้ว (ดาวน์โหลดได้จากปุ่ม/คอนโซล)', mood:'happy' });
  }

  // ---- public API ----
  function getLatest(){
    return safeJsonParse(localStorage.getItem(LS_KEY)||'null', null);
  }

  function toJSONL(t){
    if(!t) return '';
    const lines = [];
    lines.push(JSON.stringify({ kind:'meta', tsIso: t.meta.startedIso, ...t.meta }));
    for(const row of (t.seq||[])) lines.push(JSON.stringify(row));
    if(t.end) lines.push(JSON.stringify({ kind:'end', tsIso: t.end.endedIso || nowIso(), ...t.end }));
    return lines.join('\n') + '\n';
  }

  function downloadLatest(){
    const t = getLatest() || trace;
    if(!t) return false;
    const seed = String((t.meta && t.meta.seed) || 'noseed').replace(/[^a-z0-9_\-]/gi,'_').slice(0,40);
    const fn = `GroupsVR_MLTrace_${seed}_${Date.now()}.jsonl`;
    const ok = downloadText(fn, toJSONL(t));
    if(ok) emit('hha:coach', { text:'ดาวน์โหลด ML Trace แล้ว ✅', mood:'happy' });
    return ok;
  }

  // attach
  root.addEventListener('hha:start', onStart, {passive:true});
  root.addEventListener('hha:tick', onTick, {passive:true});
  root.addEventListener('hha:ai', onAI, {passive:true});
  root.addEventListener('hha:judge', onJudge, {passive:true});
  root.addEventListener('hha:end', onEnd, {passive:true});

  // init
  startNewTrace();
  NS.MLTrace = { getLatest, downloadLatest, toJSONL };

})(typeof window!=='undefined' ? window : globalThis);