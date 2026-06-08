const jwt = require('jsonwebtoken');
const db = require('../db/db');

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await db.query('SELECT id, username, full_name, role, is_active FROM admins WHERE id = $1', [decoded.adminId]);
    if (!result.rows.length || !result.rows[0].is_active) {
      return res.status(401).json({ success: false, message: 'Account not found or deactivated.' });
    }
    req.admin = result.rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Session expired. Please login again.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
}

function requireSuperAdmin(req, res, next) {
  if (req.admin.role !== 'super_admin') {
    return res.status(403).json({ success: false, message: 'Super Admin access required.' });
  }
  next();
}

async function logActivity(adminId, action, targetUserId = null, targetFarmflowId = null, details = null, ipAddress = null) {
  try {
    await db.query('INSERT INTO admin_logs (admin_id, action, target_user_id, target_farmflow_id, details, ip_address) VALUES ($1,$2,$3,$4,$5,$6)', [adminId, action, targetUserId, targetFarmflowId, details, ipAddress]);
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
}

module.exports = { requireAuth, requireSuperAdmin, logActivity };
