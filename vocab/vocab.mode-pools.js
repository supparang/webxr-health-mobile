/* =========================================================
   /vocab/vocab.mode-pools.js
   TechPath Vocab Arena — Mode-Specific Vocabulary Pools
   FULL PATCH: v20260503s

   Goal:
   - 4 modes
   - 4 levels
   - 20 unique words per level
   - No duplicated terms across mode pools
   - CEFR A2 → B1+
   - Override VocabQuestion.buildTermDeck()
   - Override VocabQuestion.buildQuestion(stage, game) for gameplay compatibility

   Load order:
   vocab.question.js
   vocab.mode-pools.js
   vocab.ui.js
   vocab.game.js
========================================================= */

(function(){
  "use strict";

  const WIN = window;
  const DOC = document;

  const VERSION = "vocab-mode-pools-v20260503s";

  const MODES = ["learn", "speed", "mission", "battle"];
  const DIFFICULTIES = ["easy", "normal", "hard", "challenge"];

  const LEVEL_BY_DIFF = {
    easy: "A2",
    normal: "A2-B1",
    hard: "B1",
    challenge: "B1+"
  };

  /* =========================================================
     MODE-SPECIFIC VOCABULARY POOLS
     4 modes × 4 levels × 20 terms = 320 terms
  ========================================================= */

  const POOLS = {
    learn: {
      easy: [
        ["computer", "an electronic machine that processes information", "basic-tech", "A2"],
        ["program", "a set of instructions that a computer follows", "basic-tech", "A2"],
        ["software", "programs used by a computer or device", "basic-tech", "A2"],
        ["hardware", "the physical parts of a computer", "basic-tech", "A2"],
        ["screen", "the part of a device that shows information", "basic-tech", "A2"],
        ["keyboard", "a device used to type letters and commands", "basic-tech", "A2"],
        ["mouse", "a small device used to point and click", "basic-tech", "A2"],
        ["file", "a saved document, image, program, or data item", "basic-tech", "A2"],
        ["folder", "a place used to organize files", "basic-tech", "A2"],
        ["button", "an item users press to start an action", "ui", "A2"],
        ["menu", "a list of choices in an app or website", "ui", "A2"],
        ["icon", "a small picture that represents an app or action", "ui", "A2"],
        ["login", "the action of entering a system with an account", "account", "A2"],
        ["password", "a secret word or code used to access an account", "account", "A2"],
        ["account", "a user profile for a system or service", "account", "A2"],
        ["internet", "a global network that connects computers and people", "network", "A2"],
        ["website", "a group of web pages on the internet", "web", "A2"],
        ["browser", "a program used to open websites", "web", "A2"],
        ["download", "to get a file from the internet to your device", "web", "A2"],
        ["upload", "to send a file from your device to the internet", "web", "A2"]
      ],

      normal: [
        ["application", "software designed to help users do a task", "software", "A2-B1"],
        ["user", "a person who uses a system, app, or device", "software", "A2-B1"],
        ["device", "a machine or tool such as a phone, tablet, or computer", "basic-tech", "A2-B1"],
        ["network", "connected computers or devices that share information", "network", "A2-B1"],
        ["data", "information stored or used by a computer", "data", "A2-B1"],
        ["input", "data entered into a system", "software", "A2-B1"],
        ["output", "the result produced by a system", "software", "A2-B1"],
        ["command", "an instruction given to a computer or program", "coding", "A2-B1"],
        ["code", "instructions written for a computer to run", "coding", "A2-B1"],
        ["variable", "a named value that can change in a program", "coding", "A2-B1"],
        ["function", "a reusable block of code that performs a task", "coding", "A2-B1"],
        ["loop", "a command that repeats actions", "coding", "A2-B1"],
        ["condition", "a rule that decides what code should run", "coding", "A2-B1"],
        ["database", "a system for storing and managing data", "data", "A2-B1"],
        ["server", "a computer or system that provides services or data", "network", "A2-B1"],
        ["client program", "a program that requests data or services from a server", "network", "A2-B1"],
        ["interface", "the part of a system that users interact with", "ui", "A2-B1"],
        ["dashboard", "a screen that shows important information", "data", "A2-B1"],
        ["backup", "a copy of data kept for safety", "software", "A2-B1"],
        ["update file", "a newer version or improvement of software", "software", "A2-B1"]
      ],

      hard: [
        ["algorithm", "step-by-step instructions to solve a problem", "coding", "B1"],
        ["syntax", "rules for writing code correctly", "coding", "B1"],
        ["compile", "to convert code into a form a computer can run", "coding", "B1"],
        ["parameter", "a value a function receives to work with", "coding", "B1"],
        ["argument value", "a value passed into a function when it is called", "coding", "B1"],
        ["return value", "the result sent back by a function", "coding", "B1"],
        ["array", "a list-like structure that stores multiple values", "coding", "B1"],
        ["object data", "a data structure with properties and values", "coding", "B1"],
        ["string value", "text data in a program", "coding", "B1"],
        ["boolean value", "a true or false value", "coding", "B1"],
        ["repository", "a place where project code is stored and managed", "software", "B1"],
        ["commit change", "a saved change in a version control system", "software", "B1"],
        ["branch line", "a separate line of code development", "software", "B1"],
        ["merge change", "to combine changes from one branch into another", "software", "B1"],
        ["library", "a collection of reusable code", "software", "B1"],
        ["framework", "a structured set of tools for building software", "software", "B1"],
        ["module", "a separate part of a program", "software", "B1"],
        ["package", "a bundled set of code or software resources", "software", "B1"],
        ["runtime", "the environment or period when a program is running", "software", "B1"],
        ["documentation", "written information that explains how a system works", "software", "B1"]
      ],

      challenge: [
        ["abstraction", "hiding complex details so users can work with simple ideas", "software", "B1+"],
        ["encapsulation", "keeping data and methods together inside one unit", "coding", "B1+"],
        ["polymorphism", "the ability of different objects to respond in different ways", "coding", "B1+"],
        ["inheritance", "a way for one class to receive properties from another class", "coding", "B1+"],
        ["recursion", "a process where a function calls itself", "coding", "B1+"],
        ["asynchronous task", "a task that can run without waiting for another task to finish", "software", "B1+"],
        ["callback", "a function passed to another function to run later", "coding", "B1+"],
        ["promise object", "an object representing a future result of an asynchronous task", "coding", "B1+"],
        ["event listener", "code that waits for a user action or system event", "ui", "B1+"],
        ["state management", "the process of controlling data that changes in an app", "software", "B1+"],
        ["dependency", "software that another program needs to run", "software", "B1+"],
        ["refactor", "to improve code structure without changing its behavior", "coding", "B1+"],
        ["technical debt", "future work caused by choosing a quick solution now", "software", "B1+"],
        ["scalability", "the ability of a system to handle growth", "software", "B1+"],
        ["maintainability", "how easy software is to update and fix", "software", "B1+"],
        ["interoperability", "the ability of systems to work together", "software", "B1+"],
        ["configuration", "settings that control how software works", "software", "B1+"],
        ["environment variable", "a setting stored outside code for configuration", "software", "B1+"],
        ["version control", "a system for tracking changes in files or code", "software", "B1+"],
        ["continuous integration", "automatically testing and combining code changes often", "software", "B1+"]
      ]
    },

    speed: {
      easy: [
        ["tap", "to touch a screen quickly", "action", "A2"],
        ["click", "to press a mouse button or screen item", "action", "A2"],
        ["drag", "to move something on a screen by holding it", "action", "A2"],
        ["drop", "to release an item in a new place on screen", "action", "A2"],
        ["open", "to start or view a file, app, or page", "action", "A2"],
        ["close", "to stop showing a window, app, or file", "action", "A2"],
        ["save", "to keep data or a file for later use", "action", "A2"],
        ["copy", "to make another version of text, data, or a file", "action", "A2"],
        ["paste", "to place copied text or data somewhere", "action", "A2"],
        ["delete", "to remove data, text, or a file", "action", "A2"],
        ["search", "to look for information in a system", "action", "A2"],
        ["select", "to choose an item from a list or screen", "action", "A2"],
        ["start", "to begin a process or program", "action", "A2"],
        ["stop", "to end a process or action", "action", "A2"],
        ["pause", "to stop something for a short time", "action", "A2"],
        ["resume", "to continue after stopping for a short time", "action", "A2"],
        ["refresh", "to load updated information again", "action", "A2"],
        ["scroll", "to move a page up, down, or sideways", "action", "A2"],
        ["zoom", "to make content look larger or smaller", "action", "A2"],
        ["swipe", "to move a finger across a screen quickly", "action", "A2"]
      ],

      normal: [
        ["run command", "to make a program or instruction start working", "fast-coding", "A2-B1"],
        ["load page", "to bring content into a browser or app", "web", "A2-B1"],
        ["send data", "to move information to another system", "network", "A2-B1"],
        ["receive data", "to get information from another system", "network", "A2-B1"],
        ["connect", "to join a device or system to a network", "network", "A2-B1"],
        ["disconnect", "to stop a connection between systems or devices", "network", "A2-B1"],
        ["sync", "to make data the same across devices or systems", "data", "A2-B1"],
        ["reset", "to return a system to its starting state", "system", "A2-B1"],
        ["restart", "to turn a system off and on again", "system", "A2-B1"],
        ["install", "to add software to a device", "software", "A2-B1"],
        ["uninstall", "to remove software from a device", "software", "A2-B1"],
        ["enable", "to turn a feature on", "system", "A2-B1"],
        ["disable", "to turn a feature off", "system", "A2-B1"],
        ["confirm", "to say that something is correct or approved", "action", "A2-B1"],
        ["cancel", "to stop an action before it is completed", "action", "A2-B1"],
        ["submit", "to send a form, answer, or request", "action", "A2-B1"],
        ["retry", "to try an action again after it fails", "action", "A2-B1"],
        ["preview", "to look at something before final use", "ui", "A2-B1"],
        ["export", "to save data in a format that can be used elsewhere", "data", "A2-B1"],
        ["import", "to bring data into a system from another place", "data", "A2-B1"]
      ],

      hard: [
        ["execute", "to run a program, command, or instruction", "fast-coding", "B1"],
        ["initialize", "to prepare a system or variable before use", "coding", "B1"],
        ["validate", "to check that data or input is correct", "data", "B1"],
        ["parse", "to read and break data into useful parts", "coding", "B1"],
        ["render", "to display content on a screen", "ui", "B1"],
        ["fetch", "to request and get data from another place", "network", "B1"],
        ["cache data", "to store temporary data for faster access", "performance", "B1"],
        ["queue task", "to place a task in a line to be processed later", "system", "B1"],
        ["trigger", "to cause an event or action to happen", "system", "B1"],
        ["redirect", "to send a user or request to another page or address", "web", "B1"],
        ["authenticate", "to check who a user is", "security", "B1"],
        ["authorize", "to allow a user to access something", "security", "B1"],
        ["encrypt", "to change data into a protected secret form", "security", "B1"],
        ["decrypt", "to change protected data back to readable form", "security", "B1"],
        ["compress", "to make data smaller", "data", "B1"],
        ["extract", "to take useful data out of a file or source", "data", "B1"],
        ["filter records", "to show only data that matches a rule", "data", "B1"],
        ["sort records", "to arrange data in a chosen order", "data", "B1"],
        ["map values", "to transform each item in a list", "coding", "B1"],
        ["join tables", "to combine related data from different tables", "data", "B1"]
      ],

      challenge: [
        ["throttle", "to limit how often an action can run", "performance", "B1+"],
        ["debounce", "to wait before running an action after repeated input", "performance", "B1+"],
        ["batch process", "to handle many items together as one group", "system", "B1+"],
        ["stream data", "to send or receive data continuously", "data", "B1+"],
        ["serialize", "to convert data into a format for storage or transfer", "data", "B1+"],
        ["deserialize", "to convert stored or transferred data back into objects", "data", "B1+"],
        ["sanitize input", "to clean input to prevent unsafe or invalid data", "security", "B1+"],
        ["rate limit", "to control how many requests are allowed in a time period", "security", "B1+"],
        ["prefetch", "to get data before it is needed", "performance", "B1+"],
        ["lazy load", "to load content only when it is needed", "performance", "B1+"],
        ["hydrate view", "to attach interactive behavior to rendered content", "web", "B1+"],
        ["reconcile state", "to compare and update changed data in an interface", "ui", "B1+"],
        ["invalidate cache", "to mark stored data as outdated", "performance", "B1+"],
        ["rollback", "to return a system to an earlier working version", "software", "B1+"],
        ["hotfix", "a quick fix for an urgent software problem", "software", "B1+"],
        ["benchmark", "to test performance using a standard measure", "performance", "B1+"],
        ["profile performance", "to measure where a system is slow", "performance", "B1+"],
        ["optimize", "to make a system faster or more efficient", "performance", "B1+"],
        ["parallelize", "to run tasks at the same time", "performance", "B1+"],
        ["short-circuit", "to stop checking once the result is already decided", "coding", "B1+"]
      ]
    },

    mission: {
      easy: [
        ["task", "a piece of work that needs to be done", "project", "A2"],
        ["team", "people working together on a goal", "workplace", "A2"],
        ["meeting", "a planned discussion with people", "workplace", "A2"],
        ["message", "information sent to another person", "workplace", "A2"],
        ["email", "a message sent through the internet", "workplace", "A2"],
        ["report", "information written or spoken about work or results", "workplace", "A2"],
        ["plan", "a set of steps for doing something", "project", "A2"],
        ["goal", "something you want to achieve", "project", "A2"],
        ["problem", "something that needs to be solved", "project", "A2"],
        ["answer", "a response to a question or problem", "workplace", "A2"],
        ["help desk", "a service that helps users with problems", "support", "A2"],
        ["customer", "a person who buys or uses a service", "workplace", "A2"],
        ["teacher comment", "advice from a teacher to improve work", "learning", "A2"],
        ["class project", "a project completed for a class", "learning", "A2"],
        ["group work", "work done with other students", "learning", "A2"],
        ["demo", "a short presentation showing how something works", "project", "A2"],
        ["note", "short written information to remember something", "workplace", "A2"],
        ["checklist", "a list used to check completed items", "project", "A2"],
        ["role", "a job or duty in a team", "workplace", "A2"],
        ["result", "what happens or is produced after an action", "project", "A2"]
      ],

      normal: [
        ["requirement", "something a client or user needs from a system", "project", "A2-B1"],
        ["deadline", "the final time or date to finish work", "project", "A2-B1"],
        ["feedback", "comments or advice used to improve work", "project", "A2-B1"],
        ["prototype", "an early version of a product for testing", "project", "A2-B1"],
        ["presentation", "a talk or display used to explain ideas", "workplace", "A2-B1"],
        ["client request", "something a client asks the team to do", "workplace", "A2-B1"],
        ["feature request", "a request for a new function in a product", "software", "A2-B1"],
        ["bug report", "a document that explains a software problem", "software", "A2-B1"],
        ["status update", "a short report about current progress", "workplace", "A2-B1"],
        ["schedule", "a plan that shows when tasks will happen", "project", "A2-B1"],
        ["progress", "movement toward finishing a task or goal", "project", "A2-B1"],
        ["solution", "a way to solve a problem", "workplace", "A2-B1"],
        ["teamwork", "working together with other people", "workplace", "A2-B1"],
        ["priority", "the level of importance of a task", "project", "A2-B1"],
        ["risk", "a possible problem that could affect a project", "project", "A2-B1"],
        ["issue ticket", "a record of a problem or request", "support", "A2-B1"],
        ["support case", "a user problem that support staff must handle", "support", "A2-B1"],
        ["user need", "something a user wants or must have", "project", "A2-B1"],
        ["test result", "information showing whether something works", "testing", "A2-B1"],
        ["work log", "a record of completed work", "project", "A2-B1"]
      ],

      hard: [
        ["stakeholder", "a person or group affected by a project", "project", "B1"],
        ["scope", "the boundaries of what a project will and will not include", "project", "B1"],
        ["milestone", "an important point or achievement in a project timeline", "project", "B1"],
        ["deliverable", "a finished item or result that must be delivered", "project", "B1"],
        ["sprint", "a short planned work period in agile development", "project", "B1"],
        ["backlog", "a list of tasks or features waiting to be done", "project", "B1"],
        ["approval", "official permission or agreement", "workplace", "B1"],
        ["handover", "passing work or responsibility to another person", "workplace", "B1"],
        ["maintenance", "ongoing work to keep a system working well", "software", "B1"],
        ["support ticket", "a record of a user problem or request", "support", "B1"],
        ["incident", "an unexpected problem that affects service", "support", "B1"],
        ["negotiation", "discussion to reach an agreement", "workplace", "B1"],
        ["proposal", "a document that suggests a plan or solution", "workplace", "B1"],
        ["quotation", "a document showing the expected price", "workplace", "B1"],
        ["invoice", "a document requesting payment", "workplace", "B1"],
        ["contract", "a formal agreement between parties", "workplace", "B1"],
        ["timeline", "a plan showing when tasks should happen", "project", "B1"],
        ["budget", "the amount of money planned for a project", "project", "B1"],
        ["resource", "people, time, money, or tools used for work", "project", "B1"],
        ["responsibility", "a duty or task a person must handle", "workplace", "B1"]
      ],

      challenge: [
        ["requirement analysis", "studying what users or clients need", "project", "B1+"],
        ["requirement change", "a change to what the system must do", "project", "B1+"],
        ["user story", "a short description of what a user needs and why", "project", "B1+"],
        ["acceptance criteria", "conditions that must be met for work to be accepted", "project", "B1+"],
        ["escalation", "moving an issue to a higher support level", "support", "B1+"],
        ["service outage", "a period when a system or service is not working", "support", "B1+"],
        ["root cause", "the main reason a problem happened", "support", "B1+"],
        ["impact analysis", "studying how a change or problem affects users", "project", "B1+"],
        ["change request", "a formal request to modify project work", "project", "B1+"],
        ["release note", "a short explanation of changes in a software release", "software", "B1+"],
        ["deployment plan", "a plan for releasing software to users", "software", "B1+"],
        ["rollout strategy", "a method for gradually releasing a system", "project", "B1+"],
        ["user training", "teaching users how to use a system", "workplace", "B1+"],
        ["stakeholder meeting", "a meeting with people affected by a project", "project", "B1+"],
        ["progress report", "a document explaining how much work is finished", "project", "B1+"],
        ["quality assurance", "activities used to check and improve quality", "testing", "B1+"],
        ["feasibility study", "checking whether a project can be done successfully", "project", "B1+"],
        ["project constraint", "a limit such as time, cost, or resources", "project", "B1+"],
        ["scope creep", "uncontrolled growth of project work", "project", "B1+"],
        ["lesson learned", "knowledge gained from a completed task or project", "project", "B1+"]
      ]
    },

    battle: {
      easy: [
        ["bug", "an error or problem in software", "battle-basic", "A2"],
        ["error", "something wrong in a program or system", "battle-basic", "A2"],
        ["warning", "a message that tells users about a possible problem", "battle-basic", "A2"],
        ["fix", "to repair a problem", "battle-basic", "A2"],
        ["test", "to check if something works correctly", "battle-basic", "A2"],
        ["fail", "to not work or not succeed", "battle-basic", "A2"],
        ["pass", "to meet a test or requirement", "battle-basic", "A2"],
        ["safe", "protected from danger or problems", "security", "A2"],
        ["unsafe", "not protected from danger or problems", "security", "A2"],
        ["lock", "to protect something so it cannot be opened easily", "security", "A2"],
        ["unlock", "to open access after protection is removed", "security", "A2"],
        ["virus", "harmful software that can damage systems", "security", "A2"],
        ["alert", "a message that warns about something important", "security", "A2"],
        ["attack", "an action that tries to harm a system", "security", "A2"],
        ["defend", "to protect a system from danger", "security", "A2"],
        ["score", "points earned in a game or activity", "game", "A2"],
        ["level", "a stage of difficulty or progress", "game", "A2"],
        ["mission", "a task or goal in a game or project", "game", "A2"],
        ["power-up", "an item that gives a temporary advantage", "game", "A2"],
        ["shield", "protection from damage or attack", "game", "A2"]
      ],

      normal: [
        ["debugging", "the process of finding and fixing errors in code", "battle-coding", "A2-B1"],
        ["crash", "when a program suddenly stops working", "software", "A2-B1"],
        ["glitch", "a small temporary problem in a system", "software", "A2-B1"],
        ["threat", "something that can harm a system or data", "security", "A2-B1"],
        ["malware", "software designed to harm a system", "security", "A2-B1"],
        ["phishing", "a trick used to steal information by pretending to be trusted", "security", "A2-B1"],
        ["spam", "unwanted messages sent to many people", "security", "A2-B1"],
        ["firewall", "a tool that blocks unsafe network traffic", "security", "A2-B1"],
        ["patch", "a small update that fixes a problem", "software", "A2-B1"],
        ["log file", "a record of events in a system", "system", "A2-B1"],
        ["access key", "a code used to enter or use a system", "security", "A2-B1"],
        ["token code", "a digital item used to prove access or identity", "security", "A2-B1"],
        ["session", "a period of activity between login and logout", "web", "A2-B1"],
        ["request", "a message asking a server for data or action", "network", "A2-B1"],
        ["response", "the message a server sends back after a request", "network", "A2-B1"],
        ["endpoint", "a specific URL where an API can be accessed", "network", "A2-B1"],
        ["payload", "the main data sent in a request or message", "network", "A2-B1"],
        ["latency", "delay before data or response is received", "performance", "A2-B1"],
        ["timeout", "when a system stops waiting after too much time", "network", "A2-B1"],
        ["retry limit", "the maximum number of times a system tries again", "system", "A2-B1"]
      ],

      hard: [
        ["authentication", "the process of checking who a user is", "security", "B1"],
        ["permission", "the right to access or do something in a system", "security", "B1"],
        ["authorization", "the process of deciding what a user is allowed to do", "security", "B1"],
        ["encryption", "the process of protecting data by making it unreadable", "security", "B1"],
        ["vulnerability", "a weakness that attackers can use", "security", "B1"],
        ["exploit", "a method used to take advantage of a weakness", "security", "B1"],
        ["breach", "an incident where protected data or systems are accessed", "security", "B1"],
        ["injection attack", "an attack that sends harmful input into a system", "security", "B1"],
        ["cross-site scripting", "an attack that runs harmful scripts in a browser", "security", "B1"],
        ["denial of service", "an attack that makes a service unavailable", "security", "B1"],
        ["anomaly", "something unusual in data or system behavior", "data", "B1"],
        ["monitoring", "watching a system to detect problems", "system", "B1"],
        ["audit trail", "a record showing who did what and when", "security", "B1"],
        ["incident response", "actions taken after a security or system problem", "security", "B1"],
        ["recovery plan", "steps used to restore a system after failure", "system", "B1"],
        ["data leak", "when private data is accidentally or illegally exposed", "security", "B1"],
        ["access control", "rules that decide who can use resources", "security", "B1"],
        ["secure channel", "a protected connection for sending data", "security", "B1"],
        ["system integrity", "the correctness and trustworthiness of a system", "security", "B1"],
        ["risk assessment", "the process of identifying and judging possible risks", "security", "B1"]
      ],

      challenge: [
        ["adversarial example", "input designed to trick an AI model", "ai-security", "B1+"],
        ["model drift", "when a model becomes less accurate because real data changes", "ai", "B1+"],
        ["overfitting", "when a model learns training data too closely", "ai", "B1+"],
        ["underfitting", "when a model is too simple to learn patterns well", "ai", "B1+"],
        ["feature engineering", "creating useful input features for a machine learning model", "ai", "B1+"],
        ["hyperparameter", "a setting chosen before model training", "ai", "B1+"],
        ["embedding", "a numeric representation of meaning", "ai", "B1+"],
        ["inference", "using a trained model to produce an answer or prediction", "ai", "B1+"],
        ["confusion matrix", "a table showing correct and incorrect classification results", "ai", "B1+"],
        ["precision", "how many selected items are actually correct", "ai", "B1+"],
        ["recall", "how many relevant items a model successfully finds", "ai", "B1+"],
        ["baseline model", "a simple model used for comparison", "ai", "B1+"],
        ["data pipeline", "a process that moves and prepares data step by step", "data", "B1+"],
        ["label noise", "incorrect or inconsistent labels in training data", "ai", "B1+"],
        ["anomaly detection", "finding unusual patterns or outliers in data", "ai", "B1+"],
        ["reinforcement learning", "learning by receiving rewards or penalties from actions", "ai", "B1+"],
        ["natural language processing", "AI that works with human language", "ai", "B1+"],
        ["computer vision", "AI that understands images or videos", "ai", "B1+"],
        ["recommendation system", "a system that suggests items based on data", "ai", "B1+"],
        ["data privacy", "protecting personal or sensitive data", "data", "B1+"]
      ]
    }
  };

  /* =========================================================
     HELPERS
  ========================================================= */

  function log(){
    try{
      console.log.apply(console, ["[VOCAB MODE POOLS]"].concat(Array.from(arguments)));
    }catch(e){}
  }

  function warn(){
    try{
      console.warn.apply(console, ["[VOCAB MODE POOLS]"].concat(Array.from(arguments)));
    }catch(e){}
  }

  function clean(s){
    return String(s ?? "").trim();
  }

  function lower(s){
    return clean(s).toLowerCase();
  }

  function pick(){
    for(let i = 0; i < arguments.length; i++){
      const v = arguments[i];
      if(v !== undefined && v !== null && v !== "") return v;
    }
    return "";
  }

  function hashSeed(s){
    s = String(s ?? "vocab-mode-pools");
    let h = 2166136261;

    for(let i = 0; i < s.length; i++){
      h ^= s.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }

    return h >>> 0;
  }

  function seededRandom(seed){
    let t = hashSeed(seed);

    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, seed){
    arr = (arr || []).slice();
    const rnd = seededRandom(seed || Date.now());

    for(let i = arr.length - 1; i > 0; i--){
      const j = Math.floor(rnd() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }

    return arr;
  }

  function escapeHtml(s){
    if(WIN.VocabUtils && typeof WIN.VocabUtils.escapeHtml === "function"){
      return WIN.VocabUtils.escapeHtml(s);
    }

    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function getParam(name, fallback){
    try{
      const p = new URLSearchParams(location.search);
      return p.get(name) || fallback || "";
    }catch(e){
      return fallback || "";
    }
  }

  function getActiveModeFromDom(){
    const active = DOC.querySelector("[data-vocab-mode].active");
    return active && active.dataset ? active.dataset.vocabMode : "";
  }

  function getActiveDifficultyFromDom(){
    const active = DOC.querySelector("[data-vocab-diff].active");
    return active && active.dataset ? active.dataset.vocabDiff : "";
  }

  function normalizeMode(mode){
    mode = lower(mode || "");

    if(mode === "ai" || mode === "training" || mode === "ai_training") return "learn";
    if(mode === "debug" || mode === "debug_mission") return "mission";
    if(mode === "boss" || mode === "boss_battle") return "battle";

    return MODES.includes(mode) ? mode : "learn";
  }

  function normalizeDifficulty(diff){
    diff = lower(diff || "");

    if(DIFFICULTIES.includes(diff)) return diff;

    return "easy";
  }

  function resolveMode(mode){
    const app = WIN.VOCAB_APP || WIN.VocabConfig || WIN.VOCAB_CONFIG || {};
    const state = getState();

    return normalizeMode(
      pick(
        mode,
        state.mode,
        state.selectedMode,
        app.mode,
        app.selectedMode,
        getActiveModeFromDom(),
        getParam("mode"),
        "learn"
      )
    );
  }

  function resolveDifficulty(diff){
    const app = WIN.VOCAB_APP || WIN.VocabConfig || WIN.VOCAB_CONFIG || {};
    const state = getState();

    return normalizeDifficulty(
      pick(
        diff,
        state.difficulty,
        state.diff,
        state.selectedDifficulty,
        app.difficulty,
        app.diff,
        app.selectedDifficulty,
        getActiveDifficultyFromDom(),
        getParam("diff"),
        getParam("difficulty"),
        "easy"
      )
    );
  }

  function getState(){
    try{
      if(WIN.VocabState && typeof WIN.VocabState.get === "function"){
        return WIN.VocabState.get() || {};
      }
    }catch(e){}

    try{
      if(WIN.VocabState && WIN.VocabState.state){
        return WIN.VocabState.state || {};
      }
    }catch(e){}

    return WIN.VOCAB_APP || {};
  }

  function entryFromTuple(tuple, mode, difficulty, index){
    return {
      id: mode + "-" + difficulty + "-" + String(index + 1).padStart(2, "0"),
      mode: mode,
      difficulty: difficulty,
      diff: difficulty,
      level: tuple[3],
      cefr: tuple[3],
      term: clean(tuple[0]),
      word: clean(tuple[0]),
      meaning: clean(tuple[1]),
      definition: clean(tuple[1]),
      category: clean(tuple[2]),
      bank: "MODE",
      source: "vocab.mode-pools.js"
    };
  }

  function getPool(mode, difficulty){
    mode = resolveMode(mode);
    difficulty = resolveDifficulty(difficulty);

    const list = (((POOLS[mode] || {})[difficulty]) || []);

    return list.map(function(tuple, index){
      return entryFromTuple(tuple, mode, difficulty, index);
    });
  }

  function getAllPools(){
    const out = [];

    MODES.forEach(function(mode){
      DIFFICULTIES.forEach(function(diff){
        out.push.apply(out, getPool(mode, diff));
      });
    });

    return out;
  }

  function getSiblingPools(mode, difficulty){
    mode = resolveMode(mode);
    difficulty = resolveDifficulty(difficulty);

    const out = [];

    DIFFICULTIES.forEach(function(diff){
      if(diff !== difficulty){
        out.push.apply(out, getPool(mode, diff));
      }
    });

    return out;
  }

  function getPoolByCategory(category, excludeTerm, mode, difficulty){
    category = lower(category);
    excludeTerm = lower(excludeTerm);

    return getPool(mode, difficulty).filter(function(x){
      return lower(x.category) === category && lower(x.term) !== excludeTerm;
    });
  }

  function dedupeByTerm(list){
    const seen = new Set();
    const out = [];

    (list || []).forEach(function(item){
      const key = lower(item && item.term);
      if(!key || seen.has(key)) return;

      seen.add(key);
      out.push(item);
    });

    return out;
  }

  function correctChoiceText(question){
    const correct = (question.choices || []).find(function(c){
      return !!c.correct;
    });

    return correct ? correct.text : "";
  }

  /* =========================================================
     QUESTION STYLE BY MODE
  ========================================================= */

  function promptFor(entry, mode, stage){
    mode = resolveMode(mode);

    if(mode === "speed"){
      return 'Quick! Choose the meaning of "' + entry.term + '".';
    }

    if(mode === "mission"){
      return missionPrompt(entry);
    }

    if(mode === "battle"){
      return battlePrompt(entry, stage);
    }

    return 'What does "' + entry.term + '" mean?';
  }

  function missionPrompt(entry){
    const cat = lower(entry.category);

    if(cat.includes("project")){
      return 'In a team project, someone says "' + entry.term + '". What does it mean?';
    }

    if(cat.includes("support")){
      return 'A user has a problem and the support team mentions "' + entry.term + '". What does it mean?';
    }

    if(cat.includes("workplace")){
      return 'During workplace communication, you hear "' + entry.term + '". What does it mean?';
    }

    if(cat.includes("testing")){
      return 'Your team is checking product quality and uses the term "' + entry.term + '". What does it mean?';
    }

    if(cat.includes("software")){
      return 'Your software team discusses "' + entry.term + '" before release. What does it mean?';
    }

    return 'In a real CS/AI work situation, what does "' + entry.term + '" mean?';
  }

  function battlePrompt(entry, stage){
    const stageId = lower(stage && stage.id);

    if(stageId === "boss"){
      return 'Boss trap! The enemy asks the meaning of "' + entry.term + '". Choose carefully.';
    }

    if(stageId === "trap"){
      return 'Trap round! Which meaning best matches "' + entry.term + '"?';
    }

    return 'Battle challenge: What does "' + entry.term + '" mean?';
  }

  function explanationFor(entry, mode){
    mode = resolveMode(mode);

    if(mode === "speed"){
      return '"' + entry.term + '" = "' + entry.meaning + '". Short and fast memory check.';
    }

    if(mode === "mission"){
      return '"' + entry.term + '" means "' + entry.meaning + '". This is useful in a real project or workplace situation.';
    }

    if(mode === "battle"){
      return '"' + entry.term + '" means "' + entry.meaning + '". Battle mode uses harder traps, so check the exact meaning.';
    }

    return '"' + entry.term + '" means "' + entry.meaning + '".';
  }

  /* =========================================================
     DISTRACTORS
  ========================================================= */

  function makeDistractors(entry, mode, difficulty, seed){
    mode = resolveMode(mode);
    difficulty = resolveDifficulty(difficulty);

    const sameCategory = getPoolByCategory(entry.category, entry.term, mode, difficulty);

    let pool = sameCategory
      .concat(getPool(mode, difficulty))
      .concat(mode === "battle" || difficulty === "challenge" ? getSiblingPools(mode, difficulty) : [])
      .filter(function(x){
        return lower(x.term) !== lower(entry.term) &&
               lower(x.meaning) !== lower(entry.meaning);
      });

    pool = dedupeByTerm(pool);

    const picked = shuffle(pool, seed).slice(0, 3);

    while(picked.length < 3){
      picked.push({
        term: "extra-" + picked.length,
        meaning: [
          "a general tool used in a computer system",
          "a simple action done by a user",
          "a basic part of a software project"
        ][picked.length] || "another possible meaning"
      });
    }

    return picked.map(function(x){
      return x.meaning;
    });
  }

  function buildChoices(entry, mode, difficulty, seed){
    const correct = entry.meaning;
    const distractors = makeDistractors(entry, mode, difficulty, seed);

    return shuffle([correct].concat(distractors), seed + "::choices").map(function(text){
      return {
        text: text,
        value: text,
        correct: text === correct
      };
    });
  }

  /* =========================================================
     GAMEPLAY QUESTION BUILDER
     Compatible with vocab.game.js:
     Question.buildQuestion(stage, game)
  ========================================================= */

  function buildGameplayQuestion(stage, game){
    game = game || {};
    stage = stage || {};

    const mode = resolveMode(game.mode);
    const difficulty = resolveDifficulty(game.difficulty);
    const deck = Array.isArray(game.terms) && game.terms.length
      ? game.terms
      : getPool(mode, difficulty);

    const index = Math.max(0, Number(game.globalQuestionIndex || 0)) % deck.length;
    const entry = normalizeTerm(deck[index], mode, difficulty, index);

    const seed = [
      VERSION,
      mode,
      difficulty,
      stage.id || "stage",
      game.sessionId || "",
      game.globalQuestionIndex || 0,
      entry.term
    ].join("::");

    const choices = buildChoices(entry, mode, difficulty, seed);

    return {
      id: entry.id + "-" + hashSeed(seed),
      source: "vocab.mode-pools.js",
      mode: mode,
      difficulty: difficulty,
      diff: difficulty,

      stageId: stage.id || "stage",
      stage_id: stage.id || "stage",
      stageName: stage.name || "Question",
      stage_name: stage.name || "Question",

      answerMode: mode === "mission" ? "scenario" : "meaning",
      questionMode: mode,

      correctTerm: entry,
      term: entry.term,
      word: entry.term,

      prompt: promptFor(entry, mode, stage),
      question: promptFor(entry, mode, stage),
      question_text: promptFor(entry, mode, stage),
      questionText: promptFor(entry, mode, stage),

      choices: choices,
      options: choices,

      correct: entry.meaning,
      answer: entry.meaning,
      correct_answer: entry.meaning,
      correctAnswer: entry.meaning,

      explain: explanationFor(entry, mode),
      explanation: explanationFor(entry, mode),

      hint: hintFor(entry, mode),
      cefr: entry.cefr,
      level: entry.level,
      category: entry.category
    };
  }

  function hintFor(entry, mode){
    mode = resolveMode(mode);

    if(mode === "speed"){
      return "Look for the shortest exact meaning.";
    }

    if(mode === "mission"){
      return "Think about the workplace or project situation.";
    }

    if(mode === "battle"){
      return "Avoid close meanings. Choose the exact technical meaning.";
    }

    return "Think about how this word is used in technology or coding.";
  }

  function normalizeTerm(item, mode, difficulty, index){
    if(Array.isArray(item)){
      return entryFromTuple(item, mode, difficulty, index || 0);
    }

    item = item || {};

    return {
      id: clean(pick(item.id, mode + "-" + difficulty + "-" + (index || 0))),
      mode: clean(pick(item.mode, mode)),
      difficulty: clean(pick(item.difficulty, item.diff, difficulty)),
      diff: clean(pick(item.difficulty, item.diff, difficulty)),
      level: clean(pick(item.level, item.cefr, LEVEL_BY_DIFF[difficulty] || "")),
      cefr: clean(pick(item.cefr, item.level, LEVEL_BY_DIFF[difficulty] || "")),
      term: clean(pick(item.term, item.word, "")),
      word: clean(pick(item.word, item.term, "")),
      meaning: clean(pick(item.meaning, item.definition, item.answer, "")),
      definition: clean(pick(item.definition, item.meaning, item.answer, "")),
      category: clean(pick(item.category, item.cat, "")),
      bank: clean(pick(item.bank, "MODE")),
      source: clean(pick(item.source, "vocab.mode-pools.js"))
    };
  }

  /* =========================================================
     DECK BUILDER
     Compatible with vocab.game.js:
     Question.buildTermDeck(bank, difficulty)
  ========================================================= */

  function buildTermDeck(bank, difficulty, mode){
    const m = resolveMode(mode);
    const d = resolveDifficulty(difficulty);

    const deck = getPool(m, d);

    return shuffle(deck, [
      VERSION,
      m,
      d,
      bank || "MODE",
      getParam("seed", ""),
      Date.now()
    ].join("::"));
  }

  function getEntries(mode, difficulty){
    return getPool(mode, difficulty);
  }

  function getQuestions(options){
    options = options || {};

    const mode = resolveMode(options.mode || options.selectedMode);
    const difficulty = resolveDifficulty(options.difficulty || options.diff || options.selectedDifficulty);
    const count = Math.min(20, Math.max(1, Number(options.count || 20)));

    const fakeGame = {
      mode: mode,
      difficulty: difficulty,
      terms: buildTermDeck("MODE", difficulty, mode),
      sessionId: "preview",
      globalQuestionIndex: 0
    };

    const stage = {
      id: mode === "battle" ? "boss" : mode,
      name: mode
    };

    const out = [];

    for(let i = 0; i < count; i++){
      fakeGame.globalQuestionIndex = i;
      out.push(buildGameplayQuestion(stage, fakeGame));
    }

    return out;
  }

  /* =========================================================
     CONFIG PATCH
     Force every difficulty to use 20 words/questions
  ========================================================= */

  function installConfig(){
    WIN.VOCAB_APP = WIN.VOCAB_APP || {};

    WIN.VOCAB_APP.DIFFICULTY = Object.assign({}, WIN.VOCAB_APP.DIFFICULTY || {}, {
      easy: {
        label: "Easy",
        cefr: "A2",
        totalQuestions: 20,
        timePerQuestion: 20,
        playerHp: 6,
        bossMultiplier: 0.80
      },

      normal: {
        label: "Normal",
        cefr: "A2-B1",
        totalQuestions: 20,
        timePerQuestion: 17,
        playerHp: 5,
        bossMultiplier: 1.00
      },

      hard: {
        label: "Hard",
        cefr: "B1",
        totalQuestions: 20,
        timePerQuestion: 14,
        playerHp: 5,
        bossMultiplier: 1.20
      },

      challenge: {
        label: "Challenge",
        cefr: "B1+",
        totalQuestions: 20,
        timePerQuestion: 11,
        playerHp: 4,
        bossMultiplier: 1.45
      }
    });

    WIN.VOCAB_APP.MODES = Object.assign({}, WIN.VOCAB_APP.MODES || {}, {
      learn: {
        id: "learn",
        label: "AI Training",
        shortLabel: "AI",
        icon: "🤖",
        totalQuestionBonus: 0,
        timeBonus: 4,
        startHints: 3,
        startShield: 2,
        feverComboNeed: 5,
        laserComboNeed: 8,
        scoreMultiplier: 0.90,
        stageOrder: ["warmup", "warmup", "trap", "mission"]
      },

      speed: {
        id: "speed",
        label: "Speed Run",
        shortLabel: "Speed",
        icon: "⚡",
        totalQuestionBonus: 0,
        timeBonus: -2,
        startHints: 1,
        startShield: 1,
        feverComboNeed: 4,
        laserComboNeed: 7,
        scoreMultiplier: 1.10,
        stageOrder: ["speed", "speed", "trap", "boss"]
      },

      mission: {
        id: "mission",
        label: "Debug Mission",
        shortLabel: "Mission",
        icon: "🎯",
        totalQuestionBonus: 0,
        timeBonus: 1,
        startHints: 2,
        startShield: 1,
        feverComboNeed: 5,
        laserComboNeed: 8,
        scoreMultiplier: 1.00,
        stageOrder: ["mission", "trap", "mission", "boss"]
      },

      battle: {
        id: "battle",
        label: "Boss Battle",
        shortLabel: "Boss",
        icon: "👾",
        totalQuestionBonus: 0,
        timeBonus: -1,
        startHints: 1,
        startShield: 1,
        feverComboNeed: 4,
        laserComboNeed: 6,
        scoreMultiplier: 1.20,
        stageOrder: ["trap", "speed", "boss", "boss"]
      }
    });
  }

  /* =========================================================
     AUDIT
  ========================================================= */

  function audit(){
    const termMap = new Map();
    const rows = [];
    const errors = [];

    MODES.forEach(function(mode){
      DIFFICULTIES.forEach(function(diff){
        const list = getPool(mode, diff);
        const terms = list.map(function(x){
          return lower(x.term);
        });

        const unique = new Set(terms);

        rows.push({
          mode: mode,
          difficulty: diff,
          cefr: LEVEL_BY_DIFF[diff],
          count: list.length,
          unique: unique.size
        });

        if(list.length !== 20){
          errors.push(mode + "/" + diff + " must have 20 terms, found " + list.length);
        }

        if(unique.size !== list.length){
          errors.push(mode + "/" + diff + " has duplicated terms inside the same pool");
        }

        list.forEach(function(item){
          const key = lower(item.term);

          if(termMap.has(key)){
            errors.push("Duplicated term across pools: " + item.term + " in " + mode + "/" + diff + " and " + termMap.get(key));
          }else{
            termMap.set(key, mode + "/" + diff);
          }
        });
      });
    });

    const report = {
      ok: errors.length === 0,
      version: VERSION,
      totalTerms: termMap.size,
      expectedTerms: 320,
      rows: rows,
      errors: errors
    };

    try{
      localStorage.setItem("VOCAB_MODE_POOLS_AUDIT", JSON.stringify(report));
    }catch(e){}

    if(report.ok){
      log("audit PASS", report);
    }else{
      warn("audit CHECK", report);
    }

    return report;
  }

  /* =========================================================
     INSTALL / OVERRIDE VocabQuestion
  ========================================================= */

  function installQuestionPatch(){
    const Q = WIN.VocabQuestion || WIN.VocabQuestions || WIN.VocabQuestionEngine || {};

    const original = {
      buildQuestion: Q.buildQuestion,
      buildTermDeck: Q.buildTermDeck,
      getQuestions: Q.getQuestions,
      getEntries: Q.getEntries
    };

    const api = Object.assign({}, Q, {
      modePoolsVersion: VERSION,
      __modePoolsPatched: true,
      __original: original,

      pools: POOLS,
      modes: MODES.slice(),
      difficulties: DIFFICULTIES.slice(),

      normalizeMode: normalizeMode,
      normalizeDifficulty: normalizeDifficulty,

      getPool: getPool,
      getEntries: getEntries,
      getAllPools: getAllPools,

      buildTermDeck: buildTermDeck,
      buildQuestion: buildGameplayQuestion,
      getQuestions: getQuestions,

      correctChoiceText: correctChoiceText,
      audit: audit
    });

    WIN.VocabQuestion = api;
    WIN.VocabQuestions = api;
    WIN.VocabQuestionEngine = api;

    WIN.VocabModePools = {
      version: VERSION,
      pools: POOLS,
      getPool: getPool,
      getAllPools: getAllPools,
      buildTermDeck: buildTermDeck,
      buildGameplayQuestion: buildGameplayQuestion,
      getQuestions: getQuestions,
      audit: audit
    };

    WIN.VocabModules = WIN.VocabModules || {};
    WIN.VocabModules.modePools = true;

    WIN.__VOCAB_MODULES__ = WIN.__VOCAB_MODULES__ || {};
    WIN.__VOCAB_MODULES__.modePools = true;

    return api;
  }

  function boot(){
    installConfig();
    installQuestionPatch();

    const report = audit();

    log("loaded", VERSION, {
      ok: report.ok,
      totalTerms: report.totalTerms,
      expectedTerms: report.expectedTerms
    });
  }

  boot();
})();
