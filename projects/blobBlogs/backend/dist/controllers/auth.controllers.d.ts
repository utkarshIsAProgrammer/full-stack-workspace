import type { Request, Response } from "express";
export declare const getAll: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const signup: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const login: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const logout: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=auth.controllers.d.ts.map