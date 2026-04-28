// === /english/js/lesson-data.js ===
// TechPath English VR • Canonical S1–S15 Data
// PATCH v20260428-close-distractors-hybrid-3d
// ✅ S1–S15 skill mapping canonical
// ✅ 10 questions per S
// ✅ level split: easy 3 / normal 3 / hard 3 / challenge 1
// ✅ close distractors for reading/listening/boss choice stages
// ✅ compatible with lesson.html hybrid 3D arena version

(function(){
  'use strict';

  const VERSION = '20260428-close-distractors-hybrid-3d';

  const SKILLS = [
    { id:'speaking', label:'Speaking', icon:'🎙️' },
    { id:'reading', label:'Reading', icon:'📖' },
    { id:'writing', label:'Writing', icon:'⌨️' },
    { id:'listening', label:'Listening', icon:'🎧' }
  ];

  const SESSIONS = [
    {
      id:1,
      code:'S01',
      title:'Speak like a Pro, Not a Robot',
      scenario:'AI Pronunciation Gate',
      skill:'speaking',
      level:'A2 → B1',
      boss:false,
      final:false,
      noTextPrompt:false,
      missionType:'voice_pronunciation',
      playerRole:'CS/AI Student at a Virtual Tech Conference',
      mission:'พูดแนะนำตัวและความสนใจด้าน CS/AI ให้ AI Speech Recognition เข้าใจ'
    },
    {
      id:2,
      code:'S02',
      title:'NPC Reading Dialogue',
      scenario:'Virtual Tech Conference Networking',
      skill:'reading',
      level:'A2 → B1',
      boss:false,
      final:false,
      noTextPrompt:false,
      missionType:'npc_context_choice',
      playerRole:'Student networking with a polite NPC',
      mission:'อ่านบริบทจาก NPC แล้วเลือกคำตอบที่สุภาพและตรงประเด็นที่สุด'
    },
    {
      id:3,
      code:'S03',
      title:'Hacker Virus Boss',
      scenario:'Cyber Virus Attack Arena',
      skill:'writing',
      level:'A2 → B1+',
      boss:true,
      final:false,
      noTextPrompt:false,
      missionType:'boss_typing_counterattack',
      playerRole:'Junior Developer defending the system',
      mission:'พิมพ์ตอบกลับเพื่อโจมตีไวรัสแฮ็กเกอร์ ต้องสั้น ชัด และตรงปัญหา'
    },
    {
      id:4,
      code:'S04',
      title:'Daily Stand-up Speaking',
      scenario:'Virtual Office Scrum Board',
      skill:'speaking',
      level:'A2 → B1',
      boss:false,
      final:false,
      noTextPrompt:false,
      missionType:'standup_speaking',
      playerRole:'Developer in a daily stand-up meeting',
      mission:'พูดอัปเดตงานแบบ Yesterday / Today / Blockers ให้กระชับ'
    },
    {
      id:5,
      code:'S05',
      title:'Audio Alert Listening',
      scenario:'Coding Lab Audio Alert',
      skill:'listening',
      level:'A2 → B1',
      boss:false,
      final:false,
      noTextPrompt:true,
      missionType:'listen_only_keyword',
      playerRole:'Developer listening to system alerts',
      mission:'ไม่มีข้อความโจทย์บนจอ ต้องฟังเสียง AI แล้วจับ keyword สำคัญ'
    },
    {
      id:6,
      code:'S06',
      title:'Ticket Dashboard Boss',
      scenario:'Dashboard Management Room',
      skill:'reading',
      level:'A2 → B1+',
      boss:true,
      final:false,
      noTextPrompt:false,
      missionType:'boss_ticket_reading',
      playerRole:'Developer reading an urgent support ticket',
      mission:'อ่าน Ticket แล้วเลือกวิธีแก้ปัญหาที่เร็วและเหมาะสมที่สุด'
    },
    {
      id:7,
      code:'S07',
      title:'Client Terminal Reply',
      scenario:'Client Investor Terminal',
      skill:'writing',
      level:'A2 → B1',
      boss:false,
      final:false,
      noTextPrompt:false,
      missionType:'simple_client_writing',
      playerRole:'Developer explaining IT to a non-tech investor',
      mission:'พิมพ์อธิบายคำถาม IT ให้ลูกค้าที่ไม่ใช่สายเทคเข้าใจง่าย'
    },
    {
      id:8,
      code:'S08',
      title:'AI Ethics Audio Test',
      scenario:'Ethics Committee Audio Room',
      skill:'listening',
      level:'A2 → B1',
      boss:false,
      final:false,
      noTextPrompt:true,
      missionType:'ethics_yes_no_listening',
      playerRole:'AI team member listening to ethics questions',
      mission:'ฟังคำถามเชิงจริยธรรม แล้วเลือกคำตอบที่ถูกต้องตามกฎหมายและจริยธรรม'
    },
    {
      id:9,
      code:'S09',
      title:'Data Lock Voice Boss',
      scenario:'Hacked Data Chart Room',
      skill:'speaking',
      level:'A2 → B1+',
      boss:true,
      final:false,
      noTextPrompt:false,
      missionType:'boss_data_speaking',
      playerRole:'Data Analyst unlocking a hacked system',
      mission:'พูดคำตอบด้าน Data Analysis ให้ชัด แม่นยำ และมี keyword ครบ'
    },
    {
      id:10,
      code:'S10',
      title:'Client Hologram Reading',
      scenario:'Client Requirement Hologram',
      skill:'reading',
      level:'A2 → B1',
      boss:false,
      final:false,
      noTextPrompt:false,
      missionType:'client_requirement_reading',
      playerRole:'System analyst reading client requirements',
      mission:'อ่านข้อความจาก Client บน Hologram แล้วเลือกคำตอบที่ตรง requirement'
    },
    {
      id:11,
      code:'S11',
      title:'Angry Client Call',
      scenario:'Virtual Meeting with Angry AI Client',
      skill:'listening',
      level:'A2 → B1',
      boss:false,
      final:false,
      noTextPrompt:true,
      missionType:'stress_tone_listening',
      playerRole:'Support developer listening calmly',
      mission:'ฟังน้ำเสียงหงุดหงิดของ AI Client แต่โฟกัสเนื้อหาปัญหา'
    },
    {
      id:12,
      code:'S12',
      title:'Villain Investor Boss',
      scenario:'Silicon Valley Pitch Battle',
      skill:'writing',
      level:'A2 → B1+',
      boss:true,
      final:false,
      noTextPrompt:false,
      missionType:'boss_pitch_writing',
      playerRole:'Startup founder answering a villain investor',
      mission:'พิมพ์คำตอบแบบ Founder ให้เร็ว ชัด และโน้มน้าวนักลงทุน'
    },
    {
      id:13,
      code:'S13',
      title:'HR Interview Screen',
      scenario:'Technical Job Interview Part 1',
      skill:'reading',
      level:'A2 → B1',
      boss:false,
      final:false,
      noTextPrompt:false,
      missionType:'hr_interview_reading',
      playerRole:'Candidate reading HR interview questions',
      mission:'อ่านคำถามสัมภาษณ์จาก HR แล้วเลือกคำตอบที่เป็นมืออาชีพที่สุด'
    },
    {
      id:14,
      code:'S14',
      title:'Strict Technical Mic Room',
      scenario:'Technical Job Interview Part 2',
      skill:'speaking',
      level:'A2 → B1+',
      boss:false,
      final:false,
      noTextPrompt:false,
      missionType:'strict_mic_technical_speaking',
      playerRole:'Candidate explaining logic under pressure',
      mission:'พูดประโยคเทคนิคที่ยาวขึ้น ใช้ศัพท์เฉพาะ และให้ AI Mic ตรวจเข้มงวด'
    },
    {
      id:15,
      code:'S15',
      title:'Global Network Final Crisis',
      scenario:'Multi-country Network Attack',
      skill:'listening',
      level:'A2 → B1+',
      boss:true,
      final:true,
      noTextPrompt:true,
      missionType:'final_global_listening',
      playerRole:'Global team member saving the network',
      mission:'ฟังคำสั่งฉุกเฉินเพื่อกอบกู้ระบบ Network ทั่วโลก'
    }
  ];

  function textQ(sid, no, level, skill, prompt, sample, expected, hint){
    return {
      id:'S' + String(sid).padStart(2,'0') + '-' + level.toUpperCase().slice(0,1) + String(no).padStart(2,'0'),
      skill,
      level,
      kind:'text',
      prompt,
      sample,
      expected,
      hint
    };
  }

  function mcQ(sid, no, level, skill, prompt, say, choices, answer, rationales, hint, correctFeedback){
    return {
      id:'S' + String(sid).padStart(2,'0') + '-' + level.toUpperCase().slice(0,1) + String(no).padStart(2,'0'),
      skill,
      level,
      kind:'choice',
      prompt,
      say,
      choices,
      answer,
      rationales,
      hint,
      correctFeedback
    };
  }

  const SESSION_BANK = {
    1: [
      textQ(1,1,'easy','speaking',
        'Introduce yourself at a virtual tech conference. Say your name, your major, and one tech interest.',
        'Hello, my name is Hero. I study computer science, and I am interested in AI apps.',
        ['name','study','computer','ai'],
        'พูดให้มี name + study/major + tech interest'
      ),
      textQ(1,2,'easy','speaking',
        'Tell the AI Mic one simple sentence about why you like technology.',
        'I like technology because it helps people solve real problems.',
        ['technology','helps','people','problems'],
        'ใช้ประโยคง่าย ๆ แต่ต้องมีเหตุผล'
      ),
      textQ(1,3,'easy','speaking',
        'Say a short greeting to a new classmate in a tech event.',
        'Hi, nice to meet you. I am interested in web development and AI.',
        ['nice','meet','interested','ai'],
        'ควรสุภาพและบอกความสนใจสั้น ๆ'
      ),

      textQ(1,4,'normal','speaking',
        'Give a 15-second elevator pitch about your CS or AI focus.',
        'Hi, I am Hero. I study computer science, and my focus is building useful AI tools for students.',
        ['study','computer','focus','ai','tools'],
        'ต้องพูดแบบ pitch: who you are + focus + value'
      ),
      textQ(1,5,'normal','speaking',
        'Explain your tech interest to a conference NPC in a friendly way.',
        'I am interested in mobile apps because they can make learning easier and more interactive.',
        ['interested','mobile','apps','learning'],
        'เน้น friendly + specific'
      ),
      textQ(1,6,'normal','speaking',
        'Tell the AI why CS and AI are useful for your future career.',
        'Computer science and AI are useful because they help me build smart systems and solve business problems.',
        ['computer','ai','career','systems','problems'],
        'มีเหตุผลด้าน career และ problem solving'
      ),

      textQ(1,7,'hard','speaking',
        'Introduce yourself professionally and include one project idea you want to build.',
        'Hello, I am Hero, a computer science student. I want to build an AI chatbot that helps students practice English.',
        ['student','build','ai','chatbot','practice'],
        'พูดให้เป็นมืออาชีพและมี project idea'
      ),
      textQ(1,8,'hard','speaking',
        'Give a clear self-introduction for a networking event and avoid sounding too casual.',
        'Good afternoon. My name is Hero. I am studying computer science, and I am developing my skills in AI and web applications.',
        ['name','studying','computer','developing','skills'],
        'หลีกเลี่ยงคำ casual เกินไป เช่น stuff, things'
      ),
      textQ(1,9,'hard','speaking',
        'Tell a senior developer your learning goal for this semester.',
        'This semester, my goal is to improve my English communication and explain technical ideas more clearly.',
        ['goal','improve','english','technical','clearly'],
        'เป้าหมายต้องชัดและเกี่ยวกับ communication'
      ),

      textQ(1,10,'challenge','speaking',
        'Give a confident but realistic elevator pitch for a global tech internship interview.',
        'Hello, I am Hero, a computer science student interested in AI for education. I can explain ideas clearly, work with a team, and keep learning from feedback.',
        ['student','ai','education','clearly','team','feedback'],
        'ต้อง confident แต่ไม่โม้เกินจริง'
      )
    ],

    2: [
      mcQ(2,1,'easy','reading',
        'NPC says: “Hi, I’m Maya. I work on AI projects for education. What are you interested in?” Choose the best reply.',
        '',
        [
          'Nice to meet you. I’m interested in AI for learning apps.',
          'Nice to meet you. I use computers sometimes and AI is popular.',
          'I know AI very well, so I can do any project.',
          'Hello. I like many things in technology.'
        ],
        0,
        [
          'Best: polite, specific, and directly answers the NPC.',
          'Too vague: it mentions AI but does not explain your interest clearly.',
          'Too overconfident and unrealistic for networking.',
          'Polite but too general and not focused on the NPC’s topic.'
        ],
        'เลือกคำตอบที่สุภาพ + เจาะจง + ตอบสิ่งที่ NPC ถาม',
        'ดีที่สุด เพราะตอบตรงคำถามและบอกความสนใจด้าน AI ชัดเจน'
      ),
      mcQ(2,2,'easy','reading',
        'NPC says: “This event is crowded, but I hope you meet useful contacts.” Choose the most polite response.',
        '',
        [
          'Thank you. I hope to learn from people here and make good connections.',
          'Yes, it is crowded. I do not like crowded events very much.',
          'Thank you. I need contacts because they may help me get a job.',
          'Okay. I will walk around and see what happens.'
        ],
        0,
        [
          'Best: polite, positive, and appropriate for networking.',
          'Too negative; it focuses on discomfort.',
          'Too direct and self-focused for small talk.',
          'Acceptable but passive and not warm enough.'
        ],
        'คำตอบ networking ควร positive และสุภาพ',
        'ถูกต้อง เพราะเป็น small talk ที่เป็นมิตรและเหมาะกับงาน networking'
      ),
      mcQ(2,3,'easy','reading',
        'NPC says: “Do you want to exchange LinkedIn contacts?” Choose the best reply.',
        '',
        [
          'Yes, thank you. I would be happy to connect with you on LinkedIn.',
          'Yes. Give me your LinkedIn now.',
          'Maybe. I do not use LinkedIn often, but you can try.',
          'Sure. I need many followers on LinkedIn.'
        ],
        0,
        [
          'Best: polite, clear, and professional.',
          'Too direct and sounds like a command.',
          'Uncertain and not very professional.',
          'Focuses on followers, not professional connection.'
        ],
        'ดูน้ำเสียงสุภาพและ professional',
        'ถูกต้อง เพราะตอบรับอย่างสุภาพและเหมาะกับการแลก contact'
      ),

      mcQ(2,4,'normal','reading',
        'NPC says: “I’m looking for students who can explain tech ideas to non-tech users.” Choose the best response.',
        '',
        [
          'That sounds interesting. I try to explain technical ideas with simple examples.',
          'That is easy because non-tech users do not need many details.',
          'I can explain technology, but users should learn technical words too.',
          'I like speaking, so I can talk a lot about technology.'
        ],
        0,
        [
          'Best: relevant, user-centered, and professional.',
          'Too dismissive; it underestimates users.',
          'Too demanding; it shifts responsibility to users.',
          'Talks about speaking but not about clear explanation.'
        ],
        'ตอบให้แสดง empathy กับ non-tech users',
        'ถูกต้อง เพราะเน้น simple examples และเข้าใจผู้ใช้'
      ),
      mcQ(2,5,'normal','reading',
        'NPC says: “What kind of AI project would you like to join?” Choose the strongest answer.',
        '',
        [
          'I would like to join an AI education project because it can support learners.',
          'I would like to join any AI project because AI is useful everywhere.',
          'I want to join a project that is famous and looks impressive.',
          'I like AI projects if they are not too difficult for beginners.'
        ],
        0,
        [
          'Best: specific project area with a clear social value.',
          'Too broad and sounds unfocused.',
          'Focuses on image, not learning or contribution.',
          'Too cautious and not confident enough.'
        ],
        'คำตอบที่ดีควรมี field + reason',
        'ถูกต้อง เพราะบอกทั้งประเภทโครงการและเหตุผล'
      ),
      mcQ(2,6,'normal','reading',
        'NPC says: “I’m not sure whether to study CS or AI. What do you think?” Choose the best response.',
        '',
        [
          'CS gives a broad foundation, and AI is a strong focus area you can build on later.',
          'AI is better than CS because it is newer and more popular.',
          'CS is safer because AI may be too hard for many students.',
          'Both are fine. You can just choose the one that sounds cooler.'
        ],
        0,
        [
          'Best: balanced, informative, and supportive.',
          'Too biased and oversimplified.',
          'Too discouraging and not helpful.',
          'Too casual and lacks useful guidance.'
        ],
        'เลือกคำตอบที่ balanced และให้คำแนะนำจริง',
        'ถูกต้อง เพราะอธิบายความสัมพันธ์ CS กับ AI อย่างมืออาชีพ'
      ),

      mcQ(2,7,'hard','reading',
        'NPC says: “I’m nervous about talking to senior developers. How should I start?” Choose the most professional suggestion.',
        '',
        [
          'Start with a short introduction, ask about their work, and listen carefully.',
          'Start by telling them your skills so they know you are serious.',
          'Ask them if they can help you find a future internship.',
          'Tell them you are nervous so they can lead the conversation.'
        ],
        0,
        [
          'Best: practical, polite, and supports active listening.',
          'Too self-centered at the beginning of networking.',
          'Too early to ask for career help.',
          'Honest but not the strongest professional opening.'
        ],
        'Networking ต้องเริ่มด้วย intro + open question + listening',
        'ถูกต้อง เพราะสอดคล้องกับ professional networking'
      ),
      mcQ(2,8,'hard','reading',
        'NPC says: “Your project sounds interesting. What problem does it solve?” Choose the best response.',
        '',
        [
          'It helps students practice English speaking in a safe and interactive environment.',
          'It uses AI and VR, so it is more modern than normal learning.',
          'It is a game, so students will probably enjoy it more.',
          'It solves many problems in education with technology.'
        ],
        0,
        [
          'Best: states a clear user problem and solution.',
          'Mentions technology but not the user problem clearly.',
          'May be true but too shallow as a value statement.',
          'Too broad and not specific enough.'
        ],
        'ตอบเรื่อง problem solved ไม่ใช่แค่ technology used',
        'ถูกต้อง เพราะเชื่อมปัญหาและผู้ใช้ชัดเจน'
      ),
      mcQ(2,9,'hard','reading',
        'NPC says: “Could you tell me more about your AI focus?” Choose the answer with the best professional tone.',
        '',
        [
          'My focus is using AI to support learning, especially feedback and practice activities.',
          'My focus is AI because it is the future and every company wants it.',
          'I focus on AI tools because they can replace many old systems.',
          'I am still learning AI, so I cannot explain my focus very well.'
        ],
        0,
        [
          'Best: specific, realistic, and professionally framed.',
          'Too trend-driven and lacks personal focus.',
          'Too strong and may sound careless about impact.',
          'Too weak; it does not communicate readiness.'
        ],
        'ต้องมี focus + context + professional tone',
        'ถูกต้อง เพราะอธิบาย focus ด้าน AI อย่างชัดและสมจริง'
      ),

      mcQ(2,10,'challenge','reading',
        'NPC says: “I only have one minute. Why should I remember your project idea?” Choose the most memorable response.',
        '',
        [
          'It turns English practice into short VR missions, so CS/AI students can speak, listen, read, and write in realistic tech scenarios.',
          'It is an English learning game with AI, VR, and many sessions for students.',
          'It is useful because English is important for technology careers and students need more practice.',
          'It has many features, such as voice, score, dashboard, and questions.'
        ],
        0,
        [
          'Best: clear value, target users, method, and learning skills.',
          'Good but too descriptive and less memorable.',
          'True but generic and not project-specific.',
          'Feature list without a strong value proposition.'
        ],
        'คำตอบ challenge ต้องเป็น value proposition ที่จำง่าย',
        'ถูกต้อง เพราะสรุป value proposition ได้ครบและชัด'
      )
    ],

    3: [
      textQ(3,1,'easy','writing',
        'Hacker Virus says: “Login is broken.” Type a short developer reply.',
        'I will check the login error and restart the login service.',
        ['check','login','error','restart'],
        'ตอบให้มี action ที่ชัด เช่น check / restart / fix'
      ),
      textQ(3,2,'easy','writing',
        'Hacker Virus says: “The app is slow.” Type a simple counterattack message.',
        'I will check the server and reduce the loading time.',
        ['check','server','loading','time'],
        'อธิบายว่าจะตรวจ server หรือ loading'
      ),
      textQ(3,3,'easy','writing',
        'Hacker Virus says: “Users cannot open the page.” Type a short fix message.',
        'I will check the page link and fix the server error.',
        ['check','page','link','server','error'],
        'ตอบสั้นแต่ต้องมีสิ่งที่จะตรวจ'
      ),

      textQ(3,4,'normal','writing',
        'Hacker Virus attacks the database. Type a clear response to protect user data.',
        'I will back up the database, check the error log, and protect user data.',
        ['backup','database','log','protect','data'],
        'ควรมี backup + log + protect data'
      ),
      textQ(3,5,'normal','writing',
        'Hacker Virus changes a bug ticket. Type a developer message to the team.',
        'The ticket was changed. I will verify the issue, update the status, and inform the team.',
        ['ticket','verify','issue','update','team'],
        'ต้องสื่อสารกับ team แบบชัดเจน'
      ),
      textQ(3,6,'normal','writing',
        'Hacker Virus blocks the API. Type a fast technical reply.',
        'I will check the API response, review the logs, and restart the service if needed.',
        ['api','response','logs','restart','service'],
        'ควรมี API + logs + action'
      ),

      textQ(3,7,'hard','writing',
        'Boss attack: “The payment page fails after deployment.” Type a professional incident response.',
        'I will roll back the deployment, check the payment logs, and confirm the fix with a test transaction.',
        ['rollback','deployment','payment','logs','test'],
        'ต้องมี rollback/test ไม่ใช่แค่ restart'
      ),
      textQ(3,8,'hard','writing',
        'Boss attack: “The server is overloaded during peak time.” Type a clear mitigation plan.',
        'I will monitor server load, scale the service, and optimize the slow database queries.',
        ['monitor','load','scale','optimize','queries'],
        'ใช้คำระดับ developer เช่น monitor, scale, optimize'
      ),
      textQ(3,9,'hard','writing',
        'Boss attack: “Users report missing data after the update.” Type a careful response.',
        'I will stop the update, compare the backup, check the migration script, and restore missing data safely.',
        ['stop','backup','migration','restore','data'],
        'ควรระวัง data loss และมี backup/migration'
      ),

      textQ(3,10,'challenge','writing',
        'Final boss attack in S3: “A hacker changed the login flow and users are locked out.” Type a concise emergency response.',
        'I will disable the changed login flow, restore the safe version, check access logs, and notify users after testing.',
        ['disable','login','restore','logs','notify','testing'],
        'ต้องมี disable/restore/logs/notify/testing ครบ'
      )
    ],

    4: [
      textQ(4,1,'easy','speaking',
        'Give a short stand-up update: yesterday, today, and blocker.',
        'Yesterday, I studied HTML. Today, I will build the login page. My blocker is the API error.',
        ['yesterday','today','blocker','api'],
        'ต้องมี 3 ส่วน Yesterday / Today / Blocker'
      ),
      textQ(4,2,'easy','speaking',
        'Say a simple stand-up update about fixing a bug.',
        'Yesterday, I found a bug. Today, I will fix it. My blocker is testing data.',
        ['yesterday','bug','today','fix','blocker'],
        'พูดสั้นและใช้ tense ถูก'
      ),
      textQ(4,3,'easy','speaking',
        'Tell your team what you will do today.',
        'Today, I will update the user interface and test the button again.',
        ['today','update','interface','test'],
        'ใช้ will + task'
      ),

      textQ(4,4,'normal','speaking',
        'Give a stand-up update for a web app project with one risk.',
        'Yesterday, I finished the profile page. Today, I will connect it to the database. The risk is slow API response.',
        ['yesterday','finished','today','database','risk'],
        'เพิ่มคำว่า risk หรือ blocker ให้ชัด'
      ),
      textQ(4,5,'normal','speaking',
        'Explain a blocker politely during a stand-up meeting.',
        'I am blocked because the API key is not ready. Could someone confirm the correct key today?',
        ['blocked','api','key','confirm','today'],
        'พูด blocker และขอความช่วยเหลือสุภาพ'
      ),
      textQ(4,6,'normal','speaking',
        'Update your team about testing progress.',
        'Yesterday, I tested the login form. Today, I will test the dashboard. I need sample data to continue.',
        ['tested','login','dashboard','sample','data'],
        'ต้องมี progress + next task + need'
      ),

      textQ(4,7,'hard','speaking',
        'Give a clear stand-up update about an AI feature and a dependency.',
        'Yesterday, I improved the AI feedback prompt. Today, I will test it with student answers. I am waiting for the new dataset.',
        ['improved','ai','feedback','test','dataset'],
        'ใช้คำเทคนิคและ dependency'
      ),
      textQ(4,8,'hard','speaking',
        'Report a blocker without blaming another team.',
        'I cannot finish the integration yet because the API response format changed. I will check the documentation and ask for clarification.',
        ['integration','api','format','documentation','clarification'],
        'หลีกเลี่ยง blame และเสนอ action'
      ),
      textQ(4,9,'hard','speaking',
        'Give a stand-up update under time pressure in one concise paragraph.',
        'Yesterday, I fixed the dashboard layout. Today, I will connect the chart data. My blocker is unclear field names in the API.',
        ['fixed','dashboard','chart','blocker','api'],
        'พูดกระชับ ไม่เล่าเกินจำเป็น'
      ),

      textQ(4,10,'challenge','speaking',
        'Give a polished stand-up update for an international remote team.',
        'Yesterday, I completed the speech recognition test. Today, I will improve error handling. My blocker is inconsistent audio input, so I need feedback from mobile testers.',
        ['completed','speech','recognition','error','mobile','testers'],
        'ต้อง professional และเหมาะกับ remote team'
      )
    ],

    5: [
      mcQ(5,1,'easy','listening',
        'Listen only.',
        'Alert. The login page is slow. Please check the database first.',
        [
          'The login page is slow, and the database should be checked first.',
          'The login page is broken, and the whole app should be restarted.',
          'The database is slow, but the team should wait until tomorrow.',
          'The login page color is wrong, and the designer should fix it.'
        ],
        0,
        [
          'Best: matches login page, slow, and database first.',
          'Similar topic but wrong action and severity.',
          'Mentions database but changes the action and timing.',
          'Mentions login page but changes the problem.'
        ],
        'ฟัง problem + action + priority',
        'ถูกต้อง เพราะจับ keyword “login page”, “slow”, และ “database first” ได้ครบ'
      ),
      mcQ(5,2,'easy','listening',
        'Listen only.',
        'Alert. The server is down. Please restart the backend service.',
        [
          'The server is down, and the backend service should be restarted.',
          'The server is slow, and the frontend color should be changed.',
          'The backend is ready, and the server should be ignored.',
          'The service is down, but the database should be deleted.'
        ],
        0,
        [
          'Best: exact problem and correct action.',
          'Wrong severity and wrong action.',
          'Opposite meaning: backend is not ready; it needs restart.',
          'Dangerous and incorrect action.'
        ],
        'จับคำว่า down + restart + backend service',
        'ถูกต้อง เพราะเลือก action ที่ตรงกับเสียง'
      ),
      mcQ(5,3,'easy','listening',
        'Listen only.',
        'Alert. The upload button is not working. Please test it on mobile.',
        [
          'The upload button is not working, and it should be tested on mobile.',
          'The download button is not working, and it should be tested on desktop.',
          'The upload button works well, but mobile users need a new design.',
          'The login button is not working, and the database should be tested.'
        ],
        0,
        [
          'Best: matches button, problem, and device.',
          'Close but wrong button and device.',
          'Opposite meaning; the button is not working.',
          'Wrong feature and wrong target.'
        ],
        'ฟัง feature + device',
        'ถูกต้อง เพราะจับ feature “upload button” และ “mobile” ได้'
      ),

      mcQ(5,4,'normal','listening',
        'Listen only.',
        'System message. The API response is delayed after the new deployment. Check the logs before changing the code.',
        [
          'The API response is delayed, and the logs should be checked before code changes.',
          'The API response is wrong, and the code should be changed before checking logs.',
          'The deployment is canceled, and the API should be removed from the app.',
          'The logs are delayed, and the team should change the user interface first.'
        ],
        0,
        [
          'Best: preserves problem, sequence, and action.',
          'Close but reverses the required order.',
          'Incorrect; deployment is not canceled.',
          'Uses some keywords but changes the problem.'
        ],
        'Listening normal ต้องจับ sequence: before/after',
        'ถูกต้อง เพราะเข้าใจลำดับ “check logs before changing code”'
      ),
      mcQ(5,5,'normal','listening',
        'Listen only.',
        'Message from QA. The search results are correct on desktop, but missing on mobile.',
        [
          'Search results work on desktop but are missing on mobile.',
          'Search results are missing on desktop but correct on mobile.',
          'Search results are slow on both desktop and mobile.',
          'Search results are correct, but the mobile menu is missing.'
        ],
        0,
        [
          'Best: exact contrast between desktop and mobile.',
          'Reverses the devices.',
          'Changes missing to slow and changes scope.',
          'Moves the problem from results to menu.'
        ],
        'ฟัง contrast: desktop vs mobile',
        'ถูกต้อง เพราะจับ detail ของ device ได้ถูก'
      ),
      mcQ(5,6,'normal','listening',
        'Listen only.',
        'Team update. The payment test passed, but the email notification failed.',
        [
          'The payment test passed, but the email notification failed.',
          'The payment test failed, but the email notification passed.',
          'Both the payment test and email notification failed.',
          'The payment page passed, but the email design was changed.'
        ],
        0,
        [
          'Best: exact passed/failed contrast.',
          'Reverses the result.',
          'Changes one failure into two failures.',
          'Uses similar words but changes notification to design.'
        ],
        'ฟัง passed / failed ให้ดี',
        'ถูกต้อง เพราะจับผลของแต่ละระบบถูกต้อง'
      ),

      mcQ(5,7,'hard','listening',
        'Listen only.',
        'Urgent alert. Do not restart the server yet. First, export the current logs and check active users.',
        [
          'Do not restart yet; export logs first and check active users.',
          'Restart the server first, then export logs and remove active users.',
          'Export the active users first and ignore the current logs.',
          'Restart the server after deleting logs and checking users.'
        ],
        0,
        [
          'Best: follows negative command and ordered actions.',
          'Violates “do not restart yet” and changes active users action.',
          'Mixes keywords but misses current logs.',
          'Dangerous; deleting logs was not requested.'
        ],
        'Hard listening ต้องจับ negative command: Do not...',
        'ถูกต้อง เพราะไม่ restart และทำตามลำดับก่อน'
      ),
      mcQ(5,8,'hard','listening',
        'Listen only.',
        'Client note. Users can sign up with email, but they cannot sign in with Google.',
        [
          'Email sign-up works, but Google sign-in does not work.',
          'Google sign-up works, but email sign-in does not work.',
          'Both email sign-up and Google sign-in work correctly.',
          'Email sign-in works, but Google sign-up does not work.'
        ],
        0,
        [
          'Best: exact action and provider.',
          'Swaps sign-up/sign-in and provider.',
          'Opposite; Google sign-in fails.',
          'Uses similar words but wrong action/provider.'
        ],
        'จับ sign up vs sign in และ email vs Google',
        'ถูกต้อง เพราะแยก action/provider ได้แม่น'
      ),
      mcQ(5,9,'hard','listening',
        'Listen only.',
        'System warning. The AI feedback is too long for beginner users. Make it shorter, not more detailed.',
        [
          'The AI feedback should be shorter for beginner users.',
          'The AI feedback should be more detailed for beginner users.',
          'The beginner users should write longer feedback to the AI.',
          'The AI feedback is too short, so it should be expanded.'
        ],
        0,
        [
          'Best: captures “too long” and “make it shorter”.',
          'Opposite instruction.',
          'Changes who gives feedback.',
          'Opposite problem and action.'
        ],
        'จับคำว่า too long และ not more detailed',
        'ถูกต้อง เพราะเลือก action ที่ตรงกับ warning'
      ),

      mcQ(5,10,'challenge','listening',
        'Listen only.',
        'Emergency. Keep the current version online. Roll back only the chatbot module, and do not change the payment service.',
        [
          'Keep the current version online, roll back only the chatbot module, and do not change payment.',
          'Take the current version offline, roll back payment, and keep the chatbot module unchanged.',
          'Keep the payment service online, but roll back the whole app and chatbot module.',
          'Change the payment service first, then roll back the chatbot module if needed.'
        ],
        0,
        [
          'Best: preserves all three constraints exactly.',
          'Reverses the online instruction and wrong module.',
          'Over-applies rollback to the whole app.',
          'Violates “do not change payment”.'
        ],
        'Challenge listening ต้องจับ constraint หลายชั้น',
        'ถูกต้อง เพราะทำตามข้อจำกัดทั้งหมด'
      )
    ],

    6: [
      mcQ(6,1,'easy','reading',
        'Ticket: “Users cannot reset their password. Error appears after clicking the email link.” Choose the fastest useful fix.',
        '',
        [
          'Check the reset link token and test the password reset email flow.',
          'Change the login page color so users feel more confident.',
          'Ask users to create a new account instead of resetting password.',
          'Delete all old passwords and send a new default password.'
        ],
        0,
        [
          'Best: targets token and reset email flow.',
          'Not related to the reset error.',
          'Avoids the problem and creates friction.',
          'Unsafe and inappropriate.'
        ],
        'Ticket reading ต้องแก้ตรง feature ที่เสีย',
        'ถูกต้อง เพราะเลือก action ที่ตรงกับ password reset link'
      ),
      mcQ(6,2,'easy','reading',
        'Ticket: “The profile image does not upload on mobile.” Choose the best first action.',
        '',
        [
          'Test image upload on mobile and check file size or permission errors.',
          'Remove the profile image feature from the mobile version.',
          'Ask users to upload images from desktop only.',
          'Change the profile page title and test again later.'
        ],
        0,
        [
          'Best: tests the exact device and possible causes.',
          'Too extreme before investigation.',
          'Avoids fixing the mobile issue.',
          'Not related to image upload.'
        ],
        'เลือก first action ที่ตรวจปัญหาจริง',
        'ถูกต้อง เพราะเริ่มจาก reproduce และ check causes'
      ),
      mcQ(6,3,'easy','reading',
        'Ticket: “The contact form sends blank messages.” Choose the most relevant fix.',
        '',
        [
          'Validate the message field before sending the form.',
          'Move the contact form to another page.',
          'Add more colors to the contact form button.',
          'Tell users to write shorter messages.'
        ],
        0,
        [
          'Best: blank messages need validation.',
          'Does not fix blank submissions.',
          'UI color is unrelated.',
          'Message length is not the issue.'
        ],
        'จับ cause: blank messages → validation',
        'ถูกต้อง เพราะ validation แก้ปัญหาตรงจุด'
      ),

      mcQ(6,4,'normal','reading',
        'Ticket: “After deployment, the dashboard loads, but charts show old data.” Choose the best fix.',
        '',
        [
          'Check the chart data cache and refresh the dashboard API response.',
          'Restart the user browser and ask users to wait longer.',
          'Change the chart colors because old data looks confusing.',
          'Remove the charts until the next release.'
        ],
        0,
        [
          'Best: old data suggests cache/API refresh issue.',
          'May not address server-side data freshness.',
          'Visual change does not solve stale data.',
          'Too extreme and not a fix.'
        ],
        'Old data มักเกี่ยวกับ cache/API',
        'ถูกต้อง เพราะระบุ cache และ API response'
      ),
      mcQ(6,5,'normal','reading',
        'Ticket: “Only teachers can see the leaderboard. Students get permission denied.” Choose the best action.',
        '',
        [
          'Review database rules and give students read access to public leaderboard data.',
          'Give all students full admin access so they can view the leaderboard.',
          'Hide the leaderboard from teachers and students until next term.',
          'Tell students to log in with the teacher account.'
        ],
        0,
        [
          'Best: fixes permission with least necessary access.',
          'Unsafe over-permission.',
          'Avoids solving the issue.',
          'Unsafe credential sharing.'
        ],
        'Permission issue ต้องใช้ least privilege',
        'ถูกต้อง เพราะแก้ rules แบบปลอดภัย'
      ),
      mcQ(6,6,'normal','reading',
        'Ticket: “The app saves scores locally, but the teacher dashboard shows no new data.” Choose the best next step.',
        '',
        [
          'Check the logging endpoint and confirm that session_end events are sent.',
          'Increase the local score value so the dashboard refreshes.',
          'Clear the student browser history before every session.',
          'Ask the teacher to manually type every score.'
        ],
        0,
        [
          'Best: dashboard missing data points to endpoint/event sending.',
          'Local score does not guarantee server logging.',
          'Browser history is unrelated.',
          'Not scalable or appropriate.'
        ],
        'Dashboard ไม่มี data → check endpoint/event',
        'ถูกต้อง เพราะตรวจ logging pipeline ตรงจุด'
      ),

      mcQ(6,7,'hard','reading',
        'Ticket: “Speech recognition works on desktop Chrome, but not on mobile Safari.” Choose the best developer response.',
        '',
        [
          'Check browser support, show a fallback text input, and explain microphone permission clearly.',
          'Remove speech recognition because one browser cannot run it.',
          'Tell all users to buy Android phones and use Chrome.',
          'Restart the server because microphone problems are always backend issues.'
        ],
        0,
        [
          'Best: addresses compatibility and fallback.',
          'Too extreme; feature can still work elsewhere.',
          'Unprofessional and unrealistic.',
          'Mic/browser issues are not always backend.'
        ],
        'Browser compatibility ต้องมี fallback',
        'ถูกต้อง เพราะทั้งแก้และรองรับผู้ใช้'
      ),
      mcQ(6,8,'hard','reading',
        'Ticket: “Students can answer, but the same question repeats and never moves forward.” Choose the best fix.',
        '',
        [
          'Check state locking, next-question logic, and the index update after answer submission.',
          'Add more background music so students feel progress.',
          'Change all questions to easier levels to avoid repetition.',
          'Remove the submit button and use only automatic scoring.'
        ],
        0,
        [
          'Best: targets state/progress logic.',
          'Music does not fix repeated question state.',
          'Difficulty is not the core bug.',
          'May create a new issue and does not fix state.'
        ],
        'Repeated question → state / index / transition',
        'ถูกต้อง เพราะตรวจ logic หลัง submission'
      ),
      mcQ(6,9,'hard','reading',
        'Ticket: “Audio plays, but answer choices stay disabled for some users.” Choose the safest fix.',
        '',
        [
          'Enable choices after audio starts or ends, and add a fallback button if audio fails.',
          'Keep choices disabled until users refresh the page manually.',
          'Remove the audio step so all users only read text.',
          'Ask users to click very quickly before the audio starts.'
        ],
        0,
        [
          'Best: handles both normal audio and failure path.',
          'Bad UX and does not solve the issue.',
          'Removes an important listening feature.',
          'Unreliable and confusing.'
        ],
        'Audio failure ต้องมี fallback path',
        'ถูกต้อง เพราะแก้ disabled state และรองรับ failure'
      ),

      mcQ(6,10,'challenge','reading',
        'Boss Ticket: “After adding AI difficulty, S9 sometimes loads a writing question instead of speaking. Logs show mixed source ids.” Choose the best fix.',
        '',
        [
          'Validate session-skill mapping, filter the bank by session id and skill, and log the selected question source.',
          'Disable AI difficulty because random selection is always unsafe.',
          'Move all speaking questions to S9 and delete writing questions from other sessions.',
          'Hide the skill label so students do not notice the mismatch.'
        ],
        0,
        [
          'Best: fixes mapping, filtering, and traceability.',
          'Too broad and removes useful adaptation.',
          'Breaks other sessions and data structure.',
          'Hides the problem instead of fixing it.'
        ],
        'Boss ต้องคิดเรื่อง mapping + filtering + logging',
        'ถูกต้อง เพราะแก้ root cause และตรวจย้อนหลังได้'
      )
    ],

    7: [
      textQ(7,1,'easy','writing',
        'Client asks: “What is an API?” Type a simple answer.',
        'An API helps two systems talk to each other.',
        ['api','systems','talk'],
        'อธิบายให้ non-tech เข้าใจง่าย'
      ),
      textQ(7,2,'easy','writing',
        'Client asks: “Why do we need a database?” Type a simple answer.',
        'A database stores important information so the app can use it later.',
        ['database','stores','information','app'],
        'ใช้คำว่า store information'
      ),
      textQ(7,3,'easy','writing',
        'Client asks: “What is a bug?” Type a simple answer.',
        'A bug is a problem in the app that makes something work incorrectly.',
        ['bug','problem','app','incorrectly'],
        'อธิบาย bug แบบไม่เทคนิคเกินไป'
      ),

      textQ(7,4,'normal','writing',
        'Client asks: “Why is testing important before launch?” Type a clear answer.',
        'Testing is important because it helps us find problems before real users use the app.',
        ['testing','important','find','problems','users'],
        'พูดเรื่องก่อน launch และ real users'
      ),
      textQ(7,5,'normal','writing',
        'Client asks: “Why does the app need login?” Type a simple business-friendly answer.',
        'Login helps protect user data and lets each user see their own information.',
        ['login','protect','user','data','information'],
        'อธิบาย security + personal data'
      ),
      textQ(7,6,'normal','writing',
        'Client asks: “What does AI do in this app?” Type a simple explanation.',
        'AI gives feedback and suggests practice based on the learner’s answers.',
        ['ai','feedback','practice','answers'],
        'อธิบาย AI function ให้ชัด'
      ),

      textQ(7,7,'hard','writing',
        'Client asks: “Why will development take more time?” Type a polite explanation.',
        'It will take more time because we need to test login, data saving, and mobile compatibility carefully.',
        ['time','test','login','data','mobile'],
        'ตอบสุภาพและบอกเหตุผล'
      ),
      textQ(7,8,'hard','writing',
        'Client asks: “Can we add every feature this week?” Type a realistic reply.',
        'We can start with the most important features this week and add the rest in the next version.',
        ['important','features','week','next','version'],
        'ต้อง manage scope อย่างสุภาพ'
      ),
      textQ(7,9,'hard','writing',
        'Client asks: “Why should we pay for user research?” Type a simple value explanation.',
        'User research helps us understand real needs, reduce mistakes, and build a product people will use.',
        ['user','research','needs','mistakes','product'],
        'อธิบาย value ไม่ใช่แค่ cost'
      ),

      textQ(7,10,'challenge','writing',
        'Client asks: “Explain AI personalization without technical jargon.” Type a strong simple answer.',
        'AI personalization means the app learns from each learner’s answers and gives practice that fits their level.',
        ['ai','personalization','learns','answers','practice','level'],
        'ต้องไม่ใช้ศัพท์ยาก เช่น model, algorithm มากเกินไป'
      )
    ],

    8: [
      mcQ(8,1,'easy','listening',
        'Listen only.',
        'Ethics question. Should we share a student’s private score without permission? No.',
        [
          'No, we should not share a private score without permission.',
          'Yes, we can share it if it helps the class compare scores.',
          'Yes, but only if the score is high and positive.',
          'No, unless the teacher wants to post it publicly.'
        ],
        0,
        [
          'Best: follows privacy and permission.',
          'Comparison does not remove privacy requirements.',
          'Positive data can still be private.',
          'Teacher convenience does not replace permission.'
        ],
        'ฟัง Yes/No และเหตุผลเรื่อง privacy',
        'ถูกต้อง เพราะปกป้องข้อมูลส่วนตัว'
      ),
      mcQ(8,2,'easy','listening',
        'Listen only.',
        'Ethics question. Should AI explain why it gives feedback? Yes.',
        [
          'Yes, AI should explain feedback so learners can improve.',
          'No, AI feedback should be secret so it feels powerful.',
          'Yes, but only teachers should understand the reason.',
          'No, learners only need scores, not explanations.'
        ],
        0,
        [
          'Best: explainability supports learning.',
          'Secret feedback is not learner-friendly.',
          'Learners also need understandable reasons.',
          'Scores alone do not guide improvement.'
        ],
        'จับคำว่า explain why',
        'ถูกต้อง เพราะ feedback ควร explainable'
      ),
      mcQ(8,3,'easy','listening',
        'Listen only.',
        'Ethics question. Should we use student data only for learning support? Yes.',
        [
          'Yes, student data should be used only for clear learning support.',
          'Yes, student data can be sold if names are removed.',
          'No, student data should be used for any experiment.',
          'No, student data is not important in learning apps.'
        ],
        0,
        [
          'Best: purpose-limited and learner-centered.',
          'Selling data is not appropriate in this context.',
          'Too broad and unsafe.',
          'Incorrect; student data is important.'
        ],
        'ข้อมูลผู้เรียนต้องใช้ตาม purpose',
        'ถูกต้อง เพราะจำกัดการใช้ข้อมูลเพื่อการเรียน'
      ),

      mcQ(8,4,'normal','listening',
        'Listen only.',
        'Ethics question. If an AI system is less accurate for some groups, should the team test for bias? Yes.',
        [
          'Yes, the team should test for bias and improve fairness.',
          'No, lower accuracy for some groups is normal and should be ignored.',
          'Yes, but only after the product becomes popular.',
          'No, fairness is less important than speed.'
        ],
        0,
        [
          'Best: bias testing and fairness are required.',
          'Ignoring group differences is unethical.',
          'Waiting can harm users.',
          'Speed should not override fairness.'
        ],
        'ฟัง less accurate + groups + bias',
        'ถูกต้อง เพราะต้อง test bias'
      ),
      mcQ(8,5,'normal','listening',
        'Listen only.',
        'Ethics question. Should users know when they are talking to AI instead of a human? Yes.',
        [
          'Yes, users should know when they are talking to AI.',
          'No, hiding AI makes the service feel more human.',
          'Yes, but only if the user asks directly.',
          'No, users only need correct answers.'
        ],
        0,
        [
          'Best: transparency about AI interaction.',
          'Hiding AI is misleading.',
          'Disclosure should not depend only on asking.',
          'Correctness does not replace transparency.'
        ],
        'จับเรื่อง transparency',
        'ถูกต้อง เพราะผู้ใช้ควรรู้ว่าเป็น AI'
      ),
      mcQ(8,6,'normal','listening',
        'Listen only.',
        'Ethics question. Should a developer copy code from the internet without checking the license? No.',
        [
          'No, the developer should check the license before using the code.',
          'Yes, public code can always be used in any project.',
          'No, unless the code is short and easy to copy.',
          'Yes, if the copied code works better than our code.'
        ],
        0,
        [
          'Best: license must be checked.',
          'Public does not always mean free for any use.',
          'Short code can still have license issues.',
          'Working well does not remove legal obligations.'
        ],
        'ฟัง license และ copy code',
        'ถูกต้อง เพราะต้องตรวจ license ก่อน'
      ),

      mcQ(8,7,'hard','listening',
        'Listen only.',
        'Ethics question. If a dataset contains personal information, should the team anonymize it before analysis? Yes.',
        [
          'Yes, the team should anonymize personal information before analysis.',
          'No, analysis is easier if personal details stay visible.',
          'Yes, but only after the analysis is finished.',
          'No, anonymization is only needed for medical data.'
        ],
        0,
        [
          'Best: anonymization before analysis protects privacy.',
          'Convenience does not justify exposing data.',
          'Too late; privacy should be protected before analysis.',
          'Personal data exists beyond medical data.'
        ],
        'จับ timing: before analysis',
        'ถูกต้อง เพราะ anonymize ก่อนวิเคราะห์'
      ),
      mcQ(8,8,'hard','listening',
        'Listen only.',
        'Ethics question. Should an AI learning app clearly tell students what data is collected and why? Yes.',
        [
          'Yes, students should know what data is collected and why.',
          'No, data collection details may confuse students.',
          'Yes, but only in a hidden technical document.',
          'No, the app can collect data if it improves scores.'
        ],
        0,
        [
          'Best: clear notice and purpose.',
          'Avoiding confusion is not a reason to hide data use.',
          'Hidden documents are not clear enough.',
          'Improvement does not remove consent/notice.'
        ],
        'ฟัง what data + why',
        'ถูกต้อง เพราะต้องแจ้งข้อมูลและเหตุผลอย่างชัดเจน'
      ),
      mcQ(8,9,'hard','listening',
        'Listen only.',
        'Ethics question. If AI gives harmful advice, should the team add safety rules and human review? Yes.',
        [
          'Yes, safety rules and human review should be added.',
          'No, users should decide whether advice is harmful.',
          'Yes, but only for paid users.',
          'No, AI should answer freely without restrictions.'
        ],
        0,
        [
          'Best: safety controls and review reduce harm.',
          'Shifts responsibility unfairly to users.',
          'Safety should not depend on payment.',
          'Unrestricted harmful advice is unsafe.'
        ],
        'จับ harmful advice + safety rules + human review',
        'ถูกต้อง เพราะใช้ safety layer'
      ),

      mcQ(8,10,'challenge','listening',
        'Listen only.',
        'Ethics committee question. If a model is accurate but unfair to a smaller group, should the team delay launch and fix fairness issues? Yes.',
        [
          'Yes, the team should delay launch and fix fairness issues.',
          'No, high overall accuracy is enough for launch.',
          'Yes, but only if the smaller group complains first.',
          'No, fairness can be fixed after users accept the product.'
        ],
        0,
        [
          'Best: fairness issue requires action before launch.',
          'Overall accuracy can hide group harm.',
          'Teams should not wait for harm complaints.',
          'Fixing later may already harm users.'
        ],
        'Challenge ethics ต้องไม่ดูแค่ accuracy รวม',
        'ถูกต้อง เพราะคำนึงถึง fairness ก่อน launch'
      )
    ],

    9: [
      textQ(9,1,'easy','speaking',
        'Data Lock asks: “What does this chart show?” Say a simple data insight.',
        'The chart shows that sales increased this month.',
        ['chart','shows','sales','increased'],
        'พูด insight ง่าย ๆ: chart shows + trend'
      ),
      textQ(9,2,'easy','speaking',
        'Say one sentence about a decreasing trend.',
        'The number of active users decreased last week.',
        ['active','users','decreased','week'],
        'ใช้คำว่า decreased ให้ถูก'
      ),
      textQ(9,3,'easy','speaking',
        'Say one sentence about the highest value in a chart.',
        'The highest value is in March.',
        ['highest','value','march'],
        'พูดสั้น ๆ แต่มี highest value'
      ),

      textQ(9,4,'normal','speaking',
        'Unlock the data door: describe a chart where website visits increased after a campaign.',
        'Website visits increased after the campaign, so the campaign may have attracted more users.',
        ['website','visits','increased','campaign','users'],
        'เชื่อม trend กับ possible reason'
      ),
      textQ(9,5,'normal','speaking',
        'Explain a data finding to a non-technical manager.',
        'The data suggests that mobile users need a faster login process.',
        ['data','suggests','mobile','users','login'],
        'ใช้คำว่า suggests แทนการสรุปแรงเกินไป'
      ),
      textQ(9,6,'normal','speaking',
        'Say a careful insight about customer complaints increasing.',
        'Customer complaints increased, so we should check the recent update and support tickets.',
        ['complaints','increased','check','update','tickets'],
        'เสนอ action จาก insight'
      ),

      textQ(9,7,'hard','speaking',
        'Boss Lock: Explain a trend and a limitation in one answer.',
        'The chart shows a steady increase in users, but we need more data before making a final decision.',
        ['chart','increase','users','more','data','decision'],
        'ต้องมี trend + limitation'
      ),
      textQ(9,8,'hard','speaking',
        'Boss Lock: Give a precise insight from data about low engagement.',
        'The data shows low engagement after lesson five, so we should review the difficulty and activity design.',
        ['data','engagement','lesson','difficulty','design'],
        'พูด insight + action ที่เกี่ยวกับ learning design'
      ),
      textQ(9,9,'hard','speaking',
        'Boss Lock: Explain why one spike in data is not enough.',
        'One spike is not enough because it may be caused by a special event or a data error.',
        ['spike','not','enough','event','error'],
        'พูดเรื่อง data caution'
      ),

      textQ(9,10,'challenge','speaking',
        'Final Data Lock: Give a clear data insight with trend, possible cause, and next action.',
        'The chart shows that speaking scores improved after feedback was added. The possible cause is clearer guidance, so we should test it with another group.',
        ['chart','speaking','scores','improved','feedback','test','group'],
        'ต้องครบ trend + cause + next action'
      )
    ],

    10: [
      mcQ(10,1,'easy','reading',
        'Client Hologram: “We need a simple page where students can see their score.” Choose the best reply.',
        '',
        [
          'I will create a student score page with clear score information.',
          'I will create a teacher payment page with many settings.',
          'I will remove the score page and show only a welcome screen.',
          'I will create a complex analytics dashboard for administrators only.'
        ],
        0,
        [
          'Best: matches student + score page.',
          'Wrong user and wrong feature.',
          'Opposite of the requirement.',
          'Too complex and wrong target user.'
        ],
        'อ่าน user + feature ให้ตรง',
        'ถูกต้อง เพราะตรงกับ requirement'
      ),
      mcQ(10,2,'easy','reading',
        'Client Hologram: “Please add a button to go back to the lesson menu.” Choose the best action.',
        '',
        [
          'Add a clear Back to Lesson Menu button.',
          'Add a button to delete all lesson data.',
          'Hide the menu so students focus on one lesson.',
          'Add more text instead of a navigation button.'
        ],
        0,
        [
          'Best: directly implements requested navigation.',
          'Dangerous and unrelated.',
          'Opposite of the request.',
          'Does not solve navigation.'
        ],
        'ต้องเลือก action ที่ตรงกับ request',
        'ถูกต้อง เพราะเพิ่มปุ่มกลับเมนูตรงตามที่ขอ'
      ),
      mcQ(10,3,'easy','reading',
        'Client Hologram: “The page should work on mobile.” Choose the best response.',
        '',
        [
          'I will make the layout responsive and test it on mobile screens.',
          'I will make the page larger so desktop users can see more.',
          'I will ask mobile users to rotate the phone all the time.',
          'I will remove buttons because mobile screens are small.'
        ],
        0,
        [
          'Best: responsive layout and mobile testing.',
          'Focuses on desktop, not mobile.',
          'Bad UX and not a full solution.',
          'Removing buttons breaks interaction.'
        ],
        'Mobile requirement → responsive + test',
        'ถูกต้อง เพราะแก้ mobile compatibility'
      ),

      mcQ(10,4,'normal','reading',
        'Client Hologram: “Students should not see the answer before they try.” Choose the best design decision.',
        '',
        [
          'Hide the correct answer until after the student submits an attempt.',
          'Show the correct answer first so students feel confident.',
          'Show all answers and let students choose the longest one.',
          'Remove feedback because answers are difficult to manage.'
        ],
        0,
        [
          'Best: supports fair practice and feedback after attempt.',
          'Makes the activity too easy and invalid.',
          'Encourages guessing, not learning.',
          'Removes learning support.'
        ],
        'Requirement เกี่ยวกับ attempt ก่อน answer',
        'ถูกต้อง เพราะช่วยให้เรียนรู้จริง'
      ),
      mcQ(10,5,'normal','reading',
        'Client Hologram: “The teacher wants to know how long each session takes.” Choose the best response.',
        '',
        [
          'Log the start time, end time, and duration for each session.',
          'Only log the final score because time is not important.',
          'Ask students to write their time manually after class.',
          'Use one average time for all students.'
        ],
        0,
        [
          'Best: captures the needed time fields.',
          'Missing the specific requirement.',
          'Manual reporting is unreliable.',
          'Average time hides individual session time.'
        ],
        'ต้อง log start/end/duration',
        'ถูกต้อง เพราะบันทึกเวลาราย session ได้'
      ),
      mcQ(10,6,'normal','reading',
        'Client Hologram: “Some learners need easier questions first.” Choose the best feature.',
        '',
        [
          'Add adaptive difficulty that starts easier and changes based on performance.',
          'Give all learners the hardest questions so they improve faster.',
          'Let learners skip all easy questions because they are boring.',
          'Use the same random question level for everyone.'
        ],
        0,
        [
          'Best: adaptive and learner-centered.',
          'Too difficult and may discourage learners.',
          'Skipping easy questions may harm beginners.',
          'Not responsive to learner needs.'
        ],
        'Learner needs → adaptive difficulty',
        'ถูกต้อง เพราะใช้ performance ปรับระดับ'
      ),

      mcQ(10,7,'hard','reading',
        'Client Hologram: “We want fun gameplay, but students must still understand the task.” Choose the best design approach.',
        '',
        [
          'Use 3D effects for context, but keep instructions and answers clear in a 2D overlay.',
          'Put all instructions inside fast-moving 3D objects to make it exciting.',
          'Remove instructions and let students discover everything by trial and error.',
          'Use only a worksheet layout because games may distract students.'
        ],
        0,
        [
          'Best: hybrid 3D supports fun and clarity.',
          'Exciting but may reduce readability.',
          'Too confusing for learning.',
          'Ignores the gameplay goal.'
        ],
        'Fun + clarity = hybrid 3D',
        'ถูกต้อง เพราะรักษาความชัดของโจทย์'
      ),
      mcQ(10,8,'hard','reading',
        'Client Hologram: “The app should show progress from S1 to S15.” Choose the best solution.',
        '',
        [
          'Show a session map with completed, current, boss, and final stages.',
          'Show only the current question because progress may confuse learners.',
          'Hide completed stages so students replay randomly.',
          'Show a long paragraph explaining every session.'
        ],
        0,
        [
          'Best: visual map supports progress and motivation.',
          'Progress is useful, not confusing if designed well.',
          'Hiding progress reduces motivation.',
          'Too text-heavy for a game.'
        ],
        'Progress ต้องเป็น map/card ไม่ใช่ paragraph ยาว',
        'ถูกต้อง เพราะแสดงเส้นทางเรียนแบบเกม'
      ),
      mcQ(10,9,'hard','reading',
        'Client Hologram: “We need evidence that students actually attended S sessions.” Choose the best logging plan.',
        '',
        [
          'Log page open, session start, answer, session end, and duration with student ID.',
          'Only log the student name when they first open the homepage.',
          'Ask students to send a screenshot after each session.',
          'Log only the score because attendance and score are the same.'
        ],
        0,
        [
          'Best: captures attendance and activity evidence.',
          'Opening homepage is not enough.',
          'Screenshots are manual and unreliable.',
          'Score does not prove attendance duration.'
        ],
        'Attendance ต้องมี event sequence',
        'ถูกต้อง เพราะ log หลายจุดและมี duration'
      ),

      mcQ(10,10,'challenge','reading',
        'Client Hologram: “Make the game exciting, but avoid making choices too easy.” Choose the best combined solution.',
        '',
        [
          'Use attack-card UI, shuffled choices, close distractors, and feedback that explains why each answer is better.',
          'Use bright effects and make the correct answer longer than the others.',
          'Use random choices without explanations so students cannot predict the answer.',
          'Use only boss fights and remove normal learning feedback.'
        ],
        0,
        [
          'Best: improves game feel and learning quality.',
          'Makes guessing easier because length becomes a clue.',
          'Randomness without explanation does not support learning.',
          'Boss fights alone do not teach the answer quality.'
        ],
        'Challenge design ต้องรวม game feel + assessment quality',
        'ถูกต้อง เพราะครบ UI, randomization, distractors, feedback'
      )
    ],

    11: [
      mcQ(11,1,'easy','listening',
        'Listen only.',
        'Angry client says: I cannot log in. I need help now.',
        [
          'The client cannot log in and needs help now.',
          'The client wants a new design for the login page.',
          'The client can log in but wants a faster page.',
          'The client needs help with payment, not login.'
        ],
        0,
        [
          'Best: captures problem and urgency.',
          'Changes problem to design.',
          'Opposite login status.',
          'Wrong feature.'
        ],
        'อย่าตกใจ tone ให้จับปัญหา',
        'ถูกต้อง เพราะโฟกัส content ไม่ใช่น้ำเสียง'
      ),
      mcQ(11,2,'easy','listening',
        'Listen only.',
        'Angry client says: The report is missing from the dashboard.',
        [
          'The report is missing from the dashboard.',
          'The dashboard is missing from the report.',
          'The report is too long on the dashboard.',
          'The dashboard color is missing from the report.'
        ],
        0,
        [
          'Best: exact issue.',
          'Reverses the relationship.',
          'Changes missing to too long.',
          'Nonsense detail based on similar words.'
        ],
        'จับ object ที่ missing',
        'ถูกต้อง เพราะเข้าใจว่า report หายจาก dashboard'
      ),
      mcQ(11,3,'easy','listening',
        'Listen only.',
        'Angry client says: Your app crashed during the demo.',
        [
          'The app crashed during the demo.',
          'The app was slow before the demo.',
          'The demo crashed after the app was updated tomorrow.',
          'The app design was confusing during the meeting.'
        ],
        0,
        [
          'Best: exact event and timing.',
          'Similar but changes problem.',
          'Incorrect timing and wording.',
          'Possible issue but not what was said.'
        ],
        'ฟัง crashed + during demo',
        'ถูกต้อง เพราะจับเหตุการณ์หลักได้'
      ),

      mcQ(11,4,'normal','listening',
        'Listen only.',
        'Angry client says: I asked for a weekly summary, not a daily notification.',
        [
          'The client wants a weekly summary, not a daily notification.',
          'The client wants a daily summary, not a weekly notification.',
          'The client wants both weekly and daily notifications.',
          'The client wants no summary and no notification.'
        ],
        0,
        [
          'Best: exact contrast.',
          'Swaps weekly/daily.',
          'Adds both, which was not requested.',
          'Opposite of the request.'
        ],
        'จับ not A but B',
        'ถูกต้อง เพราะแยก weekly summary กับ daily notification'
      ),
      mcQ(11,5,'normal','listening',
        'Listen only.',
        'Angry client says: The data is correct, but the chart labels are wrong.',
        [
          'The data is correct, but the chart labels are wrong.',
          'The data is wrong, but the chart labels are correct.',
          'Both the data and chart labels are wrong.',
          'The chart is correct, but the data labels are missing.'
        ],
        0,
        [
          'Best: exact correct/wrong distinction.',
          'Reverses the meaning.',
          'Overstates the issue.',
          'Changes chart labels into data labels.'
        ],
        'ฟังว่าอะไร correct และอะไร wrong',
        'ถูกต้อง เพราะจับ contrast ได้'
      ),
      mcQ(11,6,'normal','listening',
        'Listen only.',
        'Angry client says: I do not need more features. I need the current feature to work.',
        [
          'The client needs the current feature to work, not more features.',
          'The client needs more features before the current feature works.',
          'The client says all current features work well.',
          'The client wants to remove the current feature.'
        ],
        0,
        [
          'Best: exact priority.',
          'Opposite priority.',
          'Opposite status.',
          'Removal was not requested.'
        ],
        'จับ priority จาก angry tone',
        'ถูกต้อง เพราะเข้าใจว่า client ต้องการ fix ไม่ใช่เพิ่ม feature'
      ),

      mcQ(11,7,'hard','listening',
        'Listen only.',
        'Angry client says: I am upset because we agreed on mobile support, but the latest version only works on desktop.',
        [
          'The client is upset because mobile support was agreed, but the latest version only works on desktop.',
          'The client is upset because desktop support was agreed, but mobile is the only working version.',
          'The client wants desktop support removed because mobile support is enough.',
          'The client agreed to remove mobile support from the latest version.'
        ],
        0,
        [
          'Best: captures agreement, mobile support, and desktop-only problem.',
          'Reverses mobile and desktop.',
          'Adds a request that was not said.',
          'Opposite of the complaint.'
        ],
        'Hard listening ต้องจับ agreement + current mismatch',
        'ถูกต้อง เพราะเข้าใจสาเหตุที่ client upset'
      ),
      mcQ(11,8,'hard','listening',
        'Listen only.',
        'Angry client says: The prototype looks nice, but it does not save user progress, which is the main requirement.',
        [
          'The prototype looks nice, but it does not save user progress, the main requirement.',
          'The prototype looks bad, but it saves progress correctly.',
          'The prototype saves user progress, but the design is not nice.',
          'The main requirement is a nicer prototype, not saved progress.'
        ],
        0,
        [
          'Best: exact compliment plus critical requirement failure.',
          'Opposite of both parts.',
          'Reverses design and progress.',
          'Wrong main requirement.'
        ],
        'ฟัง compliment แต่ต้องจับ main requirement',
        'ถูกต้อง เพราะไม่หลงกับคำชมเรื่อง design'
      ),
      mcQ(11,9,'hard','listening',
        'Listen only.',
        'Angry client says: Do not promise a Friday launch unless the payment test passes first.',
        [
          'Do not promise Friday launch unless the payment test passes first.',
          'Promise a Friday launch and test payment after launch.',
          'Cancel Friday launch even if the payment test passes.',
          'Promise the payment test will pass by Friday.'
        ],
        0,
        [
          'Best: preserves condition and caution.',
          'Violates condition.',
          'Too extreme; launch may happen if test passes.',
          'Changes launch promise into test promise.'
        ],
        'จับ unless และ condition',
        'ถูกต้อง เพราะเข้าใจ conditional warning'
      ),

      mcQ(11,10,'challenge','listening',
        'Listen only.',
        'Angry client says: I am not angry about the delay itself. I am angry because nobody explained the delay or gave a new timeline.',
        [
          'The client is angry because no one explained the delay or gave a new timeline.',
          'The client is angry only because the project was delayed.',
          'The client wants the team to hide the delay until the timeline is ready.',
          'The client is not angry and only needs a new feature timeline.'
        ],
        0,
        [
          'Best: captures the real issue behind the emotion.',
          'Misses the key reason: lack of communication.',
          'Opposite of transparent communication.',
          'Incorrect emotional status and requirement.'
        ],
        'Challenge listening ต้องจับ real concern หลัง tone',
        'ถูกต้อง เพราะแยก delay กับ communication issue ได้'
      )
    ],

    12: [
      textQ(12,1,'easy','writing',
        'Villain Investor asks: “What problem does your product solve?” Type a short founder answer.',
        'It helps students practice English in realistic technology situations.',
        ['helps','students','practice','english','technology'],
        'ตอบเป็น problem/value ไม่ใช่แค่ feature'
      ),
      textQ(12,2,'easy','writing',
        'Villain Investor asks: “Who is your user?” Type a clear answer.',
        'Our users are computer science and AI students who need professional English practice.',
        ['users','computer','science','ai','english'],
        'บอก target user ให้ชัด'
      ),
      textQ(12,3,'easy','writing',
        'Villain Investor asks: “Why is your app useful?” Type a simple value answer.',
        'It is useful because learners can practice speaking, listening, reading, and writing in one place.',
        ['useful','learners','speaking','listening','reading','writing'],
        'ตอบให้เห็น value ของ app'
      ),

      textQ(12,4,'normal','writing',
        'Villain Investor asks: “Why not just use a normal worksheet?” Type a persuasive answer.',
        'A worksheet gives practice, but our app gives interactive missions, feedback, and progress tracking.',
        ['worksheet','interactive','missions','feedback','progress'],
        'เปรียบเทียบอย่างสุภาพและมี value'
      ),
      textQ(12,5,'normal','writing',
        'Villain Investor asks: “How will students stay motivated?” Type a clear answer.',
        'Students stay motivated through missions, badges, boss stages, and visible progress from S1 to S15.',
        ['motivated','missions','badges','boss','progress'],
        'ตอบเรื่อง game motivation'
      ),
      textQ(12,6,'normal','writing',
        'Villain Investor asks: “What makes your product different?” Type a strong answer.',
        'It combines English practice with tech scenarios, AI feedback, and hybrid 3D gameplay.',
        ['combines','english','tech','ai','feedback','3d'],
        'บอก differentiation ชัด'
      ),

      textQ(12,7,'hard','writing',
        'Villain Investor says: “This sounds expensive.” Type a founder response that reduces concern.',
        'We can start with a focused MVP, test learning impact, and add advanced features after validation.',
        ['mvp','test','learning','impact','validation'],
        'ใช้แนว MVP และ validation'
      ),
      textQ(12,8,'hard','writing',
        'Villain Investor asks: “How do you prove learning impact?” Type a concise plan.',
        'We will track completion, accuracy, time on session, and skill improvement across S1 to S15.',
        ['track','completion','accuracy','time','skill','improvement'],
        'ต้องมี metrics'
      ),
      textQ(12,9,'hard','writing',
        'Villain Investor asks: “What is your business value?” Type a persuasive answer.',
        'The product can support digital English training for CS and AI programs with measurable learning data.',
        ['support','training','cs','ai','measurable','data'],
        'ตอบ value ต่อ program/organization'
      ),

      textQ(12,10,'challenge','writing',
        'Final investor boss asks: “Why should I fund this now?” Type a concise high-impact pitch.',
        'You should fund this now because CS and AI students need job-ready English, and our hybrid 3D missions make practice measurable, engaging, and scalable.',
        ['fund','cs','ai','job-ready','english','measurable','engaging','scalable'],
        'ต้องมี urgency + target + value + scalability'
      )
    ],

    13: [
      mcQ(13,1,'easy','reading',
        'HR asks: “Tell me about yourself.” Choose the most professional answer.',
        '',
        [
          'I am a computer science student interested in AI and web applications. I enjoy learning and working with teams.',
          'I am a student. I like computers, games, food, and many other things.',
          'I am very good at everything, so I can do any job in technology.',
          'I do not know what to say, but I hope you can ask another question.'
        ],
        0,
        [
          'Best: professional, relevant, and balanced.',
          'Too casual and unfocused.',
          'Overconfident and unrealistic.',
          'Not prepared for an interview.'
        ],
        'Interview answer ต้อง relevant และ professional',
        'ถูกต้อง เพราะแนะนำตัวเชื่อมกับงานเทคโนโลยี'
      ),
      mcQ(13,2,'easy','reading',
        'HR asks: “Why do you want this internship?” Choose the best answer.',
        '',
        [
          'I want to apply my skills, learn from real projects, and improve my professional communication.',
          'I want this internship because it looks good on my social media.',
          'I want this internship because I do not want to study this semester.',
          'I want this internship because every student must have one.'
        ],
        0,
        [
          'Best: learning, contribution, and professionalism.',
          'Focuses on image, not growth.',
          'Very unprofessional.',
          'Too passive and not personal.'
        ],
        'ตอบเรื่อง contribute + learn',
        'ถูกต้อง เพราะแสดงแรงจูงใจที่เหมาะสม'
      ),
      mcQ(13,3,'easy','reading',
        'HR asks: “What is one of your strengths?” Choose the best answer.',
        '',
        [
          'I can learn new tools quickly and ask questions when I need clarification.',
          'My strength is that I never make mistakes in any project.',
          'I can work alone, so I do not need team communication.',
          'I like technology, but I am not sure about my strengths.'
        ],
        0,
        [
          'Best: realistic strength with learning mindset.',
          'Unrealistic perfection claim.',
          'Weak for team environments.',
          'Too uncertain for interview.'
        ],
        'Strength ควร realistic และมี evidence',
        'ถูกต้อง เพราะแสดง growth mindset'
      ),

      mcQ(13,4,'normal','reading',
        'HR asks: “Tell me about a challenge you faced in a project.” Choose the best STAR-style answer.',
        '',
        [
          'In a web project, our login failed. I checked the API, found a token issue, and helped fix it before testing again.',
          'I had a challenge, but I forgot the details. It was difficult, but finally okay.',
          'The project was hard because my teammates did not work well, so I did most things.',
          'I solved many problems in the project because I am usually the best programmer.'
        ],
        0,
        [
          'Best: situation, task/action, and result are clear.',
          'Too vague.',
          'Blames teammates and lacks professional tone.',
          'Overconfident and lacks specific evidence.'
        ],
        'STAR ต้องมี situation + action + result',
        'ถูกต้อง เพราะเล่า challenge แบบมี action'
      ),
      mcQ(13,5,'normal','reading',
        'HR asks: “How do you handle feedback?” Choose the best answer.',
        '',
        [
          'I listen carefully, ask for clarification if needed, and use feedback to improve my work.',
          'I accept feedback only if I agree with it.',
          'I usually feel bad about feedback, so I try to avoid it.',
          'I explain why my work is already correct before listening.'
        ],
        0,
        [
          'Best: open, reflective, and action-oriented.',
          'Too defensive.',
          'Avoidant and not professional.',
          'Starts defensively before understanding feedback.'
        ],
        'Feedback answer ควร open + improve',
        'ถูกต้อง เพราะแสดงทัศนคติที่ดีต่อ feedback'
      ),
      mcQ(13,6,'normal','reading',
        'HR asks: “What is your career goal?” Choose the strongest answer.',
        '',
        [
          'My goal is to become a developer who can build useful systems and communicate clearly with users and teams.',
          'My goal is to get a high salary as soon as possible.',
          'My goal is to work in technology because many jobs are available.',
          'My goal is not clear yet, but I will decide after I get hired.'
        ],
        0,
        [
          'Best: role, value, and communication skill.',
          'Too money-focused for this answer.',
          'Generic and weak.',
          'Too uncertain.'
        ],
        'Career goal ต้องชัดและ professional',
        'ถูกต้อง เพราะเชื่อม technical + communication'
      ),

      mcQ(13,7,'hard','reading',
        'HR asks: “Describe a time you worked with a difficult teammate.” Choose the most professional response.',
        '',
        [
          'I tried to understand the issue, clarified tasks, and communicated progress so the team could move forward.',
          'I told the teammate they were the main problem and finished the work myself.',
          'I avoided the teammate and waited until the teacher solved the problem.',
          'I changed the project plan without telling the teammate.'
        ],
        0,
        [
          'Best: constructive communication and task clarity.',
          'Blaming tone is unprofessional.',
          'Avoidance is not teamwork.',
          'Lack of transparency creates more conflict.'
        ],
        'Conflict answer ต้องไม่ blame',
        'ถูกต้อง เพราะเน้น collaboration'
      ),
      mcQ(13,8,'hard','reading',
        'HR asks: “Why should we choose you for a tech role?” Choose the best answer.',
        '',
        [
          'I bring technical learning ability, clear communication, and a strong willingness to improve through real project feedback.',
          'You should choose me because I need a job and I can start any time.',
          'You should choose me because I am better than many other students.',
          'I am not sure, but I can try if the work is not too difficult.'
        ],
        0,
        [
          'Best: value proposition with realistic strengths.',
          'Availability alone is not enough.',
          'Comparing yourself to others sounds arrogant.',
          'Too weak and hesitant.'
        ],
        'ตอบ value ที่องค์กรจะได้',
        'ถูกต้อง เพราะรวม technical + communication + learning'
      ),
      mcQ(13,9,'hard','reading',
        'HR asks: “What would you do if you do not understand a task?” Choose the best professional answer.',
        '',
        [
          'I would review the requirement, try a small example, and ask for clarification with specific questions.',
          'I would wait until someone notices that I am stuck.',
          'I would guess the answer and finish quickly.',
          'I would tell the manager the task is unclear and cannot be done.'
        ],
        0,
        [
          'Best: initiative, experiment, and clear questions.',
          'Passive and risky.',
          'Guessing can cause mistakes.',
          'Too negative and not solution-oriented.'
        ],
        'ต้องแสดง initiative และ clarification',
        'ถูกต้อง เพราะแก้ความไม่เข้าใจแบบมืออาชีพ'
      ),

      mcQ(13,10,'challenge','reading',
        'HR asks: “Give an example of leadership as a student developer.” Choose the strongest answer.',
        '',
        [
          'In a group project, I organized tasks, helped clarify requirements, and checked that our demo matched user needs.',
          'I was the leader because I wrote the most code and made the final decision.',
          'I led the project by asking everyone to follow my design exactly.',
          'I became the leader because other teammates were slower than me.'
        ],
        0,
        [
          'Best: leadership through coordination, clarity, and user focus.',
          'Too narrow and self-centered.',
          'Controlling, not collaborative.',
          'Blames teammates and sounds unprofessional.'
        ],
        'Leadership ไม่ใช่สั่งอย่างเดียว ต้อง coordinate',
        'ถูกต้อง เพราะเป็น leadership ที่เหมาะกับทีม'
      )
    ],

    14: [
      textQ(14,1,'easy','speaking',
        'Explain what a loop does in simple English.',
        'A loop repeats the same action until a condition is met.',
        ['loop','repeats','action','condition'],
        'ใช้คำว่า repeat และ condition'
      ),
      textQ(14,2,'easy','speaking',
        'Explain what a variable is.',
        'A variable is a name that stores a value in a program.',
        ['variable','name','stores','value','program'],
        'พูดให้ non-tech พอฟังเข้าใจ'
      ),
      textQ(14,3,'easy','speaking',
        'Explain what debugging means.',
        'Debugging means finding and fixing problems in the code.',
        ['debugging','finding','fixing','problems','code'],
        'ต้องมี finding + fixing'
      ),

      textQ(14,4,'normal','speaking',
        'Explain how you would solve a simple login bug step by step.',
        'First, I would reproduce the bug. Then, I would check the error message and test the login API.',
        ['first','reproduce','bug','check','error','api'],
        'พูดเป็น step-by-step'
      ),
      textQ(14,5,'normal','speaking',
        'Explain why input validation is important.',
        'Input validation is important because it prevents wrong or unsafe data from entering the system.',
        ['input','validation','prevents','unsafe','data','system'],
        'มีคำว่า unsafe data'
      ),
      textQ(14,6,'normal','speaking',
        'Explain how a chatbot can help students practice English.',
        'A chatbot can ask questions, give feedback, and let students practice English in short conversations.',
        ['chatbot','questions','feedback','practice','conversations'],
        'อธิบาย function ของ chatbot'
      ),

      textQ(14,7,'hard','speaking',
        'Explain how you would think aloud while solving an algorithm problem.',
        'I would explain the input, choose a simple approach, test it with examples, and then improve the solution.',
        ['input','approach','test','examples','improve','solution'],
        'ใช้ sequence ที่ชัด'
      ),
      textQ(14,8,'hard','speaking',
        'Explain the difference between frontend and backend in a professional way.',
        'The frontend is what users see and use, while the backend handles data, logic, and server communication.',
        ['frontend','users','backend','data','logic','server'],
        'ต้องเปรียบเทียบทั้งสองฝั่ง'
      ),
      textQ(14,9,'hard','speaking',
        'Explain why testing with real users can improve a product.',
        'Real user testing shows how people actually use the product, so the team can find problems that developers may miss.',
        ['real','users','product','problems','developers','miss'],
        'เน้น user behavior จริง'
      ),

      textQ(14,10,'challenge','speaking',
        'Strict mic challenge: Explain your problem-solving process for a broken AI speech feature.',
        'First, I would check browser support and microphone permission. Then, I would test speech recognition, log errors, and provide a text input fallback.',
        ['browser','microphone','speech','recognition','errors','fallback'],
        'ต้องพูดครบ technical process และ fallback'
      )
    ],

    15: [
      mcQ(15,1,'easy','listening',
        'Listen only.',
        'Global alert. The network in Japan is stable, but the network in Brazil is down.',
        [
          'Japan is stable, but Brazil is down.',
          'Brazil is stable, but Japan is down.',
          'Both Japan and Brazil are down.',
          'Both Japan and Brazil are stable.'
        ],
        0,
        [
          'Best: exact country status.',
          'Reverses the countries.',
          'Overstates the problem.',
          'Misses the Brazil outage.'
        ],
        'Final เริ่มจากจับ country + status',
        'ถูกต้อง เพราะแยก Japan/Brazil ถูก'
      ),
      mcQ(15,2,'easy','listening',
        'Listen only.',
        'Global alert. Restart the backup server, not the main server.',
        [
          'Restart the backup server, not the main server.',
          'Restart the main server, not the backup server.',
          'Restart both the main and backup servers.',
          'Do not restart any server.'
        ],
        0,
        [
          'Best: exact target and restriction.',
          'Reverses target.',
          'Adds extra action.',
          'Opposite of the instruction.'
        ],
        'ฟัง not ให้ดี',
        'ถูกต้อง เพราะเลือก backup server เท่านั้น'
      ),
      mcQ(15,3,'easy','listening',
        'Listen only.',
        'Global alert. Send the status report to the Asia team first.',
        [
          'Send the status report to the Asia team first.',
          'Send the status report to the Europe team first.',
          'Send the error report to all teams last.',
          'Send the payment report to the Asia team first.'
        ],
        0,
        [
          'Best: exact report, team, and order.',
          'Wrong team.',
          'Wrong report and order.',
          'Wrong report type.'
        ],
        'ฟัง report type + team + first',
        'ถูกต้อง เพราะจับลำดับและทีมถูก'
      ),

      mcQ(15,4,'normal','listening',
        'Listen only.',
        'Global command. Keep the Europe service online, and isolate the infected module in the US region.',
        [
          'Keep Europe online and isolate the infected module in the US region.',
          'Keep the US service online and isolate the Europe region.',
          'Take Europe offline and update the US module.',
          'Restart every region and remove the infected module.'
        ],
        0,
        [
          'Best: exact region actions.',
          'Swaps Europe and US.',
          'Opposite for Europe and incomplete for US.',
          'Too broad and not requested.'
        ],
        'จับ region-specific action',
        'ถูกต้อง เพราะทำตาม region action ถูกต้อง'
      ),
      mcQ(15,5,'normal','listening',
        'Listen only.',
        'Global command. The attack is on authentication, not payment. Protect login tokens first.',
        [
          'The attack is on authentication, and login tokens should be protected first.',
          'The attack is on payment, and payment tokens should be protected first.',
          'Authentication is safe, but payment must be protected first.',
          'Both authentication and payment should be deleted first.'
        ],
        0,
        [
          'Best: exact system and priority.',
          'Wrong system.',
          'Opposite of the attack status.',
          'Dangerous and not requested.'
        ],
        'ฟัง not payment และ protect tokens',
        'ถูกต้อง เพราะจับเป้าหมาย attack ได้'
      ),
      mcQ(15,6,'normal','listening',
        'Listen only.',
        'Global command. Notify users after the fix is tested, not before.',
        [
          'Notify users after the fix is tested, not before.',
          'Notify users before the fix is tested.',
          'Test users after the notification is sent.',
          'Do not notify users even after testing.'
        ],
        0,
        [
          'Best: correct sequence.',
          'Reverses order.',
          'Changes users into test subjects.',
          'Opposite of notify after testing.'
        ],
        'จับ sequence: after, not before',
        'ถูกต้อง เพราะลำดับถูกต้อง'
      ),

      mcQ(15,7,'hard','listening',
        'Listen only.',
        'Final command. Do not shut down the global network. Limit traffic from the suspicious IP range and monitor error rates.',
        [
          'Do not shut down the global network; limit suspicious IP traffic and monitor error rates.',
          'Shut down the global network and remove all IP traffic.',
          'Limit normal user traffic and ignore error rates.',
          'Monitor traffic only after shutting down the network.'
        ],
        0,
        [
          'Best: exact negative command and two actions.',
          'Violates do not shut down.',
          'Targets normal users and ignores monitoring.',
          'Wrong order and wrong shutdown action.'
        ],
        'Hard final ต้องจับ Do not + multiple actions',
        'ถูกต้อง เพราะไม่ shutdown และทำ mitigation'
      ),
      mcQ(15,8,'hard','listening',
        'Listen only.',
        'Final command. The backup in Singapore is ready, but the backup in Germany failed verification.',
        [
          'Singapore backup is ready, but Germany backup failed verification.',
          'Germany backup is ready, but Singapore backup failed verification.',
          'Both Singapore and Germany backups are ready.',
          'Both backups failed and cannot be used.'
        ],
        0,
        [
          'Best: exact location and status.',
          'Reverses locations.',
          'Ignores Germany failure.',
          'Overstates failure.'
        ],
        'จับ location + verification status',
        'ถูกต้อง เพราะแยก backup status ได้'
      ),
      mcQ(15,9,'hard','listening',
        'Listen only.',
        'Final command. Escalate to the security lead only if the second scan also finds malware.',
        [
          'Escalate only if the second scan also finds malware.',
          'Escalate now because the first scan found malware.',
          'Do not scan again if malware was found once.',
          'Escalate only if the second scan finds no malware.'
        ],
        0,
        [
          'Best: correct condition.',
          'Escalates too early.',
          'Contradicts second scan condition.',
          'Opposite condition.'
        ],
        'จับ only if และ second scan',
        'ถูกต้อง เพราะเข้าใจ condition'
      ),

      mcQ(15,10,'challenge','listening',
        'Listen only.',
        'Final global command. Keep Asia online, isolate the US authentication module, delay user notification until testing passes, and do not touch payment services.',
        [
          'Keep Asia online, isolate US authentication, notify users after testing passes, and do not change payment.',
          'Take Asia offline, isolate payment in the US, and notify users before testing.',
          'Keep Asia online, isolate US payment, and change authentication after testing.',
          'Notify users first, then isolate authentication and update payment services.'
        ],
        0,
        [
          'Best: preserves all four constraints exactly.',
          'Violates Asia, payment, and notification order.',
          'Wrong module: payment instead of authentication.',
          'Wrong order and violates payment constraint.'
        ],
        'Final challenge ต้องจับ constraints หลายชั้นพร้อมกัน',
        'ถูกต้อง เพราะทำตาม command ครบทุกข้อ'
      )
    ]
  };

  window.TECHPATH_LESSON_DATA = {
    VERSION,
    SKILLS,
    SESSIONS,
    SESSION_BANK
  };
})();
