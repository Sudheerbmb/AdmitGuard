// AdmitGuard — backend server.js
// Handles PostgreSQL storage and Manager Decisions

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
require('dotenv').config();
const Groq = require('groq-sdk');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(bodyParser.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// INITIALIZE DB
const initDb = async () => {
  const queryText = `
    CREATE TABLE IF NOT EXISTS submissions (
      id SERIAL PRIMARY KEY,
      candidate_id BIGINT UNIQUE NOT NULL,
      timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      flagged BOOLEAN DEFAULT FALSE,
      exceptions_used TEXT[],
      fields JSONB NOT NULL,
      rationale JSONB,
      decision TEXT DEFAULT 'pending'
    );
    CREATE TABLE IF NOT EXISTS rules (
      id INT PRIMARY KEY,
      config JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await pool.query(queryText);
    await pool.query(`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS decision TEXT DEFAULT 'pending'`);
    
    // Seed default rules if empty
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
initDb();

// ── ENDPOINTS ─────────────────────────────────────────────────────────────────

app.get('/api/rules', async (req, res) => {
  try {
    const result = await pool.query('SELECT config FROM rules WHERE id = 1');
    res.json(result.rows[0].config);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch rules' });
  }
});

app.put('/api/rules', async (req, res) => {
  try {
    const { config } = req.body;
    await pool.query('UPDATE rules SET config = $1, updated_at = CURRENT_TIMESTAMP WHERE id = 1', [JSON.stringify(config)]);
    res.json({ message: 'Rules updated successfully', config });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update rules' });
  }
});

app.get('/api/submissions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM submissions ORDER BY timestamp DESC');
    res.json(result.rows || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch' });
  }
});

app.post('/api/submissions', async (req, res) => {
  const { id, timestamp, flagged, exceptions_used, fields, rationale } = req.body;
  const queryText = `
    INSERT INTO submissions(candidate_id, timestamp, flagged, exceptions_used, fields, rationale, decision)
    VALUES($1, $2, $3, $4, $5, $6, 'pending')
    RETURNING *;
  `;
  const values = [id, timestamp, flagged, exceptions_used, JSON.stringify(fields), JSON.stringify(rationale)];
  try {
    const result = await pool.query(queryText, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
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
    res.json(result.rows[0]);
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
      console.log("🛡️ Executing AI-Generated SQL:", sql);
      try {
        const dbRes = await pool.query(sql);
        dataResults = dbRes.rows;
      } catch (e) {
        console.error("SQL Failed, falling back to context", e);
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
    console.error('AI Analysis Error:', err);
    res.status(500).json({ error: 'AI analysis failed' });
  }
});

app.listen(port, () => console.log(`🛡️ Port ${port}`));
