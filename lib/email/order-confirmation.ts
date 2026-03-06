import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY!);
  }
  return _resend;
}

interface OrderEmailParams {
  to: string;
  orderId: string;
  designName: string;
  total: string;
}

export async function sendOrderConfirmationEmail({
  to,
  orderId,
  designName,
  total,
}: OrderEmailParams): Promise<void> {
  const shortId = orderId.slice(0, 8);

  await getResend().emails.send({
    from: "Tinker Tailor <orders@tinkertailor.com>",
    to,
    subject: `Order confirmed — ${designName} (#${shortId})`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h1 style="font-size: 20px; margin-bottom: 16px;">Your order is confirmed</h1>
        <p style="color: #555; margin-bottom: 24px;">Thank you for your purchase! We're getting your custom garment ready.</p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr>
            <td style="padding: 8px 0; color: #555;">Design</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600;">${designName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #555;">Order ID</td>
            <td style="padding: 8px 0; text-align: right; font-family: monospace;">#${shortId}</td>
          </tr>
          <tr style="border-top: 1px solid #eee;">
            <td style="padding: 8px 0; font-weight: 600;">Total</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600;">$${total}</td>
          </tr>
        </table>
        <p style="color: #555; font-size: 14px;">Estimated delivery: <strong>2–3 weeks</strong></p>
        <p style="color: #999; font-size: 12px; margin-top: 32px;">Tinker Tailor — AI-powered custom fashion</p>
      </div>
    `,
  });
}
