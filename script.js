/* ============================================================
   INTRADOS DESIGNS — Assessment List (post-login)
   script.js
   ============================================================ */

'use strict';

const SHEET_ID = '1Ep0ESBJb-QxzBfN2oxIAH0RFJOPvCsNb4NpvmyWOfDA';
const LOGIN_PAGE_URL = 'https://intrados-technology.github.io/login-page/';

const TEST_URLS = {
  general:              'https://intrados-technology.github.io/general-assessment/',
  technicalFresh:       'https://intrados-technology.github.io/technical-fresh/',
  technicalExperienced: 'https://intrados-technology.github.io/technical-Experience/',
  professional:         'https://intrados-technology.github.io/professional-nontech/',
  toolTest:             'https://intrados-technology.github.io/tool-test/'
};

const DOM = {
  loadingView:  document.getElementById('loading-view'),
  errorView:    document.getElementById('error-view'),
  listView:     document.getElementById('list-view'),
  errorMessage: document.getElementById('error-message'),
  welcomeHeading: document.getElementById('welcome-heading'),
  testSelect:   document.getElementById('test-select'),
  btnProceed:   document.getElementById('btn-proceed'),
  candidateBadge: document.getElementById('candidate-badge'),
  badgeName:    document.getElementById('badge-name'),
  badgeRef:     document.getElementById('badge-ref')
};

function showView(view) {
  DOM.loadingView.style.display = 'none';
  DOM.errorView.style.display   = 'none';
  DOM.listView.style.display    = 'none';
  view.style.display = 'block';
}

function showError(msg) {
  DOM.errorMessage.textContent = msg;
  showView(DOM.errorView);
}

// Generic gviz select-query helper, returns rows array (or throws)
async function gvizSelect(sheetTab, query) {
  const url = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID +
    '/gviz/tq?tqx=out:json&sheet=' + encodeURIComponent(sheetTab) +
    '&tq=' + encodeURIComponent(query);
  const resp = await fetch(url);
  const text = await resp.text();
  const start = text.indexOf('{');
  const end   = text.lastIndexOf('}');
  const json  = JSON.parse(text.substring(start, end + 1));
  return (json && json.table && json.table.rows) || [];
}

(async function init() {
  const params = new URLSearchParams(window.location.search);
  const refId  = (params.get('ref')   || '').trim();
  const email  = (params.get('email') || '').trim();

  if (!refId || !email) {
    showError('Please log in with your Reference ID and Email first.');
    return;
  }

  try {
    const safeRefId = refId.replace(/'/g, "\\'");
    const rows = await gvizSelect('Initial Screening', "select B,C,F,X,Y,Z where B = '" + safeRefId + "'");

    if (rows.length === 0) {
      showError('We could not verify your login. Please log in again.');
      return;
    }

    const cells = rows[0].c;
    const fullName        = cells[1] && cells[1].v ? String(cells[1].v).trim() : '';
    const storedEmail     = cells[2] && cells[2].v ? String(cells[2].v).trim().toLowerCase() : '';
    const domain          = cells[3] && cells[3].v ? String(cells[3].v).trim().toLowerCase() : '';
    const experienceLevel = cells[4] && cells[4].v ? String(cells[4].v).trim().toLowerCase() : '';
    const remarks         = cells[5] && cells[5].v ? String(cells[5].v).trim().toLowerCase() : '';

    if (!fullName || storedEmail !== email.toLowerCase() || remarks !== 'approved') {
      showError('We could not verify your login. Please log in again.');
      return;
    }

    // Determine which Test 2 applies to this candidate
    let test2 = null;
    if (domain === 'technical' && experienceLevel === 'fresher') {
      test2 = { label: 'Test 2: Technical Assessment – Freshers', url: TEST_URLS.technicalFresh };
    } else if (domain === 'technical' && experienceLevel === 'experienced') {
      test2 = { label: 'Test 2: Technical Assessment – Experienced', url: TEST_URLS.technicalExperienced };
    } else if (domain === 'non-technical') {
      test2 = { label: 'Test 2: Professional Assessment', url: TEST_URLS.professional };
    }

    // Check completion status — General Assessment and the shared
    // Professional Assessment sheet (which all 3 Test-2 tracks write
    // into), both keyed by Reference ID. Also pull column I (Rating)
    // from Professional Assessment, since Round 3 (Tool Test) requires
    // having actually PASSED Test 2, not just attempted it.
    const [generalRows, test2Rows, toolTestRows] = await Promise.all([
      gvizSelect('General Assessment', "select B where B = '" + safeRefId + "'"),
      gvizSelect('Professional Assessment', "select B,I where B = '" + safeRefId + "'"),
      gvizSelect('Tool Test', "select B where B = '" + safeRefId + "'")
    ]);
    const generalCompleted = generalRows.length > 0;
    const test2Completed   = test2Rows.length > 0;
    const toolTestCompleted = toolTestRows.length > 0;

    const passingRatings = ['borderline', 'hire', 'strong hire', 'exceptional'];
    let test2Passed = false;
    if (test2Rows.length > 0) {
      const rating = test2Rows[0].c[1] && test2Rows[0].c[1].v ? String(test2Rows[0].c[1].v).trim().toLowerCase() : '';
      test2Passed = passingRatings.indexOf(rating) !== -1;
    }

    // Round 3 (Tool Test) only applies to Technical candidates who
    // have already passed Test 2.
    let toolTest = null;
    if (domain === 'technical' && test2Passed) {
      toolTest = { label: 'Round 3: Tool Test', url: TEST_URLS.toolTest };
    }

    // ── Populate header badge ──────────────────────────────────
    DOM.badgeName.textContent = fullName;
    DOM.badgeRef.textContent  = refId;
    DOM.candidateBadge.style.display = 'flex';

    // ── Populate welcome + dropdown ─────────────────────────────
    DOM.welcomeHeading.textContent = 'Welcome, ' + fullName;

    DOM.testSelect.innerHTML = '';

    const generalOption = document.createElement('option');
    generalOption.value = TEST_URLS.general;
    generalOption.textContent = 'Test 1: General Assessment' + (generalCompleted ? ' (Completed)' : '');
    generalOption.disabled = generalCompleted;
    DOM.testSelect.appendChild(generalOption);

    if (test2) {
      const test2Option = document.createElement('option');
      test2Option.value = test2.url;
      test2Option.textContent = test2.label + (test2Completed ? ' (Completed)' : '');
      test2Option.disabled = test2Completed;
      DOM.testSelect.appendChild(test2Option);
    }

    if (toolTest) {
      const toolTestOption = document.createElement('option');
      toolTestOption.value = toolTest.url;
      toolTestOption.textContent = toolTest.label + (toolTestCompleted ? ' (Completed)' : '');
      toolTestOption.disabled = toolTestCompleted;
      DOM.testSelect.appendChild(toolTestOption);
    }

    // Select the first non-disabled option by default
    const firstEnabled = Array.from(DOM.testSelect.options).find(o => !o.disabled);
    if (firstEnabled) DOM.testSelect.value = firstEnabled.value;

    if (!test2) {
      const notice = document.createElement('option');
      notice.textContent = 'No Test 2 found for your profile — please contact HR';
      notice.disabled = true;
      DOM.testSelect.appendChild(notice);
    }

    DOM.btnProceed.addEventListener('click', function() {
      const selectedUrl = DOM.testSelect.value;
      if (!selectedUrl) return;
      window.location.href = selectedUrl + '?ref=' + encodeURIComponent(refId) + '&name=' + encodeURIComponent(fullName);
    });

    showView(DOM.listView);

  } catch (err) {
    console.warn('[IDS] Assessment-list init error:', err);
    showError('Something went wrong while loading your assessments. Please try refreshing the page.');
  }
})();
