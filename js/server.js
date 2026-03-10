const express = require('express');
const fs = require('fs');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Database files
const PROFILES_FILE = path.join(__dirname, '../data/profiles.json');
const SERVICES_FILE = '../data/services.json';

const MESSAGES_FILE = path.join(__dirname, '../data/messages.json');

// --- Helper Functions ---
function readDB(file, defaultData) {
    if (!fs.existsSync(file)) return defaultData;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function writeDB(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ==========================================
// 1. PROFILES API
// ==========================================
// GET: Load profiles on startup
app.get('/api/profiles', (req, res) => {
    const profiles = readDB(PROFILES_FILE, { freelancer: {}, client: {} });
    res.json({ success: true, profiles });
});

// POST: Save profile edits
app.post('/api/profiles/save', (req, res) => {
    const { role, lastUpdated, profile } = req.body;
    if (!role || !profile) return res.status(400).json({ success: false, message: 'Missing data' });

    const db = readDB(PROFILES_FILE, { freelancer: {}, client: {} });
    db[role] = profile;
    db.lastUpdated = lastUpdated;

    writeDB(PROFILES_FILE, db);
    res.json({ success: true, message: 'Profile saved' });
});

// ==========================================
// 2. SERVICES API
// ==========================================
// GET: Load all services on startup
app.get('/api/services', (req, res) => {
    const services = readDB(SERVICES_FILE, []);
    res.json({ success: true, services });
});

// POST: Add a new service (Post Job)
app.post('/api/services', (req, res) => {
    const newService = req.body;
    if (!newService.title || !newService.price) {
        return res.status(400).json({ success: false, message: 'Title and price required' });
    }

    const services = readDB(SERVICES_FILE, []);
    services.push(newService);

    writeDB(SERVICES_FILE, services);
    res.json({ success: true, service: newService });
});

// ==========================================
// 3. MESSAGES API
// ==========================================

// ✅ Get all usernames (exclude admin/comment/lastUpdated)
app.get('/api/usernames', (req, res) => {
  const profiles = readDB(PROFILES_FILE, {});
  const exclude = req.query.exclude || '';
  const usernames = Object.keys(profiles).filter(u =>
    !['_comment', 'lastUpdated', 'admin'].includes(u) && u !== exclude
  );
  res.json({ success: true, usernames });
});

// ✅ Get messages between two users
app.get('/api/messages', (req, res) => {
  const messages = readDB(MESSAGES_FILE, []);
  const { user1, user2 } = req.query;
  if (user1 && user2) {
    const filtered = messages.filter(
      m => (m.from === user1 && m.to === user2) || (m.from === user2 && m.to === user1)
    );
    return res.json({ success: true, messages: filtered });
  }
  res.json({ success: true, messages });
});

// ✅ Send a new message
app.post('/api/messages', (req, res) => {
  const { from, to, text } = req.body;
  if (!from || !to || !text) return res.status(400).json({ success: false, message:'Missing data' });
  const messages = readDB(MESSAGES_FILE, []);
  messages.push({ from, to, text, timestamp: Date.now() });
  writeDB(MESSAGES_FILE, messages);
  res.json({ success: true });
});



const PORT = 3000;
app.listen(PORT, () => {
    console.log(`GigHub backend running on http://localhost:${PORT}`);
});