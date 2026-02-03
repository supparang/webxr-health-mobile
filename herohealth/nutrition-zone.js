// === /herohealth/nutrition-zone.js ===
// Nutrition Zone Summary + Cross-game badges (SAFE)
// Requires: /herohealth/badges.safe.js

'use strict';

import { getPid, awardBadge, hasBadge, listBadges } from './badges.safe.js';

const ZONE_KEY = 'nutrition';

// Games in Nutrition zone
const NUTRITION_GAMES = ['goodjunk','groups','plate','hydration'];

// Per-game "milestone" badges used for zone completion
const MILESTONES = {
  goodjunk:   ['mini_clear_1','score_80p'],
  groups:     ['streak_10','score_80p'],
  plate:      ['mini_clear_1','score_80p'],
  hydration:  ['score_80p','mini_clear_1'],
};

function uniq(arr){ return Array.from(new Set(arr)); }

function countIf(arr, fn){
  let c=0;
  for(const x of arr) if(fn(x)) c++;
  return c;
}

function getScope(){
  // listBadges() auto chooses pid scope if pid exists else global
  const pid = getPid();
  return pid ? 'pid' : 'global';
}

function getBadgeSet(){
  // Returns: { [gameKey]: Set(badgeId) }
  const scope = getScope();
  const items = listBadges({ scope });
  const map = {};
  for(const it of items){
    const g = it.game;
    if(!map[g]) map[g] = new Set();
    map[g].add(it.id);
  }
  return map;
}

function hasAny(map, game, ids){
  const s = map[game];
  if(!s) return false;
  for(const id of ids) if(s.has(id)) return true;
  return false;
}

function hasOne(map, game, id){
  const s = map[game];
  return !!(s && s.has(id));
}

function calcProgress(map){
  // Per-game status
  const perGame = {};
  for(const g of NUTRITION_GAMES){
    const played = hasOne(map, g, 'first_play') || (map[g] && map[g].size>0);
    const score80 = hasOne(map, g, 'score_80p');
    const perfect = hasOne(map, g, 'perfect_run');
    const milestone = hasAny(map, g, MILESTONES[g] || []);
    perGame[g] = { played, score80, perfect, milestone };
  }

  const playedCount = countIf(NUTRITION_GAMES, g => perGame[g].played);
  const milestoneCount = countIf(NUTRITION_GAMES, g => perGame[g].milestone);
  const score80Count = countIf(NUTRITION_GAMES, g => perGame[g].score80);
  const perfectCount = countIf(NUTRITION_GAMES, g => perGame[g].perfect);

  const zoneBadges = {
    nutrition_starter: playedCount >= 2,
    nutrition_day_complete: milestoneCount >= 4,
    nutrition_master: score80Count >= 4,
    nutrition_perfect_pair: perfectCount >= 2,
    nutrition_hydrate_plate_combo: (perGame.plate.score80 && perGame.hydration.score80),
  };

  // optional super badge: all zone badges (1-5)
  zoneBadges.nutrition_all_badges_earned =
    zoneBadges.nutrition_starter &&
    zoneBadges.nutrition_day_complete &&
    zoneBadges.nutrition_master &&
    zoneBadges.nutrition_perfect_pair &&
    zoneBadges.nutrition_hydrate_plate_combo;

  const pct = Math.round((milestoneCount / 4) * 100);

  return {
    perGame,
    playedCount,
    milestoneCount,
    score80Count,
    perfectCount,
    pct,
    zoneBadges
  };
}

function awardZoneBadges(progress){
  // award via badges.safe.js with ZONE_KEY as gameKey
  // IMPORTANT: awardBadge is already no-override
  const metaBase = {
    scope: getScope(),
    pid: getPid() || '',
    playedCount: progress.playedCount,
    milestoneCount: progress.milestoneCount,
    score80Count: progress.score80Count,
    perfectCount: progress.perfectCount,
  };

  for(const [badgeId, ok] of Object.entries(progress.zoneBadges)){
    if(!ok) continue;
    awardBadge(ZONE_KEY, badgeId, metaBase);
  }
}

function prettyGameName(g){
  const m = {
    goodjunk:'GoodJunk',
    groups:'Food Groups',
    plate:'Balanced Plate',
    hydration:'Hydration'
  };
  return m[g] || g;
}

function makeBar(pct){
  const p = Math.max(0, Math.min(100, Number(pct)||0));
  return `
    <div style="border:1px solid rgba(148,163,184,.18);background:rgba(2,6,23,.30);border-radius:999px;padding:6px;">
      <div style="height:10px;border-radius:999px;background:rgba(34,197,94,.85);width:${p}%;"></div>
    </div>
  `;
}

function ensureCard(){
  let el = document.getElementById('hhNutritionZone');
  if(el) return el;

  el = document.createElement('section');
  el.id = 'hhNutritionZone';
  el.style.border='1px solid rgba(148,163,184,.18)';
  el.style.borderRadius='18px';
  el.style.padding='14px';
  el.style.background='rgba(2,6,23,.34)';
  el.style.backdropFilter='blur(10px)';
  el.style.webkitBackdropFilter='blur(10px)';
  el.style.boxShadow='0 12px 40px rgba(0,0,0,.22)';
  el.style.color='rgba(229,231,235,.95)';
  el.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;">
      <div>
        <div style="font-weight:950;font-size:15px;">🥗 Nutrition Zone</div>
        <div id="hhNzSub" style="margin-top:4px;color:rgba(148,163,184,1);font-size:12px;">—</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
        <button id="hhNzRefresh" style="border:1px solid rgba(148,163,184,.22);background:rgba(2,6,23,.35);color:rgba(229,231,235,.95);border-radius:14px;padding:8px 10px;font-weight:950;cursor:pointer;">Refresh</button>
      </div>
    </div>

    <div style="height:10px"></div>
    <div id="hhNzBar"></div>

    <div style="height:10px"></div>
    <div id="hhNzGrid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;"></div>

    <div style="height:10px"></div>
    <div id="hhNzZoneBadges"></div>

    <div style="margin-top:10px;color:rgba(148,163,184,1);font-size:12px;line-height:1.45;">
      เป้าหมายโซน: ทำ milestone ให้ครบ 4 เกม (goodjunk, groups, plate, hydration)
    </div>
  `;
  return el;
}

function renderInto(el){
  const pid = getPid();
  const scope = getScope();

  const map = getBadgeSet();
  const prog = calcProgress(map);

  // auto-award zone badges
  awardZoneBadges(prog);

  const sub = el.querySelector('#hhNzSub');
  const bar = el.querySelector('#hhNzBar');
  const grid = el.querySelector('#hhNzGrid');
  const zb = el.querySelector('#hhNzZoneBadges');

  if(sub){
    sub.textContent = pid
      ? `scope: pid=${pid} • progress=${prog.pct}% • milestones=${prog.milestoneCount}/4`
      : `scope: global • progress=${prog.pct}% • milestones=${prog.milestoneCount}/4 (แนะนำใส่ pid สำหรับงานวิจัย)`;
  }

  if(bar) bar.innerHTML = makeBar(prog.pct);

  if(grid){
    grid.innerHTML = '';
    for(const g of NUTRITION_GAMES){
      const s = prog.perGame[g];
      const card = document.createElement('div');
      card.style.border='1px solid rgba(148,163,184,.16)';
      card.style.borderRadius='16px';
      card.style.padding='10px';
      card.style.background='rgba(2,6,23,.28)';

      const badges = [];
      badges.push(s.played ? '✅ played' : '⬜ played');
      badges.push(s.milestone ? '✅ milestone' : '⬜ milestone');
      badges.push(s.score80 ? '⭐ 80%' : '— 80%');
      badges.push(s.perfect ? '🏅 perfect' : '— perfect');

      card.innerHTML = `
        <div style="font-weight:950">${prettyGameName(g)}</div>
        <div style="margin-top:6px;color:rgba(148,163,184,1);font-size:12px;line-height:1.45;">
          ${badges.join(' • ')}
        </div>
      `;
      grid.appendChild(card);
    }
  }

  if(zb){
    // show zone badges state from current badge store too (double-check)
    // We read zone badges from store: hasBadge('nutrition', badgeId)
    const zoneIds = [
      'nutrition_starter',
      'nutrition_day_complete',
      'nutrition_master',
      'nutrition_perfect_pair',
      'nutrition_hydrate_plate_combo',
      'nutrition_all_badges_earned'
    ];

    const rows = zoneIds.map(id=>{
      const got = hasBadge(ZONE_KEY, id);
      return `
        <div style="border:1px solid rgba(148,163,184,.16);border-radius:14px;padding:8px 10px;background:rgba(2,6,23,.22);display:flex;justify-content:space-between;gap:10px;">
          <span style="font-weight:950">${got ? '🎖' : '⬜'} ${id}</span>
          <span style="color:rgba(148,163,184,1);font-size:12px;">${got ? 'earned' : 'locked'}</span>
        </div>
      `;
    }).join('');

    zb.innerHTML = `
      <div style="font-weight:950;margin-bottom:8px;">🏆 Zone Badges</div>
      <div style="display:grid;grid-template-columns:1fr;gap:8px;">${rows}</div>
    `;
  }

  // wire refresh
  el.querySelector('#hhNzRefresh')?.addEventListener('click', ()=>{
    renderInto(el);
  });

  // also rerender on badge events
  window.addEventListener('hha:badge', ()=>renderInto(el), { passive:true });
}

export function mountNutritionZoneSummary(selector){
  const host = document.querySelector(selector) || document.body;
  const card = ensureCard();
  host.appendChild(card);
  renderInto(card);
}