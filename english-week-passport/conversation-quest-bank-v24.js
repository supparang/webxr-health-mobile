(function(){
'use strict';
const DIALOGUE_POOLS=[
 [
  {line:'Good morning! How are you today?',choices:['I’m fine, thank you.','Good night.','The library is blue.'],answer:0,reply:'Great! I’m glad to hear that.',keywords:['fine','thank']},
  {line:'Hello! Are you ready for English Week?',choices:['Yes, I’m ready.','The week is under the chair.','No, I was a sandwich.'],answer:0,reply:'Excellent! Let’s begin.',keywords:['yes','ready']},
  {line:'Hi! Did you have a good morning?',choices:['Yes, it was great.','Tomorrow is purple.','I am at the pencil.'],answer:0,reply:'I’m happy to hear that.',keywords:['yes','great']},
  {line:'Welcome! How do you feel today?',choices:['I feel excited.','I feel at the library.','Yesterday feels blue.'],answer:0,reply:'Wonderful! Keep that energy.',keywords:['feel','excited']}
 ],
 [
  {line:'Can you help me prepare for English Week?',choices:['Yes, of course.','I helped yesterday tomorrow.','No, I am a sandwich.'],answer:0,reply:'Thank you. That is very helpful.',keywords:['yes','course']},
  {line:'Could you help decorate this classroom?',choices:['Sure, I can help.','The classroom eats lunch.','I decorated next year.'],answer:0,reply:'Thank you! The room will look great.',keywords:['sure','help']},
  {line:'Would you like to join the welcome team?',choices:['Yes, I’d love to.','The team is sleeping yesterday.','I welcome a blue table.'],answer:0,reply:'Fantastic! We need your help.',keywords:['yes','love']},
  {line:'Can you check the activity list for me?',choices:['Certainly. I’ll check it.','The list checks breakfast.','I checked it tomorrow.'],answer:0,reply:'Thanks. That will save us time.',keywords:['check']}
 ],
 [
  {line:'Please take these name tags to the registration desk.',choices:['Sure. I’ll take them now.','The desk is eating lunch.','I took a bus next year.'],answer:0,reply:'Excellent. The visitors will need them.',keywords:['sure','take','now']},
  {line:'Please put these posters near the entrance.',choices:['Okay. I’ll put them there.','The entrance is drinking water.','I put them last tomorrow.'],answer:0,reply:'Perfect. Everyone will see them.',keywords:['put','there']},
  {line:'Please give these pencils to the participants.',choices:['All right. I’ll give them out.','The pencils are participants.','I gave them next week yesterday.'],answer:0,reply:'Great. They are ready for the activity.',keywords:['give']},
  {line:'Please bring the score sheets to the judges.',choices:['No problem. I’ll bring them.','The judges bring a window.','I brought them tomorrow morning.'],answer:0,reply:'Thank you. The judges are waiting.',keywords:['bring']}
 ],
 [
  {line:'A visitor cannot find the activity room. What should you say?',choices:['I can show you the way.','You should disappear.','The room is a pencil.'],answer:0,reply:'That is a polite and useful response.',keywords:['show','way']},
  {line:'A guest asks where the library is. What should you say?',choices:['Go straight and turn left.','The library is hungry.','Turn yesterday after blue.'],answer:0,reply:'Clear directions! The guest can find it.',keywords:['straight','left']},
  {line:'A student is looking for the registration desk. What should you say?',choices:['It’s next to the main entrance.','The desk is next to breakfast.','It entered the student tomorrow.'],answer:0,reply:'Good! That location is easy to understand.',keywords:['next','entrance']},
  {line:'A visitor needs the restroom. What should you say?',choices:['It’s on the second floor.','The restroom is doing homework.','It was on next morning.'],answer:0,reply:'Helpful and polite. Well done.',keywords:['second','floor']}
 ],
 [
  {line:'Thank you for helping today!',choices:['You’re welcome.','I don’t know yesterday.','Please close the breakfast.'],answer:0,reply:'Wonderful work. You completed the conversation!',keywords:['welcome']},
  {line:'Thanks for showing me the way.',choices:['My pleasure.','The way is breakfast.','I showed tomorrow yesterday.'],answer:0,reply:'Excellent polite closing!',keywords:['pleasure']},
  {line:'Thank you for your support.',choices:['I’m happy to help.','Support is under lunch.','I help last tomorrow.'],answer:0,reply:'Great response. Mission complete!',keywords:['happy','help']},
  {line:'That was very helpful. Thank you!',choices:['No problem at all.','The problem is very table.','I thanked you next year.'],answer:0,reply:'Well done! You finished the conversation.',keywords:['problem']}
 ]
];
function hash32(text){let h=2166136261;for(const ch of String(text)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function mulberry32(seed){return function(){let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
const PARAMS=new URLSearchParams(location.search);
const PID=PARAMS.get('pid')||localStorage.getItem('pid')||sessionStorage.getItem('cqGuestId')||(()=>{const id='guest-'+Math.random().toString(36).slice(2,9);sessionStorage.setItem('cqGuestId',id);return id})();
const RUN=PARAMS.get('run')||'1';
const SEED_SOURCE=`${PID}|${RUN}|conversation-v24`;
const SEED=hash32(SEED_SOURCE),RNG=mulberry32(SEED);
const MISSION_SET='CQ-'+SEED.toString(16).toUpperCase().padStart(8,'0').slice(-8);
const DIALOGUES=DIALOGUE_POOLS.map(pool=>pool[Math.floor(RNG()*pool.length)]);
window.CQ_V24_CONFIG={PID,RUN,SEED,MISSION_SET,DIALOGUES,RNG};
})();
