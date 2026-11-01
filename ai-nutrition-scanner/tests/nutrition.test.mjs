import test from "node:test";
import assert from "node:assert/strict";
import {FOODS,foodById,nutritionFor,SOURCE} from "../nutrition.js";
test("fixture IDs are unique and all have explicit unvalidated source",()=>{assert.equal(new Set(FOODS.map(f=>f.id)).size,FOODS.length);assert.match(SOURCE,/NOT_VALIDATED/);});
test("nutrients scale linearly",()=>{const f=FOODS[0];const a=nutritionFor(f,100);const b=nutritionFor(f,200);assert.equal(a.kcal*2,b.kcal);assert.equal(a.sodium*2,b.sodium);});
test("reject invalid weights and unknown food",()=>{const food=foodById("kaprao");for(const grams of [-10,0,2001,"abc",Infinity])assert.throws(()=>nutritionFor(food,grams));assert.throws(()=>nutritionFor(null,200));});
test("all dishes have finite nonnegative fixture values",()=>{for(const f of FOODS){assert.ok(f.defaultGrams>0);for(const x of Object.values(f.per100))assert.ok(Number.isFinite(x)&&x>=0);}});
