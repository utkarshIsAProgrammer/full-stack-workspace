import type { Request, Response } from "express";
import { nanoid } from "nanoid";
import Url from "../models/url.model";
import { urlSchema } from "../schemas/url.schema";

// get base url from env
const BASE_URL = process.env.BASE_URL;

// create a shortened url
export const createShortenUrl = async (req: Request, res: Response) => {
  const result = urlSchema.safeParse(req.body);

  // validation check
  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid data!",
      error: result.error.issues,
    });
  }

  const { originalUrl } = result.data;

  // return existing if already shortened
  const existing = await Url.findOne({ originalUrl });
  if (existing) {
    return res.status(200).json({
      success: true,
      shortCode: existing.shortCode,
      shortUrl: `${BASE_URL}/${existing.shortCode}`,
      message: "URL already shortened!",
    });
  }

  // generate unique short code
  let shortCode: string = "";
  let isUnique = false;
  while (!isUnique) {
    shortCode = nanoid(7);
    const exists = await Url.findOne({ shortCode });
    if (!exists) isUnique = true;
  }

  // save to database
  const newUrl = await Url.create({ originalUrl, shortCode });

  res.status(201).json({
    success: true,
    shortCode: newUrl.shortCode,
    shortUrl: `${BASE_URL}/${newUrl.shortCode}`,
    message: "URL shortened successfully!",
  });
};

// handle redirection to original url
export const handleRedirect = async (req: Request, res: Response) => {
  const { code } = req.params;

  // validate input
  if (!code || typeof code !== "string") {
    return res.status(400).json({
      success: false,
      message: "Invalid or missing short code!",
    });
  }

  try {
    // find url in db
    const urlEntry = await Url.findOne({ shortCode: code });
    if (!urlEntry) {
      return res.status(404).json({
        success: false,
        message: "Link not found!",
      });
    }

    // redirect to original url
    return res.redirect(302, urlEntry.originalUrl);
  } catch (err: any) {
    console.error(`Redirect error: ${err.message}`);
    res.status(500).json({
      success: false,
      message: "Internal server error!",
    });
  }
};
