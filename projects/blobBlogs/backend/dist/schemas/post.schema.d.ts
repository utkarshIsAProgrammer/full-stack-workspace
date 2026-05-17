import z from "zod";
export declare const createPostSchema: z.ZodObject<{
    title: z.ZodString;
    content: z.ZodString;
    image: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const updatePostSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    content: z.ZodOptional<z.ZodString>;
    image: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
//# sourceMappingURL=post.schema.d.ts.map