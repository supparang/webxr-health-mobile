/* CSAI2102 Teacher S2 Replay Audit v6.7.8 */
(()=>{'use strict';
  if(window.__AIQUEST_TEACHER_S2_REPLAY_AUDIT_V678__)return;
  window.__AIQUEST_TEACHER_S2_REPLAY_AUDIT_V678__=true;

  const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  const runtime=()=>window.AIQUEST_TEACHER_SAFE_V533||window.AIQUEST_TEACHER_SAFE_V532||null;
  const stamp=attempt=>Date.parse(String(attempt&& (attempt.serverTs||attempt.clientTs||attempt.timestamp)||''))||0;
  const parse=value=>{if(!value)return null;if(typeof value==='object')return value;try{return JSON.parse(String(value))}catch(e){return null}};
  const canonical=value=>String(value||'').trim().toLowerCase();
  const dateText=value=>{const n=Date.parse(String(value||''));return Number.isFinite(n)?new Date(n).toLocaleString():'—'};
  const shortSkill=skill=>({
    'PEAS ครบองค์ประกอบ':'PEAS',
    'Sensor / Actuator':'Sensor/Actuator',
    'Performance measure':'Performance',
    'Rational action':'Rational',
    'Human oversight':'Oversight',
    'Agent concept':'Agent',
    'Sensor reliability':'Sensor reliability',
    'Environment':'Environment',
    'Why PEAS':'Why PEAS',
    'Trade-off':'Trade-off',
    'Rationality':'Rationality',
    'Audit trail':'Audit trail',
    'Human override':'Human override',
    'Scope boundary':'Scope boundary',
    'Agent test':'Testing',
    'Case Twist: low confidence':'Low confidence',
    'Case Twist: user rights':'User rights',
    'Case Twist: changed context':'Changed context',
    'Case Twist: conflicting goals':'Conflicting goals'
  }[skill]||skill);
  const policyLabel=value=>({verify:'Verify',reversible:'Reversible',threshold:'Threshold',rights:'User rights',audit:'Audit',scope:'Scope',base:'Base'}[String(value||'').toLowerCase()]||String(value||'—'));

  function findStudent(modal){
    const id=String(modal.querySelector('h2')?.textContent||'').split('•')[0].trim();
    return (runtime()?.state?.students||[]).find(student=>String(student.studentId||'').trim()===id)||null;
  }
  function s2Audits(student){
    return (student&&Array.isArray(student.attempts)?student.attempts:[])
      .filter(attempt=>canonical(attempt.sessionId||attempt.missionId)==='s2')
      .map(attempt=>{
        const extra=parse(attempt.extraJson)||parse(attempt.extra)||parse(attempt.payload?.extraJson)||{};
        const audit=extra&&extra.replayAudit;
        return {attempt,extra,audit:audit&&Array.isArray(audit.cards)?audit:null};
      })
      .filter(row=>row.audit)
      .sort((a,b)=>stamp(b.attempt)-stamp(a.attempt))
      .slice(0,4);
  }
  function auditStatus(rows){
    const seen=new Map(),duplicates=[];
    [...rows].reverse().forEach(row=>{
      (row.audit.cards||[]).forEach(card=>{
        const key=String(card.fingerprint||[card.context,card.skill,card.policy].join('|'));
        if(seen.has(key))duplicates.push({key,now:row,ahead:seen.get(key),card});
        else seen.set(key,row);
      });
    });
    return {duplicates,unique:seen.size};
  }
  function chips(values,tone){
    const unique=[...new Set((values||[]).filter(Boolean))];
    return unique.length?'<div style="display:flex;gap:5px;flex-wrap:wrap">'+unique.map(value=>'<span style="display:inline-flex;padding:3px 7px;border-radius:999px;border:1px solid '+(tone||'rgba(148,163,184,.28)')+';font-size:11px;background:rgba(255,255,255,.04)">'+esc(value)+'</span>').join('')+'</div>':'<span style="color:#9fb2cc">—</span>';
  }
  function policySummary(cards){
    const core=['PEAS ครบองค์ประกอบ','Sensor / Actuator','Performance measure','Rational action','Human oversight'];
    return core.map(skill=>{
      const card=(cards||[]).find(item=>String(item.skill||'')===skill);
      return card?shortSkill(skill)+' · '+policyLabel(card.policy):null;
    }).filter(Boolean);
  }
  function render(){
    const modal=document.getElementById('aiquestDirectStudentDetailV674');
    if(!modal||modal.querySelector('#aiquestS2ReplayAuditV678'))return;
    const student=findStudent(modal),rows=s2Audits(student);
    if(!student||!rows.length)return;
    const status=auditStatus(rows);
    const panel=document.createElement('section');
    panel.id='aiquestS2ReplayAuditV678';
    panel.style.cssText='margin-top:16px;padding-top:14px;border-top:1px solid rgba(148,163,184,.18)';
    const alert=status.duplicates.length
      ?'<div style="margin:10px 0;padding:10px 12px;border:1px solid rgba(251,113,133,.48);border-radius:13px;background:rgba(251,113,133,.1);color:#fecdd3"><b>⚠ พบ answer fingerprint ซ้ำ '+status.duplicates.length+' รายการ</b><br><span style="font-size:12px">ตรวจ Deck และ policy ที่ซ้ำด้านล่าง</span></div>'
      :'<div style="margin:10px 0;padding:10px 12px;border:1px solid rgba(52,211,153,.45);border-radius:13px;background:rgba(52,211,153,.10);color:#bbf7d0"><b>✓ ไม่พบ answer fingerprint ซ้ำใน '+rows.length+' Deck ล่าสุด</b><br><span style="font-size:12px">ตรวจจาก context + skill + answer policy ที่ส่งจริงของแต่ละ Deck</span></div>';
    const table=rows.map(row=>{
      const a=row.audit,attempt=row.attempt,cards=a.cards||[];
      const contexts=(a.contexts&&a.contexts.length?a.contexts:[...new Set(cards.map(card=>card.context).filter(Boolean))]);
      const policies=policySummary(cards);
      return '<tr><td><b>Deck #'+esc(a.deckRound||row.extra.replayRound||'—')+'</b><br><span style="color:#9fb2cc;font-size:11px">'+esc(dateText(attempt.serverTs||attempt.clientTs||attempt.timestamp))+'</span></td><td>'+esc(String(attempt.score??'—'))+'</td><td>'+chips(contexts,'rgba(56,189,248,.42)')+'</td><td>'+chips(policies,'rgba(167,139,250,.45)')+'</td><td>'+esc(String(a.cardCount||cards.length||'—'))+' cards<br><span style="color:#9fb2cc;font-size:11px">window '+esc(String(a.noRepeatWindow||4))+'</span></td></tr>';
    }).join('');
    panel.innerHTML='<h3 style="margin:0">S2 Replay Audit • Latest '+rows.length+' Decks</h3><p style="margin:6px 0;color:#9fb2cc;line-height:1.55">หลักฐานว่าชุดคำตอบที่ส่งจริงหมุน context + policy และตรวจไม่ซ้ำตาม answer fingerprint</p>'+alert+
      '<div style="overflow:auto"><table style="width:100%;min-width:780px;border-collapse:collapse"><thead><tr style="background:#0d172a;color:#bae6fd"><th style="text-align:left;padding:9px">Deck</th><th style="text-align:left;padding:9px">Score</th><th style="text-align:left;padding:9px">Contexts</th><th style="text-align:left;padding:9px">Core policies</th><th style="text-align:left;padding:9px">Audit</th></tr></thead><tbody>'+table+'</tbody></table></div>';
    const target=modal.querySelector('#aiquestS2SkillPanelV675');
    if(target)target.insertAdjacentElement('afterend',panel);else modal.querySelector('.modal-panel')?.appendChild(panel);
  }
  function boot(){
    new MutationObserver(()=>setTimeout(render,0)).observe(document.body,{childList:true,subtree:true});
    setInterval(render,350);render();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();