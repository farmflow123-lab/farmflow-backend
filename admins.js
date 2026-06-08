const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db/db');
const { requireAuth, requireSuperAdmin, logActivity } = require('../middleware/auth');

router.get('/', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT id, username, full_name, role, is_active, created_at, last_login FROM admins ORDER BY created_at');
    res.json({ success: true, admins: result.rows });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

router.post('/', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { username, password, fullName, role = 'customer_care' } = req.body;
    if (!username || !password || !fullName) return res.status(400).json({ success: false, message: 'All fields required.' });
    if (password.length < 8) return res.status(400).json({ success: false, message: 'Password min 8 chars.' });
    const hash = await bcrypt.hash(password, 12);
    const result = await db.query('INSERT INTO admins (username, password_hash, full_name, role) VALUES ($1,$2,$3,$4) RETURNING id, username, full_name, role, created_at', [username.toLowerCase().trim(), hash, fullName, role]);
    await logActivity(req.admin.id, 'CREATE_ADMIN', null, null, `Created admin: ${username}`, req.ip);
    res.status(201).json({ success: true, admin: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, message: 'Username exists.' });
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.patch('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ success: false, message: 'Both passwords required.' });
    const result = await db.query('SELECT password_hash FROM admins WHERE id = $1', [req.admin.id]);
    const isValid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!isValid) return res.status(401).json({ success: false, message: 'Current password incorrect.' });
    const newHash = await bcrypt.hash(newPassword, 12);
    await db.query('UPDATE admins SET password_hash = $1 WHERE id = $2', [newHash, req.admin.id]);
    res.json({ success: true, message: 'Password changed.' });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

router.get('/logs', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page)-1)*parseInt(limit);
    const result = await db.query('SELECT l.*, a.username as admin_username FROM admin_logs l LEFT JOIN admins a ON a.id = l.admin_id ORDER BY l.created_at DESC LIMIT $1 OFFSET $2', [parseInt(limit), offset]);
    res.json({ success: true, logs: result.rows });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

module.exports = router;
