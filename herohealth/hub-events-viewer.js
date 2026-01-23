// === /herohealth/hub-events-viewer.js ===
// PACK AL — Events Viewer (Hydration + Hygiene)
// - Reads: HHA_LAST_SUMMARY + HHA_HYDRATION_EVENTS_LAST + HHA_HYGIENE_EVENTS_LAST
// - UI: Filter + Search + Copy JSON + Export CSV + Clear
// - Mobile friendly

(function(){
  'use strict';

  const HOST_ID = 'hhEvents';
  const KEY_SUM = 'HHA_LAST_SUMMARY';
  const KEY_HYDR = 'HHA_HYDRATION_EVENTS_LAST';
  const KEY_HYGI = 'HHA_HYGIENE_EVENTS_LAST';

  const $ = (sel)=>document.querySelector(sel);

  function loadJSON(key){
    try{ const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; }
    catch(_){ return null; }
  }
  function saveTextToClipboard(text){
    const t = String(text ?? '');
    return (navigator.clipboard && navigator.clipboard.writeText)
      ? navigator.clipboard.writeText(t).catch(()=>{})
      : new Promise((resolve)=>{
          try{
            const ta = document.createElement('textarea');
            ta.value = t;
            ta.style.position='fixed';
            ta.style.left='-9999px';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
            resolve();
          }catch(_){ resolve(); }
        });
  }
  function esc(s){
    return String(s ?? '').replace(/[&<>"']/g, (m)=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }
  function nowText(){
    try{ return new Date().toLocaleString('th-TH', { hour12:false }); }
    catch(_){ return new Date().toISOString(); }
  }

  function toCsv(rows){
    if(!rows || !rows.length) return '';
    const keys = new Set();
    rows.forEach(r=>{
      if(r && typeof r==='object') Object.keys(r).forEach(k=>keys.add(k));
    });
    const headers = Array.from(keys);
    const escCsv = (v)=>{
      if(v==null) return '';
      if(typeof v==='object') v = JSON.stringify(v);
      v = String(v);
      if(/[",\n]/.test(v)) v = `"${v.replace(/"/g,'""')}"`;
      return v;
    };
    const lines = [];
    lines.push(headers.map(escCsv).join(','));
    for(const r of rows){
      lines.push(headers.map(k=>escCsv(r ? r[k] : '')).join(','));
    }
    return lines.join('\n');
  }
  function downloadText(filename, content){
    try{
      const blob = new Blob([content], { type:'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=>URL.revokeObjectURL(url), 1500);
    }catch(_){}
  }

  function normalizeGameMode(sum){
    const g = String(sum?.gameMode || sum?.game || '').toLowerCase();
    if(g.includes('hygiene') || g.includes('handwash')) return 'hygiene';
    if(g.includes('hydration')) return 'hydration';
    return g || 'unknown';
  }

  function pickDefaultSource(){
    const sum = loadJSON(KEY_SUM);
    const g = normalizeGameMode(sum);

    // Prefer matching summary
    if(g==='hygiene' && localStorage.getItem(KEY_HYGI)) return 'hygiene';
    if(g==='hydration' && localStorage.getItem(KEY_HYDR)) return 'hydration';

    // Else prefer any existing
    if(localStorage.getItem(KEY_HYGI)) return 'hygiene';
    if(localStorage.getItem(KEY_HYDR)) return 'hydration';

    // fallback
    return 'hygiene';
  }

  function readPack(source){
    if(source==='hydration') return loadJSON(KEY_HYDR);
    return loadJSON(KEY_HYGI);
  }

  function classifyType(e){
    const t = String(e?.type||'').toLowerCase();
    // hygiene
    if(t.startsWith('boss_')) return 'boss';
    if(t==='step_hit' || t==='loop_complete') return 'steps';
    if(t==='haz_hit' || t==='haz_block') return 'haz';
    if(t==='soap_pick') return 'soap';
    // hydration (legacy)
    if(t.includes('storm')) return 'storm';
    if(t.includes('hit') || t.includes('shot') || t.includes('expire') || t.includes('block')) return 'play';
    if(t==='game_start' || t==='game_end' || t==='pause_toggle' || t==='events_saved') return 'system';
    return 'other';
  }

  function prettySource(src){
    return (src==='hydration') ? '💧 Hydration' : '🧼 Hygiene';
  }

  function render(){
    const host = document.getElementById(HOST_ID);
    if(!host) return;

    const srcDefault = pickDefaultSource();
    const pack0 = readPack(srcDefault);
    const sum = loadJSON(KEY_SUM);
    const gsum = normalizeGameMode(sum);

    host.innerHTML = `
      <style>
        #${HOST_ID}{ margin:14px 0 8px 0; }
        .hev-wrap{
          border:1px solid rgba(148,163,184,.18);
          background:rgba(2,6,23,.55);
          border-radius:18px;
          padding:14px;
          color:#e5e7eb;
          font-family:system-ui,-apple-system,Segoe UI,sans-serif;
        }
        .hev-top{ display:flex; flex-wrap:wrap; gap:10px; align-items:flex-start; justify-content:space-between; }
        .hev-title{ font-weight:900; font-size:16px; }
        .hev-sub{ opacity:.9; font-size:12px; line-height:1.35; margin-top:2px; }
        .hev-row{ display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; }
        .btn{
          border:1px solid rgba(148,163,184,.18);
          background:rgba(2,6,23,.55);
          color:#e5e7eb;
          border-radius:999px;
          padding:8px 10px;
          font-weight:850;
          cursor:pointer;
          user-select:none;
        }
        .btn:active{ transform: translateY(1px); }
        .pill{
          border:1px solid rgba(148,163,184,.18);
          background:rgba(15,23,42,.55);
          color:#e5e7eb;
          border-radius:999px;
          padding:7px 10px;
          font-weight:850;
          font-size:12px;
        }
        .sel, .inp{
          border:1px solid rgba(148,163,184,.18);
          background:rgba(15,23,42,.55);
          color:#e5e7eb;
          border-radius:12px;
          padding:9px 10px;
          font-weight:850;
          font-size:12px;
          outline:none;
        }
        .hev-table{
          width:100%;
          border-collapse:separate;
          border-spacing:0;
          margin-top:12px;
          overflow:hidden;
          border-radius:14px;
          border:1px solid rgba(148,163,184,.14);
          background: rgba(2,6,23,.30);
        }
        .hev-table th, .hev-table td{
          padding:10px 10px;
          border-bottom:1px solid rgba(148,163,184,.10);
          font-size:12px;
          vertical-align:top;
        }
        .hev-table th{
          text-align:left;
          opacity:.9;
          background:rgba(15,23,42,.55);
          font-weight:900;
        }
        .hev-table tr:last-child td{ border-bottom:none; }
        .hev-table tr:hover td{ background:rgba(15,23,42,.35); }
        .tag{
          display:inline-block;
          border:1px solid rgba(148,163,184,.18);
          background:rgba(2,6,23,.45);
          border-radius:999px;
          padding:4px 8px;
          font-weight:850;
          font-size:11px;
          opacity:.95;
          white-space:nowrap;
        }
        .tag.boss{ border-color: rgba(239,68,68,.28); background: rgba(239,68,68,.10); }
        .tag.steps{ border-color: rgba(34,197,94,.28); background: rgba(34,197,94,.10); }
        .tag.haz{ border-color: rgba(245,158,11,.28); background: rgba(245,158,11,.10); }
        .tag.soap{ border-color: rgba(34,211,238,.28); background: rgba(34,211,238,.10); }
        .tag.system{ border-color: rgba(167,139,250,.28); background: rgba(167,139,250,.10); }
        .muted{ opacity:.85; }
        .mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; }
        .hev-note{ margin-top:10px; opacity:.9; font-size:12px; line-height:1.35; }
        .hev-empty{
          margin-top:12px;
          border:1px dashed rgba(148,163,184,.20);
          border-radius:14px;
          padding:12px;
          opacity:.9;
          font-size:12px;
        }
        .pre{
          margin-top:10px;
          border:1px solid rgba(148,163,184,.14);
          background:rgba(2,6,23,.40);
          border-radius:14px;
          padding:10px;
          font-size:11px;
          line-height:1.35;
          max-height:240px;
          overflow:auto;
          display:none;
        }
      </style>

      <div class="hev-wrap">
        <div class="hev-top">
          <div>
            <div class="hev-title">🧾 Events Viewer (ล่าสุด)</div>
            <div class="hev-sub">
              อ่านเหตุการณ์จาก LocalStorage • แตะ “แถว” เพื่อ Copy JSON ของ event นั้น<br>
              Last summary: <b>${esc(gsum || '-')}</b> • เวลา: <span class="mono">${esc(nowText())}</span>
            </div>
          </div>
          <div class="hev-row">
            <button class="btn" id="evReload">↻ Reload</button>
            <button class="btn" id="evCopyPack">📋 Copy Pack</button>
            <button class="btn" id="evExportCsv">⬇ Export CSV</button>
            <button class="btn" id="evToggleRaw">🧬 Raw</button>
            <button class="btn" id="evClear">🧹 Clear LAST</button>
          </div>
        </div>

        <div class="hev-row">
          <select class="sel" id="evSource">
            <option value="hygiene">🧼 Hygiene (HHA_HYGIENE_EVENTS_LAST)</option>
            <option value="hydration">💧 Hydration (HHA_HYDRATION_EVENTS_LAST)</option>
          </select>

          <select class="sel" id="evFilter">
            <option value="all">All types</option>
            <option value="boss">boss_* (boss only)</option>
            <option value="steps">steps (step_hit / loop_complete)</option>
            <option value="haz">haz (haz_hit / haz_block)</option>
            <option value="soap">soap (soap_pick)</option>
            <option value="system">system (start/end/pause/save)</option>
            <option value="storm">storm (hydration)</option>
            <option value="play">play (hydration)</option>
            <option value="other">other</option>
          </select>

          <input class="inp" id="evSearch" placeholder="search: type / stepIdx / reason / text..." />

          <select class="sel" id="evLimit">
            <option value="80">แสดง 80</option>
            <option value="120" selected>แสดง 120</option>
            <option value="240">แสดง 240</option>
            <option value="9999">แสดงทั้งหมด</option>
          </select>

          <span class="pill" id="evMeta">loading…</span>
        </div>

        <div id="evBody"></div>
        <pre class="pre mono" id="evRaw"></pre>

        <div class="hev-note muted">
          Tip: อยากดูเฉพาะตอนบอส → Filter = <b>boss</b> • อยากดูยิงถูก/ผิด → Filter = <b>steps</b> •
          อยากดูพลาดโดนเชื้อ → Filter = <b>haz</b>
        </div>
      </div>
    `;

    // init controls
    const elSource = $('#evSource');
    const elFilter = $('#evFilter');
    const elSearch = $('#evSearch');
    const elLimit  = $('#evLimit');
    const elMeta   = $('#evMeta');
    const elBody   = $('#evBody');
    const elRaw    = $('#evRaw');

    // default select
    elSource.value = srcDefault;

    function readState(){
      return {
        source: elSource.value,
        filter: elFilter.value,
        q: (elSearch.value || '').trim().toLowerCase(),
        limit: Number(elLimit.value || 120)
      };
    }

    function summarize(pack){
      const meta = pack?.meta || {};
      const evs = pack?.events || [];
      const sid = meta.sessionId || '-';
      const game = meta.game || (elSource.value==='hydration'?'hydration':'hygiene');
      const diff = meta.diff || '-';
      const run  = meta.runMode || meta.run || '-';
      const view = meta.view || '-';
      const seed = (meta.seed!=null)? meta.seed : '-';
      elMeta.textContent = `${prettySource(elSource.value)} • ev=${evs.length} • sid=${sid} • ${run}/${diff}/${view} • seed=${seed} • game=${game}`;
    }

    function matchQuery(e, q){
      if(!q) return true;
      try{
        const t = JSON.stringify(e).toLowerCase();
        return t.includes(q);
      }catch(_){ return false; }
    }

    function renderTable(pack){
      const evs0 = Array.isArray(pack?.events) ? pack.events : [];
      summarize(pack);

      const st = readState();
      const rows = [];

      for(const e of evs0){
        const cat = classifyType(e);
        if(st.filter !== 'all' && cat !== st.filter) continue;
        if(!matchQuery(e, st.q)) continue;
        rows.push({ ...e, __cat: cat });
      }

      const lim = isFinite(st.limit) ? st.limit : 120;
      const evs = (lim>=9999) ? rows : rows.slice(0, lim);

      if(!evs.length){
        elBody.innerHTML = `
          <div class="hev-empty">
            ไม่มีข้อมูลที่ตรง filter/search ตอนนี้ 😶<br>
            ลองเปลี่ยน Source/Filter หรือเล่นเกมให้มี events ก่อน
          </div>
        `;
        elRaw.style.display = 'none';
        return;
      }

      // Build table
      const html = [];
      html.push(`<table class="hev-table" role="table" aria-label="events table">
        <thead>
          <tr>
            <th style="width:72px">t(s)</th>
            <th style="width:120px">type</th>
            <th style="width:92px">category</th>
            <th>details</th>
          </tr>
        </thead>
        <tbody>
      `);

      evs.forEach((e, idx)=>{
        const t = (e.t!=null) ? Number(e.t).toFixed(3) : (e.ts ? '' : '');
        const type = String(e.type || '-');
        const cat = e.__cat || 'other';

        // details: pick key fields to be human-readable
        const d = [];
        if(e.stepIdx!=null) d.push(`stepIdx=${e.stepIdx}`);
        if(e.ok===true) d.push(`ok=true`);
        if(e.ok===false) d.push(`ok=false`);
        if(e.wrongStepIdx!=null) d.push(`wrongStepIdx=${e.wrongStepIdx}`);
        if(e.rtMs!=null) d.push(`rtMs=${Math.round(e.rtMs)}`);
        if(e.combo!=null) d.push(`combo=${e.combo}`);
        if(e.hazHits!=null) d.push(`hazHits=${e.hazHits}`);
        if(e.soapPicked!=null) d.push(`soapPicked=${e.soapPicked}`);
        if(e.cleared!=null) d.push(`cleared=${e.cleared}`);
        if(e.reason) d.push(`reason=${e.reason}`);
        if(e.bossActive!=null) d.push(`bossActive=${e.bossActive}`);
        if(e.lockPx!=null) d.push(`lockPx=${e.lockPx}`);

        const det = d.length ? d.join(' • ') : '—';

        html.push(`
          <tr class="evRow" data-i="${idx}">
            <td class="mono">${esc(t)}</td>
            <td class="mono">${esc(type)}</td>
            <td><span class="tag ${esc(cat)}">${esc(cat)}</span></td>
            <td class="muted mono">${esc(det)}</td>
          </tr>
        `);
      });

      html.push(`</tbody></table>`);
      elBody.innerHTML = html.join('');

      // click row => copy JSON of that event
      elBody.querySelectorAll('.evRow').forEach((tr)=>{
        tr.addEventListener('click', async ()=>{
          const i = Number(tr.getAttribute('data-i')||0);
          const ev = evs[i];
          await saveTextToClipboard(JSON.stringify(ev, null, 2));
          // lightweight feedback
          tr.style.outline = '2px solid rgba(34,197,94,.35)';
          setTimeout(()=>{ tr.style.outline = 'none'; }, 380);
        }, { passive:true });
      });

      // raw panel reflect current filtered list (for quick inspect)
      elRaw.textContent = JSON.stringify({
        meta: pack?.meta || {},
        shown: evs.length,
        filter: st.filter,
        query: st.q,
        events: evs.map(({__cat, ...rest})=>rest)
      }, null, 2);
    }

    function reload(){
      const st = readState();
      const pack = readPack(st.source);
      renderTable(pack);
    }

    // bind controls
    $('#evReload').addEventListener('click', reload, { passive:true });

    elSource.addEventListener('change', ()=>{
      // auto preset filter per game
      if(elSource.value==='hygiene'){
        if(elFilter.value==='storm' || elFilter.value==='play') elFilter.value='all';
      }else{
        // hydration
        if(elFilter.value==='soap' || elFilter.value==='haz') elFilter.value='all';
      }
      reload();
    }, { passive:true });

    elFilter.addEventListener('change', reload, { passive:true });
    elLimit.addEventListener('change', reload, { passive:true });

    let st = 0;
    elSearch.addEventListener('input', ()=>{
      clearTimeout(st);
      st = setTimeout(reload, 120);
    }, { passive:true });

    $('#evCopyPack').addEventListener('click', async ()=>{
      const st = readState();
      const pack = readPack(st.source);
      await saveTextToClipboard(JSON.stringify(pack || {}, null, 2));
    }, { passive:true });

    $('#evExportCsv').addEventListener('click', ()=>{
      const st = readState();
      const pack = readPack(st.source);
      const evs = Array.isArray(pack?.events) ? pack.events : [];
      const filtered = evs
        .map(e=>({ ...e, category: classifyType(e) }))
        .filter(e=> (st.filter==='all' ? true : e.category===st.filter))
        .filter(e=> matchQuery(e, st.q));

      const csv = toCsv(filtered);
      const name = `HHA_${st.source}_events_${Date.now()}.csv`;
      downloadText(name, csv);
    }, { passive:true });

    $('#evToggleRaw').addEventListener('click', ()=>{
      elRaw.style.display = (elRaw.style.display==='block') ? 'none' : 'block';
    }, { passive:true });

    $('#evClear').addEventListener('click', ()=>{
      const st = readState();
      if(st.source==='hydration') localStorage.removeItem(KEY_HYDR);
      else localStorage.removeItem(KEY_HYGI);
      reload();
    }, { passive:true });

    // first render
    renderTable(pack0);

    // refresh on focus
    window.addEventListener('focus', reload);
  }

  // wait DOM
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();