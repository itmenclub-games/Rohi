// @ts-nocheck
import 'dotenv/config';
import { createBot } from './bot';
import { createApp, startServer } from './web';

console.log('=== ROHI BOT STARTUP ===');
console.log('Time:', new Date().toISOString());

if (!process.env.NODE_ENV) process.env.NODE_ENV = 'production';
if (!process.env.PORT) process.env.PORT = '3000';

const token = process.env.TELEGRAM_BOT_TOKEN;
const adminPassword = process.env.ADMIN_PASSWORD;

console.log('\n--- Environment Configuration ---');
console.log('PORT:', process.env.PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('TELEGRAM_BOT_TOKEN:', token ? 'Set' : 'Missing');
console.log('ADMIN_PASSWORD:', adminPassword ? 'Set' : 'Missing');
console.log('RAILWAY_PUBLIC_DOMAIN:', process.env.RAILWAY_PUBLIC_DOMAIN || 'Not set (local)');
console.log('WEBHOOK_PATH:', process.env.WEBHOOK_PATH || '/api/telegram/webhook (default)');

const errors: string[] = [];
if (!token) errors.push('TELEGRAM_BOT_TOKEN is required for Telegram bot');
if (!adminPassword) errors.push('ADMIN_PASSWORD is required for admin dashboard');

if (errors.length > 0) {
  console.error('\nCRITICAL ERRORS:');
  errors.forEach(err => console.error('  •', err));
  console.log('\nPlease check your environment variables and try again.');
  process.exit(1);
}

try {
  const bot = createBot(token);
  console.log('\nBot initialization complete');

  const { app, port } = createApp();
  console.log('Web app initialized');

  const server = startServer(app, port);
  console.log(`Server running on port ${port}`);

  if (bot) {
    const domain = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RAILWAY_URL || process.env.HOSTNAME;
    if (domain) {
      const webhookPath = process.env.WEBHOOK_PATH || '/api/telegram/webhook';
      const cleanPath = webhookPath.startsWith('/') ? webhookPath : `/${webhookPath}`;
      const webhookUrl = `https://${domain}${cleanPath}`;

      console.log('\nSetting up Telegram webhook...');
      console.log('Webhook URL:', webhookUrl);

      bot.api.setWebhook(webhookUrl).then(() => {
        console.log('Webhook set successfully');
        console.log('Telegram bot is live and accepting updates');
      }).catch((e: any) => {
        console.error('Failed to set webhook:', e.message);
        console.log('\nWebhook setup failed. Bot will use polling instead.');
        bot.start().catch(err => console.error('Polling setup failed:', err));
      });
    } else {
      console.log('\nLocal mode: No domain detected');
      console.log('Bot will use polling for development');
      if (bot) bot.start().catch(err => console.error('Polling failed:', err));
    }
  }

  console.log('\n=== ACCESS INFORMATION ===');
  console.log(`Admin Dashboard: http://localhost:${port}/`);
  console.log(`Health Check: http://localhost:${port}/api/health`);
  console.log(`API Requests: http://localhost:${port}/api/requests`);
  console.log(`Admin API: http://localhost:${port}/api/admin/methods`);
  let webhookLogPath = 'api/telegram/webhook';
  if (process.env.WEBHOOK_PATH) {
    webhookLogPath = process.env.WEBHOOK_PATH.startsWith('/') ? process.env.WEBHOOK_PATH.slice(1) : process.env.WEBHOOK_PATH;
  }
  console.log(`Telegram Webhook: http://localhost:${port}/${webhookLogPath}`);

  console.log('\nROHI application is running successfully!');
  console.log('\n=== TESTING CHECKLIST ===');
  console.log('1. Test dashboard: http://localhost:' + port + '/');
  console.log('2. Check health: http://localhost:' + port + '/api/health');
  console.log('3. Check admin API: http://localhost:' + port + '/api/admin/methods');
  console.log('4. For Telegram (if using webhook): https://t.me/<your_bot_username>');
} catch (error) {
  console.error('\nFATAL ERROR:', (error as Error).message);
  console.error('Stack trace:', (error as Error).stack);
  process.exit(1);
}
