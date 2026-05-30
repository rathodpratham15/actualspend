// Thin wrapper around Resend. Set RESEND_API_KEY + EMAIL_FROM in env.
// EMAIL_FROM defaults to a no-reply address — must be a verified sender
// domain in your Resend account.

import { Resend } from "resend";

// Lazy so missing key at build time doesn't crash the import.
function getResend() {
  return new Resend(process.env.RESEND_API_KEY ?? "");
}
const FROM = process.env.EMAIL_FROM ?? "ActualSpend <noreply@actualspend.app>";

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    // Dev fallback — log the link so you can test without real email.
    console.log(`[email] Password reset link for ${to}:\n${resetUrl}`);
    return;
  }

  await getResend().emails.send({
    from: FROM,
    to,
    subject: "Reset your ActualSpend password",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px 24px">
        <h2 style="font-size:20px;margin-bottom:8px">Reset your password</h2>
        <p style="color:#666;margin-bottom:24px">
          Click the button below to choose a new password.
          This link expires in <strong>1 hour</strong> and can only be used once.
        </p>
        <a href="${resetUrl}"
           style="display:inline-block;padding:10px 20px;background:#000;color:#fff;
                  border-radius:6px;text-decoration:none;font-size:14px">
          Reset password
        </a>
        <p style="margin-top:24px;font-size:12px;color:#999">
          If you didn't request this, you can safely ignore this email.
          <br>The link will expire automatically.
        </p>
      </div>
    `,
  });
}
