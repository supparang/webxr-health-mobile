// === /herohealth/gate/games/brush/warmup.js ===
// Brush Bubble Warmup
// Child-friendly warmup gate for Brush Kids
// Supports mount(api) and mount(root, api)

export function mount(arg1, arg2) {
  const { root, api } = normalizeMountArgs(arg1, arg2);

  let started = false;
  let destroyed = false;
  let timerId = null;
  let remain = 20;
  let popped = 0;
  const goal = 8;
  const bubblePool = [];
  const bubbleCount = 10;

  root.innerHTML = `
    <div class="brush-gate brush-gate-warmup">
      <div class="brush-gate-card">
        <div class="brush-gate-kicker">Brush Kids • Warmup</div>
        <h2 class="brush-gate-title">Brush Bubble Warmup</h2>
        <p class="brush-gate-sub">
          แตะฟองคราบให้แตกให้ครบ เพื่อเตรียมพร้อมก่อนแปรงฟันจริง
        </p>

        <div class="brush-gate-hud">
          <div class="brush-gate-pill">
            <span>เวลา</span>
            <strong data-time>${formatTime(remain)}</strong>
          </div>
          <div class="brush-gate-pill">
            <span>แตกแล้ว</span>
            <strong data-score>${popped} / ${goal}</strong>
          </div>
        </div>

        <div class="brush-gate-progress">
          <div class="brush-gate-progress-fill" data-fill style="width:0%"></div>
        </div>

        <div class="brush-gate-playfield brush-gate-bubbles" data-playfield></div>

        <div class="brush-gate-note" data-note>
          แตะฟองสีชมพูให้แตก ค่อย ๆ ทำทีละอันก็ได้
        </div>

        <div class="brush-gate-actions">
          <button class="brush-gate-btn brush-gate-btn-primary" type="button" data-start>
            เริ่มวอร์มอัป
          </button>
        </div>
      </div>
    </div>
  `;

  const timeEl = root.querySelector('[data-time]');
  const scoreEl = root.querySelector('[data-score]');
  const fillEl = root.querySelector('[data-fill]');
  const playfield = root.querySelector('[data-playfield]');
  const noteEl = root.querySelector('[data-note]');
  const startBtn = root.querySelector('[data-start]');

  setGateTitle(api, 'Brush Bubble Warmup', 'แตะฟองคราบให้แตกเพื่อเตรียมพร้อมก่อนเริ่มแปรง');
  updateStats();

  startBtn?.addEventListener('click', start);

  for (let i = 0; i < bubbleCount; i += 1) {
    const btn = makeBubble(i);
    bubblePool.push(btn);
    playfield.appendChild(btn);
    placeBubble(btn);
  }

  function start() {
    if (started || destroyed) return;
    started = true;

    startBtn?.remove();

    noteEl.textContent = 'เยี่ยมเลย! แตะฟองคราบให้แตกให้ครบ';
    timerId = window.setInterval(() => {
      remain -= 1;
      renderHud();

      if (remain <= 0) {
        finish({
          passed: true,
          reason: 'time_up',
          summary: {
            popped,
            goal,
            remain: 0
          }
        });
      }
    }, 1000);
  }

  function makeBubble(index) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'brush-bubble';
    btn.setAttribute('aria-label', `Bubble ${index + 1}`);
    btn.textContent = '🫧';

    btn.addEventListener('pointerdown', () => {
      if (!started || destroyed) return;
      if (btn.dataset.popped === '1') return;

      btn.dataset.popped = '1';
      btn.classList.add('is-popped');
      popped += 1;

      renderHud();

      if (popped >= goal) {
        finish({
          passed: true,
          reason: 'goal_reached',
          summary: {
            popped,
            goal,
            remain
          }
        });
        return;
      }

      window.setTimeout(() => {
        if (destroyed) return;
        btn.classList.remove('is-popped');
        btn.dataset.popped = '0';
        placeBubble(btn);
      }, 260);
    });

    return btn;
  }

  function placeBubble(el) {
    const x = 8 + Math.random() * 78;
    const y = 10 + Math.random() * 72;
    const s = 0.88 + Math.random() * 0.36;
    el.style.left = `${x}%`;
    el.style.top = `${y}%`;
    el.style.transform = `translate(-50%,-50%) scale(${s})`;
  }

  function renderHud() {
    if (timeEl) timeEl.textContent = formatTime(Math.max(0, remain));
    if (scoreEl) scoreEl.textContent = `${popped} / ${goal}`;
    if (fillEl) fillEl.style.width = `${Math.min(100, Math.round((popped / goal) * 100))}%`;

    if (noteEl) {
      if (popped >= goal) {
        noteEl.textContent = 'เก่งมาก! พร้อมเข้าเกมแปรงฟันแล้ว';
      } else if (popped >= Math.ceil(goal / 2)) {
        noteEl.textContent = 'เยี่ยมเลย เหลืออีกนิดเดียว';
      } else {
        noteEl.textContent = 'แตะฟองคราบให้แตก ค่อย ๆ ทำทีละอันก็ได้';
      }
    }

    updateStats();
  }

  function updateStats() {
    if (typeof api?.setStats === 'function') {
      api.setStats({
        label: 'Brush Bubble Warmup',
        progressNow: popped,
        progressMax: goal,
        timeLeftSec: remain
      });
    }
  }

  function finish(payload = {}) {
    if (destroyed) return;
    destroyed = true;
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }

    renderHud();

    if (noteEl) {
      noteEl.textContent =
        payload.reason === 'goal_reached'
          ? 'พร้อมแล้ว ไปแปรงฟันกันเลย!'
          : 'ครบเวลาแล้ว ไปต่อได้เลย!';
    }

    completeGate(api, {
      kind: 'warmup',
      game: 'brush',
      title: 'Brush Bubble Warmup',
      passed: true,
      score: popped,
      maxScore: goal,
      ...payload
    });
  }

  return {
    start,
    destroy() {
      destroyed = true;
      if (timerId) clearInterval(timerId);
    }
  };
}

export default mount;

function normalizeMountArgs(arg1, arg2) {
  if (isElement(arg1)) {
    return { root: arg1, api: arg2 || {} };
  }
  const api = arg1 || {};
  const root =
    api.container ||
    document.querySelector('[data-gate-stage]') ||
    document.getElementById('gate-game') ||
    document.getElementById('gateMount') ||
    document.getElementById('app') ||
    document.body;
  return { root, api };
}

function setGateTitle(api, title, sub) {
  try { api?.setTitle?.(title); } catch {}
  try { api?.setSub?.(sub); } catch {}
}

function completeGate(api, payload) {
  try {
    if (typeof api?.complete === 'function') return api.complete(payload);
    if (typeof api?.finish === 'function') return api.finish(payload);
    if (typeof api?.done === 'function') return api.done(payload);
    if (typeof api?.summary === 'function') return api.summary(payload);
    if (typeof api?.next === 'function') return api.next(payload);
  } catch {}
}

function formatTime(sec) {
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function isElement(v) {
  return v && typeof v === 'object' && v.nodeType === 1;
}