import type { SyncableCalendarEvent, CalendarAction, OrganizerDetails, AttendeeDetails } from './types';

/**
 * Standards-Compliant ICS Generator following RFC 5545, RFC 5546, and RFC 6047.
 */
export class IcsBuilder {
    /**
     * Implements RFC 5545 §3.1 line folding: lines exceeding 75 OCTETS (bytes) must be folded.
     * Folds by inserting CRLF + single space at the 75-byte boundary.
     * Does not split multi-byte UTF-8 characters.
     */
    private foldLine(line: string): string {
        const MAX_BYTES = 75;
        const encoder = new TextEncoder();
        const decoder = new TextDecoder('utf-8');
        
        let bytes = encoder.encode(line);
        if (bytes.length <= MAX_BYTES) {
            return line;
        }

        const lines: string[] = [];
        while (bytes.length > 0) {
            let limit = lines.length === 0 ? MAX_BYTES : MAX_BYTES - 1;
            
            let take = Math.min(bytes.length, limit);
            
            if (take < bytes.length) {
                // Ensure we do not break inside a multi-byte character
                // A UTF-8 continuation byte starts with '10' (binary), which is 0x80 to 0xBF.
                while (take > 0 && (bytes[take] & 0xC0) === 0x80) {
                    take--;
                }
            }

            const chunk = decoder.decode(bytes.slice(0, take));
            lines.push(chunk);
            bytes = bytes.slice(take);
        }

        return lines.join('\r\n ');
    }

    /**
     * Escapes RFC 5545 reserved characters in text properties.
     */
    private escapeText(text: string): string {
        return text
            .replace(/\\/g, '\\\\')
            .replace(/;/g, '\\;')
            .replace(/,/g, '\\,')
            .replace(/\r?\n/g, '\\n');
    }

    /**
     * Returns TZID=<timezone>:<YYYYMMDD>T<HHMMSS> format.
     */
    private formatDateWithTZ(date: Date, timezone: string): string {
        const pad = (n: number) => n.toString().padStart(2, '0');
        const year = date.getFullYear();
        const month = pad(date.getMonth() + 1);
        const day = pad(date.getDate());
        const hours = pad(date.getHours());
        const minutes = pad(date.getMinutes());
        const seconds = pad(date.getSeconds());

        return `TZID=${timezone}:${year}${month}${day}T${hours}${minutes}${seconds}`;
    }

    /**
     * Returns <YYYYMMDD>T<HHMMSS>Z format for UTC dates.
     */
    private formatDateUTC(date: Date): string {
        const pad = (n: number) => n.toString().padStart(2, '0');
        const year = date.getUTCFullYear();
        const month = pad(date.getUTCMonth() + 1);
        const day = pad(date.getUTCDate());
        const hours = pad(date.getUTCHours());
        const minutes = pad(date.getUTCMinutes());
        const seconds = pad(date.getUTCSeconds());

        return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
    }

    /**
     * Returns current UTC timestamp in YYYYMMDDTHHMMSSZ format.
     */
    private generateDtstamp(): string {
        return this.formatDateUTC(new Date());
    }

    /**
     * Returns a complete VALARM block.
     */
    private buildVAlarm(minutesBefore: number, description: string): string {
        const escapedDescription = this.escapeText(description);
        const alarmLines = [
            'BEGIN:VALARM',
            `TRIGGER:-PT${minutesBefore}M`,
            'ACTION:DISPLAY',
            `DESCRIPTION:${escapedDescription}`,
            'END:VALARM'
        ];
        return alarmLines.map(line => this.foldLine(line)).join('\r\n') + '\r\n';
    }

    /**
     * Builds a complete VEVENT block.
     */
    private buildVEvent(
        event: SyncableCalendarEvent,
        action: CalendarAction,
        organizer: OrganizerDetails,
        attendee: AttendeeDetails
    ): string {
        const status = action === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED';
        
        const lines = [
            'BEGIN:VEVENT',
            `UID:${event.externalUid}`,
            `DTSTAMP:${this.generateDtstamp()}`,
            `DTSTART;${this.formatDateWithTZ(event.startTime, event.timezone)}`,
            `DTEND;${this.formatDateWithTZ(event.endTime, event.timezone)}`,
            `SEQUENCE:${event.sequence}`,
            `SUMMARY:${this.escapeText(event.title)}`,
            `DESCRIPTION:${this.escapeText(event.description || '')}`
        ];

        if (event.location) {
            lines.push(`LOCATION:${this.escapeText(event.location)}`);
        }

        lines.push(`STATUS:${status}`);
        lines.push(`ORGANIZER;CN=${this.escapeText(organizer.name)}:mailto:${organizer.email}`);
        
        // Standard RFC 5545 attendee attributes for calendar clients
        const rsvp = action !== 'CANCEL' ? 'TRUE' : 'FALSE';
        lines.push(`ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=${rsvp};CN=${this.escapeText(attendee.name)}:mailto:${attendee.email}`);

        if (event.rrule) {
            lines.push(`RRULE:${event.rrule}`);
        }

        let result = lines.map(line => this.foldLine(line)).join('\r\n') + '\r\n';

        if (action !== 'CANCEL' && event.alarmMinutesBefore !== undefined && event.alarmMinutesBefore > 0) {
            result += this.buildVAlarm(event.alarmMinutesBefore, `Reminder: ${event.title}`);
        }

        result += this.foldLine('END:VEVENT') + '\r\n';

        return result;
    }

    /**
     * Wraps a single VEVENT in a full VCALENDAR.
     */
    public generateIcsEvent(
        event: SyncableCalendarEvent,
        action: CalendarAction,
        organizer: OrganizerDetails,
        attendee: AttendeeDetails
    ): string {
        const method = action === 'CANCEL' ? 'CANCEL' : 'REQUEST';
        
        const header = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//SomeoneNear//CalendarSync//EN',
            'CALSCALE:GREGORIAN',
            `METHOD:${method}`
        ].map(line => this.foldLine(line)).join('\r\n') + '\r\n';

        const vevent = this.buildVEvent(event, action, organizer, attendee);
        
        const footer = this.foldLine('END:VCALENDAR') + '\r\n';

        return header + vevent + footer;
    }

    /**
     * Creates a single VCALENDAR containing multiple VEVENT blocks.
     */
    public generateMultiEventBundle(
        events: Array<{ event: SyncableCalendarEvent; action: CalendarAction }>,
        organizer: OrganizerDetails,
        attendee: AttendeeDetails
    ): string {
        if (events.length === 0) {
            throw new Error('Cannot generate multi-event bundle with zero events.');
        }

        const method = events[0].action === 'CANCEL' ? 'CANCEL' : 'REQUEST';
        
        for (const { action } of events) {
            const currentMethod = action === 'CANCEL' ? 'CANCEL' : 'REQUEST';
            if (currentMethod !== method) {
                throw new Error('All events in a bundle MUST share the same METHOD (REQUEST or CANCEL).');
            }
        }

        let output = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//SomeoneNear//CalendarSync//EN',
            'CALSCALE:GREGORIAN',
            `METHOD:${method}`
        ].map(line => this.foldLine(line)).join('\r\n') + '\r\n';

        for (const { event, action } of events) {
            output += this.buildVEvent(event, action, organizer, attendee);
        }

        output += this.foldLine('END:VCALENDAR') + '\r\n';

        return output;
    }
}

export const icsBuilder = new IcsBuilder();
