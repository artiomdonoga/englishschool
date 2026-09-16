const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const { initDB } = require('./db');
const { sign, verify, requireAuth } = require('./auth');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Force HTTPS in production (Railway sets X-Forwarded-Proto)
app.use((req, res, next) => {
  if (process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production') {
    if (req.headers['x-forwarded-proto'] === 'http') {
      return res.redirect(301, 'https://' + req.headers.host + req.url);
    }
    // Tell browsers to always use HTTPS for this domain for 1 year
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

let db;

// ── AUTH ──────────────────────────────────
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = db.get('SELECT * FROM users WHERE email=?', email);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Invalid credentials' });
  const token = sign(user);
  res.cookie('token', token, { httpOnly: true, maxAge: 7 * 86400000 });
  res.json({ token, user: { id: user.id, name: user.name, role: user.role, avatar_color: user.avatar_color } });
});

app.post('/api/logout', (req, res) => { res.clearCookie('token'); res.json({ ok: true }); });

app.get('/api/me', requireAuth(), (req, res) => {
  const user = db.get('SELECT id,name,email,role,avatar_color FROM users WHERE id=?', req.user.id);
  res.json(user);
});

// ── ADMIN USERS ───────────────────────────
app.get('/api/admin/users', requireAuth(['admin']), (req, res) => {
  res.json(db.all('SELECT id,name,email,role,avatar_color,created_at FROM users ORDER BY role,name'));
});

app.post('/api/admin/users', requireAuth(['admin']), (req, res) => {
  const { name, email, password, role, avatar_color } = req.body;
  const hash = bcrypt.hashSync(password, 10);
  const colors = { admin:'#7c3aed', teacher:'#2563eb', student:'#059669' };
  try {
    const r = db.prepare('INSERT INTO users (name,email,password,role,avatar_color) VALUES (?,?,?,?,?)')
      .run(name, email, hash, role, avatar_color || colors[role] || '#2563eb');
    res.json({ id: r.lastInsertRowid });
  } catch(e) { res.status(400).json({ error: 'Email already exists' }); }
});

app.put('/api/admin/users/:id', requireAuth(['admin']), (req, res) => {
  const { name, email, password, avatar_color } = req.body;
  if (password) {
    db.prepare('UPDATE users SET name=?,email=?,password=?,avatar_color=? WHERE id=?')
      .run(name, email, bcrypt.hashSync(password, 10), avatar_color, req.params.id);
  } else {
    db.prepare('UPDATE users SET name=?,email=?,avatar_color=? WHERE id=?')
      .run(name, email, avatar_color, req.params.id);
  }
  res.json({ ok: true });
});

app.delete('/api/admin/users/:id', requireAuth(['admin']), (req, res) => {
  db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/admin/links', requireAuth(['admin']), (req, res) => {
  res.json(db.all(`
    SELECT ts.teacher_id, ts.student_id, t.name teacher_name, s.name student_name
    FROM teacher_students ts
    JOIN users t ON t.id=ts.teacher_id
    JOIN users s ON s.id=ts.student_id`));
});

app.post('/api/admin/links', requireAuth(['admin']), (req, res) => {
  const { teacher_id, student_id } = req.body;
  db.prepare('INSERT OR IGNORE INTO teacher_students VALUES (?,?)').run(teacher_id, student_id);
  res.json({ ok: true });
});

app.delete('/api/admin/links/:tid/:sid', requireAuth(['admin']), (req, res) => {
  db.prepare('DELETE FROM teacher_students WHERE teacher_id=? AND student_id=?').run(req.params.tid, req.params.sid);
  res.json({ ok: true });
});

// ── CURRICULUM ────────────────────────────
app.get('/api/sections', requireAuth(), (req, res) => {
  res.json(db.all('SELECT * FROM sections ORDER BY sort_order,name'));
});
app.post('/api/sections', requireAuth(['admin']), (req, res) => {
  const r = db.prepare('INSERT INTO sections (name,sort_order) VALUES (?,?)').run(req.body.name, req.body.sort_order||0);
  res.json({ id: r.lastInsertRowid });
});
app.put('/api/sections/:id', requireAuth(['admin']), (req, res) => {
  db.prepare('UPDATE sections SET name=?,sort_order=? WHERE id=?').run(req.body.name, req.body.sort_order||0, req.params.id);
  res.json({ ok: true });
});
app.delete('/api/sections/:id', requireAuth(['admin']), (req, res) => {
  // Cascade manually (sql.js doesn't enforce FK by default)
  const subs = db.all('SELECT id FROM subsections WHERE section_id=?', req.params.id);
  for (const sub of subs) {
    const lessons = db.all('SELECT id FROM lessons WHERE subsection_id=?', sub.id);
    for (const les of lessons) {
      const pages = db.all('SELECT id FROM lesson_pages WHERE lesson_id=?', les.id);
      for (const pg of pages) db.prepare('DELETE FROM exercises WHERE page_id=?').run(pg.id);
      db.prepare('DELETE FROM lesson_pages WHERE lesson_id=?').run(les.id);
      db.prepare('DELETE FROM student_lesson_access WHERE lesson_id=?').run(les.id);
    }
    db.prepare('DELETE FROM lessons WHERE subsection_id=?').run(sub.id);
  }
  db.prepare('DELETE FROM subsections WHERE section_id=?').run(req.params.id);
  db.prepare('DELETE FROM sections WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/sections/:id/subsections', requireAuth(), (req, res) => {
  res.json(db.all('SELECT * FROM subsections WHERE section_id=? ORDER BY sort_order,name', req.params.id));
});
app.post('/api/subsections', requireAuth(['admin']), (req, res) => {
  const { section_id, name, level, sort_order } = req.body;
  const r = db.prepare('INSERT INTO subsections (section_id,name,level,sort_order) VALUES (?,?,?,?)').run(section_id, name, level, sort_order||0);
  res.json({ id: r.lastInsertRowid });
});
app.put('/api/subsections/:id', requireAuth(['admin']), (req, res) => {
  db.prepare('UPDATE subsections SET name=?,level=?,sort_order=? WHERE id=?').run(req.body.name, req.body.level, req.body.sort_order||0, req.params.id);
  res.json({ ok: true });
});
app.delete('/api/subsections/:id', requireAuth(['admin']), (req, res) => {
  const lessons = db.all('SELECT id FROM lessons WHERE subsection_id=?', req.params.id);
  for (const les of lessons) {
    const pages = db.all('SELECT id FROM lesson_pages WHERE lesson_id=?', les.id);
    for (const pg of pages) db.prepare('DELETE FROM exercises WHERE page_id=?').run(pg.id);
    db.prepare('DELETE FROM lesson_pages WHERE lesson_id=?').run(les.id);
    db.prepare('DELETE FROM student_lesson_access WHERE lesson_id=?').run(les.id);
  }
  db.prepare('DELETE FROM lessons WHERE subsection_id=?').run(req.params.id);
  db.prepare('DELETE FROM subsections WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/subsections/:id/lessons', requireAuth(), (req, res) => {
  res.json(db.all('SELECT * FROM lessons WHERE subsection_id=? ORDER BY sort_order,title', req.params.id));
});
app.post('/api/lessons', requireAuth(['admin']), (req, res) => {
  const { subsection_id, title, description, sort_order } = req.body;
  const r = db.prepare('INSERT INTO lessons (subsection_id,title,description,sort_order) VALUES (?,?,?,?)').run(subsection_id, title, description||'', sort_order||0);
  res.json({ id: r.lastInsertRowid });
});
app.put('/api/lessons/:id', requireAuth(['admin']), (req, res) => {
  db.prepare('UPDATE lessons SET title=?,description=?,sort_order=? WHERE id=?').run(req.body.title, req.body.description||'', req.body.sort_order||0, req.params.id);
  res.json({ ok: true });
});
app.delete('/api/lessons/:id', requireAuth(['admin']), (req, res) => {
  const pages = db.all('SELECT id FROM lesson_pages WHERE lesson_id=?', req.params.id);
  for (const pg of pages) db.prepare('DELETE FROM exercises WHERE page_id=?').run(pg.id);
  db.prepare('DELETE FROM lesson_pages WHERE lesson_id=?').run(req.params.id);
  db.prepare('DELETE FROM student_lesson_access WHERE lesson_id=?').run(req.params.id);
  db.prepare('DELETE FROM lessons WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/curriculum', requireAuth(), (req, res) => {
  const sections = db.all('SELECT * FROM sections ORDER BY sort_order,name');
  for (const s of sections) {
    s.subsections = db.all('SELECT * FROM subsections WHERE section_id=? ORDER BY sort_order,name', s.id);
    for (const sub of s.subsections) {
      sub.lessons = db.all('SELECT * FROM lessons WHERE subsection_id=? ORDER BY sort_order,title', sub.id);
    }
  }
  res.json(sections);
});

// ── PAGES & EXERCISES ─────────────────────
app.get('/api/lessons/:id/pages', requireAuth(), (req, res) => {
  res.json(db.all('SELECT * FROM lesson_pages WHERE lesson_id=? ORDER BY sort_order', req.params.id));
});
app.post('/api/lesson_pages', requireAuth(['admin']), (req, res) => {
  const { lesson_id, title, sort_order } = req.body;
  const r = db.prepare('INSERT INTO lesson_pages (lesson_id,title,sort_order) VALUES (?,?,?)').run(lesson_id, title, sort_order||0);
  res.json({ id: r.lastInsertRowid });
});
app.put('/api/lesson_pages/:id', requireAuth(['admin']), (req, res) => {
  db.prepare('UPDATE lesson_pages SET title=?,sort_order=? WHERE id=?').run(req.body.title, req.body.sort_order||0, req.params.id);
  res.json({ ok: true });
});
app.delete('/api/lesson_pages/:id', requireAuth(['admin']), (req, res) => {
  db.prepare('DELETE FROM exercises WHERE page_id=?').run(req.params.id);
  db.prepare('DELETE FROM lesson_pages WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/pages/:id/exercises', requireAuth(), (req, res) => {
  const exs = db.all('SELECT * FROM exercises WHERE page_id=? ORDER BY sort_order', req.params.id);
  res.json(exs.map(e => ({ ...e, data: JSON.parse(e.data) })));
});
app.post('/api/exercises', requireAuth(['admin']), (req, res) => {
  const { page_id, type, data, sort_order } = req.body;
  const r = db.prepare('INSERT INTO exercises (page_id,type,data,sort_order) VALUES (?,?,?,?)')
    .run(page_id, type, JSON.stringify(data||{}), sort_order||0);
  res.json({ id: r.lastInsertRowid });
});
app.put('/api/exercises/:id', requireAuth(['admin']), (req, res) => {
  db.prepare('UPDATE exercises SET type=?,data=?,sort_order=? WHERE id=?')
    .run(req.body.type, JSON.stringify(req.body.data||{}), req.body.sort_order||0, req.params.id);
  res.json({ ok: true });
});
app.delete('/api/exercises/:id', requireAuth(['admin']), (req, res) => {
  db.prepare('DELETE FROM exercises WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── TEACHER ───────────────────────────────
app.get('/api/teacher/students', requireAuth(['teacher']), (req, res) => {
  res.json(db.all(`
    SELECT u.id,u.name,u.email,u.avatar_color FROM users u
    JOIN teacher_students ts ON ts.student_id=u.id
    WHERE ts.teacher_id=?`, req.user.id));
});

app.get('/api/teacher/student/:sid/access', requireAuth(['teacher']), (req, res) => {
  res.json(db.all('SELECT lesson_id FROM student_lesson_access WHERE student_id=?', req.params.sid).map(r=>r.lesson_id));
});

app.post('/api/teacher/student/:sid/access', requireAuth(['teacher']), (req, res) => {
  db.prepare('INSERT OR IGNORE INTO student_lesson_access (student_id,lesson_id) VALUES (?,?)').run(req.params.sid, req.body.lesson_id);
  res.json({ ok: true });
});

app.delete('/api/teacher/student/:sid/access/:lid', requireAuth(['teacher']), (req, res) => {
  db.prepare('DELETE FROM student_lesson_access WHERE student_id=? AND lesson_id=?').run(req.params.sid, req.params.lid);
  res.json({ ok: true });
});

app.get('/api/student/lessons', requireAuth(['student']), (req, res) => {
  res.json(db.all(`
    SELECT l.*,sub.name sub_name,sub.level,sec.name sec_name
    FROM lessons l
    JOIN subsections sub ON sub.id=l.subsection_id
    JOIN sections sec ON sec.id=sub.section_id
    JOIN student_lesson_access sla ON sla.lesson_id=l.id
    WHERE sla.student_id=?
    ORDER BY sec.sort_order,sub.sort_order,l.sort_order`, req.user.id));
});

// Active sessions for a student (their teacher's open sessions)
app.get('/api/student/active-sessions', requireAuth(['student']), (req, res) => {
  const sessions = db.all(`
    SELECT ls.id session_id, ls.lesson_id, ls.teacher_id, ls.started_at,
           l.title lesson_title, u.name teacher_name,
           sub.name sub_name, sec.name sec_name
    FROM lesson_sessions ls
    JOIN lessons l ON l.id = ls.lesson_id
    JOIN subsections sub ON sub.id = l.subsection_id
    JOIN sections sec ON sec.id = sub.section_id
    JOIN users u ON u.id = ls.teacher_id
    JOIN teacher_students ts ON ts.teacher_id = ls.teacher_id AND ts.student_id = ?
    WHERE ls.ended_at IS NULL
    AND ls.student_id = ?
    ORDER BY ls.started_at DESC
  `, req.user.id, req.user.id);
  res.json(sessions);
});

// ── SESSIONS ──────────────────────────────
app.post('/api/sessions', requireAuth(['teacher','student']), (req, res) => {
  const { lesson_id, student_id } = req.body;
  const id = uuidv4();
  const firstPage = db.get('SELECT id FROM lesson_pages WHERE lesson_id=? ORDER BY sort_order LIMIT 1', lesson_id);
  db.prepare('INSERT INTO lesson_sessions (id,lesson_id,teacher_id,student_id,current_page_id) VALUES (?,?,?,?,?)')
    .run(id, lesson_id, req.user.id, student_id||null, firstPage?.id||null);
  res.json({ session_id: id });
});

app.get('/api/sessions/:id', requireAuth(), (req, res) => {
  const session = db.get('SELECT * FROM lesson_sessions WHERE id=?', req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  session.audio_state = JSON.parse(session.audio_state||'{}');
  res.json(session);
});

app.get('/api/sessions/:sid/responses', requireAuth(), (req, res) => {
  const rows = db.all('SELECT * FROM exercise_responses WHERE session_id=?', req.params.sid);
  const map = {};
  for (const r of rows) map[r.exercise_id] = JSON.parse(r.response);
  res.json(map);
});

// ── WEBSOCKET ─────────────────────────────
io.use((socket, next) => {
  const token = socket.handshake.auth.token ||
    socket.handshake.headers.cookie?.split('token=')[1]?.split(';')[0];
  const user = verify(token);
  if (!user) return next(new Error('Unauthorized'));
  socket.user = user;
  next();
});

io.on('connection', (socket) => {
  const { id: userId, role, name } = socket.user;

  socket.on('join_session', ({ session_id }) => {
    const session = db.get('SELECT * FROM lesson_sessions WHERE id=?', session_id);
    if (!session) return socket.emit('error', 'Session not found');
    socket.join(session_id);
    socket.session_id = session_id;

    const pages = db.all('SELECT * FROM lesson_pages WHERE lesson_id=? ORDER BY sort_order', session.lesson_id);
    const responses = {};
    db.all('SELECT * FROM exercise_responses WHERE session_id=?', session_id)
      .forEach(r => { responses[r.exercise_id] = JSON.parse(r.response); });

    const audioState = JSON.parse(session.audio_state || '{}');

    socket.emit('session_state', {
      session,
      pages,
      audio_state: audioState,
      responses,
      current_page_id: session.current_page_id,
      notes: session.notes || ''
    });
    io.to(session_id).emit('user_joined', { role, name, userId });
  });

  socket.on('change_page', ({ session_id, page_id }) => {
    if (socket.user.role !== 'teacher') return;
    db.prepare('UPDATE lesson_sessions SET current_page_id=? WHERE id=?').run(page_id, session_id);
    io.to(session_id).emit('page_changed', { page_id });
  });

  socket.on('audio_sync', ({ session_id, state }) => {
    if (socket.user.role !== 'teacher') return;
    db.prepare('UPDATE lesson_sessions SET audio_state=? WHERE id=?').run(JSON.stringify(state), session_id);
    socket.to(session_id).emit('audio_sync', state);
  });

  socket.on('exercise_response', ({ session_id, exercise_id, response }) => {
    try {
      db.prepare(`INSERT OR REPLACE INTO exercise_responses (session_id,exercise_id,student_id,response,updated_at) VALUES (?,?,?,?,datetime('now'))`)
        .run(session_id, exercise_id, userId, JSON.stringify(response));
    } catch(e) {}
    socket.to(session_id).emit('exercise_response', { exercise_id, response, by: { userId, name, role } });
  });

  socket.on('notes_sync', ({ session_id, notes }) => {
    // Save to dedicated notes column
    try {
      db.prepare('UPDATE lesson_sessions SET notes=? WHERE id=?').run(notes, session_id);
    } catch(e) {}
    // Broadcast to everyone ELSE in the room
    socket.to(session_id).emit('notes_sync', { notes, by: role });
  });

  socket.on('reveal_content', ({ session_id, exercise_id, revealed }) => {
    if (socket.user.role !== 'teacher') return;
    socket.to(session_id).emit('reveal_content', { exercise_id, revealed });
  });

  socket.on('typing', ({ session_id, exercise_id, text }) => {
    socket.to(session_id).emit('typing', { exercise_id, text, by: name });
  });

  socket.on('end_session', ({ session_id }) => {
    if (socket.user.role !== 'teacher') return;
    db.prepare(`UPDATE lesson_sessions SET ended_at=datetime('now') WHERE id=?`).run(session_id);
    io.to(session_id).emit('session_ended');
  });

  // ── WebRTC signaling relay ─────────────
  socket.on('webrtc_offer',         ({ session_id, sdp })       => socket.to(session_id).emit('webrtc_offer',         { sdp }));
  socket.on('webrtc_answer',        ({ session_id, sdp })       => socket.to(session_id).emit('webrtc_answer',        { sdp }));
  socket.on('webrtc_ice',           ({ session_id, candidate }) => socket.to(session_id).emit('webrtc_ice',           { candidate }));
  socket.on('webrtc_ready',         ({ session_id })            => socket.to(session_id).emit('webrtc_ready'));
  socket.on('webrtc_teacher_ready', ({ session_id })            => socket.to(session_id).emit('webrtc_teacher_ready'));

  socket.on('disconnect', () => {
    if (socket.session_id) io.to(socket.session_id).emit('user_left', { role, name });
  });
});

// ── SPA CATCH-ALL ─────────────────────────
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ── START ─────────────────────────────────
const PORT = process.env.PORT || 3000;

initDB().then(database => {
  db = database;
  server.listen(PORT, () => {
    console.log(`✅ englishschool.pro running on port ${PORT}`);
    console.log(`   Admin:   admin@englishschool.pro / admin123`);
    console.log(`   Teacher: teacher@englishschool.pro / teacher123`);
    console.log(`   Student: student@englishschool.pro / student123`);
  });
}).catch(err => {
  console.error('Failed to init DB:', err);
  process.exit(1);
});
