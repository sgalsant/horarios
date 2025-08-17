import { state } from './state.js';

export function getSubjectColorClass(subjectName) {
    if (!state.subjectColors.has(subjectName)) {
        const colorIndex = state.subjectColors.size % 8;
        state.subjectColors.set(subjectName, `subject-color-${colorIndex}`);
    }
    return state.subjectColors.get(subjectName);
}
