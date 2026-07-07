import Like from "../models/like.model";
import Save from "../models/saves.model";
import Repost from "../models/repost.model";
import { User } from "../models/user.model";

/**
 * Adds user interaction status to posts (likedByMe, savedByMe, repostedByMe, pinnedByMe)
 * Uses batch queries for efficiency - only 4 queries regardless of post count
 * 
 * @param posts - Array of posts to annotate
 * @param userId - Current user's ID (if authenticated)
 * @returns Posts with added status fields
 */
export const addUserStatusToPosts = async (posts: any[], userId: string | undefined) => {
  if (!userId || !posts.length) return posts;

  const postIds = posts.map(post => post._id?.toString() || post._id);

  // All queries run in parallel for optimal performance
  const [likedPosts, savedPosts, repostedPosts, currentUser] = await Promise.all([
    Like.find({ author: userId, post: { $in: postIds } }).select("post").lean(),
    Save.find({ user: userId, post: { $in: postIds } }).select("post").lean(),
    Repost.find({ user: userId, post: { $in: postIds } }).select("post").lean(),
    User.findById(userId).select("pinnedPosts").lean(),
  ]);

  // Build Sets for O(1) lookup
  const likedSet = new Set(likedPosts.map((l: any) => l.post?.toString()));
  const savedSet = new Set(savedPosts.map((s: any) => s.post?.toString()));
  const repostedSet = new Set(repostedPosts.map((r: any) => r.post?.toString()));
  const pinnedSet = new Set(
    currentUser?.pinnedPosts?.map((id: any) => id.toString()) || []
  );

  return posts.map(post => {
    const postId = post._id?.toString() || post._id;
    return {
      ...post,
      likedByMe: likedSet.has(postId),
      savedByMe: savedSet.has(postId),
      repostedByMe: repostedSet.has(postId),
      pinnedByMe: pinnedSet.has(postId),
    };
  });
};