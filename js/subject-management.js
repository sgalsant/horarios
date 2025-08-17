import { state, saveState } from './state.js';
import { updateTeacherSelect } from './main.js';
import { updateScheduleSelects } from './schedule-view.js';

export function addSubject() {
    if (!state.currentGroup) {
        alert('Por favor, seleccione o cree un grupo primero');
        return;
    }

    const currentGroup = state.groups[state.currentGroup];
    if (currentGroup.subjects.length >= 8) {
        alert('No se pueden añadir más de 8 materias');
        return;
    }

    const subjectItem = document.createElement('div');
    subjectItem.className = 'subject-item';
    
    subjectItem.innerHTML = `
        <input type="text" placeholder="Nombre de la materia" required>
        <input type="number" placeholder="Horas semanales" min="1" max="20" required>
        <input type="text" placeholder="Nombre del profesor" required>
        <button type="button" class="remove-subject">Eliminar</button>
    `;

    subjectsList.appendChild(subjectItem);
    
    const removeBtn = subjectItem.querySelector('.remove-subject');
    removeBtn.addEventListener('click', () => {
        if (confirm('¿Está seguro de que desea eliminar esta materia? Esta acción no se puede deshacer.')) {
            const subjectId = subjectItem.dataset.subjectId;
            const group = state.groups[state.currentGroup];
            
            // Eliminar la materia del estado
            group.subjects = group.subjects.filter(subject => subject.id !== subjectId);
            
            // Eliminar la materia del DOM
            subjectsList.removeChild(subjectItem);
            
            // Eliminar las referencias en el horario
            if (group.schedule) {
                Object.values(group.schedule).forEach(daySchedule => {
                    Object.keys(daySchedule).forEach(period => {
                        const scheduleItem = daySchedule[period];
                        if (typeof scheduleItem === 'string') {
                            try {
                                const parsed = JSON.parse(scheduleItem);
                                if (parsed.id === subjectId) {
                                    delete daySchedule[period];
                                }
                            } catch (e) {
                                console.error('Error parsing schedule item:', e);
                            }
                        }
                    });
                });
            }
            
            saveState();
            updateSubjects();
            updateScheduleSelects();
        }
    });

    subjectItem.querySelectorAll('input').forEach(input => {
        input.addEventListener('change', () => {
            updateSubjects();
            updateScheduleSelects();
            updateSubjectSummary();
        });
    });

    const newSubject = {
        id: Date.now().toString(),
        name: '',
        hours: 0,
        teacher: ''
    };
    
    currentGroup.subjects.push(newSubject);
    
    // Agregar el ID como atributo del div para referencia
    subjectItem.dataset.subjectId = newSubject.id;
    
    saveState();
    updateSubjects();
    updateScheduleSelects();
}

export function updateSubjects() {
    if (!state.currentGroup) return;
    
    const group = state.groups[state.currentGroup];
    
    // Limpiar la lista actual
    subjectsList.innerHTML = '';
    
    // Recrear los elementos del DOM para cada materia
    group.subjects.forEach(subject => {
        const subjectItem = document.createElement('div');
        subjectItem.className = 'subject-item';
        subjectItem.dataset.subjectId = subject.id;
        
        subjectItem.innerHTML = `
            <input type="text" placeholder="Nombre de la materia" value="${subject.name || ''}" required>
            <input type="number" placeholder="Horas semanales" min="1" max="20" value="${subject.hours || ''}" required>
            <input type="text" placeholder="Nombre del profesor" value="${subject.teacher || ''}" required>
            <button type="button" class="remove-subject">Eliminar</button>
        `;
        
        // Configurar el botón de eliminar
        const removeBtn = subjectItem.querySelector('.remove-subject');
        removeBtn.addEventListener('click', () => {
            if (confirm('¿Está seguro de que desea eliminar esta materia? Esta acción no se puede deshacer.')) {
                const subjectId = subjectItem.dataset.subjectId;
                group.subjects = group.subjects.filter(s => s.id !== subjectId);
                subjectsList.removeChild(subjectItem);
                saveState();
                updateScheduleSelects();
            }
        });
        
        // Configurar eventos de cambio
        subjectItem.querySelectorAll('input').forEach(input => {
            input.addEventListener('change', () => {
                const [nameInput, hoursInput, teacherInput] = subjectItem.querySelectorAll('input');
                const subjectToUpdate = group.subjects.find(s => s.id === subject.id);
                if (subjectToUpdate) {
                    subjectToUpdate.name = nameInput.value;
                    subjectToUpdate.hours = parseInt(hoursInput.value) || 0;
                    subjectToUpdate.teacher = teacherInput.value;
                    
                    // Actualizar todos los horarios que usan esta materia
                    Object.values(state.groups).forEach(g => {
                        if (g.schedule) {
                            Object.keys(g.schedule).forEach(day => {
                                Object.keys(g.schedule[day]).forEach(period => {
                                    const cellData = typeof g.schedule[day][period] === 'string' ? 
                                        JSON.parse(g.schedule[day][period]) : g.schedule[day][period];
                                    if (cellData && cellData.id === subject.id) {
                                        g.schedule[day][period] = JSON.stringify({
                                            ...cellData,
                                            name: subjectToUpdate.name,
                                            teacher: subjectToUpdate.teacher
                                        });
                                    }
                                });
                            });
                        }
                    });
                    
                    // Actualizar horarios de profesores
                    if (state.teacherSchedules) {
                        Object.values(state.teacherSchedules).forEach(teacherSchedule => {
                            Object.keys(teacherSchedule).forEach(day => {
                                Object.keys(teacherSchedule[day]).forEach(period => {
                                    const cellData = typeof teacherSchedule[day][period] === 'string' ?
                                        JSON.parse(teacherSchedule[day][period]) : teacherSchedule[day][period];
                                    if (cellData && cellData.id === subject.id) {
                                        teacherSchedule[day][period] = JSON.stringify({
                                            ...cellData,
                                            name: subjectToUpdate.name,
                                            teacher: subjectToUpdate.teacher
                                        });
                                    }
                                });
                            });
                        });
                    }
                    
                    saveState();
                }
                
                // Forzar actualización de la interfaz
                const scheduleTable = document.getElementById('scheduleTable');
                if (scheduleTable) {
                    const tbody = scheduleTable.querySelector('tbody');
                    if (state.currentView === 'groupSchedule') {
                        loadGroupSchedule(group, tbody);
                    } else if (state.currentView === 'teacherSchedule' && state.currentTeacher) {
                        loadTeacherSchedule(state.currentTeacher, tbody);
                    }
                }
                
                updateScheduleSelects();
                updateSubjectSummary();
            });
        });
        
        subjectsList.appendChild(subjectItem);
    });
    
    updateTeacherSelect();
}

export function updateSubjectSummary() {
    if (!subjectSummary) {
        return;
    }

    subjectSummary.innerHTML = '';

    if (state.currentView === 'teacher' && state.currentTeacher) {
        const teacherSummary = {};
        let totalAssignedHours = 0;
        let lectivoHours = 0;
        let complementariaHours = 0;

        if (state.teacherBlocks[state.currentTeacher]) {
            Object.values(state.teacherBlocks[state.currentTeacher]).forEach(block => {
                if (block.type === 'lectivo') {
                    lectivoHours++;
                } else {
                    complementariaHours++;
                }
            });
        }
        
        Object.values(state.groups).forEach(group => {
            group.subjects.forEach(subject => {
                if (subject.teacher === state.currentTeacher) {
                    if (!teacherSummary[subject.name]) {
                        teacherSummary[subject.name] = {
                            assigned: 0,
                            max: 0,
                            byGroup: {}
                        };
                    }
                    teacherSummary[subject.name].max += subject.hours;
                }
            });
        });

        Object.entries(state.groups).forEach(([groupId, group]) => {
            Object.values(group.schedule).forEach(daySchedule => {
                Object.values(daySchedule).forEach(cell => {
                    if (cell) {
                        const cellData = typeof cell === 'string' ? JSON.parse(cell) : cell;
                        if (cellData && cellData.teacher === state.currentTeacher) {
                            teacherSummary[cellData.name].assigned++;
                            totalAssignedHours++;
                            if (!teacherSummary[cellData.name].byGroup[group.name]) {
                                teacherSummary[cellData.name].byGroup[group.name] = 0;
                            }
                            teacherSummary[cellData.name].byGroup[group.name]++;
                        }
                    }
                });
            });
        });

        subjectSummary.innerHTML = '<h3>Resumen de Horas del Profesor</h3>';
        Object.entries(teacherSummary).forEach(([subject, data]) => {
            const { assigned, max } = data;
            const isExceeded = assigned > max;
            const isComplete = assigned === max;
            let statusClass = '';
            let icon = '';

            if (isExceeded) {
                statusClass = 'hours-exceeded';
                icon = '<i class="fas fa-times-circle"></i>';
            } else if (isComplete) {
                statusClass = 'hours-complete';
                icon = '<i class="fas fa-check-circle"></i>';
            } else {
                statusClass = 'hours-incomplete';
                icon = '<i class="fas fa-exclamation-triangle"></i>';
            }

            subjectSummary.innerHTML += `
                <div class="subject-summary-item ${statusClass}">
                    ${icon} <strong>${subject}</strong>: ${data.assigned}/${data.max} horas totales
                    <div class="group-details">
                        ${Object.entries(data.byGroup).map(([group, hours]) => 
                            `<div class="group-hour">${group}: ${hours} horas</div>`
                        ).join('')}
                    </div>
                </div>
            `;
        });

        subjectSummary.innerHTML += `<hr><div class="total-hours"><strong>Horas lectivas: ${lectivoHours}</strong></div>`;
        subjectSummary.innerHTML += `<div class="total-hours"><strong>Horas complementarias: ${complementariaHours}</strong></div>`;
        subjectSummary.innerHTML += `<div class="total-hours"><strong>Total de horas asignadas: ${totalAssignedHours}</strong></div>`;
    } 
    else if (state.currentView === 'group' && state.currentGroup) {
        const currentGroup = state.groups[state.currentGroup];
        const summary = {};
        
        currentGroup.subjects.forEach(subject => {
            if (subject.name) {
                summary[subject.name] = {
                    assigned: 0,
                    max: subject.hours
                };
            }
        });

        Object.values(currentGroup.schedule).forEach(daySchedule => {
            Object.values(daySchedule).forEach(cell => {
                if (cell) {
                    const cellData = typeof cell === 'string' ? JSON.parse(cell) : cell;
                    if (cellData && cellData.name && summary[cellData.name]) {
                        summary[cellData.name].assigned++;
                    }
                }
            });
        });

        subjectSummary.innerHTML = '<h3>Resumen de Horas</h3>';
        Object.entries(summary).forEach(([subject, { assigned, max }]) => {
            const isExceeded = assigned > max;
            const isComplete = assigned === max;
            let statusClass = '';
            let icon = '';

            if (isExceeded) {
                statusClass = 'hours-exceeded';
                icon = '<i class="fas fa-times-circle"></i>';
            } else if (isComplete) {
                statusClass = 'hours-complete';
                icon = '<i class="fas fa-check-circle"></i>';
            } else {
                statusClass = 'hours-incomplete';
                icon = '<i class="fas fa-exclamation-triangle"></i>';
            }

            subjectSummary.innerHTML += `
                <div class="subject-summary-item ${statusClass}">
                    ${icon} ${subject}: ${assigned}/${max} horas
                </div>
            `;
        });
    }
}

function getSubjectColor(subjectName) {
    if (!state.subjectColors.has(subjectName)) {
        state.subjectColors.set(subjectName, generateColor());
        saveState();
    }
    return state.subjectColors.get(subjectName);
}

function generateColor() {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 70%, 80%)`;
}
