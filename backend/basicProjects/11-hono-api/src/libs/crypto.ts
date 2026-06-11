import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";

export async function hashPassword(password: string) {
	const salt = randomBytes(16).toString("hex");
	const hash = await scryptAsync(password, salt);
	return `${salt}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
	const [salt, originalHash] = storedHash.split(":");
	if (!salt || !originalHash) return false;

	const hash = await scryptAsync(password, salt);
	const originalHashBuffer = Buffer.from(originalHash, "hex");

	if (hash.length !== originalHashBuffer.length) return false;
	return timingSafeEqual(hash, originalHashBuffer);
}

function scryptAsync(password: string, salt: string) {
	return new Promise<Buffer>((resolve, reject) => {
		scrypt(password, salt, 64, (err, derivedKey) => {
			if (err) return reject(err);
			resolve(derivedKey);
		});
	});
}
