import { state, DAYS, PERIODS } from './state.js';

export function checkConflicts() {
    const conflicts = [];
    const teacherSchedule = {};

    DAYS.forEach(day => {
        teacherSchedule[day] = {};
        PERIODS.forEach((_, periodIndex) => {
            teacherSchedule[day][periodIndex] = new Set();
        });
    });

    // Registrar todos los horarios de profesores
    Object.values(state.groups).forEach(group => {
        DAYS.forEach(day => {
            if (group.schedule && group.schedule[day]) {
                Object.entries(group.schedule[day]).forEach(([period, cellData]) => {
                    if (cellData) {
                        const data = typeof cellData === 'string' ? JSON.parse(cellData) : cellData;
                        if (data && data.teacher) {
                            teacherSchedule[day][period].add(data.teacher);
                        }
                    }
                });
            }
        });
    });

    // Verificar conflictos
    DAYS.forEach(day => {
        PERIODS.forEach((_, periodIndex) => {
            const teachers = teacherSchedule[day][periodIndex];
            if (teachers.size > 1) {
                conflicts.push({
                    day,
                    period: periodIndex,
                    teachers: Array.from(teachers)
                });
            }
        });
    });

    // Mostrar conflictos en la UI
    displayConflicts(conflicts);
}

function displayConflicts(conflicts) {
    const container = document.getElementById('conflictsContainer');
    if (!container) return;

    if (conflicts.length === 0) {
        container.innerHTML = '<p class="no-conflicts">No hay conflictos</p>';
        return;
    }

    container.innerHTML = `
        <h3>Conflictos detectados:</h3>
        <ul class="conflicts-list">
            ${conflicts.map(conflict => `
                <li>
                    ${conflict.day}, ${PERIODS[conflict.period]}: 
                    ${conflict.teachers.join(', ')}
                </li>
            `).join('')}
        </ul>
    `;
}
