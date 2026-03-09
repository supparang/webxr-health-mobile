// === /herohealth/vr-clean/clean.ui.js ===
// Clean Objects UI — SAFE/PRODUCTION — v20260301-FULL-EXCITE1234-PATCH
'use strict';

function el(tag, cls, html){
  const n = document.createElement(tag);
  if(cls) n.className = cls;
  if(html !== undefined) n.innerHTML = html;
  return n;
}
function clamp(v,a,b){ v = Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); }
function fmt(v){ v = Number(v)||0; return String(Math.round(v)); }
function escapeHtml(s){
  s = String(s ?? '');
  return s.replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
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
function reasonChipHTML(){
  const chips = [
    ['risk_high','เสี่ยงสูง'],
    ['touch_high','สัมผัสบ่อย'],
    ['traffic_high','คนผ่านบ่อย'],
    ['old_clean','ไม่ได้ทำความสะอาดนาน'],
    ['shared_use','ใช้ร่วมกัน'],
  ];
  return chips.map(([tag,lab])=>`<button class="chip" data-tag="${tag}" type="button">${lab}</button>`).join('');
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
  if(id.includes('scissors') || name.includes('scissors')) return 'กรรไกร';
  if(id.includes('desk') || id.includes('table') || name.includes('โต๊ะ')) return 'โต๊ะ';
  if(id.includes('fridge') || name.includes('fridge')) return 'ตู้เย็น';

  if(zone.includes('wet')) return 'จุดเปียก';
  if(zone.includes('shared')) return 'ของใช้ร่วม';
  if(zone.includes('entry')) return 'ทางเข้า';

  if(surface.includes('glass')) return 'พื้นผิวแก้ว';
  if(surface.includes('metal')) return 'พื้นผิวโลหะ';
  if(surface.includes('plastic')) return 'พื้นผิวพลาสติก';

  return 'จุดเสี่ยง';
}

function hotspotIcon(h){
  const id = String(h.id || '').toLowerCase();
  const zone = String(h.zone || '').toLowerCase();
  const surface = String(h.surfaceType || '').toLowerCase();

  if(id.includes('door')) return '🚪';
  if(id.includes('switch')) return '💡';
  if(id.includes('faucet')) return '💧';
  if(id.includes('toilet')) return '🚽';
  if(id.includes('remote')) return '📺';
  if(id.includes('tablet')) return '📱';
  if(id.includes('mouse')) return '🖱️';
  if(id.includes('scissors')) return '✂️';
  if(id.includes('desk') || id.includes('table')) return '🪑';
  if(id.includes('fridge')) return '🧊';

  if(zone.includes('shared')) return '🤝';
  if(zone.includes('wet')) return '💧';
  if(zone.includes('entry')) return '🚪';

  if(surface.includes('glass')) return '🪟';
  if(surface.includes('metal')) return '🔩';
  if(surface.includes('plastic')) return '🧴';

  return '🧽';
}

function riskClass(r){
  r = Number(r)||0;
  if(r >= 80) return 'risk-high';
  if(r >= 65) return 'risk-mid';
  return 'risk-low';
}

function riskStateLabel(r){
  r = Number(r)||0;
  if(r >= 80) return 'วิกฤต';
  if(r >= 65) return 'เสี่ยง';
  return 'เฝ้าระวัง';
}

function markerClassForRisk(r){
  r = Number(r)||0;
  if(r >= 75) return 'hot';
  if(r >= 55) return 'warn';
  return '';
}

function placeWithoutOverlap(items, boxW, boxH){
  const placed = [];
  const out = [];

  function intersects(a,b){
    return !(
      a.x + a.w <= b.x ||
      a.x >= b.x + b.w ||
      a.y + a.h <= b.y ||
      a.y >= b.y + b.h
    );
  }

  for(const it of items){
    let x = it.cx - boxW/2;
    let y = it.cy - boxH/2;

    const tries = [
      [0,0],[0,-18],[0,18],[-18,0],[18,0],
      [-24,-18],[24,-18],[-24,18],[24,18],
      [0,-30],[0,30],[-32,0],[32,0],
      [-40,-24],[40,-24],[-40,24],[40,24]
    ];

    let placedBox = null;
    for(const [dx,dy] of tries){
      const cand = { x:x+dx, y:y+dy, w:boxW, h:boxH };
      const hit = placed.some(p=>intersects(cand,p));
      if(!hit){ placedBox = cand; break; }
    }
    if(!placedBox) placedBox = { x, y, w:boxW, h:boxH };

    placed.push(placedBox);
    out.push({
      id: it.id,
      h: it.h,
      x: placedBox.x,
      y: placedBox.y,
      cx: it.cx,
      cy: it.cy
    });
  }
  return out;
}

function addLeaderLine(layer, x1, y1, x2, y2){
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx*dx + dy*dy);
  if(len < 8) return null;

  const ang = Math.atan2(dy, dx) * 180 / Math.PI;

  const line = el('div','mk-line');
  line.style.left = `${x1}px`;
  line.style.top = `${y1}px`;
  line.style.width = `${len}px`;
  line.style.transform = `rotate(${ang}deg)`;
  layer.appendChild(line);
  return line;
}

function popScore(layer, x, y, text){
  const n = el('div','fx-pop');
  n.textContent = text;
  n.style.left = `${x}px`;
  n.style.top  = `${y}px`;
  layer.appendChild(n);
  setTimeout(()=> n.remove(), 650);
}

function starText(score){
  score = Number(score||0);
  if(score >= 320) return '⭐⭐⭐';
  if(score >= 220) return '⭐⭐';
  return '⭐';
}

function summaryAdviceA(bd, comboBest, bossPenalty){
  const tips = [];
  if(Number(bd?.dq||0) < 60) tips.push('เลือกจุดคุ้มให้มากขึ้น เช่น ลูกบิด ของใช้ร่วม ก๊อกน้ำ');
  if(Number(bd?.coverage||0) < 60) tips.push('ใช้ Sprays ให้ครบและเลือกหลายจุดสำคัญ');
  if(Number(comboBest||0) < 2) tips.push('ถ้าเลือกถูกต่อเนื่องจะได้คอมโบ');
  if(Number(bossPenalty||0) > 0) tips.push('อย่าลืมทำบอส ไม่งั้นโดนหักหนัก');
  if(!tips.length) tips.push('ทำได้ดีมากแล้ว รอบหน้าลองเพิ่มความเร็ว');
  return tips.slice(0,2);
}

function summaryAdviceB(bd, bossPenalty){
  const tips = [];
  if(Number(bd?.coverageB||0) < 60) tips.push('เลือกจุดสัมผัสสูงเพิ่ม เพื่อดัน Coverage');
  if(Number(bd?.balanceScore||0) < 55) tips.push('เลือกหลายโซน/หลายพื้นผิวให้สมดุลขึ้น');
  if(Number(bd?.remainScore||0) < 60) tips.push('ยังพลาดจุดคุ้มหลายจุด ลองเพิ่มของใช้ร่วมและจุดเปียก');
  if(Number(bossPenalty||0) > 0) tips.push('ใส่บอสลงใน route ด้วย จะไม่โดนหัก');
  if(!tips.length) tips.push('แผนดีมากแล้ว ลองทำ route ให้สั้นลง');
  return tips.slice(0,2);
}

export function mountCleanUI(root, opts){
  opts = opts || {};
  root.innerHTML = '';

  const app = el('div','cleanApp');
  root.appendChild(app);

  const hud = el('div','hud');
  hud.innerHTML = `
    <div class="hudRow">
      <div class="pill" id="pillMode">MODE: —</div>
      <div class="pill" id="pillTime">TIME: 0</div>
      <div class="pill" id="pillBudget">BUDGET: —</div>
      <div class="pill" id="pillGoal">GOAL: —</div>
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
      <div class="ovT" style="font-weight:1000">Clean Objects</div>
      <div id="missionLine" class="missionLine">
        🎯 เลือก “จุดที่เสี่ยงที่สุด” ก่อน เช่น 🚪 ลูกบิด • 🤝 ของใช้ร่วม • 💧 ก๊อกน้ำ
      </div>
      <div class="ovS" style="font-size:12px;opacity:.85;margin-top:4px">
        แตะ marker บนแผนที่เพื่อเล่น • Cardboard ยิงด้วย crosshair ได้
      </div>
    </div>
  `;
  board.appendChild(overlay);
  app.appendChild(board);

  const info = el('div','info');
  info.innerHTML = `
    <div style="font-weight:1000;margin-bottom:6px">ภารกิจ</div>
    <div id="missionText" style="opacity:.9;line-height:1.45;font-size:13px"></div>
    <div style="margin-top:12px;font-weight:1000">เหตุผล (Evaluate)</div>
    <div id="reasonBox" style="margin-top:8px"></div>
    <div id="reasonNote" style="margin-top:8px;opacity:.85;font-size:12px;line-height:1.4"></div>
    <div id="helpBox" style="margin-top:12px;opacity:.85;font-size:12px;line-height:1.45"></div>
  `;
  app.appendChild(info);

  const legend = el('div','legendCard');
  legend.innerHTML = `
    <div class="legendTitle">อ่านจุดบนแผนที่</div>
    <div class="legendGrid">
      <div class="legendItem"><span class="lgBox">🚪</span><span>ลูกบิด/ทางเข้า</span></div>
      <div class="legendItem"><span class="lgBox">🤝</span><span>ของใช้ร่วม</span></div>
      <div class="legendItem"><span class="lgBox">💧</span><span>ก๊อกน้ำ/จุดเปียก</span></div>
      <div class="legendItem"><span class="lgBox">📱</span><span>อุปกรณ์ที่จับบ่อย</span></div>
    </div>
    <div class="legendRisk">
      <span><span class="riskDot high"></span>เสี่ยงสูง</span>
      <span><span class="riskDot mid"></span>เสี่ยงกลาง</span>
      <span><span class="riskDot low"></span>เสี่ยงต่ำ</span>
    </div>
    <div style="margin-top:10px">
      <button class="btn" id="btnHowTo" type="button">วิธีเล่น</button>
    </div>
  `;
  app.appendChild(legend);

  const routePanel = el('div','routePanel');
  routePanel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
      <div>
        <div style="font-weight:1000">Route / รายการ</div>
        <div id="rpSub" style="opacity:.85;font-size:12px;margin-top:2px">—</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" id="btnUndo" type="button">Undo</button>
        <button class="btn" id="btnClear" type="button">Clear</button>
        <button class="btn primary" id="btnSubmit" type="button">Submit</button>
      </div>
    </div>
    <div id="rpList" style="margin-top:10px"></div>
  `;
  app.appendChild(routePanel);

  const tutorial = el('div','tutorialWrap');
  tutorial.style.display = 'none';
  tutorial.innerHTML = `
    <div class="tutorialCard">
      <div class="tutorialHead">
        <div class="tutorialTitle" id="tutorialTitle">วิธีเล่น</div>
        <button class="btn" id="btnTutorialSkip" type="button">ข้าม</button>
      </div>
      <div class="tutorialBody">
        <div id="tutorialText" class="tutorialText"></div>
        <div id="tutorialHint" class="tutorialHint"></div>
      </div>
      <div class="tutorialFoot">
        <label class="tutorialChk">
          <input type="checkbox" id="tutorialNoMore" />
          ไม่ต้องโชว์อีกวันนี้
        </label>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" id="btnTutorialPrev" type="button">ย้อนกลับ</button>
          <button class="btn primary" id="btnTutorialNext" type="button">ถัดไป</button>
        </div>
      </div>
    </div>
  `;
  root.appendChild(tutorial);

  const coachToast = el('div','coachToast mood-tip');
  coachToast.style.display = '';
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
    padding: 14px;
    background: rgba(0,0,0,.55);
  `;
  summary.innerHTML = `
    <div style="max-width:860px;margin:0 auto;border:1px solid rgba(148,163,184,.18);background:rgba(2,6,23,.86);border-radius:22px;padding:14px;box-shadow:0 30px 90px rgba(0,0,0,.45)">
      <div style="font-weight:1100;font-size:18px">สรุปผล — Clean Objects</div>
      <div id="sumMeta" style="margin-top:6px;opacity:.9;font-size:12px;line-height:1.4"></div>
      <div id="sumBody" style="margin-top:10px;opacity:.95;font-size:13px;line-height:1.5"></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;justify-content:flex-end">
        <button class="btn primary" id="btnCooldown" type="button">Go Cooldown</button>
        <button class="btn" id="btnBackHub" type="button">Back to HUB</button>
        <button class="btn" id="btnReplay" type="button">Replay</button>
      </div>
    </div>
  `;
  root.appendChild(summary);

  const style = el('style');
  style.textContent = `
    .cleanApp{ display:grid; gap:12px; }
    .hud{ display:grid; gap:10px; }
    .hudRow{ display:flex; gap:8px; flex-wrap:wrap; }
    .pill{
      border:1px solid rgba(148,163,184,.20); background: rgba(2,6,23,.45); color: rgba(229,231,235,.95);
      padding:10px 12px; border-radius:14px; font-weight:1000;
    }
    .btn{
      border:1px solid rgba(148,163,184,.20); background: rgba(2,6,23,.45); color: rgba(229,231,235,.95);
      padding:10px 12px; border-radius:14px; font-weight:1000; cursor:pointer;
    }
    .btn.primary{ background: rgba(59,130,246,.28); border-color: rgba(59,130,246,.38); }
    .btn:active{ transform: translateY(1px); }
    .chip{
      border:1px solid rgba(148,163,184,.18); background: rgba(2,6,23,.38); color: rgba(229,231,235,.92);
      padding: 8px 10px; border-radius: 999px; font-weight: 900; cursor:pointer; font-size:12px;
    }
    .chip.sel{ border-color: rgba(59,130,246,.55); background: rgba(59,130,246,.18); }

    .board{
      position:relative;
      min-height: 640px;
      border-radius: 22px;
      border:1px solid rgba(148,163,184,.18);
      background:
        radial-gradient(900px 500px at 50% -20%, rgba(59,130,246,.10), transparent 60%),
        rgba(2,6,23,.55);
      box-shadow: 0 18px 55px rgba(0,0,0,.28);
      overflow:hidden;
    }
    .grid{ position:relative; min-height: 640px; }
    .heatLayer{ position:absolute; inset:0; pointer-events:none; }
    .markerLayer{ position:absolute; inset:0; }
    .overlay{ position:absolute; inset:0; pointer-events:none; }
    .ovHint{
      margin:10px;
      max-width: 520px;
      border-radius: 16px;
      border:1px solid rgba(148,163,184,.18);
      background: rgba(2,6,23,.48);
      padding:10px 12px;
      box-shadow: 0 14px 44px rgba(0,0,0,.25);
    }
    .missionLine{
      margin-top:6px;
      font-size:12px;
      font-weight:950;
      line-height:1.35;
      color: rgba(229,231,235,.95);
      background: rgba(34,211,238,.08);
      border:1px solid rgba(34,211,238,.16);
      border-radius:12px;
      padding:8px 10px;
    }

    .heat{
      position:absolute; border-radius:999px; filter: blur(10px);
      background: radial-gradient(circle, rgba(255,255,255,.40), transparent 70%);
    }
    .heat.cool{ background: radial-gradient(circle, rgba(34,197,94,.26), transparent 70%); }
    .heat.warm{ background: radial-gradient(circle, rgba(245,158,11,.26), transparent 70%); }
    .heat.hot{ background: radial-gradient(circle, rgba(239,68,68,.30), transparent 70%); }

    .mk{
      position:absolute;
      width:92px; min-height:72px;
      border-radius:14px;
      border:1px solid rgba(148,163,184,.25);
      background: rgba(2,6,23,.82);
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      gap:2px;
      padding:6px 8px;
      text-align:center;
      cursor:pointer; user-select:none;
      box-shadow: 0 10px 30px rgba(0,0,0,.18);
      transform: translate(-50%, -50%);
    }
    .mk .mk-icon{ font-size:18px; line-height:1; }
    .mk .mk-name{ font-size:11px; font-weight:1000; line-height:1.1; }
    .mk .mk-risk{
      font-size:11px; font-weight:1000;
      padding:2px 6px; border-radius:999px;
      background: rgba(255,255,255,.08);
    }
    .mk .mk-state{ font-size:10px; font-weight:1000; opacity:.82; line-height:1.1; }

    .mk.on{ border-color: rgba(34,197,94,.55); background: rgba(34,197,94,.12); }
    .mk.warn,.mk.risk-mid{
      border-color: rgba(251,191,36,.55);
      box-shadow: 0 0 0 6px rgba(251,191,36,.08), 0 10px 30px rgba(0,0,0,.18);
    }
    .mk.hot,.mk.risk-high{
      border-color: rgba(239,68,68,.55);
      box-shadow: 0 0 0 6px rgba(239,68,68,.10), 0 10px 30px rgba(0,0,0,.18);
    }
    .mk.risk-low{ border-color: rgba(34,197,94,.35); }
    .mk.risk-high .mk-state{ color:#fecaca; }
    .mk.risk-mid .mk-state{ color:#fde68a; }
    .mk.risk-low .mk-state{ color:#bbf7d0; }
    .mk.risk-high{ animation: riskPulseHigh .8s ease-in-out infinite alternate; }
    .mk.risk-mid{ animation: riskPulseMid 1.2s ease-in-out infinite alternate; }
    .mk.boss{ outline: 2px solid rgba(239,68,68,.55); outline-offset: 2px; }

    .mk.ai-hot{
      outline: 3px solid rgba(34,211,238,.85);
      box-shadow: 0 0 0 8px rgba(34,211,238,.16), 0 10px 30px rgba(0,0,0,.18);
      animation: aihotPulse .9s ease-in-out infinite alternate;
    }
    .mk.boss-hot{
      outline: 3px solid rgba(245,158,11,.9);
      box-shadow: 0 0 0 8px rgba(245,158,11,.14), 0 10px 30px rgba(0,0,0,.18);
    }
    .mk.quickpick{
      outline: 3px solid rgba(34,211,238,.92);
      box-shadow: 0 0 0 10px rgba(34,211,238,.16), 0 10px 30px rgba(0,0,0,.18);
    }
    .mk.selected{
      transform: translate(-50%, -50%) scale(.94);
      opacity: .72;
      filter: saturate(.85);
    }
    .mk.selected .mk-risk{ background: rgba(34,197,94,.18); }

    .mk-anchor{
      position:absolute;
      width:6px; height:6px;
      border-radius:999px;
      background: rgba(255,255,255,.45);
      pointer-events:none;
    }
    .mk-line{
      position:absolute;
      height:2px;
      background: rgba(148,163,184,.42);
      transform-origin: 0 50%;
      pointer-events:none;
    }
    .mk-line.line-selected{ background: rgba(34,197,94,.58); }
    .mk-line.line-boss{ background: rgba(245,158,11,.72); height: 3px; }
    .mk-line.line-ai{ background: rgba(34,211,238,.72); height: 3px; }

    .fx-pop{
      position:absolute;
      transform: translate(-50%, -50%);
      font-size:14px;
      font-weight:1000;
      color:#e5e7eb;
      text-shadow: 0 10px 28px rgba(0,0,0,.45);
      pointer-events:none;
      animation: fxPopUp .55s ease-out forwards;
    }

    .legendCard{
      border:1px solid rgba(148,163,184,.18);
      background: rgba(2,6,23,.52);
      border-radius:18px;
      padding:12px;
      box-shadow: 0 14px 44px rgba(0,0,0,.25);
    }
    .legendTitle{ font-weight:1000; margin-bottom:8px; }
    .legendGrid{
      display:grid;
      grid-template-columns: repeat(2, minmax(0,1fr));
      gap:8px;
    }
    .legendItem{
      display:flex; align-items:center; gap:8px;
      font-size:12px; font-weight:900; opacity:.95;
    }
    .lgBox{
      min-width:28px; height:28px;
      display:grid; place-items:center;
      border-radius:10px;
      border:1px solid rgba(148,163,184,.18);
      background: rgba(15,23,42,.55);
    }
    .legendRisk{
      margin-top:10px;
      font-size:12px;
      font-weight:900;
      display:flex;
      gap:10px;
      flex-wrap:wrap;
      align-items:center;
    }
    .riskDot{
      display:inline-block;
      width:10px; height:10px;
      border-radius:999px;
      margin-right:4px;
    }
    .riskDot.high{ background: rgba(239,68,68,.92); }
    .riskDot.mid{ background: rgba(245,158,11,.92); }
    .riskDot.low{ background: rgba(34,197,94,.92); }

    .routePanel,.info{
      border-radius:18px;
      border:1px solid rgba(148,163,184,.16);
      background: rgba(15,23,42,.46);
      padding:12px;
      box-shadow: 0 18px 55px rgba(0,0,0,.25);
    }

    .bars{ margin-bottom:10px; }
    .barRow{
      display:grid;
      grid-template-columns: 72px 1fr 48px;
      gap:8px;
      align-items:center;
      margin:8px 0;
    }
    .barLab,.barVal{ font-size:12px; font-weight:900; color: rgba(229,231,235,.92); }
    .barTrack{
      height:10px; border-radius:999px;
      background: rgba(255,255,255,.08);
      overflow:hidden;
    }
    .barFill{
      height:100%;
      background: linear-gradient(90deg, rgba(59,130,246,.75), rgba(34,197,94,.75));
      border-radius:999px;
    }

    .coachToast{
      position: fixed;
      right: 14px;
      bottom: 18px;
      z-index: 180;
      display:flex;
      align-items:flex-end;
      gap:10px;
      max-width: min(420px, 92vw);
      opacity:.96;
      transform: translateY(0);
      transition: transform .18s ease, opacity .18s ease, filter .18s ease;
    }
    .coachToast.show{
      transform: translateY(-2px);
      filter: brightness(1.04);
    }
    .coachAvatar{
      width:46px;
      height:46px;
      border-radius:16px;
      display:grid;
      place-items:center;
      font-size:22px;
      font-weight:1000;
      border:1px solid rgba(148,163,184,.20);
      background: rgba(15,23,42,.88);
      box-shadow: 0 12px 28px rgba(0,0,0,.28);
      flex: 0 0 auto;
    }
    .coachBubble{
      border:1px solid rgba(148,163,184,.18);
      background: rgba(2,6,23,.86);
      border-radius:18px 18px 6px 18px;
      padding:10px 12px;
      box-shadow: 0 16px 44px rgba(0,0,0,.30);
      min-width: 180px;
    }
    .coachName{
      font-size:11px;
      font-weight:1000;
      opacity:.72;
      margin-bottom:4px;
      letter-spacing:.2px;
    }
    .ctInner{
      font-size:13px;
      font-weight:950;
      line-height:1.4;
    }
    .coachToast.mood-tip .coachBubble{
      border-color: rgba(34,211,238,.22);
      background: rgba(2,6,23,.88);
    }
    .coachToast.mood-warn .coachBubble{
      border-color: rgba(245,158,11,.30);
      background: rgba(38,20,4,.88);
    }
    .coachToast.mood-boss .coachBubble{
      border-color: rgba(239,68,68,.32);
      background: rgba(40,10,10,.90);
    }
    .coachToast.mood-good .coachBubble{
      border-color: rgba(34,197,94,.28);
      background: rgba(8,30,16,.88);
    }

    .tutorialWrap{
      position:fixed;
      inset:0;
      z-index:300;
      background: rgba(0,0,0,.56);
      display:flex;
      align-items:flex-end;
      justify-content:center;
      padding:16px;
    }
    .tutorialCard{
      width:min(560px, 94vw);
      border:1px solid rgba(148,163,184,.20);
      background: rgba(2,6,23,.94);
      border-radius:20px;
      box-shadow: 0 28px 90px rgba(0,0,0,.45);
      overflow:hidden;
    }
    .tutorialHead{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      padding:12px;
      border-bottom:1px solid rgba(148,163,184,.16);
    }
    .tutorialTitle{ font-weight:1000; font-size:15px; }
    .tutorialBody{ padding:12px; }
    .tutorialText{ font-weight:1000; line-height:1.45; font-size:14px; }
    .tutorialHint{ margin-top:8px; font-size:12px; line-height:1.45; opacity:.86; }
    .tutorialFoot{
      padding:12px;
      border-top:1px solid rgba(148,163,184,.16);
      display:flex;
      gap:10px;
      justify-content:space-between;
      align-items:center;
      flex-wrap:wrap;
    }
    .tutorialChk{
      display:flex;
      align-items:center;
      gap:8px;
      font-size:12px;
      font-weight:900;
      opacity:.88;
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
      background: rgba(15,23,42,.38);
    }
    .starTitle{ font-size:12px; font-weight:1000; opacity:.9; }
    .stars{ display:flex; gap:6px; align-items:center; }
    .star{
      font-size:20px; line-height:1; opacity:.55;
      transition: transform .12s ease, opacity .12s ease, filter .12s ease;
    }
    .star.on{
      opacity:1;
      transform: scale(1.08);
      filter: drop-shadow(0 8px 18px rgba(0,0,0,.28));
    }
    .starNote{ font-size:12px; font-weight:900; opacity:.86; }

    .sumStars{
      font-size: 22px;
      font-weight: 1000;
      letter-spacing: 2px;
      margin-top: 8px;
    }
    .sumGrid{
      display:grid;
      grid-template-columns: repeat(2, minmax(0,1fr));
      gap:10px;
      margin-top:12px;
    }
    .sumBox{
      border:1px solid rgba(148,163,184,.16);
      background: rgba(15,23,42,.45);
      border-radius:16px;
      padding:10px;
    }
    .sumBoxTitle{
      font-size:12px;
      font-weight:1000;
      opacity:.88;
      margin-bottom:6px;
    }
    .sumBoxVal{
      font-size:18px;
      font-weight:1000;
    }
    .sumTips{
      margin-top:12px;
      border:1px solid rgba(148,163,184,.16);
      background: rgba(2,6,23,.38);
      border-radius:16px;
      padding:10px;
      font-size:13px;
      line-height:1.5;
    }

    .danger .hud{ box-shadow: 0 0 0 1px rgba(239,68,68,.25), 0 20px 60px rgba(239,68,68,.10); }
    .danger .ovHint{ border-color: rgba(239,68,68,.35); }
    .dangerBoard{
      box-shadow: 0 0 0 2px rgba(239,68,68,.18), 0 0 40px rgba(239,68,68,.10) inset;
    }

    @keyframes aihotPulse{
      from{ filter: brightness(1); }
      to{ filter: brightness(1.22); }
    }
    @keyframes riskPulseHigh{
      from{ transform:translate(-50%,-50%) scale(1); }
      to{ transform:translate(-50%,-50%) scale(1.05); }
    }
    @keyframes riskPulseMid{
      from{ filter:brightness(1); }
      to{ filter:brightness(1.08); }
    }
    @keyframes fxPopUp{
      0%{ opacity:0; transform:translate(-50%, -50%) scale(.92); }
      15%{ opacity:1; transform:translate(-50%, -66%) scale(1.02); }
      100%{ opacity:0; transform:translate(-50%, -98%) scale(1.00); }
    }

    @media (max-width: 680px){
      .legendGrid{ grid-template-columns: 1fr; }
    }
    @media (max-width: 640px){
      .coachToast{ right: 10px; left: 10px; max-width: none; }
      .coachBubble{ flex:1 1 auto; }
      .sumGrid{ grid-template-columns: 1fr; }
    }
  `;
  root.appendChild(style);

  let lastState = null;
  let lastPlanBreakdown = null;
  let selectedReasonTag = 'risk_high';
  let dangerOn = false;
  let bossId = String(qs('boss','toilet_flush')||'toilet_flush');
  let aiTopIds = [];
  let bossTopIds = [];
  let quickPickId = '';
  let lastStarCount = 0;
  let tutorialStep = 0;
  const tutorialDayKey = (()=> {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();
  const tutorialHideKey = `HHA_TUT_HIDE::cleanobjects::${tutorialDayKey}`;

  const $ = (id)=> root.querySelector('#'+id);
  const pillMode = $('pillMode');
  const pillTime = $('pillTime');
  const pillBudget = $('pillBudget');
  const pillGoal = $('pillGoal');
  const missionText = $('missionText');
  const reasonBox = $('reasonBox');
  const reasonNote = $('reasonNote');
  const helpBox = $('helpBox');
  const rpSub = $('rpSub');
  const rpList = $('rpList');
  const missionLine = $('missionLine');
  const btnHowTo = root.querySelector('#btnHowTo');
  const btnTutorialSkip = root.querySelector('#btnTutorialSkip');
  const btnTutorialPrev = root.querySelector('#btnTutorialPrev');
  const btnTutorialNext = root.querySelector('#btnTutorialNext');
  const tutorialTitle = root.querySelector('#tutorialTitle');
  const tutorialText = root.querySelector('#tutorialText');
  const tutorialHint = root.querySelector('#tutorialHint');
  const tutorialNoMore = root.querySelector('#tutorialNoMore');
  const star1 = $('star1');
  const star2 = $('star2');
  const star3 = $('star3');
  const starNote = $('starNote');

  reasonBox.innerHTML = `<div style="display:flex;gap:8px;flex-wrap:wrap">${reasonChipHTML()}</div>`;
  reasonNote.textContent = 'เลือกเหตุผล 1 ข้อ แล้วแตะ marker เพื่อทำความสะอาด';
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
    else coachToast.classList.add('mood-tip');

    const av = root.querySelector('#coachAvatar');
    if(!av) return;
    av.textContent =
      kind === 'boss' ? '🔥' :
      kind === 'warn' ? '⚠️' :
      kind === 'good' ? '😄' :
      '🤖';
  }

  function showCoach(text, kind='tip'){
    const t = root.querySelector('#coachText');
    if(t) t.innerHTML = escapeHtml(text);
    setCoachMood(kind);

    coachToast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=>{
      coachToast.classList.remove('show');
      setCoachMood('tip');
      if(t) t.innerHTML = 'พร้อมช่วยอยู่ตรงนี้';
    }, 2600);
  }

  function renderHeat(S){
    heatLayer.innerHTML = '';
    const hs = S.hotspots || [];
    const w = (S.map && S.map.w) ? S.map.w : 10;
    const hN = (S.map && S.map.h) ? S.map.h : 10;

    for(const h of hs){
      const r = clamp(h.risk,0,100);
      const size = 22 + (r/100)*58;
      const alpha = 0.10 + (r/100)*0.30;
      const hueClass = (r>=75) ? 'hot' : (r>=55 ? 'warm' : 'cool');

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
    const placed = placeWithoutOverlap(items, 92, 72);

    for(const p of placed){
      const h = p.h || items.find(x=>x.id===p.id)?.h;
      if(!h) continue;

      const id = String(h.id);
      const picked = (S.mode==='A') ? chosenA.has(id) : chosenB.has(id);

      const mk = el('div', `mk ${markerClassForRisk(h.risk)} ${riskClass(h.risk)}`);
      mk.dataset.id = id;
      mk.setAttribute('data-hotspot-id', id);

      mk.style.left = `${p.x + 46}px`;
      mk.style.top  = `${p.y + 36}px`;

      if(picked) mk.classList.add('on','selected');
      if(id === bossId) mk.classList.add('boss');
      if(aiTopIds.includes(id)) mk.classList.add('ai-hot');
      if(bossTopIds.includes(id)) mk.classList.add('boss-hot');
      if(quickPickId && quickPickId === id) mk.classList.add('quickpick');

      const label = shortThaiLabel(h);
      const icon = hotspotIcon(h);
      const risk = Math.round(Number(h.risk || 0));
      const stateLabel = riskStateLabel(risk);

      mk.innerHTML = `
        <div class="mk-icon">${icon}</div>
        <div class="mk-name">${escapeHtml(label)}</div>
        <div class="mk-risk">${risk}</div>
        <div class="mk-state">${escapeHtml(stateLabel)}</div>
      `;
      mk.title = `${label} • ความเสี่ยง ${risk} • ${stateLabel}`;

      mk.addEventListener('click', ()=>{
        if(!lastState || lastState.ended) return;

        const scoreText = (lastState.mode === 'A')
          ? `+${Math.max(8, Math.round(risk * 0.35))}`
          : '+route';

        popScore(markerLayer, p.x + 46, p.y + 20, scoreText);

        if(lastState.mode === 'A'){
          opts.selectA && opts.selectA(id, selectedReasonTag);
        }else{
          opts.toggleRouteB && opts.toggleRouteB(id);
        }
      });

      const mkCenterX = p.x + 46;
      const mkCenterY = p.y + 36;
      const line = addLeaderLine(markerLayer, mkCenterX, mkCenterY, p.cx, p.cy);
      if(line){
        if(picked) line.classList.add('line-selected');
        if(id === bossId || bossTopIds.includes(id)) line.classList.add('line-boss');
        else if(aiTopIds.includes(id)) line.classList.add('line-ai');
      }

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
          const t = h ? `${escapeHtml(h.name||id)} <span style="opacity:.75">(${escapeHtml(h.surfaceType||'')}, risk ${fmt(h.risk)}%)</span>` : escapeHtml(id);
          return `<div style="padding:8px 0;border-top:1px solid rgba(148,163,184,.10)"><b>${i+1}.</b> ${t}</div>`;
        }).join('')
      : `<div style="opacity:.8">ยังไม่มี route — แตะจุดเพื่อเพิ่ม</div>`;

    rpList.innerHTML = (barsHTML(lastPlanBreakdown) || '') + list;
  }

  function renderMission(S){
    if(S.mode === 'A'){
      missionText.innerHTML = `
        <b>Emergency Clean-up:</b> รีบจัดการจุดเสี่ยงก่อนเชื้อกระจาย<br/>
        <span style="opacity:.92">เริ่มจาก <b>ลูกบิด • ของใช้ร่วม • ก๊อกน้ำ</b> และอย่าลืม <b>บอส: ${escapeHtml(bossId)}</b></span>
      `;
      helpBox.innerHTML = `Tip: จุด “วิกฤต” ต้องทำก่อน • เลือกถูกต่อเนื่องจะได้คอมโบ`;
      if(missionLine){
        missionLine.textContent = '🚨 เก็บจุดวิกฤตก่อน แล้วค่อยเก็บจุดเสี่ยง';
      }
    }else{
      missionText.innerHTML = `
        <b>Create:</b> วางแผน route/checklist ภายในเวลา <b>${fmt(S.timeTotal||60)}s</b> เลือกได้ <b>${fmt(S.B?.maxPoints||5)}</b> จุด<br/>
        <span style="opacity:.92">🔥 อย่าลืม “บอส”: <b>${escapeHtml(bossId)}</b> (ถ้าไม่รวมใน route โดนหัก)</span>
      `;
      helpBox.innerHTML = `Tip: แตะจุดเพื่อเพิ่มใน route • ดู bars แล้วปรับแผน`;
      if(missionLine){
        missionLine.textContent = '🧠 วาง route ให้คุ้ม: ครอบคลุม • ไม่อ้อม • อย่าลืมบอส';
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

    if(count > lastStarCount){
      showCoach(`⭐ Progress ${count}/3`, 'good');
    }
    lastStarCount = count;
  }

  function updateProgressStars(S){
    if(!S) return;

    if(S.mode === 'A'){
      const selected = (S.A?.selected || []);
      const ids = selected.map(x=>String(x.id));
      let stars = 0;
      let note = 'เริ่มเลือกจุดเสี่ยง';

      if(selected.length >= 1){
        stars = 1;
        note = 'ดีมาก เริ่มเลือกจุดแล้ว';
      }
      if(selected.length >= 2){
        stars = 2;
        note = 'ใกล้ครบแล้ว เลือกให้คุ้มอีกนิด';
      }
      if(ids.includes(String(bossId))){
        stars = 3;
        note = 'ยอดเยี่ยม จัดการบอสแล้ว';
      }

      setStars(stars, note);
      return;
    }

    const routeIds = (S.B?.routeIds || []).map(String);
    const routeN = routeIds.length;
    const half = Math.max(2, Math.ceil((S.B?.maxPoints || 5) / 2));

    let stars = 0;
    let note = 'เริ่มวาง route';

    if(routeN >= 2){
      stars = 1;
      note = 'แผนเริ่มเป็นรูปเป็นร่าง';
    }
    if(routeN >= half){
      stars = 2;
      note = 'แผนคืบหน้าดีแล้ว';
    }
    if(routeIds.includes(String(bossId))){
      stars = 3;
      note = 'สุดยอด ใส่บอสในแผนแล้ว';
    }

    setStars(stars, note);
  }

  function renderHud(S){
    pillMode.textContent = `MODE: ${S.mode==='A' ? 'A (Evaluate)' : 'B (Create)'}`;
    pillTime.textContent = `TIME: ${fmt(S.timeLeft)}s`;
    if(S.mode === 'A'){
      pillBudget.textContent = `SPRAYS: ${fmt(S.A?.spraysLeft||0)}/${fmt(S.A?.maxSelect||3)}`;
      pillGoal.textContent = `GOAL: Best picks + Boss`;
    }else{
      pillBudget.textContent = `POINTS: ${fmt((S.B?.routeIds||[]).length)}/${fmt(S.B?.maxPoints||5)}`;
      pillGoal.textContent = `GOAL: Best plan + Boss`;
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
    g.searchParams.set('cat','hygiene');
    g.searchParams.set('theme','cleanobjects');
    g.searchParams.set('game','cleanobjects');
    g.searchParams.set('cd','1');
    g.searchParams.set('next', hub);

    const keep = ['run','diff','time','seed','pid','view','ai','debug','api','log','studyId','phase','conditionGroup','grade','boss'];
    keep.forEach(k=>{
      const v = base.searchParams.get(k);
      if(v !== null && v !== '') g.searchParams.set(k, v);
    });
    g.searchParams.set('hub', hub);

    location.href = g.toString();
  }

  function replay(){ location.reload(); }

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
      const tips = summaryAdviceA(bd, comboBest, bossPenalty);

      const verdict =
        score >= 320 ? 'ยอดเยี่ยม! เลือกจุดได้คุ้มมาก' :
        score >= 220 ? 'ดีมาก! เริ่มเลือกจุดได้แม่นขึ้น' :
        'โอเค! รอบหน้าลองเลือกจุดเสี่ยงสูงก่อน';

      body.innerHTML = `
        <div class="sumStars">${starText(score)}</div>
        <div style="margin-top:6px;font-weight:1000;font-size:15px">${verdict}</div>
        <div style="margin-top:4px;opacity:.9">คะแนนรวม <b>${fmt(score)}</b></div>

        <div class="sumGrid">
          <div class="sumBox">
            <div class="sumBoxTitle">ลดความเสี่ยง</div>
            <div class="sumBoxVal">${fmt(bd.rrTotal)}</div>
          </div>
          <div class="sumBox">
            <div class="sumBoxTitle">ความครอบคลุม</div>
            <div class="sumBoxVal">${fmt(bd.coverage)}%</div>
          </div>
          <div class="sumBox">
            <div class="sumBoxTitle">ตัดสินใจคุ้ม</div>
            <div class="sumBoxVal">${fmt(bd.dq)}%</div>
          </div>
          <div class="sumBox">
            <div class="sumBoxTitle">คอมโบสูงสุด</div>
            <div class="sumBoxVal">${fmt(comboBest)}</div>
          </div>
        </div>

        <div class="sumTips">
          <b>โดนหัก:</b> Boss Penalty <b>-${fmt(bossPenalty)}</b><br/>
          <b>เหตุผลที่เลือก:</b><br/>
          ${reasons.length ? reasons.map(r=>`• ${escapeHtml(r.reasonText || r.id)}`).join('<br/>') : '• —'}
        </div>

        <div class="sumTips">
          <b>รอบหน้าลองแบบนี้:</b><br/>
          ${tips.map(t=>`• ${escapeHtml(t)}`).join('<br/>')}
        </div>
      `;
    }else{
      const bd = (m.metrics && m.metrics.breakdown) ? m.metrics.breakdown : {};
      const routeIds = (m.metrics && m.metrics.routeIds) ? m.metrics.routeIds : [];
      const bossPenalty = Number(bd?.bossPenalty || 0);
      const tips = summaryAdviceB(bd, bossPenalty);

      const verdict =
        score >= 260 ? 'ยอดเยี่ยม! วางแผน route ได้คุ้มมาก' :
        score >= 180 ? 'ดีมาก! แผนเริ่มสมดุลขึ้น' :
        'โอเค! ลองจัด route ให้ครอบคลุมและไม่อ้อม';

      body.innerHTML = `
        <div class="sumStars">${starText(score)}</div>
        <div style="margin-top:6px;font-weight:1000;font-size:15px">${verdict}</div>
        <div style="margin-top:4px;opacity:.9">คะแนนรวม <b>${fmt(score)}</b></div>

        <div class="sumGrid">
          <div class="sumBox">
            <div class="sumBoxTitle">Coverage</div>
            <div class="sumBoxVal">${fmt(bd.coverageB)}%</div>
          </div>
          <div class="sumBox">
            <div class="sumBoxTitle">Balance</div>
            <div class="sumBoxVal">${fmt(bd.balanceScore)}%</div>
          </div>
          <div class="sumBox">
            <div class="sumBoxTitle">Remain</div>
            <div class="sumBoxVal">${fmt(bd.remainScore)}%</div>
          </div>
          <div class="sumBox">
            <div class="sumBoxTitle">Boss Penalty</div>
            <div class="sumBoxVal">-${fmt(bossPenalty)}</div>
          </div>
        </div>

        <div class="sumTips">
          <b>Route ที่ส่ง:</b><br/>
          ${routeIds.length ? routeIds.map(x=>escapeHtml(String(x))).join(' → ') : '—'}
        </div>

        <div class="sumTips">
          <b>รอบหน้าลองแบบนี้:</b><br/>
          ${tips.map(t=>`• ${escapeHtml(t)}`).join('<br/>')}
        </div>
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

    if(best && bestD <= (120*120)){
      const id = best.dataset.id;
      if(id) opts.toggleRouteB && opts.toggleRouteB(id);
    }
  }
  window.addEventListener('hha:shoot', handleShoot);

  routePanel.querySelector('#btnUndo').onclick = ()=> opts.undoB && opts.undoB();
  routePanel.querySelector('#btnClear').onclick = ()=> opts.clearB && opts.clearB();
  routePanel.querySelector('#btnSubmit').onclick = ()=> opts.submitB && opts.submitB();

  function setDanger(on){
    dangerOn = !!on;
    root.classList.toggle('danger', dangerOn);
    const boardEl = root.querySelector('.board');
    if(boardEl) boardEl.classList.toggle('dangerBoard', !!on);
    if(dangerOn){
      try{ if(navigator.vibrate) navigator.vibrate([40,40,40]); }catch(e){}
    }
  }
  window.addEventListener('clean:danger', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    if(d && d.danger) setDanger(true);
  });

  const tutorialSteps = [
    {
      title: 'วิธีเล่น — Step 1',
      text: '🎯 เป้าหมาย: เลือก “จุดที่เสี่ยงที่สุด” ให้คุ้มที่สุดภายใต้งบจำกัด',
      hint: 'โหมด A มี Sprays จำกัด • โหมด B มีจำนวนจุดใน route จำกัด'
    },
    {
      title: 'วิธีเล่น — Step 2',
      text: '🗺️ ให้แตะ marker บนแผนที่ เช่น 🚪 ลูกบิด • 🤝 ของใช้ร่วม • 💧 ก๊อกน้ำ',
      hint: 'ตัวเลขบน marker = ระดับความเสี่ยง ยิ่งมากยิ่งน่าทำก่อน'
    },
    {
      title: 'วิธีเล่น — Step 3',
      text: '⭐ เลือกเหตุผลก่อนกด เช่น “เสี่ยงสูง” หรือ “สัมผัสบ่อย”',
      hint: 'เริ่มจากของใช้ร่วม/ลูกบิด/ก๊อกน้ำ มักคุ้มที่สุด'
    },
    {
      title: 'วิธีเล่น — Step 4',
      text: '⚠️ ช่วงท้ายจะมี Danger / Contamination / Boss ต้องรีบจัดการจุดสำคัญ',
      hint: 'ถ้ามี AI หรือ Quick Pick ให้ดูจุดที่เรืองแสงเป็นพิเศษ'
    }
  ];

  function renderTutorial(){
    const st = tutorialSteps[tutorialStep] || tutorialSteps[0];
    tutorialTitle.textContent = st.title;
    tutorialText.textContent = st.text;
    tutorialHint.textContent = st.hint;
    btnTutorialPrev.disabled = (tutorialStep === 0);
    btnTutorialNext.textContent = (tutorialStep === tutorialSteps.length - 1) ? 'เริ่มเล่น' : 'ถัดไป';
  }

  function openTutorial(){
    tutorial.style.display = '';
    tutorialStep = 0;
    renderTutorial();
  }

  function closeTutorial(){
    tutorial.style.display = 'none';
    if(tutorialNoMore && tutorialNoMore.checked){
      try{ localStorage.setItem(tutorialHideKey, '1'); }catch(e){}
    }
  }

  btnHowTo?.addEventListener('click', openTutorial);
  btnTutorialSkip?.addEventListener('click', closeTutorial);
  btnTutorialPrev?.addEventListener('click', ()=>{
    tutorialStep = Math.max(0, tutorialStep - 1);
    renderTutorial();
  });
  btnTutorialNext?.addEventListener('click', ()=>{
    if(tutorialStep >= tutorialSteps.length - 1){
      closeTutorial();
      return;
    }
    tutorialStep = Math.min(tutorialSteps.length - 1, tutorialStep + 1);
    renderTutorial();
  });

  function onState(S){
    lastState = S;
    try{ bossId = String((S.cfg && S.cfg.bossId) ? S.cfg.bossId : bossId); }catch(e){}

    renderHud(S);
    updateProgressStars(S);
    renderMission(S);
    renderHeat(S);
    renderMarkers(S);
    renderRoutePanel(S);

    const v = normalizeView(qs('view',''));
    const ov = root.querySelector('#ovHint');
    if(ov){
      ov.style.display = S.ended ? 'none' : '';
      const s = ov.querySelector('.ovS');
      if(v === 'cvr') s.textContent = 'Cardboard: ยิงเพื่อเลือกจุด • หรือแตะจุดบนแผนที่ • อย่าลืมบอส!';
      else s.textContent = 'แตะ marker เพื่อเล่น • เลือกเหตุผลก่อน • อย่าลืมบอส! • ช่วงท้ายจะเร่ง';
    }

    if(!S.ended){
      if(S.mode === 'A'){
        root.querySelector('#coachText')?.replaceChildren(document.createTextNode('เลือกจุดเสี่ยงสูงก่อน เช่น ลูกบิด ของใช้ร่วม ก๊อกน้ำ'));
      }else{
        root.querySelector('#coachText')?.replaceChildren(document.createTextNode('วาง route ให้คุ้ม ครอบคลุม และอย่าลืมบอส'));
      }
    }

    const showReason = (S.mode === 'A');
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

    let mood = 'tip';
    if(msg.kind === 'contamination' || msg.kind === 'danger' || msg.kind === 'warn') mood = 'warn';
    else if(msg.kind === 'boss' || msg.kind === 'boss_warn' || msg.kind === 'boss_final') mood = 'boss';
    else if(msg.kind === 'combo' || msg.kind === 'good' || msg.kind === 'daily_clear') mood = 'good';

    if(msg.text){
      showCoach(msg.text, mood);
    }
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
    <div>• 🔥 Boss = <b>${escapeHtml(bossId)}</b> (ถ้าไม่ทำโดนหัก)</div>
    <div>• ⚠️ กลางเกมมีเหตุการณ์ปนเปื้อน 1 ครั้ง/รอบ</div>
    <div>• ⏱️ 10 วิท้ายจะ “เร่ง”</div>
  `;

  try{
    const hiddenToday = localStorage.getItem(tutorialHideKey) === '1';
    if(!hiddenToday && String(qs('run','play')) !== 'research'){
      setTimeout(()=> openTutorial(), 900);
    }
  }catch(e){}

  return { onState, onTick, onCoach, onSummary, highlight, highlightBoss, markQuickPick };
}