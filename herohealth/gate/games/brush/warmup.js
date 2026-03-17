// === /herohealth/gate/games/brush/warmup.js ===
// FULL PATCH v20260316-BRUSH-WARMUP-GATE

let __brushWarmupStyleLoaded = false;

function loadStyle(){
  if(__brushWarmupStyleLoaded) return;
  __brushWarmupStyleLoaded = true;

  const id = 'gate-style-brush';
  if(document.getElementById(id)) return;

  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = new URL('./style.css', import.meta.url).toString();
  document.head.appendChild(link);
}

function clamp(v, a, b){
  return Math.max(a, Math.min(b, v));
}

function nowISO(){
  return new Date().toISOString();
}

export async function mount(root, ctx = {}, api = {}){
  loadStyle();

  const mountEl = document.createElement('div');
  mountEl.className = 'brush-gate-game brush-gate-warmup';
  mountEl.innerHTML = `
    <div class="brush-gate-card">
      <div class="brush-gate-head">
        <div class="brush-gate-badge">WARMUP</div>
        <h2 class="brush-gate-title">Brush Warmup</h2>
        <p class="brush-gate-sub">
          ฝึกมือก่อนเข้าเกมจริง • เลือกโซนฟันให้ถูก • แตะให้ครบตามที่กำหนด
        </p>
      </div>

      <div class="brush-gate-progress-wrap">
        <div class="brush-gate-progress-label">
          <span>Progress</span>
          <span id="bwPct">0%</span>
        </div>
        <div class="brush-gate-progress">
          <div id="bwFill" class="brush-gate-progress-fill"></div>
        </div>
      </div>

      <div class="brush-gate-mission">
        <div class="brush-gate-mission-title">ภารกิจ</div>
        <div id="bwMissionText" class="brush-gate-mission-text">
          แตะโซนที่กำลังเรืองแสงให้ครบ 6 ครั้ง
        </div>
      </div>

      <div class="brush-gate-playfield">
        <div class="brush-gate-mouth">
          <div class="brush-gate-gum brush-gate-gum-top"></div>
          <div class="brush-gate-gum brush-gate-gum-bottom"></div>

          <div class="brush-gate-teeth brush-gate-teeth-top">
            <div class="tooth"></div><div class="tooth"></div><div class="tooth"></div><div class="tooth"></div>
            <div class="tooth"></div><div class="tooth"></div><div class="tooth"></div><div class="tooth"></div>
          </div>

          <div class="brush-gate-teeth brush-gate-teeth-bottom">
            <div class="tooth"></div><div class="tooth"></div><div class="tooth"></div><div class="tooth"></div>
            <div class="tooth"></div><div class="tooth"></div><div class="tooth"></div><div class="tooth"></div>
          </div>

          <div id="bwZones" class="brush-gate-zones"></div>
          <div id="bwPopLayer" class="brush-gate-poplayer"></div>
        </div>
      </div>

      <div class="brush-gate-footer">
        <div class="brush-gate-hint" id="bwHint">
          👆 แตะโซนที่เรืองแสง
        </div>

        <div class="brush-gate-actions">
          <button type="button" class="brush-gate-btn brush-gate-btn-ghost" id="bwRestartBtn">เริ่มใหม่</button>
          <button type="button" class="brush-gate-btn brush-gate-btn-primary" id="bwFinishBtn" disabled>พร้อมเข้าเกม</button>
        </div>
      </div>
    </div>
  `;

  root.replaceChildren(mountEl);

  const zonesHost = mountEl.querySelector('#bwZones');
  const popLayer = mountEl.querySelector('#bwPopLayer');
  const pctEl = mountEl.querySelector('#bwPct');
  const fillEl = mountEl.querySelector('#bwFill');
  const missionTextEl = mountEl.querySelector('#bwMissionText');
  const hintEl = mountEl.querySelector('#bwHint');
  const restartBtn = mountEl.querySelector('#bwRestartBtn');
  const finishBtn = mountEl.querySelector('#bwFinishBtn');

  const ZONES = [
    { id:'upper_outer', label:'ฟันบนด้านนอก', x:18, y:20, w:64, h:14 },
    { id:'upper_inner', label:'ฟันบนด้านใน', x:24, y:36, w:52, h:11 },
    { id:'upper_chew', label:'ฟันบนด้านบดเคี้ยว', x:30, y:49, w:40, h:8 },
    { id:'lower_outer', label:'ฟันล่างด้านนอก', x:18, y:66, w:64, h:14 },
    { id:'lower_inner', label:'ฟันล่างด้านใน', x:24, y:54, w:52, h:11 },
    { id:'lower_chew', label:'ฟันล่างด้านบดเคี้ยว', x:30, y:44, w:40, h:8 }
  ];

  const S = {
    hits: 0,
    miss: 0,
    needHits: 6,
    activeIdx: 0,
    finished: false,
    startedAt: performance.now(),
    els: []
  };

  function setStats(){
    const pct = Math.round((S.hits / S.needHits) * 100);
    pctEl.textContent = `${pct}%`;
    fillEl.style.width = `${pct}%`;

    api.setStats?.({
      time: Math.max(0, Math.round((performance.now() - S.startedAt) / 1000)),
      score: S.hits,
      miss: S.miss,
      acc: `${pct}%`
    });

    missionTextEl.textContent =
      S.hits >= S.needHits
        ? 'เสร็จแล้ว! กด “พร้อมเข้าเกม” ได้เลย'
        : `แตะโซนที่กำลังเรืองแสงให้ครบ ${S.needHits} ครั้ง (${S.hits}/${S.needHits})`;

    const active = ZONES[S.activeIdx];
    hintEl.textContent =
      S.hits >= S.needHits
        ? '✅ Warmup เสร็จแล้ว'
        : `👆 ตอนนี้แตะ: ${active?.label || 'โซนที่เรืองแสง'}`;

    finishBtn.disabled = S.hits < S.needHits;
  }

  function setSub(){
    api.setSub?.('แตะโซนที่เรืองแสงให้ครบก่อนเข้าเกม');
    api.setDailyState?.('PLAYING');
  }

  function renderZones(){
    zonesHost.innerHTML = '';
    S.els = [];

    ZONES.forEach((z, idx)=>{
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'brush-gate-zone';
      if(idx === S.activeIdx) btn.classList.add('active');

      btn.style.left = `${z.x}%`;
      btn.style.top = `${z.y}%`;
      btn.style.width = `${z.w}%`;
      btn.style.height = `${z.h}%`;
      btn.innerHTML = `
        <span class="brush-gate-zone-label">${z.label}</span>
        <span class="brush-gate-zone-icon">${idx === S.activeIdx ? '✨' : ''}</span>
      `;

      btn.addEventListener('click', ()=>{
        if(S.finished) return;

        const rect = zonesHost.getBoundingClientRect();
        const x = rect.width * ((z.x + z.w / 2) / 100);
        const y = rect.height * ((z.y + z.h / 2) / 100);

        if(idx === S.activeIdx){
          S.hits++;
          spawnPop(x, y, 'GOOD');
          btn.classList.add('good');
          setTimeout(()=> btn.classList.remove('good'), 180);

          if(S.hits >= S.needHits){
            S.finished = true;
            S.els.forEach(el => el.classList.remove('active'));
            setStats();
            return;
          }

          S.activeIdx = (S.activeIdx + 1) % ZONES.length;
          renderZones();
          setStats();
        }else{
          S.miss++;
          spawnPop(x, y, 'MISS');
          btn.classList.add('bad');
          setTimeout(()=> btn.classList.remove('bad'), 180);
          setStats();
        }
      });

      zonesHost.appendChild(btn);
      S.els.push(btn);
    });
  }

  function spawnPop(x, y, text){
    const el = document.createElement('div');
    el.className = 'brush-gate-pop';
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    popLayer.appendChild(el);
    setTimeout(()=> el.remove(), 700);
  }

  function restart(){
    S.hits = 0;
    S.miss = 0;
    S.activeIdx = 0;
    S.finished = false;
    S.startedAt = performance.now();
    renderZones();
    setStats();
    setSub();
  }

  restartBtn.addEventListener('click', restart);

  finishBtn.addEventListener('click', ()=>{
    api.finish?.({
      ok: true,
      title: 'Warmup เสร็จแล้ว!',
      subtitle: 'พร้อมเข้าเกม Brush VR',
      lines: [
        `Hit: ${S.hits}/${S.needHits}`,
        `Miss: ${S.miss}`,
        `เวลา: ${Math.max(0, Math.round((performance.now() - S.startedAt) / 1000))} วินาที`
      ],
      buffs: {
        wgskip: '1',
        warmupDone: '1'
      },
      markDailyDone: true,
      savedAt: nowISO()
    });
  });

  restart();

  return {
    destroy(){
      root.replaceChildren();
    }
  };
}

export default { mount };