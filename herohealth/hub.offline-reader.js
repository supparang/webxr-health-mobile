// === /herohealth/hub.offline-reader.js ===
// Hub Offline Reader Pack — v20260217a
// Reads:
//  - HHA_LAST_SUMMARY
//  - HHA_GD_OFFLINE_LOGS_V1  (sessions/events)
// Adds UI panel to hub page (safe, no deps)

(function(){
  'use strict';

  const DOC = document;
  const WIN = window;

  const KEY_LAST = 'HHA_LAST_SUMMARY';
  const KEY_GD   = 'HHA_GD_OFFLINE_LOGS_V1';

  if(WIN.__HHA_HUB_OFFLINE_READER__) return;
  WIN.__HHA_HUB_OFFLINE_READER__ = true;

  function safeParse(raw, fallback=null){
    try{ return JSON.parse(raw); }catch(_){ return fallback; }
  }

  function loadJSON(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      if(!raw) return fallback;
      return safeParse(raw, fallback);
    }catch(_){
      return fallback;
    }
  }

  function toast(msg){
    try{
      const t = DOC.createElement('div');
      t.textContent = msg;
      t.style.cssText = `
        position:fixed; left:50%; bottom:18px; transform:translateX(-50%);
        background: rgba(0,0,0,.45);
        border:1px solid rgba(148,163,184,.22);
        padding:10px 12px;
        border-radius:999px;
        color: rgba(229,231,235,.96);
        font: 900 12px/1 system-ui, -apple-system, "Noto Sans Thai", Segoe UI, Roboto, sans-serif;
        z-index: 99999;
        backdrop-filter: blur(10px);
      `;
      DOC.body.appendChild(t);
      setTimeout(()=>{ try{ t.remove(); }catch(_){} }, 900);
    }catch(_){}
  }

  function downloadText(filename, text, mime='text/plain'){
    const blob = new Blob([text], { type: mime+';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = DOC.createElement('a');
    a.href = url;
    a.download = filename;
    DOC.body.appendChild(a);
    a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 0);
  }

  function csvEscape(v){
    const s = String(v ?? '');
    return /[,"\n]/.test(s) ? ('"' + s.replace(/"/g,'""') + '"') : s;
  }

  function toCSV(rows, headers){
    const out = [];
    out.push(headers.map(csvEscape).join(','));
    for(const r of rows){
      out.push(headers.map(h => csvEscape(r[h])).join(','));
    }
    return out.join('\n');
  }

  function ensureStyle(){
    if(DOC.getElementById('hha-hub-offline-style')) return;
    const st = DOC.createElement('style');
    st.id = 'hha-hub-offline-style';
    st.textContent = `
      .hha-offline-card{
        border: 1px solid rgba(148,163,184,.18);
        background: rgba(10,16,36,.40);
        border-radius: 16px;
        padding: 12px;
        margin: 10px 0;
        backdrop-filter: blur(10px);
      }
      .hha-offline-card h3{
        margin:0 0 8px;
        font: 950 14px/1.2 system-ui, -apple-system, "Noto Sans Thai", Segoe UI, Roboto, sans-serif;
        color: rgba(229,231,235,.96);
      }
      .hha-offline-row{ display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
      .hha-offline-btn{
        appearance:none;
        border:none;
        border-radius: 999px;
        padding: 10px 12px;
        background: rgba(2,6,23,.70);
        border: 1px solid rgba(148,163,184,.22);
        color: rgba(229,231,235,.96);
        font: 950 12px/1 system-ui, -apple-system, "Noto Sans Thai", Segoe UI, Roboto, sans-serif;
        cursor:pointer;
        user-select:none;
        -webkit-tap-highlight-color: transparent;
      }
      .hha-offline-btn:active{ transform: translateY(1px); }
      .hha-offline-kv{
        margin-top:8px;
        display:grid;
        grid-template-columns: 130px 1fr;
        gap: 6px 10px;
        font: 800 12px/1.3 system-ui, -apple-system, "Noto Sans Thai", Segoe UI, Roboto, sans-serif;
        color: rgba(229,231,235,.86);
      }
      .hha-offline-kv div:nth-child(odd){ color: rgba(229,231,235,.65); }
      .hha-offline-pre{
        margin-top:8px;
        padding:10px;
        border-radius:12px;
        border:1px solid rgba(148,163,184,.16);
        background: rgba(255,255,255,.03);
        color: rgba(229,231,235,.86);
        font: 650 12px/1.35 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        white-space: pre-wrap;
        max-height: 220px;
        overflow:auto;
      }
    `;
    DOC.head.appendChild(st);
  }

  function findMount(){
    // Try common containers; fallback to body top
    return DOC.querySelector('#hubWrap') ||
           DOC.querySelector('#hub') ||
           DOC.querySelector('main') ||
           DOC.body;
  }

  function fmt(v){
    if(v === null || v === undefined) return '';
    if(typeof v === 'number') return String(v);
    return String(v);
  }

  function buildPanel(){
    ensureStyle();

    const mount = findMount();
    const card = DOC.createElement('section');
    card.className = 'hha-offline-card';
    card.id = 'hhaOfflineCard';

    card.innerHTML = `
      <h3>📦 Offline Logs (LocalStorage)</h3>

      <div class="hha-offline-row">
        <button class="hha-offline-btn" id="hhaBtnLastSummary">ดูสรุปล่าสุด</button>
        <button class="hha-offline-btn" id="hhaBtnGDJson">Export GermDetective JSON</button>
        <button class="hha-offline-btn" id="hhaBtnGDEventsCsv">Export GD Events CSV</button>
        <button class="hha-offline-btn" id="hhaBtnGDSessionsCsv">Export GD Sessions CSV</button>
        <button class="hha-offline-btn" id="hhaBtnGDClear">Clear GD Logs</button>
      </div>

      <div class="hha-offline-kv" id="hhaOfflineKV"></div>
      <div class="hha-offline-pre" id="hhaOfflinePreview" style="display:none;"></div>
    `;

    // Insert near top (but not before header)
    try{
      const firstCard = mount.querySelector?.('section, .card, .panel');
      if(firstCard && firstCard.parentNode){
        firstCard.parentNode.insertBefore(card, firstCard.nextSibling);
      }else{
        mount.insertBefore(card, mount.firstChild);
      }
    }catch(_){
      mount.appendChild(card);
    }

    wireUI();
    refreshKV();
  }

  function refreshKV(){
    const kv = DOC.getElementById('hhaOfflineKV');
    if(!kv) return;

    const last = loadJSON(KEY_LAST, null);
    const gd = loadJSON(KEY_GD, { v:1, sessions:[], events:[] });

    const lastGame = last?.game || last?.ctx?.game || '';
    const lastTs = last?.ts || '';
    const lastReason = last?.reason || '';

    const gdEvents = Array.isArray(gd?.events) ? gd.events.length : 0;
    const gdSessions = Array.isArray(gd?.sessions) ? gd.sessions.length : 0;

    const latestSess = gd?.sessions?.[0] || null;

    kv.innerHTML = '';
    const items = [
      ['Last summary game', lastGame || '—'],
      ['Last summary ts', lastTs || '—'],
      ['Last summary reason', lastReason || '—'],
      ['GD events', gdEvents],
      ['GD sessions', gdSessions],
      ['GD last session', latestSess ? `${latestSess.ts || ''} • ${latestSess.reason || ''} • grade ${latestSess.report?.grade || '-'}` : '—'],
    ];

    for(const [k,v] of items){
      const a = DOC.createElement('div'); a.textContent = k;
      const b = DOC.createElement('div'); b.textContent = fmt(v);
      kv.appendChild(a); kv.appendChild(b);
    }
  }

  function showPreview(obj){
    const pre = DOC.getElementById('hhaOfflinePreview');
    if(!pre) return;
    pre.style.display = 'block';
    pre.textContent = JSON.stringify(obj, null, 2);
  }

  function exportGDJson(){
    const gd = loadJSON(KEY_GD, { v:1, sessions:[], events:[] });
    downloadText(`germ-detective-offline-${Date.now()}.json`, JSON.stringify(gd, null, 2), 'application/json');
  }

  function exportGDEventsCSV(){
    const gd = loadJSON(KEY_GD, { v:1, sessions:[], events:[] });
    const rows = (gd.events || []).slice().reverse().map(e=>({
      ts: e.ts,
      game: e.game,
      session_id: e.session_id,
      pid: e.pid,
      run: e.run,
      view: e.view,
      diff: e.diff,
      seed: e.seed,
      name: e.name,
      payload_json: JSON.stringify(e.payload || {})
    }));
    const headers = ['ts','game','session_id','pid','run','view','diff','seed','name','payload_json'];
    downloadText(`germ-detective-events-${Date.now()}.csv`, toCSV(rows, headers), 'text/csv');
  }

  function exportGDSessionsCSV(){
    const gd = loadJSON(KEY_GD, { v:1, sessions:[], events:[] });
    const rows = (gd.sessions || []).slice().reverse().map(s=>({
      ts: s.ts,
      game: s.game,
      session_id: s.session_id,
      pid: s.pid,
      run: s.run,
      view: s.view,
      diff: s.diff,
      seed: s.seed,
      reason: s.reason,
      timeLeft: s.timeLeft,
      score: s.score,
      alert: s.alert,
      evidenceCount: s.evidenceCount,
      report_grade: s.report?.grade ?? '',
      report_total: s.report?.total ?? '',
      report_json: JSON.stringify(s.report || {}),
      ctx_json: JSON.stringify(s.ctx || {})
    }));
    const headers = ['ts','game','session_id','pid','run','view','diff','seed','reason','timeLeft','score','alert','evidenceCount','report_grade','report_total','report_json','ctx_json'];
    downloadText(`germ-detective-sessions-${Date.now()}.csv`, toCSV(rows, headers), 'text/csv');
  }

  function clearGD(){
    try{
      localStorage.removeItem(KEY_GD);
      toast('ล้าง GD logs แล้ว');
    }catch(_){}
    refreshKV();
    const pre = DOC.getElementById('hhaOfflinePreview');
    if(pre) pre.style.display = 'none';
  }

  function wireUI(){
    const btnLast = DOC.getElementById('hhaBtnLastSummary');
    const btnJ = DOC.getElementById('hhaBtnGDJson');
    const btnE = DOC.getElementById('hhaBtnGDEventsCsv');
    const btnS = DOC.getElementById('hhaBtnGDSessionsCsv');
    const btnC = DOC.getElementById('hhaBtnGDClear');

    if(btnLast) btnLast.onclick = ()=>{
      const last = loadJSON(KEY_LAST, null);
      if(!last){ toast('ยังไม่มี HHA_LAST_SUMMARY'); return; }
      showPreview(last);
      toast('แสดงสรุปล่าสุดแล้ว');
    };

    if(btnJ) btnJ.onclick = ()=> { exportGDJson(); toast('Export JSON แล้ว'); };
    if(btnE) btnE.onclick = ()=> { exportGDEventsCSV(); toast('Export Events CSV แล้ว'); };
    if(btnS) btnS.onclick = ()=> { exportGDSessionsCSV(); toast('Export Sessions CSV แล้ว'); };
    if(btnC) btnC.onclick = ()=> { clearGD(); };
  }

  function init(){
    try{ buildPanel(); }catch(_){}
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', init, { once:true });
  }else{
    init();
  }

})();