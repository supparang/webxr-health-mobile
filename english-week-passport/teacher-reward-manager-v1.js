(function(){
'use strict';
const VERSION='2026-08-12-TEACHER-AWARD-AUTHORITY-V4-FINISH-PLUS-BONUS';
const BONUS_COL='ewp_bonus_rewards';
const PROGRESS_COL='ewp_progress';
const PROFILE_COL='ewp_profiles';
const REWARD_LIMIT=20;
let currentSession='D1-AM';
let bonusRows=[];
let finishRows=[];
let eligibleRows=[];
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
  section.innerHTML=`<div class="session-head"><div><strong>🎁 Event Reward • First 20 Finishers + Bonus</strong><div class="note">มีสิทธิ์เมื่อ <strong>จบ Journey สมบูรณ์</strong> และ <strong>ทำ Lexicon Lens Hunt สำเร็จ</strong> เท่านั้น • จัดอันดับ 20 คนแรกของแต่ละรอบด้วย Journey <code>finishedAt</code> จาก Firebase server</div></div><button id="rewardRefreshBtn" class="btn">↻ Refresh Awards</button></div>
  <div id="awardKpis" class="learning" style="margin-bottom:10px"></div>
  <div class="grid section-grid" style="margin-top:0">
    <div><h2 style="margin:0 0 8px">🏆 Reward Eligible • Top 20</h2><div class="table-wrap"><table class="table" style="min-width:760px"><thead><tr><th>Rank</th><th>ผู้เล่น</th><th>Journey Finish</th><th>Bonus</th><th>Reward</th></tr></thead><tbody id="eligibleBody"></tbody></table></div><p class="note" id="eligibleNote" style="margin:8px 0 0"></p></div>
    <div><h2 style="margin:0 0 8px">🔎 Finish / Bonus Audit</h2><div class="table-wrap"><table class="table" style="min-width:690px"><thead><tr><th>ผู้เล่น</th><th>Finish</th><th>Lens Hunt</th><th>Eligibility</th></tr></thead><tbody id="auditBody"></tbody></table></div><p class="note" id="auditNote" style="margin:8px 0 0"></p></div>
  </div>`;
  anchor.insertAdjacentElement('afterend',section);document.getElementById('rewardRefreshBtn').addEventListener('click',()=>refresh(true));
}
function render(){
  insertUi();
  const winners=eligibleRows.slice(0,REWARD_LIMIT),claimed=winners.filter(r=>r.rewardClaimed===true).length;
  const validFinish=finishRows.filter(r=>r.validFinish),bonusCompleted=bonusRows.length;
  document.getElementById('awardKpis').innerHTML=[
    [`${validFinish.length}`,'Journey Finishers'],
    [`${bonusCompleted}`,'Lens Hunt Completed'],
    [`${winners.length}/${REWARD_LIMIT}`,'Reward Eligible'],
    [`${claimed}/${winners.length}`,'Rewards Claimed']
  ].map(([v,l])=>`<div class="metric"><strong>${h(v)}</strong><small>${h(l)}</small></div>`).join('');

  document.getElementById('eligibleBody').innerHTML=winners.length?winners.map((r,i)=>`<tr>
    <td><strong>#${i+1}</strong>${i===0?' 🏆':''}</td>
    <td><strong>${h(r.nickname||r.playerId)}</strong><br><small>${h(r.playerId)}</small></td>
    <td><strong>${h(timeText(r.finishedAt))}</strong><br><small>${h(dateTime(r.finishedAt))}</small></td>
    <td><strong>${Math.round(Number(r.bonusScore||0))}% ✓</strong></td>
    <td>${r.rewardClaimed?`<span class="good">✓ Received</span><br><small>${h(timeText(r.rewardClaimedAt))}</small><br><button class="btn reward-toggle" data-id="${h(r.rewardId)}" data-claimed="1" style="margin-top:5px">Undo</button>`:`<button class="btn primary reward-toggle" data-id="${h(r.rewardId)}" data-claimed="0">Mark Claimed</button>`}</td>
  </tr>`).join(''):'<tr><td colspan="5" class="note">ยังไม่มีผู้เล่นที่จบ Journey และทำ Lexicon Lens Hunt ครบทั้งสองเงื่อนไขในรอบนี้</td></tr>';
  document.getElementById('eligibleNote').textContent=`รอบ ${currentSession} • คนจบเร็วแต่ไม่ทำ Bonus ไม่มีสิทธิ์ • คนทำ Bonus แต่ยังไม่จบ Journey ยังไม่มีสิทธิ์ • เมื่อครบทั้งสองเงื่อนไขจึงจัดอันดับด้วย finishedAt • สูงสุด ${REWARD_LIMIT} คน/รอบ`;

  const bonusMap=new Map(bonusRows.map(r=>[clean(r.playerId),r]));
  const audit=finishRows.filter(r=>r.validFinish).slice(0,30);
  document.getElementById('auditBody').innerHTML=audit.length?audit.map(r=>{const b=bonusMap.get(r.playerId),winnerIndex=eligibleRows.findIndex(x=>x.playerId===r.playerId),eligible=winnerIndex>=0&&winnerIndex<REWARD_LIMIT;return `<tr><td><strong>${h(r.nickname||r.playerId)}</strong><br><small>${h(r.playerId)}</small></td><td>${h(timeText(r.finishedAt))}</td><td>${b?`<span class="good">✓ ${Math.round(Number(b.bonusScore||0))}%</span>`:'<span class="warn">ยังไม่ทำ Bonus</span>'}</td><td>${eligible?`<span class="good">🎁 Eligible #${winnerIndex+1}</span>`:'<span class="note">ไม่มีสิทธิ์รางวัล</span>'}</td></tr>`}).join(''):'<tr><td colspan="4" class="note">ยังไม่มี Journey Finisher ในรอบนี้</td></tr>';
  const noFinishBonus=bonusRows.filter(b=>!finishRows.some(f=>f.playerId===clean(b.playerId)&&f.validFinish)).length;
  document.getElementById('auditNote').textContent=`Audit: Journey Finish ${validFinish.length} คน • Bonus ${bonusCompleted} คน${noFinishBonus?` • ทำ Bonus แล้วแต่ยังไม่จบ Journey ${noFinishBonus} คน`:''}`;
  document.querySelectorAll('.reward-toggle').forEach(btn=>btn.addEventListener('click',()=>toggleClaim(btn.dataset.id,btn.dataset.claimed!=='1')));
}
async function loadRows(){
  const db=firebase.firestore();
  const [bonusSnap,progressSnap]=await Promise.all([
    db.collection(BONUS_COL).where('sessionId','==',currentSession).get(),
    db.collection(PROGRESS_COL).where('attendanceSessionId','==',currentSession).get()
  ]);
  bonusRows=bonusSnap.docs.map(d=>({id:d.id,...(d.data()||{})})).filter(r=>r.completed===true);
  const rawProgress=progressSnap.docs.map(d=>({id:d.id,...(d.data()||{})}));
  const ids=rawProgress.map(r=>clean(r.playerId||r.id)).filter(Boolean);
  const profileMap=new Map();
  await Promise.all(ids.map(async id=>{try{const s=await db.collection(PROFILE_COL).doc(id).get();if(s.exists)profileMap.set(id,s.data()||{})}catch(_){}}));
  finishRows=rawProgress.map(p=>{const playerId=clean(p.playerId||p.id),profile=profileMap.get(playerId)||{};const validFinish=Boolean(p.summaryViewed&&p.certificateEligible&&p.finishedAt&&p.certificate?.certificateId);return {...p,playerId,nickname:clean(profile.nickname||profile.fullName||playerId),validFinish};})
    .sort((a,b)=>{if(a.validFinish!==b.validFinish)return a.validFinish?-1:1;return millis(a.finishedAt)-millis(b.finishedAt)||String(a.playerId).localeCompare(String(b.playerId));});
  const bonusMap=new Map(bonusRows.map(r=>[clean(r.playerId),r]));
  eligibleRows=finishRows.filter(f=>f.validFinish&&bonusMap.has(f.playerId)).map(f=>{const b=bonusMap.get(f.playerId);return {...f,rewardId:b.id,bonusScore:Number(b.bonusScore||0),firstCompletedAt:b.firstCompletedAt,rewardClaimed:b.rewardClaimed===true,rewardClaimedAt:b.rewardClaimedAt,rewardRank:b.rewardRank,rewardEligible:b.rewardEligible};})
    .sort((a,b)=>millis(a.finishedAt)-millis(b.finishedAt)||String(a.playerId).localeCompare(String(b.playerId)));
}
async function stampRewardRanks(){
  const bonusMap=new Map(bonusRows.map(r=>[clean(r.playerId),r]));
  const eligibleMap=new Map(eligibleRows.map((r,i)=>[r.playerId,{rank:i+1,eligible:i<REWARD_LIMIT}]));
  if(!bonusRows.length)return;
  const db=firebase.firestore(),batch=db.batch();let writes=0;
  bonusRows.forEach(r=>{const playerId=clean(r.playerId),e=eligibleMap.get(playerId),eligible=Boolean(e?.eligible),rank=eligible?e.rank:null;if(Boolean(r.rewardEligible)!==eligible||(eligible&&Number(r.rewardRank)!==rank)||(!eligible&&r.rewardRank!=null)){batch.update(db.collection(BONUS_COL).doc(r.id),{rewardEligible:eligible,rewardRank:rank,rankedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()});writes+=1;}});
  if(writes){await batch.commit();await loadRows();}
}
async function refresh(){
  if(loading)return;insertUi();currentSession=clean(document.getElementById('sessionFilter')?.value||currentSession)||'D1-AM';loading=true;const b=document.getElementById('rewardRefreshBtn');if(b)b.disabled=true;
  try{const user=firebase.auth().currentUser;if(!user||user.isAnonymous)throw new Error('TEACHER_SIGN_IN_REQUIRED');await loadRows();await stampRewardRanks();render();}
  catch(error){console.error('[LEXICON X] Award Authority load failed',error);const note=document.getElementById('eligibleNote');if(note)note.textContent='โหลด Award Authority ไม่สำเร็จ: '+String(error?.message||error);}
  finally{loading=false;if(b)b.disabled=false;}
}
async function toggleClaim(id,claimed){
  const user=firebase.auth().currentUser;if(!user||user.isAnonymous)return;
  const row=bonusRows.find(r=>r.id===id);if(!row)return;
  const eligible=eligibleRows.slice(0,REWARD_LIMIT).some(r=>r.rewardId===id);
  if(claimed&&!eligible){alert('ผู้เล่นรายนี้ยังไม่มีสิทธิ์รับรางวัล: ต้องจบ Journey และทำ Bonus พร้อมอยู่ใน 20 คนแรกของรอบ');return;}
  const ref=firebase.firestore().collection(BONUS_COL).doc(id);const patch={rewardClaimed:Boolean(claimed),updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
  if(claimed){patch.rewardClaimedAt=firebase.firestore.FieldValue.serverTimestamp();patch.claimedBy=user.uid;patch.claimedByEmail=user.email||'';}else{patch.rewardClaimedAt=null;patch.claimedBy='';patch.claimedByEmail='';}
  try{await ref.update(patch);await refresh()}catch(error){console.error(error);alert('บันทึกสถานะรับรางวัลไม่สำเร็จ: '+String(error?.message||error));}
}
function bind(){insertUi();document.getElementById('sessionFilter')?.addEventListener('change',()=>setTimeout(refresh,50));document.getElementById('refreshBtn')?.addEventListener('click',()=>setTimeout(refresh,150));firebase.auth().onAuthStateChanged(user=>{if(user&&!user.isAnonymous)setTimeout(refresh,250);});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
window.EW_TEACHER_REWARD_MANAGER=Object.freeze({version:VERSION,refresh,rewardLimit:REWARD_LIMIT,eligibility:'journey-finished+bonus-completed'});
})();