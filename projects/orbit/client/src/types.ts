export interface CloudinaryImage {
  url: string;
  public_id?: string;
}	export interface User {
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
  isPrivate?: boolean;
  isOnboarded?: boolean;
  notificationsEnabled?: boolean;
  isAdmin?: boolean;
}

export interface PostPoll {
  options: {
    text: string;
    votes: string[];
  }[];
  expiresAt: string | null;
  totalVotes: number;
}

export interface Post {
  _id: string;
  title: string;
  slug: string;
  content: string;
  image?: CloudinaryImage;
  images?: CloudinaryImage[];
  video?: CloudinaryImage;
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
  collaborator?: {
    _id: string;
    username: string;
    fullName: string;
    profilePic?: CloudinaryImage;
  } | null;
  collabAccepted?: boolean;
  hashtags?: string[];
  mentions?: string[];
  poll?: PostPoll | null;
  isQuoteRepost?: boolean;
  quoteContent?: string;
  isEdited?: boolean;
  status?: "draft" | "scheduled" | "published";
  scheduledAt?: string | null;
  createdAt: string;
  likedByMe?: boolean;
  savedByMe?: boolean;
  repostedByMe?: boolean;
  myVote?: string | null;
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

export type NotificationType = "like" | "comment" | "follow" | "repost" | "save" | "mention" | "reaction" | "message_reply" | "glimpse_reaction" | "glimpse_reply" | "poll_vote" | "collab_invite" | "follow_request" | "daily_reward" | "streak_reminder" | "room_invite";

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
  glimpse?: { _id: string } | null;
  comment?: {
    _id: string;
    content: string;
  } | null;
  room?: {
    _id: string;
    title: string;
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
      type: "voice_note" | "image" | "gif" | "video" | "file";
      duration?: number;
    }[];
    createdAt: string;
  }) | null;
  attachments?: {
    url: string;
    public_id?: string;
    type: "voice_note" | "image" | "gif" | "video" | "file";
    duration?: number;
  }[];
  seen: boolean;
  seenAt?: string | null;
  isEdited?: boolean;
  isDeleted?: boolean;
  deletedFor?: string[];
  forwardedFrom?: string;
  _pending?: boolean;
  _pendingConv?: string;
  _failed?: boolean;
  reactions?: MessageReaction[];
  createdAt: string;
  updatedAt: string;
}

export interface Glance {
  _id: string;
  author: {
    _id: string;
    username: string;
    fullName: string;
    profilePic?: CloudinaryImage;
  };
  media: CloudinaryImage;
  mediaType: "image" | "video";
  viewers: { 
    user: { _id: string; username: string; fullName: string; profilePic?: CloudinaryImage } | string; 
    viewedAt: string; 
  }[];
  reactions?: {
    user: string | { _id: string; username: string; fullName: string; profilePic?: CloudinaryImage };
    emoji: string;
    createdAt?: string;
  }[];
  viewedByMe: boolean;
  expiresAt: string;
  createdAt: string;
  highlighted?: boolean;
  highlightLabel?: string;
  highlightOrder?: number;
}

export type Glimpse = Glance;

export interface Community {
  _id: string;
  name: string;
  description?: string;
  image?: { url: string; public_id?: string };
  creator: {
    _id: string;
    username: string;
    fullName: string;
    profilePic?: CloudinaryImage;
  };
  members: {
    user: {
      _id: string;
      username: string;
      fullName: string;
      profilePic?: CloudinaryImage;
    };
    joinedAt: string;
  }[];
  memberCount: number;
  isMember?: boolean;
  pinnedMessages?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CommunityMessage {
  _id: string;
  community: string;
  sender: {
    _id: string;
    username: string;
    fullName: string;
    profilePic?: CloudinaryImage;
  };
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
      type: "voice_note" | "image" | "gif" | "video" | "file";
      duration?: number;
    }[];
    createdAt: string;
  }) | null;
  attachments?: {
    url: string;
    public_id?: string;
    type: "voice_note" | "image" | "gif" | "video" | "file";
    duration?: number;
  }[];
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
