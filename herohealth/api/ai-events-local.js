// === /herohealth/api/ai-events-local.js ===
// HeroHealth AI Local Logger — PRODUCTION (AI events + AI sessions -> localStorage -> CSV export)
// ✅ listens: hha:ai-predict, hha:ai-coach, hha:game-ended
// ✅ events queue + sessions queue (cap)
// ✅ builds per-session AI stats: nPredict, nCoach, avgConf, minConf, maxConf, topWhy
// ✅ debug mini button "AI CSV" when ?dbg=1 or ?aicsv=1
// v20260226-AI-LOCALCSV-PRO

'use strict';

(function(){
  const WIN = window;
  const DOC = document;

  const qs = (k, d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } };
  const nowIso = ()=> new Date().toISOString();

  // queues
  const Q_EVENTS = 'HHA_AI_EVENTS_Q_V1';
  const Q_SESS   = 'HHA_AI_SESS_Q_V1';
  const MAX_EVENTS = 5000;
  const MAX_SESS   = 800;

  // in-session aggregator (resets on load, closes on game-ended)
  let sessAgg = {
    id: String(Date.now()) + '_' + Math.random().toString(16).slice(2),
    startTs: Date.now(),
    startIso: nowIso(),
    nPredict: 0,
    nCoach: 0,
    confSum: 0,
    confMin: 101,
    confMax: -1,
    whyCount: Object.create(null),
    lastBestKind: '',
    lastBestEmoji: '',
    lastWhy: '',
    lastConf: null
  };

  function safeJson(obj, maxLen){
    try{
      const s = JSON.stringify(obj ?? null);
      if(!maxLen) return s;
      return (s.length > maxLen) ? (s.slice(0, maxLen) + '…') : s;
    }catch(e){
      return '"[json_error]"';
    }
  }

  function loadQ(key){
    try{
      const raw = localStorage.getItem(key);
      if(!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    }catch(e){ return []; }
  }
  function saveQ(key, arr, cap){
    try{
      if(arr.length > cap) arr.splice(0, arr.length - cap);
      localStorage.setItem(key, JSON.stringify(arr));
    }catch(e){}
  }
  function pushQ(key, ev, cap){
    const q = loadQ(key);
    q.push(ev);
    saveQ(key, q, cap);
  }
  function clearQ(key){
    try{ localStorage.removeItem(key); }catch(e){}
  }

  function ctx(){
    return {
      pid: String(qs('pid','anon')||'anon'),
      run: String(qs('run','play')||'play'),
      diff: String(qs('diff','normal')||'normal'),
      view: String(qs('view','mobile')||'mobile'),
      seed: String(qs('seed','')||''),
      studyId: String(qs('studyId', qs('study',''))||''),
      phase: String(qs('phase','')||''),
      conditionGroup: String(qs('conditionGroup', qs('cond',''))||''),
      cat: String(qs('cat','')||''),
      theme: String(qs('theme', qs('game',''))||''),
      // useful for planner chaining, etc.
      planSeq: String(qs('planSeq','')||''),
      planDay: String(qs('planDay','')||''),
      planSlot: String(qs('planSlot','')||''),
      planIndex: String(qs('planIndex','')||'')
    };
  }

  function normalizeEvent(kind, detail){
    const c = ctx();
    const game = String(detail?.game || c.theme || 'goodjunk');
    return {
      kind: String(kind),
      ts: Date.now(),
      iso: nowIso(),
      sessionId: sessAgg.id,

      game,
      pid: c.pid,
      run: c.run,
      diff: c.diff,
      view: c.view,
      seed: c.seed,
      studyId: c.studyId,
      phase: c.phase,
      conditionGroup: c.conditionGroup,
      cat: c.cat,

      why: detail?.why ?? null,
      confidence: detail?.confidence ?? null,

      bestKind: detail?.best?.kind ?? null,
      bestEmoji: detail?.best?.emoji ?? null,
      next1Kind: detail?.next?.[0]?.kind ?? null,
      next1Emoji: detail?.next?.[0]?.emoji ?? null,
      next2Kind: detail?.next?.[1]?.kind ?? null,
      next2Emoji: detail?.next?.[1]?.emoji ?? null,

      msg: detail?.msg ?? null,
      payload: safeJson(detail, 6500)
    };
  }

  // ===== Aggregator update =====
  function bumpWhy(why){
    if(!why) return;
    const key = String(why).slice(0,120);
    sessAgg.whyCount[key] = (sessAgg.whyCount[key] || 0) + 1;
  }

  function updateAggFromPredict(detail){
    sessAgg.nPredict++;
    const conf = Number(detail?.confidence);
    if(Number.isFinite(conf)){
      sessAgg.confSum += conf;
      sessAgg.confMin = Math.min(sessAgg.confMin, conf);
      sessAgg.confMax = Math.max(sessAgg.confMax, conf);
      sessAgg.lastConf = conf;
    }
    const why = detail?.why ?? '';
    sessAgg.lastWhy = String(why || '');
    bumpWhy(sessAgg.lastWhy);

    const bk = detail?.best?.kind ?? '';
    const be = detail?.best?.emoji ?? '';
    sessAgg.lastBestKind = String(bk || '');
    sessAgg.lastBestEmoji = String(be || '');
  }

  function updateAggFromCoach(detail){
    sessAgg.nCoach++;
    // coach meta might include confidence too (optional)
    const conf = Number(detail?.meta?.confidence);
    if(Number.isFinite(conf)){
      sessAgg.confSum += conf;
      sessAgg.confMin = Math.min(sessAgg.confMin, conf);
      sessAgg.confMax = Math.max(sessAgg.confMax, conf);
      sessAgg.lastConf = conf;
    }
    // prefer detail.meta.why, else detail.why
    const why = detail?.meta?.why ?? detail?.why ?? '';
    if(why) bumpWhy(String(why));
  }

  function topWhy(){
    let bestK = '';
    let bestV = -1;
    const m = sessAgg.whyCount || {};
    for(const k in m){
      const v = m[k] || 0;
      if(v > bestV){
        bestV = v;
        bestK = k;
      }
    }
    return { why: bestK || '', count: Math.max(0, bestV) };
  }

  // ===== listeners =====
  WIN.addEventListener('hha:ai-predict', (e)=>{
    try{
      const d = e?.detail || null;
      if(d) updateAggFromPredict(d);
      pushQ(Q_EVENTS, normalizeEvent('hha:ai-predict', d), MAX_EVENTS);
    }catch(_){}
  });

  WIN.addEventListener('hha:ai-coach', (e)=>{
    try{
      const d = e?.detail || null;
      if(d) updateAggFromCoach(d);
      pushQ(Q_EVENTS, normalizeEvent('hha:ai-coach', d), MAX_EVENTS);
    }catch(_){}
  });

  // finalize session on game end
  WIN.addEventListener('hha:game-ended', (e)=>{
    try{
      const end = e?.detail || null;
      const c = ctx();
      const tWhy = topWhy();

      const nConf = (sessAgg.nPredict + sessAgg.nCoach);
      const avgConf = (nConf > 0) ? Math.round(sessAgg.confSum / nConf) : 0;
      const minConf = (sessAgg.confMin <= 100) ? sessAgg.confMin : 0;
      const maxConf = (sessAgg.confMax >= 0) ? sessAgg.confMax : 0;

      const row = {
        kind: 'hha_ai_session',
        ts: Date.now(),
        iso: nowIso(),
        sessionId: sessAgg.id,

        game: String(end?.projectTag || end?.game || c.theme || 'goodjunk'),
        gameVersion: String(end?.gameVersion || ''),
        pid: c.pid,
        run: c.run,
        diff: c.diff,
        view: c.view,
        seed: c.seed,
        studyId: c.studyId,
        phase: c.phase,
        conditionGroup: c.conditionGroup,
        cat: c.cat,

        durationPlannedSec: end?.durationPlannedSec ?? '',
        durationPlayedSec: end?.durationPlayedSec ?? '',
        scoreFinal: end?.scoreFinal ?? '',
        missTotal: end?.missTotal ?? '',
        grade: end?.grade ?? '',

        aiPredictN: sessAgg.nPredict,
        aiCoachN: sessAgg.nCoach,
        aiAvgConf: avgConf,
        aiMinConf: minConf,
        aiMaxConf: maxConf,
        aiTopWhy: tWhy.why,
        aiTopWhyCount: tWhy.count,
        aiLastBestKind: sessAgg.lastBestKind,
        aiLastBestEmoji: sessAgg.lastBestEmoji,
        aiLastWhy: sessAgg.lastWhy,
        aiLastConf: sessAgg.lastConf ?? '',

        endReason: end?.reason ?? '',
        endTimeIso: end?.endTimeIso ?? '',
        payloadEnd: safeJson(end, 6500)
      };

      pushQ(Q_SESS, row, MAX_SESS);

      // reset aggregator for next run (same page reload may happen)
      sessAgg = {
        id: String(Date.now()) + '_' + Math.random().toString(16).slice(2),
        startTs: Date.now(),
        startIso: nowIso(),
        nPredict: 0,
        nCoach: 0,
        confSum: 0,
        confMin: 101,
        confMax: -1,
        whyCount: Object.create(null),
        lastBestKind: '',
        lastBestEmoji: '',
        lastWhy: '',
        lastConf: null
      };
    }catch(_){}
  });

  // ===== CSV =====
  function csvEscape(v){
    if(v==null) return '';
    const s = String(v);
    if(/[,"\n\r]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
    return s;
  }

  function toCsv(rows, cols){
    const out = [];
    out.push(cols.join(','));
    for(const r of rows){
      out.push(cols.map(c=>csvEscape(r[c])).join(','));
    }
    return out.join('\n');
  }

  function downloadText(filename, text){
    const blob = new Blob([text], { type:'text/csv;charset=utf-8' });
    const a = DOC.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    DOC.body.appendChild(a);
    a.click();
    setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 250);
  }

  function exportEventsCsv(){
    const rows = loadQ(Q_EVENTS);
    const cols = [
      'kind','ts','iso','sessionId','game','pid','run','diff','view','seed','studyId','phase','conditionGroup','cat',
      'why','confidence','bestKind','bestEmoji','next1Kind','next1Emoji','next2Kind','next2Emoji','msg','payload'
    ];
    const csv = toCsv(rows, cols);
    const c = ctx();
    const tag = `${c.pid}_${c.run}_${c.view}`.replace(/[^\w\-]+/g,'_');
    downloadText(`HHA_AI_EVENTS_${tag}_${Date.now()}.csv`, csv);
  }

  function exportSessionsCsv(){
    const rows = loadQ(Q_SESS);
    const cols = [
      'kind','ts','iso','sessionId','game','gameVersion','pid','run','diff','view','seed','studyId','phase','conditionGroup','cat',
      'durationPlannedSec','durationPlayedSec','scoreFinal','missTotal','grade',
      'aiPredictN','aiCoachN','aiAvgConf','aiMinConf','aiMaxConf','aiTopWhy','aiTopWhyCount',
      'aiLastBestKind','aiLastBestEmoji','aiLastWhy','aiLastConf',
      'endReason','endTimeIso','payloadEnd'
    ];
    const csv = toCsv(rows, cols);
    const c = ctx();
    const tag = `${c.pid}_${c.run}_${c.view}`.replace(/[^\w\-]+/g,'_');
    downloadText(`HHA_AI_SESSIONS_${tag}_${Date.now()}.csv`, csv);
  }

  function exportBoth(){
    exportEventsCsv();
    exportSessionsCsv();
  }

  // ===== debug button =====
  const showBtn = (String(qs('dbg','0'))==='1') || (String(qs('aicsv','0'))==='1');

  function ensureBtn(){
    if(!showBtn) return;
    if(DOC.getElementById('hhaAiCsvBtn')) return;

    const btn = DOC.createElement('button');
    btn.id = 'hhaAiCsvBtn';
    btn.type = 'button';
    btn.textContent = 'AI CSV';
    btn.style.position='fixed';
    btn.style.left='10px';
    btn.style.bottom=`calc(env(safe-area-inset-bottom,0px) + 10px)`;
    btn.style.zIndex='999';
    btn.style.border='1px solid rgba(148,163,184,.22)';
    btn.style.background='rgba(2,6,23,.55)';
    btn.style.color='rgba(229,231,235,.95)';
    btn.style.borderRadius='14px';
    btn.style.padding='10px 12px';
    btn.style.fontWeight='1000';
    btn.style.cursor='pointer';
    btn.style.boxShadow='0 14px 40px rgba(0,0,0,.35)';

    btn.addEventListener('click', ()=>{
      const nE = loadQ(Q_EVENTS).length;
      const nS = loadQ(Q_SESS).length;
      const pick = prompt(
        `Export AI CSV:\n` +
        `1 = EVENTS (${nE})\n` +
        `2 = SESSIONS (${nS})\n` +
        `3 = BOTH\n` +
        `4 = CLEAR ALL\n\n` +
        `Type 1/2/3/4 then OK`
      );
      if(!pick) return;
      const p = String(pick).trim();
      if(p === '1') exportEventsCsv();
      else if(p === '2') exportSessionsCsv();
      else if(p === '3') exportBoth();
      else if(p === '4'){
        if(confirm('Clear AI EVENTS + SESSIONS queues?')){
          clearQ(Q_EVENTS);
          clearQ(Q_SESS);
          alert('Cleared ✅');
        }
      }
    });

    DOC.body.appendChild(btn);
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', ensureBtn);
  }else{
    ensureBtn();
  }

  // public helpers
  WIN.HHA_AI_LOCAL = {
    eventsSize: ()=> loadQ(Q_EVENTS).length,
    sessSize: ()=> loadQ(Q_SESS).length,
    exportEventsCsv,
    exportSessionsCsv,
    exportBoth,
    clearAll: ()=>{ clearQ(Q_EVENTS); clearQ(Q_SESS); },
    keys: { Q_EVENTS, Q_SESS }
  };
})();