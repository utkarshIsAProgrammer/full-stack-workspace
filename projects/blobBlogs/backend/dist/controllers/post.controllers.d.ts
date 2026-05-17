import type { Request, Response } from "express";
type Params = {
    postId: string;
};
export declare const getPost: (req: Request<Params>, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getAllPosts: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const createPost: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const updatePost: (req: Request<Params>, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const deletePost: (req: Request<Params>, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const sharePost: (req: Request<Params>, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export {};
//# sourceMappingURL=post.controllers.d.ts.map