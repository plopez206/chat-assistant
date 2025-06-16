import 'dotenv/config';
export const {
  OPENAI_API_KEY,
  TELEGRAM_BOT_TOKEN,
  GOOGLE_CREDENTIALS_JSON,
  GOOGLE_CALENDAR_ID,
  BASE_URL,
  PORT = 3000
} = process.env;
