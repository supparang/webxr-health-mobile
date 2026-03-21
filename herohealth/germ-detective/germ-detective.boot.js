// === /herohealth/germ-detective/germ-detective.boot.js ===
// Germ Detective modular boot — P5 aligned
// PATCH v20260321-GD-BOOT-UNIFIED
//
// ใช้สำหรับสาย modular:
// - mount into #app
// - import game module safely
// - visible error if boot fails
// - pass query config to game
//
// หมายเหตุ:
// ถ้าใช้ germ-detective-vr.html แบบ integrated ตัวล่าสุด
// ไฟล์นี้ไม่จำเป็นต้องถูกเรียกใช้

function qs(k, d=''){
  try{ return new URL(location.href).searchParams.get(k) ?? d; }
  catch{ return d; }
}

function normalizeMaybeEncodedUrl(v){
  v = String(v ?? '').trim();
  if(!v || v === 'null' || v === 'undefined') return '';
  if(/%3A|%2F|%3F|%26|%3D/i.test(v)){
    try{ v = decodeURIComponent(v); }catch(_){}
  }
  return v.trim();
}

function showBootError(msg, err){
  console.error('[germ-boot]', msg, err || '');
  const app = document.getElementById('app') || document.body;

  const box = document.createElement('div');
  box.style.margin = '12px';
  box.style.padding = '16px';
  box.style.border = '1px solid rgba(148,163,184,.18)';
  box.style.borderRadius = '18px';
  box.style.background = 'rgba(255,255,255,.03)';
  box.style.color = '#e5e7eb';
  box.style.maxWidth = '860px';

  box.innerHTML = `
    <div style="display:flex;gap:10px;align-items:center;margin-bottom:10px;">
      <div style="
        width:42px;height:42px;border-radius:14px;
        display:grid;place-items:center;font-size:22px;
        background:linear-gradient(135deg, rgba(34,211,238,.18), rgba(167,139,250,.16));
        border:1px solid rgba(148,163,184,.16);
      ">🦠</div>
      <div>
        <div style="font-weight:1000;font-size:18px;line-height:1.15;">นักสืบเชื้อโรคเปิดไม่สำเร็จ</div>
        <div style="font-size:12px;color:#94a3b8;line-height:1.5;">เกิดปัญหาระหว่างเตรียมหน้าเกมแบบ modular</div>
      </div>
    </div>
    <div style="
      font-size:12px;line-height:1.6;white-space:pre-wrap;
      color:#cbd5e1;
      border:1px solid rgba(148,163,184,.12);
      border-radius:12px;
      background:rgba(255,255,255,.02);
      padding:10px;
    ">${String(msg)}</div>
  `;

  app.appendChild(box);
}

async function main(){
  const app = document.getElementById('app');
  if(!app) throw new Error('#app not found');

  const cfg = {
    pid: String(qs('pid','anon')).trim() || 'anon',
    run: String(qs('run','play')).toLowerCase() || 'play',
    diff: String(qs('diff','normal')).toLowerCase() || 'normal',
    time: Math.max(20, Number(qs('time','180')) || 180),
    seed: String(qs('seed', String(Date.now()))),
    view: String(qs('view','mobile')).toLowerCase() || 'mobile',
    scene: String(qs('scene','classroom')).toLowerCase() || 'classroom',
    zone: String(qs('zone','hygiene')).toLowerCase() || 'hygiene',
    studyId: String(qs('studyId','')),
    phase: String(qs('phase','')),
    conditionGroup: String(qs('conditionGroup','')),
    sessionOrder: String(qs('sessionOrder','')),
    blockLabel: String(qs('blockLabel','')),
    siteCode: String(qs('siteCode','')),
    schoolYear: String(qs('schoolYear','')),
    semester: String(qs('semester','')),
    hub: normalizeMaybeEncodedUrl(qs('hub','../hub.html')) || '../hub.html'
  };

  console.log('[germ-boot] cfg =', cfg);

  app.innerHTML = `
    <div style="
      min-height:100vh;
      display:grid;
      place-items:center;
      padding:20px;
      background:
        radial-gradient(900px 600px at 50% -10%, rgba(34,211,238,.10), transparent 60%),
        radial-gradient(800px 600px at 0% 20%, rgba(167,139,250,.08), transparent 60%),
        #050814;
      color:#e5e7eb;
      font-family:system-ui,-apple-system,Segoe UI,Roboto,'Noto Sans Thai',sans-serif;
    ">
      <div style="
        width:min(92vw,560px);
        border:1px solid rgba(148,163,184,.18);
        background:rgba(2,6,23,.78);
        border-radius:24px;
        padding:20px;
        box-shadow:0 20px 60px rgba(0,0,0,.35);
        text-align:center;
      ">
        <div style="
          width:72px;height:72px;margin:0 auto 12px;border-radius:22px;
          display:grid;place-items:center;font-size:36px;
          background:linear-gradient(135deg, rgba(34,211,238,.18), rgba(167,139,250,.16));
          border:1px solid rgba(148,163,184,.16);
        ">🦠</div>
        <div style="font-size:22px;font-weight:1000;line-height:1.15;">นักสืบเชื้อโรค</div>
        <div style="margin-top:8px;color:#cbd5e1;font-size:14px;line-height:1.55;">
          กำลังโหลดหน้าเกมแบบ modular...
        </div>
      </div>
    </div>
  `;

  const [gameMod, resultMod] = await Promise.all([
    import('./germ-detective.js?v=20260321-GD-BOOT-UNIFIED'),
    import('./germ-detective.result.js?v=20260321-GD-BOOT-UNIFIED').catch(() => null)
  ]);

  console.log('[germ-boot] game module loaded =', Object.keys(gameMod || {}));
  console.log('[germ-boot] result module loaded =', Object.keys(resultMod || {}));

  const mountFn = gameMod?.default;
  if(typeof mountFn !== 'function'){
    throw new Error('No default factory found in germ-detective.js');
  }

  app.innerHTML = `
    <div id="gd-modular-root" style="
      position:relative;
      min-height:100vh;
      background:
        radial-gradient(900px 600px at 50% -10%, rgba(34,211,238,.10), transparent 60%),
        radial-gradient(800px 600px at 0% 20%, rgba(167,139,250,.08), transparent 60%),
        #050814;
      color:#e5e7eb;
      font-family:system-ui,-apple-system,Segoe UI,Roboto,'Noto Sans Thai',sans-serif;
    ">
      <div class="gd-topbar">
        <div class="left">
          <div class="pill">🦠 นักสืบเชื้อโรค</div>
          <div class="pill">📍 ${cfg.scene}</div>
          <div class="pill">🎮 ${cfg.diff}</div>
        </div>
        <div class="right">
          <button class="btn" id="gdBootBackHubBtn" type="button">กลับหน้าแรก</button>
          <button class="btn primary" id="gdBootStartBtn" type="button">เริ่มเล่น</button>
        </div>
      </div>

      <div class="gd-mainwrap">
        <section class="gd-stage" id="scene"></section>

        <aside class="gd-side">
          <section class="gd-panel">
            <div class="head">
              <strong>ภารกิจ</strong>
              <span class="phase-pill phase-search" id="gdBootPhasePill">ค้นหา</span>
            </div>
            <div class="body">
              <div class="mini-item" id="gdBootMissionText">
                ใช้ไฟ UV หาจุดที่อาจมีเชื้อโรค แล้วค่อยเก็บหลักฐาน
              </div>
            </div>
          </section>

          <section class="gd-panel">
            <div class="head">
              <strong>สถานะ</strong>
            </div>
            <div class="body">
              <div class="budget-row">
                <div class="metric">
                  <div class="mut">เวลา</div>
                  <div id="gdBootTime">-</div>
                </div>
                <div class="metric">
                  <div class="mut">ความเสี่ยง</div>
                  <div id="gdBootRisk">-</div>
                </div>
                <div class="metric">
                  <div class="mut">คะแนน</div>
                  <div id="gdBootScore">-</div>
                </div>
              </div>
            </div>
          </section>

          <section class="gd-panel">
            <div class="head">
              <strong>หลักฐาน</strong>
            </div>
            <div class="body">
              <div class="mini-list" id="gdBootEvidenceList">
                <div class="mini-item">ยังไม่พบหลักฐาน</div>
              </div>
            </div>
          </section>

          <section class="gd-panel">
            <div class="head">
              <strong>อุปกรณ์</strong>
            </div>
            <div class="body">
              <div class="actions">
                <button class="btn primary" type="button" id="gdToolUV">ไฟ UV</button>
                <button class="btn" type="button" id="gdToolSwab">ไม้เก็บตัวอย่าง</button>
                <button class="btn" type="button" id="gdToolCam">ถ่ายรูป</button>
                <button class="btn" type="button" id="gdToolClean">ทำความสะอาด</button>
                <button class="btn good" type="button" id="gdToolReport">สรุปคดี</button>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  `;

  const game = mountFn({
    mountId: 'scene',
    timeSec: cfg.time,
    seed: cfg.seed,
    scene: cfg.scene,
    difficulty: cfg.diff,
    view: cfg.view,
    runMode: cfg.run,
    enableBuiltinUI: false,
    enableBuiltinHotspots: true,
    builtinTarget: document.getElementById('scene')
  });

  const byId = id => document.getElementById(id);

  const phaseMap = {
    search: { pill:'ค้นหา', cls:'phase-search', text:'ใช้ไฟ UV หาจุดที่อาจมีเชื้อโรค แล้วค่อยเก็บหลักฐาน' },
    investigate: { pill:'ตรวจ', cls:'phase-investigate', text:'ตอนนี้ใช้ไม้เก็บตัวอย่างหรือถ่ายรูปเพื่อยืนยันหลักฐาน' },
    action: { pill:'ลดเสี่ยง', cls:'phase-intervene', text:'ตอนนี้ให้ทำความสะอาดเพื่อลดการแพร่เชื้อ' },
    report: { pill:'สรุปคดี', cls:'phase-report', text:'หาเจอครบและลดความเสี่ยงแล้ว พร้อมสรุปคดี' }
  };

  function setActiveTool(tool){
    ['gdToolUV','gdToolSwab','gdToolCam','gdToolClean'].forEach(id=>{
      byId(id)?.classList.remove('primary');
    });
    if(tool === 'uv') byId('gdToolUV')?.classList.add('primary');
    if(tool === 'swab') byId('gdToolSwab')?.classList.add('primary');
    if(tool === 'cam') byId('gdToolCam')?.classList.add('primary');
    if(tool === 'clean') byId('gdToolClean')?.classList.add('primary');
  }

  function renderHUD(state){
    if(!state) return;

    byId('gdBootTime').textContent = `${Math.max(0, Number(state.timeLeft || 0))} วิ`;
    byId('gdBootRisk').textContent = `${Number(state.areaRisk || 0)}%`;
    byId('gdBootScore').textContent = `${Number(state.score || 0)}`;

    const phase = String(state.phase || 'search');
    const meta = phaseMap[phase] || phaseMap.search;

    const pill = byId('gdBootPhasePill');
    if(pill){
      pill.textContent = meta.pill;
      pill.className = `phase-pill ${meta.cls}`;
    }
    const mission = byId('gdBootMissionText');
    if(mission) mission.textContent = meta.text;

    const evidenceBox = byId('gdBootEvidenceList');
    if(evidenceBox){
      const evs = Array.isArray(state.evidence) ? state.evidence : [];
      if(!evs.length){
        evidenceBox.innerHTML = `<div class="mini-item">ยังไม่พบหลักฐาน</div>`;
      }else{
        evidenceBox.innerHTML = evs.slice().reverse().slice(0,8).map(item => `
          <div class="mini-item">
            <strong>${String(item.type || '').toUpperCase()}</strong> • ${esc(item.target || '-')}
            <div class="mut" style="margin-top:4px;">${esc(item.info || '')}</div>
          </div>
        `).join('');
      }
    }
  }

  function hubUrl(){
    try{ return new URL(cfg.hub, location.href).toString(); }
    catch{ return new URL('../hub.html', location.href).toString(); }
  }

  function cooldownUrl(){
    const u = new URL('../warmup-gate.html', location.href);
    u.searchParams.set('gatePhase', 'cooldown');
    u.searchParams.set('phase', 'cooldown');
    u.searchParams.set('cat', 'hygiene');
    u.searchParams.set('theme', 'germdetective');
    u.searchParams.set('game', 'germdetective');
    u.searchParams.set('pid', cfg.pid);
    u.searchParams.set('hub', hubUrl());
    u.searchParams.set('run', cfg.run);
    u.searchParams.set('diff', cfg.diff);
    u.searchParams.set('time', String(cfg.time));
    u.searchParams.set('view', cfg.view);
    u.searchParams.set('seed', cfg.seed);
    u.searchParams.set('scene', cfg.scene);
    u.searchParams.set('zone', 'hygiene');
    u.searchParams.set('cat', 'hygiene');
    u.searchParams.set('wgskip', '1');
    return u.toString();
  }

  byId('gdBootBackHubBtn')?.addEventListener('click', ()=>{
    location.href = hubUrl();
  });

  byId('gdBootStartBtn')?.addEventListener('click', ()=>{
    game.init();
    renderHUD(game.getState?.());
    byId('gdBootStartBtn').disabled = true;
    byId('gdBootStartBtn').textContent = 'กำลังเล่น';
  });

  byId('gdToolUV')?.addEventListener('click', ()=>{ game.setTool('uv'); setActiveTool('uv'); });
  byId('gdToolSwab')?.addEventListener('click', ()=>{ game.setTool('swab'); setActiveTool('swab'); });
  byId('gdToolCam')?.addEventListener('click', ()=>{ game.setTool('cam'); setActiveTool('cam'); });
  byId('gdToolClean')?.addEventListener('click', ()=>{ game.setTool('clean'); setActiveTool('clean'); });
  byId('gdToolReport')?.addEventListener('click', ()=>{ game.submitReport(); });

  window.addEventListener('gd:toolchange', (ev)=>{
    setActiveTool(ev?.detail?.tool || 'uv');
  });

  window.addEventListener('hha:features_1s', ()=>{
    renderHUD(game.getState?.());
  });

  window.addEventListener('hha:event', (ev)=>{
    const name = ev?.detail?.name || '';
    if(name === 'phase_change'){
      renderHUD(game.getState?.());
    }
  });

  window.addEventListener('hha:end', (ev)=>{
    const summary = ev?.detail || {};
    if(resultMod?.ensureResultModalDOM && resultMod?.renderResult){
      resultMod.ensureResultModalDOM();
      resultMod.renderResult({
        P: cfg,
        summary,
        hubURL: hubUrl,
        cooldownURL: cooldownUrl,
        onReflectionChange: (reflectionState)=>{
          try{
            const out = Object.assign({}, summary, {
              pid: cfg.pid,
              game:'germ-detective',
              zone:'hygiene',
              scene: cfg.scene,
              diff: cfg.diff,
              runMode: cfg.run,
              timestampIso: new Date().toISOString(),
              __extraJson: JSON.stringify({
                url: location.href,
                hub: hubUrl(),
                cooldown: cooldownUrl(),
                reflection: Object.assign({}, reflectionState)
              })
            });
            localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(out));
            localStorage.setItem(`HHA_LAST_SUMMARY:germ-detective:${cfg.pid}`, JSON.stringify(out));
          }catch{}
        }
      });
    }
  });

  renderHUD({
    timeLeft: cfg.time,
    areaRisk: 100,
    score: 0,
    phase: 'search',
    evidence: []
  });
  setActiveTool('uv');
}

main().catch((err)=>{
  showBootError(err?.stack || err?.message || String(err), err);
});