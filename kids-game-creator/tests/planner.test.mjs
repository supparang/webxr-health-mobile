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
