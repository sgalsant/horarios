import { state, DAYS, PERIODS, saveState } from './state.js';
import { updateSubjectSummary } from './subject-management.js';
import { getSubjectColorClass } from './utils.js';
import { checkConflicts } from './conflicts.js';

export function initializeScheduleTable() {
    const scheduleTable = document.getElementById('scheduleTable');
    const tbody = scheduleTable.querySelector('tbody');
    tbody.innerHTML = '';

    const subjectSummary = document.getElementById('subjectSummary');
    if (subjectSummary) {
        subjectSummary.innerHTML = '';
    }

    PERIODS.forEach((period, i) => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${period}</td>`;
        
        DAYS.forEach((day, j) => {
            if (period === 'Recreo') {
                if (day === 'Lunes') {
                    row.innerHTML += '<td colspan="5" style="text-align: center;">Recreo</td>';
                }
            } else {
                const cell = document.createElement('td');
                cell.className = 'schedule-cell';
                cell.dataset.day = day;
                cell.dataset.period = i;
                
                if (state.currentView === 'teacherSchedule') {
                    // Crear div para mostrar el contenido
                    const contentDiv = document.createElement('div');
                    contentDiv.className = 'cell-content';
                    contentDiv.textContent = '-';
                    cell.appendChild(contentDiv);
                    
                    // Crear select oculto para selección de materias/bloqueo
                    const select = document.createElement('select');
                    select.style.display = 'none';
                    select.innerHTML = '<option value="">-</option><option value="BLOCKED">Bloqueado</option>';
                    cell.appendChild(select);
                    
                    // Si ya hay un profesor seleccionado, inicializar las opciones
                    if (state.currentTeacher) {
                        updateTeacherScheduleOptions(select, state.currentTeacher, cell.dataset.period);
                    }
                    
                    // Añadir evento de clic para mostrar el select
                    contentDiv.addEventListener('click', function() {
                        if (state.currentView === 'teacherSchedule' && state.currentTeacher) {
                            // Asegurarse de que las opciones estén actualizadas
                            updateTeacherScheduleOptions(select, state.currentTeacher, cell.dataset.period);
                            // Asegurarse de que la opción de bloqueo esté siempre presente
                            if (!select.querySelector('option[value="BLOCKED"]')) {
                                const blockedOption = document.createElement('option');
                                blockedOption.value = 'BLOCKED';
                                blockedOption.textContent = 'Bloqueado';
                                select.insertBefore(blockedOption, select.firstChild.nextSibling);
                            }
                            contentDiv.style.display = 'none';
                            select.style.display = 'block';
                            select.focus();
                        }
                    });
                    
                    // Ocultar select al perder el foco
                    select.addEventListener('blur', function() {
                        select.style.display = 'none';
                        contentDiv.style.display = 'block';
                    });
                    
                    // Actualizar el contenido al cambiar el select
                    select.addEventListener('change', function() {
                        const selectedValue = this.value ? (this.value === 'BLOCKED' ? {blocked: true} : JSON.parse(this.value)) : null;
                        const selectedOption = select.options[select.selectedIndex];
                        const day = cell.dataset.day;
                        const period = cell.dataset.period;
                        
                        // Limpiar clases existentes
                        cell.classList.remove(...Array.from(cell.classList)
                            .filter(cls => cls.startsWith('subject-color-') || cls === 'blocked-cell'));
                        
                        // Actualizar el contenido visual
                        if (selectedValue) {
                            if (selectedValue.blocked) {
                                contentDiv.textContent = 'BLOQUEADO';
                                cell.classList.add('blocked-cell');
                            } else {
                                contentDiv.textContent = `${selectedValue.name} - ${selectedValue.groupName}`;
                                cell.classList.add(getSubjectColorClass(selectedValue.name));
                                
                                // Verificar si la materia está en el grupo correspondiente
                                const group = state.groups[selectedValue.groupId];
                                const subject = group?.subjects?.find(s => s.id === selectedValue.id);
                                if (subject) {
                                    // Actualizar con los datos más recientes
                                    selectedValue.name = subject.name;
                                    selectedValue.teacher = subject.teacher;
                                    contentDiv.textContent = `${subject.name} - ${group.name}`;
                                }
                            }
                        } else {
                            contentDiv.textContent = '-';
                        }
                        
                        // Guardar el cambio
                        saveTeacherScheduleChange(state.currentTeacher, day, period, selectedValue);
                        
                        select.style.display = 'none';
                        contentDiv.style.display = 'block';
                    });
                } else {
                    // Crear div para mostrar el contenido
                    const contentDiv = document.createElement('div');
                    contentDiv.className = 'cell-content';
                    contentDiv.textContent = '-';
                    cell.appendChild(contentDiv);
                    
                    // Crear select oculto
                    const select = document.createElement('select');
                    select.style.display = 'none';
                    select.innerHTML = '<option value="">-</option>';
                    cell.appendChild(select);
                    
                    // Añadir evento de clic para mostrar el select
                    contentDiv.addEventListener('click', function() {
                        if (state.currentView === 'groupSchedule') {
                            contentDiv.style.display = 'none';
                            select.style.display = 'block';
                            select.focus();
                        }
                    });
                    
                    // Ocultar select al perder el foco
                    select.addEventListener('blur', function() {
                        select.style.display = 'none';
                        contentDiv.style.display = 'block';
                    });
                    
                    // Actualizar el contenido al cambiar el select
                    select.addEventListener('change', function() {
                        const selectedValue = this.value ? JSON.parse(this.value) : null;
                        const selectedOption = select.options[select.selectedIndex];
                        const day = cell.dataset.day;
                        const period = cell.dataset.period;
                        
                        // Actualizar el contenido visual
                        if (selectedValue) {
                            contentDiv.textContent = selectedOption.textContent;
                            cell.classList.remove(...Array.from(cell.classList)
                                .filter(cls => cls.startsWith('subject-color-')));
                            cell.classList.add(getSubjectColorClass(selectedValue.name));
                        } else {
                            contentDiv.textContent = '-';
                            cell.classList.remove(...Array.from(cell.classList)
                                .filter(cls => cls.startsWith('subject-color-')));
                        }
                        
                        // Guardar el cambio
                        saveScheduleChange(state.groups[state.currentGroup], day, period, selectedValue);
                        
                        select.style.display = 'none';
                        contentDiv.style.display = 'block';
                    });
                }
                
                row.appendChild(cell);
            }
        });
        
        tbody.appendChild(row);
    });

    if (state.currentView === 'groupSchedule' && state.currentGroup && state.groups[state.currentGroup]) {
        const currentGroup = state.groups[state.currentGroup];
        if (!currentGroup.schedule) {
            currentGroup.schedule = {};
        }
        loadGroupSchedule(currentGroup, tbody);
    } else if (state.currentView === 'teacherSchedule') {
        if (state.currentTeacher) {
            loadTeacherSchedule(state.currentTeacher, tbody);
        } else {
            // Si no hay profesor seleccionado, mostrar mensaje
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 6;
            cell.style.textAlign = 'center';
            cell.textContent = 'Seleccione un profesor para ver su horario';
            row.appendChild(cell);
            tbody.appendChild(row);
        }
    }
}

export function loadGroupSchedule(currentGroup, tbody) {
    // Primero inicializar todas las celdas con opciones de asignaturas
    const cells = tbody.querySelectorAll('.schedule-cell');
    cells.forEach(cell => {
        const select = cell.querySelector('select');
        if (select) {
            select.innerHTML = '<option value="">-</option>';
            if (currentGroup.subjects) {
                currentGroup.subjects.forEach(subject => {
                    if (subject.name && subject.teacher) {
                        const option = document.createElement('option');
                        option.value = JSON.stringify({ 
                            id: subject.id,
                            name: subject.name, 
                            teacher: subject.teacher 
                        });
                        option.textContent = `${subject.name} - ${subject.teacher}`;
                        select.appendChild(option);
                    }
                });
            }
        }
    });
    
    // Luego restaurar los valores guardados
    DAYS.forEach(day => {
        if (currentGroup.schedule[day]) {
            Object.entries(currentGroup.schedule[day]).forEach(([period, value]) => {
                const cell = tbody.querySelector(`td[data-day="${day}"][data-period="${period}"]`);
                if (!cell) return;

                const select = cell.querySelector('select');
                const contentDiv = cell.querySelector('.cell-content');
                
                if (select && contentDiv && value) {
                    try {
                        const cellData = typeof value === 'string' ? JSON.parse(value) : value;
                        select.value = JSON.stringify(cellData);
                        
                        if (cellData.name) {
                            contentDiv.textContent = `${cellData.name} - ${cellData.teacher}`;
                            contentDiv.style.display = 'block';
                            cell.classList.remove(...Array.from(cell.classList)
                                .filter(cls => cls.startsWith('subject-color-')));
                            cell.classList.add(getSubjectColorClass(cellData.name));
                        }
                    } catch (e) {
                        console.error('Error al parsear el valor de la celda:', e);
                        contentDiv.textContent = '-';
                        select.value = '';
                    }
                }
            });
        }
    });
}

function updateCellFromSchedule(cell, value) {
    const contentDiv = cell.querySelector('.cell-content');
    const select = cell.querySelector('select');
    
    if (!contentDiv) return;
    
    // Limpiar clases de color existentes
    cell.classList.remove(...Array.from(cell.classList)
        .filter(cls => cls.startsWith('subject-color-')));

    try {
        // Procesar el valor
        const cellData = typeof value === 'string' ? JSON.parse(value) : value;
        
        if (cellData) {
            if (cellData.blocked) {
                if (select) select.value = 'BLOCKED';
                contentDiv.textContent = 'BLOQUEADO';
                cell.classList.add('blocked-cell');
            } else if (cellData.id) {
                // Buscar la materia actual por ID
                const currentSubject = Object.values(state.groups).flatMap(group => 
                    group.subjects || []
                ).find(subject => subject.id === cellData.id);
                
                if (currentSubject) {
                    const group = Object.values(state.groups).find(g => 
                        g.subjects?.some(s => s.id === cellData.id)
                    );
                    
                    if (select) {
                        select.value = JSON.stringify({
                            id: currentSubject.id,
                            name: currentSubject.name,
                            teacher: currentSubject.teacher,
                            groupId: group?.id,
                            groupName: group?.name
                        });
                    }
                    // Actualizar el contenido visible con el nombre actual
                    const displayText = state.currentView === 'teacherSchedule' ?
                        `${currentSubject.name} - ${group?.name}` :
                        `${currentSubject.name} - ${currentSubject.teacher}`;
                    contentDiv.textContent = displayText;
                    cell.classList.remove(...Array.from(cell.classList).filter(cls => cls.startsWith('subject-color-')));
                    cell.classList.add(getSubjectColorClass(currentSubject.name));

                    // Actualizar el valor guardado con los datos actualizados
                    if (state.currentView === 'teacherSchedule' && state.teacherSchedules?.[state.currentTeacher]?.[cellData.day]?.[cellData.period]) {
                        state.teacherSchedules[state.currentTeacher][cellData.day][cellData.period] = JSON.stringify({
                            id: currentSubject.id,
                            name: currentSubject.name,
                            teacher: currentSubject.teacher,
                            groupId: group?.id,
                            groupName: group?.name
                        });
                    }
                } else {
                    // Si no se encuentra la materia, limpiar la celda
                    if (select) select.value = '';
                    contentDiv.textContent = '-';
                    cell.classList.remove(...Array.from(cell.classList).filter(cls => cls.startsWith('subject-color-')));
                }
            }
        } else {
            if (select) select.value = '';
            contentDiv.textContent = '-';
            cell.classList.remove('blocked-cell');
        }
    } catch (e) {
        console.error('Error al procesar valor del horario:', e);
        select.value = '';
        contentDiv.textContent = '-';
    }
    
    contentDiv.style.display = 'block';
    select.style.display = 'none';
}

function saveScheduleChange(group, day, period, value) {
    if (!group.schedule) {
        group.schedule = {};
    }
    
    if (value) {
        if (!group.schedule[day]) {
            group.schedule[day] = {};
        }
        const valueToSave = typeof value === 'string' ? value : JSON.stringify(value);
        group.schedule[day][period] = valueToSave;
    } else {
        if (group.schedule[day]) {
            delete group.schedule[day][period];
            if (Object.keys(group.schedule[day]).length === 0) {
                delete group.schedule[day];
            }
        }
    }
    
    saveState();
    // Forzar actualización de la visualización
    const cell = document.querySelector(`td[data-day="${day}"][data-period="${period}"]`);
    if (cell) {
        const contentDiv = cell.querySelector('.cell-content');
        const select = cell.querySelector('select');
        if (contentDiv && select && value) {
            const cellData = typeof value === 'string' ? JSON.parse(value) : value;
            contentDiv.textContent = `${cellData.name} - ${cellData.teacher}`;
            cell.classList.remove(...Array.from(cell.classList)
                .filter(cls => cls.startsWith('subject-color-')));
            cell.classList.add(getSubjectColorClass(cellData.name));
        }
    }
}

export function updateScheduleSelects() {
    const scheduleTable = document.getElementById('scheduleTable');
    if (!state.currentGroup || !scheduleTable) return;
    
    const currentGroup = state.groups[state.currentGroup];
    if (!currentGroup.schedule) {
        currentGroup.schedule = {};
    }
    
    const cells = scheduleTable.querySelectorAll('.schedule-cell');
    
    cells.forEach(cell => {
        const select = cell.querySelector('select');
        const contentDiv = cell.querySelector('.cell-content');
        const day = cell.dataset.day;
        const period = cell.dataset.period;
        
        if (!select || !contentDiv) return;
        
        // Guardar el valor actual del schedule antes de limpiar el select
        const scheduleValue = currentGroup.schedule[day]?.[period];
        
        // Limpiar y rellenar las opciones del select
        select.innerHTML = '<option value="">-</option>';
        
        if (currentGroup.subjects) {
            currentGroup.subjects.forEach(subject => {
                if (subject.name && subject.teacher) {
                    const option = document.createElement('option');
                    option.value = JSON.stringify({ id: subject.id, name: subject.name, teacher: subject.teacher });
                    option.textContent = `${subject.name} - ${subject.teacher}`;
                    select.appendChild(option);
                }
            });
        }
        
        // Restaurar el valor guardado en el schedule y actualizarlo si la materia cambió
        if (scheduleValue) {
            try {
                const cellData = typeof scheduleValue === 'string' ? JSON.parse(scheduleValue) : scheduleValue;
                
                // Buscar la materia por ID
                const subject = currentGroup.subjects?.find(subject => subject.id === cellData.id);
                
                if (subject) {
                    // Actualizar los datos con el nombre y profesor actuales
                    const updatedCellData = {
                        id: subject.id,
                        name: subject.name,
                        teacher: subject.teacher
                    };
                    select.value = JSON.stringify(updatedCellData);
                    contentDiv.textContent = `${subject.name} - ${subject.teacher}`;
                    cell.classList.remove(...Array.from(cell.classList)
                        .filter(cls => cls.startsWith('subject-color-')));
                    cell.classList.add(getSubjectColorClass(subject.name));
                    
                    // Actualizar el valor en el schedule
                    if (currentGroup.schedule[day]) {
                        currentGroup.schedule[day][period] = JSON.stringify(updatedCellData);
                    }
                } else {
                    // Si la materia ya no existe, limpiar la celda
                    select.value = '';
                    contentDiv.textContent = '-';
                    cell.classList.remove(...Array.from(cell.classList)
                        .filter(cls => cls.startsWith('subject-color-')));
                    
                    // Eliminar la asignación del horario
                    if (currentGroup.schedule[day]) {
                        delete currentGroup.schedule[day][period];
                        if (Object.keys(currentGroup.schedule[day]).length === 0) {
                            delete currentGroup.schedule[day];
                        }
                    }
                }
            } catch (e) {
                console.error('Error al procesar valor del schedule:', e);
            }
        } else {
            select.value = '';
            contentDiv.textContent = '-';
            cell.classList.remove(...Array.from(cell.classList)
                .filter(cls => cls.startsWith('subject-color-')));
        }
        
        // El contenido visible ya está actualizado por el bloque anterior que maneja scheduleValue
        contentDiv.style.display = 'block';
        select.style.display = 'none';
        
        if (!select.hasEventListener) {
            select.addEventListener('change', function() {
                const value = this.value ? JSON.parse(this.value) : null;
                const selectedOption = this.options[this.selectedIndex];
                
                const day = cell.dataset.day;
                const period = cell.dataset.period;
                
                cell.classList.remove(...Array.from(cell.classList)
                    .filter(cls => cls.startsWith('subject-color-')));
                
                // Asegurarse de que la estructura del horario existe
                if (!currentGroup.schedule) {
                    currentGroup.schedule = {};
                }
                if (!currentGroup.schedule[day]) {
                    currentGroup.schedule[day] = {};
                }
                
                // Si hay un valor, guardarlo como string JSON
                if (value) {
                    currentGroup.schedule[day][period] = JSON.stringify(value);
                } else {
                    // Si no hay valor, eliminar la entrada
                    delete currentGroup.schedule[day][period];
                    // Si el día queda vacío, eliminarlo también
                    if (Object.keys(currentGroup.schedule[day]).length === 0) {
                        delete currentGroup.schedule[day];
                    }
                }
                
                if (value && value.name) {
                    contentDiv.textContent = selectedOption.textContent;
                    cell.classList.add(getSubjectColorClass(value.name));
                } else {
                    contentDiv.textContent = '-';
                }
                
                // Ocultar select y mostrar contenido
                select.style.display = 'none';
                contentDiv.style.display = 'block';
                
                // Guardar en el estado global y localStorage
                saveState();
                updateSubjectSummary();
                checkConflicts();
            });
            select.hasEventListener = true;
        }
    });
}

export function loadTeacherSchedule(teacher, tbody) {
    if (!state.teacherSchedules) {
        state.teacherSchedules = {};
    }
    if (!state.teacherSchedules[teacher]) {
        state.teacherSchedules[teacher] = {};
    }

    // Primero, inicializar todas las celdas con las opciones correctas
    const cells = tbody.querySelectorAll('.schedule-cell');
    cells.forEach(cell => {
        const select = cell.querySelector('select');
        if (select) {
            // Actualizar las opciones del select con las materias del profesor
            updateTeacherScheduleOptions(select, teacher, cell.dataset.period);
        }
    });

    // Luego restaurar los valores guardados
    DAYS.forEach(day => {
        if (state.teacherSchedules[teacher][day]) {
            Object.entries(state.teacherSchedules[teacher][day]).forEach(([period, value]) => {
                const cell = tbody.querySelector(`td[data-day="${day}"][data-period="${period}"]`);
                if (!cell) return;

                const select = cell.querySelector('select');
                const contentDiv = cell.querySelector('.cell-content');
                
                if (contentDiv && value) {
                    try {
                        // Asegurarse de que el select tenga todas las opciones antes de asignar un valor
                        updateTeacherScheduleOptions(select, teacher, period);

                        if (value === 'BLOCKED' || (typeof value === 'string' && value.includes('"blocked":true'))) {
                            select.value = 'BLOCKED';
                            contentDiv.textContent = 'BLOQUEADO';
                            cell.classList.add('blocked-cell');
                            return;
                        }

                        const cellData = typeof value === 'string' ? JSON.parse(value) : value;
                        if (cellData.blocked) {
                            select.value = 'BLOCKED';
                            contentDiv.textContent = 'BLOQUEADO';
                            cell.classList.add('blocked-cell');
                        } else if (cellData.id) {
                            // Buscar la materia actual por ID
                            const currentSubject = Object.values(state.groups).flatMap(group => 
                                group.subjects || []
                            ).find(subject => subject.id === cellData.id);

                            if (currentSubject) {
                                const group = Object.values(state.groups).find(g => 
                                    g.subjects?.some(s => s.id === cellData.id)
                                );
                                const valueToSet = JSON.stringify({
                                    id: currentSubject.id,
                                    name: currentSubject.name,
                                    teacher: currentSubject.teacher,
                                    groupId: group?.id,
                                    groupName: group?.name
                                });
                                select.value = valueToSet;
                                contentDiv.textContent = `${currentSubject.name} - ${group?.name}`;
                                cell.classList.remove(...Array.from(cell.classList)
                                    .filter(cls => cls.startsWith('subject-color-')));
                                cell.classList.add(getSubjectColorClass(currentSubject.name));
                            }
                        }
                    } catch (e) {
                        console.error('Error al procesar valor del horario del profesor:', e);
                        contentDiv.textContent = '-';
                        select.value = '';
                    }
                }
            });
        }
    });
}

export function updateTeacherScheduleOptions(select, teacher, period) {
    // Restablecer las opciones
    select.innerHTML = '';
    
    // Añadir opciones por defecto
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = '-';
    select.appendChild(emptyOption);

    const blockedOption = document.createElement('option');
    blockedOption.value = 'BLOCKED';
    blockedOption.textContent = 'Bloqueado';
    select.appendChild(blockedOption);
    
    // Buscar todas las materias del profesor en todos los grupos y ordenarlas por nombre
    const options = [];
    Object.entries(state.groups).forEach(([groupId, group]) => {
        if (group.subjects) {
            const teacherSubjects = group.subjects.filter(subject => subject.teacher === teacher);
            teacherSubjects.forEach(subject => {
                const optionData = {
                    id: subject.id,
                    name: subject.name,
                    teacher: subject.teacher,
                    groupId: groupId,
                    groupName: group.name
                };
                options.push({
                    value: JSON.stringify(optionData),
                    text: `${subject.name} - ${group.name}`,
                    name: subject.name
                });
            });
        }
    });
    
    // Ordenar las opciones por nombre de materia y agregarlas al select
    options.sort((a, b) => a.name.localeCompare(b.name));
    options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.value;
        optionElement.textContent = option.text;
        select.appendChild(optionElement);
    });
}

function saveTeacherScheduleChange(teacher, day, period, value) {
    if (!state.teacherSchedules) {
        state.teacherSchedules = {};
    }
    if (!state.teacherSchedules[teacher]) {
        state.teacherSchedules[teacher] = {};
    }
    if (!state.teacherSchedules[teacher][day]) {
        state.teacherSchedules[teacher][day] = {};
    }
    
    if (value) {
        state.teacherSchedules[teacher][day][period] = typeof value === 'string' ? value : JSON.stringify(value);
    } else {
        delete state.teacherSchedules[teacher][day][period];
        if (Object.keys(state.teacherSchedules[teacher][day]).length === 0) {
            delete state.teacherSchedules[teacher][day];
        }
    }
    
    saveState();
}

export function createScheduleStructure(tbody) {
    if (!tbody) return;

    PERIODS.forEach((period, index) => {
        const row = document.createElement('tr');
        const periodCell = document.createElement('td');
        periodCell.textContent = period;
        row.appendChild(periodCell);
        
        DAYS.forEach(day => {
            if (period === 'Recreo') {
                if (day === 'Lunes') {
                    const breakCell = document.createElement('td');
                    breakCell.colSpan = 5;
                    breakCell.style.textAlign = 'center';
                    breakCell.textContent = 'Recreo';
                    row.appendChild(breakCell);
                }
            } else {
                const cell = document.createElement('td');
                cell.className = 'schedule-cell';
                cell.dataset.day = day;
                cell.dataset.period = index;
                row.appendChild(cell);
            }
        });
        
        tbody.appendChild(row);
    });
}

