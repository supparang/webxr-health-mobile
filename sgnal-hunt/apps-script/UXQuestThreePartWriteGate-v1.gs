/* CSAI2601 UX Quest: three-part, append-only write-side gate.
 * Include in the ACTUAL deployed Student Receiver project.
 * Provides no doGet/doPost; existing receiver must call UXQ_WG_check_(sheet,row)
 * AFTER eventId de-duplication and BEFORE append.
 */
const UXQ_WG_ORDER=['w1','w2','w3','b1','w4','w5','w6','w7','b2',
 'w8','w9','w10','w11','b3','w12','w13','w14','b4','w15'];
function UXQ_WG_key_(x){
  return String(x==null?'':x).trim().toLowerCase().replace(/[^a-z0-9]/g,'');
}
function UXQ_WG_truth_(x){
  return x===true || x===1 || /^(true|yes|1|passed)$/i.test(String(x||'').trim());
}
function UXQ_WG_number_(x){
  const n=Number(String(x||'').replace(/,/g,''));
  return Number.isFinite(n)?n:0;
}
function UXQ_WG_explicitReflection_(r){
  let fields=[];
  try{const a=JSON.parse(String(r.artifactfields||''));if(Array.isArray(a))fields=a;}catch(_){}
  if(!fields.length){
    try{
      const raw=JSON.parse(String(r.rawjson||''));fields=Array.isArray(raw.artifactFields)?raw.artifactFields:[];
    }catch(_){}
  }
  return fields.some(function(field){
    return field && String(field.key||'').trim().toLowerCase()==='reflection' &&
      String(field.value==null?'':field.value).trim().length>0;
  });
}
function UXQ_WG_sheetRows_(sheet){
  if(sheet.getLastRow()<2)return [];
  const values=sheet.getDataRange().getDisplayValues();
  const headers=values.shift().map(UXQ_WG_key_);
  ['studentid','section','courseid','missionid','eventtype','passed','stars','artifactfields','rawjson']
    .forEach(function(key){
      if(headers.indexOf(key)<0)throw new Error('missing_write_gate_column:'+key);
    });
  return values.map(function(row){
    const obj={};headers.forEach(function(key,index){if(key)obj[key]=row[index];});
    return obj;
  });
}
/* Reuse only per-student/section aliases explicitly approved in existing
 * unified Receiver. Never merge Sections for the whole class.
 */
function UXQ_WG_allowedSections_(studentId,section){
  const sections=[section];
  let aliases=[];
  try{
    if(typeof UXQ_PROGRESS_SECTION_ALIASES !== 'undefined')
      aliases=UXQ_PROGRESS_SECTION_ALIASES[studentId+'|'+section]||[];
  }catch(_){}
  (Array.isArray(aliases)?aliases:[]).forEach(function(value){
    const s=String(value||'').trim();
    if(s&&sections.indexOf(s)<0)sections.push(s);
  });
  return sections;
}
function UXQ_WG_assess_(history,incoming){
  const target=String(incoming.missionId||incoming.missionid||'').trim().toLowerCase();
  const targetIndex=UXQ_WG_ORDER.indexOf(target);
  if(targetIndex<0)return {ok:false,error:'unknown_node',missionId:target};
  const sid=String(incoming.studentId||incoming.studentid||'').trim();
  const section=String(incoming.section||'').trim();
  const course=String(incoming.courseId||incoming.courseid||'').trim();
  if(!sid||!section||!course)return {ok:false,error:'missing_identity'};
  if(targetIndex===0)return {ok:true};
  const allowedSections=UXQ_WG_allowedSections_(sid,section);
  const status={};
  UXQ_WG_ORDER.slice(0,targetIndex).forEach(function(id){
    status[id]={mission:false,studio:false,reflection:false};
  });
  (history||[]).forEach(function(row){
    if(String(row.studentid||'').trim()!==sid ||
       allowedSections.indexOf(String(row.section||'').trim())<0 ||
       (String(row.courseid||'').trim()&&String(row.courseid||'').trim()!==course))return;
    const id=String(row.missionid||'').trim().toLowerCase(),state=status[id];
    if(!state)return;
    const type=String(row.eventtype||'').trim().toLowerCase();
    if(type==='mission_completed'){
      if(UXQ_WG_truth_(row.passed)||UXQ_WG_number_(row.stars)>=2)state.mission=true;
    }else if(type==='artifact_submitted'){
      state.studio=true;
      // Latest appended artifact controls Reflection. Never trust a
      // receiver-synthesized reflection column from older submissions.
      state.reflection=UXQ_WG_explicitReflection_(row);
    }
  });
  for(let i=0;i<targetIndex;i++){
    const id=UXQ_WG_ORDER[i],part=status[id];
    if(!part.mission)return {ok:false,error:'three_part_node_locked',blockedBy:id,missing:'mission'};
    if(!part.studio)return {ok:false,error:'three_part_node_locked',blockedBy:id,missing:'studio'};
    if(!part.reflection)return {ok:false,error:'three_part_node_locked',blockedBy:id,missing:'reflection'};
  }
  return {ok:true};
}
function UXQ_WG_check_(sheet,incoming){
  return UXQ_WG_assess_(UXQ_WG_sheetRows_(sheet),incoming);
}
