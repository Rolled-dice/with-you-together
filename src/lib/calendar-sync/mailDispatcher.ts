import type {
  SyncableCalendarEvent,
  CalendarAction,
  OrganizerDetails,
  AttendeeDetails,
  SmtpConfig,
  CalendarSyncResult,
} from './types';
import { icsBuilder } from './icsBuilder';

/**
 * Transactional Mail Dispatcher implementing RFC 6047 (iMIP).
 *
 * Sends calendar invitations as `multipart/alternative` MIME messages containing
 * `text/plain`, `text/html`, and `text/calendar; method=REQUEST|CANCEL` parts.
 * Compatible with AWS SES, SendGrid, Resend, or direct SMTP via Nodemailer.
 */
export class CalendarMailDispatcher {
  private readonly smtpConfig: SmtpConfig;
  private readonly organizer: OrganizerDetails;
  private transport: any = null;
  private nodemailerModule: any = null;

  constructor(smtpConfig: SmtpConfig, organizer: OrganizerDetails) {
    this.smtpConfig = smtpConfig;
    this.organizer = organizer;
  }

  /**
   * Lazily creates and caches the Nodemailer transporter.
   */
  private async getTransport(): Promise<any> {
    if (this.transport) {
      return this.transport;
    }

    try {
      if (!this.nodemailerModule) {
        try {
          const mod = 'nodemailer';
          this.nodemailerModule = await import(/* @vite-ignore */ mod);
        } catch {
          throw new Error('Nodemailer is not available in edge runtime.');
        }
      }

      this.transport = this.nodemailerModule.createTransport({
        host: this.smtpConfig.host,
        port: this.smtpConfig.port,
        secure: this.smtpConfig.secure,
        auth: {
          user: this.smtpConfig.auth.user,
          pass: this.smtpConfig.auth.pass,
        },
        pool: this.smtpConfig.pool ?? false,
        maxConnections: this.smtpConfig.maxConnections ?? 5,
      });

      return this.transport;
    } catch (error) {
      console.error('[calendar-mail] Mail transport initialization skipped/unavailable:', error);
      throw new Error(
        `[calendar-mail] Failed to initialize mail transport: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Content builders
  // ---------------------------------------------------------------------------

  /**
   * Builds a plain text fallback body for the calendar event email.
   */
  private buildTextFallback(event: SyncableCalendarEvent, action: CalendarAction): string {
    if (action === 'CANCEL') {
      return [
        `This event has been cancelled: ${event.title}`,
        '',
        `Originally scheduled: ${event.startTime.toISOString()}`,
        event.location ? `Location: ${event.location}` : '',
        '',
        '— SomeoneNear',
      ]
        .filter(Boolean)
        .join('\n');
    }

    const lines: string[] = [
      `Event: ${event.title}`,
      `When: ${event.startTime.toISOString()} — ${event.endTime.toISOString()}`,
      `Timezone: ${event.timezone}`,
    ];

    if (event.location) {
      lines.push(`Location: ${event.location}`);
    }

    if (event.description) {
      lines.push('', event.description);
    }

    lines.push('', '— SomeoneNear');
    return lines.join('\n');
  }

  /**
   * Returns a CSS color for the item type header.
   */
  private headerColorForType(event: SyncableCalendarEvent): string {
    switch (event.itemType) {
      case 'MEDICATION':
        return '#4CAF50'; // Green
      case 'LISTENER_SESSION':
        return '#2196F3'; // Blue
      case 'CHECKIN':
        return '#9C27B0'; // Purple
      default:
        return '#666666';
    }
  }

  /**
   * Formats a Date for display in the HTML email body.
   */
  private formatDateForHtml(date: Date, timezone: string): string {
    try {
      return date.toLocaleString('en-US', {
        timeZone: timezone,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      // Fallback if timezone is invalid
      return date.toISOString();
    }
  }

  /**
   * Builds a responsive HTML email card for a single event.
   * Uses table-based layout for email client compatibility (Gmail, Apple Mail, Outlook).
   */
  private buildHtmlBody(event: SyncableCalendarEvent, action: CalendarAction): string {
    const headerColor = this.headerColorForType(event);
    const startFormatted = this.formatDateForHtml(event.startTime, event.timezone);
    const endFormatted = this.formatDateForHtml(event.endTime, event.timezone);

    const cancelBanner =
      action === 'CANCEL'
        ? `<tr><td style="background-color:#f44336;color:#ffffff;padding:12px;text-align:center;font-weight:bold;font-size:16px;">This event has been cancelled</td></tr>`
        : '';

    const locationRow = event.location
      ? `<p style="margin:0 0 10px;color:#333333;"><strong>Location:</strong> ${this.escapeHtml(event.location)}</p>`
      : '';

    const descriptionRow = event.description
      ? `<p style="margin:10px 0 0;color:#555555;">${this.escapeHtml(event.description)}</p>`
      : '';

    const gcalStart = event.startTime.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const gcalEnd = event.endTime.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${gcalStart}/${gcalEnd}&details=${encodeURIComponent(event.description || '')}&location=${encodeURIComponent(event.location || '')}`;

    const actionButton = action !== 'CANCEL'
      ? `<div style="margin:20px 0 10px;text-align:center;">
           <a href="${gcalUrl}" target="_blank" style="display:inline-block;background-color:${headerColor};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:bold;font-size:14px;box-shadow:0 1px 3px rgba(0,0,0,0.2);">📅 Open in Google Calendar</a>
         </div>`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="font-family:Arial,Helvetica,sans-serif;background-color:#f4f4f4;margin:0;padding:20px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
  ${cancelBanner}
  <tr>
    <td style="background-color:${headerColor};color:#ffffff;padding:20px;text-align:center;">
      <h1 style="margin:0;font-size:22px;">${this.escapeHtml(event.title)}</h1>
    </td>
  </tr>
  <tr>
    <td style="padding:20px;">
      <p style="margin:0 0 10px;color:#333333;"><strong>Start:</strong> ${startFormatted}</p>
      <p style="margin:0 0 10px;color:#333333;"><strong>End:</strong> ${endFormatted}</p>
      <p style="margin:0 0 10px;color:#333333;"><strong>Timezone:</strong> ${this.escapeHtml(event.timezone)}</p>
      ${locationRow}
      ${descriptionRow}
      ${actionButton}
    </td>
  </tr>
  <tr>
    <td style="background-color:#eeeeee;padding:15px;text-align:center;font-size:12px;color:#888888;">
      <p style="margin:0;">Sent by <strong>SomeoneNear</strong> &bull; Calendar Sync</p>
    </td>
  </tr>
</table>
</body>
</html>`;
  }

  /**
   * Builds an HTML email body containing multiple event cards for bundled updates.
   */
  private buildHtmlBodyForBundle(
    events: Array<{ event: SyncableCalendarEvent; action: CalendarAction }>
  ): string {
    const cards = events
      .map(({ event, action }) => {
        const headerColor = this.headerColorForType(event);
        const startFormatted = this.formatDateForHtml(event.startTime, event.timezone);
        const isCancelled = action === 'CANCEL';
        const statusBadge = isCancelled
          ? `<span style="background:#f44336;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;">Cancelled</span> `
          : '';

        return `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
  <tr><td style="background-color:${headerColor};color:#ffffff;padding:14px;"><strong>${statusBadge}${this.escapeHtml(event.title)}</strong></td></tr>
  <tr><td style="padding:14px;color:#333;">
    <p style="margin:0 0 6px;"><strong>When:</strong> ${startFormatted}</p>
    ${event.location ? `<p style="margin:0 0 6px;"><strong>Where:</strong> ${this.escapeHtml(event.location)}</p>` : ''}
    ${event.description ? `<p style="margin:6px 0 0;color:#555;">${this.escapeHtml(event.description)}</p>` : ''}
  </td></tr>
</table>`;
      })
      .join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="font-family:Arial,Helvetica,sans-serif;background-color:#f4f4f4;margin:0;padding:20px;">
<div style="max-width:600px;margin:0 auto;">
  <h2 style="color:#333;margin-bottom:16px;">Calendar Updates from SomeoneNear</h2>
  ${cards}
  <p style="text-align:center;font-size:12px;color:#888;margin-top:20px;">Sent by <strong>SomeoneNear</strong> &bull; Calendar Sync</p>
</div>
</body>
</html>`;
  }

  /**
   * Escapes HTML special characters to prevent XSS in email bodies.
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Maps a CalendarAction to the iCalendar METHOD.
   */
  private getMethodFromAction(action: CalendarAction): 'REQUEST' | 'CANCEL' {
    return action === 'CANCEL' ? 'CANCEL' : 'REQUEST';
  }

  /**
   * Generates the subject line for the calendar email.
   */
  private getSubjectLine(event: SyncableCalendarEvent, action: CalendarAction): string {
    switch (action) {
      case 'CREATE':
        return `\u{1F4C5} New: ${event.title}`;
      case 'UPDATE':
        return `\u{1F4C5} Updated: ${event.title}`;
      case 'CANCEL':
        return `\u274C Cancelled: ${event.title}`;
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Sends a single calendar event as an iMIP email.
   *
   * The MIME tree is:
   * ```
   * Content-Type: multipart/alternative
   *   Part 1: text/plain
   *   Part 2: text/html
   *   Part 3: text/calendar; method=REQUEST|CANCEL
   * ```
   */
  public async sendCalendarEvent(
    event: SyncableCalendarEvent,
    action: CalendarAction,
    attendee: AttendeeDetails
  ): Promise<CalendarSyncResult> {
    const icsPayload = icsBuilder.generateIcsEvent(event, action, this.organizer, attendee);
    const apiKey = (process.env.BREVO_API_KEY || this.smtpConfig.auth.pass || '').trim();

    // If Brevo API key, SMTP pass, or Brevo host is provided, use Brevo's direct HTTPS REST API
    // which runs 100% reliably in Cloudflare Workers isolates without Node TCP socket limitations.
    if (apiKey || this.smtpConfig.host.includes('brevo')) {
      return this.sendViaBrevoApi(event, action, attendee, icsPayload);
    }

    try {
      const transport = await this.getTransport();
      const method = this.getMethodFromAction(action);

      const mailOptions = {
        from: `"${this.organizer.name}" <${this.organizer.email}>`,
        to: `"${attendee.name}" <${attendee.email}>`,
        subject: this.getSubjectLine(event, action),
        headers: {
          'X-Mailer': 'SomeoneNear-CalendarSync/1.0',
        },
        alternatives: [
          {
            contentType: 'text/plain; charset=UTF-8',
            content: this.buildTextFallback(event, action),
          },
          {
            contentType: 'text/html; charset=UTF-8',
            content: this.buildHtmlBody(event, action),
          },
          {
            contentType: `text/calendar; method=${method}; charset=UTF-8`,
            content: icsPayload,
            encoding: '7bit' as const,
            headers: {
              'Content-Class': 'urn:content-classes:calendarmessage',
            },
          },
        ],
      };

      const info = await transport.sendMail(mailOptions);

      console.log(`[calendar-mail] Sent ${action} for "${event.title}" → ${attendee.email} (${info.messageId})`);

      return {
        success: true,
        messageId: info.messageId ?? null,
        error: null,
        eventsProcessed: 1,
      };
    } catch (error: any) {
      return this.handleSmtpError(error);
    }
  }

  /**
   * Sends a single email containing multiple calendar events bundled in one VCALENDAR.
   */
  public async sendBundledCalendarEvents(
    events: Array<{ event: SyncableCalendarEvent; action: CalendarAction }>,
    attendee: AttendeeDetails
  ): Promise<CalendarSyncResult> {
    if (events.length === 0) {
      return { success: true, messageId: null, error: null, eventsProcessed: 0 };
    }

    const icsPayload = icsBuilder.generateMultiEventBundle(events, this.organizer, attendee);
    const apiKey = (process.env.BREVO_API_KEY || this.smtpConfig.auth.pass || '').trim();

    if (apiKey || this.smtpConfig.host.includes('brevo')) {
      return this.sendBundledViaBrevoApi(events, attendee, icsPayload);
    }

    try {
      const transport = await this.getTransport();
      const method = this.getMethodFromAction(events[0].action);

      const mailOptions = {
        from: `"${this.organizer.name}" <${this.organizer.email}>`,
        to: `"${attendee.name}" <${attendee.email}>`,
        subject: `\u{1F4C5} ${events.length} calendar updates from SomeoneNear`,
        headers: {
          'X-Mailer': 'SomeoneNear-CalendarSync/1.0',
        },
        alternatives: [
          {
            contentType: 'text/plain; charset=UTF-8',
            content: events.map((e) => this.buildTextFallback(e.event, e.action)).join('\n\n---\n\n'),
          },
          {
            contentType: 'text/html; charset=UTF-8',
            content: this.buildHtmlBodyForBundle(events),
          },
          {
            contentType: `text/calendar; method=${method}; charset=UTF-8`,
            content: icsPayload,
            encoding: '7bit' as const,
            headers: {
              'Content-Class': 'urn:content-classes:calendarmessage',
            },
          },
        ],
      };

      const info = await transport.sendMail(mailOptions);

      console.log(
        `[calendar-mail] Sent bundled ${events.length} events → ${attendee.email} (${info.messageId})`
      );

      return {
        success: true,
        messageId: info.messageId ?? null,
        error: null,
        eventsProcessed: events.length,
      };
    } catch (error: any) {
      return this.handleSmtpError(error);
    }
  }

  /**
   * Tests the SMTP connection. Returns true if successful, false otherwise.
   */
  public async verifyConnection(): Promise<boolean> {
    try {
      const transport = await this.getTransport();
      await transport.verify();
      console.log('[calendar-mail] SMTP connection verified successfully.');
      return true;
    } catch (error) {
      console.error('[calendar-mail] SMTP verification failed:', error);
      return false;
    }
  }

  /**
   * Dispatches calendar invite directly using Brevo's HTTPS REST API.
   * Runs in Cloudflare Workers environment without Node TCP socket dependencies.
   */
  private async sendViaBrevoApi(
    event: SyncableCalendarEvent,
    action: CalendarAction,
    attendee: AttendeeDetails,
    icsPayload: string
  ): Promise<CalendarSyncResult> {
    try {
      const base64Ics =
        typeof Buffer !== 'undefined'
          ? Buffer.from(icsPayload, 'utf-8').toString('base64')
          : btoa(unescape(encodeURIComponent(icsPayload)));

      const apiKey = (process.env.BREVO_API_KEY || this.smtpConfig.auth.pass || '').trim();
      const senderEmail = (process.env.CALENDAR_ORGANIZER_EMAIL || this.organizer.email || this.smtpConfig.auth.user || 'calendar@someonenear.com').trim();
      const senderName = this.organizer.name || 'SomeoneNear';

      const payload = {
        sender: {
          name: senderName,
          email: senderEmail,
        },
        to: [
          {
            email: attendee.email,
            name: attendee.name,
          },
        ],
        subject: this.getSubjectLine(event, action),
        htmlContent: this.buildHtmlBody(event, action),
        textContent: this.buildTextFallback(event, action),
        attachment: [
          {
            name: 'invite.ics',
            content: base64Ics,
          },
        ],
        headers: {
          'X-Mailer': 'SomeoneNear-CalendarSync/1.0',
          'Content-Class': 'urn:content-classes:calendarmessage',
        },
      };

      console.log(`[calendar-mail] Dispatching via Brevo API for "${event.title}" → ${attendee.email} (sender: ${senderEmail})`);

      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[calendar-mail] Brevo API error (${response.status}):`, errText);
        return {
          success: false,
          messageId: null,
          error: `Brevo API error (${response.status}): ${errText}`,
          eventsProcessed: 0,
        };
      }

      const data: any = await response.json();
      console.log(`[calendar-mail] Successfully sent via Brevo API: MessageId ${data?.messageId || 'ok'}`);

      return {
        success: true,
        messageId: data?.messageId ?? 'brevo-sent',
        error: null,
        eventsProcessed: 1,
      };
    } catch (err: any) {
      console.error('[calendar-mail] Brevo dispatch exception:', err);
      return {
        success: false,
        messageId: null,
        error: err?.message || 'Brevo dispatch failed',
        eventsProcessed: 0,
      };
    }
  }

  /**
   * Dispatches bundled calendar invites using Brevo's HTTPS REST API.
   */
  private async sendBundledViaBrevoApi(
    events: Array<{ event: SyncableCalendarEvent; action: CalendarAction }>,
    attendee: AttendeeDetails,
    icsPayload: string
  ): Promise<CalendarSyncResult> {
    try {
      const base64Ics =
        typeof Buffer !== 'undefined'
          ? Buffer.from(icsPayload, 'utf-8').toString('base64')
          : btoa(unescape(encodeURIComponent(icsPayload)));

      const apiKey = (process.env.BREVO_API_KEY || this.smtpConfig.auth.pass || '').trim();
      const senderEmail = (process.env.CALENDAR_ORGANIZER_EMAIL || this.organizer.email || this.smtpConfig.auth.user || 'calendar@someonenear.com').trim();
      const senderName = this.organizer.name || 'SomeoneNear';

      const payload = {
        sender: {
          name: senderName,
          email: senderEmail,
        },
        to: [
          {
            email: attendee.email,
            name: attendee.name,
          },
        ],
        subject: `\u{1F4C5} ${events.length} calendar updates from SomeoneNear`,
        htmlContent: this.buildHtmlBodyForBundle(events),
        textContent: events.map((e) => this.buildTextFallback(e.event, e.action)).join('\n\n---\n\n'),
        attachment: [
          {
            name: 'calendar-bundle.ics',
            content: base64Ics,
          },
        ],
        headers: {
          'X-Mailer': 'SomeoneNear-CalendarSync/1.0',
          'Content-Class': 'urn:content-classes:calendarmessage',
        },
      };

      console.log(`[calendar-mail] Dispatching bundle via Brevo API (${events.length} events) → ${attendee.email} (sender: ${senderEmail})`);

      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[calendar-mail] Brevo bundle API error (${response.status}):`, errText);
        return {
          success: false,
          messageId: null,
          error: `Brevo bundle API error (${response.status}): ${errText}`,
          eventsProcessed: 0,
        };
      }

      const data: any = await response.json();
      console.log(`[calendar-mail] Successfully sent bundle via Brevo API: MessageId ${data?.messageId || 'ok'}`);

      return {
        success: true,
        messageId: data?.messageId ?? 'brevo-bundle-sent',
        error: null,
        eventsProcessed: events.length,
      };
    } catch (err: any) {
      console.error('[calendar-mail] Brevo bundle dispatch exception:', err);
      return {
        success: false,
        messageId: null,
        error: err?.message || 'Brevo bundle dispatch failed',
        eventsProcessed: 0,
      };
    }
  }

  /**
   * Closes the SMTP transport and releases resources.
   */
  public async close(): Promise<void> {
    if (this.transport) {
      this.transport.close();
      this.transport = null;
      console.log('[calendar-mail] Transport closed.');
    }
  }

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------

  /**
   * Classifies SMTP errors:
   * - 5xx bounce: returns failure result (permanent)
   * - 4xx temporary: throws to allow retry
   * - Connection errors: throws with descriptive message
   */
  private handleSmtpError(error: any): CalendarSyncResult {
    const code: number | undefined = error.responseCode;
    const errorMessage = error.message ?? 'Unknown SMTP error';

    // 4xx temporary failure — throw so caller/queue can retry
    if (code && code >= 400 && code < 500) {
      console.error(`[calendar-mail] Temporary SMTP failure (${code}): ${errorMessage}`);
      throw error;
    }

    // Connection-level errors — throw for retry
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ESOCKET') {
      console.error(`[calendar-mail] SMTP connection error (${error.code}): ${errorMessage}`);
      throw new Error(`[calendar-mail] SMTP connection error: ${errorMessage}`);
    }

    // 5xx permanent bounce or other unrecoverable — return failure (don't retry)
    console.error(`[calendar-mail] Permanent SMTP error: ${errorMessage}`);
    return {
      success: false,
      messageId: null,
      error: errorMessage,
      eventsProcessed: 0,
    };
  }
}

/**
 * Factory function to create a CalendarMailDispatcher instance.
 */
export function createMailDispatcher(
  smtpConfig: SmtpConfig,
  organizer: OrganizerDetails
): CalendarMailDispatcher {
  return new CalendarMailDispatcher(smtpConfig, organizer);
}
