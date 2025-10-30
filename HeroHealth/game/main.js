// === Screen State helpers (menu | play | result) ===
function setState(name){
  document.body.classList.remove('state-menu','state-play','state-result');
  document.body.classList.add(`state-${name}`);
}
function showMenu(){  setState('menu');   }
function showPlay(){  setState('play');   }
function showResult(){setState('result'); }

// --- Wire basic buttons (menu/start/home/replay)
(function wireUIStable(){
  // namespace ให้ระบบหลักเรียกได้
  window.HHA = window.HHA || {};
// === PATCH: bind menu selections (modes / difficulty / sound) ===
(function bindMenuSelection(){
  const MODE_TILES = {
    m_goodjunk:  'goodjunk',
    m_groups:    'groups',
    m_hydration: 'hydration',
    m_plate:     'plate'
  };
  let selectedMode = 'goodjunk';
  let selectedDiff = 'Normal';

  const elModeName = document.getElementById('modeName');
  const elDiffText = document.getElementById('difficulty');

  function setActive(cls, el){
    // ล้าง active ในกลุ่มเดียวกัน แล้วใส่ให้ตัวที่เลือก
    document.querySelectorAll(cls).forEach(x=>x.classList.remove('active'));
    el?.classList?.add('active');
  }

  function selectMode(key, el){
    selectedMode = key || 'goodjunk';
    document.body.setAttribute('data-mode', selectedMode);
    if (elModeName){
      elModeName.textContent =
        selectedMode==='goodjunk'  ? 'Good vs Junk' :
        selectedMode==='groups'    ? '5 Food Groups' :
        selectedMode==='hydration' ? 'Hydration' :
        selectedMode==='plate'     ? 'Healthy Plate' : selectedMode;
    }
    setActive('#menuBar .tile', el);
  }

  function selectDiff(diff, el){
    selectedDiff = diff || 'Normal';
    document.body.setAttribute('data-diff', selectedDiff);
    window.__HHA_DIFF = selectedDiff; // ให้โหมดอ่านค่าได้
    if (elDiffText) elDiffText.textContent = selectedDiff;
    setActive('#menuBar .chip', el);
  }

  // ผูก tiles (โหมด)
  Object.keys(MODE_TILES).forEach(id=>{
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', ()=>selectMode(MODE_TILES[id], el));
  });

  // ผูกความยาก
  const dEasy   = document.getElementById('d_easy');
  const dNormal = document.getElementById('d_normal');
  const dHard   = document.getElementById('d_hard');

  dEasy  ?.addEventListener('click', ()=>selectDiff('Easy',   dEasy));
  dNormal?.addEventListener('click', ()=>selectDiff('Normal', dNormal));
  dHard  ?.addEventListener('click', ()=>selectDiff('Hard',   dHard));

  // ค่าเริ่มต้น (ให้ปุ่มมี active ตั้งแต่แรก)
  selectMode('goodjunk', document.getElementById('m_goodjunk'));
  selectDiff('Normal', dNormal);

  // ปุ่มเสียงแบบง่าย (toggle mute element <audio> ทั้งหมด)
  const soundBtn = document.getElementById('soundToggle');
  if (soundBtn){
    let muted = false;
    soundBtn.addEventListener('click', ()=>{
      muted = !muted;
      document.querySelectorAll('audio').forEach(a=>{ try{ a.muted = muted; }catch{} });
      soundBtn.textContent = muted ? '🔈' : '🔊';
    });
  }

  // เชื่อมกับปุ่ม Start/Replay ให้ใช้ mode/diff ที่เลือก
  const btnStart  = document.getElementById('btn_start');
  const btnReplay = document.querySelector('[data-result="replay"]');

  function runSelected(){
    try { stopGame(); } catch {}
    try { loadMode(selectedMode); } catch {}
    window.__HHA_DIFF = selectedDiff;
    showPlay();
    startGame();
  }

  btnStart ?.addEventListener('click', runSelected);
  btnReplay?.addEventListener('click', runSelected);

  // เผื่อระบบอื่นเรียก
  window.HHA = window.HHA || {};
  window.HHA.startSelectedMode = runSelected;
})();

  // ให้ engine เรียกเปิด/ปิดสนามแบบเดียวกัน
  window.HHA.setPlayfieldActive = (on)=>{
    if (on) setState('play'); else setState('menu');
  };

  // ปุ่ม
  const btnStart  = document.getElementById('btn_start');
  const btnHome   = document.querySelector('[data-result="home"]');
  const btnReplay = document.querySelector('[data-result="replay"]');

  // start: สลับไปหน้าเล่น + เรียกโหมดที่เลือก (ถ้า engine เคยผูก)
  btnStart?.addEventListener('click', (e)=>{
    e.preventDefault();
    // ถ้า main engine มีวิธีเริ่มโหมด ให้ใช้เลย
    if (typeof window.HHA.startSelectedMode === 'function'){
      showPlay();
      window.HHA.startSelectedMode();
    } else {
      // fallback: สั่ง engine ตรงๆ
      try { loadMode((new URLSearchParams(location.search).get('mode')) || 'goodjunk'); } catch {}
      showPlay();
      startGame();
    }
  });

  btnHome?.addEventListener('click', (e)=>{
    e.preventDefault();
    try { window.HHA.stop?.(); } catch {}
    stopGame();
    showMenu();
  });

  btnReplay?.addEventListener('click', (e)=>{
    e.preventDefault();
    showPlay();
    try { window.HHA.replay?.(); startGame(); } catch { startGame(); }
  });

  // เปิดมาที่หน้าเมนูเสมอ
  showMenu();
})();
