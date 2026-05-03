/**
 * @file generateOtp.ts
 * @description Utility for generating secure one-time passwords (OTP).
 */

import crypto from "crypto";

/**
 * Generates a random 6-digit OTP as a string.
 * @function generateOTP
 * @returns {string} A 6-digit numeric string.
 */
export const generateOTP = () => {
	// Generates a cryptographically strong random integer between 100000 and 999999
	return crypto.randomInt(100000, 1000000).toString();
};
