import { state, DAYS, PERIODS, saveState } from './state.js';
import { updateSubjectSummary } from './subject-management.js';
import { getSubjectColorClass } from './utils.js';
import { checkConflicts } from './conflicts.js';

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
                    updateGroupScheduleOptions(select, state.groups[state.currentGroup]);
                    select.value = contentDiv.dataset.value || '';
                    contentDiv.style.display = 'none';
                    select.style.display = 'block';
                    select.focus();
                });

                select.addEventListener('blur', function() {
                    select.style.display = 'none';
                    contentDiv.style.display = 'block';
                });

                select.addEventListener('change', function() {
                    const value = this.value ? JSON.parse(this.value) : null;
                    saveScheduleChange(state.groups[state.currentGroup], day, i, value);
                    initializeScheduleTable();
                    checkConflicts();
                });
                
                row.appendChild(cell);
            }
        });
        tbody.appendChild(row);
    });

    if (state.currentGroup) {
        loadGroupSchedule(state.groups[state.currentGroup], tbody);
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