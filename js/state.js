// Constantes globales
export const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
export const PERIODS = [
    '1º',
    '2º',
    '3º',
    'Recreo',
    '4º',
    '5º',
    '6º'
];

// Estado global de la aplicación
export const state = {
    groups: {},
    currentGroup: null,
    currentView: 'group',
    subjectColors: new Map(),
    currentTeacher: null,
    teacherBlocks: {}
};

export function saveState() {
    localStorage.setItem('horarioState', JSON.stringify({
        groups: state.groups,
        currentGroup: state.currentGroup,
        currentView: state.currentView,
        subjectColors: Array.from(state.subjectColors.entries()),
        currentTeacher: state.currentTeacher,
        teacherBlocks: state.teacherBlocks
    }));
}

export function loadState() {
    const savedState = localStorage.getItem('horarioState');
    if (savedState) {
        const parsed = JSON.parse(savedState);
        state.groups = parsed.groups;
        state.currentGroup = parsed.currentGroup;
        state.currentView = parsed.currentView;
        state.subjectColors = new Map(parsed.subjectColors);
        state.currentTeacher = parsed.currentTeacher;
        state.teacherBlocks = parsed.teacherBlocks || {};
    }
}

export function exportData() {
    const data = JSON.stringify({
        groups: state.groups,
        subjectColors: Array.from(state.subjectColors.entries()),
        teacherBlocks: state.teacherBlocks
    });
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'horario.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function importData(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const imported = JSON.parse(e.target.result);
            state.groups = imported.groups;
            state.subjectColors = new Map(imported.subjectColors);
            state.teacherBlocks = imported.teacherBlocks || {};
            saveState();
            window.location.reload();
        };
        reader.readAsText(file);
    }
}
