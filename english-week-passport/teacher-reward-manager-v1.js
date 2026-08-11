(function(){
'use strict';
const VERSION='2026-08-11-TEACHER-AWARD-AUTHORITY-V3-FAST-BONUS';
const BONUS_COL='ewp_bonus_rewards';
const PROGRESS_COL='ewp_progress';
const PROFILE_COL='ewp_profiles';
const BONUS_LIMIT=20;
let currentSession='D1-AM';
let bonusRows=[];
let finishRows=[];
let loading=false;
const h=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const clean=v=>String(v==null?'':v).trim();
function millis(v){try{return typeof v?.toMillis==='function'?v.toMillis():new Date(v||0).getTime()||0}catch(_){return 0}}
function timeText(v){const ms=millis(v);return ms?new Date(ms).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'—'}
function dateTime(v){const ms=millis(v);return ms?new Date(ms).toLocaleString('th-TH'):'—'}
function insertUi(){
  if(document.getElementById('rewardManagerCard'))return;
  const anchor=document.querySelector('.session-panel');if(!anchor)return;
  const section=document.createElement('section');section.id='rewardManagerCard';section.className='card';section.style.marginBottom='12px';
  section.innerHTML=`<div class="session-head"><div><strong>🏆 Event Awards • Fast Finisher + Bonus Hunter</strong><div class="note">Fast Finisher ใช้ Journey <code>finishedAt</code> จาก Firebase server • Bonus ใช้ server timestamp และคะแนน Lens Hunt</div></div><button id="rewardRefreshBtn" class="btn">↻ Refresh Awards</button></div>
  <div id="awardKpis" class="learning" style="margin-bottom:10px"></div>
  <div class="grid section-grid" style="margin-top:0">
    <div><h2 style="margin:0 0 8px">🏆 Fast Finisher Leaderboard</h2><div class="table-wrap"><table class="table" style="min-width:620px"><thead><tr><th>Rank</th><th>ผู้เล่น</th><th>Finish</th><th>Status</th></tr></thead><tbody id="finishBody"></tbody></table></div><p class="note" id="finishNote" style="margin:8px 0 0"></p></div>
    <div><h2 style="margin:0 0 8px">⭐ Bonus Hunter Leaderboard</h2><div class="table-wrap"><table class="table" style="min-width:650px"><thead><tr><th>Rank</th><th>ผู้เล่น</th><th>Bonus</th><th>Completed</th><th>Reward</th></tr></thead><tbody id="bonusBody"></tbody></table></div><p class="note" id="bonusNote" style="margin:8px 0 0"></p></div>
  </div>`;
  anchor.insertAdjacentElement('afterend',section);document.getElementById('rewardRefreshBtn').addEventListener('click',()=>refresh(true));
}
function render(){
  insertUi();
  const validFinish=finishRows.filter(r=>r.validFinish);
  const fastWinner=validFinish[0]||null;
  const bonusHunter=bonusRows[0]||null;
  const first20=bonusRows.slice().sort((a,b)=>millis(a.firstCompletedAt)-millis(b.firstCompletedAt)||String(a.id).localeCompare(String(b.id))).slice(0,BONUS_LIMIT);
  const claimed=first20.filter(r=>r.rewardClaimed===true).length;
  document.getElementById('awardKpis').innerHTML=[
    [`${validFinish.length}`,'Valid Finishers'],[fastWinner?`#1 ${h(fastWinner.nickname||fastWinner.playerId)}`:'—','Fast Finisher'],[bonusHunter?`${Math.round(Number(bonusHunter.bonusScore||0))}%`:'—','Best Bonus'],[`${claimed}/${first20.length}`,'Bonus Rewards Claimed']
  ].map(([v,l])=>`<div class="metric"><strong>${v}</strong><small>${h(l)}</small></div>`).join('');

  document.getElementById('finishBody').innerHTML=validFinish.length?validFinish.slice(0,10).map((r,i)=>`<tr><td><strong>#${i+1}</strong>${i===0?' 🏆':''}</td><td><strong>${h(r.nickname||r.playerId)}</strong><br><small>${h(r.playerId)}</small></td><td><strong>${h(timeText(r.finishedAt))}</strong><br><small>${h(dateTime(r.finishedAt))}</small></td><td class="good">✓ Certificate-valid</td></tr>`).join(''):'<tr><td colspan="4" class="note">ยังไม่มีผู้เล่นที่มี server-authoritative finish ในรอบนี้</td></tr>';
  const legacy=finishRows.filter(r=>!r.validFinish&&(r.summaryViewed&&r.certificateEligible)).length;
  document.getElementById('finishNote').textContent=`รอบ ${currentSession} • จัดอันดับเฉพาะ summaryViewed + certificateEligible + finishedAt จาก server${legacy?` • พบข้อมูลเก่าที่ยังไม่มี finishedAt ${legacy} คน (ไม่นำมาจัดอันดับ)`:''}`;

  document.getElementById('bonusBody').innerHTML=bonusRows.length?bonusRows.slice(0,10).map((r,i)=>{
    const rewardRank=first20.findIndex(x=>x.id===r.id)+1;const eligible=rewardRank>0&&rewardRank<=BONUS_LIMIT;
    return `<tr><td><strong>#${i+1}</strong>${i===0?' ⭐':''}</td><td><strong>${h(r.nickname||r.playerId)}</strong><br><small>${h(r.playerId)}</small></td><td><strong>${Math.round(Number(r.bonusScore||0))}%</strong></td><td><strong>${h(timeText(r.firstCompletedAt))}</strong></td><td>${eligible?(r.rewardClaimed?`<span class="good">✓ Received</span><br><button class="btn reward-toggle" data-id="${h(r.id)}" data-claimed="1">Undo</button>`:`<button class="btn primary reward-toggle" data-id="${h(r.id)}" data-claimed="0">Mark Claimed</button>`):'<span class="note">Completed</span>'}</td></tr>`}).join(''):'<tr><td colspan="5" class="note">ยังไม่มีผู้เล่นทำ Lexicon Lens Hunt สำเร็จในรอบนี้</td></tr>';
  document.getElementById('bonusNote').textContent=`Bonus Hunter จัดอันดับด้วยคะแนนสูงสุด → ถ้าคะแนนเท่ากันใช้ firstCompletedAt จาก server • ระบบ First-20 reward เดิมยังคงสิทธิ์ตามเวลาจบ Bonus`;
  document.querySelectorAll('.reward-toggle').forEach(btn=>btn.addEventListener('click',()=>toggleClaim(btn.dataset.id,btn.dataset.claimed!=='1')));
}
async function loadRows(){
  const db=firebase.firestore();
  const [bonusSnap,progressSnap]=await Promise.all([
    db.collection(BONUS_COL).where('sessionId','==',currentSession).get(),
    db.collection(PROGRESS_COL).where('attendanceSessionId','==',currentSession).get()
  ]);
  bonusRows=bonusSnap.docs.map(d=>({id:d.id,...(d.data()||{})})).filter(r=>r.completed===true)
    .sort((a,b)=>Number(b.bonusScore||0)-Number(a.bonusScore||0)||millis(a.firstCompletedAt)-millis(b.firstCompletedAt)||String(a.id).localeCompare(String(b.id)));
  const rawProgress=progressSnap.docs.map(d=>({id:d.id,...(d.data()||{})}));
  const ids=rawProgress.map(r=>clean(r.playerId||r.id)).filter(Boolean);
  const profileMap=new Map();
  await Promise.all(ids.map(async id=>{try{const s=await db.collection(PROFILE_COL).doc(id).get();if(s.exists)profileMap.set(id,s.data()||{})}catch(_){}}));
  finishRows=rawProgress.map(p=>{const playerId=clean(p.playerId||p.id),profile=profileMap.get(playerId)||{};const validFinish=Boolean(p.summaryViewed&&p.certificateEligible&&p.finishedAt&&p.certificate?.certificateId);return {...p,playerId,nickname:clean(profile.nickname||profile.fullName||playerId),validFinish};})
    .sort((a,b)=>{if(a.validFinish!==b.validFinish)return a.validFinish?-1:1;return millis(a.finishedAt)-millis(b.finishedAt)||String(a.playerId).localeCompare(String(b.playerId));});
}
async function stampBonusRanks(){
  const byTime=bonusRows.slice().sort((a,b)=>millis(a.firstCompletedAt)-millis(b.firstCompletedAt)||String(a.id).localeCompare(String(b.id)));
  if(!byTime.length)return;
  const db=firebase.firestore(),batch=db.batch();let writes=0;
  byTime.forEach((r,i)=>{const eligible=i<BONUS_LIMIT,rank=eligible?i+1:null;if(Boolean(r.rewardEligible)!==eligible||(eligible&&Number(r.rewardRank)!==rank)||(!eligible&&r.rewardRank!=null)){batch.update(db.collection(BONUS_COL).doc(r.id),{rewardEligible:eligible,rewardRank:rank,rankedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()});writes+=1;}});
  if(writes){await batch.commit();await loadRows();}
}
async function refresh(){
  if(loading)return;insertUi();currentSession=clean(document.getElementById('sessionFilter')?.value||currentSession)||'D1-AM';loading=true;const b=document.getElementById('rewardRefreshBtn');if(b)b.disabled=true;
  try{const user=firebase.auth().currentUser;if(!user||user.isAnonymous)throw new Error('TEACHER_SIGN_IN_REQUIRED');await loadRows();await stampBonusRanks();render();}
  catch(error){console.error('[LEXICON X] Award Authority load failed',error);document.getElementById('finishNote').textContent='โหลด Award Authority ไม่สำเร็จ: '+String(error?.message||error);}
  finally{loading=false;if(b)b.disabled=false;}
}
async function toggleClaim(id,claimed){
  const user=firebase.auth().currentUser;if(!user||user.isAnonymous)return;const ref=firebase.firestore().collection(BONUS_COL).doc(id);const patch={rewardClaimed:Boolean(claimed),updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
  if(claimed){patch.rewardClaimedAt=firebase.firestore.FieldValue.serverTimestamp();patch.claimedBy=user.uid;patch.claimedByEmail=user.email||'';}else{patch.rewardClaimedAt=null;patch.claimedBy='';patch.claimedByEmail='';}
  try{await ref.update(patch);await refresh()}catch(error){console.error(error);alert('บันทึกสถานะรับรางวัลไม่สำเร็จ: '+String(error?.message||error));}
}
function bind(){insertUi();document.getElementById('sessionFilter')?.addEventListener('change',()=>setTimeout(refresh,50));document.getElementById('refreshBtn')?.addEventListener('click',()=>setTimeout(refresh,150));firebase.auth().onAuthStateChanged(user=>{if(user&&!user.isAnonymous)setTimeout(refresh,250);});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
window.EW_TEACHER_REWARD_MANAGER=Object.freeze({version:VERSION,refresh,bonusLimit:BONUS_LIMIT});
})();