export const setCookies = async (res, accessToken, refreshToken) => {
	res.cookie("accessToken", accessToken, {
		httpOnly: true,
		sameSite: "strict",
		secure: process.env.NODE_ENV === "production",
		maxAge: 15 * 60 * 1000,
	});

	res.cookie("refreshToken", refreshToken, {
		httpOnly: true,
		sameSite: "strict",
		secure: process.env.NODE_ENV === "production",
		maxAge: 7 * 24 * 60 * 60 * 1000,
	});
};
