const db = require('../db/db');

const TYPE_CODES = { farmer: 'FRM', buyer: 'BYR', agent: 'AGT', logistics: 'LOG' };

const STATE_CODES = {
  'Abia':'AB','Adamawa':'AD','Akwa Ibom':'AK','Anambra':'AN','Bauchi':'BC',
  'Bayelsa':'BY','Benue':'BE','Borno':'BO','Cross River':'CR','Delta':'DL',
  'Ebonyi':'EB','Edo':'ED','Ekiti':'EK','Enugu':'EN','Gombe':'GM',
  'Imo':'IM','Jigawa':'JG','Kaduna':'KD','Kano':'KN','Katsina':'KT',
  'Kebbi':'KB','Kogi':'KG','Kwara':'KW','Lagos':'LA','Nasarawa':'NW',
  'Niger':'NI','Ogun':'OG','Ondo':'ON','Osun':'OS','Oyo':'OY',
  'Plateau':'PL','Rivers':'RV','Sokoto':'SK','Taraba':'TR','Yobe':'YB',
  'Zamfara':'ZM','FCT':'FC'
};

function getLgaCode(lga) {
  if (!lga) return 'GEN';
  const words = lga.trim().toUpperCase().split(/[\s\-]+/);
  if (words.length === 1) return words[0].substring(0, 3);
  return words.map(w => w[0]).join('').substring(0, 3);
}

async function generateFarmFlowId(userType, state, lga) {
  const typeCode = TYPE_CODES[userType];
  if (!typeCode) throw new Error(`Invalid user type: ${userType}`);
  const stateCode = STATE_CODES[state] || state.substring(0, 2).toUpperCase();
  const lgaCode = getLgaCode(lga);

  const result = await db.query(
    `INSERT INTO id_counters (user_type, state_code, lga_code, last_number)
     VALUES ($1, $2, $3, 1)
     ON CONFLICT (user_type, state_code, lga_code)
     DO UPDATE SET last_number = id_counters.last_number + 1
     RETURNING last_number`,
    [userType, stateCode, lgaCode]
  );

  const number = result.rows[0].last_number;
  const paddedNumber = String(number).padStart(7, '0');
  return `FF/${typeCode}/NG/${stateCode}/${lgaCode}/${paddedNumber}`;
}

function parseFarmFlowId(farmflowId) {
  const parts = farmflowId.split('/');
  if (parts.length !== 6 || parts[0] !== 'FF') return null;
  return { prefix: parts[0], type: parts[1], country: parts[2], state: parts[3], lga: parts[4], number: parseInt(parts[5]) };
}

module.exports = { generateFarmFlowId, parseFarmFlowId, TYPE_CODES, STATE_CODES };
