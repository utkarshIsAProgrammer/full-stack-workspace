import type { Request, Response } from "express";
type Params = {
    postId: string;
};
type CommentParams = {
    commentId: string;
};
export declare const getComment: (req: Request<Params>, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const addComment: (req: Request<Params>, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const updateComment: (req: Request<CommentParams>, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const deleteComment: (req: Request<CommentParams>, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export {};
//# sourceMappingURL=comment.controllers.d.ts.map