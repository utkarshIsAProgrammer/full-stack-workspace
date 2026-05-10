import express from "express";
import cors from "cors";
import helmet from "helmet";
import "dotenv/config";
import { connectDB } from "./db/db";
import { urlRoutes } from "./routes/url.routes";

const app = express();
const port = process.env.PORT || 3000;

// middleware
app.use(helmet()); // security headers
app.use(cors()); // enable cors
app.use(express.json()); // parse json bodies

// routes
app.use("", urlRoutes);

// start server
connectDB().then(() => {
  app.listen(port, () => {
    console.log(`Server is running on PORT: ${port}`);
  });
});
