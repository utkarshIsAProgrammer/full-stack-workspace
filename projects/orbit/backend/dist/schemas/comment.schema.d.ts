import z from "zod";
export declare const addCommentSchema: z.ZodObject<{
    content: z.ZodString;
    parent: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const updateCommentSchema: z.ZodObject<{
    content: z.ZodString;
    parent: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
//# sourceMappingURL=comment.schema.d.ts.map