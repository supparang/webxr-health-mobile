// === /herohealth/gate/games/hydration/warmup.js ===
// Hydration Gate Warmup
// CHILD-FRIENDLY PATCH v20260314c
// ✅ รองรับทั้ง boot() และ mount()
// ✅ ถ้า callback ไม่พาไปต่อ จะมี fallback redirect เอง

function createHydrationWarmupGame() {
  function boot(root, ctx = {}) {
    if (!root) return;

    const state = {
      target: 3,
      hit: 0,
      done: false,
      bubbles: [],
      timer: null,
      doneTimer: null
    };

    function safeNextUrl() {
      try {
        if (ctx && ctx.targetUrl) return String(ctx.targetUrl);
        if (ctx && ctx.next) return String(ctx.next);
        const u = new URL(location.href);
        const next = u.searchParams.get('next');
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

    root.innerHTML = `
      <div class="hyd-gate hyd-theme-warmup">
        <div class="hyd-card">
          <div class="hyd-top">
            <div class="hyd-icon">💧</div>
            <div>
              <div class="hyd-title">วอร์มอัปก่อนเล่น</div>
              <div class="hyd-sub">แตะหยดน้ำให้ครบ 3 ดวง แล้วไปเล่นกันเลย</div>
            </div>
          </div>

          <div class="hyd-progressRow">
            <div class="hyd-progressText">เก็บแล้ว <span id="hydWarmCount">0</span> / 3</div>
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
    const skipBtn = root.querySelector('#hydWarmSkip');
    const continueBtn = root.querySelector('#hydWarmContinue');

    function rand(min, max){
      return min + Math.random() * (max - min);
    }

    function updateProgress(){
      if (countEl) countEl.textContent = String(state.hit);
      if (fillEl) fillEl.style.width = `${(state.hit / state.target) * 100}%`;

      if (!hintEl) return;
      if (state.hit <= 0) hintEl.textContent = 'แตะหยดน้ำที่ลอยอยู่ ✨';
      else if (state.hit === 1) hintEl.textContent = 'เก่งมาก! เอาอีก 2 ดวง 💧';
      else if (state.hit === 2) hintEl.textContent = 'อีกดวงเดียวก็พร้อมแล้ว 🌈';
      else hintEl.textContent = 'พร้อมเล่นแล้ว ไปกันเลย 🎮';
    }

    function revealContinue(){
      if (continueBtn) continueBtn.classList.remove('is-hidden');
      if (skipBtn) skipBtn.classList.add('is-hidden');
    }

    function emitDone(){
      if (state.done) return;
      state.done = true;

      updateProgress();
      stage?.classList.add('is-done');
      if (hintEl) hintEl.textContent = 'พร้อมเล่นแล้ว ไปกันเลย 🎮';
      revealContinue();

      try {
        if (typeof ctx.onDone === 'function') {
          ctx.onDone({ ok:true, kind:'warmup', score: state.hit });
        } else if (typeof window.__HHA_GATE_ON_DONE__ === 'function') {
          window.__HHA_GATE_ON_DONE__({ ok:true, kind:'warmup', score: state.hit });
        }
      } catch (e) {}

      // fallback: ถ้า callback ไม่พาไปต่อภายใน 900ms ให้ไปเอง
      state.doneTimer = setTimeout(() => {
        goNextFallback();
      }, 900);
    }

    function popBubble(el){
      el.classList.add('is-pop');
      setTimeout(() => {
        try { el.remove(); } catch (e) {}
      }, 240);
    }

    function spawnBubble(){
      if (state.done || !stage) return;

      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'hyd-bubble hyd-bubble-good';
      el.setAttribute('aria-label', 'water bubble');
      el.textContent = Math.random() < 0.5 ? '💧' : '💦';

      const left = rand(10, 86);
      const top = rand(18, 70);
      const dur = rand(2.6, 4.2);

      el.style.left = `${left}%`;
      el.style.top = `${top}%`;
      el.style.animationDuration = `${dur}s`;

      el.addEventListener('click', () => {
        if (state.done) return;
        state.hit += 1;
        updateProgress();
        popBubble(el);

        if (state.hit >= state.target){
          emitDone();
        } else {
          setTimeout(spawnBubble, 180);
        }
      });

      stage.appendChild(el);
      state.bubbles.push(el);
    }

    function clearAll(){
      state.bubbles.forEach(el => {
        try { el.remove(); } catch (e) {}
      });
      state.bubbles = [];
      if (state.timer) clearTimeout(state.timer);
      if (state.doneTimer) clearTimeout(state.doneTimer);
    }

    skipBtn?.addEventListener('click', () => {
      clearAll();
      emitDone();
    });

    continueBtn?.addEventListener('click', () => {
      goNextFallback();
    });

    updateProgress();
    spawnBubble();

    state.timer = setTimeout(() => {
      if (!state.done) spawnBubble();
    }, 600);

    return {
      destroy(){
        clearAll();
      }
    };
  }

  return { boot };
}

const api = createHydrationWarmupGame();

export function boot(root, ctx) {
  return api.boot(root, ctx);
}

export function mount(root, ctx) {
  return api.boot(root, ctx);
}

if (typeof window !== 'undefined') {
  window.HHA_GATE_GAME = window.HHA_GATE_GAME || {};
  window.HHA_GATE_GAME.hydrationWarmup = api;
  window.HHA_GATE_BOOT = api.boot;
  window.HHA_GATE_MOUNT = api.boot;
}