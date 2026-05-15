import { body, validationResult } from "express-validator";

export const validateSignup = [
	body("name")
		.trim()
		.isLength({ min: 2 })
		.withMessage("Name must be at least 2 characters!"),

	body("email")
		.trim()
		.isEmail()
		.withMessage("Invalid email format!")
		.normalizeEmail(),

	body("password")
		.isStrongPassword({
			minLength: 8,
			minUppercase: 1,
			minNumbers: 1,
			minSymbols: 1,
		})
		.withMessage("Try with a strong password!"),

	// store validation result
	(req, res, next) => {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res
				.status(400)
				.json({ success: false, errors: errors.array() });
		}
		next();
	},
];
