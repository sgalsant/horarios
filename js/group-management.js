import { state, saveState } from './state.js';
import { initializeScheduleTable, updateScheduleSelects } from './schedule-view.js';
import { updateSubjects, updateSubjectSummary } from './subject-management.js';
import { updateTeacherSelect } from './main.js';

// Elementos DOM
const groupSelect = document.getElementById('groupSelect');
const deleteGroupBtn = document.getElementById('deleteGroupBtn');
const groupConfigForm = document.getElementById('groupConfig');
const subjectsList = document.getElementById('subjectsList');

export function loadGroups() {
    const savedGroups = localStorage.getItem('horario_groups');
    if (savedGroups) {
        state.groups = JSON.parse(savedGroups);
        updateGroupSelect();
        const lastSelectedGroup = localStorage.getItem('horario_lastSelectedGroup');
        if (lastSelectedGroup && state.groups[lastSelectedGroup]) {
            state.currentGroup = lastSelectedGroup;
            groupSelect.value = lastSelectedGroup;
            loadGroupData(lastSelectedGroup);
        }
    }
}

function saveGroups() {
    localStorage.setItem('horario_groups', JSON.stringify(state.groups));
    if (state.currentGroup) {
        localStorage.setItem('horario_lastSelectedGroup', state.currentGroup);
    }
    saveState(); // Ensure global state is also updated
}

function updateGroupSelect() {
    groupSelect.innerHTML = '<option value="">Seleccionar Grupo...</option>';
    Object.values(state.groups).forEach(group => {
        const option = document.createElement('option');
        option.value = group.id;
        option.textContent = `${group.name || 'Sin nombre'} - ${group.course || 'Sin curso'}`;
        groupSelect.appendChild(option);
    });
    
    if (state.currentGroup) {
        groupSelect.value = state.currentGroup;
    }
    
    deleteGroupBtn.disabled = !state.currentGroup;
}

function getNextGroupNumber() {
    let maxNumber = 0;
    Object.values(state.groups).forEach(group => {
        const match = group.name?.match(/^Nuevo grupo (\d+)$/);
        if (match) {
            const num = parseInt(match[1]);
            if (num > maxNumber) maxNumber = num;
        }
    });
    return maxNumber + 1;
}

function createNewGroup() {
    return {
        id: Date.now().toString(),
        name: `Nuevo grupo ${getNextGroupNumber()}`,
        shift: 'morning',
        course: '',
        teachingName: '',
        subjects: [],
        schedule: {}
    };
}

export function createGroup() {
    const newGroup = createNewGroup();
    state.groups[newGroup.id] = newGroup;
    state.currentGroup = newGroup.id;
    saveGroups();
    loadGroupData(newGroup.id);
    updateGroupSelect();
    
    // Actualizar la lista de grupos y la configuración
    const groupsList = document.querySelector('.groups-list');
    if (groupsList) {
        const groupItem = document.createElement('div');
        groupItem.className = 'group-item active';
        groupItem.textContent = newGroup.name;
        
        // Remover la clase active de otros elementos
        groupsList.querySelectorAll('.group-item').forEach(item => item.classList.remove('active'));
        
        groupsList.appendChild(groupItem);
        
        groupItem.addEventListener('click', () => {
            groupsList.querySelectorAll('.group-item').forEach(item => item.classList.remove('active'));
            groupItem.classList.add('active');
            state.currentGroup = newGroup.id;
            updateGroupConfig();
        });
    }
    
    // Mostrar la configuración del nuevo grupo
    const configForm = document.getElementById('groupConfig');
    if (configForm) {
        configForm.style.display = 'block';
        document.getElementById('groupName').value = newGroup.name;
        document.getElementById('shift').value = newGroup.shift;
        document.getElementById('course').value = newGroup.course;
        document.getElementById('teachingName').value = newGroup.teachingName;
    }
}

import { switchView } from './main.js';

export function deleteGroup() {
    if (!state.currentGroup) return;
    
    if (confirm('¿Está seguro de que desea eliminar este grupo?')) {
        delete state.groups[state.currentGroup];
        state.currentGroup = null;
        localStorage.removeItem('horario_lastSelectedGroup');
        saveGroups();
        saveState(); // Guardar también en el estado global
        switchView('groups'); // Cambiamos a la vista de grupos después de eliminar
        clearGroupData();
        alert('Grupo eliminado correctamente.');
    }
}

function switchGroup() {
    const groupId = groupSelect.value;
    if (groupId !== state.currentGroup) {
        state.currentGroup = groupId;
        loadGroupData(groupId);
    }
}

export function loadGroupData(groupId) {
    if (!groupId || !state.groups[groupId]) {
        clearGroupData();
        return;
    }

    const group = state.groups[groupId];
    
    document.getElementById('groupName').value = group.name || '';
    document.getElementById('shift').value = group.shift || 'morning';
    document.getElementById('course').value = group.course || '';
    document.getElementById('teachingName').value = group.teachingName || '';
    
    subjectsList.innerHTML = '';
    group.subjects.forEach(subject => {
        const subjectItem = document.createElement('div');
        subjectItem.className = 'subject-item';
        subjectItem.innerHTML = `
            <input type="text" value="${subject.name}" placeholder="Nombre de la materia" required>
            <input type="number" value="${subject.hours}" placeholder="Horas semanales" min="1" max="20" required>
            <input type="text" value="${subject.teacher}" placeholder="Nombre del profesor" required>
            <button type="button" class="remove-subject">Eliminar</button>
        `;
        subjectsList.appendChild(subjectItem);
        
        const removeBtn = subjectItem.querySelector('.remove-subject');
        removeBtn.addEventListener('click', () => {
            subjectsList.removeChild(subjectItem);
            updateSubjects();
            updateScheduleSelects();
        });
    });
    
    // Solo inicializar la tabla si estamos en la vista de horarios
    if (state.currentView === 'groupSchedule' || state.currentView === 'teacherSchedule') {
        const scheduleTable = document.getElementById('scheduleTable');
        if (scheduleTable) {
            initializeScheduleTable();
            updateSubjectSummary();
        }
    }
    
    updateTeacherSelect();
    updateGroupSelect();
}

export function clearGroupData() {
    groupConfigForm.reset();
    subjectsList.innerHTML = '';
    
    // Solo inicializar la tabla si estamos en una vista que la usa
    if (state.currentView === 'groupSchedule' || state.currentView === 'teacherSchedule') {
        const scheduleTable = document.getElementById('scheduleTable');
        if (scheduleTable) {
            initializeScheduleTable();
            updateSubjectSummary();
        }
    }
    
    updateTeacherSelect();
}

export function saveGroupConfig() {
    if (!state.currentGroup) return;
    
    const group = state.groups[state.currentGroup];
    group.name = document.getElementById('groupName').value;
    group.shift = document.getElementById('shift').value;
    group.course = document.getElementById('course').value;
    group.teachingName = document.getElementById('teachingName').value;
    
    saveGroups();
}
