// === /herohealth/gate/games/shadowbreaker/cooldown.js ===
// Shadow Breaker Cooldown
// FULL PATCH v20260328-SB-COOLDOWN-CHILD-FRIENDLY

export default async function mountShadowBreakerCooldown(root, ctx = {}, api = {}) {
  const D = document;
  const q = ctx?.params || new URLSearchParams(location.search);

  const pid = String(ctx?.pid || q.get('pid') || 'anon').trim() || 'anon';
  const hub = String(ctx?.hub || q.get('hub') || '../hub.html').trim() || '../hub.html';

  const sum = loadSummary(pid);

  root.innerHTML = `
    <div class="sbcd-wrap">
      <div class="sbcd-stage">
        <div class="sbcd-cloud c1"></div>
        <div class="sbcd-cloud c2"></div>
        <div class="sbcd-cloud c3"></div>

        <div class="sbcd-card">
          <div class="sbcd-kicker">HeroHealth Gate • Cooldown</div>
          <h2 class="sbcd-title">พักแรงหลังจบเกม</h2>
          <p class="sbcd-sub">
            หายใจเข้าลึก ๆ แล้วหายใจออกช้า ๆ สักครู่ ก่อนดูผลสรุปของ Shadow Breaker
          </p>

          <div class="sbcd-badge">
            <div class="sbcd-badge-icon">${escapeHtml(sum?.badge?.icon || '🌿')}</div>
            <div>
              <div class="sbcd-badge-title">${escapeHtml(sum?.badge?.title || 'พร้อมพักฟื้น')}</div>
              <div class="sbcd-badge-desc">${escapeHtml(sum?.badge?.desc || 'ทำได้ดีแล้ว พักสักนิดก่อนดูผล')}</div>
            </div>
          </div>

          <div class="sbcd-breath-box">
            <div class="sbcd-breath-ball" id="sbcdBall"></div>
            <div class="sbcd-breath-text" id="sbcdBreathText">หายใจเข้า</div>
            <div class="sbcd-breath-mini" id="sbcdBreathMini">เตรียมพร้อมดูสรุปผล</div>
          </div>

          <div class="sbcd-stats">
            <div class="sbcd-stat">
              <div class="k">ผู้เล่น</div>
              <div class="v">${escapeHtml(pid)}</div>
            </div>
            <div class="sbcd-stat">
              <div class="k">คะแนน</div>
              <div class="v">${escapeHtml(String(sum?.scoreFinal ?? 0))}</div>
            </div>
            <div class="sbcd-stat">
              <div class="k">บอสที่ผ่าน</div>
              <div class="v">${escapeHtml(String(sum?.bossesCleared ?? 0))}</div>
            </div>
            <div class="sbcd-stat">
              <div class="k">เกรด</div>
              <div class="v">${escapeHtml(String(sum?.grade || 'C'))}</div>
            </div>
          </div>

          <div class="sbcd-progress">
            <div class="sbcd-progress-bar">
              <div class="sbcd-progress-fill" id="sbcdProgressFill"></div>
            </div>
            <div class="sbcd-progress-note" id="sbcdProgressNote">กำลังผ่อนแรง... 0%</div>
          </div>

          <div class="sbcd-actions">
            <button class="sbcd-btn sbcd-btn-primary" id="sbcdBtnSummary" type="button">ดูสรุปผล</button>
            <button class="sbcd-btn sbcd-btn-ghost" id="sbcdBtnHub" type="button">กลับ HUB</button>
          </div>
        </div>
      </div>
    </div>
  `;

  ensureStyle();

  const ball = D.getElementById('sbcdBall');
  const breathText = D.getElementById('sbcdBreathText');
  const breathMini = D.getElementById('sbcdBreathMini');
  const progressFill = D.getElementById('sbcdProgressFill');
  const progressNote = D.getElementById('sbcdProgressNote');
  const btnSummary = D.getElementById('sbcdBtnSummary');
  const btnHub = D.getElementById('sbcdBtnHub');

  const summaryHref = buildSummaryHref(sum, pid, hub);

  let done = false;
  let progress = 0;
  let raf = 0;
  let startTs = 0;

  const totalMs = 3200;
  const breathCycleMs = 1600;

  function tick(ts) {
    if (!startTs) startTs = ts;
    const elapsed = ts - startTs;

    progress = Math.max(0, Math.min(1, elapsed / totalMs));
    const pct = Math.round(progress * 100);

    if (progressFill) progressFill.style.width = `${pct}%`;
    if (progressNote) progressNote.textContent = `กำลังผ่อนแรง... ${pct}%`;

    const cycle = (elapsed % breathCycleMs) / breathCycleMs;
    if (ball) {
      const scale = cycle < 0.5
        ? 1 + (cycle / 0.5) * 0.22
        : 1.22 - ((cycle - 0.5) / 0.5) * 0.22;
      ball.style.transform = `scale(${scale.toFixed(3)})`;
    }

    if (breathText && breathMini) {
      if (cycle < 0.5) {
        breathText.textContent = 'หายใจเข้า';
        breathMini.textContent = 'ช้า ๆ ลึก ๆ';
      } else {
        breathText.textContent = 'หายใจออก';
        breathMini.textContent = 'ผ่อนแรงสบาย ๆ';
      }
    }

    if (elapsed >= totalMs) {
      finishToSummary();
      return;
    }

    raf = requestAnimationFrame(tick);
  }

  function finishToSummary() {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);

    if (typeof api?.complete === 'function') {
      api.complete({
        title: 'Cooldown เสร็จแล้ว',
        subtitle: 'พร้อมแล้ว ไปดูผลสรุปของ Shadow Breaker กัน',
        lines: [
          `ผู้เล่น: ${pid}`,
          `คะแนน: ${String(sum?.scoreFinal ?? 0)}`,
          `บอสที่ผ่าน: ${String(sum?.bossesCleared ?? 0)}`
        ],
        markDailyDone: true,
        summaryHref
      });
      try {
        sessionStorage.setItem('HHA_SHADOWBREAKER_SUMMARY_HREF', summaryHref);
      } catch {}
      setTimeout(() => {
        location.href = summaryHref;
      }, 180);
      return;
    }

    location.href = summaryHref;
  }

  btnSummary?.addEventListener('click', finishToSummary);
  btnHub?.addEventListener('click', () => {
    done = true;
    cancelAnimationFrame(raf);
    location.href = hub;
  });

  raf = requestAnimationFrame(tick);

  return {
    destroy() {
      done = true;
      cancelAnimationFrame(raf);
    }
  };
}

function buildSummaryHref(sum, pid, hub) {
  const url = new URL('/webxr-health-mobile/herohealth/shadow-breaker-summary.html', location.origin);
  url.searchParams.set('pid', String(sum?.pid || pid || 'anon'));
  url.searchParams.set('hub', String(hub || './hub.html'));
  if (sum?.mode) url.searchParams.set('mode', String(sum.mode));
  if (sum?.diff) url.searchParams.set('diff', String(sum.diff));
  return url.toString();
}

function loadSummary(pid) {
  const keys = [
    `SB_LAST_SUMMARY:${pid}`,
    `HHA_LAST_SUMMARY:shadowbreaker:${pid}`,
    'HHA_LAST_SUMMARY'
  ];

  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object') continue;
      if (obj.game && obj.game !== 'shadowbreaker') continue;
      if (obj.pid && String(obj.pid).trim() !== pid && key !== 'HHA_LAST_SUMMARY') continue;
      return obj;
    } catch {}
  }
  return null;
}

function escapeHtml(s = '') {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function ensureStyle() {
  if (document.getElementById('sbcd-style')) return;

  const style = document.createElement('style');
  style.id = 'sbcd-style';
  style.textContent = `
    .sbcd-wrap{
      min-height:100%;
      display:grid;
      place-items:center;
    }

    .sbcd-stage{
      position:relative;
      width:100%;
      min-height:300px;
      border-radius:24px;
      overflow:hidden;
      background:
        radial-gradient(circle at 18% 14%, rgba(127,207,255,.28), transparent 28%),
        radial-gradient(circle at 82% 10%, rgba(255,220,120,.22), transparent 24%),
        linear-gradient(180deg, #dff4ff 0%, #eefcff 48%, #fff7da 100%);
      border:1px solid rgba(191,227,242,.92);
      box-shadow:0 18px 40px rgba(111,157,183,.16);
      padding:18px;
    }

    .sbcd-cloud{
      position:absolute;
      background:rgba(255,255,255,.64);
      border-radius:999px;
      filter:blur(1px);
      pointer-events:none;
    }
    .sbcd-cloud.c1{ width:110px; height:34px; left:6%; top:10%; }
    .sbcd-cloud.c2{ width:140px; height:44px; right:10%; top:14%; }
    .sbcd-cloud.c3{ width:90px; height:30px; left:18%; bottom:16%; }

    .sbcd-card{
      position:relative;
      z-index:1;
      width:min(760px,100%);
      margin:0 auto;
      padding:18px;
      border-radius:26px;
      border:1px solid rgba(191,227,242,.92);
      background:linear-gradient(180deg, rgba(255,253,246,.94), rgba(248,255,243,.96));
      box-shadow:0 16px 34px rgba(111,157,183,.14);
    }

    .sbcd-kicker{
      display:inline-flex;
      align-items:center;
      min-height:34px;
      padding:6px 12px;
      border-radius:999px;
      background:#fff;
      border:1px solid rgba(191,227,242,.92);
      color:#5f7b88;
      font-size:.82rem;
      font-weight:1000;
    }

    .sbcd-title{
      margin:12px 0 8px;
      font-size:clamp(1.5rem,4vw,2.2rem);
      line-height:1.06;
      color:#4f8f2c;
      font-weight:1000;
    }

    .sbcd-sub{
      margin:0;
      color:#786c61;
      line-height:1.55;
      font-weight:800;
      font-size:.96rem;
    }

    .sbcd-badge{
      margin-top:14px;
      display:grid;
      grid-template-columns:64px 1fr;
      gap:12px;
      align-items:center;
      padding:12px;
      border-radius:22px;
      background:linear-gradient(180deg, #fffdf6, #f8fff3);
      border:1px solid rgba(191,227,242,.92);
      box-shadow:0 8px 16px rgba(111,157,183,.10);
    }

    .sbcd-badge-icon{
      width:64px;
      height:64px;
      border-radius:20px;
      display:grid;
      place-items:center;
      background:linear-gradient(180deg, #fff8d8, #ffe79b);
      border:1px solid #f6d97a;
      font-size:1.9rem;
    }

    .sbcd-badge-title{
      color:#5a4a3f;
      font-size:1rem;
      font-weight:1000;
    }

    .sbcd-badge-desc{
      margin-top:4px;
      color:#786c61;
      font-size:.9rem;
      line-height:1.45;
      font-weight:800;
    }

    .sbcd-breath-box{
      margin-top:16px;
      display:grid;
      place-items:center;
      gap:10px;
      padding:18px 14px;
      border-radius:24px;
      background:linear-gradient(180deg, rgba(223,244,255,.92), rgba(255,255,255,.78));
      border:1px solid rgba(191,227,242,.92);
    }

    .sbcd-breath-ball{
      width:92px;
      height:92px;
      border-radius:999px;
      background:linear-gradient(180deg, #8fe388, #58c33f);
      box-shadow:
        0 14px 24px rgba(88,195,63,.18),
        inset 0 8px 18px rgba(255,255,255,.28);
      transform:scale(1);
      transition:transform .15s linear;
    }

    .sbcd-breath-text{
      font-size:1.1rem;
      color:#4f8f2c;
      font-weight:1000;
    }

    .sbcd-breath-mini{
      color:#7b7a72;
      font-size:.88rem;
      font-weight:900;
    }

    .sbcd-stats{
      margin-top:14px;
      display:grid;
      grid-template-columns:repeat(4,minmax(0,1fr));
      gap:10px;
    }

    .sbcd-stat{
      padding:12px;
      border-radius:18px;
      background:#fff;
      border:1px solid rgba(191,227,242,.92);
      box-shadow:0 8px 16px rgba(111,157,183,.08);
      text-align:center;
    }

    .sbcd-stat .k{
      color:#7b7a72;
      font-size:.8rem;
      font-weight:1000;
    }

    .sbcd-stat .v{
      margin-top:6px;
      color:#5a4a3f;
      font-size:1.08rem;
      font-weight:1000;
    }

    .sbcd-progress{
      margin-top:14px;
    }

    .sbcd-progress-bar{
      height:14px;
      border-radius:999px;
      overflow:hidden;
      background:rgba(210,236,246,.82);
      border:1px solid rgba(191,227,242,.92);
    }

    .sbcd-progress-fill{
      height:100%;
      width:0%;
      background:linear-gradient(90deg, #7ed957, #58c33f);
      transition:width .12s linear;
    }

    .sbcd-progress-note{
      margin-top:8px;
      color:#7a6a3c;
      font-size:.82rem;
      font-weight:1000;
      text-align:center;
    }

    .sbcd-actions{
      margin-top:16px;
      display:flex;
      gap:10px;
      flex-wrap:wrap;
      justify-content:center;
    }

    .sbcd-btn{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-height:46px;
      padding:10px 14px;
      border-radius:18px;
      border:1px solid rgba(191,227,242,.92);
      background:#fff;
      color:#5a4a3f;
      font-weight:1000;
      cursor:pointer;
      box-shadow:0 10px 18px rgba(111,157,183,.12);
    }

    .sbcd-btn-primary{
      background:linear-gradient(180deg, #8fe388, #58c33f);
      border-color:#74c864;
      color:#fffdf6;
    }

    .sbcd-btn-ghost{
      background:linear-gradient(180deg, #eef9ff, #e3f5ff);
      color:#5d6a70;
    }

    @media (max-width: 760px){
      .sbcd-card{ padding:14px; }
      .sbcd-stats{ grid-template-columns:repeat(2,minmax(0,1fr)); }
      .sbcd-actions{ flex-direction:column; }
      .sbcd-btn{ width:100%; }
    }
  `;
  document.head.appendChild(style);
}