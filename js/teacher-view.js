import { state, saveState, DAYS, PERIODS } from './state.js';
import { checkConflicts } from './conflicts.js';
import { getSubjectColorClass } from './utils.js';
import { updateSubjectSummary } from './subject-management.js';

export function updateTeacherView() {
    const teacher = state.currentTeacher;
    const scheduleContainer = document.getElementById('scheduleContainer');
    const summaryContainer = document.getElementById('subjectSummary');

    if (!teacher) {
        scheduleContainer.innerHTML = `<div style="text-align: center; margin-top: 20px;"><p>Seleccione un profesor para ver su horario</p></div>`;
        if (summaryContainer) summaryContainer.innerHTML = '';
        return;
    }

    const allGroups = Object.values(state.groups);
    const teacherBlocks = Object.values(state.teacherBlocks[teacher] || {});

    const hasMorningAssignments = allGroups.some(g => g.shift === 'morning' && hasScheduled(g, teacher)) || teacherBlocks.some(b => b.shift === 'morning');
    const hasAfternoonAssignments = allGroups.some(g => g.shift === 'afternoon' && hasScheduled(g, teacher)) || teacherBlocks.some(b => b.shift === 'afternoon');

    let html = `<div id="teacher-schedules"><h2>Horario de ${teacher}</h2>`;
    if (!hasMorningAssignments && !hasAfternoonAssignments) {
        html += `<p style="text-align:center; margin-top:20px;">Este profesor no tiene asignaciones.</p>`;
    } else {
        if (hasMorningAssignments) {
            html += createScheduleTableHTML('Mañana', 'morning-schedule-table');
        }
        if (hasAfternoonAssignments) {
            html += createScheduleTableHTML('Tarde', 'afternoon-schedule-table');
        }
    }
    html += `</div>`;
    scheduleContainer.innerHTML = html;
    
    const summary = document.getElementById('subjectSummary');
    if(!summary) {
        const summaryDiv = document.createElement('div');
        summaryDiv.id = 'subjectSummary';
        scheduleContainer.parentElement.appendChild(summaryDiv);
    }


    if (hasMorningAssignments) {
        const morningTbody = document.querySelector('#morning-schedule-table tbody');
        populateTeacherTable(teacher, morningTbody, 'morning');
    }
    if (hasAfternoonAssignments) {
        const afternoonTbody = document.querySelector('#afternoon-schedule-table tbody');
        populateTeacherTable(teacher, afternoonTbody, 'afternoon');
    }
    
    updateSubjectSummary();
}

function hasScheduled(group, teacher) {
    if (!group.schedule) return false;
    return Object.values(group.schedule).some(day => 
        Object.values(day).some(cell => {
            if (!cell) return false;
            const p = JSON.parse(cell);
            return p && p.teacher === teacher;
        })
    );
}

function createScheduleTableHTML(title, id) {
    return `
        <div class="schedule-section">
            <h3>Turno de ${title}</h3>
            <table id="${id}" class="scheduleTable schedule-table-common">
                <thead><tr><th>Hora</th>${DAYS.map(d => `<th>${d}</th>`).join('')}</tr></thead>
                <tbody></tbody>
            </table>
        </div>
    `;
}

function populateTeacherTable(teacher, tbody, shift) {
    if (!tbody) return;
    
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
            cell.appendChild(contentDiv);
            
            const select = document.createElement('select');
            select.style.display = 'none';
            cell.appendChild(select);

            const blockKey = `${teacher}-${day}-${i}`;
            const block = state.teacherBlocks[teacher]?.[blockKey];
            let cellData = null;
            let groupName = '';

            if (block && block.shift === shift) {
                cellData = { blocked: true, reason: block.reason };
            } else {
                for (const group of Object.values(state.groups)) {
                    if (group.shift === shift && group.schedule?.[day]?.[i]) {
                        const parsed = JSON.parse(group.schedule[day][i]);
                        if (parsed.teacher === teacher) {
                            cellData = parsed;
                            groupName = group.name;
                            break;
                        }
                    }
                }
            }

            if (cellData) {
                if (cellData.blocked) {
                    contentDiv.textContent = cellData.reason || 'Bloqueado';
                    cell.classList.add('blocked-cell');
                } else {
                    contentDiv.textContent = `${cellData.name} (${groupName})`;
                    cell.classList.add(getSubjectColorClass(cellData.name));
                }
            } else {
                contentDiv.textContent = '-';
            }

            contentDiv.addEventListener('click', () => {
                updateTeacherScheduleOptions(select, teacher, shift);
                select.style.display = 'block';
                contentDiv.style.display = 'none';
                select.focus();
            });

            select.addEventListener('blur', () => {
                select.style.display = 'none';
                contentDiv.style.display = 'block';
            });

            select.addEventListener('change', () => {
                if (select.value === 'BLOCKED') {
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
                    const value = select.value ? JSON.parse(select.value) : null;
                    saveTeacherScheduleChange(teacher, day, i, value);
                    updateTeacherView();
                    checkConflicts();
                }
            });

            row.appendChild(cell);
        });
        tbody.appendChild(row);
    });
}

function updateTeacherScheduleOptions(select, teacher, shift) {
    const originalValue = select.value;
    select.innerHTML = '';
    
    select.add(new Option('-', ''));
    select.add(new Option('Bloquear franja', 'BLOCKED'));
    
    const options = [];
    Object.entries(state.groups).forEach(([groupId, group]) => {
        if (group.shift === shift && group.subjects) {
            group.subjects.filter(s => s.teacher === teacher).forEach(subject => {
                options.push({
                    value: JSON.stringify({ groupId, name: subject.name }),
                    text: `${subject.name} (${group.name})`,
                });
            });
        }
    });
    
    options.sort((a, b) => a.text.localeCompare(b.text));
    options.forEach(opt => select.add(new Option(opt.text, opt.value)));

    select.value = originalValue;
}

function saveTeacherScheduleChange(teacher, day, period, value) {
    const blockKey = `${teacher}-${day}-${period}`;
    if (state.teacherBlocks[teacher]?.[blockKey]) {
        delete state.teacherBlocks[teacher][blockKey];
    }

    Object.values(state.groups).forEach(group => {
        const cell = group.schedule?.[day]?.[period];
        if (cell) {
            const parsed = JSON.parse(cell);
            if (parsed.teacher === teacher) {
                group.schedule[day][period] = null;
            }
        }
    });

    if (value) {
        const { groupId, name } = value;
        const group = state.groups[groupId];
        if (group) {
            if (!group.schedule[day]) group.schedule[day] = {};
            group.schedule[day][period] = JSON.stringify({ name, teacher });
        }
    }
    saveState();
}

export function handleBlockConfirmation() {
    const blockModal = document.getElementById('blockModal');
    const { teacher, day, period, shift } = blockModal.dataset;
    const reason = document.getElementById('blockReason').value.trim();
    const type = document.getElementById('blockType').value;
    
    const blockKey = `${teacher}-${day}-${period}`;
    
    if (!state.teacherBlocks[teacher]) {
        state.teacherBlocks[teacher] = {};
    }
    
    if (reason) {
        state.teacherBlocks[teacher][blockKey] = { reason, type, shift };
        saveTeacherScheduleChange(teacher, day, period, null);
    } else {
        delete state.teacherBlocks[teacher][blockKey];
        saveTeacherScheduleChange(teacher, day, period, null);
    }
    
    saveState();
    blockModal.style.display = 'none';
    updateTeacherView();
    checkConflicts();
}

export function handleDeleteBlock() {
    document.getElementById('blockReason').value = '';
    handleBlockConfirmation();
}