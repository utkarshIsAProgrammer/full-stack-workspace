import type { Request, Response } from "express";
type Params = {
    userId: string;
};
export declare const getAll: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const deleteAccount: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const shareProfile: (req: Request<Params>, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export {};
//# sourceMappingURL=user.controllers.d.ts.map