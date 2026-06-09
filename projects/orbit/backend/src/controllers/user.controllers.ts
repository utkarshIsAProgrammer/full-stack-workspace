import type { Request, Response } from "express";
import mongoose from "mongoose";
import { User } from "../models/user.model";
import {
	deleteAccountSchema,
	updateProfileSchema,
} from "../schemas/user.schema";
import cloudinary from "../configs/cloudinary";
import { sendDeletionMail } from "../configs/nodeMailer";
import {
	getCache,
	setCache,
	clearUsersCache,
	clearUserByUsernameCache,
	deleteCache,
	clearUserByIdCache,
	clearFeedCache,

} from "../configs/cache";
import Post from "../models/post.model";
import Comment from "../models/comment.model";
import Like from "../models/like.model";
import Follow from "../models/follow.model";
import Save from "../models/saves.model";
import Repost from "../models/repost.model";
import { Conversation } from "../models/conversation.model";
import { Message } from "../models/message.model";
import { env } from "../configs/env";
import { logger } from "../utilities/logger";
import {
	AppError,
	BadRequestError,
	NotFoundError,
	UnauthorizedError,
	ForbiddenError,
} from "../utilities/errors";
import { emitUserView, emitUserShare } from "../configs/socket";
import { addUserStatusToPosts } from "../utilities/postStatus";

type Params = {
	userId: string;
};

// get user by id
export const getUserById = async (
	req: Request<{ userId: string }>,
	res: Response,
) => {
	const { userId } = req.params;
	const currentUserId = req.user?._id;
	try {
		if (!mongoose.Types.ObjectId.isValid(userId)) {
			throw new BadRequestError("Invalid user id!");
		}

		const cacheKey = `user:${userId}`;
		let user: any = null;

		try {
			const cached = await getCache(cacheKey);
			if (cached) user = cached;
		} catch (e) {}

		if (!user) {
			user = await User.findById(userId)
				.select("-password -otp -otpExpiry")
				.lean();

			if (!user) {
				throw new NotFoundError("User not found!");
			}

			try {
				await setCache(cacheKey, user, 60 * 30);
			} catch (e) {}
		}

		let isFollowing = false;
		if (currentUserId) {
			const existingFollow = await Follow.findOne({
				follower: currentUserId,
				following: userId,
			}).lean();
			isFollowing = !!existingFollow;
		}

		const responseData = {
			success: true,
			message: "User fetched successfully!",
			user: {
				...user,
				followingByMe: isFollowing,
				pinnedPosts: user.pinnedPosts || [],
			},
		};

		return res.status(200).json(responseData);
	} catch (err: any) {
		if (err.statusCode && err.statusCode < 500) throw err;
		logger.error(`Error in getUserById controller!`, {
			error: err.message,
		});
		throw new AppError("Internal server error!");
	}
};

// get all users
export const getAll = async (req: Request, res: Response) => {
	const currentUserId = req.user?._id;
	try {
		// pagination
		const limit = Math.min(Number(req.query.limit) || 20, 50);
		const cursor = req.query.cursor as string;

		// query
		const query: any = {};

		// if cursor exists fetch older user
		if (cursor) {
			query._id = { $lt: cursor };
		}

		// fetch all users
		const users = await User.find(query)
			.select("-password -otp -otpExpiry")
			.sort({ _id: -1 })
			.limit(limit + 1)
			.lean();

		// check more user exits if limit is applied
		const hasMore = users.length > limit;
		if (hasMore) {
			users.pop();
		}

		// check empty list (user)
		if (users.length === 0) {
			return res.status(200).json({
				success: true,
				message: "No users found!",
				users: [],
				nextCursor: null,
				hasMore: false,
			});
		}

		// get following status for each user
		const followingSet = new Set<string>();
		if (currentUserId && users.length > 0) {
			const userIds = users.map((u) => u._id);
			const existingFollows = await Follow.find({
				follower: currentUserId,
				following: { $in: userIds },
			}).lean();

			existingFollows.forEach((follow) => {
				followingSet.add(follow.following.toString());
			});
		}

		// add followingByMe to each user
		const usersWithStatus = users.map((user) => ({
			...user,
			followingByMe: followingSet.has(user._id.toString()),
		}));

		// next cursor
		const nextCursor = hasMore ? users.slice(-1).shift()?._id : null;

		// prepare response
		const responseData = {
			success: true,
			message: "All users fetched successfully!",
			users: usersWithStatus,
			nextCursor,
			hasMore,
		};

		// cache the full user list (60s — users list changes infrequently)
		try {
			await setCache(`users:all:${currentUserId?.toString() || "anon"}:${cursor || "first"}:${limit}`, responseData, 60);
		} catch (err: any) {
			logger.error(`Cache set error in getAll users!`, { error: err.message });
		}

		return res.status(200).json(responseData);
	} catch (err: any) {
		if (err.statusCode && err.statusCode < 500) throw err;
		logger.error(`Error in the getAll users controller!`, {
			error: err.message,
		});
		throw new AppError("Internal server error!");
	}
};

// delete account
export const deleteAccount = async (req: Request, res: Response) => {
	const result = deleteAccountSchema.safeParse(req.body);

	try {
		if (!result.success) {
			throw new BadRequestError(
				result.error.issues[0]?.message || "Invalid Data",
			);
		}

		// get user id from the auth middleware
		const userId = req.user?._id;

		// find user and verify credentials — must match authenticated user
		const user = await User.findById(userId);
		if (!user) {
			throw new NotFoundError("User not found!");
		}

		// enforce that submitted email matches the authenticated user
		if (user.email !== result.data.email) {
			throw new ForbiddenError("Email does not match your account!");
		}

		const isMatch = await user.comparePassword(result.data.password);
		if (!isMatch) {
			throw new BadRequestError("Invalid credentials!");
		}

		// delete profile pic and banner image from cloudinary
		if (user.profilePic?.public_id) {
			try {
				await cloudinary.uploader.destroy(user.profilePic.public_id);
			} catch (e) {
				logger.error("Cloudinary deletion failed", { error: e });
			}
		}
		if (user.bannerImage?.public_id) {
			try {
				await cloudinary.uploader.destroy(user.bannerImage.public_id);
			} catch (e) {
				logger.error("Cloudinary deletion failed", { error: e });
			}
		}

		// handle orphaned cloudinary images from posts
		const userPosts = await Post.find({ author: user._id }).select(
			"image images",
		);
		const imageDeletions = userPosts.flatMap((post) => {
			const promises = [];
			if (post.image?.public_id) {
				promises.push(
					cloudinary.uploader.destroy(post.image.public_id),
				);
			}
			if (post.images && Array.isArray(post.images)) {
				for (const img of post.images) {
					if (img.public_id) {
						promises.push(
							cloudinary.uploader.destroy(img.public_id),
						);
					}
				}
			}
			return promises;
		});

		await Promise.allSettled(imageDeletions).then((results) => {
			results.forEach((result) => {
				if (result.status === "rejected") {
					logger.error("Cloudinary deletion failed for post image", {
						error: result.reason,
					});
				}
			});
		});

		// ── Clean up follow relationships and fix counts on other users ──
		// 1. Users that the deleted user was FOLLOWING → decrement their followersCount
		const usersBeingFollowed = await Follow.find({
			follower: user._id,
		}).select("following");
		if (usersBeingFollowed.length > 0) {
			const followingIds = usersBeingFollowed.map((f) => f.following);
			await User.updateMany(
				{ _id: { $in: followingIds } },
				{ $inc: { followersCount: -1 } },
			);
		}

		// 2. Users who were FOLLOWING the deleted user → decrement their followingCount
		const usersFollowingDeleted = await Follow.find({
			following: user._id,
		}).select("follower");
		if (usersFollowingDeleted.length > 0) {
			const followerIds = usersFollowingDeleted.map((f) => f.follower);
			await User.updateMany(
				{ _id: { $in: followerIds } },
				{ $inc: { followingCount: -1 } },
			);
		}

		// 3. Prevent negative counts (safety clamp)
		await User.updateMany(
			{ followersCount: { $lt: 0 } },
			{ $set: { followersCount: 0 } },
		);
		await User.updateMany(
			{ followingCount: { $lt: 0 } },
			{ $set: { followingCount: 0 } },
		);

		// 4. Update Post counts for deleted interactions
		const userComments = await Comment.aggregate([
			{
				$match: {
					author: user._id,
				},
			},
			{ $group: { _id: "$post", count: { $sum: 1 } } },
		]);
		for (const stat of userComments) {
			await Post.updateOne(
				{ _id: stat._id },
				{ $inc: { commentsCount: -stat.count } },
			);
		}

		const userLikes = await Like.aggregate([
			{
				$match: {
					author: user._id,
					post: { $ne: null },
				},
			},
			{ $group: { _id: "$post", count: { $sum: 1 } } },
		]);
		for (const stat of userLikes) {
			await Post.updateOne(
				{ _id: stat._id },
				{ $inc: { likesCount: -stat.count } },
			);
		}

		const userSaves = await Save.aggregate([
			{ $match: { user: user._id } },
			{ $group: { _id: "$post", count: { $sum: 1 } } },
		]);
		for (const stat of userSaves) {
			await Post.updateOne(
				{ _id: stat._id },
				{ $inc: { savesCount: -stat.count } },
			);
		}

		const userReposts = await Repost.aggregate([
			{ $match: { user: user._id } },
			{ $group: { _id: "$post", count: { $sum: 1 } } },
		]);
		for (const stat of userReposts) {
			await Post.updateOne(
				{ _id: stat._id },
				{ $inc: { repostsCount: -stat.count } },
			);
		}

		// Safety clamp for post counts
		const postNegativeFields = [
			"commentsCount",
			"likesCount",
			"savesCount",
			"repostsCount",
		];
		for (const field of postNegativeFields) {
			await Post.updateMany(
				{ [field]: { $lt: 0 } },
				{ $set: { [field]: 0 } },
			);
		}

		// Delete orphaned data
		await Post.deleteMany({ author: user._id });
		await Comment.deleteMany({ author: user._id });
		await Like.deleteMany({ author: user._id });
		await Save.deleteMany({ user: user._id });
		await Repost.deleteMany({ user: user._id });
		await Follow.deleteMany({
			$or: [{ follower: user._id }, { following: user._id }],
		});

		// Clean up direct chat data (Conversations, Messages, and attachments)
		const userConversations = await Conversation.find({
			participants: user._id,
		});
		const userConversationIds = userConversations.map((c) => c._id);

		if (userConversationIds.length > 0) {
			// Find messages with attachments to delete them from Cloudinary
			const messagesWithAttachments = await Message.find({
				conversation: { $in: userConversationIds },
				"attachments.0": { $exists: true },
			})
				.select("attachments")
				.lean();

			const chatCloudinaryDeletions = messagesWithAttachments.flatMap(
				(msg) =>
					(msg.attachments || [])
						.map((att) => att.public_id)
						.filter(Boolean)
						.map((pubId) => cloudinary.uploader.destroy(pubId)),
			);

			await Promise.allSettled(chatCloudinaryDeletions).then(
				(results) => {
					results.forEach((res) => {
						if (res.status === "rejected") {
							logger.error(
								"Cloudinary deletion failed for chat message attachment",
								{
									error: res.reason,
								},
							);
						}
					});
				},
			);

			// Delete messages and conversations
			await Message.deleteMany({
				conversation: { $in: userConversationIds },
			});
			await Conversation.deleteMany({
				_id: { $in: userConversationIds },
			});
		}

		await User.findByIdAndDelete(user._id);

		// clear users and session cache
		await clearUsersCache();
		await deleteCache(`auth:user:${user._id}`);
		await deleteCache(`presence:user:${user._id}`);
		// Clear all user-related caches
		await deleteCache(`user:${user._id}`);
		await deleteCache(`posts:author:${user._id}`);
		await deleteCache(`saves:user:${user._id}`);
		await deleteCache(`user:username:${user.username}`);

		// send account deletion email
		sendDeletionMail({
			email: user.email,
			username: user.username,
		});

		res.status(200).json({
			success: true,
			message: "Account deleted successfully!",
		});
	} catch (err: any) {
		if (err.statusCode && err.statusCode < 500) throw err;
		logger.error(`Error in the deleteAccount controller!`, {
			error: err.message,
		});
		throw new AppError("Internal server error!");
	}
};

// share profile
export const shareProfile = async (req: Request<Params>, res: Response) => {
	const { userId } = req.params;

	try {
		// validate id
		if (!mongoose.Types.ObjectId.isValid(userId)) {
			throw new BadRequestError("Invalid user id!");
		}

		// increment share count
		const user = await User.findByIdAndUpdate(
			userId,
			{
				$inc: { sharesCount: 1 },
			},
			{ new: true },
		);
		if (!user) {
			throw new NotFoundError("User not found!");
		}

		// emit share socket event
		emitUserShare(userId, user.sharesCount);

		// generate url
		const shareUrl = `${env.CLIENT_URL}/user/${user.username}`;

		res.status(200).json({
			success: true,
			message: "Profile shared successfully!",
			shares: user.sharesCount,
			shareUrl,
		});
	} catch (err: any) {
		if (err.statusCode && err.statusCode < 500) throw err;
		logger.error(`Error in the shareProfile controller!`, {
			error: err.message,
		});
		throw new AppError("Internal server error!");
	}
};

export const viewsCount = async (req: Request<Params>, res: Response) => {
	const { userId } = req.params;
	const currentUser = req.user?._id;

	try {
		// validate post
		if (!mongoose.Types.ObjectId.isValid(userId)) {
			throw new BadRequestError("Invalid user Id!");
		}

		// check post exists
		const profile = await User.findById(userId)
			.select("_id viewsCount")
			.lean();
		if (!profile) {
			throw new NotFoundError("Profile not found!");
		}

		// check self view
		if (currentUser && profile._id.toString() === currentUser.toString()) {
			return res.status(200).json({
				success: true,
				message: "Own profile view ignored!",
				views: profile.viewsCount,
			});
		}

		// increment profile views count
		const updatedProfile = await User.findByIdAndUpdate(
			userId,
			{
				$inc: { viewsCount: 1 },
			},
			{ new: true },
		);

		// emit real-time view update
		if (updatedProfile?.viewsCount) {
			emitUserView(userId, updatedProfile.viewsCount);
		}

		return res.status(200).json({
			success: true,
			message: "View counted successfully!",
			views: updatedProfile?.viewsCount,
		});
	} catch (err: any) {
		if (err.statusCode && err.statusCode < 500) throw err;
		logger.error(`Error in the viewsCount controller!`, {
			error: err.message,
		});
		throw new AppError("Internal server error!");
	}
};

// get user by username
export const getUserByUsername = async (
	req: Request<{ username: string }>,
	res: Response,
) => {
	const { username } = req.params;
	const currentUserId = req.user?._id;
	try {
		const cacheKey = `user:username:${username}`;
		let user: any = null;

		try {
			const cached = await getCache(cacheKey);
			if (cached) user = cached;
		} catch (e) {}

		if (!user) {
			user = await User.findOne({ username })
				.select("-password -otp -otpExpiry")
				.lean();

			if (!user) {
				throw new NotFoundError("User not found!");
			}

			try {
				await setCache(cacheKey, user, 60 * 30);
			} catch (e) {}
		}

		let isFollowing = false;
		if (currentUserId) {
			const existingFollow = await Follow.findOne({
				follower: currentUserId,
				following: user._id,
			}).lean();
			isFollowing = !!existingFollow;
		}

		// sync follow counts from Follow collection (authoritative)
		const [actualFollowers, actualFollowing] = await Promise.all([
			Follow.countDocuments({ following: user._id }),
			Follow.countDocuments({ follower: user._id }),
		]);

		const responseData = {
			success: true,
			message: "User fetched successfully!",
			user: {
				...user,
				followersCount: actualFollowers,
				followingCount: actualFollowing,
				followingByMe: isFollowing,
				pinnedPosts: user.pinnedPosts || [],
			},
		};

		return res.status(200).json(responseData);
	} catch (err: any) {
		if (err.statusCode && err.statusCode < 500) throw err;
		logger.error(`Error in getUserByUsername controller!`, {
			error: err.message,
		});
		throw new AppError("Internal server error!");
	}
};

// get user's posts
export const getUserPosts = async (
	req: Request<{ userId: string }>,
	res: Response,
) => {
	const { userId } = req.params;
	try {
		const limit = Math.min(Number(req.query.limit) || 10, 20);
		const cursor = req.query.cursor as string;
		const cacheKey = `user:${userId}:posts:${cursor || "first"}:${limit}`;
		const currentUserId = req.user?._id?.toString();

		let postsData: any = null;

		try {
			const cached = await getCache(cacheKey);
			if (cached) postsData = cached;
		} catch (err: any) {
			logger.error(`Cache error in getUserPosts!`, {
				error: err.message,
			});
		}

		if (!postsData) {
			if (!mongoose.Types.ObjectId.isValid(userId)) {
				throw new BadRequestError("Invalid user id!");
			}

			const query: any = { author: userId };
			if (cursor) {
				query._id = { $lt: cursor };
			}

			const posts = await Post.find(query)
				.sort({ _id: -1 })
				.limit(limit + 1)
				.populate("author", "username email fullName profilePic")
				.lean();

			const hasMore = posts.length > limit;
			if (hasMore) {
				posts.pop();
			}

			const nextCursor = posts.slice(-1).shift()?._id || null;

			postsData = {
				posts,
				nextCursor,
				hasMore,
			};

			try {
				await setCache(cacheKey, postsData, 60 * 30);
			} catch (err: any) {
				logger.error(`Cache set error in getUserPosts!`, {
					error: err.message,
				});
			}
		}

		// Add user status to posts AFTER cache retrieval
		const postsWithStatus = await addUserStatusToPosts(
			postsData.posts,
			currentUserId,
		);

		const responseData = {
			success: true,
			message: postsWithStatus.length
				? "User posts fetched successfully!"
				: "No posts yet!",
			posts: postsWithStatus,
			nextCursor: postsData.nextCursor,
			hasMore: postsData.hasMore,
		};

		return res.status(200).json(responseData);
	} catch (err: any) {
		if (err.statusCode && err.statusCode < 500) throw err;
		logger.error(`Error in getUserPosts controller!`, {
			error: err.message,
		});
		throw new AppError("Internal server error!");
	}
};

// get suggested users (who to follow)
export const getSuggestedUsers = async (req: Request, res: Response) => {
	const currentUserId = req.user?._id;

	try {
		const limit = Math.min(Number(req.query.limit) || 5, 10);

		if (!currentUserId) {
			throw new UnauthorizedError("Unauthorized!");
		}

		// cache key — suggestions change rarely for a given user
		const cacheKey = `users:suggested:${currentUserId.toString()}:${limit}`;
		try {
			const cached = await getCache(cacheKey);
			if (cached) return res.status(200).json(cached);
		} catch (err: any) {
			logger.error(`Cache error in getSuggestedUsers!`, { error: err.message });
		}

		// get users the current user already follows
		const following = await Follow.find({ follower: currentUserId })
			.select("following")
			.lean();

		const followingIds = following.map((f) => f.following);
		followingIds.push(currentUserId); // exclude self

		// find users with most followers that user doesn't follow
		const suggestedUsers = await User.find({
			_id: { $nin: followingIds },
		})
			.select("_id fullName username profilePic bio followersCount")
			.sort({ followersCount: -1, createdAt: -1 })
			.limit(limit)
			.lean();

		// Add followingByMe to each user (they're all not-followed since filtered above, but this keeps consistency)
		const usersWithStatus = suggestedUsers.map((user) => ({
			...user,
			followingByMe: false,
		}));

		const responseData = {
			success: true,
			users: usersWithStatus,
		};

		// set cache (2 min — suggestions are relatively stable)
		try {
			await setCache(cacheKey, responseData, 120);
		} catch (err: any) {
			logger.error(`Cache set error in getSuggestedUsers!`, { error: err.message });
		}

		return res.status(200).json(responseData);
	} catch (err: any) {
		if (err.statusCode && err.statusCode < 500) throw err;
		logger.error(`Error in getSuggestedUsers controller!`, {
			error: err.message,
		});
		throw new AppError("Internal server error!");
	}
};

// pin a post to profile
export const pinPost = async (req: Request<Params>, res: Response) => {
	const { userId } = req.params;
	const { postId } = req.body;
	const currentUserId = req.user?._id;

	try {
		if (!currentUserId) {
			throw new UnauthorizedError("Unauthorized!");
		}

		// only allow pinning own profile
		if (currentUserId.toString() !== userId) {
			throw new ForbiddenError("Forbidden!");
		}

		if (!mongoose.Types.ObjectId.isValid(postId)) {
			throw new BadRequestError("Invalid post ID!");
		}

		// verify post exists and belongs to user
		const post = await Post.findById(postId).select("author").lean();
		if (!post) {
			throw new NotFoundError("Post not found!");
		}
		if (post.author.toString() !== userId) {
			throw new BadRequestError("Cannot pin another user's post!");
		}

		const user = await User.findById(userId);
		if (!user) {
			throw new NotFoundError("User not found!");
		}

		const pinned = user.pinnedPosts || [];

		// check if already pinned
		if (pinned.some((id) => id.toString() === postId)) {
			throw new BadRequestError("Post already pinned!");
		}

		if (pinned.length >= 3) {
			throw new BadRequestError("Maximum 3 pinned posts allowed!");
		}

		pinned.push(new mongoose.Types.ObjectId(postId));
		user.pinnedPosts = pinned;
		await user.save();

		return res.status(200).json({
			success: true,
			message: "Post pinned successfully!",
			pinnedPosts: user.pinnedPosts,
		});
	} catch (err: any) {
		if (err.statusCode && err.statusCode < 500) throw err;
		logger.error(`Error in pinPost controller!`, { error: err.message });
		throw new AppError("Internal server error!");
	}
};

// unpin a post from profile
export const unpinPost = async (req: Request<Params>, res: Response) => {
	const { userId } = req.params;
	const { postId } = req.body;
	const currentUserId = req.user?._id;

	try {
		if (!currentUserId) {
			throw new UnauthorizedError("Unauthorized!");
		}

		if (currentUserId.toString() !== userId) {
			throw new ForbiddenError("Forbidden!");
		}

		if (!mongoose.Types.ObjectId.isValid(postId)) {
			throw new BadRequestError("Invalid post ID!");
		}

		const user = await User.findById(userId);
		if (!user) {
			throw new NotFoundError("User not found!");
		}

		const pinned = user.pinnedPosts || [];
		const filtered = pinned.filter((id) => id.toString() !== postId);

		if (filtered.length === pinned.length) {
			throw new BadRequestError("Post is not pinned!");
		}

		user.pinnedPosts = filtered;
		await user.save();

		return res.status(200).json({
			success: true,
			message: "Post unpinned successfully!",
			pinnedPosts: user.pinnedPosts,
		});
	} catch (err: any) {
		if (err.statusCode && err.statusCode < 500) throw err;
		logger.error(`Error in unpinPost controller!`, { error: err.message });
		throw new AppError("Internal server error!");
	}
};

// get pinned posts for a user
export const getPinnedPosts = async (req: Request<Params>, res: Response) => {
	const { userId } = req.params;
	const currentUserId = req.user?._id?.toString();

	try {
		if (!mongoose.Types.ObjectId.isValid(userId)) {
			throw new BadRequestError("Invalid user ID!");
		}

		// cache key
		const cacheKey = `user:${userId}:pinned`;
		try {
			const cached = await getCache(cacheKey);
			if (cached) return res.status(200).json(cached);
		} catch (err: any) {
			logger.error(`Cache error in getPinnedPosts!`, { error: err.message });
		}

		const user = await User.findById(userId).select("pinnedPosts").lean();
		if (!user) {
			throw new NotFoundError("User not found!");
		}

		const pinnedIds = user.pinnedPosts || [];
		if (pinnedIds.length === 0) {
			return res.status(200).json({ success: true, posts: [] });
		}

		const posts = await Post.find({ _id: { $in: pinnedIds } })
			.populate("author", "username fullName profilePic")
			.lean();

		const postsWithStatus = await addUserStatusToPosts(
			posts,
			currentUserId,
		);

		// preserve pinned order and add pinnedByMe flag
		const orderedPosts = pinnedIds
			.map((id) =>
				postsWithStatus.find((p) => p._id.toString() === id.toString()),
			)
			.filter(Boolean)
			.map((post) => ({
				...post,
				pinnedByMe: true,
			}));

		const responseData = {
			success: true,
			posts: orderedPosts,
		};

		// set cache (5 min — pinned posts rarely change)
		try {
			await setCache(cacheKey, responseData, 300);
		} catch (err: any) {
			logger.error(`Cache set error in getPinnedPosts!`, { error: err.message });
		}

		return res.status(200).json(responseData);
	} catch (err: any) {
		if (err.statusCode && err.statusCode < 500) throw err;
		logger.error(`Error in getPinnedPosts controller!`, {
			error: err.message,
		});
		throw new AppError("Internal server error!");
	}
};

// update profile
export const updateProfile = async (req: Request, res: Response) => {
	const result = updateProfileSchema.safeParse(req.body);

	const cleanupFiles = async (filesObj: any) => {
		if (!filesObj) return;
		const files = filesObj as { [fieldname: string]: any[] };
		const pPic = files.profilePic?.[0];
		const bImg = files.bannerImage?.[0];

		if (pPic?.filename) {
			try {
				await cloudinary.uploader.destroy(pPic.filename);
			} catch (e) {
				logger.error("Cloudinary deletion failed", { error: e });
			}
		}
		if (bImg?.filename) {
			try {
				await cloudinary.uploader.destroy(bImg.filename);
			} catch (e) {
				logger.error("Cloudinary deletion failed", { error: e });
			}
		}
	};

	try {
		if (!result.success) {
			await cleanupFiles(req.files);
			throw new BadRequestError(
				result.error.issues[0]?.message || "Invalid data",
			);
		}

		const userId = req.user?._id;
		const user = await User.findById(userId);

		if (!user) {
			await cleanupFiles(req.files);
			throw new NotFoundError("User not found!");
		}

		// check if username exists
		if (result.data.username && result.data.username !== user.username) {
			const userExists = await User.findOne({
				username: result.data.username,
			});
			if (userExists) {
				await cleanupFiles(req.files);
				throw new BadRequestError("Username already exists!");
			}
		}

		// Check explicit deletion flags first
		const updateData: any = { ...result.data };
		delete updateData.removeProfilePic;
		delete updateData.removeBannerImage;

		// Remove profile pic
		if (result.data.removeProfilePic) {
			if (user.profilePic?.public_id) {
				try {
					await cloudinary.uploader.destroy(
						user.profilePic.public_id,
					);
				} catch (e) {
					logger.error("Cloudinary deletion failed", { error: e });
				}
			}
			updateData.profilePic = { url: "", public_id: "" };
		}

		// Remove banner image
		if (result.data.removeBannerImage) {
			if (user.bannerImage?.public_id) {
				try {
					await cloudinary.uploader.destroy(
						user.bannerImage.public_id,
					);
				} catch (e) {
					logger.error("Cloudinary deletion failed", { error: e });
				}
			}
			updateData.bannerImage = { url: "", public_id: "" };
		}

		if (req.files) {
			const files = req.files as { [fieldname: string]: any[] };
			const newProfilePic = files.profilePic?.[0];
			const newBannerImg = files.bannerImage?.[0];

			if (newProfilePic) {
				if (user.profilePic?.public_id) {
					try {
						await cloudinary.uploader.destroy(
							user.profilePic.public_id,
						);
					} catch (e) {
						logger.error("Cloudinary deletion failed", {
							error: e,
						});
					}
				}
				updateData.profilePic = {
					url: newProfilePic.path,
					public_id: newProfilePic.filename,
				};
			}

			if (newBannerImg) {
				if (user.bannerImage?.public_id) {
					try {
						await cloudinary.uploader.destroy(
							user.bannerImage.public_id,
						);
					} catch (e) {
						logger.error("Cloudinary deletion failed", {
							error: e,
						});
					}
				}
				updateData.bannerImage = {
					url: newBannerImg.path,
					public_id: newBannerImg.filename,
				};
			}
		}

		const updatedUser = await User.findByIdAndUpdate(user._id, updateData, {
			new: true,
		});

		// update cache
		await clearUsersCache();
		await clearFeedCache();
		await deleteCache(`auth:user:${user._id}`);
		await clearUserByIdCache(user._id.toString());
		if (user.username) {
			await clearUserByUsernameCache(user.username);
		}
		if (updatedUser?.username && updatedUser.username !== user.username) {
			await clearUserByUsernameCache(updatedUser.username);
		}

		return res.status(200).json({
			success: true,
			message: "Profile updated successfully!",
			user: {
				_id: updatedUser?._id,
				fullName: updatedUser?.fullName,
				username: updatedUser?.username,
				email: updatedUser?.email,
				gender: updatedUser?.gender,
				bio: updatedUser?.bio,
				profilePic: updatedUser?.profilePic,
				bannerImage: updatedUser?.bannerImage,
			},
		});
	} catch (err: any) {
		await cleanupFiles(req.files);
		if (err.statusCode && err.statusCode < 500) throw err;
		logger.error(`Error in the updateProfile controller!`, {
			error: err.message,
		});
		throw new AppError("Internal server error!");
	}
};
