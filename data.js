// data.js

function generateOperationalData() {
    const data = [];
    const startDate = new Date(new Date().getFullYear() - 1, 0, 1);
    const criticalEquipments = ['Molino SAG 1', 'Pala 5', 'Camión CAEX 21', 'Espesador Cobre', 'Chancador Primario'];
    const areas = ['Mina', 'Planta'];

    // Simulate major failure events
    const failureEvents = [
        { equipment: 'Molino SAG 1', startDay: 45, duration: 5, impact: 0.6 },
        { equipment: 'Pala 5', startDay: 120, duration: 3, impact: 0.4 },
        { equipment: 'Chancador Primario', startDay: 250, duration: 7, impact: 0.7 },
    ];

    for (let i = 0; i < 365; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);

        // Simulate for Day and Night shifts
        for (const shift of ['Día', 'Noche']) {
            const dateStr = currentDate.toISOString().split('T')[0];
            
            // Base plan with slight seasonality (sinusoidal wave)
            const basePlan = 80000;
            const seasonalFactor = 1 + 0.05 * Math.sin((i / 365) * 2 * Math.PI);
            let planProduction = basePlan * seasonalFactor;

            let equipmentAvailability = 93 + Math.random() * 4; // Base availability 93-97%
            let utilization = 88 + Math.random() * 4; // Base utilization 88-92%
            let criticalEquipment = 'N/A';

            // Apply failure events
            for (const event of failureEvents) {
                if (i >= event.startDay && i < event.startDay + event.duration) {
                    equipmentAvailability *= (1 - event.impact * (1 - (i - event.startDay) / event.duration));
                    criticalEquipment = event.equipment;
                }
            }
            
            // Night shift has higher variability and slightly lower performance
            const shiftFactor = shift === 'Noche' ? 0.97 : 1.0;
            const randomVariability = 1 - (shift === 'Noche' ? Math.random() * 0.15 : Math.random() * 0.08);

            let actualProduction = planProduction * (equipmentAvailability / 95) * (utilization / 90) * shiftFactor * randomVariability;
            
            const deviation = ((actualProduction - planProduction) / planProduction) * 100;
            const estimatedDeviationCost = deviation < 0 ? Math.abs(actualProduction - planProduction) * 50 : 0; // $50 cost per ton of deviation
            
            const variabilityIndex = 100 - Math.abs(deviation);

            let mtbf = equipmentAvailability > 50 ? 200 + (equipmentAvailability - 90) * 10 + Math.random() * 20 : 50 + Math.random() * 20;
            let mttr = equipmentAvailability < 95 ? 8 - (equipmentAvailability - 80) / 5 + Math.random() * 2 : 2 + Math.random();
            mtbf = Math.max(10, mtbf);
            mttr = Math.max(1, mttr);

            let area = criticalEquipments.slice(1, 3).includes(criticalEquipment) ? 'Mina' : 'Planta';
            if (criticalEquipment === 'N/A') {
                 area = i % 2 === 0 ? 'Planta' : 'Mina';
            }

            const copperGrade = 0.8 + Math.random() * 0.4; // 0.8% - 1.2%

            data.push({
                date: dateStr,
                planProduction: Math.round(planProduction),
                actualProduction: Math.round(actualProduction),
                deviation: parseFloat(deviation.toFixed(2)),
                variabilityIndex: parseFloat(variabilityIndex.toFixed(2)),
                availability: parseFloat(equipmentAvailability.toFixed(2)),
                utilization: parseFloat(utilization.toFixed(2)),
                mtbf: Math.round(mtbf),
                mttr: parseFloat(mttr.toFixed(1)),
                copperGrade: parseFloat(copperGrade.toFixed(2)),
                processedTons: Math.round(actualProduction),
                cost: Math.round(estimatedDeviationCost),
                shift: shift,
                area: area,
                criticalEquipment: criticalEquipment
            });
        }
    }
    return data;
}

// Make it available globally
window.operationalData = generateOperationalData();
