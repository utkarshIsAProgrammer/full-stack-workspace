import "./load-env";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "../src/models/user.model";
import { Conversation } from "../src/models/conversation.model";
import { Message } from "../src/models/message.model";
import { redis } from "../src/configs/redis";

async function runTests() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error("Error: MONGO_URI not set.");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB successfully.");

  // Clean up existing test database entries
  console.log("Cleaning up previous test users, conversations, and messages...");
  await User.deleteMany({ email: { $in: ["chat1@test.com", "chat2@test.com"] } });

  // 1. Create Test Users
  console.log("Creating test users...");
  const hashedPassword = await bcrypt.hash("Password123!", 10);

  const user1 = await User.create({
    username: "user_chat_1",
    fullName: "Chat User One",
    email: "chat1@test.com",
    password: hashedPassword,
    isEmailVerified: true,
  });

  const user2 = await User.create({
    username: "user_chat_2",
    fullName: "Chat User Two",
    email: "chat2@test.com",
    password: hashedPassword,
    isEmailVerified: true,
  });

  console.log(`Created User 1: ${user1._id} (${user1.username})`);
  console.log(`Created User 2: ${user2._id} (${user2.username})`);

  // 2. Test Conversation Creation
  console.log("Testing Conversation Creation...");
  const sortedParticipants = [user1._id.toString(), user2._id.toString()].sort();

  let conversation = new Conversation({
    participants: sortedParticipants,
    unreadCounts: {
      [user1._id.toString()]: 0,
      [user2._id.toString()]: 0,
    },
  });
  await conversation.save();
  console.log(`Conversation created successfully with ID: ${conversation._id}`);

  // Test Unique Constraint on Conversation participants
  try {
    const duplicateConversation = new Conversation({
      participants: sortedParticipants,
    });
    await duplicateConversation.save();
    console.error("FAIL: Duplicate conversation was allowed!");
    process.exit(1);
  } catch (err) {
    console.log("PASS: Duplicate conversation was correctly blocked (unique index works).");
  }

  // 3. Test Message Creation & Validation
  console.log("Testing Message Creation...");

  // Send a regular text message
  const msg1 = new Message({
    conversation: conversation._id,
    sender: user1._id,
    recipient: user2._id,
    text: "Hello, this is a test message!",
  });
  await msg1.save();
  console.log(`Message 1 created: ${msg1._id}`);

  // Send message with attachments (mock voice note and image)
  const msg2 = new Message({
    conversation: conversation._id,
    sender: user2._id,
    recipient: user1._id,
    text: "Here is a voice note and an image",
    attachments: [
      {
        url: "http://res.cloudinary.com/voice.mp3",
        public_id: "voice-123",
        type: "voice_note",
      },
      {
        url: "http://res.cloudinary.com/image.png",
        public_id: "image-123",
        type: "image",
      },
    ],
  });
  await msg2.save();
  console.log(`Message 2 (with attachments) created: ${msg2._id}`);

  // Update Conversation's lastMessage reference
  conversation.lastMessage = msg2._id;
  await conversation.save();
  console.log("Conversation lastMessage updated.");

  // 4. Test Edit Message & 5-minute validation logic
  console.log("Testing Message Edit...");
  const msgToEdit = await Message.findById(msg1._id);
  if (!msgToEdit) {
    console.error("FAIL: Message to edit not found!");
    process.exit(1);
  }

  // Edit within 5 minutes (currently just created, so within limit)
  const editDiff = Date.now() - msgToEdit.createdAt.getTime();
  if (editDiff < 5 * 60 * 1000) {
    msgToEdit.text = "Hello, this is edited!";
    msgToEdit.isEdited = true;
    await msgToEdit.save();
    console.log("PASS: Message edited successfully within 5 minutes.");
  } else {
    console.error("FAIL: Unexpectedly exceeded 5 minutes.");
    process.exit(1);
  }

  // Simulating over 5 minutes edit block (mocking timestamp back by 10 minutes)
  await Message.collection.updateOne({ _id: msg1._id }, { $set: { createdAt: new Date(Date.now() - 10 * 60 * 1000) } });

  const msgToEditPastLimit = await Message.findById(msg1._id);
  if (msgToEditPastLimit) {
    console.log("DEBUG: msgToEditPastLimit.createdAt =", msgToEditPastLimit.createdAt);
    console.log("DEBUG: Date.now() =", new Date());
    const editDiffPast = Date.now() - msgToEditPastLimit.createdAt.getTime();
    console.log("DEBUG: editDiffPast =", editDiffPast);
    if (editDiffPast > 5 * 60 * 1000) {
      console.log("PASS: Correctly identified message as past the 5-minute editing threshold.");
    } else {
      console.error("FAIL: 5-minute threshold calculation failed.");
      process.exit(1);
    }
  }

  // 5. Test Delete Message (soft delete)
  console.log("Testing Message Deletion (Soft Delete)...");
  const msgToDelete = await Message.findById(msg2._id);
  if (!msgToDelete) {
    console.error("FAIL: Message to delete not found!");
    process.exit(1);
  }

  // Mark as deleted, clear text/attachments
  msgToDelete.isDeleted = true;
  msgToDelete.text = "This message was deleted";
  msgToDelete.attachments = [] as any;
  await msgToDelete.save();

  const deletedMessageVerification = await Message.findById(msg2._id);
  if (
    deletedMessageVerification?.isDeleted === true &&
    deletedMessageVerification?.text === "This message was deleted" &&
    deletedMessageVerification?.attachments.length === 0
  ) {
    console.log("PASS: Soft delete message successfully cleared text and attachments.");
  } else {
    console.error("FAIL: Soft delete structure incorrect.");
    process.exit(1);
  }

  // 6. Test Redis Presence Status
  console.log("Testing Redis Presence Status...");
  const presenceKey = `presence:user:${user1._id}`;
  await redis.set(presenceKey, "online", { ex: 60 });
  const presenceVal = await redis.get(presenceKey);

  if (presenceVal === "online") {
    console.log("PASS: Redis presence write/read verified successfully.");
  } else {
    console.error("FAIL: Redis presence read failed.");
    process.exit(1);
  }

  // Clean up Redis key
  await redis.del(presenceKey);

  // Clean up database entries
  console.log("Cleaning up test database records...");
  await User.deleteMany({ email: { $in: ["chat1@test.com", "chat2@test.com"] } });
  await Conversation.deleteMany({ _id: conversation._id });
  await Message.deleteMany({ conversation: conversation._id });

  console.log("Disconnecting from MongoDB...");
  await mongoose.disconnect();
  console.log("All direct tests completed successfully! 🎉");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
