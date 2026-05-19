import type { Request, Response } from "express";
type Params = {
    postId: string;
};
export declare const toggleSavePost: (req: Request<Params>, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getSavedPosts: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export {};
//# sourceMappingURL=saves.controllers.d.ts.map