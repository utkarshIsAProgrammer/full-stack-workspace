// Test the notification API end-to-end with a real user
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
await mongoose.connect(process.env.MONGO_URI);
const db = mongoose.connection.db;
const user = await db.collection('users').findOne({ username: 'test' });
console.log('test user:', user?._id?.toString());
const notifs = await db.collection('notifications').find({ recipient: user._id, isRead: false }).limit(3).toArray();
console.log('unread notifs sample:', notifs.map(n => ({ type: n.type, isRead: n.isRead, createdAt: n.createdAt })));
await mongoose.disconnect();
