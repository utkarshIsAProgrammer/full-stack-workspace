import express from "express";
import "dotenv/config";
import cookieParser from "cookie-parser";
import { connectDB } from "./db/db";
import { authRoutes } from "./routes/auth.routes";
import { passwordRoutes } from "./routes/password.routes";
import { userRoutes } from "./routes/user.routes";

const app = express();
const port = process.env.PORT || 5500;

app.use(express.json());
app.use(cookieParser());
app.use("/api/auth", authRoutes);
app.use("/api/password", passwordRoutes);
app.use("/api/user", userRoutes);

connectDB().then(() => {
	app.listen(port, () => {
		console.log(`Server is running on PORT: ${port}`);
	});
});

// ** I'VE CREATED THE FORGOT PASSWORD AND OTP VERIFICATION SUCCESSFULLY **
// ** I'VE CREATED PROTECT AUTH MIDDLEWARE FOR (LOGOUT, UPDATE_PASSWORD, FORGOT_PASSWORD, REQUEST_FORGOT_PASSWORD) **

// TODO:  BUT I'VE TO ADD (if user is entering the existing password while updating/forgetting the existing password)
