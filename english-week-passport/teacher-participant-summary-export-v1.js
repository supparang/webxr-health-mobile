(function(){
'use strict';

const VERSION='2026-08-21-TEACHER-PARTICIPANT-PROGRAM-SUMMARY-V1';
const SESSION_IDS=['D1-AM','D1-PM','D2-AM','D2-PM','D3-AM','D3-PM'];
const LIMIT=300,CHUNK=30;
const COL={profiles:'ewp_profiles',progress:'ewp_progress',teacherRoles:'ewp_teacher_roles'};
const $=id=>document.getElementById(id);
const clean=v=>String(v==null?'':v).trim();
const xml=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
const chunks=(a,size=CHUNK)=>{const out=[];for(let i=0;i<a.length;i+=size)out.push(a.slice(i,i+size));return out};
const docs=s=>s.docs.map(d=>({id:d.id,...(d.data()||{})}));
function status(text,bad=false){const el=$('apiStatus');if(!el)return;el.textContent=text;el.className='status'+(bad?' bad':'')}
function isQaId(id){const s=clean(id).toUpperCase();return /^QA[-_]/.test(s)||/^TEST[-_]/.test(s)||/^99\d{4,}$/.test(s)}
function programOf(p){return clean(p.program||p.groupName||p.major||p.department||p.programCode||'ไม่ระบุสาขา')}
function ts(v){try{return typeof v?.toMillis==='function'?v.toMillis():(v?.seconds?Number(v.seconds)*1000:new Date(v||0).getTime()||0)}catch(_){return 0}}
function bangkokDate(v){const ms=typeof v==='number'?v:ts(v);if(!ms)return'';try{const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(new Date(ms)),m=Object.fromEntries(p.map(x=>[x.type,x.value]));return `${m.year}-${m.month}-${m.day} ${m.hour}:${m.minute}:${m.second}`}catch(_){return new Date(ms).toISOString()}}
async function verifyTeacher(){const u=firebase.auth().currentUser;if(!u||u.isAnonymous)throw new Error('TEACHER_SIGN_IN_REQUIRED');const s=await firebase.firestore().collection(COL.teacherRoles).doc(u.uid).get();const r=s.exists?s.data():null;if(!r||r.active!==true||r.role!=='teacher')throw new Error('TEACHER_ROLE_REQUIRED');return u}
async function readProfiles(ids){if(!ids.length)return[];const db=firebase.firestore(),fp=firebase.firestore.FieldPath.documentId();const snaps=await Promise.all(chunks([...new Set(ids)]).map(part=>db.collection(COL.profiles).where(fp,'in',part).get()));return snaps.flatMap(docs)}
async function loadAllParticipants(){
 const db=firebase.firestore(),progress=[];
 for(let i=0;i<SESSION_IDS.length;i++){
  const sid=SESSION_IDS[i];status(`Participant Summary • กำลังอ่าน ${sid} (${i+1}/${SESSION_IDS.length})…`);
  const snap=await db.collection(COL.progress).where('attendanceSessionId','==',sid).limit(LIMIT).get();
  docs(snap).forEach(p=>progress.push({...p,_sessionId:sid}));
 }
 const realProgress=progress.filter(p=>!isQaId(p.playerId||p.id));
 const ids=[...new Set(realProgress.map(p=>clean(p.playerId||p.id)).filter(Boolean))];
 const profiles=await readProfiles(ids),pm=new Map(profiles.map(p=>[clean(p.playerId||p.id),p]));
 const byId=new Map();
 for(const p of realProgress){
  const id=clean(p.playerId||p.id);if(!id)continue;
  const profile=pm.get(id)||{};
  const existing=byId.get(id);
  const row={playerId:id,name:clean(profile.fullName||profile.nickname||p.nickname||id),program:programOf(profile),sessionId:clean(p.attendanceSessionId||p._sessionId),preDone:Boolean(p.preDone),postDone:Boolean(p.postDone),reflectionDone:Boolean(p.reflectionDone||p.finalReflection),summaryViewed:Boolean(p.summaryViewed),certificateEligible:Boolean(p.certificateEligible),finishedAt:p.finishedAt,updatedAt:p.updatedAt};
  if(!existing||ts(row.updatedAt)>=ts(existing.updatedAt))byId.set(id,row);
 }
 return [...byId.values()].sort((a,b)=>a.program.localeCompare(b.program)||a.name.localeCompare(b.name));
}
function xlsCell(v,style='Cell'){if(v==null||v==='')return `<Cell ss:StyleID="${style}"><Data ss:Type="String"></Data></Cell>`;if(typeof v==='number'&&Number.isFinite(v))return `<Cell ss:StyleID="${style}"><Data ss:Type="Number">${v}</Data></Cell>`;return `<Cell ss:StyleID="${style}"><Data ss:Type="String">${xml(v)}</Data></Cell>`}
function xlsRow(values,style='Cell'){return `<Row>${values.map(v=>xlsCell(v,style)).join('')}</Row>`}
function xlsSheet(name,headers,data,widths=[]){const cols=headers.map((_,i)=>`<Column ss:AutoFitWidth="0" ss:Width="${Number(widths[i]||90)}"/>`).join(''),body=data.map(r=>xlsRow(r)).join('');return `<Worksheet ss:Name="${xml(name)}"><Table>${cols}${xlsRow(headers,'Header')}${body}</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane><ActivePane>2</ActivePane></WorksheetOptions></Worksheet>`}
function buildWorkbook(rows){
 const counts={};rows.forEach(r=>{counts[r.program]=(counts[r.program]||0)+1});
 const programRows=Object.entries(counts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([program,count],i)=>[i+1,program,count,rows.length?Math.round(count/rows.length*1000)/10:0]);
 const sessionCounts={};rows.forEach(r=>{sessionCounts[r.sessionId]=(sessionCounts[r.sessionId]||0)+1});
 const sessionRows=SESSION_IDS.map(s=>[s,sessionCounts[s]||0]);
 const participantRows=rows.map(r=>[r.playerId,r.name,r.program,r.sessionId,r.preDone?'Yes':'No',r.postDone?'Yes':'No',r.reflectionDone?'Yes':'No',r.summaryViewed?'Yes':'No',r.certificateEligible?'Yes':'No',bangkokDate(r.finishedAt)]);
 const summary=[['Metric','Value'],['Total unique real participants',rows.length],['Programs / majors',Object.keys(counts).length],['QA/Test IDs excluded','Yes'],['Exported At (Bangkok)',bangkokDate(Date.now())]];
 const sheets=[
  xlsSheet('Summary',['Metric','Value'],summary.slice(1),[210,150]),
  xlsSheet('Programs',['Rank','Program / Major','Participants','Percent'],programRows,[55,210,90,80]),
  xlsSheet('Sessions',['Session','Unique Participants'],sessionRows,[90,120]),
  xlsSheet('Participants',['Player ID','Name','Program / Major','Session','Pre','Post','Reflection','Journey Summary','Certificate','Finished At (Bangkok)'],participantRows,[100,190,180,80,65,65,80,100,85,155])
 ];
 return `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><DocumentProperties xmlns="urn:schemas-microsoft-com:office:office"><Author>LEXICON X Teacher Console</Author><Created>${new Date().toISOString()}</Created></DocumentProperties><Styles><Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="10"/></Style><Style ss:ID="Cell"><Alignment ss:Vertical="Top" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D7E3EC"/></Borders></Style><Style ss:ID="Header"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#2468D8" ss:Pattern="Solid"/></Style></Styles>${sheets.join('')}</Workbook>`
}
async function exportSummary(){const btn=$('exportParticipantSummaryXlsBtn');try{await verifyTeacher();if(btn)btn.disabled=true;const rows=await loadAllParticipants();if(!rows.length){status('ไม่พบผู้เข้าร่วมกิจกรรมจริงใน 6 รอบ',true);return}const wb=buildWorkbook(rows),blob=new Blob(['\ufeff',wb],{type:'application/vnd.ms-excel;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a'),stamp=new Date().toISOString().slice(0,10).replaceAll('-','');a.href=url;a.download=`LEXICON_X_PARTICIPANTS_BY_PROGRAM_${stamp}.xls`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);const counts={};rows.forEach(r=>counts[r.program]=(counts[r.program]||0)+1);const top=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([p,n])=>`${p} ${n}`).join(' • ');status(`Participants ${rows.length} คน • ${Object.keys(counts).length} สาขา • ${top}`)}catch(e){console.error(e);status(`Participant Summary failed • ${clean(e.message||e)}`,true)}finally{if(btn)btn.disabled=false}}
function bind(){const actions=document.querySelector('.top-actions');if(!actions||$('exportParticipantSummaryXlsBtn'))return;const b=document.createElement('button');b.id='exportParticipantSummaryXlsBtn';b.className='btn primary';b.textContent='⬇ Participants by Program';b.title='จำนวนผู้เข้าร่วมจริงทั้งหมด แยกตามสาขา/หลักสูตร เช่น SPSS';const anchor=$('lockBtn');if(anchor)actions.insertBefore(b,anchor);else actions.appendChild(b);b.onclick=exportSummary}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
window.EW_PARTICIPANT_PROGRAM_EXPORT=Object.freeze({version:VERSION,exportSummary,isQaId});
})();