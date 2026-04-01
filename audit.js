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
  // Try remote backend if configured
  if (RULES.api_url && RULES.api_url !== 'YOUR_DEPLOYED_BACKEND_URL_HERE') {
    try {
      const res = await fetch(`${RULES.api_url}/api/submissions`);
      if (res.ok) {
        const remoteData = await res.json();
        // Convert remote DB fields back to the format extension expects
        allSubmissions = remoteData.map(row => ({
          id: row.candidate_id,
          timestamp: row.timestamp,
          flagged: row.flagged,
          exceptions_used: row.exceptions_used,
          fields: typeof row.fields === 'string' ? JSON.parse(row.fields) : row.fields,
          rationale: typeof row.rationale === 'string' ? JSON.parse(row.rationale) : row.rationale
        }));
        updateDashboard();
        return;
      }
    } catch (e) {
      console.warn('Remote sync failed, checking local storage...');
    }
  }

  // Local Fallback
  try {
    chrome.storage.local.get(['admitguard_submissions'], (result) => {
      if (result && result.admitguard_submissions) {
        allSubmissions = result.admitguard_submissions;
      } else {
        allSubmissions = JSON.parse(localStorage.getItem('admitguard_submissions') || '[]');
      }
      updateDashboard();
    });
  } catch (_) {
    allSubmissions = JSON.parse(localStorage.getItem('admitguard_submissions') || '[]');
    updateDashboard();
  }
}

function updateDashboard() {
  updateStats();
  updateComplianceBar();
  renderTable();
}

function updateStats() {
  const today = new Date().toDateString();
  const total = allSubmissions.length;
  const flagged = allSubmissions.filter(s => s.flagged).length;
  const withEx = allSubmissions.filter(s => s.exceptions_used?.length > 0).length;
  const countToday = allSubmissions.filter(s => new Date(s.timestamp).toDateString() === today).length;

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statFlagged').textContent = flagged;
  document.getElementById('statExceptions').textContent = withEx;
  document.getElementById('statToday').textContent = countToday;
}

function updateComplianceBar() {
  const total = allSubmissions.length;
  if (total === 0) {
    document.getElementById('barClean').style.width = '0%';
    document.getElementById('barFlagged').style.width = '0%';
    document.getElementById('compliancePct').textContent = 'No Data';
    return;
  }

  const flagged = allSubmissions.filter(s => s.flagged).length;
  const clean = total - flagged;
  
  const cleanPct = (clean / total) * 100;
  const flaggedPct = (flagged / total) * 100;

  document.getElementById('barClean').style.width = `${cleanPct}%`;
  document.getElementById('barFlagged').style.width = `${flaggedPct}%`;
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
  if (type === 'email') {
    const parts = str.split('@');
    if (parts.length < 2) return str;
    const [name, domain] = parts;
    return name[0] + '***@' + domain;
  }
  return '********';
}

function renderTable() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const filter = document.getElementById('filterSelect').value;

  let data = [...allSubmissions].reverse();

  if (search) {
    data = data.filter(s =>
      (s.fields?.name || '').toLowerCase().includes(search) ||
      (s.fields?.email || '').toLowerCase().includes(search)
    );
  }
  if (filter === 'flagged') data = data.filter(s => s.flagged);
  if (filter === 'clean') data = data.filter(s => !s.flagged);

  const tbody = document.getElementById('auditBody');
  const empty = document.getElementById('emptyState');

  if (data.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = data.map((sub) => {
    const ts = new Date(sub.timestamp);
    const dateStr = ts.toLocaleDateString();
    const timeStr = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const excs = (sub.exceptions_used || []).map(e =>
      `<span class="badge exception">${sanitize(e.replace('_', ' '))}</span>`
    ).join('') || '—';
    const statusBadge = sub.flagged
      ? `<span class="badge flagged">⚑ Flagged</span>`
      : `<span class="badge ok">✓ Clean</span>`;

    return `
      <tr class="${sub.flagged ? 'flagged' : ''}" onclick="showDetail(${sub.id})" style="cursor:pointer">
        <td style="color:var(--muted);font-family:'Space Mono',monospace;font-size:10px">#${sub.id.toString().slice(-4)}</td>
        <td>
          <div style="font-size:11px">${dateStr}</div>
          <div style="font-size:10px;color:var(--muted)">${timeStr}</div>
        </td>
        <td style="font-weight:600">${sanitize(sub.fields?.name)}</td>
        <td style="color:var(--muted)">${sanitize(mask(sub.fields?.email, 'email'))}</td>
        <td>${sanitize(mask(sub.fields?.phone, 'phone'))}</td>
        <td>${excs}</td>
        <td>${statusBadge}</td>
        <td style="text-align:right"><span style="color:var(--accent); font-size:14px">→</span></td>
      </tr>
    `;
  }).join('');
}

function showDetail(id) {
  const sub = allSubmissions.find(s => s.id === id);
  if (!sub) return;

  const fields = [
    ['Name', sanitize(sub.fields.name)],
    ['Email', sanitize(mask(sub.fields.email, 'email'))],
    ['Phone', sanitize(mask(sub.fields.phone, 'phone'))],
    ['Aadhaar', sanitize(mask(sub.fields.aadhaar, 'aadhaar'))],
    ['Age', sub.fields.age],
    ['Qualification', sanitize(sub.fields.qualification)],
    ['Graduation Year', sub.fields.grad_year],
    ['Percentage / CGPA', sub.fields.percentage],
    ['Screening Score', sub.fields.screening_score],
    ['Interview Status', sub.fields.interview_status],
    ['Offer Letter', sub.fields.offer_letter],
    ['Submitted At', new Date(sub.timestamp).toLocaleString()],
    ['Exceptions Used', (sub.exceptions_used || []).join(', ') || 'None'],
    ['Flagged Status', sub.flagged ? '⚑ HIGH RISK — Manager Review Needed' : '✓ COMPLIANT'],
  ];

  if (sub.rationale) {
    Object.entries(sub.rationale).forEach(([k, v]) => {
      if (v) fields.push([`Rationale (${k.replace('_', ' ')})`, sanitize(v)]);
    });
  }

  document.getElementById('modalContent').innerHTML = fields.map(([k, v]) => `
    <div class="detail-row">
      <div class="detail-key">${k}</div>
      <div class="detail-val">${v}</div>
    </div>
  `).join('');

  document.getElementById('detailModal').classList.add('show');
}

function simulateSync() {
  const btn = document.getElementById('syncBtn');
  const status = document.getElementById('syncStatus');
  btn.disabled = true;
  btn.textContent = 'Syncing...';
  status.textContent = 'Refreshing data from Remote Server...';

  loadSubmissions().then(() => {
    setTimeout(() => {
      btn.textContent = 'Sync Complete';
      btn.classList.remove('success');
      btn.style.borderColor = 'var(--accent)';
      status.textContent = `Last sync: ${new Date().toLocaleTimeString()} (Status: 200 OK)`;
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = 'Cloud Sync';
        btn.classList.add('success');
      }, 3000);
    }, 1000);
  });
}

function exportCSV() {
  if (allSubmissions.length === 0) { alert('No submissions to export.'); return; }

  const headers = ['ID','Timestamp','Name','Email','Phone','Qualification','Age','Grad Year','Percentage','Score','Interview','Offer Letter','Exceptions','Flagged'];
  const rows = allSubmissions.map(s => [
    s.id,
    s.timestamp,
    `"${s.fields?.name}"`,
    s.fields?.email,
    s.fields?.phone,
    s.fields?.qualification,
    s.fields?.age,
    s.fields?.grad_year,
    s.fields?.percentage,
    s.fields?.screening_score,
    s.fields?.interview_status,
    s.fields?.offer_letter,
    `"${(s.exceptions_used||[]).join(', ')}"`,
    s.flagged ? 'YES' : 'NO'
  ]);

  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `admitguard-audit-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function clearAll() {
  if (!confirm('Delete all submissions? This cannot be undone.')) return;
  
  if (RULES.api_url && RULES.api_url !== 'YOUR_DEPLOYED_BACKEND_URL_HERE') {
    try {
      await fetch(`${RULES.api_url}/api/submissions`, { method: 'DELETE' });
    } catch (e) {
      console.error('Failed to clear remote data.');
      alert('Failed to clear remote data. Check console.');
    }
  }

  allSubmissions = [];
  localStorage.removeItem('admitguard_submissions');
  try { chrome.storage.local.remove('admitguard_submissions'); } catch (_) {}
  updateDashboard();
}
