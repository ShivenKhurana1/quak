// Progress tracking with ETA calculation
export class ProgressTracker {
  private totalSteps: number;
  private completedSteps = 0;
  private startTime = Date.now();
  private stepDurations: number[] = [];

  constructor(totalSteps: number) {
    this.totalSteps = totalSteps;
  }

  completeStep(duration: number): void {
    this.completedSteps++;
    this.stepDurations.push(duration);
  }

  getProgress(): {
    percentage: number;
    completed: number;
    total: number;
    eta: number;
    averageStepDuration: number;
  } {
    const percentage = (this.completedSteps / this.totalSteps) * 100;
    const averageStepDuration = this.stepDurations.length > 0
      ? this.stepDurations.reduce((a, b) => a + b, 0) / this.stepDurations.length
      : 0;
    const remainingSteps = this.totalSteps - this.completedSteps;
    const eta = remainingSteps * averageStepDuration;

    return {
      percentage: Math.round(percentage),
      completed: this.completedSteps,
      total: this.totalSteps,
      eta: Math.round(eta),
      averageStepDuration: Math.round(averageStepDuration),
    };
  }

  formatETA(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }
}