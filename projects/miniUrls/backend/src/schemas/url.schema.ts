import { z } from "zod";

// validation schema for urls
export const urlSchema = z.object({
  originalUrl: z
    .preprocess((val) => {
      if (typeof val !== "string") return val;
      let url = val.trim();
      if (url.length === 0) return url;
      // add https:// if no protocol is present
      if (!/^https?:\/\//i.test(url)) {
        return `https://${url}`;
      }
      return url;
    }, z.string().min(1, "URL is required!").url("Must be a valid URL!"))
    .transform((val) => val.trim()),
});

// input type inference
export type UrlSchemaInput = z.infer<typeof urlSchema>;
