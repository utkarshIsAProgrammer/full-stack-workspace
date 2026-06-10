import { generateStreamToken } from "../config/stream.js";
import { getAuth } from "@clerk/express";

export const getStreamToken = async (req, res) => {
  try {
    const { userId } = getAuth(req);
    const token = generateStreamToken(userId);
    res.status(200).json({ token });
  } catch (error) {
    console.log("Error generating Stream token:", error);
    res.status(500).json({
      message: "Failed to generate Stream token",
    });
  }
};
