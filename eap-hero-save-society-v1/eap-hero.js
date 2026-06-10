/* === EAP Hero: Save the Society v1 ===
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
          'I want to be good.',
          'I want to improve my academic reading and presentation skills.',
          'English is hard.',
          'I do not like homework.'
        ],1,'This goal is clear and academic.'),
        mcq('S01_Q2','Which skill is related to EAP?','',[
          'Reading research articles',
          'Only chatting with friends',
          'Playing games without learning',
          'Avoiding homework'
        ],0,'Reading academic texts is a core EAP skill.'),
        mcq('S01_Q3','Choose the most academic sentence.','',[
          'I wanna talk about stuff.',
          'Today, I would like to present my academic goal.',
          'This is super cool.',
          'Teacher, I don’t know.'
        ],1,'This sentence uses a polite academic presentation style.'),
        mcq('S01_Q4','Why is EAP useful for university students?','',[
          'It helps students avoid all assignments.',
          'It supports reading, writing, and presenting in academic contexts.',
          'It is only for native speakers.',
          'It replaces all other subjects.'
        ],1,'EAP supports academic communication.'),
        mcq('S01_Q5','Which phrase can start an academic self-profile?','',[
          'My academic goal is...',
          'Whatever...',
          'I hate this.',
          'Very very good.'
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
          'sleep','analyze','color','forget'
        ],1,'Analyze means to examine or study carefully.'),
        mcq('S02_Q2','Which word means “หลักฐาน”?','',[
          'method','evidence','conclusion','however'
        ],1,'Evidence means information that supports a claim.'),
        mcq('S02_Q3','Which connector shows contrast?','',[
          'therefore','because','however','for example'
        ],2,'However shows contrast.'),
        mcq('S02_Q4','The final part of an academic text is often called the ______.','',[
          'conclusion','noise','lunch','picture'
        ],0,'Conclusion is the final part that summarizes key points.'),
        mcq('S02_Q5','Which word is closest to “important” in academic writing?','',[
          'funny','significant','lazy','random'
        ],1,'Significant means important or meaningful.'),
        mcq('S02_Q6','The ______ explains how the study was conducted.','',[
          'method','snack','opinion','emotion'
        ],0,'Method explains the process or procedure.'),
        mcq('S02_Q7','Choose the best academic connector: “The data were incomplete; ______, the result should be interpreted carefully.”','',[
          'therefore','wow','very','stuff'
        ],0,'Therefore shows a result or consequence.'),
        mcq('S02_Q8','Which pair is correct?','',[
          'evidence = หลักฐาน',
          'method = ข่าวลือ',
          'result = คำถาม',
          'conclusion = อาหาร'
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
          'Videos are fun for students.',
          'Students should always study online only.'
        ],1,'This summary is shorter and keeps the main idea.'),
        mcq('S06_Q2','Which summary problem is shown here?','Original: AI can support writing when students use it responsibly. Summary: AI is always perfect for writing.',[
          'Good summary',
          'Changed meaning',
          'Proper citation',
          'Clear evidence'
        ],1,'The summary changes the original meaning.'),
        mcq('S06_Q3','A good summary should ______.','',[
          'copy every sentence',
          'include only personal opinion',
          'keep the main idea in fewer words',
          'be longer than the original'
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
          'Students have semesters.',
          'Sleep is the only benefit of exercise.'
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
          'AI is very very good for students.',
          'Artificial intelligence can support students’ learning processes.',
          'AI is the best thing ever.',
          'Students like AI so much.'
        ],1,'This sentence is formal and balanced.'),
        mcq('S07_Q2','Choose the academic version.','Informal: This thing is bad for students.',[
          'This issue may have negative effects on students.',
          'This thing is really bad.',
          'Students hate this thing.',
          'It is super bad.'
        ],0,'This sentence uses academic and precise language.'),
        mcq('S07_Q3','Which word is more academic?','',[
          'kids','children','stuff','kinda'
        ],1,'Children is more formal than kids.'),
        mcq('S07_Q4','Choose the academic version.','Informal: A lot of students use phones in class.',[
          'Many students use mobile phones in class.',
          'Loads of students use phones.',
          'Students use phones and stuff.',
          'Phones are everywhere.'
        ],0,'Many is more academic than a lot of.'),
        mcq('S07_Q5','Choose the academic version.','Informal: The result was really bad.',[
          'The result was bad bad.',
          'The result indicated a negative outcome.',
          'The result was super terrible.',
          'The result was not cool.'
        ],1,'This version is formal and precise.'),
        mcq('S07_Q6','Which sentence has the best academic tone?','',[
          'This app is cool.',
          'This application may support independent learning.',
          'This app rocks.',
          'This is awesome.'
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
          'Evidence','Noise','Casual','Spider'
        ],0,'Evidence means หลักฐาน.'),
        mcq('S08_Q2','Choose the main idea.','Digital tools can help students learn independently through videos, quizzes, and feedback.',[
          'Videos are online.',
          'Digital tools support independent learning.',
          'Students like quizzes.',
          'Feedback is short.'
        ],1,'This captures the paragraph.'),
        mcq('S08_Q3','Choose the academic version.','Informal: This is super good.',[
          'This is very very good.',
          'This may provide important benefits.',
          'This is cool.',
          'Good stuff.'
        ],1,'This is formal and cautious.'),
        mcq('S08_Q4','A summary should ______.','',[
          'be shorter than the original',
          'copy all sentences',
          'add personal feelings',
          'ignore the main idea'
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
        'Academic paragraph ที่ดีมักมี Topic Sentence, Supporting Details, Example/Evidence และ Concluding Sentence',
        'Topic sentence บอกประเด็นหลักของย่อหน้า',
        'Supporting details และ evidence ทำให้ประเด็นน่าเชื่อถือ'
      ],
      questions:[
        mcq('S09_Q1','Which sentence is the best topic sentence?','Topic: Online learning',[
          'Videos are sometimes short.',
          'Online learning can support flexible study for university students.',
          'Some students have phones.',
          'Teachers use websites.'
        ],1,'This states the main point of the paragraph.'),
        mcq('S09_Q2','What should usually come after a topic sentence?','',[
          'Unrelated joke',
          'Supporting detail',
          'Reference list only',
          'Random opinion'
        ],1,'Supporting details develop the topic sentence.'),
        mcq('S09_Q3','Which is a concluding sentence?','',[
          'For example, students can watch videos.',
          'In conclusion, digital tools can improve learning when used appropriately.',
          'Because students are busy',
          'The survey had 100 students'
        ],1,'In conclusion signals the closing idea.'),
        mcq('S09_Q4','Choose the best supporting detail for: “Exercise benefits students.”','',[
          'Many studies suggest that exercise can reduce stress.',
          'Students wear shoes.',
          'Classrooms have chairs.',
          'Exercise is a word.'
        ],0,'This detail supports the topic.'),
        mcq('S09_Q5','Which paragraph part gives the main point?','',[
          'Topic sentence',
          'Font size',
          'Page number',
          'Emoji'
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
          'AI tool use decreased.',
          'AI tool use increased from 2023 to 2025.',
          'AI tool use remained stable.',
          'AI tools disappeared.'
        ],1,'The data show an increase.'),
        mcq('S10_Q2','Which word means “คงที่”?','',[
          'increase','decrease','remain stable','fall'
        ],2,'Remain stable means stay the same.'),
        mcq('S10_Q3','Data: 80, 70, 60. Which trend is shown?','',[
          'increase','decrease','remain stable','no data'
        ],1,'The numbers go down.'),
        mcq('S10_Q4','Choose the academic sentence.','Data: 45% of students preferred online quizzes.',[
          'Online quizzes are awesome.',
          'The data show that 45% of students preferred online quizzes.',
          'Everyone loves quizzes.',
          'Quizzes win.'
        ],1,'This sentence accurately reports the data.'),
        mcq('S10_Q5','Which word shows a large change?','',[
          'significantly','randomly','maybe','stuff'
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
          'Hey teacher, I need more time.',
          'Dear Dr. Smith, I am writing to request an extension for the assignment.',
          'Give me time.',
          'I cannot do it.'
        ],1,'This opening is polite and clear.'),
        mcq('S11_Q2','Which subject line is best?','',[
          'Help!!!',
          'Request for Assignment Extension',
          'I have problem',
          'Read this now'
        ],1,'This subject is clear and formal.'),
        mcq('S11_Q3','Choose the best closing.','',[
          'Bye.',
          'Thank you for your consideration.',
          'Answer me quickly.',
          'Whatever.'
        ],1,'This closing is polite.'),
        mcq('S11_Q4','Which phrase is most polite?','',[
          'You must meet me.',
          'I would like to request an appointment.',
          'Meet me now.',
          'I want you.'
        ],1,'This is a polite request.'),
        mcq('S11_Q5','What should an academic email include?','',[
          'A clear purpose',
          'Only emojis',
          'No subject',
          'Angry words'
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
          'AI is good for writing.',
          'AI tools may support students’ writing development when used responsibly (Author, Year).',
          'AI tools support writing.'
        ],2,'This paraphrases and includes a citation placeholder.'),
        mcq('S12_Q2','Which action is plagiarism?','',[
          'Paraphrasing with citation',
          'Copying a paragraph without citation',
          'Summarizing with reference',
          'Quoting with quotation marks and citation'
        ],1,'Copying without citation is plagiarism.'),
        mcq('S12_Q3','A paraphrase should ______.','',[
          'use your own words and cite the source',
          'copy every word',
          'remove the source',
          'change only one word'
        ],0,'A paraphrase still needs citation.'),
        mcq('S12_Q4','Which is ethical AI use?','',[
          'Submit AI output without reading it',
          'Use AI to support drafting, then review, edit, and declare use if required',
          'Copy AI answer as your own research',
          'Invent sources'
        ],1,'Responsible AI use includes review and transparency.'),
        mcq('S12_Q5','Which item is needed in academic citation?','',[
          'Source information',
          'Only emojis',
          'Random title',
          'Nothing'
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
          'Food and health',
          'Sports events',
          'Music performance'
        ],0,'The lecture focuses on digital literacy.'),
        mcq('S13_Q2','Which keyword is important?','Transcript: First, students should check the source of information before sharing it online.',[
          'source','sharing','online','check the source'
        ],3,'Check the source is the key action.'),
        mcq('S13_Q3','Which signal word shows order?','Transcript: First, I will explain the problem. Next, I will discuss possible solutions.',[
          'first','problem','possible','solutions'
        ],0,'First signals order.'),
        mcq('S13_Q4','What should you note while listening?','',[
          'Every single word',
          'Only keywords and main points',
          'Only the speaker’s clothes',
          'Nothing'
        ],1,'Good note-taking focuses on keywords and main points.'),
        mcq('S13_Q5','What does “in conclusion” signal?','',[
          'Beginning',
          'Example',
          'Ending or summary',
          'Cause'
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
          'Hi, stuff today.',
          'Today, I would like to present my topic on digital literacy.',
          'I don’t know what to say.',
          'Let’s finish fast.'
        ],1,'This opening is clear and academic.'),
        mcq('S14_Q2','Which phrase introduces the next point?','',[
          'Next, I will discuss...',
          'Bye now.',
          'Whatever.',
          'No idea.'
        ],0,'Next signals the next point.'),
        mcq('S14_Q3','Choose the best Q&A response.','Question: Can you explain your evidence?',[
          'No.',
          'Thank you for your question. The evidence comes from the survey results.',
          'Why ask?',
          'I don’t care.'
        ],1,'This response is polite and informative.'),
        mcq('S14_Q4','Which phrase closes a presentation?','',[
          'In conclusion, this issue requires further attention.',
          'Start now.',
          'Randomly speaking.',
          'I forgot.'
        ],0,'In conclusion signals closing.'),
        mcq('S14_Q5','What should a presentation outline do?','',[
          'Tell the audience the structure of the talk',
          'Hide the topic',
          'Confuse the audience',
          'Replace all evidence'
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
        'เลือกปัญหาสังคม 1 เรื่อง และนำเสนอ Problem → Cause → Evidence → Solution → Conclusion',
        'เป้าหมายคือใช้ Academic English เพื่อเสนอทางออกอย่างมีเหตุผล'
      ],
      questions:[
        mcq('S15_Q1','Which structure is best for the final presentation?','',[
          'Problem → Cause → Evidence → Solution → Conclusion',
          'Joke → Random idea → End',
          'Only opinion → No evidence',
          'Title only'
        ],0,'This structure is clear and academic.'),
        mcq('S15_Q2','Which topic is suitable for the final mission?','',[
          'Fake news and digital literacy',
          'My favorite snack only',
          'Nothing',
          'A random emoji'
        ],0,'This is a social issue that can be discussed academically.'),
        mcq('S15_Q3','Which sentence uses evidence?','',[
          'I think it is bad.',
          'A survey of 200 students found that 62% had seen fake news online.',
          'Everyone knows this.',
          'It is super bad.'
        ],1,'This sentence uses data as evidence.'),
        mcq('S15_Q4','Choose the most academic solution sentence.','',[
          'People should just stop.',
          'Universities should provide digital literacy training to help students evaluate online information.',
          'This is bad stuff.',
          'No one can fix it.'
        ],1,'This solution is specific and academic.'),
        mcq('S15_Q5','Which final rank is earned by saving society?','',[
          'Society Saver',
          'Noise Maker',
          'Copy King',
          'Lazy Goblin'
        ],0,'Society Saver is the final heroic rank.')
      ],
      reflection:'What social problem would you like to solve using academic English?'
    }
  ];

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
      settings:{ difficulty:'normal' },
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
            <button class="btn ghost small" onclick="EAPHero.dashboard()">📊 Teacher</button>
          </div>
        </div>
        ${content}
      </div>
    `;
  }

  function renderHome(){
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
      order:shuffle([...s.questions]).slice(0, Math.min(3, s.questions.length)),
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
          <button class="btn primary" onclick="EAPHero.startBoss(${s.id})">Start Boss Battle</button>
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

  function startBoss(id){
    const s = getSession(id);
    clearInterval(bossTimer);
    const seconds = difficultySeconds();
    state.active = {
      mode:'boss',
      sessionId:id,
      startedAt:Date.now(),
      duration:seconds,
      timeLeft:seconds,
      bossHpMax:90,
      bossHp:90,
      hearts:3,
      combo:0,
      maxCombo:0,
      score:0,
      index:0,
      order:shuffle([...s.questions]),
      answers:[],
      correct:0,
      usedHints:0,
      rage:false
    };
    saveState();
    renderBossQuestion();
    bossTimer = setInterval(tickBoss, 1000);
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
    let q = a.order[a.index % a.order.length];
    if(!q) return finishBoss(false, 'ไม่มีข้อคำถาม');
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
    const q = a.order[a.index % a.order.length];

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
    const xpGain = win ? Math.round(60 + a.score + starsEarned*25 + (a.timeLeft/4)) : Math.round(20 + a.correct*5);
    const badge = win ? badgeForSession(s.id) : null;

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
      win, reason, sessionId:s.id, xpGain, starsEarned, accuracy:Math.round(accuracy*100),
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
        <div class="footer-actions" style="justify-content:center">
          ${r.mistakes.length ? `<button class="btn warn" onclick="EAPHero.reviewMistakes()">Review Mistakes (${r.mistakes.length})</button>` : ''}
          <button class="btn primary" onclick="EAPHero.reflection(${s.id})">Reflection</button>
          <button class="btn" onclick="EAPHero.startBoss(${s.id})">Rematch</button>
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
          <button class="btn primary" onclick="EAPHero.startBoss(${s.id})">Replay Boss</button>
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

  function renderDashboard(){
    setView('dashboard');
    const completed = SESSIONS.filter(s => state.sessions[s.id]?.cleared).length;
    const avgAcc = state.logs.length ? Math.round(state.logs.reduce((a,b)=>a+(b.accuracy||0),0)/state.logs.length) : 0;
    const avgAttempts = state.logs.length ? (state.logs.length / Math.max(1, completed)).toFixed(1) : '0';
    const rows = SESSIONS.map(s=>{
      const p = state.sessions[s.id] || {};
      return `<tr>
        <td>${s.id}</td><td>${safe(s.boss)}</td><td>${safe(s.skill)}</td>
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
        </div>
        <h3 style="margin-top:20px">Session Progress</h3>
        <div class="table-wrap"><table>
          <thead><tr><th>S</th><th>Boss</th><th>Skill</th><th>Status</th><th>Stars</th><th>Best Acc.</th><th>Attempts</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
        <h3 style="margin-top:20px">Recent Logs</h3>
        <div class="table-wrap"><table>
          <thead><tr><th>Player</th><th>Session</th><th>Boss</th><th>Result</th><th>Accuracy</th><th>Stars</th><th>Combo</th><th>Time</th></tr></thead>
          <tbody>${logs || '<tr><td colspan="8">No logs yet</td></tr>'}</tbody>
        </table></div>
        <div class="footer-actions">
          <button class="btn primary" onclick="EAPHero.exportCSV()">Export CSV</button>
          <button class="btn ghost" onclick="EAPHero.map()">Map</button>
        </div>
      </section>
    `);
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
    a.usedHints += 1;
    a.score = Math.max(0, a.score - 2);
    const q = a.order[a.index % a.order.length];
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
    dashboard:renderDashboard,
    exportCSV,
    reset:resetState
  };

  renderHome();

})();
