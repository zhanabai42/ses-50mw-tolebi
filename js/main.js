// Chart.js global defaults
if (window.Chart) {
  Chart.defaults.color = '#8d9bb0';
  Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
  Chart.defaults.borderColor = '#243040';
}

const palette = {
  accent: '#f5a623',
  accent2: '#3ddc97',
  blue: '#5b9dff',
  purple: '#9b7bff',
  bad: '#ff6b6b'
};

function gridOpts() {
  return { grid: { color: '#1c2632' }, ticks: { color: '#8d9bb0' } };
}

// Production / revenue chart
const prodCtx = document.getElementById('chartProduction');
if (prodCtx) {
  new Chart(prodCtx, {
    data: {
      labels: ['Год 1', 'Год 5', 'Год 10', 'Год 15', 'Год 20', 'Год 25'],
      datasets: [
        {
          type: 'bar',
          label: 'Выработка (МВт·ч)',
          data: [92000, 90172, 87834, 85568, 83370, 81000],
          backgroundColor: 'rgba(91,157,255,0.55)',
          borderRadius: 6,
          yAxisID: 'y'
        },
        {
          type: 'line',
          label: 'Выручка (млрд ₸)',
          data: [3.13, 3.86, 5.15, 6.86, 9.12, 10.40],
          borderColor: palette.accent,
          backgroundColor: palette.accent,
          tension: 0.35,
          pointRadius: 4,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        y: { position: 'left', ...gridOpts(), title: { display: true, text: 'МВт·ч', color: '#8d9bb0' } },
        y1: { position: 'right', grid: { drawOnChartArea: false }, ticks: { color: '#8d9bb0' }, title: { display: true, text: 'млрд ₸', color: '#8d9bb0' } }
      },
      plugins: { legend: { labels: { color: '#cdd6e3' } } }
    }
  });
}

// Opex/Ebitda chart
const opexCtx = document.getElementById('chartOpex');
if (opexCtx) {
  new Chart(opexCtx, {
    type: 'bar',
    data: {
      labels: ['Год 1', 'Год 5', 'Год 10'],
      datasets: [
        { label: 'Выручка', data: [3.13, 3.86, 5.15], backgroundColor: 'rgba(91,157,255,0.6)', borderRadius: 6 },
        { label: 'OPEX', data: [0.235, 0.264, 0.307], backgroundColor: 'rgba(255,107,107,0.6)', borderRadius: 6 },
        { label: 'EBITDA', data: [2.89, 3.59, 4.87], backgroundColor: 'rgba(61,220,151,0.6)', borderRadius: 6 },
        { label: 'Чистая прибыль', data: [0.58, 1.12, 2.08], backgroundColor: 'rgba(245,166,35,0.6)', borderRadius: 6 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { ...gridOpts(), title: { display: true, text: 'млрд ₸', color: '#8d9bb0' } }, x: gridOpts() },
      plugins: { legend: { labels: { color: '#cdd6e3' } } }
    }
  });
}

// CAPEX donut
const capexCtx = document.getElementById('chartCapex');
if (capexCtx) {
  new Chart(capexCtx, {
    type: 'doughnut',
    data: {
      labels: ['Панели/инверторы', 'СМР (EPC)', 'Сетевое подключение', 'Проектирование/резерв'],
      datasets: [{
        data: [20, 40, 20, 20],
        backgroundColor: [palette.blue, palette.accent, palette.accent2, palette.purple],
        borderColor: '#121821',
        borderWidth: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: '#cdd6e3', boxWidth: 12, padding: 14 } } },
      cutout: '62%'
    }
  });
}

// Funding donut
const fundCtx = document.getElementById('chartFunding');
if (fundCtx) {
  new Chart(fundCtx, {
    type: 'doughnut',
    data: {
      labels: ['Кредит МФИ (ЕБРР+АБР) — 80%', 'Лизинг оборудования — 20%'],
      datasets: [{
        data: [80, 20],
        backgroundColor: [palette.blue, palette.accent],
        borderColor: '#121821',
        borderWidth: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: '#cdd6e3', boxWidth: 12, padding: 14 } } },
      cutout: '62%'
    }
  });
}
