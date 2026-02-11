// ===== Reflection Evaluate (Bloom) — v20260210a =====
(function(){
  'use strict';
  const WIN = window, DOC = document;
  if(!DOC) return;

  const RP = WIN.HHA_RP; // optional
  const $ = (s)=>DOC.querySelector(s);
  const $$ = (s)=>Array.from(DOC.querySelectorAll(s));

  // ---------- Evaluate block ----------
  const box = $('#fx-eval');
  const msg = $('#fx-msg');
  const btnSave = $('#fx-save');
  const btnCopy = $('#fx-copy');

  const state = { diff:'', why:[], change:'' };

  function setMsg(t){ if(msg) msg.textContent = t || ''; }
  function toggleMulti(arr, v){
    const i = arr.indexOf(v);
    if(i>=0) arr.splice(i,1);
    else arr.push(v);
  }
  function refreshUI(){
    $$('.fx-opt').forEach(b=>{
      const k = b.getAttribute('data-k');
      const v = b.getAttribute('data-v');
      let on = false;
      if(k==='diff') on = (state.diff===v);
      if(k==='change') on = (state.change===v);
      if(k==='why') on = state.why.includes(v);
      b.classList.toggle('is-on', on);
    });
  }

  function dayKey(){
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  }
  function rid(){
    const pid = (RP?.ctx?.pid || '') || '';
    return `HHA_REFLECT_${pid || 'anon'}_${dayKey()}`;
  }

  function loadSaved(){
    try{
      const s = JSON.parse(localStorage.getItem(rid())||'null');
      if(s && typeof s==='object'){
        state.diff = s.diff || '';
        state.change = s.change || '';
        state.why = Array.isArray(s.why) ? s.why.slice() : [];
      }
    }catch(_){}
    refreshUI();
  }

  function save(){
    if(!state.diff){
      setMsg('เลือกข้อ 1 ก่อนนะ');
      return false;
    }
    const payload = {
      ts: Date.now(),
      diff: state.diff,
      why: state.why.slice(),
      change: state.change || '',
      pid: RP?.ctx?.pid || '',
      studyId: RP?.ctx?.studyId || '',
      phase: RP?.ctx?.phase || '',
      conditionGroup: RP?.ctx?.conditionGroup || '',
      seed: (RP?.ctx?.seed ?? 0) >>> 0,
      mode: RP?.ctx?.mode || 'play'
    };
    try{ localStorage.setItem(rid(), JSON.stringify(payload)); }catch(_){}
    try{ RP?.ev?.('reflection', payload); }catch(_){}
    setMsg('✅ บันทึกแล้ว');
    return true;
  }

  function esc(v){
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  }
  function reflectionCSV(){
    const pid = RP?.ctx?.pid || '';
    const d = new Date();
    const dk = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    const key = `HHA_REFLECT_${pid || 'anon'}_${dk}`;
    const obj = (()=>{ try{ return JSON.parse(localStorage.getItem(key)||'null'); }catch(_){ return null; } })();

    const header = ['ts','pid','studyId','phase','conditionGroup','seed','mode','diff','why','change'];
    const row = [
      obj?.ts || Date.now(),
      obj?.pid || pid,
      obj?.studyId || (RP?.ctx?.studyId || ''),
      obj?.phase || (RP?.ctx?.phase || ''),
      obj?.conditionGroup || (RP?.ctx?.conditionGroup || ''),
      (obj?.seed ?? RP?.ctx?.seed ?? 0) >>> 0,
      obj?.mode || (RP?.ctx?.mode || 'play'),
      obj?.diff || '',
      Array.isArray(obj?.why) ? obj.why.join('|') : (obj?.why || ''),
      obj?.change || ''
    ];
    return [header.join(','), row.map(esc).join(',')].join('\n');
  }

  if(box){
    box.addEventListener('click', (e)=>{
      const b = e.target?.closest?.('.fx-opt');
      if(!b) return;
      const k = b.getAttribute('data-k');
      const v = b.getAttribute('data-v');
      if(k==='diff'){ state.diff = v; }
      else if(k==='change'){ state.change = v; }
      else if(k==='why'){ toggleMulti(state.why, v); }
      refreshUI();
    });
    btnSave?.addEventListener('click', save);
    btnCopy?.addEventListener('click', async ()=>{
      try{
        await navigator.clipboard.writeText(reflectionCSV());
        setMsg('📋 คัดลอก Reflection CSV แล้ว');
      }catch(e){
        try{ WIN.prompt('Reflection CSV:', reflectionCSV()); }catch(_){}
      }
    });
    loadSaved();
  }

  // ---------- Last-4 Summary + Unified CSV Copy ----------
  const smsg = $('#fx-smsg');
  const grid = $('#fx-last4');
  const btnEvents = $('#fx-copy-events');
  const btnAll = $('#fx-copy-all');

  function setSMsg(t){ if(smsg) smsg.textContent = t || ''; }

  function readJSON(key){
    try{
      const v = localStorage.getItem(key);
      if(!v) return null;
      return JSON.parse(v);
    }catch(e){ return null; }
  }
  function pickGameIdFromObj(o){
    const g = (o?.game || o?.gameId || o?.id || '').toLowerCase();
    if(g.includes('shadow')) return 'shadow';
    if(g.includes('rhythm')) return 'rhythm';
    if(g.includes('jump')) return 'jumpduck';
    if(g.includes('balance')) return 'balance';
    return '';
  }
  function normalizeSummary(raw, fallbackGame){
    if(!raw) return null;
    const game = pickGameIdFromObj(raw) || fallbackGame || '';
    const score = Number(raw.score ?? raw.totalScore ?? raw.points ?? 0) || 0;
    const pass = Number(raw.pass ?? raw.cleared ?? raw.ok ?? 0) || 0;
    const total = Number(raw.total ?? raw.trials ?? raw.n ?? 0) || 0;
    const maxStreak = Number(raw.maxStreak ?? raw.streakMax ?? 0) || 0;
    const acc = (total > 0) ? Math.round((pass/total)*100) : (Number(raw.acc ?? 0) || 0);
    const ms = Number(raw.ms ?? raw.durationMs ?? 0) || 0;
    return { game, score, pass, total, acc, maxStreak, ms, ts: Number(raw.ts ?? raw.time ?? Date.now()) || Date.now() };
  }
  function loadLast4(){
    const out = [];
    const per = [
      ['HHA_LAST_SUMMARY_SHADOW','shadow'],
      ['HHA_LAST_SUMMARY_RHYTHM','rhythm'],
      ['HHA_LAST_SUMMARY_JUMPDUCK','jumpduck'],
      ['HHA_LAST_SUMMARY_BALANCE','balance'],
      ['SB_LAST_SUMMARY','shadow'],
      ['RB_LAST_SUMMARY','rhythm'],
      ['JD_LAST_SUMMARY','jumpduck'],
      ['BH_LAST_SUMMARY','balance'],
    ];
    const seen = new Set();
    for(const [k,g] of per){
      const s = normalizeSummary(readJSON(k), g);
      if(s && s.game && !seen.has(s.game)){
        out.push(s); seen.add(s.game);
      }
    }
    const g0 = normalizeSummary(readJSON('HHA_LAST_SUMMARY'), '');
    if(g0 && g0.game && !seen.has(g0.game)){
      out.push(g0); seen.add(g0.game);
    }
    const order = ['shadow','rhythm','jumpduck','balance'];
    out.sort((a,b)=>order.indexOf(a.game)-order.indexOf(b.game));
    const by = Object.fromEntries(out.map(x=>[x.game,x]));
    return order.map(g=>by[g] || { game:g, score:0, pass:0, total:0, acc:0, maxStreak:0, ms:0, ts:0, empty:true });
  }
  function gameLabel(g){
    if(g==='shadow') return 'Shadow Breaker';
    if(g==='rhythm') return 'Rhythm Boxer';
    if(g==='jumpduck') return 'Jump-Duck';
    if(g==='balance') return 'Balance Hold';
    return g;
  }
  function fmtMs(ms){
    if(!ms) return '-';
    const s = Math.round(ms/1000);
    if(s < 60) return `${s}s`;
    const m = Math.floor(s/60), r = s%60;
    return `${m}m ${r}s`;
  }
  function renderLast4(){
    if(!grid) return;
    const items = loadLast4();
    grid.innerHTML = '';
    items.forEach(it=>{
      const div = DOC.createElement('div');
      div.className = 'fx-gcard';
      const empty = !!it.empty;
      div.innerHTML = `
        <div class="fx-gt">${gameLabel(it.game)} ${empty ? '— ยังไม่เล่น' : ''}</div>
        <div class="fx-gm">${empty ? 'ลองเล่น 1 รอบ แล้วกลับมาดูผลได้เลย' : 'ผลงานล่าสุดของเกมนี้'}</div>
        <div class="fx-gk">
          <span class="fx-pill">คะแนน: ${it.score}</span>
          <span class="fx-pill">สำเร็จ: ${it.pass}/${it.total || 0}</span>
        </div>
        <div class="fx-gk">
          <span class="fx-pill">แม่น: ${it.total ? it.acc+'%' : '-'}</span>
          <span class="fx-pill">Streak: ${it.maxStreak || '-'}</span>
          <span class="fx-pill">เวลา: ${fmtMs(it.ms)}</span>
        </div>
      `;
      grid.appendChild(div);
    });
  }

  async function copyText(txt, okMsg){
    try{
      await navigator.clipboard.writeText(txt);
      setSMsg(okMsg);
    }catch(e){
      try{ WIN.prompt('Copy:', txt); }catch(_){}
      setSMsg('เปิดกล่องให้คัดลอกแล้ว');
    }
  }

  btnEvents?.addEventListener('click', ()=>{
    if(!RP){ setSMsg('ยังไม่พบ HHA_RP (ตรวจว่า stats.html โหลด hha-research-pack.js แล้ว)'); return; }
    RP.EVENTS.forEach(r=>{ r.game = r.game || 'fitness'; });
    copyText(RP.eventsCSV(), '📋 คัดลอก Events CSV แล้ว');
  });

  btnAll?.addEventListener('click', ()=>{
    if(!RP){ setSMsg('ยังไม่พบ HHA_RP (ตรวจว่า stats.html โหลด hha-research-pack.js แล้ว)'); return; }
    RP.EVENTS.forEach(r=>{ r.game = r.game || 'fitness'; });
    const txt = [
      '# === EVENTS_CSV ===',
      RP.eventsCSV(),
      '',
      '# === REFLECTION_CSV ===',
      reflectionCSV()
    ].join('\n');
    copyText(txt, '📋 คัดลอก Events+Reflection CSV (รวมไฟล์เดียว) แล้ว');
  });

  renderLast4();
})();