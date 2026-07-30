(()=>{'use strict';
const $=id=>document.getElementById(id);
const q=new URLSearchParams(location.search);
const intro=$('intro'),countdown=$('countdown'),game=$('game'),result=$('result');
const video=$('video'),poseCanvas=$('poseCanvas'),pctx=poseCanvas.getContext('2d');
const world=$('world'),ctx=world.getContext('2d');
const DURATION_SEC=50;
const POSE_BASE_GAP=280;
const RENDER_GAP=40;
const GOOD=['🍎','🥦','💧','🍌'];
const BAD=['🍟','🥤','🍩','🔥'];
const ROAD_LANES=[-.34,0,.34];
const PLAYER_X=[.22,.5,.78];
const missions=[
 {text:'MISSION 1 • เก็บอาหารดี',goal:5,key:'good'},
 {text:'MISSION 2 • หลบอาหารขยะ',goal:6,key:'avoid'},
 {text:'MISSION 3 • ทำ Perfect',goal:5,key:'perfect'}
];
let stream=null,detector=null,poseBusy=false,poseEnabled=false,playing=false,finishing=false;
let roundStartedAt=0,clockTimer=0,lastRenderAt=0,lastSpawnAt=0,lastPoseAt=0,poseGap=POSE_BASE_GAP;
let calibration={active:false,samples:[],baseCx:.5,shoulderY:.38,hipY:.62,noseY:.22};
let poseQuality={visible:false,lastSeenAt:0,latency:0,missingReason:'กำลังโหลดตัวตรวจจับร่างกาย…'};
let laneCandidate=1,laneCandidateSince=0,verticalLocked=false,verticalNeutralSince=0;
let score=0,combo=0,maxCombo=0,multi=1,goodCount=0,avoidCount=0,perfectCount=0,missCount=0;
let successfulEvents=0,resolvedEvents=0,movementCount=0,bodyLaneMoves=0,touchLaneMoves=0;
let missionIndex=0,missionStart={good:0,avoid:0,perfect:0},reactionTimes=[],gestureStats={jump:0,duck:0,left:0,right:0,center:0,touch:0},laneUsage=[0,0,0];
let phase='EASY',recoveryUntil=0,objects=[],particles=[];
let player={lane:1,visualLane:1,y:0,vy:0,duck:0};

function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function median(values){if(!values.length)return 0;const a=[...values].sort((x,y)=>x-y);const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}
function resize(){
 const d=Math.min(devicePixelRatio||1,1.5);
 world.width=Math.round(innerWidth*d);world.height=Math.round(innerHeight*d);
 world.style.width=innerWidth+'px';world.style.height=innerHeight+'px';ctx.setTransform(d,0,0,d,0,0);
 const r=poseCanvas.getBoundingClientRect();poseCanvas.width=Math.max(1,Math.round(r.width*d));poseCanvas.height=Math.max(1,Math.round(r.height*d));pctx.setTransform(d,0,0,d,0,0);
}
addEventListener('resize',resize);resize();
function status(text,error=false){$('startStatus').textContent=text;$('startStatus').className='status'+(error?' error':'')}
function laneName(lane){return lane===0?'ซ้าย':lane===2?'ขวา':'กลาง'}
function toast(text){const el=$('toast');el.textContent=text;el.classList.remove('show');void el.offsetWidth;el.classList.add('show')}
function keypointMap(pose){const map={};for(const kp of pose?.keypoints||[])if(kp?.name)map[kp.name]=kp;return map}
function valid(kp,min=.24){return !!kp&&Number(kp.score||0)>=min&&Number.isFinite(kp.x)&&Number.isFinite(kp.y)}
function normalizedMetrics(pose){
 const map=keypointMap(pose),vw=Math.max(1,video.videoWidth||320),vh=Math.max(1,video.videoHeight||240);
 const ls=map.left_shoulder,rs=map.right_shoulder,lh=map.left_hip,rh=map.right_hip,nose=map.nose;
 if(!valid(ls)||!valid(rs))return{ok:false,reason:'ถอยให้กล้องเห็นไหล่ทั้งสองข้าง'};
 if(!valid(lh,.20)||!valid(rh,.20))return{ok:false,reason:'ถอยอีกนิดให้กล้องเห็นถึงสะโพก'};
 const cx=(ls.x+rs.x+lh.x+rh.x)/(4*vw);
 const shoulderY=(ls.y+rs.y)/(2*vh),hipY=(lh.y+rh.y)/(2*vh);
 const noseY=valid(nose,.18)?nose.y/vh:shoulderY-.16;
 const quality=(Number(ls.score)+Number(rs.score)+Number(lh.score)+Number(rh.score))/4;
 return{ok:true,cx,shoulderY,hipY,noseY,quality,map,vw,vh};
}
function drawSkeleton(metrics){
 const w=poseCanvas.clientWidth,h=poseCanvas.clientHeight;pctx.clearRect(0,0,w,h);if(!metrics?.ok)return;
 const m=metrics.map,vw=metrics.vw,vh=metrics.vh;
 const pairs=[['left_shoulder','right_shoulder'],['left_shoulder','left_elbow'],['left_elbow','left_wrist'],['right_shoulder','right_elbow'],['right_elbow','right_wrist'],['left_shoulder','left_hip'],['right_shoulder','right_hip'],['left_hip','right_hip'],['left_hip','left_knee'],['right_hip','right_knee']];
 const xy=kp=>[(kp.x/vw)*w,(kp.y/vh)*h];
 pctx.save();pctx.strokeStyle='#22c55e';pctx.fillStyle='#fff';pctx.lineWidth=3;
 for(const [a,b] of pairs){if(!valid(m[a],.18)||!valid(m[b],.18))continue;const A=xy(m[a]),B=xy(m[b]);pctx.beginPath();pctx.moveTo(A[0],A[1]);pctx.lineTo(B[0],B[1]);pctx.stroke()}
 for(const name of ['nose','left_shoulder','right_shoulder','left_elbow','right_elbow','left_wrist','right_wrist','left_hip','right_hip','left_knee','right_knee']){const kp=m[name];if(!valid(kp,.18))continue;const P=xy(kp);pctx.beginPath();pctx.arc(P[0],P[1],4,0,Math.PI*2);pctx.fill()}
 pctx.restore();
}
function targetLane(cx){
 const dx=cx-calibration.baseCx;
 /* Wide centre lane with asymmetric hysteresis: returning to centre is easier than leaving it. */
 if(player.lane===1){if(dx<-.135)return 0;if(dx>.135)return 2;return 1}
 if(player.lane===0){return dx>-.075?1:0}
 return dx<.075?1:2;
}
function setLane(target,source='body'){
 target=clamp(target|0,0,2);if(target===player.lane)return false;
 player.lane=target;laneUsage[target]++;
 if(source==='body'){bodyLaneMoves++;movementCount++;gestureStats[target===0?'left':target===2?'right':'center']++}
 else{touchLaneMoves++;gestureStats.touch++}
 toast(`${laneName(target)} ${target===0?'⬅️':target===2?'➡️':'↔️'}`);return true;
}
function updateBodyControl(metrics){
 const now=performance.now(),target=targetLane(metrics.cx);
 if(target!==laneCandidate){laneCandidate=target;laneCandidateSince=now}
 else if(target!==player.lane&&now-laneCandidateSince>=90)setLane(target,'body');
 const hipDelta=metrics.hipY-calibration.hipY,shoulderDelta=metrics.shoulderY-calibration.shoulderY,noseDelta=metrics.noseY-calibration.noseY;
 const neutral=Math.abs(hipDelta)<.025&&Math.abs(shoulderDelta)<.03;
 if(neutral){if(!verticalNeutralSince)verticalNeutralSince=now;if(verticalLocked&&now-verticalNeutralSince>180)verticalLocked=false;return}
 verticalNeutralSince=0;if(verticalLocked)return;
 if(hipDelta<-.052&&shoulderDelta<-.035&&player.y===0){player.vy=-1.02;movementCount++;gestureStats.jump++;verticalLocked=true;toast('JUMP! ⬆️')}
 else if((shoulderDelta>.055||noseDelta>.07)&&player.duck<.05){player.duck=.88;movementCount++;gestureStats.duck++;verticalLocked=true;toast('DUCK! ⬇️')}
}
async function poseLoop(){
 if(!poseEnabled||!detector||finishing)return;
 const now=performance.now();if(poseBusy||now-lastPoseAt<poseGap){setTimeout(poseLoop,60);return}
 poseBusy=true;lastPoseAt=now;const started=performance.now();
 try{
  const poses=await detector.estimatePoses(video,{flipHorizontal:true,maxPoses:1});
  const latency=performance.now()-started;poseQuality.latency=latency;
  poseGap=latency>900?650:latency>600?450:POSE_BASE_GAP;
  const metrics=normalizedMetrics(poses?.[0]);
  if(metrics.ok){
   poseQuality.visible=true;poseQuality.lastSeenAt=Date.now();poseQuality.missingReason='';drawSkeleton(metrics);
   if(calibration.active)calibration.samples.push(metrics);
   if(playing){updateBodyControl(metrics);$('poseText').textContent=`AI เห็นร่างกายแล้ว ✅ • ช่อง ${laneName(player.lane)} • กลางกว้างขึ้น`}
  }else{
   poseQuality.visible=false;poseQuality.missingReason=metrics.reason;$('poseText').textContent=metrics.reason;pctx.clearRect(0,0,poseCanvas.clientWidth,poseCanvas.clientHeight);
  }
 }catch(error){console.warn('[JumpDuck MoveNet]',error);poseQuality.visible=false;poseQuality.missingReason='AI สะดุดชั่วคราว กำลังตรวจใหม่…';$('poseText').textContent=poseQuality.missingReason;poseGap=700}
 finally{poseBusy=false;if(poseEnabled&&!finishing)setTimeout(poseLoop,Math.max(80,poseGap-40))}
}
async function initDetector(){
 if(!window.tf||!window.poseDetection)throw new Error('โหลดระบบตรวจจับร่างกายไม่ครบ');
 try{tf.env().set('WEBGL_DELETE_TEXTURE_THRESHOLD',0)}catch(_){ }
 await tf.setBackend('webgl');await tf.ready();
 detector=await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet,{modelType:poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,enableSmoothing:true,multiPoseMaxDimension:192});
}
async function prepare(){
 try{
  $('start').disabled=true;status('กำลังเปิดกล้อง…');
  stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:320,max:480},height:{ideal:240,max:360},frameRate:{ideal:12,max:15}},audio:false});
  video.srcObject=stream;await video.play();status('กำลังโหลด AI ตรวจจับร่างกาย…');await initDetector();
  poseEnabled=true;poseLoop();intro.classList.add('hidden');countdown.classList.remove('hidden');await calibrate();begin();
 }catch(error){console.error(error);status(`เริ่มเกมไม่สำเร็จ: ${error.message||error}`,true);$('start').disabled=false;releaseResources()}
}
async function calibrate(){
 calibration.active=true;calibration.samples=[];
 for(let n=3;n>0;n--){$('count').textContent=n;await new Promise(resolve=>setTimeout(resolve,900))}
 calibration.active=false;
 const validSamples=calibration.samples.filter(s=>s.ok);
 if(validSamples.length>=4){
  calibration.baseCx=median(validSamples.map(s=>s.cx));calibration.shoulderY=median(validSamples.map(s=>s.shoulderY));calibration.hipY=median(validSamples.map(s=>s.hipY));calibration.noseY=median(validSamples.map(s=>s.noseY));
 }else throw new Error('ยังไม่เห็นช่วงไหล่ถึงสะโพก กรุณาวางมือถือให้ไกลขึ้น');
 $('count').textContent='GO!';await new Promise(resolve=>setTimeout(resolve,450));
}
function begin(){
 countdown.classList.add('hidden');game.classList.remove('hidden');playing=true;finishing=false;roundStartedAt=Date.now();lastRenderAt=performance.now();lastSpawnAt=lastRenderAt+900;updateMission();clockTimer=setInterval(updateClock,200);requestAnimationFrame(loop);try{parent.postMessage({type:'HEROHEALTH_GAME_STARTED'},location.origin)}catch(_){ }
}
function updateClock(){
 if(!playing||finishing)return;const elapsed=Date.now()-roundStartedAt,remaining=Math.max(0,DURATION_SEC-Math.floor(elapsed/1000));$('time').textContent=remaining;
 if(remaining===20&&phase==='EASY'){phase='NORMAL';toast('LEVEL UP! ⚡')}
 if(remaining===7&&phase!=='RUSH'){phase='RUSH';toast('FINAL RUSH! 🔥')}
 if(remaining<=0||elapsed>=DURATION_SEC*1000)finish('wall-clock-50s');
}
function adaptiveGap(){const accuracy=resolvedEvents?successfulEvents/resolvedEvents:1;if(performance.now()<recoveryUntil)return 2050;const base=phase==='EASY'?1900:phase==='NORMAL'?1660:1450;return base*(accuracy<.70?1.18:combo>=8?.96:1)+Math.random()*280}
function spawn(now){const isGood=Math.random()<.48;let lane;if(isGood&&Math.random()<.66)lane=player.lane;else if(!isGood&&Math.random()<.22)lane=player.lane;else lane=Math.floor(Math.random()*3);const kind=(isGood?GOOD:BAD)[Math.floor(Math.random()*4)];objects.push({lane,z:1.08,kind,isGood,resolved:false,warned:false,warnedAt:0});lastSpawnAt=now+adaptiveGap()}
function warningFor(o){if(o.isGood)return'เก็บ '+o.kind;return(o.kind==='🔥'||o.kind==='🍟')?'⬆️ กระโดด หรือหลบเลน':'⬇️ ย่อตัว หรือหลบเลน'}
function burst(lane,good){for(let i=0;i<9;i++)particles.push({lane,x:(Math.random()-.5)*.08,y:.62,vx:(Math.random()-.5)*.25,vy:-Math.random()*.45,life:1,good})}
function resolveObject(o,success,label,reaction=false){
 if(o.resolved)return;o.resolved=true;resolvedEvents++;
 if(success){successfulEvents++;combo++;maxCombo=Math.max(maxCombo,combo);multi=combo>=12?5:combo>=7?3:combo>=4?2:1;const points=(label==='PERFECT'?10:8)*multi;score+=points;if(label==='PERFECT')perfectCount++;if(reaction&&o.warnedAt)reactionTimes.push(Math.max(0,performance.now()-o.warnedAt));toast(`${label} +${points} ✨`);burst(o.lane,true)}
 else{missCount++;combo=0;multi=1;score=Math.max(0,score-5);recoveryUntil=performance.now()+5500;toast('MISS • ช้าลงให้ตั้งตัว 💛');burst(o.lane,false)}
 $('score').textContent=score;$('combo').textContent=combo;$('multi').textContent=multi;updateMission();
}
function collision(o){
 if(o.resolved)return;const same=Math.abs(player.visualLane-o.lane)<.58;
 if(o.z<.74&&!o.warned){o.warned=true;o.warnedAt=performance.now();$('warning').textContent=warningFor(o);$('warning').classList.add('show')}
 if(o.z>=.18)return;$('warning').classList.remove('show');
 if(o.isGood){if(same){goodCount++;resolveObject(o,true,'PERFECT')}else resolveObject(o,false,'MISS');return}
 if(!same){avoidCount++;resolveObject(o,true,'GREAT');return}
 const safe=((o.kind==='🔥'||o.kind==='🍟')&&player.y<-.105)||((o.kind==='🥤'||o.kind==='🍩')&&player.duck>.12);
 if(safe){avoidCount++;resolveObject(o,true,'PERFECT',true)}else resolveObject(o,false,'MISS');
}
function updateMission(){
 const m=missions[missionIndex],current=m.key==='good'?goodCount-missionStart.good:m.key==='avoid'?avoidCount-missionStart.avoid:perfectCount-missionStart.perfect;
 $('missionText').textContent=m.text;$('missionNow').textContent=Math.min(m.goal,current);$('missionGoal').textContent=m.goal;$('missionBar').style.width=Math.min(100,current/m.goal*100)+'%';
 if(current>=m.goal&&missionIndex<missions.length-1){missionIndex++;missionStart={good:goodCount,avoid:avoidCount,perfect:perfectCount};toast('MISSION CLEAR! ⭐');setTimeout(updateMission,450)}
}
function loop(now){
 if(!playing||finishing)return;if(now-lastRenderAt<RENDER_GAP){requestAnimationFrame(loop);return}const dt=Math.min(.05,(now-lastRenderAt)/1000||0);lastRenderAt=now;updateClock();if(!playing||finishing)return;
 const baseSpeed=phase==='EASY'?.235:phase==='NORMAL'?.29:.35,speed=now<recoveryUntil?baseSpeed*.60:baseSpeed*(combo>=8?1.02:1);
 if(now>=lastSpawnAt)spawn(now);player.visualLane+=(player.lane-player.visualLane)*Math.min(1,dt*15);player.vy+=2.65*dt;player.y+=player.vy*dt;if(player.y>0){player.y=0;player.vy=0}player.duck=Math.max(0,player.duck-dt);
 for(const o of objects){o.z-=speed*dt;collision(o)}objects=objects.filter(o=>o.z>-.18);for(const p of particles){p.life-=dt*1.8;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=1.2*dt}particles=particles.filter(p=>p.life>0);render(now,speed);requestAnimationFrame(loop);
}
function render(now,speed){
 const w=innerWidth,h=innerHeight;ctx.clearRect(0,0,w,h);const gradient=ctx.createLinearGradient(0,0,0,h);gradient.addColorStop(0,phase==='RUSH'?'#2563eb':'#38bdf8');gradient.addColorStop(.55,'#dbeafe');gradient.addColorStop(.56,'#86efac');gradient.addColorStop(1,'#15803d');ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
 const horizon=h*.43,ground=h*.84;ctx.fillStyle='#475569';ctx.beginPath();ctx.moveTo(w*.42,horizon);ctx.lineTo(w*.58,horizon);ctx.lineTo(w*.92,ground);ctx.lineTo(w*.08,ground);ctx.closePath();ctx.fill();ctx.strokeStyle='#f8fafc88';ctx.lineWidth=4;
 for(const l of [.33,.66]){ctx.beginPath();ctx.moveTo(w*(.42+.16*l),horizon);ctx.lineTo(w*(.08+.84*l),ground);ctx.stroke()}
 for(let i=0;i<8;i++){const y=horizon+((i/8+now*.00035*speed/.4)%1)**1.6*(ground-horizon);ctx.beginPath();ctx.moveTo(w*.44,y);ctx.lineTo(w*.56,y);ctx.stroke()}
 const laneFloor=clamp(player.visualLane,0,2),li=Math.floor(laneFloor),ri=Math.ceil(laneFloor),mix=laneFloor-li,px=w*(PLAYER_X[li]*(1-mix)+PLAYER_X[ri]*mix),py=ground-38+player.y*h*.38;
 ctx.save();ctx.translate(px,py);ctx.scale(player.duck>.15?1.2:.98,player.duck>.15?.62:1);ctx.font='66px serif';ctx.textAlign='center';ctx.fillText('🦆',0,0);ctx.restore();
 for(const o of objects){const p=1-o.z,x=w*.5+ROAD_LANES[o.lane]*w*(.18+.78*p),y=horizon+(ground-horizon)*Math.pow(Math.max(0,p),1.65),size=24+74*p;ctx.globalAlpha=o.resolved?.25:1;ctx.font=size+'px serif';ctx.textAlign='center';ctx.fillText(o.kind,x,y)}ctx.globalAlpha=1;
 for(const p of particles){const x=w*.5+ROAD_LANES[p.lane]*w*.42+p.x*w,y=h*.7+p.y*100;ctx.globalAlpha=p.life;ctx.font='24px serif';ctx.fillText(p.good?'✨':'💥',x,y)}ctx.globalAlpha=1;
}
function rankFor(accuracy){return accuracy>=90?'SS':accuracy>=80?'S':accuracy>=70?'A':accuracy>=60?'B':'C'}
function buildPayload(reason){
 const accuracy=resolvedEvents?Math.round(successfulEvents/resolvedEvents*100):0,avgReaction=reactionTimes.length?Math.round(reactionTimes.reduce((a,b)=>a+b,0)/reactionTimes.length):0;
 return{completed:true,passed:true,roundCompleted:true,forcedReplay:false,finishReason:reason,score,accuracy,maxCombo,healthCoins:goodCount,perfectCount,missCount,rank:rankFor(accuracy),stars:accuracy>=85?3:accuracy>=70?2:1,movementCount,movementScore:Math.min(100,Math.round(accuracy*.7+Math.min(30,movementCount))),successfulEvents,resolvedEvents,avgReactionMs:avgReaction,reactionBasis:'warning-to-correct-body-gesture',gestureStats,laneUsage,missionReached:missionIndex+1,eventId:`HH-game-fitness-jumpduck-${q.get('studentId')||''}-${Date.now()}`,inputMode:'movenet-lightning-body-tracking',gameVersion:'jumpduck-production-v5.0-clean-movenet-core',detector:'MoveNet.SINGLEPOSE_LIGHTNING',poseGapMs:poseGap,poseLastLatencyMs:Math.round(poseQuality.latency),centerPolicy:'wide-center-hysteresis-0.135-enter-0.075-return',bodyLaneMoves,touchLaneMoves};
}
function handoff(payload){
 try{parent.postMessage({type:'HEROHEALTH_GAME_COMPLETE',payload,autoSubmit:true},location.origin)}catch(_){ }
 const classroom=window.parent!==window&&q.get('studentId');if(!classroom){$('syncText').textContent=`เล่นครบ 1 รอบ • พร้อมกลับ Passport\nทำสำเร็จ ${payload.missionReached} จาก 3 ภารกิจ`;$('syncText').style.whiteSpace='pre-line';return}
 $('syncText').textContent='จบรอบแล้ว • กำลังส่งผลไปยัง Passport';
}
function finish(reason='normal'){
 if(finishing)return true;finishing=true;playing=false;poseEnabled=false;clearInterval(clockTimer);$('time').textContent='0';$('finishRoundBtn')?.classList.add('hidden');game.classList.add('hidden');result.classList.remove('hidden');
 const payload=buildPayload(reason);$('rank').textContent=payload.rank;$('stars').textContent='⭐'.repeat(payload.stars);$('finalScore').textContent=payload.score;$('finalAcc').textContent=payload.accuracy+'%';$('finalCombo').textContent=payload.maxCombo;$('finalGood').textContent=payload.healthCoins;$('finalPerfect').textContent=payload.perfectCount;$('finalMove').textContent=payload.movementCount;$('resultText').textContent=`สำเร็จ ${payload.successfulEvents}/${payload.resolvedEvents} • Miss ${payload.missCount} • ภารกิจ ${payload.missionReached}/3 • Reaction ${payload.avgReactionMs?payload.avgReactionMs+' ms':'ไม่ได้วัดในรอบนี้'}`;
 window.__JUMPDUCK_LAST_RESULT__=payload;try{localStorage.setItem('HHA_JUMPDUCK_LAST_RESULT',JSON.stringify(payload))}catch(_){ }handoff(payload);setTimeout(releaseResources,900);return true;
}
function releaseResources(){
 poseEnabled=false;try{video.pause()}catch(_){ }try{stream?.getTracks?.().forEach(track=>track.stop())}catch(_){ }stream=null;try{video.srcObject=null}catch(_){ }
 const current=detector;detector=null;if(current&&!poseBusy)setTimeout(()=>{try{current.dispose()}catch(_){ }},100);
}
world.addEventListener('pointerdown',event=>{if(!playing)return;const x=event.clientX/Math.max(1,innerWidth);setLane(x<.34?0:x>.66?2:1,'touch')});
$('finishRoundBtn')?.addEventListener('click',()=>finish('manual'));
$('start').onclick=prepare;
$('done').onclick=()=>{const payload=window.__JUMPDUCK_LAST_RESULT__;if(!payload)return;try{parent.postMessage({type:'HEROHEALTH_GAME_COMPLETE',payload,autoSubmit:true},location.origin)}catch(_){ }};
window.JumpDuckAPI={version:'5.0',finish,getState:()=>buildPayload('snapshot'),isPlaying:()=>playing};
addEventListener('pagehide',releaseResources);
})();
