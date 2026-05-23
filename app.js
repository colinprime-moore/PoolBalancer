/* ============================================================
   POOL BALANCE — application logic
   Bromine pool chemistry calculator for a 12,000 gallon
   indoor heated pool. Includes history storage and routing.
   ============================================================ */

(function () {
  'use strict';

  const POOL_VOLUME_GAL = 12000;
  const SCALE = POOL_VOLUME_GAL / 10000;

  // ----- Element references -----
  const $ = (id) => document.getElementById(id);
  const form = $('reading-form');
  const pageInput = $('page-input');
  const pageResults = $('page-results');
  const pageHistory = $('page-history');
  const readingsGrid = $('readings-grid');
  const actionsList = $('actions-list');
  const historyList = $('history-list');
  const historyBtn = $('history-btn');
  const backBtn = $('back-btn');
  const historyBackBtn = $('history-back-btn');
  const saveBtn = $('save-btn');
  const resultHeadline = $('result-headline');
  const resultTimestamp = $('result-timestamp');

  // ----- ROUTING -----
  function showPage(name) {
    [pageInput, pageResults, pageHistory].forEach((p) => p.classList.remove('page-active'));
    if (name === 'input') pageInput.classList.add('page-active');
    if (name === 'results') pageResults.classList.add('page-active');
    if (name === 'history') {
      renderHistory();
      pageHistory.classList.add('page-active');
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  historyBtn.addEventListener('click', () => showPage('history'));
  backBtn.addEventListener('click', () => showPage('input'));
  historyBackBtn.addEventListener('click', () => showPage('input'));

  // ----- FORM SUBMIT -----
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
      ph:   parseFloat($('ph').value),
      br:   parseFloat($('br').value),
      ta:   parseFloat($('ta').value),
      ch:   parseFloat($('ch').value),
      temp: parseFloat($('temp').value),
      fbr:  $('fbr').value === '' ? null : parseFloat($('fbr').value)
    };
    if ([data.ph, data.br, data.ta, data.ch, data.temp].some(isNaN)) {
      alert('Please fill in pH, bromine, alkalinity, hardness, and temperature.');
      return;
    }
    const report = analyze(data);
    renderReport(data, report);
    currentReport = { data, report, ts: Date.now() };
    saveBtn.textContent = '';
    saveBtn.classList.remove('saved');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    saveBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
        <path d="M17 21v-8H7v8M7 3v5h8"/>
      </svg>
      Save to history`;
    showPage('results');
  });

  let currentReport = null;

  // ----- FORMATTERS -----
  function fmtMass(g) {
    if (g >= 1000) return (g / 1000).toFixed(2) + ' kg';
    if (g >= 100)  return Math.round(g) + ' g';
    return Math.round(g * 10) / 10 + ' g';
  }

  // ----- ANALYSIS -----
  function analyze(d) {
    const { ph, br, ta, ch, temp, fbr } = d;

    // Status per reading
    const status = {
      ph:   ph < 7.2 ? 'low' : ph > 7.6 ? 'high' : 'ok',
      br:   br < 2 ? 'bad' : br < 3 ? 'low' : br > 6 ? 'bad' : br > 5 ? 'high' : 'ok',
      ta:   ta < 80 ? 'low' : ta > 120 ? 'high' : 'ok',
      ch:   ch < 200 ? 'low' : ch > 400 ? 'high' : 'ok',
      temp: temp < 27 ? 'low' : temp > 30 ? 'high' : 'ok'
    };

    const statusLabel = {
      ok: 'In range', low: 'Low', high: 'High', bad: 'Out of range'
    };

    const actions = [];

    // 1) BROMINE — first priority, sanitiser
    if (br < 2) {
      const deficit = 4 - br;
      const grams = deficit * SCALE * 17;
      actions.push({
        severity: 'urgent',
        title: 'Bromine critically low',
        dose: `Add ~${fmtMass(grams)} of BCDMH bromine tablets`,
        body: `Bromine is ${br.toFixed(1)} ppm — below the 2 ppm minimum. The pool is not properly sanitised. Increase the tablet feeder rate and add tablets directly to the skimmer or floater until the residual returns to 3–5 ppm.`,
        note: 'Do not let bathers in until the residual is at least 3 ppm.'
      });
    } else if (br < 3) {
      const deficit = 4 - br;
      const grams = deficit * SCALE * 17;
      actions.push({
        severity: 'action',
        title: 'Bromine slightly low',
        dose: `Add ~${fmtMass(grams)} of BCDMH bromine tablets`,
        body: `Bromine is at ${br.toFixed(1)} ppm. Target is 3–5 ppm. Increase the feeder setting or add a couple of tablets to the floater.`
      });
    } else if (br > 6) {
      actions.push({
        severity: 'urgent',
        title: 'Bromine too high',
        dose: 'Stop dosing. Dilute with fresh water.',
        body: `Bromine is at ${br.toFixed(1)} ppm. Above 6 ppm can irritate skin and eyes. Turn the feeder off, partially drain and refill, and leave the cover off so it dissipates faster. Retest in 24 hours.`,
        note: 'Do not let bathers in until the residual is below 5 ppm.'
      });
    } else if (br > 5) {
      actions.push({
        severity: 'action',
        title: 'Bromine slightly high',
        dose: 'Reduce feeder rate; let it drop naturally.',
        body: `Bromine is at ${br.toFixed(1)} ppm. Lower the tablet feeder setting one notch and retest in 24 hours.`
      });
    } else {
      actions.push({
        severity: 'ok',
        title: 'Bromine in range',
        body: `${br.toFixed(1)} ppm — well within the 3–5 ppm target.`
      });
    }

    // Shock — combined bromine
    let shockNeeded = false, shockReason = '';
    if (fbr !== null && !isNaN(fbr)) {
      const combined = br - fbr;
      if (combined > 0.5) {
        shockNeeded = true;
        shockReason = `Combined bromine (total ${br.toFixed(1)} − free ${fbr.toFixed(1)} = ${combined.toFixed(1)} ppm) is above the 0.5 ppm threshold. Bromamines have built up — this is what causes the chemical smell typical of indoor pools.`;
      }
    } else if (temp > 29 && br >= 3 && br <= 5) {
      shockReason = `Warm indoor pools (currently ${temp.toFixed(1)} °C) build up bromamines even when total bromine looks fine. If you notice a chemical smell or dull-looking water, a weekly non-chlorine shock is good practice.`;
    }
    if (shockNeeded) {
      const grams = 1.0 * SCALE * 140;
      actions.push({
        severity: 'urgent',
        title: 'Shock the pool',
        dose: `Add ~${fmtMass(grams)} of non-chlorine shock (potassium monopersulfate / MPS)`,
        body: shockReason,
        note: 'Run pumps for 4+ hours. MPS is bather-friendly — the pool can usually reopen within 15 minutes once dispersed.'
      });
    } else if (shockReason) {
      actions.push({
        severity: 'info',
        title: 'Consider a weekly shock',
        dose: `~${fmtMass(1.0 * SCALE * 140)} of MPS as routine maintenance`,
        body: shockReason
      });
    }

    // 2) ALKALINITY — second, because it stabilises pH
    if (ta < 80) {
      const deficit = 100 - ta;
      const grams = (deficit / 10) * SCALE * 635;
      actions.push({
        severity: 'action',
        title: 'Alkalinity low — raise first',
        dose: `Add ${fmtMass(grams)} of sodium bicarbonate (baking soda)`,
        body: `Total alkalinity is ${ta} ppm. The target is 80–120 ppm. Low alkalinity makes pH bounce around unpredictably. Broadcast the bicarbonate across the pool with the pumps running. Wait 6 hours before retesting.`,
        note: 'Always adjust alkalinity before pH — it acts as the pH buffer.'
      });
    } else if (ta > 120) {
      const excess = ta - 100;
      const grams = (excess / 10) * SCALE * 360;
      actions.push({
        severity: 'action',
        title: 'Alkalinity high',
        dose: `Add ${fmtMass(grams)} of dry acid (sodium bisulfate)`,
        body: `Total alkalinity is ${ta} ppm. Target is 80–120 ppm. Add dry acid in one spot in the deep end with the pump off for 30 minutes, then run the pump. This pulls TA and pH down together.`,
        note: 'Retest after 24 hours before any further adjustment.'
      });
    } else {
      actions.push({
        severity: 'ok',
        title: 'Alkalinity in range',
        body: `${ta} ppm — within the 80–120 target.`
      });
    }

    // 3) pH
    if (ph < 7.2) {
      const deficit = 7.4 - ph;
      const grams = (deficit / 0.2) * SCALE * 170;
      actions.push({
        severity: 'action',
        title: 'pH low — raise it',
        dose: `Add ${fmtMass(grams)} of soda ash (sodium carbonate)`,
        body: `pH is at ${ph.toFixed(1)}. Target is 7.2–7.6. Low pH corrodes metal fittings and irritates eyes. Dissolve the soda ash in a bucket of pool water first, then add slowly with the pump running.`,
        note: ta < 80
          ? 'Sort the alkalinity first — pH will partly self-correct.'
          : 'Retest in 4 hours.'
      });
    } else if (ph > 7.6) {
      const excess = ph - 7.4;
      const grams = (excess / 0.2) * SCALE * 270;
      actions.push({
        severity: 'action',
        title: 'pH high — lower it',
        dose: `Add ${fmtMass(grams)} of dry acid (sodium bisulfate)`,
        body: `pH is at ${ph.toFixed(1)}. Target is 7.2–7.6. High pH makes bromine less effective and causes scale on heater elements. Add it in the deepest area with the pump briefly off, then run the pump.`,
        note: 'Retest in 4 hours. If alkalinity is also high, dry acid will pull both down together.'
      });
    } else {
      actions.push({
        severity: 'ok',
        title: 'pH in range',
        body: `${ph.toFixed(1)} — within the 7.2–7.6 target.`
      });
    }

    // 4) HARDNESS
    if (ch < 200) {
      const deficit = 275 - ch;
      const grams = (deficit / 10) * SCALE * 150;
      actions.push({
        severity: 'action',
        title: 'Hardness low',
        dose: `Add ${fmtMass(grams)} of calcium chloride`,
        body: `Calcium hardness is ${ch} ppm. Target is 200–400 ppm. Soft water dissolves grout and pool surfaces. Dissolve calcium chloride in a bucket first — it generates heat — then add slowly with the pump running.`,
        note: 'For large doses, split over 2–3 days. Do not exceed a 50 ppm increase per day.'
      });
    } else if (ch > 400) {
      actions.push({
        severity: 'action',
        title: 'Hardness high',
        dose: 'Partial drain and refill with softer water',
        body: `Calcium hardness is ${ch} ppm. High hardness causes scale on heater elements and cloudy water. There is no chemical to lower it — dilute by replacing 10–20% of the pool volume with fresh water.`,
        note: 'If your fill water is also hard, consider a calcium sequestrant.'
      });
    } else {
      actions.push({
        severity: 'ok',
        title: 'Hardness in range',
        body: `${ch} ppm — within the 200–400 target.`
      });
    }

    // 5) Temperature note
    if (temp > 30) {
      actions.push({
        severity: 'info',
        title: 'Water is on the warm side',
        body: `${temp.toFixed(1)} °C is above the usual 27–30 °C range. Warmer water accelerates bromine consumption — test more often and check the residual every couple of days.`
      });
    } else if (temp < 27) {
      actions.push({
        severity: 'info',
        title: 'Water is on the cool side',
        body: `${temp.toFixed(1)} °C is below the typical comfort range. Bromine activates more slowly at lower temperatures — if you have just heated up from cold, retest once the temperature stabilises.`
      });
    }

    // 6) Langelier Saturation Index — overall balance
    const tFahr = temp * 9 / 5 + 32;
    const tF = tFahr < 32 ? 0.0 : tFahr < 53 ? 0.3 : tFahr < 76 ? 0.5 : tFahr < 90 ? 0.7 : 0.8;
    const cF = Math.log10(Math.max(ch, 5)) - 0.4;
    const aF = Math.log10(Math.max(ta, 5));
    const lsi = ph + tF + cF + aF - 12.1;
    let lsiSev = 'ok', lsiTitle = 'Water balance is good', lsiBody;
    if (lsi < -0.5) {
      lsiSev = 'urgent';
      lsiTitle = `Water is corrosive (LSI ${lsi.toFixed(2)})`;
      lsiBody = 'Aggressive water will pit metal fittings and dissolve plaster. Address pH, alkalinity, and hardness urgently — usually by raising one or more.';
    } else if (lsi < -0.3) {
      lsiSev = 'action';
      lsiTitle = `Water is slightly corrosive (LSI ${lsi.toFixed(2)})`;
      lsiBody = 'Trending corrosive. Following the dosing above should pull this back to neutral.';
    } else if (lsi > 0.5) {
      lsiSev = 'urgent';
      lsiTitle = `Water is scaling (LSI ${lsi.toFixed(2)})`;
      lsiBody = 'Scale will deposit on heater elements and surfaces. Address pH or hardness — usually by lowering one.';
    } else if (lsi > 0.3) {
      lsiSev = 'action';
      lsiTitle = `Water is slightly scaling (LSI ${lsi.toFixed(2)})`;
      lsiBody = 'Trending towards scale. Watch heater performance over the next week.';
    } else {
      lsiBody = `LSI ${lsi.toFixed(2)} — within the ideal ±0.3 range. Your water is neither corrosive nor scaling.`;
    }
    actions.push({
      severity: lsiSev,
      title: lsiTitle,
      body: lsiBody,
      note: 'The Langelier Saturation Index combines pH, alkalinity, hardness, and temperature into a single balance figure.'
    });

    // Compute overall severity for headline
    let overall = 'ok';
    for (const a of actions) {
      if (a.severity === 'urgent') { overall = 'urgent'; break; }
      if (a.severity === 'action') overall = 'action';
    }

    return { status, statusLabel, actions, overall, lsi };
  }

  // ----- RENDERING -----
  function renderReport(data, report) {
    // Headline
    if (report.overall === 'urgent') {
      resultHeadline.textContent = 'Action needed — urgent.';
    } else if (report.overall === 'action') {
      resultHeadline.textContent = 'A few adjustments to make.';
    } else {
      resultHeadline.textContent = 'Everything looks great.';
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    resultTimestamp.textContent = dateStr;

    // Reading cards
    readingsGrid.innerHTML = [
      ['pH',         data.ph.toFixed(1),       report.status.ph,   '7.2–7.6'],
      ['Bromine',    data.br.toFixed(1) + ' ppm', report.status.br,   '3–5 ppm'],
      ['Alkalinity', data.ta + ' ppm',         report.status.ta,   '80–120 ppm'],
      ['Hardness',   data.ch + ' ppm',         report.status.ch,   '200–400 ppm']
    ].map(([label, val, st, range]) => `
      <div class="reading-card ${st}">
        <div class="rc-label">${label}</div>
        <div class="rc-value">${val}</div>
        <div class="rc-status">${report.statusLabel[st]} · ${range}</div>
      </div>
    `).join('');

    // Action cards
    actionsList.innerHTML = report.actions.map((a) => {
      const icon = {
        urgent: '<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>',
        action: '<path d="M9 2v6h6V2M9 8c-2.5 0-4.5 2-4.5 4.5V22h15v-9.5c0-2.5-2-4.5-4.5-4.5"/>',
        ok:     '<polyline points="20 6 9 17 4 12"/>',
        info:   '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'
      }[a.severity];
      return `
        <div class="action-card ${a.severity}">
          <div class="ac-head">
            <div class="ac-marker">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                ${icon}
              </svg>
            </div>
            <h3 class="ac-title">${a.title}</h3>
          </div>
          ${a.dose ? `<div class="ac-dose">${a.dose}</div>` : ''}
          <p class="ac-body">${a.body}</p>
          ${a.note ? `<p class="ac-note">${a.note}</p>` : ''}
        </div>
      `;
    }).join('');
  }

  // ----- HISTORY -----
  const STORAGE_KEY = 'pool-balance-history';

  function loadHistory() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (e) { return []; }
  }

  function saveHistory(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 50)));
  }

  saveBtn.addEventListener('click', () => {
    if (!currentReport) return;
    const items = loadHistory();
    items.unshift(currentReport);
    saveHistory(items);
    saveBtn.classList.add('saved');
    saveBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      Saved`;
  });

  function renderHistory() {
    const items = loadHistory();
    if (items.length === 0) {
      historyList.innerHTML = `
        <div class="history-empty">
          <p class="display">No readings yet.</p>
          <p>Saved test results will appear here so you can track trends.</p>
        </div>`;
      return;
    }
    historyList.innerHTML = items.map((item, idx) => {
      const d = new Date(item.ts);
      const date = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
      const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      const badgeClass =
        item.report.overall === 'urgent' ? 'urgent' :
        item.report.overall === 'action' ? 'warn' : 'ok';
      const badgeText =
        item.report.overall === 'urgent' ? 'Urgent' :
        item.report.overall === 'action' ? 'Adjust' : 'Good';
      return `
        <div class="history-item" data-idx="${idx}">
          <div>
            <div class="date">${date}</div>
            <div class="summary">${time} · pH ${item.data.ph.toFixed(1)} · Br ${item.data.br.toFixed(1)} · TA ${item.data.ta} · CH ${item.data.ch}</div>
          </div>
          <div class="badge ${badgeClass}">${badgeText}</div>
        </div>`;
    }).join('');

    historyList.querySelectorAll('.history-item').forEach((el) => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx, 10);
        const item = items[idx];
        currentReport = item;
        renderReport(item.data, item.report);
        // Show date in timestamp
        const d = new Date(item.ts);
        resultTimestamp.textContent = d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
        showPage('results');
      });
    });
  }

})();
