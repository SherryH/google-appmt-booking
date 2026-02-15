import { Resend } from 'resend';

let resend = null;

export function initNotifier(apiKey) {
  if (!apiKey) {
    console.warn('⚠️  No Resend API key provided - emails disabled');
    return;
  }
  resend = new Resend(apiKey);
}

export function isNotifierReady() {
  return resend !== null;
}

export function shouldNotifyFailure(consecutiveFailures) {
  return consecutiveFailures > 0 && consecutiveFailures % 3 === 0;
}

export function formatFailureEmail(reason, consecutiveFailures, availableSlots = []) {
  return {
    subject: `⚠️ Booking Issue (${consecutiveFailures} consecutive failures)`,
    html: `
      <h1>Booking encountered an issue</h1>
      <p><strong>Reason:</strong> ${reason}</p>
      <p><strong>Consecutive failures:</strong> ${consecutiveFailures}</p>
      ${availableSlots.length > 0 ? `
        <p><strong>Available slots were:</strong></p>
        <ul>
          ${availableSlots.map(s => `<li>${s}</li>`).join('')}
        </ul>
      ` : ''}
      <p>The bot will retry tomorrow at midnight.</p>
      <hr>
      <p style="color: #666; font-size: 12px;">
        Sent by Therapist Appointment Booker
      </p>
    `
  };
}

export async function sendEmail(to, { subject, html }) {
  if (!resend) {
    console.log(`📧 [MOCK] Would send email to ${to}: ${subject}`);
    return { success: true, mock: true };
  }

  try {
    const result = await resend.emails.send({
      from: 'Booking Bot <onboarding@resend.dev>',
      to,
      subject,
      html
    });
    console.log(`📧 Email sent: ${subject}`);
    return { success: true, id: result.id };
  } catch (error) {
    console.error(`📧 Email failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

export async function sendBookingFailure(email, reason, consecutiveFailures, availableSlots) {
  const content = formatFailureEmail(reason, consecutiveFailures, availableSlots);
  return sendEmail(email, content);
}
