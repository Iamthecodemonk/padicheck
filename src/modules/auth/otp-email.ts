// Email-client compatible, inline styles and no remote images or tracking.
export function otpEmail(code: string) {
  if (!/^\d{6}$/.test(code)) throw new Error('Invalid verification code');
  return {
    subject: 'Your PadiCheck verification code',
    text: `Verify your email\n\nYour PadiCheck verification code is ${code}.\n\nThis code expires 10 minutes after you requested it and can only be used once. Enter it on the PadiCheck verification page.\n\nNever share this code. PadiCheck will never ask you for it by email or phone.\n\nIf you did not request this code, you can safely ignore this email.`,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Verify your email</title></head>
<body style="margin:0;padding:0;background:#f3f6f5;color:#172e29;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Your one-time PadiCheck code. Valid for 10 minutes after your request.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6f5"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px"><tr><td style="padding:0 0 24px;font-size:24px;font-weight:700;color:#12664f">PadiCheck<span style="color:#88ac49">.</span></td></tr>
<tr><td style="background:#ffffff;border:1px solid #dce7e2;border-radius:16px;padding:36px 28px">
<p style="margin:0 0 16px;color:#12664f;font-size:12px;letter-spacing:2px;font-weight:700">EMAIL VERIFICATION</p>
<h1 style="margin:0 0 16px;font-size:28px;line-height:1.25">One quick check.<br>Then you&rsquo;re in.</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#53665f">Enter this verification code on PadiCheck to confirm your email address.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 8px;background:#edf5f0;border:1px solid #cfe2d6;border-radius:10px;font-family:monospace;font-size:36px;font-weight:700;letter-spacing:8px;color:#12573f">${code}</td></tr></table>
<p style="margin:18px 0 28px;text-align:center;font-size:13px;line-height:1.6;color:#62756c">Single use &middot; Expires 10 minutes after your request</p>
<p style="margin:0;padding-top:24px;border-top:1px solid #e7eeea;font-size:14px;line-height:1.7;color:#53665f"><strong style="color:#172e29">Keep your code private.</strong><br>PadiCheck will never ask you to share it by email or phone.</p>
</td></tr><tr><td style="padding:24px 8px;font-size:12px;line-height:1.8;color:#6c7d74">Didn&rsquo;t request this code? You can safely ignore this email.<br>Sent by PadiCheck to help keep your account secure.</td></tr></table>
</td></tr></table></body></html>`,
  };
}

export function passwordResetEmail(code:string) {
  const message=otpEmail(code);
  return {subject:'Your PadiCheck password reset code',text:`Your password reset code is ${code}. It expires in 10 minutes and works once. Enter it on the PadiCheck password reset page. Never share it. If you did not request a password reset, ignore this email.`,html:message.html.replaceAll('Verify your email','Reset your password').replaceAll('EMAIL VERIFICATION','PASSWORD RESET').replace('One quick check.<br>Then you&rsquo;re in.','Reset your password.').replace('Enter this verification code on PadiCheck to confirm your email address.','Enter this code on the PadiCheck password reset page to choose a new password.')}
}
