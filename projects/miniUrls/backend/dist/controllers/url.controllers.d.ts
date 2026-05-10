import type { Request, Response } from "express";
export declare const createShortenUrl: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const handleRedirect: (req: Request, res: Response) => Promise<void | Response<any, Record<string, any>>>;
//# sourceMappingURL=url.controllers.d.ts.map