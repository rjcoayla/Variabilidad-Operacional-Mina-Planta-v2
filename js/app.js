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
