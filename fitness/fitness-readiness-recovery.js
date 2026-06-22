// === /herohealth/gate/games/fitness/fitness-readiness-recovery.js ===
// FULL MODULE v20260622-FITNESS-READINESS-RECOVERY-COOLDOWN-ZERO-STUCK-V21
// Full replacement: Fitness Gate warmup/cooldown with MediaPipe Pose + preview canvas.
// The preview canvas draws camera frames directly, avoiding black <video> rendering
// in some Chrome/WebXR environments.

const PATCH = 'v20260622-FITNESS-READINESS-RECOVERY-COOLDOWN-ZERO-STUCK-V21';

const MP = {
  module: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs',
  wasm: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm',
  model: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'
};

const IDX = { NOSE:0, LS:11, RS:12, LE:13, RE:14, LW:15, RW:16, LH:23, RH:24, LK:25, RK:26, LA:27, RA:28 };

const GAME_META = {
  'shadow-breaker': { label:'Shadow Breaker', emoji:'🥊', warm:'Hero Ready • Punch Power', cool:'Hero Recovery • Arms & Shoulders' },
  'rhythm-boxer': { label:'Rhythm Boxer', emoji:'🎵', warm:'Hero Ready • Beat Control', cool:'Hero Recovery • Rhythm Reset' },
  'jump-duck': { label:'JumpDuck', emoji:'🦘', warm:'Hero Ready • Agility', cool:'Hero Recovery • Legs & Ankles' },
  'balance-hold': { label:'Balance Hold', emoji:'⚖️', warm:'Hero Ready • Stability', cool:'Hero Recovery • Calm Balance' }
};

function clean(v){ return String(v == null ? '' : v).trim(); }
function normGame(v){
  const x = clean(v).toLowerCase().replace(/[_\s]+/g,'-');
  if (x === 'shadowbreaker' || x === 'shadow') return 'shadow-breaker';
  if (x === 'rhythmboxer' || x === 'rhythm') return 'rhythm-boxer';
  if (x === 'jumpduck') return 'jump-duck';
  if (x === 'balancehold') return 'balance-hold';
  return GAME_META[x] ? x : 'shadow-breaker';
}
function clamp(n,a,b){ return Math.max(a,Math.min(b,Number(n)||0)); }
function esc(v){ return clean(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function p(l,i){ return l && l[i] ? l[i] : null; }
function vis(x){ const n=Number(x && (x.visibility != null ? x.visibility : x.presence)); return Number.isFinite(n)?n:0; }
function dist(a,b){ return a&&b ? Math.hypot(a.x-b.x,a.y-b.y) : 0; }
function mid(a,b){ return a&&b ? {x:(a.x+b.x)/2,y:(a.y+b.y)/2} : null; }
function avg(xs){ const a=xs.filter(Number.isFinite); return a.length?a.reduce((s,x)=>s+x,0)/a.length:0; }
function angle(a,b,c){
  if(!a||!b||!c) return 0;
  const abx=a.x-b.x, aby=a.y-b.y, cbx=c.x-b.x, cby=c.y-b.y;
  const d=Math.hypot(abx,aby)*Math.hypot(cbx,cby);
  return d ? Math.acos(clamp((abx*cbx+aby*cby)/d,-1,1))*180/Math.PI : 0;
}
function now(){ return performance.now(); }

function taskList(game, phase, duration){
  const scale=clamp(duration/60,.75,1.4);
  const reps=Math.max(5,Math.round(7*scale));
  const hold=clamp(3.5*scale,2.5,6);
  const safety={id:'safety',type:'safety',title:'Safety Scan',cue:'ยืนให้เห็นศีรษะ ไหล่ และสะโพกอยู่กลางกรอบ',target:1.2,unit:'วิ'};
  if(phase==='cooldown'){
    if(game==='rhythm-boxer') return [safety,{id:'reach',type:'reach',title:'Side Reach',cue:'ยกแขนเหนือไหล่แล้วเอียงตัวเบา ๆ สลับซ้าย–ขวา',target:2,unit:'ด้าน',hold},{id:'breath',type:'breath',title:'Slow Beat Breath',cue:'หายใจเข้า 3 จังหวะ ออก 4 จังหวะ',target:clamp(7*scale,5,10),unit:'วิ'}];
    if(game==='jump-duck') return [safety,{id:'stance',type:'stance',title:'Leg Recovery',cue:'ยืนมั่นคง ผ่อนหัวไหล่และเข่า',target:hold+1,unit:'วิ'},{id:'reach',type:'reach',title:'Side Stretch',cue:'ยืดลำตัวซ้าย–ขวาช้า ๆ',target:2,unit:'ด้าน',hold}];
    return [safety,{id:'shoulder',type:'shoulder',title:'Shoulder Reset',cue:'ผ่อนหัวไหล่ ขยับแขนเบา ๆ หรือกด “ทำท่าแล้ว”',target:1.5,unit:'วิ'},{id:'breath',type:'breath',title:'Calm Breath',cue:'หายใจช้า ๆ ตามวงแสง',target:clamp(7*scale,5,10),unit:'วิ'}];
  }
  if(game==='rhythm-boxer') return [safety,{id:'arms',type:'arms',title:'Activate Arms',cue:'เปิดแขนหรือยกมือสลับซ้าย–ขวา',target:reps,unit:'ครั้ง'},{id:'punch',type:'punch',title:'Beat Ready',cue:'ขยับมือซ้าย–ขวาสลับจังหวะอย่างนุ่มนวล ไม่ต้องเหยียดศอกสุด',target:reps+2,unit:'ครั้ง'}];
  if(game==='shadow-breaker') return [safety,{id:'arms',type:'arms',title:'Activate Arms',cue:'เปิดแขนสลับซ้าย–ขวา',target:reps,unit:'ครั้ง'},{id:'punch',type:'punch',title:'Punch Ready',cue:'ยกการ์ดแล้วชกช้า ๆ สลับแขน',target:reps,unit:'ครั้ง'}];
  if(game==='jump-duck') return [safety,{id:'march',type:'march',title:'Activate Legs',cue:'ยกเข่าหรือย่ำเท้าสลับเบา ๆ',target:reps,unit:'ครั้ง'},{id:'duck',type:'duck',title:'Duck Ready',cue:'ย่อเข่าเล็กน้อยแล้วกลับขึ้นตรง',target:Math.max(3,Math.round(4*scale)),unit:'ครั้ง'}];
  return [safety,{id:'shift',type:'shift',title:'Balance Ready',cue:'ถ่ายน้ำหนักซ้าย–ขวาช้า ๆ',target:reps,unit:'ครั้ง'},{id:'stance',type:'stance',title:'Posture Check',cue:'ยืนสองเท้า ลำตัวตั้งตรงและนิ่ง',target:hold,unit:'วิ'}];
}

function markup(meta, phase, duration){
  const title=phase==='cooldown'?meta.cool:meta.warm;
  return `
  <section class="frr-shell" data-root>
    <header class="frr-hero">
      <div class="frr-icon">${esc(meta.emoji)}</div>
      <div><div class="frr-kicker">FITNESS GATE • ${phase==='cooldown'?'COOL-DOWN':'WARM-UP'}</div>
      <h2 class="frr-title">${esc(title)}</h2>
      <p class="frr-sub">Pose Detection ตรวจการเคลื่อนไหวอย่างปลอดภัย ไม่ใช่การแข่งขันความเร็ว</p></div>
    </header>
    <div class="frr-grid">
      <section class="frr-camera-card">
        <div class="frr-camera-wrap">
          <canvas class="frr-preview" data-preview aria-hidden="true"></canvas>
          <video class="frr-video" data-video autoplay muted playsinline></video>
          <canvas class="frr-canvas" data-canvas></canvas>
          <div class="frr-frame-guide" data-guide><div class="frr-frame-silhouette"></div><div class="frr-frame-floor"></div></div>
          <div class="frr-frame-mode">กรอบช่วงบน</div>
          <div class="frr-frame-checks"><span data-check="head">○ ศีรษะ</span><span data-check="shoulders">○ ไหล่</span><span data-check="hips">○ สะโพก</span></div>
          <div class="frr-camera-empty" data-empty><div class="frr-camera-empty-icon">📷</div><strong>พร้อมตรวจท่าทาง</strong><span>กดเปิดกล้องแล้วจัดตัวให้อยู่ในกรอบ</span></div>
          <div class="frr-camera-task" data-camera-task>Warm-up 1/3 • เตรียมเริ่ม</div>
          <button type="button" class="frr-camera-confirm" data-camera-confirm hidden>✓ ทำท่าแล้ว ไปต่อ</button>
          <div class="frr-status-pill" data-status>กล้องยังไม่เริ่ม</div>
        </div>
        <div class="frr-camera-hint" data-hint>ไม่ต้องเห็นขาเต็มตัว • ให้เห็นศีรษะ ไหล่ สะโพก และมือ</div>
      </section>
      <aside class="frr-task-card">
        <div class="frr-task-topline"><span class="frr-badge">${esc(meta.label)}</span><span class="frr-badge frr-badge-muted">เป้าหมาย ${duration} วิ</span></div>
        <div class="frr-progress-track"><span data-allbar></span></div><div class="frr-overall" data-alllabel>ภารกิจ 1 / 3</div>
        <div class="frr-task-live"><div class="frr-task-count" data-no>01</div><div><h3 data-title>เตรียมเริ่ม</h3><p data-cue>เปิดกล้องเพื่อเริ่ม</p></div></div>
        <div class="frr-step-progress"><div class="frr-step-progress-row"><span data-step>รอเริ่ม</span><strong data-value>0%</strong></div><div class="frr-step-progress-track"><span data-bar></span></div></div>
        <div class="frr-quality-row"><span>คุณภาพการตรวจ</span><strong data-quality>รอ Pose</strong></div><div class="frr-quality-detail" data-detail>เริ่มด้วยการเปิดกล้อง</div>
        <div class="frr-breath-orb" data-orb><span></span></div>
        <div class="frr-safety-note">หยุดทันทีเมื่อเวียนศีรษะ เจ็บหน้าอก ปวดข้อ หรือเหนื่อยผิดปกติ และแจ้งครู/ผู้ดูแล</div>
        <footer class="frr-controls frr-controls-in-card"><button class="frr-btn frr-btn-primary" data-start>📷 เปิดกล้องและเริ่ม</button><button class="frr-btn frr-btn-soft" data-skip hidden>✓ ผ่านภารกิจนี้</button><button class="frr-btn frr-btn-soft" data-guided hidden>ทำตามคำแนะนำโดยไม่ใช้กล้อง</button><button class="frr-btn frr-btn-soft" data-retry hidden>ลองตรวจใหม่</button><button class="frr-btn frr-btn-ghost" data-exit>กลับ Fitness Hub</button></footer>
      </aside>
    </div>
    <p class="frr-engine-note" data-engine>Engine: camera + Pose ready</p>
  </section>`;
}

function fit(canvas){
  const r=canvas.getBoundingClientRect(), d=Math.min(devicePixelRatio||1,2), w=Math.max(1,Math.round(r.width*d)), h=Math.max(1,Math.round(r.height*d));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  return {w,h};
}
function drawPreview(preview, video){
  if(!preview||!video||video.readyState<2||!video.videoWidth) return;
  const {w,h}=fit(preview), c=preview.getContext('2d'); if(!c)return;
  c.clearRect(0,0,w,h); c.drawImage(video,0,0,w,h);
}
function drawPose(canvas, preview, video, lm){
  drawPreview(preview,video);
  const {w,h}=fit(canvas), c=canvas.getContext('2d'); if(!c)return;
  c.clearRect(0,0,w,h); if(!lm)return;
  const links=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]];
  c.lineWidth=Math.max(2,w*.006);c.lineCap='round';c.strokeStyle='rgba(125,211,252,.96)';c.fillStyle='rgba(255,255,255,.95)';
  links.forEach(pair=>{const a=p(lm,pair[0]),b=p(lm,pair[1]);if(!a||!b||vis(a)<.32||vis(b)<.32)return;c.beginPath();c.moveTo(a.x*w,a.y*h);c.lineTo(b.x*w,b.y*h);c.stroke();});
  [0,11,12,13,14,15,16,23,24,25,26,27,28].forEach(i=>{const a=p(lm,i);if(!a||vis(a)<.32)return;c.beginPath();c.arc(a.x*w,a.y*h,Math.max(3,w*.009),0,Math.PI*2);c.fill();});
}

export function loadStyle(){
  if(document.getElementById('frr-v13-inline'))return;
  const s=document.createElement('style');s.id='frr-v13-inline';
  s.textContent='.frr-preview{position:absolute;inset:0;z-index:1;width:100%;height:100%;pointer-events:none;transform:scaleX(-1);background:#020617}.frr-video{z-index:0!important;opacity:0!important;pointer-events:none!important}.frr-canvas{z-index:3!important;background:transparent!important}.frr-frame-guide{z-index:4!important}.frr-frame-checks,.frr-frame-mode,.frr-status-pill,.frr-camera-empty{z-index:6!important}.frr-camera-task{position:absolute;z-index:8;left:12px;bottom:54px;max-width:calc(100% - 24px);padding:7px 10px;border:1px solid rgba(125,211,252,.30);border-radius:12px;background:rgba(2,6,23,.78);color:#e0f2fe;font-size:12px;font-weight:900;line-height:1.25;backdrop-filter:blur(8px)}.frr-camera-confirm{position:absolute;z-index:10;right:12px;bottom:12px;min-height:42px;padding:8px 12px;border:1px solid rgba(134,239,172,.66);border-radius:13px;background:linear-gradient(135deg,#bbf7d0,#4ade80);color:#052e16;font:inherit;font-size:13px;font-weight:1000;box-shadow:0 10px 22px rgba(34,197,94,.23)}@media (max-width:520px){.frr-camera-task{left:8px;bottom:58px;font-size:11px}.frr-camera-confirm{right:8px;bottom:10px;min-height:40px;padding:7px 10px;font-size:12px}}';
  document.head.appendChild(s);
}

export async function mount(stage, ctx, api){
  const game=normGame(ctx&&ctx.game), phase=String(ctx&&ctx.phase||'warmup').toLowerCase()==='cooldown'?'cooldown':'warmup';
  const meta=GAME_META[game], duration=clamp(Number(ctx&&ctx.time)||60,30,120), tasks=taskList(game,phase,duration);
  stage.innerHTML=markup(meta,phase,duration);
  const root=stage.querySelector('[data-root]'), video=root.querySelector('[data-video]'), preview=root.querySelector('[data-preview]'), canvas=root.querySelector('[data-canvas]');
  const q=s=>root.querySelector(s);
  const refs={
    empty:q('[data-empty]'),
    status:q('[data-status]'),
    start:q('[data-start]'),
    guided:q('[data-guided]'),
    retry:q('[data-retry]'),
    skip:q('[data-skip]'),
    cameraConfirm:q('[data-camera-confirm]'),
    cameraTask:q('[data-camera-task]'),
    exit:q('[data-exit]'),
    engine:q('[data-engine]')
  };
  let running=false,destroyed=false,guided=false,done=false,stream=null,landmarker=null,vision=null,module=null,raf=0,last=0,index=0,lastSide='',cooldown=0,hold=0,reps=0,sides=new Set(),baseline=null,poseQuality=[],valid=0,frames=0,
    previousWrist={L:null,R:null},
    wristAnchor={L:null,R:null},
    advanceQueued=false,
    finalizing=false,
    finalWatchdog=0,
    taskStartedAt=0,
    assistedTasks=0;

  function task(){return tasks[index];}
  function set(sel,val){const n=q(sel);if(n)n.textContent=val;}
  function bar(sel,r){const n=q(sel);if(n)n.style.width=(clamp(r,0,1)*100)+'%';}
  function update(lm){
    const t=task(); if(!t)return;
    set('[data-alllabel]',`ภารกิจ ${index+1} / ${tasks.length}`);
    bar('[data-allbar]',index/tasks.length);
    set('[data-no]',String(index+1).padStart(2,'0'));
    set('[data-title]',t.title);
    set('[data-cue]',t.cue);
    if(refs.cameraTask) refs.cameraTask.textContent=`${phase==='cooldown'?'Cool-down':'Warm-up'} ${index+1}/${tasks.length} • ${t.title}`;
    const head=vis(p(lm,IDX.NOSE))>.4, sh=vis(p(lm,IDX.LS))>.4&&vis(p(lm,IDX.RS))>.4, hips=vis(p(lm,IDX.LH))>.38&&vis(p(lm,IDX.RH))>.38;
    [['head',head],['shoulders',sh],['hips',hips]].forEach(x=>{const n=q(`[data-check="${x[0]}"]`);if(n){n.textContent=`${x[1]?'✓':'○'} ${x[0]==='head'?'ศีรษะ':x[0]==='shoulders'?'ไหล่':'สะโพก'}`;n.classList.toggle('is-ready',x[1]);}});
    const ready=head&&sh&&hips;
    const quality=lm?avg([vis(p(lm,0)),vis(p(lm,11)),vis(p(lm,12)),vis(p(lm,23)),vis(p(lm,24))]):0;
    set('[data-quality]',guided?'Guided mode':ready&&quality>.6?'ดีมาก':ready?'ใช้ได้':'จัดตำแหน่ง');
    set('[data-detail]',guided?'โหมดทำตามคำแนะนำ':ready?'พร้อมแล้ว • ทำท่าช้า ๆ ให้กล้องติดตามได้':'ให้เห็นศีรษะ ไหล่ และสะโพกอยู่กลางกรอบ');
    q('[data-orb]').classList.toggle('is-breath',t.type==='breath');

    // Never trap a learner. After an attempted task, reveal a safe assist.
    if(running && !guided && !advanceQueued){
      // Desktop task-card assist remains delayed; the camera assist is immediately
      // reachable on mobile for all movement tasks, so students never get trapped.
      if(refs.skip) refs.skip.hidden=(now()-taskStartedAt)<6500;
      if(refs.cameraConfirm){
        const selfConfirmTask=t.type!=='safety';
        refs.cameraConfirm.hidden=!selfConfirmTask;
        refs.cameraConfirm.textContent=t.type==='breath'
          ? '✓ หายใจครบแล้ว ไปต่อ'
          : '✓ ทำท่าแล้ว ไปต่อ';
      }
    }
  }
  function step(progress,target,detail){
    const t=task(), r=clamp(progress/Math.max(.001,target),0,1);
    set('[data-step]',detail);
    const shown=`${t.unit==='วิ'?progress.toFixed(1):Math.round(progress)} / ${target} ${t.unit}`;
    set('[data-value]',shown);
    bar('[data-bar]',r);
    if(refs.cameraTask) refs.cameraTask.textContent=`${phase==='cooldown'?'Cool-down':'Warm-up'} ${index+1}/${tasks.length} • ${t.title} • ${shown}`;
  }
  function clearFinalWatchdog(){
    if(finalWatchdog){
      clearTimeout(finalWatchdog);
      finalWatchdog=0;
    }
  }

  function hardFinish(source='final-task'){
    if(done || finalizing) return;

    finalizing=true;
    advanceQueued=true;
    clearFinalWatchdog();

    if(refs.skip) refs.skip.hidden=true;
    if(refs.cameraConfirm) refs.cameraConfirm.hidden=true;
    if(refs.status) refs.status.textContent=phase==='cooldown'?'Cooldown complete • returning':'Warm-up complete • preparing game';
    if(refs.cameraTask) refs.cameraTask.textContent=phase==='cooldown'?'✓ Cooldown complete • กำลังกลับ':'✓ Warm-up complete • เข้าเกมหลัก';

    // Defensive watchdog: even if a timer is throttled or a frame arrives late,
    // final completion is forced without leaving a completed task on screen.
    finalWatchdog=window.setTimeout(()=>{
      if(!destroyed && !done) finish('final-watchdog');
    },1200);

    // Stop the pose loop before leaving the final task, so no later frame can
    // overwrite the final state or queue another transition.
    window.setTimeout(()=>{
      if(!destroyed && !done) finish(source);
    }, 0);
  }

  function next(){
    if(done || finalizing) return;

    index++;
    lastSide='';
    hold=0;
    reps=0;
    sides=new Set();
    baseline=null;
    previousWrist={L:null,R:null};
    wristAnchor={L:null,R:null};
    advanceQueued=false;
    taskStartedAt=now();

    if(refs.skip) refs.skip.hidden=true;
    if(refs.cameraConfirm) refs.cameraConfirm.hidden=true;

    if(index>=tasks.length){
      hardFinish('next-overflow');
      return;
    }

    update(null);
    step(0,task().target,'เริ่มทำท่าตามคำแนะนำ');
  }

  function completeTask(result){
    if(!result || done || finalizing) return;

    const current=task();
    if(!current) return;

    const reached=Number(result.progress) >= Number(result.target);
    const safeProgress=reached ? result.target : result.progress;

    step(safeProgress,result.target,result.detail);

    if(!reached || advanceQueued) return;

    advanceQueued=true;
    if(refs.skip) refs.skip.hidden=true;
    if(refs.cameraConfirm) refs.cameraConfirm.hidden=true;

    // Last task must NEVER depend on an animation queue. Finish directly.
    if(index >= tasks.length - 1){
      hardFinish('final-task-reached');
      return;
    }

    window.setTimeout(()=>{
      if(!destroyed && !done && !finalizing) next();
    },220);
  }
  function score(lm,dt,time){
    const t=task();if(!t)return;
    const ls=p(lm,IDX.LS),rs=p(lm,IDX.RS),lh=p(lm,IDX.LH),rh=p(lm,IDX.RH),lw=p(lm,IDX.LW),rw=p(lm,IDX.RW),le=p(lm,IDX.LE),re=p(lm,IDX.RE),la=p(lm,IDX.LA),ra=p(lm,IDX.RA),lk=p(lm,IDX.LK),rk=p(lm,IDX.RK);
    const ready=!!(p(lm,0)&&ls&&rs&&lh&&rh&&vis(p(lm,0))>.4&&vis(ls)>.4&&vis(rs)>.4&&vis(lh)>.35&&vis(rh)>.35);
    const sm=mid(ls,rs),hm=mid(lh,rh), sw=dist(ls,rs)||.001; let prog=0,detail='';
    if(t.type==='safety'){
      // Presence-only readiness: the green body checks are the evidence.
      const stable=ready;
      hold=stable?hold+dt:0;
      prog=hold;
      detail=stable?'ตรวจพบร่างกายแล้ว • พร้อมเริ่ม':'จัดศีรษะ ไหล่ และสะโพกให้อยู่ในกรอบ';
    }
    else if(t.type==='stance'||t.type==='breath'){
      const stable=ready;
      hold=stable?hold+dt:0;
      prog=hold;
      detail=stable?'ลำตัวนิ่งและอยู่ในกรอบ':'จัดตัวให้อยู่กลางกรอบ';
    }
    else if(t.type==='arms'||t.type==='punch'){
      /*
        Slow Motion Accumulator:
        Hold a wrist anchor up to 950 ms, so gentle intentional arm movement
        counts even if no individual 90 ms camera frame moves far enough.
      */
      const upperReady=!!(
        p(lm,0)&&ls&&rs&&
        vis(p(lm,0))>.34&&vis(ls)>.34&&vis(rs)>.34
      );

      const moveFromAnchor=(side,wrist)=>{
        if(!wrist||vis(wrist)<.30) return 0;

        const anchor=wristAnchor[side];
        if(!anchor){
          wristAnchor[side]={x:wrist.x,y:wrist.y,at:time};
          return 0;
        }

        const age=time-anchor.at;
        const moved=Math.hypot(wrist.x-anchor.x,wrist.y-anchor.y);

        if(age>950 && moved<.010){
          wristAnchor[side]={x:wrist.x,y:wrist.y,at:time};
          return 0;
        }

        return moved;
      };

      const leftMove=moveFromAnchor('L',lw);
      const rightMove=moveFromAnchor('R',rw);
      const threshold=t.type==='punch'?.018:.015;
      const left=!!(lw&&leftMove>=threshold);
      const right=!!(rw&&rightMove>=threshold);

      let side='';
      if(left&&right) side=leftMove>=rightMove?'L':'R';
      else if(left) side='L';
      else if(right) side='R';

      if(upperReady&&side&&time>cooldown){
        const alternate=side!==lastSide;
        const repeatAfterBeat=side===lastSide&&time>(cooldown+380);

        if(alternate||repeatAfterBeat){
          reps++;
          lastSide=side;
          cooldown=time+(t.type==='punch'?300:250);

          const wrist=side==='L'?lw:rw;
          if(wrist) wristAnchor[side]={x:wrist.x,y:wrist.y,at:time};
        }
      }

      prog=reps;
      detail=reps
        ? `${reps}/${t.target} จังหวะมือ`
        : 'ยกหรือเลื่อนมือซ้าย/ขวาช้า ๆ หนึ่งครั้ง';
    } else if(t.type==='march'||t.type==='duck'||t.type==='shift'){
      const center=hm?hm.x:.5;if(baseline==null)baseline=center;baseline=baseline*.99+center*.01;
      let side='';if(t.type==='march'&&la&&ra){side=Math.abs(la.y-ra.y)>.035?(la.y>ra.y?'L':'R'):'';} else if(t.type==='duck'&&sm&&hm){side=(sm.y-hm.y)>.17?'D':'';} else side=Math.abs(center-baseline)>sw*.3?(center>baseline?'R':'L'):'';
      if(ready&&side&&(side!==lastSide||t.type==='duck')&&time>cooldown){reps++;lastSide=side;cooldown=time+320;}
      prog=reps;detail=`${reps}/${t.target} ${t.type==='duck'?'ย่อเข่า':'สลับ'}`;
    } else if(t.type==='shoulder'){
      // Zero-stuck cooldown: a safe shoulder reset is presence-based.
      // We do not require exact arm-cross geometry on small/mobile camera frames.
      const stable=ready;
      hold=stable ? hold + dt : 0;
      prog=hold;
      detail=stable ? 'ผ่อนหัวไหล่และขยับแขนเบา ๆ' : 'จัดศีรษะ ไหล่ และสะโพกให้อยู่ในกรอบ';
    } else if(t.type==='reach'||t.type==='cross'){
      const left=lw&&lw.y<ls.y-.06, right=rw&&rw.y<rs.y-.06; const side=left?'L':right?'R':'';
      if(ready&&side){if(side!==lastSide){lastSide=side;hold=0;}hold+=dt;if(hold>=t.hold&&!sides.has(side)){sides.add(side);hold=0;lastSide='';}}
      else hold=0;prog=sides.size;detail=`ค้าง ${prog}/2 ด้าน`;
    }
    completeTask({progress:prog,target:t.target,detail});
  }
  function stop(){
    running=false;
    if(raf) cancelAnimationFrame(raf);
    raf=0;
    try{stream&&stream.getTracks().forEach(t=>t.stop());}catch(_){}
    stream=null;
    try{landmarker&&landmarker.close();}catch(_){}
    landmarker=null;
  }

  function directRunHref(){
    const safe = raw => {
      try{
        const u = new URL(String(raw || ''), location.href);
        if(/warmup-gate\.html/i.test(u.pathname)) return '';
        return u.toString();
      }catch(_){ return ''; }
    };

    const explicit = safe(ctx && ctx.next);
    if(explicit){
      const u = new URL(explicit, location.href);
      // Recovery bridge needs an explicit completion flag so solo launch does not
      // re-open Warm-up after the gate returns to the game.
      if(phase === 'warmup'){
        u.searchParams.set('warmupDone', '1');
        u.searchParams.set('gateWarmupDone', '1');
      }
      if(phase === 'cooldown'){
        u.searchParams.set('cooldownDone', '1');
        u.searchParams.set('gateCooldownDone', '1');
      }
      u.searchParams.set('fromGate', '1');
      u.searchParams.set('gatePatch', PATCH);
      return u.toString();
    }

    const canonical = {
      'shadow-breaker':'/webxr-health-mobile/fitness/shadow-breaker-ar.html',
      'rhythm-boxer':'/webxr-health-mobile/fitness/rhythm-boxer-ar.html',
      'jump-duck':'/webxr-health-mobile/fitness/jumpduck-ar.html',
      'balance-hold':'/webxr-health-mobile/fitness/balance-hold-ar2.html'
    };

    const path = canonical[String(game || '')] || '/webxr-health-mobile/fitness/hub.html';
    const u = new URL(path, location.origin);

    [
      'pid','name','studentId','playerId','classId','section',
      'diff','time','view','mode','cat','zone','hub','hubRoot',
      'launcher','plannerReturn'
    ].forEach(key => {
      const value = ctx && ctx[key];
      if(value) u.searchParams.set(key, value);
    });

    u.searchParams.set('fromGate', '1');
    u.searchParams.set('gatePatch', PATCH);
    return u.toString();
  }

  function finish(source='finish'){
    if(done) return;
    done=true;
    finalizing=true;
    clearFinalWatchdog();
    stop();

    const quality=avg(poseQuality);
    const stars=guided
      ? 1
      : quality>.75&&valid/Math.max(1,frames)>.7
        ? 3
        : quality>.55
          ? 2
          : 1;

    const payload={
      title:phase==='cooldown'?'Hero Recovery Mission สำเร็จ':'Hero Ready Mission สำเร็จ',
      subtitle:phase==='cooldown'
        ? 'ค่อย ๆ ลดความหนักเรียบร้อยแล้ว'
        : 'ร่างกายพร้อมเข้าสู่เกมหลักแล้ว',
      gateStars:stars,
      gateQuality:guided
        ? 'guided-fallback'
        : assistedTasks>0
          ? 'pose-assisted'
          : stars===3
            ? 'pose-verified'
            : 'pose-assisted',
      gatePoseQuality:Math.round(quality*100),
      gateDurationSec:Math.round((now()-last)/1000)||duration,
      gateAssistedTasks:assistedTasks,
      warmupDone:phase==='warmup'?1:0,
      cooldownDone:phase==='cooldown'?1:0,
      gateFinalizer:source
    };

    const target=directRunHref();

    // Core keeps score/local history. Direct exit below guarantees the learner
    // leaves the completed screen even if a browser blocks a nested redirect.
    try{
      if(api && typeof api.complete==='function') api.complete(payload);
    }catch(error){
      console.warn('[FRR] core completion failed; direct exit will continue', error);
    }

    window.setTimeout(()=>{
      if(destroyed) return;
      try{
        const here=String(location.pathname || '');
        if(/warmup-gate\.html/i.test(here) && target){
          location.replace(target);
        }
      }catch(_){}
    }, 420);
  }
  function guidedMode(reason){
    stop();guided=true;refs.empty.hidden=false;refs.empty.innerHTML='<div class="frr-camera-empty-icon">🧭</div><strong>โหมดทำตามคำแนะนำ</strong><span>'+esc(reason||'กล้องไม่พร้อม')+'</span>';refs.start.hidden=true;refs.guided.hidden=true;refs.retry.hidden=false;refs.status.textContent='Guided mode';refs.engine.textContent='Pose unavailable • guided fallback';update(null);
    let b=q('[data-confirm]');if(!b){b=document.createElement('button');b.className='frr-btn frr-btn-primary';b.dataset.confirm='1';b.textContent='✓ ยืนยันว่าทำท่านี้แล้ว';q('.frr-controls').prepend(b);b.onclick=()=>{completeTask({progress:task().target,target:task().target,detail:'ทำตามคำแนะนำแล้ว'});};}
  }
  async function start(){
    refs.start.disabled=true;refs.start.textContent='กำลังเปิดกล้อง…';refs.status.textContent='กำลังขออนุญาตกล้อง';
    try{
      stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:960},height:{ideal:720},frameRate:{ideal:24,max:30}}});
      video.srcObject=stream;await video.play();
      video.style.opacity='0';video.style.pointerEvents='none';preview.style.display='block';preview.style.visibility='visible';preview.style.opacity='1';
      await new Promise(resolve=>{if(video.readyState>=2&&video.videoWidth)return resolve();video.addEventListener('loadeddata',resolve,{once:true});setTimeout(resolve,1200);});
      refs.empty.hidden=true;refs.status.textContent='กล้องพร้อม • กำลังโหลด Pose';refs.engine.textContent='Camera ready • Loading MediaPipe Pose…';
      module=await import(MP.module);vision=await module.FilesetResolver.forVisionTasks(MP.wasm);
      try{landmarker=await module.PoseLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:MP.model,delegate:'GPU'},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.56,minPosePresenceConfidence:.56,minTrackingConfidence:.56});}
      catch(_){landmarker=await module.PoseLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:MP.model,delegate:'CPU'},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.56,minPosePresenceConfidence:.56,minTrackingConfidence:.56});}
      running=true;
      last=now();
      taskStartedAt=now();
      advanceQueued=false;
      finalizing=false;
      clearFinalWatchdog();
      if(refs.skip) refs.skip.hidden=true;
      if(refs.cameraConfirm) refs.cameraConfirm.hidden=true;
      let lastInfer=0,lastFrame=now();
      refs.start.hidden=true;
      refs.status.textContent='กล้องพร้อม • ยืนในกรอบ';
      refs.engine.textContent='MediaPipe Pose active • '+PATCH;
      update(null);
      const loop=()=>{if(!running||destroyed)return;raf=requestAnimationFrame(loop);const t=now();if(video.readyState<2||t-lastInfer<90)return;const dt=Math.min(.25,Math.max(.016,(t-lastFrame)/1000));lastInfer=t;lastFrame=t;let res;try{res=landmarker.detectForVideo(video,t);}catch(_){return;}const lm=res&&res.landmarks&&res.landmarks[0]||null;drawPose(canvas,preview,video,lm);update(lm);if(!lm){refs.status.textContent='กำลังค้นหาร่างกาย';return;}frames++;const quality=avg([vis(p(lm,0)),vis(p(lm,11)),vis(p(lm,12)),vis(p(lm,23)),vis(p(lm,24))]);poseQuality.push(quality);if(poseQuality.length>180)poseQuality.shift();if(quality>.5)valid++;refs.status.textContent='กำลังตรวจท่าทาง';score(lm,dt,t);};
      loop();
    }catch(e){console.warn('[FRR] start failed',e);refs.start.hidden=true;refs.guided.hidden=false;refs.retry.hidden=false;refs.status.textContent='เปิดกล้องไม่สำเร็จ';refs.engine.textContent='Camera unavailable: '+clean(e&&e.message||e);update(null);}
    finally{refs.start.disabled=false;if(!refs.start.hidden)refs.start.textContent='📷 เปิดกล้องและเริ่ม';}
  }
  function retry(){
    stop();
    guided=false;
    done=false;
    index=0;
    lastSide='';
    hold=0;
    reps=0;
    sides=new Set();
    baseline=null;
    previousWrist={L:null,R:null};
    wristAnchor={L:null,R:null};
    advanceQueued=false;
    finalizing=false;
    clearFinalWatchdog();
    taskStartedAt=0;
    assistedTasks=0;
    poseQuality=[];
    valid=0;
    frames=0;

    q('[data-confirm]')&&q('[data-confirm]').remove();
    refs.empty.hidden=false;
    refs.empty.innerHTML='<div class="frr-camera-empty-icon">📷</div><strong>พร้อมตรวจท่าทาง</strong><span>กดเปิดกล้องแล้วจัดตัวให้อยู่ในกรอบ</span>';
    refs.start.hidden=false;
    refs.guided.hidden=true;
    refs.retry.hidden=true;
    if(refs.skip) refs.skip.hidden=true;
    if(refs.cameraConfirm) refs.cameraConfirm.hidden=true;
    refs.status.textContent='กล้องยังไม่เริ่ม';
    refs.engine.textContent='Engine: camera + Pose ready';
    update(null);
  }
  refs.start.onclick=start;
  refs.guided.onclick=()=>guidedMode('ผู้เรียนเลือกใช้โหมดทำตามคำแนะนำ');
  refs.retry.onclick=retry;
  const completeWithConfirm=()=>{
    if(done||!task()) return;
    assistedTasks++;
    completeTask({
      progress:task().target,
      target:task().target,
      detail:'ยืนยันว่าทำท่าแล้ว'
    });
  };

  if(refs.skip) refs.skip.onclick=completeWithConfirm;
  if(refs.cameraConfirm) refs.cameraConfirm.onclick=completeWithConfirm;

  refs.exit.onclick=()=>{stop();api.goHub();};
  update(null);
  return ()=>{
    destroyed=true;
    clearFinalWatchdog();
    stop();
    try{stage.innerHTML='';}catch(_){}
  };
}
export default mount;
