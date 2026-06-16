// Run once to create the first admin account:
//   node server/createAdmin.js
require('dotenv').config();
const connectDB = require('./config/db');
const User      = require('./models/User');

(async () => {
  await connectDB();

  const existing = await User.findOne({ email: 'admin@innovatetools.com' });
  if (existing) {
    console.log('⚠️  Admin already exists. Email: admin@innovatetools.com');
    process.exit(0);
  }

  await User.create({
    name:     'Admin',
    email:    'admin@innovatetools.com',
    password: 'Admin@123',   // change this after first login
    role:     'admin',
    plan:     'free',
    isBanned: false,
  });

  console.log('✅ Admin created.');
  console.log('   Email:    admin@innovatetools.com');
  console.log('   Password: Admin@123  ← change this!');
  process.exit(0);
})();
