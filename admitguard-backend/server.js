// Handles PostgreSQL storage and Manager Decisions
const Sentry = require("@sentry/node");
const { nodeProfilingIntegration } = require("@sentry/profiling-node");

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [
    nodeProfilingIntegration(),
  ],
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
});

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
require('dotenv').config();
const Groq = require('groq-sdk');
const { OAuth2Client } = require('google-auth-library');
const { Resend } = require('resend');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'admit-guard-omega-secure-key';


const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: { origin: "*", methods: ["GET", "POST", "PATCH"] }
});

io.on('connection', (socket) => {
  socket.on('authenticate', (data) => {
    const { token, type } = data;
    if (type === 'counselor' && token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.join(`counselor_${decoded.id}`);
        console.log(`🛡️ Socket: Counselor ${decoded.name} connected to private room`);
      } catch (e) {
        console.error('Socket Auth Error (Counselor):', e.message);
      }
    } else if (type === 'admin') {
      // In a real app, we'd verify the Google token here. 
      // For now, we allow joining the admin room if type is 'admin'.
      socket.join('admins');
      console.log('🛡️ Socket: Admin connected to global stream');
    }
  });
});
const port = process.env.PORT || 3000;
const client = new OAuth2Client("436650604205-ifoim7stupnfpp80u5ha2u2f6nouts5v.apps.googleusercontent.com");
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// 2. Initialize TWILIO (Safe fallback)
let twilio = null;
if (process.env.TWILIO_SID && process.env.TWILIO_TOKEN) {
  twilio = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
  console.log('🛡️ WhatsApp Automation: ONLINE');
}

// 3. Initialize REDIS (High-Speed Cache)
const Redis = require('ioredis');
const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;
if (redis) {
  redis.on('connect', () => console.log('🛡️ Redis Cache: ONLINE'));
  redis.on('error', (err) => console.error('❌ Redis Error:', err.message));
}

app.use(cors({ origin: '*' }));
app.use(bodyParser.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// INITIALIZE DB
const initDb = async () => {
  const queryText = `
    CREATE TABLE IF NOT EXISTS counselors (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS submissions (
      id SERIAL PRIMARY KEY,
      candidate_id BIGINT UNIQUE NOT NULL,
      timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      flagged BOOLEAN DEFAULT FALSE,
      exceptions_used TEXT[],
      fields JSONB NOT NULL,
      rationale JSONB,
      decision TEXT DEFAULT 'pending',
      counselor_id INTEGER REFERENCES counselors(id)
    );
    CREATE TABLE IF NOT EXISTS rules (
      id INT PRIMARY KEY,
      config JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

  `;
  try {
    await pool.query(queryText);
    await pool.query(`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS counselor_id INTEGER REFERENCES counselors(id)`);
    await pool.query(`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS decision TEXT DEFAULT 'pending'`);
    await pool.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    await pool.query(`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS rationale_vector vector(384)`);
    
    // Seed default counselor (admin/admin) if empty
    const cRes = await pool.query('SELECT count(*) FROM counselors');
    if (cRes.rows[0].count == 0) {
        const hashed = await bcrypt.hash('admin123', 10);
        await pool.query('INSERT INTO counselors(name, username, password) VALUES($1, $2, $3)', ['Default Staff', 'admin', hashed]);
        console.log('🛡️ Default counselor created (admin/admin123)');
    }

    const res = await pool.query('SELECT count(*) FROM rules');
    if (res.rows[0].count == 0) {
      const defaultRules = {
        age: { min: 18, max: 35 },
        graduation_year: { min: 2015, max: 2025 },
        percentage: { min: 60 },
        cgpa: { min: 6.0 },
        screening_score: { min: 40, max: 100 },
        exception_limit: 2,
        exception_keywords: ["approved by", "special case", "documentation pending", "waiver granted"],
        rationale_min_length: 30,
        aadhaar_checksum: true,
        pii_masking: true,
        email_whitelist: [],
        auto_save_draft: true
      };
      await pool.query('INSERT INTO rules(id, config) VALUES(1, $1)', [JSON.stringify(defaultRules)]);
    }
    console.log('Database initialized successfully.');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
};
// ── REUSABLE AUTOMATION ENGINE ──────────────────────────────────────────────
async function sendWhatsAppAlert(fields, type) {
  if (!twilio) return console.log('🛡️ WhatsApp Skip: Missing Credentials.');
  
  try {
    const { name, phone } = fields;
    // Normalize phone to E.164 (ensure +91 for India if needed)
    const rawNumber = phone.toString().replace(/\D/g, "");
    const finalPhone = rawNumber.startsWith('91') ? `+${rawNumber}` : `+91${rawNumber}`;

    const templates = {
      received: `🛡️ ADMITGUARD: Hi ${name.toUpperCase()}! We've successfully received your admission application. Our team will review it and get back to you soon. 📑`,
      approved: `🛡️ ADMITGUARD: CONGRATULATIONS ${name.toUpperCase()}! Your admission application has been APPROVED. Check your email for enrollment steps! 🎓🎊`,
      rejected: `🛡️ ADMITGUARD: Hello ${name}. We regret to inform you that your admission application was NOT selected at this time. We wish you success in your future endeavors. 🛡️`
    };

    await twilio.messages.create({
      from: 'whatsapp:+14155238886', // Twilio Sandbox Number
      body: templates[type],
      to: `whatsapp:${finalPhone}`
    });
    console.log(`✅ [${type.toUpperCase()}] WhatsApp sent to ${name} (${finalPhone})`);
  } catch (err) {
    console.error(`❌ WhatsApp Error [${err.code || 'UNKNOWN'}]:`, err.message);
    if (err.code === 21608) console.error('🛡️ WARNING: You need to send "join <keyword>" to the sandbox number before this works.');
    if (err.code === 21408) console.error('🛡️ WARNING: Account is unverified or trial limit reached.');
  }
}

initDb();

// ── PROFESSIONAL EMAIL & PDF ENGINE ──────────────────────────────────────────
async function generateApprovalPDF(sub) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    let buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));

    // HEADER - Branded Banner
    doc.rect(0, 0, 612, 100).fill('#0b0c10'); // Dark Theme
    doc.fillColor('#00f2ff').fontSize(30).text('AdmitGuard Registry', 50, 35, { characterSpacing: 2 });
    doc.fontSize(10).fillColor('#ffffff').text('AUTOMATED GOVERNANCE & ADMISSION SYSTEM', 50, 70);

    // WATERMARK (Simulated)
    doc.fillColor('#eeeeee').fontSize(80).opacity(0.1).text('VERIFIED', 100, 350, { rotation: 45 });
    doc.opacity(1).fillColor('#333333');

    // BODY
    const fields = typeof sub.fields === 'string' ? JSON.parse(sub.fields) : sub.fields;
    doc.moveDown(5);
    doc.fontSize(20).text('OFFICIAL LETTER OF ADMISSION', { align: 'center', underline: true });
    doc.moveDown(2);
    
    doc.fontSize(12).text(`Date: ${new Date().toLocaleDateString()}`);
    doc.text(`Certificate No: AG-${sub.candidate_id}-${Math.floor(Math.random() * 9000) + 1000}`);
    doc.moveDown(2);
    
    doc.text(`Dear ${fields.name},`);
    doc.moveDown();
    doc.text('We are pleased to inform you that your application for admission has been officially reviewed and APPROVED by our AI-augmented governance board.', { lineGap: 5 });
    doc.moveDown();
    doc.text(`Based on your screening score of ${fields.screening_score} and your academic records (${fields.percentage}%), you have met all institutional criteria.`);
    
    doc.moveDown(3);
    doc.fontSize(14).text('Admission Details:', { underline: true });
    doc.moveDown();
    doc.fontSize(11).text(`- Student Name: ${fields.name}`);
    doc.text(`- Student Email: ${fields.email}`);
    doc.text(`- Qualification: ${fields.qualification}`);
    doc.text(`- Intake Year: ${fields.grad_year}`);

    // DIGITAL SIGNATURE
    doc.moveDown(4);
    doc.fontSize(10).text('Successfully Authenticated by:', 50, doc.y);
    doc.fontSize(15).font('Courier-Bold').fillColor('#00f2ff').text('AdmitGuard Registry Board', 50, doc.y + 5);
    doc.fontSize(8).fillColor('#999999').text('Digitally signed via Encrypted Identity Key 0x48A...');

    // FOOTER
    doc.fontSize(8).text('This is an auto-generated document protected by AdmitGuard distributed governance. No physical signature required.', 50, 750, { align: 'center', color: '#aaaaaa' });
    
    doc.end();
  });
}

async function sendEmailNotification(sub, type) {
  if (!resend) return console.log('🛡️ Email Skip: Missing Resend API Key.');
  
  const fields = typeof sub.fields === 'string' ? JSON.parse(sub.fields) : sub.fields;
  try {
    let emailConfig = {
      from: 'AdmitGuard <onboarding@resend.dev>', // Resend verified domain or default
      to: [fields.email],
      subject: type === 'received' ? '🛡️ Application Received - AdmitGuard' : '🎓 Congratulations! Your Admission is Approved',
      html: type === 'received' 
        ? `<h1>Hello ${fields.name}</h1><p>Your application was successfully received and is currently in the <strong>PENDING</strong> stage for audit.</p>`
        : `<h1>Great News!</h1><p>Your admission for ${fields.grad_year} has been <strong>APPROVED</strong>. Please find your official letter attached below.</p>`
    };

    if (type === 'approved') {
      const pdfBuffer = await generateApprovalPDF(sub);
      emailConfig.attachments = [{ filename: `Admission_Letter_${sub.candidate_id}.pdf`, content: pdfBuffer }];
    }

    await resend.emails.send(emailConfig);
    console.log(`✅ [${type.toUpperCase()}] Email sent to ${fields.email}`);
  } catch (err) {
    console.error('❌ Email Error:', err.message);
  }
}

// ── AUTH MIDDLEWARE ──────────────────────────────────────────────────────────
async function verifyGoogleToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: "436650604205-ifoim7stupnfpp80u5ha2u2f6nouts5v.apps.googleusercontent.com",
    });
    const payload = ticket.getPayload();
    
    // Whitelist check from Environment Variables (Security: Fail-Closed)
    const adminEmailsRaw = process.env.ADMIN_EMAILS || "";
    const officerEmailsRaw = process.env.OFFICER_EMAILS || ""; // New for extension
    
    const adminWhitelist = adminEmailsRaw.split(',').map(s => s.trim()).filter(s => s);
    const officerWhitelist = officerEmailsRaw.split(',').map(s => s.trim()).filter(s => s);
    const fullWhitelist = [...adminWhitelist, ...officerWhitelist];
    
    if (fullWhitelist.length === 0 || !fullWhitelist.includes(payload.email)) {
      console.warn(`Unauth attempt from ${payload.email}. Whitelist: [${fullWhitelist.join(',')}]`);
      return res.status(403).json({ error: 'Email not authorized' });
    }

    req.user = payload;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Auth Failed: Token invalid' });
  }
}

// ── NEW: COUNSELOR AUTH MIDDLEWARE ───────────────────────────────────────────
const verifyCounselorJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Counsellor Auth Required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.counselor = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Session Expired: Please Login again' });
  }
};


// ── ENDPOINTS ─────────────────────────────────────────────────────────────────
// Apply global protection to all /api/ endpoints EXCEPT submissions (Public Intake)
app.use('/api', (req, res, next) => {
  // 1. Allow the extension to LOGIN first
  if (req.path === '/auth/login' && req.method === 'POST') return next();
  
  // 2. Allow reading rules publicly so the extension can sync validation logic
  if (req.path === '/rules' && req.method === 'GET') return next();

  // 3. For extension submission, use Counselor JWT
  if (req.path === '/submissions' && req.method === 'POST') {
    return verifyCounselorJWT(req, res, next);
  }

  // 4. For extension audit log, allow Counselor JWT or Google Admin
  if (req.path === '/submissions' && req.method === 'GET') {
    // If it has a Bearer token but it's JWT, it might be counselor
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.counselor = decoded;
            return next();
        } catch(e) { /* fallthrough to google auth if JWT fails */ }
    }
    // Otherwise fallback to Google Admin auth
  }

  // Protected routes (Admin specific)
  return verifyGoogleToken(req, res, next);
});

// ── COUNSELOR AUTH & MANAGEMENT ──────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const { rows } = await pool.query('SELECT * FROM counselors WHERE username = $1', [username]);
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid Staff Credentials' });
    
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid Staff Credentials' });
    
    const token = jwt.sign({ id: user.id, username: user.username, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, username: user.username } });
  } catch (err) {
    res.status(500).json({ error: 'Auth sub-system error' });
  }
});

app.get('/api/admin/counselors', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name, username, created_at FROM counselors ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch staff list' });
  }
});

app.post('/api/admin/counselors', async (req, res) => {
  const { name, username, password } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO counselors(name, username, password) VALUES($1, $2, $3) RETURNING id, name, username',
      [name, username, hashed]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Staff account creation failed' });
  }
});

app.delete('/api/admin/counselors/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM counselors WHERE id = $1', [req.params.id]);
    res.json({ message: 'Staff removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove staff' });
  }
});

app.get('/api/admin/stats/counselors', async (req, res) => {
  const { range } = req.query; // optional: last 7 days, 30 days
  try {
    const query = `
      SELECT 
        c.id, 
        c.name, 
        COUNT(s.id) as total_submissions,
        COUNT(CASE WHEN s.decision = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN s.decision = 'rejected' THEN 1 END) as rejected_count,
        COUNT(CASE WHEN s.flagged = TRUE THEN 1 END) as flagged_count
      FROM counselors c
      LEFT JOIN submissions s ON c.id = s.counselor_id
      GROUP BY c.id, c.name
      ORDER BY total_submissions DESC
    `;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Analytics failure' });
  }
});


app.get('/api/rules', async (req, res) => {
  try {
    // 1. Check Redis Cache First (Latency < 2ms)
    if (redis) {
      const cached = await redis.get('admitguard:rules');
      if (cached) return res.json(JSON.parse(cached));
    }

    // 2. Cache Miss -> Fetch from PostgreSQL
    const result = await pool.query('SELECT config FROM rules WHERE id = 1');
    if (result.rows.length === 0) return res.status(404).json({ error: 'Rules not found' });
    
    const rules = result.rows[0].config;

    // 3. Update Redis Cache (TTL: 24 Hours)
    if (redis) {
      await redis.set('admitguard:rules', JSON.stringify(rules), 'EX', 86400);
    }
    
    res.json(rules);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch rules' });
  }
});

app.put('/api/rules', async (req, res) => {
  try {
    const { config } = req.body;
    await pool.query('UPDATE rules SET config = $1, updated_at = CURRENT_TIMESTAMP WHERE id = 1', [JSON.stringify(config)]);
    
    // INVALIDATE CACHE: Force next fetch to use new rules
    if (redis) {
      await redis.del('admitguard:rules');
    }


    // 📣 SOCKET UPDATE: Real-time rules sync
    io.emit('rules_updated', config);

    res.json({ message: 'Rules updated successfully', config });

  } catch (err) {
    res.status(500).json({ error: 'Failed to update rules' });
  }
});

app.get('/api/submissions', async (req, res) => {
  try {
    let query = `
        SELECT s.*, c.name as counselor_name 
        FROM submissions s 
        LEFT JOIN counselors c ON s.counselor_id = c.id 
    `;
    let values = [];

    // Filter by counselor_id if it's a counselor (JWT) and not a Google Admin
    if (req.counselor && (!req.user || !req.user.email)) {
      query += ` WHERE s.counselor_id = $1 `;
      values.push(req.counselor.id);
    }

    query += ` ORDER BY s.timestamp DESC `;
    
    const result = await pool.query(query, values);
    res.json(result.rows || []);
  } catch (err) {
    console.error('Fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch' });
  }
});


// ── VECTOR UTILITIES ────────────────────────────────────────────────────────
let embedder;
const getEmbedding = async (text) => {
  if (!embedder) {
    const { pipeline } = await import('@xenova/transformers');
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  const result = await embedder(text, { pooling: 'mean', normalize: true });
  return Array.from(result.data);
};

app.post('/api/submissions', async (req, res) => {
  const { id, timestamp, flagged, exceptions_used, fields, rationale } = req.body;
  
  // Create latent vector from all rationales
  const fullRationaleString = Object.values(rationale || {}).join(' ');
  let vector = null;
  if (fullRationaleString.trim().length > 0) {
    try { vector = await getEmbedding(fullRationaleString); } catch (e) { console.error('Vector Error', e); }
  }

  const queryText = `
    INSERT INTO submissions(candidate_id, timestamp, flagged, exceptions_used, fields, rationale, decision, rationale_vector, counselor_id)
    VALUES($1, $2, $3, $4, $5, $6, 'pending', $7, $8)
    RETURNING *;
  `;
  const counselor_id = req.counselor?.id || null;
  const values = [id, timestamp, flagged, exceptions_used, JSON.stringify(fields), JSON.stringify(rationale), vector ? `[${vector.join(',')}]` : null, counselor_id];

  try {
    const result = await pool.query(queryText, values);
    const sub = result.rows[0];
    
    // AUTOMATION: Immediate Receipt Confirmation
    sendWhatsAppAlert(fields, 'received');
    sendEmailNotification(sub, 'received');

    // 📣 SOCKET UPDATE: Real-time dashboard notification
    // Emit only to this counselor's room AND the admins
    io.to(`counselor_${counselor_id}`).to('admins').emit('new_submission', sub);

    res.status(201).json(sub);
  } catch (err) {
    console.error('Save Error', err);
    res.status(500).json({ error: 'Failed to save' });
  }
});

app.patch('/api/submissions/:candidate_id/decision', async (req, res) => {
  const { candidate_id } = req.params;
  const { decision } = req.body;

  try {
    const result = await pool.query(
      'UPDATE submissions SET decision = $1 WHERE candidate_id = $2 RETURNING *',
      [decision, candidate_id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Candidate not found' });
    
    const sub = result.rows[0];
    const fields = typeof sub.fields === 'string' ? JSON.parse(sub.fields) : sub.fields;

    // AUTOMATION: Trigger Approval or Rejection notifications in background
    if (decision === 'approved' || decision === 'rejected') {
      sendWhatsAppAlert(fields, decision);
      if (decision === 'approved') sendEmailNotification(sub, 'approved');
      
      // 📣 SOCKET UPDATE: Real-time decision sync
      // Emit to that counselor's room and all admins
      if (sub.counselor_id) {
        io.to(`counselor_${sub.counselor_id}`).to('admins').emit('decision_updated', { candidate_id, decision });
      } else {
        io.to('admins').emit('decision_updated', { candidate_id, decision });
      }
    }

    res.json(sub);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update decision' });
  }
});

app.delete('/api/submissions', async (req, res) => {
  try {
    await pool.query('DELETE FROM submissions');
    res.json({ message: 'Success' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear' });
  }
});

app.get('/health', (req, res) => res.send('🛡️ Backend Live'));

// ── AI ASSISTANT (RAG) powered by GROQ ──────────────────────────────────────────
const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

app.post('/api/analyze', async (req, res) => {
  const { query, context } = req.body;
  
  if (!groq) {
    return res.json({ response: "🛡️ **AI Assistant Offline**: Please add `GROQ_API_KEY` to Render." });
  }

  try {
    // 1. GENERATE SQL OR SEARCH PLAN
    const plannerPrompt = `
      You are an Admissions Data Scientist with access to a PostgreSQL database.
      SCHEMA:
      - TABLE "submissions" (candidate_id, timestamp, flagged, exceptions_used, fields, rationale, decision)
      - "fields" is JSONB: { "name", "email", "percentage", "screening_score", "grad_year", "age" }
      - "rationale" is JSONB: { "age", "grad_year", "percentage", "screening_score" }

      USER QUERY: "${query}"

      If the query is NUMERICAL (top score, count, average, find specific person):
      Return ONLY a valid PostgreSQL SQL query as a string. (Example: SELECT fields->>'name' FROM submissions ORDER BY (fields->>'percentage')::float DESC LIMIT 1)
      
      If the query is LATENT/SEMANTIC (trends, feelings, summary):
      Return "LATENT_ANALYSIS" followed by a summary of the data context provided.

      Your output MUST start with either "SQL: " or "LATENT_ANALYSIS: ".
    `;

    const planResponse = await groq.chat.completions.create({
      messages: [{ role: 'user', content: plannerPrompt }],
      model: 'llama-3.3-70b-versatile',
    });

    const plan = planResponse.choices[0].message.content;

    let dataResults = [];
    if (plan.startsWith("SQL:")) {
      const sql = plan.replace("SQL:", "").trim().replace(/```sql|```/g, "");
      try {
        const dbRes = await pool.query(sql);
        dataResults = dbRes.rows;
      } catch (e) { console.error("SQL Failed", e); }
    } else if (plan.includes("LATENT_ANALYSIS")) {
      // 3. ACTUAL SEMANTIC SEARCH (RAG in Latent Space)
      try {
        const queryVector = await getEmbedding(query);
        const searchRes = await pool.query(`
          SELECT fields->>'name' as name, rationale, 1 - (rationale_vector <=> $1) as similarity
          FROM submissions
          WHERE rationale_vector IS NOT NULL
          ORDER BY similarity DESC
          LIMIT 3;
        `, [`[${queryVector.join(',')}]`]);
        dataResults = searchRes.rows;
      } catch (e) {
        console.error("Semantic Search Failed", e);
      }
    }

    // 2. FINAL ANSWER GENERATION (Synthesizing Raw Data + Latent Meaning)
    const finalPrompt = `
      You are AdmitGuard AI. Use the provided data to answer the user query in a powerful, data-driven way.
      
      USER QUERY: "${query}"
      RAW DATA RESULTS FROM DATABASE: ${JSON.stringify(dataResults)}
      FULL CONTEXT FOR LATENT ANALYSIS: ${JSON.stringify(context.submissionSummary)}

      INSTRUCTIONS:
      - If numerical results are present, state them with 100% confidence.
      - Reveal patterns in the latent space (e.g., "Several candidates from 2024 are requesting percentage waivers—consider if our threshold is too strict").
      - Use professional, analytical formatting.
    `;

    const finalResponse = await groq.chat.completions.create({
      messages: [{ role: 'user', content: finalPrompt }],
      model: 'llama-3.3-70b-versatile',
    });

    res.json({ response: finalResponse.choices[0].message.content });
  } catch (err) {
    Sentry.captureException(err);
    console.error('AI Analysis Error:', err);
    res.status(500).json({ error: 'AI analysis failed' });
  }
});

Sentry.setupExpressErrorHandler(app);

http.listen(port, () => console.log(`🛡️ Port ${port} (WebSockets ENABLED)`));
