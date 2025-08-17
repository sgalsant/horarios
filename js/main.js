import { state, DAYS, PERIODS, saveState, loadState, exportData, importData } from './state.js';
import { updateTeacherView, showBlockModalForTeacher, handleBlockConfirmation, handleDeleteBlock } from './teacher-view.js';
import { createScheduleStructure, initializeScheduleTable, updateScheduleSelects } from './schedule-view.js';
import { checkConflicts } from './conflicts.js';
import { addSubject, updateSubjects, updateSubjectSummary } from './subject-management.js';
import { showMultiGroupView } from './multi-group-view.js';
import { createGroup, deleteGroup, clearGroupData, loadGroupData, saveGroupConfig } from './group-management.js';
import { getSubjectColorClass } from './utils.js';

// Elementos DOM
let scheduleTable, subjectSummary;
const groupConfigForm = document.getElementById('groupConfig');
const addSubjectBtn = document.getElementById('addSubjectBtn');
const subjectsList = document.getElementById('subjectsList');
const groupsViewBtn = document.getElementById('groupsViewBtn');
const groupScheduleViewBtn = document.getElementById('groupScheduleViewBtn');
const teacherScheduleViewBtn = document.getElementById('teacherScheduleViewBtn');
const multiScheduleViewBtn = document.getElementById('multiScheduleViewBtn');
const teacherSelect = document.getElementById('teacherSelect');
const blockModal = document.getElementById('blockModal');
const blockReason = document.getElementById('blockReason');
const confirmBlock = document.getElementById('confirmBlock');
const cancelBlock = document.getElementById('cancelBlock');
const deleteBlockBtn = document.getElementById('deleteBlockBtn');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importInput = document.getElementById('importInput');
const groupSelect = document.getElementById('groupSelect');
const newGroupBtn = document.getElementById('newGroupBtn');
const deleteGroupBtn = document.getElementById('deleteGroupBtn');

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    scheduleTable = document.getElementById('scheduleTable');
    subjectSummary = document.getElementById('subjectSummary');
    setupEventListeners();
    loadState();
    
    // Iniciar en la vista de grupos
    switchView('groups');
    updateGroupsList();
    
    if (state.currentGroup) {
        updateGroupConfig();
    }
});

function setupEventListeners() {
    addSubjectBtn.addEventListener('click', addSubject);
    groupsViewBtn.addEventListener('click', () => switchView('groups'));
    groupScheduleViewBtn.addEventListener('click', () => switchView('groupSchedule'));
    teacherScheduleViewBtn.addEventListener('click', () => switchView('teacherSchedule'));
    multiScheduleViewBtn.addEventListener('click', () => switchView('multiSchedule'));
    teacherSelect.addEventListener('change', () => {
        state.currentTeacher = teacherSelect.value;
        updateTeacherView();
    });
    exportBtn.addEventListener('click', exportData);
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', importData);
    cancelBlock.addEventListener('click', () => blockModal.style.display = 'none');
    confirmBlock.addEventListener('click', handleBlockConfirmation);
    deleteBlockBtn.addEventListener('click', handleDeleteBlock);
    
    newGroupBtn.addEventListener('click', createGroup);
    deleteGroupBtn.addEventListener('click', deleteGroup);
    groupSelect.addEventListener('change', () => {
        state.currentGroup = groupSelect.value;
        if (state.currentGroup) {
            loadGroupData(state.currentGroup);
        } else {
            clearGroupData();
        }
    });
    ['groupName', 'shift', 'course', 'teachingName'].forEach(id => {
        document.getElementById(id).addEventListener('change', saveGroupConfig);
    });
}



export function switchView(view) {
    state.currentView = view;
    
    // Actualizar botones activos
    groupsViewBtn.classList.toggle('active', view === 'groups');
    groupScheduleViewBtn.classList.toggle('active', view === 'groupSchedule');
    teacherScheduleViewBtn.classList.toggle('active', view === 'teacherSchedule');
    multiScheduleViewBtn.classList.toggle('active', view === 'multiSchedule');
    
    const groupsPanel = document.querySelector('.groups-panel');
    const scheduleView = document.querySelector('.schedule-view');
    
    // Mostrar/ocultar elementos según la vista
    if (groupsPanel) groupsPanel.style.display = view === 'groups' ? 'flex' : 'none';
    if (scheduleView) scheduleView.style.display = view === 'groups' ? 'none' : 'block';
    
    // Mostrar/ocultar selectores específicos
    teacherSelect.style.display = view === 'teacherSchedule' ? 'inline-block' : 'none';
    groupSelect.style.display = view === 'groupSchedule' ? 'inline-block' : 'none';
    document.getElementById('multiViewControls').style.display = view === 'multiSchedule' ? 'flex' : 'none';
    
    // Actualizar la lista de grupos si estamos en la vista de grupos
    if (view === 'groups') {
        updateGroupsList();
        updateGroupConfig();
    }
    
    const scheduleContainer = document.getElementById('scheduleContainer');
    scheduleContainer.innerHTML = '';
    if (subjectSummary) {
        subjectSummary.innerHTML = '';
    }

    if (view === 'groupSchedule' || view === 'teacherSchedule') {
        scheduleContainer.innerHTML = `
            <table id="scheduleTable" class="schedule-table-common">
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
            <div id="subjectSummary"></div>
        `;
        
        scheduleTable = document.getElementById('scheduleTable');
        subjectSummary = document.getElementById('subjectSummary');

        if (view === 'groupSchedule' && state.currentGroup) {
            loadGroupData(state.currentGroup);
        } else {
            initializeScheduleTable();
            if (subjectSummary) {
                subjectSummary.innerHTML = '';
            }
        }
    } else if (view === 'teacherSchedule') {
        if (state.currentTeacher) {
            const allTeachers = new Set();
            Object.values(state.groups).forEach(group => {
                group.subjects.forEach(subject => {
                    if (subject.teacher) {
                        allTeachers.add(subject.teacher);
                    }
                });
            });
            
            if (allTeachers.has(state.currentTeacher)) {
                teacherSelect.value = state.currentTeacher;
            } else {
                state.currentTeacher = null;
            }
        }
        updateTeacherView();
    } else if (view === 'multiGroup') {
        if (typeof window.showMultiGroupView === 'function') {
            window.showMultiGroupView();
        } else {
            console.error('La función showMultiGroupView no está disponible');
        }
    }
}

export function updateTeacherSelect() {
    const allTeachers = new Set();
    
    Object.values(state.groups).forEach(group => {
        group.subjects.forEach(subject => {
            if (subject.teacher) {
                allTeachers.add(subject.teacher);
            }
        });
    });
    
    teacherSelect.innerHTML = '<option value="">Seleccione un profesor...</option>';
    Array.from(allTeachers).sort().forEach(teacher => {
        const option = document.createElement('option');
        option.value = teacher;
        option.textContent = teacher;
        teacherSelect.appendChild(option);
    });
}

function updateGroupsList() {
    const groupsList = document.querySelector('.groups-list');
    if (!groupsList) return;
    
    groupsList.innerHTML = '';
    
    Object.entries(state.groups).forEach(([id, group]) => {
        const groupItem = document.createElement('div');
        groupItem.className = 'group-item';
        if (id === state.currentGroup) {
            groupItem.classList.add('active');
        }
        groupItem.textContent = group.name || id;
        
        groupItem.addEventListener('click', () => {
            document.querySelectorAll('.group-item').forEach(item => item.classList.remove('active'));
            groupItem.classList.add('active');
            state.currentGroup = id;
            updateGroupConfig();
        });
        
        groupsList.appendChild(groupItem);
    });
}

function updateGroupConfig() {
    const configForm = document.getElementById('groupConfig');
    if (!configForm) return;
    
    if (!state.currentGroup || !state.groups[state.currentGroup]) {
        configForm.style.display = 'none';
        return;
    }
    
    const group = state.groups[state.currentGroup];
    configForm.style.display = 'block';
    
    // Actualizar los campos del formulario
    document.getElementById('groupName').value = group.name || '';
    document.getElementById('shift').value = group.shift || 'morning';
    document.getElementById('course').value = group.course || '';
    document.getElementById('teachingName').value = group.teachingName || '';
    
    // Actualizar la lista de materias
    updateSubjects();
}

