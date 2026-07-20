import nodemailer from "nodemailer";
import { env } from "./env";
import { logger } from "../utilities/logger";

type MailUser = {
  email: string;
  username: string;
};

const transporter = nodemailer.createTransport({
	host: env.SMTP_HOST,
	port: 587,
	secure: false, // true for port 465, false for other ports
	auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
	// Mail content is application-generated; never allow a template or input to
	// make Nodemailer read a local file or fetch a URL while composing a message.
	disableFileAccess: true,
	disableUrlAccess: true,
});

// signup email
export const sendWelcomeMail = async (user: MailUser) => {
  try {
    await transporter.sendMail({
      from: '"blobBlogs" <inevitablestrangeutkarsh@gmail.com>',
      to: user.email,
      subject: "Signup Successful!",
      text: `Hi ${user.username}! Welcome to the blobBlogs, thanks for signing up.`,
      html: `<p>Hi ${user.username}! welcome to <b>blobBlogs</b>, thanks for signing up.</p>`,
    });
    logger.info("Welcome email sent!");
  } catch (err: any) {
    logger.error("Failed to send email:", { error: err.message });
  }
};

// password update email
export const sendPasswordUpdateMail = async (user: MailUser) => {
  try {
    await transporter.sendMail({
      from: '"blobBlogs" <inevitablestrangeutkarsh@gmail.com>',
      to: user.email,
      subject: "Password Successfully Updated!",
      text: `Hi ${user.username}! password to you user account is updated successfully!.`,
      html: `<p>Hi ${user.username}! password to you user account is updated successfully!</p>`,
    });
    logger.info("Password update email sent!");
  } catch (err: any) {
    logger.error("Failed to send email:", { error: err.message });
  }
};

// otp email
export const sendOtpMail = async (user: MailUser, otp: string) => {
  try {
    await transporter.sendMail({
      from: '"blobBlogs" <inevitablestrangeutkarsh@gmail.com>',
      to: user.email,
      subject: "OTP verification!",
      text: `Hi ${user.username}! here is your one time password ${otp} don't reveal it to others.`,
      html: `Hi ${user.username}! here is your one time password <b>${otp}</b> don't reveal it to others.`,
    });
    logger.info("OTP email sent!");
  } catch (err: any) {
    logger.error("Failed to send OTP email:", { error: err.message });
  }
};

// forgot password email
export const sendForgotPasswordMail = async (user: MailUser) => {
  try {
    await transporter.sendMail({
      from: '"blobBlogs" <inevitablestrangeutkarsh@gmail.com>',
      to: user.email,
      subject: "New password set successful!",
      text: `Hi ${user.username}! you've successfully created your new password.`,
      html: `Hi ${user.username}! you've successfully created your new password.`,
    });
    logger.info("Forgot password email sent!");
  } catch (err: any) {
    logger.error("Failed to send forgot password email:", { error: err.message });
  }
};

// account deletion email
export const sendDeletionMail = async (user: MailUser) => {
  try {
    await transporter.sendMail({
      from: '"blobBlogs" <inevitablestrangeutkarsh@gmail.com>',
      to: user.email,
      subject: "Account deletion!",
      text: `Hi ${user.username}! sorry to see you go, your account is deleted successfully.`,
      html: `Hi ${user.username}! sorry to see you go, your account is deleted successfully.`,
    });
    logger.info("Account deletion email sent!");
  } catch (err: any) {
    logger.error("Failed to send account deletion email:", { error: err.message });
  }
};
