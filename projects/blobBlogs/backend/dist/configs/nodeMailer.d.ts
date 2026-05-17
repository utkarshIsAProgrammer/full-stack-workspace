import "dotenv/config";
type MailUser = {
    email: string;
    username: string;
};
export declare const sendWelcomeMail: (user: MailUser) => Promise<void>;
export declare const sendPasswordUpdateMail: (user: MailUser) => Promise<void>;
export declare const sendOtpMail: (user: MailUser, otp: string) => Promise<void>;
export declare const sendForgotPasswordMail: (user: MailUser) => Promise<void>;
export declare const sendDeletionMail: (user: MailUser) => Promise<void>;
export {};
//# sourceMappingURL=nodeMailer.d.ts.map