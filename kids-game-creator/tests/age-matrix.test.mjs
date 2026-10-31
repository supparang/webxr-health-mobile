import {test} from "node:test";
import assert from "node:assert/strict";
import {AGE_LEVELS,AGE_PRESETS} from "../js/game-schema.js";
import {CREATION_LEVELS,GENRES,exampleFor} from "../js/creation-presets.js";
import {createGameFromThai} from "../js/thai-game-planner.js";
import {getQuizQuestions} from "../js/quiz-bank.js";
test("16 age × genre combinations produce valid game types and age defaults",()=>{
 for(const age of AGE_LEVELS){
  for(const genre of GENRES){
   const prompt=exampleFor(genre.type,age);
   const game=createGameFromThai(prompt,age);
   assert.equal(game.type,genre.type,age+" / "+genre.type);
   assert.equal(game.ageLevel,age);
   assert.equal(game.rules.difficulty,AGE_PRESETS[age].difficulty);
   assert.equal(game.rules.levels,genre.type==="quiz"?1:CREATION_LEVELS[age].levels);
   assert.equal(game.player.lives,AGE_PRESETS[age].lives);
   if(genre.type==="quiz"){
    assert.equal(getQuizQuestions("science",age,CREATION_LEVELS[age].quizCount).length,CREATION_LEVELS[age].quizCount);
   }else if(genre.type==="adventure"||genre.type==="dodge"){
    assert.equal(game.rules.targetScore,CREATION_LEVELS[age].score);
   }
  }
 }
});
test("each age-specific example is short and safe",()=>{
 for(const age of AGE_LEVELS)for(const genre of GENRES){
  const prompt=exampleFor(genre.type,age);
  assert.ok(prompt.length<1000);
  assert.ok(!/[<>]/.test(prompt));
 }
});
