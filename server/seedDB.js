require('dotenv').config();
const connectDB = require('./config/db');
const Tool     = require('./models/Tool');
const tools    = require('./seeds/tools');

(async () => {
  try {
    await connectDB();
    await Tool.deleteMany({});
    const inserted = await Tool.insertMany(tools);
    console.log(`✅ Seeded ${inserted.length} tools successfully.`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
})();
