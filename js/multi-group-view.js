import { state, DAYS, PERIODS, saveState } from './state.js';
import { getSubjectColorClass } from './utils.js';
import { updateScheduleOptions } from './group-management.js';
import { updateTeacherScheduleOptions, saveTeacherScheduleChange } from './teacher-view.js';
import { checkConflicts } from './conflicts.js';

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
        const scheduleTable = createScheduleTableDOM(group.name, group);
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
                const morningTable = createScheduleTableDOM('Turno de Mañana', { shift: 'morning' });
                teacherContainer.appendChild(morningTable);
                populateTeacherSchedule(morningTable.querySelector('tbody'), morningSchedule, teacher, 'morning');
            }
            if (shouldShowAfternoon) {
                const afternoonTable = createScheduleTableDOM('Turno de Tarde', { shift: 'afternoon' });
                teacherContainer.appendChild(afternoonTable);
                populateTeacherSchedule(afternoonTable.querySelector('tbody'), afternoonSchedule, teacher, 'afternoon');
            }
            container.appendChild(teacherContainer);
        }
    });
}

function createScheduleTableDOM(title, group) {
    const section = document.createElement('div');
    section.className = 'schedule-section';
    let shiftText = '';
    if (group) {
        const shiftName = group.shift === 'morning' ? 'Mañana' : 'Tarde';
        shiftText = ` (${shiftName})`;
    }
    section.innerHTML = `
        <h3>${title}${shiftText}</h3>
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
            cell.className = 'schedule-cell';
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'cell-content';
            
            let cellData = null;
            if (group.schedule?.[day]?.[i]) {
                const parsed = JSON.parse(group.schedule[day][i]);
                cellData = {
                    teacher: parsed.teacher,
                    name: parsed.name
                };
                contentDiv.textContent = `${cellData.name} (${cellData.teacher})`;
                cell.classList.add(getSubjectColorClass(cellData.name));
            } else {
                contentDiv.textContent = '-';
            }
            contentDiv.dataset.originalValue = JSON.stringify(cellData);
            cell.appendChild(contentDiv);
            
            // Agregar funcionalidad de edición como en la vista de grupo
            const select = document.createElement('select');
            select.style.display = 'none';
            select.dataset.day = day;
            select.dataset.period = i;
            select.dataset.group = group.name;
            cell.appendChild(select);
            
            contentDiv.addEventListener('click', () => {
                const originalValue = contentDiv.dataset.originalValue ? JSON.parse(contentDiv.dataset.originalValue) : null;
                select.dataset.originalValue = contentDiv.dataset.originalValue;
                updateScheduleOptions(select, group);
                
                if (originalValue) {
                    // Buscar la opción que coincida con los datos originales
                    const options = Array.from(select.options);
                    const matchingOption = options.find(opt => {
                        if (!opt.value) return false;
                        const optValue = JSON.parse(opt.value);
                        return optValue.teacher === originalValue.teacher && 
                               optValue.name === originalValue.name;
                    });
                    if (matchingOption) {
                        select.value = matchingOption.value;
                    }
                }
                
                select.style.display = 'block';
                contentDiv.style.display = 'none';
                select.focus();
            });

            select.addEventListener('blur', () => {
                select.style.display = 'none';
                contentDiv.style.display = 'block';
            });

            select.addEventListener('change', () => {
                const selectedValue = select.value;
                
                if (selectedValue) {
                    const value = JSON.parse(selectedValue);
                    const { teacher, name } = value;
                    
                    if (!group.schedule) group.schedule = {};
                    if (!group.schedule[day]) group.schedule[day] = {};
                    
                    const newData = { teacher, name };
                    group.schedule[day][i] = JSON.stringify(newData);
                    contentDiv.dataset.originalValue = JSON.stringify(newData);
                    
                    contentDiv.textContent = `${name} (${teacher})`;
                    cell.className = 'schedule-cell ' + getSubjectColorClass(name);
                } else {
                    // Si no hay valor seleccionado, limpiar la celda
                    if (group.schedule?.[day]?.[i]) {
                        group.schedule[day][i] = null;
                    }
                    contentDiv.textContent = '-';
                    cell.className = 'schedule-cell';
                    contentDiv.dataset.originalValue = 'null';
                }
                
                select.style.display = 'none';
                contentDiv.style.display = 'block';
                saveState();
                checkConflicts();
            });

            row.appendChild(cell);
        });
        tbody.appendChild(row);
    });
}

function populateTeacherSchedule(tbody, schedule, teacher, shift) {
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
            cell.className = 'schedule-cell';
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'cell-content';
            
            let cellData = schedule?.[day]?.[i] ? JSON.parse(schedule[day][i]) : null;
            const blockKey = `${teacher}-${day}-${i}`;
            const block = state.teacherBlocks[teacher]?.[blockKey];

            if (block) {
                cellData = { blocked: true, reason: block.reason };
                contentDiv.textContent = block.reason || 'Bloqueado';
                cell.classList.add('blocked-cell');
            } else if (cellData) {
                contentDiv.textContent = `${cellData.name} (${cellData.groupName})`;
                cell.classList.add(getSubjectColorClass(cellData.name));
            } else {
                contentDiv.textContent = '-';
            }
            contentDiv.dataset.originalValue = JSON.stringify(cellData);
            cell.appendChild(contentDiv);
            
            // Agregar funcionalidad de edición como en la vista de profesor
            const select = document.createElement('select');
            select.style.display = 'none';
            select.dataset.day = day;
            select.dataset.period = i;
            cell.appendChild(select);

            contentDiv.addEventListener('click', () => {
                updateTeacherScheduleOptions(select, teacher, shift);
                select.style.display = 'block';
                select.dataset.originalValue = contentDiv.dataset.originalValue;
                contentDiv.style.display = 'none';
                select.focus();
            });

            let isChanging = false;

            select.addEventListener('blur', () => {
                if (!isChanging) {
                    select.style.display = 'none';
                    contentDiv.style.display = 'block';
                }
            });

            select.addEventListener('change', () => {
                isChanging = true;
                const selectedValue = select.value;
                if (selectedValue === 'BLOCKED') {
                    const blockModal = document.getElementById('blockModal');
                    const blockReasonInput = document.getElementById('blockReason');
                    const blockTypeInput = document.getElementById('blockType');
                    const existingBlock = state.teacherBlocks[teacher]?.[blockKey];

                    if (existingBlock) {
                        blockReasonInput.value = existingBlock.reason;
                        blockTypeInput.value = existingBlock.type;
                    } else {
                        blockReasonInput.value = '';
                        blockTypeInput.value = 'lectivo';
                    }

                    blockModal.dataset.teacher = teacher;
                    blockModal.dataset.day = day;
                    blockModal.dataset.period = i;
                    blockModal.dataset.shift = shift;
                    blockModal.style.display = 'block';
                } else {
                    const value = selectedValue ? JSON.parse(selectedValue) : null;
                    saveTeacherScheduleChange(teacher, day, i, value);
                    select.style.display = 'none';
                    contentDiv.style.display = 'block';
                    showMultiGroupView();
                }
            });

            row.appendChild(cell);
        });
        tbody.appendChild(row);
    });
}

function getTeacherSchedule(teacher) {
    const schedule = {};
    
    // Primero añadimos los bloqueos del profesor
    if (state.teacherBlocks[teacher]) {
        Object.entries(state.teacherBlocks[teacher]).forEach(([blockKey, blockData]) => {
            const [_, day, periodIndex] = blockKey.split('-');
            if (!schedule[day]) schedule[day] = {};
            schedule[day][periodIndex] = JSON.stringify({
                blocked: true,
                reason: blockData.reason,
                type: blockData.type,
                shift: blockData.shift
            });
        });
    }
    
    // Luego añadimos las asignaciones de materias
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

function showTeacherSchedule(scheduleData) {
    const container = document.getElementById('scheduleContainer');
    container.innerHTML = '';

    for (const teacher in scheduleData) {
        const teacherScheduleContainer = document.createElement('div');
        teacherScheduleContainer.className = 'schedule-container';
        teacherScheduleContainer.innerHTML = `<h3>${teacher}</h3>`;
        const table = document.createElement('table');
        table.className = 'schedule-table';
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th>Periodo</th>
                <th>Lunes</th>
                <th>Martes</th>
                <th>Miércoles</th>
                <th>Jueves</th>
                <th>Viernes</th>
            </tr>
        `;
        table.appendChild(thead);
        const tbody = document.createElement('tbody');
        // Determinar el turno basado en los horarios del profesor
        const shift = determineTeacherShift(scheduleData[teacher]);
        populateTeacherSchedule(tbody, scheduleData[teacher], teacher, shift);
        table.appendChild(tbody);
        teacherScheduleContainer.appendChild(table);
        container.appendChild(teacherScheduleContainer);
    }
}

function determineTeacherShift(schedule) {
    // Buscar alguna asignación en los períodos matutinos (0-4)
    const hasMorning = Object.values(schedule).some(daySchedule => {
        return daySchedule.slice(0, 5).some(period => period !== null);
    });

    // Buscar alguna asignación en los períodos vespertinos (6-10)
    const hasAfternoon = Object.values(schedule).some(daySchedule => {
        return daySchedule.slice(6, 11).some(period => period !== null);
    });

    // Si tiene asignaciones en la mañana pero no en la tarde, es matutino
    if (hasMorning && !hasAfternoon) {
        return 'matutino';
    }
    // Si tiene asignaciones en la tarde pero no en la mañana, es vespertino
    if (!hasMorning && hasAfternoon) {
        return 'vespertino';
    }
    // Si tiene asignaciones en ambos turnos o no tiene asignaciones, asumimos matutino por defecto
    return 'matutino';
}