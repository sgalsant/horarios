import { state, DAYS, PERIODS, saveState } from './state.js';
import { updateSubjectSummary } from './subject-management.js';
import { getSubjectColorClass } from './utils.js';
import { checkConflicts } from './conflicts.js';
import { handleBlockConfirmation } from './teacher-view.js';

export function initializeScheduleTable() {
    const scheduleTable = document.getElementById('scheduleTable');
    if (!scheduleTable) return;
    const tbody = scheduleTable.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

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
                
                const contentDiv = document.createElement('div');
                contentDiv.className = 'cell-content';
                cell.appendChild(contentDiv);
                
                const select = document.createElement('select');
                select.style.display = 'none';
                cell.appendChild(select);

                contentDiv.addEventListener('click', function() {
                    if (state.currentView === 'groupSchedule' && state.currentGroup) {
                        updateGroupScheduleOptions(select, state.groups[state.currentGroup]);
                        select.value = contentDiv.dataset.value || '';
                        contentDiv.style.display = 'none';
                        select.style.display = 'block';
                        select.focus();
                    } else if (state.currentView === 'teacherSchedule' && state.currentTeacher) {
                        updateTeacherScheduleOptions(select, state.currentTeacher);
                        select.value = contentDiv.dataset.value || '';
                        contentDiv.style.display = 'none';
                        select.style.display = 'block';
                        select.focus();
                    }
                });

                select.addEventListener('blur', function() {
                    select.style.display = 'none';
                    contentDiv.style.display = 'block';
                });

                select.addEventListener('change', function() {
                    const day = cell.dataset.day;
                    const period = cell.dataset.period;

                    if (state.currentView === 'groupSchedule') {
                        const value = this.value ? JSON.parse(this.value) : null;
                        saveScheduleChange(state.groups[state.currentGroup], day, period, value);
                    } else if (state.currentView === 'teacherSchedule') {
                        if (this.value === 'BLOCKED') {
                            const blockModal = document.getElementById('blockModal');
                            blockModal.dataset.teacher = state.currentTeacher;
                            blockModal.dataset.day = day;
                            blockModal.dataset.period = period;
                            blockModal.style.display = 'block';
                        } else {
                            const value = this.value ? JSON.parse(this.value) : null;
                            saveTeacherScheduleChange(state.currentTeacher, day, period, value);
                        }
                    }
                    initializeScheduleTable();
                    checkConflicts();
                });
                
                row.appendChild(cell);
            }
        });
        tbody.appendChild(row);
    });

    if (state.currentView === 'groupSchedule' && state.currentGroup) {
        loadGroupSchedule(state.groups[state.currentGroup], tbody);
    } else if (state.currentView === 'teacherSchedule' && state.currentTeacher) {
        loadTeacherSchedule(state.currentTeacher, tbody);
    }
    updateSubjectSummary();
}

function updateGroupScheduleOptions(select, group) {
    select.innerHTML = '<option value="">-</option>';
    if (group && group.subjects) {
        group.subjects.forEach(subject => {
            const option = document.createElement('option');
            const value = { name: subject.name, teacher: subject.teacher };
            option.value = JSON.stringify(value);
            option.textContent = `${subject.name} - ${subject.teacher}`;
            select.appendChild(option);
        });
    }
}

export function loadGroupSchedule(currentGroup, tbody) {
    if (!tbody || !currentGroup) return;
    const cells = tbody.querySelectorAll('td.schedule-cell');
    cells.forEach(cell => {
        const day = cell.dataset.day;
        const period = cell.dataset.period;
        const contentDiv = cell.querySelector('.cell-content');
        const item = currentGroup.schedule?.[day]?.[period];
        const parsed = item ? (typeof item === 'string' ? JSON.parse(item) : item) : null;

        cell.className = 'schedule-cell';
        contentDiv.textContent = '-';
        contentDiv.dataset.value = '';

        if (parsed) {
            contentDiv.textContent = `${parsed.name} (${parsed.teacher})`;
            contentDiv.dataset.value = JSON.stringify(parsed);
            cell.classList.add(getSubjectColorClass(parsed.name));
        }
    });
}

function saveScheduleChange(group, day, period, value) {
    if (!group.schedule) group.schedule = {};
    if (!group.schedule[day]) group.schedule[day] = {};
    
    if (value) {
        group.schedule[day][period] = JSON.stringify(value);
    } else {
        delete group.schedule[day][period];
    }
    saveState();
}

export function loadTeacherSchedule(teacher, tbody) {
    if (!tbody || !teacher) return;
    const cells = tbody.querySelectorAll('td.schedule-cell');
    
    cells.forEach(cell => {
        const day = cell.dataset.day;
        const period = cell.dataset.period;
        const contentDiv = cell.querySelector('.cell-content');

        cell.className = 'schedule-cell';
        contentDiv.textContent = '-';
        contentDiv.dataset.value = '';

        const blockKey = `${teacher}-${day}-${period}`;
        const block = state.teacherBlocks[teacher]?.[blockKey];

        if (block) {
            contentDiv.textContent = block.reason || 'Bloqueado';
            cell.classList.add('blocked-cell');
            contentDiv.dataset.value = 'BLOCKED';
        } else {
            for (const group of Object.values(state.groups)) {
                const item = group.schedule?.[day]?.[period];
                const parsed = item ? (typeof item === 'string' ? JSON.parse(item) : item) : null;
                if (parsed && parsed.teacher === teacher) {
                    contentDiv.textContent = `${parsed.name} (${group.name})`;
                    const value = { groupId: group.id, name: parsed.name };
                    contentDiv.dataset.value = JSON.stringify(value);
                    cell.classList.add(getSubjectColorClass(parsed.name));
                    break;
                }
            }
        }
    });
}

export function updateTeacherScheduleOptions(select, teacher) {
    select.innerHTML = '<option value="">-</option>';
    select.innerHTML += '<option value="BLOCKED">Bloquear franja</option>';
    
    const options = [];
    Object.entries(state.groups).forEach(([groupId, group]) => {
        if (group.subjects) {
            group.subjects.filter(s => s.teacher === teacher).forEach(subject => {
                options.push({
                    value: JSON.stringify({ groupId, name: subject.name }),
                    text: `${subject.name} (${group.name})`,
                });
            });
        }
    });
    
    options.sort((a, b) => a.text.localeCompare(b.text));
    options.forEach(opt => {
        const optionElement = document.createElement('option');
        optionElement.value = opt.value;
        optionElement.textContent = opt.text;
        select.appendChild(optionElement);
    });
}

function saveTeacherScheduleChange(teacher, day, period, value) {
    Object.values(state.groups).forEach(group => {
        if (group.schedule?.[day]?.[period]) {
            const item = group.schedule[day][period];
            const parsed = item ? (typeof item === 'string' ? JSON.parse(item) : item) : null;
            if (parsed && parsed.teacher === teacher) {
                group.schedule[day][period] = null;
            }
        }
    });
    
    if (state.teacherBlocks[teacher]) {
        const blockKey = `${teacher}-${day}-${period}`;
        delete state.teacherBlocks[teacher][blockKey];
    }

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