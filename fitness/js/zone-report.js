// === /fitness/js/zone-report.js ===
// Build per-zone report from EventLogger logs, and render to Result view.
// Zones: 6 zones (2 rows x 3 cols): Z1..Z6
'use strict';

const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

function safeNum(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function computeZoneReport(eventLogs){
  const zones = Array.from({length:6}, (_,i)=>({
    id: i,
    hits: 0,
    miss: 0,
    rtSum: 0,
    rtCount: 0,
    perfect: 0,
    good: 0,
    bad: 0,
    bomb: 0,
    decoy: 0,
    heal: 0,
    shield: 0,
    bossface: 0
  }));

  if (!Array.isArray(eventLogs)) return { zones, worstZoneId: 0 };

  for (const r of eventLogs){
    const z = safeNum(r.zone_id);
    if (z == null) continue;
    const zi = clamp(Math.floor(z), 0, 5);
    const Z = zones[zi];

    const ev = (r.event_type || '').toLowerCase();
    const ttype = (r.target_type || '').toLowerCase();
    const grade = (r.grade || '').toLowerCase();
    const rt = safeNum(r.rt_ms);

    if (ev === 'hit'){
      Z.hits++;
      if (rt != null){ Z.rtSum += rt; Z.rtCount++; }
      if (grade === 'perfect') Z.perfect++;
      else if (grade === 'good') Z.good++;
      else if (grade === 'bad') Z.bad++;
      else if (grade === 'bomb') Z.bomb++;

      if (ttype === 'decoy') Z.decoy++;
      if (ttype === 'bomb') Z.bomb++;
      if (ttype === 'heal') Z.heal++;
      if (ttype === 'shield') Z.shield++;
      if (ttype === 'bossface') Z.bossface++;

    } else if (ev === 'timeout'){
      // นับ miss เฉพาะเป้าจริง (normal/bossface) ตาม logic engine
      if (ttype === 'normal' || ttype === 'bossface'){
        Z.miss++;
      }
    }
  }

  // choose worst zone: weighted by miss rate + slow rt
  let worstZoneId = 0;
  let bestScore = -1;
  for (const Z of zones){
    const trials = Z.hits + Z.miss;
    const missRate = trials ? (Z.miss / trials) : 0;
    const avgRt = Z.rtCount ? (Z.rtSum / Z.rtCount) : 360;
    const rtN = clamp(avgRt / 900, 0, 1);
    const score = 0.62*missRate + 0.38*rtN;
    if (score > bestScore){
      bestScore = score;
      worstZoneId = Z.id;
    }
  }

  return { zones, worstZoneId };
}

function pct(n){
  return (n*100).toFixed(0) + '%';
}

export function renderZoneReport({
  mountEl,
  zones,
  worstZoneId,
  title = 'Zone Report (Z1–Z6)',
  subtitle = 'วิเคราะห์ความยากตามตำแหน่งเป้า: Hit/Miss/RT',
}){
  if (!mountEl || !zones || !zones.length) return;

  // remove old
  const old = mountEl.querySelector('.sb-zone-report');
  if (old) old.remove();

  const wrap = document.createElement('section');
  wrap.className = 'sb-zone-report';

  const head = document.createElement('div');
  head.className = 'sb-zone-head';
  head.innerHTML = `
    <div class="sb-zone-title">${title}</div>
    <div class="sb-zone-sub">${subtitle}</div>
  `;

  const grid = document.createElement('div');
  grid.className = 'sb-zone-grid';

  // compute max trials for heat intensity
  let maxTrials = 1;
  for (const Z of zones){
    const trials = Z.hits + Z.miss;
    if (trials > maxTrials) maxTrials = trials;
  }

  for (const Z of zones){
    const trials = Z.hits + Z.miss;
    const missRate = trials ? (Z.miss / trials) : 0;
    const avgRt = Z.rtCount ? (Z.rtSum / Z.rtCount) : null;

    // heat: based on miss rate + rt + density
    const dens = clamp(trials / maxTrials, 0, 1);
    const heat = clamp(0.62*missRate + 0.22*(avgRt ? clamp(avgRt/900,0,1) : 0.3) + 0.16*dens, 0, 1);

    const card = document.createElement('div');
    card.className = 'sb-zone-card';
    if (Z.id === worstZoneId) card.classList.add('is-worst');
    card.style.setProperty('--heat', heat.toFixed(3));

    const acc = trials ? (Z.hits / trials) : 0;

    card.innerHTML = `
      <div class="sb-zone-top">
        <div class="sb-zone-label">Z${Z.id+1}</div>
        <div class="sb-zone-chip">${Z.id===worstZoneId ? '⚠ จุดอ่อน' : 'OK'}</div>
      </div>
      <div class="sb-zone-metrics">
        <div><span>Trials</span><strong>${trials}</strong></div>
        <div><span>Hit</span><strong>${Z.hits}</strong></div>
        <div><span>Miss</span><strong>${Z.miss}</strong></div>
        <div><span>Acc</span><strong>${pct(acc)}</strong></div>
        <div><span>Avg RT</span><strong>${avgRt!=null ? avgRt.toFixed(0)+' ms' : '-'}</strong></div>
      </div>
      <div class="sb-zone-mini">
        <span>Perfect ${Z.perfect}</span>
        <span>Good ${Z.good}</span>
        <span>Bad ${Z.bad}</span>
      </div>
    `;

    grid.appendChild(card);
  }

  wrap.appendChild(head);
  wrap.appendChild(grid);

  mountEl.appendChild(wrap);
}