import dayjs from 'dayjs';
import customParse from 'dayjs/plugin/customParseFormat.js';
import utc from 'dayjs/plugin/utc.js';
import tz from 'dayjs/plugin/timezone.js';
import { chatCompletion } from '../services/openai.js';
import { getAvailability, bookTime } from '../services/calendar.js';

dayjs.extend(customParse);
dayjs.extend(utc);
dayjs.extend(tz);

const SYS_PROMPT = `Eres Clara, consultora carismática de Al Norte. Sigue estrictamente:
1. Haz preguntas iniciales suaves.
2. Explica beneficios solo si te lo piden.
3. Llama a /now al principio de cada conversación para anclar fecha.
4. Workflow de reserva: confirma nombre‑fecha‑hora, llama getAvailability, etc.
5. Español o inglés según el usuario.
6. Usa «Deme un segundo…» cada vez que llames a funciones.
7. Maneja errores como en documentación.`;

// Few‑shot dialog extracted from real salon chats
const FEWSHOT_DIALOG = [
  { role: 'user', content: 'buenas' },
  { role: 'user', content: 'tendrias alguna hora para cortar mañana el pelo?' },
  { role: 'user', content: 'por la tarde' },
  { role: 'assistant', content: 'Tengo un único hueco mañana a las 19:00 o jueves a las 16:00' },
  { role: 'user', content: 'Dame para mañana a las 7 porfa' },
  { role: 'assistant', content: 'Muy buenas compi' },
  { role: 'assistant', content: 'Ya no me queda disponible, 18:30 te valdría?' },
  { role: 'user', content: 'perfecto' },
  { role: 'user', content: 'muchas gracias' },
  { role: 'assistant', content: '18:30 para mañana jueves sería' },
  { role: 'user', content: 'ah, no entonces imposible' },
  { role: 'user', content: 'buenas, tendrias cita para cortar el próximo miercoles?' },
  { role: 'assistant', content: 'Muy buenas pablo!' },
  { role: 'assistant', content: 'Miércoles 17?' },
  { role: 'user', content: 'miercoles 9' },
  { role: 'assistant', content: 'Bien' },
  { role: 'assistant', content: 'Miércoles a las 16:00?' },
  { role: 'user', content: 'Perfecto' },
  { role: 'assistant', content: 'Venga pues te apunto ahora ✌️😉' },
  { role: 'user', content: 'graciass!!' },
  { role: 'assistant', content: 'Buenas pablo , comentarte que hoy no abriremos por motivos de salud te parece si te paso la cita para mañana ?' },
  { role: 'assistant', content: 'O viernes a las 16:00?' },
  { role: 'user', content: 'Imposible' },
  { role: 'user', content: 'Mañana tendria q ser psadas las 7' },
  { role: 'assistant', content: 'Mañana a las 19:00 te apunto apunto ahora mismo que estoy con todas las citas' },
  { role: 'user', content: 'vale gracias' },
  { role: 'user', content: 'Buenas, tendrias hora pra cortar el pelo el viernes de la semana que viene?' },
  { role: 'assistant', content: 'Muy buenas tio!' },
  { role: 'assistant', content: 'A las 16:00?' },
  { role: 'assistant', content: 'Como lo ves' },
  { role: 'user', content: 'Podria ser por la mañana?' },
  { role: 'assistant', content: 'Viernes 7 a las 12:00?' },
  { role: 'user', content: 'Perfecto' },
  { role: 'assistant', content: 'Listo compi, buenas noches!' },
  { role: 'user', content: 'buenas noches!' },
  { role: 'assistant', content: 'Muy buenas pablo , perdona que no me fije y este viernes tengo médico por la mañana , te importa si miramos para la tarde o sábado por la mañana ? De 9:00 a 20:00' },
  { role: 'user', content: 'Por la tarde a que hora seria?' },
  { role: 'user', content: 'Es que tengo una graduación a las 6' },
  { role: 'assistant', content: 'Jueves a las 16:00 como lo ves?' },
  { role: 'user', content: 'No puedo, el jueves tengo le ebau' },
  { role: 'assistant', content: 'Viernes a las 16:00 lo más pronto' },
  { role: 'user', content: 'vale' },
  { role: 'assistant', content: 'Apuntado!' },
  { role: 'assistant', content: 'Muy buenas compi, por si te quieres pasar antes estoy libre ya 😉' },
  { role: 'user', content: 'okey' },
  { role: 'user', content: 'ahora voy' }
];

const FUNCTIONS = [
  {
    name: 'now',
    description: 'Devuelve la fecha y hora actuales Europe/Madrid',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'getAvailability',
    description: 'Devuelve array de horas libres HH:MM para Date',
    parameters: {
      type: 'object',
      properties: { Date: { type: 'string', description: 'YYYY-MM-DD' } },
      required: ['Date']
    }
  },
  {
    name: 'bookingTime',
    description: 'Reserva un hueco',
    parameters: {
      type: 'object',
      properties: {
        Date: { type: 'string' },
        Time: { type: 'string' },
        fullName: { type: 'string' }
      },
      required: ['Date', 'Time', 'fullName']
    }
  }
];

export async function handleMessage(chatId, text, session) {
  // session = { messages: [] }
  session.messages ??= [];
  session.messages.push({ role: 'user', content: text });

  let reply;
  let loopGuard = 0;

  const baseMessages = [
    { role: 'system', content: SYS_PROMPT },
    ...FEWSHOT_DIALOG,
    ...session.messages
  ];

  while (!reply && loopGuard++ < 5) {
    const aiMsg = await chatCompletion({ messages: baseMessages, functions: FUNCTIONS });

    if (aiMsg.content) {
      reply = aiMsg.content;
    }

    if (aiMsg.function_call) {
      const fn = aiMsg.function_call.name;
      const args = JSON.parse(aiMsg.function_call.arguments || '{}');
      let result;
      if (fn === 'now') {
        result = { now: dayjs().tz('Europe/Madrid').format('YYYY-MM-DD, HH:mm') };
      } else if (fn === 'getAvailability') {
        result = await getAvailability(args.Date);
      } else if (fn === 'bookingTime') {
        result = await bookTime(args.Date, args.Time, args.fullName);
      }
      session.messages.push({ role: 'assistant', name: fn, content: JSON.stringify(result) });
    }
  }

  if (!reply) reply = 'Lo siento, algo ha fallado.';
  return reply;
}