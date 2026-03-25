/**
 * MediLink — One-time migration utility
 * 
 * Migrates old Quotation documents that use 'status' field
 * to also have the new 'orderStatus' field.
 *
 * Run ONCE from the backend folder:
 *   node utils/migrateQuotations.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function migrate() {
  if (!process.env.MONGO_URI) {
    console.error('❌ MONGO_URI not set. Create backend/.env first.');
    process.exit(1);
  }

  console.log('🔌 Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected');

  const db = mongoose.connection.db;
  const collection = db.collection('quotations');

  // Find all docs that have 'status' but NOT 'orderStatus'
  const oldDocs = await collection
    .find({ status: { $exists: true }, orderStatus: { $exists: false } })
    .toArray();

  console.log(`📋 Found ${oldDocs.length} old quotation(s) to migrate`);

  if (oldDocs.length === 0) {
    console.log('✅ Nothing to migrate — all documents are up to date');
    await mongoose.disconnect();
    process.exit(0);
  }

  let migrated = 0;
  for (const doc of oldDocs) {
    await collection.updateOne(
      { _id: doc._id },
      { $set: { orderStatus: doc.status } }
    );
    migrated++;
    process.stdout.write(`\r  Migrated ${migrated}/${oldDocs.length}...`);
  }

  console.log(`\n✅ Migration complete — ${migrated} document(s) updated`);
  console.log('   Each document now has both "status" and "orderStatus" fields');

  await mongoose.disconnect();
  process.exit(0);
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
