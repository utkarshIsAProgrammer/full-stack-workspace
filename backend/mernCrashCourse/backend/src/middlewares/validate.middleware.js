export const validate = (signupSchema) => async (req, res, next) => {
	try {
		const parseBody = await signupSchema.parseAsync(req.body);
		req.body = parseBody;
		next();
	} catch (err) {
		console.log(`Error in the validate middleware! ${err.message}`);
		res.status(500).json({
			success: false,
			message: "Internal server error!",
		});
	}
};
