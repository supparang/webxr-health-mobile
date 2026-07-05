CSAI2102 AI Quest — Profile Lookup v6.7.0

One-time Apps Script setup

1. Open the currently deployed AI Quest Apps Script project.
2. Add a new script file named ProfileLookup_v670.gs.
3. Paste in the complete source from ai-quest/apps-script/ProfileLookup_v670.gs.
4. In Code.gs, inside doGet(e), add this block after the testWrite route and before the teacherConsole route:

  if (action === 'profileLookup') {
    setupSheets();
    return jsonOutMaybe_(aqProfileLookup_(p), callback);
  }

5. Save the project.
6. Deploy a new version of the existing Web App, retaining the current execution and access settings.
7. Reload the game page with Ctrl + Shift + R.

Student flow
- Enter an exact Student ID and click “ดึง Profile จาก Sheet”, or leave the Student ID field.
- When a matching students_profile row exists, the game fills the stored name and forces Section 101.
- When no matching row exists, the student enters a name once and presses “บันทึกข้อมูล”.

The lookup route accepts only an exact Student ID and returns only the matching profile basics. It does not provide name search or a student-list endpoint.