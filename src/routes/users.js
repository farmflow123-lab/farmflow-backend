const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db/db');
const { requireAuth, logActivity } = require('../middleware/auth');
const { generateFarmFlowId } = require('../utils/idGenerator');

router.post('/register', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { userType, fullName, phoneNumber, email, password, state, lga, town, ninNumber, bvnNumber, bankName, bankAccount } = req.body;

    if (!userType || !fullName || !phoneNumber || !password || !state || !lga) {
      return res.status(400).json({ success: false, message: 'Required fields missing' });
    }

    const validTypes = ['farmer', 'buyer', 'logistics', 'agent'];
    if (!validTypes.includes(userType)) {
      return res.status(400).json({ success: false, message: 'Invalid user type' });
    }

    const dupCheck = await client.query(
      'SELECT id FROM users WHERE phone = $1',
      [phoneNumber]
    );
    if (dupCheck.rows.length) {
      return res.status(409).json({ success: false, message: 'Phone already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const farmflowId = await generateFarmFlowId(userType, state, lga);

    const userResult = await client.query(
      `INSERT INTO users (full_name, phone, email, password, role, state, lga, town, nin_number, bvn_number, bank_name, bank_account, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending') RETURNING id`,
      [fullName, phoneNumber, email||null, hashedPassword, userType, state, lga, town||null, ninNumber||null, bvnNumber||null, bankName||null, bankAccount||null]
    );

    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Registration successful! Awaiting approval.', farmflowId, userId: userResult.rows[0].id });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const { role, status, page = 1, limit = 20 } = req.query;
    let conditions = [], params = [], i = 1;
    if (role) { conditions.push(`role = $${i++}`); params.push(role); }
    if (status) { conditions.push(`status = $${i++}`); params.push(status); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page)-1) * parseInt(limit);
    params.push(parseInt(limit), offset);
    const usersResult = await db.query(
      `SELECT id, full_name, phone, email, role, state, lga, status, created_at FROM users ${where} ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i++}`,
      params
    );
    res.json({ success: true, users: usersResult.rows });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error' }); }
});

router.get('/stats', requireAuth, async (req, res) => {
  try {
    const stats = await db.query(`
      SELECT
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE role='farmer') as farmers,
        COUNT(*) FILTER (WHERE role='buyer') as buyers,
        COUNT(*) FILTER (WHERE role='logistics') as logistics,
        COUNT(*) FILTER (WHERE role='agent') as agents,
        COUNT(*) FILTER (WHERE status='pending') as pending
      FROM users
    `);
    res.json({ success: true, stats: stats.rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error' }); }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user: result.rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error' }); }
});

router.patch('/:id/status', requireAuth, async (req, res) => {
  try {
    const { status, reason } = req.body;
    await db.query('UPDATE users SET status = $1 WHERE id = $2', [status, req.params.id]);
    res.json({ success: true, message: `User ${status} successfully` });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error' }); }
});

module.exports = router;
