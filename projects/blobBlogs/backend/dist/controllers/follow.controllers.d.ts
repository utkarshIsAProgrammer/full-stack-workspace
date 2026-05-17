import type { Request, Response } from "express";
type Params = {
    userId: string;
};
export declare const toggleFollowUser: (req: Request<Params>, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getFollowers: (req: Request<Params>, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getFollowing: (req: Request<Params>, res: Response) => Promise<Response<any, Record<string, any>>>;
export {};
//# sourceMappingURL=follow.controllers.d.ts.map