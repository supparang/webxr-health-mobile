// === /herohealth/gate/games/shadowbreaker/warmup.js ===
// Shadow Breaker Warmup
// FULL PATCH v20260328-SB-WARMUP-CHILD-FRIENDLY

export default async function mountShadowBreakerWarmup(root, ctx = {}, api = {}) {
  const D = document;
  const q = ctx?.params || new URLSearchParams(location.search);

  const pid = String(ctx?.pid || q.get('pid') || 'anon').trim() || 'anon';
  const targetHits = 6;

  ensureStyle();

  root.innerHTML = `
    <div class="sbwu-wrap">
      <div class="sbwu-stage">
        <div class="sbwu-cloud c1"></div>
        <div class="sbwu-cloud c2"></div>
        <div class="sbwu-cloud c3"></div>

        <div class="sbwu-card">
          <div class="sbwu-kicker">HeroHealth Gate • Warmup</div>
          <h2 class="sbwu-title">อุ่นเครื่องก่อนลุยบอส</h2>
          <p class="sbwu-sub">
            แตะดาวให้ครบ <b>${targetHits}</b> ครั้ง เพื่อเตรียมตัวก่อนเข้า Shadow Breaker
          </p>

          <div class="sbwu-player">ผู้เล่น: <b>${escapeHtml(pid)}</b></div>

          <div class="sbwu-progress">
            <div class="sbwu-progress-bar">
              <div class="sbwu-progress-fill" id="sbwuProgressFill"></div>
            </div>
            <div class="sbwu-progress-note" id="sbwuProgressNote">แตะแล้ว 0 / ${targetHits}</div>
          </div>

          <div class="sbwu-playbox" id="sbwuPlaybox">
            <button id="sbwuTarget" class="sbwu-target" type="button" aria-label="แตะดาว">⭐</button>
          </div>

          <div class="sbwu-tip" id="sbwuTip">แตะดาวเมื่อพร้อมได้เลย</div>

          <div class="sbwu-actions">
            <button class="sbwu-btn sbwu-btn-primary" id="sbwuBtnSkip" type="button">ข้าม warmup</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const playbox = D.getElementById('sbwuPlaybox');
  const target = D.getElementById('sbwuTarget');
  const progressFill = D.getElementById('sbwuProgressFill');
  const progressNote = D.getElementById('sbwuProgressNote');
  const tip = D.getElementById('sbwuTip');
  const btnSkip = D.getElementById('sbwuBtnSkip');

  let hits = 0;
  let done = false;
  let busy = false;

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function moveTarget() {
    if (!playbox || !target) return;

    const box = playbox.getBoundingClientRect();
    const t = target.getBoundingClientRect();

    const pad = 10;
    const maxX = Math.max(pad, box.width - t.width - pad);
    const maxY = Math.max(pad, box.height - t.height - pad);

    const x = rand(pad, maxX);
    const y = rand(pad, maxY);

    target.style.left = `${x}px`;
    target.style.top = `${y}px`;
  }

  function updateProgress() {
    const pct = Math.round((hits / targetHits) * 100);
    if (progressFill) progressFill.style.width = `${pct}%`;
    if (progressNote) progressNote.textContent = `แตะแล้ว ${hits} / ${targetHits}`;

    if (tip) {
      if (hits < targetHits) {
        tip.textContent = hits === 0
          ? 'แตะดาวเมื่อพร้อมได้เลย'
          : 'เก่งมาก แตะต่ออีกนิด';
      } else {
        tip.textContent = 'พร้อมแล้ว ไปเข้าเกมจริงกันเลย!';
      }
    }
  }

  function finishWarmup(skipped = false) {
    if (done) return;
    done = true;

    if (target) {
      target.disabled = true;
      target.classList.add('is-done');
    }

    if (typeof api?.complete === 'function') {
      api.complete({
        title: skipped ? 'ข้าม warmup แล้ว' : 'Warmup เสร็จแล้ว',
        subtitle: skipped
          ? 'ระบบกำลังพาเข้าเกมหลัก'
          : 'อุ่นเครื่องเรียบร้อย พร้อมเข้า Shadow Breaker',
        lines: skipped
          ? [`ผู้เล่น: ${pid}`, 'สถานะ: skipped']
          : [`ผู้เล่น: ${pid}`, `แตะดาวครบ ${targetHits} ครั้งแล้ว`],
        markDailyDone: true
      });
      return;
    }

    root.dispatchEvent(new CustomEvent('gate:complete', {
      bubbles: true,
      detail: {
        title: skipped ? 'ข้าม warmup แล้ว' : 'Warmup เสร็จแล้ว',
        subtitle: skipped
          ? 'ระบบกำลังพาเข้าเกมหลัก'
          : 'อุ่นเครื่องเรียบร้อย พร้อมเข้า Shadow Breaker',
        markDailyDone: true
      }
    }));
  }

  target?.addEventListener('click', async () => {
    if (done || busy) return;
    busy = true;

    hits += 1;
    updateProgress();

    target.classList.add('pop');
    setTimeout(() => target.classList.remove('pop'), 140);

    if (hits >= targetHits) {
      setTimeout(() => finishWarmup(false), 450);
      return;
    }

    moveTarget();
    setTimeout(() => { busy = false; }, 80);
  });

  btnSkip?.addEventListener('click', () => finishWarmup(true));

  updateProgress();
  setTimeout(moveTarget, 40);

  return {
    destroy() {
      done = true;
    }
  };
}

function escapeHtml(s = '') {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function ensureStyle() {
  if (document.getElementById('sbwu-style')) return;

  const style = document.createElement('style');
  style.id = 'sbwu-style';
  style.textContent = `
    .sbwu-wrap{
      min-height:100%;
      display:grid;
      place-items:center;
    }

    .sbwu-stage{
      position:relative;
      width:100%;
      min-height:320px;
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

    .sbwu-cloud{
      position:absolute;
      background:rgba(255,255,255,.64);
      border-radius:999px;
      filter:blur(1px);
      pointer-events:none;
    }
    .sbwu-cloud.c1{ width:110px; height:34px; left:6%; top:10%; }
    .sbwu-cloud.c2{ width:140px; height:44px; right:10%; top:14%; }
    .sbwu-cloud.c3{ width:90px; height:30px; left:18%; bottom:16%; }

    .sbwu-card{
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

    .sbwu-kicker{
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

    .sbwu-title{
      margin:12px 0 8px;
      font-size:clamp(1.5rem,4vw,2.2rem);
      line-height:1.06;
      color:#4f8f2c;
      font-weight:1000;
    }

    .sbwu-sub{
      margin:0;
      color:#786c61;
      line-height:1.55;
      font-weight:800;
      font-size:.96rem;
    }

    .sbwu-player{
      margin-top:10px;
      color:#7b7a72;
      font-size:.88rem;
      font-weight:900;
    }

    .sbwu-progress{
      margin-top:14px;
    }

    .sbwu-progress-bar{
      height:14px;
      border-radius:999px;
      overflow:hidden;
      background:rgba(210,236,246,.82);
      border:1px solid rgba(191,227,242,.92);
    }

    .sbwu-progress-fill{
      height:100%;
      width:0%;
      background:linear-gradient(90deg, #7ed957, #58c33f);
      transition:width .12s linear;
    }

    .sbwu-progress-note{
      margin-top:8px;
      color:#7a6a3c;
      font-size:.82rem;
      font-weight:1000;
      text-align:center;
    }

    .sbwu-playbox{
      position:relative;
      margin-top:16px;
      min-height:260px;
      border-radius:24px;
      background:
        radial-gradient(circle at 50% 18%, rgba(125,211,252,.14), transparent 34%),
        linear-gradient(180deg, rgba(255,255,255,.82), rgba(248,255,243,.92));
      border:1px solid rgba(191,227,242,.92);
      overflow:hidden;
    }

    .sbwu-target{
      position:absolute;
      left:50%;
      top:50%;
      transform:translate(-50%, -50%);
      width:92px;
      height:92px;
      border:none;
      border-radius:999px;
      background:linear-gradient(180deg, #ffd96a, #ffbe3b);
      box-shadow:
        0 14px 24px rgba(255,190,59,.18),
        inset 0 8px 18px rgba(255,255,255,.28);
      font-size:2rem;
      cursor:pointer;
      transition:transform .14s ease, box-shadow .14s ease, opacity .14s ease;
    }

    .sbwu-target.pop{
      transform:scale(1.08);
    }

    .sbwu-target.is-done{
      opacity:.72;
      cursor:default;
    }

    .sbwu-tip{
      margin-top:12px;
      text-align:center;
      color:#7b7a72;
      font-size:.9rem;
      font-weight:1000;
    }

    .sbwu-actions{
      margin-top:16px;
      display:flex;
      gap:10px;
      flex-wrap:wrap;
      justify-content:center;
    }

    .sbwu-btn{
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

    .sbwu-btn-primary{
      background:linear-gradient(180deg, #8fe388, #58c33f);
      border-color:#74c864;
      color:#fffdf6;
    }

    @media (max-width: 760px){
      .sbwu-card{ padding:14px; }
      .sbwu-playbox{ min-height:220px; }
      .sbwu-actions{ flex-direction:column; }
      .sbwu-btn{ width:100%; }
    }
  `;
  document.head.appendChild(style);
}