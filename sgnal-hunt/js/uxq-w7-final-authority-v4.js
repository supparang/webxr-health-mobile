/* CSAI2601 UX Quest • W7 Final Authority v5
 * Production anti-guess + direct Sheet completion authority for W7.
 * Google Sheet remains the sole source of truth.
 */
(function(){
  'use strict';
  var query=new URLSearchParams(location.search||'');
  if(String(query.get('node')||'').toUpperCase()!=='W7')return;

  var VERSION='w7-final-authority-v5-20260717';
  var QUEUE_KEY='csai2601.uxq.w7.pending.v5';
  var cfg=function(){return window.UXQ_CLASSROOM_CONFIG||{};};
  var clean=function(v,n){return String(v==null?'':v).trim().slice(0,n||1800);};

  var MODELS=[
    {
      prompt:'ข้อใดกำหนดลำดับข้อมูลสำหรับการเปรียบเทียบวิชาได้เหมาะกับเป้าหมายของผู้ใช้มากที่สุด',
      main:[
        'แสดงเวลาเรียน หน่วยกิต ที่นั่ง และเงื่อนไขใน card เดียว ก่อนวางปุ่มเพิ่มวิชาไว้ท้ายข้อมูลตัดสินใจ',
        'แสดงชื่อวิชา ผู้สอน คำอธิบาย และภาพประกอบใน card เดียว ก่อนวางปุ่มดูรายละเอียดไว้ท้ายข้อมูลแนะนำ',
        'แสดงจำนวนผู้เลือก คะแนนนิยม รีวิว และหมวดวิชาใน card เดียว ก่อนวางปุ่มบันทึกไว้ท้ายข้อมูลความนิยม',
        'แสดงรหัสวิชา คณะ ภาคเรียน และประเภทวิชาใน card เดียว ก่อนวางปุ่มแชร์ไว้ท้ายข้อมูลเชิงระบบ'
      ],
      reasonPrompt:'ข้อความใดอธิบายความสัมพันธ์ระหว่างลำดับข้อมูลกับการตัดสินใจของผู้ใช้ได้ตรงที่สุด',
      reason:[
        'ข้อมูลที่มีผลต่อการเลือกถูกวางใกล้กัน ผู้ใช้จึงเปรียบเทียบได้ก่อนทำ action โดยไม่ต้องเปิดหลายหน้า',
        'ข้อมูลเชิงแนะนำถูกวางใกล้กัน ผู้ใช้จึงรู้จักรายวิชามากขึ้นก่อนตัดสินใจว่าจะเปิดรายละเอียดหรือไม่',
        'ข้อมูลความนิยมถูกวางใกล้กัน ผู้ใช้จึงเห็นแนวโน้มของกลุ่มก่อนตัดสินใจว่าจะบันทึกรายวิชาไว้หรือไม่',
        'ข้อมูลเชิงระบบถูกวางใกล้กัน ผู้ใช้จึงตรวจสอบรหัสและหมวดหมู่ก่อนตัดสินใจว่าจะส่งต่อข้อมูลหรือไม่'
      ],
      hint:'เทียบสิ่งที่ผู้ใช้ต้องใช้ “เลือกวิชา” กับข้อมูลที่เพียงช่วยรู้จักหรือจัดการรายการ'
    },
    {
      prompt:'ข้อใดเลือกโครง wireframe ที่ช่วยเปรียบเทียบหลายวิชาได้โดยรักษาข้อมูลสำคัญให้อยู่ในตำแหน่งคงที่',
      main:[
        'ใช้ comparison cards รูปแบบเดียวกัน พร้อม filter ด้านบน และคงเวลา หน่วยกิต ที่นั่ง และเงื่อนไขในทุก card',
        'ใช้ comparison table พร้อมแถบค้นหาด้านบน และคงชื่อ ผู้สอน คณะ และคำอธิบายย่อในทุกแถวของตาราง',
        'ใช้ gallery cards พร้อมตัวกรองด้านข้าง และคงภาพ หมวดวิชา รีวิว และจำนวนผู้เลือกในทุก card ของรายการ',
        'ใช้ accordion list พร้อมปุ่มจัดเรียงด้านบน และคงรหัส ภาคเรียน สถานะ และลิงก์เอกสารในทุกหัวข้อ'
      ],
      reasonPrompt:'ข้อความใดชี้ว่ารูปแบบโครงสร้างนั้นลดภาระการเปรียบเทียบสำหรับงานในสถานการณ์นี้ได้จริง',
      reason:[
        'ตัวแปรที่ใช้เลือกปรากฏในตำแหน่งเดียวกันทุก card ผู้ใช้จึงสแกนข้ามรายการและเปรียบเทียบได้ต่อเนื่อง',
        'ข้อมูลพื้นฐานปรากฏในตำแหน่งเดียวกันทุกแถว ผู้ใช้จึงตรวจสอบรายวิชาและเปิดคำอธิบายเพิ่มได้ต่อเนื่อง',
        'ข้อมูลความนิยมปรากฏในตำแหน่งเดียวกันทุก card ผู้ใช้จึงสำรวจแนวโน้มและเลือกดูรายการเด่นได้ต่อเนื่อง',
        'ข้อมูลเอกสารปรากฏในตำแหน่งเดียวกันทุกหัวข้อ ผู้ใช้จึงเปิดแต่ละส่วนและตรวจสอบไฟล์ได้ต่อเนื่อง'
      ],
      hint:'พิจารณาว่าตัวแปรใดต้องมองข้ามรายการพร้อมกัน ไม่ใช่เพียงข้อมูลที่จัดวางได้เป็นระเบียบ'
    },
    {
      prompt:'ข้อใดกำหนด primary CTA ให้ตรงกับ next step หลังผู้ใช้มีข้อมูลเพียงพอสำหรับเลือกวิชาแล้ว',
      main:[
        'ใช้ “เพิ่มในแผนเรียน” เป็นปุ่มหลักหลังข้อมูลตัดสินใจ และใช้ “ดูรายละเอียด” เป็น action รองใน card เดียวกัน',
        'ใช้ “ดูรายละเอียด” เป็นปุ่มหลักหลังข้อมูลแนะนำ และใช้ “ติดตามรายวิชา” เป็น action รองใน card เดียวกัน',
        'ใช้ “บันทึกรายการ” เป็นปุ่มหลักหลังข้อมูลความนิยม และใช้ “แชร์ให้เพื่อน” เป็น action รองใน card เดียวกัน',
        'ใช้ “เปิดเอกสาร” เป็นปุ่มหลักหลังข้อมูลเชิงระบบ และใช้ “คัดลอกรหัสวิชา” เป็น action รองใน card เดียวกัน'
      ],
      reasonPrompt:'ข้อความใดอธิบายได้ตรงที่สุดว่าทำไม action หลักจึงควรอยู่หลังข้อมูลชุดนั้นใน flow นี้',
      reason:[
        'ผู้ใช้ประเมินเวลา หน่วยกิต ที่นั่ง และเงื่อนไขแล้ว จึงทำขั้นเพิ่มวิชาได้โดยลดการย้อนกลับไปตรวจข้อมูล',
        'ผู้ใช้ประเมินคำอธิบาย ผู้สอน และภาพรวมแล้ว จึงเปิดรายละเอียดเพิ่มได้โดยลดการกลับมาค้นหารายการเดิม',
        'ผู้ใช้ประเมินคะแนนนิยม รีวิว และจำนวนผู้เลือกแล้ว จึงบันทึกรายการได้โดยลดการกลับมาสำรวจแนวโน้มเดิม',
        'ผู้ใช้ประเมินรหัส หมวดหมู่ และสถานะแล้ว จึงเปิดเอกสารได้โดยลดการกลับมาตรวจข้อมูลเชิงระบบเดิม'
      ],
      hint:'แยก “ขั้นที่ทำให้งานหลักเดินต่อ” ออกจาก action ที่ช่วยอ่าน บันทึก แชร์ หรือจัดการข้อมูล'
    },
    {
      prompt:'ข้อใดปรับ wireframe สำหรับมือถือโดยยังรักษาลำดับการเปรียบเทียบและจุดตัดสินใจของผู้ใช้',
      main:[
        'ใช้ card stack เต็มความกว้าง คงเวลา ที่นั่ง และเงื่อนไขก่อน CTA และย่อข้อมูลรองไว้ในส่วนเปิดเพิ่มได้',
        'ใช้ card stack เต็มความกว้าง คงชื่อ ผู้สอน และคำอธิบายก่อนลิงก์ และย่อข้อมูลสถิติไว้ในส่วนเปิดเพิ่มได้',
        'ใช้ card stack เต็มความกว้าง คงภาพ รีวิว และความนิยมก่อนปุ่มบันทึก และย่อข้อมูลหมวดไว้ในส่วนเปิดเพิ่มได้',
        'ใช้ card stack เต็มความกว้าง คงรหัส สถานะ และเอกสารก่อนปุ่มแชร์ และย่อข้อมูลภาคเรียนไว้ในส่วนเปิดเพิ่มได้'
      ],
      reasonPrompt:'ข้อความใดอธิบายว่าการปรับสำหรับจอเล็กยังคง task order ของสถานการณ์นี้ได้อย่างเหมาะสม',
      reason:[
        'ข้อมูลที่ใช้เปรียบเทียบยังมาก่อน action หลัก ส่วนข้อมูลรองถูกย่อโดยไม่ตัดหลักฐานที่ใช้เลือกวิชาออก',
        'ข้อมูลที่ใช้ทำความรู้จักยังมาก่อนลิงก์รายละเอียด ส่วนข้อมูลสถิติถูกย่อโดยไม่ตัดคำอธิบายรายวิชาออก',
        'ข้อมูลที่ใช้ดูแนวโน้มยังมาก่อนปุ่มบันทึก ส่วนข้อมูลหมวดถูกย่อโดยไม่ตัดภาพและรีวิวของรายการออก',
        'ข้อมูลที่ใช้ตรวจระบบยังมาก่อนปุ่มแชร์ ส่วนข้อมูลภาคเรียนถูกย่อโดยไม่ตัดรหัสและเอกสารอ้างอิงออก'
      ],
      hint:'ตรวจว่าโครงมือถือยังช่วย “เปรียบเทียบแล้วเลือก” ไม่ใช่เพียงทำให้เนื้อหาพอดีกับจอ'
    },
    {
      prompt:'ข้อใดเป็นแผนทดสอบที่พิสูจน์ได้ว่า visual hierarchy ใหม่ช่วยให้งานเลือกวิชาดีขึ้นจริง',
      main:[
        'ให้ผู้ใช้เปรียบเทียบสองวิชา เลือกวิชาที่ตรงเงื่อนไข และวัดความสำเร็จ เวลา ความผิดพลาด และการย้อนหา',
        'ให้ผู้ใช้สำรวจสองวิชา เลือกหน้าที่ชอบ และวัดคะแนนความสวย ความทันสมัย ความจดจำ และความพึงพอใจ',
        'ให้ทีมตรวจสองวิชา เลือกแบบที่ตรงระบบ และวัดความครบ consistency การใช้สี และความถูกต้องของ component',
        'ให้ผู้ใช้เปิดสองวิชา เลือกไฟล์ที่ต้องการ และวัดจำนวนคลิก เวลาเปิดเอกสาร การดาวน์โหลด และการแชร์ต่อ'
      ],
      reasonPrompt:'ข้อความใดเชื่อมตัวชี้วัดกับ friction และผลลัพธ์ของภารกิจเลือกวิชาได้ตรงที่สุด',
      reason:[
        'ตัวชี้วัดตรวจทั้งการเปรียบเทียบ การเลือกให้ตรงเงื่อนไข และภาระระหว่างทำ task จึงตอบปัญหาเดิมโดยตรง',
        'ตัวชี้วัดตรวจทั้งความชอบ ความทันสมัย และการจดจำภาพรวม จึงตอบคุณภาพด้านการรับรู้ของหน้าจอโดยตรง',
        'ตัวชี้วัดตรวจทั้งความครบ consistency และ component จึงตอบคุณภาพด้านการผลิตตาม design system โดยตรง',
        'ตัวชี้วัดตรวจทั้งการเปิดไฟล์ ดาวน์โหลด และแชร์ต่อ จึงตอบคุณภาพด้านการเข้าถึงเอกสารรายวิชาโดยตรง'
      ],
      hint:'เลือกหลักฐานที่ตอบว่า “ผู้ใช้เลือกวิชาถูกและง่ายขึ้นหรือไม่” ไม่ใช่เพียงหน้าสวยหรือผลิตครบ'
    }
  ];

  function stageIndex(){
    var text=clean((document.querySelector('.hud .meter b')||document.querySelector('.case h1')||{}).textContent,240);
    var match=text.match(/([1-5])\s*\/\s*5|รอบภารกิจ\s*([1-5])/i);
    return Math.max(0,Math.min(4,Number((match&&(match[1]||match[2]))||1)-1));
  }
  function buttons(container){return container?Array.prototype.slice.call(container.querySelectorAll('button.option')):[];}
  function truth(buttonsList,reasonMode){
    var remembered=buttonsList.find(function(b){return b.dataset.w7Truth==='1';});
    if(remembered)return remembered;
    var patterns=reasonMode
      ? [/^เหตุผลนี้/,/task outcome/,/friction.*decision/,/ตรวจสอบผลหลังปรับ/,/วัดได้ว่าผู้ใช้/]
      : [/เชื่อมกับหลักฐานและ artifact/,/เลือกแนวทางที่แก้/,/แยกผลกระทบของ/,/พิสูจน์ด้วย/,/จับ goal ว่า/];
    var found=buttonsList.find(function(b){var t=clean(b.textContent,1200);return patterns.some(function(re){return re.test(t);});});
    if(!found)found=buttonsList[0];
    found.dataset.w7Truth='1';
    return found;
  }
  function rewrite(container,texts,reasonMode,mark){
    var list=buttons(container);if(list.length!==4)return;
    var right=truth(list,reasonMode);
    var wrong=list.filter(function(b){return b!==right;});
    [[right,texts[0]],[wrong[0],texts[1]],[wrong[1],texts[2]],[wrong[2],texts[3]]].forEach(function(pair){
      if(!pair[0])return;
      var title=pair[0].querySelector('b')||pair[0];title.textContent=pair[1];
      var sub=pair[0].querySelector('span');
      if(sub)sub.textContent='พิจารณาความสอดคล้องกับสถานการณ์ เป้าหมาย และขั้นตอนของผู้ใช้';
      pair[0].dataset.w7Copy=mark;
    });
  }
  function patchQuestion(){
    var question=document.querySelector('.question');if(!question)return;
    var model=MODELS[stageIndex()];
    var groups=question.querySelectorAll('.options');
    if(groups[0])rewrite(groups[0],model.main,false,VERSION+'-main');
    if(groups[1])rewrite(groups[1],model.reason,true,VERSION+'-reason');
    var mainPrompt=question.querySelector(':scope > .prompt');if(mainPrompt)mainPrompt.textContent=model.prompt;
    var intro=question.querySelector(':scope > .instruction');
    if(intro)intro.textContent='ตัวเลือกทั้งสี่เป็นแนวทางที่เป็นไปได้ในคนละเป้าหมาย ต้องใช้รายละเอียดของ case ตัดสิน ไม่ใช้ความยาวหรือคำศัพท์เป็นคำใบ้';
    var verify=question.querySelector('.verify');
    if(verify){var h=verify.querySelector('h3');if(h)h.textContent='ตรวจความเชื่อมโยง';var p=verify.querySelector('p');if(p)p.textContent=model.reasonPrompt;}
    var hint=question.querySelector('.hint');if(hint)hint.textContent='คำใบ้: '+model.hint;
  }
  function ensureStyle(){
    if(document.getElementById('uxq-w7-final-v5-style'))return;
    var style=document.createElement('style');style.id='uxq-w7-final-v5-style';
    style.textContent='body[data-w7-final="v5"] .question .option{min-height:142px}body[data-w7-final="v5"] .question .option b{font-weight:800;line-height:1.5}body[data-w7-final="v5"] .question .option span{opacity:.72}body[data-w7-final="v5"] [data-w7-authority]{background:#073b32!important;border-color:#72f2c2!important;color:#d9fff1!important}';
    document.head.appendChild(style);document.body.dataset.w7Final='v5';
  }
  function profile(){
    var p={};try{p=window.UXQIdentity&&window.UXQIdentity.get?window.UXQIdentity.get():{};}catch(e){}
    try{if(!p.studentId)p=JSON.parse(localStorage.getItem('uxq.classroom.profile.v1')||'{}');}catch(e){}
    return {studentId:clean(p.studentId||query.get('studentId')||'',80),studentName:clean(p.studentName||query.get('studentName')||'',120),section:clean(p.section||query.get('section')||cfg().defaultSection||'',80)};
  }
  function profileComplete(p){return !!(p.studentId&&p.studentName&&p.section);}
  function uid(prefix){return prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);}
  function result(){try{return window.UXQProgress.get().missions.w7.lastResult||{};}catch(e){return {};}}
  function fields(){var names=['fiveScreens','gridSpacing','visualHierarchy','ctaPlacement','mobileConsideration'],out={};Array.prototype.slice.call(document.querySelectorAll('.artifact textarea'),0,5).forEach(function(a,i){out[names[i]]=clean(a.value,1800);});return out;}
  function status(text){var art=document.querySelector('.artifact');if(!art)return;var el=art.querySelector('[data-w7-sheet-status]');if(!el){el=document.createElement('div');el.setAttribute('data-w7-sheet-status','1');el.style.cssText='margin-top:10px;padding:11px 13px;border:1px solid rgba(110,231,255,.45);border-radius:12px;background:rgba(7,17,36,.75);font-weight:800;line-height:1.45';art.appendChild(el);}el.textContent=text;}
  function common(){
    var p=profile(),r=result(),correct=Math.max(0,Number(r.correct||0)),total=Math.max(5,Number(r.total||r.verifiedTotal||0)),stars=Math.max(2,Number(r.stars||0)),accuracy=Number(r.accuracy||0);
    if(!accuracy&&total)accuracy=Math.round((correct/total)*10000)/100;
    return {p:p,r:r,correct:correct,total:total,stars:stars,accuracy:accuracy,now:new Date().toISOString()};
  }
  function artifactPayload(data){
    var c=common();
    return {app:'ux-quest',schema:'uxq.artifact.w7.v5',eventType:'artifact_submitted',eventId:uid('w7-artifact'),attemptId:clean(c.r.attemptId||uid('w7-attempt'),120),courseId:clean(cfg().courseId||'UXQ-ACT1-2026',120),courseLabel:clean(cfg().courseLabel||'CSAI2601 • UX Quest',160),studentId:c.p.studentId,studentName:c.p.studentName,section:c.p.section,missionId:'w7',nodeId:'w7',missionTitle:'W7 • Wireframe Rescue',completedAt:c.now,clientTimestamp:c.now,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'Asia/Bangkok',pageUrl:clean(location.href,500),artifactSubmitted:true,artifactType:'wireframe_priority_sheet',problemSeen:data.fiveScreens,uxReason:data.visualHierarchy,fixAndTest:[data.gridSpacing,data.ctaPlacement,data.mobileConsideration].join(' | '),reflection:Object.keys(data).map(function(k){return k+': '+data[k];}).join(' | '),learnedPoint:data.visualHierarchy,artifactFields:Object.keys(data).map(function(k){return {key:k,value:data[k]};}),score:Number(c.r.score||0),stars:c.stars,accuracy:c.accuracy,correct:c.correct,total:c.total,hints:Number(c.r.hints||0),durationSec:Number(c.r.durationSec||0),passed:true,source:VERSION};
  }
  function completionPayload(data){
    var c=common(),stable='w7-complete-'+clean(c.p.section,30)+'-'+clean(c.p.studentId,50)+'-'+clean(c.r.attemptId||c.r.completedAt||c.r.score||'latest',80).replace(/[^a-z0-9_-]/gi,'-');
    return {app:'ux-quest',schema:'uxq.mission_completed.v1',eventType:'mission_completed',eventId:stable,attemptId:clean(c.r.attemptId||stable,120),courseId:clean(cfg().courseId||'UXQ-ACT1-2026',120),courseLabel:clean(cfg().courseLabel||'CSAI2601 • UX Quest',160),studentId:c.p.studentId,studentName:c.p.studentName,section:c.p.section,missionId:'w7',nodeId:'w7',missionTitle:'W7 • Wireframe Rescue',completedAt:c.now,clientTimestamp:c.now,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'Asia/Bangkok',pageUrl:clean(location.href,500),score:Number(c.r.score||0),stars:c.stars,accuracy:c.accuracy,correct:c.correct,total:c.total,verifiedTotal:c.total,hints:Number(c.r.hints||0),durationSec:Number(c.r.durationSec||0),passed:true,mastered:true,artifactSubmitted:true,artifactType:'wireframe_priority_sheet',reflection:Object.keys(data).map(function(k){return k+': '+data[k];}).join(' | '),learnedPoint:data.visualHierarchy,source:VERSION};
  }
  function queue(item){var list=[];try{list=JSON.parse(localStorage.getItem(QUEUE_KEY)||'[]');}catch(e){}list=(Array.isArray(list)?list:[]).concat([item]).slice(-30);try{localStorage.setItem(QUEUE_KEY,JSON.stringify(list));}catch(e){}return list.length;}
  function send(item){var url=clean(cfg().receiverUrl||'',700);if(!url)return Promise.resolve({ok:false,reason:'no receiverUrl'});return fetch(url,{method:'POST',mode:'no-cors',cache:'no-store',keepalive:true,headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(item)}).then(function(){return {ok:true};}).catch(function(e){return {ok:false,count:queue(item),reason:String(e&&e.message||e)};});}
  function sendBoth(data){return Promise.all([send(artifactPayload(data)),send(completionPayload(data))]).then(function(out){return {ok:out.every(function(x){return x.ok;}),results:out};});}
  function patchArtifact(){
    var art=document.querySelector('.artifact');if(!art)return;
    var btn=art.querySelector('[data-save-artifact]')||Array.prototype.slice.call(art.querySelectorAll('button')).find(function(b){return /บันทึก note|ส่งเข้า Sheet|Wireframe/.test(b.textContent);});
    if(btn){btn.textContent='ส่ง Wireframe Priority Sheet เข้า Google Sheet';btn.classList.remove('secondary');btn.setAttribute('data-w7-sheet-submit','1');}
    Array.prototype.slice.call(art.querySelectorAll('p')).forEach(function(p){p.textContent=p.textContent.replace(/นำผลการเล่นไปเติมใบงาน\/portfolio ตามหัวข้อต่อไปนี้/g,'กรอกการตัดสินใจจากหลักฐานให้ครบ แล้วส่งเข้า Google Sheet').replace(/บันทึก note ในเครื่อง/g,'ส่งเข้า Google Sheet');});
  }
  document.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('[data-w7-sheet-submit]');if(!b)return;
    e.preventDefault();e.stopImmediatePropagation();
    var p=profile();if(!profileComplete(p)){status('ส่งไม่ได้: โปรไฟล์ไม่ครบ กรุณากลับ Mission Control แล้วกรอกชื่อ รหัส และ Section');return;}
    var data=fields(),bad=Object.keys(data).filter(function(k){return data[k].length<20;});
    if(bad.length){status('กรอกครบทั้ง 5 ช่อง และแต่ละช่องอย่างน้อย 20 ตัวอักษร • ยังไม่ผ่าน '+bad.length+' ช่อง');return;}
    b.disabled=true;status('กำลังส่ง Artifact และผลผ่าน W7 เข้า Google Sheet...');
    sendBoth(data).then(function(out){b.disabled=false;status(out.ok?'ส่งแล้ว 2 รายการ • artifact_submitted + mission_completed • กดตรวจ Sheet อีกครั้ง':'ส่งไม่สำเร็จ • ระบบเก็บคิวชั่วคราวเพื่อส่งซ้ำ');});
  },true);
  document.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('button,a');if(!b||!/ตรวจ\s*Sheet\s*อีกครั้ง/i.test(clean(b.textContent,120)))return;
    var data=fields();if(Object.keys(data).length===5)send(completionPayload(data));
  },true);
  function run(){ensureStyle();patchQuestion();patchArtifact();var badge=document.querySelector('[data-w7-authority]');if(!badge){badge=document.createElement('div');badge.setAttribute('data-w7-authority','1');badge.style.cssText='position:fixed;left:12px;bottom:12px;z-index:9999;padding:7px 10px;border-radius:999px;background:#073b32;color:#d9fff1;border:1px solid #72f2c2;font:700 12px system-ui';document.body.appendChild(badge);}badge.textContent='W7 Final v5 • Direct mission completion • Sheet Only';}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
  new MutationObserver(function(){setTimeout(run,0);}).observe(document.documentElement,{childList:true,subtree:true});
  setInterval(run,500);
})();