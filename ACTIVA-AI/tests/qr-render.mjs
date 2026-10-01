#!/usr/bin/env node
// QR disclosure regression: exercise the shipped draw() body with a minimal DOM.
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";

const source=await readFile(new URL("../app.js",import.meta.url),"utf8");
const renderStart=source.indexOf("  async function renderQr(v) {");
const start=source.indexOf("    let renderedQrToken=null;",renderStart);
const end=source.indexOf("    function qrError(e){",start);
assert(renderStart>=0&&start>renderStart&&end>start,"QR renderer could not be located");

let redraws=0;
let now=Date.parse("2026-10-01T12:00:00.000Z");
class TestDate extends Date { static now(){return now;} }
const area={
  _html:"",
  countdown:null,
  details:null,
  clientWidth:320,
  set innerHTML(value){
    this._html=value;
    redraws++;
    const seconds=value.match(/data-qr-remain>(\d+)<\/b>/);
    assert(seconds,"new QR must contain an addressable countdown");
    this.countdown={textContent:seconds[1]};
    this.details={open:false};
  },
  get innerHTML(){return this._html;},
  querySelector(selector){
    if(selector==="[data-qr-remain]")return this.countdown;
    if(selector===".qr-token-details")return this.details;
    return null;
  },
};
const code="(function(){let qrState=null;\n"+source.slice(start,end)+
  "\nreturn {draw,setState(value){qrState=value;}};})()";
const renderer=vm.runInNewContext(code,{
  document:{getElementById:id=>id==="qrArea"?area:null},
  window:{}, Date:TestDate, Math, String,
  selectedPurpose:()=>"CHECKOUT",
  esc:value=>String(value),fmt:value=>String(value),
});
const issued={
  token:"SIGNED-CI-QR-ONE",purpose:"CHECKOUT",
  expiresAt:new Date(now+45_000).toISOString(),
  checkoutCloseAt:new Date(now+120_000).toISOString(),
};
renderer.setState(issued);
renderer.draw();
assert.equal(redraws,1);
assert.equal(area.countdown.textContent,"45");
area.details.open=true;
const originalDisclosure=area.details;
now+=2000;
renderer.draw();
assert.equal(area.countdown.textContent,"43","countdown must update");
assert.equal(redraws,1,"countdown tick must not rebuild the QR DOM");
assert.equal(area.details,originalDisclosure,"token disclosure must remain mounted");
assert.equal(area.details.open,true,"expanded token disclosure must stay expanded");
renderer.setState({...issued,token:"SIGNED-CI-QR-TWO",expiresAt:new Date(now+45_000).toISOString()});
renderer.draw();
assert.equal(redraws,2,"a rotated QR must get a fresh DOM");
assert.equal(area.details.open,false,"rotated token must start concealed");
console.log("ACTIVA-AI Dynamic QR disclosure/countdown/rotation regression PASS.");
