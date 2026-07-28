/* CSAI2601 UX Quest • Canonical Content Enrichment W1–W6 v1
 * Front-end/content phase only. No Apps Script and no Sheet mutation.
 * Adds a consistent academic structure for Mission → Reason Check → Studio/Artifact → Reflection → Summary.
 */
(() => {
  'use strict';

  const pack = window.CSAI2601_UXQ_CANONICAL_CONTENT_V1;
  if (!pack || !Array.isArray(pack.nodes)) return;

  const enhancements = {
    W1: {
      objective:'วิเคราะห์ปัญหาประสบการณ์ผู้ใช้จากหลักฐานจริง แยก UI, UX และ front-end feedback และเสนอสมมติฐานการแก้ที่ตรวจสอบได้',
      keyQuestion:'ผู้ใช้ทำงานหลักไม่สำเร็จเพราะสิ่งที่เห็น สิ่งที่เข้าใจ หรือสิ่งที่ระบบตอบสนอง?',
      evidenceChain:['หลักฐานหน้าจอหรือพฤติกรรม','User goal และ task','Friction ที่สังเกตได้','ผลกระทบต่อการทำงาน','Fix hypothesis','วิธีทดสอบ'],
      studioTitle:'UX Audit + Project Brief',
      studioInstructions:[
        'เลือกบริการดิจิทัลจริงหนึ่งระบบและกำหนดงานหลักหนึ่งงาน',
        'บันทึกหลักฐานหน้าจออย่างน้อย 3 จุดโดยไม่ใช้ความรู้สึกส่วนตัวแทนหลักฐาน',
        'ระบุ target user, user goal, task และ context ให้ชัด',
        'จำแนกปัญหาเป็น UI, UX หรือ front-end feedback พร้อมเหตุผล',
        'เสนอแนวทางแก้และตัวชี้วัดที่จะใช้พิสูจน์ผล'
      ],
      submissionChecklist:['Project ID','Figma/Project URL','Evidence URL','หลักฐานอย่างน้อย 3 จุด','User goal + task + context','Friction + impact','Fix + test metric'],
      reflectionPrompts:['หลักฐานใดเปลี่ยนความเข้าใจปัญหาของคุณมากที่สุด','เหตุใดสิ่งที่ดูไม่สวยอาจไม่ใช่ปัญหาหลัก','คุณจะรู้ได้อย่างไรว่าการแก้ช่วยผู้ใช้จริง'],
      misconceptions:['UI สวยเท่ากับ UX ดี','จุดที่ทีมไม่ชอบคือปัญหาหลัก','แก้สีหรือ layout แล้ว task จะสำเร็จเอง'],
      successCriteria:['อ้างอิงหลักฐาน ไม่ใช่ความรู้สึก','เชื่อม user goal → friction → impact','แยก UI/UX/front-end feedback ถูกต้อง','แนวทางแก้มีวิธีพิสูจน์'],
      summary:'ผู้เรียนสร้างฐานโครงการจากปัญหาจริงและกำหนดวิธีตรวจสอบผล ไม่เริ่มออกแบบจากความชอบส่วนตัว'
    },
    W2: {
      objective:'ออกแบบแผนวิจัยผู้ใช้ที่ตอบคำถามได้จริง เก็บข้อมูลอย่างมีจริยธรรม และสังเคราะห์ persona/empathy map จากหลักฐาน',
      keyQuestion:'เราต้องเรียนรู้อะไรจากใคร ด้วยวิธีใด จึงลดความเสี่ยงของการออกแบบจากสมมติฐาน?',
      evidenceChain:['Research objective','Participant criteria','Method fit','Ethics/privacy','Raw evidence','Pattern/insight','Persona/empathy map'],
      studioTitle:'Research Plan + Persona + Empathy Map',
      studioInstructions:[
        'ตั้ง research objective ที่เชื่อมกับปัญหา W1',
        'กำหนดผู้เข้าร่วมและเหตุผลในการคัดเลือกอย่างน้อย 2 กลุ่ม',
        'เลือก interview, observation หรือ survey ให้ตรงชนิดคำถาม',
        'เขียนคำถามที่ไม่ชี้นำและระบุ consent/privacy',
        'สังเคราะห์หลักฐานเป็น pattern, insight, persona และ empathy map โดยไม่แต่งข้อมูล'
      ],
      submissionChecklist:['Research objective','Participant criteria','Method rationale','Ethics/privacy statement','คำถามวิจัยอย่างน้อย 6 ข้อ','Evidence notes','Persona','Empathy map','Assumption log'],
      reflectionPrompts:['สมมติฐานใดถูกหลักฐานหักล้าง','ข้อมูลใดยังไม่เพียงพอที่จะสรุป','การคุ้มครองผู้เข้าร่วมส่งผลต่อแผนวิจัยอย่างไร'],
      misconceptions:['ถามเพื่อนหนึ่งคนแล้วแทนผู้ใช้ทั้งหมดได้','persona สร้างจากจินตนาการได้','คำถามที่บอกคำตอบช่วยประหยัดเวลา'],
      successCriteria:['วิธีวิจัยตรงกับคำถาม','คำถามไม่ชี้นำ','persona อ้างอิงหลักฐาน','ระบุข้อจำกัดและจริยธรรมชัดเจน'],
      summary:'ผู้เรียนเปลี่ยนจาก opinion-driven design เป็น evidence-driven design และรักษาขอบเขตของสิ่งที่ข้อมูลรองรับ'
    },
    W3: {
      objective:'วิเคราะห์ภาระทางความคิดและออกแบบ task flow กับ low-fidelity wireframe ที่ลดการจำ ลดความสับสน และป้องกันข้อผิดพลาด',
      keyQuestion:'ระบบกำลังบังคับให้ผู้ใช้จำ คาดเดา หรือแก้ข้อผิดพลาดช้าเกินไปตรงไหน?',
      evidenceChain:['Current task flow','Observed cognitive friction','Psychology principle','Revised flow','Before/after wireframe','Validation rationale'],
      studioTitle:'Cognitive UX Analysis + Task Flow + Before–After Low-fi',
      studioInstructions:[
        'เขียน current task flow ของงานหลักจาก W1',
        'ทำเครื่องหมายจุดที่เกิด cognitive load, recall burden, weak feedback หรือ error risk',
        'เลือกหลัก recognition over recall, attention, mental model, affordance, feedback หรือ error prevention',
        'ออกแบบ revised task flow ที่รวม happy, error และ recovery path',
        'สร้าง before–after low-fi wireframe และอธิบายการลดภาระทีละจุด'
      ],
      submissionChecklist:['Current flow','Cognitive friction map','หลักจิตวิทยาที่ใช้','Revised flow','Error/recovery path','Before wireframe','After wireframe','Validation task'],
      reflectionPrompts:['จุดใดลดการจำของผู้ใช้ได้มากที่สุด','feedback ควรเกิดเมื่อใดจึงป้องกันความผิดพลาด','การเปลี่ยน flow ส่งผลต่อ user goal อย่างไร'],
      misconceptions:['ลดจำนวนหน้าจอเท่ากับลด cognitive load เสมอ','ผู้ใช้ควรจำกฎของระบบ','แสดง error หลัง submit อย่างเดียวเพียงพอ'],
      successCriteria:['วิเคราะห์ friction เชื่อมหลักจิตวิทยา','flow มี error/recovery path','wireframe แสดง before–after ชัด','เหตุผลเชื่อมกับ task outcome'],
      summary:'ผู้เรียนใช้จิตวิทยาการรับรู้เป็นเหตุผลเชิงออกแบบ ไม่ใช่เพียงจัดหน้าจอให้ดูง่าย'
    },
    W4: {
      objective:'สังเคราะห์หลักฐานวิจัยเป็น insight, root cause, problem statement และ HMW ที่ไม่กีดกันผู้ใช้กลุ่มต่าง ๆ',
      keyQuestion:'ปัญหาใดมีหลักฐานรองรับ อยู่ในขอบเขตที่ออกแบบได้ และไม่ทำให้ผู้ใช้บางกลุ่มหายไปจากการตัดสินใจ?',
      evidenceChain:['Evidence clusters','Pattern','Insight','Root cause','Problem statement','HMW','Inclusion/bias check'],
      studioTitle:'Insight Map + Problem Statement + HMW + Inclusion Check',
      studioInstructions:[
        'จัดกลุ่มหลักฐาน W2 ด้วย affinity mapping',
        'แยก observation, pattern, insight และ assumption',
        'วิเคราะห์ root cause โดยไม่สรุปจากอาการบนหน้าจอเท่านั้น',
        'เขียน problem statement ที่มี user, need, context และ evidence',
        'สร้าง HMW หลายทางเลือกและตรวจ excluded users, accessibility needs และ bias'
      ],
      submissionChecklist:['Affinity clusters','อย่างน้อย 3 insights','Root-cause chain','Problem statement','HMW อย่างน้อย 3 ข้อ','Excluded-user check','Bias/accessibility note'],
      reflectionPrompts:['insight ใดมีหลักฐานแข็งแรงที่สุด','ใครอาจเสียประโยชน์จากกรอบปัญหานี้','HMW ข้อใดเปิดพื้นที่ให้คิดแต่ยังไม่กว้างเกินไป'],
      misconceptions:['สิ่งที่ผู้ใช้ขอคือ root cause เสมอ','HMW ต้องระบุ solution ไว้แล้ว','กลุ่มผู้ใช้ส่วนใหญ่เพียงพอโดยไม่ต้องตรวจ exclusion'],
      successCriteria:['insight trace กลับสู่หลักฐานได้','problem statement ไม่ฝัง solution','HMW เปิดทางเลือก','ระบุ inclusion และ bias risk'],
      summary:'ผู้เรียนเปลี่ยนข้อมูลดิบเป็นกรอบปัญหาที่รับผิดชอบและพร้อมเข้าสู่การสร้างแนวคิด'
    },
    W5: {
      objective:'สร้างทางเลือกการออกแบบหลายแบบ คัดเลือกด้วยเกณฑ์ และใช้ AI โดยบันทึก contribution, risk และการตัดสินใจของมนุษย์',
      keyQuestion:'แนวคิดที่เลือกตอบหลักฐานผู้ใช้และข้อจำกัดจริง หรือเพียงเป็นคำตอบที่ AI/ทีมชอบ?',
      evidenceChain:['HMW','Idea alternatives','Selection criteria','Concept scoring','AI contribution','Risk verification','Human decision'],
      studioTitle:'Concept Matrix + Storyboard + AI Contribution Record',
      studioInstructions:[
        'สร้างแนวคิดอย่างน้อย 3 ทางเลือกจาก HMW โดยไม่รีบเลือกคำตอบแรก',
        'กำหนดเกณฑ์ desirability, feasibility, viability, inclusion และ evidence fit',
        'ใช้ concept matrix เพื่อเปรียบเทียบ ไม่ใช้การโหวตจากความชอบอย่างเดียว',
        'หากใช้ AI ให้บันทึก tool, prompt purpose, output used/not used และสิ่งที่ตรวจสอบ',
        'สร้าง storyboard ของแนวคิดที่เลือกและระบุ human final decision'
      ],
      submissionChecklist:['แนวคิดอย่างน้อย 3 แบบ','Selection criteria','Concept matrix','Storyboard','AI contribution record','Bias/privacy/copyright check','Human decision rationale'],
      reflectionPrompts:['AI เพิ่มทางเลือกหรือทำให้ความคิดแคบลงอย่างไร','ข้อเสนอใดถูกปฏิเสธเพราะไม่ตรงหลักฐาน','เหตุใดแนวคิดที่คะแนนสูงสุดจึงอาจยังไม่ใช่คำตอบสุดท้าย'],
      misconceptions:['AI output คือ evidence','แนวคิดใหม่ที่สุดดีที่สุด','คะแนนรวมสูงสุดยกเลิกการตัดสินเชิงจริยธรรมได้'],
      successCriteria:['มีความหลากหลายของแนวคิด','เกณฑ์เชื่อมผู้ใช้และข้อจำกัด','บันทึก AI โปร่งใส','มนุษย์อธิบาย final decision ได้'],
      summary:'ผู้เรียนใช้ AI เป็นเครื่องมือขยายทางเลือก ไม่ใช่ผู้ตัดสินแทน และคัดเลือกแนวคิดด้วยหลักฐานกับความรับผิดชอบ'
    },
    W6: {
      objective:'จัดโครงสร้างเนื้อหาและ navigation ตาม mental model พร้อมทดสอบ labeling และ findability ก่อนออกแบบหน้าจอรายละเอียด',
      keyQuestion:'ผู้ใช้มองหาข้อมูลและงานหลักด้วยคำและโครงสร้างแบบใด ไม่ใช่โครงสร้างภายในขององค์กร?',
      evidenceChain:['Content inventory','User language','Grouping rationale','Sitemap','Navigation labels','Search/filter strategy','Tree-test plan'],
      studioTitle:'Content Inventory + Sitemap + Navigation Test',
      studioInstructions:[
        'ทำ content inventory ของข้อมูลและฟังก์ชันที่เกี่ยวกับงานหลัก',
        'ระบุ duplicate, obsolete, unclear และ missing content',
        'จัดกลุ่มตาม mental model จากหลักฐานหรือ card sorting',
        'สร้าง sitemap และ navigation labels ที่ใช้ภาษาผู้ใช้',
        'กำหนด tree-test tasks และเกณฑ์ findability'
      ],
      submissionChecklist:['Content inventory','Content status','Grouping rationale','Sitemap','Primary/secondary navigation','Label rationale','Search/filter note','Tree-test tasks + success criteria'],
      reflectionPrompts:['label ใดสะท้อนภาษาองค์กรแทนภาษาผู้ใช้','การรวม/แยกเมนูเปลี่ยน findability อย่างไร','ข้อมูลใดไม่ควรอยู่ใน navigation หลัก'],
      misconceptions:['โครงสร้างฝ่ายงานคือ IA ที่ดีที่สุด','เมนูมากทำให้ผู้ใช้มีทางเลือกมากขึ้นจึงดีกว่า','ชื่อที่ทีมเข้าใจย่อมชัดกับผู้ใช้'],
      successCriteria:['inventory ครบและจัดสถานะ','โครงสร้างมี rationale','labels ตรง mental model','มีแผนทดสอบ findability ที่วัดได้'],
      summary:'ผู้เรียนสร้างโครงสร้างก่อนตกแต่งหน้าจอ เพื่อให้ผู้ใช้หาและเข้าใจสิ่งที่ต้องการได้ตามแบบจำลองความคิดของตน'
    }
  };

  Object.keys(enhancements).forEach(id => {
    const node = pack.nodes.find(item => String(item.id).toUpperCase() === id);
    if (!node) return;
    Object.assign(node, enhancements[id], {
      contentStatus:'complete',
      contentRevision:'w1-w6-enrichment-v1-20260728',
      requiredFlow:['Mission','Reason Check','Studio/Artifact','Weekly Reflection','Summary'],
      retryPolicy:'เล่น Mission ซ้ำได้ด้วย case variant ใหม่ โดยเก็บ best score และตรวจ reasoning ทุกครั้ง'
    });
  });

  window.CSAI2601_UXQ_CONTENT_ENRICHMENT_W1_W6_V1 = Object.freeze({
    version:'20260728-W1-W6-COMPLETE',
    nodeIds:Object.keys(enhancements),
    requiredFields:['objective','keyQuestion','evidenceChain','studioInstructions','submissionChecklist','reflectionPrompts','misconceptions','successCriteria','summary']
  });
})();