// === /english/js/lesson-data.js ===
// TechPath English VR Lesson Data
// PATCH v20260428-CANONICAL-S1-S15-1Q-AI-DIFFICULTY
// ✅ S1-S15 canonical mapping ตามที่ตกลงล่าสุด
// ✅ 1 Session = 1 Skill = 1 Question
// ✅ แต่ละ S มีคลัง 10 ข้อ: easy 3 / normal 3 / hard 3 / challenge 1
// ✅ Boss: S3, S6, S9, S12, S15
// ✅ S5 / S15 Listening ไม่มี text prompt ของโจทย์บนหน้าจอ

(function(){
  'use strict';

  function pad(n){
    return String(n).padStart(2, '0');
  }

  const SKILLS = [
    { id:'speaking',  label:'Speaking',  icon:'🎙️', verb:'พูด' },
    { id:'reading',   label:'Reading',   icon:'📖', verb:'อ่าน' },
    { id:'writing',   label:'Writing',   icon:'⌨️', verb:'พิมพ์/เขียน' },
    { id:'listening', label:'Listening', icon:'🎧', verb:'ฟัง' }
  ];

  const SESSIONS = [
    {
      id:1,
      code:'S01',
      title:'Speak like a Pro, Not a Robot',
      skill:'speaking',
      missionType:'speech_recognition',
      scenario:'AI Pronunciation Gate',
      mission:'ฝึกออกเสียงให้ระบบ AI Speech Recognition ฟังรู้เรื่อง',
      playerRole:'New tech learner entering the VR English system',
      promptStyle:'พูดประโยคสั้น ชัด ไม่เหมือนหุ่นยนต์',
      level:'A2',
      boss:false
    },
    {
      id:2,
      code:'S02',
      title:'NPC Context Response',
      skill:'reading',
      missionType:'npc_context_choice',
      scenario:'NPC Conversation Screen',
      mission:'อ่านบริบทจากคำพูดของ NPC บนหน้าจอ แล้วเลือกคำตอบที่สุภาพและตรงประเด็นที่สุด',
      playerRole:'Student talking with an NPC in a tech environment',
      promptStyle:'อ่าน context แล้วเลือก A/B/C',
      level:'A2',
      boss:false
    },
    {
      id:3,
      code:'S03',
      title:'Hacker Virus Typing Boss',
      skill:'writing',
      missionType:'typing_boss',
      scenario:'Hacker Virus Battle',
      mission:'Boss Stage: ใช้ Writing / Typing พิมพ์โจมตีสวนกลับไวรัสแฮ็กเกอร์',
      playerRole:'Cyber defender',
      promptStyle:'พิมพ์ประโยคตอบโต้ให้ถูกและเร็ว',
      level:'A2+',
      boss:true
    },
    {
      id:4,
      code:'S04',
      title:'Stand-up Speaking',
      skill:'speaking',
      missionType:'standup_speaking',
      scenario:'Virtual Scrum Stand-up',
      mission:'พูดอัปเดตงานแบบ Stand-up: Yesterday, Today, Blockers',
      playerRole:'Developer in a daily stand-up meeting',
      promptStyle:'พูด update สั้น ๆ ครบ 3 ส่วน',
      level:'A2+',
      boss:false
    },
    {
      id:5,
      code:'S05',
      title:'Keyword Listening Challenge',
      skill:'listening',
      missionType:'audio_only_keyword',
      scenario:'AI Voice Alert',
      mission:'ไม่มีข้อความโจทย์บนหน้าจอ ต้องฟังเสียง AI และจับ keyword สำคัญ',
      playerRole:'Developer receiving an audio alert',
      promptStyle:'ฟังอย่างเดียว ไม่มี text prompt',
      level:'A2+',
      noTextPrompt:true,
      boss:false
    },
    {
      id:6,
      code:'S06',
      title:'Ticket Fix Reading Boss',
      skill:'reading',
      missionType:'ticket_boss_choice',
      scenario:'Developer Ticket Dashboard',
      mission:'Boss Stage Module 2: อ่าน Ticket แล้วเลือกวิธีแก้ปัญหาให้ไวที่สุด',
      playerRole:'Skilled developer fixing urgent tickets',
      promptStyle:'อ่าน ticket แล้วเลือก best fix',
      level:'B1-',
      boss:true
    },
    {
      id:7,
      code:'S07',
      title:'Client Terminal Reply',
      skill:'writing',
      missionType:'terminal_writing',
      scenario:'Client Investor Terminal',
      mission:'ลูกค้า/นักลงทุนถามคำถาม IT แบบง่าย ต้องพิมพ์ตอบเร็วและใช้ศัพท์ง่าย',
      playerRole:'Tech consultant explaining IT to a non-technical investor',
      promptStyle:'พิมพ์คำอธิบายสั้น เข้าใจง่าย',
      level:'B1-',
      boss:false
    },
    {
      id:8,
      code:'S08',
      title:'AI Ethics Listening',
      skill:'listening',
      missionType:'ethics_yes_no_listening',
      scenario:'AI Ethics Audio Test',
      mission:'ฟังคำถามจริยธรรมแบบ Yes/No แล้วเลือกคำตอบที่ถูกกฎหมายและจริยธรรมที่สุด',
      playerRole:'AI ethics reviewer',
      promptStyle:'ฟังคำถาม ethics แล้วเลือกคำตอบ',
      level:'B1-',
      boss:false
    },
    {
      id:9,
      code:'S09',
      title:'Data Analyst Voice Boss',
      skill:'speaking',
      missionType:'data_analyst_voice_boss',
      scenario:'Hacked Data System',
      mission:'Boss Stage Module 3: รับบท Data Analyst พูดโต้ตอบแบบเป๊ะ ๆ เพื่อปลดล็อกระบบ',
      playerRole:'Data analyst unlocking a hacked analytics system',
      promptStyle:'พูดคำตอบ data analysis ให้แม่น',
      level:'B1',
      boss:true
    },
    {
      id:10,
      code:'S10',
      title:'Client Hologram Reading',
      skill:'reading',
      missionType:'hologram_reading_choice',
      scenario:'Client Hologram Message',
      mission:'อ่านข้อความจาก Client บน Hologram วิเคราะห์ keyword แล้วเลือกคำตอบให้ไว',
      playerRole:'Developer reading a client hologram request',
      promptStyle:'อ่านเร็ว วิเคราะห์ keyword เลือก response',
      level:'B1',
      boss:false
    },
    {
      id:11,
      code:'S11',
      title:'Angry Client Listening',
      skill:'listening',
      missionType:'angry_tone_listening',
      scenario:'Irritated AI Client Call',
      mission:'ฟัง AI Client ที่หงุดหงิดและกระแทกเสียง ต้องโฟกัสเนื้อหาปัญหา',
      playerRole:'Support engineer handling an angry client',
      promptStyle:'ฟัง tone ยาก แต่ตอบจาก content',
      level:'B1',
      angryTone:true,
      boss:false
    },
    {
      id:12,
      code:'S12',
      title:'Startup Founder Typing Boss',
      skill:'writing',
      missionType:'founder_typing_boss',
      scenario:'Villain Investor Pitch Battle',
      mission:'Boss Stage Module 4: รับบท Startup Founder พิมพ์ตอบนักลงทุนตัวร้ายอย่างรวดเร็ว',
      playerRole:'Startup founder defending a product idea',
      promptStyle:'พิมพ์ตอบเร็ว โน้มน้าว และชัด',
      level:'B1+',
      boss:true
    },
    {
      id:13,
      code:'S13',
      title:'HR Interview Reading',
      skill:'reading',
      missionType:'hr_interview_choice',
      scenario:'HR Interview Screen',
      mission:'อ่านคำถามสัมภาษณ์จาก HR Manager แล้วเลือกคำตอบที่เป็นมืออาชีพที่สุด',
      playerRole:'Job candidate in an HR interview',
      promptStyle:'อ่านคำถาม HR แล้วเลือก professional answer',
      level:'B1+',
      boss:false
    },
    {
      id:14,
      code:'S14',
      title:'Technical Speaking Challenge',
      skill:'speaking',
      missionType:'strict_technical_speaking',
      scenario:'Technical Interview Microphone Test',
      mission:'พูดประโยคยาวขึ้น มีศัพท์เทคนิค และ AI Microphone ตรวจความแม่นยำเข้มงวด',
      playerRole:'Candidate explaining technical ideas',
      promptStyle:'พูดประโยคยาว technical ให้แม่น',
      level:'B1+',
      strictMic:true,
      boss:false
    },
    {
      id:15,
      code:'S15',
      title:'Global Network Final Listening',
      skill:'listening',
      missionType:'final_global_listening',
      scenario:'Global Network Attack Control Room',
      mission:'Final Test: ใช้ Listening เพื่อกอบกู้ระบบ Network ทั่วโลกที่ถูกโจมตีหลายประเทศ',
      playerRole:'Global network responder',
      promptStyle:'ฟังคำสั่งฉุกเฉินและเลือก action ที่ถูกต้อง',
      level:'B1+',
      noTextPrompt:true,
      boss:true,
      final:true
    }
  ];

  function makeChoiceQuestion(id, skill, level, say, prompt, choices, answer, hint, extra){
    return Object.assign({
      id,
      skill,
      level,
      say: say || '',
      prompt,
      choices,
      answer,
      hint
    }, extra || {});
  }

  function makeTextQuestion(id, skill, level, prompt, sample, expected, hint, extra){
    return Object.assign({
      id,
      skill,
      level,
      prompt,
      sample,
      expected,
      hint
    }, extra || {});
  }

  function pickRow(rows, level, no){
    const pool = rows[level] || rows.normal || rows.easy || rows.challenge || [];
    if(!pool.length) return null;
    return pool[(no - 1) % pool.length];
  }

  function qid(meta, level, no){
    return 'S' + pad(meta.id) + '_' + String(meta.skill || 'x').toUpperCase().slice(0,1) + '_' + level.toUpperCase().slice(0,1) + '_' + pad(no);
  }

  function buildSessionBank(){
    const bank = {};
    const levelPattern = [
      'easy','easy','easy',
      'normal','normal','normal',
      'hard','hard','hard',
      'challenge'
    ];

    SESSIONS.forEach(meta => {
      bank[meta.id] = levelPattern.map((level, idx) => buildQuestion(meta, level, idx + 1));
    });

    return bank;
  }

  function buildQuestion(meta, level, no){
    switch(Number(meta.id)){
      case 1: return buildS1SpeakingPronunciation(meta, level, no);
      case 2: return buildS2ReadingNpcContext(meta, level, no);
      case 3: return buildS3WritingHackerBoss(meta, level, no);
      case 4: return buildS4SpeakingStandup(meta, level, no);
      case 5: return buildS5ListeningKeyword(meta, level, no);
      case 6: return buildS6ReadingTicketBoss(meta, level, no);
      case 7: return buildS7WritingTerminalClient(meta, level, no);
      case 8: return buildS8ListeningEthics(meta, level, no);
      case 9: return buildS9SpeakingDataBoss(meta, level, no);
      case 10: return buildS10ReadingHologram(meta, level, no);
      case 11: return buildS11ListeningAngryClient(meta, level, no);
      case 12: return buildS12WritingFounderBoss(meta, level, no);
      case 13: return buildS13ReadingHrInterview(meta, level, no);
      case 14: return buildS14SpeakingTechnical(meta, level, no);
      case 15: return buildS15ListeningFinalNetwork(meta, level, no);
      default:
        return makeTextQuestion(
          qid(meta, level, no),
          meta.skill || 'speaking',
          level,
          'Complete this English mission.',
          'I can complete this mission.',
          ['complete','mission'],
          'ตอบให้ตรงกับสถานการณ์'
        );
    }
  }

  function buildS1SpeakingPronunciation(meta, level, no){
    const rows = {
      easy:[
        ['Say clearly: “I study computer science.”','I study computer science.',['study','computer','science'],'ออกเสียงคำว่า computer science ให้ชัด'],
        ['Say clearly: “I am interested in AI.”','I am interested in AI.',['interested','ai'],'เน้น interested in AI'],
        ['Say clearly: “I can build simple apps.”','I can build simple apps.',['build','apps'],'พูด can + verb ให้ชัด']
      ],
      normal:[
        ['Say clearly: “I am learning AI and web development.”','I am learning AI and web development.',['learning','ai','web','development'],'พูดเป็นธรรมชาติ ไม่ท่องเป็นหุ่นยนต์'],
        ['Say clearly: “My goal is to become a software developer.”','My goal is to become a software developer.',['goal','software','developer'],'เน้น goal และ software developer'],
        ['Say clearly: “I enjoy solving problems with technology.”','I enjoy solving problems with technology.',['enjoy','solving','technology'],'พูด solving problems ให้ต่อเนื่อง']
      ],
      hard:[
        ['Say clearly: “I want to use AI to create helpful learning tools.”','I want to use AI to create helpful learning tools.',['ai','create','helpful','learning','tools'],'พูด use AI to create... ให้ชัด'],
        ['Say clearly: “My focus is artificial intelligence and user-friendly applications.”','My focus is artificial intelligence and user-friendly applications.',['artificial','intelligence','user','friendly','applications'],'ศัพท์ยาว ต้องออกเสียงให้ครบ'],
        ['Say clearly: “I can explain my project confidently at a tech conference.”','I can explain my project confidently at a tech conference.',['explain','project','confidently','conference'],'พูด confidently ให้ฟังรู้เรื่อง']
      ],
      challenge:[
        ['Say like a pro: “I am a future AI developer who can explain ideas clearly and confidently.”','I am a future AI developer who can explain ideas clearly and confidently.',['future','ai','developer','clearly','confidently'],'ต้องพูดครบ ชัด และเป็นธรรมชาติ']
      ]
    };
    const r = pickRow(rows, level, no);
    return makeTextQuestion(qid(meta, level, no), 'speaking', level, r[0], r[1], r[2], r[3], { requireMic:true });
  }

  function buildS2ReadingNpcContext(meta, level, no){
    const rows = {
      easy:[
        ['NPC says: “Hi, I am new here. What do you study?”', ['I study CS and AI. Nice to meet you.','Go away.','I do not care.'], 0, 'เลือกคำตอบสุภาพและตอบตรงคำถาม'],
        ['NPC says: “Can I ask about your project?”', ['Sure, I can explain it briefly.','No, stop talking.','That is your problem.'], 0, 'ใช้ Sure เพื่อเปิดบทสนทนา'],
        ['NPC says: “Is this your first tech event?”', ['Yes, it is. I am excited to learn.','You are wrong.','I hate events.'], 0, 'ตอบให้เป็นมิตร']
      ],
      normal:[
        ['NPC says: “What area of technology are you interested in?”', ['I am interested in AI and web apps.','I never answer questions.','This event is bad.'], 0, 'ตอบ interest ให้ตรงประเด็น'],
        ['NPC says: “Would you like to connect after this session?”', ['Yes, let’s connect on LinkedIn.','Do not contact me.','I lost my shoes.'], 0, 'แลก contact อย่างสุภาพ'],
        ['NPC says: “What kind of team role do you prefer?”', ['I like working as a developer or AI learner.','I do not like people.','The room is blue.'], 0, 'ตอบบริบท networking']
      ],
      hard:[
        ['NPC says: “Tell me briefly how your CS focus connects to AI.”', ['CS helps me build systems, and AI helps those systems learn from data.','AI is magic and CS is nothing.','I cannot read anything.'], 0, 'ตอบเชื่อม CS กับ AI'],
        ['NPC says: “What makes your learning goal different from others?”', ['I want to create tools that solve real learning problems.','I only want to win.','I do not know any goal.'], 0, 'ตอบแบบมืออาชีพ'],
        ['NPC says: “How would you start a conversation with a senior developer?”', ['I would introduce myself and ask about their current project.','I would shout loudly.','I would leave immediately.'], 0, 'ใช้ open-ended question']
      ],
      challenge:[
        ['NPC says: “We only have one minute. Give me a professional but friendly response.”', ['Nice to meet you. I’m learning CS and AI, and I’d love to hear about your work.','I am busy. Bye.','Why are you here?'], 0, 'ต้องสุภาพ กระชับ และเปิดโอกาสให้คุยต่อ']
      ]
    };
    const r = pickRow(rows, level, no);
    return makeChoiceQuestion(qid(meta, level, no), 'reading', level, '', r[0], r[1], r[2], r[3]);
  }

  function buildS3WritingHackerBoss(meta, level, no){
    const rows = {
      easy:[
        ['Type a command sentence to stop the virus.','Stop the virus now.',['stop','virus'],'ใช้คำสั่งสั้น ๆ'],
        ['Type a sentence to protect the system.','Protect the system now.',['protect','system'],'ใช้ imperative sentence'],
        ['Type a sentence to block the hacker.','Block the hacker access.',['block','hacker','access'],'ระบุ action + target']
      ],
      normal:[
        ['The hacker virus is attacking the login page. Type a clear defensive action.','Block the login attack and check the server logs.',['block','login','attack','logs'],'ตอบให้มี action และ evidence'],
        ['A malware alert appears. Type a fast response to your team.','Isolate the infected file and scan the system.',['isolate','infected','scan','system'],'ใช้ศัพท์ cybersecurity พื้นฐาน'],
        ['The firewall warning is flashing. Type a short command to respond.','Update the firewall rules and monitor the traffic.',['firewall','monitor','traffic'],'ระบุการแก้และติดตามผล']
      ],
      hard:[
        ['The hacker changes the admin password. Type a precise recovery action.','Reset the admin password, revoke suspicious sessions, and audit access logs.',['reset','password','revoke','audit','logs'],'ตอบหลายขั้นตอนให้ครบ'],
        ['The database shows suspicious queries. Type a technical defense response.','Stop the suspicious queries, back up the database, and report the incident.',['queries','backup','database','incident'],'ใช้ technical writing'],
        ['The virus spreads to user accounts. Type a fast incident response.','Disable affected accounts, notify users, and start malware scanning.',['disable','accounts','notify','malware'],'ต้องชัดและเป็นขั้นตอน']
      ],
      challenge:[
        ['Boss attack! The hacker virus is corrupting login data and stealing tokens. Type a strong counterattack plan.','Revoke stolen tokens, disable compromised accounts, restore clean backups, and monitor all login activity.',['revoke','tokens','disable','restore','monitor'],'ตอบครบเพื่อโจมตีบอสกลับ']
      ]
    };
    const r = pickRow(rows, level, no);
    return makeTextQuestion(qid(meta, level, no), 'writing', level, r[0], r[1], r[2], r[3]);
  }

  function buildS4SpeakingStandup(meta, level, no){
    const rows = {
      easy:[
        ['Say a stand-up update: yesterday you studied HTML, today you practice CSS, blocker is none.','Yesterday, I studied HTML. Today, I will practice CSS. I have no blockers.',['yesterday','today','blockers'],'พูดครบ 3 ส่วน'],
        ['Say a stand-up update about fixing a small bug.','Yesterday, I fixed a small bug. Today, I will test the app. I have no blockers.',['fixed','test','blockers'],'ใช้ past + future'],
        ['Say a simple team update.','Yesterday, I learned Git. Today, I will push my code. My blocker is login error.',['learned','push','blocker'],'พูด blocker ให้ชัด']
      ],
      normal:[
        ['Give a short stand-up update about a web app project.','Yesterday, I worked on the login page. Today, I will connect the database. My blocker is an API error.',['yesterday','login','database','api','error'],'ต้องมีงานจริงและ blocker'],
        ['Give a clear stand-up update for your Scrum team.','Yesterday, I finished the UI layout. Today, I will test the form validation. My blocker is unclear requirements.',['finished','test','validation','requirements'],'ใช้ tense ถูกต้อง'],
        ['Give a developer stand-up update.','Yesterday, I reviewed the code. Today, I will fix the payment bug. My blocker is missing test data.',['reviewed','fix','bug','test','data'],'พูดเป็น developer update']
      ],
      hard:[
        ['Give a professional stand-up update with progress and risk.','Yesterday, I integrated the API. Today, I will improve error handling. My blocker is unstable server response.',['integrated','api','error','handling','server'],'เพิ่ม risk/blocker ชัดเจน'],
        ['Give a stand-up update for an AI project.','Yesterday, I cleaned the dataset. Today, I will train the model. My blocker is low data quality.',['dataset','train','model','data','quality'],'ศัพท์ AI ต้องชัด'],
        ['Give a stand-up update under time pressure.','Yesterday, I completed the dashboard chart. Today, I will optimize loading speed. My blocker is slow API performance.',['dashboard','optimize','loading','api','performance'],'พูดให้กระชับ']
      ],
      challenge:[
        ['Boss-style stand-up: give a confident update with yesterday, today, blocker, and next action.','Yesterday, I fixed the authentication bug. Today, I will run security tests. My blocker is incomplete server logs, so I will ask the backend team for details.',['yesterday','today','blocker','security','backend'],'ต้องครบและเป็นธรรมชาติ']
      ]
    };
    const r = pickRow(rows, level, no);
    return makeTextQuestion(qid(meta, level, no), 'speaking', level, r[0], r[1], r[2], r[3], { requireMic:true });
  }

  function buildS5ListeningKeyword(meta, level, no){
    const rows = {
      easy:[
        ['The server is down. Restart it now.','What keyword did you hear?', ['server down','new design','lunch time'], 0, 'ฟัง keyword: server down'],
        ['The login page has an error.','What has an error?', ['login page','profile picture','meeting room'], 0, 'ฟังคำว่า login page'],
        ['Update the app today.','When should you update the app?', ['today','next year','never'], 0, 'ฟัง time keyword']
      ],
      normal:[
        ['The payment system failed after the update.','What failed?', ['payment system','weather report','keyboard'], 0, 'ฟัง object + failed'],
        ['Please check the database backup before deployment.','What should you check?', ['database backup','student card','office chair'], 0, 'ฟัง check + object'],
        ['The API response is too slow during login.','What is the problem?', ['API is too slow','screen is too bright','email is too short'], 0, 'ฟัง API response']
      ],
      hard:[
        ['The user cannot reset the password because the email service is delayed.','Why can’t the user reset the password?', ['email service is delayed','user forgot lunch','dashboard is colorful'], 0, 'ฟัง because'],
        ['The mobile app crashes when users upload large images.','When does the app crash?', ['when users upload large images','when users drink coffee','when users open a book'], 0, 'ฟัง when'],
        ['The client needs a quick fix before the product demo tomorrow.','When is the demo?', ['tomorrow','last month','next year'], 0, 'ฟัง before']
      ],
      challenge:[
        ['Urgent alert. The API is unstable, the dashboard is loading slowly, and the client demo starts in ten minutes.','What is the most urgent context?', ['client demo starts in ten minutes','lunch starts tomorrow','the keyboard is new'], 0, 'จับหลาย keyword พร้อมกัน']
      ]
    };
    const r = pickRow(rows, level, no);
    return makeChoiceQuestion(qid(meta, level, no), 'listening', level, r[0], 'LISTEN ONLY — No text prompt on screen.', r[2], r[3], r[4], { hidePrompt:true });
  }

  function buildS6ReadingTicketBoss(meta, level, no){
    const rows = {
      easy:[
        ['Ticket: Login button does not work. Best first fix?', ['Check the button click event','Change the school logo','Delete all files'], 0, 'เริ่มจาก event ของปุ่ม'],
        ['Ticket: User cannot open dashboard. Best action?', ['Check route and permission','Buy a new desk','Ignore the user'], 0, 'ดู route/permission'],
        ['Ticket: Image is not loading. Best action?', ['Check image path','Close the project','Change the teacher'], 0, 'ดู path']
      ],
      normal:[
        ['Ticket: After deployment, users get 404 on /profile. Best fix?', ['Check routing and deployed file path','Increase font size','Rename all students'], 0, '404 เกี่ยวกับ route/path'],
        ['Ticket: Form submits empty data. Best fix?', ['Validate input before submit','Make button red','Remove the form'], 0, 'ต้อง validate input'],
        ['Ticket: API returns permission denied. Best fix?', ['Check auth rules and user role','Restart the classroom','Change background color'], 0, 'permission เกี่ยวกับ auth/rules']
      ],
      hard:[
        ['Ticket: Login works locally but fails on production after domain change. Best fix?', ['Check redirect URI and environment variables','Rewrite all CSS','Turn off the monitor'], 0, 'production fail มักเกี่ยวกับ env/redirect'],
        ['Ticket: Dashboard loads slowly with many records. Best fix?', ['Add pagination or query limits','Add more emojis','Disable all users'], 0, 'ข้อมูลเยอะต้อง paginate'],
        ['Ticket: User data appears in the wrong account. Best fix?', ['Audit user ID mapping and access control','Change page title','Delete help text'], 0, 'ปัญหาสิทธิ์/ID mapping']
      ],
      challenge:[
        ['Boss Ticket: Production users see stale data, API is slow, and cache was enabled yesterday. Fastest correct fix?', ['Invalidate cache, check API logs, and verify database query performance','Change the logo and reload the page','Ask users to wait one week'], 0, 'ต้องแก้ cache + logs + query']
      ]
    };
    const r = pickRow(rows, level, no);
    return makeChoiceQuestion(qid(meta, level, no), 'reading', level, '', r[0], r[1], r[2], r[3]);
  }

  function buildS7WritingTerminalClient(meta, level, no){
    const rows = {
      easy:[
        ['Client Terminal: “What is an app?” Type a simple answer.','An app is a program that helps users do a task.',['app','program','helps','users'],'ใช้คำง่าย'],
        ['Client Terminal: “What is AI?” Type a simple answer.','AI is technology that helps computers learn from data.',['ai','technology','learn','data'],'อธิบาย AI ง่าย ๆ'],
        ['Client Terminal: “Why do we need login?” Type a simple answer.','Login helps protect user accounts.',['login','protect','accounts'],'ตอบสั้นและตรง']
      ],
      normal:[
        ['Client Terminal: “Why is the system slow?” Type a simple explanation.','The system may be slow because many users are using it at the same time.',['slow','many','users','same','time'],'ไม่ใช้ศัพท์ยากเกิน'],
        ['Client Terminal: “What does database mean?” Type a simple explanation.','A database stores information so the app can use it later.',['database','stores','information','app'],'ใช้ analogy ง่ายได้'],
        ['Client Terminal: “Why should we test before launch?” Type a simple explanation.','Testing helps us find problems before real users use the app.',['testing','find','problems','users'],'เน้น benefit']
      ],
      hard:[
        ['Client Terminal: “Why does AI need data?” Type a non-technical explanation.','AI needs data because it learns patterns from examples, like a student practicing with many exercises.',['ai','data','learns','patterns','examples'],'ใช้ analogy'],
        ['Client Terminal: “Why can’t we build every feature today?” Type a polite explanation.','We should build the most important features first so the product is stable and useful.',['important','features','first','stable','useful'],'อธิบาย limitation อย่างสุภาพ'],
        ['Client Terminal: “Why do we need user requirements?” Type a simple explanation.','Requirements help us understand what users really need before we design the system.',['requirements','users','need','design','system'],'ตอบแบบ consultant']
      ],
      challenge:[
        ['Client Terminal Challenge: “Explain AI, risk, and value in simple words.”','AI can help us make faster decisions, but we must use good data and protect user privacy.',['ai','faster','decisions','data','privacy'],'ต้องง่ายแต่ครบ value + risk']
      ]
    };
    const r = pickRow(rows, level, no);
    return makeTextQuestion(qid(meta, level, no), 'writing', level, r[0], r[1], r[2], r[3]);
  }

  function buildS8ListeningEthics(meta, level, no){
    const rows = {
      easy:[
        ['Is it okay to share a user password with your friend?','Choose the ethical answer.', ['No, passwords must be private','Yes, if they ask','Yes, for fun'], 0, 'password เป็นข้อมูลส่วนตัว'],
        ['Should you ask permission before using personal data?','Choose the ethical answer.', ['Yes, ask permission first','No, use it secretly','Only if bored'], 0, 'ต้องขอ consent'],
        ['Can you copy code without checking the license?','Choose the ethical answer.', ['No, check the license first','Yes, always copy','Yes, hide the source'], 0, 'ต้องดู license']
      ],
      normal:[
        ['Is it ethical to train AI on private student data without consent?','Choose the best answer.', ['No, consent and protection are required','Yes, AI can use anything','Yes, if it is fast'], 0, 'privacy + consent'],
        ['Should an AI system explain why it rejects a user request?','Choose the best answer.', ['Yes, when possible, it should be explainable','No, users never need reasons','Only if the screen is blue'], 0, 'explainability'],
        ['Is biased training data a serious AI ethics issue?','Choose the best answer.', ['Yes, it can create unfair results','No, bias is always good','Only in games'], 0, 'bias ทำให้ unfair']
      ],
      hard:[
        ['If an AI model works well for one group but poorly for another, should the team investigate bias?','Choose the ethical answer.', ['Yes, they should test fairness across groups','No, ignore the smaller group','Only change the color'], 0, 'fairness across groups'],
        ['If users do not understand how their data is used, what should the team improve?','Choose the best answer.', ['Transparency and consent information','The background music','The logo size'], 0, 'transparency'],
        ['If a chatbot gives medical advice, what is the safest response?','Choose the best answer.', ['Warn users and direct them to qualified professionals','Tell users to trust it completely','Hide the warning'], 0, 'safety critical']
      ],
      challenge:[
        ['Ethics challenge: An investor wants to use user data without telling users to improve profit. Is this acceptable?','Choose the best answer.', ['No, users need transparency, consent, and data protection','Yes, profit is more important','Yes, if nobody notices'], 0, 'legal + ethical + privacy']
      ]
    };
    const r = pickRow(rows, level, no);
    return makeChoiceQuestion(qid(meta, level, no), 'listening', level, r[0], 'Listen to the ethics question and choose the legal and ethical answer.', r[2], r[3], r[4], { hidePrompt:true });
  }

  function buildS9SpeakingDataBoss(meta, level, no){
    const rows = {
      easy:[
        ['Say clearly: “The chart shows higher sales.”','The chart shows higher sales.',['chart','higher','sales'],'พูด chart + trend'],
        ['Say clearly: “The data shows user growth.”','The data shows user growth.',['data','user','growth'],'พูด data shows...'],
        ['Say clearly: “Accuracy improved this week.”','Accuracy improved this week.',['accuracy','improved','week'],'พูด improved ให้ชัด']
      ],
      normal:[
        ['Speak as a data analyst: “The trend increased after the new feature launch.”','The trend increased after the new feature launch.',['trend','increased','feature','launch'],'อธิบาย trend + reason'],
        ['Speak as a data analyst: “The dashboard shows a drop in active users.”','The dashboard shows a drop in active users.',['dashboard','drop','active','users'],'พูด drop in active users'],
        ['Speak as a data analyst: “The conversion rate improved by ten percent.”','The conversion rate improved by ten percent.',['conversion','rate','improved','percent'],'ศัพท์ data ต้องชัด']
      ],
      hard:[
        ['Unlock the hacked system: “The anomaly may be caused by missing data in the latest report.”','The anomaly may be caused by missing data in the latest report.',['anomaly','missing','data','report'],'พูด anomaly ให้ชัด'],
        ['Unlock the hacked system: “The model performs better after cleaning duplicate records.”','The model performs better after cleaning duplicate records.',['model','performs','cleaning','duplicate','records'],'ใช้คำ data cleaning'],
        ['Unlock the hacked system: “The spike in traffic suggests a successful campaign.”','The spike in traffic suggests a successful campaign.',['spike','traffic','suggests','campaign'],'พูด suggests ให้ชัด']
      ],
      challenge:[
        ['Boss voice key: “The dashboard indicates a sharp decline in retention, so we should investigate onboarding friction.”','The dashboard indicates a sharp decline in retention, so we should investigate onboarding friction.',['dashboard','decline','retention','investigate','onboarding'],'ยาวและ technical']
      ]
    };
    const r = pickRow(rows, level, no);
    return makeTextQuestion(qid(meta, level, no), 'speaking', level, r[0], r[1], r[2], r[3], { requireMic:true });
  }

  function buildS10ReadingHologram(meta, level, no){
    const rows = {
      easy:[
        ['Hologram: “I need a simple login page.” Best reply?', ['We can design a simple login page for you.','We cannot talk to clients.','Please delete your company.'], 0, 'ตอบตรง request'],
        ['Hologram: “The app is too slow.” Best reply?', ['We will check performance and loading time.','We will change your chair.','We will ignore it.'], 0, 'slow = performance'],
        ['Hologram: “Users cannot find the menu.” Best reply?', ['We can improve the navigation menu.','We can remove all menus.','That is not technology.'], 0, 'navigation']
      ],
      normal:[
        ['Hologram: “Our staff need a dashboard to track daily sales.” Best reply?', ['We can create a dashboard that shows daily sales clearly.','We can build a racing game.','We should delete sales data.'], 0, 'track daily sales'],
        ['Hologram: “Customers leave because checkout takes too long.” Best reply?', ['We should simplify checkout and measure completion time.','We should make checkout longer.','We should hide the payment button.'], 0, 'checkout problem'],
        ['Hologram: “Managers need weekly reports by email.” Best reply?', ['We can automate weekly email reports for managers.','We can stop sending reports.','We can print random pictures.'], 0, 'weekly reports']
      ],
      hard:[
        ['Hologram: “We need an app that works offline for field workers.” Best reply?', ['We should design offline data storage and sync when internet returns.','We should require internet all the time.','We should remove field workers.'], 0, 'offline + sync'],
        ['Hologram: “Our support team receives repeated questions.” Best reply?', ['We can build an FAQ chatbot and track unresolved issues.','We can ignore support tickets.','We can close the website.'], 0, 'support repeated questions'],
        ['Hologram: “The client wants fast insights from survey results.” Best reply?', ['We can visualize survey data and highlight key trends.','We can hide the results.','We can make the text smaller.'], 0, 'insights + visualize']
      ],
      challenge:[
        ['Hologram Challenge: “We need a secure AI dashboard for executives, but staff must only see their own data.” Best reply?', ['We should use role-based access, secure authentication, and clear executive-level visualizations.','We should let everyone see all data.','We should avoid security because it takes time.'], 0, 'security + roles + dashboard']
      ]
    };
    const r = pickRow(rows, level, no);
    return makeChoiceQuestion(qid(meta, level, no), 'reading', level, '', r[0], r[1], r[2], r[3]);
  }

  function buildS11ListeningAngryClient(meta, level, no){
    const rows = {
      easy:[
        ['I am upset because the login page does not work!','What is the client problem?', ['login page does not work','the logo is pretty','the office is closed'], 0, 'ignore tone, focus content'],
        ['This app is too slow! I cannot open the dashboard!','What can’t the client open?', ['dashboard','camera','book'], 0, 'ฟัง dashboard'],
        ['Why is the payment button missing again?','What is missing?', ['payment button','student name','weather'], 0, 'ฟัง missing']
      ],
      normal:[
        ['I told your team yesterday! The report still shows old data!','What is the problem?', ['report shows old data','report is too colorful','team likes pizza'], 0, 'old data'],
        ['The upload fails every time I add a large image!','When does upload fail?', ['when adding a large image','when opening email','when drinking water'], 0, 'every time + large image'],
        ['Your system keeps logging me out during checkout!','When does logout happen?', ['during checkout','during lunch','during class'], 0, 'during checkout']
      ],
      hard:[
        ['I am really frustrated! My staff cannot access the dashboard after the permission update!','What likely changed?', ['permission update','screen brightness','office furniture'], 0, 'permission update'],
        ['This is urgent! The API timeout happens whenever we export monthly reports!','When does timeout happen?', ['when exporting monthly reports','when typing a name','when changing color'], 0, 'whenever'],
        ['I need a solution today! The app crashes after users submit the survey form!','What action causes the crash?', ['submitting the survey form','reading the logo','opening a map'], 0, 'after submit']
      ],
      challenge:[
        ['Listen carefully! I am angry, but the real issue is that managers see the wrong branch data after the latest dashboard update!','What is the real issue?', ['wrong branch data after dashboard update','the client dislikes meetings','the phone is expensive'], 0, 'tone หลอกได้ ต้องจับ content']
      ]
    };
    const r = pickRow(rows, level, no);
    return makeChoiceQuestion(qid(meta, level, no), 'listening', level, r[0], 'Listen to the angry client. Focus on the problem, not the tone.', r[2], r[3], r[4], { hidePrompt:true, angryTone:true });
  }

  function buildS12WritingFounderBoss(meta, level, no){
    const rows = {
      easy:[
        ['Investor: “Why should I fund your app?” Type a short answer.','Our app helps students learn English faster.',['app','helps','students','english'],'ตอบ value ชัด'],
        ['Investor: “What problem do you solve?” Type a short answer.','We solve the problem of low English confidence.',['solve','problem','english','confidence'],'ตอบ problem'],
        ['Investor: “Who uses your product?” Type a short answer.','Our users are students who want to practice English.',['users','students','practice','english'],'ตอบ target users']
      ],
      normal:[
        ['Villain Investor: “Your idea sounds weak.” Type a confident response.','Our product is useful because it gives students interactive speaking practice.',['product','useful','students','practice'],'ตอบอย่างมั่นใจ'],
        ['Investor: “What makes your product different?” Type a value proposition.','Our app combines VR missions, AI feedback, and real communication practice.',['vr','ai','feedback','practice'],'พูด value prop'],
        ['Investor: “How will users benefit?” Type a persuasive answer.','Users will improve confidence, vocabulary, and communication skills through short missions.',['improve','confidence','vocabulary','communication'],'ระบุ benefit']
      ],
      hard:[
        ['Villain Investor: “Why will this product survive in the market?” Type a strong founder answer.','It solves a real learning pain point with gamified practice and measurable progress data.',['solves','pain','gamified','measurable','progress'],'เชื่อม pain point + evidence'],
        ['Investor: “How do you prove impact?” Type a professional response.','We track attendance, accuracy, speaking attempts, and session progress to measure learning impact.',['track','accuracy','speaking','progress','impact'],'ใช้ metrics'],
        ['Investor: “Why is AI necessary?” Type a clear response.','AI helps adapt difficulty, give feedback, and personalize missions for each learner.',['ai','adapt','feedback','personalize'],'อธิบาย role ของ AI']
      ],
      challenge:[
        ['Boss Pitch: “Convince me in two sentences: problem, solution, value, and evidence.”','Students need safe English practice. Our VR-AI platform gives short missions, adaptive feedback, and progress data to prove improvement.',['students','practice','vr','ai','feedback','data'],'ต้องครบ pitch structure']
      ]
    };
    const r = pickRow(rows, level, no);
    return makeTextQuestion(qid(meta, level, no), 'writing', level, r[0], r[1], r[2], r[3]);
  }

  function buildS13ReadingHrInterview(meta, level, no){
    const rows = {
      easy:[
        ['HR asks: “Tell me about yourself.” Best answer?', ['I am a CS student interested in AI and software development.','I do not want this job.','I forgot everything.'], 0, 'professional intro'],
        ['HR asks: “Why do you want this internship?” Best answer?', ['I want to learn from real projects and improve my skills.','Because I dislike studying.','Because the room is cold.'], 0, 'learning goal'],
        ['HR asks: “What is your strength?” Best answer?', ['I am willing to learn and solve problems.','I never work with anyone.','I am always late.'], 0, 'positive strength']
      ],
      normal:[
        ['HR asks: “Describe a project you worked on.” Best answer?', ['I built a small web app and tested it with users.','I watched TV all day.','I lost my project.'], 0, 'project + action'],
        ['HR asks: “How do you handle teamwork?” Best answer?', ['I communicate clearly, listen to teammates, and ask for clarification.','I avoid everyone.','I delete team files.'], 0, 'teamwork professional'],
        ['HR asks: “How do you learn new technology?” Best answer?', ['I read documentation, practice with examples, and ask for feedback.','I wait forever.','I only guess.'], 0, 'learning process']
      ],
      hard:[
        ['HR asks: “Tell me about a challenge using STAR.” Best answer?', ['Situation: our app had a bug. Task: I had to fix it. Action: I checked logs. Result: the app worked again.','I did nothing and blamed others.','The weather was nice.'], 0, 'STAR structure'],
        ['HR asks: “What career goal connects to this role?” Best answer?', ['I want to become a developer who builds useful AI-powered learning tools.','I want any job without learning.','I do not like technology.'], 0, 'goal + role'],
        ['HR asks: “How do you respond to feedback?” Best answer?', ['I listen carefully, ask clarifying questions, and improve my work.','I get angry and stop working.','I ignore all feedback.'], 0, 'growth mindset']
      ],
      challenge:[
        ['HR Challenge: “Why should we choose you over other candidates?” Best answer?', ['I combine technical curiosity, communication skills, and a strong willingness to learn from real projects.','Because I am the loudest person.','Because I do not need teamwork.'], 0, 'professional differentiation']
      ]
    };
    const r = pickRow(rows, level, no);
    return makeChoiceQuestion(qid(meta, level, no), 'reading', level, '', r[0], r[1], r[2], r[3]);
  }

  function buildS14SpeakingTechnical(meta, level, no){
    const rows = {
      easy:[
        ['Say clearly: “An algorithm is a set of steps.”','An algorithm is a set of steps.',['algorithm','set','steps'],'ออกเสียง algorithm'],
        ['Say clearly: “A function takes input and returns output.”','A function takes input and returns output.',['function','input','output'],'พูด input/output ให้ชัด'],
        ['Say clearly: “A database stores data.”','A database stores data.',['database','stores','data'],'พูด database']
      ],
      normal:[
        ['Say clearly: “First, I check the input. Then, I process the data.”','First, I check the input. Then, I process the data.',['first','input','process','data'],'พูดลำดับขั้นตอน'],
        ['Say clearly: “This algorithm finds the largest number in the list.”','This algorithm finds the largest number in the list.',['algorithm','largest','number','list'],'ศัพท์ algorithm'],
        ['Say clearly: “The loop repeats until the condition is false.”','The loop repeats until the condition is false.',['loop','repeats','condition','false'],'พูด condition']
      ],
      hard:[
        ['Explain aloud: “I use a loop to compare each item and update the maximum value.”','I use a loop to compare each item and update the maximum value.',['loop','compare','item','maximum','value'],'technical sentence ยาวขึ้น'],
        ['Explain aloud: “The function validates the input before sending data to the server.”','The function validates the input before sending data to the server.',['function','validates','input','server'],'พูด validates'],
        ['Explain aloud: “If the condition is true, the program executes the next block.”','If the condition is true, the program executes the next block.',['condition','true','program','executes','block'],'ออกเสียง executes']
      ],
      challenge:[
        ['Strict mic challenge: “I would solve this problem by breaking it into smaller steps, checking edge cases, and testing the output.”','I would solve this problem by breaking it into smaller steps, checking edge cases, and testing the output.',['solve','smaller','steps','edge','cases','testing'],'ยาว ต้องชัดและครบ']
      ]
    };
    const r = pickRow(rows, level, no);
    return makeTextQuestion(qid(meta, level, no), 'speaking', level, r[0], r[1], r[2], r[3], { requireMic:true, strictMic:true });
  }

  function buildS15ListeningFinalNetwork(meta, level, no){
    const rows = {
      easy:[
        ['Global alert: The Asia server is down. Restart the Asia server.','Which server needs action?', ['Asia server','Europe printer','student laptop'], 0, 'ฟัง Asia server'],
        ['Global alert: The backup is ready. Restore the network.','What is ready?', ['backup','coffee','camera'], 0, 'ฟัง backup'],
        ['Global alert: Block suspicious traffic now.','What should you block?', ['suspicious traffic','classroom door','email title'], 0, 'ฟัง block']
      ],
      normal:[
        ['Global network alert: Europe reports login failures after the security update.','What problem is reported?', ['login failures','new background','slow lunch'], 0, 'Europe + login failures'],
        ['Global network alert: The database replica is delayed in South America.','What is delayed?', ['database replica','mobile camera','office chair'], 0, 'database replica'],
        ['Global network alert: The firewall blocks normal traffic in Japan.','What is the firewall doing?', ['blocking normal traffic','printing tickets','opening meetings'], 0, 'firewall blocks']
      ],
      hard:[
        ['Emergency: The North America API is unstable, and users cannot complete payments.','What is the business impact?', ['users cannot complete payments','users like the color','users hear music'], 0, 'impact = payment failure'],
        ['Emergency: The DNS change caused users in Europe to reach the wrong server.','What caused the issue?', ['DNS change','keyboard size','new logo'], 0, 'DNS change'],
        ['Emergency: The global dashboard shows delayed data because the sync job failed.','Why is data delayed?', ['sync job failed','team ate lunch','screen is small'], 0, 'because']
      ],
      challenge:[
        ['Final global attack: Asia has login failures, Europe has DNS errors, and North America has payment API timeouts. Choose the best first action.','What should the response team do first?', ['Prioritize incidents, check logs, and assign regional teams','Change the website color','Ignore all alerts'], 0, 'ต้องจัดลำดับ incident response']
      ]
    };
    const r = pickRow(rows, level, no);
    return makeChoiceQuestion(qid(meta, level, no), 'listening', level, r[0], 'FINAL LISTENING — No text prompt on screen.', r[2], r[3], r[4], { hidePrompt:true, final:true });
  }

  const SESSION_BANK = buildSessionBank();

  window.TECHPATH_LESSON_DATA = {
    version:'v20260428-CANONICAL-S1-S15-1Q-AI-DIFFICULTY',
    SKILLS,
    SESSIONS,
    SESSION_BANK
  };
})();
