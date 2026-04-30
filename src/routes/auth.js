const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../database');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

// signup
router.post('/signup', (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(400).json({ error: 'This email is already registered' });
  }

  const hashed = bcrypt.hashSync(password, 10);
  // first user becomes admin automatically
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();
  const assignedRole = totalUsers.count === 0 ? 'admin' : (role === 'admin' ? 'admin' : 'member');

  const result = db.prepare(
    'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)'
  ).run(name, email, hashed, assignedRole);

  const token = jwt.sign(
    { id: result.lastInsertRowid, email, role: assignedRole, name },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, user: { id: result.lastInsertRowid, name, email, role: assignedRole } });
});

// login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    return res.status(400).json({ error: 'No account found with this email' });
  }

  const passwordOk = bcrypt.compareSync(password, user.password);
  if (!passwordOk) {
    return res.status(400).json({ error: 'Incorrect password' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

// get my profile
router.get('/me', requireLogin, (req, res) => {
  const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

// get all users (for assigning tasks)
router.get('/users', requireLogin, (req, res) => {
  const users = db.prepare('SELECT id, name, email, role FROM users').all();
  res.json(users);
});

module.exports = router;