(()=>{
'use strict';
const RELEASE='20260808-LCA47-BODY-COACH-V1';
const $=id=>document.getElementById(id);
const V=()=>window.LEXICON_CHAMPION_V47;
const vis=p=>Number(p?.v||0);
const CONNECTIONS=[[0,11],[0,12],[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[24,26]];
let stage=null,canvas=null,ctx=null,raf=0,lastStage=null;

function injectStyle(){if($('lcaBodyCoachStyle'))return;const s=document.createElement('style');s.id='lcaBodyCoachStyle';s.textContent=`
#bodyCoachCanvas{position:absolute;inset:0;width:100%;height:100%;z-index:4;pointer-events:none}
.bodyCoach{position:absolute;left:8px;right:8px;top:42px;z-index:6;display:grid;gap:5px;pointer-events:none}
.bodyCoachTitle{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:6px 8px;border:1px solid rgba(98,232,255,.65);border-radius:11px;background:rgba(5,18,31,.88);font-size:.72rem;font-weight:950}
.bodyCoachTitle b{color:#aef8e2}.bodyCoachTitle span{color:#dbefff}
.bodyCoachChecks{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:3px}
.bodyCoachChip{padding:4px 2px;border-radius:8px;border:1px solid rgba(255,255,255,.20);background:rgba(9,17,34,.82);text-align:center;font-size:.57rem;font-weight:900;color:#a9b6c8;white-space:nowrap}
.bodyCoachChip.ok{border-color:#54e5b4;background:rgba(17,76,61,.88);color:#b8ffe8}.bodyCoachChip.warn{border-color:#ffd666;color:#ffe9a4}
.bodyCoachHint{padding:5px 8px;border-radius:9px;background:rgba(18,13,45,.9);font-size:.66rem;font-weight:850;color:#f5f1ff;text-align:center}
.poseStage .ghost{opacity:.56!important;filter:drop-shadow(0 0 5px rgba(255,255,255,.34))}.poseStage.calibrating .ghost{opacity:.32!important}
.poseStage.body-ready{border-color:#72f0c0!important;box-shadow:0 0 0 2px rgba(114,240,192,.12),0 0 18px rgba(114,240,192,.18)}
@media(max-width:430px){.bodyCoach{top:40px}.bodyCoachChecks{gap:2px}.bodyCoachChip{font-size:.53rem;padding:4px 1px}.bodyCoachTitle{font-size:.67rem}.bodyCoachHint{font-size:.61rem}}
`;document.head.appendChild(s)}

function ensureUI(){stage=$('poseStage');if(!stage||stage===lastStage)return false;lastStage=stage;
  canvas=document.createElement('canvas');canvas.id='bodyCoachCanvas';stage.appendChild(canvas);ctx=canvas.getContext('2d');
  const box=document.createElement('div');box.className='bodyCoach';box.id='bodyCoach';box.innerHTML=`<div class="bodyCoachTitle"><b id="bodyCoachState">BODY SEARCHING</b><span id="bodyCoachPct">0%</span></div><div class="bodyCoachChecks"><div id="bcHead" class="bodyCoachChip">Head</div><div id="bcShoulders" class="bodyCoachChip">Shoulders</div><div id="bcArms" class="bodyCoachChip">Arms</div><div id="bcTorso" class="bodyCoachChip">Torso</div><div id="bcKnees" class="bodyCoachChip">Knees</div></div><div id="bodyCoachHint" class="bodyCoachHint">ถอยให้เห็นศีรษะ ไหล่ ลำตัว แขน และเข่า</div>`;stage.appendChild(box);return true}
function setChip(id,ok,soft=false){const e=$(id);if(!e)return;e.className='bodyCoachChip '+(ok?'ok':soft?'warn':'');e.textContent=(ok?'✓ ':'')+({bcHead:'Head',bcShoulders:'Shoulders',bcArms:'Arms',bcTorso:'Torso',bcKnees:'Knees'}[id]||id)}
function bodyState(l){if(!Array.isArray(l))return null;const head=vis(l[0])>.18,shoulders=vis(l[11])>.2&&vis(l[12])>.2,arms=(vis(l[13])>.16||vis(l[15])>.12)&&(vis(l[14])>.16||vis(l[16])>.12),torso=vis(l[23])>.16&&vis(l[24])>.16,knees=vis(l[25])>.1&&vis(l[26])>.1;const flags=[head,shoulders,arms,torso,knees],pct=Math.round(flags.filter(Boolean).length/flags.length*100);return{head,shoulders,arms,torso,knees,pct,ready:head&&shoulders&&arms&&torso&&knees}}
function actionHint(action,l){if(!action)return'ยืนให้อยู่กลางกรอบแล้วรอฟังคำสั่ง';const id=action.id;if(id==='wide')return'กางแขนซ้าย–ขวาให้อยู่ระดับไหล่ แล้วค้างไว้';if(id==='hands')return'ยกมือทั้งสองขึ้นเหนือไหล่ แล้วค้างไว้';if(id==='left')return'เอียงลำตัวและเอื้อมแขนไปทางซ้ายเล็กน้อย';if(id==='right')return'เอียงลำตัวและเอื้อมแขนไปทางขวาเล็กน้อย';return'ทำท่าตามภาพตัวอย่างแล้วค้างไว้'}
function resize(){if(!canvas||!stage)return;const r=stage.getBoundingClientRect(),d=Math.min(2,devicePixelRatio||1),w=Math.round(r.width*d),h=Math.round(r.height*d);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}}
function drawSkeleton(l,ready){if(!ctx||!canvas)return;resize();const d=Math.min(2,devicePixelRatio||1),w=canvas.width/d,h=canvas.height/d;ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,w,h);if(!Array.isArray(l))return;ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=3;ctx.strokeStyle=ready?'rgba(114,240,192,.95)':'rgba(98,232,255,.82)';for(const [a,b] of CONNECTIONS){if(vis(l[a])<.1||vis(l[b])<.1)continue;ctx.beginPath();ctx.moveTo(l[a].x*w,l[a].y*h);ctx.lineTo(l[b].x*w,l[b].y*h);ctx.stroke()}const ids=[0,11,12,13,14,15,16,23,24,25,26];for(const i of ids){if(vis(l[i])<.1)continue;ctx.beginPath();ctx.fillStyle=ready?'#72f0c0':'#62e8ff';ctx.arc(l[i].x*w,l[i].y*h,i===0?5.5:4.2,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(8,18,35,.8)';ctx.lineWidth=1.4;ctx.stroke()}}
function tick(){cancelAnimationFrame(raf);const run=()=>{try{ensureUI();const state=V()?.state,l=state?.latest,bs=bodyState(l);if(stage&&bs){setChip('bcHead',bs.head);setChip('bcShoulders',bs.shoulders);setChip('bcArms',bs.arms);setChip('bcTorso',bs.torso);setChip('bcKnees',bs.knees);$('bodyCoachPct').textContent=bs.pct+'%';const active=Boolean(state?.commandAt);$('bodyCoachState').textContent=bs.ready?(active?'BODY READY • DO THE MOVE':'BODY READY'):'BODY SEARCHING';$('bodyCoachHint').textContent=bs.ready?actionHint(state?.poseAction,l):!bs.head?'ถอย/ปรับกล้องให้เห็นศีรษะ':!bs.shoulders?'ให้เห็นไหล่ทั้งสองข้าง':!bs.arms?'ให้เห็นแขนอย่างน้อยถึงข้อศอกทั้งสองข้าง':!bs.torso?'ถอยอีกนิดให้เห็นสะโพกทั้งสองข้าง':'ถอยอีกนิดให้เห็นเข่าทั้งสองข้าง';stage.classList.toggle('body-ready',bs.ready);drawSkeleton(l,bs.ready)}else if(stage){$('bodyCoachPct')&&($('bodyCoachPct').textContent='0%');$('bodyCoachState')&&($('bodyCoachState').textContent='BODY SEARCHING');$('bodyCoachHint')&&($('bodyCoachHint').textContent='ยืนกลางกรอบและถอยให้เห็นช่วงตัวมากขึ้น');drawSkeleton(null,false)}}catch(e){console.warn('[LCA Body Coach]',e)}raf=requestAnimationFrame(run)};raf=requestAnimationFrame(run)}
injectStyle();tick();window.LEXICON_BODY_COACH=Object.freeze({release:RELEASE});
})();
