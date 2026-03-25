// Run from the backend/ folder: node utils/seedAdmin.js
require('dotenv').config(); // reads backend/.env automatically

const mongoose = require('mongoose');
const User = require('../models/User');

async function seed() {
  if (!process.env.MONGO_URI) {
    console.error('');
    console.error('❌  MONGO_URI is not set!');
    console.error('    Make sure you created backend/.env with:');
    console.error('    MONGO_URI=mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/medilink?retryWrites=true&w=majority');
    console.error('');
    process.exit(1);
  }

  console.log('🔌 Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected!');

  const existing = await User.findOne({ email: 'admin@medilink.lk' });
  if (existing) {
    console.log('ℹ️  Admin already exists: admin@medilink.lk');
    await mongoose.disconnect();
    process.exit(0);
  }

  await User.create({
    name: 'MediLink Admin',
    email: 'admin@medilink.lk',
    password: 'Admin@123',
    phone: '+94771234567',
    role: 'admin',
    isActive: true,
    isApproved: true,
  });

  console.log('');
  console.log('✅ Admin created successfully!');
  console.log('   Email:    admin@medilink.lk');
  console.log('   Password: Admin@123');
  console.log('');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed error:', err.message);
  process.exit(1);
});
