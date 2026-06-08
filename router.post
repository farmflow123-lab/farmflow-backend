const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/db');
const { requireAuth, logActivity } = require('../middleware/auth');

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required.' });
    }
    const result = await db.query(
      'SELECT * FROM admins WHERE username = $1 AND is_active = true',
      [username.toLowerCase().trim()]
    );
    if (!result.rows.length) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }
    const admin = result.rows[0];
    const isValid = await bcrypt.compare(password, admin.password_hash);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }
    await db.query('UPDATE admins SET last_login = NOW() WHERE id = $1', [admin.id]);
    const token = jwt.sign(
      { adminId: admin.id, username: admin.username, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    await logActivity(admin.id, 'LOGIN', null, null, 'Admin logged in', req.ip);
    res.json({ success: true, token, admin: { id: admin.id, username: admin.username, fullName: admin.full_name, role: admin.role } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  res.json({ success: true, admin: req.admin });
});

router.post('/logout', requireAuth, async (req, res) => {
  await logActivity(req.admin.id, 'LOGOUT', null, null, 'Admin logged out', req.ip);
  res.json({ success: true, message: 'Logged out successfully.' });
});

module.exports = router;
