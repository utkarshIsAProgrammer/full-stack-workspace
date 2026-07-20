import mongoose from "mongoose";
import type { Request, Response } from "express";
import Post from "../models/post.model";
import Comment from "../models/comment.model";
import Like from "../models/like.model";
import Repost from "../models/repost.model";
import Save from "../models/saves.model";
import Notification from "../models/notification.model";
import { createPostSchema } from "../schemas/post.schema";
import { updatePostSchema, addViewSchema } from "../schemas/interaction.schema";
import { AppError, BadRequestError, NotFoundError, UnauthorizedError, ForbiddenError, ConflictError } from "../utilities/errors";
import cloudinary from "../configs/cloudinary";
import {
  getCache,
  setCache,
  deleteCache,
  clearFeedCache,
  clearCommentsCache,
  clearSavesCache,
  clearUserPostsCache,
} from "../configs/cache";
import { User } from "../models/user.model";
import { env } from "../configs/env";
import { createNotification, extractMentions } from "../utilities/notification";
import { sanitizePlainText } from "../configs/sanitize";
import { emitPostCreated, emitPostDeleted, emitPostUpdated, emitPostView, emitPostPin, emitPostUnpin, emitPostShare } from "../configs/socket";
import { logger } from "../utilities/logger";
import { addUserStatusToPosts } from "../utilities/postStatus";
import { logInteraction } from "../services/affinityService";
import { invalidateFeedCache } from "../services/feedService";
import { awardXP } from "../services/xpService";
import { progressMission } from "../services/dailyMissionService";

type Params = {
  postId: string;
};

/**
 * Check whether the current user is allowed to view a closeFriends post.
 * The author can always see it. Other users must be on the author's closeFriends list.
 * Unauthenticated requests are always denied.
 */
async function canViewCloseFriendsPost(
  post: any,
  currentUserId: string | undefined,
): Promise<boolean> {
  if (post.visibility !== "closeFriends") return true;
  if (!currentUserId) return false;

  // If the viewer is the author, they can always view
  const authorId = post.author?._id?.toString() || post.author?.toString();
  if (authorId === currentUserId) return true;

  const author = await User.findById(authorId).select("closeFriends").lean();
  if (!author) return false;

  return author.closeFriends?.some(
    (id: any) => id.toString() === currentUserId,
  );
}

// get single post by id
export const getPost = async (req: Request<Params>, res: Response) => {
  const { postId } = req.params;
  const currentUserId = req.user?._id?.toString();

  try {
    // validate id
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      throw new BadRequestError("Invalid ID!");
    }

    // try cache first
    const cacheKey = `post:${postId}`;
    try {
      const cached = await getCache<{ post: any }>(cacheKey);
      if (cached) {
        // Re-attach user status (following state may have changed)
        const postsWithStatus = await addUserStatusToPosts([cached.post], currentUserId);
        return res.status(200).json({
          success: true,
          message: "Post fetched successfully!",
          post: postsWithStatus[0],
        });
      }
    } catch (err: any) {
      logger.error(`Cache error in getPost!`, { error: err.message });
    }

    // fetch post
    let post = await Post.findById(postId)
      .populate("author", "username email fullName profilePic")
      .lean();

    // check existence
    if (!post) {
      throw new NotFoundError("Post not found!");
    }

    // Visibility check: hide closeFriends posts from non-close-friends
    if (!(await canViewCloseFriendsPost(post, currentUserId))) {
      throw new NotFoundError("Post not found!");
    }

    // Add user status
    const postWithStatus = await addUserStatusToPosts([post], currentUserId);
    post = postWithStatus[0];

    // cache the post (without user status — status re-attached on read)
    try {
      await setCache(cacheKey, { post }, 60 * 30); // 30 min — single posts rarely change
    } catch (err: any) {
      logger.error(`Cache set error in getPost!`, { error: err.message });
    }

    return res.status(200).json({
      success: true,
      message: "Post fetched successfully!",
      post,
    });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error(`Error in getPost controller!`, { error: err.message });
    throw new AppError("Internal server error!");
  }
};

// get all posts (supports optional sort parameter: likesCount, createdAt, viewsCount)
export const getAllPosts = async (req: Request, res: Response) => {
  const currentUserId = req.user?._id?.toString();
  try {
    // pagination
    const limit = Number(req.query.limit) || undefined;
    const cursor = req.query.cursor as string;
    const authorId = req.query.author as string;
    const sortField = req.query.sort as string;
    const cacheKey = `posts:${authorId || "all"}:${cursor || "first"}:${limit || "all"}:${currentUserId || "anon"}:sort${sortField || "_id"}`;

    // try cache first
    try {
      const cached = await getCache<{
        posts: any[];
        nextCursor: string | null;
        hasMore: boolean;
        message: string;
        success: boolean;
      }>(cacheKey);
      if (cached) {
        // Re-attach user status (in case following state changed since caching)
        const postsWithStatus = await addUserStatusToPosts(
          cached.posts,
          currentUserId,
        );
        return res.status(200).json({
          ...cached,
          posts: postsWithStatus,
        });
      }
    } catch (err: any) {
      logger.error(`Cache error in getAllPosts!`, { error: err.message });
    }

    // query
    const query: any = {};

    // author filter
    if (authorId && mongoose.Types.ObjectId.isValid(authorId)) {
      query.author = authorId;
    }

    // If viewing user's own profile, show all their posts
    // Otherwise, only show public posts (hide closeFriends-only from non-close-friends)
    if (currentUserId && authorId && currentUserId !== authorId) {
      // Check if viewer is a close friend of the author
      const author = await User.findById(authorId).select("closeFriends").lean();
      const isCloseFriend = author?.closeFriends?.some(
        (id: any) => id.toString() === currentUserId
      );
      if (!isCloseFriend) {
        query.visibility = "public";
      }
    } else if (!authorId) {
      // Global feed: only show public posts — closeFriends posts are hidden
      // unless the viewer is in the author's close friends list (handled below)
      // For the global feed, we only show public posts to keep queries simple
      query.visibility = "public";
    }
    // Own profile: show everything (no filter needed)

    // cursor pagination
    if (cursor) {
      query._id = {
        $lt: cursor,
      };
    }

    // Always cap at 20 max per page
    const actualLimit = Math.min(limit ?? 10, 20);

    // Build sort object (default to _id:-1, support likesCount, viewsCount, createdAt)
    const sortOption: Record<string, -1 | 1> = { _id: -1 };
    if (sortField === "likesCount") {
      sortOption.likesCount = -1;
    } else if (sortField === "viewsCount") {
      sortOption.viewsCount = -1;
    } else if (sortField === "createdAt") {
      sortOption.createdAt = -1;
    }

    // fetch posts
    let posts = await Post.find(query)
      .sort(sortOption)
      .populate("author", "username email fullName profilePic")
      .limit(actualLimit + 1)
      .lean();

    // check more posts
    const hasMore = posts.length > actualLimit;
    if (hasMore) {
      posts.pop();
    }

    // next cursor
    const nextCursor = posts.slice(-1).shift()?._id || null;

    // Add user status to posts
    posts = await addUserStatusToPosts(posts, currentUserId);

    // response data
    const responseData = {
      success: true,
      message: posts.length
        ? "All posts fetched successfully!"
        : "No posts yet!",
      posts,
      nextCursor,
      hasMore,
    };

    // cache with 15s TTL (feed changes frequently)
    try {
      await setCache(cacheKey, {
        success: true,
        message: responseData.message,
        posts: posts,
        nextCursor,
        hasMore,
      }, 15);
    } catch (err: any) {
      logger.error(`Cache set error in getAllPosts!`, { error: err.message });
    }

    return res.status(200).json(responseData);
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error(`Error in getAllPosts controller!`, { error: err.message });
    throw new AppError("Internal server error!");
  }
};

// create new post
export const createPost = async (req: Request, res: Response) => {
  const result = createPostSchema.safeParse(req.body);

  try {
    // validate input
    if (!result.success) {
      throw new BadRequestError(result.error.issues[0]?.message || "Invalid input");
    }

    // auth check
    const author = req.user?._id;

    if (!author) {
      throw new UnauthorizedError("Unauthorized access!");
    }

    // extract hashtags
    const extractHashtags = (text: string): string[] => {
      const hashtagRegex = /#([a-zA-Z0-9_]+)/g;
      const matches = [...text.matchAll(hashtagRegex)];
      const hashtags = matches.map(match => match[1]?.toLowerCase()).filter(Boolean) as string[];
      // Remove duplicates and limit to 10 hashtags
      return [...new Set(hashtags)].slice(0, 10);
    };

    const sanitizedTitle = sanitizePlainText(result.data.title);
    const sanitizedContent = sanitizePlainText(result.data.content);
    const hashtags = extractHashtags(result.data.title + " " + result.data.content);

    // Validate hashtag count
    if (hashtags.length > 10) {
      throw new BadRequestError("Maximum 10 hashtags allowed!");
    }

    // handle multiple images/videos, single image, and video
    const imagesFiles = (req.files as any)?.images || [];
    const imageFile = (req.files as any)?.image || [];
    const videoFile = (req.files as any)?.video?.[0];
    const files = [...imagesFiles, ...imageFile];
    const images = files.map((file) => ({
      url: file.path,
      public_id: (file as any).filename,
      alt: (result.data.title || "").substring(0, 100),
    }));

    // fall back to single file (in case future changes use req.file)
    if (images.length === 0 && req.file) {
      images.push({
        url: req.file.path,
        public_id: (req.file as any).filename,
        alt: (result.data.title || "").substring(0, 100),
      });
    }

    // Handle video upload
    let video = undefined;
    if (videoFile) {
      video = {
        url: videoFile.path,
        public_id: (videoFile as any).filename,
      };
    }

    // create post
    const post = new Post({
      ...result.data,
      title: sanitizedTitle,
      content: sanitizedContent,
      hashtags,
      author,
      visibility: result.data.visibility || "public",

      image: images.length > 0 ? { url: images[0]!.url, public_id: images[0]!.public_id } : null,
      images: images.length > 0 ? images as any : undefined,
      video: video || undefined,
    });

    // save post
    await post.save();

    // handle mentions
    const mentionedUserIds = await extractMentions(result.data.content + " " + result.data.title);
    const notifyRecipients = new Set<string>(mentionedUserIds);
    for (const recipient of notifyRecipients) {
      await createNotification({
        recipient,
        sender: author.toString(),
        type: "mention",
        post: post._id.toString(),
      });
    }

    // invalidate feed cache
    await clearFeedCache();
    await clearUserPostsCache(author.toString());
    // Invalidate personal feed cache so the new post appears immediately
    await invalidateFeedCache(author.toString());

    // populate post with author and user status
    let populatedPost = await Post.findById(post._id)
      .populate("author", "username email fullName profilePic")
      .lean();

    if (populatedPost) {
      const postsWithStatus = await addUserStatusToPosts([populatedPost], req.user?._id?.toString());
      populatedPost = postsWithStatus[0];
      emitPostCreated(populatedPost);
    }

    // Award XP and progress mission (fire-and-forget)
    awardXP(author.toString(), "CREATE_POST").catch(() => {});
    progressMission(author.toString(), "post").catch(() => {});

    return res.status(201).json({
      success: true,
      message: "Post created successfully!",
      post: populatedPost,
    });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;

    // duplicate slug
    if (err.code === 11000) {
      throw new ConflictError("Duplicate slug, try different title!");
    }

    logger.error(`Error in createPost controller!`, { error: err.message });
    throw new AppError("Internal server error!");
  }
};

// update existing post
export const updatePost = async (req: Request<Params>, res: Response) => {
  const { postId } = req.params;

  const userId = req.user?._id;

  try {
    // validate id
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      throw new BadRequestError("Invalid ID!");
    }

    // auth check
    if (!userId) {
      throw new UnauthorizedError("Unauthorized!");
    }

    // find post
    const post = await Post.findById(postId);

    if (!post) {
      throw new NotFoundError("Post not found!");
    }

    // ownership check
    if (post.author.toString() !== userId.toString()) {
      throw new ForbiddenError("Forbidden!");
    }

    // parse and validate body
    const parsed = updatePostSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.issues[0]?.message || "Invalid input");
    }

    const file = req.file;
    const filesObj = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const imagesFiles = filesObj?.images || [];
    const imageFile = filesObj?.image || [];
    const videoFile = filesObj?.video?.[0];
    const allFiles = [...imageFile, ...imagesFiles];

    // ensure update exists
    const hasText = !!parsed.data.title || !!parsed.data.content;
    const hasImage = !!file || allFiles.length > 0;
    const hasVideo = !!videoFile;

    if (!hasText && !hasImage && !hasVideo) {
      throw new BadRequestError("At least one field is required!");
    }

    // Save edit history before updating
    post.editHistory.push({
      title: post.title || "",
      content: post.content || "",
      editedAt: new Date(),
    });
    post.isEdited = true;

    // update title
    if (parsed.data.title) {
      post.title = sanitizePlainText(parsed.data.title);
    }

    // update content
    if (parsed.data.content) {
      post.content = sanitizePlainText(parsed.data.content);
    }

    // --- Image update logic ---
    const hasNewFiles = !!file || allFiles.length > 0;

    // Parse public_ids of existing images the user wants to keep
    const keepImageIds: string[] = req.body.existingImages
      ? (Array.isArray(req.body.existingImages) ? req.body.existingImages : [req.body.existingImages])
      : [];

    if (hasNewFiles || keepImageIds.length > 0) {
      const keepIdsSet = new Set(keepImageIds);

      // Build new images from uploaded files
      const uploadedImages = allFiles.length > 0
        ? allFiles.map((f) => ({
          url: f.path,
          public_id: (f as any).filename,
          alt: (parsed.data.title || "").substring(0, 100),
        }))
        : [];

      // fall back to single file
      if (uploadedImages.length === 0 && file) {
        uploadedImages.push({
          url: file.path,
          public_id: (file as any).filename,
          alt: (parsed.data.title || "").substring(0, 100),
        });
      }

      // Delete from Cloudinary only images the user chose to remove
      const imageDeletions = [];
      for (const oldImg of post.images || []) {
        if (oldImg.public_id && !keepIdsSet.has(oldImg.public_id)) {
          imageDeletions.push(cloudinary.uploader.destroy(oldImg.public_id));
        }
      }
      if (post.image?.public_id && !keepIdsSet.has(post.image.public_id)) {
        imageDeletions.push(cloudinary.uploader.destroy(post.image.public_id));
      }

      await Promise.allSettled(imageDeletions).then(results => {
        results.forEach(result => {
          if (result.status === 'rejected') {
            logger.error("Cloudinary deletion failed for post image update", { error: result.reason });
          }
        });
      });

      // Final images = kept existing images + new uploaded images
      const keptExisting = (post.images || []).filter(
        (img) => img.public_id && keepIdsSet.has(img.public_id),
      );

      const finalImages = [...keptExisting, ...uploadedImages];

      post.images = finalImages as any;
      post.image = finalImages.length > 0
        ? { url: finalImages[0]!.url, public_id: finalImages[0]!.public_id }
        : null;
    }

    // --- Video update logic ---
    if (videoFile) {
      // Delete old video from Cloudinary if it exists
      if (post.video?.public_id) {
        cloudinary.uploader.destroy(post.video.public_id, { resource_type: "video" }).catch((err: any) => {
          logger.error("Cloudinary deletion failed for old video during post update", { error: err?.message });
        });
      }
      // Set new video
      post.video = {
        url: videoFile.path,
        public_id: (videoFile as any).filename,
      };
    }

    // save
    await post.save();

    // invalidate cache
    await deleteCache(`post:${postId}`);
    await clearFeedCache();

    // populate post with author and user status
    let populatedPost = await Post.findById(post._id)
      .populate("author", "username email fullName profilePic")
      .lean();

    if (populatedPost) {
      const postsWithStatus = await addUserStatusToPosts([populatedPost], req.user?._id?.toString());
      populatedPost = postsWithStatus[0];
      emitPostUpdated(populatedPost);
    }

    return res.status(200).json({
      success: true,
      message: "Post updated successfully!",
      post: populatedPost,
    });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error(`Error in updatePost controller!`, { error: err.message });
    throw new AppError("Internal server error!");
  }
};

// delete post
export const deletePost = async (req: Request<Params>, res: Response) => {
  const { postId } = req.params;

  const userId = req.user?._id;

  try {
    // validate id
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      throw new BadRequestError("Invalid ID!");
    }

    // auth check
    if (!userId) {
      throw new UnauthorizedError("Unauthorized!");
    }

    // find post
    const post = await Post.findById(postId);

    if (!post) {
      throw new NotFoundError("Post not found!");
    }

    // ownership check
    if (post.author.toString() !== userId.toString()) {
      throw new ForbiddenError("Forbidden!");
    }

    const comments = await Comment.find({ post: postId }).select("_id").lean();
    const commentIds = comments.map((c) => c._id);

    await Promise.all([
      Comment.deleteMany({ post: postId }),
      Like.deleteMany({
        $or: [{ post: postId }, { comment: { $in: commentIds } }],
      }),
      Repost.deleteMany({ post: postId }),
      Save.deleteMany({ post: postId }),
      Notification.deleteMany({
        $or: [{ post: postId }, { comment: { $in: commentIds } }],
      }),
    ]);

    const mediaDeletions = [];
    if (post.image?.public_id) {
      mediaDeletions.push(cloudinary.uploader.destroy(post.image.public_id));
    }
    if (post.video?.public_id) {
      mediaDeletions.push(cloudinary.uploader.destroy(post.video.public_id, { resource_type: "video" }));
    }
    for (const img of post.images || []) {
      if (img.public_id) {
        mediaDeletions.push(cloudinary.uploader.destroy(img.public_id));
      }
    }

    await Promise.allSettled(mediaDeletions).then(results => {
      results.forEach(result => {
        if (result.status === 'rejected') {
          logger.error("Cloudinary deletion failed for deleted post", { error: result.reason });
        }
      });
    });

    await post.deleteOne();

    await deleteCache(`post:${postId}`);
    await deleteCache(`post:slug:${post.slug}`);
    await clearFeedCache();
    await clearCommentsCache(postId);
    // clear saves caches only for users who saved this post
    const savedBy = await Save.find({ post: postId }).select("user").lean();
    const uniqueUserIds = [...new Set(savedBy.map(s => s.user.toString()))];
    await Promise.all(uniqueUserIds.map((uid: any) => clearSavesCache(uid as string)));
    await clearUserPostsCache(userId.toString());

    emitPostDeleted(postId);

    return res.status(200).json({
      success: true,
      message: "Post deleted successfully!",
    });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error(`Error in deletePost controller!`, { error: err.message });
    throw new AppError("Internal server error!");
  }
};

// share post
export const sharePost = async (req: Request<Params>, res: Response) => {
  const { postId } = req.params;

  try {
    // validate id
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      throw new BadRequestError("Invalid post ID!");
    }

    // increment share count
    const post = await Post.findByIdAndUpdate(
      postId,
      {
        $inc: {
          sharesCount: 1,
        },
      },
      {
        returnDocument: 'after',
      },
    ).select("sharesCount slug");

    // check existence
    if (!post) {
      throw new NotFoundError("Post not found!");
    }

    // Log interaction for feed ranking
    const fullPost = await Post.findById(postId).select("author hashtags").lean();
    if (fullPost && req.user?._id?.toString() !== fullPost.author.toString()) {
      logInteraction(
        req.user?._id?.toString() || "",
        fullPost.author.toString(),
        postId,
        "share",
        fullPost.hashtags || []
      );
    }

    // invalidate cache
    await deleteCache(`post:${postId}`);

    // emit share socket event
    emitPostShare(postId, post.sharesCount);

    // share url
    const shareUrl = `${env.CLIENT_URL}/post/${post.slug}`;

    return res.status(200).json({
      success: true,
      message: "Post shared successfully!",
      shares: post.sharesCount,
      shareUrl,
    });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error(`Error in sharePost controller!`, { error: err.message });
    throw new AppError("Internal server error!");
  }
};

// get post by slug
export const getPostBySlug = async (req: Request<{ slug: string }>, res: Response) => {
  const { slug } = req.params;

  try {
    // cache key
    const cacheKey = `post:slug:${slug}`;

    // get cached post
    try {
      const cachedPost = await getCache(cacheKey);
      if (cachedPost) {
        return res.status(200).json(cachedPost);
      }
    } catch (cacheError: any) {
      logger.error(`Cache error in getPostBySlug controller!`, { error: cacheError.message });
    }

    // fetch post
    const post = await Post.findOne({ slug })
      .populate("author", "username email fullName profilePic")
      .lean();

    // check existence
    if (!post) {
      throw new NotFoundError("Post not found!");
    }

    // Visibility check: hide closeFriends posts from non-close-friends
    const currentUserId = req.user?._id?.toString();
    if (!(await canViewCloseFriendsPost(post, currentUserId))) {
      throw new NotFoundError("Post not found!");
    }

    // response data
    const responseData = {
      success: true,
      message: "Post fetched successfully!",
      post,
    };

    // cache post
    try {
      await setCache(cacheKey, responseData, 60 * 30);
    } catch (cacheError: any) {
      logger.error(`Cache set error in getPostBySlug controller!`, { error: cacheError.message });
    }

    return res.status(200).json(responseData);
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error(`Error in getPostBySlug controller!`, { error: err.message });
    throw new AppError("Internal server error!");
  }
};

export const getPostsByHashtag = async (
  req: Request<{ hashtag: string }>,
  res: Response,
) => {
  try {
    const { hashtag } = req.params;
    const lowerHashtag = hashtag.toLowerCase();

    // pagination
    const limit = Math.min(Number(req.query.limit) || 10, 20);
    const cursor = req.query.cursor as string;

    const query: any = { hashtags: lowerHashtag };

    // Only show public posts in hashtag search (closeFriends posts aren't discoverable by tag)
    query.visibility = "public";

    if (cursor) {
      query._id = { $lt: cursor };
    }

    // get posts by hashtag
    const posts = await Post.find(query)
      .select(
        "title image images likesCount commentsCount repostsCount savesCount createdAt author hashtags",
      )
      .populate("author", "fullName username profilePic")
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = posts.length > limit;
    if (hasMore) {
      posts.pop();
    }

    const nextCursor = posts.slice(-1).shift()?._id || null;

    // Add user status to posts
    const postsWithStatus = await addUserStatusToPosts(posts, req.user?._id?.toString());

    return res.status(200).json({
      success: true,
      count: postsWithStatus.length,
      posts: postsWithStatus,
      nextCursor,
      hasMore,
    });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error(`Error in getPostsByHashtag controller!`, { error: err.message });
    throw new AppError("Internal server error!");
  }
};

// ─── Trending hashtags ────────────────────────────────────────────
// Aggregates most-used hashtags from recent posts
export const getTrendingHashtags = async (req: Request, res: Response) => {
  try {
    const cacheKey = "trending:hashtags";
    try {
      const cached = await getCache<{ hashtags: string[] }>(cacheKey);
      if (cached) {
        return res.status(200).json({
          success: true,
          hashtags: cached.hashtags,
        });
      }
    } catch {
      // cache miss
    }

    // Aggregate hashtags from the last 7 days, sorted by frequency
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const posts = await Post.find(
      { hashtags: { $exists: true, $not: { $size: 0 } }, createdAt: { $gte: sevenDaysAgo } },
      { hashtags: 1 }
    )
      .lean();

    // Count hashtag frequencies
    const freq: Record<string, number> = {};
    for (const post of posts) {
      for (const tag of post.hashtags || []) {
        freq[tag] = (freq[tag] || 0) + 1;
      }
    }

    // Sort by frequency and return top 10
    const sorted = Object.entries(freq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([tag]) => tag);

    await setCache(cacheKey, { hashtags: sorted }, 300); // 5 min cache

    return res.status(200).json({
      success: true,
      hashtags: sorted,
    });
  } catch (err: any) {
    logger.error(`Error in getTrendingHashtags!`, { error: err.message });
    throw new AppError("Internal server error!");
  }
};

// increment post views
export const viewsCount = async (req: Request<Params>, res: Response) => {
  const { postId } = req.params;

  const currentUser = req.user?._id;

  try {
    const parsed = addViewSchema.safeParse({ postId });
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.issues[0]?.message || "Invalid input");
    }

    // fetch minimal fields
    const post = await Post.findById(postId)
      .select("_id author viewsCount")
      .lean();

    // check existence
    if (!post) {
      throw new NotFoundError("Post not found!");
    }

    // ignore self views
    if (currentUser && post.author.toString() === currentUser.toString()) {
      return res.status(200).json({
        success: true,
        message: "Own post view ignored!",
        views: post.viewsCount,
      });
    }

    // increment views
    const updatedPost = await Post.findByIdAndUpdate(
      postId,
      {
        $inc: {
          viewsCount: 1,
        },
      },
      {
        returnDocument: 'after',
      },
    ).select("viewsCount");

    // invalidate cache
    await deleteCache(`post:${postId}`);

    // emit real-time view update
    if (updatedPost?.viewsCount) {
      emitPostView(postId, updatedPost.viewsCount);
    }

    return res.status(200).json({
      success: true,
      message: "View counted successfully!",
      views: updatedPost?.viewsCount,
    });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error(`Error in viewsCount controller!`, { error: err.message });
    throw new AppError("Internal server error!");
  }
};

// pin a post to the current user's profile
export const pinPost = async (req: Request<Params>, res: Response) => {
  const { postId } = req.params;
  const currentUserId = req.user?._id;

  try {
    if (!currentUserId) {
      throw new UnauthorizedError("Unauthorized!");
    }

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      throw new BadRequestError("Invalid post ID!");
    }

    // verify post exists and belongs to user
    const post = await Post.findById(postId).select("author").lean();
    if (!post) {
      throw new NotFoundError("Post not found!");
    }
    if (post.author.toString() !== currentUserId.toString()) {
      throw new BadRequestError("Cannot pin another user's post!");
    }

    const user = await User.findById(currentUserId);
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

    // invalidate caches
    await clearUserPostsCache(currentUserId.toString());
    await clearFeedCache();

    // emit real-time pin event
    emitPostPin(postId, currentUserId.toString());

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

// ─── Poll voting ───────────────────────────────────────────────────
export const votePoll = async (req: Request<Params>, res: Response) => {
  const { postId } = req.params;
  const currentUserId = req.user?._id;
  const { optionIndex } = req.body;

  try {
    if (!currentUserId) throw new UnauthorizedError("Unauthorized!");
    if (!mongoose.Types.ObjectId.isValid(postId)) throw new BadRequestError("Invalid post ID!");
    if (typeof optionIndex !== "number" || optionIndex < 0) throw new BadRequestError("Valid optionIndex is required!");

    const post = await Post.findById(postId);
    if (!post) throw new NotFoundError("Post not found!");
    if (!post.poll) throw new BadRequestError("This post does not have a poll!");

    // Check if poll has expired
    if (post.poll.expiresAt && new Date(post.poll.expiresAt) < new Date()) {
      throw new BadRequestError("Poll has already expired!");
    }

    if (optionIndex >= post.poll.options.length) {
      throw new BadRequestError("Invalid option index!");
    }

    const userIdStr = currentUserId.toString();

    // Check if user already voted on this poll
    let hadPreviousVote = false;
    for (const opt of post.poll.options) {
      const voteIdx = opt.votes.findIndex((v) => v.toString() === userIdStr);
      if (voteIdx > -1) {
        hadPreviousVote = true;
        break;
      }
    }

    // Atomic update: remove previous vote if present, push new vote, and adjust totalVotes
    await Post.updateOne(
      { _id: postId },
      { $pull: { "poll.options.$[].votes": currentUserId } }
    );

    const updatedPost = await Post.findByIdAndUpdate(
      postId,
      {
        $push: { [`poll.options.${optionIndex}.votes`]: currentUserId },
        $inc: { "poll.totalVotes": hadPreviousVote ? 0 : 1 },
      },
      { new: true }
    );

    const finalPost = updatedPost || post;

    // Notify post author if someone voted (skip own poll votes)
    if (finalPost.author.toString() !== userIdStr && !hadPreviousVote) {
      await createNotification({
        recipient: finalPost.author.toString(),
        sender: userIdStr,
        type: "poll_vote",
        post: postId,
      });
    }

    await deleteCache(`post:${postId}`);

    // Return the updated poll state
    return res.status(200).json({
      success: true,
      message: "Vote recorded!",
      poll: finalPost.poll,
    });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error(`Error in votePoll controller!`, { error: err.message });
    throw new AppError("Internal server error!");
  }
};

// ─── Collab invitations ────────────────────────────────────────────
export const inviteCollab = async (req: Request<Params>, res: Response) => {
  const { postId } = req.params;
  const currentUserId = req.user?._id;
  const { collaboratorId } = req.body;

  try {
    if (!currentUserId) throw new UnauthorizedError("Unauthorized!");
    if (!mongoose.Types.ObjectId.isValid(postId)) throw new BadRequestError("Invalid post ID!");
    if (!collaboratorId || !mongoose.Types.ObjectId.isValid(collaboratorId)) {
      throw new BadRequestError("Valid collaborator ID is required!");
    }
    if (collaboratorId.toString() === currentUserId.toString()) {
      throw new BadRequestError("You cannot invite yourself as a collaborator!");
    }

    const post = await Post.findById(postId);
    if (!post) throw new NotFoundError("Post not found!");
    if (post.author.toString() !== currentUserId.toString()) {
      throw new ForbiddenError("Only the post author can invite collaborators!");
    }

    post.collaborator = collaboratorId;
    post.collabAccepted = false;
    await post.save();

    // Notify the collaborator
    await createNotification({
      recipient: collaboratorId,
      sender: currentUserId.toString(),
      type: "collab_invite",
      post: postId,
    });

    await deleteCache(`post:${postId}`);

    return res.status(200).json({
      success: true,
      message: "Collaborator invited!",
      post: await Post.findById(postId).populate("author", "username fullName profilePic").populate("collaborator", "username fullName profilePic").lean(),
    });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error(`Error in inviteCollab controller!`, { error: err.message });
    throw new AppError("Internal server error!");
  }
};

export const acceptCollab = async (req: Request<Params>, res: Response) => {
  const { postId } = req.params;
  const currentUserId = req.user?._id;

  try {
    if (!currentUserId) throw new UnauthorizedError("Unauthorized!");
    if (!mongoose.Types.ObjectId.isValid(postId)) throw new BadRequestError("Invalid post ID!");

    const post = await Post.findById(postId);
    if (!post) throw new NotFoundError("Post not found!");
    if (!post.collaborator || post.collaborator.toString() !== currentUserId.toString()) {
      throw new ForbiddenError("You haven't been invited to collaborate on this post!");
    }
    if (post.collabAccepted) {
      return res.status(200).json({ success: true, message: "Already accepted!", post });
    }

    post.collabAccepted = true;
    await post.save();

    await deleteCache(`post:${postId}`);
    await clearFeedCache();

    const populated = await Post.findById(post._id).populate("author", "username fullName profilePic").populate("collaborator", "username fullName profilePic").lean();

    return res.status(200).json({
      success: true,
      message: "Collaboration accepted!",
      post: populated,
    });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error(`Error in acceptCollab controller!`, { error: err.message });
    throw new AppError("Internal server error!");
  }
};

// ─── Post scheduling / draft publishing ────────────────────────────
export const publishDraft = async (req: Request<Params>, res: Response) => {
  const { postId } = req.params;
  const currentUserId = req.user?._id;

  try {
    if (!currentUserId) throw new UnauthorizedError("Unauthorized!");
    if (!mongoose.Types.ObjectId.isValid(postId)) throw new BadRequestError("Invalid post ID!");

    const post = await Post.findById(postId);
    if (!post) throw new NotFoundError("Post not found!");
    if (post.author.toString() !== currentUserId.toString()) {
      throw new ForbiddenError("Only the author can publish this post!");
    }
    if (post.status === "published") {
      return res.status(200).json({ success: true, message: "Post is already published!" });
    }

    post.status = "published";
    post.scheduledAt = null;
    await post.save();

    await deleteCache(`post:${postId}`);
    await clearFeedCache();

    const populated = await Post.findById(post._id).populate("author", "username fullName profilePic").lean();

    if (populated) {
      const postsWithStatus = await addUserStatusToPosts([populated], currentUserId.toString());
      emitPostCreated(postsWithStatus[0]);
    }

    return res.status(200).json({ success: true, message: "Post published!", post: populated });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error(`Error in publishDraft controller!`, { error: err.message });
    throw new AppError("Internal server error!");
  }
};

// ─── Quote Repost (create a repost with commentary) ────────────────────
// Creates a new Post with `isQuoteRepost: true` and `quoteContent`,
// then creates a Repost document linking back to the original post.
export const quoteRepost = async (req: Request<Params>, res: Response) => {
  const { postId } = req.params;
  const currentUserId = req.user?._id;
  const { quoteContent } = req.body;

  try {
    if (!currentUserId) throw new UnauthorizedError("Unauthorized!");
    if (!mongoose.Types.ObjectId.isValid(postId)) throw new BadRequestError("Invalid post ID!");
    if (!quoteContent || typeof quoteContent !== "string" || !quoteContent.trim()) {
      throw new BadRequestError("Quote content is required!");
    }

    // Verify original post exists
    const originalPost = await Post.findById(postId).select("_id author").lean();
    if (!originalPost) throw new NotFoundError("Original post not found!");

    // Create a new post as the quote repost
    const sanitizedContent = sanitizePlainText(quoteContent.trim()).slice(0, 1000);

    const newPost = new Post({
      content: sanitizedContent,
      author: currentUserId,
      isQuoteRepost: true,
      quoteContent: sanitizedContent,
      status: "published",
      hashtags: [],
    });
    await newPost.save();

    // Also create a Repost document to track the repost
    await Repost.create({ user: currentUserId, post: postId });

    // Increment repost count on the original post
    await Post.findByIdAndUpdate(postId, { $inc: { repostsCount: 1 } });

    // Notify the original post author (if not reposting own post)
    if (originalPost.author.toString() !== currentUserId.toString()) {
      await createNotification({
        recipient: originalPost.author.toString(),
        sender: currentUserId.toString(),
        type: "repost",
        post: postId,
      });
    }

    // Log interaction for feed ranking
    const fullOriginal = await Post.findById(postId).select("author hashtags").lean();
    if (fullOriginal && currentUserId.toString() !== fullOriginal.author.toString()) {
      logInteraction(
        currentUserId.toString(),
        fullOriginal.author.toString(),
        postId,
        "share",
        fullOriginal.hashtags || []
      );
    }

    await clearFeedCache();
    await clearUserPostsCache(currentUserId.toString());

    // Return the newly created quote-repost post
    const populated = await Post.findById(newPost._id)
      .populate("author", "username email fullName profilePic")
      .lean();

    return res.status(201).json({
      success: true,
      message: "Quote repost created!",
      post: populated,
    });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error(`Error in quoteRepost controller!`, { error: err.message });
    throw new AppError("Internal server error!");
  }
};

// unpin a post from the current user's profile
export const unpinPost = async (req: Request<Params>, res: Response) => {
  const { postId } = req.params;
  const currentUserId = req.user?._id;

  try {
    if (!currentUserId) {
      throw new UnauthorizedError("Unauthorized!");
    }

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      throw new BadRequestError("Invalid post ID!");
    }

    const user = await User.findById(currentUserId);
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

    // invalidate caches
    await clearUserPostsCache(currentUserId.toString());
    await clearFeedCache();

    // emit real-time unpin event
    emitPostUnpin(postId, currentUserId.toString());

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
