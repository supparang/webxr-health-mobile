#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const html = fs.readFileSync(path.resolve(__dirname,'..','csai2601-canonical-node-clean-v1.html'),'utf8');
const runtimeLast = html.lastIndexOf('uxq-node-studio-container-authority-v1.js');
const bootstrap = html.lastIndexOf('uxq-w12-prompt-no-shake-v1.js?v=content-alignment-bootstrap-v3-20260813');
assert(runtimeLast >= 0, 'missing final runtime/Studio authority');
assert(bootstrap > runtimeLast, 'canonical Mission/Reason bootstrap must load after all runtime/Studio layers');
console.log('CSAI2601 FINAL LOAD ORDER: PASS');
