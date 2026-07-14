/* CSAI2601 UX Quest • Global Anti-Guess Authority v1
 * Applies to W1-W15 and B1-B4, except W7 (owned by its specialist authority).
 * Goals:
 * - preserve the engine's correct/wrong button identity
 * - remove longest-answer and keyword-answer cues
 * - remove visible correct/incorrect rationale before answering
 * - keep four choices grammatically parallel and similarly detailed
 */
(function(){
  'use strict';

  var params=new URLSearchParams(location.search||'');
  var nodeId=String(params.get('node')||params.get('id')||'').toUpperCase();
  if(!nodeId||nodeId==='W7')return;

  var VERSION='global-anti-guess-v1-20260714';
  var MAIN_MARK='data-uxq-global-main-v1';
  var REASON_MARK='data-uxq-global-reason-v1';

  function clean(v,n){return String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,n||600);}
  function buttons(group){return group?Array.prototype.slice.call(group.querySelectorAll('button.option')):[];}
  function textOf(el){return clean(el&&el.textContent,1200);}

  function stageIndex(){
    var meter=document.querySelector('.hud .meter b');
    var heading=document.querySelector('.case h1');
    var t=clean((meter||heading||{}).textContent,180);
    var m=t.match(/([1-9])\s*\/\s*([1-9])|(?:ข้อ|รอบภารกิจ|รอบบอส)\s*([1-9])/i);
    return Math.max(0,Number((m&&(m[1]||m[3]))||1)-1);
  }

  function context(){
    var heading=clean((document.querySelector('.case h1')||{}).textContent,180);
    var info=clean((document.querySelector('.case p:last-child')||document.querySelector('.instruction')||{}).textContent,260);
    var focus=info.replace(/^สถานการณ์\s*:\s*/i,'').replace(/\s*[•|]\s*โฟกัส\s*:.*/i,'');
    return {heading:heading||'ภารกิจ UX/UI',focus:focus||'สถานการณ์ของผู้ใช้ในข้อนี้'};
  }

  function findCorrectMain(bs){
    return bs.find(function(b){return b.dataset.uxqCorrect==='1';})||
      bs.find(function(b){
        var span=b.querySelector('span');
        var t=textOf(span);
        return /เชื่อมกับหลักฐานและ artifact|หลักฐานและ artifact/i.test(t)&&!/กับดัก/i.test(t);
      })||bs[0];
  }

  function findCorrectReason(bs){
    return bs.find(function(b){return b.dataset.uxqCorrect==='1';})||
      bs.find(function(b){
        var t=textOf(b.querySelector('span'));
        return /^ถูก\s*เพราะ|\bถูก\s*เพราะ/i.test(t);
      })||bs[0];
  }

  function mainModels(i,ctx){
    var subject=ctx.focus.length>82?ctx.focus.slice(0,82)+'…':ctx.focus;
    var sets=[
      [
        'จัดลำดับจากงานหลักของผู้ใช้ แล้ววางข้อมูลที่จำเป็นต่อการตัดสินใจไว้ก่อน action ถัดไป',
        'จัดลำดับจากข้อมูลที่ผู้ใช้พบเห็นบ่อย แล้วคง action ไว้ตำแหน่งเดิมเพื่อสร้างความคุ้นเคย',
        'จัดลำดับจากข้อจำกัดของทีมพัฒนา แล้วเลือกการปรับที่ทำได้เร็วโดยไม่เปลี่ยนโครงสร้างหลัก',
        'จัดลำดับจากความเด่นทางภาพ แล้วใช้สี ขนาด และพื้นที่ว่างช่วยนำสายตาไปยังเนื้อหาสำคัญ'
      ],
      [
        'เลือกโครงที่ทำให้ผู้ใช้เปรียบเทียบข้อมูลสำคัญในบริบทเดียวกัน และเห็นผลของแต่ละทางเลือกชัด',
        'เลือกโครงที่แบ่งข้อมูลเป็นหลายหน้าสั้น ๆ เพื่อลดความหนาแน่น แม้ต้องสลับหน้าเพื่อเปรียบเทียบ',
        'เลือกโครงที่คงรูปแบบหน้าปัจจุบันไว้ แล้วเพิ่มคำอธิบายเฉพาะจุดที่ผู้ใช้มักหยุดหรือย้อนกลับ',
        'เลือกโครงที่เน้นภาพรวมก่อนรายละเอียด โดยให้ผู้ใช้เปิดข้อมูลเพิ่มเมื่อพร้อมตัดสินใจในขั้นถัดไป'
      ],
      [
        'เลือก action หลักที่ตรงกับเป้าหมายของผู้ใช้ หลังแสดงข้อมูลจำเป็นครบ และแยก action รองให้ชัด',
        'เลือก action ที่ผู้ใช้กดบ่อยที่สุดเป็นปุ่มหลัก เพื่อให้ผู้ใช้เดิมทำงานได้เร็วและลดเวลาค้นหา',
        'เลือกหลาย action ที่น้ำหนักใกล้กัน เพื่อเปิดทางเลือกและลดความเสี่ยงที่ระบบชี้นำมากเกินไป',
        'เลือก action ที่ทีมดำเนินการต่อได้ง่ายที่สุด เพื่อให้ flow หลังบ้านเสถียรและตอบกลับได้รวดเร็ว'
      ],
      [
        'ปรับโครงตามพื้นที่ใช้งาน โดยรักษาลำดับงาน ข้อมูลตัดสินใจ และจุดตอบกลับของระบบให้ต่อเนื่อง',
        'ย่อองค์ประกอบเดิมตามสัดส่วนเพื่อรักษาความคุ้นเคย และลดการเปลี่ยนแปลงระหว่างจอขนาดต่างกัน',
        'ซ่อนข้อมูลรองให้มากที่สุดเพื่อให้หน้าสั้น แล้วให้ผู้ใช้เปิดรายละเอียดเฉพาะเมื่อเกิดข้อสงสัย',
        'เปลี่ยนทุกส่วนเป็นกล่องเปิดปิดเพื่อประหยัดพื้นที่ และให้ผู้ใช้กำหนดลำดับการอ่านด้วยตนเอง'
      ],
      [
        'ทดสอบด้วยงานเดิมและวัดความสำเร็จ เวลา ความผิดพลาด และความเข้าใจขั้นถัดไปก่อนเทียบผล',
        'ทดสอบด้วยความพึงพอใจหลังใช้งานและให้ผู้ใช้เลือกแบบที่ชอบ เพื่อสะท้อนความรู้สึกต่อหน้าจอ',
        'ทดสอบด้วยการตรวจตาม design system และความครบขององค์ประกอบ เพื่อยืนยันคุณภาพการผลิต',
        'ทดสอบด้วยสถิติการเข้าชมและเวลาบนหน้า เพื่อดูว่าผู้ใช้สนใจเนื้อหาและใช้เวลากับระบบมากขึ้น'
      ]
    ];
    var base=sets[i%sets.length].slice();
    return base.map(function(s){return s+' • ใช้กับ '+subject;});
  }

  function reasonModels(i,ctx){
    var focus=ctx.focus.length>70?ctx.focus.slice(0,70)+'…':ctx.focus;
    var sets=[
      [
        'แนวทางนี้เชื่อมอุปสรรคที่พบกับงานที่ผู้ใช้ต้องทำ และทำให้ตรวจผลหลังปรับได้จากพฤติกรรม',
        'แนวทางนี้รักษาความคุ้นเคยของหน้าจอเดิม และลดภาระการเรียนรู้สำหรับผู้ใช้ที่กลับมาใช้อีกครั้ง',
        'แนวทางนี้ลดขอบเขตงานของทีมและช่วยให้ส่งมอบเร็วขึ้น โดยคงกระบวนการหลักของระบบไว้',
        'แนวทางนี้เพิ่มความชัดทางภาพและช่วยนำสายตา แม้ยังต้องตรวจว่าผู้ใช้ทำงานสำเร็จจริงหรือไม่'
      ],
      [
        'หลักฐานนี้สัมพันธ์กับผลลัพธ์ของงานผู้ใช้ จึงใช้แยกสาเหตุและกำหนดสิ่งที่จะทดสอบหลังแก้ได้',
        'หลักฐานนี้สะท้อนความชอบของผู้ใช้ จึงช่วยตัดสินทิศทางภาพรวมและบรรยากาศของหน้าจอได้',
        'หลักฐานนี้สะท้อนข้อจำกัดการพัฒนา จึงช่วยเลือกแนวทางที่มีต้นทุนและความเสี่ยงเหมาะสม',
        'หลักฐานนี้สะท้อนมาตรฐานงานออกแบบ จึงช่วยตรวจความสม่ำเสมอและความครบขององค์ประกอบได้'
      ],
      [
        'การตัดสินใจนี้รักษาลำดับจากข้อมูลสำคัญไปสู่ action และลดโอกาสที่ผู้ใช้ต้องย้อนกลับไปหาเงื่อนไข',
        'การตัดสินใจนี้ให้ทางเลือกหลายแบบและลดการชี้นำ จึงเหมาะเมื่อผู้ใช้มีเป้าหมายแตกต่างกันมาก',
        'การตัดสินใจนี้คงรูปแบบเดิมและเพิ่มคำอธิบาย จึงเหมาะเมื่อปัญหาเกิดจากการไม่รู้วิธีใช้งาน',
        'การตัดสินใจนี้เน้นความเด่นของเนื้อหา จึงเหมาะเมื่อปัญหาหลักคือผู้ใช้มองไม่เห็นข้อมูลบนหน้า'
      ],
      [
        'เกณฑ์นี้วัด task outcome โดยตรง จึงบอกได้ว่าผู้ใช้ทำงานสำเร็จเร็วขึ้น ผิดน้อยลง หรือเข้าใจขึ้น',
        'เกณฑ์นี้วัดความพึงพอใจ จึงบอกได้ว่าผู้ใช้รู้สึกดีกับประสบการณ์และภาพลักษณ์ของระบบมากขึ้น',
        'เกณฑ์นี้วัดคุณภาพงานออกแบบ จึงบอกได้ว่าส่วนประกอบครบ สม่ำเสมอ และตรงตามมาตรฐานทีม',
        'เกณฑ์นี้วัดการใช้งานรวม จึงบอกได้ว่ามีผู้ใช้เข้าถึงหน้าและใช้เวลากับเนื้อหามากน้อยเพียงใด'
      ]
    ];
    return sets[i%sets.length].map(function(s){return s+' • บริบท: '+focus;});
  }

  function assign(group,models,isReason){
    var bs=buttons(group);if(bs.length!==4)return;
    var correct=isReason?findCorrectReason(bs):findCorrectMain(bs);
    correct.dataset.uxqCorrect='1';
    var wrong=bs.filter(function(b){return b!==correct;});
    var ordered=[[correct,models[0]],[wrong[0],models[1]],[wrong[1],models[2]],[wrong[2],models[3]]];
    ordered.forEach(function(pair){
      var b=pair[0];if(!b)return;
      var label=b.querySelector('b')||b;
      label.textContent=pair[1];
      var span=b.querySelector('span');
      if(span)span.textContent=isReason?'พิจารณาความสัมพันธ์ระหว่างหลักฐาน การตัดสินใจ และผลที่ตรวจสอบได้':'พิจารณาความเหมาะสมกับเป้าหมาย ข้อจำกัด และผลต่อการทำงานของผู้ใช้';
      b.removeAttribute('title');
    });
    group.setAttribute(isReason?REASON_MARK:MAIN_MARK,VERSION+'-'+stageIndex());
  }

  function neutralizeFeedbackBeforeAnswer(){
    document.querySelectorAll('.verify .option span').forEach(function(span){
      if(!span.closest('.options'))return;
      span.textContent='พิจารณาความสัมพันธ์ระหว่างหลักฐาน การตัดสินใจ และผลที่ตรวจสอบได้';
    });
  }

  function run(){
    var question=document.querySelector('.question');if(!question)return;
    var groups=question.querySelectorAll('.options');
    var i=stageIndex(),ctx=context();
    if(groups[0])assign(groups[0],mainModels(i,ctx),false);
    if(groups[1])assign(groups[1],reasonModels(i,ctx),true);
    neutralizeFeedbackBeforeAnswer();

    var hint=question.querySelector('.hint');
    if(hint&&!/เปิด hint แล้ว/.test(hint.textContent||'')){
      hint.textContent='คำใบ้: เปรียบเทียบว่าแต่ละทางเลือกตอบเป้าหมายผู้ใช้ ใช้หลักฐานอะไร และจะตรวจผลหลังปรับอย่างไร';
    }

    var badge=document.querySelector('[data-uxq-global-anti-guess]');
    if(!badge){
      badge=document.createElement('div');
      badge.setAttribute('data-uxq-global-anti-guess','1');
      badge.style.cssText='position:fixed;left:12px;bottom:12px;z-index:9998;padding:7px 10px;border-radius:999px;background:#15304f;color:#c9f7ff;border:1px solid #62dff5;font:700 12px system-ui;box-shadow:0 8px 24px rgba(0,0,0,.3)';
      badge.textContent='Global Anti-Guess v1 • '+nodeId;
      document.body.appendChild(badge);
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
  new MutationObserver(function(){setTimeout(run,0);}).observe(document.documentElement,{childList:true,subtree:true});
  setInterval(run,600);
})();
