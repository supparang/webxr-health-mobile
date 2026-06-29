/* EAP Hero – Student Result Bridge v1
   Safe by default: no network request is sent until EAP_SHEET_CONFIG.webAppUrl is configured.
   Tracks completed skill evidence in EAP_HERO_PROGRESS_V3 and queues unique records locally.
*/
(() => {
  'use strict';

  const STORAGE_KEY = 'EAP_HERO_PROGRESS_V3';
  const QUEUE_KEY = 'EAP_HERO_SHEET_QUEUE_V1';
  const SENT_KEY = 'EAP_HERO_SHEET_SENT_V1';
  const CONFIG = Object.assign({
    webAppUrl: '',
    section: '122',
    course: 'EAP Hero: Save the Society',
    enabled: false
  }, window.EAP_SHEET_CONFIG || {});

  const safeJson = (raw, fallback) => { try { return JSON.parse(raw); } catch (_) { return fallback; } };
  const uid = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
  const read = (key, fallback) => safeJson(localStorage.getItem(key), fallback);
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const num = (x, fallback = 0) => Number.isFinite(Number(x)) ? Number(x) : fallback;
  const bool = (x) => x === true || String(x).toLowerCase() === 'true' || String(x) === '1';

  function state(){ return read(STORAGE_KEY, {}); }
  function profile(s){
    const p = s.profile || s.player || s.student || {};
    return {
      studentId: String(p.studentId || p.id || s.studentId || s.playerId || 'guest'),
      studentName: String(p.studentName || p.name || s.studentName || s.playerName || 'Guest'),
      section: String(p.section || s.section || CONFIG.section || '122')
    };
  }
  function sessionTitle(sessionId, s){
    const sessions = s.sessions || s.sessionData || {};
    const item = Array.isArray(sessions) ? sessions.find(x => String(x.id) === String(sessionId)) : sessions[sessionId];
    return String(item?.title || item?.name || s?.sessionTitles?.[sessionId] || '');
  }
  function maybePush(value, out, p, sessionId, skill){
    if (!value || typeof value !== 'object') return;
    const score = num(value.score ?? value.bestScore ?? value.points, 0);
    const accuracy = num(value.accuracy ?? value.accPct, 0);
    const legacy = bool(value.legacyCompletion || value.legacy || value.completedLegacy);
    const passed = bool(value.passed || value.pass || value.completed) || legacy || score >= 60;
    const evidence = value.evidence || value.evidenceItems || value.items || [];
    const id = [p.studentId, sessionId, skill, score, accuracy, legacy ? 'legacy' : 'score', value.updatedAt || value.completedAt || ''].join('|');
    out.push({
      action: 'submit_attempt',
      dedupeKey: id,
      attemptId: value.attemptId || uid('eap'),
      studentId: p.studentId,
      studentName: p.studentName,
      section: p.section,
      sessionId: String(sessionId),
      sessionTitle: sessionTitle(sessionId, state()),
      skill: String(skill),
      level: String(value.level || value.difficulty || 'A2–B1+'),
      score, accuracy,
      passMark: 60,
      passed,
      evidenceType: legacy ? 'legacy_completion' : 'mission',
      legacyCompletion: legacy,
      attemptNo: num(value.attemptNo || value.attempts || 1, 1),
      replay: bool(value.replay),
      hintUsed: num(value.hintUsed || value.helpUsed),
      durationSec: num(value.durationSec || value.usedTime),
      maxCombo: num(value.maxCombo),
      wrongItems: value.wrongItems || [],
      misconceptions: value.misconceptions || [],
      reflection: String(value.reflection || ''),
      appVersion: String(window.EAP_HERO_VERSION || window.APP_VERSION || ''),
      clientTimestamp: new Date().toISOString(),
      sourceUrl: location.href,
      evidenceCount: Array.isArray(evidence) ? evidence.length : num(value.evidenceCount)
    });
  }
  function collect(){
    const s = state();
    const p = profile(s);
    const records = [];
    const roots = [s.skillEvidence, s.evidenceBySkill, s.portfolio, s.progress?.skills, s.sessionsProgress, s.results].filter(Boolean);
    roots.forEach(root => {
      if (Array.isArray(root)) {
        root.forEach(x => maybePush(x, records, p, x.sessionId || x.session || '', x.skill || x.skillId || ''));
      } else if (typeof root === 'object') {
        Object.entries(root).forEach(([sessionId, group]) => {
          if (group && typeof group === 'object' && !Array.isArray(group)) {
            const keys = Object.keys(group);
            const looksLikeSkills = keys.some(k => /reading|writing|listening|speaking/i.test(k));
            if (looksLikeSkills) keys.forEach(skill => maybePush(group[skill], records, p, sessionId, skill));
            else maybePush(group, records, p, group.sessionId || sessionId, group.skill || '');
          }
        });
      }
    });
    return records.filter(r => r.sessionId && r.skill);
  }
  function queueFromState(){
    const sent = new Set(read(SENT_KEY, []));
    const queue = read(QUEUE_KEY, []);
    const existing = new Set(queue.map(x => x.dedupeKey));
    collect().forEach(item => {
      if (!sent.has(item.dedupeKey) && !existing.has(item.dedupeKey)) queue.push(item);
    });
    write(QUEUE_KEY, queue.slice(-300));
    return queue;
  }
  async function flush(){
    const queue = queueFromState();
    if (!CONFIG.enabled || !CONFIG.webAppUrl) return { ok:false, pending:queue.length, reason:'not_configured' };
    const sent = new Set(read(SENT_KEY, []));
    const remaining = [];
    for (const item of queue) {
      try {
        const res = await fetch(CONFIG.webAppUrl, { method:'POST', mode:'no-cors', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify(item) });
        sent.add(item.dedupeKey);
      } catch (_) { remaining.push(item); }
    }
    write(SENT_KEY, [...sent].slice(-1000));
    write(QUEUE_KEY, remaining);
    return { ok:true, sent:queue.length - remaining.length, pending:remaining.length };
  }
  window.EAPSheetBridge = {
    config: CONFIG,
    collect,
    queueFromState,
    flush,
    status: () => ({ configured:!!(CONFIG.enabled && CONFIG.webAppUrl), pending:read(QUEUE_KEY,[]).length })
  };

  window.addEventListener('storage', e => { if (e.key === STORAGE_KEY) { queueFromState(); flush(); } });
  window.addEventListener('online', () => flush());
  setTimeout(() => { queueFromState(); flush(); }, 1200);
})();
