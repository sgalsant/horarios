import { state } from './state.js';
import { getSubjectColorClass } from './utils.js';

export function showMultiGroupView() {
    const scheduleContainer = document.getElementById('scheduleContainer');
    scheduleContainer.innerHTML = '<div id="multi-group-schedules"></div>';
    const multiGroupContainer = document.getElementById('multi-group-schedules');

    const selectedGroups = Array.from(document.querySelectorAll('#group-selector-container input[type="checkbox"]:checked'))
                                .map(cb => cb.value);

    if (selectedGroups.length === 0) {
        multiGroupContainer.innerHTML = '<p>Seleccione uno o más grupos para ver los horarios.</p>';
        return;
    }

    multiGroupContainer.innerHTML = ''; // Limpiar antes de renderizar

    selectedGroups.forEach(groupId => {
        const group = state.groups[groupId];
        if (group) {
            const scheduleElement = document.createElement('div');
            scheduleElement.className = 'schedule-section';
            scheduleElement.innerHTML = `
                <h3>${group.name} (${group.shift === 'morning' ? 'Mañana' : 'Tarde'})</h3>
                <table class="scheduleTable schedule-table-common">
                    <thead>
                        <tr>
                            <th>Hora</th>
                            <th>Lunes</th>
                            <th>Martes</th>
                            <th>Miércoles</th>
                            <th>Jueves</th>
                            <th>Viernes</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            `;
            const tbody = scheduleElement.querySelector('tbody');
            
            // Re-crear la estructura de la tabla para cada grupo
            const PERIODS = ['1º', '2º', '3º', 'Recreo', '4º', '5º', '6º'];
            const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

            PERIODS.forEach((period, i) => {
                const row = document.createElement('tr');
                row.innerHTML = `<td>${period}</td>`;
                
                DAYS.forEach((day, j) => {
                    if (period === 'Recreo') {
                        if (day === 'Lunes') {
                            row.innerHTML += '<td colspan="5" style="text-align: center; background-color: #f5f5f5;">Recreo</td>';
                        }
                    } else {
                        const cell = document.createElement('td');
                        cell.className = 'schedule-cell';
                        cell.dataset.day = day;
                        cell.dataset.period = i;

                        const item = group.schedule?.[day]?.[i];
                        const parsed = item ? (typeof item === 'string' ? JSON.parse(item) : item) : null;

                        if (parsed) {
                            cell.textContent = `${parsed.name} (${parsed.teacher})`;
                            cell.classList.add(getSubjectColorClass(parsed.name));
                        } else {
                            cell.textContent = '-';
                        }
                        row.appendChild(cell);
                    }
                });
                tbody.appendChild(row);
            });

            multiGroupContainer.appendChild(scheduleElement);
        }
    });
}