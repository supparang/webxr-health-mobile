// === /herohealth/gate/games/hygiene/cooldown.js ===
// Handwash Cooldown — Clean Finish Check
// FULL PATCH v20260314a-COOLDOWN-HANDWASH
// ✅ child-friendly
// ✅ no stuck overlay
// ✅ summary shows only after finish
// ✅ supports ctx.onDone / ctx.next / ctx.hub

function esc(s){
  return String(s ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;');
}

export function boot(root, ctx = {}){
  if(!root) return;

  // กัน mount ซ้ำ / state ค้าง
  root.innerHTML = '';

  let started = false;
  let finished = false;
  let rafId = 0;

  let startTs = 0;
  let timeLeft = 20;
  let score = 0;
  let miss = 0;

  const targetNeed = 3;
  const picks = [];

  // เกม cooldown: เลือก “สิ่งที่ควรทำหลังล้างมือ” ให้ครบ 3 ข้อ
  const options = [
    { key:'rinse', icon:'💧', title:'ล้างฟองออกให้สะอาด', desc:'ล้างมือด้วยน้ำสะอาดจนฟองหมด', ok:true, order:1 },
    { key:'dry', icon:'🧻', title:'เช็ดมือให้แห้ง', desc:'ใช้ผ้าสะอาดหรือกระดาษเช็ดมือให้แห้ง', ok:true, order:2 },
    { key:'ready', icon:'✨', title:'มือสะอาด พร้อมไปต่อ', desc:'มือแห้งสะอาดแล้ว ค่อยไปทำกิจกรรมต่อ', ok:true, order:3 },

    { key:'shake', icon:'💦', title:'สะบัดน้ำใส่เพื่อน', desc:'ทำให้รอบตัวเปียกและไม่สุภาพ', ok:false },
    { key:'shirt', icon:'👕', title:'เช็ดกับเสื้อ', desc:'เสื้ออาจไม่สะอาดพอสำหรับเช็ดมือ', ok:false },
    { key:'run', icon:'🏃', title:'วิ่งออกไปทั้งมือเปียก', desc:'มือยังไม่แห้งและอาจจับของสกปรกต่อทันที', ok:false }
  ];

  root.innerHTML = `
    <div class="hwq-root">
      <div class="hwq-panel">

        <header class="hwq-top">
          <div class="hwq-title">Handwash Cooldown</div>
          <div class="hwq-sub">ทบทวนก่อนกลับ</div>

          <div class="hwq-pills">
            <div class="hwq-pill">PHASE: cooldown</div>
            <div class="hwq-pill">CAT: hygiene</div>
            <div class="hwq-pill">GAME: Handwash</div>
            <div class="hwq-pill">DAILY: REVIEW</div>
          </div>

          <div class="hwq-stats">
            <div class="hwq-stat">
              <div class="hwq-stat-lab">TIME</div>
              <div class="hwq-stat-val" id="hwqTime">20s</div>
            </div>
            <div class="hwq-stat">
              <div class="hwq-stat-lab">SCORE</div>
              <div class="hwq-stat-val" id="hwqScore">0</div>
            </div>
            <div class="hwq-stat">
              <div class="hwq-stat-lab">MISS</div>
              <div class="hwq-stat-val" id="hwqMiss">0</div>
            </div>
            <div class="hwq-stat">
              <div class="hwq-stat-lab">ACC / PROGRESS</div>
              <div class="hwq-stat-val" id="hwqAcc">0% • 0/${targetNeed}</div>
            </div>
          </div>
        </header>

        <div class="hwq-banner" id="hwqBanner" aria-live="polite"></div>

        <section class="hwq-game" id="hwqGame" aria-label="cooldown game">
          <div class="hwq-grid">
            <div class="hwq-col">
              <div class="hwq-box">
                <div class="hwq-box-top">
                  <div class="hwq-chip">เป้าหมาย: ปิดท้าย 3 ขั้น</div>
                  <div class="hwq-chip">ห้ามเลือกตัวหลอก</div>
                </div>

                <div class="hwq-box-title">สิ่งที่ควรทำหลังล้างมือ</div>
                <div class="hwq-box-sub">แตะตัวเลือกที่ถูกต้องให้ครบ 3 ข้อตามลำดับ</div>

                <div class="hwq-slots" id="hwqSlots">
                  <div class="hwq-slot" data-slot="0">
                    <div class="hwq-slot-num">1</div>
                    <div class="hwq-slot-main">
                      <div class="hwq-slot-title">ยังไม่ได้เลือก</div>
                      <div class="hwq-slot-sub">รอการเลือก</div>
                    </div>
                  </div>
                  <div class="hwq-slot" data-slot="1">
                    <div class="hwq-slot-num">2</div>
                    <div class="hwq-slot-main">
                      <div class="hwq-slot-title">ยังไม่ได้เลือก</div>
                      <div class="hwq-slot-sub">รอการเลือก</div>
                    </div>
                  </div>
                  <div class="hwq-slot" data-slot="2">
                    <div class="hwq-slot-num">3</div>
                    <div class="hwq-slot-main">
                      <div class="hwq-slot-title">ยังไม่ได้เลือก</div>
                      <div class="hwq-slot-sub">รอการเลือก</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="hwq-col">
              <div class="hwq-box">
                <div class="hwq-box-title">ตัวเลือก</div>
                <div class="hwq-box-sub">เลือกสิ่งที่ควรทำหลังล้างมือทีละข้อ</div>

                <div class="hwq-options" id="hwqOptions">
                  ${options.map((o, i)=>`
                    <button type="button" class="hwq-opt" data-idx="${i}">
                      <div class="hwq-opt-icon">${esc(o.icon)}</div>
                      <div class="hwq-opt-main">
                        <div class="hwq-opt-title">${esc(o.title)}</div>
                        <div class="hwq-opt-sub">${esc(o.desc)}</div>
                      </div>
                    </button>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="hwq-summary" id="hwqSummary" style="display:none">
          <div class="hwq-summary-title">สรุปผล</div>
          <div class="hwq-summary-sub" id="hwqSummarySub">พร้อมไปต่อ</div>

          <div class="hwq-actions">
            <button type="button" class="hwq-btn ghost" data-act="hub">กลับ HUB</button>
            <button type="button" class="hwq-btn primary" data-act="next">ไปต่อ</button>
          </div>
        </section>

        <div class="hwq-start-overlay" id="hwqStartOverlay">
          <div class="hwq-start-card">
            <div class="hwq-start-title">Cooldown — Handwash Clean Finish</div>
            <div class="hwq-start-sub">
              เลือก 3 สิ่งที่ควรทำหลังล้างมือให้ถูกตามลำดับ ภายใน 20 วินาที
            </div>
            <div class="hwq-actions center">
              <button type="button" class="hwq-btn primary" data-act="start">เริ่มทบทวน</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;

  const elTime = root.querySelector('#hwqTime');
  const elScore = root.querySelector('#hwqScore');
  const elMiss = root.querySelector('#hwqMiss');
  const elAcc = root.querySelector('#hwqAcc');
  const elBanner = root.querySelector('#hwqBanner');

  const gameEl = root.querySelector('#hwqGame');
  const summaryEl = root.querySelector('#hwqSummary');
  const summarySubEl = root.querySelector('#hwqSummarySub');
  const slotsEl = root.querySelector('#hwqSlots');
  const optsEl = root.querySelector('#hwqOptions');

  const overlay = root.querySelector('#hwqStartOverlay');
  const btnStart = root.querySelector('[data-act="start"]');
  const btnHub = root.querySelector('[data-act="hub"]');
  const btnNext = root.querySelector('[data-act="next"]');

  function showBanner(msg){
    if(!elBanner) return;
    elBanner.textContent = msg || '';
    elBanner.classList.toggle('show', !!msg);
    clearTimeout(showBanner._t);
    if(msg){
      showBanner._t = setTimeout(()=>{
        if(elBanner) elBanner.classList.remove('show');
      }, 1400);
    }
  }

  function setSummaryVisible(on){
    if(summaryEl) summaryEl.style.display = on ? 'block' : 'none';
  }

  function setPlayingUI(on){
    if(gameEl) gameEl.style.pointerEvents = on ? 'auto' : 'none';
    if(optsEl) optsEl.style.pointerEvents = on ? 'auto' : 'none';
  }

  function hideStartOverlay(){
    if(!overlay) return;
    overlay.classList.add('is-hidden');
    overlay.setAttribute('aria-hidden', 'true');
  }

  function updateHUD(){
    if(elTime) elTime.textContent = `${Math.max(0, Math.ceil(timeLeft))}s`;
    if(elScore) elScore.textContent = String(score);
    if(elMiss) elMiss.textContent = String(miss);

    const acc = (score + miss) > 0 ? Math.round((score / (score + miss)) * 100) : 0;
    if(elAcc) elAcc.textContent = `${acc}% • ${picks.length}/${targetNeed}`;
  }

  function paintSlots(){
    const nodes = [...slotsEl.querySelectorAll('.hwq-slot')];
    for(let i=0;i<nodes.length;i++){
      const slot = nodes[i];
      const mainTitle = slot.querySelector('.hwq-slot-title');
      const mainSub = slot.querySelector('.hwq-slot-sub');
      const pick = picks[i];

      if(pick){
        mainTitle.textContent = `${pick.icon} ${pick.title}`;
        mainSub.textContent = pick.desc;
        slot.classList.add('filled');
      }else{
        mainTitle.textContent = 'ยังไม่ได้เลือก';
        mainSub.textContent = 'รอการเลือก';
        slot.classList.remove('filled');
      }
    }
  }

  function setOptionState(btn, state){
    btn.classList.remove('correct','wrong','disabled');
    if(state) btn.classList.add(state);
  }

  function disableAllOptions(){
    const btns = [...optsEl.querySelectorAll('.hwq-opt')];
    btns.forEach(b=>{
      b.disabled = true;
      b.classList.add('disabled');
    });
  }

  function enableAllOptions(){
    const btns = [...optsEl.querySelectorAll('.hwq-opt')];
    btns.forEach(b=>{
      b.disabled = false;
      b.classList.remove('disabled');
      b.classList.remove('correct','wrong');
    });
  }

  function buildResult(){
    const cleared = picks.length >= targetNeed;
    const acc = (score + miss) > 0 ? Math.round((score / (score + miss)) * 100) : 0;

    return {
      ok: cleared,
      score,
      miss,
      acc,
      picks: picks.map(p => ({ key:p.key, order:p.order, title:p.title })),
      targetNeed,
      game: 'handwash',
      phase: 'cooldown',
      cat: 'hygiene',
      theme: 'handwash'
    };
  }

  function finishGame(){
    if(finished) return;
    finished = true;
    started = false;

    if(rafId) cancelAnimationFrame(rafId);

    setPlayingUI(false);
    disableAllOptions();

    const result = buildResult();

    if(summarySubEl){
      summarySubEl.textContent = result.ok
        ? 'เยี่ยมมาก! พร้อมไปต่อ'
        : 'ยังไม่ครบ แต่ทบทวนแล้ว ไปต่อได้';
    }

    setSummaryVisible(true);
    showBanner(result.ok ? '✅ ทบทวนครบแล้ว' : '⏱️ หมดเวลา');

    try{
      ctx.setResult?.(result);
    }catch(_){}
  }

  function tick(){
    if(!started || finished) return;

    const elapsed = (performance.now() - startTs) / 1000;
    timeLeft = Math.max(0, 20 - elapsed);
    updateHUD();

    if(timeLeft <= 0){
      finishGame();
      return;
    }

    rafId = requestAnimationFrame(tick);
  }

  function startGame(){
    if(started || finished) return;
    started = true;

    hideStartOverlay();
    setSummaryVisible(false);
    setPlayingUI(true);
    enableAllOptions();

    startTs = performance.now();
    timeLeft = 20;
    score = 0;
    miss = 0;
    picks.length = 0;

    paintSlots();
    updateHUD();
    showBanner('เริ่มเลย! เลือกสิ่งที่ควรทำหลังล้างมือให้ถูก');

    tick();
  }

  function onPick(idx){
    if(!started || finished) return;
    if(picks.length >= targetNeed) return;

    const btn = optsEl.querySelector(`.hwq-opt[data-idx="${idx}"]`);
    const item = options[idx];
    if(!btn || !item) return;

    const needOrder = picks.length + 1;
    const isCorrect = item.ok && item.order === needOrder;

    if(isCorrect){
      picks.push(item);
      score++;
      setOptionState(btn, 'correct');
      btn.disabled = true;

      paintSlots();
      updateHUD();

      if(picks.length >= targetNeed){
        showBanner('🎉 ครบ 3 ขั้นแล้ว');
        setTimeout(finishGame, 350);
      }else{
        showBanner(`✅ ถูกต้อง: ขั้นที่ ${needOrder}`);
      }
      return;
    }

    miss++;
    setOptionState(btn, 'wrong');
    updateHUD();
    showBanner(item.ok ? '⚠️ ลำดับยังไม่ถูก' : '❌ ตัวหลอก');

    setTimeout(()=>{
      if(!finished){
        btn.classList.remove('wrong');
      }
    }, 320);
  }

  function goHub(){
    const hub =
      String(
        ctx.hub ||
        new URLSearchParams(location.search).get('hub') ||
        '../hub.html'
      );
    location.href = hub;
  }

  function goNext(){
    const result = buildResult();

    try{
      // ถ้า gate host ส่ง callback มา ใช้อันนี้ก่อน
      if(typeof ctx.onDone === 'function'){
        ctx.onDone(result);
        return;
      }
    }catch(_){}

    const next =
      String(
        ctx.next ||
        new URLSearchParams(location.search).get('next') ||
        (ctx.hub || new URLSearchParams(location.search).get('hub') || '../hub.html')
      );

    location.href = next;
  }

  // initial
  setSummaryVisible(false);
  setPlayingUI(false);
  disableAllOptions();
  paintSlots();
  updateHUD();

  btnStart?.addEventListener('click', startGame, { passive:true });
  btnHub?.addEventListener('click', goHub, { passive:true });
  btnNext?.addEventListener('click', goNext, { passive:true });

  optsEl?.addEventListener('click', (e)=>{
    const t = e.target.closest('.hwq-opt');
    if(!t) return;
    const idx = Number(t.getAttribute('data-idx'));
    if(Number.isFinite(idx)) onPick(idx);
  });
}