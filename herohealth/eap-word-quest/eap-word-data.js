/* =========================================================
   EAP Word Quest • Academic Vocabulary Mission
   File: /herohealth/eap-word-quest/eap-word-data.js
   Version: v1.6.0-VALID-ITEM-BANK

   VALID ITEM BANK PATCH
   - S1–S15 = 20 words/session
   - 6 validated item types / word
   - 300 words × 6 = 1800 items
   - No hidden-answer prompt
   - No vague “which option is correct?”
   - No “This is useful for the task.”
   - Definition/context/meaning clue required for every high-level item
========================================================= */

"use strict";

window.APP_VERSION = "v1.6.0-VALID-ITEM-BANK";

/* =========================================================
   Course Map
========================================================= */

window.SESSIONS = [
  { id:"S1", title:"Academic Profile", desc:"major, background, skill, strength, interest, goal", status:"playable", boss:false },
  { id:"S2", title:"Project Introduction", desc:"project, objective, feature, user, problem, solution", status:"playable", boss:false },
  { id:"S3", title:"Project Rationale & Target Users", desc:"rationale, target users, need, benefit, scope", status:"playable", boss:false },
  { id:"BG1", title:"Boss Gate 1", desc:"Review Gate รวม S1–S3: Profile + Project Foundation", status:"boss", boss:true, gate:true },

  { id:"S4", title:"Tech Jobs / Careers", desc:"คำศัพท์อาชีพ IT, AI, Multimedia และบทบาทงาน", status:"playable", boss:false },
  { id:"S5", title:"Workplace Communication", desc:"request, clarify, update, confirm, explain", status:"playable", boss:false },
  { id:"S6", title:"Team Progress & Responsibility", desc:"progress, responsibility, timeline, contribution, teamwork", status:"playable", boss:false },
  { id:"BG2", title:"Boss Gate 2", desc:"Review Gate รวม S4–S6: Career + Workplace Communication", status:"boss", boss:true, gate:true },

  { id:"S7", title:"Professional Email", desc:"subject, attachment, deadline, inquiry, response", status:"playable", boss:false },
  { id:"S8", title:"Meeting / Discussion", desc:"agenda, opinion, suggest, decision, concern", status:"playable", boss:false },
  { id:"S9", title:"Discussion Summary & Action Items", desc:"summary, action item, follow-up, conclusion, agreement", status:"playable", boss:false },
  { id:"BG3", title:"Boss Gate 3", desc:"Review Gate รวม S7–S9: Email + Meeting + Summary", status:"boss", boss:true, gate:true },

  { id:"S10", title:"System Explanation", desc:"function, process, input, output, interface", status:"playable", boss:false },
  { id:"S11", title:"Bug Report / Problem Solving", desc:"issue, bug, reproduce, solution, update", status:"playable", boss:false },
  { id:"S12", title:"User Guide / Technical Instruction", desc:"instruction, requirement, step, configure, verify", status:"playable", boss:false },
  { id:"BG4", title:"Boss Gate 4", desc:"Review Gate รวม S10–S12: System + Bug + Technical Guide", status:"boss", boss:true, gate:true },

  { id:"S13", title:"AI Report / Academic Summary", desc:"dataset, model, accuracy, findings, limitation", status:"playable", boss:false },
  { id:"S14", title:"CV / Interview / Pitch", desc:"strength, qualification, achievement, propose, pitch", status:"playable", boss:false },
  { id:"S15", title:"Final Project Presentation & Reflection", desc:"presentation, reflection, contribution, evidence, future work", status:"playable", boss:false },
  { id:"BG5", title:"Final Boss Gate", desc:"Final Review Gate รวม Academic Vocabulary ทั้งคอร์ส", status:"boss", boss:true, gate:true }
];

/* =========================================================
   Valid Vocabulary Source
   Format:
   word | thai meaning | part of speech | academic collocation | safe distractors
========================================================= */

(function buildVocabularySpecs(){
  const RAW_TEXT = {
    S1:{
      theme:"Academic Profile",
      rows:`
major|สาขาวิชา|noun|academic major|field of study;programme area;academic department
background|พื้นฐานหรือประสบการณ์เดิม|noun|academic background|previous experience;learning history;academic context
skill set|ชุดทักษะ|noun phrase|technical skill set|communication skill;digital skill;professional skill
strength|จุดแข็ง|noun|personal strength|ability;advantage;positive quality
weakness|จุดที่ต้องพัฒนา|noun|learning weakness|challenge area;limitation;development point
interest|ความสนใจ|noun|academic interest|motivation;learning focus;career goal
goal|เป้าหมาย|noun|learning goal|objective;target;expected outcome
confidence|ความมั่นใจ|noun|academic confidence|motivation;readiness;self-belief
experience|ประสบการณ์|noun|practical experience|background;practice;previous work
academic profile|ข้อมูลแนะนำตัวเชิงวิชาการ|noun phrase|academic profile|personal statement;student profile;learning profile
learning style|รูปแบบการเรียนรู้|noun phrase|learning style|study habit;learning preference;study strategy
academic goal|เป้าหมายทางวิชาการ|noun phrase|academic goal|learning objective;course target;study plan
communication skill|ทักษะการสื่อสาร|noun phrase|communication skill|presentation skill;teamwork skill;professional skill
technical skill|ทักษะเชิงเทคนิค|noun phrase|technical skill|digital skill;software skill;practical skill
teamwork|การทำงานเป็นทีม|noun|teamwork skill|collaboration;group work;team participation
creativity|ความคิดสร้างสรรค์|noun|creative ability|innovation;original thinking;design idea
problem-solving|การแก้ปัญหา|noun phrase|problem-solving skill|critical thinking;solution design;decision making
motivation|แรงจูงใจ|noun|learning motivation|interest;goal orientation;study drive
academic writing|การเขียนเชิงวิชาการ|noun phrase|academic writing|formal writing;report writing;research writing
presentation skill|ทักษะการนำเสนอ|noun phrase|presentation skill|speaking skill;communication skill;pitching skill
`
    },

    S2:{
      theme:"Project Introduction",
      rows:`
project|โครงการ|noun|project overview|assignment;learning task;development work
objective|วัตถุประสงค์|noun|project objective|goal;purpose;expected outcome
feature|คุณสมบัติหรือฟีเจอร์|noun|app feature|function;component;design element
function|หน้าที่การทำงาน|noun|main function|feature;system action;user operation
user|ผู้ใช้|noun|target user|learner;audience;participant
problem|ปัญหา|noun|learning problem|issue;challenge;need
solution|แนวทางแก้ปัญหา|noun|learning solution|approach;method;improvement plan
prototype|ต้นแบบ|noun|project prototype|early model;demo version;sample design
user feedback|ความคิดเห็นจากผู้ใช้|noun phrase|collect user feedback|learner comment;evaluation response;user opinion
requirement|ข้อกำหนดหรือสิ่งที่จำเป็น|noun|project requirement|condition;specification;needed feature
implementation|การนำไปพัฒนา/ใช้งานจริง|noun|project implementation|development process;application in practice;deployment step
usability|ความง่ายในการใช้งาน|noun|usability testing|ease of use;user experience;interface quality
interface|ส่วนติดต่อผู้ใช้|noun|user interface|screen layout;visual control;interaction area
target user|ผู้ใช้เป้าหมาย|noun phrase|target user|intended user;main user group;learner group
learning app|แอปเพื่อการเรียนรู้|noun phrase|learning app|educational application;mobile learning tool;study application
design concept|แนวคิดการออกแบบ|noun phrase|design concept|design idea;visual concept;interaction concept
project scope|ขอบเขตโครงการ|noun phrase|project scope|project boundary;work coverage;development scope
expected outcome|ผลลัพธ์ที่คาดหวัง|noun phrase|expected outcome|learning result;project result;intended effect
benefit|ประโยชน์|noun|learning benefit|advantage;positive effect;learning value
evaluation|การประเมิน|noun|project evaluation|assessment;review process;effectiveness check
`
    },

    S3:{
      theme:"Project Rationale & Target Users",
      rows:`
rationale|เหตุผลหรือหลักการรองรับ|noun|project rationale|justification;reasoning;project basis
target users|ผู้ใช้เป้าหมาย|noun phrase|target users|intended users;main audience;learner group
user need|ความต้องการของผู้ใช้|noun phrase|user need|learner requirement;user problem;support need
scope|ขอบเขต|noun|project scope|coverage;boundary;work range
benefit|ประโยชน์|noun|learning benefit|advantage;positive outcome;practical value
challenge|ความท้าทาย|noun|learning challenge|difficulty;problem area;learning barrier
suitable for|เหมาะสำหรับ|phrase|suitable for mobile learning|appropriate for;designed for;useful for
support|สนับสนุน|verb|support learning|assist;help improve;provide help for
learning need|ความจำเป็นหรือความต้องการด้านการเรียนรู้|noun phrase|learning need|learning requirement;skill gap;study need
project aim|เป้าหมายของโครงการ|noun phrase|project aim|project objective;project purpose;project goal
learning gap|ช่องว่างหรือปัญหาด้านการเรียนรู้|noun phrase|learning gap|skill gap;knowledge gap;performance gap
intended users|ผู้ใช้ที่ตั้งใจออกแบบให้ใช้|noun phrase|intended users|target users;primary users;expected users
project context|บริบทของโครงการ|noun phrase|project context|learning context;development context;course context
practical value|คุณค่าเชิงปฏิบัติ|noun phrase|practical value|usefulness;real-world value;application value
design focus|จุดเน้นของการออกแบบ|noun phrase|design focus|main design point;design priority;interaction focus
expected benefit|ประโยชน์ที่คาดว่าจะได้รับ|noun phrase|expected benefit|intended benefit;learning value;positive effect
feasibility|ความเป็นไปได้ในการดำเนินโครงการ|noun|project feasibility|practical possibility;development readiness;implementation possibility
project justification|เหตุผลสนับสนุนความจำเป็นของโครงการ|noun phrase|project justification|project rationale;supporting reason;reasoned explanation
learner profile|ข้อมูลลักษณะของผู้เรียน|noun phrase|learner profile|student profile;target learner data;learning background
design purpose|จุดประสงค์ของการออกแบบ|noun phrase|design purpose|design aim;design objective;intended design goal
`
    },

    S4:{
      theme:"Tech Jobs / Careers",
      rows:`
developer|นักพัฒนาโปรแกรม|noun|software developer|programmer;application developer;web developer
designer|นักออกแบบ|noun|UI designer|visual designer;UX designer;interaction designer
data analyst|นักวิเคราะห์ข้อมูล|noun phrase|data analyst|data scientist;business analyst;research analyst
AI engineer|วิศวกรปัญญาประดิษฐ์|noun phrase|AI engineer|machine learning engineer;software engineer;data engineer
UX designer|นักออกแบบประสบการณ์ผู้ใช้|noun phrase|UX designer|UI designer;interaction designer;product designer
cybersecurity analyst|นักวิเคราะห์ความมั่นคงปลอดภัยไซเบอร์|noun phrase|cybersecurity analyst|security analyst;network analyst;IT risk analyst
multimedia specialist|ผู้เชี่ยวชาญด้านมัลติมีเดีย|noun phrase|multimedia specialist|media designer;content producer;digital media specialist
responsibility|ความรับผิดชอบ|noun|job responsibility|duty;task ownership;role requirement
qualification|คุณสมบัติ|noun|job qualification|requirement;credential;professional skill
candidate|ผู้สมัคร|noun|job candidate|applicant;interviewee;prospective employee
position|ตำแหน่งงาน|noun|job position|role;job title;vacancy
portfolio|แฟ้มผลงาน|noun|digital portfolio|work sample;project evidence;professional profile
professional role|บทบาททางวิชาชีพ|noun phrase|professional role|job role;career role;work responsibility
career path|เส้นทางอาชีพ|noun phrase|career path|career plan;professional direction;employment pathway
internship|การฝึกงาน|noun|internship opportunity|work placement;practical training;field experience
workplace|สถานที่ทำงาน/บริบทการทำงาน|noun|digital workplace|work environment;office context;professional setting
technical skill|ทักษะเชิงเทคนิค|noun phrase|technical skill|software skill;digital skill;programming skill
soft skill|ทักษะด้านมนุษยสัมพันธ์/การทำงานร่วมกับผู้อื่น|noun phrase|soft skill|communication skill;teamwork skill;interpersonal skill
job description|รายละเอียดงาน|noun phrase|job description|role description;work detail;position summary
employability|ความพร้อมในการมีงานทำ|noun|employability skill|career readiness;job readiness;professional competence
`
    },

    S5:{
      theme:"Workplace Communication",
      rows:`
request|คำขอหรือการขอร้อง|verb/noun|request information|ask for information;make an inquiry;seek clarification
clarify|ทำให้ชัดเจนหรือขอความชัดเจน|verb|clarify the deadline|explain clearly;confirm details;make clear
confirm|ยืนยัน|verb|confirm the meeting|verify;acknowledge;approve
update|อัปเดตหรือแจ้งความคืบหน้า|verb/noun|update on progress|progress report;status update;notify the team
apologize|ขอโทษ|verb|apologize for the delay|express regret;say sorry formally;acknowledge inconvenience
appreciate|ขอบคุณหรือซาบซึ้ง|verb|appreciate feedback|value feedback;thank someone;recognize support
response|การตอบกลับ|noun|quick response|reply;answer;feedback message
available|ว่างหรือพร้อมใช้งาน|adjective|available for a meeting|free for discussion;ready to join;accessible
regarding|เกี่ยวกับ|preposition|regarding the project|about;concerning;in relation to
sincerely|ด้วยความเคารพหรือขอแสดงความนับถือ|adverb|Yours sincerely|respectfully;best regards;with appreciation
schedule|กำหนดการ|noun|project schedule|timeline;plan;calendar
coordinate|ประสานงาน|verb|coordinate tasks|organize tasks;manage communication;arrange work
ask for|ขอ|phrase|ask for clarification|request;seek;inquire about
follow up|ติดตามผล|verb phrase|follow up on progress|check progress;continue communication;monitor the task
explain|อธิบาย|verb|explain the issue|describe;clarify;give details
propose|เสนอ|verb|propose a solution|suggest;recommend;present an idea
agree|เห็นด้วย|verb|agree with a suggestion|accept;support;approve
inform|แจ้งให้ทราบ|verb|inform the team|notify;tell formally;provide information
polite request|คำขออย่างสุภาพ|noun phrase|polite request|formal request;respectful inquiry;professional request
professional tone|น้ำเสียงแบบมืออาชีพ|noun phrase|professional tone|formal tone;polite tone;workplace tone
`
    },

    S6:{
      theme:"Team Progress & Responsibility",
      rows:`
progress|ความก้าวหน้า|noun|project progress|development status;work progress;task completion
responsibility|ความรับผิดชอบ|noun|team responsibility|duty;assigned role;task ownership
contribution|การมีส่วนร่วมหรือผลงานที่ช่วยทีม|noun|team contribution|team input;work support;individual effort
timeline|เส้นเวลาหรือแผนกำหนดการ|noun|project timeline|schedule;project plan;work calendar
milestone|หมุดหมายสำคัญของงาน|noun|project milestone|key stage;important deadline;progress checkpoint
coordinate|ประสานงาน|verb|coordinate tasks|organize tasks;arrange teamwork;manage collaboration
deadline|กำหนดส่ง|noun|meet the deadline|due date;submission date;target date
collaboration|การทำงานร่วมกัน|noun|team collaboration|teamwork;group cooperation;joint work
weekly update|การแจ้งความคืบหน้ารายสัปดาห์|noun phrase|weekly update|status report;progress update;weekly report
task allocation|การจัดสรรงาน|noun phrase|task allocation|work distribution;role assignment;task division
role|บทบาท|noun|team role|responsibility;position;assigned function
deliverable|งานส่งมอบ|noun|project deliverable|final output;required product;submission item
workload|ภาระงาน|noun|divide the workload|amount of work;task load;team workload
delay|ความล่าช้า|noun/verb|project delay|late progress;postponement;schedule problem
monitor|ติดตามตรวจสอบ|verb|monitor progress|track;observe;check regularly
team performance|ผลการทำงานของทีม|noun phrase|team performance|group result;team output;collaboration quality
status report|รายงานสถานะงาน|noun phrase|weekly status report|progress report;team update;work report
task dependency|ความสัมพันธ์ที่งานหนึ่งต้องรออีกงานหนึ่ง|noun phrase|task dependency|linked task;dependent step;workflow relationship
completion rate|อัตราความสำเร็จของงาน|noun phrase|task completion rate|progress percentage;completion percentage;finished work rate
risk management|การบริหารความเสี่ยง|noun phrase|project risk management|risk planning;risk control;problem prevention
`
    },

    S7:{
      theme:"Professional Email",
      rows:`
subject line|หัวข้ออีเมล|noun phrase|clear subject line|email title;message heading;topic line
attachment|ไฟล์แนบ|noun|email attachment|attached file;supporting file;document file
inquiry|การสอบถาม|noun|course inquiry|question;formal request;information request
deadline|กำหนดส่ง|noun|assignment deadline|due date;submission date;target date
recipient|ผู้รับอีเมล|noun|email recipient|receiver;addressee;message receiver
sender|ผู้ส่งอีเมล|noun|email sender|writer;message sender;email author
formal greeting|คำขึ้นต้นอีเมลแบบทางการ|noun phrase|formal greeting|salutation;professional opening;email opening
closing statement|ข้อความปิดท้าย|noun phrase|email closing statement|closing line;final sentence;professional closing
reply|ตอบกลับ|verb/noun|reply by Friday|respond;answer;send a response
polite tone|น้ำเสียงสุภาพ|noun phrase|polite tone|professional tone;formal tone;respectful tone
email body|เนื้อหาอีเมล|noun phrase|email body|main message;message content;email text
carbon copy|สำเนาอีเมลถึงผู้อื่น|noun phrase|carbon copy|CC recipient;copied recipient;shared copy
salutation|คำขึ้นต้นจดหมายหรืออีเมล|noun|email salutation|formal greeting;opening phrase;greeting line
signature|ลายเซ็นหรือชื่อท้ายอีเมล|noun|email signature|name block;closing identity;sender detail
request email|อีเมลเพื่อขอข้อมูลหรือความช่วยเหลือ|noun phrase|request email|inquiry email;formal request message;information request email
confirmation email|อีเมลยืนยัน|noun phrase|confirmation email|approval email;verification message;confirmation message
reminder email|อีเมลเตือนความจำ|noun phrase|reminder email|follow-up email;notification email;deadline reminder
response time|เวลาที่ใช้ในการตอบกลับ|noun phrase|response time|reply time;turnaround time;communication delay
formal language|ภาษาทางการ|noun phrase|formal language|professional language;academic tone;official wording
attachment note|ข้อความแจ้งเรื่องไฟล์แนบ|noun phrase|attachment note|file note;attached file message;document note
`
    },

    S8:{
      theme:"Meeting / Discussion",
      rows:`
agenda|วาระการประชุม|noun|meeting agenda|meeting plan;discussion list;topic schedule
discussion|การอภิปราย|noun|team discussion|conversation;group talk;formal exchange
opinion|ความคิดเห็น|noun|give an opinion|viewpoint;perspective;comment
suggestion|ข้อเสนอแนะ|noun|make a suggestion|recommendation;idea;proposal
decision|การตัดสินใจ|noun|make a decision|choice;agreement;final decision
concern|ข้อกังวล|noun|raise a concern|worry;issue;possible problem
agree|เห็นด้วย|verb|agree with a suggestion|support;accept;approve
disagree|ไม่เห็นด้วย|verb|respectfully disagree|question the idea;raise a different view;not support
alternative|ทางเลือกอื่น|noun/adjective|alternative solution|option;different approach;another solution
recommend|แนะนำ|verb|recommend testing|suggest;advise;propose
meeting objective|วัตถุประสงค์ของการประชุม|noun phrase|meeting objective|meeting goal;discussion purpose;meeting aim
participant|ผู้เข้าร่วม|noun|meeting participant|attendee;member;discussion participant
moderator|ผู้ดำเนินการประชุม|noun|meeting moderator|facilitator;meeting chair;discussion leader
issue raised|ประเด็นที่ถูกหยิบยกขึ้นมา|noun phrase|issue raised|main concern;discussion issue;raised point
decision point|จุดที่ต้องตัดสินใจ|noun phrase|decision point|key decision;choice point;critical decision
discussion point|ประเด็นอภิปราย|noun phrase|discussion point|key point;topic point;meeting topic
action plan|แผนปฏิบัติการ|noun phrase|action plan|implementation plan;work plan;next-step plan
time allocation|การจัดสรรเวลา|noun phrase|time allocation|time planning;meeting schedule;time distribution
turn-taking|การผลัดกันพูด|noun|turn-taking strategy|speaking order;discussion flow;participation order
consensus building|การสร้างฉันทามติ|noun phrase|consensus building|agreement building;shared decision making;group agreement process
`
    },

    S9:{
      theme:"Discussion Summary & Action Items",
      rows:`
follow-up|การติดตามผล|noun/adjective|follow-up email|progress check;next contact;continued action
action item|งานที่ต้องทำหลังประชุม|noun phrase|meeting action item|assigned task;next task;follow-up task
agreement|ข้อตกลง|noun|reach an agreement|consensus;shared decision;team decision
conclusion|ข้อสรุป|noun|meeting conclusion|final point;summary result;closing idea
summarize|สรุป|verb|summarize key points|briefly explain;present key points;give a summary
key point|ประเด็นสำคัญ|noun phrase|key point|main idea;important point;central issue
confirm|ยืนยัน|verb|confirm the decision|verify;approve;acknowledge
assign|มอบหมาย|verb|assign tasks|allocate;give responsibility;delegate
meeting minutes|บันทึกการประชุม|noun phrase|meeting minutes|meeting record;discussion notes;official summary
decision record|บันทึกการตัดสินใจ|noun phrase|decision record|decision log;agreement record;meeting decision note
next step|ขั้นตอนถัดไป|noun phrase|next step|following action;future action;upcoming task
follow-up task|งานติดตามผล|noun phrase|follow-up task|next task;assigned task;continuing task
consensus|ฉันทามติหรือความเห็นพ้องร่วมกัน|noun|reach a consensus|agreement;shared view;group decision
priority|ลำดับความสำคัญ|noun|first priority|importance;main focus;urgent task
revision plan|แผนการปรับแก้|noun phrase|revision plan|improvement plan;editing plan;update plan
shared understanding|ความเข้าใจร่วมกัน|noun phrase|shared understanding|common understanding;team understanding;mutual understanding
meeting outcome|ผลลัพธ์จากการประชุม|noun phrase|meeting outcome|meeting result;discussion result;agreed outcome
assigned owner|ผู้รับผิดชอบงานที่ได้รับมอบหมาย|noun phrase|assigned owner|task owner;responsible person;assigned member
due date|วันที่ครบกำหนด|noun phrase|task due date|deadline;submission date;target date
decision summary|สรุปการตัดสินใจ|noun phrase|decision summary|summary of decision;decision note;agreement summary
`
    },

    S10:{
      theme:"System Explanation",
      rows:`
system|ระบบ|noun|learning system|application;platform;digital tool
process|กระบวนการ|noun|login process|procedure;workflow;step sequence
input|ข้อมูลนำเข้า|noun|user input|entered data;submitted information;data entry
output|ผลลัพธ์ที่ระบบแสดง|noun|system output|displayed result;generated result;response data
interface|ส่วนติดต่อผู้ใช้|noun|user interface|screen layout;interaction area;visual control
database|ฐานข้อมูล|noun|database system|data storage;data table;information repository
algorithm|ขั้นตอนวิธี|noun|selection algorithm|calculation method;decision rule;processing method
workflow|ลำดับการทำงาน|noun|game workflow|process flow;task sequence;operation flow
display|แสดงผล|verb/noun|display progress|show;present;visualize
store|จัดเก็บ|verb|store data|save;record;keep data
login|เข้าสู่ระบบ|verb/noun|login process|sign-in;access account;user authentication
dashboard|แผงสรุปข้อมูล|noun|teacher dashboard|control panel;summary screen;data overview
data field|ช่องข้อมูล|noun phrase|data field|input field;form field;information field
validation|การตรวจสอบความถูกต้อง|noun|input validation|data check;accuracy check;format check
local storage|พื้นที่จัดเก็บข้อมูลในเครื่อง|noun phrase|local storage|browser storage;device storage;offline data storage
progress tracker|ตัวติดตามความก้าวหน้า|noun phrase|progress tracker|learning tracker;progress monitor;achievement tracker
menu|เมนู|noun|main menu|navigation menu;option list;control list
button|ปุ่ม|noun|start button|control button;action button;navigation button
result screen|หน้าจอผลลัพธ์|noun phrase|result screen|summary screen;outcome page;report screen
export function|ฟังก์ชันส่งออกข้อมูล|noun phrase|export function|download function;data export tool;report export option
`
    },

    S11:{
      theme:"Bug Report / Problem Solving",
      rows:`
bug|ข้อผิดพลาดของโปรแกรม|noun|software bug|software issue;program error;system defect
issue|ปัญหา|noun|technical issue|problem;difficulty;system problem
error|ข้อผิดพลาด|noun|console error|mistake;system error;runtime problem
reproduce|ทำซ้ำเพื่อให้เห็นปัญหา|verb|reproduce the issue|repeat the steps;make the issue happen again;replicate the problem
expected result|ผลลัพธ์ที่คาดหวัง|noun phrase|expected result|intended output;planned outcome;expected outcome
actual result|ผลลัพธ์ที่เกิดขึ้นจริง|noun phrase|actual result|real output;observed result;displayed outcome
fix|แก้ไข|verb/noun|fix the issue|solve;repair;correct
patch|ชุดแก้ไข|verb/noun|software patch|hotfix;update;correction package
test case|กรณีทดสอบ|noun phrase|test case|testing scenario;check case;validation case
debug|ตรวจหาและแก้ข้อผิดพลาด|verb|debug an error|find the cause;check the code;troubleshoot
crash|โปรแกรมหยุดทำงาน|verb/noun|app crash|system failure;application stop;program shutdown
freeze|ค้าง|verb|page freeze|screen lock;application hang;unresponsive page
loading error|ข้อผิดพลาดขณะโหลด|noun phrase|loading error|load failure;page load issue;resource loading problem
missing file|ไฟล์หายหรือหาไม่เจอ|noun phrase|missing file|file not found;absent resource;unavailable file
console log|บันทึกข้อความใน console|noun phrase|console log|debug message;system log;browser log
event handler|ตัวจัดการเหตุการณ์|noun phrase|event handler|interaction handler;click handler;input handler
broken link|ลิงก์เสีย|noun phrase|broken link|invalid link;dead link;unavailable URL
version cache|แคชของเวอร์ชันไฟล์|noun phrase|version cache|cached file version;browser cache;stored script version
fallback|ทางเลือกสำรอง|noun|fallback plan|backup option;alternative solution;reserve method
hotfix|แพตช์แก้ด่วน|noun|hotfix release|urgent patch;quick fix;emergency update
`
    },

    S12:{
      theme:"User Guide / Technical Instruction",
      rows:`
instruction|คำแนะนำหรือคำสั่ง|noun|clear instructions|guide;direction;procedure
requirement|ข้อกำหนด|noun|system requirement|condition;specification;needed resource
configure|ตั้งค่า|verb|configure settings|set up;adjust settings;prepare options
verify|ตรวจสอบยืนยัน|verb|verify information|confirm;check;validate
navigate|นำทางหรือเปลี่ยนหน้า|verb|navigate to a page|go to;move through;open a page
step-by-step|ทีละขั้นตอน|adjective/adverb|step-by-step guide|sequential;ordered;procedural
troubleshoot|แก้ปัญหาเบื้องต้น|verb|troubleshoot problems|solve problems;identify issues;check errors
complete|ทำให้เสร็จสมบูรณ์|verb|complete a task|finish;submit;finalize
setup|การตั้งค่าเริ่มต้น|noun|setup process|installation process;initial configuration;preparation step
access|เข้าถึง|verb/noun|access the feature|open;use;enter
enable|เปิดใช้งาน|verb|enable a feature|turn on;activate;allow
disable|ปิดใช้งาน|verb|disable notifications|turn off;deactivate;block
require|ต้องการหรือจำเป็นต้องมี|verb|require an internet connection|need;depend on;must have
restart|เริ่มใหม่|verb|restart the page|reload;start again;reopen
checklist|รายการตรวจสอบ|noun|testing checklist|review list;task list;verification list
verify completion|ตรวจสอบว่างานเสร็จสมบูรณ์|verb phrase|verify completion|check completion;confirm completion;validate completion
user manual|คู่มือผู้ใช้|noun phrase|user manual|user guide;instruction manual;help document
login step|ขั้นตอนการเข้าสู่ระบบ|noun phrase|login step|sign-in step;access step;authentication step
troubleshooting guide|คู่มือแก้ปัญหาเบื้องต้น|noun phrase|troubleshooting guide|problem-solving guide;support guide;error guide
validation|การตรวจสอบความถูกต้อง|noun|input validation|data check;format check;accuracy check
`
    },

    S13:{
      theme:"AI Report / Academic Summary",
      rows:`
dataset|ชุดข้อมูล|noun|training dataset|data collection;data table;research data
model|แบบจำลอง|noun|AI model|prediction model;machine learning model;classification model
accuracy|ความแม่นยำ|noun|model accuracy|correctness rate;performance score;prediction accuracy
finding|ข้อค้นพบ|noun|key finding|result;research result;main discovery
limitation|ข้อจำกัด|noun|study limitation|constraint;weakness;scope limit
analysis|การวิเคราะห์|noun|data analysis|interpretation;examination;evaluation
trend|แนวโน้ม|noun|upward trend|pattern;direction;change pattern
evidence|หลักฐาน|noun|supporting evidence|data support;proof;research support
interpret|ตีความ|verb|interpret results|explain meaning;analyze meaning;make sense of results
summary|สรุปสาระสำคัญ|noun|academic summary|overview;brief report;main point summary
prediction|การคาดการณ์|noun|model prediction|forecast;estimated result;predicted outcome
training data|ข้อมูลฝึกโมเดล|noun phrase|training data|model training dataset;learning data;sample data
testing data|ข้อมูลทดสอบโมเดล|noun phrase|testing data|evaluation data;test dataset;validation data
variable|ตัวแปร|noun|research variable|factor;data feature;measured item
result|ผลลัพธ์|noun|research result|outcome;finding;observed result
chart|แผนภูมิ|noun|result chart|graph;visual chart;data figure
comparison|การเปรียบเทียบ|noun|data comparison|contrast;side-by-side analysis;comparative review
performance|ประสิทธิภาพหรือผลการทำงาน|noun|model performance|effectiveness;accuracy level;system performance
implication|นัยสำคัญหรือข้อบ่งชี้|noun|learning implication|meaning;possible effect;practical meaning
conclusion|ข้อสรุป|noun|report conclusion|final statement;main conclusion;summary conclusion
`
    },

    S14:{
      theme:"CV / Interview / Pitch",
      rows:`
CV|ประวัติย่อสำหรับสมัครงานหรือการศึกษา|noun|academic CV|resume;professional profile;application document
interview|การสัมภาษณ์|noun/verb|job interview|formal interview;selection interview;career discussion
pitch|การนำเสนอขายไอเดียอย่างกระชับ|noun/verb|project pitch|short presentation;idea pitch;proposal presentation
qualification|คุณสมบัติ|noun|professional qualification|credential;required skill;career requirement
achievement|ความสำเร็จหรือผลงานเด่น|noun|project achievement|accomplishment;successful outcome;notable result
strength|จุดแข็ง|noun|professional strength|advantage;positive quality;key ability
experience|ประสบการณ์|noun|relevant experience|work background;practical work;previous experience
leadership|ภาวะผู้นำ|noun|leadership skills|team leadership;management ability;guiding role
communication skill|ทักษะการสื่อสาร|noun phrase|communication skill|presentation skill;workplace communication;interpersonal skill
career goal|เป้าหมายทางอาชีพ|noun phrase|career goal|professional aim;career objective;future plan
cover letter|จดหมายสมัครงาน|noun phrase|cover letter|application letter;motivation letter;formal application message
personal statement|ข้อความแนะนำตนเอง|noun phrase|personal statement|self-introduction statement;profile statement;application statement
relevant skill|ทักษะที่เกี่ยวข้อง|noun phrase|relevant skill|related skill;useful skill;required skill
project evidence|หลักฐานจากผลงานโครงการ|noun phrase|project evidence|portfolio evidence;work sample;project proof
professional summary|สรุปประวัติแบบมืออาชีพ|noun phrase|professional summary|profile summary;career summary;application summary
interview question|คำถามสัมภาษณ์|noun phrase|interview question|selection question;career question;application question
answer strategy|กลยุทธ์การตอบ|noun phrase|answer strategy|response plan;answer method;interview strategy
value proposition|คุณค่าที่เสนอ|noun phrase|value proposition|main value;benefit statement;unique value
career plan|แผนอาชีพ|noun phrase|career plan|professional plan;future work plan;employment plan
self-introduction|การแนะนำตนเอง|noun|self-introduction|personal introduction;brief profile;opening introduction
`
    },

    S15:{
      theme:"Final Project Presentation & Reflection",
      rows:`
presentation|การนำเสนอ|noun|final presentation|project presentation;oral report;class presentation
reflection|การสะท้อนคิด|noun|learning reflection|self-review;learning review;reflective summary
outcome|ผลลัพธ์|noun|learning outcome|result;achievement;final result
evidence|หลักฐาน|noun|supporting evidence|data support;proof;project evidence
future work|งานต่อยอดในอนาคต|noun phrase|future work|next development;future improvement;further work
evaluate|ประเมิน|verb|evaluate effectiveness|assess;review;measure
improvement|การพัฒนาหรือการปรับปรุง|noun|vocabulary improvement|development;enhancement;revision
recommendation|ข้อเสนอแนะ|noun|final recommendation|suggestion;proposal;advice
final outcome|ผลลัพธ์สุดท้าย|noun phrase|final outcome|final result;project result;learning result
project impact|ผลกระทบของโครงการ|noun phrase|project impact|project effect;learning impact;practical effect
lesson learned|บทเรียนที่ได้รับ|noun phrase|lesson learned|learning insight;reflection point;experience gained
academic growth|พัฒนาการทางวิชาการ|noun phrase|academic growth|learning development;skill improvement;academic progress
self-evaluation|การประเมินตนเอง|noun|self-evaluation|self-assessment;personal review;reflection assessment
presentation skill|ทักษะการนำเสนอ|noun phrase|presentation skill|speaking skill;communication skill;pitching skill
supporting data|ข้อมูลสนับสนุน|noun phrase|supporting data|evidence data;support data;research data
project recommendation|ข้อเสนอแนะต่อโครงการ|noun phrase|project recommendation|improvement suggestion;project advice;development recommendation
final conclusion|ข้อสรุปสุดท้าย|noun phrase|final conclusion|summary conclusion;closing conclusion;final statement
project showcase|การนำเสนอผลงานโครงการ|noun phrase|project showcase|project demonstration;work presentation;portfolio showcase
evaluation result|ผลการประเมิน|noun phrase|evaluation result|assessment result;review outcome;evaluation outcome
improvement plan|แผนการปรับปรุง|noun phrase|improvement plan|revision plan;development plan;enhancement plan
`
    }
  };

  function splitRow(line){
    const parts = String(line || "").split("|").map(x => x.trim());
    return {
      w:parts[0] || "",
      th:parts[1] || "",
      pos:parts[2] || "noun",
      collocation:parts[3] || parts[0] || "",
      safeRelated:(parts[4] || "").split(";").map(x => x.trim()).filter(Boolean)
    };
  }

  function normalizeText(value){
    return String(value == null ? "" : value).replace(/\s+/g," ").trim();
  }

  function familyFromText(text){
    const t = normalizeText(text).toLowerCase();

    if(/\b(goal|objective|aim|purpose|target)\b/.test(t)) return "goal";
    if(/\b(need|requirement|gap|problem|issue|challenge|barrier|limitation|constraint)\b/.test(t)) return "need_problem";
    if(/\b(user|learner|student|participant|audience|recipient|sender|candidate|applicant)\b/.test(t)) return "people";
    if(/\b(scope|context|boundary|coverage|range)\b/.test(t)) return "scope_context";
    if(/\b(benefit|value|impact|advantage|effect)\b/.test(t)) return "benefit_value";
    if(/\b(system|interface|database|algorithm|workflow|process|input|output|dashboard|button|menu|screen|storage)\b/.test(t)) return "system";
    if(/\b(error|bug|fix|patch|debug|crash|freeze|hotfix|fallback|link|file|cache)\b/.test(t)) return "bug_fix";
    if(/\b(email|reply|request|greeting|attachment|signature|tone|language|inquiry|recipient|sender)\b/.test(t)) return "email";
    if(/\b(meeting|discussion|agenda|decision|consensus|participant|moderator|action item|minutes)\b/.test(t)) return "meeting";
    if(/\b(data|dataset|model|accuracy|analysis|finding|evidence|chart|prediction|variable)\b/.test(t)) return "data_ai";
    if(/\b(career|cv|interview|qualification|portfolio|pitch|leadership|employability)\b/.test(t)) return "career";
    if(/\b(reflection|presentation|outcome|recommendation|improvement|future work|showcase)\b/.test(t)) return "presentation_reflection";
    if(/\b(skill|teamwork|creativity|motivation|confidence|experience|background)\b/.test(t)) return "profile_skill";

    return "general";
  }

  function autoSpec(sessionId,session){
    const rows = String(session.rows || "")
      .split("\n")
      .map(x => x.trim())
      .filter(Boolean)
      .map(splitRow);

    return {
      theme:session.theme,
      words:rows.map((row,index) => {
        const isVerb = /verb/.test(String(row.pos).toLowerCase());
        const isAdj = /adjective/.test(String(row.pos).toLowerCase());
        const family = familyFromText(`${row.w} ${row.th} ${row.collocation}`);

        return {
          id:`${sessionId}-${index + 1}`,
          session:sessionId,
          theme:session.theme,
          order:index + 1,
          w:row.w,
          th:row.th,
          pos:row.pos,
          answer:row.w,
          collocation:row.collocation || row.w,
          safeRelated:row.safeRelated,
          isVerb,
          isAdj,
          family
        };
      })
    };
  }

  const specs = {};
  Object.keys(RAW_TEXT).forEach(sessionId => {
    specs[sessionId] = autoSpec(sessionId,RAW_TEXT[sessionId]);
  });

  window.EAP_VOCAB_SPECS = specs;
})();

/* =========================================================
   Valid Question Bank Generator
========================================================= */

(function buildValidQuestionBank(){
  const specs = window.EAP_VOCAB_SPECS || {};
  const bank = [];

  const ITEM_TYPES = [
    "meaning",
    "term_definition",
    "context_gap",
    "collocation_meaning",
    "academic_sentence",
    "applied_context"
  ];

  const TYPE_LEVEL = {
    meaning:"A2",
    term_definition:"A2+",
    context_gap:"B1",
    collocation_meaning:"B1",
    academic_sentence:"B1+",
    applied_context:"B1+"
  };

  const THAI_DISTRACTOR_POOL = [
    "วัตถุประสงค์",
    "ขอบเขต",
    "ผลลัพธ์",
    "หลักฐาน",
    "ข้อเสนอแนะ",
    "การประเมิน",
    "ความรับผิดชอบ",
    "ขั้นตอน",
    "ข้อมูลนำเข้า",
    "ผลลัพธ์ที่แสดง",
    "การติดตามผล",
    "การนำเสนอ",
    "ความมั่นใจ",
    "การตั้งค่า",
    "การตรวจสอบ",
    "ผู้ใช้เป้าหมาย",
    "รายงานสถานะ",
    "แผนการปรับปรุง",
    "ประโยชน์",
    "บริบทของโครงการ",
    "แผนปฏิบัติการ",
    "ข้อสรุป",
    "การวิเคราะห์",
    "ความแม่นยำ"
  ];

  const GENERIC_TERM_POOL = [
    "project scope",
    "target users",
    "practical value",
    "design focus",
    "evaluation result",
    "system output",
    "user interface",
    "technical issue",
    "status report",
    "action plan",
    "meeting outcome",
    "academic summary",
    "final conclusion",
    "career goal",
    "professional summary",
    "supporting evidence",
    "improvement plan",
    "project showcase",
    "input validation",
    "progress tracker",
    "response time",
    "formal language",
    "data analysis",
    "model accuracy",
    "future work",
    "risk management"
  ];

  const GENERIC_SENTENCE_POOL = [
    "The project defines the project scope before development begins.",
    "The report presents the evaluation result with clear evidence.",
    "The system displays the output after the user submits input.",
    "The team prepares an action plan after the meeting.",
    "The student explains the final conclusion in the presentation.",
    "The teacher reviews the status report to monitor progress.",
    "The application uses input validation to reduce errors.",
    "The portfolio provides project evidence for an interview.",
    "The summary explains the main finding from the data analysis.",
    "The design focus helps the team improve the user experience."
  ];

  const BANNED_PROMPT_FRAGMENTS = [
    "which option is the correct",
    "this is useful for the task",
    "upgrade this plain sentence",
    "near-miss challenge",
    "which option is correct",
    "choose the sentence that sounds most academic"
  ];

  function normalizeText(value){
    return String(value == null ? "" : value).replace(/\s+/g," ").trim();
  }

  function cleanIdPart(text){
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g,"-")
      .replace(/^-+|-+$/g,"")
      .slice(0,48) || "item";
  }

  function canonicalText(value){
    return normalizeText(value)
      .toLowerCase()
      .replace(/[‐-‒–—−]/g," ")
      .replace(/\busers\b/g,"user")
      .replace(/\bskills\b/g,"skill")
      .replace(/\bitems\b/g,"item")
      .replace(/\boutcomes\b/g,"outcome")
      .replace(/\bresults\b/g,"result")
      .replace(/\bfindings\b/g,"finding")
      .replace(/\btasks\b/g,"task")
      .replace(/\s+/g," ")
      .trim();
  }

  function tokenSet(value){
    const generic = new Set([
      "project","learning","academic","user","users","student","students",
      "system","team","final","professional","data","report","task","work"
    ]);

    return canonicalText(value)
      .split(" ")
      .filter(t => t && t.length > 2 && !generic.has(t));
  }

  function familyFromText(text){
    const t = canonicalText(text);

    if(/\b(goal|objective|aim|purpose|target)\b/.test(t)) return "goal";
    if(/\b(need|requirement|gap|problem|issue|challenge|barrier|limitation|constraint)\b/.test(t)) return "need_problem";
    if(/\b(user|learner|participant|audience|recipient|sender|candidate|applicant)\b/.test(t)) return "people";
    if(/\b(scope|context|boundary|coverage|range)\b/.test(t)) return "scope_context";
    if(/\b(benefit|value|impact|advantage|effect)\b/.test(t)) return "benefit_value";
    if(/\b(system|interface|database|algorithm|workflow|process|input|output|dashboard|button|menu|screen|storage)\b/.test(t)) return "system";
    if(/\b(error|bug|fix|patch|debug|crash|freeze|hotfix|fallback|link|file|cache)\b/.test(t)) return "bug_fix";
    if(/\b(email|reply|request|greeting|attachment|signature|tone|language|inquiry)\b/.test(t)) return "email";
    if(/\b(meeting|discussion|agenda|decision|consensus|participant|moderator|minutes)\b/.test(t)) return "meeting";
    if(/\b(data|dataset|model|accuracy|analysis|finding|evidence|chart|prediction|variable)\b/.test(t)) return "data_ai";
    if(/\b(career|cv|interview|qualification|portfolio|pitch|leadership|employability)\b/.test(t)) return "career";
    if(/\b(reflection|presentation|outcome|recommendation|improvement|future work|showcase)\b/.test(t)) return "presentation_reflection";
    if(/\b(skill|teamwork|creativity|motivation|confidence|experience|background)\b/.test(t)) return "profile_skill";

    return "general";
  }

  function areConfusableText(a,b){
    const ca = canonicalText(a);
    const cb = canonicalText(b);

    if(!ca || !cb) return true;
    if(ca === cb) return true;

    const fa = familyFromText(ca);
    const fb = familyFromText(cb);

    if(fa !== "general" && fa === fb) return true;

    const ta = tokenSet(ca);
    const tb = new Set(tokenSet(cb));
    const overlap = ta.filter(t => tb.has(t));

    if(overlap.length >= 1) return true;

    return false;
  }

  function allSpecsFlat(){
    return Object.entries(specs).flatMap(([sessionId,session]) =>
      (session.words || []).map(w => Object.assign({ session:sessionId },w))
    );
  }

  const ALL_SPECS = allSpecsFlat();

  function uniq(list){
    const out = [];
    const seen = new Set();

    (list || []).forEach(v => {
      const s = normalizeText(v);
      const key = s.toLowerCase();

      if(!s || seen.has(key)) return;

      seen.add(key);
      out.push(s);
    });

    return out;
  }

  function isBadChoiceText(choice,answer){
    const c = canonicalText(choice);
    const a = canonicalText(answer);

    if(!c) return true;
    if(c === a) return false;

    const bad = [
      "option",
      "near alternative",
      "banana",
      "chair",
      "weather",
      "sandwich",
      "shoe",
      "food menu",
      "travel plan",
      "nice and useful",
      "good and students can learn"
    ];

    if(bad.some(x => c.includes(x))) return true;
    if(/\b[a-z]{4,}e{2}\b/.test(c)) return true;
    if(/\b[a-z]{4,}(?:tioned|mented|nessed|shiped|ableed|backed)\b/.test(c)) return true;
    if(/\b[a-z]{4,}(?:inged|eded)\b/.test(c)) return true;

    return false;
  }

  function candidateSpecsFor(spec){
    const sameSession = ALL_SPECS.filter(x =>
      x.session === spec.session &&
      x.w !== spec.w &&
      x.family !== spec.family &&
      !areConfusableText(x.w,spec.w) &&
      !areConfusableText(x.th,spec.th) &&
      !areConfusableText(x.collocation,spec.collocation)
    );

    const global = ALL_SPECS.filter(x =>
      x.session !== spec.session &&
      x.w !== spec.w &&
      x.family !== spec.family &&
      !areConfusableText(x.w,spec.w) &&
      !areConfusableText(x.th,spec.th) &&
      !areConfusableText(x.collocation,spec.collocation)
    );

    return sameSession.concat(global);
  }

  function buildChoices(answer,candidates,fallback){
    const ans = normalizeText(answer);
    const out = [ans];

    uniq(candidates).forEach(c => {
      if(out.length >= 4) return;
      if(isBadChoiceText(c,ans)) return;
      if(areConfusableText(c,ans)) return;
      out.push(c);
    });

    uniq(fallback || []).forEach(c => {
      if(out.length >= 4) return;
      if(isBadChoiceText(c,ans)) return;
      if(areConfusableText(c,ans)) return;
      out.push(c);
    });

    return out.slice(0,4);
  }

  function buildThaiChoices(spec){
    const candidates = candidateSpecsFor(spec).map(x => x.th);

    return buildChoices(
      spec.th,
      candidates,
      THAI_DISTRACTOR_POOL
    );
  }

  function buildTermChoices(spec){
    const candidates = candidateSpecsFor(spec).map(x => x.w);

    return buildChoices(
      spec.w,
      candidates,
      GENERIC_TERM_POOL
    );
  }

  function buildCollocationChoices(spec){
    const candidates = candidateSpecsFor(spec).map(x => x.collocation);

    return buildChoices(
      spec.collocation,
      candidates,
      GENERIC_TERM_POOL
    );
  }

  function sentenceFor(spec){
    const term = spec.w;
    const collocation = spec.collocation || spec.w;
    const theme = String(spec.theme || "academic task").toLowerCase();

    if(spec.isVerb){
      return `Students can ${term} information clearly in the ${theme} task.`;
    }

    if(/phrase/.test(String(spec.pos).toLowerCase()) || String(term).includes(" ")){
      return `The project explains the ${term} clearly in the ${theme} context.`;
    }

    return `The ${collocation} supports clear academic communication in the ${theme} task.`;
  }

  function buildSentenceChoices(spec){
    const candidates = candidateSpecsFor(spec).map(sentenceFor);

    return buildChoices(
      sentenceFor(spec),
      candidates,
      GENERIC_SENTENCE_POOL
    );
  }

  function contextSentence(spec){
    const theme = spec.theme || "academic task";

    if(spec.isVerb){
      return `In ${theme}, students should ______ when they want to express “${spec.th}” clearly.`;
    }

    return `In ${theme}, the term ______ refers to “${spec.th}”.`;
  }

  function appliedScenario(spec){
    const theme = spec.theme || "this task";

    if(spec.isVerb){
      return `Situation: A student is writing in ${theme} and wants to express the action “${spec.th}”. Which term should the student use?`;
    }

    return `Situation: A student is writing in ${theme} and wants to refer to “${spec.th}”. Which term should the student use?`;
  }

  function makeQuestion(spec,type,prompt,answer,choices,explanation){
    return {
      id:`${spec.session}-${cleanIdPart(spec.w)}-${type}-${String(spec.order).padStart(3,"0")}`,
      session:spec.session,
      word:spec.w,
      type,
      level:TYPE_LEVEL[type] || "B1",
      prompt:normalizeText(prompt),
      answer:normalizeText(answer),
      choices:choices.map(normalizeText),
      explanation:normalizeText(explanation || `“${spec.w}” means ${spec.th} in ${spec.theme}.`),
      targetMeaning:spec.th,
      targetTerm:spec.w,
      semanticFamily:spec.family
    };
  }

  function validChoices(item){
    const choices = Array.isArray(item.choices) ? item.choices.map(normalizeText) : [];
    const answer = normalizeText(item.answer);
    const unique = new Set(choices.map(x => x.toLowerCase()));

    return choices.length === 4 &&
      unique.size === 4 &&
      choices.includes(answer) &&
      !choices.some(c => isBadChoiceText(c,answer)) &&
      choices.filter(c => c !== answer).every(c => !areConfusableText(c,answer));
  }

  function buildItemsForSpec(spec){
    return [
      makeQuestion(
        spec,
        "meaning",
        `What does “${spec.w}” mean in ${spec.theme}?`,
        spec.th,
        buildThaiChoices(spec),
        `“${spec.w}” means “${spec.th}”.`
      ),

      makeQuestion(
        spec,
        "term_definition",
        `Which term means “${spec.th}” in ${spec.theme}?`,
        spec.w,
        buildTermChoices(spec),
        `The term for “${spec.th}” is “${spec.w}”.`
      ),

      makeQuestion(
        spec,
        "context_gap",
        `${contextSentence(spec)} Choose the best term for the blank.`,
        spec.w,
        buildTermChoices(spec),
        `The blank needs “${spec.w}” because it means “${spec.th}”.`
      ),

      makeQuestion(
        spec,
        "collocation_meaning",
        `Which academic phrase best matches the meaning “${spec.th}” in ${spec.theme}?`,
        spec.collocation,
        buildCollocationChoices(spec),
        `The best academic phrase is “${spec.collocation}”.`
      ),

      makeQuestion(
        spec,
        "academic_sentence",
        `Choose the academic sentence that expresses “${spec.th}” in ${spec.theme}.`,
        sentenceFor(spec),
        buildSentenceChoices(spec),
        `This sentence expresses “${spec.th}” using “${spec.w}”.`
      ),

      makeQuestion(
        spec,
        "applied_context",
        appliedScenario(spec),
        spec.w,
        buildTermChoices(spec),
        `The correct term is “${spec.w}” because it refers to “${spec.th}”.`
      )
    ];
  }

  ALL_SPECS.forEach(spec => {
    buildItemsForSpec(spec).forEach(item => {
      if(validChoices(item)){
        bank.push(item);
      }else{
        console.warn("[EAP Word Quest] Invalid item dropped:",{
          id:item.id,
          word:item.word,
          type:item.type,
          answer:item.answer,
          choices:item.choices
        });
      }
    });
  });

  function itemValidityIssue(item){
    const prompt = normalizeText(item.prompt);
    const lowPrompt = prompt.toLowerCase();
    const choices = Array.isArray(item.choices) ? item.choices.map(normalizeText) : [];
    const answer = normalizeText(item.answer);
    const unique = new Set(choices.map(x => x.toLowerCase()));

    if(!item.id) return "missing-id";
    if(!item.session) return "missing-session";
    if(!item.word) return "missing-word";
    if(!item.type) return "missing-type";
    if(!item.level) return "missing-level";
    if(!prompt) return "missing-prompt";
    if(!answer) return "missing-answer";
    if(!item.targetMeaning) return "missing-target-meaning";
    if(choices.length !== 4) return "choices-not-4";
    if(unique.size !== 4) return "duplicate-choices";
    if(!choices.includes(answer)) return "answer-not-in-choices";
    if(BANNED_PROMPT_FRAGMENTS.some(x => lowPrompt.includes(x))) return "ambiguous-prompt";
    if((item.type === "academic_sentence" || item.type === "applied_context" || item.type === "context_gap") && !prompt.includes(item.targetMeaning)){
      return "prompt-missing-target-meaning";
    }
    if(choices.some(c => isBadChoiceText(c,answer))) return "weak-choice";
    if(choices.filter(c => c !== answer).some(c => areConfusableText(c,answer))) return "semantic-collision";

    return "";
  }

  window.QUESTION_BANK = bank;

  const issueItems = window.QUESTION_BANK
    .map(item => ({
      id:item.id,
      session:item.session,
      word:item.word,
      type:item.type,
      issue:itemValidityIssue(item)
    }))
    .filter(x => x.issue);

  window.EAP_ITEM_TYPES = ITEM_TYPES.slice();

  window.EAP_VALIDITY_RULES = {
    expectedItems:1800,
    expectedItemsPerSession:120,
    expectedBossPool:360,
    expectedFinalBossPool:1800,
    bannedPromptFragments:BANNED_PROMPT_FRAGMENTS.slice()
  };

  window.EAP_DATA_SUMMARY = {
    version:window.APP_VERSION,
    totalWords:ALL_SPECS.length,
    totalItems:window.QUESTION_BANK.length,
    expectedItems:1800,
    itemTypes:ITEM_TYPES.length,
    validityIssues:issueItems.length,
    finalStatus:
      ALL_SPECS.length === 300 &&
      window.QUESTION_BANK.length === 1800 &&
      issueItems.length === 0
        ? "VALID DATA PASS"
        : "VALID DATA CHECK"
  };

  window.EAP_DATA_VALIDITY_ISSUES = issueItems;

  console.info("[EAP Word Quest] Valid data loaded:",window.EAP_DATA_SUMMARY);

  if(issueItems.length){
    console.warn("[EAP Word Quest] Validity issues:",issueItems.slice(0,80));
  }
})();
