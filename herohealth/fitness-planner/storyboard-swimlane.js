// === /herohealth/fitness-planner/storyboard-swimlane.js ===
// Export Swimlane Storyboard (Student lane vs Teacher lane) as SVG + PNG

'use strict';

function todayKey(){
  const d=new Date();
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const da=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${da}`;
}
function safeStr(x){ return (x==null)?'':String(x); }

function dlBlob(filename, blob){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1500);
}

function svgEl(tag, attrs){
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  if(attrs){ for(const k in attrs) el.setAttribute(k, String(attrs[k])); }
  return el;
}

function wrapTextLines(text, maxChars){
  const s = safeStr(text).trim();
  if(!s) return [];
  const words = s.split(/\s+/);
  const lines = [];
  let cur = '';
  for(const w of words){
    if(!cur) cur = w;
    else if((cur + ' ' + w).length <= maxChars) cur += ' ' + w;
    else { lines.push(cur); cur = w; }
  }
  if(cur) lines.push(cur);
  return lines;
}

function addText(svg, x, y, text, opts){
  const o = Object.assign({
    size: 12,
    weight: 800,
    fill: 'rgba(255,255,255,0.94)',
    opacity: 1,
    anchor: 'start'
  }, opts||{});
  const t = svgEl('text', {
    x, y,
    'font-family': "system-ui, -apple-system, 'Noto Sans Thai', sans-serif",
    'font-size': o.size,
    'font-weight': o.weight,
    fill: o.fill,
    opacity: o.opacity,
    'text-anchor': o.anchor
  });
  t.textContent = text;
  svg.appendChild(t);
  return t;
}

function addTextBlock(g, x, y, text, opts){
  const o = Object.assign({ fontSize: 11, lineH: 15, maxChars: 26, weight: 700, opacity: 0.9 }, opts||{});
  const lines = wrapTextLines(text, o.maxChars);
  let yy = y;
  for(const ln of lines){
    const t = svgEl('text', {
      x, y: yy,
      'font-family': "system-ui, -apple-system, 'Noto Sans Thai', sans-serif",
      'font-size': o.fontSize,
      'font-weight': o.weight,
      fill: 'rgba(255,255,255,0.92)',
      opacity: o.opacity
    });
    t.textContent = ln;
    g.appendChild(t);
    yy += o.lineH;
  }
  return yy;
}

function addCard(svg, card){
  const g = svgEl('g');

  const r = svgEl('rect', {
    x: card.x, y: card.y,
    width: card.w, height: card.h,
    rx: 18, ry: 18,
    fill: 'rgba(15,23,42,0.88)',
    stroke: 'rgba(255,255,255,0.16)',
    'stroke-width': 1.2
  });
  g.appendChild(r);

  const hdr = svgEl('rect', {
    x: card.x, y: card.y,
    width: card.w, height: 30,
    rx: 18, ry: 18,
    fill: 'rgba(0,0,0,0.20)',
    stroke: 'none'
  });
  g.appendChild(hdr);

  const title = svgEl('text', {
    x: card.x + 12,
    y: card.y + 20,
    'font-family': "system-ui, -apple-system, 'Noto Sans Thai', sans-serif",
    'font-size': 13,
    'font-weight': 900,
    fill: 'rgba(255,255,255,0.96)'
  });
  title.textContent = card.title;
  g.appendChild(title);

  const tag = svgEl('text', {
    x: card.x + card.w - 12,
    y: card.y + 20,
    'text-anchor':'end',
    'font-family': "system-ui, -apple-system, 'Noto Sans Thai', sans-serif",
    'font-size': 11,
    'font-weight': 800,
    fill: 'rgba(255,255,255,0.75)'
  });
  tag.textContent = card.tag || '';
  g.appendChild(tag);

  let yy = card.y + 48;
  yy = addTextBlock(g, card.x+12, yy, `Action: ${card.action}`, { maxChars: 34, opacity: .9 });
  yy += 2;
  yy = addTextBlock(g, card.x+12, yy, `Feedback: ${card.feedback}`, { maxChars: 34, opacity: .85 });

  svg.appendChild(g);
}

function arrow(svg, x1, y1, x2, y2){
  const p = svgEl('path', {
    d: `M ${x1} ${y1} L ${x2} ${y2}`,
    stroke: 'rgba(255,255,255,0.22)',
    'stroke-width': 2,
    'stroke-linecap': 'round'
  });
  svg.appendChild(p);

  const ang = Math.atan2(y2-y1, x2-x1);
  const L = 10;
  const a1 = ang + Math.PI*0.85;
  const a2 = ang - Math.PI*0.85;
  const hx1 = x2 + Math.cos(a1)*L;
  const hy1 = y2 + Math.sin(a1)*L;
  const hx2 = x2 + Math.cos(a2)*L;
  const hy2 = y2 + Math.sin(a2)*L;

  const head = svgEl('path', {
    d: `M ${x2} ${y2} L ${hx1} ${hy1} M ${x2} ${y2} L ${hx2} ${hy2}`,
    stroke: 'rgba(255,255,255,0.28)',
    'stroke-width': 2,
    'stroke-linecap': 'round'
  });
  svg.appendChild(head);
}

function makeSwimlaneCards(ctx){
  const order = (safeStr(ctx.orderSeq) || 'shadow>rhythm>jumpduck>balance').split('>').filter(Boolean);

  const GAME = {
    shadow:   { title:'Shadow Breaker', tag:'Apply→Analyze', action:'เล็ง+แตะเป้า / หลีกเลี่ยง decoy', feedback:'score/combo/RT log + coach' },
    rhythm:   { title:'Rhythm Boxer',   tag:'Apply→Evaluate', action:'กดตาม hit line (Cal ms)', feedback:'timing log + streak' },
    jumpduck: { title:'Jump-Duck',      tag:'Apply→Analyze', action:'jump/duck หลบ obstacle', feedback:'streak/miss + pattern log' },
    balance:  { title:'Balance Hold',   tag:'Apply→Evaluate', action:'คุม indicator + หลบ', feedback:'stability% + coach + log' },
    boss:     { title:'Boss Battle',    tag:'Analyze→Evaluate', action:'อ่าน telegraph + เลือกจังหวะ', feedback:'CLEAR/FAIL + boss summary' }
  };

  // Student lane timeline (left->right)
  const student = [
    { id:'consent', title:'Consent', tag:'Safety', action:'ติ๊กยืนยันครู+เด็ก', feedback:'consent_ok saved' },
    { id:'attn', title:'Attention 10s', tag:'Quality', action:'แตะ ⭐ เท่านั้น', feedback:'attention_passed + rt' },
    { id:'warmup', title:'Warmup', tag:'Safety', action:'ฝึก 8–15s', feedback:'warmup_done' },
    ...order.map(k => Object.assign({ id:k }, GAME[k]||{ title:k, tag:'', action:'', feedback:'' })),
    { id:'cooldown', title:'Cooldown', tag:'Safety', action:'ยืดเหยียด/หายใจ', feedback:'cooldown_done' },
    { id:'end', title:'Finish Day', tag:'Badge', action:'จบวัน', feedback:'badge/streak + back' }
  ];

  // Teacher lane (support + monitoring)
  const teacher = [
    { id:'teacherbar', title:'Teacher Bar (PIN)', tag:'Control', action:'ตั้ง run/bossDay/attn/consent', feedback:'daily cfg saved' },
    { id:'monitor', title:'Monitor', tag:'Observe', action:'ดูความปลอดภัย/พัก', feedback:'fatigue flags help' },
    { id:'dashboard', title:'End Dashboard', tag:'Export', action:'สรุป + Export RAW/ANALYSIS', feedback:'packs for analysis' }
  ];

  // cross-lane interactions (arrows)
  const links = [
    { from:'teacherbar', to:'consent', note:'cfg affects gating/order' },
    { from:'monitor', to:'warmup', note:'safety readiness' },
    { from:'end', to:'dashboard', note:'teacher exports' },
  ];

  return { student, teacher, links };
}

export function buildSwimlaneSVG(ctx){
  const c = Object.assign({
    pid:'anon', run:'play', diff:'normal', time:80, seed:'0',
    orderSeq:'shadow>rhythm>jumpduck>balance'
  }, ctx||{});

  const lanes = makeSwimlaneCards(c);

  const pad = 26;
  const laneH = 260;
  const cardW = 260;
  const cardH = 118;
  const gapX = 18;
  const gapY = 26;

  const studentN = lanes.student.length;
  const teacherN = lanes.teacher.length;

  const W = pad*2 + Math.max(studentN, teacherN)*cardW + (Math.max(studentN, teacherN)-1)*gapX;
  const H = pad*2 + 46 + laneH*2 + gapY;

  const svg = svgEl('svg', { xmlns:'http://www.w3.org/2000/svg', width:W, height:H, viewBox:`0 0 ${W} ${H}` });

  svg.appendChild(svgEl('rect', { x:0, y:0, width:W, height:H, fill:'rgba(2,6,23,1)' }));

  addText(svg, pad, pad, `HeroHealth Fitness — Swimlane Storyboard (${todayKey()})`, { size:18, weight:900 });
  addText(svg, pad, pad+22, `pid=${safeStr(c.pid)} | run=${safeStr(c.run)} | diff=${safeStr(c.diff)} | time=${safeStr(c.time)}s | seed=${safeStr(c.seed)} | order=${safeStr(c.orderSeq)}`,
    { size:12, weight:800, fill:'rgba(255,255,255,0.75)' });

  // lane backgrounds
  const laneTopY = pad + 46;
  const studentY = laneTopY;
  const teacherY = laneTopY + laneH + gapY;

  svg.appendChild(svgEl('rect', { x:pad, y:studentY, width:W-pad*2, height:laneH, rx:20, ry:20, fill:'rgba(255,255,255,0.04)', stroke:'rgba(255,255,255,0.10)' }));
  svg.appendChild(svgEl('rect', { x:pad, y:teacherY, width:W-pad*2, height:laneH, rx:20, ry:20, fill:'rgba(255,255,255,0.03)', stroke:'rgba(255,255,255,0.10)' }));

  addText(svg, pad+14, studentY+26, 'STUDENT LANE', { size:12, weight:900, fill:'rgba(255,255,255,0.85)' });
  addText(svg, pad+14, teacherY+26, 'TEACHER LANE', { size:12, weight:900, fill:'rgba(255,255,255,0.85)' });

  // place cards
  const pos = {}; // id->center
  function place(list, laneY){
    list.forEach((it, i)=>{
      const x = pad + i*(cardW + gapX);
      const y = laneY + 44;
      addCard(svg, { x, y, w:cardW, h:cardH, title:it.title, tag:it.tag, action:it.action, feedback:it.feedback });
      pos[it.id] = { cx: x + cardW/2, cy: y + cardH/2, x, y };
    });

    // arrows within lane
    for(let i=0;i<list.length-1;i++){
      const a = list[i], b = list[i+1];
      const ax = pos[a.id].x + cardW;
      const ay = pos[a.id].cy;
      const bx = pos[b.id].x;
      const by = pos[b.id].cy;
      arrow(svg, ax, ay, bx, by);
    }
  }

  place(lanes.student, studentY);
  place(lanes.teacher, teacherY);

  // cross-lane arrows (teacher -> student / student -> teacher)
  for(const lk of lanes.links){
    const A = pos[lk.from];
    const B = pos[lk.to];
    if(!A || !B) continue;

    // start from A bottom (if teacher) or top (if student) to opposite
    const fromTeacher = (A.cy > B.cy);
    const x1 = A.cx;
    const y1 = fromTeacher ? (A.y) : (A.y + cardH);
    const x2 = B.cx;
    const y2 = fromTeacher ? (B.y + cardH) : (B.y);

    // draw polyline-like via 2 segments
    const midY = (y1 + y2)/2;
    arrow(svg, x1, y1, x1, midY);
    arrow(svg, x1, midY, x2, midY);
    arrow(svg, x2, midY, x2, y2);

    // note label
    const note = svgEl('text', {
      x: (x1+x2)/2,
      y: midY - 6,
      'text-anchor':'middle',
      'font-family': "system-ui, -apple-system, 'Noto Sans Thai', sans-serif",
      'font-size': 11,
      'font-weight': 800,
      fill: 'rgba(255,255,255,0.70)'
    });
    note.textContent = lk.note || '';
    svg.appendChild(note);
  }

  return { svg, width: W, height: H };
}

export function downloadSwimlaneStoryboard(ctx){
  const pack = buildSwimlaneSVG(ctx);
  const c = Object.assign({ pid:'anon' }, ctx||{});
  const base = `HHA_storyboard_swimlane_${todayKey()}_${safeStr(c.pid||'anon')}`;

  const svgText = new XMLSerializer().serializeToString(pack.svg);
  dlBlob(`${base}.svg`, new Blob([svgText], {type:'image/svg+xml;charset=utf-8'}));

  // PNG render
  const img = new Image();
  const svgBlob = new Blob([svgText], {type:'image/svg+xml;charset=utf-8'});
  const url = URL.createObjectURL(svgBlob);

  img.onload = ()=>{
    try{
      const canvas = document.createElement('canvas');
      canvas.width = pack.width * 2;
      canvas.height = pack.height * 2;
      const ctx2 = canvas.getContext('2d');
      ctx2.scale(2,2);
      ctx2.drawImage(img, 0, 0);
      canvas.toBlob((blob)=>{
        if(blob) dlBlob(`${base}.png`, blob);
        URL.revokeObjectURL(url);
      }, 'image/png');
    }catch(_){ URL.revokeObjectURL(url); }
  };
  img.onerror = ()=> URL.revokeObjectURL(url);
  img.src = url;

  return true;
}