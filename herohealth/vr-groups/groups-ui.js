// === /herohealth/vr-groups/groups-ui.js ===
// Food Groups VR — UI Binder (FIX-ALL, auto-create)
// ✅ Creates HUD + Quest panel + Fever/Shield mini UI + Coach toast
// ✅ Creates Reticle + Lock ring + Edge pulse (panic/rush/danger)
// ✅ Creates End Card (with Grade SSS/SS/S/A/B/C)
// ✅ Works even if HTML missing elements (auto inject)
// ✅ Safe: won't break other games if included accidentally

(function () {
  'use strict';

  const doc = document;
  const ROOT = window;

  const $ = (sel, host) => (host || doc).querySelector(sel);
  const on = (name, fn) => ROOT.addEventListener(name, fn);

  function clamp(v, a, b) { v = Number(v) || 0; return v < a ? a : (v > b ? b : v); }
  function safeText(el, t) { if (el) el.textContent = (t == null ? '' : String(t)); }
  function fmtPct(v) { return String(Math.round(clamp(v, 0, 100))) + '%'; }
  function fmtNum(v) { v = Number(v) || 0; return String(Math.round(v)); }
  function fmtTime(sec) {
    sec = Math.max(0, sec | 0);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  // ---------- ensure container ----------
  function ensureStyleLink() {
    // optional - if you want auto load groups.css when missing, uncomment and set path
    // const href = './vr-groups/groups.css';
    // if (!doc.querySelector(`link[href="${href}"]`)) {
    //   const l = doc.createElement('link');
    //   l.rel = 'stylesheet';
    //   l.href = href;
    //   doc.head.appendChild(l);
    // }
  }

  function ensureRoot() {
    let host = $('#fg-ui');
    if (!host) {
      host = doc.createElement('div');
      host.id = 'fg-ui';
      Object.assign(host.style, {
        position: 'fixed',
        inset: '0',
        pointerEvents: 'none',
        zIndex: '30'
      });
      doc.body.appendChild(host);
    }
    return host;
  }

  // ---------- HUD ----------
  function ensureHUD(host) {
    let hud = $('#fg-hud', host);
    if (!hud) {
      hud = doc.createElement('div');
      hud.id = 'fg-hud';
      Object.assign(hud.style, {
        position: 'fixed',
        top: '12px',
        left: '12px',
        right: '12px',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: '10px',
        alignItems: 'start',
        pointerEvents: 'none',
        zIndex: '31'
      });

      // left stack
      const left = doc.createElement('div');
      left.id = 'fg-hud-left';
      Object.assign(left.style, {
        display: 'grid',
        gap: '8px',
        maxWidth: 'min(520px, 92vw)'
      });

      // stats row
      const stats = doc.createElement('div');
      stats.id = 'fg-stats';
      stats.className = 'hha-panel';
      Object.assign(stats.style, {
        background: 'rgba(2,6,23,.72)',
        border: '1px solid rgba(148,163,184,.22)',
        borderRadius: '16px',
        padding: '10px 12px',
        boxShadow: '0 18px 50px rgba(0,0,0,.32)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, auto)',
        gap: '10px',
        alignItems: 'center',
        width: 'fit-content'
      });

      stats.innerHTML = `
        <div style="display:grid;gap:2px">
          <div style="font-size:12px;opacity:.75">คะแนน</div>
          <div id="fg-score" style="font-size:18px;font-weight:800">0</div>
        </div>
        <div style="display:grid;gap:2px">
          <div style="font-size:12px;opacity:.75">คอมโบ</div>
          <div id="fg-combo" style="font-size:18px;font-weight:800">0</div>
        </div>
        <div style="display:grid;gap:2px">
          <div style="font-size:12px;opacity:.75">Miss</div>
          <div id="fg-miss" style="font-size:18px;font-weight:800">0</div>
        </div>
        <div style="display:grid;gap:2px">
          <div style="font-size:12px;opacity:.75">เวลา</div>
          <div id="fg-time" style="font-size:18px;font-weight:800">0:00</div>
        </div>
      `;

      // quest row
      const quest = doc.createElement('div');
      quest.id = 'fg-quest';
      Object.assign(quest.style, {
        background: 'rgba(15,23,42,.70)',
        border: '1px solid rgba(148,163,184,.22)',
        borderRadius: '16px',
        padding: '10px 12px',
        boxShadow: '0 18px 50px rgba(0,0,0,.28)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)'
      });

      quest.innerHTML = `
        <div style="display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <div style="font-weight:900">ภารกิจ</div>
            <div id="fg-quest-ok" style="font-size:12px;opacity:.75">กำลังเชื่อมต่อ…</div>
          </div>
          <div style="display:flex;gap:10px;align-items:center">
            <div id="fg-group-pill" style="
              font-size:12px;
              padding:6px 10px;
              border-radius:999px;
              border:1px solid rgba(148,163,184,.22);
              background: rgba(2,6,23,.55);
              opacity:.95;
            ">หมู่: -</div>

            <div id="fg-fever-pill" style="
              font-size:12px;
              padding:6px 10px;
              border-radius:999px;
              border:1px solid rgba(148,163,184,.22);
              background: rgba(2,6,23,.55);
              display:flex;gap:8px;align-items:center
            ">
              <span style="opacity:.85">🔥</span>
              <span id="fg-fever-val" style="font-weight:800">0%</span>
              <span style="opacity:.75">|</span>
              <span style="opacity:.85">🛡️</span>
              <span id="fg-shield-val" style="font-weight:800">0</span>
            </div>
          </div>
        </div>

        <div style="height:10px"></div>

        <div style="display:grid;gap:8px">
          <div>
            <div style="font-size:12px;opacity:.75">GOAL</div>
            <div id="fg-goal" style="font-weight:800">-</div>
            <div style="height:6px"></div>
            <div style="height:8px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden;border:1px solid rgba(255,255,255,.10)">
              <div id="fg-goal-bar" style="height:100%;width:0%;background:rgba(34,197,94,.82)"></div>
            </div>
          </div>

          <div>
            <div style="font-size:12px;opacity:.75">MINI</div>
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
              <div id="fg-mini" style="font-weight:800">-</div>
              <div id="fg-mini-time" style="font-size:12px;opacity:.85"></div>
            </div>
            <div style="height:6px"></div>
            <div style="height:8px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden;border:1px solid rgba(255,255,255,.10)">
              <div id="fg-mini-bar" style="height:100%;width:0%;background:rgba(59,130,246,.82)"></div>
            </div>
          </div>
        </div>
      `;

      // right stack (rank)
      const right = doc.createElement('div');
      right.id = 'fg-hud-right';
      Object.assign(right.style, {
        display: 'grid',
        gap: '8px',
        justifyItems: 'end'
      });

      const rank = doc.createElement('div');
      rank.id = 'fg-rank';
      Object.assign(rank.style, {
        background: 'rgba(2,6,23,.72)',
        border: '1px solid rgba(148,163,184,.22)',
        borderRadius: '16px',
        padding: '10px 12px',
        boxShadow: '0 18px 50px rgba(0,0,0,.26)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        minWidth: '150px',
        textAlign: 'right'
      });
      rank.innerHTML = `
        <div style="font-size:12px;opacity:.75">เกรด</div>
        <div id="fg-grade" style="font-size:22px;font-weight:900;letter-spacing:.5px">C</div>
        <div style="height:6px"></div>
        <div style="display:grid;gap:4px;font-size:12px;opacity:.85">
          <div>Acc: <span id="fg-acc">0%</span></div>
          <div>Quest: <span id="fg-q">0%</span></div>
          <div>SPS: <span id="fg-sps">0</span></div>
        </div>
      `;

      left.appendChild(stats);
      left.appendChild(quest);
      right.appendChild(rank);

      hud.appendChild(left);
      hud.appendChild(right);

      host.appendChild(hud);
    }
    return hud;
  }

  // ---------- Coach toast ----------
  function ensureCoach(host) {
    let c = $('#fg-coach', host);
    if (!c) {
      c = doc.createElement('div');
      c.id = 'fg-coach';
      Object.assign(c.style, {
        position: 'fixed',
        left: '50%',
        bottom: '18px',
        transform: 'translateX(-50%)',
        maxWidth: 'min(720px, 92vw)',
        padding: '10px 14px',
        borderRadius: '999px',
        background: 'rgba(2,6,23,.70)',
        border: '1px solid rgba(148,163,184,.22)',
        boxShadow: '0 18px 50px rgba(0,0,0,.32)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        color: 'rgba(229,231,235,.95)',
        fontWeight: '800',
        textAlign: 'center',
        pointerEvents: 'none',
        opacity: '0',
        transition: 'opacity .18s ease, transform .18s ease',
        zIndex: '35'
      });
      c.textContent = '';
      host.appendChild(c);
    }
    return c;
  }

  function showCoach(text, ms) {
    const host = ensureRoot();
    const c = ensureCoach(host);
    if (!text) return;
    c.textContent = String(text);

    c.style.opacity = '1';
    c.style.transform = 'translateX(-50%) translateY(0)';

    clearTimeout(showCoach._t);
    showCoach._t = setTimeout(() => {
      c.style.opacity = '0';
      c.style.transform = 'translateX(-50%) translateY(6px)';
    }, clamp(ms || 1600, 700, 4000));
  }

  // ---------- Reticle ----------
  function ensureReticle(host) {
    let r = $('#reticle', host);
    if (!r) {
      r = doc.createElement('div');
      r.id = 'reticle';
      r.className = 'fg-reticle';
      host.appendChild(r);
    }
    return r;
  }
  function setReticle(state) {
    const host = ensureRoot();
    const r = ensureReticle(host);
    r.classList.remove('ok', 'miss', 'perfect');
    if (state) r.classList.add(String(state));
    // auto clear
    clearTimeout(setReticle._t);
    setReticle._t = setTimeout(() => {
      r.classList.remove('ok', 'miss', 'perfect');
    }, 180);
  }

  // ---------- Edge pulse ----------
  function ensureEdge(host) {
    let e = $('#edgePulse', host);
    if (!e) {
      e = doc.createElement('div');
      e.id = 'edgePulse';
      e.className = 'fg-edgePulse';
      host.appendChild(e);
    }
    return e;
  }
  function edgeOn(on) {
    const host = ensureRoot();
    const e = ensureEdge(host);
    if (on) e.classList.add('on');
    else e.classList.remove('on');
  }
  function edgeBeat() {
    const host = ensureRoot();
    const e = ensureEdge(host);
    e.classList.add('on');
    e.classList.remove('beat');
    // force reflow
    void e.offsetWidth;
    e.classList.add('beat');
    clearTimeout(edgeBeat._t);
    edgeBeat._t = setTimeout(() => e.classList.remove('beat'), 260);
  }

  // ---------- Lock ring ----------
  function ensureLock(host) {
    let box = $('#lockUI', host);
    if (!box) {
      box = doc.createElement('div');
      box.id = 'lockUI';
      box.className = 'fg-lockUI';

      // small SVG ring with 2 progress arcs
      box.innerHTML = `
        <svg id="lockSvg" width="120" height="120" viewBox="0 0 120 120">
          <circle class="ringBack" cx="60" cy="60" r="42"></circle>
          <circle id="ringProg" class="ringProg" cx="60" cy="60" r="42"
            stroke-dasharray="264" stroke-dashoffset="264"></circle>
          <circle id="ringCharge" class="ringCharge" cx="60" cy="60" r="42"
            stroke-dasharray="264" stroke-dashoffset="264" style="opacity:.0"></circle>
        </svg>
      `;
      host.appendChild(box);
    }
    return box;
  }

  function setLockUI(payload) {
    const host = ensureRoot();
    const box = ensureLock(host);
    const onState = !!(payload && payload.on);

    if (!onState) {
      box.classList.remove('on');
      box.style.transform = 'translate(-9999px,-9999px)';
      return;
    }

    box.classList.add('on');

    const x = Number(payload.x) || (ROOT.innerWidth / 2);
    const y = Number(payload.y) || (ROOT.innerHeight / 2);

    // place at target center
    box.style.transform = `translate(${Math.round(x - 60)}px,${Math.round(y - 60)}px)`;

    const prog = clamp(payload.prog, 0, 1);
    const charge = clamp(payload.charge, 0, 1);

    const C = 264; // approx circumference for r=42
    const pOff = Math.round(C * (1 - prog));
    const cOff = Math.round(C * (1 - charge));

    const ringProg = $('#ringProg', box);
    const ringCharge = $('#ringCharge', box);

    if (ringProg) ringProg.style.strokeDashoffset = String(pOff);

    if (ringCharge) {
      if (charge > 0) {
        ringCharge.style.opacity = '0.92';
        ringCharge.style.strokeDashoffset = String(cOff);
      } else {
        ringCharge.style.opacity = '0';
        ringCharge.style.strokeDashoffset = String(C);
      }
    }
  }

  // ---------- End card ----------
  function ensureEnd(host) {
    let wrap = $('#fg-end', host);
    if (!wrap) {
      wrap = doc.createElement('div');
      wrap.id = 'fg-end';
      Object.assign(wrap.style, {
        position: 'fixed',
        inset: '0',
        display: 'none',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
        zIndex: '60',
        background: 'rgba(2,6,23,.72)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)'
      });

      const card = doc.createElement('div');
      card.id = 'fg-end-card';
      Object.assign(card.style, {
        width: 'min(720px, 92vw)',
        borderRadius: '22px',
        border: '1px solid rgba(148,163,184,.22)',
        background: 'rgba(2,6,23,.80)',
        boxShadow: '0 30px 90px rgba(0,0,0,.55)',
        padding: '16px 16px 14px'
      });

      card.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
          <div>
            <div style="font-size:12px;opacity:.75">สรุปผล</div>
            <div style="font-size:20px;font-weight:900">Food Groups VR</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:12px;opacity:.75">GRADE</div>
            <div id="fg-end-grade" style="font-size:30px;font-weight:1000;letter-spacing:.6px">C</div>
          </div>
        </div>

        <div style="height:10px"></div>

        <div style="display:grid;grid-template-columns:repeat(4, minmax(0,1fr));gap:10px">
          <div style="border:1px solid rgba(148,163,184,.18);border-radius:16px;padding:10px;background:rgba(15,23,42,.55)">
            <div style="font-size:12px;opacity:.75">คะแนน</div>
            <div id="fg-end-score" style="font-size:18px;font-weight:900">0</div>
          </div>
          <div style="border:1px solid rgba(148,163,184,.18);border-radius:16px;padding:10px;background:rgba(15,23,42,.55)">
            <div style="font-size:12px;opacity:.75">คอมโบสูงสุด</div>
            <div id="fg-end-combo" style="font-size:18px;font-weight:900">0</div>
          </div>
          <div style="border:1px solid rgba(148,163,184,.18);border-radius:16px;padding:10px;background:rgba(15,23,42,.55)">
            <div style="font-size:12px;opacity:.75">Miss</div>
            <div id="fg-end-miss" style="font-size:18px;font-weight:900">0</div>
          </div>
          <div style="border:1px solid rgba(148,163,184,.18);border-radius:16px;padding:10px;background:rgba(15,23,42,.55)">
            <div style="font-size:12px;opacity:.75">Quest</div>
            <div id="fg-end-quest" style="font-size:18px;font-weight:900">0/0</div>
          </div>
        </div>

        <div style="height:12px"></div>

        <div id="fg-end-note" style="font-size:13px;opacity:.85;line-height:1.35">
          กด “เล่นอีกครั้ง” เพื่อทำให้ดีกว่าเดิม 🔥
        </div>

        <div style="height:12px"></div>

        <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap">
          <button id="fg-btn-close" style="
            pointer-events:auto;
            padding:10px 14px;border-radius:14px;
            border:1px solid rgba(148,163,184,.22);
            background:rgba(15,23,42,.65);
            color:rgba(229,231,235,.95);
            font-weight:900;
          ">ปิด</button>
        </div>
      `;

      wrap.appendChild(card);
      host.appendChild(wrap);

      // close behavior (only hides UI; engine start handled elsewhere)
      const btn = $('#fg-btn-close', wrap);
      if (btn) btn.addEventListener('click', () => {
        wrap.style.display = 'none';
      });
    }
    return wrap;
  }

  function showEnd(payload) {
    const host = ensureRoot();
    const wrap = ensureEnd(host);

    wrap.style.display = 'flex';

    const grade = (payload && payload.grade) ? String(payload.grade) : 'C';
    safeText($('#fg-end-grade', wrap), grade);

    safeText($('#fg-end-score', wrap), fmtNum(payload && payload.scoreFinal));
    safeText($('#fg-end-combo', wrap), fmtNum(payload && payload.comboMax));
    safeText($('#fg-end-miss', wrap), fmtNum(payload && payload.misses));

    const gT = (payload && payload.goalsTotal) | 0;
    const gC = (payload && payload.goalsCleared) | 0;
    const mT = (payload && payload.miniTotal) | 0;
    const mC = (payload && payload.miniCleared) | 0;
    safeText($('#fg-end-quest', wrap), `${gC}/${gT} + ${mC}/${mT}`);

    let note = 'กด “เล่นอีกครั้ง” เพื่อทำให้ดีกว่าเดิม 🔥';
    if (grade === 'SSS') note = 'โหดมาก! SSS แล้ววว 👑🔥';
    else if (grade === 'SS') note = 'สุดจัด! อีกนิดจะ SSS 👀';
    else if (grade === 'S') note = 'ดีมาก! ลุยต่อให้ถึง SS/SSS 🚀';
    else if (grade === 'A') note = 'เยี่ยม! ลองโฟกัส Quest กับ Accuracy 💡';
    else if (grade === 'B') note = 'กำลังมา! ลด Miss แล้วคอมโบจะพุ่ง ✨';
    safeText($('#fg-end-note', wrap), note);
  }

  // ---------- state cache ----------
  const uiState = {
    score: 0,
    combo: 0,
    misses: 0,
    timeLeft: 0,
    fever: 0,
    shield: 0,
    grade: 'C',
    acc: 0,
    qp: 0,
    sps: 0,
    questOk: null
  };

  // ---------- update helpers ----------
  function setGoalMini(goal, mini) {
    const host = ensureRoot();
    ensureHUD(host);

    const okEl = $('#fg-quest-ok');
    const goalEl = $('#fg-goal');
    const miniEl = $('#fg-mini');
    const miniTime = $('#fg-mini-time');
    const goalBar = $('#fg-goal-bar');
    const miniBar = $('#fg-mini-bar');

    if (uiState.questOk === false) {
      if (okEl) okEl.textContent = '⚠️ QUEST ไม่พร้อม (เช็ค groups-quests.js)';
      if (okEl) okEl.style.opacity = '0.95';
    } else if (uiState.questOk === true) {
      if (okEl) okEl.textContent = 'พร้อมแล้ว ✅';
      if (okEl) okEl.style.opacity = '0.75';
    } else {
      if (okEl) okEl.textContent = 'กำลังเชื่อมต่อ…';
    }

    if (goal && goal.label) {
      safeText(goalEl, goal.label);
      const p = clamp(goal.prog / Math.max(1, goal.target), 0, 1);
      if (goalBar) goalBar.style.width = Math.round(p * 100) + '%';
    } else {
      safeText(goalEl, '-');
      if (goalBar) goalBar.style.width = '0%';
    }

    if (mini && mini.label) {
      safeText(miniEl, mini.label);
      const p = clamp(mini.prog / Math.max(1, mini.target), 0, 1);
      if (miniBar) miniBar.style.width = Math.round(p * 100) + '%';

      if (mini.tLeft != null && mini.windowSec != null) {
        safeText(miniTime, `⏱️ ${fmtNum(mini.tLeft)}s`);
      } else {
        safeText(miniTime, '');
      }
    } else {
      safeText(miniEl, '-');
      safeText(miniTime, '');
      if (miniBar) miniBar.style.width = '0%';
    }
  }

  function setGroupLabel(label) {
    const el = $('#fg-group-pill');
    if (el) el.textContent = label ? String(label) : 'หมู่: -';
  }

  function setScoreBox() {
    safeText($('#fg-score'), uiState.score);
    safeText($('#fg-combo'), uiState.combo);
    safeText($('#fg-miss'), uiState.misses);
    safeText($('#fg-time'), fmtTime(uiState.timeLeft));
  }

  function setFeverBox() {
    safeText($('#fg-fever-val'), fmtPct(uiState.fever));
    safeText($('#fg-shield-val'), fmtNum(uiState.shield));
  }

  function setRankBox() {
    safeText($('#fg-grade'), uiState.grade);
    safeText($('#fg-acc'), fmtPct(uiState.acc));
    safeText($('#fg-q'), fmtPct(uiState.qp));
    safeText($('#fg-sps'), (Number(uiState.sps) || 0).toFixed(2));
  }

  // ---------- wire events ----------
  function init() {
    ensureStyleLink();
    const host = ensureRoot();
    ensureHUD(host);
    ensureCoach(host);
    ensureReticle(host);
    ensureEdge(host);
    ensureLock(host);
    ensureEnd(host);

    // Score updates
    on('hha:score', (ev) => {
      const d = (ev && ev.detail) || {};
      uiState.score = Number(d.score) || 0;
      uiState.combo = Number(d.combo) || 0;
      uiState.misses = Number(d.misses) || 0;

      // shield/fever may also come here
      if (d.fever != null) uiState.fever = clamp(d.fever, 0, 100);
      if (d.shield != null) uiState.shield = Math.max(0, Number(d.shield) || 0);

      setScoreBox();
      setFeverBox();
    });

    // Timer
    on('hha:time', (ev) => {
      const d = (ev && ev.detail) || {};
      uiState.timeLeft = Math.max(0, Number(d.left) || 0);
      setScoreBox();
    });

    // Fever channel (your engine emits hha:fever)
    on('hha:fever', (ev) => {
      const d = (ev && ev.detail) || {};
      if (d.value != null) uiState.fever = clamp(d.value, 0, 100);
      if (d.shield != null) uiState.shield = Math.max(0, Number(d.shield) || 0);
      setFeverBox();
    });

    // Coach
    on('hha:coach', (ev) => {
      const d = (ev && ev.detail) || {};
      if (d.text) showCoach(String(d.text), 1700);
    });

    // Quest updates
    on('quest:update', (ev) => {
      const d = (ev && ev.detail) || {};
      uiState.questOk = (d.questOk === true) ? true : (d.questOk === false ? false : uiState.questOk);

      if (d.groupLabel) setGroupLabel(d.groupLabel);
      else setGroupLabel(d.groupLabel || 'หมู่: -');

      setGoalMini(d.goal || null, d.mini || null);
    });

    // Rank
    on('hha:rank', (ev) => {
      const d = (ev && ev.detail) || {};
      if (d.grade) uiState.grade = String(d.grade).toUpperCase();
      uiState.acc = Number(d.accuracy) || 0;
      uiState.qp  = Number(d.questsPct) || 0;
      uiState.sps = Number(d.scorePerSec) || 0;
      setRankBox();
    });

    // Panic / Rush / Danger => edge pulse cues
    on('hha:panic', (ev) => {
      const d = (ev && ev.detail) || {};
      if (d.on) { edgeOn(true); edgeBeat(); }
      else edgeOn(false);
    });
    on('hha:rush', (ev) => {
      const d = (ev && ev.detail) || {};
      if (d.on) { edgeOn(true); edgeBeat(); showCoach('🚀 RUSH!', 900); }
    });
    on('groups:danger', (ev) => {
      const d = (ev && ev.detail) || {};
      if (d.on) { edgeOn(true); edgeBeat(); }
    });

    // Reticle feedback
    on('groups:reticle', (ev) => {
      const d = (ev && ev.detail) || {};
      setReticle(d.state || '');
      if (d.state === 'miss') edgeBeat();
    });

    // Lock ring
    on('groups:lock', (ev) => {
      const d = (ev && ev.detail) || {};
      setLockUI(d);
    });

    // Celebrate hooks (optional, nice feedback)
    on('hha:celebrate', (ev) => {
      const d = (ev && ev.detail) || {};
      if (d.kind === 'goal') { edgeBeat(); showCoach('🎯 GOAL ผ่าน!', 1100); }
      if (d.kind === 'mini') { edgeBeat(); showCoach('⭐ MINI ผ่าน!', 1100); }
      if (d.kind === 'all')  { edgeBeat(); showCoach('🎉 เคลียร์หมด!', 1400); }
    });

    // End
    on('hha:end', (ev) => {
      const d = (ev && ev.detail) || {};
      showEnd(d);
    });

    // Boot baseline display (in case engine starts before UI)
    setScoreBox();
    setFeverBox();
    setRankBox();
    setGroupLabel('หมู่: -');
    setGoalMini(null, null);

    // expose debug helper
    ROOT.GroupsUI = ROOT.GroupsUI || {};
    ROOT.GroupsUI.ping = () => {
      showCoach('UI OK ✅', 900);
      edgeBeat();
      setReticle('ok');
    };
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();

})();