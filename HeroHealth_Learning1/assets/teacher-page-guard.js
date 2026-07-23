(()=>{
'use strict';
const key='herohealth_teacher_authorized_v1';
if(sessionStorage.getItem(key)!=='1'){
  location.replace('./teacher-login.html');
}
})();
