import mongoose from "mongoose";
import type { Request, Response } from "express";
import Post from "../models/post.model";
import { createPostSchema, updatePostSchema } from "../schemas/post.schema";
import cloudinary from "../configs/cloudinary";

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

    // fetch post
    const post = await Post.findOne({ _id: postId }).populate(
      "author",
      "username email",
    );

    // check existence
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found!",
      });
    }

    res.status(200).json({
      success: true,
      message: "Post fetched successfully!",
      post,
    });
  } catch (err: any) {
    console.log(`Error in the getPost controller! ${err.message}`);
    res.status(500).json({ message: "Internal server error!" });
  }
};

// get all posts
export const getAllPosts = async (req: Request, res: Response) => {
  try {
    // fetch all posts
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .populate("author", "username email");

    // check empty list (post)
    if (posts.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No posts yet!",
      });
    }

    return res.status(200).json({
      success: true,
      message: "All posts fetched successfully!",
      posts,
    });
  } catch (err: any) {
    console.log(`Error in the getAllPosts controller! ${err.message}`);
    res.status(500).json({ message: "Internal server error!" });
  }
};

// create new post
export const createPost = async (req: Request, res: Response) => {
  const result = createPostSchema.safeParse(req.body);

  try {
    // check validation
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid input!",
        error: result.error.issues,
      });
    }

    // check user auth
    const author = (req as any).user?._id;
    if (!author) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access!",
      });
    }

    // create post object
    const post = new Post({
      ...result.data,
      author,
      image: {
        url: req.file?.path || "",
        public_id: req.file?.filename || "",
      },
    });

    // save post
    await post.save();

    return res.status(201).json({
      success: true,
      message: "Post created successfully!",
      post,
    });
  } catch (err: any) {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Duplicate slug, try different title",
      });
    }

    console.log(`Error in the createPost controller! ${err.message}`);
    res.status(500).json({ message: "Internal server error!" });
  }
};

// update existing post
export const updatePost = async (req: Request<Params>, res: Response) => {
  const { postId } = req.params;
  const userId = (req as any).user?._id;

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

    // normalize form-data values
    const title = req.body.title?.trim();
    const content = req.body.content?.trim();
    const file = req.file;

    // ensure at least one update exists
    const hasText =
      (title && title.length > 0) || (content && content.length > 0);
    const hasImage = !!file;

    if (!hasText && !hasImage) {
      return res.status(400).json({
        success: false,
        message: "At least one of title, content, or image must be provided!",
      });
    }

    // update text fields
    if (title) post.title = title;
    if (content) post.content = content;

    // update image if provided
    if (file) {
      // delete old image from cloudinary
      if (post.image?.public_id) {
        await cloudinary.uploader.destroy(post.image.public_id);
      }

      post.image = {
        url: file.path,
        public_id: (file as any).filename,
      };
    }

    await post.save();

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
  const userId = (req as any).user?._id;

  try {
    // validate id
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID!",
      });
    }

    // check user auth
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

    // verify ownership
    if (post.author.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Forbidden!",
      });
    }

    // delete cloudinary image
    if (post.image?.public_id) {
      await cloudinary.uploader.destroy(post.image.public_id);
    }

    console.log("PUBLIC_ID:", post.image?.public_id);

    // delete post
    await post.deleteOne();

    res.status(200).json({
      success: true,
      message: "Post deleted successfully!",
    });
  } catch (err: any) {
    console.log(`Error in the deletePost controller! ${err.message}`);
    res.status(500).json({ message: "Internal server error!" });
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
        message: "Invalid post Id!",
      });
    }

    // increment share count
    const post = await Post.findByIdAndUpdate(
      postId,
      {
        $inc: { sharesCount: 1 },
      },

      { new: true },
    );
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found!",
      });
    }

    // generate url
    const shareUrl = `${process.env.CLIENT_URL}/post/${post.slug}`;

    res.status(200).json({
      success: true,
      message: "Post shared successfully!",
      shares: post.sharesCount,
      shareUrl,
    });
  } catch (err: any) {
    console.log(`Error in the share post controller! ${err.message}`);
    res.status(500).json({ message: "Internal server error!" });
  }
};
