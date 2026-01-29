const form = document.getElementById('shortenForm');
const input = document.getElementById('urlInput');
const customInput = document.getElementById('customInput');
const generateBtn = document.getElementById('generateBtn');
const result = document.getElementById('result');
const shortLink = document.getElementById('shortLink');
const meta = document.getElementById('meta');
const copyBtn = document.getElementById('copyBtn');
const analyticsBtn = document.getElementById('analyticsBtn');
const errorBox = document.getElementById('error');

const resolveForm = document.getElementById('resolveForm');
const resolveInput = document.getElementById('resolveInput');
const resolveResult = document.getElementById('resolveResult');
const analyticsSection = document.getElementById('analytics');
const analyticsSummary = document.getElementById('analyticsSummary');
const analyticsDetails = document.getElementById('analyticsDetails');

function showError(msg) {
  errorBox.classList.remove('hidden');
  errorBox.textContent = msg;
}

function hideError() {
  errorBox.classList.add('hidden');
  errorBox.textContent = '';
}

function showResult(data) {
  shortLink.href = data.shortUrl;
  shortLink.textContent = data.shortUrl;
  meta.textContent = `Original: ${data.longUrl}`;
  result.classList.remove('hidden');
  analyticsSection.classList.add('hidden');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();
  result.classList.add('hidden');

  const url = input.value.trim();
  const custom = customInput.value.trim() || undefined;

  try {
    const resp = await fetch('/api/shorten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, custom })
    });

    const data = await resp.json();
    if (!resp.ok) {
      showError(data.error || 'Unknown error');
      return;
    }

    showResult(data);
  } catch (err) {
    showError('Network or server error');
  }
});

generateBtn.addEventListener('click', async () => {
  hideError();
  try {
    const resp = await fetch('/api/generate');
    const data = await resp.json();
    if (!resp.ok) return showError(data.error || 'Could not generate');
    customInput.value = data.shortId;
  } catch (err) {
    showError('Network error');
  }
});

copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(shortLink.href);
    copyBtn.textContent = 'Copied ✅';
    setTimeout(() => (copyBtn.textContent = 'Copy'), 2000);
  } catch (err) {
    copyBtn.textContent = 'Failed to copy';
  }
});

analyticsBtn.addEventListener('click', async () => {
  hideError();
  const shortId = shortLink.href.split('/').pop();
  const token = prompt('Enter admin token to view analytics');
  if (!token) return showError('Admin token required');
  try {
    const resp = await fetch(`/api/analytics/${shortId}`, { headers: { 'x-admin-token': token } });
    const data = await resp.json();
    if (!resp.ok) return showError(data.error || 'Could not fetch analytics');

    analyticsSummary.innerHTML = `<p>Total clicks: <strong>${data.info.clicks || 0}</strong></p>`;

    let html = '';
    html += '<h3>By country</h3>';
    html += '<ul>' + data.byCountry.map(c => `<li>${c.country || 'unknown'} — ${c.cnt}</li>`).join('') + '</ul>';

    html += '<h3>By device</h3>';
    html += '<ul>' + data.byDevice.map(d => `<li>${d.device} — ${d.cnt}</li>`).join('') + '</ul>';

    html += '<h3>Top referrers</h3>';
    html += '<ul>' + data.byReferrer.map(r => `<li>${r.referrer || 'direct'} — ${r.cnt}</li>`).join('') + '</ul>';

    html += '<h3>Recent hits</h3>';
    html += '<ul>' + data.recent.map(r => `<li>${r.created_at} — ${r.country || ''} — ${r.device} — ${r.referrer || ''}</li>`).join('') + '</ul>';

    analyticsDetails.innerHTML = html;
    analyticsSection.classList.remove('hidden');
  } catch (err) {
    showError('Network error');
  }
});

resolveForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();
  resolveResult.classList.add('hidden');

  const short = resolveInput.value.trim();
  try {
    const resp = await fetch('/api/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ short })
    });

    const data = await resp.json();
    if (!resp.ok) return showError(data.error || 'Not found');

    resolveResult.classList.remove('hidden');
    resolveResult.innerHTML = `<p>Short ID: <strong>${data.short_id}</strong></p><p>Original URL: <a href="${data.long_url}" target="_blank" rel="noopener noreferrer">${data.long_url}</a></p>`;
  } catch (err) {
    showError('Network error');
  }
});

