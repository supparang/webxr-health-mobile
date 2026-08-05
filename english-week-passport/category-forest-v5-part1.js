"use strict";
const VERSION='2026-08-05-CATEGORY-FOREST-SEEDED-PRODUCTION-V5';
const STAGE_ID='category_forest';
const screen=document.getElementById('screen');
const params=new URLSearchParams(location.search);
const fromPassport=params.get('from')==='passport';
const submitEnabled=fromPassport||params.get('submit')==='1';
const cfg=window.EW_CONFIG||{cacheKeys:{identity:'ew_passport_identity_v1'}};
const rotation=window.EW_ROTATION||null;
const authority=window.EW_AUTHORITY||null;

const BANK={
Academic:[
{id:'ac01',word:'assignment',thai:'งานที่ได้รับมอบหมาย',level:'A2',hint:'An assignment is academic work given by a teacher.'},
{id:'ac02',word:'lecture',thai:'การบรรยาย',level:'A2',hint:'A lecture is a lesson presented to a class.'},
{id:'ac03',word:'seminar',thai:'สัมมนา',level:'A2+',hint:'A seminar is a small academic meeting for discussion.'},
{id:'ac04',word:'scholarship',thai:'ทุนการศึกษา',level:'A2+',hint:'A scholarship supports a student’s education.'},
{id:'ac05',word:'curriculum',thai:'หลักสูตร',level:'B1',hint:'A curriculum is the planned content of a course.'},
{id:'ac06',word:'syllabus',thai:'ประมวลรายวิชา',level:'B1',hint:'A syllabus explains the topics and work in a course.'},
{id:'ac07',word:'prerequisite',thai:'วิชาบังคับก่อน',level:'B1+',hint:'A prerequisite must be completed before another course.'},
{id:'ac08',word:'interdisciplinary',thai:'สหวิทยาการ',level:'B1+',hint:'Interdisciplinary work combines knowledge from different fields.'}
],
Research:[
{id:'re01',word:'survey',thai:'แบบสำรวจ',level:'A2',hint:'A survey collects information from people.'},
{id:'re02',word:'evidence',thai:'หลักฐาน',level:'A2',hint:'Evidence supports an idea or claim.'},
{id:'re03',word:'sample',thai:'กลุ่มตัวอย่าง',level:'A2+',hint:'A sample is a smaller group selected for a study.'},
{id:'re04',word:'participant',thai:'ผู้เข้าร่วม',level:'A2+',hint:'A participant is a person who joins a study.'},
{id:'re05',word:'analysis',thai:'การวิเคราะห์',level:'B1',hint:'Analysis examines data or information carefully.'},
{id:'re06',word:'variable',thai:'ตัวแปร',level:'B1',hint:'A variable is something that can change in a study.'},
{id:'re07',word:'hypothesis',thai:'สมมติฐาน',level:'B1+',hint:'A hypothesis is a testable research prediction.'},
{id:'re08',word:'methodology',thai:'ระเบียบวิธีวิจัย',level:'B1+',hint:'Methodology describes how research is designed and conducted.'}
],
Communication:[
{id:'co01',word:'message',thai:'ข้อความ',level:'A2',hint:'A message communicates information to another person.'},
{id:'co02',word:'presentation',thai:'การนำเสนอ',level:'A2',hint:'A presentation communicates ideas to an audience.'},
{id:'co03',word:'feedback',thai:'ข้อมูลป้อนกลับ',level:'A2+',hint:'Feedback helps someone improve.'},
{id:'co04',word:'announce',thai:'ประกาศ',level:'A2+',hint:'To announce means to share information publicly.'},
{id:'co05',word:'clarify',thai:'ชี้แจง',level:'B1',hint:'To clarify means to make a message clearer.'},
{id:'co06',word:'persuade',thai:'โน้มน้าว',level:'B1',hint:'To persuade means to influence someone’s decision.'},
{id:'co07',word:'negotiate',thai:'เจรจา',level:'B1+',hint:'To negotiate means to discuss until an agreement is reached.'},
{id:'co08',word:'articulate',thai:'อธิบายได้ชัดเจน',level:'B1+',hint:'To articulate means to express an idea clearly.'}
],
Time:[
{id:'ti01',word:'schedule',thai:'ตารางเวลา',level:'A2',hint:'A schedule organizes activities by time.'},
{id:'ti02',word:'appointment',thai:'นัดหมาย',level:'A2',hint:'An appointment is an arranged meeting at a specific time.'},
{id:'ti03',word:'deadline',thai:'กำหนดส่ง',level:'A2+',hint:'A deadline is the final time to complete work.'},
{id:'ti04',word:'delay',thai:'ความล่าช้า',level:'A2+',hint:'A delay means something happens later than planned.'},
{id:'ti05',word:'postpone',thai:'เลื่อนออกไป',level:'B1',hint:'To postpone means to move something to a later time.'},
{id:'ti06',word:'duration',thai:'ระยะเวลา',level:'B1',hint:'Duration is how long something lasts.'},
{id:'ti07',word:'prioritize',thai:'จัดลำดับความสำคัญ',level:'B1+',hint:'To prioritize means to decide what should be done first.'},
{id:'ti08',word:'punctual',thai:'ตรงต่อเวลา',level:'B1+',hint:'A punctual person arrives or finishes on time.'}
],
Technology:[
{id:'te01',word:'device',thai:'อุปกรณ์',level:'A2',hint:'A device is a piece of technology.'},
{id:'te02',word:'software',thai:'ซอฟต์แวร์',level:'A2',hint:'Software is a computer program.'},
{id:'te03',word:'password',thai:'รหัสผ่าน',level:'A2+',hint:'A password protects a digital account.'},
{id:'te04',word:'network',thai:'เครือข่าย',level:'A2+',hint:'A network connects devices.'},
{id:'te05',word:'database',thai:'ฐานข้อมูล',level:'B1',hint:'A database stores organized digital information.'},
{id:'te06',word:'update',thai:'การอัปเดต',level:'B1',hint:'An update adds new information or improves software.'},
{id:'te07',word:'algorithm',thai:'ขั้นตอนวิธี',level:'B1+',hint:'An algorithm is a sequence of steps for solving a problem.'},
{id:'te08',word:'cybersecurity',thai:'ความมั่นคงปลอดภัยไซเบอร์',level:'B1+',hint:'Cybersecurity protects systems and information from digital threats.'}
],
Workplace:[
{id:'wo01',word:'colleague',thai:'เพื่อนร่วมงาน',level:'A2',hint:'A colleague is a person you work with.'},
{id:'wo02',word:'meeting',thai:'การประชุม',level:'A2',hint:'A meeting brings people together to discuss work.'},
{id:'wo03',word:'supervisor',thai:'ผู้ควบคุมงาน',level:'A2+',hint:'A supervisor guides and checks work.'},
{id:'wo04',word:'teamwork',thai:'การทำงานเป็นทีม',level:'A2+',hint:'Teamwork means people cooperate to reach a goal.'},
{id:'wo05',word:'responsibility',thai:'ความรับผิดชอบ',level:'B1',hint:'A responsibility is a duty at work.'},
{id:'wo06',word:'professional',thai:'เป็นมืออาชีพ',level:'B1',hint:'Professional behavior is suitable and responsible at work.'},
{id:'wo07',word:'collaboration',thai:'การทำงานร่วมกัน',level:'B1+',hint:'Collaboration means working together to create a result.'},
{id:'wo08',word:'productivity',thai:'ผลิตภาพ',level:'B1+',hint:'Productivity describes how effectively work is completed.'}
]};
const TH={Academic:'วิชาการ',Research:'การวิจัย',Communication:'การสื่อสาร',Time:'เวลา',Technology:'เทคโนโลยี',Workplace:'การทำงาน'};
const ICON={Academic:'🎓',Research:'🔎',Communication:'💬',Time:'⏱️',Technology:'💻',Workplace:'🏢'};
const ROTATION_CATEGORIES={
P1:['Academic','Research','Communication'],
P2:['Time','Technology','Workplace'],
P3:['Academic','Technology','Workplace'],
P4:['Research','Communication','Time']
};
