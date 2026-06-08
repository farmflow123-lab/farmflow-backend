const db = require('../db/db');

const TYPE_CODES = { farmer: 'FRM', buyer: 'BYR', agent: 'AGT', logistics: 'LOG', admin: 'ADM' };

const COUNTRY_CODES = { 'Nigeria': 'NG', 'India': 'IN', 'Ghana': 'GH', 'Kenya': 'KE', 'Tanzania': 'TZ', 'Uganda': 'UG', 'Ethiopia': 'ET', 'United States': 'US', 'United Kingdom': 'UK' };

const STATE_CODES = { 'Katsina': 'KST', 'Kaduna': 'KDN', 'Kano': 'KNO', 'Sokoto': 'SKT', 'Zamfara': 'ZMF', 'Kebbi': 'KBI', 'Niger': 'NGR', 'Jigawa': 'JGW', 'Bauchi': 'BCH', 'Gombe': 'GMB', 'Yobe': 'YBE', 'Borno': 'BRN', 'Adamawa': 'ADM', 'Taraba': 'TRB', 'Plateau': 'PLT', 'Nasarawa': 'NSR', 'Benue': 'BNU', 'Kwara': 'KWR', 'Kogi': 'KGI', 'FCT Abuja': 'FCT', 'Lagos': 'LGS', 'Ogun': 'OGN', 'Oyo': 'OYO', 'Osun': 'OSN', 'Ondo': 'OND', 'Ekiti': 'EKT', 'Rivers': 'RVR', 'Delta': 'DLT', 'Edo': 'EDO', 'Cross River': 'CRV', 'Akwa Ibom': 'AKI', 'Anambra': 'ANM', 'Enugu': 'ENG', 'Ebonyi': 'EBN', 'Imo': 'IMO', 'Abia': 'ABI' };

async function generateFarmFlowId(userType, country, state) {
  const typeCode = TYPE_CODES[userType];
  if (!typeCode) throw new Error(`Invalid user type: ${userType}`);
  const countryCode = COUNTRY_CODES[country] || country.substring(0, 2).toUpperCase();
  const stateCode = STATE_CODES[state] || state.substring(0, 3).toUpperCase();
  const result = await db.query(`INSERT INTO id_counters (user_type, country_code, state_code, last_number) VALUES ($1, $2, $3, 1) ON CONFLICT (user_type, country_code, state_code) DO UPDATE SET last_number = id_counters.last_number + 1 RETURNING last_number`, [typeCode, countryCode, stateCode]);
  const number = result.rows[0].last_number;
  const paddedNumber = String(number).padStart(10, '0');
  return `FF-${typeCode}-${countryCode}-${stateCode}-${paddedNumber}`;
}

function parseFarmFlowId(farmflowId) {
  const parts = farmflowId.split('-');
  if (parts.length !== 5 || parts[0] !== 'FF') return null;
  return { prefix: parts[0], type: parts[1], country: parts[2], state: parts[3], number: parseInt(parts[4]) };
}

module.exports = { generateFarmFlowId, parseFarmFlowId, TYPE_CODES, COUNTRY_CODES, STATE_CODES };
