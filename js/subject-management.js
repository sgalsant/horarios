import { state, saveState } from './state.js';
import { updateTeacherSelect, switchView } from './main.js';
import { initializeScheduleTable } from './schedule-view.js';

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
            
            group.subjects = group.subjects.filter(subject => subject.id !== subjectId);
            
            subjectsList.removeChild(subjectItem);
            
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
        }
    });

    subjectItem.querySelectorAll('input').forEach(input => {
        input.addEventListener('change', () => {
            updateSubjects();
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
    
    subjectItem.dataset.subjectId = newSubject.id;
    
    saveState();
    updateSubjects();
}

export function updateSubjects() {
    if (!state.currentGroup) return;
    
    const group = state.groups[state.currentGroup];
    
    subjectsList.innerHTML = '';
    
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
        
        const removeBtn = subjectItem.querySelector('.remove-subject');
        removeBtn.addEventListener('click', () => {
            if (confirm('¿Está seguro de que desea eliminar esta materia? Esta acción no se puede deshacer.')) {
                const subjectId = subjectItem.dataset.subjectId;
                group.subjects = group.subjects.filter(s => s.id !== subjectId);
                subjectsList.removeChild(subjectItem);
                saveState();
                // Refresh the schedule view if it's open
                if (state.currentView === 'groupSchedule' || state.currentView === 'teacherSchedule') {
                    initializeScheduleTable();
                }
            }
        });
        
        subjectItem.querySelectorAll('input').forEach(input => {
            input.addEventListener('change', () => {
                const [nameInput, hoursInput, teacherInput] = subjectItem.querySelectorAll('input');
                const subjectToUpdate = group.subjects.find(s => s.id === subject.id);
                if (subjectToUpdate) {
                    subjectToUpdate.name = nameInput.value;
                    subjectToUpdate.hours = parseInt(hoursInput.value) || 0;
                    subjectToUpdate.teacher = teacherInput.value;
                    
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
                    
                    saveState();
                }
                
                if (state.currentView === 'groupSchedule' || state.currentView === 'teacherSchedule') {
                    initializeScheduleTable();
                }
                updateSubjectSummary();
            });
        });
        
        subjectsList.appendChild(subjectItem);
    });
    
    updateTeacherSelect();
}

export function updateSubjectSummary() {
    const subjectSummary = document.getElementById('subjectSummary');
    if (!subjectSummary) {
        return;
    }

    subjectSummary.innerHTML = '';

    if (state.currentView === 'teacherSchedule' && state.currentTeacher) {
        const teacher = state.currentTeacher;
        const teacherSummary = {};
        let totalAssignedHours = 0;
        
        Object.values(state.groups).forEach(group => {
            group.subjects.forEach(subject => {
                if (subject.teacher === teacher) {
                    if (!teacherSummary[subject.name]) {
                        teacherSummary[subject.name] = { assigned: 0, max: subject.hours, byGroup: {} };
                    } else {
                        teacherSummary[subject.name].max += subject.hours;
                    }
                }
            });

            if (group.schedule) {
                 Object.values(group.schedule).forEach(daySchedule => {
                    Object.values(daySchedule).forEach(cell => {
                        if (cell) {
                            const cellData = typeof cell === 'string' ? JSON.parse(cell) : cell;
                            if (cellData && cellData.teacher === teacher) {
                                if (teacherSummary[cellData.name]) {
                                    teacherSummary[cellData.name].assigned++;
                                    totalAssignedHours++;
                                    if (!teacherSummary[cellData.name].byGroup[group.name]) {
                                        teacherSummary[cellData.name].byGroup[group.name] = 0;
                                    }
                                    teacherSummary[cellData.name].byGroup[group.name]++;
                                }
                            }
                        }
                    });
                });
            }
        });

        subjectSummary.innerHTML = '<h3>Resumen de Horas del Profesor</h3>';
        Object.entries(teacherSummary).forEach(([subject, data]) => {
            const { assigned, max } = data;
            const statusClass = assigned > max ? 'hours-exceeded' : (assigned === max ? 'hours-complete' : 'hours-incomplete');
            subjectSummary.innerHTML += `<div class="subject-summary-item ${statusClass}">${subject}: ${assigned}/${max} horas</div>`;
        });

    } else if (state.currentView === 'groupSchedule' && state.currentGroup) {
        const currentGroup = state.groups[state.currentGroup];
        const summary = {};
        
        currentGroup.subjects.forEach(subject => {
            if (subject.name) {
                summary[subject.name] = { assigned: 0, max: subject.hours };
            }
        });

        if (currentGroup.schedule) {
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
        }

        subjectSummary.innerHTML = '<h3>Resumen de Horas</h3>';
        Object.entries(summary).forEach(([subject, { assigned, max }]) => {
            const statusClass = assigned > max ? 'hours-exceeded' : (assigned === max ? 'hours-complete' : 'hours-incomplete');
            subjectSummary.innerHTML += `<div class="subject-summary-item ${statusClass}">${subject}: ${assigned}/${max} horas</div>`;
        });
    }
}