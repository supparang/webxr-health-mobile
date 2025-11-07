// === Hero Health Academy — mode-factory.js (Production Safe 2025-11-07) ===

export async function factoryBoot(config = {}) {
  const host = config.host || document.querySelector('#spawnHost');
  const name = config.name || 'unknown';
  const diff = config.difficulty || 'normal';
  const duration = config.duration || 60;

  console.log('[ModeFactory] Boot:', name, diff);

  let running = true;
  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let missionGood = 0;
  let goal = 0;

  const startTime = Date.now();
  const endTime = startTime + duration * 1000;

  // --- Safe dispatcher ---
  function dispatch(event, detail = {}) {
    try {
      window.dispatchEvent(new CustomEvent(event, { detail }));
    } catch (err) {
      console.warn('[dispatch fail]', err);
    }
  }

  // --- Safe click handler ---
  function addClickTarget(el, good = true) {
    el.addEventListener('click', () => {
      if (!running) return;
      if (good) {
        score += 10;
        combo++;
        missionGood++;
        if (combo > comboMax) comboMax = combo;
        dispatch('hha:score', { score, combo });
        try { el.remove(); } catch {}
      } else {
        combo = 0;
        score -= 5;
        dispatch('hha:score', { score, combo });
        try { el.remove(); } catch {}
      }
    });
  }

  // --- Dummy spawn (emoji ball) ---
  function spawnEmoji() {
    if (!running) return;
    const emoji = document.createElement('a-text');
    emoji.setAttribute('value', Math.random() < 0.5 ? '🍎' : '🍔');
    emoji.setAttribute('position', `${(Math.random() - 0.5) * 2} ${(Math.random() - 0.5) * 1.5} -2`);
    emoji.setAttribute('scale', '2 2 2');
    host.appendChild(emoji);
    addClickTarget(emoji, emoji.getAttribute('value') === '🍎');
  }

  // --- Timer tick ---
  const timer = setInterval(() => {
    if (!running) return;
    const remain = Math.max(0, Math.round((endTime - Date.now()) / 1000));
    dispatch('hha:time', { sec: remain });
    if (remain <= 0) endGame('หมดเวลา');
  }, 1000);

  // --- Spawner tick ---
  const spawner = setInterval(() => {
    if (!running) return;
    spawnEmoji();
  }, 1200);

  // --- End game ---
  function endGame(reason = 'stop') {
    if (!running) return;
    running = false;
    clearInterval(timer);
    clearInterval(spawner);

    dispatch('hha:end', {
      reason,
      score,
      missionGood,
      goal,
      comboMax
    });
  }

  console.log(`[ModeFactory] ${name} started (${diff})`);

  // return API (used by boot())
  return {
    stop: () => endGame('หยุดเกม'),
    pause: () => { running = false; },
    resume: () => { running = true; },
  };
}

export default { factoryBoot };