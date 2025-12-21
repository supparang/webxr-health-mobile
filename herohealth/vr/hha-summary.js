// === /herohealth/vr/hha-summary.js ===
// HHA Summary Overlay (IIFE)
// ✅ listens: hha:end (primary), also fallback hha:summary
// ✅ builds overlay if exists (#hha-summary), else creates minimal one
// ✅ buttons: retry / close / hub
// ✅ grade: SSS, SS, S, A, B, C

(function(root){
  'use strict';

  const doc = root.document;
  if (!doc) return;

  function $(id){ return doc.getElementById(id); }
  function safeNum(v, d=0){ v = Number(v); return Number.isFinite(v) ? v : d; }
  function clamp(v,a,b){ v=safeNum(v,0); if(v<a) return a; if(v>b) return b; return v; }

  function ensureOverlay(){
    let wrap = $('hha-summary');
    if (wrap) return wrap;

    // fallback: create minimal overlay (in case HTML not updated)
    wrap = doc.createElement('div');
    wrap.id = 'hha-summary';
    wrap.className = 'hha-summary';
    wrap.innerHTML = `
      <div class="hha-summary-card">
        <div class="hha-summary-title">สรุปผลจบเกม</div>
        <div class="hha-summary-sub" id="hha-summary-sub">—</div>
        <div class="hha-summary-grid" id="hha-summary-grid"></div>
        <div class="hha-summary-grade">
          <span class="hha-badge">GRADE</span>
          <span id="hha-summary-grade" class="hha-grade">S</span>
        </div>
        <div class="hha-summary-actions">
          <button type="button" class="hha-btn" id="hha-btn-retry">เล่นใหม่</button>
          <button type="button" class="hha-btn ghost" id="hha-btn-close">ปิด</button>
          <a class="hha-btn ghost" id="hha-btn-hub" href="./hub.html">กลับ Hub</a>
        </div>
        <div class="hha-summary-note" id="hha-summary-note"></div>
      </div>
    `;
    Object.assign(wrap.style,{
      position:'fixed', inset:'0', zIndex:'900',
      display:'none', alignItems:'center', justifyContent:'center',
      padding:'18px',
      background:'rgba(2,6,23,0.92)'
    });
    doc.body.appendChild(wrap);
    return wrap;
  }

  function calcGrade(stat){
    const score = safeNum(stat.score, 0);
    const miss  = safeNum(stat.misses, stat.miss ?? 0);
    const combo = safeNum(stat.comboMax, 0);
    const good  = safeNum(stat.goodHits, 0);

    // โทน “เกมจริง”: miss ดรอปแรง, combo ช่วยดัน
    const scoreNorm = clamp(score / 900, 0, 2.0);     // ปรับ scale ให้เข้ากับคะแนนจริงของเกม
    const comboNorm = clamp(combo / 40, 0, 1.5);
    const goodNorm  = clamp(good / 45, 0, 1.5);
    const missPen   = clamp(miss / 10, 0, 2.0);

    const perf = (scoreNorm*0.52) + (comboNorm*0.28) + (goodNorm*0.20) - (missPen*0.55);

    if (perf >= 1.20 && miss <= 2) return 'SSS';
    if (perf >= 1.05 && miss <= 4) return 'SS';
    if (perf >= 0.85) return 'S';
    if (perf >= 0.62) return 'A';
    if (perf >= 0.42) return 'B';
    return 'C';
  }

  function metric(label, value){
    const div = doc.createElement('div');
    div.className = 'hha-metric';
    div.innerHTML = `<div class="hha-mlabel">${label}</div><div class="hha-mvalue">${value}</div>`;
    return div;
  }

  function showSummary(detail){
    const wrap = ensureOverlay();
    const sub  = $('hha-summary-sub');
    const grid = $('hha-summary-grid');
    const gradeEl = $('hha-summary-grade');
    const note = $('hha-summary-note');

    const mode = String(detail.mode || detail.game || 'Game');
    const diff = String(detail.diff || 'normal').toUpperCase();
    const ch   = String(detail.challenge || detail.ch || 'rush').toUpperCase();
    const run  = String(detail.runMode || detail.run || 'play').toUpperCase();

    const score = safeNum(detail.score, 0)|0;
    const good  = safeNum(detail.goodHits, 0)|0;
    const gold  = safeNum(detail.goldHits, 0)|0;
    const miss  = safeNum(detail.misses, detail.miss ?? 0)|0;
    const combo = safeNum(detail.comboMax, 0)|0;
    const shield= safeNum(detail.shield, 0)|0;
    const boss  = !!detail.bossCleared;

    const grade = calcGrade({ score, goodHits:good, misses:miss, comboMax:combo });

    if (sub){
      sub.textContent = `${mode} • ${run} • DIFF ${diff} • CH ${ch}`;
    }

    if (grid){
      grid.innerHTML = '';
      grid.appendChild(metric('Score', score));
      grid.appendChild(metric('Good Hits', good));
      grid.appendChild(metric('Gold', gold));
      grid.appendChild(metric('Miss', miss));
      grid.appendChild(metric('Combo Max', combo));
      grid.appendChild(metric('Shield Left', shield));
      grid.appendChild(metric('Boss', boss ? '✅' : '—'));
    }

    if (gradeEl) gradeEl.textContent = grade;

    if (note){
      const tips =
        (grade === 'C' || grade === 'B') ? 'ทริค: โฟกัสแตะ “ของดี” ต่อเนื่อง + อย่าโดน junk (Miss ลดเกรดแรงมาก)' :
        (grade === 'A' || grade === 'S') ? 'โคตรดีแล้ว! ลองดัน combo + เก็บ GOLD ให้มากขึ้นเพื่อขึ้น SS/SSS' :
        'โหดมาก! 👑';
      note.textContent = tips;
    }

    // show
    wrap.classList.add('show');
    wrap.setAttribute('aria-hidden','false');

    // try flush logger when ending
    try{
      const L = root.HHACloudLogger;
      if (L && typeof L.flushNow === 'function') L.flushNow(true);
    }catch(_){}

    // bind buttons (once)
    bindButtons();
  }

  let bound = false;
  function bindButtons(){
    if (bound) return;
    bound = true;

    const wrap = ensureOverlay();
    const btnRetry = $('hha-btn-retry');
    const btnClose = $('hha-btn-close');

    function close(){
      wrap.classList.remove('show');
      wrap.setAttribute('aria-hidden','true');
    }

    btnClose && btnClose.addEventListener('click', close);

    btnRetry && btnRetry.addEventListener('click', ()=>{
      // reload with same query (keep diff/time/run/ch if present)
      try{
        const u = new URL(location.href);
        // ensure ts to avoid cached modules
        u.searchParams.set('ts', String(Date.now()));
        location.href = u.toString();
      }catch(_){
        location.reload();
      }
    });

    // click outside to close
    wrap.addEventListener('pointerdown', (e)=>{
      if (e.target === wrap) close();
    });
    // ESC to close
    window.addEventListener('keydown', (e)=>{
      if (e.key === 'Escape') close();
    });
  }

  // MAIN listeners
  root.addEventListener('hha:end', (e)=>{
    showSummary((e && e.detail) ? e.detail : {});
  });

  // fallback (if other games emit hha:summary)
  root.addEventListener('hha:summary', (e)=>{
    showSummary((e && e.detail) ? e.detail : {});
  });

})(window);
