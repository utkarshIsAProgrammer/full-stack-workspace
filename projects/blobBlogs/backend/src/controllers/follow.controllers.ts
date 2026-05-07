import type { Request, Response } from "express";
import { User } from "../models/user.model";
import Follow from "../models/follow.model";

type Params = {
	userId: string;
	following: string;
};

export const toggleFollowPost = async (req: Request<Params>, res: Response) => {
	const follower = req.user?._id;
	const { userId } = req.params;

	try {
		if (!follower) {
			return res
				.status(401)
				.json({ success: false, message: "Unauthorized access!" });
		}

		if (follower.toString() === userId) {
			return res.status(400).json({
				success: false,
				message: "You cannot follow yourself!",
			});
		}

		const user = await User.findById(userId);
		if (!user) {
			return res
				.status(404)
				.json({ success: false, message: "User not found!" });
		}

		const existingFollow = await Follow.findOne({
			follower,
			following: userId,
		});
		if (!existingFollow) {
			const follow = await Follow.create({
				follower,
				following: userId,
			});

			return res.status(201).json({
				success: true,
				message: "User followed successfully!",
				following: true,
				follow,
			});
		}

		await Follow.findByIdAndDelete(existingFollow._id);

		return res.status(200).json({
			success: true,
			message: "User unfollowed successfully!",
			following: false,
		});
	} catch (err: any) {
		console.log(`Error in the toggleFollowPost controller! ${err.message}`);
		res.status(500).json({ message: "Internal Server Error" });
	}
};

export const getFollowers = async (req: Request<Params>, res: Response) => {
	const { userId } = req.params;

	try {
		const followers = await Follow.find({
			following: userId,
		}).populate("follower", "username email");

		res.json({
			success: true,
			count: followers.length,
			followers,
		});
	} catch (err: any) {
		console.log(`Error in the getFollowers controller! ${err.message}`);
		res.status(500).json({ message: "Internal Server Error" });
	}
};

export const getFollowing = async (req: Request<Params>, res: Response) => {
	const { userId } = req.params;

	try {
		const following = await Follow.find({
			follower: userId,
		}).populate("following", "username email");

		res.json({
			success: true,
			count: following.length,
			following,
		});
	} catch (err: any) {
		console.log(`Error in the getFollowing controller! ${err.message}`);
		res.status(500).json({ message: "Internal Server Error" });
	}
};
