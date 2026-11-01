import assert from "node:assert/strict";
import {readFile,mkdir} from "node:fs/promises";
import {join,resolve} from "node:path";
import {chromium} from "playwright";

const base=process.env.NUTRILENS_BASE_URL||"http://127.0.0.1:3000";
const artifacts=resolve("qa-artifacts");
await mkdir(artifacts,{recursive:true});
const profiles=[
  {name:"desktop",viewport:{width:1365,height:900},isMobile:false,hasTouch:false},
  {name:"mobile-390",viewport:{width:390,height:844},isMobile:true,hasTouch:true},
  {name:"mobile-320",viewport:{width:320,height:700},isMobile:true,hasTouch:true}
];
const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9YC8siAAAAAASUVORK5CYII=","base64");
const browser=await chromium.launch({headless:true});
let passed=0;
try {
  for(const profile of profiles) {
    const context=await browser.newContext({
      viewport:profile.viewport,isMobile:profile.isMobile,
      hasTouch:profile.hasTouch,acceptDownloads:true,locale:"th-TH"
    });
    const page=await context.newPage();
    const errors=[];
    page.on("pageerror",error=>errors.push(error.message));
    try {
      const response=await page.goto(base,{waitUntil:"networkidle"});
      assert.equal(response.status(),200);
      assert.match(await page.title(),/NutriLens TH/);
      assert.match(await page.locator("#message").innerText(),/โหมดสาธิต/);
      assert.equal(await page.locator("#result-panel").isVisible(),false);

      await page.locator("#demo-food").selectOption("khao-man-kai");
      await page.locator("#analyze").click();
      assert.equal(await page.locator("#result-panel").isVisible(),true);
      assert.match(await page.locator("#source-notice").innerText(),/NOT_VALIDATED/);
      assert.match(await page.locator("#confidence").innerText(),/ไม่ได้จำแนกภาพ/);
      assert.match(await page.locator("#energy").innerText(),/543/);
      await page.locator("#grams").fill("150");
      assert.match(await page.locator("#energy").innerText(),/272/);
      await page.locator("#grams").fill("0");
      assert.equal(await page.locator("#save").isDisabled(),true);
      await page.locator("#grams").fill("150");
      await page.locator("#save").click();
      assert.match(await page.locator("#history-list").innerText(),/ข้าวมันไก่/);

      await page.reload({waitUntil:"networkidle"});
      assert.match(await page.locator("#history-list").innerText(),/ข้าวมันไก่/);
      const started=page.waitForEvent("download");
      await page.locator("#export").click();
      const download=await started;
      assert.equal(download.suggestedFilename(),"nutrilens-history.csv");
      const csv=await readFile(await download.path(),"utf8");
      assert.match(csv,/food_name,grams,mode,source/);
      assert.match(csv,/ILLUSTRATIVE_FIXTURE_NOT_VALIDATED/);
      assert.match(csv,/150/);

      page.once("dialog",dialog=>dialog.accept());
      await page.locator("#clear").click();
      assert.match(await page.locator("#history-list").innerText(),/ยังไม่มี/);
      await page.reload({waitUntil:"networkidle"});
      assert.match(await page.locator("#history-list").innerText(),/ยังไม่มี/);

      await page.locator("#photo").setInputFiles({name:"qa.png",mimeType:"image/png",buffer:png});
      assert.equal(await page.locator("#preview").isVisible(),true);
      await page.locator("#remove-photo").click();
      assert.equal(await page.locator("#preview").isVisible(),false);
      await page.locator("#photo").setInputFiles({
        name:"oversize.png",mimeType:"image/png",buffer:Buffer.alloc(3*1024*1024+1)
      });
      assert.match(await page.locator("#message").innerText(),/ไม่เกิน 3 MB/);
      assert.equal(await page.locator("#photo").inputValue(),"");

      await page.locator("#mode").selectOption("ai");
      assert.equal(await page.locator("#demo-field").isVisible(),false);
      await page.locator("#analyze").click();
      assert.match(await page.locator("#message").innerText(),/เลือกรูปภาพ/);
      await page.locator("#photo").setInputFiles({name:"qa.png",mimeType:"image/png",buffer:png});
      await page.locator("#analyze").click();
      await page.waitForFunction(
        ()=>document.querySelector("#message")?.textContent?.includes("OPENAI_API_KEY"),
        null,{timeout:10000}
      );
      assert.equal(await page.locator("#result-panel").isVisible(),false);

      // Model-provider response is mocked at the browser boundary: no live provider call.
      let mockReply={
        status:200,
        body:JSON.stringify({foodId:"som-tam",status:"matched"})
      };
      const handler=route=>route.fulfill({
        status:mockReply.status,
        contentType:"application/json",
        body:mockReply.body
      });
      await page.route("**/api/analyze",handler);
      await page.locator("#analyze").click();
      await page.locator("#result-panel").waitFor({state:"visible",timeout:10000});
      assert.equal(await page.locator("#food-select").inputValue(),"som-tam");
      assert.match(await page.locator("#source-notice").innerText(),/ยังไม่มีค่า/);
      assert.equal((await page.locator("#energy").innerText()).trim(),"—");
      assert.match(await page.locator("#nutrients").innerText(),/ยังไม่มีค่า/);
      await page.locator("#grams").fill("180");
      await page.locator("#save").click();
      assert.match(await page.locator("#history-list").innerText(),/ยังไม่มีค่าพลังงาน/);
      const aiDownload=page.waitForEvent("download");
      await page.locator("#export").click();
      const aiCsv=await readFile(await (await aiDownload).path(),"utf8");
      const aiRow=aiCsv.split(/\r?\n/).find(line=>line.includes("AI_CLASSIFICATION_ONLY_NO_VERIFIED_NUTRIENTS"));
      assert.ok(aiRow,"AI-only classification row must be labeled");
      assert.ok(aiRow.endsWith(',"","","","","",""'),"No invented nutrient numbers in AI CSV export");

      mockReply={
        status:422,
        body:JSON.stringify({error:"AI ยังไม่สามารถจำแนกอาหารนี้ได้อย่างชัดเจน"})
      };
      await page.locator("#analyze").click();
      assert.match(await page.locator("#message").innerText(),/ยังไม่สามารถจำแนกอาหาร/);
      assert.equal(await page.locator("#result-panel").isVisible(),false);
      await page.unroute("**/api/analyze",handler);

      assert.deepEqual(errors,[],"No uncaught JavaScript errors");

      const sizing=await page.evaluate(()=>({
        scrollWidth:document.documentElement.scrollWidth,
        viewportWidth:window.innerWidth
      }));
      assert.ok(sizing.scrollWidth<=sizing.viewportWidth+1,
        profile.name+" horizontal overflow "+JSON.stringify(sizing));
      await page.locator("#mode").selectOption("demo");
      await page.locator("#demo-food").selectOption("kaprao");
      await page.locator("#analyze").click();
      await page.screenshot({path:join(artifacts,profile.name+".png"),fullPage:true});
      console.log("PASS",profile.name,"demo + data + CSV + upload + AI gate + layout");
      passed++;
    } catch(error) {
      console.error("FAIL",profile.name,error);
      await page.screenshot({path:join(artifacts,profile.name+"-failed.png"),fullPage:true}).catch(()=>{});
      throw error;
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
console.log("Browser QA passed:",passed+"/"+profiles.length);
