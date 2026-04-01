// AdmitGuard — backend server.js
// Handles PostgreSQL storage for the extension

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Security Middleware
app.use(cors({ origin: '*' })); // Extension needs access from any origin
app.use(bodyParser.json());

// Database Configuration (Postgres)
// If process.env.DATABASE_URL is not set, use local/mock connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// INITIALIZE DB (Tables)
const initDb = async () => {
  const queryText = `
    CREATE TABLE IF NOT EXISTS submissions (
      id SERIAL PRIMARY KEY,
      candidate_id BIGINT UNIQUE NOT NULL,
      timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      flagged BOOLEAN DEFAULT FALSE,
      exceptions_used TEXT[],
      fields JSONB NOT NULL,
      rationale JSONB
    );
  `;
  try {
    await pool.query(queryText);
    console.log('Database initialized successfully.');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
};
initDb();

// ── ENDPOINTS ─────────────────────────────────────────────────────────────────

// GET: All submissions
app.get('/api/submissions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM submissions ORDER BY timestamp DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// POST: A new submission
app.post('/api/submissions', async (req, res) => {
  const { id, timestamp, flagged, exceptions_used, fields, rationale } = req.body;
  
  const queryText = `
    INSERT INTO submissions(candidate_id, timestamp, flagged, exceptions_used, fields, rationale)
    VALUES($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;
  const values = [id, timestamp, flagged, exceptions_used, JSON.stringify(fields), JSON.stringify(rationale)];

  try {
    const result = await pool.query(queryText, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error saving submission:', err);
    res.status(500).json({ error: 'Failed to save submission' });
  }
});

// DELETE: Clear all logs
app.delete('/api/submissions', async (req, res) => {
  try {
    await pool.query('DELETE FROM submissions');
    res.json({ message: 'All logs cleared successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear database' });
  }
});

// Health check
app.get('/health', (req, res) => res.send('AdmitGuard Backend: LIVE 🛡️'));

app.listen(port, () => {
  console.log(`🛡️ AdmitGuard Backend listening on port ${port}`);
});
