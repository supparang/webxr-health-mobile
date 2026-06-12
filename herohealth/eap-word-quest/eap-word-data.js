/* =========================================================
   EAP Word Quest • Academic Vocabulary Mission
   File: /herohealth/eap-word-quest/eap-word-data.js
   Version: v1.5.3-ROUND-QUALITY-BOSS-BALANCE

   Consolidated Final Data File
   - S1–S15 = 20 words/session
   - BG1–BG5 = Boss Gate separated from sessions
   - Auto-generate 8 item types per word
   - Total target ≈ 300 words × 8 = 2400 items
   - v1.5.3: anti-guess choices + plausible distractors
========================================================= */

"use strict";

window.APP_VERSION = "v1.5.3-ROUND-QUALITY-BOSS-BALANCE";

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
        ["major","สาขาวิชา","noun","academic major",["field of study","programme area","academic department"]],
        ["background","พื้นฐานหรือประสบการณ์เดิม","noun","academic background",["previous experience","learning history","academic context"]],
        ["skill set","ชุดทักษะ","noun phrase","technical skill set",["communication skill","digital skill","professional skill"]],
        ["strength","จุดแข็ง","noun","personal strength",["ability","advantage","positive quality"]],
        ["weakness","จุดที่ต้องพัฒนา","noun","learning weakness",["challenge area","limitation","development point"]],
        ["interest","ความสนใจ","noun","academic interest",["motivation","learning focus","career goal"]],
        ["goal","เป้าหมาย","noun","learning goal",["objective","target","expected outcome"]],
        ["confidence","ความมั่นใจ","noun","academic confidence",["motivation","readiness","self-belief"]],
        ["experience","ประสบการณ์","noun","practical experience",["background","practice","previous work"]],
        ["academic profile","ข้อมูลแนะนำตัวเชิงวิชาการ","noun phrase","academic profile",["personal statement","student profile","learning profile"]],
        ["learning style","รูปแบบการเรียนรู้","noun phrase","learning style",["study habit","learning preference","study strategy"]],
        ["academic goal","เป้าหมายทางวิชาการ","noun phrase","academic goal",["learning objective","course target","study plan"]],
        ["communication skill","ทักษะการสื่อสาร","noun phrase","communication skill",["presentation skill","teamwork skill","professional skill"]],
        ["technical skill","ทักษะเชิงเทคนิค","noun phrase","technical skill",["digital skill","software skill","practical skill"]],
        ["teamwork","การทำงานเป็นทีม","noun","teamwork skill",["collaboration","group work","team participation"]],
        ["creativity","ความคิดสร้างสรรค์","noun","creative ability",["innovation","original thinking","design idea"]],
        ["problem-solving","การแก้ปัญหา","noun phrase","problem-solving skill",["critical thinking","solution design","decision making"]],
        ["motivation","แรงจูงใจ","noun","learning motivation",["interest","goal orientation","study drive"]],
        ["academic writing","การเขียนเชิงวิชาการ","noun phrase","academic writing",["formal writing","report writing","research writing"]],
        ["presentation skill","ทักษะการนำเสนอ","noun phrase","presentation skill",["speaking skill","communication skill","pitching skill"]]
      ]
    },

    S2:{
      theme:"Project Introduction",
      rows:[
        ["project","โครงการ","noun","project overview",["assignment","learning task","development work"]],
        ["objective","วัตถุประสงค์","noun","project objective",["goal","purpose","expected outcome"]],
        ["feature","คุณสมบัติหรือฟีเจอร์","noun","app feature",["function","component","design element"]],
        ["function","หน้าที่การทำงาน","noun","main function",["feature","system action","user operation"]],
        ["user","ผู้ใช้","noun","target user",["learner","audience","participant"]],
        ["problem","ปัญหา","noun","learning problem",["issue","challenge","need"]],
        ["solution","แนวทางแก้ปัญหา","noun","learning solution",["approach","method","improvement plan"]],
        ["prototype","ต้นแบบ","noun","project prototype",["early model","demo version","sample design"]],
        ["user feedback","ความคิดเห็นจากผู้ใช้","noun phrase","collect user feedback",["learner comment","evaluation response","user opinion"]],
        ["requirement","ข้อกำหนดหรือสิ่งที่จำเป็น","noun","project requirement",["condition","specification","needed feature"]],
        ["implementation","การนำไปพัฒนา/ใช้งานจริง","noun","project implementation",["development process","application in practice","deployment step"]],
        ["usability","ความง่ายในการใช้งาน","noun","usability testing",["ease of use","user experience","interface quality"]],
        ["interface","ส่วนติดต่อผู้ใช้","noun","user interface",["screen layout","visual control","interaction area"]],
        ["target user","ผู้ใช้เป้าหมาย","noun phrase","target user",["intended user","main user group","learner group"]],
        ["learning app","แอปเพื่อการเรียนรู้","noun phrase","learning app",["educational application","mobile learning tool","study application"]],
        ["design concept","แนวคิดการออกแบบ","noun phrase","design concept",["design idea","visual concept","interaction concept"]],
        ["project scope","ขอบเขตโครงการ","noun phrase","project scope",["project boundary","work coverage","development scope"]],
        ["expected outcome","ผลลัพธ์ที่คาดหวัง","noun phrase","expected outcome",["learning result","project result","intended effect"]],
        ["benefit","ประโยชน์","noun","learning benefit",["advantage","positive effect","learning value"]],
        ["evaluation","การประเมิน","noun","project evaluation",["assessment","review process","effectiveness check"]]
      ]
    },

    S3:{
      theme:"Project Rationale & Target Users",
      rows:[
        ["rationale","เหตุผลหรือหลักการรองรับ","noun","project rationale",["justification","reasoning","project basis"]],
        ["target users","ผู้ใช้เป้าหมาย","noun phrase","target users",["intended users","main audience","learner group"]],
        ["user need","ความต้องการของผู้ใช้","noun phrase","user need",["learner requirement","user problem","support need"]],
        ["scope","ขอบเขต","noun","project scope",["coverage","boundary","work range"]],
        ["benefit","ประโยชน์","noun","learning benefit",["advantage","positive outcome","practical value"]],
        ["challenge","ความท้าทาย","noun","learning challenge",["difficulty","problem area","learning barrier"]],
        ["suitable for","เหมาะสำหรับ","phrase","suitable for mobile learning",["appropriate for","designed for","useful for"]],
        ["support","สนับสนุน","verb","support learning",["assist","help improve","provide help for"]],
        ["learning need","ความจำเป็นหรือความต้องการด้านการเรียนรู้","noun phrase","learning need",["learning requirement","skill gap","study need"]],
        ["project aim","เป้าหมายของโครงการ","noun phrase","project aim",["project objective","project purpose","project goal"]],
        ["learning gap","ช่องว่างหรือปัญหาด้านการเรียนรู้","noun phrase","learning gap",["skill gap","knowledge gap","performance gap"]],
        ["intended users","ผู้ใช้ที่ตั้งใจออกแบบให้ใช้","noun phrase","intended users",["target users","primary users","expected users"]],
        ["project context","บริบทของโครงการ","noun phrase","project context",["learning context","development context","course context"]],
        ["practical value","คุณค่าเชิงปฏิบัติ","noun phrase","practical value",["usefulness","real-world value","application value"]],
        ["design focus","จุดเน้นของการออกแบบ","noun phrase","design focus",["main design point","design priority","interaction focus"]],
        ["expected benefit","ประโยชน์ที่คาดว่าจะได้รับ","noun phrase","expected benefit",["intended benefit","learning value","positive effect"]],
        ["feasibility","ความเป็นไปได้ในการดำเนินโครงการ","noun","project feasibility",["practical possibility","development readiness","implementation possibility"]],
        ["project justification","เหตุผลสนับสนุนความจำเป็นของโครงการ","noun phrase","project justification",["project rationale","supporting reason","reasoned explanation"]],
        ["learner profile","ข้อมูลลักษณะของผู้เรียน","noun phrase","learner profile",["student profile","target learner data","learning background"]],
        ["design purpose","จุดประสงค์ของการออกแบบ","noun phrase","design purpose",["design aim","design objective","intended design goal"]]
      ]
    },

    S4:{
      theme:"Tech Jobs / Careers",
      rows:[
        ["developer","นักพัฒนาโปรแกรม","noun","software developer",["programmer","application developer","web developer"]],
        ["designer","นักออกแบบ","noun","UI designer",["visual designer","UX designer","interaction designer"]],
        ["data analyst","นักวิเคราะห์ข้อมูล","noun phrase","data analyst",["data scientist","business analyst","research analyst"]],
        ["AI engineer","วิศวกรปัญญาประดิษฐ์","noun phrase","AI engineer",["machine learning engineer","software engineer","data engineer"]],
        ["UX designer","นักออกแบบประสบการณ์ผู้ใช้","noun phrase","UX designer",["UI designer","interaction designer","product designer"]],
        ["cybersecurity analyst","นักวิเคราะห์ความมั่นคงปลอดภัยไซเบอร์","noun phrase","cybersecurity analyst",["security analyst","network analyst","IT risk analyst"]],
        ["multimedia specialist","ผู้เชี่ยวชาญด้านมัลติมีเดีย","noun phrase","multimedia specialist",["media designer","content producer","digital media specialist"]],
        ["responsibility","ความรับผิดชอบ","noun","job responsibility",["duty","task ownership","role requirement"]],
        ["qualification","คุณสมบัติ","noun","job qualification",["requirement","credential","professional skill"]],
        ["candidate","ผู้สมัคร","noun","job candidate",["applicant","interviewee","prospective employee"]],
        ["position","ตำแหน่งงาน","noun","job position",["role","job title","vacancy"]],
        ["portfolio","แฟ้มผลงาน","noun","digital portfolio",["work sample","project evidence","professional profile"]],
        ["professional role","บทบาททางวิชาชีพ","noun phrase","professional role",["job role","career role","work responsibility"]],
        ["career path","เส้นทางอาชีพ","noun phrase","career path",["career plan","professional direction","employment pathway"]],
        ["internship","การฝึกงาน","noun","internship opportunity",["work placement","practical training","field experience"]],
        ["workplace","สถานที่ทำงาน/บริบทการทำงาน","noun","digital workplace",["work environment","office context","professional setting"]],
        ["technical skill","ทักษะเชิงเทคนิค","noun phrase","technical skill",["software skill","digital skill","programming skill"]],
        ["soft skill","ทักษะด้านมนุษยสัมพันธ์/การทำงานร่วมกับผู้อื่น","noun phrase","soft skill",["communication skill","teamwork skill","interpersonal skill"]],
        ["job description","รายละเอียดงาน","noun phrase","job description",["role description","work detail","position summary"]],
        ["employability","ความพร้อมในการมีงานทำ","noun","employability skill",["career readiness","job readiness","professional competence"]]
      ]
    },

    S5:{
      theme:"Workplace Communication",
      rows:[
        ["request","คำขอ/การขอร้อง","verb/noun","request information",["ask for information","make an inquiry","seek clarification"]],
        ["clarify","ทำให้ชัดเจน/ขอความชัดเจน","verb","clarify the deadline",["explain clearly","confirm details","make clear"]],
        ["confirm","ยืนยัน","verb","confirm the meeting",["verify","acknowledge","approve"]],
        ["update","อัปเดต/แจ้งความคืบหน้า","verb/noun","update on progress",["progress report","status update","notify the team"]],
        ["apologize","ขอโทษ","verb","apologize for the delay",["express regret","say sorry formally","acknowledge inconvenience"]],
        ["appreciate","ขอบคุณ/ซาบซึ้ง","verb","appreciate feedback",["value feedback","thank someone","recognize support"]],
        ["response","การตอบกลับ","noun","quick response",["reply","answer","feedback message"]],
        ["available","ว่าง/พร้อมใช้งาน","adjective","available for a meeting",["free for discussion","ready to join","accessible"]],
        ["regarding","เกี่ยวกับ","preposition","regarding the project",["about","concerning","in relation to"]],
        ["sincerely","ด้วยความเคารพ/ขอแสดงความนับถือ","adverb","Yours sincerely",["respectfully","best regards","with appreciation"]],
        ["schedule","กำหนดการ","noun","project schedule",["timeline","plan","calendar"]],
        ["coordinate","ประสานงาน","verb","coordinate tasks",["organize tasks","manage communication","arrange work"]],
        ["ask for","ขอ","phrase","ask for clarification",["request","seek","inquire about"]],
        ["follow up","ติดตามผล","verb phrase","follow up on progress",["check progress","continue communication","monitor the task"]],
        ["explain","อธิบาย","verb","explain the issue",["describe","clarify","give details"]],
        ["propose","เสนอ","verb","propose a solution",["suggest","recommend","present an idea"]],
        ["agree","เห็นด้วย","verb","agree with a suggestion",["accept","support","approve"]],
        ["inform","แจ้งให้ทราบ","verb","inform the team",["notify","tell formally","provide information"]],
        ["polite request","คำขออย่างสุภาพ","noun phrase","polite request",["formal request","respectful inquiry","professional request"]],
        ["professional tone","น้ำเสียงแบบมืออาชีพ","noun phrase","professional tone",["formal tone","polite tone","workplace tone"]]
      ]
    },

    S6:{
      theme:"Team Progress & Responsibility",
      rows:[
        ["progress","ความก้าวหน้า","noun","project progress",["development status","work progress","task completion"]],
        ["responsibility","ความรับผิดชอบ","noun","team responsibility",["duty","assigned role","task ownership"]],
        ["contribution","การมีส่วนร่วม/ผลงานที่ช่วยทีม","noun","team contribution",["team input","work support","individual effort"]],
        ["timeline","เส้นเวลา/แผนกำหนดการ","noun","project timeline",["schedule","project plan","work calendar"]],
        ["milestone","หมุดหมายสำคัญของงาน","noun","project milestone",["key stage","important deadline","progress checkpoint"]],
        ["coordinate","ประสานงาน","verb","coordinate tasks",["organize tasks","arrange teamwork","manage collaboration"]],
        ["deadline","กำหนดส่ง","noun","meet the deadline",["due date","submission date","target date"]],
        ["collaboration","การทำงานร่วมกัน","noun","team collaboration",["teamwork","group cooperation","joint work"]],
        ["weekly update","การแจ้งความคืบหน้ารายสัปดาห์","noun phrase","weekly update",["status report","progress update","weekly report"]],
        ["task allocation","การจัดสรรงาน","noun phrase","task allocation",["work distribution","role assignment","task division"]],
        ["role","บทบาท","noun","team role",["responsibility","position","assigned function"]],
        ["deliverable","งานส่งมอบ","noun","project deliverable",["final output","required product","submission item"]],
        ["workload","ภาระงาน","noun","divide the workload",["amount of work","task load","team workload"]],
        ["delay","ความล่าช้า","noun/verb","project delay",["late progress","postponement","schedule problem"]],
        ["monitor","ติดตามตรวจสอบ","verb","monitor progress",["track","observe","check regularly"]],
        ["team performance","ผลการทำงานของทีม","noun phrase","team performance",["group result","team output","collaboration quality"]],
        ["status report","รายงานสถานะงาน","noun phrase","weekly status report",["progress report","team update","work report"]],
        ["task dependency","ความสัมพันธ์ที่งานหนึ่งต้องรออีกงานหนึ่ง","noun phrase","task dependency",["linked task","dependent step","workflow relationship"]],
        ["completion rate","อัตราความสำเร็จของงาน","noun phrase","task completion rate",["progress percentage","completion percentage","finished work rate"]],
        ["risk management","การบริหารความเสี่ยง","noun phrase","project risk management",["risk planning","risk control","problem prevention"]]
      ]
    },

    S7:{
      theme:"Professional Email",
      rows:[
        ["subject line","หัวข้ออีเมล","noun phrase","clear subject line",["email title","message heading","topic line"]],
        ["attachment","ไฟล์แนบ","noun","email attachment",["attached file","supporting file","document file"]],
        ["inquiry","การสอบถาม","noun","course inquiry",["question","formal request","information request"]],
        ["deadline","กำหนดส่ง","noun","assignment deadline",["due date","submission date","target date"]],
        ["recipient","ผู้รับอีเมล","noun","email recipient",["receiver","addressee","message receiver"]],
        ["sender","ผู้ส่งอีเมล","noun","email sender",["writer","message sender","email author"]],
        ["formal greeting","คำขึ้นต้นอีเมลแบบทางการ","noun phrase","formal greeting",["salutation","professional opening","email opening"]],
        ["closing statement","ข้อความปิดท้าย","noun phrase","email closing statement",["closing line","final sentence","professional closing"]],
        ["reply","ตอบกลับ","verb/noun","reply by Friday",["respond","answer","send a response"]],
        ["polite tone","น้ำเสียงสุภาพ","noun phrase","polite tone",["professional tone","formal tone","respectful tone"]],
        ["email body","เนื้อหาอีเมล","noun phrase","email body",["main message","message content","email text"]],
        ["carbon copy","สำเนาอีเมลถึงผู้อื่น","noun phrase","carbon copy",["CC recipient","copied recipient","shared copy"]],
        ["salutation","คำขึ้นต้นจดหมาย/อีเมล","noun","email salutation",["formal greeting","opening phrase","greeting line"]],
        ["signature","ลายเซ็น/ชื่อท้ายอีเมล","noun","email signature",["name block","closing identity","sender detail"]],
        ["request email","อีเมลเพื่อขอข้อมูลหรือความช่วยเหลือ","noun phrase","request email",["inquiry email","formal request message","information request email"]],
        ["confirmation email","อีเมลยืนยัน","noun phrase","confirmation email",["approval email","verification message","confirmation message"]],
        ["reminder email","อีเมลเตือนความจำ","noun phrase","reminder email",["follow-up email","notification email","deadline reminder"]],
        ["response time","เวลาที่ใช้ในการตอบกลับ","noun phrase","response time",["reply time","turnaround time","communication delay"]],
        ["formal language","ภาษาทางการ","noun phrase","formal language",["professional language","academic tone","official wording"]],
        ["attachment note","ข้อความแจ้งเรื่องไฟล์แนบ","noun phrase","attachment note",["file note","attached file message","document note"]]
      ]
    },

    S8:{
      theme:"Meeting / Discussion",
      rows:[
        ["agenda","วาระการประชุม","noun","meeting agenda",["meeting plan","discussion list","topic schedule"]],
        ["discussion","การอภิปราย","noun","team discussion",["conversation","group talk","formal exchange"]],
        ["opinion","ความคิดเห็น","noun","give an opinion",["viewpoint","perspective","comment"]],
        ["suggestion","ข้อเสนอแนะ","noun","make a suggestion",["recommendation","idea","proposal"]],
        ["decision","การตัดสินใจ","noun","make a decision",["choice","agreement","final decision"]],
        ["concern","ข้อกังวล","noun","raise a concern",["worry","issue","possible problem"]],
        ["agree","เห็นด้วย","verb","agree with a suggestion",["support","accept","approve"]],
        ["disagree","ไม่เห็นด้วย","verb","respectfully disagree",["question the idea","raise a different view","not support"]],
        ["alternative","ทางเลือกอื่น","noun/adjective","alternative solution",["option","different approach","another solution"]],
        ["recommend","แนะนำ","verb","recommend testing",["suggest","advise","propose"]],
        ["meeting objective","วัตถุประสงค์ของการประชุม","noun phrase","meeting objective",["meeting goal","discussion purpose","meeting aim"]],
        ["participant","ผู้เข้าร่วม","noun","meeting participant",["attendee","member","discussion participant"]],
        ["moderator","ผู้ดำเนินการประชุม","noun","meeting moderator",["facilitator","meeting chair","discussion leader"]],
        ["issue raised","ประเด็นที่ถูกหยิบยกขึ้นมา","noun phrase","issue raised",["main concern","discussion issue","raised point"]],
        ["decision point","จุดที่ต้องตัดสินใจ","noun phrase","decision point",["key decision","choice point","critical decision"]],
        ["discussion point","ประเด็นอภิปราย","noun phrase","discussion point",["key point","topic point","meeting topic"]],
        ["action plan","แผนปฏิบัติการ","noun phrase","action plan",["implementation plan","work plan","next-step plan"]],
        ["time allocation","การจัดสรรเวลา","noun phrase","time allocation",["time planning","meeting schedule","time distribution"]],
        ["turn-taking","การผลัดกันพูด","noun","turn-taking strategy",["speaking order","discussion flow","participation order"]],
        ["consensus building","การสร้างฉันทามติ","noun phrase","consensus building",["agreement building","shared decision making","group agreement process"]]
      ]
    },

    S9:{
      theme:"Discussion Summary & Action Items",
      rows:[
        ["follow-up","การติดตามผล","noun/adjective","follow-up email",["progress check","next contact","continued action"]],
        ["action item","งานที่ต้องทำหลังประชุม","noun phrase","meeting action item",["assigned task","next task","follow-up task"]],
        ["agreement","ข้อตกลง","noun","reach an agreement",["consensus","shared decision","team decision"]],
        ["conclusion","ข้อสรุป","noun","meeting conclusion",["final point","summary result","closing idea"]],
        ["summarize","สรุป","verb","summarize key points",["briefly explain","present key points","give a summary"]],
        ["key point","ประเด็นสำคัญ","noun phrase","key point",["main idea","important point","central issue"]],
        ["confirm","ยืนยัน","verb","confirm the decision",["verify","approve","acknowledge"]],
        ["assign","มอบหมาย","verb","assign tasks",["allocate","give responsibility","delegate"]],
        ["meeting minutes","บันทึกการประชุม","noun phrase","meeting minutes",["meeting record","discussion notes","official summary"]],
        ["decision record","บันทึกการตัดสินใจ","noun phrase","decision record",["decision log","agreement record","meeting decision note"]],
        ["next step","ขั้นตอนถัดไป","noun phrase","next step",["following action","future action","upcoming task"]],
        ["follow-up task","งานติดตามผล","noun phrase","follow-up task",["next task","assigned task","continuing task"]],
        ["consensus","ฉันทามติ/ความเห็นพ้องร่วมกัน","noun","reach a consensus",["agreement","shared view","group decision"]],
        ["priority","ลำดับความสำคัญ","noun","first priority",["importance","main focus","urgent task"]],
        ["revision plan","แผนการปรับแก้","noun phrase","revision plan",["improvement plan","editing plan","update plan"]],
        ["shared understanding","ความเข้าใจร่วมกัน","noun phrase","shared understanding",["common understanding","team understanding","mutual understanding"]],
        ["meeting outcome","ผลลัพธ์จากการประชุม","noun phrase","meeting outcome",["meeting result","discussion result","agreed outcome"]],
        ["assigned owner","ผู้รับผิดชอบงานที่ได้รับมอบหมาย","noun phrase","assigned owner",["task owner","responsible person","assigned member"]],
        ["due date","วันที่ครบกำหนด","noun phrase","task due date",["deadline","submission date","target date"]],
        ["decision summary","สรุปการตัดสินใจ","noun phrase","decision summary",["summary of decision","decision note","agreement summary"]]
      ]
    },

    S10:{
      theme:"System Explanation",
      rows:[
        ["system","ระบบ","noun","learning system",["application","platform","digital tool"]],
        ["process","กระบวนการ","noun","login process",["procedure","workflow","step sequence"]],
        ["input","ข้อมูลนำเข้า","noun","user input",["entered data","submitted information","data entry"]],
        ["output","ผลลัพธ์ที่ระบบแสดง","noun","system output",["displayed result","generated result","response data"]],
        ["interface","ส่วนติดต่อผู้ใช้","noun","user interface",["screen layout","interaction area","visual control"]],
        ["database","ฐานข้อมูล","noun","database system",["data storage","data table","information repository"]],
        ["algorithm","ขั้นตอนวิธี","noun","selection algorithm",["calculation method","decision rule","processing method"]],
        ["workflow","ลำดับการทำงาน","noun","game workflow",["process flow","task sequence","operation flow"]],
        ["display","แสดงผล","verb/noun","display progress",["show","present","visualize"]],
        ["store","จัดเก็บ","verb","store data",["save","record","keep data"]],
        ["login","เข้าสู่ระบบ","verb/noun","login process",["sign-in","access account","user authentication"]],
        ["dashboard","แผงสรุปข้อมูล","noun","teacher dashboard",["control panel","summary screen","data overview"]],
        ["data field","ช่องข้อมูล","noun phrase","data field",["input field","form field","information field"]],
        ["validation","การตรวจสอบความถูกต้อง","noun","input validation",["data check","accuracy check","format check"]],
        ["local storage","พื้นที่จัดเก็บข้อมูลในเครื่อง","noun phrase","local storage",["browser storage","device storage","offline data storage"]],
        ["progress tracker","ตัวติดตามความก้าวหน้า","noun phrase","progress tracker",["learning tracker","progress monitor","achievement tracker"]],
        ["menu","เมนู","noun","main menu",["navigation menu","option list","control list"]],
        ["button","ปุ่ม","noun","start button",["control button","action button","navigation button"]],
        ["result screen","หน้าจอผลลัพธ์","noun phrase","result screen",["summary screen","outcome page","report screen"]],
        ["export function","ฟังก์ชันส่งออกข้อมูล","noun phrase","export function",["download function","data export tool","report export option"]]
      ]
    },

    S11:{
      theme:"Bug Report / Problem Solving",
      rows:[
        ["bug","ข้อผิดพลาดของโปรแกรม","noun","software bug",["software issue","program error","system defect"]],
        ["issue","ปัญหา","noun","technical issue",["problem","difficulty","system problem"]],
        ["error","ข้อผิดพลาด","noun","console error",["mistake","system error","runtime problem"]],
        ["reproduce","ทำซ้ำเพื่อให้เห็นปัญหา","verb","reproduce the issue",["repeat the steps","make the issue happen again","replicate the problem"]],
        ["expected result","ผลลัพธ์ที่คาดหวัง","noun phrase","expected result",["intended output","planned outcome","expected outcome"]],
        ["actual result","ผลลัพธ์ที่เกิดขึ้นจริง","noun phrase","actual result",["real output","observed result","displayed outcome"]],
        ["fix","แก้ไข","verb/noun","fix the issue",["solve","repair","correct"]],
        ["patch","ชุดแก้ไข","verb/noun","software patch",["hotfix","update","correction package"]],
        ["test case","กรณีทดสอบ","noun phrase","test case",["testing scenario","check case","validation case"]],
        ["debug","ตรวจหาและแก้ข้อผิดพลาด","verb","debug an error",["find the cause","check the code","troubleshoot"]],
        ["crash","โปรแกรมหยุดทำงาน","verb/noun","app crash",["system failure","application stop","program shutdown"]],
        ["freeze","ค้าง","verb","page freeze",["screen lock","application hang","unresponsive page"]],
        ["loading error","ข้อผิดพลาดขณะโหลด","noun phrase","loading error",["load failure","page load issue","resource loading problem"]],
        ["missing file","ไฟล์หายหรือหาไม่เจอ","noun phrase","missing file",["file not found","absent resource","unavailable file"]],
        ["console log","บันทึกข้อความใน console","noun phrase","console log",["debug message","system log","browser log"]],
        ["event handler","ตัวจัดการเหตุการณ์","noun phrase","event handler",["interaction handler","click handler","input handler"]],
        ["broken link","ลิงก์เสีย","noun phrase","broken link",["invalid link","dead link","unavailable URL"]],
        ["version cache","แคชของเวอร์ชันไฟล์","noun phrase","version cache",["cached file version","browser cache","stored script version"]],
        ["fallback","ทางเลือกสำรอง","noun","fallback plan",["backup option","alternative solution","reserve method"]],
        ["hotfix","แพตช์แก้ด่วน","noun","hotfix release",["urgent patch","quick fix","emergency update"]]
      ]
    },

    S12:{
      theme:"User Guide / Technical Instruction",
      rows:[
        ["instruction","คำแนะนำ/คำสั่ง","noun","clear instructions",["guide","direction","procedure"]],
        ["requirement","ข้อกำหนด","noun","system requirement",["condition","specification","needed resource"]],
        ["configure","ตั้งค่า","verb","configure settings",["set up","adjust settings","prepare options"]],
        ["verify","ตรวจสอบยืนยัน","verb","verify information",["confirm","check","validate"]],
        ["navigate","นำทาง/เปลี่ยนหน้า","verb","navigate to a page",["go to","move through","open a page"]],
        ["step-by-step","ทีละขั้นตอน","adjective/adverb","step-by-step guide",["sequential","ordered","procedural"]],
        ["troubleshoot","แก้ปัญหาเบื้องต้น","verb","troubleshoot problems",["solve problems","identify issues","check errors"]],
        ["complete","ทำให้เสร็จสมบูรณ์","verb","complete a task",["finish","submit","finalize"]],
        ["setup","การตั้งค่าเริ่มต้น","noun","setup process",["installation process","initial configuration","preparation step"]],
        ["access","เข้าถึง","verb/noun","access the feature",["open","use","enter"]],
        ["enable","เปิดใช้งาน","verb","enable a feature",["turn on","activate","allow"]],
        ["disable","ปิดใช้งาน","verb","disable notifications",["turn off","deactivate","block"]],
        ["require","ต้องการ/จำเป็นต้องมี","verb","require an internet connection",["need","depend on","must have"]],
        ["restart","เริ่มใหม่","verb","restart the page",["reload","start again","reopen"]],
        ["checklist","รายการตรวจสอบ","noun","testing checklist",["review list","task list","verification list"]],
        ["verify completion","ตรวจสอบว่างานเสร็จสมบูรณ์","verb phrase","verify completion",["check completion","confirm completion","validate completion"]],
        ["user manual","คู่มือผู้ใช้","noun phrase","user manual",["user guide","instruction manual","help document"]],
        ["login step","ขั้นตอนการเข้าสู่ระบบ","noun phrase","login step",["sign-in step","access step","authentication step"]],
        ["troubleshooting guide","คู่มือแก้ปัญหาเบื้องต้น","noun phrase","troubleshooting guide",["problem-solving guide","support guide","error guide"]],
        ["validation","การตรวจสอบความถูกต้อง","noun","input validation",["data check","format check","accuracy check"]]
      ]
    },

    S13:{
      theme:"AI Report / Academic Summary",
      rows:[
        ["dataset","ชุดข้อมูล","noun","training dataset",["data collection","data table","research data"]],
        ["model","แบบจำลอง","noun","AI model",["prediction model","machine learning model","classification model"]],
        ["accuracy","ความแม่นยำ","noun","model accuracy",["correctness rate","performance score","prediction accuracy"]],
        ["finding","ข้อค้นพบ","noun","key finding",["result","research result","main discovery"]],
        ["limitation","ข้อจำกัด","noun","study limitation",["constraint","weakness","scope limit"]],
        ["analysis","การวิเคราะห์","noun","data analysis",["interpretation","examination","evaluation"]],
        ["trend","แนวโน้ม","noun","upward trend",["pattern","direction","change pattern"]],
        ["evidence","หลักฐาน","noun","supporting evidence",["data support","proof","research support"]],
        ["interpret","ตีความ","verb","interpret results",["explain meaning","analyze meaning","make sense of results"]],
        ["summary","สรุปสาระสำคัญ","noun","academic summary",["overview","brief report","main point summary"]],
        ["prediction","การคาดการณ์","noun","model prediction",["forecast","estimated result","predicted outcome"]],
        ["training data","ข้อมูลฝึกโมเดล","noun phrase","training data",["model training dataset","learning data","sample data"]],
        ["testing data","ข้อมูลทดสอบโมเดล","noun phrase","testing data",["evaluation data","test dataset","validation data"]],
        ["variable","ตัวแปร","noun","research variable",["factor","data feature","measured item"]],
        ["result","ผลลัพธ์","noun","research result",["outcome","finding","observed result"]],
        ["chart","แผนภูมิ","noun","result chart",["graph","visual chart","data figure"]],
        ["comparison","การเปรียบเทียบ","noun","data comparison",["contrast","side-by-side analysis","comparative review"]],
        ["performance","ประสิทธิภาพ/ผลการทำงาน","noun","model performance",["effectiveness","accuracy level","system performance"]],
        ["implication","นัยสำคัญ/ข้อบ่งชี้","noun","learning implication",["meaning","possible effect","practical meaning"]],
        ["conclusion","ข้อสรุป","noun","report conclusion",["final statement","main conclusion","summary conclusion"]]
      ]
    },

    S14:{
      theme:"CV / Interview / Pitch",
      rows:[
        ["CV","ประวัติย่อสำหรับสมัครงาน/การศึกษา","noun","academic CV",["resume","professional profile","application document"]],
        ["interview","การสัมภาษณ์","noun/verb","job interview",["formal interview","selection interview","career discussion"]],
        ["pitch","การนำเสนอขายไอเดียอย่างกระชับ","noun/verb","project pitch",["short presentation","idea pitch","proposal presentation"]],
        ["qualification","คุณสมบัติ","noun","professional qualification",["credential","required skill","career requirement"]],
        ["achievement","ความสำเร็จ/ผลงานเด่น","noun","project achievement",["accomplishment","successful outcome","notable result"]],
        ["strength","จุดแข็ง","noun","professional strength",["advantage","positive quality","key ability"]],
        ["experience","ประสบการณ์","noun","relevant experience",["work background","practical work","previous experience"]],
        ["leadership","ภาวะผู้นำ","noun","leadership skills",["team leadership","management ability","guiding role"]],
        ["communication skill","ทักษะการสื่อสาร","noun phrase","communication skill",["presentation skill","workplace communication","interpersonal skill"]],
        ["career goal","เป้าหมายทางอาชีพ","noun phrase","career goal",["professional aim","career objective","future plan"]],
        ["cover letter","จดหมายสมัครงาน","noun phrase","cover letter",["application letter","motivation letter","formal application message"]],
        ["personal statement","ข้อความแนะนำตนเอง","noun phrase","personal statement",["self-introduction statement","profile statement","application statement"]],
        ["relevant skill","ทักษะที่เกี่ยวข้อง","noun phrase","relevant skill",["related skill","useful skill","required skill"]],
        ["project evidence","หลักฐานจากผลงานโครงการ","noun phrase","project evidence",["portfolio evidence","work sample","project proof"]],
        ["professional summary","สรุปประวัติแบบมืออาชีพ","noun phrase","professional summary",["profile summary","career summary","application summary"]],
        ["interview question","คำถามสัมภาษณ์","noun phrase","interview question",["selection question","career question","application question"]],
        ["answer strategy","กลยุทธ์การตอบ","noun phrase","answer strategy",["response plan","answer method","interview strategy"]],
        ["value proposition","คุณค่าที่เสนอ","noun phrase","value proposition",["main value","benefit statement","unique value"]],
        ["career plan","แผนอาชีพ","noun phrase","career plan",["professional plan","future work plan","employment plan"]],
        ["self-introduction","การแนะนำตนเอง","noun","self-introduction",["personal introduction","brief profile","opening introduction"]]
      ]
    },

    S15:{
      theme:"Final Project Presentation & Reflection",
      rows:[
        ["presentation","การนำเสนอ","noun","final presentation",["project presentation","oral report","class presentation"]],
        ["reflection","การสะท้อนคิด","noun","learning reflection",["self-review","learning review","reflective summary"]],
        ["outcome","ผลลัพธ์","noun","learning outcome",["result","achievement","final result"]],
        ["evidence","หลักฐาน","noun","supporting evidence",["data support","proof","project evidence"]],
        ["future work","งานต่อยอดในอนาคต","noun phrase","future work",["next development","future improvement","further work"]],
        ["evaluate","ประเมิน","verb","evaluate effectiveness",["assess","review","measure"]],
        ["improvement","การพัฒนา/การปรับปรุง","noun","vocabulary improvement",["development","enhancement","revision"]],
        ["recommendation","ข้อเสนอแนะ","noun","final recommendation",["suggestion","proposal","advice"]],
        ["final outcome","ผลลัพธ์สุดท้าย","noun phrase","final outcome",["final result","project result","learning result"]],
        ["project impact","ผลกระทบของโครงการ","noun phrase","project impact",["project effect","learning impact","practical effect"]],
        ["lesson learned","บทเรียนที่ได้รับ","noun phrase","lesson learned",["learning insight","reflection point","experience gained"]],
        ["academic growth","พัฒนาการทางวิชาการ","noun phrase","academic growth",["learning development","skill improvement","academic progress"]],
        ["self-evaluation","การประเมินตนเอง","noun","self-evaluation",["self-assessment","personal review","reflection assessment"]],
        ["presentation skill","ทักษะการนำเสนอ","noun phrase","presentation skill",["speaking skill","communication skill","pitching skill"]],
        ["supporting data","ข้อมูลสนับสนุน","noun phrase","supporting data",["evidence data","support data","research data"]],
        ["project recommendation","ข้อเสนอแนะต่อโครงการ","noun phrase","project recommendation",["improvement suggestion","project advice","development recommendation"]],
        ["final conclusion","ข้อสรุปสุดท้าย","noun phrase","final conclusion",["summary conclusion","closing conclusion","final statement"]],
        ["project showcase","การนำเสนอผลงานโครงการ","noun phrase","project showcase",["project demonstration","work presentation","portfolio showcase"]],
        ["evaluation result","ผลการประเมิน","noun phrase","evaluation result",["assessment result","review outcome","evaluation outcome"]],
        ["improvement plan","แผนการปรับปรุง","noun phrase","improvement plan",["revision plan","development plan","enhancement plan"]]
      ]
    }
  };

  function autoSpec(sessionId,session){
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
          trapChoices
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
      "แผนการปรับปรุง",
      "ความพร้อมในการมีงานทำ",
      "ความง่ายในการใช้งาน",
      "ผลงานส่งมอบ"
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
      "ตีความ",
      "แจ้งให้ทราบ",
      "มอบหมาย",
      "เปิดใช้งาน"
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
      "ผลการประเมิน",
      "รายงานความก้าวหน้า",
      "แผนปฏิบัติการ"
    ]
  };

  const ACADEMIC_NEAR_MISS = [
    "project objective",
    "learning outcome",
    "user feedback",
    "user need",
    "target user",
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
    "professional summary",
    "project evidence",
    "user requirement",
    "status report",
    "meeting outcome",
    "career goal",
    "design purpose"
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
    const answer = normalizeChoiceText(spec.answer || spec.w);
    const traps = cloneChoices(spec.trapChoices);

    return uniqChoices(
      traps.filter(x => normalizeChoiceText(x) !== answer),
      answer,
      8
    ).slice(1);
  }

  function phraseDistractors(spec){
    const base = normalizeChoiceText(spec.collocation || spec.w);
    const traps = cloneChoices(spec.trapChoices);

    return traps.concat(ACADEMIC_NEAR_MISS.filter(x => x !== base));
  }

  function sentenceDistractors(spec){
    const correct = normalizeChoiceText(spec.academic || spec.upgrade || spec.plain || "");
    const w = normalizeChoiceText(spec.w);
    const collocation = normalizeChoiceText(spec.collocation || spec.w);

    const traps = cloneChoices(spec.trapChoices);

    const formalSentences = [
      `The ${collocation} supports effective learning in this project.`,
      `The project uses ${collocation} to improve learner understanding.`,
      `Students can apply ${w} in an academic communication task.`,
      `This report explains ${w} with clear supporting evidence.`,
      `The learning activity provides useful feedback for students.`,
      `The system helps users complete the task more effectively.`,
      `The summary presents the key points in a formal way.`,
      `The design supports repeated practice and skill development.`
    ].filter(x => x && x !== correct);

    return traps.concat(formalSentences);
  }

  function upgradeDistractors(spec){
    const correct = normalizeChoiceText(spec.upgrade || spec.academic || "");
    const w = normalizeChoiceText(spec.w);
    const collocation = normalizeChoiceText(spec.collocation || spec.w);

    const formalAlternatives = [
      `The ${collocation} helps learners complete the academic task effectively.`,
      `The project provides clear support for student learning progress.`,
      `The report presents ${w} in a clear academic context.`,
      `The activity supports communication skills in a professional context.`,
      `The design improves the learning experience through structured practice.`,
      `The evidence explains the project outcome in a formal way.`,
      `The recommendation identifies a practical improvement for future work.`
    ].filter(x => x && x !== correct);

    return formalAlternatives;
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
        `Choose the correct form or academic phrase for this context: ${spec.fill || "The answer is ______."}`,
        spec.answer || spec.w,
        makeWordFormChoices(spec),
        `Use “${spec.answer || spec.w}” as the correct form or academic phrase in this context.`
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

  function isObviousDistractor(choice,answer){
    const c = normalizeChoiceText(choice).toLowerCase();
    const a = normalizeChoiceText(answer).toLowerCase();

    if(!c) return true;
    if(c === a) return false;

    const obviousBits = [
      " only",
      "option ",
      "near alternative",
      "banana",
      "chair",
      "weather",
      "sandwich",
      "shoe",
      "food menu",
      "travel plan",
      "classroom color",
      "good and students can learn many things",
      "nice and useful"
    ];

    if(obviousBits.some(x => c.includes(x))) return true;

    if(/\b[a-z]{4,}e{2}\b/.test(c)) return true;
    if(/\b[a-z]{4,}(?:tioned|mented|nessed|shiped|ableed|backed)\b/.test(c)) return true;
    if(/\b[a-z]{4,}(?:inged|eded)\b/.test(c)) return true;
    if(/\b[a-z]+\s+[a-z]+ed\b/.test(c)) return true;

    if(!c.includes(" ") && !a.includes(" ")){
      if(c === `${a}s`) return true;
      if(c === `${a}ed`) return true;
      if(c === `${a}ing`) return true;
    }

    const parts = a.split(" ");
    if(parts.length === 2){
      const reversed = `${parts[1]} ${parts[0]}`;
      if(c === reversed) return true;
    }

    return false;
  }

  function formalFallbackChoices(item){
    if(item.type === "meaning"){
      return THAI_MEANING_DISTRACTORS.noun
        .concat(THAI_MEANING_DISTRACTORS.verb)
        .concat(THAI_MEANING_DISTRACTORS.adjective)
        .concat(THAI_MEANING_DISTRACTORS.phrase);
    }

    if(item.type === "academic_phrase" || item.type === "academic_upgrade"){
      return [
        "The project supports learners’ academic development.",
        "The system provides useful feedback for learning.",
        "The report explains the main findings clearly.",
        "The application helps students practise repeatedly.",
        "The design improves the learning experience.",
        "The summary presents the key points clearly.",
        "The evidence supports the project outcome.",
        "The recommendation explains the next improvement step."
      ];
    }

    return ACADEMIC_NEAR_MISS.concat([
      "learning outcome",
      "project objective",
      "user requirement",
      "system function",
      "technical issue",
      "evaluation result",
      "academic summary",
      "improvement plan",
      "project evidence",
      "final conclusion"
    ]);
  }

  function plausiblePoolForItem(item,allItems){
    const answer = normalizeChoiceText(item.answer);

    const pools = [
      allItems.filter(q =>
        q &&
        q.id !== item.id &&
        q.session === item.session &&
        q.type === item.type &&
        q.level === item.level
      ),

      allItems.filter(q =>
        q &&
        q.id !== item.id &&
        q.type === item.type &&
        q.level === item.level
      ),

      allItems.filter(q =>
        q &&
        q.id !== item.id &&
        q.type === item.type
      ),

      allItems.filter(q =>
        q &&
        q.id !== item.id &&
        q.level === item.level
      )
    ];

    const out = [];

    pools.forEach(pool => {
      pool.forEach(q => {
        const candidate = normalizeChoiceText(q.answer);

        if(!candidate) return;
        if(candidate === answer) return;
        if(isObviousDistractor(candidate,answer)) return;

        out.push(candidate);
      });
    });

    return out;
  }

  function polishPlausibleChoices(item,allItems){
    if(!item) return item;

    const answer = normalizeChoiceText(item.answer);

    const kept = (Array.isArray(item.choices) ? item.choices : [])
      .map(normalizeChoiceText)
      .filter(choice => choice && choice !== answer)
      .filter(choice => !isObviousDistractor(choice,answer));

    const plausible = plausiblePoolForItem(item,allItems);

    let choices = uniqChoices(kept.concat(plausible),answer,4);

    if(choices.length < 4){
      choices = uniqChoices(
        choices.concat(formalFallbackChoices(item)),
        answer,
        4
      );
    }

    item.answer = answer;
    item.choices = choices.slice(0,4);

    return item;
  }

  function hardenQuestionItem(item){
    if(!item) return item;

    const answer = normalizeChoiceText(item.answer);

    let choices = Array.isArray(item.choices)
      ? item.choices.map(normalizeChoiceText)
      : [];

    choices = choices
      .filter(choice => choice && choice !== answer)
      .filter(choice => !isObviousDistractor(choice,answer));

    choices = uniqChoices(
      choices.concat(formalFallbackChoices(item)),
      answer,
      4
    );

    item.answer = answer;
    item.choices = choices.slice(0,4);

    return item;
  }

  const seen = new Set();

  const hardenedBank = bank.map(hardenQuestionItem);

  window.QUESTION_BANK = hardenedBank.map(item => {
    return polishPlausibleChoices(item,hardenedBank);
  }).filter(item => {
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
      "classroom color",
      "option ",
      "near alternative",
      "nice and useful",
      "good and students can learn"
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
