/* CSAI2102 Teacher S2 Semantic Replay Audit v6.9.6
   Shows only for the S2 session currently selected in the session-aware detail view.
   Legacy decks remain visible as history but do not make a new semantic deck fail.
*/
(()=>{'use strict';
  if(window.__AIQUEST_TEACHER_S2_REPLAY_AUDIT_V696__)return;
  window.__AIQUEST_TEACHER_S2_REPLAY_AUDIT_V696__=true;
  const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  const num=value=>{const n=Number(value);return Number.isFinite(n)?n:0;};
  const parse=value=>{if(!value)return{};if(typeof value==='object')return value;try{return JSON.parse(String(value));}catch(e){return {};}};
  const metaFor=attempt=>parse(attempt?.extraJson)||parse(attempt?.extra)||parse(attempt?.metrics)||{};
  const when=attempt=>Date.parse(String(attempt?.serverTs||attempt?.clientTs||attempt?.timestamp||''))||0;
  const fingerprints=attempt=>{const meta=metaFor(attempt),audit=meta.replayAudit||{},cards=Array.isArray(audit.cards)?audit.cards:[];return cards.map(card=>String(card.fingerprint||card.answerFingerprint||[card.context,card.skill,card.policy].join('|'))).filter(Boolean);};
  const duplicateCount=attempts=>{const seen=new Set();let repeats=0;[...attempts].sort((a,b)=>when(a)-when(b)).forEach(attempt=>fingerprints(attempt).forEach(key=>{if(seen.has(key))repeats++;else seen.add(key);}));return repeats;};
  function current(){return window.__AIQUEST_TEACHER_SESSION_DETAIL_V695_STATE__||null;}
  function render(detail=current()){
    document.getElementById('aiquestS2ReplayAuditV696')?.remove();
    if(!detail||String(detail.sessionId||'').toLowerCase()!=='s2')return;
    const host=document.getElementById('aqSessionDetailBody');if(!host)return;
    const attempts=(detail.group?.attempts||[]).slice().sort((a,b)=>when(b)-when(a));
    const semantic=attempts.filter(attempt=>String(metaFor(attempt).semanticDeckVersion||'')==='v6.9.6').slice(0,4);
    const latest=detail.attempt||semantic[0]||attempts[0]||null;
    const meta=metaFor(latest),integrity=meta.semanticDeckIntegrity||{},position=meta.answerPositionAudit||{};
    const panel=document.createElement('section');panel.id='aiquestS2ReplayAuditV696';panel.style.cssText='margin-top:14px;padding-top:14px;border-top:1px solid rgba(148,163,184,.18)';
    if(!latest){panel.innerHTML='<h3 style="margin:0">S2 Replay Integrity</h3><p style="color:#fde68a">ยังไม่มี attempt S2</p>';host.appendChild(panel);return;}
    if(String(meta.semanticDeckVersion||'')!=='v6.9.6'){
      panel.innerHTML='<h3 style="margin:0">S2 Replay Integrity</h3><p style="margin:7px 0;color:#fde68a">attempt นี้เป็น Deck รุ่นก่อน semantic integrity gate จึงใช้เป็นประวัติได้ แต่ยังไม่ใช้ยืนยัน anti-repeat รุ่นใหม่</p>';
      host.appendChild(panel);return;
    }
    const slots=(position.plannedSlots||integrity.answerSlots||[]).join('/');
    const semanticDupes=duplicateCount(semantic);
    const currentOk=integrity.ok===true&&num(integrity.contextUnique)===15&&num(integrity.conceptUnique)===15&&num(integrity.sourceUnique)===15&&num(integrity.promptPatternUnique)===15&&num(integrity.fingerprintUnique)===15;
    panel.innerHTML='<h3 style="margin:0">S2 Replay Integrity • Semantic Deck</h3><p style="margin:6px 0;color:#9fb2cc">ตรวจเฉพาะ Deck รุ่น v6.9.6 ที่สร้างหลังเปิด integrity gate</p><div style="margin-top:9px;padding:11px;border:1px solid '+(currentOk?'rgba(52,211,153,.42)':'rgba(251,113,133,.42)')+';border-radius:13px;background:'+(currentOk?'rgba(6,78,59,.18)':'rgba(127,29,29,.18)')+';color:'+(currentOk?'#bbf7d0':'#fecdd3')+'"><b>'+(currentOk?'✓ Deck ปัจจุบันผ่าน Semantic Integrity':'⚠ Deck ปัจจุบันไม่ผ่าน Integrity')+'</b><br><span style="font-size:12px">Context '+esc(integrity.contextUnique||0)+'/15 • Concept '+esc(integrity.conceptUnique||0)+'/15 • Source '+esc(integrity.sourceUnique||0)+'/15 • Prompt pattern '+esc(integrity.promptPatternUnique||0)+'/15 • Fingerprint '+esc(integrity.fingerprintUnique||0)+'/15 • Answer slots '+esc(slots||'—')+'</span></div><p style="margin:9px 0 0;color:'+(semanticDupes?'#fde68a':'#bbf7d0')+'">'+(semanticDupes?'⚠ พบ fingerprint ซ้ำ '+semanticDupes+' รายการใน '+semantic.length+' Semantic Deck ล่าสุด':'✓ ไม่พบ answer fingerprint ซ้ำใน '+semantic.length+' Semantic Deck ล่าสุด')+'</p>';
    host.appendChild(panel);
  }
  window.addEventListener('aiquest:session-detail-change',event=>render(event.detail));
  new MutationObserver(()=>render()).observe(document.body,{childList:true,subtree:true});
})();