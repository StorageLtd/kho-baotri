import { Item, Activity, RepairHistory, Machine, MaintenanceJob, Cnc, CncAlarm } from "../types";

export const DB_URL = "https://ltdst-80b3e-default-rtdb.asia-southeast1.firebasedatabase.app";

export interface DatabaseState {
  items: Item[];
  activities: Activity[];
  repairHistory: RepairHistory[];
  machines: Machine[];
  maintenanceJobs: MaintenanceJob[];
  cncs: Cnc[];
  cncAlarms: CncAlarm[];
}

export const INITIAL_ITEMS: Item[] = [
  {
    id: "item-1",
    name: "Cảm biến tiệm cận chữ U",
    sku: "CB-TP-001",
    category: "Thiết bị cảm biến",
    supplier: "Máy CNC Fanuc, Máy CNC Laser",
    quantity: 12,
    min: 3,
    price: 350000,
    location: "Kệ A - Ngăn 1",
    specs: "Điện áp 12-24VDC, Tần số đáp ứng 1kHz, Khoảng cách cảm ứng 5mm",
    note: "Dùng để gá công tắc giới hạn hành trình trục X/Y máy CNC",
    image: ""
  },
  {
    id: "item-2",
    name: "Nguồn tổ ong Meanwell 24V",
    sku: "NG-24V-010",
    category: "Linh kiện nguồn",
    supplier: "Toàn bộ tủ điện xưởng",
    quantity: 8,
    min: 2,
    price: 850000,
    location: "Kệ B - Ngăn 2",
    specs: "Model LRS-250-24, Ngõ ra 24VDC 10.4A, Công suất 250W",
    note: "Sử dụng cấp nguồn nuôi cho bộ điều khiển PLC và rơ le",
    image: ""
  },
  {
    id: "item-3",
    name: "Rơ le bán dẫn SSR 40A",
    sku: "RL-SSR-040",
    category: "Thiết bị đóng ngắt",
    supplier: "Lò nhiệt máy sấy, Tủ CNC",
    quantity: 15,
    min: 5,
    price: 280000,
    location: "Kệ C - Ngăn 1",
    specs: "Dòng tải max 40A, Điện áp kích 3-32VDC, Điện áp tải 24-480VAC",
    note: "Đóng cắt tốc độ cao không phát tia lửa điện",
    image: ""
  },
  {
    id: "item-4",
    name: "Động cơ Servo Fanuc 1kW",
    sku: "DC-SV-010",
    category: "Động cơ / Driver",
    supplier: "Máy phay CNC Fanuc 02",
    quantity: 1,
    min: 1,
    price: 15500000,
    location: "Kệ D - Ô lớn 1",
    specs: "Model Beta iS 8/3000, Công suất 1.0kW, Điện áp AC 200V, Tốc độ 3000rpm",
    note: "Hàng tháo máy nguyên bản, đã test chạy ổn định",
    image: ""
  },
  {
    id: "item-5",
    name: "Cáp encoder chống nhiễu",
    sku: "CP-TH-002",
    category: "Cáp tín hiệu",
    supplier: "Động cơ Servo máy CNC",
    quantity: 0,
    min: 2,
    price: 450000,
    location: "Kệ A - Ngăn 4",
    specs: "Chiều dài cáp 5m, chuẩn chống nhiễu đôi xoắn chống dầu bôi trơn",
    note: "Cần nhập gấp để làm dự phòng khi trục Z bị đứt cáp kéo",
    image: ""
  }
];

export const INITIAL_MACHINES: Machine[] = [
  {
    id: "m-1",
    name: "Máy Phay CNC Fanuc Series 0i-MF",
    setupDate: "2024-03-12",
    warranty: "2026-03-12",
    vendor: "Công ty Máy công cụ Việt Nhật",
    phone: "0912345678"
  },
  {
    id: "m-2",
    name: "Máy Tiện CNC Fanuc Series 0i-TD",
    setupDate: "2023-08-15",
    warranty: "2025-08-15",
    vendor: "Cơ Khí Chế Tạo Đại Đồng",
    phone: "0988777999"
  },
  {
    id: "m-3",
    name: "Máy Cắt Laser Fiber LTD-3015",
    setupDate: "2025-01-20",
    warranty: "2027-01-20",
    vendor: "LTD Machinery VN Co., Ltd",
    phone: "0909123456"
  },
  {
    id: "m-4",
    name: "Máy Nén Khí Trục Vít 15HP",
    setupDate: "2024-05-10",
    warranty: "2025-05-10",
    vendor: "Thiết Bị Công Nghiệp Hoàng Long",
    phone: "0934567890"
  }
];

export const INITIAL_JOBS: MaintenanceJob[] = [
  {
    id: "job-1",
    machineId: "m-4",
    machineName: "Máy Nén Khí Trục Vít 15HP",
    jobName: "Thay dầu nhớt & lọc dầu tách khí định kỳ",
    period: 6,
    nextDate: "2026-07-15",
    desc: "- Bước 1: Ngắt cầu dao điện tổng, khóa van khí ra.\n- Bước 2: Đợi máy nguội, xả hết áp suất khí trong bình dầu.\n- Bước 3: Tháo xả dầu cũ ở đáy bình và két làm mát.\n- Bước 4: Tháo thay lọc dầu mới và bộ tách dầu khí.\n- Bước 5: Châm dầu trục vít mới tầm 12 lít lên vạch kính dầu.\n- Bước 6: Chạy thử máy kiểm tra áp suất và nhiệt độ chạy ổn định."
  },
  {
    id: "job-2",
    machineId: "m-1",
    machineName: "Máy Phay CNC Fanuc Series 0i-MF",
    jobName: "Vệ sinh bộ lọc dầu làm mát & bơm nước",
    period: 3,
    nextDate: "2026-05-10",
    desc: "- Bước 1: Tắt nguồn tổng điều khiển máy CNC.\n- Bước 2: Tháo lưới lọc kim loại tại bồn chứa dầu tản nhiệt.\n- Bước 3: Dùng vòi xịt khí nén làm sạch phoi bám.\n- Bước 4: Vệ sinh cặn bùn tích tụ dưới đáy bồn chứa.\n- Bước 5: Kiểm tra mực nước làm mát dung dịch tưới nguội."
  },
  {
    id: "job-3",
    machineId: "m-3",
    machineName: "Máy Cắt Laser Fiber LTD-3015",
    jobName: "Kiểm tra thấu kính bảo vệ & đồng trục tia",
    period: 1,
    nextDate: "2026-06-20",
    desc: "- Bước 1: Tháo đầu cắt Laser ở chế độ an toàn.\n- Bước 2: Dùng tăm bông chuyên dụng thấm cồn 99% lau thấu kính bảo vệ.\n- Bước 3: Gắn băng keo canh đồng trục béc phun cắt.\n- Bước 4: Chỉnh gương phản xạ nếu tia đỏ Laser định vị bị lệch khỏi tâm."
  }
];

export const INITIAL_REPAIR_HISTORY: RepairHistory[] = [
  {
    id: "rh-1",
    machine: "Máy Tiện CNC Fanuc Series 0i-TD",
    faultTime: "2026-06-10",
    staff: "Nguyễn Văn Bảo Trì",
    fault: "Mất nguồn điều khiển 24VDC tại tủ điện phụ, màn hình điều khiển CNC tắt ngúm.",
    fix: "Đo kiểm tra phát hiện nguồn tổ ong 24VDC cũ bị nổ diode chỉnh lưu sơ cấp gây chập nguồn. Đã thay thế bằng Nguồn tổ ong Meanwell 24V (mã SKU NG-24V-010) lấy từ Kệ B ngăn 2 kho LTD. Máy đã hoạt động bình thường trở lại.",
    image: ""
  },
  {
    id: "rh-2",
    machine: "Máy Nén Khí Trục Vít 15HP",
    faultTime: "2026-05-20",
    staff: "Trần Văn Cơ Điện",
    fault: "Máy nén chạy nhiệt độ cao báo Overheat (>105°C) rồi tự sập bảo vệ.",
    fix: "Kiểm tra thấy quạt dàn tản nhiệt bị bám kẹt bụi gỗ, mực dầu trục vít xuống quá thấp. Tiến hành thổi bụi làm sạch giàn tản nhiệt và châm thêm 2.5 lít dầu nhờn máy nén khí. Máy chạy test lại duy trì nhiệt độ 83°C ổn định.",
    image: ""
  }
];

export const INITIAL_CNCS: Cnc[] = [
  {
    id: "cnc-1",
    name: "Máy Tiện CNC Fanuc 01 (0i-F)",
    ip: "192.168.1.101",
    port: 8193,
    model: "Fanuc 0i-F",
    location: "Khu vực CNC - Lô A1",
    status: "running",
    activeProgram: "O1024 (LTD_SHAFT_CUT)",
    currentBlock: "N140 G01 X45.2 Z-20.5 F0.18",
    spindleSpeed: 1800,
    targetSpindleSpeed: 1800,
    feedrate: 150,
    targetFeedrate: 150,
    override: 100,
    alarm: ""
  },
  {
    id: "cnc-2",
    name: "Máy Phay CNC Fanuc 02 (0i-F)",
    ip: "192.168.1.102",
    port: 8193,
    model: "Fanuc 0i-F",
    location: "Khu vực CNC - Lô A2",
    status: "hold",
    activeProgram: "O3005 (LTD_MOLD_BASE)",
    currentBlock: "N80 M01 (PAUSE CHECK)",
    spindleSpeed: 0,
    targetSpindleSpeed: 3200,
    feedrate: 0,
    targetFeedrate: 450,
    override: 0,
    alarm: ""
  },
  {
    id: "cnc-3",
    name: "Trung Tâm Gia Công 03 (31i-B)",
    ip: "192.168.1.103",
    port: 8193,
    model: "Fanuc 31i-B",
    location: "Khu vực CNC - Lô B1",
    status: "alarm",
    activeProgram: "O8890 (LTD_IMPELLER_5AX)",
    currentBlock: "N420 G43 H02 Z10.0",
    spindleSpeed: 0,
    targetSpindleSpeed: 8000,
    feedrate: 0,
    targetFeedrate: 1200,
    override: 100,
    alarm: "ALARM SV0311 - LỖI QUÁ DÒNG SERVO MOTOR TRỤC X"
  }
];

export const INITIAL_ALARM_HISTORY: CncAlarm[] = [
  {
    id: "ca-1",
    timestamp: "2026-06-25T14:32:10.000Z",
    cncId: "cnc-3",
    cncName: "Trung Tâm Gia Công 03 (31i-B)",
    alarmCode: "SV0311",
    description: "ALARM SV0311 - LỖI QUÁ DÒNG SERVO MOTOR TRỤC X"
  },
  {
    id: "ca-2",
    timestamp: "2026-06-24T09:15:00.000Z",
    cncId: "cnc-1",
    cncName: "Máy Tiện CNC Fanuc 01 (0i-F)",
    alarmCode: "OT0002",
    description: "ALARM OT0002 - OVERTRAVEL TRỤC Z CÔNG TẮC GIỚI HẠN",
    resolvedAt: "2026-06-24T09:40:00.000Z"
  }
];

export const INITIAL_ACTIVITIES: Activity[] = [
  { at: new Date().toISOString(), text: "Hệ thống quản lý LTD VIET NAM Cloud đã sẵn sàng." },
  { at: new Date(Date.now() - 3600000).toISOString(), text: "Kỹ sư đã clear lỗi overtravel máy CNC 01." },
  { at: new Date(Date.now() - 7200000).toISOString(), text: "Nhập bổ sung 8 bộ nguồn Meanwell 24V vào Kệ B." }
];

export function getLocalState(): DatabaseState {
  const local = localStorage.getItem("ltd_cloud_db_state_v1");
  if (local) {
    try {
      const parsed = JSON.parse(local);
      return {
        items: parsed.items || INITIAL_ITEMS,
        activities: parsed.activities || INITIAL_ACTIVITIES,
        repairHistory: parsed.repairHistory || INITIAL_REPAIR_HISTORY,
        machines: parsed.machines || INITIAL_MACHINES,
        maintenanceJobs: parsed.maintenanceJobs || INITIAL_JOBS,
        cncs: parsed.cncs || INITIAL_CNCS,
        cncAlarms: parsed.cncAlarms || INITIAL_ALARM_HISTORY,
      };
    } catch (e) {
      console.error("Lỗi parse localStorage state:", e);
    }
  }

  return {
    items: INITIAL_ITEMS,
    activities: INITIAL_ACTIVITIES,
    repairHistory: INITIAL_REPAIR_HISTORY,
    machines: INITIAL_MACHINES,
    maintenanceJobs: INITIAL_JOBS,
    cncs: INITIAL_CNCS,
    cncAlarms: INITIAL_ALARM_HISTORY
  };
}

export function saveLocalState(state: DatabaseState) {
  localStorage.setItem("ltd_cloud_db_state_v1", JSON.stringify(state));
}

export async function fbFetch(path: string, method = "GET", body: any = null) {
  const options: RequestInit = { method };
  if (body) {
    options.headers = { "Content-Type": "application/json" };
    options.body = JSON.stringify(body);
  }
  try {
    const res = await fetch(`${DB_URL}/${path}.json`, options);
    if (!res.ok) throw new Error(`HTTP status ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`Lỗi đồng bộ Firebase (${path}):`, err);
    return null;
  }
}

export async function syncNode(nodeName: string, dataArray: any[]) {
  const obj: Record<string, any> = {};
  dataArray.forEach(item => {
    if (item.id) obj[item.id] = item;
  });
  await fbFetch(nodeName, "PUT", obj);
}
