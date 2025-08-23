import { state, saveState } from './state.js';
import { initializeScheduleTable } from './schedule-view.js';
import { updateSubjects, updateSubjectSummary } from './subject-management.js';

export function createGroup() {
    const newGroupName = prompt("Introduce el nombre del nuevo grupo:");
    if (newGroupName) {
        const newGroupId = `group-${Date.now()}`;
        state.groups[newGroupId] = {
            name: newGroupName,
            shift: 'morning',
            course: '',
            teachingName: '',
            subjects: [],
            schedule: {}
        };
        state.currentGroup = newGroupId;
        saveState();
        updateGroupsList();
        updateGroupConfig();
        if (state.currentView === 'groupSchedule') {
            initializeScheduleTable();
        }
    }
}

export function deleteGroup() {
    if (state.currentGroup && confirm(`¿Estás seguro de que quieres eliminar el grupo "${state.groups[state.currentGroup].name}"? Esta acción es irreversible.`)) {
        delete state.groups[state.currentGroup];
        state.currentGroup = Object.keys(state.groups)[0] || null;
        saveState();
        updateGroupsList();
        updateGroupConfig();
        if (state.currentView === 'groupSchedule') {
            initializeScheduleTable();
        }
    }
}

export function loadGroupData(groupId) {
    state.currentGroup = groupId;
    updateGroupConfig();
    if (state.currentView === 'groupSchedule') {
        initializeScheduleTable();
    }
    updateSubjectSummary();
}

export function clearGroupData() {
    document.getElementById('groupName').value = '';
    document.getElementById('shift').value = 'morning';
    document.getElementById('course').value = '';
    document.getElementById('teachingName').value = '';
    document.getElementById('subjectsList').innerHTML = '';
    const scheduleTable = document.getElementById('scheduleTable');
    if (scheduleTable) {
        const tbody = scheduleTable.querySelector('tbody');
        if (tbody) tbody.innerHTML = '';
    }
}

export function saveGroupConfig() {
    if (state.currentGroup) {
        const group = state.groups[state.currentGroup];
        group.name = document.getElementById('groupName').value;
        group.shift = document.getElementById('shift').value;
        group.course = document.getElementById('course').value;
        group.teachingName = document.getElementById('teachingName').value;
        saveState();
        updateGroupsList();
    }
}

export function updateGroupsList() {
    const groupSelect = document.getElementById('groupSelect');
    const currentVal = groupSelect.value;
    groupSelect.innerHTML = '<option value="">Seleccione un grupo...</option>';
    Object.entries(state.groups).forEach(([id, group]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = group.name;
        groupSelect.appendChild(option);
    });
    groupSelect.value = state.currentGroup || '';

    const groupsListContainer = document.querySelector('.groups-list');
    if (!groupsListContainer) return;
    groupsListContainer.innerHTML = '';
    
    Object.entries(state.groups).forEach(([id, group]) => {
        const groupItem = document.createElement('div');
        groupItem.className = 'group-item';
        if (id === state.currentGroup) {
            groupItem.classList.add('active');
        }
        groupItem.textContent = group.name || id;
        groupItem.addEventListener('click', () => {
            state.currentGroup = id;
            saveState();
            updateGroupsList();
            updateGroupConfig();
        });
        groupsListContainer.appendChild(groupItem);
    });
}

export function updateGroupConfig() {
    if (state.currentGroup) {
        const group = state.groups[state.currentGroup];
        document.getElementById('groupName').value = group.name;
        document.getElementById('shift').value = group.shift;
        document.getElementById('course').value = group.course;
        document.getElementById('teachingName').value = group.teachingName;
        document.querySelector('.group-config-section').style.display = 'block';
        updateSubjects();
    } else {
        document.querySelector('.group-config-section').style.display = 'none';
        clearGroupData();
    }
}

export function updateScheduleOptions(select, group) {
    select.innerHTML = '';
    select.add(new Option('-', ''));
    
    const options = [];
    group.subjects.forEach(subject => {
        options.push({
            value: JSON.stringify({ teacher: subject.teacher, name: subject.name }),
            text: `${subject.name} (${subject.teacher})`
        });
    });
    
    options.sort((a, b) => a.text.localeCompare(b.text));
    options.forEach(opt => select.add(new Option(opt.text, opt.value)));
    
    // Si hay un valor original, seleccionarlo
    const originalValue = select.dataset.originalValue ? JSON.parse(select.dataset.originalValue) : null;
    if (originalValue) {
        const matchingOption = options.find(opt => {
            const optValue = JSON.parse(opt.value);
            return optValue.teacher === originalValue.teacher && optValue.name === originalValue.name;
        });
        
        if (matchingOption) {
            select.value = matchingOption.value;
        } else {
            select.value = '';
        }
    } else {
        select.value = '';
    }
}