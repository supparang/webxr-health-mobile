async function boot(){
  const cfg=await APP.loadConfig();
  document.querySelector('.brand').innerHTML=`<span>${APP.t('brand')}</span> <span class="badge">${APP.t('subtitle')}</span>`;
  const langSel=document.getElementById('langSel'); langSel.value=APP.LANG; langSel.addEventListener('change',e=>{APP.setLang(e.target.value); AudioBus.tap();});
  const grid=document.getElementById('gameGrid');
  grid.innerHTML=cfg.games.map(g=>`<div class="card">
      <h3>${g.name[APP.LANG]||g.name.en}</h3><p>${g.desc[APP.LANG]||g.desc.en}</p>
      <div style="margin-top:12px; display:flex; gap:8px">
        <button class="btn accent" data-game="${g.id}" data-i18n="play">${APP.t('play')}</button>
        <a class="btn" href="games/${g.id}/index.html" target="_blank" data-i18n="open">${APP.t('open')}</a>
      </div></div>`).join('');
  grid.querySelectorAll('button[data-game]').forEach(btn=>btn.addEventListener('click',e=>{AudioBus.tap(); APP.routeToGame(e.currentTarget.dataset.game);}));
  APP.refreshTexts(); AudioBus.playBgm(); APP.badge('Hub ready');
}
document.addEventListener('DOMContentLoaded',boot);