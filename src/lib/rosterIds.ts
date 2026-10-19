export type RosterEntry = {
  studentName: string;
  studentId?: string;
  confidence: number;
  reasoning: string;
};

/**
 * Drops blank/duplicate names and gives students without a recognized number
 * the next free one, following the detected format (e.g. "007" → "008").
 */
export function assignMissingStudentIds(entries: readonly RosterEntry[]): {
  students: RosterEntry[];
  autoAssignedStudentIds: string[];
} {
  const seen = new Set<string>();
  const students = entries
    .map((entry) => ({ ...entry, studentName: entry.studentName.trim(), studentId: entry.studentId?.trim() || undefined }))
    .filter((entry) => {
      if (!entry.studentName || seen.has(entry.studentName)) return false;
      seen.add(entry.studentName);
      return true;
    });

  const detectedIds = students
    .map((s) => s.studentId)
    .filter((id): id is string => id !== undefined && /^\d+$/.test(id));
  const numbers = detectedIds.map(Number);
  const maxDetected = numbers.length ? Math.max(...numbers) : 0;
  const minDetected = numbers.length ? Math.min(...numbers) : 0;
  let next = numbers.length && maxDetected - minDetected < 100 ? maxDetected + 1 : 1;

  const zeroPadded = detectedIds.length === 0 || detectedIds.some((id) => id.length > 1 && id.startsWith("0"));
  const width = zeroPadded ? Math.max(3, ...detectedIds.map((id) => id.length)) : 0;
  const used = new Set(students.map((s) => s.studentId).filter(Boolean));

  const autoAssignedStudentIds: string[] = [];
  for (const student of students) {
    if (student.studentId) continue;
    let candidate = String(next).padStart(width, "0");
    while (used.has(candidate)) candidate = String(++next).padStart(width, "0");
    student.studentId = candidate;
    used.add(candidate);
    autoAssignedStudentIds.push(candidate);
    next++;
  }

  return { students, autoAssignedStudentIds };
}
