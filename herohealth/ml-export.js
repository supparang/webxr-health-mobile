/* === /herohealth/ml-export.js ===
HeroHealth ML/DL Exporter (LocalStorage → JSONL/CSV + Train/Val/Test split)
- Reads: HHA_SUMMARY_HISTORY (array of summaries)
- Expects: summary.mlTrace.samples (objects) + summary.mlTrace.events
- Deterministic split by hash(sessionId|seed|gameTag)
*/

(function(){
  'use strict';
  const DOC = document;
  const $ = (id)=>DOC.getElementById(id);

  const LS_HIST = 'HHA_SUMMARY_HISTORY';

  function logLine(s){
    const el = $('log');
    if(!el) return;
    el.textContent += (String(s) + '\n');
    el.scrollTop = el.scrollHeight;
  }
  function logClear(){ const el=$('log'); if(el) el.textContent=''; }

  function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }

  // FNV-1a 32-bit
  function hash32(str){
    str = String(str||'');
    let h = 2166136261 >>> 0;
    for(let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function parseSplit(s){
    const parts = String(s||'0.8,0.1,0.1').split(',').map(x=>Number(x.trim())||0);
    let a = clamp(parts[0]||0.8, 0.05, 0.95);
    let b = clamp(parts[1]||0.1, 0.02, 0.30);
    let c = clamp(parts[2]||0.1, 0.02, 0.30);
    const sum = a+b+c;
    a/=sum; b/=sum; c/=sum;
    return {a,b,c};
  }

  function splitOf(key, split){
    const u = (hash32(key) / 4294967296); // 0..1
    if (u < split.a) return 'train';
    if (u < split.a + split.b) return 'val';
    return 'test';
  }

  function downloadText(filename, text){
    const blob = new Blob([text], {type:'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = DOC.createElement('a');
    a.href = url;
    a.download = filename;
    DOC.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 800);
  }

  function toCSV(rows, columns){
    const esc = (v)=>{
      const s = (v==null)? '' : String(v);
      if(/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
      return s;
    };
    let out = columns.map(esc).join(',') + '\n';
    for(const r of rows){
      out += columns.map(c=>esc(r[c])).join(',') + '\n';
    }
    return out;
  }

  function readHistory(){
    try{
      const arr = JSON.parse(localStorage.getItem(LS_HIST) || '[]');
      return Array.isArray(arr) ? arr : [];
    }catch{
      return [];
    }
  }

  function pickMeta(summary, mlTrace){
    const meta = (mlTrace && mlTrace.meta) ? mlTrace.meta : {};
    return {
      projectTag: summary.projectTag || 'HeroHealth',
      gameTag: summary.gameTag || meta.gameTag || '',
      runMode: summary.runMode || meta.runMode || '',
      diff: summary.diff || meta.diff || '',
      seed: summary.seed || meta.seed || '',
      sessionId: summary.sessionId || meta.sessionId || '',
      startTimeIso: summary.startTimeIso || '',
      endTimeIso: summary.endTimeIso || '',
      view: summary.view || '',
      style: summary.style || '',
    };
  }

  function matchesFilters(meta, filters){
    if(filters.runMode !== 'any' && String(meta.runMode) !== filters.runMode) return false;
    if(filters.gameTag !== 'any' && String(meta.gameTag) !== filters.gameTag) return false;
    return true;
  }

  function flattenSample(meta, s, splitName){
    // keep as 1 row record for JSONL/CSV
    return Object.assign({
      split: splitName,
      sessionId: meta.sessionId,
      gameTag: meta.gameTag,
      runMode: meta.runMode,
      diff: meta.diff,
      seed: meta.seed,
      view: meta.view,
      style: meta.style,
      startTimeIso: meta.startTimeIso,
      endTimeIso: meta.endTimeIso,
    }, s);
  }

  function flattenEvent(meta, e, splitName){
    return Object.assign({
      split: splitName,
      sessionId: meta.sessionId,
      gameTag: meta.gameTag,
      runMode: meta.runMode,
      diff: meta.diff,
      seed: meta.seed,
      view: meta.view,
      style: meta.style,
    }, e);
  }

  function collect(filters, ignoreFilters){
    const hist = readHistory();
    const maxSessions = clamp(filters.maxSessions, 1, 9999);
    const split = parseSplit(filters.split);

    const sessions = [];
    for(const s of hist){
      if(!s || typeof s !== 'object') continue;
      if(!s.mlTrace || !s.mlTrace.samples || !Array.isArray(s.mlTrace.samples)) continue;
      const meta = pickMeta(s, s.mlTrace);

      if(!ignoreFilters && !matchesFilters(meta, filters)) continue;

      sessions.push({ summary: s, ml: s.mlTrace, meta });
      if(sessions.length >= maxSessions) break;
    }

    let nSamples=0, nEvents=0;
    const outSamples = { train:[], val:[], test:[] };
    const outEvents  = { train:[], val:[], test:[] };

    for(const it of sessions){
      const meta = it.meta;
      const key = `${meta.sessionId||''}|${meta.seed||''}|${meta.gameTag||''}`;
      const sp = splitOf(key, split);

      const samples = it.ml.samples || [];
      const events  = it.ml.events || [];

      for(const sm of samples){
        if(!sm || typeof sm !== 'object') continue;
        outSamples[sp].push(flattenSample(meta, sm, sp));
        nSamples++;
      }

      for(const ev of events){
        if(!ev || typeof ev !== 'object') continue;
        outEvents[sp].push(flattenEvent(meta, ev, sp));
        nEvents++;
      }
    }

    return { sessions, nSamples, nEvents, outSamples, outEvents };
  }

  function unionColumns(rows, cap=80){
    const set = new Set();
    for(const r of rows){
      Object.keys(r||{}).forEach(k=>set.add(k));
      if(set.size > cap) break;
    }
    // stable ordering: important first
    const head = [
      'split','sessionId','gameTag','runMode','diff','seed','view','style','startTimeIso','endTimeIso',
      'tMs','tLeft','score','combo','miss','pressure','acc','storm','mini','power',
      'last5s_hitRatePct','last5s_missCount','last5s_missStreak','deltaScore_1s',
      'y_next10s_miss','y_next10s_missCount',
      'type','bucket','riskPct','acc10Pct','miss10','reasons'
    ];
    const cols = [];
    for(const k of head) if(set.has(k)) cols.push(k);

    // then the rest (sorted)
    const rest = [...set].filter(k=>!cols.includes(k)).sort();
    return cols.concat(rest);
  }

  function scanUI(){
    const filters = {
      runMode: String($('runMode').value || 'any'),
      gameTag: String($('gameTag').value || 'any'),
      maxSessions: Number($('maxSessions').value || 200),
      split: String($('split').value || '0.8,0.1,0.1')
    };

    logClear();
    logLine('🔎 Scan...');
    const res = collect(filters, false);

    $('kSessions').textContent = String(res.sessions.length);
    $('kSamples').textContent  = String(res.nSamples);
    $('kEvents').textContent   = String(res.nEvents);

    $('kTrain').textContent = String(res.outSamples.train.length);
    $('kVal').textContent   = String(res.outSamples.val.length);
    $('kTest').textContent  = String(res.outSamples.test.length);

    logLine(`Sessions: ${res.sessions.length}`);
    logLine(`Samples:  ${res.nSamples}  (train=${res.outSamples.train.length}, val=${res.outSamples.val.length}, test=${res.outSamples.test.length})`);
    logLine(`Events:   ${res.nEvents}`);
    logLine('✅ พร้อม Export');
  }

  function exportUI(ignoreFilters){
    const filters = {
      runMode: String($('runMode').value || 'any'),
      gameTag: String($('gameTag').value || 'any'),
      maxSessions: Number($('maxSessions').value || 200),
      split: String($('split').value || '0.8,0.1,0.1')
    };

    logClear();
    logLine('⬇️ Export...');
    const res = collect(filters, !!ignoreFilters);

    // Merge splits to one list for CSV convenience (still has split column)
    const samplesAll = [].concat(res.outSamples.train, res.outSamples.val, res.outSamples.test);
    const eventsAll  = [].concat(res.outEvents.train,  res.outEvents.val,  res.outEvents.test);

    const stamp = new Date().toISOString().replace(/[:.]/g,'-');

    // JSONL split files
    function jsonl(arr){ return arr.map(o=>JSON.stringify(o)).join('\n') + (arr.length?'\n':''); }

    downloadText(`hha_samples_train_${stamp}.jsonl`, jsonl(res.outSamples.train));
    downloadText(`hha_samples_val_${stamp}.jsonl`,   jsonl(res.outSamples.val));
    downloadText(`hha_samples_test_${stamp}.jsonl`,  jsonl(res.outSamples.test));

    downloadText(`hha_events_train_${stamp}.jsonl`, jsonl(res.outEvents.train));
    downloadText(`hha_events_val_${stamp}.jsonl`,   jsonl(res.outEvents.val));
    downloadText(`hha_events_test_${stamp}.jsonl`,  jsonl(res.outEvents.test));

    // CSV (merged)
    const colsS = unionColumns(samplesAll, 120);
    const colsE = unionColumns(eventsAll,  120);
    downloadText(`hha_samples_all_${stamp}.csv`, toCSV(samplesAll, colsS));
    downloadText(`hha_events_all_${stamp}.csv`,  toCSV(eventsAll, colsE));

    // Small manifest
    const manifest = {
      schema: 'HHA_EXPORT_V1',
      createdIso: new Date().toISOString(),
      filters: ignoreFilters ? { ignore:true } : filters,
      sessions: res.sessions.length,
      samples: {
        train: res.outSamples.train.length,
        val:   res.outSamples.val.length,
        test:  res.outSamples.test.length,
        total: samplesAll.length
      },
      events: {
        train: res.outEvents.train.length,
        val:   res.outEvents.val.length,
        test:  res.outEvents.test.length,
        total: eventsAll.length
      }
    };
    downloadText(`hha_export_manifest_${stamp}.json`, JSON.stringify(manifest,null,2));

    // UI counters
    $('kSessions').textContent = String(res.sessions.length);
    $('kSamples').textContent  = String(samplesAll.length);
    $('kEvents').textContent   = String(eventsAll.length);
    $('kTrain').textContent = String(res.outSamples.train.length);
    $('kVal').textContent   = String(res.outSamples.val.length);
    $('kTest').textContent  = String(res.outSamples.test.length);

    logLine(`✅ Exported: sessions=${res.sessions.length}, samples=${samplesAll.length}, events=${eventsAll.length}`);
    logLine(`- JSONL: train/val/test`);
    logLine(`- CSV: samples_all, events_all`);
    logLine(`- manifest.json`);
  }

  function clearHistory(){
    const ok = confirm('ล้าง HHA_SUMMARY_HISTORY ในเครื่องนี้เท่านั้นนะ? (ย้อนกลับไม่ได้)');
    if(!ok) return;
    try{ localStorage.removeItem(LS_HIST); }catch{}
    scanUI();
  }

  function bind(){
    $('btnScan').addEventListener('click', scanUI);
    $('btnExport').addEventListener('click', ()=>exportUI(false));
    $('btnExportAll').addEventListener('click', ()=>exportUI(true));
    $('btnClear').addEventListener('click', clearHistory);
    scanUI();
  }

  if(DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', bind);
  else bind();
})();