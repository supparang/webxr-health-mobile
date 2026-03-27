// === /herohealth/gate/games/shadowbreaker/warmup.js ===
// FULL PATCH v20260327-SHADOWBREAKER-WARMUP

export default function mountShadowbreakerWarmup(ctx = {}){
  const mount = document.getElementById('gateGameMount') || ctx?.mountRoot || ctx?.root;
  if (!mount) return null;

  let hits = 0;
  let remain = 15;
  let timer = null;
  let started = false;
  let finished = false;

  function finish(){
    if (finished) return;
    finished = true;
    if (timer) clearInterval(timer);

    const buffPct = Math.min(15, 5 + Math.floor(hits / 4));
    const result = {
      ok: true,
      phase: 'warmup',
      game: 'shadowbreaker',
      score: hits,
      summary: `Warmup hits ${hits}`,
      buff: {
        wType: 'shadow',
        wPct: buffPct
      }
    };

    window.__GATE_PHASE_RESULT__ = result;
    mount.dispatchEvent(new CustomEvent('gate:complete', {
      bubbles: true,
      detail: result
    }));
  }

  function startTimer(){
    if (started) return;
    started = true;

    timer = setInterval(()=>{
      remain -= 1;

      const remainEl = document.getElementById('sbWarmRemain');
      if (remainEl) remainEl.textContent = String(remain);

      if (remain <= 0){
        finish();
      }
    }, 1000);
  }

  function render(){
    mount.innerHTML = `
      <div class="sb-mini-card" style="padding:16px;">
        <div style="font-size:14px;font-weight:900;color:#94a3b8;">Shadow Breaker • Warmup</div>
        <h2 style="margin:8px 0 6px;">อุ่นเครื่องก่อนลุยบอส</h2>
        <div style="color:#94a3b8;font-weight:800;line-height:1.5;">
          แตะดาวให้ได้มากที่สุดภายใน <span id="sbWarmRemain">${remain}</span> วินาที
        </div>

        <div style="display:grid;place-items:center;margin-top:16px;">
          <button id="sbWarmTap"
            type="button"
            aria-label="Tap star"
            style="width:140px;height:140px;border-radius:999px;border:0;font-size:54px;cursor:pointer;background:rgba(59,130,246,.18);box-shadow:0 18px 36px rgba(0,0,0,.24);">
            ⭐
          </button>
        </div>

        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;">
          <div style="padding:8px 12px;border-radius:999px;background:rgba(15,23,42,.56);font-weight:900;">แตะได้: <span id="sbWarmHits">${hits}</span></div>
          <div style="padding:8px 12px;border-radius:999px;background:rgba(15,23,42,.56);font-weight:900;">เป้าหมาย: 20+</div>
        </div>

        <div style="margin-top:12px;color:#94a3b8;font-size:.9rem;font-weight:800;line-height:1.5;">
          เคล็ดลับ: แตะไว ๆ แบบสม่ำเสมอ จะได้บัฟก่อนเข้าเล่น
        </div>

        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;">
          <button id="sbWarmSkip" type="button"
            style="min-height:42px;padding:10px 14px;border-radius:14px;border:1px solid rgba(148,163,184,.22);background:rgba(148,163,184,.10);color:#e5e7eb;font-weight:1000;cursor:pointer;">
            ข้าม warmup
          </button>
        </div>
      </div>
    `;

    const btnTap = document.getElementById('sbWarmTap');
    const btnSkip = document.getElementById('sbWarmSkip');

    btnTap?.addEventListener('click', ()=>{
      if (finished) return;
      startTimer();
      hits += 1;

      const hitsEl = document.getElementById('sbWarmHits');
      if (hitsEl) hitsEl.textContent = String(hits);

      btnTap.style.transform = 'scale(.94)';
      setTimeout(()=>{ btnTap.style.transform = 'scale(1)'; }, 90);
    });

    btnSkip?.addEventListener('click', finish);
  }

  render();

  return {
    destroy(){
      if (timer) clearInterval(timer);
    }
  };
}