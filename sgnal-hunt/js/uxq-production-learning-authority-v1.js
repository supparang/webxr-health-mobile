/* CSAI2601 UX Quest • Production Learning Authority v1
 * Applies to W1-W15 and B1-B4 except W7.
 * - concise, parallel, high-plausibility choices
 * - evidence-first panel
 * - reason choices without answer-signalling words
 * - progressive hints
 * - misconception trace to Sheet
 * - structured artifact submission to Sheet
 * Sheet remains the official source; localStorage is only an unsent queue/cache.
 */
(function(){
  'use strict';

  var query=new URLSearchParams(location.search||'');
  var nodeId=String(query.get('node')||query.get('id')||'').toUpperCase();
  if(!nodeId||nodeId==='W7')return;

  var VERSION='production-learning-authority-v1-20260714';
  var QUEUE_KEY='csai2601.uxq.production.pending.v1';
  var stageSeen='';
  var cfg=function(){return window.UXQ_CLASSROOM_CONFIG||{};};
  var clean=function(v,n){return String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,n||1000);};

  function profile(){
    var p={};
    try{p=window.UXQIdentity&&window.UXQIdentity.get?window.UXQIdentity.get():{};}catch(e){}
    return {
      studentId:clean(p.studentId||query.get('studentId')||query.get('sid')||'',80),
      studentName:clean(p.studentName||query.get('studentName')||query.get('name')||'',120),
      section:clean(p.section||query.get('section')||cfg().defaultSection||'',80)
    };
  }
  function complete(p){return !!(p.studentId&&p.studentName&&p.section);}
  function uid(prefix){return prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);}
  function readQueue(){try{var v=JSON.parse(localStorage.getItem(QUEUE_KEY)||'[]');return Array.isArray(v)?v:[];}catch(e){return [];}}
  function queue(item){var a=readQueue().concat([item]).slice(-60);try{localStorage.setItem(QUEUE_KEY,JSON.stringify(a));}catch(e){}return a.length;}
  function send(item){
    var url=clean(cfg().receiverUrl||'',700);
    if(!url)return Promise.resolve({ok:false,reason:'no_receiver'});
    return fetch(url,{method:'POST',mode:'no-cors',cache:'no-store',keepalive:true,headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(item)})
      .then(function(){return {ok:true};})
      .catch(function(e){return {ok:false,count:queue(item),reason:String(e&&e.message||e)};});
  }
  function flush(){
    var list=readQueue(); if(!list.length||!cfg().receiverUrl)return;
    try{localStorage.setItem(QUEUE_KEY,'[]');}catch(e){}
    list.reduce(function(p,item){return p.then(function(){return send(item).then(function(out){if(!out.ok)queue(item);});});},Promise.resolve());
  }

  function stageIndex(){
    var t=clean((document.querySelector('.hud .meter b')||document.querySelector('.case h1')||{}).textContent,180);
    var m=t.match(/([1-9])\s*\/\s*([1-9])|(?:ข้อ|รอบภารกิจ|รอบบอส)\s*([1-9])/i);
    return Math.max(0,Number((m&&(m[1]||m[3]))||1)-1);
  }
  function stageKind(){
    var t=clean((document.querySelector('.case .kicker')||document.querySelector('.case p')||{}).textContent,150).toLowerCase();
    if(/goal|persona|empath|user/.test(t))return 'goal';
    if(/impact|classif|diagnos|cognitive|load/.test(t))return 'diagnose';
    if(/proof|test|valid|evaluat|metric/.test(t))return 'test';
    if(/fix|decision|solution|prototype|layout|wireframe/.test(t))return 'decision';
    return ['evidence','goal','diagnose','decision','test'][stageIndex()%5];
  }
  function contextText(){
    var h=clean((document.querySelector('.case h1')||{}).textContent,160);
    var p=clean((document.querySelector('.case p:last-child')||document.querySelector('.instruction')||{}).textContent,240);
    return {title:h||nodeId+' UX case',detail:p||'ผู้ใช้พบอุปสรรคระหว่างทำงานหลัก'};
  }
  function shortFocus(){
    var c=contextText().detail.replace(/^สถานการณ์\s*:\s*/i,'').replace(/\s*[•|]\s*โฟกัส\s*:.*/i,'');
    return c.length>58?c.slice(0,58)+'…':c;
  }

  var MODELS={
    evidence:[
      'ใช้พฤติกรรมที่เกิดซ้ำในงานหลักเป็นหลักฐาน แล้วระบุจุดที่ทำให้งานสะดุด',
      'ใช้คำขอจากผู้ใช้เป็นหลักฐาน แล้วออกแบบตามสิ่งที่ผู้ใช้บอกว่าต้องการมากที่สุด',
      'ใช้จำนวนการมองเห็นบนหน้าเป็นหลักฐาน แล้วปรับส่วนที่ได้รับความสนใจน้อยที่สุด',
      'ใช้ข้อจำกัดของทีมเป็นหลักฐาน แล้วเลือกปัญหาที่แก้ได้ภายในรอบพัฒนานี้'
    ],
    goal:[
      'กำหนด goal จากผลลัพธ์ที่ผู้ใช้ต้องทำสำเร็จ และระบุสิ่งที่ต้องรู้ก่อนตัดสินใจ',
      'กำหนด goal จากความพึงพอใจหลังใช้งาน และเพิ่มองค์ประกอบที่ทำให้หน้าจอน่าใช้ขึ้น',
      'กำหนด goal จากจำนวนฟีเจอร์ที่เข้าถึงได้ และทำให้ทุกทางเลือกมองเห็นพร้อมกัน',
      'กำหนด goal จากขั้นตอนของระบบเดิม และช่วยให้ผู้ใช้ทำตามกระบวนการได้ครบถ้วน'
    ],
    diagnose:[
      'แยกปัญหาเป็นลำดับข้อมูล flow และ feedback แล้วเลือกชั้นที่ขัดขวาง task มากที่สุด',
      'แยกปัญหาตามความรุนแรงทางภาพ แล้วแก้ส่วนที่ดูไม่สม่ำเสมอกับ design system ก่อน',
      'แยกปัญหาตามต้นทุนพัฒนา แล้วเลือกส่วนที่ปรับได้โดยไม่กระทบระบบหลังบ้าน',
      'แยกปัญหาตามจำนวนคำร้องเรียน แล้วแก้หัวข้อที่มีผู้กล่าวถึงมากที่สุดก่อนเสมอ'
    ],
    decision:[
      'ปรับจุดตัดสินใจให้ข้อมูลสำคัญอยู่ใกล้ action และรักษา next step ให้เห็นต่อเนื่อง',
      'ปรับทางเลือกให้มีน้ำหนักใกล้กัน เพื่อเปิดอิสระและลดการชี้นำจากโครงสร้างหน้าจอ',
      'ปรับข้อความอธิบายให้ครบขึ้น โดยคงลำดับและตำแหน่งองค์ประกอบเดิมทั้งหมดไว้',
      'ปรับส่วนที่เห็นบ่อยที่สุดให้เด่นขึ้น เพื่อเพิ่มความคุ้นเคยและลดเวลาการค้นหา'
    ],
    test:[
      'ให้ผู้ใช้ทำ task เดิม แล้วเทียบความสำเร็จ เวลา error และความเข้าใจ next step',
      'ให้ผู้ใช้เลือกหน้าที่ชอบกว่า แล้วใช้คะแนนความพึงพอใจเป็นตัวตัดสินผลการออกแบบ',
      'ให้ทีมตรวจความครบตาม design system แล้วสรุปว่าหน้าใหม่พร้อมใช้งานหรือไม่',
      'เทียบจำนวนผู้เข้าชมและเวลาบนหน้า แล้วถือว่าค่าสูงขึ้นคือ UX ดีขึ้นโดยตรง'
    ]
  };

  var REASONS={
    evidence:[
      'ข้อมูลนี้เกิดในขั้นตอนที่ผู้ใช้ต้องทำงานจริง จึงเชื่อมกับอุปสรรคที่ตรวจซ้ำได้',
      'ข้อมูลนี้มาจากคำบอกของผู้ใช้ จึงสะท้อนความต้องการโดยไม่ต้องตรวจพฤติกรรมเพิ่ม',
      'ข้อมูลนี้แสดงจุดที่คนมองน้อย จึงยืนยันได้ว่าจุดนั้นเป็นสาเหตุหลักของปัญหา',
      'ข้อมูลนี้สอดคล้องข้อจำกัดทีม จึงเหมาะสำหรับเลือกเป็นหลักฐานลำดับแรก'
    ],
    goal:[
      'เป้าหมายนี้ระบุ task outcome และข้อมูลที่จำเป็นก่อนผู้ใช้ทำขั้นถัดไป',
      'เป้าหมายนี้เน้นความรู้สึกหลังใช้งาน จึงครอบคลุมผลลัพธ์ของ task ได้เพียงพอ',
      'เป้าหมายนี้ทำให้ทุกฟีเจอร์เข้าถึงได้ จึงลดความเสี่ยงที่ระบบจะชี้นำผู้ใช้',
      'เป้าหมายนี้รักษากระบวนการเดิม จึงทำให้ผู้ใช้เรียนรู้ระบบได้เร็วขึ้นเสมอ'
    ],
    diagnose:[
      'การแยกชั้นนี้ช่วยให้วิธีแก้ตรงกับจุดที่ทำให้ผู้ใช้หยุด ย้อน หรือทำงานผิด',
      'การแยกชั้นนี้รักษามาตรฐานภาพ จึงใช้แทนหลักฐาน task failure ได้ในทุกกรณี',
      'การแยกชั้นนี้ลดความเสี่ยงพัฒนา จึงควรมีน้ำหนักเหนือผลกระทบต่อผู้ใช้',
      'การแยกชั้นนี้อาศัยจำนวนคำร้องเรียน จึงไม่ต้องพิจารณาบริบทของแต่ละ task'
    ],
    decision:[
      'การตัดสินใจนี้เชื่อมข้อมูลจำเป็นกับ action และลดการย้อนหาเงื่อนไขก่อนทำต่อ',
      'การตัดสินใจนี้รักษาความเป็นกลางของทางเลือก จึงเหมาะกับทุกเป้าหมายผู้ใช้',
      'การตัดสินใจนี้เพิ่มคำอธิบายโดยไม่เปลี่ยน flow จึงลด cognitive load โดยตรง',
      'การตัดสินใจนี้เพิ่มความคุ้นเคย จึงแก้สาเหตุของความผิดพลาดได้ทุกประเภท'
    ],
    test:[
      'เกณฑ์นี้วัดผลของ task เดิมโดยตรง และเปรียบเทียบก่อน–หลังได้อย่างตรวจสอบได้',
      'เกณฑ์นี้วัดความชอบของผู้ใช้ จึงใช้สรุป usability และ task success ได้พร้อมกัน',
      'เกณฑ์นี้ตรวจคุณภาพการผลิต จึงยืนยันได้ว่าผู้ใช้เข้าใจและทำงานสำเร็จ',
      'เกณฑ์นี้วัด engagement จึงตีความได้โดยตรงว่าความสับสนลดลงแล้ว'
    ]
  };

  function optionButtons(group){return group?Array.prototype.slice.call(group.querySelectorAll('button.option')):[];}
  function findCorrect(bs,reason){
    return bs.find(function(b){return b.dataset.uxqCorrect==='1'||b.dataset.correct==='true';})||
      bs.find(function(b){
        var span=clean((b.querySelector('span')||{}).textContent,400);
        return reason?/^ถูก\s*เพราะ|task outcome|user outcome/i.test(span):/เชื่อมกับหลักฐานและ artifact/i.test(span)&&!/กับดัก/i.test(span);
      })||bs[0];
  }
  function rewrite(group,texts,reason){
    var bs=optionButtons(group); if(bs.length!==4)return;
    var right=findCorrect(bs,reason), wrong=bs.filter(function(b){return b!==right;});
    var map=[[right,texts[0]],[wrong[0],texts[1]],[wrong[1],texts[2]],[wrong[2],texts[3]]];
    map.forEach(function(pair){
      if(!pair[0])return;
      var b=pair[0].querySelector('b')||pair[0]; b.textContent=pair[1];
      var s=pair[0].querySelector('span'); if(s)s.textContent=reason?'เทียบความสัมพันธ์ระหว่างหลักฐาน การตัดสินใจ และผลที่วัดได้':'พิจารณาความเหมาะสมกับหลักฐานของ case นี้';
      pair[0].style.minHeight='104px';
    });
  }

  function evidenceType(){
    var n=parseInt(nodeId.replace(/\D/g,''),10)||1;
    return ['Interview quote','Task analytics','Heatmap signal','Journey breakdown','Wireframe evidence'][n%5];
  }
  function patchEvidence(){
    var qbox=document.querySelector('.question'); if(!qbox)return;
    var old=qbox.querySelector('[data-production-evidence]');
    var c=contextText(),type=evidenceType();
    var key=nodeId+'-'+stageIndex()+'-'+c.detail;
    if(old&&old.dataset.key===key)return;
    if(!old){old=document.createElement('section');old.setAttribute('data-production-evidence','1');old.style.cssText='margin:0 0 14px;padding:12px 14px;border:1px solid rgba(110,231,255,.38);border-radius:15px;background:rgba(110,231,255,.07);display:grid;gap:7px';qbox.insertBefore(old,qbox.firstChild);}
    old.dataset.key=key;
    old.innerHTML='<b style="color:#9fefff">หลักฐาน • '+type+'</b><span style="line-height:1.5;color:#d9e7ff">'+clean(c.detail,185)+'</span><small style="color:#aebfe4">ใช้หลักฐานนี้แยก task outcome ออกจากความชอบหรือข้อจำกัดของทีม</small>';
  }

  function hintLevel(){try{return Number(sessionStorage.getItem('uxq.hint.'+nodeId+'.'+stageIndex())||0);}catch(e){return 0;}}
  function patchHint(){
    var el=document.querySelector('.hint'); if(!el)return;
    var kind=stageKind(),levels={
      evidence:['มองหาพฤติกรรมที่เกิดใน task จริง','แยกสิ่งที่ผู้ใช้พูดออกจากสิ่งที่ผู้ใช้ทำ','เลือกข้อมูลที่ชี้ตำแหน่งซึ่งงานหยุดหรือผิด'],
      goal:['ถามว่างานใดต้องสำเร็จ','ระบุข้อมูลที่ต้องรู้ก่อนทำขั้นถัดไป','ตัดเป้าหมายด้านความสวยหรือความครบของฟีเจอร์ออก'],
      diagnose:['แยกภาพ ลำดับงาน และ feedback','หา layer ที่ทำให้ task หยุดหรือย้อน','อย่าใช้ต้นทุนทีมแทนผลกระทบผู้ใช้'],
      decision:['วางข้อมูลจำเป็นใกล้จุดตัดสินใจ','ตรวจว่า action หลักตรงกับ next step','แนวทางที่ดีต้องทดสอบผลหลังปรับได้'],
      test:['ใช้ task เดิมก่อนและหลังปรับ','วัด success เวลา error และ next-step clarity','ความชอบหรือ traffic อย่างเดียวไม่ยืนยัน usability']
    };
    var a=levels[kind]||levels.decision,lv=Math.min(2,hintLevel());
    el.textContent='คำใบ้ระดับ '+(lv+1)+': '+a[lv];
  }

  function patchQuestion(){
    var qbox=document.querySelector('.question'); if(!qbox)return;
    var groups=qbox.querySelectorAll('.options'),kind=stageKind();
    if(groups[0])rewrite(groups[0],MODELS[kind]||MODELS.decision,false);
    if(groups[1])rewrite(groups[1],REASONS[kind]||REASONS.decision,true);
    var prompt=qbox.querySelector('.prompt'); if(prompt)prompt.textContent=['จากหลักฐานนี้ แนวทางใดเหมาะที่สุด','หากต้องตัดสินใจตอนนี้ ข้อใดสอดคล้องที่สุด','ข้อใดตอบโจทย์ task ในสถานการณ์นี้','การตัดสินใจใดมีหลักฐานรองรับมากที่สุด'][stageIndex()%4];
    var ins=qbox.querySelector('.instruction'); if(ins)ins.textContent='ทุกตัวเลือกมีข้อดีบางส่วน ให้เลือกข้อที่ตรงกับหลักฐานและผลลัพธ์ของงานผู้ใช้มากที่สุด';
    patchEvidence(); patchHint();
  }

  function basePayload(eventType,schema){
    var p=profile(),now=new Date().toISOString();
    return {app:'ux-quest',schema:schema,eventType:eventType,eventId:uid(nodeId.toLowerCase()+'-'+eventType),attemptId:uid(nodeId.toLowerCase()+'-attempt'),courseId:clean(cfg().courseId||'UXQ-ACT1-2026',120),courseLabel:clean(cfg().courseLabel||'CSAI2601 • UX Quest',160),studentId:p.studentId,studentName:p.studentName,section:p.section,missionId:nodeId.toLowerCase(),missionTitle:nodeId+' • UX Quest',completedAt:now,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'Asia/Bangkok',pageUrl:clean(location.href,500),source:VERSION};
  }
  function sendMisconception(){
    var fb=document.querySelector('.feedback.bad'); if(!fb||fb.dataset.productionLogged==='1')return;
    fb.dataset.productionLogged='1';
    var p=profile(); if(!complete(p))return;
    var item=basePayload('reason_retry_submitted','uxq.reason.trace.v1');
    item.linkedAttemptId=''; item.reasonRetryResponse=clean(fb.textContent,900); item.reasonRetryVerifiedAccuracy=0;
    item.reasonRetryFocus=stageKind(); item.reasonRetrySubmittedAt=item.completedAt;
    item.learningFocus='misconception:'+stageKind(); item.passed=false;
    send(item);
  }

  function artifactStatus(text){
    var art=document.querySelector('.artifact'); if(!art)return;
    var el=art.querySelector('[data-production-artifact-status]');
    if(!el){el=document.createElement('div');el.setAttribute('data-production-artifact-status','1');el.style.cssText='padding:10px 12px;border:1px solid rgba(110,231,255,.4);border-radius:12px;background:rgba(7,17,36,.65);font-weight:800;line-height:1.45';art.appendChild(el);}el.textContent=text;
  }
  function patchArtifact(){
    var art=document.querySelector('.artifact'); if(!art)return;
    var btn=art.querySelector('[data-save-artifact]')||Array.prototype.slice.call(art.querySelectorAll('button')).find(function(b){return /บันทึก note|ส่ง.*Sheet|artifact/i.test(b.textContent);});
    if(btn){btn.textContent='ส่ง Studio Artifact เข้า Google Sheet';btn.setAttribute('data-production-artifact-submit','1');btn.classList.remove('secondary');}
    Array.prototype.slice.call(art.querySelectorAll('p')).forEach(function(p){p.textContent=p.textContent.replace(/บันทึก note ในเครื่อง/g,'ส่งเป็นหลักฐานเข้า Google Sheet').replace(/นำผลการเล่นไปเติมใบงาน\/portfolio ตามหัวข้อต่อไปนี้/g,'สรุป Evidence → Decision → Test → Reflection ให้ครบ');});
  }
  function artifactFields(){
    var out={}; Array.prototype.slice.call(document.querySelectorAll('.artifact textarea')).forEach(function(a,i){out['field'+(i+1)]=clean(a.value,1800);}); return out;
  }
  function artifactPayload(data){
    var item=basePayload('artifact_submitted','uxq.artifact.global.v1');
    var values=Object.keys(data).map(function(k){return data[k];});
    item.artifactSubmitted=true; item.artifactType=(nodeId.toLowerCase()+'_studio_artifact');
    item.problemSeen=values[0]||''; item.uxReason=values[1]||''; item.fixAndTest=values.slice(2,4).join(' | ');
    item.reflection=values.join(' | '); item.learnedPoint=values[values.length-1]||'';
    item.artifactFields=Object.keys(data).map(function(k){return {key:k,value:data[k]};}); item.artifactSubmittedAt=item.completedAt;
    return item;
  }

  document.addEventListener('click',function(e){
    var hint=e.target.closest&&e.target.closest('[data-hint]');
    if(hint){try{var k='uxq.hint.'+nodeId+'.'+stageIndex();sessionStorage.setItem(k,String(hintLevel()+1));}catch(x){}setTimeout(patchHint,60);}
    var btn=e.target.closest&&e.target.closest('[data-production-artifact-submit]');
    if(!btn)return;
    e.preventDefault();e.stopImmediatePropagation();
    var p=profile(); if(!complete(p)){artifactStatus('ส่งไม่ได้: โปรไฟล์ผู้เรียนไม่ครบ');return;}
    var d=artifactFields(),keys=Object.keys(d),bad=keys.filter(function(k){return d[k].length<20;});
    if(!keys.length||bad.length){artifactStatus('กรอกทุกช่องอย่างน้อย 20 ตัวอักษรก่อนส่ง • ยังไม่ผ่าน '+(bad.length||1)+' ช่อง');return;}
    btn.disabled=true;artifactStatus('กำลังส่ง Studio Artifact เข้า Google Sheet...');
    send(artifactPayload(d)).then(function(out){btn.disabled=false;artifactStatus(out.ok?'ส่งคำขอเข้า Google Sheet แล้ว • eventType = artifact_submitted':'ส่งไม่สำเร็จ • เก็บคิวชั่วคราว '+(out.count||1)+' รายการ');});
  },true);

  function badge(){
    var b=document.querySelector('[data-production-authority]'); if(b)return;
    b=document.createElement('div');b.setAttribute('data-production-authority','1');
    b.style.cssText='position:fixed;left:12px;bottom:12px;z-index:9999;padding:7px 10px;border-radius:999px;background:#11365d;color:#bff5ff;border:1px solid #5cdff5;font:700 12px system-ui';
    b.textContent='Production Learning v1 • '+nodeId+' • Sheet';document.body.appendChild(b);
  }
  function run(){patchQuestion();patchArtifact();sendMisconception();badge();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
  new MutationObserver(function(){clearTimeout(run.timer);run.timer=setTimeout(run,20);}).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('online',flush);window.addEventListener('pageshow',flush);
  window.UXQProductionLearningV1=Object.freeze({version:VERSION,run:run,flush:flush});
})();