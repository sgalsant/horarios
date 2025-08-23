import { state, saveState } from './state.js';
import { updateTeacherSelect } from './main.js';
import { initializeScheduleTable } from './schedule-view.js';

export function addSubject() {
    if (!state.currentGroup) {
        alert('Por favor, seleccione o cree un grupo primero');
        return;
    }
    const currentGroup = state.groups[state.currentGroup];
    const newSubject = {
        id: `subj-${Date.now()}`, // Usar un ID único
        name: '',
        hours: 1,
        teacher: ''
    };
    currentGroup.subjects.push(newSubject);
    saveState();
    updateSubjects();
}

export function updateSubjects() {
    if (!state.currentGroup) return;
    
    const group = state.groups[state.currentGroup];
    const subjectsList = document.getElementById('subjectsList');
    subjectsList.innerHTML = '';
    
    group.subjects.forEach(subject => {
        const subjectItem = document.createElement('div');
        subjectItem.className = 'subject-item';
        
        subjectItem.innerHTML = `
            <input type="text" class="subject-name" placeholder="Nombre de la materia" value="${subject.name || ''}">
            <input type="number" class="subject-hours" placeholder="Horas" value="${subject.hours || 1}" min="1">
            <input type="text" class="subject-teacher" placeholder="Profesor" value="${subject.teacher || ''}">
            <button type="button" class="remove-subject">Eliminar</button>
        `;
        
        subjectsList.appendChild(subjectItem);

        const inputs = subjectItem.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('change', () => {
                const subjectToUpdate = group.subjects.find(s => s.id === subject.id);
                if (subjectToUpdate) {
                    const oldName = subjectToUpdate.name;
                    const oldTeacher = subjectToUpdate.teacher;

                    subjectToUpdate.name = subjectItem.querySelector('.subject-name').value;
                    subjectToUpdate.hours = parseInt(subjectItem.querySelector('.subject-hours').value) || 1;
                    subjectToUpdate.teacher = subjectItem.querySelector('.subject-teacher').value;

                    // Actualizar el nombre y profesor en todo el horario
                    Object.values(state.groups).forEach(g => {
                        if (!g.schedule) return;
                        Object.keys(g.schedule).forEach(day => {
                            Object.keys(g.schedule[day]).forEach(period => {
                                const cellData = g.schedule[day][period] ? JSON.parse(g.schedule[day][period]) : null;
                                // Comparamos con el nombre y profesor *antiguos*
                                if (cellData && cellData.name === oldName && cellData.teacher === oldTeacher) {
                                    g.schedule[day][period] = JSON.stringify({
                                        name: subjectToUpdate.name,
                                        teacher: subjectToUpdate.teacher
                                    });
                                }
                            });
                        });
                    });
                    
                    saveState();
                    updateTeacherSelect();
                    // Refrescar la vista del horario para mostrar los cambios
                    if (state.currentView.includes('Schedule')) {
                        initializeScheduleTable();
                    }
                    updateSubjectSummary();
                }
            });
        });

        const removeBtn = subjectItem.querySelector('.remove-subject');
        removeBtn.addEventListener('click', () => {
            if (confirm(`¿Está seguro de que desea eliminar la materia "${subject.name}"?`)) {
                // Eliminar la materia del array de materias del grupo
                group.subjects = group.subjects.filter(s => s.id !== subject.id);
                
                // Eliminar la materia de todas las celdas del horario
                Object.values(state.groups).forEach(g => {
                    if (!g.schedule) return;
                    Object.keys(g.schedule).forEach(day => {
                        Object.keys(g.schedule[day]).forEach(period => {
                            const cellData = g.schedule[day][period] ? JSON.parse(g.schedule[day][period]) : null;
                            if (cellData && cellData.name === subject.name && cellData.teacher === subject.teacher) {
                                g.schedule[day][period] = null;
                            }
                        });
                    });
                });

                saveState();
                updateSubjects(); // Re-renderizar la lista de materias
                if (state.currentView.includes('Schedule')) {
                    initializeScheduleTable(); // Re-renderizar el horario
                }
            }
        });
    });
}

export function updateSubjectSummary(shift) {
    const subjectSummary = document.getElementById('subjectSummary');
    if (!subjectSummary) return;

    subjectSummary.innerHTML = '';

    if (state.currentView === 'teacherSchedule' && state.currentTeacher) {

        const teacher = state.currentTeacher;
        const summary = {};
        const blockedHours = {
            lectivo: 0,
            complementario: 0
        };

        // Contar las horas bloqueadas por tipo y turno
        if (state.teacherBlocks[teacher]) {
            Object.entries(state.teacherBlocks[teacher]).forEach(([key, block]) => {
                const [teacherId, day, period] = key.split('-');
                // Solo contar si no hay filtro de turno o si el turno coincide con el del bloque
                if (!shift || (block.shift && block.shift === shift) || !block.shift) {
                    if (block.type === 'lectivo') {
                        blockedHours.lectivo++;
                    } else if (block.type === 'complementaria') {
                        blockedHours.complementario++;
                    }
                }
            });
        }
        
        console.log('Bloques encontrados:', state.teacherBlocks[teacher]); // Para debug
        console.log('Horas bloqueadas:', blockedHours); // Para debug

        // Inicializar el resumen con las materias
        Object.values(state.groups).forEach(group => {
            if (!shift || group.shift === shift) {
                group.subjects.forEach(subject => {
                    if (subject.teacher === teacher) {
                        const key = shift ? subject.name : `${subject.name} (${group.shift === 'morning' ? 'Mañana' : 'Tarde'})`;
                        if (!summary[key]) {
                            summary[key] = { max: 0, assigned: 0, shift: group.shift };
                        }
                        summary[key].max += subject.hours;
                    }
                });
            }
        });


        // Contar las asignaciones
        Object.values(state.groups).forEach(group => {
            if (!group.schedule || (shift && group.shift !== shift)) return;
            Object.values(group.schedule).forEach(daySchedule => {
                Object.values(daySchedule).forEach(cell => {
                    const parsed = cell ? JSON.parse(cell) : null;                    
                    if (parsed && parsed.teacher === teacher) {
                        const key = shift ? parsed.name : `${parsed.name} (${group.shift === 'morning' ? 'Mañana' : 'Tarde'})`;
                        if (summary[key]) {
                            summary[key].assigned++;
                        }
                    }
                });
            });
        });

        const title = shift ? `Resumen de Horas del Profesor (${shift === 'morning' ? 'Mañana' : 'Tarde'})` : 'Resumen de Horas del Profesor';
        subjectSummary.innerHTML = `<h3>${title}</h3>`;

        // Mostrar primero las horas de materias
        const horasMateriasLectivas = Object.values(summary).reduce((acc, { assigned }) => acc + assigned, 0);
        if (Object.keys(summary).length > 0) {
            subjectSummary.innerHTML += '<div class="subject-summary-section"><h4>Materias</h4>';
            Object.entries(summary).forEach(([subject, data]) => {
                const statusClass = data.assigned > data.max ? 'hours-exceeded' : (data.assigned === data.max ? 'hours-complete' : 'hours-incomplete');
                subjectSummary.innerHTML += `<div class="subject-summary-item ${statusClass}">${subject}: ${data.assigned}/${data.max} horas</div>`;
            });
            subjectSummary.innerHTML += '</div>';
        }

        // Mostrar las horas de bloqueo
        if (blockedHours.lectivo > 0 || blockedHours.complementario > 0) {
            subjectSummary.innerHTML += '<div class="subject-summary-section"><h4>Bloques</h4>';
            if (blockedHours.lectivo > 0) {
                subjectSummary.innerHTML += `<div class="subject-summary-item lectivo">Otras lectivas: ${blockedHours.lectivo} horas</div>`;
            }
            if (blockedHours.complementario > 0) {
                subjectSummary.innerHTML += `<div class="subject-summary-item complementario">Otras complementarias: ${blockedHours.complementario} horas</div>`;
            }
            subjectSummary.innerHTML += '</div>';
        }

        // Mostrar los totales
        const totalLectivas = horasMateriasLectivas + blockedHours.lectivo;
        subjectSummary.innerHTML += `
            <div class="subject-summary-totals" style="margin-top: 10px; border-top: 1px solid #ccc; padding-top: 10px;">
                <div class="subject-summary-item" style="font-weight: bold;">
                    Total horas lectivas: ${totalLectivas} (${horasMateriasLectivas} materias + ${blockedHours.lectivo} otras)
                </div>
                <div class="subject-summary-item complementario" style="font-weight: bold;">
                    Total horas complementarias: ${blockedHours.complementario}
                </div>
            </div>
        `;

    } else if (state.currentView === 'groupSchedule' && state.currentGroup) {
        // Lógica para el resumen del grupo
        const group = state.groups[state.currentGroup];
        if (!group) return;
        const summary = {};

        group.subjects.forEach(subject => {
            if (subject.name) {
                summary[subject.name] = { max: subject.hours, assigned: 0 };
            }
        });

        if (group.schedule) {
            Object.values(group.schedule).forEach(daySchedule => {

                Object.values(daySchedule).forEach(cell => {
                    const parsed = cell ? JSON.parse(cell) : null;
                    if (parsed && parsed.name && summary[parsed.name]) {
                        summary[parsed.name].assigned++;
                    }
                });
            });
        }


        subjectSummary.innerHTML = '<h3>Resumen de Horas</h3>';
        Object.entries(summary).forEach(([subject, { assigned, max }]) => {
            const statusClass = assigned > max ? 'hours-exceeded' : (assigned === max ? 'hours-complete' : 'hours-incomplete');
            subjectSummary.innerHTML += `<div class="subject-summary-item ${statusClass}">${subject}: ${assigned}/${max} horas</div>`;
        });
    }
}