import { google } from 'googleapis';
import dayjs from 'dayjs';
import {
  GOOGLE_CREDENTIALS_JSON,
  GOOGLE_CALENDAR_ID
} from '../config.js';

const creds = JSON.parse(GOOGLE_CREDENTIALS_JSON);

const jwtClient = new google.auth.JWT(
  creds.client_email,
  undefined,
  creds.private_key,
  ['https://www.googleapis.com/auth/calendar']
);
const calendar = google.calendar({ version: 'v3', auth: jwtClient });

export async function getAvailability(dateISO) {
  // Returns array of free HH:MM slots within default hours 09‑18 Europe/Madrid
  const dayStart = dayjs.tz(dateISO + ' 09:00', 'Europe/Madrid');
  const dayEnd = dayjs.tz(dateISO + ' 18:00', 'Europe/Madrid');
  const { data } = await calendar.freebusy.query({
    requestBody: {
      timeMin: dayStart.toISOString(),
      timeMax: dayEnd.toISOString(),
      items: [{ id: GOOGLE_CALENDAR_ID }]
    }
  });
  const busy = data.calendars[GOOGLE_CALENDAR_ID].busy || [];
  const slots = [];
  for (let h = 9; h < 18; h++) {
    for (let m of [0, 30]) {
      const t = dayjs.tz(dateISO + ` ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, 'Europe/Madrid');
      const overlap = busy.find(b =>
        t.isBefore(b.end) && t.add(30, 'minute').isAfter(b.start)
      );
      if (!overlap) slots.push(t.format('HH:mm'));
    }
  }
  return slots;
}

export async function bookTime(dateISO, timeHM, fullName) {
  const start = dayjs.tz(`${dateISO} ${timeHM}`, 'Europe/Madrid');
  const event = {
    summary: `Cita – ${fullName}`,
    start: { dateTime: start.toISOString(), timeZone: 'Europe/Madrid' },
    end: { dateTime: start.add(30, 'minute').toISOString(), timeZone: 'Europe/Madrid' }
  };
  try {
    const { data } = await calendar.events.insert({
      calendarId: GOOGLE_CALENDAR_ID,
      requestBody: event
    });
    return { ok: true, id: data.id };
  } catch (err) {
    if (err.code === 409) {
      return { ok: false, conflict: true };
    }
    throw err;
  }
}