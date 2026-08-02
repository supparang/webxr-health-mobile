/* EAP Hero • Recent Portfolio Truth v147
   Shows pending local evidence immediately and replaces it with cloud-confirmed
   Google Sheet records after player_resume. Does not alter unlock authority.
*/
(() => {
  'use strict';
  const VERSION='20260802-EAP-RECENT-PORTFOLIO-TRUTH-V147-CLOUD-AND-PENDING';
  const STATE_KEY='EAP_HERO_PROGRESS_V3';
  const SKILLS=['Reading','Writing','Listening','Speaking'];
  const STYLE_ID='eap-portfolio-truth-v147-style';
  let timer=0;

  const txt=v=>String(v??'').replace(/\s+/g,' ').trim();
  const esc=v=>txt(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sid=v=>{const m=txt(v).toUpperCase().match(/(?:SESSION\s*:?\s*|\bS)(1[0-5]|[1-9])\b/);return m?'S'+Number(m[1]):'';};
  const skill=v=>SKILLS.find(s=>txt(v).toLowerCase().includes(s.toLowerCase()))||'';
  const score=r=>{for(const v of [r?.bestScore,r?.latestScore,r?.score,r?.autoScore,r?.missionTaskScore,r?.accuracy]){const n=Number(v);if(Number.isFinite(n)&&n>=0&&n<=100)return n;}return 0;};
  const stamp=r=>{for(const v of [r?.updatedAt,r?.submittedAt,r?.latestAt,r?.completedAt,r?.createdAt,r?.clientTimestamp,r?.timestamp,r?.date]){if(!v)continue;const d=new Date(v);if(!Number.isNaN(d.getTime()))return d.toISOString();}return '';};
  const output=r=>{for(const v of [r?.studentOutput,r?.output,r?.answer,r?.response,r?.reflection,r?.summary]){const t=txt(v);if(t&&!/legacy|migration|browser-storage|system|pending sheet sync/i.test(t))return t;}return score(r)>=60?'ทำภารกิจสำเร็จแล้ว':'บันทึกผลการฝึกแล้ว';};
  const isCloud=r=>!!(r&&(r.cloudVerified===true||r.serverVerified===true||r.restoredFromSheet===true||r.sourceAuthority==='sheet'||r.authority==='sheet'||r.submittedAt||r.summaryId||r.attemptId));

  function state(){try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')||{};}catch(_){return{};}}
  function collect(){
    const s=state();
    const server=s.serverResume||{};
    const cloud=[
      ...(Array.isArray(server.records)?server.records:[]),
      ...(Array.isArray(server.attempts)?server.attempts:[]),
      ...(Array.isArray(server.summaries)?server.summaries:[]),
      ...(Array.isArray(server.summary)?server.summary:[]),
      ...(Array.isArray(server.skillRecords)?server.skillRecords:[]),
      ...(Array.isArray(s.cloudPortfolio)?s.cloudPortfolio:[])
    ];
    const local=Array.isArray(s.portfolio)?s.portfolio:[];
    const map=new Map();

    cloud.forEach(r=>add(r,true));
    local.forEach(r=>add(r,isCloud(r)));

    function add(r,verified){
      const session=sid(r?.sessionId||r?.routeId||r?.session||r?.sessionCode||r?.taskId);
      const sk=skill(r?.skill||r?.skillName||r?.evidenceType||r?.type||r?.taskId);
      const sc=score(r),ts=stamp(r);
      if(!session||!sk||sc<=0)return;
      if(r?.legacyCompletion===true||String(r?.legacyCompletion).toUpperCase()==='TRUE')return;
      const key=session+'|'+sk;
      const rec={sessionId:session,skill:sk,score:sc,timestamp:ts,output:output(r),verified:!!verified};
      const old=map.get(key);
      if(!old||(!old.verified&&rec.verified)||rec.score>old.score||(rec.score===old.score&&rec.timestamp>old.timestamp))map.set(key,rec);
    }

    return [...map.values()].sort((a,b)=>{
      if(a.verified!==b.verified)return a.verified?-1:1;
      if(a.timestamp&&b.timestamp&&a.timestamp!==b.timestamp)return b.timestamp.localeCompare(a.timestamp);
      return Number(b.sessionId.slice(1))-Number(a.sessionId.slice(1));
    }).slice(0,12);
  }

  function dateTH(v){if(!v)return 'รอเวลายืนยัน';const d=new Date(v);if(Number.isNaN(d.getTime()))return 'รอเวลายืนยัน';return new Intl.DateTimeFormat('th-TH',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Bangkok'}).format(d);}
  function inject(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
      body.eap-portfolio-v147-ready #app .recent-portfolio table,
      body.eap-portfolio-v147-ready #app .eap2-portfolio>table,
      body.eap-portfolio-v147-ready #app .eap142-summary{display:none!important}
      .eap147-wrap{margin-top:12px;overflow:auto}.eap147-table{width:100%;min-width:690px;border-collapse:collapse;font-size:12px}.eap147-table th,.eap147-table td{padding:10px 12px;border-bottom:1px solid rgba(148,163,184,.18);text-align:left}.eap147-table th{color:#a7f3d0;background:rgba(255,255,255,.04);font-weight:900}.eap147-score{font-weight:950;color:#6ee7b7}.eap147-status{display:inline-block;padding:4px 8px;border-radius:999px;font-weight:900;white-space:nowrap}.eap147-status.verified{background:#dcfce7;color:#166534}.eap147-status.pending{background:#fef3c7;color:#92400e}.eap147-empty{padding:18px;border:1px dashed rgba(148,163,184,.3);border-radius:12px;text-align:center;color:#cbd5e1;background:rgba(255,255,255,.025)}
    `;document.head.appendChild(s);
  }
  function host(){const v2=document.querySelector('#eap-skill-hub-v2 .eap2-portfolio');if(v2)return v2;const heading=[...document.querySelectorAll('#app h2,#app h3,#app h4')].find(n=>/recent portfolio/i.test(txt(n.textContent)));return heading?.parentElement||null;}
  function render(){
    inject();const h=host();if(!h)return;
    document.body.classList.add('eap-portfolio-v147-ready');
    let wrap=h.querySelector('.eap147-wrap');if(!wrap){wrap=document.createElement('div');wrap.className='eap147-wrap';h.appendChild(wrap);}
    const data=collect();
    if(!data.length){wrap.innerHTML='<div class="eap147-empty">ยังไม่มีผลการทำภารกิจ</div>';return;}
    wrap.innerHTML='<table class="eap147-table"><thead><tr><th>วันที่/เวลา (ICT)</th><th>Session</th><th>Skill</th><th>Score</th><th>สถานะ</th><th>ผลลัพธ์</th></tr></thead><tbody>'+data.map(r=>`<tr><td>${esc(dateTH(r.timestamp))}</td><td>${esc(r.sessionId)}</td><td>${esc(r.skill)}</td><td class="eap147-score">${r.score}/100</td><td><span class="eap147-status ${r.verified?'verified':'pending'}">${r.verified?'ยืนยันจาก Google Sheet แล้ว':'กำลังส่งไป Google Sheet'}</span></td><td>${esc(r.output)}</td></tr>`).join('')+'</tbody></table>';
    document.documentElement.dataset.eapPortfolioTruthVersion=VERSION;
  }
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(render,120);};
  ['load','storage','eap:resume-synced','eap:cloud-resume-applied','eap:local-result-saved','eap:route-changed','eap:sheet-delivery-queued'].forEach(e=>window.addEventListener(e,schedule));
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  setInterval(schedule,1500);schedule();
  window.EAPRecentPortfolioTruthV147={render,collect,version:VERSION};
})();
