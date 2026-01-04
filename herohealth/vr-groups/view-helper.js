/* === /herohealth/vr-groups/view-helper.js ===
PACK 13: ViewHelper (PC/Mobile/VR/cVR)
✅ init(view) + helpers
✅ cVR calibration overlay (optional via ?calib=1)
✅ best-effort fullscreen + landscape lock for cVR
✅ tryImmersiveForCVR(): request fullscreen + (if A-Frame) enter VR
✅ emits hha:recenter (for engine/hooks to react if needed)
*/
(function (root) {
  'use strict';

  const DOC = root.document;
  if (!DOC) return;

  const NS = root.GroupsVR = root.GroupsVR || {};
  const VH = NS.ViewHelper = NS.ViewHelper || {};

  function qs(k, def=null){
    try { return new URL(root.location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function emit(name, detail){
    try { root.dispatchEvent(new CustomEvent(name, { detail })); } catch(_){}
  }

  function isCVR(view){
    view = String(view||'').toLowerCase();
    return view === 'cvr' || DOC.body.classList.contains('view-cvr');
  }

  async function tryFullscreen(){
    try{
      const el = DOC.documentElement;
      if (!DOC.fullscreenElement && el.requestFullscreen){
        await el.requestFullscreen({ navigationUI: 'hide' });
      }
    }catch(_){}
  }

  async function tryLockLandscape(){
    try{
      const s = root.screen && root.screen.orientation;
      if (s && s.lock) await s.lock('landscape');
    }catch(_){}
  }

  function findAFrameScene(){
    return DOC.querySelector('a-scene');
  }

  async function tryEnterVR(){
    try{
      const scene = findAFrameScene();
      if (!scene) return false;
      // A-Frame scene enters VR
      if (scene.enterVR) { scene.enterVR(); return true; }
    }catch(_){}
    return false;
  }

  // ---------- Calibration Overlay ----------
  function ensureCalibUI(){
    let wrap = DOC.querySelector('.cvr-calib');
    if (wrap) return wrap;

    wrap = DOC.createElement('div');
    wrap.className = 'cvr-calib hidden';
    wrap.innerHTML = `
      <div class="cc-panel">
        <div class="cc-title">🧭 Calibration (Cardboard)</div>
        <div class="cc-sub">
          ตั้งศูนย์ก่อนเล่นจริง: ถือมือถือให้นิ่ง แล้วกด <b>RECENTER</b> (ปุ่มของ vr-ui.js)
        </div>

        <div class="cc-steps">
          <div class="cc-step"><div class="n">1</div><span>ถือมือถือให้ระดับสายตา และหันไปทาง “ตรงกลาง”</span></div>
          <div class="cc-step"><div class="n">2</div><span>กด <b>RECENTER</b> (มุมขวาบน) 1 ครั้ง</span></div>
          <div class="cc-step"><div class="n">3</div><span>แตะจอเพื่อยิงจาก crosshair — ซ้อม 15 วิ ก่อนเริ่มจริง</span></div>
        </div>

        <div class="cc-row">
          <button class="cc-btn cc-strong" id="ccGo" type="button">✅ พร้อมแล้ว</button>
          <button class="cc-btn" id="ccRecenter" type="button">🎯 RECENTER อีกครั้ง</button>
        </div>
        <div class="cc-note">Tip: ถ้าหัวเอียง/เป้าไม่ตรง ให้กด RECENTER ซ้ำได้</div>
      </div>
    `;
    DOC.body.appendChild(wrap);

    const go = wrap.querySelector('#ccGo');
    const rc = wrap.querySelector('#ccRecenter');

    go && go.addEventListener('click', ()=>{
      wrap.classList.add('hidden');
      DOC.body.classList.remove('calib-open');
      emit('hha:coach', { text:'โอเค! เริ่มซ้อมได้เลย 👌', mood:'happy' });
    });

    rc && rc.addEventListener('click', ()=>{
      emit('hha:recenter', { source:'calib' });
      // also try to click vr-ui recenter button if present
      try{
        const btn = DOC.querySelector('.hha-vr-ui .btn-recenter');
        btn && btn.click();
      }catch(_){}
      emit('hha:coach', { text:'รีเซ็นเตอร์แล้ว 🎯', mood:'neutral' });
    });

    return wrap;
  }

  function showCalib(open){
    const wrap = ensureCalibUI();
    if (!wrap) return;
    wrap.classList.toggle('hidden', !open);
    DOC.body.classList.toggle('calib-open', !!open);
  }

  // ---------- Public API ----------
  VH.init = function ({ view } = {}) {
    view = String(view || qs('view','mobile') || 'mobile').toLowerCase();

    // optional open calib via ?calib=1 (and only in cVR)
    const calib = String(qs('calib','0')||'0');
    if (isCVR(view) && (calib==='1' || calib==='true')) {
      showCalib(true);
    } else {
      showCalib(false);
    }
  };

  VH.tryImmersiveForCVR = async function () {
    // best-effort: fullscreen + landscape + (optional) enter VR
    await tryFullscreen();
    await tryLockLandscape();
    await tryEnterVR();
  };

  VH.tryFullscreen = tryFullscreen;
  VH.tryLockLandscape = tryLockLandscape;
  VH.showCalib = showCalib;

})(typeof window !== 'undefined' ? window : globalThis);