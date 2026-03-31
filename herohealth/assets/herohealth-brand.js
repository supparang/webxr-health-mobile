(function(){
  'use strict';

  const GAME_META = {
    'goodjunk': { title:'GoodJunk Hero', zone:'Nutrition Zone', caption:'Choose healthy food and dodge junk!', logo:'./assets/logo-system/logos/goodjunk-logo.svg', zoneClass:'hh-zone-nutrition' },
    'plate': { title:'Balanced Plate', zone:'Nutrition Zone', caption:'Build a healthy plate with the right food groups.', logo:'./assets/logo-system/logos/plate-logo.svg', zoneClass:'hh-zone-nutrition' },
    'platev1': { title:'Balanced Plate', zone:'Nutrition Zone', caption:'Build a healthy plate with the right food groups.', logo:'./assets/logo-system/logos/plate-logo.svg', zoneClass:'hh-zone-nutrition' },
    'groups': { title:'Food Groups Quest', zone:'Nutrition Zone', caption:'Sort foods into the 5 Thai food groups.', logo:'./assets/logo-system/logos/groups-logo.svg', zoneClass:'hh-zone-nutrition' },
    'hydration': { title:'Hydration Quest', zone:'Nutrition Zone', caption:'Drink smart and keep your body refreshed.', logo:'./assets/logo-system/logos/hydration-logo.svg', zoneClass:'hh-zone-nutrition' },
    'brush': { title:'Brush Hero', zone:'Hygiene Zone', caption:'Brush teeth the right way and chase away germs.', logo:'./assets/logo-system/logos/brush-logo.svg', zoneClass:'hh-zone-hygiene' },
    'brush-vr': { title:'Brush Hero', zone:'Hygiene Zone', caption:'Brush teeth the right way and chase away germs.', logo:'./assets/logo-system/logos/brush-logo.svg', zoneClass:'hh-zone-hygiene' },
    'bath': { title:'Bath Time Hero', zone:'Hygiene Zone', caption:'Clean every step and get ready for the day.', logo:'./assets/logo-system/logos/bath-logo.svg', zoneClass:'hh-zone-hygiene' },
    'bath-v2': { title:'Bath Time Hero', zone:'Hygiene Zone', caption:'Clean every step and get ready for the day.', logo:'./assets/logo-system/logos/bath-logo.svg', zoneClass:'hh-zone-hygiene' },
    'germ-detective': { title:'Germ Detective', zone:'Hygiene Zone', caption:'Find sneaky germs and protect your health.', logo:'./assets/logo-system/logos/germ-detective-logo.svg', zoneClass:'hh-zone-hygiene' },
    'shadow-breaker': { title:'Shadow Breaker', zone:'Exercise Zone', caption:'Move fast, hit right, and keep the rhythm.', logo:'./assets/logo-system/logos/shadow-breaker-logo.svg', zoneClass:'hh-zone-exercise' },
    'rhythm-boxer': { title:'Rhythm Boxer', zone:'Exercise Zone', caption:'Punch to the beat and train your body.', logo:'./assets/logo-system/logos/rhythm-boxer-logo.svg', zoneClass:'hh-zone-exercise' },
    'jump-duck': { title:'Jump Duck', zone:'Exercise Zone', caption:'Jump, duck, and stay active!', logo:'./assets/logo-system/logos/jump-duck-logo.svg', zoneClass:'hh-zone-exercise' }
  };

  const DEFAULT_META = { title:'HeroHealth Game', zone:'HeroHealth World', caption:'Play, learn, and grow stronger every day.', logo:'./assets/logo-system/logos/herohealth-icon.svg', zoneClass:'hh-zone-nutrition' };

  function qs(name){ try { return new URL(location.href).searchParams.get(name) || ''; } catch { return ''; } }

  function detectGameKey(){
    const explicit = qs('game') || qs('gameId') || document.body.getAttribute('data-game') || '';
    if (explicit && GAME_META[explicit]) return explicit;
    const href = location.pathname.toLowerCase();
    const keys = Object.keys(GAME_META).sort((a,b)=>b.length-a.length);
    for (const key of keys){ if (href.includes(key)) return key; }
    if (href.includes('goodjunk')) return 'goodjunk';
    if (href.includes('plate')) return 'plate';
    if (href.includes('groups')) return 'groups';
    if (href.includes('hydration')) return 'hydration';
    if (href.includes('brush')) return 'brush-vr';
    if (href.includes('bath')) return 'bath-v2';
    if (href.includes('germ-detective')) return 'germ-detective';
    if (href.includes('shadow-breaker')) return 'shadow-breaker';
    if (href.includes('rhythm-boxer')) return 'rhythm-boxer';
    if (href.includes('jump-duck')) return 'jump-duck';
    return '';
  }

  function makeGameBrand(meta){
    const el = document.createElement('section');
    el.className = 'hh-gamebrand ' + (meta.zoneClass || '');
    el.innerHTML = `
      <img class="hh-gamebrand__logo" src="${meta.logo}" alt="${meta.title} logo">
      <div class="hh-gamebrand__meta">
        <div class="hh-gamebrand__zone">${meta.zone}</div>
        <div class="hh-gamebrand__title">${meta.title}</div>
        <div class="hh-gamebrand__caption">${meta.caption}</div>
      </div>`;
    return el;
  }

  function mountGameBrand(selector){
    const root = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!root) return null;
    const key = detectGameKey();
    const meta = GAME_META[key] || DEFAULT_META;
    const brand = makeGameBrand(meta);
    root.innerHTML = '';
    root.appendChild(brand);
    document.body.setAttribute('data-brand-game', key || 'default');
    document.body.setAttribute('data-brand-zone', (meta.zone || '').toLowerCase().replace(/\s+/g,'-'));
    return { key, meta, brand };
  }

  function mountHubBrand(selector){
    const root = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!root) return null;
    root.innerHTML = `
      <section class="hh-brandbar hh-brandbar--hub">
        <div class="hh-brandbar__left">
          <img class="hh-brandbar__logo" src="./assets/logo-system/logos/hub-logo.svg" alt="HeroHealth Hub logo">
        </div>
        <div class="hh-zones" aria-label="HeroHealth Zones">
          <span class="hh-chip hh-chip--hygiene">🪥 Hygiene Zone</span>
          <span class="hh-chip hh-chip--nutrition">🍎 Nutrition Zone</span>
          <span class="hh-chip hh-chip--exercise">🏃 Exercise Zone</span>
        </div>
      </section>`;
    return root.firstElementChild;
  }

  function injectPageTitle(selector){
    const node = document.querySelector(selector);
    if (!node) return null;
    const key = detectGameKey();
    const meta = GAME_META[key] || DEFAULT_META;
    node.textContent = meta.title;
    return meta.title;
  }

  window.HeroHealthBrand = {
    GAME_META,
    detectGameKey,
    mountGameBrand,
    mountHubBrand,
    injectPageTitle
  };
})();
