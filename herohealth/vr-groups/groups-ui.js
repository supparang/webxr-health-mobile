// === /herohealth/vr-groups/groups-ui.js ===
// Food Groups VR — UI Binder (IIFE)  ✅ "ขึ้นแน่"
// - Creates minimal DOM UI if missing: HUD, Quest, Coach, Reticle, LockRing, Start/End overlays
// - Binds events from GameEngine: hha:score, hha:time, quest:update, hha:coach, hha:end, hha:rank,
//   groups:lock, groups:reticle, hha:panic, hha:rush, hha:fever
//
// Usage in groups-vr.html:
//   <link rel="stylesheet" href="./vr-groups/groups.css">
//   <script src="./vr-groups/groups-ui.js" defer></script>
//   (then your engine/boot starts game)

(function(){
  'use strict';

  const doc = document;
  const ROOT = window;

  function qs(sel, root){ return (root||doc).querySelector(sel); }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function pct(prog, target){
    const p = (Number(target)||0) > 0 ? (Number(prog)||0)/(Number(target)||1) : 0;
    return clamp(p,0,1);
  }

  // ---------- build DOM (if missing) ----------
  function ensureBaseUI(){
    let overlay = qs('.overlay');
    if (!overlay){
      overlay = doc.createElement('div');
      overlay.className = 'overlay';
      doc.body.appendChild(overlay);
    }

    // HUD root
    let hud = qs('.hud', overlay);
    if (!hud){
      hud = doc.createElement('div');
      hud.className = 'hud';
      overlay.appendChild(hud);
    }

    // topbar
    let topbar = qs('.topbar', hud);
    if (!topbar){
      topbar = doc.createElement('div');
      topbar.className = 'topbar';
      hud.appendChild(topbar);
    }

    // Score card
    let scoreCard = qs('#fg-score-card', topbar);
    if (!scoreCard){
      scoreCard = doc.createElement('div');
      scoreCard.className = 'card';
      scoreCard.id = 'fg-score-card';
      scoreCard.innerHTML = `
        <h4>Score</h4>
        <div class="row">
          <span class="pill good">⭐ <b id="fg-score">0</b></span>
          <span class="pill warn">🔥 Combo <b id="fg-combo">0</b></span>
          <span class="pill bad">💔 Miss <b id="fg-miss">0</b></span>
        </div>
        <div class="row" style="margin-top:8px">
          <span class="pill cyan">🛡️ <b id="fg-shield">0</b></span>
          <span class="pill">⏱️ <b id="fg-time">0</b>s</span>
        </div>
      `;
      topbar.appendChild(scoreCard);
    }

    // Status card (Group / Rush / Panic / Fever)
    let statusCard = qs('#fg-status-card', topbar);
    if (!statusCard){
      statusCard = doc.createElement('div');
      statusCard.className = 'card';
      statusCard.id = 'fg-status-card';
      statusCard.style.flex = '1 1 auto';
      statusCard.innerHTML = `
        <h4>Status</h4>
        <div class="row">
          <span class="pill">🍽️ <span id="fg-group-label" class="muted">—</span></span>
          <span class="pill warn" id="fg-rush-pill" style="display:none">🚀 RUSH</span>
          <span class="pill bad" id="fg-panic-pill" style="display:none">⏰ PANIC</span>
          <span class="pill" id="fg-fever-pill" style="display:none">🔥 FEVER</span>
        </div>
        <div class="row" style="margin-top:8px">
          <span class="muted" id="fg-quest-ok">QUEST: —</span>
          <span class="muted" id="fg-rank" style="margin-left:auto">Rank: —</span>
        </div>
      `;
      topbar.appendChild(statusCard);
    }

    // Quest panel
    let quest = qs('.quest', hud);
    if (!quest){
      quest = doc.createElement('div');
      quest.className = 'quest card';
      quest.id = 'fg-quest';
      quest.innerHTML = `
        <h4>Quests</h4>

        <div class="qtag" id="fg-goal-tag">🎯 GOAL</div>
        <div class="qline">
          <div id="fg-goal-label">—</div>
          <div class="qprog"><span id="fg-goal-prog">0</span>/<span id="fg-goal-target">0</span></div>
        </div>
        <div class="bar" aria-hidden="true"><i id="fg-goal-bar"></i></div>

        <div style="height:10px"></div>

        <div class="qtag" id="fg-mini-tag">⭐ MINI</div>
        <div class="qline">
          <div id="fg-mini-label">—</div>
          <div class="qprog">
            <span id="fg-mini-prog">0</span>/<span id="fg-mini-target">0</span>
            <span id="fg-mini-tleft" class="muted" style="display:none">⏱️ <b id="fg-mini-tleft-val">0</b>s</span>
          </div>
        </div>
        <div class="bar subbar" aria-hidden="true"><i id="fg-mini-bar"></i></div>

        <div class="small" id="fg-hint" style="margin-top:8px">
          แตะเป้าหรือ “แตะจอยิง” เพื่อช่วยเล็ง — โหมดเล่นสนุก / โหมดวิจัยคงที่
        </div>
      `;
      hud.appendChild(quest);
    }

    // Coach panel
    let coach = qs('.coach', hud);
    if (!coach){
      coach = doc.createElement('div');
      coach.className = 'coach';
      coach.id = 'fg-coach';
      coach.innerHTML = `
        <div class="avatar"><img id="fg-coach-img" alt="coach" /></div>
        <div class="bubble" id="fg-coach-text">พร้อมลุย! ✨</div>
      `;
      hud.appendChild(coach);
    }

    // Reticle center
    let reticle = qs('.reticle', overlay);
    if (!reticle){
      reticle = doc.createElement('div');
      reticle.className = 'reticle';
      reticle.innerHTML = `<div class="ret" id="fg-ret"></div>`;
      overlay.appendChild(reticle);
    }

    // Lock ring
    let lock = qs('.lockRing', overlay);
    if (!lock){
      lock = doc.createElement('div');
      lock.className = 'lockRing';
      lock.id = 'fg-lock';
      lock.innerHTML = `<div class="prog"></div><div class="charge"></div>`;
      overlay.appendChild(lock);
    }

    // End overlay
    let end = qs('.end', overlay);
    if (!end){
      end = doc.createElement('div');
      end.className = 'end';
      end.id = 'fg-end';
      end.innerHTML = `
        <div class="endCard">
          <h2>สรุปผล</h2>
          <div class="rankBig">
            <div class="g" id="fg-end-grade">C</div>
            <div class="m">
              <div>Accuracy <b id="fg-end-acc">0</b>%</div>
              <div>Quests <b id="fg-end-qp">0</b>%</div>
              <div>Score/s <b id="fg-end-sps">0</b></div>
            </div>
          </div>
          <div class="endGrid">
            <div class="stat"><div class="k">Score</div><div class="v" id="fg-end-score">0</div></div>
            <div class="stat"><div class="k">Combo Max</div><div class="v" id="fg-end-combo">0</div></div>
            <div class="stat"><div class="k">Miss</div><div class="v" id="fg-end-miss">0</div></div>
          </div>
          <div class="actions" style="margin-top:12px">
            <button class="btn warn" id="fg-end-close">ปิด</button>
          </div>
          <div class="small">Tip: ถ้า QUEST ไม่ขึ้น ให้เช็ค groups-quests.js โหลดก่อน GameEngine.start()</div>
        </div>
      `;
      overlay.appendChild(end);

      const closeBtn = qs('#fg-end-close', end);
      if (closeBtn){
        closeBtn.addEventListener('click', () => {
          end.classList.remove('show');
        }, { passive:true });
      }
    }

    // Coach images (fallback paths)
    const coachImg = qs('#fg-coach-img');
    if (coachImg && !coachImg.getAttribute('src')){
      // try use your known coach assets if present
      coachImg.src = './img/coach-neutral.png';
    }

    return overlay;
  }

  // ---------- state cache ----------
  const UI = {
    overlay: null,
    score: 0,
    combo: 0,
    miss: 0,
    shield: 0,
    fever: 0,
    feverOn: false,
    timeLeft: 0,
    questOk: null,
    rank: { grade:'C', accuracy:0, questsPct:0, scorePerSec:0 }
  };

  // ---------- DOM setters ----------
  function setText(id, v){
    const el = qs('#'+id);
    if (el) el.textContent = String(v);
  }
  function setShow(id, on){
    const el = qs('#'+id);
    if (!el) return;
    el.style.display = on ? '' : 'none';
  }

  function updateScore(){
    setText('fg-score', UI.score|0);
    setText('fg-combo', UI.combo|0);
    setText('fg-miss', UI.miss|0);
    setText('fg-shield', UI.shield|0);
  }
  function updateTime(){
    setText('fg-time', UI.timeLeft|0);
  }
  function updateStatusPills(){
    // fever pill
    setShow('fg-fever-pill', !!(UI.feverOn || (UI.fever|0) > 0));
    // quest ok label
    const qok = qs('#fg-quest-ok');
    if (qok){
      if (UI.questOk === null) qok.textContent = 'QUEST: —';
      else qok.textContent = UI.questOk ? 'QUEST: OK ✅' : 'QUEST: NOT READY ⚠️';
    }
    // rank
    const r = qs('#fg-rank');
    if (r) r.textContent = 'Rank: ' + (UI.rank.grade || '—');
  }

  function updateQuest(detail){
    const ok = !!detail.questOk;
    UI.questOk = ok;
    setText('fg-group-label', detail.groupLabel || '—');

    // goal
    if (detail.goal){
      setText('fg-goal-label', detail.goal.label || '—');
      setText('fg-goal-prog', detail.goal.prog|0);
      setText('fg-goal-target', detail.goal.target|0);
      const w = Math.round(pct(detail.goal.prog, detail.goal.target) * 100);
      const bar = qs('#fg-goal-bar');
      if (bar) bar.style.width = w + '%';
    } else {
      setText('fg-goal-label', ok ? '🎯 เคลียร์ GOAL แล้ว!' : '—');
      setText('fg-goal-prog', 0); setText('fg-goal-target', 0);
      const bar = qs('#fg-goal-bar'); if (bar) bar.style.width = '0%';
    }

    // mini
    if (detail.mini){
      setText('fg-mini-label', detail.mini.label || '—');
      setText('fg-mini-prog', detail.mini.prog|0);
      setText('fg-mini-target', detail.mini.target|0);
      const w = Math.round(pct(detail.mini.prog, detail.mini.target) * 100);
      const bar = qs('#fg-mini-bar'); if (bar) bar.style.width = w + '%';

      const tLeft = Number(detail.mini.tLeft);
      if (!Number.isNaN(tLeft) && tLeft > 0){
        setShow('fg-mini-tleft', true);
        setText('fg-mini-tleft-val', tLeft|0);
      } else {
        setShow('fg-mini-tleft', false);
      }
    } else {
      setText('fg-mini-label', ok ? '⭐ เคลียร์ MINI แล้ว!' : '—');
      setText('fg-mini-prog', 0); setText('fg-mini-target', 0);
      const bar = qs('#fg-mini-bar'); if (bar) bar.style.width = '0%';
      setShow('fg-mini-tleft', false);
    }

    updateStatusPills();
  }

  function updateCoach(text, mood){
    const bubble = qs('#fg-coach-text');
    if (bubble && text) bubble.textContent = String(text);

    const img = qs('#fg-coach-img');
    if (img){
      const m = String(mood||'').toLowerCase().trim();
      // map moods -> your known files (from memory): coach-fever.png, coach-happy.png, coach-neutral.png, coach-sad.png
      let src = './img/coach-neutral.png';
      if (m.includes('fever')) src = './img/coach-fever.png';
      else if (m.includes('happy') || m.includes('win') || m.includes('good')) src = './img/coach-happy.png';
      else if (m.includes('sad') || m.includes('miss') || m.includes('bad')) src = './img/coach-sad.png';
      img.src = src;
    }
  }

  function updateReticle(state){
    const ret = qs('#fg-ret');
    if (!ret) return;
    ret.classList.remove('ok','miss');
    if (state === 'ok' || state === 'perfect') ret.classList.add('ok');
    if (state === 'miss') ret.classList.add('miss');
    // auto clear shake class after a bit
    if (state === 'miss'){
      setTimeout(()=>{ try{ ret.classList.remove('miss'); }catch{} }, 260);
    }
  }

  function updateLock(detail){
    const lock = qs('#fg-lock');
    if (!lock) return;

    if (!detail || !detail.on){
      lock.classList.remove('on');
      return;
    }

    lock.classList.add('on');

    const x = Number(detail.x); const y = Number(detail.y);
    if (!Number.isNaN(x) && !Number.isNaN(y)){
      lock.style.left = Math.round(x) + 'px';
      lock.style.top  = Math.round(y) + 'px';
    } else {
      lock.style.left = '50%';
      lock.style.top = '50%';
    }

    const p = clamp(detail.prog,0,1);
    const c = clamp(detail.charge,0,1);

    // use conic-gradient trick for arc feel
    const prog = lock.querySelector('.prog');
    const chg  = lock.querySelector('.charge');

    if (prog){
      const deg = Math.round(p * 360);
      prog.style.borderTopColor = 'rgba(34,211,238,.90)';
      prog.style.transform = 'rotate(-90deg)';
      prog.style.maskImage = `conic-gradient(#000 ${deg}deg, transparent 0deg)`;
      prog.style.webkitMaskImage = `conic-gradient(#000 ${deg}deg, transparent 0deg)`;
    }
    if (chg){
      const deg2 = Math.round(c * 360);
      chg.style.borderTopColor = 'rgba(245,158,11,.95)';
      chg.style.transform = 'rotate(-90deg)';
      chg.style.maskImage = `conic-gradient(#000 ${deg2}deg, transparent 0deg)`;
      chg.style.webkitMaskImage = `conic-gradient(#000 ${deg2}deg, transparent 0deg)`;
    }
  }

  function showEnd(detail){
    const end = qs('#fg-end');
    if (!end) return;

    // Fill from cached rank/score
    setText('fg-end-grade', (detail && detail.grade) ? detail.grade : (UI.rank.grade || 'C'));
    setText('fg-end-score', (detail && detail.scoreFinal != null) ? detail.scoreFinal : UI.score);
    setText('fg-end-combo', (detail && detail.comboMax != null) ? detail.comboMax : UI.combo);
    setText('fg-end-miss',  (detail && detail.misses != null) ? detail.misses : UI.miss);

    setText('fg-end-acc', UI.rank.accuracy|0);
    setText('fg-end-qp', UI.rank.questsPct|0);
    setText('fg-end-sps', UI.rank.scorePerSec);

    end.classList.add('show');
  }

  // ---------- event binds ----------
  function bindEvents(){
    // score
    window.addEventListener('hha:score', (ev)=>{
      const d = (ev && ev.detail) || {};
      UI.score  = d.score|0;
      UI.combo  = d.combo|0;
      UI.miss   = d.misses|0;
      UI.shield = Number(d.shield)||0;
      UI.fever  = Number(d.fever)||0;
      updateScore();
      updateStatusPills();
    });

    // time
    window.addEventListener('hha:time', (ev)=>{
      const d = (ev && ev.detail) || {};
      UI.timeLeft = d.left|0;
      updateTime();
    });

    // quest
    window.addEventListener('quest:update', (ev)=>{
      const d = (ev && ev.detail) || {};
      updateQuest(d);
    });

    // coach
    window.addEventListener('hha:coach', (ev)=>{
      const d = (ev && ev.detail) || {};
      updateCoach(d.text, d.mood);
    });

    // fever compatibility
    window.addEventListener('hha:fever', (ev)=>{
      const d = (ev && ev.detail) || {};
      UI.fever = Number(d.value)||0;
      UI.feverOn = !!d.on;
      updateStatusPills();
    });

    // rush
    window.addEventListener('hha:rush', (ev)=>{
      const d = (ev && ev.detail) || {};
      setShow('fg-rush-pill', !!d.on);
    });

    // panic
    window.addEventListener('hha:panic', (ev)=>{
      const d = (ev && ev.detail) || {};
      setShow('fg-panic-pill', !!d.on);
    });

    // rank
    window.addEventListener('hha:rank', (ev)=>{
      const d = (ev && ev.detail) || {};
      UI.rank.grade = d.grade || UI.rank.grade;
      UI.rank.scorePerSec = d.scorePerSec != null ? d.scorePerSec : UI.rank.scorePerSec;
      UI.rank.accuracy = d.accuracy != null ? d.accuracy : UI.rank.accuracy;
      UI.rank.questsPct = d.questsPct != null ? d.questsPct : UI.rank.questsPct;
      updateStatusPills();
    });

    // reticle state
    window.addEventListener('groups:reticle', (ev)=>{
      const d = (ev && ev.detail) || {};
      updateReticle(d.state);
    });

    // lock/fuse/charge ring
    window.addEventListener('groups:lock', (ev)=>{
      const d = (ev && ev.detail) || {};
      updateLock(d);
    });

    // end summary
    window.addEventListener('hha:end', (ev)=>{
      const d = (ev && ev.detail) || {};
      showEnd(d);
    });
  }

  // ---------- init ----------
  function init(){
    UI.overlay = ensureBaseUI();
    bindEvents();

    // initial render
    updateScore();
    updateTime();
    updateStatusPills();

    // If no quest event arrives soon, show hint
    setTimeout(()=>{
      if (UI.questOk === null){
        const qok = qs('#fg-quest-ok');
        if (qok) qok.textContent = 'QUEST: waiting…';
      }
    }, 600);
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  // export small helpers (optional)
  ROOT.GroupsUI = ROOT.GroupsUI || {};
  ROOT.GroupsUI.showEnd = showEnd;

})();