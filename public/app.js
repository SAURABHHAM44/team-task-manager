const API = '';
const token = () => localStorage.getItem('token');
const currentUser = () => JSON.parse(localStorage.getItem('user') || '{}');

function authHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token() };
}

async function apiFetch(url, options = {}) {
  const res = await fetch(API + url, { ...options, headers: authHeaders() });
  if (res.status === 401 || res.status === 403) {
    localStorage.clear();
    window.location.href = '/';
    return;
  }
  return res;
}

// ---- STATE ----
let state = {
  page: 'dashboard',
  projects: [],
  currentProject: null,
  tasks: [],
  users: [],
  dashStats: null
};

function logout() {
  localStorage.clear();
  window.location.href = '/';
}

function navigate(page, projectId) {
  state.page = page;
  state.currentProject = projectId || null;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navEl = document.querySelector(`[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');
  render();
}

async function loadUsers() {
  const res = await apiFetch('/api/auth/users');
  state.users = await res.json();
}

async function render() {
  const content = document.getElementById('main-content');
  if (state.page === 'dashboard') await renderDashboard(content);
  else if (state.page === 'projects') await renderProjects(content);
  else if (state.page === 'project-detail') await renderProjectDetail(content);
  else if (state.page === 'my-tasks') await renderMyTasks(content);
}

// ---- DASHBOARD ----
async function renderDashboard(el) {
  el.innerHTML = '<div class="page-header"><h1>📊 Dashboard</h1></div><p style="color:var(--gray)">Loading...</p>';
  const res = await apiFetch('/api/tasks/dashboard');
  const data = await res.json();
  state.dashStats = data;

  const isOverdue = (t) => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done';

  el.innerHTML = `
    <div class="page-header">
      <h1>📊 Dashboard</h1>
      <span style="font-size:13px;color:var(--gray)">Welcome back, ${currentUser().name}!</span>
    </div>
    <div class="stats-grid">
      <div class="stat-card blue"><div class="label">Total Assigned</div><div class="value">${data.stats.total}</div></div>
      <div class="stat-card yellow"><div class="label">In Progress</div><div class="value">${data.stats.in_progress}</div></div>
      <div class="stat-card green"><div class="label">Completed</div><div class="value">${data.stats.done}</div></div>
      <div class="stat-card red"><div class="label">Overdue</div><div class="value">${data.stats.overdue}</div></div>
    </div>

    ${data.overdue.length > 0 ? `
      <div class="card">
        <div class="card-header"><h3>⚠️ Overdue Tasks</h3></div>
        <div class="card-body">
          <div class="tasks-list">
            ${data.overdue.map(t => `
              <div class="task-row priority-${t.priority}">
                <div class="task-title">${t.title}</div>
                <div class="task-meta-row">
                  <span class="badge badge-${t.status}">${t.status.replace('_',' ')}</span>
                  <span class="overdue-tag">⏰ Due ${t.due_date}</span>
                  <span style="font-size:12px;color:var(--gray)">${t.project_name}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>` : ''}

    <div class="card">
      <div class="card-header"><h3>My Tasks</h3></div>
      <div class="card-body">
        ${data.tasks.length === 0 ? `<div class="empty-state"><div class="icon">✅</div><p>No tasks assigned to you yet</p></div>` : `
          <div class="tasks-list">
            ${data.tasks.map(t => `
              <div class="task-row priority-${t.priority}">
                <div class="task-title">${t.title} <span style="font-size:12px;color:var(--gray)">— ${t.project_name}</span></div>
                <div class="task-meta-row">
                  <span class="badge badge-${t.status}">${t.status.replace('_',' ')}</span>
                  <span class="badge badge-${t.priority}">${t.priority}</span>
                  ${t.due_date ? `<span class="${isOverdue(t) ? 'overdue-tag' : ''}" style="font-size:12px;color:var(--gray)">📅 ${t.due_date}</span>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    </div>
  `;
}

// ---- PROJECTS ----
async function renderProjects(el) {
  el.innerHTML = '<p style="color:var(--gray);padding:20px">Loading...</p>';
  const res = await apiFetch('/api/projects');
  state.projects = await res.json();

  el.innerHTML = `
    <div class="page-header">
      <h1>📁 Projects</h1>
      <button class="btn btn-primary btn-sm" onclick="openModal('create-project-modal')">+ New Project</button>
    </div>
    ${state.projects.length === 0 ? `
      <div class="empty-state"><div class="icon">📁</div><p>No projects yet. Create your first project!</p></div>
    ` : `
      <div class="projects-grid">
        ${state.projects.map(p => `
          <div class="project-card" onclick="navigate('project-detail', ${p.id})">
            <h3>${p.name}</h3>
            <p>${p.description || 'No description'}</p>
            <div class="project-meta">
              <div class="meta-item">📋 ${p.task_count} tasks</div>
              <div class="meta-item">👥 ${p.member_count} members</div>
            </div>
          </div>
        `).join('')}
      </div>
    `}
  `;
}

async function createProject() {
  const name = document.getElementById('proj-name').value.trim();
  const description = document.getElementById('proj-desc').value.trim();
  if (!name) return alert('Project name is required');

  const res = await apiFetch('/api/projects', {
    method: 'POST',
    body: JSON.stringify({ name, description })
  });

  if (res.ok) {
    closeModal('create-project-modal');
    document.getElementById('proj-name').value = '';
    document.getElementById('proj-desc').value = '';
    await renderProjects(document.getElementById('main-content'));
  }
}

// ---- PROJECT DETAIL ----
async function renderProjectDetail(el) {
  el.innerHTML = '<p style="color:var(--gray);padding:20px">Loading...</p>';
  await loadUsers();

  const [projRes, taskRes] = await Promise.all([
    apiFetch(`/api/projects/${state.currentProject}`),
    apiFetch(`/api/tasks/project/${state.currentProject}`)
  ]);

  const project = await projRes.json();
  state.tasks = await taskRes.json();
  state.currentProjectData = project;

  const myMembership = project.members?.find(m => m.id === currentUser().id);
  const isProjectAdmin = myMembership?.role === 'admin' || currentUser().role === 'admin';

  el.innerHTML = `
    <div class="page-header">
      <div>
        <button onclick="navigate('projects')" style="background:none;border:none;cursor:pointer;color:var(--gray);font-size:13px;margin-bottom:6px;display:block">← Back to Projects</button>
        <h1>📁 ${project.name}</h1>
        ${project.description ? `<p style="color:var(--gray);font-size:13px;margin-top:4px">${project.description}</p>` : ''}
      </div>
      <div style="display:flex;gap:10px">
        ${isProjectAdmin ? `<button class="btn btn-ghost btn-sm" onclick="openModal('add-member-modal')">+ Add Member</button>` : ''}
        <button class="btn btn-primary btn-sm" onclick="openModal('create-task-modal')">+ New Task</button>
      </div>
    </div>

    <div class="card" style="margin-bottom:20px">
      <div class="card-header"><h3>👥 Team Members</h3></div>
      <div class="card-body" style="display:flex;gap:12px;flex-wrap:wrap">
        ${(project.members || []).map(m => `
          <div style="display:flex;align-items:center;gap:8px;background:var(--light);padding:8px 14px;border-radius:8px">
            <div class="avatar" style="width:28px;height:28px;font-size:12px">${m.name[0].toUpperCase()}</div>
            <div>
              <div style="font-size:13px;font-weight:500">${m.name}</div>
              <div style="font-size:11px;color:var(--gray)">${m.role}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>📋 Tasks (${state.tasks.length})</h3>
        <div style="display:flex;gap:8px">
          <select onchange="filterTasks(this.value)" style="border:1.5px solid var(--border);border-radius:6px;padding:4px 10px;font-size:13px">
            <option value="">All Status</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
          </select>
        </div>
      </div>
      <div class="card-body">
        <div id="tasks-container">
          ${renderTasksList(state.tasks, isProjectAdmin)}
        </div>
      </div>
    </div>
  `;

  // populate select in task modal
  const assignSelect = document.getElementById('task-assigned');
  if (assignSelect) {
    assignSelect.innerHTML = '<option value="">Unassigned</option>' +
      (project.members || []).map(m => `<option value="${m.id}">${m.name}</option>`).join('');
  }

  const addMemberSelect = document.getElementById('add-member-user');
  if (addMemberSelect) {
    const memberIds = (project.members || []).map(m => m.id);
    addMemberSelect.innerHTML = '<option value="">Select user</option>' +
      state.users.filter(u => !memberIds.includes(u.id)).map(u => `<option value="${u.id}">${u.name} (${u.email})</option>`).join('');
  }
}

function renderTasksList(tasks, isAdmin) {
  if (tasks.length === 0) {
    return '<div class="empty-state"><div class="icon">📋</div><p>No tasks yet. Create your first task!</p></div>';
  }
  return `<div class="tasks-list">${tasks.map(t => `
    <div class="task-row priority-${t.priority}" id="task-${t.id}">
      <div style="flex:1">
        <div class="task-title">${t.title}</div>
        ${t.description ? `<div style="font-size:12px;color:var(--gray);margin-top:3px">${t.description}</div>` : ''}
      </div>
      <div class="task-meta-row">
        <select class="status-select" onchange="updateStatus(${t.id}, this.value)">
          <option value="todo" ${t.status==='todo'?'selected':''}>To Do</option>
          <option value="in_progress" ${t.status==='in_progress'?'selected':''}>In Progress</option>
          <option value="review" ${t.status==='review'?'selected':''}>Review</option>
          <option value="done" ${t.status==='done'?'selected':''}>Done</option>
        </select>
        <span class="badge badge-${t.priority}">${t.priority}</span>
        ${t.assigned_name ? `<span style="font-size:12px;color:var(--gray)">👤 ${t.assigned_name}</span>` : ''}
        ${t.due_date ? `<span style="font-size:12px;color:var(--gray)">📅 ${t.due_date}</span>` : ''}
        ${(isAdmin || t.created_by === currentUser().id) ? `<button class="btn btn-danger btn-sm" onclick="deleteTask(${t.id})">🗑</button>` : ''}
      </div>
    </div>
  `).join('')}</div>`;
}

function filterTasks(status) {
  const isAdmin = currentUser().role === 'admin';
  const filtered = status ? state.tasks.filter(t => t.status === status) : state.tasks;
  document.getElementById('tasks-container').innerHTML = renderTasksList(filtered, isAdmin);
}

async function updateStatus(taskId, status) {
  const res = await apiFetch(`/api/tasks/${taskId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
  if (!res.ok) {
    const data = await res.json();
    alert(data.error);
  }
}

async function createTask() {
  const title = document.getElementById('task-title').value.trim();
  const description = document.getElementById('task-desc').value.trim();
  const assigned_to = document.getElementById('task-assigned').value;
  const due_date = document.getElementById('task-due').value;
  const priority = document.getElementById('task-priority').value;

  if (!title) return alert('Task title is required');

  const res = await apiFetch('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({ title, description, project_id: state.currentProject, assigned_to: assigned_to || null, due_date: due_date || null, priority })
  });

  if (res.ok) {
    closeModal('create-task-modal');
    document.getElementById('task-title').value = '';
    document.getElementById('task-desc').value = '';
    document.getElementById('task-due').value = '';
    await renderProjectDetail(document.getElementById('main-content'));
  }
}

async function deleteTask(taskId) {
  if (!confirm('Delete this task?')) return;
  const res = await apiFetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
  if (res.ok) {
    state.tasks = state.tasks.filter(t => t.id !== taskId);
    const isAdmin = currentUser().role === 'admin';
    document.getElementById('tasks-container').innerHTML = renderTasksList(state.tasks, isAdmin);
  }
}

async function addMember() {
  const userId = document.getElementById('add-member-user').value;
  const role = document.getElementById('add-member-role').value;
  if (!userId) return alert('Please select a user');

  const res = await apiFetch(`/api/projects/${state.currentProject}/members`, {
    method: 'POST',
    body: JSON.stringify({ userId: parseInt(userId), role })
  });

  if (res.ok) {
    closeModal('add-member-modal');
    await renderProjectDetail(document.getElementById('main-content'));
  } else {
    const data = await res.json();
    alert(data.error);
  }
}

// ---- MY TASKS ----
async function renderMyTasks(el) {
  el.innerHTML = '<p style="color:var(--gray);padding:20px">Loading...</p>';
  const res = await apiFetch('/api/tasks/dashboard');
  const data = await res.json();

  el.innerHTML = `
    <div class="page-header"><h1>✅ My Tasks</h1></div>
    <div class="tasks-list">
      ${data.tasks.length === 0 ? '<div class="empty-state"><div class="icon">✅</div><p>No tasks assigned to you</p></div>' :
        data.tasks.map(t => `
          <div class="task-row priority-${t.priority}">
            <div style="flex:1">
              <div class="task-title">${t.title}</div>
              <div style="font-size:12px;color:var(--gray);margin-top:3px">${t.project_name}</div>
            </div>
            <div class="task-meta-row">
              <span class="badge badge-${t.status}">${t.status.replace('_',' ')}</span>
              <span class="badge badge-${t.priority}">${t.priority}</span>
              ${t.due_date ? `<span style="font-size:12px;color:var(--gray)">📅 ${t.due_date}</span>` : ''}
            </div>
          </div>
        `).join('')}
    </div>
  `;
}

// ---- MODAL HELPERS ----
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ---- INIT ----
window.addEventListener('DOMContentLoaded', async () => {
  if (!token()) { window.location.href = '/'; return; }

  const user = currentUser();
  document.getElementById('user-name').textContent = user.name;
  document.getElementById('user-role').textContent = user.role;
  document.getElementById('user-avatar').textContent = user.name[0].toUpperCase();

  await loadUsers();
  navigate('dashboard');
});