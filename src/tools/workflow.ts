export class ToolWorkflow {
  private readonly readFiles = new Set<string>();

  markRead(filePath: string): void {
    this.readFiles.add(filePath);
  }
  hasRead(filePath: string): boolean {
    return this.readFiles.has(filePath);
  }
  canEdit(filePath: string, exists: boolean): boolean {
    if (!exists) return true;
    return this.readFiles.has(filePath);
  }
}
