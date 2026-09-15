const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data.db');

// We export a promise that resolves to the db wrapper
let _db = null;
let _sqlJsDb = null; // raw sql.js Database instance for export

// Persist to disk after every write
function persist() {
  try {
    const data = _sqlJsDb.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch(e) {
    console.error('DB persist error:', e.message);
  }
}

// Wrap sql.js API to be synchronous (prepare/run/get/all)
function makeWrapper(sqlJsDb) {
  return {
    prepare(sql) {
      return {
        run(...params) {
          sqlJsDb.run(sql, params);
          persist();
          // Return lastInsertRowid
          const rows = sqlJsDb.exec('SELECT last_insert_rowid() as id');
          return { lastInsertRowid: rows[0]?.values[0][0] ?? null };
        },
        get(...params) {
          const stmt = sqlJsDb.prepare(sql);
          stmt.bind(params);
          if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.free();
            return row;
          }
          stmt.free();
          return undefined;
        },
        all(...params) {
          const stmt = sqlJsDb.prepare(sql);
          stmt.bind(params);
          const rows = [];
          while (stmt.step()) rows.push(stmt.getAsObject());
          stmt.free();
          return rows;
        },
        free() {}
      };
    },
    exec(sql) { return sqlJsDb.exec(sql); },
    pragma(sql) {
      try { sqlJsDb.run('PRAGMA ' + sql); } catch(e) {}
    },
    run(sql, params) {
      sqlJsDb.run(sql, params || []);
      persist();
    },
    // Convenience: direct get/all without prepare
    get(sql, ...params) {
      const stmt = sqlJsDb.prepare(sql);
      stmt.bind(params);
      let row;
      if (stmt.step()) row = stmt.getAsObject();
      stmt.free();
      return row;
    },
    all(sql, ...params) {
      const stmt = sqlJsDb.prepare(sql);
      stmt.bind(params);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      return rows;
    }
  };
}

async function initDB() {
  if (_db) return _db;

  const SQL = await initSqlJs();
  let sqlJsDb;
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    sqlJsDb = new SQL.Database(fileBuffer);
  } else {
    sqlJsDb = new SQL.Database();
  }

  _sqlJsDb = sqlJsDb; // save raw reference for persist()
  _db = makeWrapper(sqlJsDb);

  // Schema
  sqlJsDb.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      avatar_color TEXT DEFAULT '#2563eb',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS teacher_students (
      teacher_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      PRIMARY KEY (teacher_id, student_id)
    );
    CREATE TABLE IF NOT EXISTS sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS subsections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      level TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subsection_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS lesson_pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      data TEXT NOT NULL DEFAULT '{}',
      sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS student_lesson_access (
      student_id INTEGER NOT NULL,
      lesson_id INTEGER NOT NULL,
      granted_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (student_id, lesson_id)
    );
    CREATE TABLE IF NOT EXISTS exercise_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      exercise_id INTEGER NOT NULL,
      student_id INTEGER,
      response TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(session_id, exercise_id)
    );
    CREATE TABLE IF NOT EXISTS lesson_sessions (
      id TEXT PRIMARY KEY,
      lesson_id INTEGER NOT NULL,
      teacher_id INTEGER NOT NULL,
      student_id INTEGER,
      current_page_id INTEGER,
      audio_state TEXT DEFAULT '{}',
      started_at TEXT DEFAULT (datetime('now')),
      ended_at TEXT
    );
  `);
  persist();

  // Seed if empty
  const admin = _db.get('SELECT id FROM users WHERE email=?', 'admin@englishschool.pro');
  if (!admin) {
    const adminHash = bcrypt.hashSync('admin123', 10);
    sqlJsDb.run(`INSERT INTO users (name,email,password,role,avatar_color) VALUES (?,?,?,?,?)`,
      ['Administrator','admin@englishschool.pro', adminHash,'admin','#7c3aed']);
    persist();

    const teacherHash = bcrypt.hashSync('teacher123', 10);
    sqlJsDb.run(`INSERT INTO users (name,email,password,role,avatar_color) VALUES (?,?,?,?,?)`,
      ['Anna Kovalenko','teacher@englishschool.pro', teacherHash,'teacher','#2563eb']);
    persist();
    const teacherRow = _db.get(`SELECT id FROM users WHERE email=?`, 'teacher@englishschool.pro');
    const teacherId = teacherRow.id;

    const studentHash = bcrypt.hashSync('student123', 10);
    sqlJsDb.run(`INSERT INTO users (name,email,password,role,avatar_color) VALUES (?,?,?,?,?)`,
      ['Ivan Petrov','student@englishschool.pro', studentHash,'student','#059669']);
    persist();
    const studentRow = _db.get(`SELECT id FROM users WHERE email=?`, 'student@englishschool.pro');
    const studentId = studentRow.id;

    sqlJsDb.run(`INSERT OR IGNORE INTO teacher_students VALUES (?,?)`, [teacherId, studentId]);
    persist();

    // Demo curriculum
    sqlJsDb.run(`INSERT INTO sections (name,sort_order) VALUES (?,?)`, ['General English', 0]);
    persist();
    const secRow = _db.get(`SELECT id FROM sections WHERE name=?`, 'General English');
    const secId = secRow.id;

    sqlJsDb.run(`INSERT INTO subsections (section_id,name,level,sort_order) VALUES (?,?,?,?)`,
      [secId,'Upper Intermediate','Upper Intermediate',0]);
    persist();
    const subRow = _db.get(`SELECT id FROM subsections WHERE section_id=?`, secId);
    const subId = subRow.id;

    sqlJsDb.run(`INSERT INTO lessons (subsection_id,title,description,sort_order) VALUES (?,?,?,?)`,
      [subId,'Sports & Language','Practise vocabulary and grammar around sports.',0]);
    persist();
    const lesRow = _db.get(`SELECT id FROM lessons WHERE subsection_id=?`, subId);
    const lesId = lesRow.id;

    sqlJsDb.run(`INSERT OR IGNORE INTO student_lesson_access (student_id,lesson_id) VALUES (?,?)`,
      [studentId, lesId]);
    persist();

    // Pages
    sqlJsDb.run(`INSERT INTO lesson_pages (lesson_id,title,sort_order) VALUES (?,?,?)`, [lesId,'Warm Up',0]);
    persist();
    const p1 = _db.get(`SELECT id FROM lesson_pages WHERE lesson_id=? AND title=?`, lesId, 'Warm Up');

    sqlJsDb.run(`INSERT INTO lesson_pages (lesson_id,title,sort_order) VALUES (?,?,?)`, [lesId,'Listening',1]);
    persist();
    const p2 = _db.get(`SELECT id FROM lesson_pages WHERE lesson_id=? AND title=?`, lesId, 'Listening');

    sqlJsDb.run(`INSERT INTO lesson_pages (lesson_id,title,sort_order) VALUES (?,?,?)`, [lesId,'Vocabulary',2]);
    persist();
    const p3 = _db.get(`SELECT id FROM lesson_pages WHERE lesson_id=? AND title=?`, lesId, 'Vocabulary');

    sqlJsDb.run(`INSERT INTO lesson_pages (lesson_id,title,sort_order) VALUES (?,?,?)`, [lesId,'Grammar',3]);
    persist();
    const p4 = _db.get(`SELECT id FROM lesson_pages WHERE lesson_id=? AND title=?`, lesId, 'Grammar');


    // Exercises — rich demo covering all types
    const execs = [

      // ── PAGE 1: Warm Up ──────────────────────────────────────
      [p1.id,'text',JSON.stringify({
        heading:'🏟️ Sports & Language — Upper Intermediate',
        text:'In this lesson we will explore sports vocabulary, practise listening comprehension, and work on grammar structures used when talking about sports events.\n\nLook at the questions below and discuss them with your teacher before we begin.'
      }),0],
      [p1.id,'teacher_note',JSON.stringify({
        text:'Ask the student to speak for at least 2 minutes before moving on. Listen for: use of present perfect vs past simple, sports-related collocations, and fluency. Note any errors to return to in the Grammar page.',
        can_show:false
      }),1],
      [p1.id,'multiple_choice',JSON.stringify({
        question:'Which of the following phrases means a match ended with the same score for both teams?',
        options:['A clean sheet','A draw','An own goal','A hat-trick'],
        correct:1
      }),2],
      [p1.id,'multiple_choice',JSON.stringify({
        question:'In football, what does a yellow card mean?',
        options:['The player is sent off immediately','A formal warning to the player','The game is paused for injury','A penalty kick is awarded'],
        correct:1
      }),3],

      // ── PAGE 2: Listening ─────────────────────────────────────
      [p2.id,'teacher_note',JSON.stringify({
        text:'TEACHER INSTRUCTIONS: Play the audio twice. First listen: students focus on the general topic. Second listen: students answer the comprehension questions below.\n\nKey vocabulary to pre-teach: referee, offside, penalty shootout, substitute.',
        can_show:true
      }),0],
      [p2.id,'audio',JSON.stringify({
        title:'Sports Commentary: Championship Final',
        duration:156,
        url:''
      }),1],
      [p2.id,'dropdown',JSON.stringify({
        sentences:[
          {before:'The referee',blank:{options:['blow','blew','has blown','blown'],correct:'blew'},after:'his whistle to signal the end of the match.'},
          {before:'By the time the goalkeeper',blank:{options:['react','reacted','has reacted','reacting'],correct:'reacted'},after:'the ball was already in the net.'},
          {before:'The home team',blank:{options:['has been winning','won','wins','have won'],correct:'has been winning'},after:'three consecutive championships.'},
          {before:'She',blank:{options:['referee','refereed','refereeing','has referee'],correct:'refereed'},after:'her first professional match at the age of twenty-four.'},
        ]
      }),2],
      [p2.id,'multiple_choice',JSON.stringify({
        question:'According to the commentary, why was a penalty awarded?',
        options:['The goalkeeper handled the ball outside the box','A defender committed a foul inside the penalty area','The ball crossed the goal line','A player was in an offside position'],
        correct:1
      }),3],

      // ── PAGE 3: Vocabulary ────────────────────────────────────
      [p3.id,'text',JSON.stringify({
        heading:'Sports Vocabulary',
        text:'Work through the vocabulary exercises below. Drag the correct labels to the images, then match the collocations in the second exercise.'
      }),0],
      [p3.id,'image_match',JSON.stringify({
        pairs:[
          {image:'🏟️',label:'stadium'},
          {image:'🧑‍⚖️',label:'referee'},
          {image:'🟨',label:'yellow card'},
          {image:'🟥',label:'red card'},
          {image:'⚽',label:'goal'},
          {image:'🚩',label:'offside flag'},
        ]
      }),1],
      [p3.id,'matching',JSON.stringify({
        pairs:[
          {a:'blow a whistle',b:'signal a decision'},
          {a:'score a penalty',b:'kick from the spot'},
          {a:'commit a foul',b:'break the rules'},
          {a:'save a shot',b:'goalkeeper stops the ball'},
          {a:'substitute a player',b:'bring someone on from the bench'},
        ]
      }),2],
      [p3.id,'fill_blank_type',JSON.stringify({
        sentences:[
          {before:'The striker',answer:'scored',after:'a hat-trick in the second half.'},
          {before:'The referee showed him a',answer:'red',after:'card and he had to leave the pitch.'},
          {before:'The goalkeeper made an incredible',answer:'save',after:'in the final minute of the match.'},
          {before:'After ninety minutes the score was level, so the match went to a',answer:'penalty',after:'shootout.'},
        ]
      }),3],

      // ── PAGE 4: Grammar ───────────────────────────────────────
      [p4.id,'text',JSON.stringify({
        heading:'Grammar Focus: Past Simple vs Present Perfect',
        text:'Sports commentary and reporting use a mix of past simple and present perfect. Study the examples then complete the exercises below.'
      }),0],
      [p4.id,'teacher_note',JSON.stringify({
        text:'Remind the student of the key rule: Past Simple = finished time reference ("She won in 2019"). Present Perfect = connection to now / unfinished time ("She has won three times"). Common error: "She has won yesterday" — show them why this is wrong.',
        can_show:true
      }),1],
      [p4.id,'fill_blank_hint',JSON.stringify({
        sentences:[
          {before:'The team',hint:'exhaust →',answer:'exhausted',after:'all their substitutes by the seventy-fifth minute.'},
          {before:'She is one of the most',hint:'experience →',answer:'experienced',after:'referees in the country.'},
          {before:'The young striker is',hint:'amaze →',answer:'amazing',after:'everyone with his performances this season.'},
          {before:'The match was',hint:'disappoint →',answer:'disappointing',after:'for the fans who had travelled so far.'},
          {before:'It was a',hint:'thrill →',answer:'thrilling',after:'final that no one will forget.'},
        ]
      }),2],
      [p4.id,'dropdown',JSON.stringify({
        sentences:[
          {before:'She',blank:{options:['wins','won','has won','had won'],correct:'has won'},after:'four gold medals throughout her career.'},
          {before:'The team',blank:{options:['trains','trained','has trained','had trained'],correct:'trained'},after:'twice a day before the championship.'},
          {before:'I',blank:{options:['never see','never saw','have never seen','had never seen'],correct:'have never seen'},after:'such a dramatic penalty shootout.'},
          {before:'The referee',blank:{options:['announces','announced','has announced','had announced'],correct:'announced'},after:'the result three hours ago.'},
        ]
      }),3],
    ];

    for (const [pid,type,data,order] of execs) {
      sqlJsDb.run(`INSERT INTO exercises (page_id,type,data,sort_order) VALUES (?,?,?,?)`, [pid,type,data,order]);
      persist();
    }


    console.log('✅ Database seeded with demo data');
  }

  return _db;
}

module.exports = { initDB };
