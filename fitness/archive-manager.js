// === /fitness/archive-manager.js ===
// Archive Manager — v20260211c (MERGE + META headers)
(function(){
  'use strict';
  const WIN = window, DOC = document;
  if(!DOC) return;
  const $ = (s)=>DOC.querySelector(s);

  const listEl = $('#am-list');
  const msgEl  = $('#am-msg');
  const noteEl = $('#am-note');

  const qEl = $('#q');
  const sortEl = $('#sort');
  const modeEl = $('#mode');
  const limitEl= $('#limit');

  const btnRefresh = $('#am-refresh');
  const btnExportIndex = $('#am-export-index');
  const btnWipeAll = $('#am-wipe-all');

  // merge UI
  const cbUseSelected = $('#m-use-selected');
  const cbDedup = $('#m-dedup');
  const cbIncludeMeta = $('#m-include-meta');
  const btnMerge = $('#m-merge-download');

  const ARCHIVE_KEY = 'HHA_ARCHIVE_INDEX_V1';
  const ARCHIVE_PREFIX = 'HHA_ARCHIVE_';

  const SELECTED_KEY = 'HHA_ARCHIVE_SELECTED_V1';

  function setMsg(t){ if(msgEl) msgEl.textContent = t || ''; }
  function setNote(t){ if(noteEl) noteEl.textContent = t || ''; }

  function readJSON(key, fallback){
    try{
      const v = JSON.parse(localStorage.getItem(key) || 'null');
      return (v==null ? fallback : v);
    }catch(_){ return fallback; }
  }

  function getIndex(){
    const idx = readJSON(ARCHIVE_KEY, []);
    return Array.isArray(idx) ? idx : [];
  }

  function getArchive(id){
    return readJSON(ARCHIVE_PREFIX + id, null);
  }

  function saveIndex(idx){
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(idx));
  }

  function removeArchive(id){
    localStorage.removeItem(ARCHIVE_PREFIX + id);
    const idx = getIndex().filter(x => x.id !== id);
    saveIndex(idx);
  }

  function getSelected(){
    const a = readJSON(SELECTED_KEY, []);
    return new Set(Array.isArray(a) ? a : []);
  }
  function saveSelected(set){
    try{ localStorage.setItem(SELECTED_KEY, JSON.stringify(Array.from(set))); }catch(_){}
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

  function esc(v){
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  }

  function downloadText(filename, text, mime='text/csv;charset=utf-8'){
    const blob = new Blob([text], { type:mime });
    const url = URL.createObjectURL(blob);
    const a = DOC.createElement('a');
    a.href = url;
    a.download = filename;
    DOC.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function chip(text, cls=''){
    return `<span class="chip ${cls}">${text}</span>`;
  }

  function matchesQuery(arch, q){
    if(!q) return true;
    const s = q.toLowerCase();
    const f = arch.filters || {};
    const hay = [
      arch.id,
      f.xStudy, f.pid, f.phase, f.group, f.game,
      ...(arch.summary||[]).slice(0,5).map(r=>r.pid),
      ...(arch.summary||[]).slice(0,5).map(r=>r.studyId),
      ...(arch.summary||[]).slice(0,5).map(r=>r.siteCode),
      ...(arch.summary||[]).slice(0,5).map(r=>r.classRoom),
    ].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(s);
  }

  function getCounts(arch){
    const sumN = Array.isArray(arch.summary) ? arch.summary.length : 0;
    const evtN = Array.isArray(arch.events) ? arch.events.length : 0;
    return { sumN, evtN, total: sumN+evtN };
  }

  function applyListFilters(list){
    const q = (qEl?.value || '').trim();
    const mode = modeEl?.value || 'all';
    const lim = Number(limitEl?.value || 0);

    let out = list.slice().map(x=>{
      const arch = getArchive(x.id);
      return { idx:x, arch };
    }).filter(x => x.arch && matchesQuery(x.arch, q));

    out = out.filter(x=>{
      const { total } = getCounts(x.arch);
      if(mode==='small') return total < 2000;
      if(mode==='big') return total >= 2000;
      return true;
    });

    const sort = sortEl?.value || 'ts_desc';
    out.sort((a,b)=>{
      const at = Number(a.arch.ts||0), bt = Number(b.arch.ts||0);
      if(sort==='ts_asc') return at-bt;
      if(sort==='sum_desc') return getCounts(b.arch).sumN - getCounts(a.arch).sumN;
      if(sort==='evt_desc') return getCounts(b.arch).evtN - getCounts(a.arch).evtN;
      return bt-at;
    });

    if(Number.isFinite(lim) && lim>0) out = out.slice(0, lim);
    return out;
  }

  // -------- CSV builders (META COMPLETE) --------
  function summaryCSV(rows){
    const header = [
      'ts','pid','studyId','phase','conditionGroup',
      'schoolName','siteCode','classRoom','teacherId','deviceType',
      'game','score','pass','total','maxStreak','ms','seed'
    ];
    const lines = [header.join(',')];
    for(const r of (rows||[])){
      lines.push([
        r.ts, r.pid, r.studyId, r.phase, r.conditionGroup,
        r.schoolName||'', r.siteCode||'', r.classRoom||'', r.teacherId||'', r.deviceType||'',
        r.game, r.score, r.pass, r.total, r.maxStreak, r.ms, r.seed
      ].map(esc).join(','));
    }
    return lines.join('\n');
  }

  function eventsCSV(rows){
    const header = [
      'ts','sid','pid','studyId','phase','conditionGroup',
      'schoolName','siteCode','classRoom','teacherId','deviceType',
      'game','mode','view','seed','type','data_json'
    ];
    const lines = [header.join(',')];
    for(const r of (rows||[])){
      const dataJson = JSON.stringify(r.data || {});
      lines.push([
        r.ts, r.sid, r.pid, r.studyId, r.phase, r.conditionGroup,
        r.schoolName||'', r.siteCode||'', r.classRoom||'', r.teacherId||'', r.deviceType||'',
        r.game, r.mode, r.view, r.seed, r.type, dataJson
      ].map(esc).join(','));
    }
    return lines.join('\n');
  }

  function stamp(){
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}_${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}`;
  }

  // -------- selection + render --------
  function render(){
    const idx = getIndex();
    const items = applyListFilters(idx);
    const totalArchives = idx.length;
    const shown = items.length;

    let sumTotal=0, evtTotal=0;
    for(const it of items){
      const c = getCounts(it.arch);
      sumTotal += c.sumN; evtTotal += c.evtN;
    }
    setNote(`Archives: ทั้งหมด ${totalArchives} | แสดง ${shown} | (แสดงผลรวม: summary ${sumTotal}, events ${evtTotal})`);

    if(!listEl) return;
    const selected = getSelected();

    if(!items.length){
      listEl.innerHTML = '';
      setMsg('ไม่พบ archive ตามเงื่อนไข');
      return;
    }

    listEl.innerHTML = items.map(({arch})=>{
      const { sumN, evtN, total } = getCounts(arch);
      const f = arch.filters || {};
      const hasBig = total >= 2000;
      const cls = hasBig ? 'chip-warn' : 'chip-ok';
      const checked = selected.has(arch.id) ? 'checked' : '';
      return `
        <div class="am-card">
          <input class="am-select" type="checkbox" data-sel="${arch.id}" ${checked}/>
          <div class="am-meta">
            <div class="am-row">
              <div class="am-id">${arch.id}</div>
              ${chip(`เวลา: ${fmtTime(arch.ts)}`, '')}
              ${chip(`summary: ${sumN}`, cls)}
              ${chip(`events: ${evtN}`, cls)}
            </div>
            <div class="am-row">
              ${chip(`studyId: ${f.xStudy || '-'}`, '')}
              ${chip(`pid filter: ${f.pid || '-'}`, '')}
              ${chip(`phase: ${f.phase || '-'}`, '')}
              ${chip(`group: ${f.group || '-'}`, '')}
              ${chip(`today: ${f.xToday ? 'yes':'no'}`, '')}
              ${chip(`onlyFiltered: ${f.xOnlyFiltered ? 'yes':'no'}`, '')}
            </div>
            <div class="am-small">${arch.note || ''}</div>
          </div>

          <div class="am-card-actions">
            <button class="am-btn am-btn-primary" data-act="dl_sum" data-id="${arch.id}">ดาวน์โหลด summary.csv</button>
            <button class="am-btn am-btn-primary" data-act="dl_evt" data-id="${arch.id}">ดาวน์โหลด events.csv</button>
            <button class="am-btn am-btn-warn" data-act="delete" data-id="${arch.id}">ลบ archive</button>
          </div>
        </div>
      `;
    }).join('');

    const selCount = getSelected().size;
    setMsg(`ติ๊กเลือกได้ | เลือกแล้ว: ${selCount} ชุด | merge จะรวมตามตัวเลือกด้านบน`);
  }

  // selection + actions
  DOC.addEventListener('click', (ev)=>{
    const sel = ev.target.closest?.('input[type="checkbox"][data-sel]');
    if(sel){
      const id = sel.getAttribute('data-sel');
      if(!id) return;
      const set = getSelected();
      if(sel.checked) set.add(id);
      else set.delete(id);
      saveSelected(set);
      setMsg(`เลือกแล้ว: ${set.size} ชุด`);
      return;
    }

    const btn = ev.target.closest?.('button[data-act]');
    if(!btn) return;
    const act = btn.getAttribute('data-act');
    const id = btn.getAttribute('data-id');
    if(!id) return;

    const arch = getArchive(id);
    if(!arch){
      setMsg('ไม่พบ archive นี้ (อาจถูกลบแล้ว)');
      render();
      return;
    }

    if(act==='dl_sum'){
      downloadText(`ARCHIVE_${id}_summary.csv`, summaryCSV(arch.summary || []));
      setMsg(`⬇️ ดาวน์โหลด summary ของ ${id}`);
      return;
    }
    if(act==='dl_evt'){
      downloadText(`ARCHIVE_${id}_events.csv`, eventsCSV(arch.events || []));
      setMsg(`⬇️ ดาวน์โหลด events ของ ${id}`);
      return;
    }
    if(act==='delete'){
      if(!confirm('ลบ archive นี้ถาวร?')) return;
      removeArchive(id);
      const set = getSelected();
      set.delete(id);
      saveSelected(set);
      setMsg(`🗑️ ลบ archive ${id} แล้ว`);
      render();
      return;
    }
  });

  btnRefresh?.addEventListener('click', render);

  btnExportIndex?.addEventListener('click', ()=>{
    const idx = getIndex();
    downloadText(`archive_index_${Date.now()}.json`, JSON.stringify(idx, null, 2), 'application/json;charset=utf-8');
    setMsg('⬇️ ดาวน์โหลด index.json แล้ว');
  });

  btnWipeAll?.addEventListener('click', ()=>{
    if(!confirm('ล้าง archive ทั้งหมดในเครื่องนี้ถาวร?')) return;
    const idx = getIndex();
    for(const it of idx){
      localStorage.removeItem(ARCHIVE_PREFIX + it.id);
    }
    localStorage.removeItem(ARCHIVE_KEY);
    localStorage.removeItem(SELECTED_KEY);
    setMsg('ล้าง archive ทั้งหมดแล้ว');
    render();
  });

  function onFilterChange(){ render(); }
  ;[qEl,sortEl,modeEl,limitEl].forEach(el=>{
    el?.addEventListener('input', onFilterChange);
    el?.addEventListener('change', onFilterChange);
  });

  // -------- MERGE (META COMPLETE) --------
  function sumKey(r){ return `${r.ts}|${r.pid}|${r.game}|${r.seed}|${r.studyId}|${r.phase}|${r.conditionGroup}`; }
  function evtKey(r){ return `${r.ts}|${r.sid}|${r.type}|${r.game}|${r.pid}`; }

  function getCandidates(){
    const idx = getIndex();
    const items = applyListFilters(idx); // currently shown
    const useSel = !!cbUseSelected?.checked;
    const selected = getSelected();

    const idsAllShown = items.map(x=>x.arch.id);
    if(!useSel) return idsAllShown;

    return idsAllShown.filter(id=>selected.has(id));
  }

  btnMerge?.addEventListener('click', ()=>{
    const ids = getCandidates();
    if(!ids.length){
      setMsg('ไม่มี archive ที่จะ merge (ลองติ๊กเลือก หรือปิด “รวมเฉพาะที่ติ๊ก”)');
      return;
    }

    const dedup = !!cbDedup?.checked;

    const sumOut = [];
    const evtOut = [];
    const sumSeen = new Set();
    const evtSeen = new Set();

    for(const id of ids){
      const arch = getArchive(id);
      if(!arch) continue;
      const sum = Array.isArray(arch.summary) ? arch.summary : [];
      const evt = Array.isArray(arch.events) ? arch.events : [];

      for(const r of sum){
        if(!dedup){ sumOut.push(r); continue; }
        const k = sumKey(r);
        if(!sumSeen.has(k)){ sumSeen.add(k); sumOut.push(r); }
      }
      for(const r of evt){
        if(!dedup){ evtOut.push(r); continue; }
        const k = evtKey(r);
        if(!evtSeen.has(k)){ evtSeen.add(k); evtOut.push(r); }
      }
    }

    sumOut.sort((a,b)=>Number(a.ts||0)-Number(b.ts||0));
    evtOut.sort((a,b)=>Number(a.ts||0)-Number(b.ts||0));

    const st = stamp();
    downloadText(`fitness_summary_merged_${st}.csv`, summaryCSV(sumOut));
    downloadText(`fitness_events_merged_${st}.csv`, eventsCSV(evtOut));

    if(cbIncludeMeta?.checked){
      downloadText(`fitness_merge_meta_${st}.json`, JSON.stringify({
        mergedAt: Date.now(),
        ids,
        options: { useSelected: !!cbUseSelected?.checked, dedup, includeMeta: true },
        rows: { summary: sumOut.length, events: evtOut.length }
      }, null, 2), 'application/json;charset=utf-8');
    }

    setMsg(`⬇️ MERGED OK | archives:${ids.length} | summary:${sumOut.length} | events:${evtOut.length} | dedup:${dedup?'on':'off'}`);
  });

  render();
})();