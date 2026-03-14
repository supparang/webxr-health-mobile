// === /herohealth/gate/games/hydration/cooldown.js ===
// Hydration Gate Cooldown
// CHILD-FRIENDLY PATCH v20260314d
// ✅ รองรับทั้ง boot() และ mount()
// ✅ set HHA_COOLDOWN_DONE เอง
// ✅ ถ้า callback ไม่พาไปต่อ จะมี fallback redirect เอง

function createHydrationCooldownGame() {
  function boot(root, ctx = {}) {
    if (!root) return;

    const state = {
      roundsTarget: 3,
      roundsDone: 0,
      holding: false,
      holdMs: 0,
      releaseMs: 0,
      done: false,
      raf: 0,
      last: 0,
      doneTimer: null
    };

    function hhDayKey() {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function safeWho() {
      try {
        return String((ctx && ctx.pid) || new URL(location.href).searchParams.get('pid') || 'anon').trim() || 'anon';
      } catch (e) {
        return 'anon';
      }
    }

    function safeCat() {
      try {
        return String((ctx && ctx.cat) || new URL(location.href).searchParams.get('cat') || 'nutrition').trim() || 'nutrition';
      } catch (e) {
        return 'nutrition';
      }
    }

    function safeGame() {
      try {
        return String((ctx && ctx.gameId) || new URL(location.href).searchParams.get('game') || 'hydration').trim() || 'hydration';
      } catch (e) {
        return 'hydration';
      }
    }

    function markCooldownDone() {
      const day = hhDayKey();
      const who = safeWho();
      const cat = safeCat();
      const game = safeGame();

      try {
        localStorage.setItem(`HHA_COOLDOWN_DONE:${cat}:${game}:${who}:${day}`, '1');
        localStorage.setItem(`HHA_COOLDOWN_DONE:${cat}:${who}:${day}`, '1');
      } catch (e) {}
    }

    function safeNextUrl() {
      try {
        if (ctx && ctx.targetUrl) return String(ctx.targetUrl);
        if (ctx && ctx.next) return String(ctx.next);
        const u = new URL(location.href);
        const next = u.searchParams.get('next');
        if (next) return next;
        const hub = u.searchParams.get('hub');
        if (hub) return hub;
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

    root.innerHTML = `
      <div class="hyd-gate hyd-theme-cooldown">
        <div class="hyd-card">
          <div class="hyd-top">
            <div class="hyd-icon">🌙</div>
            <div>
              <div class="hyd-title">ผ่อนคลายหลังเล่น</div>
              <div class="hyd-sub">กดค้างตอน “หายใจเข้า” แล้วปล่อยตอน “หายใจออก” ให้ครบ 3 รอบ</div>
            </div>
          </div>

          <div class="hyd-breathWrap">
            <div class="hyd-breathCircle" id="hydBreathCircle">
              <div class="hyd-breathEmoji" id="hydBreathEmoji">😮‍💨</div>
            </div>
          </div>

          <div class="hyd-progressRow">
            <div class="hyd-progressText">รอบที่ทำแล้ว <span id="hydCoolCount">0</span> / 3</div>
            <div class="hyd-progressBar"><div class="hyd-progressFill" id="hydCoolFill"></div></div>
          </div>

          <div class="hyd-helper" id="hydCoolHint">กดค้างเมื่อเห็นคำว่า “หายใจเข้า” 🌬️</div>

          <div class="hyd-actions">
            <button class="hyd-btn hyd-btn-main" id="hydBreathBtn" type="button">เริ่มหายใจเข้า</button>
            <button class="hyd-btn hyd-btn-main is-hidden" id="hydCoolContinue" type="button">ไปต่อเลย</button>
            <button class="hyd-btn hyd-btn-ghost" id="hydCoolSkip" type="button">ข้าม</button>
          </div>
        </div>
      </div>
    `;

    const circle = root.querySelector('#hydBreathCircle');
    const emoji = root.querySelector('#hydBreathEmoji');
    const countEl = root.querySelector('#hydCoolCount');
    const fillEl = root.querySelector('#hydCoolFill');
    const hintEl = root.querySelector('#hydCoolHint');
    const breathBtn = root.querySelector('#hydBreathBtn');
    const continueBtn = root.querySelector('#hydCoolContinue');
    const skipBtn = root.querySelector('#hydCoolSkip');

    function updateProgress() {
      if (countEl) countEl.textContent = String(state.roundsDone);
      if (fillEl) fillEl.style.width = `${(state.roundsDone / state.roundsTarget) * 100}%`;
    }

    function revealContinue() {
      if (continueBtn) continueBtn.classList.remove('is-hidden');
      if (breathBtn) breathBtn.classList.add('is-hidden');
      if (skipBtn) skipBtn.classList.add('is-hidden');
    }

    function finishRound() {
      state.roundsDone += 1;
      updateProgress();

      if (state.roundsDone >= state.roundsTarget) {
        done();
      } else {
        if (hintEl) hintEl.textContent = `ดีมาก! อีก ${state.roundsTarget - state.roundsDone} รอบ 🌈`;
        if (breathBtn) breathBtn.textContent = 'เริ่มหายใจเข้า';
        circle?.classList.remove('is-inhale', 'is-exhale');
        if (emoji) emoji.textContent = '😊';
      }
    }

    function done() {
      if (state.done) return;
      state.done = true;

      if (hintEl) hintEl.textContent = 'เยี่ยมเลย ผ่อนคลายเสร็จแล้ว 💤';
      if (breathBtn) {
        breathBtn.disabled = true;
        breathBtn.textContent = 'เสร็จแล้ว';
      }
      circle?.classList.remove('is-inhale', 'is-exhale');
      circle?.classList.add('is-done');
      if (emoji) emoji.textContent = '🌙';

      revealContinue();
      cancelAnimationFrame(state.raf);

      markCooldownDone();

      try {
        if (typeof ctx.onDone === 'function') {
          ctx.onDone({ ok: true, kind: 'cooldown', score: state.roundsDone });
        } else if (typeof window.__HHA_GATE_ON_DONE__ === 'function') {
          window.__HHA_GATE_ON_DONE__({ ok: true, kind: 'cooldown', score: state.roundsDone });
        }
      } catch (e) {}

      state.doneTimer = setTimeout(() => {
        goNextFallback();
      }, 900);
    }

    function frame(ts) {
      if (state.done) return;

      if (!state.last) state.last = ts;
      const dt = ts - state.last;
      state.last = ts;

      if (state.holding) {
        state.holdMs += dt;
        if (state.holdMs >= 1400) {
          circle?.classList.remove('is-exhale');
          circle?.classList.add('is-inhale');
          if (hintEl) hintEl.textContent = 'ดีมาก! ตอนนี้ปล่อยเพื่อหายใจออก 💨';
          if (breathBtn) breathBtn.textContent = 'ปล่อยเพื่อหายใจออก';
          if (emoji) emoji.textContent = '🌬️';
        }
      } else {
        if (state.holdMs > 0) {
          state.releaseMs += dt;
          circle?.classList.remove('is-inhale');
          circle?.classList.add('is-exhale');
          if (hintEl) hintEl.textContent = 'หายใจออกช้า ๆ 💨';
          if (emoji) emoji.textContent = '😌';

          if (state.releaseMs >= 800) {
            state.holdMs = 0;
            state.releaseMs = 0;
            finishRound();
          }
        }
      }

      state.raf = requestAnimationFrame(frame);
    }

    function holdStart() {
      if (state.done) return;
      state.holding = true;
      if (hintEl) hintEl.textContent = 'กดค้างไว้ หายใจเข้าาา 🌬️';
      if (breathBtn) breathBtn.textContent = 'กำลังกดค้าง…';
      circle?.classList.add('is-inhale');
      circle?.classList.remove('is-exhale');
      if (emoji) emoji.textContent = '🙂';
    }

    function holdEnd() {
      if (state.done) return;
      state.holding = false;
    }

    breathBtn?.addEventListener('pointerdown', holdStart);
    breathBtn?.addEventListener('pointerup', holdEnd);
    breathBtn?.addEventListener('pointerleave', holdEnd);
    breathBtn?.addEventListener('pointercancel', holdEnd);

    breathBtn?.addEventListener('touchstart', holdStart, { passive: true });
    breathBtn?.addEventListener('touchend', holdEnd, { passive: true });

    skipBtn?.addEventListener('click', done);

    continueBtn?.addEventListener('click', () => {
      goNextFallback();
    });

    updateProgress();
    state.raf = requestAnimationFrame(frame);

    return {
      destroy() {
        cancelAnimationFrame(state.raf);
        if (state.doneTimer) clearTimeout(state.doneTimer);
      }
    };
  }

  return { boot };
}

const api = createHydrationCooldownGame();

export function boot(root, ctx) {
  return api.boot(root, ctx);
}

export function mount(root, ctx) {
  return api.boot(root, ctx);
}

if (typeof window !== 'undefined') {
  window.HHA_GATE_GAME = window.HHA_GATE_GAME || {};
  window.HHA_GATE_GAME.hydrationCooldown = api;
  window.HHA_GATE_BOOT = api.boot;
  window.HHA_GATE_MOUNT = api.boot;
}