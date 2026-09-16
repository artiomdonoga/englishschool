/* ═══════════════════════════════════════════
   englishschool.pro — SPA
═══════════════════════════════════════════ */

// ─── STATE ───────────────────────────────
const S = {
  user: null,
  token: localStorage.getItem('token') || '',
  view: '',
  lesson: { session_id: null, socket: null, pages: [], currentPageId: null, exercises: {}, responses: {}, notes: '', audioState: {} },
  admin: { sectionId: null, subsectionId: null, lessonId: null, pageId: null },
};

// ─── API HELPER ──────────────────────────
async function api(method, url, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + S.token } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (res.status === 401) { logout(); return null; }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
const GET = (u) => api('GET', u);
const POST = (u, b) => api('POST', u, b);
const PUT = (u, b) => api('PUT', u, b);
const DEL = (u) => api('DELETE', u);

// ─── TOAST ───────────────────────────────
function toast(msg, type = 'info', duration = 3000) {
  let c = document.getElementById('toast-container');
  if (!c) { c = document.createElement('div'); c.id = 'toast-container'; document.body.appendChild(c); }
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.style.animation = 'fadeOutToast .2s ease forwards'; setTimeout(() => t.remove(), 220); }, duration);
}

// ─── ICONS (inline SVG helpers) ──────────
const icon = (name, size = 16) => {
  const paths = {
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>',
    home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    chevron: '<polyline points="9 18 15 12 9 6"/>',
    mic: '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>',
    cam: '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>',
    play: '<polygon points="5 3 19 12 5 21 5 3"/>',
    pause: '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    'eye-off': '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    check: '<polyline points="20 6 9 12 4 10"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[name]||''}</svg>`;
};

// ─── MODAL HELPER ────────────────────────
function modal(title, bodyHtml, onConfirm, confirmLabel = 'Save', confirmClass = 'btn-primary') {
  const bd = document.createElement('div');
  bd.className = 'modal-backdrop';
  bd.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">${title}</div>
        <button class="btn btn-ghost btn-icon" id="modal-close">${icon('plus', 18)}</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
        <button class="btn ${confirmClass}" id="modal-confirm">${confirmLabel}</button>
      </div>
    </div>`;
  document.body.appendChild(bd);
  const close = () => bd.remove();
  bd.querySelector('#modal-close').onclick = close;
  bd.querySelector('#modal-cancel').onclick = close;
  bd.querySelector('#modal-confirm').onclick = async () => {
    try { await onConfirm(bd); close(); }
    catch(e) { toast(e.message, 'error'); }
  };
  bd.onclick = (e) => { if (e.target === bd) close(); };
  // rotate the X icon
  bd.querySelector('#modal-close').style.transform = 'rotate(45deg)';
  return bd;
}

// ─── ROUTER ──────────────────────────────
function navigate(view, params) {
  S.view = view;
  if (params !== undefined) S.params = params; // only overwrite if explicitly passed
  render();
}

async function render() {
  const app = document.getElementById('app');
  if (!S.user) {
    app.innerHTML = renderLogin();
    bindLogin();
    return;
  }
  if (S.view === 'lesson') {
    if (!S.params?.session_id) {
      const defaultView = S.user.role === 'admin' ? 'admin-curriculum'
        : S.user.role === 'teacher' ? 'teacher-students' : 'student-lessons';
      S.view = defaultView;
      render();
      return;
    }
    app.innerHTML = renderLessonShell();
    await initLesson();
    return;
  }
  app.innerHTML = renderShell();
  document.getElementById('toast-container') || (() => {
    const c = document.createElement('div'); c.id='toast-container'; document.body.appendChild(c);
  })();
  switch (S.view) {
    case 'dashboard': await renderDashboard(); break;
    case 'admin-users': await renderAdminUsers(); break;
    case 'admin-links': await renderAdminLinks(); break;
    case 'admin-curriculum': await renderAdminCurriculum(); break;
    case 'teacher-students': await renderTeacherStudents(); break;
    case 'teacher-curriculum': await renderTeacherCurriculum(); break;
    case 'student-lessons': await renderStudentLessons(); break;
    default: await renderDashboard();
  }
}

// ─── INIT ────────────────────────────────
(async () => {
  if (S.token) {
    try {
      S.user = await GET('/api/me');
    } catch { S.token = ''; localStorage.removeItem('token'); }
  }
  const defaultView = S.user?.role === 'admin' ? 'admin-curriculum'
    : S.user?.role === 'teacher' ? 'teacher-students'
    : 'student-lessons';
  S.view = defaultView;
  render();
})();

// ─── LOGIN ───────────────────────────────
function renderLogin() {
  return `
  <div class="login-page">
    <div class="login-box">
      <div class="login-logo">english<span>school</span>.pro</div>
      <div class="login-sub">Sign in to your account</div>
      <div id="login-err" class="login-error hidden"></div>
      <div class="form-row">
        <label class="label">Email</label>
        <input class="input" id="login-email" type="email" placeholder="your@email.com" value="teacher@englishschool.pro">
      </div>
      <div class="form-row">
        <label class="label">Password</label>
        <input class="input" id="login-pw" type="password" placeholder="••••••••" value="teacher123">
      </div>
      <button class="btn btn-primary w-full" id="login-btn" style="justify-content:center;margin-top:4px;">Sign In</button>
      <div style="margin-top:18px;background:var(--bg2);border-radius:var(--r);padding:10px 12px;font-size:12px;color:var(--text3);line-height:1.7;">
        <strong>Demo accounts:</strong><br>
        admin@englishschool.pro / admin123<br>
        teacher@englishschool.pro / teacher123<br>
        student@englishschool.pro / student123
      </div>
    </div>
  </div>`;
}

function bindLogin() {
  const go = async () => {
    const email = document.getElementById('login-email').value;
    const pw = document.getElementById('login-pw').value;
    const err = document.getElementById('login-err');
    err.classList.add('hidden');
    try {
      const data = await POST('/api/login', { email, password: pw });
      if (!data) return;
      S.token = data.token; S.user = data.user;
      localStorage.setItem('token', data.token);
      const defaultView = S.user.role === 'admin' ? 'admin-curriculum'
        : S.user.role === 'teacher' ? 'teacher-students' : 'student-lessons';
      navigate(defaultView);
    } catch(e) { err.textContent = e.message; err.classList.remove('hidden'); }
  };
  document.getElementById('login-btn').onclick = go;
  document.getElementById('login-pw').onkeydown = e => { if(e.key==='Enter') go(); };
}

function logout() {
  S.user = null; S.token = '';
  localStorage.removeItem('token');
  fetch('/api/logout', { method: 'POST' });
  navigate('login');
}

// ─── SHELL ───────────────────────────────
function renderShell() {
  const r = S.user.role;
  const navItems = r === 'admin' ? [
    { id: 'admin-curriculum', label: 'Curriculum', ico: 'book' },
    { id: 'admin-users', label: 'Users', ico: 'users' },
    { id: 'admin-links', label: 'Teacher ↔ Student', ico: 'link' },
  ] : r === 'teacher' ? [
    { id: 'teacher-students', label: 'My Students', ico: 'users' },
    { id: 'teacher-curriculum', label: 'Lesson Library', ico: 'book' },
  ] : [
    { id: 'student-lessons', label: 'My Lessons', ico: 'book' },
  ];

  const sidebarItems = navItems.map(n => `
    <div class="sidebar-item ${S.view===n.id?'active':''}" data-nav="${n.id}">
      ${icon(n.ico, 16)} ${n.label}
    </div>`).join('');

  const avatarLetter = S.user.name[0].toUpperCase();
  const color = S.user.avatar_color || '#2563eb';

  return `
  <div class="app-shell">
    <div class="topbar">
      <div class="topbar-logo">english<span>school</span>.pro</div>
      <div class="topbar-sep"></div>
      <span class="badge badge-${r==='admin'?'purple':r==='teacher'?'blue':'green'}">${r}</span>
      <div class="ml-auto flex items-center gap-2">
        <div class="avatar" style="background:${color};font-size:13px;">${avatarLetter}</div>
        <span style="font-size:13px;font-weight:500;">${S.user.name}</span>
        <button class="btn btn-ghost btn-sm" id="logout-btn">${icon('logout',14)} Sign out</button>
      </div>
    </div>
    <div class="with-sidebar">
      <div class="sidebar">
        ${sidebarItems}
        <div class="sidebar-bottom"></div>
      </div>
      <div class="main-content">
        <div id="main-body" class="page-body"></div>
      </div>
    </div>
  </div>
  <div id="toast-container"></div>`;
}

document.addEventListener('click', e => {
  const n = e.target.closest('[data-nav]');
  if (n) navigate(n.dataset.nav);
  if (e.target.closest('#logout-btn')) logout();
});

// ─── DASHBOARD ───────────────────────────
async function renderDashboard() {
  const el = document.getElementById('main-body');
  el.innerHTML = `<div class="page-header"><h1>Dashboard</h1><p>Welcome back, ${S.user.name}</p></div><p class="text-muted">Use the sidebar to navigate.</p>`;
}

// ══════════════════════════════════════════
// ADMIN VIEWS
// ══════════════════════════════════════════

// ─── ADMIN USERS ─────────────────────────
async function renderAdminUsers() {
  const users = await GET('/api/admin/users');
  const el = document.getElementById('main-body');
  el.innerHTML = `
    <div class="page-header flex items-center justify-between">
      <div><h1>Users</h1><p>Manage teacher and student accounts</p></div>
      <button class="btn btn-primary" id="add-user-btn">${icon('plus',14)} Add User</button>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Created</th><th></th></tr></thead>
          <tbody>
            ${users.map(u => `
              <tr>
                <td><div class="flex items-center gap-2"><div class="avatar avatar-sm" style="background:${u.avatar_color||'#2563eb'}">${u.name[0]}</div>${u.name}</div></td>
                <td>${u.email}</td>
                <td><span class="badge badge-${u.role==='admin'?'purple':u.role==='teacher'?'blue':'green'}">${u.role}</span></td>
                <td class="text-sm text-muted">${u.created_at?.split('T')[0]||''}</td>
                <td>
                  <button class="btn btn-ghost btn-xs" onclick="editUser(${u.id},'${escHtml(u.name)}','${u.email}','${u.avatar_color||'#2563eb'}')">${icon('edit',13)}</button>
                  ${u.id !== S.user.id ? `<button class="btn btn-ghost btn-xs" onclick="deleteUser(${u.id})">${icon('trash',13)}</button>` : ''}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  document.getElementById('add-user-btn').onclick = () => addUserModal();
}

window.addUserModal = () => modal('Add User', `
  <div class="form-row-2">
    <div><label class="label">Name</label><input class="input" id="m-name" placeholder="Full name"></div>
    <div><label class="label">Email</label><input class="input" id="m-email" type="email" placeholder="email@..."></div>
  </div>
  <div class="form-row-2">
    <div><label class="label">Password</label><input class="input" id="m-pw" type="password" placeholder="min 6 chars"></div>
    <div><label class="label">Role</label>
      <select class="select" id="m-role">
        <option value="teacher">Teacher</option>
        <option value="student">Student</option>
        <option value="admin">Admin</option>
      </select>
    </div>
  </div>
  <div class="form-row"><label class="label">Avatar Color</label><input type="color" id="m-color" value="#2563eb" style="height:36px;width:100%;border-radius:6px;border:1.5px solid var(--border);cursor:pointer;padding:2px;"></div>
`, async (bd) => {
  const name = bd.querySelector('#m-name').value.trim();
  const email = bd.querySelector('#m-email').value.trim();
  const pw = bd.querySelector('#m-pw').value;
  const role = bd.querySelector('#m-role').value;
  const color = bd.querySelector('#m-color').value;
  if (!name||!email||!pw) throw new Error('All fields required');
  await POST('/api/admin/users', { name, email, password: pw, role, avatar_color: color });
  toast('User created', 'success');
  renderAdminUsers();
});

window.editUser = (id, name, email, color) => modal('Edit User', `
  <div class="form-row"><label class="label">Name</label><input class="input" id="m-name" value="${escHtml(name)}"></div>
  <div class="form-row"><label class="label">Email</label><input class="input" id="m-email" type="email" value="${escHtml(email)}"></div>
  <div class="form-row"><label class="label">New Password <span class="text-muted">(leave blank to keep)</span></label><input class="input" id="m-pw" type="password"></div>
  <div class="form-row"><label class="label">Avatar Color</label><input type="color" id="m-color" value="${color}" style="height:36px;width:100%;border-radius:6px;border:1.5px solid var(--border);cursor:pointer;padding:2px;"></div>
`, async (bd) => {
  const data = { name: bd.querySelector('#m-name').value.trim(), email: bd.querySelector('#m-email').value.trim(), avatar_color: bd.querySelector('#m-color').value };
  const pw = bd.querySelector('#m-pw').value;
  if (pw) data.password = pw;
  await PUT(`/api/admin/users/${id}`, data);
  toast('User updated', 'success');
  renderAdminUsers();
});

window.deleteUser = (id) => {
  if (!confirm('Delete this user?')) return;
  DEL(`/api/admin/users/${id}`).then(() => { toast('User deleted', 'success'); renderAdminUsers(); });
};

// ─── ADMIN LINKS ─────────────────────────
async function renderAdminLinks() {
  const [links, users] = await Promise.all([GET('/api/admin/links'), GET('/api/admin/users')]);
  const teachers = users.filter(u => u.role === 'teacher');
  const students = users.filter(u => u.role === 'student');
  const el = document.getElementById('main-body');
  el.innerHTML = `
    <div class="page-header flex items-center justify-between">
      <div><h1>Teacher ↔ Student Links</h1><p>Assign students to teachers</p></div>
      <button class="btn btn-primary" id="add-link-btn">${icon('plus',14)} Add Link</button>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Teacher</th><th>Student</th><th></th></tr></thead>
          <tbody>
            ${links.map(l => `
              <tr>
                <td><div class="flex items-center gap-2">${icon('users',14)} ${escHtml(l.teacher_name)}</div></td>
                <td>${escHtml(l.student_name)}</td>
                <td><button class="btn btn-ghost btn-xs" onclick="deleteLink(${l.teacher_id},${l.student_id})">${icon('trash',13)}</button></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  document.getElementById('add-link-btn').onclick = () => modal('Add Teacher ↔ Student Link', `
    <div class="form-row"><label class="label">Teacher</label>
      <select class="select" id="m-tid">${teachers.map(t=>`<option value="${t.id}">${escHtml(t.name)}</option>`).join('')}</select>
    </div>
    <div class="form-row"><label class="label">Student</label>
      <select class="select" id="m-sid">${students.map(s=>`<option value="${s.id}">${escHtml(s.name)}</option>`).join('')}</select>
    </div>
  `, async (bd) => {
    await POST('/api/admin/links', { teacher_id: +bd.querySelector('#m-tid').value, student_id: +bd.querySelector('#m-sid').value });
    toast('Link created', 'success'); renderAdminLinks();
  });
}

window.deleteLink = (tid, sid) => {
  if (!confirm('Remove this link?')) return;
  DEL(`/api/admin/links/${tid}/${sid}`).then(() => { toast('Link removed', 'success'); renderAdminLinks(); });
};

// ─── ADMIN CURRICULUM ────────────────────
// State for the 3-column panel
const CUR = { sectionId: null, subsectionId: null, lessonId: null, pageId: null };

async function renderAdminCurriculum() {
  const el = document.getElementById('main-body');
  el.innerHTML = `
    <div class="page-header">
      <h1>Curriculum Editor</h1>
      <p>Categories → Levels → Lessons → Pages → Exercises</p>
    </div>
    <div id="cur-layout" style="display:grid;grid-template-columns:220px 220px 1fr;gap:16px;align-items:start;">
      <div id="cur-col-sections"></div>
      <div id="cur-col-subsections" style="opacity:.4;pointer-events:none;"></div>
      <div id="cur-col-lessons" style="opacity:.4;pointer-events:none;"></div>
    </div>
    <div id="cur-lesson-editor" style="margin-top:16px;"></div>`;
  await curLoadSections();
}

// ── Column 1: Categories (Sections) ──────
async function curLoadSections() {
  const sections = await GET('/api/sections');
  const col = document.getElementById('cur-col-sections');
  col.innerHTML = `
    <div class="card" style="overflow:hidden;">
      <div class="card-header" style="padding:12px 14px;">
        <div class="card-title" style="font-size:13px;">📚 Categories</div>
        <button class="btn btn-primary btn-xs" onclick="curAddSection()">+ Add</button>
      </div>
      <div style="padding:6px;">
        ${sections.length === 0 ? `<p class="text-muted text-sm" style="padding:10px;">No categories yet.<br>Click + Add to create one.</p>` : ''}
        ${sections.map(s => `
          <div class="cur-item ${CUR.sectionId===s.id?'cur-item-active':''}" onclick="curSelectSection(${s.id},'${escHtml(s.name)}')">
            <span style="flex:1;font-weight:${CUR.sectionId===s.id?'600':'400'};">${escHtml(s.name)}</span>
            <div class="cur-item-btns">
              <button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();curEditSection(${s.id},'${escHtml(s.name)}')" title="Rename">✏️</button>
              <button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();curDeleteSection(${s.id})" title="Delete">🗑️</button>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
}

window.curSelectSection = async (id, name) => {
  CUR.sectionId = id; CUR.subsectionId = null; CUR.lessonId = null; CUR.pageId = null;
  // Highlight
  document.querySelectorAll('.cur-item').forEach(e => e.classList.remove('cur-item-active'));
  event.currentTarget?.classList.add('cur-item-active');
  // Unlock col 2, reset col 3
  const col2 = document.getElementById('cur-col-subsections');
  const col3 = document.getElementById('cur-col-lessons');
  col2.style.opacity = '1'; col2.style.pointerEvents = 'auto';
  col3.style.opacity = '.4'; col3.style.pointerEvents = 'none';
  document.getElementById('cur-lesson-editor').innerHTML = '';
  await curLoadSubsections(id, name);
};

window.curAddSection = () => modal('Add Category', `
  <div class="form-row"><label class="label">Category name</label>
  <input class="input" id="m-name" placeholder="e.g. General English, Business English, IT…"></div>
`, async (bd) => {
  const name = bd.querySelector('#m-name').value.trim();
  if (!name) throw new Error('Name required');
  await POST('/api/sections', { name });
  toast('Category added', 'success');
  await curLoadSections();
});

window.curEditSection = (id, name) => modal('Rename Category', `
  <div class="form-row"><label class="label">Category name</label>
  <input class="input" id="m-name" value="${escHtml(name)}"></div>
`, async (bd) => {
  await PUT(`/api/sections/${id}`, { name: bd.querySelector('#m-name').value.trim() });
  toast('Updated', 'success');
  if (CUR.sectionId === id) CUR.sectionId = null;
  await renderAdminCurriculum();
});

window.curDeleteSection = (id) => {
  if (!confirm('Delete this category and ALL its content?')) return;
  DEL(`/api/sections/${id}`).then(async () => {
    toast('Deleted', 'success');
    if (CUR.sectionId === id) { CUR.sectionId = null; CUR.subsectionId = null; CUR.lessonId = null; }
    await renderAdminCurriculum();
  });
};

// ── Column 2: Levels (Subsections) ───────
async function curLoadSubsections(sectionId, sectionName) {
  const subs = await GET(`/api/sections/${sectionId}/subsections`);
  const col = document.getElementById('cur-col-subsections');
  col.innerHTML = `
    <div class="card" style="overflow:hidden;">
      <div class="card-header" style="padding:12px 14px;">
        <div class="card-title" style="font-size:13px;">🎓 Levels <span style="color:var(--accent);font-weight:400;font-size:11px;">${escHtml(sectionName)}</span></div>
        <button class="btn btn-primary btn-xs" onclick="curAddSubsection(${sectionId})">+ Add</button>
      </div>
      <div style="padding:6px;">
        ${subs.length === 0 ? `<p class="text-muted text-sm" style="padding:10px;">No levels yet.<br>Click + Add to create one.</p>` : ''}
        ${subs.map(sub => `
          <div class="cur-item ${CUR.subsectionId===sub.id?'cur-item-active':''}" onclick="curSelectSubsection(${sub.id},'${escHtml(sub.name)}')">
            <div style="flex:1;">
              <div style="font-weight:${CUR.subsectionId===sub.id?'600':'400'};font-size:13px;">${escHtml(sub.name)}</div>
              <div style="font-size:11px;color:var(--text4);">${escHtml(sub.level)}</div>
            </div>
            <div class="cur-item-btns">
              <button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();curEditSubsection(${sub.id},'${escHtml(sub.name)}','${escHtml(sub.level)}')" title="Edit">✏️</button>
              <button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();curDeleteSubsection(${sub.id})" title="Delete">🗑️</button>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
}

window.curSelectSubsection = async (id, name) => {
  CUR.subsectionId = id; CUR.lessonId = null; CUR.pageId = null;
  const col3 = document.getElementById('cur-col-lessons');
  col3.style.opacity = '1'; col3.style.pointerEvents = 'auto';
  document.getElementById('cur-lesson-editor').innerHTML = '';
  await curLoadLessons(id, name);
};

window.curAddSubsection = (sectionId) => modal('Add Level', `
  <div class="form-row"><label class="label">Level name</label>
    <input class="input" id="m-name" placeholder="e.g. Beginner, Upper Intermediate…"></div>
  <div class="form-row"><label class="label">Level label</label>
    <select class="select" id="m-level">
      <option>Beginner</option><option>Elementary</option><option>Pre-Intermediate</option>
      <option>Intermediate</option><option>Upper Intermediate</option><option>Advanced</option><option>Mixed</option>
    </select>
  </div>
`, async (bd) => {
  const name = bd.querySelector('#m-name').value.trim() || bd.querySelector('#m-level').value;
  await POST('/api/subsections', { section_id: sectionId, name, level: bd.querySelector('#m-level').value });
  toast('Level added', 'success');
  await curLoadSubsections(sectionId, '');
  document.querySelector(`[onclick="curSelectSection(${sectionId},'')"]`)?.click();
  // Reload col 2 properly
  const subs = await GET(`/api/sections/${sectionId}/subsections`);
  const col = document.getElementById('cur-col-subsections');
  col.querySelector('div[style*="padding:6px"]').innerHTML = subs.map(sub => `
    <div class="cur-item ${CUR.subsectionId===sub.id?'cur-item-active':''}" onclick="curSelectSubsection(${sub.id},'${escHtml(sub.name)}')">
      <div style="flex:1;"><div style="font-size:13px;">${escHtml(sub.name)}</div><div style="font-size:11px;color:var(--text4);">${escHtml(sub.level)}</div></div>
      <div class="cur-item-btns">
        <button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();curEditSubsection(${sub.id},'${escHtml(sub.name)}','${escHtml(sub.level)}')" title="Edit">✏️</button>
        <button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();curDeleteSubsection(${sub.id})" title="Delete">🗑️</button>
      </div>
    </div>`).join('');
});

window.curEditSubsection = (id, name, level) => modal('Edit Level', `
  <div class="form-row"><label class="label">Name</label><input class="input" id="m-name" value="${escHtml(name)}"></div>
  <div class="form-row"><label class="label">Level label</label>
    <select class="select" id="m-level">
      ${['Beginner','Elementary','Pre-Intermediate','Intermediate','Upper Intermediate','Advanced','Mixed'].map(l=>`<option ${l===level?'selected':''}>${l}</option>`).join('')}
    </select>
  </div>
`, async (bd) => {
  await PUT(`/api/subsections/${id}`, { name: bd.querySelector('#m-name').value.trim(), level: bd.querySelector('#m-level').value });
  toast('Updated', 'success');
  await curLoadSubsections(CUR.sectionId, '');
});

window.curDeleteSubsection = (id) => {
  if (!confirm('Delete this level and all its lessons?')) return;
  DEL(`/api/subsections/${id}`).then(async () => {
    toast('Deleted', 'success');
    if (CUR.subsectionId === id) { CUR.subsectionId = null; CUR.lessonId = null; }
    await curLoadSubsections(CUR.sectionId, '');
    document.getElementById('cur-col-lessons').innerHTML = '';
    document.getElementById('cur-lesson-editor').innerHTML = '';
  });
};

// ── Column 3: Lessons ─────────────────────
async function curLoadLessons(subsectionId, levelName) {
  const lessons = await GET(`/api/subsections/${subsectionId}/lessons`);
  const col = document.getElementById('cur-col-lessons');
  col.innerHTML = `
    <div class="card" style="overflow:hidden;">
      <div class="card-header" style="padding:12px 14px;">
        <div class="card-title" style="font-size:13px;">📖 Lessons <span style="color:var(--accent);font-weight:400;font-size:11px;">${escHtml(levelName)}</span></div>
        <button class="btn btn-primary btn-xs" onclick="curAddLesson(${subsectionId})">+ Add</button>
      </div>
      <div style="padding:6px;">
        ${lessons.length === 0 ? `<p class="text-muted text-sm" style="padding:10px;">No lessons yet.<br>Click + Add to create one.</p>` : ''}
        ${lessons.map(l => `
          <div class="cur-item ${CUR.lessonId===l.id?'cur-item-active':''}" onclick="curSelectLesson(${l.id},'${escHtml(l.title)}')">
            <div style="flex:1;">
              <div style="font-size:13px;font-weight:${CUR.lessonId===l.id?'600':'400'};">${escHtml(l.title)}</div>
              ${l.description?`<div style="font-size:11px;color:var(--text4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px;">${escHtml(l.description)}</div>`:''}
            </div>
            <div class="cur-item-btns">
              <button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();curEditLesson(${l.id},'${escHtml(l.title)}','${escHtml(l.description||'')}')" title="Edit">✏️</button>
              <button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();curDeleteLesson(${l.id})" title="Delete">🗑️</button>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
}

window.curSelectLesson = async (id, title) => {
  CUR.lessonId = id;
  // Highlight
  document.querySelectorAll('#cur-col-lessons .cur-item').forEach(e => e.classList.remove('cur-item-active'));
  event.currentTarget?.classList.add('cur-item-active');
  await curLoadLessonEditor(id, title);
};

window.curAddLesson = (subsectionId) => modal('Add Lesson', `
  <div class="form-row"><label class="label">Lesson title</label>
    <input class="input" id="m-title" placeholder="e.g. Sports & Language, Business Emails…"></div>
  <div class="form-row"><label class="label">Description <span class="text-muted">(optional)</span></label>
    <textarea class="textarea" id="m-desc" rows="2" placeholder="Brief description shown to students"></textarea></div>
`, async (bd) => {
  const title = bd.querySelector('#m-title').value.trim();
  if (!title) throw new Error('Title required');
  await POST('/api/lessons', { subsection_id: subsectionId, title, description: bd.querySelector('#m-desc').value });
  toast('Lesson added', 'success');
  await curLoadLessons(subsectionId, '');
});

window.curEditLesson = (id, title, desc) => modal('Edit Lesson', `
  <div class="form-row"><label class="label">Title</label><input class="input" id="m-title" value="${escHtml(title)}"></div>
  <div class="form-row"><label class="label">Description</label><textarea class="textarea" id="m-desc" rows="2">${escHtml(desc)}</textarea></div>
`, async (bd) => {
  await PUT(`/api/lessons/${id}`, { title: bd.querySelector('#m-title').value.trim(), description: bd.querySelector('#m-desc').value });
  toast('Updated', 'success');
  await curLoadLessons(CUR.subsectionId, '');
});

window.curDeleteLesson = (id) => {
  if (!confirm('Delete this lesson and all its pages and exercises?')) return;
  DEL(`/api/lessons/${id}`).then(async () => {
    toast('Deleted', 'success');
    if (CUR.lessonId === id) { CUR.lessonId = null; document.getElementById('cur-lesson-editor').innerHTML = ''; }
    await curLoadLessons(CUR.subsectionId, '');
  });
};

// ── Lesson Editor (Pages + Exercises) ────
async function curLoadLessonEditor(lessonId, title) {
  const pages = await GET(`/api/lessons/${lessonId}/pages`);
  const el = document.getElementById('cur-lesson-editor');
  el.innerHTML = `
    <div class="card" style="overflow:hidden;">
      <div class="card-header">
        <div class="card-title">📄 Pages — <span style="color:var(--accent);">${escHtml(title)}</span></div>
        <button class="btn btn-primary btn-sm" onclick="curAddPage(${lessonId})">${icon('plus',13)} Add Page</button>
      </div>
      <div style="padding:14px;">
        ${pages.length === 0 ? `<p class="text-muted text-sm">No pages yet. Click "Add Page" to start building this lesson.</p>` : ''}
        <div style="display:flex;flex-direction:column;gap:10px;" id="cur-pages-list">
          ${pages.map((p, i) => `
            <div class="exercise-editor-item" id="cur-page-${p.id}">
              <div class="exercise-editor-header">
                <div class="flex items-center gap-2">
                  <span style="background:var(--accent);color:#fff;width:22px;height:22px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">${i+1}</span>
                  <span style="font-weight:600;">${escHtml(p.title)}</span>
                </div>
                <div class="flex gap-2">
                  <button class="btn btn-primary btn-xs" onclick="curOpenExercises(${p.id},'${escHtml(p.title)}')">Edit Exercises</button>
                  <button class="btn btn-ghost btn-xs" onclick="curEditPage(${p.id},'${escHtml(p.title)}',${lessonId},'${escHtml(title)}')" title="Rename">✏️</button>
                  <button class="btn btn-ghost btn-xs" onclick="curDeletePage(${p.id},${lessonId},'${escHtml(title)}')" title="Delete">🗑️</button>
                </div>
              </div>
              <div id="cur-exercises-${p.id}" style="display:none;padding:12px;border-top:1px solid var(--border);"></div>
            </div>`).join('')}
        </div>
      </div>
    </div>`;
}

window.curAddPage = (lessonId) => modal('Add Page', `
  <div class="form-row"><label class="label">Page title</label>
    <input class="input" id="m-title" placeholder="e.g. Warm Up, Listening, Grammar Practice…"></div>
`, async (bd) => {
  const title = bd.querySelector('#m-title').value.trim();
  if (!title) throw new Error('Title required');
  const pages = await GET(`/api/lessons/${lessonId}/pages`);
  await POST('/api/lesson_pages', { lesson_id: lessonId, title, sort_order: pages.length });
  toast('Page added', 'success');
  await curLoadLessonEditor(lessonId, '');
});

window.curEditPage = (pageId, title, lessonId, lessonTitle) => modal('Rename Page', `
  <div class="form-row"><label class="label">Page title</label><input class="input" id="m-title" value="${escHtml(title)}"></div>
`, async (bd) => {
  await PUT(`/api/lesson_pages/${pageId}`, { title: bd.querySelector('#m-title').value.trim() });
  toast('Updated', 'success');
  await curLoadLessonEditor(lessonId, lessonTitle);
});

window.curDeletePage = async (pageId, lessonId, lessonTitle) => {
  if (!confirm('Delete this page and all its exercises?')) return;
  await DEL(`/api/lesson_pages/${pageId}`);
  toast('Page deleted', 'success');
  await curLoadLessonEditor(lessonId, lessonTitle);
};

window.curOpenExercises = async (pageId, pageTitle) => {
  const panel = document.getElementById(`cur-exercises-${pageId}`);
  if (panel.style.display !== 'none') { panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  CUR.pageId = pageId;
  await curRenderExercises(pageId);
};

async function curRenderExercises(pageId) {
  const panel = document.getElementById(`cur-exercises-${pageId}`);
  const exercises = await GET(`/api/pages/${pageId}/exercises`);
  const typeLabels = {
    text:'📝 Text', teacher_note:'👁 Teacher Note', audio:'🎧 Audio',
    dropdown:'📋 Dropdown', fill_blank_type:'✍️ Fill Blank (type)',
    fill_blank_hint:'💡 Fill Blank (hint)', image_match:'🖼️ Image Match',
    matching:'🔗 Matching', multiple_choice:'☑️ Multiple Choice'
  };
  panel.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px;">
      ${exercises.length === 0 ? `<p class="text-muted text-sm">No exercises yet.</p>` : ''}
      ${exercises.map((ex,i) => `
        <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg2);border-radius:var(--r);border:1px solid var(--border);">
          <span style="font-size:12px;color:var(--text4);min-width:18px;">${i+1}.</span>
          <span style="flex:1;font-size:13px;">${typeLabels[ex.type]||ex.type}</span>
          <button class="btn btn-ghost btn-xs" onclick="editExercise(${ex.id},${pageId})">✏️ Edit</button>
          <button class="btn btn-ghost btn-xs" onclick="curDeleteExercise(${ex.id},${pageId})">🗑️</button>
        </div>`).join('')}
    </div>
    <button class="btn btn-green btn-sm" onclick="addExercise(${pageId})">${icon('plus',13)} Add Exercise</button>`;
}

window.curDeleteExercise = async (exId, pageId) => {
  if (!confirm('Delete this exercise?')) return;
  await DEL(`/api/exercises/${exId}`);
  toast('Deleted', 'success');
  await curRenderExercises(pageId);
};

// Make addExercise/editExercise refresh the new cur panel after saving
window.loadExerciseEditor = async (pageId, inline) => {
  const panel = document.getElementById(`cur-exercises-${pageId}`);
  if (panel) {
    await curRenderExercises(pageId);
  }
};

async function loadCurriculumTree() {
  const sections = await GET('/api/sections');
  const panel = document.getElementById('curriculum-tree-panel');
  panel.innerHTML = `
    <div class="card" style="overflow:hidden;">
      <div class="card-header">
        <div class="card-title">${icon('book',14)} Sections</div>
        <button class="btn btn-primary btn-sm" onclick="addSection()">${icon('plus',12)} Section</button>
      </div>
      <div style="padding:10px;">
        ${sections.length===0?`<p class="text-muted text-sm" style="padding:8px;">No sections yet.</p>`:''}
        <div id="section-list">
          ${sections.map(s => renderSectionNode(s)).join('')}
        </div>
      </div>
    </div>`;
  // bind toggles
  panel.querySelectorAll('[data-toggle-section]').forEach(el => {
    el.onclick = () => toggleSectionNode(el.dataset.toggleSection);
  });
}

function renderSectionNode(s) {
  return `
    <div class="section-collapse" id="sec-${s.id}">
      <div class="list-item" data-toggle-section="${s.id}">
        <div class="flex items-center gap-2">
          <svg class="tree-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          <strong style="font-size:13px;">${escHtml(s.name)}</strong>
        </div>
        <div class="list-item-actions" onclick="event.stopPropagation()">
          <button class="btn btn-ghost btn-xs" onclick="addSubsection(${s.id})">${icon('plus',12)}</button>
          <button class="btn btn-ghost btn-xs" onclick="editSection(${s.id},'${escHtml(s.name)}')">${icon('edit',12)}</button>
          <button class="btn btn-ghost btn-xs" onclick="deleteSection(${s.id})">${icon('trash',12)}</button>
        </div>
      </div>
      <div id="sec-children-${s.id}" class="hidden" style="padding-left:8px;"></div>
    </div>`;
}

async function toggleSectionNode(sid) {
  const ch = document.getElementById(`sec-children-${sid}`);
  const chev = document.querySelector(`[data-toggle-section="${sid}"] .tree-chevron`);
  if (!ch.classList.contains('hidden')) { ch.classList.add('hidden'); chev.classList.remove('open'); return; }
  ch.classList.remove('hidden'); chev.classList.add('open');
  if (ch.innerHTML.trim()) return; // already loaded
  const subs = await GET(`/api/sections/${sid}/subsections`);
  ch.innerHTML = subs.map(sub => renderSubsectionNode(sub)).join('') +
    `<div style="padding:4px 6px;"><button class="btn btn-ghost btn-xs" onclick="addSubsection(${sid})">${icon('plus',12)} Add subsection</button></div>`;
  ch.querySelectorAll('[data-toggle-sub]').forEach(el => {
    el.onclick = () => toggleSubsectionNode(el.dataset.toggleSub);
  });
}

function renderSubsectionNode(sub) {
  return `
    <div>
      <div class="subsection-item" data-toggle-sub="${sub.id}">
        <div class="flex items-center gap-2">
          <svg class="tree-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          ${escHtml(sub.name)} <span class="badge badge-gray text-xs">${escHtml(sub.level)}</span>
        </div>
        <div class="list-item-actions" onclick="event.stopPropagation()">
          <button class="btn btn-ghost btn-xs" onclick="addLesson(${sub.id})">${icon('plus',12)}</button>
          <button class="btn btn-ghost btn-xs" onclick="editSubsection(${sub.id},'${escHtml(sub.name)}','${escHtml(sub.level)}')">${icon('edit',12)}</button>
          <button class="btn btn-ghost btn-xs" onclick="deleteSubsection(${sub.id})">${icon('trash',12)}</button>
        </div>
      </div>
      <div id="sub-children-${sub.id}" class="hidden" style="padding-left:12px;"></div>
    </div>`;
}

async function toggleSubsectionNode(subid) {
  const ch = document.getElementById(`sub-children-${subid}`);
  const chev = document.querySelector(`[data-toggle-sub="${subid}"] .tree-chevron`);
  if (!ch.classList.contains('hidden')) { ch.classList.add('hidden'); chev.classList.remove('open'); return; }
  ch.classList.remove('hidden'); chev.classList.add('open');
  if (ch.innerHTML.trim()) return;
  const lessons = await GET(`/api/subsections/${subid}/lessons`);
  ch.innerHTML = lessons.map(l => `
    <div class="lesson-item ${S.admin.lessonId===l.id?'active':''}" onclick="selectLesson(${l.id},'${escHtml(l.title)}')">
      <span>${escHtml(l.title)}</span>
      <div class="list-item-actions" onclick="event.stopPropagation()">
        <button class="btn btn-ghost btn-xs" onclick="editLesson(${l.id},'${escHtml(l.title)}','${escHtml(l.description||'')}')">${icon('edit',12)}</button>
        <button class="btn btn-ghost btn-xs" onclick="deleteLesson(${l.id})">${icon('trash',12)}</button>
      </div>
    </div>`).join('') +
    `<div style="padding:4px 6px;"><button class="btn btn-ghost btn-xs" onclick="addLesson(${subid})">${icon('plus',12)} Add lesson</button></div>`;
}

window.selectLesson = async (lessonId, title) => {
  S.admin.lessonId = lessonId;
  document.querySelectorAll('.lesson-item').forEach(e=>e.classList.remove('active'));
  document.querySelector(`[onclick="selectLesson(${lessonId},'${escHtml(title)}'.trim())"]`)?.classList.add('active');
  await loadLessonEditor(lessonId, title);
};

async function loadLessonEditor(lessonId, title) {
  const panel = document.getElementById('curriculum-editor-panel');
  const pages = await GET(`/api/lessons/${lessonId}/pages`);
  panel.innerHTML = `
    <div class="card" style="overflow:hidden;">
      <div class="card-header">
        <div class="card-title">${icon('book',14)} ${escHtml(title)}</div>
        <button class="btn btn-primary btn-sm" onclick="addPage(${lessonId})">${icon('plus',12)} Add Page</button>
      </div>
      <div style="padding:14px;">
        <div id="pages-list">
          ${pages.map((p,i) => `
            <div class="exercise-editor-item" id="page-block-${p.id}">
              <div class="exercise-editor-header" onclick="togglePageBlock(${p.id})">
                <div class="flex items-center gap-2">
                  <svg class="tree-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                  <span>Page ${i+1}: ${escHtml(p.title)}</span>
                </div>
                <div class="flex gap-2" onclick="event.stopPropagation()">
                  <button class="btn btn-primary btn-xs" onclick="loadExerciseEditor(${p.id})">${icon('edit',12)} Edit Exercises</button>
                  <button class="btn btn-ghost btn-xs" onclick="editPage(${p.id},'${escHtml(p.title)}')">${icon('edit',12)}</button>
                  <button class="btn btn-ghost btn-xs" onclick="deletePage(${p.id},${lessonId},'${escHtml(title)}')">${icon('trash',12)}</button>
                </div>
              </div>
              <div id="page-exercises-${p.id}" class="hidden" style="padding:12px;"></div>
            </div>`).join('')}
        </div>
      </div>
    </div>`;
}

window.togglePageBlock = async (pageId) => {
  const block = document.getElementById(`page-exercises-${pageId}`);
  const chev = document.querySelector(`#page-block-${pageId} .tree-chevron`);
  if (!block.classList.contains('hidden')) { block.classList.add('hidden'); chev.classList.remove('open'); return; }
  block.classList.remove('hidden'); chev.classList.add('open');
  await loadExerciseEditor(pageId, true);
};

window.loadExerciseEditor = async (pageId, inline = false) => {
  S.admin.pageId = pageId;
  const exercises = await GET(`/api/pages/${pageId}/exercises`);
  const target = inline
    ? document.getElementById(`page-exercises-${pageId}`)
    : document.getElementById('curriculum-editor-panel');

  const html = `
    <div ${!inline ? 'class="card" style="overflow:hidden;"' : ''}>
      ${!inline ? `<div class="card-header"><div class="card-title">Exercise Editor — Page</div></div>` : ''}
      <div style="padding:${!inline?'14px':'0'};">
        <div id="ex-list-${pageId}">
          ${exercises.map(ex => renderExerciseAdminRow(ex, pageId)).join('')}
        </div>
        <button class="btn btn-green btn-sm" style="margin-top:8px;" onclick="addExercise(${pageId})">${icon('plus',12)} Add Exercise</button>
      </div>
    </div>`;
  target.innerHTML = html;
};

function renderExerciseAdminRow(ex, pageId) {
  const typeLabels = { text:'📝 Text', teacher_note:'👁 Teacher Note', audio:'🎧 Audio', dropdown:'📋 Dropdown', fill_blank_type:'✍️ Fill Blank (type)', fill_blank_hint:'💡 Fill Blank (hint)', image_match:'🖼️ Image Match', matching:'🔗 Matching', multiple_choice:'☑️ Multiple Choice' };
  return `
    <div class="exercise-editor-item" style="margin-bottom:8px;">
      <div class="exercise-editor-header">
        <span>${typeLabels[ex.type]||ex.type}</span>
        <div class="flex gap-2" onclick="event.stopPropagation()">
          <button class="btn btn-ghost btn-xs" onclick="editExercise(${ex.id},${pageId})">${icon('edit',12)}</button>
          <button class="btn btn-ghost btn-xs" onclick="deleteExercise(${ex.id},${pageId})">${icon('trash',12)}</button>
        </div>
      </div>
    </div>`;
}

window.addExercise = (pageId) => {
  const types = [
    { v:'text', ico:'📝', label:'Text / Reading' },
    { v:'teacher_note', ico:'👁', label:'Teacher Note' },
    { v:'audio', ico:'🎧', label:'Audio Player' },
    { v:'dropdown', ico:'📋', label:'Dropdown Fill-in' },
    { v:'fill_blank_type', ico:'✍️', label:'Fill Blank (type)' },
    { v:'fill_blank_hint', ico:'💡', label:'Fill Blank (hint)' },
    { v:'image_match', ico:'🖼️', label:'Image Match' },
    { v:'matching', ico:'🔗', label:'Matching Columns' },
    { v:'multiple_choice', ico:'☑️', label:'Multiple Choice' },
  ];
  let chosen = null;
  const bd = modal('Choose Exercise Type', `
    <div class="type-picker">${types.map(t=>`
      <div class="type-option" data-type="${t.v}" onclick="document.querySelectorAll('.type-option').forEach(e=>e.classList.remove('selected'));this.classList.add('selected');window._chosenType='${t.v}';">
        <span class="type-icon">${t.ico}</span>${t.label}
      </div>`).join('')}
    </div>
  `, async () => {
    const type = window._chosenType;
    if (!type) throw new Error('Choose a type');
    delete window._chosenType;
    openExerciseDataEditor(pageId, null, type, {});
  }, 'Next →');
};

window.editExercise = async (exId, pageId) => {
  const exs = await GET(`/api/pages/${pageId}/exercises`);
  const ex = exs.find(e => e.id === exId);
  if (!ex) return;
  openExerciseDataEditor(pageId, exId, ex.type, ex.data);
};

function openExerciseDataEditor(pageId, exId, type, data) {
  const bodyHtml = renderExerciseForm(type, data);
  modal(`${exId?'Edit':'Add'} Exercise — ${type}`, bodyHtml, async (bd) => {
    const newData = readExerciseForm(bd, type, data);
    if (exId) {
      await PUT(`/api/exercises/${exId}`, { type, data: newData, sort_order: data.sort_order||0 });
    } else {
      const exs = await GET(`/api/pages/${pageId}/exercises`);
      await POST('/api/exercises', { page_id: pageId, type, data: newData, sort_order: exs.length });
    }
    toast('Exercise saved', 'success');
    // Refresh whichever panel is active
    const curPanel = document.getElementById(`cur-exercises-${pageId}`);
    if (curPanel) {
      await curRenderExercises(pageId);
    }
  }, 'Save Exercise');
}

function renderExerciseForm(type, data) {
  if (type === 'text') return `
    <div class="form-row"><label class="label">Heading</label><input class="input" id="ef-heading" value="${escHtml(data.heading||'')}"></div>
    <div class="form-row"><label class="label">Text content</label><textarea class="textarea" id="ef-text" rows="6">${escHtml(data.text||'')}</textarea></div>`;
  if (type === 'teacher_note') return `
    <div class="form-row"><label class="label">Note text (visible only to teacher by default)</label><textarea class="textarea" id="ef-text" rows="4">${escHtml(data.text||'')}</textarea></div>
    <div class="form-row"><label class="label"><input type="checkbox" id="ef-can-show" ${data.can_show?'checked':''}> Teacher can show to student</label></div>`;
  if (type === 'audio') return `
    <div class="form-row"><label class="label">Title</label><input class="input" id="ef-title" value="${escHtml(data.title||'')}"></div>
    <div class="form-row"><label class="label">Duration (seconds)</label><input class="input" id="ef-duration" type="number" value="${data.duration||60}"></div>
    <div class="form-row"><label class="label">Audio URL <span class="text-muted">(leave blank for demo)</span></label><input class="input" id="ef-url" value="${escHtml(data.url||'')}"></div>`;
  if (type === 'multiple_choice') return `
    <div class="form-row"><label class="label">Question</label><input class="input" id="ef-q" value="${escHtml(data.question||'')}"></div>
    <div id="mc-options">
      ${(data.options||['','','']).map((o,i)=>`
        <div class="pair-row">
          <input class="input" placeholder="Option ${i+1}" value="${escHtml(o)}" data-mc-opt="${i}">
          <label style="white-space:nowrap;font-size:12px;"><input type="radio" name="mc-correct" value="${i}" ${data.correct===i?'checked':''}> Correct</label>
        </div>`).join('')}
    </div>
    <button class="btn btn-secondary btn-sm" style="margin-top:6px;" onclick="addMCOption()">+ option</button>`;
  if (type === 'dropdown') return `
    <div id="dropdown-sentences">
      ${(data.sentences||[{before:'',blank:{options:['',''],correct:''},after:''}]).map((s,i)=>`
        <div style="border:1px solid var(--border);border-radius:var(--r);padding:10px;margin-bottom:8px;">
          <div class="form-row-2">
            <div><label class="label">Before blank</label><input class="input" data-ds="${i}-before" value="${escHtml(s.before||'')}"></div>
            <div><label class="label">After blank</label><input class="input" data-ds="${i}-after" value="${escHtml(s.after||'')}"></div>
          </div>
          <div class="form-row"><label class="label">Options (comma-separated)</label><input class="input" data-ds="${i}-options" value="${(s.blank?.options||[]).map(escHtml).join(', ')}"></div>
          <div class="form-row"><label class="label">Correct answer</label><input class="input" data-ds="${i}-correct" value="${escHtml(s.blank?.correct||'')}"></div>
        </div>`).join('')}
    </div>
    <button class="btn btn-secondary btn-sm" onclick="addDropdownSentence()">+ sentence</button>`;
  if (type === 'fill_blank_type') return `
    <div id="fbt-sentences">
      ${(data.sentences||[{before:'',answer:'',after:''}]).map((s,i)=>`
        <div class="pair-row">
          <input class="input" placeholder="Before blank" data-fbt="${i}-before" value="${escHtml(s.before||'')}">
          <input class="input" placeholder="Answer" style="max-width:130px;" data-fbt="${i}-answer" value="${escHtml(s.answer||'')}">
          <input class="input" placeholder="After blank" data-fbt="${i}-after" value="${escHtml(s.after||'')}">
        </div>`).join('')}
    </div>
    <button class="btn btn-secondary btn-sm" style="margin-top:6px;" onclick="addFBTRow()">+ sentence</button>`;
  if (type === 'fill_blank_hint') return `
    <div id="fbh-sentences">
      ${(data.sentences||[{before:'',hint:'',answer:'',after:''}]).map((s,i)=>`
        <div class="pair-row">
          <input class="input" placeholder="Before" data-fbh="${i}-before" value="${escHtml(s.before||'')}">
          <input class="input" placeholder="Hint (e.g. run →)" style="max-width:110px;" data-fbh="${i}-hint" value="${escHtml(s.hint||'')}">
          <input class="input" placeholder="Answer" style="max-width:110px;" data-fbh="${i}-answer" value="${escHtml(s.answer||'')}">
          <input class="input" placeholder="After" data-fbh="${i}-after" value="${escHtml(s.after||'')}">
        </div>`).join('')}
    </div>
    <button class="btn btn-secondary btn-sm" style="margin-top:6px;" onclick="addFBHRow()">+ sentence</button>`;
  if (type === 'image_match') return `
    <p class="text-sm text-muted" style="margin-bottom:10px;">Add image emoji + label pairs</p>
    <div id="im-pairs">
      ${(data.pairs||[{image:'🏟️',label:''}]).map((p,i)=>`
        <div class="pair-row">
          <input class="input" placeholder="Emoji" style="max-width:70px;text-align:center;font-size:20px;" data-im="${i}-image" value="${escHtml(p.image||'')}">
          <input class="input" placeholder="Label" data-im="${i}-label" value="${escHtml(p.label||'')}">
        </div>`).join('')}
    </div>
    <button class="btn btn-secondary btn-sm" style="margin-top:6px;" onclick="addIMPair()">+ pair</button>`;
  if (type === 'matching') return `
    <p class="text-sm text-muted" style="margin-bottom:10px;">Add matching pairs (Column A ↔ Column B)</p>
    <div id="mt-pairs">
      ${(data.pairs||[{a:'',b:''}]).map((p,i)=>`
        <div class="pair-row">
          <input class="input" placeholder="Column A" data-mt="${i}-a" value="${escHtml(p.a||'')}">
          <span style="color:var(--text4);">↔</span>
          <input class="input" placeholder="Column B" data-mt="${i}-b" value="${escHtml(p.b||'')}">
        </div>`).join('')}
    </div>
    <button class="btn btn-secondary btn-sm" style="margin-top:6px;" onclick="addMTPair()">+ pair</button>`;
  return '<p class="text-muted">Unknown exercise type.</p>';
}

// Dynamic row adders
window.addMCOption = () => {
  const c = document.getElementById('mc-options');
  const i = c.children.length;
  const d = document.createElement('div'); d.className = 'pair-row';
  d.innerHTML = `<input class="input" placeholder="Option ${i+1}" data-mc-opt="${i}"><label style="white-space:nowrap;font-size:12px;"><input type="radio" name="mc-correct" value="${i}"> Correct</label>`;
  c.appendChild(d);
};
window.addDropdownSentence = () => {
  const c = document.getElementById('dropdown-sentences');
  const i = c.children.length;
  const d = document.createElement('div');
  d.style.cssText = 'border:1px solid var(--border);border-radius:var(--r);padding:10px;margin-bottom:8px;';
  d.innerHTML = `<div class="form-row-2"><div><label class="label">Before blank</label><input class="input" data-ds="${i}-before"></div><div><label class="label">After blank</label><input class="input" data-ds="${i}-after"></div></div><div class="form-row"><label class="label">Options (comma-separated)</label><input class="input" data-ds="${i}-options"></div><div class="form-row"><label class="label">Correct answer</label><input class="input" data-ds="${i}-correct"></div>`;
  c.appendChild(d);
};
window.addFBTRow = () => {
  const c = document.getElementById('fbt-sentences'); const i = c.children.length;
  const d = document.createElement('div'); d.className='pair-row';
  d.innerHTML = `<input class="input" placeholder="Before" data-fbt="${i}-before"><input class="input" placeholder="Answer" style="max-width:130px;" data-fbt="${i}-answer"><input class="input" placeholder="After" data-fbt="${i}-after">`;
  c.appendChild(d);
};
window.addFBHRow = () => {
  const c = document.getElementById('fbh-sentences'); const i = c.children.length;
  const d = document.createElement('div'); d.className='pair-row';
  d.innerHTML = `<input class="input" placeholder="Before" data-fbh="${i}-before"><input class="input" placeholder="Hint" style="max-width:110px;" data-fbh="${i}-hint"><input class="input" placeholder="Answer" style="max-width:110px;" data-fbh="${i}-answer"><input class="input" placeholder="After" data-fbh="${i}-after">`;
  c.appendChild(d);
};
window.addIMPair = () => {
  const c = document.getElementById('im-pairs'); const i = c.children.length;
  const d = document.createElement('div'); d.className='pair-row';
  d.innerHTML = `<input class="input" placeholder="Emoji" style="max-width:70px;text-align:center;font-size:20px;" data-im="${i}-image"><input class="input" placeholder="Label" data-im="${i}-label">`;
  c.appendChild(d);
};
window.addMTPair = () => {
  const c = document.getElementById('mt-pairs'); const i = c.children.length;
  const d = document.createElement('div'); d.className='pair-row';
  d.innerHTML = `<input class="input" placeholder="Column A" data-mt="${i}-a"><span style="color:var(--text4);">↔</span><input class="input" placeholder="Column B" data-mt="${i}-b">`;
  c.appendChild(d);
};

function readExerciseForm(bd, type, oldData) {
  if (type==='text') return { heading: bd.querySelector('#ef-heading').value, text: bd.querySelector('#ef-text').value };
  if (type==='teacher_note') return { text: bd.querySelector('#ef-text').value, can_show: bd.querySelector('#ef-can-show').checked };
  if (type==='audio') return { title: bd.querySelector('#ef-title').value, duration: +bd.querySelector('#ef-duration').value||60, url: bd.querySelector('#ef-url').value };
  if (type==='multiple_choice') {
    const opts = [...bd.querySelectorAll('[data-mc-opt]')].map(i=>i.value);
    const correct = +bd.querySelector('[name="mc-correct"]:checked')?.value||0;
    return { question: bd.querySelector('#ef-q').value, options: opts, correct };
  }
  if (type==='dropdown') {
    const rows = [...bd.querySelectorAll('#dropdown-sentences > div')];
    return { sentences: rows.map((_,i)=>({
      before: bd.querySelector(`[data-ds="${i}-before"]`)?.value||'',
      blank: { options: (bd.querySelector(`[data-ds="${i}-options"]`)?.value||'').split(',').map(s=>s.trim()).filter(Boolean), correct: bd.querySelector(`[data-ds="${i}-correct"]`)?.value||'' },
      after: bd.querySelector(`[data-ds="${i}-after"]`)?.value||''
    }))};
  }
  if (type==='fill_blank_type') {
    const rows = [...bd.querySelectorAll('#fbt-sentences > div')];
    return { sentences: rows.map((_,i)=>({ before: bd.querySelector(`[data-fbt="${i}-before"]`)?.value||'', answer: bd.querySelector(`[data-fbt="${i}-answer"]`)?.value||'', after: bd.querySelector(`[data-fbt="${i}-after"]`)?.value||'' }))};
  }
  if (type==='fill_blank_hint') {
    const rows = [...bd.querySelectorAll('#fbh-sentences > div')];
    return { sentences: rows.map((_,i)=>({ before: bd.querySelector(`[data-fbh="${i}-before"]`)?.value||'', hint: bd.querySelector(`[data-fbh="${i}-hint"]`)?.value||'', answer: bd.querySelector(`[data-fbh="${i}-answer"]`)?.value||'', after: bd.querySelector(`[data-fbh="${i}-after"]`)?.value||'' }))};
  }
  if (type==='image_match') {
    const rows = [...bd.querySelectorAll('#im-pairs > div')];
    return { pairs: rows.map((_,i)=>({ image: bd.querySelector(`[data-im="${i}-image"]`)?.value||'', label: bd.querySelector(`[data-im="${i}-label"]`)?.value||'' }))};
  }
  if (type==='matching') {
    const rows = [...bd.querySelectorAll('#mt-pairs > div')];
    return { pairs: rows.map((_,i)=>({ a: bd.querySelector(`[data-mt="${i}-a"]`)?.value||'', b: bd.querySelector(`[data-mt="${i}-b"]`)?.value||'' }))};
  }
  return {};
}

window.deleteExercise = async (exId, pageId) => {
  if (!confirm('Delete this exercise?')) return;
  await DEL(`/api/exercises/${exId}`);
  toast('Exercise deleted', 'success');
  await loadExerciseEditor(pageId, true);
};

// Section / subsection / lesson CRUD
window.addSection = () => modal('Add Section', `
  <div class="form-row"><label class="label">Name</label><input class="input" id="m-name" placeholder="e.g. Business English"></div>
`, async (bd) => {
  await POST('/api/sections', { name: bd.querySelector('#m-name').value.trim() });
  toast('Section added', 'success'); loadCurriculumTree();
});
window.editSection = (id, name) => modal('Edit Section', `
  <div class="form-row"><label class="label">Name</label><input class="input" id="m-name" value="${escHtml(name)}"></div>
`, async (bd) => {
  await PUT(`/api/sections/${id}`, { name: bd.querySelector('#m-name').value.trim() });
  toast('Updated', 'success'); loadCurriculumTree();
});
window.deleteSection = (id) => {
  if (!confirm('Delete section and ALL its content?')) return;
  DEL(`/api/sections/${id}`).then(()=>{ toast('Deleted', 'success'); loadCurriculumTree(); });
};
window.addSubsection = (secId) => modal('Add Subsection', `
  <div class="form-row"><label class="label">Name</label><input class="input" id="m-name" placeholder="e.g. Intermediate"></div>
  <div class="form-row"><label class="label">Level</label>
    <select class="select" id="m-level">
      <option>Beginner</option><option>Elementary</option><option>Pre-Intermediate</option>
      <option>Intermediate</option><option selected>Upper Intermediate</option><option>Advanced</option>
    </select>
  </div>
`, async (bd) => {
  await POST('/api/subsections', { section_id: secId, name: bd.querySelector('#m-name').value.trim(), level: bd.querySelector('#m-level').value });
  toast('Subsection added', 'success'); loadCurriculumTree();
});
window.editSubsection = (id, name, level) => modal('Edit Subsection', `
  <div class="form-row"><label class="label">Name</label><input class="input" id="m-name" value="${escHtml(name)}"></div>
  <div class="form-row"><label class="label">Level</label><input class="input" id="m-level" value="${escHtml(level)}"></div>
`, async (bd) => {
  await PUT(`/api/subsections/${id}`, { name: bd.querySelector('#m-name').value.trim(), level: bd.querySelector('#m-level').value.trim() });
  toast('Updated', 'success'); loadCurriculumTree();
});
window.deleteSubsection = (id) => {
  if (!confirm('Delete this subsection?')) return;
  DEL(`/api/subsections/${id}`).then(()=>{ toast('Deleted', 'success'); loadCurriculumTree(); });
};
window.addLesson = (subId) => modal('Add Lesson', `
  <div class="form-row"><label class="label">Title</label><input class="input" id="m-title" placeholder="Lesson title"></div>
  <div class="form-row"><label class="label">Description</label><textarea class="textarea" id="m-desc" rows="2"></textarea></div>
`, async (bd) => {
  await POST('/api/lessons', { subsection_id: subId, title: bd.querySelector('#m-title').value.trim(), description: bd.querySelector('#m-desc').value });
  toast('Lesson added', 'success'); loadCurriculumTree();
});
window.editLesson = (id, title, desc) => modal('Edit Lesson', `
  <div class="form-row"><label class="label">Title</label><input class="input" id="m-title" value="${escHtml(title)}"></div>
  <div class="form-row"><label class="label">Description</label><textarea class="textarea" id="m-desc" rows="2">${escHtml(desc)}</textarea></div>
`, async (bd) => {
  await PUT(`/api/lessons/${id}`, { title: bd.querySelector('#m-title').value.trim(), description: bd.querySelector('#m-desc').value });
  toast('Lesson updated', 'success'); loadCurriculumTree();
});
window.deleteLesson = (id) => {
  if (!confirm('Delete lesson?')) return;
  DEL(`/api/lessons/${id}`).then(()=>{ toast('Deleted', 'success'); loadCurriculumTree(); });
};
window.addPage = (lessonId) => modal('Add Page', `
  <div class="form-row"><label class="label">Page Title</label><input class="input" id="m-title" placeholder="e.g. Warm Up"></div>
`, async (bd) => {
  const pages = await GET(`/api/lessons/${lessonId}/pages`);
  await POST('/api/lesson_pages', { lesson_id: lessonId, title: bd.querySelector('#m-title').value.trim(), sort_order: pages.length });
  toast('Page added', 'success');
  const lesson = S.admin.lessonId;
  await loadLessonEditor(lesson, '');
});
window.editPage = (id, title) => modal('Edit Page', `
  <div class="form-row"><label class="label">Title</label><input class="input" id="m-title" value="${escHtml(title)}"></div>
`, async (bd) => {
  await PUT(`/api/lesson_pages/${id}`, { title: bd.querySelector('#m-title').value.trim() });
  toast('Updated', 'success'); await loadLessonEditor(S.admin.lessonId, '');
});
window.deletePage = async (id, lessonId, title) => {
  if (!confirm('Delete this page and all its exercises?')) return;
  await DEL(`/api/lesson_pages/${id}`);
  toast('Page deleted', 'success'); await loadLessonEditor(lessonId, title);
};

// ══════════════════════════════════════════
// TEACHER VIEWS
// ══════════════════════════════════════════
async function renderTeacherStudents() {
  const students = await GET('/api/teacher/students');
  const el = document.getElementById('main-body');
  el.innerHTML = `
    <div class="page-header"><h1>My Students</h1><p>Click a student to manage lesson access and start a lesson</p></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;">
      ${students.map(s=>`
        <div class="card" style="cursor:pointer;" onclick="openStudentPanel(${s.id},'${escHtml(s.name)}','${s.avatar_color||'#059669'}')">
          <div class="card-body">
            <div class="flex items-center gap-3" style="margin-bottom:12px;">
              <div class="avatar avatar-lg" style="background:${s.avatar_color||'#059669'}">${s.name[0]}</div>
              <div><div style="font-weight:600;font-size:15px;">${escHtml(s.name)}</div><div class="text-sm text-muted">${escHtml(s.email)}</div></div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();openStudentPanel(${s.id},'${escHtml(s.name)}','${s.avatar_color||'#059669'}')">Manage & Start Lesson</button>
          </div>
        </div>`).join('')}
      ${students.length===0?'<p class="text-muted">No students assigned to you yet. Ask an admin to link students.</p>':''}
    </div>
    <div id="student-panel"></div>`;
}

window.openStudentPanel = async (studentId, name, color) => {
  const [accessIds, curriculum] = await Promise.all([
    GET(`/api/teacher/student/${studentId}/access`),
    GET('/api/curriculum')
  ]);
  const accessSet = new Set(accessIds);
  const panel = document.getElementById('student-panel');

  // Build flat lesson list
  let lessonsHtml = '';
  for (const sec of curriculum) {
    for (const sub of sec.subsections) {
      for (const les of sub.lessons) {
        const has = accessSet.has(les.id);
        lessonsHtml += `
          <tr>
            <td>${escHtml(sec.name)} › ${escHtml(sub.name)}</td>
            <td>${escHtml(les.title)}</td>
            <td>${has ? '<span class="badge badge-green">✓ Granted</span>' : '<span class="badge badge-gray">No access</span>'}</td>
            <td>
              ${has
                ? `<button class="btn btn-ghost btn-xs" onclick="revokeAccess(${studentId},${les.id},'${escHtml(name)}','${color}')">Revoke</button>
                   <button class="btn btn-primary btn-xs" onclick="startLesson(${les.id},${studentId})">Open Lesson</button>`
                : `<button class="btn btn-green btn-xs" onclick="grantAccess(${studentId},${les.id},'${escHtml(name)}','${color}')">Grant Access</button>`}
            </td>
          </tr>`;
      }
    }
  }

  panel.innerHTML = `
    <div class="card" style="margin-top:20px;overflow:hidden;">
      <div class="card-header">
        <div class="card-title">
          <div class="avatar avatar-sm" style="background:${color}">${name[0]}</div>
          ${escHtml(name)} — Lesson Access
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Section</th><th>Lesson</th><th>Access</th><th>Actions</th></tr></thead>
          <tbody>${lessonsHtml||'<tr><td colspan="4" class="text-muted">No lessons in curriculum.</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
};

window.grantAccess = async (sid, lid, name, color) => {
  await POST(`/api/teacher/student/${sid}/access`, { lesson_id: lid });
  toast('Access granted', 'success');
  openStudentPanel(sid, name, color);
};
window.revokeAccess = async (sid, lid, name, color) => {
  await DEL(`/api/teacher/student/${sid}/access/${lid}`);
  toast('Access revoked', 'success');
  openStudentPanel(sid, name, color);
};
window.startLesson = async (lessonId, studentId) => {
  const data = await POST('/api/sessions', { lesson_id: lessonId, student_id: studentId });
  if (!data) return;
  toast(`Session started! Student will see a "Join Lesson" button automatically.`, 'success', 5000);
  navigate('lesson', { session_id: data.session_id, lesson_id: lessonId, role: 'teacher' });
};

async function renderTeacherCurriculum() {
  const curriculum = await GET('/api/curriculum');
  const el = document.getElementById('main-body');
  el.innerHTML = `<div class="page-header"><h1>Lesson Library</h1><p>Browse all lessons. Click a lesson to open it as teacher.</p></div><div class="tree" id="curr-tree"></div>`;
  const tree = document.getElementById('curr-tree');
  for (const sec of curriculum) {
    const sd = document.createElement('div'); sd.className='tree-section';
    sd.innerHTML = `
      <div class="tree-section-header" onclick="this.nextElementSibling.classList.toggle('hidden');this.querySelector('.tree-chevron').classList.toggle('open')">
        <svg class="tree-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        <strong>${escHtml(sec.name)}</strong>
      </div>
      <div class="hidden" style="padding:8px 12px;">
        ${sec.subsections.map(sub=>`
          <div style="margin-bottom:8px;">
            <div style="font-size:12px;font-weight:600;color:var(--text3);margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em;">${escHtml(sub.name)} · ${escHtml(sub.level)}</div>
            ${sub.lessons.map(l=>`
              <div class="tree-lesson" onclick="teacherOpenLessonDirect(${l.id},${S.user.id})">
                ${escHtml(l.title)}
                <button class="btn btn-primary btn-xs ml-auto" onclick="event.stopPropagation();teacherOpenLessonDirect(${l.id},${S.user.id})">Open</button>
              </div>`).join('')}
          </div>`).join('')}
      </div>`;
    tree.appendChild(sd);
  }
}

window.teacherOpenLessonDirect = async (lessonId) => {
  const data = await POST('/api/sessions', { lesson_id: lessonId, student_id: null });
  if (!data) return;
  navigate('lesson', { session_id: data.session_id, lesson_id: lessonId, role: 'teacher' });
};

// ══════════════════════════════════════════
// STUDENT VIEWS
// ══════════════════════════════════════════
async function renderStudentLessons() {
  const [lessons, activeSessions] = await Promise.all([
    GET('/api/student/lessons'),
    GET('/api/student/active-sessions').catch(() => [])
  ]);

  const el = document.getElementById('main-body');

  // Active session banner
  let activeBanner = '';
  if (activeSessions.length > 0) {
    const s = activeSessions[0];
    activeBanner = `
      <div style="background:linear-gradient(135deg,#ecfdf5,#d1fae5);border:1.5px solid rgba(5,150,105,.3);border-radius:14px;padding:20px 24px;margin-bottom:24px;display:flex;align-items:center;justify-content:space-between;gap:16px;">
        <div>
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--green);margin-bottom:4px;">🟢 Lesson in progress</div>
          <div style="font-size:17px;font-weight:700;font-family:var(--font-d);">${escHtml(s.lesson_title)}</div>
          <div style="font-size:13px;color:var(--text3);margin-top:2px;">Teacher: ${escHtml(s.teacher_name)} · ${escHtml(s.sec_name)} › ${escHtml(s.sub_name)}</div>
        </div>
        <button class="btn btn-green" onclick="joinActiveSession('${s.session_id}',${s.lesson_id})" style="flex-shrink:0;font-size:15px;padding:12px 24px;">
          Join Lesson →
        </button>
      </div>`;
  }

  el.innerHTML = `
    <div class="page-header"><h1>My Lessons</h1><p>Lessons your teacher has given you access to</p></div>
    ${activeBanner}
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;">
      ${lessons.map(l=>`
        <div class="card">
          <div class="card-body">
            <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--accent);margin-bottom:5px;">${escHtml(l.sec_name)} › ${escHtml(l.sub_name)} · ${escHtml(l.level)}</div>
            <div style="font-family:var(--font-d);font-size:17px;font-weight:700;margin-bottom:6px;">${escHtml(l.title)}</div>
            <div class="text-sm text-muted" style="margin-bottom:14px;">${escHtml(l.description||'')}</div>
            <button class="btn btn-secondary btn-sm" onclick="studentJoinPrompt(${l.id})">Self-study</button>
          </div>
        </div>`).join('')}
      ${lessons.length===0?'<p class="text-muted">No lessons yet. Your teacher will grant you access to lessons.</p>':''}
    </div>`;

  // Poll for active sessions every 10 seconds
  clearInterval(S._sessionPoll);
  S._sessionPoll = setInterval(async () => {
    const active = await GET('/api/student/active-sessions').catch(() => []);
    if (active.length > 0 && S.view === 'student-lessons') {
      renderStudentLessons();
    }
  }, 10000);
}

window.joinActiveSession = (sessionId, lessonId) => {
  clearInterval(S._sessionPoll);
  navigate('lesson', { session_id: sessionId, lesson_id: lessonId, role: 'student' });
};

window.studentJoinPrompt = (lessonId) => {
  modal('Self-study / Join with ID', `
    <p class="text-sm text-muted" style="margin-bottom:10px;">Leave blank to start a self-study session, or paste a session ID your teacher shared.</p>
    <div class="form-row"><label class="label">Session ID <span class="text-muted">(optional)</span></label><input class="input" id="m-sid" placeholder="paste session ID here…"></div>
  `, async (bd) => {
    let sessionId = bd.querySelector('#m-sid').value.trim();
    if (!sessionId) {
      const data = await POST('/api/sessions', { lesson_id: lessonId, student_id: S.user.id });
      if (!data) return;
      sessionId = data.session_id;
    }
    navigate('lesson', { session_id: sessionId, lesson_id: lessonId, role: 'student' });
  }, 'Join');
};

// ══════════════════════════════════════════
// LESSON ROOM
// ══════════════════════════════════════════
function renderLessonShell() {
  return `
  <div class="lesson-shell" id="lesson-shell">
    <div class="lesson-topbar">
      <div style="font-family:var(--font-d);font-size:16px;">english<span style="color:var(--accent);">school</span>.pro</div>
      <div style="width:1px;height:20px;background:var(--border);"></div>
      <div id="lesson-title-bar" style="font-size:13px;font-weight:500;color:var(--text3);">Loading…</div>
      <div id="lesson-session-id"></div>
      <div id="lesson-status" style="margin-left:8px;"></div>
      <div style="margin-left:auto;display:flex;gap:8px;align-items:center;">
        <div id="partner-status"></div>
        <button class="btn btn-secondary btn-sm" onclick="backToDashboard()">← Exit</button>
        ${S.user.role==='teacher'?`<button class="btn btn-danger btn-sm" onclick="endSession()">End Lesson</button>`:''}
      </div>
    </div>
    <div class="lesson-body">
      <div class="lesson-left" id="lesson-left">
        <div class="video-area" id="video-area">
          <!-- Remote video (partner) - full size background -->
          <video id="video-remote" autoplay playsinline
            style="width:100%;height:100%;object-fit:cover;display:block;background:#111;"></video>
          <!-- Waiting state shown until partner connects -->
          <div id="video-waiting" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:rgba(255,255,255,.35);pointer-events:none;">
            <div style="font-size:28px;">👤</div>
            <div style="font-size:11px;margin-top:6px;">Waiting for partner…</div>
          </div>
          <!-- Local video PiP -->
          <video id="video-local" autoplay playsinline muted
            style="position:absolute;bottom:44px;right:8px;width:72px;height:54px;object-fit:cover;border-radius:8px;border:1.5px solid rgba(255,255,255,.2);background:#222;display:block;"></video>
          <!-- Local video label -->
          <div style="position:absolute;bottom:46px;right:8px;width:72px;text-align:center;font-size:9px;color:rgba(255,255,255,.5);pointer-events:none;padding-top:2px;">You</div>
          <div class="video-controls-bar">
            <div class="vc-btn" id="vc-mic" onclick="toggleMic()" title="Mute mic">
              <svg id="vc-mic-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></svg>
            </div>
            <div class="vc-btn" id="vc-cam" onclick="toggleCam()" title="Turn off camera">
              <svg id="vc-cam-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
            </div>
          </div>
        </div>
        <div class="left-tools">
          <div>
            <div class="tool-label">Dictionary</div>
            <div style="position:relative;">
              <input class="input" id="dict-input" placeholder="Look up a word…" oninput="lookupWord(this.value)" style="padding-right:32px;">
              <svg style="position:absolute;right:10px;top:50%;transform:translateY(-50%);color:var(--text4);" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            </div>
            <div id="dict-result"></div>
          </div>
          <div>
            <div class="tool-label" style="display:flex;align-items:center;justify-content:space-between;">
              Notes
              <span id="notes-typing-label" style="font-size:10px;color:var(--green);font-weight:500;opacity:0;transition:opacity .3s;"></span>
            </div>
            <textarea class="textarea" id="lesson-notes" placeholder="Shared notes — both teacher and student see these in real time…" rows="4" oninput="syncNotes(this.value)"></textarea>
          </div>
          <div>
            <div class="tool-label">Pages</div>
            <div class="pages-nav" id="pages-nav"></div>
          </div>
        </div>
      </div>
      <div class="lesson-content">
        <div class="tab-bar" id="tab-bar">
          <div class="tab active" data-tab="exercises">Exercises</div>
          <div class="tab" data-tab="notes" style="margin-left:auto;">Notes</div>
        </div>
        <div class="lesson-scroll" id="lesson-scroll">
          <div id="exercises-view"></div>
        </div>
      </div>
    </div>
    <div class="activity-bar" id="activity-bar">
      <div id="activity-items" style="display:flex;align-items:center;gap:12px;font-size:12px;color:var(--text3);"></div>
      <div style="margin-left:auto;font-size:11px;color:var(--text4);">WebSocket · live sync</div>
    </div>
  </div>
  <div id="toast-container"></div>`;
}

async function initLesson() {
  const { session_id, role } = S.params;

  // Get session
  let session;
  try { session = await GET(`/api/sessions/${session_id}`); }
  catch {
    toast('Session not found — please start a new lesson.', 'error', 5000);
    setTimeout(() => backToDashboard(), 2000);
    return;
  }
  if (!session) {
    toast('Session not found — please start a new lesson.', 'error', 5000);
    setTimeout(() => backToDashboard(), 2000);
    return;
  }

  S.lesson.session_id = session_id;
  S.lesson.currentPageId = session.current_page_id;

  // Show session ID for sharing
  // Show session ID with copy button (teacher needs to share this with student)
  const sidEl = document.getElementById('lesson-session-id');
  if (role === 'teacher') {
    sidEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;background:var(--accent-s,#eef3fd);border:1px solid rgba(37,99,235,.25);border-radius:6px;padding:4px 10px;">
        <span style="font-size:11px;color:var(--text3,#6b7280);font-weight:500;">Session ID:</span>
        <code style="font-size:12px;font-weight:700;color:var(--accent,#2563eb);letter-spacing:.03em;">${session_id.slice(0,8).toUpperCase()}</code>
        <button onclick="copySessionId('${session_id}')" style="border:none;background:none;cursor:pointer;padding:2px 4px;border-radius:4px;color:var(--accent,#2563eb);font-size:11px;font-weight:600;" title="Copy full session ID">📋 Copy</button>
      </div>`;
  } else {
    sidEl.innerHTML = `<span style="font-size:11px;color:var(--text4,#9ca3af);">Session active</span>`;
  }

  // Load pages + first page immediately via REST — don't wait for socket
  S.lesson.pages = await GET(`/api/lessons/${session.lesson_id}/pages`);
  document.getElementById('lesson-title-bar').textContent =
    `Sports & Language${role === 'teacher' ? ' — Teacher' : ' — Student'}`;
  renderPagesNav();
  if (S.lesson.currentPageId) await loadPage(S.lesson.currentPageId);

  // Connect socket
  const socket = io({ auth: { token: S.token } });
  S.lesson.socket = socket;

  socket.on('connect', () => {
    socket.emit('join_session', { session_id });
    document.getElementById('lesson-status').innerHTML = '<span class="badge badge-green live-dot">Connected</span>';
    // Start WebRTC after socket is ready
    const isTeacher = role === 'teacher';
    startWebRTC(socket, session_id, isTeacher);
  });

  socket.on('disconnect', () => {
    document.getElementById('lesson-status').innerHTML = '<span class="badge badge-gray">Disconnected</span>';
  });

  socket.on('session_state', async (state) => {
    S.lesson.audioState = state.audio_state || {};
    S.lesson.responses = state.responses || {};
    // Restore saved notes
    const ta = document.getElementById('lesson-notes');
    if (state.notes && ta) {
      ta.value = state.notes;
      S.lesson.notes = state.notes;
    }
    // Apply any saved exercise responses to current page
    if (Object.keys(S.lesson.responses).length > 0) {
      Object.entries(S.lesson.responses).forEach(([exId, resp]) => applyExerciseResponse(+exId, resp));
    }
    // Apply audio state
    Object.values(S.lesson.audioState).forEach(s => applyAudioState(s));
  });

  socket.on('user_joined', ({ role: r, name }) => {
    toast(`${name} (${r}) joined the lesson`, 'success');
    document.getElementById('partner-status').innerHTML =
      `<span class="badge badge-green live-dot">${escHtml(name)} online</span>`;
    activity(`${name} joined`);
  });
  socket.on('user_left', ({ role: r, name }) => {
    toast(`${name} left the lesson`, 'info');
    document.getElementById('partner-status').innerHTML = `<span class="badge badge-gray">${escHtml(name)} offline</span>`;
  });

  // Page change (teacher controls)
  socket.on('page_changed', async ({ page_id }) => {
    S.lesson.currentPageId = page_id;
    renderPagesNav();
    await loadPage(page_id);
    if (S.user.role === 'student') toast('Teacher moved to a new page', 'info');
  });

  // Audio sync
  socket.on('audio_sync', (state) => {
    S.lesson.audioState[state.exercise_id] = state;
    applyAudioState(state);
  });

  // Exercise responses
  socket.on('exercise_response', ({ exercise_id, response, by }) => {
    S.lesson.responses[exercise_id] = response;
    applyExerciseResponse(exercise_id, response);
    activity(`${by.name}: answered exercise`);
  });

  // Notes sync - bidirectional
  socket.on('notes_sync', ({ notes, by }) => {
    const ta = document.getElementById('lesson-notes');
    if (ta && document.activeElement !== ta) {
      ta.value = notes;
    }
    // Show who is typing in notes
    const label = document.getElementById('notes-typing-label');
    if (label) {
      label.textContent = `${by === 'teacher' ? '👩‍🏫 Teacher' : '👨‍🎓 Student'} is editing…`;
      label.style.opacity = '1';
      clearTimeout(label._t);
      label._t = setTimeout(() => { label.style.opacity = '0'; }, 2000);
    }
  });

  // Reveal hidden
  socket.on('reveal_content', ({ exercise_id, revealed }) => {
    const el = document.getElementById(`hidden-content-${exercise_id}`);
    if (el) { if (revealed) el.classList.remove('blurred'); else el.classList.add('blurred'); }
  });

  // Session ended
  socket.on('session_ended', () => {
    toast('The lesson has ended', 'info');
    setTimeout(() => backToDashboard(), 2000);
  });

  // Tab bar
  document.getElementById('tab-bar').onclick = (e) => {
    const tab = e.target.closest('[data-tab]');
    if (!tab) return;
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
  };
}

function renderPagesNav() {
  const nav = document.getElementById('pages-nav');
  if (!nav) return;
  nav.innerHTML = S.lesson.pages.map((p, i) => `
    <div class="page-nav-item ${S.lesson.currentPageId===p.id?'active':''}" onclick="teacherChangePage(${p.id})">
      <span class="page-nav-num">${i+1}</span>
      ${escHtml(p.title)}
    </div>`).join('');
}

window.teacherChangePage = (pageId) => {
  if (S.user.role !== 'teacher') return; // students can't change
  S.lesson.socket.emit('change_page', { session_id: S.lesson.session_id, page_id: pageId });
  S.lesson.currentPageId = pageId;
  renderPagesNav();
  loadPage(pageId);
};

async function loadPage(pageId) {
  const page = S.lesson.pages.find(p => p.id === pageId);
  const el = document.getElementById('exercises-view');
  if (!el) return;
  if (!page) return;

  // Cache exercises
  if (!S.lesson.exercises[pageId]) {
    S.lesson.exercises[pageId] = await GET(`/api/pages/${pageId}/exercises`);
  }
  const exercises = S.lesson.exercises[pageId];

  el.innerHTML = `
    <div class="lesson-page-title">
      <div class="eyebrow">Page ${S.lesson.pages.findIndex(p=>p.id===pageId)+1} of ${S.lesson.pages.length}</div>
      <h2>${escHtml(page.title)}</h2>
    </div>
    ${exercises.map(ex => renderExercise(ex)).join('')}`;

  // Bind exercise interactivity
  bindExercises(exercises);

  // Apply cached responses
  Object.entries(S.lesson.responses).forEach(([exId, resp]) => applyExerciseResponse(+exId, resp));

  // Apply audio state
  Object.values(S.lesson.audioState).forEach(state => applyAudioState(state));
}

function renderExercise(ex) {
  const typeLabel = {
    text:'📝 Text', teacher_note:'👁 Teacher Note', audio:'🎧 Listening',
    dropdown:'📋 Dropdown', fill_blank_type:'✍️ Fill in the Blanks',
    fill_blank_hint:'💡 Use the Correct Form', image_match:'🖼️ Image Match',
    matching:'🔗 Matching', multiple_choice:'☑️ Multiple Choice'
  }[ex.type] || ex.type;

  // Hide teacher_note body from students by default
  const isTeacher = S.user.role === 'teacher' || S.user.role === 'admin';
  if (ex.type === 'teacher_note' && !isTeacher) return '';

  let body = '';
  const d = ex.data;

  switch (ex.type) {
    case 'text':
      body = `<div class="ex-text-block">${d.heading?`<h3>${escHtml(d.heading)}</h3>`:''}${escHtml(d.text||'').replace(/\n/g,'<br>')}</div>`;
      break;
    case 'teacher_note':
      body = `<div class="teacher-note-box">
        <div class="note-header">👁 Teacher Note</div>
        <p>${escHtml(d.text||'')}</p>
        ${d.can_show && isTeacher ? `
          <div style="margin-top:10px;">
            <button class="btn btn-secondary btn-sm" onclick="toggleReveal(${ex.id})">Show to student</button>
          </div>` : ''}
      </div>`;
      break;
    case 'audio':
      body = renderAudioExercise(ex);
      break;
    case 'dropdown':
      body = (d.sentences||[]).map((s,i) => `
        <div class="sentence-row" style="margin-bottom:4px;">
          ${escHtml(s.before||'')}
          <select class="ex-dropdown" id="dd-${ex.id}-${i}" onchange="submitDropdown(${ex.id},${i},this)" data-correct="${escHtml(s.blank?.correct||'')}">
            <option value="">select…</option>
            ${(s.blank?.options||[]).map(o=>`<option value="${escHtml(o)}">${escHtml(o)}</option>`).join('')}
          </select>
          ${escHtml(s.after||'')}
        </div>`).join('');
      break;
    case 'fill_blank_type':
      body = (d.sentences||[]).map((s,i) => `
        <div class="sentence-row">
          ${escHtml(s.before||'')}
          <input class="ex-blank" id="fbt-${ex.id}-${i}" data-answer="${escHtml(s.answer||'')}" oninput="submitFBT(${ex.id},${i},this)" placeholder="…">
          ${escHtml(s.after||'')}
        </div>`).join('');
      break;
    case 'fill_blank_hint':
      body = (d.sentences||[]).map((s,i) => `
        <div class="sentence-row">
          ${escHtml(s.before||'')}
          <input class="ex-blank" id="fbh-${ex.id}-${i}" data-answer="${escHtml(s.answer||'')}" oninput="submitFBT(${ex.id},${i},this)" placeholder="${escHtml(s.hint||'…')}" style="width:130px;">
          <span class="ex-blank-hint">(${escHtml(s.hint||'')})</span>
          ${escHtml(s.after||'')}
        </div>`).join('');
      break;
    case 'image_match':
      body = `
        <div class="image-match-labels" id="im-labels-${ex.id}">
          ${(d.pairs||[]).map(p=>`<div class="drag-chip" draggable="true" data-label="${escHtml(p.label)}" id="chip-${ex.id}-${escHtml(p.label)}">${escHtml(p.label)}</div>`).join('')}
        </div>
        <div class="image-match-grid">
          ${(d.pairs||[]).map(p=>`
            <div class="image-card">
              <span class="image-card-face">${escHtml(p.image)}</span>
              <div class="image-drop-target" id="drop-${ex.id}-${escHtml(p.label)}" data-correct="${escHtml(p.label)}" ondragover="event.preventDefault();this.classList.add('drag-over')" ondragleave="this.classList.remove('drag-over')" ondrop="dropLabel(event,${ex.id},'${escHtml(p.label)}')">drop here</div>
            </div>`).join('')}
        </div>`;
      break;
    case 'matching':
      const shuffleB = [...(d.pairs||[])].sort(()=>Math.random()-.5);
      body = `<p class="text-sm text-muted" style="margin-bottom:10px;">Click an item in Column A, then its match in Column B.</p>
        <div class="match-grid">
          <div class="match-col" id="ma-${ex.id}">${(d.pairs||[]).map(p=>`<div class="match-item" data-key="${escHtml(p.a)}" data-col="a" data-ex="${ex.id}">${escHtml(p.a)}</div>`).join('')}</div>
          <div class="match-col" id="mb-${ex.id}">${shuffleB.map(p=>`<div class="match-item" data-key="${escHtml(p.a)}" data-col="b" data-ex="${ex.id}">${escHtml(p.b)}</div>`).join('')}</div>
        </div>`;
      break;
    case 'multiple_choice':
      body = `<div style="font-size:14px;font-weight:500;margin-bottom:12px;">${escHtml(d.question||'')}</div>
        <div class="mc-options">
          ${(d.options||[]).map((o,i)=>`
            <div class="mc-option" id="mc-${ex.id}-${i}" data-idx="${i}" data-correct="${d.correct}" data-ex="${ex.id}">
              <div class="mc-circle" id="mc-circle-${ex.id}-${i}"></div>
              ${escHtml(o)}
            </div>`).join('')}
        </div>`;
      break;
    default: body = `<p class="text-muted text-sm">[Unknown type: ${escHtml(ex.type)}]</p>`;
  }

  return `
    <div class="exercise-wrap" id="exercise-${ex.id}">
      ${ex.type !== 'text' && ex.type !== 'teacher_note' ? `<div class="exercise-type-label">${typeLabel}</div>` : ''}
      ${body}
    </div>`;
}

function renderAudioExercise(ex) {
  const d = ex.data;
  const totalSec = d.duration || 60;
  const bars = Array.from({length:48},()=>`<div class="wave-bar" style="height:${6+Math.random()*28}px;"></div>`).join('');
  const isTeacher = S.user.role==='teacher';
  return `
    <div class="audio-player">
      <div class="audio-title">${escHtml(d.title||'Audio')}</div>
      <div class="waveform" id="wf-${ex.id}">${bars}</div>
      <div class="audio-ctrl-row">
        <button class="play-btn" id="play-${ex.id}" onclick="${isTeacher?`teacherToggleAudio(${ex.id},${totalSec})`:'studentAudioClick()'}" title="${isTeacher?'Play/Pause':'Teacher controls audio'}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" id="play-icon-${ex.id}"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </button>
        <div class="audio-progress">
          <div class="progress-track" ${isTeacher?`onclick="teacherSeekAudio(event,${ex.id},${totalSec})"`:''}><div class="progress-fill" id="pf-${ex.id}" style="width:0%"></div></div>
          <div class="audio-times"><span id="at-cur-${ex.id}">0:00</span><span>${fmtTime(totalSec)}</span></div>
        </div>
      </div>
      <div class="sync-note">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 12 4 10"/></svg>
        ${isTeacher?'Controls synced with student':'Teacher controls playback'}
      </div>
    </div>`;
}

// Audio state management
const _audioTimers = {};
function applyAudioState(state) {
  const { exercise_id, playing, progress } = state;
  const pf = document.getElementById(`pf-${exercise_id}`);
  const btn = document.getElementById(`play-${exercise_id}`);
  const icon = document.getElementById(`play-icon-${exercise_id}`);
  if (!pf) return;
  pf.style.width = (progress||0) + '%';
  updateAudioTime(exercise_id, progress||0, state.duration||60);
  if (icon) icon.innerHTML = playing ? '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>' : '<polygon points="5 3 19 12 5 21 5 3"/>';
  if (btn) btn.classList.toggle('playing', !!playing);
  // Start/stop local animation
  clearInterval(_audioTimers[exercise_id]);
  if (playing && S.user.role !== 'teacher') {
    let p = progress||0;
    const dur = state.duration||60;
    _audioTimers[exercise_id] = setInterval(() => {
      p += (100/dur) * 0.1;
      if (p >= 100) { clearInterval(_audioTimers[exercise_id]); return; }
      const pf2 = document.getElementById(`pf-${exercise_id}`);
      if (pf2) { pf2.style.width = p+'%'; updateAudioTime(exercise_id, p, dur); }
    }, 100);
  }
}

window.teacherToggleAudio = (exId, dur) => {
  const cur = S.lesson.audioState[exId] || { exercise_id: exId, playing: false, progress: 0, duration: dur };
  const newState = { ...cur, exercise_id: exId, playing: !cur.playing, duration: dur };
  S.lesson.audioState[exId] = newState;
  S.lesson.socket.emit('audio_sync', { session_id: S.lesson.session_id, state: newState });
  applyAudioState(newState);

  if (newState.playing) {
    clearInterval(_audioTimers[exId]);
    _audioTimers[exId] = setInterval(() => {
      const s = S.lesson.audioState[exId];
      if (!s || !s.playing) { clearInterval(_audioTimers[exId]); return; }
      s.progress = (s.progress||0) + (100/dur) * 0.1;
      if (s.progress >= 100) { s.playing = false; clearInterval(_audioTimers[exId]); s.progress = 100; }
      const pf = document.getElementById(`pf-${exId}`);
      if (pf) { pf.style.width = s.progress+'%'; updateAudioTime(exId, s.progress, dur); }
      S.lesson.socket.emit('audio_sync', { session_id: S.lesson.session_id, state: s });
    }, 100);
  } else { clearInterval(_audioTimers[exId]); }
};

window.teacherSeekAudio = (e, exId, dur) => {
  const rect = e.currentTarget.getBoundingClientRect();
  const p = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
  const cur = S.lesson.audioState[exId] || { exercise_id: exId, playing: false, duration: dur };
  const newState = { ...cur, exercise_id: exId, progress: p, duration: dur };
  S.lesson.audioState[exId] = newState;
  S.lesson.socket.emit('audio_sync', { session_id: S.lesson.session_id, state: newState });
  applyAudioState(newState);
};

window.studentAudioClick = () => toast('Teacher controls the audio', 'info');

function updateAudioTime(exId, progress, dur) {
  const el = document.getElementById(`at-cur-${exId}`);
  if (el) el.textContent = fmtTime(Math.round((progress/100)*dur));
}
function fmtTime(s) { return Math.floor(s/60)+':'+ String(s%60).padStart(2,'0'); }

// Binding exercise interactions
function bindExercises(exercises) {
  // Matching
  exercises.filter(e=>e.type==='matching').forEach(ex => {
    let selA = null, selAKey = null;
    document.getElementById(`ma-${ex.id}`)?.addEventListener('click', e => {
      const item = e.target.closest('.match-item');
      if (!item || item.classList.contains('matched')) return;
      document.querySelectorAll(`#ma-${ex.id} .match-item`).forEach(m=>m.classList.remove('selected'));
      selA = item; selAKey = item.dataset.key; item.classList.add('selected');
    });
    document.getElementById(`mb-${ex.id}`)?.addEventListener('click', e => {
      const item = e.target.closest('.match-item');
      if (!item || !selA || item.classList.contains('matched')) return;
      if (item.dataset.key === selAKey) {
        selA.classList.remove('selected'); selA.classList.add('matched');
        item.classList.add('matched');
        const resp = S.lesson.responses[ex.id] || {};
        resp[selAKey] = true;
        submitResponse(ex.id, resp);
        activity(`Matched "${selAKey}"`);
      } else {
        selA.classList.remove('selected');
        toast('Not a match, try again', 'info');
      }
      selA = null; selAKey = null;
    });
  });

  // MC
  exercises.filter(e=>e.type==='multiple_choice').forEach(ex => {
    document.querySelectorAll(`[data-ex="${ex.id}"]`).forEach(opt => {
      opt.onclick = () => {
        const idx = +opt.dataset.idx;
        const correct = +opt.dataset.correct;
        const resp = { selected: idx, correct: idx === correct };
        submitResponse(ex.id, resp);
        activity(`Selected option ${idx+1}`);
      };
    });
  });

  // Image match drag
  exercises.filter(e=>e.type==='image_match').forEach(ex => {
    let dragging = null;
    document.querySelectorAll(`#im-labels-${ex.id} .drag-chip`).forEach(chip => {
      chip.ondragstart = () => { dragging = chip.dataset.label; chip.classList.add('used'); };
      chip.ondragend = () => { if (dragging) chip.classList.remove('used'); };
    });
    window[`dropLabel`] = (e, exId, correct) => {
      e.preventDefault();
      const target = e.currentTarget;
      target.classList.remove('drag-over');
      if (!dragging) return;
      target.textContent = dragging;
      const isCorrect = dragging === correct;
      target.classList.remove('correct','incorrect');
      target.classList.add(isCorrect ? 'correct' : 'incorrect');
      const resp = S.lesson.responses[exId] || {};
      resp[correct] = { placed: dragging, correct: isCorrect };
      submitResponse(exId, resp);
      if (isCorrect) {
        document.getElementById(`chip-${exId}-${dragging}`)?.classList.add('used');
        activity(`Placed "${dragging}" correctly`);
      } else {
        setTimeout(() => { document.getElementById(`chip-${exId}-${dragging}`)?.classList.remove('used'); }, 500);
      }
      dragging = null;
    };
  });
}

window.submitDropdown = (exId, idx, sel) => {
  const correct = sel.dataset.correct;
  const val = sel.value;
  if (!val) return;
  sel.classList.remove('correct','incorrect');
  sel.classList.add(val === correct ? 'correct' : 'incorrect');
  const resp = S.lesson.responses[exId] || {};
  resp[idx] = { value: val, correct: val === correct };
  submitResponse(exId, resp);
  activity(`Selected "${val}"`);
};

window.submitFBT = (exId, idx, input) => {
  const answer = input.dataset.answer.toLowerCase();
  const val = input.value.toLowerCase().trim();
  S.lesson.socket?.emit('typing', { session_id: S.lesson.session_id, exercise_id: exId, text: input.value });
  input.classList.remove('correct','incorrect');
  if (val === answer) {
    input.classList.add('correct');
    const resp = S.lesson.responses[exId] || {};
    resp[idx] = { value: val, correct: true };
    submitResponse(exId, resp);
    activity(`Correct answer: "${val}"`);
  } else if (val.length > 0) {
    input.classList.add('incorrect');
  }
};

function submitResponse(exId, response) {
  S.lesson.responses[exId] = response;
  S.lesson.socket?.emit('exercise_response', { session_id: S.lesson.session_id, exercise_id: exId, response });
}

function applyExerciseResponse(exId, response) {
  // Dropdown
  Object.entries(response).forEach(([idx, val]) => {
    if (val?.value !== undefined) {
      const sel = document.getElementById(`dd-${exId}-${idx}`);
      if (sel) { sel.value = val.value; sel.classList.remove('correct','incorrect'); sel.classList.add(val.correct?'correct':'incorrect'); }
      const inp = document.getElementById(`fbt-${exId}-${idx}`) || document.getElementById(`fbh-${exId}-${idx}`);
      if (inp) { inp.value = val.value||''; inp.classList.remove('correct','incorrect'); inp.classList.add(val.correct?'correct':'incorrect'); }
    }
    // Image match
    if (val?.placed !== undefined) {
      const target = document.getElementById(`drop-${exId}-${idx}`);
      if (target) {
        target.textContent = val.placed;
        target.classList.remove('correct','incorrect');
        target.classList.add(val.correct?'correct':'incorrect');
      }
    }
    // Matching
    if (val === true) {
      const ma = document.querySelector(`#ma-${exId} [data-key="${idx}"]`);
      const mb = document.querySelector(`#mb-${exId} [data-key="${idx}"]`);
      if (ma) { ma.classList.remove('selected'); ma.classList.add('matched'); }
      if (mb) mb.classList.add('matched');
    }
  });
  // MC
  if (response.selected !== undefined) {
    document.querySelectorAll(`[data-ex="${exId}"]`).forEach(opt => {
      const idx = +opt.dataset.idx;
      opt.classList.remove('selected','correct','incorrect');
      if (idx === response.selected) opt.classList.add(response.correct?'correct':(+opt.dataset.correct===idx?'correct':'incorrect'));
      if (idx === +opt.dataset.correct && !response.correct) opt.classList.add('correct');
    });
  }
}

window.toggleReveal = (exId) => {
  const el = document.getElementById(`hidden-content-${exId}`);
  if (!el) return;
  const revealed = el.classList.toggle('blurred') === false;
  S.lesson.socket?.emit('reveal_content', { session_id: S.lesson.session_id, exercise_id: exId, revealed: !el.classList.contains('blurred') });
};

function syncNotes(val) {
  S.lesson.socket?.emit('notes_sync', { session_id: S.lesson.session_id, notes: val });
}

function activity(msg) {
  const bar = document.getElementById('activity-items');
  if (!bar) return;
  const dot = document.createElement('div');
  dot.style.cssText = 'display:flex;align-items:center;gap:5px;';
  dot.innerHTML = `<div class="activity-dot"></div><span>${escHtml(msg)}</span>`;
  bar.insertBefore(dot, bar.firstChild);
  while (bar.children.length > 3) bar.removeChild(bar.lastChild);
}

// Dictionary
const dictDefs = {
  referee:{pos:'noun',def:'An official who controls a sports match.'},
  whistle:{pos:'noun',def:'A small instrument blown to make a high signal sound.'},
  offside:{pos:'adj/noun',def:'In a position ahead of the ball that is against the rules.'},
  foul:{pos:'noun',def:'An unfair act against an opposing player.'},
  penalty:{pos:'noun',def:'A kick from the penalty spot, awarded for a foul.'},
  caution:{pos:'noun',def:'A formal warning given by a referee (yellow card).'},
  tackle:{pos:'verb/noun',def:'To challenge a player for the ball; the act of doing this.'},
  goal:{pos:'noun',def:'A point scored by sending the ball into the net.'},
  draw:{pos:'noun/verb',def:'A game ending with equal scores for both teams.'},
};
let dictTimer;
window.lookupWord = (val) => {
  clearTimeout(dictTimer);
  dictTimer = setTimeout(() => {
    const res = document.getElementById('dict-result');
    if (!res) return;
    const w = val.toLowerCase().trim();
    if (!w) { res.innerHTML=''; return; }
    const d = dictDefs[w];
    if (d) res.innerHTML = `<div class="dict-result"><div class="dict-word">${w}</div><div class="dict-pos">${d.pos}</div><div style="color:var(--text2);margin-top:3px;">${d.def}</div></div>`;
    else res.innerHTML = `<div class="dict-result"><span style="color:var(--text4);font-size:12px;">No result for "${escHtml(w)}"</span></div>`;
  }, 350);
};

window.endSession = () => {
  if (!confirm('End this lesson for everyone?')) return;
  S.lesson.socket?.emit('end_session', { session_id: S.lesson.session_id });
};

window.copySessionId = (sid) => {
  navigator.clipboard.writeText(sid).then(() => toast('Session ID copied! Share it with your student.', 'success', 4000));
};

// ══════════════════════════════════════════
// WEBRTC VIDEO CHAT
// ══════════════════════════════════════════
const RTC = {
  pc: null,
  localStream: null,
  remoteStream: null,
  micOn: true,
  camOn: true,
};

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ]
};

async function startWebRTC(socket, session_id, isTeacher) {
  // Get local camera + mic
  try {
    RTC.localStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      audio: { echoCancellation: true, noiseSuppression: true }
    });
  } catch(e) {
    console.warn('Camera/mic unavailable:', e.message);
    const w = document.getElementById('video-waiting');
    if (w) w.innerHTML = `<div style="font-size:11px;color:rgba(255,255,255,.4);text-align:center;padding:12px;">📷 Camera not available<br><span style="font-size:10px;opacity:.6;">${e.name}</span></div>`;
    return;
  }

  // Show own video immediately
  const localVideo = document.getElementById('video-local');
  if (localVideo) {
    localVideo.srcObject = RTC.localStream;
    localVideo.play().catch(()=>{});
  }

  // Create a single remote MediaStream to collect incoming tracks
  RTC.remoteStream = new MediaStream();
  const remoteVideo = document.getElementById('video-remote');
  if (remoteVideo) {
    remoteVideo.srcObject = RTC.remoteStream;
  }

  function buildPC() {
    if (RTC.pc) { try { RTC.pc.close(); } catch(e){} RTC.pc = null; }
    const pc = new RTCPeerConnection(RTC_CONFIG);
    RTC.pc = pc;

    // Add all local tracks
    RTC.localStream.getTracks().forEach(track => pc.addTrack(track, RTC.localStream));

    // Each incoming track gets added to remoteStream, then we play
    pc.ontrack = (e) => {
      console.log('ontrack fired, kind:', e.track.kind, 'streams:', e.streams.length);
      e.track.onunmute = () => {
        RTC.remoteStream.addTrack(e.track);
        const rv = document.getElementById('video-remote');
        if (rv) {
          rv.srcObject = RTC.remoteStream;
          rv.play().catch(err => console.warn('play error:', err));
          const w = document.getElementById('video-waiting');
          if (w) w.style.display = 'none';
        }
      };
      // Also add immediately in case unmute already happened
      if (e.track.readyState === 'live') {
        RTC.remoteStream.addTrack(e.track);
        const rv = document.getElementById('video-remote');
        if (rv) {
          rv.srcObject = RTC.remoteStream;
          rv.play().catch(err => console.warn('play error:', err));
          const w = document.getElementById('video-waiting');
          if (w) w.style.display = 'none';
        }
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) socket.emit('webrtc_ice', { session_id, candidate: e.candidate });
    };

    pc.onconnectionstatechange = () => {
      console.log('RTC state:', pc.connectionState);
      const w = document.getElementById('video-waiting');
      if (pc.connectionState === 'connected') {
        if (w) w.style.display = 'none';
        toast('Video connected!', 'success', 2000);
      }
      if (pc.connectionState === 'failed') {
        if (w) { w.style.display = 'flex'; w.innerHTML = `<div style="font-size:11px;color:rgba(255,255,255,.4);">Connection failed</div>`; }
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE state:', pc.iceConnectionState);
    };

    return pc;
  }

  // ── TEACHER ───────────────────────────────
  if (isTeacher) {
    buildPC();

    const sendOffer = async () => {
      try {
        // Recreate PC for clean state
        buildPC();
        const offer = await RTC.pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
        await RTC.pc.setLocalDescription(offer);
        socket.emit('webrtc_offer', { session_id, sdp: RTC.pc.localDescription });
        console.log('Offer sent');
      } catch(e) { console.error('sendOffer error:', e); }
    };

    socket.on('webrtc_ready', sendOffer);
    socket.on('webrtc_answer', async ({ sdp }) => {
      try {
        if (RTC.pc && RTC.pc.signalingState === 'have-local-offer') {
          await RTC.pc.setRemoteDescription(new RTCSessionDescription(sdp));
          console.log('Answer applied');
        }
      } catch(e) { console.error('setAnswer error:', e); }
    });

    // Announce teacher is ready — if student is already there, they'll trigger webrtc_ready back
    socket.emit('webrtc_teacher_ready', { session_id });
  }

  // ── STUDENT ───────────────────────────────
  if (!isTeacher) {
    buildPC();

    socket.on('webrtc_teacher_ready', () => {
      socket.emit('webrtc_ready', { session_id });
    });

    socket.on('webrtc_offer', async ({ sdp }) => {
      try {
        console.log('Offer received, building answer...');
        buildPC(); // fresh PC for this offer
        await RTC.pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await RTC.pc.createAnswer();
        await RTC.pc.setLocalDescription(answer);
        socket.emit('webrtc_answer', { session_id, sdp: RTC.pc.localDescription });
        console.log('Answer sent');
      } catch(e) { console.error('Answer error:', e); }
    });

    // Signal ready to trigger teacher's offer
    socket.emit('webrtc_ready', { session_id });
  }

  // ── ICE (both sides) ──────────────────────
  // Buffer candidates that arrive before remote description is set
  const iceBuf = [];
  socket.on('webrtc_ice', async ({ candidate }) => {
    try {
      if (RTC.pc?.remoteDescription?.type) {
        await RTC.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        iceBuf.push(candidate);
      }
    } catch(e) { console.warn('ICE error:', e.message); }
  });

  // Flush buffered ICE after remote description is set
  const origSetRemote = RTCPeerConnection.prototype.setRemoteDescription;
  RTCPeerConnection.prototype.setRemoteDescription = async function(...args) {
    await origSetRemote.apply(this, args);
    if (this === RTC.pc && iceBuf.length) {
      for (const c of iceBuf.splice(0)) {
        try { await this.addIceCandidate(new RTCIceCandidate(c)); } catch(e) {}
      }
    }
  };
}

function stopWebRTC() {
  RTC.localStream?.getTracks().forEach(t => t.stop());
  try { RTC.pc?.close(); } catch(e) {}
  RTC.pc = null;
  RTC.localStream = null;
}

window.toggleMic = () => {
  if (!RTC.localStream) return;
  RTC.micOn = !RTC.micOn;
  RTC.localStream.getAudioTracks().forEach(t => { t.enabled = RTC.micOn; });
  document.getElementById('vc-mic')?.classList.toggle('muted', !RTC.micOn);
};

window.toggleCam = () => {
  if (!RTC.localStream) return;
  RTC.camOn = !RTC.camOn;
  RTC.localStream.getVideoTracks().forEach(t => { t.enabled = RTC.camOn; });
  document.getElementById('vc-cam')?.classList.toggle('muted', !RTC.camOn);
  const lv = document.getElementById('video-local');
  if (lv) lv.style.opacity = RTC.camOn ? '1' : '0.3';
};

window.backToDashboard = () => {
  stopWebRTC();
  S.lesson.socket?.disconnect();
  S.lesson = { session_id: null, socket: null, pages: [], currentPageId: null, exercises: {}, responses: {}, notes: '', audioState: {} };
  S.params = {}; // clear stale session params
  const defaultView = S.user.role === 'admin' ? 'admin-curriculum'
    : S.user.role === 'teacher' ? 'teacher-students' : 'student-lessons';
  navigate(defaultView);
};

// Helper
function escHtml(s) {
  if (s === undefined || s === null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
