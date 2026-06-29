/* EAP Word Quest v215 stable release guard */
(() => {
  "use strict";
  const VERSION="v2.1.5-STABLE-RELEASE-GUARD-122";
  if(window.__EAP_WORD_V215_RELEASE_GUARD__) return;
  window.__EAP_WORD_V215_RELEASE_GUARD__=true;
  const $=id=>document.getElementById(id);
  const norm=value=>String(value==null?"":value).replace(/\s+/g," ").trim();
  const key=value=>norm(value).toLowerCase().replace(/[’']/g,"");
  const current=()=>window.EAP_V203_LAST_RESULT||window.EAP_V202_LAST_RESULT||window.EAP_V196_LAST_RESULT||window.EAP_V195_LAST_RESULT||window.EAP_V192_LAST_RESULT||null;
  const game=()=>Boolean($("gameScreen")?.classList.contains("active"));
  const summary=()=>Boolean($("summaryScreen")?.classList.contains("active"));
  const setText=(node,value)=>{if(node&&node.textContent!==value)node.textContent=value;};

  const style=document.createElement("style");style.id="eapV215ReleaseGuardStyle";style.textContent="#questionTags .eap215-tag{display:inline-flex;align-items:center;border:1px solid #dbeafe;background:#f8fafc;color:#475569;border-radius:999px;padding:5px 8px;font-size:11px;font-weight:900}#summaryWeakPracticeBtn{border-color:#fed7aa!important;background:#fff7ed!important;color:#9a3412!important}";if(!$("eapV215ReleaseGuardStyle"))document.head.appendChild(style);

  function tags(){
    if(!game()) return;
    const root=$("questionTags");if(!root)return;
    const types={definition:"ความหมาย",context:"ใช้บริบท",application:"สถานการณ์",repair:"เลือกให้เหมาะ",boss:"Boss Challenge","boss-recovery":"Boss Warm-up"};
    Array.from(root.querySelectorAll("span")).forEach((tag,index)=>{
      const raw=norm(tag.dataset.eapV215Raw||tag.textContent);
      if(!tag.dataset.eapV215Raw)tag.dataset.eapV215Raw=raw;
      if(/^Target\s*:/i.test(raw)||/^Mission target\s*:/i.test(raw)||index===2||/^(core|chunk|stretch|spiral|director-rest)$/i.test(raw)){tag.remove();return;}
      let next=raw;if(/^(A2\+?|B1\+?)$/i.test(raw))next=`ระดับ ${raw}`;else if(types[key(raw)])next=types[key(raw)];setText(tag,next);tag.classList.add("eap215-tag");
    });
  }
  function toast(){const node=$("toast");if(!node||node.hidden)return;const text=norm(node.textContent);const start=text.match(/^(S(?:1[0-5]|[1-9])|BG[1-5])\s+Core Bank started$/i);if(start)setText(node,`เริ่ม ${start[1].toUpperCase()} แล้ว • อ่านบริบทก่อนเลือกคำตอบ`);}
  function weakButton(){
    if(!summary())return;const actions=document.querySelector("#summaryScreen .summary-actions"),run=current();if(!actions||!run)return;let button=$("summaryWeakPracticeBtn");if(!button){button=document.createElement("button");button.id="summaryWeakPracticeBtn";button.type="button";button.className="btn secondary";button.textContent="ฝึกคำที่พลาด";const deck=$("summaryDeckBtn");if(deck)deck.insertAdjacentElement("beforebegin",button);else actions.appendChild(button);}const weak=Array.isArray(run.weakWords)?run.weakWords.filter(Boolean):[];button.hidden=!weak.length;button.disabled=!weak.length;
  }
  function startWeak(){const run=current(),sid=norm(run&&run.sessionId).toUpperCase();if(!/^(S(?:1[0-5]|[1-9])|BG[1-5])$/.test(sid))return;if(typeof window.startEapCoreSession==="function")window.startEapCoreSession(sid,"weak");}
  function issue(item){const problems=[],choices=Array.isArray(item&&item.choices)?item.choices:[];if(choices.length!==4)problems.push("choices_not_four");if(choices.filter(row=>row&&row.correct).length!==1)problems.push("correct_count_not_one");const used=new Set();choices.forEach(row=>{const id=key(row&&row.text);if(!id||used.has(id))problems.push("duplicate_or_blank_choice");used.add(id);});if(!norm(item&&item.target)||!norm(item&&item.answerTerm))problems.push("missing_target_or_answer");return problems;}
  function preflight(){const bank=window.EAP_CORE_QUESTION_BANK,order=bank&&Array.isArray(bank.sessionOrder)?bank.sessionOrder:[];const report={version:VERSION,ready:Boolean(bank&&order.length===20),sessionCount:order.length,itemTotal:Number(bank&&bank.itemTotal)||0,sessions:{},issues:[]};order.forEach(id=>{const rows=Array.isArray(bank.bySession[id])?bank.bySession[id]:[];const problems=rows.flatMap(row=>issue(row).map(problem=>`${row.id}:${problem}`));report.sessions[id]={items:rows.length,issues:problems};report.issues.push(...problems);});report.ready=report.ready&&!report.issues.length;return report;}
  function patch(){tags();toast();weakButton();}
  document.addEventListener("click",event=>{const button=event.target?.closest?.("#summaryWeakPracticeBtn");if(button){event.preventDefault();event.stopImmediatePropagation();startWeak();return;}[80,220,520].forEach(delay=>setTimeout(patch,delay));},true);
  window.addEventListener("eap-core-run-finished",()=>[80,260,700].forEach(delay=>setTimeout(patch,delay)));
  [100,450,1200].forEach(delay=>setTimeout(patch,delay));setTimeout(()=>{window.EAP_WORD_RELEASE_PREFLIGHT=preflight();console.info("[EAP Word Quest] release preflight",window.EAP_WORD_RELEASE_PREFLIGHT);},1500);
  window.inspectEapReleaseQA=()=>window.EAP_WORD_RELEASE_PREFLIGHT||preflight();window.inspectEapV215=()=>({version:VERSION,gameActive:game(),summaryActive:summary(),targetLeakVisible:Array.from(document.querySelectorAll("#questionTags span")).some(node=>/^Target\s*:/i.test(norm(node.textContent))),weakRecoveryVisible:Boolean($("summaryWeakPracticeBtn")&&!$("summaryWeakPracticeBtn").hidden),preflight:window.EAP_WORD_RELEASE_PREFLIGHT||null});
})();
