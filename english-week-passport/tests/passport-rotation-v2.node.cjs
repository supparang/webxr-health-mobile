"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const storage = new Map();
global.window = global;
global.localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); }
};
global.document = {
  head:{ appendChild() {} },
  documentElement:{},
  createElement() { return { style:{}, appendChild() {} }; },
  querySelector() { return null; }
};
global.MutationObserver = class { observe() {} disconnect() {} };
global.addEventListener = function () {};
global.EW_CONFIG = {
  appId:"ENGLISH-WEEK-PASSPORT-2026",
  cacheKeys:{identity:"ew_passport_identity_v1"}
};

const file = path.resolve(__dirname, "..", "passport-rotation-v2.js");
const source = fs.readFileSync(file, "utf8");
vm.runInThisContext(source, { filename:file });

const api = global.EW_ROTATION;
assert.ok(api, "EW_ROTATION must be exported");
assert.equal(api.VERSION, "2026-08-03-PASSPORT-ROTATION-V2-INDEPENDENT");

const passportCounts = {P1:0,P2:0,P3:0,P4:0};
const assessmentCounts = {R1:0,R2:0};
const combinationCounts = {};

for (let index = 1; index <= 200; index += 1) {
  const playerId = `EW${String(index).padStart(4, "0")}`;
  const first = api.getAssignment(playerId);
  const second = api.getAssignment(playerId);
  assert.deepEqual(second, first, `assignment must be stable for ${playerId}`);
  assert.ok(api.PASSPORTS.includes(first.passportRotation));
  assert.ok(api.ASSESSMENTS.includes(first.assessmentRotation));
  if (first.assessmentRotation === "R1") {
    assert.equal(first.preForm, "A");
    assert.equal(first.postForm, "B");
  } else {
    assert.equal(first.preForm, "B");
    assert.equal(first.postForm, "A");
  }
  passportCounts[first.passportRotation] += 1;
  assessmentCounts[first.assessmentRotation] += 1;
  const key = `${first.passportRotation}|${first.assessmentRotation}`;
  combinationCounts[key] = (combinationCounts[key] || 0) + 1;
}

assert.equal(Object.keys(combinationCounts).length, 8, "all eight P/R combinations must occur");
const passportValues = Object.values(passportCounts);
const assessmentValues = Object.values(assessmentCounts);
assert.ok(Math.max(...passportValues) - Math.min(...passportValues) <= 25, "client demo passport spread must remain within tolerance");
assert.ok(Math.max(...assessmentValues) - Math.min(...assessmentValues) <= 20, "client demo assessment spread must remain within tolerance");

localStorage.setItem("ew_passport_identity_v1", JSON.stringify({playerId:"EW0050",nickname:"QA"}));
const seedA1 = api.stageSeed("word_match", "contract");
const seedA2 = api.stageSeed("word_match", "contract");
const seedB = api.stageSeed("category_forest", "contract");
assert.equal(seedA1, seedA2, "stage seed must be stable");
assert.notEqual(seedA1, seedB, "different stages must use different seeds");

const sampleA = api.sample([1,2,3,4,5,6,7,8,9,10], 5, "contract-stage", "items");
const sampleB = api.sample([1,2,3,4,5,6,7,8,9,10], 5, "contract-stage", "items");
assert.deepEqual(sampleA, sampleB, "seeded sample must remain stable");
assert.equal(new Set(sampleA).size, sampleA.length, "seeded sample must not contain duplicates");

console.log(JSON.stringify({
  ok:true,
  version:api.VERSION,
  passportCounts,
  assessmentCounts,
  combinationCounts,
  seedA:seedA1,
  seedB,
  sample:sampleA
}, null, 2));
