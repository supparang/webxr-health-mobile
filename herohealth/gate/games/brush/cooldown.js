// === /herohealth/gate/games/brush/cooldown.js ===
// Brush Smile Cooldown
// Child-friendly cooldown gate for Brush Kids
// Supports mount(api) and mount(root, api)

export function mount(arg1, arg2) {
  const { root, api } = normalizeMountArgs(arg1, arg2);

  let started = false;
  let destroyed = false;
  let timerId = null;
  let remain = 15;
  let sparkles = 0;
  const goal = 6;

  root.innerHTML = `
    <div class="brush-gate brush-gate-cooldown">
      <div class="brush-gate-card">
        <div class="brush-gate-kicker">Brush Kids • Cooldown</div>
        <h2 class="brush-gate-title">Brush Smile Cooldown</h2>
        <p class="brush-gate-sub">
          แตะดาวให้รอยยิ้มสดใส ก่อนกลับไปที่ HUB
        </p>

        <div class="brush-gate-hud">
          <div class="brush-gate-pill">
            <span>เวลา</span>
            <strong data-time>${formatTime(remain)}</strong>
          </div>
          <div class="brush-gate-pill">
            <span>ดาว</span>
            <strong data-score>${sparkles} / ${goal}</strong>
          </div>
        </div>

        <div class="brush-gate-progress">
          <div class="brush-gate-progress-fill" data-fill style="width:0%"></div>
        </div>

        <div class="brush-cooldown-smile">
          <div class="brush-cooldown-face">😊</div>
          <div class="brush-cooldown-stars" data-playfield></div>
        </div>

        <div class="brush-gate-note" data-note>
          แตะดาวทีละดวงให้ครบ แล้วค่อยกลับไปพัก
        </div>

        <div class="brush-gate-actions">
          <button class="brush-gate-btn brush-gate-btn-secondary" type="button" data-start>
            เริ่มคูลดาวน์
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

  setGateTitle(api, 'Brush Smile Cooldown', 'แตะดาวให้รอยยิ้มสดใสก่อนกลับ HUB');
  updateStats();

  startBtn?.addEventListener('click', start);

  function start() {
    if (started || destroyed) return;
    started = true;
    startBtn?.remove();

    spawnStars(4);

    timerId = window.setInterval(() => {
      remain -= 1;
      renderHud();

      if (remain <= 0) {
        finish({
          passed: true,
          reason: 'time_up',
          summary: {
            sparkles,
            goal,
            remain: 0
          }
        });
      }
    }, 1000);
  }

  function spawnStars(count) {
    for (let i = 0; i < count; i += 1) {
      playfield.appendChild(makeStar());
    }
  }

  function makeStar() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'brush-star';
    btn.textContent = '⭐';
    randomPlace(btn);

    btn.addEventListener('pointerdown', () => {
      if (!started || destroyed) return;
      btn.remove();
      sparkles += 1;
      renderHud();

      if (sparkles >= goal) {
        finish({
          passed: true,
          reason: 'goal_reached',
          summary: {
            sparkles,
            goal,
            remain
          }
        });
        return;
      }

      playfield.appendChild(makeStar());
    });

    return btn;
  }

  function randomPlace(el) {
    const x = 10 + Math.random() * 80;
    const y = 10 + Math.random() * 70;
    const s = 0.9 + Math.random() * 0.35;
    el.style.left = `${x}%`;
    el.style.top = `${y}%`;
    el.style.transform = `translate(-50%,-50%) scale(${s})`;
  }

  function renderHud() {
    if (timeEl) timeEl.textContent = formatTime(Math.max(0, remain));
    if (scoreEl) scoreEl.textContent = `${sparkles} / ${goal}`;
    if (fillEl) fillEl.style.width = `${Math.min(100, Math.round((sparkles / goal) * 100))}%`;

    if (noteEl) {
      if (sparkles >= goal) {
        noteEl.textContent = 'รอยยิ้มสดใสแล้ว กลับ HUB ได้เลย!';
      } else if (sparkles >= Math.ceil(goal / 2)) {
        noteEl.textContent = 'ดีมาก เหลืออีกนิดเดียว';
      } else {
        noteEl.textContent = 'แตะดาวทีละดวงให้ครบ แล้วค่อยกลับไปพัก';
      }
    }

    updateStats();
  }

  function updateStats() {
    if (typeof api?.setStats === 'function') {
      api.setStats({
        label: 'Brush Smile Cooldown',
        progressNow: sparkles,
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

    completeGate(api, {
      kind: 'cooldown',
      game: 'brush',
      title: 'Brush Smile Cooldown',
      passed: true,
      score: sparkles,
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