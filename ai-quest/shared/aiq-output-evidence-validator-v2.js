/**
 * CSAI2102 AI Quest output-evidence validator v2
 * Canonical pure source mirrored into GAS Coding Receiver and embedded web page.
 * Keep both implementations synchronized and verify with identical QA fixtures.
 * S4 and S6 retain existing dedicated validators; this function handles the other 18.
 * This is a deterministic structural checker, NOT general natural-language understanding.
 */
var AIQ_OUTPUT_VALIDATOR_VERSION='20261030-OUTPUT-EVIDENCE-V2.2-STRUCTURED-DICTIONARIES';
function structuredOutputEvidenceV2(stage,output) {
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
    case 'S9':return category(function(v){return /^(?:recommend[_\s-]*check[_\s-]*up|แนะนำตรวจ(?:สุขภาพ)?|ตรวจสุขภาพ)$/i.test(v)?'expected':'';});
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
    case 'B5':return category(function(v){return /^(?:(?:human[\s_-]+)?review[_\s-]*with[_\s-]*evidence|ทบทวนโดยมนุษย์พร้อมหลักฐาน)$/i.test(v)?'expected':'';});
    default:return result(false,'STAGE_NOT_SUPPORTED');
  }
}
