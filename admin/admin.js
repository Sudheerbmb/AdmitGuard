/* AdmitGuard — admin.js */
/* Dashboard Intelligence & Pipeline Automation */

let allSubmissions = [];
let selectedIds = new Set();
let piiMaskingEnabled = true;
let RULES = {};

function getAuthHeader() {
  const token = sessionStorage.getItem('admitguard_auth_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadRules();
  await loadSubmissions();

  // Navigation Logic
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      if (!view) return;

      document.querySelector('.nav-item.active').classList.remove('active');
      item.classList.add('active');
      
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.getElementById(view + 'View').classList.add('active');
      
      const title = item.innerText.replace(item.querySelector('.icon')?.innerText || '', '').trim();
      document.getElementById('viewTitle').textContent = title;
      
      // Secondary Renderers
      if (view === 'pipeline') renderPipeline();
      if (view === 'audit') renderDetailedLogs();
      if (view === 'rules') renderRuleConfig();
    });
  });

  // Event Listeners
  document.getElementById('syncBtn').addEventListener('click', loadSubmissions);
  document.getElementById('searchInput').addEventListener('input', renderDashboard);
  document.getElementById('logSearch')?.addEventListener('input', renderDetailedLogs);
  document.getElementById('filterSelect').addEventListener('change', renderDashboard);
  document.getElementById('exportBtn').addEventListener('click', exportFullReport);
  document.getElementById('selectAll').addEventListener('change', toggleSelectAll);
  document.getElementById('piiToggleWrap').addEventListener('click', togglePII);
  document.getElementById('saveRulesBtn')?.addEventListener('click', () => alert('Configuration Locked. (Backend integration required for persistence)'));
  document.getElementById('bulkApprove').addEventListener('click', () => bulkAction('approved'));
  document.getElementById('bulkReject').addEventListener('click', () => bulkAction('rejected'));
  document.getElementById('modalClose').addEventListener('click', () => document.getElementById('detailModal').classList.remove('active'));

  // AI Assistant listeners
  document.getElementById('aiSendBtn')?.addEventListener('click', askAiAssistant);
  document.getElementById('aiInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') askAiAssistant();
  });
  document.getElementById('toggleAiSidebar')?.addEventListener('click', () => {
    const container = document.getElementById('aiContainer');
    container.classList.toggle('sidebar-hidden');
  });
});

async function loadRules() {
  const fallbackUrl = 'https://admitguardd.onrender.com';
  try {
    // Try to get rules from backend first
    const res = await fetch(`${fallbackUrl}/api/rules`, { headers: getAuthHeader() });
    if (res.ok) {
      RULES = await res.json();
      RULES.api_url = fallbackUrl;
    } else { throw new Error(); }
  } catch (e) {
    console.warn('Backend rules unreachable. Using local manifest.');
    try {
      const res = await fetch(chrome.runtime.getURL('rules.json'));
      RULES = await res.json();
    } catch (e2) {
      RULES = { api_url: fallbackUrl, age: {min:18, max:35}, graduation_year: {min:2015, max:2025}, exception_limit: 2 };
    }
  }
}

async function loadSubmissions() {
  const btn = document.getElementById('syncBtn');
  const status = document.getElementById('backendStatus');
  btn.textContent = 'Syncing...';
  
  try {
    const res = await fetch(`${RULES.api_url}/api/submissions`, { headers: getAuthHeader() });
    if (res.ok) {
      const data = await res.json();
      allSubmissions = data.map(row => ({
        id: row.candidate_id || row.id,
        timestamp: row.timestamp,
        flagged: row.flagged,
        exceptions_used: row.exceptions_used || [],
        fields: typeof row.fields === 'string' ? JSON.parse(row.fields) : row.fields,
        rationale: typeof row.rationale === 'string' ? JSON.parse(row.rationale) : row.rationale,
        decision: row.decision || 'pending'
      }));
      status.textContent = 'CONNECTED';
      status.style.color = 'var(--success)';
      
      // Refresh current view
      const activeNav = document.querySelector('.nav-item.active').dataset.view;
      if (activeNav === 'dashboard') renderDashboard();
      else if (activeNav === 'pipeline') renderPipeline();
      else if (activeNav === 'audit') renderDetailedLogs();
    }
  } catch (err) {
    status.textContent = 'OFFLINE';
    status.style.color = 'var(--error)';
    console.error('Fetch error:', err);
  } finally {
    btn.textContent = 'Refresh Sync';
  }
}

function renderDashboard() {
  updateStats();
  updateAnalytics();
  renderTable();
}

function updateStats() {
  const total = allSubmissions.length;
  const approved = allSubmissions.filter(s => s.decision === 'approved').length;
  const rejected = allSubmissions.filter(s => s.decision === 'rejected').length;
  const flagged = allSubmissions.filter(s => s.flagged).length;

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statApproved').textContent = approved;
  document.getElementById('statRejected').textContent = rejected;
  document.getElementById('statFlagged').textContent = flagged;
}

function updateAnalytics() {
  const total = allSubmissions.length;
  if (total === 0) return;

  // 1. Funnel Calculation
  const validated = allSubmissions.filter(s => !s.flagged).length;
  const approved = allSubmissions.filter(s => s.decision === 'approved').length;

  const validPct = Math.round((validated / total) * 100);
  const appPct = Math.round((approved / total) * 100);

  document.getElementById('barValidated').style.width = `${validPct}%`;
  document.getElementById('pctValidated').textContent = `${validPct}%`;
  document.getElementById('barApproved').style.width = `${appPct}%`;
  document.getElementById('pctApproved').textContent = `${appPct}%`;

  // 2. Risk Insights (Top Reasons)
  const reasonCounts = {};
  allSubmissions.forEach(sub => {
    sub.exceptions_used.forEach(ex => {
      reasonCounts[ex] = (reasonCounts[ex] || 0) + 1;
    });
  });

  const sortedReasons = Object.entries(reasonCounts).sort((a,b) => b[1] - a[1]).slice(0, 4);
  const riskHtml = sortedReasons.length > 0 ? sortedReasons.map(([reason, count]) => {
    const pct = Math.round((count / total) * 100);
    return `
      <div class="risk-item">
        <div class="risk-label-row">
          <span>${reason.replace('_', ' ').toUpperCase()}</span>
          <span>${count} cases (${pct}%)</span>
        </div>
        <div class="risk-track"><div class="risk-fill" style="width:${pct}%"></div></div>
      </div>
    `;
  }).join('') : `<div class="empty-msg">No major risks detected yet.</div>`;

  document.getElementById('riskChart').innerHTML = riskHtml;
}

function renderTable() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const filter = document.getElementById('filterSelect').value;
  
  let data = [...allSubmissions]; // API returns newest first already
  if (search) data = data.filter(s => (s.fields?.name || '').toLowerCase().includes(search));
  if (filter === 'pending') data = data.filter(s => s.decision === 'pending');
  if (filter === 'flagged') data = data.filter(s => s.flagged);

  const tbody = document.getElementById('adminAuditBody');
  tbody.innerHTML = data.map(sub => {
    const isSelected = selectedIds.has(sub.id);
    const maskedName = mask(sub.fields?.name, 'name');
    const maskedEmail = mask(sub.fields?.email, 'email');
    const statusClass = sub.flagged ? 'badge-flagged' : 'badge-clean';
    const statusText = sub.flagged ? '⚑ FLAG' : '✓ OK';
    
    const decisionBadge = sub.decision === 'pending' ? '<span class="badge badge-pending">PENDING</span>' : `<span class="badge badge-${sub.decision}">${sub.decision.toUpperCase()}</span>`;

    return `
      <tr onclick="showDetails(${sub.id})">
        <td onclick="event.stopPropagation()">
          <input type="checkbox" class="row-select" data-id="${sub.id}" ${isSelected ? 'checked' : ''}>
        </td>
        <td class="name-cell">
          <div>${sanitize(maskedName)}</div>
          <div class="candidate-id">${sanitize(maskedEmail)}</div>
        </td>
        <td><span class="badge ${statusClass}">${statusText}</span></td>
        <td>${sub.exceptions_used.length} Rules</td>
        <td style="max-width: 200px">
          ${sub.exceptions_used.map(e => `<span class="ex-tag">${e.replace('_', ' ')}</span>`).join('') || '—'}
        </td>
        <td>${decisionBadge}</td>
        <td style="display: flex; gap: 8px;">
          <button class="btn-sm approve" onclick="event.stopPropagation(); patchDecision(${sub.id}, 'approved')">APPROVE</button>
          <button class="btn-sm reject" onclick="event.stopPropagation(); patchDecision(${sub.id}, 'rejected')">REJECT</button>
        </td>
      </tr>
    `;
  }).join('');

  // Handle checkboxes
  document.querySelectorAll('.row-select').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const id = parseInt(e.target.dataset.id);
      if (e.target.checked) selectedIds.add(id);
      else selectedIds.delete(id);
      updateBulkUI();
    });
  });
}

function mask(str, type) {
  if (!piiMaskingEnabled || !str) return str;
  if (type === 'email') return str[0] + '***@' + str.split('@')[1];
  if (type === 'name') {
    const parts = str.split(' ');
    if (parts.length > 1) return parts[0] + ' ' + parts[1][0] + '***';
    return parts[0][0] + '***';
  }
  return '********';
}

function sanitize(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function togglePII() {
  piiMaskingEnabled = !piiMaskingEnabled;
  document.getElementById('piiToggle').classList.toggle('on', piiMaskingEnabled);
  renderDashboard();
}

function toggleSelectAll(e) {
  const checked = e.target.checked;
  const cbs = document.querySelectorAll('.row-select');
  cbs.forEach(cb => {
    cb.checked = checked;
    const id = parseInt(cb.dataset.id);
    if (checked) selectedIds.add(id);
    else selectedIds.delete(id);
  });
  updateBulkUI();
}

function updateBulkUI() {
  const bar = document.getElementById('bulkActions');
  const count = document.getElementById('bulkCount');
  if (selectedIds.size > 0) {
    bar.style.display = 'flex';
    count.textContent = `${selectedIds.size} candidates selected`;
  } else {
    bar.style.display = 'none';
  }
}

async function bulkAction(decision) {
  if (!confirm(`Are you sure you want to ${decision} these ${selectedIds.size} candidates?`)) return;
  
  const approveBtn = document.getElementById('bulkApprove');
  const rejectBtn = document.getElementById('bulkReject');
  const originalApproveText = approveBtn.textContent;
  const originalRejectText = rejectBtn.textContent;

  // 1. Immediate Visual Feedback (Snappy UI)
  approveBtn.disabled = true;
  rejectBtn.disabled = true;
  if (decision === 'approved') approveBtn.textContent = 'APPROVING...';
  else rejectBtn.textContent = 'REJECTING...';

  // 2. Optimistic Step: Clear selection and hide bar immediately
  const processingIds = Array.from(selectedIds);
  selectedIds.clear();
  document.getElementById('selectAll').checked = false;
  updateBulkUI(); // Hide the selection bar right away

  try {
    // 3. Process requests in parallel
    const promises = processingIds.map(id => patchDecision(id, decision, true));
    await Promise.all(promises);
  } catch (e) {
    console.error('Bulk action encountered errors', e);
  } finally {
    // 4. Restore UI state and refresh data
    approveBtn.disabled = false;
    rejectBtn.disabled = false;
    approveBtn.textContent = originalApproveText;
    rejectBtn.textContent = originalRejectText;
    await loadSubmissions(); // Re-fetch to confirm server state
  }
}

async function patchDecision(id, decision, isBulk = false) {
  try {
    const res = await fetch(`${RULES.api_url}/api/submissions/${id}/decision`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify({ decision })
    });
    
    // Only trigger individual reload if NOT part of a bulk operation
    if (res.ok && !isBulk) {
      await loadSubmissions();
    }
    return res.ok;
  } catch (e) { 
    console.error(`Decision sync failed for ID ${id}:`, e);
    return false;
  }
}

function showDetails(id) {
  const sub = allSubmissions.find(s => s.id === id);
  if (!sub) return;

  const html = `
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
      <div>
        <h4 style="color:var(--accent); margin-bottom:12px;">Candidate Identity</h4>
        <p><strong>Name:</strong> ${sanitize(sub.fields.name)}</p>
        <p><strong>Email:</strong> ${sanitize(sub.fields.email)}</p>
        <p><strong>Aadhaar:</strong> ${sanitize(sub.fields.aadhaar)}</p>
      </div>
      <div>
        <h4 style="color:var(--accent); margin-bottom:12px;">Validation Matrix</h4>
        <p><strong>Status:</strong> ${sub.flagged ? 'FLAGGED' : 'CLEAN'}</p>
        <p><strong>Rules Failing:</strong> ${sub.exceptions_used.join(', ') || 'NONE'}</p>
        <p><strong>Manager Status:</strong> ${sub.decision.toUpperCase()}</p>
      </div>
    </div>
    <div style="margin-top:24px;">
      <h4 style="color:var(--accent); margin-bottom:12px;">Staff Rationale</h4>
      <div style="background:var(--surface2); padding:16px; border-radius:8px; border:1px solid var(--border); font-size:12px; line-height:1.6">
        ${Object.entries(sub.rationale || {}).map(([rule, text]) => `<strong>${rule}:</strong> ${sanitize(text)}`).join('<br><br>')}
      </div>
    </div>
  `;

  document.getElementById('modalContent').innerHTML = html;
  document.getElementById('detailModal').classList.add('active');
}

function renderPipeline() {
  const containers = {
    pending: document.getElementById('pipelinePending'),
    flagged: document.getElementById('pipelineFlagged'),
    approved: document.getElementById('pipelineApproved'),
    rejected: document.getElementById('pipelineRejected')
  };
  
  const counts = { pending: 0, flagged: 0, approved: 0, rejected: 0 };
  
  // Clear lists
  Object.values(containers).forEach(c => c.innerHTML = '');
  
  allSubmissions.forEach(sub => {
    let stage = sub.decision === 'pending' ? (sub.flagged ? 'flagged' : 'pending') : sub.decision;
    counts[stage]++;
    
    const card = document.createElement('div');
    card.className = 'pipeline-card';
    card.onclick = () => showDetails(sub.id);
    card.innerHTML = `
      <div class="card-name">${sanitize(sub.fields?.name)}</div>
      <div class="card-meta">
        <span>ID: ${sub.id}</span>
        ${sub.flagged ? '<span class="card-flag">⚠ FLAG</span>' : ''}
      </div>
    `;
    containers[stage].appendChild(card);
  });
  
  // Update counts
  document.getElementById('countPending').textContent = counts.pending;
  document.getElementById('countFlagged').textContent = counts.flagged;
  document.getElementById('countApproved').textContent = counts.approved;
  document.getElementById('countRejected').textContent = counts.rejected;
}

function renderDetailedLogs() {
  const search = document.getElementById('logSearch')?.value.toLowerCase() || '';
  const body = document.getElementById('fullLogBody');
  if (!body) return;
  
  let data = allSubmissions.filter(s => 
    s.id.toString().includes(search) || 
    s.fields.email.toLowerCase().includes(search) ||
    s.fields.name.toLowerCase().includes(search)
  );
  
  body.innerHTML = data.map(sub => `
    <tr>
      <td style="font-family:monospace; font-size:10px;">${new Date(sub.timestamp).toLocaleString()}</td>
      <td>${sub.id}</td>
      <td><span class="badge ${sub.flagged ? 'badge-flagged' : 'badge-clean'}">${sub.flagged ? 'FLAGGED' : 'CLEAN'}</span></td>
      <td>${sub.exceptions_used.length} Failures</td>
      <td style="font-size:11px; color:var(--muted)">${Object.keys(sub.rationale || {}).join(', ')}</td>
      <td><span class="badge badge-${sub.decision}">${sub.decision.toUpperCase()}</span></td>
    </tr>
  `).join('');
}

function renderRuleConfig() {
  const container = document.getElementById('rulesConfigContent');
  if (!container) return;
  
  container.innerHTML = `
    <div class="rules-container">
      <!-- SOFT RULES -->
      <div class="rule-group">
        <div class="panel-header" style="color:var(--accent)">SOFT RULES (Exceptions Allowed)</div>
        <p style="font-size:11px; color:var(--muted); margin-bottom:15px;">These rules trigger a 'Rationale' request but do not block the officer from submitting.</p>
        
        <div class="rule-row">
          <div class="rule-info"><h4>Age Boundaries</h4><p>Allowed age range for candidates.</p></div>
          <div style="display:flex; gap:8px;">
            <input type="number" id="rule-age-min" class="rule-input" value="${RULES.age.min}" title="Min">
            <input type="number" id="rule-age-max" class="rule-input" value="${RULES.age.max}" title="Max">
          </div>
        </div>

        <div class="rule-row">
          <div class="rule-info"><h4>Graduation Window</h4><p>Earliest and latest graduation years.</p></div>
          <div style="display:flex; gap:8px;">
            <input type="number" id="rule-grad-min" class="rule-input" value="${RULES.graduation_year.min}">
            <input type="number" id="rule-grad-max" class="rule-input" value="${RULES.graduation_year.max}">
          </div>
        </div>

        <div class="rule-row">
          <div class="rule-info"><h4>Academia Thresholds</h4><p>Min Percentage and CGPA (10-point scale).</p></div>
          <div style="display:flex; gap:8px;">
            <input type="number" id="rule-perc" class="rule-input" value="${RULES.percentage.min}" title="%">
            <input type="number" id="rule-cgpa" class="rule-input" value="${RULES.cgpa.min}" title="CGPA">
          </div>
        </div>

        <div class="rule-row">
          <div class="rule-info"><h4>Screening Score</h4><p>Minimum required to pass initial test.</p></div>
          <input type="number" id="rule-score-min" class="rule-input" value="${RULES.screening_score.min}">
        </div>
      </div>

      <!-- HARD RULES -->
      <div class="rule-group">
        <div class="panel-header" style="color:var(--error)">HARD RULES (Strict Blocks)</div>
        <p style="font-size:11px; color:var(--muted); margin-bottom:15px;">These rules block the 'SUBMIT' button entirely until fixed. No exceptions permitted.</p>
        
        <div class="rule-row">
          <div class="rule-info"><h4>Aadhaar Verhoeff Check</h4><p>Use mathematical checksum to spot fake numbers.</p></div>
          <select id="rule-aadhaar-sum" class="rule-input">
            <option value="true" ${RULES.aadhaar_checksum ? 'selected' : ''}>ENABLED</option>
            <option value="false" ${!RULES.aadhaar_checksum ? 'selected' : ''}>DISABLED</option>
          </select>
        </div>

        <div class="rule-row">
          <div class="rule-info"><h4>Email Whitelist</h4><p>Comma-separated allowed domains (e.g. google.com)</p></div>
          <input type="text" id="rule-email-white" class="rule-input" style="width:200px;" value="${(RULES.email_whitelist || []).join(', ')}">
        </div>

        <div class="rule-row">
          <div class="rule-info"><h4>Block Interview Rejects</h4><p>Prevent submissions for 'Rejected' candidates.</p></div>
          <span style="font-size:10px; color:var(--success); font-weight:bold;">ALWAYS FORCED</span>
        </div>
      </div>

      <!-- COMPLIANCE -->
      <div class="rule-group">
        <div class="panel-header" style="color:var(--warn)">COMPLIANCE & AUDIT</div>
        
        <div class="rule-row">
          <div class="rule-info"><h4>Exception Flagging Limit</h4><p>How many exceptions before candidate is FLAGGED.</p></div>
          <input type="number" id="rule-limit" class="rule-input" value="${RULES.exception_limit}">
        </div>

        <div class="rule-row">
          <div class="rule-info"><h4>Rationale Requirement</h4><p>Min characters and list of mandatory keywords.</p></div>
          <div style="display:flex; flex-direction:column; gap:8px; align-items:flex-end;">
            <input type="number" id="rule-len" class="rule-input" value="${RULES.rationale_min_length}" placeholder="Min length">
            <input type="text" id="rule-keywords" class="rule-input" style="width:250px;" value="${(RULES.exception_keywords || []).join(', ')}" placeholder="Keywords (comma separated)">
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('saveRulesBtn').onclick = saveRules;
}

async function saveRules() {
  const btn = document.getElementById('saveRulesBtn');
  const originalText = btn.textContent;
  btn.textContent = 'DEPLOYING RULES...';
  btn.disabled = true;

  const newConfig = {
    ...RULES,
    age: { min: parseInt(document.getElementById('rule-age-min').value), max: parseInt(document.getElementById('rule-age-max').value) },
    graduation_year: { min: parseInt(document.getElementById('rule-grad-min').value), max: parseInt(document.getElementById('rule-grad-max').value) },
    percentage: { min: parseInt(document.getElementById('rule-perc').value) },
    cgpa: { min: parseFloat(document.getElementById('rule-cgpa').value) },
    screening_score: { ...RULES.screening_score, min: parseInt(document.getElementById('rule-score-min').value) },
    aadhaar_checksum: document.getElementById('rule-aadhaar-sum').value === 'true',
    email_whitelist: document.getElementById('rule-email-white').value.split(',').map(s => s.trim()).filter(s => s),
    exception_limit: parseInt(document.getElementById('rule-limit').value),
    rationale_min_length: parseInt(document.getElementById('rule-len').value),
    exception_keywords: document.getElementById('rule-keywords').value.split(',').map(s => s.trim()).filter(s => s)
  };

  try {
    const res = await fetch(`${RULES.api_url}/api/rules`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify({ config: newConfig })
    });
    if (res.ok) {
      const data = await res.json();
      RULES = data.config;
      alert('SUCCESS: All system rules updated and deployed to Cloud.');
    } else {
      throw new Error();
    }
  } catch (e) {
    alert('ERROR: Could not save rules. Check backend connection.');
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

function exportFullReport() {
  const headers = ['ID','Date','Name','Email','Flagged','Exceptions','Decision'];
  const rows = allSubmissions.map(s => [
    s.id, new Date(s.timestamp).toLocaleDateString(), 
    s.fields.name, s.fields.email, s.flagged ? 'YES':'NO',
    `"${s.exceptions_used.join(',')}"`, s.decision
  ]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `ADMITGUARD_REPORT_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}

/** 🤖 AI ASSISTANT / RAG LOGIC **/

function setAiQuery(text) {
  const input = document.getElementById('aiInput');
  if (input) {
    input.value = text;
    input.focus();
  }
}

async function askAiAssistant() {
  const input = document.getElementById('aiInput');
  const history = document.getElementById('chatHistory');
  const query = input.value.trim();
  
  if (!query) return;

  // 1. Add User Msg
  const userDiv = document.createElement('div');
  userDiv.className = 'user-msg';
  userDiv.textContent = query;
  history.appendChild(userDiv);
  input.value = '';
  history.scrollTop = history.scrollHeight;

  // 2. Add AI Loading Msg
  const aiDiv = document.createElement('div');
  aiDiv.className = 'ai-msg';
  aiDiv.innerHTML = '<span class="loading-dots">Thinking...</span>';
  history.appendChild(aiDiv);

  try {
    // 3. Prepare Context (RAG - Lightweight)
    // We send current rules and a summarized version of submissions
    const context = {
      rules: RULES,
      submissionSummary: allSubmissions.map(s => ({
        id: s.id,
        candidate_name: s.fields.name,
        email: s.fields.email,
        percentage: s.fields.percentage,
        screening_score: s.fields.screening_score,
        graduation_year: s.fields.grad_year,
        flagged: s.flagged,
        exceptions: s.exceptions_used,
        decision: s.decision,
        rationales: s.rationale
      }))
    };

    const res = await fetch(`${RULES.api_url}/api/analyze`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify({ query, context })
    });

    if (!res.ok) throw new Error('AI analysis failed');
    
    const data = await res.json();
    
    // 4. SMART INTERACTION: Populate the Mentioned Profiles Sidebar
    const idMatches = [...new Set(data.response.match(/\d{10,15}/g))]; // MORE ROBUST REGEX
    const mentionList = document.getElementById('aiMentionedProfiles');
    if (mentionList && idMatches.length > 0) {
      mentionList.innerHTML = '';
      idMatches.forEach(idStr => {
        const id = parseInt(idStr);
        const sub = allSubmissions.find(s => s.id === id);
        if (sub) {
          const card = document.createElement('div');
          card.className = 'mentioned-card';
          card.innerHTML = `
            <h5>${sub.fields.name}</h5>
            <div class="meta">ID: ${id} • ${sub.fields.percentage}%</div>
            <button class="btn-audit" onclick="showDetails(${id})">DEEP DIVE</button>
          `;
          mentionList.appendChild(card);
        }
      });
    }

    // Parse response for simple markdown and dynamic links
    aiDiv.innerHTML = formatAiResponse(data.response);

  } catch (err) {
    aiDiv.innerHTML = `<span style="color:var(--error)">Error: ${err.message}. Ensure backend is updated.</span>`;
  } finally {
    history.scrollTop = history.scrollHeight;
  }
}

function formatAiResponse(text) {
  let formatted = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\* (.*?)/g, '<br>• $1')
    .replace(/\n/g, '<br>');

  // INJECT DYNAMIC DEEP DIVE LINKS
  formatted = formatted.replace(/\b(\d{10,14})\b/g, (match) => {
    const id = parseInt(match);
    const exists = allSubmissions.some(s => s.id === id);
    if (exists) {
      return `<span class="ai-deep-dive-btn" onclick="showDetails(${id})">📂 VIEW PROFILE (${id})</span>`;
    }
    return match;
  });

  return formatted;
}
