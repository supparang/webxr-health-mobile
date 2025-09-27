// Hygiene Heroes (TH) — multi mini-games in one canvas
const cvs = document.getElementById('game');
const ctx = cvs.getContext('2d');
const modeSel = document.getElementById('mode');
const btnStart = document.getElementById('btnStart');
const btnReset = document.getElementById('btnReset');
const btnAction = document.getElementById('btnAction');
const btnHint = document.getElementById('btnHint');
const guide = document.getElementById('guide');
const progressText = document.getElementById('progressText');
const timeText = document.getElementById('timeText');
const resultEl = document.getElementById('result');

const sfx = {
  click: document.getElementById('click'),
  success: document.getElementById('success'),
  error: document.getElementById('error'),
  win: document.getElementById('win')
};

let running = false;
let startedAt = 0;
let progress = 0; // 0..100
let timerId = null;

// Utils
function beep(a){ a.currentTime=0; a.play().catch(()=>{}); }
function now(){ return performance.now()/1000; }
function setProgress(p){ progress = Math.max(0, Math.min(100, Math.round(p))); progressText.textContent = progress + '%'; }
function formatTime(sec){ const m = Math.floor(sec/60), s = Math.floor(sec%60); return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'); }

// Drawing helpers
function clear(){ ctx.fillStyle = '#0f1a2e'; ctx.fillRect(0,0,cvs.width,cvs.height); }
function title(t){ ctx.fillStyle='#e6eefc'; ctx.font='bold 22px system-ui'; ctx.fillText(t, 20, 36); }
function sub(t){ ctx.fillStyle='#9fb3d9'; ctx.font='16px system-ui'; ctx.fillText(t, 20, 60); }
function badge(t, x, y, col='#1b2a41'){ ctx.fillStyle=col; roundRect(ctx, x, y, 160, 28, 12); ctx.fillStyle='#e6eefc'; ctx.font='bold 14px system-ui'; ctx.fillText(t, x+10, y+19); }
function roundRect(c, x,y,w,h,r){ c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath(); c.fill(); }
function button(x,y,w,h,t){ ctx.fillStyle='#23395b'; roundRect(ctx,x,y,w,h,12); ctx.fillStyle='#e6eefc'; ctx.font='bold 16px system-ui'; const tw=ctx.measureText(t).width; ctx.fillText(t, x+(w-tw)/2, y+h/2+6); return {x,y,w,h}; }
function hitRect(mx,my,r){ return mx>=r.x&&mx<=r.x+r.w&&my>=r.y&&my<=r.y+r.h; }

// Mini-game states
const games = {
  handwash: {
    steps: [
      'ฝ่ามือถูฝ่ามือ', 'หลังมือ', 'ซอกนิ้ว', 'หลังนิ้ว', 'รอบนิ้วหัวแม่มือ', 'ปลายนิ้ว/เล็บ', 'ถูรอบข้อมือ'
    ],
    done: 0,
    buttons: [],
    render(){
      clear(); title('ล้างมือ 7 ขั้นตอน'); sub('แตะตามลำดับให้ถูกต้อง (อย่างน้อย 20 วินาที)');
      // grid of steps
      const cols=3, w=200, h=48, gap=16, startX=40, startY=100;
      this.buttons = [];
      for (let i=0;i<this.steps.length;i++){
        const row = Math.floor(i/cols), col=i%cols;
        const x = startX + col*(w+gap), y = startY + row*(h+gap);
        const colr = i<this.done ? '#28c76f' : '#23395b';
        ctx.fillStyle=colr; roundRect(ctx,x,y,w,h,12);
        ctx.fillStyle='#e6eefc'; ctx.font='14px system-ui';
        ctx.fillText(`${i+1}. ${this.steps[i]}`, x+10, y+30);
        this.buttons.push({x,y,w,h,i});
      }
      badge(`ทำแล้ว: ${this.done}/7`, 520, 20, '#1b2a41');
      setProgress(Math.round((this.done/7)*100));
      if (this.done===7){ sub('สำเร็จ! ล้างมือครบทุกขั้นตอน'); }
    },
    click(mx,my){
      for (const b of this.buttons){
        if (hitRect(mx,my,b)){
          if (b.i===this.done){ this.done++; beep(sfx.success); if (this.done===7){ endGame('ล้างมือครบแล้ว! เก่งมาก 👍'); } }
          else { beep(sfx.error); }
          break;
        }
      }
    },
    start(){ this.done=0; setProgress(0); }
  },
  toothbrush: {
    zones: ['บนซ้าย','บนขวา','ล่างซ้าย','ล่างขวา','ด้านบดเคี้ยว'],
    brushed: {},
    timer: 120, // seconds
    render(){
      clear(); title('แปรงฟัน 2 นาที'); sub('ลากเมาส์/นิ้วปัดในโซนให้ครบ (รวม 2 นาที)');
      // Draw mouth zones
      const cx=360, cy=210, r=120;
      ctx.strokeStyle='#23395b'; ctx.lineWidth=8; ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
      // sectors
      const sectors = [
        {name:'บนซ้าย', a0:-Math.PI*0.1, a1:-Math.PI*0.9, key:'บนซ้าย'},
        {name:'บนขวา', a0:Math.PI*0.1, a1:Math.PI*0.9, key:'บนขวา'},
        {name:'ล่างซ้าย', a0:-Math.PI*1.9, a1:-Math.PI*1.1, key:'ล่างซ้าย'},
        {name:'ล่างขวา', a0:Math.PI*1.1, a1:Math.PI*1.9, key:'ล่างขวา'},
      ];
      ctx.lineWidth=1;
      sectors.forEach(sec=>{
        ctx.fillStyle = this.brushed[sec.key]? 'rgba(40,199,111,.45)' : 'rgba(121,168,255,.20)';
        ctx.beginPath();
        ctx.moveTo(cx,cy);
        ctx.arc(cx,cy,r,sec.a0,sec.a1, sec.a1<sec.a0);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle='#e6eefc'; ctx.font='12px system-ui';
        const ang=(sec.a0+sec.a1)/2; ctx.fillText(sec.name, cx+Math.cos(ang)*r*0.5-20, cy+Math.sin(ang)*r*0.5);
      });
      // chewing surface center
      ctx.fillStyle = this.brushed['ด้านบดเคี้ยว']? 'rgba(40,199,111,.45)' : 'rgba(121,168,255,.20)';
      ctx.beginPath(); ctx.arc(cx,cy,40,0,Math.PI*2); ctx.fill();
      badge(`เวลา: ${formatTime(this.timer)}`, 520, 20, '#1b2a41');
      const covered = Object.keys(this.brushed).length;
      setProgress(Math.round((covered/this.zones.length)*100));
      if (covered===this.zones.length && this.timer<=0){ endGame('แปรงฟันครบ 2 นาทีแล้ว เยี่ยมมาก! 🪥'); }
    },
    dragging:false,
    lastPos:null,
    pointer(e,down){
      const rect=cvs.getBoundingClientRect();
      const x=(e.touches? e.touches[0].clientX: e.clientX)-rect.left;
      const y=(e.touches? e.touches[0].clientY: e.clientY)-rect.top;
      if (down){ this.dragging=true; this.lastPos={x,y}; }
      else if (down===false){ this.dragging=false; this.lastPos=null; }
      else if (this.dragging){
        // mark zones if pointer inside
        function insideSector(px,py,cx,cy,r,a0,a1){
          const dx=px-cx, dy=py-cy; const d=Math.hypot(dx,dy);
          if (d>r || d<0) return false; let ang=Math.atan2(dy,dx);
          // normalize angles
          function norm(a){while(a<-Math.PI) a+=Math.PI*2; while(a>Math.PI) a-=Math.PI*2; return a;}
          a0=norm(a0); a1=norm(a1); ang=norm(ang);
          if (a0<a1) return ang>=a0 && ang<=a1; else return ang>=a0 || ang<=a1;
        }
        const cx=360, cy=210, r=120;
        const sectors=[
          {key:'บนซ้าย', a0:-Math.PI*0.1, a1:-Math.PI*0.9},
          {key:'บนขวา', a0:Math.PI*0.1, a1:Math.PI*0.9},
          {key:'ล่างซ้าย', a0:-Math.PI*1.9, a1:-Math.PI*1.1},
          {key:'ล่างขวา', a0:Math.PI*1.1, a1:Math.PI*1.9},
        ];
        sectors.forEach(s=>{ if (insideSector(x,y,cx,cy,r,s.a0,s.a1)) this.brushed[s.key]=true; });
        const dcenter = Math.hypot(x-360,y-210); if (dcenter<40) this.brushed['ด้านบดเคี้ยว']=true;
      }
    },
    tick(dt){
      if (!running) return;
      if (this.timer>0){ this.timer -= dt; if (this.timer<0) this.timer=0; }
    },
    start(){ this.brushed={}; this.timer=120; setProgress(0); }
  },
  mask: {
    // Drag-and-drop mask onto face. Then tap mistakes.
    maskRect:null, dragging:false, offset:{x:0,y:0},
    placed:false, mistakes:['จมูกโผล่','คางโผล่','หลวม'], found:{},
    render(){
      clear(); title('สวมหน้ากากให้ถูก'); sub('ลากหน้ากากให้ปิดจมูก-ปาก แล้วจิ้มจุดผิดพลาดให้ครบ');
      // face placeholder
      ctx.fillStyle='#23395b'; roundRect(ctx, 250,90,220,260,40);
      ctx.fillStyle='#9fb3d9'; ctx.font='bold 14px system-ui'; ctx.fillText('ใบหน้า', 325-20, 120);
      // mask
      if (!this.maskRect) this.maskRect = {x:290,y:180,w:140,h:80};
      ctx.fillStyle='#79a8ff'; roundRect(ctx, this.maskRect.x, this.maskRect.y, this.maskRect.w, this.maskRect.h, 18);
      ctx.fillStyle='#001'; ctx.font='12px system-ui'; ctx.fillText('หน้ากาก', this.maskRect.x+36, this.maskRect.y+45);
      // guidance
      const ok = this.placed = rectOverlap(this.maskRect, {x:270,y:170,w:180,h:120});
      badge(ok? 'วางถูกตำแหน่ง ✅':'ลากให้ปิดจมูก+ปาก', 520, 20, '#1b2a41');
      // mistakes dots
      if (ok){
        const dots = {
          'จมูกโผล่': {x:360,y:185},
          'คางโผล่': {x:360,y:255},
          'หลวม': {x:430,y:220}
        };
        Object.entries(dots).forEach(([k,p])=>{
          ctx.fillStyle = this.found[k]? '#28c76f' : '#ff6b6b';
          ctx.beginPath(); ctx.arc(p.x,p.y,10,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='#e6eefc'; ctx.font='12px system-ui'; ctx.fillText(k, p.x-20, p.y-14);
        });
        const got = Object.keys(this.found).length;
        setProgress(Math.round((got/this.mistakes.length)*100));
        if (got===this.mistakes.length){ endGame('สุดยอด! สวมหน้ากากถูกต้องแล้ว 😷'); }
      } else setProgress(0);
    },
    pointer(mx,my,down){
      if (down){
        if (pointInRect(mx,my,this.maskRect)){ this.dragging=true; this.offset={x:mx-this.maskRect.x, y:my-this.maskRect.y}; }
      } else if (down===false){ this.dragging=false; }
      else if (this.dragging){ this.maskRect.x = mx-this.offset.x; this.maskRect.y = my-this.offset.y; }
      else if (this.placed){
        // tap mistakes
        const dots = {
          'จมูกโผล่': {x:360,y:185},
          'คางโผล่': {x:360,y:255},
          'หลวม': {x:430,y:220}
        };
        for (const [k,p] of Object.entries(dots)){
          if (Math.hypot(mx-p.x,my-p.y)<=12) { this.found[k]=true; beep(sfx.success); break; }
        }
      }
    },
    start(){ this.maskRect=null; this.dragging=false; this.placed=false; this.found={}; setProgress(0); }
  },
  cough: {
    // swipe elbow to cover + drag tissue to trash
    elbow:{x:220,y:240}, tissue:{x:500,y:120,w:80,h:50}, trash:{x:560,y:320,w:80,h:70}, covered:false, thrown:false,
    draggingT:false, offset:{x:0,y:0},
    render(){
      clear(); title('ไอจามถูกวิธี'); sub('ลากศอกมาบังปาก แล้วทิ้งกระดาษลงถัง');
      // draw person
      ctx.fillStyle='#23395b'; roundRect(ctx, 260,120,180,220,20); // head/torso
      ctx.fillStyle='#9fb3d9'; ctx.fillText('ปาก', 330, 180);
      // elbow
      ctx.fillStyle = this.covered? '#28c76f' : '#ffd166';
      roundRect(ctx, this.elbow.x, this.elbow.y, 90,40,16);
      ctx.fillStyle='#001'; ctx.fillText('ศอก', this.elbow.x+28, this.elbow.y+26);
      // mouth position
      const mouth = {x:330,y:200,w:40,h:20};
      const ok = rectOverlap({x:this.elbow.x,y:this.elbow.y,w:90,h:40}, mouth);
      if (ok) this.covered=true;
      // tissue + trash
      ctx.fillStyle='#e6eefc'; roundRect(ctx, this.tissue.x, this.tissue.y, this.tissue.w, this.tissue.h, 8);
      ctx.fillStyle='#001'; ctx.fillText('กระดาษ', this.tissue.x+14, this.tissue.y+30);
      ctx.fillStyle='#3b5b85'; roundRect(ctx, this.trash.x, this.trash.y, this.trash.w, this.trash.h, 10);
      ctx.fillStyle='#e6eefc'; ctx.fillText('ถังขยะ', this.trash.x+16, this.trash.y+40);
      // progress
      let p=0; if (this.covered) p+=50; if (this.thrown) p+=50; setProgress(p);
      if (this.covered && this.thrown){ endGame('เยี่ยม! ปิดปากเวลาไอ และทิ้งกระดาษแล้ว ♻️'); }
    },
    pointer(mx,my,down){
      if (down){
        if (pointInRect(mx,my,{x:this.tissue.x,y:this.tissue.y,w:this.tissue.w,h:this.tissue.h})){ this.draggingT=true; this.offset={x:mx-this.tissue.x, y:my-this.tissue.y}; }
        else if (pointInRect(mx,my,{x:this.elbow.x,y:this.elbow.y,w:90,h:40})){ this.elbow.x=mx-45; this.elbow.y=my-20; }
      } else if (down===false){ this.draggingT=false; }
      else {
        if (this.draggingT){ this.tissue.x = mx-this.offset.x; this.tissue.y = my-this.offset.y; if (rectOverlap({x:this.tissue.x,y:this.tissue.y,w:this.tissue.w,h:this.tissue.h}, this.trash)){ this.thrown=true; beep(sfx.success); } }
      }
    },
    start(){ this.elbow={x:220,y:240}; this.tissue={x:500,y:120,w:80,h:50}; this.trash={x:560,y:320,w:80,h:70}; this.covered=false; this.thrown=false; this.draggingT=false; setProgress(0); }
  }
};

function rectOverlap(a,b){ return !(a.x+a.w<b.x || a.x>b.x+b.w || a.y+a.h<b.y || a.y>b.y+b.h); }
function pointInRect(px,py,r){ return px>=r.x && px<=r.x+r.w && py>=r.y && py<=r.y+r.h; }

let active = games.handwash;

function loop(){
  if (running){
    const t = now();
    const dt = t - _last; _last = t;
    // timers
    if (active.tick) active.tick(dt);
    timeText.textContent = formatTime(t - startedAt);
  }
  active.render();
  requestAnimationFrame(loop);
}
let _last = now(); loop();

// Input
cvs.addEventListener('mousedown', e=> handlePointer(e,true));
cvs.addEventListener('mouseup', e=> handlePointer(e,false));
cvs.addEventListener('mousemove', e=> handlePointer(e,null));
cvs.addEventListener('touchstart', e=> handlePointer(e,true), {passive:false});
cvs.addEventListener('touchend', e=> handlePointer(e,false));
cvs.addEventListener('touchmove', e=> { handlePointer(e,null); e.preventDefault(); }, {passive:false});

function handlePointer(e,down){
  const rect=cvs.getBoundingClientRect();
  const x=(e.touches? e.touches[0].clientX: e.clientX)-rect.left;
  const y=(e.touches? e.touches[0].clientY: e.clientY)-rect.top;
  if (active.pointer) active.pointer(x,y,down);
  if (down===true) beep(sfx.click);
  else if (down===false) {} // up
}

btnStart.addEventListener('click', ()=>{
  running = true; startedAt = now(); _last = now();
  if (active.start) active.start();
  resultEl.textContent='';
  guide.textContent='ทำตามคำสั่งในมินิเกมให้สำเร็จ';
});
btnReset.addEventListener('click', ()=>{
  running = false; if (active.start) active.start(); setProgress(0); timeText.textContent='00:00'; resultEl.textContent='';
  guide.textContent='กด "เริ่ม" แล้วทำตามคำสั่งบนจอ';
});
btnAction.addEventListener('click', ()=>{
  const m = modeSel.value;
  const tips = {
    handwash: 'เคล็ดลับ: ร้องเพลงแฮปปี้เบิร์ธเดย์ 2 รอบ ใช้เวลา ~20 วินาที',
    toothbrush: 'เคล็ดลับ: ปัดแปรงเป็นวงเล็ก ๆ ครอบคลุมทุกซี่ 2 นาที',
    mask: 'เคล็ดลับ: หน้ากากต้องปิดจมูกและปากแนบสนิท',
    cough: 'เคล็ดลับ: ไอจามให้ใช้ข้อพับแขนบังปาก และทิ้งกระดาษลงถัง'
  };
  guide.textContent = tips[m] || 'ทำตามขั้นตอนบนจอ';
});
btnHint.addEventListener('click', ()=>{
  const m = modeSel.value;
  if (m==='handwash'){ guide.textContent='แตะปุ่มตามลำดับ 1→7'; }
  if (m==='toothbrush'){ guide.textContent='ลากแปรงให้โดนแต่ละโซน + ตรงกลาง'; }
  if (m==='mask'){ guide.textContent='ลากหน้ากากมาบนใบหน้าให้พอดี แล้วจิ้มจุดผิด: จมูก/คาง/หลวม'; }
  if (m==='cough'){ guide.textContent='ลากศอกมาปิดปาก แล้วลากกระดาษไปทิ้งถัง'; }
});

modeSel.addEventListener('change', ()=>{
  const key = modeSel.value;
  active = games[key];
  if (active.start) active.start();
  resultEl.textContent=''; setProgress(0); timeText.textContent='00:00';
});

// Win / End
function endGame(msg){
  running=false; resultEl.textContent = msg;
  beep(sfx.win);
}
