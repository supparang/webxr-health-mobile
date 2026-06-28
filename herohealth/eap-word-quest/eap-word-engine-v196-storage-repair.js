/* =========================================================
   EAP Word Quest • Storage Repair + Log Compactor
   File: /herohealth/eap-word-quest/eap-word-engine-v196-storage-repair.js
   Version: v1.9.6-STORAGE-REPAIR-LOG-COMPACTOR-122

   Purpose:
   - Repair localStorage quota exhaustion caused by old dev/test state.
   - Preserve profile and compact Learning Logs for Teacher CSV workflow.
   - Remove only obsolete EAP Word Quest caches; never touch other games.
   - Keep Core state compact: no long run history or large nested results.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v1.9.6-STORAGE-REPAIR-LOG-COMPACTOR-122";
  const GROUP = "122";
  const LOG_KEY = "EAP_WORD_QUEST_LEARNING_LOGS_V182";
  const REPAIR_KEY = "EAP_WORD_QUEST_V196_STORAGE_REPAIR";

  if (window.__EAP_WORD_V196_STORAGE_REPAIR__) return;
  window.__EAP_WORD_V196_STORAGE_REPAIR__ = true;

  const norm = value => String(value == null ? "" : value).replace(/\s+/g," ").trim();
  const num = (value,fallback=0) => { const n=Number(value); return Number.isFinite(n) ? n : fallback; };

  function safeRead(key, fallback){
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch(err){ return fallback; }
  }

  function safeWrite(key,value){
    try { localStorage.setItem(key,JSON.stringify(value)); return true; }
    catch(err){ return false; }
  }

  function bytesOf(value){
    try { return new Blob([String(value || "")]).size; }
    catch(err){ return String(value || "").length * 2; }
  }

  function keyList(){
    const out=[];
    for(let i=0;i<localStorage.length;i+=1){
      const key=localStorage.key(i);
      if(key) out.push(key);
    }
    return out;
  }

  function eapStorageBytes(){
    return keyList().filter(key => key.startsWith("EAP_")).reduce((sum,key) => sum + bytesOf(localStorage.getItem(key)),0);
  }

  function compactLog(row){
    const source = row && typeof row === "object" ? row : {};
    const values = {
      logVersion: norm(source.logVersion).slice(0,60),
      source: norm(source.source).slice(0,60),
      course: norm(source.course || "EAP").slice(0,20),
      game: norm(source.game || "EAP Word Quest").slice(0,60),
      role: norm(source.role).slice(0,60),
      group: norm(source.group || source.section || GROUP).slice(0,20),
      section: norm(source.section || source.group || GROUP).slice(0,20),
      studentName: norm(source.studentName || source.name).slice(0,80),
      studentId: norm(source.studentId || source.id).slice(0,80),
      arcId: norm(source.arcId).slice(0,20),
      arc: norm(source.arc).slice(0,80),
      sessionId: norm(source.sessionId).slice(0,20),
      sessionTitle: norm(source.sessionTitle).slice(0,100),
      sessionType: norm(source.sessionType).slice(0,30),
      mode: norm(source.mode).slice(0,30),
      correct: Math.max(0,Math.round(num(source.correct))),
      total: Math.max(0,Math.round(num(source.total))),
      accuracy: Math.max(0,Math.min(100,Math.round(num(source.accuracy)))),
      xp: Math.max(0,Math.round(num(source.xp,source.score))),
      score: Math.max(0,Math.round(num(source.score,source.xp))),
      maxCombo: Math.max(0,Math.round(num(source.maxCombo))),
      passed: Boolean(source.passed),
      passThreshold: Math.max(0,Math.round(num(source.passThreshold))),
      passStatus: norm(source.passStatus).slice(0,60),
      displayStatus: norm(source.displayStatus).slice(0,60),
      bossHp: Math.max(0,Math.round(num(source.bossHp))),
      bossMaxHp: Math.max(0,Math.round(num(source.bossMaxHp))),
      hintUsed: Math.max(0,Math.round(num(source.hintUsed,source.hintsUsed))),
      aiDifficulty: norm(source.aiDifficulty).slice(0,20),
      aiPrediction: norm(source.aiPrediction).slice(0,120),
      weakWords: Array.isArray(source.weakWords) ? source.weakWords.map(v=>norm(v).slice(0,80)).filter(Boolean).slice(0,10) : [],
      itemTypeWeak: Array.isArray(source.itemTypeWeak) ? source.itemTypeWeak.map(v=>norm(v).slice(0,40)).filter(Boolean).slice(0,6) : [],
      levelWeak: Array.isArray(source.levelWeak) ? source.levelWeak.map(v=>norm(v).slice(0,30)).filter(Boolean).slice(0,6) : [],
      responseTimeAvg: Math.max(0,Math.round(num(source.responseTimeAvg)*10)/10),
      playedAt: norm(source.playedAt || source.endedAt || source.at || new Date().toISOString()),
      startedAt: norm(source.startedAt).slice(0,40),
      endedAt: norm(source.endedAt).slice(0,40),
      coreAligned: Boolean(source.coreAligned)
    };
    return values;
  }

  function logKey(row){
    return [norm(row.studentId),norm(row.sessionId),norm(row.playedAt),num(row.correct),num(row.total),norm(row.source)].join("|");
  }

  function compactLogs(limit=800){
    const current=safeRead(LOG_KEY,[]);
    if(!Array.isArray(current)) return {before:0,after:0,bytes:0};
    const seen=new Set();
    const compact=current.map(compactLog)
      .filter(row => row.sessionId || row.studentId)
      .sort((a,b)=>new Date(b.playedAt||0)-new Date(a.playedAt||0))
      .filter(row=>{const k=logKey(row); if(seen.has(k)) return false; seen.add(k); return true;})
      .slice(0,limit);
    localStorage.removeItem(LOG_KEY);
    let ok=safeWrite(LOG_KEY,compact);
    if(!ok){
      localStorage.removeItem(LOG_KEY);
      ok=safeWrite(LOG_KEY,compact.slice(0,250));
    }
    return {before:current.length,after:ok ? compact.length : 0,bytes:bytesOf(JSON.stringify(ok ? compact : [])),ok};
  }

  function isObsoleteKey(key){
    return [
      "EAP_WORD_QUEST_CORE_V192_STATE",
      "EAP_WORD_QUEST_CORE_V195_STATE",
      "EAP_WORD_QUEST_CORE_V195_REWARD_LEDGER",
      "EAP_CORE_AI_STATE_V195_",
      "EAP_CORE_AI_WEAK_V195_",
      "EAP_CORE_AI_RECENT_V195_",
      "EAP_WORD_QUEST_STATS_V160",
      "EAP_WORD_QUEST_STATS_V161",
      "EAP_WORD_QUEST_STATS_V01"
    ].some(prefix=>key.startsWith(prefix));
  }

  function repair(force=false){
    const before=eapStorageBytes();
    const marker=safeRead(REPAIR_KEY,{});
    const keys=keyList();
    let removed=[];

    /* Old state is only dev/test cache. Learning logs are compacted separately. */
    if(force || !marker.completed || before>450000){
      keys.filter(isObsoleteKey).forEach(key=>{
        localStorage.removeItem(key);
        removed.push(key);
      });
    }

    const logs=compactLogs(800);
    const report={version:VERSION,group:GROUP,beforeBytes:before,afterBytes:eapStorageBytes(),removed,logs,repairedAt:new Date().toISOString()};
    safeWrite(REPAIR_KEY,report);
    window.EAP_WORD_STORAGE_V196=report;
    return report;
  }

  function installLoggerCompactor(){
    const current=window.logEapWordQuestResult;
    if(typeof current!=="function" || current.__eapV196StorageWrapped) return false;
    const wrapped=function(payload){
      const result=current.call(this,compactLog(payload));
      setTimeout(()=>compactLogs(800),0);
      return result;
    };
    wrapped.__eapV196StorageWrapped=true;
    wrapped.__eapV196StorageOriginal=current;
    window.logEapWordQuestResult=wrapped;
    return true;
  }

  const report=repair(false);
  [0,120,500].forEach(delay=>setTimeout(installLoggerCompactor,delay));

  window.repairEapWordQuestStorageV196=()=>repair(true);
  window.getEapWordQuestStorageHealth=()=>({
    version:VERSION,
    eapBytes:eapStorageBytes(),
    report:window.EAP_WORD_STORAGE_V196 || safeRead(REPAIR_KEY,{})
  });

  console.info("[EAP Word Quest] v196 storage repair ready",report);
})();
