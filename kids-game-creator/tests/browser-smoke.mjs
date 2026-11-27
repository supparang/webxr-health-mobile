import { chromium } from "playwright";
import assert from "node:assert/strict";

const base = process.env.GAME_TEST_URL || "http://127.0.0.1:5500/";
const browser = await chromium.launch({headless:true});
let checks=0;
try {
 for (const mobile of [false,true]) {
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:900},isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage();
  const errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto(base,{waitUntil:"networkidle"});
  for (const age of ["p1","p4","m1","m4"]) {
   await page.locator("#ageLevel").selectOption(age);
   assert.equal(await page.locator("body").getAttribute("data-age"),age);
   assert.equal(await page.locator("#targetInput").isDisabled(),age==="p1");
   if(age==="p1"){
    assert.equal(await page.locator("#learningSteps").isVisible(),true);
    assert.equal(await page.locator("#designStep").isHidden(),true);
    assert.equal(await page.locator("#nextToDesign").isVisible(),true);
    await page.locator("#nextToDesign").click();
    assert.equal(await page.locator("#designStep").isVisible(),true);
    await page.getByRole("button",{name:"🐱 แมว"}).click();
    const beginnerPrompt=await page.locator("#prompt").inputValue();
    assert.equal((beginnerPrompt.match(/เก็บ \d+ คะแนน/g)||[]).length,1,"beginner prompt must not repeat target score");
    assert.equal(await page.locator("#prompt").isEditable(),false);
   }
   for (const [index,type] of ["adventure","maze","quiz","dodge"].entries()) {
    if(age==="p1"){
     if(await page.locator("#gameArea").isVisible())await page.locator("#editGame").click();
     await page.locator("#backToChoose").click();
    }
    await page.locator(".genre-card").nth(index).click();
    await page.locator("#generate").click();
    const game=JSON.parse(await page.locator("#output").textContent());
    if(age==="p1"){
     assert.equal(await page.locator("#gameArea").isVisible(),true);
     assert.equal(await page.locator("#technicalDetails").isVisible(),false);
     await page.locator("#editGame").click();
     assert.equal(await page.locator("#designStep").isVisible(),true);
     await page.locator("#generate").click();
     assert.equal(await page.locator("#gameArea").isVisible(),true);
    }
    assert.equal(game.type,type);
    assert.equal(game.ageLevel,age);
    if(age==="p1" && type==="adventure"){
     assert.equal(game.player.name,"แมว");
     assert.equal(await page.locator("#gameCanvas").getAttribute("data-character"),"แมว");
     assert.equal(await page.locator("#gameCanvas").getAttribute("data-theme"),"forest");
    }
    if(type==="quiz"){
     assert.equal(await page.locator("#gameCanvas").isHidden(),true);
     assert.equal(await page.locator("#quizPanel").isVisible(),true);
    }else{
     assert.equal(await page.locator("#gameCanvas").isVisible(),true);
     assert.equal(await page.locator("#gameControls").isVisible(),true);
     assert.equal(await page.locator("#gameControls").evaluate(el=>getComputedStyle(el).display),"grid");
     const left=await page.locator('[data-control="left"]').boundingBox();
     const right=await page.locator('[data-control="right"]').boundingBox();
     assert(left&&right&&left.x<right.x,"controls must be laid out horizontally");
     if(type==="adventure"){
      const jump=await page.locator('[data-control="jump"]').boundingBox();
      assert(jump&&left.x<jump.x&&jump.x<right.x,"jump must be centered");
     }
    }
    await page.locator("#restart").click();
    assert.equal(errors.length,0,"browser exceptions: "+errors.join("; "));
    checks++;
   }
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,"horizontal overflow");
  await context.close();
 }
 console.log("Browser smoke PASS: "+checks+" genre/age/viewport cases");
}finally{
 await browser.close();
}
