import express from 'express';
import dayjs from 'dayjs';
import { getAvailability, bookTime } from '../services/calendar.js';

const router = express.Router();

router.get('/now', (_, res) => {
  return res.json({ now: dayjs().tz('Europe/Madrid').format('YYYY-MM-DD, HH:mm') });
});

router.post('/getAvailability', async (req, res, next) => {
  try {
    const { Date } = req.body;
    const avail = await getAvailability(Date);
    res.json(avail);
  } catch (e) { next(e); }
});

router.post('/bookingTime', async (req, res, next) => {
  try {
    const { Date, Time, fullName } = req.body;
    const result = await bookTime(Date, Time, fullName);
    if (!result.ok) return res.status(409).json({ message: 'conflict' });
    res.json(result);
  } catch (e) { next(e); }
});

export default router;
