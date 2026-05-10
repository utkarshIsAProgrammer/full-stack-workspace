import { z } from "zod";
export declare const urlSchema: z.ZodObject<{
    originalUrl: z.ZodPipe<z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodString>, z.ZodTransform<string, string>>;
}, z.core.$strip>;
export type UrlSchemaInput = z.infer<typeof urlSchema>;
//# sourceMappingURL=url.schema.d.ts.map