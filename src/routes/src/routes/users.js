const express = require('express');
const router = express.Router();
const db = require('../db/db');
const { requireAuth, logActivity } = require('../middleware/auth');
const { generateFarmFlowId } = require('../utils/idGenerator');

router.post('/register', requireAuth, async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { userType, fullName, phoneNumber, nin, country, countryCode, state, stateCode, lga, villageTown, fullAddress, bankName, accountNumber, accountName, farmLocation, farmSize, produceTypes, vehicleType, vehiclePlate, vehicleCapacityBags, coverageArea, coverageLga, coverageState } = req.body;
    if (!userType || !fullName || !phoneNumber || !country || !state) {
      return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }
    const validTypes = ['farmer', 'buyer', 'agent', 'logistics'];
    if (!validTypes.includes(userType)) {
      return res.status(400).json({ success: false, message: 'Invalid user type.' });
    }
    const dupCheck = await client.query('SELECT farmflow_id FROM users WHERE phone_number = $1', [phoneNumber]);
    if (dupCheck.rows.length) {
      return res.status(409).json({ success: false, message: `Phone already registered. ID: ${dupCheck.rows[0].farmflow_id}` });
    }
    const farmflowId = await generateFarmFlowId(userType, country, state);
    const userResult = await client.query(`INSERT INTO users (farmflow_id, user_type, full_name, phone_number, nin, country, country_code, state, state_code, lga, village_town, full_address, bank_name, account_number, account_name, registered_by_admin_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id, farmflow_id, registered_at`, [farmflowId, userType, fullName, phoneNumber, nin||null, country, countryCode||country.substring(0,2).toUpperCase(), state, stateCode||state.substring(0,3).toUpperCase(), lga||null, villageTown||null, fullAddress||null, bankName||null, accountNumber||null, accountName||null, req.admin.id]);
    const newUser = userResult.rows[0];
    if (userType === 'farmer') await client.query('INSERT INTO farmer_details (user_id, farm_location, farm_size, produce_types) VALUES ($1,$2,$3,$4)', [newUser.id, farmLocation||null, farmSize||null, produceTypes||null]);
    if (userType === 'logistics') await client.query('INSERT INTO logistics_details (user_id, vehicle_type, vehicle_plate, vehicle_capacity_bags, coverage_area) VALUES ($1,$2,$3,$4,$5)', [newUser.id, vehicleType||null, vehiclePlate||null, vehicleCapacityBags||null, coverageArea||null]);
    if (userType === 'agent') await client.query('INSERT INTO agent_details (user_id, coverage_lga, coverage_state) VALUES ($1,$2,$3)', [newUser.id, coverageLga||null, coverageState||null]);
    await client.query('COMMIT');
    await logActivity(req.admin.id, 'REGISTER_USER', newUser.id, farmflowId, `Registered ${userType}: ${fullName}`, req.ip);
    res.status(201).json({ success: true, message: `${userType} registered successfully.`, farmflowId, userId: newUser.id, registeredAt: newUser.registered_at });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  } finally { client.release(); }
});

router.get('/stats/dashboard', requireAuth, async (req, res) => {
  try {
    const stats = await db.query(`SELECT COUNT(*) FILTER (WHERE user_type = 'farmer') as total_farmers, COUNT(*) FILTER (WHERE user_type = 'buyer') as total_buyers, COUNT(*) FILTER (WHERE user_type = 'agent') as total_agents, COUNT(*) FILTER (WHERE user_type = 'logistics') as total_logistics, COUNT(*) as total_users FROM users`);
    res.json({ success: true, stats: stats.rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

router.get('/search', requireAuth, async (req, res) => {
  try {
    const { farmflowId, name, phone, userType, status, page = 1, limit = 20 } = req.query;
    let conditions = [], params = [], i = 1;
    if (farmflowId) { conditions.push(`u.farmflow_id ILIKE $${i++}`); params.push(`%${farmflowId}%`); }
    if (name) { conditions.push(`u.full_name ILIKE $${i++}`); params.push(`%${name}%`); }
    if (phone) { conditions.push(`u.phone_number ILIKE $${i++}`); params.push(`%${phone}%`); }
    if (userType) { conditions.push(`u.user_type = $${i++}`); params.push(userType); }
    if (status) { conditions.push(`u.status = $${i++}`); params.push(status); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page)-1)*parseInt(li
