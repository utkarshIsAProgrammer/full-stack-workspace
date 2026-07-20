import Post from "../models/post.model";
import { User } from "../models/user.model";

export async function getLeaderboard(type: "weekly" | "monthly" | "alltime", limit: number = 20) {
  const dateFilter: Record<string, Date | undefined> = {};
  const now = new Date();
  if (type === "weekly") dateFilter.$gte = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  else if (type === "monthly") dateFilter.$gte = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const match: any = { status: "published" };
  if (dateFilter.$gte) match.createdAt = dateFilter;

  // Top posts by engagement
  const topPosts = await Post.aggregate([
    { $match: match },
    { $addFields: { engagementScore: { $add: ["$likesCount", { $multiply: ["$commentsCount", 4] }, { $multiply: ["$savesCount", 3] }, { $multiply: ["$sharesCount", 5] }] } } },
    { $sort: { engagementScore: -1 } },
    { $limit: limit },
    { $lookup: { from: "users", localField: "author", foreignField: "_id", as: "author" } },
    { $unwind: "$author" },
    { $project: { title: 1, slug: 1, engagementScore: 1, likesCount: 1, commentsCount: 1, "author._id": 1, "author.username": 1, "author.fullName": 1, "author.profilePic": 1 } },
  ]);

  // Top creators by followers
  const topCreators = await User.find()
    .sort({ followersCount: -1 })
    .limit(limit)
    .select("_id username fullName profilePic followersCount")
    .lean();

  return { topPosts, topCreators };
}
