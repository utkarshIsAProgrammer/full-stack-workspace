import { Request, Response, NextFunction } from "express";
import { UserDocument } from "../models/user.model";
declare global {
    namespace Express {
        interface Request {
            user?: UserDocument;
        }
    }
}
export declare const protect: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=auth.middleware.d.ts.map