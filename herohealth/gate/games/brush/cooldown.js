// === /herohealth/gate/games/brush/cooldown.js ===
// FULL PATCH v20260316-BRUSH-COOLDOWN-GATE

let __brushCooldownStyleLoaded = false;

function loadStyle(){
  if(__brushCooldownStyleLoaded) return;
  __brushCooldownStyleLoaded = true;

  const id = 'gate-style-brush';
  if(document.getElementById(id)) return;

  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = new URL('./style.css', import.meta.url).toString();
  document.head.appendChild(link);
}

function nowISO(){
  return new Date().toISOString();
}

export async function mount(root, ctx = {}, api = {}){
  loadStyle();

  const mountEl = document.createElement('div');
  mountEl.className = 'brush-gate-game brush-gate-cooldown';
  mountEl.innerHTML = `
    <div class="brush-gate-card">
      <div class="brush-gate-head">
        <div class="brush-gate-badge cooldown">COOLDOWN</div>
        <h2 class="brush-gate-title">Brush Cooldown</h2>
        <p class="brush-gate-sub">
          ผ่อนแรงหลังเล่น • ทบทวนสิ่งที่ทำ • แล้วกลับหน้า HUB
        </p>
      </div>

      <div class="brush-gate-cool-grid">
        <button type="button" class="brush-cool-tile" data-kind="slow">
          <span class="emoji">😮‍💨</span>
          <span class="label">หายใจช้า ๆ</span>
        </button>

        <button type="button" class="brush-cool-tile" data-kind="smile">
          <span class="emoji">😁</span>
          <span class="label">ยิ้มให้ตัวเอง</span>
        </button>

        <button type="button" class="brush-cool-tile" data-kind="rinse">
          <span class="emoji">💧</span>
          <span class="label">บ้วนปากในใจ</span>
        </button>

        <button type="button" class="brush-cool-tile" data-kind="check">
          <span class="emoji">✅</span>
          <span class="label">พร้อมกลับ HUB</span>
        </button>
      </div>

      <div class="brush-gate-mission">
        <div class="brush-gate-mission-title">ภารกิจ Cooldown</div>
        <div id="bcMissionText" class="brush-gate-mission-text">
          แตะกิจกรรมให้ครบ 3 อย่าง
        </div>
      </div>

      <div class="brush-gate-progress-wrap">
        <div class="brush-gate-progress-label">
          <span>Cooldown Progress</span>
          <span id="bcPct">0%</span>
        </div>
        <div class="brush-gate-progress">
          <div id="bcFill" class="brush-gate-progress-fill cooldown"></div>
        </div>
      </div>

      <div class="brush-gate-footer">
        <div class="brush-gate-hint" id="bcHint">
          🌿 แตะกิจกรรมผ่อนแรงให้ครบก่อน
        </div>

        <div class="brush-gate-actions">
          <button type="button" class="brush-gate-btn brush-gate-btn-ghost" id="bcRestartBtn">เริ่มใหม่</button>
          <button type="button" class="brush-gate-btn brush-gate-btn-primary" id="bcFinishBtn" disabled>กลับ HUB</button>
        </div>
      </div>
    </div>
  `;

  root.replaceChildren(mountEl);

  const tiles = [...mountEl.querySelectorAll('.brush-cool-tile')];
  const pctEl = mountEl.querySelector('#bcPct');
  const fillEl = mountEl.querySelector('#bcFill');
  const missionTextEl = mountEl.querySelector('#bcMissionText');
  const hintEl = mountEl.querySelector('#bcHint');
  const restartBtn = mountEl.querySelector('#bcRestartBtn');
  const finishBtn = mountEl.querySelector('#bcFinishBtn');

  const S = {
    done: new Set(),
    need: 3,
    miss: 0,
    startedAt: performance.now()
  };

  function updateUi(){
    const count = S.done.size;
    const pct = Math.round((count / S.need) * 100);

    pctEl.textContent = `${pct}%`;
    fillEl.style.width = `${pct}%`;

    api.setStats?.({
      time: Math.max(0, Math.round((performance.now() - S.startedAt) / 1000)),
      score: count,
      miss: S.miss,
      acc: `${pct}%`
    });

    missionTextEl.textContent =
      count >= S.need
        ? 'Cooldown เสร็จแล้ว กด “กลับ HUB” ได้เลย'
        : `แตะกิจกรรมผ่อนแรงให้ครบ ${S.need} อย่าง (${count}/${S.need})`;

    hintEl.textContent =
      count >= S.need
        ? '✅ พร้อมกลับหน้า HUB'
        : '🌿 แตะกิจกรรมผ่อนแรงต่ออีกนิด';

    finishBtn.disabled = count < S.need;
  }

  function restart(){
    S.done.clear();
    S.miss = 0;
    S.startedAt = performance.now();

    tiles.forEach(tile=>{
      tile.classList.remove('done');
    });

    api.setSub?.('แตะกิจกรรมผ่อนแรงให้ครบก่อนกลับ HUB');
    api.setDailyState?.('PLAYING');
    updateUi();
  }

  tiles.forEach(tile=>{
    tile.addEventListener('click', ()=>{
      const kind = tile.dataset.kind || '';

      if(S.done.has(kind)){
        S.miss++;
        tile.classList.add('shake');
        setTimeout(()=> tile.classList.remove('shake'), 220);
        updateUi();
        return;
      }

      if(S.done.size >= S.need) return;

      S.done.add(kind);
      tile.classList.add('done');
      updateUi();
    });
  });

  restartBtn.addEventListener('click', restart);

  finishBtn.addEventListener('click', ()=>{
    api.finish?.({
      ok: true,
      title: 'Cooldown เสร็จแล้ว!',
      subtitle: 'พร้อมกลับหน้า HUB',
      lines: [
        `ทำกิจกรรมครบ ${S.done.size}/${S.need}`,
        `เวลา: ${Math.max(0, Math.round((performance.now() - S.startedAt) / 1000))} วินาที`
      ],
      buffs: {
        cooldownDone: '1'
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