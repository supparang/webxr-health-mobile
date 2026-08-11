(()=>{
'use strict';
const RELEASE='20260811-LENS-PRODUCTION-AUTO-RETURN-V3-REWARD-AUTHORITY';
const q=new URLSearchParams(location.search);
const PROD=q.get('from')==='passport'&&q.get('authority')==='firebase'&&q.get('qa')!=='1'&&q.get('smoke')!=='1';
if(!PROD){window.LEXICON_LENS_AUTO_RETURN={release:RELEASE,enabled:false};return;}
let armed=false,timer=0,mirrorBusy=false,mirrorDone=false,rewardDone=false,interval=0;
function visible(el){return !!el&&!el.classList.contains('hidden')&&getComputedStyle(el).display!=='none';}
function findBackButton(layer){if(!layer)return null;return [...layer.querySelectorAll('button')].find(b=>/กลับ\s*Passport/i.test((b.textContent||'').trim()))||null;}
function readIdentity(){try{return JSON.parse(localStorage.getItem(window.EW_CONFIG?.cacheKeys?.identity||'ew_passport_identity_v1')||'null')}catch(_){return null}}
function readLocalBest(playerId){try{return JSON.parse(localStorage.getItem(`ew_bonus_lens_best::${playerId}`)||'null')}catch(_){return null}}
async function registerReward(playerId,score,nickname){
  if(rewardDone)return true;
  if(!window.firebase?.firestore)throw new Error('FIRESTORE_NOT_READY');
  const db=firebase.firestore();
  const progressSnap=await db.collection('ewp_progress').doc(playerId).get();
  if(!progressSnap.exists)throw new Error('BONUS_REWARD_PROGRESS_NOT_FOUND');
  const p=progressSnap.data()||{};
  const sessionId=String(p.attendanceSessionId||p.sessionId||'').trim();
  if(!sessionId)throw new Error('BONUS_REWARD_SESSION_REQUIRED');
  const rewardId=`${sessionId}__${playerId}`;
  const ref=db.collection('ewp_bonus_rewards').doc(rewardId);
  await db.runTransaction(async tx=>{
    const snap=await tx.get(ref);
    if(snap.exists)return;
    tx.set(ref,{
      rewardId,playerId,sessionId,nickname:String(nickname||playerId).trim(),
      bonusScore:Math.max(0,Math.min(100,Math.round(Number(score||0)))),
      completed:true,firstCompletedAt:firebase.firestore.FieldValue.serverTimestamp(),rewardClaimed:false,
      source:'lexicon_lens_hunt',sourceVersion:RELEASE,createdAt:firebase.firestore.FieldValue.serverTimestamp()
    });
  });
  rewardDone=true;
  return true;
}
async function mirrorBest(){
  if(mirrorBusy||mirrorDone)return mirrorDone;
  const identity=readIdentity();
  const playerId=String(identity?.playerId||q.get('pid')||q.get('playerId')||'').trim();
  const best=readLocalBest(playerId);
  if(!playerId||best?.score==null)return false;
  mirrorBusy=true;
  try{
    if(typeof window.EW_AUTHORITY?.resume!=='function')throw new Error('AUTHORITY_NOT_READY');
    const nickname=identity?.nickname||identity?.fullName||q.get('nickname')||'';
    const r=await window.EW_AUTHORITY.resume(playerId,nickname);
    if(!r?.ok)throw new Error(r?.error||'RESUME_FAILED');
    if(!window.firebase?.firestore)throw new Error('FIRESTORE_NOT_READY');
    const score=Number(best.score);if(!Number.isFinite(score))throw new Error('BONUS_SCORE_INVALID');
    const ref=firebase.firestore().collection('ewp_game_summary').doc(playerId);
    const snap=await ref.get();const current=snap.exists?Number(snap.data()?.bonusBest?.score):-Infinity;
    if(!Number.isFinite(current)||score>current){
      const now=new Date().toISOString();
      await ref.set({playerId,bonusBest:{score,receipt:String(best.receipt||''),at:String(best.at||now),source:'lens-production'},bonusUpdatedAt:now,updatedAt:now,sourceVersion:RELEASE},{merge:true});
    }
    await registerReward(playerId,score,nickname);
    mirrorDone=true;
    window.dispatchEvent(new CustomEvent('ew-bonus-summary-written',{detail:{playerId,score,rewardRegistered:rewardDone,release:RELEASE}}));
    return true;
  }catch(error){console.warn('Lens bonus summary/reward mirror failed',error);return false;}
  finally{mirrorBusy=false;}
}
async function check(){
  if(armed)return;
  const layer=document.getElementById('summaryLayer');if(!visible(layer))return;
  const text=layer.textContent||'';
  const saved=/บันทึก\s*Firebase[^\n]*สำเร็จ/i.test(text)||/Firebase\s*Analytics\s*สำเร็จ/i.test(text)||/event-[A-Za-z0-9_-]+/.test(text);
  if(!saved)return;
  const back=findBackButton(layer);if(!back)return;
  armed=true;back.dataset.autoReturnArmed='1';
  const status=document.createElement('div');status.id='lensAutoReturnStatus';status.style.cssText='margin-top:8px;text-align:center;font-size:.78rem;font-weight:800;color:#bfffe4';status.textContent='✓ Firebase สำเร็จ • กำลังซิงก์ Passport…';back.insertAdjacentElement('beforebegin',status);
  await mirrorBest();
  status.textContent=mirrorDone&&rewardDone?'✓ ซิงก์ Bonus + Reward สำเร็จ • กำลังกลับ Passport…':mirrorDone?'✓ ซิงก์ Bonus สำเร็จ • กำลังกลับ Passport…':'✓ บันทึกผลแล้ว • กำลังกลับ Passport…';
  timer=setTimeout(()=>{try{back.click()}catch(_){location.replace('./index.html?resume=passport&fromGame=bonus_lens&v=20260811-lens-reward-authority')}},900);
}
const observer=new MutationObserver(()=>{void check();});observer.observe(document.getElementById('summaryLayer')||document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class']});
interval=setInterval(()=>{void check();},500);
addEventListener('pagehide',()=>{clearTimeout(timer);clearInterval(interval);observer.disconnect()},{once:true});
void check();
window.LEXICON_LENS_AUTO_RETURN={release:RELEASE,enabled:true,mirrorBest,registerReward};
})();