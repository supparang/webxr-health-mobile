// === VR-Fitness — common/game-shell.js ===
// Shell กลางสำหรับ Shadow Breaker / Rhythm Boxer / Jump-Duck
// จัดการ state, timer, HUD, result modal, pause on blur

(function (global) {
  'use strict';

  const qs = (s) => document.querySelector(s);

  // ---------- utils ----------
  function parseParams() {
    const p = new URLSearchParams(location.search);
    const diff = (p.get('diff') || 'normal').toLowerCase();
    const time = parseInt(p.get('time') || '60', 10);
    const next = p.get('next') || '';
    return { diff, time: isNaN(time) ? 60 : time, next };
  }

  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }

  // ---------- internal state ----------
  const shell = {
    state: 'idle', // idle | playing | finished | paused
    duration: 60,
    elapsed: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    hits: 0,
    misses: 0,
    difficulty: 'normal',
    _raf: 0,
    _lastTs: 0,
    _config: null,
    _dom: {
      wrap: null,
      timer: null,
      score: null,
      combo: null,
      diff: null,
      startBtn: null,
      result: null,
      resultScore: null,
      resultHits: null,
      resultMiss: null,
      resultCombo: null,
      resultTime: null,
      retryBtn: null,
      backBtn: null
    }
  };

  // ---------- HUD / Result DOM ----------
  function ensureHUD() {
    if (shell._dom.wrap) return;

    // HUD bar
    const wrap = document.createElement('div');
    wrap.id = 'vrf-hud';
    wrap.innerHTML = `
      <div class="vrf-hud-inner">
        <div class="vrf-hud-left">
          <span class="vrf-label">⏱</span>
          <span id="vrf-timer" class="vrf-value">60</span>s
        </div>
        <div class="vrf-hud-center">
          <span class="vrf-label">🔥 Combo</span>
          <span id="vrf-combo" class="vrf-value">x0</span>
        </div>
        <div class="vrf-hud-right">
          <span class="vrf-label">⭐ Score</span>
          <span id="vrf-score" class="vrf-value">0</span>
          <span id="vrf-diff" class="vrf-pill">NORMAL</span>
        </div>
        <button id="vrf-startBtn" class="vrf-main-btn" type="button">
          ▶ เริ่มเล่น
        </button>
      </div>
    `;
    document.body.appendChild(wrap);

    // Result modal
    const result = document.createElement('div');
    result.id = 'vrf-result';
    result.hidden = true;
    result.innerHTML = `
      <div class="vrf-result-card">
        <h2>🏁 สรุปผลการเล่น</h2>
        <p><strong>Score:</strong> <span id="vrf-result-score">0</span></p>
        <p><strong>Hits:</strong> <span id="vrf-result-hits">0</span></p>
        <p><strong>Miss:</strong> <span id="vrf-result-miss">0</span></p>
        <p><strong>Best Combo:</strong> <span id="vrf-result-combo">x0</span></p>
        <p><strong>เวลาเล่น:</strong> <span id="vrf-result-time">60</span>s</p>
        <div class="vrf-result-actions">
          <button id="vrf-retryBtn" type="button">🔁 เล่นอีกครั้ง</button>
          <button id="vrf-backBtn" type="button">🏠 กลับเมนู</button>
        </div>
      </div>
    `;
    document.body.appendChild(result);

    // map dom
    shell._dom.wrap = wrap;
    shell._dom.timer = qs('#vrf-timer');
    shell._dom.score = qs('#vrf-score');
    shell._dom.combo = qs('#vrf-combo');
    shell._dom.diff = qs('#vrf-diff');
    shell._dom.startBtn = qs('#vrf-startBtn');
    shell._dom.result = result;
    shell._dom.resultScore = qs('#vrf-result-score');
    shell._dom.resultHits = qs('#vrf-result-hits');
    shell._dom.resultMiss = qs('#vrf-result-miss');
    shell._dom.resultCombo = qs('#vrf-result-combo');
    shell._dom.resultTime = qs('#vrf-result-time');
    shell._dom.retryBtn = qs('#vrf-retryBtn');
    shell._dom.backBtn = qs('#vrf-backBtn');

    // basic CSS (ถ้าอยากแยกไฟล์ทีหลังค่อยย้ายไป .css)
    if (!document.getElementById('vrf-hud-style')) {
      const st = document.createElement('style');
      st.id = 'vrf-hud-style';
      st.textContent = `
        #vrf-hud{
          position:fixed;left:50%;bottom:16px;transform:translateX(-50%);
          width:min(960px, 96vw);z-index:900;font-family:system-ui,sans-serif;
        }
        .vrf-hud-inner{
          display:flex;align-items:center;gap:12px;
          padding:8px 12px;border-radius:999px;
          background:rgba(15,23,42,0.88);color:#e5e7eb;
          border:1px solid rgba(148,163,184,0.6);
          backdrop-filter:blur(10px);
        }
        .vrf-hud-left,.vrf-hud-center,.vrf-hud-right{
          display:flex;align-items:center;gap:6px;font-size:14px;
        }
        .vrf-hud-left{flex:0 0 auto;}
        .vrf-hud-center{flex:1 1 auto;justify-content:center;}
        .vrf-hud-right{flex:0 0 auto;}
        .vrf-label{opacity:0.7;}
        .vrf-value{font-weight:600;font-size:16px;margin-left:2px;}
        .vrf-pill{
          margin-left:8px;padding:2px 10px;border-radius:999px;
          font-size:11px;font-weight:600;letter-spacing:0.06em;
          text-transform:uppercase;background:#0f766e;color:#e0f2f1;
        }
        .vrf-main-btn{
          margin-left:auto;padding:6px 14px;border-radius:999px;
          border:none;font-size:14px;font-weight:600;cursor:pointer;
          background:#22c55e;color:#052e16;box-shadow:0 0 0 1px #4ade80;
        }
        .vrf-main-btn:active{transform:translateY(1px);}
        #vrf-result{
          position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
          background:rgba(15,23,42,0.7);z-index:950;
        }
        .vrf-result-card{
          width:min(360px,90vw);background:#0f172a;color:#e5e7eb;
          border-radius:16px;padding:18px 20px;
          box-shadow:0 18px 45px rgba(15,23,42,0.7);
          border:1px solid rgba(148,163,184,0.6);
        }
        .vrf-result-card h2{
          margin:0 0 12px;font-size:18px;
        }
        .vrf-result-card p{
          margin:4px 0;font-size:14px;
        }
        .vrf-result-actions{
          display:flex;gap:10px;justify-content:flex-end;margin-top:12px;
        }
        .vrf-result-actions button{
          flex:1 1 0;border:none;border-radius:999px;padding:8px 10px;
          font-size:14px;font-weight:600;cursor:pointer;
        }
        #vrf-retryBtn{background:#22c55e;color:#052e16;}
        #vrf-backBtn{background:#e5e7eb;color:#020617;}
        @media (max-width:640px){
          .vrf-hud-inner{gap:8px;padding:6px 10px;}
          .vrf-hud-left,.vrf-hud-center,.vrf-hud-right{font-size:12px;}
          .vrf-main-btn{font-size:12px;padding:4px 10px;}
        }
      `;
      document.head.appendChild(st);
    }
  }

  function renderHUD() {
    const d = shell._dom;
    if (!d.timer) return;
    const remain = clamp(shell.duration - shell.elapsed, 0, shell.duration);
    d.timer.textContent = Math.ceil(remain).toString();
    d.score.textContent = shell.score.toString();
    d.combo.textContent = 'x' + shell.combo;
  }

  function showResult() {
    const d = shell._dom;
    if (!d.result) return;
    d.resultScore.textContent = shell.score.toString();
    d.resultHits.textContent = shell.hits.toString();
    d.resultMiss.textContent = shell.misses.toString();
    d.resultCombo.textContent = 'x' + shell.bestCombo;
    d.resultTime.textContent = shell.duration.toString();
    d.result.hidden = false;
  }

  function hideResult() {
    if (shell._dom.result) shell._dom.result.hidden = true;
  }

  // ---------- loop ----------
  function loop(ts) {
    shell._raf = global.requestAnimationFrame(loop);

    if (shell.state !== 'playing') return;

    if (!shell._lastTs) shell._lastTs = ts;
    const dt = (ts - shell._lastTs) / 1000;
    shell._lastTs = ts;

    shell.elapsed += dt;
    if (shell.elapsed >= shell.duration) {
      endGame();
      return;
    }

    // callback ให้เกมเอาไปขยับ logic (เช่น difficulty ramp)
    if (shell._config && typeof shell._config.onTick === 'function') {
      try {
        shell._config.onTick(shell, dt);
      } catch (err) {
        console.error('VRF onTick error', err);
      }
    }

    renderHUD();
  }

  // ---------- control ----------
  function startGame() {
    if (shell.state === 'playing') return;

    shell.state = 'playing';
    shell.elapsed = 0;
    shell.score = 0;
    shell.combo = 0;
    shell.bestCombo = 0;
    shell.hits = 0;
    shell.misses = 0;
    shell._lastTs = 0;
    hideResult();
    renderHUD();

    if (shell._config && typeof shell._config.onStart === 'function') {
      try {
        shell._config.onStart(shell);
      } catch (err) {
        console.error('VRF onStart error', err);
      }
    }
  }

  function endGame() {
    if (shell.state === 'finished') return;
    shell.state = 'finished';
    renderHUD();

    if (shell._config && typeof shell._config.onEnd === 'function') {
      try {
        shell._config.onEnd(shell);
      } catch (err) {
        console.error('VRF onEnd error', err);
      }
    }

    showResult();
  }

  function resetGame() {
    shell.state = 'idle';
    shell.elapsed = 0;
    shell.score = 0;
    shell.combo = 0;
    shell.bestCombo = 0;
    shell.hits = 0;
    shell.misses = 0;
    shell._lastTs = 0;
    hideResult();

    if (shell._config && typeof shell._config.onReset === 'function') {
      try {
        shell._config.onReset(shell);
      } catch (err) {
        console.error('VRF onReset error', err);
      }
    }
    renderHUD();
  }

  // ---------- blur / visibility ----------
  function handleVisibility() {
    if (document.hidden && shell.state === 'playing') {
      shell.state = 'paused';
    } else if (!document.hidden && shell.state === 'paused') {
      shell.state = 'playing';
      shell._lastTs = performance.now();
    }
  }

  // ---------- public API ----------
  const VRFGameShell = {
    /**
     * init(config)
     * config:
     *  - onStart(shell)
     *  - onTick(shell, dt)
     *  - onEnd(shell)
     *  - onReset(shell)
     *  - onBack(shell)   // กดปุ่ม "กลับเมนู"
     */
    init(config) {
      shell._config = config || {};
      const params = parseParams();
      shell.difficulty = params.diff;
      shell.duration = params.time;

      ensureHUD();
      renderHUD();

      // แสดง diff บน HUD
      if (shell._dom.diff) {
        shell._dom.diff.textContent = params.diff.toUpperCase();
        if (params.diff === 'easy') shell._dom.diff.style.background = '#22c55e';
        else if (params.diff === 'hard') shell._dom.diff.style.background = '#ef4444';
        else shell._dom.diff.style.background = '#0f766e';
      }

      // ปุ่ม start
      if (shell._dom.startBtn) {
        shell._dom.startBtn.addEventListener('click', function () {
          startGame();
        });
      }

      // ปุ่ม result
      if (shell._dom.retryBtn) {
        shell._dom.retryBtn.addEventListener('click', function () {
          resetGame();
          startGame();
        });
      }
      if (shell._dom.backBtn) {
        shell._dom.backBtn.addEventListener('click', function () {
          if (shell._config && typeof shell._config.onBack === 'function') {
            shell._config.onBack(shell);
          } else {
            // default: ถ้ามีพารามิเตอร์ next ให้เด้งไป
            const params2 = parseParams();
            if (params2.next) {
              location.href = params2.next;
            } else {
              resetGame();
            }
          }
        });
      }

      // loop + visibility
      if (!shell._raf) {
        shell._raf = global.requestAnimationFrame(loop);
      }
      document.addEventListener('visibilitychange', handleVisibility);
      global.addEventListener('blur', handleVisibility);

      return shell;
    },

    getState() {
      return shell;
    },

    addScore(n) {
      shell.score += n || 0;
      shell.hits++;
      shell.combo++;
      if (shell.combo > shell.bestCombo) shell.bestCombo = shell.combo;
      renderHUD();
    },

    addMiss() {
      shell.misses++;
      shell.combo = 0;
      renderHUD();
    },

    end: endGame
  };

  global.VRFGameShell = VRFGameShell;
})(window);
