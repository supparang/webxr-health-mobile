/* CSAI2401: client-side Boss Evidence Pack form.
 * Form completeness is machine-checked; substantive quality awaits instructor review.
 */
(function(root){
 'use strict';
 const esc=x=>String(x==null?'':x).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[ch]));
 function render(week,scenario){
  if(!week||!week.gate||!scenario||!root.CSAIAssessment)return '';
  const labels=root.CSAIAssessment.GATE_LABELS;
  const fields=week.gate.requiredEvidenceTags.map((tag,i)=>{
   const sources=scenario.evidence.map(e=>'<option value="'+esc(e.id)+'">'+esc(e.label)+'</option>').join('');
   return '<div class="metaCard" style="margin:8px 0"><label><b>'+(i+1)+'. '+esc(labels[tag]||tag)+'</b> <small>('+esc(tag)+')</small>'+
    '<textarea class="field gateEvidenceStatement" data-evidence-tag="'+esc(tag)+'" rows="2" maxlength="1200" placeholder="อธิบายข้อพิสูจน์ / เหตุผลของตนเอง โดยระบุสิ่งที่ตรวจสอบได้"></textarea></label>'+
    '<label class="muted">หลักฐานอ้างอิงจากสถานการณ์ (Evidence Source)<select class="field gateEvidenceSource" data-evidence-source="'+esc(tag)+'"><option value="">-- เลือกหลักฐาน --</option>'+sources+'</select></label></div>';
  }).join('');
  return '<section class="metaCard gatePanel" id="gateEvidencePanel"><h3>ชุดหลักฐาน (Evidence Pack) ก่อนผ่านด่านบอส (Boss Gate)</h3>'+
   '<p class="muted">อธิบายเป็นภาษาไทย ภาษาอังกฤษ หรือผสมกันได้ โดยต้องเขียนให้ครบทุกหัวข้อและเลือกแหล่งหลักฐานที่สอดคล้องกัน เกมตรวจเฉพาะความครบถ้วนเชิงโครงสร้าง ผู้สอนต้องตรวจความถูกต้องของเนื้อหาก่อนให้คะแนนทางการ</p>'+
   fields+'</section>';
 }
 function collect(week){
  if(!week||!week.gate)return null;
  const pack={};
  for(const tag of week.gate.requiredEvidenceTags){
   const statement=document.querySelector('[data-evidence-tag="'+tag+'"]');
   const source=document.querySelector('[data-evidence-source="'+tag+'"]');
   pack[tag]={statement:statement?statement.value:'',sourceId:source?source.value:''};
  }
  return pack;
 }
 root.CSAIGateUI=Object.freeze({render,collect});
})(typeof globalThis!=='undefined'?globalThis:this);
