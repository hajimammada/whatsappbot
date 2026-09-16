require('dotenv').config();
const { createServer } = require('./server');
const waClient = require('./whatsapp_client');
const driveBackup = require('./drive_backup');

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  console.log('======================================================');
  console.log('🤖  WHATSAPP BOT - whatsappbot.hajimammad.com');
  console.log('======================================================');
  console.log(`🤖 AI Provider: ${process.env.AI_PROVIDER || 'gemini'}`);
  console.log(`⚡ Auto-Reply: ${process.env.AUTO_REPLY_ENABLED !== 'false' ? 'ENABLED' : 'DISABLED'}`);

  // Restore customer data and WhatsApp credentials from Google Drive if available
  try {
    await driveBackup.restoreFromDrive();
  } catch (err) {
    console.warn('⚠️ Google Drive restore error:', err.message);
  }

  const app = createServer();

  app.listen(PORT, async () => {
    console.log(`🌐 Web Dashboard running at: http://localhost:${PORT}`);
    console.log('------------------------------------------------------');

    // Start background auto-backup timer (every 30 mins)
    driveBackup.startAutoBackupSchedule();

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
