// === /herohealth/gate-nav.js ===
// HeroHealth canonical gate/router helpers
// PATCH v20260308-GATE-NAV-CANONICAL
//
// แก้ปัญหา path ซ้ำหลัง warmup/cooldown โดยบังคับ resolve จาก root /herohealth/
// และกัน auto-skip loop ด้วย wgskip=1

(function(){
  'use strict';

  function qs(k, d=''){
    try{ return new URL(location.href).searchParams.get(k) ?? d; }
    catch{ return d; }
  }

  function normalizeMaybeEncodedUrl(v){
    v = String(v ?? '').trim();
    if(!v || v === 'null' || v === 'undefined') return '';
    if(/%3A|%2F|%3F|%26|%3D/i.test(v)){
      try{ v = decodeURIComponent(v); }catch(e){}
    }
    return v.trim();
  }

  function canonicalHeroRoot(){
    const origin = location.origin.replace(/\/+$/,'');
    const path = location.pathname || '/';
    const idx = path.indexOf('/herohealth/');
    if(idx >= 0){
      return origin + path.slice(0, idx + '/herohealth/'.length);
    }
    return origin + '/herohealth/';
  }

  function gameEntryMap(){
    return {
      goodjunk: 'goodjunk-launcher.html',
      groups: 'groups-vr.html',
      hydration: 'hydration-vr.html',
      plate: 'plate-vr.html',

      handwash: 'hygiene-vr.html',
      brush: 'brush-vr.html',
      bath: 'bath-vr.html',
      cleanobject: 'clean-objects.html',
      cleanobjects: 'clean-objects.html',
      maskcough: 'maskcough-vr.html',

      germdetective: 'germ-detective.html',
      germ: 'germ-detective.html',

      shadowbreaker: 'shadow-breaker-vr.html',
      rhythmboxer: 'rhythm-boxer-vr.html',
      jumpduck: 'jump-duck-vr.html',
      balancehold: 'balance-hold-vr.html',
      fitnessplanner: 'fitness-planner/planner.html'
    };
  }

  function gameRunMap(){
    return {
      germdetective: 'germ-detective/germ-detective.html'
    };
  }

  function sanitizeGameKey(v){
    return String(v || '')
      .toLowerCase()
      .replace(/[\s_\-]+/g, '')
      .trim();
  }

  function canonicalGameUrl(gameKey, mode){
    const root = canonicalHeroRoot();
    const gk = sanitizeGameKey(gameKey);
    const entry = mode === 'run' ? gameRunMap()[gk] : gameEntryMap()[gk];
    if(!entry) return '';
    return new URL(entry, root).toString();
  }

  function appendCommonParams(url, extra){
    const u = new URL(url, location.href);
    const sp = u.searchParams;
    const src = new URL(location.href).searchParams;

    [
      'run','diff','time','seed','studyId','phase','conditionGroup','log','view','pid','api','ai','debug',
      'planSeq','planDay','planSlot','planMode','planSlots','planIndex','autoNext',
      'plannedGame','finalGame','zone','cdnext','grade','scene','room','battle','autostart','forfeit'
    ].forEach(k=>{
      const v = src.get(k);
      if(v != null && v !== '' && !sp.has(k)) sp.set(k, v);
    });

    // กัน warmup loop
    sp.set('wgskip', '1');

    // กัน param ที่ชวนให้ย้อนเข้ากลับ gate ซ้ำ
    sp.delete('plannedGame');
    sp.delete('finalGame');
    sp.delete('autoNext');

    if(extra && typeof extra === 'object'){
      Object.keys(extra).forEach(k=>{
        const v = extra[k];
        if(v === null || v === undefined || v === '') sp.delete(k);
        else sp.set(k, String(v));
      });
    }

    return u.toString();
  }

  function nextFromWarmup(themeOrGame){
    const key = sanitizeGameKey(themeOrGame || qs('theme','') || qs('game','') || qs('plannedGame','') || qs('finalGame',''));
    let url = '';

    // Germ Detective ใช้ run page จริงหลัง warmup ได้เลย
    if(key === 'germdetective' || key === 'germ'){
      url = canonicalGameUrl('germdetective', 'run');
      if(url) return appendCommonParams(url, { scene: qs('scene','classroom') || 'classroom' });
    }

    url = canonicalGameUrl(key, 'entry');
    if(url) return appendCommonParams(url, {});
    return '';
  }

  function withSkipFlag(url){
    if(!url) return '';
    const u = new URL(url, location.href);
    u.searchParams.set('wgskip', '1');
    return u.toString();
  }

  window.HHGateNav = {
    qs,
    normalizeMaybeEncodedUrl,
    canonicalHeroRoot,
    canonicalGameUrl,
    appendCommonParams,
    nextFromWarmup,
    withSkipFlag
  };
})();