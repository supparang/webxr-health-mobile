// === /herohealth/gate/games/shadowbreaker/cooldown.js ===
// FULL PATCH v20260327-SHADOWBREAKER-COOLDOWN

export default function mountShadowbreakerCooldown(ctx = {}){
  const mount = document.getElementById('gateGameMount') || ctx?.mountRoot || ctx?.root;
  if (!mount) return null;

  let remain = 10;
  let timer = null;
  let finished = false;

  function finish(){
    if (finished) return;
    finished = true;
    if (timer) clearInterval(timer);

    const result = {
      ok: true,
      phase: 'cooldown',
      game: 'shadowbreaker',
      summary: 'Cooldown complete'
    };

    window.__GATE_PHASE_RESULT__ = result;
    mount.dispatchEvent(new CustomEvent('gate:complete', {
      bubbles: true,
      detail: result
    }));
  }

  function render(){
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

    timer = setInterval(()=>{
      remain -= 1;
      if (remainEl) remainEl.textContent = String(remain);

      if (remain <= 0){
        finish();
      }
    }, 1000);

    btnSkip?.addEventListener('click', finish);
  }

  render();

  return {
    destroy(){
      if (timer) clearInterval(timer);
    }
  };
}