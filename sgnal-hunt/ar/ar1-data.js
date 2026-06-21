window.AR1_DATA={
  title:'Signal Hunt: Cognitive Friction Emergency',
  stationCodes:{'UXQ-AR1-A':'A','UXQ-AR1-B':'B','UXQ-AR1-C':'C','UXQ-AR1-D':'D'},
  modifiers:[
    {id:'first-year',title:'นักศึกษาปี 1',note:'ยังไม่คุ้นศัพท์ในระบบและกำลังรีบทำงานบนมือถือ'},
    {id:'staff',title:'เจ้าหน้าที่ใหม่',note:'ต้องจัดการข้อมูลจำนวนมาก และกังวลว่าจะทำรายการผิด'},
    {id:'privacy',title:'ผู้ใช้กังวลข้อมูลส่วนตัว',note:'ต้องการเห็นสถานะและผลของทุกการกระทำอย่างชัดเจน'},
    {id:'slow-net',title:'ผู้ใช้เน็ตช้า',note:'ตีความหน้าจอเงียบว่าเป็นระบบค้างได้ง่าย'}
  ],
  stations:{
    A:{
      title:'Noise Flood',subtitle:'Information Overload',
      evidence:'Help Center มีเมนู 15 รายการ, banner กระพริบ 3 จุด, คำอธิบายยาว และ CTA หลักถูกกลืนอยู่ในข้อมูลรอง',
      quote:'“ฉันไม่รู้ว่าต้องเริ่มตรงไหน ทุกอย่างดูสำคัญไปหมด”',
      prompt:'เลือก 3 การแก้ที่ลดภาระทางความคิดได้มากที่สุด',
      type:'multi',limit:3,
      choices:[
        {id:'group',text:'รวมเมนูที่คล้ายกันเป็นหมวดและใช้ชื่อที่บอกงานชัดเจน',correct:true},
        {id:'priority',text:'ย้ายงานหลักและ CTA ไปไว้ในตำแหน่งที่เห็นก่อน',correct:true},
        {id:'disclose',text:'ซ่อนข้อมูลรองใน “ดูเพิ่มเติม” และแสดงเฉพาะสิ่งจำเป็นก่อน',correct:true},
        {id:'more',text:'เพิ่ม banner แจ้งข่าวอีก 2 จุดให้ผู้ใช้เห็นข้อมูลครบขึ้น',correct:false},
        {id:'motion',text:'ทำ banner ให้กระพริบเร็วขึ้นเพื่อดึงความสนใจ',correct:false},
        {id:'dense',text:'ลดพื้นที่ว่างเพื่อใส่เมนูได้มากขึ้น',correct:false}
      ],
      learning:'Attention • Cognitive Load • Visual Hierarchy'
    },
    B:{
      title:'Action Ambiguity',subtitle:'Lost CTA',
      evidence:'ปุ่มส่งคำร้องใช้คำว่า “ดำเนินการ” สีจาง อยู่ไกลจากฟอร์ม และปุ่มยกเลิกเด่นพอ ๆ กัน',
      quote:'“ฉันไม่แน่ใจว่าปุ่มนี้ส่งจริง หรือแค่บันทึกไว้ก่อน”',
      prompt:'สร้าง CTA ที่ผู้ใช้คาดเดาผลลัพธ์ได้',
      type:'multi',limit:3,
      choices:[
        {id:'label',text:'ใช้ label ว่า “ส่งคำร้อง” ให้บอกผลของการกดโดยตรง',correct:true},
        {id:'near',text:'วาง CTA ใกล้ฟอร์มหลังผู้ใช้กรอกข้อมูลเสร็จ',correct:true},
        {id:'primary',text:'ทำให้ปุ่มหลักเด่นกว่าปุ่มรองและลดน้ำหนักปุ่มยกเลิก',correct:true},
        {id:'generic',text:'คงคำว่า “ดำเนินการ” เพราะใช้กับทุกฟอร์มได้',correct:false},
        {id:'far',text:'ย้ายปุ่มไปท้ายหน้าเพื่อให้ผู้ใช้คิดนานขึ้น',correct:false},
        {id:'equal',text:'ทำทุกปุ่มให้ขนาด สี และน้ำหนักเท่ากันเพื่อความยุติธรรม',correct:false}
      ],
      learning:'Affordance • Proximity • Action Clarity'
    },
    C:{
      title:'Silent System',subtitle:'Feedback Blackout',
      evidence:'หลังผู้ใช้กดส่ง ระบบเงียบ ไม่มี loading, ไม่มี confirmation, ไม่มีเลขอ้างอิง และไม่บอก next step',
      quote:'“ฉันกดไปแล้วหรือยัง? ถ้ากดซ้ำจะส่งซ้ำไหม?”',
      prompt:'เลือก 3 ส่วนของ Feedback Chain ที่ช่วยให้ผู้ใช้รู้สถานะระบบ',
      type:'multi',limit:3,
      choices:[
        {id:'loading',text:'แสดง loading state ขณะระบบกำลังประมวลผล',correct:true},
        {id:'confirm',text:'ยืนยันความสำเร็จพร้อมเลขอ้างอิงหรือสถานะติดตาม',correct:true},
        {id:'error',text:'เมื่อผิดพลาดให้บอกสาเหตุที่แก้ได้และมีทางลองใหม่',correct:true},
        {id:'silence',text:'คงหน้าเดิมไว้ เพราะผู้ใช้น่าจะเข้าใจเอง',correct:false},
        {id:'reload',text:'รีเฟรชหน้าโดยไม่บอกเหตุผลเพื่อให้รู้ว่าระบบยังทำงาน',correct:false},
        {id:'technical',text:'แสดง error code ยาว ๆ เพื่อให้ข้อมูลครบที่สุด',correct:false}
      ],
      learning:'Feedback • System Status • Emotion'
    },
    D:{
      title:'Mental Model Trap',subtitle:'Meaning Repair',
      evidence:'ไอคอนถังขยะถูกใช้แทน “เก็บไว้ภายหลัง” และปุ่ม “ยืนยัน” กลับลบรายการถาวรโดยไม่มีการแจ้งเตือน',
      quote:'“ฉันไม่กล้ากด เพราะกลัวข้อมูลหาย”',
      prompt:'เลือก 3 การแก้ที่ทำให้ความหมายและผลของการกระทำชัดเจน',
      type:'multi',limit:3,
      choices:[
        {id:'icon',text:'เปลี่ยน icon ให้สัมพันธ์กับความหมายที่ผู้ใช้คุ้นเคย',correct:true},
        {id:'label',text:'ใช้ label ที่ระบุผลชัด เช่น “ลบรายการถาวร”',correct:true},
        {id:'undo',text:'เพิ่ม confirmation หรือ Undo สำหรับการกระทำที่ย้อนกลับยาก',correct:true},
        {id:'surprise',text:'ซ่อนผลลัพธ์ไว้หลังการกดเพื่อให้หน้าจอดูสะอาด',correct:false},
        {id:'ambiguous',text:'คงคำว่า “ยืนยัน” เพื่อให้ใช้ได้กับทุก action',correct:false},
        {id:'remove',text:'ลบข้อความกำกับออกให้เหลือ icon อย่างเดียว',correct:false}
      ],
      learning:'Mental Model • Label • Error Recovery'
    }
  },
  priorities:[
    {id:'pA',station:'A',title:'ลดเมนูซ้ำซ้อนและจัดกลุ่มข้อมูล',cost:25,impact:'สูง',correct:true,detail:'ลดภาระทางความคิดและทำให้ผู้ใช้เริ่มงานได้เร็วขึ้น'},
    {id:'pB',station:'B',title:'ทำ CTA และ label ของการส่งคำร้องให้ชัด',cost:20,impact:'สูง',correct:true,detail:'ลดความลังเลและป้องกันการกดผิด action'},
    {id:'pC',station:'C',title:'สร้าง Feedback Chain พร้อมเลขอ้างอิง',cost:30,impact:'วิกฤต',correct:true,detail:'ลดการส่งซ้ำและเพิ่มความมั่นใจในระบบ'},
    {id:'pD',station:'D',title:'ซ่อม icon, label และเพิ่ม Undo/Confirmation',cost:20,impact:'กลาง–สูง',correct:true,detail:'ลดความกลัวและความผิดพลาดที่แก้กลับยาก'},
    {id:'pE',station:'X',title:'เพิ่ม animation กระพริบเพื่อให้หน้าเว็บดูทันสมัย',cost:15,impact:'ต่ำ',correct:false,detail:'ไม่แก้ friction หลักและอาจเพิ่มสิ่งรบกวน'}
  ],
  explain:[
    {q:'ปัญหาใดควรแก้ก่อนในสถานการณ์นี้?',options:['เพิ่ม animation ให้หน้าจอดูใหม่','Feedback ที่หายหลังส่งข้อมูล','เพิ่มจำนวนเมนูให้ครบทุกบริการ','เปลี่ยนพื้นหลังให้มีสีมากขึ้น'],correct:1},
    {q:'เหตุใด CTA ที่ชัดและอยู่ใกล้ฟอร์มจึงช่วยผู้ใช้?',options:['ทำให้หน้าเว็บดูสมมาตร','ลดความกำกวมและบอก action ถัดไปขณะผู้ใช้พร้อมทำงาน','ทำให้ใช้สีได้มากขึ้น','ทำให้ผู้ใช้ใช้เวลาตัดสินใจนานขึ้น'],correct:1},
    {q:'การเพิ่ม Undo หรือ Confirmation ช่วยเรื่องใดมากที่สุด?',options:['ทำให้ผู้ใช้กดได้เร็วขึ้นเสมอ','ลดความเสี่ยงจากการกระทำที่ผลลัพธ์ร้ายแรงหรือย้อนกลับยาก','ลดจำนวนข้อความบนหน้าจอ','ทำให้ icon ไม่จำเป็น'],correct:1}
  ]
};
