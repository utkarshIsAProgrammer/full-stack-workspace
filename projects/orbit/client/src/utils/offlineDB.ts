/**
 * offlineDB.ts — Dexie.js IndexedDB database for offline-first support.
 *
 * Provides structured offline storage for all major data types:
 * conversations, messages, communityMessages, posts, notifications, users.
 *
 * Also includes a syncQueue table for offline mutations that need
 * to be replayed when the network is restored.
 *
 * The CacheStorage API (apiCache.ts) continues to serve as a fast
 * response cache; this Dexie layer provides *queryable* offline access
 * so components can filter/search/sort data without hitting the network.
 */

import Dexie, { type EntityTable } from "dexie";
import type {
	Conversation,
	Message,
	CommunityMessage,
	Post,
	Notification,
	User,
} from "../types";

// ── Sync Queue Entry ──────────────────────────────────────────────────────
export interface SyncQueueEntry {
	id?: number; // auto-incremented primary key
	url: string; // the API endpoint to call (e.g. /api/chats/conversations/.../messages)
	method: "POST" | "PUT" | "DELETE";
	body?: string; // JSON-serialised request body
	headers?: Record<string, string>; // extra headers
	createdAt: number; // epoch timestamp
	retryCount: number; // how many times we've tried
	lastError?: string; // last error message
}

// ── Dexie Database ────────────────────────────────────────────────────────
class OrbitDB extends Dexie {
	conversations!: EntityTable<Conversation, "_id">;
	messages!: EntityTable<Message, "_id">;
	communityMessages!: EntityTable<CommunityMessage, "_id">;
	posts!: EntityTable<Post, "_id">;
	notifications!: EntityTable<Notification, "_id">;
	users!: EntityTable<User, "_id">;
	syncQueue!: EntityTable<SyncQueueEntry, "id">;

	constructor() {
		super("OrbitDB");

		this.version(1).stores({
			// Conversations: primary key _id, index on updatedAt for sorting
			conversations: "_id, updatedAt",
			// Messages: primary key _id, index on conversation for filtering by chat,
			//          compound index on conversation+createdAt for chronological order
			messages: "_id, conversation, [conversation+createdAt], createdAt",
			// Community messages: primary key _id, index on community
			communityMessages: "_id, community, [community+createdAt], createdAt",
			// Posts: primary key _id, index on createdAt for feed sorting
			posts: "_id, createdAt, author._id",
			// Notifications: primary key _id, index on recipient+createdAt
			notifications: "_id, recipient, [recipient+createdAt]",
			// Users: primary key _id, index on username for search
			users: "_id, username",
			// Sync queue: auto-increment primary key, index on createdAt
			syncQueue: "++id, createdAt, retryCount",
		});
	}
}

// Singleton — one DB instance for the whole app
export const db = new OrbitDB();

// ── Bulk upsert helpers ──────────────────────────────────────────────────

/** Upsert conversations into local DB. */
export async function cacheConversations(
	convs: Conversation[],
): Promise<void> {
	await db.conversations.bulkPut(convs);
}

/** Upsert messages for a conversation. */
export async function cacheMessages(msgs: Message[]): Promise<void> {
	await db.messages.bulkPut(msgs);
}

/** Upsert a single message (used by real-time socket events). */
export async function cacheSingleMessage(msg: Message): Promise<void> {
	await db.messages.put(msg);
}

/** Upsert community messages. */
export async function cacheCommunityMessages(
	msgs: CommunityMessage[],
): Promise<void> {
	await db.communityMessages.bulkPut(msgs);
}

/** Upsert posts (feed, profile, etc.). */
export async function cachePosts(posts: Post[]): Promise<void> {
	await db.posts.bulkPut(posts);
}

/** Upsert notifications. */
export async function cacheNotifications(
	notifs: Notification[],
): Promise<void> {
	await db.notifications.bulkPut(notifs);
}

/** Upsert user profiles. */
export async function cacheUsers(users: User[]): Promise<void> {
	await db.users.bulkPut(users);
}

// ── Query helpers ─────────────────────────────────────────────────────────

/** Get cached messages for a conversation, newest first. */
export async function getCachedConversationMessages(
	conversationId: string,
	limit = 50,
): Promise<Message[]> {
	return db.messages
		.where({ conversation: conversationId })
		.reverse()
		.limit(limit)
		.toArray();
}

/** Get cached community messages, newest first. */
export async function getCachedCommunityMessages(
	communityId: string,
	limit = 50,
): Promise<CommunityMessage[]> {
	return db.communityMessages
		.where({ community: communityId })
		.reverse()
		.limit(limit)
		.toArray();
}

/** Search cached messages by text content. */
export async function searchCachedMessages(
	conversationId: string,
	query: string,
): Promise<Message[]> {
	const all = await db.messages
		.where({ conversation: conversationId })
		.toArray();
	const lower = query.toLowerCase();
	return all.filter(
		(m) =>
			!m.isDeleted && m.text && m.text.toLowerCase().includes(lower),
	);
}

/** Get cached notifications for a user, newest first. */
export async function getCachedNotifications(
	userId: string,
	limit = 30,
): Promise<Notification[]> {
	if (!userId) {
		// When called without a userId (e.g. from offline fallback),
		// return the most recent notifications across all users.
		return db.notifications
			.orderBy("createdAt")
			.reverse()
			.limit(limit)
			.toArray();
	}
	return db.notifications
		.where({ recipient: userId })
		.reverse()
		.limit(limit)
		.toArray();
}

/** Get cached posts, newest first. */
export async function getCachedPosts(limit = 20): Promise<Post[]> {
	return db.posts.orderBy("createdAt").reverse().limit(limit).toArray();
}

// ── Clear helpers ─────────────────────────────────────────────────────────

/** Clear all cached data (used on logout). */
/**
 * Prune data older than N days to prevent unbounded IndexedDB growth.
 * Uses ISO date string comparison so Dexie sorts lexicographically correctly.
 */
export async function pruneOldData(maxAgeDays = 7): Promise<void> {
	const cutoff = new Date(
		Date.now() - maxAgeDays * 24 * 60 * 60 * 1000,
	).toISOString();
	await Promise.all([
		db.notifications.where("createdAt").below(cutoff).delete(),
	]);
}

/** Clear all cached data (used on logout). */
export async function clearOfflineDB(): Promise<void> {
	await Promise.all([
		db.conversations.clear(),
		db.messages.clear(),
		db.communityMessages.clear(),
		db.posts.clear(),
		db.notifications.clear(),
		db.users.clear(),
		db.syncQueue.clear(),
	]);
}

/** Delete messages for a specific conversation (used on clear chat). */
export async function clearConversationMessages(
	conversationId: string,
): Promise<void> {
	await db.messages
		.where({ conversation: conversationId })
		.delete();
}
