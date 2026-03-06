import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY!);
  }
  return _resend;
}

export async function sendApplicationApprovedEmail(
  to: string,
  name: string,
): Promise<void> {
  await getResend().emails.send({
    from: "Tinker Tailor <hello@tinkertailor.com>",
    to,
    subject: "Your creator application has been approved!",
    html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h1 style="font-size: 20px; margin-bottom: 16px;">Welcome to Tinker Tailor, ${name}!</h1>
      <p style="color: #555; margin-bottom: 16px;">Your creator application has been approved. You can now access the Design Studio and start creating.</p>
      <p style="color: #999; font-size: 12px; margin-top: 32px;">Tinker Tailor — AI-powered custom fashion</p>
    </div>`,
  });
}

export async function sendApplicationRejectedEmail(
  to: string,
  name: string,
  note?: string,
): Promise<void> {
  await getResend().emails.send({
    from: "Tinker Tailor <hello@tinkertailor.com>",
    to,
    subject: "Update on your creator application",
    html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h1 style="font-size: 20px; margin-bottom: 16px;">Hi ${name},</h1>
      <p style="color: #555; margin-bottom: 16px;">Unfortunately, your creator application was not approved at this time.</p>
      ${note ? `<p style="color: #555; margin-bottom: 16px;"><strong>Feedback:</strong> ${note}</p>` : ""}
      <p style="color: #555;">You're welcome to apply again in the future.</p>
      <p style="color: #999; font-size: 12px; margin-top: 32px;">Tinker Tailor — AI-powered custom fashion</p>
    </div>`,
  });
}
