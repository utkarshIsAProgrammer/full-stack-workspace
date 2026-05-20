import mongoose from "mongoose";
import type { Request, Response } from "express";
import Post from "../models/post.model";
import Comment from "../models/comment.model";
import Like from "../models/like.model";
import Repost from "../models/repost.model";
import Save from "../models/saves.model";
import Notification from "../models/notification.model";
import { createPostSchema } from "../schemas/post.schema";
import cloudinary from "../configs/cloudinary";
import {
  getCache,
  setCache,
  deleteCache,
  clearFeedCache,
  clearCommentsCache,
  clearAllSavesCache,
} from "../configs/cache";

type Params = {
  postId: string;
};

// get single post by id
export const getPost = async (req: Request<Params>, res: Response) => {
  const { postId } = req.params;

  try {
    // validate id
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID!",
      });
    }

    // cache key
    const cacheKey = `post:${postId}`;

    // get cached post
    try {
      const cachedPost = await getCache(cacheKey);

      if (cachedPost) {
        return res.status(200).json(cachedPost);
      }
    } catch (cacheError: any) {
      console.log(`Cache error in getPost controller! ${cacheError.message}`);
    }

    // fetch post
    const post = await Post.findById(postId)
      .populate("author", "username email")
      .lean();

    // check existence
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found!",
      });
    }

    // response data
    const responseData = {
      success: true,
      message: "Post fetched successfully!",
      post,
    };

    // cache post
    try {
      await setCache(cacheKey, responseData, 60 * 5);
    } catch (cacheError: any) {
      console.log(
        `Cache set error in getPost controller! ${cacheError.message}`,
      );
    }

    return res.status(200).json(responseData);
  } catch (err: any) {
    console.log(`Error in getPost controller! ${err.message}`);

    return res.status(500).json({
      message: "Internal server error!",
    });
  }
};

// get all posts
export const getAllPosts = async (req: Request, res: Response) => {
  try {
    // pagination
    const limit = Math.min(Number(req.query.limit) || 10, 20);

    const cursor = req.query.cursor as string;

    // query
    const query: any = {};

    // cursor pagination
    if (cursor) {
      query._id = {
        $lt: cursor,
      };
    }

    // cache key
    const cacheKey = `posts:${cursor || "first"}:${limit}`;

    // get cached posts
    try {
      const cachedPosts = await getCache(cacheKey);

      if (cachedPosts) {
        return res.status(200).json(cachedPosts);
      }
    } catch (cacheError: any) {
      console.log(
        `Cache error in getAllPosts controller! ${cacheError.message}`,
      );
    }

    // fetch posts
    const posts = await Post.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate("author", "username email")
      .lean();

    // check more posts
    const hasMore = posts.length > limit;

    // remove extra post
    if (hasMore) {
      posts.pop();
    }

    // next cursor
    const nextCursor = posts[posts.length - 1]?._id || null;

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

    // cache posts
    try {
      await setCache(cacheKey, responseData, 60);
    } catch (cacheError: any) {
      console.log(
        `Cache set error in getAllPosts controller! ${cacheError.message}`,
      );
    }

    return res.status(200).json(responseData);
  } catch (err: any) {
    console.log(`Error in getAllPosts controller! ${err.message}`);

    return res.status(500).json({
      message: "Internal server error!",
    });
  }
};

// create new post
export const createPost = async (req: Request, res: Response) => {
  const result = createPostSchema.safeParse(req.body);

  try {
    // validate input
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid input!",
        error: result.error.issues,
      });
    }

    // auth check
    const author = req.user?._id;

    if (!author) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access!",
      });
    }

    // create post
    const post = new Post({
      ...result.data,
      author,

      image: req.file
        ? {
            url: req.file.path,
            public_id: (req.file as any).filename,
          }
        : undefined,
    });

    // save post
    await post.save();

    // invalidate feed cache
    await clearFeedCache();

    return res.status(201).json({
      success: true,
      message: "Post created successfully!",
      post,
    });
  } catch (err: any) {
    // duplicate slug
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Duplicate slug, try different title!",
      });
    }

    console.log(`Error in createPost controller! ${err.message}`);

    return res.status(500).json({
      message: "Internal server error!",
    });
  }
};

// update existing post
export const updatePost = async (req: Request<Params>, res: Response) => {
  const { postId } = req.params;

  const userId = req.user?._id;

  try {
    // validate id
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID!",
      });
    }

    // auth check
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized!",
      });
    }

    // find post
    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found!",
      });
    }

    // ownership check
    if (post.author.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Forbidden!",
      });
    }

    // normalize input
    const title = req.body.title?.trim();

    const content = req.body.content?.trim();

    const file = req.file;

    // ensure update exists
    const hasText =
      (title && title.length > 0) || (content && content.length > 0);

    const hasImage = !!file;

    if (!hasText && !hasImage) {
      return res.status(400).json({
        success: false,
        message: "At least one field is required!",
      });
    }

    // update title
    if (title) {
      post.title = title;
    }

    // update content
    if (content) {
      post.content = content;
    }

    // update image
    if (file) {
      // delete old image
      if (post.image?.public_id) {
        await cloudinary.uploader.destroy(post.image.public_id);
      }

      post.image = {
        url: file.path,
        public_id: (file as any).filename,
      };
    }

    // save
    await post.save();

    // invalidate cache
    await deleteCache(`post:${postId}`);
    await clearFeedCache();

    return res.status(200).json({
      success: true,
      message: "Post updated successfully!",
      post,
    });
  } catch (err: any) {
    console.log(`Error in updatePost controller! ${err.message}`);

    return res.status(500).json({
      message: "Internal server error!",
    });
  }
};

// delete post
export const deletePost = async (req: Request<Params>, res: Response) => {
  const { postId } = req.params;

  const userId = req.user?._id;

  try {
    // validate id
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID!",
      });
    }

    // auth check
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized!",
      });
    }

    // find post
    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found!",
      });
    }

    // ownership check
    if (post.author.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Forbidden!",
      });
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

    if (post.image?.public_id) {
      await cloudinary.uploader.destroy(post.image.public_id);
    }

    await post.deleteOne();

    await deleteCache(`post:${postId}`);
    await clearFeedCache();
    await clearCommentsCache(postId);
    await clearAllSavesCache();

    return res.status(200).json({
      success: true,
      message: "Post deleted successfully!",
    });
  } catch (err: any) {
    console.log(`Error in deletePost controller! ${err.message}`);

    return res.status(500).json({
      message: "Internal server error!",
    });
  }
};

// share post
export const sharePost = async (req: Request<Params>, res: Response) => {
  const { postId } = req.params;

  try {
    // validate id
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID!",
      });
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
        new: true,
      },
    ).select("sharesCount slug");

    // check existence
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found!",
      });
    }

    // invalidate cache
    await deleteCache(`post:${postId}`);

    // share url
    const shareUrl = `${process.env.CLIENT_URL}/post/${post.slug}`;

    return res.status(200).json({
      success: true,
      message: "Post shared successfully!",
      shares: post.sharesCount,
      shareUrl,
    });
  } catch (err: any) {
    console.log(`Error in sharePost controller! ${err.message}`);

    return res.status(500).json({
      message: "Internal server error!",
    });
  }
};

// increment post views
export const viewsCount = async (req: Request<Params>, res: Response) => {
  const { postId } = req.params;

  const currentUser = req.user?._id;

  try {
    // validate id
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID!",
      });
    }

    // fetch minimal fields
    const post = await Post.findById(postId)
      .select("_id author viewsCount")
      .lean();

    // check existence
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found!",
      });
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
        new: true,
      },
    ).select("viewsCount");

    // invalidate cache
    await deleteCache(`post:${postId}`);

    return res.status(200).json({
      success: true,
      message: "View counted successfully!",
      views: updatedPost?.viewsCount,
    });
  } catch (err: any) {
    console.log(`Error in viewsCount controller! ${err.message}`);

    return res.status(500).json({
      message: "Internal server error!",
    });
  }
};
