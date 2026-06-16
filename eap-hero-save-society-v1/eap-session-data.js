const EAP_SESSIONS = [
  {
    id: 1,
    title: "Academic Identity & Study Goals",
    focus: ["Speaking", "Writing"],
    requiredSkills: ["listening", "reading", "speaking", "writing"],
    mainSkills: ["speaking", "writing"],
    unlockAfter: null,
    bossAfter: false
  },
  {
    id: 2,
    title: "Academic Vocabulary for Social Issues",
    focus: ["Reading", "Vocabulary"],
    requiredSkills: ["listening", "reading", "speaking", "writing"],
    mainSkills: ["reading"],
    unlockAfter: 1,
    bossAfter: false
  },
  {
    id: 3,
    title: "Main Idea & Supporting Details",
    focus: ["Listening", "Reading"],
    requiredSkills: ["listening", "reading", "speaking", "writing"],
    mainSkills: ["listening", "reading"],
    unlockAfter: 2,
    bossAfter: "boss1"
  }
];
