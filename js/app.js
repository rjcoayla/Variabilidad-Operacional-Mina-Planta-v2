/**
 * ================================================================
 * MODELO PREDICTIVO – DISPONIBILIDAD Y CONFIABILIDAD DE ACTIVOS
 * Gran Minería del Cobre  |  app.js
 * ================================================================
 */

/* ── Estado global ───────────────────────────────────────────── */
let todosLosDatos  = [];
let datosFiltrados = [];
let charts         = {};
let simulacionPct  = 0;
let jsonCountActual = 10;

/* ── Inicio ──────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  await cargarDatos();
  inicializarFiltros();
  aplicarFiltros();
  inicializarSimulacion();
});

/* ── Carga JSON ──────────────────────────────────────────────── */
async function cargarDatos() {
  try {
    const r = await fetch('data/confiabilidad_activos.json');
    todosLosDatos = await r.json();
  } catch (e) {
    console.error('Error cargando datos:', e);
    todosLosDatos = [];
  }
}

/* ── Filtros ─────────────────────────────────────────────────── */
function inicializarFiltros() {
  const areas   = [...new Set(todosLosDatos.map(d => d.area))].sort();
  const tipos   = [...new Set(todosLosDatos.map(d => d.tipo_activo))].sort();
  const activos = [...new Set(todosLosDatos.map(d => d.activo))].sort();
  const fechas  = todosLosDatos.map(d => d.fecha).sort();

  poblarSelect('filtro-area',   areas);
  poblarSelect('filtro-tipo',   tipos);
  poblarSelect('filtro-activo', activos);

  if (fechas.length) {
    document.getElementById('filtro-fecha-desde').value = fechas[0];
    document.getElementById('filtro-fecha-hasta').value = fechas[fechas.length - 1];
  }

  ['filtro-area','filtro-tipo','filtro-activo','filtro-fecha-desde','filtro-fecha-hasta']
    .forEach(id => document.getElementById(id).addEventListener('change', aplicarFiltros));

  document.getElementById('btn-reset').addEventListener('click', resetFiltros);

  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      aplicarFiltroRapido(chip.dataset.filter);
    });
  });
}

function poblarSelect(id, valores) {
  const sel = document.getElementById(id);
  valores.forEach(v => {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = cap(v);
    sel.appendChild(o);
  });
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function aplicarFiltroRapido(filter) {
  resetFiltrosCampos();
  const fechas   = todosLosDatos.map(d => d.fecha).sort();
  const maxFecha = fechas[fechas.length - 1];

  if (filter === '7d' || filter === '30d') {
    const dias = filter === '7d' ? 7 : 30;
    const lim  = new Date(maxFecha);
    lim.setDate(lim.getDate() - dias);
    document.getElementById('filtro-fecha-desde').value = lim.toISOString().split('T')[0];
    document.getElementById('filtro-fecha-hasta').value = maxFecha;
  }

  aplicarFiltros(filter === 'top5');
}

function aplicarFiltros(top5 = false) {
  const area       = document.getElementById('filtro-area').value;
  const tipo       = document.getElementById('filtro-tipo').value;
  const activo     = document.getElementById('filtro-activo').value;
  const fechaDesde = document.getElementById('filtro-fecha-desde').value;
  const fechaHasta = document.getElementById('filtro-fecha-hasta').value;

  datosFiltrados = todosLosDatos.filter(d => {
    if (area   && d.area !== area)         return false;
    if (tipo   && d.tipo_activo !== tipo)  return false;
    if (activo && d.activo !== activo)     return false;
    if (fechaDesde && d.fecha < fechaDesde) return false;
    if (fechaHasta && d.fecha > fechaHasta) return false;
    return true;
  });

  if (top5 === true) {
    const ag = agrupar(datosFiltrados);
    const top = Object.keys(ag)
      .map(a => ({ a, imp: ag[a].reduce((s,d) => s + d.impacto_economico, 0) }))
      .sort((x,y) => y.imp - x.imp).slice(0,5).map(x => x.a);
    datosFiltrados = datosFiltrados.filter(d => top.includes(d.activo));
  }

  actualizarTodo();
}

function resetFiltros() {
  resetFiltrosCampos();
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  aplicarFiltros();
}

function resetFiltrosCampos() {
  document.getElementById('filtro-area').value   = '';
  document.getElementById('filtro-tipo').value   = '';
  document.getElementById('filtro-activo').value = '';
  const fechas = todosLosDatos.map(d => d.fecha).sort();
  if (fechas.length) {
    document.getElementById('filtro-fecha-desde').value = fechas[0];
    document.getElementById('filtro-fecha-hasta').value = fechas[fechas.length - 1];
  }
}

/* ── Actualización general ───────────────────────────────────── */
function actualizarTodo() {
  calcularKPIs();
  renderDisponibilidad();
  renderMtbfMttr();
  renderRanking();
  renderRiesgo();
  renderTabla();
  actualizarSimulacion();
  actualizarTimestamp();
}

/* ── KPIs ────────────────────────────────────────────────────── */
function calcularKPIs() {
  if (!datosFiltrados.length) {
    ['kpi-disponibilidad','kpi-mtbf','kpi-mttr','kpi-impacto'].forEach(id => {
      document.getElementById(id).textContent = '—';
    });
    return;
  }
  const n   = datosFiltrados.length;
  const dp  = avg(datosFiltrados.map(d => d.disponibilidad));
  const mbf = avg(datosFiltrados.map(d => d.mtbf));
  const mtr = avg(datosFiltrados.map(d => d.mttr));
  const imp = datosFiltrados.reduce((s,d) => s + d.impacto_economico, 0);

  document.getElementById('kpi-disponibilidad').textContent = dp.toFixed(1);
  document.getElementById('kpi-mtbf').textContent           = mbf.toFixed(1);
  document.getElementById('kpi-mttr').textContent           = mtr.toFixed(1);
  document.getElementById('kpi-impacto').textContent        = fmtM(imp);

  const na = [...new Set(datosFiltrados.map(d => d.activo))].length;
  document.getElementById('kpi-disp-sub').textContent  = `${na} activos · ${n} registros`;
  document.getElementById('kpi-mtbf-sub').textContent  = 'Tiempo promedio entre fallas';
  document.getElementById('kpi-mttr-sub').textContent  = 'Tiempo promedio de reparación';
  document.getElementById('kpi-econ-sub').textContent  = 'Pérdida acumulada período';
}

/* ── Gráficos ────────────────────────────────────────────────── */
function renderDisponibilidad() {
  const ctx = document.getElementById('chart-disponibilidad').getContext('2d');
  const porFecha = {};
  datosFiltrados.forEach(d => {
    if (!porFecha[d.fecha]) porFecha[d.fecha] = [];
    porFecha[d.fecha].push(d.disponibilidad);
  });
  const fechas = Object.keys(porFecha).sort();
  const vals   = fechas.map(f => avg(porFecha[f]));

  if (charts.disp) charts.disp.destroy();
  charts.disp = new Chart(ctx, {
    type: 'line',
    data: {
      labels: fechas.map(f => fmtFecha(f)),
      datasets: [{
        label: 'Disponibilidad promedio (%)',
        data: vals,
        borderColor: '#00d4ff',
        backgroundColor: 'rgba(0,212,255,0.08)',
        borderWidth: 2,
        pointBackgroundColor: '#00d4ff',
        pointRadius: 5, pointHoverRadius: 8,
        tension: 0.35, fill: true,
      }]
    },
    options: baseOpts({ yMin: 60, yMax: 100 })
  });
}

function renderMtbfMttr() {
  const ctx = document.getElementById('chart-mtbf-mttr').getContext('2d');
  const ag  = agrupar(datosFiltrados);
  const act = Object.keys(ag);
  const mtbfV = act.map(a => avg(ag[a].map(d => d.mtbf)));
  const mttrV = act.map(a => avg(ag[a].map(d => d.mttr)));
  const lbs   = act.map(a => a.length > 16 ? a.substring(0,14)+'…' : a);

  if (charts.mtbf) charts.mtbf.destroy();
  charts.mtbf = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: lbs,
      datasets: [
        { label: 'MTBF (hrs)', data: mtbfV, backgroundColor: 'rgba(16,214,126,0.72)', borderColor: '#10d67e', borderWidth: 1, borderRadius: 4 },
        { label: 'MTTR (hrs)', data: mttrV, backgroundColor: 'rgba(245,158,11,0.72)', borderColor: '#f59e0b', borderWidth: 1, borderRadius: 4 }
      ]
    },
    options: baseOpts({})
  });
}

function renderRanking() {
  const ctx = document.getElementById('chart-ranking').getContext('2d');
  const ag  = agrupar(datosFiltrados);
  const dat = Object.keys(ag)
    .map(a => ({ a, imp: ag[a].reduce((s,d)=>s+d.impacto_economico,0), dp: avg(ag[a].map(d=>d.disponibilidad)) }))
    .sort((x,y) => y.imp - x.imp);

  const lbs  = dat.map(d => d.a.length > 20 ? d.a.substring(0,18)+'…' : d.a);
  const vals = dat.map(d => d.imp / 1e6);
  const cols = dat.map(d => d.dp < 80 ? 'rgba(239,68,68,0.75)' : d.dp < 88 ? 'rgba(245,158,11,0.75)' : 'rgba(16,214,126,0.75)');

  if (charts.rank) charts.rank.destroy();
  charts.rank = new Chart(ctx, {
    type: 'bar',
    data: { labels: lbs, datasets: [{ label: 'Impacto (MM USD)', data: vals, backgroundColor: cols, borderRadius: 4, borderWidth: 1, borderColor: cols.map(c=>c.replace('0.75','1')) }] },
    options: { ...baseOpts({}), indexAxis: 'y' }
  });
}

/* ── Panel de riesgo ─────────────────────────────────────────── */
function renderRiesgo() {
  const cont    = document.getElementById('risk-list');
  const insight = document.getElementById('insight-text');

  if (!datosFiltrados.length) {
    cont.innerHTML = '<div class="empty-state">Sin datos para el período</div>';
    insight.innerHTML = 'No hay datos disponibles.';
    return;
  }

  const ag = agrupar(datosFiltrados);
  const ranking = Object.keys(ag)
    .map(a => ({
      a, imp: ag[a].reduce((s,d)=>s+d.impacto_economico,0),
      dp: avg(ag[a].map(d=>d.disponibilidad)),
      area: ag[a][0].area, tipo: ag[a][0].tipo_activo
    }))
    .sort((x,y) => y.imp - x.imp).slice(0, 6);

  cont.innerHTML = '';
  ranking.forEach(item => {
    const cls = item.dp < 80 ? 'rojo' : item.dp < 88 ? 'ambar' : 'verde';
    const col = cls === 'rojo' ? 'text-red' : cls === 'ambar' ? 'text-amber' : 'text-green';
    cont.innerHTML += `
      <div class="risk-item">
        <span class="semaforo ${cls}"></span>
        <div class="risk-item-info">
          <div class="risk-item-name">${item.a}</div>
          <div class="risk-item-detail">${item.area} · ${cap(item.tipo)} · Disp: ${item.dp.toFixed(1)}%</div>
        </div>
        <div class="risk-item-value ${col}">${fmtM(item.imp)}</div>
      </div>`;
  });

  const cr = ranking[0];
  if (cr) {
    const nv = cr.dp < 80 ? 'nivel crítico' : 'alerta';
    insight.innerHTML = `<strong>⚠ Insight:</strong> <strong>${cr.a}</strong> presenta la mayor criticidad en el período con disponibilidad del <strong>${cr.dp.toFixed(1)}%</strong> (${nv}) e impacto acumulado de <strong>${fmtM(cr.imp)} USD</strong>. Priorizar plan de mantenimiento preventivo.`;
  }
}

/* ── Tabla dashboard ─────────────────────────────────────────── */
function renderTabla() {
  const tbody = document.querySelector('#tabla-datos tbody');
  if (!datosFiltrados.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-state">Sin datos para el período seleccionado</td></tr>';
    return;
  }
  const datos = [...datosFiltrados].sort((a,b) => b.impacto_economico - a.impacto_economico).slice(0, 50);
  tbody.innerHTML = datos.map(d => {
    const dc  = d.disponibilidad < 80 ? 'text-red' : d.disponibilidad < 88 ? 'text-amber' : 'text-green';
    const arc = d.area.toLowerCase() === 'mina' ? 'mina' : 'planta';
    return `<tr>
      <td>${d.activo}</td>
      <td><span class="badge-area ${arc}">${d.area}</span></td>
      <td>${cap(d.tipo_activo)}</td>
      <td>${d.fecha}</td>
      <td class="disponibilidad-cell ${dc}">${d.disponibilidad.toFixed(1)}%</td>
      <td class="text-mono text-green">${d.mtbf.toFixed(1)}</td>
      <td class="text-mono text-amber">${d.mttr.toFixed(1)}</td>
      <td class="text-mono">${d.horas_falla}</td>
      <td class="text-mono text-red">${fmtM(d.impacto_economico)}</td>
    </tr>`;
  }).join('');
}

/* ── Simulación ──────────────────────────────────────────────── */
function inicializarSimulacion() {
  document.querySelectorAll('.sim-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sim-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      simulacionPct = parseFloat(btn.dataset.pct);
      actualizarSimulacion();
    });
  });
}

function actualizarSimulacion() {
  const el = document.getElementById('sim-result');
  if (!simulacionPct || !datosFiltrados.length) {
    el.innerHTML = `<h3>Seleccione un escenario de mejora</h3>
      <p>Elija +1%, +2% o +3% de disponibilidad para calcular el ahorro potencial estimado.</p>`;
    return;
  }
  let ahorro = 0;
  datosFiltrados.forEach(d => {
    const da = d.disponibilidad / 100;
    const dm = Math.min(1, da + simulacionPct / 100);
    const ht = d.horas_operativas + d.horas_falla;
    ahorro += (dm - da) * ht * d.costo_hora_indisponibilidad;
  });
  const na = [...new Set(datosFiltrados.map(d => d.activo))].length;
  el.innerHTML = `
    <h3>Ahorro estimado con +${simulacionPct}% disponibilidad</h3>
    <p>Escenario sobre <strong style="color:var(--text-h)">${na} activos</strong> y <strong style="color:var(--text-h)">${datosFiltrados.length} registros</strong>.
    Cálculo: horas recuperadas × costo unitario de indisponibilidad.</p>
    <span class="sim-amount">+ ${fmtM(ahorro)} USD</span>`;
}

/* ── Timestamp ───────────────────────────────────────────────── */
function actualizarTimestamp() {
  const el = document.getElementById('last-update');
  if (el) el.textContent = new Date().toLocaleString('es-CL', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

/* ── Opciones base Chart.js ──────────────────────────────────── */
function baseOpts({ yMin = null, yMax = null } = {}) {
  const scales = {
    x: { ticks: { color: '#9bbad8', font: { family:"'Share Tech Mono', monospace", size:10 }, maxRotation:30 }, grid: { color:'rgba(30,47,72,0.55)' } },
    y: { ticks: { color: '#9bbad8', font: { family:"'Share Tech Mono', monospace", size:10 } },                  grid: { color:'rgba(30,47,72,0.55)' } }
  };
  if (yMin !== null) scales.y.min = yMin;
  if (yMax !== null) scales.y.max = yMax;
  return {
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 450 },
    plugins: {
      legend: { labels: { color:'#9bbad8', font:{ family:"'Share Tech Mono', monospace", size:10 }, boxWidth:12 } },
      tooltip: { backgroundColor:'#0f1520', borderColor:'#1e2f48', borderWidth:1, titleColor:'#00d4ff', bodyColor:'#9bbad8', padding:10 }
    },
    scales
  };
}

/* ── Utilidades ──────────────────────────────────────────────── */
function avg(arr) { return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0; }

function agrupar(datos) {
  return datos.reduce((acc,d) => {
    if (!acc[d.activo]) acc[d.activo] = [];
    acc[d.activo].push(d);
    return acc;
  }, {});
}

function fmtFecha(f) {
  const [y,m,d] = f.split('-');
  return `${d}/${m}/${y}`;
}

function fmtM(v) {
  if (v >= 1e6) return (v/1e6).toFixed(2) + ' MM';
  if (v >= 1e3) return (v/1e3).toFixed(0) + ' K';
  return v.toFixed(0);
}

/* ════════════════════════════════════════════════════════════════
   MÓDULO: VISOR DE BASE DE DATOS (Google Sheets style)
   ════════════════════════════════════════════════════════════════ */

/* ── Abrir/Cerrar ────────────────────────────────────────────── */
function abrirModal() {
  document.getElementById('db-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  inicializarDB();
}

function cerrarModal() {
  document.getElementById('db-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function cerrarModalFuera(e) {
  if (e.target.id === 'db-overlay') cerrarModal();
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarModal(); });

/* ── Inicializar DB modal ────────────────────────────────────── */
function inicializarDB() {
  const datos = todosLosDatos;

  // Badge de filas en sidebar
  const badge = document.getElementById('db-badge-rows');
  if (badge) badge.textContent = datos.length;

  document.getElementById('db-total-registros').textContent = `${datos.length} registros`;
  document.getElementById('db-row-count').textContent = `${datos.length} filas`;
  document.getElementById('db-rptab-badge').textContent = datos.length;

  renderSpreadsheet(datos);
  renderJSONViewer(jsonCountActual);
  renderEstadisticas(datos);
  simularQuery();
}

/* ── Ejecutar query (visual) ─────────────────────────────────── */
function ejecutarQuery() {
  const btn = document.getElementById('btn-run-query');
  const orig = btn.innerHTML;
  btn.innerHTML = '<span style="display:inline-block;animation:spin .6s linear infinite">↻</span> Ejecutando…';
  btn.disabled = true;

  setTimeout(() => {
    btn.innerHTML = orig;
    btn.disabled = false;

    const t = (Math.random() * 40 + 12).toFixed(0);
    document.getElementById('db-status-text').textContent =
      `Consulta ejecutada correctamente — ${todosLosDatos.length} filas retornadas`;
    document.getElementById('db-exec-time').textContent = `${t} ms`;

    renderSpreadsheet(todosLosDatos);
  }, 900);
}

function simularQuery() {
  const t = (Math.random() * 40 + 12).toFixed(0);
  document.getElementById('db-status-text').textContent =
    `Consulta ejecutada correctamente — ${todosLosDatos.length} filas retornadas`;
  document.getElementById('db-exec-time').textContent = `${t} ms`;
}

/* ── Spread sheet grid ───────────────────────────────────────── */
const COL_META = {
  id:                          { label:'id',        tipo:'SERIAL',       align:'center' },
  fecha:                       { label:'fecha',      tipo:'DATE',         align:'left'   },
  area:                        { label:'area',       tipo:'VARCHAR(20)',  align:'left'   },
  activo:                      { label:'activo',     tipo:'VARCHAR(60)',  align:'left'   },
  tipo_activo:                 { label:'tipo_activo',tipo:'VARCHAR(30)',  align:'left'   },
  disponibilidad:              { label:'disponibilidad', tipo:'NUMERIC(5,2)', align:'right' },
  mtbf:                        { label:'mtbf',       tipo:'NUMERIC(8,2)', align:'right'  },
  mttr:                        { label:'mttr',       tipo:'NUMERIC(6,2)', align:'right'  },
  horas_operativas:            { label:'horas_operativas', tipo:'INTEGER',align:'right'  },
  horas_falla:                 { label:'horas_falla',tipo:'INTEGER',     align:'right'  },
  costo_hora_indisponibilidad: { label:'costo_hora_ind…',tipo:'INTEGER', align:'right'  },
  impacto_economico:           { label:'impacto_economico',tipo:'BIGINT',align:'right'  },
};

let dbFiltrados = [];

function renderSpreadsheet(datos) {
  dbFiltrados = datos;
  const cols  = Object.keys(COL_META);
  const thead = document.getElementById('db-thead');
  const tbody = document.getElementById('db-tbody');

  // Cabecera
  thead.innerHTML = '<tr>' +
    '<th><div class="db-th-inner" style="justify-content:center"><span class="db-th-name">#</span></div></th>' +
    cols.map(c => {
      const m = COL_META[c];
      return `<th>
        <div class="db-th-inner">
          <span class="db-th-name">${m.label}</span>
          <span class="db-th-type">${m.tipo}</span>
          <span class="db-th-sort">⇅</span>
        </div>
      </th>`;
    }).join('') + '</tr>';

  // Filas
  tbody.innerHTML = datos.map((row, i) => {
    const id = i + 1;
    const celdas = cols.map(c => {
      const m   = COL_META[c];
      let val   = row[c] !== undefined ? row[c] : (c === 'id' ? id : '');
      if (c === 'id') val = id;

      let inner = '';

      if (c === 'area') {
        const cls = val === 'Mina' ? 'db-chip--mina' : 'db-chip--planta';
        inner = `<span class="db-chip ${cls}">${val}</span>`;
      } else if (c === 'disponibilidad') {
        const pct  = parseFloat(val);
        const col  = pct < 80 ? '#c5221f' : pct < 88 ? '#f29900' : '#0b8043';
        inner = `<div class="db-disp-wrap">
          <div class="db-disp-bar"><div class="db-disp-fill" style="width:${pct}%;background:${col}"></div></div>
          <span class="db-disp-val" style="color:${col}">${pct.toFixed(1)}%</span>
        </div>`;
      } else if (c === 'impacto_economico') {
        inner = `<span class="db-num-neg">$ ${Number(val).toLocaleString('es-CL')}</span>`;
      } else if (c === 'costo_hora_indisponibilidad') {
        inner = `$ ${Number(val).toLocaleString('es-CL')}`;
      } else if (['mtbf','mttr'].includes(c)) {
        inner = parseFloat(val).toFixed(1);
      } else if (c === 'horas_operativas' || c === 'horas_falla') {
        inner = Number(val).toLocaleString('es-CL');
      } else {
        inner = val;
      }

      return `<td style="text-align:${m.align}">${inner}</td>`;
    }).join('');

    return `<tr><td>${id}</td>${celdas}</tr>`;
  }).join('');

  actualizarConteos(datos.length, todosLosDatos.length);
}

/* ── Filtrar en modal ────────────────────────────────────────── */
function filtrarTablaDB() {
  const q = document.getElementById('db-search').value.toLowerCase().trim();
  const filtered = q
    ? todosLosDatos.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(q)))
    : todosLosDatos;
  renderSpreadsheet(filtered);
}

function actualizarConteos(n, total) {
  const txt = n === total ? `${total} filas` : `${n} de ${total} filas`;
  document.getElementById('db-row-count').textContent = txt;
  document.getElementById('db-rptab-badge').textContent = n;
  document.getElementById('db-total-registros').textContent = `${n} registros`;
}

/* ── Tabs de resultados ──────────────────────────────────────── */
function switchResultTab(sheet, topBtn) {
  // Sync top tabs
  document.querySelectorAll('.db-rptab').forEach(b => b.classList.remove('db-rptab--active'));
  if (topBtn) topBtn.classList.add('db-rptab--active');
  else {
    const match = [...document.querySelectorAll('.db-rptab')]
      .find(b => b.dataset.sheet === sheet);
    if (match) match.classList.add('db-rptab--active');
  }
  // Sync sheet tabs at bottom
  document.querySelectorAll('.db-sheettab').forEach(b => b.classList.remove('db-sheettab--active'));

  // Show content
  document.querySelectorAll('.db-rpcontent').forEach(c => c.classList.remove('db-rpcontent--active'));
  const target = document.getElementById(`rpsheet-${sheet}`);
  if (target) target.classList.add('db-rpcontent--active');
}

// Sync desde tabs inferiores
function syncSheetTab(sheet, btn) {
  document.querySelectorAll('.db-sheettab').forEach(b => b.classList.remove('db-sheettab--active'));
  btn.classList.add('db-sheettab--active');
  switchResultTab(sheet, null);
}

document.addEventListener('DOMContentLoaded', () => {
  // Click en tabs superiores
  document.querySelectorAll('.db-rptab').forEach(btn => {
    btn.addEventListener('click', () => switchResultTab(btn.dataset.sheet, btn));
  });
});

/* ── Colapsar SQL ────────────────────────────────────────────── */
function toggleSQL(btn) {
  const body = document.getElementById('db-sqled-body');
  const hidden = body.style.display === 'none';
  body.style.display = hidden ? 'flex' : 'none';
  btn.textContent = hidden ? '▲ Colapsar' : '▼ Expandir';
}

/* ── JSON Viewer ─────────────────────────────────────────────── */
function renderJSONViewer(count) {
  const datos = count ? todosLosDatos.slice(0, count) : todosLosDatos;
  document.getElementById('db-json-viewer').innerHTML = jsonHL(JSON.stringify(datos, null, 2));
  const el = document.getElementById('json-count');
  if (el) el.textContent = count || todosLosDatos.length;
}

function cambiarJsonCount(n, btn) {
  document.querySelectorAll('.db-jbtn').forEach(b => b.classList.remove('db-jbtn--on'));
  if (btn) btn.classList.add('db-jbtn--on');
  jsonCountActual = n;
  renderJSONViewer(n);
}

function jsonHL(str) {
  return str
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(
      /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      m => {
        let cls = 'jn';
        if (/^"/.test(m)) { cls = /:$/.test(m) ? 'jk' : 'js'; }
        else if (/true|false/.test(m)) cls = 'jb';
        else if (/null/.test(m)) cls = 'jx';
        return `<span class="${cls}">${m}</span>`;
      }
    );
}

/* ── Estadísticas ────────────────────────────────────────────── */
function renderEstadisticas(datos) {
  const grid = document.getElementById('db-stats-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const nums = ['disponibilidad','mtbf','mttr','horas_operativas','horas_falla','costo_hora_indisponibilidad','impacto_economico'];
  nums.forEach(campo => {
    const vs = datos.map(d => d[campo]).filter(v => typeof v === 'number');
    if (!vs.length) return;
    const mn  = Math.min(...vs);
    const mx  = Math.max(...vs);
    const pr  = avg(vs);
    const s   = [...vs].sort((a,b)=>a-b);
    const med = s.length % 2 ? s[Math.floor(s.length/2)] : (s[s.length/2-1]+s[s.length/2])/2;
    const fmt = v => v.toLocaleString('es-CL', { maximumFractionDigits:1 });
    grid.innerHTML += `
      <div class="db-stat-card">
        <div class="db-stat-field">${campo}</div>
        <div class="db-stat-row"><span class="db-stat-key">Registros</span><span class="db-stat-val">${vs.length}</span></div>
        <div class="db-stat-row"><span class="db-stat-key">Mínimo</span><span class="db-stat-val">${fmt(mn)}</span></div>
        <div class="db-stat-row"><span class="db-stat-key">Máximo</span><span class="db-stat-val">${fmt(mx)}</span></div>
        <div class="db-stat-row"><span class="db-stat-key">Promedio</span><span class="db-stat-val db-stat-val--accent">${fmt(pr)}</span></div>
        <div class="db-stat-row"><span class="db-stat-key">Mediana</span><span class="db-stat-val">${fmt(med)}</span></div>
      </div>`;
  });

  ['area','tipo_activo','activo'].forEach(campo => {
    const cnt = {};
    datos.forEach(d => { cnt[d[campo]] = (cnt[d[campo]]||0)+1; });
    const unicos = Object.keys(cnt).length;
    const top = Object.entries(cnt).sort((a,b)=>b[1]-a[1]).slice(0,4);
    grid.innerHTML += `
      <div class="db-stat-card">
        <div class="db-stat-field">${campo}</div>
        <div class="db-stat-row"><span class="db-stat-key">Valores únicos</span><span class="db-stat-val">${unicos}</span></div>
        ${top.map(([v,c]) => `
          <div class="db-stat-row">
            <span class="db-stat-key">${v.length>18?v.substring(0,16)+'…':v}</span>
            <span class="db-stat-val">${c} reg.</span>
          </div>`).join('')}
      </div>`;
  });
}

/* Spinner CSS via JS */
const style = document.createElement('style');
style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
document.head.appendChild(style);
