import test from "node:test";
import assert from "node:assert/strict";
import {completeMission,ProgressStore} from "./completion.js";

function makeApi(store,{timeoutBeforeAck=false}={}){
  return {
    async postComplete({userId,missionId}){
      if(timeoutBeforeAck) throw new Error("ACK_TIMEOUT");
      return store.save(userId,missionId);
    }
  };
}

test("normal completion eventually becomes COMPLETE", async()=>{
  const store=new ProgressStore(),ui={state:"READY"};
  await completeMission({ui,api:makeApi(store),userId:"S01",missionId:"W1"});
  assert.equal(ui.state,"COMPLETE");
  assert.equal(store.read("S01","W1").status,"COMPLETE");
});

test("timeout before acknowledgement must NOT create false COMPLETE", async()=>{
  const store=new ProgressStore(),ui={state:"READY"};
  await assert.rejects(
    completeMission({ui,api:makeApi(store,{timeoutBeforeAck:true}),userId:"S02",missionId:"W1"})
  );
  // This assertion fails in the starter version. Fix completion.js so the UI
  // remains PENDING until the authoritative write is acknowledged.
  assert.equal(ui.state,"PENDING");
  assert.equal(store.read("S02","W1"),null);
});
