/**
 * Google Drive Automated Cloud Backup & Restore Module
 * WhatsApp Bot - whatsappbot.hajimammad.com
 * 
 * Features:
 * - Native Google Service Account authentication (RS256 JWT via Node.js crypto/https, zero npm bloat)
 * - Automatic startup restore for ephemeral cloud environments (Render, Heroku, Docker)
 * - Debounced auto-backup on customer messages and data mutations
 * - Full WhatsApp Baileys session preservation (no QR re-scan after redeployment)
 * - Periodic background backup synchronization
 * - Admin status API & manual trigger support
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const AUTH_DIR = path.join(__dirname, '..', 'auth_info_baileys');

const FILES_TO_BACKUP = [
  { name: 'leads.json', localPath: path.join(DATA_DIR, 'leads.json') },
  { name: 'users_db.json', localPath: path.join(DATA_DIR, 'users_db.json') },
  { name: 'lid_mappings.json', localPath: path.join(DATA_DIR, 'lid_mappings.json') }
];

const SESSION_BACKUP_NAME = 'baileys_auth.json';

class DriveBackupService {
  constructor() {
    this.folderId = process.env.GOOGLE_DRIVE_FOLDER_ID ? process.env.GOOGLE_DRIVE_FOLDER_ID.trim() : null;
    this.serviceAccount = this._parseServiceAccount(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    this.cachedToken = null;
    this.tokenExpiresAt = 0;
    this.debounceTimer = null;
    this.isBackingUp = false;
    this.lastBackupAt = null;
    this.lastBackupStatus = 'idle'; // 'idle' | 'success' | 'error' | 'in_progress'
    this.lastBackupError = null;
    this.lastRestoredAt = null;
    this.scheduledInterval = null;
  }

  _parseServiceAccount(rawKey) {
    if (!rawKey) return null;
    try {
      const parsed = typeof rawKey === 'string' ? JSON.parse(rawKey.trim()) : rawKey;
      if (parsed.client_email && parsed.private_key) {
        return parsed;
      }
      console.warn('⚠️ [DriveBackup] Service account key missing client_email or private_key');
      return null;
    } catch (err) {
      console.warn('⚠️ [DriveBackup] Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY:', err.message);
      return null;
    }
  }

  isConfigured() {
    return Boolean(this.folderId && this.serviceAccount);
  }

  getStatus() {
    return {
      configured: this.isConfigured(),
      folderId: this.folderId || null,
      serviceAccountEmail: this.serviceAccount ? this.serviceAccount.client_email : null,
      lastBackupAt: this.lastBackupAt,
      lastBackupStatus: this.lastBackupStatus,
      lastBackupError: this.lastBackupError,
      lastRestoredAt: this.lastRestoredAt,
      isBackingUp: this.isBackingUp
    };
  }

  /**
   * Generates or returns a valid Google OAuth2 Bearer Access Token via RS256 JWT
   */
  async getAccessToken() {
    if (!this.isConfigured()) {
      throw new Error('Google Drive credentials not configured');
    }

    const now = Math.floor(Date.now() / 1000);
    // Return cached token if valid for at least 5 more minutes
    if (this.cachedToken && this.tokenExpiresAt > now + 300) {
      return this.cachedToken;
    }

    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      iss: this.serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/drive',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    };

    const base64Url = (strOrObj) => {
      const buf = typeof strOrObj === 'string' ? Buffer.from(strOrObj) : Buffer.from(JSON.stringify(strOrObj));
      return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    };

    const encodedHeader = base64Url(header);
    const encodedPayload = base64Url(payload);
    const signInput = `${encodedHeader}.${encodedPayload}`;

    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signInput);
    const signature = signer.sign(this.serviceAccount.private_key, 'base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const jwt = `${signInput}.${signature}`;
    const postData = `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${encodeURIComponent(jwt)}`;

    const tokenRes = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'oauth2.googleapis.com',
        path: '/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (res.statusCode >= 200 && res.statusCode < 300 && data.access_token) {
              resolve(data);
            } else {
              reject(new Error(`OAuth2 token error (${res.statusCode}): ${body}`));
            }
          } catch (e) {
            reject(new Error(`OAuth2 invalid response: ${body}`));
          }
        });
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    this.cachedToken = tokenRes.access_token;
    this.tokenExpiresAt = now + (tokenRes.expires_in || 3600);
    return this.cachedToken;
  }

  /**
   * Lists all files residing in the configured Google Drive backup folder
   */
  async listDriveFiles() {
    const token = await this.getAccessToken();
    const query = encodeURIComponent(`'${this.folderId}' in parents and trashed = false`);
    const pathUrl = `/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime,size)&pageSize=100`;

    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'www.googleapis.com',
        path: pathUrl,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(data.files || []);
            } else {
              reject(new Error(`Drive list error (${res.statusCode}): ${body}`));
            }
          } catch (e) {
            reject(new Error(`Drive list parse error: ${body}`));
          }
        });
      });
      req.on('error', reject);
      req.end();
    });
  }

  /**
   * Downloads raw text / media of a Google Drive file by ID
   */
  async downloadDriveFile(fileId) {
    const token = await this.getAccessToken();
    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'www.googleapis.com',
        path: `/drive/v3/files/${fileId}?alt=media`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(body);
          } else {
            reject(new Error(`Drive download error (${res.statusCode}): ${body}`));
          }
        });
      });
      req.on('error', reject);
      req.end();
    });
  }

  /**
   * Uploads or updates a file in the Google Drive folder
   */
  async uploadOrUpdateFile(fileName, contentString, existingFileId = null) {
    const token = await this.getAccessToken();

    if (existingFileId) {
      // Update existing file content via PATCH
      const contentBuf = Buffer.from(contentString, 'utf-8');
      return new Promise((resolve, reject) => {
        const req = https.request({
          hostname: 'www.googleapis.com',
          path: `/upload/drive/v3/files/${existingFileId}?uploadType=media`,
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': contentBuf.length
          }
        }, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(JSON.parse(body || '{}'));
            } else {
              reject(new Error(`Drive update error (${res.statusCode}): ${body}`));
            }
          });
        });
        req.on('error', reject);
        req.write(contentBuf);
        req.end();
      });
    } else {
      // Create new file via Multipart POST
      const boundary = '-------WhatsAppBotDriveBoundary' + Date.now();
      const metadata = JSON.stringify({
        name: fileName,
        parents: [this.folderId]
      });

      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const multipartBody = Buffer.concat([
        Buffer.from(delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + metadata),
        Buffer.from(delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + contentString),
        Buffer.from(closeDelimiter)
      ]);

      return new Promise((resolve, reject) => {
        const req = https.request({
          hostname: 'www.googleapis.com',
          path: '/upload/drive/v3/files?uploadType=multipart',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
            'Content-Length': multipartBody.length
          }
        }, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(JSON.parse(body || '{}'));
            } else {
              reject(new Error(`Drive upload error (${res.statusCode}): ${body}`));
            }
          });
        });
        req.on('error', reject);
        req.write(multipartBody);
        req.end();
      });
    }
  }

  /**
   * Bundles all files in auth_info_baileys/ into a single JSON string (Base64 encoded)
   */
  _serializeSession() {
    try {
      if (!fs.existsSync(AUTH_DIR)) return null;
      const files = fs.readdirSync(AUTH_DIR);
      if (files.length === 0) return null;
      const bundle = {};
      let count = 0;
      for (const file of files) {
        const full = path.join(AUTH_DIR, file);
        if (fs.statSync(full).isFile()) {
          bundle[file] = fs.readFileSync(full).toString('base64');
          count++;
        }
      }
      return count > 0 ? JSON.stringify(bundle) : null;
    } catch (e) {
      console.warn('[DriveBackup] Error serializing Baileys session:', e.message);
      return null;
    }
  }

  /**
   * Unpacks a session bundle JSON string back into auth_info_baileys/ directory
   */
  _restoreSession(bundleJson) {
    try {
      if (!bundleJson) return 0;
      const bundle = JSON.parse(bundleJson);
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
      console.warn('[DriveBackup] Error restoring Baileys session:', e.message);
      return 0;
    }
  }

  /**
   * Auto-Restore: Runs at application boot.
   * Downloads data files and session credentials from Google Drive if local storage is missing or empty.
   */
  async restoreFromDrive() {
    if (!this.isConfigured()) {
      console.log('ℹ️ [DriveBackup] Google Drive backup not configured (skipping cloud restore).');
      return { restored: false, reason: 'unconfigured' };
    }

    try {
      console.log('☁️ [DriveBackup] Checking Google Drive for customer data & session backup...');
      const driveFiles = await this.listDriveFiles();
      if (!driveFiles || driveFiles.length === 0) {
        console.log('ℹ️ [DriveBackup] Google Drive folder is empty. Ready for initial backup.');
        return { restored: false, reason: 'empty_folder' };
      }

      let restoredDataFiles = 0;

      // 1. Restore JSON data files
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      for (const item of FILES_TO_BACKUP) {
        const found = driveFiles.find(f => f.name === item.name);
        if (found) {
          const localExists = fs.existsSync(item.localPath);
          let shouldRestore = !localExists;

          // If local exists, check if it's empty / freshly created default
          if (localExists) {
            try {
              const content = fs.readFileSync(item.localPath, 'utf-8').trim();
              if (content === '[]' || content === '{}' || content.length < 5) {
                shouldRestore = true;
              }
            } catch (e) {
              shouldRestore = true;
            }
          }

          if (shouldRestore) {
            console.log(`⬇️ [DriveBackup] Restoring ${item.name} from Google Drive...`);
            const remoteContent = await this.downloadDriveFile(found.id);
            if (remoteContent && remoteContent.length > 2) {
              fs.writeFileSync(item.localPath, remoteContent, 'utf-8');
              restoredDataFiles++;
              console.log(`   ✅ Restored ${item.name} (${Buffer.byteLength(remoteContent)} bytes)`);
            }
          }
        }
      }

      // 2. Restore WhatsApp Baileys session if local session is absent
      const sessionFile = driveFiles.find(f => f.name === SESSION_BACKUP_NAME);
      let sessionFilesRestored = 0;
      const localHasSession = fs.existsSync(path.join(AUTH_DIR, 'creds.json'));

      if (sessionFile && !localHasSession) {
        console.log(`⬇️ [DriveBackup] Restoring WhatsApp Baileys session from Google Drive...`);
        const sessionBundle = await this.downloadDriveFile(sessionFile.id);
        sessionFilesRestored = this._restoreSession(sessionBundle);
        if (sessionFilesRestored > 0) {
          console.log(`   ✅ WhatsApp session restored (${sessionFilesRestored} credentials files) - no QR scan needed!`);
        }
      }

      this.lastRestoredAt = new Date().toISOString();
      console.log(`🎉 [DriveBackup] Startup restore complete (${restoredDataFiles} data files, ${sessionFilesRestored} session keys).`);
      return { restored: true, dataFiles: restoredDataFiles, sessionKeys: sessionFilesRestored };
    } catch (err) {
      console.error('❌ [DriveBackup] Error during Google Drive restore:', err.message);
      return { restored: false, error: err.message };
    }
  }

  /**
   * Triggers a debounced backup to Google Drive.
   * Call this on any data mutation (lead received, message received, KB edited, auth updated).
   */
  triggerBackup(delayMs = 20000) {
    if (!this.isConfigured()) return;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.backupToDrive().catch(err => {
        console.error('❌ [DriveBackup] Debounced backup failed:', err.message);
      });
    }, delayMs);
  }

  /**
   * Executes backup to Google Drive immediately
   */
  async backupToDrive(options = {}) {
    if (!this.isConfigured()) {
      return { success: false, reason: 'unconfigured' };
    }

    if (this.isBackingUp && !options.force) {
      console.log('⏳ [DriveBackup] Backup already in progress, skipping concurrent run.');
      return { success: false, reason: 'in_progress' };
    }

    this.isBackingUp = true;
    this.lastBackupStatus = 'in_progress';

    try {
      console.log('☁️ [DriveBackup] Starting backup to Google Drive...');
      const driveFiles = await this.listDriveFiles();
      let uploadedCount = 0;

      // 1. Backup all data JSON files
      for (const item of FILES_TO_BACKUP) {
        if (fs.existsSync(item.localPath)) {
          const content = fs.readFileSync(item.localPath, 'utf-8');
          // Skip if empty or just empty array/object
          if (content && content.length > 2) {
            const existing = driveFiles.find(f => f.name === item.name);
            await this.uploadOrUpdateFile(item.name, content, existing ? existing.id : null);
            uploadedCount++;
          }
        }
      }

      // 2. Backup WhatsApp session
      const sessionBundle = this._serializeSession();
      if (sessionBundle) {
        const existingSession = driveFiles.find(f => f.name === SESSION_BACKUP_NAME);
        await this.uploadOrUpdateFile(SESSION_BACKUP_NAME, sessionBundle, existingSession ? existingSession.id : null);
        uploadedCount++;
      }

      this.lastBackupAt = new Date().toISOString();
      this.lastBackupStatus = 'success';
      this.lastBackupError = null;
      console.log(`✅ [DriveBackup] Cloud backup finished successfully (${uploadedCount} items synced to Drive).`);
      return { success: true, uploadedCount, lastBackupAt: this.lastBackupAt };
    } catch (err) {
      this.lastBackupStatus = 'error';
      this.lastBackupError = err.message;
      console.error('❌ [DriveBackup] Cloud backup failed:', err.message);
      return { success: false, error: err.message };
    } finally {
      this.isBackingUp = false;
    }
  }

  /**
   * Starts periodic background backup sync (default: every 30 minutes)
   */
  startAutoBackupSchedule(intervalMs = 30 * 60 * 1000) {
    if (!this.isConfigured()) return;
    if (this.scheduledInterval) clearInterval(this.scheduledInterval);

    this.scheduledInterval = setInterval(() => {
      this.backupToDrive().catch(err => {
        console.error('❌ [DriveBackup] Scheduled backup failed:', err.message);
      });
    }, intervalMs);

    console.log(`⏱️ [DriveBackup] Automatic backup schedule active (every ${Math.round(intervalMs / 60000)} minutes).`);
  }
}

// Singleton instance
const driveBackup = new DriveBackupService();
module.exports = driveBackup;
