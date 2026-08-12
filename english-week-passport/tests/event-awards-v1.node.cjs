'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const journey=read('journey-client-v1.js');
const lens=read('lexicon-lens-production-auto-return-v1.js');
const rewards=read('teacher-reward-manager-v1.js');
const rules=fs.readFileSync(path.resolve(root,'../english-week-firebase-spark/firestore.rules'),'utf8');
function must(text,pattern,label){if(!pattern.test(text))throw new Error('Missing contract: '+label);}

must(journey,/finishedAt:firebase\.firestore\.FieldValue\.serverTimestamp\(\)/,'server finish timestamp');
must(journey,/if\(!current\.finishedAt\)/,'finish timestamp is immutable on repeat summary confirmation');
must(journey,/summaryViewed:true/,'summary confirmation gate');
must(journey,/CERTIFICATE_NOT_ELIGIBLE/,'certificate eligibility required before finish');

must(lens,/ewp_bonus_rewards/,'bonus reward collection write');
must(lens,/firstCompletedAt:firebase\.firestore\.FieldValue\.serverTimestamp\(\)/,'bonus server completion timestamp');
must(lens,/if\(snap\.exists\)return/,'bonus first completion preserved');

must(rewards,/First 20 to Complete Journey \+ Bonus/,'single combined reward authority');
must(rewards,/p\.summaryViewed&&p\.certificateEligible&&p\.finishedAt&&p\.certificate\?\.certificateId/,'valid Journey finish eligibility');
must(rewards,/finishRows\.filter\(f=>f\.validFinish&&bonusMap\.has\(f\.playerId\)\)/,'reward requires both Journey finish and authoritative Bonus');
must(rewards,/qualifiedMillis\(f\.finishedAt,b\.firstCompletedAt\)/,'qualifiedAt combines Journey and Bonus completion');
must(rewards,/Math\.max\(f,b\)/,'qualifiedAt uses later of the two server times');
must(rewards,/sort\(\(a,b\)=>a\.qualifiedAtMs-b\.qualifiedAtMs/,'Top 20 ranking uses qualifiedAt');
must(rewards,/REWARD_LIMIT=20/,'reward limit is 20 per session');
must(rewards,/if\(claimed&&!eligible\)/,'claim is blocked when not eligible');

must(rules,/match \/ewp_bonus_rewards\/\{rewardId\}/,'bonus reward rules');
must(rules,/request\.resource\.data\.firstCompletedAt == request\.time/,'bonus server timestamp rule');
must(rules,/rewardClaimed/,'teacher claimed-state rule');

console.log('LEXICON X event awards combined Journey + Bonus contract: PASS');