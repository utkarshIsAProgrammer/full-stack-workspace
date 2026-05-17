import type { Request, Response } from "express";
type Params = {
    postId: string;
};
export declare const toggleRepost: (req: Request<Params>, res: Response) => Promise<Response<any, Record<string, any>>>;
export {};
//# sourceMappingURL=repost.controllers.d.ts.map