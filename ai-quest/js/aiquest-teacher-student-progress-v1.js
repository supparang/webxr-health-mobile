/* CSAI2102 • Teacher Progress v1.0 • Read-only Sheet authority */
(()=>{'use strict';
const API='https://script.google.com/macros/s/AKfycbwXSUHbhVbZtKcjNIDzs4TawAohdeInm1MxLpomVeST2JilOL3L0LWQtT4_Yb7fbJG9/exec';
const ORDER=[['S1','AI Spotter'],['S2','Agent Builder'],['S3','Search Maze'],['B1','Foundation Boss'],['S4','UCS Cost Board'],['S5','A* Overlay'],['S6','Minimax Board'],['B2','Search Boss'],['S7','Knowledge Base'],['S8','Bayes Console'],['S9','Expert System'],['B3','Reasoning Boss'],['S10','Data Pipeline'],['S11','Classification'],['S12','Clustering'],['B4','ML Boss'],['S13','Neural Network'],['S14','Reinforcement Learning'],['S15','LLM / RAG'],['B5','Final Boss']];
const $=id=>document.getElementById(id);
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const runtime=()=>window.AIQUEST_TEACHER_SAFE_V533;
const state={student:null,progress:null,loading:false,seq:0,controller:null};
function students(){const s=runtime()?.state?.students;return Array.isArray(s)?s.filter(x=>x&&x.studentId):[];}
function message(txt,cls){const e=$('aqspMessage');if(!e)return;e.className='aqsp-notice '+(cls||'');e.textContent=txt;}
function cancel(){state.seq++;state.controller?.abort();state.controller=null;state.loading=false;}
function bool(v){return v===true;}
function step(r){
 if(!r)return 'ยังไม่ยืนยัน';
 if(bool(r.completed))return 'จบครบ 3 ส่วน';
 if(!bool(r.unlocked))return 'ล็อก';
 if(!bool(r.mission?.completed))return 'ทำ Mission';
 if(!bool(r.coding?.completed))return 'ทำ Coding Lab';
 if(!bool(r.reflection?.completed))return 'ส่ง Reflection';
 return 'รอตรวจซ้ำ';
}
function mark(done,locked){
 if(done)return '<span class="aqsp-pass">✓ ผ่าน</span>';
 if(locked)return '<span class="aqsp-locked">🔒 ล็อก</span>';
 return '<span class="aqsp-wait">○ ยังไม่ผ่าน</span>';
}
function score(v){return Number.isFinite(Number(v))&&v!==null&&v!==''?String(Math.round(Number(v)*10)/10):'—';}
function rows(){return ORDER.map(([id,title])=>({id,title,r:state.progress?.[id.toLowerCase()]}));}
function render(){
 const rr=rows(),completed=rr.filter(x=>x.r?.completed===true).length;
 const next=rr.find(x=>x.r?.unlocked===true&&x.r?.completed!==true);
 $('aqspResults').innerHTML=
  '<div class="aqsp-summary"><div><small>ครบทั้ง 3 ส่วน</small><b>'+completed+'/20</b></div><div><small>ขั้นที่ทำต่อ</small><b>'+esc(next?.id||(completed===20?'COMPLETE':'—'))+'</b></div><div><small>สถานะ</small><b>'+esc(next?step(next.r):completed===20?'จบหลักสูตร':'ยังไม่ยืนยัน')+'</b></div></div>'+
  '<div class="aqsp-scroll"><table><thead><tr><th>Stage</th><th>Mission</th><th>Coding Lab</th><th>Reflection</th><th>ถัดไป</th><th>Best Mission / Coding</th></tr></thead><tbody>'+
  rr.map(({id,title,r})=>{
   if(!r)return '<tr><td><b>'+esc(id)+'</b><small>'+esc(title)+'</small></td><td colspan="5">— ยังไม่ยืนยัน</td></tr>';
   const locked=!bool(r.unlocked)&&!bool(r.completed);
   return '<tr><td><b>'+esc(id)+'</b><small>'+esc(title)+'</small></td><td>'+mark(bool(r.mission?.completed),locked)+'</td><td>'+mark(bool(r.coding?.completed),locked)+'</td><td>'+mark(bool(r.reflection?.completed),locked)+'</td><td>'+esc(step(r))+'</td><td>'+score(r.mission?.bestScore)+' / '+score(r.coding?.bestScore)+'</td></tr>';
  }).join('')+'</tbody></table></div>';
 $('aqspExport').disabled=false;
 message('✓ Sheet ยืนยันสถานะทั้ง 20 ด่าน • '+state.student.studentId+' • '+new Date().toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}),'good');
}
async function check(){
 if(state.loading||!state.student)return;
 cancel();const seq=state.seq,student=state.student;
 state.loading=true;state.progress=null;$('aqspCheck').disabled=true;$('aqspExport').disabled=true;$('aqspResults').innerHTML='';
 message('กำลังอ่านสถานะ 20 ด่านจาก Google Sheet ของ '+student.studentId+'…');
 const ctl=new AbortController();state.controller=ctl;
 const timer=setTimeout(()=>ctl.abort(),55000);
 try{
  const resp=await fetch(API,{method:'POST',cache:'no-store',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({module:'AIQFLOW',action:'GET_FLOW_PROGRESS',studentId:String(student.studentId),section:String(student.section||'101')}),signal:ctl.signal});
  if(!resp.ok)throw Error('HTTP_'+resp.status);
  const data=await resp.json();
  if(seq!==state.seq)return;
  if(data?.ok!==true||!data.progress||typeof data.progress!=='object')throw Error(data?.code||'PROGRESS_RESPONSE_INVALID');
  if(data.studentId&&String(data.studentId).toLowerCase()!==String(student.studentId).toLowerCase())throw Error('STUDENT_ID_MISMATCH');
  if(data.section&&String(data.section)!==String(student.section||'101'))throw Error('SECTION_MISMATCH');
  const found=ORDER.filter(([id])=>Object.prototype.hasOwnProperty.call(data.progress,id.toLowerCase())).length;
  if(found!==20)throw Error('PROGRESS_INCOMPLETE_'+found+'/20');
  state.progress=data.progress;render();
 }catch(e){
  if(seq!==state.seq)return;
  const reason=e.name==='AbortError'?'REQUEST_TIMEOUT':String(e.message||e);
  message('ยังยืนยันความก้าวหน้าไม่ได้: '+reason+' • ไม่ตีความข้อมูลที่โหลดไม่สำเร็จเป็น 0/20','warn');
  $('aqspResults').innerHTML='<p class="muted">ลองตรวจจาก Sheet ใหม่ หรือใช้ Teacher Inspector ดู Mission Attempts ที่มีอยู่</p>';
 }finally{
  clearTimeout(timer);
  if(seq===state.seq){state.loading=false;state.controller=null;$('aqspCheck').disabled=!state.student;$('aqspExport').disabled=!state.progress;}
 }
}
function csvCell(v){let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
function exportCsv(){
 if(!state.progress||!state.student)return;
 const s=state.student;
 const rr=[['student_id','student_name','section','session','title','unlocked','mission_passed','mission_best','coding_passed','coding_best','reflection_passed','completed','next_action']];
 rows().forEach(({id,title,r})=>rr.push([s.studentId,s.studentName,s.section,id,title,r?.unlocked??'',r?.mission?.completed??'',r?.mission?.bestScore??'',r?.coding?.completed??'',r?.coding?.bestScore??'',r?.reflection?.completed??'',r?.completed??'',step(r)]));
 const csv='\uFEFF'+rr.map(x=>x.map(csvCell).join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');
 a.href=url;a.download='CSAI2102_progress_'+String(s.studentId).replace(/[^a-zA-Z0-9_-]/g,'_')+'.csv';
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function sync(){
 const sel=$('aqspStudent');if(!sel)return;
 const list=students(),key=list.map(x=>x.studentId+':'+x.studentName).join('|');
 if(sel.dataset.key===key)return;
 const saved=sel.value||state.student?.studentId||'';
 sel.innerHTML='<option value="">เลือกนักศึกษา…</option>'+list.map(x=>'<option value="'+esc(x.studentId)+'">'+esc(x.studentId+' • '+x.studentName)+'</option>').join('');
 sel.dataset.key=key;
 state.student=list.find(x=>String(x.studentId)===String(saved))||null;
 sel.value=state.student?String(state.student.studentId):'';
 $('aqspCheck').disabled=!state.student||state.loading;
 if(!state.student){state.progress=null;$('aqspResults').innerHTML='';$('aqspExport').disabled=true;}
}
function mount(){
 if($('aiqStudentProgress'))return;
 const parent=$('studentsBox')?.closest('section.card');if(!parent)return;
 const css=document.createElement('style');css.textContent=[
  '#aiqStudentProgress .aqsp-controls{display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin-top:12px}',
  '#aiqStudentProgress select{flex:1;min-width:220px;max-width:520px}',
  '#aiqStudentProgress .aqsp-notice{margin-top:12px;padding:11px 13px;border:1px solid #475569;border-radius:12px;line-height:1.6}',
  '#aiqStudentProgress .aqsp-notice.good{color:#bbf7d0;border-color:#15803d;background:#052e24}',
  '#aiqStudentProgress .aqsp-notice.warn{color:#fde68a;border-color:#a16207;background:#351b05}',
  '#aiqStudentProgress .aqsp-summary{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}',
  '#aiqStudentProgress .aqsp-summary>div{border:1px solid #475569;border-radius:12px;padding:9px 13px;min-width:135px;background:#17263f}',
  '#aiqStudentProgress .aqsp-summary small{display:block;color:#a9bad3}',
  '#aiqStudentProgress .aqsp-summary b{display:block;font-size:20px}',
  '#aiqStudentProgress .aqsp-scroll{overflow:auto;max-height:740px;margin-top:12px;border:1px solid #475569;border-radius:12px}',
  '#aiqStudentProgress table{border-collapse:collapse;width:100%;font-size:13px}',
  '#aiqStudentProgress th,#aiqStudentProgress td{padding:9px 8px;border-bottom:1px solid #334155;text-align:left;white-space:nowrap}',
  '#aiqStudentProgress th{position:sticky;top:0;background:#15243c}',
  '#aiqStudentProgress td small{display:block;color:#a9bad3}',
  '#aiqStudentProgress .aqsp-pass{color:#86efac}',
  '#aiqStudentProgress .aqsp-wait{color:#fbbf24}',
  '#aiqStudentProgress .aqsp-locked{color:#94a3b8}'
 ].join('\n');document.head.appendChild(css);
 const section=document.createElement('section');section.className='card';section.id='aiqStudentProgress';
 section.innerHTML='<div class="card-head"><div><h2>Student Progress • 20 Stages</h2><p class="muted">S1–S15 / B1–B5 • รายบุคคล • Mission + Coding Lab + Reflection</p></div><span class="pill blue">Read-only v1.0</span></div>'+
 '<div class="aqsp-controls"><select id="aqspStudent"><option value="">เลือกนักศึกษา…</option></select><button id="aqspCheck" type="button" class="btn" disabled>ตรวจสถานะ 20 ด่าน</button><button id="aqspExport" type="button" class="btn secondary" disabled>Export CSV</button></div>'+
 '<div id="aqspMessage" class="aqsp-notice">เลือกนักศึกษา แล้วกดตรวจเพื่ออ่านสถานะอย่างเป็นทางการจาก Google Sheet</div><div id="aqspResults"></div>'+
 '<p class="muted" style="font-size:12px">✓ ผ่าน = Backend ยืนยัน • ○ ยังไม่ผ่าน = Backend ตอบว่าหลักฐานยังไม่ครบ • 🔒 ล็อก = ยังไม่ปลดล็อก • หากโหลดไม่สำเร็จจะไม่แสดง 0/20 • Teacher Inspector ใช้ดู Attempts รายละเอียด</p>';
 parent.insertAdjacentElement('afterend',section);
 $('aqspStudent').onchange=()=>{cancel();state.student=students().find(x=>String(x.studentId)===$('aqspStudent').value)||null;state.progress=null;$('aqspResults').innerHTML='';$('aqspExport').disabled=true;$('aqspCheck').disabled=!state.student;message(state.student?'เลือก '+state.student.studentId+' • '+state.student.studentName+' แล้ว กดตรวจจาก Sheet':'เลือกนักศึกษาเพื่อดูความก้าวหน้า');};
 $('aqspCheck').onclick=check;$('aqspExport').onclick=exportCsv;
 const list=$('studentsBox');if(list)new MutationObserver(sync).observe(list,{childList:true});
 sync();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();