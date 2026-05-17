import type { Request, Response } from "express";
export declare const deleteAccount: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
type Params = {
    userId: string;
};
export declare const shareProfile: (req: Request<Params>, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export {};
//# sourceMappingURL=user.controllers.d.ts.map