// === /fitness/teacher-dashboard.js ===
// Teacher Dashboard (local) — v20260211c (SUMMARY + EVENTS EXPORT)
(function(){
  'use strict';
  const WIN = window, DOC = document;
  if(!DOC) return;

  const $ = (s)=>DOC.querySelector(s);

  const body = $('#td-body');
  const msg  = $('#td-msg');

  const btnRefresh = $('#td-refresh');
  const btnCopy = $('#td-copy-csv');
  const btnDL = $('#td-dl-csv');
  const btnCopyEvents = $('#td-copy-events');
  const btnDLEvents = $('#td-dl-events');
  const btnClear = $('#td-clear');

  const fPid = $('#f-pid');
  const fGame = $('#f-game');
  const fPhase = $('#f-phase');
  const fGroup = $('#f-group');
  const fSort = $('#f-sort');
  const fLimit = $('#f-limit');

  const STORE_SUM = 'HHA_FITNESS_SUMMARY_LOG_V1';
  const STORE_EVT = 'HHA_FITNESS_EVENTS_LOG_V1';

  function setMsg(t){ if(msg) msg.textContent = t || ''; }

  function readJSON(key, fallback){
    try{
      const a = JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
      return a;
    }catch(_){ return fallback; }
  }

  function readSummary(){
    const a = readJSON(STORE_SUM, []);
    return Array.isArray(a) ? a : [];
  }
  function readEvents(){
    const a = readJSON(STORE_EVT, []);
    return Array.isArray(a) ? a : [];
  }

  function fmtTime(ts){
    if(!ts) return '-';
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2,'0');
    const mm = String(d.getMinutes()).padStart(2,'0');
    const ss = String(d.getSeconds()).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    const mo = String(d.getMonth()+1).padStart(2,'0');
    return `${dd}/${mo} ${hh}:${mm}:${ss}`;
  }
  function fmtMs(ms){
    if(!ms) return '-';
    const s = Math.round(ms/1000);
    if(s<60) return `${s}s`;
    const m = Math.floor(s/60), r = s%60;
    return `${m}m ${r}s`;
  }

  function esc(v){
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  }

  function summaryCSV(rows){
    const header = ['ts','pid','studyId','phase','conditionGroup','game','score','pass','total','maxStreak','ms','seed'];
    const lines = [header.join(',')];
    for(const r of rows){
      const vals = [
        r.ts, r.pid, r.studyId, r.phase, r.conditionGroup, r.game,
        r.score, r.pass, r.total, r.maxStreak, r.ms, r.seed
      ].map(esc);
      lines.push(vals.join(','));
    }
    return lines.join('\n');
  }

  function eventsCSV(rows){
    const header = ['ts','sid','pid','studyId','phase','conditionGroup','game','mode','view','seed','type','data_json'];
    const lines = [header.join(',')];
    for(const r of rows){
      const dataJson = JSON.stringify(r.data || {});
      const vals = [
        r.ts, r.sid, r.pid, r.studyId, r.phase, r.conditionGroup,
        r.game, r.mode, r.view, r.seed, r.type, dataJson
      ].map(esc);
      lines.push(vals.join(','));
    }
    return lines.join('\n');
  }

  function applyFilters(rows){
    const pid = (fPid?.value || '').trim().toUpperCase();
    const game = (fGame?.value || '').trim();
    const phase = (fPhase?.value || '').trim();
    const group = (fGroup?.value || '').trim().toUpperCase();

    let out = rows.slice();

    if(pid) out = out.filter(r => String(r.pid||'').toUpperCase().includes(pid));
    if(game) out = out.filter(r => String(r.game||'') === game);
    if(phase) out = out.filter(r => String(r.phase||'') === phase);
    if(group) out = out.filter(r => String(r.conditionGroup||'') === group);

    const sort = fSort?.value || 'ts_desc';
    out.sort((a,b)=>{
      if(sort==='pid_asc') return String(a.pid||'').localeCompare(String(b.pid||''));
      if(sort==='score_desc') return (Number(b.score||0)-Number(a.score||0));
      if(sort==='ms_desc') return (Number(b.ms||0)-Number(a.ms||0));
      return (Number(b.ts||0)-Number(a.ts||0));
    });

    const lim = Number(fLimit?.value || 0);
    if(Number.isFinite(lim) && lim>0) out = out.slice(0, lim);

    return out;
  }

  function pill(text, cls=''){
    return `<span class="pill ${cls}">${text}</span>`;
  }

  function render(){
    const rows = applyFilters(readSummary());
    if(!body) return;

    body.innerHTML = rows.map(r=>{
      const ratio = `${r.pass||0}/${r.total||0}`;
      const ok = (r.total>0) ? ((r.pass/r.total)>=0.6) : true;
      const cls = ok ? 'ok' : 'warn';
      return `
        <tr>
          <td>${fmtTime(r.ts)}</td>
          <td>${pill(r.pid || '-', cls)}</td>
          <td>${r.studyId || '-'}</td>
          <td>${r.phase || '-'}</td>
          <td>${r.conditionGroup || '-'}</td>
          <td>${r.game || '-'}</td>
          <td>${r.score ?? 0}</td>
          <td>${ratio}</td>
          <td>${r.maxStreak ?? 0}</td>
          <td>${fmtMs(r.ms)}</td>
          <td>${r.seed ?? 0}</td>
        </tr>
      `;
    }).join('');

    setMsg(`Summary: แสดง ${rows.length} แถว | Summary store: ${STORE_SUM} | Events store: ${STORE_EVT} (รวม events: ${readEvents().length})`);
  }

  async function copyText(txt, okMsg){
    try{
      await navigator.clipboard.writeText(txt);
      setMsg(okMsg);
    }catch(e){
      try{ WIN.prompt('Copy:', txt); }catch(_){}
      setMsg('เปิดกล่องให้คัดลอกแล้ว');
    }
  }

  function downloadText(fn, txt){
    const blob = new Blob([txt], { type:'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = DOC.createElement('a');
    a.href = url;
    a.download = fn;
    DOC.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function stamp(){
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}_${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}`;
  }

  btnRefresh?.addEventListener('click', render);

  btnCopy?.addEventListener('click', ()=>{
    const rows = applyFilters(readSummary());
    copyText(summaryCSV(rows), '📋 คัดลอก Summary CSV แล้ว');
  });

  btnDL?.addEventListener('click', ()=>{
    const rows = applyFilters(readSummary());
    downloadText(`fitness_summary_${stamp()}.csv`, summaryCSV(rows));
    setMsg('⬇️ ดาวน์โหลด Summary CSV แล้ว');
  });

  btnCopyEvents?.addEventListener('click', ()=>{
    const rows = readEvents(); // events ไม่ filter ตาม summary UI เพื่อไม่ให้หาย
    copyText(eventsCSV(rows), '📋 คัดลอก Events CSV แล้ว');
  });

  btnDLEvents?.addEventListener('click', ()=>{
    const rows = readEvents();
    downloadText(`fitness_events_${stamp()}.csv`, eventsCSV(rows));
    setMsg('⬇️ ดาวน์โหลด Events CSV แล้ว');
  });

  btnClear?.addEventListener('click', ()=>{
    if(!confirm('ล้างข้อมูล Summary+Events ในเครื่องนี้ทั้งหมด?')) return;
    localStorage.removeItem(STORE_SUM);
    localStorage.removeItem(STORE_EVT);
    render();
    setMsg('ล้างข้อมูลแล้ว');
  });

  [fPid,fGame,fPhase,fGroup,fSort,fLimit].forEach(el=>{
    el?.addEventListener('input', render);
    el?.addEventListener('change', render);
  });

  render();
})();