import { state, saveState } from './state.js';
import { initializeScheduleTable } from './schedule-view.js';
import { checkConflicts } from './conflicts.js';

export function updateTeacherView() {
    const teacher = state.currentTeacher;
    const scheduleContainer = document.getElementById('scheduleContainer');

    if (!teacher) {
        scheduleContainer.innerHTML = `<div style="text-align: center; margin-top: 20px;"><p>Seleccione un profesor para ver su horario</p></div>`;
        return;
    }
    
    scheduleContainer.innerHTML = `
        <div id="teacher-schedules">
             <div class="schedule-section">
                <h3>Horario de ${teacher}</h3>
                <table id="scheduleTable" class="scheduleTable schedule-table-common">
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
        </div>
        <div id="subjectSummary"></div>
    `;
    initializeScheduleTable();
}

export function handleBlockConfirmation() {
    const blockModal = document.getElementById('blockModal');
    const teacher = blockModal.dataset.teacher;
    const day = blockModal.dataset.day;
    const period = blockModal.dataset.period;
    const reason = document.getElementById('blockReason').value.trim();
    const type = document.getElementById('blockType').value;
    
    const blockKey = `${teacher}-${day}-${period}`;
    
    if (!state.teacherBlocks[teacher]) {
        state.teacherBlocks[teacher] = {};
    }
    
    if (reason) {
        state.teacherBlocks[teacher][blockKey] = { reason, type };
    } else {
        delete state.teacherBlocks[teacher][blockKey];
    }
    
    saveState();
    blockModal.style.display = 'none';
    initializeScheduleTable();
    checkConflicts();
}

export function handleDeleteBlock() {
    document.getElementById('blockReason').value = '';
    handleBlockConfirmation();
}