import type { Request, Response } from "express";
export declare const updatePassword: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const requestOtpForForgotPassword: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const verifyOtpAndForgotPassword: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=password.controllers.d.ts.map