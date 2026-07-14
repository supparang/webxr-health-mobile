/* CSAI2601 UX Quest • W7 Final Authority v3
 * Runs last and owns the visible W7 question/Reason/Artifact UI.
 * Sheet is authoritative; localStorage is pending queue only.
 */
(function(){
  'use strict';
  var q=new URLSearchParams(location.search||'');
  if(String(q.get('node')||'').toUpperCase()!=='W7')return;

  var VERSION='w7-final-authority-v3-20260714';
  var QUEUE_KEY='csai2601.uxq.w7.pending.v3';
  var cfg=function(){return window.UXQ_CLASSROOM_CONFIG||{};};
  var clean=function(v,n){return String(v==null?'':v).trim().slice(0,n||1800);};
  var stageModels=[
    {
      main:[
        'ให้ “เวลาเรียน–หน่วยกิต–ที่นั่งคงเหลือ” อยู่ใน card เดียว และให้ปุ่มเพิ่มในแผนเรียนเด่นหลังข้อมูลตัดสินใจครบ',
        'ให้ชื่อวิชาและภาพปกเด่นที่สุด แล้วซ่อนข้อมูลเวลาเรียนไว้ในหน้ารายละเอียด',
        'ให้ทุกข้อมูลมีน้ำหนักเท่ากันเพื่อไม่ชี้นำผู้ใช้ และวางปุ่มไว้ท้ายรายการ',
        'ให้รายวิชาที่คนเลือกมากอยู่บนสุด แม้เวลาเรียนและเงื่อนไขไม่ตรงกับผู้ใช้'
      ],
      reason:[
        'ผู้ใช้ต้องเปรียบเทียบข้อมูลที่มีผลต่อการตัดสินใจ ก่อนเห็น action ที่พาไปขั้นถัดไป',
        'การทำชื่อวิชาเด่นช่วยเรื่องภาพลักษณ์ แม้ผู้ใช้ยังต้องเปิดหลายหน้าเพื่อเปรียบเทียบ',
        'การให้น้ำหนักเท่ากันลดอคติของระบบ แม้ผู้ใช้ต้องใช้เวลาหาข้อมูลสำคัญเอง',
        'ความนิยมเป็นหลักฐานแทนความเหมาะสมของผู้ใช้แต่ละคนได้เพียงพอ'
      ]
    },
    {
      main:[
        'ใช้ comparison cards พร้อม filter ด้านบน โดยแต่ละ card แสดงเวลาเรียน หน่วยกิต ที่นั่ง และเงื่อนไขในลำดับเดียวกัน',
        'ใช้ตารางกว้างเต็มหน้าจอเพื่อเห็นข้อมูลครบทุกคอลัมน์ แม้ต้องเลื่อนแนวนอนบนมือถือ',
        'แยกเวลาเรียน หน่วยกิต และที่นั่งเป็นสามหน้า เพื่อให้แต่ละหน้าดูไม่แน่น',
        'ใช้ card แบบรูปภาพใหญ่ และเปิดรายละเอียดทั้งหมดใน modal หลังผู้ใช้กดเลือกวิชา'
      ],
      reason:[
        'โครงนี้ลดการสลับหน้าและทำให้ผู้ใช้เปรียบเทียบตัวแปรสำคัญด้วยรูปแบบที่คงที่',
        'ตารางแสดงข้อมูลได้ครบ จึงเหมาะเสมอแม้บริบทเป็นมือถือและผู้ใช้ต้องเลื่อนหลายทิศทาง',
        'การแยกเป็นหลายหน้าลดความหนาแน่น จึงไม่จำเป็นต้องคงข้อมูลตัดสินใจไว้ใกล้กัน',
        'ภาพใหญ่ช่วยให้เลือกง่ายขึ้น แม้ไม่เกี่ยวกับเวลาเรียน ที่นั่ง หรือเงื่อนไข'
      ]
    },
    {
      main:[
        'ใช้ “เพิ่มในแผนเรียน” เป็น CTA หลักหนึ่งจุดหลังข้อมูลสำคัญ และมี “ดูรายละเอียด” เป็น action รอง',
        'ใช้ “สมัครเลย” เป็น CTA หลักตั้งแต่ก่อนแสดงเวลาเรียนและเงื่อนไขเพื่อเร่ง conversion',
        'ใช้ CTA หลายปุ่มน้ำหนักเท่ากัน เช่น บันทึก แชร์ เปรียบเทียบ และสมัคร เพื่อเพิ่มทางเลือก',
        'วาง CTA ไว้ท้ายหน้าหลังคำอธิบายรายวิชาทั้งหมด เพื่อบังคับให้อ่านครบก่อน'
      ],
      reason:[
        'CTA หลักตรงกับ next step และปรากฏเมื่อผู้ใช้มีข้อมูลพอตัดสินใจ จึงลดการย้อนกลับและการกดผิด',
        'การเร่งให้กดก่อนเห็นเงื่อนไขช่วยลดเวลา แม้อาจเพิ่มการยกเลิกในขั้นถัดไป',
        'หลาย CTA ทำให้ระบบยืดหยุ่น แม้ผู้ใช้ไม่เห็นว่า action ใดสำคัญที่สุด',
        'การวางท้ายหน้ารับประกันว่าผู้ใช้อ่านครบ แม้ต้องเลื่อนยาวและอาจพลาดปุ่ม'
      ]
    },
    {
      main:[
        'บนมือถือใช้ card stack เต็มความกว้าง คงเวลาเรียน–ที่นั่ง–เงื่อนไขไว้ก่อน CTA และย่อข้อมูลรองแบบเปิดเพิ่มได้',
        'ย่อทั้งหน้าเดสก์ท็อปตามสัดส่วนเดิมเพื่อให้เห็นทุกคอลัมน์ในจอเดียว',
        'ซ่อนข้อมูลเวลาเรียนและเงื่อนไขบนมือถือ เหลือชื่อวิชากับปุ่มเลือกเพื่อให้หน้าเร็ว',
        'เปลี่ยนทุกส่วนเป็น accordion เท่ากัน และให้ผู้ใช้เปิดทีละหัวข้อก่อนตัดสินใจ'
      ],
      reason:[
        'การปรับนี้รักษา task order และ decision point แม้พื้นที่จอเปลี่ยน จึงยังเปรียบเทียบและตัดสินใจได้',
        'การย่อทุกอย่างคงโครงเดิม แต่ไม่ได้แก้ปัญหาการอ่านและการแตะบนจอเล็ก',
        'การซ่อนข้อมูลลดความยาวหน้า แต่ตัดหลักฐานที่จำเป็นต่อการตัดสินใจออกไป',
        'accordion ลดพื้นที่ แต่เพิ่มการเปิด–ปิดหลายครั้งและทำให้เปรียบเทียบข้าม card ยากขึ้น'
      ]
    },
    {
      main:[
        'ทดสอบว่าผู้ใช้บอกได้ทันทีว่าอะไรสำคัญ เปรียบเทียบสองวิชาได้ และเลือก next step โดยไม่ย้อนหา',
        'ตรวจว่าทุก card มีองค์ประกอบครบและใช้สีตาม design system โดยไม่ต้องให้ผู้ใช้ทำ task',
        'ให้ทีมออกแบบโหวตว่าหน้าใหม่ดูชัดขึ้นหรือไม่ แล้วใช้ผลโหวตเป็นเกณฑ์ผ่าน',
        'วัดเฉพาะเวลาที่ผู้ใช้อยู่บนหน้า เพราะเวลานานแปลว่าอ่านข้อมูลครบมากขึ้น'
      ],
      reason:[
        'เกณฑ์นี้ตรวจ hierarchy ผ่านพฤติกรรม: มองเห็นสิ่งสำคัญ เปรียบเทียบได้ และทำงานต่อได้',
        'ความครบขององค์ประกอบบอกคุณภาพการผลิต แต่ยังไม่พิสูจน์ว่าผู้ใช้เข้าใจลำดับ',
        'ความเห็นทีมเป็นข้อมูลภายใน ไม่ใช่หลักฐาน task success ของผู้ใช้เป้าหมาย',
        'เวลาอยู่หน้านานอาจเกิดจากความสับสน จึงตีความเป็นความสำเร็จโดยลำพังไม่ได้'
      ]
    }
  ];

  function idx(){
    var t=clean((document.querySelector('.hud .meter b')||document.querySelector('.case h1')||{}).textContent,200);
    var m=t.match(/([1-5])\s*\/\s*5|รอบภารกิจ\s*([1-5])/i);
    return Math.max(0,Math.min(4,Number((m&&(m[1]||m[2]))||1)-1));
  }
  function optionButtons(container){return container?Array.prototype.slice.call(container.querySelectorAll('button.option')):[];}
  function correctButton(buttons){
    return buttons.find(function(b){var t=clean(b.textContent,1000);return /เชื่อมกับหลักฐานและ artifact|เลือกแนวทางที่แก้|แยกผลกระทบของ|พิสูจน์ด้วย|จับ goal ว่า/.test(t);})||buttons[0];
  }
  function rewrite(container,texts,mark){
    var bs=optionButtons(container); if(bs.length!==4)return;
    var right=correctButton(bs), wrong=bs.filter(function(b){return b!==right;});
    var pairs=[[right,texts[0]],[wrong[0],texts[1]],[wrong[1],texts[2]],[wrong[2],texts[3]]];
    pairs.forEach(function(pair){if(!pair[0])return;var b=pair[0].querySelector('b')||pair[0];b.textContent=pair[1];var s=pair[0].querySelector('span');if(s)s.textContent='พิจารณาจากสถานการณ์และผลต่อการทำงานของผู้ใช้';});
    container.setAttribute('data-w7-final',mark);
  }
  function patchQuestion(){
    var i=idx(), question=document.querySelector('.question'); if(!question)return;
    var groups=question.querySelectorAll('.options');
    if(groups[0])rewrite(groups[0],stageModels[i].main,VERSION+'-main-'+i);
    if(groups[1])rewrite(groups[1],stageModels[i].reason,VERSION+'-reason-'+i);
    var hint=question.querySelector('.hint'); if(hint)hint.textContent='คำใบ้: ใช้ข้อมูล Issue → Goal → Priority ของ case นี้ แล้วเลือกแนวทางที่ทำให้ผู้ใช้ตัดสินใจและทำขั้นต่อไปได้';
  }

  function profile(){
    var p={}; try{p=window.UXQIdentity&&window.UXQIdentity.get?window.UXQIdentity.get():{};}catch(e){}
    try{if(!p.studentId)p=JSON.parse(localStorage.getItem('uxq.classroom.profile.v1')||'{}');}catch(e){}
    return {studentId:clean(p.studentId||q.get('studentId')||'',80),studentName:clean(p.studentName||q.get('studentName')||'',120),section:clean(p.section||q.get('section')||cfg().defaultSection||'',80)};
  }
  function complete(p){return !!(p.studentId&&p.studentName&&p.section);}
  function uid(prefix){return prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);}
  function result(){try{return window.UXQProgress.get().missions.w7.lastResult||{};}catch(e){return {};}}
  function fields(){var names=['fiveScreens','gridSpacing','visualHierarchy','ctaPlacement','mobileConsideration'],out={};Array.prototype.slice.call(document.querySelectorAll('.artifact textarea'),0,5).forEach(function(a,i){out[names[i]]=clean(a.value,1800);});return out;}
  function status(text){var art=document.querySelector('.artifact');if(!art)return;var el=art.querySelector('[data-w7-sheet-status]');if(!el){el=document.createElement('div');el.setAttribute('data-w7-sheet-status','1');el.style.cssText='margin-top:10px;padding:11px 13px;border:1px solid rgba(110,231,255,.45);border-radius:12px;background:rgba(7,17,36,.75);font-weight:800;line-height:1.45';art.appendChild(el);}el.textContent=text;}
  function payload(data){var p=profile(),r=result(),now=new Date().toISOString();return {app:'ux-quest',schema:'uxq.artifact.w7.v4',eventType:'artifact_submitted',eventId:uid('w7-artifact'),attemptId:uid('w7-attempt'),courseId:clean(cfg().courseId||'UXQ-ACT1-2026',120),courseLabel:clean(cfg().courseLabel||'CSAI2601 • UX Quest',160),studentId:p.studentId,studentName:p.studentName,section:p.section,missionId:'w7',missionTitle:'W7 • Wireframe Forge',completedAt:now,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'Asia/Bangkok',pageUrl:clean(location.href,500),artifactSubmitted:true,artifactType:'wireframe_priority_sheet',problemSeen:data.fiveScreens,uxReason:data.visualHierarchy,fixAndTest:[data.gridSpacing,data.ctaPlacement,data.mobileConsideration].join(' | '),reflection:Object.keys(data).map(function(k){return k+': '+data[k];}).join(' | '),learnedPoint:data.visualHierarchy,artifactFields:Object.keys(data).map(function(k){return {key:k,value:data[k]};}),score:Number(r.score||0),stars:Number(r.stars||0),accuracy:Number(r.accuracy||0),correct:Number(r.correct||0),total:Number(r.total||0),hints:Number(r.hints||0),durationSec:Number(r.durationSec||0),passed:Boolean(r.passed),source:VERSION};}
  function queue(item){var list=[];try{list=JSON.parse(localStorage.getItem(QUEUE_KEY)||'[]');}catch(e){}list=(Array.isArray(list)?list:[]).concat([item]).slice(-30);try{localStorage.setItem(QUEUE_KEY,JSON.stringify(list));}catch(e){}return list.length;}
  function send(item){var url=clean(cfg().receiverUrl||'',700);if(!url)return Promise.resolve({ok:false,reason:'no receiverUrl'});return fetch(url,{method:'POST',mode:'no-cors',cache:'no-store',keepalive:true,headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(item)}).then(function(){return {ok:true};}).catch(function(e){return {ok:false,count:queue(item),reason:String(e&&e.message||e)};});}
  function patchArtifact(){
    var art=document.querySelector('.artifact');if(!art)return;
    var btn=art.querySelector('[data-save-artifact]')||Array.prototype.slice.call(art.querySelectorAll('button')).find(function(b){return /บันทึก note|ส่งเข้า Sheet|Wireframe/.test(b.textContent);});
    if(btn){btn.textContent='ส่ง Wireframe Priority Sheet เข้า Google Sheet';btn.classList.remove('secondary');btn.setAttribute('data-w7-sheet-submit','1');}
    Array.prototype.slice.call(art.querySelectorAll('p')).forEach(function(p){p.textContent=p.textContent.replace(/นำผลการเล่นไปเติมใบงาน\/portfolio ตามหัวข้อต่อไปนี้/g,'กรอกการตัดสินใจจากหลักฐานให้ครบ แล้วส่งเข้า Google Sheet').replace(/บันทึก note ในเครื่อง/g,'ส่งเข้า Google Sheet');});
  }
  document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-w7-sheet-submit]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();var p=profile();if(!complete(p)){status('ส่งไม่ได้: โปรไฟล์ไม่ครบ กรุณากลับ Mission Control แล้วกรอกชื่อ รหัส และ Section');return;}var d=fields(),bad=Object.keys(d).filter(function(k){return d[k].length<20;});if(bad.length){status('กรอกครบทั้ง 5 ช่อง และแต่ละช่องอย่างน้อย 20 ตัวอักษร • ยังไม่ผ่าน '+bad.length+' ช่อง');return;}b.disabled=true;status('กำลังส่งเข้า Google Sheet...');send(payload(d)).then(function(out){b.disabled=false;status(out.ok?'ส่งคำขอเข้า Google Sheet แล้ว • ตรวจแถว eventType = artifact_submitted':'ส่งไม่สำเร็จ • เก็บคิวชั่วคราว '+(out.count||1)+' รายการ');});},true);

  function run(){patchQuestion();patchArtifact();var badge=document.querySelector('[data-w7-authority]');if(!badge){badge=document.createElement('div');badge.setAttribute('data-w7-authority','1');badge.style.cssText='position:fixed;left:12px;bottom:12px;z-index:9999;padding:7px 10px;border-radius:999px;background:#0d3154;color:#bff5ff;border:1px solid #5cdff5;font:700 12px system-ui';badge.textContent='W7 Final v3 • Sheet Only';document.body.appendChild(badge);}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
  new MutationObserver(function(){setTimeout(run,0);}).observe(document.documentElement,{childList:true,subtree:true});
  setInterval(run,500);
})();