/* =========================================================
   EAP Word Quest • Academic Vocabulary Mission
   File: /herohealth/eap-word-quest/eap-word-data.js
   Version: v1.5.1-STUDENT-HOME-SIMPLIFY

   Consolidated Final Data File
   - S1–S15 = 20 words/session
   - BG1–BG5 = Boss Gate separated from sessions
   - Auto-generate 8 item types per word
   - Total target ≈ 300 words × 8 = 2400 items
========================================================= */

"use strict";

window.APP_VERSION = "v1.5.1-STUDENT-HOME-SIMPLIFY";

/* =========================================================
   Course Map
========================================================= */

window.SESSIONS = [
  {
    id:"S1",
    title:"Academic Profile",
    desc:"major, background, skill, strength, interest, goal",
    status:"playable",
    boss:false
  },
  {
    id:"S2",
    title:"Project Introduction",
    desc:"project, objective, feature, user, problem, solution",
    status:"playable",
    boss:false
  },
  {
    id:"S3",
    title:"Project Rationale & Target Users",
    desc:"rationale, target users, need, benefit, scope",
    status:"playable",
    boss:false
  },
  {
    id:"BG1",
    title:"Boss Gate 1",
    desc:"Review Gate รวม S1–S3: Profile + Project Foundation",
    status:"boss",
    boss:true,
    gate:true
  },

  {
    id:"S4",
    title:"Tech Jobs / Careers",
    desc:"คำศัพท์อาชีพ IT, AI, Multimedia และบทบาทงาน",
    status:"playable",
    boss:false
  },
  {
    id:"S5",
    title:"Workplace Communication",
    desc:"request, clarify, update, confirm, explain",
    status:"playable",
    boss:false
  },
  {
    id:"S6",
    title:"Team Progress & Responsibility",
    desc:"progress, responsibility, timeline, contribution, teamwork",
    status:"playable",
    boss:false
  },
  {
    id:"BG2",
    title:"Boss Gate 2",
    desc:"Review Gate รวม S4–S6: Career + Workplace Communication",
    status:"boss",
    boss:true,
    gate:true
  },

  {
    id:"S7",
    title:"Professional Email",
    desc:"subject, attachment, deadline, inquiry, response",
    status:"playable",
    boss:false
  },
  {
    id:"S8",
    title:"Meeting / Discussion",
    desc:"agenda, opinion, suggest, decision, concern",
    status:"playable",
    boss:false
  },
  {
    id:"S9",
    title:"Discussion Summary & Action Items",
    desc:"summary, action item, follow-up, conclusion, agreement",
    status:"playable",
    boss:false
  },
  {
    id:"BG3",
    title:"Boss Gate 3",
    desc:"Review Gate รวม S7–S9: Email + Meeting + Summary",
    status:"boss",
    boss:true,
    gate:true
  },

  {
    id:"S10",
    title:"System Explanation",
    desc:"function, process, input, output, interface",
    status:"playable",
    boss:false
  },
  {
    id:"S11",
    title:"Bug Report / Problem Solving",
    desc:"issue, bug, reproduce, solution, update",
    status:"playable",
    boss:false
  },
  {
    id:"S12",
    title:"User Guide / Technical Instruction",
    desc:"instruction, requirement, step, configure, verify",
    status:"playable",
    boss:false
  },
  {
    id:"BG4",
    title:"Boss Gate 4",
    desc:"Review Gate รวม S10–S12: System + Bug + Technical Guide",
    status:"boss",
    boss:true,
    gate:true
  },

  {
    id:"S13",
    title:"AI Report / Academic Summary",
    desc:"dataset, model, accuracy, findings, limitation",
    status:"playable",
    boss:false
  },
  {
    id:"S14",
    title:"CV / Interview / Pitch",
    desc:"strength, qualification, achievement, propose, pitch",
    status:"playable",
    boss:false
  },
  {
    id:"S15",
    title:"Final Project Presentation & Reflection",
    desc:"presentation, reflection, contribution, evidence, future work",
    status:"playable",
    boss:false
  },
  {
    id:"BG5",
    title:"Final Boss Gate",
    desc:"Final Review Gate รวม Academic Vocabulary ทั้งคอร์ส",
    status:"boss",
    boss:true,
    gate:true
  }
];

/* =========================================================
   Vocabulary Specs
   Format per row:
   [word, thaiMeaning, partOfSpeech, collocation, trapChoices]
========================================================= */

(function buildVocabularySpecs(){
  const RAW = {
    S1:{
      theme:"Academic Profile",
      rows:[
        ["major","สาขาวิชา","noun","academic major",["majoring","majority","majored"]],
        ["background","พื้นฐานหรือประสบการณ์เดิม","noun","academic background",["backdrop","backgrounded","backward"]],
        ["skill set","ชุดทักษะ","noun phrase","technical skill set",["skillful set","set skill","skill setting"]],
        ["strength","จุดแข็ง","noun","personal strength",["strong","strengthen","straight"]],
        ["weakness","จุดที่ต้องพัฒนา","noun","learning weakness",["weak","weaken","weekly"]],
        ["interest","ความสนใจ","noun","academic interest",["interesting","interested","interestingly"]],
        ["goal","เป้าหมาย","noun","learning goal",["gold","goalie","goaled"]],
        ["confidence","ความมั่นใจ","noun","academic confidence",["confident","confidential","conference"]],
        ["experience","ประสบการณ์","noun","practical experience",["experienced","experiment","expertise"]],
        ["academic profile","ข้อมูลแนะนำตัวเชิงวิชาการ","noun phrase","academic profile",["academic profiling","profile academic","academy profile"]],
        ["learning style","รูปแบบการเรียนรู้","noun phrase","learning style",["learning stylish","style learning","learning still"]],
        ["academic goal","เป้าหมายทางวิชาการ","noun phrase","academic goal",["academic gold","goal academic","academy goal"]],
        ["communication skill","ทักษะการสื่อสาร","noun phrase","communication skill",["communicate skill","communication skilled","skill communication"]],
        ["technical skill","ทักษะเชิงเทคนิค","noun phrase","technical skill",["technique skill","technical skilled","skill technical"]],
        ["teamwork","การทำงานเป็นทีม","noun","teamwork skill",["team work only","teamworking","team worker"]],
        ["creativity","ความคิดสร้างสรรค์","noun","creative ability",["creative","creation","creatively"]],
        ["problem-solving","การแก้ปัญหา","noun phrase","problem-solving skill",["problem solved","solving problem","problem solver only"]],
        ["motivation","แรงจูงใจ","noun","learning motivation",["motivate","motivated","motive"]],
        ["academic writing","การเขียนเชิงวิชาการ","noun phrase","academic writing",["academic written","writing academic","academy writing"]],
        ["presentation skill","ทักษะการนำเสนอ","noun phrase","presentation skill",["present skill","presentation skilled","skill presentation"]]
      ]
    },

    S2:{
      theme:"Project Introduction",
      rows:[
        ["project","โครงการ","noun","project overview",["projected","projection","projecting"]],
        ["objective","วัตถุประสงค์","noun","project objective",["object","objection","objectivee"]],
        ["feature","คุณสมบัติหรือฟีเจอร์","noun","app feature",["future","featured","featuring"]],
        ["function","หน้าที่การทำงาน","noun","main function",["functional","functioning","fiction"]],
        ["user","ผู้ใช้","noun","target user",["using","usage","used"]],
        ["problem","ปัญหา","noun","learning problem",["problematic","probe","program"]],
        ["solution","แนวทางแก้ปัญหา","noun","learning solution",["solve","solving","soluble"]],
        ["prototype","ต้นแบบ","noun","project prototype",["protocol","type proto","prototypeing"]],
        ["user feedback","ความคิดเห็นจากผู้ใช้","noun phrase","collect user feedback",["user feed","feedback user","user feedbacked"]],
        ["requirement","ข้อกำหนดหรือสิ่งที่จำเป็น","noun","project requirement",["request","required","require"]],
        ["implementation","การนำไปพัฒนา/ใช้งานจริง","noun","project implementation",["implement","implemented","implication"]],
        ["usability","ความง่ายในการใช้งาน","noun","usability testing",["usable","useful","usage"]],
        ["interface","ส่วนติดต่อผู้ใช้","noun","user interface",["interact","interaction","internet face"]],
        ["target user","ผู้ใช้เป้าหมาย","noun phrase","target user",["target using","target used","target useful"]],
        ["learning app","แอปเพื่อการเรียนรู้","noun phrase","learning app",["learn app","learning applicationed","app learning"]],
        ["design concept","แนวคิดการออกแบบ","noun phrase","design concept",["concept design","design conceptual","design contact"]],
        ["project scope","ขอบเขตโครงการ","noun phrase","project scope",["project score","scope project","project scoped"]],
        ["expected outcome","ผลลัพธ์ที่คาดหวัง","noun phrase","expected outcome",["expected output only","outcome expected","expected income"]],
        ["benefit","ประโยชน์","noun","learning benefit",["beneficial","benefited","benefiting"]],
        ["evaluation","การประเมิน","noun","project evaluation",["evaluate","evaluated","evaluating"]]
      ]
    },

    S3:{
      theme:"Project Rationale & Target Users",
      rows:[
        ["rationale","เหตุผลหรือหลักการรองรับ","noun","project rationale",["rational","ratio","relation"]],
        ["target users","ผู้ใช้เป้าหมาย","noun phrase","target users",["target using","target used","target useful"]],
        ["user need","ความต้องการของผู้ใช้","noun phrase","user need",["user needy","user needed","user needing"]],
        ["scope","ขอบเขต","noun","project scope",["score","scoped","screen"]],
        ["benefit","ประโยชน์","noun","learning benefit",["beneficial","benefited","benefiting"]],
        ["challenge","ความท้าทาย","noun","learning challenge",["change","chance","channel"]],
        ["suitable for","เหมาะสำหรับ","phrase","suitable for mobile learning",["suit for","suitable to","suiting for"]],
        ["support","สนับสนุน","verb","support learning",["supporting","supported","supportive"]],
        ["learning need","ความจำเป็นหรือความต้องการด้านการเรียนรู้","noun phrase","learning need",["learning needed","learn need","learning needs only"]],
        ["project aim","เป้าหมายของโครงการ","noun phrase","project aim",["project aimed","project aiming","aim project"]],
        ["learning gap","ช่องว่างหรือปัญหาด้านการเรียนรู้","noun phrase","learning gap",["learning cap","learn gap","learning goal"]],
        ["intended users","ผู้ใช้ที่ตั้งใจออกแบบให้ใช้","noun phrase","intended users",["intention users","intended using","intended useful"]],
        ["project context","บริบทของโครงการ","noun phrase","project context",["project contact","project content","context project"]],
        ["practical value","คุณค่าเชิงปฏิบัติ","noun phrase","practical value",["practice value","practical valuable","value practical"]],
        ["design focus","จุดเน้นของการออกแบบ","noun phrase","design focus",["design focused","focus design","design function"]],
        ["expected benefit","ประโยชน์ที่คาดว่าจะได้รับ","noun phrase","expected benefit",["expected beneficial","expect benefit","expected result only"]],
        ["feasibility","ความเป็นไปได้ในการดำเนินโครงการ","noun","project feasibility",["feasible","facility","flexibility"]],
        ["project justification","เหตุผลสนับสนุนความจำเป็นของโครงการ","noun phrase","project justification",["project justified","justification project","project justice"]],
        ["learner profile","ข้อมูลลักษณะของผู้เรียน","noun phrase","learner profile",["learning profile","profile learner","learner profiling"]],
        ["design purpose","จุดประสงค์ของการออกแบบ","noun phrase","design purpose",["purpose design","design purposeful","design propose"]]
      ]
    },

    S4:{
      theme:"Tech Jobs / Careers",
      rows:[
        ["developer","นักพัฒนาโปรแกรม","noun","software developer",["develop","developing","development"]],
        ["designer","นักออกแบบ","noun","UI designer",["design","designed","designation"]],
        ["data analyst","นักวิเคราะห์ข้อมูล","noun phrase","data analyst",["data analysis","data analytics","analyst data"]],
        ["AI engineer","วิศวกรปัญญาประดิษฐ์","noun phrase","AI engineer",["AI engine","engineer AI","AI engineering only"]],
        ["UX designer","นักออกแบบประสบการณ์ผู้ใช้","noun phrase","UX designer",["UX design","designer UX","user design only"]],
        ["cybersecurity analyst","นักวิเคราะห์ความมั่นคงปลอดภัยไซเบอร์","noun phrase","cybersecurity analyst",["cybersecurity analysis","cyber analysted","security cyber analyst"]],
        ["multimedia specialist","ผู้เชี่ยวชาญด้านมัลติมีเดีย","noun phrase","multimedia specialist",["multimedia special","specialist multimedia","media specialist only"]],
        ["responsibility","ความรับผิดชอบ","noun","job responsibility",["responsible","response","responsibly"]],
        ["qualification","คุณสมบัติ","noun","job qualification",["qualified","quality","qualify"]],
        ["candidate","ผู้สมัคร","noun","job candidate",["candid","candidatee","candidacy"]],
        ["position","ตำแหน่งงาน","noun","job position",["positive","possession","positioning"]],
        ["portfolio","แฟ้มผลงาน","noun","digital portfolio",["profile only","port follow","portfolioed"]],
        ["professional role","บทบาททางวิชาชีพ","noun phrase","professional role",["professional rule","role professional","profession role"]],
        ["career path","เส้นทางอาชีพ","noun phrase","career path",["career part","path career","career pass"]],
        ["internship","การฝึกงาน","noun","internship opportunity",["internal ship","interned","interning"]],
        ["workplace","สถานที่ทำงาน/บริบทการทำงาน","noun","digital workplace",["workplaceful","work placement only","work play"]],
        ["technical skill","ทักษะเชิงเทคนิค","noun phrase","technical skill",["technique skill","technical skilled","skill technical"]],
        ["soft skill","ทักษะด้านมนุษยสัมพันธ์/การทำงานร่วมกับผู้อื่น","noun phrase","soft skill",["softly skill","skill soft","software skill only"]],
        ["job description","รายละเอียดงาน","noun phrase","job description",["job describe","description job","job descriptive"]],
        ["employability","ความพร้อมในการมีงานทำ","noun","employability skill",["employable","employment","employee ability"]]
      ]
    },

    S5:{
      theme:"Workplace Communication",
      rows:[
        ["request","คำขอ/การขอร้อง","verb/noun","request information",["require","question","requested"]],
        ["clarify","ทำให้ชัดเจน/ขอความชัดเจน","verb","clarify the deadline",["clarification","clear","classify"]],
        ["confirm","ยืนยัน","verb","confirm the meeting",["conform","inform","perform"]],
        ["update","อัปเดต/แจ้งความคืบหน้า","verb/noun","update on progress",["upgrade","updating","updated"]],
        ["apologize","ขอโทษ","verb","apologize for the delay",["apology","apologized","apologetic"]],
        ["appreciate","ขอบคุณ/ซาบซึ้ง","verb","appreciate feedback",["appreciation","appreciated","appropriate"]],
        ["response","การตอบกลับ","noun","quick response",["respond","responsible","responsive"]],
        ["available","ว่าง/พร้อมใช้งาน","adjective","available for a meeting",["availability","avail","availabled"]],
        ["regarding","เกี่ยวกับ","preposition","regarding the project",["regarded","regards","regardless"]],
        ["sincerely","ด้วยความเคารพ/ขอแสดงความนับถือ","adverb","Yours sincerely",["Sincere","Sincerity","Since"]],
        ["schedule","กำหนดการ","noun","project schedule",["scheduled","scheduling","scheme"]],
        ["coordinate","ประสานงาน","verb","coordinate tasks",["coordination","coordinator","coordinated"]],
        ["ask for","ขอ","phrase","ask for clarification",["ask to","ask about only","asked for"]],
        ["follow up","ติดตามผล","verb phrase","follow up on progress",["followed up","following up only","follow-up noun only"]],
        ["explain","อธิบาย","verb","explain the issue",["explanation","explained","explainable"]],
        ["propose","เสนอ","verb","propose a solution",["proposal","proposed","purpose"]],
        ["agree","เห็นด้วย","verb","agree with a suggestion",["agreement","agreed","agreeing"]],
        ["inform","แจ้งให้ทราบ","verb","inform the team",["information","informed","informative"]],
        ["polite request","คำขออย่างสุภาพ","noun phrase","polite request",["politely request","request polite","polite require"]],
        ["professional tone","น้ำเสียงแบบมืออาชีพ","noun phrase","professional tone",["professional tune","tone professional","profession tone"]]
      ]
    },

    S6:{
      theme:"Team Progress & Responsibility",
      rows:[
        ["progress","ความก้าวหน้า","noun","project progress",["process","program","progressive"]],
        ["responsibility","ความรับผิดชอบ","noun","team responsibility",["responsible","response","responsibly"]],
        ["contribution","การมีส่วนร่วม/ผลงานที่ช่วยทีม","noun","team contribution",["contribute","contributed","contributor"]],
        ["timeline","เส้นเวลา/แผนกำหนดการ","noun","project timeline",["deadline","time line only","timely"]],
        ["milestone","หมุดหมายสำคัญของงาน","noun","project milestone",["millstone","military","mile"]],
        ["coordinate","ประสานงาน","verb","coordinate tasks",["coordination","coordinator","coordinated"]],
        ["deadline","กำหนดส่ง","noun","meet the deadline",["dead line only","headline","timeline only"]],
        ["collaboration","การทำงานร่วมกัน","noun","team collaboration",["collaborate","collaborative","collaboratively"]],
        ["weekly update","การแจ้งความคืบหน้ารายสัปดาห์","noun phrase","weekly update",["week update","weekly updated","update weekly"]],
        ["task allocation","การจัดสรรงาน","noun phrase","task allocation",["task allocate","task allocated","allocation task"]],
        ["role","บทบาท","noun","team role",["rule","roll","roleplay"]],
        ["deliverable","งานส่งมอบ","noun","project deliverable",["delivery","deliver","delivered"]],
        ["workload","ภาระงาน","noun","divide the workload",["workflow","workshop","work line"]],
        ["delay","ความล่าช้า","noun/verb","project delay",["delayed","delete","deadline"]],
        ["monitor","ติดตามตรวจสอบ","verb","monitor progress",["monitoring","monitored","mentor"]],
        ["team performance","ผลการทำงานของทีม","noun phrase","team performance",["team perform","team performer","performance team"]],
        ["status report","รายงานสถานะงาน","noun phrase","weekly status report",["status reported","report status","state report"]],
        ["task dependency","ความสัมพันธ์ที่งานหนึ่งต้องรออีกงานหนึ่ง","noun phrase","task dependency",["task dependent","dependency task","task depend"]],
        ["completion rate","อัตราความสำเร็จของงาน","noun phrase","task completion rate",["complete rate","completion ratio only","rate completion"]],
        ["risk management","การบริหารความเสี่ยง","noun phrase","project risk management",["risk managed","management risk","risky management"]]
      ]
    },

    S7:{
      theme:"Professional Email",
      rows:[
        ["subject line","หัวข้ออีเมล","noun phrase","clear subject line",["subjective line","line subject","subject title only"]],
        ["attachment","ไฟล์แนบ","noun","email attachment",["attached","attaching","attention"]],
        ["inquiry","การสอบถาม","noun","course inquiry",["inquire","enquiry spelling only","inquired"]],
        ["deadline","กำหนดส่ง","noun","assignment deadline",["timeline","dead line only","headline"]],
        ["recipient","ผู้รับอีเมล","noun","email recipient",["receiver only","receipt","recipe"]],
        ["sender","ผู้ส่งอีเมล","noun","email sender",["sending","send","sendee"]],
        ["formal greeting","คำขึ้นต้นอีเมลแบบทางการ","noun phrase","formal greeting",["formal greating","greeting formal","format greeting"]],
        ["closing statement","ข้อความปิดท้าย","noun phrase","email closing statement",["close statement","closing stated","statement closing"]],
        ["reply","ตอบกลับ","verb/noun","reply by Friday",["replied","replying","response only"]],
        ["polite tone","น้ำเสียงสุภาพ","noun phrase","polite tone",["polite tune","tone polite","politely tone"]],
        ["email body","เนื้อหาอีเมล","noun phrase","email body",["body email","email bodily","mail body only"]],
        ["carbon copy","สำเนาอีเมลถึงผู้อื่น","noun phrase","carbon copy",["copy carbon","carbon copied only","CC only"]],
        ["salutation","คำขึ้นต้นจดหมาย/อีเมล","noun","email salutation",["salute","saluted","salutationed"]],
        ["signature","ลายเซ็น/ชื่อท้ายอีเมล","noun","email signature",["signed","signing","signal"]],
        ["request email","อีเมลเพื่อขอข้อมูลหรือความช่วยเหลือ","noun phrase","request email",["requested email","email request","requesting mail"]],
        ["confirmation email","อีเมลยืนยัน","noun phrase","confirmation email",["confirmed email","email confirmation","confirming mail"]],
        ["reminder email","อีเมลเตือนความจำ","noun phrase","reminder email",["remind email","email reminder","reminded mail"]],
        ["response time","เวลาที่ใช้ในการตอบกลับ","noun phrase","response time",["respond time","time response","responsive time"]],
        ["formal language","ภาษาทางการ","noun phrase","formal language",["form language","language formal","formally language"]],
        ["attachment note","ข้อความแจ้งเรื่องไฟล์แนบ","noun phrase","attachment note",["attached note","note attachment","attention note"]]
      ]
    },

    S8:{
      theme:"Meeting / Discussion",
      rows:[
        ["agenda","วาระการประชุม","noun","meeting agenda",["agent","agendaed","agendum only"]],
        ["discussion","การอภิปราย","noun","team discussion",["discuss","discussed","decision"]],
        ["opinion","ความคิดเห็น","noun","give an opinion",["option","optional","opinionated"]],
        ["suggestion","ข้อเสนอแนะ","noun","make a suggestion",["suggest","suggested","suggestive"]],
        ["decision","การตัดสินใจ","noun","make a decision",["decide","decided","division"]],
        ["concern","ข้อกังวล","noun","raise a concern",["confirm","concert","concerning"]],
        ["agree","เห็นด้วย","verb","agree with a suggestion",["agreement","agreed","agreeing"]],
        ["disagree","ไม่เห็นด้วย","verb","respectfully disagree",["disagreement","disagreed","disagreeing"]],
        ["alternative","ทางเลือกอื่น","noun/adjective","alternative solution",["alternate","alternatively","alteration"]],
        ["recommend","แนะนำ","verb","recommend testing",["recommendation","recommended","recommending"]],
        ["meeting objective","วัตถุประสงค์ของการประชุม","noun phrase","meeting objective",["objective meeting","meeting object","meeting objection"]],
        ["participant","ผู้เข้าร่วม","noun","meeting participant",["participate","participated","participation"]],
        ["moderator","ผู้ดำเนินการประชุม","noun","meeting moderator",["moderate","moderated","modernator"]],
        ["issue raised","ประเด็นที่ถูกหยิบยกขึ้นมา","noun phrase","issue raised",["raised issue only","issue raising","issue rise"]],
        ["decision point","จุดที่ต้องตัดสินใจ","noun phrase","decision point",["point decision","deciding point","decision pointer"]],
        ["discussion point","ประเด็นอภิปราย","noun phrase","discussion point",["point discussion","discuss point","discussion pointer"]],
        ["action plan","แผนปฏิบัติการ","noun phrase","action plan",["active plan","plan action","acting plan"]],
        ["time allocation","การจัดสรรเวลา","noun phrase","time allocation",["time allocate","allocation time","time allocated"]],
        ["turn-taking","การผลัดกันพูด","noun","turn-taking strategy",["take turn only","turning take","turn taken"]],
        ["consensus building","การสร้างฉันทามติ","noun phrase","consensus building",["consent building","building consensus only","consensus build"]]
      ]
    },

    S9:{
      theme:"Discussion Summary & Action Items",
      rows:[
        ["follow-up","การติดตามผล","noun/adjective","follow-up email",["following","followed","follow uping"]],
        ["action item","งานที่ต้องทำหลังประชุม","noun phrase","meeting action item",["active item","action idea","acting item"]],
        ["agreement","ข้อตกลง","noun","reach an agreement",["agree","agreed","agreeing"]],
        ["conclusion","ข้อสรุป","noun","meeting conclusion",["confusion","condition","connection"]],
        ["summarize","สรุป","verb","summarize key points",["summary","summarized","summer"]],
        ["key point","ประเด็นสำคัญ","noun phrase","key point",["key port","key part","key paint"]],
        ["confirm","ยืนยัน","verb","confirm the decision",["conform","perform","inform"]],
        ["assign","มอบหมาย","verb","assign tasks",["assignment","assigned","assist"]],
        ["meeting minutes","บันทึกการประชุม","noun phrase","meeting minutes",["meeting minute","minutes meeting","meeting summary only"]],
        ["decision record","บันทึกการตัดสินใจ","noun phrase","decision record",["decision recorded","record decision","decide record"]],
        ["next step","ขั้นตอนถัดไป","noun phrase","next step",["next stop","next stage only","step next"]],
        ["follow-up task","งานติดตามผล","noun phrase","follow-up task",["following task","followed task","task follow-uping"]],
        ["consensus","ฉันทามติ/ความเห็นพ้องร่วมกัน","noun","reach a consensus",["consent","concern","conclusion"]],
        ["priority","ลำดับความสำคัญ","noun","first priority",["prior","prioritize","primary"]],
        ["revision plan","แผนการปรับแก้","noun phrase","revision plan",["revise plan","revision planning","plan revision"]],
        ["shared understanding","ความเข้าใจร่วมกัน","noun phrase","shared understanding",["sharing understanding","shared understand","understanding shared"]],
        ["meeting outcome","ผลลัพธ์จากการประชุม","noun phrase","meeting outcome",["meeting output only","outcome meeting","meeting income"]],
        ["assigned owner","ผู้รับผิดชอบงานที่ได้รับมอบหมาย","noun phrase","assigned owner",["assignment owner","owner assigned","assigned owing"]],
        ["due date","วันที่ครบกำหนด","noun phrase","task due date",["do date","date due","deadline date only"]],
        ["decision summary","สรุปการตัดสินใจ","noun phrase","decision summary",["summary decision","decided summary","decision summarize"]]
      ]
    },

    S10:{
      theme:"System Explanation",
      rows:[
        ["system","ระบบ","noun","learning system",["systematic","systemic","symptom"]],
        ["process","กระบวนการ","noun","login process",["progress","procedure only","processed"]],
        ["input","ข้อมูลนำเข้า","noun","user input",["output","inputting","inside"]],
        ["output","ผลลัพธ์ที่ระบบแสดง","noun","system output",["input","outside","outcome only"]],
        ["interface","ส่วนติดต่อผู้ใช้","noun","user interface",["interact","interaction","internet face"]],
        ["database","ฐานข้อมูล","noun","database system",["data base only","dataset","data table only"]],
        ["algorithm","ขั้นตอนวิธี","noun","selection algorithm",["logarithm","algorithmic","algorism"]],
        ["workflow","ลำดับการทำงาน","noun","game workflow",["workload","workshop","flow work"]],
        ["display","แสดงผล","verb/noun","display progress",["displayed","displaying","displace"]],
        ["store","จัดเก็บ","verb","store data",["storage","stored","story"]],
        ["login","เข้าสู่ระบบ","verb/noun","login process",["logging","logged in only","log in noun only"]],
        ["dashboard","แผงสรุปข้อมูล","noun","teacher dashboard",["dash board only","dashboarded","data board"]],
        ["data field","ช่องข้อมูล","noun phrase","data field",["field data","data filled","fielded data"]],
        ["validation","การตรวจสอบความถูกต้อง","noun","input validation",["valid","validate","valuable"]],
        ["local storage","พื้นที่จัดเก็บข้อมูลในเครื่อง","noun phrase","local storage",["storage local","location storage","locally stored"]],
        ["progress tracker","ตัวติดตามความก้าวหน้า","noun phrase","progress tracker",["tracking progress","progress tracking only","tracker progress"]],
        ["menu","เมนู","noun","main menu",["manual","menued","mean you"]],
        ["button","ปุ่ม","noun","start button",["bottom","buttoned","buttoning"]],
        ["result screen","หน้าจอผลลัพธ์","noun phrase","result screen",["screen result","resulted screen","screening result"]],
        ["export function","ฟังก์ชันส่งออกข้อมูล","noun phrase","export function",["exported function","function export","export functional"]]
      ]
    },

    S11:{
      theme:"Bug Report / Problem Solving",
      rows:[
        ["bug","ข้อผิดพลาดของโปรแกรม","noun","software bug",["debug","buggy","bag"]],
        ["issue","ปัญหา","noun","technical issue",["tissue","issued","issueing"]],
        ["error","ข้อผิดพลาด","noun","console error",["errand","erroneous","terror"]],
        ["reproduce","ทำซ้ำเพื่อให้เห็นปัญหา","verb","reproduce the issue",["reproduction","reproduced","produce"]],
        ["expected result","ผลลัพธ์ที่คาดหวัง","noun phrase","expected result",["expect result","expected outcome only","result expected"]],
        ["actual result","ผลลัพธ์ที่เกิดขึ้นจริง","noun phrase","actual result",["actuality result","actually result","result actual"]],
        ["fix","แก้ไข","verb/noun","fix the issue",["fixed","fixing","fixture"]],
        ["patch","ชุดแก้ไข","verb/noun","software patch",["path","patched","patching"]],
        ["test case","กรณีทดสอบ","noun phrase","test case",["testing case","case test","test cause"]],
        ["debug","ตรวจหาและแก้ข้อผิดพลาด","verb","debug an error",["debugging","debugged","bug"]],
        ["crash","โปรแกรมหยุดทำงาน","verb/noun","app crash",["crashed","crashing","crush"]],
        ["freeze","ค้าง","verb","page freeze",["frozen","freezing","free"]],
        ["loading error","ข้อผิดพลาดขณะโหลด","noun phrase","loading error",["loaded error","error loading only","loading errand"]],
        ["missing file","ไฟล์หายหรือหาไม่เจอ","noun phrase","missing file",["missed file","file missing only","mission file"]],
        ["console log","บันทึกข้อความใน console","noun phrase","console log",["log console","console logged","control log"]],
        ["event handler","ตัวจัดการเหตุการณ์","noun phrase","event handler",["handler event","event handling only","event hander"]],
        ["broken link","ลิงก์เสีย","noun phrase","broken link",["break link","linked broken","broken line"]],
        ["version cache","แคชของเวอร์ชันไฟล์","noun phrase","version cache",["cache version only","version cash","cached version"]],
        ["fallback","ทางเลือกสำรอง","noun","fallback plan",["fall back only","fallbacked","backfall"]],
        ["hotfix","แพตช์แก้ด่วน","noun","hotfix release",["hot fix only","fixed hot","hotfixed"]]
      ]
    },

    S12:{
      theme:"User Guide / Technical Instruction",
      rows:[
        ["instruction","คำแนะนำ/คำสั่ง","noun","clear instructions",["instruct","instructive","instructing"]],
        ["requirement","ข้อกำหนด","noun","system requirement",["request","require","required"]],
        ["configure","ตั้งค่า","verb","configure settings",["configuration","configured","confirm"]],
        ["verify","ตรวจสอบยืนยัน","verb","verify information",["verified","verification","very"]],
        ["navigate","นำทาง/เปลี่ยนหน้า","verb","navigate to a page",["navigation","navigator","navigated"]],
        ["step-by-step","ทีละขั้นตอน","adjective/adverb","step-by-step guide",["step by steped","step-step","stepping"]],
        ["troubleshoot","แก้ปัญหาเบื้องต้น","verb","troubleshoot problems",["troubleshooting","troubleshot","trouble shoot"]],
        ["complete","ทำให้เสร็จสมบูรณ์","verb","complete a task",["completion","completed","completely"]],
        ["setup","การตั้งค่าเริ่มต้น","noun","setup process",["set uped","setting up only","setuped"]],
        ["access","เข้าถึง","verb/noun","access the feature",["accessing","accessed","excess"]],
        ["enable","เปิดใช้งาน","verb","enable a feature",["enabled","enabling","unable"]],
        ["disable","ปิดใช้งาน","verb","disable notifications",["disabled","disabling","enable"]],
        ["require","ต้องการ/จำเป็นต้องมี","verb","require an internet connection",["requirement","required","request"]],
        ["restart","เริ่มใหม่","verb","restart the page",["restore","reload only","restartable"]],
        ["checklist","รายการตรวจสอบ","noun","testing checklist",["check list only","checked list","checking list"]],
        ["verify completion","ตรวจสอบว่างานเสร็จสมบูรณ์","verb phrase","verify completion",["verification completion","verify complete","completed verify"]],
        ["user manual","คู่มือผู้ใช้","noun phrase","user manual",["manual user","user manually","usage manual"]],
        ["login step","ขั้นตอนการเข้าสู่ระบบ","noun phrase","login step",["login stepped","step login","logging step"]],
        ["troubleshooting guide","คู่มือแก้ปัญหาเบื้องต้น","noun phrase","troubleshooting guide",["trouble guide","guide troubleshooting","troubleshoot guided"]],
        ["validation","การตรวจสอบความถูกต้อง","noun","input validation",["valid","validate","valuable"]]
      ]
    },

    S13:{
      theme:"AI Report / Academic Summary",
      rows:[
        ["dataset","ชุดข้อมูล","noun","training dataset",["data set only","database","data sheet"]],
        ["model","แบบจำลอง","noun","AI model",["module","modal","mode"]],
        ["accuracy","ความแม่นยำ","noun","model accuracy",["accurate","accurately","account"]],
        ["finding","ข้อค้นพบ","noun","key finding",["find","founded","funding"]],
        ["limitation","ข้อจำกัด","noun","study limitation",["limited","limit","limitationed"]],
        ["analysis","การวิเคราะห์","noun","data analysis",["analyze","analyst","analytical"]],
        ["trend","แนวโน้ม","noun","upward trend",["trendline only","trendy","treat"]],
        ["evidence","หลักฐาน","noun","supporting evidence",["evident","event","evidencee"]],
        ["interpret","ตีความ","verb","interpret results",["interpretation","interpreted","interview"]],
        ["summary","สรุปสาระสำคัญ","noun","academic summary",["summarize","summarized","summer"]],
        ["prediction","การคาดการณ์","noun","model prediction",["predict","predicted","predictive"]],
        ["training data","ข้อมูลฝึกโมเดล","noun phrase","training data",["train data","data training","trained data"]],
        ["testing data","ข้อมูลทดสอบโมเดล","noun phrase","testing data",["test data only","data testing","tested data"]],
        ["variable","ตัวแปร","noun","research variable",["variety","variation","vary"]],
        ["result","ผลลัพธ์","noun","research result",["resulted","resulting","resolve"]],
        ["chart","แผนภูมิ","noun","result chart",["charter","charted","charting"]],
        ["comparison","การเปรียบเทียบ","noun","data comparison",["compare","compared","comparative"]],
        ["performance","ประสิทธิภาพ/ผลการทำงาน","noun","model performance",["perform","performed","performing"]],
        ["implication","นัยสำคัญ/ข้อบ่งชี้","noun","learning implication",["imply","implicit","application"]],
        ["conclusion","ข้อสรุป","noun","report conclusion",["confusion","condition","connection"]]
      ]
    },

    S14:{
      theme:"CV / Interview / Pitch",
      rows:[
        ["CV","ประวัติย่อสำหรับสมัครงาน/การศึกษา","noun","academic CV",["VC","resume only","cover letter"]],
        ["interview","การสัมภาษณ์","noun/verb","job interview",["interviewer only","interviewed","interval"]],
        ["pitch","การนำเสนอขายไอเดียอย่างกระชับ","noun/verb","project pitch",["picture","pitched","pitching only"]],
        ["qualification","คุณสมบัติ","noun","professional qualification",["qualified","quality","qualify"]],
        ["achievement","ความสำเร็จ/ผลงานเด่น","noun","project achievement",["achieve","achieved","achievemented"]],
        ["strength","จุดแข็ง","noun","professional strength",["strong","strengthen","straight"]],
        ["experience","ประสบการณ์","noun","relevant experience",["experienced","experiment","expertise only"]],
        ["leadership","ภาวะผู้นำ","noun","leadership skills",["leader","leading","lead"]],
        ["communication skill","ทักษะการสื่อสาร","noun phrase","communication skill",["communicate skill","communication skilled","skill communication"]],
        ["career goal","เป้าหมายทางอาชีพ","noun phrase","career goal",["career gold","goal career","career go"]],
        ["cover letter","จดหมายสมัครงาน","noun phrase","cover letter",["covered letter","letter cover","cover later"]],
        ["personal statement","ข้อความแนะนำตนเอง","noun phrase","personal statement",["statement personal","person statement","personally statement"]],
        ["relevant skill","ทักษะที่เกี่ยวข้อง","noun phrase","relevant skill",["relevance skill","skill relevant","relevantly skill"]],
        ["project evidence","หลักฐานจากผลงานโครงการ","noun phrase","project evidence",["evidence project","project event","evident project"]],
        ["professional summary","สรุปประวัติแบบมืออาชีพ","noun phrase","professional summary",["summary professional","profession summary","professional summarize"]],
        ["interview question","คำถามสัมภาษณ์","noun phrase","interview question",["question interview","interviewer question","questioned interview"]],
        ["answer strategy","กลยุทธ์การตอบ","noun phrase","answer strategy",["strategy answer","answer strategic","answered strategy"]],
        ["value proposition","คุณค่าที่เสนอ","noun phrase","value proposition",["valuable proposition","proposition value","value propose"]],
        ["career plan","แผนอาชีพ","noun phrase","career plan",["plan career","career planning only","career plane"]],
        ["self-introduction","การแนะนำตนเอง","noun","self-introduction",["introduce self only","self introduce","self-introduced"]]
      ]
    },

    S15:{
      theme:"Final Project Presentation & Reflection",
      rows:[
        ["presentation","การนำเสนอ","noun","final presentation",["present","presenter","presenting"]],
        ["reflection","การสะท้อนคิด","noun","learning reflection",["reflect","reflected","reflective"]],
        ["outcome","ผลลัพธ์","noun","learning outcome",["output","outfit","outlet"]],
        ["evidence","หลักฐาน","noun","supporting evidence",["evident","event","evidencee"]],
        ["future work","งานต่อยอดในอนาคต","noun phrase","future work",["future job","work future","future working"]],
        ["evaluate","ประเมิน","verb","evaluate effectiveness",["evaluation","evaluated","evaluating"]],
        ["improvement","การพัฒนา/การปรับปรุง","noun","vocabulary improvement",["improve","improved","improving"]],
        ["recommendation","ข้อเสนอแนะ","noun","final recommendation",["recommend","recommended","recommending"]],
        ["final outcome","ผลลัพธ์สุดท้าย","noun phrase","final outcome",["final output only","final income","outcome final"]],
        ["project impact","ผลกระทบของโครงการ","noun phrase","project impact",["project compact","impact project","project input"]],
        ["lesson learned","บทเรียนที่ได้รับ","noun phrase","lesson learned",["learned lesson only","lesson learning","learn lesson"]],
        ["academic growth","พัฒนาการทางวิชาการ","noun phrase","academic growth",["academic grow","growth academic","academic goal"]],
        ["self-evaluation","การประเมินตนเอง","noun","self-evaluation",["self-evaluate","self-evaluated","evaluation self"]],
        ["presentation skill","ทักษะการนำเสนอ","noun phrase","presentation skill",["present skill","presentation skilled","skill presentation"]],
        ["supporting data","ข้อมูลสนับสนุน","noun phrase","supporting data",["support data only","supported data","data supporting"]],
        ["project recommendation","ข้อเสนอแนะต่อโครงการ","noun phrase","project recommendation",["project recommend","recommendation project","project recommended"]],
        ["final conclusion","ข้อสรุปสุดท้าย","noun phrase","final conclusion",["conclusion final","finally conclusion","final confusion"]],
        ["project showcase","การนำเสนอผลงานโครงการ","noun phrase","project showcase",["showcase project","project show case","project shown"]],
        ["evaluation result","ผลการประเมิน","noun phrase","evaluation result",["evaluation resulted","result evaluation","evaluate result"]],
        ["improvement plan","แผนการปรับปรุง","noun phrase","improvement plan",["improve plan","improved planning","plan improvement"]]
      ]
    }
  };

  function autoSpec(sessionId, session){
    return {
      theme:session.theme,
      words:session.rows.map((row,index) => {
        const w = row[0];
        const th = row[1];
        const pos = row[2];
        const collocation = row[3] || w;
        const trapChoices = Array.isArray(row[4]) ? row[4] : [];

        const isVerb = String(pos).toLowerCase().includes("verb");
        const isAdj = String(pos).toLowerCase().includes("adjective");
        const isPhrase = String(pos).toLowerCase().includes("phrase") || String(w).includes(" ");

        const fill = isVerb
          ? `Students can ______ clearly in the ${session.theme} task.`
          : isAdj
            ? `The message should be ______ in an academic context.`
            : `The ______ is important in the ${session.theme} task.`;

        const context = isVerb
          ? `In ${session.theme}, a student needs to do the action meaning "${th}". Which word fits best?`
          : `In ${session.theme}, the phrase means "${th}". Which term fits best?`;

        const academic = isVerb
          ? `Students can ${w} information clearly in the ${session.theme.toLowerCase()} task.`
          : `The ${collocation} supports clear academic communication in the ${session.theme.toLowerCase()} task.`;

        const plain = isVerb
          ? `Students can do this clearly.`
          : `This is useful for the task.`;

        const upgrade = isVerb
          ? `Students can ${w} information clearly in an academic context.`
          : `The ${collocation} supports clear academic communication.`;

        return {
          w,
          th,
          pos,
          order:index + 1,
          answer:w,
          collocation,
          contextAnswer:w,
          fill,
          context,
          academic,
          plain,
          upgrade,
          trapChoices,
          isPhrase
        };
      })
    };
  }

  const specs = {};
  Object.keys(RAW).forEach(sessionId => {
    specs[sessionId] = autoSpec(sessionId,RAW[sessionId]);
  });

  window.EAP_VOCAB_SPECS = specs;
})();

/* =========================================================
   Question Bank Generator
========================================================= */

(function buildQuestionBank(){
  const specs = window.EAP_VOCAB_SPECS || {};
  const bank = [];

  function cloneChoices(arr){
    return Array.isArray(arr) ? arr.slice() : [];
  }

  function normalizeChoiceText(value){
    return String(value == null ? "" : value).replace(/\s+/g," ").trim();
  }

  function uniqChoices(list,answer,limit){
    const out = [];
    const seen = new Set();
    const ans = normalizeChoiceText(answer);

    function add(v){
      const s = normalizeChoiceText(v);
      if(!s) return;

      const key = s.toLowerCase();
      if(seen.has(key)) return;

      seen.add(key);
      out.push(s);
    }

    add(ans);
    (list || []).forEach(add);

    return out.slice(0,limit || 4);
  }

  const THAI_MEANING_DISTRACTORS = {
    noun:[
      "วัตถุประสงค์",
      "ผลลัพธ์",
      "ข้อจำกัด",
      "หลักฐาน",
      "ขอบเขต",
      "กระบวนการ",
      "คุณสมบัติ",
      "ความก้าวหน้า",
      "ข้อเสนอแนะ",
      "ความรับผิดชอบ",
      "การประเมิน",
      "รายงานสถานะ",
      "บทบาท",
      "ความมั่นใจ",
      "แผนการปรับปรุง"
    ],
    verb:[
      "อธิบาย",
      "ยืนยัน",
      "เสนอแนะ",
      "ประเมิน",
      "ตรวจสอบ",
      "สนับสนุน",
      "ประสานงาน",
      "แก้ไข",
      "สรุป",
      "นำเสนอ",
      "ติดตามผล",
      "ตั้งค่า",
      "เข้าถึง",
      "แก้ปัญหา",
      "ตีความ"
    ],
    adjective:[
      "เหมาะสม",
      "สำคัญ",
      "ชัดเจน",
      "เป็นทางการ",
      "มีประสิทธิภาพ",
      "เกี่ยวข้อง",
      "มีนัยสำคัญ",
      "มั่นใจ",
      "พร้อมใช้งาน",
      "โต้ตอบได้"
    ],
    phrase:[
      "ความต้องการของผู้ใช้",
      "ผู้ใช้เป้าหมาย",
      "ข้อเสนอแนะจากผู้ใช้",
      "ผลลัพธ์การเรียนรู้",
      "การฝึกซ้ำ",
      "ขอบเขตโครงการ",
      "ประโยชน์ทางการศึกษา",
      "ความก้าวหน้าในการเรียนรู้",
      "ข้อสรุปการประชุม",
      "งานต่อยอดในอนาคต",
      "แผนการปรับปรุง",
      "การนำเสนอผลงาน",
      "ผลการประเมิน"
    ]
  };

  const ACADEMIC_NEAR_MISS = [
    "project objective",
    "learning outcome",
    "user feedback",
    "user need",
    "target users",
    "project scope",
    "main function",
    "system output",
    "user input",
    "technical issue",
    "expected result",
    "actual result",
    "research finding",
    "data analysis",
    "model accuracy",
    "project timeline",
    "action item",
    "follow-up email",
    "value proposition",
    "future work",
    "final conclusion",
    "evaluation result",
    "improvement plan",
    "professional summary"
  ];

  function posGroup(spec){
    const pos = String(spec.pos || "").toLowerCase();
    const w = String(spec.w || "");

    if(pos.includes("verb")) return "verb";
    if(pos.includes("adjective")) return "adjective";
    if(pos.includes("phrase") || w.includes(" ")) return "phrase";
    return "noun";
  }

  function meaningDistractors(spec){
    const group = posGroup(spec);
    const own = normalizeChoiceText(spec.th);
    const pool = (THAI_MEANING_DISTRACTORS[group] || THAI_MEANING_DISTRACTORS.noun)
      .filter(x => normalizeChoiceText(x) !== own);

    return pool;
  }

  function wordFamilyDistractors(spec){
    const w = normalizeChoiceText(spec.w);
    const answer = normalizeChoiceText(spec.answer || spec.w);
    const traps = cloneChoices(spec.trapChoices);

    const suffixForms = [
      `${w}s`,
      `${w}ed`,
      `${w}ing`,
      `${w}tion`,
      `${w}ment`,
      `${w}ly`,
      `${w}ive`,
      `${w}al`
    ];

    return uniqChoices(
      traps.concat(suffixForms).filter(x => normalizeChoiceText(x) !== answer),
      answer,
      8
    ).slice(1);
  }

  function phraseDistractors(spec){
    const base = normalizeChoiceText(spec.collocation || spec.w);
    const parts = base.split(" ");
    const head = parts[0] || base;
    const tail = parts.slice(1).join(" ");
    const traps = cloneChoices(spec.trapChoices);
    const phraseWrong = [];

    if(base.includes(" of ")){
      phraseWrong.push(base.replace(" of "," for "));
      phraseWrong.push(base.replace(" of "," to "));
    }

    if(base.includes(" for ")){
      phraseWrong.push(base.replace(" for "," to "));
      phraseWrong.push(base.replace(" for "," in "));
    }

    if(base.includes(" in ")){
      phraseWrong.push(base.replace(" in "," on "));
      phraseWrong.push(base.replace(" in "," at "));
    }

    if(base.includes(" to ")){
      phraseWrong.push(base.replace(" to "," for "));
      phraseWrong.push(base.replace(" to "," with "));
    }

    if(parts.length >= 2){
      phraseWrong.push(`${tail} ${head}`.trim());
      phraseWrong.push(`${head} ${tail}s`.trim());
      phraseWrong.push(`${head} general ${tail}`.trim());
    }

    return traps.concat(phraseWrong).concat(ACADEMIC_NEAR_MISS.filter(x => x !== base));
  }

  function sentenceDistractors(spec){
    const correct = normalizeChoiceText(spec.academic || spec.upgrade || spec.plain || "");
    const w = normalizeChoiceText(spec.w);
    const collocation = normalizeChoiceText(spec.collocation || spec.w);

    const traps = cloneChoices(spec.trapChoices);

    const grammarTraps = [
      correct.replace(/\bis\b/g,"are"),
      correct.replace(/\bare\b/g,"is"),
      correct.replace(/\ballows users to\b/gi,"allows users"),
      correct.replace(/\bcan be\b/gi,"can"),
      correct.replace(/\bwas\b/gi,"were"),
      correct.replace(/\bwere\b/gi,"was"),
      correct.replace(/\bprovides\b/gi,"provide"),
      correct.replace(/\bsupports\b/gi,"support"),
      correct.replace(/\bresults show\b/gi,"result show"),
      correct.replace(/\bfindings indicate\b/gi,"finding indicate"),
      correct.replace(/\bI have experience in\b/gi,"I have experienced in"),
      correct.replace(/\bI am interested in\b/gi,"I am interesting in"),
      correct.replace(/\bqualified for\b/gi,"qualification for")
    ].filter(x => x && x !== correct);

    const genericButPlausible = [
      `The ${collocation} is important but needs clearer explanation.`,
      `Students can use ${w} to support the academic task.`,
      `The project uses ${collocation} to improve learning outcomes.`,
      `This report explains ${w} in an academic context.`
    ];

    return traps.concat(grammarTraps).concat(genericButPlausible);
  }

  function upgradeDistractors(spec){
    const correct = normalizeChoiceText(spec.upgrade || spec.academic || "");
    const plain = normalizeChoiceText(spec.plain || "");
    const w = normalizeChoiceText(spec.w);

    const informal = [
      plain,
      plain ? `${plain} It is very good.` : "",
      `The ${w} is good and students can learn many things.`,
      `Students use this because it is nice and useful.`,
      `This project helps students and makes learning better.`
    ];

    return informal.concat(sentenceDistractors(spec)).filter(x => x && x !== correct);
  }

  function cleanIdPart(text){
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g,"-")
      .replace(/^-+|-+$/g,"")
      .slice(0,44) || "item";
  }

  function makeMeaningChoices(spec){
    return uniqChoices(
      meaningDistractors(spec),
      spec.th,
      4
    );
  }

  function makeSentenceChoices(spec){
    return uniqChoices(
      cloneChoices(spec.trapChoices).concat(wordFamilyDistractors(spec)),
      spec.answer,
      4
    );
  }

  function makeCollocationChoices(spec){
    const base = spec.collocation || spec.w;
    return uniqChoices(
      phraseDistractors(spec),
      base,
      4
    );
  }

  function makeContextChoices(spec){
    const answer = spec.contextAnswer || spec.w;

    return uniqChoices(
      cloneChoices(spec.trapChoices)
        .concat(phraseDistractors(spec))
        .concat(wordFamilyDistractors(spec)),
      answer,
      4
    );
  }

  function makeAcademicChoices(spec){
    const correct = spec.academic || spec.upgrade || spec.plain;

    return uniqChoices(
      sentenceDistractors(spec),
      correct,
      4
    );
  }

  function makeUpgradeChoices(spec){
    const correct = spec.upgrade || spec.academic;

    return uniqChoices(
      upgradeDistractors(spec),
      correct,
      4
    );
  }

  function makeWordFormChoices(spec){
    return uniqChoices(
      wordFamilyDistractors(spec).concat(cloneChoices(spec.trapChoices)),
      spec.answer || spec.w,
      4
    );
  }

  function makeQuestion(sessionId,spec,type,level,index,prompt,answer,choices,explanation){
    return {
      id:`${sessionId}-${cleanIdPart(spec.w)}-${type}-${index}`,
      session:sessionId,
      word:spec.w,
      type,
      level,
      prompt,
      answer:normalizeChoiceText(answer),
      choices:choices.map(normalizeChoiceText),
      explanation:explanation || `“${spec.w}” หมายถึง ${spec.th} และใช้ในหัวข้อ ${spec.theme || ""}`
    };
  }

  Object.entries(specs).forEach(([sessionId,session]) => {
    const theme = session.theme || sessionId;

    (session.words || []).forEach((spec,idx) => {
      spec.theme = theme;
      const n = String(idx + 1).padStart(3,"0");

      bank.push(makeQuestion(
        sessionId,
        spec,
        "meaning",
        "A2",
        `${n}-A2-MEANING`,
        `What does “${spec.w}” mean in ${theme}?`,
        spec.th,
        makeMeaningChoices(spec),
        `“${spec.w}” = ${spec.th}`
      ));

      bank.push(makeQuestion(
        sessionId,
        spec,
        "sentence_fill",
        "A2+",
        `${n}-A2P-FILL`,
        spec.fill || `Choose the best word or phrase: ${spec.th} = ______.`,
        spec.answer || spec.w,
        makeSentenceChoices(spec),
        `The correct form is “${spec.answer || spec.w}”.`
      ));

      bank.push(makeQuestion(
        sessionId,
        spec,
        "collocation",
        "B1",
        `${n}-B1-COLLOCATION`,
        `Choose the most natural academic collocation for “${spec.w}”.`,
        spec.collocation || spec.w,
        makeCollocationChoices(spec),
        `A natural phrase is “${spec.collocation || spec.w}”.`
      ));

      bank.push(makeQuestion(
        sessionId,
        spec,
        "context",
        "B1",
        `${n}-B1-CONTEXT`,
        spec.context || `In ${theme}, which term best fits the meaning “${spec.th}”?`,
        spec.contextAnswer || spec.w,
        makeContextChoices(spec),
        `In this context, “${spec.contextAnswer || spec.w}” is the best answer.`
      ));

      bank.push(makeQuestion(
        sessionId,
        spec,
        "word_form",
        "B1",
        `${n}-B1-WORDFORM`,
        `Choose the correct word form: ${spec.fill || "The answer is ______."}`,
        spec.answer || spec.w,
        makeWordFormChoices(spec),
        `The correct form is “${spec.answer || spec.w}”.`
      ));

      bank.push(makeQuestion(
        sessionId,
        spec,
        "near_miss",
        "B1",
        `${n}-B1-NEARMISS`,
        `Near-miss challenge: which option is the correct academic term or phrase?`,
        spec.answer || spec.w,
        makeSentenceChoices(spec),
        `The correct option is “${spec.answer || spec.w}”.`
      ));

      bank.push(makeQuestion(
        sessionId,
        spec,
        "academic_phrase",
        "B1+",
        `${n}-B1P-PHRASE`,
        `Choose the sentence that sounds most academic and natural.`,
        spec.academic || spec.upgrade,
        makeAcademicChoices(spec),
        `The best academic sentence is: ${spec.academic || spec.upgrade}`
      ));

      bank.push(makeQuestion(
        sessionId,
        spec,
        "academic_upgrade",
        "B1+",
        `${n}-B1P-UPGRADE`,
        `Upgrade this plain sentence: “${spec.plain || "This is useful."}”`,
        spec.upgrade || spec.academic,
        makeUpgradeChoices(spec),
        `The upgraded sentence is: ${spec.upgrade || spec.academic}`
      ));
    });
  });

  function hardenQuestionItem(item){
    if(!item) return item;

    const answer = normalizeChoiceText(item.answer);
    let choices = Array.isArray(item.choices) ? item.choices.map(normalizeChoiceText) : [];

    choices = uniqChoices(choices,answer,4);

    if(choices.length < 4){
      let fallback = [];

      if(item.type === "meaning"){
        fallback = THAI_MEANING_DISTRACTORS.noun.concat(
          THAI_MEANING_DISTRACTORS.verb,
          THAI_MEANING_DISTRACTORS.phrase
        );
      }else if(item.type === "collocation" || item.type === "context"){
        fallback = ACADEMIC_NEAR_MISS;
      }else if(item.type === "academic_phrase" || item.type === "academic_upgrade"){
        fallback = [
          "The system supports students’ learning progress.",
          "The project provides useful feedback for learners.",
          "The report summarizes the main findings clearly.",
          "The application is designed to support repeated practice."
        ];
      }else{
        fallback = [
          "analysis",
          "analyze",
          "analytical",
          "analyst",
          "development",
          "develop",
          "developed",
          "developing"
        ];
      }

      choices = uniqChoices(choices.concat(fallback),answer,4);
    }

    while(choices.length < 4){
      choices.push(`near alternative ${choices.length + 1}`);
    }

    item.answer = answer;
    item.choices = choices.slice(0,4);

    return item;
  }

  const seen = new Set();

  window.QUESTION_BANK = bank.map(hardenQuestionItem).filter(item => {
    if(!item || !item.id) return false;

    if(seen.has(item.id)){
      console.warn("[EAP Word Quest] Duplicate item removed:", item.id);
      return false;
    }

    seen.add(item.id);
    return true;
  });

  function countWeakDistractors(){
    const badWords = [
      "banana",
      "chair",
      "weather",
      "sandwich",
      "shoe",
      "food menu",
      "travel plan",
      "classroom color"
    ];

    return window.QUESTION_BANK.filter(item =>
      (item.choices || []).some(c =>
        badWords.some(b => String(c).toLowerCase().includes(b))
      )
    ).length;
  }

  window.EAP_DATA_SUMMARY = {
    version:window.APP_VERSION,
    playableSessions:Object.keys(specs),
    totalItems:window.QUESTION_BANK.length,
    totalWords:Object.values(specs).reduce((sum,s) => sum + s.words.length,0),
    weakDistractorItems:countWeakDistractors()
  };

  console.info("[EAP Word Quest] Data loaded:",window.EAP_DATA_SUMMARY);
})();
