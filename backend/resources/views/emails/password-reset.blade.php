<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Password reset</title></head>
<body style="font-family: Arial, Helvetica, sans-serif; color:#1d1d1d; line-height:1.5;">
    <h2 style="color:#016D2D;">Reset your password</h2>
    <p>We received a request to reset your Portfolio Manager password. Click the button below to choose a new one. This link expires in <strong>1 hour</strong>.</p>
    <p style="margin:24px 0;">
        <a href="{{ $resetUrl }}"
           style="background:#016D2D;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold;">
            Reset password
        </a>
    </p>
    <p style="font-size:13px;color:#6b7280;">If the button doesn't work, copy and paste this link into your browser:</p>
    <p style="font-size:13px;word-break:break-all;"><a href="{{ $resetUrl }}">{{ $resetUrl }}</a></p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
    <p style="font-size:12px;color:#9ca3af;">If you didn't request this, you can safely ignore this email — your password won't change.</p>
</body>
</html>
