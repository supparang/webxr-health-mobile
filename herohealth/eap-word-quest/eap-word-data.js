/* =========================================================
   EAP Word Quest • Academic Vocabulary Mission
   File: /herohealth/eap-word-quest/eap-word-data.js
   Version: v1.4.0-FINAL-ACADEMIC-ARC

   ใช้คู่กับ:
   - index.html
   - eap-word-quest.css
   - eap-word-engine.js

   แนวคิดข้อมูล:
   - Session playable: S1, S2, S4, S5, S7, S8, S10, S11, S13, S14
   - Boss: S3, S6, S9, S12, S15
   - QUESTION_BANK สร้างจาก vocabulary specs
   - 1 word/phrase แตกเป็นหลายรูปแบบ:
     meaning, sentence_fill, collocation, context,
     word_form, near_miss, academic_phrase, academic_upgrade
========================================================= */

"use strict";

/* =========================================================
   App Version
========================================================= */

window.APP_VERSION = "v1.4.0-FINAL-ACADEMIC-ARC";

/* =========================================================
   Session Map
========================================================= */

window.SESSIONS = [
  {
    id:"S1",
    title:"Academic Profile",
    desc:"major, background, skill, interested in, goal",
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
    title:"Boss 1",
    desc:"Academic Profile + Project Introduction",
    status:"boss",
    boss:true
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
    title:"Boss 2",
    desc:"Communication Boss รวมคำจาก S1–S5 โดยเน้น S4–S5",
    status:"boss",
    boss:true
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
    title:"Boss 3",
    desc:"Email & Meeting Boss รวมคำจาก S7–S8",
    status:"boss",
    boss:true
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
    title:"Boss 4",
    desc:"System & Problem Boss รวมคำจาก S10–S11",
    status:"boss",
    boss:true
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
    title:"Final Boss",
    desc:"Final Academic Vocabulary Boss รวมคำศัพท์ทั้งคอร์ส",
    status:"boss",
    boss:true
  }
];

/* =========================================================
   Vocabulary Specs

   field:
   - w: word/phrase
   - th: Thai meaning
   - pos: part of speech / category
   - simple: simple sentence
   - fill: sentence with ______
   - answer: answer for fill
   - collocation: phrase
   - context: context prompt
   - contextAnswer: answer for context
   - academic: correct academic/professional sentence
   - plain: plain English for upgrade
   - upgrade: upgraded academic sentence
   - trapChoices: near-miss/wrong choices
========================================================= */

window.EAP_VOCAB_SPECS = {
  S1: {
    theme:"Academic Profile",
    words:[
      {
        w:"major",
        th:"สาขาวิชา",
        pos:"noun",
        fill:"My ______ is Digital Technology.",
        answer:"major",
        collocation:"academic major",
        context:"A student studies Digital Technology as the main field. This is the student's...",
        contextAnswer:"major",
        academic:"My academic major is related to digital technology and multimedia.",
        plain:"I study Digital Technology.",
        upgrade:"My academic major is Digital Technology.",
        trapChoices:["mayor","majority","measure"]
      },
      {
        w:"background",
        th:"พื้นฐานหรือประวัติด้านการเรียน/ประสบการณ์",
        pos:"noun",
        fill:"My academic ______ is related to IT.",
        answer:"background",
        collocation:"academic background",
        context:"A short profile explains a student's study history and skills. This is the student's...",
        contextAnswer:"academic background",
        academic:"My academic background is related to information technology.",
        plain:"I studied IT before.",
        upgrade:"My academic background is related to information technology.",
        trapChoices:["backpack","backspace","backyard"]
      },
      {
        w:"skill",
        th:"ทักษะ",
        pos:"noun",
        fill:"Communication is an important ______.",
        answer:"skill",
        collocation:"communication skill",
        context:"Coding, teamwork, and presentation are examples of...",
        contextAnswer:"skills",
        academic:"Communication is an important skill for academic and professional contexts.",
        plain:"I can communicate well.",
        upgrade:"I have strong communication skills.",
        trapChoices:["skilled","skillses","skilling"]
      },
      {
        w:"interested in",
        th:"สนใจใน",
        pos:"phrase",
        fill:"I am ______ digital media.",
        answer:"interested in",
        collocation:"interested in technology",
        context:"A student likes AI and wants to learn more about it. The student is...",
        contextAnswer:"interested in AI",
        academic:"I am particularly interested in educational technology.",
        plain:"I like educational technology.",
        upgrade:"I am particularly interested in educational technology.",
        trapChoices:["interesting in","interest on","interested at"]
      },
      {
        w:"goal",
        th:"เป้าหมาย",
        pos:"noun",
        fill:"My learning ______ is to improve academic English.",
        answer:"goal",
        collocation:"learning goal",
        context:"A student wants to improve English speaking by the end of the course. This is a...",
        contextAnswer:"learning goal",
        academic:"My learning goal is to improve my academic communication skills.",
        plain:"I want to speak English better.",
        upgrade:"I aim to improve my English communication skills.",
        trapChoices:["gold","goat","goalkeeper"]
      },
      {
        w:"experience",
        th:"ประสบการณ์",
        pos:"noun",
        fill:"I have ______ in using design tools.",
        answer:"experience",
        collocation:"project experience",
        context:"A student has used Canva and Figma in previous projects. The student has...",
        contextAnswer:"design experience",
        academic:"I have experience in using digital design tools for class projects.",
        plain:"I used design tools before.",
        upgrade:"I have experience in using digital design tools.",
        trapChoices:["experienced","experiment","expert"]
      },
      {
        w:"strength",
        th:"จุดแข็ง",
        pos:"noun",
        fill:"One of my ______ is teamwork.",
        answer:"strengths",
        collocation:"key strength",
        context:"A student is good at working with others. This ability is a...",
        contextAnswer:"strength",
        academic:"One of my key strengths is the ability to work collaboratively.",
        plain:"I work well with people.",
        upgrade:"One of my key strengths is teamwork.",
        trapChoices:["strong","strengthen","strict"]
      },
      {
        w:"presentation",
        th:"การนำเสนอ",
        pos:"noun",
        fill:"I will give a short ______ about my project.",
        answer:"presentation",
        collocation:"give a presentation",
        context:"A student speaks in front of the class with slides. This activity is a...",
        contextAnswer:"presentation",
        academic:"The presentation introduces my academic background and learning goals.",
        plain:"I will talk about my project.",
        upgrade:"I will give a short presentation about my project.",
        trapChoices:["present","presenter","presenting"]
      },
      {
        w:"collaborate",
        th:"ร่วมมือกัน",
        pos:"verb",
        fill:"Students ______ with team members on a project.",
        answer:"collaborate",
        collocation:"collaborate with team members",
        context:"Students work together to finish a group project. They...",
        contextAnswer:"collaborate",
        academic:"Students should collaborate effectively during group projects.",
        plain:"Students work together.",
        upgrade:"Students work collaboratively on group projects.",
        trapChoices:["collaboration","collaborative","collaboratively"]
      },
      {
        w:"learning progress",
        th:"ความก้าวหน้าในการเรียนรู้",
        pos:"noun phrase",
        fill:"The system shows students’ ______ after each mission.",
        answer:"learning progress",
        collocation:"track learning progress",
        context:"The app shows XP, accuracy, and mastered words. It tracks...",
        contextAnswer:"learning progress",
        academic:"The system allows students to monitor their learning progress.",
        plain:"Students can see how much they improved.",
        upgrade:"Students can monitor their learning progress.",
        trapChoices:["learning process","learn progress","progress learning"]
      }
    ]
  },

  S2: {
    theme:"Project Introduction",
    words:[
      {
        w:"project",
        th:"โครงการหรือชิ้นงาน",
        pos:"noun",
        fill:"This ______ aims to support vocabulary learning.",
        answer:"project",
        collocation:"class project",
        context:"Students design an app and present it to the class. This work is a...",
        contextAnswer:"project",
        academic:"This project aims to support repeated EAP vocabulary practice.",
        plain:"This work helps students learn words.",
        upgrade:"This project supports students’ EAP vocabulary learning.",
        trapChoices:["product","protect","process"]
      },
      {
        w:"objective",
        th:"วัตถุประสงค์",
        pos:"noun",
        fill:"The main ______ is to improve vocabulary practice.",
        answer:"objective",
        collocation:"project objective",
        context:"A sentence explains what the project wants to achieve. This is the...",
        contextAnswer:"objective",
        academic:"The main objective of this project is to support vocabulary practice.",
        plain:"The project wants students to practice words.",
        upgrade:"The main objective of this project is to support vocabulary practice.",
        trapChoices:["object","objection","observe"]
      },
      {
        w:"purpose",
        th:"จุดประสงค์",
        pos:"noun",
        fill:"The ______ of the app is to help students practice.",
        answer:"purpose",
        collocation:"purpose of the project",
        context:"A project description explains why the app was created. It explains the...",
        contextAnswer:"purpose",
        academic:"The purpose of this project is to improve students’ ability to use EAP vocabulary.",
        plain:"The app is for learning words.",
        upgrade:"The purpose of the application is to support vocabulary learning.",
        trapChoices:["proposal","process","purchase"]
      },
      {
        w:"feature",
        th:"ฟีเจอร์หรือคุณสมบัติ",
        pos:"noun",
        fill:"A leaderboard is one ______ of the game.",
        answer:"feature",
        collocation:"main feature",
        context:"A badge system, timer, and dashboard are parts of an app. They are...",
        contextAnswer:"features",
        academic:"The application includes several features, such as missions, feedback, and a word deck.",
        plain:"The app has many things.",
        upgrade:"The application includes several learning features.",
        trapChoices:["future","figure","failure"]
      },
      {
        w:"function",
        th:"ฟังก์ชันหรือหน้าที่การทำงาน",
        pos:"noun",
        fill:"The main ______ of the app is vocabulary practice.",
        answer:"function",
        collocation:"main function",
        context:"A button lets users start a session. This is one app...",
        contextAnswer:"function",
        academic:"The main function of the application is to provide vocabulary missions.",
        plain:"The app lets students practice.",
        upgrade:"The main function of the application is vocabulary practice.",
        trapChoices:["functional","functioning","fiction"]
      },
      {
        w:"user",
        th:"ผู้ใช้",
        pos:"noun",
        fill:"The ______ can select a session.",
        answer:"user",
        collocation:"target user",
        context:"Students who play the app are the...",
        contextAnswer:"users",
        academic:"The target users are students who need repeated vocabulary practice.",
        plain:"Students use the app.",
        upgrade:"The target users are students in an EAP course.",
        trapChoices:["usage","useful","using"]
      },
      {
        w:"problem",
        th:"ปัญหา",
        pos:"noun",
        fill:"The project addresses the ______ of limited vocabulary review.",
        answer:"problem",
        collocation:"research problem",
        context:"Students often forget academic words after class. This is a learning...",
        contextAnswer:"problem",
        academic:"The project addresses the problem of limited vocabulary practice.",
        plain:"Students do not practice enough.",
        upgrade:"The project addresses limited opportunities for vocabulary review.",
        trapChoices:["program","process","proposal"]
      },
      {
        w:"solution",
        th:"วิธีแก้ปัญหา",
        pos:"noun",
        fill:"A possible ______ is a game-based vocabulary app.",
        answer:"solution",
        collocation:"possible solution",
        context:"An app is designed to solve a learning problem. The app is a...",
        contextAnswer:"solution",
        academic:"The proposed solution is a game-based vocabulary learning application.",
        plain:"The app fixes the problem.",
        upgrade:"The proposed solution is a vocabulary learning game.",
        trapChoices:["selection","situation","simulation"]
      },
      {
        w:"prototype",
        th:"ต้นแบบ",
        pos:"noun",
        fill:"Students created a ______ to test their project idea.",
        answer:"prototype",
        collocation:"prototype testing",
        context:"A first version of an app is made for testing. It is a...",
        contextAnswer:"prototype",
        academic:"The prototype was developed to test the basic concept of the vocabulary game.",
        plain:"Students made the first version.",
        upgrade:"Students developed a prototype to test the project concept.",
        trapChoices:["phototype","proposal","productivity"]
      },
      {
        w:"feedback",
        th:"ข้อเสนอแนะหรือผลตอบกลับ",
        pos:"noun",
        fill:"The teacher gave useful ______ to improve the project.",
        answer:"feedback",
        collocation:"user feedback",
        context:"Users give comments after trying the app. These comments are...",
        contextAnswer:"feedback",
        academic:"User feedback can be used to improve the design and usability of the application.",
        plain:"Users tell us what to improve.",
        upgrade:"User feedback can improve the application design.",
        trapChoices:["feed back","feedbacks","feeding"]
      },
      {
        w:"educational benefit",
        th:"ประโยชน์ทางการศึกษา",
        pos:"noun phrase",
        fill:"Repeated practice is an important ______.",
        answer:"educational benefit",
        collocation:"educational benefit",
        context:"The game helps students review words many times. This is an...",
        contextAnswer:"educational benefit",
        academic:"The game provides educational benefits by supporting repeated vocabulary practice.",
        plain:"The game is good for learning.",
        upgrade:"The game provides educational benefits for vocabulary learning.",
        trapChoices:["education benefit","educational problem","benefit education"]
      }
    ]
  },

  S4: {
    theme:"Tech Jobs / Careers",
    words:[
      {
        w:"developer",
        th:"นักพัฒนา",
        pos:"noun",
        fill:"A software ______ creates applications.",
        answer:"developer",
        collocation:"software developer",
        context:"A person who writes and tests code is a...",
        contextAnswer:"software developer",
        academic:"A software developer is responsible for designing, coding, and maintaining applications.",
        plain:"A developer writes code.",
        upgrade:"A software developer develops and maintains applications.",
        trapChoices:["development","developing","developed"]
      },
      {
        w:"designer",
        th:"นักออกแบบ",
        pos:"noun",
        fill:"A UI ______ creates screens and buttons.",
        answer:"designer",
        collocation:"UI designer",
        context:"A person who designs screens, buttons, and layouts is a...",
        contextAnswer:"UI designer",
        academic:"A UI designer collaborates with developers to improve the user interface.",
        plain:"A designer makes screens.",
        upgrade:"A UI designer creates user interface layouts.",
        trapChoices:["design","designed","designing"]
      },
      {
        w:"analyst",
        th:"นักวิเคราะห์",
        pos:"noun",
        fill:"A data ______ studies information to find patterns.",
        answer:"analyst",
        collocation:"data analyst",
        context:"A person who studies data and explains patterns is a...",
        contextAnswer:"data analyst",
        academic:"A data analyst interprets data to support decision-making.",
        plain:"An analyst studies data.",
        upgrade:"A data analyst analyzes data to support decisions.",
        trapChoices:["analysis","analyze","analytical"]
      },
      {
        w:"engineer",
        th:"วิศวกร",
        pos:"noun",
        fill:"An AI ______ develops intelligent systems.",
        answer:"engineer",
        collocation:"AI engineer",
        context:"A person who builds machine learning systems is an...",
        contextAnswer:"AI engineer",
        academic:"An AI engineer develops intelligent systems and evaluates model performance.",
        plain:"An AI engineer builds AI.",
        upgrade:"An AI engineer develops intelligent systems.",
        trapChoices:["engine","engineering","engineered"]
      },
      {
        w:"technical skills",
        th:"ทักษะทางเทคนิค",
        pos:"noun phrase",
        fill:"Coding is one of the important ______.",
        answer:"technical skills",
        collocation:"technical skills",
        context:"Programming, database use, and debugging are examples of...",
        contextAnswer:"technical skills",
        academic:"This career requires both technical skills and communication skills.",
        plain:"I can code and use databases.",
        upgrade:"I have technical skills in programming and database management.",
        trapChoices:["technology skills","technician skills","technical skillful"]
      },
      {
        w:"responsibility",
        th:"ความรับผิดชอบ",
        pos:"noun",
        fill:"Testing the app is one ______ of the developer.",
        answer:"responsibility",
        collocation:"job responsibility",
        context:"Writing code and fixing bugs are tasks a developer must do. They are job...",
        contextAnswer:"responsibilities",
        academic:"One responsibility of a developer is to test the application.",
        plain:"A developer must test the app.",
        upgrade:"One responsibility of a developer is application testing.",
        trapChoices:["responsible","response","responsibly"]
      },
      {
        w:"requirement",
        th:"ข้อกำหนดหรือคุณสมบัติที่จำเป็น",
        pos:"noun",
        fill:"English communication is an important job ______.",
        answer:"requirement",
        collocation:"job requirement",
        context:"A company says applicants must know JavaScript. This is a...",
        contextAnswer:"job requirement",
        academic:"The job requirements include programming skills, teamwork, and English communication.",
        plain:"The job needs English and coding.",
        upgrade:"The job requirements include English communication and coding skills.",
        trapChoices:["require","required","request"]
      },
      {
        w:"career path",
        th:"เส้นทางอาชีพ",
        pos:"noun phrase",
        fill:"AI development can be a future ______.",
        answer:"career path",
        collocation:"future career path",
        context:"A student plans to work in AI after graduation. This is a...",
        contextAnswer:"career path",
        academic:"My future career path is related to artificial intelligence development.",
        plain:"I want to work with AI in the future.",
        upgrade:"My future career path is related to AI development.",
        trapChoices:["carrier path","career part","carry path"]
      },
      {
        w:"collaborate",
        th:"ร่วมมือกัน",
        pos:"verb",
        fill:"Developers ______ with designers in a project team.",
        answer:"collaborate",
        collocation:"collaborate with developers",
        context:"Team members work together to complete a software project. They...",
        contextAnswer:"collaborate",
        academic:"Team members work collaboratively to complete the software project.",
        plain:"People in the team work together.",
        upgrade:"Team members work collaboratively.",
        trapChoices:["collaboration","collaborative","collaboratively"]
      },
      {
        w:"decision-making",
        th:"การตัดสินใจ",
        pos:"noun",
        fill:"Data can support business ______.",
        answer:"decision-making",
        collocation:"support decision-making",
        context:"A report helps managers choose a better solution. It supports...",
        contextAnswer:"decision-making",
        academic:"Data analysis can support decision-making in organizations.",
        plain:"Data helps people decide.",
        upgrade:"Data analysis supports decision-making.",
        trapChoices:["decision make","decision made","decide-making"]
      }
    ]
  },

  S5: {
    theme:"Workplace Communication",
    words:[
      {
        w:"request",
        th:"ร้องขอ",
        pos:"verb/noun",
        fill:"I would like to ______ more information.",
        answer:"request",
        collocation:"request information",
        context:"You politely ask for more details. You make a...",
        contextAnswer:"request",
        academic:"I would like to request additional information about the assignment.",
        plain:"I want more information.",
        upgrade:"I would like to request additional information.",
        trapChoices:["require","response","receive"]
      },
      {
        w:"clarify",
        th:"ทำให้ชัดเจน",
        pos:"verb",
        fill:"Could you ______ the deadline, please?",
        answer:"clarify",
        collocation:"clarify the deadline",
        context:"You do not understand the task and ask for more explanation. You ask someone to...",
        contextAnswer:"clarify",
        academic:"Could you please clarify the project requirements?",
        plain:"I don't understand the task.",
        upgrade:"Could you please clarify the task requirements?",
        trapChoices:["clarification","clearify","classify"]
      },
      {
        w:"confirm",
        th:"ยืนยัน",
        pos:"verb",
        fill:"Please ______ the meeting time.",
        answer:"confirm",
        collocation:"confirm the schedule",
        context:"You ask whether the deadline is Friday. You ask someone to...",
        contextAnswer:"confirm",
        academic:"Could you please confirm whether the deadline is Friday?",
        plain:"Is the deadline Friday?",
        upgrade:"Could you please confirm whether the deadline is Friday?",
        trapChoices:["conform","perform","inform"]
      },
      {
        w:"update",
        th:"อัปเดตหรือแจ้งความคืบหน้า",
        pos:"verb/noun",
        fill:"Can you ______ me on the project progress?",
        answer:"update",
        collocation:"update someone on progress",
        context:"Your teammate wants to know what has been completed. You should...",
        contextAnswer:"update the teammate",
        academic:"Could you please update me on the project progress?",
        plain:"What happened with the project?",
        upgrade:"Could you please update me on the project progress?",
        trapChoices:["upload","upgrade","updating"]
      },
      {
        w:"explain",
        th:"อธิบาย",
        pos:"verb",
        fill:"Could you ______ the problem again?",
        answer:"explain",
        collocation:"explain the problem",
        context:"Someone does not understand the issue. You describe it clearly. You...",
        contextAnswer:"explain",
        academic:"Could you please explain the issue in more detail?",
        plain:"Tell me about the problem.",
        upgrade:"Could you please explain the issue in more detail?",
        trapChoices:["explanation","explained","explaining"]
      },
      {
        w:"deadline",
        th:"กำหนดส่ง",
        pos:"noun",
        fill:"The project ______ is next Monday.",
        answer:"deadline",
        collocation:"meet the deadline",
        context:"A team must submit the work by Friday. Friday is the...",
        contextAnswer:"deadline",
        academic:"Could you please confirm the submission deadline?",
        plain:"When do we send it?",
        upgrade:"Could you please confirm the submission deadline?",
        trapChoices:["dead line","timeline","headline"]
      },
      {
        w:"available",
        th:"ว่างหรือพร้อมใช้งาน",
        pos:"adjective",
        fill:"Are you ______ for a short meeting today?",
        answer:"available",
        collocation:"available for a meeting",
        context:"You want to ask if someone has time for a meeting. You ask about their...",
        contextAnswer:"availability",
        academic:"Please let me know if you are available for a meeting.",
        plain:"Are you free for a meeting?",
        upgrade:"Please let me know if you are available for a meeting.",
        trapChoices:["availability","availably","valuable"]
      },
      {
        w:"issue",
        th:"ปัญหาหรือประเด็น",
        pos:"noun",
        fill:"We need to discuss this technical ______.",
        answer:"issue",
        collocation:"technical issue",
        context:"The login button does not work. This is a...",
        contextAnswer:"technical issue",
        academic:"The team needs to discuss the technical issue before the deadline.",
        plain:"There is a problem with the app.",
        upgrade:"There is a technical issue with the application.",
        trapChoices:["tissue","assign","assist"]
      },
      {
        w:"suggest",
        th:"เสนอแนะ",
        pos:"verb",
        fill:"I would like to ______ a different solution.",
        answer:"suggest",
        collocation:"suggest a solution",
        context:"A teammate reports a problem. You give an idea to fix it. You...",
        contextAnswer:"suggest a solution",
        academic:"I would like to suggest an alternative solution.",
        plain:"I have another idea.",
        upgrade:"I would like to suggest an alternative solution.",
        trapChoices:["suggestion","suggested","suggesting"]
      },
      {
        w:"appreciate",
        th:"ขอบคุณหรือซาบซึ้ง",
        pos:"verb",
        fill:"I would ______ your help with this issue.",
        answer:"appreciate",
        collocation:"appreciate your feedback",
        context:"You politely thank someone for help or feedback. You say you...",
        contextAnswer:"appreciate it",
        academic:"I would appreciate it if you could provide feedback.",
        plain:"Please give me feedback.",
        upgrade:"I would appreciate it if you could provide feedback.",
        trapChoices:["appreciation","appreciated","appropriate"]
      }
    ]
  },

  S7: {
    theme:"Professional Email",
    words:[
      {
        w:"subject",
        th:"หัวข้ออีเมล",
        pos:"noun",
        fill:"Please write a clear email ______.",
        answer:"subject",
        collocation:"email subject",
        context:"The line that tells what an email is about is the...",
        contextAnswer:"subject",
        academic:"The email subject should be clear and specific.",
        plain:"The email title should be clear.",
        upgrade:"The email subject should be clear and specific.",
        trapChoices:["object","project","reject"]
      },
      {
        w:"attachment",
        th:"ไฟล์แนบ",
        pos:"noun",
        fill:"Please find the ______ file.",
        answer:"attached",
        collocation:"attached file",
        context:"A document sent together with an email is an...",
        contextAnswer:"attachment",
        academic:"Please find attached my project report.",
        plain:"I sent the report file.",
        upgrade:"Please find attached my project report.",
        trapChoices:["attach","attachment file","attacheded"]
      },
      {
        w:"inquiry",
        th:"การสอบถาม",
        pos:"noun",
        fill:"I am writing to make an ______ about the assignment.",
        answer:"inquiry",
        collocation:"make an inquiry",
        context:"You formally ask about a deadline. This email is an...",
        contextAnswer:"inquiry",
        academic:"I am writing to inquire about the project submission deadline.",
        plain:"I want to ask about the deadline.",
        upgrade:"I am writing to inquire about the submission deadline.",
        trapChoices:["inquire","inquired","require"]
      },
      {
        w:"response",
        th:"การตอบกลับ",
        pos:"noun",
        fill:"Thank you for your quick ______.",
        answer:"response",
        collocation:"quick response",
        context:"A teacher answers your email quickly. You thank them for their...",
        contextAnswer:"response",
        academic:"Thank you for your prompt response.",
        plain:"Thanks for replying quickly.",
        upgrade:"Thank you for your prompt response.",
        trapChoices:["respond","responsible","responsibility"]
      },
      {
        w:"recipient",
        th:"ผู้รับ",
        pos:"noun",
        fill:"The ______ of the email is the project advisor.",
        answer:"recipient",
        collocation:"email recipient",
        context:"The person who receives an email is the...",
        contextAnswer:"recipient",
        academic:"The recipient should be addressed politely in a professional email.",
        plain:"The teacher receives the email.",
        upgrade:"The recipient of the email is the project advisor.",
        trapChoices:["receiver only","sender","receipt"]
      },
      {
        w:"greeting",
        th:"คำขึ้นต้นทักทาย",
        pos:"noun",
        fill:"“Dear Professor,” is an email ______.",
        answer:"greeting",
        collocation:"formal greeting",
        context:"The first polite line of an email is a...",
        contextAnswer:"greeting",
        academic:"A professional email should begin with an appropriate greeting.",
        plain:"Start the email politely.",
        upgrade:"Begin the email with an appropriate greeting.",
        trapChoices:["closing","heading","meeting"]
      },
      {
        w:"closing",
        th:"คำลงท้าย",
        pos:"noun",
        fill:"“Best regards,” is an email ______.",
        answer:"closing",
        collocation:"formal closing",
        context:"The final polite phrase before your name is the...",
        contextAnswer:"closing",
        academic:"A formal closing, such as Best regards, is appropriate for professional emails.",
        plain:"End the email politely.",
        upgrade:"Use a formal closing such as Best regards.",
        trapChoices:["greeting","subject","opening"]
      },
      {
        w:"regarding",
        th:"เกี่ยวกับ",
        pos:"preposition",
        fill:"I am writing ______ the project deadline.",
        answer:"regarding",
        collocation:"regarding the assignment",
        context:"A formal word that means about is...",
        contextAnswer:"regarding",
        academic:"I have a question regarding the assignment requirements.",
        plain:"I have a question about the assignment.",
        upgrade:"I have a question regarding the assignment requirements.",
        trapChoices:["regard","regarded","according"]
      },
      {
        w:"submit",
        th:"ส่งงานหรือยื่นเอกสาร",
        pos:"verb",
        fill:"I would like to ______ my project report.",
        answer:"submit",
        collocation:"submit a report",
        context:"A student sends an assignment to the teacher. The student...",
        contextAnswer:"submits the report",
        academic:"I would like to submit my project report for your review.",
        plain:"I want to send my report.",
        upgrade:"I would like to submit my project report.",
        trapChoices:["submission","submitted","submitting"]
      },
      {
        w:"apologize",
        th:"ขอโทษ",
        pos:"verb",
        fill:"I ______ for the late reply.",
        answer:"apologize",
        collocation:"apologize for the delay",
        context:"A student replies late and says sorry politely. The student...",
        contextAnswer:"apologizes",
        academic:"I apologize for the delayed response.",
        plain:"Sorry for replying late.",
        upgrade:"I apologize for the delayed response.",
        trapChoices:["apology","apologizing","apologized"]
      }
    ]
  },

  S8: {
    theme:"Meeting / Discussion",
    words:[
      {
        w:"agenda",
        th:"วาระหรือหัวข้อการประชุม",
        pos:"noun",
        fill:"The first item on the meeting ______ is project progress.",
        answer:"agenda",
        collocation:"meeting agenda",
        context:"A list of topics for a meeting is an...",
        contextAnswer:"agenda",
        academic:"The meeting agenda includes project progress and user feedback.",
        plain:"The meeting has three topics.",
        upgrade:"The meeting agenda includes three main topics.",
        trapChoices:["agent","gender","engine"]
      },
      {
        w:"opinion",
        th:"ความคิดเห็น",
        pos:"noun",
        fill:"In my ______, the app should have a simple interface.",
        answer:"opinion",
        collocation:"give an opinion",
        context:"A student says what they think about the design. This is an...",
        contextAnswer:"opinion",
        academic:"In my opinion, the design is appropriate for mobile users.",
        plain:"I think the design is good.",
        upgrade:"In my opinion, the design is appropriate for mobile users.",
        trapChoices:["option","operation","opportunity"]
      },
      {
        w:"suggest",
        th:"เสนอแนะ",
        pos:"verb",
        fill:"I would like to ______ a new feature.",
        answer:"suggest",
        collocation:"suggest an idea",
        context:"A team member proposes adding progress tracking. The member...",
        contextAnswer:"suggests an idea",
        academic:"I would like to suggest that we improve the user interface.",
        plain:"We should make the menu clearer.",
        upgrade:"I would like to suggest that we make the navigation menu clearer.",
        trapChoices:["suggestion","suggested","suggesting"]
      },
      {
        w:"decision",
        th:"การตัดสินใจ",
        pos:"noun",
        fill:"The team made a ______ about the design.",
        answer:"decision",
        collocation:"make a decision",
        context:"After discussion, the team chooses one design. The team makes a...",
        contextAnswer:"decision",
        academic:"The team decided to revise the prototype before the presentation.",
        plain:"The team chose to revise it.",
        upgrade:"The team decided to revise the prototype.",
        trapChoices:["decide","decisive","deciding"]
      },
      {
        w:"agree",
        th:"เห็นด้วย",
        pos:"verb",
        fill:"I ______ with your idea.",
        answer:"agree",
        collocation:"agree with a point",
        context:"A student supports another student's recommendation. The student...",
        contextAnswer:"agrees",
        academic:"I agree with this point because it improves user experience.",
        plain:"I think your idea is right.",
        upgrade:"I agree with this point because it improves user experience.",
        trapChoices:["agreement","agreed","agreeing"]
      },
      {
        w:"disagree",
        th:"ไม่เห็นด้วย",
        pos:"verb",
        fill:"I respectfully ______ with this point.",
        answer:"disagree",
        collocation:"respectfully disagree",
        context:"A student does not support an idea but wants to be polite. The student...",
        contextAnswer:"respectfully disagrees",
        academic:"I respectfully disagree because the timeline may be too limited.",
        plain:"I don't think this is a good idea.",
        upgrade:"I respectfully disagree because the timeline may be too limited.",
        trapChoices:["agreement","disagreement","agree"]
      },
      {
        w:"concern",
        th:"ข้อกังวล",
        pos:"noun",
        fill:"One ______ is the limited time for testing.",
        answer:"concern",
        collocation:"main concern",
        context:"A student worries about the limited testing time. This is a...",
        contextAnswer:"concern",
        academic:"The main concern is the limited time for user testing.",
        plain:"I am worried about the testing time.",
        upgrade:"The main concern is the limited time for user testing.",
        trapChoices:["concert","confirm","condition"]
      },
      {
        w:"recommendation",
        th:"ข้อเสนอแนะ",
        pos:"noun",
        fill:"My ______ is to improve the navigation menu.",
        answer:"recommendation",
        collocation:"make a recommendation",
        context:"A student suggests improving the feedback system. This suggestion is a...",
        contextAnswer:"recommendation",
        academic:"My recommendation is to improve the feedback system.",
        plain:"I think we should improve feedback.",
        upgrade:"My recommendation is to improve the feedback system.",
        trapChoices:["recommend","recommended","recommending"]
      },
      {
        w:"summary",
        th:"สรุป",
        pos:"noun",
        fill:"Could you give a short ______ of the discussion?",
        answer:"summary",
        collocation:"meeting summary",
        context:"At the end, a member explains the main points. This is a...",
        contextAnswer:"summary",
        academic:"To summarize, the team agreed to revise the prototype.",
        plain:"In short, we will revise it.",
        upgrade:"To summarize, the team agreed to revise the prototype.",
        trapChoices:["summarize","summarized","summer"]
      },
      {
        w:"action item",
        th:"งานที่ต้องทำหลังประชุม",
        pos:"noun phrase",
        fill:"The ______ is to revise the login screen by Friday.",
        answer:"action item",
        collocation:"meeting action item",
        context:"A task assigned after a meeting is an...",
        contextAnswer:"action item",
        academic:"The action item is to revise the login screen by Friday.",
        plain:"We need to fix the login screen by Friday.",
        upgrade:"The action item is to revise the login screen by Friday.",
        trapChoices:["active item","action idea","acting item"]
      }
    ]
  },

  S10: {
    theme:"System Explanation",
    words:[
      {
        w:"system",
        th:"ระบบ",
        pos:"noun",
        fill:"The ______ records students’ scores.",
        answer:"system",
        collocation:"learning system",
        context:"An app with screens, data, buttons, and rules is a...",
        contextAnswer:"system",
        academic:"The system allows users to select a session and track their progress.",
        plain:"The app records scores.",
        upgrade:"The system records students’ scores.",
        trapChoices:["sustain","symbol","syllabus"]
      },
      {
        w:"function",
        th:"ฟังก์ชันหรือหน้าที่การทำงาน",
        pos:"noun",
        fill:"The main ______ is to show learning progress.",
        answer:"function",
        collocation:"main function",
        context:"The app can save weak words. This ability is a...",
        contextAnswer:"function",
        academic:"The main function of the system is to support repeated vocabulary practice.",
        plain:"The app helps students practice.",
        upgrade:"The main function is to support vocabulary practice.",
        trapChoices:["functional","functioning","fiction"]
      },
      {
        w:"process",
        th:"กระบวนการ",
        pos:"noun",
        fill:"The login ______ starts when users enter their ID.",
        answer:"process",
        collocation:"login process",
        context:"First enter ID, then choose session, then answer questions. This is a...",
        contextAnswer:"process",
        academic:"The workflow includes login, gameplay, and summary review.",
        plain:"First login, then play, then see score.",
        upgrade:"The workflow includes login, gameplay, and summary review.",
        trapChoices:["progress","proposal","purpose"]
      },
      {
        w:"input",
        th:"ข้อมูลที่ป้อนเข้า",
        pos:"noun",
        fill:"The user ______ is the student ID.",
        answer:"input",
        collocation:"user input",
        context:"A student types their ID into the form. This is...",
        contextAnswer:"user input",
        academic:"Students enter their ID as user input.",
        plain:"Students type their ID.",
        upgrade:"Students enter their ID as user input.",
        trapChoices:["impact","import","income"]
      },
      {
        w:"output",
        th:"ผลลัพธ์ที่แสดงออกมา",
        pos:"noun",
        fill:"The final score is the system ______.",
        answer:"output",
        collocation:"system output",
        context:"After a round, the app shows XP and accuracy. This is...",
        contextAnswer:"output",
        academic:"The application displays the learner’s score on the summary page.",
        plain:"The app shows the score.",
        upgrade:"The application displays the learner’s score on the summary page.",
        trapChoices:["outcome","outfit","outlet"]
      },
      {
        w:"interface",
        th:"ส่วนติดต่อผู้ใช้",
        pos:"noun",
        fill:"A simple ______ helps users play easily.",
        answer:"interface",
        collocation:"user interface",
        context:"Users click buttons and select options on the screen. This part is the...",
        contextAnswer:"user interface",
        academic:"A user-friendly interface helps learners complete tasks efficiently.",
        plain:"A simple screen helps users.",
        upgrade:"A user-friendly interface helps learners complete tasks efficiently.",
        trapChoices:["interference","internet face","interaction"]
      },
      {
        w:"display",
        th:"แสดงผล",
        pos:"verb",
        fill:"The app can ______ the correct answer.",
        answer:"display",
        collocation:"display results",
        context:"The summary page shows score and accuracy. It...",
        contextAnswer:"displays results",
        academic:"After each answer, the system displays immediate feedback.",
        plain:"The app shows feedback.",
        upgrade:"The system displays immediate feedback.",
        trapChoices:["delete","deploy","describe"]
      },
      {
        w:"select",
        th:"เลือก",
        pos:"verb",
        fill:"Users can ______ the difficulty level.",
        answer:"select",
        collocation:"select an option",
        context:"A student chooses S1 from the menu. The student...",
        contextAnswer:"selects an option",
        academic:"The interface allows users to select a session.",
        plain:"Users choose a session.",
        upgrade:"The interface allows users to select a session.",
        trapChoices:["selection","selected","selector"]
      },
      {
        w:"data storage",
        th:"การจัดเก็บข้อมูล",
        pos:"noun phrase",
        fill:"localStorage is used for ______.",
        answer:"data storage",
        collocation:"local data storage",
        context:"The app keeps scores and weak words in the browser. This is...",
        contextAnswer:"data storage",
        academic:"The system stores data locally in the user’s browser.",
        plain:"The app saves data in the browser.",
        upgrade:"The system stores data locally in the user’s browser.",
        trapChoices:["data story","data stored","storage data"]
      },
      {
        w:"feedback",
        th:"ผลตอบกลับ",
        pos:"noun",
        fill:"The system provides immediate ______ after each answer.",
        answer:"feedback",
        collocation:"immediate feedback",
        context:"After answering, the app says why the answer is correct. This is...",
        contextAnswer:"feedback",
        academic:"The system provides immediate feedback to support vocabulary learning.",
        plain:"The app tells students if they are right.",
        upgrade:"The system provides immediate feedback.",
        trapChoices:["feed back","feedbacks","feeding"]
      }
    ]
  },

  S11: {
    theme:"Bug Report / Problem Solving",
    words:[
      {
        w:"bug",
        th:"ข้อผิดพลาดของระบบ",
        pos:"noun",
        fill:"There is a ______ in the login page.",
        answer:"bug",
        collocation:"report a bug",
        context:"The Continue button does not work. This software problem is a...",
        contextAnswer:"bug",
        academic:"The Continue button does not respond when users click it.",
        plain:"The button does not work.",
        upgrade:"The Continue button does not respond when users click it.",
        trapChoices:["bag","buggy","debug"]
      },
      {
        w:"error",
        th:"ข้อผิดพลาด",
        pos:"noun",
        fill:"The system shows an ______ message.",
        answer:"error",
        collocation:"error message",
        context:"A warning appears when something goes wrong. It is an...",
        contextAnswer:"error message",
        academic:"The system displays an error message after the user clicks Continue.",
        plain:"The app shows an error.",
        upgrade:"The system displays an error message.",
        trapChoices:["error massage","era","arrow"]
      },
      {
        w:"issue",
        th:"ปัญหาหรือประเด็น",
        pos:"noun",
        fill:"The button has a technical ______.",
        answer:"issue",
        collocation:"technical issue",
        context:"The problem occurs on mobile devices. This problem is an...",
        contextAnswer:"issue",
        academic:"The issue occurs when users click the Continue button.",
        plain:"The problem happens when users click Continue.",
        upgrade:"The issue occurs when users click the Continue button.",
        trapChoices:["tissue","assign","assist"]
      },
      {
        w:"reproduce",
        th:"ทำให้เกิดซ้ำ",
        pos:"verb",
        fill:"The developer can ______ the issue on mobile.",
        answer:"reproduce",
        collocation:"steps to reproduce",
        context:"A developer follows the same steps and sees the same bug. The developer can...",
        contextAnswer:"reproduce the issue",
        academic:"The issue can be reproduced by opening the page on a mobile device.",
        plain:"I can make the problem happen again.",
        upgrade:"I can reproduce the issue by following the same steps.",
        trapChoices:["reproduction","reproduced","produce"]
      },
      {
        w:"expected result",
        th:"ผลลัพธ์ที่ควรเกิดขึ้น",
        pos:"noun phrase",
        fill:"The ______ is that the next page should load.",
        answer:"expected result",
        collocation:"expected result",
        context:"The app should go to the next page after clicking Continue. This is the...",
        contextAnswer:"expected result",
        academic:"The expected result is that the next page should load correctly.",
        plain:"The next page should open.",
        upgrade:"The expected result is that the next page should load correctly.",
        trapChoices:["expect result","expectation result","actual result"]
      },
      {
        w:"actual result",
        th:"ผลลัพธ์ที่เกิดขึ้นจริง",
        pos:"noun phrase",
        fill:"The ______ is that the page remains unchanged.",
        answer:"actual result",
        collocation:"actual result",
        context:"The app stays on the same page after clicking Continue. This is the...",
        contextAnswer:"actual result",
        academic:"The actual result is that the page remains unchanged.",
        plain:"The page does not change.",
        upgrade:"The actual result is that the page remains unchanged.",
        trapChoices:["actually result","action result","expected result"]
      },
      {
        w:"solution",
        th:"วิธีแก้ปัญหา",
        pos:"noun",
        fill:"A possible ______ is to update the code.",
        answer:"solution",
        collocation:"possible solution",
        context:"A team updates the event listener to fix a bug. This update is a...",
        contextAnswer:"solution",
        academic:"A possible solution is to update the event listener for the Continue button.",
        plain:"We should update the button code.",
        upgrade:"A possible solution is to update the event listener.",
        trapChoices:["solve","solved","solving"]
      },
      {
        w:"troubleshooting",
        th:"การวิเคราะห์และแก้ปัญหา",
        pos:"noun",
        fill:"Testing different solutions is part of ______.",
        answer:"troubleshooting",
        collocation:"technical troubleshooting",
        context:"A developer checks causes and tries fixes. This process is...",
        contextAnswer:"troubleshooting",
        academic:"Troubleshooting helps the team identify and resolve technical issues.",
        plain:"The team tests ways to fix the problem.",
        upgrade:"The team conducts troubleshooting to resolve the issue.",
        trapChoices:["trouble shooting","problem shooting","troubleshot"]
      },
      {
        w:"resolved",
        th:"ได้รับการแก้ไขแล้ว",
        pos:"verb/adjective",
        fill:"The issue was ______ after updating the code.",
        answer:"resolved",
        collocation:"issue was resolved",
        context:"After the code update, the bug no longer appears. The issue was...",
        contextAnswer:"resolved",
        academic:"The issue was resolved after updating the JavaScript code.",
        plain:"The problem was fixed.",
        upgrade:"The issue was resolved after updating the code.",
        trapChoices:["resolution","resolve","resolving"]
      },
      {
        w:"performance",
        th:"ประสิทธิภาพการทำงาน",
        pos:"noun",
        fill:"The update improved the app’s ______.",
        answer:"performance",
        collocation:"app performance",
        context:"After optimization, the app loads faster. Its...",
        contextAnswer:"performance improved",
        academic:"The update improved the application’s performance on mobile devices.",
        plain:"The app became faster.",
        upgrade:"The update improved the application’s performance.",
        trapChoices:["perform","performed","performing"]
      }
    ]
  },

  S13: {
    theme:"AI Report / Academic Summary",
    words:[
      {
        w:"dataset",
        th:"ชุดข้อมูล",
        pos:"noun",
        fill:"The AI model was trained using a small ______.",
        answer:"dataset",
        collocation:"training dataset",
        context:"A collection of examples used to train a model is a...",
        contextAnswer:"dataset",
        academic:"The dataset contains examples used to train the AI model.",
        plain:"The AI learned from data.",
        upgrade:"The AI model was trained using a dataset.",
        trapChoices:["data set are","database","data seat"]
      },
      {
        w:"model",
        th:"โมเดลหรือแบบจำลอง",
        pos:"noun",
        fill:"The ______ can classify images into categories.",
        answer:"model",
        collocation:"AI model",
        context:"A trained AI system that predicts or classifies data is a...",
        contextAnswer:"model",
        academic:"The AI model achieved an accuracy rate of 90%.",
        plain:"The AI was right 90% of the time.",
        upgrade:"The AI model achieved an accuracy rate of 90%.",
        trapChoices:["module","modal","modern"]
      },
      {
        w:"accuracy",
        th:"ความแม่นยำ",
        pos:"noun",
        fill:"The model achieved 85% ______.",
        answer:"accuracy",
        collocation:"model accuracy",
        context:"A model predicts correctly 85 out of 100 times. This is its...",
        contextAnswer:"accuracy",
        academic:"The model was evaluated using accuracy as a key metric.",
        plain:"The model was correct many times.",
        upgrade:"The model achieved high accuracy.",
        trapChoices:["accurate","accurately","accurateness"]
      },
      {
        w:"findings",
        th:"ข้อค้นพบ",
        pos:"noun",
        fill:"The main ______ indicate improvement.",
        answer:"findings",
        collocation:"research findings",
        context:"A report says vocabulary scores increased. These results are...",
        contextAnswer:"findings",
        academic:"The findings indicate that the AI model improved classification accuracy.",
        plain:"The results show AI improved.",
        upgrade:"The findings indicate improvement in model accuracy.",
        trapChoices:["finding","found","find"]
      },
      {
        w:"limitation",
        th:"ข้อจำกัด",
        pos:"noun",
        fill:"One ______ of the study is the small sample size.",
        answer:"limitation",
        collocation:"study limitation",
        context:"The study used only 20 students, so the result may not represent everyone. This is a...",
        contextAnswer:"limitation",
        academic:"One limitation of this study is the small sample size.",
        plain:"The study had only a few students.",
        upgrade:"One limitation of this study is the small sample size.",
        trapChoices:["limited","limit","limiting"]
      },
      {
        w:"method",
        th:"วิธีการ",
        pos:"noun",
        fill:"The research ______ includes data collection and analysis.",
        answer:"method",
        collocation:"research method",
        context:"A section explains how the study was conducted. This section describes the...",
        contextAnswer:"method",
        academic:"The research method includes data collection, analysis, and evaluation.",
        plain:"The report explains how we did it.",
        upgrade:"The report describes the research method.",
        trapChoices:["methodology only","media","meeting"]
      },
      {
        w:"analysis",
        th:"การวิเคราะห์",
        pos:"noun",
        fill:"Data ______ was conducted after the experiment.",
        answer:"analysis",
        collocation:"data analysis",
        context:"Researchers examine data to identify patterns. They conduct...",
        contextAnswer:"data analysis",
        academic:"Data analysis helps identify patterns and trends.",
        plain:"Researchers study the data.",
        upgrade:"Researchers conduct data analysis.",
        trapChoices:["analyze","analyst","analytical"]
      },
      {
        w:"evidence",
        th:"หลักฐาน",
        pos:"noun",
        fill:"The data provides ______ for the conclusion.",
        answer:"evidence",
        collocation:"strong evidence",
        context:"Data supports the conclusion of a report. The data is...",
        contextAnswer:"evidence",
        academic:"The evidence supports the conclusion of the study.",
        plain:"The data supports the idea.",
        upgrade:"The evidence supports the conclusion.",
        trapChoices:["evident","event","evidencee"]
      },
      {
        w:"significant",
        th:"มีนัยสำคัญ/สำคัญมาก",
        pos:"adjective",
        fill:"The results showed a ______ improvement.",
        answer:"significant",
        collocation:"significant improvement",
        context:"A result is important and meaningful. It is...",
        contextAnswer:"significant",
        academic:"The results showed a significant improvement in vocabulary scores.",
        plain:"Scores improved a lot.",
        upgrade:"The results showed a significant improvement.",
        trapChoices:["significance","significantly","signify"]
      },
      {
        w:"further research",
        th:"การวิจัยเพิ่มเติม",
        pos:"noun phrase",
        fill:"______ is needed to evaluate long-term outcomes.",
        answer:"Further research",
        collocation:"further research is needed",
        context:"A study recommends more investigation in the future. It says...",
        contextAnswer:"further research is needed",
        academic:"Further research is needed to evaluate long-term learning outcomes.",
        plain:"We need more research later.",
        upgrade:"Further research is needed to evaluate long-term outcomes.",
        trapChoices:["Farther research","Future researcher","Research furthering"]
      }
    ]
  },

  S14: {
    theme:"CV / Interview / Pitch",
    words:[
      {
        w:"CV",
        th:"เอกสารประวัติการศึกษาและประสบการณ์",
        pos:"noun",
        fill:"My ______ includes my education and project experience.",
        answer:"CV",
        collocation:"submit a CV",
        context:"A document lists education, skills, and experience. This document is a...",
        contextAnswer:"CV",
        academic:"My CV includes my education, technical skills, and project experience.",
        plain:"My CV has my education and experience.",
        upgrade:"My CV includes my education and project experience.",
        trapChoices:["TV","VC","CVE"]
      },
      {
        w:"resume",
        th:"เอกสารสมัครงานแบบย่อ",
        pos:"noun",
        fill:"Please attach your ______ to the application form.",
        answer:"resume",
        collocation:"attach a resume",
        context:"A short job application document is a...",
        contextAnswer:"resume",
        academic:"The applicant should attach a resume to the application form.",
        plain:"Send your job document.",
        upgrade:"Please attach your resume to the application form.",
        trapChoices:["resumé only","result","resource"]
      },
      {
        w:"interview",
        th:"การสัมภาษณ์",
        pos:"noun",
        fill:"I have a job ______ tomorrow.",
        answer:"interview",
        collocation:"job interview",
        context:"An employer asks a candidate questions for a position. This is a...",
        contextAnswer:"interview",
        academic:"During the interview, applicants should explain their relevant experience clearly.",
        plain:"I will answer job questions.",
        upgrade:"I have a job interview tomorrow.",
        trapChoices:["interface","inquiry","internet"]
      },
      {
        w:"qualification",
        th:"คุณสมบัติ",
        pos:"noun",
        fill:"English communication is an important ______ for this position.",
        answer:"qualification",
        collocation:"job qualification",
        context:"Skills and education required for a job are...",
        contextAnswer:"qualifications",
        academic:"The qualifications include communication skills and programming experience.",
        plain:"The job needs English and coding.",
        upgrade:"The qualifications include English communication and programming skills.",
        trapChoices:["qualified","qualify","quality"]
      },
      {
        w:"strength",
        th:"จุดแข็ง",
        pos:"noun",
        fill:"One of my ______ is problem-solving.",
        answer:"strengths",
        collocation:"key strength",
        context:"A candidate is good at teamwork. This is one of the candidate's...",
        contextAnswer:"strengths",
        academic:"One of my key strengths is problem-solving in software projects.",
        plain:"I am good at solving problems.",
        upgrade:"One of my key strengths is problem-solving.",
        trapChoices:["strong","strengthen","strict"]
      },
      {
        w:"experience",
        th:"ประสบการณ์",
        pos:"noun",
        fill:"I have ______ in designing mobile applications.",
        answer:"experience",
        collocation:"relevant experience",
        context:"A candidate has designed apps before. The candidate has...",
        contextAnswer:"experience",
        academic:"I have experience in designing user interfaces for mobile applications.",
        plain:"I designed mobile apps before.",
        upgrade:"I have experience in designing mobile applications.",
        trapChoices:["experienced","experiment","expert"]
      },
      {
        w:"achievement",
        th:"ความสำเร็จ",
        pos:"noun",
        fill:"Winning the project award was my major ______.",
        answer:"achievement",
        collocation:"project achievement",
        context:"Completing a successful prototype is a project...",
        contextAnswer:"achievement",
        academic:"I successfully developed a mobile application prototype for a class project.",
        plain:"I made a good app project.",
        upgrade:"I successfully developed a mobile application prototype.",
        trapChoices:["attachment","agreement","arrangement"]
      },
      {
        w:"apply for",
        th:"สมัคร",
        pos:"phrase",
        fill:"I would like to ______ the internship.",
        answer:"apply for",
        collocation:"apply for a position",
        context:"A student sends documents for a job position. The student...",
        contextAnswer:"applies for a position",
        academic:"I am applying for the junior software developer position.",
        plain:"I want this job.",
        upgrade:"I am applying for the junior software developer position.",
        trapChoices:["apply on","apply in","apply to"]
      },
      {
        w:"pitch",
        th:"การนำเสนอไอเดียสั้น ๆ เพื่อโน้มน้าว",
        pos:"noun",
        fill:"The team prepared a short project ______.",
        answer:"pitch",
        collocation:"project pitch",
        context:"A short persuasive presentation about an idea is a...",
        contextAnswer:"pitch",
        academic:"The main value proposition is personalized vocabulary practice through game-based learning.",
        plain:"Our app helps students practice words.",
        upgrade:"The main value proposition is personalized vocabulary practice.",
        trapChoices:["peach","patch","pitcher"]
      },
      {
        w:"propose",
        th:"เสนอ",
        pos:"verb",
        fill:"I would like to ______ a new learning application.",
        answer:"propose",
        collocation:"propose a solution",
        context:"A student presents a new app idea. The student...",
        contextAnswer:"proposes an idea",
        academic:"I would like to propose a mobile application that supports vocabulary learning.",
        plain:"I want to present an app idea.",
        upgrade:"I would like to propose a mobile learning application.",
        trapChoices:["proposal","proposed","proposing"]
      },
      {
        w:"value proposition",
        th:"คุณค่าหลักที่เสนอให้ผู้ใช้",
        pos:"noun phrase",
        fill:"The main ______ is personalized vocabulary practice.",
        answer:"value proposition",
        collocation:"main value proposition",
        context:"A sentence explains why a product is useful. This is a...",
        contextAnswer:"value proposition",
        academic:"The main value proposition is personalized vocabulary practice through game-based learning.",
        plain:"The app is useful because it helps review words.",
        upgrade:"The main value proposition is personalized vocabulary practice.",
        trapChoices:["valuable proposition","value proposal","proposition value"]
      }
    ]
  }
};

/* =========================================================
   Builder Helpers
========================================================= */

(function buildQuestionBank(){
  const specs = window.EAP_VOCAB_SPECS;

  function cloneChoices(arr){
    return Array.isArray(arr) ? arr.slice() : [];
  }

  function wrongGeneric(word){
    return [
      "อาหาร",
      "รองเท้า",
      "สี",
      "ห้องเรียน"
    ].filter(x => x !== word);
  }

  function cleanIdPart(text){
    return String(text || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g,"-")
      .replace(/^-+|-+$/g,"")
      .slice(0,26);
  }

  function pushItem(bank,item){
    if(!item || !item.id || !item.session || !item.answer) return;
    bank.push(item);
  }

  function makeMeaningChoices(spec){
    const choices = [spec.th].concat(wrongGeneric(spec.th));
    return choices.slice(0,4);
  }

  function makeSentenceChoices(spec){
    const traps = cloneChoices(spec.trapChoices);
    return [spec.answer].concat(traps).slice(0,4);
  }

  function makeCollocationChoices(spec){
    const base = spec.collocation || spec.w;
    const head = String(base).split(" ")[0] || "academic";
    const wrongs = [
      `${head} banana`,
      `${head} weather`,
      `${head} chair`,
      `${head} sandwich`
    ];
    return [base].concat(wrongs).slice(0,4);
  }

  function makeContextChoices(spec){
    const answer = spec.contextAnswer || spec.w;
    const traps = cloneChoices(spec.trapChoices);
    const fallback = [
      "email greeting",
      "food menu",
      "travel plan",
      "classroom color"
    ];
    return [answer].concat(traps).concat(fallback).slice(0,4);
  }

  function makeAcademicChoices(spec){
    const correct = spec.academic || spec.upgrade || spec.simple;
    const w = spec.w;
    return [
      correct,
      `${w} good for students and project.`,
      `Students ${w} because application nice.`,
      `This is ${w} and it very good.`
    ];
  }

  function makeUpgradeChoices(spec){
    const correct = spec.upgrade || spec.academic;
    return [
      correct,
      spec.plain || "This is good.",
      "Students do it good and nice.",
      "The thing is useful because very good."
    ];
  }

  function makeWordFormChoices(spec){
    const traps = cloneChoices(spec.trapChoices);
    return [spec.answer || spec.w].concat(traps).slice(0,4);
  }

  function buildItemsForSpec(sessionId, index, spec){
    const idBase = `${sessionId}-${String(index + 1).padStart(3,"0")}-${cleanIdPart(spec.w)}`;
    const items = [];

    pushItem(items,{
      id:`${idBase}-A2-MEANING`,
      session:sessionId,
      level:"A2",
      type:"meaning",
      word:spec.w,
      prompt:`What does “${spec.w}” mean?`,
      choices:makeMeaningChoices(spec),
      answer:spec.th,
      explanation:`${spec.w} หมายถึง ${spec.th}`
    });

    pushItem(items,{
      id:`${idBase}-A2P-FILL`,
      session:sessionId,
      level:"A2+",
      type:"sentence_fill",
      word:spec.w,
      prompt:spec.fill,
      choices:makeSentenceChoices(spec),
      answer:spec.answer,
      explanation:`ใช้ “${spec.answer}” ในประโยคนี้ให้เหมาะกับบริบท ${specs[sessionId].theme}`
    });

    pushItem(items,{
      id:`${idBase}-B1-COLLOCATION`,
      session:sessionId,
      level:"B1",
      type:"collocation",
      word:spec.collocation || spec.w,
      prompt:"Choose the best collocation.",
      choices:makeCollocationChoices(spec),
      answer:spec.collocation || spec.w,
      explanation:`“${spec.collocation || spec.w}” เป็นวลีที่ใช้ได้จริงในบริบท ${specs[sessionId].theme}`
    });

    pushItem(items,{
      id:`${idBase}-B1-CONTEXT`,
      session:sessionId,
      level:"B1",
      type:"context",
      word:spec.w,
      prompt:spec.context,
      choices:makeContextChoices(spec),
      answer:spec.contextAnswer || spec.w,
      explanation:`คำตอบที่เหมาะสมคือ “${spec.contextAnswer || spec.w}” เพราะสอดคล้องกับสถานการณ์`
    });

    pushItem(items,{
      id:`${idBase}-B1-WORDFORM`,
      session:sessionId,
      level:"B1",
      type:"word_form",
      word:spec.w,
      prompt:spec.fill,
      choices:makeWordFormChoices(spec),
      answer:spec.answer,
      explanation:`ระวังรูปคำของ “${spec.w}” ให้ตรงกับหน้าที่ในประโยค`
    });

    pushItem(items,{
      id:`${idBase}-B1-NEARMISS`,
      session:sessionId,
      level:"B1",
      type:"near_miss",
      word:spec.w,
      prompt:`Choose the best word or phrase for this context: ${spec.context}`,
      choices:makeContextChoices(spec),
      answer:spec.contextAnswer || spec.w,
      explanation:`ข้อนี้เป็น near-miss ต้องแยก “${spec.w}” จากคำที่หน้าตาคล้ายกัน`
    });

    pushItem(items,{
      id:`${idBase}-B1P-ACADEMIC`,
      session:sessionId,
      level:"B1+",
      type:"academic_phrase",
      word:spec.w,
      prompt:"Choose the sentence with the best academic/professional tone.",
      choices:makeAcademicChoices(spec),
      answer:spec.academic || spec.upgrade || spec.simple,
      explanation:`ประโยคนี้ใช้ “${spec.w}” ด้วยโทนที่เหมาะกับ EAP / professional communication`
    });

    pushItem(items,{
      id:`${idBase}-B1P-UPGRADE`,
      session:sessionId,
      level:"B1+",
      type:"academic_upgrade",
      word:spec.w,
      prompt:`Plain English: “${spec.plain || spec.fill}” Choose the academic/professional version.`,
      choices:makeUpgradeChoices(spec),
      answer:spec.upgrade || spec.academic,
      explanation:`ประโยคที่เลือกมี academic tone ดีกว่าและเหมาะกับ ${specs[sessionId].theme}`
    });

    return items;
  }

  function addManualBossPolish(bank){
    bank.push(
      {
        id:"S15-FINAL-BOSS-MIX-001",
        session:"S14",
        level:"B1+",
        type:"trap",
        word:"qualified for",
        prompt:"Choose the correct sentence.",
        choices:[
          "I believe I am qualified for this position.",
          "I believe I am qualification for this position.",
          "I believe I qualified to this position.",
          "I believe I am qualify for this position."
        ],
        answer:"I believe I am qualified for this position.",
        explanation:"ใช้ be qualified for + position เพื่อบอกว่ามีคุณสมบัติเหมาะกับตำแหน่ง"
      },
      {
        id:"S15-FINAL-BOSS-MIX-002",
        session:"S13",
        level:"B1+",
        type:"trap",
        word:"findings suggest",
        prompt:"Choose the correct sentence.",
        choices:[
          "The findings suggest that the application is useful for review.",
          "The finding suggest that application useful.",
          "The findings suggests application useful.",
          "Findings is suggest useful application."
        ],
        answer:"The findings suggest that the application is useful for review.",
        explanation:"findings เป็นพหูพจน์ จึงใช้ suggest"
      },
      {
        id:"S12-BOSS-POLISH-001",
        session:"S11",
        level:"B1+",
        type:"trap",
        word:"can be reproduced",
        prompt:"Choose the correct bug report sentence.",
        choices:[
          "The issue can be reproduced on mobile devices.",
          "The issue can reproduced on mobile devices.",
          "The issue can be reproduce on mobile devices.",
          "The issue can reproduction on mobile devices."
        ],
        answer:"The issue can be reproduced on mobile devices.",
        explanation:"can be reproduced เป็น passive voice ที่ถูกต้องใน bug report"
      },
      {
        id:"S9-BOSS-POLISH-001",
        session:"S7",
        level:"B1+",
        type:"trap",
        word:"prompt response",
        prompt:"Choose the correct email sentence.",
        choices:[
          "Thank you for your prompt response.",
          "Thank you for your prompt respond.",
          "Thank you for your promptly response.",
          "Thank you for respond prompt."
        ],
        answer:"Thank you for your prompt response.",
        explanation:"response เป็นคำนาม ส่วน respond เป็นกริยา"
      },
      {
        id:"S6-BOSS-POLISH-001",
        session:"S5",
        level:"B1+",
        type:"trap",
        word:"I would appreciate it if",
        prompt:"Choose the most polite request.",
        choices:[
          "I would appreciate it if you could provide feedback.",
          "I would appreciate if you provide feedback.",
          "I appreciate you to provide feedback.",
          "I would appreciation your feedback."
        ],
        answer:"I would appreciate it if you could provide feedback.",
        explanation:"I would appreciate it if you could... เป็นโครงสร้างสุภาพและถูกต้อง"
      },
      {
        id:"S3-BOSS-POLISH-001",
        session:"S1",
        level:"B1",
        type:"trap",
        word:"interested in",
        prompt:"Choose the correct sentence.",
        choices:[
          "I am interested in digital media.",
          "I am interesting in digital media.",
          "I interested at digital media.",
          "I am interest on digital media."
        ],
        answer:"I am interested in digital media.",
        explanation:"ใช้ be interested in + noun/V-ing เพื่อบอกความสนใจ"
      },
      {
        id:"S3-BOSS-POLISH-002",
        session:"S2",
        level:"B1",
        type:"trap",
        word:"objective",
        prompt:"Choose the correct word: The main ______ of this project is to support vocabulary learning.",
        choices:[
          "objective",
          "object",
          "objection",
          "observe"
        ],
        answer:"objective",
        explanation:"objective = วัตถุประสงค์, object = วัตถุ, objection = การคัดค้าน"
      }
    );
  }

  const bank = [];

  Object.entries(specs).forEach(([sessionId,sessionSpec]) => {
    sessionSpec.words.forEach((spec,index) => {
      bank.push(...buildItemsForSpec(sessionId,index,spec));
    });
  });

  addManualBossPolish(bank);

  const seen = new Set();
  window.QUESTION_BANK = bank.filter(item => {
    if(seen.has(item.id)){
      console.warn("[EAP Word Quest] Duplicate item id skipped:", item.id);
      return false;
    }
    seen.add(item.id);
    return true;
  });

  window.EAP_DATA_SUMMARY = {
    version:window.APP_VERSION,
    playableSessions:Object.keys(specs),
    totalItems:window.QUESTION_BANK.length,
    totalWords:Object.values(specs).reduce((sum,s) => sum + s.words.length,0)
  };

  console.info("[EAP Word Quest] Data loaded:", window.EAP_DATA_SUMMARY);
})();
