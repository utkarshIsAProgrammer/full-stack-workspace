import type { Request, Response } from "express";
type Params = {
    postId: string;
};
type CommentParams = {
    commentId: string;
};
export declare const togglePostLikes: (req: Request<Params>, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const toggleCommentLikes: (req: Request<CommentParams>, res: Response) => Promise<Response<any, Record<string, any>>>;
export {};
//# sourceMappingURL=like.controllers.d.ts.map