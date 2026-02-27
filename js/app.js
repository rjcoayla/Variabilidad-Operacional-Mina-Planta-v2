/**
 * ================================================================
 * MODELO PREDICTIVO DE DISPONIBILIDAD Y CONFIABILIDAD DE ACTIVOS
 * Gran Minería del Cobre – app.js
 * ================================================================
 */

/* ----------------------------------------------------------------
   Estado global de la aplicación
   ---------------------------------------------------------------- */
let todosLosDatos = [];
let datosFiltrados = [];
let charts = {};
let simulacionPct = 0;

/* ----------------------------------------------------------------
   Inicialización
   ---------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', async () => {
  await cargarDatos();
  inicializarFiltros();
  aplicarFiltros();
  inicializarSimulacion();
});

/* ----------------------------------------------------------------
   Carga de datos JSON
   ---------------------------------------------------------------- */
async function cargarDatos() {
  try {
    const resp = await fetch('data/confiabilidad_activos.json');
    todosLosDatos = await resp.json();
  } catch (e) {
    console.error('Error cargando datos:', e);
    todosLosDatos = [];
  }
}

/* ----------------------------------------------------------------
   Inicializar controles de filtro
   ---------------------------------------------------------------- */
function inicializarFiltros() {
  // Poblar selectores dinámicos
  const areas    = [...new Set(todosLosDatos.map(d => d.area))].sort();
  const tipos    = [...new Set(todosLosDatos.map(d => d.tipo_activo))].sort();
  const activos  = [...new Set(todosLosDatos.map(d => d.activo))].sort();
  const fechas   = todosLosDatos.map(d => d.fecha).sort();

  poblarSelect('filtro-area', areas);
  poblarSelect('filtro-tipo', tipos);
  poblarSelect('filtro-activo', activos);

  if (fechas.length) {
    document.getElementById('filtro-fecha-desde').value = fechas[0];
    document.getElementById('filtro-fecha-hasta').value = fechas[fechas.length - 1];
  }

  // Event listeners
  ['filtro-area','filtro-tipo','filtro-activo',
   'filtro-fecha-desde','filtro-fecha-hasta'].forEach(id => {
    document.getElementById(id).addEventListener('change', aplicarFiltros);
  });

  document.getElementById('btn-reset').addEventListener('click', resetFiltros);

  // Chips
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
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = capitalizar(v);
    sel.appendChild(opt);
  });
}

function capitalizar(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/* ----------------------------------------------------------------
   Filtros rápidos (chips)
   ---------------------------------------------------------------- */
function aplicarFiltroRapido(filter) {
  const hoy    = new Date();
  const fechas = todosLosDatos.map(d => d.fecha).sort();
  const maxFecha = fechas[fechas.length - 1];

  resetFiltrosCampos();

  if (filter === '7d' || filter === '30d') {
    const dias = filter === '7d' ? 7 : 30;
    const limite = new Date(maxFecha);
    limite.setDate(limite.getDate() - dias);
    document.getElementById('filtro-fecha-desde').value = limite.toISOString().split('T')[0];
    document.getElementById('filtro-fecha-hasta').value = maxFecha;
  }

  aplicarFiltros(filter === 'top5');
}

/* ----------------------------------------------------------------
   Aplicar filtros
   ---------------------------------------------------------------- */
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
    // Agrupar por activo y tomar los 5 con mayor impacto económico
    const agrupado = agruparPorActivo(datosFiltrados);
    const top5Activos = Object.keys(agrupado)
      .map(a => ({ activo: a, impacto: agrupado[a].reduce((s, d) => s + d.impacto_economico, 0) }))
      .sort((a, b) => b.impacto - a.impacto)
      .slice(0, 5)
      .map(a => a.activo);
    datosFiltrados = datosFiltrados.filter(d => top5Activos.includes(d.activo));
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

/* ----------------------------------------------------------------
   Actualizar toda la UI con los datos filtrados
   ---------------------------------------------------------------- */
function actualizarTodo() {
  calcularYMostrarKPIs();
  renderGraficoDisponibilidad();
  renderGraficoMtbfMttr();
  renderGraficoRanking();
  renderPanelRiesgo();
  renderTabla();
  actualizarSimulacion();
  actualizarTimestamp();
}

/* ----------------------------------------------------------------
   KPIs
   ---------------------------------------------------------------- */
function calcularYMostrarKPIs() {
  if (!datosFiltrados.length) {
    setKPI('kpi-disponibilidad', '—', '%');
    setKPI('kpi-mtbf', '—', 'hrs');
    setKPI('kpi-mttr', '—', 'hrs');
    setKPI('kpi-impacto', '—', 'USD');
    return;
  }

  const n = datosFiltrados.length;
  const dispProm = promedio(datosFiltrados.map(d => d.disponibilidad));
  const mtbfProm = promedio(datosFiltrados.map(d => d.mtbf));
  const mttrProm = promedio(datosFiltrados.map(d => d.mttr));
  const impactoTotal = datosFiltrados.reduce((s, d) => s + d.impacto_economico, 0);

  setKPI('kpi-disponibilidad', dispProm.toFixed(1), '%');
  setKPI('kpi-mtbf', mtbfProm.toFixed(1), 'hrs');
  setKPI('kpi-mttr', mttrProm.toFixed(1), 'hrs');
  setKPI('kpi-impacto', formatMillones(impactoTotal), 'USD');

  // Sublabels
  const nActivos = [...new Set(datosFiltrados.map(d => d.activo))].length;
  document.getElementById('kpi-disp-sub').textContent  = `${nActivos} activos · ${n} registros`;
  document.getElementById('kpi-mtbf-sub').textContent  = `Tiempo promedio entre fallas`;
  document.getElementById('kpi-mttr-sub').textContent  = `Tiempo promedio de reparación`;
  document.getElementById('kpi-econ-sub').textContent  = `Pérdida acumulada período`;
}

function setKPI(id, valor, unidad) {
  document.getElementById(id).textContent = valor;
}

/* ----------------------------------------------------------------
   Gráfico de Línea: Disponibilidad vs Tiempo
   ---------------------------------------------------------------- */
function renderGraficoDisponibilidad() {
  const ctx = document.getElementById('chart-disponibilidad').getContext('2d');

  // Agrupar por fecha → disponibilidad promedio
  const porFecha = {};
  datosFiltrados.forEach(d => {
    if (!porFecha[d.fecha]) porFecha[d.fecha] = [];
    porFecha[d.fecha].push(d.disponibilidad);
  });

  const fechasOrdenadas = Object.keys(porFecha).sort();
  const valores = fechasOrdenadas.map(f => promedio(porFecha[f]));
  const labels  = fechasOrdenadas.map(f => formatFecha(f));

  if (charts.disponibilidad) charts.disponibilidad.destroy();

  charts.disponibilidad = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Disponibilidad promedio (%)',
        data: valores,
        borderColor: '#00d4ff',
        backgroundColor: 'rgba(0,212,255,0.08)',
        borderWidth: 2,
        pointBackgroundColor: '#00d4ff',
        pointRadius: 5,
        pointHoverRadius: 8,
        tension: 0.35,
        fill: true,
      }]
    },
    options: chartOptionsBase({
      yLabel: 'Disponibilidad (%)',
      yMin: 60, yMax: 100,
      refLine: { value: 90, color: '#10d67e', label: 'Meta 90%' }
    })
  });
}

/* ----------------------------------------------------------------
   Gráfico de Barras: MTBF vs MTTR por activo
   ---------------------------------------------------------------- */
function renderGraficoMtbfMttr() {
  const ctx = document.getElementById('chart-mtbf-mttr').getContext('2d');
  const agrupado = agruparPorActivo(datosFiltrados);
  const activos  = Object.keys(agrupado);

  const mtbfVals = activos.map(a => promedio(agrupado[a].map(d => d.mtbf)));
  const mttrVals = activos.map(a => promedio(agrupado[a].map(d => d.mttr)));
  const labels   = activos.map(a => a.length > 16 ? a.substring(0, 14) + '…' : a);

  if (charts.mtbfMttr) charts.mtbfMttr.destroy();

  charts.mtbfMttr = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'MTBF (hrs)',
          data: mtbfVals,
          backgroundColor: 'rgba(16,214,126,0.7)',
          borderColor: '#10d67e',
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: 'MTTR (hrs)',
          data: mttrVals,
          backgroundColor: 'rgba(245,158,11,0.7)',
          borderColor: '#f59e0b',
          borderWidth: 1,
          borderRadius: 4,
        }
      ]
    },
    options: chartOptionsBase({ yLabel: 'Horas' })
  });
}

/* ----------------------------------------------------------------
   Gráfico de Barras Horizontales: Ranking por impacto económico
   ---------------------------------------------------------------- */
function renderGraficoRanking() {
  const ctx = document.getElementById('chart-ranking').getContext('2d');
  const agrupado = agruparPorActivo(datosFiltrados);

  const datos = Object.keys(agrupado)
    .map(a => ({
      activo: a,
      impacto: agrupado[a].reduce((s, d) => s + d.impacto_economico, 0),
      disp: promedio(agrupado[a].map(d => d.disponibilidad))
    }))
    .sort((a, b) => b.impacto - a.impacto);

  const labels = datos.map(d => d.activo.length > 20 ? d.activo.substring(0, 18) + '…' : d.activo);
  const valores = datos.map(d => d.impacto / 1e6);

  const colores = datos.map(d => {
    if (d.disp < 80)       return 'rgba(239,68,68,0.75)';
    if (d.disp < 88)       return 'rgba(245,158,11,0.75)';
    return 'rgba(16,214,126,0.75)';
  });

  if (charts.ranking) charts.ranking.destroy();

  charts.ranking = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Impacto económico (MM USD)',
        data: valores,
        backgroundColor: colores,
        borderColor: colores.map(c => c.replace('0.75', '1')),
        borderWidth: 1,
        borderRadius: 4,
      }]
    },
    options: {
      ...chartOptionsBase({ yLabel: 'Impacto (MM USD)' }),
      indexAxis: 'y',
      plugins: {
        ...chartOptionsBase({ yLabel: 'Impacto (MM USD)' }).plugins,
        tooltip: {
          callbacks: {
            label: ctx => ` USD ${ctx.parsed.x.toFixed(3)} MM`
          }
        }
      }
    }
  });
}

/* ----------------------------------------------------------------
   Panel de Riesgo con semáforo
   ---------------------------------------------------------------- */
function renderPanelRiesgo() {
  const contenedor = document.getElementById('risk-list');
  const insightEl  = document.getElementById('insight-text');

  if (!datosFiltrados.length) {
    contenedor.innerHTML = '<div class="empty-state">Sin datos para el período</div>';
    insightEl.innerHTML  = 'No hay datos disponibles para el período seleccionado.';
    return;
  }

  const agrupado = agruparPorActivo(datosFiltrados);
  const ranking = Object.keys(agrupado)
    .map(a => ({
      activo: a,
      impacto: agrupado[a].reduce((s, d) => s + d.impacto_economico, 0),
      disp:    promedio(agrupado[a].map(d => d.disponibilidad)),
      mtbf:    promedio(agrupado[a].map(d => d.mtbf)),
      area:    agrupado[a][0].area,
      tipo:    agrupado[a][0].tipo_activo,
    }))
    .sort((a, b) => b.impacto - a.impacto)
    .slice(0, 6);

  contenedor.innerHTML = '';

  ranking.forEach(item => {
    const clase  = item.disp < 80 ? 'rojo' : item.disp < 88 ? 'ambar' : 'verde';
    const estado = item.disp < 80 ? 'CRÍTICO' : item.disp < 88 ? 'ALERTA' : 'NORMAL';

    contenedor.innerHTML += `
      <div class="risk-item">
        <span class="semaforo ${clase}" title="${estado}"></span>
        <div class="risk-item-info">
          <div class="risk-item-name">${item.activo}</div>
          <div class="risk-item-detail">${item.area} · ${capitalizar(item.tipo)} · Disp: ${item.disp.toFixed(1)}%</div>
        </div>
        <div class="risk-item-value text-${clase === 'rojo' ? 'red' : clase === 'ambar' ? 'amber' : 'green'}">
          ${formatMillones(item.impacto)}
        </div>
      </div>
    `;
  });

  // Insight automático
  const critico = ranking[0];
  if (critico) {
    const nivel = critico.disp < 80 ? 'nivel crítico' : 'nivel de alerta';
    insightEl.innerHTML = `
      <strong>⚠ Insight:</strong> <strong>${critico.activo}</strong> presenta la mayor 
      criticidad en el período filtrado, con una disponibilidad del 
      <strong>${critico.disp.toFixed(1)}%</strong> (${nivel}) y un impacto económico acumulado de 
      <strong>${formatMillones(critico.impacto)} USD</strong>. 
      Se recomienda priorizar plan de mantenimiento preventivo.
    `;
  }
}

/* ----------------------------------------------------------------
   Tabla de datos
   ---------------------------------------------------------------- */
function renderTabla() {
  const tbody = document.querySelector('#tabla-datos tbody');

  if (!datosFiltrados.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-state">Sin datos para el período seleccionado</td></tr>';
    return;
  }

  // Mostrar hasta 50 registros
  const datos = [...datosFiltrados].sort((a, b) => b.impacto_economico - a.impacto_economico).slice(0, 50);

  tbody.innerHTML = datos.map(d => {
    const dispColor = d.disponibilidad < 80 ? 'text-red' : d.disponibilidad < 88 ? 'text-amber' : 'text-green';
    const areaCls   = d.area.toLowerCase() === 'mina' ? 'mina' : 'planta';
    return `
      <tr>
        <td>${d.activo}</td>
        <td><span class="badge-area ${areaCls}">${d.area}</span></td>
        <td>${capitalizar(d.tipo_activo)}</td>
        <td>${d.fecha}</td>
        <td class="disponibilidad-cell ${dispColor}">${d.disponibilidad.toFixed(1)}%</td>
        <td class="text-mono text-green">${d.mtbf.toFixed(1)}</td>
        <td class="text-mono text-amber">${d.mttr.toFixed(1)}</td>
        <td class="text-mono">${d.horas_falla}</td>
        <td class="text-mono text-red">${formatMillones(d.impacto_economico)}</td>
      </tr>
    `;
  }).join('');
}

/* ----------------------------------------------------------------
   Módulo de simulación de mejora de disponibilidad
   ---------------------------------------------------------------- */
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
  const resultEl = document.getElementById('sim-result');
  if (!simulacionPct || !datosFiltrados.length) {
    resultEl.innerHTML = `
      <h3>Seleccione un escenario de mejora</h3>
      <p>Elija +1%, +2% o +3% de disponibilidad para calcular el ahorro potencial estimado en el período filtrado.</p>
    `;
    return;
  }

  // Estimación: para cada registro, calcular horas adicionales * costo/hora
  let ahorroTotal = 0;
  datosFiltrados.forEach(d => {
    const dispActual  = d.disponibilidad / 100;
    const dispMejora  = Math.min(1, dispActual + simulacionPct / 100);
    const horasTotales = d.horas_operativas + d.horas_falla;
    const horasGanadas = (dispMejora - dispActual) * horasTotales;
    ahorroTotal += horasGanadas * d.costo_hora_indisponibilidad;
  });

  const nActivos = [...new Set(datosFiltrados.map(d => d.activo))].length;
  resultEl.innerHTML = `
    <h3>Ahorro estimado con +${simulacionPct}% disponibilidad</h3>
    <p>
      Escenario aplicado sobre <strong style="color:var(--text-primary)">${nActivos} activos</strong> 
      y <strong style="color:var(--text-primary)">${datosFiltrados.length} registros</strong> del período filtrado.
      El ahorro se calcula por horas de operación recuperadas × costo unitario de indisponibilidad.
    </p>
    <span class="sim-amount">+ ${formatMillones(ahorroTotal)} USD</span>
  `;
}

/* ----------------------------------------------------------------
   Timestamp
   ---------------------------------------------------------------- */
function actualizarTimestamp() {
  const el = document.getElementById('last-update');
  if (el) {
    const ahora = new Date();
    el.textContent = ahora.toLocaleString('es-CL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }
}

/* ----------------------------------------------------------------
   Opciones base para Chart.js
   ---------------------------------------------------------------- */
function chartOptionsBase({ yLabel = '', yMin = null, yMax = null, refLine = null } = {}) {
  const scales = {
    x: {
      ticks: { color: '#4a6a8a', font: { family: "'Share Tech Mono', monospace", size: 10 }, maxRotation: 30 },
      grid: { color: 'rgba(30,47,72,0.6)' }
    },
    y: {
      ticks: { color: '#4a6a8a', font: { family: "'Share Tech Mono', monospace", size: 10 } },
      grid: { color: 'rgba(30,47,72,0.6)' },
      title: { display: !!yLabel, text: yLabel, color: '#4a6a8a', font: { size: 10 } }
    }
  };

  if (yMin !== null) scales.y.min = yMin;
  if (yMax !== null) scales.y.max = yMax;

  const plugins = {
    legend: {
      labels: { color: '#7a9abf', font: { family: "'Share Tech Mono', monospace", size: 10 }, boxWidth: 12 }
    },
    tooltip: {
      backgroundColor: '#0f1520',
      borderColor: '#1e2f48',
      borderWidth: 1,
      titleColor: '#00d4ff',
      bodyColor: '#7a9abf',
      padding: 10,
    }
  };

  if (refLine) {
    plugins.annotation = {
      annotations: {
        meta: {
          type: 'line',
          yMin: refLine.value, yMax: refLine.value,
          borderColor: refLine.color,
          borderWidth: 1,
          borderDash: [6, 3],
          label: { enabled: true, content: refLine.label, color: refLine.color, font: { size: 9 } }
        }
      }
    };
  }

  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 500 },
    plugins,
    scales
  };
}

/* ----------------------------------------------------------------
   Utilidades
   ---------------------------------------------------------------- */
function promedio(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function agruparPorActivo(datos) {
  return datos.reduce((acc, d) => {
    if (!acc[d.activo]) acc[d.activo] = [];
    acc[d.activo].push(d);
    return acc;
  }, {});
}

function formatFecha(f) {
  const [y, m, d] = f.split('-');
  return `${d}/${m}/${y}`;
}

function formatMillones(val) {
  if (val >= 1e6) return (val / 1e6).toFixed(2) + ' MM';
  if (val >= 1e3) return (val / 1e3).toFixed(0) + ' K';
  return val.toFixed(0);
}

/* ================================================================
   MÓDULO: VISOR DE BASE DE DATOS
   ================================================================ */

let jsonCountActual = 10;
let dbDatosFiltrados = [];

/* ---- Abrir / Cerrar modal ---- */
function abrirModal() {
  const overlay = document.getElementById('db-overlay');
  overlay.classList.add('open');
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

// Cerrar con Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') cerrarModal();
});

/* ---- Inicializar DB con los datos cargados ---- */
function inicializarDB() {
  const datos = todosLosDatos;
  dbDatosFiltrados = [...datos];

  // Metadatos de infobar
  document.getElementById('db-total-registros').textContent = datos.length;
  const bytes = new TextEncoder().encode(JSON.stringify(datos)).length;
  document.getElementById('db-file-size').textContent =
    bytes > 1024 ? (bytes / 1024).toFixed(1) + ' KB' : bytes + ' B';

  renderTablaDB(dbDatosFiltrados);
  renderJsonViewer(jsonCountActual);
  renderEstadisticas(datos);
  actualizarRowCount(dbDatosFiltrados.length, datos.length);
}

/* ---- Switch de tabs ---- */
function switchTab(btn, tabId) {
  document.querySelectorAll('.db-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.db-tab-content').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-' + tabId).classList.add('active');
}

/* ---- Tabla DB ---- */
function renderTablaDB(datos) {
  if (!datos.length) return;

  const columnas = Object.keys(datos[0]);

  // Cabecera
  const thead = document.getElementById('db-thead');
  thead.innerHTML = '<tr><th>#</th>' +
    columnas.map(c => `<th>${c}</th>`).join('') +
  '</tr>';

  // Filas
  const tbody = document.getElementById('db-tbody');
  tbody.innerHTML = datos.map((fila, i) => {
    const celdas = columnas.map(col => {
      let val = fila[col];
      let cls = '';
      if (col === 'disponibilidad') {
        cls = val < 80 ? 'text-red' : val < 88 ? 'text-amber' : 'text-green';
        val = val.toFixed(1) + '%';
      } else if (col === 'impacto_economico') {
        cls = 'text-red';
        val = val.toLocaleString('es-CL');
      } else if (col === 'area') {
        cls = val === 'Mina' ? 'text-purple' : 'text-blue';
      } else if (typeof val === 'number') {
        val = val.toLocaleString('es-CL', { maximumFractionDigits: 2 });
      }
      return `<td class="${cls}">${val}</td>`;
    }).join('');
    return `<tr><td>${i + 1}</td>${celdas}</tr>`;
  }).join('');

  document.getElementById('db-status-text').textContent =
    `Mostrando ${datos.length} registro(s) · Última carga: ${new Date().toLocaleTimeString('es-CL')}`;
}

/* ---- Filtrar tabla DB ---- */
function filtrarTablaDB() {
  const q = document.getElementById('db-search').value.toLowerCase().trim();
  if (!q) {
    dbDatosFiltrados = [...todosLosDatos];
  } else {
    dbDatosFiltrados = todosLosDatos.filter(fila =>
      Object.values(fila).some(v => String(v).toLowerCase().includes(q))
    );
  }
  renderTablaDB(dbDatosFiltrados);
  actualizarRowCount(dbDatosFiltrados.length, todosLosDatos.length);
}

function actualizarRowCount(filtradas, total) {
  document.getElementById('db-row-count').textContent =
    filtradas === total ? `${total} filas` : `${filtradas} de ${total} filas`;
}

/* ---- JSON Viewer con syntax highlighting ---- */
function renderJsonViewer(count) {
  const datos = count ? todosLosDatos.slice(0, count) : todosLosDatos;
  const jsonStr = JSON.stringify(datos, null, 2);
  document.getElementById('db-json-viewer').innerHTML = syntaxHighlight(jsonStr);
  document.getElementById('json-count').textContent = count || todosLosDatos.length;
}

function cambiarJsonCount(n) {
  document.querySelectorAll('.db-json-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  jsonCountActual = n;
  renderJsonViewer(n);
}

function syntaxHighlight(json) {
  return json
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      match => {
        let cls = 'json-num';
        if (/^"/.test(match)) {
          cls = /:$/.test(match) ? 'json-key' : 'json-str';
        } else if (/true|false/.test(match)) {
          cls = 'json-bool';
        } else if (/null/.test(match)) {
          cls = 'json-null';
        }
        return `<span class="${cls}">${match}</span>`;
      }
    );
}

/* ---- Estadísticas por campo numérico ---- */
function renderEstadisticas(datos) {
  const camposNum = ['disponibilidad','mtbf','mttr','horas_operativas','horas_falla',
                     'costo_hora_indisponibilidad','impacto_economico'];

  const grid = document.getElementById('db-stats-grid');
  grid.innerHTML = '';

  camposNum.forEach(campo => {
    const vals = datos.map(d => d[campo]).filter(v => typeof v === 'number');
    if (!vals.length) return;

    const min  = Math.min(...vals);
    const max  = Math.max(...vals);
    const prom = vals.reduce((a,b) => a+b, 0) / vals.length;
    const sorted = [...vals].sort((a,b) => a-b);
    const med  = sorted.length % 2
      ? sorted[Math.floor(sorted.length/2)]
      : (sorted[sorted.length/2 - 1] + sorted[sorted.length/2]) / 2;

    const fmt = v => typeof v === 'number'
      ? v.toLocaleString('es-CL', { maximumFractionDigits: 1 })
      : v;

    grid.innerHTML += `
      <div class="db-stat-card">
        <div class="db-stat-field">${campo}</div>
        <div class="db-stat-row"><span class="db-stat-key">Registros</span><span class="db-stat-val">${vals.length}</span></div>
        <div class="db-stat-row"><span class="db-stat-key">Mínimo</span><span class="db-stat-val">${fmt(min)}</span></div>
        <div class="db-stat-row"><span class="db-stat-key">Máximo</span><span class="db-stat-val">${fmt(max)}</span></div>
        <div class="db-stat-row"><span class="db-stat-key">Promedio</span><span class="db-stat-val text-cyan">${fmt(prom)}</span></div>
        <div class="db-stat-row"><span class="db-stat-key">Mediana</span><span class="db-stat-val">${fmt(med)}</span></div>
      </div>
    `;
  });

  // Cards de campos categóricos
  ['area','tipo_activo','activo'].forEach(campo => {
    const conteo = {};
    datos.forEach(d => {
      const v = d[campo];
      conteo[v] = (conteo[v] || 0) + 1;
    });
    const unicos = Object.keys(conteo).length;
    const top = Object.entries(conteo).sort((a,b)=>b[1]-a[1]).slice(0,4);

    grid.innerHTML += `
      <div class="db-stat-card">
        <div class="db-stat-field">${campo}</div>
        <div class="db-stat-row"><span class="db-stat-key">Valores únicos</span><span class="db-stat-val">${unicos}</span></div>
        ${top.map(([v,c]) => `
          <div class="db-stat-row">
            <span class="db-stat-key">${v.length > 16 ? v.substring(0,14)+'…' : v}</span>
            <span class="db-stat-val">${c} registros</span>
          </div>
        `).join('')}
      </div>
    `;
  });
}
