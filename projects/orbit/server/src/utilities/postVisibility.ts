import { User } from "../models/user.model";
import Post from "../models/post.model";

/**
 * Check whether the current user is allowed to view a closeFriends post.
 * The author can always see it. Other users must be on the author's
 * closeFriends list. Unauthenticated requests are always denied.
 */
export async function canViewCloseFriendsPost(
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

/**
 * Convenience guard for post-id endpoints (likes, comments, votes, views):
 * fetches the post, returns true when the caller may interact with it.
 * Returns false for non-existent / hidden posts so callers can 404.
 */
export async function canInteractWithPost(
  postId: string,
  currentUserId: string | undefined,
): Promise<{ allowed: boolean; post: any }> {
  const post = await Post.findById(postId).lean();
  if (!post) return { allowed: false, post: null };
  return {
    allowed: await canViewCloseFriendsPost(post, currentUserId),
    post,
  };
}
