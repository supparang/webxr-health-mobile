/* CSAI2102 Teacher Console — Learning Analytics Suite v7.2.1
   Part 2: heatmap, weak concepts, traps, risk, radar, timeline,
   alerts, class analytics, reflection analytics, evidence summary.
*/
(()=>{'use strict';
  if(window.__AIQUEST_TEACHER_LEARNING_ANALYTICS_V710__)return;
  window.__AIQUEST_TEACHER_LEARNING_ANALYTICS_V710__=true;
  const VERSION='v7.2.1';
  const ORDER=['s1','s2','s3','b1','s4','s5','s6','b2','s7','s8','s9','b3','s10','s11','s12','b4','s13','s14','s15','b5'];
  const TITLES={s1:'S1',s2:'S2',s3:'S3',b1:'B1',s4:'S4',s5:'S5',s6:'S6',b2:'B2',s7:'S7',s8:'S8',s9:'S9',b3:'B3',s10:'S10',s11:'S11',s12:'S12',b4:'B4',s13:'S13',s14:'S14',s15:'S15',b5:'B5'};
  const runtime=()=>window.AIQUEST_TEACHER_SAFE_V533||window.AIQUEST_TEACHER_SAFE_V532||null;
  const v699=()=>window.AIQUEST_TEACHER_UNIFIED_ANALYTICS_V699||null;
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const arr=v=>Array.isArray(v)?v:[];
  const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
  const num=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
  const parse=v=>{if(v&&typeof v==='object')return v;if(typeof v==='string'){try{return JSON.parse(v)}catch(e){return {}}}return {}};
  const stamp=a=>Date.parse(String(a?.serverTs||a?.clientTs||a?.timestamp||''))||0;
  const canon=v=>{const x=String(v||'').toLowerCase().trim().replace(/[\s_\-:]+/g,'');const m={m1:'s1',session1:'s1',mission1:'s1',m2:'s2',session2:'s2',mission2:'s2',m3:'s3',session3:'s3',mission3:'s3',boss1:'b1',m4:'s4',session4:'s4',mission4:'s4',m5:'s5',session5:'s5',mission5:'s5',m6:'s6',session6:'s6',mission6:'s6',boss2:'b2',m7:'s7',session7:'s7',mission7:'s7',m8:'s8',session8:'s8',mission8:'s8',m9:'s9',session9:'s9',mission9:'s9',boss3:'b3',m10:'s10',session10:'s10',mission10:'s10',m11:'s11',session11:'s11',mission11:'s11',m12:'s12',session12:'s12',mission12:'s12',boss4:'b4',m13:'s13',session13:'s13',mission13:'s13',m14:'s14',session14:'s14',mission14:'s14',m15:'s15',session15:'s15',mission15:'s15',boss5:'b5'};return m[x]||x;};
  function meta(a){const e=parse(a?.extraJson||a?.extra),raw=obj(e.raw||a?.raw),nested=parse(raw.extraJson||e.extraJson);return Object.assign({},e,nested,obj(raw.extraJson));}
  function attempts(s){return arr(s?.attempts).filter(a=>a&&Number.isFinite(Number(a.score)));}
  function cohort(){return v699()?.cohort?.()||arr(runtime()?.state?.students);}
  function latestBySession(s,id){return attempts(s).filter(a=>canon(a.sessionId||a.missionId)===id).sort((a,b)=>stamp(b)-stamp(a))[0]||null;}
  function avg(xs){return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;}
  function std(xs){if(xs.length<2)return 0;const m=avg(xs);return Math.sqrt(xs.reduce((s,x)=>s+(x-m)*(x-m),0)/xs.length);}
  function pct(v){return Math.max(0,Math.min(100,Math.round(num(v))));}
  function colorClass(v){v=num(v,-1);return v<0?'none':v<60?'bad':v<80?'mid':'good';}
  function latestAttempt(s){return attempts(s).sort((a,b)=>stamp(b)-stamp(a))[0]||null;}
  function selectedStudent(){const id=document.getElementById('aq710Student')?.value||'all';return id==='all'?null:cohort().find(s=>String(s.studentId)===id)||null;}
  function studentOptions(){return ['<option value="all">ทั้งห้อง</option>',...cohort().map(s=>`<option value="${esc(s.studentId)}">${esc(s.studentId)} • ${esc(s.studentName||'')}</option>`)].join('');}
  function card(title,body,cls=''){return `<section class="aq710-card ${cls}"><h3>${title}</h3>${body}</section>`;}
  function bar(label,value,sub=''){const p=pct(value);return `<div class="aq710-barrow"><div><b>${esc(label)}</b>${sub?`<small>${esc(sub)}</small>`:''}</div><span>${p}%</span><div class="aq710-bar"><i style="width:${p}%"></i></div></div>`;}

  /* =========================================================
   * Three-part (Mission / Coding Lab / Reflection) heatmap.
   * Mission score is NOT evidence that the stage is fully complete.
   * Only AIQFLOW.GET_FLOW_PROGRESS can certify the three official parts.
   * One bounded, cancellable student request at a time; never auto-fetch class.
   * ========================================================= */
  let heatMode='parts';
  const partCache=new Map();
  const partErrors=new Map();
  let partBusy=false,partSeq=0,partController=null,partStatus='',partDetail=null;
  const partKey=s=>String(s?.studentId||'').trim().toLowerCase()+'|'+String(s?.section||'101').trim();
  const partBool=x=>x===true;
  const partLabel=(v,found)=>v===true?'ผ่าน':v===false?(found===false?'ไม่พบหลักฐาน':'ยังไม่ผ่าน'):'ยังไม่ยืนยัน';
  function partCount(){
    const ss=cohort();
    return {total:ss.length,verified:ss.filter(s=>partCache.has(partKey(s))).length,errors:ss.filter(s=>partErrors.has(partKey(s))).length};
  }
  function partCell(s,id){
    // Keep existing Mission heatmap values visible while official M/C/R status is loading.
    // Mission scores are not treated as proof of completing all three stages.
    const missionAttempt=latestBySession(s,id);
    const hasScore=!!missionAttempt&&Number.isFinite(Number(missionAttempt.score));
    const displayScore=hasScore?String(num(missionAttempt.score)):'—';
    const scoreClass=hasScore?colorClass(missionAttempt.score):'none';
    const key=partKey(s),p=partCache.get(key),r=p&&p[id];
    const cellData='data-aq710-cell="'+esc(s.studentId)+'" data-aq710-stage="'+esc(id)+'"';
    const scoreHtml='<strong class="aq710-preserved-score">'+esc(displayScore)+'</strong>';
    if(!r||typeof r!=='object'){
      const err=partErrors.get(key);
      const message=err?'ยืนยัน M/C/R ไม่สำเร็จ: '+err:'ยังไม่ตรวจ M/C/R จาก Sheet • คะแนนที่เห็นเป็นคะแนน Mission เดิม';
      const second='<span class="aq710-unknown-part">'+(err?'M/C/R !':'M/C/R ?')+'</span>';
      return '<td class="aq710-partcell aq710-overlay-pending aq710-cell '+scoreClass+'"><button type="button" '+cellData+
        ' title="'+esc(id.toUpperCase()+' • '+s.studentId+' • คะแนน Mission: '+displayScore+' • '+message)+'" aria-label="'+esc(id.toUpperCase()+' • '+s.studentId+' • '+message)+'">'+scoreHtml+second+'</button></td>';
    }
    const m=partBool(r.mission?.completed),code=partBool(r.coding?.completed),ref=partBool(r.reflection?.completed);
    const done=m&&code&&ref,locked=r.unlocked===false&&!done;
    const title=id.toUpperCase()+' • '+s.studentId+' • คะแนน Mission เดิม: '+displayScore+
      ' • Mission: '+partLabel(r.mission?.completed,r.mission?.found)+
      ' • Coding: '+partLabel(r.coding?.completed,r.coding?.found)+
      ' • Reflection: '+partLabel(r.reflection?.completed,r.reflection?.found)+(locked?' • ด่านยังล็อก':'');
    const badges='<span class="aq710-tri" aria-hidden="true">'+
      '<span class="'+(m?'yes':'no')+'">M'+(m?'✓':'○')+'</span>'+
      '<span class="'+(code?'yes':'no')+'">C'+(code?'✓':'○')+'</span>'+
      '<span class="'+(ref?'yes':'no')+'">R'+(ref?'✓':'○')+'</span></span>';
    const marker=locked?'<span class="aq710-lockhint">🔒 ล็อก</span>':badges;
    const status=done?'complete':locked?'locked':(m||code||ref?'partial':'notstarted');
    return '<td class="aq710-partcell aq710-cell '+scoreClass+' aq710-overlay-'+status+
      '"><button type="button" '+cellData+' title="'+esc(title)+'" aria-label="'+esc(title)+'">'+scoreHtml+marker+'</button></td>';
  }
  function partDetailHtml(subject){
    if(!partDetail)return '';
    const s=cohort().find(x=>String(x.studentId)===partDetail.studentId);
    const r=s&&partCache.get(partKey(s))?.[partDetail.stage];
    if(!s||!r)return '';
    const stage=partDetail.stage.toUpperCase();
    const done=partBool(r.mission?.completed)&&partBool(r.coding?.completed)&&partBool(r.reflection?.completed);
    const missionScore=r.mission?.gradedRows?num(r.mission.bestScore):'—';
    const codingScore=r.coding?.found?num(r.coding.bestScore):'—';
    const next=done?'ครบทั้ง 3 ส่วน':r.unlocked===false?'ยังไม่ปลดล็อก':!partBool(r.mission?.completed)?'Mission':!partBool(r.coding?.completed)?'Coding Lab':'Reflection';
    return '<div class="aq710-partdetail"><div><b>'+esc(s.studentId+' • '+s.studentName+' • '+stage)+'</b><span>Mission '+esc(partLabel(r.mission?.completed,r.mission?.found))+' ('+esc(missionScore)+') • Coding '+esc(partLabel(r.coding?.completed,r.coding?.found))+' ('+esc(codingScore)+') • Reflection '+esc(partLabel(r.reflection?.completed,r.reflection?.found))+'</span><span>ขั้นที่ต้องทำต่อ: '+esc(next)+'</span></div><button type="button" data-aq710-inspect="'+esc(s.studentId)+'" data-aq710-stage="'+esc(partDetail.stage)+'">ดู Mission Attempts</button></div>';
  }
  function heatmap(subject){
    const ss=cohort(),rows=subject?[subject]:ss;
    const counts=partCount();
    const intro='<div class="aq710-heattools"><div class="aq710-mode">'+
      '<button type="button" data-aq710-mode="parts" class="'+(heatMode==='parts'?'active':'')+'">คะแนน + ครบ 3 ส่วน (M/C/R)</button>'+
      '<button type="button" data-aq710-mode="scores" class="'+(heatMode==='scores'?'active':'')+'">คะแนน Mission</button></div>'+
      (heatMode==='parts'?'<div class="aq710-partactions">'+
       '<button type="button" data-aq710-check="batch" '+(partBusy?'disabled':'')+'>ตรวจ 5 คนถัดไป</button>'+
       '<button type="button" data-aq710-check="all" '+(partBusy?'disabled':'')+'>ตรวจทั้งห้อง</button>'+
       (partBusy?'<button type="button" data-aq710-stop="1">หยุดการตรวจ</button>':'')+
       '</div>':'')+'</div>';
    if(!rows.length)return intro+'<div class="aq710-empty">ยังไม่มีรายชื่อนักศึกษาในกลุ่มที่เลือก</div>';
    const note=heatMode==='parts'?'<p class="aq710-partnote">ตัวเลขใหญ่ = คะแนน Mission เดิม • M = Mission • C = Coding Lab • R = Reflection • ✓ ผ่าน • ○ ยังไม่ผ่าน • 🔒 ล็อก • M/C/R ? = รอตรวจจาก Sheet • กดตรวจข้อมูลหรือคลิกช่องเพื่อยืนยันรายคน</p><p class="aq710-partnote">'+
       'ยืนยันแล้ว '+counts.verified+'/'+counts.total+' คน'+(counts.errors?' • มีข้อผิดพลาด '+counts.errors+' คน':'')+
       (partStatus?' • '+esc(partStatus):' • คะแนนยังแสดงตามเดิม กรุณากดตรวจ 5 คนถัดไปหรือทั้งห้องเพื่อแสดงผลครบสามส่วน')+
       '</p>':'<p class="aq710-partnote">มุมมองนี้แสดงเฉพาะคะแนน Mission ไม่ใช่ผลจบครบสามส่วน</p>';
    const table='<div class="aq710-heatwrap"><table><thead><tr><th>Student</th>'+ORDER.map(id=>'<th>'+TITLES[id]+'</th>').join('')+'</tr></thead><tbody>'+
      rows.map(s=>'<tr><td><b>'+esc(s.studentId)+'</b><small>'+esc(s.studentName||'')+'</small></td>'+
        ORDER.map(id=>heatMode==='parts'?partCell(s,id):(()=>{
          const a=latestBySession(s,id);
          return '<td class="aq710-cell '+colorClass(a?.score)+'" title="'+esc(id.toUpperCase()+': '+(a?num(a.score):'ยังไม่มีคะแนน Mission'))+'">'+(a?num(a.score):'—')+'</td>';
        })()).join('')+'</tr>').join('')+'</tbody></table></div>';
    return intro+note+table+(heatMode==='parts'?partDetailHtml(subject):'');
  }
  async function fetchOfficialParts(student,seq){
    const ctl=new AbortController();partController=ctl;
    const timer=setTimeout(()=>ctl.abort(),35000);
    try{
      const response=await fetch('https://script.google.com/macros/s/AKfycbwXSUHbhVbZtKcjNIDzs4TawAohdeInm1MxLpomVeST2JilOL3L0LWQtT4_Yb7fbJG9/exec',{
        method:'POST',cache:'no-store',headers:{'Content-Type':'text/plain;charset=UTF-8'},
        body:JSON.stringify({module:'AIQFLOW',action:'GET_FLOW_PROGRESS',studentId:String(student.studentId),section:String(student.section||'101')}),
        signal:ctl.signal
      });
      if(!response.ok)throw Error('HTTP_'+response.status);
      const data=await response.json();
      if(seq!==partSeq)return null;
      if(data?.ok!==true||!data.progress||typeof data.progress!=='object')throw Error(data?.code||'PROGRESS_RESPONSE_INVALID');
      // No progress is a valid zero only if the official roster confirms the student.
      if(data.found===false){
        const rosterResponse=await fetch('https://script.google.com/macros/s/AKfycbwXSUHbhVbZtKcjNIDzs4TawAohdeInm1MxLpomVeST2JilOL3L0LWQtT4_Yb7fbJG9/exec',{
          method:'POST',cache:'no-store',headers:{'Content-Type':'text/plain;charset=UTF-8'},
          body:JSON.stringify({module:'AIQFLOW',action:'LOOKUP_PROFILE',studentId:String(student.studentId),section:String(student.section||'101')}),
          signal:ctl.signal
        });
        if(!rosterResponse.ok)throw Error('ROSTER_HTTP_'+rosterResponse.status);
        const roster=await rosterResponse.json();
        if(roster?.ok!==true||roster.found!==true)throw Error('ROSTER_NOT_VERIFIED');
      }
      if(data.studentId&&String(data.studentId).toLowerCase()!==String(student.studentId).toLowerCase())throw Error('STUDENT_ID_MISMATCH');
      if(data.section&&String(data.section)!==String(student.section||'101'))throw Error('SECTION_MISMATCH');
      if(ORDER.some(id=>!Object.prototype.hasOwnProperty.call(data.progress,id)||typeof data.progress[id]!=='object'))throw Error('PROGRESS_INCOMPLETE_20_STAGES');
      if(ORDER.some(id=>!data.progress[id].mission||!data.progress[id].coding||!data.progress[id].reflection||
         typeof data.progress[id].mission.completed!=='boolean'||typeof data.progress[id].coding.completed!=='boolean'||
         typeof data.progress[id].reflection.completed!=='boolean'||typeof data.progress[id].unlocked!=='boolean'))throw Error('PROGRESS_INVALID_PART_FLAGS');
      return data.progress;
    }finally{clearTimeout(timer);if(partController===ctl)partController=null;}
  }
  async function verifyParts(list,limit){
    if(partBusy)return;
    const queue=list.filter(s=>s?.studentId).filter(s=>!partCache.has(partKey(s))).slice(0,limit);
    if(!queue.length){partStatus='ทุกคนในรายการนี้ตรวจแล้ว';render();return;}
    const seq=++partSeq;partBusy=true;let succeeded=0,failed=0,consecutiveFailures=0;
    for(let i=0;i<queue.length;i++){
      if(seq!==partSeq)break;
      const s=queue[i],key=partKey(s);
      partStatus='กำลังตรวจ '+(i+1)+'/'+queue.length+' • '+s.studentId;render();
      try{
        const progress=await fetchOfficialParts(s,seq);
        if(seq!==partSeq)break;
        if(progress){partCache.set(key,progress);partErrors.delete(key);succeeded++;consecutiveFailures=0;}
      }catch(e){
        if(seq!==partSeq)break;
        const reason=e?.name==='AbortError'?'REQUEST_TIMEOUT':String(e?.message||e);
        partErrors.set(key,reason);failed++;consecutiveFailures++;
        if(consecutiveFailures>=2){partStatus='Backend ตอบไม่สำเร็จ 2 ครั้งติด จึงหยุดเพื่อไม่ให้ระบบโหลดหนัก';break;}
      }
      partStatus='ตรวจแล้ว '+succeeded+'/'+(i+1)+' คน • ข้อผิดพลาด '+failed;
      render();
    }
    if(seq===partSeq){
      partBusy=false;
      const halted=consecutiveFailures>=2;
      if(!halted)partStatus='ตรวจเสร็จ '+succeeded+' คน'+(failed?' • ยืนยันไม่ได้ '+failed+' คน':'');
      render();
    }
  }
  function stopPartChecks(clear){
    partSeq++;
    partController?.abort();
    partController=null;partBusy=false;
    if(clear){partCache.clear();partErrors.clear();partDetail=null;partStatus='ข้อมูลที่ตรวจไว้ถูกล้างหลัง Refresh';}
    else partStatus='หยุดตรวจแล้ว • ผลที่ได้รับก่อนหน้ายังคงแสดงอยู่';
    render();
  }
  function heatClick(e){
    const btn=e.target.closest?.('button');if(!btn||!e.currentTarget?.contains(btn))return;
    if(btn.hasAttribute('data-aq710-mode')){heatMode=btn.dataset.aq710Mode;render();return;}
    if(btn.hasAttribute('data-aq710-stop')){stopPartChecks(false);return;}
    if(btn.hasAttribute('data-aq710-check')){
      const selected=selectedStudent(),ss=selected?[selected]:cohort();
      verifyParts(ss,btn.dataset.aq710Check==='batch'?5:ss.length);return;
    }
    if(btn.hasAttribute('data-aq710-cell')){
      const s=cohort().find(x=>String(x.studentId)===btn.dataset.aq710Cell);
      if(!s)return;
      partDetail={studentId:String(s.studentId),stage:String(btn.dataset.aq710Stage)};
      if(!partCache.has(partKey(s)))verifyParts([s],1);
      else render();
      return;
    }
    if(btn.hasAttribute('data-aq710-inspect')){
      const s=cohort().find(x=>String(x.studentId)===btn.dataset.aq710Inspect);
      const inspector=window.AIQUEST_TEACHER_INSPECTOR_V704;
      if(s&&inspector?.openSession)inspector.openSession(s,btn.dataset.aq710Stage);
      else{partStatus='ไม่สามารถเปิด Teacher Inspector ได้';render();}
    }
  }
  function conceptStats(subject){const map=new Map();const ss=subject?[subject]:cohort();ss.forEach(s=>attempts(s).forEach(a=>{const x=meta(a),cards=arr(obj(x.replayAudit).cards),base=num(a.accuracy,a.score);cards.forEach(c=>{const k=String(c.concept||'').trim();if(!k)return;const z=map.get(k)||{n:0,sum:0};z.n++;z.sum+=base;map.set(k,z);});}));return [...map.entries()].map(([k,z])=>({k,n:z.n,score:z.sum/z.n})).sort((a,b)=>a.score-b.score||b.n-a.n);}
  function trapStats(subject){const map=new Map();const ss=subject?[subject]:cohort();ss.forEach(s=>attempts(s).forEach(a=>{const x=meta(a),trap=x.selectedCaseTrap;if(trap){const z=map.get(trap)||{n:0,sum:0};z.n++;z.sum+=num(a.score);map.set(trap,z);}arr(obj(x.replayAudit).cards).forEach(c=>{if(!c.trap)return;const z=map.get(c.trap)||{n:0,sum:0};z.n++;z.sum+=num(a.score);map.set(c.trap,z);});}));return [...map.entries()].map(([k,z])=>({k,n:z.n,score:z.sum/z.n})).sort((a,b)=>a.score-b.score||b.n-a.n);}
  function riskStats(subject){const risks={LOW:[],MEDIUM:[],HIGH:[],CRITICAL:[]};const ss=subject?[subject]:cohort();ss.forEach(s=>attempts(s).forEach(a=>{const x=meta(a),cards=arr(obj(x.replayAudit).cards);cards.forEach(c=>{const r=String(c.risk||'').toUpperCase();if(risks[r])risks[r].push(num(a.score));});}));return risks;}
  function radar(subject){const stats=conceptStats(subject).slice(0,8);if(!stats.length)return '<div class="aq710-empty">ยังไม่มี concept audit</div>';const size=300,cx=150,cy=150,R=108,n=stats.length;const pts=stats.map((s,i)=>{const angle=-Math.PI/2+i*2*Math.PI/n,r=R*(pct(s.score)/100);return [cx+Math.cos(angle)*r,cy+Math.sin(angle)*r];});const axes=stats.map((s,i)=>{const a=-Math.PI/2+i*2*Math.PI/n;const x=cx+Math.cos(a)*R,y=cy+Math.sin(a)*R;const tx=cx+Math.cos(a)*(R+28),ty=cy+Math.sin(a)*(R+28);return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/><text x="${tx}" y="${ty}" text-anchor="middle">${esc(s.k.slice(0,16))}</text>`;}).join('');return `<div class="aq710-radar"><svg viewBox="0 0 ${size} ${size}" role="img"><g class="grid">${[.25,.5,.75,1].map(q=>`<circle cx="${cx}" cy="${cy}" r="${R*q}"/>`).join('')}${axes}</g><polygon points="${pts.map(p=>p.join(',')).join(' ')}"/><circle cx="${cx}" cy="${cy}" r="3"/></svg></div>`;}
  function timeline(subject){const s=subject||cohort().filter(x=>attempts(x).length)[0];if(!s)return '<div class="aq710-empty">เลือกผู้เรียนเพื่อดู timeline</div>';const items=ORDER.map(id=>({id,a:latestBySession(s,id)})).filter(x=>x.a);return `<div class="aq710-timeline">${items.map((x,i)=>{const prev=i?num(items[i-1].a.score):num(x.a.score),d=num(x.a.score)-prev,arrow=d>0?'↑':d<0?'↓':'→';return `<div class="aq710-node ${colorClass(x.a.score)}"><b>${TITLES[x.id]}</b><strong>${num(x.a.score)}</strong><span>${i?arrow:''}</span></div>`;}).join('')}</div>`;}
  function alerts(subject){const ss=subject?[subject]:cohort(),out=[];ss.forEach(s=>{const as=attempts(s).sort((a,b)=>stamp(a)-stamp(b));if(!as.length)return;const latest=as[as.length-1],prev=as[as.length-2];if(num(latest.score)<60)out.push({sev:'bad',t:`${s.studentId} ต้องทบทวนเร่งด่วน`,d:`คะแนนล่าสุด ${num(latest.score)} • ${meta(latest).selectedCaseSkill||'ตรวจรายละเอียด'}`});else if(prev&&num(latest.score)-num(prev.score)>=20)out.push({sev:'good',t:`${s.studentId} ฟื้นตัวดี`,d:`${num(prev.score)} → ${num(latest.score)} (+${num(latest.score)-num(prev.score)})`});else if(prev&&num(prev.score)-num(latest.score)>=15)out.push({sev:'warn',t:`${s.studentId} คะแนนลดลง`,d:`${num(prev.score)} → ${num(latest.score)}`});const cs=conceptStats(s).slice(0,1)[0];if(cs&&cs.score<70)out.push({sev:'warn',t:`${s.studentId} มีจุดอ่อนซ้ำ`,d:`${cs.k} • ค่าเฉลี่ย ${Math.round(cs.score)}%`});});return out.slice(0,12);}
  function classStats(){return ORDER.map(id=>{const scores=cohort().map(s=>latestBySession(s,id)).filter(Boolean).map(a=>num(a.score));return {id,n:scores.length,avg:avg(scores),min:scores.length?Math.min(...scores):0,max:scores.length?Math.max(...scores):0,sd:std(scores)};});}
  function reflectionStats(subject){const ss=subject?[subject]:cohort(),words=new Map(),quality={Excellent:0,Good:0,Basic:0,Missing:0};const keys=['evidence','human review','audit trail','monitoring','risk','privacy','fairness','threshold','fallback','appeal','PEAS','citation','retrieval'];ss.forEach(s=>attempts(s).forEach(a=>{const text=[a.reflection1,a.reflection2,a.reflection3].filter(Boolean).join(' ');if(!text.trim()){quality.Missing++;return;}const len=text.length,hit=keys.filter(k=>text.toLowerCase().includes(k.toLowerCase())).length;if(len>500&&hit>=3)quality.Excellent++;else if(len>250&&hit>=2)quality.Good++;else quality.Basic++;keys.forEach(k=>{const n=(text.toLowerCase().match(new RegExp(k.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'))||[]).length;if(n)words.set(k,(words.get(k)||0)+n);});}));return {quality,words:[...words.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12)};}
  function summary(subject){const ss=subject?[subject]:cohort().filter(s=>attempts(s).length);if(!ss.length)return 'ยังไม่มีข้อมูลเพียงพอสำหรับสรุป';const latestScores=ss.map(latestAttempt).filter(Boolean).map(a=>num(a.score));const concepts=conceptStats(subject),traps=trapStats(subject),weak=concepts[0],strong=concepts.slice().sort((a,b)=>b.score-a.score)[0],low=ss.filter(s=>num(latestAttempt(s)?.score)<60).length;let text=`${subject?'ผู้เรียนคนนี้':'ผู้เรียนใน cohort นี้'}มีคะแนนล่าสุดเฉลี่ย ${Math.round(avg(latestScores))}% จาก ${ss.length} คนที่มีข้อมูล`;if(strong)text+=` จุดแข็งที่พบคือ ${strong.k} (${Math.round(strong.score)}%)`;if(weak)text+=` ส่วนหัวข้อที่ควรทบทวนคือ ${weak.k} (${Math.round(weak.score)}%)`;if(traps[0])text+=` กับดักที่ควรนำกลับมาสอนคือ ${traps[0].k}`;text+=low?` มี ${low} คนที่ควรได้รับการช่วยเหลือเร่งด่วน`:' ยังไม่พบผู้เรียนคะแนนล่าสุดต่ำกว่า 60';text+=' แนะนำให้ใช้ Replay Audit และ Reflection Evidence ตรวจยืนยันก่อนมอบหมายกิจกรรมเสริม';return text;}
  function render(){const host=document.getElementById('aqLearningAnalyticsV710');if(!host)return;const subject=selectedStudent();const weak=conceptStats(subject).slice(0,8),traps=trapStats(subject).slice(0,8),risks=riskStats(subject),alertsList=alerts(subject),cls=classStats(),refl=reflectionStats(subject);host.innerHTML=`
    <div class="aq710-head"><div><h2>Learning Analytics Suite</h2><p>Analytics 1–10 • ใช้ cohort เดียวกับตัวกรองซ่อนข้อมูลทดสอบ</p></div><div><select id="aq710Student">${studentOptions()}</select></div></div>
    <div class="aq710-grid wide">${card('1. Learning Progress Heatmap',heatmap(subject),'span2')}${card('2. Weak Concept Analytics',weak.length?weak.map(x=>bar(x.k,x.score,`${x.n} evidence`)).join(''):'<div class="aq710-empty">ยังไม่มีข้อมูล</div>')}${card('3. Trap Analytics',traps.length?traps.map(x=>bar(x.k,x.score,`${x.n} occurrences`)).join(''):'<div class="aq710-empty">ยังไม่มีข้อมูล</div>')}</div>
    <div class="aq710-grid">${card('4. Risk Distribution',Object.entries(risks).map(([k,v])=>bar(k,v.length?avg(v):0,`${v.length} cards`)).join(''))}${card('5. Session / Skill Radar',radar(subject))}${card('6. Learning Timeline',timeline(subject),'span2')}</div>
    <div class="aq710-grid">${card('7. Teacher Alerts',alertsList.length?alertsList.map(a=>`<div class="aq710-alert ${a.sev}"><b>${esc(a.t)}</b><span>${esc(a.d)}</span></div>`).join(''):'<div class="aq710-empty">ยังไม่มี alert สำคัญ</div>')}${card('8. Class Analytics',`<div class="aq710-class"><table><thead><tr><th>Session</th><th>N</th><th>Avg</th><th>Min</th><th>Max</th><th>SD</th></tr></thead><tbody>${cls.map(x=>`<tr><td>${TITLES[x.id]}</td><td>${x.n}</td><td>${x.n?Math.round(x.avg):'—'}</td><td>${x.n?x.min:'—'}</td><td>${x.n?x.max:'—'}</td><td>${x.n?x.sd.toFixed(1):'—'}</td></tr>`).join('')}</tbody></table></div>`,'span2')}</div>
    <div class="aq710-grid">${card('9. Reflection Analytics',`<div class="aq710-quality">${Object.entries(refl.quality).map(([k,v])=>`<div><b>${v}</b><span>${k}</span></div>`).join('')}</div><div class="aq710-tags">${refl.words.map(([k,v])=>`<span>${esc(k)} • ${v}</span>`).join('')||'<span>ยังไม่มี keyword</span>'}</div>`)}${card('10. Teacher Evidence Summary',`<div class="aq710-summary">${esc(summary(subject))}</div><p class="aq710-note">สรุปนี้สร้างจากคะแนน, selected case, replay audit และ reflection ที่มีอยู่จริง ไม่ประเมินสิ่งที่ไม่มีหลักฐาน</p>`,'span2')}</div>`;
    const sel=document.getElementById('aq710Student');if(sel){sel.value=subject?String(subject.studentId):'all';sel.onchange=render;}
  }
  function mount(){if(document.getElementById('aqLearningAnalyticsV710'))return;const section=document.createElement('section');section.id='aqLearningAnalyticsV710';section.className='card aq710-root';section.innerHTML='<div class="loading">กำลังสร้าง Learning Analytics 1–10…</div>';const target=document.getElementById('phase2AuditBox');(target?.parentNode||document.querySelector('main'))?.insertBefore(section,target?.nextSibling||null);const style=document.createElement('style');style.textContent=`
    .aq710-root{margin-top:16px}.aq710-head{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}.aq710-head p{color:#9fb2cc;margin:5px 0 0}.aq710-head select{min-width:280px}.aq710-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:12px}.aq710-grid.wide{grid-template-columns:2fr 1fr 1fr}.aq710-card{border:1px solid rgba(148,163,184,.2);border-radius:17px;padding:14px;background:rgba(255,255,255,.025);min-width:0}.aq710-card.span2{grid-column:span 2}.aq710-card h3{margin:0 0 12px}.aq710-empty{color:#9fb2cc;padding:18px;text-align:center}.aq710-heatwrap,.aq710-class{overflow:auto}.aq710-heatwrap table,.aq710-class table{min-width:760px;width:100%;border-collapse:collapse}.aq710-heatwrap th,.aq710-heatwrap td,.aq710-class th,.aq710-class td{padding:8px;border-bottom:1px solid rgba(148,163,184,.12);font-size:12px}.aq710-heatwrap td:first-child{position:sticky;left:0;background:#111c31;z-index:1}.aq710-heatwrap td small{display:block;color:#9fb2cc}.aq710-cell{text-align:center;font-weight:900;border-radius:7px}.aq710-cell.good{background:rgba(34,197,94,.22)}.aq710-cell.mid{background:rgba(251,191,36,.20)}.aq710-cell.bad{background:rgba(248,113,113,.22)}.aq710-cell.none{color:#64748b}.aq710-barrow{display:grid;grid-template-columns:1fr auto;gap:5px;margin:10px 0}.aq710-barrow small{display:block;color:#9fb2cc}.aq710-bar{grid-column:1/3;height:8px;background:rgba(148,163,184,.16);border-radius:99px;overflow:hidden}.aq710-bar i{display:block;height:100%;background:linear-gradient(90deg,#38bdf8,#a78bfa);border-radius:99px}.aq710-radar{display:grid;place-items:center}.aq710-radar svg{width:min(100%,340px)}.aq710-radar .grid circle,.aq710-radar .grid line{fill:none;stroke:rgba(148,163,184,.25)}.aq710-radar text{fill:#9fb2cc;font-size:9px}.aq710-radar polygon{fill:rgba(56,189,248,.25);stroke:#38bdf8;stroke-width:2}.aq710-timeline{display:flex;gap:8px;overflow:auto;padding:8px 0}.aq710-node{min-width:78px;padding:10px;border-radius:12px;text-align:center;background:rgba(148,163,184,.12)}.aq710-node b,.aq710-node strong,.aq710-node span{display:block}.aq710-node strong{font-size:23px}.aq710-node.good{border:1px solid rgba(34,197,94,.4)}.aq710-node.mid{border:1px solid rgba(251,191,36,.4)}.aq710-node.bad{border:1px solid rgba(248,113,113,.4)}.aq710-alert{padding:10px;border-radius:12px;margin:8px 0;border:1px solid rgba(148,163,184,.22)}.aq710-alert b,.aq710-alert span{display:block}.aq710-alert span{color:#9fb2cc;margin-top:3px}.aq710-alert.bad{border-color:rgba(248,113,113,.5)}.aq710-alert.warn{border-color:rgba(251,191,36,.5)}.aq710-alert.good{border-color:rgba(34,197,94,.5)}.aq710-quality{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.aq710-quality div{padding:10px;text-align:center;border:1px solid rgba(148,163,184,.2);border-radius:12px}.aq710-quality b,.aq710-quality span{display:block}.aq710-quality b{font-size:22px}.aq710-quality span{color:#9fb2cc;font-size:12px}.aq710-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.aq710-tags span{padding:5px 8px;border-radius:99px;background:rgba(56,189,248,.1);border:1px solid rgba(56,189,248,.3);font-size:12px}.aq710-summary{font-size:16px;line-height:1.7;padding:14px;border-radius:14px;background:rgba(56,189,248,.07);border:1px solid rgba(56,189,248,.25)}.aq710-note{color:#9fb2cc;font-size:12px}@media(max-width:980px){.aq710-grid,.aq710-grid.wide{grid-template-columns:1fr 1fr}.aq710-card.span2{grid-column:span 2}}@media(max-width:680px){.aq710-grid,.aq710-grid.wide{grid-template-columns:1fr}.aq710-card.span2{grid-column:span 1}.aq710-quality{grid-template-columns:1fr 1fr}.aq710-head select{min-width:0;width:100%}}

    .aq710-heattools{display:flex;align-items:center;gap:10px;justify-content:space-between;flex-wrap:wrap;margin:0 0 9px}
    .aq710-mode,.aq710-partactions{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
    .aq710-heattools button,.aq710-partdetail button{background:#1e293b;color:#e2e8f0;border:1px solid #475569;border-radius:9px;padding:7px 9px;font-size:12px;cursor:pointer}
    .aq710-heattools button.active{background:#075985;border-color:#38bdf8;color:white;font-weight:800}
    .aq710-heattools button:disabled{opacity:.5;cursor:not-allowed}
    .aq710-partnote{color:#9fb2cc;font-size:12px;line-height:1.5;margin:5px 0 8px}
    .aq710-partcell{padding:4px!important;text-align:center}
    .aq710-partcell button{min-width:64px;width:100%;border:0;border-radius:6px;padding:7px 4px;background:transparent;color:inherit;cursor:pointer}
    .aq710-partcell.complete{background:rgba(34,197,94,.22)}
    .aq710-partcell.partial{background:rgba(251,191,36,.16)}
    .aq710-partcell.notstarted{background:rgba(148,163,184,.06)}
    .aq710-partcell.locked,.aq710-partcell.pending{color:#a1acc0}
    .aq710-tri{display:flex;align-items:center;justify-content:center;gap:3px}
    .aq710-tri span{font-size:10px;white-space:nowrap}
    .aq710-tri .yes{color:#86efac}.aq710-tri .no{color:#fbbf24}
    .aq710-partdetail{display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:space-between;border:1px solid rgba(56,189,248,.3);background:rgba(56,189,248,.07);border-radius:12px;padding:11px;margin-top:10px}
    .aq710-partdetail div span{display:block;color:#a9bad3;font-size:12px;margin-top:5px}
    .aq710-partcell button:focus-visible,.aq710-heattools button:focus-visible{outline:2px solid #38bdf8;outline-offset:2px}
    .aq710-partcell button{min-width:75px;min-height:56px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}
    .aq710-partcell .aq710-preserved-score{font-size:15px;font-weight:900;line-height:1.1;color:#f1f5f9}
    .aq710-partcell.none .aq710-preserved-score{color:#93a4ba}
    .aq710-partcell .aq710-tri{gap:4px}
    .aq710-partcell .aq710-tri span{font-size:10px;font-weight:800}
    .aq710-partcell .aq710-unknown-part{font-size:10px;font-weight:700;color:#cbd5e1;background:rgba(100,116,139,.32);border-radius:5px;padding:2px 4px;white-space:nowrap}
    .aq710-partcell .aq710-lockhint{font-size:10px;color:#cbd5e1;white-space:nowrap}
    .aq710-partcell.aq710-overlay-complete{box-shadow:inset 0 -3px 0 #34d399}
    .aq710-partcell.aq710-overlay-partial{box-shadow:inset 0 -3px 0 #fbbf24}
    .aq710-partcell.aq710-overlay-locked{box-shadow:inset 0 -3px 0 #64748b}
    .aq710-partcell.aq710-overlay-pending{box-shadow:inset 0 -3px 0 rgba(148,163,184,.20)}

  `;document.head.appendChild(style);render();}
  function boot(){const badge=document.querySelector('.brand .row');if(badge&&!document.getElementById('aq710Badge'))badge.insertAdjacentHTML('beforeend','<span id="aq710Badge" class="pill good">✓ Learning Analytics v710</span>');mount();document.getElementById('aqLearningAnalyticsV710')?.addEventListener('click',heatClick);document.getElementById('aqHideTestV698')?.addEventListener('change',()=>setTimeout(render,0));document.getElementById('refreshBtn')?.addEventListener('click',()=>{stopPartChecks(true);setTimeout(render,1200);});window.addEventListener('aiquest:cohort-change',()=>setTimeout(render,0));let n=0;const t=setInterval(()=>{n++;if(runtime()?.state?.students){mount();render();if(runtime().state.students.length||n>30)clearInterval(t);}if(n>60)clearInterval(t);},500);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.AIQUEST_TEACHER_LEARNING_ANALYTICS_V710={VERSION,render,mount};
})();