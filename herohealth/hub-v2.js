/* ===== HeroHealth Hub v2 Brand + Canonical Game Registry ===== */
(function(){
  'use strict';

  const GAME_REGISTRY = {
    goodjunk: {
      key: 'goodjunk',
      title: 'GoodJunk Hero',
      shortTitle: 'GoodJunk',
      zone: 'nutrition',
      zoneLabel: 'Nutrition',
      emoji: '🍎',
      logo: './assets/logo-system/logos/goodjunk-logo.svg',
      href: './vr-goodjunk/goodjunk-solo.html?zone=nutrition&game=goodjunk'
    },
    plate: {
      key: 'plate',
      title: 'Balanced Plate',
      shortTitle: 'Plate',
      zone: 'nutrition',
      zoneLabel: 'Nutrition',
      emoji: '🥗',
      logo: './assets/logo-system/logos/plate-logo.svg',
      href: './plate-vr.html?zone=nutrition&game=plate'
    },
    groups: {
      key: 'groups',
      title: 'Food Groups Quest',
      shortTitle: 'Groups',
      zone: 'nutrition',
      zoneLabel: 'Nutrition',
      emoji: '🥦',
      logo: './assets/logo-system/logos/groups-logo.svg',
      href: './groups-vr.html?zone=nutrition&game=groups'
    },
    hydration: {
      key: 'hydration',
      title: 'Hydration Quest',
      shortTitle: 'Hydration',
      zone: 'nutrition',
      zoneLabel: 'Nutrition',
      emoji: '💧',
      logo: './assets/logo-system/logos/hydration-logo.svg',
      href: './hydration-v2.html?zone=nutrition&game=hydration'
    },
    brush: {
      key: 'brush',
      title: 'Brush Hero',
      shortTitle: 'Brush',
      zone: 'hygiene',
      zoneLabel: 'Hygiene',
      emoji: '🪥',
      logo: './assets/logo-system/logos/brush-logo.svg',
      href: './brush-vr.html?zone=hygiene&game=brush'
    },
    bath: {
      key: 'bath',
      title: 'Bath Time Hero',
      shortTitle: 'Bath',
      zone: 'hygiene',
      zoneLabel: 'Hygiene',
      emoji: '🛁',
      logo: './assets/logo-system/logos/bath-logo.svg',
      href: './bath-vr.html?zone=hygiene&game=bath'
    },
    germ: {
      key: 'germ',
      title: 'Germ Detective',
      shortTitle: 'Germ Detective',
      zone: 'hygiene',
      zoneLabel: 'Hygiene',
      emoji: '🦠',
      logo: './assets/logo-system/logos/germ-detective-logo.svg',
      href: './germ-detective.html?zone=hygiene&game=germ'
    },
    shadow: {
      key: 'shadow',
      title: 'Shadow Breaker',
      shortTitle: 'Shadow Breaker',
      zone: 'fitness',
      zoneLabel: 'Fitness',
      emoji: '⚡',
      logo: './assets/logo-system/logos/shadow-breaker-logo.svg',
      href: './fitness/shadow-breaker.html?zone=fitness&game=shadow'
    },
    rhythm: {
      key: 'rhythm',
      title: 'Rhythm Boxer',
      shortTitle: 'Rhythm Boxer',
      zone: 'fitness',
      zoneLabel: 'Fitness',
      emoji: '🥊',
      logo: './assets/logo-system/logos/rhythm-boxer-logo.svg',
      href: './fitness/rhythm-boxer.html?zone=fitness&game=rhythm'
    },
    jumpduck: {
      key: 'jumpduck',
      title: 'Jump Duck',
      shortTitle: 'Jump Duck',
      zone: 'fitness',
      zoneLabel: 'Fitness',
      emoji: '🏃',
      logo: './assets/logo-system/logos/jump-duck-logo.svg',
      href: './fitness/jump-duck.html?zone=fitness&game=jumpduck'
    }
  };

  const ZONE_MAP = {
    hygiene: ['brush', 'bath', 'germ'],
    nutrition: ['goodjunk', 'plate', 'groups', 'hydration'],
    fitness: ['shadow', 'rhythm', 'jumpduck']
  };

  const FEATURED = {
    hygiene: 'germ',
    nutrition: 'goodjunk',
    fitness: 'jumpduck'
  };

  const $ = (sel, root = document) => root.querySelector(sel);

  function withHub(url){
    try{
      const u = new URL(url, location.href);
      if (!u.searchParams.get('hub')) {
        u.searchParams.set('hub', new URL('./hub.html', location.href).href);
      }
      return u.toString();
    }catch{
      return url;
    }
  }

  function gameCard(gameKey){
    const g = GAME_REGISTRY[gameKey];
    if (!g) return '';
    const href = withHub(g.href);
    return `
      <a class="hh-game-card" href="${href}" data-game="${g.key}" data-zone="${g.zone}">
        <img class="hh-game-card__logo" src="${g.logo}" alt="${g.title}" onerror="this.style.display='none'; this.insertAdjacentHTML('afterend','<div class=&quot;hh-game-card__logo-fallback&quot;>${g.emoji}</div>');">
        <div class="hh-game-card__body">
          <h4 class="hh-game-card__title">${g.title}</h4>
          <p class="hh-game-card__meta">
            <span class="hh-zone-chip hh-zone-chip--${g.zone}">${g.emoji} ${g.zoneLabel}</span>
          </p>
        </div>
      </a>
    `;
  }

  function renderZonePreview(zone, mountId){
    const el = document.getElementById(mountId);
    if (!el) return;
    const keys = ZONE_MAP[zone] || [];
    el.innerHTML = keys.map(gameCard).join('');
  }

  function renderLibrary(){
    const el = document.getElementById('libraryBox');
    if (!el) return;
    const all = Object.keys(GAME_REGISTRY);
    el.innerHTML = all.map(gameCard).join('');
  }

  function renderPicker(filter = 'all'){
    const el = document.getElementById('pickerList');
    if (!el) return;

    let keys = Object.keys(GAME_REGISTRY);

    if (filter === 'recommended') {
      keys = [FEATURED.hygiene, FEATURED.nutrition, FEATURED.fitness];
    } else if (filter === 'recent') {
      const recentKey = localStorage.getItem('HH_LAST_GAME_KEY');
      keys = recentKey && GAME_REGISTRY[recentKey] ? [recentKey] : [FEATURED.nutrition];
    }

    el.innerHTML = keys.map(gameCard).join('');
  }

  function bindPickerButtons(){
    $('#btnQuickRecommended')?.addEventListener('click', () => {
      openPicker('เกมแนะนำ', 'เริ่มจากเกมเด่นของแต่ละโซนได้เลย', 'recommended');
    });
    $('#btnQuickAllGames')?.addEventListener('click', () => {
      openPicker('คลังเกมทั้งหมด', 'เลือกเกมที่อยากเล่นได้เลย', 'all');
    });
    $('#btnQuickRecent')?.addEventListener('click', () => {
      openPicker('เกมล่าสุด', 'กลับไปเล่นเกมล่าสุดได้ทันที', 'recent');
    });

    $('#pickerShowRecommended')?.addEventListener('click', () => renderPicker('recommended'));
    $('#pickerShowAllModes')?.addEventListener('click', () => renderPicker('all'));
    $('#pickerShowRecent')?.addEventListener('click', () => renderPicker('recent'));

    document.querySelectorAll('[data-close-picker]').forEach(btn => {
      btn.addEventListener('click', closePicker);
    });
  }

  function openPicker(title, sub, filter){
    const modal = document.getElementById('gamePicker');
    if (!modal) return;
    $('#pickerTitle').textContent = title;
    $('#pickerSub').textContent = sub;
    renderPicker(filter);
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('is-open');
  }

  function closePicker(){
    const modal = document.getElementById('gamePicker');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    modal.classList.remove('is-open');
  }

  function updateFeaturedLabels(){
    const hyg = GAME_REGISTRY[FEATURED.hygiene];
    const nut = GAME_REGISTRY[FEATURED.nutrition];
    const fit = GAME_REGISTRY[FEATURED.fitness];
    if (hyg) $('#hygFeatured').textContent = hyg.title;
    if (nut) $('#nutriFeatured').textContent = nut.title;
    if (fit) $('#fitFeatured').textContent = fit.title;
  }

  function updateTodayNextGame(){
    const el = document.getElementById('todayNextGame');
    if (!el) return;
    el.textContent = GAME_REGISTRY[FEATURED.nutrition].title;
  }

  function bindZonePrimaryButtons(){
    const map = [
      ['btnPlayHygiene', FEATURED.hygiene],
      ['btnPlayNutrition', FEATURED.nutrition],
      ['btnPlayFitness', FEATURED.fitness]
    ];
    map.forEach(([id, key]) => {
      const el = document.getElementById(id);
      const g = GAME_REGISTRY[key];
      if (el && g) el.href = withHub(g.href);
    });

    $('#btnZoneHygiene')?.addEventListener('click', () => openPicker('Hygiene Zone', 'เลือกเกมสุขอนามัย', 'all'));
    $('#btnZoneNutrition')?.addEventListener('click', () => openPicker('Nutrition Zone', 'เลือกเกมโภชนาการ', 'all'));
    $('#btnZoneFitness')?.addEventListener('click', () => openPicker('Fitness Zone', 'เลือกเกมการออกกำลังกาย', 'all'));
  }

  function mountTopBrand(){
    const mount = document.getElementById('hhHubBrandMount');
    if (!mount) return;
    mount.innerHTML = `
      <div class="hh-brand-hero">
        <div class="hh-brand-hero__card">
          <img src="./assets/logo-system/logos/hub-logo.svg" alt="HeroHealth" class="hh-brand-hero__logo"
               onerror="this.style.display='none';this.nextElementSibling.hidden=false;">
          <div class="hh-brand-hero__fallback" hidden>🛡️</div>
          <div class="hh-brand-hero__copy">
            <h2>HeroHealth World</h2>
            <p>เลือกภารกิจสุขภาพที่อยากเล่น แล้วออกผจญภัยได้เลย</p>
          </div>
        </div>
      </div>
    `;
  }

  function init(){
    mountTopBrand();
    updateFeaturedLabels();
    updateTodayNextGame();
    renderZonePreview('hygiene', 'hygPreview');
    renderZonePreview('nutrition', 'nutriPreview');
    renderZonePreview('fitness', 'fitPreview');
    renderLibrary();
    renderPicker('recommended');
    bindPickerButtons();
    bindZonePrimaryButtons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once:true });
  } else {
    init();
  }

  window.HH_GAME_REGISTRY = GAME_REGISTRY;
})();