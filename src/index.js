import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { bot, setWebhook } from './services/telegram.js';
import apiRouter from './router/api.js';
import { PORT } from './config.js';
import { handleMessage } from './agent/clara.js';

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use('/api', apiRouter);

// Telegram webhook endpoint
app.post('/telegram/webhook', async (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text   = msg.text || '';
  const session = bot.context ??= {};   // memoria simple
  await handleMessage(bot, chatId, text, session);
});

app.listen(PORT, async () => {
  await setWebhook();
  console.log(`Al Norte agent listening on :${PORT}`);
});