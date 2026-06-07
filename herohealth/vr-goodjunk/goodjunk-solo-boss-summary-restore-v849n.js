// === /herohealth/vr-goodjunk/goodjunk-solo-boss-summary-restore-v849n.js ===
// PATCH v20260606-GOODJUNK-SOLO-BOSS-SUMMARY-RESTORE-GUARD-V849N
// Purpose:
// - กัน summary เปิดเร็วเกินไปจาก fallback text / interval / toast
// - ให้เปิด summary ได้เฉพาะเมื่อเล่นจริงแล้ว และมีหลักฐานจบเกมจริง
// - แก้อาการ: เข้าเกม/เล่นไม่กี่ทีแล้วขึ้น summary คะแนน 0/14/0%

(function(){
  'use strict';

  const PATCH = 'v20260606-GOODJUNK-SOLO-BOSS-SUMMARY-RESTORE-GUARD-V849N';

  if(window.GJ_SUMMARY_RESTORE_GUARD_V849N_LOADED){
    return;
  }
  window.GJ_SUMMARY_RESTORE_GUARD_V849N_LOADED = true;

  const startedAt = Date.now();

  function qs(){
    return new URLSearchParams(location.search || '');
  }

  function isGoodJunkSolo(){
    const q = qs();
    const game = String(q.get('game') || q.get('gameId') || '').toLowerCase();
    const mode = String(q.get('mode') || q.get('entry') || '').toLowerCase();

    return (
      game === 'goodjunk' ||
      mode.includes('goodjunk') ||
      location.pathname.includes('/vr-goodjunk/')
    );
  }

  if(!isGoodJunkSolo()){
    return;
  }

  function num(v, d){
    v = Number(v);
    return Number.isFinite(v) ? v : d;
  }

  function textOfPage(){
    return String(document.body && document.body.innerText || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getScore(){
    const el = document.getElementById('gjmScore');
    return num(el && el.textContent, 0);
  }

  function getTimeLeft(){
    const el = document.getElementById('gjmTime');
    return num(el && el.textContent, 999);
  }

  function getCombo(){
    const el = document.getElementById('gjmCombo');
    const raw = String(el && el.textContent || '').replace(/[^\d.-]/g, '');
    return num(raw, 0);
  }

  function readSummaryObject(){
    const keys = [
      'GJ_SOLO_BOSS_LAST_SUMMARY',
      'GJ_FULL_3D_VR_LAST_SUMMARY',
      'GJ_LAST_SUMMARY',
      'HHA_LAST_SUMMARY'
    ];

    for(const k of keys){
      try{
        const obj = JSON.parse(localStorage.getItem(k) || '{}');
        if(obj && typeof obj === 'object' && Object.keys(obj).length){
          return obj;
        }
      }catch(_){}
    }

    return {};
  }

  function getGoodHits(){
    const s = readSummaryObject();

    return num(
      s.goodHits ??
      s.good ??
      s.goodCount ??
      s.correct ??
      s.goodHit ??
      window.GJ_GOOD_HITS ??
      window.goodHits,
      0
    );
  }

  function getBossHp(){
    const candidates = [
      window.GJ_BOSS_HP,
      window.gjBossHp,
      window.bossHp,
      window.__GJ_BOSS_HP,
      window.__bossHp
    ];

    for(const c of candidates){
      if(Number.isFinite(Number(c))) return Number(c);
    }

    const bossBar = document.querySelector('[data-boss-hp],[aria-valuenow]');
    if(bossBar){
      const v = bossBar.getAttribute('data-boss-hp') || bossBar.getAttribute('aria-valuenow');
      if(Number.isFinite(Number(v))) return Number(v);
    }

    return null;
  }

  function hasRealPlayEvidence(){
    const elapsed = Date.now() - startedAt;
    const score = getScore();
    const combo = getCombo();
    const goodHits = getGoodHits();

    const hasTouchedGame =
      !!window.GJ_REAL_PLAY_STARTED ||
      !!window.GJ_HAS_REAL_PLAY ||
      !!window.GJ_GAME_STARTED ||
      !!window.__GJ_REAL_PLAY ||
      document.body.classList.contains('gj-real-play') ||
      document.documentElement.classList.contains('gj-real-play');

    return (
      hasTouchedGame ||
      elapsed >= 12000 ||
      score >= 80 ||
      combo >= 2 ||
      goodHits >= 3
    );
  }

  function hasRealWinEvidence(){
    const text = textOfPage();
    const bossHp = getBossHp();
    const score = getScore();
    const goodHits = getGoodHits();
    const timeLeft = getTimeLeft();

    const bossDeadByHp =
      bossHp !== null && bossHp <= 0;

    const bossDeadByText =
      text.includes('Boss Defeated') ||
      text.includes('บอสแพ้แล้ว') ||
      text.includes('ชนะบอสแล้ว') ||
      text.includes('ชนะบอสแบบสุดยอด');

    const enoughPlay =
      goodHits >= 3 ||
      score >= 80 ||
      timeLeft <= 0 ||
      !!window.GJ_FORCE_ALLOW_SUMMARY ||
      !!window.GJ_BOSS_DEFEATED_REAL;

    return (
      hasRealPlayEvidence() &&
      enoughPlay &&
      (
        bossDeadByHp ||
        bossDeadByText ||
        window.GJ_BOSS_DEFEATED_REAL === true ||
        window.__GJ_BOSS_DEFEATED_REAL === true
      )
    );
  }

  function looksLikeSummaryNode(node){
    if(!node || node.nodeType !== 1) return false;

    const text = String(node.innerText || node.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();

    const id = String(node.id || '').toLowerCase();
    const cls = String(node.className || '').toLowerCase();

    return (
      id.includes('summary') ||
      id.includes('reward') ||
      cls.includes('summary') ||
      cls.includes('reward') ||
      text.includes('ชนะบอสแบบสุดยอด') ||
      text.includes('ชนะบอสแล้ว') ||
      text.includes('Cooldown แล้วกลับเลือกโหมด') ||
      text.includes('เล่นอีกครั้ง')
    );
  }

  function blockBadSummary(node, reason){
    if(!node || node.dataset.gjSummaryGuardBlocked === '1') return;

    node.dataset.gjSummaryGuardBlocked = '1';
    node.dataset.gjSummaryGuardReason = reason || 'blocked-early-summary';

    node.style.setProperty('display', 'none', 'important');
    node.style.setProperty('visibility', 'hidden', 'important');
    node.style.setProperty('opacity', '0', 'important');
    node.style.setProperty('pointer-events', 'none', 'important');

    try{
      console.warn('[GoodJunk Summary Guard V849N] blocked early summary', {
        patch: PATCH,
        reason: reason || '',
        score: getScore(),
        combo: getCombo(),
        goodHits: getGoodHits(),
        bossHp: getBossHp(),
        elapsed: Date.now() - startedAt
      });
    }catch(_){}
  }

  function restoreIfLegit(node){
    if(!node || node.dataset.gjSummaryGuardBlocked !== '1') return;
    if(!hasRealWinEvidence()) return;

    node.dataset.gjSummaryGuardBlocked = '0';
    node.style.removeProperty('display');
    node.style.removeProperty('visibility');
    node.style.removeProperty('opacity');
    node.style.removeProperty('pointer-events');

    console.info('[GoodJunk Summary Guard V849N] allowed real summary', {
      patch: PATCH,
      score: getScore(),
      combo: getCombo(),
      goodHits: getGoodHits(),
      bossHp: getBossHp()
    });
  }

  function scan(){
    const nodes = Array.from(document.querySelectorAll(
      '[id*="summary" i], [class*="summary" i], [id*="reward" i], [class*="reward" i], .gjr-root, .gjr-modal, .gjr-card'
    ));

    for(const node of nodes){
      if(!looksLikeSummaryNode(node)) continue;

      if(hasRealWinEvidence()){
        restoreIfLegit(node);
      }else{
        blockBadSummary(node, 'scan-not-real-win');
      }
    }
  }

  const observer = new MutationObserver(function(list){
    for(const m of list){
      if(m.addedNodes && m.addedNodes.length){
        Array.from(m.addedNodes).forEach(function(node){
          if(looksLikeSummaryNode(node) && !hasRealWinEvidence()){
            blockBadSummary(node, 'mutation-not-real-win');
          }
        });
      }
    }

    scan();
  });

  function markRealPlay(){
    window.GJ_REAL_PLAY_STARTED = true;
    window.GJ_HAS_REAL_PLAY = true;

    try{
      document.body.classList.add('gj-real-play');
      document.documentElement.classList.add('gj-real-play');
    }catch(_){}
  }

  document.addEventListener('pointerdown', function(ev){
    const target = ev.target && ev.target.closest
      ? ev.target.closest('.gjpu-item, [data-food], [data-kind], [data-type], .food, .target, .gjm-area')
      : null;

    if(target){
      markRealPlay();
    }
  }, true);

  document.addEventListener('click', function(ev){
    const target = ev.target && ev.target.closest
      ? ev.target.closest('.gjpu-item, [data-food], [data-kind], [data-type], .food, .target, .gjm-area')
      : null;

    if(target){
      markRealPlay();
    }
  }, true);

  window.addEventListener('gj:hit', markRealPlay, true);
  window.addEventListener('gj:food-hit', markRealPlay, true);
  window.addEventListener('gj:good-hit', markRealPlay, true);
  window.addEventListener('gj:real-play', markRealPlay, true);

  window.addEventListener('gj:boss-defeated', function(){
    window.GJ_BOSS_DEFEATED_REAL = true;
    window.__GJ_BOSS_DEFEATED_REAL = true;
    setTimeout(scan, 80);
    setTimeout(scan, 350);
  }, true);

  window.addEventListener('gj:reward-summary-shown', function(){
    setTimeout(scan, 20);
    setTimeout(scan, 120);
  }, true);

  function boot(){
    try{
      observer.observe(document.documentElement, {
        childList:true,
        subtree:true
      });
    }catch(_){}

    scan();
    setTimeout(scan, 150);
    setTimeout(scan, 600);
    setTimeout(scan, 1500);
    setInterval(scan, 900);

    console.info('[GoodJunk Summary Guard V849N] installed');
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
