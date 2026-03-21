// === /herohealth/germ-detective/germ-detective.logger.js ===
// Germ Detective local-first logger — P5 aligned
// sessions / events / features1s / summary
// NO network by default

export function createLogger(getCtx){
  const L = {
    sessionId: null,
    startedAt: null,
    endedAt: null,
    seq: 0,
    enabled: true,
    buffers: {
      sessions: [],
      events: [],
      features1s: [],
      summary: []
    },
    _featTimer: null
  };

  const isoNow = ()=> new Date().toISOString();
  const nowMs = ()=> Date.now();

  function makeSessionId(P){
    return ['GD', P.pid || 'anon', P.run || 'play', P.scene || 'scene', Date.now().toString(36)]
      .join('_')
      .replace(/[^\w-]+/g, '_');
  }

  function safeJson(v){
    try{ return JSON.stringify(v ?? {}); }
    catch{ return '{"error":"json"}'; }
  }

  function numOrNull(v){
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function sceneLabel(scene){
    if(scene === 'home') return 'บ้าน';
    if(scene === 'canteen') return 'โรงอาหาร';
    return 'ห้องเรียน';
  }

  function diffLabel(diff){
    if(diff === 'easy') return 'ระดับง่าย';
    if(diff === 'hard') return 'ระดับยาก';
    return 'ระดับปกติ';
  }

  function baseRow(kind){
    const { P, app } = getCtx();
    const st = app?.getState?.() || {};
    L.seq += 1;

    return {
      game: 'germ-detective',
      kind,
      sessionId: L.sessionId,
      seq: L.seq,
      tsIso: isoNow(),
      tsMs: nowMs(),

      pid: P.pid,
      run: P.run,
      diff: P.diff,
      diffLabel: diffLabel(P.diff),
      scene: P.scene,
      sceneLabel: sceneLabel(P.scene),
      view: P.view,
      seed: P.seed,

      deterministic: (P.run === 'research') ? 1 : 0,
      phase: st.phase || null,
      timeLeft: numOrNull(st.timeLeft),
      timeTotal: numOrNull(st.timeTotal),
      score: numOrNull(st.score),
      areaRisk: numOrNull(st.areaRisk),
      criticalFound: numOrNull(st.criticalFound),
      criticalTotal: numOrNull(st.criticalTotal),
      evidenceCount: Array.isArray(st.evidence) ? st.evidence.length : 0,
      cleanedCount: numOrNull(st.cleanedCount),
      paused: st.paused ? 1 : 0,
      running: st.running ? 1 : 0,
      ended: st.ended ? 1 : 0
    };
  }

  function logEvent(eventName, payload = {}){
    if(!L.enabled) return;
    const row = {
      ...baseRow('event'),
      eventName: String(eventName || 'event'),
      payloadJson: safeJson(payload),
      payloadSize: safeJson(payload).length,
      target: payload.target ?? null,
      tool: payload.tool ?? null,
      reason: payload.reason ?? null,
      info: payload.info ?? null
    };
    L.buffers.events.push(row);
  }

  function logFeature1s(){
    if(!L.enabled) return;
    const { app } = getCtx();
    const st = app?.getState?.() || {};
    const row = {
      ...baseRow('features1s'),
      uvCount: numOrNull(st.metrics?.uvCount),
      swabCount: numOrNull(st.metrics?.swabCount),
      camCount: numOrNull(st.metrics?.camCount),
      cleanCount: numOrNull(st.metrics?.cleanCount),
      wrongTool: numOrNull(st.metrics?.wrongTool),
      falsePositives: numOrNull(st.metrics?.falsePositives),
      uniqueTargets: numOrNull(st.metrics?.uniqueTargets),
      shots: numOrNull(st.metrics?.shots),
      hits: numOrNull(st.metrics?.hits),
      misses: numOrNull(st.metrics?.misses),
      resourceUV: numOrNull(st.resources?.uv),
      resourceSwab: numOrNull(st.resources?.swab),
      resourceCam: numOrNull(st.resources?.cam),
      resourceClean: numOrNull(st.resources?.clean)
    };
    L.buffers.features1s.push(row);
  }

  function logSummary(summary = {}, extra = {}){
    if(!L.enabled) return;
    const row = {
      ...baseRow('summary'),
      phaseFinal: summary.phaseFinal ?? null,
      scoreFinal: summary.scoreFinal ?? null,
      stars: summary.stars ?? null,
      rank: summary.rank ?? null,
      riskDown: summary.riskDown ?? null,
      investigatedCount: summary.investigatedCount ?? null,
      reportSubmitted: summary.reportSubmitted ? 1 : 0,
      metricsJson: safeJson(summary.metrics),
      extraJson: safeJson(extra)
    };
    L.buffers.summary.push(row);
  }

  function logSessionEnd(extra = {}){
    if(!L.enabled) return;
    if(L.buffers.sessions.length) return;

    L.endedAt = isoNow();
    const { app } = getCtx();
    const st = app?.getState?.() || {};

    L.buffers.sessions.push({
      ...baseRow('session'),
      startedAt: L.startedAt,
      endedAt: L.endedAt,
      durationSec: null,
      finalScore: st.score ?? null,
      rank: extra.rank ?? null,
      stars: extra.stars ?? null,
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
    L.buffers = {
      sessions: [],
      events: [],
      features1s: [],
      summary: []
    };
    logEvent('session_start', {
      pid: P.pid,
      run: P.run,
      diff: P.diff,
      time: P.time,
      seed: P.seed,
      scene: P.scene,
      view: P.view
    });
  }

  function startFeatureLoop(){
    if(L._featTimer) clearInterval(L._featTimer);
    L._featTimer = setInterval(()=>{
      try{ logFeature1s(); }catch{}
    }, 1000);
  }

  function stopFeatureLoop(){
    if(L._featTimer){
      clearInterval(L._featTimer);
      L._featTimer = null;
    }
  }

  function csvEscape(v){
    if(v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  }

  function rowsToCsv(rows){
    if(!rows || !rows.length) return '';
    const cols = Array.from(rows.reduce((set, r)=>{
      Object.keys(r || {}).forEach(k => set.add(k));
      return set;
    }, new Set()));

    const head = cols.map(csvEscape).join(',');
    const body = rows.map(r => cols.map(c => csvEscape(r[c])).join(',')).join('\n');
    return head + '\n' + body;
  }

  function downloadText(filename, text, mime = 'text/csv;charset=utf-8'){
    const blob = new Blob([text], { type:mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=> URL.revokeObjectURL(url), 1000);
  }

  function exportCsv(kind){
    const rows = L.buffers[kind] || [];
    const csv = rowsToCsv(rows);
    const ts = isoNow().replace(/[:.]/g,'-');
    downloadText(`germ-detective_${kind}_${L.sessionId}_${ts}.csv`, csv);
  }

  function exportAll(){
    exportCsv('sessions');
    exportCsv('events');
    exportCsv('features1s');
    exportCsv('summary');
  }

  return {
    L,
    init,
    logEvent,
    logFeature1s,
    logSummary,
    logSessionEnd,
    startFeatureLoop,
    stopFeatureLoop,
    exportCsv,
    exportAll
  };
}