// === /herohealth/germ-detective/germ-detective.logger.js ===
// Local-first CSV logger (sessions/events/features1s) — NO network

export function createLogger(getCtx){
  const L = {
    sessionId: null,
    startedAt: null,
    endedAt: null,
    seq: 0,
    enabled: true,
    buffers: { sessions:[], events:[], features1s:[] },
    _featTimer: null
  };

  const isoNow = ()=> new Date().toISOString();
  const nowMs = ()=> Date.now();

  function makeSessionId(P){
    return ['GD', P.pid||'anon', P.run||'play', P.scene||'scene', Date.now().toString(36)]
      .join('_').replace(/[^\w-]+/g,'_');
  }

  function baseRow(kind){
    const { P, GD } = getCtx();
    L.seq += 1;
    return {
      game:'germ-detective',
      kind,
      sessionId: L.sessionId,
      seq: L.seq,
      tsIso: isoNow(),
      tsMs: nowMs(),
      pid:P.pid, run:P.run, diff:P.diff, scene:P.scene, view:P.view, seed:P.seed,
      deterministic: (P.run==='research') ? 1 : 0,
      researchSeedBase: (P.run==='research') ? (window.__GD_RESEARCH_SEED_BASE__ || null) : null,
      missionId: GD.mission?.current?.id || null,
      phaseMode: GD.phase?.mode || 'investigate'
    };
  }

  function safeJson(v){ try{ return JSON.stringify(v ?? {});}catch{ return '{"error":"json"}'; } }
  function numOrNull(v){ const n=Number(v); return Number.isFinite(n)?n:null; }

  function logEvent(eventName, payload={}){
    if(!L.enabled) return;
    const row = {
      ...baseRow('event'),
      eventName: String(eventName||'event'),
      payloadJson: safeJson(payload),
      payloadSize: JSON.stringify(payload||{}).length,
      target: payload.target ?? null,
      tool: payload.tool ?? null,
      method: payload.method ?? null,
      reason: payload.reason ?? null,
      riskBefore: numOrNull(payload.riskBefore),
      riskAfter: numOrNull(payload.riskAfter),
      impactEst: numOrNull(payload.impactEst),
      budgetLeft: numOrNull(payload.budgetLeft),
    };
    L.buffers.events.push(row);
  }

  function logFeature1s(){
    if(!L.enabled) return;
    const { P, GD, app, helpers } = getCtx();
    const st = app?.getState?.() || {};
    const chain = helpers?.graphTopChain?.() || [];
    const row = {
      ...baseRow('features1s'),
      timeLeft: numOrNull(st.timeLeft),
      timeTotal: numOrNull(st.timeTotal),
      running: st.running ? 1:0,
      paused: st.paused ? 1:0,
      ended: st.ended ? 1:0,
      evidenceCount: numOrNull(GD.trace?.evidenceCount),
      uniqueTargets: numOrNull(GD.trace?.uniqueTargets?.size),
      scansUV: numOrNull(GD.trace?.toolUse?.uv),
      swabs: numOrNull(GD.trace?.toolUse?.swab),
      photos: numOrNull(GD.trace?.toolUse?.cam),
      riskScore: numOrNull(GD.ai?.riskScore),
      nextBestAction: GD.ai?.nextBestAction || null,
      graphNodeCount: numOrNull(helpers?.graphNodeCount?.()),
      graphEdgeCount: numOrNull(helpers?.graphEdgeCount?.()),
      graphChain: chain.join('>') || null,
      budgetTotal: numOrNull(GD.budget?.points),
      budgetSpent: numOrNull(GD.budget?.spent),
      budgetLeft: numOrNull(helpers?.budgetLeft?.()),
      interventionActions: numOrNull(GD.budget?.actions?.length),
    };
    L.buffers.features1s.push(row);
  }

  function logSessionEnd(extra={}){
    if(!L.enabled) return;
    if(L.buffers.sessions.length) return;
    const { GD, helpers } = getCtx();
    L.endedAt = isoNow();
    const score = GD.score || {};
    const chain = helpers?.graphTopChain?.() || [];
    L.buffers.sessions.push({
      ...baseRow('session'),
      startedAt: L.startedAt,
      endedAt: L.endedAt,
      durationSec: null,
      finalScore: score.final ?? null,
      rank: score.rank ?? null,
      graphChain: chain.join('>') || null,
      budgetSpent: GD.budget?.spent ?? null,
      budgetLeft: helpers?.budgetLeft?.() ?? null,
      riskScoreEnd: GD.ai?.riskScore ?? null,
      resultReason: extra.reason || null,
      extraJson: safeJson(extra)
    });
  }

  function init(){
    const { P } = getCtx();
    L.sessionId = makeSessionId(P);
    L.startedAt = isoNow();
    L.endedAt = null;
    L.seq = 0;
    L.buffers = { sessions:[], events:[], features1s:[] };
    logEvent('session_start', { pid:P.pid, run:P.run, diff:P.diff, time:P.time, seed:P.seed, scene:P.scene, view:P.view });
  }

  function startFeatureLoop(){
    if(L._featTimer) clearInterval(L._featTimer);
    L._featTimer = setInterval(()=>{ try{ logFeature1s(); }catch{} }, 1000);
  }
  function stopFeatureLoop(){
    if(L._featTimer){ clearInterval(L._featTimer); L._featTimer = null; }
  }

  function csvEscape(v){
    if(v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  }
  function rowsToCsv(rows){
    if(!rows || !rows.length) return '';
    const cols = Array.from(rows.reduce((set,r)=>{ Object.keys(r||{}).forEach(k=>set.add(k)); return set; }, new Set()));
    const head = cols.map(csvEscape).join(',');
    const body = rows.map(r => cols.map(c => csvEscape(r[c])).join(',')).join('\n');
    return head + '\n' + body;
  }
  function downloadText(filename, text, mime='text/csv;charset=utf-8'){
    const blob = new Blob([text], {type:mime});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url; a.download=filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=> URL.revokeObjectURL(url), 1000);
  }
  function exportCsv(kind){
    const rows = L.buffers[kind] || [];
    const csv = rowsToCsv(rows);
    const ts = isoNow().replace(/[:.]/g,'-');
    downloadText(`germ-detective_${kind}_${L.sessionId}_${ts}.csv`, csv);
  }

  return {
    L,
    init,
    logEvent,
    logFeature1s,
    logSessionEnd,
    startFeatureLoop,
    stopFeatureLoop,
    exportCsv
  };
}