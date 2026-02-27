let datosGlobal = [];
let chartPlanReal, chartVariabilidad, chartScatter;

document.addEventListener("DOMContentLoaded", () => {
    cargarDatos();
    document.getElementById("resetFiltros").addEventListener("click", resetFiltros);
});

async function cargarDatos() {
    const response = await fetch("../data/variabilidad_mina_planta.json");
    datosGlobal = await response.json();
    inicializarFiltros();
    actualizarDashboard();
}

function inicializarFiltros() {
    const turnos = [...new Set(datosGlobal.map(d => d.Turno))];
    const selectTurno = document.getElementById("turnoFilter");
    selectTurno.innerHTML = `<option value="">Todos</option>`;
    turnos.forEach(t => {
        selectTurno.innerHTML += `<option value="${t}">${t}</option>`;
    });
    selectTurno.addEventListener("change", actualizarDashboard);
}

function filtrarDatos() {
    const turno = document.getElementById("turnoFilter").value;
    return datosGlobal.filter(d => !turno || d.Turno === turno);
}

function actualizarDashboard() {
    const datos = filtrarDatos();
    actualizarKPIs(datos);
    actualizarGraficos(datos);
    actualizarOutliers(datos);
}

function actualizarKPIs(datos) {
    const totalPlan = datos.reduce((a,b)=>a+b.Toneladas_Plan,0);
    const totalReal = datos.reduce((a,b)=>a+b.Toneladas_Real,0);
    const impacto = datos.reduce((a,b)=>a+b.Impacto_Económico,0);

    const desviacionStd = calcularDesviacionStd(datos.map(d=>d.Toneladas_Real));

    document.getElementById("kpiProduccion").innerHTML =
        `<h3>Producción Real</h3><p>${totalReal.toFixed(0)} t</p>`;

    document.getElementById("kpiCumplimiento").innerHTML =
        `<h3>% Cumplimiento</h3><p>${((totalReal/totalPlan)*100).toFixed(1)}%</p>`;

    document.getElementById("kpiDesviacion").innerHTML =
        `<h3>Desviación Std</h3><p>${desviacionStd.toFixed(2)}</p>`;

    document.getElementById("kpiImpacto").innerHTML =
        `<h3>Impacto Económico</h3><p>$${impacto.toFixed(0)}</p>`;
}

function calcularDesviacionStd(arr) {
    const mean = arr.reduce((a,b)=>a+b,0)/arr.length;
    return Math.sqrt(arr.reduce((a,b)=>a+(b-mean)**2,0)/arr.length);
}

function actualizarGraficos(datos) {
    const fechas = datos.map(d=>d.Fecha);
    const plan = datos.map(d=>d.Toneladas_Plan);
    const real = datos.map(d=>d.Toneladas_Real);

    if(chartPlanReal) chartPlanReal.destroy();

    chartPlanReal = new Chart(document.getElementById("chartPlanReal"), {
        type: "line",
        data: {
            labels: fechas,
            datasets: [
                { label: "Plan", data: plan, borderColor: "#00bcd4" },
                { label: "Real", data: real, borderColor: "#ff9800" }
            ]
        },
        options: { responsive: true }
    });
}

function actualizarOutliers(datos) {
    const tbody = document.querySelector("#tablaOutliers tbody");
    tbody.innerHTML = "";

    const top = datos
        .sort((a,b)=>Math.abs(b.Toneladas_Real-b.Toneladas_Plan)-
                     Math.abs(a.Toneladas_Real-a.Toneladas_Plan))
        .slice(0,5);

    top.forEach(d=>{
        const row = `<tr>
            <td>${d.Fecha}</td>
            <td>${d.Turno}</td>
            <td>${d.Toneladas_Plan}</td>
            <td>${d.Toneladas_Real}</td>
            <td>${(d.Toneladas_Real-d.Toneladas_Plan).toFixed(0)}</td>
            <td>${d.Impacto_Económico}</td>
        </tr>`;
        tbody.innerHTML += row;
    });
}

function resetFiltros() {
    document.getElementById("turnoFilter").value="";
    actualizarDashboard();
}