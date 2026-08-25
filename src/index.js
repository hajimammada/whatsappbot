require('dotenv').config();
const { createServer } = require('./server');
const waClient = require('./whatsapp_client');

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  console.log('======================================================');
  console.log('🏠  WHATSAPP REAL ESTATE AI AGENT (tap.az Assistant)');
  console.log('======================================================');
  console.log(`🤖 AI Provider: ${process.env.AI_PROVIDER || 'gemini'}`);
  console.log(`⚡ Auto-Reply: ${process.env.AUTO_REPLY_ENABLED !== 'false' ? 'ENABLED' : 'DISABLED'}`);

  const app = createServer();

  app.listen(PORT, async () => {
    console.log(`🌐 Web Dashboard running at: http://localhost:${PORT}`);
    console.log('------------------------------------------------------');
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
