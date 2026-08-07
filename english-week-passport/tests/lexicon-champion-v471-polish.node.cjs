const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const polish=fs.readFileSync(path.join(root,'lexicon-champion-v47-production-polish.js'),'utf8');
const html=fs.readFileSync(path.join(root,'lexicon-champion-arena-v47.html'),'utf8');
const routes=fs.readFileSync(path.join(root,'passport-canonical-routes-v1.js'),'utf8');
function must(value,message){if(!value)throw new Error(message)}
must(polish.includes("mastery>=90&&voice>=75&&bodyOk&&!fallback"),'S rank must require mastery>=90, voice>=75, complete body, no fallback');
must(polish.includes("mastery>=80&&voice>=60&&bodyOk"),'A rank policy missing');
must(polish.includes(".ew-rotation-badge,.qaOnly"),'production metadata hide policy missing');
must(polish.includes("subtitle.textContent='GAME 5 • FINAL CHALLENGE'"),'production subtitle polish missing');
must(html.includes('lexicon-champion-v47-production-polish.js?v=20260807-prod471'),'v4.7.1 polish loader missing');
must(routes.includes("v:'20260807-prod471'"),'production route must cache-bust v4.7.1');
must(routes.includes("title:'LEXICON Champion Arena'"),'canonical Game 5 title mismatch');
console.log('Champion Arena V4.7.1 polish contract PASS');
