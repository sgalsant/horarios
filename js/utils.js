import { state } from './state.js';

export function getSubjectColorClass(subject) {
    if (subject && subject.color) {
        return subject.color;
    }

    if (!state.subjectColors.has(subject.name)) {
        const colorIndex = state.subjectColors.size % 8;
        state.subjectColors.set(subject.name, `subject-color-${colorIndex}`);
    }
    return state.subjectColors.get(subject.name);
}
