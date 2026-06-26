export interface Item {
  id: string;
  name: string;
  sku: string;
  category: string;
  supplier: string;
  quantity: number;
  min: number;
  price: number;
  location: string;
  specs: string;
  note: string;
  image: string;
}

export interface Activity {
  at: string;
  text: string;
}

export interface RepairHistory {
  id: string;
  machine: string;
  faultTime: string; // YYYY-MM-DD
  staff: string;
  fault: string;
  fix: string;
  image: string;
}

export interface Machine {
  id: string;
  name: string;
  setupDate: string; // YYYY-MM-DD
  warranty: string; // YYYY-MM-DD
  vendor: string;
  phone: string;
}

export interface MaintenanceJob {
  id: string;
  machineId: string;
  machineName: string;
  jobName: string;
  period: number; // months
  nextDate: string; // YYYY-MM-DD
  desc: string;
}

export interface Cnc {
  id: string;
  name: string;
  ip: string;
  port: number;
  model: string;
  location: string;
  status: "running" | "hold" | "alarm" | "offline";
  activeProgram: string;
  currentBlock: string;
  spindleSpeed: number;
  targetSpindleSpeed: number;
  feedrate: number;
  targetFeedrate: number;
  override: number;
  alarm: string;
}

export interface CncAlarm {
  id: string;
  timestamp: string; // ISO
  cncId: string;
  cncName: string;
  alarmCode: string;
  description: string;
  resolvedAt?: string; // ISO
}
