import { state, DAYS, PERIODS } from './state.js';
import { getSubjectColorClass } from './utils.js';

export function showMultiGroupView() {
    const viewType = document.getElementById('multiViewType').value;
    const shiftFilter = document.getElementById('shiftFilter').value;
    const container = document.getElementById('scheduleContainer');
    container.innerHTML = '';

    if (viewType === 'groups') {
        renderGroupsView(container, shiftFilter);
    } else {
        renderTeachersView(container, shiftFilter);
    }
}

function renderGroupsView(container, shiftFilter) {
    const filteredGroups = Object.values(state.groups).filter(group => 
        shiftFilter === 'all' || group.shift === shiftFilter
    ).sort((a, b) => a.name.localeCompare(b.name));

    if (filteredGroups.length === 0) {
        container.innerHTML = '<p>No hay grupos que coincidan con el filtro.</p>';
        return;
    }

    filteredGroups.forEach(group => {
        const scheduleTable = createScheduleTableDOM(group.name);
        container.appendChild(scheduleTable);
        populateGroupSchedule(scheduleTable.querySelector('tbody'), group);
    });
}

function renderTeachersView(container, shiftFilter) {
    const teachers = [...new Set(Object.values(state.groups).flatMap(g => g.subjects.map(s => s.teacher)))].filter(Boolean).sort();

    if (teachers.length === 0) {
        container.innerHTML = '<p>No hay profesores definidos.</p>';
        return;
    }

    teachers.forEach(teacher => {
        const teacherScheduleData = getTeacherSchedule(teacher);
        const morningSchedule = filterScheduleByShift(teacherScheduleData, 'morning');
        const afternoonSchedule = filterScheduleByShift(teacherScheduleData, 'afternoon');

        const shouldShowMorning = (shiftFilter === 'all' || shiftFilter === 'morning') && Object.keys(morningSchedule).length > 0;
        const shouldShowAfternoon = (shiftFilter === 'all' || shiftFilter === 'afternoon') && Object.keys(afternoonSchedule).length > 0;

        if (shouldShowMorning || shouldShowAfternoon) {
            const teacherContainer = document.createElement('div');
            teacherContainer.className = 'teacher-schedule-container';
            teacherContainer.innerHTML = `<h2>${teacher}</h2>`;
            
            if (shouldShowMorning) {
                const morningTable = createScheduleTableDOM('Turno de Mañana');
                teacherContainer.appendChild(morningTable);
                populateTeacherSchedule(morningTable.querySelector('tbody'), morningSchedule);
            }
            if (shouldShowAfternoon) {
                const afternoonTable = createScheduleTableDOM('Turno de Tarde');
                teacherContainer.appendChild(afternoonTable);
                populateTeacherSchedule(afternoonTable.querySelector('tbody'), afternoonSchedule);
            }
            container.appendChild(teacherContainer);
        }
    });
}

function createScheduleTableDOM(title) {
    const section = document.createElement('div');
    section.className = 'schedule-section';
    section.innerHTML = `
        <h3>${title}</h3>
        <table class="scheduleTable schedule-table-common">
            <thead><tr><th>Hora</th>${DAYS.map(day => `<th>${day}</th>`).join('')}</tr></thead>
            <tbody></tbody>
        </table>
    `;
    return section;
}

function populateGroupSchedule(tbody, group) {
    PERIODS.forEach((period, i) => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${period}</td>`;
        if (period === 'Recreo') {
            row.innerHTML = `<td colspan="6" class="recreo-cell">Recreo</td>`;
            tbody.appendChild(row);
            return;
        }
        DAYS.forEach(day => {
            const cell = document.createElement('td');
            const cellData = group.schedule?.[day]?.[i] ? JSON.parse(group.schedule[day][i]) : null;
            if (cellData) {
                cell.textContent = `${cellData.name} (${cellData.teacher})`;
                cell.className = getSubjectColorClass(cellData.name);
            } else {
                cell.textContent = '-';
            }
            row.appendChild(cell);
        });
        tbody.appendChild(row);
    });
}

function populateTeacherSchedule(tbody, schedule) {
    PERIODS.forEach((period, i) => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${period}</td>`;
        if (period === 'Recreo') {
            row.innerHTML = `<td colspan="6" class="recreo-cell">Recreo</td>`;
            tbody.appendChild(row);
            return;
        }
        DAYS.forEach(day => {
            const cell = document.createElement('td');
            const cellData = schedule?.[day]?.[i] ? JSON.parse(schedule[day][i]) : null;
            if (cellData) {
                cell.textContent = `${cellData.name} (${cellData.groupName})`;
                cell.className = getSubjectColorClass(cellData.name);
            } else {
                cell.textContent = '-';
            }
            row.appendChild(cell);
        });
        tbody.appendChild(row);
    });
}

function getTeacherSchedule(teacher) {
    const schedule = {};
    Object.values(state.groups).forEach(group => {
        if (!group.schedule) return;
        Object.entries(group.schedule).forEach(([day, daySchedule]) => {
            Object.entries(daySchedule).forEach(([periodIndex, cellData]) => {
                const parsed = cellData ? JSON.parse(cellData) : null;
                if (parsed && parsed.teacher === teacher) {
                    if (!schedule[day]) schedule[day] = {};
                    schedule[day][periodIndex] = JSON.stringify({ ...parsed, groupName: group.name, shift: group.shift });
                }
            });
        });
    });
    return schedule;
}

function filterScheduleByShift(schedule, shift) {
    const filteredSchedule = {};
    Object.entries(schedule).forEach(([day, daySchedule]) => {
        Object.entries(daySchedule).forEach(([periodIndex, cellData]) => {
            const parsed = JSON.parse(cellData);
            if (parsed.shift === shift) {
                if (!filteredSchedule[day]) filteredSchedule[day] = {};
                filteredSchedule[day][periodIndex] = cellData;
            }
        });
    });
    return filteredSchedule;
}