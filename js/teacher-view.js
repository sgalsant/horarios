import { state, DAYS, PERIODS, saveState } from './state.js';
import { updateSubjectSummary } from './subject-management.js';
import { checkConflicts } from './conflicts.js';
import { createScheduleStructure } from './schedule-view.js';
import { getSubjectColorClass } from './utils.js';

export function updateTeacherView() {
    const teacher = teacherSelect.value;
    const scheduleContainer = document.getElementById('scheduleContainer');
    
    if (!teacher) {
        scheduleContainer.innerHTML = `
            <div style="text-align: center; margin-top: 20px;">
                <p>Seleccione un profesor para ver su horario</p>
            </div>
        `;
        if (subjectSummary) {
            subjectSummary.innerHTML = '';
        }
        return;
    }

    const morningGroups = [];
    const afternoonGroups = [];
    Object.entries(state.groups).forEach(([groupId, group]) => {
        if (group.subjects.some(subject => subject.teacher === teacher)) {
            if (group.shift === 'morning') {
                morningGroups.push({ ...group, id: groupId });
            } else {
                afternoonGroups.push({ ...group, id: groupId });
            }
        }
    });

    scheduleContainer.innerHTML = `
        <div id="teacher-schedules">
            ${morningGroups.length > 0 ? `
                <div class="schedule-section">
                    <h3>Horario de Mañana</h3>
                    <table class="scheduleTable morning-schedule schedule-table-common">
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
                </div>
            ` : ''}
            ${afternoonGroups.length > 0 ? `
                <div class="schedule-section">
                    <h3>Horario de Tarde</h3>
                    <table class="scheduleTable afternoon-schedule schedule-table-common">
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
                </div>
            ` : ''}
        </div>
        <div id="subjectSummary"></div>
    `;

    const morningTbody = scheduleContainer.querySelector('.morning-schedule tbody');
    const afternoonTbody = scheduleContainer.querySelector('.afternoon-schedule tbody');

    createScheduleStructure(morningTbody);
    createScheduleStructure(afternoonTbody);

    setupTeacherCells(morningGroups, afternoonGroups);
}

function generateScheduleSection(shift) {
    return `
        <div class="schedule-section">
            <h3>Horario de ${shift === 'morning' ? 'Mañana' : 'Tarde'}</h3>
            <table class="scheduleTable ${shift}-schedule schedule-table-common">
                <thead>
                    <tr>
                        <th>Hora</th>
                        ${DAYS.map(day => `<th>${day}</th>`).join('')}
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        </div>
    `;
}

export function showBlockModalForTeacher(teacher, day, period, isMorning) {
    const blockKey = `${teacher}-${day}-${period}`;
    const block = state.teacherBlocks[teacher]?.[blockKey];

    blockReason.value = block ? block.reason : '';
    document.getElementById('blockType').value = block ? block.type : 'lectivo';
    
    blockModal.style.display = 'block';
    
    blockModal.dataset.teacher = teacher;
    blockModal.dataset.day = day;
    blockModal.dataset.period = period;
    blockModal.dataset.isMorning = isMorning;
}

export function handleBlockConfirmation() {
    const teacher = blockModal.dataset.teacher;
    const day = blockModal.dataset.day;
    const period = blockModal.dataset.period;
    const isMorning = blockModal.dataset.isMorning === 'true';
    const reason = blockReason.value.trim();
    const type = document.getElementById('blockType').value;
    
    const blockKey = `${teacher}-${day}-${period}`;
    
    if (!state.teacherBlocks[teacher]) {
        state.teacherBlocks[teacher] = {};
    }
    
    if (reason) {
        state.teacherBlocks[teacher][blockKey] = {
            reason,
            type,
            shift: isMorning ? 'morning' : 'afternoon'
        };
    } else {
        delete state.teacherBlocks[teacher][blockKey];
    }

    clearTeacherScheduleConflicts(teacher, day, period);
    
    saveState();
    blockModal.style.display = 'none';
    updateTeacherView();
    checkConflicts();
}

function clearTeacherScheduleConflicts(teacher, day, period) {
    Object.values(state.groups).forEach(group => {
        if (group.schedule[day]?.[period]) {
            const cellData = typeof group.schedule[day][period] === 'string' ?
                JSON.parse(group.schedule[day][period]) :
                group.schedule[day][period];
            
            if (cellData && cellData.teacher === teacher) {
                group.schedule[day][period] = null;
            }
        }
    });
}

export function handleDeleteBlock() {
    blockReason.value = '';
    handleBlockConfirmation();
}

function setupTeacherCells(morningGroups, afternoonGroups) {
    const cells = document.querySelectorAll('.schedule-cell');
    const teacher = teacherSelect.value;

    cells.forEach((cell, index) => {
        setupTeacherCell(cell, index, teacher, morningGroups, afternoonGroups);
    });
}

function createCellElements() {
    const textDisplay = document.createElement('div');
    textDisplay.className = 'cell-content';
    textDisplay.textContent = '-';

    const select = document.createElement('select');
    select.style.display = 'none';
    select.innerHTML = '<option value="">-</option>';

    return { textDisplay, select };
}

function setupCellContent(cell, textDisplay, select, teacher, day, period, isMorning, groups) {
    // Limpiar las opciones existentes y agregar la opción por defecto
    select.innerHTML = '<option value="">-</option>';
    cell.className = 'schedule-cell';

    // Agregar las materias del profesor para este horario
    groups.forEach(group => {
        if (group.schedule && group.schedule[day] && group.schedule[day][period]) {
            const scheduleItem = group.schedule[day][period];
            if (typeof scheduleItem === 'string') {
                try {
                    const parsed = JSON.parse(scheduleItem);
                    if (parsed.teacher === teacher) {
                        const option = document.createElement('option');
                        option.value = JSON.stringify({ group: group.id, subject: parsed.name });
                        option.textContent = `${group.name} - ${parsed.name}`;
                        select.appendChild(option);
                    }
                } catch (e) {
                    console.error('Error parsing schedule item:', e);
                }
            }
        }
    });

    // Actualizar el texto mostrado
    if (select.options.length > 1) {
        const firstOption = select.options[1];
        const value = JSON.parse(firstOption.value);
        textDisplay.textContent = `${value.subject} (${groups.find(g => g.id === value.group)?.name || ''})`;
        cell.classList.add(getSubjectColorClass(value.subject));
    } else {
        textDisplay.textContent = '-';
    }
}

function setupCellEventListeners(cell, textDisplay, select, teacher, day, period, isMorning) {
    // Mostrar select al hacer clic en el texto
    textDisplay.addEventListener('click', () => {
        if (select.options.length > 1) {
            textDisplay.style.display = 'none';
            select.style.display = 'block';
            select.focus();
        }
    });

    // Ocultar select al perder el foco
    select.addEventListener('blur', () => {
        select.style.display = 'none';
        textDisplay.style.display = 'block';
    });

    // Actualizar el texto al cambiar la selección
    select.addEventListener('change', () => {
        const selectedOption = select.options[select.selectedIndex];
        textDisplay.textContent = selectedOption.textContent;
        select.style.display = 'none';
        textDisplay.style.display = 'block';
        
        if (selectedOption.value) {
            const value = JSON.parse(selectedOption.value);
            cell.className = 'schedule-cell ' + getSubjectColorClass(value.subject);
        } else {
            cell.className = 'schedule-cell';
        }
    });
}

function setupTeacherCell(cell, index, teacher, morningGroups, afternoonGroups) {
    const day = cell.dataset.day;
    const period = cell.dataset.period;
    const table = cell.closest('.scheduleTable');
    const isMorning = table.classList.contains('morning-schedule');
    const groups = isMorning ? morningGroups : afternoonGroups;

    // Limpiar el contenido existente de la celda
    cell.innerHTML = '';

    const { textDisplay, select } = createCellElements();
    cell.appendChild(textDisplay);
    cell.appendChild(select);
    
    setupCellContent(cell, textDisplay, select, teacher, day, period, isMorning, groups);
    setupCellEventListeners(cell, textDisplay, select, teacher, day, period, isMorning);
}

// ... (resto de funciones auxiliares para la vista de profesores)
