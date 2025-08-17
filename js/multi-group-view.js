import { state, DAYS, PERIODS } from './state.js';
import { createScheduleStructure } from './schedule-view.js';

export function showMultiGroupView() {
    const multiViewControls = document.getElementById('multiViewControls');
    const multiViewType = document.getElementById('multiViewType');
    const multiViewEditable = document.getElementById('multiViewEditable');
    const shiftFilter = document.getElementById('shiftFilter');
    
    // Configurar event listeners si no existen
    if (!multiViewType.hasListener) {
        multiViewType.addEventListener('change', () => showMultiGroupView());
        multiViewType.hasListener = true;
    }
    
    if (!multiViewEditable.hasListener) {
        multiViewEditable.addEventListener('change', () => showMultiGroupView());
        multiViewEditable.hasListener = true;
    }

    if (!shiftFilter.hasListener) {
        shiftFilter.addEventListener('change', () => showMultiGroupView());
        shiftFilter.hasListener = true;
    }
    
    multiViewControls.style.display = 'flex';
    
    const scheduleContainer = document.getElementById('scheduleContainer');
    scheduleContainer.innerHTML = '<div class="multi-group-view"></div>';
    const multiGroupView = scheduleContainer.querySelector('.multi-group-view');
    
    // Determinar si mostrar grupos o profesores
    const showTeachers = multiViewType.value === 'teachers';
    const selectedShift = shiftFilter.value;
    
    if (showTeachers) {
        showMultiTeacherView(multiViewEditable.checked, selectedShift);
    } else {
        showMultiGroupSchedules(multiViewEditable.checked, selectedShift);
    }
};

// Función auxiliar para crear una sección de horario
function createScheduleSection(title, value, isEditable) {
    const section = document.createElement('div');
    section.className = 'schedule-section';
    
    // Crear encabezado con botón para contraer/expandir
    const header = document.createElement('div');
    header.className = 'section-header';
    header.innerHTML = `
        <h3>${title}</h3>
        <button class="toggle-btn">
            <i class="fas fa-chevron-up"></i>
        </button>
    `;
    
    // Contenido de la sección
    const content = document.createElement('div');
    content.className = 'section-content';
    
    // Crear tabla
    const table = document.createElement('table');
    table.className = 'schedule-table-common';
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');
    
    // Crear encabezado
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = `
        <th>Hora</th>
        ${DAYS.map(day => `<th>${day}</th>`).join('')}
    `;
    thead.appendChild(headerRow);
    
    // Crear filas
    PERIODS.forEach((period, i) => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${period}</td>`;
        
        DAYS.forEach(day => {
            if (period === 'Recreo') {
                row.innerHTML += '<td>Recreo</td>';
            } else {
                const cell = document.createElement('td');
                cell.className = 'schedule-cell';
                const content = getCellContent(day, i, value);
                if (isEditable) {
                    cell.appendChild(createEditableSelect(day, i, value));
                } else {
                    if (Array.isArray(content)) {
                        // Vista de profesor
                        cell.innerHTML = content.map(item => 
                            `<div class="${item.colorClass}">${item.name} - ${item.group}</div>`
                        ).join('');
                    } else if (content) {
                        // Vista de grupo
                        cell.innerHTML = `<div class="${content.colorClass}">${content.name} - ${content.teacher}</div>`;
                    } else {
                        cell.innerHTML = '-';
                    }
                }
                row.appendChild(cell);
            }
        });
        
        tbody.appendChild(row);
    });
    
    table.appendChild(thead);
    table.appendChild(tbody);
    content.appendChild(table);
    
    section.appendChild(header);
    section.appendChild(content);
    
    // Añadir funcionalidad para contraer/expandir
    header.addEventListener('click', () => {
        section.classList.toggle('collapsed');
        const icon = header.querySelector('i');
        icon.classList.toggle('fa-chevron-up');
        icon.classList.toggle('fa-chevron-down');
    });
    
    return section;
}

// Función auxiliar para obtener el contenido de una celda
function getCellContent(day, period, value) {
    if (typeof value === 'string') {
        // Es un profesor, buscar sus clases en este horario
        let classes = [];
        Object.values(state.groups).forEach(group => {
            const scheduleValue = group.schedule[day]?.[period];
            if (scheduleValue && typeof scheduleValue === 'object' && scheduleValue.teacher === value) {
                classes.push({
                    name: scheduleValue.name,
                    group: group.name,
                    colorClass: getSubjectColorClass(scheduleValue.name)
                });
            }
        });
        return classes;
    } else {
        // Es un grupo, obtener la materia programada
        const scheduleValue = value.schedule[day]?.[period];
        if (scheduleValue && typeof scheduleValue === 'object') {
            return {
                name: scheduleValue.name,
                teacher: scheduleValue.teacher,
                colorClass: getSubjectColorClass(scheduleValue.name)
            };
        }
        return null;
    }
}

// Función auxiliar para encontrar las clases de un profesor
function findTeacherClasses(teacher, day, period) {
    let classes = [];
    Object.values(state.groups).forEach(group => {
        const scheduleValue = group.schedule[day]?.[period];
        if (scheduleValue && typeof scheduleValue === 'object' && scheduleValue.teacher === teacher) {
            classes.push(`${scheduleValue.name} - ${group.name}`);
        }
    });
    return classes.length > 0 ? classes.join('<br>') : '-';
}

// Función auxiliar para obtener la materia de un grupo
function getGroupSubject(group, day, period) {
    const scheduleValue = group.schedule[day]?.[period];
    if (scheduleValue && typeof scheduleValue === 'object') {
        return `${scheduleValue.name} - ${scheduleValue.teacher}`;
    }
    return '-';
}

// Función auxiliar para crear un select editable
function createEditableSelect(day, period, value) {
    const select = document.createElement('select');
    select.innerHTML = '<option value="">-</option>';
    
    if (typeof value === 'string') {
        // Es un profesor, mostrar grupos disponibles
        Object.values(state.groups).forEach(group => {
            group.subjects.forEach(subject => {
                if (subject.teacher === value) {
                    const option = document.createElement('option');
                    option.value = JSON.stringify({
                        group: group.id,
                        subject: subject.name,
                        teacher: value
                    });
                    option.textContent = `${subject.name} - ${group.name}`;
                    select.appendChild(option);
                }
            });
        });
    } else {
        // Es un grupo, mostrar sus materias
        value.subjects.forEach(subject => {
            if (subject.name && subject.teacher) {
                const option = document.createElement('option');
                option.value = JSON.stringify({
                    name: subject.name,
                    teacher: subject.teacher
                });
                option.textContent = `${subject.name} - ${subject.teacher}`;
                select.appendChild(option);
            }
        });
    }
    
    // Establecer valor actual si existe
    if (typeof value === 'string') {
        // Para vista de profesor
        Object.values(state.groups).forEach(group => {
            const scheduleValue = group.schedule[day]?.[period];
            if (scheduleValue && scheduleValue.teacher === value) {
                select.value = JSON.stringify({
                    group: group.id,
                    subject: scheduleValue.name,
                    teacher: value
                });
            }
        });
    } else {
        // Para vista de grupo
        const scheduleValue = value.schedule[day]?.[period];
        if (scheduleValue) {
            select.value = JSON.stringify(scheduleValue);
        }
    }
    
    // Manejar cambios
    select.addEventListener('change', function() {
        if (this.value) {
            const selectedValue = JSON.parse(this.value);
            if (selectedValue.group) {
                // Actualizar horario del grupo desde vista de profesor
                const group = state.groups[selectedValue.group];
                if (!group.schedule[day]) group.schedule[day] = {};
                group.schedule[day][period] = {
                    name: selectedValue.subject,
                    teacher: selectedValue.teacher
                };
            } else {
                // Actualizar desde vista de grupo
                if (!value.schedule[day]) value.schedule[day] = {};
                value.schedule[day][period] = selectedValue;
            }
            saveGroups();
            checkConflicts();
            window.showMultiGroupView(); // Refrescar vista
        }
    });
    
    return select;
}

// Vista múltiple de profesores
window.showMultiTeacherView = function(isEditable) {
    const scheduleContainer = document.getElementById('scheduleContainer');
    const multiGroupView = scheduleContainer.querySelector('.multi-group-view');
    multiGroupView.innerHTML = ''; // Limpiar vista actual
    
    // Obtener lista única de profesores
    const teachers = new Set();
    Object.values(state.groups).forEach(group => {
        group.subjects.forEach(subject => {
            if (subject.teacher) {
                teachers.add(subject.teacher);
            }
        });
    });
    
    // Mostrar horario para cada profesor
    teachers.forEach(teacher => {
        const teacherContainer = document.createElement('div');
        teacherContainer.className = 'multi-group-schedule';
        
        const header = document.createElement('h3');
        header.textContent = teacher;
        teacherContainer.appendChild(header);
        
        // Crear tabla de horario para el profesor
        const table = createScheduleTable(teacher, isEditable);
        teacherContainer.appendChild(table);
        multiGroupView.appendChild(teacherContainer);
    });
};

// Vista múltiple de grupos
window.showMultiGroupSchedules = function(isEditable) {
    const multiGroupView = document.querySelector('.multi-group-view');
    multiGroupView.innerHTML = '';
    
    Object.values(state.groups).forEach(group => {
        const groupContainer = document.createElement('div');
        groupContainer.className = 'multi-group-schedule';
        
        // Cabecera del grupo
        const header = document.createElement('h3');
        header.textContent = `${group.name || 'Sin nombre'} - ${group.course || 'Sin curso'}`;
        header.style.cursor = 'pointer';
        header.onclick = () => {
            state.currentGroup = group.id;
            switchView('group');
            loadGroupData(group.id);
        };
        groupContainer.appendChild(header);

        // Crear tabla para el grupo
        const table = createScheduleTable(group, isEditable);
        groupContainer.appendChild(table);

        // Agregar resumen de horas por materia
        const summary = document.createElement('div');
        summary.className = 'subject-summary';
        
        // Calcular horas asignadas por materia
        const subjectHours = {};
        DAYS.forEach(day => {
            Object.values(group.schedule[day] || {}).forEach(value => {
                if (value && typeof value === 'object') {
                    subjectHours[value.name] = (subjectHours[value.name] || 0) + 1;
                }
            });
        });

        // Mostrar resumen de horas
        let summaryContent = '<h4>Resumen de Horas</h4>';
        group.subjects.forEach(subject => {
            const assigned = subjectHours[subject.name] || 0;
            const required = subject.hours || 0;
            const className = assigned < required ? 'hours-warning' : 
                            assigned > required ? 'hours-exceeded' : '';
            
            summaryContent += `
                <div class="subject-hours ${className}">
                    <span>${subject.name}: ${assigned}/${required} horas</span>
                    <span>${subject.teacher}</span>
                </div>
            `;
        });
        
        summary.innerHTML = summaryContent;
        groupContainer.appendChild(summary);
        multiGroupView.appendChild(groupContainer);
    });
};
