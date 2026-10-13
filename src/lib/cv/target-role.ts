// New CVs are titled after their role, so the role line only repeats the title until a rename.
export function showsTargetRole(title: string, targetRole: string): boolean {
  return title.trim().toLocaleLowerCase() !== targetRole.trim().toLocaleLowerCase();
}
