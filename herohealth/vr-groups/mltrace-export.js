// === /herohealth/vr-groups/mltrace-export.js ===
// MLTrace Export (JSON/CSV) + DL CSV (label + features) — SAFE
// ✅ Adds buttons into end panel automatically (best-effort selectors)
// ✅ Exports:
//    - MLTrace JSON (samples+events+dl if present)
//    - Samples CSV (1Hz samples)
//    - DL CSV (dl.rows with columns: tSec,label,f0..f31)
// Works with: groups.safe.js + dl-hooks.js

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;

  const qs = (s)=>DOC.querySelector(s);
  const qsa= (s)=>Array.from(DOC.querySelectorAll(s));

  function safeName(s){ return String(s||'groups').replace(/[^a-z0-9_\-]+/ig,'_'); }

  function downloadText(filename, text, mime){
    try{
      const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = DOC.createElement('a');
      a.href = url;
      a.download = filename;
      DOC.body.appendChild(a);
      a.click();
      setTimeout(()=>{ try{ URL.revokeObjectURL(url); a.remove(); }catch(_){} }, 300);
    }catch(e){
      console.warn('downloadText fail', e);
    }
  }

  function toCSV(rows, columns){
    const esc = (v)=>{
      if (v==null) return '';
      const s = String(v);
      if (/[,"\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
      return s;
    };
    const head = columns.map(esc).join(',');
    const body = rows.map(r=>columns.map(c=>esc(r[c])).join(',')).join('\n');
    return head + '\n' + body + '\n';
  }

  function samplesToRows(samples){
    return (samples||[]).map(s=>Object.assign({}, s));
  }

  function dlToRows(dl){
    // dl: {columns, rows}
    if (!dl || !Array.isArray(dl.rows) || !Array.isArray(dl.columns)) return null;
    return { columns: dl.columns.slice(), rows: dl.rows.slice() };
  }

  function makeBtn(text, onClick){
    const b = DOC.createElement('button');
    b.className = 'btn btn-ghost';
    b.type = 'button';
    b.textContent = text;
    b.addEventListener('click', (e)=>{ e.preventDefault(); try{ onClick(); }catch(err){ console.warn(err); } }, { passive:false });
    return b;
  }

  function findButtonRow(){
    // best-effort to find a container that already holds end buttons
    // Try common patterns: .row2, .row, [data-end-actions], .panel .row2
    return (
      qs('[data-end-actions]') ||
      qs('.overlay .panel .row2') ||
      qs('.overlay .panel .row') ||
      qs('.panel .row2') ||
      qs('.panel .row') ||
      null
    );
  }

  function injectButtons(summary){
    const row = findButtonRow();
    if (!row) return;

    // prevent duplicates
    if (row.querySelector('.btn-ml-json')) return;

    const seed = safeName(summary?.seed || '');
    const diff = safeName(summary?.diff || '');
    const mode = safeName(summary?.runMode || '');
    const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
    const base = `groups_${mode}_${diff}_${seed}_${stamp}`;

    // Button: MLTrace JSON
    const btnJSON = makeBtn('⬇️ MLTrace JSON', ()=>{
      const ml = summary?.mlTrace || {};
      const payload = {
        meta: {
          game: 'groups',
          seed: summary?.seed,
          diff: summary?.diff,
          runMode: summary?.runMode,
          endedReason: summary?.reason,
          endedAtISO: new Date().toISOString()
        },
        mlTrace: ml
      };
      downloadText(`${base}_mltrace.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
    });
    btnJSON.classList.add('btn-ml-json');

    // Button: Samples CSV
    const btnCSV = makeBtn('⬇️ Samples CSV', ()=>{
      const samples = summary?.mlTrace?.samples || [];
      if (!samples.length){
        alert('ไม่มี samples ให้ export (mlTrace.samples ว่าง)');
        return;
      }
      // columns from union (stable order using first sample keys)
      const cols = Object.keys(samples[0]);
      const rows = samplesToRows(samples);
      downloadText(`${base}_samples.csv`, toCSV(rows, cols), 'text/csv;charset=utf-8');
    });

    // Button: DL CSV (if available)
    const dl = dlToRows(summary?.mlTrace?.dl);
    const btnDL = makeBtn('⬇️ DL CSV', ()=>{
      const dl2 = dlToRows(summary?.mlTrace?.dl);
      if (!dl2){
        alert('ยังไม่มี DL dataset — เปิด dl-hooks (research อัตโนมัติ / play ใช้ ?dl=1)');
        return;
      }
      downloadText(`${base}_dl.csv`, toCSV(dl2.rows, dl2.columns), 'text/csv;charset=utf-8');
    });
    if (!dl) btnDL.classList.add('hidden');

    // Put into row
    row.appendChild(btnJSON);
    row.appendChild(btnCSV);
    row.appendChild(btnDL);
  }

  // keep latest summary for manual export too
  WIN.__GVR_LAST_SUMMARY__ = null;

  WIN.addEventListener('hha:end', (ev)=>{
    const summary = ev.detail || {};
    WIN.__GVR_LAST_SUMMARY__ = summary;

    // inject after a tiny delay to let end overlay mount
    setTimeout(()=>injectButtons(summary), 60);
    setTimeout(()=>injectButtons(summary), 220); // retry once (some overlays mount late)
  }, { passive:true });

})();