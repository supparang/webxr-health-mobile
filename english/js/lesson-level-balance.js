/* =========================================================
 * /english/js/lesson-level-balance.js
 * PATCH v20260506-LEVEL-BALANCE-V1
 *
 * เป้าหมาย:
 * ✅ ปรับทุก S1–S15 ให้เหมาะกับ easy / normal / hard / challenge
 * ✅ Speaking ไม่ยาวเกินระดับ
 * ✅ Reading เพิ่มความยาว/ตัวเลือกหลอกตามระดับ
 * ✅ Listening เพิ่มจำนวน keyword ตามระดับ
 * ✅ Writing/Boss เพิ่มความครบ/ความมืออาชีพตามระดับ
 * ✅ ให้ AI Help ใช้ hint แบบไม่เฉลยทั้งหมด
 *
 * ใช้ร่วมกับ lesson.html ได้แบบ non-destructive
 * ========================================================= */

(function () {
  'use strict';

  const PATCH_ID = 'lesson-level-balance-v20260506';

  const SKILL_MAP = {
    S01: 'speaking',
    S02: 'reading',
    S03: 'writing-boss',
    S04: 'speaking',
    S05: 'listening',
    S06: 'reading-boss',
    S07: 'writing',
    S08: 'listening',
    S09: 'speaking-boss',
    S10: 'reading',
    S11: 'listening',
    S12: 'writing-boss',
    S13: 'reading',
    S14: 'speaking',
    S15: 'listening-final'
  };

  const LEVEL_RULES = {
    easy: {
      label: 'easy',
      speakingWords: [3, 7],
      writingWords: [3, 8],
      readingLines: 1,
      listeningKeywords: 1,
      strictness: 0.55,
      timeFactor: 1.25,
      hintDetail: 'high',
      description: 'สั้น ง่าย พูด/ตอบได้ทันที'
    },
    normal: {
      label: 'normal',
      speakingWords: [8, 14],
      writingWords: [8, 14],
      readingLines: 2,
      listeningKeywords: 2,
      strictness: 0.68,
      timeFactor: 1.0,
      hintDetail: 'medium',
      description: 'มาตรฐาน เล่นสนุก ไม่กดดัน'
    },
    hard: {
      label: 'hard',
      speakingWords: [15, 24],
      writingWords: [15, 24],
      readingLines: 3,
      listeningKeywords: 3,
      strictness: 0.78,
      timeFactor: 0.9,
      hintDetail: 'low',
      description: 'เริ่มยาก ต้องครบและแม่นขึ้น'
    },
    challenge: {
      label: 'challenge',
      speakingWords: [25, 35],
      writingWords: [25, 35],
      readingLines: 4,
      listeningKeywords: 4,
      strictness: 0.86,
      timeFactor: 0.8,
      hintDetail: 'minimal',
      description: 'ท้าทาย เหมาะกับเล่นซ้ำ/ทำคะแนนสูง'
    }
  };

  const BALANCED_BANK = {
    S01: {
      title: 'Speak like a Pro, Not a Robot',
      skill: 'speaking',
      easy: [
        {
          prompt: 'Introduce yourself to the team.',
          sample: 'Hi, I am a developer.',
          requiredKeywords: ['developer'],
          aiHelp: 'Say who you are. Keep it short.'
        }
      ],
      normal: [
        {
          prompt: 'Introduce your role in a tech team.',
          sample: 'Hi, I am a junior developer on this team.',
          requiredKeywords: ['junior developer', 'team'],
          aiHelp: 'Say your role and mention the team.'
        }
      ],
      hard: [
        {
          prompt: 'Introduce your role and what you are working on.',
          sample: 'Hi, I am a junior developer. I am working on the login page today.',
          requiredKeywords: ['junior developer', 'working', 'login page'],
          aiHelp: 'Include your role and today’s task.'
        }
      ],
      challenge: [
        {
          prompt: 'Introduce yourself professionally in a short project meeting.',
          sample: 'Hi, I am a junior developer on this project. Today, I am improving the login page and checking user feedback.',
          requiredKeywords: ['junior developer', 'project', 'login page', 'feedback'],
          aiHelp: 'Use a professional tone. Include role, task, and project context.'
        }
      ]
    },

    S02: {
      title: 'Read NPC Context and Choose the Best Reply',
      skill: 'reading',
      easy: [
        {
          prompt: 'Client: “The app is slow.”',
          choices: [
            'I will check the performance.',
            'I like the color.',
            'Good night.'
          ],
          answer: 'I will check the performance.',
          aiHelp: 'Find the problem word: slow.'
        }
      ],
      normal: [
        {
          prompt: 'Client: “The app is slow when I open the dashboard.”',
          choices: [
            'I will check the dashboard performance.',
            'Please change your company name.',
            'The payment is successful.'
          ],
          answer: 'I will check the dashboard performance.',
          aiHelp: 'The client says the dashboard is slow.'
        }
      ],
      hard: [
        {
          prompt: 'Client: “The dashboard loads slowly after login, but the profile page is fine.”',
          choices: [
            'I will investigate the dashboard loading issue after login.',
            'I will rebuild the profile page first.',
            'I will close the ticket because login works.'
          ],
          answer: 'I will investigate the dashboard loading issue after login.',
          aiHelp: 'Focus on where the problem happens: after login, dashboard.'
        }
      ],
      challenge: [
        {
          prompt: 'Client: “Users can log in, but the dashboard takes too long to load during peak hours. The profile page still works normally.”',
          choices: [
            'I will investigate dashboard performance during peak hours and compare it with normal traffic.',
            'I will remove the login page because users can log in.',
            'I will redesign the profile page because it works normally.'
          ],
          answer: 'I will investigate dashboard performance during peak hours and compare it with normal traffic.',
          aiHelp: 'Identify the real issue, the condition, and the unaffected page.'
        }
      ]
    },

    S03: {
      title: 'Boss Stage: Writing to Attack the Hacker Virus',
      skill: 'writing-boss',
      easy: [
        {
          prompt: 'Type a short fix command for a login bug.',
          sample: 'Fix the login bug.',
          requiredKeywords: ['fix', 'login'],
          aiHelp: 'Use fix plus the problem name.'
        }
      ],
      normal: [
        {
          prompt: 'Write a short message to fix a login error.',
          sample: 'I will fix the login error now.',
          requiredKeywords: ['fix', 'login error'],
          aiHelp: 'Say what you will fix.'
        }
      ],
      hard: [
        {
          prompt: 'Write a clear response about fixing a login error and testing it.',
          sample: 'I will fix the login error and test the form again.',
          requiredKeywords: ['fix', 'login error', 'test'],
          aiHelp: 'Mention the fix and the test.'
        }
      ],
      challenge: [
        {
          prompt: 'Write a professional response to stop the hacker virus by fixing and retesting login.',
          sample: 'I will fix the login error, retest the form, and report the result to the team.',
          requiredKeywords: ['fix', 'login error', 'retest', 'report'],
          aiHelp: 'Include action, validation, and team update.'
        }
      ]
    },

    S04: {
      title: 'Stand-up Update',
      skill: 'speaking',
      easy: [
        {
          prompt: 'Give one short progress update.',
          sample: 'I tested the login form.',
          requiredKeywords: ['tested', 'login form'],
          aiHelp: 'Say what you finished.'
        }
      ],
      normal: [
        {
          prompt: 'Give progress and next task.',
          sample: 'I tested the login form. I will test the dashboard.',
          requiredKeywords: ['tested', 'login form', 'dashboard'],
          aiHelp: 'Say progress first, then next task.'
        }
      ],
      hard: [
        {
          prompt: 'Give progress, next task, and what you need.',
          sample: 'I tested the login form. I will test the dashboard. I need sample data.',
          requiredKeywords: ['tested', 'login form', 'dashboard', 'sample data'],
          aiHelp: 'Use three parts: progress, next task, need.'
        }
      ],
      challenge: [
        {
          prompt: 'Give a complete stand-up update to your team.',
          sample: 'Yesterday, I tested the login form. Today, I will test the dashboard. I need sample data to continue.',
          requiredKeywords: ['yesterday', 'tested', 'login form', 'today', 'dashboard', 'sample data'],
          aiHelp: 'Use stand-up structure: yesterday, today, blocker or need.'
        }
      ]
    },

    S05: {
      title: 'Listening: Catch the Keywords',
      skill: 'listening',
      easy: [
        {
          audioText: 'Please check the login page.',
          prompt: 'What page should you check?',
          choices: ['Login page', 'Payment page', 'Profile page'],
          answer: 'Login page',
          requiredKeywords: ['login'],
          aiHelp: 'Listen for one page name.'
        }
      ],
      normal: [
        {
          audioText: 'Please check the login page and the dashboard.',
          prompt: 'Which two parts should you check?',
          choices: ['Login page and dashboard', 'Profile and email', 'Payment and report'],
          answer: 'Login page and dashboard',
          requiredKeywords: ['login', 'dashboard'],
          aiHelp: 'Listen for two parts of the system.'
        }
      ],
      hard: [
        {
          audioText: 'Please check the login page, the dashboard, and the error message.',
          prompt: 'What should you check?',
          choices: ['Login, dashboard, and error message', 'Profile, report, and email', 'Payment, password, and color'],
          answer: 'Login, dashboard, and error message',
          requiredKeywords: ['login', 'dashboard', 'error message'],
          aiHelp: 'There are three important keywords.'
        }
      ],
      challenge: [
        {
          audioText: 'The login page works, but the dashboard shows an error message after the user clicks refresh.',
          prompt: 'What is the main issue?',
          choices: [
            'The dashboard shows an error message after refresh.',
            'The login page does not open.',
            'The user wants a new color theme.'
          ],
          answer: 'The dashboard shows an error message after refresh.',
          requiredKeywords: ['dashboard', 'error message', 'refresh'],
          aiHelp: 'Do not focus on the part that works. Focus on the issue after refresh.'
        }
      ]
    },

    S06: {
      title: 'Boss Stage: Read Ticket and Choose Fastest Fix',
      skill: 'reading-boss',
      easy: [
        {
          prompt: 'Ticket: “Password reset email is not sent.”',
          choices: ['Check email sending', 'Change logo', 'Delete dashboard'],
          answer: 'Check email sending',
          aiHelp: 'Look for the broken function.'
        }
      ],
      normal: [
        {
          prompt: 'Ticket: “Users cannot receive password reset email.”',
          choices: [
            'Check the password reset email service.',
            'Change the dashboard layout.',
            'Ask users to create a new company.'
          ],
          answer: 'Check the password reset email service.',
          aiHelp: 'The issue is email for password reset.'
        }
      ],
      hard: [
        {
          prompt: 'Ticket: “Users can request password reset, but the email does not arrive.”',
          choices: [
            'Check email delivery logs and reset mail service.',
            'Disable the login system.',
            'Redesign the home page first.'
          ],
          answer: 'Check email delivery logs and reset mail service.',
          aiHelp: 'Request works, delivery fails.'
        }
      ],
      challenge: [
        {
          prompt: 'Ticket: “Password reset requests are saved, but emails fail during high traffic. Login still works.”',
          choices: [
            'Check reset email queue, delivery logs, and high-traffic failures.',
            'Rewrite the login page because login still works.',
            'Close the issue because reset requests are saved.'
          ],
          answer: 'Check reset email queue, delivery logs, and high-traffic failures.',
          aiHelp: 'Separate what works from what fails. Then choose the fastest technical check.'
        }
      ]
    },

    S07: {
      title: 'Writing: Explain IT Simply',
      skill: 'writing',
      easy: [
        {
          prompt: 'Explain what a bug is.',
          sample: 'A bug is a problem.',
          requiredKeywords: ['bug', 'problem'],
          aiHelp: 'Use simple words.'
        }
      ],
      normal: [
        {
          prompt: 'Explain a bug to a client.',
          sample: 'A bug is a problem in the software.',
          requiredKeywords: ['bug', 'problem', 'software'],
          aiHelp: 'Mention software.'
        }
      ],
      hard: [
        {
          prompt: 'Explain a bug and what your team will do.',
          sample: 'A bug is a problem in the software. Our team will fix it.',
          requiredKeywords: ['bug', 'problem', 'software', 'fix'],
          aiHelp: 'Explain and give action.'
        }
      ],
      challenge: [
        {
          prompt: 'Explain a bug professionally to a non-technical client.',
          sample: 'A bug is a software problem that causes something to work incorrectly. Our team will fix it and test it again.',
          requiredKeywords: ['bug', 'software problem', 'incorrectly', 'fix', 'test'],
          aiHelp: 'Use simple professional language. Avoid technical jargon.'
        }
      ]
    },

    S08: {
      title: 'Listening: Ethics Yes/No',
      skill: 'listening',
      easy: [
        {
          audioText: 'Can we share a user password with another team?',
          prompt: 'Is it ethical?',
          choices: ['No', 'Yes'],
          answer: 'No',
          aiHelp: 'Password is private.'
        }
      ],
      normal: [
        {
          audioText: 'Can we share customer data without permission?',
          prompt: 'Is it ethical?',
          choices: ['No', 'Yes'],
          answer: 'No',
          aiHelp: 'Listen for customer data and permission.'
        }
      ],
      hard: [
        {
          audioText: 'A teammate asks for customer data to test a demo, but the customer did not give permission.',
          prompt: 'What is the ethical answer?',
          choices: [
            'No, we need permission first.',
            'Yes, testing is always allowed.',
            'Yes, if we delete it later.'
          ],
          answer: 'No, we need permission first.',
          aiHelp: 'Testing does not remove the need for permission.'
        }
      ],
      challenge: [
        {
          audioText: 'A manager wants to use real customer data in a public demo because it looks more realistic, but the customer did not consent.',
          prompt: 'What should you choose?',
          choices: [
            'Refuse and suggest anonymized or sample data.',
            'Use real data because it looks realistic.',
            'Share only half of the real data.'
          ],
          answer: 'Refuse and suggest anonymized or sample data.',
          aiHelp: 'Find the privacy risk and choose the safer alternative.'
        }
      ]
    },

    S09: {
      title: 'Boss Stage: Speaking as Data Analyst',
      skill: 'speaking-boss',
      easy: [
        {
          prompt: 'Say one data result.',
          sample: 'Sales increased today.',
          requiredKeywords: ['sales', 'increased'],
          aiHelp: 'Say the result clearly.'
        }
      ],
      normal: [
        {
          prompt: 'Report one data result with a number.',
          sample: 'Sales increased by ten percent today.',
          requiredKeywords: ['sales', 'increased', 'percent'],
          aiHelp: 'Include the metric and result.'
        }
      ],
      hard: [
        {
          prompt: 'Report a data result and possible reason.',
          sample: 'Sales increased by ten percent today because the promotion worked.',
          requiredKeywords: ['sales', 'increased', 'ten percent', 'promotion'],
          aiHelp: 'Say result plus reason.'
        }
      ],
      challenge: [
        {
          prompt: 'Give a precise analyst response to unlock the hacked system.',
          sample: 'Sales increased by ten percent today, mainly because the promotion improved user clicks on the product page.',
          requiredKeywords: ['sales', 'increased', 'ten percent', 'promotion', 'user clicks'],
          aiHelp: 'Use metric, cause, and evidence.'
        }
      ]
    },

    S10: {
      title: 'Reading: Client Hologram Message',
      skill: 'reading',
      easy: [
        {
          prompt: 'Client: “I cannot open the report.”',
          choices: ['Check the report', 'Change the music', 'Close the app'],
          answer: 'Check the report',
          aiHelp: 'Find what the client cannot open.'
        }
      ],
      normal: [
        {
          prompt: 'Client: “I cannot open the monthly report.”',
          choices: [
            'Check the monthly report access.',
            'Change the login color.',
            'Create a new team name.'
          ],
          answer: 'Check the monthly report access.',
          aiHelp: 'The issue is report access.'
        }
      ],
      hard: [
        {
          prompt: 'Client: “I can open old reports, but I cannot open the monthly report for April.”',
          choices: [
            'Check April monthly report permission.',
            'Delete all old reports.',
            'Ignore the issue because old reports work.'
          ],
          answer: 'Check April monthly report permission.',
          aiHelp: 'Only one report is broken.'
        }
      ],
      challenge: [
        {
          prompt: 'Client: “The finance team can open old reports, but the April monthly report shows access denied after yesterday’s permission update.”',
          choices: [
            'Check April report permission changes from yesterday.',
            'Rebuild all finance reports immediately.',
            'Tell the client to use only old reports.'
          ],
          answer: 'Check April report permission changes from yesterday.',
          aiHelp: 'Catch team, report, error, and timing.'
        }
      ]
    },

    S11: {
      title: 'Listening: Angry Client Tone',
      skill: 'listening',
      easy: [
        {
          audioText: 'I cannot open the app.',
          prompt: 'What is the problem?',
          choices: ['Cannot open the app', 'Needs a new logo', 'Likes the app'],
          answer: 'Cannot open the app',
          aiHelp: 'Ignore emotion. Find the problem.'
        }
      ],
      normal: [
        {
          audioText: 'I am upset because I cannot open the app after the update.',
          prompt: 'What happened?',
          choices: [
            'The app cannot open after the update.',
            'The client wants a new color.',
            'The update was canceled.'
          ],
          answer: 'The app cannot open after the update.',
          aiHelp: 'Listen for after the update.'
        }
      ],
      hard: [
        {
          audioText: 'I am really frustrated. After the update, the app opens, but the dashboard is blank.',
          prompt: 'What is the real issue?',
          choices: [
            'The dashboard is blank after the update.',
            'The app never opens.',
            'The client wants a new dashboard color.'
          ],
          answer: 'The dashboard is blank after the update.',
          aiHelp: 'The app opens. The dashboard is the issue.'
        }
      ],
      challenge: [
        {
          audioText: 'This is frustrating. After yesterday’s update, the app opens normally, but the dashboard becomes blank when I filter monthly sales.',
          prompt: 'What should you report?',
          choices: [
            'Dashboard becomes blank when filtering monthly sales after the update.',
            'The app cannot open at all.',
            'The client only dislikes the sales chart.'
          ],
          answer: 'Dashboard becomes blank when filtering monthly sales after the update.',
          aiHelp: 'Separate emotion from facts: update, dashboard, filter, monthly sales.'
        }
      ]
    },

    S12: {
      title: 'Boss Stage: Founder Writing',
      skill: 'writing-boss',
      easy: [
        {
          prompt: 'Tell an investor your app helps students.',
          sample: 'Our app helps students learn.',
          requiredKeywords: ['app', 'helps', 'students'],
          aiHelp: 'Say who the app helps.'
        }
      ],
      normal: [
        {
          prompt: 'Tell an investor what your app does.',
          sample: 'Our app helps students learn English with games.',
          requiredKeywords: ['app', 'students', 'English', 'games'],
          aiHelp: 'Mention users and value.'
        }
      ],
      hard: [
        {
          prompt: 'Give a short startup pitch.',
          sample: 'Our app helps students learn English with games. It makes practice more fun.',
          requiredKeywords: ['students', 'English', 'games', 'practice', 'fun'],
          aiHelp: 'Say product, users, and benefit.'
        }
      ],
      challenge: [
        {
          prompt: 'Write a professional founder response to an investor.',
          sample: 'Our app helps students practice English through game missions. It improves motivation and gives teachers useful learning data.',
          requiredKeywords: ['students', 'practice English', 'game missions', 'motivation', 'learning data'],
          aiHelp: 'Include product, learning value, and teacher value.'
        }
      ]
    },

    S13: {
      title: 'Reading: HR Interview',
      skill: 'reading',
      easy: [
        {
          prompt: 'HR: “Can you work in a team?”',
          choices: [
            'Yes, I can work with others.',
            'No, I never listen.',
            'I do not like projects.'
          ],
          answer: 'Yes, I can work with others.',
          aiHelp: 'Choose the professional answer.'
        }
      ],
      normal: [
        {
          prompt: 'HR: “How do you work with a team?”',
          choices: [
            'I communicate clearly and help my team.',
            'I ignore my team.',
            'I only work when I want.'
          ],
          answer: 'I communicate clearly and help my team.',
          aiHelp: 'Good teamwork needs communication.'
        }
      ],
      hard: [
        {
          prompt: 'HR: “What do you do when your team has a problem?”',
          choices: [
            'I discuss the issue and help find a solution.',
            'I blame someone quickly.',
            'I stop working on the project.'
          ],
          answer: 'I discuss the issue and help find a solution.',
          aiHelp: 'Look for solution-oriented behavior.'
        }
      ],
      challenge: [
        {
          prompt: 'HR: “Describe how you handle disagreement in a project team.”',
          choices: [
            'I listen to different ideas, discuss evidence, and help the team choose a practical solution.',
            'I force everyone to use my idea.',
            'I avoid the team until the problem disappears.'
          ],
          answer: 'I listen to different ideas, discuss evidence, and help the team choose a practical solution.',
          aiHelp: 'Professional answers show listening, evidence, and solution.'
        }
      ]
    },

    S14: {
      title: 'Speaking: Complex Technical Sentence',
      skill: 'speaking',
      easy: [
        {
          prompt: 'Say one technical action.',
          sample: 'I fixed the bug.',
          requiredKeywords: ['fixed', 'bug'],
          aiHelp: 'Use one clear sentence.'
        }
      ],
      normal: [
        {
          prompt: 'Say what you fixed and tested.',
          sample: 'I fixed the bug and tested the app.',
          requiredKeywords: ['fixed', 'bug', 'tested', 'app'],
          aiHelp: 'Mention fix and test.'
        }
      ],
      hard: [
        {
          prompt: 'Say a technical update with cause and action.',
          sample: 'I found a bug in the dashboard, fixed it, and tested the app again.',
          requiredKeywords: ['bug', 'dashboard', 'fixed', 'tested'],
          aiHelp: 'Include where, action, and test.'
        }
      ],
      challenge: [
        {
          prompt: 'Say a longer professional technical update clearly.',
          sample: 'I found a bug in the dashboard filter, fixed the data query, and tested the app again with sample users.',
          requiredKeywords: ['dashboard filter', 'data query', 'tested', 'sample users'],
          aiHelp: 'Speak slowly. Include problem, technical fix, and validation.'
        }
      ]
    },

    S15: {
      title: 'Final Test: Listening to Save the Global Network',
      skill: 'listening-final',
      easy: [
        {
          audioText: 'The server is down.',
          prompt: 'What is the emergency?',
          choices: ['Server is down', 'Logo is old', 'Music is loud'],
          answer: 'Server is down',
          aiHelp: 'Listen for the emergency word.'
        }
      ],
      normal: [
        {
          audioText: 'The server is down and users cannot log in.',
          prompt: 'What should you report?',
          choices: [
            'Server down and login problem',
            'Only color problem',
            'Only music problem'
          ],
          answer: 'Server down and login problem',
          aiHelp: 'There are two important problems.'
        }
      ],
      hard: [
        {
          audioText: 'The main server is down, users cannot log in, and the backup system is slow.',
          prompt: 'What is the situation?',
          choices: [
            'Main server down, login problem, backup is slow',
            'Only the home page color changed',
            'The system is fully normal'
          ],
          answer: 'Main server down, login problem, backup is slow',
          aiHelp: 'Catch three crisis keywords.'
        }
      ],
      challenge: [
        {
          audioText: 'The global network is under attack. The main server is down, users cannot log in, and the backup system becomes slow during recovery.',
          prompt: 'What is the best final report?',
          choices: [
            'Global attack: main server down, login failure, and slow backup during recovery.',
            'The website needs a new logo and color.',
            'Users can log in normally and the server is fine.'
          ],
          answer: 'Global attack: main server down, login failure, and slow backup during recovery.',
          aiHelp: 'This is the final stage. Listen for attack, server, login, backup, and recovery.'
        }
      ]
    }
  };

  function normLevel(level) {
    const s = String(level || '').toLowerCase().trim();
    if (LEVEL_RULES[s]) return s;

    const urlLevel = new URLSearchParams(location.search).get('diff');
    const u = String(urlLevel || '').toLowerCase().trim();
    if (LEVEL_RULES[u]) return u;

    return 'normal';
  }

  function normSession(sessionNo) {
    let s = String(sessionNo || '').toUpperCase().trim();

    if (/^\d+$/.test(s)) {
      const n = Math.max(1, Math.min(15, Number(s)));
      return 'S' + String(n).padStart(2, '0');
    }

    s = s.replace(/^SESSION/i, 'S').replace(/\s+/g, '');

    const m = s.match(/^S?(\d{1,2})$/i);
    if (m) {
      const n = Math.max(1, Math.min(15, Number(m[1])));
      return 'S' + String(n).padStart(2, '0');
    }

    if (/^S\d\d$/.test(s)) return s;

    return 'S01';
  }

  function getItems(sessionNo, level) {
    const sid = normSession(sessionNo);
    const lvl = normLevel(level);
    const bank = BALANCED_BANK[sid];

    if (!bank) return [];

    return bank[lvl] || bank.normal || [];
  }

  function pickItem(sessionNo, level, index) {
    const items = getItems(sessionNo, level);
    if (!items.length) return null;

    const i = Math.abs(Number(index || 0)) % items.length;
    const item = Object.assign({}, items[i]);

    item.session = normSession(sessionNo);
    item.level = normLevel(level);
    item.skill = SKILL_MAP[item.session] || item.skill || 'unknown';
    item.levelRule = LEVEL_RULES[item.level];

    return item;
  }

  function countWords(text) {
    const s = String(text || '').trim();
    if (!s) return 0;
    return (s.match(/[A-Za-z0-9']+/g) || []).length;
  }

  function isTooLongForLevel(text, skill, level) {
    const lvl = normLevel(level);
    const rule = LEVEL_RULES[lvl];
    const n = countWords(text);

    if (/speaking/i.test(skill)) {
      return n > rule.speakingWords[1];
    }

    if (/writing/i.test(skill)) {
      return n > rule.writingWords[1];
    }

    return false;
  }

  function getExpectedLengthText(skill, level) {
    const lvl = normLevel(level);
    const r = LEVEL_RULES[lvl];

    if (/speaking/i.test(skill)) {
      return `${r.speakingWords[0]}–${r.speakingWords[1]} words`;
    }

    if (/writing/i.test(skill)) {
      return `${r.writingWords[0]}–${r.writingWords[1]} words`;
    }

    if (/listening/i.test(skill)) {
      return `${r.listeningKeywords} keyword(s)`;
    }

    if (/reading/i.test(skill)) {
      return `${r.readingLines} short line(s)`;
    }

    return 'balanced by level';
  }

  function makeHint(item) {
    if (!item) return '';

    const level = normLevel(item.level);
    const rule = LEVEL_RULES[level];
    const base = item.aiHelp || '';

    if (rule.hintDetail === 'high') {
      return base;
    }

    if (rule.hintDetail === 'medium') {
      return base.replace(/The answer is.*$/i, '').trim();
    }

    if (rule.hintDetail === 'low') {
      return base.split('.')[0] + '.';
    }

    return 'Focus on keywords and answer professionally.';
  }

  function injectStyle() {
    if (document.getElementById(PATCH_ID + '-style')) return;

    const style = document.createElement('style');
    style.id = PATCH_ID + '-style';
    style.textContent = `
      .lesson-level-balance-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border-radius: 999px;
        border: 1px solid rgba(117,238,255,.38);
        background: rgba(117,238,255,.12);
        color: #eaffff;
        padding: 6px 10px;
        font: 900 12px/1 system-ui,-apple-system,Segoe UI,sans-serif;
        margin: 4px 6px 4px 0;
      }

      .lesson-level-balance-note {
        border: 1px solid rgba(117,238,255,.28);
        background: rgba(255,255,255,.07);
        color: #eaffff;
        border-radius: 16px;
        padding: 10px 12px;
        font: 800 13px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;
        margin: 10px 0;
      }
    `;
    document.head.appendChild(style);
  }

  function exposeGlobals() {
    window.LessonLevelBalance = {
      version: PATCH_ID,
      rules: LEVEL_RULES,
      skillMap: SKILL_MAP,
      bank: BALANCED_BANK,
      normLevel,
      normSession,
      getItems,
      pickItem,
      countWords,
      isTooLongForLevel,
      getExpectedLengthText,
      makeHint,

      getCurrent: function () {
        const qs = new URLSearchParams(location.search);
        const level = normLevel(qs.get('diff') || window.LESSON_DIFF || window.currentDiff);
        const session =
          qs.get('session') ||
          qs.get('s') ||
          window.LESSON_SESSION ||
          window.currentSession ||
          'S01';

        return pickItem(session, level, 0);
      },

      debug: function (session, level) {
        const sid = normSession(session || 'S04');
        const lvl = normLevel(level || 'normal');
        const item = pickItem(sid, lvl, 0);

        console.log('[LessonLevelBalance]', {
          session: sid,
          level: lvl,
          skill: SKILL_MAP[sid],
          rule: LEVEL_RULES[lvl],
          item
        });

        return item;
      }
    };

    // aliases เผื่อ engine เดิมเรียกชื่อกลาง
    window.LESSON_LEVEL_RULES = LEVEL_RULES;
    window.LESSON_BALANCED_BANK = BALANCED_BANK;
  }

  function patchAIHelpIfPossible() {
    const oldSpeak = window.speakAIHelpUS;

    window.speakLessonBalancedHint = function (session, level, index) {
      const item = pickItem(session, level, index);
      const hint = makeHint(item);

      if (typeof oldSpeak === 'function') {
        oldSpeak(hint);
      } else if (window.LessonUSVoice && typeof window.LessonUSVoice.speak === 'function') {
        window.LessonUSVoice.speak(hint);
      }

      return hint;
    };
  }

  function addDebugBadge() {
    if (document.getElementById('lessonLevelBalanceBadge')) return;

    const qs = new URLSearchParams(location.search);
    const level = normLevel(qs.get('diff') || 'normal');

    const badge = document.createElement('div');
    badge.id = 'lessonLevelBalanceBadge';
    badge.className = 'lesson-level-balance-note';
    badge.style.cssText = [
      'position:fixed',
      'left:12px',
      'bottom:136px',
      'z-index:999996',
      'max-width:min(420px,calc(100vw - 24px))',
      'display:none'
    ].join(';');

    badge.innerHTML = `
      <span class="lesson-level-balance-chip">⚙️ Level Balance: ${level}</span>
      <span class="lesson-level-balance-chip">Speaking ${LEVEL_RULES[level].speakingWords[0]}–${LEVEL_RULES[level].speakingWords[1]} words</span>
      <span class="lesson-level-balance-chip">Strictness ${Math.round(LEVEL_RULES[level].strictness * 100)}%</span>
    `;

    document.body.appendChild(badge);

    window.showLessonLevelBalanceBadge = function () {
      badge.style.display = 'block';
      clearTimeout(badge._t);
      badge._t = setTimeout(function () {
        badge.style.display = 'none';
      }, 4200);
    };
  }

  function init() {
    injectStyle();
    exposeGlobals();
    patchAIHelpIfPossible();
    addDebugBadge();

    console.log('[LessonLevelBalance] ready', PATCH_ID);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
