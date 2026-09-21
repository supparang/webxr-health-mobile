/* =========================================================
   CSAI2102 Teacher Console
   Stable Teacher Inspector v7.0.5 — Scroll Safe

   FIX 2026-09-21
   ---------------------------------------------------------
   1) Do NOT globally lock document.body scrolling
      when opening Teacher Inspector.
   2) Repair stale body/html overflow:hidden when no
      Inspector / Compare modal is active.
   3) Preserve existing V701 / V703 / V704 public APIs.
   4) Preserve one shell, one delegated handler.
   5) Preserve content-only tab switching.
   6) No MutationObserver.
   7) No interval.
   8) No full modal rerender.

   FILE:
   ai-quest/js/aiquest-teacher-inspector-stable-v703.js
   ========================================================= */

(()=>{
'use strict';


/* =========================================================
   SINGLETON GUARD
   ========================================================= */

if(window.__AIQUEST_TEACHER_INSPECTOR_STABLE_V705__){
  return;
}

window.__AIQUEST_TEACHER_INSPECTOR_STABLE_V705__=true;

/*
  Keep the previous guard as well so another legacy loader
  does not try to initialise the old inspector again.
*/
window.__AIQUEST_TEACHER_INSPECTOR_STABLE_V704__=true;


/* =========================================================
   VERSION / IDS
   ========================================================= */

const VERSION='v7.0.5-scroll-safe';

const MODAL='aqInspectorV704';

const COMPARE_MODAL='aqCompareV720';


/* =========================================================
   SESSION ORDER
   ========================================================= */

const ORDER=[
  's1',
  's2',
  's3',
  'b1',

  's4',
  's5',
  's6',
  'b2',

  's7',
  's8',
  's9',
  'b3',

  's10',
  's11',
  's12',
  'b4',

  's13',
  's14',
  's15',
  'b5'
];


/* =========================================================
   SESSION TITLES
   ========================================================= */

const TITLES={

  s1:
    'S1 • AI Awakening',

  s2:
    'S2 • Agent Builder',

  s3:
    'S3 • Search Maze',

  b1:
    'B1 • Foundation Boss Gate',

  s4:
    'S4 • Route Cost Challenge',

  s5:
    'S5 • A* Rescue Mission',

  s6:
    'S6 • Minimax Arena',

  b2:
    'B2 • Search & Game AI Boss Gate',

  s7:
    'S7 • Knowledge Base Forge',

  s8:
    'S8 • Uncertainty & Bayes Lab',

  s9:
    'S9 • Expert System Studio',

  b3:
    'B3 • Reasoning & Knowledge Boss',

  s10:
    'S10 • Data & Training Pipeline',

  s11:
    'S11 • Supervised Learning',

  s12:
    'S12 • Unsupervised Learning',

  b4:
    'B4 • Machine Learning Boss Gate',

  s13:
    'S13 • Neural Network',

  s14:
    'S14 • NLP / Generative AI / RAG',

  s15:
    'S15 • AI Deployment & Governance',

  b5:
    'B5 • Final AI Quest Boss'
};


/* =========================================================
   BASIC HELPERS
   ========================================================= */

const esc=v=>
  String(v==null ? '' : v)
    .replace(
      /[&<>"']/g,
      c=>({
        '&':'&amp;',
        '<':'&lt;',
        '>':'&gt;',
        '"':'&quot;',
        "'":'&#039;'
      }[c])
    );


const arr=v=>
  Array.isArray(v)
    ? v
    : [];


const obj=v=>
  v &&
  typeof v==='object' &&
  !Array.isArray(v)
    ? v
    : {};


const num=(v,d=0)=>
  Number.isFinite(Number(v))
    ? Number(v)
    : d;


const parse=v=>{

  if(
    v &&
    typeof v==='object'
  ){
    return v;
  }

  if(
    typeof v==='string'
  ){

    try{
      return JSON.parse(v);
    }
    catch(e){
      return {};
    }

  }

  return {};
};


/* =========================================================
   TEACHER RUNTIME
   ========================================================= */

const runtime=()=>(
  window.AIQUEST_TEACHER_SAFE_V533 ||
  window.AIQUEST_TEACHER_SAFE_V532 ||
  null
);


/* =========================================================
   DATE / TIMESTAMP
   ========================================================= */

const stamp=a=>
  Date.parse(
    String(
      a?.serverTs ||
      a?.clientTs ||
      a?.timestamp ||
      ''
    )
  ) || 0;


const dt=a=>
  stamp(a)
    ? new Date(stamp(a))
        .toLocaleString('th-TH')
    : '—';


/* =========================================================
   CANONICAL SESSION
   ========================================================= */

const canon=v=>{

  const x=
    String(v||'')
      .toLowerCase()
      .trim()
      .replace(
        /[\s_\-:]+/g,
        ''
      );


  const m={

    m1:'s1',
    session1:'s1',
    mission1:'s1',

    m2:'s2',
    session2:'s2',
    mission2:'s2',

    m3:'s3',
    session3:'s3',
    mission3:'s3',

    boss1:'b1',

    m4:'s4',
    session4:'s4',
    mission4:'s4',

    m5:'s5',
    session5:'s5',
    mission5:'s5',

    m6:'s6',
    session6:'s6',
    mission6:'s6',

    boss2:'b2',

    m7:'s7',
    session7:'s7',
    mission7:'s7',

    m8:'s8',
    session8:'s8',
    mission8:'s8',

    m9:'s9',
    session9:'s9',
    mission9:'s9',

    boss3:'b3',

    m10:'s10',
    session10:'s10',
    mission10:'s10',

    m11:'s11',
    session11:'s11',
    mission11:'s11',

    m12:'s12',
    session12:'s12',
    mission12:'s12',

    boss4:'b4',

    m13:'s13',
    session13:'s13',
    mission13:'s13',

    m14:'s14',
    session14:'s14',
    mission14:'s14',

    m15:'s15',
    session15:'s15',
    mission15:'s15',

    boss5:'b5'
  };


  return m[x] || x;
};


/* =========================================================
   ATTEMPT METADATA
   ========================================================= */

function meta(a){

  const e=
    parse(
      a?.extraJson ||
      a?.extra
    );


  const raw=
    obj(
      e.raw ||
      a?.raw
    );


  const nested=
    parse(
      raw.extraJson ||
      e.extraJson
    );


  return Object.assign(
    {},
    e,
    nested,
    obj(raw.extraJson)
  );
}


/* =========================================================
   STUDENTS
   ========================================================= */

function students(){

  return arr(
    runtime()?.state?.students
  );
}


/* =========================================================
   FIND STUDENT FROM TABLE BUTTON
   ========================================================= */

function findStudent(btn){

  const row=
    btn.closest('tr');


  const id=
    String(
      row
        ?.querySelector('td b')
        ?.textContent ||
      ''
    )
    .trim();


  return (
    students()
      .find(
        s=>
          String(
            s?.studentId ||
            ''
          ).trim()===id
      )
    ||
    students()[
      num(
        btn.dataset.index,
        -1
      )
    ]
    ||
    null
  );
}


/* =========================================================
   GROUP ATTEMPTS BY SESSION
   ========================================================= */

function groups(student){

  const map=
    new Map();


  arr(
    student?.attempts
  )
  .forEach(a=>{

    const id=
      canon(
        a.sessionId ||
        a.missionId
      );


    if(!id){
      return;
    }


    const g=
      map.get(id)
      ||
      {
        id,
        title:
          TITLES[id]
          ||
          id.toUpperCase(),

        attempts:[]
      };


    g.attempts.push(a);

    map.set(
      id,
      g
    );

  });


  return [
    ...map.values()
  ]
  .map(g=>{

    g.attempts.sort(
      (a,b)=>
        stamp(b) -
        stamp(a)
    );


    g.latest=
      g.attempts[0]
      ||
      {};


    g.best=
      Math.max(
        0,
        ...g.attempts.map(
          a=>num(a.score)
        )
      );


    return g;

  })
  .sort(
    (a,b)=>

      (
        ORDER.indexOf(a.id)<0
          ? 99
          : ORDER.indexOf(a.id)
      )

      -

      (
        ORDER.indexOf(b.id)<0
          ? 99
          : ORDER.indexOf(b.id)
      )
  );
}


/* =========================================================
   INSPECTOR STATE
   ========================================================= */

const state={

  student:null,

  groups:[],

  session:'',

  attemptIndex:0,

  tab:'overview',

  filter:'all',

  busy:false
};


/* =========================================================
   CURRENT SESSION / ATTEMPT
   ========================================================= */

const currentGroup=()=>(
  state.groups
    .find(
      g=>g.id===state.session
    )
  ||
  state.groups[0]
  ||
  null
);


const currentAttempt=()=>{

  const g=
    currentGroup();


  return (
    g?.attempts[
      state.attemptIndex
    ]
    ||
    g?.latest
    ||
    {}
  );
};


/* =========================================================
   CHALLENGE DATA
   ========================================================= */

function challenge(a){

  const x=
    meta(a);


  const audit=
    obj(
      x.challengeAudit
    );


  const replay=
    obj(
      x.replayAudit
    );


  return {

    x,

    audit,

    cards:
      arr(
        replay.cards
      )

  };
}


/* =========================================================
   SESSION OPTIONS
   ========================================================= */

function sessionOptions(){

  return state.groups
    .map(
      g=>
        `<option
          value="${esc(g.id)}"
          ${g.id===state.session
            ? 'selected'
            : ''
          }
        >
          ${esc(g.title)}
          • ล่าสุด ${num(g.latest.score)}
          • ${dt(g.latest)}
        </option>`
    )
    .join('');
}


/* =========================================================
   ATTEMPT OPTIONS
   ========================================================= */

function attemptOptions(){

  const g=
    currentGroup();


  return arr(
    g?.attempts
  )
  .map(
    (a,i)=>
      `<option
        value="${i}"
        ${
          i===state.attemptIndex
            ? 'selected'
            : ''
        }
      >
        ครั้งที่ ${g.attempts.length-i}
        • ${num(a.score)} คะแนน
        • ${dt(a)}
      </option>`
  )
  .join('');
}


/* =========================================================
   OVERVIEW TAB
   ========================================================= */

function overview(a,c){

  const x=
    c.x;


  const audit=
    c.audit;


  const slots=
    arr(
      audit.slots
    );


  const chips=[
    x.selectedCaseContext,
    x.selectedCaseSkill,
    x.selectedCaseRisk,
    x.selectedCaseTrap
  ]
  .filter(Boolean)
  .map(
    (v,i)=>
      `<span
        class="chip ${
          i===2
            ? 'warn'
            : ''
        }"
      >
        ${esc(v)}
      </span>`
  )
  .join('');


  return `

    <div class="metrics">

      <div>
        <small>Score</small>
        <b>${num(a.score)}</b>
      </div>

      <div>
        <small>Correct</small>
        <b>
          ${num(a.correct)}
          /
          ${num(a.total)}
        </b>
      </div>

      <div>
        <small>Accuracy</small>
        <b>${num(a.accuracy)}%</b>
      </div>

      <div>
        <small>Mastery</small>
        <b>
          ${
            a.mastered
              ? 'TRUE'
              : 'FALSE'
          }
        </b>
      </div>

    </div>


    <section>

      <h3>
        Selected Case
      </h3>

      <div class="chips">
        ${
          chips
          ||
          '<span class="muted">ไม่มี metadata</span>'
        }
      </div>

    </section>


    <section>

      <h3>
        Challenge Evidence
      </h3>

      <div class="metrics compact">

        <div>
          <small>Content version</small>
          <b>
            ${esc(
              x.contentVersion
              ||
              '—'
            )}
          </b>
        </div>

        <div>
          <small>Challenge version</small>
          <b>
            ${esc(
              audit.version
              ||
              '—'
            )}
          </b>
        </div>

        <div>
          <small>Unique correct</small>
          <b>
            ${esc(
              audit.uniqueCorrect
              ??
              '—'
            )}
          </b>
        </div>

        <div>
          <small>Unique distractors</small>
          <b>
            ${esc(
              audit.uniqueDistractors
              ??
              '—'
            )}
          </b>
        </div>

      </div>


      <p class="muted">
        ${esc(
          audit.antiGuessPolish
          ||
          ''
        )}
      </p>


      <p>

        <b>
          Answer slots:
        </b>

        ${
          slots.length
            ? slots
                .map(
                  (v,i)=>
                    `${i+1}=${v}`
                )
                .join(' • ')
            : '—'
        }

        &nbsp;

        <b>
          Risk mix:
        </b>

        ${
          arr(
            audit.riskMix
          )
          .join(' / ')
          ||
          '—'
        }

      </p>

    </section>


    <section>

      <h3>
        Review Focus
      </h3>

      <p>
        ${esc(
          [
            x.selectedCaseSkill,
            x.selectedCaseTrap,
            x.selectedCaseRisk,
            x.selectedCaseContext
          ]
          .filter(Boolean)
          .join(' • ')
          ||
          '—'
        )}
      </p>

    </section>
  `;
}


/* =========================================================
   REFLECTION TAB
   ========================================================= */

function reflections(a,c){

  return [1,2,3]
    .map(
      i=>
        `<article class="ref">

          <b>
            ${i})
            ${esc(
              c.x[
                'reflectionPrompt'+i
              ]
              ||
              (
                'Reflection '+i
              )
            )}
          </b>

          <p>
            ${esc(
              a[
                'reflection'+i
              ]
              ||
              'ยังไม่มีคำตอบ'
            )}
          </p>

        </article>`
    )
    .join('');
}


/* =========================================================
   REPLAY TAB
   ========================================================= */

function replay(a,c){

  let cards=
    c.cards;


  const wrong=
    arr(
      a.wrongItems
    );


  if(
    state.filter==='wrong'
  ){

    cards=
      wrong.length
        ? cards.filter(
            (card,i)=>
              wrong.includes(card.id)
              ||
              wrong.includes(i)
              ||
              wrong.includes(i+1)
          )
        : [];

  }


  if(
    state.filter==='risk'
  ){

    cards=
      cards.filter(
        card=>
          /high|critical/i.test(
            String(
              card.risk ||
              ''
            )
          )
      );

  }


  const rows=
    cards
      .map(
        (card,i)=>
          `<tr>

            <td>
              ${i+1}
            </td>

            <td>
              <b>
                ${esc(
                  card.concept ||
                  '—'
                )}
              </b>

              <small>
                ${esc(
                  card.context ||
                  ''
                )}
              </small>
            </td>

            <td>
              ${esc(
                card.risk ||
                '—'
              )}

              <small>
                ${esc(
                  card.trap ||
                  ''
                )}
              </small>
            </td>

            <td>
              ${esc(
                card.correct ||
                '—'
              )}
            </td>

            <td>
              ${
                arr(
                  card.distractors
                )
                .map(
                  d=>
                    `• ${esc(d)}`
                )
                .join('<br>')
              }
            </td>

            <td>
              ${
                num(
                  card.answerSlot
                )
                +
                1
              }
            </td>

          </tr>`
      )
      .join('');


  return `

    <div class="tools">

      <button
        data-filter="all"
        class="${
          state.filter==='all'
            ? 'active'
            : ''
        }"
      >
        ทั้งหมด ${c.cards.length}
      </button>


      <button
        data-filter="wrong"
        ${
          wrong.length
            ? ''
            : 'disabled'
        }
        class="${
          state.filter==='wrong'
            ? 'active'
            : ''
        }"
      >
        Wrong only
        ${
          wrong.length
            ? ' '+wrong.length
            : ' • ไม่มี log รายข้อ'
        }
      </button>


      <button
        data-filter="risk"
        class="${
          state.filter==='risk'
            ? 'active'
            : ''
        }"
      >
        High–Critical
      </button>

    </div>


    <div class="table">

      <table>

        <thead>

          <tr>
            <th>#</th>
            <th>Concept / Context</th>
            <th>Risk / Trap</th>
            <th>Correct</th>
            <th>Distractors</th>
            <th>Slot</th>
          </tr>

        </thead>


        <tbody>

          ${
            rows
            ||
            `<tr>
              <td colspan="6">
                ไม่มีรายการตามตัวกรองนี้
              </td>
            </tr>`
          }

        </tbody>

      </table>

    </div>
  `;
}


/* =========================================================
   ATTEMPT HISTORY TAB
   ========================================================= */

function history(){

  const g=
    currentGroup();


  return `

    <div class="table">

      <table>

        <thead>

          <tr>
            <th>ครั้ง</th>
            <th>Submitted</th>
            <th>Score</th>
            <th>Correct</th>
            <th>Accuracy</th>
            <th>Mastery</th>
            <th>Version</th>
            <th></th>
          </tr>

        </thead>


        <tbody>

          ${
            arr(
              g?.attempts
            )
            .map(
              (a,i)=>{

                const x=
                  meta(a);


                return `

                  <tr>

                    <td>
                      ${g.attempts.length-i}
                    </td>

                    <td>
                      ${dt(a)}
                    </td>

                    <td>
                      ${num(a.score)}
                    </td>

                    <td>
                      ${num(a.correct)}
                      /
                      ${num(a.total)}
                    </td>

                    <td>
                      ${num(a.accuracy)}%
                    </td>

                    <td>
                      ${
                        a.mastered
                          ? 'TRUE'
                          : 'FALSE'
                      }
                    </td>

                    <td>
                      ${esc(
                        x.contentVersion
                        ||
                        a.schemaVersion
                        ||
                        '—'
                      )}
                    </td>

                    <td>

                      <button
                        data-open-attempt="${i}"
                      >
                        เปิด
                      </button>

                    </td>

                  </tr>
                `;
              }
            )
            .join('')
          }

        </tbody>

      </table>

    </div>
  `;
}


/* =========================================================
   TAB BODY
   ========================================================= */

function body(){

  const a=
    currentAttempt();


  const c=
    challenge(a);


  if(
    state.tab==='reflection'
  ){
    return reflections(
      a,
      c
    );
  }


  if(
    state.tab==='replay'
  ){
    return replay(
      a,
      c
    );
  }


  if(
    state.tab==='history'
  ){
    return history();
  }


  return overview(
    a,
    c
  );
}


/* =========================================================
   UPDATE TAB BUTTONS
   ========================================================= */

function updateTabs(){

  document
    .querySelectorAll(
      `#${MODAL} [data-tab]`
    )
    .forEach(b=>{

      const on=
        b.dataset.tab===
        state.tab;


      b.classList.toggle(
        'active',
        on
      );


      b.setAttribute(
        'aria-selected',
        on
          ? 'true'
          : 'false'
      );

    });
}


/* =========================================================
   UPDATE CONTENT
   ========================================================= */

function updateContent(){

  if(
    state.busy
  ){
    return;
  }


  state.busy=true;


  try{

    const host=
      document.getElementById(
        'aq704Content'
      );


    if(host){

      host.replaceChildren();


      const wrap=
        document.createElement(
          'div'
        );


      wrap.innerHTML=
        body();


      while(
        wrap.firstChild
      ){

        host.appendChild(
          wrap.firstChild
        );

      }


      host.scrollTop=0;
    }


    updateTabs();

  }
  finally{

    state.busy=false;

  }
}


/* =========================================================
   UPDATE HEADER
   ========================================================= */

function updateHeader(){

  const g=
    currentGroup();


  const title=
    document.getElementById(
      'aq704Title'
    );


  const sub=
    document.getElementById(
      'aq704Sub'
    );


  const ss=
    document.getElementById(
      'aq704Session'
    );


  const as=
    document.getElementById(
      'aq704Attempt'
    );


  if(title){

    title.textContent=
      `${
        state.student?.studentId
        ||
        '-'
      } • ${
        state.student?.studentName
        ||
        ''
      }`;

  }


  if(sub){

    sub.textContent=
      `Teacher Inspector Stable ${VERSION} • ${
        g?.title
        ||
        ''
      }`;

  }


  if(ss){

    ss.innerHTML=
      sessionOptions();


    ss.value=
      state.session;

  }


  if(as){

    as.innerHTML=
      attemptOptions();


    as.value=
      String(
        state.attemptIndex
      );

  }


  updateContent();
}


/* =========================================================
   SCROLL SAFETY
   ---------------------------------------------------------
   IMPORTANT:
   The Inspector no longer needs to set body overflow:hidden.

   A fixed full-screen modal already covers the page.
   The Inspector content has its own overflow:auto.

   This prevents the Teacher Console from becoming permanently
   locked after the modal closes or another module replaces it.
   ========================================================= */

function inspectorIsOpen(){

  return !!document.getElementById(
    MODAL
  );
}


function compareIsOpen(){

  return !!document.getElementById(
    COMPARE_MODAL
  );
}


function repairPageScroll(){

  /*
    Do not unlock while one of the known full-screen modals
    still owns the page.
  */
  if(
    inspectorIsOpen()
    ||
    compareIsOpen()
  ){
    return;
  }


  const body=
    document.body;


  const html=
    document.documentElement;


  /*
    Repair only stale inline hidden values.

    We intentionally do not modify stylesheet rules because
    the Teacher Console CSS itself controls its own layout.
  */
  if(
    body
    &&
    body.style.overflow==='hidden'
  ){

    body.style.overflow='';

  }


  if(
    html
    &&
    html.style.overflow==='hidden'
  ){

    html.style.overflow='';

  }
}


/* =========================================================
   CLOSE INSPECTOR
   ========================================================= */

function close(){

  const modal=
    document.getElementById(
      MODAL
    );


  if(modal){

    modal.remove();

  }


  state.busy=false;


  /*
    Run after DOM removal.

    If Compare is open, repairPageScroll() will intentionally
    keep the current lock.
  */
  requestAnimationFrame(
    repairPageScroll
  );
}


/* =========================================================
   MOVE BETWEEN SESSION GROUPS
   ========================================================= */

function move(delta){

  const i=
    state.groups.findIndex(
      g=>
        g.id===
        state.session
    );


  const n=
    Math.max(
      0,
      Math.min(
        state.groups.length-1,
        i+delta
      )
    );


  if(
    n===i
    ||
    n<0
  ){
    return;
  }


  state.session=
    state.groups[n].id;


  state.attemptIndex=0;

  state.tab='overview';

  state.filter='all';


  updateHeader();
}


/* =========================================================
   EXPORT JSON
   ========================================================= */

function exportJSON(){

  const payload={

    exportedAt:
      new Date()
        .toISOString(),

    student:{

      studentId:
        state.student?.studentId,

      studentName:
        state.student?.studentName,

      section:
        state.student?.section

    },

    session:
      state.session,

    attempt:
      currentAttempt(),

    allSessionGroups:
      state.groups

  };


  const blob=
    new Blob(
      [
        JSON.stringify(
          payload,
          null,
          2
        )
      ],
      {
        type:
          'application/json'
      }
    );


  const url=
    URL.createObjectURL(
      blob
    );


  const a=
    document.createElement(
      'a'
    );


  a.href=url;


  a.download=
    `CSAI2102-${
      state.student?.studentId
      ||
      'student'
    }-${
      state.session
      ||
      'session'
    }.json`;


  a.click();


  setTimeout(
    ()=>
      URL.revokeObjectURL(
        url
      ),
    500
  );
}


/* =========================================================
   MODAL SHELL
   ========================================================= */

function shell(){

  const el=
    document.createElement(
      'div'
    );


  el.id=
    MODAL;


  el.innerHTML=`

    <style>

      #${MODAL}{
        position:fixed;
        inset:0;
        z-index:2147483647;

        background:
          rgba(
            2,
            6,
            23,
            .88
          );

        display:flex;
        align-items:center;
        justify-content:center;

        padding:14px;

        color:#e8f1ff;

        font-family:
          system-ui,
          sans-serif;

        /*
          Keep scrolling inside modal rather than globally
          locking document.body.
        */
        overscroll-behavior:contain;
      }


      #${MODAL} *{
        box-sizing:border-box
      }


      #${MODAL} .panel{

        width:
          min(
            1240px,
            100%
          );

        height:
          min(
            94vh,
            980px
          );

        max-height:94vh;

        background:#0f1d33;

        border:
          1px solid
          rgba(
            148,
            163,
            184,
            .28
          );

        border-radius:
          22px;

        overflow:hidden;

        display:flex;

        flex-direction:
          column;

      }


      #${MODAL} .head{

        flex:
          0 0 auto;

        padding:
          14px 16px;

        background:
          #10213a;

        border-bottom:
          1px solid
          rgba(
            148,
            163,
            184,
            .2
          );

      }


      #${MODAL} .top,
      #${MODAL} .actions,
      #${MODAL} .tabs,
      #${MODAL} .nav,
      #${MODAL} .tools,
      #${MODAL} .chips{

        display:flex;

        gap:8px;

        align-items:center;

        flex-wrap:wrap;

      }


      #${MODAL} .top{

        justify-content:
          space-between;

        align-items:
          flex-start;

      }


      #${MODAL} button,
      #${MODAL} select{

        border:
          1px solid
          rgba(
            148,
            163,
            184,
            .3
          );

        border-radius:
          11px;

        padding:
          9px 11px;

        background:
          #17304d;

        color:#fff;

        font:inherit;

        font-weight:
          800;

        cursor:pointer;

      }


      #${MODAL} button.active{

        border-color:
          #38bdf8;

        background:
          #12385a;

      }


      #${MODAL} button:disabled{

        opacity:.5;

        cursor:
          not-allowed;

      }


      #${MODAL} .selectors{

        display:grid;

        grid-template-columns:
          minmax(
            0,
            1fr
          )
          330px
          auto;

        gap:9px;

        margin-top:
          10px;

      }


      #${MODAL} .tabs{

        margin-top:
          9px;

        overflow-x:auto;

        overflow-y:hidden;

        -webkit-overflow-scrolling:
          touch;

      }


      #${MODAL} .content{

        flex:
          1 1 auto;

        min-height:
          0;

        overflow:
          auto;

        padding:
          16px;

        contain:
          layout paint;

        overscroll-behavior:
          contain;

        -webkit-overflow-scrolling:
          touch;

        touch-action:
          pan-x pan-y;

      }


      #${MODAL} .metrics{

        display:grid;

        grid-template-columns:
          repeat(
            4,
            1fr
          );

        gap:
          10px;

      }


      #${MODAL} .metrics>div,
      #${MODAL} .ref{

        padding:
          12px;

        border:
          1px solid
          rgba(
            148,
            163,
            184,
            .2
          );

        border-radius:
          14px;

        background:
          rgba(
            255,
            255,
            255,
            .035
          );

      }


      #${MODAL} .metrics b{

        display:block;

        font-size:
          27px;

        margin-top:
          3px;

      }


      #${MODAL} .compact b{

        font-size:
          15px;

        overflow-wrap:
          anywhere;

      }


      #${MODAL} section{

        margin-top:
          16px;

        padding-top:
          14px;

        border-top:
          1px solid
          rgba(
            148,
            163,
            184,
            .18
          );

      }


      #${MODAL} .chips{

        margin-top:
          10px;

      }


      #${MODAL} .chip{

        border:
          1px solid
          rgba(
            56,
            189,
            248,
            .42
          );

        border-radius:
          999px;

        padding:
          6px 9px;

        background:
          rgba(
            56,
            189,
            248,
            .1
          );

        font-size:
          12px;

        font-weight:
          850;

      }


      #${MODAL} .chip.warn{

        color:
          #fde68a;

        border-color:
          rgba(
            245,
            158,
            11,
            .45
          );

      }


      #${MODAL} .ref{

        margin-bottom:
          9px;

        line-height:
          1.55;

      }


      #${MODAL} .ref p{

        white-space:
          pre-wrap;

      }


      #${MODAL} small,
      #${MODAL} .muted{

        display:block;

        color:
          #9fb2cc;

      }


      #${MODAL} .table{

        width:
          100%;

        overflow:
          auto;

        -webkit-overflow-scrolling:
          touch;

      }


      #${MODAL} table{

        width:
          100%;

        min-width:
          900px;

        border-collapse:
          collapse;

      }


      #${MODAL} th,
      #${MODAL} td{

        padding:
          9px;

        border-bottom:
          1px solid
          rgba(
            148,
            163,
            184,
            .15
          );

        text-align:
          left;

        vertical-align:
          top;

        font-size:
          12px;

      }


      #${MODAL} th{

        position:
          sticky;

        top:
          0;

        background:
          #0c1930;

        color:
          #bae6fd;

      }


      @media(
        max-width:
        880px
      ){

        #${MODAL} .selectors{

          grid-template-columns:
            1fr;

        }


        #${MODAL} .metrics{

          grid-template-columns:
            1fr 1fr;

        }

      }


      @media print{

        body>*:not(#${MODAL}){

          display:
            none !important;

        }


        #${MODAL}{

          position:
            static;

          background:
            #fff;

          color:
            #000;

          padding:
            0;

        }


        #${MODAL} .panel{

          width:
            100%;

          height:
            auto;

          max-height:
            none;

          background:
            #fff;

          color:
            #000;

        }


        #${MODAL} .actions,
        #${MODAL} .selectors,
        #${MODAL} .tabs{

          display:
            none !important;

        }


        #${MODAL} .content{

          overflow:
            visible;

        }

      }

    </style>


    <div class="panel">


      <div class="head">


        <div class="top">


          <div>

            <h2
              id="aq704Title"
            >
            </h2>

            <small
              id="aq704Sub"
            >
            </small>

          </div>


          <div class="actions">

            <button
              type="button"
              data-action="print"
            >
              พิมพ์ / Save PDF
            </button>

            <button
              type="button"
              data-action="export"
            >
              Export JSON
            </button>

            <button
              type="button"
              data-action="close"
            >
              ปิด
            </button>

          </div>

        </div>


        <div class="selectors">

          <select
            id="aq704Session"
          >
          </select>


          <select
            id="aq704Attempt"
          >
          </select>


          <div class="nav">

            <button
              type="button"
              data-action="prev"
            >
              ← ก่อนหน้า
            </button>

            <button
              type="button"
              data-action="next"
            >
              ถัดไป →
            </button>

          </div>

        </div>


        <div
          class="tabs"
          role="tablist"
        >

          <button
            type="button"
            data-tab="overview"
          >
            ภาพรวม
          </button>

          <button
            type="button"
            data-tab="reflection"
          >
            Reflection
          </button>

          <button
            type="button"
            data-tab="replay"
          >
            Replay Audit
          </button>

          <button
            type="button"
            data-tab="history"
          >
            ประวัติ Attempts
          </button>

        </div>

      </div>


      <div
        id="aq704Content"
        class="content"
      >
      </div>


    </div>
  `;


  el.addEventListener(
    'click',
    onClick,
    {
      passive:false
    }
  );


  el.addEventListener(
    'change',
    onChange
  );


  return el;
}


/* =========================================================
   MODAL CLICK HANDLER
   ========================================================= */

function onClick(e){

  const root=
    document.getElementById(
      MODAL
    );


  if(!root){
    return;
  }


  const action=
    e.target
      .closest?.(
        '[data-action]'
      )
      ?.dataset.action;


  if(action){

    e.preventDefault();

    e.stopPropagation();


    if(
      action==='close'
    ){

      close();

    }
    else if(
      action==='print'
    ){

      window.print();

    }
    else if(
      action==='export'
    ){

      exportJSON();

    }
    else if(
      action==='prev'
    ){

      move(-1);

    }
    else if(
      action==='next'
    ){

      move(1);

    }


    return;
  }


  const tab=
    e.target
      .closest?.(
        '[data-tab]'
      )
      ?.dataset.tab;


  if(tab){

    e.preventDefault();

    e.stopPropagation();


    if(
      state.tab!==tab
    ){

      state.tab=
        tab;

      state.filter=
        'all';

      updateContent();

    }


    return;
  }


  const filter=
    e.target
      .closest?.(
        '[data-filter]'
      )
      ?.dataset.filter;


  if(filter){

    e.preventDefault();

    e.stopPropagation();


    state.filter=
      filter;


    updateContent();


    return;
  }


  const ai=
    e.target
      .closest?.(
        '[data-open-attempt]'
      )
      ?.dataset.openAttempt;


  if(
    ai!=null
  ){

    e.preventDefault();

    e.stopPropagation();


    state.attemptIndex=
      num(ai);


    state.tab=
      'overview';


    state.filter=
      'all';


    updateHeader();


    return;
  }


  /*
    Clicking dark backdrop closes Inspector.
  */
  if(
    e.target===root
  ){

    close();

  }
}


/* =========================================================
   SELECT CHANGE HANDLER
   ========================================================= */

function onChange(e){

  if(
    e.target.id===
    'aq704Session'
  ){

    state.session=
      e.target.value;


    state.attemptIndex=
      0;


    state.tab=
      'overview';


    state.filter=
      'all';


    updateHeader();

  }

  else if(
    e.target.id===
    'aq704Attempt'
  ){

    state.attemptIndex=
      num(
        e.target.value
      );


    state.tab=
      'overview';


    state.filter=
      'all';


    updateHeader();

  }
}


/* =========================================================
   OPEN INSPECTOR
   ========================================================= */

function open(
  student,
  session
){

  /*
    Remove previous Inspector first.
  */
  close();


  state.student=
    student;


  state.groups=
    groups(
      student
    );


  const requested=
    canon(
      session
    );


  state.session=
    (
      requested
      &&
      state.groups.some(
        g=>
          g.id===
          requested
      )
    )
      ? requested
      : (
          state.groups[0]?.id
          ||
          ''
        );


  state.attemptIndex=
    0;


  state.tab=
    'overview';


  state.filter=
    'all';


  const el=
    shell();


  document.body
    .appendChild(
      el
    );


  /*
    IMPORTANT — v7.0.5 SCROLL FIX

    OLD:
      document.body.style.overflow='hidden';

    NEW:
      Do not globally lock body scrolling.

    The Inspector is already fixed to the viewport and its
    .content element handles scrolling internally.
  */


  updateHeader();
}


/* =========================================================
   OPEN FROM STUDENT TABLE
   ========================================================= */

let lastOpen=0;


function handle(e){

  const btn=
    e.target
      ?.closest?.(
        '#studentsBox .detailBtn,'+
        '#studentsBox button[data-index],'+
        '#studentsBox button'
      );


  if(
    !btn
    ||
    btn.disabled
    ||
    btn.getAttribute(
      'aria-disabled'
    )==='true'
    ||
    !/view|ดูรายละเอียด/i.test(
      String(
        btn.textContent ||
        ''
      )
    )
  ){

    return;
  }


  const now=
    Date.now();


  if(
    now-lastOpen<300
  ){

    return;
  }


  lastOpen=
    now;


  e.preventDefault();

  e.stopPropagation();

  e.stopImmediatePropagation();


  const student=
    findStudent(
      btn
    );


  if(student){

    open(
      student
    );

  }
}


/* =========================================================
   GLOBAL EVENTS
   ========================================================= */

document.addEventListener(
  'pointerdown',
  handle,
  true
);


document.addEventListener(
  'keydown',
  e=>{

    if(
      e.key==='Escape'
    ){

      close();

    }

  }
);


/* =========================================================
   STALE SCROLL-LOCK RECOVERY
   ---------------------------------------------------------
   Useful when browser restores a page from bfcache or an older
   Inspector/Compare build left body overflow:hidden.
   ========================================================= */

function bootScrollRepair(){

  /*
    Run once after this module loads.
  */
  requestAnimationFrame(
    repairPageScroll
  );


  /*
    Browser Back/Forward Cache restoration.
  */
  window.addEventListener(
    'pageshow',
    ()=>{
      requestAnimationFrame(
        repairPageScroll
      );
    }
  );


  /*
    Returning to this browser tab.
  */
  document.addEventListener(
    'visibilitychange',
    ()=>{

      if(
        !document.hidden
      ){

        requestAnimationFrame(
          repairPageScroll
        );

      }

    }
  );
}


bootScrollRepair();


/* =========================================================
   PUBLIC API
   ---------------------------------------------------------
   Preserve all aliases used by existing modules.
   ========================================================= */

const api={

  open,

  close,

  state,

  VERSION,

  repairPageScroll,

  openSession:
    (
      student,
      session
    )=>
      open(
        student,
        session
      )

};


window.AIQUEST_TEACHER_SESSION_DETAIL_UX_V697=
  api;


window.AIQUEST_TEACHER_INSPECTOR_V701=
  api;


window.AIQUEST_TEACHER_INSPECTOR_V703=
  api;


window.AIQUEST_TEACHER_INSPECTOR_V704=
  api;


/*
  New alias. Existing modules do not need to change.
*/
window.AIQUEST_TEACHER_INSPECTOR_V705=
  api;


/* =========================================================
   READY
   ========================================================= */

console.log(
  '[AIQuest] Teacher Inspector Stable active',
  VERSION
);


})();
