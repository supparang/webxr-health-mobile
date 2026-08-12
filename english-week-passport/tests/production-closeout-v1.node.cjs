'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const must=(text,pattern,label)=>{if(!pattern.test(text))throw new Error('Production closeout contract failed: '+label);};
const mustNot=(text,pattern,label)=>{if(pattern.test(text))throw new Error('Production closeout contract failed: '+label);};

const config=read('config.js');
const sentence=read('sentence-city-ar-v62-clean-bank.html');
const arena=read('lexicon-champion-arena-v47.html');
const arenaBack=read('lexicon-champion-passport-back-guard-v1.js');
const certificate=read('certificate-v1.js');
const journey=read('journey-summary-v1.js');
const rewards=read('teacher-reward-manager-v1.js');
const lens=read('lexicon-lens-production-auto-return-v1.js');

// Pass policy
must(config,/word_match:55/,'Game 1 pass mark must be 55');
must(config,/category_forest:60/,'Game 2 pass mark must be 60');
must(config,/sentence_city:60/,'Game 3 pass mark must be 60');
must(config,/word_detective:60/,'Game 4 pass mark must be 60');
must(config,/final_boss:60/,'Game 5 pass mark must be 60');

// Sentence City: no advance while Teacher Maya/NPC speech is active.
must(sentence,/SC_NPC_SPEECH_GATE_R4_CHAIN_ANCHOR_NOT_FOUND/,'Sentence City R4 loader-chain patch guard');
must(sentence,/speechSynthesis/,'Sentence City observes browser speech synthesis');
must(sentence,/__scSynth\.speaking\|\|__scSynth\.pending/,'Sentence City waits for speaking or queued audio');
must(sentence,/__scNow-__scIdleSince>=800/,'Sentence City requires stable idle after speech');
must(sentence,/__scElapsed>=18000/,'Sentence City has bounded fallback timeout');

// Champion Arena: Passport context must never route to QA hub.
must(arena,/const explicitQA=p\.get\('qa'\)==='1'/,'Arena QA mode is explicit only');
must(arena,/location\.replace\('\.\/index\.html\?'/,'Arena back path targets Passport');
must(arena,/lexicon-champion-passport-back-guard-v1\.js/,'Arena loads Passport back guard');
must(arenaBack,/q\.get\('from'\)==='passport'\|\|q\.get\('shell'\)==='1'/,'Back guard detects Passport context');
must(arenaBack,/location\.replace\(passportUrl\(\)\)/,'Back guard returns to Passport');

// Certificate: existing Firestore certificate is authoritative and read-only.
must(certificate,/CERTIFICATE-READONLY-AUTHORITY-V5/,'Certificate V5 read-only authority');
must(certificate,/collection\('ewp_certificates'\)\.doc\(playerId\)\.get\(\)/,'Certificate reads certificate document directly');
mustNot(certificate,/if\(!j\.summaryViewed\).*goSummary/s,'Certificate must not redirect to Journey Summary when certificate already exists');
mustNot(certificate,/\.resume\(identity\.playerId/,'Certificate must not call resume/write path');

// Journey Summary: existing certificate fallback can navigate without another Firestore write.
must(journey,/existingCertificate/,'Journey Summary handles existing certificate receipt');
must(journey,/goCertificate\(\)/,'Journey Summary can navigate directly to Certificate');

// Reward: exactly one authoritative rule, both Journey + Bonus, Top 20 by time both are complete.
must(rewards,/SINGLE-REWARD-AUTHORITY/,'single reward authority version');
must(rewards,/removeLegacyRewardPanel/,'legacy bonus-only reward panel is removed');
must(rewards,/validFinish&&bonusMap\.has\(f\.playerId\)/,'reward requires Journey finish plus authoritative Bonus');
must(rewards,/qualifiedMillis\(f\.finishedAt,b\.firstCompletedAt\)/,'reward computes qualifiedAt from both server timestamps');
must(rewards,/Math\.max\(f,b\)/,'qualifiedAt is the later of Journey and Bonus completion');
must(rewards,/REWARD_LIMIT=20/,'reward limit is 20 per session');
must(rewards,/if\(claimed&&!eligible\)/,'claim cannot be recorded for ineligible participant');

// Lens Hunt must preserve first server timestamp and never overwrite first completion.
must(lens,/ewp_bonus_rewards/,'Lens Hunt creates reward authority record');
must(lens,/firstCompletedAt:firebase\.firestore\.FieldValue\.serverTimestamp\(\)/,'Lens Hunt uses server completion timestamp');
must(lens,/if\(snap\.exists\)return/,'Lens Hunt preserves first completion');

console.log('LEXICON X production closeout contract: PASS');