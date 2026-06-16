// ─── State ───────────────────────────────────────────────────────────────────
const state = {
  rawText: '',
  headers: [],
  rows: [],          // array of objects
  errors: [],        // { rowIndex, field, message, severity }
  errorRowSet: new Set(),
  fileSummary: '',
  countryRules: [
    { code: 'IN', digits: 10, label: 'India (IN)' },
    { code: 'SG', digits: 8,  label: 'Singapore (SG)' },
    { code: 'US', digits: 10, label: 'USA (US)' },
    { code: 'GB', digits: 10, label: 'UK (GB)' },
  ],
  dateFormats: ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY', 'DD-MM-YYYY', 'YYYY/MM/DD'],
  phoneColumns: new Set(),
  dateColumns: new Set(),
  requiredColumns: new Set(),
};

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const dropZone   = $('drop-zone');
const fileInput  = $('file-input');
const fileInfo   = $('file-info');

const sUpload   = $('step-upload');
const sMapping  = $('step-mapping');
const sResults  = $('step-results');

// ─── CSV Parser ───────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const result = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const row = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === ',' && !inQ) { row.push(cur); cur = ''; }
      else cur += ch;
    }
    row.push(cur);
    result.push(row);
  }
  return result;
}

// ─── File handling ────────────────────────────────────────────────────────────
function handleFile(file) {
  if (!file || !file.name.endsWith('.csv')) {
    alert('Please upload a CSV file.');
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    state.rawText = e.target.result;
    const parsed = parseCSV(state.rawText);
    if (parsed.length < 2) { alert('File appears empty.'); return; }
    state.headers = parsed[0].map(h => h.trim());
    state.rows = parsed.slice(1).map(r => {
      const obj = {};
      state.headers.forEach((h, i) => obj[h] = (r[i] || '').trim());
      return obj;
    });
    const kb = (file.size / 1024).toFixed(1);
    const size = file.size >= 1024 * 1024 ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : `${kb} KB`;
    state.fileSummary = `✓ <strong>${file.name}</strong> &nbsp;·&nbsp; ${state.rows.length} rows &nbsp;·&nbsp; ${state.headers.length} columns &nbsp;·&nbsp; ${size}`;
    fileInfo.innerHTML = state.fileSummary;
    fileInfo.classList.remove('hidden');
    buildMappingUI();
    show(sMapping);
  };
  reader.readAsText(file);
}

dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
  $('drop-icon').textContent = '📥';
  $('drop-label').textContent = 'Drop your CSV here';
});
dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
  $('drop-icon').textContent = '📂';
  $('drop-label').textContent = 'Drag & drop your CSV file here';
});
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  $('drop-icon').textContent = '📂';
  $('drop-label').textContent = 'Drag & drop your CSV file here';
  handleFile(e.dataTransfer.files[0]);
});
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));

// ─── Mapping UI ───────────────────────────────────────────────────────────────
function buildMappingUI() {
  $('mapping-file-banner').innerHTML = state.fileSummary;

  // Auto-detect
  state.phoneColumns.clear();
  state.dateColumns.clear();
  state.requiredColumns.clear();

  const phoneKeywords = ['phone', 'mobile', 'contact', 'tel', 'cell'];
  const dateKeywords  = ['date', 'time', 'created', 'updated', 'timestamp', 'dob'];
  const reqKeywords   = ['id', 'order', 'name', 'email'];

  state.headers.forEach(h => {
    const hl = h.toLowerCase();
    if (phoneKeywords.some(k => hl.includes(k))) state.phoneColumns.add(h);
    if (dateKeywords.some(k => hl.includes(k)))  state.dateColumns.add(h);
    if (reqKeywords.some(k => hl.includes(k)))   state.requiredColumns.add(h);
  });

  renderCheckboxList('phone-col-list', state.headers, state.phoneColumns, 'phone');
  renderCheckboxList('date-col-list',  state.headers, state.dateColumns,  'date');
  renderCheckboxList('required-col-list', state.headers, state.requiredColumns, 'req');
  renderCountryRules();
  renderDateFormats();
}

function renderCheckboxList(containerId, cols, selectedSet, prefix) {
  const el = $(containerId);
  el.innerHTML = cols.map(col => `
    <label class="col-checkbox">
      <input type="checkbox" data-prefix="${prefix}" data-col="${col}" ${selectedSet.has(col) ? 'checked' : ''} />
      ${col}
    </label>
  `).join('');
  el.querySelectorAll('input').forEach(cb => {
    cb.addEventListener('change', () => {
      const set = prefix === 'phone' ? state.phoneColumns : prefix === 'date' ? state.dateColumns : state.requiredColumns;
      cb.checked ? set.add(cb.dataset.col) : set.delete(cb.dataset.col);
    });
  });
}

function renderCountryRules() {
  const el = $('country-rules-list');
  el.innerHTML = state.countryRules.map((r, i) => `
    <div class="country-rule-row">
      <input type="text" value="${r.code}" placeholder="CC" maxlength="3"
        onchange="state.countryRules[${i}].code=this.value.toUpperCase()" />
      <input type="number" value="${r.digits}" min="1" max="15" placeholder="Digits"
        onchange="state.countryRules[${i}].digits=+this.value" />
      <span class="rule-unit">digits</span>
      <button class="remove-btn" onclick="removeCountryRule(${i})">✕</button>
    </div>
  `).join('');
}

function removeCountryRule(i) { state.countryRules.splice(i, 1); renderCountryRules(); }

$('add-country-rule').addEventListener('click', () => {
  state.countryRules.push({ code: '', digits: 10 });
  renderCountryRules();
});

const FORMAT_EXAMPLES = {
  'YYYY-MM-DD':  '2025-04-16',
  'DD/MM/YYYY':  '16/04/2025',
  'MM/DD/YYYY':  '04/16/2025',
  'DD-MM-YYYY':  '16-04-2025',
  'YYYY/MM/DD':  '2025/04/16',
};

function renderDateFormats() {
  const el = $('date-format-list');
  el.innerHTML = state.dateFormats.map((f, i) => {
    const example = FORMAT_EXAMPLES[f] || '';
    return `
    <div class="date-format-row">
      <input type="text" value="${f}" placeholder="e.g. YYYY-MM-DD"
        onchange="state.dateFormats[${i}]=this.value;renderDateFormats()" />
      ${example ? `<span class="format-example">→ ${example}</span>` : ''}
      <button class="remove-btn" onclick="removeDateFormat(${i})">✕</button>
    </div>
  `}).join('');
}

function removeDateFormat(i) { state.dateFormats.splice(i, 1); renderDateFormats(); }

$('add-date-format').addEventListener('click', () => {
  state.dateFormats.push('');
  renderDateFormats();
});

// ─── Validation ───────────────────────────────────────────────────────────────
function isValidPhone(value, rules) {
  const digits = value.replace(/[\s\-\+\(\)\.]/g, '');
  if (!/^\d+$/.test(digits)) return { ok: false, msg: `Non-numeric phone: "${value}"` };
  for (const rule of rules) {
    if (!rule.code || !rule.digits) continue;
    if (digits.length === rule.digits) return { ok: true };
  }
  const allowed = rules.filter(r => r.code && r.digits).map(r => `${r.code}:${r.digits}d`).join(', ');
  return { ok: false, msg: `Phone length ${digits.length} digits — expected ${allowed || '?'}` };
}

function buildDateRegex(fmt) {
  // Replace separators FIRST so they become [-/], then substitute tokens.
  // Doing it after token substitution corrupts ranges like [1-9] → [1[-/]9].
  return fmt
    .replace(/[-\/]/g, '[-/]')
    .replace('YYYY', '(?:19|20)\\d{2}')
    .replace('MM',   '(?:0[1-9]|1[0-2])')
    .replace('DD',   '(?:0[1-9]|[12]\\d|3[01])')
    .replace('HH',   '(?:[01]\\d|2[0-3])')
    .replace('mm',   '[0-5]\\d')
    .replace('ss',   '[0-5]\\d');
}

function isValidDate(value, formats) {
  if (!value) return { ok: false, msg: 'Empty date' };
  for (const fmt of formats) {
    try {
      const re = new RegExp('^' + buildDateRegex(fmt) + '$');
      if (re.test(value.trim())) return { ok: true };
    } catch (_) { /* bad format pattern */ }
  }
  return { ok: false, msg: `"${value}" doesn't match any format (${formats.join(', ')})` };
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function runValidation() {
  state.errors = [];
  state.errorRowSet = new Set();

  const checkDups   = $('check-duplicates').checked;
  const checkNeg    = $('check-negative').checked;
  const checkEmail  = $('check-email').checked;

  // Find order_id column heuristically
  const orderIdCol  = state.headers.find(h => /order[\s_]?id/i.test(h));
  const amountCols  = state.headers.filter(h => /amount|price|total|cost|value/i.test(h));
  const emailCols   = state.headers.filter(h => /email|mail/i.test(h));

  const orderIdSeen = {};

  state.rows.forEach((row, idx) => {
    const rowNum = idx + 2; // 1-based, +1 for header

    // Required fields
    state.requiredColumns.forEach(col => {
      if (!row[col] || !row[col].trim()) {
        addError(idx, col, `Required field is empty`, 'error');
      }
    });

    // Phone validation
    state.phoneColumns.forEach(col => {
      if (row[col] && row[col].trim()) {
        const res = isValidPhone(row[col], state.countryRules);
        if (!res.ok) addError(idx, col, res.msg, 'error');
      }
    });

    // Date validation
    state.dateColumns.forEach(col => {
      if (row[col] && row[col].trim()) {
        const res = isValidDate(row[col], state.dateFormats);
        if (!res.ok) addError(idx, col, res.msg, 'warning');
      }
    });

    // Email validation
    if (checkEmail) {
      emailCols.forEach(col => {
        if (row[col] && row[col].trim() && !isValidEmail(row[col])) {
          addError(idx, col, `Invalid email format: "${row[col]}"`, 'warning');
        }
      });
    }

    // Negative amounts
    if (checkNeg) {
      amountCols.forEach(col => {
        const v = parseFloat(row[col]);
        if (!isNaN(v) && v < 0) addError(idx, col, `Negative amount: ${row[col]}`, 'error');
      });
    }

    // Duplicate order IDs
    if (checkDups && orderIdCol && row[orderIdCol]) {
      const oid = row[orderIdCol].trim();
      if (orderIdSeen[oid] !== undefined) {
        addError(idx, orderIdCol, `Duplicate Order ID "${oid}" (first at row ${orderIdSeen[oid] + 2})`, 'warning');
      } else {
        orderIdSeen[oid] = idx;
      }
    }
  });

  renderResults();
}

function addError(rowIndex, field, message, severity) {
  state.errors.push({ rowIndex, field, message, severity });
  state.errorRowSet.add(rowIndex);
}

// ─── Results rendering ────────────────────────────────────────────────────────
function truncate(str, n = 72) {
  return str.length > n ? str.slice(0, n) + '…' : str;
}

function getIssueBadges(rowIndex) {
  const seen = new Set();
  return state.errors
    .filter(e => e.rowIndex === rowIndex)
    .map(e => {
      const f = e.field.toLowerCase();
      const m = e.message.toLowerCase();
      let label, type;
      if (f.includes('phone') || f.includes('mobile') || f.includes('tel'))
        { label = 'Phone'; type = 'phone'; }
      else if (f.includes('email') || f.includes('mail'))
        { label = 'Email'; type = 'email'; }
      else if (m.includes('duplicate'))
        { label = 'Duplicate'; type = 'dup'; }
      else if (m.includes('negative'))
        { label = 'Amount'; type = 'amount'; }
      else if (m.includes('required') || m.includes('empty'))
        { label = 'Missing'; type = 'missing'; }
      else if (f.includes('date') || f.includes('time'))
        { label = 'Date'; type = 'date'; }
      else
        { label = e.field; type = 'other'; }
      const key = label;
      if (seen.has(key)) return '';
      seen.add(key);
      return `<span class="mini-badge badge-${type}" title="${e.message}">${label}</span>`;
    })
    .filter(Boolean)
    .join('');
  return `<div class="badge-wrap">${badges}</div>`;
}

function renderResults() {
  const total     = state.rows.length;
  const errRows   = state.errorRowSet.size;
  const cleanRows = total - errRows;
  const errCount  = state.errors.filter(e => e.severity === 'error').length;
  const warnCount = state.errors.filter(e => e.severity === 'warning').length;
  // Percentages are always relative to total rows for consistency
  const cleanPct = total ? Math.round(cleanRows / total * 100) : 0;
  const errRowPct = total ? Math.round(errRows  / total * 100) : 0;

  $('summary-stats').innerHTML = `
    <div class="stat-card info">
      <div class="stat-icon">📄</div>
      <div class="stat-value">${total}</div>
      <div class="stat-label">Total Rows</div>
    </div>
    <div class="stat-card ok">
      <div class="stat-icon">✅</div>
      <div class="stat-value">${cleanRows}</div>
      <div class="stat-pct">${cleanPct}% of rows</div>
      <div class="stat-label">Clean Rows</div>
    </div>
    <div class="stat-card bad">
      <div class="stat-icon">❌</div>
      <div class="stat-value">${errRows}</div>
      <div class="stat-pct">${errRowPct}% of rows</div>
      <div class="stat-label">Error Rows</div>
    </div>
    <div class="stat-card warn">
      <div class="stat-icon">⚠️</div>
      <div class="stat-value">${warnCount}</div>
      <div class="stat-pct">across ${errRows} rows</div>
      <div class="stat-label">Warning Instances</div>
    </div>
  `;

  // Build unique field list for filter dropdown
  const allFields = [...new Set(state.errors.map(e => e.field))].sort();
  $('error-field-filter').innerHTML =
    `<option value="all">All Fields</option>` +
    allFields.map(f => `<option value="${f}">${f}</option>`).join('');

  renderErrorList();

  // Data preview — all rows (scrollable container handles height)
  const preview = state.rows;
  $('data-preview').innerHTML = `
    <p style="margin-bottom:10px;font-size:0.82rem;color:var(--gray-600)">
      Previewing ${total} rows. <span style="color:var(--error)">Red rows</span> have validation issues. <span style="color:var(--success)">✓ Green checkmarks</span> indicate valid rows.
    </p>
    <div class="preview-scroll">
      <table class="preview-table">
        <thead><tr><th>#</th>${state.headers.map(h => `<th>${h}</th>`).join('')}<th>Issues</th></tr></thead>
        <tbody>
          ${preview.map((row, i) => {
            const hasErr = state.errorRowSet.has(i);
            return `<tr class="${hasErr ? 'has-error' : ''}">
              <td>${i + 2}</td>
              ${state.headers.map(h => `<td title="${row[h]}">${row[h]}</td>`).join('')}
              <td>${hasErr ? getIssueBadges(i) : '<span style="color:var(--success)">✓</span>'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  const chunkSize = parseInt($('chunk-size').value) || 500;
  const cleanCount = state.rows.filter((_, i) => !state.errorRowSet.has(i)).length;
  const chunks = Math.ceil(cleanCount / chunkSize);
  $('chunk-info').textContent = `${cleanCount} clean rows → ${chunks} chunk${chunks !== 1 ? 's' : ''} of ${chunkSize} rows each`;

  show(sResults);
}

function renderErrorList() {
  const search    = ($('error-search').value || '').toLowerCase();
  const typeF     = $('error-type-filter').value;
  const fieldF    = $('error-field-filter').value;

  const filtered = state.errors.filter(e => {
    if (typeF  !== 'all' && e.severity !== typeF)  return false;
    if (fieldF !== 'all' && e.field    !== fieldF) return false;
    if (search && !e.field.toLowerCase().includes(search) && !e.message.toLowerCase().includes(search)) return false;
    return true;
  });

  // Group filtered errors
  const groups = {};
  filtered.forEach(e => {
    const key = `${e.severity}:${e.field}`;
    if (!groups[key]) groups[key] = { severity: e.severity, field: e.field, items: [] };
    groups[key].items.push(e);
  });

  const errorListEl = $('error-list');
  if (filtered.length === 0) {
    errorListEl.innerHTML = state.errors.length === 0
      ? '<div class="no-errors">✅ No errors found — your data is clean!</div>'
      : '<div class="no-errors" style="color:var(--gray-600)">No issues match your filter.</div>';
    return;
  }

  errorListEl.innerHTML = Object.values(groups).map(g => `
    <div class="error-group">
      <div class="error-group-header type-${g.severity}" onclick="this.nextElementSibling.classList.toggle('hidden')">
        ${g.severity === 'error' ? '🔴' : '🟡'}
        <span>${g.field}</span>
        <span class="issue-pill">${g.items.length} issue${g.items.length > 1 ? 's' : ''}</span>
        <span class="chevron">▾</span>
      </div>
      <div class="error-group-body">
        <div class="error-row" style="font-weight:600;background:var(--gray-100)">
          <span>Row #</span><span>Field</span><span>Issue</span>
        </div>
        ${g.items.map(e => `
          <div class="error-row">
            <span class="row-num">${e.rowIndex + 2}</span>
            <span class="field-name">${e.field}</span>
            <span class="error-msg" title="${e.message}">${truncate(e.message)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

// ─── Downloads ────────────────────────────────────────────────────────────────
function rowsToCSV(rows) {
  const header = state.headers.join(',');
  const body = rows.map(r => state.headers.map(h => `"${(r[h] || '').replace(/"/g, '""')}"`).join(','));
  return [header, ...body].join('\n');
}

function downloadBlob(content, filename, type = 'text/csv') {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

$('download-cleaned').addEventListener('click', () => {
  const clean = state.rows.filter((_, i) => !state.errorRowSet.has(i));
  downloadBlob(rowsToCSV(clean), 'cleaned_data.csv');
});

$('download-full').addEventListener('click', () => {
  const headersWithStatus = [...state.headers, 'validation_status', 'validation_errors'];
  const lines = [headersWithStatus.join(',')];
  state.rows.forEach((row, i) => {
    const errs = state.errors.filter(e => e.rowIndex === i).map(e => `${e.field}:${e.message}`).join(' | ');
    const status = state.errorRowSet.has(i) ? 'ERROR' : 'OK';
    const vals = state.headers.map(h => `"${(row[h] || '').replace(/"/g, '""')}"`);
    vals.push(`"${status}"`, `"${errs}"`);
    lines.push(vals.join(','));
  });
  downloadBlob(lines.join('\n'), 'validated_data_full.csv');
});

$('download-chunks').addEventListener('click', async () => {
  const clean = state.rows.filter((_, i) => !state.errorRowSet.has(i));
  const chunkSize = parseInt($('chunk-size').value) || 500;
  const zip = new JSZip();
  let c = 0;
  while (c * chunkSize < clean.length) {
    const chunk = clean.slice(c * chunkSize, (c + 1) * chunkSize);
    zip.file(`chunk_${String(c + 1).padStart(3, '0')}.csv`, rowsToCSV(chunk));
    c++;
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, 'data_chunks.zip', 'application/zip');
});

// ─── Navigation ───────────────────────────────────────────────────────────────
function show(section) {
  [sUpload, sMapping, sResults].forEach(s => s.classList.add('hidden'));
  section.classList.remove('hidden');
}

$('back-to-upload').addEventListener('click', () => show(sUpload));
$('back-to-mapping').addEventListener('click', () => show(sMapping));
$('run-validation').addEventListener('click', runValidation);
$('new-file').addEventListener('click', () => { fileInput.value = ''; state.rawText = ''; show(sUpload); });

// Error filters
$('error-search').addEventListener('input', renderErrorList);
$('error-type-filter').addEventListener('change', renderErrorList);
$('error-field-filter').addEventListener('change', renderErrorList);

// Tabs
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    tab.classList.add('active');
    $('tab-' + tab.dataset.tab).classList.remove('hidden');
  });
});
