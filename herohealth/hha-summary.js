// === /herohealth/hha-summary.js ===
// HeroHealth Summary Viewer — v1.0.0 (HHA Standard)
// Uses:
//   localStorage.HHA_LAST_SUMMARY (object)
//   localStorage.HHA_SUMMARY_HISTORY (array, max 50)
// Renders into element with id="hhaSummaryMount" (if exists)

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  const LS_LAST = 'HHA_LAST_SUMMARY';
  const LS_HIST = 'HHA_SUMMARY_HISTORY';

  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };

  function readJSON(key, fallback){
    try{
      const s = localStorage.getItem(key);
      if(!s) return fallback;
      return JSON.parse(s);
    }catch(_){
      return fallback;
    }
  }

  function safeStr(v, d=''){
    if(v === null || v === undefined) return d;
    return String(v);
  }

  function safeNum(v, d=0){
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  }

  function fmtTs(ts){
    const t = safeNum(ts, 0);
    if(!t) return '—';
    try{
      const dt = new Date(t);
      return dt.toLocaleString('th-TH', { hour12:false });
    }catch(_){
      return String(t);
    }
  }

  function pct(v){
    const n = safeNum(v, 0);
    return `${Math.round(n)}%`;
  }

  function gradeChip(grade, tier){
    const g = safeStr(grade,'—');
    const t = safeStr(tier,'');
    return `<span class="hha-chip"><b>${g}</b><span class="hha-chip-sub">${t}</span></span>`;
  }

  function gameLabel(game){
    const g = safeStr(game,'').toLowerCase();
    if(g.includes('goodjunk')) return 'GoodJunk';
    if(g.includes('groups')) return 'Food Groups';
    if(g.includes('plate')) return 'Balanced Plate';
    if(g.includes('hydration')) return 'Hydration';
    if(g.includes('hygiene')) return 'Hygiene';
    return game ? safeStr(game) : 'Game';
  }

  function pickHubUrl(){
    // Priority:
    // 1) ?hub=... (passed through from launcher/run)
    // 2) current directory hub.html fallback
    const h = qs('hub','') || '';
    if(h) return h;
    try{
      const u = new URL(location.href);
      // if already on /herohealth/hub.html, just return itself
      if(u.pathname.endsWith('/hub.html')) return u.href;
      // fallback: ./hub.html relative
      u.pathname = u.pathname.replace(/\/[^\/]*$/, '/hub.html');
      u.search = '';
      u.hash = '';
      return u.href;
    }catch(_){
      return './hub.html';
    }
  }

  function buildRow(k, v){
    return `<div class="hha-row"><div class="hha-k">${k}</div><div class="hha-v">${v}</div></div>`;
  }

  function summarize(s){
    if(!s || typeof s !== 'object') return null;

    const game = gameLabel(s.game || s.gameKey || s.title);
    const ts = fmtTs(s.ts || s.time || s.endedAt);

    const score = safeNum(s.scoreFinal ?? s.score ?? 0, 0);
    const miss  = safeNum(s.miss ?? s.misses ?? 0, 0);
    const comboMax = safeNum(s.comboMax ?? s.maxCombo ?? 0, 0);

    const runMode = safeStr(s.runMode ?? s.run ?? 'play');
    const diff = safeStr(s.diff ?? 'normal');
    const seed = safeStr(s.seed ?? '');

    const timePlanned = safeNum(s.timePlannedSec ?? s.durationPlannedSec ?? s.timePlanSec ?? s.durationPlanned ?? 0, 0);
    const timePlayed  = safeNum(s.timePlayedSec  ?? s.durationPlayedSec  ?? s.durationPlayed  ?? 0, 0);

    const grade = safeStr(s.grade ?? '—');
    const tier  = safeStr(s.tier ?? '');

    // accuracy variants
    const accPct =
      (s.accuracyPct != null) ? safeNum(s.accuracyPct, 0) :
      (s.accuracyGoodPct != null) ? safeNum(s.accuracyGoodPct, 0) :
      null;

    // generic extras (per-game)
    const extras = [];

    // Plate: g1..g5
    if([s.g1,s.g2,s.g3,s.g4,s.g5].some(x=>x!=null)){
      extras.push(`หมู่: ${safeNum(s.g1,0)}-${safeNum(s.g2,0)}-${safeNum(s.g3,0)}-${safeNum(s.g4,0)}-${safeNum(s.g5,0)}`);
    }

    // Groups: mini/boss cleared
    if(s.miniCleared != null) extras.push(`MINI: ${s.miniCleared ? 'ผ่าน' : 'ไม่ผ่าน'}`);
    if(s.bossCleared != null) extras.push(`BOSS: ${s.bossCleared ? 'ผ่าน' : 'ไม่ผ่าน'}`);

    // GoodJunk: hitGood/hitJunk/expireGood
    if(s.hitGood != null || s.hitJunk != null || s.expireGood != null){
      extras.push(`ดี:${safeNum(s.hitGood,0)} เสีย:${safeNum(s.hitJunk,0)} หมดเวลา:${safeNum(s.expireGood,0)}`);
    }

    return {
      raw: s,
      game, ts,
      score, miss, comboMax,
      runMode, diff, seed,
      timePlanned, timePlayed,
      grade, tier,
      accPct,
      extras
    };
  }

  function render(){
    const mount = DOC.getElementById('hhaSummaryMount');
    if(!mount) return;

    const last = readJSON(LS_LAST, null);
    const hist = readJSON(LS_HIST, []);

    const s = summarize(last);
    const hubUrl = pickHubUrl();

    const hasLast = !!s;

    const lastHtml = hasLast ? `
      <div class="hha-card">
        <div class="hha-head">
          <div>
            <div class="hha-title">${s.game}</div>
            <div class="hha-sub">ล่าสุด: ${s.ts}</div>
          </div>
          ${gradeChip(s.grade, s.tier)}
        </div>

        <div class="hha-grid">
          ${buildRow('Score', `<b>${s.score}</b>`)}
          ${buildRow('Miss', `<b>${s.miss}</b>`)}
          ${buildRow('ComboMax', `<b>${s.comboMax}</b>`)}
          ${buildRow('Accuracy', (s.accPct==null)?'—':`<b>${pct(s.accPct)}</b>`)}
          ${buildRow('Time', (s.timePlanned? `${s.timePlayed}/${s.timePlanned}s` : '—'))}
          ${buildRow('Mode', `<span class="hha-pill">${safeStr(s.runMode)}</span> <span class="hha-pill">${safeStr(s.diff)}</span>`)}
          ${buildRow('Seed', s.seed ? `<code class="hha-code">${s.seed}</code>` : '—')}
        </div>

        ${s.extras && s.extras.length ? `
          <div class="hha-extra">
            ${s.extras.map(x=>`<span class="hha-tag">${x}</span>`).join('')}
          </div>` : ''}

        <div class="hha-actions">
          <a class="hha-btn" href="${hubUrl}">กลับ HUB</a>
          <button class="hha-btn hha-btn-ghost" id="hhaExportBtn">Export JSON</button>
          <button class="hha-btn hha-btn-ghost" id="hhaClearBtn">ล้างผลล่าสุด</button>
        </div>
      </div>
    ` : `
      <div class="hha-card">
        <div class="hha-title">ยังไม่มีผลล่าสุด</div>
        <div class="hha-sub">เล่นเกมสักรอบ แล้วกลับมาหน้านี้อีกที</div>
        <div class="hha-actions">
          <a class="hha-btn" href="${hubUrl}">กลับ HUB</a>
        </div>
      </div>
    `;

    const list = Array.isArray(hist) ? hist : [];
    const listHtml = list.length ? `
      <div class="hha-card">
        <div class="hha-head">
          <div>
            <div class="hha-title">ประวัติ (ล่าสุด 50)</div>
            <div class="hha-sub">บันทึกแบบย่อเพื่อดูแนวโน้ม</div>
          </div>
          <span class="hha-pill">${list.length} รายการ</span>
        </div>

        <div class="hha-hist">
          ${list.map((it, idx)=>{
            const t = fmtTs(it.ts);
            const g = gameLabel(it.game);
            const sc = safeNum(it.score,0);
            const gr = safeStr(it.grade,'—');
            const df = safeStr(it.diff,'');
            const rn = safeStr(it.run,'');
            return `
              <div class="hha-hrow">
                <div class="hha-hl">
                  <div class="hha-ht">${g} <span class="hha-pill">${gr}</span></div>
                  <div class="hha-hs">${t} • ${rn}${df?(' • '+df):''}</div>
                </div>
                <div class="hha-hr"><b>${sc}</b></div>
              </div>
            `;
          }).join('')}
        </div>

        <div class="hha-actions">
          <button class="hha-btn hha-btn-ghost" id="hhaClearHistBtn">ล้างประวัติ</button>
        </div>
      </div>
    ` : '';

    mount.innerHTML = `
      <div class="hha-summary">
        ${lastHtml}
        ${listHtml}
      </div>
    `;

    // bind buttons
    const exp = DOC.getElementById('hhaExportBtn');
    if(exp){
      exp.onclick = ()=>{
        const raw = readJSON(LS_LAST, null);
        if(!raw){ alert('ไม่มีข้อมูลผลล่าสุด'); return; }
        const json = JSON.stringify(raw, null, 2);
        try{
          navigator.clipboard.writeText(json);
          alert('คัดลอก JSON ไปคลิปบอร์ดแล้ว');
        }catch(_){
          // fallback: open modal-like prompt
          prompt('คัดลอก JSON:', json);
        }
      };
    }

    const clr = DOC.getElementById('hhaClearBtn');
    if(clr){
      clr.onclick = ()=>{
        try{ localStorage.removeItem(LS_LAST); }catch(_){}
        render();
      };
    }

    const clrH = DOC.getElementById('hhaClearHistBtn');
    if(clrH){
      clrH.onclick = ()=>{
        try{ localStorage.removeItem(LS_HIST); }catch(_){}
        render();
      };
    }
  }

  // expose for hub refresh
  WIN.HHA_Summary = { render };

  // auto render on DOM ready
  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', render);
  }else{
    render();
  }
})();