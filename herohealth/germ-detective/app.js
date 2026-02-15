// === /herohealth/germ-detective/app.js ===
// Germ Detective — game core (WebXR / three.js-ready, DOM fallback)
// ✅ Works in 3 modes:
//    1) WebXR (controllers) via three.js renderer.xr
//    2) Desktop (mouse ray) if you pass DOM pointer coords (optional helper included)
//    3) Gaze-dwell fallback (center screen) for cVR / no-controller
//
// ✅ No networking (local only) แต่ emit event ให้ HHA/PlateSafe/PlateLogger ได้ครบ
// ✅ Hotspots เป็นได้ทั้ง 3D (Mesh) หรือ DOM div (fallback)
//
// Expected (optional):
// - window.PlateSafe.logEvent(name,payload)
// - window.PlateSafe.emitFeatures()
// - window.PlateSafe.end(reason)
// - window.PlateLogger.logEvent(name,payload)
// - window.PlateLogger.sendEvidence(payload)
//
// Usage:
//   import GameApp from './app.js';
//   const app = GameApp({ three, renderer, scene, camera, mountId:'app' });
//   app.init();
//
// If you DON’T have three.js yet, it will auto-run DOM hotspot prototype.

export default function GameApp(opts = {}) {
  const cfg = Object.assign(
    {
      mountId: 'app',
      timeSec: 240,
      dwellMs: 1200,
      seed: null,

      // --- three.js (optional) ---
      three: null,        // THREE namespace
      renderer: null,     // THREE.WebGLRenderer
      scene: null,        // THREE.Scene
      camera: null,       // THREE.Camera
      xrSession: null,    // (optional) external XR session
      worldScale: 1,
      hotspotDistance: 2.2, // meters-ish in XR
      rayMax: 20,

      // DOM fallback hotspot positions
      domHotspotTop: 220
    },
    opts
  );

  // -------------------------
  // state
  // -------------------------
  const STATE = {
    running: false,
    paused: false,
    timeLeft: cfg.timeSec,

    tool: null, // 'uv'|'swab'|'cam'
    evidence: [], // {type, target, info, t, meta?}

    // hotspots:
    // - 3D: {id,name,obj,isHotspot:true}
    // - DOM: {id,name,el,isHotspot:true}
    hotspots: [],

    // selection/dwell
    hoverId: null,
    hoverSince: 0,
    dwellFired: false,

    // input
    pointerNDC: { x: 0, y: 0 }, // mouse/touch -> normalized device coords (-1..1)
    pointerDown: false
  };

  // -------------------------
  // utils
  // -------------------------
  const now = () => performance.now();
  const iso = () => new Date().toISOString();
  const uniq = () => Math.random().toString(16).slice(2) + String(Date.now()).slice(-6);
  function qs(id) { return document.getElementById(id); }
  function el(tag = 'div', cls = '') { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

  function safeDispatch(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }

  function logEvent(name, payload = {}) {
    // Prefer PlateSafe
    if (window.PlateSafe && typeof window.PlateSafe.logEvent === 'function') {
      window.PlateSafe.logEvent(name, payload);
      return;
    }
    // Fallback: HHA bus
    safeDispatch('hha:event', { name, payload });
  }

  function logLabel(type, payload = {}) {
    safeDispatch('hha:labels', { type, payload });
  }

  function emitFeatures1s() {
    // Prefer PlateSafe feature emitter
    if (window.PlateSafe && typeof window.PlateSafe.emitFeatures === 'function') {
      window.PlateSafe.emitFeatures();
      return;
    }
    // Minimal fallback
    safeDispatch('hha:features_1s', {
      game: 'germ-detective',
      timeLeft: STATE.timeLeft,
      evidenceCount: STATE.evidence.length,
      tool: STATE.tool || 'none'
    });
  }

  // -------------------------
  // UI
  // -------------------------
  function buildUI() {
    // toolbar
    const toolbar = el('div', 'gd-toolbar');
    toolbar.style.position = 'fixed';
    toolbar.style.left = '12px';
    toolbar.style.top = '12px';
    toolbar.style.zIndex = 1000;
    toolbar.style.userSelect = 'none';

    const btnUV = el('button', 'gd-btn'); btnUV.textContent = 'UV'; btnUV.onclick = () => setTool('uv');
    const btnSwab = el('button', 'gd-btn'); btnSwab.textContent = 'Swab'; btnSwab.onclick = () => setTool('swab');
    const btnCam = el('button', 'gd-btn'); btnCam.textContent = 'Camera'; btnCam.onclick = () => setTool('cam');
    const btnSubmit = el('button', 'gd-btn'); btnSubmit.textContent = 'ส่งรายงาน'; btnSubmit.onclick = submitReport;
    const btnPause = el('button', 'gd-btn'); btnPause.id = 'gdPauseBtn'; btnPause.textContent = 'Pause'; btnPause.onclick = togglePause;

    [btnUV, btnSwab, btnCam, btnSubmit, btnPause].forEach(b => {
      b.style.marginRight = '6px';
      b.style.padding = '8px 10px';
      b.style.borderRadius = '10px';
      b.style.border = '1px solid rgba(255,255,255,0.14)';
      b.style.background = 'rgba(10,16,36,0.55)';
      b.style.color = 'rgba(255,255,255,0.92)';
      b.style.cursor = 'pointer';
    });

    toolbar.appendChild(btnUV);
    toolbar.appendChild(btnSwab);
    toolbar.appendChild(btnCam);
    toolbar.appendChild(btnSubmit);
    toolbar.appendChild(btnPause);

    // timer + hint
    const timer = el('div', 'gd-timer'); timer.id = 'gdTimer';
    timer.style.marginTop = '8px';
    timer.style.padding = '6px 10px';
    timer.style.borderRadius = '10px';
    timer.style.background = 'rgba(4,6,16,0.72)';
    timer.style.border = '1px solid rgba(148,163,184,0.18)';
    timer.style.color = 'rgba(255,255,255,0.9)';
    toolbar.appendChild(timer);

    const hint = el('div', 'gd-hint'); hint.id = 'gdHint';
    hint.style.marginTop = '6px';
    hint.style.fontSize = '12px';
    hint.style.opacity = '0.9';
    hint.textContent = 'XR: เล็งแล้วกด trigger • cVR: จ้องค้างเพื่อเก็บหลักฐาน • PC: คลิก';
    toolbar.appendChild(hint);

    // evidence panel
    const panel = el('div', 'gd-evidence'); panel.id = 'gdEvidence';
    panel.style.position = 'fixed';
    panel.style.right = '12px';
    panel.style.top = '12px';
    panel.style.width = '280px';
    panel.style.maxHeight = '62vh';
    panel.style.overflow = 'auto';
    panel.style.zIndex = 1000;
    panel.style.padding = '10px';
    panel.style.borderRadius = '14px';
    panel.style.background = 'rgba(4,6,16,0.72)';
    panel.style.border = '1px solid rgba(148,163,184,0.18)';
    panel.style.color = 'rgba(255,255,255,0.92)';

    const h = el('h4');
    h.textContent = 'หลักฐาน';
    h.style.margin = '0 0 8px 0';
    h.style.fontWeight = '700';
    panel.appendChild(h);

    const list = el('div'); list.id = 'gdEvidenceList';
    panel.appendChild(list);

    // reticle (for gaze/cVR)
    const ret = el('div', 'gd-reticle'); ret.id = 'gdReticle';
    ret.style.position = 'fixed';
    ret.style.left = '50%';
    ret.style.top = '50%';
    ret.style.transform = 'translate(-50%,-50%)';
    ret.style.width = '14px';
    ret.style.height = '14px';
    ret.style.borderRadius = '999px';
    ret.style.border = '2px solid rgba(255,255,255,0.7)';
    ret.style.boxShadow = '0 0 14px rgba(255,255,255,0.18)';
    ret.style.pointerEvents = 'none';
    ret.style.zIndex = 999;

    // dwell ring
    const ring = el('div', 'gd-dwell'); ring.id = 'gdDwell';
    ring.style.position = 'fixed';
    ring.style.left = '50%';
    ring.style.top = '50%';
    ring.style.transform = 'translate(-50%,-50%)';
    ring.style.width = '44px';
    ring.style.height = '44px';
    ring.style.borderRadius = '999px';
    ring.style.border = '2px solid rgba(255,255,255,0.18)';
    ring.style.pointerEvents = 'none';
    ring.style.zIndex = 998;

    // progress arc via conic-gradient
    const prog = el('div', 'gd-dwellprog'); prog.id = 'gdDwellProg';
    prog.style.position = 'fixed';
    prog.style.left = '50%';
    prog.style.top = '50%';
    prog.style.transform = 'translate(-50%,-50%)';
    prog.style.width = '44px';
    prog.style.height = '44px';
    prog.style.borderRadius = '999px';
    prog.style.background = 'conic-gradient(rgba(255,255,255,0.0) 0deg, rgba(255,255,255,0.0) 360deg)';
    prog.style.pointerEvents = 'none';
    prog.style.zIndex = 997;
    prog.style.maskImage = 'radial-gradient(circle, transparent 55%, black 57%)';
    prog.style.webkitMaskImage = 'radial-gradient(circle, transparent 55%, black 57%)';

    document.body.appendChild(toolbar);
    document.body.appendChild(panel);
    document.body.appendChild(prog);
    document.body.appendChild(ring);
    document.body.appendChild(ret);
  }

  function setTool(t) {
    STATE.tool = t;
    safeDispatch('gd:toolchange', { tool: t });
    logEvent('tool_change', { tool: t });
  }

  function updateTimerUI() {
    const t = qs('gdTimer');
    if (t) t.textContent = `เวลา: ${Math.max(0, STATE.timeLeft)}s`;
    const p = qs('gdPauseBtn');
    if (p) p.textContent = STATE.paused ? 'Resume' : 'Pause';
  }

  function addEvidence(rec) {
    const r = Object.assign({ t: iso() }, rec);
    STATE.evidence.push(r);

    const list = qs('gdEvidenceList');
    if (list) {
      const c = el('div', 'gd-card');
      c.style.padding = '8px';
      c.style.marginBottom = '8px';
      c.style.borderRadius = '12px';
      c.style.background = 'rgba(255,255,255,0.04)';
      c.style.border = '1px solid rgba(255,255,255,0.10)';
      c.style.fontSize = '13px';
      c.textContent = `${String(r.type).toUpperCase()} • ${r.target} • ${r.info || ''}`;
      list.prepend(c);
    }

    logEvent('evidence_added', r);
  }

  async function submitReport() {
    const targets = Array.from(new Set(STATE.evidence.map(e => e.target))).slice(0, 5);
    const payload = { targets, timeLeft: STATE.timeLeft, evidenceCount: STATE.evidence.length };

    // End flow
    if (window.PlateSafe && typeof window.PlateSafe.end === 'function') {
      window.PlateSafe.end('submitted');
    } else {
      logLabel('report_submitted', payload);
    }

    // Optional logger bridge
    if (window.PlateLogger && typeof window.PlateLogger.logEvent === 'function') {
      window.PlateLogger.logEvent('report_submitted', payload);
    } else if (window.parent && window.parent !== window) {
      try { window.parent.postMessage({ type: 'plate:report', payload }, '*'); } catch (_) {}
    }

    alert('ส่งรายงานแล้ว: ' + (targets.length ? targets.join(', ') : 'ยังไม่มีหลักฐาน'));
  }

  function togglePause() {
    STATE.paused = !STATE.paused;
    STATE.running = !STATE.paused;
    logEvent(STATE.paused ? 'pause' : 'resume', {});
    updateTimerUI();
  }

  // -------------------------
  // Hotspots
  // -------------------------
  function createHotspotsDOM() {
    const names = ['ฟองน้ำ', 'ลูกบิด', 'เขียง', 'ก๊อกน้ำ', 'มือถือ'];
    const top = cfg.domHotspotTop;

    names.forEach((n, i) => {
      const d = el('div', 'gd-spot');
      d.textContent = n;
      d.dataset.name = n;

      d.style.position = 'absolute';
      d.style.left = `${36 + i * 150}px`;
      d.style.top = `${top + (i % 2) * 90}px`;
      d.style.padding = '12px 14px';
      d.style.borderRadius = '12px';
      d.style.background = 'rgba(255,255,255,0.04)';
      d.style.border = '1px solid rgba(255,255,255,0.12)';
      d.style.cursor = 'pointer';
      d.style.color = 'rgba(255,255,255,0.92)';

      d.onclick = () => onHotspotAction(n, { domEl: d });

      document.body.appendChild(d);
      STATE.hotspots.push({ id: 'dom_' + i, name: n, el: d, isHotspot: true });
    });

    logEvent('hotspots_created', { mode: 'dom', count: names.length });
  }

  function createHotspots3D() {
    const THREE = cfg.three;
    if (!THREE || !cfg.scene) return false;

    const names = ['ฟองน้ำ', 'ลูกบิด', 'เขียง', 'ก๊อกน้ำ', 'มือถือ'];
    const group = new THREE.Group();
    group.name = 'GD_HOTSPOTS';
    cfg.scene.add(group);

    // simple layout in front of camera
    const dist = cfg.hotspotDistance * cfg.worldScale;
    const spread = 0.55 * cfg.worldScale;

    for (let i = 0; i < names.length; i++) {
      const name = names[i];

      const geo = new THREE.SphereGeometry(0.06 * cfg.worldScale, 16, 12);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x111111,
        roughness: 0.25,
        metalness: 0.05,
        transparent: true,
        opacity: 0.92
      });

      const m = new THREE.Mesh(geo, mat);
      m.name = `GD_SPOT_${i}`;
      m.userData = {
        isHotspot: true,
        hotspotId: '3d_' + i,
        hotspotName: name
      };

      // place in arc
      const x = (i - (names.length - 1) / 2) * spread;
      const y = (i % 2 ? -0.12 : 0.12) * cfg.worldScale;
      m.position.set(x, y, -dist);

      group.add(m);
      STATE.hotspots.push({ id: m.userData.hotspotId, name, obj: m, isHotspot: true });
    }

    // lighting (only if none)
    if (!cfg.scene.getObjectByName('GD_LIGHT')) {
      const light = new THREE.DirectionalLight(0xffffff, 0.9);
      light.name = 'GD_LIGHT';
      light.position.set(1, 2, 1);
      cfg.scene.add(light);
      const amb = new THREE.AmbientLight(0xffffff, 0.35);
      amb.name = 'GD_AMB';
      cfg.scene.add(amb);
    }

    logEvent('hotspots_created', { mode: 'three', count: names.length });
    return true;
  }

  // -------------------------
  // Tool actions & feedback
  // -------------------------
  function flashHotspot(targetName, ctx = {}) {
    // DOM flash
    if (ctx.domEl) {
      ctx.domEl.style.boxShadow = '0 0 18px rgba(120,220,255,0.8)';
      setTimeout(() => (ctx.domEl.style.boxShadow = ''), 900);
      return;
    }
    // 3D flash
    if (ctx.obj && ctx.obj.material) {
      const mat = ctx.obj.material;
      const oldEm = mat.emissive ? mat.emissive.getHex() : null;
      if (mat.emissive) mat.emissive.setHex(0x22aaff);
      const oldOp = mat.opacity;
      mat.opacity = 1;
      setTimeout(() => {
        if (mat.emissive && oldEm != null) mat.emissive.setHex(oldEm);
        mat.opacity = oldOp;
      }, 900);
    }
  }

  function uvReveal(name, ctx) {
    flashHotspot(name, ctx);
    addEvidence({ type: 'hotspot', target: name, info: 'พบโดย UV', meta: { tool: 'uv' } });
  }

  function swabSample(name, ctx) {
    flashHotspot(name, ctx);
    // simple “sampling” delay
    if (ctx.domEl) ctx.domEl.style.opacity = '0.65';
    if (ctx.obj && ctx.obj.material) ctx.obj.material.opacity = 0.65;

    setTimeout(() => {
      if (ctx.domEl) ctx.domEl.style.opacity = '1';
      if (ctx.obj && ctx.obj.material) ctx.obj.material.opacity = 0.92;
      addEvidence({ type: 'sample', target: name, info: 'swab สำเร็จ', meta: { tool: 'swab' } });
    }, 900);
  }

  function takePhoto(name, ctx) {
    flashHotspot(name, ctx);
    addEvidence({ type: 'photo', target: name, info: 'ถ่ายภาพ', meta: { tool: 'cam' } });

    if (window.PlateLogger && typeof window.PlateLogger.sendEvidence === 'function') {
      window.PlateLogger.sendEvidence({ type: 'photo', meta: { target: name, t: iso() } });
    }
  }

  function onHotspotAction(name, ctx = {}) {
    if (!STATE.running || STATE.paused) return;

    const tool = STATE.tool;
    if (!tool) {
      addEvidence({ type: 'inspect', target: name, info: 'ตรวจสอบ', meta: { tool: 'none' } });
      return;
    }

    if (tool === 'uv') return uvReveal(name, ctx);
    if (tool === 'swab') return swabSample(name, ctx);
    if (tool === 'cam') return takePhoto(name, ctx);
  }

  // -------------------------
  // Timer loop
  // -------------------------
  let _timer = null;
  function startTimer() {
    STATE.running = true;
    STATE.paused = false;
    STATE.timeLeft = cfg.timeSec;
    updateTimerUI();

    _timer = setInterval(() => {
      if (!STATE.running || STATE.paused) return;

      STATE.timeLeft--;
      updateTimerUI();
      emitFeatures1s();

      if (STATE.timeLeft <= 0) {
        clearInterval(_timer);
        STATE.running = false;

        if (window.PlateSafe && typeof window.PlateSafe.end === 'function') {
          window.PlateSafe.end('timeup');
        } else {
          logLabel('end', { reason: 'timeup' });
        }
        alert('หมดเวลาแล้ว!');
      }
    }, 1000);

    logEvent('game_start', { timeSec: cfg.timeSec, seed: cfg.seed || null });
  }

  // -------------------------
  // Input (three.js raycasting + gaze dwell)
  // -------------------------
  let _raf = 0;
  let _raycaster = null;
  let _tmpMat = null;
  let _tmpVec = null;

  function ensureRayTools() {
    const THREE = cfg.three;
    if (!THREE) return false;
    if (!_raycaster) _raycaster = new THREE.Raycaster();
    if (!_tmpMat) _tmpMat = new THREE.Matrix4();
    if (!_tmpVec) _tmpVec = new THREE.Vector3();
    return true;
  }

  function getHotspotByObject(obj) {
    if (!obj) return null;
    let cur = obj;
    while (cur) {
      if (cur.userData && cur.userData.isHotspot) return cur;
      cur = cur.parent;
    }
    return null;
  }

  function updateDwellUI(pct) {
    const prog = qs('gdDwellProg');
    if (!prog) return;
    const deg = Math.max(0, Math.min(360, Math.round(360 * pct)));
    prog.style.background = `conic-gradient(rgba(255,255,255,0.75) 0deg, rgba(255,255,255,0.75) ${deg}deg, rgba(255,255,255,0.0) ${deg}deg, rgba(255,255,255,0.0) 360deg)`;
  }

  function resetDwell() {
    STATE.hoverId = null;
    STATE.hoverSince = 0;
    STATE.dwellFired = false;
    updateDwellUI(0);
  }

  function tickDwell(hit) {
    if (!STATE.running || STATE.paused) { resetDwell(); return; }
    if (!hit) { resetDwell(); return; }

    const id = hit.userData.hotspotId || hit.uuid || String(hit.id || '');
    if (STATE.hoverId !== id) {
      STATE.hoverId = id;
      STATE.hoverSince = now();
      STATE.dwellFired = false;
      updateDwellUI(0);
      return;
    }

    const dt = now() - STATE.hoverSince;
    const pct = dt / cfg.dwellMs;
    updateDwellUI(pct);

    if (!STATE.dwellFired && dt >= cfg.dwellMs) {
      STATE.dwellFired = true;
      const name = hit.userData.hotspotName || hit.name || 'unknown';
      onHotspotAction(name, { obj: hit });
      // small cooldown so it doesn't spam
      setTimeout(() => resetDwell(), 250);
    }
  }

  function raycastFromCameraCenter() {
    if (!ensureRayTools() || !cfg.camera || !cfg.scene) return null;
    _raycaster.setFromCamera({ x: 0, y: 0 }, cfg.camera);
    _raycaster.far = cfg.rayMax;
    const hits = _raycaster.intersectObjects(cfg.scene.children, true);
    for (let i = 0; i < hits.length; i++) {
      const h = getHotspotByObject(hits[i].object);
      if (h) return h;
    }
    return null;
  }

  function raycastFromPointerNDC() {
    if (!ensureRayTools() || !cfg.camera || !cfg.scene) return null;
    _raycaster.setFromCamera({ x: STATE.pointerNDC.x, y: STATE.pointerNDC.y }, cfg.camera);
    _raycaster.far = cfg.rayMax;
    const hits = _raycaster.intersectObjects(cfg.scene.children, true);
    for (let i = 0; i < hits.length; i++) {
      const h = getHotspotByObject(hits[i].object);
      if (h) return h;
    }
    return null;
  }

  function makeXRControllerRays() {
    const THREE = cfg.three;
    if (!THREE || !cfg.renderer || !cfg.renderer.xr) return [];
    const xr = cfg.renderer.xr;

    const ctrls = [];
    try {
      const c0 = xr.getController(0);
      const c1 = xr.getController(1);
      if (c0) ctrls.push(c0);
      if (c1) ctrls.push(c1);
    } catch (_) {}
    return ctrls;
  }

  function raycastFromController(ctrl) {
    if (!ensureRayTools() || !cfg.scene) return null;
    const THREE = cfg.three;

    // Ray origin = controller position; direction = controller -Z
    _tmpMat.identity().extractRotation(ctrl.matrixWorld);
    const dir = _tmpVec.set(0, 0, -1).applyMatrix4(_tmpMat).normalize();
    const origin = new THREE.Vector3().setFromMatrixPosition(ctrl.matrixWorld);

    _raycaster.ray.origin.copy(origin);
    _raycaster.ray.direction.copy(dir);
    _raycaster.far = cfg.rayMax;

    const hits = _raycaster.intersectObjects(cfg.scene.children, true);
    for (let i = 0; i < hits.length; i++) {
      const h = getHotspotByObject(hits[i].object);
      if (h) return h;
    }
    return null;
  }

  function attachXRTriggers() {
    const ctrls = makeXRControllerRays();
    if (!ctrls.length) return;

    ctrls.forEach((ctrl) => {
      // “select” is standard WebXR input event
      ctrl.addEventListener('select', () => {
        if (!STATE.running || STATE.paused) return;
        const hit = raycastFromController(ctrl);
        if (!hit) return;
        const name = hit.userData.hotspotName || hit.name || 'unknown';
        onHotspotAction(name, { obj: hit });
      });
    });

    logEvent('xr_input_ready', { controllers: ctrls.length });
  }

  function startRenderLoop() {
    // If no three.js renderer, skip
    if (!cfg.renderer || !cfg.camera || !cfg.scene || !cfg.three) return;

    attachXRTriggers();

    const loop = () => {
      _raf = requestAnimationFrame(loop);
      if (!STATE.running || STATE.paused) { resetDwell(); return; }

      // Dwell priority:
      // - If XR presenting: gaze-dwell from camera center
      // - Else: if pointer is down (mouse/touch), raycast pointer; else gaze center
      let hit = null;

      const xrPresenting = !!(cfg.renderer.xr && cfg.renderer.xr.isPresenting);
      if (xrPresenting) {
        hit = raycastFromCameraCenter();
      } else {
        if (STATE.pointerDown) hit = raycastFromPointerNDC();
        if (!hit) hit = raycastFromCameraCenter();
      }

      tickDwell(hit);

      // render (if host didn’t manage it)
      try {
        cfg.renderer.render(cfg.scene, cfg.camera);
      } catch (_) {}
    };

    loop();
  }

  // -------------------------
  // Desktop pointer helper (optional)
  // -------------------------
  function attachPointerToCanvas() {
    // If renderer.domElement exists, we compute NDC for raycastFromPointerNDC
    const canvas = cfg.renderer && cfg.renderer.domElement ? cfg.renderer.domElement : null;
    if (!canvas) return;

    const toNDC = (clientX, clientY) => {
      const r = canvas.getBoundingClientRect();
      const x = ((clientX - r.left) / r.width) * 2 - 1;
      const y = -(((clientY - r.top) / r.height) * 2 - 1);
      STATE.pointerNDC.x = x;
      STATE.pointerNDC.y = y;
    };

    canvas.addEventListener('pointerdown', (e) => {
      STATE.pointerDown = true;
      toNDC(e.clientX, e.clientY);

      // click-to-act immediately on desktop
      const hit = raycastFromPointerNDC();
      if (hit) {
        const name = hit.userData.hotspotName || hit.name || 'unknown';
        onHotspotAction(name, { obj: hit });
      }
    });

    canvas.addEventListener('pointermove', (e) => {
      toNDC(e.clientX, e.clientY);
    });

    canvas.addEventListener('pointerup', () => {
      STATE.pointerDown = false;
    });

    canvas.addEventListener('pointercancel', () => {
      STATE.pointerDown = false;
    });

    logEvent('pointer_ready', { target: 'renderer.domElement' });
  }

  // -------------------------
  // Hub commands
  // -------------------------
  function attachHubCommands() {
    window.addEventListener(
      'message',
      (ev) => {
        const m = ev.data;
        if (!m) return;

        if (m.type === 'command' && m.action === 'setTool' && m.value) setTool(m.value);
        if (m.type === 'command' && m.action === 'pause') { STATE.paused = true; STATE.running = false; updateTimerUI(); }
        if (m.type === 'command' && m.action === 'resume') { STATE.paused = false; STATE.running = true; updateTimerUI(); }
        if (m.type === 'command' && m.action === 'submit') submitReport();
      },
      false
    );

    window.addEventListener(
      'keydown',
      (e) => {
        if (e.key === '1') setTool('uv');
        if (e.key === '2') setTool('swab');
        if (e.key === '3') setTool('cam');
        if (e.key === ' ') togglePause();
        if (e.key.toLowerCase() === 'enter') submitReport();
      },
      false
    );
  }

  // -------------------------
  // Public API
  // -------------------------
  function init() {
    buildUI();

    // Try 3D hotspots first if three.js provided
    const has3D = !!(cfg.three && cfg.scene && createHotspots3D());
    if (!has3D) {
      // DOM fallback prototype
      createHotspotsDOM();
    } else {
      // optional pointer helper for desktop
      attachPointerToCanvas();
      startRenderLoop();
    }

    setTool('uv'); // default tool
    startTimer();
    attachHubCommands();
  }

  function stop() {
    STATE.running = false;
    STATE.paused = true;
    clearInterval(_timer);
    if (_raf) cancelAnimationFrame(_raf);
    resetDwell();
    logEvent('game_stop', {});
  }

  return {
    init,
    stop,
    getState: () => STATE,
    addEvidence,
    setTool
  };
}