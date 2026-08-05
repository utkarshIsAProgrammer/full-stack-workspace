import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
await mongoose.connect(process.env.MONGO_URI);
const db = mongoose.connection.db;
const total = await db.collection('notifications').countDocuments();
console.log('TOTAL notifications:', total);
const users = await db.collection('users').find({}).limit(5).toArray();
for (const u of users) {
  const unread = await db.collection('notifications').countDocuments({ recipient: u._id, isRead: false });
  const all = await db.collection('notifications').countDocuments({ recipient: u._id });
  console.log(u.username, 'unread:', unread, 'all:', all);
}
// sample a few
const samples = await db.collection('notifications').find({}).limit(5).toArray();
samples.forEach(n => console.log('  notif:', n.type, 'recipient:', n.recipient?.toString().slice(0,8), 'isRead:', n.isRead));
await mongoose.disconnect();
