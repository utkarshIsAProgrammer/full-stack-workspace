import cloudinary from "../utils/cloudinary.js";
import User from "../models/user.model.js";

export const updateProfile = async (req, res) => {
	const { image, ...otherData } = req.body;
	let updatedData = otherData;

	try {
		if (image) {
			// base64 format image
			if (image.startsWith("data:image")) {
				try {
					const uploadedResponse =
						await cloudinary.uploader.upload(image);
					uploadedData.image = uploadedResponse.secure_url; // grab secure url of the image;
				} catch (err) {
					console.log(`Error uploading image! ${err.message}`);
					res.status(400).json({ message: "Error uploading image!" });
				}
			}
		}

		const updatedUser = await User.findByIdAndUpdate(
			req.user.id, // find with authorized user id
			updatedData,
			{ new: true },
		);

		res.status(200).json({
			success: true,
			message: "Profile updated successfully!",
			updatedUser,
		});
	} catch (err) {
		console.log(`Error in the updateProfile controller! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};
