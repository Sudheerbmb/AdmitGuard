// AdmitGuard — backend server.js
// Handles PostgreSQL storage and Manager Decisions

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
require('dotenv').config();

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
  `;
  try {
    await pool.query(queryText);
    // Explicitly add 'decision' column if missed in older runs
    await pool.query(`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS decision TEXT DEFAULT 'pending'`);
    console.log('Database initialized successfully.');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
};
initDb();

// ── ENDPOINTS ─────────────────────────────────────────────────────────────────

app.get('/api/submissions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM submissions ORDER BY timestamp DESC');
    res.json(result.rows);
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

// NEW: PATCH decision status
app.patch('/api/submissions/:candidate_id/decision', async (req, res) => {
  const { candidate_id } = req.params;
  const { decision } = req.body; // 'approved' or 'rejected'

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
app.listen(port, () => console.log(`🛡️ Port ${port}`));
