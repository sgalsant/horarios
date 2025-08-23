import { state, saveState, loadState, exportData, importData } from './state.js';
import { updateTeacherView, handleBlockConfirmation, handleDeleteBlock } from './teacher-view.js';
import { initializeScheduleTable } from './schedule-view.js';
import { checkConflicts } from './conflicts.js';
import { addSubject, updateSubjects, updateSubjectSummary } from './subject-management.js';
import { showMultiGroupView } from './multi-group-view.js';
import { createGroup, deleteGroup, loadGroupData, saveGroupConfig, updateGroupsList, updateGroupConfig } from './group-management.js';

// --- Elementos DOM ---
const addSubjectBtn = document.getElementById('addSubjectBtn');
const groupsViewBtn = document.getElementById('groupsViewBtn');
const groupScheduleViewBtn = document.getElementById('groupScheduleViewBtn');
const teacherScheduleViewBtn = document.getElementById('teacherScheduleViewBtn');
const multiScheduleViewBtn = document.getElementById('multiScheduleViewBtn');
const teacherSelect = document.getElementById('teacherSelect');
const blockModal = document.getElementById('blockModal');
const confirmBlock = document.getElementById('confirmBlock');
const cancelBlock = document.getElementById('cancelBlock');
const deleteBlockBtn = document.getElementById('deleteBlockBtn');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importInput = document.getElementById('importInput');
const groupSelect = document.getElementById('groupSelect');
const newGroupBtn = document.getElementById('newGroupBtn');
const deleteGroupBtn = document.getElementById('deleteGroupBtn');
const multiViewType = document.getElementById('multiViewType');
const shiftFilter = document.getElementById('shiftFilter');

// --- Inicialización ---
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadState();
    updateGroupsList();
    updateTeacherSelect();
    switchView(state.currentView || 'groups');
});

function setupEventListeners() {
    groupsViewBtn.addEventListener('click', () => switchView('groups'));
    groupScheduleViewBtn.addEventListener('click', () => switchView('groupSchedule'));
    teacherScheduleViewBtn.addEventListener('click', () => switchView('teacherSchedule'));
    multiScheduleViewBtn.addEventListener('click', () => switchView('multiSchedule'));

    groupSelect.addEventListener('change', () => {
        state.currentGroup = groupSelect.value;
        saveState();
        if (state.currentView === 'groupSchedule') {
            initializeScheduleTable();
        }
    });
    teacherSelect.addEventListener('change', () => {
        state.currentTeacher = teacherSelect.value;
        saveState();
        if (state.currentView === 'teacherSchedule') {
            updateTeacherView();
        }
    });

    newGroupBtn.addEventListener('click', createGroup);
    deleteGroupBtn.addEventListener('click', deleteGroup);
    addSubjectBtn.addEventListener('click', addSubject);
    ['groupName', 'shift', 'course', 'teachingName'].forEach(id => {
        document.getElementById(id).addEventListener('change', saveGroupConfig);
    });

    // Listeners del Modal de Bloqueo
    cancelBlock.addEventListener('click', () => blockModal.style.display = 'none');
    confirmBlock.addEventListener('click', handleBlockConfirmation);
    deleteBlockBtn.addEventListener('click', handleDeleteBlock);

    exportBtn.addEventListener('click', exportData);
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', importData);
    
    multiViewType.addEventListener('change', showMultiGroupView);
    shiftFilter.addEventListener('change', showMultiGroupView);
}

export function switchView(view) {
    state.currentView = view;
    
    document.querySelectorAll('.view-controls button').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(view + 'ViewBtn');
    if (activeBtn) activeBtn.classList.add('active');
    
    document.querySelector('.groups-panel').style.display = view === 'groups' ? 'flex' : 'none';
    document.querySelector('.schedule-view').style.display = view.includes('Schedule') ? 'block' : 'none';
    
    teacherSelect.style.display = view === 'teacherSchedule' ? 'inline-block' : 'none';
    groupSelect.style.display = view === 'groupSchedule' ? 'inline-block' : 'none';
    document.getElementById('multiViewControls').style.display = view === 'multiSchedule' ? 'flex' : 'none';
    
    const scheduleContainer = document.getElementById('scheduleContainer');
    const subjectSummary = document.getElementById('subjectSummary');
    
    // Limpiar contenedores
    scheduleContainer.innerHTML = '';
    if (subjectSummary) subjectSummary.innerHTML = '';

    if (view === 'groups') {
        updateGroupConfig();
    } else if (view === 'groupSchedule') {
        scheduleContainer.innerHTML = createTableHTML();
        initializeScheduleTable();
    } else if (view === 'teacherSchedule') {
        updateTeacherView();
    } else if (view === 'multiSchedule') {
        showMultiGroupView();
    }
}

function createTableHTML() {
    return `
        <table id="scheduleTable" class="schedule-table-common">
            <thead>
                <tr>
                    <th>Hora</th><th>Lunes</th><th>Martes</th><th>Miércoles</th><th>Jueves</th><th>Viernes</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
        <div id="subjectSummary"></div>
    `;
}

export function updateTeacherSelect() {
    const allTeachers = new Set();
    Object.values(state.groups).forEach(group => {
        group.subjects.forEach(subject => {
            if (subject.teacher) allTeachers.add(subject.teacher);
        });
    });
    
    const currentTeacher = teacherSelect.value;
    teacherSelect.innerHTML = '<option value="">Seleccione un profesor...</option>';
    Array.from(allTeachers).sort().forEach(teacher => {
        const option = document.createElement('option');
        option.value = teacher;
        option.textContent = teacher;
        teacherSelect.appendChild(option);
    });
    teacherSelect.value = state.currentTeacher || '';
}