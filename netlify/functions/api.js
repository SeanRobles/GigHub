const { getStore } = require("@netlify/blobs");
const crypto = require("crypto");
const fetch = require("node-fetch");

// ── Environment variables (set in Netlify dashboard) ──
const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID || "";
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || "";
const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY || "";
const EMAILJS_VERIFY_TEMPLATE_ID = process.env.EMAILJS_VERIFY_TEMPLATE_ID || "";
const EMAILJS_RESET_TEMPLATE_ID = process.env.EMAILJS_RESET_TEMPLATE_ID || "";

// In-memory OTP stores (will reset on cold start — fine for OTPs)
const pendingSignups = new Map();
const passwordResetOtps = new Map();

// ── Helpers ──
function isoNow() {
  return new Date().toISOString();
}

async function readData(store, key, fallback) {
  try {
    const raw = await store.get(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeData(store, key, data) {
  await store.set(key, JSON.stringify(data));
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

async function sendEmailJS(templateId, templateParams) {
  if (!EMAILJS_SERVICE_ID || !EMAILJS_PUBLIC_KEY) {
    console.log("EmailJS not configured, skipping email");
    return;
  }
  try {
    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: templateId,
        user_id: EMAILJS_PUBLIC_KEY,
        accessToken: EMAILJS_PRIVATE_KEY,
        template_params: templateParams,
      }),
    });
    if (!res.ok) console.error("EmailJS error:", await res.text());
  } catch (e) {
    console.error("EmailJS fetch error:", e);
  }
}

// ── Route handler ──
exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return jsonResponse(204, {});
  }

  const path = event.path.replace("/.netlify/functions/api", "").replace(/^\/+/, "");
  const method = event.httpMethod;
  let body = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {}

  const store = getStore("gighub-data");

  // ════════════════════════════════════════════
  // AUTH ROUTES
  // ════════════════════════════════════════════

  // POST /api/auth/signup-request
  if (path === "auth/signup-request" && method === "POST") {
    const { firstName, lastName, username, email, password, age } = body;
    if (!firstName || !username || !email || !password) {
      return jsonResponse(400, { error: "Missing required fields" });
    }
    const profiles = await readData(store, "profiles", { users: {} });
    if (profiles.users[username]) {
      return jsonResponse(409, { error: "Username already taken" });
    }
    const emailExists = Object.values(profiles.users).some(
      (u) => u.email.toLowerCase() === email.toLowerCase()
    );
    if (emailExists) {
      return jsonResponse(409, { error: "Email already registered" });
    }
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    pendingSignups.set(username, { firstName, lastName, username, email, password, age, otp, createdAt: Date.now() });

    // Send OTP email via EmailJS
    await sendEmailJS(EMAILJS_VERIFY_TEMPLATE_ID, {
      to_name: firstName,
      to_email: email,
      otp_code: otp,
    });

    return jsonResponse(200, { message: "OTP sent", otp });
  }

  // POST /api/auth/verify-otp
  if (path === "auth/verify-otp" && method === "POST") {
    const { username, otp } = body;
    const pending = pendingSignups.get(username);
    if (!pending) return jsonResponse(400, { error: "No pending signup found" });
    if (pending.otp !== otp) return jsonResponse(400, { error: "Invalid OTP" });

    const profiles = await readData(store, "profiles", { users: {} });
    profiles.users[username] = {
      username: pending.username,
      email: pending.email,
      password: pending.password,
      verified: true,
      age: pending.age || "",
      currentRole: "freelancer",
      roles: {
        freelancer: {
          name: `${pending.firstName} ${pending.lastName || ""}`.trim(),
          title: "", bio: "", languages: "", location: "",
          skill: "", tools: "", level: "", years: "",
          hourly: "", fixedMin: "", fixedMax: "", payment: "",
          degree: "", institution: "", gradYear: "", certs: "",
          portfolioFile: null, portfolioFileName: null, avatarSrc: null,
        },
        client: {
          name: `${pending.firstName} ${pending.lastName || ""}`.trim(),
          title: "", bio: "", languages: "", location: "",
          skill: "", tools: "", level: "", years: "",
          hourly: "", fixedMin: "", fixedMax: "", payment: "",
          degree: "", institution: "", gradYear: "", certs: "",
          portfolioFile: null, portfolioFileName: null, avatarSrc: null,
        },
      },
      acceptedServices: [],
      createdServices: [],
      createdAt: isoNow(),
      updatedAt: isoNow(),
    };
    profiles.lastUpdated = isoNow();
    await writeData(store, "profiles", profiles);
    pendingSignups.delete(username);

    return jsonResponse(200, { message: "Account created", user: { username: pending.username, email: pending.email } });
  }

  // POST /api/auth/login
  if (path === "auth/login" && method === "POST") {
    const { identifier, password } = body;
    const profiles = await readData(store, "profiles", { users: {} });
    let user = profiles.users[identifier];
    if (!user) {
      user = Object.values(profiles.users).find(
        (u) => u.email.toLowerCase() === identifier.toLowerCase()
      );
    }
    if (!user) return jsonResponse(401, { error: "User not found" });
    if (user.password !== password) return jsonResponse(401, { error: "Invalid password" });

    return jsonResponse(200, {
      message: "Login successful",
      user: { username: user.username, email: user.email, currentRole: user.currentRole },
    });
  }

  // POST /api/auth/forgot-password
  if (path === "auth/forgot-password" && method === "POST") {
    const { identifier } = body;
    const profiles = await readData(store, "profiles", { users: {} });
    let user = profiles.users[identifier];
    if (!user) {
      user = Object.values(profiles.users).find(
        (u) => u.email.toLowerCase() === identifier.toLowerCase()
      );
    }
    if (!user) return jsonResponse(404, { error: "User not found" });

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    passwordResetOtps.set(user.username, { otp, createdAt: Date.now() });

    await sendEmailJS(EMAILJS_RESET_TEMPLATE_ID, {
      to_name: user.roles?.freelancer?.name || user.username,
      to_email: user.email,
      otp_code: otp,
    });

    return jsonResponse(200, { message: "Reset OTP sent" });
  }

  // POST /api/auth/reset-password
  if (path === "auth/reset-password" && method === "POST") {
    const { identifier, otp, password } = body;
    const profiles = await readData(store, "profiles", { users: {} });
    let user = profiles.users[identifier];
    if (!user) {
      user = Object.values(profiles.users).find(
        (u) => u.email.toLowerCase() === identifier.toLowerCase()
      );
    }
    if (!user) return jsonResponse(404, { error: "User not found" });

    const resetData = passwordResetOtps.get(user.username);
    if (!resetData || resetData.otp !== otp) return jsonResponse(400, { error: "Invalid OTP" });

    user.password = password;
    user.updatedAt = isoNow();
    profiles.lastUpdated = isoNow();
    await writeData(store, "profiles", profiles);
    passwordResetOtps.delete(user.username);

    return jsonResponse(200, { message: "Password reset successful" });
  }

  // ════════════════════════════════════════════
  // PROFILE ROUTES
  // ════════════════════════════════════════════

  // GET /api/profiles/:username
  if (path.startsWith("profiles/") && method === "GET") {
    const username = path.replace("profiles/", "");
    const profiles = await readData(store, "profiles", { users: {} });
    const user = profiles.users[username];
    if (!user) return jsonResponse(404, { error: "User not found" });
    const { password, ...safe } = user;
    return jsonResponse(200, safe);
  }

  // PUT /api/profiles/:username
  if (path.startsWith("profiles/") && method === "PUT") {
    const username = path.replace("profiles/", "");
    const profiles = await readData(store, "profiles", { users: {} });
    if (!profiles.users[username]) return jsonResponse(404, { error: "User not found" });

    const updates = body;
    const user = profiles.users[username];
    if (updates.currentRole) user.currentRole = updates.currentRole;
    if (updates.roles) {
      if (updates.roles.freelancer) Object.assign(user.roles.freelancer, updates.roles.freelancer);
      if (updates.roles.client) Object.assign(user.roles.client, updates.roles.client);
    }
    user.updatedAt = isoNow();
    profiles.lastUpdated = isoNow();
    await writeData(store, "profiles", profiles);

    const { password, ...safe } = user;
    return jsonResponse(200, safe);
  }

  // ════════════════════════════════════════════
  // JOBS ROUTES
  // ════════════════════════════════════════════

  // GET /api/jobs
  if (path === "jobs" && method === "GET") {
    const jobs = await readData(store, "jobs", []);
    return jsonResponse(200, jobs);
  }

  // POST /api/jobs
  if (path === "jobs" && method === "POST") {
    const jobs = await readData(store, "jobs", []);
    const job = {
      id: String(Date.now()),
      ...body,
      status: "open",
      postedAt: isoNow(),
      acceptedBy: null,
      acceptedAt: null,
      completed: false,
      completedAt: null,
    };
    jobs.push(job);
    await writeData(store, "jobs", jobs);
    return jsonResponse(201, job);
  }

  // PATCH /api/jobs/:id
  if (path.startsWith("jobs/") && method === "PATCH") {
    const id = path.replace("jobs/", "");
    const jobs = await readData(store, "jobs", []);
    const idx = jobs.findIndex((j) => j.id === id);
    if (idx === -1) return jsonResponse(404, { error: "Job not found" });
    Object.assign(jobs[idx], body);
    await writeData(store, "jobs", jobs);
    return jsonResponse(200, jobs[idx]);
  }

  // DELETE /api/jobs/:id
  if (path.startsWith("jobs/") && method === "DELETE") {
    const id = path.replace("jobs/", "");
    let jobs = await readData(store, "jobs", []);
    jobs = jobs.filter((j) => j.id !== id);
    await writeData(store, "jobs", jobs);
    return jsonResponse(200, { message: "Deleted" });
  }

  // ════════════════════════════════════════════
  // MESSAGES ROUTES
  // ════════════════════════════════════════════

  // GET /api/messages?user=xxx
  if (path === "messages" && method === "GET") {
    const params = new URLSearchParams(event.rawQuery || "");
    const user = params.get("user");
    const messages = await readData(store, "messages", []);
    if (user) {
      const filtered = messages.filter((m) => m.from === user || m.to === user);
      return jsonResponse(200, filtered);
    }
    return jsonResponse(200, messages);
  }

  // POST /api/messages
  if (path === "messages" && method === "POST") {
    const messages = await readData(store, "messages", []);
    const msg = { id: Date.now(), ...body, timestamp: Date.now() };
    messages.push(msg);
    await writeData(store, "messages", messages);
    return jsonResponse(201, msg);
  }

  // ════════════════════════════════════════════
  // REVIEWS ROUTES
  // ════════════════════════════════════════════

  // GET /api/reviews?to=xxx or ?from=xxx
  if (path === "reviews" && method === "GET") {
    const params = new URLSearchParams(event.rawQuery || "");
    const to = params.get("to");
    const from = params.get("from");
    const reviews = await readData(store, "reviews", []);
    let result = reviews;
    if (to) result = result.filter((r) => r.to === to);
    if (from) result = result.filter((r) => r.from === from);
    return jsonResponse(200, result);
  }

  // POST /api/reviews
  if (path === "reviews" && method === "POST") {
    const reviews = await readData(store, "reviews", []);
    const review = { id: String(Date.now()), ...body, timestamp: Date.now() };
    // Replace existing review from same user
    const existIdx = reviews.findIndex((r) => r.from === review.from && r.to === review.to);
    if (existIdx >= 0) reviews[existIdx] = review;
    else reviews.push(review);
    await writeData(store, "reviews", reviews);
    return jsonResponse(201, review);
  }

  // ════════════════════════════════════════════
  // NOTIFICATIONS ROUTES
  // ════════════════════════════════════════════

  // GET /api/notifications?user=xxx
  if (path === "notifications" && method === "GET") {
    const params = new URLSearchParams(event.rawQuery || "");
    const user = params.get("user");
    const notifs = await readData(store, "notifications", []);
    if (user) return jsonResponse(200, notifs.filter((n) => n.to === user));
    return jsonResponse(200, notifs);
  }

  // POST /api/notifications
  if (path === "notifications" && method === "POST") {
    const notifs = await readData(store, "notifications", []);
    const notif = { id: String(Date.now()), ...body, read: false, timestamp: Date.now() };
    notifs.push(notif);
    await writeData(store, "notifications", notifs);
    return jsonResponse(201, notif);
  }

  // PATCH /api/notifications/:id
  if (path.startsWith("notifications/") && method === "PATCH") {
    const id = path.replace("notifications/", "");
    const notifs = await readData(store, "notifications", []);
    const idx = notifs.findIndex((n) => n.id === id);
    if (idx === -1) return jsonResponse(404, { error: "Not found" });
    Object.assign(notifs[idx], body);
    await writeData(store, "notifications", notifs);
    return jsonResponse(200, notifs[idx]);
  }

  // ════════════════════════════════════════════
  // SERVICES ROUTES
  // ════════════════════════════════════════════

  // GET /api/services
  if (path === "services" && method === "GET") {
    const services = await readData(store, "services", []);
    return jsonResponse(200, services);
  }

  // POST /api/services
  if (path === "services" && method === "POST") {
    const services = await readData(store, "services", []);
    const svc = { id: String(Date.now()), ...body, createdAt: isoNow() };
    services.push(svc);
    await writeData(store, "services", services);
    return jsonResponse(201, svc);
  }

  // ════════════════════════════════════════════
  // CATEGORIES (static)
  // ════════════════════════════════════════════

  if (path === "categories" && method === "GET") {
    const categories = {
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
        { id: "consulting", name: "Consulting", icon: "🤝", subcategories: ["IT Consulting", "Business Consulting", "Career Coaching", "Strategy"] },
      ],
    };
    return jsonResponse(200, categories);
  }

  // ── 404 fallback ──
  return jsonResponse(404, { error: `Route not found: ${method} /${path}` });
};