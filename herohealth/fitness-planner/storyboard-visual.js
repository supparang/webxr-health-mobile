// === /herohealth/fitness-planner/storyboard-visual.js ===
// Export Visual Storyboard as SVG + PNG (local-only, no libs)

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
  if(attrs){
    for(const k in attrs) el.setAttribute(k, String(attrs[k]));
  }
  return el;
}

function wrapTextLines(text, maxChars){
  // simple char wrap (Thai/EN OK-ish). Keeps readability for report.
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

function addTextBlock(g, x, y, text, opts){
  const o = Object.assign({
    fontSize: 12,
    lineH: 16,
    maxChars: 28,
    weight: 700,
    opacity: 0.92
  }, opts||{});

  const lines = wrapTextLines(text, o.maxChars);
  let yy = y;
  for(const ln of lines){
    const t = svgEl('text', {
      x, y: yy,
      'font-family': "system-ui, -apple-system, 'Noto Sans Thai', sans-serif",
      'font-size': o.fontSize,
      'font-weight': o.weight,
      'fill': 'rgba(255,255,255,0.94)',
      'opacity': o.opacity
    });
    t.textContent = ln;
    g.appendChild(t);
    yy += o.lineH;
  }
  return yy;
}

function addBox(svg, box){
  const g = svgEl('g');
  const r = svgEl('rect', {
    x: box.x, y: box.y,
    width: box.w, height: box.h,
    rx: 18, ry: 18,
    fill: 'rgba(15,23,42,0.88)',
    stroke: 'rgba(255,255,255,0.16)',
    'stroke-width': 1.2
  });
  g.appendChild(r);

  // header stripe
  const hdr = svgEl('rect', {
    x: box.x, y: box.y,
    width: box.w, height: 34,
    rx: 18, ry: 18,
    fill: 'rgba(0,0,0,0.20)',
    stroke: 'none'
  });
  g.appendChild(hdr);

  // title
  const title = svgEl('text', {
    x: box.x + 14,
    y: box.y + 22,
    'font-family': "system-ui, -apple-system, 'Noto Sans Thai', sans-serif",
    'font-size': 14,
    'font-weight': 900,
    'fill': 'rgba(255,255,255,0.96)'
  });
  title.textContent = box.title;
  g.appendChild(title);

  // small tags
  const tag = svgEl('text', {
    x: box.x + box.w - 14,
    y: box.y + 22,
    'text-anchor': 'end',
    'font-family': "system-ui, -apple-system, 'Noto Sans Thai', sans-serif",
    'font-size': 11,
    'font-weight': 800,
    'fill': 'rgba(255,255,255,0.78)'
  });
  tag.textContent = box.tag || '';
  g.appendChild(tag);

  // bullets
  let yy = box.y + 54;
  const padX = box.x + 14;

  yy = addTextBlock(g, padX, yy, `Entry: ${box.entry}`, { fontSize: 11, weight: 700, opacity: 0.88, maxChars: 44, lineH: 15 });
  yy += 2;
  yy = addTextBlock(g, padX, yy, `Action: ${box.action}`, { fontSize: 11, weight: 700, opacity: 0.88, maxChars: 44, lineH: 15 });
  yy += 2;
  yy = addTextBlock(g, padX, yy, `Feedback: ${box.feedback}`, { fontSize: 11, weight: 700, opacity: 0.85, maxChars: 44, lineH: 15 });

  svg.appendChild(g);
}

function addArrow(svg, ax, ay, bx, by){
  // simple curved arrow
  const mx = (ax + bx)/2;
  const my = (ay + by)/2;
  const dx = bx - ax;
  const curve = Math.max(40, Math.min(140, Math.abs(dx)*0.25));
  const c1x = mx;
  const c1y = ay + curve;
  const c2x = mx;
  const c2y = by - curve;

  const p = svgEl('path', {
    d: `M ${ax} ${ay} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${bx} ${by}`,
    fill: 'none',
    stroke: 'rgba(255,255,255,0.22)',
    'stroke-width': 2
  });
  svg.appendChild(p);

  // arrow head
  const ang = Math.atan2(by - c2y, bx - c2x);
  const L = 10;
  const a1 = ang + Math.PI*0.85;
  const a2 = ang - Math.PI*0.85;

  const x1 = bx + Math.cos(a1)*L;
  const y1 = by + Math.sin(a1)*L;
  const x2 = bx + Math.cos(a2)*L;
  const y2 = by + Math.sin(a2)*L;

  const head = svgEl('path', {
    d: `M ${bx} ${by} L ${x1} ${y1} M ${bx} ${by} L ${x2} ${y2}`,
    fill: 'none',
    stroke: 'rgba(255,255,255,0.28)',
    'stroke-width': 2,
    'stroke-linecap': 'round'
  });
  svg.appendChild(head);
}

function makeStoryboardBoxes(ctx){
  const order = (safeStr(ctx.orderSeq) || 'shadow>rhythm>jumpduck>balance').split('>').filter(Boolean);

  // helpers
  const GAME = {
    shadow:   { title:'Shadow Breaker', tag:'Bloom: Apply→Analyze', entry:'เริ่มด่านยิง/เล็ง', action:'เล็ง+แตะเป้า / หลีกเลี่ยง decoy', feedback:'Perfect/Combo + Coach tip + RT/Acc log' },
    rhythm:   { title:'Rhythm Boxer',   tag:'Bloom: Apply→Evaluate', entry:'เริ่มด่านจังหวะ', action:'กดให้ตรง hit line (มี Cal ms)', feedback:'Perfect/Good/Miss + timing log' },
    jumpduck: { title:'Jump-Duck',      tag:'Bloom: Apply→Analyze', entry:'เริ่มด่านหลบ', action:'jump/duck ตามชุด obstacle', feedback:'streak/miss + pattern log' },
    balance:  { title:'Balance Hold',   tag:'Bloom: Apply→Evaluate', entry:'เริ่มด่านทรงตัว', action:'คุม indicator + หลบ obstacle', feedback:'stability% + coach tip + log' },
    boss:     { title:'Boss Battle',    tag:'Bloom: Analyze→Evaluate', entry:'แจ้งเตือน boss', action:'อ่าน telegraph + เลือกจังหวะปลอดภัย', feedback:'CLEAR/FAIL + boss summary log' }
  };

  const blocks = [];
  blocks.push({ id:'consent', title:'Consent', tag:'Ethics/Safety', entry:'ครั้งแรกของวัน', action:'ติ๊กยืนยัน (ครู+เด็ก) แล้วเริ่ม', feedback:'บันทึก consent_ok' });
  blocks.push({ id:'attn', title:'Attention 10s', tag:'Quality Gate', entry:'research หรือ attn=1', action:'แตะ ⭐ เท่านั้น 10s', feedback:'attention_passed + rt/false taps' });
  blocks.push({ id:'warmup', title:'Warmup', tag:'Safety', entry:'ก่อนเกมแรก', action:'ฝึกสั้น 8–15s', feedback:'warmup_done/skip' });

  for(const k of order){
    blocks.push(Object.assign({ id:k }, (GAME[k]||{ title:k, tag:'', entry:'', action:'', feedback:'' })));
  }

  blocks.push({ id:'cooldown', title:'Cooldown', tag:'Safety/Closure', entry:'หลังเกมสุดท้าย', action:'ยืดเหยียด/หายใจ 8–15s', feedback:'cooldown_done' });
  blocks.push({ id:'dashboard', title:'End Dashboard', tag:'Teacher', entry:'จบวัน', action:'สรุป + Export RAW/ANALYSIS', feedback:'badge/streak + export pack' });

  // if play mode (ไม่วิจัย) อาจไม่ต้อง attn — แต่เรายังโชว์ไว้ (tag จะช่วยอธิบายในรายงาน)
  return blocks;
}

export function buildStoryboardSVG(ctx){
  const c = Object.assign({
    pid:'anon', run:'play', diff:'normal', time:80, seed:'0',
    orderSeq:'shadow>rhythm>jumpduck>balance'
  }, ctx||{});

  const blocks = makeStoryboardBoxes(c);

  // layout grid
  const cols = 3;
  const boxW = 430;
  const boxH = 170;
  const gapX = 22;
  const gapY = 22;
  const pad = 26;

  const rows = Math.ceil(blocks.length / cols);
  const W = pad*2 + cols*boxW + (cols-1)*gapX;
  const H = pad*2 + rows*boxH + (rows-1)*gapY + 46;

  const svg = svgEl('svg', { xmlns:'http://www.w3.org/2000/svg', width:W, height:H, viewBox:`0 0 ${W} ${H}` });

  // background
  const bg = svgEl('rect', { x:0, y:0, width:W, height:H, fill:'rgba(2,6,23,1)' });
  svg.appendChild(bg);

  // title header
  const head = svgEl('text', {
    x: pad, y: pad,
    'font-family': "system-ui, -apple-system, 'Noto Sans Thai', sans-serif",
    'font-size': 18,
    'font-weight': 900,
    'fill': 'rgba(255,255,255,0.96)'
  });
  head.textContent = `HeroHealth Fitness — Visual Storyboard (${todayKey()})`;
  svg.appendChild(head);

  const sub = svgEl('text', {
    x: pad, y: pad + 22,
    'font-family': "system-ui, -apple-system, 'Noto Sans Thai', sans-serif",
    'font-size': 12,
    'font-weight': 800,
    'fill': 'rgba(255,255,255,0.75)'
  });
  sub.textContent = `pid=${safeStr(c.pid)} | run=${safeStr(c.run)} | diff=${safeStr(c.diff)} | time=${safeStr(c.time)}s | seed=${safeStr(c.seed)} | order=${safeStr(c.orderSeq)}`;
  svg.appendChild(sub);

  // compute box positions
  const boxes = blocks.map((b, i)=>{
    const r = Math.floor(i/cols);
    const col = i % cols;
    const x = pad + col*(boxW + gapX);
    const y = pad + 46 + r*(boxH + gapY);
    return Object.assign({}, b, { x, y, w: boxW, h: boxH });
  });

  // arrows between consecutive steps (snake row)
  for(let i=0;i<boxes.length-1;i++){
    const a = boxes[i];
    const b = boxes[i+1];

    const aCx = a.x + a.w/2;
    const aCy = a.y + a.h;
    const bCx = b.x + b.w/2;
    const bCy = b.y;

    // if same row: arrow from right edge to left edge
    const sameRow = Math.floor(i/cols) === Math.floor((i+1)/cols);
    if(sameRow){
      const ax = a.x + a.w;
      const ay = a.y + a.h/2;
      const bx = b.x;
      const by = b.y + b.h/2;
      addArrow(svg, ax, ay, bx, by);
    } else {
      // next row: drop down then go to next
      addArrow(svg, aCx, aCy, bCx, bCy);
    }
  }

  // boxes
  for(const b of boxes) addBox(svg, b);

  return { svg, width: W, height: H };
}

export function downloadStoryboardVisual(ctx){
  const pack = buildStoryboardSVG(ctx);
  const c = Object.assign({ pid:'anon' }, ctx||{});
  const base = `HHA_storyboard_visual_${todayKey()}_${safeStr(c.pid||'anon')}`;

  // SVG download
  const svgText = new XMLSerializer().serializeToString(pack.svg);
  dlBlob(`${base}.svg`, new Blob([svgText], {type:'image/svg+xml;charset=utf-8'}));

  // PNG download (render svg to canvas)
  const img = new Image();
  const svgBlob = new Blob([svgText], {type:'image/svg+xml;charset=utf-8'});
  const url = URL.createObjectURL(svgBlob);

  img.onload = ()=>{
    try{
      const canvas = document.createElement('canvas');
      canvas.width = pack.width * 2;   // 2x for crisp print
      canvas.height = pack.height * 2;
      const ctx2 = canvas.getContext('2d');
      ctx2.scale(2,2);
      ctx2.drawImage(img, 0, 0);

      canvas.toBlob((blob)=>{
        if(blob) dlBlob(`${base}.png`, blob);
        URL.revokeObjectURL(url);
      }, 'image/png');
    }catch(_){
      URL.revokeObjectURL(url);
    }
  };

  img.onerror = ()=> URL.revokeObjectURL(url);
  img.src = url;

  return true;
}