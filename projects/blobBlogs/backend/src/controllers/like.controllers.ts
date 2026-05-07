import type { Request, Response } from "express";
import mongoose from "mongoose";

import Post from "../models/post.model";
import Comment from "../models/comment.model";
import Like from "../models/like.model";

type Params = {
	postId: string;
};

type CommentParams = {
	commentId: string;
};

export const togglePostLikes = async (req: Request<Params>, res: Response) => {
	const author = req.user?._id;
	const { postId } = req.params;

	try {
		if (!author) {
			return res.status(401).json({
				success: false,
				message: "Unauthorized access!",
			});
		}

		if (!mongoose.Types.ObjectId.isValid(postId)) {
			return res.status(400).json({
				success: false,
				message: "Invalid post ID!",
			});
		}

		const post = await Post.findById(postId);

		if (!post) {
			return res.status(404).json({
				success: false,
				message: "Post not found!",
			});
		}

		const existingLike = await Like.findOne({
			author,
			post: postId,
		});

		if (!existingLike) {
			const like = await Like.create({
				author,
				post: postId,
			});

			const likesCount = await Like.countDocuments({
				post: postId,
			});

			return res.status(201).json({
				success: true,
				message: "Post liked successfully!",
				liked: true,
				likesCount,
				like,
			});
		}

		await existingLike.deleteOne();

		const likesCount = await Like.countDocuments({
			post: postId,
		});

		return res.status(200).json({
			success: true,
			message: "Post disliked successfully!",
			liked: false,
			likesCount,
		});
	} catch (err: any) {
		console.log(`Error in togglePostLikes controller! ${err.message}`);

		return res.status(500).json({
			message: "Internal server error!",
		});
	}
};

export const toggleCommentLikes = async (
	req: Request<CommentParams>,
	res: Response,
) => {
	const author = req.user?._id;
	const { commentId } = req.params;

	try {
		if (!author) {
			return res.status(401).json({
				success: false,
				message: "Unauthorized access!",
			});
		}

		if (!mongoose.Types.ObjectId.isValid(commentId)) {
			return res.status(400).json({
				success: false,
				message: "Invalid comment ID!",
			});
		}

		const comment = await Comment.findById(commentId);

		if (!comment) {
			return res.status(404).json({
				success: false,
				message: "Comment not found!",
			});
		}

		const existingLike = await Like.findOne({
			author,
			comment: commentId,
		});

		if (!existingLike) {
			const like = await Like.create({
				author,
				comment: commentId,
			});

			const likesCount = await Like.countDocuments({
				comment: commentId,
			});

			return res.status(201).json({
				success: true,
				message: "Comment liked successfully!",
				liked: true,
				likesCount,
				like,
			});
		}

		await existingLike.deleteOne();

		const likesCount = await Like.countDocuments({
			comment: commentId,
		});

		return res.status(200).json({
			success: true,
			message: "Comment disliked successfully!",
			liked: false,
			likesCount,
		});
	} catch (err: any) {
		console.log(`Error in toggleCommentLikes controller! ${err.message}`);

		return res.status(500).json({
			message: "Internal server error!",
		});
	}
};

/* export const getPostLikes = async (req: Request<Params>, res: Response) => {
	const author = req.user?._id;
	const { postId } = req.params;

	try {
		if (!mongoose.Types.ObjectId.isValid(postId)) {
			return res.status(400).json({
				success: false,
				message: "Invalid post ID!",
			});
		}

		const likesCount = await Like.countDocuments({
			post: postId,
		});

		const likedByCurrentUser = await Like.exists({
			author,
			post: postId,
		});

		return res.status(200).json({
			success: true,
			likesCount,
			likedByCurrentUser: !!likedByCurrentUser,
		});
	} catch (err: any) {
		console.log(`Error in getPostLikes controller! ${err.message}`);

		return res.status(500).json({
			message: "Internal server error!",
		});
	}
};

export const getCommentLikes = async (
	req: Request<CommentParams>,
	res: Response,
) => {
	const author = req.user?._id;
	const { commentId } = req.params;

	try {
		if (!mongoose.Types.ObjectId.isValid(commentId)) {
			return res.status(400).json({
				success: false,
				message: "Invalid comment ID!",
			});
		}

		const likesCount = await Like.countDocuments({
			comment: commentId,
		});

		const likedByCurrentUser = await Like.exists({
			author,
			comment: commentId,
		});

		return res.status(200).json({
			success: true,
			likesCount,
			likedByCurrentUser: !!likedByCurrentUser,
		});
	} catch (err: any) {
		console.log(`Error in getCommentLikes controller! ${err.message}`);

		return res.status(500).json({
			message: "Internal server error!",
		});
	}
};
 */
