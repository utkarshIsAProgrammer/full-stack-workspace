import type { Request, Response } from "express";
export declare const getUnreadCount: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getNotifications: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const markAsRead: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=notification.controllers.d.ts.map