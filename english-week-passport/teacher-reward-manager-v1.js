(function(){
'use strict';
const VERSION='2026-08-11-TEACHER-REWARD-MANAGER-FIRST20-V1';
const COL='ewp_bonus_rewards';
const LIMIT=20;
let currentSession='D1-AM';
let rows=[];
let loading=false;
const h=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const clean=v=>String(v==null?'':v).trim();
function millis(v){try{return typeof v?.toMillis==='function'?v.toMillis():new Date(v||0).getTime()||0}catch(_){return 0}}
function timeText(v){const ms=millis(v);return ms?new Date(ms).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'—'}
function dateTime(v){const ms=millis(v);return ms?new Date(ms).toLocaleString('th-TH'):'—'}
function insertUi(){
  if(document.getElementById('rewardManagerCard'))return;
  const anchor=document.querySelector('.session-panel');if(!anchor)return;
  const section=document.createElement('section');
  section.id='rewardManagerCard';section.className='card';section.style.marginBottom='12px';
  section.innerHTML=`<div class="session-head"><div><strong>🎁 Bonus Reward • First 20 Finishers</strong><div class="note">Lexicon Lens Hunt • รางวัลสำหรับ 20 คนแรกของแต่ละรอบ • จัดอันดับด้วย Firebase server timestamp</div></div><button id="rewardRefreshBtn" class="btn">↻ Refresh Rewards</button></div>
  <div id="rewardKpis" class="learning" style="margin-bottom:10px"></div>
  <div class="table-wrap"><table class="table" style="min-width:820px"><thead><tr><th>Rank</th><th>ผู้เล่น</th><th>เสร็จเวลา</th><th>Bonus</th><th>Reward</th><th>รับรางวัล</th></tr></thead><tbody id="rewardBody"></tbody></table></div>
  <p class="note" id="rewardNote" style="margin:10px 0 0">ยังไม่โหลดข้อมูลรางวัล</p>`;
  anchor.insertAdjacentElement('afterend',section);
  document.getElementById('rewardRefreshBtn').addEventListener('click',()=>refresh(true));
}
function render(){
  insertUi();
  const winners=rows.slice(0,LIMIT);
  const claimed=winners.filter(r=>r.rewardClaimed===true).length;
  const waiting=winners.length-claimed;
  document.getElementById('rewardKpis').innerHTML=[
    [`${rows.length}`,'Bonus Completed'],
    [`${winners.length}/${LIMIT}`,'Reward Winners'],
    [`${claimed}`,'Claimed'],
    [`${waiting}`,'Waiting Pickup']
  ].map(([v,l])=>`<div class="metric"><strong>${h(v)}</strong><small>${h(l)}</small></div>`).join('');
  document.getElementById('rewardBody').innerHTML=winners.length?winners.map((r,i)=>`<tr>
    <td><strong>#${i+1}</strong></td>
    <td><strong>${h(r.nickname||r.playerId)}</strong><br><small>${h(r.playerId)}</small></td>
    <td><strong>${h(timeText(r.firstCompletedAt))}</strong><br><small>${h(dateTime(r.firstCompletedAt))}</small></td>
    <td><strong>${Math.round(Number(r.bonusScore||0))}%</strong></td>
    <td class="good">🎁 Eligible</td>
    <td>${r.rewardClaimed?`<span class="good">✓ Received</span><br><small>${h(timeText(r.rewardClaimedAt))}</small><br><button class="btn reward-toggle" data-id="${h(r.id)}" data-claimed="1" style="margin-top:5px">Undo</button>`:`<button class="btn primary reward-toggle" data-id="${h(r.id)}" data-claimed="0">Mark as Claimed</button>`}</td>
  </tr>`).join(''):'<tr><td colspan="6" class="note">ยังไม่มีผู้เล่นทำ Bonus Mission สำเร็จในรอบนี้</td></tr>';
  document.getElementById('rewardNote').textContent=rows.length>LIMIT?`มีผู้ทำ Bonus สำเร็จ ${rows.length} คน • ผู้ได้รางวัลคือ 20 คนแรก • อีก ${rows.length-LIMIT} คนทำสำเร็จหลังลำดับรางวัล`:`รอบ ${currentSession} • ใช้ firstCompletedAt จาก server • เล่นซ้ำไม่เปลี่ยนลำดับเดิม`;
  document.querySelectorAll('.reward-toggle').forEach(btn=>btn.addEventListener('click',()=>toggleClaim(btn.dataset.id,btn.dataset.claimed!=='1')));
}
async function loadRows(){
  const db=firebase.firestore();
  const snap=await db.collection(COL).where('sessionId','==',currentSession).get();
  rows=snap.docs.map(d=>({id:d.id,...(d.data()||{})})).filter(r=>r.completed===true)
    .sort((a,b)=>millis(a.firstCompletedAt)-millis(b.firstCompletedAt)||String(a.id).localeCompare(String(b.id)));
}
async function refresh(force=false){
  if(loading)return;insertUi();
  const select=document.getElementById('sessionFilter');currentSession=clean(select?.value||currentSession)||'D1-AM';
  loading=true;const b=document.getElementById('rewardRefreshBtn');if(b)b.disabled=true;
  try{
    const user=firebase.auth().currentUser;if(!user||user.isAnonymous)throw new Error('TEACHER_SIGN_IN_REQUIRED');
    await loadRows();render();
  }catch(error){console.error('[LEXICON X] Reward Manager load failed',error);const note=document.getElementById('rewardNote');if(note)note.textContent='โหลด Reward Manager ไม่สำเร็จ: '+String(error?.message||error);
  }finally{loading=false;if(b)b.disabled=false;}
}
async function toggleClaim(id,claimed){
  const user=firebase.auth().currentUser;if(!user||user.isAnonymous)return;
  const ref=firebase.firestore().collection(COL).doc(id);
  const patch={rewardClaimed:Boolean(claimed),updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
  if(claimed){patch.rewardClaimedAt=firebase.firestore.FieldValue.serverTimestamp();patch.claimedBy=user.uid;patch.claimedByEmail=user.email||'';}
  else{patch.rewardClaimedAt=null;patch.claimedBy='';patch.claimedByEmail='';}
  try{await ref.update(patch);await refresh(true)}catch(error){console.error(error);alert('บันทึกสถานะรับรางวัลไม่สำเร็จ: '+String(error?.message||error));}
}
function bind(){
  insertUi();
  document.getElementById('sessionFilter')?.addEventListener('change',()=>setTimeout(()=>refresh(true),50));
  document.getElementById('refreshBtn')?.addEventListener('click',()=>setTimeout(()=>refresh(true),150));
  firebase.auth().onAuthStateChanged(user=>{if(user&&!user.isAnonymous)setTimeout(()=>refresh(true),250);});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
window.EW_TEACHER_REWARD_MANAGER=Object.freeze({version:VERSION,refresh:()=>refresh(true),limit:LIMIT});
})();