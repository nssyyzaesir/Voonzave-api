const admin = require('firebase-admin');
require('dotenv').config();

const decodedKey = Buffer.from(process.env.FIREBASE_PRIVATE_KEY_B64, 'base64').toString('utf8');

const credentials = {
  project_id: process.env.FIREBASE_PROJECT_ID,
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  private_key: decodedKey,
};

try {
  admin.initializeApp({
    credential: admin.credential.cert(credentials),
  });

  console.log('[Firebase] Conectado com sucesso.');
} catch (error) {
  console.error('[Firebase] ERRO AO CONECTAR:', error.message);
}

const db = admin.firestore();
module.exports = db;