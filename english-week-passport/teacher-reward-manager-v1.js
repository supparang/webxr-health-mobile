(function(){
'use strict';
const VERSION='2026-08-12-TEACHER-AWARD-AUTHORITY-V4.2-QUALIFIED-AT';
const BONUS_COL='ewp_bonus_rewards';
const PROGRESS_COL='ewp_progress';
const PROFILE_COL='ewp_profiles';
const SUMMARY_COL='ewp_game_summary';
const REWARD_LIMIT=20;
let currentSession='D1-AM';
let bonusRows=[];
let finishRows=[];
let eligibleRows=[];
let summaryBonusMap=new Map();
let loading=false;
const h=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const clean=v=>String(v==null?'':v).trim();
function millis(v){try{return typeof v?.toMillis==='function'?v.toMillis():new Date(v||0).getTime()||0}catch(_){return 0}}
function timeText(v){const ms=millis(v);return ms?new Date(ms).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'—'}
function dateTime(v){const ms=millis(v);return ms?new Date(ms).toLocaleString('th-TH'):'—'}
function normalizeBonusBest(v){if(!v||v.score==null)return null;const score=Number(v.score);return Number.isFinite(score)?{score,receipt:clean(v.receipt),at:v.at||v.updatedAt||null,source:clean(v.source||'game-summary')} : null;}
function qualifiedMillis(finishAt,bonusAt){const f=millis(finishAt),b=millis(bonusAt);return f&&b?Math.max(f,b):0;}
function qualifiedDateValue(row){const ms=Number(row?.qualifiedAtMs||0);return ms?new Date(ms):null;}
function insertUi(){
  if(document.getElementById('rewardManagerCard'))return;
  const anchor=document.querySelector('.session-panel');if(!anchor)return;
  const section=document.createElement('section');section.id='rewardManagerCard';section.className='card';section.style.marginBottom='12px';
  section.innerHTML=`<div class="session-head"><div><strong>🎁 Event Reward • First 20 to Complete Journey + Bonus</strong><div class="note">มีสิทธิ์เมื่อ <strong>จบ Journey สมบูรณ์</strong> และ <strong>ทำ Lexicon Lens Hunt สำเร็จ</strong> เท่านั้น • จัดอันดับจากเวลาที่ผู้เล่นทำครบทั้งสองเงื่อนไข (<code>qualifiedAt = max(Journey finishedAt, Bonus firstCompletedAt)</code>) จาก Firebase server • Bonus เก่าที่ไม่มี timestamp แสดงเพื่อ audit แต่ไม่จัดอันดับย้อนหลัง</div></div><button id="rewardRefreshBtn" class="btn">↻ Refresh Awards</button></div>
  <div id="awardKpis" class="learning" style="margin-bottom:10px"></div>
  <div class="grid section-grid" style="margin-top:0">
    <div><h2 style="margin:0 0 8px">🏆 Reward Eligible • Top 20</h2><div class="table-wrap"><table class="table" style="min-width:820px"><thead><tr><th>Rank</th><th>ผู้เล่น</th><th>Journey Finish</th><th>Bonus</th><th>Qualified</th><th>Reward</th></tr></thead><tbody id="eligibleBody"></tbody></table></div><p class="note" id="eligibleNote" style="margin:8px 0 0"></p></div>
    <div><h2 style="margin:0 0 8px">🔎 Finish / Bonus Audit</h2><div class="table-wrap"><table class="table" style="min-width:720px"><thead><tr><th>ผู้เล่น</th><th>Finish</th><th>Lens Hunt</th><th>Eligibility</th></tr></thead><tbody id="auditBody"></tbody></table></div><p class="note" id="auditNote" style="margin:8px 0 0"></p></div>
  </div>`;
  anchor.insertAdjacentElement('afterend',section);document.getElementById('rewardRefreshBtn').addEventListener('click',()=>refresh(true));
}
function render(){
  insertUi();
  const winners=eligibleRows.slice(0,REWARD_LIMIT),claimed=winners.filter(r=>r.rewardClaimed===true).length;
  const validFinish=finishRows.filter(r=>r.validFinish);
  const authoritativeBonusIds=new Set(bonusRows.map(r=>clean(r.playerId)));
  const allBonusIds=new Set([...authoritativeBonusIds,...summaryBonusMap.keys()]);
  document.getElementById('awardKpis').innerHTML=[
    [`${validFinish.length}`,'Journey Finishers'],
    [`${allBonusIds.size}`,'Lens Hunt Completed'],
    [`${winners.length}/${REWARD_LIMIT}`,'Reward Eligible'],
    [`${claimed}/${winners.length}`,'Rewards Claimed']
  ].map(([v,l])=>`<div class="metric"><strong>${h(v)}</strong><small>${h(l)}</small></div>`).join('');

  document.getElementById('eligibleBody').innerHTML=winners.length?winners.map((r,i)=>`<tr>
    <td><strong>#${i+1}</strong>${i===0?' 🏆':''}</td>
    <td><strong>${h(r.nickname||r.playerId)}</strong><br><small>${h(r.playerId)}</small></td>
    <td><strong>${h(timeText(r.finishedAt))}</strong><br><small>${h(dateTime(r.finishedAt))}</small></td>
    <td><strong>${Math.round(Number(r.bonusScore||0))}% ✓</strong><br><small>${h(timeText(r.firstCompletedAt))}</small></td>
    <td><strong>${h(timeText(qualifiedDateValue(r)))}</strong><br><small>${h(dateTime(qualifiedDateValue(r)))}</small></td>
    <td>${r.rewardClaimed?`<span class="good">✓ Received</span><br><small>${h(timeText(r.rewardClaimedAt))}</small><br><button class="btn reward-toggle" data-id="${h(r.rewardId)}" data-claimed="1" style="margin-top:5px">Undo</button>`:`<button class="btn primary reward-toggle" data-id="${h(r.rewardId)}" data-claimed="0">Mark Claimed</button>`}</td>
  </tr>`).join(''):'<tr><td colspan="6" class="note">ยังไม่มีผู้เล่นที่มีหลักฐาน server-authoritative ครบทั้ง Journey Finish และ Lens Hunt สำหรับการจัดอันดับรางวัล</td></tr>';
  document.getElementById('eligibleNote').textContent=`รอบ ${currentSession} • ต้องทำ Journey + Bonus ครบทั้งคู่ • จัดอันดับตามเวลาที่ครบเงื่อนไขทั้งสองจริง • Bonus legacy ที่ไม่มี firstCompletedAt ไม่ถูกนำมาจัดอันดับ • สูงสุด ${REWARD_LIMIT} คน/รอบ`;

  const bonusMap=new Map(bonusRows.map(r=>[clean(r.playerId),r]));
  const auditIds=new Set([...finishRows.map(r=>r.playerId),...summaryBonusMap.keys(),...bonusRows.map(r=>clean(r.playerId))]);
  const finishMap=new Map(finishRows.map(r=>[r.playerId,r]));
  const audit=[...auditIds].map(playerId=>finishMap.get(playerId)||{playerId,nickname:playerId,validFinish:false}).slice(0,40);
  document.getElementById('auditBody').innerHTML=audit.length?audit.map(r=>{
    const authBonus=bonusMap.get(r.playerId),legacy=summaryBonusMap.get(r.playerId),winnerIndex=eligibleRows.findIndex(x=>x.playerId===r.playerId),eligible=winnerIndex>=0&&winnerIndex<REWARD_LIMIT;
    let bonusCell='<span class="warn">ยังไม่ทำ Bonus</span>';
    if(authBonus)bonusCell=`<span class="good">✓ ${Math.round(Number(authBonus.bonusScore||0))}% • timestamp ready</span>`;
    else if(legacy)bonusCell=`<span class="good">✓ ${Math.round(Number(legacy.score||0))}%</span><br><small>Legacy Bonus • not ranked</small>`;
    let status='<span class="note">ไม่มีสิทธิ์รางวัล</span>';
    if(eligible)status=`<span class="good">🎁 Eligible #${winnerIndex+1}</span><br><small>ครบสองเงื่อนไข ${h(timeText(qualifiedDateValue(eligibleRows[winnerIndex])))}</small>`;
    else if(r.validFinish&&legacy&&!authBonus)status='<span class="warn">ทำ Bonus แล้ว • ไม่มี reward timestamp</span>';
    else if(!r.validFinish&&(authBonus||legacy))status='<span class="note">ทำ Bonus แล้ว • ยังไม่จบ Journey</span>';
    return `<tr><td><strong>${h(r.nickname||r.playerId)}</strong><br><small>${h(r.playerId)}</small></td><td>${r.validFinish?h(timeText(r.finishedAt)):'—'}</td><td>${bonusCell}</td><td>${status}</td></tr>`;
  }).join(''):'<tr><td colspan="4" class="note">ยังไม่มีข้อมูลในรอบนี้</td></tr>';
  const legacyOnly=[...summaryBonusMap.keys()].filter(id=>!authoritativeBonusIds.has(id)).length;
  document.getElementById('auditNote').textContent=`Audit: Journey Finish ${validFinish.length} คน • Lens Hunt ${allBonusIds.size} คน • authoritative reward timestamp ${authoritativeBonusIds.size} คน${legacyOnly?` • legacy Bonus ไม่มี timestamp ${legacyOnly} คน`:''}`;
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
  const profileMap=new Map();summaryBonusMap=new Map();
  await Promise.all(ids.map(async id=>{
    try{const [p,s]=await Promise.all([db.collection(PROFILE_COL).doc(id).get(),db.collection(SUMMARY_COL).doc(id).get()]);if(p.exists)profileMap.set(id,p.data()||{});if(s.exists){const best=normalizeBonusBest((s.data()||{}).bonusBest);if(best)summaryBonusMap.set(id,best);}}catch(_){}
  }));
  finishRows=rawProgress.map(p=>{const playerId=clean(p.playerId||p.id),profile=profileMap.get(playerId)||{};const validFinish=Boolean(p.summaryViewed&&p.certificateEligible&&p.finishedAt&&p.certificate?.certificateId);return {...p,playerId,nickname:clean(profile.nickname||profile.fullName||playerId),validFinish};})
    .sort((a,b)=>{if(a.validFinish!==b.validFinish)return a.validFinish?-1:1;return millis(a.finishedAt)-millis(b.finishedAt)||String(a.playerId).localeCompare(String(b.playerId));});
  const bonusMap=new Map(bonusRows.map(r=>[clean(r.playerId),r]));
  eligibleRows=finishRows.filter(f=>f.validFinish&&bonusMap.has(f.playerId)).map(f=>{const b=bonusMap.get(f.playerId);return {...f,rewardId:b.id,bonusScore:Number(b.bonusScore||0),firstCompletedAt:b.firstCompletedAt,qualifiedAtMs:qualifiedMillis(f.finishedAt,b.firstCompletedAt),rewardClaimed:b.rewardClaimed===true,rewardClaimedAt:b.rewardClaimedAt,rewardRank:b.rewardRank,rewardEligible:b.rewardEligible};})
    .filter(r=>r.qualifiedAtMs>0)
    .sort((a,b)=>a.qualifiedAtMs-b.qualifiedAtMs||String(a.playerId).localeCompare(String(b.playerId)));
}
async function stampRewardRanks(){
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
window.EW_TEACHER_REWARD_MANAGER=Object.freeze({version:VERSION,refresh,rewardLimit:REWARD_LIMIT,eligibility:'journey-finished+authoritative-bonus',ranking:'qualifiedAt=max(finishedAt,firstCompletedAt)'});
})();