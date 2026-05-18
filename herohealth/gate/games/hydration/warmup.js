// === /herohealth/gate/games/hydration/warmup.js ===
// Hydration Gate Warmup
// PATCH v20260518-pack26-HYDRATION-WARMUP-STATS-COUNTDOWN-FIX
// ✅ เวลา countdown ทำงาน
// ✅ คะแนน / พลาด / แม่นยำ ขึ้นบน gate top stats
// ✅ ใช้ gate-core api.setStats()
// ✅ ใช้ gate-core api.complete() เพื่อเข้าเกมหลักต่ออย่างถูกต้อง
// ✅ ยังรองรับ boot() / mount() / default export

function createHydrationWarmupGame() {
  function boot(root, ctx = {}, api = {}) {
    if (!root) return;

    const qs = new URLSearchParams(location.search || '');

    const state = {
      target: 3,
      hit: 0,
      miss: 0,
      score: 0,
      done: false,
      bubbles: [],
      spawnTimer: 0,
      tickTimer: 0,
      doneTimer: 0,
      startedAt: Date.now(),
      totalSec: pickWarmupTime(),
      leftSec: pickWarmupTime()
    };

    function pickWarmupTime() {
      const raw =
        qs.get('warmupTime') ||
        qs.get('gateTime') ||
        qs.get('time') ||
        ctx.time ||
        30;

      let n = Number(raw);
      if (!Number.isFinite(n)) n = 30;

      /*
        Warmup ไม่ควรยาวเท่า main game เสมอไป
        แต่ถ้า URL ส่ง time=90 มา ให้ใช้ 30s เพื่อให้เด็กไม่รอนาน
      */
      if (n > 45) n = 30;
      if (n < 10) n = 10;

      return Math.round(n);
    }

    function hhDayKey() {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function safeWho() {
      try {
        return String((ctx && ctx.pid) || qs.get('pid') || 'anon').trim() || 'anon';
      } catch (e) {
        return 'anon';
      }
    }

    function safeCat() {
      try {
        return String((ctx && ctx.cat) || qs.get('cat') || qs.get('zone') || 'nutrition').trim() || 'nutrition';
      } catch (e) {
        return 'nutrition';
      }
    }

    function safeGame() {
      try {
        return String((ctx && (ctx.game || ctx.gameId)) || qs.get('game') || qs.get('gameId') || 'hydration').trim() || 'hydration';
      } catch (e) {
        return 'hydration';
      }
    }

    function markWarmupDone() {
      const day = hhDayKey();
      const who = safeWho();
      const cat = safeCat();
      const game = safeGame();

      try {
        localStorage.setItem(`HHA_WARMUP_DONE:${cat}:${game}:${who}:${day}`, '1');
        localStorage.setItem(`HHA_GATE_DONE_V1:${who}:${cat}:${game}:warmup:${day}`, '1');
      } catch (e) {}
    }

    function safeNextUrl() {
      try {
        if (ctx && ctx.targetUrl) return String(ctx.targetUrl);
        if (ctx && ctx.next) return String(ctx.next);

        const next = qs.get('next');
        if (next) return next;
      } catch (e) {}

      return '';
    }

    function goNextFallback() {
      const next = safeNextUrl();
      if (!next) return;

      try {
        location.href = next;
      } catch (e) {}
    }

    function accuracyText() {
      const total = state.hit + state.miss;
      if (total <= 0) return '0%';
      return Math.round((state.hit / total) * 100) + '%';
    }

    function updateGateStats() {
      if (api && typeof api.setStats === 'function') {
        api.setStats({
          time: state.leftSec,
          score: state.score,
          miss: state.miss,
          acc: accuracyText()
        });
      }

      if (api && typeof api.setSub === 'function') {
        api.setSub(
          state.done
            ? 'วอร์มอัปสำเร็จแล้ว กำลังพาเข้าเกมหลัก'
            : 'แตะหยดน้ำให้ครบ 3 ดวงก่อนเริ่มเกมหลัก'
        );
      }
    }

    root.innerHTML = `
      <div class="hyd-gate hyd-theme-warmup" data-hydration-warmup-pack="v20260518-pack26">
        <div class="hyd-card">
          <div class="hyd-top">
            <div class="hyd-icon">💧</div>
            <div>
              <div class="hyd-title">วอร์มอัปก่อนเล่น</div>
              <div class="hyd-sub">แตะหยดน้ำให้ครบ 3 ดวง แล้วไปเล่นกันเลย</div>
            </div>
          </div>

          <div class="hyd-progressRow">
            <div class="hyd-progressText">
              เก็บแล้ว <span id="hydWarmCount">0</span> / 3
              <span class="hyd-mini-stat"> • คะแนน <b id="hydWarmScore">0</b></span>
              <span class="hyd-mini-stat"> • เวลา <b id="hydWarmTime">${state.leftSec}</b>s</span>
            </div>
            <div class="hyd-progressBar"><div class="hyd-progressFill" id="hydWarmFill"></div></div>
          </div>

          <div class="hyd-stage" id="hydWarmStage" aria-label="hydration warmup stage"></div>

          <div class="hyd-helper" id="hydWarmHint">แตะหยดน้ำที่ลอยอยู่ ✨</div>

          <div class="hyd-actions">
            <button class="hyd-btn hyd-btn-main is-hidden" id="hydWarmContinue" type="button">ไปต่อเลย</button>
            <button class="hyd-btn hyd-btn-ghost" id="hydWarmSkip" type="button">ข้าม</button>
          </div>
        </div>
      </div>
    `;

    const stage = root.querySelector('#hydWarmStage');
    const countEl = root.querySelector('#hydWarmCount');
    const fillEl = root.querySelector('#hydWarmFill');
    const hintEl = root.querySelector('#hydWarmHint');
    const scoreEl = root.querySelector('#hydWarmScore');
    const timeEl = root.querySelector('#hydWarmTime');
    const skipBtn = root.querySelector('#hydWarmSkip');
    const continueBtn = root.querySelector('#hydWarmContinue');

    function rand(min, max) {
      return min + Math.random() * (max - min);
    }

    function updateProgress() {
      if (countEl) countEl.textContent = String(state.hit);
      if (scoreEl) scoreEl.textContent = String(state.score);
      if (timeEl) timeEl.textContent = String(state.leftSec);

      if (fillEl) {
        fillEl.style.width = `${Math.min(100, (state.hit / state.target) * 100)}%`;
      }

      if (hintEl) {
        if (state.done) {
          hintEl.textContent = 'พร้อมเล่นแล้ว ไปกันเลย 🎮';
        } else if (state.leftSec <= 5) {
          hintEl.textContent = 'เร็วเข้า! เหลือเวลาอีกนิดเดียว ⏱️';
        } else if (state.hit <= 0) {
          hintEl.textContent = 'แตะหยดน้ำที่ลอยอยู่ ✨';
        } else if (state.hit === 1) {
          hintEl.textContent = 'เก่งมาก! เอาอีก 2 ดวง 💧';
        } else if (state.hit === 2) {
          hintEl.textContent = 'อีกดวงเดียวก็พร้อมแล้ว 🌈';
        }
      }

      updateGateStats();
    }

    function revealContinue() {
      if (continueBtn) continueBtn.classList.remove('is-hidden');
      if (skipBtn) skipBtn.classList.add('is-hidden');
    }

    function clearAll() {
      state.bubbles.forEach(el => {
        try { el.remove(); } catch (e) {}
      });

      state.bubbles = [];

      if (state.spawnTimer) {
        clearTimeout(state.spawnTimer);
        state.spawnTimer = 0;
      }

      if (state.tickTimer) {
        clearInterval(state.tickTimer);
        state.tickTimer = 0;
      }

      if (state.doneTimer) {
        clearTimeout(state.doneTimer);
        state.doneTimer = 0;
      }
    }

    function finishWarmup(reason = 'complete') {
      if (state.done) return;

      state.done = true;

      clearAll();

      if (stage) {
        stage.classList.add('is-done');
        stage.innerHTML = `
          <div class="hyd-done-card">
            <div class="hyd-done-icon">💧</div>
            <b>พร้อมเติมน้ำแล้ว!</b>
            <span>เก็บหยดน้ำได้ ${state.hit}/${state.target} • คะแนน ${state.score}</span>
          </div>
        `;
      }

      revealContinue();
      updateProgress();
      markWarmupDone();

      const payload = {
        ok: true,
        kind: 'warmup',
        source: 'hydration-warmup-pack26',
        reason,
        score: state.score,
        hit: state.hit,
        miss: state.miss,
        accPct: state.hit + state.miss > 0
          ? Math.round((state.hit / (state.hit + state.miss)) * 100)
          : 0,
        title: 'วอร์มอัปสำเร็จ!',
        subtitle: 'เก็บหยดน้ำครบแล้ว ระบบกำลังพาเข้าเกมหลัก',
        lines: [
          `เก็บหยดน้ำ ${state.hit}/${state.target}`,
          `คะแนน warmup ${state.score}`,
          `ความแม่นยำ ${accuracyText()}`
        ]
      };

      try {
        if (api && typeof api.complete === 'function') {
          state.doneTimer = setTimeout(() => {
            api.complete(payload);
          }, 550);
          return;
        }
      } catch (e) {}

      try {
        root.dispatchEvent(new CustomEvent('gate:complete', {
          bubbles: true,
          detail: payload
        }));
      } catch (e) {}

      state.doneTimer = setTimeout(() => {
        goNextFallback();
      }, 900);
    }

    function missBubble(el) {
      if (state.done || !el || el.dataset.hit === '1') return;

      el.dataset.hit = '1';
      state.miss += 1;

      try {
        el.classList.add('is-miss');
      } catch (e) {}

      setTimeout(() => {
        try { el.remove(); } catch (e) {}
      }, 180);

      updateProgress();

      if (!state.done) {
        state.spawnTimer = setTimeout(spawnBubble, 160);
      }
    }

    function popBubble(el) {
      if (!el || el.dataset.hit === '1') return;

      el.dataset.hit = '1';
      el.classList.add('is-pop');

      setTimeout(() => {
        try { el.remove(); } catch (e) {}
      }, 240);
    }

    function spawnBubble() {
      if (state.done || !stage) return;

      const current = stage.querySelectorAll('.hyd-bubble').length;
      if (current >= 3) return;

      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'hyd-bubble hyd-bubble-good';
      el.setAttribute('aria-label', 'water bubble');
      el.textContent = Math.random() < 0.5 ? '💧' : '💦';

      const left = rand(10, 86);
      const top = rand(18, 70);
      const dur = rand(2.6, 4.2);
      const life = rand(4200, 5600);

      el.style.left = `${left}%`;
      el.style.top = `${top}%`;
      el.style.animationDuration = `${dur}s`;

      const hit = ev => {
        if (ev) {
          ev.preventDefault();
          ev.stopPropagation();
        }

        if (state.done || el.dataset.hit === '1') return;

        state.hit += 1;
        state.score += 120 + Math.max(0, state.leftSec * 2);

        updateProgress();
        popBubble(el);

        if (state.hit >= state.target) {
          finishWarmup('target-clear');
        } else {
          state.spawnTimer = setTimeout(spawnBubble, 180);
        }
      };

      el.addEventListener('click', hit, true);
      el.addEventListener('pointerup', hit, true);
      el.addEventListener('touchend', hit, { passive: false, capture: true });

      stage.appendChild(el);
      state.bubbles.push(el);

      setTimeout(() => {
        if (!state.done && el.isConnected && el.dataset.hit !== '1') {
          missBubble(el);
        }
      }, life);
    }

    function startCountdown() {
      if (state.tickTimer) clearInterval(state.tickTimer);

      state.tickTimer = setInterval(() => {
        if (state.done) return;

        state.leftSec = Math.max(0, state.leftSec - 1);
        updateProgress();

        if (state.leftSec <= 0) {
          /*
            Warmup ไม่ควรทำให้เด็กติดค้าง
            หมดเวลาก็ให้ผ่านไปเกมหลักได้ แต่ mark ว่า timeout
          */
          finishWarmup('timeout');
        }
      }, 1000);
    }

    function startSpawning() {
      spawnBubble();
      setTimeout(spawnBubble, 240);
      setTimeout(spawnBubble, 480);

      state.spawnTimer = setInterval(() => {
        if (state.done) return;

        const current = stage ? stage.querySelectorAll('.hyd-bubble').length : 0;
        if (current < 3) spawnBubble();
      }, 900);
    }

    skipBtn?.addEventListener('click', ev => {
      ev.preventDefault();
      ev.stopPropagation();

      state.score = Math.max(state.score, state.hit * 80);
      finishWarmup('skip');
    }, true);

    continueBtn?.addEventListener('click', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      finishWarmup('continue-button');
    }, true);

    if (api && typeof api.setTitle === 'function') {
      api.setTitle('Hydration Hero Warmup');
    }

    if (api && typeof api.setSub === 'function') {
      api.setSub('แตะหยดน้ำให้ครบ 3 ดวง เวลาและคะแนนจะนับจริง');
    }

    updateProgress();
    startCountdown();
    startSpawning();

    return {
      destroy() {
        clearAll();
      }
    };
  }

  return { boot };
}

const api = createHydrationWarmupGame();

export function boot(root, ctx, gateApi) {
  return api.boot(root, ctx, gateApi);
}

export function mount(root, ctx, gateApi) {
  return api.boot(root, ctx, gateApi);
}

export function start(root, ctx, gateApi) {
  return api.boot(root, ctx, gateApi);
}

export default function hydrationWarmupDefault(root, ctx, gateApi) {
  return api.boot(root, ctx, gateApi);
}

if (typeof window !== 'undefined') {
  window.HHA_GATE_GAME = window.HHA_GATE_GAME || {};
  window.HHA_GATE_GAME.hydrationWarmup = api;
  window.HHA_GATE_BOOT = api.boot;
  window.HHA_GATE_MOUNT = api.boot;
}
