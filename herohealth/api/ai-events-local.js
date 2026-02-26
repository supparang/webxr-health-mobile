// === /herohealth/api/ai-events-local.js ===
// HeroHealth AI Local Logger — PRODUCTION (predict + coach -> localStorage -> CSV export)
// ✅ listens: hha:ai-predict, hha:ai-coach
// ✅ local queue cap + safe JSON trimming
// ✅ debug mini button (AI CSV) when ?dbg=1 or ?aicsv=1
// v20260226-AI-LOCALCSV

'use strict';

(function(){
  const WIN = window;
  const DOC = document;

  const qs = (k, d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } };
  const nowIso = ()=> new Date().toISOString();

  const QKEY = 'HHA_AI_LOCAL_QUEUE_V1';
  const MAX_Q = 2400;

  function safeJson(obj, maxLen){
    try{
      const s = JSON.stringify(obj ?? null);
      if(!maxLen) return s;
      return (s.length > maxLen) ? (s.slice(0, maxLen) + '…') : s;
    }catch(e){
      return '"[json_error]"';
    }
  }

  function loadQ(){
    try{
      const raw = localStorage.getItem(QKEY);
      if(!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    }catch(e){ return []; }
  }
  function saveQ(arr){
    try{
      if(arr.length > MAX_Q) arr.splice(0, arr.length - MAX_Q);
      localStorage.setItem(QKEY, JSON.stringify(arr));
    }catch(e){}
  }
  function pushQ(ev){
    const q = loadQ();
    q.push(ev);
    saveQ(q);
  }
  function clearQ(){
    try{ localStorage.removeItem(QKEY); }catch(e){}
  }

  function ctx(){
    return {
      pid: String(qs('pid','anon')||'anon'),
      run: String(qs('run','play')||'play'),
      diff: String(qs('diff','normal')||'normal'),
      view: String(qs('view','mobile')||'mobile'),
      seed: String(qs('seed','')||''),
      studyId: String(qs('studyId', qs('study',''))||''),
      phase: String(qs('phase','')||''),
      conditionGroup: String(qs('conditionGroup', qs('cond',''))||''),
      cat: String(qs('cat','')||''),
      theme: String(qs('theme', qs('game',''))||''),
    };
  }

  function normalize(kind, detail){
    const c = ctx();
    const game = String(detail?.game || c.theme || 'goodjunk');
    return {
      kind: String(kind),
      ts: Date.now(),
      iso: nowIso(),
      game,
      pid: c.pid,
      run: c.run,
      diff: c.diff,
      view: c.view,
      seed: c.seed,
      studyId: c.studyId,
      phase: c.phase,
      conditionGroup: c.conditionGroup,
      cat: c.cat,
      why: detail?.why ?? null,
      confidence: detail?.confidence ?? null,
      // compact fields for CSV
      bestKind: detail?.best?.kind ?? null,
      bestEmoji: detail?.best?.emoji ?? null,
      next1Kind: detail?.next?.[0]?.kind ?? null,
      next1Emoji: detail?.next?.[0]?.emoji ?? null,
      next2Kind: detail?.next?.[1]?.kind ?? null,
      next2Emoji: detail?.next?.[1]?.emoji ?? null,
      msg: detail?.msg ?? null,
      payload: safeJson(detail, 6000)
    };
  }

  function ingest(kind, detail){
    pushQ(normalize(kind, detail || null));
  }

  WIN.addEventListener('hha:ai-predict', (e)=>{ try{ ingest('hha:ai-predict', e?.detail); }catch(_){ } });
  WIN.addEventListener('hha:ai-coach',  (e)=>{ try{ ingest('hha:ai-coach',  e?.detail); }catch(_){ } });

  // ===== CSV export =====
  function csvEscape(v){
    if(v==null) return '';
    const s = String(v);
    if(/[,"\n\r]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
    return s;
  }

  function toCsv(rows){
    const cols = [
      'kind','ts','iso','game','pid','run','diff','view','seed','studyId','phase','conditionGroup','cat',
      'why','confidence',
      'bestKind','bestEmoji','next1Kind','next1Emoji','next2Kind','next2Emoji',
      'msg','payload'
    ];
    const out = [];
    out.push(cols.join(','));
    for(const r of rows){
      out.push(cols.map(c=>csvEscape(r[c])).join(','));
    }
    return out.join('\n');
  }

  function downloadText(filename, text){
    const blob = new Blob([text], { type:'text/csv;charset=utf-8' });
    const a = DOC.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    DOC.body.appendChild(a);
    a.click();
    setTimeout(()=>{
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 250);
  }

  function exportCsv(){
    const q = loadQ();
    const csv = toCsv(q);
    const c = ctx();
    const tag = `${c.pid||'anon'}_${c.run||'play'}_${c.view||'mobile'}`.replace(/[^\w\-]+/g,'_');
    const fname = `HHA_AI_${tag}_${Date.now()}.csv`;
    downloadText(fname, csv);
  }

  // ===== small debug button =====
  const showBtn = (String(qs('dbg','0'))==='1') || (String(qs('aicsv','0'))==='1');

  function ensureBtn(){
    if(!showBtn) return;
    if(DOC.getElementById('hhaAiCsvBtn')) return;

    const btn = DOC.createElement('button');
    btn.id = 'hhaAiCsvBtn';
    btn.type = 'button';
    btn.textContent = 'AI CSV';
    btn.style.position='fixed';
    btn.style.left='10px';
    btn.style.bottom=`calc(env(safe-area-inset-bottom,0px) + 10px)`;
    btn.style.zIndex='999';
    btn.style.border='1px solid rgba(148,163,184,.22)';
    btn.style.background='rgba(2,6,23,.55)';
    btn.style.color='rgba(229,231,235,.95)';
    btn.style.borderRadius='14px';
    btn.style.padding='10px 12px';
    btn.style.fontWeight='1000';
    btn.style.cursor='pointer';
    btn.style.boxShadow='0 14px 40px rgba(0,0,0,.35)';

    btn.addEventListener('click', ()=>{
      const n = loadQ().length;
      const ok = confirm(`Export AI CSV now?\nRecords: ${n}\n\nOK=Export\nCancel=Clear queue`);
      if(ok){
        exportCsv();
      }else{
        const ok2 = confirm('Clear AI queue?');
        if(ok2) clearQ();
      }
    });

    DOC.body.appendChild(btn);
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', ensureBtn);
  }else{
    ensureBtn();
  }

  WIN.HHA_AI_LOCAL = {
    qsize: ()=> loadQ().length,
    exportCsv,
    clear: clearQ,
    key: QKEY
  };
})();