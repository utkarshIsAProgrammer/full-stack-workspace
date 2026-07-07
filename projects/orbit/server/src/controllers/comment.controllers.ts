import type { Request, Response } from "express";
import mongoose from "mongoose";
import Comment from "../models/comment.model";
import Post from "../models/post.model";
import Like from "../models/like.model";
import Notification from "../models/notification.model";
import {
  addCommentSchema,
  updateCommentSchema,
} from "../schemas/comment.schema";
import { getCache, setCache, clearCommentsCache } from "../configs/cache";
import { createNotification, extractMentions } from "../utilities/notification";
import { sanitizePlainText } from "../configs/sanitize";
import { emitPostComment, emitCommentReply, emitCommentDeleted, emitCommentUpdated } from "../configs/socket";
import { logger } from "../utilities/logger";
import { AppError, BadRequestError, NotFoundError, UnauthorizedError, ForbiddenError } from "../utilities/errors";

type Params = {
  postId: string;
};

type CommentParams = {
  commentId: string;
};

// Get all comments for a specific post (including replies)
export const getAllCommentsForPost = async (req: Request<Params>, res: Response) => {
  const { postId } = req.params;

  try {
    // validate id
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      throw new BadRequestError("Invalid post ID!");
    }

    // cache key
    const cacheKey = `comments:all:${postId}`;

    // get from cache
    try {
      const cachedComments = await getCache(cacheKey);
      if (cachedComments) return res.status(200).json(cachedComments);
    } catch (err: any) {
      logger.error(`Cache error in getAllCommentsForPost!`, { error: err.message });
    }

    // fetch ALL comments for this post (including replies) with author info
    const comments = await Comment.find({ post: postId })
      .sort({ _id: -1 })
      .populate("author", "username email fullName profilePic")
      .lean();

    const responseData = {
      success: true,
      comments,
    };

    // set cache
    try {
      await setCache(cacheKey, responseData);
    } catch (err: any) {
      logger.error(`Cache set error in getAllCommentsForPost!`, { error: err.message });
    }

    return res.status(200).json(responseData);
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error(`Error in getAllCommentsForPost:`, { error: err.message });
    throw new AppError("Internal server error!");
  }
};

// Get all comments for a specific post
export const getComment = async (req: Request<Params>, res: Response) => {
  const { postId } = req.params;

  try {
    // validate id
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      throw new BadRequestError("Invalid post ID!");
    }
    // pagination
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const cursor = req.query.cursor as string;

    // query
    const query: any = {
      post: postId,
      parent: null,
    };

    // if cursor exists fetch older comments
    if (cursor) {
      query._id = { $lt: cursor };
    }

    // cache key
    const cacheKey = `comments:${postId}:${cursor || "first"}:${limit}`;

    // get from cache
    try {
      const cachedComments = await getCache(cacheKey);
      if (cachedComments) return res.status(200).json(cachedComments);
    } catch (err: any) {
      logger.error(`Cache error in getComment!`, { error: err.message });
    }

    // fetch comments with author info
    const comments = await Comment.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate("author", "username email fullName profilePic")
      .lean();

    // check more comments exists
    const hasMore = comments.length > limit;

    // remove extra comments
    if (hasMore) {
      comments.pop();
    }

    // next cursor
    const nextCursor = comments.slice(-1).shift()?._id || null;

    const responseData = {
      success: true,
      comments,
      nextCursor,
      hasMore,
    };

    // set cache
    try {
      await setCache(cacheKey, responseData);
    } catch (err: any) {
      logger.error(`Cache set error in getComment!`, { error: err.message });
    }

    return res.status(200).json(responseData);
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error(`Error in getComment:`, { error: err.message });
    throw new AppError("Internal server error!");
  }
};

// Get all comments
export const getAllComments = async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const cursor = req.query.cursor as string;

    // cache key
    const cacheKey = `comments:all:${cursor || "first"}:${limit}`;
    try {
      const cached = await getCache(cacheKey);
      if (cached) return res.status(200).json(cached);
    } catch (err: any) {
      logger.error(`Cache error in getAllComments!`, { error: err.message });
    }

    const query: any = {};
    if (cursor) {
      query._id = { $lt: cursor };
    }

    const comments = await Comment.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate("author", "username email fullName profilePic")
      .lean();

    const hasMore = comments.length > limit;
    if (hasMore) {
      comments.pop();
    }

    const nextCursor = comments.slice(-1).shift()?._id || null;

    const responseData = {
      success: true,
      comments,
      nextCursor,
      hasMore,
    };

    // set cache (2 min — global comments list is stable)
    try {
      await setCache(cacheKey, responseData, 120);
    } catch (err: any) {
      logger.error(`Cache set error in getAllComments!`, { error: err.message });
    }

    return res.status(200).json(responseData);
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error(`Error in getAllComments:`, { error: err.message });
    throw new AppError("Internal server error!");
  }
};

// Get replies for a specific comment
export const getCommentReplies = async (
  req: Request<CommentParams>,
  res: Response,
) => {
  const { commentId } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      throw new BadRequestError("Invalid comment ID!");
    }

    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const cursor = req.query.cursor as string;

    // cache key
    const cacheKey = `comments:replies:${commentId}:${cursor || "first"}:${limit}`;
    try {
      const cached = await getCache(cacheKey);
      if (cached) return res.status(200).json(cached);
    } catch (err: any) {
      logger.error(`Cache error in getCommentReplies!`, { error: err.message });
    }

    const query: any = { parent: commentId };
    if (cursor) {
      query._id = { $lt: cursor };
    }

    const replies = await Comment.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate("author", "username email fullName profilePic")
      .lean();

    const hasMore = replies.length > limit;
    if (hasMore) {
      replies.pop();
    }

    const nextCursor = replies.slice(-1).shift()?._id || null;

    const responseData = {
      success: true,
      replies,
      nextCursor,
      hasMore,
    };

    // set cache (2 min — replies are stable)
    try {
      await setCache(cacheKey, responseData, 120);
    } catch (err: any) {
      logger.error(`Cache set error in getCommentReplies!`, { error: err.message });
    }

    return res.status(200).json(responseData);
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error(`Error in getCommentReplies:`, { error: err.message });
    throw new AppError("Internal server error!");
  }
};

// create a new comment or reply
export const addComment = async (req: Request<Params>, res: Response) => {
  const result = addCommentSchema.safeParse(req.body);
  const postId = req.params.postId;
  const author = req.user?._id;

  try {
    // check validation result
    if (!result.success) {
      throw new BadRequestError(result.error.issues[0]?.message || "Invalid Data!");
    }

    // check user auth
    if (!author) {
      throw new UnauthorizedError("Unauthorized access!");
    }

    // check for parent comment (is reply)
    const parent = result.data.parent;
    let parentComment: { author: mongoose.Types.ObjectId; post?: mongoose.Types.ObjectId | null } | null = null;
    if (parent) {
      parentComment = await Comment.findById(parent)
        .select("_id author post")
        .lean();

      if (!parentComment) {
        throw new NotFoundError("Parent comment not found!");
      }

      // ensure parent comment belongs to the same post
      if (parentComment.post?.toString() !== postId) {
        throw new BadRequestError("Parent comment does not belong to this post!");
      }
    }

    // ensure post id
    if (!postId)
      throw new BadRequestError("Post ID required");

    const sanitizedContent = sanitizePlainText(result.data.content);

    // save comment
    const comment = new Comment({ ...result.data, content: sanitizedContent, author, post: postId });
    await comment.save();

    // populate comment for socket
    const populatedComment = await Comment.findById(comment._id)
      .populate("author", "username fullName profilePic")
      .lean();

    // increment comments count
    const updatedPost = await Post.findByIdAndUpdate(
      postId,
      { $inc: { commentsCount: 1 } },        { returnDocument: 'after' },
    );
    
    // increment parent comment's replies count if this is a reply
    let updatedParentComment: any = null;
    if (parent) {
      updatedParentComment = await Comment.findByIdAndUpdate(
        parent,
        { $inc: { repliesCount: 1 } },      { returnDocument: 'after' });
    }

    const notifyRecipients = new Set<string>();
    if (updatedPost) {
      notifyRecipients.add(updatedPost.author.toString());
    }
    if (parentComment) {
      notifyRecipients.add(parentComment.author.toString());
    }

    // handle mentions
    const mentionedUserIds = await extractMentions(sanitizedContent);
    mentionedUserIds.forEach(userId => notifyRecipients.add(userId));

    for (const recipient of notifyRecipients) {
      let notificationType: "comment" | "mention" = "comment";
      if (mentionedUserIds.includes(recipient)) {
        notificationType = "mention";
      }
      await createNotification({
        recipient,
        sender: author.toString(),
        type: notificationType,
        post: postId,
        comment: comment._id.toString(),
      });
    }

    // Emit socket event
    if (populatedComment && updatedPost) {
      if (parent && updatedParentComment) {
        emitCommentReply(postId, parent, populatedComment, author.toString(), updatedPost.commentsCount, updatedParentComment.repliesCount);
      } else if (parent) {
        emitCommentReply(postId, parent, populatedComment, author.toString(), updatedPost.commentsCount, 1);
      } else {
        emitPostComment(postId, populatedComment, author.toString(), updatedPost.commentsCount);
      }
    }

    // clear cache
    await clearCommentsCache(postId);

    return res.status(201).json({
      success: true,
      message: "Comment added successfully!",
      comment: populatedComment,
    });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error(`Error in the addComment controller!`, { error: err.message });
    throw new AppError("Internal server error!");
  }
};

// update existing comment
export const updateComment = async (
  req: Request<CommentParams>,
  res: Response,
) => {
  const result = updateCommentSchema.safeParse(req.body);
  const author = req.user?._id;
  const { commentId } = req.params;

  try {
    // check validation result
    if (!result.success) {
      throw new BadRequestError(result.error.issues[0]?.message || "Invalid Data!");
    }

    // check user auth
    if (!author) {
      throw new UnauthorizedError("Unauthorized access!");
    }

    // find comment (exists)
    const comment = await Comment.findById(commentId)
      .select("_id author post")
      .lean();
    if (!comment) {
      throw new NotFoundError("Comment not found!");
    }

    // verify ownership
    if (comment.author.toString() !== author.toString()) {
      throw new ForbiddenError("Forbidden!");
    }

    // update and save with sanitization
    const sanitizedContent = sanitizePlainText(result.data.content);
    await Comment.findByIdAndUpdate(
      commentId,
      { content: sanitizedContent, isEdited: true },
      { returnDocument: 'after', runValidators: true },
    );

    const updatedComment = await Comment.findById(commentId)
      .populate("author", "username fullName profilePic")
      .lean();

    // emit socket event for realtime update
    if (updatedComment) {
      emitCommentUpdated(updatedComment);
    }

    // clear cache
    if (comment.post) await clearCommentsCache(comment.post.toString());

    return res.status(200).json({
      success: true,
      message: "Comment updated successfully!",
      updatedComment,
    });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error(`Error in the updateComment controller!`, { error: err.message });
    throw new AppError("Internal server error!");
  }
};

const collectDescendantCommentIds = async (
  commentId: string,
): Promise<string[]> => {
  const replies = await Comment.find({ parent: commentId })
    .select("_id")
    .lean();
  const ids = [commentId];

  for (const reply of replies) {
    ids.push(...(await collectDescendantCommentIds(reply._id.toString())));
  }

  return ids;
};

// delete comment
export const deleteComment = async (
  req: Request<CommentParams>,
  res: Response,
) => {
  const author = req.user?._id;
  const { commentId } = req.params;

  try {
    // check user auth
    if (!author) {
      throw new UnauthorizedError("Unauthorized access!");
    }

    // find comment (exists)
    const comment = await Comment.findById(commentId);
    if (!comment) {
      throw new NotFoundError("Comment not found!");
    }

    // verify ownership
    if (comment.author.toString() !== author.toString()) {
      throw new ForbiddenError("Forbidden!");
    }

    const commentIds = await collectDescendantCommentIds(commentId);

    await Promise.all([
      Comment.deleteMany({ _id: { $in: commentIds } }),
      Like.deleteMany({ comment: { $in: commentIds } }),
      Notification.deleteMany({ comment: { $in: commentIds } }),
    ]);

    const updatedPost = await Post.findByIdAndUpdate(comment.post, {
      $inc: { commentsCount: -commentIds.length },
    },        { returnDocument: 'after' }
      );
    
    // if this is a reply, decrement parent's repliesCount
    let updatedParentComment: any = null;
    if (comment.parent) {
      updatedParentComment = await Comment.findByIdAndUpdate(
        comment.parent,
        { $inc: { repliesCount: -1 } },      { returnDocument: 'after' });
    }

    // clear cache
    if (comment.post) await clearCommentsCache(comment.post.toString());

    // emit comment deleted event
    if (updatedPost) {
      emitCommentDeleted(comment.post.toString(), commentId, updatedPost.commentsCount);
    }

    return res.status(200).json({
      success: true,
      message: "Comment deleted successfully!",
    });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error(`Error in the deleteComment controller!`, { error: err.message });
    throw new AppError("Internal server error!");
  }
};
