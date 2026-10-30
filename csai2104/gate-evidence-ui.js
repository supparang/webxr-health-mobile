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
    '<label class="muted">หลักฐานอ้างอิงจากสถานการณ์<select class="field gateEvidenceSource" data-evidence-source="'+esc(tag)+'"><option value="">-- เลือกหลักฐาน --</option>'+sources+'</select></label></div>';
  }).join('');
  return '<section class="metaCard gatePanel" id="gateEvidencePanel"><h3>Evidence Pack ก่อนผ่าน Boss Gate</h3>'+
   '<p class="muted">ต้องเขียนให้ครบทุกหัวข้อและระบุแหล่งหลักฐาน ผลนี้เป็นเพียงการตรวจความครบถ้วนเชิงโครงสร้างโดยเกม ผู้สอนยังต้องตรวจความถูกต้องก่อนให้คะแนนทางการ</p>'+
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
