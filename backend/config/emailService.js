const nodemailer = require('nodemailer');
const User = require('../models/User');

// ── Create transporter (lazy so missing config doesn't crash server) ──
const createTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return null;
  return nodemailer.createTransport({
    host:   process.env.EMAIL_HOST   || 'smtp.gmail.com',
    port:   parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_PORT === '465',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// ── Fetch all admin email addresses ──
const getAdminEmails = async () => {
  try {
    const admins = await User.find({ role: 'admin', isActive: true }).select('email name');
    return admins.map(u => u.email).filter(Boolean);
  } catch (err) {
    console.error('[Email] Failed to fetch admin emails:', err.message);
    return [];
  }
};

// ── HTML email template ──
const buildAlertEmail = (alertData) => {
  const {
    roomName, blockName, floorName,
    macAddress, deviceName, rssi, category,
    timestamp, isRandomized,
  } = alertData;

  const time = new Date(timestamp).toLocaleString('en-IN', {
    dateStyle: 'medium', timeStyle: 'medium',
  });

  const rssiBar = Math.max(0, Math.min(100, ((rssi + 100) / 50) * 100));
  const signalColor = rssi >= -60 ? '#22c55e' : rssi >= -75 ? '#f59e0b' : '#ef4444';

  return {
    subject: `🚨 Bluetooth Alert — ${roomName} | ExamGuard`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>ExamGuard Alert</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e1b4b,#1e3a5f);border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.08);">
              <div style="display:inline-flex;align-items:center;gap:12px;margin-bottom:8px;">
                <div style="width:44px;height:44px;background:linear-gradient(135deg,#3b82f6,#6366f1);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;">🔵</div>
                <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">ExamGuard</span>
              </div>
              <p style="color:#94a3b8;margin:0;font-size:13px;letter-spacing:1px;text-transform:uppercase;">Bluetooth Detection Alert</p>
            </td>
          </tr>

          <!-- Alert Banner -->
          <tr>
            <td style="background:#7f1d1d;padding:16px 32px;text-align:center;">
              <p style="margin:0;color:#fca5a5;font-size:15px;font-weight:700;letter-spacing:0.5px;">
                ⚠️ UNAUTHORIZED BLUETOOTH DEVICE DETECTED
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#1e293b;padding:32px;">

              <!-- Location -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="background:#0f172a;border-radius:12px;padding:20px;border:1px solid rgba(255,255,255,0.06);">
                    <p style="margin:0 0 12px;color:#64748b;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">📍 Location</p>
                    <p style="margin:0 0 4px;color:#ffffff;font-size:22px;font-weight:700;">${roomName}</p>
                    <p style="margin:0;color:#94a3b8;font-size:14px;">${blockName} &nbsp;›&nbsp; ${floorName}</p>
                  </td>
                </tr>
              </table>

              <!-- Device Details Grid -->
              <p style="margin:0 0 12px;color:#64748b;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">📡 Device Details</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td width="50%" style="padding:0 6px 12px 0;">
                    <div style="background:#0f172a;border-radius:10px;padding:16px;border:1px solid rgba(255,255,255,0.06);">
                      <p style="margin:0 0 4px;color:#64748b;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">MAC Address</p>
                      <p style="margin:0;color:#f1f5f9;font-family:monospace;font-size:14px;font-weight:600;">${macAddress}</p>
                      ${isRandomized ? '<p style="margin:4px 0 0;color:#f59e0b;font-size:10px;font-weight:700;">⚠️ RANDOMIZED / PRIVATE MAC</p>' : ''}
                    </div>
                  </td>
                  <td width="50%" style="padding:0 0 12px 6px;">
                    <div style="background:#0f172a;border-radius:10px;padding:16px;border:1px solid rgba(255,255,255,0.06);">
                      <p style="margin:0 0 4px;color:#64748b;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Device Name</p>
                      <p style="margin:0;color:#f1f5f9;font-size:14px;font-weight:600;">${deviceName || 'Unknown'}</p>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="padding:0 6px 0 0;">
                    <div style="background:#0f172a;border-radius:10px;padding:16px;border:1px solid rgba(255,255,255,0.06);">
                      <p style="margin:0 0 4px;color:#64748b;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Category</p>
                      <p style="margin:0;color:#f1f5f9;font-size:14px;font-weight:600;">${category || 'Unknown'}</p>
                    </div>
                  </td>
                  <td width="50%" style="padding:0 0 0 6px;">
                    <div style="background:#0f172a;border-radius:10px;padding:16px;border:1px solid rgba(255,255,255,0.06);">
                      <p style="margin:0 0 4px;color:#64748b;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Signal Strength</p>
                      <p style="margin:0 0 6px;color:${signalColor};font-size:14px;font-weight:700;">${rssi} dBm</p>
                      <div style="height:4px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden;">
                        <div style="height:100%;width:${rssiBar}%;background:${signalColor};border-radius:2px;"></div>
                      </div>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Timestamp -->
              <div style="background:#0f172a;border-radius:10px;padding:14px 20px;border:1px solid rgba(255,255,255,0.06);margin-bottom:24px;display:flex;align-items:center;gap:12px;">
                <span style="font-size:20px;">🕐</span>
                <div>
                  <p style="margin:0 0 2px;color:#64748b;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Detected At</p>
                  <p style="margin:0;color:#f1f5f9;font-size:14px;font-weight:600;">${time}</p>
                </div>
              </div>

              <!-- Action note -->
              <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:10px;padding:16px 20px;">
                <p style="margin:0;color:#fca5a5;font-size:13px;line-height:1.6;">
                  <strong>Action Required:</strong> Please verify the classroom immediately. The ESP32 jammer has been automatically activated. Log in to your dashboard to view details and clear the alert.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#0f172a;border-radius:0 0 16px 16px;padding:20px 32px;text-align:center;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0 0 4px;color:#475569;font-size:12px;">This is an automated alert from ExamGuard Monitoring System</p>
              <p style="margin:0;color:#334155;font-size:11px;">Do not reply to this email. Log in to your dashboard to manage alerts.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
  };
};

// ── Main export: send alert email to all admins ──
const sendAlertEmail = async (alertData) => {
  if (process.env.ALERT_EMAIL_ENABLED !== 'true') return;

  const transporter = createTransporter();
  if (!transporter) {
    console.warn('[Email] Skipping — EMAIL_USER/EMAIL_PASS not configured');
    return;
  }

  const recipients = await getAdminEmails();
  if (recipients.length === 0) {
    console.warn('[Email] No admin recipients found');
    return;
  }

  const { subject, html } = buildAlertEmail(alertData);

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"ExamGuard Alerts" <${process.env.EMAIL_USER}>`,
      to:   recipients.join(', '),
      subject,
      html,
    });
    console.log(`[Email] Alert sent to: ${recipients.join(', ')}`);
  } catch (err) {
    console.error('[Email] Failed to send alert:', err.message);
  }
};

module.exports = { sendAlertEmail };
