// === /herohealth/vr-clean/clean.ui.js ===
// Clean Objects UI — MOBILE-FIRST / FUN / BOSS-READABLE
// PATCH v20260315-CLEAN-UI-MOBILE-FUN-r1

'use strict';

function el(tag, cls, html){
  const n = document.createElement(tag);
  if(cls) n.className = cls;
  if(html !== undefined) n.innerHTML = html;
  return n;
}
function clamp(v,a,b){
  v = Number(v);
  if(!Number.isFinite(v)) v = a;
  return Math.max(a, Math.min(b, v));
}
function fmt(v){
  v = Number(v) || 0;
  return String(Math.round(v));
}
function escapeHtml(s){
  s = String(s ?? '');
  return s.replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
}
function qs(k, d=''){
  try{ return (new URL(location.href)).searchParams.get(k) ?? d; }
  catch(e){ return d; }
}
function normalizeView(v){
  v = String(v||'').toLowerCase();
  if(v==='cvr' || v==='cardboard' || v==='vr') return 'cvr';
  if(v==='mobile' || v==='m') return 'mobile';
  if(v==='pc' || v==='desktop') return 'pc';
  return v || '';
}
function isMobileLike(){
  const v = normalizeView(qs('view',''));
  if(v === 'mobile') return true;
  if(v === 'pc') return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
function reasonChipHTML(){
  const chips = [
    ['risk_high','เสี่ยงสูง'],
    ['touch_high','สัมผัสบ่อย'],
    ['traffic_high','คนผ่านบ่อย'],
    ['old_clean','ไม่ได้ทำความสะอาดนาน'],
    ['shared_use','ใช้ร่วมกัน'],
  ];
  return chips.map(([tag,lab]) =>
    `<button class="chip" data-tag="${tag}" type="button">${lab}</button>`
  ).join('');
}
function barsHTML(bd){
  if(!bd) return '';
  const bar = (label, v)=>`
    <div class="barRow">
      <div class="barLab">${label}</div>
      <div class="barTrack"><div class="barFill" style="width:${clamp(v,0,100)}%"></div></div>
      <div class="barVal">${fmt(v)}%</div>
    </div>`;
  return `
    <div class="bars">
      ${bar('Coverage', bd.coverageB)}
      ${bar('Balance',  bd.balanceScore)}
      ${bar('Remain',   bd.remainScore)}
    </div>
  `;
}

function shortThaiLabel(h){
  const id = String(h.id || '').toLowerCase();
  const name = String(h.name || '').toLowerCase();
  const zone = String(h.zone || '').toLowerCase();
  const surface = String(h.surfaceType || '').toLowerCase();

  if(id.includes('door') || name.includes('door') || name.includes('ลูกบิด')) return 'ลูกบิด';
  if(id.includes('switch') || name.includes('switch') || name.includes('สวิตช์')) return 'สวิตช์';
  if(id.includes('faucet') || name.includes('faucet') || name.includes('ก๊อก')) return 'ก๊อกน้ำ';
  if(id.includes('toilet') || name.includes('toilet') || name.includes('ชักโครก')) return 'ชักโครก';
  if(id.includes('remote') || name.includes('remote') || name.includes('รีโมท')) return 'รีโมท';
  if(id.includes('tablet') || name.includes('tablet')) return 'แท็บเล็ต';
  if(id.includes('mouse') || name.includes('mouse')) return 'เมาส์';
  if(id.includes('desk') || id.includes('table') || name.includes('โต๊ะ')) return 'โต๊ะ';
  if(id.includes('fridge') || name.includes('fridge')) return 'ตู้เย็น';
  if(id.includes('sink') || name.includes('sink')) return 'อ่างล้าง';
  if(id.includes('flush')) return 'ที่กดชักโครก';

  if(zone.includes('wet')) return 'จุดเปียก';
  if(zone.includes('shared')) return 'ของใช้ร่วม';
  if(zone.includes('entry')) return 'ทางเข้า';

  if(surface.includes('glass')) return 'แก้ว';
  if(surface.includes('metal')) return 'โลหะ';
  if(surface.includes('plastic')) return 'พลาสติก';

  return 'จุดเสี่ยง';
}

function hotspotIcon(h){
  const id = String(h.id || '').toLowerCase();
  const zone = String(h.zone || '').toLowerCase();
  const surface = String(h.surfaceType || '').toLowerCase();

  if(id.includes('door')) return '🚪';
  if(id.includes('switch')) return '💡';
  if(id.includes('faucet')) return '🚰';
  if(id.includes('toilet')) return '🚽';
  if(id.includes('remote')) return '📺';
  if(id.includes('tablet')) return '📱';
  if(id.includes('mouse')) return '🖱️';
  if(id.includes('desk') || id.includes('table')) return '🪑';
  if(id.includes('fridge')) return '🧊';
  if(id.includes('sink')) return '🫧';
  if(id.includes('flush')) return '🚽';

  if(zone.includes('shared')) return '🤝';
  if(zone.includes('wet')) return '💧';
  if(zone.includes('entry')) return '🚪';

  if(surface.includes('glass')) return '🪟';
  if(surface.includes('metal')) return '🔩';
  if(surface.includes('plastic')) return '🧴';

  return '🧽';
}

function riskStateLabel(r){
  r = Number(r)||0;
  if(r >= 85) return 'อันตราย';
  if(r >= 70) return 'รีบเก็บ';
  if(r >= 55) return 'เสี่ยง';
  return 'เฝ้าระวัง';
}
function markerClassForRisk(r){
  r = Number(r)||0;
  if(r >= 85) return 'critical';
  if(r >= 70) return 'hot';
  if(r >= 55) return 'warn';
  return 'safe';
}
function starText(score){
  score = Number(score||0);
  if(score >= 420) return '⭐⭐⭐';
  if(score >= 280) return '⭐⭐';
  return '⭐';
}
function summaryAdviceA(bd, comboBest, bossPenalty){
  const tips = [];
  if(Number(bd?.dq||0) < 60) tips.push('เลือกลูกบิด ก๊อกน้ำ และของใช้ร่วมก่อน');
  if(Number(bd?.coverage||0) < 60) tips.push('ใช้ Sprays ให้ครบ อย่าจบเร็วเกินไป');
  if(Number(comboBest||0) < 2) tips.push('ถ้าเลือกจุดคุ้มต่อเนื่อง จะได้คอมโบ');
  if(Number(bossPenalty||0) > 0) tips.push('เห็นบอสแล้วรีบเก็บเป้าบอสก่อน');
  if(Number(bd?.spreadPenalty||0) > 0) tips.push('อย่าปล่อยจุดแดงค้าง เพราะเชื้อจะลาม');
  if(!tips.length) tips.push('ทำได้ดีมาก รอบหน้าลองเคลียร์บอสให้ไวขึ้น');
  return tips.slice(0,3);
}
function summaryAdviceB(bd){
  const tips = [];
  if(Number(bd?.coverageB||0) < 60) tips.push('เพิ่มจุดสัมผัสสูงเพื่อดัน Coverage');
  if(Number(bd?.balanceScore||0) < 55) tips.push('กระจาย route หลายโซนขึ้น');
  if(Number(bd?.remainScore||0) < 60) tips.push('ยังพลาดจุดคุ้มหลายจุด ลองเริ่มจากของใช้ร่วม');
  if(Number(bd?.bossPenalty||0) > 0) tips.push('ใส่บอสไว้ใน route ด้วย');
  if(!tips.length) tips.push('route ดีแล้ว ลองทำให้สั้นและคุ้มขึ้นอีก');
  return tips.slice(0,3);
}
function placeWithoutOverlap(items, boxW, boxH){
  const placed = [];
  const out = [];
  function intersects(a,b){
    return !(a.x + a.w <= b.x || a.x >= b.x + b.w || a.y + a.h <= b.y || a.y >= b.y + b.h);
  }
  for(const it of items){
    let x = it.cx - boxW/2;
    let y = it.cy - boxH/2;
    const tries = [
      [0,0],[0,-18],[0,18],[-18,0],[18,0],
      [-24,-18],[24,-18],[-24,18],[24,18],
      [0,-30],[0,30],[-36,0],[36,0],
      [-44,-20],[44,-20],[-44,20],[44,20]
    ];
    let placedBox = null;
    for(const [dx,dy] of tries){
      const cand = { x:x+dx, y:y+dy, w:boxW, h:boxH };
      const hit = placed.some(p=>intersects(cand,p));
      if(!hit){ placedBox = cand; break; }
    }
    if(!placedBox) placedBox = { x, y, w:boxW, h:boxH };
    placed.push(placedBox);
    out.push({ id: it.id, h: it.h, x: placedBox.x, y: placedBox.y, cx: it.cx, cy: it.cy });
  }
  return out;
}
function addLeaderLine(layer, x1, y1, x2, y2, cls=''){
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx*dx + dy*dy);
  if(len < 10) return null;
  const ang = Math.atan2(dy, dx) * 180 / Math.PI;
  const line = el('div',`mk-line ${cls}`.trim());
  line.style.left = `${x1}px`;
  line.style.top = `${y1}px`;
  line.style.width = `${len}px`;
  line.style.transform = `rotate(${ang}deg)`;
  layer.appendChild(line);
  return line;
}
function popScore(layer, x, y, text, cls=''){
  const n = el('div',`fx-pop ${cls}`.trim());
  n.textContent = text;
  n.style.left = `${x}px`;
  n.style.top  = `${y}px`;
  layer.appendChild(n);
  setTimeout(()=> n.remove(), 850);
}
function bossVerdictText(boss){
  if(!boss) return '—';
  if(boss.cleared) return '✅ เคลียร์บอส';
  if(boss.failed) return '❌ ไม่ทันบอส';
  return `${fmt(boss.progress)}/${fmt(boss.total)}`;
}

export function mountCleanUI(root, opts){
  opts = opts || {};
  root.innerHTML = '';

  const MOBILE = isMobileLike();
  const MARKER_W = MOBILE ? 102 : 92;
  const MARKER_H = MOBILE ? 82 : 74;

  const app = el('div','cleanApp');
  root.appendChild(app);

  const hud = el('div','hud');
  hud.innerHTML = `
    <div class="hudRow">
      <div class="pill" id="pillMode">MODE: —</div>
      <div class="pill" id="pillTime">TIME: 0</div>
      <div class="pill" id="pillBudget">BUDGET: —</div>
      <div class="pill" id="pillGoal">GOAL: —</div>
      <div class="pill dangerMini" id="pillSpread">SPREAD: 0</div>
      <div class="pill bossMini" id="pillBoss">BOSS: 0/0</div>
    </div>

    <div class="starRow" id="starRow">
      <div class="starTitle">Progress</div>
      <div class="stars">
        <span class="star" id="star1">☆</span>
        <span class="star" id="star2">☆</span>
        <span class="star" id="star3">☆</span>
      </div>
      <div class="starNote" id="starNote">เริ่มภารกิจ</div>
    </div>

    <div class="alertBar" id="alertBar" style="display:none;">
      <div class="alertTitle" id="alertTitle">ALERT</div>
      <div class="alertText" id="alertText">—</div>
    </div>
  `;
  app.appendChild(hud);

  const board = el('div','board');
  const grid = el('div','grid');
  board.appendChild(grid);

  const heatLayer = el('div','heatLayer');
  const markerLayer = el('div','markerLayer');
  grid.appendChild(heatLayer);
  grid.appendChild(markerLayer);

  const overlay = el('div','overlay');
  overlay.innerHTML = `
    <div class="ovHint" id="ovHint">
      <div class="ovT">Clean Objects</div>
      <div id="missionLine" class="missionLine">🎯 เลือกจุดเสี่ยงที่สุดก่อน</div>
      <div class="ovS" id="ovS">
        แตะการ์ดบนแผนที่เพื่อเล่น
      </div>
    </div>
  `;
  board.appendChild(overlay);
  app.appendChild(board);

  const info = el('div','info');
  info.innerHTML = `
    <div class="sideTitle">ภารกิจ</div>
    <div id="missionText" class="missionText"></div>

    <div class="sideTitle" id="reasonTitle">เหตุผล (Evaluate)</div>
    <div id="reasonBox" class="reasonBox"></div>
    <div id="reasonNote" class="reasonNote"></div>

    <div id="helpBox" class="helpBox"></div>
  `;
  app.appendChild(info);

  const routePanel = el('div','routePanel');
  routePanel.innerHTML = `
    <div class="routeHead">
      <div>
        <div class="sideTitle">Route / รายการ</div>
        <div id="rpSub" class="routeSub">—</div>
      </div>
      <div class="routeBtns">
        <button class="btn" id="btnUndo" type="button">Undo</button>
        <button class="btn" id="btnClear" type="button">Clear</button>
        <button class="btn primary" id="btnSubmit" type="button">Submit</button>
      </div>
    </div>
    <div id="rpList" style="margin-top:10px"></div>
  `;
  app.appendChild(routePanel);

  const coachToast = el('div','coachToast mood-tip');
  coachToast.innerHTML = `
    <div class="coachAvatar" id="coachAvatar">🤖</div>
    <div class="coachBubble">
      <div class="coachName">AI Coach</div>
      <div class="ctInner" id="coachText">พร้อมช่วยอยู่ตรงนี้</div>
    </div>
  `;
  root.appendChild(coachToast);

  const summary = el('div','summary');
  summary.style.cssText = `
    position:fixed; inset:0; z-index:200; display:none;
    padding:14px; background:rgba(0,0,0,.55);
  `;
  summary.innerHTML = `
    <div class="sumModal">
      <div class="sumTitle">สรุปผล — Clean Objects</div>
      <div id="sumMeta" class="sumMeta"></div>
      <div id="sumBody" class="sumBody"></div>
      <div class="sumBtnRow">
        <button class="btn primary" id="btnCooldown" type="button">Go Cooldown</button>
        <button class="btn" id="btnBackHub" type="button">Back to HUB</button>
        <button class="btn" id="btnReplay" type="button">Replay</button>
      </div>
    </div>
  `;
  root.appendChild(summary);

  const style = el('style');
  style.textContent = `
    .cleanApp{
      display:grid;
      gap:12px;
    }

    .hud{
      display:grid;
      gap:10px;
    }
    .hudRow{
      display:flex;
      gap:8px;
      flex-wrap:wrap;
    }

    .pill{
      border:1px solid rgba(148,163,184,.20);
      background:rgba(2,6,23,.45);
      color:rgba(229,231,235,.95);
      padding:10px 12px;
      border-radius:14px;
      font-weight:1000;
      font-size:${MOBILE ? '13px' : '12px'};
    }
    .dangerMini{
      border-color:rgba(245,158,11,.28);
      background:rgba(245,158,11,.10);
    }
    .bossMini{
      border-color:rgba(167,139,250,.28);
      background:rgba(167,139,250,.10);
    }

    .btn{
      border:1px solid rgba(148,163,184,.20);
      background:rgba(2,6,23,.45);
      color:rgba(229,231,235,.95);
      padding:10px 12px;
      border-radius:14px;
      font-weight:1000;
      cursor:pointer;
    }
    .btn.primary{
      background:rgba(59,130,246,.28);
      border-color:rgba(59,130,246,.38);
    }

    .chip{
      border:1px solid rgba(148,163,184,.18);
      background:rgba(2,6,23,.38);
      color:rgba(229,231,235,.92);
      padding:${MOBILE ? '9px 12px' : '8px 10px'};
      border-radius:999px;
      font-weight:900;
      cursor:pointer;
      font-size:${MOBILE ? '13px' : '12px'};
    }
    .chip.sel{
      border-color:rgba(59,130,246,.55);
      background:rgba(59,130,246,.18);
    }

    .alertBar{
      display:grid;
      gap:4px;
      padding:10px 12px;
      border-radius:14px;
      border:1px solid rgba(245,158,11,.28);
      background:rgba(245,158,11,.10);
    }
    .alertBar.crisis{
      border-color:rgba(239,68,68,.34);
      background:rgba(239,68,68,.12);
    }
    .alertBar.reward{
      border-color:rgba(34,197,94,.34);
      background:rgba(34,197,94,.12);
    }
    .alertTitle{
      font-size:12px;
      font-weight:1100;
    }
    .alertText{
      font-size:${MOBILE ? '13px' : '12px'};
      font-weight:900;
      opacity:.92;
      line-height:1.35;
    }

    .board{
      position:relative;
      min-height:${MOBILE ? '620px' : '640px'};
      border-radius:22px;
      border:1px solid rgba(148,163,184,.18);
      background:
        radial-gradient(900px 500px at 50% -20%, rgba(59,130,246,.10), transparent 60%),
        rgba(2,6,23,.55);
      box-shadow:0 18px 55px rgba(0,0,0,.28);
      overflow:hidden;
    }
    .grid{
      position:relative;
      min-height:${MOBILE ? '620px' : '640px'};
    }
    .heatLayer{
      position:absolute;
      inset:0;
      pointer-events:none;
    }
    .markerLayer{
      position:absolute;
      inset:0;
    }
    .overlay{
      position:absolute;
      inset:0;
      pointer-events:none;
    }

    .ovHint{
      margin:10px;
      max-width:${MOBILE ? 'calc(100% - 20px)' : '520px'};
      border-radius:16px;
      border:1px solid rgba(148,163,184,.18);
      background:rgba(2,6,23,.48);
      padding:10px 12px;
      box-shadow:0 14px 44px rgba(0,0,0,.25);
    }
    .ovT{
      font-weight:1000;
      font-size:${MOBILE ? '15px' : '14px'};
    }
    .missionLine{
      margin-top:6px;
      font-size:${MOBILE ? '13px' : '12px'};
      font-weight:950;
      line-height:1.35;
      color:rgba(229,231,235,.95);
      background:rgba(34,211,238,.08);
      border:1px solid rgba(34,211,238,.16);
      border-radius:12px;
      padding:8px 10px;
    }
    .ovS{
      font-size:${MOBILE ? '13px' : '12px'};
      opacity:.88;
      margin-top:6px;
      line-height:1.35;
    }

    .heat{
      position:absolute;
      border-radius:999px;
      filter:blur(12px);
      background:radial-gradient(circle, rgba(255,255,255,.40), transparent 70%);
    }
    .heat.cool{ background:radial-gradient(circle, rgba(34,197,94,.26), transparent 70%); }
    .heat.warm{ background:radial-gradient(circle, rgba(245,158,11,.26), transparent 70%); }
    .heat.hot{ background:radial-gradient(circle, rgba(239,68,68,.30), transparent 70%); }
    .heat.spread-hot{
      background:radial-gradient(circle, rgba(239,68,68,.42), transparent 70%);
      animation:spreadPulse .7s ease-in-out 4 alternate;
    }

    .mk{
      position:absolute;
      width:${MARKER_W}px;
      min-height:${MARKER_H}px;
      border-radius:16px;
      border:1px solid rgba(148,163,184,.25);
      background:rgba(2,6,23,.88);
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      gap:3px;
      padding:${MOBILE ? '8px 8px' : '7px 8px'};
      text-align:center;
      cursor:pointer;
      user-select:none;
      box-shadow:0 10px 30px rgba(0,0,0,.22);
      transform:translate(-50%, -50%);
    }

    .mk .mk-icon{
      font-size:${MOBILE ? '20px' : '18px'};
      line-height:1;
    }
    .mk .mk-name{
      font-size:${MOBILE ? '12px' : '11px'};
      font-weight:1000;
      line-height:1.1;
    }
    .mk .mk-risk{
      font-size:${MOBILE ? '11px' : '10px'};
      font-weight:1000;
      padding:2px 6px;
      border-radius:999px;
      background:rgba(255,255,255,.08);
    }
    .mk .mk-state{
      font-size:${MOBILE ? '11px' : '10px'};
      font-weight:1000;
      opacity:.86;
      line-height:1.05;
    }

    .mk.safe{
      border-color:rgba(34,197,94,.30);
    }
    .mk.warn{
      border-color:rgba(251,191,36,.62);
      box-shadow:0 0 0 6px rgba(251,191,36,.08), 0 10px 30px rgba(0,0,0,.22);
    }
    .mk.hot{
      border-color:rgba(239,68,68,.62);
      box-shadow:0 0 0 7px rgba(239,68,68,.10), 0 10px 30px rgba(0,0,0,.22);
    }
    .mk.critical{
      border-color:rgba(239,68,68,.85);
      box-shadow:0 0 0 10px rgba(239,68,68,.14), 0 10px 30px rgba(0,0,0,.24);
      animation:criticalPulse 0.8s ease-in-out infinite alternate;
    }
    .mk.on{
      border-color:rgba(34,197,94,.55);
      background:rgba(34,197,94,.13);
    }
    .mk.selected{
      transform:translate(-50%, -50%) scale(.96);
      opacity:.82;
    }
    .mk.boss{
      outline:2px solid rgba(245,158,11,.70);
      outline-offset:2px;
    }
    .mk.ai-hot{
      outline:3px solid rgba(34,211,238,.92);
      box-shadow:0 0 0 8px rgba(34,211,238,.16), 0 10px 30px rgba(0,0,0,.22);
    }
    .mk.boss-hot{
      outline:3px solid rgba(245,158,11,.95);
      box-shadow:0 0 0 10px rgba(245,158,11,.18), 0 10px 30px rgba(0,0,0,.22);
      animation:bossTargetPulse .8s ease-in-out infinite alternate;
    }
    .mk.quickpick{
      outline:3px solid rgba(34,211,238,.96);
      box-shadow:0 0 0 12px rgba(34,211,238,.18), 0 10px 30px rgba(0,0,0,.22);
    }
    .mk.spread-hit{
      animation:spreadHit .55s ease-out 1;
    }

    .mk-anchor{
      position:absolute;
      width:6px;
      height:6px;
      border-radius:999px;
      background:rgba(255,255,255,.45);
      pointer-events:none;
    }
    .mk-line{
      position:absolute;
      height:2px;
      background:rgba(148,163,184,.42);
      transform-origin:0 50%;
      pointer-events:none;
    }
    .mk-line.line-selected{
      background:rgba(34,197,94,.62);
    }
    .mk-line.line-boss{
      background:rgba(245,158,11,.82);
      height:3px;
    }
    .mk-line.line-ai{
      background:rgba(34,211,238,.78);
      height:3px;
    }
    .mk-line.line-spread{
      background:rgba(239,68,68,.80);
      height:3px;
    }

    .info,.routePanel{
      border-radius:18px;
      border:1px solid rgba(148,163,184,.16);
      background:rgba(15,23,42,.46);
      padding:12px;
      box-shadow:0 18px 55px rgba(0,0,0,.25);
    }
    .sideTitle{
      font-weight:1000;
      margin-bottom:6px;
      font-size:${MOBILE ? '14px' : '13px'};
    }
    .missionText,.reasonNote,.helpBox{
      opacity:.92;
      line-height:1.45;
      font-size:${MOBILE ? '13px' : '12px'};
    }
    .reasonBox{
      margin-top:8px;
      display:flex;
      gap:8px;
      flex-wrap:wrap;
    }

    .routeHead{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      flex-wrap:wrap;
    }
    .routeBtns{
      display:flex;
      gap:8px;
      flex-wrap:wrap;
    }
    .routeSub{
      opacity:.85;
      font-size:${MOBILE ? '13px' : '12px'};
      margin-top:2px;
    }

    .bars{
      margin-bottom:10px;
    }
    .barRow{
      display:grid;
      grid-template-columns:${MOBILE ? '68px 1fr 44px' : '72px 1fr 48px'};
      gap:8px;
      align-items:center;
      margin:8px 0;
    }
    .barLab,.barVal{
      font-size:${MOBILE ? '12px' : '12px'};
      font-weight:900;
      color:rgba(229,231,235,.92);
    }
    .barTrack{
      height:10px;
      border-radius:999px;
      background:rgba(255,255,255,.08);
      overflow:hidden;
    }
    .barFill{
      height:100%;
      background:linear-gradient(90deg, rgba(59,130,246,.75), rgba(34,197,94,.75));
      border-radius:999px;
    }

    .coachToast{
      position:fixed;
      right:14px;
      bottom:18px;
      z-index:180;
      display:flex;
      align-items:flex-end;
      gap:10px;
      max-width:min(440px, 92vw);
    }
    .coachAvatar{
      width:${MOBILE ? '48px' : '46px'};
      height:${MOBILE ? '48px' : '46px'};
      border-radius:16px;
      display:grid;
      place-items:center;
      font-size:${MOBILE ? '24px' : '22px'};
      font-weight:1000;
      border:1px solid rgba(148,163,184,.20);
      background:rgba(15,23,42,.88);
    }
    .coachBubble{
      border:1px solid rgba(148,163,184,.18);
      background:rgba(2,6,23,.86);
      border-radius:18px 18px 6px 18px;
      padding:10px 12px;
      min-width:180px;
    }
    .coachName{
      font-size:11px;
      font-weight:1000;
      opacity:.72;
      margin-bottom:4px;
    }
    .ctInner{
      font-size:${MOBILE ? '13px' : '13px'};
      font-weight:950;
      line-height:1.4;
    }
    .coachToast.mood-warn .coachBubble{
      border-color:rgba(245,158,11,.30);
      background:rgba(38,20,4,.88);
    }
    .coachToast.mood-boss .coachBubble{
      border-color:rgba(239,68,68,.32);
      background:rgba(40,10,10,.90);
    }
    .coachToast.mood-good .coachBubble{
      border-color:rgba(34,197,94,.28);
      background:rgba(8,30,16,.88);
    }

    .starRow{
      margin-top:10px;
      display:flex;
      align-items:center;
      gap:10px;
      flex-wrap:wrap;
      padding:8px 10px;
      border:1px solid rgba(148,163,184,.14);
      border-radius:14px;
      background:rgba(15,23,42,.38);
    }
    .starTitle{
      font-size:${MOBILE ? '13px' : '12px'};
      font-weight:1000;
    }
    .star{
      font-size:${MOBILE ? '22px' : '20px'};
      line-height:1;
      opacity:.55;
    }
    .star.on{
      opacity:1;
      transform:scale(1.08);
    }
    .starNote{
      font-size:${MOBILE ? '13px' : '12px'};
      font-weight:900;
      opacity:.9;
    }

    .fx-pop{
      position:absolute;
      transform:translate(-50%, -50%);
      font-size:${MOBILE ? '16px' : '14px'};
      font-weight:1000;
      color:#e5e7eb;
      pointer-events:none;
      animation:fxPopUp .85s ease-out forwards;
    }
    .fx-pop.reward{
      color:#bbf7d0;
      font-size:${MOBILE ? '18px' : '16px'};
    }

    .sumModal{
      max-width:860px;
      margin:0 auto;
      border:1px solid rgba(148,163,184,.18);
      background:rgba(2,6,23,.90);
      border-radius:22px;
      padding:14px;
      box-shadow:0 30px 90px rgba(0,0,0,.45);
    }
    .sumTitle{
      font-weight:1100;
      font-size:${MOBILE ? '20px' : '18px'};
    }
    .sumMeta{
      margin-top:6px;
      opacity:.9;
      font-size:${MOBILE ? '13px' : '12px'};
      line-height:1.45;
    }
    .sumBody{
      margin-top:10px;
      opacity:.96;
      font-size:${MOBILE ? '13px' : '13px'};
      line-height:1.55;
    }
    .sumStars{
      font-size:${MOBILE ? '24px' : '22px'};
      font-weight:1000;
      letter-spacing:2px;
      margin-top:8px;
    }
    .sumGrid{
      display:grid;
      grid-template-columns:repeat(2, minmax(0,1fr));
      gap:10px;
      margin-top:12px;
    }
    .sumBox{
      border:1px solid rgba(148,163,184,.16);
      background:rgba(15,23,42,.45);
      border-radius:16px;
      padding:10px;
    }
    .sumBoxTitle{
      font-size:${MOBILE ? '12px' : '12px'};
      font-weight:1000;
      opacity:.88;
      margin-bottom:6px;
    }
    .sumBoxVal{
      font-size:${MOBILE ? '18px' : '18px'};
      font-weight:1000;
    }
    .sumTips{
      margin-top:12px;
      border:1px solid rgba(148,163,184,.16);
      background:rgba(2,6,23,.38);
      border-radius:16px;
      padding:10px;
      font-size:${MOBILE ? '13px' : '13px'};
      line-height:1.55;
    }
    .sumBtnRow{
      display:flex;
      gap:10px;
      flex-wrap:wrap;
      margin-top:14px;
      justify-content:flex-end;
    }

    @keyframes fxPopUp{
      0%{ opacity:0; transform:translate(-50%, -50%) scale(.92); }
      15%{ opacity:1; transform:translate(-50%, -68%) scale(1.02); }
      100%{ opacity:0; transform:translate(-50%, -112%) scale(1); }
    }
    @keyframes spreadPulse{
      from{ transform:scale(1); opacity:.32; }
      to{ transform:scale(1.12); opacity:.48; }
    }
    @keyframes spreadHit{
      0%{ box-shadow:0 0 0 0 rgba(239,68,68,.45); }
      100%{ box-shadow:0 0 0 12px rgba(239,68,68,0); }
    }
    @keyframes bossTargetPulse{
      from{ transform:translate(-50%, -50%) scale(1); }
      to{ transform:translate(-50%, -50%) scale(1.06); }
    }
    @keyframes criticalPulse{
      from{ transform:translate(-50%, -50%) scale(1); }
      to{ transform:translate(-50%, -50%) scale(1.04); }
    }

    @media (max-width:640px){
      .coachToast{
        right:10px;
        left:10px;
        max-width:none;
      }
      .coachBubble{
        flex:1 1 auto;
      }
      .sumGrid{
        grid-template-columns:1fr;
      }
    }
  `;
  root.appendChild(style);

  let lastState = null;
  let lastPlanBreakdown = null;
  let selectedReasonTag = 'risk_high';
  let bossId = String(qs('boss','toilet_flush')||'toilet_flush');
  let aiTopIds = [];
  let bossTopIds = [];
  let spreadIds = [];
  let quickPickId = '';
  let lastStarCount = 0;
  let rewardFlashUntil = 0;

  const $ = (id)=> root.querySelector('#'+id);
  const pillMode = $('pillMode');
  const pillTime = $('pillTime');
  const pillBudget = $('pillBudget');
  const pillGoal = $('pillGoal');
  const pillSpread = $('pillSpread');
  const pillBoss = $('pillBoss');
  const alertBar = $('alertBar');
  const alertTitle = $('alertTitle');
  const alertText = $('alertText');
  const missionText = $('missionText');
  const reasonBox = $('reasonBox');
  const reasonNote = $('reasonNote');
  const helpBox = $('helpBox');
  const rpSub = $('rpSub');
  const rpList = $('rpList');
  const missionLine = $('missionLine');
  const ovS = $('ovS');
  const star1 = $('star1');
  const star2 = $('star2');
  const star3 = $('star3');
  const starNote = $('starNote');

  reasonBox.innerHTML = reasonChipHTML();
  reasonNote.textContent = 'เลือกเหตุผลก่อน แล้วแตะการ์ดเป้าหมาย';
  reasonBox.addEventListener('click', (e)=>{
    const b = e.target && e.target.closest('.chip');
    if(!b) return;
    selectedReasonTag = String(b.dataset.tag||'risk_high');
    for(const c of reasonBox.querySelectorAll('.chip')) c.classList.remove('sel');
    b.classList.add('sel');
  });
  const firstChip = reasonBox.querySelector('.chip');
  if(firstChip) firstChip.classList.add('sel');

  let toastTimer = null;
  function setCoachMood(kind){
    coachToast.classList.remove('mood-tip','mood-warn','mood-boss','mood-good');
    if(kind === 'warn') coachToast.classList.add('mood-warn');
    else if(kind === 'boss') coachToast.classList.add('mood-boss');
    else if(kind === 'good') coachToast.classList.add('mood-good');

    const av = root.querySelector('#coachAvatar');
    if(!av) return;
    av.textContent =
      kind === 'boss' ? '🔥' :
      kind === 'warn' ? '⚠️' :
      kind === 'good' ? '😄' : '🤖';
  }
  function showCoach(text, kind='tip'){
    const t = root.querySelector('#coachText');
    if(t) t.textContent = text;
    setCoachMood(kind);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=>{
      setCoachMood('tip');
      if(t) t.textContent = 'พร้อมช่วยอยู่ตรงนี้';
    }, 2600);
  }

  function renderHeat(S){
    heatLayer.innerHTML = '';
    const hs = S.hotspots || [];
    const w = (S.map && S.map.w) ? S.map.w : 10;
    const hN = (S.map && S.map.h) ? S.map.h : 10;
    const spreadSet = new Set(spreadIds || []);

    for(const h of hs){
      const r = clamp(h.risk,0,100);
      const size = (MOBILE ? 30 : 24) + (r/100)*(MOBILE ? 64 : 58);
      const alpha = 0.10 + (r/100)*0.30;
      const hueClass = spreadSet.has(String(h.id))
        ? 'spread-hot'
        : ((r>=75) ? 'hot' : (r>=55 ? 'warm' : 'cool'));

      const n = el('div', `heat ${hueClass}`);
      n.style.left = `calc(${(Number(h.x)+0.5)/w*100}% - ${size/2}px)`;
      n.style.top  = `calc(${(Number(h.y)+0.5)/hN*100}% - ${size/2}px)`;
      n.style.width = `${size}px`;
      n.style.height = `${size}px`;
      n.style.opacity = String(alpha);
      heatLayer.appendChild(n);
    }
  }

  function renderMarkers(S){
    markerLayer.innerHTML = '';
    const hs = S.hotspots || [];
    const w = (S.map && S.map.w) ? S.map.w : 10;
    const hN = (S.map && S.map.h) ? S.map.h : 10;

    const spreadSet = new Set(spreadIds || []);
    const chosenA = new Set((S.A?.selected||[]).map(x=>x.id));
    const chosenB = new Set((S.B?.routeIds||[]));

    const layerRect = markerLayer.getBoundingClientRect();
    if(!layerRect.width || !layerRect.height) return;

    const items = hs.map(h=>{
      const xPct = (Number(h.x)+0.5)/w;
      const yPct = (Number(h.y)+0.5)/hN;
      return {
        id: String(h.id),
        h,
        cx: xPct * layerRect.width,
        cy: yPct * layerRect.height
      };
    });

    items.sort((a,b)=> Number(b.h?.risk||0) - Number(a.h?.risk||0));
    const placed = placeWithoutOverlap(items, MARKER_W, MARKER_H);

    for(const p of placed){
      const h = p.h;
      const id = String(h.id);
      const picked = (S.mode==='A') ? chosenA.has(id) : chosenB.has(id);

      const mk = el('div', `mk ${markerClassForRisk(h.risk)}`);
      mk.dataset.id = id;
      mk.style.left = `${p.x + MARKER_W/2}px`;
      mk.style.top  = `${p.y + MARKER_H/2}px`;

      if(picked) mk.classList.add('on','selected');
      if(id === bossId) mk.classList.add('boss');
      if(aiTopIds.includes(id)) mk.classList.add('ai-hot');
      if(bossTopIds.includes(id)) mk.classList.add('boss-hot');
      if(quickPickId && quickPickId === id) mk.classList.add('quickpick');
      if(spreadSet.has(id)) mk.classList.add('spread-hit');

      const label = shortThaiLabel(h);
      const icon = hotspotIcon(h);
      const risk = Math.round(Number(h.risk || 0));
      const stateLabel = riskStateLabel(risk);

      mk.innerHTML = `
        <div class="mk-icon">${icon}</div>
        <div class="mk-name">${escapeHtml(label)}</div>
        <div class="mk-risk">${risk}%</div>
        <div class="mk-state">${escapeHtml(stateLabel)}</div>
      `;

      mk.addEventListener('click', ()=>{
        if(!lastState || lastState.ended) return;
        const reward = lastState.mode === 'A'
          ? `+${Math.max(8, Math.round(risk * 0.35))}`
          : '+route';
        popScore(markerLayer, p.x + MARKER_W/2, p.y + 18, reward);

        if(lastState.mode === 'A'){
          opts.selectA && opts.selectA(id, selectedReasonTag);
        }else{
          opts.toggleRouteB && opts.toggleRouteB(id);
        }
      });

      let lineCls = '';
      if(picked) lineCls = 'line-selected';
      else if(id === bossId || bossTopIds.includes(id)) lineCls = 'line-boss';
      else if(aiTopIds.includes(id)) lineCls = 'line-ai';
      if(spreadSet.has(id)) lineCls = (lineCls + ' line-spread').trim();

      addLeaderLine(
        markerLayer,
        p.x + MARKER_W/2,
        p.y + MARKER_H/2,
        p.cx,
        p.cy,
        lineCls
      );

      const dot = el('div','mk-anchor');
      dot.style.left = `${p.cx - 3}px`;
      dot.style.top  = `${p.cy - 3}px`;
      markerLayer.appendChild(dot);
      markerLayer.appendChild(mk);
    }
  }

  function renderRoutePanel(S){
    if(S.mode === 'A'){
      routePanel.style.display = 'none';
      return;
    }
    routePanel.style.display = '';
    const ids = (S.B && S.B.routeIds) ? S.B.routeIds : [];
    rpSub.textContent = `Route ${fmt(ids.length)} / ${fmt(S.B?.maxPoints||5)}`;

    const hs = S.hotspots || [];
    const list = ids.length
      ? ids.map((id, i)=>{
          const h = hs.find(x=>String(x.id)===String(id));
          const t = h
            ? `${hotspotIcon(h)} ${escapeHtml(shortThaiLabel(h))} <span style="opacity:.75">(risk ${fmt(h.risk)}%)</span>`
            : escapeHtml(id);
          return `<div style="padding:8px 0;border-top:1px solid rgba(148,163,184,.10)"><b>${i+1}.</b> ${t}</div>`;
        }).join('')
      : `<div style="opacity:.85">ยังไม่มี route — แตะการ์ดบนแผนที่เพื่อเพิ่ม</div>`;

    rpList.innerHTML = (barsHTML(lastPlanBreakdown) || '') + list;
  }

  function renderMission(S){
    if(S.mode === 'A'){
      const bossName = S.boss?.typeNameTh || 'บอส';
      const bossText = S.boss?.active
        ? `🔥 ${bossName}: ${fmt(S.boss.progress)}/${fmt(S.boss.total)}`
        : `🔥 รอบนี้เจอ ${bossName}`;

      missionText.innerHTML = `
        <b>Emergency Clean-up:</b> รีบเก็บจุดเสี่ยงให้คุ้มที่สุดก่อนเชื้อลาม<br/>
        <span style="opacity:.92">${bossText}</span>
      `;

      helpBox.innerHTML = `
        • จุดแดง = รีบเก็บก่อน<br/>
        • บอส = ได้โบนัสถ้าทำทัน<br/>
        • จุดวิกฤตปล่อยไว้นาน เชื้อจะลาม
      `;

      if(missionLine){
        missionLine.textContent = S.boss?.active
          ? `🔥 ${bossName} ${fmt(S.boss.progress)}/${fmt(S.boss.total)} — รีบเก็บให้ครบ`
          : `🎯 เป้าหมาย: เก็บจุดแดงและเตรียมรับ ${bossName}`;
      }
      if(ovS){
        ovS.textContent = MOBILE
          ? 'แตะการ์ดใหญ่บนแผนที่เพื่อเก็บจุดเสี่ยง'
          : 'แตะการ์ดบนแผนที่เพื่อเก็บจุดเสี่ยง';
      }
    } else {
      missionText.innerHTML = `
        <b>Create:</b> วาง route/checklist ให้คุ้มที่สุดภายในเวลาที่กำหนด<br/>
        <span style="opacity:.92">เลือกหลายโซนและอย่าลืมบอส</span>
      `;

      helpBox.innerHTML = `
        • แตะการ์ดเพื่อเพิ่มใน route<br/>
        • ดู Coverage / Balance / Remain แล้วปรับแผน
      `;

      if(missionLine) missionLine.textContent = '🧠 วาง route ให้คุ้ม: ครอบคลุม • ไม่อ้อม • อย่าลืมบอส';
      if(ovS){
        ovS.textContent = MOBILE
          ? 'แตะการ์ดเพื่อเพิ่มลง route'
          : 'แตะการ์ดบนแผนที่เพื่อเพิ่ม route';
      }
    }
  }

  function setStars(n, note){
    const count = Math.max(0, Math.min(3, Number(n)||0));
    [star1, star2, star3].forEach((s, i)=>{
      if(!s) return;
      const on = i < count;
      s.textContent = on ? '⭐' : '☆';
      s.classList.toggle('on', on);
    });
    if(starNote) starNote.textContent = note || 'กำลังทำภารกิจ';
    if(count > lastStarCount) showCoach(`⭐ Progress ${count}/3`, 'good');
    lastStarCount = count;
  }

  function updateProgressStars(S){
    if(!S) return;

    if(S.mode === 'A'){
      let stars = 0;
      let note = 'เริ่มเลือกจุดเสี่ยง';
      const selected = (S.A?.selected || []).length;

      if(selected >= 1){ stars = 1; note = 'เริ่มเก็บจุดได้แล้ว'; }
      if(selected >= 2){ stars = 2; note = 'ใกล้ครบแล้ว'; }
      if(S.boss?.cleared){ stars = 3; note = `ยอดเยี่ยม เคลียร์ ${S.boss.typeNameTh || 'บอส'} แล้ว`; }

      setStars(stars, note);
      return;
    }

    const routeIds = (S.B?.routeIds || []).map(String);
    const routeN = routeIds.length;
    const half = Math.max(2, Math.ceil((S.B?.maxPoints || 5) / 2));
    let stars = 0;
    let note = 'เริ่มวาง route';

    if(routeN >= 2){ stars = 1; note = 'route เริ่มดีแล้ว'; }
    if(routeN >= half){ stars = 2; note = 'แผนคืบหน้าดี'; }
    if(routeIds.includes(String(bossId))){ stars = 3; note = 'สุดยอด ใส่บอสในแผนแล้ว'; }

    setStars(stars, note);
  }

  function updateAlert(S){
    if(!alertBar || !S) return;

    if(S.mode !== 'A'){
      alertBar.style.display = 'none';
      return;
    }

    const bossName = S.boss?.typeNameTh || 'บอส';

    if(S.boss?.cleared){
      alertBar.style.display = '';
      alertBar.classList.remove('crisis');
      alertBar.classList.add('reward');
      alertTitle.textContent = '🏁 BOSS CLEARED';
      alertText.textContent = `${bossName} ผ่านแล้ว • โบนัส +${fmt(S.boss.reward || 0)}`;
      return;
    }

    const spreadPenalty = Number(S.spreadPenalty || 0);
    const crisisOn = !!S.crisisOn;
    const spreadN = Array.isArray(S.spreadTargets) ? S.spreadTargets.length : 0;

    if(crisisOn){
      alertBar.style.display = '';
      alertBar.classList.remove('reward');
      alertBar.classList.add('crisis');
      alertTitle.textContent = '🚨 CRISIS';
      alertText.textContent = `${bossName} ทำให้หลายจุดกลายเป็นวิกฤต • penalty ${spreadPenalty}`;
      return;
    }

    if(S.boss?.active){
      alertBar.style.display = '';
      alertBar.classList.remove('crisis','reward');
      const left = Math.max(0, Math.ceil((S.boss.expireAtS || 0) - (S.elapsedSec || 0)));
      alertTitle.textContent = `🔥 ${bossName}`;
      alertText.textContent = `เป้าบอส ${fmt(S.boss.progress)}/${fmt(S.boss.total)} • เหลือ ${left} วิ`;
      return;
    }

    if(spreadN > 0 || spreadPenalty > 0){
      alertBar.style.display = '';
      alertBar.classList.remove('crisis','reward');
      alertTitle.textContent = '⚠️ SPREAD';
      alertText.textContent = `เชื้อลาม ${spreadN} จุด • penalty ${spreadPenalty}`;
      return;
    }

    alertBar.style.display = 'none';
    alertBar.classList.remove('crisis','reward');
  }

  function renderHud(S){
    pillMode.textContent = `MODE: ${S.mode==='A' ? 'A (Evaluate)' : 'B (Create)'}`;
    pillTime.textContent = `TIME: ${fmt(S.timeLeft)}s`;

    if(S.mode === 'A'){
      pillBudget.textContent = `SPRAYS: ${fmt(S.A?.spraysLeft||0)}/${fmt(S.A?.maxSelect||3)}`;
      pillGoal.textContent = `GOAL: ${S.boss?.typeNameTh || 'Boss'}`;
      pillSpread.textContent = `SPREAD: ${fmt(S.spreadPenalty || 0)}`;
      pillBoss.textContent = `BOSS: ${fmt(S.boss?.progress||0)}/${fmt(S.boss?.total||0)}`;
      pillSpread.style.display = '';
      pillBoss.style.display = '';
    } else {
      pillBudget.textContent = `POINTS: ${fmt((S.B?.routeIds||[]).length)}/${fmt(S.B?.maxPoints||5)}`;
      pillGoal.textContent = `GOAL: Route + Boss`;
      pillSpread.style.display = 'none';
      pillBoss.style.display = 'none';
    }
  }

  function goHubDirect(){
    const hub = qs('hub','');
    if(hub) location.href = hub;
    else location.href = '../hub.html';
  }

  function goCooldown(){
    const hub = qs('hub','') || '../hub.html';
    const base = new URL(location.href);
    const g = new URL('../warmup-gate.html', base);

    g.searchParams.set('gatePhase','cooldown');
    g.searchParams.set('phase','cooldown');
    g.searchParams.set('cat','hygiene');
    g.searchParams.set('theme','cleanobjects');
    g.searchParams.set('game','cleanobjects');
    g.searchParams.set('cd','1');
    g.searchParams.set('next', hub);
    g.searchParams.set('hub', hub);

    const keep = ['run','diff','time','seed','pid','view','ai','debug','api','log','studyId','phase','conditionGroup','grade','boss','bossType','pro'];
    keep.forEach(k=>{
      const v = base.searchParams.get(k);
      if(v !== null && v !== '') g.searchParams.set(k, v);
    });

    location.href = g.toString();
  }

  function replay(){
    location.reload();
  }

  function showSummary(payload){
    summary.style.display = '';
    const meta = summary.querySelector('#sumMeta');
    const body = summary.querySelector('#sumBody');
    const m = payload || {};
    const mode = (m.metrics && m.metrics.mode) ? m.metrics.mode : (lastState ? lastState.mode : '?');
    const score = Number(m.score || 0);

    meta.innerHTML = `
      PID: <b>${escapeHtml(m.pid||qs('pid','anon'))}</b> •
      Run: <b>${escapeHtml(m.run||qs('run','play'))}</b> •
      Day: <b>${escapeHtml(m.day||'')}</b> •
      Mode: <b>${escapeHtml(mode)}</b>
    `;

    if(mode === 'A'){
      const bd = (m.metrics && m.metrics.breakdown) ? m.metrics.breakdown : {};
      const reasons = (m.metrics && m.metrics.reasons) ? m.metrics.reasons : [];
      const comboBest = (m.metrics && m.metrics.combo) ? (m.metrics.combo.best||0) : 0;
      const bossPenalty = Number(bd?.bossPenalty || 0);
      const bossBonus = Number(bd?.bossBonus || m.metrics?.boss?.reward || 0);
      const spreadPenalty = Number(bd?.spreadPenalty || m.metrics?.spread?.penalty || 0);
      const spreadWaves = Number(m.metrics?.spread?.waves || 0);
      const boss = m.metrics?.boss || {};
      const bossName = boss.nameTh || boss.name || 'Boss';
      const tips = summaryAdviceA(Object.assign({}, bd, { spreadPenalty }), comboBest, bossPenalty);

      const verdict =
        score >= 420 ? `ยอดเยี่ยม! ผ่าน ${bossName} และเก็บจุดได้คุ้มมาก` :
        score >= 280 ? `ดีมาก! เริ่มรับมือ ${bossName} ได้ดีแล้ว` :
        `โอเค! รอบหน้าลองรับมือ ${bossName} ให้ไวขึ้น`;

      body.innerHTML = `
        <div class="sumStars">${starText(score)}</div>
        <div style="margin-top:6px;font-weight:1000;font-size:${MOBILE ? '16px' : '15px'}">${verdict}</div>
        <div style="margin-top:4px;opacity:.9">คะแนนรวม <b>${fmt(score)}</b></div>

        <div class="sumGrid">
          <div class="sumBox"><div class="sumBoxTitle">Boss Variant</div><div class="sumBoxVal">${escapeHtml(bossName)}</div></div>
          <div class="sumBox"><div class="sumBoxTitle">Boss Status</div><div class="sumBoxVal">${bossVerdictText(boss)}</div></div>
          <div class="sumBox"><div class="sumBoxTitle">Boss Reward</div><div class="sumBoxVal">+${fmt(bossBonus)}</div></div>
          <div class="sumBox"><div class="sumBoxTitle">ลดความเสี่ยง</div><div class="sumBoxVal">${fmt(bd.rrTotal)}</div></div>
          <div class="sumBox"><div class="sumBoxTitle">Decision</div><div class="sumBoxVal">${fmt(bd.dq)}%</div></div>
          <div class="sumBox"><div class="sumBoxTitle">Combo สูงสุด</div><div class="sumBoxVal">${fmt(comboBest)}</div></div>
          <div class="sumBox"><div class="sumBoxTitle">Spread Waves</div><div class="sumBoxVal">${fmt(spreadWaves)}</div></div>
          <div class="sumBox"><div class="sumBoxTitle">Spread Penalty</div><div class="sumBoxVal">-${fmt(spreadPenalty)}</div></div>
        </div>

        <div class="sumTips">
          <b>เหตุผลที่เลือก:</b><br/>
          ${reasons.length ? reasons.map(r=>`• ${escapeHtml(r.reasonText || r.id)}`).join('<br/>') : '• —'}
        </div>

        <div class="sumTips">
          <b>รอบหน้าลองแบบนี้:</b><br/>
          ${tips.map(t=>`• ${escapeHtml(t)}`).join('<br/>')}
        </div>
      `;
    } else {
      const bd = (m.metrics && m.metrics.breakdown) ? m.metrics.breakdown : {};
      const routeIds = (m.metrics && m.metrics.routeIds) ? m.metrics.routeIds : [];
      const tips = summaryAdviceB(bd);

      body.innerHTML = `
        <div class="sumStars">${starText(score)}</div>
        <div style="margin-top:6px;font-weight:1000;font-size:${MOBILE ? '16px' : '15px'}">สรุปแผน Route</div>
        <div style="margin-top:4px;opacity:.9">คะแนนรวม <b>${fmt(score)}</b></div>

        <div class="sumGrid">
          <div class="sumBox"><div class="sumBoxTitle">Coverage</div><div class="sumBoxVal">${fmt(bd.coverageB)}%</div></div>
          <div class="sumBox"><div class="sumBoxTitle">Balance</div><div class="sumBoxVal">${fmt(bd.balanceScore)}%</div></div>
          <div class="sumBox"><div class="sumBoxTitle">Remain</div><div class="sumBoxVal">${fmt(bd.remainScore)}%</div></div>
          <div class="sumBox"><div class="sumBoxTitle">Boss Penalty</div><div class="sumBoxVal">-${fmt(bd.bossPenalty)}</div></div>
        </div>

        <div class="sumTips"><b>Route ที่ส่ง:</b><br/>${routeIds.length ? routeIds.map(x=>escapeHtml(String(x))).join(' → ') : '—'}</div>
        <div class="sumTips"><b>รอบหน้าลองแบบนี้:</b><br/>${tips.map(t=>`• ${escapeHtml(t)}`).join('<br/>')}</div>
      `;
    }

    summary.querySelector('#btnCooldown').onclick = goCooldown;
    summary.querySelector('#btnBackHub').onclick = goHubDirect;
    summary.querySelector('#btnReplay').onclick = replay;
  }

  function handleShoot(){
    if(!lastState || lastState.ended) return;
    if(lastState.mode !== 'B') return;

    const rect = markerLayer.getBoundingClientRect();
    const cx = rect.left + rect.width/2;
    const cy = rect.top + rect.height/2;

    let best = null;
    let bestD = 1e18;
    markerLayer.querySelectorAll('.mk').forEach(mk=>{
      const r = mk.getBoundingClientRect();
      const mx = r.left + r.width/2;
      const my = r.top + r.height/2;
      const dx = mx - cx;
      const dy = my - cy;
      const d2 = dx*dx + dy*dy;
      if(d2 < bestD){ bestD = d2; best = mk; }
    });

    if(best && bestD <= (130*130)){
      const id = best.dataset.id;
      if(id) opts.toggleRouteB && opts.toggleRouteB(id);
    }
  }
  window.addEventListener('hha:shoot', handleShoot);

  routePanel.querySelector('#btnUndo').onclick = ()=> opts.undoB && opts.undoB();
  routePanel.querySelector('#btnClear').onclick = ()=> opts.clearB && opts.clearB();
  routePanel.querySelector('#btnSubmit').onclick = ()=> opts.submitB && opts.submitB();

  function onState(S){
    lastState = S;
    try{ bossId = String((S.cfg && S.cfg.bossId) ? S.cfg.bossId : bossId); }catch(e){}
    spreadIds = Array.isArray(S.spreadTargets) ? S.spreadTargets.slice(0) : [];

    if(S.boss?.cleared){
      const now = Date.now();
      if(now > rewardFlashUntil){
        rewardFlashUntil = now + 1500;
        const rect = markerLayer.getBoundingClientRect();
        popScore(markerLayer, rect.width/2, 60, `+${fmt(S.boss.reward || 0)} โบนัส`, 'reward');
      }
    }

    renderHud(S);
    updateProgressStars(S);
    updateAlert(S);
    renderMission(S);
    renderHeat(S);
    renderMarkers(S);
    renderRoutePanel(S);

    const showReason = (S.mode === 'A');
    const reasonTitle = root.querySelector('#reasonTitle');
    if(reasonTitle) reasonTitle.style.display = showReason ? '' : 'none';
    reasonBox.style.display = showReason ? '' : 'none';
    reasonNote.style.display = showReason ? '' : 'none';
  }

  function onTick(S, dt){
    void(dt);
    if(S) pillTime.textContent = `TIME: ${fmt(S.timeLeft)}s`;
  }

  function onCoach(msg){
    if(!msg) return;

    if(msg.kind === 'plan_live' && msg.data && msg.data.breakdown){
      lastPlanBreakdown = msg.data.breakdown;
      if(lastState) renderRoutePanel(lastState);
    }

    if(msg.kind === 'combo'){
      const cx = markerLayer.getBoundingClientRect().width * 0.5;
      popScore(markerLayer, cx, 40, `COMBO x${msg.data?.streak || 2}`);
    }

    if(msg.kind === 'good' && typeof msg.data?.reward !== 'undefined'){
      const cx = markerLayer.getBoundingClientRect().width * 0.5;
      popScore(markerLayer, cx, 80, `+${fmt(msg.data.reward)} BONUS`, 'reward');
    }

    let mood = 'tip';
    if(msg.kind === 'contamination' || msg.kind === 'danger' || msg.kind === 'warn') mood = 'warn';
    else if(msg.kind === 'boss' || msg.kind === 'boss_warn' || msg.kind === 'boss_final') mood = 'boss';
    else if(msg.kind === 'combo' || msg.kind === 'good' || msg.kind === 'daily_clear') mood = 'good';

    if(msg.text) showCoach(msg.text, mood);
  }

  function onSummary(payload){
    showSummary(payload);
  }

  function highlight(ids){
    aiTopIds = Array.isArray(ids) ? ids.slice(0) : [];
    if(lastState) renderMarkers(lastState);
  }

  function highlightBoss(ids){
    bossTopIds = Array.isArray(ids) ? ids.slice(0) : [];
    if(lastState) renderMarkers(lastState);
  }

  function markQuickPick(id){
    quickPickId = String(id || '');
    if(lastState) renderMarkers(lastState);
    setTimeout(()=>{
      if(quickPickId === String(id || '')){
        quickPickId = '';
        if(lastState) renderMarkers(lastState);
      }
    }, 1400);
  }

  helpBox.innerHTML = `
    • จุดแดง = รีบเก็บก่อน<br/>
    • บอสแต่ละรอบไม่เหมือนกัน<br/>
    • ถ้าปล่อยจุดวิกฤตไว้ เชื้อจะลาม
  `;

  return {
    onState,
    onTick,
    onCoach,
    onSummary,
    highlight,
    highlightBoss,
    markQuickPick
  };
}