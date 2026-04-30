const express = require('express');
const { db } = require('../database');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

// create task
router.post('/', requireLogin, (req, res) => {
  const { title, description, project_id, assigned_to, due_date, priority } = req.body;

  if (!title || !project_id) {
    return res.status(400).json({ error: 'Title and project are required' });
  }

  const member = db.prepare(
    'SELECT * FROM project_members WHERE project_id = ? AND user_id = ?'
  ).get(project_id, req.user.id);

  if (!member) {
    return res.status(403).json({ error: 'You are not part of this project' });
  }

  const result = db.prepare(`
    INSERT INTO tasks (title, description, project_id, assigned_to, created_by, due_date, priority)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(title, description || '', project_id, assigned_to || null, req.user.id, due_date || null, priority || 'medium');

  const task = db.prepare(`
    SELECT t.*, u.name as assigned_name, c.name as creator_name
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    JOIN users c ON t.created_by = c.id
    WHERE t.id = ?
  `).get(result.lastInsertRowid);

  res.json(task);
});

// get tasks for a project
router.get('/project/:projectId', requireLogin, (req, res) => {
  const member = db.prepare(
    'SELECT * FROM project_members WHERE project_id = ? AND user_id = ?'
  ).get(req.params.projectId, req.user.id);

  if (!member) {
    return res.status(403).json({ error: 'You are not part of this project' });
  }

  const tasks = db.prepare(`
    SELECT t.*, u.name as assigned_name, c.name as creator_name
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    JOIN users c ON t.created_by = c.id
    WHERE t.project_id = ?
    ORDER BY t.created_at DESC
  `).all(req.params.projectId);

  res.json(tasks);
});

// get my dashboard tasks
router.get('/dashboard', requireLogin, (req, res) => {
  const myTasks = db.prepare(`
    SELECT t.*, p.name as project_name, u.name as assigned_name
    FROM tasks t
    JOIN projects p ON t.project_id = p.id
    LEFT JOIN users u ON t.assigned_to = u.id
    WHERE t.assigned_to = ?
    ORDER BY t.due_date ASC
  `).all(req.user.id);

  const overdue = myTasks.filter(t => {
    return t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done';
  });

  const stats = {
    total: myTasks.length,
    todo: myTasks.filter(t => t.status === 'todo').length,
    in_progress: myTasks.filter(t => t.status === 'in_progress').length,
    done: myTasks.filter(t => t.status === 'done').length,
    overdue: overdue.length
  };

  res.json({ tasks: myTasks, stats, overdue });
});

// update task status
router.patch('/:id/status', requireLogin, (req, res) => {
  const { status } = req.body;
  const allowed = ['todo', 'in_progress', 'review', 'done'];

  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const member = db.prepare(
    'SELECT * FROM project_members WHERE project_id = ? AND user_id = ?'
  ).get(task.project_id, req.user.id);

  if (!member) return res.status(403).json({ error: 'Not authorized' });

  db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ message: 'Status updated', status });
});

// update full task
router.put('/:id', requireLogin, (req, res) => {
  const { title, description, assigned_to, due_date, priority, status } = req.body;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);

  if (!task) return res.status(404).json({ error: 'Task not found' });

  const member = db.prepare(
    'SELECT * FROM project_members WHERE project_id = ? AND user_id = ?'
  ).get(task.project_id, req.user.id);

  if (!member) return res.status(403).json({ error: 'Not authorized' });

  db.prepare(`
    UPDATE tasks SET title=?, description=?, assigned_to=?, due_date=?, priority=?, status=?
    WHERE id=?
  `).run(
    title || task.title,
    description || task.description,
    assigned_to || task.assigned_to,
    due_date || task.due_date,
    priority || task.priority,
    status || task.status,
    req.params.id
  );

  res.json({ message: 'Task updated' });
});

// delete task
router.delete('/:id', requireLogin, (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const member = db.prepare(
    'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?'
  ).get(task.project_id, req.user.id);

  if (!member) return res.status(403).json({ error: 'Not authorized' });

  // only admin or creator can delete
  if (member.role !== 'admin' && task.created_by !== req.user.id) {
    return res.status(403).json({ error: 'Only admins or the task creator can delete tasks' });
  }

  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ message: 'Task deleted' });
});

module.exports = router;