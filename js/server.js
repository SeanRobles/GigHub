require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');
const fetch = require('node-fetch');

const app = express();
const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const HTML_DIR = path.join(ROOT_DIR, 'html');
const CSS_DIR = path.join(ROOT_DIR, 'css');
const IMAGES_DIR = path.join(ROOT_DIR, 'Images');

const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json');
const SERVICES_FILE = path.join(DATA_DIR, 'services.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const JOBS_FILE = path.join(DATA_DIR, 'jobs.json');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');
const REVIEWS_FILE = path.join(ROOT_DIR, 'data', 'reviews.json');
const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'notifications.json');

const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID || 'service_1l0xsny';
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || process.env.EMAILJS_USER_ID || '';
const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY || process.env.EMAILJS_ACCESS_TOKEN || '';
const EMAILJS_VERIFY_TEMPLATE_ID = process.env.EMAILJS_VERIFY_TEMPLATE_ID || '';
const EMAILJS_RESET_TEMPLATE_ID = process.env.EMAILJS_RESET_TEMPLATE_ID || '';

const pendingSignups = new Map();
const passwordResetOtps = new Map();

app.use(cors());
app.use(express.json());
app.use(express.static(HTML_DIR));
app.use('/html', express.static(HTML_DIR));
app.use('/css', express.static(CSS_DIR));
app.use('/Images', express.static(IMAGES_DIR));

app.get('/', (req, res) => {
  res.sendFile(path.join(HTML_DIR, 'LandingPage.html'));
});

function isoNow() {
  return new Date().toISOString();
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function defaultRoleProfile(displayName) {
  return {
    name: displayName,
    title: '',
    bio: '',
    languages: '',
    location: '',
    skill: '',
    tools: '',
    level: '',
    years: '',
    hourly: '',
    fixedMin: '',
    fixedMax: '',
    payment: '',
    degree: '',
    institution: '',
    gradYear: '',
    certs: '',
    portfolioFile: null,
    portfolioFileName: null,
    avatarSrc: null
  };
}

function defaultProfilesDb() {
  return { users: {}, lastUpdated: isoNow() };
}

function readJson(filePath, fallbackValue) {
  try {
    if (!fs.existsSync(filePath)) return fallbackValue;
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    return raw ? JSON.parse(raw) : fallbackValue;
  } catch (error) {
    console.error(`Failed to read ${filePath}:`, error);
    return fallbackValue;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function normalizeProfilesDb(rawDb) {
  if (rawDb && rawDb.users && typeof rawDb.users === 'object') {
    return rawDb;
  }

  const db = defaultProfilesDb();
  if (!rawDb || typeof rawDb !== 'object') return db;

  Object.entries(rawDb).forEach(([key, value]) => {
    if (['_comment', 'lastUpdated', 'admin'].includes(key) || !value || typeof value !== 'object') {
      return;
    }

    const role = key === 'client' ? 'client' : 'freelancer';
    const displayName = value.name || key;

    db.users[key] = {
      username: key,
      email: value.email || '',
      password: value.password || '',
      currentRole: role,
      roles: {
        freelancer: defaultRoleProfile(displayName),
        client: defaultRoleProfile(displayName)
      },
      acceptedServices: Array.isArray(value.acceptedServices) ? value.acceptedServices : [],
      createdServices: Array.isArray(value.createdServices) ? value.createdServices : [],
      verified: true,
      createdAt: isoNow(),
      updatedAt: isoNow()
    };
  });

  return db;
}

function loadProfilesDb() {
  return normalizeProfilesDb(readJson(PROFILES_FILE, defaultProfilesDb()));
}

function saveProfilesDb(db) {
  db.lastUpdated = isoNow();
  writeJson(PROFILES_FILE, db);
}

function loadServices() {
  return readJson(SERVICES_FILE, []);
}

function saveServices(services) {
  writeJson(SERVICES_FILE, services);
}

function loadMessages() {
  return readJson(MESSAGES_FILE, []);
}

function saveMessages(messages) {
  writeJson(MESSAGES_FILE, messages);
}

function loadJobs() {
  return readJson(JOBS_FILE, []);
}

function saveJobs(jobs) {
  writeJson(JOBS_FILE, jobs);
}

function loadCategories() {
  return readJson(CATEGORIES_FILE, { jobCategories: [] });
}

function loadNotifications() {
  return readJson(NOTIFICATIONS_FILE, []);
}

function saveNotifications(notifications) {
  writeJson(NOTIFICATIONS_FILE, notifications);
}

function ensureDataFiles() {
  ensureDir(DATA_DIR);
  if (!fs.existsSync(PROFILES_FILE)) writeJson(PROFILES_FILE, defaultProfilesDb());
  if (!fs.existsSync(SERVICES_FILE)) writeJson(SERVICES_FILE, []);
  if (!fs.existsSync(MESSAGES_FILE)) writeJson(MESSAGES_FILE, []);
  if (!fs.existsSync(JOBS_FILE)) writeJson(JOBS_FILE, []);
  if (!fs.existsSync(NOTIFICATIONS_FILE)) writeJson(NOTIFICATIONS_FILE, []);
  if (!fs.existsSync(CATEGORIES_FILE)) writeJson(CATEGORIES_FILE, {
    jobCategories: [
      { id: "web-dev", name: "Web Development", icon: "💻", subcategories: ["Frontend", "Backend", "Full Stack", "WordPress", "Shopify"] },
      { id: "design", name: "Design", icon: "🎨", subcategories: ["UI/UX Design", "Graphic Design", "Logo Design", "Branding", "Illustration"] },
      { id: "mobile", name: "Mobile Development", icon: "📱", subcategories: ["iOS", "Android", "React Native", "Flutter"] },
      { id: "writing", name: "Writing & Content", icon: "✍️", subcategories: ["Copywriting", "Blog Posts", "Technical Writing", "Social Media"] },
      { id: "marketing", name: "Digital Marketing", icon: "📊", subcategories: ["SEO", "SEM", "Social Media Marketing", "Email Marketing"] },
      { id: "video", name: "Video & Animation", icon: "🎬", subcategories: ["Video Editing", "Animation", "Motion Graphics", "Voiceover"] },
      { id: "business", name: "Business Services", icon: "💼", subcategories: ["Virtual Assistant", "Data Entry", "Bookkeeping", "Consultation"] },
      { id: "music", name: "Music & Audio", icon: "🎵", subcategories: ["Music Production", "Sound Design", "Podcast Editing", "Transcription"] },
      { id: "data", name: "Data & Analytics", icon: "📈", subcategories: ["Data Analysis", "Data Visualization", "Business Intelligence", "Database Design"] },
      { id: "consulting", name: "Consulting", icon: "🤝", subcategories: ["IT Consulting", "Business Consulting", "Career Coaching", "Strategy"] }
    ]
  });
}

function sanitizeUser(account) {
  if (!account) return null;
  const { password, ...safeUser } = account;
  return safeUser;
}

function findUser(db, identifier) {
  if (!identifier) return null;
  const lowered = identifier.trim().toLowerCase();
  return Object.values(db.users).find(user =>
    user.username.toLowerCase() === lowered || user.email.toLowerCase() === lowered
  ) || null;
}

function requireEmailJsConfig(templateId) {
  return EMAILJS_PUBLIC_KEY && EMAILJS_PRIVATE_KEY && EMAILJS_SERVICE_ID && templateId;
}

async function sendEmailViaEmailJs(templateId, templateParams) {
  if (!requireEmailJsConfig(templateId)) {
    throw new Error('EmailJS is not fully configured. Set EMAILJS_PUBLIC_KEY, EMAILJS_PRIVATE_KEY, and template IDs in your environment.');
  }

  const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: EMAILJS_SERVICE_ID,
      template_id: templateId,
      user_id: EMAILJS_PUBLIC_KEY,
      accessToken: EMAILJS_PRIVATE_KEY,
      template_params: templateParams
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`EmailJS request failed: ${text}`);
  }
}

async function sendVerificationEmail({ username, firstName, email, otp }) {
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await sendEmailViaEmailJs(EMAILJS_VERIFY_TEMPLATE_ID, {
    to_name: firstName || username,
    to_email: email,
    email,
    recipient: email,
    username,
    otp_code: otp,
    passcode: otp,
    time: expiresAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    company_name: 'GigHub'
  });
}

async function sendResetPasswordEmail({ email, otp }) {
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await sendEmailViaEmailJs(EMAILJS_RESET_TEMPLATE_ID, {
    to_email: email,
    email,
    recipient: email,
    otp_code: otp,
    passcode: otp,
    time: expiresAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    company_name: 'GigHub'
  });
}

ensureDataFiles();

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'GigHub backend is running' });
});

app.post('/api/auth/signup/request-verification', async (req, res) => {
  const { username, firstName, lastName, age, email, password } = req.body;
  if (!username || !firstName || !lastName || !age || !email || !password) {
    return res.status(400).json({ success: false, message: 'All signup fields are required.' });
  }

  const db = loadProfilesDb();
  const existingUser = findUser(db, username) || Object.values(db.users).find(user => user.email.toLowerCase() === email.toLowerCase());
  if (existingUser) {
    return res.status(409).json({ success: false, message: 'That username or email is already registered.' });
  }

  if (pendingSignups.has(username.toLowerCase())) {
    pendingSignups.delete(username.toLowerCase());
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  pendingSignups.set(username.toLowerCase(), {
    username,
    firstName,
    lastName,
    age,
    email,
    password,
    otp,
    expiresAt: Date.now() + 15 * 60 * 1000
  });

  try {
    await sendVerificationEmail({ username, firstName, email, otp });
    res.json({ success: true, message: 'Verification code sent to your email.' });
  } catch (error) {
    pendingSignups.delete(username.toLowerCase());
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/auth/signup/verify', (req, res) => {
  const { username, otp } = req.body;
  const pending = pendingSignups.get((username || '').toLowerCase());

  if (!pending) {
    return res.status(404).json({ success: false, message: 'No pending signup found for that username.' });
  }
  if (Date.now() > pending.expiresAt) {
    pendingSignups.delete(username.toLowerCase());
    return res.status(410).json({ success: false, message: 'Your verification code expired. Please sign up again.' });
  }
  if (pending.otp !== otp) {
    return res.status(400).json({ success: false, message: 'Incorrect verification code.' });
  }

  const db = loadProfilesDb();
  const displayName = `${pending.firstName} ${pending.lastName}`.trim();
  db.users[pending.username] = {
    username: pending.username,
    email: pending.email,
    password: pending.password,
    verified: true,
    age: pending.age,
    currentRole: 'freelancer',
    roles: {
      freelancer: defaultRoleProfile(displayName),
      client: defaultRoleProfile(displayName)
    },
    acceptedServices: [],
    createdServices: [],
    createdAt: isoNow(),
    updatedAt: isoNow()
  };
  saveProfilesDb(db);
  pendingSignups.delete(username.toLowerCase());

  res.json({
    success: true,
    user: {
      username: pending.username,
      email: pending.email,
      currentRole: 'freelancer'
    }
  });
});

app.post('/api/auth/login', (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ success: false, message: 'Identifier and password are required.' });
  }

  const db = loadProfilesDb();
  const user = findUser(db, identifier);

  if (!user || user.password !== password) {
    return res.status(401).json({ success: false, message: 'Incorrect username, email, or password.' });
  }

  res.json({ success: true, user: sanitizeUser(user) });
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const { identifier } = req.body;
  if (!identifier) {
    return res.status(400).json({ success: false, message: 'Email or username is required.' });
  }

  const db = loadProfilesDb();
  const user = findUser(db, identifier);
  if (!user) {
    return res.status(404).json({ success: false, message: 'No account found for that email or username.' });
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  passwordResetOtps.set(user.username.toLowerCase(), {
    username: user.username,
    otp,
    expiresAt: Date.now() + 15 * 60 * 1000
  });

  try {
    await sendResetPasswordEmail({ email: user.email, otp });
    res.json({ success: true, message: 'Password reset OTP sent to your email.' });
  } catch (error) {
    passwordResetOtps.delete(user.username.toLowerCase());
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/auth/reset-password', (req, res) => {
  const { identifier, otp, password } = req.body;
  if (!identifier || !otp || !password) {
    return res.status(400).json({ success: false, message: 'Identifier, OTP, and new password are required.' });
  }

  const db = loadProfilesDb();
  const user = findUser(db, identifier);
  if (!user) {
    return res.status(404).json({ success: false, message: 'Account not found.' });
  }

  const pending = passwordResetOtps.get(user.username.toLowerCase());
  if (!pending) {
    return res.status(400).json({ success: false, message: 'No active reset request found. Request a new OTP.' });
  }

  if (Date.now() > pending.expiresAt) {
    passwordResetOtps.delete(user.username.toLowerCase());
    return res.status(410).json({ success: false, message: 'Password reset OTP expired.' });
  }

  if (pending.otp !== String(otp).trim()) {
    return res.status(400).json({ success: false, message: 'Invalid OTP code.' });
  }

  user.password = password;
  user.updatedAt = isoNow();
  saveProfilesDb(db);
  passwordResetOtps.delete(user.username.toLowerCase());

  res.json({ success: true, message: 'Password updated successfully.' });
});

app.get('/api/usernames', (req, res) => {
  const db = loadProfilesDb();
  const exclude = (req.query.exclude || '').toLowerCase();
  const usernames = Object.values(db.users)
    .map(user => user.username)
    .filter(username => username.toLowerCase() !== exclude);
  res.json({ success: true, usernames });
});

app.get('/api/users/:username', (req, res) => {
  const db = loadProfilesDb();
  const user = db.users[req.params.username];
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }
  res.json({ success: true, user: sanitizeUser(user) });
});

app.patch('/api/users/:username/settings', (req, res) => {
  const { email, password, currentRole } = req.body;
  const db = loadProfilesDb();
  const user = db.users[req.params.username];

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  if (email) {
    const duplicate = Object.values(db.users).find(account => account.username !== user.username && account.email.toLowerCase() === email.toLowerCase());
    if (duplicate) {
      return res.status(409).json({ success: false, message: 'That email is already in use.' });
    }
    user.email = email;
  }

  if (password) user.password = password;
  if (currentRole && ['freelancer', 'client'].includes(currentRole)) user.currentRole = currentRole;

  user.updatedAt = isoNow();
  saveProfilesDb(db);
  res.json({ success: true, user: sanitizeUser(user) });
});

app.get('/api/profiles', (req, res) => {
  const db = loadProfilesDb();
  res.json({ success: true, users: Object.values(db.users).map(sanitizeUser), lastUpdated: db.lastUpdated });
});

// Save profile for a specific role
app.post('/api/profiles/save', (req, res) => {
  const { username, role, profile } = req.body;
  if (!username || !role || !profile) {
    return res.status(400).json({ success: false, message: 'username, role, and profile are required.' });
  }

  const profiles = readJson(PROFILES_FILE, defaultProfilesDb());
  const user = profiles.users?.[username];
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  if (!user.roles) user.roles = {};
  user.roles[role] = { ...user.roles[role], ...profile };
  user.updatedAt = isoNow();
  profiles.lastUpdated = isoNow();

  writeJson(PROFILES_FILE, profiles);
  res.json({ success: true, user, message: 'Profile saved.' });
});

app.get('/api/services', (req, res) => {
  const services = loadServices();
  res.json({ success: true, services });
});

app.post('/api/services', (req, res) => {
  const { username, role, title, price, cat, desc, emoji } = req.body;
  if (!username || !title || !price) {
    return res.status(400).json({ success: false, message: 'Username, title, and price are required.' });
  }

  const db = loadProfilesDb();
  const user = db.users[username];
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  const services = loadServices();
  const service = {
    id: Date.now(),
    title,
    price,
    cat: cat || 'Other',
    desc: desc || '',
    emoji: emoji || '💼',
    status: 'uncompleted',
    createdBy: username,
    createdByRole: role || user.currentRole || 'client',
    acceptedBy: null,
    acceptedByRole: null,
    createdAt: isoNow(),
    updatedAt: isoNow()
  };

  services.push(service);
  saveServices(services);

  user.createdServices = Array.isArray(user.createdServices) ? user.createdServices : [];
  user.createdServices.push(service.id);
  user.updatedAt = isoNow();
  saveProfilesDb(db);

  res.json({ success: true, service });
});

app.post('/api/services/:id/accept', (req, res) => {
  const { username, role } = req.body;
  if (!username) {
    return res.status(400).json({ success: false, message: 'Username is required.' });
  }

  const db = loadProfilesDb();
  const user = db.users[username];
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  const services = loadServices();
  const service = services.find(item => String(item.id) === String(req.params.id));
  if (!service) {
    return res.status(404).json({ success: false, message: 'Service not found.' });
  }
  if (service.createdBy === username) {
    return res.status(400).json({ success: false, message: 'You cannot accept your own service.' });
  }
  if (service.acceptedBy) {
    return res.status(409).json({ success: false, message: 'That service has already been accepted.' });
  }

  service.acceptedBy = username;
  service.acceptedByRole = role || user.currentRole || 'freelancer';
  service.updatedAt = isoNow();
  saveServices(services);

  user.acceptedServices = Array.isArray(user.acceptedServices) ? user.acceptedServices : [];
  if (!user.acceptedServices.includes(service.id)) {
    user.acceptedServices.push(service.id);
  }
  user.updatedAt = isoNow();
  saveProfilesDb(db);

  res.json({ success: true, service });
});

app.get('/api/messages', (req, res) => {
  const messages = loadMessages();
  const { user1, user2 } = req.query;
  if (!user1 || !user2) {
    return res.json({ success: true, messages });
  }

  const filtered = messages.filter(message =>
    (message.from === user1 && message.to === user2) ||
    (message.from === user2 && message.to === user1)
  );

  res.json({ success: true, messages: filtered });
});

app.post('/api/messages', (req, res) => {
  const { from, to, text } = req.body;
  if (!from || !to || !text) {
    return res.status(400).json({ success: false, message: 'From, to, and text are required.' });
  }
  if (from === to) {
    return res.status(400).json({ success: false, message: 'You cannot message yourself.' });
  }

  const db = loadProfilesDb();
  if (!db.users[from] || !db.users[to]) {
    return res.status(404).json({ success: false, message: 'Sender or recipient not found.' });
  }

  const messages = loadMessages();
  const message = {
    id: Date.now(),
    from,
    to,
    text,
    timestamp: Date.now()
  };
  messages.push(message);
  saveMessages(messages);
  res.json({ success: true, message });
});

app.get('/api/categories', (req, res) => {
  const categories = loadCategories();
  res.json({ success: true, categories: categories.jobCategories || [] });
});

app.get('/api/jobs', (req, res) => {
  const jobs = loadJobs();
  const { status, postedBy } = req.query;
  
  let filtered = jobs;
  if (status) {
    filtered = filtered.filter(job => job.status === status);
  }
  if (postedBy) {
    filtered = filtered.filter(job => job.postedBy === postedBy);
  }
  
  res.json({ success: true, jobs: filtered });
});

app.post('/api/jobs', (req, res) => {
  const { username, title, description, category, subcategory, budgetMin, budgetMax, duration, attachmentName } = req.body;
  
  if (!username || !title || !description || !category) {
    return res.status(400).json({ success: false, message: 'Username, title, description, and category are required.' });
  }

  const db = loadProfilesDb();
  const user = db.users[username];
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  const jobs = loadJobs();
  const job = {
    id: Date.now().toString(),
    title,
    description,
    category,
    subcategory: subcategory || '',
    budgetMin: budgetMin || 0,
    budgetMax: budgetMax || 0,
    duration: duration || '',
    attachmentName: attachmentName || '',
    status: 'open',
    postedBy: username,
    postedAt: isoNow(),
    acceptedBy: null,
    acceptedAt: null,
    completed: false,
    completedAt: null
  };

  jobs.push(job);
  saveJobs(jobs);
  
  res.json({ success: true, job });
});

app.patch('/api/jobs/:id', (req, res) => {
  const { status, acceptedBy } = req.body;
  
  const jobs = loadJobs();
  const job = jobs.find(j => j.id === req.params.id);
  
  if (!job) {
    return res.status(404).json({ success: false, message: 'Job not found.' });
  }

  if (status === 'in-progress' && acceptedBy) {
    job.status = 'in-progress';
    job.acceptedBy = acceptedBy;
    job.acceptedAt = isoNow();

    // Create notification for the job poster
    const notifications = loadNotifications();
    notifications.push({
      id: Date.now().toString(),
      to: job.postedBy,
      type: 'job-accepted',
      message: `${acceptedBy} accepted your job "${job.title}"`,
      jobId: job.id,
      from: acceptedBy,
      read: false,
      timestamp: Date.now()
    });
    saveNotifications(notifications);
  } else if (status === 'completed') {
    job.status = 'completed';
    job.completed = true;
    job.completedAt = isoNow();

    // Notify the freelancer that the job is marked completed
    if (job.acceptedBy) {
      const notifications = loadNotifications();
      notifications.push({
        id: Date.now().toString(),
        to: job.acceptedBy,
        type: 'job-completed',
        message: `Job "${job.title}" has been marked as completed`,
        jobId: job.id,
        from: job.postedBy,
        read: false,
        timestamp: Date.now()
      });
      saveNotifications(notifications);
    }
  } else if (status === 'open') {
    job.status = 'open';
    job.acceptedBy = null;
  }

  saveJobs(jobs);
  res.json({ success: true, job });
});

app.delete('/api/jobs/:id', (req, res) => {
  const { username } = req.body;
  
  if (!username) {
    return res.status(400).json({ success: false, message: 'Username is required.' });
  }

  const jobs = loadJobs();
  const jobIndex = jobs.findIndex(j => j.id === req.params.id);
  
  if (jobIndex === -1) {
    return res.status(404).json({ success: false, message: 'Job not found.' });
  }

  const job = jobs[jobIndex];
  if (job.postedBy !== username) {
    return res.status(403).json({ success: false, message: 'You can only delete your own jobs.' });
  }

  jobs.splice(jobIndex, 1);
  saveJobs(jobs);
  
  res.json({ success: true, message: 'Job deleted.' });
});

// ════════════════════════════════════════════════════════
// ROLE-BASED JOB ENDPOINTS
// ════════════════════════════════════════════════════════

// Get jobs for freelancer to browse (exclude their own client jobs)
app.get('/api/jobs/browse/:username', (req, res) => {
  const { username } = req.params;
  const jobs = loadJobs();
  
  // Freelancers see client jobs, but NOT their own jobs
  const browseJobs = jobs.filter(job => job.postedBy !== username && job.status !== 'completed');
  
  res.json({ success: true, jobs: browseJobs });
});

// Get user's own jobs (for client dashboard)
app.get('/api/jobs/my/:username', (req, res) => {
  const { username } = req.params;
  const jobs = loadJobs();
  
  // Show only jobs posted by this user
  const myJobs = jobs.filter(job => job.postedBy === username);
  
  res.json({ success: true, jobs: myJobs });
});

// Get single job details
app.get('/api/jobs/detail/:jobId', (req, res) => {
  const { jobId } = req.params;
  const jobs = loadJobs();
  
  const job = jobs.find(j => j.id === jobId);
  if (!job) {
    return res.status(404).json({ success: false, message: 'Job not found.' });
  }
  
  res.json({ success: true, job });
});

// Update job details (owner only)
app.put('/api/jobs/:id', (req, res) => {
  const { username, title, description, category, subcategory, budgetMin, budgetMax, duration, status } = req.body;
  
  if (!username) {
    return res.status(400).json({ success: false, message: 'Username is required.' });
  }

  const jobs = loadJobs();
  const job = jobs.find(j => j.id === req.params.id);
  
  if (!job) {
    return res.status(404).json({ success: false, message: 'Job not found.' });
  }

  // Only job creator can edit
  if (job.postedBy !== username) {
    return res.status(403).json({ success: false, message: 'You can only edit your own jobs.' });
  }

  // Update allowed fields
  if (title) job.title = title;
  if (description) job.description = description;
  if (category) job.category = category;
  if (subcategory) job.subcategory = subcategory;
  if (budgetMin !== undefined) job.budgetMin = budgetMin;
  if (budgetMax !== undefined) job.budgetMax = budgetMax;
  if (duration) job.duration = duration;
  if (status) job.status = status;

  saveJobs(jobs);
  res.json({ success: true, message: 'Job updated.', job });
});

// Get freelancers matching job category/skills
app.get('/api/freelancers/by-category/:category', (req, res) => {
  const { category } = req.params;
  const db = loadProfilesDb();
  
  // Find freelancers who have this skill in their profile
  const matchingFreelancers = [];
  
  for (const username in db.users) {
    const user = db.users[username];
    const freelancerProfile = user.roles?.freelancer;
    
    if (!freelancerProfile) continue;
    
    // Check if their skills match the category (case-insensitive)
    const skills = (freelancerProfile.skill || '').toLowerCase();
    const tools = (freelancerProfile.tools || '').toLowerCase();
    const categoryLower = category.toLowerCase();
    
    if (skills.includes(categoryLower) || tools.includes(categoryLower)) {
      matchingFreelancers.push({
        username,
        name: freelancerProfile.name || username,
        title: freelancerProfile.title || '',
        skill: freelancerProfile.skill || '',
        location: freelancerProfile.location || '',
        hourly: freelancerProfile.hourly || '',
        bio: freelancerProfile.bio || ''
      });
    }
  }
  
  res.json({ success: true, freelancers: matchingFreelancers });
});

/* ══════════════════════════════════════════
   REVIEWS
   ══════════════════════════════════════════ */

function readReviews() {
  try {
    if (!fs.existsSync(REVIEWS_FILE)) fs.writeFileSync(REVIEWS_FILE, '[]', 'utf8');
    return JSON.parse(fs.readFileSync(REVIEWS_FILE, 'utf8'));
  } catch (e) {
    console.error('Error reading reviews:', e);
    return [];
  }
}

function writeReviews(reviews) {
  fs.writeFileSync(REVIEWS_FILE, JSON.stringify(reviews, null, 2), 'utf8');
}

// GET reviews for a user
app.get('/api/reviews/:username', (req, res) => {
  const username = decodeURIComponent(req.params.username);
  const allReviews = readReviews();
  const userReviews = allReviews.filter(r => r.to === username);
  userReviews.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  res.json({ success: true, reviews: userReviews });
});

// POST a new review (or update existing)
app.post('/api/reviews', (req, res) => {
  const { from, to, rating, text } = req.body;

  if (!from || !to || !rating) {
    return res.status(400).json({ success: false, message: 'from, to, and rating are required.' });
  }
  if (from === to) {
    return res.status(400).json({ success: false, message: 'You cannot review yourself.' });
  }
  if (rating < 1 || rating > 5) {
    return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5.' });
  }

  const allReviews = readReviews();
  const existingIdx = allReviews.findIndex(r => r.from === from && r.to === to);

  const reviewObj = {
    id: Date.now().toString(),
    from,
    to,
    rating: parseInt(rating),
    text: text || '',
    timestamp: Date.now()
  };

  if (existingIdx >= 0) {
    reviewObj.id = allReviews[existingIdx].id;
    allReviews[existingIdx] = reviewObj;
  } else {
    allReviews.push(reviewObj);
  }

  writeReviews(allReviews);
  res.json({ success: true, review: reviewObj, message: existingIdx >= 0 ? 'Review updated.' : 'Review submitted.' });
});

// DELETE a review
app.delete('/api/reviews/:reviewId', (req, res) => {
  const reviewId = req.params.reviewId;
  const { username } = req.body;
  let allReviews = readReviews();
  const review = allReviews.find(r => r.id === reviewId);

  if (!review) return res.status(404).json({ success: false, message: 'Review not found.' });
  if (review.from !== username) return res.status(403).json({ success: false, message: 'You can only delete your own reviews.' });

  allReviews = allReviews.filter(r => r.id !== reviewId);
  writeReviews(allReviews);
  res.json({ success: true, message: 'Review deleted.' });
});

/* ══════════════════════════════════════════
   NOTIFICATIONS
   ══════════════════════════════════════════ */

// GET notifications for a user
app.get('/api/notifications/:username', (req, res) => {
  const username = decodeURIComponent(req.params.username);
  const all = loadNotifications();
  const userNotifs = all.filter(n => n.to === username);
  userNotifs.sort((a, b) => b.timestamp - a.timestamp);
  res.json({ success: true, notifications: userNotifs });
});

// PATCH mark notification(s) as read
app.patch('/api/notifications/read', (req, res) => {
  const { username, ids } = req.body;
  if (!username) return res.status(400).json({ success: false, message: 'Username required.' });

  const all = loadNotifications();
  let count = 0;
  all.forEach(n => {
    if (n.to === username && (!ids || ids.includes(n.id))) {
      if (!n.read) { n.read = true; count++; }
    }
  });
  saveNotifications(all);
  res.json({ success: true, markedRead: count });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`GigHub backend running on http://localhost:${PORT}`);
});