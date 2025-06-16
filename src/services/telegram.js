import TelegramBot from 'node-telegram-bot-api';
import { TELEGRAM_BOT_TOKEN, BASE_URL } from '../config.js';

export const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });
// Webhook will be set on startup
export function setWebhook() {
  return bot.setWebHook(`${BASE_URL}/telegram/webhook`);
}