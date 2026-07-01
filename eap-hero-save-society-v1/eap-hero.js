/* === EAP Hero: Save the Society v1z92 Report Recovery + Safe Legacy Portfolio Migration ===
   Standalone PC/Mobile web prototype.
   Upload index.html, eap-hero.css, eap-hero.js to GitHub Pages folder.
*/
(function(){
  'use strict';

  const STORAGE_KEY = 'EAP_HERO_PROGRESS_V3';
  const PREVIOUS_STORAGE_KEY = 'EAP_HERO_SAVE_SOCIETY_V2_COMPACT';
  const LEGACY_STORAGE_KEY = 'EAP_HERO_SAVE_SOCIETY_V1';
  const APP_VERSION = '20260701-v1z128-raw-evidence';
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
      id:8, emoji:'🐍', title:'Paragraph Structure Lab', zone:'Writing Studio',
      skill:'Academic Paragraph Structure', boss:'Structure Maze Warden',
      problem:'เมื่อย่อหน้าไม่มีโครงสร้าง ผู้อ่านจะตามเหตุผลและหลักฐานไม่ทัน',
      taunt:'I will mix your topic, support, example, and conclusion!',
      unlock:'Paragraph Map + Structure Builder Badge',
      lab:[
        'ย่อหน้าเชิงวิชาการมีแกน T–E–E–C: Topic Sentence → Explanation → Evidence/Example → Closing Sentence',
        'Unity หมายถึงทุกประโยคต้องสนับสนุนประเด็นเดียว; Coherence คือการเรียงเหตุผลให้ไหล; Cohesion คือการใช้คำเชื่อมให้ชัด',
        'คำเชื่อมพื้นฐานที่ใช้บ่อย: for example, in addition, however, therefore, in conclusion'
      ],
      questions:[
        mcq('S08_Q1','Which sentence is the best topic sentence?','Topic: Digital literacy for university students',[
          'Students use online sources for assignments.',
          'Digital literacy helps university students use online information responsibly.',
          'For example, students can check the author of a website.',
          'Therefore, students need to read carefully.'
        ],1,'A topic sentence states the main point of the paragraph.'),
        mcq('S08_Q2','What should usually come after a topic sentence?','',[
          'A supporting explanation that develops the main point',
          'A completely new topic',
          'A greeting to the reader',
          'A list of unrelated examples'
        ],0,'A supporting explanation develops the topic sentence.'),
        mcq('S08_Q3','Which sentence does NOT belong in a paragraph about academic email?','',[
          'A clear subject line helps the reader understand the purpose.',
          'A polite greeting creates a respectful tone.',
          'Graphs can show trends in student performance.',
          'A specific request helps the instructor respond.'
        ],2,'Graphs are not relevant to a paragraph about academic email.'),
        mcq('S08_Q4','Choose the best order for a short academic paragraph.','',[
          'Example → Topic sentence → Conclusion → Unrelated detail',
          'Topic sentence → Supporting explanation → Example/Evidence → Closing sentence',
          'Conclusion → Greeting → Topic sentence → Example',
          'Evidence → New topic → Random detail → Closing'
        ],1,'This order follows T–E–E–C.'),
        mcq('S08_Q5','Which connector introduces an example?','',[
          'however',
          'therefore',
          'for example',
          'in conclusion'
        ],2,'For example introduces supporting evidence or an illustration.'),
        mcq('S08_Q6','Which sentence works best as a closing sentence?','Topic: Peer feedback improves writing',[
          'Peers are students in the same class.',
          'For example, classmates can notice unclear ideas.',
          'Peer feedback can therefore help writers revise more clearly.',
          'Some students write paragraphs at home.'
        ],2,'A closing sentence links back to the main point.'),
        mcq('S08_Q7','Why is unity important in a paragraph?','',[
          'It helps every sentence support one main idea.',
          'It makes every sentence the same length.',
          'It removes all examples.',
          'It allows several unrelated topics in one paragraph.'
        ],0,'Unity keeps the paragraph focused on one clear idea.')
      ],
      reflection:'Which part of T–E–E–C do you need to practise most, and why?'
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