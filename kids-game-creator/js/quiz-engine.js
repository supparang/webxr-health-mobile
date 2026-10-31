import {detectQuizTopic,getQuizQuestions} from "./quiz-bank.js";
export function mountQuiz(container,game,prompt,onStatus=()=>{}){
 const topic=detectQuizTopic(prompt);
 const questions=getQuizQuestions(topic,game.ageLevel,Math.min(6,Math.max(3,game.rules.targetScore)));
 let position=0,score=0,answered=false,finished=false;
 container.hidden=false;
 function element(tag,text,className){
  const e=document.createElement(tag);if(text!==undefined)e.textContent=text;
  if(className)e.className=className;
  return e;
 }
 function render(){
  container.replaceChildren();
  container.append(element("h3","ตอบคำถาม — ข้อ "+Math.min(position+1,questions.length)+"/"+questions.length));
  container.append(element("p","คะแนน "+score+"/"+questions.length));
  if(finished){
   container.append(element("h3","จบเกม! ได้ "+score+" คะแนนจาก "+questions.length+" คะแนน"));
   container.append(element("p",score===questions.length?"ยอดเยี่ยม! ตอบถูกทุกข้อ":"อ่านคำอธิบายแล้วลองเล่นอีกครั้งได้"));
   return;
  }
  const item=questions[position];
  container.append(element("p",item.q));
  const choices=element("div");choices.className="quiz-choices";
  item.a.forEach((answer,i)=>{
   const b=element("button",(i+1)+". "+answer);
   b.type="button";
   b.disabled=answered;
   b.addEventListener("click",()=>choose(i));
   choices.append(b);
  });
  container.append(choices);
  if(answered){
   const feedback=element("p",lastCorrect?"ถูกต้อง!":"ยังไม่ถูกต้อง");
   feedback.append(element("span"," "+item.why));
   feedback.setAttribute("role","status");
   container.append(feedback);
   const next=element("button",position===questions.length-1?"ดูผลคะแนน":"ข้อต่อไป");
   next.type="button";
   next.addEventListener("click",()=>{
    position++;
    if(position>=questions.length){finished=true;onStatus("จบเกมตอบคำถาม: "+score+"/"+questions.length);}
    answered=false;render();
   });
   container.append(next);
  }
 }
 let lastCorrect=false;
 function choose(i){
  if(answered||finished)return;
  answered=true;lastCorrect=i===questions[position].correct;
  if(lastCorrect)score++;
  render();
 }
 function restart(){position=0;score=0;answered=false;finished=false;onStatus("เริ่มเกมตอบคำถาม");render();}
 function destroy(){container.replaceChildren();container.hidden=true;}
 restart();return {restart,destroy,setTouch(){}};
}
