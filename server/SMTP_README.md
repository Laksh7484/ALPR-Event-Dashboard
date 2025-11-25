# IMPORTANT: SMTP Configuration

Before testing the email OTP functionality, please update the `.env` file with the actual SMTP password.

## Current Configuration

The SMTP credentials are configured as follows:

```env
# Email Configuration
SMTP_HOST=mail.platesmart.net
SMTP_PORT=587
SMTP_USER=support@mail.platesmart.net
SMTP_PASS=xyz  # ⚠️ UPDATE THIS WITH ACTUAL PASSWORD
SMTP_FROM=support@mail.platesmart.net

# Session Configuration
SESSION_SECRET=your-random-secret-key-change-this-in-production
```

## Action Required

Replace `xyz` in `SMTP_PASS` with the actual password for support@mail.platesmart.net

## Testing Without Email

If you want to test the system without email functionality, you can temporarily add console logging in `server/index.js` at line ~305:

```javascript
// Inside sendOTPEmail function, add:
console.log(`OTP for ${email}: ${otp}`);
```

This will print the OTP code to the server console for testing purposes.
