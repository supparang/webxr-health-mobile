import {test} from "node:test";
import assert from "node:assert/strict";
import {createGameFromThai} from "../js/thai-game-planner.js";
import {validateGame,AGE_LEVELS} from "../js/game-schema.js";
import {detectQuizTopic,getQuizQuestions} from "../js/quiz-bank.js";
test("detect all four game types",()=>{
 const prompts=[["adventure","สร้างเกมกระต่ายผจญภัย"],["maze","สร้างเกมเขาวงกต"],["quiz","เกมตอบคำถามวิทยาศาสตร์"],["dodge","ยานอวกาศหลบอุกกาบาต"]];
 for(const [type,prompt] of prompts)assert.equal(createGameFromThai(prompt).type,type);
});
test("age presets produce increasing difficulty",()=>{
 const values=AGE_LEVELS.map(age=>createGameFromThai("เกมกระต่าย",age).rules.difficulty);
 assert.deepEqual(values,[1,2,3,4]);
});
test("Thai score goal is parsed",()=>{
 assert.equal(createGameFromThai("เกมหลบสิ่งกีดขวาง เก็บคะแนน 10 คะแนน").rules.targetScore,10);
 assert.equal(createGameFromThai("เกมหลบสิ่งกีดขวาง ทำ 7 คะแนน").rules.targetScore,7);
});
test("invalid input rejected",()=>{
 assert.throws(()=>createGameFromThai(""),/กรุณา/);
 assert.throws(()=>createGameFromThai("เกม", "bad"),/ระดับชั้น/);
 assert.throws(()=>validateGame({type:"unknown",ageLevel:"p4"}),/ประเภทเกม/);
});
test("numeric limits are enforced",()=>{
 const game=validateGame({type:"dodge",ageLevel:"p1",player:{lives:999},rules:{levels:-20,targetScore:999}});
 assert.equal(game.player.lives,10);assert.equal(game.rules.levels,1);assert.equal(game.rules.targetScore,100);
});
test("quiz bank has valid answer keys and explanations",()=>{
 for(const topic of ["science","math","general"]){
  const questions=getQuizQuestions(topic,"p4",6);
  assert.equal(questions.length,6);
  for(const q of questions){assert.equal(q.a.length,4);assert.ok(q.correct>=0&&q.correct<4);assert.ok(q.why);}
 }
 assert.equal(detectQuizTopic("ตอบคำถามวิทยาศาสตร์"),"science");
});
test("freeform advanced Thai prompt parses physics, items, and custom quiz questions",()=>{
 const adv=createGameFromThai("สร้างเกมหุ่นยนต์ผจญภัยในอวกาศ เก็บอัญมณี 25 ชิ้น มี 2 ชีวิต 4 ด่าน ศัตรู 5 ตัว เวลา 45 วินาที แรงโน้มถ่วงต่ำ กระโดดสูง วิ่งเร็ว เอาชีวิตรอด","m4");
 assert.equal(adv.type,"adventure");
 assert.equal(adv.theme,"space");
 assert.equal(adv.player.name,"หุ่นยนต์");
 assert.equal(adv.rules.itemType,"gem");
 assert.equal(adv.rules.targetScore,25);
 assert.equal(adv.rules.gravity,0.28);
 assert.equal(adv.rules.winCondition,"survival");

 const quiz=createGameFromThai("สร้างเกมตอบคำถาม\nถาม: 2 + 2 ได้เท่าไร? | 3 | 4* | 5 | 6 | เฉลย: บวกเลขปกติ | คำใบ้: เลขคู่","m1");
 assert.equal(quiz.type,"quiz");
 assert.equal(quiz.rules.customQuestions.length,1);
 assert.equal(quiz.rules.customQuestions[0].correct,1);
 assert.equal(quiz.rules.customQuestions[0].a[1],"4");
});
