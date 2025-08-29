import { state, saveState, DAYS, PERIODS } from './state.js';
import { checkConflicts, findConflictForGroup } from './conflicts.js';
import { getSubjectColorClass } from './utils.js';
import { updateSubjectSummary } from './subject-management.js';

export function updateTeacherView() {
    // Inicializar eventos del modal
    initializeModalEvents();
    
    const teacher = state.currentTeacher;
    const scheduleContainer = document.getElementById('scheduleContainer');
    const summaryContainer = document.getElementById('subjectSummary');

    if (!teacher) {
        scheduleContainer.innerHTML = `<div style="text-align: center; margin-top: 20px;"><p>Seleccione un profesor para ver su horario</p></div>`;
        if (summaryContainer) summaryContainer.innerHTML = '';
        return;
    }

    const allGroups = Object.values(state.groups);
    const teacherBlocks = Object.values(state.teacherBlocks[teacher] || {});

    const hasMorningAssignments = allGroups.some(g => g.shift === 'morning' && hasScheduled(g, teacher)) || teacherBlocks.some(b => b.shift === 'morning');
    const hasAfternoonAssignments = allGroups.some(g => g.shift === 'afternoon' && hasScheduled(g, teacher)) || teacherBlocks.some(b => b.shift === 'afternoon');

    let html = `
        <div id="teacher-schedules">
            <div class="teacher-header">
                <h2>Horario de ${teacher}</h2>
                <button id="clearTeacherSchedule" class="danger-button">Limpiar horario</button>
            </div>`;
    if (!hasMorningAssignments && !hasAfternoonAssignments) {
        html += `<p style="text-align:center; margin-top:20px;">Este profesor no tiene asignaciones.</p>`;
    } else {
        if (hasMorningAssignments) {
            html += createScheduleTableHTML('Mañana', 'morning-schedule-table');
        }
        if (hasAfternoonAssignments) {
            html += createScheduleTableHTML('Tarde', 'afternoon-schedule-table');
        }
    }
    html += `</div>`;
    scheduleContainer.innerHTML = html;
    
    const summary = document.getElementById('subjectSummary');
    if(!summary) {
        const summaryDiv = document.createElement('div');
        summaryDiv.id = 'subjectSummary';
        scheduleContainer.parentElement.appendChild(summaryDiv);
    }


    if (hasMorningAssignments) {
        const morningTbody = document.querySelector('#morning-schedule-table tbody');
        populateTeacherTable(teacher, morningTbody, 'morning');
    }
    if (hasAfternoonAssignments) {
        const afternoonTbody = document.querySelector('#afternoon-schedule-table tbody');
        populateTeacherTable(teacher, afternoonTbody, 'afternoon');
    }

    // Inicializar los botones de colapsar/expandir
    document.querySelectorAll('.toggle-schedule').forEach(button => {
        button.addEventListener('click', () => {
            const tableId = button.getAttribute('aria-controls');
            const table = document.getElementById(tableId);
            const isExpanded = button.getAttribute('aria-expanded') === 'true';
            
            // Actualizar el estado del botón
            button.setAttribute('aria-expanded', !isExpanded);
            button.querySelector('.toggle-icon').textContent = isExpanded ? '▶' : '▼';
            
            // Mostrar/ocultar la tabla
            if (table) {
                table.style.display = isExpanded ? 'none' : 'table';
            }
        });
    });

    // Actualizar el resumen global
    updateSubjectSummary();
    
    // Inicializar el botón de limpiar horario
    const clearButton = document.getElementById('clearTeacherSchedule');
    if (clearButton) {
        clearButton.addEventListener('click', clearTeacherSchedule);
    }
}

function hasScheduled(group, teacher) {
    // Verificar si el profesor tiene materias asignadas en el grupo
    if (group.subjects && group.subjects.some(s => s.teacher === teacher)) {
        return true;
    }
    
    // Verificar si hay asignaciones en el horario
    if (!group.schedule) return false;
    return Object.values(group.schedule).some(day => 
        Object.values(day).some(cell => {
            if (!cell) return false;
            const p = JSON.parse(cell);
            return p && p.teacher === teacher;
        })
    );
}

function createScheduleTableHTML(title, id) {
    return `
        <div class="schedule-section">
            <div class="schedule-header">
                <h3>Turno de ${title}</h3>
                <button class="toggle-schedule" aria-expanded="true" aria-controls="${id}">
                    <span class="toggle-icon">▼</span>
                </button>
            </div>
            <table id="${id}" class="scheduleTable schedule-table-common">
                <thead><tr><th>Hora</th>${DAYS.map(d => `<th>${d}</th>`).join('')}</tr></thead>
                <tbody></tbody>
            </table>
        </div>
    `;
}

function populateTeacherTable(teacher, tbody, shift) {
    if (!tbody) return;
    
    PERIODS.forEach((period, i) => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${period}</td>`;
        if (period === 'Recreo') {
            row.innerHTML = `<td colspan="6" class="recreo-cell">Recreo</td>`;
            tbody.appendChild(row);
            return;
        }
        DAYS.forEach(day => {
            const cell = document.createElement('td');
            cell.className = 'schedule-cell';
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'cell-content';
            cell.appendChild(contentDiv);
            
            const select = document.createElement('select');
            select.style.display = 'none';
            select.dataset.day = day;
            select.dataset.period = i;
            cell.appendChild(select);

                const blockKey = `${teacher}-${day}-${i}`;
                const block = state.teacherBlocks[teacher]?.[blockKey];
                let cellData = null;
                let groupName = '';
                
                // Solo mostrar el bloque si corresponde al turno actual
                const blockMatchesShift = block && (!block.shift || block.shift === shift);            if (block && blockMatchesShift) {
                cellData = { blocked: true, reason: block.reason, type: block.type };
            } else {
                for (const group of Object.values(state.groups)) {
                    if (group.shift === shift && group.schedule?.[day]?.[i]) {
                        const parsed = JSON.parse(group.schedule[day][i]);
                        if (parsed.teacher === teacher) {
                            cellData = parsed;
                            groupName = group.name;
                            break;
                        }
                    }
                }
            }


            if (cellData) {
                if (cellData.blocked) {
                    contentDiv.textContent = cellData.reason || 'Bloqueado';
                    cell.classList.add('blocked-cell');
                    if (cellData.type) {
                        cell.classList.add(cellData.type);
                    }
                    contentDiv.dataset.originalValue = JSON.stringify({ blocked: true, type: cellData.type, reason: cellData.reason });
                } else {
                    contentDiv.textContent = `${cellData.name} (${groupName})`;
                    const group = Object.values(state.groups).find(g => g.name === groupName);
                    const subject = group.subjects.find(s => s.name === cellData.name && s.teacher === teacher);
                    if (subject && subject.color) {
                        cell.style.backgroundColor = subject.color;
                    } else {
                        cell.classList.add(getSubjectColorClass(cellData));
                    }
                    // Para materias asignadas, necesitamos guardar también el groupId
                    // Buscar el grupo y asignación actual
                    const [currentGroupId] = Object.entries(state.groups).find(([id, g]) => 
                        g.shift === shift && g.schedule?.[day]?.[i] && 
                        JSON.parse(g.schedule[day][i]).name === cellData.name && 
                        JSON.parse(g.schedule[day][i]).teacher === teacher
                    ) || [];

                    // Si la asignación tiene groupId, usarlo, si no, usar el que encontramos
                    const groupIdToUse = cellData.groupId || currentGroupId;

                    contentDiv.dataset.originalValue = JSON.stringify({ 
                        name: cellData.name, 
                        groupId: groupIdToUse
                    });
                }
            } else {
                contentDiv.textContent = '-';
                contentDiv.dataset.originalValue = '';
            }

            let originalValue = null; // Variable para compartir entre eventos

            contentDiv.addEventListener('click', () => {
                // Primero establecer el valor original
                originalValue = contentDiv.dataset.originalValue ? JSON.parse(contentDiv.dataset.originalValue) : null;
                select.dataset.originalValue = contentDiv.dataset.originalValue;

                // Temporalmente establecer un valor diferente para forzar el evento change
                select.value = '';
                select.style.display = 'block';
                
                // Actualizar las opciones
                updateTeacherScheduleOptions(select, teacher, shift);

                // Si es un bloque, forzar el evento change
                if (originalValue?.blocked) {
                    select.value = 'BLOCKED';  // Establecer directamente el valor
                    const event = new Event('change');
                    select.dispatchEvent(event);  // Disparar el evento manualmente
                }

                contentDiv.style.display = 'none';
                select.focus();

                console.log('Click - Valor original:', originalValue); // Para debug
            });

            let isChanging = false;

            select.addEventListener('blur', (event) => {
                // Dar tiempo para que se complete el click en el modal o en las opciones
                setTimeout(() => {
                    const blockModal = document.getElementById('blockModal');
                    if (!isChanging || (blockModal && blockModal.style.display !== 'block')) {
                        select.style.display = 'none';
                        contentDiv.style.display = 'block';
                        isChanging = false;
                    }
                }, 300);

                // Si el modal está abierto, mantener el select visible
                const blockModal = document.getElementById('blockModal');
                if (blockModal && blockModal.style.display === 'block') {
                    select.style.display = 'block';
                    contentDiv.style.display = 'none';
                }
            });

            select.addEventListener('change', () => {
                isChanging = true;
                const selectedValue = select.value;
                if (selectedValue === 'BLOCKED') {
                    const blockModal = document.getElementById('blockModal');
                    const blockReasonInput = document.getElementById('blockReason');
                    const blockTypeInput = document.getElementById('blockType');
                    const existingBlock = state.teacherBlocks[teacher]?.[blockKey];

                    if (existingBlock) {
                        blockReasonInput.value = existingBlock.reason;
                        blockTypeInput.value = existingBlock.type;
                        console.log('Cargando bloqueo existente:', existingBlock); // Para debug
                    } else {
                        blockReasonInput.value = '';
                        blockTypeInput.value = 'lectivo';
                    }

                    blockModal.dataset.teacher = teacher;
                    blockModal.dataset.day = day;
                    blockModal.dataset.period = i;
                    blockModal.dataset.shift = shift;
                    blockModal.style.display = 'block';
                } else {
                    const value = selectedValue ? JSON.parse(selectedValue) : null;
                    if (value) {
                        const group = state.groups[value.groupId];
                        const conflict = findConflictForGroup(group.name, day, i, teacher);
                        if (conflict) {
                            const message = `El profesor ${conflict.teacher} ya está asignado a la materia ${conflict.subject} en esta hora para este grupo. ¿Desea reasignarlo?`;
                            if (confirm(message)) {
                                delete group.schedule[day][i];
                            } else {
                                select.value = contentDiv.dataset.originalValue || '';
                                return;
                            }
                        }
                    }
                    
                    // Primero guardar en el estado
                    if (value) {
                        const { groupId, name } = value;
                        const group = state.groups[groupId];
                        if (group) {
                            // Limpiar asignaciones previas
                            Object.values(state.groups).forEach(g => {
                                if (g.schedule && g.schedule[day] && g.schedule[day][i]) {
                                    const cellData = JSON.parse(g.schedule[day][i]);
                                    if (cellData && cellData.teacher === teacher) {
                                        g.schedule[day][i] = null;
                                    }
                                }
                            });

                            // Guardar nueva asignación
                            if (!group.schedule) group.schedule = {};
                            if (!group.schedule[day]) group.schedule[day] = {};
                            group.schedule[day][i] = JSON.stringify({ name, teacher, groupId });
                        }
                    } else {
                        // Limpiar asignaciones si se selecciona vacío
                        Object.values(state.groups).forEach(g => {
                            if (g.schedule && g.schedule[day] && g.schedule[day][i]) {
                                const cellData = JSON.parse(g.schedule[day][i]);
                                if (cellData && cellData.teacher === teacher) {
                                    g.schedule[day][i] = null;
                                }
                            }
                        });
                    }
                    saveState();

                    // Luego actualizar la UI
                    select.style.display = 'none';
                    contentDiv.style.display = 'block';
                    if (value) {
                        const { name } = value;
                        const group = state.groups[value.groupId];
                        contentDiv.textContent = `${name} (${group.name})`;
                        const subject = group.subjects.find(s => s.name === name && s.teacher === teacher);
                        if (subject && subject.color) {
                            cell.style.backgroundColor = subject.color;
                            cell.className = 'schedule-cell'; // Remove other color classes
                        } else {
                            cell.className = 'schedule-cell ' + getSubjectColorClass(subject);
                            cell.style.backgroundColor = ''; // Remove inline style
                        }
                    } else {
                        contentDiv.textContent = '-';
                        cell.className = 'schedule-cell';
                        cell.style.backgroundColor = '';
                    }
                    contentDiv.dataset.originalValue = selectedValue;
                    checkConflicts();
                    updateSubjectSummary(shift);
                }
            });

            row.appendChild(cell);
        });
        tbody.appendChild(row);
    });
}

export function updateTeacherScheduleOptions(select, teacher, shift) {
    // Obtener el valor original antes de limpiar el select
    const originalValue = select.dataset.originalValue ? JSON.parse(select.dataset.originalValue) : null;
    
    // Limpiar y añadir opciones base
    select.innerHTML = '';
    select.add(new Option('-', ''));
    select.add(new Option('Bloquear franja', 'BLOCKED'));
    
    // Añadir opciones de materias
    const options = [];
    Object.entries(state.groups).forEach(([groupId, group]) => {
        if (group.subjects && group.shift === shift) {
            group.subjects.filter(s => s.teacher === teacher).forEach(subject => {
                options.push({
                    value: JSON.stringify({ groupId, name: subject.name }),
                    text: `${subject.name} (${group.name})`,
                });
            });
        }
    });
    
    // Ordenar y añadir opciones
    options.sort((a, b) => a.text.localeCompare(b.text));
    options.forEach(opt => select.add(new Option(opt.text, opt.value)));

    // Establecer el valor seleccionado
    if (originalValue) {
        console.log('Valor original:', originalValue); // Para debug
        if (originalValue.blocked) {
            select.value = 'BLOCKED';
        } else if (originalValue.name) {
            // Buscar la opción exacta por nombre y groupId
            const matchingOption = Array.from(select.options).find(option => {
                if (option.value && option.value !== 'BLOCKED') {
                    const optionData = JSON.parse(option.value);
                    const matchesName = optionData.name === originalValue.name;
                    const matchesGroup = !originalValue.groupId || optionData.groupId === originalValue.groupId;
                    return matchesName && matchesGroup;
                }
                return false;
            });

            if (matchingOption) {
                console.log('Opción encontrada:', matchingOption.value); // Para debug
                select.value = matchingOption.value;
            }
        }
    }

    // Si no se estableció ningún valor, asegurarse de que esté vacío
    if (!select.value) {
        select.value = '';
    }
}

export function saveTeacherScheduleChange(teacher, day, period, value) {
    const blockKey = `${teacher}-${day}-${period}`;
    if (state.teacherBlocks[teacher]?.[blockKey]) {
        delete state.teacherBlocks[teacher][blockKey];
    }

    // Limpiar las asignaciones existentes para este profesor en este horario
    Object.values(state.groups).forEach(group => {
        if (group.schedule && group.schedule[day] && group.schedule[day][period]) {
            const cellData = JSON.parse(group.schedule[day][period]);
            if (cellData && cellData.teacher === teacher) {
                group.schedule[day][period] = null;
            }
        }
    });

    if (value) {
        const { groupId, name } = value;
        const group = state.groups[groupId];
        if (group) {
            if (!group.schedule) group.schedule = {};
            if (!group.schedule[day]) group.schedule[day] = {};
            group.schedule[day][period] = JSON.stringify({ name, teacher, groupId });
        }
    }

    saveState();

    // Update UI for the specific cell
    const cells = document.querySelectorAll('.schedule-cell');
    const targetCell = Array.from(cells).find(cell => {
        const select = cell.querySelector('select');
        return select && select.dataset.day === day && select.dataset.period === period;
    });

    if (targetCell) {
        const contentDiv = targetCell.querySelector('.cell-content');
        if (contentDiv) {
            if (value) {
                const { name, groupId } = value;
                const group = state.groups[groupId];
                contentDiv.textContent = `${name} (${group.name})`;
                const subject = group.subjects.find(s => s.name === name && s.teacher === teacher);
                if (subject && subject.color) {
                    targetCell.style.backgroundColor = subject.color;
                    targetCell.className = 'schedule-cell'; // Remove other color classes
                } else {
                    targetCell.className = 'schedule-cell ' + getSubjectColorClass(subject);
                    targetCell.style.backgroundColor = ''; // Remove inline style
                }
            } else {
                contentDiv.textContent = '-';
                targetCell.className = 'schedule-cell';
                targetCell.style.backgroundColor = '';
            }
            contentDiv.dataset.originalValue = value ? JSON.stringify({ name: value.name, groupId: value.groupId }) : '';
        }
    }
}

export function handleBlockConfirmation() {
    const blockModal = document.getElementById('blockModal');
    const { teacher, day, period, shift } = blockModal.dataset;
    const reason = document.getElementById('blockReason').value.trim();
    const type = document.getElementById('blockType').value;
    
    // Limpiar estado de edición
    let isChanging = false;
    
    const blockKey = `${teacher}-${day}-${period}`;
    
    // Limpiar asignaciones existentes para este profesor en este horario
    Object.values(state.groups).forEach(g => {
        if (g.schedule && g.schedule[day] && g.schedule[day][period]) {
            const cellData = JSON.parse(g.schedule[day][period]);
            if (cellData && cellData.teacher === teacher) {
                g.schedule[day][period] = null;
            }
        }
    });

    if (!state.teacherBlocks[teacher]) {
        state.teacherBlocks[teacher] = {};
    }
    
    // Encontrar la celda para actualizar la UI
    const cells = document.querySelectorAll('.schedule-cell');
    const targetCell = Array.from(cells).find(cell => {
        const select = cell.querySelector('select');
        return select && select.dataset.day === day && select.dataset.period === period;
    });

    if (targetCell) {
        const contentDiv = targetCell.querySelector('.cell-content');
        const select = targetCell.querySelector('select');
        
        if (contentDiv && select) {
            // Ocultar el select y mostrar el contentDiv
            select.style.display = 'none';
            contentDiv.style.display = 'block';

            if (reason) {
                // Guardar el bloqueo
                state.teacherBlocks[teacher][blockKey] = { reason, type, shift };
                
                // Actualizar UI
                contentDiv.textContent = reason;
                targetCell.className = 'schedule-cell blocked-cell';
                targetCell.classList.add(type); // Añadir la clase del tipo específico
                contentDiv.dataset.originalValue = JSON.stringify({ blocked: true, reason: reason, type });
            } else {
                // Eliminar el bloqueo
                delete state.teacherBlocks[teacher][blockKey];
                
                // Actualizar UI
                contentDiv.textContent = '-';
                targetCell.className = 'schedule-cell';
                contentDiv.dataset.originalValue = '';
            }
        }
    } else {
        // Si no encontramos la celda, solo actualizamos el estado
        if (reason) {
            state.teacherBlocks[teacher][blockKey] = { reason, type, shift };
        } else {
            delete state.teacherBlocks[teacher][blockKey];
        }
    }
    
    // Asegurar que el select se oculta y el contentDiv se muestra en todas las celdas
    document.querySelectorAll('.schedule-cell').forEach(cell => {
        const select = cell.querySelector('select');
        const contentDiv = cell.querySelector('.cell-content');
        if (select && contentDiv) {
            select.style.display = 'none';
            contentDiv.style.display = 'block';
        }
    });

    saveState();
    
    // Limpiar estado y ocultar modal
    isChanging = false;
    blockModal.style.display = 'none';
    
    // Actualizar la vista para reflejar los cambios
    const currentTeacher = state.currentTeacher;
    if (currentTeacher) {
        updateTeacherView();
    }
    
    // Ocultar todos los selects y mostrar los contentDivs
    document.querySelectorAll('.schedule-cell').forEach(cell => {
        const select = cell.querySelector('select');
        const contentDiv = cell.querySelector('.cell-content');
        if (select && contentDiv) {
            select.style.display = 'none';
            contentDiv.style.display = 'block';
        }
    });

    checkConflicts();
    // Actualizar el resumen global
    updateSubjectSummary(shift);
    updateSubjectSummary();
}

export function handleDeleteBlock() {
    blockReason.value = '';
    handleBlockConfirmation();
}

function cleanupCellEditing() {
    document.querySelectorAll('.schedule-cell').forEach(cell => {
        const select = cell.querySelector('select');
        const contentDiv = cell.querySelector('.cell-content');
        if (select && contentDiv) {
            select.style.display = 'none';
            contentDiv.style.display = 'block';
        }
    });
}

function initializeModalEvents() {
    const blockModal = document.getElementById('blockModal');
    const confirmBtn = document.getElementById('confirmBlock');
    const cancelBtn = document.getElementById('cancelBlock');
    const deleteBtn = document.getElementById('deleteBlockBtn');

    confirmBtn.addEventListener('click', () => {
        handleBlockConfirmation();
        cleanupCellEditing();
    });

    cancelBtn.addEventListener('click', () => {
        blockModal.style.display = 'none';
        cleanupCellEditing();
    });

    deleteBtn.addEventListener('click', () => {
        handleDeleteBlock();
        cleanupCellEditing();
    });

    // Cerrar el modal si se hace clic fuera
    window.addEventListener('click', (event) => {
        if (event.target === blockModal) {
            blockModal.style.display = 'none';
            cleanupCellEditing();
        }
    });
}

function clearTeacherSchedule() {
    const teacher = state.currentTeacher;
    if (!teacher) return;

    if (!confirm(`¿Está seguro de que desea eliminar todas las asignaciones y bloqueos del horario de ${teacher}?`)) {
        return;
    }

    // Limpiar asignaciones en grupos
    Object.values(state.groups).forEach(group => {
        if (group.schedule) {
            Object.keys(group.schedule).forEach(day => {
                Object.keys(group.schedule[day]).forEach(period => {
                    if (group.schedule[day][period]) {
                        const cellData = JSON.parse(group.schedule[day][period]);
                        if (cellData && cellData.teacher === teacher) {
                            group.schedule[day][period] = null;
                        }
                    }
                });
            });
        }
    });

    // Limpiar bloques del profesor
    if (state.teacherBlocks[teacher]) {
        delete state.teacherBlocks[teacher];
    }

    saveState();
    updateTeacherView();
    checkConflicts();
    updateSubjectSummary();
}
