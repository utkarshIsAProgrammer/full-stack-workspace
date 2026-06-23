export interface CloudinaryImage {
  url: string;
  public_id?: string;
}

export interface User {
  _id: string;
  username: string;
  fullName: string;
  email: string;
  gender?: "male" | "female" | "others";
  bio?: string;
  profilePic?: CloudinaryImage;
  bannerImage?: CloudinaryImage;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  viewsCount: number;
  sharesCount: number;
  createdAt: string;
}

export interface Post {
  _id: string;
  title: string;
  slug: string;
  content: string;
  image?: CloudinaryImage;
  images?: CloudinaryImage[];
  likesCount: number;
  commentsCount: number;
  savesCount: number;
  repostsCount: number;
  viewsCount: number;
  sharesCount: number;
  author: {
    _id: string;
    username: string;
    fullName: string;
    profilePic?: CloudinaryImage;
  };
  createdAt: string;
  likedByMe?: boolean;
  savedByMe?: boolean;
  repostedByMe?: boolean;
}

export interface CommentReaction {
  _id: string;
  emoji: string;
  sender: {
    _id: string;
    username: string;
    fullName: string;
    profilePic?: CloudinaryImage;
  };
  createdAt: string;
}

export interface Comment {
  _id: string;
  content: string;
  author: {
    _id: string;
    username: string;
    fullName: string;
    profilePic?: CloudinaryImage;
  };
  post: string;
  parent?: string | null;
  likesCount: number;
  repliesCount?: number;
  createdAt: string;
  likedByMe?: boolean;
  isEdited?: boolean;
  reactions?: CommentReaction[];
}

export type NotificationType = "like" | "comment" | "follow" | "repost" | "save" | "mention" | "reaction" | "message_reply";

export interface Notification {
  _id: string;
  recipient: string;
  sender: {
    _id: string;
    username: string;
    fullName: string;
    profilePic?: CloudinaryImage;
  };
  type: NotificationType;
  post?: {
    _id: string;
    title: string;
    slug: string;
  } | null;
  comment?: {
    _id: string;
    content: string;
  } | null;
  isRead: boolean;
  createdAt: string;
}

export interface MessageReaction {
  _id: string;
  emoji: string;
  sender: {
    _id: string;
    username: string;
    fullName: string;
    profilePic?: CloudinaryImage;
  };
  createdAt: string;
}

export interface Message {
  _id: string;
  conversation: string;
  sender: {
    _id: string;
    username: string;
    fullName: string;
    profilePic?: CloudinaryImage;
  };
  recipient: string;
  text: string;
  replyTo?: ({
    _id: string;
    sender: {
      _id: string;
      username: string;
      fullName: string;
      profilePic?: CloudinaryImage;
    };
    text: string;
    attachments?: {
      url: string;
      public_id?: string;
      type: "voice_note" | "image" | "gif";
      duration?: number;
    }[];
    createdAt: string;
  }) | null;
  attachments?: {
    url: string;
    public_id?: string;
    type: "voice_note" | "image" | "gif";
    duration?: number;
  }[];
  seen: boolean;
  seenAt?: string | null;
  isEdited?: boolean;
  isDeleted?: boolean;
  deletedFor?: string[];
  reactions?: MessageReaction[];
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  _id: string;
  participants: {
    _id: string;
    username: string;
    fullName: string;
    profilePic?: CloudinaryImage;
  }[];
  lastMessage?: Message | null;
  unreadCounts?: Record<string, number>;
  createdAt: string;
  updatedAt: string;
  presence?: "online" | "offline";
}
