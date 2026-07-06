/* CSAI2102 Teacher S2 Skill Panel v6.7.5 */
(()=>{'use strict';
  if(window.__AIQUEST_TEACHER_S2_SKILL_PANEL_V675__)return;
  window.__AIQUEST_TEACHER_S2_SKILL_PANEL_V675__=true;

  const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  const num=value=>{const n=Number(value);return Number.isFinite(n)?n:0;};
  const runtime=()=>window.AIQUEST_TEACHER_SAFE_V533||window.AIQUEST_TEACHER_SAFE_V532||null;
  const canonical=value=>String(value||'').trim().toLowerCase();

  function parsed(value){
    if(!value)return null;
    if(typeof value==='object')return value;
    try{return JSON.parse(String(value));}catch(e){return null;}
  }
  function stamp(attempt){return Date.parse(String(attempt.serverTs||attempt.clientTs||attempt.timestamp||''))||0;}
  function s2Meta(student){
    const attempts=(student&&Array.isArray(student.attempts)?student.attempts:[])
      .filter(attempt=>canonical(attempt.sessionId||attempt.missionId)==='s2')
      .sort((a,b)=>stamp(b)-stamp(a));
    for(const attempt of attempts){
      const candidates=[attempt.extraJson,attempt.extra,attempt.metrics,attempt.detail,attempt.payload];
      for(const candidate of candidates){
        const meta=parsed(candidate);
        if(meta&&meta.s2Skills)return {attempt,meta};
      }
    }
    return null;
  }
  function learner(modal){
    const id=String(modal.querySelector('h2')?.textContent||'').split('•')[0].trim();
    const students=runtime()?.state?.students||[];
    return students.find(student=>String(student.studentId||'').trim()===id)||null;
  }
  function percent(row){return row&&num(row.total)?Math.round(num(row.correct)/num(row.total)*100):0;}
  function grade(pct){return pct>=80?'strong':pct>=60?'watch':'support';}
  function label(name){
    const map={
      'PEAS ครบองค์ประกอบ':'PEAS Board',
      'Sensor / Actuator':'Sensor / Actuator',
      'Performance measure':'Performance Measure',
      'Rational action':'Rational Action',
      'Human oversight':'Human Oversight',
      'Agent concept':'Agent Concept',
      'Sensor reliability':'Sensor Reliability',
      'Environment':'Environment',
      'Why PEAS':'Why PEAS',
      'Trade-off':'Safety Trade-off',
      'Rationality':'Rationality',
      'Audit trail':'Audit Trail',
      'Human override':'Human Override',
      'Scope boundary':'Scope Boundary',
      'Agent test':'Agent Testing'
    };
    return map[name]||name;
  }
  function makePanel(student,record){
    const meta=record.meta||{},skills=meta.s2Skills||{};
    const rows=Object.entries(skills).filter(([,row])=>row&&num(row.total)>0);
    if(!rows.length)return null;
    const core=['PEAS ครบองค์ประกอบ','Sensor / Actuator','Performance measure','Rational action','Human oversight'];
    const coreRows=core.map(name=>[name,skills[name]]).filter(([,row])=>row&&num(row.total)>0);
    const allRows=[...coreRows,...rows.filter(([name])=>!core.includes(name))];
    const metrics=[
      ['Mechanic',meta.mechanicCorrect+'/'+(meta.mechanicCases||5)],
      ['Analysis',meta.knowledgeCorrect+'/'+(meta.knowledgeCases||8)],
      ['Case Twist',meta.twistCorrect+'/'+(meta.twistCases||2)],
      ['Replay Deck','#'+(meta.replayRound||'—')]
    ];
    const section=document.createElement('section');
    section.id='aiquestS2SkillPanelV675';
    section.style.cssText='margin-top:16px;padding-top:14px;border-top:1px solid rgba(148,163,184,.18)';
    section.innerHTML='<h3 style="margin:0">S2 Agent Builder • Skill Breakdown</h3><p style="margin:6px 0;color:#9fb2cc;line-height:1.55">ผลทักษะจาก Deck ล่าสุดที่นักศึกษาส่งเข้า Google Sheets</p>'+
      '<div style="display:grid;grid-template-columns:repeat(4,minmax(115px,1fr));gap:8px;margin:10px 0 12px">'+metrics.map(item=>'<div style="padding:10px;border:1px solid rgba(148,163,184,.20);border-radius:12px;background:rgba(255,255,255,.035)"><span style="display:block;color:#9fb2cc;font-size:11px">'+esc(item[0])+'</span><b style="font-size:18px">'+esc(item[1])+'</b></div>').join('')+'</div>'+
      '<div style="display:grid;gap:8px">'+allRows.map(([name,row])=>{const pct=percent(row),tone=grade(pct),color=tone==='strong'?'#34d399':tone==='watch'?'#fbbf24':'#fb7185';return '<div style="padding:10px 11px;border:1px solid rgba(148,163,184,.20);border-radius:12px;background:rgba(255,255,255,.03)"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><b>'+esc(label(name))+'</b><span style="color:'+color+';font-weight:850">'+num(row.correct)+'/'+num(row.total)+' • '+pct+'%</span></div><div style="height:7px;margin-top:7px;border-radius:999px;background:rgba(148,163,184,.16);overflow:hidden"><i style="display:block;height:100%;width:'+pct+'%;border-radius:999px;background:'+color+'"></i></div></div>';}).join('')+'</div>';
    return section;
  }
  function render(){
    const modal=document.getElementById('aiquestDirectStudentDetailV674');
    if(!modal||modal.querySelector('#aiquestS2SkillPanelV675'))return;
    const student=learner(modal),record=s2Meta(student);
    if(!student||!record)return;
    const panel=makePanel(student,record);
    if(!panel)return;
    const sections=modal.querySelectorAll('section');
    const target=[...sections].find(section=>/Latest Reflection/i.test(section.textContent||''))||sections[sections.length-1];
    target?.insertAdjacentElement('beforebegin',panel);
  }
  function boot(){
    new MutationObserver(()=>setTimeout(render,0)).observe(document.body,{childList:true,subtree:true});
    setInterval(render,350);
    render();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();