// === /herohealth/vr/hha-hud.js ===
// Hero Health Academy — Global HUD Binder (DOM/VR) — SAFE
// ✅ hha:score / hha:time / quest:update / hha:coach / hha:rank / hha:end
// ✅ End Summary Overlay + Back HUB + Play Again
// ✅ flush-hardened before navigation
(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  function $(id){ return doc.getElementById(id); }
  function clamp(v,a,b){ v = Number(v)||0; return Math.max(a, Math.min(b, v)); }

  function qs(k, d=null){
    try{ return (new URL(root.location.href)).searchParams.get(k) ?? d; }catch(_){ return d; }
  }

  async function flushHard(reason){
    try{ root.dispatchEvent(new CustomEvent('hha:flush', { detail:{ reason:String(reason||'flush') } })); }catch(_){}
    try{
      if (root.HHA_CLOUD_LOGGER && typeof root.HHA_CLOUD_LOGGER.flush === 'function'){
        await Promise.race([
          root.HHA_CLOUD_LOGGER.flush({ reason:String(reason||'flush') }),
          new Promise(res=>setTimeout(res, 260))
        ]);
      } else {
        await new Promise(res=>setTimeout(res, 80));
      }
    }catch(_){}
  }

  function setText(id, text){
    const el = $(id);
    if (!el) return;
    el.textContent = String(text ?? '');
  }

  function onScore(e){
    const d = (e && e.detail) || {};
    setText('hhaScore', d.score ?? 0);
    setText('hhaCombo', d.combo ?? 0);
    setText('hhaMiss',  d.misses ?? 0);
  }

  function onTime(e){
    const d = (e && e.detail) || {};
    setText('hhaTime', d.left ?? 0);
  }

  function onQuest(e){
    const d = (e && e.detail) || {};
    if (d.goalTitle) setText('hudGoalTitle', d.goalTitle);
    if (d.goalNow !== undefined && d.goalTotal !== undefined) setText('hudGoalCount', `${d.goalNow}/${d.goalTotal}`);

    if (d.miniTitle) setText('hudMiniTitle', d.miniTitle);
    if (d.miniNow !== undefined && d.miniTotal !== undefined) setText('hudMiniCount', `${d.miniNow}/${d.miniTotal}`);

    if (d.miniLeftMs !== undefined){
      const ms = clamp(d.miniLeftMs, 0, 999999);
      setText('hudMiniTimer', ms > 0 ? `${Math.ceil(ms/1000)}s` : '');
    }
  }

  function onProgress(e){
    const d = (e && e.detail) || {};
    if (d.goalsCleared !== undefined && d.goalsTotal !== undefined && d.miniCleared !== undefined && d.miniTotal !== undefined){
      setText('hudQProgress', `Goals ${d.goalsCleared}/${d.goalsTotal} • Minis ${d.miniCleared}/${d.miniTotal}`);
    }
  }

  function onCoach(e){
    const d = (e && e.detail) || {};
    if (d.text) setText('hudCoachLine', d.text);
    if (d.sub !== undefined) setText('hudCoachSub', d.sub);

    const img = $('hudCoachImg');
    if (img){
      const mood = String(d.mood || 'neutral').toLowerCase();
      // user memory: coach images fixed names
      let file = 'coach-neutral.png';
      if (mood === 'happy') file = 'coach-happy.png';
      if (mood === 'sad') file = 'coach-sad.png';
      if (mood === 'fever') file = 'coach-fever.png';
      img.src = `./img/${file}`;
    }
  }

  function onRank(e){
    const d = (e && e.detail) || {};
    if (d.grade) setText('hhaGrade', d.grade);
  }

  function buildEndSummary(summary){
    const box = $('end-summary');
    if (!box) return;

    box.innerHTML = '';
    const wrap = doc.createElement('div');
    wrap.className = 'hha-end';

    const card = doc.createElement('div');
    card.className = 'hha-end-card';

    const title = doc.createElement('div');
    title.className = 'hha-end-title';
    title.textContent = 'สรุปผลการเล่น';

    const sub = doc.createElement('div');
    sub.className = 'hha-end-sub';
    sub.textContent = `เหตุผล: ${summary.reason || 'end'} • diff=${summary.diff || '-'} • run=${summary.runMode || '-'}`;

    const grid = doc.createElement('div');
    grid.className = 'hha-end-grid';
    grid.innerHTML = `
      <div class="it"><div class="k">Grade</div><div class="v">${summary.grade || '—'}</div></div>
      <div class="it"><div class="k">Score</div><div class="v">${summary.scoreFinal ?? 0}</div></div>
      <div class="it"><div class="k">Combo Max</div><div class="v">${summary.comboMax ?? 0}</div></div>
      <div class="it"><div class="k">Miss</div><div class="v">${summary.misses ?? 0}</div></div>
      <div class="it"><div class="k">Accuracy</div><div class="v">${summary.accuracyGoodPct ?? 0}%</div></div>
      <div class="it"><div class="k">Time</div><div class="v">${summary.durationPlayedSec ?? 0}s</div></div>
    `;

    const row = doc.createElement('div');
    row.className = 'hha-end-actions';

    const btnHub = doc.createElement('button');
    btnHub.className = 'hha-end-btn';
    btnHub.textContent = 'กลับหน้า HUB';

    const btnAgain = doc.createElement('button');
    btnAgain.className = 'hha-end-btn ghost';
    btnAgain.textContent = 'เล่นใหม่';

    btnHub.onclick = async ()=>{
      await flushHard('back_to_hub');
      const hub = qs('hub', './hub.html');
      root.location.href = hub;
    };

    btnAgain.onclick = async ()=>{
      await flushHard('restart');
      const u = new URL(root.location.href);
      u.searchParams.set('v', String(Date.now()));
      root.location.href = u.toString();
    };

    row.appendChild(btnHub);
    row.appendChild(btnAgain);

    card.appendChild(title);
    card.appendChild(sub);
    card.appendChild(grid);
    card.appendChild(row);

    wrap.appendChild(card);
    box.appendChild(wrap);
  }

  function onEnd(e){
    const summary = (e && e.detail) || {};
    // persist last summary
    try{
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
      localStorage.setItem('hha_last_summary', JSON.stringify(summary));
    }catch(_){}

    // show grade in HUD too
    if (summary.grade) setText('hhaGrade', summary.grade);
    buildEndSummary(summary);
  }

  // inject minimal CSS for end summary (SAFE)
  (function ensureEndCss(){
    if (doc.getElementById('hha-end-css')) return;
    const st = doc.createElement('style');
    st.id = 'hha-end-css';
    st.textContent = `
      .hha-end{
        position:fixed; inset:0;
        display:flex; align-items:center; justify-content:center;
        background:rgba(2,6,23,.62);
        backdrop-filter: blur(10px);
        z-index:2000;
      }
      .hha-end-card{
        width:min(820px, calc(100vw - 40px));
        border-radius:22px;
        padding:22px;
        background:rgba(2,6,23,.82);
        border:1px solid rgba(148,163,184,.18);
        box-shadow:0 22px 80px rgba(0,0,0,.45);
      }
      .hha-end-title{ font:1000 26px/1.1 system-ui; color:#e5e7eb; }
      .hha-end-sub{ margin-top:8px; font:700 12px/1.4 system-ui; color:#94a3b8; }
      .hha-end-grid{
        margin-top:14px;
        display:grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap:10px;
      }
      .hha-end-grid .it{
        padding:12px;
        border-radius:16px;
        background:rgba(2,6,23,.60);
        border:1px solid rgba(148,163,184,.14);
      }
      .hha-end-grid .k{ font:800 12px/1 system-ui; color:#94a3b8; }
      .hha-end-grid .v{ margin-top:6px; font:1000 18px/1 system-ui; color:#e5e7eb; }
      .hha-end-actions{
        margin-top:16px;
        display:flex;
        gap:10px;
        flex-wrap:wrap;
      }
      .hha-end-btn{
        border:1px solid rgba(34,197,94,.24);
        background:rgba(34,197,94,.18);
        color:#ecfdf5;
        padding:14px 16px;
        border-radius:16px;
        font:1000 16px/1 system-ui;
      }
      .hha-end-btn.ghost{
        border:1px solid rgba(148,163,184,.18);
        background:rgba(2,6,23,.55);
        color:#e5e7eb;
      }
      @media (max-width:520px){
        .hha-end-grid{ grid-template-columns: repeat(2, minmax(0,1fr)); }
      }
    `;
    doc.head.appendChild(st);
  })();

  root.addEventListener('hha:score', onScore);
  root.addEventListener('hha:time', onTime);
  root.addEventListener('quest:update', onQuest);
  root.addEventListener('quest:progress', onProgress);
  root.addEventListener('hha:coach', onCoach);
  root.addEventListener('hha:rank', onRank);
  root.addEventListener('hha:end', onEnd);
})(typeof window !== 'undefined' ? window : globalThis);