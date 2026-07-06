/* CSAI2102 S2 Agent Builder feedback + challenge mode v6.7.6 */
(()=>{'use strict';
  if(window.__AIQUEST_S2_CHALLENGE_V676__)return;
  window.__AIQUEST_S2_CHALLENGE_V676__=true;

  const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));

  function hardenS2Deck(){
    const api=window.AIQuestS2AgentDeckV672;
    if(!api||api.__challengeModeV676||typeof api.buildDeck!=='function')return false;
    api.__challengeModeV676=true;
    const originalBuild=api.buildDeck.bind(api);
    const contexts=Array.isArray(api.contexts)?api.contexts:[];
    const contextFor=title=>contexts.find(ctx=>String(ctx.title||'')===String(title||''))||{title:String(title||'ระบบนี้'),risk:'ข้อมูลจากหลายแหล่งไม่สอดคล้องกัน',e:'ผู้ใช้ สภาพแวดล้อม และข้อจำกัดจริง'};
    const set=(card,prompt,correct,wrong,explain)=>{card.prompt=prompt;card.correct=correct;card.wrong=wrong;card.explain=explain;return card;};

    function hardMap(card,ctx){
      if(card.skill==='PEAS ครบองค์ประกอบ'){
        card.prompt='ทีมกำลังออกแบบ '+ctx.title+' แต่ยังไม่ได้กำหนด PEAS ให้ตรวจสอบได้ จัดข้อมูลต่อไปนี้ให้ถูกหมวด โดยแยก “สิ่งที่วัดผล” ออกจาก “สิ่งที่ระบบพบ/ทำ/รับรู้”';
        card.cards=[
          {text:'งานสำเร็จถูกต้อง พร้อมลดผลกระทบและความผิดพลาดต่อผู้ใช้',answer:'P • Performance'},
          {text:ctx.e,answer:'E • Environment'},
          {text:'คำสั่งที่เปลี่ยนสถานะโลกจริง เช่น เคลื่อนที่ หยุด ปลดล็อก หรือแจ้งเตือน',answer:'A • Actuator'},
          {text:'สัญญาณภาพ ระยะห่าง ตำแหน่ง หรือสถานะที่ระบบรับเข้ามา',answer:'S • Sensor'}
        ];
      }
      if(card.skill==='Sensor / Actuator'){
        card.prompt='ใน '+ctx.title+' ให้แยก “ข้อมูลที่ agent รับเข้ามา” กับ “คำสั่งที่ agent ส่งไปเปลี่ยนโลกจริง” อย่าสับสนกับคะแนนหรือกฎภายในโมเดล';
        card.cards=[
          {text:'ภาพหรือระยะห่างที่ตรวจพบจากพื้นที่ปฏิบัติงาน',answer:'Sensor'},
          {text:'คำสั่งเคลื่อนที่ หยุด ล็อก/ปลดล็อก หรือแจ้งเตือน',answer:'Actuator'},
          {text:'สถานะบัตร ตำแหน่ง หรือวัตถุที่เซนเซอร์อ่านได้',answer:'Sensor'},
          {text:'การสั่งเบรก เปิดประตู ปรับสายพาน หรือเรียกคิว',answer:'Actuator'}
        ];
      }
      return card;
    }

    function hardChoice(card,ctx){
      const name=ctx.title, risk=ctx.risk||'ข้อมูลจากหลายแหล่งให้ผลไม่ตรงกัน';
      switch(card.skill){
        case 'Performance measure':
          return set(card,
            name+' มีเป้าหมายทั้งคุณภาพ ความปลอดภัย และผลกระทบต่อผู้ใช้ ชุดตัวชี้วัดใดเหมาะเป็น Performance Measure หลักที่สุด?',
            'งานสำเร็จถูกต้อง พร้อมลดเหตุเสี่ยงและการปฏิเสธผู้มีสิทธิ์ผิดพลาด',
            ['เพิ่มจำนวนงานต่อชั่วโมง แม้ไม่แยกเหตุเสี่ยงที่เกิดกับผู้ใช้','วัด confidence ของโมเดลสูงสุด โดยไม่ตรวจผลลัพธ์จริง','ลดเวลาเฉลี่ยอย่างเดียว แล้วให้เจ้าหน้าที่แก้กรณีผิดภายหลัง'],
            'Performance measure ที่ดีต้องวัดผลลัพธ์จริงหลายมิติ ไม่ใช่ความเร็วหรือ confidence เพียงตัวเดียว');
        case 'Rational action':
          return set(card,
            'ระหว่างทำงาน '+name+' พบว่า '+risk+' และ percept ขัดกัน Policy ใดเป็นการตัดสินใจแบบ rational agent มากที่สุด?',
            'ลดระดับ action ตรวจข้อมูลข้ามแหล่ง แล้วใช้ทางเลือกปลอดภัยชั่วคราว',
            ['ใช้ข้อมูลแหล่งที่มี confidence สูงสุดแล้วทำงานต่อ','ลดความเร็วลงเล็กน้อยแต่คง action เดิมไว้','เลือก action ที่รักษาเวลาให้ผ่านเป้าหมายรอบนี้'],
            'Rational agent เลือก action ตาม percept เป้าหมาย และความเสี่ยง ณ เวลานั้น ไม่ใช่เลือกวิธีที่เร็วที่สุดเสมอ');
        case 'Human oversight':
          return set(card,
            'กรณี '+risk+' มีผลกระทบสูงต่อผู้ใช้ การกำกับโดยมนุษย์แบบใดสมดุลที่สุด?',
            'ใช้ threshold ที่กำหนด หยุดหรือจำกัด action แล้วส่งเหตุผลให้เจ้าหน้าที่ตัดสิน',
            ['ให้โมเดลสำรองยืนยันผล 2 ครั้ง แล้วทำ action อัตโนมัติ','ลดขอบเขต action แต่เก็บไว้ให้เจ้าหน้าที่ดูตอนสิ้นกะ','ปฏิเสธทุกเคสที่ไม่แน่ใจและให้ผู้ใช้ยื่นคำร้องภายหลัง'],
            'Human oversight ที่ดีต้องมีจุด trigger, safe fallback, เหตุผลที่ตรวจได้ และผู้รับผิดชอบที่ตัดสินได้ทันเวลา');
        case 'Agent concept':
          return set(card,
            'สถาปัตยกรรมใดทำให้ '+name+' เป็น intelligent agent มากที่สุด?',
            'รับ percept ปัจจุบัน ประเมินเป้าหมาย แล้วเลือก action ตามสถานะที่เปลี่ยนไป',
            ['ทำตามตารางเวลาคงที่ แม้สภาพแวดล้อมเปลี่ยนระหว่างวัน','แสดงคำแนะนำจากค่าเฉลี่ยเดิมแล้วไม่ปรับตามข้อมูลใหม่','สรุป log สิ้นวันโดยไม่มี action ต่อสภาพแวดล้อม'],
            'Agent เชื่อม perception กับ action ภายใต้เป้าหมายและสถานะปัจจุบัน ไม่ใช่เพียงทำงานอัตโนมัติแบบคงที่');
        case 'Sensor reliability':
          return set(card,
            'หาก sensor ของ '+name+' ให้ข้อมูลไม่สอดคล้องกัน แนวทางใดลดความเสี่ยงของ percept ที่ผิดได้เหมาะที่สุด?',
            'ตรวจคุณภาพแต่ละแหล่ง เปรียบเทียบข้าม sensor และใช้ safe fallback เมื่อข้อมูลขัดกัน',
            ['เฉลี่ยคะแนน sensor ทุกตัวโดยไม่แยกคุณภาพของแต่ละแหล่ง','ใช้ค่าจาก sensor ล่าสุดเพียงตัวเดียวเพื่อลดเวลาในการตัดสินใจ','ให้โมเดลเดาค่าที่หายไป แล้วคง action เดิมจนจบรอบ'],
            'ความน่าเชื่อถือของ percept ต้องพิจารณา sensor quality, disagreement และทางเลือกเมื่อข้อมูลไม่พอ');
        case 'Environment':
          return set(card,
            'ข้อใดควรถูกนับเป็น Environment ที่ '+name+' ต้องรับรู้และตอบสนอง มากกว่าจะเป็นตัวแปรภายในของโมเดล?',
            ctx.e,
            ['ค่า confidence, threshold และกฎที่อยู่ภายในโมเดล','ประวัติการฝึกโมเดลและพารามิเตอร์ภายในระบบ','คำสั่ง action ที่ระบบส่งออกหลังตัดสินใจแล้ว'],
            'Environment คือสิ่งภายนอกที่เปลี่ยนแปลงได้และมีผลต่อการตัดสินใจของ agent');
        case 'Why PEAS':
          return set(card,
            'ก่อนนำ '+name+' ไปใช้จริง การทำ PEAS ให้ประโยชน์สำคัญที่สุดข้อใด?',
            'ทำให้เกณฑ์สำเร็จ โลก ข้อมูลรับเข้า และ action ที่ทำได้ชัดเจนก่อนสร้างระบบ',
            ['เลือก algorithm ที่แม่นยำสุดก่อน แล้วค่อยกำหนดผลกระทบ','กำหนดหน้าจอและสีของแอปก่อนแล้วค่อยเลือก sensor','ทำ prototype จากข้อมูลที่มี แล้วเพิ่มเกณฑ์หลังใช้งาน'],
            'PEAS เป็นกรอบเพื่อทำความต้องการและความเสี่ยงให้ตรวจสอบได้ตั้งแต่ก่อนพัฒนา');
        case 'Trade-off':
          return set(card,
            'เมื่อ '+name+' ต้องเลือกระหว่างความเร็ว ความแม่นยำ และความปลอดภัย แนวออกแบบใดรับผิดชอบที่สุด?',
            'ตั้ง safety constraint และตัวชี้วัดหลายมิติก่อน optimize ความเร็วหรือปริมาณงาน',
            ['ใช้คะแนนรวมก้อนเดียวที่ความเร็วมีน้ำหนักสูงสุด','แยก dashboard คุณภาพและ safety แต่ไม่ตั้งเงื่อนไขหยุด','ใช้ค่าเฉลี่ยทั้งวันเพื่อลดความสำคัญของกรณีผิดพลาดรายบุคคล'],
            'การจัดการ trade-off ต้องมีข้อจำกัดด้านความปลอดภัยที่ไม่ถูกกลบด้วยคะแนนความเร็ว');
        case 'Rationality':
          return set(card,
            'ข้อใดอธิบาย rationality ของ '+name+' ได้แม่นยำที่สุด?',
            'เลือก action ที่เหมาะกับ percept เป้าหมาย และความเสี่ยง ณ ขณะนั้น',
            ['เลือก label ที่ความน่าจะเป็นสูงสุดแม้ action กระทบผู้ใช้','ใช้ action ที่เคยได้คะแนนดีสุดจากข้อมูลเก่า','ทำ action ที่ใช้ทรัพยากรน้อยสุดโดยไม่ตรวจเป้าหมาย'],
            'Rationality ไม่ได้แปลว่าถูกเสมอ แต่หมายถึงเลือกได้เหมาะสมจากข้อมูลและวัตถุประสงค์ที่มี');
        case 'Audit trail':
          return set(card,
            'Audit trail ของ '+name+' ควรบันทึกแบบใดจึงตรวจสอบได้โดยไม่เก็บข้อมูลเกินจำเป็น?',
            'เก็บคุณภาพข้อมูล เหตุผล action และการ override เฉพาะที่จำเป็นต่อการตรวจสอบ',
            ['เก็บ raw data ทุกอย่างตลอดเวลาเพราะอาจมีประโยชน์ภายหลัง','เก็บเฉพาะผลลัพธ์สุดท้ายเพื่อให้ง่ายต่อการรายงาน','เก็บสถิติรวมรายวันโดยไม่ผูกกับเหตุการณ์ตัดสินใจ'],
            'Audit trail ที่ดีต้องเชื่อม input–reason–action–override และคำนึงถึง data minimization');
        case 'Human override':
          return set(card,
            'เมื่อใดควรเปิดให้มนุษย์ override '+name+'?',
            'เมื่อความเสี่ยงหรือผลกระทบสูง ข้อมูลไม่แน่ใจ หรือการตัดสินใจอยู่นอกขอบเขตที่อนุมัติ',
            ['เมื่อระบบทำงานช้ากว่าค่าเฉลี่ย แม้ผลกระทบต่ำ','เมื่อคะแนนสะสมของผู้ใช้ลดลงจากรอบก่อน','เมื่อโมเดลสำรองให้ผลเหมือนกันแต่ยังไม่มีผลกระทบ'],
            'Override ควรผูกกับ risk trigger และขอบเขตอำนาจ ไม่ใช่เกิดจากตัวเลขที่ไม่เกี่ยวกับผลกระทบ');
        case 'Scope boundary':
          return set(card,
            'หาก '+name+' พบเคสที่อยู่นอกขอบเขตการออกแบบ การตอบสนองใดเหมาะสมที่สุด?',
            'ระบุข้อจำกัด เก็บข้อมูลที่จำเป็นเพิ่ม หรือส่งต่อผู้รับผิดชอบตามระดับความเสี่ยง',
            ['ขยายคำตอบให้ครอบคลุมทุกกรณีเพื่อไม่ให้ผู้ใช้รอนาน','ใช้คำตอบจากเคสคล้ายที่สุดแม้เงื่อนไขต่างกันมาก','เรียนรู้จากผลรอบนี้ทันทีและนำไปใช้โดยไม่ทดสอบ'],
            'การกำหนด scope boundary ช่วยป้องกันการใช้ระบบเกินความสามารถและสร้างทางส่งต่อที่ปลอดภัย');
        case 'Agent test':
          return set(card,
            'แผนทดสอบใดทำให้ '+name+' พร้อมใช้กับสถานการณ์จริงมากที่สุด?',
            'ทดสอบกรณีปกติ ข้อมูลขัดแย้ง/ขาดหาย edge case และการ recover หรือ override',
            ['ทดสอบเฉพาะชุดข้อมูลที่สะอาดซึ่งโมเดลทำคะแนนสูง','ทดสอบภายใต้ค่าเฉลี่ยเพียงรอบเดียวเพื่อประหยัดเวลา','เปิดใช้จริงก่อนแล้วใช้ complaint เป็นข้อมูลทดสอบ'],
            'การทดสอบ agent ต้องครอบคลุมความล้มเหลวที่คาดได้ การหยุดอย่างปลอดภัย และการกำกับโดยมนุษย์');
        case 'Case Twist: low confidence':
          return set(card,
            '⚡ '+name+' มี confidence ต่ำขณะ '+risk+' Policy ใดรับผิดชอบที่สุด?',
            'จำกัด action แจ้งระดับความไม่แน่ใจ และส่งต่อเมื่อเกิน risk threshold ที่กำหนด',
            ['ทำงานต่อในโหมดลดความเร็วแล้วตรวจ log หลังจบงาน','ขอข้อมูลเพิ่มหนึ่งครั้งแล้วตัดสินอัตโนมัติตามคะแนนใหม่','ปฏิเสธทุกเคสที่ไม่แน่ใจโดยไม่เสนอช่องทางช่วยเหลือ'],
            'Low confidence ไม่ได้แปลว่าต้องหยุดทุกกรณี แต่ต้องใช้ risk-aware fallback และ escalation ที่เหมาะสม');
        case 'Case Twist: user rights':
          return set(card,
            '⚡ ผู้ใช้โต้แย้งผลของ '+name+' และขอเหตุผล ระบบควรตอบสนองอย่างไร?',
            'อธิบายปัจจัยที่ใช้ ข้อจำกัด และช่องทางทบทวนหรืออุทธรณ์ที่ผู้รับผิดชอบเข้าถึงได้',
            ['แสดง confidence score เพียงตัวเดียวเพื่อให้เข้าใจง่าย','ให้คำอธิบายทั่วไปแต่ไม่เปิดทางทบทวนรายกรณี','แจ้งว่าจะปรับโมเดลในอนาคตโดยไม่ตรวจผลครั้งนี้'],
            'การคุ้มครองสิทธิ์ผู้ใช้ต้องมี explanation ที่พอใช้ได้จริงและช่องทางเยียวยา ไม่ใช่แค่ข้อความโปร่งใสทั่วไป');
        case 'Case Twist: changed context':
          return set(card,
            '⚡ สภาพแวดล้อมของ '+name+' เปลี่ยนจากตอนออกแบบอย่างมีนัยสำคัญ แนวทางใดเหมาะที่สุด?',
            'ประเมินผลใหม่ ตรวจ drift และปรับกฎความปลอดภัยก่อนขยายการใช้งานในบริบทใหม่',
            ['ใช้ threshold เดิมต่อไปเพราะโมเดลเคยผ่านการทดสอบแล้ว','เพิ่มข้อมูลใหม่เข้าไปทันทีแล้วปล่อยระบบเรียนรู้เอง','ลดการเก็บ log เพื่อไม่ให้ผลลัพธ์ใหม่ดูแย่กว่ารอบก่อน'],
            'เมื่อ environment เปลี่ยน ต้องตรวจ generalization, model drift และความเหมาะสมของ safety policy ใหม่');
        case 'Case Twist: conflicting goals':
          return set(card,
            '⚡ '+name+' ต้องเลือกระหว่างเวลาตอบสนองกับความปลอดภัยต่อผู้ใช้ การกำหนด policy ใดเหมาะที่สุด?',
            'กำหนดความปลอดภัยเป็น hard constraint แล้ว optimize ความเร็วภายในขอบเขตที่อนุญาต',
            ['รวมทุกอย่างเป็นคะแนนเดียวและให้ความเร็วมีน้ำหนักสูงสุด','สลับให้ความเร็วหรือความปลอดภัยชนะตามช่วงเวลาที่หนาแน่น','ย้ายผลกระทบไปให้ผู้ใช้ยืนยันเองทุกครั้งเพื่อรักษา throughput'],
            'เมื่อมีผลกระทบสูง ความปลอดภัยไม่ควรถูกลดเป็นเพียงคะแนนรองที่แพ้ความเร็วได้ง่าย');
        default:
          return card;
      }
    }

    api.buildDeck=function(){
      const deck=originalBuild();
      deck.cards=(deck.cards||[]).map(card=>{
        const ctx=contextFor(card.context);
        if(card.subtype==='map')return hardMap(card,ctx);
        return hardChoice(card,ctx);
      });
      deck.challengeMode='v676 • plausible trade-offs';
      return deck;
    };
    return true;
  }
  hardenS2Deck();

  const repair=()=>{
    const node=document.getElementById('feedback');
    if(!node||!node.classList.contains('show'))return false;
    const raw=String(node.textContent||'');
    const start=raw.indexOf('<ul class="answerList">');
    const end=raw.indexOf('</ul>',start);
    if(start<0||end<0)return false;
    const originalTitle=String(node.querySelector('b')?.textContent||'✅ Agent Decision ถูกต้อง').trim();
    const before=raw.slice(0,start).trim();
    const intro=before.indexOf(originalTitle)===0?before.slice(originalTitle.length).trim():before;
    const list=raw.slice(start,end+5);
    const after=raw.slice(end+5).trim();
    const parser=document.createElement('div');parser.innerHTML=list;
    const items=[...parser.querySelectorAll('li')].map(item=>item.textContent.trim()).filter(Boolean);
    if(!items.length)return false;
    node.innerHTML='<div style="font-weight:900;font-size:17px;margin-bottom:8px">'+esc(originalTitle)+'</div><div style="margin-bottom:8px">'+esc(intro)+'</div><ul class="answerList" style="margin:7px 0 9px;padding-left:21px;display:grid;gap:5px">'+items.map(item=>'<li>'+esc(item)+'</li>').join('')+'</ul><div style="opacity:.96">'+esc(after)+'</div>';
    return true;
  };
  function observe(){
    let queued=false;
    const queue=()=>{if(queued)return;queued=true;setTimeout(()=>{queued=false;repair();hardenS2Deck()},0)};
    new MutationObserver(queue).observe(document.body,{childList:true,subtree:true,characterData:true});
    document.addEventListener('click',event=>{if(event.target&&event.target.closest&&event.target.closest('#checkMap'))setTimeout(repair,0);},false);
    setInterval(()=>{repair();hardenS2Deck()},300);
    repair();hardenS2Deck();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe,{once:true});else observe();
})();