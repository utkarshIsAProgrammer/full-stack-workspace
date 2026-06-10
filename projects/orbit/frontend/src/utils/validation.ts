/**
 * Shared frontend validation utilities.
 * Mirrors the backend Zod schemas so users see the same validation errors
 * inline before the form is ever submitted.
 *
 * Backend schemas live in orbit-server/src/schemas/*
 *
 * Each validator returns `Record<string, string>` — field name → error message.
 * Empty object means "no errors".
 */

// ─── Helpers ────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_])[\w\W]{8,}$/;
const LOWERCASE_NAME_RE = /^[a-z0-9_]+$/;

// ─── Auth: Signup ───────────────────────────────────────────

export interface SignupData {
  username: string;
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  bio?: string;
}

export function validateSignup(data: SignupData): Record<string, string> {
  const errors: Record<string, string> = {};

  // username: min 3, max 100, trimmed, lowercase
  const username = data.username?.trim().toLowerCase() || "";
  if (!username) {
    errors.username = "Username is required.";
  } else if (username.length < 3) {
    errors.username = "Username must be at least 3 characters long.";
  } else if (username.length > 100) {
    errors.username = "Username must be less than 100 characters.";
  } else if (!LOWERCASE_NAME_RE.test(username)) {
    errors.username = "Username can only contain lowercase letters, numbers, and underscores.";
  }

  // fullName: min 3, max 50, trimmed
  const fullName = data.fullName?.trim() || "";
  if (!fullName) {
    errors.fullName = "Full name is required.";
  } else if (fullName.length < 3) {
    errors.fullName = "Full name must be at least 3 characters long.";
  } else if (fullName.length > 50) {
    errors.fullName = "Full name must be less than 50 characters.";
  }

  // email
  const email = data.email?.trim().toLowerCase() || "";
  if (!email) {
    errors.email = "Email address is required.";
  } else if (!EMAIL_RE.test(email)) {
    errors.email = "Please enter a valid email address.";
  }

  // password: min 8, uppercase, lowercase, number, special
  const password = data.password || "";
  if (!password) {
    errors.password = "Password is required.";
  } else if (password.length < 8) {
    errors.password = "Password must be at least 8 characters long.";
  } else if (!PASSWORD_RE.test(password)) {
    const missing: string[] = [];
    if (!/[A-Z]/.test(password)) missing.push("1 uppercase letter");
    if (!/[a-z]/.test(password)) missing.push("1 lowercase letter");
    if (!/\d/.test(password)) missing.push("1 number");
    if (!/[\W_]/.test(password)) missing.push("1 special character");
    errors.password = `Password must include ${missing.join(", ")}.`;
  }

  // confirmPassword: must match
  if (!data.confirmPassword) {
    errors.confirmPassword = "Please confirm your password.";
  } else if (data.confirmPassword !== password) {
    errors.confirmPassword = "Passwords do not match.";
  }

  // bio: max 300 (optional)
  if (data.bio && data.bio.length > 300) {
    errors.bio = "Bio must be less than 300 characters.";
  }

  return errors;
}

// ─── Auth: Login ────────────────────────────────────────────

export interface LoginData {
  usernameOrEmail: string;
  password: string;
}

export function validateLogin(data: LoginData): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!data.usernameOrEmail?.trim()) {
    errors.identity = "Username or email is required.";
  }
  if (!data.password) {
    errors.password = "Password is required.";
  }

  return errors;
}

// ─── Posts: Create ───────────────────────────────────────────

export interface PostData {
  title: string;
  content: string;
}

export function validatePost(data: PostData): Record<string, string> {
  const errors: Record<string, string> = {};

  // title: min 5, max 500
  const title = data.title?.trim() || "";
  if (!title) {
    errors.title = "Post title is required.";
  } else if (title.length < 5) {
    errors.title = "Title must be at least 5 characters long.";
  } else if (title.length > 500) {
    errors.title = "Title must be less than 500 characters.";
  }

  // content: min 5, max 5000
  const content = data.content?.trim() || "";
  if (!content) {
    errors.content = "Post content is required.";
  } else if (content.length < 5) {
    errors.content = "Content must be at least 5 characters long.";
  } else if (content.length > 5000) {
    errors.content = "Content must be less than 5000 characters.";
  }

  return errors;
}

// ─── Comments: Create ───────────────────────────────────────

export interface CommentData {
  content: string;
}

export function validateComment(data: CommentData): Record<string, string> {
  const errors: Record<string, string> = {};

  const content = data.content?.trim() || "";
  if (!content) {
    errors.comment = "Comment cannot be empty.";
  } else if (content.length > 1000) {
    errors.comment = "Comment must be less than 1000 characters.";
  }

  return errors;
}

// ─── Profile: Update ────────────────────────────────────────

export interface ProfileData {
  fullName?: string;
  bio?: string;
}

export function validateProfile(data: ProfileData): Record<string, string> {
  const errors: Record<string, string> = {};

  if (data.fullName !== undefined) {
    const fn = data.fullName.trim();
    if (!fn) {
      errors.fullName = "Full name is required.";
    } else if (fn.length < 3) {
      errors.fullName = "Full name must be at least 3 characters long.";
    } else if (fn.length > 50) {
      errors.fullName = "Full name must be less than 50 characters.";
    }
  }

  if (data.bio !== undefined && data.bio.length > 300) {
    errors.bio = "Bio must be less than 300 characters.";
  }

  return errors;
}

// ─── Password: Update ───────────────────────────────────────

export interface PasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export function validatePasswordChange(data: PasswordData): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!data.currentPassword) {
    errors.currentPassword = "Current password is required.";
  }

  const newPw = data.newPassword || "";
  if (!newPw) {
    errors.newPassword = "New password is required.";
  } else if (newPw.length < 8) {
    errors.newPassword = "Password must be at least 8 characters long.";
  } else if (!PASSWORD_RE.test(newPw)) {
    const missing: string[] = [];
    if (!/[A-Z]/.test(newPw)) missing.push("1 uppercase letter");
    if (!/[a-z]/.test(newPw)) missing.push("1 lowercase letter");
    if (!/\d/.test(newPw)) missing.push("1 number");
    if (!/[\W_]/.test(newPw)) missing.push("1 special character");
    errors.newPassword = `Password must include ${missing.join(", ")}.`;
  }

  if (!data.confirmPassword) {
    errors.confirmPassword = "Please confirm your new password.";
  } else if (data.confirmPassword !== newPw) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
}

// ─── Forgot Password ────────────────────────────────────────

export interface ForgotPasswordData {
  email: string;
}

/** Validates just the email field for the forgot-password request step. */
export function validateForgotPasswordRequest(data: ForgotPasswordData): Record<string, string> {
  const errors: Record<string, string> = {};
  const email = data.email?.trim().toLowerCase() || "";
  if (!email) {
    errors.email = "Email address is required.";
  } else if (!EMAIL_RE.test(email)) {
    errors.email = "Please enter a valid email address.";
  }
  return errors;
}

// ─── Forgot Password Reset ──────────────────────────────────

export interface ForgotPasswordResetData {
  otp: string[];
  newPassword: string;
}

/** Validates OTP + new password for the reset step. */
export function validateForgotPasswordReset(data: ForgotPasswordResetData): Record<string, string> {
  const errors: Record<string, string> = {};

  const otpStr = data.otp?.filter(Boolean).join("") || "";
  if (otpStr.length < 6) {
    errors.otp = "Complete the 6-digit code.";
  }

  const newPw = data.newPassword || "";
  if (!newPw) {
    errors.newPassword = "New password is required.";
  } else if (newPw.length < 8) {
    errors.newPassword = "Password must be at least 8 characters long.";
  } else if (!PASSWORD_RE.test(newPw)) {
    const missing: string[] = [];
    if (!/[A-Z]/.test(newPw)) missing.push("1 uppercase letter");
    if (!/[a-z]/.test(newPw)) missing.push("1 lowercase letter");
    if (!/\d/.test(newPw)) missing.push("1 number");
    if (!/[\W_]/.test(newPw)) missing.push("1 special character");
    errors.newPassword = `Password must include ${missing.join(", ")}.`;
  }

  return errors;
}

// ─── Chat: Send Message ─────────────────────────────────────

export interface ChatMessageData {
  text: string;
  hasAttachments: boolean;
}

/** Validates chat message — must have text of at least 1 word OR attachments. */
export function validateChatMessage(data: ChatMessageData): Record<string, string> {
  const errors: Record<string, string> = {};
  const text = data.text?.trim() || "";
  if (!text && !data.hasAttachments) {
    errors.message = "Message cannot be empty.";
  } else if (text && text.split(/\s+/).filter(Boolean).length < 1) {
    errors.message = "Message must contain at least 1 word.";
  }
  return errors;
}

// ─── Delete Account ─────────────────────────────────────────

export interface DeleteAccountData {
  email: string;
  password: string;
}

export function validateDeleteAccount(data: DeleteAccountData): Record<string, string> {
  const errors: Record<string, string> = {};
  const email = data.email?.trim().toLowerCase() || "";
  if (!email) {
    errors.deleteEmail = "Email is required to delete your account.";
  } else if (!EMAIL_RE.test(email)) {
    errors.deleteEmail = "Please enter a valid email address.";
  }
  if (!data.password) {
    errors.deletePassword = "Password is required to delete your account.";
  }
  return errors;
}
