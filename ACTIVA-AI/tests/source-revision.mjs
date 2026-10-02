import assert from "node:assert/strict";
import { deployedSourceCommit } from "../server/source-revision.js";
const valid="ABCDEF0123456789abcdef0123456789ABCDEF01";
assert.equal(valid.length,40);
assert.equal(deployedSourceCommit({RENDER_GIT_COMMIT:valid}),valid.toLowerCase());
assert.equal(deployedSourceCommit({RENDER_GIT_COMMIT:" "+valid+" "}),valid.toLowerCase());
for (const raw of ["",undefined,"main","ffb23bb5d0","a".repeat(39),"a".repeat(41),"unsafe&apikey=secret","<script>"]) {
  assert.equal(deployedSourceCommit({RENDER_GIT_COMMIT:raw}),null);
}
assert.equal(deployedSourceCommit({}),null);
console.log("P4.5 Render source revision validation PASS (read-only, no secrets).");
