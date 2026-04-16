export const missionDB = [

            { id: 1, type: 'speaking', title: 'S1: Introduction', variations: [
                { desc: 'พูดตาม: "I am a computer science student at the university"', exactPhrase: 'i am a computer science student at the university', failMsg: "พยายามพูดให้ชัดเจน (อนุโลมให้เพี้ยนได้)" },
                { desc: 'พูดตาม: "I am studying artificial intelligence at the university now"', exactPhrase: 'i am studying artificial intelligence at the university now', failMsg: "พยายามพูดให้ชัดเจน (อนุโลมให้เพี้ยนได้)" },
                { desc: 'พูดตาม: "I want to be a software engineer in the future"', exactPhrase: 'i want to be a software engineer in the future', failMsg: "พยายามพูดให้ชัดเจน (อนุโลมให้เพี้ยนได้)" },
                { desc: 'พูดตาม: "I am learning how to code web applications today"', exactPhrase: 'i am learning how to code web applications today', failMsg: "พยายามพูดให้ชัดเจน (อนุโลมให้เพี้ยนได้)" },
                { desc: 'พูดตาม: "My dream is to work at a big tech company"', exactPhrase: 'my dream is to work at a big tech company', failMsg: "พยายามพูดให้ชัดเจน (อนุโลมให้เพี้ยนได้)" }
            ]},

            { id: 2, type: 'reading', title: 'S2: Networking', variations: [
                { desc: 'เลือกคำทักทายที่เหมาะสม', question: 'NPC: Hello! Nice to meet you.', choices: ['A: I am sleepy.', 'B: Nice to meet you too.', 'C: Goodbye.'], answer: 'B' },
                { desc: 'ตอบคำถามสารทุกข์สุกดิบ', question: 'NPC: How are you doing today?', choices: ['A: I am doing great, thanks.', 'B: The weather is hot.', 'C: I like pizza.'], answer: 'A' },
                { desc: 'ตอบรับการแนะนำตัว', question: 'NPC: Hi, my name is Sarah from Google.', choices: ['A: Google is a website.', 'B: Where is the bathroom?', 'C: Hello Sarah, I am John.'], answer: 'C' },
                { desc: 'ทักทายในงานสัมมนา', question: 'NPC: Good morning, welcome to the tech conference.', choices: ['A: Thank you very much.', 'B: I am sleeping.', 'C: The conference is blue.'], answer: 'A' },
                { desc: 'ตอบรับคำยินดี', question: 'NPC: It is a pleasure to meet you.', choices: ['A: I want pizza.', 'B: The pleasure is mine.', 'C: Goodbye.'], answer: 'B' }
            ]},

            { id: 3, type: 'writing', title: 'S3: Tech Stack', variations: [
                { desc: 'พิมพ์ภาษาที่เขียนโปรแกรม', prompt: 'SYSTEM: What is your main programming language?\nYOU: [Type your answer]', keywords: ['python', 'java', 'c++', 'javascript', 'c#', 'php', 'ruby', 'html', 'css'], minMatch: 1, failMsg: "ลองพิมพ์ชื่อภาษาเช่น 'python'" },
                { desc: 'พิมพ์ชื่อระบบฐานข้อมูล', prompt: 'SYSTEM: Which database system do you use?\nYOU: [Type your answer]', keywords: ['sql', 'mysql', 'mongo', 'firebase', 'oracle', 'database'], minMatch: 1, failMsg: "ลองพิมพ์ชื่อฐานข้อมูลเช่น 'mysql'" },
                { desc: 'พิมพ์ชื่อระบบจัดการโค้ด', prompt: 'SYSTEM: What tool do you use for version control?\nYOU: [Type your answer]', keywords: ['git', 'github', 'gitlab', 'bitbucket'], minMatch: 1, failMsg: "ลองพิมพ์ว่า 'git' หรือ 'github'" },
                { desc: 'พิมพ์ชื่อ Frontend Framework', prompt: 'SYSTEM: What framework do you use for frontend?\nYOU: [Type your answer]', keywords: ['react', 'angular', 'vue', 'html', 'tailwind', 'bootstrap'], minMatch: 1, failMsg: "ลองพิมพ์ว่า 'react' หรือ 'vue'" },
                { desc: 'พิมพ์ชื่อระบบปฏิบัติการ', prompt: 'SYSTEM: What operating system do you prefer for coding?\nYOU: [Type your answer]', keywords: ['linux', 'windows', 'mac', 'ubuntu', 'macos'], minMatch: 1, failMsg: "ลองพิมพ์ว่า 'windows' หรือ 'linux'" }
            ]},

            { id: 4, type: 'speaking', title: 'S4: Stand-up', variations: [
                { desc: 'พูดตาม: "I will fix the login bug in our system"', exactPhrase: 'i will fix the login bug in our system', failMsg: "พยายามพูดให้ชัดเจน" },
                { desc: 'พูดตาม: "I finished my coding tasks for the project yesterday"', exactPhrase: 'i finished my coding tasks for the project yesterday', failMsg: "พยายามพูดให้ชัดเจน" },
                { desc: 'พูดตาม: "Today I will work on the backend api integration"', exactPhrase: 'today i will work on the backend api integration', failMsg: "พยายามพูดให้ชัดเจน" },
                { desc: 'พูดตาม: "Yesterday I tested the mobile app with my team"', exactPhrase: 'yesterday i tested the mobile app with my team', failMsg: "พยายามพูดให้ชัดเจน" },
                { desc: 'พูดตาม: "I need help with the database deployment issue"', exactPhrase: 'i need help with the database deployment issue', failMsg: "พยายามพูดให้ชัดเจน" }
            ]},

            { id: 5, type: 'listening', title: 'S5: Interview Final', variations: [
                { desc: 'ฟังและเลือกคำตอบที่เหมาะสม', audioText: 'Tell me about yourself and your experience.', choices: ['A: I like watching movies.', 'B: I am a computer science student with project experience.', 'C: My house is near the station.'], answer: 'B' },
                { desc: 'ฟังและเลือกคำตอบสัมภาษณ์', audioText: 'Why do you want to join our company?', choices: ['A: Because your company has strong innovation culture.', 'B: I have a red notebook.', 'C: The office is big.'], answer: 'A' },
                { desc: 'ฟังและเลือกคำตอบเรื่องจุดแข็ง', audioText: 'What is your greatest strength?', choices: ['A: I sleep a lot.', 'B: I am good at teamwork and problem solving.', 'C: I eat quickly.'], answer: 'B' },
                { desc: 'ฟังและเลือกคำตอบเรื่องเป้าหมาย', audioText: 'Where do you see yourself in five years?', choices: ['A: I want to grow as a software engineer and team leader.', 'B: Five years is a number.', 'C: I like trains.'], answer: 'A' },
                { desc: 'ฟังและเลือกคำตอบเรื่องโปรเจกต์', audioText: 'Can you describe a project you worked on?', choices: ['A: I built a web application with my university team.', 'B: My favorite color is blue.', 'C: I usually wake up early.'], answer: 'A' }
            ]},

            { id: 6, type: 'reading', title: 'S6: Agile Team', variations: [
                { desc: 'เลือกคำตอบสถานการณ์ทีม', question: 'Scrum Master: What did you finish yesterday?', choices: ['A: I finished the bug fixes.', 'B: Yesterday is blue.', 'C: I like football.'], answer: 'A' },
                { desc: 'เลือกคำตอบเรื่องอุปสรรค', question: 'Team Lead: Do you have any blockers?', choices: ['A: Yes, I need access to the API docs.', 'B: I am a blocker.', 'C: The blocker is coffee.'], answer: 'A' },
                { desc: 'เลือกคำตอบเรื่องแผนวันนี้', question: 'Manager: What will you do today?', choices: ['A: I will update the user interface.', 'B: Today is Monday.', 'C: The office is white.'], answer: 'A' },
                { desc: 'เลือกคำตอบเรื่องช่วยทีม', question: 'Colleague: Can you help review my code?', choices: ['A: Sure, I can review it after lunch.', 'B: The code is sleeping.', 'C: I am a sandwich.'], answer: 'A' },
                { desc: 'เลือกคำตอบเรื่อง sprint', question: 'Product Owner: Are we ready for the sprint review?', choices: ['A: Yes, the main feature is ready for demo.', 'B: Sprint is a sport only.', 'C: Review means food.'], answer: 'A' }
            ]},

            { id: 7, type: 'writing', title: 'S7: Bug Report', variations: [
                { desc: 'พิมพ์คำเกี่ยวกับ bug', prompt: 'SYSTEM: Describe the bug briefly.\nYOU: [Type your answer]', keywords: ['bug', 'error', 'crash', 'issue', 'problem', 'login', 'button', 'screen'], minMatch: 1, failMsg: "ลองพิมพ์คำอย่าง bug, error, crash" },
                { desc: 'พิมพ์คำเกี่ยวกับ testing', prompt: 'SYSTEM: What did you do to test it?\nYOU: [Type your answer]', keywords: ['test', 'tested', 'testing', 'click', 'login', 'mobile', 'browser'], minMatch: 1, failMsg: "ลองพิมพ์คำเกี่ยวกับการทดสอบ" },
                { desc: 'พิมพ์คำเกี่ยวกับ expected result', prompt: 'SYSTEM: What result did you expect?\nYOU: [Type your answer]', keywords: ['expected', 'should', 'work', 'open', 'show', 'display'], minMatch: 1, failMsg: "ลองพิมพ์ว่า should work / expected" },
                { desc: 'พิมพ์คำเกี่ยวกับ actual result', prompt: 'SYSTEM: What actually happened?\nYOU: [Type your answer]', keywords: ['actual', 'happened', 'crash', 'error', 'not work', 'fail'], minMatch: 1, failMsg: "ลองพิมพ์ว่า crash / error / not work" },
                { desc: 'พิมพ์คำเกี่ยวกับ severity', prompt: 'SYSTEM: How serious is the bug?\nYOU: [Type your answer]', keywords: ['high', 'medium', 'low', 'critical', 'serious'], minMatch: 1, failMsg: "ลองพิมพ์ระดับ high / medium / low" }
            ]},

            { id: 8, type: 'speaking', title: 'S8: Presentation', variations: [
                { desc: 'พูดตาม: "Our application helps users manage their daily tasks"', exactPhrase: 'our application helps users manage their daily tasks', failMsg: "พยายามพูดให้ชัดเจน" },
                { desc: 'พูดตาม: "This feature improves the user experience significantly"', exactPhrase: 'this feature improves the user experience significantly', failMsg: "พยายามพูดให้ชัดเจน" },
                { desc: 'พูดตาม: "We designed this system for mobile and web platforms"', exactPhrase: 'we designed this system for mobile and web platforms', failMsg: "พยายามพูดให้ชัดเจน" },
                { desc: 'พูดตาม: "Our team focused on performance security and scalability"', exactPhrase: 'our team focused on performance security and scalability', failMsg: "พยายามพูดให้ชัดเจน" },
                { desc: 'พูดตาม: "The final prototype was tested by university students"', exactPhrase: 'the final prototype was tested by university students', failMsg: "พยายามพูดให้ชัดเจน" }
            ]},

            { id: 9, type: 'reading', title: 'S9: Client Meeting', variations: [
                { desc: 'ตอบลูกค้าเรื่องเวลา', question: 'Client: When can you deliver the first version?', choices: ['A: We can deliver it next Friday.', 'B: Friday is a fish.', 'C: Delivery is blue.'], answer: 'A' },
                { desc: 'ตอบลูกค้าเรื่องฟีเจอร์', question: 'Client: Can you add login with Google?', choices: ['A: Yes, we can add that feature in phase two.', 'B: Google is a fruit.', 'C: Login is sleeping.'], answer: 'A' },
                { desc: 'ตอบลูกค้าเรื่องงบประมาณ', question: 'Client: Is this within our budget?', choices: ['A: We need to review the scope and cost first.', 'B: Budget is rain.', 'C: The answer is keyboard.'], answer: 'A' },
                { desc: 'ตอบลูกค้าเรื่องแก้ไขงาน', question: 'Client: Can we revise the dashboard design?', choices: ['A: Yes, we can revise it after your feedback.', 'B: Dashboard is a mountain.', 'C: Revise means orange.'], answer: 'A' },
                { desc: 'ตอบลูกค้าเรื่องประชุมต่อ', question: 'Client: Shall we schedule the next meeting?', choices: ['A: Yes, next Tuesday afternoon works for us.', 'B: Meeting is coffee.', 'C: Tuesday is a laptop.'], answer: 'A' }
            ]},

            { id: 10, type: 'listening', title: 'S10: Global Team Final', variations: [
                { desc: 'ฟังคำสั่งทีมข้ามชาติ', audioText: 'Please deploy the latest version to the staging server before noon.', choices: ['A: Update the design color.', 'B: Deploy the latest version to staging before noon.', 'C: Buy a new laptop.'], answer: 'B' },
                { desc: 'ฟังคำสั่งเรื่องประชุม', audioText: 'Let us move the meeting to three p m because the client is busy.', choices: ['A: The meeting is cancelled forever.', 'B: Move the meeting to three p m.', 'C: The client likes pizza.'], answer: 'B' },
                { desc: 'ฟังคำสั่งเรื่องเอกสาร', audioText: 'Please share the project documentation with the Singapore team.', choices: ['A: Share the project documentation with the Singapore team.', 'B: Delete the project.', 'C: Travel to Singapore now.'], answer: 'A' },
                { desc: 'ฟังคำสั่งเรื่องทดสอบ', audioText: 'We need more testing on the mobile version before release.', choices: ['A: Release it now without testing.', 'B: We need more testing on the mobile version.', 'C: Mobile phones are expensive.'], answer: 'B' },
                { desc: 'ฟังคำสั่งเรื่อง API', audioText: 'The backend team will update the api tonight after the maintenance window.', choices: ['A: The backend team will update the api tonight.', 'B: The api is a window.', 'C: There is no backend team.'], answer: 'A' }
            ]},

            { id: 11, type: 'writing', title: 'S11: Data & AI', variations: [
                { desc: 'พิมพ์คำเกี่ยวกับ data science', prompt: 'SYSTEM: Name one important concept in data science.\nYOU: [Type your answer]', keywords: ['data', 'model', 'dataset', 'training', 'testing', 'feature', 'label'], minMatch: 1, failMsg: "ลองพิมพ์คำอย่าง model / dataset / feature" },
                { desc: 'พิมพ์คำเกี่ยวกับ machine learning', prompt: 'SYSTEM: Name one machine learning term.\nYOU: [Type your answer]', keywords: ['algorithm', 'accuracy', 'loss', 'classification', 'regression', 'prediction'], minMatch: 1, failMsg: "ลองพิมพ์คำอย่าง algorithm / accuracy" },
                { desc: 'พิมพ์คำเกี่ยวกับ ai ethics', prompt: 'SYSTEM: Name one AI ethics concern.\nYOU: [Type your answer]', keywords: ['bias', 'privacy', 'fairness', 'security', 'ethics'], minMatch: 1, failMsg: "ลองพิมพ์คำอย่าง bias / privacy / fairness" },
                { desc: 'พิมพ์คำเกี่ยวกับ deployment', prompt: 'SYSTEM: What is needed before AI deployment?\nYOU: [Type your answer]', keywords: ['testing', 'validation', 'monitoring', 'deployment', 'model'], minMatch: 1, failMsg: "ลองพิมพ์คำอย่าง testing / validation" },
                { desc: 'พิมพ์คำเกี่ยวกับ prompt engineering', prompt: 'SYSTEM: Name one skill used in prompt engineering.\nYOU: [Type your answer]', keywords: ['prompt', 'context', 'instruction', 'clarity', 'examples'], minMatch: 1, failMsg: "ลองพิมพ์คำอย่าง context / instruction / examples" }
            ]},

            { id: 12, type: 'speaking', title: 'S12: Problem Solving', variations: [
                { desc: 'พูดตาม: "First we identify the root cause of the problem"', exactPhrase: 'first we identify the root cause of the problem', failMsg: "พยายามพูดให้ชัดเจน" },
                { desc: 'พูดตาม: "Then we propose a practical solution for the client"', exactPhrase: 'then we propose a practical solution for the client', failMsg: "พยายามพูดให้ชัดเจน" },
                { desc: 'พูดตาม: "We also compare several options before making a decision"', exactPhrase: 'we also compare several options before making a decision', failMsg: "พยายามพูดให้ชัดเจน" },
                { desc: 'พูดตาม: "Finally we evaluate the results and improve the system"', exactPhrase: 'finally we evaluate the results and improve the system', failMsg: "พยายามพูดให้ชัดเจน" },
                { desc: 'พูดตาม: "Good engineers solve problems with logic and teamwork"', exactPhrase: 'good engineers solve problems with logic and teamwork', failMsg: "พยายามพูดให้ชัดเจน" }
            ]},

            { id: 13, type: 'reading', title: 'S13: Career Path', variations: [
                { desc: 'เลือกคำตอบเรื่องตำแหน่งงาน', question: 'HR: What role are you applying for?', choices: ['A: I am applying for a software developer position.', 'B: I am applying for lunch.', 'C: I am a chair.'], answer: 'A' },
                { desc: 'เลือกคำตอบเรื่องทักษะ', question: 'HR: What technical skills do you have?', choices: ['A: I have experience with javascript and python.', 'B: I have experience with sleeping.', 'C: I am a keyboard.'], answer: 'A' },
                { desc: 'เลือกคำตอบเรื่องฝึกงาน', question: 'HR: Did you complete any internships?', choices: ['A: Yes, I interned at a startup last summer.', 'B: Summer is cold.', 'C: Internship is a sandwich.'], answer: 'A' },
                { desc: 'เลือกคำตอบเรื่อง teamwork', question: 'HR: Can you work in a team?', choices: ['A: Yes, I enjoy collaboration and communication.', 'B: Team is a color.', 'C: I only talk to clouds.'], answer: 'A' },
                { desc: 'เลือกคำตอบเรื่องการเรียนรู้', question: 'HR: How do you improve your skills?', choices: ['A: I practice coding and learn from projects.', 'B: I improve by sleeping.', 'C: I improve by silence only.'], answer: 'A' }
            ]},

            { id: 14, type: 'listening', title: 'S14: Remote Work', variations: [
                { desc: 'ฟังคำสั่ง remote team', audioText: 'Please turn on your camera and share your screen during the demo.', choices: ['A: Turn on the camera and share the screen during the demo.', 'B: Buy a new camera today.', 'C: Cancel the demo.'], answer: 'A' },
                { desc: 'ฟังคำสั่งเรื่อง online meeting', audioText: 'Join the online meeting five minutes early to test your microphone.', choices: ['A: Join five minutes early to test the microphone.', 'B: Sleep five minutes more.', 'C: Turn off the internet.'], answer: 'A' },
                { desc: 'ฟังคำสั่งเรื่อง task update', audioText: 'Please update the task board before the daily stand up meeting.', choices: ['A: Update the task board before the stand up meeting.', 'B: Delete the task board.', 'C: Never attend the meeting.'], answer: 'A' },
                { desc: 'ฟังคำสั่งเรื่อง documentation', audioText: 'Write a short summary after the meeting and send it to the team.', choices: ['A: Write a short summary and send it to the team.', 'B: Throw away the summary.', 'C: Close the laptop forever.'], answer: 'A' },
                { desc: 'ฟังคำสั่งเรื่อง timezone', audioText: 'We need to consider different time zones when planning our schedule.', choices: ['A: Consider different time zones when planning.', 'B: Ignore everyone.', 'C: Time zone is a shoe.'], answer: 'A' }
            ]},

            { id: 15, type: 'writing', title: 'S15: Graduation Final', variations: [
                { desc: 'พิมพ์เป้าหมายหลังเรียนจบ', prompt: 'SYSTEM: What do you want to do after graduation?\nYOU: [Type your answer]', keywords: ['work', 'engineer', 'developer', 'ai', 'software', 'company', 'startup', 'master'], minMatch: 1, failMsg: "ลองพิมพ์เป้าหมาย เช่น work as a developer" },
                { desc: 'พิมพ์ทักษะที่ภาคภูมิใจ', prompt: 'SYSTEM: What skill are you most proud of?\nYOU: [Type your answer]', keywords: ['coding', 'communication', 'teamwork', 'problem solving', 'design', 'analysis'], minMatch: 1, failMsg: "ลองพิมพ์ skill ที่คุณภูมิใจ" },
                { desc: 'พิมพ์สิ่งที่อยากพัฒนาเพิ่ม', prompt: 'SYSTEM: What do you still want to improve?\nYOU: [Type your answer]', keywords: ['english', 'coding', 'leadership', 'ai', 'presentation', 'backend', 'frontend'], minMatch: 1, failMsg: "ลองพิมพ์สิ่งที่อยากพัฒนา เช่น english or backend" },
                { desc: 'พิมพ์ dream project', prompt: 'SYSTEM: Describe your dream project.\nYOU: [Type your answer]', keywords: ['application', 'platform', 'ai', 'web', 'mobile', 'system', 'health', 'education'], minMatch: 1, failMsg: "ลองพิมพ์ project ที่คุณอยากสร้าง" },
                { desc: 'พิมพ์คำขอบคุณ', prompt: 'SYSTEM: Write one short thank you message.\nYOU: [Type your answer]', keywords: ['thank', 'thanks', 'grateful', 'appreciate'], minMatch: 1, failMsg: "ลองพิมพ์ thank you message สั้น ๆ" }
            ]}
        ];
