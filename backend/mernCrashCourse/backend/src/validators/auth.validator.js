import zod from "zod";

const signupSchema = zod.object({
	username: zod
		.string({ required_error: "Name is required!" })
		.trim()
		.min(3, { message: "Name must be at least 3 characters!" })
		.max(20, { message: "Name must be less than 20 characters!" }),

	email: zod
		.string({ required_error: "Email is required!" })
		.trim()
		.email({ message: "Invalid email address!" })
		.min(3, { message: "Email must be at least 3 characters!" })
		.max(255, { message: "Email must be less than 255 characters!" }),

	phone: zod
		.string({ required_error: "Phone is required!" })
		.trim()
		.min(10, { message: "Phone number must be 10 characters!" })
		.max(10, { message: "Phone number must be 10 characters!" }),

	password: zod
		.string({ required_error: "Password is required!" })
		.min(6, { message: "Password must be at least 6 characters!" })
		.max(10, { message: "Password must be less than 10 characters!" }),
});

export default signupSchema;
