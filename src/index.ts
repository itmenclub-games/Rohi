// @ts-nocheck
import 'dotenv/config';
import { createBot } from './bot';
import { createApp } from './web';

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = createBot(token);

if (bot) {
  bot.start().catch(console.error);
}

createApp();
