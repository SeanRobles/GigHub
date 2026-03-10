const express = require('express');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Database file
const PROFILES_FILE = '../data/profiles.json';
const SERVICES_FILE = '../data/services.json';

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

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`GigHub backend running on http://localhost:${PORT}`);
});