export type UserStatus = "ONLINE" | "IDLE" | "DND" | "INVISIBLE" | "OFFLINE";
export type UserRole = "USER" | "MODERATOR" | "ADMIN";
export type ChatType = "DM" | "GROUP" | "CHANNEL";
export type ChatMemberRole = "OWNER" | "ADMIN" | "MODERATOR" | "MEMBER";
export type MessageType =
  | "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "FILE" | "VOICE" | "GIF" | "STICKER" | "SYSTEM";

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  statusText: string | null;
  status: UserStatus;
  role: UserRole;
  lastSeenAt: string | null;
  createdAt: string;
}

export interface PrivateUser extends PublicUser {
  email: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
}

export interface Attachment {
  id: string;
  url: string;
  secureUrl: string;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
}

export interface Reaction {
  id: string;
  emoji: string;
  userId: string;
  user: Pick<PublicUser, "id" | "username" | "displayName">;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string | null;
  sender: PublicUser | null;
  type: MessageType;
  content: string | null;
  replyToId: string | null;
  replyTo: (Pick<Message, "id" | "content" | "type"> & {
    sender: Pick<PublicUser, "id" | "username" | "displayName" | "avatarUrl"> | null;
  }) | null;
  threadRootId: string | null;
  isEdited: boolean;
  isDeleted: boolean;
  isSent: boolean;
  scheduledFor: string | null;
  createdAt: string;
  updatedAt: string;
  attachments: Attachment[];
  reactions: Reaction[];
  _count?: { threadReplies: number; readReceipts: number };
  /** client-only: optimistic message pending server ack */
  pending?: boolean;
  failed?: boolean;
}

export interface ChatMember {
  id: string;
  chatId: string;
  userId: string;
  role: ChatMemberRole;
  isMuted: boolean;
  joinedAt: string;
  lastReadAt: string;
  user: PublicUser;
}

export interface Chat {
  id: string;
  type: ChatType;
  name: string | null;
  description: string | null;
  avatarUrl: string | null;
  isPublic: boolean;
  ownerId: string | null;
  slowModeSeconds: number;
  createdAt: string;
  updatedAt: string;
  members: ChatMember[];
  _count: { members: number };
  lastMessage: Message | null;
  unreadCount: number;
  myRole: ChatMemberRole | null;
}

export interface FriendEntry {
  friendshipId: string;
  user: PublicUser;
  since?: string;
  createdAt?: string;
}

export interface Notification {
  id: string;
  type: "MESSAGE" | "MENTION" | "FRIEND_REQUEST" | "FRIEND_ACCEPT" | "REACTION" | "SYSTEM" | "CALL_MISSED";
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
  actor: PublicUser | null;
}

export interface PinnedMessage {
  id: string;
  chatId: string;
  messageId: string;
  createdAt: string;
  message: Message;
  pinnedBy?: PublicUser;
}

export interface AdminStats {
  totalUsers: number;
  newUsersToday: number;
  totalMessages: number;
  messagesToday: number;
  totalChats: number;
  onlineUsers: number;
  openReports: number;
  bannedUsers: number;
  messagesPerDay: Array<{ day: string; count: number }>;
}

export interface Paginated<T> {
  items: T[];
  nextCursor?: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string; details?: unknown };
}
