/* === EAP Hero: Save the Society v1e Balanced Items ===
   Standalone PC/Mobile web prototype.
   Upload index.html, eap-hero.css, eap-hero.js to GitHub Pages folder.
*/
(function(){
  'use strict';

  const STORAGE_KEY = 'EAP_HERO_SAVE_SOCIETY_V1';
  const app = document.getElementById('app');

  const SESSIONS = [
    {
      id:1, emoji:'🫧', title:'Academic Hero Awakening', zone:'Orientation Gate',
      skill:'Academic Mindset', boss:'Confusion Slime',
      problem:'เรียนแบบไม่มีเป้าหมาย ทำให้พัฒนาตนเองได้ช้า',
      taunt:'Everything is unclear. Why do you even learn academic English?',
      unlock:'Campus Map + Academic Hero ID',
      lab:[
        'EAP คือภาษาอังกฤษที่ใช้เพื่อการเรียนในมหาวิทยาลัย เช่น อ่านบทความ เขียนรายงาน สรุปข้อมูล นำเสนอ และอ้างอิง',
        'เป้าหมายของ Session นี้คือให้ผู้เล่นรู้ว่า “ฉันจะใช้ Academic English เพื่ออะไร”',
        'คำสำคัญ: academic goal, improve, skill, presentation, reading, writing'
      ],
      questions:[
        mcq('S01_Q1','Which sentence is the best academic goal?','',[
          'I want to improve my English someday.',
          'I want to improve my academic reading and presentation skills this semester.',
          'I want to get a high score without changing my study strategy.',
          'I do not like homework.'
        ],1,'This goal is clear and academic.'),
        mcq('S01_Q2','Which activity BEST shows EAP reading skill?','',[
          'Reading a research article to identify claims and evidence',
          'Reading a research article only to translate every word',
          'Reading comments about the topic on social media',
          'Reading only the title and guessing the conclusion'
        ],0,'EAP reading focuses on claims, evidence, and meaning, not word-by-word translation only.'),
        mcq('S01_Q3','Choose the most academic sentence.','',[
          'I will talk about my topic.',
          'Today, I would like to present my academic goal.',
          'My topic is useful for many students.',
          'I have some ideas about my study plan.'
        ],1,'This sentence uses a polite academic presentation style.'),
        mcq('S01_Q4','Why is EAP useful for university students?','',[
          'It helps students only memorize grammar rules.',
          'It supports reading, writing, and presenting in academic contexts.',
          'It supports casual chatting more than academic tasks.',
          'It helps students guess answers without reading sources.'
        ],1,'EAP supports academic communication.'),
        mcq('S01_Q5','Which phrase can start an academic self-profile?','',[
          'My academic goal is...',
          'I will try to study more.',
          'English is important for my future.',
          'My English should become better.'
        ],0,'This phrase clearly introduces an academic goal.')
      ],
      reflection:'How can academic English help you as a university student?'
    },
    {
      id:2, emoji:'👺', title:'Vocabulary Lab', zone:'Word Lab',
      skill:'Academic Vocabulary', boss:'Lazy Word Goblin',
      problem:'คลังคำศัพท์อ่อน ทำให้อ่าน คิด และสื่อสารเชิงวิชาการไม่ได้',
      taunt:'You cannot read without words. I stole them all!',
      unlock:'Word Hint + Vocabulary Starter Badge',
      lab:[
        'Academic vocabulary คือคำที่พบบ่อยในบทความ รายงาน และการนำเสนอเชิงวิชาการ',
        'ตัวอย่างคำ: analyze, evidence, method, result, significant, conclusion, however, therefore',
        'เวลาเจอคำศัพท์ใหม่ ให้ดูความหมาย ตัวอย่างประโยค และ word family'
      ],
      questions:[
        mcq('S02_Q1','The researcher will ______ the data carefully.','',[
          'review','analyze','summarize','collect'
        ],1,'Analyze means to examine or study carefully.'),
        mcq('S02_Q2','Which word means “หลักฐาน”?','',[
          'result','evidence','source','claim'
        ],1,'Evidence means information that supports a claim.'),
        mcq('S02_Q3','Which connector shows contrast?','',[
          'therefore','because','however','in addition'
        ],2,'However shows contrast.'),
        mcq('S02_Q4','The final part of an academic text is often called the ______.','',[
          'discussion','introduction','conclusion','method'
        ],0,'Conclusion is the final part that summarizes key points.'),
        mcq('S02_Q5','Which word is closest to “important” in academic writing?','',[
          'relevant','significant','frequent','general'
        ],1,'Significant means important or meaningful.'),
        mcq('S02_Q6','The ______ explains how the study was conducted.','',[
          'method','sample','result','limitation'
        ],0,'Method explains the process or procedure.'),
        mcq('S02_Q7','Choose the best academic connector: “The data were incomplete; ______, the result should be interpreted carefully.”','',[
          'therefore','however','for example','in contrast'
        ],0,'Therefore shows a result or consequence.'),
        mcq('S02_Q8','Which pair is correct?','',[
          'evidence = หลักฐาน',
          'method = วิธีการศึกษา',
          'result = ผลลัพธ์',
          'conclusion = บทนำ'
        ],0,'Evidence means หลักฐาน.')
      ],
      reflection:'Which academic word from today is most useful for you? Why?'
    },
    {
      id:3, emoji:'🕷️', title:'Main Idea Hunter', zone:'Library Gate',
      skill:'Main Idea Reading', boss:'Detail Trap Spider',
      problem:'อ่านแล้วหลงรายละเอียด ทำให้จับประเด็นสำคัญไม่ได้',
      taunt:'Tiny details will trap you forever!',
      unlock:'Focus Lens + Smart Reader Badge',
      lab:[
        'Main idea คือใจความสำคัญของข้อความ ไม่ใช่รายละเอียดเล็ก ๆ',
        'ตัวเลือกหลอกมักเป็น too broad, too narrow, หรือ irrelevant',
        'ให้ถามตัวเองว่า “ผู้เขียนต้องการบอกอะไรเป็นหลัก?”'
      ],
      questions:[
        mcq('S03_Q1','What is the main idea?','Online learning allows students to access lessons anytime and anywhere. It also provides videos, quizzes, and discussion tools. These features can help students learn independently.',[
          'Students watch videos online.',
          'Online learning supports independent learning.',
          'Quizzes are difficult.',
          'Students use mobile phones.'
        ],1,'This option covers the whole paragraph, not just one detail.'),
        mcq('S03_Q2','What is the main idea?','Academic writing requires clear organization. A paragraph should include a topic sentence, supporting details, and a conclusion. Good organization helps readers understand the writer’s point.',[
          'A paragraph has a topic sentence.',
          'Academic writing needs clear organization.',
          'Readers like short texts.',
          'Conclusions are always long.'
        ],1,'The paragraph focuses on organization in academic writing.'),
        mcq('S03_Q3','Which option is only a detail?','Many students use digital libraries to find academic articles. Digital libraries provide journals, books, and reports. They help students access reliable information for assignments.',[
          'Digital libraries help students access reliable academic information.',
          'Digital libraries provide journals.',
          'Students can use digital resources for assignments.',
          'Reliable information is useful for students.'
        ],1,'Providing journals is a supporting detail, not the main idea.'),
        mcq('S03_Q4','What is the main idea?','Exercise can improve students’ physical and mental health. It can reduce stress, increase energy, and support better sleep. Therefore, regular exercise is useful for university students.',[
          'Students sleep at night.',
          'Exercise benefits university students’ health.',
          'Stress is a problem.',
          'Energy is important.'
        ],1,'This answer summarizes the whole paragraph.'),
        mcq('S03_Q5','Which answer is too broad?','Mobile applications can support language learning by providing vocabulary games, listening practice, and instant feedback. These features help students practice outside class.',[
          'Technology changes the world.',
          'Mobile applications can support language learning.',
          'Vocabulary games are useful.',
          'Students practice outside class.'
        ],0,'“Technology changes the world” is too broad for this paragraph.'),
        mcq('S03_Q6','What is the main idea?','Group work can help students develop communication skills. Students learn to share ideas, listen to others, and solve problems together. These experiences are valuable in academic settings.',[
          'Students talk in class.',
          'Group work supports communication skills in academic settings.',
          'Some students solve problems.',
          'Listening is one activity.'
        ],1,'This option best captures the full meaning.')
      ],
      reflection:'What is one strategy you can use to find the main idea?'
    },
    {
      id:4, emoji:'📢', title:'Keyword Scanner', zone:'Library Gate',
      skill:'Keyword & Signal Words', boss:'Noise Monster',
      problem:'ข้อมูลเยอะ แต่แยกสาระสำคัญไม่ได้',
      taunt:'Important words? I will bury them in noise!',
      unlock:'Keyword Scanner + Fast Scanner Badge',
      lab:[
        'Keywords คือคำสำคัญที่ช่วยบอกประเด็นหลักของข้อความ',
        'Signal words ช่วยบอกความสัมพันธ์ เช่น however = contrast, therefore = result, because = cause',
        'การจับ keyword ทำให้อ่านเร็วขึ้นและสรุปได้ดีขึ้น'
      ],
      questions:[
        mcq('S04_Q1','Which signal word shows contrast?','Many students use AI tools. However, they should check the accuracy of AI-generated information.',[
          'students','however','tools','information'
        ],1,'However signals contrast.'),
        mcq('S04_Q2','Which word is the key topic?','Digital literacy helps students evaluate online information and use technology responsibly.',[
          'Digital literacy','helps','students','online'
        ],0,'Digital literacy is the central topic.'),
        mcq('S04_Q3','Which signal word shows result?','The data were incomplete; therefore, the conclusion should be limited.',[
          'data','therefore','incomplete','limited'
        ],1,'Therefore signals result.'),
        mcq('S04_Q4','Which word signals an example?','Academic skills, such as summarizing and paraphrasing, are important for university students.',[
          'important','such as','skills','students'
        ],1,'Such as introduces examples.'),
        mcq('S04_Q5','Which signal word shows cause?','Students may misunderstand the article because they focus only on small details.',[
          'because','may','article','details'
        ],0,'Because signals cause.'),
        mcq('S04_Q6','Choose the most important keyword.','Cyberbullying can negatively affect students’ mental health and academic performance.',[
          'can','negatively','Cyberbullying','and'
        ],2,'Cyberbullying is the main topic.')
      ],
      reflection:'Why are signal words useful in academic reading?'
    },
    {
      id:5, emoji:'👻', title:'Critical Reading', zone:'Library Gate',
      skill:'Critical Reading', boss:'Fake News Phantom',
      problem:'ข่าวปลอมและข้อมูลไม่น่าเชื่อถือทำให้สังคมตัดสินใจผิด',
      taunt:'No one checks evidence anymore!',
      unlock:'Evidence Lens + Critical Thinker Badge',
      lab:[
        'Critical reading คือการอ่านอย่างมีวิจารณญาณ ไม่เชื่อทันที',
        'Fact = ตรวจสอบได้, Opinion = ความคิดเห็น, Claim = ข้อกล่าวอ้างที่ต้องการหลักฐาน, Evidence = หลักฐานสนับสนุน',
        'ถามเสมอว่า “มีหลักฐานไหม?” และ “แหล่งข้อมูลน่าเชื่อถือหรือไม่?”'
      ],
      questions:[
        mcq('S05_Q1','Classify this statement.','Many students believe that AI always improves learning outcomes.',[
          'Fact','Opinion','Claim','Evidence'
        ],2,'This is a claim because it needs evidence.'),
        mcq('S05_Q2','Classify this statement.','According to a survey of 300 students, 68% used online dictionaries for academic writing.',[
          'Fact','Opinion','Claim','Evidence'
        ],3,'Survey data can be used as evidence.'),
        mcq('S05_Q3','Classify this statement.','I think online learning is better than classroom learning.',[
          'Fact','Opinion','Claim','Evidence'
        ],1,'“I think” shows personal opinion.'),
        mcq('S05_Q4','Which source is most reliable for an academic assignment?','',[
          'An anonymous social media post',
          'A peer-reviewed journal article',
          'A random comment',
          'A meme page'
        ],1,'A peer-reviewed article is more reliable for academic work.'),
        mcq('S05_Q5','Which question helps check evidence?','',[
          'Is it popular?',
          'Is there data or a credible source?',
          'Is it funny?',
          'Is it short?'
        ],1,'Evidence should come from data or credible sources.'),
        mcq('S05_Q6','Classify this statement.','The official university website states that registration closes on June 30.',[
          'Fact','Opinion','Claim','Emotion'
        ],0,'This can be checked through an official source.')
      ],
      reflection:'Why is evidence important for society?'
    },
    {
      id:6, emoji:'🧟', title:'Summary Builder', zone:'Writing Studio',
      skill:'Summarizing', boss:'Copy-Paste Zombie',
      problem:'คัดลอกงาน ไม่คิดเอง ไม่สร้างความรู้ใหม่',
      taunt:'Copy it. Paste it. Thinking is too hard!',
      unlock:'Summary Blade + Original Thinker Badge',
      lab:[
        'Summary ที่ดีต้องสั้นกว่าเนื้อหาเดิม เก็บใจความสำคัญ และใช้คำของตนเอง',
        'ห้าม copy ประโยคยาว ๆ จากต้นฉบับโดยไม่จำเป็น',
        'Summary ไม่ควรใส่ความคิดเห็นส่วนตัว'
      ],
      questions:[
        mcq('S06_Q1','Choose the best summary.','Original: Online learning platforms provide videos, quizzes, and discussion tools that help students study independently outside the classroom.',[
          'Online learning platforms provide videos, quizzes, and discussion tools that help students study independently outside the classroom.',
          'Online platforms can support independent learning through several learning tools.',
          'Online tools include videos and quizzes.',
          'Online platforms are available outside class, but only for entertainment.'
        ],1,'This summary is shorter and keeps the main idea.'),
        mcq('S06_Q2','Which summary problem is shown here?','Original: AI can support writing when students use it responsibly. Summary: AI is always perfect for writing.',[
          'Good summary',
          'Changed meaning',
          'Too much detail',
          'Personal opinion'
        ],1,'The summary changes the original meaning.'),
        mcq('S06_Q3','A good summary should ______.','',[
          'keep every example from the original',
          'add new personal opinions',
          'keep the main idea in fewer words',
          'use the same sentence order as the original'
        ],2,'A summary keeps the main idea in fewer words.'),
        mcq('S06_Q4','Which sentence should usually be removed from a summary?','',[
          'The main result of the study',
          'A small example that is not essential',
          'The central argument',
          'The key conclusion'
        ],1,'Minor examples are often removed.'),
        mcq('S06_Q5','Choose the best summary.','Original: Regular exercise may reduce stress, improve sleep, and increase students’ energy during the semester.',[
          'Regular exercise may benefit students’ health during the semester.',
          'Exercise may reduce stress, improve sleep, and increase students’ energy during the semester.',
          'Exercise is one activity that students can do after class.',
          'Exercise improves sleep but has no other benefits.'
        ],0,'This keeps the main idea and is shorter.')
      ],
      reflection:'What makes a summary different from copy-paste?'
    },
    {
      id:7, emoji:'🧌', title:'Academic Tone Battle', zone:'Writing Studio',
      skill:'Academic Tone', boss:'Casual Talk Troll',
      problem:'ใช้ภาษาพูดในงานวิชาการ ทำให้การสื่อสารไม่น่าเชื่อถือ',
      taunt:'Use “super cool stuff” in your report!',
      unlock:'Tone Converter + Academic Voice Badge',
      lab:[
        'Academic tone ควรสุภาพ ชัดเจน เป็นกลาง และไม่ใช้ภาษาพูดเกินไป',
        'หลีกเลี่ยงคำเช่น super, stuff, very very, gonna, wanna',
        'เลือกคำที่เป็นทางการและมีความแม่นยำมากขึ้น'
      ],
      questions:[
        mcq('S07_Q1','Choose the academic version.','Informal: AI is super useful for students.',[
          'AI is helpful for students in many ways.',
          'Artificial intelligence can support students’ learning processes.',
          'AI always improves every student’s learning.',
          'Many students think AI is useful.'
        ],1,'This sentence is formal and balanced.'),
        mcq('S07_Q2','Choose the academic version.','Informal: This thing is bad for students.',[
          'This issue may have negative effects on students.',
          'This issue is bad for many students.',
          'Students may not like this issue.',
          'Fake news causes many problems for students.'
        ],0,'This sentence uses academic and precise language.'),
        mcq('S07_Q3','Which word is more academic?','',[
          'young people','children','learners','students'
        ],1,'Children is more formal than kids.'),
        mcq('S07_Q4','Choose the academic version.','Informal: A lot of students use phones in class.',[
          'Many students use mobile phones in class.',
          'A large number of students use phones in class.',
          'Students use phones for several activities.',
          'Mobile phones are commonly used in learning environments.'
        ],0,'Many is more academic than a lot of.'),
        mcq('S07_Q5','Choose the academic version.','Informal: The result was really bad.',[
          'The result was not good for students.',
          'The result indicated a negative outcome.',
          'The result showed many problems.',
          'The result may be considered unsuccessful.'
        ],1,'This version is formal and precise.'),
        mcq('S07_Q6','Which sentence has the best academic tone?','',[
          'This app is useful for students.',
          'This application may support independent learning.',
          'This application helps students practice more often.',
          'This application is popular among students.'
        ],1,'This sentence is clear, formal, and cautious.')
      ],
      reflection:'What is one informal word you should avoid in academic writing?'
    },
    {
      id:8, emoji:'🐍', title:'Midterm Boss Challenge', zone:'Exam Gate',
      skill:'Integrated Review', boss:'Exam Hydra',
      problem:'เมื่อเจอหลายทักษะพร้อมกันแล้วสับสน',
      taunt:'One head for every weakness!',
      unlock:'Boss Rush I + Midterm Survivor Badge',
      lab:[
        'Session นี้รวม Vocabulary, Main Idea, Summary และ Academic Tone',
        'ให้ทบทวนจุดอ่อนของตนเองก่อนสู้ Hydra',
        'โจทย์จะสลับทักษะเพื่อวัดการใช้ความรู้จริง'
      ],
      questions:[
        mcq('S08_Q1','Which word means “หลักฐาน”?','',[
          'Evidence','Claim','Method','Conclusion'
        ],0,'Evidence means หลักฐาน.'),
        mcq('S08_Q2','Choose the main idea.','Digital tools can help students learn independently through videos, quizzes, and feedback.',[
          'Digital tools provide online videos.',
          'Digital tools support independent learning.',
          'Quizzes are one feature of digital tools.',
          'Feedback can help students improve.'
        ],1,'This captures the paragraph.'),
        mcq('S08_Q3','Choose the academic version.','Informal: This is super good.',[
          'This is useful for students.',
          'This may provide important benefits.',
          'This has many positive points.',
          'This may be helpful in some contexts.'
        ],1,'This is formal and cautious.'),
        mcq('S08_Q4','A summary should ______.','',[
          'be shorter than the original',
          'keep most original sentences',
          'add extra opinions',
          'focus only on examples'
        ],0,'A summary should be shorter.'),
        mcq('S08_Q5','Which connector shows result?','',[
          'however','therefore','although','such as'
        ],1,'Therefore shows result.'),
        mcq('S08_Q6','Classify: “I believe online classes are more convenient.”','',[
          'Fact','Opinion','Evidence','Reference'
        ],1,'I believe shows opinion.')
      ],
      reflection:'Which EAP skill is strongest for you now? Which one needs more practice?'
    },
    {
      id:9, emoji:'🐺', title:'Paragraph Writing', zone:'Writing Studio',
      skill:'Academic Paragraph Writing', boss:'Broken Paragraph Beast',
      problem:'เขียนไม่เป็นระบบ ทำให้ความคิดดี ๆ สื่อสารไม่ชัด',
      taunt:'Your paragraph is broken into pieces!',
      unlock:'Paragraph Builder + Academic Writer Badge',
      lab:[
        'Academic paragraph ที่ดีมักมี Topic Sentence, Supporting Details, Contrast/Evidence และ Concluding Sentence',
        'Topic sentence บอกประเด็นหลักของย่อหน้า',
        'Supporting details และ evidence ทำให้ประเด็นน่าเชื่อถือ'
      ],
      questions:[
        mcq('S09_Q1','Which sentence is the best topic sentence?','Topic: Online learning',[
          'Online learning includes videos and quizzes.',
          'Online learning can support flexible study for university students.',
          'Students can access lessons on different devices.',
          'Teachers may upload learning materials online.'
        ],1,'This states the main point of the paragraph.'),
        mcq('S09_Q2','What should usually come after a topic sentence?','',[
          'An example related to the topic',
          'Supporting detail',
          'A new topic sentence',
          'A concluding sentence'
        ],1,'Supporting details develop the topic sentence.'),
        mcq('S09_Q3','Which is a concluding sentence?','',[
          'For example, students can watch videos.',
          'In conclusion, digital tools can improve learning when used appropriately.',
          'This evidence supports the point.',
          'The survey result provides evidence.'
        ],1,'In conclusion signals the closing idea.'),
        mcq('S09_Q4','Choose the best supporting detail for: “Exercise benefits students.”','',[
          'Many studies suggest that exercise can reduce stress.',
          'Students may exercise in different places.',
          'Exercise can be done individually or in groups.',
          'Exercise is a common activity among students.'
        ],0,'This detail supports the topic.'),
        mcq('S09_Q5','Which paragraph part gives the main point?','',[
          'Topic sentence',
          'Supporting detail',
          'Concluding sentence',
          'Contrast'
        ],0,'The topic sentence states the main point.')
      ],
      reflection:'What are the four parts of an academic paragraph?'
    },
    {
      id:10, emoji:'🐉', title:'Data Description', zone:'Data Tower',
      skill:'Describing Data', boss:'Graph Fog Dragon',
      problem:'อ่านข้อมูลไม่เป็น ทำให้ตีความผิดและตัดสินใจผิด',
      taunt:'The graph is hidden in my fog!',
      unlock:'Graph Decoder + Data Decoder Badge',
      lab:[
        'Data description ใช้คำเช่น increase, decrease, remain stable, significantly, gradually',
        'เริ่มจากดู trend หลักก่อน แล้วค่อยดูตัวเลขสำคัญ',
        'หลีกเลี่ยงการตีความเกินข้อมูลที่มี'
      ],
      questions:[
        mcq('S10_Q1','Choose the best data description.','Data: Student AI tool use increased from 30% in 2023 to 60% in 2025.',[
          'AI tool use changed slightly.',
          'AI tool use increased from 2023 to 2025.',
          'AI tool use increased only in 2023.',
          'AI tool use was higher in 2023 than 2025.'
        ],1,'The data show an increase.'),
        mcq('S10_Q2','Which word means “คงที่”?','',[
          'increase','decrease','remain stable','fluctuate'
        ],2,'Remain stable means stay the same.'),
        mcq('S10_Q3','Data: 80, 70, 60. Which trend is shown?','',[
          'increase','decrease','remain stable','fluctuation'
        ],1,'The numbers go down.'),
        mcq('S10_Q4','Choose the academic sentence.','Data: 45% of students preferred online quizzes.',[
          'Many students may like online quizzes.',
          'The data show that 45% of students preferred online quizzes.',
          'Most students preferred online quizzes.',
          'Online quizzes were more popular than all learning tools.'
        ],1,'This sentence accurately reports the data.'),
        mcq('S10_Q5','Which word shows a large change?','',[
          'significantly','slightly','gradually','steadily'
        ],0,'Significantly can show a meaningful or large change.')
      ],
      reflection:'Why should we describe data carefully?'
    },
    {
      id:11, emoji:'👹', title:'Academic Email', zone:'Ethics Court',
      skill:'Academic Email Writing', boss:'Rude Mail Gremlin',
      problem:'สื่อสารไม่สุภาพ ทำให้ความร่วมมือเสียหาย',
      taunt:'Hey teacher! Give me more time now!',
      unlock:'Email Template + Polite Communicator Badge',
      lab:[
        'Academic email ควรมี Subject, Greeting, Purpose, Reason, Request และ Closing',
        'ใช้ภาษาสุภาพ เช่น Dear Dr. Smith, I am writing to..., Thank you for your consideration.',
        'หลีกเลี่ยงคำสั่งห้วน ๆ หรือภาษาพูดเกินไป'
      ],
      questions:[
        mcq('S11_Q1','Choose the best opening for requesting an extension.','',[
          'Dear teacher, I need more time for homework.',
          'Dear Dr. Smith, I am writing to request an extension for the assignment.',
          'I want to ask about the assignment deadline.',
          'I am writing because the assignment is difficult.'
        ],1,'This opening is polite and clear.'),
        mcq('S11_Q2','Which subject line is best?','',[
          'Assignment question',
          'Request for Assignment Extension',
          'Question about homework',
          'Need your reply'
        ],1,'This subject is clear and formal.'),
        mcq('S11_Q3','Choose the best closing.','',[
          'Thank you.',
          'Thank you for your consideration.',
          'I hope to hear from you soon.',
          'After that, maybe...'
        ],1,'This closing is polite.'),
        mcq('S11_Q4','Which phrase is most polite?','',[
          'Can you meet me tomorrow?',
          'I would like to request an appointment.',
          'I need to talk to you soon.',
          'I would like to discuss my assignment.'
        ],1,'This is a polite request.'),
        mcq('S11_Q5','What should an academic email include?','',[
          'A clear purpose',
          'Author and year',
          'A short reason',
          'A respectful closing'
        ],0,'A clear purpose helps the reader understand the message.')
      ],
      reflection:'What phrase can make an email more polite?'
    },
    {
      id:12, emoji:'👾', title:'Citation & Ethics', zone:'Ethics Court',
      skill:'Citation / Academic Ethics', boss:'Plagiarism Monster',
      problem:'ลอกงาน ไม่อ้างอิง ใช้ AI แบบไม่รับผิดชอบ',
      taunt:'Take ideas without credit. No one will know!',
      unlock:'Citation Shield + Integrity Hero Badge',
      lab:[
        'Plagiarism คือการนำคำหรือความคิดของผู้อื่นมาใช้โดยไม่ให้เครดิต',
        'Paraphrase คือการเขียนใหม่ด้วยคำของตนเอง แต่ยังต้องอ้างอิงแหล่งที่มา',
        'การใช้ AI ควรเปิดเผยและตรวจสอบความถูกต้อง ไม่ copy ส่งทันที'
      ],
      questions:[
        mcq('S12_Q1','Choose the best academic use.','Original idea: AI tools can support students’ writing development when used responsibly.',[
          'AI tools can support students’ writing development when used responsibly.',
          'AI can help students write better.',
          'AI tools may support students’ writing development when used responsibly (Author, Year).',
          'AI tools help students improve writing skills.'
        ],2,'This paraphrases and includes a citation placeholder.'),
        mcq('S12_Q2','Which action is plagiarism?','',[
          'Paraphrasing with citation',
          'Copying a paragraph without citation',
          'Summarizing with reference',
          'Quoting with quotation marks and citation'
        ],1,'Copying without citation is plagiarism.'),
        mcq('S12_Q3','A paraphrase should ______.','',[
          'use your own words and cite the source',
          'change only a few words from the original',
          'keep the same idea without naming the source',
          'use synonyms but keep the exact sentence structure'
        ],0,'A paraphrase still needs citation.'),
        mcq('S12_Q4','Which is ethical AI use?','',[
          'Use AI to generate ideas and submit them without checking',
          'Use AI to support drafting, then review, edit, and declare use if required',
          'Use AI text directly as your final answer',
          'Ask AI for sources but do not verify them'
        ],1,'Responsible AI use includes review and transparency.'),
        mcq('S12_Q5','Which item is needed in academic citation?','',[
          'Source information',
          'Author and year',
          'Website name only',
          'A broad topic with no clear problem'
        ],0,'Citation points to the source.')
      ],
      reflection:'How can students use AI ethically in academic work?'
    },
    {
      id:13, emoji:'🌪️', title:'Academic Listening', zone:'Lecture Hall',
      skill:'Academic Listening', boss:'Lecture Storm',
      problem:'ฟัง lecture ไม่ทัน ทำให้เรียนรู้จากแหล่งความรู้สากลได้น้อย',
      taunt:'My lecture winds will scatter every keyword!',
      unlock:'Replay Audio Token + Active Listener Badge',
      lab:[
        'Academic listening เน้นจับ topic, keywords, numbers และ signal words',
        'จดโน้ตด้วยคำสำคัญ ไม่ต้องจดทุกคำ',
        'เวลาฟัง ให้จับคำเชื่อม เช่น first, however, therefore, in conclusion'
      ],
      questions:[
        mcq('S13_Q1','Listening simulation: What is the main topic?','Transcript: Today, I will discuss how digital literacy helps students evaluate online information and avoid misinformation.',[
          'Digital literacy and online information',
          'Digital tools for entertainment',
          'General technology trends',
          'Student social media habits'
        ],0,'The lecture focuses on digital literacy.'),
        mcq('S13_Q2','Which keyword is important?','Transcript: First, students should check the source of information before sharing it online.',[
          'source','sharing','online','check the source'
        ],3,'Check the source is the key action.'),
        mcq('S13_Q3','Which signal word shows order?','Transcript: First, I will explain the problem. Next, I will discuss possible solutions.',[
          'first','problem','possible','solutions'
        ],0,'First signals order.'),
        mcq('S13_Q4','What should you note while listening?','',[
          'Only the first sentence',
          'Only keywords and main points',
          'Only unfamiliar words',
          'A broad topic with no clear problem'
        ],1,'Good note-taking focuses on keywords and main points.'),
        mcq('S13_Q5','What does “in conclusion” signal?','',[
          'Opening example',
          'Contrast',
          'Ending or summary',
          'Additional detail'
        ],2,'In conclusion signals the final summary.')
      ],
      reflection:'What listening strategy can help you understand a lecture?'
    },
    {
      id:14, emoji:'👻', title:'Academic Presentation', zone:'Conference Arena',
      skill:'Academic Presentation', boss:'Nervous Ghost',
      problem:'มีความรู้แต่สื่อสารไม่ได้ ทำให้แนวคิดดี ๆ ไม่ถูกนำไปใช้',
      taunt:'Your voice will shake. Your ideas will disappear!',
      unlock:'Confidence Boost + Presenter Badge',
      lab:[
        'Academic presentation ควรมี Greeting, Topic, Outline, Main Points, Conclusion และ Q&A',
        'ใช้ signposting phrases เช่น First, Next, In conclusion',
        'ตอบ Q&A อย่างสุภาพ แม้ยังไม่รู้คำตอบทั้งหมด'
      ],
      questions:[
        mcq('S14_Q1','Choose the best opening.','',[
          'Hello, my topic is about digital things.',
          'Today, I would like to present my topic on digital literacy.',
          'I will say something about my assignment.',
          'I will briefly talk about a topic from class.'
        ],1,'This opening is clear and academic.'),
        mcq('S14_Q2','Which phrase introduces the next point?','',[
          'Next, I will discuss...',
          'Another thing is...',
          'After that, maybe...',
          'I also want to say...'
        ],0,'Next signals the next point.'),
        mcq('S14_Q3','Choose the best Q&A response.','Question: Can you explain your evidence?',[
          'I am not sure.',
          'Thank you for your question. The evidence comes from the survey results.',
          'Can you ask that again?',
          'That is difficult to answer.'
        ],1,'This response is polite and informative.'),
        mcq('S14_Q4','Which phrase closes a presentation?','',[
          'In conclusion, this issue requires further attention.',
          'That is all for my topic.',
          'Finally, I have some final ideas.',
          'This is the end.'
        ],0,'In conclusion signals closing.'),
        mcq('S14_Q5','What should a presentation outline do?','',[
          'Tell the audience the structure of the talk',
          'List unrelated details',
          'Use as many slides as possible',
          'Show only the conclusion'
        ],0,'An outline helps the audience follow the talk.')
      ],
      reflection:'Which presentation phrase will you use in your final presentation?'
    },
    {
      id:15, emoji:'👑', title:'Final Integration', zone:'Society Core',
      skill:'Final Problem-Solution Presentation', boss:'Stagnation Emperor',
      problem:'สังคมหยุดพัฒนาเพราะขาดการอ่าน คิด วิเคราะห์ หลักฐาน จริยธรรม และการสื่อสาร',
      taunt:'Without knowledge, evidence, and ethics, society will never move forward!',
      unlock:'Society Saver Ending + Final Trophy',
      lab:[
        'Final Mission รวมทุกทักษะ: vocabulary, reading, summary, academic tone, data, citation, listening, presentation',
        'เลือกปัญหาสังคม 1 เรื่อง และนำเสนอ Problem → Additional detail → Evidence → Solution → Conclusion',
        'เป้าหมายคือใช้ Academic English เพื่อเสนอทางออกอย่างมีเหตุผล'
      ],
      questions:[
        mcq('S15_Q1','Which structure is best for the final presentation?','',[
          'Problem → Additional detail → Evidence → Solution → Conclusion',
          'Topic → Personal opinion → End',
          'Problem → Opinion → Solution without evidence',
          'Problem → Cause → Solution without conclusion'
        ],0,'This structure is clear and academic.'),
        mcq('S15_Q2','Which topic is suitable for the final mission?','',[
          'Fake news and digital literacy',
          'A personal hobby with no social issue',
          'A broad topic with no clear problem',
          'A topic with no evidence'
        ],0,'This is a social issue that can be discussed academically.'),
        mcq('S15_Q3','Which sentence uses evidence?','',[
          'Many people say fake news is bad.',
          'A survey of 200 students found that 62% had seen fake news online.',
          'Fake news is common on social media.',
          'Fake news causes many problems for students.'
        ],1,'This sentence uses data as evidence.'),
        mcq('S15_Q4','Choose the most academic solution sentence.','',[
          'Students should be careful online.',
          'Universities should provide digital literacy training to help students evaluate online information.',
          'People should learn more about this issue.',
          'Schools can tell students not to share wrong information.'
        ],1,'This solution is specific and academic.'),
        mcq('S15_Q5','Which final rank is earned by saving society?','',[
          'Society Saver',
          'Critical Reader',
          'Academic Writer',
          'Digital Citizen'
        ],0,'Society Saver is the final heroic rank.')
      ],
      reflection:'What social problem would you like to solve using academic English?'
    }
  ];


  // Extra plausible question bank v1b: expands every session to reduce repeated questions.
  function addExtraQuestions(){
    const EXTRA = {
  "1": [
    [
      "Choose the clearest academic goal.",
      "",
      [
        "I will improve my ability to summarize academic texts.",
        "I will study more when I have time.",
        "I want English to feel easier.",
        "I will try to understand class better."
      ],
      0,
      "A clear academic goal names the specific skill to improve."
    ],
    [
      "Which task is most related to EAP?",
      "",
      [
        "Writing a short evidence-based paragraph",
        "Watching a video only for entertainment",
        "Posting a casual comment online",
        "Memorizing a song lyric"
      ],
      0,
      "EAP focuses on academic communication tasks."
    ],
    [
      "Which sentence best explains the purpose of EAP?",
      "",
      [
        "It helps students communicate in academic contexts.",
        "It helps students avoid difficult readings.",
        "It is mainly for chatting with international friends.",
        "It is only about grammar tests."
      ],
      0,
      "EAP supports academic reading, writing, speaking, and listening."
    ],
    [
      "Which learner profile is most academic?",
      "",
      [
        "I can read short texts, but I need to improve my summary writing.",
        "I am okay with English because I use social media.",
        "I want easy English activities every week.",
        "I like English when it has no writing task."
      ],
      0,
      "This profile identifies a current ability and a target skill."
    ],
    [
      "Which phrase is suitable for an academic reflection?",
      "",
      [
        "I learned that evidence is important in academic reading.",
        "This was kind of okay.",
        "The game was cool and stuff.",
        "I did it because I had to."
      ],
      0,
      "Academic reflection should be clear and connected to learning."
    ],
    [
      "Which skill would help in writing a university report?",
      "",
      [
        "Paraphrasing information from a source",
        "Sending short informal messages",
        "Choosing only colorful pictures",
        "Reading only headlines"
      ],
      0,
      "Paraphrasing is a key academic writing skill."
    ],
    [
      "Which is the best example of academic responsibility?",
      "",
      [
        "Checking sources before using information",
        "Using any website because it is fast",
        "Copying a paragraph to save time",
        "Guessing the answer from the title"
      ],
      0,
      "Academic responsibility includes checking sources."
    ],
    [
      "Which statement is most suitable for an Academic Hero ID?",
      "",
      [
        "My goal is to improve my reading accuracy and academic vocabulary.",
        "My goal is to finish quickly.",
        "My goal is to avoid difficult questions.",
        "My goal is to get points only."
      ],
      0,
      "This statement is specific and learning-focused."
    ],
    [
      "Which activity best supports academic growth?",
      "",
      [
        "Reviewing mistakes after a reading task",
        "Skipping feedback after finishing",
        "Choosing answers as quickly as possible without reading",
        "Doing only easy questions"
      ],
      0,
      "Reviewing mistakes supports learning improvement."
    ],
    [
      "Which sentence is most formal?",
      "",
      [
        "I would like to improve my ability to present academic information.",
        "I wanna speak better in class.",
        "Speaking is hard for me, you know.",
        "I need to be good at presentation stuff."
      ],
      0,
      "This sentence uses formal academic language."
    ],
    [
      "Which EAP skill is used when listening to a lecture?",
      "",
      [
        "Identifying the speaker’s main points",
        "Remembering every single word",
        "Ignoring signal words",
        "Writing only personal feelings"
      ],
      0,
      "Academic listening focuses on main points and keywords."
    ],
    [
      "Which choice shows a useful learning strategy?",
      "",
      [
        "Set a skill goal, practice, review feedback, and try again.",
        "Answer once and never review it.",
        "Use only translation without understanding the idea.",
        "Avoid tasks that feel difficult."
      ],
      0,
      "A good strategy includes practice and reflection."
    ]
  ],
  "2": [
    [
      "Choose the best word: The article presents strong ______ for its claim.",
      "",
      [
        "evidence",
        "opinion",
        "topic",
        "format"
      ],
      0,
      "Evidence supports a claim."
    ],
    [
      "Choose the best word: The ______ section explains how the data were collected.",
      "",
      [
        "method",
        "result",
        "conclusion",
        "title"
      ],
      0,
      "The method explains procedures."
    ],
    [
      "Choose the best connector: The sample size was small; ______, the findings should be interpreted carefully.",
      "",
      [
        "therefore",
        "for example",
        "in addition",
        "similarly"
      ],
      0,
      "Therefore shows consequence."
    ],
    [
      "Choose the word closest to 'evaluate'.",
      "",
      [
        "assess",
        "copy",
        "decorate",
        "announce"
      ],
      0,
      "Evaluate means assess or judge."
    ],
    [
      "Choose the best academic word: The study aims to ______ the relationship between sleep and stress.",
      "",
      [
        "examine",
        "guess",
        "chat about",
        "decorate"
      ],
      0,
      "Examine is suitable in academic writing."
    ],
    [
      "Which word is commonly used to introduce a result?",
      "",
      [
        "therefore",
        "although",
        "whereas",
        "despite"
      ],
      0,
      "Therefore introduces a result."
    ],
    [
      "Which word is commonly used to introduce contrast?",
      "",
      [
        "however",
        "therefore",
        "for example",
        "as a result"
      ],
      0,
      "However introduces contrast."
    ],
    [
      "Choose the best word: The findings were ______ because they appeared in several studies.",
      "",
      [
        "consistent",
        "casual",
        "unclear",
        "personal"
      ],
      0,
      "Consistent means similar across cases."
    ],
    [
      "Choose the best word: A research ______ is a question or issue that a study investigates.",
      "",
      [
        "problem",
        "decoration",
        "feeling",
        "shortcut"
      ],
      0,
      "A research problem is the issue studied."
    ],
    [
      "Choose the best word: The researcher will ______ previous studies before designing the project.",
      "",
      [
        "review",
        "ignore",
        "guess",
        "replace"
      ],
      0,
      "Reviewing previous studies is academic work."
    ],
    [
      "Choose the best word family pair.",
      "",
      [
        "analyze / analysis",
        "evidence / evidentless",
        "method / methoding",
        "conclude / conclusionless"
      ],
      0,
      "Analyze and analysis are a correct word family pair."
    ],
    [
      "Choose the most academic phrase.",
      "",
      [
        "The results indicate that...",
        "The results are kind of nice...",
        "The results look cool...",
        "The results say stuff..."
      ],
      0,
      "The results indicate that... is academic."
    ]
  ],
  "3": [
    [
      "What is the main idea?",
      "Students who plan their study time often complete assignments more effectively. Planning helps them divide large tasks into smaller steps and avoid last-minute work.",
      [
        "Study planning can improve assignment completion.",
        "Students have many assignments.",
        "Large tasks are sometimes difficult.",
        "Last-minute work happens often."
      ],
      0,
      "The paragraph focuses on study planning and assignment completion."
    ],
    [
      "What is the main idea?",
      "Academic vocabulary helps students understand textbooks and journal articles. Without key terms, students may misunderstand the writer’s argument.",
      [
        "Academic vocabulary supports understanding academic texts.",
        "Textbooks have many pages.",
        "Journal articles are difficult.",
        "Writers use arguments."
      ],
      0,
      "The whole paragraph is about vocabulary supporting understanding."
    ],
    [
      "Which option is too narrow?",
      "Digital literacy allows students to evaluate sources, protect personal information, and communicate responsibly online.",
      [
        "Digital literacy includes several responsible online skills.",
        "Students should protect personal information.",
        "Digital literacy is important for online learning.",
        "Students need responsible online behavior."
      ],
      1,
      "Protecting personal information is only one detail."
    ],
    [
      "Which option is too broad?",
      "Peer feedback can help students improve their writing because classmates may notice unclear ideas and organization problems.",
      [
        "Communication improves society.",
        "Peer feedback can improve student writing.",
        "Classmates can identify unclear ideas.",
        "Writing organization can be improved."
      ],
      0,
      "This is broader than the paragraph."
    ],
    [
      "What is the main idea?",
      "Using evidence makes academic arguments more convincing. Evidence shows readers that the writer’s claim is supported by data or credible sources.",
      [
        "Evidence strengthens academic arguments.",
        "Readers like data.",
        "Writers make claims.",
        "Sources can be credible."
      ],
      0,
      "The paragraph focuses on evidence strengthening arguments."
    ],
    [
      "Which option is irrelevant?",
      "Regular reading practice can improve students’ vocabulary and comprehension. It also helps them become more familiar with academic sentence patterns.",
      [
        "Reading practice supports vocabulary and comprehension.",
        "Reading helps students notice academic sentence patterns.",
        "Students should choose colorful presentation slides.",
        "Regular practice can improve reading skills."
      ],
      2,
      "Presentation slide color is not related to the paragraph."
    ],
    [
      "What is the main idea?",
      "Responsible AI use requires students to check information, edit outputs, and acknowledge assistance when required. These actions help maintain academic integrity.",
      [
        "Responsible AI use supports academic integrity.",
        "Students use AI tools.",
        "Editing outputs takes time.",
        "Some information may be inaccurate."
      ],
      0,
      "The paragraph focuses on responsible AI and integrity."
    ],
    [
      "Which answer is a supporting detail?",
      "Clear signposting helps audiences follow an academic presentation. Phrases such as 'first,' 'next,' and 'in conclusion' show the structure of the talk.",
      [
        "Clear signposting helps audiences follow a presentation.",
        "Phrases such as 'first' and 'next' show structure.",
        "Presentations should be academic.",
        "Audiences listen to speakers."
      ],
      1,
      "This is an example/detail supporting the main idea."
    ],
    [
      "What is the main idea?",
      "Summarizing is useful because it requires students to identify key points and express them in fewer words. This skill also reduces the risk of copying too much from a source.",
      [
        "Summarizing helps students identify key points and avoid copying.",
        "Sources contain many words.",
        "Students write fewer words.",
        "Copying is risky."
      ],
      0,
      "The answer covers the full paragraph."
    ],
    [
      "Which option best states the main idea?",
      "Academic email should be polite, clear, and specific. A good email includes a meaningful subject, a respectful greeting, and a clear request.",
      [
        "Academic email requires polite and clear communication.",
        "A subject line is needed.",
        "Students send emails.",
        "Greetings can be respectful."
      ],
      0,
      "The paragraph focuses on effective academic email."
    ],
    [
      "What is the main idea?",
      "Data description helps readers understand trends in numbers. Instead of listing every value, writers should highlight major increases, decreases, or comparisons.",
      [
        "Data description should highlight major trends.",
        "Numbers can be listed.",
        "Writers use comparisons.",
        "Readers understand data."
      ],
      0,
      "The paragraph is about highlighting data trends."
    ],
    [
      "Which option is only a detail?",
      "Critical reading helps students question claims and check evidence before accepting information. This skill is especially important when reading online sources.",
      [
        "Critical reading supports careful evaluation of information.",
        "This skill is important when reading online sources.",
        "Students should question claims.",
        "Evidence should be checked."
      ],
      1,
      "Online sources are a context/detail, not the whole main idea."
    ]
  ],
  "4": [
    [
      "Which signal word shows contrast?",
      "Although mobile learning is convenient, some students still prefer printed materials.",
      [
        "Although",
        "mobile",
        "convenient",
        "materials"
      ],
      0,
      "Although shows contrast."
    ],
    [
      "Which signal word shows addition?",
      "The app provides vocabulary practice. Moreover, it gives instant feedback.",
      [
        "Moreover",
        "provides",
        "practice",
        "feedback"
      ],
      0,
      "Moreover adds information."
    ],
    [
      "Which signal word shows cause?",
      "Students improved their scores because they practiced every week.",
      [
        "because",
        "improved",
        "scores",
        "every week"
      ],
      0,
      "Because shows cause."
    ],
    [
      "Which signal word shows example?",
      "Students can use academic tools, such as online dictionaries and citation managers.",
      [
        "such as",
        "academic",
        "tools",
        "managers"
      ],
      0,
      "Such as introduces examples."
    ],
    [
      "Choose the key topic.",
      "Academic integrity requires honesty, proper citation, and responsible use of information.",
      [
        "Academic integrity",
        "honesty",
        "proper citation",
        "information"
      ],
      0,
      "Academic integrity is the central topic."
    ],
    [
      "Choose the keyword that shows the main issue.",
      "Cyberbullying can reduce students’ confidence and affect their mental health.",
      [
        "Cyberbullying",
        "confidence",
        "mental health",
        "students"
      ],
      0,
      "Cyberbullying is the issue being discussed."
    ],
    [
      "Which signal word shows result?",
      "The instructions were unclear; as a result, many students submitted the wrong file.",
      [
        "as a result",
        "unclear",
        "submitted",
        "file"
      ],
      0,
      "As a result shows consequence."
    ],
    [
      "Which keyword is most important?",
      "Source credibility is important when students use online information for assignments.",
      [
        "Source credibility",
        "students",
        "online",
        "assignments"
      ],
      0,
      "Source credibility is the main concept."
    ],
    [
      "Which word signals comparison?",
      "Compared with printed books, e-books are easier to search.",
      [
        "Compared with",
        "printed",
        "e-books",
        "search"
      ],
      0,
      "Compared with signals comparison."
    ],
    [
      "Which signal word shows conclusion?",
      "In conclusion, digital literacy should be developed in university courses.",
      [
        "In conclusion",
        "digital",
        "literacy",
        "courses"
      ],
      0,
      "In conclusion signals a final summary."
    ],
    [
      "Which keyword should be highlighted?",
      "Paraphrasing requires writers to restate ideas accurately without changing the meaning.",
      [
        "Paraphrasing",
        "writers",
        "ideas",
        "meaning"
      ],
      0,
      "Paraphrasing is the main skill."
    ],
    [
      "Which signal word shows contrast?",
      "Online tools are useful; however, students must check the accuracy of information.",
      [
        "however",
        "useful",
        "students",
        "accuracy"
      ],
      0,
      "However shows contrast."
    ]
  ],
  "5": [
    [
      "Classify this statement.",
      "The official report states that 72% of respondents used mobile banking in 2025.",
      [
        "Evidence",
        "Opinion",
        "Guess",
        "Emotion"
      ],
      0,
      "A report with data can function as evidence."
    ],
    [
      "Classify this statement.",
      "Online learning is more convenient than traditional learning.",
      [
        "Claim",
        "Citation",
        "Definition",
        "Reference"
      ],
      0,
      "This is a claim unless evidence is provided."
    ],
    [
      "Classify this statement.",
      "In my view, AI feedback is more helpful than teacher feedback.",
      [
        "Opinion",
        "Fact",
        "Evidence",
        "Method"
      ],
      0,
      "In my view signals opinion."
    ],
    [
      "Which is the strongest evidence?",
      "",
      [
        "A survey result from a university research project",
        "A comment from an unknown account",
        "A headline without a source",
        "A personal guess"
      ],
      0,
      "Research data is stronger evidence."
    ],
    [
      "Which question checks source credibility?",
      "",
      [
        "Who published this information?",
        "Is the font attractive?",
        "Is the title short?",
        "Does it have many emojis?"
      ],
      0,
      "The publisher helps determine credibility."
    ],
    [
      "Which statement is a fact?",
      "",
      [
        "The university library opens at 8:30 a.m. according to its official website.",
        "The library is the best place on campus.",
        "All students love the library.",
        "Studying there always improves grades."
      ],
      0,
      "This can be verified from an official source."
    ],
    [
      "Which statement is an opinion?",
      "",
      [
        "I believe citation tools are difficult to use.",
        "The article was published in 2024.",
        "The survey included 150 students.",
        "The website belongs to the university."
      ],
      0,
      "I believe signals opinion."
    ],
    [
      "Which statement needs evidence most clearly?",
      "",
      [
        "AI will replace all university teachers within two years.",
        "The article has five sections.",
        "The table shows 40 participants.",
        "The author published the paper in 2023."
      ],
      0,
      "A strong prediction needs evidence."
    ],
    [
      "Which source is least reliable?",
      "",
      [
        "An anonymous post with no source",
        "A university website",
        "A peer-reviewed article",
        "An official report"
      ],
      0,
      "Anonymous posts with no source are weak evidence."
    ],
    [
      "Choose the best critical reading action.",
      "",
      [
        "Compare the claim with evidence from a credible source.",
        "Share the text because it looks interesting.",
        "Accept it because many people like it.",
        "Ignore the date and author."
      ],
      0,
      "Critical readers check claims against evidence."
    ],
    [
      "Classify this statement.",
      "The study found that students who practiced weekly scored higher on the vocabulary test.",
      [
        "Evidence",
        "Opinion",
        "Casual phrase",
        "Greeting"
      ],
      0,
      "A study finding can support a claim."
    ],
    [
      "Which statement is a claim?",
      "",
      [
        "Digital literacy training may reduce students’ exposure to misinformation.",
        "The course has 15 sessions.",
        "The website lists three contact emails.",
        "The table includes two columns."
      ],
      0,
      "This statement needs evidence to support it."
    ]
  ],
  "6": [
    [
      "Choose the best summary.",
      "Original: Digital literacy helps students evaluate sources, protect private information, and communicate responsibly online.",
      [
        "Digital literacy supports responsible and safe online behavior.",
        "Digital literacy helps students evaluate sources, protect private information, and communicate responsibly online.",
        "Students use the internet.",
        "Online behavior is always safe."
      ],
      0,
      "This keeps the main idea in fewer words."
    ],
    [
      "Choose the best summary.",
      "Original: Academic presentations require clear structure, signposting phrases, and evidence to help audiences follow the speaker’s ideas.",
      [
        "Academic presentations need structure, signposting, and evidence.",
        "Presentations require clear structure, signposting phrases, and evidence to help audiences follow the speaker’s ideas.",
        "Speakers use phrases.",
        "Audiences listen to presentations."
      ],
      0,
      "This is concise and complete."
    ],
    [
      "Which summary is too narrow?",
      "Original: Exercise may improve physical health, reduce stress, and help students sleep better.",
      [
        "Exercise may improve sleep.",
        "Exercise may benefit students’ physical and mental well-being.",
        "Exercise has several health benefits for students.",
        "Exercise may support student wellness."
      ],
      0,
      "It includes only one detail."
    ],
    [
      "Which summary changes the meaning?",
      "Original: AI can support learning when students check its output carefully.",
      [
        "AI always gives correct information.",
        "AI can help learning if students evaluate its output.",
        "Careful checking is needed when using AI.",
        "AI may support learning responsibly."
      ],
      0,
      "The original does not say AI is always correct."
    ],
    [
      "A summary should avoid ______.",
      "",
      [
        "adding unsupported personal opinions",
        "keeping the central idea",
        "using fewer words",
        "paraphrasing key points"
      ],
      0,
      "A summary should not add unsupported opinions."
    ],
    [
      "Choose the best summary.",
      "Original: Peer feedback helps students notice unclear ideas and improve the organization of their writing.",
      [
        "Peer feedback can improve clarity and organization in writing.",
        "Peer feedback helps students notice unclear ideas and improve the organization of their writing.",
        "Students write paragraphs.",
        "Feedback is always easy."
      ],
      0,
      "This is concise and accurate."
    ],
    [
      "Which is a good summary strategy?",
      "",
      [
        "Identify key points before writing.",
        "Copy the longest sentence.",
        "Start with personal feelings.",
        "Change only one word from each sentence."
      ],
      0,
      "Good summaries begin with key points."
    ],
    [
      "Which summary is too broad?",
      "Original: Citation tools can help students format references more accurately.",
      [
        "Technology helps people.",
        "Citation tools may improve reference formatting.",
        "Students can use tools for references.",
        "Reference formatting can be supported by citation tools."
      ],
      0,
      "Technology helps people is too broad."
    ],
    [
      "Choose the best summary.",
      "Original: Data description should highlight major trends rather than list every number in a table.",
      [
        "Data description should focus on major trends.",
        "Data description should highlight major trends rather than list every number in a table.",
        "Tables have numbers.",
        "Every number is always important."
      ],
      0,
      "This keeps the key idea in fewer words."
    ],
    [
      "Which sentence should not be in a neutral summary?",
      "",
      [
        "I personally think this topic is boring.",
        "The article discusses digital literacy.",
        "The author explains two causes.",
        "The study reports survey findings."
      ],
      0,
      "Personal opinion should not be added to a neutral summary."
    ],
    [
      "Choose the best summary.",
      "Original: Students can improve listening comprehension by focusing on keywords, signal words, and the speaker’s main point.",
      [
        "Students can improve listening by focusing on key information.",
        "Students can improve listening comprehension by focusing on keywords, signal words, and the speaker’s main point.",
        "Students listen in class.",
        "Keywords are words."
      ],
      0,
      "This is shorter and accurate."
    ],
    [
      "Which is the best paraphrased summary?",
      "Original: Online discussions can increase participation because shy students may feel more comfortable writing than speaking.",
      [
        "Online discussions may support participation, especially for students who prefer writing.",
        "Online discussions can increase participation because shy students may feel more comfortable writing than speaking.",
        "Shy students never speak.",
        "Writing is always better than speaking."
      ],
      0,
      "This paraphrases the meaning without copying."
    ]
  ],
  "7": [
    [
      "Choose the academic version.",
      "Informal: Lots of students think online tests are okay.",
      [
        "Many students consider online tests acceptable.",
        "Lots of students are okay with online tests.",
        "Online tests are kind of fine.",
        "Students think tests are okay-ish."
      ],
      0,
      "Many and acceptable are more academic."
    ],
    [
      "Choose the academic version.",
      "Informal: The app helps students a lot.",
      [
        "The application may significantly support student learning.",
        "The app helps students a lot.",
        "The app is very helpful and nice.",
        "Students get lots of help from the app."
      ],
      0,
      "This sentence is formal and specific."
    ],
    [
      "Which phrase is more academic?",
      "",
      [
        "a considerable number of students",
        "tons of students",
        "loads of students",
        "many many students"
      ],
      0,
      "A considerable number is formal."
    ],
    [
      "Choose the academic version.",
      "Informal: The data looks weird.",
      [
        "The data appear inconsistent.",
        "The data looks weird.",
        "The numbers are strange.",
        "The data is kind of odd."
      ],
      0,
      "Inconsistent is more precise and academic."
    ],
    [
      "Choose the academic version.",
      "Informal: This problem is huge.",
      [
        "This issue is significant.",
        "This problem is super huge.",
        "This is a big big issue.",
        "This problem is massive stuff."
      ],
      0,
      "Significant is suitable academic language."
    ],
    [
      "Which sentence is too informal?",
      "",
      [
        "This result is kind of bad for students.",
        "This result may negatively affect students.",
        "The findings indicate a possible problem.",
        "The outcome suggests a need for support."
      ],
      0,
      "Kind of bad is informal."
    ],
    [
      "Choose the academic version.",
      "Informal: The writer talks about AI stuff.",
      [
        "The author discusses issues related to artificial intelligence.",
        "The writer talks about AI stuff.",
        "The writer says things about AI.",
        "AI stuff is discussed."
      ],
      0,
      "Author discusses issues is more academic."
    ],
    [
      "Choose the academic version.",
      "Informal: People should not believe random posts.",
      [
        "Users should evaluate online posts before accepting them as reliable.",
        "People should not believe random posts.",
        "Random posts are not good.",
        "People should stop believing stuff."
      ],
      0,
      "This version is formal and specific."
    ],
    [
      "Which word is more academic than 'bad'?",
      "",
      [
        "negative",
        "not cool",
        "awful stuff",
        "bad bad"
      ],
      0,
      "Negative is more academic."
    ],
    [
      "Choose the academic version.",
      "Informal: The class was useful because we learned many things.",
      [
        "The session was beneficial because students developed several academic skills.",
        "The class was useful because we learned many things.",
        "The class helped a lot.",
        "We learned lots of stuff."
      ],
      0,
      "This is more formal and specific."
    ],
    [
      "Which phrase shows cautious academic tone?",
      "",
      [
        "may indicate",
        "totally proves",
        "always means",
        "for sure shows"
      ],
      0,
      "May indicate is appropriately cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: Social media makes students waste time.",
      [
        "Excessive social media use may reduce students’ study time.",
        "Social media makes students waste time.",
        "Students waste time because of social media.",
        "Social media is bad for all students."
      ],
      0,
      "This sentence is formal, cautious, and precise."
    ]
  ],
  "8": [
    [
      "Integrated: Choose the best academic connector.",
      "The evidence was limited; ______, the conclusion should be cautious.",
      [
        "therefore",
        "such as",
        "in addition",
        "similarly"
      ],
      0,
      "Therefore shows a result."
    ],
    [
      "Integrated: Choose the main idea.",
      "Students who review feedback after each task can identify weaknesses and improve their next attempt.",
      [
        "Reviewing feedback supports improvement.",
        "Students do tasks.",
        "Weaknesses exist.",
        "Attempts can be next."
      ],
      0,
      "The paragraph focuses on feedback and improvement."
    ],
    [
      "Integrated: Choose the academic tone.",
      "Informal: This source is kind of bad.",
      [
        "This source may not be reliable.",
        "This source is kind of bad.",
        "This source is not cool.",
        "This source is bad stuff."
      ],
      0,
      "Reliable is more academic and specific."
    ],
    [
      "Integrated: Classify the statement.",
      "The survey found that 58% of participants preferred mobile learning.",
      [
        "Evidence",
        "Opinion",
        "Claim",
        "Greeting"
      ],
      0,
      "Survey data is evidence."
    ],
    [
      "Integrated: Choose the best summary.",
      "Original: Citation helps readers identify the sources used in academic work.",
      [
        "Citation helps readers trace academic sources.",
        "Citation helps readers identify the sources used in academic work.",
        "Readers read sources.",
        "Academic work is important."
      ],
      0,
      "This is concise and accurate."
    ],
    [
      "Integrated: Choose the academic vocabulary.",
      "The study will ______ students’ attitudes toward AI tools.",
      [
        "examine",
        "guess",
        "chat",
        "decorate"
      ],
      0,
      "Examine is an academic verb."
    ],
    [
      "Integrated: Which option is too narrow?",
      "Academic writing requires clear structure, evidence, and formal language.",
      [
        "Academic writing requires formal language.",
        "Academic writing requires several features.",
        "Academic writing needs structure and evidence.",
        "Academic writing should be clear."
      ],
      0,
      "Formal language is only one detail."
    ],
    [
      "Integrated: Choose the best source.",
      "",
      [
        "A journal article with author and date",
        "A screenshot with no source",
        "A forwarded message",
        "An anonymous comment"
      ],
      0,
      "A journal article is more credible."
    ],
    [
      "Integrated: Choose the best paraphrase.",
      "Original: Online learning can increase access to educational materials.",
      [
        "Online learning may improve access to learning resources.",
        "Online learning can increase access to educational materials.",
        "Online learning is always better.",
        "Educational materials are online."
      ],
      0,
      "This paraphrases the original meaning."
    ],
    [
      "Integrated: Choose the signal word for contrast.",
      "",
      [
        "however",
        "therefore",
        "for example",
        "as a result"
      ],
      0,
      "However shows contrast."
    ],
    [
      "Integrated: Choose the best reflection sentence.",
      "",
      [
        "I need to practice identifying evidence because I confused claims with facts.",
        "It was hard.",
        "I clicked the wrong one.",
        "The boss was scary."
      ],
      0,
      "This reflection identifies a specific weakness."
    ],
    [
      "Integrated: Which skill helps defeat Plagiarism Monster?",
      "",
      [
        "Citation and paraphrasing",
        "Guessing quickly",
        "Choosing colorful slides",
        "Reading only the title"
      ],
      0,
      "Citation and paraphrasing are ethics skills."
    ]
  ],
  "9": [
    [
      "Choose the best topic sentence.",
      "Topic: Digital literacy",
      [
        "Digital literacy is essential for responsible online learning.",
        "Students use websites.",
        "Some websites have pictures.",
        "Online learning happens sometimes."
      ],
      0,
      "This sentence states a clear main point."
    ],
    [
      "Choose the best supporting detail.",
      "Topic sentence: Academic vocabulary improves reading comprehension.",
      [
        "Students who know key terms can follow arguments more accurately.",
        "Vocabulary is a word.",
        "Some books are long.",
        "Reading can happen at home."
      ],
      0,
      "This detail directly supports the topic."
    ],
    [
      "Choose the best evidence sentence.",
      "Topic: Exercise can reduce stress.",
      [
        "A university survey found that students who exercised weekly reported lower stress levels.",
        "Exercise is popular with some people.",
        "Students have stress.",
        "Stress is not good."
      ],
      0,
      "This sentence provides data-based support."
    ],
    [
      "Choose the best concluding sentence.",
      "Paragraph topic: Responsible AI use",
      [
        "Therefore, students should use AI critically and ethically in academic work.",
        "AI tools are on many websites.",
        "Some students use AI.",
        "The next paragraph is different."
      ],
      0,
      "This conclusion summarizes the paragraph’s point."
    ],
    [
      "Which sentence does not fit a paragraph about academic email?",
      "",
      [
        "Graphs can show trends in student performance.",
        "A clear subject line helps the reader understand the email.",
        "A polite greeting creates a respectful tone.",
        "A specific request helps the instructor respond."
      ],
      0,
      "Graphs do not fit an academic email paragraph."
    ],
    [
      "What is the role of a topic sentence?",
      "",
      [
        "To introduce the main idea of the paragraph",
        "To list all references",
        "To end the essay",
        "To add a random example"
      ],
      0,
      "A topic sentence introduces the paragraph’s main idea."
    ],
    [
      "Which order is most logical?",
      "",
      [
        "Topic sentence → Supporting detail → Evidence → Concluding sentence",
        "Evidence → Title → Random detail → Topic",
        "Conclusion → Example → Topic → Greeting",
        "Reference → Question → Opinion → Title"
      ],
      0,
      "This is a logical paragraph structure."
    ],
    [
      "Choose the best example for: “Mobile apps can support vocabulary learning.”",
      "",
      [
        "For example, flashcard apps can help students review academic words daily.",
        "For example, some students have phones.",
        "For example, the screen is bright.",
        "For example, apps are downloaded."
      ],
      0,
      "This example supports vocabulary learning."
    ],
    [
      "Choose the best paragraph focus.",
      "",
      [
        "One clear main idea",
        "Many unrelated ideas",
        "Only examples without a topic",
        "A conclusion with no support"
      ],
      0,
      "A paragraph should focus on one clear idea."
    ],
    [
      "Which sentence is too general for a topic sentence?",
      "",
      [
        "Education is important.",
        "Digital literacy can help students evaluate online information.",
        "Academic email requires polite language.",
        "Citation supports academic integrity."
      ],
      0,
      "Education is important is too broad."
    ],
    [
      "Choose the best support for: “Peer feedback improves writing.”",
      "",
      [
        "Classmates may identify unclear ideas that the writer did not notice.",
        "Peer means people of the same group.",
        "Writing uses sentences.",
        "Feedback can be short."
      ],
      0,
      "This explains how peer feedback improves writing."
    ],
    [
      "Choose the sentence that sounds like evidence.",
      "",
      [
        "A study of 120 students reported improved scores after weekly practice.",
        "I think practice is nice.",
        "Students may enjoy games.",
        "Practice is important."
      ],
      0,
      "This sentence includes study data."
    ]
  ],
  "10": [
    [
      "Choose the best description.",
      "Data: 20% in 2022, 35% in 2023, 50% in 2024.",
      [
        "The percentage increased steadily from 2022 to 2024.",
        "The percentage decreased steadily.",
        "The percentage remained stable.",
        "The percentage rose only in 2022."
      ],
      0,
      "The numbers increase each year."
    ],
    [
      "Choose the best description.",
      "Data: 70, 70, 70.",
      [
        "The value remained stable.",
        "The value increased significantly.",
        "The value decreased gradually.",
        "The value fluctuated sharply."
      ],
      0,
      "The numbers do not change."
    ],
    [
      "Choose the best description.",
      "Data: Group A = 65%, Group B = 45%.",
      [
        "Group A was higher than Group B.",
        "Group B was higher than Group A.",
        "Both groups were equal.",
        "Group A had no data."
      ],
      0,
      "65% is higher than 45%."
    ],
    [
      "Which phrase is best for a small increase?",
      "",
      [
        "increased slightly",
        "increased dramatically",
        "fell sharply",
        "remained stable"
      ],
      0,
      "Slightly means a small change."
    ],
    [
      "Which phrase is best for a large decrease?",
      "",
      [
        "decreased significantly",
        "increased slightly",
        "remained stable",
        "rose gradually"
      ],
      0,
      "Decreased significantly shows a large drop."
    ],
    [
      "Choose the academic data sentence.",
      "Data: 40% preferred videos, 30% preferred quizzes.",
      [
        "Videos were preferred by a higher percentage of students than quizzes.",
        "Videos win because they are better.",
        "Everyone likes videos.",
        "Quizzes are not cool."
      ],
      0,
      "This sentence accurately compares the data."
    ],
    [
      "Which should be avoided in data description?",
      "",
      [
        "Claiming more than the data show",
        "Identifying the main trend",
        "Comparing major values",
        "Using accurate percentages"
      ],
      0,
      "Do not over-interpret data."
    ],
    [
      "Choose the best verb for upward trend.",
      "",
      [
        "rise",
        "fall",
        "remain stable",
        "drop"
      ],
      0,
      "Rise means increase."
    ],
    [
      "Choose the best verb for downward trend.",
      "",
      [
        "decline",
        "increase",
        "grow",
        "remain stable"
      ],
      0,
      "Decline means decrease."
    ],
    [
      "Choose the best sentence.",
      "Data: The number changed from 100 to 102.",
      [
        "The number increased slightly.",
        "The number increased dramatically.",
        "The number decreased sharply.",
        "The number remained exactly the same."
      ],
      0,
      "100 to 102 is a slight increase."
    ],
    [
      "Which sentence is too strong for limited data?",
      "",
      [
        "The result proves that all students prefer online learning.",
        "The data suggest a possible preference for online learning.",
        "The survey indicates a trend.",
        "The findings should be interpreted carefully."
      ],
      0,
      "Proves that all students is too strong."
    ],
    [
      "Choose the best comparison phrase.",
      "",
      [
        "compared with",
        "because of",
        "in conclusion",
        "for example"
      ],
      0,
      "Compared with is used for comparison."
    ]
  ],
  "11": [
    [
      "Choose the best subject line.",
      "",
      [
        "Request for Feedback on Draft Report",
        "Need help fast",
        "Question",
        "Please read"
      ],
      0,
      "This subject is specific and formal."
    ],
    [
      "Choose the best greeting.",
      "",
      [
        "Dear Professor Lee,",
        "Hey prof,",
        "Hello!!!",
        "Teacher!"
      ],
      0,
      "Dear Professor Lee is respectful."
    ],
    [
      "Choose the best purpose sentence.",
      "",
      [
        "I am writing to ask for clarification about the final presentation.",
        "I don’t get it.",
        "Tell me what to do.",
        "Presentation problem."
      ],
      0,
      "This sentence clearly states the purpose."
    ],
    [
      "Choose the best request.",
      "",
      [
        "Could you please let me know whether the report should include references?",
        "Tell me references now.",
        "I need answer.",
        "You must explain references."
      ],
      0,
      "Could you please is polite."
    ],
    [
      "Choose the best reason sentence.",
      "",
      [
        "I was unable to attend the class because of a medical appointment.",
        "I missed it.",
        "I was not there and need everything.",
        "I forgot class."
      ],
      0,
      "This reason is clear and respectful."
    ],
    [
      "Choose the best closing line.",
      "",
      [
        "Thank you for your time and consideration.",
        "Reply fast.",
        "That is all.",
        "Okay bye."
      ],
      0,
      "This closing is polite."
    ],
    [
      "Which email element helps the reader understand the topic quickly?",
      "",
      [
        "Subject line",
        "Emoji",
        "Font color",
        "Long unrelated story"
      ],
      0,
      "A subject line signals the topic."
    ],
    [
      "Which sentence is too direct?",
      "",
      [
        "Send me the score today.",
        "I would like to ask whether my score is available.",
        "Could you please advise me about the score?",
        "I am writing to ask about my score."
      ],
      0,
      "This sounds like a command."
    ],
    [
      "Choose the best appointment request.",
      "",
      [
        "Would it be possible to meet during your office hours?",
        "Meet me today.",
        "I want to see you now.",
        "You have to talk to me."
      ],
      0,
      "This is polite and appropriate."
    ],
    [
      "Choose the best attachment sentence.",
      "",
      [
        "I have attached my revised report for your review.",
        "Here thing.",
        "File is there.",
        "Look at this."
      ],
      0,
      "This sentence is clear and formal."
    ],
    [
      "Which email is most appropriate for university context?",
      "",
      [
        "A concise email with greeting, purpose, request, and closing",
        "A message with no subject and only one word",
        "A long complaint with no request",
        "A casual chat message"
      ],
      0,
      "Academic email should be structured and polite."
    ],
    [
      "Choose the best apology phrase.",
      "",
      [
        "I apologize for the late submission.",
        "Sorry late lol.",
        "My bad.",
        "Late again."
      ],
      0,
      "This phrase is formal and appropriate."
    ]
  ],
  "12": [
    [
      "Which option needs citation?",
      "",
      [
        "A specific idea from a journal article",
        "Your own daily schedule",
        "A common phrase such as 'thank you'",
        "Your personal preference without source"
      ],
      0,
      "Ideas from sources need citation."
    ],
    [
      "Choose the safest academic action.",
      "",
      [
        "Paraphrase the idea and cite the source.",
        "Change a few words and remove the source.",
        "Copy the paragraph because it sounds good.",
        "Use a fake reference."
      ],
      0,
      "Paraphrase plus citation is safest."
    ],
    [
      "Which is patchwriting?",
      "",
      [
        "Changing only a few words from the original sentence",
        "Writing a new sentence from your own understanding",
        "Quoting with quotation marks",
        "Summarizing with citation"
      ],
      0,
      "Patchwriting changes too little from the original."
    ],
    [
      "Which AI use is risky?",
      "",
      [
        "Submitting AI-generated text without checking or declaring it when required",
        "Using AI to brainstorm possible keywords",
        "Checking grammar and then revising yourself",
        "Asking AI for practice questions"
      ],
      0,
      "Submitting unchecked AI text is risky."
    ],
    [
      "What should a reference help readers do?",
      "",
      [
        "Find the original source",
        "Guess your opinion",
        "Ignore the evidence",
        "Avoid reading"
      ],
      0,
      "References help readers locate sources."
    ],
    [
      "Choose the correct ethical statement.",
      "",
      [
        "Using another author’s idea requires acknowledgment.",
        "Changing one word removes the need for citation.",
        "Online information never needs citation.",
        "AI output is always your own work."
      ],
      0,
      "Borrowed ideas require credit."
    ],
    [
      "Which sentence is most transparent?",
      "",
      [
        "AI was used to brainstorm ideas, and the final text was reviewed and edited by the student.",
        "AI did everything.",
        "No need to mention tools.",
        "The source was somewhere online."
      ],
      0,
      "This is transparent about AI assistance."
    ],
    [
      "Which is acceptable quotation practice?",
      "",
      [
        "Use quotation marks and provide citation.",
        "Copy without citation if the text is short.",
        "Remove the author’s name.",
        "Use quotation marks but invent the year."
      ],
      0,
      "Quotations need quotation marks and citation."
    ],
    [
      "Choose the best paraphrase.",
      "Original: Digital literacy helps students evaluate online information.",
      [
        "Digital literacy supports students in judging online information.",
        "Digital literacy helps students evaluate online information.",
        "Online information is digital literacy.",
        "Students online information evaluate literacy."
      ],
      0,
      "This changes wording while keeping meaning."
    ],
    [
      "Which citation problem is shown?",
      "The student includes a citation, but the cited source does not contain the information.",
      [
        "Incorrect source use",
        "Perfect citation",
        "Clear evidence",
        "Good summary"
      ],
      0,
      "The source must support the information."
    ],
    [
      "Which is not enough to avoid plagiarism?",
      "",
      [
        "Changing only one or two words",
        "Using your own structure",
        "Citing the source",
        "Summarizing key ideas"
      ],
      0,
      "Changing only a few words is not enough."
    ],
    [
      "Choose the best source note.",
      "",
      [
        "According to the Ministry report (2025), ...",
        "Someone said online...",
        "I saw it somewhere...",
        "Many people know..."
      ],
      0,
      "This gives an identifiable source."
    ]
  ],
  "13": [
    [
      "Listening simulation: What is the speaker’s purpose?",
      "Transcript: Today, I will explain three strategies for improving academic reading: previewing, identifying keywords, and reviewing notes.",
      [
        "To explain reading strategies",
        "To describe a sports event",
        "To advertise a phone",
        "To tell a personal story only"
      ],
      0,
      "The speaker introduces reading strategies."
    ],
    [
      "Which note is best?",
      "Transcript: The first reason is that citation helps readers locate the original source.",
      [
        "Citation → readers locate source",
        "The first reason is that citation helps readers locate the original source.",
        "Readers maybe source first",
        "Citation nice"
      ],
      0,
      "Good notes are short and meaningful."
    ],
    [
      "Which signal word shows a new point?",
      "Transcript: Next, I will discuss the role of evidence in academic writing.",
      [
        "Next",
        "evidence",
        "writing",
        "role"
      ],
      0,
      "Next introduces a new point."
    ],
    [
      "What is the main point?",
      "Transcript: Although AI tools are useful, students must check the accuracy of the information they provide.",
      [
        "AI tools require careful checking.",
        "AI tools are always accurate.",
        "Students should avoid all tools.",
        "Accuracy is not important."
      ],
      0,
      "The speaker emphasizes careful checking."
    ],
    [
      "Which keyword should be in the notes?",
      "Transcript: The study found a significant increase in student engagement after game-based learning was introduced.",
      [
        "significant increase",
        "introduced",
        "after",
        "student"
      ],
      0,
      "Significant increase is key information."
    ],
    [
      "Which number should be noted?",
      "Transcript: The survey included 250 undergraduate students from three faculties.",
      [
        "250 undergraduate students",
        "survey included",
        "faculties",
        "from"
      ],
      0,
      "Important numbers should be noted."
    ],
    [
      "Which phrase signals conclusion?",
      "Transcript: To sum up, academic English supports reading, writing, and presentation skills.",
      [
        "To sum up",
        "supports",
        "skills",
        "academic"
      ],
      0,
      "To sum up signals conclusion."
    ],
    [
      "What should you do if you miss one word in a lecture?",
      "",
      [
        "Keep listening for the main idea.",
        "Stop listening completely.",
        "Write random words.",
        "Assume the lecture is impossible."
      ],
      0,
      "Good listeners continue focusing on main ideas."
    ],
    [
      "Which listening strategy is best before listening?",
      "",
      [
        "Preview the topic and key vocabulary.",
        "Ignore the title.",
        "Close the notes.",
        "Memorize unrelated words."
      ],
      0,
      "Previewing prepares comprehension."
    ],
    [
      "Which note-taking symbol is useful for cause?",
      "",
      [
        "→",
        "♥",
        "?",
        "#"
      ],
      0,
      "Arrows can show cause/result relationships."
    ],
    [
      "What is the main topic?",
      "Transcript: This lecture focuses on how social media can spread misinformation and how students can evaluate sources.",
      [
        "Misinformation and source evaluation",
        "Entertainment apps",
        "Presentation anxiety",
        "Exercise and sleep"
      ],
      0,
      "The transcript focuses on misinformation and source evaluation."
    ],
    [
      "Which detail supports the topic?",
      "Transcript: Students should check the author, date, and evidence before sharing information.",
      [
        "Check author, date, and evidence",
        "Students share things",
        "Information exists online",
        "The speaker talks today"
      ],
      0,
      "These are specific evaluation steps."
    ]
  ],
  "14": [
    [
      "Choose the best topic introduction.",
      "",
      [
        "My presentation focuses on how digital literacy can reduce fake news.",
        "I talk about things online.",
        "This is my slide.",
        "Maybe my topic is something."
      ],
      0,
      "This introduction is clear."
    ],
    [
      "Choose the best outline phrase.",
      "",
      [
        "I will first explain the problem, then discuss causes and solutions.",
        "I will say many things.",
        "There are slides.",
        "Please listen."
      ],
      0,
      "This previews structure."
    ],
    [
      "Choose the best transition.",
      "",
      [
        "Let us now move to the causes of the problem.",
        "Okay next stuff.",
        "Another random point.",
        "Go to slide."
      ],
      0,
      "This is a clear transition."
    ],
    [
      "Choose the best evidence phrase.",
      "",
      [
        "According to the survey results, ...",
        "I feel like...",
        "People say...",
        "It is obvious..."
      ],
      0,
      "This introduces evidence."
    ],
    [
      "Choose the best conclusion.",
      "",
      [
        "In conclusion, digital literacy training can help students evaluate information more responsibly.",
        "That’s it.",
        "I finished.",
        "No more slides."
      ],
      0,
      "This conclusion summarizes the argument."
    ],
    [
      "Choose the best Q&A response when you do not know the answer.",
      "",
      [
        "Thank you for the question. I will need to check further information before answering fully.",
        "I don’t know. Next.",
        "Why do you ask that?",
        "No answer."
      ],
      0,
      "This is honest and polite."
    ],
    [
      "Which phrase thanks the audience?",
      "",
      [
        "Thank you for your attention.",
        "Look at me.",
        "Finally done.",
        "Stop asking."
      ],
      0,
      "This is a standard closing phrase."
    ],
    [
      "Which slide title is most academic?",
      "",
      [
        "Causes of Digital Literacy Gaps",
        "Stuff about internet",
        "My topic maybe",
        "Things students do"
      ],
      0,
      "This title is clear and formal."
    ],
    [
      "Which speaking behavior is most effective?",
      "",
      [
        "Use clear signposting and maintain a steady pace.",
        "Read every word quickly.",
        "Avoid eye contact completely.",
        "Speak without structure."
      ],
      0,
      "Clear signposting and pace support understanding."
    ],
    [
      "Choose the best response to a challenging question.",
      "",
      [
        "That is an important point. Based on the evidence I found, ...",
        "You are wrong.",
        "I do not want that question.",
        "Ask someone else."
      ],
      0,
      "This response is respectful and evidence-based."
    ],
    [
      "Which phrase introduces a solution?",
      "",
      [
        "One possible solution is...",
        "The problem is...",
        "I am nervous.",
        "The end is here."
      ],
      0,
      "This phrase introduces a solution."
    ],
    [
      "Which phrase introduces a limitation?",
      "",
      [
        "One limitation of this evidence is...",
        "This proves everything.",
        "There is no problem.",
        "The answer is always true."
      ],
      0,
      "Academic presentations should acknowledge limitations."
    ]
  ],
  "15": [
    [
      "Choose the best problem statement.",
      "",
      [
        "Fake news can mislead students and affect decision-making.",
        "Fake news is bad stuff.",
        "I do not like fake news.",
        "Everyone knows fake news."
      ],
      0,
      "This problem statement is specific and academic."
    ],
    [
      "Choose the best cause sentence.",
      "",
      [
        "One cause is low digital literacy among social media users.",
        "The cause is people.",
        "It happens because internet.",
        "No one knows."
      ],
      0,
      "This cause is clear and relevant."
    ],
    [
      "Choose the best evidence sentence.",
      "",
      [
        "A class survey found that 64% of students had shared news before checking the source.",
        "Many people do it.",
        "It is everywhere.",
        "I saw it often."
      ],
      0,
      "This uses specific data."
    ],
    [
      "Choose the best solution.",
      "",
      [
        "Universities should provide short workshops on source evaluation and responsible sharing.",
        "People should be better.",
        "Stop using phones.",
        "Delete the internet."
      ],
      0,
      "This solution is specific and realistic."
    ],
    [
      "Choose the best conclusion.",
      "",
      [
        "In conclusion, digital literacy can reduce misinformation and support responsible online behavior.",
        "That is all about the thing.",
        "Fake news is not good.",
        "I finish now."
      ],
      0,
      "This conclusion is academic and connected to the topic."
    ],
    [
      "Which final mission skill combines reading and ethics?",
      "",
      [
        "Checking source credibility before citing information",
        "Choosing a colorful background",
        "Speaking faster",
        "Using only personal opinions"
      ],
      0,
      "Source checking connects reading and ethics."
    ],
    [
      "Which sentence is too opinion-based?",
      "",
      [
        "I think this issue is annoying and people should stop.",
        "The evidence suggests that the issue affects students’ decision-making.",
        "The data indicate a need for training.",
        "The report identifies digital literacy as a key factor."
      ],
      0,
      "This relies on personal opinion rather than evidence."
    ],
    [
      "Choose the best presentation structure.",
      "",
      [
        "Problem, cause, evidence, solution, conclusion",
        "Opinion, story, joke, ending, picture",
        "Title, title, title, title, end",
        "Cause only, no solution"
      ],
      0,
      "This structure is clear and complete."
    ],
    [
      "Which topic fits 'Save the Society' best?",
      "",
      [
        "Online scams targeting university students",
        "My favorite movie scene",
        "A random food ranking",
        "The color of my phone case"
      ],
      0,
      "Online scams are a social issue."
    ],
    [
      "Which solution is measurable?",
      "",
      [
        "Run a 30-minute source-checking workshop and compare pre/post quiz scores.",
        "Tell everyone to be careful.",
        "Make people smarter.",
        "Hope the problem decreases."
      ],
      0,
      "This solution can be measured."
    ],
    [
      "Choose the best academic title.",
      "",
      [
        "Improving Digital Literacy to Reduce Fake News Among University Students",
        "Fake News Bad",
        "Internet Problem Stuff",
        "Students and Things"
      ],
      0,
      "This title is specific and formal."
    ],
    [
      "Which final reflection is strongest?",
      "",
      [
        "I learned to support solutions with evidence rather than only opinion.",
        "I liked the final boss.",
        "The game was okay.",
        "I finished the work."
      ],
      0,
      "This reflection identifies learning growth."
    ]
  ]
};
    Object.keys(EXTRA).forEach(key => {
      const session = SESSIONS.find(s => s.id === Number(key));
      if(!session) return;
      EXTRA[key].forEach((q, idx) => {
        session.questions.push(mcq(
          `S${String(key).padStart(2,'0')}_X${String(idx+1).padStart(2,'0')}`,
          q[0], q[1], q[2], q[3], q[4]
        ));
      });
    });
  }
  addExtraQuestions();


  // Exam-ready expansion v1c: adds 45 extra questions per session.
  function addExamReadyQuestions(){
    const EXAM_EXTRA = {
  "1": [
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my academic reading accuracy by practicing reading research-based texts.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my summary writing by practicing expressing key ideas in fewer words.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my academic vocabulary by practicing understanding university-level texts.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my presentation confidence by practicing communicating ideas clearly.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my citation skills by practicing using sources responsibly.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my listening notes by practicing following lecture main points.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my paragraph organization by practicing writing clearer academic paragraphs.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my critical reading by practicing checking claims and evidence.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my data description by practicing explaining trends accurately.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my academic email writing by practicing communicating politely with instructors.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my academic reading accuracy by practicing reading research-based texts.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my summary writing by practicing expressing key ideas in fewer words.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my academic vocabulary by practicing understanding university-level texts.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my presentation confidence by practicing communicating ideas clearly.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my citation skills by practicing using sources responsibly.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my listening notes by practicing following lecture main points.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my paragraph organization by practicing writing clearer academic paragraphs.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my critical reading by practicing checking claims and evidence.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my data description by practicing explaining trends accurately.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my academic email writing by practicing communicating politely with instructors.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my academic reading accuracy by practicing reading research-based texts.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my summary writing by practicing expressing key ideas in fewer words.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my academic vocabulary by practicing understanding university-level texts.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my presentation confidence by practicing communicating ideas clearly.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my citation skills by practicing using sources responsibly.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my listening notes by practicing following lecture main points.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my paragraph organization by practicing writing clearer academic paragraphs.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my critical reading by practicing checking claims and evidence.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my data description by practicing explaining trends accurately.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my academic email writing by practicing communicating politely with instructors.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my academic reading accuracy by practicing reading research-based texts.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my summary writing by practicing expressing key ideas in fewer words.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my academic vocabulary by practicing understanding university-level texts.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my presentation confidence by practicing communicating ideas clearly.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my citation skills by practicing using sources responsibly.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my listening notes by practicing following lecture main points.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my paragraph organization by practicing writing clearer academic paragraphs.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my critical reading by practicing checking claims and evidence.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my data description by practicing explaining trends accurately.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my academic email writing by practicing communicating politely with instructors.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my academic reading accuracy by practicing reading research-based texts.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my summary writing by practicing expressing key ideas in fewer words.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my academic vocabulary by practicing understanding university-level texts.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my presentation confidence by practicing communicating ideas clearly.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ],
    [
      "Choose the most specific academic learning goal.",
      "",
      [
        "I will improve my citation skills by practicing using sources responsibly.",
        "I will try to be better at English when I have time.",
        "I want English to feel easier in every situation.",
        "I will finish tasks quickly without reviewing feedback."
      ],
      0,
      "A strong academic goal is specific, skill-based, and connected to practice."
    ]
  ],
  "2": [
    [
      "Choose the best word to complete the sentence.",
      "The researcher will ______ the interview data.",
      [
        "analyze",
        "evaluate",
        "evidence",
        "method"
      ],
      0,
      "analyze means examine information carefully."
    ],
    [
      "Which word means “judge the quality or value of something”?",
      "",
      [
        "evaluate",
        "significant",
        "conclusion",
        "therefore"
      ],
      0,
      "evaluate means judge the quality or value of something."
    ],
    [
      "Choose the most academic phrase.",
      "",
      [
        "The findings indicate that further study is needed.",
        "The results are kind of nice.",
        "The study says some stuff.",
        "The idea is pretty cool."
      ],
      0,
      "The correct option uses formal academic phrasing."
    ],
    [
      "Choose the best word to complete the sentence.",
      "The ______ section explains how participants were selected.",
      [
        "method",
        "result",
        "significant",
        "conclusion"
      ],
      0,
      "method means the procedure used in a study."
    ],
    [
      "Which word means “what is found after a study or activity”?",
      "",
      [
        "result",
        "however",
        "source",
        "claim"
      ],
      0,
      "result means what is found after a study or activity."
    ],
    [
      "Choose the most academic phrase.",
      "",
      [
        "The findings indicate that further study is needed.",
        "The results are kind of nice.",
        "The study says some stuff.",
        "The idea is pretty cool."
      ],
      0,
      "The correct option uses formal academic phrasing."
    ],
    [
      "Choose the best word to complete the sentence.",
      "The ______ should connect back to the main argument.",
      [
        "conclusion",
        "therefore",
        "however",
        "source"
      ],
      0,
      "conclusion means the final idea or summary."
    ],
    [
      "Which word means “as a result”?",
      "",
      [
        "therefore",
        "consistent",
        "participant",
        "identify"
      ],
      0,
      "therefore means as a result."
    ],
    [
      "Choose the most academic phrase.",
      "",
      [
        "The findings indicate that further study is needed.",
        "The results are kind of nice.",
        "The study says some stuff.",
        "The idea is pretty cool."
      ],
      0,
      "The correct option uses formal academic phrasing."
    ],
    [
      "Choose the best word to complete the sentence.",
      "A credible ______ should include an author or organization.",
      [
        "source",
        "claim",
        "consistent",
        "participant"
      ],
      0,
      "source means where information comes from."
    ],
    [
      "Which word means “an idea that needs evidence”?",
      "",
      [
        "claim",
        "indicate",
        "analyze",
        "evaluate"
      ],
      0,
      "claim means an idea that needs evidence."
    ],
    [
      "Choose the most academic phrase.",
      "",
      [
        "The findings indicate that further study is needed.",
        "The results are kind of nice.",
        "The study says some stuff.",
        "The idea is pretty cool."
      ],
      0,
      "The correct option uses formal academic phrasing."
    ],
    [
      "Choose the best word to complete the sentence.",
      "Each ______ completed a short questionnaire.",
      [
        "participant",
        "identify",
        "indicate",
        "analyze"
      ],
      0,
      "participant means a person who takes part in a study."
    ],
    [
      "Which word means “find or recognize”?",
      "",
      [
        "identify",
        "evidence",
        "method",
        "result"
      ],
      0,
      "identify means find or recognize."
    ],
    [
      "Choose the most academic phrase.",
      "",
      [
        "The findings indicate that further study is needed.",
        "The results are kind of nice.",
        "The study says some stuff.",
        "The idea is pretty cool."
      ],
      0,
      "The correct option uses formal academic phrasing."
    ],
    [
      "Choose the best word to complete the sentence.",
      "The researcher will ______ the interview data.",
      [
        "analyze",
        "evaluate",
        "evidence",
        "method"
      ],
      0,
      "analyze means examine information carefully."
    ],
    [
      "Which word means “judge the quality or value of something”?",
      "",
      [
        "evaluate",
        "significant",
        "conclusion",
        "therefore"
      ],
      0,
      "evaluate means judge the quality or value of something."
    ],
    [
      "Choose the most academic phrase.",
      "",
      [
        "The findings indicate that further study is needed.",
        "The results are kind of nice.",
        "The study says some stuff.",
        "The idea is pretty cool."
      ],
      0,
      "The correct option uses formal academic phrasing."
    ],
    [
      "Choose the best word to complete the sentence.",
      "The ______ section explains how participants were selected.",
      [
        "method",
        "result",
        "significant",
        "conclusion"
      ],
      0,
      "method means the procedure used in a study."
    ],
    [
      "Which word means “what is found after a study or activity”?",
      "",
      [
        "result",
        "however",
        "source",
        "claim"
      ],
      0,
      "result means what is found after a study or activity."
    ],
    [
      "Choose the most academic phrase.",
      "",
      [
        "The findings indicate that further study is needed.",
        "The results are kind of nice.",
        "The study says some stuff.",
        "The idea is pretty cool."
      ],
      0,
      "The correct option uses formal academic phrasing."
    ],
    [
      "Choose the best word to complete the sentence.",
      "The ______ should connect back to the main argument.",
      [
        "conclusion",
        "therefore",
        "however",
        "source"
      ],
      0,
      "conclusion means the final idea or summary."
    ],
    [
      "Which word means “as a result”?",
      "",
      [
        "therefore",
        "consistent",
        "participant",
        "identify"
      ],
      0,
      "therefore means as a result."
    ],
    [
      "Choose the most academic phrase.",
      "",
      [
        "The findings indicate that further study is needed.",
        "The results are kind of nice.",
        "The study says some stuff.",
        "The idea is pretty cool."
      ],
      0,
      "The correct option uses formal academic phrasing."
    ],
    [
      "Choose the best word to complete the sentence.",
      "A credible ______ should include an author or organization.",
      [
        "source",
        "claim",
        "consistent",
        "participant"
      ],
      0,
      "source means where information comes from."
    ],
    [
      "Which word means “an idea that needs evidence”?",
      "",
      [
        "claim",
        "indicate",
        "analyze",
        "evaluate"
      ],
      0,
      "claim means an idea that needs evidence."
    ],
    [
      "Choose the most academic phrase.",
      "",
      [
        "The findings indicate that further study is needed.",
        "The results are kind of nice.",
        "The study says some stuff.",
        "The idea is pretty cool."
      ],
      0,
      "The correct option uses formal academic phrasing."
    ],
    [
      "Choose the best word to complete the sentence.",
      "Each ______ completed a short questionnaire.",
      [
        "participant",
        "identify",
        "indicate",
        "analyze"
      ],
      0,
      "participant means a person who takes part in a study."
    ],
    [
      "Which word means “find or recognize”?",
      "",
      [
        "identify",
        "evidence",
        "method",
        "result"
      ],
      0,
      "identify means find or recognize."
    ],
    [
      "Choose the most academic phrase.",
      "",
      [
        "The findings indicate that further study is needed.",
        "The results are kind of nice.",
        "The study says some stuff.",
        "The idea is pretty cool."
      ],
      0,
      "The correct option uses formal academic phrasing."
    ],
    [
      "Choose the best word to complete the sentence.",
      "The researcher will ______ the interview data.",
      [
        "analyze",
        "evaluate",
        "evidence",
        "method"
      ],
      0,
      "analyze means examine information carefully."
    ],
    [
      "Which word means “judge the quality or value of something”?",
      "",
      [
        "evaluate",
        "significant",
        "conclusion",
        "therefore"
      ],
      0,
      "evaluate means judge the quality or value of something."
    ],
    [
      "Choose the most academic phrase.",
      "",
      [
        "The findings indicate that further study is needed.",
        "The results are kind of nice.",
        "The study says some stuff.",
        "The idea is pretty cool."
      ],
      0,
      "The correct option uses formal academic phrasing."
    ],
    [
      "Choose the best word to complete the sentence.",
      "The ______ section explains how participants were selected.",
      [
        "method",
        "result",
        "significant",
        "conclusion"
      ],
      0,
      "method means the procedure used in a study."
    ],
    [
      "Which word means “what is found after a study or activity”?",
      "",
      [
        "result",
        "however",
        "source",
        "claim"
      ],
      0,
      "result means what is found after a study or activity."
    ],
    [
      "Choose the most academic phrase.",
      "",
      [
        "The findings indicate that further study is needed.",
        "The results are kind of nice.",
        "The study says some stuff.",
        "The idea is pretty cool."
      ],
      0,
      "The correct option uses formal academic phrasing."
    ],
    [
      "Choose the best word to complete the sentence.",
      "The ______ should connect back to the main argument.",
      [
        "conclusion",
        "therefore",
        "however",
        "source"
      ],
      0,
      "conclusion means the final idea or summary."
    ],
    [
      "Which word means “as a result”?",
      "",
      [
        "therefore",
        "consistent",
        "participant",
        "identify"
      ],
      0,
      "therefore means as a result."
    ],
    [
      "Choose the most academic phrase.",
      "",
      [
        "The findings indicate that further study is needed.",
        "The results are kind of nice.",
        "The study says some stuff.",
        "The idea is pretty cool."
      ],
      0,
      "The correct option uses formal academic phrasing."
    ],
    [
      "Choose the best word to complete the sentence.",
      "A credible ______ should include an author or organization.",
      [
        "source",
        "claim",
        "consistent",
        "participant"
      ],
      0,
      "source means where information comes from."
    ],
    [
      "Which word means “an idea that needs evidence”?",
      "",
      [
        "claim",
        "indicate",
        "analyze",
        "evaluate"
      ],
      0,
      "claim means an idea that needs evidence."
    ],
    [
      "Choose the most academic phrase.",
      "",
      [
        "The findings indicate that further study is needed.",
        "The results are kind of nice.",
        "The study says some stuff.",
        "The idea is pretty cool."
      ],
      0,
      "The correct option uses formal academic phrasing."
    ],
    [
      "Choose the best word to complete the sentence.",
      "Each ______ completed a short questionnaire.",
      [
        "participant",
        "identify",
        "indicate",
        "analyze"
      ],
      0,
      "participant means a person who takes part in a study."
    ],
    [
      "Which word means “find or recognize”?",
      "",
      [
        "identify",
        "evidence",
        "method",
        "result"
      ],
      0,
      "identify means find or recognize."
    ],
    [
      "Choose the most academic phrase.",
      "",
      [
        "The findings indicate that further study is needed.",
        "The results are kind of nice.",
        "The study says some stuff.",
        "The idea is pretty cool."
      ],
      0,
      "The correct option uses formal academic phrasing."
    ]
  ],
  "3": [
    [
      "What is the main idea?",
      "Digital literacy helps students evaluate sources and avoid misinformation. It also supports responsible communication online.",
      [
        "Digital literacy supports responsible evaluation of online information.",
        "The text mentions evaluating sources.",
        "Academic life is important for all students.",
        "The text gives an example about responsible communication."
      ],
      0,
      "The main idea covers the whole paragraph."
    ],
    [
      "Which option is only a supporting detail?",
      "Peer feedback helps writers notice unclear ideas. It can also improve paragraph organization before final submission.",
      [
        "The text mentions noticing unclear ideas.",
        "Peer feedback can improve writing clarity and organization.",
        "The topic is wider than university education.",
        "The paragraph has no main idea."
      ],
      0,
      "A detail supports the main idea but does not cover the whole paragraph."
    ],
    [
      "Which option is too broad?",
      "Regular reading practice can improve vocabulary and comprehension. Students who read often become more familiar with academic sentence patterns.",
      [
        "Education and society are important.",
        "Regular reading practice supports vocabulary and comprehension.",
        "The text mentions reading often.",
        "The writer gives information about academic sentence patterns."
      ],
      0,
      "A too-broad option is more general than the paragraph."
    ],
    [
      "Which option is irrelevant?",
      "Citation helps readers find the original sources of information. It also shows that writers respect academic integrity.",
      [
        "Choosing colorful slide backgrounds improves design.",
        "Citation supports source tracing and academic integrity.",
        "The text mentions finding original sources.",
        "The text discusses respecting integrity."
      ],
      0,
      "An irrelevant option is not connected to the paragraph."
    ],
    [
      "What is the main idea?",
      "Online learning platforms provide videos, quizzes, and feedback. These tools help students practice outside class.",
      [
        "Online learning platforms support practice beyond the classroom.",
        "The text mentions videos and quizzes.",
        "Academic life is important for all students.",
        "The text gives an example about feedback."
      ],
      0,
      "The main idea covers the whole paragraph."
    ],
    [
      "Which option is only a supporting detail?",
      "Academic presentations need clear structure. Signposting phrases help audiences follow the speaker’s ideas.",
      [
        "The text mentions signposting phrases.",
        "Clear structure and signposting support academic presentations.",
        "The topic is wider than university education.",
        "The paragraph has no main idea."
      ],
      0,
      "A detail supports the main idea but does not cover the whole paragraph."
    ],
    [
      "Which option is too broad?",
      "Summarizing requires students to identify key points and restate them briefly. This skill helps students avoid copying too much from sources.",
      [
        "Education and society are important.",
        "Summarizing helps students express key ideas briefly and avoid copying.",
        "The text mentions avoiding copying.",
        "The writer gives information about identifying key points."
      ],
      0,
      "A too-broad option is more general than the paragraph."
    ],
    [
      "Which option is irrelevant?",
      "Data description should focus on major trends rather than every number. This helps readers understand the main pattern quickly.",
      [
        "Choosing colorful slide backgrounds improves design.",
        "Data description should highlight major trends.",
        "The text mentions major trends.",
        "The text discusses every number."
      ],
      0,
      "An irrelevant option is not connected to the paragraph."
    ],
    [
      "What is the main idea?",
      "Academic email should be polite and specific. A clear subject and respectful request help instructors respond effectively.",
      [
        "Academic email requires polite and clear communication.",
        "The text mentions clear subject.",
        "Academic life is important for all students.",
        "The text gives an example about respectful request."
      ],
      0,
      "The main idea covers the whole paragraph."
    ],
    [
      "Which option is only a supporting detail?",
      "Critical reading requires checking claims and evidence. This skill is important when students read online information.",
      [
        "The text mentions checking claims.",
        "Critical reading helps students evaluate claims and evidence.",
        "The topic is wider than university education.",
        "The paragraph has no main idea."
      ],
      0,
      "A detail supports the main idea but does not cover the whole paragraph."
    ],
    [
      "Which option is too broad?",
      "Digital literacy helps students evaluate sources and avoid misinformation. It also supports responsible communication online.",
      [
        "Education and society are important.",
        "Digital literacy supports responsible evaluation of online information.",
        "The text mentions responsible communication.",
        "The writer gives information about evaluating sources."
      ],
      0,
      "A too-broad option is more general than the paragraph."
    ],
    [
      "Which option is irrelevant?",
      "Peer feedback helps writers notice unclear ideas. It can also improve paragraph organization before final submission.",
      [
        "Choosing colorful slide backgrounds improves design.",
        "Peer feedback can improve writing clarity and organization.",
        "The text mentions noticing unclear ideas.",
        "The text discusses final submission."
      ],
      0,
      "An irrelevant option is not connected to the paragraph."
    ],
    [
      "What is the main idea?",
      "Regular reading practice can improve vocabulary and comprehension. Students who read often become more familiar with academic sentence patterns.",
      [
        "Regular reading practice supports vocabulary and comprehension.",
        "The text mentions academic sentence patterns.",
        "Academic life is important for all students.",
        "The text gives an example about reading often."
      ],
      0,
      "The main idea covers the whole paragraph."
    ],
    [
      "Which option is only a supporting detail?",
      "Citation helps readers find the original sources of information. It also shows that writers respect academic integrity.",
      [
        "The text mentions finding original sources.",
        "Citation supports source tracing and academic integrity.",
        "The topic is wider than university education.",
        "The paragraph has no main idea."
      ],
      0,
      "A detail supports the main idea but does not cover the whole paragraph."
    ],
    [
      "Which option is too broad?",
      "Online learning platforms provide videos, quizzes, and feedback. These tools help students practice outside class.",
      [
        "Education and society are important.",
        "Online learning platforms support practice beyond the classroom.",
        "The text mentions feedback.",
        "The writer gives information about videos and quizzes."
      ],
      0,
      "A too-broad option is more general than the paragraph."
    ],
    [
      "Which option is irrelevant?",
      "Academic presentations need clear structure. Signposting phrases help audiences follow the speaker’s ideas.",
      [
        "Choosing colorful slide backgrounds improves design.",
        "Clear structure and signposting support academic presentations.",
        "The text mentions signposting phrases.",
        "The text discusses audience understanding."
      ],
      0,
      "An irrelevant option is not connected to the paragraph."
    ],
    [
      "What is the main idea?",
      "Summarizing requires students to identify key points and restate them briefly. This skill helps students avoid copying too much from sources.",
      [
        "Summarizing helps students express key ideas briefly and avoid copying.",
        "The text mentions identifying key points.",
        "Academic life is important for all students.",
        "The text gives an example about avoiding copying."
      ],
      0,
      "The main idea covers the whole paragraph."
    ],
    [
      "Which option is only a supporting detail?",
      "Data description should focus on major trends rather than every number. This helps readers understand the main pattern quickly.",
      [
        "The text mentions major trends.",
        "Data description should highlight major trends.",
        "The topic is wider than university education.",
        "The paragraph has no main idea."
      ],
      0,
      "A detail supports the main idea but does not cover the whole paragraph."
    ],
    [
      "Which option is too broad?",
      "Academic email should be polite and specific. A clear subject and respectful request help instructors respond effectively.",
      [
        "Education and society are important.",
        "Academic email requires polite and clear communication.",
        "The text mentions respectful request.",
        "The writer gives information about clear subject."
      ],
      0,
      "A too-broad option is more general than the paragraph."
    ],
    [
      "Which option is irrelevant?",
      "Critical reading requires checking claims and evidence. This skill is important when students read online information.",
      [
        "Choosing colorful slide backgrounds improves design.",
        "Critical reading helps students evaluate claims and evidence.",
        "The text mentions checking claims.",
        "The text discusses online information."
      ],
      0,
      "An irrelevant option is not connected to the paragraph."
    ],
    [
      "What is the main idea?",
      "Digital literacy helps students evaluate sources and avoid misinformation. It also supports responsible communication online.",
      [
        "Digital literacy supports responsible evaluation of online information.",
        "The text mentions evaluating sources.",
        "Academic life is important for all students.",
        "The text gives an example about responsible communication."
      ],
      0,
      "The main idea covers the whole paragraph."
    ],
    [
      "Which option is only a supporting detail?",
      "Peer feedback helps writers notice unclear ideas. It can also improve paragraph organization before final submission.",
      [
        "The text mentions noticing unclear ideas.",
        "Peer feedback can improve writing clarity and organization.",
        "The topic is wider than university education.",
        "The paragraph has no main idea."
      ],
      0,
      "A detail supports the main idea but does not cover the whole paragraph."
    ],
    [
      "Which option is too broad?",
      "Regular reading practice can improve vocabulary and comprehension. Students who read often become more familiar with academic sentence patterns.",
      [
        "Education and society are important.",
        "Regular reading practice supports vocabulary and comprehension.",
        "The text mentions reading often.",
        "The writer gives information about academic sentence patterns."
      ],
      0,
      "A too-broad option is more general than the paragraph."
    ],
    [
      "Which option is irrelevant?",
      "Citation helps readers find the original sources of information. It also shows that writers respect academic integrity.",
      [
        "Choosing colorful slide backgrounds improves design.",
        "Citation supports source tracing and academic integrity.",
        "The text mentions finding original sources.",
        "The text discusses respecting integrity."
      ],
      0,
      "An irrelevant option is not connected to the paragraph."
    ],
    [
      "What is the main idea?",
      "Online learning platforms provide videos, quizzes, and feedback. These tools help students practice outside class.",
      [
        "Online learning platforms support practice beyond the classroom.",
        "The text mentions videos and quizzes.",
        "Academic life is important for all students.",
        "The text gives an example about feedback."
      ],
      0,
      "The main idea covers the whole paragraph."
    ],
    [
      "Which option is only a supporting detail?",
      "Academic presentations need clear structure. Signposting phrases help audiences follow the speaker’s ideas.",
      [
        "The text mentions signposting phrases.",
        "Clear structure and signposting support academic presentations.",
        "The topic is wider than university education.",
        "The paragraph has no main idea."
      ],
      0,
      "A detail supports the main idea but does not cover the whole paragraph."
    ],
    [
      "Which option is too broad?",
      "Summarizing requires students to identify key points and restate them briefly. This skill helps students avoid copying too much from sources.",
      [
        "Education and society are important.",
        "Summarizing helps students express key ideas briefly and avoid copying.",
        "The text mentions avoiding copying.",
        "The writer gives information about identifying key points."
      ],
      0,
      "A too-broad option is more general than the paragraph."
    ],
    [
      "Which option is irrelevant?",
      "Data description should focus on major trends rather than every number. This helps readers understand the main pattern quickly.",
      [
        "Choosing colorful slide backgrounds improves design.",
        "Data description should highlight major trends.",
        "The text mentions major trends.",
        "The text discusses every number."
      ],
      0,
      "An irrelevant option is not connected to the paragraph."
    ],
    [
      "What is the main idea?",
      "Academic email should be polite and specific. A clear subject and respectful request help instructors respond effectively.",
      [
        "Academic email requires polite and clear communication.",
        "The text mentions clear subject.",
        "Academic life is important for all students.",
        "The text gives an example about respectful request."
      ],
      0,
      "The main idea covers the whole paragraph."
    ],
    [
      "Which option is only a supporting detail?",
      "Critical reading requires checking claims and evidence. This skill is important when students read online information.",
      [
        "The text mentions checking claims.",
        "Critical reading helps students evaluate claims and evidence.",
        "The topic is wider than university education.",
        "The paragraph has no main idea."
      ],
      0,
      "A detail supports the main idea but does not cover the whole paragraph."
    ],
    [
      "Which option is too broad?",
      "Digital literacy helps students evaluate sources and avoid misinformation. It also supports responsible communication online.",
      [
        "Education and society are important.",
        "Digital literacy supports responsible evaluation of online information.",
        "The text mentions responsible communication.",
        "The writer gives information about evaluating sources."
      ],
      0,
      "A too-broad option is more general than the paragraph."
    ],
    [
      "Which option is irrelevant?",
      "Peer feedback helps writers notice unclear ideas. It can also improve paragraph organization before final submission.",
      [
        "Choosing colorful slide backgrounds improves design.",
        "Peer feedback can improve writing clarity and organization.",
        "The text mentions noticing unclear ideas.",
        "The text discusses final submission."
      ],
      0,
      "An irrelevant option is not connected to the paragraph."
    ],
    [
      "What is the main idea?",
      "Regular reading practice can improve vocabulary and comprehension. Students who read often become more familiar with academic sentence patterns.",
      [
        "Regular reading practice supports vocabulary and comprehension.",
        "The text mentions academic sentence patterns.",
        "Academic life is important for all students.",
        "The text gives an example about reading often."
      ],
      0,
      "The main idea covers the whole paragraph."
    ],
    [
      "Which option is only a supporting detail?",
      "Citation helps readers find the original sources of information. It also shows that writers respect academic integrity.",
      [
        "The text mentions finding original sources.",
        "Citation supports source tracing and academic integrity.",
        "The topic is wider than university education.",
        "The paragraph has no main idea."
      ],
      0,
      "A detail supports the main idea but does not cover the whole paragraph."
    ],
    [
      "Which option is too broad?",
      "Online learning platforms provide videos, quizzes, and feedback. These tools help students practice outside class.",
      [
        "Education and society are important.",
        "Online learning platforms support practice beyond the classroom.",
        "The text mentions feedback.",
        "The writer gives information about videos and quizzes."
      ],
      0,
      "A too-broad option is more general than the paragraph."
    ],
    [
      "Which option is irrelevant?",
      "Academic presentations need clear structure. Signposting phrases help audiences follow the speaker’s ideas.",
      [
        "Choosing colorful slide backgrounds improves design.",
        "Clear structure and signposting support academic presentations.",
        "The text mentions signposting phrases.",
        "The text discusses audience understanding."
      ],
      0,
      "An irrelevant option is not connected to the paragraph."
    ],
    [
      "What is the main idea?",
      "Summarizing requires students to identify key points and restate them briefly. This skill helps students avoid copying too much from sources.",
      [
        "Summarizing helps students express key ideas briefly and avoid copying.",
        "The text mentions identifying key points.",
        "Academic life is important for all students.",
        "The text gives an example about avoiding copying."
      ],
      0,
      "The main idea covers the whole paragraph."
    ],
    [
      "Which option is only a supporting detail?",
      "Data description should focus on major trends rather than every number. This helps readers understand the main pattern quickly.",
      [
        "The text mentions major trends.",
        "Data description should highlight major trends.",
        "The topic is wider than university education.",
        "The paragraph has no main idea."
      ],
      0,
      "A detail supports the main idea but does not cover the whole paragraph."
    ],
    [
      "Which option is too broad?",
      "Academic email should be polite and specific. A clear subject and respectful request help instructors respond effectively.",
      [
        "Education and society are important.",
        "Academic email requires polite and clear communication.",
        "The text mentions respectful request.",
        "The writer gives information about clear subject."
      ],
      0,
      "A too-broad option is more general than the paragraph."
    ],
    [
      "Which option is irrelevant?",
      "Critical reading requires checking claims and evidence. This skill is important when students read online information.",
      [
        "Choosing colorful slide backgrounds improves design.",
        "Critical reading helps students evaluate claims and evidence.",
        "The text mentions checking claims.",
        "The text discusses online information."
      ],
      0,
      "An irrelevant option is not connected to the paragraph."
    ],
    [
      "What is the main idea?",
      "Digital literacy helps students evaluate sources and avoid misinformation. It also supports responsible communication online.",
      [
        "Digital literacy supports responsible evaluation of online information.",
        "The text mentions evaluating sources.",
        "Academic life is important for all students.",
        "The text gives an example about responsible communication."
      ],
      0,
      "The main idea covers the whole paragraph."
    ],
    [
      "Which option is only a supporting detail?",
      "Peer feedback helps writers notice unclear ideas. It can also improve paragraph organization before final submission.",
      [
        "The text mentions noticing unclear ideas.",
        "Peer feedback can improve writing clarity and organization.",
        "The topic is wider than university education.",
        "The paragraph has no main idea."
      ],
      0,
      "A detail supports the main idea but does not cover the whole paragraph."
    ],
    [
      "Which option is too broad?",
      "Regular reading practice can improve vocabulary and comprehension. Students who read often become more familiar with academic sentence patterns.",
      [
        "Education and society are important.",
        "Regular reading practice supports vocabulary and comprehension.",
        "The text mentions reading often.",
        "The writer gives information about academic sentence patterns."
      ],
      0,
      "A too-broad option is more general than the paragraph."
    ],
    [
      "Which option is irrelevant?",
      "Citation helps readers find the original sources of information. It also shows that writers respect academic integrity.",
      [
        "Choosing colorful slide backgrounds improves design.",
        "Citation supports source tracing and academic integrity.",
        "The text mentions finding original sources.",
        "The text discusses respecting integrity."
      ],
      0,
      "An irrelevant option is not connected to the paragraph."
    ],
    [
      "What is the main idea?",
      "Online learning platforms provide videos, quizzes, and feedback. These tools help students practice outside class.",
      [
        "Online learning platforms support practice beyond the classroom.",
        "The text mentions videos and quizzes.",
        "Academic life is important for all students.",
        "The text gives an example about feedback."
      ],
      0,
      "The main idea covers the whole paragraph."
    ]
  ],
  "4": [
    [
      "Which signal word/phrase shows contrast?",
      "The tool is convenient; however, students must check accuracy.",
      [
        "however",
        "students",
        "information",
        "academic"
      ],
      0,
      "however signals contrast."
    ],
    [
      "Which signal word/phrase shows contrast?",
      "Although online learning is flexible, some students need face-to-face support.",
      [
        "although",
        "students",
        "information",
        "academic"
      ],
      0,
      "although signals contrast."
    ],
    [
      "Which signal word/phrase shows result?",
      "The evidence is limited; therefore, the conclusion should be cautious.",
      [
        "therefore",
        "students",
        "information",
        "academic"
      ],
      0,
      "therefore signals result."
    ],
    [
      "Which signal word/phrase shows result?",
      "The instructions were unclear; as a result, many students submitted the wrong file.",
      [
        "as a result",
        "students",
        "information",
        "academic"
      ],
      0,
      "as a result signals result."
    ],
    [
      "Which signal word/phrase shows cause?",
      "Students misunderstood the article because they focused only on examples.",
      [
        "because",
        "students",
        "information",
        "academic"
      ],
      0,
      "because signals cause."
    ],
    [
      "Which signal word/phrase shows cause?",
      "The score improved due to weekly practice.",
      [
        "due to",
        "students",
        "information",
        "academic"
      ],
      0,
      "due to signals cause."
    ],
    [
      "Which signal word/phrase shows example?",
      "Students can use academic tools, for example, citation managers.",
      [
        "for example",
        "students",
        "information",
        "academic"
      ],
      0,
      "for example signals example."
    ],
    [
      "Which signal word/phrase shows example?",
      "Digital tools, such as dictionaries and flashcards, can support vocabulary learning.",
      [
        "such as",
        "students",
        "information",
        "academic"
      ],
      0,
      "such as signals example."
    ],
    [
      "Which signal word/phrase shows addition?",
      "The app provides practice; moreover, it gives immediate feedback.",
      [
        "moreover",
        "students",
        "information",
        "academic"
      ],
      0,
      "moreover signals addition."
    ],
    [
      "Which signal word/phrase shows conclusion?",
      "In conclusion, evidence should guide academic decisions.",
      [
        "in conclusion",
        "students",
        "information",
        "academic"
      ],
      0,
      "in conclusion signals conclusion."
    ],
    [
      "Which signal word/phrase shows comparison?",
      "Compared with printed texts, e-books are easier to search.",
      [
        "compared with",
        "students",
        "information",
        "academic"
      ],
      0,
      "compared with signals comparison."
    ],
    [
      "Which signal word/phrase shows sequence?",
      "First, the speaker explains the problem.",
      [
        "first",
        "students",
        "information",
        "academic"
      ],
      0,
      "first signals sequence."
    ],
    [
      "Which signal word/phrase shows contrast?",
      "The tool is convenient; however, students must check accuracy.",
      [
        "however",
        "students",
        "information",
        "academic"
      ],
      0,
      "however signals contrast."
    ],
    [
      "Which signal word/phrase shows contrast?",
      "Although online learning is flexible, some students need face-to-face support.",
      [
        "although",
        "students",
        "information",
        "academic"
      ],
      0,
      "although signals contrast."
    ],
    [
      "Which signal word/phrase shows result?",
      "The evidence is limited; therefore, the conclusion should be cautious.",
      [
        "therefore",
        "students",
        "information",
        "academic"
      ],
      0,
      "therefore signals result."
    ],
    [
      "Which signal word/phrase shows result?",
      "The instructions were unclear; as a result, many students submitted the wrong file.",
      [
        "as a result",
        "students",
        "information",
        "academic"
      ],
      0,
      "as a result signals result."
    ],
    [
      "Which signal word/phrase shows cause?",
      "Students misunderstood the article because they focused only on examples.",
      [
        "because",
        "students",
        "information",
        "academic"
      ],
      0,
      "because signals cause."
    ],
    [
      "Which signal word/phrase shows cause?",
      "The score improved due to weekly practice.",
      [
        "due to",
        "students",
        "information",
        "academic"
      ],
      0,
      "due to signals cause."
    ],
    [
      "Which signal word/phrase shows example?",
      "Students can use academic tools, for example, citation managers.",
      [
        "for example",
        "students",
        "information",
        "academic"
      ],
      0,
      "for example signals example."
    ],
    [
      "Which signal word/phrase shows example?",
      "Digital tools, such as dictionaries and flashcards, can support vocabulary learning.",
      [
        "such as",
        "students",
        "information",
        "academic"
      ],
      0,
      "such as signals example."
    ],
    [
      "Which signal word/phrase shows addition?",
      "The app provides practice; moreover, it gives immediate feedback.",
      [
        "moreover",
        "students",
        "information",
        "academic"
      ],
      0,
      "moreover signals addition."
    ],
    [
      "Which signal word/phrase shows conclusion?",
      "In conclusion, evidence should guide academic decisions.",
      [
        "in conclusion",
        "students",
        "information",
        "academic"
      ],
      0,
      "in conclusion signals conclusion."
    ],
    [
      "Which signal word/phrase shows comparison?",
      "Compared with printed texts, e-books are easier to search.",
      [
        "compared with",
        "students",
        "information",
        "academic"
      ],
      0,
      "compared with signals comparison."
    ],
    [
      "Which signal word/phrase shows sequence?",
      "First, the speaker explains the problem.",
      [
        "first",
        "students",
        "information",
        "academic"
      ],
      0,
      "first signals sequence."
    ],
    [
      "Which signal word/phrase shows contrast?",
      "The tool is convenient; however, students must check accuracy.",
      [
        "however",
        "students",
        "information",
        "academic"
      ],
      0,
      "however signals contrast."
    ],
    [
      "Which signal word/phrase shows contrast?",
      "Although online learning is flexible, some students need face-to-face support.",
      [
        "although",
        "students",
        "information",
        "academic"
      ],
      0,
      "although signals contrast."
    ],
    [
      "Which signal word/phrase shows result?",
      "The evidence is limited; therefore, the conclusion should be cautious.",
      [
        "therefore",
        "students",
        "information",
        "academic"
      ],
      0,
      "therefore signals result."
    ],
    [
      "Which signal word/phrase shows result?",
      "The instructions were unclear; as a result, many students submitted the wrong file.",
      [
        "as a result",
        "students",
        "information",
        "academic"
      ],
      0,
      "as a result signals result."
    ],
    [
      "Which signal word/phrase shows cause?",
      "Students misunderstood the article because they focused only on examples.",
      [
        "because",
        "students",
        "information",
        "academic"
      ],
      0,
      "because signals cause."
    ],
    [
      "Which signal word/phrase shows cause?",
      "The score improved due to weekly practice.",
      [
        "due to",
        "students",
        "information",
        "academic"
      ],
      0,
      "due to signals cause."
    ],
    [
      "Which signal word/phrase shows example?",
      "Students can use academic tools, for example, citation managers.",
      [
        "for example",
        "students",
        "information",
        "academic"
      ],
      0,
      "for example signals example."
    ],
    [
      "Which signal word/phrase shows example?",
      "Digital tools, such as dictionaries and flashcards, can support vocabulary learning.",
      [
        "such as",
        "students",
        "information",
        "academic"
      ],
      0,
      "such as signals example."
    ],
    [
      "Which signal word/phrase shows addition?",
      "The app provides practice; moreover, it gives immediate feedback.",
      [
        "moreover",
        "students",
        "information",
        "academic"
      ],
      0,
      "moreover signals addition."
    ],
    [
      "Which signal word/phrase shows conclusion?",
      "In conclusion, evidence should guide academic decisions.",
      [
        "in conclusion",
        "students",
        "information",
        "academic"
      ],
      0,
      "in conclusion signals conclusion."
    ],
    [
      "Which signal word/phrase shows comparison?",
      "Compared with printed texts, e-books are easier to search.",
      [
        "compared with",
        "students",
        "information",
        "academic"
      ],
      0,
      "compared with signals comparison."
    ],
    [
      "Which signal word/phrase shows sequence?",
      "First, the speaker explains the problem.",
      [
        "first",
        "students",
        "information",
        "academic"
      ],
      0,
      "first signals sequence."
    ],
    [
      "Which signal word/phrase shows contrast?",
      "The tool is convenient; however, students must check accuracy.",
      [
        "however",
        "students",
        "information",
        "academic"
      ],
      0,
      "however signals contrast."
    ],
    [
      "Which signal word/phrase shows contrast?",
      "Although online learning is flexible, some students need face-to-face support.",
      [
        "although",
        "students",
        "information",
        "academic"
      ],
      0,
      "although signals contrast."
    ],
    [
      "Which signal word/phrase shows result?",
      "The evidence is limited; therefore, the conclusion should be cautious.",
      [
        "therefore",
        "students",
        "information",
        "academic"
      ],
      0,
      "therefore signals result."
    ],
    [
      "Which signal word/phrase shows result?",
      "The instructions were unclear; as a result, many students submitted the wrong file.",
      [
        "as a result",
        "students",
        "information",
        "academic"
      ],
      0,
      "as a result signals result."
    ],
    [
      "Which signal word/phrase shows cause?",
      "Students misunderstood the article because they focused only on examples.",
      [
        "because",
        "students",
        "information",
        "academic"
      ],
      0,
      "because signals cause."
    ],
    [
      "Which signal word/phrase shows cause?",
      "The score improved due to weekly practice.",
      [
        "due to",
        "students",
        "information",
        "academic"
      ],
      0,
      "due to signals cause."
    ],
    [
      "Which signal word/phrase shows example?",
      "Students can use academic tools, for example, citation managers.",
      [
        "for example",
        "students",
        "information",
        "academic"
      ],
      0,
      "for example signals example."
    ],
    [
      "Which signal word/phrase shows example?",
      "Digital tools, such as dictionaries and flashcards, can support vocabulary learning.",
      [
        "such as",
        "students",
        "information",
        "academic"
      ],
      0,
      "such as signals example."
    ],
    [
      "Which signal word/phrase shows addition?",
      "The app provides practice; moreover, it gives immediate feedback.",
      [
        "moreover",
        "students",
        "information",
        "academic"
      ],
      0,
      "moreover signals addition."
    ]
  ],
  "5": [
    [
      "Classify this statement.",
      "The official university website states that registration closes on June 30.",
      [
        "Fact",
        "Opinion",
        "Claim",
        "Evidence"
      ],
      0,
      "This is best classified as Fact."
    ],
    [
      "Classify this statement.",
      "The survey of 420 students found that 61% used AI tools for drafting.",
      [
        "Evidence",
        "Fact",
        "Opinion",
        "Claim"
      ],
      0,
      "This is best classified as Evidence."
    ],
    [
      "Classify this statement.",
      "Online learning may improve students’ independence.",
      [
        "Claim",
        "Fact",
        "Opinion",
        "Evidence"
      ],
      0,
      "This is best classified as Claim."
    ],
    [
      "Classify this statement.",
      "I believe mobile learning is more convenient than classroom learning.",
      [
        "Opinion",
        "Fact",
        "Claim",
        "Evidence"
      ],
      0,
      "This is best classified as Opinion."
    ],
    [
      "Classify this statement.",
      "The report was published by the Ministry in 2025.",
      [
        "Fact",
        "Opinion",
        "Claim",
        "Evidence"
      ],
      0,
      "This is best classified as Fact."
    ],
    [
      "Classify this statement.",
      "According to the article, participants completed a 10-item questionnaire.",
      [
        "Evidence",
        "Fact",
        "Opinion",
        "Claim"
      ],
      0,
      "This is best classified as Evidence."
    ],
    [
      "Classify this statement.",
      "Social media always reduces students’ concentration.",
      [
        "Claim",
        "Fact",
        "Opinion",
        "Evidence"
      ],
      0,
      "This is best classified as Claim."
    ],
    [
      "Classify this statement.",
      "In my opinion, citation software is difficult to use.",
      [
        "Opinion",
        "Fact",
        "Claim",
        "Evidence"
      ],
      0,
      "This is best classified as Opinion."
    ],
    [
      "Classify this statement.",
      "The table shows that Group A scored 12 points higher than Group B.",
      [
        "Evidence",
        "Fact",
        "Opinion",
        "Claim"
      ],
      0,
      "This is best classified as Evidence."
    ],
    [
      "Classify this statement.",
      "Digital literacy training can reduce misinformation sharing.",
      [
        "Claim",
        "Fact",
        "Opinion",
        "Evidence"
      ],
      0,
      "This is best classified as Claim."
    ],
    [
      "Classify this statement.",
      "The official university website states that registration closes on June 30.",
      [
        "Fact",
        "Opinion",
        "Claim",
        "Evidence"
      ],
      0,
      "This is best classified as Fact."
    ],
    [
      "Classify this statement.",
      "The survey of 420 students found that 61% used AI tools for drafting.",
      [
        "Evidence",
        "Fact",
        "Opinion",
        "Claim"
      ],
      0,
      "This is best classified as Evidence."
    ],
    [
      "Classify this statement.",
      "Online learning may improve students’ independence.",
      [
        "Claim",
        "Fact",
        "Opinion",
        "Evidence"
      ],
      0,
      "This is best classified as Claim."
    ],
    [
      "Classify this statement.",
      "I believe mobile learning is more convenient than classroom learning.",
      [
        "Opinion",
        "Fact",
        "Claim",
        "Evidence"
      ],
      0,
      "This is best classified as Opinion."
    ],
    [
      "Classify this statement.",
      "The report was published by the Ministry in 2025.",
      [
        "Fact",
        "Opinion",
        "Claim",
        "Evidence"
      ],
      0,
      "This is best classified as Fact."
    ],
    [
      "Classify this statement.",
      "According to the article, participants completed a 10-item questionnaire.",
      [
        "Evidence",
        "Fact",
        "Opinion",
        "Claim"
      ],
      0,
      "This is best classified as Evidence."
    ],
    [
      "Classify this statement.",
      "Social media always reduces students’ concentration.",
      [
        "Claim",
        "Fact",
        "Opinion",
        "Evidence"
      ],
      0,
      "This is best classified as Claim."
    ],
    [
      "Classify this statement.",
      "In my opinion, citation software is difficult to use.",
      [
        "Opinion",
        "Fact",
        "Claim",
        "Evidence"
      ],
      0,
      "This is best classified as Opinion."
    ],
    [
      "Classify this statement.",
      "The table shows that Group A scored 12 points higher than Group B.",
      [
        "Evidence",
        "Fact",
        "Opinion",
        "Claim"
      ],
      0,
      "This is best classified as Evidence."
    ],
    [
      "Classify this statement.",
      "Digital literacy training can reduce misinformation sharing.",
      [
        "Claim",
        "Fact",
        "Opinion",
        "Evidence"
      ],
      0,
      "This is best classified as Claim."
    ],
    [
      "Classify this statement.",
      "The official university website states that registration closes on June 30.",
      [
        "Fact",
        "Opinion",
        "Claim",
        "Evidence"
      ],
      0,
      "This is best classified as Fact."
    ],
    [
      "Classify this statement.",
      "The survey of 420 students found that 61% used AI tools for drafting.",
      [
        "Evidence",
        "Fact",
        "Opinion",
        "Claim"
      ],
      0,
      "This is best classified as Evidence."
    ],
    [
      "Classify this statement.",
      "Online learning may improve students’ independence.",
      [
        "Claim",
        "Fact",
        "Opinion",
        "Evidence"
      ],
      0,
      "This is best classified as Claim."
    ],
    [
      "Classify this statement.",
      "I believe mobile learning is more convenient than classroom learning.",
      [
        "Opinion",
        "Fact",
        "Claim",
        "Evidence"
      ],
      0,
      "This is best classified as Opinion."
    ],
    [
      "Classify this statement.",
      "The report was published by the Ministry in 2025.",
      [
        "Fact",
        "Opinion",
        "Claim",
        "Evidence"
      ],
      0,
      "This is best classified as Fact."
    ],
    [
      "Classify this statement.",
      "According to the article, participants completed a 10-item questionnaire.",
      [
        "Evidence",
        "Fact",
        "Opinion",
        "Claim"
      ],
      0,
      "This is best classified as Evidence."
    ],
    [
      "Classify this statement.",
      "Social media always reduces students’ concentration.",
      [
        "Claim",
        "Fact",
        "Opinion",
        "Evidence"
      ],
      0,
      "This is best classified as Claim."
    ],
    [
      "Classify this statement.",
      "In my opinion, citation software is difficult to use.",
      [
        "Opinion",
        "Fact",
        "Claim",
        "Evidence"
      ],
      0,
      "This is best classified as Opinion."
    ],
    [
      "Classify this statement.",
      "The table shows that Group A scored 12 points higher than Group B.",
      [
        "Evidence",
        "Fact",
        "Opinion",
        "Claim"
      ],
      0,
      "This is best classified as Evidence."
    ],
    [
      "Classify this statement.",
      "Digital literacy training can reduce misinformation sharing.",
      [
        "Claim",
        "Fact",
        "Opinion",
        "Evidence"
      ],
      0,
      "This is best classified as Claim."
    ],
    [
      "Classify this statement.",
      "The official university website states that registration closes on June 30.",
      [
        "Fact",
        "Opinion",
        "Claim",
        "Evidence"
      ],
      0,
      "This is best classified as Fact."
    ],
    [
      "Classify this statement.",
      "The survey of 420 students found that 61% used AI tools for drafting.",
      [
        "Evidence",
        "Fact",
        "Opinion",
        "Claim"
      ],
      0,
      "This is best classified as Evidence."
    ],
    [
      "Classify this statement.",
      "Online learning may improve students’ independence.",
      [
        "Claim",
        "Fact",
        "Opinion",
        "Evidence"
      ],
      0,
      "This is best classified as Claim."
    ],
    [
      "Classify this statement.",
      "I believe mobile learning is more convenient than classroom learning.",
      [
        "Opinion",
        "Fact",
        "Claim",
        "Evidence"
      ],
      0,
      "This is best classified as Opinion."
    ],
    [
      "Classify this statement.",
      "The report was published by the Ministry in 2025.",
      [
        "Fact",
        "Opinion",
        "Claim",
        "Evidence"
      ],
      0,
      "This is best classified as Fact."
    ],
    [
      "Classify this statement.",
      "According to the article, participants completed a 10-item questionnaire.",
      [
        "Evidence",
        "Fact",
        "Opinion",
        "Claim"
      ],
      0,
      "This is best classified as Evidence."
    ],
    [
      "Classify this statement.",
      "Social media always reduces students’ concentration.",
      [
        "Claim",
        "Fact",
        "Opinion",
        "Evidence"
      ],
      0,
      "This is best classified as Claim."
    ],
    [
      "Classify this statement.",
      "In my opinion, citation software is difficult to use.",
      [
        "Opinion",
        "Fact",
        "Claim",
        "Evidence"
      ],
      0,
      "This is best classified as Opinion."
    ],
    [
      "Classify this statement.",
      "The table shows that Group A scored 12 points higher than Group B.",
      [
        "Evidence",
        "Fact",
        "Opinion",
        "Claim"
      ],
      0,
      "This is best classified as Evidence."
    ],
    [
      "Classify this statement.",
      "Digital literacy training can reduce misinformation sharing.",
      [
        "Claim",
        "Fact",
        "Opinion",
        "Evidence"
      ],
      0,
      "This is best classified as Claim."
    ],
    [
      "Classify this statement.",
      "The official university website states that registration closes on June 30.",
      [
        "Fact",
        "Opinion",
        "Claim",
        "Evidence"
      ],
      0,
      "This is best classified as Fact."
    ],
    [
      "Classify this statement.",
      "The survey of 420 students found that 61% used AI tools for drafting.",
      [
        "Evidence",
        "Fact",
        "Opinion",
        "Claim"
      ],
      0,
      "This is best classified as Evidence."
    ],
    [
      "Classify this statement.",
      "Online learning may improve students’ independence.",
      [
        "Claim",
        "Fact",
        "Opinion",
        "Evidence"
      ],
      0,
      "This is best classified as Claim."
    ],
    [
      "Classify this statement.",
      "I believe mobile learning is more convenient than classroom learning.",
      [
        "Opinion",
        "Fact",
        "Claim",
        "Evidence"
      ],
      0,
      "This is best classified as Opinion."
    ],
    [
      "Classify this statement.",
      "The report was published by the Ministry in 2025.",
      [
        "Fact",
        "Opinion",
        "Claim",
        "Evidence"
      ],
      0,
      "This is best classified as Fact."
    ]
  ],
  "6": [
    [
      "Choose the best summary.",
      "Original: Digital literacy helps students evaluate sources and communicate responsibly online.",
      [
        "Digital literacy supports responsible online evaluation and communication.",
        "Digital literacy helps students evaluate sources and communicate responsibly online.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Peer feedback can help students revise unclear ideas and improve paragraph organization.",
      [
        "Peer feedback can improve writing clarity and organization.",
        "Peer feedback can help students revise unclear ideas and improve paragraph organization.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Exercise may reduce stress and improve sleep quality among university students.",
      [
        "Exercise may support students’ well-being.",
        "Exercise may reduce stress and improve sleep quality among university students.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Citation allows readers to locate the sources used in academic work.",
      [
        "Citation helps readers trace academic sources.",
        "Citation allows readers to locate the sources used in academic work.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Online learning platforms provide tools that help students study outside the classroom.",
      [
        "Online platforms support learning beyond class time.",
        "Online learning platforms provide tools that help students study outside the classroom.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Critical reading helps students check claims before accepting information.",
      [
        "Critical reading supports careful evaluation of claims.",
        "Critical reading helps students check claims before accepting information.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Academic presentations require clear structure and evidence.",
      [
        "Academic presentations need organization and support.",
        "Academic presentations require clear structure and evidence.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Data description should highlight major trends instead of listing every value.",
      [
        "Data description should focus on major trends.",
        "Data description should highlight major trends instead of listing every value.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Responsible AI use requires checking outputs and acknowledging assistance when required.",
      [
        "Responsible AI use involves verification and transparency.",
        "Responsible AI use requires checking outputs and acknowledging assistance when required.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Academic email should be polite, clear, and specific.",
      [
        "Academic email requires respectful and clear communication.",
        "Academic email should be polite, clear, and specific.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Digital literacy helps students evaluate sources and communicate responsibly online.",
      [
        "Digital literacy supports responsible online evaluation and communication.",
        "Digital literacy helps students evaluate sources and communicate responsibly online.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Peer feedback can help students revise unclear ideas and improve paragraph organization.",
      [
        "Peer feedback can improve writing clarity and organization.",
        "Peer feedback can help students revise unclear ideas and improve paragraph organization.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Exercise may reduce stress and improve sleep quality among university students.",
      [
        "Exercise may support students’ well-being.",
        "Exercise may reduce stress and improve sleep quality among university students.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Citation allows readers to locate the sources used in academic work.",
      [
        "Citation helps readers trace academic sources.",
        "Citation allows readers to locate the sources used in academic work.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Online learning platforms provide tools that help students study outside the classroom.",
      [
        "Online platforms support learning beyond class time.",
        "Online learning platforms provide tools that help students study outside the classroom.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Critical reading helps students check claims before accepting information.",
      [
        "Critical reading supports careful evaluation of claims.",
        "Critical reading helps students check claims before accepting information.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Academic presentations require clear structure and evidence.",
      [
        "Academic presentations need organization and support.",
        "Academic presentations require clear structure and evidence.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Data description should highlight major trends instead of listing every value.",
      [
        "Data description should focus on major trends.",
        "Data description should highlight major trends instead of listing every value.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Responsible AI use requires checking outputs and acknowledging assistance when required.",
      [
        "Responsible AI use involves verification and transparency.",
        "Responsible AI use requires checking outputs and acknowledging assistance when required.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Academic email should be polite, clear, and specific.",
      [
        "Academic email requires respectful and clear communication.",
        "Academic email should be polite, clear, and specific.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Digital literacy helps students evaluate sources and communicate responsibly online.",
      [
        "Digital literacy supports responsible online evaluation and communication.",
        "Digital literacy helps students evaluate sources and communicate responsibly online.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Peer feedback can help students revise unclear ideas and improve paragraph organization.",
      [
        "Peer feedback can improve writing clarity and organization.",
        "Peer feedback can help students revise unclear ideas and improve paragraph organization.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Exercise may reduce stress and improve sleep quality among university students.",
      [
        "Exercise may support students’ well-being.",
        "Exercise may reduce stress and improve sleep quality among university students.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Citation allows readers to locate the sources used in academic work.",
      [
        "Citation helps readers trace academic sources.",
        "Citation allows readers to locate the sources used in academic work.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Online learning platforms provide tools that help students study outside the classroom.",
      [
        "Online platforms support learning beyond class time.",
        "Online learning platforms provide tools that help students study outside the classroom.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Critical reading helps students check claims before accepting information.",
      [
        "Critical reading supports careful evaluation of claims.",
        "Critical reading helps students check claims before accepting information.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Academic presentations require clear structure and evidence.",
      [
        "Academic presentations need organization and support.",
        "Academic presentations require clear structure and evidence.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Data description should highlight major trends instead of listing every value.",
      [
        "Data description should focus on major trends.",
        "Data description should highlight major trends instead of listing every value.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Responsible AI use requires checking outputs and acknowledging assistance when required.",
      [
        "Responsible AI use involves verification and transparency.",
        "Responsible AI use requires checking outputs and acknowledging assistance when required.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Academic email should be polite, clear, and specific.",
      [
        "Academic email requires respectful and clear communication.",
        "Academic email should be polite, clear, and specific.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Digital literacy helps students evaluate sources and communicate responsibly online.",
      [
        "Digital literacy supports responsible online evaluation and communication.",
        "Digital literacy helps students evaluate sources and communicate responsibly online.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Peer feedback can help students revise unclear ideas and improve paragraph organization.",
      [
        "Peer feedback can improve writing clarity and organization.",
        "Peer feedback can help students revise unclear ideas and improve paragraph organization.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Exercise may reduce stress and improve sleep quality among university students.",
      [
        "Exercise may support students’ well-being.",
        "Exercise may reduce stress and improve sleep quality among university students.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Citation allows readers to locate the sources used in academic work.",
      [
        "Citation helps readers trace academic sources.",
        "Citation allows readers to locate the sources used in academic work.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Online learning platforms provide tools that help students study outside the classroom.",
      [
        "Online platforms support learning beyond class time.",
        "Online learning platforms provide tools that help students study outside the classroom.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Critical reading helps students check claims before accepting information.",
      [
        "Critical reading supports careful evaluation of claims.",
        "Critical reading helps students check claims before accepting information.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Academic presentations require clear structure and evidence.",
      [
        "Academic presentations need organization and support.",
        "Academic presentations require clear structure and evidence.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Data description should highlight major trends instead of listing every value.",
      [
        "Data description should focus on major trends.",
        "Data description should highlight major trends instead of listing every value.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Responsible AI use requires checking outputs and acknowledging assistance when required.",
      [
        "Responsible AI use involves verification and transparency.",
        "Responsible AI use requires checking outputs and acknowledging assistance when required.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Academic email should be polite, clear, and specific.",
      [
        "Academic email requires respectful and clear communication.",
        "Academic email should be polite, clear, and specific.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Digital literacy helps students evaluate sources and communicate responsibly online.",
      [
        "Digital literacy supports responsible online evaluation and communication.",
        "Digital literacy helps students evaluate sources and communicate responsibly online.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Peer feedback can help students revise unclear ideas and improve paragraph organization.",
      [
        "Peer feedback can improve writing clarity and organization.",
        "Peer feedback can help students revise unclear ideas and improve paragraph organization.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Exercise may reduce stress and improve sleep quality among university students.",
      [
        "Exercise may support students’ well-being.",
        "Exercise may reduce stress and improve sleep quality among university students.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Citation allows readers to locate the sources used in academic work.",
      [
        "Citation helps readers trace academic sources.",
        "Citation allows readers to locate the sources used in academic work.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Online learning platforms provide tools that help students study outside the classroom.",
      [
        "Online platforms support learning beyond class time.",
        "Online learning platforms provide tools that help students study outside the classroom.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ]
  ],
  "7": [
    [
      "Choose the academic version.",
      "Informal: AI is super useful for students.",
      [
        "Artificial intelligence may support students’ learning processes.",
        "AI is super useful for students.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: This source is kind of bad.",
      [
        "This source may not be reliable.",
        "This source is kind of bad.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: Lots of students use phones in class.",
      [
        "Many students use mobile phones in class.",
        "Lots of students use phones in class.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: The data looks weird.",
      [
        "The data appear inconsistent.",
        "The data looks weird.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: This problem is huge.",
      [
        "This issue is significant.",
        "This problem is huge.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: The writer talks about AI stuff.",
      [
        "The author discusses issues related to artificial intelligence.",
        "The writer talks about AI stuff.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: People should not believe random posts.",
      [
        "Users should evaluate online posts before accepting them as reliable.",
        "People should not believe random posts.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: The class helped a lot.",
      [
        "The session was beneficial for developing academic skills.",
        "The class helped a lot.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: Social media makes students waste time.",
      [
        "Excessive social media use may reduce students’ study time.",
        "Social media makes students waste time.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: The result was really bad.",
      [
        "The result indicated a negative outcome.",
        "The result was really bad.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: AI is super useful for students.",
      [
        "Artificial intelligence may support students’ learning processes.",
        "AI is super useful for students.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: This source is kind of bad.",
      [
        "This source may not be reliable.",
        "This source is kind of bad.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: Lots of students use phones in class.",
      [
        "Many students use mobile phones in class.",
        "Lots of students use phones in class.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: The data looks weird.",
      [
        "The data appear inconsistent.",
        "The data looks weird.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: This problem is huge.",
      [
        "This issue is significant.",
        "This problem is huge.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: The writer talks about AI stuff.",
      [
        "The author discusses issues related to artificial intelligence.",
        "The writer talks about AI stuff.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: People should not believe random posts.",
      [
        "Users should evaluate online posts before accepting them as reliable.",
        "People should not believe random posts.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: The class helped a lot.",
      [
        "The session was beneficial for developing academic skills.",
        "The class helped a lot.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: Social media makes students waste time.",
      [
        "Excessive social media use may reduce students’ study time.",
        "Social media makes students waste time.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: The result was really bad.",
      [
        "The result indicated a negative outcome.",
        "The result was really bad.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: AI is super useful for students.",
      [
        "Artificial intelligence may support students’ learning processes.",
        "AI is super useful for students.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: This source is kind of bad.",
      [
        "This source may not be reliable.",
        "This source is kind of bad.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: Lots of students use phones in class.",
      [
        "Many students use mobile phones in class.",
        "Lots of students use phones in class.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: The data looks weird.",
      [
        "The data appear inconsistent.",
        "The data looks weird.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: This problem is huge.",
      [
        "This issue is significant.",
        "This problem is huge.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: The writer talks about AI stuff.",
      [
        "The author discusses issues related to artificial intelligence.",
        "The writer talks about AI stuff.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: People should not believe random posts.",
      [
        "Users should evaluate online posts before accepting them as reliable.",
        "People should not believe random posts.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: The class helped a lot.",
      [
        "The session was beneficial for developing academic skills.",
        "The class helped a lot.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: Social media makes students waste time.",
      [
        "Excessive social media use may reduce students’ study time.",
        "Social media makes students waste time.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: The result was really bad.",
      [
        "The result indicated a negative outcome.",
        "The result was really bad.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: AI is super useful for students.",
      [
        "Artificial intelligence may support students’ learning processes.",
        "AI is super useful for students.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: This source is kind of bad.",
      [
        "This source may not be reliable.",
        "This source is kind of bad.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: Lots of students use phones in class.",
      [
        "Many students use mobile phones in class.",
        "Lots of students use phones in class.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: The data looks weird.",
      [
        "The data appear inconsistent.",
        "The data looks weird.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: This problem is huge.",
      [
        "This issue is significant.",
        "This problem is huge.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: The writer talks about AI stuff.",
      [
        "The author discusses issues related to artificial intelligence.",
        "The writer talks about AI stuff.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: People should not believe random posts.",
      [
        "Users should evaluate online posts before accepting them as reliable.",
        "People should not believe random posts.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: The class helped a lot.",
      [
        "The session was beneficial for developing academic skills.",
        "The class helped a lot.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: Social media makes students waste time.",
      [
        "Excessive social media use may reduce students’ study time.",
        "Social media makes students waste time.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: The result was really bad.",
      [
        "The result indicated a negative outcome.",
        "The result was really bad.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: AI is super useful for students.",
      [
        "Artificial intelligence may support students’ learning processes.",
        "AI is super useful for students.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: This source is kind of bad.",
      [
        "This source may not be reliable.",
        "This source is kind of bad.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: Lots of students use phones in class.",
      [
        "Many students use mobile phones in class.",
        "Lots of students use phones in class.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: The data looks weird.",
      [
        "The data appear inconsistent.",
        "The data looks weird.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: This problem is huge.",
      [
        "This issue is significant.",
        "This problem is huge.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ]
  ],
  "8": [
    [
      "Choose the best word to complete the sentence.",
      "The researcher will ______ the interview data.",
      [
        "analyze",
        "evaluate",
        "evidence",
        "method"
      ],
      0,
      "analyze means examine information carefully."
    ],
    [
      "Which word means “judge the quality or value of something”?",
      "",
      [
        "evaluate",
        "significant",
        "conclusion",
        "therefore"
      ],
      0,
      "evaluate means judge the quality or value of something."
    ],
    [
      "Choose the most academic phrase.",
      "",
      [
        "The findings indicate that further study is needed.",
        "The results are kind of nice.",
        "The study says some stuff.",
        "The idea is pretty cool."
      ],
      0,
      "The correct option uses formal academic phrasing."
    ],
    [
      "Choose the best word to complete the sentence.",
      "The ______ section explains how participants were selected.",
      [
        "method",
        "result",
        "significant",
        "conclusion"
      ],
      0,
      "method means the procedure used in a study."
    ],
    [
      "Which word means “what is found after a study or activity”?",
      "",
      [
        "result",
        "however",
        "source",
        "claim"
      ],
      0,
      "result means what is found after a study or activity."
    ],
    [
      "Choose the most academic phrase.",
      "",
      [
        "The findings indicate that further study is needed.",
        "The results are kind of nice.",
        "The study says some stuff.",
        "The idea is pretty cool."
      ],
      0,
      "The correct option uses formal academic phrasing."
    ],
    [
      "Choose the best word to complete the sentence.",
      "The ______ should connect back to the main argument.",
      [
        "conclusion",
        "therefore",
        "however",
        "source"
      ],
      0,
      "conclusion means the final idea or summary."
    ],
    [
      "Which word means “as a result”?",
      "",
      [
        "therefore",
        "consistent",
        "participant",
        "identify"
      ],
      0,
      "therefore means as a result."
    ],
    [
      "Choose the most academic phrase.",
      "",
      [
        "The findings indicate that further study is needed.",
        "The results are kind of nice.",
        "The study says some stuff.",
        "The idea is pretty cool."
      ],
      0,
      "The correct option uses formal academic phrasing."
    ],
    [
      "Choose the best word to complete the sentence.",
      "A credible ______ should include an author or organization.",
      [
        "source",
        "claim",
        "consistent",
        "participant"
      ],
      0,
      "source means where information comes from."
    ],
    [
      "What is the main idea?",
      "Digital literacy helps students evaluate sources and avoid misinformation. It also supports responsible communication online.",
      [
        "Digital literacy supports responsible evaluation of online information.",
        "The text mentions evaluating sources.",
        "Academic life is important for all students.",
        "The text gives an example about responsible communication."
      ],
      0,
      "The main idea covers the whole paragraph."
    ],
    [
      "Which option is only a supporting detail?",
      "Peer feedback helps writers notice unclear ideas. It can also improve paragraph organization before final submission.",
      [
        "The text mentions noticing unclear ideas.",
        "Peer feedback can improve writing clarity and organization.",
        "The topic is wider than university education.",
        "The paragraph has no main idea."
      ],
      0,
      "A detail supports the main idea but does not cover the whole paragraph."
    ],
    [
      "Which option is too broad?",
      "Regular reading practice can improve vocabulary and comprehension. Students who read often become more familiar with academic sentence patterns.",
      [
        "Education and society are important.",
        "Regular reading practice supports vocabulary and comprehension.",
        "The text mentions reading often.",
        "The writer gives information about academic sentence patterns."
      ],
      0,
      "A too-broad option is more general than the paragraph."
    ],
    [
      "Which option is irrelevant?",
      "Citation helps readers find the original sources of information. It also shows that writers respect academic integrity.",
      [
        "Choosing colorful slide backgrounds improves design.",
        "Citation supports source tracing and academic integrity.",
        "The text mentions finding original sources.",
        "The text discusses respecting integrity."
      ],
      0,
      "An irrelevant option is not connected to the paragraph."
    ],
    [
      "What is the main idea?",
      "Online learning platforms provide videos, quizzes, and feedback. These tools help students practice outside class.",
      [
        "Online learning platforms support practice beyond the classroom.",
        "The text mentions videos and quizzes.",
        "Academic life is important for all students.",
        "The text gives an example about feedback."
      ],
      0,
      "The main idea covers the whole paragraph."
    ],
    [
      "Which option is only a supporting detail?",
      "Academic presentations need clear structure. Signposting phrases help audiences follow the speaker’s ideas.",
      [
        "The text mentions signposting phrases.",
        "Clear structure and signposting support academic presentations.",
        "The topic is wider than university education.",
        "The paragraph has no main idea."
      ],
      0,
      "A detail supports the main idea but does not cover the whole paragraph."
    ],
    [
      "Which option is too broad?",
      "Summarizing requires students to identify key points and restate them briefly. This skill helps students avoid copying too much from sources.",
      [
        "Education and society are important.",
        "Summarizing helps students express key ideas briefly and avoid copying.",
        "The text mentions avoiding copying.",
        "The writer gives information about identifying key points."
      ],
      0,
      "A too-broad option is more general than the paragraph."
    ],
    [
      "Which option is irrelevant?",
      "Data description should focus on major trends rather than every number. This helps readers understand the main pattern quickly.",
      [
        "Choosing colorful slide backgrounds improves design.",
        "Data description should highlight major trends.",
        "The text mentions major trends.",
        "The text discusses every number."
      ],
      0,
      "An irrelevant option is not connected to the paragraph."
    ],
    [
      "What is the main idea?",
      "Academic email should be polite and specific. A clear subject and respectful request help instructors respond effectively.",
      [
        "Academic email requires polite and clear communication.",
        "The text mentions clear subject.",
        "Academic life is important for all students.",
        "The text gives an example about respectful request."
      ],
      0,
      "The main idea covers the whole paragraph."
    ],
    [
      "Which option is only a supporting detail?",
      "Critical reading requires checking claims and evidence. This skill is important when students read online information.",
      [
        "The text mentions checking claims.",
        "Critical reading helps students evaluate claims and evidence.",
        "The topic is wider than university education.",
        "The paragraph has no main idea."
      ],
      0,
      "A detail supports the main idea but does not cover the whole paragraph."
    ],
    [
      "Classify this statement.",
      "The official university website states that registration closes on June 30.",
      [
        "Fact",
        "Opinion",
        "Claim",
        "Evidence"
      ],
      0,
      "This is best classified as Fact."
    ],
    [
      "Classify this statement.",
      "The survey of 420 students found that 61% used AI tools for drafting.",
      [
        "Evidence",
        "Fact",
        "Opinion",
        "Claim"
      ],
      0,
      "This is best classified as Evidence."
    ],
    [
      "Classify this statement.",
      "Online learning may improve students’ independence.",
      [
        "Claim",
        "Fact",
        "Opinion",
        "Evidence"
      ],
      0,
      "This is best classified as Claim."
    ],
    [
      "Classify this statement.",
      "I believe mobile learning is more convenient than classroom learning.",
      [
        "Opinion",
        "Fact",
        "Claim",
        "Evidence"
      ],
      0,
      "This is best classified as Opinion."
    ],
    [
      "Classify this statement.",
      "The report was published by the Ministry in 2025.",
      [
        "Fact",
        "Opinion",
        "Claim",
        "Evidence"
      ],
      0,
      "This is best classified as Fact."
    ],
    [
      "Classify this statement.",
      "According to the article, participants completed a 10-item questionnaire.",
      [
        "Evidence",
        "Fact",
        "Opinion",
        "Claim"
      ],
      0,
      "This is best classified as Evidence."
    ],
    [
      "Classify this statement.",
      "Social media always reduces students’ concentration.",
      [
        "Claim",
        "Fact",
        "Opinion",
        "Evidence"
      ],
      0,
      "This is best classified as Claim."
    ],
    [
      "Classify this statement.",
      "In my opinion, citation software is difficult to use.",
      [
        "Opinion",
        "Fact",
        "Claim",
        "Evidence"
      ],
      0,
      "This is best classified as Opinion."
    ],
    [
      "Classify this statement.",
      "The table shows that Group A scored 12 points higher than Group B.",
      [
        "Evidence",
        "Fact",
        "Opinion",
        "Claim"
      ],
      0,
      "This is best classified as Evidence."
    ],
    [
      "Classify this statement.",
      "Digital literacy training can reduce misinformation sharing.",
      [
        "Claim",
        "Fact",
        "Opinion",
        "Evidence"
      ],
      0,
      "This is best classified as Claim."
    ],
    [
      "Choose the best summary.",
      "Original: Digital literacy helps students evaluate sources and communicate responsibly online.",
      [
        "Digital literacy supports responsible online evaluation and communication.",
        "Digital literacy helps students evaluate sources and communicate responsibly online.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Peer feedback can help students revise unclear ideas and improve paragraph organization.",
      [
        "Peer feedback can improve writing clarity and organization.",
        "Peer feedback can help students revise unclear ideas and improve paragraph organization.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Exercise may reduce stress and improve sleep quality among university students.",
      [
        "Exercise may support students’ well-being.",
        "Exercise may reduce stress and improve sleep quality among university students.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Citation allows readers to locate the sources used in academic work.",
      [
        "Citation helps readers trace academic sources.",
        "Citation allows readers to locate the sources used in academic work.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Online learning platforms provide tools that help students study outside the classroom.",
      [
        "Online platforms support learning beyond class time.",
        "Online learning platforms provide tools that help students study outside the classroom.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Critical reading helps students check claims before accepting information.",
      [
        "Critical reading supports careful evaluation of claims.",
        "Critical reading helps students check claims before accepting information.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Academic presentations require clear structure and evidence.",
      [
        "Academic presentations need organization and support.",
        "Academic presentations require clear structure and evidence.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the best summary.",
      "Original: Data description should highlight major trends instead of listing every value.",
      [
        "Data description should focus on major trends.",
        "Data description should highlight major trends instead of listing every value.",
        "The topic is important for students.",
        "This issue is always positive and has no limitations."
      ],
      0,
      "The best summary is shorter, accurate, and not copied word-for-word."
    ],
    [
      "Choose the academic version.",
      "Informal: AI is super useful for students.",
      [
        "Artificial intelligence may support students’ learning processes.",
        "AI is super useful for students.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: This source is kind of bad.",
      [
        "This source may not be reliable.",
        "This source is kind of bad.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: Lots of students use phones in class.",
      [
        "Many students use mobile phones in class.",
        "Lots of students use phones in class.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: The data looks weird.",
      [
        "The data appear inconsistent.",
        "The data looks weird.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: This problem is huge.",
      [
        "This issue is significant.",
        "This problem is huge.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: The writer talks about AI stuff.",
      [
        "The author discusses issues related to artificial intelligence.",
        "The writer talks about AI stuff.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ],
    [
      "Choose the academic version.",
      "Informal: People should not believe random posts.",
      [
        "Users should evaluate online posts before accepting them as reliable.",
        "People should not believe random posts.",
        "This is very good and nice.",
        "The thing is kind of important."
      ],
      0,
      "Academic tone should be formal, precise, and cautious."
    ]
  ],
  "9": [
    [
      "Choose the best topic sentence.",
      "Topic: Online learning",
      [
        "Online learning can support flexible study for university students.",
        "Students can access videos and quizzes outside class.",
        "Online learning is a term.",
        "Some students have assignments."
      ],
      0,
      "A topic sentence states the main idea of the paragraph."
    ],
    [
      "Choose the best supporting detail.",
      "Topic sentence: Digital literacy is essential for responsible online learning.",
      [
        "Students can evaluate sources before sharing information.",
        "Digital literacy is common.",
        "Students sometimes study.",
        "There are many examples."
      ],
      0,
      "A supporting detail explains or supports the topic sentence."
    ],
    [
      "Choose the best concluding sentence.",
      "Paragraph topic: Peer feedback",
      [
        "Therefore, peer feedback should be considered carefully in academic contexts.",
        "Classmates may identify unclear ideas in a draft.",
        "This is one small example.",
        "The next sentence starts another topic."
      ],
      0,
      "A conclusion closes the paragraph and connects to the main idea."
    ],
    [
      "Which sentence does NOT fit this paragraph topic?",
      "Topic: Exercise",
      [
        "The cafeteria menu changed last week.",
        "Regular exercise can support students’ physical and mental health.",
        "Studies suggest that exercise may reduce stress.",
        "This example relates to exercise."
      ],
      0,
      "An irrelevant sentence does not fit the paragraph topic."
    ],
    [
      "Choose the best topic sentence.",
      "Topic: Citation",
      [
        "Citation is important for academic integrity.",
        "It allows readers to locate the original sources.",
        "Citation is a term.",
        "Some students have assignments."
      ],
      0,
      "A topic sentence states the main idea of the paragraph."
    ],
    [
      "Choose the best supporting detail.",
      "Topic sentence: AI tools may support learning when used responsibly.",
      [
        "Students should check the accuracy of AI-generated content.",
        "AI tools is common.",
        "Students sometimes study.",
        "There are many examples."
      ],
      0,
      "A supporting detail explains or supports the topic sentence."
    ],
    [
      "Choose the best concluding sentence.",
      "Paragraph topic: Academic email",
      [
        "Therefore, academic email should be considered carefully in academic contexts.",
        "A specific subject line helps the reader understand the purpose.",
        "This is one small example.",
        "The next sentence starts another topic."
      ],
      0,
      "A conclusion closes the paragraph and connects to the main idea."
    ],
    [
      "Which sentence does NOT fit this paragraph topic?",
      "Topic: Presentation",
      [
        "The cafeteria menu changed last week.",
        "Clear signposting improves academic presentations.",
        "Phrases such as first and in conclusion help audiences follow the structure.",
        "This example relates to presentation."
      ],
      0,
      "An irrelevant sentence does not fit the paragraph topic."
    ],
    [
      "Choose the best topic sentence.",
      "Topic: Data description",
      [
        "Data description should highlight major trends.",
        "Writers should compare important values instead of listing every number.",
        "Data description is a term.",
        "Some students have assignments."
      ],
      0,
      "A topic sentence states the main idea of the paragraph."
    ],
    [
      "Choose the best supporting detail.",
      "Topic sentence: Critical reading helps students evaluate information.",
      [
        "Readers should check claims, evidence, and source credibility.",
        "Critical reading is common.",
        "Students sometimes study.",
        "There are many examples."
      ],
      0,
      "A supporting detail explains or supports the topic sentence."
    ],
    [
      "Choose the best concluding sentence.",
      "Paragraph topic: Online learning",
      [
        "Therefore, online learning should be considered carefully in academic contexts.",
        "Students can access videos and quizzes outside class.",
        "This is one small example.",
        "The next sentence starts another topic."
      ],
      0,
      "A conclusion closes the paragraph and connects to the main idea."
    ],
    [
      "Which sentence does NOT fit this paragraph topic?",
      "Topic: Digital literacy",
      [
        "The cafeteria menu changed last week.",
        "Digital literacy is essential for responsible online learning.",
        "Students can evaluate sources before sharing information.",
        "This example relates to digital literacy."
      ],
      0,
      "An irrelevant sentence does not fit the paragraph topic."
    ],
    [
      "Choose the best topic sentence.",
      "Topic: Peer feedback",
      [
        "Peer feedback can improve students’ academic writing.",
        "Classmates may identify unclear ideas in a draft.",
        "Peer feedback is a term.",
        "Some students have assignments."
      ],
      0,
      "A topic sentence states the main idea of the paragraph."
    ],
    [
      "Choose the best supporting detail.",
      "Topic sentence: Regular exercise can support students’ physical and mental health.",
      [
        "Studies suggest that exercise may reduce stress.",
        "Exercise is common.",
        "Students sometimes study.",
        "There are many examples."
      ],
      0,
      "A supporting detail explains or supports the topic sentence."
    ],
    [
      "Choose the best concluding sentence.",
      "Paragraph topic: Citation",
      [
        "Therefore, citation should be considered carefully in academic contexts.",
        "It allows readers to locate the original sources.",
        "This is one small example.",
        "The next sentence starts another topic."
      ],
      0,
      "A conclusion closes the paragraph and connects to the main idea."
    ],
    [
      "Which sentence does NOT fit this paragraph topic?",
      "Topic: AI tools",
      [
        "The cafeteria menu changed last week.",
        "AI tools may support learning when used responsibly.",
        "Students should check the accuracy of AI-generated content.",
        "This example relates to ai tools."
      ],
      0,
      "An irrelevant sentence does not fit the paragraph topic."
    ],
    [
      "Choose the best topic sentence.",
      "Topic: Academic email",
      [
        "Academic email requires polite and clear communication.",
        "A specific subject line helps the reader understand the purpose.",
        "Academic email is a term.",
        "Some students have assignments."
      ],
      0,
      "A topic sentence states the main idea of the paragraph."
    ],
    [
      "Choose the best supporting detail.",
      "Topic sentence: Clear signposting improves academic presentations.",
      [
        "Phrases such as first and in conclusion help audiences follow the structure.",
        "Presentation is common.",
        "Students sometimes study.",
        "There are many examples."
      ],
      0,
      "A supporting detail explains or supports the topic sentence."
    ],
    [
      "Choose the best concluding sentence.",
      "Paragraph topic: Data description",
      [
        "Therefore, data description should be considered carefully in academic contexts.",
        "Writers should compare important values instead of listing every number.",
        "This is one small example.",
        "The next sentence starts another topic."
      ],
      0,
      "A conclusion closes the paragraph and connects to the main idea."
    ],
    [
      "Which sentence does NOT fit this paragraph topic?",
      "Topic: Critical reading",
      [
        "The cafeteria menu changed last week.",
        "Critical reading helps students evaluate information.",
        "Readers should check claims, evidence, and source credibility.",
        "This example relates to critical reading."
      ],
      0,
      "An irrelevant sentence does not fit the paragraph topic."
    ],
    [
      "Choose the best topic sentence.",
      "Topic: Online learning",
      [
        "Online learning can support flexible study for university students.",
        "Students can access videos and quizzes outside class.",
        "Online learning is a term.",
        "Some students have assignments."
      ],
      0,
      "A topic sentence states the main idea of the paragraph."
    ],
    [
      "Choose the best supporting detail.",
      "Topic sentence: Digital literacy is essential for responsible online learning.",
      [
        "Students can evaluate sources before sharing information.",
        "Digital literacy is common.",
        "Students sometimes study.",
        "There are many examples."
      ],
      0,
      "A supporting detail explains or supports the topic sentence."
    ],
    [
      "Choose the best concluding sentence.",
      "Paragraph topic: Peer feedback",
      [
        "Therefore, peer feedback should be considered carefully in academic contexts.",
        "Classmates may identify unclear ideas in a draft.",
        "This is one small example.",
        "The next sentence starts another topic."
      ],
      0,
      "A conclusion closes the paragraph and connects to the main idea."
    ],
    [
      "Which sentence does NOT fit this paragraph topic?",
      "Topic: Exercise",
      [
        "The cafeteria menu changed last week.",
        "Regular exercise can support students’ physical and mental health.",
        "Studies suggest that exercise may reduce stress.",
        "This example relates to exercise."
      ],
      0,
      "An irrelevant sentence does not fit the paragraph topic."
    ],
    [
      "Choose the best topic sentence.",
      "Topic: Citation",
      [
        "Citation is important for academic integrity.",
        "It allows readers to locate the original sources.",
        "Citation is a term.",
        "Some students have assignments."
      ],
      0,
      "A topic sentence states the main idea of the paragraph."
    ],
    [
      "Choose the best supporting detail.",
      "Topic sentence: AI tools may support learning when used responsibly.",
      [
        "Students should check the accuracy of AI-generated content.",
        "AI tools is common.",
        "Students sometimes study.",
        "There are many examples."
      ],
      0,
      "A supporting detail explains or supports the topic sentence."
    ],
    [
      "Choose the best concluding sentence.",
      "Paragraph topic: Academic email",
      [
        "Therefore, academic email should be considered carefully in academic contexts.",
        "A specific subject line helps the reader understand the purpose.",
        "This is one small example.",
        "The next sentence starts another topic."
      ],
      0,
      "A conclusion closes the paragraph and connects to the main idea."
    ],
    [
      "Which sentence does NOT fit this paragraph topic?",
      "Topic: Presentation",
      [
        "The cafeteria menu changed last week.",
        "Clear signposting improves academic presentations.",
        "Phrases such as first and in conclusion help audiences follow the structure.",
        "This example relates to presentation."
      ],
      0,
      "An irrelevant sentence does not fit the paragraph topic."
    ],
    [
      "Choose the best topic sentence.",
      "Topic: Data description",
      [
        "Data description should highlight major trends.",
        "Writers should compare important values instead of listing every number.",
        "Data description is a term.",
        "Some students have assignments."
      ],
      0,
      "A topic sentence states the main idea of the paragraph."
    ],
    [
      "Choose the best supporting detail.",
      "Topic sentence: Critical reading helps students evaluate information.",
      [
        "Readers should check claims, evidence, and source credibility.",
        "Critical reading is common.",
        "Students sometimes study.",
        "There are many examples."
      ],
      0,
      "A supporting detail explains or supports the topic sentence."
    ],
    [
      "Choose the best concluding sentence.",
      "Paragraph topic: Online learning",
      [
        "Therefore, online learning should be considered carefully in academic contexts.",
        "Students can access videos and quizzes outside class.",
        "This is one small example.",
        "The next sentence starts another topic."
      ],
      0,
      "A conclusion closes the paragraph and connects to the main idea."
    ],
    [
      "Which sentence does NOT fit this paragraph topic?",
      "Topic: Digital literacy",
      [
        "The cafeteria menu changed last week.",
        "Digital literacy is essential for responsible online learning.",
        "Students can evaluate sources before sharing information.",
        "This example relates to digital literacy."
      ],
      0,
      "An irrelevant sentence does not fit the paragraph topic."
    ],
    [
      "Choose the best topic sentence.",
      "Topic: Peer feedback",
      [
        "Peer feedback can improve students’ academic writing.",
        "Classmates may identify unclear ideas in a draft.",
        "Peer feedback is a term.",
        "Some students have assignments."
      ],
      0,
      "A topic sentence states the main idea of the paragraph."
    ],
    [
      "Choose the best supporting detail.",
      "Topic sentence: Regular exercise can support students’ physical and mental health.",
      [
        "Studies suggest that exercise may reduce stress.",
        "Exercise is common.",
        "Students sometimes study.",
        "There are many examples."
      ],
      0,
      "A supporting detail explains or supports the topic sentence."
    ],
    [
      "Choose the best concluding sentence.",
      "Paragraph topic: Citation",
      [
        "Therefore, citation should be considered carefully in academic contexts.",
        "It allows readers to locate the original sources.",
        "This is one small example.",
        "The next sentence starts another topic."
      ],
      0,
      "A conclusion closes the paragraph and connects to the main idea."
    ],
    [
      "Which sentence does NOT fit this paragraph topic?",
      "Topic: AI tools",
      [
        "The cafeteria menu changed last week.",
        "AI tools may support learning when used responsibly.",
        "Students should check the accuracy of AI-generated content.",
        "This example relates to ai tools."
      ],
      0,
      "An irrelevant sentence does not fit the paragraph topic."
    ],
    [
      "Choose the best topic sentence.",
      "Topic: Academic email",
      [
        "Academic email requires polite and clear communication.",
        "A specific subject line helps the reader understand the purpose.",
        "Academic email is a term.",
        "Some students have assignments."
      ],
      0,
      "A topic sentence states the main idea of the paragraph."
    ],
    [
      "Choose the best supporting detail.",
      "Topic sentence: Clear signposting improves academic presentations.",
      [
        "Phrases such as first and in conclusion help audiences follow the structure.",
        "Presentation is common.",
        "Students sometimes study.",
        "There are many examples."
      ],
      0,
      "A supporting detail explains or supports the topic sentence."
    ],
    [
      "Choose the best concluding sentence.",
      "Paragraph topic: Data description",
      [
        "Therefore, data description should be considered carefully in academic contexts.",
        "Writers should compare important values instead of listing every number.",
        "This is one small example.",
        "The next sentence starts another topic."
      ],
      0,
      "A conclusion closes the paragraph and connects to the main idea."
    ],
    [
      "Which sentence does NOT fit this paragraph topic?",
      "Topic: Critical reading",
      [
        "The cafeteria menu changed last week.",
        "Critical reading helps students evaluate information.",
        "Readers should check claims, evidence, and source credibility.",
        "This example relates to critical reading."
      ],
      0,
      "An irrelevant sentence does not fit the paragraph topic."
    ],
    [
      "Choose the best topic sentence.",
      "Topic: Online learning",
      [
        "Online learning can support flexible study for university students.",
        "Students can access videos and quizzes outside class.",
        "Online learning is a term.",
        "Some students have assignments."
      ],
      0,
      "A topic sentence states the main idea of the paragraph."
    ],
    [
      "Choose the best supporting detail.",
      "Topic sentence: Digital literacy is essential for responsible online learning.",
      [
        "Students can evaluate sources before sharing information.",
        "Digital literacy is common.",
        "Students sometimes study.",
        "There are many examples."
      ],
      0,
      "A supporting detail explains or supports the topic sentence."
    ],
    [
      "Choose the best concluding sentence.",
      "Paragraph topic: Peer feedback",
      [
        "Therefore, peer feedback should be considered carefully in academic contexts.",
        "Classmates may identify unclear ideas in a draft.",
        "This is one small example.",
        "The next sentence starts another topic."
      ],
      0,
      "A conclusion closes the paragraph and connects to the main idea."
    ],
    [
      "Which sentence does NOT fit this paragraph topic?",
      "Topic: Exercise",
      [
        "The cafeteria menu changed last week.",
        "Regular exercise can support students’ physical and mental health.",
        "Studies suggest that exercise may reduce stress.",
        "This example relates to exercise."
      ],
      0,
      "An irrelevant sentence does not fit the paragraph topic."
    ],
    [
      "Choose the best topic sentence.",
      "Topic: Citation",
      [
        "Citation is important for academic integrity.",
        "It allows readers to locate the original sources.",
        "Citation is a term.",
        "Some students have assignments."
      ],
      0,
      "A topic sentence states the main idea of the paragraph."
    ]
  ],
  "10": [
    [
      "Choose the best data description.",
      "Data: 30% in 2023 and 55% in 2025",
      [
        "The percentage increased from 2023 to 2025.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: 80 students in Group A and 60 students in Group B",
      [
        "Group A had more students than Group B.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: 45%, 45%, and 45% across three years",
      [
        "The percentage remained stable across the three years.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: 100 downloads in January and 150 downloads in February",
      [
        "The number of downloads increased.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: 70% before training and 52% after training",
      [
        "The percentage decreased after training.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: Group A = 75%, Group B = 75%",
      [
        "Both groups had the same percentage.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: 12 errors in Draft 1 and 5 errors in Draft 2",
      [
        "The number of errors decreased.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: 20 responses in Week 1, 35 in Week 2, and 50 in Week 3",
      [
        "The number of responses increased steadily.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: Score changed from 81 to 83",
      [
        "The score increased slightly.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: Use rose from 10% to 70%",
      [
        "Use increased significantly.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: 30% in 2023 and 55% in 2025",
      [
        "The percentage increased from 2023 to 2025.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: 80 students in Group A and 60 students in Group B",
      [
        "Group A had more students than Group B.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: 45%, 45%, and 45% across three years",
      [
        "The percentage remained stable across the three years.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: 100 downloads in January and 150 downloads in February",
      [
        "The number of downloads increased.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: 70% before training and 52% after training",
      [
        "The percentage decreased after training.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: Group A = 75%, Group B = 75%",
      [
        "Both groups had the same percentage.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: 12 errors in Draft 1 and 5 errors in Draft 2",
      [
        "The number of errors decreased.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: 20 responses in Week 1, 35 in Week 2, and 50 in Week 3",
      [
        "The number of responses increased steadily.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: Score changed from 81 to 83",
      [
        "The score increased slightly.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: Use rose from 10% to 70%",
      [
        "Use increased significantly.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: 30% in 2023 and 55% in 2025",
      [
        "The percentage increased from 2023 to 2025.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: 80 students in Group A and 60 students in Group B",
      [
        "Group A had more students than Group B.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: 45%, 45%, and 45% across three years",
      [
        "The percentage remained stable across the three years.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: 100 downloads in January and 150 downloads in February",
      [
        "The number of downloads increased.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: 70% before training and 52% after training",
      [
        "The percentage decreased after training.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: Group A = 75%, Group B = 75%",
      [
        "Both groups had the same percentage.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: 12 errors in Draft 1 and 5 errors in Draft 2",
      [
        "The number of errors decreased.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: 20 responses in Week 1, 35 in Week 2, and 50 in Week 3",
      [
        "The number of responses increased steadily.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: Score changed from 81 to 83",
      [
        "The score increased slightly.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: Use rose from 10% to 70%",
      [
        "Use increased significantly.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: 30% in 2023 and 55% in 2025",
      [
        "The percentage increased from 2023 to 2025.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: 80 students in Group A and 60 students in Group B",
      [
        "Group A had more students than Group B.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: 45%, 45%, and 45% across three years",
      [
        "The percentage remained stable across the three years.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: 100 downloads in January and 150 downloads in February",
      [
        "The number of downloads increased.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: 70% before training and 52% after training",
      [
        "The percentage decreased after training.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: Group A = 75%, Group B = 75%",
      [
        "Both groups had the same percentage.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: 12 errors in Draft 1 and 5 errors in Draft 2",
      [
        "The number of errors decreased.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: 20 responses in Week 1, 35 in Week 2, and 50 in Week 3",
      [
        "The number of responses increased steadily.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: Score changed from 81 to 83",
      [
        "The score increased slightly.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: Use rose from 10% to 70%",
      [
        "Use increased significantly.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: 30% in 2023 and 55% in 2025",
      [
        "The percentage increased from 2023 to 2025.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: 80 students in Group A and 60 students in Group B",
      [
        "Group A had more students than Group B.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: 45%, 45%, and 45% across three years",
      [
        "The percentage remained stable across the three years.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: 100 downloads in January and 150 downloads in February",
      [
        "The number of downloads increased.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ],
    [
      "Choose the best data description.",
      "Data: 70% before training and 52% after training",
      [
        "The percentage decreased after training.",
        "The data show no useful information.",
        "The pattern is the opposite of the values.",
        "The result proves all students think the same."
      ],
      0,
      "The correct option describes the data accurately without overclaiming."
    ]
  ],
  "11": [
    [
      "Choose the best subject line.",
      "Situation: You need to request feedback on a draft report.",
      [
        "Request for Feedback on Draft Report",
        "Help please",
        "Important thing",
        "Read this"
      ],
      0,
      "A good subject line is specific and formal."
    ],
    [
      "Choose the best purpose sentence.",
      "Situation: You need to ask for an appointment.",
      [
        "I would like to request an appointment during your office hours.",
        "I need something from you.",
        "Please answer quickly.",
        "I have a problem."
      ],
      0,
      "A good purpose sentence is polite and clear."
    ],
    [
      "Choose the most appropriate closing.",
      "",
      [
        "Thank you for your time and consideration.",
        "Reply fast.",
        "Okay bye.",
        "That is all."
      ],
      0,
      "This closing is polite and suitable for academic email."
    ],
    [
      "Choose the best subject line.",
      "Situation: You need to submit a revised assignment.",
      [
        "Submission of Revised Assignment",
        "Help please",
        "Important thing",
        "Read this"
      ],
      0,
      "A good subject line is specific and formal."
    ],
    [
      "Choose the best purpose sentence.",
      "Situation: You need to request an extension.",
      [
        "I am writing to request an extension for the assignment.",
        "I need something from you.",
        "Please answer quickly.",
        "I have a problem."
      ],
      0,
      "A good purpose sentence is polite and clear."
    ],
    [
      "Choose the most appropriate closing.",
      "",
      [
        "Thank you for your time and consideration.",
        "Reply fast.",
        "Okay bye.",
        "That is all."
      ],
      0,
      "This closing is polite and suitable for academic email."
    ],
    [
      "Choose the best subject line.",
      "Situation: You need to apologize for late submission.",
      [
        "Apology for Late Submission",
        "Help please",
        "Important thing",
        "Read this"
      ],
      0,
      "A good subject line is specific and formal."
    ],
    [
      "Choose the best purpose sentence.",
      "Situation: You need to ask about group project meeting.",
      [
        "I am writing to ask about the schedule for the group project meeting.",
        "I need something from you.",
        "Please answer quickly.",
        "I have a problem."
      ],
      0,
      "A good purpose sentence is polite and clear."
    ],
    [
      "Choose the most appropriate closing.",
      "",
      [
        "Thank you for your time and consideration.",
        "Reply fast.",
        "Okay bye.",
        "That is all."
      ],
      0,
      "This closing is polite and suitable for academic email."
    ],
    [
      "Choose the best subject line.",
      "Situation: You need to ask for score clarification.",
      [
        "Request for Score Clarification",
        "Help please",
        "Important thing",
        "Read this"
      ],
      0,
      "A good subject line is specific and formal."
    ],
    [
      "Choose the best purpose sentence.",
      "Situation: You need to request feedback on a draft report.",
      [
        "I am writing to request feedback on my draft report.",
        "I need something from you.",
        "Please answer quickly.",
        "I have a problem."
      ],
      0,
      "A good purpose sentence is polite and clear."
    ],
    [
      "Choose the most appropriate closing.",
      "",
      [
        "Thank you for your time and consideration.",
        "Reply fast.",
        "Okay bye.",
        "That is all."
      ],
      0,
      "This closing is polite and suitable for academic email."
    ],
    [
      "Choose the best subject line.",
      "Situation: You need to ask about presentation requirements.",
      [
        "Question about Final Presentation Requirements",
        "Help please",
        "Important thing",
        "Read this"
      ],
      0,
      "A good subject line is specific and formal."
    ],
    [
      "Choose the best purpose sentence.",
      "Situation: You need to submit a revised assignment.",
      [
        "I have attached my revised assignment for your review.",
        "I need something from you.",
        "Please answer quickly.",
        "I have a problem."
      ],
      0,
      "A good purpose sentence is polite and clear."
    ],
    [
      "Choose the most appropriate closing.",
      "",
      [
        "Thank you for your time and consideration.",
        "Reply fast.",
        "Okay bye.",
        "That is all."
      ],
      0,
      "This closing is polite and suitable for academic email."
    ],
    [
      "Choose the best subject line.",
      "Situation: You need to ask about citation format.",
      [
        "Question about Citation Format",
        "Help please",
        "Important thing",
        "Read this"
      ],
      0,
      "A good subject line is specific and formal."
    ],
    [
      "Choose the best purpose sentence.",
      "Situation: You need to apologize for late submission.",
      [
        "I apologize for submitting the assignment late.",
        "I need something from you.",
        "Please answer quickly.",
        "I have a problem."
      ],
      0,
      "A good purpose sentence is polite and clear."
    ],
    [
      "Choose the most appropriate closing.",
      "",
      [
        "Thank you for your time and consideration.",
        "Reply fast.",
        "Okay bye.",
        "That is all."
      ],
      0,
      "This closing is polite and suitable for academic email."
    ],
    [
      "Choose the best subject line.",
      "Situation: You need to send presentation slides.",
      [
        "Submission of Presentation Slides",
        "Help please",
        "Important thing",
        "Read this"
      ],
      0,
      "A good subject line is specific and formal."
    ],
    [
      "Choose the best purpose sentence.",
      "Situation: You need to ask for score clarification.",
      [
        "I would like to ask for clarification regarding my assignment score.",
        "I need something from you.",
        "Please answer quickly.",
        "I have a problem."
      ],
      0,
      "A good purpose sentence is polite and clear."
    ],
    [
      "Choose the most appropriate closing.",
      "",
      [
        "Thank you for your time and consideration.",
        "Reply fast.",
        "Okay bye.",
        "That is all."
      ],
      0,
      "This closing is polite and suitable for academic email."
    ],
    [
      "Choose the best subject line.",
      "Situation: You need to ask for an appointment.",
      [
        "Request for Appointment During Office Hours",
        "Help please",
        "Important thing",
        "Read this"
      ],
      0,
      "A good subject line is specific and formal."
    ],
    [
      "Choose the best purpose sentence.",
      "Situation: You need to ask about presentation requirements.",
      [
        "I am writing to ask for clarification about the final presentation requirements.",
        "I need something from you.",
        "Please answer quickly.",
        "I have a problem."
      ],
      0,
      "A good purpose sentence is polite and clear."
    ],
    [
      "Choose the most appropriate closing.",
      "",
      [
        "Thank you for your time and consideration.",
        "Reply fast.",
        "Okay bye.",
        "That is all."
      ],
      0,
      "This closing is polite and suitable for academic email."
    ],
    [
      "Choose the best subject line.",
      "Situation: You need to request an extension.",
      [
        "Request for Assignment Extension",
        "Help please",
        "Important thing",
        "Read this"
      ],
      0,
      "A good subject line is specific and formal."
    ],
    [
      "Choose the best purpose sentence.",
      "Situation: You need to ask about citation format.",
      [
        "I would like to ask which citation format should be used.",
        "I need something from you.",
        "Please answer quickly.",
        "I have a problem."
      ],
      0,
      "A good purpose sentence is polite and clear."
    ],
    [
      "Choose the most appropriate closing.",
      "",
      [
        "Thank you for your time and consideration.",
        "Reply fast.",
        "Okay bye.",
        "That is all."
      ],
      0,
      "This closing is polite and suitable for academic email."
    ],
    [
      "Choose the best subject line.",
      "Situation: You need to ask about group project meeting.",
      [
        "Question about Group Project Meeting",
        "Help please",
        "Important thing",
        "Read this"
      ],
      0,
      "A good subject line is specific and formal."
    ],
    [
      "Choose the best purpose sentence.",
      "Situation: You need to send presentation slides.",
      [
        "I have attached my presentation slides to this email.",
        "I need something from you.",
        "Please answer quickly.",
        "I have a problem."
      ],
      0,
      "A good purpose sentence is polite and clear."
    ],
    [
      "Choose the most appropriate closing.",
      "",
      [
        "Thank you for your time and consideration.",
        "Reply fast.",
        "Okay bye.",
        "That is all."
      ],
      0,
      "This closing is polite and suitable for academic email."
    ],
    [
      "Choose the best subject line.",
      "Situation: You need to request feedback on a draft report.",
      [
        "Request for Feedback on Draft Report",
        "Help please",
        "Important thing",
        "Read this"
      ],
      0,
      "A good subject line is specific and formal."
    ],
    [
      "Choose the best purpose sentence.",
      "Situation: You need to ask for an appointment.",
      [
        "I would like to request an appointment during your office hours.",
        "I need something from you.",
        "Please answer quickly.",
        "I have a problem."
      ],
      0,
      "A good purpose sentence is polite and clear."
    ],
    [
      "Choose the most appropriate closing.",
      "",
      [
        "Thank you for your time and consideration.",
        "Reply fast.",
        "Okay bye.",
        "That is all."
      ],
      0,
      "This closing is polite and suitable for academic email."
    ],
    [
      "Choose the best subject line.",
      "Situation: You need to submit a revised assignment.",
      [
        "Submission of Revised Assignment",
        "Help please",
        "Important thing",
        "Read this"
      ],
      0,
      "A good subject line is specific and formal."
    ],
    [
      "Choose the best purpose sentence.",
      "Situation: You need to request an extension.",
      [
        "I am writing to request an extension for the assignment.",
        "I need something from you.",
        "Please answer quickly.",
        "I have a problem."
      ],
      0,
      "A good purpose sentence is polite and clear."
    ],
    [
      "Choose the most appropriate closing.",
      "",
      [
        "Thank you for your time and consideration.",
        "Reply fast.",
        "Okay bye.",
        "That is all."
      ],
      0,
      "This closing is polite and suitable for academic email."
    ],
    [
      "Choose the best subject line.",
      "Situation: You need to apologize for late submission.",
      [
        "Apology for Late Submission",
        "Help please",
        "Important thing",
        "Read this"
      ],
      0,
      "A good subject line is specific and formal."
    ],
    [
      "Choose the best purpose sentence.",
      "Situation: You need to ask about group project meeting.",
      [
        "I am writing to ask about the schedule for the group project meeting.",
        "I need something from you.",
        "Please answer quickly.",
        "I have a problem."
      ],
      0,
      "A good purpose sentence is polite and clear."
    ],
    [
      "Choose the most appropriate closing.",
      "",
      [
        "Thank you for your time and consideration.",
        "Reply fast.",
        "Okay bye.",
        "That is all."
      ],
      0,
      "This closing is polite and suitable for academic email."
    ],
    [
      "Choose the best subject line.",
      "Situation: You need to ask for score clarification.",
      [
        "Request for Score Clarification",
        "Help please",
        "Important thing",
        "Read this"
      ],
      0,
      "A good subject line is specific and formal."
    ],
    [
      "Choose the best purpose sentence.",
      "Situation: You need to request feedback on a draft report.",
      [
        "I am writing to request feedback on my draft report.",
        "I need something from you.",
        "Please answer quickly.",
        "I have a problem."
      ],
      0,
      "A good purpose sentence is polite and clear."
    ],
    [
      "Choose the most appropriate closing.",
      "",
      [
        "Thank you for your time and consideration.",
        "Reply fast.",
        "Okay bye.",
        "That is all."
      ],
      0,
      "This closing is polite and suitable for academic email."
    ],
    [
      "Choose the best subject line.",
      "Situation: You need to ask about presentation requirements.",
      [
        "Question about Final Presentation Requirements",
        "Help please",
        "Important thing",
        "Read this"
      ],
      0,
      "A good subject line is specific and formal."
    ],
    [
      "Choose the best purpose sentence.",
      "Situation: You need to submit a revised assignment.",
      [
        "I have attached my revised assignment for your review.",
        "I need something from you.",
        "Please answer quickly.",
        "I have a problem."
      ],
      0,
      "A good purpose sentence is polite and clear."
    ],
    [
      "Choose the most appropriate closing.",
      "",
      [
        "Thank you for your time and consideration.",
        "Reply fast.",
        "Okay bye.",
        "That is all."
      ],
      0,
      "This closing is polite and suitable for academic email."
    ]
  ],
  "12": [
    [
      "What is the best classification?",
      "Action: copying a paragraph without citation",
      [
        "plagiarism",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as plagiarism."
    ],
    [
      "What is the best classification?",
      "Action: paraphrasing with citation",
      [
        "acceptable academic practice",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as acceptable academic practice."
    ],
    [
      "What is the best classification?",
      "Action: changing only a few words from the original",
      [
        "patchwriting",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as patchwriting."
    ],
    [
      "What is the best classification?",
      "Action: using AI output without checking",
      [
        "risky AI use",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as risky AI use."
    ],
    [
      "What is the best classification?",
      "Action: inventing a reference",
      [
        "academic misconduct",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as academic misconduct."
    ],
    [
      "What is the best classification?",
      "Action: quoting with quotation marks and citation",
      [
        "acceptable quotation practice",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as acceptable quotation practice."
    ],
    [
      "What is the best classification?",
      "Action: summarizing a source with citation",
      [
        "acceptable academic practice",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as acceptable academic practice."
    ],
    [
      "What is the best classification?",
      "Action: using a source idea without credit",
      [
        "plagiarism",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as plagiarism."
    ],
    [
      "What is the best classification?",
      "Action: checking AI information against credible sources",
      [
        "responsible AI use",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as responsible AI use."
    ],
    [
      "What is the best classification?",
      "Action: using a citation that does not support the claim",
      [
        "incorrect source use",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as incorrect source use."
    ],
    [
      "What is the best classification?",
      "Action: copying a paragraph without citation",
      [
        "plagiarism",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as plagiarism."
    ],
    [
      "What is the best classification?",
      "Action: paraphrasing with citation",
      [
        "acceptable academic practice",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as acceptable academic practice."
    ],
    [
      "What is the best classification?",
      "Action: changing only a few words from the original",
      [
        "patchwriting",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as patchwriting."
    ],
    [
      "What is the best classification?",
      "Action: using AI output without checking",
      [
        "risky AI use",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as risky AI use."
    ],
    [
      "What is the best classification?",
      "Action: inventing a reference",
      [
        "academic misconduct",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as academic misconduct."
    ],
    [
      "What is the best classification?",
      "Action: quoting with quotation marks and citation",
      [
        "acceptable quotation practice",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as acceptable quotation practice."
    ],
    [
      "What is the best classification?",
      "Action: summarizing a source with citation",
      [
        "acceptable academic practice",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as acceptable academic practice."
    ],
    [
      "What is the best classification?",
      "Action: using a source idea without credit",
      [
        "plagiarism",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as plagiarism."
    ],
    [
      "What is the best classification?",
      "Action: checking AI information against credible sources",
      [
        "responsible AI use",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as responsible AI use."
    ],
    [
      "What is the best classification?",
      "Action: using a citation that does not support the claim",
      [
        "incorrect source use",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as incorrect source use."
    ],
    [
      "What is the best classification?",
      "Action: copying a paragraph without citation",
      [
        "plagiarism",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as plagiarism."
    ],
    [
      "What is the best classification?",
      "Action: paraphrasing with citation",
      [
        "acceptable academic practice",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as acceptable academic practice."
    ],
    [
      "What is the best classification?",
      "Action: changing only a few words from the original",
      [
        "patchwriting",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as patchwriting."
    ],
    [
      "What is the best classification?",
      "Action: using AI output without checking",
      [
        "risky AI use",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as risky AI use."
    ],
    [
      "What is the best classification?",
      "Action: inventing a reference",
      [
        "academic misconduct",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as academic misconduct."
    ],
    [
      "What is the best classification?",
      "Action: quoting with quotation marks and citation",
      [
        "acceptable quotation practice",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as acceptable quotation practice."
    ],
    [
      "What is the best classification?",
      "Action: summarizing a source with citation",
      [
        "acceptable academic practice",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as acceptable academic practice."
    ],
    [
      "What is the best classification?",
      "Action: using a source idea without credit",
      [
        "plagiarism",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as plagiarism."
    ],
    [
      "What is the best classification?",
      "Action: checking AI information against credible sources",
      [
        "responsible AI use",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as responsible AI use."
    ],
    [
      "What is the best classification?",
      "Action: using a citation that does not support the claim",
      [
        "incorrect source use",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as incorrect source use."
    ],
    [
      "What is the best classification?",
      "Action: copying a paragraph without citation",
      [
        "plagiarism",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as plagiarism."
    ],
    [
      "What is the best classification?",
      "Action: paraphrasing with citation",
      [
        "acceptable academic practice",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as acceptable academic practice."
    ],
    [
      "What is the best classification?",
      "Action: changing only a few words from the original",
      [
        "patchwriting",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as patchwriting."
    ],
    [
      "What is the best classification?",
      "Action: using AI output without checking",
      [
        "risky AI use",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as risky AI use."
    ],
    [
      "What is the best classification?",
      "Action: inventing a reference",
      [
        "academic misconduct",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as academic misconduct."
    ],
    [
      "What is the best classification?",
      "Action: quoting with quotation marks and citation",
      [
        "acceptable quotation practice",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as acceptable quotation practice."
    ],
    [
      "What is the best classification?",
      "Action: summarizing a source with citation",
      [
        "acceptable academic practice",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as acceptable academic practice."
    ],
    [
      "What is the best classification?",
      "Action: using a source idea without credit",
      [
        "plagiarism",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as plagiarism."
    ],
    [
      "What is the best classification?",
      "Action: checking AI information against credible sources",
      [
        "responsible AI use",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as responsible AI use."
    ],
    [
      "What is the best classification?",
      "Action: using a citation that does not support the claim",
      [
        "incorrect source use",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as incorrect source use."
    ],
    [
      "What is the best classification?",
      "Action: copying a paragraph without citation",
      [
        "plagiarism",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as plagiarism."
    ],
    [
      "What is the best classification?",
      "Action: paraphrasing with citation",
      [
        "acceptable academic practice",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as acceptable academic practice."
    ],
    [
      "What is the best classification?",
      "Action: changing only a few words from the original",
      [
        "patchwriting",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as patchwriting."
    ],
    [
      "What is the best classification?",
      "Action: using AI output without checking",
      [
        "risky AI use",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as risky AI use."
    ],
    [
      "What is the best classification?",
      "Action: inventing a reference",
      [
        "academic misconduct",
        "always acceptable without citation",
        "only a formatting issue",
        "not related to academic ethics"
      ],
      0,
      "This action is best classified as academic misconduct."
    ]
  ],
  "13": [
    [
      "Listening simulation: What is the main point?",
      "Transcript: Today, I will explain three strategies for academic reading: previewing, identifying keywords, and reviewing notes.",
      [
        "academic reading strategies",
        "a personal story unrelated to class",
        "only a vocabulary list",
        "a casual conversation"
      ],
      0,
      "The main point is the central idea of the transcript."
    ],
    [
      "Which note is best?",
      "Transcript: The first reason citation is important is that it helps readers locate the original source.",
      [
        "importance of citation → key point",
        "The first reason citation is important is that it helps readers locate the original source.",
        "interesting",
        "many words"
      ],
      0,
      "Good notes are short and focus on key information."
    ],
    [
      "Listening simulation: What is the main point?",
      "Transcript: Although AI tools are useful, students must check the accuracy of their output.",
      [
        "responsible AI use",
        "a personal story unrelated to class",
        "only a vocabulary list",
        "a casual conversation"
      ],
      0,
      "The main point is the central idea of the transcript."
    ],
    [
      "Which note is best?",
      "Transcript: The survey included 250 undergraduate students from three faculties.",
      [
        "survey participants → key point",
        "The survey included 250 undergraduate students from three faculties.",
        "interesting",
        "many words"
      ],
      0,
      "Good notes are short and focus on key information."
    ],
    [
      "Listening simulation: What is the main point?",
      "Transcript: To sum up, digital literacy helps students evaluate online information more responsibly.",
      [
        "digital literacy and evaluation",
        "a personal story unrelated to class",
        "only a vocabulary list",
        "a casual conversation"
      ],
      0,
      "The main point is the central idea of the transcript."
    ],
    [
      "Which note is best?",
      "Transcript: Next, I will discuss how evidence can make an academic argument more convincing.",
      [
        "evidence in academic arguments → key point",
        "Next, I will discuss how evidence can make an academic argument more convincing.",
        "interesting",
        "many words"
      ],
      0,
      "Good notes are short and focus on key information."
    ],
    [
      "Listening simulation: What is the main point?",
      "Transcript: The study found a significant increase in engagement after game-based learning was introduced.",
      [
        "game-based learning and engagement",
        "a personal story unrelated to class",
        "only a vocabulary list",
        "a casual conversation"
      ],
      0,
      "The main point is the central idea of the transcript."
    ],
    [
      "Which note is best?",
      "Transcript: Students should check the author, date, and source before sharing online information.",
      [
        "source checking → key point",
        "Students should check the author, date, and source before sharing online information.",
        "interesting",
        "many words"
      ],
      0,
      "Good notes are short and focus on key information."
    ],
    [
      "Listening simulation: What is the main point?",
      "Transcript: In conclusion, clear presentation structure helps audiences follow complex ideas.",
      [
        "presentation structure",
        "a personal story unrelated to class",
        "only a vocabulary list",
        "a casual conversation"
      ],
      0,
      "The main point is the central idea of the transcript."
    ],
    [
      "Which note is best?",
      "Transcript: First, the speaker introduces the problem; then, she explains possible solutions.",
      [
        "lecture organization → key point",
        "First, the speaker introduces the problem; then, she explains possible solutions.",
        "interesting",
        "many words"
      ],
      0,
      "Good notes are short and focus on key information."
    ],
    [
      "Listening simulation: What is the main point?",
      "Transcript: Today, I will explain three strategies for academic reading: previewing, identifying keywords, and reviewing notes.",
      [
        "academic reading strategies",
        "a personal story unrelated to class",
        "only a vocabulary list",
        "a casual conversation"
      ],
      0,
      "The main point is the central idea of the transcript."
    ],
    [
      "Which note is best?",
      "Transcript: The first reason citation is important is that it helps readers locate the original source.",
      [
        "importance of citation → key point",
        "The first reason citation is important is that it helps readers locate the original source.",
        "interesting",
        "many words"
      ],
      0,
      "Good notes are short and focus on key information."
    ],
    [
      "Listening simulation: What is the main point?",
      "Transcript: Although AI tools are useful, students must check the accuracy of their output.",
      [
        "responsible AI use",
        "a personal story unrelated to class",
        "only a vocabulary list",
        "a casual conversation"
      ],
      0,
      "The main point is the central idea of the transcript."
    ],
    [
      "Which note is best?",
      "Transcript: The survey included 250 undergraduate students from three faculties.",
      [
        "survey participants → key point",
        "The survey included 250 undergraduate students from three faculties.",
        "interesting",
        "many words"
      ],
      0,
      "Good notes are short and focus on key information."
    ],
    [
      "Listening simulation: What is the main point?",
      "Transcript: To sum up, digital literacy helps students evaluate online information more responsibly.",
      [
        "digital literacy and evaluation",
        "a personal story unrelated to class",
        "only a vocabulary list",
        "a casual conversation"
      ],
      0,
      "The main point is the central idea of the transcript."
    ],
    [
      "Which note is best?",
      "Transcript: Next, I will discuss how evidence can make an academic argument more convincing.",
      [
        "evidence in academic arguments → key point",
        "Next, I will discuss how evidence can make an academic argument more convincing.",
        "interesting",
        "many words"
      ],
      0,
      "Good notes are short and focus on key information."
    ],
    [
      "Listening simulation: What is the main point?",
      "Transcript: The study found a significant increase in engagement after game-based learning was introduced.",
      [
        "game-based learning and engagement",
        "a personal story unrelated to class",
        "only a vocabulary list",
        "a casual conversation"
      ],
      0,
      "The main point is the central idea of the transcript."
    ],
    [
      "Which note is best?",
      "Transcript: Students should check the author, date, and source before sharing online information.",
      [
        "source checking → key point",
        "Students should check the author, date, and source before sharing online information.",
        "interesting",
        "many words"
      ],
      0,
      "Good notes are short and focus on key information."
    ],
    [
      "Listening simulation: What is the main point?",
      "Transcript: In conclusion, clear presentation structure helps audiences follow complex ideas.",
      [
        "presentation structure",
        "a personal story unrelated to class",
        "only a vocabulary list",
        "a casual conversation"
      ],
      0,
      "The main point is the central idea of the transcript."
    ],
    [
      "Which note is best?",
      "Transcript: First, the speaker introduces the problem; then, she explains possible solutions.",
      [
        "lecture organization → key point",
        "First, the speaker introduces the problem; then, she explains possible solutions.",
        "interesting",
        "many words"
      ],
      0,
      "Good notes are short and focus on key information."
    ],
    [
      "Listening simulation: What is the main point?",
      "Transcript: Today, I will explain three strategies for academic reading: previewing, identifying keywords, and reviewing notes.",
      [
        "academic reading strategies",
        "a personal story unrelated to class",
        "only a vocabulary list",
        "a casual conversation"
      ],
      0,
      "The main point is the central idea of the transcript."
    ],
    [
      "Which note is best?",
      "Transcript: The first reason citation is important is that it helps readers locate the original source.",
      [
        "importance of citation → key point",
        "The first reason citation is important is that it helps readers locate the original source.",
        "interesting",
        "many words"
      ],
      0,
      "Good notes are short and focus on key information."
    ],
    [
      "Listening simulation: What is the main point?",
      "Transcript: Although AI tools are useful, students must check the accuracy of their output.",
      [
        "responsible AI use",
        "a personal story unrelated to class",
        "only a vocabulary list",
        "a casual conversation"
      ],
      0,
      "The main point is the central idea of the transcript."
    ],
    [
      "Which note is best?",
      "Transcript: The survey included 250 undergraduate students from three faculties.",
      [
        "survey participants → key point",
        "The survey included 250 undergraduate students from three faculties.",
        "interesting",
        "many words"
      ],
      0,
      "Good notes are short and focus on key information."
    ],
    [
      "Listening simulation: What is the main point?",
      "Transcript: To sum up, digital literacy helps students evaluate online information more responsibly.",
      [
        "digital literacy and evaluation",
        "a personal story unrelated to class",
        "only a vocabulary list",
        "a casual conversation"
      ],
      0,
      "The main point is the central idea of the transcript."
    ],
    [
      "Which note is best?",
      "Transcript: Next, I will discuss how evidence can make an academic argument more convincing.",
      [
        "evidence in academic arguments → key point",
        "Next, I will discuss how evidence can make an academic argument more convincing.",
        "interesting",
        "many words"
      ],
      0,
      "Good notes are short and focus on key information."
    ],
    [
      "Listening simulation: What is the main point?",
      "Transcript: The study found a significant increase in engagement after game-based learning was introduced.",
      [
        "game-based learning and engagement",
        "a personal story unrelated to class",
        "only a vocabulary list",
        "a casual conversation"
      ],
      0,
      "The main point is the central idea of the transcript."
    ],
    [
      "Which note is best?",
      "Transcript: Students should check the author, date, and source before sharing online information.",
      [
        "source checking → key point",
        "Students should check the author, date, and source before sharing online information.",
        "interesting",
        "many words"
      ],
      0,
      "Good notes are short and focus on key information."
    ],
    [
      "Listening simulation: What is the main point?",
      "Transcript: In conclusion, clear presentation structure helps audiences follow complex ideas.",
      [
        "presentation structure",
        "a personal story unrelated to class",
        "only a vocabulary list",
        "a casual conversation"
      ],
      0,
      "The main point is the central idea of the transcript."
    ],
    [
      "Which note is best?",
      "Transcript: First, the speaker introduces the problem; then, she explains possible solutions.",
      [
        "lecture organization → key point",
        "First, the speaker introduces the problem; then, she explains possible solutions.",
        "interesting",
        "many words"
      ],
      0,
      "Good notes are short and focus on key information."
    ],
    [
      "Listening simulation: What is the main point?",
      "Transcript: Today, I will explain three strategies for academic reading: previewing, identifying keywords, and reviewing notes.",
      [
        "academic reading strategies",
        "a personal story unrelated to class",
        "only a vocabulary list",
        "a casual conversation"
      ],
      0,
      "The main point is the central idea of the transcript."
    ],
    [
      "Which note is best?",
      "Transcript: The first reason citation is important is that it helps readers locate the original source.",
      [
        "importance of citation → key point",
        "The first reason citation is important is that it helps readers locate the original source.",
        "interesting",
        "many words"
      ],
      0,
      "Good notes are short and focus on key information."
    ],
    [
      "Listening simulation: What is the main point?",
      "Transcript: Although AI tools are useful, students must check the accuracy of their output.",
      [
        "responsible AI use",
        "a personal story unrelated to class",
        "only a vocabulary list",
        "a casual conversation"
      ],
      0,
      "The main point is the central idea of the transcript."
    ],
    [
      "Which note is best?",
      "Transcript: The survey included 250 undergraduate students from three faculties.",
      [
        "survey participants → key point",
        "The survey included 250 undergraduate students from three faculties.",
        "interesting",
        "many words"
      ],
      0,
      "Good notes are short and focus on key information."
    ],
    [
      "Listening simulation: What is the main point?",
      "Transcript: To sum up, digital literacy helps students evaluate online information more responsibly.",
      [
        "digital literacy and evaluation",
        "a personal story unrelated to class",
        "only a vocabulary list",
        "a casual conversation"
      ],
      0,
      "The main point is the central idea of the transcript."
    ],
    [
      "Which note is best?",
      "Transcript: Next, I will discuss how evidence can make an academic argument more convincing.",
      [
        "evidence in academic arguments → key point",
        "Next, I will discuss how evidence can make an academic argument more convincing.",
        "interesting",
        "many words"
      ],
      0,
      "Good notes are short and focus on key information."
    ],
    [
      "Listening simulation: What is the main point?",
      "Transcript: The study found a significant increase in engagement after game-based learning was introduced.",
      [
        "game-based learning and engagement",
        "a personal story unrelated to class",
        "only a vocabulary list",
        "a casual conversation"
      ],
      0,
      "The main point is the central idea of the transcript."
    ],
    [
      "Which note is best?",
      "Transcript: Students should check the author, date, and source before sharing online information.",
      [
        "source checking → key point",
        "Students should check the author, date, and source before sharing online information.",
        "interesting",
        "many words"
      ],
      0,
      "Good notes are short and focus on key information."
    ],
    [
      "Listening simulation: What is the main point?",
      "Transcript: In conclusion, clear presentation structure helps audiences follow complex ideas.",
      [
        "presentation structure",
        "a personal story unrelated to class",
        "only a vocabulary list",
        "a casual conversation"
      ],
      0,
      "The main point is the central idea of the transcript."
    ],
    [
      "Which note is best?",
      "Transcript: First, the speaker introduces the problem; then, she explains possible solutions.",
      [
        "lecture organization → key point",
        "First, the speaker introduces the problem; then, she explains possible solutions.",
        "interesting",
        "many words"
      ],
      0,
      "Good notes are short and focus on key information."
    ],
    [
      "Listening simulation: What is the main point?",
      "Transcript: Today, I will explain three strategies for academic reading: previewing, identifying keywords, and reviewing notes.",
      [
        "academic reading strategies",
        "a personal story unrelated to class",
        "only a vocabulary list",
        "a casual conversation"
      ],
      0,
      "The main point is the central idea of the transcript."
    ],
    [
      "Which note is best?",
      "Transcript: The first reason citation is important is that it helps readers locate the original source.",
      [
        "importance of citation → key point",
        "The first reason citation is important is that it helps readers locate the original source.",
        "interesting",
        "many words"
      ],
      0,
      "Good notes are short and focus on key information."
    ],
    [
      "Listening simulation: What is the main point?",
      "Transcript: Although AI tools are useful, students must check the accuracy of their output.",
      [
        "responsible AI use",
        "a personal story unrelated to class",
        "only a vocabulary list",
        "a casual conversation"
      ],
      0,
      "The main point is the central idea of the transcript."
    ],
    [
      "Which note is best?",
      "Transcript: The survey included 250 undergraduate students from three faculties.",
      [
        "survey participants → key point",
        "The survey included 250 undergraduate students from three faculties.",
        "interesting",
        "many words"
      ],
      0,
      "Good notes are short and focus on key information."
    ],
    [
      "Listening simulation: What is the main point?",
      "Transcript: To sum up, digital literacy helps students evaluate online information more responsibly.",
      [
        "digital literacy and evaluation",
        "a personal story unrelated to class",
        "only a vocabulary list",
        "a casual conversation"
      ],
      0,
      "The main point is the central idea of the transcript."
    ]
  ],
  "14": [
    [
      "Choose the best opening phrase for an academic presentation.",
      "",
      [
        "Today, I would like to present my topic on digital literacy.",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best outline phrase for an academic presentation.",
      "",
      [
        "I will first explain the problem, then discuss causes and solutions.",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best transition phrase for an academic presentation.",
      "",
      [
        "Let us now move to the causes of the problem.",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best evidence phrase for an academic presentation.",
      "",
      [
        "According to the survey results, student awareness increased after training.",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best conclusion phrase for an academic presentation.",
      "",
      [
        "In conclusion, digital literacy training can support responsible online behavior.",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best Q&A phrase for an academic presentation.",
      "",
      [
        "Thank you for your question. Based on the evidence I found, ...",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best limitation phrase for an academic presentation.",
      "",
      [
        "One limitation of this evidence is the small sample size.",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best solution phrase for an academic presentation.",
      "",
      [
        "One possible solution is to provide short source-checking workshops.",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best audience thanks phrase for an academic presentation.",
      "",
      [
        "Thank you for your attention.",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best uncertain answer phrase for an academic presentation.",
      "",
      [
        "I will need to check further information before answering fully.",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best opening phrase for an academic presentation.",
      "",
      [
        "Today, I would like to present my topic on digital literacy.",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best outline phrase for an academic presentation.",
      "",
      [
        "I will first explain the problem, then discuss causes and solutions.",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best transition phrase for an academic presentation.",
      "",
      [
        "Let us now move to the causes of the problem.",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best evidence phrase for an academic presentation.",
      "",
      [
        "According to the survey results, student awareness increased after training.",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best conclusion phrase for an academic presentation.",
      "",
      [
        "In conclusion, digital literacy training can support responsible online behavior.",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best Q&A phrase for an academic presentation.",
      "",
      [
        "Thank you for your question. Based on the evidence I found, ...",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best limitation phrase for an academic presentation.",
      "",
      [
        "One limitation of this evidence is the small sample size.",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best solution phrase for an academic presentation.",
      "",
      [
        "One possible solution is to provide short source-checking workshops.",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best audience thanks phrase for an academic presentation.",
      "",
      [
        "Thank you for your attention.",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best uncertain answer phrase for an academic presentation.",
      "",
      [
        "I will need to check further information before answering fully.",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best opening phrase for an academic presentation.",
      "",
      [
        "Today, I would like to present my topic on digital literacy.",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best outline phrase for an academic presentation.",
      "",
      [
        "I will first explain the problem, then discuss causes and solutions.",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best transition phrase for an academic presentation.",
      "",
      [
        "Let us now move to the causes of the problem.",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best evidence phrase for an academic presentation.",
      "",
      [
        "According to the survey results, student awareness increased after training.",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best conclusion phrase for an academic presentation.",
      "",
      [
        "In conclusion, digital literacy training can support responsible online behavior.",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best Q&A phrase for an academic presentation.",
      "",
      [
        "Thank you for your question. Based on the evidence I found, ...",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best limitation phrase for an academic presentation.",
      "",
      [
        "One limitation of this evidence is the small sample size.",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best solution phrase for an academic presentation.",
      "",
      [
        "One possible solution is to provide short source-checking workshops.",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best audience thanks phrase for an academic presentation.",
      "",
      [
        "Thank you for your attention.",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best uncertain answer phrase for an academic presentation.",
      "",
      [
        "I will need to check further information before answering fully.",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best opening phrase for an academic presentation.",
      "",
      [
        "Today, I would like to present my topic on digital literacy.",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best outline phrase for an academic presentation.",
      "",
      [
        "I will first explain the problem, then discuss causes and solutions.",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best transition phrase for an academic presentation.",
      "",
      [
        "Let us now move to the causes of the problem.",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best evidence phrase for an academic presentation.",
      "",
      [
        "According to the survey results, student awareness increased after training.",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best conclusion phrase for an academic presentation.",
      "",
      [
        "In conclusion, digital literacy training can support responsible online behavior.",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best Q&A phrase for an academic presentation.",
      "",
      [
        "Thank you for your question. Based on the evidence I found, ...",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best limitation phrase for an academic presentation.",
      "",
      [
        "One limitation of this evidence is the small sample size.",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best solution phrase for an academic presentation.",
      "",
      [
        "One possible solution is to provide short source-checking workshops.",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best audience thanks phrase for an academic presentation.",
      "",
      [
        "Thank you for your attention.",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best uncertain answer phrase for an academic presentation.",
      "",
      [
        "I will need to check further information before answering fully.",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best opening phrase for an academic presentation.",
      "",
      [
        "Today, I would like to present my topic on digital literacy.",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best outline phrase for an academic presentation.",
      "",
      [
        "I will first explain the problem, then discuss causes and solutions.",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best transition phrase for an academic presentation.",
      "",
      [
        "Let us now move to the causes of the problem.",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best evidence phrase for an academic presentation.",
      "",
      [
        "According to the survey results, student awareness increased after training.",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ],
    [
      "Choose the best conclusion phrase for an academic presentation.",
      "",
      [
        "In conclusion, digital literacy training can support responsible online behavior.",
        "I will say some stuff now.",
        "This is kind of my slide.",
        "Let us finish quickly."
      ],
      0,
      "The correct phrase is polite, clear, and academic."
    ]
  ],
  "15": [
    [
      "Choose the best problem statement.",
      "",
      [
        "Fake news can affect students and academic decision-making.",
        "Fake news is bad stuff.",
        "I do not like fake news.",
        "Everyone knows about fake news."
      ],
      0,
      "A strong problem statement is clear and academic."
    ],
    [
      "Choose the best cause sentence.",
      "",
      [
        "One possible cause is irresponsible online communication.",
        "The cause is people.",
        "It happens because of many things.",
        "No one really knows."
      ],
      0,
      "A good cause sentence is specific."
    ],
    [
      "Choose the best evidence sentence.",
      "",
      [
        "Interviews showed that many students were unsure how to cite AI assistance.",
        "Many people say this is a problem.",
        "It is everywhere online.",
        "I have seen it before."
      ],
      0,
      "Evidence should be specific and credible."
    ],
    [
      "Choose the best solution sentence.",
      "",
      [
        "Universities could provide campus learning support points to address this issue.",
        "People should just stop.",
        "Everyone should be better.",
        "The internet should disappear."
      ],
      0,
      "A good solution is realistic and specific."
    ],
    [
      "Choose the best final presentation structure.",
      "",
      [
        "Problem → Cause → Evidence → Solution → Conclusion",
        "Opinion → Story → Joke → End",
        "Title → Picture → Ending",
        "Cause only → No evidence"
      ],
      0,
      "This structure supports academic problem-solution presentation."
    ],
    [
      "Choose the best problem statement.",
      "",
      [
        "Poor health awareness can affect students and academic decision-making.",
        "Poor health awareness is bad stuff.",
        "I do not like poor health awareness.",
        "Everyone knows about poor health awareness."
      ],
      0,
      "A strong problem statement is clear and academic."
    ],
    [
      "Choose the best cause sentence.",
      "",
      [
        "One possible cause is limited recycling behavior on campus.",
        "The cause is people.",
        "It happens because of many things.",
        "No one really knows."
      ],
      0,
      "A good cause sentence is specific."
    ],
    [
      "Choose the best evidence sentence.",
      "",
      [
        "Pre-test results showed low reading confidence.",
        "Many people say this is a problem.",
        "It is everywhere online.",
        "I have seen it before."
      ],
      0,
      "Evidence should be specific and credible."
    ],
    [
      "Choose the best solution sentence.",
      "",
      [
        "Universities could provide structured presentation rehearsal to address this issue.",
        "People should just stop.",
        "Everyone should be better.",
        "The internet should disappear."
      ],
      0,
      "A good solution is realistic and specific."
    ],
    [
      "Choose the best final presentation structure.",
      "",
      [
        "Problem → Cause → Evidence → Solution → Conclusion",
        "Opinion → Story → Joke → End",
        "Title → Picture → Ending",
        "Cause only → No evidence"
      ],
      0,
      "This structure supports academic problem-solution presentation."
    ],
    [
      "Choose the best problem statement.",
      "",
      [
        "Fake news can affect students and academic decision-making.",
        "Fake news is bad stuff.",
        "I do not like fake news.",
        "Everyone knows about fake news."
      ],
      0,
      "A strong problem statement is clear and academic."
    ],
    [
      "Choose the best cause sentence.",
      "",
      [
        "One possible cause is irresponsible online communication.",
        "The cause is people.",
        "It happens because of many things.",
        "No one really knows."
      ],
      0,
      "A good cause sentence is specific."
    ],
    [
      "Choose the best evidence sentence.",
      "",
      [
        "Interviews showed that many students were unsure how to cite AI assistance.",
        "Many people say this is a problem.",
        "It is everywhere online.",
        "I have seen it before."
      ],
      0,
      "Evidence should be specific and credible."
    ],
    [
      "Choose the best solution sentence.",
      "",
      [
        "Universities could provide campus learning support points to address this issue.",
        "People should just stop.",
        "Everyone should be better.",
        "The internet should disappear."
      ],
      0,
      "A good solution is realistic and specific."
    ],
    [
      "Choose the best final presentation structure.",
      "",
      [
        "Problem → Cause → Evidence → Solution → Conclusion",
        "Opinion → Story → Joke → End",
        "Title → Picture → Ending",
        "Cause only → No evidence"
      ],
      0,
      "This structure supports academic problem-solution presentation."
    ],
    [
      "Choose the best problem statement.",
      "",
      [
        "Poor health awareness can affect students and academic decision-making.",
        "Poor health awareness is bad stuff.",
        "I do not like poor health awareness.",
        "Everyone knows about poor health awareness."
      ],
      0,
      "A strong problem statement is clear and academic."
    ],
    [
      "Choose the best cause sentence.",
      "",
      [
        "One possible cause is limited recycling behavior on campus.",
        "The cause is people.",
        "It happens because of many things.",
        "No one really knows."
      ],
      0,
      "A good cause sentence is specific."
    ],
    [
      "Choose the best evidence sentence.",
      "",
      [
        "Pre-test results showed low reading confidence.",
        "Many people say this is a problem.",
        "It is everywhere online.",
        "I have seen it before."
      ],
      0,
      "Evidence should be specific and credible."
    ],
    [
      "Choose the best solution sentence.",
      "",
      [
        "Universities could provide structured presentation rehearsal to address this issue.",
        "People should just stop.",
        "Everyone should be better.",
        "The internet should disappear."
      ],
      0,
      "A good solution is realistic and specific."
    ],
    [
      "Choose the best final presentation structure.",
      "",
      [
        "Problem → Cause → Evidence → Solution → Conclusion",
        "Opinion → Story → Joke → End",
        "Title → Picture → Ending",
        "Cause only → No evidence"
      ],
      0,
      "This structure supports academic problem-solution presentation."
    ],
    [
      "Choose the best problem statement.",
      "",
      [
        "Fake news can affect students and academic decision-making.",
        "Fake news is bad stuff.",
        "I do not like fake news.",
        "Everyone knows about fake news."
      ],
      0,
      "A strong problem statement is clear and academic."
    ],
    [
      "Choose the best cause sentence.",
      "",
      [
        "One possible cause is irresponsible online communication.",
        "The cause is people.",
        "It happens because of many things.",
        "No one really knows."
      ],
      0,
      "A good cause sentence is specific."
    ],
    [
      "Choose the best evidence sentence.",
      "",
      [
        "Interviews showed that many students were unsure how to cite AI assistance.",
        "Many people say this is a problem.",
        "It is everywhere online.",
        "I have seen it before."
      ],
      0,
      "Evidence should be specific and credible."
    ],
    [
      "Choose the best solution sentence.",
      "",
      [
        "Universities could provide campus learning support points to address this issue.",
        "People should just stop.",
        "Everyone should be better.",
        "The internet should disappear."
      ],
      0,
      "A good solution is realistic and specific."
    ],
    [
      "Choose the best final presentation structure.",
      "",
      [
        "Problem → Cause → Evidence → Solution → Conclusion",
        "Opinion → Story → Joke → End",
        "Title → Picture → Ending",
        "Cause only → No evidence"
      ],
      0,
      "This structure supports academic problem-solution presentation."
    ],
    [
      "Choose the best problem statement.",
      "",
      [
        "Poor health awareness can affect students and academic decision-making.",
        "Poor health awareness is bad stuff.",
        "I do not like poor health awareness.",
        "Everyone knows about poor health awareness."
      ],
      0,
      "A strong problem statement is clear and academic."
    ],
    [
      "Choose the best cause sentence.",
      "",
      [
        "One possible cause is limited recycling behavior on campus.",
        "The cause is people.",
        "It happens because of many things.",
        "No one really knows."
      ],
      0,
      "A good cause sentence is specific."
    ],
    [
      "Choose the best evidence sentence.",
      "",
      [
        "Pre-test results showed low reading confidence.",
        "Many people say this is a problem.",
        "It is everywhere online.",
        "I have seen it before."
      ],
      0,
      "Evidence should be specific and credible."
    ],
    [
      "Choose the best solution sentence.",
      "",
      [
        "Universities could provide structured presentation rehearsal to address this issue.",
        "People should just stop.",
        "Everyone should be better.",
        "The internet should disappear."
      ],
      0,
      "A good solution is realistic and specific."
    ],
    [
      "Choose the best final presentation structure.",
      "",
      [
        "Problem → Cause → Evidence → Solution → Conclusion",
        "Opinion → Story → Joke → End",
        "Title → Picture → Ending",
        "Cause only → No evidence"
      ],
      0,
      "This structure supports academic problem-solution presentation."
    ],
    [
      "Choose the best problem statement.",
      "",
      [
        "Fake news can affect students and academic decision-making.",
        "Fake news is bad stuff.",
        "I do not like fake news.",
        "Everyone knows about fake news."
      ],
      0,
      "A strong problem statement is clear and academic."
    ],
    [
      "Choose the best cause sentence.",
      "",
      [
        "One possible cause is irresponsible online communication.",
        "The cause is people.",
        "It happens because of many things.",
        "No one really knows."
      ],
      0,
      "A good cause sentence is specific."
    ],
    [
      "Choose the best evidence sentence.",
      "",
      [
        "Interviews showed that many students were unsure how to cite AI assistance.",
        "Many people say this is a problem.",
        "It is everywhere online.",
        "I have seen it before."
      ],
      0,
      "Evidence should be specific and credible."
    ],
    [
      "Choose the best solution sentence.",
      "",
      [
        "Universities could provide campus learning support points to address this issue.",
        "People should just stop.",
        "Everyone should be better.",
        "The internet should disappear."
      ],
      0,
      "A good solution is realistic and specific."
    ],
    [
      "Choose the best final presentation structure.",
      "",
      [
        "Problem → Cause → Evidence → Solution → Conclusion",
        "Opinion → Story → Joke → End",
        "Title → Picture → Ending",
        "Cause only → No evidence"
      ],
      0,
      "This structure supports academic problem-solution presentation."
    ],
    [
      "Choose the best problem statement.",
      "",
      [
        "Poor health awareness can affect students and academic decision-making.",
        "Poor health awareness is bad stuff.",
        "I do not like poor health awareness.",
        "Everyone knows about poor health awareness."
      ],
      0,
      "A strong problem statement is clear and academic."
    ],
    [
      "Choose the best cause sentence.",
      "",
      [
        "One possible cause is limited recycling behavior on campus.",
        "The cause is people.",
        "It happens because of many things.",
        "No one really knows."
      ],
      0,
      "A good cause sentence is specific."
    ],
    [
      "Choose the best evidence sentence.",
      "",
      [
        "Pre-test results showed low reading confidence.",
        "Many people say this is a problem.",
        "It is everywhere online.",
        "I have seen it before."
      ],
      0,
      "Evidence should be specific and credible."
    ],
    [
      "Choose the best solution sentence.",
      "",
      [
        "Universities could provide structured presentation rehearsal to address this issue.",
        "People should just stop.",
        "Everyone should be better.",
        "The internet should disappear."
      ],
      0,
      "A good solution is realistic and specific."
    ],
    [
      "Choose the best final presentation structure.",
      "",
      [
        "Problem → Cause → Evidence → Solution → Conclusion",
        "Opinion → Story → Joke → End",
        "Title → Picture → Ending",
        "Cause only → No evidence"
      ],
      0,
      "This structure supports academic problem-solution presentation."
    ],
    [
      "Choose the best problem statement.",
      "",
      [
        "Fake news can affect students and academic decision-making.",
        "Fake news is bad stuff.",
        "I do not like fake news.",
        "Everyone knows about fake news."
      ],
      0,
      "A strong problem statement is clear and academic."
    ],
    [
      "Choose the best cause sentence.",
      "",
      [
        "One possible cause is irresponsible online communication.",
        "The cause is people.",
        "It happens because of many things.",
        "No one really knows."
      ],
      0,
      "A good cause sentence is specific."
    ],
    [
      "Choose the best evidence sentence.",
      "",
      [
        "Interviews showed that many students were unsure how to cite AI assistance.",
        "Many people say this is a problem.",
        "It is everywhere online.",
        "I have seen it before."
      ],
      0,
      "Evidence should be specific and credible."
    ],
    [
      "Choose the best solution sentence.",
      "",
      [
        "Universities could provide campus learning support points to address this issue.",
        "People should just stop.",
        "Everyone should be better.",
        "The internet should disappear."
      ],
      0,
      "A good solution is realistic and specific."
    ],
    [
      "Choose the best final presentation structure.",
      "",
      [
        "Problem → Cause → Evidence → Solution → Conclusion",
        "Opinion → Story → Joke → End",
        "Title → Picture → Ending",
        "Cause only → No evidence"
      ],
      0,
      "This structure supports academic problem-solution presentation."
    ]
  ]
};
    Object.keys(EXAM_EXTRA).forEach(key => {
      const session = SESSIONS.find(s => s.id === Number(key));
      if(!session) return;
      EXAM_EXTRA[key].forEach((q, idx) => {
        session.questions.push(mcq(
          `S${String(key).padStart(2,'0')}_E${String(idx+1).padStart(2,'0')}`,
          q[0], q[1], q[2], q[3], q[4]
        ));
      });
    });
  }
  addExamReadyQuestions();


  // Balanced Item Bank v1e: options are designed with similar length and plausible distractors.
  function addBalancedQuestionsV1e(){
    const BALANCED_BANK = {
  "1": [
    {
      "id": "S01_B01",
      "type": "mcq",
      "question": "Which academic goal is the most specific and useful?",
      "context": "",
      "choices": [
        "I will improve my academic vocabulary by reviewing target words after each class.",
        "I will study English more often when I have enough free time.",
        "I will try to get a better score by answering more quickly.",
        "I will avoid difficult tasks until my English becomes stronger."
      ],
      "answer": 0,
      "feedback": "The correct goal names a specific EAP skill and a practice action.",
      "quality": "goal_0",
      "skillTag": "Academic Mindset",
      "stemGroup": "Which academic goal is the most specific and usefu"
    },
    {
      "id": "S01_B02",
      "type": "mcq",
      "question": "Which academic goal is the most specific and useful?",
      "context": "",
      "choices": [
        "I will improve my main idea reading by identifying the writer’s central point.",
        "I will study English more often when I have enough free time.",
        "I will try to get a better score by answering more quickly.",
        "I will avoid difficult tasks until my English becomes stronger."
      ],
      "answer": 0,
      "feedback": "The correct goal names a specific EAP skill and a practice action.",
      "quality": "goal_1",
      "skillTag": "Academic Mindset",
      "stemGroup": "Which academic goal is the most specific and usefu"
    },
    {
      "id": "S01_B03",
      "type": "mcq",
      "question": "Which academic goal is the most specific and useful?",
      "context": "",
      "choices": [
        "I will improve my critical reading by checking claims and evidence in sources.",
        "I will study English more often when I have enough free time.",
        "I will try to get a better score by answering more quickly.",
        "I will avoid difficult tasks until my English becomes stronger."
      ],
      "answer": 0,
      "feedback": "The correct goal names a specific EAP skill and a practice action.",
      "quality": "goal_2",
      "skillTag": "Academic Mindset",
      "stemGroup": "Which academic goal is the most specific and usefu"
    },
    {
      "id": "S01_B04",
      "type": "mcq",
      "question": "Which academic goal is the most specific and useful?",
      "context": "",
      "choices": [
        "I will improve my summary writing by restating key ideas in fewer words.",
        "I will study English more often when I have enough free time.",
        "I will try to get a better score by answering more quickly.",
        "I will avoid difficult tasks until my English becomes stronger."
      ],
      "answer": 0,
      "feedback": "The correct goal names a specific EAP skill and a practice action.",
      "quality": "goal_3",
      "skillTag": "Academic Mindset",
      "stemGroup": "Which academic goal is the most specific and usefu"
    },
    {
      "id": "S01_B05",
      "type": "mcq",
      "question": "Which academic goal is the most specific and useful?",
      "context": "",
      "choices": [
        "I will improve my academic tone by using formal and precise sentence choices.",
        "I will study English more often when I have enough free time.",
        "I will try to get a better score by answering more quickly.",
        "I will avoid difficult tasks until my English becomes stronger."
      ],
      "answer": 0,
      "feedback": "The correct goal names a specific EAP skill and a practice action.",
      "quality": "goal_4",
      "skillTag": "Academic Mindset",
      "stemGroup": "Which academic goal is the most specific and usefu"
    },
    {
      "id": "S01_B06",
      "type": "mcq",
      "question": "Which academic goal is the most specific and useful?",
      "context": "",
      "choices": [
        "I will improve my paragraph writing by organizing ideas with clear support.",
        "I will study English more often when I have enough free time.",
        "I will try to get a better score by answering more quickly.",
        "I will avoid difficult tasks until my English becomes stronger."
      ],
      "answer": 0,
      "feedback": "The correct goal names a specific EAP skill and a practice action.",
      "quality": "goal_5",
      "skillTag": "Academic Mindset",
      "stemGroup": "Which academic goal is the most specific and usefu"
    },
    {
      "id": "S01_B07",
      "type": "mcq",
      "question": "Which academic goal is the most specific and useful?",
      "context": "",
      "choices": [
        "I will improve my data description by explaining major trends in simple charts.",
        "I will study English more often when I have enough free time.",
        "I will try to get a better score by answering more quickly.",
        "I will avoid difficult tasks until my English becomes stronger."
      ],
      "answer": 0,
      "feedback": "The correct goal names a specific EAP skill and a practice action.",
      "quality": "goal_6",
      "skillTag": "Academic Mindset",
      "stemGroup": "Which academic goal is the most specific and usefu"
    },
    {
      "id": "S01_B08",
      "type": "mcq",
      "question": "Which academic goal is the most specific and useful?",
      "context": "",
      "choices": [
        "I will improve my academic email by writing polite and specific requests.",
        "I will study English more often when I have enough free time.",
        "I will try to get a better score by answering more quickly.",
        "I will avoid difficult tasks until my English becomes stronger."
      ],
      "answer": 0,
      "feedback": "The correct goal names a specific EAP skill and a practice action.",
      "quality": "goal_7",
      "skillTag": "Academic Mindset",
      "stemGroup": "Which academic goal is the most specific and usefu"
    },
    {
      "id": "S01_B09",
      "type": "mcq",
      "question": "Which academic goal is the most specific and useful?",
      "context": "",
      "choices": [
        "I will improve my citation ethics by acknowledging sources responsibly.",
        "I will study English more often when I have enough free time.",
        "I will try to get a better score by answering more quickly.",
        "I will avoid difficult tasks until my English becomes stronger."
      ],
      "answer": 0,
      "feedback": "The correct goal names a specific EAP skill and a practice action.",
      "quality": "goal_8",
      "skillTag": "Academic Mindset",
      "stemGroup": "Which academic goal is the most specific and usefu"
    },
    {
      "id": "S01_B10",
      "type": "mcq",
      "question": "Which academic goal is the most specific and useful?",
      "context": "",
      "choices": [
        "I will improve my presentation skills by using signposting and answering questions.",
        "I will study English more often when I have enough free time.",
        "I will try to get a better score by answering more quickly.",
        "I will avoid difficult tasks until my English becomes stronger."
      ],
      "answer": 0,
      "feedback": "The correct goal names a specific EAP skill and a practice action.",
      "quality": "goal_9",
      "skillTag": "Academic Mindset",
      "stemGroup": "Which academic goal is the most specific and usefu"
    },
    {
      "id": "S01_B11",
      "type": "mcq",
      "question": "Which academic goal is the most specific and useful?",
      "context": "",
      "choices": [
        "I will improve my academic vocabulary by reviewing target words after each class.",
        "I will study English more often when I have enough free time.",
        "I will try to get a better score by answering more quickly.",
        "I will avoid difficult tasks until my English becomes stronger."
      ],
      "answer": 0,
      "feedback": "The correct goal names a specific EAP skill and a practice action.",
      "quality": "goal_0",
      "skillTag": "Academic Mindset",
      "stemGroup": "Which academic goal is the most specific and usefu"
    },
    {
      "id": "S01_B12",
      "type": "mcq",
      "question": "Which academic goal is the most specific and useful?",
      "context": "",
      "choices": [
        "I will improve my main idea reading by identifying the writer’s central point.",
        "I will study English more often when I have enough free time.",
        "I will try to get a better score by answering more quickly.",
        "I will avoid difficult tasks until my English becomes stronger."
      ],
      "answer": 0,
      "feedback": "The correct goal names a specific EAP skill and a practice action.",
      "quality": "goal_1",
      "skillTag": "Academic Mindset",
      "stemGroup": "Which academic goal is the most specific and usefu"
    },
    {
      "id": "S01_B13",
      "type": "mcq",
      "question": "Which academic goal is the most specific and useful?",
      "context": "",
      "choices": [
        "I will improve my critical reading by checking claims and evidence in sources.",
        "I will study English more often when I have enough free time.",
        "I will try to get a better score by answering more quickly.",
        "I will avoid difficult tasks until my English becomes stronger."
      ],
      "answer": 0,
      "feedback": "The correct goal names a specific EAP skill and a practice action.",
      "quality": "goal_2",
      "skillTag": "Academic Mindset",
      "stemGroup": "Which academic goal is the most specific and usefu"
    },
    {
      "id": "S01_B14",
      "type": "mcq",
      "question": "Which academic goal is the most specific and useful?",
      "context": "",
      "choices": [
        "I will improve my summary writing by restating key ideas in fewer words.",
        "I will study English more often when I have enough free time.",
        "I will try to get a better score by answering more quickly.",
        "I will avoid difficult tasks until my English becomes stronger."
      ],
      "answer": 0,
      "feedback": "The correct goal names a specific EAP skill and a practice action.",
      "quality": "goal_3",
      "skillTag": "Academic Mindset",
      "stemGroup": "Which academic goal is the most specific and usefu"
    },
    {
      "id": "S01_B15",
      "type": "mcq",
      "question": "Which academic goal is the most specific and useful?",
      "context": "",
      "choices": [
        "I will improve my academic tone by using formal and precise sentence choices.",
        "I will study English more often when I have enough free time.",
        "I will try to get a better score by answering more quickly.",
        "I will avoid difficult tasks until my English becomes stronger."
      ],
      "answer": 0,
      "feedback": "The correct goal names a specific EAP skill and a practice action.",
      "quality": "goal_4",
      "skillTag": "Academic Mindset",
      "stemGroup": "Which academic goal is the most specific and usefu"
    },
    {
      "id": "S01_B16",
      "type": "mcq",
      "question": "Which academic goal is the most specific and useful?",
      "context": "",
      "choices": [
        "I will improve my paragraph writing by organizing ideas with clear support.",
        "I will study English more often when I have enough free time.",
        "I will try to get a better score by answering more quickly.",
        "I will avoid difficult tasks until my English becomes stronger."
      ],
      "answer": 0,
      "feedback": "The correct goal names a specific EAP skill and a practice action.",
      "quality": "goal_5",
      "skillTag": "Academic Mindset",
      "stemGroup": "Which academic goal is the most specific and usefu"
    },
    {
      "id": "S01_B17",
      "type": "mcq",
      "question": "Which academic goal is the most specific and useful?",
      "context": "",
      "choices": [
        "I will improve my data description by explaining major trends in simple charts.",
        "I will study English more often when I have enough free time.",
        "I will try to get a better score by answering more quickly.",
        "I will avoid difficult tasks until my English becomes stronger."
      ],
      "answer": 0,
      "feedback": "The correct goal names a specific EAP skill and a practice action.",
      "quality": "goal_6",
      "skillTag": "Academic Mindset",
      "stemGroup": "Which academic goal is the most specific and usefu"
    },
    {
      "id": "S01_B18",
      "type": "mcq",
      "question": "Which academic goal is the most specific and useful?",
      "context": "",
      "choices": [
        "I will improve my academic email by writing polite and specific requests.",
        "I will study English more often when I have enough free time.",
        "I will try to get a better score by answering more quickly.",
        "I will avoid difficult tasks until my English becomes stronger."
      ],
      "answer": 0,
      "feedback": "The correct goal names a specific EAP skill and a practice action.",
      "quality": "goal_7",
      "skillTag": "Academic Mindset",
      "stemGroup": "Which academic goal is the most specific and usefu"
    },
    {
      "id": "S01_B19",
      "type": "mcq",
      "question": "Which academic goal is the most specific and useful?",
      "context": "",
      "choices": [
        "I will improve my citation ethics by acknowledging sources responsibly.",
        "I will study English more often when I have enough free time.",
        "I will try to get a better score by answering more quickly.",
        "I will avoid difficult tasks until my English becomes stronger."
      ],
      "answer": 0,
      "feedback": "The correct goal names a specific EAP skill and a practice action.",
      "quality": "goal_8",
      "skillTag": "Academic Mindset",
      "stemGroup": "Which academic goal is the most specific and usefu"
    },
    {
      "id": "S01_B20",
      "type": "mcq",
      "question": "Which academic goal is the most specific and useful?",
      "context": "",
      "choices": [
        "I will improve my presentation skills by using signposting and answering questions.",
        "I will study English more often when I have enough free time.",
        "I will try to get a better score by answering more quickly.",
        "I will avoid difficult tasks until my English becomes stronger."
      ],
      "answer": 0,
      "feedback": "The correct goal names a specific EAP skill and a practice action.",
      "quality": "goal_9",
      "skillTag": "Academic Mindset",
      "stemGroup": "Which academic goal is the most specific and usefu"
    },
    {
      "id": "S01_B21",
      "type": "mcq",
      "question": "Which academic goal is the most specific and useful?",
      "context": "",
      "choices": [
        "I will improve my academic vocabulary by reviewing target words after each class.",
        "I will study English more often when I have enough free time.",
        "I will try to get a better score by answering more quickly.",
        "I will avoid difficult tasks until my English becomes stronger."
      ],
      "answer": 0,
      "feedback": "The correct goal names a specific EAP skill and a practice action.",
      "quality": "goal_0",
      "skillTag": "Academic Mindset",
      "stemGroup": "Which academic goal is the most specific and usefu"
    },
    {
      "id": "S01_B22",
      "type": "mcq",
      "question": "Which academic goal is the most specific and useful?",
      "context": "",
      "choices": [
        "I will improve my main idea reading by identifying the writer’s central point.",
        "I will study English more often when I have enough free time.",
        "I will try to get a better score by answering more quickly.",
        "I will avoid difficult tasks until my English becomes stronger."
      ],
      "answer": 0,
      "feedback": "The correct goal names a specific EAP skill and a practice action.",
      "quality": "goal_1",
      "skillTag": "Academic Mindset",
      "stemGroup": "Which academic goal is the most specific and usefu"
    },
    {
      "id": "S01_B23",
      "type": "mcq",
      "question": "Which academic goal is the most specific and useful?",
      "context": "",
      "choices": [
        "I will improve my critical reading by checking claims and evidence in sources.",
        "I will study English more often when I have enough free time.",
        "I will try to get a better score by answering more quickly.",
        "I will avoid difficult tasks until my English becomes stronger."
      ],
      "answer": 0,
      "feedback": "The correct goal names a specific EAP skill and a practice action.",
      "quality": "goal_2",
      "skillTag": "Academic Mindset",
      "stemGroup": "Which academic goal is the most specific and usefu"
    },
    {
      "id": "S01_B24",
      "type": "mcq",
      "question": "Which academic goal is the most specific and useful?",
      "context": "",
      "choices": [
        "I will improve my summary writing by restating key ideas in fewer words.",
        "I will study English more often when I have enough free time.",
        "I will try to get a better score by answering more quickly.",
        "I will avoid difficult tasks until my English becomes stronger."
      ],
      "answer": 0,
      "feedback": "The correct goal names a specific EAP skill and a practice action.",
      "quality": "goal_3",
      "skillTag": "Academic Mindset",
      "stemGroup": "Which academic goal is the most specific and usefu"
    },
    {
      "id": "S01_B25",
      "type": "mcq",
      "question": "Which academic goal is the most specific and useful?",
      "context": "",
      "choices": [
        "I will improve my academic tone by using formal and precise sentence choices.",
        "I will study English more often when I have enough free time.",
        "I will try to get a better score by answering more quickly.",
        "I will avoid difficult tasks until my English becomes stronger."
      ],
      "answer": 0,
      "feedback": "The correct goal names a specific EAP skill and a practice action.",
      "quality": "goal_4",
      "skillTag": "Academic Mindset",
      "stemGroup": "Which academic goal is the most specific and usefu"
    },
    {
      "id": "S01_B26",
      "type": "mcq",
      "question": "Which academic goal is the most specific and useful?",
      "context": "",
      "choices": [
        "I will improve my paragraph writing by organizing ideas with clear support.",
        "I will study English more often when I have enough free time.",
        "I will try to get a better score by answering more quickly.",
        "I will avoid difficult tasks until my English becomes stronger."
      ],
      "answer": 0,
      "feedback": "The correct goal names a specific EAP skill and a practice action.",
      "quality": "goal_5",
      "skillTag": "Academic Mindset",
      "stemGroup": "Which academic goal is the most specific and usefu"
    },
    {
      "id": "S01_B27",
      "type": "mcq",
      "question": "Which academic goal is the most specific and useful?",
      "context": "",
      "choices": [
        "I will improve my data description by explaining major trends in simple charts.",
        "I will study English more often when I have enough free time.",
        "I will try to get a better score by answering more quickly.",
        "I will avoid difficult tasks until my English becomes stronger."
      ],
      "answer": 0,
      "feedback": "The correct goal names a specific EAP skill and a practice action.",
      "quality": "goal_6",
      "skillTag": "Academic Mindset",
      "stemGroup": "Which academic goal is the most specific and usefu"
    },
    {
      "id": "S01_B28",
      "type": "mcq",
      "question": "Which academic goal is the most specific and useful?",
      "context": "",
      "choices": [
        "I will improve my academic email by writing polite and specific requests.",
        "I will study English more often when I have enough free time.",
        "I will try to get a better score by answering more quickly.",
        "I will avoid difficult tasks until my English becomes stronger."
      ],
      "answer": 0,
      "feedback": "The correct goal names a specific EAP skill and a practice action.",
      "quality": "goal_7",
      "skillTag": "Academic Mindset",
      "stemGroup": "Which academic goal is the most specific and usefu"
    },
    {
      "id": "S01_B29",
      "type": "mcq",
      "question": "Which academic goal is the most specific and useful?",
      "context": "",
      "choices": [
        "I will improve my citation ethics by acknowledging sources responsibly.",
        "I will study English more often when I have enough free time.",
        "I will try to get a better score by answering more quickly.",
        "I will avoid difficult tasks until my English becomes stronger."
      ],
      "answer": 0,
      "feedback": "The correct goal names a specific EAP skill and a practice action.",
      "quality": "goal_8",
      "skillTag": "Academic Mindset",
      "stemGroup": "Which academic goal is the most specific and usefu"
    },
    {
      "id": "S01_B30",
      "type": "mcq",
      "question": "Which academic goal is the most specific and useful?",
      "context": "",
      "choices": [
        "I will improve my presentation skills by using signposting and answering questions.",
        "I will study English more often when I have enough free time.",
        "I will try to get a better score by answering more quickly.",
        "I will avoid difficult tasks until my English becomes stronger."
      ],
      "answer": 0,
      "feedback": "The correct goal names a specific EAP skill and a practice action.",
      "quality": "goal_9",
      "skillTag": "Academic Mindset",
      "stemGroup": "Which academic goal is the most specific and usefu"
    },
    {
      "id": "S01_B31",
      "type": "mcq",
      "question": "Which academic goal is the most specific and useful?",
      "context": "",
      "choices": [
        "I will improve my academic vocabulary by reviewing target words after each class.",
        "I will study English more often when I have enough free time.",
        "I will try to get a better score by answering more quickly.",
        "I will avoid difficult tasks until my English becomes stronger."
      ],
      "answer": 0,
      "feedback": "The correct goal names a specific EAP skill and a practice action.",
      "quality": "goal_0",
      "skillTag": "Academic Mindset",
      "stemGroup": "Which academic goal is the most specific and usefu"
    },
    {
      "id": "S01_B32",
      "type": "mcq",
      "question": "Which academic goal is the most specific and useful?",
      "context": "",
      "choices": [
        "I will improve my main idea reading by identifying the writer’s central point.",
        "I will study English more often when I have enough free time.",
        "I will try to get a better score by answering more quickly.",
        "I will avoid difficult tasks until my English becomes stronger."
      ],
      "answer": 0,
      "feedback": "The correct goal names a specific EAP skill and a practice action.",
      "quality": "goal_1",
      "skillTag": "Academic Mindset",
      "stemGroup": "Which academic goal is the most specific and usefu"
    },
    {
      "id": "S01_B33",
      "type": "mcq",
      "question": "Which academic goal is the most specific and useful?",
      "context": "",
      "choices": [
        "I will improve my critical reading by checking claims and evidence in sources.",
        "I will study English more often when I have enough free time.",
        "I will try to get a better score by answering more quickly.",
        "I will avoid difficult tasks until my English becomes stronger."
      ],
      "answer": 0,
      "feedback": "The correct goal names a specific EAP skill and a practice action.",
      "quality": "goal_2",
      "skillTag": "Academic Mindset",
      "stemGroup": "Which academic goal is the most specific and usefu"
    },
    {
      "id": "S01_B34",
      "type": "mcq",
      "question": "Which academic goal is the most specific and useful?",
      "context": "",
      "choices": [
        "I will improve my summary writing by restating key ideas in fewer words.",
        "I will study English more often when I have enough free time.",
        "I will try to get a better score by answering more quickly.",
        "I will avoid difficult tasks until my English becomes stronger."
      ],
      "answer": 0,
      "feedback": "The correct goal names a specific EAP skill and a practice action.",
      "quality": "goal_3",
      "skillTag": "Academic Mindset",
      "stemGroup": "Which academic goal is the most specific and usefu"
    },
    {
      "id": "S01_B35",
      "type": "mcq",
      "question": "Which academic goal is the most specific and useful?",
      "context": "",
      "choices": [
        "I will improve my academic tone by using formal and precise sentence choices.",
        "I will study English more often when I have enough free time.",
        "I will try to get a better score by answering more quickly.",
        "I will avoid difficult tasks until my English becomes stronger."
      ],
      "answer": 0,
      "feedback": "The correct goal names a specific EAP skill and a practice action.",
      "quality": "goal_4",
      "skillTag": "Academic Mindset",
      "stemGroup": "Which academic goal is the most specific and usefu"
    },
    {
      "id": "S01_B36",
      "type": "mcq",
      "question": "Which academic goal is the most specific and useful?",
      "context": "",
      "choices": [
        "I will improve my paragraph writing by organizing ideas with clear support.",
        "I will study English more often when I have enough free time.",
        "I will try to get a better score by answering more quickly.",
        "I will avoid difficult tasks until my English becomes stronger."
      ],
      "answer": 0,
      "feedback": "The correct goal names a specific EAP skill and a practice action.",
      "quality": "goal_5",
      "skillTag": "Academic Mindset",
      "stemGroup": "Which academic goal is the most specific and usefu"
    },
    {
      "id": "S01_B37",
      "type": "mcq",
      "question": "Which academic goal is the most specific and useful?",
      "context": "",
      "choices": [
        "I will improve my data description by explaining major trends in simple charts.",
        "I will study English more often when I have enough free time.",
        "I will try to get a better score by answering more quickly.",
        "I will avoid difficult tasks until my English becomes stronger."
      ],
      "answer": 0,
      "feedback": "The correct goal names a specific EAP skill and a practice action.",
      "quality": "goal_6",
      "skillTag": "Academic Mindset",
      "stemGroup": "Which academic goal is the most specific and usefu"
    },
    {
      "id": "S01_B38",
      "type": "mcq",
      "question": "Which academic goal is the most specific and useful?",
      "context": "",
      "choices": [
        "I will improve my academic email by writing polite and specific requests.",
        "I will study English more often when I have enough free time.",
        "I will try to get a better score by answering more quickly.",
        "I will avoid difficult tasks until my English becomes stronger."
      ],
      "answer": 0,
      "feedback": "The correct goal names a specific EAP skill and a practice action.",
      "quality": "goal_7",
      "skillTag": "Academic Mindset",
      "stemGroup": "Which academic goal is the most specific and usefu"
    },
    {
      "id": "S01_B39",
      "type": "mcq",
      "question": "Which academic goal is the most specific and useful?",
      "context": "",
      "choices": [
        "I will improve my citation ethics by acknowledging sources responsibly.",
        "I will study English more often when I have enough free time.",
        "I will try to get a better score by answering more quickly.",
        "I will avoid difficult tasks until my English becomes stronger."
      ],
      "answer": 0,
      "feedback": "The correct goal names a specific EAP skill and a practice action.",
      "quality": "goal_8",
      "skillTag": "Academic Mindset",
      "stemGroup": "Which academic goal is the most specific and usefu"
    },
    {
      "id": "S01_B40",
      "type": "mcq",
      "question": "Which academic goal is the most specific and useful?",
      "context": "",
      "choices": [
        "I will improve my presentation skills by using signposting and answering questions.",
        "I will study English more often when I have enough free time.",
        "I will try to get a better score by answering more quickly.",
        "I will avoid difficult tasks until my English becomes stronger."
      ],
      "answer": 0,
      "feedback": "The correct goal names a specific EAP skill and a practice action.",
      "quality": "goal_9",
      "skillTag": "Academic Mindset",
      "stemGroup": "Which academic goal is the most specific and usefu"
    }
  ],
  "2": [
    {
      "id": "S02_B01",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "The researcher will ______ the interview data before writing the report.",
      "choices": [
        "analyze",
        "summarize",
        "collect",
        "organize"
      ],
      "answer": 0,
      "feedback": "Analyze means examine information carefully.",
      "quality": "vocab_0",
      "skillTag": "Academic Vocabulary",
      "stemGroup": "Choose the best academic word or connector."
    },
    {
      "id": "S02_B02",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "The paragraph needs stronger ______ to support the writer’s claim.",
      "choices": [
        "evidence",
        "method",
        "context",
        "purpose"
      ],
      "answer": 0,
      "feedback": "Evidence supports a claim.",
      "quality": "vocab_1",
      "skillTag": "Academic Vocabulary",
      "stemGroup": "Choose the best academic word or connector."
    },
    {
      "id": "S02_B03",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "The ______ section explains how participants were selected for the study.",
      "choices": [
        "method",
        "result",
        "summary",
        "citation"
      ],
      "answer": 0,
      "feedback": "Method explains the research procedure.",
      "quality": "vocab_2",
      "skillTag": "Academic Vocabulary",
      "stemGroup": "Choose the best academic word or connector."
    },
    {
      "id": "S02_B04",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "The difference was ______ because it appeared across all three groups.",
      "choices": [
        "significant",
        "consistent",
        "specific",
        "relevant"
      ],
      "answer": 0,
      "feedback": "Significant means important or meaningful.",
      "quality": "vocab_3",
      "skillTag": "Academic Vocabulary",
      "stemGroup": "Choose the best academic word or connector."
    },
    {
      "id": "S02_B05",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "The source was not reliable; ______, it should not be used as evidence.",
      "choices": [
        "therefore",
        "however",
        "moreover",
        "although"
      ],
      "answer": 0,
      "feedback": "Therefore signals result.",
      "quality": "vocab_4",
      "skillTag": "Academic Vocabulary",
      "stemGroup": "Choose the best academic word or connector."
    },
    {
      "id": "S02_B06",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "The app is convenient; ______, students still need to check accuracy.",
      "choices": [
        "however",
        "therefore",
        "for example",
        "as a result"
      ],
      "answer": 0,
      "feedback": "However signals contrast.",
      "quality": "vocab_5",
      "skillTag": "Academic Vocabulary",
      "stemGroup": "Choose the best academic word or connector."
    },
    {
      "id": "S02_B07",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "Students should ______ online information before using it in assignments.",
      "choices": [
        "evaluate",
        "describe",
        "collect",
        "present"
      ],
      "answer": 0,
      "feedback": "Evaluate means judge quality or reliability.",
      "quality": "vocab_6",
      "skillTag": "Academic Vocabulary",
      "stemGroup": "Choose the best academic word or connector."
    },
    {
      "id": "S02_B08",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "The results ______ that weekly practice improved vocabulary scores.",
      "choices": [
        "indicate",
        "define",
        "contrast",
        "replace"
      ],
      "answer": 0,
      "feedback": "Indicate means show or suggest.",
      "quality": "vocab_7",
      "skillTag": "Academic Vocabulary",
      "stemGroup": "Choose the best academic word or connector."
    },
    {
      "id": "S02_B09",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "A strong ______ should be supported with data or credible sources.",
      "choices": [
        "claim",
        "format",
        "deadline",
        "example"
      ],
      "answer": 0,
      "feedback": "A claim is an idea that needs support.",
      "quality": "vocab_8",
      "skillTag": "Academic Vocabulary",
      "stemGroup": "Choose the best academic word or connector."
    },
    {
      "id": "S02_B10",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "The findings were ______ across the three different classes.",
      "choices": [
        "consistent",
        "limited",
        "optional",
        "informal"
      ],
      "answer": 0,
      "feedback": "Consistent means showing the same pattern.",
      "quality": "vocab_9",
      "skillTag": "Academic Vocabulary",
      "stemGroup": "Choose the best academic word or connector."
    },
    {
      "id": "S02_B11",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "The researcher will ______ the interview data before writing the report.",
      "choices": [
        "analyze",
        "summarize",
        "collect",
        "organize"
      ],
      "answer": 0,
      "feedback": "Analyze means examine information carefully.",
      "quality": "vocab_0",
      "skillTag": "Academic Vocabulary",
      "stemGroup": "Choose the best academic word or connector."
    },
    {
      "id": "S02_B12",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "The paragraph needs stronger ______ to support the writer’s claim.",
      "choices": [
        "evidence",
        "method",
        "context",
        "purpose"
      ],
      "answer": 0,
      "feedback": "Evidence supports a claim.",
      "quality": "vocab_1",
      "skillTag": "Academic Vocabulary",
      "stemGroup": "Choose the best academic word or connector."
    },
    {
      "id": "S02_B13",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "The ______ section explains how participants were selected for the study.",
      "choices": [
        "method",
        "result",
        "summary",
        "citation"
      ],
      "answer": 0,
      "feedback": "Method explains the research procedure.",
      "quality": "vocab_2",
      "skillTag": "Academic Vocabulary",
      "stemGroup": "Choose the best academic word or connector."
    },
    {
      "id": "S02_B14",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "The difference was ______ because it appeared across all three groups.",
      "choices": [
        "significant",
        "consistent",
        "specific",
        "relevant"
      ],
      "answer": 0,
      "feedback": "Significant means important or meaningful.",
      "quality": "vocab_3",
      "skillTag": "Academic Vocabulary",
      "stemGroup": "Choose the best academic word or connector."
    },
    {
      "id": "S02_B15",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "The source was not reliable; ______, it should not be used as evidence.",
      "choices": [
        "therefore",
        "however",
        "moreover",
        "although"
      ],
      "answer": 0,
      "feedback": "Therefore signals result.",
      "quality": "vocab_4",
      "skillTag": "Academic Vocabulary",
      "stemGroup": "Choose the best academic word or connector."
    },
    {
      "id": "S02_B16",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "The app is convenient; ______, students still need to check accuracy.",
      "choices": [
        "however",
        "therefore",
        "for example",
        "as a result"
      ],
      "answer": 0,
      "feedback": "However signals contrast.",
      "quality": "vocab_5",
      "skillTag": "Academic Vocabulary",
      "stemGroup": "Choose the best academic word or connector."
    },
    {
      "id": "S02_B17",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "Students should ______ online information before using it in assignments.",
      "choices": [
        "evaluate",
        "describe",
        "collect",
        "present"
      ],
      "answer": 0,
      "feedback": "Evaluate means judge quality or reliability.",
      "quality": "vocab_6",
      "skillTag": "Academic Vocabulary",
      "stemGroup": "Choose the best academic word or connector."
    },
    {
      "id": "S02_B18",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "The results ______ that weekly practice improved vocabulary scores.",
      "choices": [
        "indicate",
        "define",
        "contrast",
        "replace"
      ],
      "answer": 0,
      "feedback": "Indicate means show or suggest.",
      "quality": "vocab_7",
      "skillTag": "Academic Vocabulary",
      "stemGroup": "Choose the best academic word or connector."
    },
    {
      "id": "S02_B19",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "A strong ______ should be supported with data or credible sources.",
      "choices": [
        "claim",
        "format",
        "deadline",
        "example"
      ],
      "answer": 0,
      "feedback": "A claim is an idea that needs support.",
      "quality": "vocab_8",
      "skillTag": "Academic Vocabulary",
      "stemGroup": "Choose the best academic word or connector."
    },
    {
      "id": "S02_B20",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "The findings were ______ across the three different classes.",
      "choices": [
        "consistent",
        "limited",
        "optional",
        "informal"
      ],
      "answer": 0,
      "feedback": "Consistent means showing the same pattern.",
      "quality": "vocab_9",
      "skillTag": "Academic Vocabulary",
      "stemGroup": "Choose the best academic word or connector."
    },
    {
      "id": "S02_B21",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "The researcher will ______ the interview data before writing the report.",
      "choices": [
        "analyze",
        "summarize",
        "collect",
        "organize"
      ],
      "answer": 0,
      "feedback": "Analyze means examine information carefully.",
      "quality": "vocab_0",
      "skillTag": "Academic Vocabulary",
      "stemGroup": "Choose the best academic word or connector."
    },
    {
      "id": "S02_B22",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "The paragraph needs stronger ______ to support the writer’s claim.",
      "choices": [
        "evidence",
        "method",
        "context",
        "purpose"
      ],
      "answer": 0,
      "feedback": "Evidence supports a claim.",
      "quality": "vocab_1",
      "skillTag": "Academic Vocabulary",
      "stemGroup": "Choose the best academic word or connector."
    },
    {
      "id": "S02_B23",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "The ______ section explains how participants were selected for the study.",
      "choices": [
        "method",
        "result",
        "summary",
        "citation"
      ],
      "answer": 0,
      "feedback": "Method explains the research procedure.",
      "quality": "vocab_2",
      "skillTag": "Academic Vocabulary",
      "stemGroup": "Choose the best academic word or connector."
    },
    {
      "id": "S02_B24",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "The difference was ______ because it appeared across all three groups.",
      "choices": [
        "significant",
        "consistent",
        "specific",
        "relevant"
      ],
      "answer": 0,
      "feedback": "Significant means important or meaningful.",
      "quality": "vocab_3",
      "skillTag": "Academic Vocabulary",
      "stemGroup": "Choose the best academic word or connector."
    },
    {
      "id": "S02_B25",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "The source was not reliable; ______, it should not be used as evidence.",
      "choices": [
        "therefore",
        "however",
        "moreover",
        "although"
      ],
      "answer": 0,
      "feedback": "Therefore signals result.",
      "quality": "vocab_4",
      "skillTag": "Academic Vocabulary",
      "stemGroup": "Choose the best academic word or connector."
    },
    {
      "id": "S02_B26",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "The app is convenient; ______, students still need to check accuracy.",
      "choices": [
        "however",
        "therefore",
        "for example",
        "as a result"
      ],
      "answer": 0,
      "feedback": "However signals contrast.",
      "quality": "vocab_5",
      "skillTag": "Academic Vocabulary",
      "stemGroup": "Choose the best academic word or connector."
    },
    {
      "id": "S02_B27",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "Students should ______ online information before using it in assignments.",
      "choices": [
        "evaluate",
        "describe",
        "collect",
        "present"
      ],
      "answer": 0,
      "feedback": "Evaluate means judge quality or reliability.",
      "quality": "vocab_6",
      "skillTag": "Academic Vocabulary",
      "stemGroup": "Choose the best academic word or connector."
    },
    {
      "id": "S02_B28",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "The results ______ that weekly practice improved vocabulary scores.",
      "choices": [
        "indicate",
        "define",
        "contrast",
        "replace"
      ],
      "answer": 0,
      "feedback": "Indicate means show or suggest.",
      "quality": "vocab_7",
      "skillTag": "Academic Vocabulary",
      "stemGroup": "Choose the best academic word or connector."
    },
    {
      "id": "S02_B29",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "A strong ______ should be supported with data or credible sources.",
      "choices": [
        "claim",
        "format",
        "deadline",
        "example"
      ],
      "answer": 0,
      "feedback": "A claim is an idea that needs support.",
      "quality": "vocab_8",
      "skillTag": "Academic Vocabulary",
      "stemGroup": "Choose the best academic word or connector."
    },
    {
      "id": "S02_B30",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "The findings were ______ across the three different classes.",
      "choices": [
        "consistent",
        "limited",
        "optional",
        "informal"
      ],
      "answer": 0,
      "feedback": "Consistent means showing the same pattern.",
      "quality": "vocab_9",
      "skillTag": "Academic Vocabulary",
      "stemGroup": "Choose the best academic word or connector."
    },
    {
      "id": "S02_B31",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "The researcher will ______ the interview data before writing the report.",
      "choices": [
        "analyze",
        "summarize",
        "collect",
        "organize"
      ],
      "answer": 0,
      "feedback": "Analyze means examine information carefully.",
      "quality": "vocab_0",
      "skillTag": "Academic Vocabulary",
      "stemGroup": "Choose the best academic word or connector."
    },
    {
      "id": "S02_B32",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "The paragraph needs stronger ______ to support the writer’s claim.",
      "choices": [
        "evidence",
        "method",
        "context",
        "purpose"
      ],
      "answer": 0,
      "feedback": "Evidence supports a claim.",
      "quality": "vocab_1",
      "skillTag": "Academic Vocabulary",
      "stemGroup": "Choose the best academic word or connector."
    },
    {
      "id": "S02_B33",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "The ______ section explains how participants were selected for the study.",
      "choices": [
        "method",
        "result",
        "summary",
        "citation"
      ],
      "answer": 0,
      "feedback": "Method explains the research procedure.",
      "quality": "vocab_2",
      "skillTag": "Academic Vocabulary",
      "stemGroup": "Choose the best academic word or connector."
    },
    {
      "id": "S02_B34",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "The difference was ______ because it appeared across all three groups.",
      "choices": [
        "significant",
        "consistent",
        "specific",
        "relevant"
      ],
      "answer": 0,
      "feedback": "Significant means important or meaningful.",
      "quality": "vocab_3",
      "skillTag": "Academic Vocabulary",
      "stemGroup": "Choose the best academic word or connector."
    },
    {
      "id": "S02_B35",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "The source was not reliable; ______, it should not be used as evidence.",
      "choices": [
        "therefore",
        "however",
        "moreover",
        "although"
      ],
      "answer": 0,
      "feedback": "Therefore signals result.",
      "quality": "vocab_4",
      "skillTag": "Academic Vocabulary",
      "stemGroup": "Choose the best academic word or connector."
    },
    {
      "id": "S02_B36",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "The app is convenient; ______, students still need to check accuracy.",
      "choices": [
        "however",
        "therefore",
        "for example",
        "as a result"
      ],
      "answer": 0,
      "feedback": "However signals contrast.",
      "quality": "vocab_5",
      "skillTag": "Academic Vocabulary",
      "stemGroup": "Choose the best academic word or connector."
    },
    {
      "id": "S02_B37",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "Students should ______ online information before using it in assignments.",
      "choices": [
        "evaluate",
        "describe",
        "collect",
        "present"
      ],
      "answer": 0,
      "feedback": "Evaluate means judge quality or reliability.",
      "quality": "vocab_6",
      "skillTag": "Academic Vocabulary",
      "stemGroup": "Choose the best academic word or connector."
    },
    {
      "id": "S02_B38",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "The results ______ that weekly practice improved vocabulary scores.",
      "choices": [
        "indicate",
        "define",
        "contrast",
        "replace"
      ],
      "answer": 0,
      "feedback": "Indicate means show or suggest.",
      "quality": "vocab_7",
      "skillTag": "Academic Vocabulary",
      "stemGroup": "Choose the best academic word or connector."
    },
    {
      "id": "S02_B39",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "A strong ______ should be supported with data or credible sources.",
      "choices": [
        "claim",
        "format",
        "deadline",
        "example"
      ],
      "answer": 0,
      "feedback": "A claim is an idea that needs support.",
      "quality": "vocab_8",
      "skillTag": "Academic Vocabulary",
      "stemGroup": "Choose the best academic word or connector."
    },
    {
      "id": "S02_B40",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "The findings were ______ across the three different classes.",
      "choices": [
        "consistent",
        "limited",
        "optional",
        "informal"
      ],
      "answer": 0,
      "feedback": "Consistent means showing the same pattern.",
      "quality": "vocab_9",
      "skillTag": "Academic Vocabulary",
      "stemGroup": "Choose the best academic word or connector."
    }
  ],
  "3": [
    {
      "id": "S03_B01",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Digital literacy helps students evaluate online sources and avoid misinformation. It also supports responsible communication when students share information online.",
      "choices": [
        "Digital literacy supports responsible evaluation and communication online.",
        "Digital literacy includes evaluating online sources before sharing.",
        "Communication online is common among university students.",
        "Students use online information in many different situations."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_0",
      "skillTag": "Main Idea Reading",
      "stemGroup": "Which option best states the main idea?"
    },
    {
      "id": "S03_B02",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Peer feedback helps students notice unclear ideas in a draft. It can also improve paragraph organization before final submission.",
      "choices": [
        "Peer feedback can improve clarity and organization in writing.",
        "Students often submit drafts before the final assignment.",
        "Paragraph organization is one part of academic writing.",
        "Feedback may come from classmates or instructors."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_1",
      "skillTag": "Main Idea Reading",
      "stemGroup": "Which option best states the main idea?"
    },
    {
      "id": "S03_B03",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Academic vocabulary helps students understand textbooks and research articles. Without key terms, they may misunderstand the writer’s argument.",
      "choices": [
        "Academic vocabulary supports understanding of academic texts.",
        "Research articles often contain difficult technical words.",
        "Students sometimes misunderstand textbook arguments.",
        "Vocabulary learning can happen inside or outside class."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_2",
      "skillTag": "Main Idea Reading",
      "stemGroup": "Which option best states the main idea?"
    },
    {
      "id": "S03_B04",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Citation helps readers locate the original sources of information. It also shows that writers respect academic integrity.",
      "choices": [
        "Citation supports source tracing and academic integrity.",
        "Readers can use citations to find original sources.",
        "Academic integrity is important in university writing.",
        "Writers include sources in many types of assignments."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_3",
      "skillTag": "Main Idea Reading",
      "stemGroup": "Which option best states the main idea?"
    },
    {
      "id": "S03_B05",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Online learning platforms provide videos, quizzes, and feedback. These tools help students practice outside the classroom.",
      "choices": [
        "Online learning platforms support practice beyond class time.",
        "Videos and quizzes are common tools on learning platforms.",
        "Feedback can help students understand their mistakes.",
        "Classroom learning is not the only way students practice."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_4",
      "skillTag": "Main Idea Reading",
      "stemGroup": "Which option best states the main idea?"
    },
    {
      "id": "S03_B06",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Critical reading requires checking claims and evidence. This skill is important when students read online information.",
      "choices": [
        "Critical reading helps students evaluate claims and evidence.",
        "Students read online information in many daily situations.",
        "Evidence should be checked before accepting a claim.",
        "Online information may include both facts and opinions."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_5",
      "skillTag": "Main Idea Reading",
      "stemGroup": "Which option best states the main idea?"
    },
    {
      "id": "S03_B07",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Summarizing requires students to identify key points and restate them briefly. This skill helps reduce copying from sources.",
      "choices": [
        "Summarizing helps students express key ideas briefly and ethically.",
        "Students need to identify key points before writing summaries.",
        "Copying from sources can create academic problems.",
        "Brief writing is often required in academic tasks."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_6",
      "skillTag": "Main Idea Reading",
      "stemGroup": "Which option best states the main idea?"
    },
    {
      "id": "S03_B08",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Data description should focus on major trends rather than every number. This helps readers understand the main pattern quickly.",
      "choices": [
        "Data description should highlight major trends clearly.",
        "Writers sometimes list many numbers from tables.",
        "Readers need help understanding patterns in data.",
        "Major trends may include increases or decreases."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_7",
      "skillTag": "Main Idea Reading",
      "stemGroup": "Which option best states the main idea?"
    },
    {
      "id": "S03_B09",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Academic email should be polite and specific. A clear subject and respectful request help instructors respond effectively.",
      "choices": [
        "Academic email requires polite and clear communication.",
        "A subject line helps instructors identify the topic.",
        "Respectful requests are useful in university contexts.",
        "Instructors receive many emails from students."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_8",
      "skillTag": "Main Idea Reading",
      "stemGroup": "Which option best states the main idea?"
    },
    {
      "id": "S03_B10",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Presentation signposting helps audiences follow the speaker’s structure. Phrases such as first, next, and in conclusion guide listeners.",
      "choices": [
        "Signposting helps audiences follow academic presentations.",
        "Speakers can use phrases such as first and next.",
        "Audiences need to understand the structure of a talk.",
        "Presentations often include introductions and conclusions."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_9",
      "skillTag": "Main Idea Reading",
      "stemGroup": "Which option best states the main idea?"
    },
    {
      "id": "S03_B11",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Digital literacy helps students evaluate online sources and avoid misinformation. It also supports responsible communication when students share information online.",
      "choices": [
        "Digital literacy supports responsible evaluation and communication online.",
        "Digital literacy includes evaluating online sources before sharing.",
        "Communication online is common among university students.",
        "Students use online information in many different situations."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_0",
      "skillTag": "Main Idea Reading",
      "stemGroup": "Which option best states the main idea?"
    },
    {
      "id": "S03_B12",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Peer feedback helps students notice unclear ideas in a draft. It can also improve paragraph organization before final submission.",
      "choices": [
        "Peer feedback can improve clarity and organization in writing.",
        "Students often submit drafts before the final assignment.",
        "Paragraph organization is one part of academic writing.",
        "Feedback may come from classmates or instructors."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_1",
      "skillTag": "Main Idea Reading",
      "stemGroup": "Which option best states the main idea?"
    },
    {
      "id": "S03_B13",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Academic vocabulary helps students understand textbooks and research articles. Without key terms, they may misunderstand the writer’s argument.",
      "choices": [
        "Academic vocabulary supports understanding of academic texts.",
        "Research articles often contain difficult technical words.",
        "Students sometimes misunderstand textbook arguments.",
        "Vocabulary learning can happen inside or outside class."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_2",
      "skillTag": "Main Idea Reading",
      "stemGroup": "Which option best states the main idea?"
    },
    {
      "id": "S03_B14",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Citation helps readers locate the original sources of information. It also shows that writers respect academic integrity.",
      "choices": [
        "Citation supports source tracing and academic integrity.",
        "Readers can use citations to find original sources.",
        "Academic integrity is important in university writing.",
        "Writers include sources in many types of assignments."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_3",
      "skillTag": "Main Idea Reading",
      "stemGroup": "Which option best states the main idea?"
    },
    {
      "id": "S03_B15",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Online learning platforms provide videos, quizzes, and feedback. These tools help students practice outside the classroom.",
      "choices": [
        "Online learning platforms support practice beyond class time.",
        "Videos and quizzes are common tools on learning platforms.",
        "Feedback can help students understand their mistakes.",
        "Classroom learning is not the only way students practice."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_4",
      "skillTag": "Main Idea Reading",
      "stemGroup": "Which option best states the main idea?"
    },
    {
      "id": "S03_B16",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Critical reading requires checking claims and evidence. This skill is important when students read online information.",
      "choices": [
        "Critical reading helps students evaluate claims and evidence.",
        "Students read online information in many daily situations.",
        "Evidence should be checked before accepting a claim.",
        "Online information may include both facts and opinions."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_5",
      "skillTag": "Main Idea Reading",
      "stemGroup": "Which option best states the main idea?"
    },
    {
      "id": "S03_B17",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Summarizing requires students to identify key points and restate them briefly. This skill helps reduce copying from sources.",
      "choices": [
        "Summarizing helps students express key ideas briefly and ethically.",
        "Students need to identify key points before writing summaries.",
        "Copying from sources can create academic problems.",
        "Brief writing is often required in academic tasks."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_6",
      "skillTag": "Main Idea Reading",
      "stemGroup": "Which option best states the main idea?"
    },
    {
      "id": "S03_B18",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Data description should focus on major trends rather than every number. This helps readers understand the main pattern quickly.",
      "choices": [
        "Data description should highlight major trends clearly.",
        "Writers sometimes list many numbers from tables.",
        "Readers need help understanding patterns in data.",
        "Major trends may include increases or decreases."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_7",
      "skillTag": "Main Idea Reading",
      "stemGroup": "Which option best states the main idea?"
    },
    {
      "id": "S03_B19",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Academic email should be polite and specific. A clear subject and respectful request help instructors respond effectively.",
      "choices": [
        "Academic email requires polite and clear communication.",
        "A subject line helps instructors identify the topic.",
        "Respectful requests are useful in university contexts.",
        "Instructors receive many emails from students."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_8",
      "skillTag": "Main Idea Reading",
      "stemGroup": "Which option best states the main idea?"
    },
    {
      "id": "S03_B20",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Presentation signposting helps audiences follow the speaker’s structure. Phrases such as first, next, and in conclusion guide listeners.",
      "choices": [
        "Signposting helps audiences follow academic presentations.",
        "Speakers can use phrases such as first and next.",
        "Audiences need to understand the structure of a talk.",
        "Presentations often include introductions and conclusions."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_9",
      "skillTag": "Main Idea Reading",
      "stemGroup": "Which option best states the main idea?"
    },
    {
      "id": "S03_B21",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Digital literacy helps students evaluate online sources and avoid misinformation. It also supports responsible communication when students share information online.",
      "choices": [
        "Digital literacy supports responsible evaluation and communication online.",
        "Digital literacy includes evaluating online sources before sharing.",
        "Communication online is common among university students.",
        "Students use online information in many different situations."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_0",
      "skillTag": "Main Idea Reading",
      "stemGroup": "Which option best states the main idea?"
    },
    {
      "id": "S03_B22",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Peer feedback helps students notice unclear ideas in a draft. It can also improve paragraph organization before final submission.",
      "choices": [
        "Peer feedback can improve clarity and organization in writing.",
        "Students often submit drafts before the final assignment.",
        "Paragraph organization is one part of academic writing.",
        "Feedback may come from classmates or instructors."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_1",
      "skillTag": "Main Idea Reading",
      "stemGroup": "Which option best states the main idea?"
    },
    {
      "id": "S03_B23",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Academic vocabulary helps students understand textbooks and research articles. Without key terms, they may misunderstand the writer’s argument.",
      "choices": [
        "Academic vocabulary supports understanding of academic texts.",
        "Research articles often contain difficult technical words.",
        "Students sometimes misunderstand textbook arguments.",
        "Vocabulary learning can happen inside or outside class."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_2",
      "skillTag": "Main Idea Reading",
      "stemGroup": "Which option best states the main idea?"
    },
    {
      "id": "S03_B24",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Citation helps readers locate the original sources of information. It also shows that writers respect academic integrity.",
      "choices": [
        "Citation supports source tracing and academic integrity.",
        "Readers can use citations to find original sources.",
        "Academic integrity is important in university writing.",
        "Writers include sources in many types of assignments."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_3",
      "skillTag": "Main Idea Reading",
      "stemGroup": "Which option best states the main idea?"
    },
    {
      "id": "S03_B25",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Online learning platforms provide videos, quizzes, and feedback. These tools help students practice outside the classroom.",
      "choices": [
        "Online learning platforms support practice beyond class time.",
        "Videos and quizzes are common tools on learning platforms.",
        "Feedback can help students understand their mistakes.",
        "Classroom learning is not the only way students practice."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_4",
      "skillTag": "Main Idea Reading",
      "stemGroup": "Which option best states the main idea?"
    },
    {
      "id": "S03_B26",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Critical reading requires checking claims and evidence. This skill is important when students read online information.",
      "choices": [
        "Critical reading helps students evaluate claims and evidence.",
        "Students read online information in many daily situations.",
        "Evidence should be checked before accepting a claim.",
        "Online information may include both facts and opinions."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_5",
      "skillTag": "Main Idea Reading",
      "stemGroup": "Which option best states the main idea?"
    },
    {
      "id": "S03_B27",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Summarizing requires students to identify key points and restate them briefly. This skill helps reduce copying from sources.",
      "choices": [
        "Summarizing helps students express key ideas briefly and ethically.",
        "Students need to identify key points before writing summaries.",
        "Copying from sources can create academic problems.",
        "Brief writing is often required in academic tasks."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_6",
      "skillTag": "Main Idea Reading",
      "stemGroup": "Which option best states the main idea?"
    },
    {
      "id": "S03_B28",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Data description should focus on major trends rather than every number. This helps readers understand the main pattern quickly.",
      "choices": [
        "Data description should highlight major trends clearly.",
        "Writers sometimes list many numbers from tables.",
        "Readers need help understanding patterns in data.",
        "Major trends may include increases or decreases."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_7",
      "skillTag": "Main Idea Reading",
      "stemGroup": "Which option best states the main idea?"
    },
    {
      "id": "S03_B29",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Academic email should be polite and specific. A clear subject and respectful request help instructors respond effectively.",
      "choices": [
        "Academic email requires polite and clear communication.",
        "A subject line helps instructors identify the topic.",
        "Respectful requests are useful in university contexts.",
        "Instructors receive many emails from students."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_8",
      "skillTag": "Main Idea Reading",
      "stemGroup": "Which option best states the main idea?"
    },
    {
      "id": "S03_B30",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Presentation signposting helps audiences follow the speaker’s structure. Phrases such as first, next, and in conclusion guide listeners.",
      "choices": [
        "Signposting helps audiences follow academic presentations.",
        "Speakers can use phrases such as first and next.",
        "Audiences need to understand the structure of a talk.",
        "Presentations often include introductions and conclusions."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_9",
      "skillTag": "Main Idea Reading",
      "stemGroup": "Which option best states the main idea?"
    },
    {
      "id": "S03_B31",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Digital literacy helps students evaluate online sources and avoid misinformation. It also supports responsible communication when students share information online.",
      "choices": [
        "Digital literacy supports responsible evaluation and communication online.",
        "Digital literacy includes evaluating online sources before sharing.",
        "Communication online is common among university students.",
        "Students use online information in many different situations."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_0",
      "skillTag": "Main Idea Reading",
      "stemGroup": "Which option best states the main idea?"
    },
    {
      "id": "S03_B32",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Peer feedback helps students notice unclear ideas in a draft. It can also improve paragraph organization before final submission.",
      "choices": [
        "Peer feedback can improve clarity and organization in writing.",
        "Students often submit drafts before the final assignment.",
        "Paragraph organization is one part of academic writing.",
        "Feedback may come from classmates or instructors."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_1",
      "skillTag": "Main Idea Reading",
      "stemGroup": "Which option best states the main idea?"
    },
    {
      "id": "S03_B33",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Academic vocabulary helps students understand textbooks and research articles. Without key terms, they may misunderstand the writer’s argument.",
      "choices": [
        "Academic vocabulary supports understanding of academic texts.",
        "Research articles often contain difficult technical words.",
        "Students sometimes misunderstand textbook arguments.",
        "Vocabulary learning can happen inside or outside class."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_2",
      "skillTag": "Main Idea Reading",
      "stemGroup": "Which option best states the main idea?"
    },
    {
      "id": "S03_B34",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Citation helps readers locate the original sources of information. It also shows that writers respect academic integrity.",
      "choices": [
        "Citation supports source tracing and academic integrity.",
        "Readers can use citations to find original sources.",
        "Academic integrity is important in university writing.",
        "Writers include sources in many types of assignments."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_3",
      "skillTag": "Main Idea Reading",
      "stemGroup": "Which option best states the main idea?"
    },
    {
      "id": "S03_B35",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Online learning platforms provide videos, quizzes, and feedback. These tools help students practice outside the classroom.",
      "choices": [
        "Online learning platforms support practice beyond class time.",
        "Videos and quizzes are common tools on learning platforms.",
        "Feedback can help students understand their mistakes.",
        "Classroom learning is not the only way students practice."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_4",
      "skillTag": "Main Idea Reading",
      "stemGroup": "Which option best states the main idea?"
    },
    {
      "id": "S03_B36",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Critical reading requires checking claims and evidence. This skill is important when students read online information.",
      "choices": [
        "Critical reading helps students evaluate claims and evidence.",
        "Students read online information in many daily situations.",
        "Evidence should be checked before accepting a claim.",
        "Online information may include both facts and opinions."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_5",
      "skillTag": "Main Idea Reading",
      "stemGroup": "Which option best states the main idea?"
    },
    {
      "id": "S03_B37",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Summarizing requires students to identify key points and restate them briefly. This skill helps reduce copying from sources.",
      "choices": [
        "Summarizing helps students express key ideas briefly and ethically.",
        "Students need to identify key points before writing summaries.",
        "Copying from sources can create academic problems.",
        "Brief writing is often required in academic tasks."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_6",
      "skillTag": "Main Idea Reading",
      "stemGroup": "Which option best states the main idea?"
    },
    {
      "id": "S03_B38",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Data description should focus on major trends rather than every number. This helps readers understand the main pattern quickly.",
      "choices": [
        "Data description should highlight major trends clearly.",
        "Writers sometimes list many numbers from tables.",
        "Readers need help understanding patterns in data.",
        "Major trends may include increases or decreases."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_7",
      "skillTag": "Main Idea Reading",
      "stemGroup": "Which option best states the main idea?"
    },
    {
      "id": "S03_B39",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Academic email should be polite and specific. A clear subject and respectful request help instructors respond effectively.",
      "choices": [
        "Academic email requires polite and clear communication.",
        "A subject line helps instructors identify the topic.",
        "Respectful requests are useful in university contexts.",
        "Instructors receive many emails from students."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_8",
      "skillTag": "Main Idea Reading",
      "stemGroup": "Which option best states the main idea?"
    },
    {
      "id": "S03_B40",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Presentation signposting helps audiences follow the speaker’s structure. Phrases such as first, next, and in conclusion guide listeners.",
      "choices": [
        "Signposting helps audiences follow academic presentations.",
        "Speakers can use phrases such as first and next.",
        "Audiences need to understand the structure of a talk.",
        "Presentations often include introductions and conclusions."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_9",
      "skillTag": "Main Idea Reading",
      "stemGroup": "Which option best states the main idea?"
    }
  ],
  "4": [
    {
      "id": "S04_B01",
      "type": "mcq",
      "question": "What is the function of “however”?",
      "context": "The tool is convenient; however, students must still check accuracy.",
      "choices": [
        "It shows contrast between two connected ideas.",
        "It gives an example of the previous idea.",
        "It adds another similar point to the idea.",
        "It shows the result of the previous idea."
      ],
      "answer": 0,
      "feedback": "However signals contrast.",
      "quality": "signal_0",
      "skillTag": "Keyword & Signal Words",
      "stemGroup": "What is the function of “however”?"
    },
    {
      "id": "S04_B02",
      "type": "mcq",
      "question": "What is the function of “therefore”?",
      "context": "The evidence was limited; therefore, the conclusion should be cautious.",
      "choices": [
        "It shows a result from the previous idea.",
        "It introduces an example from the sentence.",
        "It contrasts two different viewpoints.",
        "It adds a similar supporting detail."
      ],
      "answer": 0,
      "feedback": "Therefore signals result.",
      "quality": "signal_1",
      "skillTag": "Keyword & Signal Words",
      "stemGroup": "What is the function of “therefore”?"
    },
    {
      "id": "S04_B03",
      "type": "mcq",
      "question": "What is the function of “because”?",
      "context": "Students improved because they practiced vocabulary every week.",
      "choices": [
        "It explains the cause of the improvement.",
        "It contrasts the result with another idea.",
        "It introduces an example of vocabulary.",
        "It summarizes the final conclusion."
      ],
      "answer": 0,
      "feedback": "Because signals cause.",
      "quality": "signal_2",
      "skillTag": "Keyword & Signal Words",
      "stemGroup": "What is the function of “because”?"
    },
    {
      "id": "S04_B04",
      "type": "mcq",
      "question": "What is the function of “such as”?",
      "context": "Digital tools, such as flashcards and dictionaries, can support vocabulary learning.",
      "choices": [
        "It introduces examples of digital tools.",
        "It shows the cause of vocabulary learning.",
        "It contrasts two types of vocabulary.",
        "It gives the final result of practice."
      ],
      "answer": 0,
      "feedback": "Such as introduces examples.",
      "quality": "signal_3",
      "skillTag": "Keyword & Signal Words",
      "stemGroup": "What is the function of “such as”?"
    },
    {
      "id": "S04_B05",
      "type": "mcq",
      "question": "What is the function of “moreover”?",
      "context": "The app provides practice; moreover, it gives immediate feedback.",
      "choices": [
        "It adds another supporting point.",
        "It introduces an opposing viewpoint.",
        "It shows a result from the first clause.",
        "It gives a specific example only."
      ],
      "answer": 0,
      "feedback": "Moreover adds information.",
      "quality": "signal_4",
      "skillTag": "Keyword & Signal Words",
      "stemGroup": "What is the function of “moreover”?"
    },
    {
      "id": "S04_B06",
      "type": "mcq",
      "question": "What is the function of “compared with”?",
      "context": "Compared with printed texts, e-books are easier to search.",
      "choices": [
        "It compares two types of learning materials.",
        "It introduces the cause of searching behavior.",
        "It gives a conclusion about all texts.",
        "It adds another unrelated detail."
      ],
      "answer": 0,
      "feedback": "Compared with signals comparison.",
      "quality": "signal_5",
      "skillTag": "Keyword & Signal Words",
      "stemGroup": "What is the function of “compared with”?"
    },
    {
      "id": "S04_B07",
      "type": "mcq",
      "question": "What is the function of “although”?",
      "context": "Although online learning is flexible, some students need face-to-face support.",
      "choices": [
        "It shows contrast within the sentence.",
        "It gives an example of student support.",
        "It explains the result of flexibility.",
        "It adds another similar advantage."
      ],
      "answer": 0,
      "feedback": "Although shows contrast.",
      "quality": "signal_6",
      "skillTag": "Keyword & Signal Words",
      "stemGroup": "What is the function of “although”?"
    },
    {
      "id": "S04_B08",
      "type": "mcq",
      "question": "What is the function of “in conclusion”?",
      "context": "In conclusion, digital literacy should be developed in university courses.",
      "choices": [
        "It signals the final summary of the idea.",
        "It introduces the first supporting reason.",
        "It gives an example from the previous point.",
        "It contrasts the topic with another course."
      ],
      "answer": 0,
      "feedback": "In conclusion signals a final summary.",
      "quality": "signal_7",
      "skillTag": "Keyword & Signal Words",
      "stemGroup": "What is the function of “in conclusion”?"
    },
    {
      "id": "S04_B09",
      "type": "mcq",
      "question": "What is the function of “first” and “next”?",
      "context": "First, the speaker explains the problem; next, she presents possible solutions.",
      "choices": [
        "They organize the sequence of ideas.",
        "They show a contrast between two ideas.",
        "They introduce evidence from a survey.",
        "They explain the cause of the problem."
      ],
      "answer": 0,
      "feedback": "First and next signal sequence.",
      "quality": "signal_8",
      "skillTag": "Keyword & Signal Words",
      "stemGroup": "What is the function of “first” and “next”?"
    },
    {
      "id": "S04_B10",
      "type": "mcq",
      "question": "What is the function of “as a result”?",
      "context": "As a result, many students submitted the correct file after the instructions were clarified.",
      "choices": [
        "It shows the consequence of the clarified instructions.",
        "It gives an example of an unclear instruction.",
        "It contrasts correct and incorrect submissions.",
        "It adds another unrelated point about files."
      ],
      "answer": 0,
      "feedback": "As a result signals consequence.",
      "quality": "signal_9",
      "skillTag": "Keyword & Signal Words",
      "stemGroup": "What is the function of “as a result”?"
    },
    {
      "id": "S04_B11",
      "type": "mcq",
      "question": "What is the function of “however”?",
      "context": "The tool is convenient; however, students must still check accuracy.",
      "choices": [
        "It shows contrast between two connected ideas.",
        "It gives an example of the previous idea.",
        "It adds another similar point to the idea.",
        "It shows the result of the previous idea."
      ],
      "answer": 0,
      "feedback": "However signals contrast.",
      "quality": "signal_0",
      "skillTag": "Keyword & Signal Words",
      "stemGroup": "What is the function of “however”?"
    },
    {
      "id": "S04_B12",
      "type": "mcq",
      "question": "What is the function of “therefore”?",
      "context": "The evidence was limited; therefore, the conclusion should be cautious.",
      "choices": [
        "It shows a result from the previous idea.",
        "It introduces an example from the sentence.",
        "It contrasts two different viewpoints.",
        "It adds a similar supporting detail."
      ],
      "answer": 0,
      "feedback": "Therefore signals result.",
      "quality": "signal_1",
      "skillTag": "Keyword & Signal Words",
      "stemGroup": "What is the function of “therefore”?"
    },
    {
      "id": "S04_B13",
      "type": "mcq",
      "question": "What is the function of “because”?",
      "context": "Students improved because they practiced vocabulary every week.",
      "choices": [
        "It explains the cause of the improvement.",
        "It contrasts the result with another idea.",
        "It introduces an example of vocabulary.",
        "It summarizes the final conclusion."
      ],
      "answer": 0,
      "feedback": "Because signals cause.",
      "quality": "signal_2",
      "skillTag": "Keyword & Signal Words",
      "stemGroup": "What is the function of “because”?"
    },
    {
      "id": "S04_B14",
      "type": "mcq",
      "question": "What is the function of “such as”?",
      "context": "Digital tools, such as flashcards and dictionaries, can support vocabulary learning.",
      "choices": [
        "It introduces examples of digital tools.",
        "It shows the cause of vocabulary learning.",
        "It contrasts two types of vocabulary.",
        "It gives the final result of practice."
      ],
      "answer": 0,
      "feedback": "Such as introduces examples.",
      "quality": "signal_3",
      "skillTag": "Keyword & Signal Words",
      "stemGroup": "What is the function of “such as”?"
    },
    {
      "id": "S04_B15",
      "type": "mcq",
      "question": "What is the function of “moreover”?",
      "context": "The app provides practice; moreover, it gives immediate feedback.",
      "choices": [
        "It adds another supporting point.",
        "It introduces an opposing viewpoint.",
        "It shows a result from the first clause.",
        "It gives a specific example only."
      ],
      "answer": 0,
      "feedback": "Moreover adds information.",
      "quality": "signal_4",
      "skillTag": "Keyword & Signal Words",
      "stemGroup": "What is the function of “moreover”?"
    },
    {
      "id": "S04_B16",
      "type": "mcq",
      "question": "What is the function of “compared with”?",
      "context": "Compared with printed texts, e-books are easier to search.",
      "choices": [
        "It compares two types of learning materials.",
        "It introduces the cause of searching behavior.",
        "It gives a conclusion about all texts.",
        "It adds another unrelated detail."
      ],
      "answer": 0,
      "feedback": "Compared with signals comparison.",
      "quality": "signal_5",
      "skillTag": "Keyword & Signal Words",
      "stemGroup": "What is the function of “compared with”?"
    },
    {
      "id": "S04_B17",
      "type": "mcq",
      "question": "What is the function of “although”?",
      "context": "Although online learning is flexible, some students need face-to-face support.",
      "choices": [
        "It shows contrast within the sentence.",
        "It gives an example of student support.",
        "It explains the result of flexibility.",
        "It adds another similar advantage."
      ],
      "answer": 0,
      "feedback": "Although shows contrast.",
      "quality": "signal_6",
      "skillTag": "Keyword & Signal Words",
      "stemGroup": "What is the function of “although”?"
    },
    {
      "id": "S04_B18",
      "type": "mcq",
      "question": "What is the function of “in conclusion”?",
      "context": "In conclusion, digital literacy should be developed in university courses.",
      "choices": [
        "It signals the final summary of the idea.",
        "It introduces the first supporting reason.",
        "It gives an example from the previous point.",
        "It contrasts the topic with another course."
      ],
      "answer": 0,
      "feedback": "In conclusion signals a final summary.",
      "quality": "signal_7",
      "skillTag": "Keyword & Signal Words",
      "stemGroup": "What is the function of “in conclusion”?"
    },
    {
      "id": "S04_B19",
      "type": "mcq",
      "question": "What is the function of “first” and “next”?",
      "context": "First, the speaker explains the problem; next, she presents possible solutions.",
      "choices": [
        "They organize the sequence of ideas.",
        "They show a contrast between two ideas.",
        "They introduce evidence from a survey.",
        "They explain the cause of the problem."
      ],
      "answer": 0,
      "feedback": "First and next signal sequence.",
      "quality": "signal_8",
      "skillTag": "Keyword & Signal Words",
      "stemGroup": "What is the function of “first” and “next”?"
    },
    {
      "id": "S04_B20",
      "type": "mcq",
      "question": "What is the function of “as a result”?",
      "context": "As a result, many students submitted the correct file after the instructions were clarified.",
      "choices": [
        "It shows the consequence of the clarified instructions.",
        "It gives an example of an unclear instruction.",
        "It contrasts correct and incorrect submissions.",
        "It adds another unrelated point about files."
      ],
      "answer": 0,
      "feedback": "As a result signals consequence.",
      "quality": "signal_9",
      "skillTag": "Keyword & Signal Words",
      "stemGroup": "What is the function of “as a result”?"
    },
    {
      "id": "S04_B21",
      "type": "mcq",
      "question": "What is the function of “however”?",
      "context": "The tool is convenient; however, students must still check accuracy.",
      "choices": [
        "It shows contrast between two connected ideas.",
        "It gives an example of the previous idea.",
        "It adds another similar point to the idea.",
        "It shows the result of the previous idea."
      ],
      "answer": 0,
      "feedback": "However signals contrast.",
      "quality": "signal_0",
      "skillTag": "Keyword & Signal Words",
      "stemGroup": "What is the function of “however”?"
    },
    {
      "id": "S04_B22",
      "type": "mcq",
      "question": "What is the function of “therefore”?",
      "context": "The evidence was limited; therefore, the conclusion should be cautious.",
      "choices": [
        "It shows a result from the previous idea.",
        "It introduces an example from the sentence.",
        "It contrasts two different viewpoints.",
        "It adds a similar supporting detail."
      ],
      "answer": 0,
      "feedback": "Therefore signals result.",
      "quality": "signal_1",
      "skillTag": "Keyword & Signal Words",
      "stemGroup": "What is the function of “therefore”?"
    },
    {
      "id": "S04_B23",
      "type": "mcq",
      "question": "What is the function of “because”?",
      "context": "Students improved because they practiced vocabulary every week.",
      "choices": [
        "It explains the cause of the improvement.",
        "It contrasts the result with another idea.",
        "It introduces an example of vocabulary.",
        "It summarizes the final conclusion."
      ],
      "answer": 0,
      "feedback": "Because signals cause.",
      "quality": "signal_2",
      "skillTag": "Keyword & Signal Words",
      "stemGroup": "What is the function of “because”?"
    },
    {
      "id": "S04_B24",
      "type": "mcq",
      "question": "What is the function of “such as”?",
      "context": "Digital tools, such as flashcards and dictionaries, can support vocabulary learning.",
      "choices": [
        "It introduces examples of digital tools.",
        "It shows the cause of vocabulary learning.",
        "It contrasts two types of vocabulary.",
        "It gives the final result of practice."
      ],
      "answer": 0,
      "feedback": "Such as introduces examples.",
      "quality": "signal_3",
      "skillTag": "Keyword & Signal Words",
      "stemGroup": "What is the function of “such as”?"
    },
    {
      "id": "S04_B25",
      "type": "mcq",
      "question": "What is the function of “moreover”?",
      "context": "The app provides practice; moreover, it gives immediate feedback.",
      "choices": [
        "It adds another supporting point.",
        "It introduces an opposing viewpoint.",
        "It shows a result from the first clause.",
        "It gives a specific example only."
      ],
      "answer": 0,
      "feedback": "Moreover adds information.",
      "quality": "signal_4",
      "skillTag": "Keyword & Signal Words",
      "stemGroup": "What is the function of “moreover”?"
    },
    {
      "id": "S04_B26",
      "type": "mcq",
      "question": "What is the function of “compared with”?",
      "context": "Compared with printed texts, e-books are easier to search.",
      "choices": [
        "It compares two types of learning materials.",
        "It introduces the cause of searching behavior.",
        "It gives a conclusion about all texts.",
        "It adds another unrelated detail."
      ],
      "answer": 0,
      "feedback": "Compared with signals comparison.",
      "quality": "signal_5",
      "skillTag": "Keyword & Signal Words",
      "stemGroup": "What is the function of “compared with”?"
    },
    {
      "id": "S04_B27",
      "type": "mcq",
      "question": "What is the function of “although”?",
      "context": "Although online learning is flexible, some students need face-to-face support.",
      "choices": [
        "It shows contrast within the sentence.",
        "It gives an example of student support.",
        "It explains the result of flexibility.",
        "It adds another similar advantage."
      ],
      "answer": 0,
      "feedback": "Although shows contrast.",
      "quality": "signal_6",
      "skillTag": "Keyword & Signal Words",
      "stemGroup": "What is the function of “although”?"
    },
    {
      "id": "S04_B28",
      "type": "mcq",
      "question": "What is the function of “in conclusion”?",
      "context": "In conclusion, digital literacy should be developed in university courses.",
      "choices": [
        "It signals the final summary of the idea.",
        "It introduces the first supporting reason.",
        "It gives an example from the previous point.",
        "It contrasts the topic with another course."
      ],
      "answer": 0,
      "feedback": "In conclusion signals a final summary.",
      "quality": "signal_7",
      "skillTag": "Keyword & Signal Words",
      "stemGroup": "What is the function of “in conclusion”?"
    },
    {
      "id": "S04_B29",
      "type": "mcq",
      "question": "What is the function of “first” and “next”?",
      "context": "First, the speaker explains the problem; next, she presents possible solutions.",
      "choices": [
        "They organize the sequence of ideas.",
        "They show a contrast between two ideas.",
        "They introduce evidence from a survey.",
        "They explain the cause of the problem."
      ],
      "answer": 0,
      "feedback": "First and next signal sequence.",
      "quality": "signal_8",
      "skillTag": "Keyword & Signal Words",
      "stemGroup": "What is the function of “first” and “next”?"
    },
    {
      "id": "S04_B30",
      "type": "mcq",
      "question": "What is the function of “as a result”?",
      "context": "As a result, many students submitted the correct file after the instructions were clarified.",
      "choices": [
        "It shows the consequence of the clarified instructions.",
        "It gives an example of an unclear instruction.",
        "It contrasts correct and incorrect submissions.",
        "It adds another unrelated point about files."
      ],
      "answer": 0,
      "feedback": "As a result signals consequence.",
      "quality": "signal_9",
      "skillTag": "Keyword & Signal Words",
      "stemGroup": "What is the function of “as a result”?"
    },
    {
      "id": "S04_B31",
      "type": "mcq",
      "question": "What is the function of “however”?",
      "context": "The tool is convenient; however, students must still check accuracy.",
      "choices": [
        "It shows contrast between two connected ideas.",
        "It gives an example of the previous idea.",
        "It adds another similar point to the idea.",
        "It shows the result of the previous idea."
      ],
      "answer": 0,
      "feedback": "However signals contrast.",
      "quality": "signal_0",
      "skillTag": "Keyword & Signal Words",
      "stemGroup": "What is the function of “however”?"
    },
    {
      "id": "S04_B32",
      "type": "mcq",
      "question": "What is the function of “therefore”?",
      "context": "The evidence was limited; therefore, the conclusion should be cautious.",
      "choices": [
        "It shows a result from the previous idea.",
        "It introduces an example from the sentence.",
        "It contrasts two different viewpoints.",
        "It adds a similar supporting detail."
      ],
      "answer": 0,
      "feedback": "Therefore signals result.",
      "quality": "signal_1",
      "skillTag": "Keyword & Signal Words",
      "stemGroup": "What is the function of “therefore”?"
    },
    {
      "id": "S04_B33",
      "type": "mcq",
      "question": "What is the function of “because”?",
      "context": "Students improved because they practiced vocabulary every week.",
      "choices": [
        "It explains the cause of the improvement.",
        "It contrasts the result with another idea.",
        "It introduces an example of vocabulary.",
        "It summarizes the final conclusion."
      ],
      "answer": 0,
      "feedback": "Because signals cause.",
      "quality": "signal_2",
      "skillTag": "Keyword & Signal Words",
      "stemGroup": "What is the function of “because”?"
    },
    {
      "id": "S04_B34",
      "type": "mcq",
      "question": "What is the function of “such as”?",
      "context": "Digital tools, such as flashcards and dictionaries, can support vocabulary learning.",
      "choices": [
        "It introduces examples of digital tools.",
        "It shows the cause of vocabulary learning.",
        "It contrasts two types of vocabulary.",
        "It gives the final result of practice."
      ],
      "answer": 0,
      "feedback": "Such as introduces examples.",
      "quality": "signal_3",
      "skillTag": "Keyword & Signal Words",
      "stemGroup": "What is the function of “such as”?"
    },
    {
      "id": "S04_B35",
      "type": "mcq",
      "question": "What is the function of “moreover”?",
      "context": "The app provides practice; moreover, it gives immediate feedback.",
      "choices": [
        "It adds another supporting point.",
        "It introduces an opposing viewpoint.",
        "It shows a result from the first clause.",
        "It gives a specific example only."
      ],
      "answer": 0,
      "feedback": "Moreover adds information.",
      "quality": "signal_4",
      "skillTag": "Keyword & Signal Words",
      "stemGroup": "What is the function of “moreover”?"
    },
    {
      "id": "S04_B36",
      "type": "mcq",
      "question": "What is the function of “compared with”?",
      "context": "Compared with printed texts, e-books are easier to search.",
      "choices": [
        "It compares two types of learning materials.",
        "It introduces the cause of searching behavior.",
        "It gives a conclusion about all texts.",
        "It adds another unrelated detail."
      ],
      "answer": 0,
      "feedback": "Compared with signals comparison.",
      "quality": "signal_5",
      "skillTag": "Keyword & Signal Words",
      "stemGroup": "What is the function of “compared with”?"
    },
    {
      "id": "S04_B37",
      "type": "mcq",
      "question": "What is the function of “although”?",
      "context": "Although online learning is flexible, some students need face-to-face support.",
      "choices": [
        "It shows contrast within the sentence.",
        "It gives an example of student support.",
        "It explains the result of flexibility.",
        "It adds another similar advantage."
      ],
      "answer": 0,
      "feedback": "Although shows contrast.",
      "quality": "signal_6",
      "skillTag": "Keyword & Signal Words",
      "stemGroup": "What is the function of “although”?"
    },
    {
      "id": "S04_B38",
      "type": "mcq",
      "question": "What is the function of “in conclusion”?",
      "context": "In conclusion, digital literacy should be developed in university courses.",
      "choices": [
        "It signals the final summary of the idea.",
        "It introduces the first supporting reason.",
        "It gives an example from the previous point.",
        "It contrasts the topic with another course."
      ],
      "answer": 0,
      "feedback": "In conclusion signals a final summary.",
      "quality": "signal_7",
      "skillTag": "Keyword & Signal Words",
      "stemGroup": "What is the function of “in conclusion”?"
    },
    {
      "id": "S04_B39",
      "type": "mcq",
      "question": "What is the function of “first” and “next”?",
      "context": "First, the speaker explains the problem; next, she presents possible solutions.",
      "choices": [
        "They organize the sequence of ideas.",
        "They show a contrast between two ideas.",
        "They introduce evidence from a survey.",
        "They explain the cause of the problem."
      ],
      "answer": 0,
      "feedback": "First and next signal sequence.",
      "quality": "signal_8",
      "skillTag": "Keyword & Signal Words",
      "stemGroup": "What is the function of “first” and “next”?"
    },
    {
      "id": "S04_B40",
      "type": "mcq",
      "question": "What is the function of “as a result”?",
      "context": "As a result, many students submitted the correct file after the instructions were clarified.",
      "choices": [
        "It shows the consequence of the clarified instructions.",
        "It gives an example of an unclear instruction.",
        "It contrasts correct and incorrect submissions.",
        "It adds another unrelated point about files."
      ],
      "answer": 0,
      "feedback": "As a result signals consequence.",
      "quality": "signal_9",
      "skillTag": "Keyword & Signal Words",
      "stemGroup": "What is the function of “as a result”?"
    }
  ],
  "5": [
    {
      "id": "S05_B01",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "The official university website states that registration closes on June 30.",
      "choices": [
        "Fact",
        "Opinion",
        "Claim",
        "Evidence"
      ],
      "answer": 0,
      "feedback": "This statement can be checked through an official source.",
      "quality": "critical_0",
      "skillTag": "Critical Reading",
      "stemGroup": "Classify the statement."
    },
    {
      "id": "S05_B02",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "A survey of 420 students found that 61% used AI tools for drafting.",
      "choices": [
        "Evidence",
        "Fact",
        "Opinion",
        "Claim"
      ],
      "answer": 0,
      "feedback": "This data can support a claim.",
      "quality": "critical_1",
      "skillTag": "Critical Reading",
      "stemGroup": "Classify the statement."
    },
    {
      "id": "S05_B03",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "Online learning may improve students’ independence.",
      "choices": [
        "Claim",
        "Fact",
        "Opinion",
        "Evidence"
      ],
      "answer": 0,
      "feedback": "This idea needs evidence before it is accepted.",
      "quality": "critical_2",
      "skillTag": "Critical Reading",
      "stemGroup": "Classify the statement."
    },
    {
      "id": "S05_B04",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "In my view, mobile learning is more convenient than classroom learning.",
      "choices": [
        "Opinion",
        "Fact",
        "Claim",
        "Evidence"
      ],
      "answer": 0,
      "feedback": "The phrase in my view signals opinion.",
      "quality": "critical_3",
      "skillTag": "Critical Reading",
      "stemGroup": "Classify the statement."
    },
    {
      "id": "S05_B05",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "The report was published by the Ministry in 2025.",
      "choices": [
        "Fact",
        "Opinion",
        "Claim",
        "Evidence"
      ],
      "answer": 0,
      "feedback": "This publication detail can be verified.",
      "quality": "critical_4",
      "skillTag": "Critical Reading",
      "stemGroup": "Classify the statement."
    },
    {
      "id": "S05_B06",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "According to the article, participants completed a ten-item questionnaire.",
      "choices": [
        "Evidence",
        "Fact",
        "Opinion",
        "Claim"
      ],
      "answer": 0,
      "feedback": "This source-based detail can support a method claim.",
      "quality": "critical_5",
      "skillTag": "Critical Reading",
      "stemGroup": "Classify the statement."
    },
    {
      "id": "S05_B07",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "Social media always reduces students’ concentration.",
      "choices": [
        "Claim",
        "Fact",
        "Opinion",
        "Evidence"
      ],
      "answer": 0,
      "feedback": "Always is a strong claim that needs evidence.",
      "quality": "critical_6",
      "skillTag": "Critical Reading",
      "stemGroup": "Classify the statement."
    },
    {
      "id": "S05_B08",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "I believe citation software is difficult to use.",
      "choices": [
        "Opinion",
        "Fact",
        "Claim",
        "Evidence"
      ],
      "answer": 0,
      "feedback": "I believe signals personal opinion.",
      "quality": "critical_7",
      "skillTag": "Critical Reading",
      "stemGroup": "Classify the statement."
    },
    {
      "id": "S05_B09",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "The table shows that Group A scored twelve points higher than Group B.",
      "choices": [
        "Evidence",
        "Fact",
        "Opinion",
        "Claim"
      ],
      "answer": 0,
      "feedback": "A table result can support an argument.",
      "quality": "critical_8",
      "skillTag": "Critical Reading",
      "stemGroup": "Classify the statement."
    },
    {
      "id": "S05_B10",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "Digital literacy training can reduce misinformation sharing.",
      "choices": [
        "Claim",
        "Fact",
        "Opinion",
        "Evidence"
      ],
      "answer": 0,
      "feedback": "This cause-effect idea needs evidence.",
      "quality": "critical_9",
      "skillTag": "Critical Reading",
      "stemGroup": "Classify the statement."
    },
    {
      "id": "S05_B11",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "The official university website states that registration closes on June 30.",
      "choices": [
        "Fact",
        "Opinion",
        "Claim",
        "Evidence"
      ],
      "answer": 0,
      "feedback": "This statement can be checked through an official source.",
      "quality": "critical_0",
      "skillTag": "Critical Reading",
      "stemGroup": "Classify the statement."
    },
    {
      "id": "S05_B12",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "A survey of 420 students found that 61% used AI tools for drafting.",
      "choices": [
        "Evidence",
        "Fact",
        "Opinion",
        "Claim"
      ],
      "answer": 0,
      "feedback": "This data can support a claim.",
      "quality": "critical_1",
      "skillTag": "Critical Reading",
      "stemGroup": "Classify the statement."
    },
    {
      "id": "S05_B13",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "Online learning may improve students’ independence.",
      "choices": [
        "Claim",
        "Fact",
        "Opinion",
        "Evidence"
      ],
      "answer": 0,
      "feedback": "This idea needs evidence before it is accepted.",
      "quality": "critical_2",
      "skillTag": "Critical Reading",
      "stemGroup": "Classify the statement."
    },
    {
      "id": "S05_B14",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "In my view, mobile learning is more convenient than classroom learning.",
      "choices": [
        "Opinion",
        "Fact",
        "Claim",
        "Evidence"
      ],
      "answer": 0,
      "feedback": "The phrase in my view signals opinion.",
      "quality": "critical_3",
      "skillTag": "Critical Reading",
      "stemGroup": "Classify the statement."
    },
    {
      "id": "S05_B15",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "The report was published by the Ministry in 2025.",
      "choices": [
        "Fact",
        "Opinion",
        "Claim",
        "Evidence"
      ],
      "answer": 0,
      "feedback": "This publication detail can be verified.",
      "quality": "critical_4",
      "skillTag": "Critical Reading",
      "stemGroup": "Classify the statement."
    },
    {
      "id": "S05_B16",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "According to the article, participants completed a ten-item questionnaire.",
      "choices": [
        "Evidence",
        "Fact",
        "Opinion",
        "Claim"
      ],
      "answer": 0,
      "feedback": "This source-based detail can support a method claim.",
      "quality": "critical_5",
      "skillTag": "Critical Reading",
      "stemGroup": "Classify the statement."
    },
    {
      "id": "S05_B17",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "Social media always reduces students’ concentration.",
      "choices": [
        "Claim",
        "Fact",
        "Opinion",
        "Evidence"
      ],
      "answer": 0,
      "feedback": "Always is a strong claim that needs evidence.",
      "quality": "critical_6",
      "skillTag": "Critical Reading",
      "stemGroup": "Classify the statement."
    },
    {
      "id": "S05_B18",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "I believe citation software is difficult to use.",
      "choices": [
        "Opinion",
        "Fact",
        "Claim",
        "Evidence"
      ],
      "answer": 0,
      "feedback": "I believe signals personal opinion.",
      "quality": "critical_7",
      "skillTag": "Critical Reading",
      "stemGroup": "Classify the statement."
    },
    {
      "id": "S05_B19",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "The table shows that Group A scored twelve points higher than Group B.",
      "choices": [
        "Evidence",
        "Fact",
        "Opinion",
        "Claim"
      ],
      "answer": 0,
      "feedback": "A table result can support an argument.",
      "quality": "critical_8",
      "skillTag": "Critical Reading",
      "stemGroup": "Classify the statement."
    },
    {
      "id": "S05_B20",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "Digital literacy training can reduce misinformation sharing.",
      "choices": [
        "Claim",
        "Fact",
        "Opinion",
        "Evidence"
      ],
      "answer": 0,
      "feedback": "This cause-effect idea needs evidence.",
      "quality": "critical_9",
      "skillTag": "Critical Reading",
      "stemGroup": "Classify the statement."
    },
    {
      "id": "S05_B21",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "The official university website states that registration closes on June 30.",
      "choices": [
        "Fact",
        "Opinion",
        "Claim",
        "Evidence"
      ],
      "answer": 0,
      "feedback": "This statement can be checked through an official source.",
      "quality": "critical_0",
      "skillTag": "Critical Reading",
      "stemGroup": "Classify the statement."
    },
    {
      "id": "S05_B22",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "A survey of 420 students found that 61% used AI tools for drafting.",
      "choices": [
        "Evidence",
        "Fact",
        "Opinion",
        "Claim"
      ],
      "answer": 0,
      "feedback": "This data can support a claim.",
      "quality": "critical_1",
      "skillTag": "Critical Reading",
      "stemGroup": "Classify the statement."
    },
    {
      "id": "S05_B23",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "Online learning may improve students’ independence.",
      "choices": [
        "Claim",
        "Fact",
        "Opinion",
        "Evidence"
      ],
      "answer": 0,
      "feedback": "This idea needs evidence before it is accepted.",
      "quality": "critical_2",
      "skillTag": "Critical Reading",
      "stemGroup": "Classify the statement."
    },
    {
      "id": "S05_B24",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "In my view, mobile learning is more convenient than classroom learning.",
      "choices": [
        "Opinion",
        "Fact",
        "Claim",
        "Evidence"
      ],
      "answer": 0,
      "feedback": "The phrase in my view signals opinion.",
      "quality": "critical_3",
      "skillTag": "Critical Reading",
      "stemGroup": "Classify the statement."
    },
    {
      "id": "S05_B25",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "The report was published by the Ministry in 2025.",
      "choices": [
        "Fact",
        "Opinion",
        "Claim",
        "Evidence"
      ],
      "answer": 0,
      "feedback": "This publication detail can be verified.",
      "quality": "critical_4",
      "skillTag": "Critical Reading",
      "stemGroup": "Classify the statement."
    },
    {
      "id": "S05_B26",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "According to the article, participants completed a ten-item questionnaire.",
      "choices": [
        "Evidence",
        "Fact",
        "Opinion",
        "Claim"
      ],
      "answer": 0,
      "feedback": "This source-based detail can support a method claim.",
      "quality": "critical_5",
      "skillTag": "Critical Reading",
      "stemGroup": "Classify the statement."
    },
    {
      "id": "S05_B27",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "Social media always reduces students’ concentration.",
      "choices": [
        "Claim",
        "Fact",
        "Opinion",
        "Evidence"
      ],
      "answer": 0,
      "feedback": "Always is a strong claim that needs evidence.",
      "quality": "critical_6",
      "skillTag": "Critical Reading",
      "stemGroup": "Classify the statement."
    },
    {
      "id": "S05_B28",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "I believe citation software is difficult to use.",
      "choices": [
        "Opinion",
        "Fact",
        "Claim",
        "Evidence"
      ],
      "answer": 0,
      "feedback": "I believe signals personal opinion.",
      "quality": "critical_7",
      "skillTag": "Critical Reading",
      "stemGroup": "Classify the statement."
    },
    {
      "id": "S05_B29",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "The table shows that Group A scored twelve points higher than Group B.",
      "choices": [
        "Evidence",
        "Fact",
        "Opinion",
        "Claim"
      ],
      "answer": 0,
      "feedback": "A table result can support an argument.",
      "quality": "critical_8",
      "skillTag": "Critical Reading",
      "stemGroup": "Classify the statement."
    },
    {
      "id": "S05_B30",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "Digital literacy training can reduce misinformation sharing.",
      "choices": [
        "Claim",
        "Fact",
        "Opinion",
        "Evidence"
      ],
      "answer": 0,
      "feedback": "This cause-effect idea needs evidence.",
      "quality": "critical_9",
      "skillTag": "Critical Reading",
      "stemGroup": "Classify the statement."
    },
    {
      "id": "S05_B31",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "The official university website states that registration closes on June 30.",
      "choices": [
        "Fact",
        "Opinion",
        "Claim",
        "Evidence"
      ],
      "answer": 0,
      "feedback": "This statement can be checked through an official source.",
      "quality": "critical_0",
      "skillTag": "Critical Reading",
      "stemGroup": "Classify the statement."
    },
    {
      "id": "S05_B32",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "A survey of 420 students found that 61% used AI tools for drafting.",
      "choices": [
        "Evidence",
        "Fact",
        "Opinion",
        "Claim"
      ],
      "answer": 0,
      "feedback": "This data can support a claim.",
      "quality": "critical_1",
      "skillTag": "Critical Reading",
      "stemGroup": "Classify the statement."
    },
    {
      "id": "S05_B33",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "Online learning may improve students’ independence.",
      "choices": [
        "Claim",
        "Fact",
        "Opinion",
        "Evidence"
      ],
      "answer": 0,
      "feedback": "This idea needs evidence before it is accepted.",
      "quality": "critical_2",
      "skillTag": "Critical Reading",
      "stemGroup": "Classify the statement."
    },
    {
      "id": "S05_B34",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "In my view, mobile learning is more convenient than classroom learning.",
      "choices": [
        "Opinion",
        "Fact",
        "Claim",
        "Evidence"
      ],
      "answer": 0,
      "feedback": "The phrase in my view signals opinion.",
      "quality": "critical_3",
      "skillTag": "Critical Reading",
      "stemGroup": "Classify the statement."
    },
    {
      "id": "S05_B35",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "The report was published by the Ministry in 2025.",
      "choices": [
        "Fact",
        "Opinion",
        "Claim",
        "Evidence"
      ],
      "answer": 0,
      "feedback": "This publication detail can be verified.",
      "quality": "critical_4",
      "skillTag": "Critical Reading",
      "stemGroup": "Classify the statement."
    },
    {
      "id": "S05_B36",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "According to the article, participants completed a ten-item questionnaire.",
      "choices": [
        "Evidence",
        "Fact",
        "Opinion",
        "Claim"
      ],
      "answer": 0,
      "feedback": "This source-based detail can support a method claim.",
      "quality": "critical_5",
      "skillTag": "Critical Reading",
      "stemGroup": "Classify the statement."
    },
    {
      "id": "S05_B37",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "Social media always reduces students’ concentration.",
      "choices": [
        "Claim",
        "Fact",
        "Opinion",
        "Evidence"
      ],
      "answer": 0,
      "feedback": "Always is a strong claim that needs evidence.",
      "quality": "critical_6",
      "skillTag": "Critical Reading",
      "stemGroup": "Classify the statement."
    },
    {
      "id": "S05_B38",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "I believe citation software is difficult to use.",
      "choices": [
        "Opinion",
        "Fact",
        "Claim",
        "Evidence"
      ],
      "answer": 0,
      "feedback": "I believe signals personal opinion.",
      "quality": "critical_7",
      "skillTag": "Critical Reading",
      "stemGroup": "Classify the statement."
    },
    {
      "id": "S05_B39",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "The table shows that Group A scored twelve points higher than Group B.",
      "choices": [
        "Evidence",
        "Fact",
        "Opinion",
        "Claim"
      ],
      "answer": 0,
      "feedback": "A table result can support an argument.",
      "quality": "critical_8",
      "skillTag": "Critical Reading",
      "stemGroup": "Classify the statement."
    },
    {
      "id": "S05_B40",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "Digital literacy training can reduce misinformation sharing.",
      "choices": [
        "Claim",
        "Fact",
        "Opinion",
        "Evidence"
      ],
      "answer": 0,
      "feedback": "This cause-effect idea needs evidence.",
      "quality": "critical_9",
      "skillTag": "Critical Reading",
      "stemGroup": "Classify the statement."
    }
  ],
  "6": [
    {
      "id": "S06_B01",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Digital literacy helps students evaluate sources and communicate responsibly online.",
      "choices": [
        "Digital literacy supports responsible online evaluation and communication.",
        "Digital literacy helps students evaluate sources and communicate responsibly online.",
        "Students use digital tools for many different online activities.",
        "Digital literacy always solves every problem on the internet."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_0",
      "skillTag": "Summarizing",
      "stemGroup": "Choose the best summary."
    },
    {
      "id": "S06_B02",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Peer feedback can help students revise unclear ideas and improve paragraph organization.",
      "choices": [
        "Peer feedback can improve clarity and organization in writing.",
        "Peer feedback can help students revise unclear ideas and improve paragraph organization.",
        "Students sometimes exchange comments before submitting work.",
        "Peer feedback is better than all other writing support."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_1",
      "skillTag": "Summarizing",
      "stemGroup": "Choose the best summary."
    },
    {
      "id": "S06_B03",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Exercise may reduce stress and improve sleep quality among university students.",
      "choices": [
        "Exercise may support students’ well-being in several ways.",
        "Exercise may reduce stress and improve sleep quality among university students.",
        "University students sometimes feel stress during a semester.",
        "Exercise is the only factor that affects student well-being."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_2",
      "skillTag": "Summarizing",
      "stemGroup": "Choose the best summary."
    },
    {
      "id": "S06_B04",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Citation allows readers to locate the sources used in academic work.",
      "choices": [
        "Citation helps readers trace academic sources.",
        "Citation allows readers to locate the sources used in academic work.",
        "Readers can look at sources after reading academic work.",
        "Citation is useful because every sentence needs a reference."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_3",
      "skillTag": "Summarizing",
      "stemGroup": "Choose the best summary."
    },
    {
      "id": "S06_B05",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Online learning platforms provide tools that help students study outside the classroom.",
      "choices": [
        "Online platforms support learning beyond class time.",
        "Online learning platforms provide tools that help students study outside the classroom.",
        "Students may use technology in different learning contexts.",
        "Online platforms are always more effective than classrooms."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_4",
      "skillTag": "Summarizing",
      "stemGroup": "Choose the best summary."
    },
    {
      "id": "S06_B06",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Critical reading helps students check claims before accepting information.",
      "choices": [
        "Critical reading supports careful evaluation of claims.",
        "Critical reading helps students check claims before accepting information.",
        "Students accept information from many types of sources.",
        "Critical reading means rejecting all online information."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_5",
      "skillTag": "Summarizing",
      "stemGroup": "Choose the best summary."
    },
    {
      "id": "S06_B07",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Academic presentations require clear structure and evidence.",
      "choices": [
        "Academic presentations need organization and support.",
        "Academic presentations require clear structure and evidence.",
        "Presentations may include slides and spoken explanations.",
        "Academic presentations are successful only when they are long."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_6",
      "skillTag": "Summarizing",
      "stemGroup": "Choose the best summary."
    },
    {
      "id": "S06_B08",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Data description should highlight major trends instead of listing every value.",
      "choices": [
        "Data description should focus on major trends.",
        "Data description should highlight major trends instead of listing every value.",
        "Tables and graphs can contain many different numbers.",
        "Data description should include every number from the table."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_7",
      "skillTag": "Summarizing",
      "stemGroup": "Choose the best summary."
    },
    {
      "id": "S06_B09",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Responsible AI use requires checking outputs and acknowledging assistance when required.",
      "choices": [
        "Responsible AI use involves verification and transparency.",
        "Responsible AI use requires checking outputs and acknowledging assistance when required.",
        "AI tools can produce text for different learning tasks.",
        "Responsible AI use means accepting all AI outputs."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_8",
      "skillTag": "Summarizing",
      "stemGroup": "Choose the best summary."
    },
    {
      "id": "S06_B10",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Academic email should be polite, clear, and specific.",
      "choices": [
        "Academic email requires respectful and clear communication.",
        "Academic email should be polite, clear, and specific.",
        "Students send emails to instructors for many reasons.",
        "Academic email should be written like a casual chat."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_9",
      "skillTag": "Summarizing",
      "stemGroup": "Choose the best summary."
    },
    {
      "id": "S06_B11",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Digital literacy helps students evaluate sources and communicate responsibly online.",
      "choices": [
        "Digital literacy supports responsible online evaluation and communication.",
        "Digital literacy helps students evaluate sources and communicate responsibly online.",
        "Students use digital tools for many different online activities.",
        "Digital literacy always solves every problem on the internet."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_0",
      "skillTag": "Summarizing",
      "stemGroup": "Choose the best summary."
    },
    {
      "id": "S06_B12",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Peer feedback can help students revise unclear ideas and improve paragraph organization.",
      "choices": [
        "Peer feedback can improve clarity and organization in writing.",
        "Peer feedback can help students revise unclear ideas and improve paragraph organization.",
        "Students sometimes exchange comments before submitting work.",
        "Peer feedback is better than all other writing support."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_1",
      "skillTag": "Summarizing",
      "stemGroup": "Choose the best summary."
    },
    {
      "id": "S06_B13",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Exercise may reduce stress and improve sleep quality among university students.",
      "choices": [
        "Exercise may support students’ well-being in several ways.",
        "Exercise may reduce stress and improve sleep quality among university students.",
        "University students sometimes feel stress during a semester.",
        "Exercise is the only factor that affects student well-being."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_2",
      "skillTag": "Summarizing",
      "stemGroup": "Choose the best summary."
    },
    {
      "id": "S06_B14",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Citation allows readers to locate the sources used in academic work.",
      "choices": [
        "Citation helps readers trace academic sources.",
        "Citation allows readers to locate the sources used in academic work.",
        "Readers can look at sources after reading academic work.",
        "Citation is useful because every sentence needs a reference."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_3",
      "skillTag": "Summarizing",
      "stemGroup": "Choose the best summary."
    },
    {
      "id": "S06_B15",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Online learning platforms provide tools that help students study outside the classroom.",
      "choices": [
        "Online platforms support learning beyond class time.",
        "Online learning platforms provide tools that help students study outside the classroom.",
        "Students may use technology in different learning contexts.",
        "Online platforms are always more effective than classrooms."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_4",
      "skillTag": "Summarizing",
      "stemGroup": "Choose the best summary."
    },
    {
      "id": "S06_B16",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Critical reading helps students check claims before accepting information.",
      "choices": [
        "Critical reading supports careful evaluation of claims.",
        "Critical reading helps students check claims before accepting information.",
        "Students accept information from many types of sources.",
        "Critical reading means rejecting all online information."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_5",
      "skillTag": "Summarizing",
      "stemGroup": "Choose the best summary."
    },
    {
      "id": "S06_B17",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Academic presentations require clear structure and evidence.",
      "choices": [
        "Academic presentations need organization and support.",
        "Academic presentations require clear structure and evidence.",
        "Presentations may include slides and spoken explanations.",
        "Academic presentations are successful only when they are long."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_6",
      "skillTag": "Summarizing",
      "stemGroup": "Choose the best summary."
    },
    {
      "id": "S06_B18",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Data description should highlight major trends instead of listing every value.",
      "choices": [
        "Data description should focus on major trends.",
        "Data description should highlight major trends instead of listing every value.",
        "Tables and graphs can contain many different numbers.",
        "Data description should include every number from the table."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_7",
      "skillTag": "Summarizing",
      "stemGroup": "Choose the best summary."
    },
    {
      "id": "S06_B19",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Responsible AI use requires checking outputs and acknowledging assistance when required.",
      "choices": [
        "Responsible AI use involves verification and transparency.",
        "Responsible AI use requires checking outputs and acknowledging assistance when required.",
        "AI tools can produce text for different learning tasks.",
        "Responsible AI use means accepting all AI outputs."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_8",
      "skillTag": "Summarizing",
      "stemGroup": "Choose the best summary."
    },
    {
      "id": "S06_B20",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Academic email should be polite, clear, and specific.",
      "choices": [
        "Academic email requires respectful and clear communication.",
        "Academic email should be polite, clear, and specific.",
        "Students send emails to instructors for many reasons.",
        "Academic email should be written like a casual chat."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_9",
      "skillTag": "Summarizing",
      "stemGroup": "Choose the best summary."
    },
    {
      "id": "S06_B21",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Digital literacy helps students evaluate sources and communicate responsibly online.",
      "choices": [
        "Digital literacy supports responsible online evaluation and communication.",
        "Digital literacy helps students evaluate sources and communicate responsibly online.",
        "Students use digital tools for many different online activities.",
        "Digital literacy always solves every problem on the internet."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_0",
      "skillTag": "Summarizing",
      "stemGroup": "Choose the best summary."
    },
    {
      "id": "S06_B22",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Peer feedback can help students revise unclear ideas and improve paragraph organization.",
      "choices": [
        "Peer feedback can improve clarity and organization in writing.",
        "Peer feedback can help students revise unclear ideas and improve paragraph organization.",
        "Students sometimes exchange comments before submitting work.",
        "Peer feedback is better than all other writing support."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_1",
      "skillTag": "Summarizing",
      "stemGroup": "Choose the best summary."
    },
    {
      "id": "S06_B23",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Exercise may reduce stress and improve sleep quality among university students.",
      "choices": [
        "Exercise may support students’ well-being in several ways.",
        "Exercise may reduce stress and improve sleep quality among university students.",
        "University students sometimes feel stress during a semester.",
        "Exercise is the only factor that affects student well-being."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_2",
      "skillTag": "Summarizing",
      "stemGroup": "Choose the best summary."
    },
    {
      "id": "S06_B24",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Citation allows readers to locate the sources used in academic work.",
      "choices": [
        "Citation helps readers trace academic sources.",
        "Citation allows readers to locate the sources used in academic work.",
        "Readers can look at sources after reading academic work.",
        "Citation is useful because every sentence needs a reference."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_3",
      "skillTag": "Summarizing",
      "stemGroup": "Choose the best summary."
    },
    {
      "id": "S06_B25",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Online learning platforms provide tools that help students study outside the classroom.",
      "choices": [
        "Online platforms support learning beyond class time.",
        "Online learning platforms provide tools that help students study outside the classroom.",
        "Students may use technology in different learning contexts.",
        "Online platforms are always more effective than classrooms."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_4",
      "skillTag": "Summarizing",
      "stemGroup": "Choose the best summary."
    },
    {
      "id": "S06_B26",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Critical reading helps students check claims before accepting information.",
      "choices": [
        "Critical reading supports careful evaluation of claims.",
        "Critical reading helps students check claims before accepting information.",
        "Students accept information from many types of sources.",
        "Critical reading means rejecting all online information."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_5",
      "skillTag": "Summarizing",
      "stemGroup": "Choose the best summary."
    },
    {
      "id": "S06_B27",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Academic presentations require clear structure and evidence.",
      "choices": [
        "Academic presentations need organization and support.",
        "Academic presentations require clear structure and evidence.",
        "Presentations may include slides and spoken explanations.",
        "Academic presentations are successful only when they are long."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_6",
      "skillTag": "Summarizing",
      "stemGroup": "Choose the best summary."
    },
    {
      "id": "S06_B28",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Data description should highlight major trends instead of listing every value.",
      "choices": [
        "Data description should focus on major trends.",
        "Data description should highlight major trends instead of listing every value.",
        "Tables and graphs can contain many different numbers.",
        "Data description should include every number from the table."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_7",
      "skillTag": "Summarizing",
      "stemGroup": "Choose the best summary."
    },
    {
      "id": "S06_B29",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Responsible AI use requires checking outputs and acknowledging assistance when required.",
      "choices": [
        "Responsible AI use involves verification and transparency.",
        "Responsible AI use requires checking outputs and acknowledging assistance when required.",
        "AI tools can produce text for different learning tasks.",
        "Responsible AI use means accepting all AI outputs."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_8",
      "skillTag": "Summarizing",
      "stemGroup": "Choose the best summary."
    },
    {
      "id": "S06_B30",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Academic email should be polite, clear, and specific.",
      "choices": [
        "Academic email requires respectful and clear communication.",
        "Academic email should be polite, clear, and specific.",
        "Students send emails to instructors for many reasons.",
        "Academic email should be written like a casual chat."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_9",
      "skillTag": "Summarizing",
      "stemGroup": "Choose the best summary."
    },
    {
      "id": "S06_B31",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Digital literacy helps students evaluate sources and communicate responsibly online.",
      "choices": [
        "Digital literacy supports responsible online evaluation and communication.",
        "Digital literacy helps students evaluate sources and communicate responsibly online.",
        "Students use digital tools for many different online activities.",
        "Digital literacy always solves every problem on the internet."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_0",
      "skillTag": "Summarizing",
      "stemGroup": "Choose the best summary."
    },
    {
      "id": "S06_B32",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Peer feedback can help students revise unclear ideas and improve paragraph organization.",
      "choices": [
        "Peer feedback can improve clarity and organization in writing.",
        "Peer feedback can help students revise unclear ideas and improve paragraph organization.",
        "Students sometimes exchange comments before submitting work.",
        "Peer feedback is better than all other writing support."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_1",
      "skillTag": "Summarizing",
      "stemGroup": "Choose the best summary."
    },
    {
      "id": "S06_B33",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Exercise may reduce stress and improve sleep quality among university students.",
      "choices": [
        "Exercise may support students’ well-being in several ways.",
        "Exercise may reduce stress and improve sleep quality among university students.",
        "University students sometimes feel stress during a semester.",
        "Exercise is the only factor that affects student well-being."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_2",
      "skillTag": "Summarizing",
      "stemGroup": "Choose the best summary."
    },
    {
      "id": "S06_B34",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Citation allows readers to locate the sources used in academic work.",
      "choices": [
        "Citation helps readers trace academic sources.",
        "Citation allows readers to locate the sources used in academic work.",
        "Readers can look at sources after reading academic work.",
        "Citation is useful because every sentence needs a reference."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_3",
      "skillTag": "Summarizing",
      "stemGroup": "Choose the best summary."
    },
    {
      "id": "S06_B35",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Online learning platforms provide tools that help students study outside the classroom.",
      "choices": [
        "Online platforms support learning beyond class time.",
        "Online learning platforms provide tools that help students study outside the classroom.",
        "Students may use technology in different learning contexts.",
        "Online platforms are always more effective than classrooms."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_4",
      "skillTag": "Summarizing",
      "stemGroup": "Choose the best summary."
    },
    {
      "id": "S06_B36",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Critical reading helps students check claims before accepting information.",
      "choices": [
        "Critical reading supports careful evaluation of claims.",
        "Critical reading helps students check claims before accepting information.",
        "Students accept information from many types of sources.",
        "Critical reading means rejecting all online information."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_5",
      "skillTag": "Summarizing",
      "stemGroup": "Choose the best summary."
    },
    {
      "id": "S06_B37",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Academic presentations require clear structure and evidence.",
      "choices": [
        "Academic presentations need organization and support.",
        "Academic presentations require clear structure and evidence.",
        "Presentations may include slides and spoken explanations.",
        "Academic presentations are successful only when they are long."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_6",
      "skillTag": "Summarizing",
      "stemGroup": "Choose the best summary."
    },
    {
      "id": "S06_B38",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Data description should highlight major trends instead of listing every value.",
      "choices": [
        "Data description should focus on major trends.",
        "Data description should highlight major trends instead of listing every value.",
        "Tables and graphs can contain many different numbers.",
        "Data description should include every number from the table."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_7",
      "skillTag": "Summarizing",
      "stemGroup": "Choose the best summary."
    },
    {
      "id": "S06_B39",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Responsible AI use requires checking outputs and acknowledging assistance when required.",
      "choices": [
        "Responsible AI use involves verification and transparency.",
        "Responsible AI use requires checking outputs and acknowledging assistance when required.",
        "AI tools can produce text for different learning tasks.",
        "Responsible AI use means accepting all AI outputs."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_8",
      "skillTag": "Summarizing",
      "stemGroup": "Choose the best summary."
    },
    {
      "id": "S06_B40",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Academic email should be polite, clear, and specific.",
      "choices": [
        "Academic email requires respectful and clear communication.",
        "Academic email should be polite, clear, and specific.",
        "Students send emails to instructors for many reasons.",
        "Academic email should be written like a casual chat."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_9",
      "skillTag": "Summarizing",
      "stemGroup": "Choose the best summary."
    }
  ],
  "7": [
    {
      "id": "S07_B01",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: AI is super useful for students.",
      "choices": [
        "Artificial intelligence may support students’ learning processes.",
        "AI is really useful for students in every possible way.",
        "Students think AI is cool and helpful for many tasks.",
        "AI tools are good things that students can use a lot."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_0",
      "skillTag": "Academic Tone",
      "stemGroup": "Choose the most academic version."
    },
    {
      "id": "S07_B02",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: This source is kind of bad.",
      "choices": [
        "This source may not be reliable for academic use.",
        "This source is not very good for student assignments.",
        "The source looks bad because it seems strange.",
        "Students should not use this source because it feels wrong."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_1",
      "skillTag": "Academic Tone",
      "stemGroup": "Choose the most academic version."
    },
    {
      "id": "S07_B03",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: Lots of students use phones in class.",
      "choices": [
        "Many students use mobile phones during class activities.",
        "A lot of students use phones when they are in class.",
        "Students use their phones in class all the time.",
        "Phones are everywhere in class because students like them."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_2",
      "skillTag": "Academic Tone",
      "stemGroup": "Choose the most academic version."
    },
    {
      "id": "S07_B04",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: The data looks weird.",
      "choices": [
        "The data appear inconsistent with the expected pattern.",
        "The data looks strange and not really normal.",
        "The numbers seem weird compared with other results.",
        "The data is not good because it does not look right."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_3",
      "skillTag": "Academic Tone",
      "stemGroup": "Choose the most academic version."
    },
    {
      "id": "S07_B05",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: This problem is huge.",
      "choices": [
        "This issue is significant in university learning contexts.",
        "This problem is very big for many university students.",
        "The problem is huge and should be fixed quickly.",
        "Students face this big problem in many different ways."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_4",
      "skillTag": "Academic Tone",
      "stemGroup": "Choose the most academic version."
    },
    {
      "id": "S07_B06",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: The writer talks about AI stuff.",
      "choices": [
        "The author discusses issues related to artificial intelligence.",
        "The writer says many things about AI and technology.",
        "The author talks about AI topics in the article.",
        "The text gives some points about AI stuff for students."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_5",
      "skillTag": "Academic Tone",
      "stemGroup": "Choose the most academic version."
    },
    {
      "id": "S07_B07",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: People should not believe random posts.",
      "choices": [
        "Users should evaluate online posts before accepting them as reliable.",
        "People should not believe posts if they seem random online.",
        "Students should be careful with random posts on social media.",
        "Online users should not trust posts that look suspicious."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_6",
      "skillTag": "Academic Tone",
      "stemGroup": "Choose the most academic version."
    },
    {
      "id": "S07_B08",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: The class helped a lot.",
      "choices": [
        "The session was beneficial for developing academic skills.",
        "The class was helpful for students in many ways.",
        "Students learned a lot from the useful class activity.",
        "The lesson helped us understand many good things."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_7",
      "skillTag": "Academic Tone",
      "stemGroup": "Choose the most academic version."
    },
    {
      "id": "S07_B09",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: Social media makes students waste time.",
      "choices": [
        "Excessive social media use may reduce students’ study time.",
        "Social media makes many students lose their study time.",
        "Students waste time because social media is too interesting.",
        "Social media use is bad for student learning in many cases."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_8",
      "skillTag": "Academic Tone",
      "stemGroup": "Choose the most academic version."
    },
    {
      "id": "S07_B10",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: The result was really bad.",
      "choices": [
        "The result indicated a negative outcome for the participants.",
        "The result was not good for the students in the study.",
        "The result showed that the situation was very bad.",
        "The outcome was bad and created many problems."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_9",
      "skillTag": "Academic Tone",
      "stemGroup": "Choose the most academic version."
    },
    {
      "id": "S07_B11",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: AI is super useful for students.",
      "choices": [
        "Artificial intelligence may support students’ learning processes.",
        "AI is really useful for students in every possible way.",
        "Students think AI is cool and helpful for many tasks.",
        "AI tools are good things that students can use a lot."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_0",
      "skillTag": "Academic Tone",
      "stemGroup": "Choose the most academic version."
    },
    {
      "id": "S07_B12",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: This source is kind of bad.",
      "choices": [
        "This source may not be reliable for academic use.",
        "This source is not very good for student assignments.",
        "The source looks bad because it seems strange.",
        "Students should not use this source because it feels wrong."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_1",
      "skillTag": "Academic Tone",
      "stemGroup": "Choose the most academic version."
    },
    {
      "id": "S07_B13",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: Lots of students use phones in class.",
      "choices": [
        "Many students use mobile phones during class activities.",
        "A lot of students use phones when they are in class.",
        "Students use their phones in class all the time.",
        "Phones are everywhere in class because students like them."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_2",
      "skillTag": "Academic Tone",
      "stemGroup": "Choose the most academic version."
    },
    {
      "id": "S07_B14",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: The data looks weird.",
      "choices": [
        "The data appear inconsistent with the expected pattern.",
        "The data looks strange and not really normal.",
        "The numbers seem weird compared with other results.",
        "The data is not good because it does not look right."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_3",
      "skillTag": "Academic Tone",
      "stemGroup": "Choose the most academic version."
    },
    {
      "id": "S07_B15",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: This problem is huge.",
      "choices": [
        "This issue is significant in university learning contexts.",
        "This problem is very big for many university students.",
        "The problem is huge and should be fixed quickly.",
        "Students face this big problem in many different ways."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_4",
      "skillTag": "Academic Tone",
      "stemGroup": "Choose the most academic version."
    },
    {
      "id": "S07_B16",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: The writer talks about AI stuff.",
      "choices": [
        "The author discusses issues related to artificial intelligence.",
        "The writer says many things about AI and technology.",
        "The author talks about AI topics in the article.",
        "The text gives some points about AI stuff for students."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_5",
      "skillTag": "Academic Tone",
      "stemGroup": "Choose the most academic version."
    },
    {
      "id": "S07_B17",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: People should not believe random posts.",
      "choices": [
        "Users should evaluate online posts before accepting them as reliable.",
        "People should not believe posts if they seem random online.",
        "Students should be careful with random posts on social media.",
        "Online users should not trust posts that look suspicious."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_6",
      "skillTag": "Academic Tone",
      "stemGroup": "Choose the most academic version."
    },
    {
      "id": "S07_B18",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: The class helped a lot.",
      "choices": [
        "The session was beneficial for developing academic skills.",
        "The class was helpful for students in many ways.",
        "Students learned a lot from the useful class activity.",
        "The lesson helped us understand many good things."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_7",
      "skillTag": "Academic Tone",
      "stemGroup": "Choose the most academic version."
    },
    {
      "id": "S07_B19",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: Social media makes students waste time.",
      "choices": [
        "Excessive social media use may reduce students’ study time.",
        "Social media makes many students lose their study time.",
        "Students waste time because social media is too interesting.",
        "Social media use is bad for student learning in many cases."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_8",
      "skillTag": "Academic Tone",
      "stemGroup": "Choose the most academic version."
    },
    {
      "id": "S07_B20",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: The result was really bad.",
      "choices": [
        "The result indicated a negative outcome for the participants.",
        "The result was not good for the students in the study.",
        "The result showed that the situation was very bad.",
        "The outcome was bad and created many problems."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_9",
      "skillTag": "Academic Tone",
      "stemGroup": "Choose the most academic version."
    },
    {
      "id": "S07_B21",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: AI is super useful for students.",
      "choices": [
        "Artificial intelligence may support students’ learning processes.",
        "AI is really useful for students in every possible way.",
        "Students think AI is cool and helpful for many tasks.",
        "AI tools are good things that students can use a lot."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_0",
      "skillTag": "Academic Tone",
      "stemGroup": "Choose the most academic version."
    },
    {
      "id": "S07_B22",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: This source is kind of bad.",
      "choices": [
        "This source may not be reliable for academic use.",
        "This source is not very good for student assignments.",
        "The source looks bad because it seems strange.",
        "Students should not use this source because it feels wrong."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_1",
      "skillTag": "Academic Tone",
      "stemGroup": "Choose the most academic version."
    },
    {
      "id": "S07_B23",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: Lots of students use phones in class.",
      "choices": [
        "Many students use mobile phones during class activities.",
        "A lot of students use phones when they are in class.",
        "Students use their phones in class all the time.",
        "Phones are everywhere in class because students like them."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_2",
      "skillTag": "Academic Tone",
      "stemGroup": "Choose the most academic version."
    },
    {
      "id": "S07_B24",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: The data looks weird.",
      "choices": [
        "The data appear inconsistent with the expected pattern.",
        "The data looks strange and not really normal.",
        "The numbers seem weird compared with other results.",
        "The data is not good because it does not look right."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_3",
      "skillTag": "Academic Tone",
      "stemGroup": "Choose the most academic version."
    },
    {
      "id": "S07_B25",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: This problem is huge.",
      "choices": [
        "This issue is significant in university learning contexts.",
        "This problem is very big for many university students.",
        "The problem is huge and should be fixed quickly.",
        "Students face this big problem in many different ways."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_4",
      "skillTag": "Academic Tone",
      "stemGroup": "Choose the most academic version."
    },
    {
      "id": "S07_B26",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: The writer talks about AI stuff.",
      "choices": [
        "The author discusses issues related to artificial intelligence.",
        "The writer says many things about AI and technology.",
        "The author talks about AI topics in the article.",
        "The text gives some points about AI stuff for students."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_5",
      "skillTag": "Academic Tone",
      "stemGroup": "Choose the most academic version."
    },
    {
      "id": "S07_B27",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: People should not believe random posts.",
      "choices": [
        "Users should evaluate online posts before accepting them as reliable.",
        "People should not believe posts if they seem random online.",
        "Students should be careful with random posts on social media.",
        "Online users should not trust posts that look suspicious."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_6",
      "skillTag": "Academic Tone",
      "stemGroup": "Choose the most academic version."
    },
    {
      "id": "S07_B28",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: The class helped a lot.",
      "choices": [
        "The session was beneficial for developing academic skills.",
        "The class was helpful for students in many ways.",
        "Students learned a lot from the useful class activity.",
        "The lesson helped us understand many good things."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_7",
      "skillTag": "Academic Tone",
      "stemGroup": "Choose the most academic version."
    },
    {
      "id": "S07_B29",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: Social media makes students waste time.",
      "choices": [
        "Excessive social media use may reduce students’ study time.",
        "Social media makes many students lose their study time.",
        "Students waste time because social media is too interesting.",
        "Social media use is bad for student learning in many cases."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_8",
      "skillTag": "Academic Tone",
      "stemGroup": "Choose the most academic version."
    },
    {
      "id": "S07_B30",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: The result was really bad.",
      "choices": [
        "The result indicated a negative outcome for the participants.",
        "The result was not good for the students in the study.",
        "The result showed that the situation was very bad.",
        "The outcome was bad and created many problems."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_9",
      "skillTag": "Academic Tone",
      "stemGroup": "Choose the most academic version."
    },
    {
      "id": "S07_B31",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: AI is super useful for students.",
      "choices": [
        "Artificial intelligence may support students’ learning processes.",
        "AI is really useful for students in every possible way.",
        "Students think AI is cool and helpful for many tasks.",
        "AI tools are good things that students can use a lot."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_0",
      "skillTag": "Academic Tone",
      "stemGroup": "Choose the most academic version."
    },
    {
      "id": "S07_B32",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: This source is kind of bad.",
      "choices": [
        "This source may not be reliable for academic use.",
        "This source is not very good for student assignments.",
        "The source looks bad because it seems strange.",
        "Students should not use this source because it feels wrong."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_1",
      "skillTag": "Academic Tone",
      "stemGroup": "Choose the most academic version."
    },
    {
      "id": "S07_B33",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: Lots of students use phones in class.",
      "choices": [
        "Many students use mobile phones during class activities.",
        "A lot of students use phones when they are in class.",
        "Students use their phones in class all the time.",
        "Phones are everywhere in class because students like them."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_2",
      "skillTag": "Academic Tone",
      "stemGroup": "Choose the most academic version."
    },
    {
      "id": "S07_B34",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: The data looks weird.",
      "choices": [
        "The data appear inconsistent with the expected pattern.",
        "The data looks strange and not really normal.",
        "The numbers seem weird compared with other results.",
        "The data is not good because it does not look right."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_3",
      "skillTag": "Academic Tone",
      "stemGroup": "Choose the most academic version."
    },
    {
      "id": "S07_B35",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: This problem is huge.",
      "choices": [
        "This issue is significant in university learning contexts.",
        "This problem is very big for many university students.",
        "The problem is huge and should be fixed quickly.",
        "Students face this big problem in many different ways."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_4",
      "skillTag": "Academic Tone",
      "stemGroup": "Choose the most academic version."
    },
    {
      "id": "S07_B36",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: The writer talks about AI stuff.",
      "choices": [
        "The author discusses issues related to artificial intelligence.",
        "The writer says many things about AI and technology.",
        "The author talks about AI topics in the article.",
        "The text gives some points about AI stuff for students."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_5",
      "skillTag": "Academic Tone",
      "stemGroup": "Choose the most academic version."
    },
    {
      "id": "S07_B37",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: People should not believe random posts.",
      "choices": [
        "Users should evaluate online posts before accepting them as reliable.",
        "People should not believe posts if they seem random online.",
        "Students should be careful with random posts on social media.",
        "Online users should not trust posts that look suspicious."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_6",
      "skillTag": "Academic Tone",
      "stemGroup": "Choose the most academic version."
    },
    {
      "id": "S07_B38",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: The class helped a lot.",
      "choices": [
        "The session was beneficial for developing academic skills.",
        "The class was helpful for students in many ways.",
        "Students learned a lot from the useful class activity.",
        "The lesson helped us understand many good things."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_7",
      "skillTag": "Academic Tone",
      "stemGroup": "Choose the most academic version."
    },
    {
      "id": "S07_B39",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: Social media makes students waste time.",
      "choices": [
        "Excessive social media use may reduce students’ study time.",
        "Social media makes many students lose their study time.",
        "Students waste time because social media is too interesting.",
        "Social media use is bad for student learning in many cases."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_8",
      "skillTag": "Academic Tone",
      "stemGroup": "Choose the most academic version."
    },
    {
      "id": "S07_B40",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: The result was really bad.",
      "choices": [
        "The result indicated a negative outcome for the participants.",
        "The result was not good for the students in the study.",
        "The result showed that the situation was very bad.",
        "The outcome was bad and created many problems."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_9",
      "skillTag": "Academic Tone",
      "stemGroup": "Choose the most academic version."
    }
  ],
  "8": [
    {
      "id": "S08_B01",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "The researcher will ______ the interview data before writing the report.",
      "choices": [
        "analyze",
        "summarize",
        "collect",
        "organize"
      ],
      "answer": 0,
      "feedback": "Analyze means examine information carefully.",
      "quality": "vocab_0",
      "skillTag": "Integrated Review",
      "stemGroup": "integrated_0"
    },
    {
      "id": "S08_B02",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "The paragraph needs stronger ______ to support the writer’s claim.",
      "choices": [
        "evidence",
        "method",
        "context",
        "purpose"
      ],
      "answer": 0,
      "feedback": "Evidence supports a claim.",
      "quality": "vocab_1",
      "skillTag": "Integrated Review",
      "stemGroup": "integrated_1"
    },
    {
      "id": "S08_B03",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "The ______ section explains how participants were selected for the study.",
      "choices": [
        "method",
        "result",
        "summary",
        "citation"
      ],
      "answer": 0,
      "feedback": "Method explains the research procedure.",
      "quality": "vocab_2",
      "skillTag": "Integrated Review",
      "stemGroup": "integrated_2"
    },
    {
      "id": "S08_B04",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "The difference was ______ because it appeared across all three groups.",
      "choices": [
        "significant",
        "consistent",
        "specific",
        "relevant"
      ],
      "answer": 0,
      "feedback": "Significant means important or meaningful.",
      "quality": "vocab_3",
      "skillTag": "Integrated Review",
      "stemGroup": "integrated_3"
    },
    {
      "id": "S08_B05",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "The source was not reliable; ______, it should not be used as evidence.",
      "choices": [
        "therefore",
        "however",
        "moreover",
        "although"
      ],
      "answer": 0,
      "feedback": "Therefore signals result.",
      "quality": "vocab_4",
      "skillTag": "Integrated Review",
      "stemGroup": "integrated_4"
    },
    {
      "id": "S08_B06",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "The app is convenient; ______, students still need to check accuracy.",
      "choices": [
        "however",
        "therefore",
        "for example",
        "as a result"
      ],
      "answer": 0,
      "feedback": "However signals contrast.",
      "quality": "vocab_5",
      "skillTag": "Integrated Review",
      "stemGroup": "integrated_5"
    },
    {
      "id": "S08_B07",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "Students should ______ online information before using it in assignments.",
      "choices": [
        "evaluate",
        "describe",
        "collect",
        "present"
      ],
      "answer": 0,
      "feedback": "Evaluate means judge quality or reliability.",
      "quality": "vocab_6",
      "skillTag": "Integrated Review",
      "stemGroup": "integrated_6"
    },
    {
      "id": "S08_B08",
      "type": "mcq",
      "question": "Choose the best academic word or connector.",
      "context": "The results ______ that weekly practice improved vocabulary scores.",
      "choices": [
        "indicate",
        "define",
        "contrast",
        "replace"
      ],
      "answer": 0,
      "feedback": "Indicate means show or suggest.",
      "quality": "vocab_7",
      "skillTag": "Integrated Review",
      "stemGroup": "integrated_7"
    },
    {
      "id": "S08_B09",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Digital literacy helps students evaluate online sources and avoid misinformation. It also supports responsible communication when students share information online.",
      "choices": [
        "Digital literacy supports responsible evaluation and communication online.",
        "Digital literacy includes evaluating online sources before sharing.",
        "Communication online is common among university students.",
        "Students use online information in many different situations."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_0",
      "skillTag": "Integrated Review",
      "stemGroup": "integrated_8"
    },
    {
      "id": "S08_B10",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Peer feedback helps students notice unclear ideas in a draft. It can also improve paragraph organization before final submission.",
      "choices": [
        "Peer feedback can improve clarity and organization in writing.",
        "Students often submit drafts before the final assignment.",
        "Paragraph organization is one part of academic writing.",
        "Feedback may come from classmates or instructors."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_1",
      "skillTag": "Integrated Review",
      "stemGroup": "integrated_9"
    },
    {
      "id": "S08_B11",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Academic vocabulary helps students understand textbooks and research articles. Without key terms, they may misunderstand the writer’s argument.",
      "choices": [
        "Academic vocabulary supports understanding of academic texts.",
        "Research articles often contain difficult technical words.",
        "Students sometimes misunderstand textbook arguments.",
        "Vocabulary learning can happen inside or outside class."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_2",
      "skillTag": "Integrated Review",
      "stemGroup": "integrated_10"
    },
    {
      "id": "S08_B12",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Citation helps readers locate the original sources of information. It also shows that writers respect academic integrity.",
      "choices": [
        "Citation supports source tracing and academic integrity.",
        "Readers can use citations to find original sources.",
        "Academic integrity is important in university writing.",
        "Writers include sources in many types of assignments."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_3",
      "skillTag": "Integrated Review",
      "stemGroup": "integrated_11"
    },
    {
      "id": "S08_B13",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Online learning platforms provide videos, quizzes, and feedback. These tools help students practice outside the classroom.",
      "choices": [
        "Online learning platforms support practice beyond class time.",
        "Videos and quizzes are common tools on learning platforms.",
        "Feedback can help students understand their mistakes.",
        "Classroom learning is not the only way students practice."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_4",
      "skillTag": "Integrated Review",
      "stemGroup": "integrated_12"
    },
    {
      "id": "S08_B14",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Critical reading requires checking claims and evidence. This skill is important when students read online information.",
      "choices": [
        "Critical reading helps students evaluate claims and evidence.",
        "Students read online information in many daily situations.",
        "Evidence should be checked before accepting a claim.",
        "Online information may include both facts and opinions."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_5",
      "skillTag": "Integrated Review",
      "stemGroup": "integrated_13"
    },
    {
      "id": "S08_B15",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Summarizing requires students to identify key points and restate them briefly. This skill helps reduce copying from sources.",
      "choices": [
        "Summarizing helps students express key ideas briefly and ethically.",
        "Students need to identify key points before writing summaries.",
        "Copying from sources can create academic problems.",
        "Brief writing is often required in academic tasks."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_6",
      "skillTag": "Integrated Review",
      "stemGroup": "integrated_14"
    },
    {
      "id": "S08_B16",
      "type": "mcq",
      "question": "Which option best states the main idea?",
      "context": "Data description should focus on major trends rather than every number. This helps readers understand the main pattern quickly.",
      "choices": [
        "Data description should highlight major trends clearly.",
        "Writers sometimes list many numbers from tables.",
        "Readers need help understanding patterns in data.",
        "Major trends may include increases or decreases."
      ],
      "answer": 0,
      "feedback": "The correct answer covers the whole paragraph, not just a detail.",
      "quality": "mainidea_7",
      "skillTag": "Integrated Review",
      "stemGroup": "integrated_15"
    },
    {
      "id": "S08_B17",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "The official university website states that registration closes on June 30.",
      "choices": [
        "Fact",
        "Opinion",
        "Claim",
        "Evidence"
      ],
      "answer": 0,
      "feedback": "This statement can be checked through an official source.",
      "quality": "critical_0",
      "skillTag": "Integrated Review",
      "stemGroup": "integrated_16"
    },
    {
      "id": "S08_B18",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "A survey of 420 students found that 61% used AI tools for drafting.",
      "choices": [
        "Evidence",
        "Fact",
        "Opinion",
        "Claim"
      ],
      "answer": 0,
      "feedback": "This data can support a claim.",
      "quality": "critical_1",
      "skillTag": "Integrated Review",
      "stemGroup": "integrated_17"
    },
    {
      "id": "S08_B19",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "Online learning may improve students’ independence.",
      "choices": [
        "Claim",
        "Fact",
        "Opinion",
        "Evidence"
      ],
      "answer": 0,
      "feedback": "This idea needs evidence before it is accepted.",
      "quality": "critical_2",
      "skillTag": "Integrated Review",
      "stemGroup": "integrated_18"
    },
    {
      "id": "S08_B20",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "In my view, mobile learning is more convenient than classroom learning.",
      "choices": [
        "Opinion",
        "Fact",
        "Claim",
        "Evidence"
      ],
      "answer": 0,
      "feedback": "The phrase in my view signals opinion.",
      "quality": "critical_3",
      "skillTag": "Integrated Review",
      "stemGroup": "integrated_19"
    },
    {
      "id": "S08_B21",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "The report was published by the Ministry in 2025.",
      "choices": [
        "Fact",
        "Opinion",
        "Claim",
        "Evidence"
      ],
      "answer": 0,
      "feedback": "This publication detail can be verified.",
      "quality": "critical_4",
      "skillTag": "Integrated Review",
      "stemGroup": "integrated_20"
    },
    {
      "id": "S08_B22",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "According to the article, participants completed a ten-item questionnaire.",
      "choices": [
        "Evidence",
        "Fact",
        "Opinion",
        "Claim"
      ],
      "answer": 0,
      "feedback": "This source-based detail can support a method claim.",
      "quality": "critical_5",
      "skillTag": "Integrated Review",
      "stemGroup": "integrated_21"
    },
    {
      "id": "S08_B23",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "Social media always reduces students’ concentration.",
      "choices": [
        "Claim",
        "Fact",
        "Opinion",
        "Evidence"
      ],
      "answer": 0,
      "feedback": "Always is a strong claim that needs evidence.",
      "quality": "critical_6",
      "skillTag": "Integrated Review",
      "stemGroup": "integrated_22"
    },
    {
      "id": "S08_B24",
      "type": "mcq",
      "question": "Classify the statement.",
      "context": "I believe citation software is difficult to use.",
      "choices": [
        "Opinion",
        "Fact",
        "Claim",
        "Evidence"
      ],
      "answer": 0,
      "feedback": "I believe signals personal opinion.",
      "quality": "critical_7",
      "skillTag": "Integrated Review",
      "stemGroup": "integrated_23"
    },
    {
      "id": "S08_B25",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Digital literacy helps students evaluate sources and communicate responsibly online.",
      "choices": [
        "Digital literacy supports responsible online evaluation and communication.",
        "Digital literacy helps students evaluate sources and communicate responsibly online.",
        "Students use digital tools for many different online activities.",
        "Digital literacy always solves every problem on the internet."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_0",
      "skillTag": "Integrated Review",
      "stemGroup": "integrated_24"
    },
    {
      "id": "S08_B26",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Peer feedback can help students revise unclear ideas and improve paragraph organization.",
      "choices": [
        "Peer feedback can improve clarity and organization in writing.",
        "Peer feedback can help students revise unclear ideas and improve paragraph organization.",
        "Students sometimes exchange comments before submitting work.",
        "Peer feedback is better than all other writing support."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_1",
      "skillTag": "Integrated Review",
      "stemGroup": "integrated_25"
    },
    {
      "id": "S08_B27",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Exercise may reduce stress and improve sleep quality among university students.",
      "choices": [
        "Exercise may support students’ well-being in several ways.",
        "Exercise may reduce stress and improve sleep quality among university students.",
        "University students sometimes feel stress during a semester.",
        "Exercise is the only factor that affects student well-being."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_2",
      "skillTag": "Integrated Review",
      "stemGroup": "integrated_26"
    },
    {
      "id": "S08_B28",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Citation allows readers to locate the sources used in academic work.",
      "choices": [
        "Citation helps readers trace academic sources.",
        "Citation allows readers to locate the sources used in academic work.",
        "Readers can look at sources after reading academic work.",
        "Citation is useful because every sentence needs a reference."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_3",
      "skillTag": "Integrated Review",
      "stemGroup": "integrated_27"
    },
    {
      "id": "S08_B29",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Online learning platforms provide tools that help students study outside the classroom.",
      "choices": [
        "Online platforms support learning beyond class time.",
        "Online learning platforms provide tools that help students study outside the classroom.",
        "Students may use technology in different learning contexts.",
        "Online platforms are always more effective than classrooms."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_4",
      "skillTag": "Integrated Review",
      "stemGroup": "integrated_28"
    },
    {
      "id": "S08_B30",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Critical reading helps students check claims before accepting information.",
      "choices": [
        "Critical reading supports careful evaluation of claims.",
        "Critical reading helps students check claims before accepting information.",
        "Students accept information from many types of sources.",
        "Critical reading means rejecting all online information."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_5",
      "skillTag": "Integrated Review",
      "stemGroup": "integrated_29"
    },
    {
      "id": "S08_B31",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Academic presentations require clear structure and evidence.",
      "choices": [
        "Academic presentations need organization and support.",
        "Academic presentations require clear structure and evidence.",
        "Presentations may include slides and spoken explanations.",
        "Academic presentations are successful only when they are long."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_6",
      "skillTag": "Integrated Review",
      "stemGroup": "integrated_30"
    },
    {
      "id": "S08_B32",
      "type": "mcq",
      "question": "Choose the best summary.",
      "context": "Original: Data description should highlight major trends instead of listing every value.",
      "choices": [
        "Data description should focus on major trends.",
        "Data description should highlight major trends instead of listing every value.",
        "Tables and graphs can contain many different numbers.",
        "Data description should include every number from the table."
      ],
      "answer": 0,
      "feedback": "The best summary is shorter, accurate, and not copied word-for-word.",
      "quality": "summary_7",
      "skillTag": "Integrated Review",
      "stemGroup": "integrated_31"
    },
    {
      "id": "S08_B33",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: AI is super useful for students.",
      "choices": [
        "Artificial intelligence may support students’ learning processes.",
        "AI is really useful for students in every possible way.",
        "Students think AI is cool and helpful for many tasks.",
        "AI tools are good things that students can use a lot."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_0",
      "skillTag": "Integrated Review",
      "stemGroup": "integrated_32"
    },
    {
      "id": "S08_B34",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: This source is kind of bad.",
      "choices": [
        "This source may not be reliable for academic use.",
        "This source is not very good for student assignments.",
        "The source looks bad because it seems strange.",
        "Students should not use this source because it feels wrong."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_1",
      "skillTag": "Integrated Review",
      "stemGroup": "integrated_33"
    },
    {
      "id": "S08_B35",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: Lots of students use phones in class.",
      "choices": [
        "Many students use mobile phones during class activities.",
        "A lot of students use phones when they are in class.",
        "Students use their phones in class all the time.",
        "Phones are everywhere in class because students like them."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_2",
      "skillTag": "Integrated Review",
      "stemGroup": "integrated_34"
    },
    {
      "id": "S08_B36",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: The data looks weird.",
      "choices": [
        "The data appear inconsistent with the expected pattern.",
        "The data looks strange and not really normal.",
        "The numbers seem weird compared with other results.",
        "The data is not good because it does not look right."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_3",
      "skillTag": "Integrated Review",
      "stemGroup": "integrated_35"
    },
    {
      "id": "S08_B37",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: This problem is huge.",
      "choices": [
        "This issue is significant in university learning contexts.",
        "This problem is very big for many university students.",
        "The problem is huge and should be fixed quickly.",
        "Students face this big problem in many different ways."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_4",
      "skillTag": "Integrated Review",
      "stemGroup": "integrated_36"
    },
    {
      "id": "S08_B38",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: The writer talks about AI stuff.",
      "choices": [
        "The author discusses issues related to artificial intelligence.",
        "The writer says many things about AI and technology.",
        "The author talks about AI topics in the article.",
        "The text gives some points about AI stuff for students."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_5",
      "skillTag": "Integrated Review",
      "stemGroup": "integrated_37"
    },
    {
      "id": "S08_B39",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: People should not believe random posts.",
      "choices": [
        "Users should evaluate online posts before accepting them as reliable.",
        "People should not believe posts if they seem random online.",
        "Students should be careful with random posts on social media.",
        "Online users should not trust posts that look suspicious."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_6",
      "skillTag": "Integrated Review",
      "stemGroup": "integrated_38"
    },
    {
      "id": "S08_B40",
      "type": "mcq",
      "question": "Choose the most academic version.",
      "context": "Informal: The class helped a lot.",
      "choices": [
        "The session was beneficial for developing academic skills.",
        "The class was helpful for students in many ways.",
        "Students learned a lot from the useful class activity.",
        "The lesson helped us understand many good things."
      ],
      "answer": 0,
      "feedback": "The correct option is formal, precise, and appropriately cautious.",
      "quality": "tone_7",
      "skillTag": "Integrated Review",
      "stemGroup": "integrated_39"
    }
  ],
  "9": [
    {
      "id": "S09_B01",
      "type": "mcq",
      "question": "Choose the best topic sentence.",
      "context": "Topic: Digital literacy",
      "choices": [
        "Digital literacy is essential for responsible online learning.",
        "Students can evaluate sources before sharing information.",
        "Therefore, digital literacy should be developed in university courses.",
        "Digital literacy is a common topic in university classes."
      ],
      "answer": 0,
      "feedback": "A topic sentence states the main idea of the paragraph.",
      "quality": "para_topic_0",
      "skillTag": "Paragraph Writing",
      "stemGroup": "Choose the best topic sentence."
    },
    {
      "id": "S09_B02",
      "type": "mcq",
      "question": "Choose the best supporting detail.",
      "context": "Topic sentence: Peer feedback can improve students’ academic writing.",
      "choices": [
        "Classmates may identify unclear ideas in a draft.",
        "Therefore, peer feedback can support better revision.",
        "Peer feedback is important for many students.",
        "The paragraph will end with another idea about peer feedback."
      ],
      "answer": 0,
      "feedback": "A supporting detail explains or supports the topic sentence.",
      "quality": "para_support_1",
      "skillTag": "Paragraph Writing",
      "stemGroup": "Choose the best supporting detail."
    },
    {
      "id": "S09_B03",
      "type": "mcq",
      "question": "Choose the best concluding sentence.",
      "context": "Paragraph topic: Exercise",
      "choices": [
        "Therefore, exercise should be encouraged during the semester.",
        "Studies suggest that exercise may reduce stress.",
        "Regular exercise can support students’ physical and mental health.",
        "This paragraph includes information about exercise."
      ],
      "answer": 0,
      "feedback": "A concluding sentence closes the paragraph and connects to the main idea.",
      "quality": "para_conc_2",
      "skillTag": "Paragraph Writing",
      "stemGroup": "Choose the best concluding sentence."
    },
    {
      "id": "S09_B04",
      "type": "mcq",
      "question": "Which sentence does NOT fit this paragraph topic?",
      "context": "Topic: Citation",
      "choices": [
        "The cafeteria menu changed after the lunch break.",
        "Citation is important for academic integrity.",
        "It allows readers to locate the original sources.",
        "Therefore, students should cite information carefully."
      ],
      "answer": 0,
      "feedback": "The incorrect sentence is unrelated to the paragraph topic.",
      "quality": "para_irrel_3",
      "skillTag": "Paragraph Writing",
      "stemGroup": "Which sentence does NOT fit this paragraph topic?"
    },
    {
      "id": "S09_B05",
      "type": "mcq",
      "question": "Choose the best topic sentence.",
      "context": "Topic: AI tools",
      "choices": [
        "AI tools may support learning when used responsibly.",
        "Students should check the accuracy of AI-generated content.",
        "Therefore, AI use should involve careful evaluation.",
        "AI tools is a common topic in university classes."
      ],
      "answer": 0,
      "feedback": "A topic sentence states the main idea of the paragraph.",
      "quality": "para_topic_4",
      "skillTag": "Paragraph Writing",
      "stemGroup": "Choose the best topic sentence."
    },
    {
      "id": "S09_B06",
      "type": "mcq",
      "question": "Choose the best supporting detail.",
      "context": "Topic sentence: Academic email requires polite and clear communication.",
      "choices": [
        "A specific subject line helps the reader understand the purpose.",
        "Therefore, students should write emails with clear structure.",
        "Academic email is important for many students.",
        "The paragraph will end with another idea about academic email."
      ],
      "answer": 0,
      "feedback": "A supporting detail explains or supports the topic sentence.",
      "quality": "para_support_5",
      "skillTag": "Paragraph Writing",
      "stemGroup": "Choose the best supporting detail."
    },
    {
      "id": "S09_B07",
      "type": "mcq",
      "question": "Choose the best concluding sentence.",
      "context": "Paragraph topic: Presentation",
      "choices": [
        "Therefore, speakers should use signposting phrases.",
        "Phrases such as first and in conclusion help audiences follow the structure.",
        "Clear signposting improves academic presentations.",
        "This paragraph includes information about presentation."
      ],
      "answer": 0,
      "feedback": "A concluding sentence closes the paragraph and connects to the main idea.",
      "quality": "para_conc_6",
      "skillTag": "Paragraph Writing",
      "stemGroup": "Choose the best concluding sentence."
    },
    {
      "id": "S09_B08",
      "type": "mcq",
      "question": "Which sentence does NOT fit this paragraph topic?",
      "context": "Topic: Data description",
      "choices": [
        "The cafeteria menu changed after the lunch break.",
        "Data description should highlight major trends.",
        "Writers should compare important values instead of listing every number.",
        "Therefore, data paragraphs should focus on patterns."
      ],
      "answer": 0,
      "feedback": "The incorrect sentence is unrelated to the paragraph topic.",
      "quality": "para_irrel_7",
      "skillTag": "Paragraph Writing",
      "stemGroup": "Which sentence does NOT fit this paragraph topic?"
    },
    {
      "id": "S09_B09",
      "type": "mcq",
      "question": "Choose the best topic sentence.",
      "context": "Topic: Critical reading",
      "choices": [
        "Critical reading helps students evaluate information.",
        "Readers should check claims, evidence, and source credibility.",
        "Therefore, critical reading is important for academic work.",
        "Critical reading is a common topic in university classes."
      ],
      "answer": 0,
      "feedback": "A topic sentence states the main idea of the paragraph.",
      "quality": "para_topic_8",
      "skillTag": "Paragraph Writing",
      "stemGroup": "Choose the best topic sentence."
    },
    {
      "id": "S09_B10",
      "type": "mcq",
      "question": "Choose the best supporting detail.",
      "context": "Topic sentence: Online learning can support flexible study for university students.",
      "choices": [
        "Students can access videos and quizzes outside class.",
        "Therefore, online learning may increase learning opportunities.",
        "Online learning is important for many students.",
        "The paragraph will end with another idea about online learning."
      ],
      "answer": 0,
      "feedback": "A supporting detail explains or supports the topic sentence.",
      "quality": "para_support_9",
      "skillTag": "Paragraph Writing",
      "stemGroup": "Choose the best supporting detail."
    },
    {
      "id": "S09_B11",
      "type": "mcq",
      "question": "Choose the best concluding sentence.",
      "context": "Paragraph topic: Digital literacy",
      "choices": [
        "Therefore, digital literacy should be developed in university courses.",
        "Students can evaluate sources before sharing information.",
        "Digital literacy is essential for responsible online learning.",
        "This paragraph includes information about digital literacy."
      ],
      "answer": 0,
      "feedback": "A concluding sentence closes the paragraph and connects to the main idea.",
      "quality": "para_conc_0",
      "skillTag": "Paragraph Writing",
      "stemGroup": "Choose the best concluding sentence."
    },
    {
      "id": "S09_B12",
      "type": "mcq",
      "question": "Which sentence does NOT fit this paragraph topic?",
      "context": "Topic: Peer feedback",
      "choices": [
        "The cafeteria menu changed after the lunch break.",
        "Peer feedback can improve students’ academic writing.",
        "Classmates may identify unclear ideas in a draft.",
        "Therefore, peer feedback can support better revision."
      ],
      "answer": 0,
      "feedback": "The incorrect sentence is unrelated to the paragraph topic.",
      "quality": "para_irrel_1",
      "skillTag": "Paragraph Writing",
      "stemGroup": "Which sentence does NOT fit this paragraph topic?"
    },
    {
      "id": "S09_B13",
      "type": "mcq",
      "question": "Choose the best topic sentence.",
      "context": "Topic: Exercise",
      "choices": [
        "Regular exercise can support students’ physical and mental health.",
        "Studies suggest that exercise may reduce stress.",
        "Therefore, exercise should be encouraged during the semester.",
        "Exercise is a common topic in university classes."
      ],
      "answer": 0,
      "feedback": "A topic sentence states the main idea of the paragraph.",
      "quality": "para_topic_2",
      "skillTag": "Paragraph Writing",
      "stemGroup": "Choose the best topic sentence."
    },
    {
      "id": "S09_B14",
      "type": "mcq",
      "question": "Choose the best supporting detail.",
      "context": "Topic sentence: Citation is important for academic integrity.",
      "choices": [
        "It allows readers to locate the original sources.",
        "Therefore, students should cite information carefully.",
        "Citation is important for many students.",
        "The paragraph will end with another idea about citation."
      ],
      "answer": 0,
      "feedback": "A supporting detail explains or supports the topic sentence.",
      "quality": "para_support_3",
      "skillTag": "Paragraph Writing",
      "stemGroup": "Choose the best supporting detail."
    },
    {
      "id": "S09_B15",
      "type": "mcq",
      "question": "Choose the best concluding sentence.",
      "context": "Paragraph topic: AI tools",
      "choices": [
        "Therefore, AI use should involve careful evaluation.",
        "Students should check the accuracy of AI-generated content.",
        "AI tools may support learning when used responsibly.",
        "This paragraph includes information about ai tools."
      ],
      "answer": 0,
      "feedback": "A concluding sentence closes the paragraph and connects to the main idea.",
      "quality": "para_conc_4",
      "skillTag": "Paragraph Writing",
      "stemGroup": "Choose the best concluding sentence."
    },
    {
      "id": "S09_B16",
      "type": "mcq",
      "question": "Which sentence does NOT fit this paragraph topic?",
      "context": "Topic: Academic email",
      "choices": [
        "The cafeteria menu changed after the lunch break.",
        "Academic email requires polite and clear communication.",
        "A specific subject line helps the reader understand the purpose.",
        "Therefore, students should write emails with clear structure."
      ],
      "answer": 0,
      "feedback": "The incorrect sentence is unrelated to the paragraph topic.",
      "quality": "para_irrel_5",
      "skillTag": "Paragraph Writing",
      "stemGroup": "Which sentence does NOT fit this paragraph topic?"
    },
    {
      "id": "S09_B17",
      "type": "mcq",
      "question": "Choose the best topic sentence.",
      "context": "Topic: Presentation",
      "choices": [
        "Clear signposting improves academic presentations.",
        "Phrases such as first and in conclusion help audiences follow the structure.",
        "Therefore, speakers should use signposting phrases.",
        "Presentation is a common topic in university classes."
      ],
      "answer": 0,
      "feedback": "A topic sentence states the main idea of the paragraph.",
      "quality": "para_topic_6",
      "skillTag": "Paragraph Writing",
      "stemGroup": "Choose the best topic sentence."
    },
    {
      "id": "S09_B18",
      "type": "mcq",
      "question": "Choose the best supporting detail.",
      "context": "Topic sentence: Data description should highlight major trends.",
      "choices": [
        "Writers should compare important values instead of listing every number.",
        "Therefore, data paragraphs should focus on patterns.",
        "Data description is important for many students.",
        "The paragraph will end with another idea about data description."
      ],
      "answer": 0,
      "feedback": "A supporting detail explains or supports the topic sentence.",
      "quality": "para_support_7",
      "skillTag": "Paragraph Writing",
      "stemGroup": "Choose the best supporting detail."
    },
    {
      "id": "S09_B19",
      "type": "mcq",
      "question": "Choose the best concluding sentence.",
      "context": "Paragraph topic: Critical reading",
      "choices": [
        "Therefore, critical reading is important for academic work.",
        "Readers should check claims, evidence, and source credibility.",
        "Critical reading helps students evaluate information.",
        "This paragraph includes information about critical reading."
      ],
      "answer": 0,
      "feedback": "A concluding sentence closes the paragraph and connects to the main idea.",
      "quality": "para_conc_8",
      "skillTag": "Paragraph Writing",
      "stemGroup": "Choose the best concluding sentence."
    },
    {
      "id": "S09_B20",
      "type": "mcq",
      "question": "Which sentence does NOT fit this paragraph topic?",
      "context": "Topic: Online learning",
      "choices": [
        "The cafeteria menu changed after the lunch break.",
        "Online learning can support flexible study for university students.",
        "Students can access videos and quizzes outside class.",
        "Therefore, online learning may increase learning opportunities."
      ],
      "answer": 0,
      "feedback": "The incorrect sentence is unrelated to the paragraph topic.",
      "quality": "para_irrel_9",
      "skillTag": "Paragraph Writing",
      "stemGroup": "Which sentence does NOT fit this paragraph topic?"
    },
    {
      "id": "S09_B21",
      "type": "mcq",
      "question": "Choose the best topic sentence.",
      "context": "Topic: Digital literacy",
      "choices": [
        "Digital literacy is essential for responsible online learning.",
        "Students can evaluate sources before sharing information.",
        "Therefore, digital literacy should be developed in university courses.",
        "Digital literacy is a common topic in university classes."
      ],
      "answer": 0,
      "feedback": "A topic sentence states the main idea of the paragraph.",
      "quality": "para_topic_0",
      "skillTag": "Paragraph Writing",
      "stemGroup": "Choose the best topic sentence."
    },
    {
      "id": "S09_B22",
      "type": "mcq",
      "question": "Choose the best supporting detail.",
      "context": "Topic sentence: Peer feedback can improve students’ academic writing.",
      "choices": [
        "Classmates may identify unclear ideas in a draft.",
        "Therefore, peer feedback can support better revision.",
        "Peer feedback is important for many students.",
        "The paragraph will end with another idea about peer feedback."
      ],
      "answer": 0,
      "feedback": "A supporting detail explains or supports the topic sentence.",
      "quality": "para_support_1",
      "skillTag": "Paragraph Writing",
      "stemGroup": "Choose the best supporting detail."
    },
    {
      "id": "S09_B23",
      "type": "mcq",
      "question": "Choose the best concluding sentence.",
      "context": "Paragraph topic: Exercise",
      "choices": [
        "Therefore, exercise should be encouraged during the semester.",
        "Studies suggest that exercise may reduce stress.",
        "Regular exercise can support students’ physical and mental health.",
        "This paragraph includes information about exercise."
      ],
      "answer": 0,
      "feedback": "A concluding sentence closes the paragraph and connects to the main idea.",
      "quality": "para_conc_2",
      "skillTag": "Paragraph Writing",
      "stemGroup": "Choose the best concluding sentence."
    },
    {
      "id": "S09_B24",
      "type": "mcq",
      "question": "Which sentence does NOT fit this paragraph topic?",
      "context": "Topic: Citation",
      "choices": [
        "The cafeteria menu changed after the lunch break.",
        "Citation is important for academic integrity.",
        "It allows readers to locate the original sources.",
        "Therefore, students should cite information carefully."
      ],
      "answer": 0,
      "feedback": "The incorrect sentence is unrelated to the paragraph topic.",
      "quality": "para_irrel_3",
      "skillTag": "Paragraph Writing",
      "stemGroup": "Which sentence does NOT fit this paragraph topic?"
    },
    {
      "id": "S09_B25",
      "type": "mcq",
      "question": "Choose the best topic sentence.",
      "context": "Topic: AI tools",
      "choices": [
        "AI tools may support learning when used responsibly.",
        "Students should check the accuracy of AI-generated content.",
        "Therefore, AI use should involve careful evaluation.",
        "AI tools is a common topic in university classes."
      ],
      "answer": 0,
      "feedback": "A topic sentence states the main idea of the paragraph.",
      "quality": "para_topic_4",
      "skillTag": "Paragraph Writing",
      "stemGroup": "Choose the best topic sentence."
    },
    {
      "id": "S09_B26",
      "type": "mcq",
      "question": "Choose the best supporting detail.",
      "context": "Topic sentence: Academic email requires polite and clear communication.",
      "choices": [
        "A specific subject line helps the reader understand the purpose.",
        "Therefore, students should write emails with clear structure.",
        "Academic email is important for many students.",
        "The paragraph will end with another idea about academic email."
      ],
      "answer": 0,
      "feedback": "A supporting detail explains or supports the topic sentence.",
      "quality": "para_support_5",
      "skillTag": "Paragraph Writing",
      "stemGroup": "Choose the best supporting detail."
    },
    {
      "id": "S09_B27",
      "type": "mcq",
      "question": "Choose the best concluding sentence.",
      "context": "Paragraph topic: Presentation",
      "choices": [
        "Therefore, speakers should use signposting phrases.",
        "Phrases such as first and in conclusion help audiences follow the structure.",
        "Clear signposting improves academic presentations.",
        "This paragraph includes information about presentation."
      ],
      "answer": 0,
      "feedback": "A concluding sentence closes the paragraph and connects to the main idea.",
      "quality": "para_conc_6",
      "skillTag": "Paragraph Writing",
      "stemGroup": "Choose the best concluding sentence."
    },
    {
      "id": "S09_B28",
      "type": "mcq",
      "question": "Which sentence does NOT fit this paragraph topic?",
      "context": "Topic: Data description",
      "choices": [
        "The cafeteria menu changed after the lunch break.",
        "Data description should highlight major trends.",
        "Writers should compare important values instead of listing every number.",
        "Therefore, data paragraphs should focus on patterns."
      ],
      "answer": 0,
      "feedback": "The incorrect sentence is unrelated to the paragraph topic.",
      "quality": "para_irrel_7",
      "skillTag": "Paragraph Writing",
      "stemGroup": "Which sentence does NOT fit this paragraph topic?"
    },
    {
      "id": "S09_B29",
      "type": "mcq",
      "question": "Choose the best topic sentence.",
      "context": "Topic: Critical reading",
      "choices": [
        "Critical reading helps students evaluate information.",
        "Readers should check claims, evidence, and source credibility.",
        "Therefore, critical reading is important for academic work.",
        "Critical reading is a common topic in university classes."
      ],
      "answer": 0,
      "feedback": "A topic sentence states the main idea of the paragraph.",
      "quality": "para_topic_8",
      "skillTag": "Paragraph Writing",
      "stemGroup": "Choose the best topic sentence."
    },
    {
      "id": "S09_B30",
      "type": "mcq",
      "question": "Choose the best supporting detail.",
      "context": "Topic sentence: Online learning can support flexible study for university students.",
      "choices": [
        "Students can access videos and quizzes outside class.",
        "Therefore, online learning may increase learning opportunities.",
        "Online learning is important for many students.",
        "The paragraph will end with another idea about online learning."
      ],
      "answer": 0,
      "feedback": "A supporting detail explains or supports the topic sentence.",
      "quality": "para_support_9",
      "skillTag": "Paragraph Writing",
      "stemGroup": "Choose the best supporting detail."
    },
    {
      "id": "S09_B31",
      "type": "mcq",
      "question": "Choose the best concluding sentence.",
      "context": "Paragraph topic: Digital literacy",
      "choices": [
        "Therefore, digital literacy should be developed in university courses.",
        "Students can evaluate sources before sharing information.",
        "Digital literacy is essential for responsible online learning.",
        "This paragraph includes information about digital literacy."
      ],
      "answer": 0,
      "feedback": "A concluding sentence closes the paragraph and connects to the main idea.",
      "quality": "para_conc_0",
      "skillTag": "Paragraph Writing",
      "stemGroup": "Choose the best concluding sentence."
    },
    {
      "id": "S09_B32",
      "type": "mcq",
      "question": "Which sentence does NOT fit this paragraph topic?",
      "context": "Topic: Peer feedback",
      "choices": [
        "The cafeteria menu changed after the lunch break.",
        "Peer feedback can improve students’ academic writing.",
        "Classmates may identify unclear ideas in a draft.",
        "Therefore, peer feedback can support better revision."
      ],
      "answer": 0,
      "feedback": "The incorrect sentence is unrelated to the paragraph topic.",
      "quality": "para_irrel_1",
      "skillTag": "Paragraph Writing",
      "stemGroup": "Which sentence does NOT fit this paragraph topic?"
    },
    {
      "id": "S09_B33",
      "type": "mcq",
      "question": "Choose the best topic sentence.",
      "context": "Topic: Exercise",
      "choices": [
        "Regular exercise can support students’ physical and mental health.",
        "Studies suggest that exercise may reduce stress.",
        "Therefore, exercise should be encouraged during the semester.",
        "Exercise is a common topic in university classes."
      ],
      "answer": 0,
      "feedback": "A topic sentence states the main idea of the paragraph.",
      "quality": "para_topic_2",
      "skillTag": "Paragraph Writing",
      "stemGroup": "Choose the best topic sentence."
    },
    {
      "id": "S09_B34",
      "type": "mcq",
      "question": "Choose the best supporting detail.",
      "context": "Topic sentence: Citation is important for academic integrity.",
      "choices": [
        "It allows readers to locate the original sources.",
        "Therefore, students should cite information carefully.",
        "Citation is important for many students.",
        "The paragraph will end with another idea about citation."
      ],
      "answer": 0,
      "feedback": "A supporting detail explains or supports the topic sentence.",
      "quality": "para_support_3",
      "skillTag": "Paragraph Writing",
      "stemGroup": "Choose the best supporting detail."
    },
    {
      "id": "S09_B35",
      "type": "mcq",
      "question": "Choose the best concluding sentence.",
      "context": "Paragraph topic: AI tools",
      "choices": [
        "Therefore, AI use should involve careful evaluation.",
        "Students should check the accuracy of AI-generated content.",
        "AI tools may support learning when used responsibly.",
        "This paragraph includes information about ai tools."
      ],
      "answer": 0,
      "feedback": "A concluding sentence closes the paragraph and connects to the main idea.",
      "quality": "para_conc_4",
      "skillTag": "Paragraph Writing",
      "stemGroup": "Choose the best concluding sentence."
    },
    {
      "id": "S09_B36",
      "type": "mcq",
      "question": "Which sentence does NOT fit this paragraph topic?",
      "context": "Topic: Academic email",
      "choices": [
        "The cafeteria menu changed after the lunch break.",
        "Academic email requires polite and clear communication.",
        "A specific subject line helps the reader understand the purpose.",
        "Therefore, students should write emails with clear structure."
      ],
      "answer": 0,
      "feedback": "The incorrect sentence is unrelated to the paragraph topic.",
      "quality": "para_irrel_5",
      "skillTag": "Paragraph Writing",
      "stemGroup": "Which sentence does NOT fit this paragraph topic?"
    },
    {
      "id": "S09_B37",
      "type": "mcq",
      "question": "Choose the best topic sentence.",
      "context": "Topic: Presentation",
      "choices": [
        "Clear signposting improves academic presentations.",
        "Phrases such as first and in conclusion help audiences follow the structure.",
        "Therefore, speakers should use signposting phrases.",
        "Presentation is a common topic in university classes."
      ],
      "answer": 0,
      "feedback": "A topic sentence states the main idea of the paragraph.",
      "quality": "para_topic_6",
      "skillTag": "Paragraph Writing",
      "stemGroup": "Choose the best topic sentence."
    },
    {
      "id": "S09_B38",
      "type": "mcq",
      "question": "Choose the best supporting detail.",
      "context": "Topic sentence: Data description should highlight major trends.",
      "choices": [
        "Writers should compare important values instead of listing every number.",
        "Therefore, data paragraphs should focus on patterns.",
        "Data description is important for many students.",
        "The paragraph will end with another idea about data description."
      ],
      "answer": 0,
      "feedback": "A supporting detail explains or supports the topic sentence.",
      "quality": "para_support_7",
      "skillTag": "Paragraph Writing",
      "stemGroup": "Choose the best supporting detail."
    },
    {
      "id": "S09_B39",
      "type": "mcq",
      "question": "Choose the best concluding sentence.",
      "context": "Paragraph topic: Critical reading",
      "choices": [
        "Therefore, critical reading is important for academic work.",
        "Readers should check claims, evidence, and source credibility.",
        "Critical reading helps students evaluate information.",
        "This paragraph includes information about critical reading."
      ],
      "answer": 0,
      "feedback": "A concluding sentence closes the paragraph and connects to the main idea.",
      "quality": "para_conc_8",
      "skillTag": "Paragraph Writing",
      "stemGroup": "Choose the best concluding sentence."
    },
    {
      "id": "S09_B40",
      "type": "mcq",
      "question": "Which sentence does NOT fit this paragraph topic?",
      "context": "Topic: Online learning",
      "choices": [
        "The cafeteria menu changed after the lunch break.",
        "Online learning can support flexible study for university students.",
        "Students can access videos and quizzes outside class.",
        "Therefore, online learning may increase learning opportunities."
      ],
      "answer": 0,
      "feedback": "The incorrect sentence is unrelated to the paragraph topic.",
      "quality": "para_irrel_9",
      "skillTag": "Paragraph Writing",
      "stemGroup": "Which sentence does NOT fit this paragraph topic?"
    }
  ],
  "10": [
    {
      "id": "S10_B01",
      "type": "mcq",
      "question": "Choose the best data description.",
      "context": "Data: AI tool use increased from 30% in 2023 to 55% in 2025.",
      "choices": [
        "AI tool use increased between 2023 and 2025.",
        "AI tool use remained exactly stable across the years.",
        "AI tool use decreased after 2023.",
        "AI tool use was higher in 2023 than in 2025."
      ],
      "answer": 0,
      "feedback": "The correct option describes the data accurately without overclaiming.",
      "quality": "data_0",
      "skillTag": "Data Description",
      "stemGroup": "Choose the best data description."
    },
    {
      "id": "S10_B02",
      "type": "mcq",
      "question": "Choose the best data description.",
      "context": "Data: Group A scored 78%, while Group B scored 62%.",
      "choices": [
        "Group A scored higher than Group B.",
        "Group B scored higher than Group A.",
        "Both groups received the same score.",
        "The scores cannot be compared at all."
      ],
      "answer": 0,
      "feedback": "The correct option describes the data accurately without overclaiming.",
      "quality": "data_1",
      "skillTag": "Data Description",
      "stemGroup": "Choose the best data description."
    },
    {
      "id": "S10_B03",
      "type": "mcq",
      "question": "Choose the best data description.",
      "context": "Data: The number of errors fell from 15 in Draft 1 to 6 in Draft 2.",
      "choices": [
        "The number of errors decreased between the two drafts.",
        "The number of errors increased in the second draft.",
        "The number of errors remained stable across drafts.",
        "The second draft had more errors than the first draft."
      ],
      "answer": 0,
      "feedback": "The correct option describes the data accurately without overclaiming.",
      "quality": "data_2",
      "skillTag": "Data Description",
      "stemGroup": "Choose the best data description."
    },
    {
      "id": "S10_B04",
      "type": "mcq",
      "question": "Choose the best data description.",
      "context": "Data: Student attendance was 80%, 81%, and 80% across three weeks.",
      "choices": [
        "Student attendance remained relatively stable.",
        "Student attendance increased dramatically each week.",
        "Student attendance decreased sharply across the period.",
        "Student attendance doubled after the first week."
      ],
      "answer": 0,
      "feedback": "The correct option describes the data accurately without overclaiming.",
      "quality": "data_3",
      "skillTag": "Data Description",
      "stemGroup": "Choose the best data description."
    },
    {
      "id": "S10_B05",
      "type": "mcq",
      "question": "Choose the best data description.",
      "context": "Data: Downloads rose from 100 in January to 180 in February.",
      "choices": [
        "The number of downloads increased significantly.",
        "The number of downloads declined after January.",
        "The number of downloads remained unchanged.",
        "The data show no change in user behavior."
      ],
      "answer": 0,
      "feedback": "The correct option describes the data accurately without overclaiming.",
      "quality": "data_4",
      "skillTag": "Data Description",
      "stemGroup": "Choose the best data description."
    },
    {
      "id": "S10_B06",
      "type": "mcq",
      "question": "Choose the best data description.",
      "context": "Data: Video preference was 45%, while quiz preference was 30%.",
      "choices": [
        "Videos were preferred by a higher percentage of students.",
        "Quizzes were preferred by a higher percentage of students.",
        "Both tools were preferred by the same percentage.",
        "The data prove that quizzes are ineffective."
      ],
      "answer": 0,
      "feedback": "The correct option describes the data accurately without overclaiming.",
      "quality": "data_5",
      "skillTag": "Data Description",
      "stemGroup": "Choose the best data description."
    },
    {
      "id": "S10_B07",
      "type": "mcq",
      "question": "Choose the best data description.",
      "context": "Data: The score changed from 81 to 83.",
      "choices": [
        "The score increased slightly.",
        "The score increased dramatically.",
        "The score decreased sharply.",
        "The score remained exactly the same."
      ],
      "answer": 0,
      "feedback": "The correct option describes the data accurately without overclaiming.",
      "quality": "data_6",
      "skillTag": "Data Description",
      "stemGroup": "Choose the best data description."
    },
    {
      "id": "S10_B08",
      "type": "mcq",
      "question": "Choose the best data description.",
      "context": "Data: The percentage fell from 70% to 52% after the training.",
      "choices": [
        "The percentage decreased after the training.",
        "The percentage increased after the training.",
        "The percentage stayed the same after the training.",
        "The data show no pattern after the training."
      ],
      "answer": 0,
      "feedback": "The correct option describes the data accurately without overclaiming.",
      "quality": "data_7",
      "skillTag": "Data Description",
      "stemGroup": "Choose the best data description."
    },
    {
      "id": "S10_B09",
      "type": "mcq",
      "question": "Choose the best data description.",
      "context": "Data: Class A had 35 participants and Class B had 35 participants.",
      "choices": [
        "Both classes had the same number of participants.",
        "Class A had more participants than Class B.",
        "Class B had more participants than Class A.",
        "The participant numbers were not reported."
      ],
      "answer": 0,
      "feedback": "The correct option describes the data accurately without overclaiming.",
      "quality": "data_8",
      "skillTag": "Data Description",
      "stemGroup": "Choose the best data description."
    },
    {
      "id": "S10_B10",
      "type": "mcq",
      "question": "Choose the best data description.",
      "context": "Data: Engagement rose from 40% to 65% after game-based learning was introduced.",
      "choices": [
        "Engagement increased after game-based learning was introduced.",
        "Engagement decreased after game-based learning was introduced.",
        "Engagement remained stable throughout the study.",
        "Engagement was not related to the learning activity."
      ],
      "answer": 0,
      "feedback": "The correct option describes the data accurately without overclaiming.",
      "quality": "data_9",
      "skillTag": "Data Description",
      "stemGroup": "Choose the best data description."
    },
    {
      "id": "S10_B11",
      "type": "mcq",
      "question": "Choose the best data description.",
      "context": "Data: AI tool use increased from 30% in 2023 to 55% in 2025.",
      "choices": [
        "AI tool use increased between 2023 and 2025.",
        "AI tool use remained exactly stable across the years.",
        "AI tool use decreased after 2023.",
        "AI tool use was higher in 2023 than in 2025."
      ],
      "answer": 0,
      "feedback": "The correct option describes the data accurately without overclaiming.",
      "quality": "data_0",
      "skillTag": "Data Description",
      "stemGroup": "Choose the best data description."
    },
    {
      "id": "S10_B12",
      "type": "mcq",
      "question": "Choose the best data description.",
      "context": "Data: Group A scored 78%, while Group B scored 62%.",
      "choices": [
        "Group A scored higher than Group B.",
        "Group B scored higher than Group A.",
        "Both groups received the same score.",
        "The scores cannot be compared at all."
      ],
      "answer": 0,
      "feedback": "The correct option describes the data accurately without overclaiming.",
      "quality": "data_1",
      "skillTag": "Data Description",
      "stemGroup": "Choose the best data description."
    },
    {
      "id": "S10_B13",
      "type": "mcq",
      "question": "Choose the best data description.",
      "context": "Data: The number of errors fell from 15 in Draft 1 to 6 in Draft 2.",
      "choices": [
        "The number of errors decreased between the two drafts.",
        "The number of errors increased in the second draft.",
        "The number of errors remained stable across drafts.",
        "The second draft had more errors than the first draft."
      ],
      "answer": 0,
      "feedback": "The correct option describes the data accurately without overclaiming.",
      "quality": "data_2",
      "skillTag": "Data Description",
      "stemGroup": "Choose the best data description."
    },
    {
      "id": "S10_B14",
      "type": "mcq",
      "question": "Choose the best data description.",
      "context": "Data: Student attendance was 80%, 81%, and 80% across three weeks.",
      "choices": [
        "Student attendance remained relatively stable.",
        "Student attendance increased dramatically each week.",
        "Student attendance decreased sharply across the period.",
        "Student attendance doubled after the first week."
      ],
      "answer": 0,
      "feedback": "The correct option describes the data accurately without overclaiming.",
      "quality": "data_3",
      "skillTag": "Data Description",
      "stemGroup": "Choose the best data description."
    },
    {
      "id": "S10_B15",
      "type": "mcq",
      "question": "Choose the best data description.",
      "context": "Data: Downloads rose from 100 in January to 180 in February.",
      "choices": [
        "The number of downloads increased significantly.",
        "The number of downloads declined after January.",
        "The number of downloads remained unchanged.",
        "The data show no change in user behavior."
      ],
      "answer": 0,
      "feedback": "The correct option describes the data accurately without overclaiming.",
      "quality": "data_4",
      "skillTag": "Data Description",
      "stemGroup": "Choose the best data description."
    },
    {
      "id": "S10_B16",
      "type": "mcq",
      "question": "Choose the best data description.",
      "context": "Data: Video preference was 45%, while quiz preference was 30%.",
      "choices": [
        "Videos were preferred by a higher percentage of students.",
        "Quizzes were preferred by a higher percentage of students.",
        "Both tools were preferred by the same percentage.",
        "The data prove that quizzes are ineffective."
      ],
      "answer": 0,
      "feedback": "The correct option describes the data accurately without overclaiming.",
      "quality": "data_5",
      "skillTag": "Data Description",
      "stemGroup": "Choose the best data description."
    },
    {
      "id": "S10_B17",
      "type": "mcq",
      "question": "Choose the best data description.",
      "context": "Data: The score changed from 81 to 83.",
      "choices": [
        "The score increased slightly.",
        "The score increased dramatically.",
        "The score decreased sharply.",
        "The score remained exactly the same."
      ],
      "answer": 0,
      "feedback": "The correct option describes the data accurately without overclaiming.",
      "quality": "data_6",
      "skillTag": "Data Description",
      "stemGroup": "Choose the best data description."
    },
    {
      "id": "S10_B18",
      "type": "mcq",
      "question": "Choose the best data description.",
      "context": "Data: The percentage fell from 70% to 52% after the training.",
      "choices": [
        "The percentage decreased after the training.",
        "The percentage increased after the training.",
        "The percentage stayed the same after the training.",
        "The data show no pattern after the training."
      ],
      "answer": 0,
      "feedback": "The correct option describes the data accurately without overclaiming.",
      "quality": "data_7",
      "skillTag": "Data Description",
      "stemGroup": "Choose the best data description."
    },
    {
      "id": "S10_B19",
      "type": "mcq",
      "question": "Choose the best data description.",
      "context": "Data: Class A had 35 participants and Class B had 35 participants.",
      "choices": [
        "Both classes had the same number of participants.",
        "Class A had more participants than Class B.",
        "Class B had more participants than Class A.",
        "The participant numbers were not reported."
      ],
      "answer": 0,
      "feedback": "The correct option describes the data accurately without overclaiming.",
      "quality": "data_8",
      "skillTag": "Data Description",
      "stemGroup": "Choose the best data description."
    },
    {
      "id": "S10_B20",
      "type": "mcq",
      "question": "Choose the best data description.",
      "context": "Data: Engagement rose from 40% to 65% after game-based learning was introduced.",
      "choices": [
        "Engagement increased after game-based learning was introduced.",
        "Engagement decreased after game-based learning was introduced.",
        "Engagement remained stable throughout the study.",
        "Engagement was not related to the learning activity."
      ],
      "answer": 0,
      "feedback": "The correct option describes the data accurately without overclaiming.",
      "quality": "data_9",
      "skillTag": "Data Description",
      "stemGroup": "Choose the best data description."
    },
    {
      "id": "S10_B21",
      "type": "mcq",
      "question": "Choose the best data description.",
      "context": "Data: AI tool use increased from 30% in 2023 to 55% in 2025.",
      "choices": [
        "AI tool use increased between 2023 and 2025.",
        "AI tool use remained exactly stable across the years.",
        "AI tool use decreased after 2023.",
        "AI tool use was higher in 2023 than in 2025."
      ],
      "answer": 0,
      "feedback": "The correct option describes the data accurately without overclaiming.",
      "quality": "data_0",
      "skillTag": "Data Description",
      "stemGroup": "Choose the best data description."
    },
    {
      "id": "S10_B22",
      "type": "mcq",
      "question": "Choose the best data description.",
      "context": "Data: Group A scored 78%, while Group B scored 62%.",
      "choices": [
        "Group A scored higher than Group B.",
        "Group B scored higher than Group A.",
        "Both groups received the same score.",
        "The scores cannot be compared at all."
      ],
      "answer": 0,
      "feedback": "The correct option describes the data accurately without overclaiming.",
      "quality": "data_1",
      "skillTag": "Data Description",
      "stemGroup": "Choose the best data description."
    },
    {
      "id": "S10_B23",
      "type": "mcq",
      "question": "Choose the best data description.",
      "context": "Data: The number of errors fell from 15 in Draft 1 to 6 in Draft 2.",
      "choices": [
        "The number of errors decreased between the two drafts.",
        "The number of errors increased in the second draft.",
        "The number of errors remained stable across drafts.",
        "The second draft had more errors than the first draft."
      ],
      "answer": 0,
      "feedback": "The correct option describes the data accurately without overclaiming.",
      "quality": "data_2",
      "skillTag": "Data Description",
      "stemGroup": "Choose the best data description."
    },
    {
      "id": "S10_B24",
      "type": "mcq",
      "question": "Choose the best data description.",
      "context": "Data: Student attendance was 80%, 81%, and 80% across three weeks.",
      "choices": [
        "Student attendance remained relatively stable.",
        "Student attendance increased dramatically each week.",
        "Student attendance decreased sharply across the period.",
        "Student attendance doubled after the first week."
      ],
      "answer": 0,
      "feedback": "The correct option describes the data accurately without overclaiming.",
      "quality": "data_3",
      "skillTag": "Data Description",
      "stemGroup": "Choose the best data description."
    },
    {
      "id": "S10_B25",
      "type": "mcq",
      "question": "Choose the best data description.",
      "context": "Data: Downloads rose from 100 in January to 180 in February.",
      "choices": [
        "The number of downloads increased significantly.",
        "The number of downloads declined after January.",
        "The number of downloads remained unchanged.",
        "The data show no change in user behavior."
      ],
      "answer": 0,
      "feedback": "The correct option describes the data accurately without overclaiming.",
      "quality": "data_4",
      "skillTag": "Data Description",
      "stemGroup": "Choose the best data description."
    },
    {
      "id": "S10_B26",
      "type": "mcq",
      "question": "Choose the best data description.",
      "context": "Data: Video preference was 45%, while quiz preference was 30%.",
      "choices": [
        "Videos were preferred by a higher percentage of students.",
        "Quizzes were preferred by a higher percentage of students.",
        "Both tools were preferred by the same percentage.",
        "The data prove that quizzes are ineffective."
      ],
      "answer": 0,
      "feedback": "The correct option describes the data accurately without overclaiming.",
      "quality": "data_5",
      "skillTag": "Data Description",
      "stemGroup": "Choose the best data description."
    },
    {
      "id": "S10_B27",
      "type": "mcq",
      "question": "Choose the best data description.",
      "context": "Data: The score changed from 81 to 83.",
      "choices": [
        "The score increased slightly.",
        "The score increased dramatically.",
        "The score decreased sharply.",
        "The score remained exactly the same."
      ],
      "answer": 0,
      "feedback": "The correct option describes the data accurately without overclaiming.",
      "quality": "data_6",
      "skillTag": "Data Description",
      "stemGroup": "Choose the best data description."
    },
    {
      "id": "S10_B28",
      "type": "mcq",
      "question": "Choose the best data description.",
      "context": "Data: The percentage fell from 70% to 52% after the training.",
      "choices": [
        "The percentage decreased after the training.",
        "The percentage increased after the training.",
        "The percentage stayed the same after the training.",
        "The data show no pattern after the training."
      ],
      "answer": 0,
      "feedback": "The correct option describes the data accurately without overclaiming.",
      "quality": "data_7",
      "skillTag": "Data Description",
      "stemGroup": "Choose the best data description."
    },
    {
      "id": "S10_B29",
      "type": "mcq",
      "question": "Choose the best data description.",
      "context": "Data: Class A had 35 participants and Class B had 35 participants.",
      "choices": [
        "Both classes had the same number of participants.",
        "Class A had more participants than Class B.",
        "Class B had more participants than Class A.",
        "The participant numbers were not reported."
      ],
      "answer": 0,
      "feedback": "The correct option describes the data accurately without overclaiming.",
      "quality": "data_8",
      "skillTag": "Data Description",
      "stemGroup": "Choose the best data description."
    },
    {
      "id": "S10_B30",
      "type": "mcq",
      "question": "Choose the best data description.",
      "context": "Data: Engagement rose from 40% to 65% after game-based learning was introduced.",
      "choices": [
        "Engagement increased after game-based learning was introduced.",
        "Engagement decreased after game-based learning was introduced.",
        "Engagement remained stable throughout the study.",
        "Engagement was not related to the learning activity."
      ],
      "answer": 0,
      "feedback": "The correct option describes the data accurately without overclaiming.",
      "quality": "data_9",
      "skillTag": "Data Description",
      "stemGroup": "Choose the best data description."
    },
    {
      "id": "S10_B31",
      "type": "mcq",
      "question": "Choose the best data description.",
      "context": "Data: AI tool use increased from 30% in 2023 to 55% in 2025.",
      "choices": [
        "AI tool use increased between 2023 and 2025.",
        "AI tool use remained exactly stable across the years.",
        "AI tool use decreased after 2023.",
        "AI tool use was higher in 2023 than in 2025."
      ],
      "answer": 0,
      "feedback": "The correct option describes the data accurately without overclaiming.",
      "quality": "data_0",
      "skillTag": "Data Description",
      "stemGroup": "Choose the best data description."
    },
    {
      "id": "S10_B32",
      "type": "mcq",
      "question": "Choose the best data description.",
      "context": "Data: Group A scored 78%, while Group B scored 62%.",
      "choices": [
        "Group A scored higher than Group B.",
        "Group B scored higher than Group A.",
        "Both groups received the same score.",
        "The scores cannot be compared at all."
      ],
      "answer": 0,
      "feedback": "The correct option describes the data accurately without overclaiming.",
      "quality": "data_1",
      "skillTag": "Data Description",
      "stemGroup": "Choose the best data description."
    },
    {
      "id": "S10_B33",
      "type": "mcq",
      "question": "Choose the best data description.",
      "context": "Data: The number of errors fell from 15 in Draft 1 to 6 in Draft 2.",
      "choices": [
        "The number of errors decreased between the two drafts.",
        "The number of errors increased in the second draft.",
        "The number of errors remained stable across drafts.",
        "The second draft had more errors than the first draft."
      ],
      "answer": 0,
      "feedback": "The correct option describes the data accurately without overclaiming.",
      "quality": "data_2",
      "skillTag": "Data Description",
      "stemGroup": "Choose the best data description."
    },
    {
      "id": "S10_B34",
      "type": "mcq",
      "question": "Choose the best data description.",
      "context": "Data: Student attendance was 80%, 81%, and 80% across three weeks.",
      "choices": [
        "Student attendance remained relatively stable.",
        "Student attendance increased dramatically each week.",
        "Student attendance decreased sharply across the period.",
        "Student attendance doubled after the first week."
      ],
      "answer": 0,
      "feedback": "The correct option describes the data accurately without overclaiming.",
      "quality": "data_3",
      "skillTag": "Data Description",
      "stemGroup": "Choose the best data description."
    },
    {
      "id": "S10_B35",
      "type": "mcq",
      "question": "Choose the best data description.",
      "context": "Data: Downloads rose from 100 in January to 180 in February.",
      "choices": [
        "The number of downloads increased significantly.",
        "The number of downloads declined after January.",
        "The number of downloads remained unchanged.",
        "The data show no change in user behavior."
      ],
      "answer": 0,
      "feedback": "The correct option describes the data accurately without overclaiming.",
      "quality": "data_4",
      "skillTag": "Data Description",
      "stemGroup": "Choose the best data description."
    },
    {
      "id": "S10_B36",
      "type": "mcq",
      "question": "Choose the best data description.",
      "context": "Data: Video preference was 45%, while quiz preference was 30%.",
      "choices": [
        "Videos were preferred by a higher percentage of students.",
        "Quizzes were preferred by a higher percentage of students.",
        "Both tools were preferred by the same percentage.",
        "The data prove that quizzes are ineffective."
      ],
      "answer": 0,
      "feedback": "The correct option describes the data accurately without overclaiming.",
      "quality": "data_5",
      "skillTag": "Data Description",
      "stemGroup": "Choose the best data description."
    },
    {
      "id": "S10_B37",
      "type": "mcq",
      "question": "Choose the best data description.",
      "context": "Data: The score changed from 81 to 83.",
      "choices": [
        "The score increased slightly.",
        "The score increased dramatically.",
        "The score decreased sharply.",
        "The score remained exactly the same."
      ],
      "answer": 0,
      "feedback": "The correct option describes the data accurately without overclaiming.",
      "quality": "data_6",
      "skillTag": "Data Description",
      "stemGroup": "Choose the best data description."
    },
    {
      "id": "S10_B38",
      "type": "mcq",
      "question": "Choose the best data description.",
      "context": "Data: The percentage fell from 70% to 52% after the training.",
      "choices": [
        "The percentage decreased after the training.",
        "The percentage increased after the training.",
        "The percentage stayed the same after the training.",
        "The data show no pattern after the training."
      ],
      "answer": 0,
      "feedback": "The correct option describes the data accurately without overclaiming.",
      "quality": "data_7",
      "skillTag": "Data Description",
      "stemGroup": "Choose the best data description."
    },
    {
      "id": "S10_B39",
      "type": "mcq",
      "question": "Choose the best data description.",
      "context": "Data: Class A had 35 participants and Class B had 35 participants.",
      "choices": [
        "Both classes had the same number of participants.",
        "Class A had more participants than Class B.",
        "Class B had more participants than Class A.",
        "The participant numbers were not reported."
      ],
      "answer": 0,
      "feedback": "The correct option describes the data accurately without overclaiming.",
      "quality": "data_8",
      "skillTag": "Data Description",
      "stemGroup": "Choose the best data description."
    },
    {
      "id": "S10_B40",
      "type": "mcq",
      "question": "Choose the best data description.",
      "context": "Data: Engagement rose from 40% to 65% after game-based learning was introduced.",
      "choices": [
        "Engagement increased after game-based learning was introduced.",
        "Engagement decreased after game-based learning was introduced.",
        "Engagement remained stable throughout the study.",
        "Engagement was not related to the learning activity."
      ],
      "answer": 0,
      "feedback": "The correct option describes the data accurately without overclaiming.",
      "quality": "data_9",
      "skillTag": "Data Description",
      "stemGroup": "Choose the best data description."
    }
  ],
  "11": [
    {
      "id": "S11_B01",
      "type": "mcq",
      "question": "Choose the best subject line.",
      "context": "Situation: You need to request feedback on a draft report.",
      "choices": [
        "Request for Feedback on Draft Report",
        "Important question about the class",
        "Please help me with something",
        "I need information from you"
      ],
      "answer": 0,
      "feedback": "A strong subject line is specific and formal.",
      "quality": "email_subj_0",
      "skillTag": "Academic Email",
      "stemGroup": "Choose the best subject line."
    },
    {
      "id": "S11_B02",
      "type": "mcq",
      "question": "Choose the best purpose sentence.",
      "context": "Situation: You need to ask for an appointment during office hours.",
      "choices": [
        "I would like to request an appointment during your office hours.",
        "I have something that I need you to answer.",
        "Please tell me what I should do about this issue.",
        "I need help because this class task is confusing."
      ],
      "answer": 0,
      "feedback": "A purpose sentence should be polite and clear.",
      "quality": "email_purpose_1",
      "skillTag": "Academic Email",
      "stemGroup": "Choose the best purpose sentence."
    },
    {
      "id": "S11_B03",
      "type": "mcq",
      "question": "Choose the most appropriate closing for an academic email.",
      "context": "",
      "choices": [
        "Thank you for your time and consideration.",
        "Please answer this message as soon as possible.",
        "That is all I need to say about this issue.",
        "I hope you understand my situation quickly."
      ],
      "answer": 0,
      "feedback": "This closing is polite and appropriate for academic communication.",
      "quality": "email_close_2",
      "skillTag": "Academic Email",
      "stemGroup": "Choose the most appropriate closing for an academi"
    },
    {
      "id": "S11_B04",
      "type": "mcq",
      "question": "Choose the best subject line.",
      "context": "Situation: You need to submit a revised assignment.",
      "choices": [
        "Submission of Revised Assignment",
        "Important question about the class",
        "Please help me with something",
        "I need information from you"
      ],
      "answer": 0,
      "feedback": "A strong subject line is specific and formal.",
      "quality": "email_subj_3",
      "skillTag": "Academic Email",
      "stemGroup": "Choose the best subject line."
    },
    {
      "id": "S11_B05",
      "type": "mcq",
      "question": "Choose the best purpose sentence.",
      "context": "Situation: You need to request an assignment extension.",
      "choices": [
        "I am writing to request an extension for the assignment.",
        "I have something that I need you to answer.",
        "Please tell me what I should do about this issue.",
        "I need help because this class task is confusing."
      ],
      "answer": 0,
      "feedback": "A purpose sentence should be polite and clear.",
      "quality": "email_purpose_4",
      "skillTag": "Academic Email",
      "stemGroup": "Choose the best purpose sentence."
    },
    {
      "id": "S11_B06",
      "type": "mcq",
      "question": "Choose the most appropriate closing for an academic email.",
      "context": "",
      "choices": [
        "Thank you for your time and consideration.",
        "Please answer this message as soon as possible.",
        "That is all I need to say about this issue.",
        "I hope you understand my situation quickly."
      ],
      "answer": 0,
      "feedback": "This closing is polite and appropriate for academic communication.",
      "quality": "email_close_5",
      "skillTag": "Academic Email",
      "stemGroup": "Choose the most appropriate closing for an academi"
    },
    {
      "id": "S11_B07",
      "type": "mcq",
      "question": "Choose the best subject line.",
      "context": "Situation: You need to apologize for late submission.",
      "choices": [
        "Apology for Late Submission",
        "Important question about the class",
        "Please help me with something",
        "I need information from you"
      ],
      "answer": 0,
      "feedback": "A strong subject line is specific and formal.",
      "quality": "email_subj_6",
      "skillTag": "Academic Email",
      "stemGroup": "Choose the best subject line."
    },
    {
      "id": "S11_B08",
      "type": "mcq",
      "question": "Choose the best purpose sentence.",
      "context": "Situation: You need to ask about a group project meeting.",
      "choices": [
        "I am writing to ask about the schedule for the group project meeting.",
        "I have something that I need you to answer.",
        "Please tell me what I should do about this issue.",
        "I need help because this class task is confusing."
      ],
      "answer": 0,
      "feedback": "A purpose sentence should be polite and clear.",
      "quality": "email_purpose_7",
      "skillTag": "Academic Email",
      "stemGroup": "Choose the best purpose sentence."
    },
    {
      "id": "S11_B09",
      "type": "mcq",
      "question": "Choose the most appropriate closing for an academic email.",
      "context": "",
      "choices": [
        "Thank you for your time and consideration.",
        "Please answer this message as soon as possible.",
        "That is all I need to say about this issue.",
        "I hope you understand my situation quickly."
      ],
      "answer": 0,
      "feedback": "This closing is polite and appropriate for academic communication.",
      "quality": "email_close_8",
      "skillTag": "Academic Email",
      "stemGroup": "Choose the most appropriate closing for an academi"
    },
    {
      "id": "S11_B10",
      "type": "mcq",
      "question": "Choose the best subject line.",
      "context": "Situation: You need to ask for score clarification.",
      "choices": [
        "Request for Score Clarification",
        "Important question about the class",
        "Please help me with something",
        "I need information from you"
      ],
      "answer": 0,
      "feedback": "A strong subject line is specific and formal.",
      "quality": "email_subj_9",
      "skillTag": "Academic Email",
      "stemGroup": "Choose the best subject line."
    },
    {
      "id": "S11_B11",
      "type": "mcq",
      "question": "Choose the best purpose sentence.",
      "context": "Situation: You need to request feedback on a draft report.",
      "choices": [
        "I am writing to request feedback on my draft report.",
        "I have something that I need you to answer.",
        "Please tell me what I should do about this issue.",
        "I need help because this class task is confusing."
      ],
      "answer": 0,
      "feedback": "A purpose sentence should be polite and clear.",
      "quality": "email_purpose_0",
      "skillTag": "Academic Email",
      "stemGroup": "Choose the best purpose sentence."
    },
    {
      "id": "S11_B12",
      "type": "mcq",
      "question": "Choose the most appropriate closing for an academic email.",
      "context": "",
      "choices": [
        "Thank you for your time and consideration.",
        "Please answer this message as soon as possible.",
        "That is all I need to say about this issue.",
        "I hope you understand my situation quickly."
      ],
      "answer": 0,
      "feedback": "This closing is polite and appropriate for academic communication.",
      "quality": "email_close_1",
      "skillTag": "Academic Email",
      "stemGroup": "Choose the most appropriate closing for an academi"
    },
    {
      "id": "S11_B13",
      "type": "mcq",
      "question": "Choose the best subject line.",
      "context": "Situation: You need to ask about presentation requirements.",
      "choices": [
        "Question about Final Presentation Requirements",
        "Important question about the class",
        "Please help me with something",
        "I need information from you"
      ],
      "answer": 0,
      "feedback": "A strong subject line is specific and formal.",
      "quality": "email_subj_2",
      "skillTag": "Academic Email",
      "stemGroup": "Choose the best subject line."
    },
    {
      "id": "S11_B14",
      "type": "mcq",
      "question": "Choose the best purpose sentence.",
      "context": "Situation: You need to submit a revised assignment.",
      "choices": [
        "I have attached my revised assignment for your review.",
        "I have something that I need you to answer.",
        "Please tell me what I should do about this issue.",
        "I need help because this class task is confusing."
      ],
      "answer": 0,
      "feedback": "A purpose sentence should be polite and clear.",
      "quality": "email_purpose_3",
      "skillTag": "Academic Email",
      "stemGroup": "Choose the best purpose sentence."
    },
    {
      "id": "S11_B15",
      "type": "mcq",
      "question": "Choose the most appropriate closing for an academic email.",
      "context": "",
      "choices": [
        "Thank you for your time and consideration.",
        "Please answer this message as soon as possible.",
        "That is all I need to say about this issue.",
        "I hope you understand my situation quickly."
      ],
      "answer": 0,
      "feedback": "This closing is polite and appropriate for academic communication.",
      "quality": "email_close_4",
      "skillTag": "Academic Email",
      "stemGroup": "Choose the most appropriate closing for an academi"
    },
    {
      "id": "S11_B16",
      "type": "mcq",
      "question": "Choose the best subject line.",
      "context": "Situation: You need to ask about citation format.",
      "choices": [
        "Question about Citation Format",
        "Important question about the class",
        "Please help me with something",
        "I need information from you"
      ],
      "answer": 0,
      "feedback": "A strong subject line is specific and formal.",
      "quality": "email_subj_5",
      "skillTag": "Academic Email",
      "stemGroup": "Choose the best subject line."
    },
    {
      "id": "S11_B17",
      "type": "mcq",
      "question": "Choose the best purpose sentence.",
      "context": "Situation: You need to apologize for late submission.",
      "choices": [
        "I apologize for submitting the assignment late.",
        "I have something that I need you to answer.",
        "Please tell me what I should do about this issue.",
        "I need help because this class task is confusing."
      ],
      "answer": 0,
      "feedback": "A purpose sentence should be polite and clear.",
      "quality": "email_purpose_6",
      "skillTag": "Academic Email",
      "stemGroup": "Choose the best purpose sentence."
    },
    {
      "id": "S11_B18",
      "type": "mcq",
      "question": "Choose the most appropriate closing for an academic email.",
      "context": "",
      "choices": [
        "Thank you for your time and consideration.",
        "Please answer this message as soon as possible.",
        "That is all I need to say about this issue.",
        "I hope you understand my situation quickly."
      ],
      "answer": 0,
      "feedback": "This closing is polite and appropriate for academic communication.",
      "quality": "email_close_7",
      "skillTag": "Academic Email",
      "stemGroup": "Choose the most appropriate closing for an academi"
    },
    {
      "id": "S11_B19",
      "type": "mcq",
      "question": "Choose the best subject line.",
      "context": "Situation: You need to send presentation slides.",
      "choices": [
        "Submission of Presentation Slides",
        "Important question about the class",
        "Please help me with something",
        "I need information from you"
      ],
      "answer": 0,
      "feedback": "A strong subject line is specific and formal.",
      "quality": "email_subj_8",
      "skillTag": "Academic Email",
      "stemGroup": "Choose the best subject line."
    },
    {
      "id": "S11_B20",
      "type": "mcq",
      "question": "Choose the best purpose sentence.",
      "context": "Situation: You need to ask for score clarification.",
      "choices": [
        "I would like to ask for clarification regarding my assignment score.",
        "I have something that I need you to answer.",
        "Please tell me what I should do about this issue.",
        "I need help because this class task is confusing."
      ],
      "answer": 0,
      "feedback": "A purpose sentence should be polite and clear.",
      "quality": "email_purpose_9",
      "skillTag": "Academic Email",
      "stemGroup": "Choose the best purpose sentence."
    },
    {
      "id": "S11_B21",
      "type": "mcq",
      "question": "Choose the most appropriate closing for an academic email.",
      "context": "",
      "choices": [
        "Thank you for your time and consideration.",
        "Please answer this message as soon as possible.",
        "That is all I need to say about this issue.",
        "I hope you understand my situation quickly."
      ],
      "answer": 0,
      "feedback": "This closing is polite and appropriate for academic communication.",
      "quality": "email_close_0",
      "skillTag": "Academic Email",
      "stemGroup": "Choose the most appropriate closing for an academi"
    },
    {
      "id": "S11_B22",
      "type": "mcq",
      "question": "Choose the best subject line.",
      "context": "Situation: You need to ask for an appointment during office hours.",
      "choices": [
        "Request for Appointment During Office Hours",
        "Important question about the class",
        "Please help me with something",
        "I need information from you"
      ],
      "answer": 0,
      "feedback": "A strong subject line is specific and formal.",
      "quality": "email_subj_1",
      "skillTag": "Academic Email",
      "stemGroup": "Choose the best subject line."
    },
    {
      "id": "S11_B23",
      "type": "mcq",
      "question": "Choose the best purpose sentence.",
      "context": "Situation: You need to ask about presentation requirements.",
      "choices": [
        "I am writing to ask for clarification about the final presentation requirements.",
        "I have something that I need you to answer.",
        "Please tell me what I should do about this issue.",
        "I need help because this class task is confusing."
      ],
      "answer": 0,
      "feedback": "A purpose sentence should be polite and clear.",
      "quality": "email_purpose_2",
      "skillTag": "Academic Email",
      "stemGroup": "Choose the best purpose sentence."
    },
    {
      "id": "S11_B24",
      "type": "mcq",
      "question": "Choose the most appropriate closing for an academic email.",
      "context": "",
      "choices": [
        "Thank you for your time and consideration.",
        "Please answer this message as soon as possible.",
        "That is all I need to say about this issue.",
        "I hope you understand my situation quickly."
      ],
      "answer": 0,
      "feedback": "This closing is polite and appropriate for academic communication.",
      "quality": "email_close_3",
      "skillTag": "Academic Email",
      "stemGroup": "Choose the most appropriate closing for an academi"
    },
    {
      "id": "S11_B25",
      "type": "mcq",
      "question": "Choose the best subject line.",
      "context": "Situation: You need to request an assignment extension.",
      "choices": [
        "Request for Assignment Extension",
        "Important question about the class",
        "Please help me with something",
        "I need information from you"
      ],
      "answer": 0,
      "feedback": "A strong subject line is specific and formal.",
      "quality": "email_subj_4",
      "skillTag": "Academic Email",
      "stemGroup": "Choose the best subject line."
    },
    {
      "id": "S11_B26",
      "type": "mcq",
      "question": "Choose the best purpose sentence.",
      "context": "Situation: You need to ask about citation format.",
      "choices": [
        "I would like to ask which citation format should be used.",
        "I have something that I need you to answer.",
        "Please tell me what I should do about this issue.",
        "I need help because this class task is confusing."
      ],
      "answer": 0,
      "feedback": "A purpose sentence should be polite and clear.",
      "quality": "email_purpose_5",
      "skillTag": "Academic Email",
      "stemGroup": "Choose the best purpose sentence."
    },
    {
      "id": "S11_B27",
      "type": "mcq",
      "question": "Choose the most appropriate closing for an academic email.",
      "context": "",
      "choices": [
        "Thank you for your time and consideration.",
        "Please answer this message as soon as possible.",
        "That is all I need to say about this issue.",
        "I hope you understand my situation quickly."
      ],
      "answer": 0,
      "feedback": "This closing is polite and appropriate for academic communication.",
      "quality": "email_close_6",
      "skillTag": "Academic Email",
      "stemGroup": "Choose the most appropriate closing for an academi"
    },
    {
      "id": "S11_B28",
      "type": "mcq",
      "question": "Choose the best subject line.",
      "context": "Situation: You need to ask about a group project meeting.",
      "choices": [
        "Question about Group Project Meeting",
        "Important question about the class",
        "Please help me with something",
        "I need information from you"
      ],
      "answer": 0,
      "feedback": "A strong subject line is specific and formal.",
      "quality": "email_subj_7",
      "skillTag": "Academic Email",
      "stemGroup": "Choose the best subject line."
    },
    {
      "id": "S11_B29",
      "type": "mcq",
      "question": "Choose the best purpose sentence.",
      "context": "Situation: You need to send presentation slides.",
      "choices": [
        "I have attached my presentation slides to this email.",
        "I have something that I need you to answer.",
        "Please tell me what I should do about this issue.",
        "I need help because this class task is confusing."
      ],
      "answer": 0,
      "feedback": "A purpose sentence should be polite and clear.",
      "quality": "email_purpose_8",
      "skillTag": "Academic Email",
      "stemGroup": "Choose the best purpose sentence."
    },
    {
      "id": "S11_B30",
      "type": "mcq",
      "question": "Choose the most appropriate closing for an academic email.",
      "context": "",
      "choices": [
        "Thank you for your time and consideration.",
        "Please answer this message as soon as possible.",
        "That is all I need to say about this issue.",
        "I hope you understand my situation quickly."
      ],
      "answer": 0,
      "feedback": "This closing is polite and appropriate for academic communication.",
      "quality": "email_close_9",
      "skillTag": "Academic Email",
      "stemGroup": "Choose the most appropriate closing for an academi"
    },
    {
      "id": "S11_B31",
      "type": "mcq",
      "question": "Choose the best subject line.",
      "context": "Situation: You need to request feedback on a draft report.",
      "choices": [
        "Request for Feedback on Draft Report",
        "Important question about the class",
        "Please help me with something",
        "I need information from you"
      ],
      "answer": 0,
      "feedback": "A strong subject line is specific and formal.",
      "quality": "email_subj_0",
      "skillTag": "Academic Email",
      "stemGroup": "Choose the best subject line."
    },
    {
      "id": "S11_B32",
      "type": "mcq",
      "question": "Choose the best purpose sentence.",
      "context": "Situation: You need to ask for an appointment during office hours.",
      "choices": [
        "I would like to request an appointment during your office hours.",
        "I have something that I need you to answer.",
        "Please tell me what I should do about this issue.",
        "I need help because this class task is confusing."
      ],
      "answer": 0,
      "feedback": "A purpose sentence should be polite and clear.",
      "quality": "email_purpose_1",
      "skillTag": "Academic Email",
      "stemGroup": "Choose the best purpose sentence."
    },
    {
      "id": "S11_B33",
      "type": "mcq",
      "question": "Choose the most appropriate closing for an academic email.",
      "context": "",
      "choices": [
        "Thank you for your time and consideration.",
        "Please answer this message as soon as possible.",
        "That is all I need to say about this issue.",
        "I hope you understand my situation quickly."
      ],
      "answer": 0,
      "feedback": "This closing is polite and appropriate for academic communication.",
      "quality": "email_close_2",
      "skillTag": "Academic Email",
      "stemGroup": "Choose the most appropriate closing for an academi"
    },
    {
      "id": "S11_B34",
      "type": "mcq",
      "question": "Choose the best subject line.",
      "context": "Situation: You need to submit a revised assignment.",
      "choices": [
        "Submission of Revised Assignment",
        "Important question about the class",
        "Please help me with something",
        "I need information from you"
      ],
      "answer": 0,
      "feedback": "A strong subject line is specific and formal.",
      "quality": "email_subj_3",
      "skillTag": "Academic Email",
      "stemGroup": "Choose the best subject line."
    },
    {
      "id": "S11_B35",
      "type": "mcq",
      "question": "Choose the best purpose sentence.",
      "context": "Situation: You need to request an assignment extension.",
      "choices": [
        "I am writing to request an extension for the assignment.",
        "I have something that I need you to answer.",
        "Please tell me what I should do about this issue.",
        "I need help because this class task is confusing."
      ],
      "answer": 0,
      "feedback": "A purpose sentence should be polite and clear.",
      "quality": "email_purpose_4",
      "skillTag": "Academic Email",
      "stemGroup": "Choose the best purpose sentence."
    },
    {
      "id": "S11_B36",
      "type": "mcq",
      "question": "Choose the most appropriate closing for an academic email.",
      "context": "",
      "choices": [
        "Thank you for your time and consideration.",
        "Please answer this message as soon as possible.",
        "That is all I need to say about this issue.",
        "I hope you understand my situation quickly."
      ],
      "answer": 0,
      "feedback": "This closing is polite and appropriate for academic communication.",
      "quality": "email_close_5",
      "skillTag": "Academic Email",
      "stemGroup": "Choose the most appropriate closing for an academi"
    },
    {
      "id": "S11_B37",
      "type": "mcq",
      "question": "Choose the best subject line.",
      "context": "Situation: You need to apologize for late submission.",
      "choices": [
        "Apology for Late Submission",
        "Important question about the class",
        "Please help me with something",
        "I need information from you"
      ],
      "answer": 0,
      "feedback": "A strong subject line is specific and formal.",
      "quality": "email_subj_6",
      "skillTag": "Academic Email",
      "stemGroup": "Choose the best subject line."
    },
    {
      "id": "S11_B38",
      "type": "mcq",
      "question": "Choose the best purpose sentence.",
      "context": "Situation: You need to ask about a group project meeting.",
      "choices": [
        "I am writing to ask about the schedule for the group project meeting.",
        "I have something that I need you to answer.",
        "Please tell me what I should do about this issue.",
        "I need help because this class task is confusing."
      ],
      "answer": 0,
      "feedback": "A purpose sentence should be polite and clear.",
      "quality": "email_purpose_7",
      "skillTag": "Academic Email",
      "stemGroup": "Choose the best purpose sentence."
    },
    {
      "id": "S11_B39",
      "type": "mcq",
      "question": "Choose the most appropriate closing for an academic email.",
      "context": "",
      "choices": [
        "Thank you for your time and consideration.",
        "Please answer this message as soon as possible.",
        "That is all I need to say about this issue.",
        "I hope you understand my situation quickly."
      ],
      "answer": 0,
      "feedback": "This closing is polite and appropriate for academic communication.",
      "quality": "email_close_8",
      "skillTag": "Academic Email",
      "stemGroup": "Choose the most appropriate closing for an academi"
    },
    {
      "id": "S11_B40",
      "type": "mcq",
      "question": "Choose the best subject line.",
      "context": "Situation: You need to ask for score clarification.",
      "choices": [
        "Request for Score Clarification",
        "Important question about the class",
        "Please help me with something",
        "I need information from you"
      ],
      "answer": 0,
      "feedback": "A strong subject line is specific and formal.",
      "quality": "email_subj_9",
      "skillTag": "Academic Email",
      "stemGroup": "Choose the best subject line."
    }
  ],
  "12": [
    {
      "id": "S12_B01",
      "type": "mcq",
      "question": "Choose the best ethical judgment.",
      "context": "Action: Copying a paragraph from a website without citation.",
      "choices": [
        "This is plagiarism because the source is not acknowledged.",
        "This is acceptable because academic tasks allow any source use.",
        "This is only a formatting issue and does not affect ethics.",
        "This is unrelated to academic integrity in university work."
      ],
      "answer": 0,
      "feedback": "The correct judgment identifies the academic ethics issue accurately.",
      "quality": "ethics_0",
      "skillTag": "Citation & Ethics",
      "stemGroup": "Choose the best ethical judgment."
    },
    {
      "id": "S12_B02",
      "type": "mcq",
      "question": "Choose the best ethical judgment.",
      "context": "Action: Paraphrasing a source idea and including a citation.",
      "choices": [
        "This is acceptable because the source receives credit.",
        "This is acceptable because academic tasks allow any source use.",
        "This is only a formatting issue and does not affect ethics.",
        "This is unrelated to academic integrity in university work."
      ],
      "answer": 0,
      "feedback": "The correct judgment identifies the academic ethics issue accurately.",
      "quality": "ethics_1",
      "skillTag": "Citation & Ethics",
      "stemGroup": "Choose the best ethical judgment."
    },
    {
      "id": "S12_B03",
      "type": "mcq",
      "question": "Choose the best ethical judgment.",
      "context": "Action: Changing only a few words from the original sentence.",
      "choices": [
        "This is patchwriting because the wording is too close.",
        "This is acceptable because academic tasks allow any source use.",
        "This is only a formatting issue and does not affect ethics.",
        "This is unrelated to academic integrity in university work."
      ],
      "answer": 0,
      "feedback": "The correct judgment identifies the academic ethics issue accurately.",
      "quality": "ethics_2",
      "skillTag": "Citation & Ethics",
      "stemGroup": "Choose the best ethical judgment."
    },
    {
      "id": "S12_B04",
      "type": "mcq",
      "question": "Choose the best ethical judgment.",
      "context": "Action: Using AI output without checking accuracy or declaring use when required.",
      "choices": [
        "This is risky because the work may be inaccurate or non-transparent.",
        "This is acceptable because academic tasks allow any source use.",
        "This is only a formatting issue and does not affect ethics.",
        "This is unrelated to academic integrity in university work."
      ],
      "answer": 0,
      "feedback": "The correct judgment identifies the academic ethics issue accurately.",
      "quality": "ethics_3",
      "skillTag": "Citation & Ethics",
      "stemGroup": "Choose the best ethical judgment."
    },
    {
      "id": "S12_B05",
      "type": "mcq",
      "question": "Choose the best ethical judgment.",
      "context": "Action: Inventing a reference that does not exist.",
      "choices": [
        "This is academic misconduct because the source is false.",
        "This is acceptable because academic tasks allow any source use.",
        "This is only a formatting issue and does not affect ethics.",
        "This is unrelated to academic integrity in university work."
      ],
      "answer": 0,
      "feedback": "The correct judgment identifies the academic ethics issue accurately.",
      "quality": "ethics_4",
      "skillTag": "Citation & Ethics",
      "stemGroup": "Choose the best ethical judgment."
    },
    {
      "id": "S12_B06",
      "type": "mcq",
      "question": "Choose the best ethical judgment.",
      "context": "Action: Quoting a sentence with quotation marks and citation.",
      "choices": [
        "This is acceptable quotation practice.",
        "This is acceptable because academic tasks allow any source use.",
        "This is only a formatting issue and does not affect ethics.",
        "This is unrelated to academic integrity in university work."
      ],
      "answer": 0,
      "feedback": "The correct judgment identifies the academic ethics issue accurately.",
      "quality": "ethics_5",
      "skillTag": "Citation & Ethics",
      "stemGroup": "Choose the best ethical judgment."
    },
    {
      "id": "S12_B07",
      "type": "mcq",
      "question": "Choose the best ethical judgment.",
      "context": "Action: Summarizing a source and citing it in the paragraph.",
      "choices": [
        "This is acceptable because the borrowed idea is credited.",
        "This is acceptable because academic tasks allow any source use.",
        "This is only a formatting issue and does not affect ethics.",
        "This is unrelated to academic integrity in university work."
      ],
      "answer": 0,
      "feedback": "The correct judgment identifies the academic ethics issue accurately.",
      "quality": "ethics_6",
      "skillTag": "Citation & Ethics",
      "stemGroup": "Choose the best ethical judgment."
    },
    {
      "id": "S12_B08",
      "type": "mcq",
      "question": "Choose the best ethical judgment.",
      "context": "Action: Using a source idea without naming the source.",
      "choices": [
        "This is plagiarism because the idea is not credited.",
        "This is acceptable because academic tasks allow any source use.",
        "This is only a formatting issue and does not affect ethics.",
        "This is unrelated to academic integrity in university work."
      ],
      "answer": 0,
      "feedback": "The correct judgment identifies the academic ethics issue accurately.",
      "quality": "ethics_7",
      "skillTag": "Citation & Ethics",
      "stemGroup": "Choose the best ethical judgment."
    },
    {
      "id": "S12_B09",
      "type": "mcq",
      "question": "Choose the best ethical judgment.",
      "context": "Action: Checking AI information against credible sources before using it.",
      "choices": [
        "This is responsible AI use.",
        "This is acceptable because academic tasks allow any source use.",
        "This is only a formatting issue and does not affect ethics.",
        "This is unrelated to academic integrity in university work."
      ],
      "answer": 0,
      "feedback": "The correct judgment identifies the academic ethics issue accurately.",
      "quality": "ethics_8",
      "skillTag": "Citation & Ethics",
      "stemGroup": "Choose the best ethical judgment."
    },
    {
      "id": "S12_B10",
      "type": "mcq",
      "question": "Choose the best ethical judgment.",
      "context": "Action: Citing a source that does not support the claim.",
      "choices": [
        "This is incorrect source use.",
        "This is acceptable because academic tasks allow any source use.",
        "This is only a formatting issue and does not affect ethics.",
        "This is unrelated to academic integrity in university work."
      ],
      "answer": 0,
      "feedback": "The correct judgment identifies the academic ethics issue accurately.",
      "quality": "ethics_9",
      "skillTag": "Citation & Ethics",
      "stemGroup": "Choose the best ethical judgment."
    },
    {
      "id": "S12_B11",
      "type": "mcq",
      "question": "Choose the best ethical judgment.",
      "context": "Action: Copying a paragraph from a website without citation.",
      "choices": [
        "This is plagiarism because the source is not acknowledged.",
        "This is acceptable because academic tasks allow any source use.",
        "This is only a formatting issue and does not affect ethics.",
        "This is unrelated to academic integrity in university work."
      ],
      "answer": 0,
      "feedback": "The correct judgment identifies the academic ethics issue accurately.",
      "quality": "ethics_0",
      "skillTag": "Citation & Ethics",
      "stemGroup": "Choose the best ethical judgment."
    },
    {
      "id": "S12_B12",
      "type": "mcq",
      "question": "Choose the best ethical judgment.",
      "context": "Action: Paraphrasing a source idea and including a citation.",
      "choices": [
        "This is acceptable because the source receives credit.",
        "This is acceptable because academic tasks allow any source use.",
        "This is only a formatting issue and does not affect ethics.",
        "This is unrelated to academic integrity in university work."
      ],
      "answer": 0,
      "feedback": "The correct judgment identifies the academic ethics issue accurately.",
      "quality": "ethics_1",
      "skillTag": "Citation & Ethics",
      "stemGroup": "Choose the best ethical judgment."
    },
    {
      "id": "S12_B13",
      "type": "mcq",
      "question": "Choose the best ethical judgment.",
      "context": "Action: Changing only a few words from the original sentence.",
      "choices": [
        "This is patchwriting because the wording is too close.",
        "This is acceptable because academic tasks allow any source use.",
        "This is only a formatting issue and does not affect ethics.",
        "This is unrelated to academic integrity in university work."
      ],
      "answer": 0,
      "feedback": "The correct judgment identifies the academic ethics issue accurately.",
      "quality": "ethics_2",
      "skillTag": "Citation & Ethics",
      "stemGroup": "Choose the best ethical judgment."
    },
    {
      "id": "S12_B14",
      "type": "mcq",
      "question": "Choose the best ethical judgment.",
      "context": "Action: Using AI output without checking accuracy or declaring use when required.",
      "choices": [
        "This is risky because the work may be inaccurate or non-transparent.",
        "This is acceptable because academic tasks allow any source use.",
        "This is only a formatting issue and does not affect ethics.",
        "This is unrelated to academic integrity in university work."
      ],
      "answer": 0,
      "feedback": "The correct judgment identifies the academic ethics issue accurately.",
      "quality": "ethics_3",
      "skillTag": "Citation & Ethics",
      "stemGroup": "Choose the best ethical judgment."
    },
    {
      "id": "S12_B15",
      "type": "mcq",
      "question": "Choose the best ethical judgment.",
      "context": "Action: Inventing a reference that does not exist.",
      "choices": [
        "This is academic misconduct because the source is false.",
        "This is acceptable because academic tasks allow any source use.",
        "This is only a formatting issue and does not affect ethics.",
        "This is unrelated to academic integrity in university work."
      ],
      "answer": 0,
      "feedback": "The correct judgment identifies the academic ethics issue accurately.",
      "quality": "ethics_4",
      "skillTag": "Citation & Ethics",
      "stemGroup": "Choose the best ethical judgment."
    },
    {
      "id": "S12_B16",
      "type": "mcq",
      "question": "Choose the best ethical judgment.",
      "context": "Action: Quoting a sentence with quotation marks and citation.",
      "choices": [
        "This is acceptable quotation practice.",
        "This is acceptable because academic tasks allow any source use.",
        "This is only a formatting issue and does not affect ethics.",
        "This is unrelated to academic integrity in university work."
      ],
      "answer": 0,
      "feedback": "The correct judgment identifies the academic ethics issue accurately.",
      "quality": "ethics_5",
      "skillTag": "Citation & Ethics",
      "stemGroup": "Choose the best ethical judgment."
    },
    {
      "id": "S12_B17",
      "type": "mcq",
      "question": "Choose the best ethical judgment.",
      "context": "Action: Summarizing a source and citing it in the paragraph.",
      "choices": [
        "This is acceptable because the borrowed idea is credited.",
        "This is acceptable because academic tasks allow any source use.",
        "This is only a formatting issue and does not affect ethics.",
        "This is unrelated to academic integrity in university work."
      ],
      "answer": 0,
      "feedback": "The correct judgment identifies the academic ethics issue accurately.",
      "quality": "ethics_6",
      "skillTag": "Citation & Ethics",
      "stemGroup": "Choose the best ethical judgment."
    },
    {
      "id": "S12_B18",
      "type": "mcq",
      "question": "Choose the best ethical judgment.",
      "context": "Action: Using a source idea without naming the source.",
      "choices": [
        "This is plagiarism because the idea is not credited.",
        "This is acceptable because academic tasks allow any source use.",
        "This is only a formatting issue and does not affect ethics.",
        "This is unrelated to academic integrity in university work."
      ],
      "answer": 0,
      "feedback": "The correct judgment identifies the academic ethics issue accurately.",
      "quality": "ethics_7",
      "skillTag": "Citation & Ethics",
      "stemGroup": "Choose the best ethical judgment."
    },
    {
      "id": "S12_B19",
      "type": "mcq",
      "question": "Choose the best ethical judgment.",
      "context": "Action: Checking AI information against credible sources before using it.",
      "choices": [
        "This is responsible AI use.",
        "This is acceptable because academic tasks allow any source use.",
        "This is only a formatting issue and does not affect ethics.",
        "This is unrelated to academic integrity in university work."
      ],
      "answer": 0,
      "feedback": "The correct judgment identifies the academic ethics issue accurately.",
      "quality": "ethics_8",
      "skillTag": "Citation & Ethics",
      "stemGroup": "Choose the best ethical judgment."
    },
    {
      "id": "S12_B20",
      "type": "mcq",
      "question": "Choose the best ethical judgment.",
      "context": "Action: Citing a source that does not support the claim.",
      "choices": [
        "This is incorrect source use.",
        "This is acceptable because academic tasks allow any source use.",
        "This is only a formatting issue and does not affect ethics.",
        "This is unrelated to academic integrity in university work."
      ],
      "answer": 0,
      "feedback": "The correct judgment identifies the academic ethics issue accurately.",
      "quality": "ethics_9",
      "skillTag": "Citation & Ethics",
      "stemGroup": "Choose the best ethical judgment."
    },
    {
      "id": "S12_B21",
      "type": "mcq",
      "question": "Choose the best ethical judgment.",
      "context": "Action: Copying a paragraph from a website without citation.",
      "choices": [
        "This is plagiarism because the source is not acknowledged.",
        "This is acceptable because academic tasks allow any source use.",
        "This is only a formatting issue and does not affect ethics.",
        "This is unrelated to academic integrity in university work."
      ],
      "answer": 0,
      "feedback": "The correct judgment identifies the academic ethics issue accurately.",
      "quality": "ethics_0",
      "skillTag": "Citation & Ethics",
      "stemGroup": "Choose the best ethical judgment."
    },
    {
      "id": "S12_B22",
      "type": "mcq",
      "question": "Choose the best ethical judgment.",
      "context": "Action: Paraphrasing a source idea and including a citation.",
      "choices": [
        "This is acceptable because the source receives credit.",
        "This is acceptable because academic tasks allow any source use.",
        "This is only a formatting issue and does not affect ethics.",
        "This is unrelated to academic integrity in university work."
      ],
      "answer": 0,
      "feedback": "The correct judgment identifies the academic ethics issue accurately.",
      "quality": "ethics_1",
      "skillTag": "Citation & Ethics",
      "stemGroup": "Choose the best ethical judgment."
    },
    {
      "id": "S12_B23",
      "type": "mcq",
      "question": "Choose the best ethical judgment.",
      "context": "Action: Changing only a few words from the original sentence.",
      "choices": [
        "This is patchwriting because the wording is too close.",
        "This is acceptable because academic tasks allow any source use.",
        "This is only a formatting issue and does not affect ethics.",
        "This is unrelated to academic integrity in university work."
      ],
      "answer": 0,
      "feedback": "The correct judgment identifies the academic ethics issue accurately.",
      "quality": "ethics_2",
      "skillTag": "Citation & Ethics",
      "stemGroup": "Choose the best ethical judgment."
    },
    {
      "id": "S12_B24",
      "type": "mcq",
      "question": "Choose the best ethical judgment.",
      "context": "Action: Using AI output without checking accuracy or declaring use when required.",
      "choices": [
        "This is risky because the work may be inaccurate or non-transparent.",
        "This is acceptable because academic tasks allow any source use.",
        "This is only a formatting issue and does not affect ethics.",
        "This is unrelated to academic integrity in university work."
      ],
      "answer": 0,
      "feedback": "The correct judgment identifies the academic ethics issue accurately.",
      "quality": "ethics_3",
      "skillTag": "Citation & Ethics",
      "stemGroup": "Choose the best ethical judgment."
    },
    {
      "id": "S12_B25",
      "type": "mcq",
      "question": "Choose the best ethical judgment.",
      "context": "Action: Inventing a reference that does not exist.",
      "choices": [
        "This is academic misconduct because the source is false.",
        "This is acceptable because academic tasks allow any source use.",
        "This is only a formatting issue and does not affect ethics.",
        "This is unrelated to academic integrity in university work."
      ],
      "answer": 0,
      "feedback": "The correct judgment identifies the academic ethics issue accurately.",
      "quality": "ethics_4",
      "skillTag": "Citation & Ethics",
      "stemGroup": "Choose the best ethical judgment."
    },
    {
      "id": "S12_B26",
      "type": "mcq",
      "question": "Choose the best ethical judgment.",
      "context": "Action: Quoting a sentence with quotation marks and citation.",
      "choices": [
        "This is acceptable quotation practice.",
        "This is acceptable because academic tasks allow any source use.",
        "This is only a formatting issue and does not affect ethics.",
        "This is unrelated to academic integrity in university work."
      ],
      "answer": 0,
      "feedback": "The correct judgment identifies the academic ethics issue accurately.",
      "quality": "ethics_5",
      "skillTag": "Citation & Ethics",
      "stemGroup": "Choose the best ethical judgment."
    },
    {
      "id": "S12_B27",
      "type": "mcq",
      "question": "Choose the best ethical judgment.",
      "context": "Action: Summarizing a source and citing it in the paragraph.",
      "choices": [
        "This is acceptable because the borrowed idea is credited.",
        "This is acceptable because academic tasks allow any source use.",
        "This is only a formatting issue and does not affect ethics.",
        "This is unrelated to academic integrity in university work."
      ],
      "answer": 0,
      "feedback": "The correct judgment identifies the academic ethics issue accurately.",
      "quality": "ethics_6",
      "skillTag": "Citation & Ethics",
      "stemGroup": "Choose the best ethical judgment."
    },
    {
      "id": "S12_B28",
      "type": "mcq",
      "question": "Choose the best ethical judgment.",
      "context": "Action: Using a source idea without naming the source.",
      "choices": [
        "This is plagiarism because the idea is not credited.",
        "This is acceptable because academic tasks allow any source use.",
        "This is only a formatting issue and does not affect ethics.",
        "This is unrelated to academic integrity in university work."
      ],
      "answer": 0,
      "feedback": "The correct judgment identifies the academic ethics issue accurately.",
      "quality": "ethics_7",
      "skillTag": "Citation & Ethics",
      "stemGroup": "Choose the best ethical judgment."
    },
    {
      "id": "S12_B29",
      "type": "mcq",
      "question": "Choose the best ethical judgment.",
      "context": "Action: Checking AI information against credible sources before using it.",
      "choices": [
        "This is responsible AI use.",
        "This is acceptable because academic tasks allow any source use.",
        "This is only a formatting issue and does not affect ethics.",
        "This is unrelated to academic integrity in university work."
      ],
      "answer": 0,
      "feedback": "The correct judgment identifies the academic ethics issue accurately.",
      "quality": "ethics_8",
      "skillTag": "Citation & Ethics",
      "stemGroup": "Choose the best ethical judgment."
    },
    {
      "id": "S12_B30",
      "type": "mcq",
      "question": "Choose the best ethical judgment.",
      "context": "Action: Citing a source that does not support the claim.",
      "choices": [
        "This is incorrect source use.",
        "This is acceptable because academic tasks allow any source use.",
        "This is only a formatting issue and does not affect ethics.",
        "This is unrelated to academic integrity in university work."
      ],
      "answer": 0,
      "feedback": "The correct judgment identifies the academic ethics issue accurately.",
      "quality": "ethics_9",
      "skillTag": "Citation & Ethics",
      "stemGroup": "Choose the best ethical judgment."
    },
    {
      "id": "S12_B31",
      "type": "mcq",
      "question": "Choose the best ethical judgment.",
      "context": "Action: Copying a paragraph from a website without citation.",
      "choices": [
        "This is plagiarism because the source is not acknowledged.",
        "This is acceptable because academic tasks allow any source use.",
        "This is only a formatting issue and does not affect ethics.",
        "This is unrelated to academic integrity in university work."
      ],
      "answer": 0,
      "feedback": "The correct judgment identifies the academic ethics issue accurately.",
      "quality": "ethics_0",
      "skillTag": "Citation & Ethics",
      "stemGroup": "Choose the best ethical judgment."
    },
    {
      "id": "S12_B32",
      "type": "mcq",
      "question": "Choose the best ethical judgment.",
      "context": "Action: Paraphrasing a source idea and including a citation.",
      "choices": [
        "This is acceptable because the source receives credit.",
        "This is acceptable because academic tasks allow any source use.",
        "This is only a formatting issue and does not affect ethics.",
        "This is unrelated to academic integrity in university work."
      ],
      "answer": 0,
      "feedback": "The correct judgment identifies the academic ethics issue accurately.",
      "quality": "ethics_1",
      "skillTag": "Citation & Ethics",
      "stemGroup": "Choose the best ethical judgment."
    },
    {
      "id": "S12_B33",
      "type": "mcq",
      "question": "Choose the best ethical judgment.",
      "context": "Action: Changing only a few words from the original sentence.",
      "choices": [
        "This is patchwriting because the wording is too close.",
        "This is acceptable because academic tasks allow any source use.",
        "This is only a formatting issue and does not affect ethics.",
        "This is unrelated to academic integrity in university work."
      ],
      "answer": 0,
      "feedback": "The correct judgment identifies the academic ethics issue accurately.",
      "quality": "ethics_2",
      "skillTag": "Citation & Ethics",
      "stemGroup": "Choose the best ethical judgment."
    },
    {
      "id": "S12_B34",
      "type": "mcq",
      "question": "Choose the best ethical judgment.",
      "context": "Action: Using AI output without checking accuracy or declaring use when required.",
      "choices": [
        "This is risky because the work may be inaccurate or non-transparent.",
        "This is acceptable because academic tasks allow any source use.",
        "This is only a formatting issue and does not affect ethics.",
        "This is unrelated to academic integrity in university work."
      ],
      "answer": 0,
      "feedback": "The correct judgment identifies the academic ethics issue accurately.",
      "quality": "ethics_3",
      "skillTag": "Citation & Ethics",
      "stemGroup": "Choose the best ethical judgment."
    },
    {
      "id": "S12_B35",
      "type": "mcq",
      "question": "Choose the best ethical judgment.",
      "context": "Action: Inventing a reference that does not exist.",
      "choices": [
        "This is academic misconduct because the source is false.",
        "This is acceptable because academic tasks allow any source use.",
        "This is only a formatting issue and does not affect ethics.",
        "This is unrelated to academic integrity in university work."
      ],
      "answer": 0,
      "feedback": "The correct judgment identifies the academic ethics issue accurately.",
      "quality": "ethics_4",
      "skillTag": "Citation & Ethics",
      "stemGroup": "Choose the best ethical judgment."
    },
    {
      "id": "S12_B36",
      "type": "mcq",
      "question": "Choose the best ethical judgment.",
      "context": "Action: Quoting a sentence with quotation marks and citation.",
      "choices": [
        "This is acceptable quotation practice.",
        "This is acceptable because academic tasks allow any source use.",
        "This is only a formatting issue and does not affect ethics.",
        "This is unrelated to academic integrity in university work."
      ],
      "answer": 0,
      "feedback": "The correct judgment identifies the academic ethics issue accurately.",
      "quality": "ethics_5",
      "skillTag": "Citation & Ethics",
      "stemGroup": "Choose the best ethical judgment."
    },
    {
      "id": "S12_B37",
      "type": "mcq",
      "question": "Choose the best ethical judgment.",
      "context": "Action: Summarizing a source and citing it in the paragraph.",
      "choices": [
        "This is acceptable because the borrowed idea is credited.",
        "This is acceptable because academic tasks allow any source use.",
        "This is only a formatting issue and does not affect ethics.",
        "This is unrelated to academic integrity in university work."
      ],
      "answer": 0,
      "feedback": "The correct judgment identifies the academic ethics issue accurately.",
      "quality": "ethics_6",
      "skillTag": "Citation & Ethics",
      "stemGroup": "Choose the best ethical judgment."
    },
    {
      "id": "S12_B38",
      "type": "mcq",
      "question": "Choose the best ethical judgment.",
      "context": "Action: Using a source idea without naming the source.",
      "choices": [
        "This is plagiarism because the idea is not credited.",
        "This is acceptable because academic tasks allow any source use.",
        "This is only a formatting issue and does not affect ethics.",
        "This is unrelated to academic integrity in university work."
      ],
      "answer": 0,
      "feedback": "The correct judgment identifies the academic ethics issue accurately.",
      "quality": "ethics_7",
      "skillTag": "Citation & Ethics",
      "stemGroup": "Choose the best ethical judgment."
    },
    {
      "id": "S12_B39",
      "type": "mcq",
      "question": "Choose the best ethical judgment.",
      "context": "Action: Checking AI information against credible sources before using it.",
      "choices": [
        "This is responsible AI use.",
        "This is acceptable because academic tasks allow any source use.",
        "This is only a formatting issue and does not affect ethics.",
        "This is unrelated to academic integrity in university work."
      ],
      "answer": 0,
      "feedback": "The correct judgment identifies the academic ethics issue accurately.",
      "quality": "ethics_8",
      "skillTag": "Citation & Ethics",
      "stemGroup": "Choose the best ethical judgment."
    },
    {
      "id": "S12_B40",
      "type": "mcq",
      "question": "Choose the best ethical judgment.",
      "context": "Action: Citing a source that does not support the claim.",
      "choices": [
        "This is incorrect source use.",
        "This is acceptable because academic tasks allow any source use.",
        "This is only a formatting issue and does not affect ethics.",
        "This is unrelated to academic integrity in university work."
      ],
      "answer": 0,
      "feedback": "The correct judgment identifies the academic ethics issue accurately.",
      "quality": "ethics_9",
      "skillTag": "Citation & Ethics",
      "stemGroup": "Choose the best ethical judgment."
    }
  ],
  "13": [
    {
      "id": "S13_B01",
      "type": "mcq",
      "question": "Listening simulation: What is the main point?",
      "context": "Transcript: Today, I will explain three strategies for academic reading: previewing, identifying keywords, and reviewing notes.",
      "choices": [
        "academic reading strategies",
        "a personal story with no academic purpose",
        "a list of unrelated classroom activities",
        "a casual conversation about daily routines"
      ],
      "answer": 0,
      "feedback": "The main point is the central idea of the transcript.",
      "quality": "listen_main_0",
      "skillTag": "Academic Listening",
      "stemGroup": "Listening simulation: What is the main point?"
    },
    {
      "id": "S13_B02",
      "type": "mcq",
      "question": "Which note is most effective?",
      "context": "Transcript: The first reason citation is important is that it helps readers locate the original source.",
      "choices": [
        "the importance of citation → key point",
        "The first reason citation is important is that it helps readers locate the original source.",
        "interesting topic with many details",
        "speaker talks about something important"
      ],
      "answer": 0,
      "feedback": "Effective notes are brief and focus on key information.",
      "quality": "listen_note_1",
      "skillTag": "Academic Listening",
      "stemGroup": "Which note is most effective?"
    },
    {
      "id": "S13_B03",
      "type": "mcq",
      "question": "Listening simulation: What is the main point?",
      "context": "Transcript: Although AI tools are useful, students must check the accuracy of their output.",
      "choices": [
        "responsible AI use",
        "a personal story with no academic purpose",
        "a list of unrelated classroom activities",
        "a casual conversation about daily routines"
      ],
      "answer": 0,
      "feedback": "The main point is the central idea of the transcript.",
      "quality": "listen_main_2",
      "skillTag": "Academic Listening",
      "stemGroup": "Listening simulation: What is the main point?"
    },
    {
      "id": "S13_B04",
      "type": "mcq",
      "question": "Which note is most effective?",
      "context": "Transcript: The survey included 250 undergraduate students from three faculties.",
      "choices": [
        "survey participants and sample details → key point",
        "The survey included 250 undergraduate students from three faculties.",
        "interesting topic with many details",
        "speaker talks about something important"
      ],
      "answer": 0,
      "feedback": "Effective notes are brief and focus on key information.",
      "quality": "listen_note_3",
      "skillTag": "Academic Listening",
      "stemGroup": "Which note is most effective?"
    },
    {
      "id": "S13_B05",
      "type": "mcq",
      "question": "Listening simulation: What is the main point?",
      "context": "Transcript: To sum up, digital literacy helps students evaluate online information more responsibly.",
      "choices": [
        "digital literacy and evaluation",
        "a personal story with no academic purpose",
        "a list of unrelated classroom activities",
        "a casual conversation about daily routines"
      ],
      "answer": 0,
      "feedback": "The main point is the central idea of the transcript.",
      "quality": "listen_main_4",
      "skillTag": "Academic Listening",
      "stemGroup": "Listening simulation: What is the main point?"
    },
    {
      "id": "S13_B06",
      "type": "mcq",
      "question": "Which note is most effective?",
      "context": "Transcript: Next, I will discuss how evidence can make an academic argument more convincing.",
      "choices": [
        "evidence in academic arguments → key point",
        "Next, I will discuss how evidence can make an academic argument more convincing.",
        "interesting topic with many details",
        "speaker talks about something important"
      ],
      "answer": 0,
      "feedback": "Effective notes are brief and focus on key information.",
      "quality": "listen_note_5",
      "skillTag": "Academic Listening",
      "stemGroup": "Which note is most effective?"
    },
    {
      "id": "S13_B07",
      "type": "mcq",
      "question": "Listening simulation: What is the main point?",
      "context": "Transcript: The study found a significant increase in engagement after game-based learning was introduced.",
      "choices": [
        "game-based learning and engagement",
        "a personal story with no academic purpose",
        "a list of unrelated classroom activities",
        "a casual conversation about daily routines"
      ],
      "answer": 0,
      "feedback": "The main point is the central idea of the transcript.",
      "quality": "listen_main_6",
      "skillTag": "Academic Listening",
      "stemGroup": "Listening simulation: What is the main point?"
    },
    {
      "id": "S13_B08",
      "type": "mcq",
      "question": "Which note is most effective?",
      "context": "Transcript: Students should check the author, date, and source before sharing online information.",
      "choices": [
        "source checking before sharing → key point",
        "Students should check the author, date, and source before sharing online information.",
        "interesting topic with many details",
        "speaker talks about something important"
      ],
      "answer": 0,
      "feedback": "Effective notes are brief and focus on key information.",
      "quality": "listen_note_7",
      "skillTag": "Academic Listening",
      "stemGroup": "Which note is most effective?"
    },
    {
      "id": "S13_B09",
      "type": "mcq",
      "question": "Listening simulation: What is the main point?",
      "context": "Transcript: In conclusion, clear presentation structure helps audiences follow complex ideas.",
      "choices": [
        "presentation structure and audience understanding",
        "a personal story with no academic purpose",
        "a list of unrelated classroom activities",
        "a casual conversation about daily routines"
      ],
      "answer": 0,
      "feedback": "The main point is the central idea of the transcript.",
      "quality": "listen_main_8",
      "skillTag": "Academic Listening",
      "stemGroup": "Listening simulation: What is the main point?"
    },
    {
      "id": "S13_B10",
      "type": "mcq",
      "question": "Which note is most effective?",
      "context": "Transcript: First, the speaker introduces the problem; then, she explains possible solutions.",
      "choices": [
        "the organization of a lecture → key point",
        "First, the speaker introduces the problem; then, she explains possible solutions.",
        "interesting topic with many details",
        "speaker talks about something important"
      ],
      "answer": 0,
      "feedback": "Effective notes are brief and focus on key information.",
      "quality": "listen_note_9",
      "skillTag": "Academic Listening",
      "stemGroup": "Which note is most effective?"
    },
    {
      "id": "S13_B11",
      "type": "mcq",
      "question": "Listening simulation: What is the main point?",
      "context": "Transcript: Today, I will explain three strategies for academic reading: previewing, identifying keywords, and reviewing notes.",
      "choices": [
        "academic reading strategies",
        "a personal story with no academic purpose",
        "a list of unrelated classroom activities",
        "a casual conversation about daily routines"
      ],
      "answer": 0,
      "feedback": "The main point is the central idea of the transcript.",
      "quality": "listen_main_0",
      "skillTag": "Academic Listening",
      "stemGroup": "Listening simulation: What is the main point?"
    },
    {
      "id": "S13_B12",
      "type": "mcq",
      "question": "Which note is most effective?",
      "context": "Transcript: The first reason citation is important is that it helps readers locate the original source.",
      "choices": [
        "the importance of citation → key point",
        "The first reason citation is important is that it helps readers locate the original source.",
        "interesting topic with many details",
        "speaker talks about something important"
      ],
      "answer": 0,
      "feedback": "Effective notes are brief and focus on key information.",
      "quality": "listen_note_1",
      "skillTag": "Academic Listening",
      "stemGroup": "Which note is most effective?"
    },
    {
      "id": "S13_B13",
      "type": "mcq",
      "question": "Listening simulation: What is the main point?",
      "context": "Transcript: Although AI tools are useful, students must check the accuracy of their output.",
      "choices": [
        "responsible AI use",
        "a personal story with no academic purpose",
        "a list of unrelated classroom activities",
        "a casual conversation about daily routines"
      ],
      "answer": 0,
      "feedback": "The main point is the central idea of the transcript.",
      "quality": "listen_main_2",
      "skillTag": "Academic Listening",
      "stemGroup": "Listening simulation: What is the main point?"
    },
    {
      "id": "S13_B14",
      "type": "mcq",
      "question": "Which note is most effective?",
      "context": "Transcript: The survey included 250 undergraduate students from three faculties.",
      "choices": [
        "survey participants and sample details → key point",
        "The survey included 250 undergraduate students from three faculties.",
        "interesting topic with many details",
        "speaker talks about something important"
      ],
      "answer": 0,
      "feedback": "Effective notes are brief and focus on key information.",
      "quality": "listen_note_3",
      "skillTag": "Academic Listening",
      "stemGroup": "Which note is most effective?"
    },
    {
      "id": "S13_B15",
      "type": "mcq",
      "question": "Listening simulation: What is the main point?",
      "context": "Transcript: To sum up, digital literacy helps students evaluate online information more responsibly.",
      "choices": [
        "digital literacy and evaluation",
        "a personal story with no academic purpose",
        "a list of unrelated classroom activities",
        "a casual conversation about daily routines"
      ],
      "answer": 0,
      "feedback": "The main point is the central idea of the transcript.",
      "quality": "listen_main_4",
      "skillTag": "Academic Listening",
      "stemGroup": "Listening simulation: What is the main point?"
    },
    {
      "id": "S13_B16",
      "type": "mcq",
      "question": "Which note is most effective?",
      "context": "Transcript: Next, I will discuss how evidence can make an academic argument more convincing.",
      "choices": [
        "evidence in academic arguments → key point",
        "Next, I will discuss how evidence can make an academic argument more convincing.",
        "interesting topic with many details",
        "speaker talks about something important"
      ],
      "answer": 0,
      "feedback": "Effective notes are brief and focus on key information.",
      "quality": "listen_note_5",
      "skillTag": "Academic Listening",
      "stemGroup": "Which note is most effective?"
    },
    {
      "id": "S13_B17",
      "type": "mcq",
      "question": "Listening simulation: What is the main point?",
      "context": "Transcript: The study found a significant increase in engagement after game-based learning was introduced.",
      "choices": [
        "game-based learning and engagement",
        "a personal story with no academic purpose",
        "a list of unrelated classroom activities",
        "a casual conversation about daily routines"
      ],
      "answer": 0,
      "feedback": "The main point is the central idea of the transcript.",
      "quality": "listen_main_6",
      "skillTag": "Academic Listening",
      "stemGroup": "Listening simulation: What is the main point?"
    },
    {
      "id": "S13_B18",
      "type": "mcq",
      "question": "Which note is most effective?",
      "context": "Transcript: Students should check the author, date, and source before sharing online information.",
      "choices": [
        "source checking before sharing → key point",
        "Students should check the author, date, and source before sharing online information.",
        "interesting topic with many details",
        "speaker talks about something important"
      ],
      "answer": 0,
      "feedback": "Effective notes are brief and focus on key information.",
      "quality": "listen_note_7",
      "skillTag": "Academic Listening",
      "stemGroup": "Which note is most effective?"
    },
    {
      "id": "S13_B19",
      "type": "mcq",
      "question": "Listening simulation: What is the main point?",
      "context": "Transcript: In conclusion, clear presentation structure helps audiences follow complex ideas.",
      "choices": [
        "presentation structure and audience understanding",
        "a personal story with no academic purpose",
        "a list of unrelated classroom activities",
        "a casual conversation about daily routines"
      ],
      "answer": 0,
      "feedback": "The main point is the central idea of the transcript.",
      "quality": "listen_main_8",
      "skillTag": "Academic Listening",
      "stemGroup": "Listening simulation: What is the main point?"
    },
    {
      "id": "S13_B20",
      "type": "mcq",
      "question": "Which note is most effective?",
      "context": "Transcript: First, the speaker introduces the problem; then, she explains possible solutions.",
      "choices": [
        "the organization of a lecture → key point",
        "First, the speaker introduces the problem; then, she explains possible solutions.",
        "interesting topic with many details",
        "speaker talks about something important"
      ],
      "answer": 0,
      "feedback": "Effective notes are brief and focus on key information.",
      "quality": "listen_note_9",
      "skillTag": "Academic Listening",
      "stemGroup": "Which note is most effective?"
    },
    {
      "id": "S13_B21",
      "type": "mcq",
      "question": "Listening simulation: What is the main point?",
      "context": "Transcript: Today, I will explain three strategies for academic reading: previewing, identifying keywords, and reviewing notes.",
      "choices": [
        "academic reading strategies",
        "a personal story with no academic purpose",
        "a list of unrelated classroom activities",
        "a casual conversation about daily routines"
      ],
      "answer": 0,
      "feedback": "The main point is the central idea of the transcript.",
      "quality": "listen_main_0",
      "skillTag": "Academic Listening",
      "stemGroup": "Listening simulation: What is the main point?"
    },
    {
      "id": "S13_B22",
      "type": "mcq",
      "question": "Which note is most effective?",
      "context": "Transcript: The first reason citation is important is that it helps readers locate the original source.",
      "choices": [
        "the importance of citation → key point",
        "The first reason citation is important is that it helps readers locate the original source.",
        "interesting topic with many details",
        "speaker talks about something important"
      ],
      "answer": 0,
      "feedback": "Effective notes are brief and focus on key information.",
      "quality": "listen_note_1",
      "skillTag": "Academic Listening",
      "stemGroup": "Which note is most effective?"
    },
    {
      "id": "S13_B23",
      "type": "mcq",
      "question": "Listening simulation: What is the main point?",
      "context": "Transcript: Although AI tools are useful, students must check the accuracy of their output.",
      "choices": [
        "responsible AI use",
        "a personal story with no academic purpose",
        "a list of unrelated classroom activities",
        "a casual conversation about daily routines"
      ],
      "answer": 0,
      "feedback": "The main point is the central idea of the transcript.",
      "quality": "listen_main_2",
      "skillTag": "Academic Listening",
      "stemGroup": "Listening simulation: What is the main point?"
    },
    {
      "id": "S13_B24",
      "type": "mcq",
      "question": "Which note is most effective?",
      "context": "Transcript: The survey included 250 undergraduate students from three faculties.",
      "choices": [
        "survey participants and sample details → key point",
        "The survey included 250 undergraduate students from three faculties.",
        "interesting topic with many details",
        "speaker talks about something important"
      ],
      "answer": 0,
      "feedback": "Effective notes are brief and focus on key information.",
      "quality": "listen_note_3",
      "skillTag": "Academic Listening",
      "stemGroup": "Which note is most effective?"
    },
    {
      "id": "S13_B25",
      "type": "mcq",
      "question": "Listening simulation: What is the main point?",
      "context": "Transcript: To sum up, digital literacy helps students evaluate online information more responsibly.",
      "choices": [
        "digital literacy and evaluation",
        "a personal story with no academic purpose",
        "a list of unrelated classroom activities",
        "a casual conversation about daily routines"
      ],
      "answer": 0,
      "feedback": "The main point is the central idea of the transcript.",
      "quality": "listen_main_4",
      "skillTag": "Academic Listening",
      "stemGroup": "Listening simulation: What is the main point?"
    },
    {
      "id": "S13_B26",
      "type": "mcq",
      "question": "Which note is most effective?",
      "context": "Transcript: Next, I will discuss how evidence can make an academic argument more convincing.",
      "choices": [
        "evidence in academic arguments → key point",
        "Next, I will discuss how evidence can make an academic argument more convincing.",
        "interesting topic with many details",
        "speaker talks about something important"
      ],
      "answer": 0,
      "feedback": "Effective notes are brief and focus on key information.",
      "quality": "listen_note_5",
      "skillTag": "Academic Listening",
      "stemGroup": "Which note is most effective?"
    },
    {
      "id": "S13_B27",
      "type": "mcq",
      "question": "Listening simulation: What is the main point?",
      "context": "Transcript: The study found a significant increase in engagement after game-based learning was introduced.",
      "choices": [
        "game-based learning and engagement",
        "a personal story with no academic purpose",
        "a list of unrelated classroom activities",
        "a casual conversation about daily routines"
      ],
      "answer": 0,
      "feedback": "The main point is the central idea of the transcript.",
      "quality": "listen_main_6",
      "skillTag": "Academic Listening",
      "stemGroup": "Listening simulation: What is the main point?"
    },
    {
      "id": "S13_B28",
      "type": "mcq",
      "question": "Which note is most effective?",
      "context": "Transcript: Students should check the author, date, and source before sharing online information.",
      "choices": [
        "source checking before sharing → key point",
        "Students should check the author, date, and source before sharing online information.",
        "interesting topic with many details",
        "speaker talks about something important"
      ],
      "answer": 0,
      "feedback": "Effective notes are brief and focus on key information.",
      "quality": "listen_note_7",
      "skillTag": "Academic Listening",
      "stemGroup": "Which note is most effective?"
    },
    {
      "id": "S13_B29",
      "type": "mcq",
      "question": "Listening simulation: What is the main point?",
      "context": "Transcript: In conclusion, clear presentation structure helps audiences follow complex ideas.",
      "choices": [
        "presentation structure and audience understanding",
        "a personal story with no academic purpose",
        "a list of unrelated classroom activities",
        "a casual conversation about daily routines"
      ],
      "answer": 0,
      "feedback": "The main point is the central idea of the transcript.",
      "quality": "listen_main_8",
      "skillTag": "Academic Listening",
      "stemGroup": "Listening simulation: What is the main point?"
    },
    {
      "id": "S13_B30",
      "type": "mcq",
      "question": "Which note is most effective?",
      "context": "Transcript: First, the speaker introduces the problem; then, she explains possible solutions.",
      "choices": [
        "the organization of a lecture → key point",
        "First, the speaker introduces the problem; then, she explains possible solutions.",
        "interesting topic with many details",
        "speaker talks about something important"
      ],
      "answer": 0,
      "feedback": "Effective notes are brief and focus on key information.",
      "quality": "listen_note_9",
      "skillTag": "Academic Listening",
      "stemGroup": "Which note is most effective?"
    },
    {
      "id": "S13_B31",
      "type": "mcq",
      "question": "Listening simulation: What is the main point?",
      "context": "Transcript: Today, I will explain three strategies for academic reading: previewing, identifying keywords, and reviewing notes.",
      "choices": [
        "academic reading strategies",
        "a personal story with no academic purpose",
        "a list of unrelated classroom activities",
        "a casual conversation about daily routines"
      ],
      "answer": 0,
      "feedback": "The main point is the central idea of the transcript.",
      "quality": "listen_main_0",
      "skillTag": "Academic Listening",
      "stemGroup": "Listening simulation: What is the main point?"
    },
    {
      "id": "S13_B32",
      "type": "mcq",
      "question": "Which note is most effective?",
      "context": "Transcript: The first reason citation is important is that it helps readers locate the original source.",
      "choices": [
        "the importance of citation → key point",
        "The first reason citation is important is that it helps readers locate the original source.",
        "interesting topic with many details",
        "speaker talks about something important"
      ],
      "answer": 0,
      "feedback": "Effective notes are brief and focus on key information.",
      "quality": "listen_note_1",
      "skillTag": "Academic Listening",
      "stemGroup": "Which note is most effective?"
    },
    {
      "id": "S13_B33",
      "type": "mcq",
      "question": "Listening simulation: What is the main point?",
      "context": "Transcript: Although AI tools are useful, students must check the accuracy of their output.",
      "choices": [
        "responsible AI use",
        "a personal story with no academic purpose",
        "a list of unrelated classroom activities",
        "a casual conversation about daily routines"
      ],
      "answer": 0,
      "feedback": "The main point is the central idea of the transcript.",
      "quality": "listen_main_2",
      "skillTag": "Academic Listening",
      "stemGroup": "Listening simulation: What is the main point?"
    },
    {
      "id": "S13_B34",
      "type": "mcq",
      "question": "Which note is most effective?",
      "context": "Transcript: The survey included 250 undergraduate students from three faculties.",
      "choices": [
        "survey participants and sample details → key point",
        "The survey included 250 undergraduate students from three faculties.",
        "interesting topic with many details",
        "speaker talks about something important"
      ],
      "answer": 0,
      "feedback": "Effective notes are brief and focus on key information.",
      "quality": "listen_note_3",
      "skillTag": "Academic Listening",
      "stemGroup": "Which note is most effective?"
    },
    {
      "id": "S13_B35",
      "type": "mcq",
      "question": "Listening simulation: What is the main point?",
      "context": "Transcript: To sum up, digital literacy helps students evaluate online information more responsibly.",
      "choices": [
        "digital literacy and evaluation",
        "a personal story with no academic purpose",
        "a list of unrelated classroom activities",
        "a casual conversation about daily routines"
      ],
      "answer": 0,
      "feedback": "The main point is the central idea of the transcript.",
      "quality": "listen_main_4",
      "skillTag": "Academic Listening",
      "stemGroup": "Listening simulation: What is the main point?"
    },
    {
      "id": "S13_B36",
      "type": "mcq",
      "question": "Which note is most effective?",
      "context": "Transcript: Next, I will discuss how evidence can make an academic argument more convincing.",
      "choices": [
        "evidence in academic arguments → key point",
        "Next, I will discuss how evidence can make an academic argument more convincing.",
        "interesting topic with many details",
        "speaker talks about something important"
      ],
      "answer": 0,
      "feedback": "Effective notes are brief and focus on key information.",
      "quality": "listen_note_5",
      "skillTag": "Academic Listening",
      "stemGroup": "Which note is most effective?"
    },
    {
      "id": "S13_B37",
      "type": "mcq",
      "question": "Listening simulation: What is the main point?",
      "context": "Transcript: The study found a significant increase in engagement after game-based learning was introduced.",
      "choices": [
        "game-based learning and engagement",
        "a personal story with no academic purpose",
        "a list of unrelated classroom activities",
        "a casual conversation about daily routines"
      ],
      "answer": 0,
      "feedback": "The main point is the central idea of the transcript.",
      "quality": "listen_main_6",
      "skillTag": "Academic Listening",
      "stemGroup": "Listening simulation: What is the main point?"
    },
    {
      "id": "S13_B38",
      "type": "mcq",
      "question": "Which note is most effective?",
      "context": "Transcript: Students should check the author, date, and source before sharing online information.",
      "choices": [
        "source checking before sharing → key point",
        "Students should check the author, date, and source before sharing online information.",
        "interesting topic with many details",
        "speaker talks about something important"
      ],
      "answer": 0,
      "feedback": "Effective notes are brief and focus on key information.",
      "quality": "listen_note_7",
      "skillTag": "Academic Listening",
      "stemGroup": "Which note is most effective?"
    },
    {
      "id": "S13_B39",
      "type": "mcq",
      "question": "Listening simulation: What is the main point?",
      "context": "Transcript: In conclusion, clear presentation structure helps audiences follow complex ideas.",
      "choices": [
        "presentation structure and audience understanding",
        "a personal story with no academic purpose",
        "a list of unrelated classroom activities",
        "a casual conversation about daily routines"
      ],
      "answer": 0,
      "feedback": "The main point is the central idea of the transcript.",
      "quality": "listen_main_8",
      "skillTag": "Academic Listening",
      "stemGroup": "Listening simulation: What is the main point?"
    },
    {
      "id": "S13_B40",
      "type": "mcq",
      "question": "Which note is most effective?",
      "context": "Transcript: First, the speaker introduces the problem; then, she explains possible solutions.",
      "choices": [
        "the organization of a lecture → key point",
        "First, the speaker introduces the problem; then, she explains possible solutions.",
        "interesting topic with many details",
        "speaker talks about something important"
      ],
      "answer": 0,
      "feedback": "Effective notes are brief and focus on key information.",
      "quality": "listen_note_9",
      "skillTag": "Academic Listening",
      "stemGroup": "Which note is most effective?"
    }
  ],
  "14": [
    {
      "id": "S14_B01",
      "type": "mcq",
      "question": "Choose the best opening phrase for an academic presentation.",
      "context": "",
      "choices": [
        "Today, I would like to present my topic on digital literacy.",
        "I will say some things about this topic now.",
        "This slide has information that might be useful.",
        "Let us finish this part and go to the next thing."
      ],
      "answer": 0,
      "feedback": "The correct phrase is polite, clear, and academic.",
      "quality": "pres_0",
      "skillTag": "Academic Presentation",
      "stemGroup": "Choose the best opening phrase for an academic pre"
    },
    {
      "id": "S14_B02",
      "type": "mcq",
      "question": "Choose the best outline phrase for an academic presentation.",
      "context": "",
      "choices": [
        "I will first explain the problem, then discuss causes and solutions.",
        "I will say some things about this topic now.",
        "This slide has information that might be useful.",
        "Let us finish this part and go to the next thing."
      ],
      "answer": 0,
      "feedback": "The correct phrase is polite, clear, and academic.",
      "quality": "pres_1",
      "skillTag": "Academic Presentation",
      "stemGroup": "Choose the best outline phrase for an academic pre"
    },
    {
      "id": "S14_B03",
      "type": "mcq",
      "question": "Choose the best transition phrase for an academic presentation.",
      "context": "",
      "choices": [
        "Let us now move to the causes of the problem.",
        "I will say some things about this topic now.",
        "This slide has information that might be useful.",
        "Let us finish this part and go to the next thing."
      ],
      "answer": 0,
      "feedback": "The correct phrase is polite, clear, and academic.",
      "quality": "pres_2",
      "skillTag": "Academic Presentation",
      "stemGroup": "Choose the best transition phrase for an academic "
    },
    {
      "id": "S14_B04",
      "type": "mcq",
      "question": "Choose the best evidence phrase for an academic presentation.",
      "context": "",
      "choices": [
        "According to the survey results, student awareness increased after training.",
        "I will say some things about this topic now.",
        "This slide has information that might be useful.",
        "Let us finish this part and go to the next thing."
      ],
      "answer": 0,
      "feedback": "The correct phrase is polite, clear, and academic.",
      "quality": "pres_3",
      "skillTag": "Academic Presentation",
      "stemGroup": "Choose the best evidence phrase for an academic pr"
    },
    {
      "id": "S14_B05",
      "type": "mcq",
      "question": "Choose the best conclusion phrase for an academic presentation.",
      "context": "",
      "choices": [
        "In conclusion, digital literacy training can support responsible online behavior.",
        "I will say some things about this topic now.",
        "This slide has information that might be useful.",
        "Let us finish this part and go to the next thing."
      ],
      "answer": 0,
      "feedback": "The correct phrase is polite, clear, and academic.",
      "quality": "pres_4",
      "skillTag": "Academic Presentation",
      "stemGroup": "Choose the best conclusion phrase for an academic "
    },
    {
      "id": "S14_B06",
      "type": "mcq",
      "question": "Choose the best Q&A response phrase for an academic presentation.",
      "context": "",
      "choices": [
        "Thank you for your question. Based on the evidence I found, ...",
        "I will say some things about this topic now.",
        "This slide has information that might be useful.",
        "Let us finish this part and go to the next thing."
      ],
      "answer": 0,
      "feedback": "The correct phrase is polite, clear, and academic.",
      "quality": "pres_5",
      "skillTag": "Academic Presentation",
      "stemGroup": "Choose the best Q&A response phrase for an academi"
    },
    {
      "id": "S14_B07",
      "type": "mcq",
      "question": "Choose the best limitation phrase for an academic presentation.",
      "context": "",
      "choices": [
        "One limitation of this evidence is the small sample size.",
        "I will say some things about this topic now.",
        "This slide has information that might be useful.",
        "Let us finish this part and go to the next thing."
      ],
      "answer": 0,
      "feedback": "The correct phrase is polite, clear, and academic.",
      "quality": "pres_6",
      "skillTag": "Academic Presentation",
      "stemGroup": "Choose the best limitation phrase for an academic "
    },
    {
      "id": "S14_B08",
      "type": "mcq",
      "question": "Choose the best solution phrase for an academic presentation.",
      "context": "",
      "choices": [
        "One possible solution is to provide short source-checking workshops.",
        "I will say some things about this topic now.",
        "This slide has information that might be useful.",
        "Let us finish this part and go to the next thing."
      ],
      "answer": 0,
      "feedback": "The correct phrase is polite, clear, and academic.",
      "quality": "pres_7",
      "skillTag": "Academic Presentation",
      "stemGroup": "Choose the best solution phrase for an academic pr"
    },
    {
      "id": "S14_B09",
      "type": "mcq",
      "question": "Choose the best audience thanks phrase for an academic presentation.",
      "context": "",
      "choices": [
        "Thank you for your attention.",
        "I will say some things about this topic now.",
        "This slide has information that might be useful.",
        "Let us finish this part and go to the next thing."
      ],
      "answer": 0,
      "feedback": "The correct phrase is polite, clear, and academic.",
      "quality": "pres_8",
      "skillTag": "Academic Presentation",
      "stemGroup": "Choose the best audience thanks phrase for an acad"
    },
    {
      "id": "S14_B10",
      "type": "mcq",
      "question": "Choose the best uncertain answer phrase for an academic presentation.",
      "context": "",
      "choices": [
        "I will need to check further information before answering fully.",
        "I will say some things about this topic now.",
        "This slide has information that might be useful.",
        "Let us finish this part and go to the next thing."
      ],
      "answer": 0,
      "feedback": "The correct phrase is polite, clear, and academic.",
      "quality": "pres_9",
      "skillTag": "Academic Presentation",
      "stemGroup": "Choose the best uncertain answer phrase for an aca"
    },
    {
      "id": "S14_B11",
      "type": "mcq",
      "question": "Choose the best opening phrase for an academic presentation.",
      "context": "",
      "choices": [
        "Today, I would like to present my topic on digital literacy.",
        "I will say some things about this topic now.",
        "This slide has information that might be useful.",
        "Let us finish this part and go to the next thing."
      ],
      "answer": 0,
      "feedback": "The correct phrase is polite, clear, and academic.",
      "quality": "pres_0",
      "skillTag": "Academic Presentation",
      "stemGroup": "Choose the best opening phrase for an academic pre"
    },
    {
      "id": "S14_B12",
      "type": "mcq",
      "question": "Choose the best outline phrase for an academic presentation.",
      "context": "",
      "choices": [
        "I will first explain the problem, then discuss causes and solutions.",
        "I will say some things about this topic now.",
        "This slide has information that might be useful.",
        "Let us finish this part and go to the next thing."
      ],
      "answer": 0,
      "feedback": "The correct phrase is polite, clear, and academic.",
      "quality": "pres_1",
      "skillTag": "Academic Presentation",
      "stemGroup": "Choose the best outline phrase for an academic pre"
    },
    {
      "id": "S14_B13",
      "type": "mcq",
      "question": "Choose the best transition phrase for an academic presentation.",
      "context": "",
      "choices": [
        "Let us now move to the causes of the problem.",
        "I will say some things about this topic now.",
        "This slide has information that might be useful.",
        "Let us finish this part and go to the next thing."
      ],
      "answer": 0,
      "feedback": "The correct phrase is polite, clear, and academic.",
      "quality": "pres_2",
      "skillTag": "Academic Presentation",
      "stemGroup": "Choose the best transition phrase for an academic "
    },
    {
      "id": "S14_B14",
      "type": "mcq",
      "question": "Choose the best evidence phrase for an academic presentation.",
      "context": "",
      "choices": [
        "According to the survey results, student awareness increased after training.",
        "I will say some things about this topic now.",
        "This slide has information that might be useful.",
        "Let us finish this part and go to the next thing."
      ],
      "answer": 0,
      "feedback": "The correct phrase is polite, clear, and academic.",
      "quality": "pres_3",
      "skillTag": "Academic Presentation",
      "stemGroup": "Choose the best evidence phrase for an academic pr"
    },
    {
      "id": "S14_B15",
      "type": "mcq",
      "question": "Choose the best conclusion phrase for an academic presentation.",
      "context": "",
      "choices": [
        "In conclusion, digital literacy training can support responsible online behavior.",
        "I will say some things about this topic now.",
        "This slide has information that might be useful.",
        "Let us finish this part and go to the next thing."
      ],
      "answer": 0,
      "feedback": "The correct phrase is polite, clear, and academic.",
      "quality": "pres_4",
      "skillTag": "Academic Presentation",
      "stemGroup": "Choose the best conclusion phrase for an academic "
    },
    {
      "id": "S14_B16",
      "type": "mcq",
      "question": "Choose the best Q&A response phrase for an academic presentation.",
      "context": "",
      "choices": [
        "Thank you for your question. Based on the evidence I found, ...",
        "I will say some things about this topic now.",
        "This slide has information that might be useful.",
        "Let us finish this part and go to the next thing."
      ],
      "answer": 0,
      "feedback": "The correct phrase is polite, clear, and academic.",
      "quality": "pres_5",
      "skillTag": "Academic Presentation",
      "stemGroup": "Choose the best Q&A response phrase for an academi"
    },
    {
      "id": "S14_B17",
      "type": "mcq",
      "question": "Choose the best limitation phrase for an academic presentation.",
      "context": "",
      "choices": [
        "One limitation of this evidence is the small sample size.",
        "I will say some things about this topic now.",
        "This slide has information that might be useful.",
        "Let us finish this part and go to the next thing."
      ],
      "answer": 0,
      "feedback": "The correct phrase is polite, clear, and academic.",
      "quality": "pres_6",
      "skillTag": "Academic Presentation",
      "stemGroup": "Choose the best limitation phrase for an academic "
    },
    {
      "id": "S14_B18",
      "type": "mcq",
      "question": "Choose the best solution phrase for an academic presentation.",
      "context": "",
      "choices": [
        "One possible solution is to provide short source-checking workshops.",
        "I will say some things about this topic now.",
        "This slide has information that might be useful.",
        "Let us finish this part and go to the next thing."
      ],
      "answer": 0,
      "feedback": "The correct phrase is polite, clear, and academic.",
      "quality": "pres_7",
      "skillTag": "Academic Presentation",
      "stemGroup": "Choose the best solution phrase for an academic pr"
    },
    {
      "id": "S14_B19",
      "type": "mcq",
      "question": "Choose the best audience thanks phrase for an academic presentation.",
      "context": "",
      "choices": [
        "Thank you for your attention.",
        "I will say some things about this topic now.",
        "This slide has information that might be useful.",
        "Let us finish this part and go to the next thing."
      ],
      "answer": 0,
      "feedback": "The correct phrase is polite, clear, and academic.",
      "quality": "pres_8",
      "skillTag": "Academic Presentation",
      "stemGroup": "Choose the best audience thanks phrase for an acad"
    },
    {
      "id": "S14_B20",
      "type": "mcq",
      "question": "Choose the best uncertain answer phrase for an academic presentation.",
      "context": "",
      "choices": [
        "I will need to check further information before answering fully.",
        "I will say some things about this topic now.",
        "This slide has information that might be useful.",
        "Let us finish this part and go to the next thing."
      ],
      "answer": 0,
      "feedback": "The correct phrase is polite, clear, and academic.",
      "quality": "pres_9",
      "skillTag": "Academic Presentation",
      "stemGroup": "Choose the best uncertain answer phrase for an aca"
    },
    {
      "id": "S14_B21",
      "type": "mcq",
      "question": "Choose the best opening phrase for an academic presentation.",
      "context": "",
      "choices": [
        "Today, I would like to present my topic on digital literacy.",
        "I will say some things about this topic now.",
        "This slide has information that might be useful.",
        "Let us finish this part and go to the next thing."
      ],
      "answer": 0,
      "feedback": "The correct phrase is polite, clear, and academic.",
      "quality": "pres_0",
      "skillTag": "Academic Presentation",
      "stemGroup": "Choose the best opening phrase for an academic pre"
    },
    {
      "id": "S14_B22",
      "type": "mcq",
      "question": "Choose the best outline phrase for an academic presentation.",
      "context": "",
      "choices": [
        "I will first explain the problem, then discuss causes and solutions.",
        "I will say some things about this topic now.",
        "This slide has information that might be useful.",
        "Let us finish this part and go to the next thing."
      ],
      "answer": 0,
      "feedback": "The correct phrase is polite, clear, and academic.",
      "quality": "pres_1",
      "skillTag": "Academic Presentation",
      "stemGroup": "Choose the best outline phrase for an academic pre"
    },
    {
      "id": "S14_B23",
      "type": "mcq",
      "question": "Choose the best transition phrase for an academic presentation.",
      "context": "",
      "choices": [
        "Let us now move to the causes of the problem.",
        "I will say some things about this topic now.",
        "This slide has information that might be useful.",
        "Let us finish this part and go to the next thing."
      ],
      "answer": 0,
      "feedback": "The correct phrase is polite, clear, and academic.",
      "quality": "pres_2",
      "skillTag": "Academic Presentation",
      "stemGroup": "Choose the best transition phrase for an academic "
    },
    {
      "id": "S14_B24",
      "type": "mcq",
      "question": "Choose the best evidence phrase for an academic presentation.",
      "context": "",
      "choices": [
        "According to the survey results, student awareness increased after training.",
        "I will say some things about this topic now.",
        "This slide has information that might be useful.",
        "Let us finish this part and go to the next thing."
      ],
      "answer": 0,
      "feedback": "The correct phrase is polite, clear, and academic.",
      "quality": "pres_3",
      "skillTag": "Academic Presentation",
      "stemGroup": "Choose the best evidence phrase for an academic pr"
    },
    {
      "id": "S14_B25",
      "type": "mcq",
      "question": "Choose the best conclusion phrase for an academic presentation.",
      "context": "",
      "choices": [
        "In conclusion, digital literacy training can support responsible online behavior.",
        "I will say some things about this topic now.",
        "This slide has information that might be useful.",
        "Let us finish this part and go to the next thing."
      ],
      "answer": 0,
      "feedback": "The correct phrase is polite, clear, and academic.",
      "quality": "pres_4",
      "skillTag": "Academic Presentation",
      "stemGroup": "Choose the best conclusion phrase for an academic "
    },
    {
      "id": "S14_B26",
      "type": "mcq",
      "question": "Choose the best Q&A response phrase for an academic presentation.",
      "context": "",
      "choices": [
        "Thank you for your question. Based on the evidence I found, ...",
        "I will say some things about this topic now.",
        "This slide has information that might be useful.",
        "Let us finish this part and go to the next thing."
      ],
      "answer": 0,
      "feedback": "The correct phrase is polite, clear, and academic.",
      "quality": "pres_5",
      "skillTag": "Academic Presentation",
      "stemGroup": "Choose the best Q&A response phrase for an academi"
    },
    {
      "id": "S14_B27",
      "type": "mcq",
      "question": "Choose the best limitation phrase for an academic presentation.",
      "context": "",
      "choices": [
        "One limitation of this evidence is the small sample size.",
        "I will say some things about this topic now.",
        "This slide has information that might be useful.",
        "Let us finish this part and go to the next thing."
      ],
      "answer": 0,
      "feedback": "The correct phrase is polite, clear, and academic.",
      "quality": "pres_6",
      "skillTag": "Academic Presentation",
      "stemGroup": "Choose the best limitation phrase for an academic "
    },
    {
      "id": "S14_B28",
      "type": "mcq",
      "question": "Choose the best solution phrase for an academic presentation.",
      "context": "",
      "choices": [
        "One possible solution is to provide short source-checking workshops.",
        "I will say some things about this topic now.",
        "This slide has information that might be useful.",
        "Let us finish this part and go to the next thing."
      ],
      "answer": 0,
      "feedback": "The correct phrase is polite, clear, and academic.",
      "quality": "pres_7",
      "skillTag": "Academic Presentation",
      "stemGroup": "Choose the best solution phrase for an academic pr"
    },
    {
      "id": "S14_B29",
      "type": "mcq",
      "question": "Choose the best audience thanks phrase for an academic presentation.",
      "context": "",
      "choices": [
        "Thank you for your attention.",
        "I will say some things about this topic now.",
        "This slide has information that might be useful.",
        "Let us finish this part and go to the next thing."
      ],
      "answer": 0,
      "feedback": "The correct phrase is polite, clear, and academic.",
      "quality": "pres_8",
      "skillTag": "Academic Presentation",
      "stemGroup": "Choose the best audience thanks phrase for an acad"
    },
    {
      "id": "S14_B30",
      "type": "mcq",
      "question": "Choose the best uncertain answer phrase for an academic presentation.",
      "context": "",
      "choices": [
        "I will need to check further information before answering fully.",
        "I will say some things about this topic now.",
        "This slide has information that might be useful.",
        "Let us finish this part and go to the next thing."
      ],
      "answer": 0,
      "feedback": "The correct phrase is polite, clear, and academic.",
      "quality": "pres_9",
      "skillTag": "Academic Presentation",
      "stemGroup": "Choose the best uncertain answer phrase for an aca"
    },
    {
      "id": "S14_B31",
      "type": "mcq",
      "question": "Choose the best opening phrase for an academic presentation.",
      "context": "",
      "choices": [
        "Today, I would like to present my topic on digital literacy.",
        "I will say some things about this topic now.",
        "This slide has information that might be useful.",
        "Let us finish this part and go to the next thing."
      ],
      "answer": 0,
      "feedback": "The correct phrase is polite, clear, and academic.",
      "quality": "pres_0",
      "skillTag": "Academic Presentation",
      "stemGroup": "Choose the best opening phrase for an academic pre"
    },
    {
      "id": "S14_B32",
      "type": "mcq",
      "question": "Choose the best outline phrase for an academic presentation.",
      "context": "",
      "choices": [
        "I will first explain the problem, then discuss causes and solutions.",
        "I will say some things about this topic now.",
        "This slide has information that might be useful.",
        "Let us finish this part and go to the next thing."
      ],
      "answer": 0,
      "feedback": "The correct phrase is polite, clear, and academic.",
      "quality": "pres_1",
      "skillTag": "Academic Presentation",
      "stemGroup": "Choose the best outline phrase for an academic pre"
    },
    {
      "id": "S14_B33",
      "type": "mcq",
      "question": "Choose the best transition phrase for an academic presentation.",
      "context": "",
      "choices": [
        "Let us now move to the causes of the problem.",
        "I will say some things about this topic now.",
        "This slide has information that might be useful.",
        "Let us finish this part and go to the next thing."
      ],
      "answer": 0,
      "feedback": "The correct phrase is polite, clear, and academic.",
      "quality": "pres_2",
      "skillTag": "Academic Presentation",
      "stemGroup": "Choose the best transition phrase for an academic "
    },
    {
      "id": "S14_B34",
      "type": "mcq",
      "question": "Choose the best evidence phrase for an academic presentation.",
      "context": "",
      "choices": [
        "According to the survey results, student awareness increased after training.",
        "I will say some things about this topic now.",
        "This slide has information that might be useful.",
        "Let us finish this part and go to the next thing."
      ],
      "answer": 0,
      "feedback": "The correct phrase is polite, clear, and academic.",
      "quality": "pres_3",
      "skillTag": "Academic Presentation",
      "stemGroup": "Choose the best evidence phrase for an academic pr"
    },
    {
      "id": "S14_B35",
      "type": "mcq",
      "question": "Choose the best conclusion phrase for an academic presentation.",
      "context": "",
      "choices": [
        "In conclusion, digital literacy training can support responsible online behavior.",
        "I will say some things about this topic now.",
        "This slide has information that might be useful.",
        "Let us finish this part and go to the next thing."
      ],
      "answer": 0,
      "feedback": "The correct phrase is polite, clear, and academic.",
      "quality": "pres_4",
      "skillTag": "Academic Presentation",
      "stemGroup": "Choose the best conclusion phrase for an academic "
    },
    {
      "id": "S14_B36",
      "type": "mcq",
      "question": "Choose the best Q&A response phrase for an academic presentation.",
      "context": "",
      "choices": [
        "Thank you for your question. Based on the evidence I found, ...",
        "I will say some things about this topic now.",
        "This slide has information that might be useful.",
        "Let us finish this part and go to the next thing."
      ],
      "answer": 0,
      "feedback": "The correct phrase is polite, clear, and academic.",
      "quality": "pres_5",
      "skillTag": "Academic Presentation",
      "stemGroup": "Choose the best Q&A response phrase for an academi"
    },
    {
      "id": "S14_B37",
      "type": "mcq",
      "question": "Choose the best limitation phrase for an academic presentation.",
      "context": "",
      "choices": [
        "One limitation of this evidence is the small sample size.",
        "I will say some things about this topic now.",
        "This slide has information that might be useful.",
        "Let us finish this part and go to the next thing."
      ],
      "answer": 0,
      "feedback": "The correct phrase is polite, clear, and academic.",
      "quality": "pres_6",
      "skillTag": "Academic Presentation",
      "stemGroup": "Choose the best limitation phrase for an academic "
    },
    {
      "id": "S14_B38",
      "type": "mcq",
      "question": "Choose the best solution phrase for an academic presentation.",
      "context": "",
      "choices": [
        "One possible solution is to provide short source-checking workshops.",
        "I will say some things about this topic now.",
        "This slide has information that might be useful.",
        "Let us finish this part and go to the next thing."
      ],
      "answer": 0,
      "feedback": "The correct phrase is polite, clear, and academic.",
      "quality": "pres_7",
      "skillTag": "Academic Presentation",
      "stemGroup": "Choose the best solution phrase for an academic pr"
    },
    {
      "id": "S14_B39",
      "type": "mcq",
      "question": "Choose the best audience thanks phrase for an academic presentation.",
      "context": "",
      "choices": [
        "Thank you for your attention.",
        "I will say some things about this topic now.",
        "This slide has information that might be useful.",
        "Let us finish this part and go to the next thing."
      ],
      "answer": 0,
      "feedback": "The correct phrase is polite, clear, and academic.",
      "quality": "pres_8",
      "skillTag": "Academic Presentation",
      "stemGroup": "Choose the best audience thanks phrase for an acad"
    },
    {
      "id": "S14_B40",
      "type": "mcq",
      "question": "Choose the best uncertain answer phrase for an academic presentation.",
      "context": "",
      "choices": [
        "I will need to check further information before answering fully.",
        "I will say some things about this topic now.",
        "This slide has information that might be useful.",
        "Let us finish this part and go to the next thing."
      ],
      "answer": 0,
      "feedback": "The correct phrase is polite, clear, and academic.",
      "quality": "pres_9",
      "skillTag": "Academic Presentation",
      "stemGroup": "Choose the best uncertain answer phrase for an aca"
    }
  ],
  "15": [
    {
      "id": "S15_B01",
      "type": "mcq",
      "question": "Choose the best problem statement.",
      "context": "",
      "choices": [
        "Fake news can affect students and academic decision-making.",
        "Fake news is a bad thing for many people.",
        "I personally dislike fake news in many situations.",
        "Everyone already knows that fake news is a problem."
      ],
      "answer": 0,
      "feedback": "A strong problem statement is specific and academic.",
      "quality": "final_problem_0",
      "skillTag": "Final Integration",
      "stemGroup": "Choose the best problem statement."
    },
    {
      "id": "S15_B02",
      "type": "mcq",
      "question": "Choose the best cause sentence.",
      "context": "",
      "choices": [
        "One possible cause is irresponsible online communication.",
        "The cause is people not doing the right thing.",
        "This problem happens because of many different issues.",
        "No one can clearly explain why this problem happens."
      ],
      "answer": 0,
      "feedback": "A good cause sentence is specific and relevant.",
      "quality": "final_cause_1",
      "skillTag": "Final Integration",
      "stemGroup": "Choose the best cause sentence."
    },
    {
      "id": "S15_B03",
      "type": "mcq",
      "question": "Choose the best evidence sentence.",
      "context": "",
      "choices": [
        "Interviews showed that many students were unsure how to cite AI assistance.",
        "Many people say this issue happens in many places.",
        "This problem is common because it appears online often.",
        "I have personally seen this issue several times."
      ],
      "answer": 0,
      "feedback": "Evidence should be specific and credible.",
      "quality": "final_evidence_2",
      "skillTag": "Final Integration",
      "stemGroup": "Choose the best evidence sentence."
    },
    {
      "id": "S15_B04",
      "type": "mcq",
      "question": "Choose the best solution sentence.",
      "context": "",
      "choices": [
        "Universities could provide campus learning support points to address this issue.",
        "People should be more careful and try to improve themselves.",
        "Everyone should stop doing the behavior immediately.",
        "The problem should disappear if people understand it better."
      ],
      "answer": 0,
      "feedback": "A good solution is realistic and specific.",
      "quality": "final_solution_3",
      "skillTag": "Final Integration",
      "stemGroup": "Choose the best solution sentence."
    },
    {
      "id": "S15_B05",
      "type": "mcq",
      "question": "Choose the best final presentation structure.",
      "context": "",
      "choices": [
        "Problem → Cause → Evidence → Solution → Conclusion",
        "Opinion → Story → Personal example → Ending",
        "Title → Picture → General idea → Thank you",
        "Cause only → More causes → Personal opinion → End"
      ],
      "answer": 0,
      "feedback": "This structure supports academic problem-solution presentation.",
      "quality": "final_structure_4",
      "skillTag": "Final Integration",
      "stemGroup": "Choose the best final presentation structure."
    },
    {
      "id": "S15_B06",
      "type": "mcq",
      "question": "Choose the best problem statement.",
      "context": "",
      "choices": [
        "Poor health awareness can affect students and academic decision-making.",
        "Poor health awareness is a bad thing for many people.",
        "I personally dislike poor health awareness in many situations.",
        "Everyone already knows that poor health awareness is a problem."
      ],
      "answer": 0,
      "feedback": "A strong problem statement is specific and academic.",
      "quality": "final_problem_5",
      "skillTag": "Final Integration",
      "stemGroup": "Choose the best problem statement."
    },
    {
      "id": "S15_B07",
      "type": "mcq",
      "question": "Choose the best cause sentence.",
      "context": "",
      "choices": [
        "One possible cause is limited recycling behavior on campus.",
        "The cause is people not doing the right thing.",
        "This problem happens because of many different issues.",
        "No one can clearly explain why this problem happens."
      ],
      "answer": 0,
      "feedback": "A good cause sentence is specific and relevant.",
      "quality": "final_cause_6",
      "skillTag": "Final Integration",
      "stemGroup": "Choose the best cause sentence."
    },
    {
      "id": "S15_B08",
      "type": "mcq",
      "question": "Choose the best evidence sentence.",
      "context": "",
      "choices": [
        "Pre-test results showed low reading confidence.",
        "Many people say this issue happens in many places.",
        "This problem is common because it appears online often.",
        "I have personally seen this issue several times."
      ],
      "answer": 0,
      "feedback": "Evidence should be specific and credible.",
      "quality": "final_evidence_7",
      "skillTag": "Final Integration",
      "stemGroup": "Choose the best evidence sentence."
    },
    {
      "id": "S15_B09",
      "type": "mcq",
      "question": "Choose the best solution sentence.",
      "context": "",
      "choices": [
        "Universities could provide structured presentation rehearsal to address this issue.",
        "People should be more careful and try to improve themselves.",
        "Everyone should stop doing the behavior immediately.",
        "The problem should disappear if people understand it better."
      ],
      "answer": 0,
      "feedback": "A good solution is realistic and specific.",
      "quality": "final_solution_8",
      "skillTag": "Final Integration",
      "stemGroup": "Choose the best solution sentence."
    },
    {
      "id": "S15_B10",
      "type": "mcq",
      "question": "Choose the best final presentation structure.",
      "context": "",
      "choices": [
        "Problem → Cause → Evidence → Solution → Conclusion",
        "Opinion → Story → Personal example → Ending",
        "Title → Picture → General idea → Thank you",
        "Cause only → More causes → Personal opinion → End"
      ],
      "answer": 0,
      "feedback": "This structure supports academic problem-solution presentation.",
      "quality": "final_structure_9",
      "skillTag": "Final Integration",
      "stemGroup": "Choose the best final presentation structure."
    },
    {
      "id": "S15_B11",
      "type": "mcq",
      "question": "Choose the best problem statement.",
      "context": "",
      "choices": [
        "Fake news can affect students and academic decision-making.",
        "Fake news is a bad thing for many people.",
        "I personally dislike fake news in many situations.",
        "Everyone already knows that fake news is a problem."
      ],
      "answer": 0,
      "feedback": "A strong problem statement is specific and academic.",
      "quality": "final_problem_0",
      "skillTag": "Final Integration",
      "stemGroup": "Choose the best problem statement."
    },
    {
      "id": "S15_B12",
      "type": "mcq",
      "question": "Choose the best cause sentence.",
      "context": "",
      "choices": [
        "One possible cause is irresponsible online communication.",
        "The cause is people not doing the right thing.",
        "This problem happens because of many different issues.",
        "No one can clearly explain why this problem happens."
      ],
      "answer": 0,
      "feedback": "A good cause sentence is specific and relevant.",
      "quality": "final_cause_1",
      "skillTag": "Final Integration",
      "stemGroup": "Choose the best cause sentence."
    },
    {
      "id": "S15_B13",
      "type": "mcq",
      "question": "Choose the best evidence sentence.",
      "context": "",
      "choices": [
        "Interviews showed that many students were unsure how to cite AI assistance.",
        "Many people say this issue happens in many places.",
        "This problem is common because it appears online often.",
        "I have personally seen this issue several times."
      ],
      "answer": 0,
      "feedback": "Evidence should be specific and credible.",
      "quality": "final_evidence_2",
      "skillTag": "Final Integration",
      "stemGroup": "Choose the best evidence sentence."
    },
    {
      "id": "S15_B14",
      "type": "mcq",
      "question": "Choose the best solution sentence.",
      "context": "",
      "choices": [
        "Universities could provide campus learning support points to address this issue.",
        "People should be more careful and try to improve themselves.",
        "Everyone should stop doing the behavior immediately.",
        "The problem should disappear if people understand it better."
      ],
      "answer": 0,
      "feedback": "A good solution is realistic and specific.",
      "quality": "final_solution_3",
      "skillTag": "Final Integration",
      "stemGroup": "Choose the best solution sentence."
    },
    {
      "id": "S15_B15",
      "type": "mcq",
      "question": "Choose the best final presentation structure.",
      "context": "",
      "choices": [
        "Problem → Cause → Evidence → Solution → Conclusion",
        "Opinion → Story → Personal example → Ending",
        "Title → Picture → General idea → Thank you",
        "Cause only → More causes → Personal opinion → End"
      ],
      "answer": 0,
      "feedback": "This structure supports academic problem-solution presentation.",
      "quality": "final_structure_4",
      "skillTag": "Final Integration",
      "stemGroup": "Choose the best final presentation structure."
    },
    {
      "id": "S15_B16",
      "type": "mcq",
      "question": "Choose the best problem statement.",
      "context": "",
      "choices": [
        "Poor health awareness can affect students and academic decision-making.",
        "Poor health awareness is a bad thing for many people.",
        "I personally dislike poor health awareness in many situations.",
        "Everyone already knows that poor health awareness is a problem."
      ],
      "answer": 0,
      "feedback": "A strong problem statement is specific and academic.",
      "quality": "final_problem_5",
      "skillTag": "Final Integration",
      "stemGroup": "Choose the best problem statement."
    },
    {
      "id": "S15_B17",
      "type": "mcq",
      "question": "Choose the best cause sentence.",
      "context": "",
      "choices": [
        "One possible cause is limited recycling behavior on campus.",
        "The cause is people not doing the right thing.",
        "This problem happens because of many different issues.",
        "No one can clearly explain why this problem happens."
      ],
      "answer": 0,
      "feedback": "A good cause sentence is specific and relevant.",
      "quality": "final_cause_6",
      "skillTag": "Final Integration",
      "stemGroup": "Choose the best cause sentence."
    },
    {
      "id": "S15_B18",
      "type": "mcq",
      "question": "Choose the best evidence sentence.",
      "context": "",
      "choices": [
        "Pre-test results showed low reading confidence.",
        "Many people say this issue happens in many places.",
        "This problem is common because it appears online often.",
        "I have personally seen this issue several times."
      ],
      "answer": 0,
      "feedback": "Evidence should be specific and credible.",
      "quality": "final_evidence_7",
      "skillTag": "Final Integration",
      "stemGroup": "Choose the best evidence sentence."
    },
    {
      "id": "S15_B19",
      "type": "mcq",
      "question": "Choose the best solution sentence.",
      "context": "",
      "choices": [
        "Universities could provide structured presentation rehearsal to address this issue.",
        "People should be more careful and try to improve themselves.",
        "Everyone should stop doing the behavior immediately.",
        "The problem should disappear if people understand it better."
      ],
      "answer": 0,
      "feedback": "A good solution is realistic and specific.",
      "quality": "final_solution_8",
      "skillTag": "Final Integration",
      "stemGroup": "Choose the best solution sentence."
    },
    {
      "id": "S15_B20",
      "type": "mcq",
      "question": "Choose the best final presentation structure.",
      "context": "",
      "choices": [
        "Problem → Cause → Evidence → Solution → Conclusion",
        "Opinion → Story → Personal example → Ending",
        "Title → Picture → General idea → Thank you",
        "Cause only → More causes → Personal opinion → End"
      ],
      "answer": 0,
      "feedback": "This structure supports academic problem-solution presentation.",
      "quality": "final_structure_9",
      "skillTag": "Final Integration",
      "stemGroup": "Choose the best final presentation structure."
    },
    {
      "id": "S15_B21",
      "type": "mcq",
      "question": "Choose the best problem statement.",
      "context": "",
      "choices": [
        "Fake news can affect students and academic decision-making.",
        "Fake news is a bad thing for many people.",
        "I personally dislike fake news in many situations.",
        "Everyone already knows that fake news is a problem."
      ],
      "answer": 0,
      "feedback": "A strong problem statement is specific and academic.",
      "quality": "final_problem_0",
      "skillTag": "Final Integration",
      "stemGroup": "Choose the best problem statement."
    },
    {
      "id": "S15_B22",
      "type": "mcq",
      "question": "Choose the best cause sentence.",
      "context": "",
      "choices": [
        "One possible cause is irresponsible online communication.",
        "The cause is people not doing the right thing.",
        "This problem happens because of many different issues.",
        "No one can clearly explain why this problem happens."
      ],
      "answer": 0,
      "feedback": "A good cause sentence is specific and relevant.",
      "quality": "final_cause_1",
      "skillTag": "Final Integration",
      "stemGroup": "Choose the best cause sentence."
    },
    {
      "id": "S15_B23",
      "type": "mcq",
      "question": "Choose the best evidence sentence.",
      "context": "",
      "choices": [
        "Interviews showed that many students were unsure how to cite AI assistance.",
        "Many people say this issue happens in many places.",
        "This problem is common because it appears online often.",
        "I have personally seen this issue several times."
      ],
      "answer": 0,
      "feedback": "Evidence should be specific and credible.",
      "quality": "final_evidence_2",
      "skillTag": "Final Integration",
      "stemGroup": "Choose the best evidence sentence."
    },
    {
      "id": "S15_B24",
      "type": "mcq",
      "question": "Choose the best solution sentence.",
      "context": "",
      "choices": [
        "Universities could provide campus learning support points to address this issue.",
        "People should be more careful and try to improve themselves.",
        "Everyone should stop doing the behavior immediately.",
        "The problem should disappear if people understand it better."
      ],
      "answer": 0,
      "feedback": "A good solution is realistic and specific.",
      "quality": "final_solution_3",
      "skillTag": "Final Integration",
      "stemGroup": "Choose the best solution sentence."
    },
    {
      "id": "S15_B25",
      "type": "mcq",
      "question": "Choose the best final presentation structure.",
      "context": "",
      "choices": [
        "Problem → Cause → Evidence → Solution → Conclusion",
        "Opinion → Story → Personal example → Ending",
        "Title → Picture → General idea → Thank you",
        "Cause only → More causes → Personal opinion → End"
      ],
      "answer": 0,
      "feedback": "This structure supports academic problem-solution presentation.",
      "quality": "final_structure_4",
      "skillTag": "Final Integration",
      "stemGroup": "Choose the best final presentation structure."
    },
    {
      "id": "S15_B26",
      "type": "mcq",
      "question": "Choose the best problem statement.",
      "context": "",
      "choices": [
        "Poor health awareness can affect students and academic decision-making.",
        "Poor health awareness is a bad thing for many people.",
        "I personally dislike poor health awareness in many situations.",
        "Everyone already knows that poor health awareness is a problem."
      ],
      "answer": 0,
      "feedback": "A strong problem statement is specific and academic.",
      "quality": "final_problem_5",
      "skillTag": "Final Integration",
      "stemGroup": "Choose the best problem statement."
    },
    {
      "id": "S15_B27",
      "type": "mcq",
      "question": "Choose the best cause sentence.",
      "context": "",
      "choices": [
        "One possible cause is limited recycling behavior on campus.",
        "The cause is people not doing the right thing.",
        "This problem happens because of many different issues.",
        "No one can clearly explain why this problem happens."
      ],
      "answer": 0,
      "feedback": "A good cause sentence is specific and relevant.",
      "quality": "final_cause_6",
      "skillTag": "Final Integration",
      "stemGroup": "Choose the best cause sentence."
    },
    {
      "id": "S15_B28",
      "type": "mcq",
      "question": "Choose the best evidence sentence.",
      "context": "",
      "choices": [
        "Pre-test results showed low reading confidence.",
        "Many people say this issue happens in many places.",
        "This problem is common because it appears online often.",
        "I have personally seen this issue several times."
      ],
      "answer": 0,
      "feedback": "Evidence should be specific and credible.",
      "quality": "final_evidence_7",
      "skillTag": "Final Integration",
      "stemGroup": "Choose the best evidence sentence."
    },
    {
      "id": "S15_B29",
      "type": "mcq",
      "question": "Choose the best solution sentence.",
      "context": "",
      "choices": [
        "Universities could provide structured presentation rehearsal to address this issue.",
        "People should be more careful and try to improve themselves.",
        "Everyone should stop doing the behavior immediately.",
        "The problem should disappear if people understand it better."
      ],
      "answer": 0,
      "feedback": "A good solution is realistic and specific.",
      "quality": "final_solution_8",
      "skillTag": "Final Integration",
      "stemGroup": "Choose the best solution sentence."
    },
    {
      "id": "S15_B30",
      "type": "mcq",
      "question": "Choose the best final presentation structure.",
      "context": "",
      "choices": [
        "Problem → Cause → Evidence → Solution → Conclusion",
        "Opinion → Story → Personal example → Ending",
        "Title → Picture → General idea → Thank you",
        "Cause only → More causes → Personal opinion → End"
      ],
      "answer": 0,
      "feedback": "This structure supports academic problem-solution presentation.",
      "quality": "final_structure_9",
      "skillTag": "Final Integration",
      "stemGroup": "Choose the best final presentation structure."
    },
    {
      "id": "S15_B31",
      "type": "mcq",
      "question": "Choose the best problem statement.",
      "context": "",
      "choices": [
        "Fake news can affect students and academic decision-making.",
        "Fake news is a bad thing for many people.",
        "I personally dislike fake news in many situations.",
        "Everyone already knows that fake news is a problem."
      ],
      "answer": 0,
      "feedback": "A strong problem statement is specific and academic.",
      "quality": "final_problem_0",
      "skillTag": "Final Integration",
      "stemGroup": "Choose the best problem statement."
    },
    {
      "id": "S15_B32",
      "type": "mcq",
      "question": "Choose the best cause sentence.",
      "context": "",
      "choices": [
        "One possible cause is irresponsible online communication.",
        "The cause is people not doing the right thing.",
        "This problem happens because of many different issues.",
        "No one can clearly explain why this problem happens."
      ],
      "answer": 0,
      "feedback": "A good cause sentence is specific and relevant.",
      "quality": "final_cause_1",
      "skillTag": "Final Integration",
      "stemGroup": "Choose the best cause sentence."
    },
    {
      "id": "S15_B33",
      "type": "mcq",
      "question": "Choose the best evidence sentence.",
      "context": "",
      "choices": [
        "Interviews showed that many students were unsure how to cite AI assistance.",
        "Many people say this issue happens in many places.",
        "This problem is common because it appears online often.",
        "I have personally seen this issue several times."
      ],
      "answer": 0,
      "feedback": "Evidence should be specific and credible.",
      "quality": "final_evidence_2",
      "skillTag": "Final Integration",
      "stemGroup": "Choose the best evidence sentence."
    },
    {
      "id": "S15_B34",
      "type": "mcq",
      "question": "Choose the best solution sentence.",
      "context": "",
      "choices": [
        "Universities could provide campus learning support points to address this issue.",
        "People should be more careful and try to improve themselves.",
        "Everyone should stop doing the behavior immediately.",
        "The problem should disappear if people understand it better."
      ],
      "answer": 0,
      "feedback": "A good solution is realistic and specific.",
      "quality": "final_solution_3",
      "skillTag": "Final Integration",
      "stemGroup": "Choose the best solution sentence."
    },
    {
      "id": "S15_B35",
      "type": "mcq",
      "question": "Choose the best final presentation structure.",
      "context": "",
      "choices": [
        "Problem → Cause → Evidence → Solution → Conclusion",
        "Opinion → Story → Personal example → Ending",
        "Title → Picture → General idea → Thank you",
        "Cause only → More causes → Personal opinion → End"
      ],
      "answer": 0,
      "feedback": "This structure supports academic problem-solution presentation.",
      "quality": "final_structure_4",
      "skillTag": "Final Integration",
      "stemGroup": "Choose the best final presentation structure."
    },
    {
      "id": "S15_B36",
      "type": "mcq",
      "question": "Choose the best problem statement.",
      "context": "",
      "choices": [
        "Poor health awareness can affect students and academic decision-making.",
        "Poor health awareness is a bad thing for many people.",
        "I personally dislike poor health awareness in many situations.",
        "Everyone already knows that poor health awareness is a problem."
      ],
      "answer": 0,
      "feedback": "A strong problem statement is specific and academic.",
      "quality": "final_problem_5",
      "skillTag": "Final Integration",
      "stemGroup": "Choose the best problem statement."
    },
    {
      "id": "S15_B37",
      "type": "mcq",
      "question": "Choose the best cause sentence.",
      "context": "",
      "choices": [
        "One possible cause is limited recycling behavior on campus.",
        "The cause is people not doing the right thing.",
        "This problem happens because of many different issues.",
        "No one can clearly explain why this problem happens."
      ],
      "answer": 0,
      "feedback": "A good cause sentence is specific and relevant.",
      "quality": "final_cause_6",
      "skillTag": "Final Integration",
      "stemGroup": "Choose the best cause sentence."
    },
    {
      "id": "S15_B38",
      "type": "mcq",
      "question": "Choose the best evidence sentence.",
      "context": "",
      "choices": [
        "Pre-test results showed low reading confidence.",
        "Many people say this issue happens in many places.",
        "This problem is common because it appears online often.",
        "I have personally seen this issue several times."
      ],
      "answer": 0,
      "feedback": "Evidence should be specific and credible.",
      "quality": "final_evidence_7",
      "skillTag": "Final Integration",
      "stemGroup": "Choose the best evidence sentence."
    },
    {
      "id": "S15_B39",
      "type": "mcq",
      "question": "Choose the best solution sentence.",
      "context": "",
      "choices": [
        "Universities could provide structured presentation rehearsal to address this issue.",
        "People should be more careful and try to improve themselves.",
        "Everyone should stop doing the behavior immediately.",
        "The problem should disappear if people understand it better."
      ],
      "answer": 0,
      "feedback": "A good solution is realistic and specific.",
      "quality": "final_solution_8",
      "skillTag": "Final Integration",
      "stemGroup": "Choose the best solution sentence."
    },
    {
      "id": "S15_B40",
      "type": "mcq",
      "question": "Choose the best final presentation structure.",
      "context": "",
      "choices": [
        "Problem → Cause → Evidence → Solution → Conclusion",
        "Opinion → Story → Personal example → Ending",
        "Title → Picture → General idea → Thank you",
        "Cause only → More causes → Personal opinion → End"
      ],
      "answer": 0,
      "feedback": "This structure supports academic problem-solution presentation.",
      "quality": "final_structure_9",
      "skillTag": "Final Integration",
      "stemGroup": "Choose the best final presentation structure."
    }
  ]
};
    Object.keys(BALANCED_BANK).forEach(key => {
      const session = SESSIONS.find(s => s.id === Number(key));
      if(!session) return;
      BALANCED_BANK[key].forEach(q => session.questions.push(q));
    });
  }
  addBalancedQuestionsV1e();

  function mcq(id, question, context, choices, answer, feedback){
    return { id, type:'mcq', question, context, choices, answer, feedback };
  }

  function cloneDefaultState(){
    const sessions = {};
    SESSIONS.forEach(s=>{
      sessions[s.id] = { unlocked: s.id===1, cleared:false, bestStars:0, bestAccuracy:0, attempts:0, bestScore:0, reflections:[] };
    });
    return {
      view:'home',
      profile:{ name:'', studentId:'', goal:'' },
      xp:0,
      rank:'New Learner',
      badges:[],
      cards:[],
      sessions,
      logs:[],
      examLogs:[],
      examAttempts:{},
      fun:{ coins:0, chests:[], titles:[], daily:{ lastDate:'', streak:0 }, achievementsClaimed:[] },
      settings:{ difficulty:'normal' },
      recentQuestions:{},
      active:null
    };
  }

  let state = loadState();

  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return cloneDefaultState();
      const parsed = JSON.parse(raw);
      const fresh = cloneDefaultState();
      const merged = Object.assign(fresh, parsed);
      merged.sessions = Object.assign(fresh.sessions, parsed.sessions || {});
      merged.recentQuestions = Object.assign(fresh.recentQuestions || {}, parsed.recentQuestions || {});
      merged.examLogs = parsed.examLogs || [];
      merged.examAttempts = Object.assign(fresh.examAttempts || {}, parsed.examAttempts || {});
      merged.fun = Object.assign(fresh.fun || {}, parsed.fun || {});
      merged.fun.daily = Object.assign((fresh.fun && fresh.fun.daily) || {}, (parsed.fun && parsed.fun.daily) || {});
      merged.fun.achievementsClaimed = (parsed.fun && parsed.fun.achievementsClaimed) || [];
      return merged;
    }catch(e){
      console.warn(e);
      return cloneDefaultState();
    }
  }

  function saveState(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function resetState(){
    if(confirm('ล้างข้อมูลเกมทั้งหมดในเครื่องนี้ใช่ไหมคะ?')){
      localStorage.removeItem(STORAGE_KEY);
      state = cloneDefaultState();
      renderHome();
    }
  }

  function addXP(xp){
    state.xp += xp;
    const rank = getRank(state.xp, state.cards.length);
    state.rank = rank;
  }

  function getRank(xp, cardCount){
    if(cardCount >= 15 && xp >= 1800) return 'True Academic Hero';
    if(xp >= 1500) return 'Society Saver';
    if(xp >= 1100) return 'Evidence Defender';
    if(xp >= 800) return 'Academic Writer';
    if(xp >= 500) return 'Critical Thinker';
    if(xp >= 280) return 'Smart Reader';
    if(xp >= 120) return 'Word Explorer';
    return 'New Learner';
  }


  function dateKey(d = new Date()){
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function yesterdayKey(){
    const d = new Date();
    d.setDate(d.getDate()-1);
    return dateKey(d);
  }

  function touchDailyStreak(){
    state.fun = state.fun || { coins:0, chests:[], titles:[], daily:{ lastDate:'', streak:0 }, achievementsClaimed:[] };
    state.fun.daily = state.fun.daily || { lastDate:'', streak:0 };
    const today = dateKey();
    if(state.fun.daily.lastDate === today) return;
    if(state.fun.daily.lastDate === yesterdayKey()) state.fun.daily.streak = (state.fun.daily.streak || 0) + 1;
    else state.fun.daily.streak = 1;
    state.fun.daily.lastDate = today;
    saveState();
  }

  function getContract(key){
    const map = {
      normal:{ key:'normal', label:'Standard Mission', note:'สมดุล เหมาะกับเล่นทั่วไป', xpMultiplier:1, timeFactor:1, hpBonus:0, hearts:3, chest:'bronze', noHint:false },
      brave:{ key:'brave', label:'Brave Contract', note:'บอสอึดขึ้น เวลาเท่าเดิม ได้ XP มากขึ้น', xpMultiplier:1.25, timeFactor:1, hpBonus:16, hearts:3, chest:'silver', noHint:false },
      hero:{ key:'hero', label:'Hero Contract', note:'เวลาเหลือน้อยลง หัวใจ 2 ดวง รางวัลสูง', xpMultiplier:1.65, timeFactor:.78, hpBonus:28, hearts:2, chest:'gold', noHint:false },
      nohint:{ key:'nohint', label:'No Hint Contract', note:'ห้ามใช้ Hint เพื่อรับโบนัส', xpMultiplier:1.35, timeFactor:1, hpBonus:8, hearts:3, chest:'silver', noHint:true },
      speed:{ key:'speed', label:'Speed Scholar', note:'เวลาน้อยลงมาก เหมาะกับ Speed Run', xpMultiplier:1.5, timeFactor:.65, hpBonus:10, hearts:3, chest:'gold', noHint:false }
    };
    return map[key] || map.normal;
  }

  function grantTreasure(session, starsEarned, contractKey){
    state.fun = state.fun || { coins:0, chests:[], titles:[], daily:{ lastDate:'', streak:0 }, achievementsClaimed:[] };
    const contract = getContract(contractKey || 'normal');
    let tier = contract.chest || 'bronze';
    if(starsEarned >= 3 && tier === 'bronze') tier = 'silver';
    if(starsEarned >= 3 && (contractKey === 'hero' || contractKey === 'speed')) tier = 'legendary';

    const coinMap = { bronze:20, silver:40, gold:70, legendary:110 };
    const titlePool = [
      'Truth Hunter','Speed Scholar','No Hint Hero','Evidence Defender','Academic Striker',
      'Comeback Hero','Critical Reader','Citation Guardian','Boss Slayer','Society Spark'
    ];
    const coin = coinMap[tier] || 20;
    state.fun.coins = (state.fun.coins || 0) + coin;

    let bonus = null;
    if(tier === 'legendary' || Math.random() < .33){
      bonus = titlePool[(session.id + (state.fun.chests?.length || 0)) % titlePool.length];
      if(!state.fun.titles.includes(bonus)) state.fun.titles.push(bonus);
    }

    const reward = {
      at:new Date().toISOString(),
      session:session.id,
      boss:session.boss,
      tier,
      coins:coin,
      bonusTitle:bonus,
      contract:contract.key
    };
    state.fun.chests = state.fun.chests || [];
    state.fun.chests.push(reward);
    return reward;
  }

  function achievementList(){
    const wins = state.logs.filter(l => l.win);
    const threeStars = state.logs.filter(l => l.win && l.stars >= 3);
    const combo5 = state.logs.some(l => (l.max_combo || 0) >= 5);
    const examDone = (state.examLogs || []).length > 0;
    const cards = state.cards.length;
    const streak = state.fun?.daily?.streak || 0;
    const chests = state.fun?.chests?.length || 0;
    return [
      { id:'first_win', name:'First Victory', desc:'ชนะบอสตัวแรก', unlocked:wins.length >= 1, reward:30 },
      { id:'combo_5', name:'Academic Rush', desc:'ทำ Combo อย่างน้อย x5', unlocked:combo5, reward:35 },
      { id:'three_star', name:'Three-Star Scholar', desc:'ได้ 3 ดาวอย่างน้อย 1 Session', unlocked:threeStars.length >= 1, reward:40 },
      { id:'five_cards', name:'Boss Collector', desc:'สะสม Boss Card อย่างน้อย 5 ใบ', unlocked:cards >= 5, reward:50 },
      { id:'streak_3', name:'Consistent Scholar', desc:'เข้าเล่นต่อเนื่อง 3 วัน', unlocked:streak >= 3, reward:60 },
      { id:'exam_done', name:'Exam Challenger', desc:'ทำข้อสอบ Midterm หรือ Final อย่างน้อย 1 ครั้ง', unlocked:examDone, reward:70 },
      { id:'ten_chests', name:'Treasure Hunter', desc:'เปิด Treasure Chest อย่างน้อย 10 ครั้ง', unlocked:chests >= 10, reward:80 },
      { id:'final_boss', name:'Society Saver', desc:'ชนะ Final Boss', unlocked:state.sessions[15]?.cleared, reward:120 }
    ];
  }

  function dailyChallengeSession(){
    const today = dateKey();
    let sum = 0;
    for(const ch of today) sum += ch.charCodeAt(0);
    return SESSIONS[(sum % SESSIONS.length)];
  }


  function safe(text){
    return String(text ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function stars(n){
    return '★'.repeat(n) + '☆'.repeat(Math.max(0,3-n));
  }

  function getSession(id){ return SESSIONS.find(s => s.id === Number(id)); }

  function setView(view){
    state.view = view;
    saveState();
  }

  function layout(content){
    app.innerHTML = `
      <div class="shell">
        <div class="topbar">
          <div class="logo" onclick="EAPHero.home()" role="button" tabindex="0">
            <div class="logo-mark">🎓</div>
            <div>
              <div>EAP Hero</div>
              <div class="mini-note">Save the Society • v1</div>
            </div>
          </div>
          <div class="top-actions">
            <button class="btn ghost small" onclick="EAPHero.map()">🗺️ Map</button>
            <button class="btn ghost small" onclick="EAPHero.profile()">👤 Profile</button>
            <button class="btn ghost small" onclick="EAPHero.gallery()">🃏 Cards</button>
            <button class="btn ghost small" onclick="EAPHero.funHub()">⚡ Fun</button>
            <button class="btn ghost small" onclick="EAPHero.examPanel()">📝 Exam</button>
            <button class="btn ghost small" onclick="EAPHero.dashboard()">📊 Teacher</button>
          </div>
        </div>
        ${content}
      </div>
    `;
  }

  function renderHome(){
    touchDailyStreak();
    setView('home');
    layout(`
      <section class="hero">
        <div class="panel">
          <div class="badges">
            <span class="pill">PC / Mobile Web</span>
            <span class="pill">15 Sessions</span>
            <span class="pill">Lab → Boss → Unlock</span>
          </div>
          <h1>EAP Hero:<br>Save the Society</h1>
          <p class="lead">
            เกมภาษาอังกฤษเพื่อวัตถุประสงค์ทางวิชาการสำหรับ ป.ตรี 
            ใช้ทักษะ Academic English เพื่อปราบบอสที่ทำให้สังคมไม่พัฒนา
          </p>
          <div class="footer-actions">
            <button class="btn primary" onclick="EAPHero.profile()">เริ่ม / ตั้งค่า Player</button>
            <button class="btn" onclick="EAPHero.map()">เข้า Campus Map</button>
            <button class="btn ghost" onclick="EAPHero.dashboard()">Teacher Dashboard</button>
          </div>
        </div>
        <div class="panel light">
          <h2>Player Status</h2>
          <div class="grid two">
            <div class="stat"><b>${safe(state.profile.name || 'Guest')}</b><span>Player</span></div>
            <div class="stat"><b>${safe(state.rank)}</b><span>Rank</span></div>
            <div class="stat"><b>${state.xp}</b><span>XP</span></div>
            <div class="stat"><b>${state.cards.length}/15</b><span>Boss Cards</span></div>
            <div class="stat"><b>${state.fun?.coins || 0}</b><span>Coins</span></div>
            <div class="stat"><b>${state.fun?.daily?.streak || 0}</b><span>Daily Streak</span></div>
          </div>
          <div class="badges">${state.badges.slice(0,6).map(b=>`<span class="pill">${safe(b)}</span>`).join('') || '<span class="mini-note">ยังไม่มี Badge — ชนะบอสเพื่อปลดล็อก</span>'}</div>
          <button class="btn danger small" onclick="EAPHero.reset()">Reset Local Progress</button>
        </div>
      </section>
    `);
  }

  function renderProfile(){
    setView('profile');
    layout(`
      <section class="panel light" style="margin-top:20px">
        <h2>Academic Hero Profile</h2>
        <p class="mini-note">ข้อมูลนี้บันทึกในเครื่องผ่าน localStorage เพื่อใช้ทดสอบ prototype</p>
        <div class="profile-card">
          <div class="grid two">
            <div class="field">
              <label>Player Name</label>
              <input id="pName" value="${safe(state.profile.name)}" placeholder="เช่น Supparang" />
            </div>
            <div class="field">
              <label>Student ID</label>
              <input id="pId" value="${safe(state.profile.studentId)}" placeholder="เช่น 651234567" />
            </div>
          </div>
          <div class="field">
            <label>Academic Goal</label>
            <textarea id="pGoal" placeholder="My academic goal is...">${safe(state.profile.goal)}</textarea>
          </div>
          <div class="footer-actions">
            <button class="btn primary" onclick="EAPHero.saveProfile()">Save Profile</button>
            <button class="btn" onclick="EAPHero.map()">Go to Campus Map</button>
          </div>
        </div>
      </section>
    `);
  }

  function saveProfile(){
    state.profile.name = document.getElementById('pName').value.trim();
    state.profile.studentId = document.getElementById('pId').value.trim();
    state.profile.goal = document.getElementById('pGoal').value.trim();
    saveState();
    renderMap();
  }

  function renderMap(){
    setView('map');
    const tiles = SESSIONS.map(s=>{
      const p = state.sessions[s.id] || {};
      const cls = p.unlocked ? (p.cleared ? 'cleared unlocked' : 'unlocked') : 'locked';
      const click = p.unlocked ? `onclick="EAPHero.sessionBrief(${s.id})"` : '';
      return `
        <button class="session-tile ${cls}" ${click}>
          <div class="num">SESSION ${s.id}</div>
          <div class="boss">${s.emoji}</div>
          <h3>${safe(s.title)}</h3>
          <p>${safe(s.boss)}</p>
          <p>${safe(s.skill)}</p>
          <div class="stars">${stars(p.bestStars||0)}</div>
          ${p.unlocked ? '' : '<div class="lock">🔒</div>'}
        </button>
      `;
    }).join('');

    layout(`
      <section class="panel" style="margin-top:20px">
        <div class="badges">
          <span class="pill">Rank: ${safe(state.rank)}</span>
          <span class="pill">XP: ${state.xp}</span>
          <span class="pill">Cards: ${state.cards.length}/15</span>
        </div>
        <h2>Campus Map</h2>
        <p class="lead">เลือก Session ที่ปลดล็อกแล้ว เข้า Lab ฝึกทักษะ แล้วสู้ Boss ก่อนจบ Session</p>
        <div class="map">${tiles}</div>
      </section>
    `);
  }

  function renderSessionBrief(id){
    const s = getSession(id);
    if(!s) return renderMap();
    const progress = state.sessions[id] || {};
    if(!progress.unlocked) return renderMap();

    setView('brief');
    layout(`
      <section class="panel" style="margin-top:20px">
        <div class="boss-brief">
          <div class="boss-portrait"><div class="emoji">${s.emoji}</div></div>
          <div>
            <div class="badges">
              <span class="pill">Session ${s.id}</span>
              <span class="pill">${safe(s.zone)}</span>
              <span class="pill">${safe(s.skill)}</span>
            </div>
            <h2>${safe(s.title)}</h2>
            <h3>Boss: ${safe(s.boss)}</h3>
            <div class="kv">
              <div><b>ปัญหาสังคม</b>${safe(s.problem)}</div>
              <div><b>Unlock</b>${safe(s.unlock)}</div>
              <div><b>Boss says</b>“${safe(s.taunt)}”</div>
            </div>
            <div class="footer-actions">
              <button class="btn primary" onclick="EAPHero.startLab(${s.id})">Start Lab</button>
              <button class="btn ghost" onclick="EAPHero.map()">Back to Map</button>
            </div>
          </div>
        </div>
      </section>
    `);
  }

  function renderLab(id){
    const s = getSession(id);
    setView('lab');
    layout(`
      <section class="panel" style="margin-top:20px">
        <div class="badges">
          <span class="pill">${s.emoji} ${safe(s.boss)}</span>
          <span class="pill">Skill Lab</span>
        </div>
        <h2>${safe(s.skill)}</h2>
        <div class="lab-content">
          <ul>${s.lab.map(x=>`<li>${safe(x)}</li>`).join('')}</ul>
        </div>
        <div class="footer-actions">
          <button class="btn primary" onclick="EAPHero.practice(${s.id})">Practice Mission</button>
          <button class="btn ghost" onclick="EAPHero.sessionBrief(${s.id})">Back</button>
        </div>
      </section>
    `);
  }

  function startPractice(id){
    const s = getSession(id);
    state.active = {
      mode:'practice',
      sessionId:id,
      index:0,
      order:selectQuestionSet(s, Math.min(4, s.questions.length), 'practice'),
      answers:[],
      correct:0
    };
    saveState();
    renderPracticeQuestion();
  }

  function renderPracticeQuestion(){
    const a = state.active;
    const s = getSession(a.sessionId);
    const q = a.order[a.index];
    if(!q) return renderPracticeDone();
    setView('practice');
    layout(`
      <section class="panel" style="margin-top:20px">
        <div class="badges">
          <span class="pill">${s.emoji} Practice Mission</span>
          <span class="pill">ข้อ ${a.index+1}/${a.order.length}</span>
          <span class="pill">ไม่มีเสีย Heart</span>
        </div>
        <div class="challenge-card">
          ${renderQuestionHTML(q)}
          <div id="feedback" class="feedback"></div>
          <div class="footer-actions">
            <button id="nextBtn" class="btn primary hidden" onclick="EAPHero.nextPractice()">Next</button>
            <button class="btn ghost" onclick="EAPHero.startLab(${s.id})">Back to Lab</button>
          </div>
        </div>
      </section>
    `);
  }

  function renderPracticeDone(){
    const s = getSession(state.active.sessionId);
    layout(`
      <section class="panel light" style="margin-top:20px;text-align:center">
        <div class="big-emoji">✅</div>
        <h2>Practice Complete</h2>
        <p>ถูก ${state.active.correct}/${state.active.order.length} ข้อ พร้อมสู้ ${safe(s.boss)} แล้วค่ะ</p>
        <div class="footer-actions" style="justify-content:center">
          <button class="btn primary" onclick="EAPHero.contract(${s.id})">Choose Contract</button>
          <button class="btn" onclick="EAPHero.practice(${s.id})">Replay Practice</button>
          <button class="btn ghost" onclick="EAPHero.map()">Map</button>
        </div>
      </section>
    `);
  }

  function renderQuestionHTML(q){
    return `
      ${q.context ? `<div class="context">${safe(q.context)}</div>` : ''}
      <div class="question">${safe(q.question)}</div>
      <div class="choices">
        ${q.choices.map((c,i)=>`<button class="choice" data-choice="${i}" onclick="EAPHero.answer(${i})">${String.fromCharCode(65+i)}. ${safe(c)}</button>`).join('')}
      </div>
    `;
  }

  function answer(choiceIndex){
    const a = state.active;
    if(!a) return;
    const q = a.order[a.index];
    const correct = choiceIndex === q.answer;
    a.answers.push({
      id:q.id, question:q.question, context:q.context, selected:choiceIndex, answer:q.answer,
      selectedText:q.choices[choiceIndex], answerText:q.choices[q.answer], correct, feedback:q.feedback
    });

    const buttons = [...document.querySelectorAll('.choice')];
    buttons.forEach(b=>b.disabled=true);
    const clicked = buttons[choiceIndex];
    const right = buttons[q.answer];
    if(clicked) clicked.classList.add(correct?'correct':'wrong');
    if(right) right.classList.add('correct');

    const fb = document.getElementById('feedback');
    if(fb){
      fb.className = `feedback show ${correct?'ok':'bad'}`;
      fb.textContent = correct ? `Correct! ${q.feedback}` : `Careful! ${q.feedback}`;
    }

    if(a.mode === 'practice'){
      if(correct) a.correct += 1;
      document.getElementById('nextBtn')?.classList.remove('hidden');
      saveState();
    }else if(a.mode === 'boss'){
      handleBossAnswer(correct);
    }
  }

  function nextPractice(){
    state.active.index += 1;
    saveState();
    renderPracticeQuestion();
  }

  let bossTimer = null;


  function renderContract(id){
    const s = getSession(id);
    if(!s) return renderMap();
    const contracts = ['normal','brave','hero','nohint','speed'].map(k => getContract(k));
    layout(`
      <section class="panel" style="margin-top:20px">
        <div class="badges">
          <span class="pill">${s.emoji} ${safe(s.boss)}</span>
          <span class="pill">Boss Contract</span>
          <span class="pill">เลือกความท้าทายก่อนสู้</span>
        </div>
        <h2>Choose Your Contract</h2>
        <p class="lead">ยิ่งเสี่ยง ยิ่งได้ XP และ Treasure Chest ดีขึ้น เหมาะสำหรับเล่นซ้ำเพื่อเก็บดาว/รางวัล</p>
        <div class="grid three">
          ${contracts.map(c => `
            <div class="panel light">
              <h3>${safe(c.label)}</h3>
              <p class="mini-note">${safe(c.note)}</p>
              <div class="badges">
                <span class="pill">XP x${c.xpMultiplier}</span>
                <span class="pill">Heart ${c.hearts}</span>
                <span class="pill">${safe(c.chest)} chest</span>
              </div>
              <button class="btn primary block" onclick="EAPHero.startBoss(${s.id}, '${c.key}')">Start</button>
            </div>
          `).join('')}
        </div>
        <div class="footer-actions">
          <button class="btn ghost" onclick="EAPHero.map()">Map</button>
          <button class="btn ghost" onclick="EAPHero.practice(${s.id})">Practice Again</button>
        </div>
      </section>
    `);
  }


  function startBoss(id, contractName){
    const s = getSession(id);
    clearInterval(bossTimer);
    const seconds = difficultySeconds();
    const order = selectQuestionSet(s, bossQuestionCount(), 'boss');
    const hp = Math.max(65, Math.min(130, Math.round(order.length * 10.5) + contract.hpBonus));
    state.active = {
      mode:'boss',
      sessionId:id,
      startedAt:Date.now(),
      duration:seconds,
      timeLeft:seconds,
      bossHpMax:hp,
      bossHp:hp,
      hearts:contract.hearts,
      combo:0,
      maxCombo:0,
      score:0,
      index:0,
      order,
      answers:[],
      correct:0,
      usedHints:0,
      rage:false
    };
    saveState();
    renderBossQuestion();
    bossTimer = setInterval(tickBoss, 1000);
  }



  function shuffleChoicesForQuestion(q){
    if(!q || !Array.isArray(q.choices)) return q;
    const paired = q.choices.map((choice, idx) => ({ choice, originalIndex: idx }));
    shuffle(paired);
    const newAnswer = paired.findIndex(item => item.originalIndex === q.answer);
    return Object.assign({}, q, {
      choices: paired.map(item => item.choice),
      answer: newAnswer
    });
  }


  function pickQuestionsFromSessions(sessionIds, count, examKey){
    let pool = [];
    sessionIds.forEach(id => {
      const s = getSession(id);
      if(s){
        const preferred = preferredPool(s.questions, Math.ceil(count / sessionIds.length));
        pool = pool.concat(preferred.map(q => Object.assign({}, q, { sourceSession:id, sourceBoss:s.boss, sourceSkill:s.skill })));
      }
    });

    const recentKey = 'exam_' + examKey;
    const recent = new Set((state.recentQuestions && state.recentQuestions[recentKey]) || []);
    let fresh = uniqueByFingerprint(shuffle([...pool]).filter(q => !recent.has(q.id)));
    let selected = fresh.slice(0, count);

    if(selected.length < count){
      const ids = new Set(selected.map(q => q.id));
      selected = selected.concat(uniqueByFingerprint(shuffle([...pool]).filter(q => !ids.has(q.id))).slice(0, count - selected.length));
    }
    return shuffle(selected).slice(0, Math.min(count, selected.length)).map(shuffleChoicesForQuestion);
  }


  function bossQuestionCount(){
    const d = state.settings.difficulty;
    if(d === 'easy') return 7;
    if(d === 'hard') return 9;
    if(d === 'challenge') return 10;
    return 8;
  }


  function textFingerprint(q){
    const base = (q.stemGroup || (q.question + ' ' + (q.context || ''))).toString().toLowerCase();
    return base.replace(/[^a-z0-9ก-๙]+/gi,' ').replace(/\s+/g,' ').trim();
  }

  function uniqueByFingerprint(pool){
    const used = new Set();
    const out = [];
    pool.forEach(q => {
      const fp = textFingerprint(q);
      if(!used.has(fp)){
        used.add(fp);
        out.push(q);
      }
    });
    return out;
  }

  function preferredPool(questions, count){
    const balanced = questions.filter(q => q.quality === 'v1e');
    if(balanced.length >= count) return balanced;
    return balanced.concat(questions.filter(q => q.quality !== 'v1e'));
  }

  function selectQuestionSet(session, count, mode){
    const basePool = preferredPool(session.questions, count);
    const pool = shuffle([...basePool]);
    const recent = new Set((state.recentQuestions && state.recentQuestions[session.id]) || []);
    let fresh = uniqueByFingerprint(pool.filter(q => !recent.has(q.id)));
    let selected = fresh.slice(0, count);

    if(selected.length < count){
      const selectedIds = new Set(selected.map(q => q.id));
      const fallback = uniqueByFingerprint(pool.filter(q => !selectedIds.has(q.id)));
      selected = selected.concat(fallback.slice(0, count - selected.length));
    }

    return shuffle(selected).slice(0, Math.min(count, selected.length)).map(shuffleChoicesForQuestion);
  }


  function updateRecentQuestions(sessionId, ids){
    state.recentQuestions = state.recentQuestions || {};
    const old = state.recentQuestions[sessionId] || [];
    const merged = [...ids, ...old.filter(id => !ids.includes(id))];
    const session = getSession(sessionId);
    const keep = Math.max(8, Math.floor((session?.questions?.length || 20) * 0.55));
    state.recentQuestions[sessionId] = merged.slice(0, keep);
  }

  function difficultySeconds(){
    const d = state.settings.difficulty;
    if(d === 'easy') return 240;
    if(d === 'hard') return 150;
    if(d === 'challenge') return 120;
    return 180;
  }

  function tickBoss(){
    const a = state.active;
    if(!a || a.mode !== 'boss') return clearInterval(bossTimer);
    a.timeLeft -= 1;
    if(a.timeLeft <= 0){
      a.timeLeft = 0;
      saveState();
      return finishBoss(false, 'หมดเวลา');
    }
    updateHUD();
    saveState();
  }

  function renderBossQuestion(){
    const a = state.active;
    const s = getSession(a.sessionId);
    let q = a.order[a.index];
    if(!q) return finishBoss(false, 'ตอบครบชุดคำถามแล้ว');
    setView('boss');
    const hpPct = Math.max(0, Math.round((a.bossHp/a.bossHpMax)*100));
    const timePct = Math.max(0, Math.round((a.timeLeft/a.duration)*100));
    layout(`
      <section style="margin-top:20px" class="battle-layout">
        <div class="challenge-card">
          <div class="badges">
            <span class="pill" style="background:#102033;color:#fff">${s.emoji} Boss Battle</span>
            <span class="pill" style="background:#102033;color:#fff">Session ${s.id}</span>
            <span class="pill" style="background:#102033;color:#fff">Question ${a.index+1}</span>
            <span class="pill" style="background:#102033;color:#fff">${safe(getContract(a.contract || 'normal').label)}</span>
          </div>
          ${renderQuestionHTML(q)}
          <div id="feedback" class="feedback"></div>
        </div>
        <aside class="battle-hud">
          <div class="hud-card ${a.rage?'rage':''}">
            <h3>${safe(s.boss)}</h3>
            <div class="boss-taunt">“${safe(a.rage ? 'Rage Mode! I will not fall easily!' : s.taunt)}”</div>
            <p class="mini-note">HP</p>
            <div class="hpbar"><span id="hpFill" style="width:${hpPct}%"></span></div>
          </div>
          <div class="hud-card">
            <b>Timer</b>
            <div class="timerbar"><span id="timeFill" style="width:${timePct}%"></span></div>
            <p id="timeText">${fmtTime(a.timeLeft)}</p>
          </div>
          <div class="grid two">
            <div class="hud-card"><b>Hearts</b><p id="heartText">${'♥ '.repeat(a.hearts)}</p></div>
            <div class="hud-card"><b>Combo</b><p id="comboText">x${a.combo}</p></div>
          </div>
          <div class="hud-card">
            <b>Power-ups</b>
            <div class="powerups" style="margin-top:10px">
              <button class="btn small" onclick="EAPHero.useHint()">Hint -2 XP</button>
              <button class="btn small" onclick="EAPHero.freezeTime()">Time Freeze</button>
            </div>
          </div>
          <button class="btn ghost block" onclick="EAPHero.sessionBrief(${s.id})">Quit Battle</button>
        </aside>
      </section>
    `);
  }

  function updateHUD(){
    const a = state.active;
    if(!a) return;
    const hpPct = Math.max(0, Math.round((a.bossHp/a.bossHpMax)*100));
    const timePct = Math.max(0, Math.round((a.timeLeft/a.duration)*100));
    const hp = document.getElementById('hpFill');
    const tm = document.getElementById('timeFill');
    const tt = document.getElementById('timeText');
    const ht = document.getElementById('heartText');
    const ct = document.getElementById('comboText');
    if(hp) hp.style.width = hpPct + '%';
    if(tm) tm.style.width = timePct + '%';
    if(tt) tt.textContent = fmtTime(a.timeLeft);
    if(ht) ht.textContent = '♥ '.repeat(a.hearts);
    if(ct) ct.textContent = 'x' + a.combo;
  }

  function handleBossAnswer(correct){
    const a = state.active;
    const q = a.order[a.index];

    if(correct){
      a.correct += 1;
      a.combo += 1;
      a.maxCombo = Math.max(a.maxCombo, a.combo);
      let dmg = 12;
      if(a.combo >= 3) dmg += 5;
      if(a.combo >= 5) dmg += 8;
      if(a.timeLeft > a.duration * .55) dmg += 3;
      a.bossHp = Math.max(0, a.bossHp - dmg);
      a.score += 10 + Math.min(20, a.combo*2);
    }else{
      a.combo = 0;
      a.hearts -= 1;
      a.score = Math.max(0, a.score - 3);
    }

    if(!a.rage && a.bossHp <= a.bossHpMax * .3 && a.bossHp > 0){
      a.rage = true;
      a.timeLeft = Math.max(25, a.timeLeft - 10);
    }

    saveState();

    setTimeout(()=>{
      if(a.bossHp <= 0) return finishBoss(true, 'ชนะบอส');
      if(a.hearts <= 0) return finishBoss(false, 'Heart หมด');
      if(a.index + 1 >= a.order.length) return finishBoss(false, 'ตอบครบชุดคำถามแล้ว แต่ยังลด HP บอสไม่หมด');
      a.index += 1;
      renderBossQuestion();
    }, 900);
  }

  function finishBoss(win, reason){
    clearInterval(bossTimer);
    const a = state.active;
    if(!a) return renderMap();
    const s = getSession(a.sessionId);
    const attempts = Math.max(1, a.answers.length);
    const accuracy = attempts ? a.correct / attempts : 0;
    const starsEarned = win ? calcStars(accuracy, a.timeLeft, a.usedHints) : 0;
    const contract = getContract(a.contract || 'normal');
    let xpGain = win ? Math.round(60 + a.score + starsEarned*25 + (a.timeLeft/4)) : Math.round(20 + a.correct*5);
    if(win) xpGain = Math.round(xpGain * contract.xpMultiplier);
    const badge = win ? badgeForSession(s.id) : null;
    const chestReward = win ? grantTreasure(s, starsEarned, a.contract || 'normal') : null;

    const prog = state.sessions[s.id];
    prog.attempts = (prog.attempts || 0) + 1;
    prog.bestStars = Math.max(prog.bestStars || 0, starsEarned);
    prog.bestAccuracy = Math.max(prog.bestAccuracy || 0, Math.round(accuracy*100));
    prog.bestScore = Math.max(prog.bestScore || 0, a.score);
    if(win){
      prog.cleared = true;
      const next = state.sessions[s.id+1];
      if(next) next.unlocked = true;
      if(!state.cards.includes(s.id)) state.cards.push(s.id);
      if(badge && !state.badges.includes(badge)) state.badges.push(badge);
      addXP(xpGain);
    }else{
      addXP(xpGain);
    }


    updateRecentQuestions(s.id, a.order.map(q => q.id));

    state.logs.push({
      student_id: state.profile.studentId || 'guest',
      player_name: state.profile.name || 'Guest',
      session: s.id,
      boss: s.boss,
      attempt: prog.attempts,
      win, reason,
      score:a.score,
      xp:xpGain,
      accuracy: Math.round(accuracy*100),
      time_used:a.duration-a.timeLeft,
      max_combo:a.maxCombo,
      stars:starsEarned,
      used_hints:a.usedHints,
      mistakes: a.answers.filter(x=>!x.correct).map(x=>x.id),
      completed_at:new Date().toISOString()
    });

    const mistakes = a.answers.filter(x=>!x.correct);
    const result = {
      win, reason, sessionId:s.id, xpGain, chestReward, contract:a.contract || 'normal', starsEarned, accuracy:Math.round(accuracy*100),
      score:a.score, maxCombo:a.maxCombo, timeLeft:a.timeLeft, badge, mistakes
    };
    state.active.result = result;
    saveState();
    renderResult(result);
  }

  function calcStars(accuracy, timeLeft, hints){
    if(accuracy >= 1 && hints === 0 && timeLeft > 20) return 3;
    if(accuracy >= .85 && timeLeft > 0) return 3;
    if(accuracy >= .70) return 2;
    return 1;
  }

  function badgeForSession(id){
    const badges = {
      1:'Academic Hero ID',
      2:'Vocabulary Starter',
      3:'Smart Reader',
      4:'Fast Scanner',
      5:'Critical Thinker',
      6:'Original Thinker',
      7:'Academic Voice',
      8:'Midterm Survivor',
      9:'Academic Writer',
      10:'Data Decoder',
      11:'Polite Communicator',
      12:'Integrity Hero',
      13:'Active Listener',
      14:'Presenter',
      15:'Society Saver'
    };
    return badges[id];
  }

  function renderResult(r){
    const s = getSession(r.sessionId);
    setView('result');
    layout(`
      <section class="panel light result-hero" style="margin-top:20px">
        <div class="big-emoji">${r.win ? '🏆' : '💪'}</div>
        <h2>${r.win ? 'Boss Defeated!' : 'Try Again'}</h2>
        <h3>${safe(s.boss)}</h3>
        <div class="grid four">
          <div class="stat"><b>${r.xpGain}</b><span>XP Gained</span></div>
          <div class="stat"><b>${r.accuracy}%</b><span>Accuracy</span></div>
          <div class="stat"><b>${r.maxCombo}</b><span>Max Combo</span></div>
          <div class="stat"><b class="stars">${stars(r.starsEarned)}</b><span>Stars</span></div>
        </div>
        ${r.win ? `<p class="feedback show ok">Unlock: ${safe(s.unlock)} ${r.badge ? ' • Badge: '+safe(r.badge):''}</p>` : `<p class="feedback show bad">${safe(r.reason)} — กลับไปฝึกแล้วมาสู้ใหม่ได้ค่ะ</p>`}
        ${r.chestReward ? `<p class="feedback show info">Treasure Chest: ${safe(r.chestReward.tier.toUpperCase())} +${r.chestReward.coins} coins ${r.chestReward.bonusTitle ? '• Title: '+safe(r.chestReward.bonusTitle) : ''}</p>` : ''}
        <div class="footer-actions" style="justify-content:center">
          ${r.mistakes.length ? `<button class="btn warn" onclick="EAPHero.reviewMistakes()">Review Mistakes (${r.mistakes.length})</button>` : ''}
          <button class="btn primary" onclick="EAPHero.reflection(${s.id})">Reflection</button>
          <button class="btn" onclick="EAPHero.contract(${s.id})">Rematch Contract</button>
          <button class="btn ghost" onclick="EAPHero.map()">Map</button>
        </div>
      </section>
    `);
  }

  function renderMistakes(){
    const r = state.active && state.active.result;
    if(!r) return renderMap();
    const s = getSession(r.sessionId);
    const rows = r.mistakes.map((m,i)=>`
      <div class="challenge-card" style="margin-bottom:12px">
        <div class="badges"><span class="pill" style="background:#102033;color:#fff">Mistake ${i+1}</span></div>
        ${m.context ? `<div class="context">${safe(m.context)}</div>` : ''}
        <div class="question">${safe(m.question)}</div>
        <p><b>Your answer:</b> ${safe(m.selectedText)}</p>
        <p><b>Correct answer:</b> ${safe(m.answerText)}</p>
        <div class="feedback show info">${safe(m.feedback)}</div>
      </div>
    `).join('');
    layout(`
      <section style="margin-top:20px">
        <h2>Review Mistakes: ${safe(s.boss)}</h2>
        ${rows || '<div class="panel light">ไม่มีข้อผิดพลาด ยอดเยี่ยมมากค่ะ</div>'}
        <div class="footer-actions">
          <button class="btn primary" onclick="EAPHero.contract(${s.id})">Replay Boss</button>
          <button class="btn" onclick="EAPHero.reflection(${s.id})">Reflection</button>
          <button class="btn ghost" onclick="EAPHero.map()">Map</button>
        </div>
      </section>
    `);
  }

  function renderReflection(id){
    const s = getSession(id);
    setView('reflection');
    layout(`
      <section class="panel light" style="margin-top:20px">
        <h2>Reflection: Session ${s.id}</h2>
        <p><b>${safe(s.reflection)}</b></p>
        <div class="field">
          <label>Write 1–2 sentences in English</label>
          <textarea id="reflectionText" placeholder="I learned that..."></textarea>
        </div>
        <div class="footer-actions">
          <button class="btn primary" onclick="EAPHero.saveReflection(${s.id})">Save Reflection</button>
          <button class="btn ghost" onclick="EAPHero.map()">Skip / Map</button>
        </div>
      </section>
    `);
  }

  function saveReflection(id){
    const text = document.getElementById('reflectionText').value.trim();
    if(text){
      const prog = state.sessions[id];
      prog.reflections = prog.reflections || [];
      prog.reflections.push({ text, at:new Date().toISOString() });
      addXP(10);
      saveState();
    }
    renderMap();
  }

  function renderGallery(){
    setView('gallery');
    const cards = SESSIONS.map(s=>{
      const got = state.cards.includes(s.id);
      const p = state.sessions[s.id] || {};
      return `
        <div class="boss-card ${got?'':'locked'}">
          <div class="emoji">${got?s.emoji:'❔'}</div>
          <h3>${got?safe(s.boss):'Locked Card'}</h3>
          <p>${got?safe(s.skill):'Defeat this boss to unlock'}</p>
          <div class="stars">${got?stars(p.bestStars||1):'☆☆☆'}</div>
        </div>
      `;
    }).join('');
    layout(`
      <section class="panel" style="margin-top:20px">
        <h2>Boss Card Gallery</h2>
        <p class="lead">ชนะบอสเพื่อปลดล็อกการ์ด และเล่นซ้ำเพื่อเก็บ 3 ดาว</p>
        <div class="card-gallery">${cards}</div>
      </section>
    `);
  }



  function renderFunHub(){
    touchDailyStreak();
    const daily = dailyChallengeSession();
    const achievements = achievementList();
    const claimed = new Set(state.fun?.achievementsClaimed || []);
    const unlockedCount = achievements.filter(a=>a.unlocked).length;
    const lastChests = (state.fun?.chests || []).slice(-8).reverse();
    layout(`
      <section class="panel" style="margin-top:20px">
        <div class="badges">
          <span class="pill">Daily Streak: ${state.fun?.daily?.streak || 0}</span>
          <span class="pill">Coins: ${state.fun?.coins || 0}</span>
          <span class="pill">Achievements: ${unlockedCount}/${achievements.length}</span>
        </div>
        <h2>Fun Loop Hub</h2>
        <p class="lead">ศูนย์รวมภารกิจเล่นซ้ำ: Daily Challenge, Boss Contract, Treasure Chest, Achievements และ Titles</p>

        <div class="grid two">
          <div class="panel light">
            <h3>Daily Challenge</h3>
            <p class="mini-note">วันนี้ท้าชน: Session ${daily.id} • ${safe(daily.boss)} • เล่นแบบ Brave Contract เพื่อเก็บรางวัล</p>
            <div class="big-emoji" style="font-size:58px">${daily.emoji}</div>
            <button class="btn primary block" onclick="EAPHero.startBoss(${daily.id}, 'brave')">Start Daily Challenge</button>
          </div>
          <div class="panel light">
            <h3>Titles</h3>
            <p class="mini-note">ปลดล็อกจาก Legendary Chest และ Achievement</p>
            <div class="badges">
              ${(state.fun?.titles || []).map(t=>`<span class="pill">${safe(t)}</span>`).join('') || '<span class="mini-note">ยังไม่มี Title — เล่น Contract ยากขึ้นเพื่อปลดล็อก</span>'}
            </div>
          </div>
        </div>

        <h3 style="margin-top:20px">Achievements</h3>
        <div class="grid four">
          ${achievements.map(a=>`
            <div class="panel light">
              <h3>${a.unlocked ? '🏅' : '🔒'} ${safe(a.name)}</h3>
              <p class="mini-note">${safe(a.desc)}</p>
              <p><b>Reward:</b> ${a.reward} coins</p>
              ${a.unlocked && !claimed.has(a.id) ? `<button class="btn primary block" onclick="EAPHero.claimAchievement('${a.id}')">Claim</button>` : `<button class="btn block" disabled>${claimed.has(a.id)?'Claimed': 'Locked'}</button>`}
            </div>
          `).join('')}
        </div>

        <h3 style="margin-top:20px">Recent Treasure Chests</h3>
        <div class="grid four">
          ${lastChests.map(c=>`
            <div class="panel light">
              <h3>${c.tier === 'legendary' ? '🌈' : c.tier === 'gold' ? '🥇' : c.tier === 'silver' ? '🥈' : '🥉'} ${safe(c.tier)} Chest</h3>
              <p class="mini-note">${safe(c.boss)} • ${safe(c.contract)}</p>
              <p><b>+${c.coins}</b> coins</p>
              ${c.bonusTitle ? `<p>Title: <b>${safe(c.bonusTitle)}</b></p>` : ''}
            </div>
          `).join('') || '<div class="panel light"><p>ยังไม่มี Chest — ชนะบอสก่อนค่ะ</p></div>'}
        </div>
      </section>
    `);
  }

  function claimAchievement(id){
    const ach = achievementList().find(a => a.id === id);
    if(!ach || !ach.unlocked) return renderFunHub();
    state.fun = state.fun || { coins:0, chests:[], titles:[], daily:{ lastDate:'', streak:0 }, achievementsClaimed:[] };
    state.fun.achievementsClaimed = state.fun.achievementsClaimed || [];
    if(!state.fun.achievementsClaimed.includes(id)){
      state.fun.achievementsClaimed.push(id);
      state.fun.coins = (state.fun.coins || 0) + ach.reward;
      if(!state.fun.titles.includes(ach.name)) state.fun.titles.push(ach.name);
      saveState();
    }
    renderFunHub();
  }


  function renderExamPanel(){
    setView('examPanel');
    const midKey = todayExamKey('midterm');
    const finalKey = todayExamKey('final');
    const midAttempt = state.examAttempts[midKey] || 0;
    const finalAttempt = state.examAttempts[finalKey] || 0;
    layout(`
      <section class="panel" style="margin-top:20px">
        <div class="badges">
          <span class="pill">Exam Ready v1c</span>
          <span class="pill">สุ่มข้อ + สุ่มตัวเลือก</span>
          <span class="pill">ไม่เฉลยระหว่างสอบ</span>
        </div>
        <h2>Exam Mode</h2>
        <p class="lead">
          โหมดสอบใช้สำหรับสอบในห้องแบบควบคุมโดยอาจารย์ มี timer, random question set, shuffled choices,
          no instant feedback, attempt log และ export CSV
        </p>
        <div class="grid three">
          <div class="panel light">
            <h3>Midterm Exam</h3>
            <p class="mini-note">Sessions 1–8 • 60 ข้อ • 75 นาที • Attempts today: ${midAttempt}</p>
            <button class="btn primary block" onclick="EAPHero.startExam('midterm')">Start Midterm</button>
          </div>
          <div class="panel light">
            <h3>Final Exam</h3>
            <p class="mini-note">Sessions 1–15 • 80 ข้อ • 100 นาที • Attempts today: ${finalAttempt}</p>
            <button class="btn primary block" onclick="EAPHero.startExam('final')">Start Final</button>
          </div>
          <div class="panel light">
            <h3>Session Quiz</h3>
            <p class="mini-note">เลือก Session ใน Campus Map แล้วใช้ Boss Battle สำหรับ quiz ย่อย หรือเริ่มสอบรวมแบบ Midterm/Final ที่นี่</p>
            <button class="btn block" onclick="EAPHero.map()">Go to Map</button>
          </div>
        </div>
        <div class="panel light" style="margin-top:14px">
          <h3>Fair-play settings</h3>
          <p class="mini-note">
            ระหว่างสอบ: ปิด hint/feedback, สุ่มข้อ, สุ่มตัวเลือก, จับเวลา, บันทึก tab-switch warning
            และบันทึก attempt ลง Exam Logs. หมายเหตุ: เป็น client-side prototype ถ้าต้องสอบ high-stakes มากควรต่อ server/Google Sheets เพิ่ม
          </p>
        </div>
      </section>
    `);
  }

  function todayExamKey(type){
    const d = new Date();
    return `${type}_${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function startExam(type){
    const cfg = examConfig(type);
    if(!cfg) return renderExamPanel();
    const key = todayExamKey(type);
    state.examAttempts[key] = (state.examAttempts[key] || 0) + 1;

    const order = pickQuestionsFromSessions(cfg.sessions, cfg.count, key);
    state.active = {
      mode:'exam',
      examType:type,
      examKey:key,
      title:cfg.title,
      startedAt:Date.now(),
      duration:cfg.minutes*60,
      timeLeft:cfg.minutes*60,
      index:0,
      order,
      answers:[],
      warnings:0,
      submitted:false
    };
    saveState();

    try{
      if(document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(()=>{});
    }catch(e){}

    clearInterval(bossTimer);
    bossTimer = setInterval(tickExam, 1000);
    renderExamQuestion();
  }

  function examConfig(type){
    if(type === 'midterm') return { title:'Midterm Exam', sessions:[1,2,3,4,5,6,7,8], count:60, minutes:75 };
    if(type === 'final') return { title:'Final Exam', sessions:[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15], count:80, minutes:100 };
    return null;
  }

  function tickExam(){
    const a = state.active;
    if(!a || a.mode !== 'exam') return clearInterval(bossTimer);
    a.timeLeft -= 1;
    if(a.timeLeft <= 0){
      a.timeLeft = 0;
      saveState();
      return finishExam('time_up');
    }
    const tt = document.getElementById('examTimeText');
    const tf = document.getElementById('examTimeFill');
    if(tt) tt.textContent = fmtTime(a.timeLeft);
    if(tf) tf.style.width = Math.max(0, Math.round((a.timeLeft/a.duration)*100)) + '%';
    saveState();
  }

  function renderExamQuestion(){
    const a = state.active;
    if(!a || a.mode !== 'exam') return renderExamPanel();
    const q = a.order[a.index];
    if(!q) return finishExam('complete');

    const answered = a.answers.find(x => x.index === a.index);
    const progress = Math.round(((a.index+1)/a.order.length)*100);
    const timePct = Math.max(0, Math.round((a.timeLeft/a.duration)*100));

    setView('exam');
    layout(`
      <section style="margin-top:20px" class="battle-layout">
        <div class="challenge-card">
          <div class="badges">
            <span class="pill" style="background:#102033;color:#fff">${safe(a.title)}</span>
            <span class="pill" style="background:#102033;color:#fff">ข้อ ${a.index+1}/${a.order.length}</span>
            <span class="pill" style="background:#102033;color:#fff">${progress}%</span>
          </div>
          ${q.context ? `<div class="context">${safe(q.context)}</div>` : ''}
          <div class="question">${safe(q.question)}</div>
          <div class="choices">
            ${q.choices.map((c,i)=>`<button class="choice ${answered && answered.selected===i ? 'correct' : ''}" data-choice="${i}" onclick="EAPHero.examAnswer(${i})">${String.fromCharCode(65+i)}. ${safe(c)}</button>`).join('')}
          </div>
          <div class="footer-actions">
            <button class="btn ghost" onclick="EAPHero.prevExam()" ${a.index<=0?'disabled':''}>Previous</button>
            <button class="btn primary" onclick="EAPHero.nextExam()">${a.index >= a.order.length-1 ? 'Review / Submit' : 'Next'}</button>
            <button class="btn warn" onclick="EAPHero.finishExamManual()">Submit Exam</button>
          </div>
        </div>
        <aside class="battle-hud">
          <div class="hud-card">
            <h3>${safe(a.title)}</h3>
            <p class="mini-note">No hints • No feedback during exam • Shuffled choices</p>
            <b>Timer</b>
            <div class="timerbar"><span id="examTimeFill" style="width:${timePct}%"></span></div>
            <p id="examTimeText">${fmtTime(a.timeLeft)}</p>
          </div>
          <div class="grid two">
            <div class="hud-card"><b>Answered</b><p>${a.answers.length}/${a.order.length}</p></div>
            <div class="hud-card"><b>Warnings</b><p>${a.warnings || 0}</p></div>
          </div>
          <div class="hud-card">
            <b>Source</b>
            <p class="mini-note">Session ${q.sourceSession || '-'} • ${safe(q.sourceSkill || '')}</p>
          </div>
        </aside>
      </section>
    `);
  }

  function examAnswer(choiceIndex){
    const a = state.active;
    if(!a || a.mode !== 'exam') return;
    const q = a.order[a.index];
    const existing = a.answers.findIndex(x => x.index === a.index);
    const record = {
      index:a.index,
      id:q.id,
      session:q.sourceSession || '',
      skill:q.sourceSkill || '',
      question:q.question,
      selected:choiceIndex,
      answer:q.answer,
      selectedText:q.choices[choiceIndex],
      answerText:q.choices[q.answer],
      correct:choiceIndex === q.answer
    };
    if(existing >= 0) a.answers[existing] = record;
    else a.answers.push(record);
    saveState();
    renderExamQuestion();
  }

  function prevExam(){
    const a = state.active;
    if(!a || a.mode !== 'exam') return;
    a.index = Math.max(0, a.index - 1);
    saveState();
    renderExamQuestion();
  }

  function nextExam(){
    const a = state.active;
    if(!a || a.mode !== 'exam') return;
    if(a.index >= a.order.length-1) return renderExamReview();
    a.index += 1;
    saveState();
    renderExamQuestion();
  }

  function renderExamReview(){
    const a = state.active;
    if(!a || a.mode !== 'exam') return renderExamPanel();
    const unanswered = a.order.length - a.answers.length;
    const rows = a.order.map((q,i)=>{
      const ans = a.answers.find(x=>x.index===i);
      return `<tr><td>${i+1}</td><td>S${q.sourceSession||'-'}</td><td>${safe(q.sourceSkill||'')}</td><td>${ans?'Answered':'-'}</td></tr>`;
    }).join('');
    layout(`
      <section class="panel" style="margin-top:20px">
        <h2>Review Before Submit</h2>
        <div class="grid three">
          <div class="stat"><b>${a.answers.length}/${a.order.length}</b><span>Answered</span></div>
          <div class="stat"><b>${unanswered}</b><span>Unanswered</span></div>
          <div class="stat"><b>${fmtTime(a.timeLeft)}</b><span>Time Left</span></div>
        </div>
        <div class="table-wrap" style="margin-top:14px"><table>
          <thead><tr><th>No.</th><th>Session</th><th>Skill</th><th>Status</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
        <div class="footer-actions">
          <button class="btn ghost" onclick="EAPHero.renderExamQuestion()">Back to Questions</button>
          <button class="btn warn" onclick="EAPHero.finishExamManual()">Submit Exam</button>
        </div>
      </section>
    `);
  }

  function finishExamManual(){
    if(confirm('ส่งข้อสอบตอนนี้ใช่ไหมคะ? หลังส่งแล้วจะบันทึกคะแนนทันที')){
      finishExam('submitted');
    }
  }

  function finishExam(reason){
    clearInterval(bossTimer);
    const a = state.active;
    if(!a || a.mode !== 'exam' || a.submitted) return;
    a.submitted = true;

    const total = a.order.length;
    const correct = a.answers.filter(x=>x.correct).length;
    const unanswered = total - a.answers.length;
    const percent = total ? Math.round((correct/total)*100) : 0;

    const bySession = {};
    a.order.forEach(q => {
      const sid = q.sourceSession || 'unknown';
      bySession[sid] = bySession[sid] || { total:0, correct:0 };
      bySession[sid].total += 1;
    });
    a.answers.forEach(ans => {
      const sid = ans.session || 'unknown';
      bySession[sid] = bySession[sid] || { total:0, correct:0 };
      if(ans.correct) bySession[sid].correct += 1;
    });

    const log = {
      student_id: state.profile.studentId || 'guest',
      player_name: state.profile.name || 'Guest',
      exam_type: a.examType,
      exam_title: a.title,
      exam_key: a.examKey,
      reason,
      total,
      answered:a.answers.length,
      unanswered,
      correct,
      percent,
      time_used:a.duration-a.timeLeft,
      warnings:a.warnings || 0,
      started_at:new Date(a.startedAt).toISOString(),
      submitted_at:new Date().toISOString(),
      bySession,
      answers:a.answers
    };
    state.examLogs.push(log);
    updateRecentQuestions(a.examKey, a.order.map(q=>q.id));
    addXP(Math.max(0, Math.round(percent/2)));
    saveState();

    try{
      if(document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(()=>{});
    }catch(e){}

    renderExamResult(log);
  }

  function renderExamResult(log){
    const byRows = Object.keys(log.bySession).sort((a,b)=>Number(a)-Number(b)).map(sid=>{
      const x = log.bySession[sid];
      const pct = x.total ? Math.round((x.correct/x.total)*100) : 0;
      const ss = getSession(sid);
      return `<tr><td>S${sid}</td><td>${safe(ss?.skill || '')}</td><td>${x.correct}/${x.total}</td><td>${pct}%</td></tr>`;
    }).join('');

    layout(`
      <section class="panel light result-hero" style="margin-top:20px">
        <div class="big-emoji">📝</div>
        <h2>${safe(log.exam_title)} Submitted</h2>
        <div class="grid four">
          <div class="stat"><b>${log.correct}/${log.total}</b><span>Correct</span></div>
          <div class="stat"><b>${log.percent}%</b><span>Score</span></div>
          <div class="stat"><b>${fmtTime(log.time_used)}</b><span>Time Used</span></div>
          <div class="stat"><b>${log.warnings}</b><span>Warnings</span></div>
        </div>
        <h3 style="margin-top:20px">Breakdown by Session</h3>
        <div class="table-wrap"><table>
          <thead><tr><th>Session</th><th>Skill</th><th>Correct</th><th>Percent</th></tr></thead>
          <tbody>${byRows}</tbody>
        </table></div>
        <div class="footer-actions" style="justify-content:center">
          <button class="btn primary" onclick="EAPHero.examPanel()">Exam Panel</button>
          <button class="btn" onclick="EAPHero.dashboard()">Teacher Dashboard</button>
          <button class="btn ghost" onclick="EAPHero.map()">Map</button>
        </div>
      </section>
    `);
  }

  document.addEventListener('visibilitychange', () => {
    const a = state.active;
    if(document.hidden && a && a.mode === 'exam'){
      a.warnings = (a.warnings || 0) + 1;
      saveState();
    }
  });


  function renderDashboard(){
    setView('dashboard');
    const completed = SESSIONS.filter(s => state.sessions[s.id]?.cleared).length;
    const avgAcc = state.logs.length ? Math.round(state.logs.reduce((a,b)=>a+(b.accuracy||0),0)/state.logs.length) : 0;
    const avgAttempts = state.logs.length ? (state.logs.length / Math.max(1, completed)).toFixed(1) : '0';
    const rows = SESSIONS.map(s=>{
      const p = state.sessions[s.id] || {};
      return `<tr>
        <td>${s.id}</td><td>${safe(s.boss)}</td><td>${safe(s.skill)}</td><td>${s.questions.length}</td>
        <td>${p.cleared?'Cleared':'-'}</td><td>${stars(p.bestStars||0)}</td>
        <td>${p.bestAccuracy||0}%</td><td>${p.attempts||0}</td>
      </tr>`;
    }).join('');
    const logs = state.logs.slice(-12).reverse().map(l=>`<tr>
      <td>${safe(l.player_name)}</td><td>S${l.session}</td><td>${safe(l.boss)}</td>
      <td>${l.win?'Win':'Retry'}</td><td>${l.accuracy}%</td><td>${l.stars}</td><td>${l.max_combo}</td><td>${new Date(l.completed_at).toLocaleString()}</td>
    </tr>`).join('');

    layout(`
      <section class="panel" style="margin-top:20px">
        <h2>Teacher Dashboard</h2>
        <div class="grid four">
          <div class="stat"><b>${completed}/15</b><span>Completion</span></div>
          <div class="stat"><b>${avgAcc}%</b><span>Average Accuracy</span></div>
          <div class="stat"><b>${avgAttempts}</b><span>Avg Attempts / Cleared Session</span></div>
          <div class="stat"><b>${state.xp}</b><span>Total XP</span></div>
          <div class="stat"><b>${state.fun?.coins || 0}</b><span>Fun Coins</span></div>
        </div>
        <h3 style="margin-top:20px">Session Progress</h3>
        <div class="table-wrap"><table>
          <thead><tr><th>S</th><th>Boss</th><th>Skill</th><th>Questions</th><th>Status</th><th>Stars</th><th>Best Acc.</th><th>Attempts</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
        <h3 style="margin-top:20px">Recent Logs</h3>
        <div class="table-wrap"><table>
          <thead><tr><th>Player</th><th>Session</th><th>Boss</th><th>Result</th><th>Accuracy</th><th>Stars</th><th>Combo</th><th>Time</th></tr></thead>
          <tbody>${logs || '<tr><td colspan="8">No logs yet</td></tr>'}</tbody>
        </table></div>

        <h3 style="margin-top:20px">Exam Logs</h3>
        <div class="table-wrap"><table>
          <thead><tr><th>Player</th><th>Exam</th><th>Score</th><th>Correct</th><th>Unanswered</th><th>Warnings</th><th>Submitted</th></tr></thead>
          <tbody>${examLogRows()}</tbody>
        </table></div>

        <div class="footer-actions">
          <button class="btn primary" onclick="EAPHero.exportCSV()">Export Game CSV</button>
          <button class="btn warn" onclick="EAPHero.exportExamCSV()">Export Exam CSV</button>
          <button class="btn ghost" onclick="EAPHero.map()">Map</button>
        </div>
      </section>
    `);
  }


  function examLogRows(){
    const rows = (state.examLogs || []).slice(-20).reverse().map(l=>`<tr>
      <td>${safe(l.player_name)}</td><td>${safe(l.exam_title)}</td><td>${l.percent}%</td>
      <td>${l.correct}/${l.total}</td><td>${l.unanswered}</td><td>${l.warnings}</td>
      <td>${new Date(l.submitted_at).toLocaleString()}</td>
    </tr>`).join('');
    return rows || '<tr><td colspan="7">No exam logs yet</td></tr>';
  }

  function exportExamCSV(){
    const header = ['student_id','player_name','exam_type','exam_title','exam_key','percent','correct','total','answered','unanswered','time_used','warnings','started_at','submitted_at'];
    const rows = (state.examLogs || []).map(l=> header.map(h=>csvCell(l[h])).join(','));
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'eap-hero-exam-logs.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportCSV(){
    const header = ['student_id','player_name','session','boss','attempt','win','score','xp','accuracy','time_used','max_combo','stars','used_hints','completed_at'];
    const rows = state.logs.map(l=> header.map(h=>csvCell(l[h])).join(','));
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'eap-hero-logs.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
  function csvCell(v){
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  }

  function useHint(){
    const a = state.active;
    if(!a || a.mode !== 'boss') return;
    if(getContract(a.contract || 'normal').noHint){
      const fb = document.getElementById('feedback');
      if(fb){
        fb.className = 'feedback show bad';
        fb.textContent = 'No Hint Contract: ใช้ Hint ไม่ได้ในรอบนี้';
      }
      return;
    }
    a.usedHints += 1;
    a.score = Math.max(0, a.score - 2);
    const q = a.order[a.index];
    const fb = document.getElementById('feedback');
    if(fb){
      fb.className = 'feedback show info';
      fb.textContent = 'Hint: ' + q.feedback;
    }
    saveState();
  }

  function freezeTime(){
    const a = state.active;
    if(!a || a.mode !== 'boss') return;
    a.timeLeft += 5;
    a.score = Math.max(0, a.score - 3);
    updateHUD();
    saveState();
  }

  function fmtTime(sec){
    const m = Math.floor(sec/60);
    const s = sec%60;
    return `${m}:${String(s).padStart(2,'0')}`;
  }

  function shuffle(arr){
    for(let i=arr.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [arr[i],arr[j]] = [arr[j],arr[i]];
    }
    return arr;
  }

  // public API for inline handlers
  window.EAPHero = {
    home:renderHome,
    profile:renderProfile,
    saveProfile,
    map:renderMap,
    sessionBrief:renderSessionBrief,
    startLab:renderLab,
    practice:startPractice,
    nextPractice,
    answer,
    startBoss,
    useHint,
    freezeTime,
    reviewMistakes:renderMistakes,
    reflection:renderReflection,
    saveReflection,
    gallery:renderGallery,
    funHub:renderFunHub,
    claimAchievement,
    contract:renderContract,
    dashboard:renderDashboard,
    examPanel:renderExamPanel,
    startExam,
    examAnswer,
    prevExam,
    nextExam,
    renderExamQuestion,
    finishExamManual,
    exportExamCSV,
    exportCSV,
    reset:resetState
  };

  renderHome();

})();
