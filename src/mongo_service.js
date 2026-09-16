/**
 * MongoDB Atlas Cloud Persistence Service
 * WhatsApp Bot - whatsappbot.hajimammad.com
 * 
 * Features:
 * - Direct real-time cloud persistence for customer messages and leads
 * - WhatsApp Baileys session preservation across container redeployments
 * - Automatic startup restore for ephemeral cloud environments (Render, VPS, Docker)
 * - Knowledge Base documents and personal settings synchronization
 * - Resilient offline fallback if MongoDB is unreachable
 */

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const DATA_DIR = path.join(__dirname, '..', 'data');
const AUTH_DIR = path.join(__dirname, '..', 'auth_info_baileys');

const LEADS_FILE = path.join(DATA_DIR, 'leads.json');
const USERS_DB_FILE = path.join(DATA_DIR, 'users_db.json');
const LID_MAPPINGS_FILE = path.join(DATA_DIR, 'lid_mappings.json');

const DEFAULT_MONGO_URI = 'mongodb+srv://aliyevhack_db_user:3jGATmdfGpTO8LSI@cluster0whatsappbot.0yn5amm.mongodb.net/whatsappbot?retryWrites=true&w=majority&appName=Cluster0whatsappbot';

class MongoPersistenceService {
  constructor() {
    this.uri = process.env.MONGODB_URI || process.env.MONGO_URI || DEFAULT_MONGO_URI;
    this.client = null;
    this.db = null;
    this.isConnected = false;
    this.isSyncing = false;
    this.lastSyncAt = null;
    this.lastSyncStatus = 'idle'; // 'idle' | 'success' | 'error' | 'in_progress'
    this.lastSyncError = null;
    this.syncDebounceTimer = null;
    this.periodicTimer = null;
  }

  isConfigured() {
    return Boolean(this.uri && this.uri.trim());
  }

  async init() {
    if (!this.isConfigured()) {
      console.log('ℹ️ [MongoDB] No MONGODB_URI configured. Running with local disk only.');
      return false;
    }

    try {
      console.log('🍃 [MongoDB] Connecting to MongoDB Atlas cluster...');
      this.client = new MongoClient(this.uri, {
        serverSelectionTimeoutMS: 8000,
        connectTimeoutMS: 10000
      });
      await this.client.connect();
      this.db = this.client.db('whatsappbot');
      this.isConnected = true;
      console.log('✅ [MongoDB] Connected successfully to MongoDB Atlas database: whatsappbot');
      return true;
    } catch (err) {
      this.isConnected = false;
      this.lastSyncError = err.message;
      console.warn('⚠️ [MongoDB] Could not connect to MongoDB Atlas, falling back to local files:', err.message);
      return false;
    }
  }

  getStatus() {
    return {
      configured: this.isConfigured(),
      connected: this.isConnected,
      provider: 'MongoDB Atlas',
      lastSyncAt: this.lastSyncAt,
      lastSyncStatus: this.lastSyncStatus,
      lastSyncError: this.lastSyncError,
      isSyncing: this.isSyncing
    };
  }

  /**
   * Bundles all Baileys authentication files into an in-memory dictionary
   */
  _serializeSession() {
    try {
      if (!fs.existsSync(AUTH_DIR)) return null;
      const files = fs.readdirSync(AUTH_DIR);
      if (files.length === 0) return null;
      const bundle = {};
      let count = 0;
      for (const file of files) {
        if (file === 'trash') continue;
        const full = path.join(AUTH_DIR, file);
        if (fs.statSync(full).isFile()) {
          bundle[file] = fs.readFileSync(full).toString('base64');
          count++;
        }
      }
      return count > 0 ? bundle : null;
    } catch (e) {
      console.warn('[MongoDB] Error serializing Baileys session:', e.message);
      return null;
    }
  }

  /**
   * Restores Baileys authentication files from an in-memory dictionary
   */
  _restoreSession(bundle) {
    try {
      if (!bundle || typeof bundle !== 'object') return 0;
      if (!fs.existsSync(AUTH_DIR)) {
        fs.mkdirSync(AUTH_DIR, { recursive: true });
      }
      let restoredCount = 0;
      for (const [filename, b64] of Object.entries(bundle)) {
        const safeName = path.basename(filename);
        if (safeName && b64) {
          fs.writeFileSync(path.join(AUTH_DIR, safeName), Buffer.from(b64, 'base64'));
          restoredCount++;
        }
      }
      return restoredCount;
    } catch (e) {
      console.warn('[MongoDB] Error restoring Baileys session:', e.message);
      return 0;
    }
  }

  /**
   * Startup Auto-Restore: Restores leads, documents, and WhatsApp session from MongoDB to local disk.
   * Runs at boot before server listens and before WhatsApp client initializes.
   */
  async restoreFromMongo() {
    if (!this.isConnected || !this.db) {
      console.log('ℹ️ [MongoDB] MongoDB not connected, skipping restore.');
      return { restored: false, reason: 'not_connected' };
    }

    try {
      console.log('🍃 [MongoDB] Checking MongoDB for customer leads and session data...');
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      // 1. Restore Leads & Message Histories
      const leadsCol = this.db.collection('leads');
      const remoteLeads = await leadsCol.find({}).toArray();

      let localLeads = [];
      if (fs.existsSync(LEADS_FILE)) {
        try { localLeads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8') || '[]'); } catch (e) {}
      }

      if (remoteLeads.length > 0 && (!localLeads || localLeads.length === 0)) {
        // Remove MongoDB _id before saving to local disk
        const cleanLeads = remoteLeads.map(l => {
          const { _id, ...rest } = l;
          return rest;
        });
        fs.writeFileSync(LEADS_FILE, JSON.stringify(cleanLeads, null, 2), 'utf-8');
        console.log(`   ✅ Restored ${cleanLeads.length} leads & message histories from MongoDB to local disk.`);
      } else if (localLeads.length > 0 && remoteLeads.length === 0) {
        // Seed MongoDB from local disk if remote is empty
        console.log(`   🌱 Seeding MongoDB leads collection with ${localLeads.length} local leads...`);
        await this.syncLeads(localLeads);
      }

      // 2. Restore Users Database & Knowledge Base Documents
      const usersCol = this.db.collection('users_db');
      const remoteUsersDoc = await usersCol.findOne({ _key: 'primary_users_db' });

      let localUsersDb = null;
      if (fs.existsSync(USERS_DB_FILE)) {
        try { localUsersDb = JSON.parse(fs.readFileSync(USERS_DB_FILE, 'utf-8') || '{}'); } catch (e) {}
      }

      if (remoteUsersDoc && remoteUsersDoc.data && (!localUsersDb || !localUsersDb.users || Object.keys(localUsersDb.users).length === 0)) {
        fs.writeFileSync(USERS_DB_FILE, JSON.stringify(remoteUsersDoc.data, null, 2), 'utf-8');
        console.log(`   ✅ Restored Users DB & Knowledge Base from MongoDB to local disk.`);
      } else if (localUsersDb && localUsersDb.users && Object.keys(localUsersDb.users).length > 0 && !remoteUsersDoc) {
        await usersCol.updateOne(
          { _key: 'primary_users_db' },
          { $set: { _key: 'primary_users_db', data: localUsersDb, updatedAt: new Date() } },
          { upsert: true }
        );
      }

      // 3. Restore LID Mappings
      const lidCol = this.db.collection('lid_mappings');
      const remoteLidDoc = await lidCol.findOne({ _key: 'primary_lid_mappings' });

      let localLids = null;
      if (fs.existsSync(LID_MAPPINGS_FILE)) {
        try { localLids = JSON.parse(fs.readFileSync(LID_MAPPINGS_FILE, 'utf-8') || '{}'); } catch (e) {}
      }

      if (remoteLidDoc && remoteLidDoc.data && (!localLids || Object.keys(localLids).length === 0)) {
        fs.writeFileSync(LID_MAPPINGS_FILE, JSON.stringify(remoteLidDoc.data, null, 2), 'utf-8');
        console.log(`   ✅ Restored LID mappings from MongoDB.`);
      } else if (localLids && Object.keys(localLids).length > 0 && !remoteLidDoc) {
        await lidCol.updateOne(
          { _key: 'primary_lid_mappings' },
          { $set: { _key: 'primary_lid_mappings', data: localLids, updatedAt: new Date() } },
          { upsert: true }
        );
      }

      // 4. Restore WhatsApp Baileys Session Credentials
      const sessionCol = this.db.collection('whatsapp_sessions');
      const remoteSessionDoc = await sessionCol.findOne({ _key: 'active_session' });
      const localHasSession = fs.existsSync(path.join(AUTH_DIR, 'creds.json'));

      let sessionRestoredCount = 0;
      if (remoteSessionDoc && remoteSessionDoc.files && !localHasSession) {
        console.log(`   ⬇️ Restoring WhatsApp Baileys session from MongoDB...`);
        sessionRestoredCount = this._restoreSession(remoteSessionDoc.files);
        if (sessionRestoredCount > 0) {
          console.log(`   🎉 WhatsApp session restored (${sessionRestoredCount} credential files) - No QR scan needed!`);
        }
      } else if (localHasSession && !remoteSessionDoc) {
        const localBundle = this._serializeSession();
        if (localBundle) {
          await sessionCol.updateOne(
            { _key: 'active_session' },
            { $set: { _key: 'active_session', files: localBundle, updatedAt: new Date() } },
            { upsert: true }
          );
        }
      }

      this.lastSyncAt = new Date().toISOString();
      this.lastSyncStatus = 'success';
      console.log('🎉 [MongoDB] Startup data restoration complete.');
      return { restored: true, leadsCount: remoteLeads.length, sessionKeys: sessionRestoredCount };
    } catch (err) {
      console.error('❌ [MongoDB] Error restoring from MongoDB:', err.message);
      this.lastSyncStatus = 'error';
      this.lastSyncError = err.message;
      return { restored: false, error: err.message };
    }
  }

  /**
   * Syncs all leads to MongoDB (debounced to avoid database write thrashing)
   */
  async syncLeads(leads) {
    if (!this.isConnected || !this.db || !Array.isArray(leads)) return;

    try {
      const col = this.db.collection('leads');
      for (const lead of leads) {
        const query = lead.id ? { id: lead.id } : { phoneNumber: lead.phoneNumber };
        await col.updateOne(query, { $set: lead }, { upsert: true });
      }
      this.lastSyncAt = new Date().toISOString();
      this.lastSyncStatus = 'success';
    } catch (err) {
      console.warn('⚠️ [MongoDB] Error syncing leads:', err.message);
      this.lastSyncStatus = 'error';
      this.lastSyncError = err.message;
    }
  }

  /**
   * Syncs users DB & knowledge base documents to MongoDB
   */
  async syncUsers(dbData) {
    if (!this.isConnected || !this.db || !dbData) return;

    try {
      const col = this.db.collection('users_db');
      await col.updateOne(
        { _key: 'primary_users_db' },
        { $set: { _key: 'primary_users_db', data: dbData, updatedAt: new Date() } },
        { upsert: true }
      );
      this.lastSyncAt = new Date().toISOString();
      this.lastSyncStatus = 'success';
    } catch (err) {
      console.warn('⚠️ [MongoDB] Error syncing users DB:', err.message);
    }
  }

  /**
   * Syncs WhatsApp Baileys session to MongoDB
   */
  async syncSession() {
    if (!this.isConnected || !this.db) return;

    try {
      const bundle = this._serializeSession();
      if (!bundle) return;

      const col = this.db.collection('whatsapp_sessions');
      await col.updateOne(
        { _key: 'active_session' },
        { $set: { _key: 'active_session', files: bundle, updatedAt: new Date() } },
        { upsert: true }
      );
      this.lastSyncAt = new Date().toISOString();
      this.lastSyncStatus = 'success';
      console.log('☁️ [MongoDB] WhatsApp Baileys session backed up to MongoDB Atlas.');
    } catch (err) {
      console.warn('⚠️ [MongoDB] Error syncing WhatsApp session:', err.message);
    }
  }

  /**
   * Syncs LID mappings to MongoDB
   */
  async syncLidMappings(mappingsObj) {
    if (!this.isConnected || !this.db || !mappingsObj) return;

    try {
      const col = this.db.collection('lid_mappings');
      await col.updateOne(
        { _key: 'primary_lid_mappings' },
        { $set: { _key: 'primary_lid_mappings', data: mappingsObj, updatedAt: new Date() } },
        { upsert: true }
      );
    } catch (err) {
      console.warn('⚠️ [MongoDB] Error syncing LID mappings:', err.message);
    }
  }

  /**
   * Debounced full sync: Syncs all local files to MongoDB
   */
  triggerSync(delayMs = 15000) {
    if (!this.isConnected) return;

    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }

    this.syncDebounceTimer = setTimeout(() => {
      this.syncAll().catch(e => console.warn('⚠️ [MongoDB] Debounced sync error:', e.message));
    }, delayMs);
  }

  /**
   * Forces an immediate full backup of local disk data to MongoDB
   */
  async syncAll() {
    if (!this.isConnected || !this.db) {
      return { success: false, reason: 'not_connected' };
    }

    this.isSyncing = true;
    try {
      let syncedCount = 0;

      // 1. Sync Leads
      if (fs.existsSync(LEADS_FILE)) {
        const leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8') || '[]');
        if (leads.length > 0) {
          await this.syncLeads(leads);
          syncedCount++;
        }
      }

      // 2. Sync Users DB
      if (fs.existsSync(USERS_DB_FILE)) {
        const users = JSON.parse(fs.readFileSync(USERS_DB_FILE, 'utf-8') || '{}');
        if (users.users) {
          await this.syncUsers(users);
          syncedCount++;
        }
      }

      // 3. Sync LID Mappings
      if (fs.existsSync(LID_MAPPINGS_FILE)) {
        const lids = JSON.parse(fs.readFileSync(LID_MAPPINGS_FILE, 'utf-8') || '{}');
        if (Object.keys(lids).length > 0) {
          await this.syncLidMappings(lids);
          syncedCount++;
        }
      }

      // 4. Sync WhatsApp Session
      await this.syncSession();

      this.lastSyncAt = new Date().toISOString();
      this.lastSyncStatus = 'success';
      this.lastSyncError = null;
      console.log(`✅ [MongoDB] Full sync to MongoDB Atlas completed successfully.`);
      return { success: true, syncedCount, lastSyncAt: this.lastSyncAt };
    } catch (err) {
      this.lastSyncStatus = 'error';
      this.lastSyncError = err.message;
      console.error('❌ [MongoDB] Full sync failed:', err.message);
      return { success: false, error: err.message };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Periodic background sync (runs every 15 minutes)
   */
  startAutoSyncSchedule(intervalMs = 15 * 60 * 1000) {
    if (this.periodicTimer) clearInterval(this.periodicTimer);
    this.periodicTimer = setInterval(() => {
      if (this.isConnected) {
        this.syncAll().catch(err => console.warn('⚠️ [MongoDB] Scheduled sync error:', err.message));
      }
    }, intervalMs);
  }
}

// Singleton instance
const mongoService = new MongoPersistenceService();
module.exports = mongoService;
