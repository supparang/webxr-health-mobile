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
                { desc: 'พูดตาม: "I am going to test the new software today"', exactPhrase: 'i am going to test the new software today', failMsg: "พยายามพูดให้ชัดเจน" },
                { desc: 'พูดตาม: "I am writing the documentation for the new API"', exactPhrase: 'i am writing the documentation for the new API', failMsg: "พยายามพูดให้ชัดเจน" },
                { desc: 'พูดตาม: "I need some help with the database server deployment"', exactPhrase: 'i need some help with the database server deployment', failMsg: "พยายามพูดให้ชัดเจน" }
            ]},
            { id: 5, type: 'listening', title: 'S5: Pair Code', variations: [
                { desc: 'ฟังปัญหาจากเพื่อน', audioText: 'The code is not working. We have an error on line 10.', choices: ['A: Let us check line 10.', 'B: Turn off the computer.', 'C: I want to eat.'], answer: 'A' },
                { desc: 'ฟังปัญหาการเชื่อมต่อ', audioText: 'I cannot connect to the main database server.', choices: ['A: What time is it?', 'B: Check your internet connection.', 'C: I like the database.'], answer: 'B' },
                { desc: 'ฟังปัญหาหน้าจอ', audioText: 'My computer screen is completely black right now.', choices: ['A: Black is a dark color.', 'B: Did you buy it yesterday?', 'C: Did you turn the power on?'], answer: 'C' },
                { desc: 'ฟังปัญหาแอปช้า', audioText: 'The application is running very slowly today.', choices: ['A: Let me check the memory usage.', 'B: I am running fast.', 'C: The app is blue.'], answer: 'A' },
                { desc: 'ฟังปัญหาลืมรหัส', audioText: 'I forgot my password to login to the system.', choices: ['A: I can reset it for you.', 'B: Buy a new computer.', 'C: Password is password.'], answer: 'A' }
            ]},
            { id: 6, type: 'reading', title: 'S6: Bug Ticket', variations: [
                { desc: 'อ่านตั๋วปุ่มหาย', question: 'TICKET: The login button is missing on the homepage.', choices: ['A: I will add the button.', 'B: The homepage is blue.', 'C: User is missing.'], answer: 'A' },
                { desc: 'อ่านตั๋วเว็บช้า', question: 'TICKET: The website is loading very slowly today.', choices: ['A: I run very fast.', 'B: I will check the server.', 'C: Today is Monday.'], answer: 'B' },
                { desc: 'อ่านตั๋วอัปโหลดพัง', question: 'TICKET: Users cannot upload their profile pictures.', choices: ['A: I like taking pictures.', 'B: Pictures are beautiful.', 'C: I will fix the upload system.'], answer: 'C' },
                { desc: 'อ่านตั๋วแอปเด้ง', question: 'TICKET: The app crashes when I click the save button.', choices: ['A: I will debug the save function.', 'B: I like saving money.', 'C: The app is okay.'], answer: 'A' },
                { desc: 'อ่านตั๋วอ่านยาก', question: 'TICKET: The text color is too hard to read.', choices: ['A: Reading is fun.', 'B: I will change the text color.', 'C: I like hard things.'], answer: 'B' }
            ]},
            { id: 7, type: 'writing', title: 'S7: Explain Tech', variations: [
                { desc: 'อธิบาย AI สั้นๆ', prompt: 'CLIENT: What is AI?\nYOU: [Type your answer]', keywords: ['smart', 'brain', 'learn', 'think', 'ai', 'intelligent', 'machine', 'data'], minMatch: 1, failMsg: "ลองพิมพ์คำว่า 'smart' หรือ 'learn'" },
                { desc: 'อธิบาย Bug สั้นๆ', prompt: 'CLIENT: What is a computer bug?\nYOU: [Type your answer]', keywords: ['error', 'problem', 'mistake', 'broken', 'wrong', 'issue'], minMatch: 1, failMsg: "ลองพิมพ์คำว่า 'error' หรือ 'problem'" },
                { desc: 'อธิบาย Server สั้นๆ', prompt: 'CLIENT: What does a server do?\nYOU: [Type your answer]', keywords: ['store', 'data', 'save', 'host', 'network', 'computer', 'file'], minMatch: 1, failMsg: "ลองพิมพ์คำว่า 'store data'" },
                { desc: 'อธิบาย Virus สั้นๆ', prompt: 'CLIENT: What is a computer virus?\nYOU: [Type your answer]', keywords: ['malware', 'bad', 'hack', 'steal', 'destroy', 'danger', 'attack'], minMatch: 1, failMsg: "ลองพิมพ์คำว่า 'hack' หรือ 'destroy'" },
                { desc: 'อธิบาย UI สั้นๆ', prompt: 'CLIENT: What does UI mean?\nYOU: [Type your answer]', keywords: ['interface', 'design', 'screen', 'look', 'user', 'graphic'], minMatch: 1, failMsg: "ลองพิมพ์คำว่า 'design' หรือ 'interface'" }
            ]},
            { id: 8, type: 'listening', title: 'S8: Data Ethics', variations: [
                { desc: 'ฟังเรื่องความปลอดภัยรหัส', audioText: 'Are the passwords safe in our database?', choices: ['A: Yes, they are secure.', 'B: No, everyone can see them.', 'C: Passwords are 1234.'], answer: 'A' },
                { desc: 'ฟังเรื่องความเป็นส่วนตัว', audioText: 'Can anyone read the user private messages?', choices: ['A: Yes, I read them every day.', 'B: No, they are strictly private.', 'C: Messages are short.'], answer: 'B' },
                { desc: 'ฟังเรื่องการขายข้อมูล', audioText: 'Do we sell user data to other companies?', choices: ['A: Selling is good.', 'B: Companies are rich.', 'C: No, we never sell user data.'], answer: 'C' },
                { desc: 'ฟังเรื่องการแชร์รหัส', audioText: 'Is it okay to share my password with a friend?', choices: ['A: No, keep your password secret.', 'B: Yes, sharing is caring.', 'C: I have many friends.'], answer: 'A' },
                { desc: 'ฟังเรื่องการป้องกันข้อมูล', audioText: 'How do we protect user information?', choices: ['A: We write it on paper.', 'B: We use data encryption.', 'C: We do not protect it.'], answer: 'B' }
            ]},
            { id: 9, type: 'speaking', title: 'S9: Data Trends', variations: [
                { desc: 'พูดตาม: "The user data is going up very fast today"', exactPhrase: 'the user data is going up very fast today', failMsg: "พยายามพูดให้ชัดเจน" },
                { desc: 'พูดตาม: "The number of errors is going down right now"', exactPhrase: 'the number of errors is going down right now', failMsg: "พยายามพูดให้ชัดเจน" },
                { desc: 'พูดตาม: "We have a lot of new users this month"', exactPhrase: 'we have a lot of new users this month', failMsg: "พยายามพูดให้ชัดเจน" },
                { desc: 'พูดตาม: "Our mobile app downloads are increasing every single day"', exactPhrase: 'our mobile app downloads are increasing every single day', failMsg: "พยายามพูดให้ชัดเจน" },
                { desc: 'พูดตาม: "The server response time is getting faster than before"', exactPhrase: 'the server response time is getting faster than before', failMsg: "พยายามพูดให้ชัดเจน" }
            ]},
            { id: 10, type: 'reading', title: 'S10: App Req', variations: [
                { desc: 'อ่านความต้องการแอปขายของ', question: 'CLIENT: I want to sell products online.', choices: ['A: We will build an E-commerce app.', 'B: We will build a racing game.', 'C: Products are bad.'], answer: 'A' },
                { desc: 'อ่านความต้องการแอปจอง', question: 'CLIENT: I want an app for booking hotel rooms.', choices: ['A: Hotels are expensive.', 'B: We can make a booking app.', 'C: I want to sleep.'], answer: 'B' },
                { desc: 'อ่านความต้องการทำเว็บ', question: 'CLIENT: I want to show my portfolio to people.', choices: ['A: People are nice.', 'B: Portfolio is a book.', 'C: Let us build a website for you.'], answer: 'C' },
                { desc: 'อ่านความต้องการระบบพนักงาน', question: 'CLIENT: I need a system to manage my employees.', choices: ['A: We can build an HR system.', 'B: Employees are people.', 'C: Manage your time.'], answer: 'A' },
                { desc: 'อ่านความต้องการแอปสุขภาพ', question: 'CLIENT: I want to track my daily exercise.', choices: ['A: Exercise is good.', 'B: We will make a fitness app.', 'C: Track your shoes.'], answer: 'B' }
            ]},
            { id: 11, type: 'listening', title: 'S11: Angry User', variations: [
                { desc: 'ฟังเซิร์ฟเวอร์ล่ม', audioText: 'The server is down! I cannot work!', choices: ['A: I am sorry. I will fix it now.', 'B: That is your problem.', 'C: The server is a computer.'], answer: 'A' },
                { desc: 'ฟังแอปใช้ยาก', audioText: 'This software is too difficult to use!', choices: ['A: Software is code.', 'B: I can teach you how to use it.', 'C: You are not smart.'], answer: 'B' },
                { desc: 'ฟังไฟล์หาย', audioText: 'I lost all my saved files yesterday!', choices: ['A: Files are in folders.', 'B: Yesterday was Sunday.', 'C: Let me help you find the backup.'], answer: 'C' },
                { desc: 'ฟังอัปเดตทำพัง', audioText: 'The new update broke my computer!', choices: ['A: Let us uninstall the update.', 'B: I like breaking things.', 'C: Buy a new computer.'], answer: 'A' },
                { desc: 'ฟังเน็ตช้า', audioText: 'Why is the internet so slow today?', choices: ['A: The internet is fast.', 'B: We are checking the router.', 'C: I like slow internet.'], answer: 'B' }
            ]},
            { id: 12, type: 'writing', title: 'S12: Pitching', variations: [
                { desc: 'พิมพ์ดึงดูดนักลงทุน', prompt: 'INVESTOR: Why should I give you money?\nYOU: [Type your answer]', keywords: ['buy', 'app', 'product', 'good', 'invest', 'money', 'help', 'great', 'system'], minMatch: 1, failMsg: "ลองพิมพ์ว่า 'buy our app'" },
                { desc: 'พิมพ์กลุ่มเป้าหมาย', prompt: 'INVESTOR: Who is your target customer?\nYOU: [Type your answer]', keywords: ['user', 'student', 'business', 'people', 'company', 'everyone', 'client'], minMatch: 1, failMsg: "ลองพิมพ์ว่า 'business' หรือ 'student'" },
                { desc: 'พิมพ์จุดเด่นแอป', prompt: 'INVESTOR: What is the main feature of this app?\nYOU: [Type your answer]', keywords: ['fast', 'easy', 'secure', 'smart', 'safe', 'quick', 'simple'], minMatch: 1, failMsg: "ลองพิมพ์ว่า 'fast' หรือ 'easy'" },
                { desc: 'พิมพ์วิธีหาเงิน', prompt: 'INVESTOR: How will you make money from this?\nYOU: [Type your answer]', keywords: ['ads', 'premium', 'sell', 'subscription', 'pay', 'market'], minMatch: 1, failMsg: "ลองพิมพ์ว่า 'sell' หรือ 'ads'" },
                { desc: 'พิมพ์คู่แข่ง', prompt: 'INVESTOR: Who are your competitors?\nYOU: [Type your answer]', keywords: ['google', 'apple', 'facebook', 'no one', 'company', 'others', 'none'], minMatch: 1, failMsg: "ลองพิมพ์ว่า 'no one' หรือชื่อบริษัท" }
            ]},
            { id: 13, type: 'reading', title: 'S13: Interview 1', variations: [
                { desc: 'อ่านคำถามจุดแข็ง', question: 'HR: What is your greatest strength?', choices: ['A: I am good at solving problems.', 'B: I sleep 12 hours a day.', 'C: I hate writing code.'], answer: 'A' },
                { desc: 'อ่านคำถามแรงจูงใจ', question: 'HR: Why do you want to work here?', choices: ['A: I need money to buy games.', 'B: Because I love this company.', 'C: My mom told me to work.'], answer: 'B' },
                { desc: 'อ่านคำถามเป้าหมาย', question: 'HR: Where do you see yourself in five years?', choices: ['A: I will be older.', 'B: I don\'t know.', 'C: I want to be a tech manager.'], answer: 'C' },
                { desc: 'อ่านคำถามลดความเครียด', question: 'HR: How do you handle stress at work?', choices: ['A: I take a short break to relax.', 'B: I shout at people.', 'C: I sleep under the desk.'], answer: 'A' },
                { desc: 'อ่านคำถามจุดอ่อน', question: 'HR: What is your biggest weakness?', choices: ['A: I am perfect.', 'B: I am improving my English skills.', 'C: I hate working.'], answer: 'B' }
            ]},
            { id: 14, type: 'speaking', title: 'S14: Interview 2', variations: [
                { desc: 'พูดตาม: "Writing computer code is very fun and interesting"', exactPhrase: 'writing computer code is very fun and interesting', failMsg: "พยายามพูดให้ชัดเจน" },
                { desc: 'พูดตาม: "I have experience with Python and Java programming languages"', exactPhrase: 'i have experience with python and java programming languages', failMsg: "พยายามพูดให้ชัดเจน" },
                { desc: 'พูดตาม: "I am ready to work hard with your team"', exactPhrase: 'i am ready to work hard with your team', failMsg: "พยายามพูดให้ชัดเจน" },
                { desc: 'พูดตาม: "I love to learn new technologies and software frameworks"', exactPhrase: 'i love to learn new technologies and software frameworks', failMsg: "พยายามพูดให้ชัดเจน" },
                { desc: 'พูดตาม: "My biggest strength is solving complex computer logic problems"', exactPhrase: 'my biggest strength is solving complex computer logic problems', failMsg: "พยายามพูดให้ชัดเจน" }
            ]},
            { id: 15, type: 'listening', title: 'S15: Global Team', variations: [
                { desc: 'ฟังเรื่อง Code Review', audioText: 'Hello team. Please review my code on GitHub.', choices: ['A: I will review it today.', 'B: GitHub is a website.', 'C: Who are you?'], answer: 'A' },
                { desc: 'ฟังเวลานัดประชุม', audioText: 'What time is our meeting tomorrow morning?', choices: ['A: Tomorrow is Tuesday.', 'B: It is at ten o\'clock.', 'C: I meet my friends.'], answer: 'B' },
                { desc: 'ฟังขอส่ง Report', audioText: 'Can you send me the report by email?', choices: ['A: Email is fast.', 'B: Send me a letter.', 'C: Yes, I will send it soon.'], answer: 'C' },
                { desc: 'ฟังเดดไลน์งาน', audioText: 'We need to finish this project by next Friday.', choices: ['A: We will work hard to finish it.', 'B: Friday is a good day.', 'C: What is a project?'], answer: 'A' },
                { desc: 'ฟังคำชมเชยทีม', audioText: 'Great job on the presentation today, everyone!', choices: ['A: I am hungry.', 'B: Thank you very much.', 'C: The presentation was bad.'], answer: 'B' }
            ]}
];
