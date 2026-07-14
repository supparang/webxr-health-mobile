/* CSAI2601 UX Quest • Global Anti-Guess Authority v2
 * Applies to W1-W15 and B1-B4 except W7.
 * Final visible-text authority: concise, parallel, plausible distractors.
 */
(function(){
  'use strict';

  var q=new URLSearchParams(location.search||'');
  var nodeId=String(q.get('node')||q.get('id')||'').toUpperCase();
  if(!nodeId||nodeId==='W7')return;

  var VERSION='global-anti-guess-v2-20260714';
  var MAIN_MARK='data-uxq-global-main-v2';
  var REASON_MARK='data-uxq-global-reason-v2';

  function clean(v,n){return String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,n||600);}
  function optionButtons(group){return group?Array.prototype.slice.call(group.querySelectorAll('button.option')):[];}
  function visibleText(el){return clean(el&&el.textContent,1200);}

  function stageKind(){
    var t=clean([
      (document.querySelector('.case .kicker')||{}).textContent,
      (document.querySelector('.case h1')||{}).textContent,
      (document.querySelector('.case p:last-child')||{}).textContent,
      (document.querySelector('.verify p')||{}).textContent
    ].join(' '),700).toLowerCase();
    if(/friction|จุดติดขัด|pain|issue/.test(t))return 'friction';
    if(/goal|เป้าหมาย|persona|empathy/.test(t))return 'goal';
    if(/impact|cognitive|memory|attention|feedback|information architecture|mental model/.test(t))return 'impact';
    if(/proof|test|validate|ทดสอบ|พิสูจน์|metric/.test(t))return 'proof';
    if(/cta|layout|wireframe|priority|hierarchy|fix|decision|prototype|แนวทางแก้/.test(t))return 'decision';
    return 'decision';
  }

  function findCorrectMain(bs){
    return bs.find(function(b){return b.dataset.uxqCorrect==='1'||b.getAttribute('data-correct')==='true';})||
      bs.find(function(b){
        var s=visibleText(b.querySelector('span'));
        return /เชื่อมกับหลักฐานและ artifact|หลักฐานและ artifact/i.test(s)&&!/กับดัก/i.test(s);
      })||bs[0];
  }

  function findCorrectReason(bs){
    return bs.find(function(b){return b.dataset.uxqCorrect==='1'||b.getAttribute('data-correct')==='true';})||
      bs.find(function(b){return /^ถูก\s*เพราะ|\bถูก\s*เพราะ/i.test(visibleText(b.querySelector('span')));})||bs[0];
  }

  var MAIN={
    friction:[
      'ระบุขั้นตอนที่ผู้ใช้หยุด ย้อนกลับ หรือทำงานต่อไม่ได้ แล้วใช้จุดนั้นเป็นปัญหาหลัก',
      'ระบุข้อมูลที่ผู้ใช้เปิดดูบ่อยที่สุด แล้วใช้ความถี่นั้นเป็นตัวแทนของปัญหาหลัก',
      'ระบุส่วนที่ทีมแก้ได้เร็วที่สุด แล้วเริ่มจากจุดนั้นเพื่อลดเวลาพัฒนารอบแรก',
      'ระบุองค์ประกอบที่มองเห็นเด่นที่สุด แล้วใช้ความชัดทางภาพเป็นเกณฑ์เลือกปัญหา'
    ],
    goal:[
      'นิยามผลลัพธ์ที่ผู้ใช้ต้องทำให้สำเร็จ พร้อมเงื่อนไขที่บอกว่างานนั้นเสร็จจริง',
      'นิยามสิ่งที่ผู้ใช้ชอบเห็นบนหน้า พร้อมรูปแบบภาพที่ช่วยให้รู้สึกมั่นใจขึ้น',
      'นิยามข้อมูลที่ควรแสดงให้ครบที่สุด พร้อมรายละเอียดที่ช่วยลดคำถามภายหลัง',
      'นิยามขั้นตอนที่ทีมต้องส่งมอบก่อน พร้อมข้อจำกัดที่ช่วยให้ระบบทำงานต่อได้'
    ],
    impact:[
      'แยกว่าปัญหาอยู่ที่การมองเห็น ลำดับงาน หรือ feedback แล้วเลือกวิธีแก้ให้ตรงชั้น',
      'รวมปัญหาทั้งหมดไว้ในกรอบ UI เพื่อให้ทีมใช้มาตรฐานภาพชุดเดียวกันแก้ได้เร็ว',
      'เริ่มจาก performance ของระบบ เพราะความเร็วที่ดีมักลดความสับสนระหว่างใช้งาน',
      'เริ่มจากความคุ้นเคยของผู้ใช้ เพราะรูปแบบเดิมช่วยลดภาระการเรียนรู้ได้เสมอ'
    ],
    decision:[
      'เลือกแบบที่รักษาข้อมูลตัดสินใจไว้ใกล้ action หลัก และลดการย้อนกลับระหว่างงาน',
      'เลือกแบบที่แยกข้อมูลเป็นหลายขั้น เพื่อให้แต่ละหน้าสั้นและลดความหนาแน่นของจอ',
      'เลือกแบบที่คงโครงเดิมไว้ แล้วเพิ่มคำอธิบายเฉพาะจุดที่ผู้ใช้มักลังเลหรือหยุด',
      'เลือกแบบที่เน้นภาพรวมก่อน แล้วเปิดรายละเอียดเพิ่มเมื่อผู้ใช้พร้อมตัดสินใจต่อ'
    ],
    proof:[
      'ให้ผู้ใช้ทำงานเดิม แล้ววัดความสำเร็จ เวลา ความผิดพลาด และความเข้าใจขั้นถัดไป',
      'ให้ผู้ใช้เลือกแบบที่ชอบ แล้วใช้คะแนนความพึงพอใจเปรียบเทียบก่อนและหลังปรับ',
      'ให้ทีมตรวจความครบตาม design system แล้วใช้จำนวนข้อผิดพลาดเป็นเกณฑ์ผ่าน',
      'ใช้จำนวนการเข้าชมและเวลาบนหน้า เพื่อดูว่าผู้ใช้สนใจและอยู่กับระบบนานขึ้น'
    ]
  };

  var REASON={
    friction:[
      'เกณฑ์นี้อ้างอิงพฤติกรรมที่ทำให้งานสะดุด จึงใช้ระบุจุดติดขัดได้ตรงกว่าเดาเอง',
      'เกณฑ์นี้อ้างอิงความถี่การเปิดดู จึงสะท้อนว่าส่วนนั้นสำคัญต่อผู้ใช้มากที่สุด',
      'เกณฑ์นี้อ้างอิงความเร็วของทีม จึงช่วยลดความเสี่ยงและส่งมอบการแก้ไขได้ไว',
      'เกณฑ์นี้อ้างอิงความเด่นทางภาพ จึงช่วยเลือกจุดที่ผู้ใช้สังเกตเห็นได้ง่ายที่สุด'
    ],
    goal:[
      'เกณฑ์นี้ผูกกับผลลัพธ์ที่ผู้ใช้ต้องทำสำเร็จ จึงตรวจได้ว่าการออกแบบช่วยงานจริงหรือไม่',
      'เกณฑ์นี้ผูกกับความชอบของผู้ใช้ จึงช่วยให้หน้าจอสร้างความรู้สึกเชิงบวกมากขึ้น',
      'เกณฑ์นี้ผูกกับความครบของข้อมูล จึงช่วยลดโอกาสที่ผู้ใช้ต้องกลับมาถามเพิ่มเติม',
      'เกณฑ์นี้ผูกกับข้อจำกัดการส่งมอบ จึงช่วยให้ทีมวางแผนงานและควบคุมต้นทุนได้'
    ],
    impact:[
      'เหตุผลนี้แยกชั้นของปัญหาได้ จึงลดโอกาสเลือกวิธีแก้ที่ดีแต่ไม่ตรงกับสาเหตุ',
      'เหตุผลนี้รวมทุกอย่างไว้ใน UI จึงช่วยให้ทีมใช้ภาษาออกแบบชุดเดียวกันได้ง่าย',
      'เหตุผลนี้ให้ความสำคัญกับความเร็ว จึงช่วยลดเวลารอและทำให้ประสบการณ์ลื่นขึ้น',
      'เหตุผลนี้ให้ความสำคัญกับความคุ้นเคย จึงช่วยลดภาระเรียนรู้สำหรับผู้ใช้เดิม'
    ],
    decision:[
      'เหตุผลนี้รักษาลำดับจากข้อมูลสำคัญไปสู่ action จึงลดการย้อนหาเงื่อนไขระหว่างงาน',
      'เหตุผลนี้ลดความหนาแน่นของแต่ละหน้า จึงช่วยให้ผู้ใช้โฟกัสทีละขั้นได้ง่ายขึ้น',
      'เหตุผลนี้คงโครงเดิมและเพิ่มคำอธิบาย จึงช่วยผู้ใช้ที่ยังไม่เข้าใจวิธีใช้งาน',
      'เหตุผลนี้เปิดรายละเอียดตามต้องการ จึงช่วยลดสิ่งรบกวนและประหยัดพื้นที่หน้าจอ'
    ],
    proof:[
      'เกณฑ์นี้วัดผลของงานผู้ใช้โดยตรง จึงบอกได้ว่าการแก้ช่วยให้ทำงานดีขึ้นจริงหรือไม่',
      'เกณฑ์นี้วัดความพึงพอใจโดยตรง จึงบอกได้ว่าผู้ใช้รู้สึกดีกับหน้าจอใหม่มากขึ้นหรือไม่',
      'เกณฑ์นี้วัดความครบตามมาตรฐาน จึงบอกได้ว่างานผลิตมีความสม่ำเสมอเพียงใด',
      'เกณฑ์นี้วัด engagement จึงบอกได้ว่าผู้ใช้สนใจและใช้เวลากับระบบมากขึ้นหรือไม่'
    ]
  };

  function writeButton(button,label){
    if(!button)return;
    var b=button.querySelector('b')||button;
    b.textContent=label;
    var s=button.querySelector('span');
    if(s)s.textContent='พิจารณาจากสถานการณ์และผลต่อการทำงานของผู้ใช้';
    button.removeAttribute('title');
  }

  function rewriteGroup(group,models,correctFinder,mark){
    var bs=optionButtons(group);
    if(bs.length!==4)return;
    var right=correctFinder(bs);
    var wrong=bs.filter(function(b){return b!==right;});
    writeButton(right,models[0]);
    wrong.forEach(function(b,i){writeButton(b,models[i+1]);});
    group.setAttribute(mark,VERSION);
  }

  function cleanQuestionText(){
    var p=document.querySelector('.question>.instruction');
    if(p)p.textContent='เลือกจากความสัมพันธ์ระหว่างสถานการณ์ งานของผู้ใช้ และผลที่ตรวจสอบได้';
    var hint=document.querySelector('.question>.utility .hint');
    if(hint)hint.textContent='คำใบ้: เทียบว่าแต่ละทางเลือกแก้ปัญหาที่เกิดขึ้นจริง หรือเพียงปรับสิ่งรอบข้าง';
  }

  function patch(){
    var question=document.querySelector('.question');
    if(!question)return;
    var kind=stageKind();
    var groups=question.querySelectorAll('.options');
    if(groups[0])rewriteGroup(groups[0],MAIN[kind]||MAIN.decision,findCorrectMain,MAIN_MARK);
    if(groups[1])rewriteGroup(groups[1],REASON[kind]||REASON.decision,findCorrectReason,REASON_MARK);
    cleanQuestionText();

    if(!document.querySelector('[data-global-anti-v2]')){
      var badge=document.createElement('div');
      badge.setAttribute('data-global-anti-v2','1');
      badge.style.cssText='position:fixed;left:12px;bottom:12px;z-index:99999;padding:7px 10px;border-radius:999px;background:#102b45;color:#c9f5ff;border:1px solid #5ad7ef;font:700 12px system-ui';
      badge.textContent='Global Anti-Guess v2 • '+nodeId;
      document.body.appendChild(badge);
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',patch,{once:true});else patch();
  new MutationObserver(function(){setTimeout(patch,0);}).observe(document.documentElement,{childList:true,subtree:true});
  setInterval(patch,350);
})();
