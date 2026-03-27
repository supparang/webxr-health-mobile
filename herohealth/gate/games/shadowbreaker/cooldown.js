// === /herohealth/gate/games/shadowbreaker/cooldown.js ===
// FULL PATCH v20260327c-SHADOWBREAKER-COOLDOWN-GATECORE-COMPAT

export default function mountShadowbreakerCooldown(mountRoot, ctx = {}, api = {}) {
  const mount =
    mountRoot ||
    document.getElementById('gateGameMount') ||
    ctx?.mountRoot ||
    ctx?.root ||
    api?.mountRoot ||
    api?.root;

  if (!mount) {
    console.warn('[shadowbreaker cooldown] mount root not found');
    return null;
  }

  let remain = 10;
  let timer = null;
  let finished = false;

  function pushStats() {
    try {
      api?.setStats?.({
        time: remain,
        score: 0,
        miss: 0,
        acc: '100%'
      });
    } catch (_) {}
  }

  function complete(detail = {}) {
    if (finished) return;
    finished = true;

    if (timer) {
      clearInterval(timer);
      timer = null;
    }

    const payload = {
      ok: true,
      phase: 'cooldown',
      game: 'shadowbreaker',
      title: 'Cooldown เสร็จแล้ว',
      subtitle: 'พักเรียบร้อยแล้ว กำลังไปหน้าสรุป',
      lines: [
        'หายใจเข้าออกช้า ๆ ได้ดีมาก',
        'พร้อมดูผลสรุปของรอบนี้แล้ว'
      ],
      ...detail
    };

    window.__GATE_PHASE_RESULT__ = payload;

    try {
      mount.dispatchEvent(new CustomEvent('gate:complete', {
        bubbles: true,
        detail: payload
      }));
    } catch (err) {
      console.warn('[shadowbreaker cooldown] dispatch gate:complete failed', err);
      try { api?.complete?.(payload); } catch (_) {}
    }
  }

  function render() {
    mount.innerHTML = `
      <div class="sb-mini-card" style="padding:16px;">
        <div style="font-size:14px;font-weight:900;color:#94a3b8;">Shadow Breaker • Cooldown</div>
        <h2 style="margin:8px 0 6px;">ผ่อนแรงหลังจบเกม</h2>
        <div style="color:#94a3b8;font-weight:800;line-height:1.5;">
          หายใจเข้าออกช้า ๆ แล้วระบบจะพาไปหน้าสรุป
        </div>

        <div style="display:grid;place-items:center;margin-top:16px;">
          <div style="width:140px;height:140px;border-radius:999px;display:grid;place-items:center;background:rgba(34,197,94,.14);font-size:52px;box-shadow:0 18px 36px rgba(0,0,0,.24);">
            🌿
          </div>
        </div>

        <div style="margin-top:16px;padding:10px 12px;border-radius:999px;background:rgba(15,23,42,.56);font-weight:900;display:inline-flex;">
          ไปหน้าสรุปใน <span id="sbCoolRemain" style="margin-left:6px;">${remain}</span> วินาที
        </div>

        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;">
          <button id="sbCoolSkip" type="button"
            style="min-height:42px;padding:10px 14px;border-radius:14px;border:1px solid rgba(148,163,184,.22);background:rgba(148,163,184,.10);color:#e5e7eb;font-weight:1000;cursor:pointer;">
            ไปหน้าสรุปเลย
          </button>
        </div>
      </div>
    `;

    const remainEl = document.getElementById('sbCoolRemain');
    const btnSkip = document.getElementById('sbCoolSkip');

    try {
      api?.setTitle?.('Shadow Breaker Cooldown');
      api?.setSub?.('ผ่อนแรงสั้น ๆ ก่อนดูผลสรุป');
    } catch (_) {}

    pushStats();

    timer = setInterval(() => {
      if (finished) return;

      remain -= 1;
      if (remainEl) remainEl.textContent = String(Math.max(0, remain));

      pushStats();

      if (remain <= 0) {
        complete();
      }
    }, 1000);

    btnSkip?.addEventListener('click', () => {
      complete({
        skipped: true,
        subtitle: 'ข้าม cooldown แล้ว กำลังไปหน้าสรุป'
      });
    });
  }

  render();

  return {
    start() {
      try {
        api?.setTitle?.('Shadow Breaker Cooldown');
        api?.setSub?.('ผ่อนแรงสั้น ๆ ก่อนดูผลสรุป');
      } catch (_) {}
    },
    destroy() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }
  };
}
