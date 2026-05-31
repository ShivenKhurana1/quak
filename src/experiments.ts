import fs from 'fs';
import path from 'path';
import os from 'os';

const EXPERIMENTS_DIR = path.join(os.homedir(), '.quak', 'experiments');

export interface Experiment {
  name: string;
  description: string;
  variants: Array<{
    name: string;
    config: Record<string, any>;
    traffic: number; // 0-1
  }>;
  metrics: {
    successRate: number;
    avgDuration: number;
    avgTokens: number;
  };
}

export class ExperimentManager {
  private experiments = new Map<string, Experiment>();

  createExperiment(experiment: Experiment): void {
    this.experiments.set(experiment.name, experiment);
    this.persist();
  }

  assignVariant(experimentName: string, sessionId: string): string | null {
    const experiment = this.experiments.get(experimentName);
    if (!experiment) return null;

    // Hash session ID to determine variant
    const hash = this.hash(sessionId);
    const normalizedHash = hash / 0xffffffff;
    
    let cumulative = 0;
    for (const variant of experiment.variants) {
      cumulative += variant.traffic;
      if (normalizedHash <= cumulative) {
        return variant.name;
      }
    }

    return experiment.variants[0].name;
  }

  recordMetric(experimentName: string, variantName: string, metric: keyof Experiment['metrics'], value: number): void {
    const experiment = this.experiments.get(experimentName);
    if (!experiment) return;

    const variant = experiment.variants.find(v => v.name === variantName);
    if (!variant) return;

    // Update metrics (simplified)
    // In production, would use proper aggregation
  }

  private hash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private persist(): void {
    if (!fs.existsSync(EXPERIMENTS_DIR)) {
      fs.mkdirSync(EXPERIMENTS_DIR, { recursive: true });
    }

    for (const [name, experiment] of this.experiments.entries()) {
      const file = path.join(EXPERIMENTS_DIR, `${name}.json`);
      fs.writeFileSync(file, JSON.stringify(experiment, null, 2));
    }
  }
}