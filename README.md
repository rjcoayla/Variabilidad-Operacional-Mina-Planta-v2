# Modelo Predictivo de Disponibilidad y Confiabilidad de Activos Críticos

> Dashboard web para la gestión de confiabilidad operacional en **Gran Minería del Cobre**.  
> Monitoreo de KPIs de disponibilidad, MTBF, MTTR e impacto económico por indisponibilidad de activos críticos.

---

## Descripción

Este dashboard permite al área de mantenimiento y operaciones de una faena minera monitorear en tiempo real (o diferido) el comportamiento de los activos críticos, identificar los equipos con mayor riesgo operacional y simular el impacto económico de mejoras en disponibilidad.

El diseño sigue la estética de **sala de control industrial**: tema oscuro, acentos cian/verde/ámbar/rojo, tipografía técnica y sin interferencia visual.

---

## Estructura de archivos

```
mineria-dashboard/
│
├── index.html                   # Punto de entrada principal
├── README.md                    # Este archivo
│
├── css/
│   └── styles.css               # Estilos – CSS Grid + variables + responsive
│
├── js/
│   └── app.js                   # Lógica: filtros, KPIs, Chart.js, simulación
│
└── data/
    └── confiabilidad_activos.json  # Dataset de ejemplo (20 registros simulados)
```

---

## KPIs mostrados

| KPI | Descripción | Unidad |
|-----|-------------|--------|
| **Disponibilidad promedio** | Porcentaje promedio de tiempo operativo sobre total de horas del período | % |
| **MTBF promedio** | Mean Time Between Failures – tiempo promedio entre fallas consecutivas | Horas |
| **MTTR promedio** | Mean Time To Repair – tiempo promedio de reparación o restauración | Horas |
| **Impacto económico acumulado** | Costo total por indisponibilidad = horas de falla × costo unitario por hora | USD |

---

## Gráficos

- **Disponibilidad vs Tiempo** (línea): evolución temporal de la disponibilidad promedio del conjunto de activos filtrados. Incluye línea de meta al 90%.
- **MTBF vs MTTR por activo** (barras agrupadas): comparación de tiempos entre fallas y de reparación por activo.
- **Ranking de criticidad por impacto económico** (barras horizontales): ordena los activos de mayor a menor impacto. Colorea según semáforo (rojo = crítico, ámbar = alerta, verde = normal).

---

## Filtros disponibles

| Filtro | Descripción |
|--------|-------------|
| Fecha desde / hasta | Rango de fechas del período de análisis |
| Área operacional | Mina o Planta |
| Tipo de activo | Camión, pala, molino, faja, perforadora, etc. |
| Activo específico | Selección individual de equipo |
| **Chips rápidos** | "Últimos 7 días", "Últimos 30 días", "Top 5 Críticos" |

---

## Panel de riesgo y semáforo

Muestra los activos ordenados por mayor criticidad (impacto económico + baja disponibilidad):

- 🟢 **Verde**: disponibilidad ≥ 88% — operación normal
- 🟡 **Ámbar**: disponibilidad entre 80% y 88% — en alerta
- 🔴 **Rojo**: disponibilidad < 80% — estado crítico

Incluye un **insight automático** que identifica el activo más crítico del período filtrado y recomienda priorizar su mantenimiento.

---

## Módulo de simulación

Permite estimar el **ahorro económico potencial** si se mejora la disponibilidad de los activos filtrados en +1%, +2% o +3%.

El cálculo es:
```
Horas ganadas = Δ% disponibilidad × (horas operativas + horas de falla)
Ahorro estimado = Horas ganadas × costo por hora de indisponibilidad
```

---

## Estructura del JSON de datos

Cada registro en `data/confiabilidad_activos.json` contiene:

```json
{
  "fecha": "2024-01-05",
  "area": "Mina",
  "activo": "Pala Eléctrica P&H 4100",
  "tipo_activo": "pala",
  "disponibilidad": 76.8,
  "mtbf": 44.6,
  "mttr": 13.5,
  "horas_operativas": 384,
  "horas_falla": 116,
  "costo_hora_indisponibilidad": 55000,
  "impacto_economico": 6380000
}
```

> ⚠️ **Nota**: Los datos incluidos son completamente **simulados con fines demostrativos**. No representan información real de ninguna operación minera.

---

## Activos de ejemplo incluidos

| Activo | Tipo | Área |
|--------|------|------|
| Molino SAG 01 / 02 | Molino | Planta |
| Molino de Bolas 01 | Molino | Planta |
| Faja Transportadora 03 | Faja | Planta |
| Pala Eléctrica P&H 4100 | Pala | Mina |
| Camión 793F-01 / 02 | Camión | Mina |
| Perforadora DML-1200 | Perforadora | Mina |

---

## Cómo ejecutar

### Opción A – Abrir directamente (recomendado para pruebas locales)

```bash
# 1. Clonar o descargar el repositorio
git clone https://github.com/tu-usuario/mineria-dashboard.git
cd mineria-dashboard

# 2. Levantar un servidor local (requerido para fetch() del JSON)
python3 -m http.server 8080
# o con Node.js:
npx serve .

# 3. Abrir en el navegador
http://localhost:8080
```

> **Importante**: `index.html` no puede abrirse directamente desde el sistema de archivos (`file://`) porque el navegador bloqueará la carga del JSON por política CORS. Es necesario un servidor local.

### Opción B – GitHub Pages

1. Subir el proyecto a un repositorio GitHub.
2. Ir a **Settings → Pages → Source → main branch → / (root)**.
3. El dashboard estará disponible en `https://tu-usuario.github.io/mineria-dashboard/`.

---

## Tecnologías utilizadas

| Tecnología | Uso |
|------------|-----|
| HTML5 semántico | Estructura del dashboard |
| CSS Grid + Custom Properties | Layout responsive y tema visual |
| [Chart.js v4](https://www.chartjs.org/) | Gráficos de línea, barras y barras horizontales |
| JavaScript ES2022 (Vanilla) | Lógica, filtros, cálculos y simulación |
| Google Fonts (Rajdhani, Share Tech Mono, Exo 2) | Tipografía técnica industrial |

Sin dependencias de framework. Sin backend requerido.

---

## Responsive

| Pantalla | Layout |
|----------|--------|
| **Desktop** (>1024px) | 4 KPIs en fila, 2 gráficos en paralelo, panel riesgo + tabla |
| **Tablet** (640–1024px) | 2 KPIs por fila, gráficos apilados |
| **Móvil** (<640px) | 1 elemento por fila, scroll vertical |

---

## Licencia

Proyecto de demostración técnica. Datos completamente simulados.  
Uso libre para entornos de prueba y desarrollo.
