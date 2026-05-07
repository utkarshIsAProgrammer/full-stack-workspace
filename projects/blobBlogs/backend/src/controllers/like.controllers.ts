import type { Request, Response } from "express";
import Post from "../models/post.model";
import Like from "../models/like.model";
import Comment from "../models/comment.model";
import mongoose from "mongoose";

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
			return res
				.status(401)
				.json({ success: false, message: "Unauthorized access!" });
		}

		if (!mongoose.Types.ObjectId.isValid(postId)) {
			return res.status(400).json({
				success: false,
				message: "Invalid post ID!",
			});
		}

		const post = await Post.findById(postId);
		if (!post)
			return res
				.status(404)
				.json({ success: false, message: "Post not found!" });

		const existingLike = await Like.findOne({
			author: author,
			post: postId,
		});

		if (!existingLike) {
			const like = await Like.create({
				author: author,
				post: postId,
			});

			return res.status(201).json({
				success: true,
				message: "Post liked successfully!",
				like,
			});
		} else {
			await Like.findByIdAndDelete(existingLike._id);

			return res.status(200).json({
				success: true,
				message: "Post disliked successfully!",
				liked: false,
			});
		}
	} catch (err: any) {
		console.log(`Error in the togglePostLikes controller! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
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
			return res
				.status(401)
				.json({ success: false, message: "Unauthorized access!" });
		}

		if (!mongoose.Types.ObjectId.isValid(commentId)) {
			return res.status(400).json({
				success: false,
				message: "Invalid Comment ID!",
			});
		}

		const comment = await Comment.findById(commentId);
		if (!comment)
			return res
				.status(404)
				.json({ success: false, message: "Comment not found!" });

		const existingLike = await Like.findOne({
			author: author,
			comment: commentId,
		});

		if (!existingLike) {
			const like = await Like.create({
				author: author,
				comment: commentId,
			});

			return res.status(201).json({
				success: true,
				message: "Comment liked successfully!",
				like,
			});
		} else {
			await Like.findByIdAndDelete(existingLike._id);

			return res.status(200).json({
				success: true,
				message: "Comment disliked successfully!",
				liked: false,
			});
		}
	} catch (err: any) {
		console.log(
			`Error in the toggleCommentLikes controller! ${err.message}`,
		);
		res.status(500).json({ message: "Internal server error!" });
	}
};
