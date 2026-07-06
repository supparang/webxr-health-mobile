/* CSAI2102 Teacher S2 Replay Audit Diagnostic v6.7.9 */
(()=>{'use strict';
  if(window.__AIQUEST_TEACHER_S2_REPLAY_AUDIT_V679__)return;
  window.__AIQUEST_TEACHER_S2_REPLAY_AUDIT_V679__=true;

  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  const app=()=>window.AIQUEST_TEACHER_SAFE_V533||window.AIQUEST_TEACHER_SAFE_V532||null;
  const parse=v=>{if(!v)return{};if(typeof v==='object')return v;try{return JSON.parse(String(v))}catch(e){return{}}};
  const when=a=>Date.parse(String(a&& (a.serverTs||a.clientTs||a.timestamp)||''))||0;
  const shown=v=>{const d=new Date(when(v));return Number.isFinite(d.getTime())?d.toLocaleString():'—'};
  const s2=a=>String(a&& (a.sessionId||a.missionId)||'').trim().toLowerCase()==='s2';
  const policy=v=>({verify:'Verify',reversible:'Reversible',threshold:'Threshold',rights:'User rights',audit:'Audit',scope:'Scope',base:'Base'}[String(v||'').toLowerCase()]||String(v||'—'));
  const core=['PEAS ครบองค์ประกอบ','Sensor / Actuator','Performance measure','Rational action','Human oversight'];

  function student(modal){
    const id=String(modal.querySelector('h2')?.textContent||'').split('•')[0].trim();
    return (app()?.state?.students||[]).find(row=>String(row.studentId||'').trim()===id)||null;
  }
  function rows(person){
    return (person?.attempts||[]).filter(s2).sort((a,b)=>when(b)-when(a)).slice(0,4).map(attempt=>{
      const extra=parse(attempt.extraJson)||parse(attempt.extra)||parse(attempt.payload?.extraJson)||{};
      const audit=extra.replayAudit&&Array.isArray(extra.replayAudit.cards)?extra.replayAudit:null;
      return {attempt,extra,audit};
    });
  }
  function chips(values){
    const all=[...new Set((values||[]).filter(Boolean))];
    return all.length?'<div style="display:flex;flex-wrap:wrap;gap:5px">'+all.map(value=>'<span style="padding:3px 7px;border:1px solid rgba(167,139,250,.46);border-radius:999px;font-size:11px;background:rgba(255,255,255,.04)">'+esc(value)+'</span>').join('')+'</div>':'—';
  }
  function duplicateCount(audits){
    const known=new Set();let dupe=0;
    [...audits].reverse().forEach(row=>(row.audit?.cards||[]).forEach(card=>{
      const key=String(card.fingerprint||[card.context,card.skill,card.policy].join('|'));
      if(known.has(key))dupe++;else known.add(key);
    }));
    return dupe;
  }
  function render(){
    const modal=document.getElementById('aiquestDirectStudentDetailV674');
    if(!modal||modal.querySelector('#aiquestS2ReplayAuditV679'))return;
    const person=student(modal),list=rows(person);
    if(!person||!list.length)return;

    const audited=list.filter(row=>row.audit);
    const panel=document.createElement('section');
    panel.id='aiquestS2ReplayAuditV679';
    panel.style.cssText='margin-top:16px;padding-top:14px;border-top:1px solid rgba(148,163,184,.18)';

    let banner='',body='';
    if(!audited.length){
      banner='<div style="margin:10px 0;padding:11px 12px;border:1px solid rgba(251,191,36,.48);border-radius:13px;background:rgba(251,191,36,.10);color:#fde68a"><b>⚠ Replay Audit ยังไม่ถูกแนบมากับผล S2 ล่าสุด</b><br><span style="font-size:12px">Skill Breakdown แสดงได้ แต่ยังไม่มีหลักฐาน context/policy สำหรับตรวจคำตอบซ้ำ</span></div>';
      body='<table style="width:100%;border-collapse:collapse"><thead><tr style="background:#0d172a;color:#bae6fd"><th style="text-align:left;padding:9px">S2 attempt</th><th style="text-align:left;padding:9px">Deck</th><th style="text-align:left;padding:9px">Capture flag</th></tr></thead><tbody>'+list.map(row=>'<tr><td style="padding:9px;border-bottom:1px solid rgba(148,163,184,.12)">'+esc(shown(row.attempt))+'</td><td style="padding:9px;border-bottom:1px solid rgba(148,163,184,.12)">#'+esc(row.extra.replayRound||'—')+'</td><td style="padding:9px;border-bottom:1px solid rgba(148,163,184,.12)">'+(row.extra.replayAuditCaptured?'captured but missing payload':'not captured')+'</td></tr>').join('')+'</tbody></table>';
    }else{
      const dupes=duplicateCount(audited);
      banner=dupes?'<div style="margin:10px 0;padding:11px 12px;border:1px solid rgba(251,113,133,.48);border-radius:13px;background:rgba(251,113,133,.10);color:#fecdd3"><b>⚠ พบ answer fingerprint ซ้ำ '+dupes+' รายการ</b></div>':'<div style="margin:10px 0;padding:11px 12px;border:1px solid rgba(52,211,153,.45);border-radius:13px;background:rgba(52,211,153,.10);color:#bbf7d0"><b>✓ ไม่พบ answer fingerprint ซ้ำใน '+audited.length+' Deck ล่าสุด</b></div>';
      body='<div style="overflow:auto"><table style="width:100%;min-width:760px;border-collapse:collapse"><thead><tr style="background:#0d172a;color:#bae6fd"><th style="text-align:left;padding:9px">Deck</th><th style="text-align:left;padding:9px">Contexts</th><th style="text-align:left;padding:9px">Core policies</th><th style="text-align:left;padding:9px">Audit</th></tr></thead><tbody>'+audited.map(row=>{
        const a=row.audit,cards=a.cards||[];
        const contexts=a.contexts||[...new Set(cards.map(c=>c.context).filter(Boolean))];
        const policies=core.map(skill=>{const card=cards.find(c=>String(c.skill||'')===skill);return card?skill.replace('ครบองค์ประกอบ','')+' · '+policy(card.policy):null}).filter(Boolean);
        return '<tr><td style="padding:9px;border-bottom:1px solid rgba(148,163,184,.12)"><b>#'+esc(a.deckRound||row.extra.replayRound||'—')+'</b><br><span style="font-size:11px;color:#9fb2cc">'+esc(shown(row.attempt))+'</span></td><td style="padding:9px;border-bottom:1px solid rgba(148,163,184,.12)">'+chips(contexts)+'</td><td style="padding:9px;border-bottom:1px solid rgba(148,163,184,.12)">'+chips(policies)+'</td><td style="padding:9px;border-bottom:1px solid rgba(148,163,184,.12)">'+esc(a.cardCount||cards.length)+' cards<br><span style="font-size:11px;color:#9fb2cc">window '+esc(a.noRepeatWindow||4)+'</span></td></tr>';
      }).join('')+'</tbody></table></div>';
    }
    panel.innerHTML='<h3 style="margin:0">S2 Replay Audit • Latest '+list.length+' Decks</h3><p style="margin:6px 0;color:#9fb2cc;line-height:1.55">ตรวจ context + answer policy ที่แนบมากับผลการเล่นจริง</p>'+banner+body;
    const anchor=modal.querySelector('#aiquestS2SkillPanelV675')||modal.querySelector('section:last-of-type');
    anchor?.insertAdjacentElement('afterend',panel);
  }
  function boot(){new MutationObserver(()=>setTimeout(render,0)).observe(document.body,{childList:true,subtree:true});setInterval(render,350);render();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();