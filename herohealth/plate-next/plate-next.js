(function(){
  const qs = new URLSearchParams(location.search);

  const HUB_URL = qs.get('hub') || '/herohealth/hub-next.html';
  const HUB_VERSION = qs.get('hubVersion') || 'next';
  const LAUNCH_GAME_VERSION = qs.get('launchGameVersion') || 'plate-next';

  const RUN_PATH = './plate-run.html'; // เปลี่ยนภายหลังเมื่อมี run จริง

  const $ = (sel) => document.querySelector(sel);

  const els = {
    meta: $('#pxMeta'),
    hubText: $('#pxHubText'),
    versionText: $('#pxVersionText'),
    missionPanel: $('#missionPanel'),
    btnStart: $('#btnStart'),
    btnMission: $('#btnMission'),
    btnCloseMission: $('#btnCloseMission'),
    btnBackHubTop: $('#btnBackHubTop'),
    btnBackHubBottom: $('#btnBackHubBottom')
  };

  function buildChip(text){
    const span = document.createElement('span');
    span.className = 'px-chip';
    span.textContent = text;
    return span;
  }

  function renderMeta(){
    if (!els.meta) return;
    els.meta.innerHTML = '';
    els.meta.appendChild(buildChip(`Hub: ${HUB_VERSION}`));
    els.meta.appendChild(buildChip(`Game: ${LAUNCH_GAME_VERSION}`));
    els.meta.appendChild(buildChip('Mode: Next / Research-ready'));
  }

  function renderFooter(){
    if (els.hubText) els.hubText.textContent = `Hub: ${HUB_VERSION}`;
    if (els.versionText) els.versionText.textContent = `Version: ${LAUNCH_GAME_VERSION}`;
  }

  function goBackHub(){
    location.href = HUB_URL;
  }

  function openMission(){
    if (els.missionPanel) els.missionPanel.hidden = false;
  }

  function closeMission(){
    if (els.missionPanel) els.missionPanel.hidden = true;
  }

  function startGame(){
    const url = new URL(RUN_PATH, location.href);
    url.searchParams.set('hub', HUB_URL);
    url.searchParams.set('hubVersion', HUB_VERSION);
    url.searchParams.set('launchGameVersion', LAUNCH_GAME_VERSION);
    url.searchParams.set('gameId', 'plate-next');

    // ตอนนี้ยังไม่มี run จริง จึง fallback เป็น mission panel ก่อน
    openMission();

    // ภายหลังเมื่อมี run จริง ให้ใช้บรรทัดนี้แทน:
    // location.href = url.toString();
    console.log('[Plate Next] ready to launch:', url.toString());
  }

  function bind(){
    els.btnStart?.addEventListener('click', startGame);
    els.btnMission?.addEventListener('click', openMission);
    els.btnCloseMission?.addEventListener('click', closeMission);
    els.btnBackHubTop?.addEventListener('click', goBackHub);
    els.btnBackHubBottom?.addEventListener('click', goBackHub);

    els.missionPanel?.addEventListener('click', (e) => {
      if (e.target === els.missionPanel) closeMission();
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMission();
    });
  }

  function init(){
    renderMeta();
    renderFooter();
    bind();
  }

  init();
})();