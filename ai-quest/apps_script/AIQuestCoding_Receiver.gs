/**
 * CSAI2102 AI Quest Coding Receiver v3.2.15
 * Sheet authority + exact identity reconciliation + semantic evidence validation.
 * Prediction validation uses session-specific concept groups instead of forcing
 * the Predict answer to equal the program output.
 * Challenge Ladder is validated bonus evidence, not a mandatory completion gate.
 * Supports S1-S15 and B1-B5. Does NOT declare doGet(e) / doPost(e).
 */
var AIQCODING = AIQCODING || {};

AIQCODING.VERSION = '20261030-AIQ-CODING-RECEIVER-V3.2.15-S9-BATCH-PARITY';
AIQCODING.SHEET = 'coding_attempts';
AIQCODING.SHEET_CANDIDATES = ['coding_attempts','aiquest_coding_attempts','AIQuest_Coding_Attempts','Coding_Attempts'];
AIQCODING.HEADERS = [
  'submitted_at','coding_attempt_id','student_id','student_name','section','session_id',
  'attempt_number','prediction_answer','prediction_reason','prediction_correct',
  'run_score','modify_score','challenge_score','quiz_score','coding_score','completed',
  'run_count','error_count','error_types_json','output','completed_code','modified_code',
  'challenge_code','challenge_level','validation_mode','used_time_sec','version'
];

AIQCODING.text_ = function(v){ return String(v == null ? '' : v).trim(); };
AIQCODING.key_ = function(v){ return AIQCODING.text_(v).toLowerCase().replace(/[^a-z0-9]/g,''); };
AIQCODING.norm_ = function(v){ return AIQCODING.text_(v).toLowerCase().replace(/[^a-z0-9ก-๙.*<>=\[\]'"_-]+/g,''); };
AIQCODING.num_ = function(v){ var n=Number(v); return isFinite(n)?n:0; };
AIQCODING.bool_ = function(v){ return v === true || ['true','1','yes','y','pass','passed','complete','completed','mastered','submitted'].indexOf(AIQCODING.text_(v).toLowerCase()) >= 0; };
AIQCODING.section_ = function(v){ return AIQCODING.text_(v || '101').replace(/^0+/,'') || '0'; };
AIQCODING.session_ = function(v){
  var s=AIQCODING.text_(v).toUpperCase().replace(/[\s_:\-]+/g,'');
  var m=s.match(/^(?:MISSION|SESSION|M)?(S?(?:[1-9]|1[0-5])|B[1-5])$/);
  if(!m)return '';
  var x=m[1];
  if(/^\d+$/.test(x))x='S'+x;
  return x;
};
AIQCODING.allowedLab_ = function(v){ return /^(S(?:[1-9]|1[0-5])|B[1-5])$/.test(AIQCODING.session_(v)); };
AIQCODING.containsAll_ = function(text,items){ var t=AIQCODING.norm_(text); return (items||[]).every(function(k){return t.indexOf(AIQCODING.norm_(k))>=0;}); };
AIQCODING.containsAny_ = function(text,items){ if(!items||!items.length)return true; var t=AIQCODING.norm_(text); return items.some(function(k){return t.indexOf(AIQCODING.norm_(k))>=0;}); };
AIQCODING.missing_ = function(text,items){ var t=AIQCODING.norm_(text); return (items||[]).filter(function(k){return t.indexOf(AIQCODING.norm_(k))<0;}); };
AIQCODING.minCounts_ = function(text,counts){
  var t=AIQCODING.text_(text).toLowerCase(); counts=counts||{};
  return Object.keys(counts).every(function(k){
    var escaped=String(k).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    return (t.match(new RegExp(escaped,'g'))||[]).length>=Number(counts[k]||1);
  });
};
AIQCODING.s14QTableUpdateEquivalent_ = function(code){
 var clean=String(code||'').split(/\r?\n/).map(function(line){return line.replace(/#.*$/,'');}).join('\n');
 if(!/\balpha\b/i.test(clean)||!/\breward\b/i.test(clean))return false;
 var writes=/\b(?:self\.)?(?:q_table|q_values|q)\s*\[[^\]\r\n]{1,120}\](?:\s*\[[^\]\r\n]{1,120}\])?\s*(\+=|=)\s*([^\r\n]+)/gi;
 var match;
 while((match=writes.exec(clean))!==null){
  var op=match[1],rhs=match[2];
  var alpha=/\balpha\b/i.test(rhs);
  var direct=/\breward\b/i.test(rhs);
  var td=/\btd_error\b/i.test(rhs)&&/\btd_error\s*=\s*[^\r\n]+/i.test(clean)&&/\btd_target\s*=\s*[^\r\n]*\breward\b/i.test(clean);
  var target=/\btd_target\b/i.test(rhs)&&/\btd_target\s*=\s*[^\r\n]*\breward\b/i.test(clean);
  var oldQ=/\b(?:q_table|q_values|q|old_q|q_old|td_error|td_target)\b/i.test(rhs);
  if(alpha&&(direct||td||target)&&(op==='+='||oldQ))return true;
  var alias=/^\s*(?:updated_q|q_updated|q_new|updated_value|new_value)\b/i.exec(rhs);
  if(alias){
   var id=alias[0].trim().replace(/\W/g,'');
   var assignment=new RegExp('\\b'+id+'\\s*=\\s*([^\\r\\n]+)','i').exec(clean);
   if(assignment&&/\balpha\b/i.test(assignment[1])&&/\breward\b/i.test(assignment[1])&&(/\b(?:q_table|q_values|q|old_q|q_old)\b/i.test(assignment[1])||op==='+='))return true;
  }
 }
 return false;
};
AIQCODING.s4UcsOutputEvidence_ = function(text) {
  // Original S4 graph: A->B 2, A->C 5, B->D 4, C->D 1.
  // Accept equal-cost outputs, not contradictory or ungrounded assertions.
  var lines=String(text||'').trim().split(/\r?\n/);
  var goalCosts=[],totalCosts=[],paths=[],goalSeen=false,issues=[];
  var edge={A:{B:2,C:5},B:{D:4},C:{D:1},D:{}};
  var isSix=function(v){return isFinite(Number(v))&&Math.abs(Number(v)-6)<1e-8;};
  lines.forEach(function(src){
    var line=String(src||'').trim();
    if(!line)return;
    var goal=line.match(/^(?:(?:Expanding|Expanded|Visited|Goal)\s*:\s*)?D\s*\(\s*(?:Cost|Path\s*Cost)\s*:\s*(-?\d+(?:\.\d+)?)\s*\)$/i)||
      line.match(/^(?:(?:Expanding|Expanded|Visited|Goal)\s*:\s*)?D\s*(?:[:=]|\s+)\s*(-?\d+(?:\.\d+)?)$/i);
    if(goal){goalSeen=true;goalCosts.push(Number(goal[1]));return;}
    var goalLabel=line.match(/^(?:Goal|Target|Reached)\s*:\s*(\w+)\s*$/i);
    if(goalLabel){if(goalLabel[1].toUpperCase()==='D')goalSeen=true;else issues.push('GOAL_NOT_D');return;}
    if(/^(?:Total\s+(?:Path\s+)?Cost|Path\s+Cost|Minimum\s+Cost)\s*[:=]/i.test(line)){
      var total=line.match(/^(?:Total\s+(?:Path\s+)?Cost|Path\s+Cost|Minimum\s+Cost)\s*[:=]\s*(-?\d+(?:\.\d+)?)\s*$/i);
      if(!total)issues.push('TOTAL_COST_NOT_NUMERIC');else totalCosts.push(Number(total[1]));
      return;
    }
    if(/^(?:Optimal\s+|Shortest\s+)?Path\s*[:=]/i.test(line)){
      var path=line.match(/^(?:Optimal\s+|Shortest\s+)?Path\s*[:=]\s*(.+)$/i);
      if(!path){issues.push('PATH_EMPTY');return;}
      var clean=path[1].replace(/[\[\]\(\)'"]/g,'').replace(/\s*(?:->|→|,)\s*/g,' ').trim();
      var nodes=clean.split(/\s+/).map(function(v){return v.toUpperCase();});
      if(nodes.length<2||nodes[0]!=='A'||nodes[nodes.length-1]!=='D'||nodes.some(function(n){return !/^[A-D]$/.test(n);})){
        issues.push('PATH_INVALID');return;
      }
      var cost=0;
      for(var i=1;i<nodes.length;i++){
        var from=nodes[i-1],to=nodes[i];
        if(!Object.prototype.hasOwnProperty.call(edge[from],to)){issues.push('PATH_INVALID_EDGE');return;}
        cost+=edge[from][to];
      }
      paths.push({nodes:nodes,cost:cost});
    }
  });
  if(goalCosts.some(function(v){return !isSix(v);}))issues.push('GOAL_COST_NOT_6');
  if(totalCosts.some(function(v){return !isSix(v);}))issues.push('TOTAL_COST_NOT_6');
  if(paths.some(function(v){return !isSix(v.cost);}))issues.push('PATH_COST_NOT_6');
  var grounded=goalCosts.length>0||(goalSeen&&totalCosts.length>0)||(paths.length>0&&totalCosts.length>0);
  if(!grounded)issues.push('GOAL_D_COST_6_NOT_CONFIRMED');
  return {passed:issues.length===0,mode:'S4_UCS_GOAL_COST_V1',issue:issues[0]||''};
};
AIQCODING.s6MinimaxOutputEvidence_ = function(text) {
  // A one-character answer "3" is the S6 canonical output.
  // Do not mistake "13" or "30" for 3.
  var lines=String(text||'').trim().split(/\r?\n/);
  var values=[],issues=[];
  lines.forEach(function(src){
    var line=String(src||'').trim();
    if(!line)return;
    if(/^-?\d+(?:\.\d+)?$/.test(line)){values.push(Number(line));return;}
    if(/^(?:Result|Output|Root\s*MAX|MAX|Best\s*Score|Minimax(?:\s*Value)?|Value|Score)\s*[:=]/i.test(line)){
      var v=line.match(/^(?:Result|Output|Root\s*MAX|MAX|Best\s*Score|Minimax(?:\s*Value)?|Value|Score)\s*[:=]\s*(-?\d+(?:\.\d+)?)\s*$/i);
      if(!v)issues.push('MINIMAX_RESULT_NOT_NUMERIC');else values.push(Number(v[1]));
    }
  });
  if(!values.length)issues.push('MINIMAX_RESULT_3_NOT_FOUND');
  if(values.some(function(v){return Math.abs(v-3)>1e-8;}))issues.push('MINIMAX_RESULT_NOT_3');
  return {passed:issues.length===0,mode:'S6_NUMERIC_RESULT_V1',issue:issues[0]||''};
};

AIQCODING.s9ScenarioBatchEvidenceV1_ = function(output) {
  'use strict';
  var raw=String(output==null?'':output).trim();
  // Only the explicitly labeled S9 A-E batch uses this alternate format.
  // The original one-result S9 grader remains unchanged for ordinary output.
  var header=/^(?:Case\s+)?([A-E])\s*[:.)]\s*(.+)$/i;
  var rows=raw.split(/\r?\n/).map(function(row){return row.trim();}).filter(Boolean);
  if(!rows.some(function(row){return header.test(row);}))return null;
  var result=function(ok,issue){return {passed:!!ok,mode:'S9_SCENARIO_BATCH_V1',issue:issue||'',reviewRequired:false};};
  if(raw.length>30000)return result(false,'OUTPUT_REQUIRES_REVIEW');
  var cases={},order=[],current=null,lastWasExplanation=false,problem='';
  var decisions={recommend_checkup:1,rest_and_monitor:1,go_to_emergency_room:1};
  var noteLabel=/^(?:explanation|reason|rationale|คำอธิบาย|เหตุผล)\s*_*\s*[:：]\s*(.*)$/i;
  var decisionLabel=/^(?:recommendation|คำแนะนำ)\s*[:：]\s*(.*)$/i;
  var embedded=/(?:^|[\s;|])(?:recommendation|decision|action|result|output|answer|classification|diagnosis|strategy|choice|selected|final_decision)\s*[:=]/i;
  rows.forEach(function(line){
    if(problem)return;
    var h=header.exec(line);
    if(h){
      var key=h[1].toUpperCase(),description=h[2].trim();
      if(!description||cases[key]){problem='DUPLICATE_OR_EMPTY_CASE';return;}
      current={id:key,description:description,recommendations:[],explanations:[]};
      cases[key]=current;order.push(key);lastWasExplanation=false;return;
    }
    if(!current){problem='UNLABELED_BATCH_OUTPUT';return;}
    var decision=decisionLabel.exec(line);
    if(decision){
      var value=decision[1].trim().toLowerCase().replace(/[\s-]+/g,'_');
      if(!decisions[value]){problem='S9_UNRECOGNIZED_RECOMMENDATION';return;}
      current.recommendations.push(value);lastWasExplanation=false;return;
    }
    var explanation=noteLabel.exec(line);
    if(explanation){
      var detail=explanation[1].trim();
      if(!detail||embedded.test(detail)){problem='S9_INVALID_EXPLANATION';return;}
      current.explanations.push(detail);lastWasExplanation=true;return;
    }
    // A parenthesized continuation is an explanation only when it follows one.
    if(lastWasExplanation&&/^\([^()]{1,250}\)$/.test(line)&&!embedded.test(line)){
      current.explanations[current.explanations.length-1]+=' '+line;return;
    }
    problem='S9_UNRECOGNIZED_BATCH_LINE';
  });
  if(problem)return result(false,problem);
  if(order.length<2||!cases.B)return result(false,'S9_BASELINE_CASE_B_REQUIRED');
  for(var i=0;i<order.length;i++){
    var c=cases[order[i]];
    if(c.recommendations.length!==1)return result(false,'S9_ONE_RECOMMENDATION_PER_CASE_REQUIRED');
    if(c.explanations.length!==1)return result(false,'S9_ONE_EXPLANATION_PER_CASE_REQUIRED');
  }
  if(cases.B.recommendations[0]!=='recommend_checkup')return result(false,'S9_BASELINE_B_RECOMMENDATION_MISMATCH');
  for(var j=0;j<order.length;j++){
    var item=cases[order[j]];
    if(/(?:หายใจลำบาก|shortness[_\s-]*of[_\s-]*breath|chest[_\s-]*pain|เจ็บหน้าอก)/i.test(item.description)&&
       item.recommendations[0]!=='go_to_emergency_room')
      return result(false,'S9_SEVERE_CASE_MUST_REFER_URGENTLY');
  }
  return result(true,'');
};

AIQCODING.structuredOutputEvidenceV2_ = function(stage,output) {
  // Pure, deterministic, read-only output validator for the 18 non-S4/S6 stages.
  // Only supported representations of the provided lab outputs are accepted.
  // Unknown/ambiguous answers are left for instructor review, never auto-credited.
  var mode='STRUCTURED_OUTPUT_V2', raw=String(output==null?'':output).trim();
  var result=function(ok,issue){return {passed:!!ok,mode:mode,issue:issue||'',reviewRequired:!ok&&(issue==='CATEGORY_NOT_CONFIRMED'||issue==='NUMERIC_RESULT_NOT_FOUND'||issue==='SEQUENCE_NOT_FOUND'||issue==='SPLIT_NOT_FOUND'||issue==='B_COST_NOT_FOUND')};};
  if(!raw)return result(false,'EMPTY_OUTPUT');
  if(raw.length>30000)return result(false,'OUTPUT_REQUIRES_REVIEW');
  var lines=raw.split(/\r?\n/).map(function(x){return x.trim();}).filter(Boolean);
  var label=/^(?:output|result|answer|action|decision|prediction|classification|diagnosis|recommendation|strategy|value|selected|choice)\s*[:=]\s*/i;
  var take=function(s){return String(s||'').replace(label,'').trim();};
  var isNegated=function(s){return /\b(?:no|not|never|without|cannot|can't|don't|doesn't|didn't)\b|(?:ไม่|ไม่ได้|ไม่ต้อง|ห้าม)/i.test(s);};
  var numeric=function(value,unit){
    var values=[],bad=[];
    lines.forEach(function(line){
      var text=take(line);
      text=text.replace(/^(?:posterior|probability|prediction|q(?:[-_\s]*value)?|score|value|y|relu\s*output)\s*[:=]\s*/i,'');
      if(/^-?(?:\d+\.?\d*|\.\d+)\s*%?$/.test(text)){
        var percentage=/%$/.test(text);
        if(percentage&&unit!=='proportion'){bad.push('PERCENT_NOT_ALLOWED');return;}
        values.push(Number(text.replace('%',''))/(percentage?100:1));
      }else if(/^(?:output|result|value|posterior|probability|q[-_\s]*value|prediction|score)\s*[:=]/i.test(line)){
        bad.push('MALFORMED_RESULT');
      }
    });
    if(bad.length)return result(false,bad[0]);
    if(!values.length)return result(false,'NUMERIC_RESULT_NOT_FOUND');
    if(values.some(function(x){return !isFinite(x)||Math.abs(x-value)>1e-8;}))return result(false,'NUMERIC_VALUE_MISMATCH');
    return result(true);
  };
  var sequence=function(expected,letters){
    var found=[],issues=[];
    lines.forEach(function(line){
      var text=take(line).replace(/^(?:visited(?:\s+order)?|traversal(?:\s+order)?|bfs|dfs|predictions|predicted\s+labels|clusters|cluster\s+ids|labels|sequence|path|order)\s*[:=]\s*/i,'').trim();
      if(!/^\s*\[/.test(text)&&!/->|→|,/.test(text))return;
      var clean=text.replace(/[\[\]\(\)'"]/g,'').trim();
      var tokens=clean.split(/\s*(?:,|->|→)\s*/).map(function(t){return t.trim();});
      if(tokens.length>1&&tokens.every(function(t){return letters?/^[A-Z]$/i.test(t):/^-?\d+$/.test(t);}))
        found.push(tokens.map(function(t){return letters?t.toUpperCase():Number(t);}));
      else if(/^(?:\[|(?:visited|traversal|predictions|clusters|labels|path|sequence|order)\s*[:=])/i.test(line))
        issues.push('INVALID_SEQUENCE');
    });
    if(issues.length)return result(false,issues[0]);
    if(!found.length)return result(false,'SEQUENCE_NOT_FOUND');
    if(found.some(function(v){return v.length!==expected.length||v.some(function(k,i){return k!==expected[i];});}))
      return result(false,'SEQUENCE_VALUE_MISMATCH');
    return result(true);
  };
  var category=function(accept){
    var found=[],bad=[],objects=[],outside='';
    // Parse printed JSON/Python dictionaries as structural evidence rather
    // than treating each property and brace as a contradictory output line.
    // Scan braces outside strings; never evaluate a student's code.
    var depth=0,start=-1,quote='',escaped=false;
    for(var pos=0;pos<raw.length;pos++){
      var c=raw.charAt(pos);
      if(quote){
        if(escaped)escaped=false;
        else if(c==='\\')escaped=true;
        else if(c===quote)quote='';
        continue;
      }
      if(c==='"'||c==="'"){quote=c;continue;}
      if(c==='{'){
        if(depth===0)start=pos;
        depth++;
      }else if(c==='}'){
        if(depth===0){bad.push('UNBALANCED_STRUCTURED_OUTPUT');break;}
        depth--;
        if(depth===0)objects.push(raw.slice(start,pos+1));
      }
    }
    if(depth!==0)bad.push('UNBALANCED_STRUCTURED_OUTPUT');
    if(quote&&depth>0)bad.push('UNTERMINATED_STRUCTURED_STRING');
    if(objects.length){
      var cursor=0;
      objects.forEach(function(block){
        var at=raw.indexOf(block,cursor);
        if(at<0){bad.push('STRUCTURED_OUTPUT_EXTRACT_FAILED');return;}
        outside+=raw.slice(cursor,at)+'\n';
        cursor=at+block.length;
      });
      outside+=raw.slice(cursor);
    }else outside=raw;
    var pythonDictToJson=function(src){
      var out='',i=0;
      while(i<src.length){
        var ch=src.charAt(i);
        if(ch==='"'){
          var st=i++,close=false,esc=false;
          while(i<src.length){
            var q=src.charAt(i++);
            if(esc){esc=false;continue;}
            if(q==='\\'){esc=true;continue;}
            if(q==='"'){close=true;break;}
          }
          if(!close)throw Error('UNCLOSED_JSON_STRING');
          out+=src.slice(st,i);continue;
        }
        if(ch==="'"){
          i++;var word='',finished=false;
          while(i<src.length){
            var part=src.charAt(i++);
            if(part==='\\'){
              if(i>=src.length)throw Error('UNCLOSED_PYTHON_ESCAPE');
              var escChar=src.charAt(i++);
              if(escChar==='n')word+='\n';
              else if(escChar==='t')word+='\t';
              else word+=escChar;
              continue;
            }
            if(part==="'"){finished=true;break;}
            word+=part;
          }
          if(!finished)throw Error('UNCLOSED_PYTHON_STRING');
          out+=JSON.stringify(word);continue;
        }
        if(/[a-zA-Z_]/.test(ch)){
          var end=i+1;
          while(end<src.length&&/[a-zA-Z0-9_]/.test(src.charAt(end)))end++;
          var keyword=src.slice(i,end);
          out+=keyword==='True'?'true':keyword==='False'?'false':keyword==='None'?'null':keyword;
          i=end;continue;
        }
        out+=ch;i++;
      }
      return out;
    };
    var resultKeys={decision:true,action:true,result:true,output:true,
      recommendation:true,diagnosis:true,classification:true,strategy:true,
      choice:true,selected:true,final_decision:true};
    objects.forEach(function(block){
      var seen={};
      var keys=block.match(/(?:["'])(?:decision|action|result|output|recommendation|diagnosis|classification|strategy|choice|selected|final_decision)(?:["'])\s*:/gi)||[];
      keys.forEach(function(key){
        var name=key.replace(/["':\s]/g,'').toLowerCase();
        if(seen[name])bad.push('DUPLICATE_RESULT_FIELD');
        seen[name]=true;
      });
      var obj;
      try{
        try{obj=JSON.parse(block);}
        catch(_){obj=JSON.parse(pythonDictToJson(block));}
      }catch(_){bad.push('MALFORMED_STRUCTURED_OUTPUT');return;}
      if(!obj||typeof obj!=='object'||Array.isArray(obj)){
        bad.push('STRUCTURED_OBJECT_EXPECTED');return;
      }
      Object.keys(obj).forEach(function(key){
        if(!resultKeys[key.toLowerCase()])return;
        var value=obj[key];
        if(typeof value!=='string'){bad.push('NON_TEXT_RESULT_FIELD');return;}
        if(isNegated(value)){bad.push('NEGATED_OR_AMBIGUOUS_OUTPUT');return;}
        if(accept(value))found.push('expected');
        else bad.push('CONFLICTING_STRUCTURED_DECISION');
      });
    });
    outside.split(/\r?\n/).map(function(x){return x.trim();}).filter(Boolean).forEach(function(line){
      if(/^(?:debug|trace|info|log)\s*[:=]/i.test(line))return;
      // Explicit explanatory metadata is not a second result. Keep real
      // labeled decisions and contradictory output lines authoritative.
      var note=/^(?:explanation|reason|rationale|คำอธิบาย|เหตุผล)\s*[:：]\s*(.*)$/i.exec(line);
      if(note){
        var detail=note[1].trim();
        var embeddedDecision=/(?:^|[\s;|])(?:recommendation|decision|action|result|output|answer|classification|diagnosis|strategy|choice|selected|final_decision)\s*[:=]/i.test(detail);
        if(!detail||embeddedDecision)bad.push('CONFLICTING_OR_UNRECOGNIZED_RESULT');
        return;
      }
      if(objects.length&&/^(?:result|output|answer|decision)\s*[:=]\s*$/i.test(line))return;
      var value=take(line);
      if(isNegated(value)){bad.push('NEGATED_OR_AMBIGUOUS_OUTPUT');return;}
      if(accept(value))found.push('expected');
      else bad.push('CONFLICTING_OR_UNRECOGNIZED_RESULT');
    });
    if(bad.length)return result(false,bad[0]);
    if(!found.length)return result(false,'CATEGORY_NOT_CONFIRMED');
    return result(true);
  };
  switch(stage){
    case 'S1':return category(function(v){return /^(?:high\s+(?:temperature|temp)\s+(?:alert|warning)|alert\s*:\s*high\s+(?:temperature|temp))$/i.test(v)?'expected':'';});
    case 'S2':return category(function(v){return /^(?:clean|cleaning)$/i.test(v)?'expected':'';});
    case 'S3':return sequence(['A','B','C','D','E'],true);
    case 'B1':return category(function(v){return /^search(?:[_\s-]*new[_\s-]*route)$/i.test(v)?'expected':'';});
    case 'S5':{
      var scores=[];
      lines.forEach(function(line){
        var m=line.match(/^(?:(?:Expanding|Expanded|Visited)\s*:\s*)?B\s*(?:[:=]|\s+)\s*(-?\d+(?:\.\d+)?)\s*$/i)||
          line.match(/^B\s*\(\s*(?:Cost|Score|f)\s*[:=]\s*(-?\d+(?:\.\d+)?)\s*\)$/i)||
          line.match(/^B\s+(?:Cost|Score|f)\s*[:=]\s*(-?\d+(?:\.\d+)?)\s*$/i);
        if(m)scores.push(Number(m[1]));
      });
      if(!scores.length)return result(false,'B_COST_NOT_FOUND');
      return scores.every(function(n){return Math.abs(n-4)<1e-8;})?result(true):result(false,'B_COST_NOT_4');
    }
    case 'B2':return category(function(v){return /^(?:a\s*\*|a[\s_-]*star|astar)$/i.test(v)?'expected':'';});
    case 'S7':return category(function(v){return /^(?:can[_\s-]*fly|บินได้)$/i.test(v)?'expected':'';});
    case 'S8':return numeric(0.154,'proportion');
    case 'S9':{var batch=AIQCODING.s9ScenarioBatchEvidenceV1_(raw);return batch||category(function(v){return /^(?:recommend[_\s-]*check[_\s-]*up|แนะนำตรวจ(?:สุขภาพ)?|ตรวจสุขภาพ)$/i.test(v)?'expected':'';});}
    case 'B3':return category(function(v){return /^(?:high[_\s-]*risk[_\s-]*with[_\s-]*evidence|high\s+risk\s+(?:and|with)\s+evidence|ความเสี่ยงสูงพร้อมหลักฐาน)$/i.test(v)?'expected':'';});
    case 'S10':{
      var pairs=[],train=[],test=[];
      lines.forEach(function(line){
        var text=take(line),m=text.match(/^(\d+)\s*(?:,|\s+)\s*(\d+)$/);
        if(m)pairs.push([Number(m[1]),Number(m[2])]);
        var tr=line.match(/\btrain(?:ing)?(?:\s*(?:size|count|items))?\s*[:=]\s*(\d+)\b/i);
        var te=line.match(/\btest(?:ing)?(?:\s*(?:size|count|items))?\s*[:=]\s*(\d+)\b/i);
        if(tr)train.push(Number(tr[1]));
        if(te)test.push(Number(te[1]));
      });
      if(train.length||test.length){
        if(!train.length||!test.length)return result(false,'SPLIT_MISSING_COMPONENT');
        if(train.some(function(x){return x!==8;})||test.some(function(x){return x!==2;}))return result(false,'SPLIT_COUNT_MISMATCH');
      }
      if(pairs.some(function(p){return p[0]!==8||p[1]!==2;}))return result(false,'SPLIT_COUNT_MISMATCH');
      return (pairs.length||(train.length&&test.length))?result(true):result(false,'SPLIT_NOT_FOUND');
    }
    case 'S11':return sequence([0,1,1],false);
    case 'S12':return sequence([0,0,1,1],false);
    case 'B4':return category(function(v){return /^(?:overfitting|overfit|โอเวอร์ฟิต|เรียนเกิน)$/i.test(v)?'expected':'';});
    case 'S13':return numeric(0.1);
    case 'S14':return numeric(0.55);
    case 'S15':return category(function(v){return /^rag\s+(?:retriev(?:es|ed|ing|e)|found|finds)\s+(?:the\s+)?evidence$/i.test(v)?'expected':'';});
    case 'B5':{
      // Baseline: review_with_evidence. A completed privacy/fairness
      // governance run may rightly return REJECT/HOLD instead.
      // Require independently labeled privacy failure, offending fields,
      // explicit HOLD decision, and its governance explanation.
      var isGovernance=/\bPrivacy\s+Compliant\s*:|\bFailed\s+Governance\s+Gates\b|\bDecision\s*:\s*REJECT\s*\/\s*HOLD\b/i.test(raw);
      if(!isGovernance)
        return category(function(v){return /^(?:(?:human[\s_-]+)?review[_\s-]*with[_\s-]*evidence|ทบทวนโดยมนุษย์พร้อมหลักฐาน)$/i.test(v)?'expected':'';});
      var privacy=[],privacyOK=[],decisions=[],excess=[],errors=[];
      lines.forEach(function(line){
        var p=line.match(/^Privacy\s+Compliant\s*:\s*(True|False)\b/i);
        if(p)privacy.push(p[1].toLowerCase()==='true');
        var gate=line.match(/\bPrivacy\s+OK\s*:\s*(True|False)\b/i);
        if(gate)privacyOK.push(gate[1].toLowerCase()==='true');
        var d=line.match(/\b(?:Final\s+)?Decision\s*:\s*(REJECT\s*\/\s*HOLD|REJECT|HOLD|APPROVE|review[_\s-]*with[_\s-]*evidence)\b/i);
        if(d)decisions.push(d[1].replace(/\s+/g,'').toUpperCase());
        var x=line.match(/\bExcess\s+Fields\s*:\s*\[([^\]\r\n]*)\]/i);
        if(x)excess.push(x[1].trim());
        if(/^(?:review[_\s-]*with[_\s-]*evidence|approve|approved)\s*$/i.test(line))
          errors.push('CONTRADICTORY_UNLABELED_RESULT');
      });
      if(!privacy.length||privacy.some(function(x){return x;}))errors.push('PRIVACY_FAILURE_NOT_CONFIRMED');
      if(privacyOK.some(function(x){return x;}))errors.push('PRIVACY_GATE_CONFLICT');
      if(!decisions.length||decisions.some(function(x){return x!=='REJECT/HOLD';}))errors.push('REJECT_HOLD_NOT_CONFIRMED');
      if(!/\bFailed\s+Governance\s+Gates\b/i.test(raw))errors.push('GOVERNANCE_REASON_MISSING');
      if(!excess.length||excess.some(function(x){return !x;}))errors.push('EXCESS_PRIVACY_FIELDS_MISSING');
      if(errors.length)return {passed:false,mode:'B5_PRIVACY_HOLD_V1',
        issue:errors[0],reviewRequired:errors[0]==='REJECT_HOLD_NOT_CONFIRMED'||errors[0]==='EXCESS_PRIVACY_FIELDS_MISSING'};
      return {passed:true,mode:'B5_PRIVACY_HOLD_V1',issue:'',reviewRequired:false};
    }
    default:return result(false,'STAGE_NOT_SUPPORTED');
  }
};

AIQCODING.validateOutputEvidence_ = function(sessionId,output,rule) {
  var value=AIQCODING.text_(output),r=rule||AIQCODING.RULES[sessionId];
  if(!r)return {passed:false,mode:'NO_RULE',issue:'RULE_NOT_FOUND'};
  if(sessionId==='S4'&&r.outputValidation==='S4_UCS_GOAL_COST_V1')
    return AIQCODING.s4UcsOutputEvidence_(value);
  if(sessionId==='S6'&&r.outputValidation==='S6_NUMERIC_RESULT_V1')
    return AIQCODING.s6MinimaxOutputEvidence_(value);
  if(r.outputValidation==='STRUCTURED_OUTPUT_V2')
    return AIQCODING.structuredOutputEvidenceV2_(sessionId,value);
  return {passed:value.length>=2&&AIQCODING.norm_(value).indexOf(AIQCODING.norm_(r.expected))>=0,
    mode:'NORMALIZED_EXPECTED_SUBSTRING',issue:''};
};

AIQCODING.matchesGroups_ = function(text,groups){
  var t=AIQCODING.norm_(text);
  groups=groups||[];
  if(!groups.length)return false;
  return groups.every(function(group){
    return (group||[]).some(function(term){
      var k=AIQCODING.norm_(term);
      return k && t.indexOf(k)>=0;
    });
  });
};

/*
 * pg = Predict concept groups. Every group must match at least one alternative.
 * b/ba = Completed Code all/any; m/ma/mc = Modification; c/ca/cc = Challenge.
 * Output still uses expected exactly/semantically, independently from Predict.
 */
AIQCODING.RULES = Object.freeze({
 S1:{predictQuestion:"เมื่อ temperature = 38 โปรแกรมจะแสดงอะไร",predictionValidation:'AIQ_PREDICT_PARITY_V1',outputValidation:'STRUCTURED_OUTPUT_V2',expected:'High temperature alert',pg:[['rule-based automation','rule based automation','rule-based ai','rule based ai','ระบบอัตโนมัติแบบกฎ','ระบบตามกฎ','กฎตายตัว']],b:['temperature','if','print'],m:['38.5','38','39'],c:['if','elif','else','low','normal','high'],ca:['confidence','explanation','fallback']},
 S2:{predictQuestion:"เมื่อ percept = dirty โปรแกรมจะแสดงอะไร",predictionValidation:'AIQ_PREDICT_PARITY_V1',outputValidation:'STRUCTURED_OUTPUT_V2',expected:'clean',pg:[['model-based','model based','internal state','สถานะภายใน','ตัวแทนแบบใช้แบบจำลอง']],b:['def','agent','percept','return'],m:['obstacle','turn'],c:['battery_low','goal_found','return'],ca:['state','goal','utility']},
 S3:{predictQuestion:"ลำดับ visited ของ BFS จะเป็นอย่างไร",predictionValidation:'AIQ_PREDICT_PARITY_V1',outputValidation:'STRUCTURED_OUTPUT_V2',expected:"['A', 'B', 'C', 'D', 'E']",pg:[['bfs'],['dfs']],b:['deque','queue','visited'],m:["'f'","'d'"],ma:['stack','dfs','pop()'],c:['goal','path','visited'],ca:['break','return']},
 B1:{predictQuestion:"Agent จะเลือก action ใดเมื่อ percept เป็น blocked",predictionValidation:'AIQ_PREDICT_PARITY_V1',outputValidation:'STRUCTURED_OUTPUT_V2',expected:'search_new_route',allowCombinedPredictReason:true,pg:[['agent','ตัวแทน'],['search','bfs','การค้นหา']],b:['choose_action','blocked','return'],m:['percept','return'],mc:{percept:3,return:3},c:['deque','blocked'],ca:['path','route','fallback']},
 S4:{predictQuestion:"UCS จะ pop โหนดใดก่อนจาก Frontier ที่เริ่มด้วย (0, 'A') และเพราะอะไร",expected:'D 6',outputValidation:'S4_UCS_GOAL_COST_V1',predictionValidation:'S4_FIRST_POP_PREDICT_V1',pg:[['a'],['0']],b:['heapq','frontier','cost'],m:["'b'","'c'",'1'],c:['parent','path','cost'],ca:['best_cost','distance','visited']},
 S5:{predictQuestion:"ค่า f ของโหนด B เท่ากับเท่าไร",predictionValidation:'AIQ_PREDICT_PARITY_V1',outputValidation:'STRUCTURED_OUTPUT_V2',expected:'B 4',pg:[['b'],['4']],b:['g','h','print'],m:["'d'",'3','1'],c:['astar','heapq','path'],ca:['heuristic','h[','g_score']},
 S6:{predictQuestion:"ราก MAX จะเลือกคะแนนเท่าไร",predictionValidation:'AIQ_PREDICT_PARITY_V1',expected:'3',outputValidation:'S6_NUMERIC_RESULT_V1',pg:[['3']],b:['scores','min','max'],m:['8','1','6','4'],c:['minimax','max','min','alpha','beta'],ca:['maximizing','maximizing_player']},
 B2:{predictQuestion:"ระบบจะเลือกกลยุทธ์ใด",predictionValidation:'AIQ_PREDICT_PARITY_V1',outputValidation:'STRUCTURED_OUTPUT_V2',expected:'A*',pg:[['a*','astar','a star']],b:['weighted','heuristic','strategy'],m:['false','weighted','ucs'],c:['choose_strategy','bfs','ucs','a*','minimax'],ca:['reason','tradeoff','memory']},
 S7:{predictQuestion:"โปรแกรมจะแสดงข้อสรุปอะไร",predictionValidation:'AIQ_PREDICT_PARITY_V1',outputValidation:'STRUCTURED_OUTPUT_V2',expected:'can_fly',pg:[['can_fly','can fly','บินได้']],b:['facts','bird','has_wings'],m:['penguin','cannot_fly'],c:['forward_chaining','facts','rules'],ca:['conflict','explanation','trace']},
 S8:{predictQuestion:"posterior ที่ปัดทศนิยม 3 ตำแหน่งคือเท่าไร",predictionValidation:'AIQ_PREDICT_PARITY_V1',outputValidation:'STRUCTURED_OUTPUT_V2',expected:'0.154',pg:[['0.154']],b:['prior','sensitivity','posterior'],m:['0.10'],c:['bayes','prior','likelihood','posterior'],ca:['evidence','normalize','network']},
 S9:{predictQuestion:"ระบบจะแนะนำอะไร",predictionValidation:'AIQ_PREDICT_PARITY_V1',outputValidation:'STRUCTURED_OUTPUT_V2',s9ScenarioBatchValidation:'S9_SCENARIO_BATCH_V1',expected:'recommend_checkup',pg:[['recommend_checkup','recommend checkup','ตรวจสุขภาพ','แนะนำตรวจ']],b:['symptoms','fever','cough'],m:['rest_and_monitor','not','cough'],c:['inference_engine','rules','reason'],ca:['conflict','explanation','referral']},
 B3:{predictQuestion:"ระบบจะแสดงผลอะไร",predictionValidation:'AIQ_PREDICT_PARITY_V1',outputValidation:'STRUCTURED_OUTPUT_V2',expected:'high_risk_with_evidence',pg:[['high_risk_with_evidence','high risk','ความเสี่ยงสูง'],['evidence','หลักฐาน']],b:['facts','probability','0.8'],m:['medium_risk','0.5','0.8'],c:['decision','confidence','explanation'],ca:['evidence','review','conflict']},
 S10:{predictQuestion:"โปรแกรมจะแสดงจำนวน train และ test เท่าไร",predictionValidation:'AIQ_PREDICT_PARITY_V1',outputValidation:'STRUCTURED_OUTPUT_V2',expected:'8 2',pg:[['8'],['2']],b:['data','train','test'],m:['0.7','train','test'],c:['split_data','ratio','seed'],ca:['leakage','overlap','set(']},
 S11:{predictQuestion:"predictions จะเป็นรายการใด",predictionValidation:'AIQ_PREDICT_PARITY_V1',outputValidation:'STRUCTURED_OUTPUT_V2',expected:'[0, 1, 1]',pg:[['[0, 1, 1]','0 1 1']],b:['scores','predictions','0.5'],m:['0.8'],c:['confusion_matrix','y_true','y_pred','accuracy','precision','recall'],ca:['f1','false_positive','false_negative']},
 S12:{predictQuestion:"clusters จะเป็นรายการใด",predictionValidation:'AIQ_PREDICT_PARITY_V1',outputValidation:'STRUCTURED_OUTPUT_V2',expected:'[0, 0, 1, 1]',pg:[['[0, 0, 1, 1]','0 0 1 1']],b:['points','centers','clusters'],m:['5'],ma:['tie','equal','<=','>='],c:['kmeans','clusters','centroids'],ca:['iteration','range(2','inertia','silhouette']},
 B4:{predictQuestion:"ระบบจะวินิจฉัยว่าอะไร",predictionValidation:'AIQ_PREDICT_PARITY_V1',outputValidation:'STRUCTURED_OUTPUT_V2',expected:'overfitting',pg:[['overfitting','overfit','เรียนเกิน','โอเวอร์ฟิต']],b:['train_accuracy','test_accuracy','0.2'],m:['underfitting','0.6'],c:['evaluate_model','diagnosis','recommendation'],ca:['metrics','evidence','deployment']},
 S13:{predictQuestion:"ค่า output หลัง ReLU เท่ากับเท่าไร",predictionValidation:'AIQ_PREDICT_PARITY_V1',outputValidation:'STRUCTURED_OUTPUT_V2',expected:'0.1',pg:[['0.1']],b:['x','w','b'],ba:['max(0','relu'],m:['sigmoid','exp','z'],c:['dense_layer','weights','bias','outputs'],ca:['loss','gradient','backprop']},
 S14:{predictQuestion:"new_q เท่ากับเท่าไร",predictionValidation:'AIQ_PREDICT_PARITY_V1',outputValidation:'STRUCTURED_OUTPUT_V2',expected:'0.55',allowQTableUpdateEquivalent:true,pg:[['0.55']],b:['q','reward','alpha','new_q'],m:['gamma','next_max_q'],c:['epsilon_greedy','explore','exploit','random'],ca:['reward','episode','decay']},
 S15:{predictQuestion:"ระบบจะเลือกเอกสารใด",predictionValidation:'AIQ_PREDICT_PARITY_V1',outputValidation:'STRUCTURED_OUTPUT_V2',expected:'RAG retrieves evidence',pg:[['rag'],['retriev','evidence','หลักฐาน','ค้นคืน']],b:['documents','query','selected'],m:['lower'],c:['simple_rag','answer','sources','fallback'],ca:['citation','grounding','evidence']},
 B5:{predictQuestion:"ระบบจะแสดงสถานะใด",predictionValidation:'AIQ_PREDICT_PARITY_V1',outputValidation:'STRUCTURED_OUTPUT_V2',expected:'review_with_evidence',pg:[['review_with_evidence','human review','human_review','ตรวจโดยมนุษย์','ทบทวนโดยมนุษย์'],['evidence','หลักฐาน']],b:['prediction','confidence','evidence'],m:['human_review','0.75'],c:['trustworthy_ai_decision','decision','confidence','evidence','fairness_check','audit_log'],ca:['privacy','human_review','explanation']}
});

AIQCODING.ss_ = function(){ var ss=SpreadsheetApp.getActiveSpreadsheet(); if(!ss)throw new Error('SPREADSHEET_NOT_FOUND'); return ss; };
AIQCODING.ensureSheet_ = function(){
  var ss=AIQCODING.ss_(),sh=ss.getSheetByName(AIQCODING.SHEET);
  if(!sh)sh=ss.insertSheet(AIQCODING.SHEET);
  if(sh.getLastRow()===0){ sh.getRange(1,1,1,AIQCODING.HEADERS.length).setValues([AIQCODING.HEADERS]); sh.setFrozenRows(1); return sh; }
  var lastCol=Math.max(1,sh.getLastColumn());
  var existing=sh.getRange(1,1,1,lastCol).getDisplayValues()[0].map(AIQCODING.text_);
  var keys={}; existing.forEach(function(h){keys[AIQCODING.key_(h)]=true;});
  var missing=AIQCODING.HEADERS.filter(function(h){return !keys[AIQCODING.key_(h)];});
  if(missing.length)sh.getRange(1,lastCol+1,1,missing.length).setValues([missing]);
  sh.setFrozenRows(1); return sh;
};
AIQCODING.writeCodingRow_ = function(sh,obj){
  // Preserve legacy Sheet column order. Never append HEADERS-ordered values
  // to a differently ordered existing header row.
  var headers=sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0];
  var vals={},present={};
  AIQCODING.HEADERS.forEach(function(h){vals[AIQCODING.key_(h)]=obj[h]==null?'':obj[h];});
  headers.forEach(function(h){var k=AIQCODING.key_(h);if(k)present[k]=true;});
  var critical=['student_id','section','session_id','coding_attempt_id','coding_score','completed'];
  critical.forEach(function(h){
    var k=AIQCODING.key_(h);
    if(!present[k])throw Error('CODING_HEADER_MISSING_'+k);
  });
  // Historical Sheets may contain both student_id/studentId etc. Write the
  // same source value to EVERY normalized alias of a canonical field, so
  // the first-column Flow reader and last-key Status Repair agree.
  var row=headers.map(function(h){
    var k=AIQCODING.key_(h);
    return Object.prototype.hasOwnProperty.call(vals,k)?vals[k]:'';
  });
  sh.appendRow(row);
};

AIQCODING.objectRows_ = function(sh){
  if(!sh||sh.getLastRow()<2||sh.getLastColumn()<1)return [];
  var values=sh.getDataRange().getDisplayValues(),headers=values[0].map(AIQCODING.text_);
  return values.slice(1).map(function(row,idx){
    var o={_sheet:sh.getName(),_row:idx+2};
    headers.forEach(function(h,i){if(h){o[h]=row[i];o[AIQCODING.key_(h)]=row[i];}}); return o;
  }).filter(function(o){return Object.keys(o).some(function(k){return k.charAt(0)!=='_'&&AIQCODING.text_(o[k])!=='';});});
};
AIQCODING.allHistoricalRows_ = function(){
  var ss=AIQCODING.ss_(),seen={},rows=[];
  AIQCODING.SHEET_CANDIDATES.forEach(function(name){ var sh=ss.getSheetByName(name); if(!sh||seen[sh.getSheetId()])return; seen[sh.getSheetId()]=true; rows=rows.concat(AIQCODING.objectRows_(sh)); });
  return rows;
};
AIQCODING.pick_ = function(row,names){ row=row||{}; for(var i=0;i<names.length;i++){ var n=names[i],v=row[n]; if(v===undefined)v=row[AIQCODING.key_(n)]; if(v!==undefined&&v!==null&&AIQCODING.text_(v)!=='')return v; } return ''; };
AIQCODING.rowIdentity_ = function(row){return {
  studentId:AIQCODING.text_(AIQCODING.pick_(row,['student_id','studentId','studentid','id','pid'])),
  studentName:AIQCODING.text_(AIQCODING.pick_(row,['student_name','studentName','studentname','name'])),
  section:AIQCODING.section_(AIQCODING.pick_(row,['section','section_id','sectionId'])||'101'),
  sessionId:AIQCODING.session_(AIQCODING.pick_(row,['session_id','sessionId','session','mission_id','missionId','mission']))
};};
AIQCODING.rowScore_ = function(row){
  var direct=AIQCODING.pick_(row,['coding_score','codingScore','best_score','bestScore','score','total_score','totalScore']);
  if(AIQCODING.text_(direct)!=='')return AIQCODING.num_(direct);
  return AIQCODING.num_(AIQCODING.pick_(row,['run_score','runScore']))+AIQCODING.num_(AIQCODING.pick_(row,['modify_score','modifyScore']))+AIQCODING.num_(AIQCODING.pick_(row,['challenge_score','challengeScore']))+Math.min(20,AIQCODING.num_(AIQCODING.pick_(row,['quiz_score','quizScore']))*4);
};
AIQCODING.rowCompleted_ = function(row){ return AIQCODING.rowScore_(row)>=60||AIQCODING.bool_(AIQCODING.pick_(row,['completed','passed','mastered','status','coding_completed','codingCompleted'])); };
AIQCODING.rowSubmittedAt_ = function(row){return AIQCODING.text_(AIQCODING.pick_(row,['submitted_at','submittedAt','serverTs','clientTs','timestamp','created_at','createdAt']));};
AIQCODING.matches_ = function(row,studentId,section,sessionId){ var x=AIQCODING.rowIdentity_(row); return x.studentId===studentId&&x.section===AIQCODING.section_(section)&&x.sessionId===AIQCODING.session_(sessionId); };

AIQCODING.parseV31_ = function(payload){
  var predictionRaw=AIQCODING.text_(payload.predictionAnswer),marker=' | Reason: ',at=predictionRaw.indexOf(marker);
  var modifiedRaw=AIQCODING.text_(payload.modifiedCode),scenarioMarker='# Scenario Modification',scenarioAt=modifiedRaw.indexOf(scenarioMarker);
  var challengeRaw=AIQCODING.text_(payload.challengeCode),quizMatch=challengeRaw.match(/#\s*QuizScore\s+(\d+)\s*\/\s*5/i),levelMatch=challengeRaw.match(/#\s*Level\s+([^\r\n]+)/i);
  return {
    predictionAnswer:at>=0?predictionRaw.slice(0,at).trim():predictionRaw,
    predictionReason:at>=0?predictionRaw.slice(at+marker.length).trim():AIQCODING.text_(payload.predictionReason),
    completedCode:scenarioAt>=0?modifiedRaw.slice(0,scenarioAt).trim():AIQCODING.text_(payload.completedCode),
    scenarioCode:scenarioAt>=0?modifiedRaw.slice(scenarioAt+scenarioMarker.length).trim():modifiedRaw,
    challengeCode:challengeRaw,
    quizScore:quizMatch?Math.max(0,Math.min(5,Number(quizMatch[1]))):Number(payload.quizScore||0),
    challengeLevel:levelMatch?AIQCODING.text_(levelMatch[1]):AIQCODING.text_(payload.challengeLevel)
  };
};
AIQCODING.s4FirstPopPredictV1_ = function(prediction,reason) {
  // Predict asks FIRST UCS pop (A with cost 0), not final Output D 6.
  var p=String(prediction||'').trim(),r=String(reason||'').trim(),t=p+' '+r;
  var result=function(passed,issue){return {passed:passed,mode:'S4_FIRST_POP_PREDICT_V1',issue:issue||''};};
  if(!p)return result(false,'PREDICTION_EMPTY');
  if(r.length<20)return result(false,'REASON_TOO_SHORT');
  var firstA=/^(?:node\s+|โหนด\s*)?A\s*$/i.test(p)||
    /(?:pop|expand|dequeue|นำโหนด|ดึงโหนด|ขยายโหนด)[^\r\n]{0,50}\bA\b/i.test(p)||
    /\bA\b[^\r\n]{0,35}(?:ก่อน|first|แล้วค่อย|then\s+B)/i.test(p)||
    /(?:แรก|เริ่มต้น|อันดับแรก)[^\r\n]{0,40}\bA\b/i.test(p);
  var inconsistent=/(?:^|[^A-Za-z0-9_])[BCD]\s*(?:ก่อน|first|อันดับแรก)/i.test(p)||
    /\b(?:pop|expand|dequeue)\s*(?:node|โหนด)?\s*[BCD]\s+(?:ก่อน|first)\b/i.test(p)||
    /\bnot\s+(?:node\s+)?A\s+first\b/i.test(p)||/ไม่(?:ใช่)?\s*โหนด\s*A\s*ก่อน/i.test(p);
  if(!firstA||inconsistent)return result(false,'FIRST_POP_MUST_BE_A');
  var m,wrongA=false,wrongB=false;
  var ga=/\bg\s*\(\s*A\s*\)\s*(?:=|:|เท่ากับ)\s*(-?\d+(?:\.\d+)?)/gi;
  var gb=/\bg\s*\(\s*B\s*\)\s*(?:=|:|เท่ากับ)\s*(-?\d+(?:\.\d+)?)/gi;
  while((m=ga.exec(t))!==null)if(Number(m[1])!==0)wrongA=true;
  while((m=gb.exec(t))!==null)if(Number(m[1])!==2)wrongB=true;
  if(wrongA)return result(false,'G_A_MUST_BE_0');
  if(wrongB)return result(false,'G_B_MUST_BE_2');
  var ucs=/\b(?:UCS|Uniform\s*Cost\s*Search)\b/i.test(r);
  var cost=/\bg\s*\(\s*[A-D]\s*\)|\b(?:cumulative|path)\s*cost\b|\bcost\b|ต้นทุน|ค่าใช้จ่าย/i.test(r);
  var minimum=/ต่ำ(?:กว่า|สุด)|น้อย(?:กว่า|สุด)|\b(?:min(?:imum)?|lowest|smallest|priority\s*queue)\b|คิวลำดับความสำคัญ/i.test(r);
  var zero=/\bg\s*\(\s*A\s*\)\s*(?:=|:|เท่ากับ)\s*0(?:\.0+)?\b/i.test(t)||
    /(?:โหนด\s*)?\bA\b[^\r\n]{0,35}(?:cost|ต้นทุน|g)\s*(?:=|:|เท่ากับ)?\s*0(?:\.0+)?\b/i.test(t)||
    /(?:เริ่มต้น|เริ่มที่|initial|start)[^\r\n]{0,35}(?:cost|ต้นทุน|g)?\s*(?:=|:|เท่ากับ)?\s*0(?:\.0+)?\b/i.test(t);
  if(!zero)return result(false,'START_COST_A_ZERO_NOT_EXPLAINED');
  if(!ucs||!cost||!minimum)return result(false,'UCS_LOWEST_PATH_COST_REASON_MISSING');
  return result(true,'');
};

AIQCODING.aiqPredictAnswerParityV1_ = function(stage,prediction,reason,rule,validateOutput,matchesGroups,s4Check){
  // Shared Web+GAS Predict checker, aligned with canonical lab.predict.
  // Retains old activity concept answers except for numerical/vector gates.
  var p=String(prediction||'').trim(),r=String(reason||'').trim();
  function out(ok,issue,mode){return {passed:!!ok,issue:issue||'',mode:mode||'PREDICT_ANSWER_PARITY_V1'};}
  if(!p)return out(false,'PREDICTION_EMPTY');
  if(r.length<20)return out(false,'REASON_TOO_SHORT');
  if(stage==='S4')return s4Check(p,r);
  var answer=validateOutput(stage,p,rule);
  var numeric={S5:1,S6:1,S8:1,S10:1,S11:1,S12:1,S13:1,S14:1};
  var source=rule&&rule.allowCombinedPredictReason?p+' '+r:p;
  var oldConcept=!numeric[stage]&&matchesGroups(source,(rule&&rule.pg)||[]);
  if(/\b(?:no|not|never|cannot|can't|don't)\b|(?:ไม่ใช่|ไม่ต้อง|ไม่ได้)/i.test(p))oldConcept=false;
  if(stage==='S5'){
    var text=p+' '+r,seen=[],m;
    var token=/\bf\s*\(\s*B\s*\)\s*[:=]\s*(-?\d+(?:\.\d+)?)|\bB\s*(?:[:=]|\s+)\s*(-?\d+(?:\.\d+)?)\b/gi;
    while((m=token.exec(text))!==null)seen.push(Number(m[1]||m[2]));
    var c=/\bf\s*\(\s*C\s*\)\s*[:=]\s*(-?\d+(?:\.\d+)?)/gi;
    while((m=c.exec(text))!==null)if(Number(m[1])!==4)return out(false,'S5_F_C_INCORRECT');
    if(seen.some(function(x){return x!==4;}))return out(false,'S5_F_B_INCORRECT');
    return answer.passed||seen.length>0?out(true,'','S5_COMPUTED_RESULT'):out(false,'S5_CALCULATED_VALUE_REQUIRED');
  }
  if(stage==='S8'&&answer.passed){
    var n=r.toLowerCase().replace(/\s+/g,'');
    if(!(/prior|ฐานเดิม/.test(n)&&/likelihood|sensitivity|ความไว/.test(n)&&
      /evidence|normaliz|หลักฐาน|ตัวหาร/.test(n)&&/posterior|ภายหลัง|หลังเห็นหลักฐาน/.test(n)))
      return out(false,'S8_BAYES_REASON_MISSING');
  }
  if(stage==='B5'&&/\bREJECT\s*\/\s*HOLD\b/i.test(p)&&
    /(?:privacy|ความเป็นส่วนตัว)[^\r\n]{0,45}(?:fail|false|ไม่ผ่าน|ละเมิด)|(?:fail|false|ไม่ผ่าน)[^\r\n]{0,45}(?:privacy|ความเป็นส่วนตัว)/i.test(r))
    return out(true,'','B5_REASONED_PRIVACY_HOLD');
  if(answer.passed)return out(true,'','CANONICAL_RESULT');
  if(oldConcept)return out(true,'','PREVIOUS_ACTIVITY_CONCEPT');
  return out(false,'PREDICT_RESULT_NOT_CONFIRMED');
};

AIQCODING.validatePredictV1_ = function(stage,prediction,reason,rule){
  return AIQCODING.aiqPredictAnswerParityV1_(
    stage,prediction,reason,rule,
    function(s,text,r){return AIQCODING.validateOutputEvidence_(s,text,r);},
    function(text,groups){return AIQCODING.matchesGroups_(text,groups);},
    function(p,r){return AIQCODING.s4FirstPopPredictV1_(p,r);}
  );
};

AIQCODING.validateEvidenceV31_ = function(sessionId,payload){
  var x=AIQCODING.parseV31_(payload),rule=AIQCODING.RULES[sessionId],output=AIQCODING.text_(payload.output);
  if(!rule)return {mode:'TEACHING_V3_2_2_CONCEPT_GROUPS',predictionCorrect:false,completedCodePassed:false,outputPassed:false,modifyPassed:false,challengePassed:false,challengeAttempted:false,quizPassed:false,quizScore:0,runScore:0,modifyScore:0,challengeScore:0,quizPoint:0,parsed:x,diagnostics:{error:'RULE_NOT_FOUND'}};

  var expected=AIQCODING.norm_(rule.expected);
  var predictionSource=rule.allowCombinedPredictReason?(x.predictionAnswer+' '+x.predictionReason):x.predictionAnswer;
  var predictionResult=AIQCODING.validatePredictV1_(sessionId,x.predictionAnswer,x.predictionReason,rule);
  var predictionCorrect=predictionResult.passed;
  var missingCode=AIQCODING.missing_(x.completedCode,rule.b);
  var acceptedEquivalent=!!(rule.allowQTableUpdateEquivalent&&sessionId==='S14'&&missingCode.length===1&&missingCode[0]==='new_q'&&AIQCODING.s14QTableUpdateEquivalent_(x.completedCode));
  var completedCodePassed=x.completedCode.length>=40&&!/\bTODO\b/i.test(x.completedCode)&&(missingCode.length===0||acceptedEquivalent)&&AIQCODING.containsAny_(x.completedCode,rule.ba);
  var outputResult=AIQCODING.validateOutputEvidence_(sessionId,output,rule);
  var outputPassed=outputResult.passed;
  var modifyPassed=x.scenarioCode.length>=30&&AIQCODING.containsAll_(x.scenarioCode,rule.m)&&AIQCODING.containsAny_(x.scenarioCode,rule.ma)&&AIQCODING.minCounts_(x.scenarioCode,rule.mc);
  var challengeBody=x.challengeCode.replace(/#\s*(Level|QuizScore)[^\r\n]*/gi,'').trim();
  var challengeAttempted=challengeBody.length>0;
  var challengePassed=challengeAttempted&&challengeBody.length>=20&&AIQCODING.containsAll_(challengeBody,rule.c)&&AIQCODING.containsAny_(challengeBody,rule.ca)&&AIQCODING.minCounts_(challengeBody,rule.cc);
  var quizPassed=x.quizScore>=4;

  return {
    mode:'TEACHING_V3_2_2_CONCEPT_GROUPS',predictionCorrect:predictionCorrect,completedCodePassed:completedCodePassed,outputPassed:outputPassed,modifyPassed:modifyPassed,challengeAttempted:challengeAttempted,challengePassed:challengePassed,quizPassed:quizPassed,quizScore:x.quizScore,
    runScore:(completedCodePassed&&outputPassed)?25:0,modifyScore:modifyPassed?35:0,challengeScore:challengePassed?20:0,quizPoint:quizPassed?20:x.quizScore*4,parsed:x,
    diagnostics:{expectedOutput:rule.expected,predictConceptGroups:rule.pg||[[rule.expected]],predictionValidationMode:predictionResult.mode,predictionIssue:predictionResult.issue,predictionReasonLength:x.predictionReason.length,outputValidationMode:outputResult.mode,outputIssue:outputResult.issue,combinedPredictReasonUsed:!!(rule.allowCombinedPredictReason&&!AIQCODING.matchesGroups_(x.predictionAnswer,rule.pg||[[rule.expected]])&&predictionCorrect),qTableUpdateEquivalentAccepted:acceptedEquivalent,missingCompletedKeywords:acceptedEquivalent?[]:missingCode,missingModifyKeywords:AIQCODING.missing_(x.scenarioCode,rule.m),missingChallengeKeywords:challengeAttempted?AIQCODING.missing_(challengeBody,rule.c):[],challengePolicy:'optional-bonus-20'}
  };
};
AIQCODING.validateEvidenceLegacy_ = function(sessionId,payload){
  var rule=AIQCODING.RULES[sessionId];
  if(!rule)return {mode:'LEGACY_V2',predictionCorrect:false,completedCodePassed:false,outputPassed:false,modifyPassed:false,challengePassed:false,challengeAttempted:false,quizPassed:false,quizScore:0,runScore:0,modifyScore:0,challengeScore:0,quizPoint:0,parsed:{}};
  var prediction=AIQCODING.text_(payload.predictionAnswer),output=AIQCODING.norm_(payload.output),modified=AIQCODING.text_(payload.modifiedCode),challenge=AIQCODING.text_(payload.challengeCode),expected=AIQCODING.norm_(rule.expected);
  var predictionCorrect=sessionId==='S4'&&rule.predictionValidation==='S4_FIRST_POP_PREDICT_V1'?AIQCODING.s4FirstPopPredictV1_(prediction,AIQCODING.text_(payload.predictionReason)).passed:AIQCODING.matchesGroups_(prediction,rule.pg||[[rule.expected]]);
  var outputPassed=AIQCODING.validateOutputEvidence_(sessionId,payload.output,rule).passed;
  var modifyPassed=AIQCODING.containsAll_(modified,rule.m)&&AIQCODING.containsAny_(modified,rule.ma)&&AIQCODING.minCounts_(modified,rule.mc);
  var challengeAttempted=challenge.length>0;
  var challengePassed=challengeAttempted&&AIQCODING.containsAll_(challenge,rule.c)&&AIQCODING.containsAny_(challenge,rule.ca)&&AIQCODING.minCounts_(challenge,rule.cc);
  return {mode:'LEGACY_V2_CONCEPT_GROUPS',predictionCorrect:predictionCorrect,completedCodePassed:true,outputPassed:outputPassed,modifyPassed:modifyPassed,challengeAttempted:challengeAttempted,challengePassed:challengePassed,quizPassed:true,quizScore:0,runScore:outputPassed?30:0,modifyScore:modifyPassed?50:0,challengeScore:challengePassed?20:0,quizPoint:0,parsed:{predictionAnswer:AIQCODING.text_(payload.predictionAnswer),predictionReason:'legacy',completedCode:'legacy',scenarioCode:modified,challengeCode:challenge,challengeLevel:'legacy'}};
};
AIQCODING.validateEvidence_ = function(sessionId,payload){
  // All newly submitted Coding Labs must satisfy every V3.1 evidence field.
  // Historical legacy records remain readable; old thin submissions can no
  // longer be granted Completed Code or Quiz completion by default.
  return AIQCODING.validateEvidenceV31_(sessionId,payload||{});
};

AIQCODING.submit_ = function(payload){
  payload=payload||{};
  var sessionId=AIQCODING.session_(payload.sessionId),studentId=AIQCODING.text_(payload.studentId),studentName=AIQCODING.text_(payload.studentName),section=AIQCODING.section_(payload.section||'101');
  if(!AIQCODING.allowedLab_(sessionId)||!AIQCODING.RULES[sessionId])return {ok:false,code:'LAB_NOT_AVAILABLE',sessionId:sessionId,version:AIQCODING.VERSION};
  if(!studentId||!studentName||!section)return {ok:false,code:'MISSING_IDENTITY',version:AIQCODING.VERSION};

  var evidence=AIQCODING.validateEvidence_(sessionId,payload);
  if(!evidence.predictionCorrect)return {ok:false,code:'PREDICTION_SEMANTIC_FAILED',message:'คำตอบ Predict ต้องสะท้อนแนวคิด/ผลที่โจทย์ถาม และมีเหตุผลอย่างน้อย 20 ตัวอักษร',evidence:evidence,version:AIQCODING.VERSION};
  if(!evidence.completedCodePassed)return {ok:false,code:'COMPLETED_CODE_SEMANTIC_FAILED',message:'Completed Code ยังไม่ครบองค์ประกอบสำคัญของด่าน หรือยังมี TODO',evidence:evidence,version:AIQCODING.VERSION};
  if(!evidence.outputPassed)return {ok:false,code:'OUTPUT_SEMANTIC_FAILED',message:'Output Evidence ไม่ตรงกับผลที่โจทย์กำหนด',evidence:evidence,version:AIQCODING.VERSION};
  if(!evidence.modifyPassed)return {ok:false,code:'MODIFY_SEMANTIC_FAILED',message:'Scenario Modification ยังไม่มีเงื่อนไขสำคัญของด่าน',evidence:evidence,version:AIQCODING.VERSION};
  if(!evidence.quizPassed)return {ok:false,code:'QUIZ_NOT_PASSED',message:'Mini Quiz ต้องผ่านอย่างน้อย 4/5',evidence:evidence,version:AIQCODING.VERSION};

  var allBefore=AIQCODING.allHistoricalRows_();
  var historical=allBefore.filter(function(r){return AIQCODING.matches_(r,studentId,section,sessionId);});
  var attemptNumber=historical.length+1;
  var score=evidence.runScore+evidence.modifyScore+evidence.challengeScore+evidence.quizPoint;
  var completed=evidence.predictionCorrect&&evidence.completedCodePassed&&evidence.outputPassed&&evidence.modifyPassed&&evidence.quizPassed;
  var now=Utilities.formatDate(new Date(),'Asia/Bangkok',"yyyy-MM-dd'T'HH:mm:ssXXX");
  var attemptId=AIQCODING.text_(payload.codingAttemptId||Utilities.getUuid());
  var duplicateRows=allBefore.filter(function(r){
    return AIQCODING.text_(AIQCODING.pick_(r,['coding_attempt_id','codingAttemptId','attemptId']))===attemptId;
  });
  if(duplicateRows.length&&!duplicateRows.some(function(r){return AIQCODING.matches_(r,studentId,section,sessionId);}))
    return {ok:false,code:'ATTEMPT_ID_COLLISION',version:AIQCODING.VERSION};
  var duplicate=duplicateRows.length>0;

  if(!duplicate){
    var x=evidence.parsed||{};
    var obj={
      submitted_at:now,coding_attempt_id:attemptId,student_id:studentId,student_name:studentName,section:section,session_id:sessionId,
      attempt_number:attemptNumber,prediction_answer:x.predictionAnswer||'',prediction_reason:x.predictionReason||'',prediction_correct:true,
      run_score:evidence.runScore,modify_score:evidence.modifyScore,challenge_score:evidence.challengeScore,quiz_score:evidence.quizScore,coding_score:score,completed:completed,
      run_count:Number(payload.runCount||0),error_count:Number(payload.errorCount||0),error_types_json:JSON.stringify(payload.errorTypes||[]),
      output:AIQCODING.text_(payload.output).slice(0,5000),completed_code:AIQCODING.text_(x.completedCode).slice(0,20000),modified_code:AIQCODING.text_(x.scenarioCode).slice(0,20000),
      challenge_code:AIQCODING.text_(x.challengeCode).slice(0,20000),challenge_level:x.challengeLevel||'',validation_mode:evidence.mode,
      used_time_sec:Number(payload.usedTimeSec||0),version:AIQCODING.VERSION
    };
    AIQCODING.writeCodingRow_(AIQCODING.ensureSheet_(),obj);
    SpreadsheetApp.flush();
  }

  // A successful write call alone is not proof that the evidence can be
  // matched later by the same status API. Fail closed on unreadable receipts.
  var readBack=AIQCODING.allHistoricalRows_().filter(function(r){
    return AIQCODING.text_(AIQCODING.pick_(r,['coding_attempt_id','codingAttemptId','attemptId']))===attemptId &&
      AIQCODING.matches_(r,studentId,section,sessionId);
  });
  var saved=readBack.length?readBack[readBack.length-1]:null;
  if(!saved||!AIQCODING.rowCompleted_(saved)){
    return {ok:false,code:'CODING_WRITE_NOT_CONFIRMED',studentId:studentId,section:section,sessionId:sessionId,version:AIQCODING.VERSION};
  }
  return {ok:true,duplicate:duplicate,studentId:studentId,studentName:studentName,section:section,sessionId:sessionId,attemptNumber:attemptNumber,codingScore:AIQCODING.rowScore_(saved),completed:true,evidence:evidence,serverValidated:true,challengePolicy:'optional-bonus-20',authority:'Google Sheet coding evidence, exact normalized student ID',version:AIQCODING.VERSION};
};

AIQCODING.getStatus_ = function(payload){
  payload=payload||{};
  var studentId=AIQCODING.text_(payload.studentId),studentName=AIQCODING.text_(payload.studentName),section=AIQCODING.section_(payload.section||'101'),sessionId=AIQCODING.session_(payload.sessionId);
  if(!studentId||!section||!sessionId)return {ok:false,code:'MISSING_STATUS_IDENTITY',version:AIQCODING.VERSION};
  if(!AIQCODING.allowedLab_(sessionId))return {ok:false,code:'LAB_NOT_AVAILABLE',sessionId:sessionId,version:AIQCODING.VERSION};

  var all=AIQCODING.allHistoricalRows_();
  var rows=all.filter(function(r){return AIQCODING.matches_(r,studentId,section,sessionId);});
  rows.sort(function(a,b){ var ta=Date.parse(AIQCODING.rowSubmittedAt_(a))||AIQCODING.num_(AIQCODING.pick_(a,['attempt_number','attemptNumber'])); var tb=Date.parse(AIQCODING.rowSubmittedAt_(b))||AIQCODING.num_(AIQCODING.pick_(b,['attempt_number','attemptNumber'])); return ta-tb; });
  var latest=rows.length?rows[rows.length-1]:null,best=null;
  rows.forEach(function(r){if(!best||AIQCODING.rowScore_(r)>AIQCODING.rowScore_(best))best=r;});
  var bestScore=best?AIQCODING.rowScore_(best):0,sourceSheets=[];
  rows.forEach(function(r){if(sourceSheets.indexOf(r._sheet)<0)sourceSheets.push(r._sheet);});
  return {ok:true,action:'GET_CODING_STATUS',studentId:studentId,studentName:studentName,section:section,sessionId:sessionId,found:rows.length>0,completed:rows.some(AIQCODING.rowCompleted_),latestScore:latest?AIQCODING.rowScore_(latest):0,bestScore:bestScore,attemptCount:rows.length,latestAttempt:latest?AIQCODING.num_(AIQCODING.pick_(latest,['attempt_number','attemptNumber'])):0,submittedAt:latest?AIQCODING.rowSubmittedAt_(latest):'',sourceSheets:sourceSheets,scannedCodingRows:all.length,authority:'Google Sheet coding evidence, exact normalized student ID',version:AIQCODING.VERSION};
};
AIQCODING.auditStatus_ = function(payload){
  payload=payload||{}; var result=AIQCODING.getStatus_(payload);
  var target={studentId:AIQCODING.text_(payload.studentId),studentName:AIQCODING.text_(payload.studentName),section:AIQCODING.section_(payload.section||'101'),sessionId:AIQCODING.session_(payload.sessionId)};
  var rows=AIQCODING.allHistoricalRows_();
  var near=rows.filter(function(r){var x=AIQCODING.rowIdentity_(r);return x.studentId===target.studentId||x.studentName===target.studentName;}).slice(0,30).map(function(r){var x=AIQCODING.rowIdentity_(r);return {sheet:r._sheet,row:r._row,studentId:x.studentId,studentName:x.studentName,section:x.section,sessionId:x.sessionId,score:AIQCODING.rowScore_(r),completed:AIQCODING.rowCompleted_(r)};});
  result.debug={target:target,scannedSheets:AIQCODING.SHEET_CANDIDATES,totalCodingRows:rows.length,nearMatches:near}; return result;
};
AIQCODING.handle = function(payload){
  var action=AIQCODING.text_((payload||{}).action).toUpperCase();
  if(action==='SUBMIT_CODING_LAB')return AIQCODING.submit_(payload);
  if(action==='GET_CODING_STATUS')return AIQCODING.getStatus_(payload);
  if(action==='AUDIT_CODING_STATUS')return AIQCODING.auditStatus_(payload);
  if(action==='GET_LAB_CONFIG'){
    var sessionId=AIQCODING.session_(payload.sessionId);
    if(!AIQCODING.allowedLab_(sessionId))return {ok:false,code:'LAB_NOT_AVAILABLE',version:AIQCODING.VERSION};
    return {ok:true,version:AIQCODING.VERSION,sessionId:sessionId,config:AIQCODING.RULES[sessionId],challengePolicy:'optional-bonus-20'};
  }
  return {ok:false,code:'UNKNOWN_CODING_ACTION',action:action,version:AIQCODING.VERSION};
};