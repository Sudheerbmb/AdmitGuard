// AdmitGuard — audit.js
// Enhanced with PII masking, data visualization, and Remote API support

let allSubmissions = [];
let piiMaskingEnabled = true;
let RULES = {};

document.addEventListener('DOMContentLoaded', async () => {
  await loadRules();
  loadSubmissions();

  document.getElementById('searchInput').addEventListener('input', renderTable);
  document.getElementById('filterSelect').addEventListener('change', renderTable);
  document.getElementById('exportBtn').addEventListener('click', exportCSV);
  document.getElementById('clearBtn').addEventListener('click', clearAll);
  document.getElementById('syncBtn').addEventListener('click', simulateSync);
  
  const piiToggle = document.getElementById('piiToggle');
  piiToggle.classList.toggle('on', piiMaskingEnabled);
  document.getElementById('piiToggleGroup').addEventListener('click', () => {
    piiMaskingEnabled = !piiMaskingEnabled;
    piiToggle.classList.toggle('on', piiMaskingEnabled);
    renderTable();
  });

  document.getElementById('modalClose').addEventListener('click', () => {
    document.getElementById('detailModal').classList.remove('show');
  });
});

async function loadRules() {
  try {
    const res = await fetch(chrome.runtime.getURL('rules.json'));
    RULES = await res.json();
  } catch (e) { console.error('Failed to load rules in audit.'); }
}

async function loadSubmissions() {
  if (RULES.api_url && RULES.api_url !== 'YOUR_DEPLOYED_BACKEND_URL_HERE') {
    try {
      const res = await fetch(`${RULES.api_url}/api/submissions`);
      if (res.ok) {
        const remoteData = await res.json();
        allSubmissions = remoteData.map(row => ({
          id: row.candidate_id || row.id,
          timestamp: row.timestamp,
          flagged: row.flagged,
          exceptions_used: row.exceptions_used,
          fields: typeof row.fields === 'string' ? JSON.parse(row.fields) : row.fields,
          rationale: typeof row.rationale === 'string' ? JSON.parse(row.rationale) : row.rationale,
          decision: row.decision || 'pending'
        }));
        updateDashboard();
        return;
      }
    } catch (e) { console.warn('Remote fetch failed.'); }
  }

  try {
    chrome.storage.local.get(['admitguard_submissions'], (result) => {
      allSubmissions = (result.admitguard_submissions || []).map(s => ({...s, decision: s.decision || 'pending'}));
      updateDashboard();
    });
  } catch (_) { updateDashboard(); }
}

function updateDashboard() {
  updateStats();
  updateComplianceBar();
  renderTable();
}

function updateStats() {
  const total = allSubmissions.length;
  document.getElementById('statTotal').textContent = total;
  document.getElementById('statFlagged').textContent = allSubmissions.filter(s => s.flagged).length;
  document.getElementById('statExceptions').textContent = allSubmissions.filter(s => s.exceptions_used?.length > 0).length;
  document.getElementById('statToday').textContent = allSubmissions.filter(s => new Date(s.timestamp).toDateString() === new Date().toDateString()).length;
}

function updateComplianceBar() {
  const total = allSubmissions.length;
  if (total === 0) return;
  const flagged = allSubmissions.filter(s => s.flagged).length;
  const cleanPct = ((total - flagged) / total) * 100;
  document.getElementById('barClean').style.width = `${cleanPct}%`;
  document.getElementById('barFlagged').style.width = `${100 - cleanPct}%`;
  document.getElementById('compliancePct').textContent = `${Math.round(cleanPct)}% High Integrity`;
}

function sanitize(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function mask(str, type = 'phone') {
  if (!piiMaskingEnabled || !str) return str;
  if (type === 'phone') return str.slice(0, 3) + 'XXXX' + str.slice(7);
  if (type === 'aadhaar') return 'XXXX XXXX ' + str.slice(8);
  const parts = str.split('@');
  return parts.length < 2 ? str : parts[0][0] + '***@' + parts[1];
}

async function makeDecision(candidateId, status) {
  if (!RULES.api_url) return alert('Decision requires a live backend.');
  
  try {
    const res = await fetch(`${RULES.api_url}/api/submissions/${candidateId}/decision`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: status })
    });
    if (res.ok) loadSubmissions();
  } catch (e) { alert('Failed to update decision.'); }
}

function renderTable() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const filter = document.getElementById('filterSelect').value;
  let data = [...allSubmissions].reverse();

  if (search) data = data.filter(s => (s.fields?.name || '').toLowerCase().includes(search));
  if (filter === 'flagged') data = data.filter(s => s.flagged);

  const tbody = document.getElementById('auditBody');
  tbody.innerHTML = data.map(sub => {
    const excs = (sub.exceptions_used || []).map(e => `<span class="badge exception">${sanitize(e)}</span>`).join('');
    const statusBadge = sub.flagged ? `<span class="badge flagged">⚑ Flagged</span>` : `<span class="badge ok">✓ Clean</span>`;
    
    return `
      <tr onclick="showDetail(${sub.id})" style="cursor:pointer">
        <td style="font-size:10px; color:var(--muted)">#${sub.id.toString().slice(-4)}</td>
        <td>${new Date(sub.timestamp).toLocaleDateString()}</td>
        <td style="font-weight:600">${sanitize(sub.fields?.name)}</td>
        <td style="color:var(--muted)">${sanitize(mask(sub.fields?.email, 'email'))}</td>
        <td>${sanitize(mask(sub.fields?.phone, 'phone'))}</td>
        <td>${excs}</td>
        <td>${statusBadge}</td>
        <td><span class="badge ${sub.decision}">${sub.decision.toUpperCase()}</span></td>
        <td style="text-align:right">→</td>
      </tr>`;
  }).join('');
}

function showDetail(id) {
  const sub = allSubmissions.find(s => s.id === id);
  if (!sub) return;
  const fields = [
    ['Name', sanitize(sub.fields.name)],
    ['Email', sanitize(mask(sub.fields.email, 'email'))],
    ['Decision', sub.decision.toUpperCase()],
    ['Submitted At', new Date(sub.timestamp).toLocaleString()],
    ['Exceptions', (sub.exceptions_used || []).join(', ') || 'None']
  ];
  document.getElementById('modalContent').innerHTML = fields.map(([k, v]) => `<div class="detail-row"><div class="detail-key">${k}</div><div class="detail-val">${v}</div></div>`).join('');
  document.getElementById('detailModal').classList.add('show');
}

async function simulateSync() {
  const btn = document.getElementById('syncBtn');
  btn.textContent = 'Syncing...';
  await loadSubmissions();
  btn.textContent = 'Sync Complete';
  setTimeout(() => btn.textContent = 'Cloud Sync', 2000);
}

function exportCSV() {
  const headers = ['ID','Name','Email','Status','Decision'];
  const rows = allSubmissions.map(s => [s.id, s.fields.name, s.fields.email, s.flagged ? 'FLAGGED':'OK', s.decision]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'audit-log.csv';
  a.click();
}

async function clearAll() {
  if (!confirm('Clear all?')) return;
  if (RULES.api_url) await fetch(`${RULES.api_url}/api/submissions`, { method: 'DELETE' });
  allSubmissions = [];
  updateDashboard();
}
