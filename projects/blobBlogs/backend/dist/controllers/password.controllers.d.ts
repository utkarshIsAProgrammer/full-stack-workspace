import type { Request, Response, CookieOptions } from "express";
export declare const cookieOptions: CookieOptions;
export declare const updatePassword: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const requestOtpForForgotPassword: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const verifyOtpAndForgotPassword: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=password.controllers.d.ts.map