const LOG_LEVELS = ['WORKFLOW', 'SELECTOR', 'RECOVERY', 'SAVE', 'VALIDATION'] as const;

type LogLevel = (typeof LOG_LEVELS)[number];

export function log(level: LogLevel, message: string, data?: unknown): void {
  const entry = `[${level}] ${message}`;
  if (data !== undefined) {
    console.log(entry, data);
  } else {
    console.log(entry);
  }
}

export function logWorkflow(name: string): void {
  console.log(`[WORKFLOW] ${name} start`);
}

export function logWorkflowEnd(name: string): void {
  console.log(`[WORKFLOW] ${name} end`);
}
