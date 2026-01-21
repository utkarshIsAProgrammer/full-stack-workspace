import { MailtrapClient } from "mailtrap";

const apiKey = process.env.MAILTRAP_API_KEY;
const isSandbox = process.env.MAILTRAP_USE_SANDBOX === "true";
const inboxId = isSandbox ? Number(process.env.MAILTRAP_INBOX_ID) : undefined; // required only for sandbox

const client = new MailtrapClient({
	token: apiKey,
	sandbox: isSandbox,
	testInboxId: inboxId, // undefined is ignored for production
});

client
	.send({
		from: {
			name: "Mailtrap Test",
			email: isSandbox
				? "sandbox@example.com"
				: "no-reply@your-domain.com",
		},
		to: [{ email: "recipient@example.com" }],
		subject: isSandbox ? "[SANDBOX] Demo email" : "Welcome onboard",
		text: "This is a minimal body for demonstration purposes.",
	})
	.then(console.log)
	.catch(console.error);
