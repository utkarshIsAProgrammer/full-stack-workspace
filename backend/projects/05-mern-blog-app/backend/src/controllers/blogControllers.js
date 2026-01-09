/* import Blog from "../models/Blog.js";

export async function getTask(req, res) {
	const { title, content, author } = req.body;

	try {
    const blog = await Blog.findById()
	} catch (err) {
		console.log("Error in the getTask controller!", err.message);
		res.status(500).json({ message: "Internal Server Error!" });
	}
}
 */
