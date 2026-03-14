// === /herohealth/gate/games/hygiene/warmup.js ===
// Handwash Quick Prep — WARMUP
// PATCH v20260314a-FIX-OVERLAY-STUCK-SUMMARY-EARLY

function esc(s){
  return String(s ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;');
}

export function boot(root, ctx = {}){
  if(!root) return;

  // ✅ กัน mount ซ้ำ / state เก่าค้าง
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

  const options = [
    { key:'wet',  icon:'💧', title:'ทำมือให้เปียก', desc:'เริ่มด้วยการทำให้มือเปียกด้วยน้ำสะอาด', ok:true,  order:1 },
    { key:'soap', icon:'🧼', title:'ฟอกสบู่',       desc:'กดสบู่หรือถูสบู่ให้ทั่วมือ',              ok:true,  order:2 },
    { key:'rub',  icon:'👐', title:'ถูมือให้ทั่ว',   desc:'ถูฝ่ามือ หลังมือ ซอกนิ้ว นิ้วโป้ง เล็บ ข้อมือ', ok:true, order:3 },

    { key:'run',  icon:'🏃', title:'ไปเล่นต่อเลย',   desc:'ยังไม่ล้างมือก็วิ่งออกจากห้องน้ำ',         ok:false },
    { key:'eat',  icon:'🍪', title:'หยิบขนมก่อน',    desc:'กินเลยทั้งที่ยังไม่ล้างมือ',               ok:false },
    { key:'phone',icon:'📱', title:'เล่นมือถือก่อน', desc:'จับของสกปรกเพิ่มก่อนล้างมือ',              ok:false }
  ];

  root.innerHTML = `
    <div class="hwq-root">
      <div class="hwq-panel">

        <header class="hwq-top">
          <div class="hwq-title">Handwash Quick Prep</div>
          <div class="hwq-sub">พร้อมแล้ว</div>

          <div class="hwq-pills">
            <div class="hwq-pill">PHASE: warmup</div>
            <div class="hwq-pill">CAT: hygiene</div>
            <div class="hwq-pill">GAME: Handwash</div>
            <div class="hwq-pill">DAILY: NEW</div>
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

        <section class="hwq-game" id="hwqGame" aria-label="warmup game">
          <div class="hwq-grid">
            <div class="hwq-col">
              <div class="hwq-box">
                <div class="hwq-box-top">
                  <div class="hwq-chip">เป้าหมาย: เรียง 3 ขั้น</div>
                  <div class="hwq-chip">ห้ามเลือกตัวหลอก</div>
                </div>

                <div class="hwq-box-title">ลำดับที่ต้องเรียง</div>
                <div class="hwq-box-sub">แตะตัวเลือกที่ถูกต้องให้ครบ 3 ขั้นตามลำดับ</div>

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
                <div class="hwq-box-sub">เลือกขั้นตอนที่ถูกต้องทีละข้อ</div>

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

        <!-- ✅ summary ซ่อนไว้ก่อน -->
        <section class="hwq-summary" id="hwqSummary" style="display:none">
          <div class="hwq-summary-title">สรุปผล</div>
          <div class="hwq-summary-sub" id="hwqSummarySub">พร้อมไปต่อ</div>

          <div class="hwq-actions">
            <button type="button" class="hwq-btn ghost" data-act="hub">กลับ HUB</button>
            <button type="button" class="hwq-btn primary" data-act="next">ไปต่อ</button>
          </div>
        </section>

        <!-- ✅ overlay อยู่ท้ายสุดและต้องหายจริง -->
        <div class="hwq-start-overlay" id="hwqStartOverlay">
          <div class="hwq-start-card">
            <div class="hwq-start-title">Warmup — Handwash Quick Prep</div>
            <div class="hwq-start-sub">
              เลือก 3 ขั้นเริ่มต้นของการล้างมือให้ถูกตามลำดับ ภายใน 20 วินาที
            </div>
            <div class="hwq-actions center">
              <button type="button" class="hwq-btn primary" data-act="start">เริ่มเตรียมล้างมือ</button>
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

  function finishGame(){
    if(finished) return;
    finished = true;
    started = false;

    if(rafId) cancelAnimationFrame(rafId);

    setPlayingUI(false);
    disableAllOptions();

    const cleared = picks.length >= targetNeed;
    if(summarySubEl){
      summarySubEl.textContent = cleared
        ? 'พร้อมไปต่อ'
        : 'ยังไม่ครบ แต่ไปต่อได้';
    }
    setSummaryVisible(true);
    showBanner(cleared ? '✅ พร้อมไปต่อ' : '⏱️ หมดเวลา');
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

    hideStartOverlay();        // ✅ ต้องซ่อนก่อน
    setSummaryVisible(false);  // ✅ ห้าม summary โผล่
    setPlayingUI(true);
    enableAllOptions();

    startTs = performance.now();
    timeLeft = 20;
    score = 0;
    miss = 0;
    picks.length = 0;

    paintSlots();
    updateHUD();
    showBanner('เริ่มเลย! เลือก 3 ขั้นเริ่มต้นให้ถูกลำดับ');

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
    const hub = String(ctx.hub || new URLSearchParams(location.search).get('hub') || '../hub.html');
    location.href = hub;
  }

  function goNext(){
    const next = String(ctx.next || new URLSearchParams(location.search).get('next') || '../hygiene-vr/hygiene-vr.html');
    location.href = next;
  }

  // initial
  setSummaryVisible(false);   // ✅ ซ่อน summary
  setPlayingUI(false);        // ✅ ยังไม่ให้เล่นจนกด start
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