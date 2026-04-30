const express = require('express');
const { db } = require('../database');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

// create project
router.post('/', requireLogin, (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  const result = db.prepare(
    'INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?)'
  ).run(name, description || '', req.user.id);

  // creator is automatically an admin of the project
  db.prepare(
    'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)'
  ).run(result.lastInsertRowid, req.user.id, 'admin');

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
  res.json(project);
});

// get all projects for logged in user
router.get('/', requireLogin, (req, res) => {
  const projects = db.prepare(`
    SELECT p.*, u.name as owner_name,
    (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
    (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count
    FROM projects p
    JOIN project_members pm ON p.id = pm.project_id
    JOIN users u ON p.owner_id = u.id
    WHERE pm.user_id = ?
    ORDER BY p.created_at DESC
  `).all(req.user.id);

  res.json(projects);
});

// get single project
router.get('/:id', requireLogin, (req, res) => {
  const member = db.prepare(
    'SELECT * FROM project_members WHERE project_id = ? AND user_id = ?'
  ).get(req.params.id, req.user.id);

  if (!member) {
    return res.status(403).json({ error: 'You are not part of this project' });
  }

  const project = db.prepare(`
    SELECT p.*, u.name as owner_name FROM projects p
    JOIN users u ON p.owner_id = u.id
    WHERE p.id = ?
  `).get(req.params.id);

  const members = db.prepare(`
    SELECT u.id, u.name, u.email, pm.role FROM users u
    JOIN project_members pm ON u.id = pm.user_id
    WHERE pm.project_id = ?
  `).all(req.params.id);

  res.json({ ...project, members });
});

// add member to project
router.post('/:id/members', requireLogin, (req, res) => {
  const { userId, role } = req.body;

  const myRole = db.prepare(
    'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?'
  ).get(req.params.id, req.user.id);

  if (!myRole || myRole.role !== 'admin') {
    return res.status(403).json({ error: 'Only project admins can add members' });
  }

  const alreadyIn = db.prepare(
    'SELECT * FROM project_members WHERE project_id = ? AND user_id = ?'
  ).get(req.params.id, userId);

  if (alreadyIn) {
    return res.status(400).json({ error: 'User is already in this project' });
  }

  db.prepare(
    'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)'
  ).run(req.params.id, userId, role || 'member');

  res.json({ message: 'Member added successfully' });
});

// delete project
router.delete('/:id', requireLogin, (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);

  if (!project) return res.status(404).json({ error: 'Project not found' });

  if (project.owner_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only the project owner can delete it' });
  }

  db.prepare('DELETE FROM tasks WHERE project_id = ?').run(req.params.id);
  db.prepare('DELETE FROM project_members WHERE project_id = ?').run(req.params.id);
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);

  res.json({ message: 'Project deleted' });
});

module.exports = router;