require('dotenv').config();
const { createServer } = require('./server');
const waClient = require('./whatsapp_client');
const mongoService = require('./mongo_service');

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  console.log('======================================================');
  console.log('🤖  WHATSAPP BOT - whatsappbot.hajimammad.com');
  console.log('======================================================');
  console.log(`🤖 AI Provider: ${process.env.AI_PROVIDER || 'gemini'}`);
  console.log(`⚡ Auto-Reply: ${process.env.AUTO_REPLY_ENABLED !== 'false' ? 'ENABLED' : 'DISABLED'}`);

  // Initialize MongoDB Atlas connection & restore customer data and WhatsApp credentials
  try {
    const mongoOk = await mongoService.init();
    if (mongoOk) {
      await mongoService.restoreFromMongo();
    }
  } catch (err) {
    console.warn('⚠️ MongoDB initialization/restore error:', err.message);
  }

  const app = createServer();

  app.listen(PORT, async () => {
    console.log(`🌐 Web Dashboard running at: http://localhost:${PORT}`);
    console.log('------------------------------------------------------');

    // Start background auto-sync timer (every 15 mins)
    mongoService.startAutoSyncSchedule();

    console.log('Initializing WhatsApp connection...');

    try {
      await waClient.start();
    } catch (err) {
      console.error('Failed to initialize WhatsApp client:', err);
    }
  });
}

bootstrap().catch((err) => {
  console.error('Fatal error during startup:', err);
  process.exit(1);
});
