import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Package,
  Cpu,
  Settings,
  Calendar,
  History,
  LogOut,
  Download,
  Users,
  CheckCircle,
  FileText
} from "lucide-react";

import { Item, Activity, RepairHistory, Machine, MaintenanceJob, Cnc, CncAlarm } from "./types";
import { getLocalState, saveLocalState, fbFetch, syncNode, DB_URL } from "./utils/db";

import Login from "./components/Login";
import Overview from "./components/Overview";
import Inventory from "./components/Inventory";
import CncMonitoring from "./components/CncMonitoring";
import Machines from "./components/Machines";
import MaintenanceJobs from "./components/MaintenanceJobs";
import RepairHistoryView from "./components/RepairHistory";

const getAlarmKeyword = (code: string) => {
  const text = String(code || "").toUpperCase();
  if (text.includes("SV")) return "Servo";
  if (text.includes("SP")) return "Spindle";
  if (text.includes("OT")) return "Cảm biến";
  return "Nguồn";
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [activePage, setActivePage] = useState("overviewPage");
  const [onlineCount, setOnlineCount] = useState(1);
  const [toastMessage, setToastMessage] = useState("");

  // Reusable Modal States
  const [fullImageSrc, setFullImageSrc] = useState<string | null>(null);
  const [fullTextTitle, setFullTextTitle] = useState("");
  const [fullTextBody, setFullTextBody] = useState<string | null>(null);

  // Global State
  const [items, setItems] = useState<Item[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [repairHistory, setRepairHistory] = useState<RepairHistory[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [maintenanceJobs, setMaintenanceJobs] = useState<MaintenanceJob[]>([]);
  const [cncs, setCncs] = useState<Cnc[]>([]);
  const [cncAlarms, setCncAlarms] = useState<CncAlarm[]>([]);

  // 1. Initial State Loading
  useEffect(() => {
    // Load local state immediately to make app feel instant
    const localState = getLocalState();
    setItems(localState.items);
    setActivities(localState.activities);
    setRepairHistory(localState.repairHistory);
    setMachines(localState.machines);
    setMaintenanceJobs(localState.maintenanceJobs);
    setCncs(localState.cncs);
    setCncAlarms(localState.cncAlarms);

    // Retrieve previous login state
    const isLogged = sessionStorage.getItem("ltd-maintenance-login-v1");
    const loggedUser = sessionStorage.getItem("ltd-maintenance-user-name");
    if (isLogged === "true" && loggedUser) {
      setCurrentUser(loggedUser);
    }

    // Ping Firebase Realtime Database and populate state with live data
    const syncWithFirebase = async () => {
      try {
        const [
          cloudItems,
          cloudActivities,
          cloudHistory,
          cloudMachines,
          cloudJobs,
          cloudCncs,
          cloudCncAlarms
        ] = await Promise.all([
          fbFetch("items"),
          fbFetch("activities"),
          fbFetch("repairHistory"),
          fbFetch("machines"),
          fbFetch("maintenanceJobs"),
          fbFetch("cncs"),
          fbFetch("cncAlarms")
        ]);

        const freshState = {
          items: cloudItems ? Object.values(cloudItems) as Item[] : localState.items,
          activities: cloudActivities
            ? (Object.values(cloudActivities) as Activity[]).sort(
                (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
              )
            : localState.activities,
          repairHistory: cloudHistory
            ? (Object.values(cloudHistory) as RepairHistory[])
            : localState.repairHistory,
          machines: cloudMachines
            ? (Object.values(cloudMachines) as Machine[])
            : localState.machines,
          maintenanceJobs: cloudJobs
            ? (Object.values(cloudJobs) as MaintenanceJob[])
            : localState.maintenanceJobs,
          cncs: cloudCncs ? (Object.values(cloudCncs) as Cnc[]) : localState.cncs,
          cncAlarms: cloudCncAlarms
            ? (Object.values(cloudCncAlarms) as CncAlarm[])
            : localState.cncAlarms
        };

        setItems(freshState.items);
        setActivities(freshState.activities);
        setRepairHistory(freshState.repairHistory);
        setMachines(freshState.machines);
        setMaintenanceJobs(freshState.maintenanceJobs);
        setCncs(freshState.cncs);
        setCncAlarms(freshState.cncAlarms);

        saveLocalState(freshState);
        showToast("Đã đồng bộ dữ liệu đám mây mới nhất.");
      } catch (e) {
        console.warn("Could not sync with Firebase cloud database:", e);
      }
    };

    syncWithFirebase();

    // Setup active session tracking
    let sessionId = sessionStorage.getItem("ltd_user_session_id");
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem("ltd_user_session_id", sessionId);
    }

    const reportSession = async () => {
      try {
        await fbFetch(`online_users/${sessionId}`, "PUT", { timestamp: Date.now() });
      } catch (e) {}
    };

    reportSession();
    const sessionTimer = setInterval(reportSession, 15000);

    const checkOnline = async () => {
      try {
        const users = await fbFetch("online_users");
        if (users) {
          const now = Date.now();
          let active = 0;
          for (const key in users) {
            if (now - users[key].timestamp < 45000) {
              active++;
            } else {
              fbFetch(`online_users/${key}`, "DELETE");
            }
          }
          setOnlineCount(Math.max(1, active));
        }
      } catch (e) {}
    };

    const onlineTimer = setInterval(checkOnline, 12000);
    checkOnline();

    return () => {
      clearInterval(sessionTimer);
      clearInterval(onlineTimer);
    };
  }, []);

  // 2. Realtime IoT machine telemetry simulator (running only)
  useEffect(() => {
    const simulator = setInterval(() => {
      setCncs((prevCncs) => {
        let hasChanges = false;
        const next = prevCncs.map((c) => {
          if (c.status === "running") {
            hasChanges = true;
            const deltaSpindle = Math.floor((Math.random() - 0.5) * 12);
            const spindleSpeed = Math.max(0, c.targetSpindleSpeed + deltaSpindle);

            const deltaFeed = Math.floor((Math.random() - 0.5) * 5);
            const feedrate = Math.max(0, c.targetFeedrate + deltaFeed);

            let currentBlock = c.currentBlock;
            if (Math.random() > 0.7) {
              const opcodes = ["G01", "G02", "G03", "G00", "M03", "M08"];
              currentBlock = `N${Math.floor(Math.random() * 600)} ${
                opcodes[Math.floor(Math.random() * opcodes.length)]
              } X${(Math.random() * 120).toFixed(1)} Z${(Math.random() * -60).toFixed(1)}`;
            }

            return { ...c, spindleSpeed, feedrate, currentBlock };
          }
          return c;
        });

        if (hasChanges) {
          // Sync with localStorage periodically
          const current = getLocalState();
          saveLocalState({ ...current, cncs: next });
        }
        return next;
      });
    }, 4000);

    return () => clearInterval(simulator);
  }, []);

  // helper to trigger status notifications
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(""), 4000);
  };

  // Helper activity adder
  const addActivity = (text: string) => {
    const freshAct: Activity = { at: new Date().toISOString(), text };
    setActivities((prev) => {
      const next = [freshAct, ...prev].slice(0, 50);
      const current = getLocalState();
      saveLocalState({ ...current, activities: next });
      syncNode("activities", next);
      return next;
    });
  };

  // Auth triggers
  const handleLoginSuccess = (name: string) => {
    setCurrentUser(name);
    sessionStorage.setItem("ltd-maintenance-login-v1", "true");
    sessionStorage.setItem("ltd-maintenance-user-name", name);
    addActivity(`Nhân viên ${name} đăng nhập thành công.`);
  };

  const handleLogout = () => {
    addActivity(`Nhân viên ${currentUser} đăng xuất.`);
    setCurrentUser(null);
    sessionStorage.removeItem("ltd-maintenance-login-v1");
    sessionStorage.removeItem("ltd-maintenance-user-name");
    setActivePage("overviewPage");
  };

  // Core modification triggers
  const handleAddItem = (itemPayload: Omit<Item, "id"> & { id?: string }) => {
    const id = itemPayload.id || `item-${crypto.randomUUID()}`;
    const newItem: Item = { ...itemPayload, id };

    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      let next;
      if (idx >= 0) {
        next = [...prev];
        next[idx] = newItem;
        addActivity(`Cập nhật linh kiện kho: ${newItem.name}`);
      } else {
        next = [...prev, newItem];
        addActivity(`Nhập thêm mã linh kiện mới: ${newItem.name}`);
      }

      const current = getLocalState();
      saveLocalState({ ...current, items: next });
      syncNode("items", next);
      return next;
    });
    showToast("Đã lưu thông tin linh kiện kho.");
  };

  const handleDeleteItem = (id: string) => {
    const target = items.find((i) => i.id === id);
    if (!target) return;
    if (
      !confirm(
        `Xác nhận xóa linh kiện "${target.name}"? Thao tác này không thể hoàn tác.`
      )
    )
      return;

    setItems((prev) => {
      const next = prev.filter((i) => i.id !== id);
      addActivity(`Xóa mã linh kiện: ${target.name}`);

      const current = getLocalState();
      saveLocalState({ ...current, items: next });
      fbFetch(`items/${id}`, "DELETE");
      return next;
    });
    showToast("Đã xóa linh kiện.");
  };

  const handleUpdateStock = (
    id: string,
    amount: number,
    type: "in" | "out",
    note: string
  ) => {
    setItems((prev) => {
      const next = [...prev];
      const idx = next.findIndex((i) => i.id === id);
      if (idx >= 0) {
        const item = next[idx];
        if (type === "out" && amount > item.quantity) {
          alert("Lỗi: Số lượng xuất kho vượt quá mức lượng tồn thực tế!");
          return prev;
        }

        const oldQty = item.quantity;
        item.quantity += type === "in" ? amount : -amount;

        addActivity(
          `${type === "in" ? "Nhập thêm" : "Xuất sử dụng"} ${amount} bộ ${
            item.name
          } (Lý do: ${note})`
        );

        const current = getLocalState();
        saveLocalState({ ...current, items: next });
        syncNode("items", next);
        showToast("Cập nhật số lượng kho thành công!");
      }
      return next;
    });
  };

  const handleAddMachine = (machinePayload: Omit<Machine, "id"> & { id?: string }) => {
    const id = machinePayload.id || `m-${crypto.randomUUID()}`;
    const newMachine: Machine = { ...machinePayload, id };

    setMachines((prev) => {
      const idx = prev.findIndex((m) => m.id === id);
      let next;
      if (idx >= 0) {
        next = [...prev];
        next[idx] = newMachine;
        addActivity(`Cập nhật hồ sơ thiết bị: ${newMachine.name}`);
        // Cascade machine name modifications to existing maintenance jobs
        setMaintenanceJobs((prevJobs) => {
          const nextJobs = prevJobs.map((j) =>
            j.machineId === id ? { ...j, machineName: newMachine.name } : j
          );
          const current = getLocalState();
          saveLocalState({ ...current, maintenanceJobs: nextJobs });
          syncNode("maintenanceJobs", nextJobs);
          return nextJobs;
        });
      } else {
        next = [...prev, newMachine];
        addActivity(`Thêm mới thiết bị nhà xưởng: ${newMachine.name}`);
      }

      const current = getLocalState();
      saveLocalState({ ...current, machines: next });
      syncNode("machines", next);
      return next;
    });
    showToast("Lưu hồ sơ máy móc thành công.");
  };

  const handleDeleteMachine = (id: string) => {
    const target = machines.find((m) => m.id === id);
    if (!target) return;
    if (
      !confirm(
        `Xác nhận xóa máy "${target.name}"? LƯU Ý: Tất cả các lịch trình bảo trì Job liên quan sẽ bị xóa.`
      )
    )
      return;

    setMachines((prev) => {
      const next = prev.filter((m) => m.id !== id);
      addActivity(`Xóa hồ sơ máy xưởng: ${target.name}`);

      const current = getLocalState();
      saveLocalState({ ...current, machines: next });
      fbFetch(`machines/${id}`, "DELETE");
      return next;
    });

    // Clean up jobs belonging to this machine
    setMaintenanceJobs((prev) => {
      const next = prev.filter((j) => j.machineId !== id);
      const current = getLocalState();
      saveLocalState({ ...current, maintenanceJobs: next });
      syncNode("maintenanceJobs", next);
      return next;
    });

    showToast("Đã xóa thiết bị máy và các công việc liên đới.");
  };

  const handleAddJob = (jobPayload: Omit<MaintenanceJob, "id"> & { id?: string }) => {
    const id = jobPayload.id || `job-${crypto.randomUUID()}`;
    const newJob: MaintenanceJob = { ...jobPayload, id };

    setMaintenanceJobs((prev) => {
      const idx = prev.findIndex((j) => j.id === id);
      let next;
      if (idx >= 0) {
        next = [...prev];
        next[idx] = newJob;
        addActivity(`Cập nhật kế hoạch bảo dưỡng Job: ${newJob.jobName}`);
      } else {
        next = [...prev, newJob];
        addActivity(`Tạo kế hoạch bảo dưỡng mới: ${newJob.jobName}`);
      }

      const current = getLocalState();
      saveLocalState({ ...current, maintenanceJobs: next });
      syncNode("maintenanceJobs", next);
      return next;
    });
    showToast("Lưu kế hoạch bảo trì thành công.");
  };

  const handleDeleteJob = (id: string) => {
    const target = maintenanceJobs.find((j) => j.id === id);
    if (!target) return;
    if (!confirm(`Hủy bỏ kế hoạch bảo dưỡng Job "${target.jobName}"?`)) return;

    setMaintenanceJobs((prev) => {
      const next = prev.filter((j) => j.id !== id);
      addActivity(`Xóa kế hoạch bảo dưỡng: ${target.jobName}`);

      const current = getLocalState();
      saveLocalState({ ...current, maintenanceJobs: next });
      fbFetch(`maintenanceJobs/${id}`, "DELETE");
      return next;
    });
    showToast("Đã hủy bỏ kế hoạch bảo trì.");
  };

  const handleCompleteAndRenewJob = (id: string) => {
    const j = maintenanceJobs.find((x) => x.id === id);
    if (!j) return;

    const currentNextDate = new Date(j.nextDate);
    if (isNaN(currentNextDate.getTime())) return;

    // Create a breakdown history log auto-prefilled from job completion
    const histPayload: RepairHistory = {
      id: `rh-${crypto.randomUUID()}`,
      machine: j.machineName,
      faultTime: new Date().toISOString().slice(0, 10),
      staff: "Bảo Trì Định Kỳ",
      fault: `Đến kỳ hạn bảo trì định kỳ: [${j.jobName}]`,
      fix: `Đã tiến hành quy trình kỹ thuật đạt chuẩn thành công: \n${j.desc || "Kiểm tra đạt chuẩn kỹ thuật"}`,
      image: ""
    };

    setRepairHistory((prev) => {
      const next = [histPayload, ...prev];
      const current = getLocalState();
      saveLocalState({ ...current, repairHistory: next });
      syncNode("repairHistory", next);
      return next;
    });

    // Advance scheduling date by period months
    currentNextDate.setMonth(currentNextDate.getMonth() + Number(j.period));
    const nextDate = currentNextDate.toISOString().slice(0, 10);

    setMaintenanceJobs((prev) => {
      const next = prev.map((item) => (item.id === id ? { ...item, nextDate } : item));
      addActivity(`Hoàn thành kỳ này & dời lịch kế tiếp Job: ${j.jobName}`);

      const current = getLocalState();
      saveLocalState({ ...current, maintenanceJobs: next });
      syncNode("maintenanceJobs", next);
      return next;
    });

    showToast("Bảo trì thành công! Hệ thống tự động thiết lập chu kỳ tới.");
  };

  const handleAddHistory = (histPayload: Omit<RepairHistory, "id"> & { id?: string }) => {
    const id = histPayload.id || `rh-${crypto.randomUUID()}`;
    const newHist: RepairHistory = { ...histPayload, id };

    setRepairHistory((prev) => {
      const idx = prev.findIndex((h) => h.id === id);
      let next;
      if (idx >= 0) {
        next = [...prev];
        next[idx] = newHist;
        addActivity(`Sửa đổi nhật ký sửa chữa máy: ${newHist.machine}`);
      } else {
        next = [newHist, ...prev];
        addActivity(`Ghi sự cố sửa chữa đột xuất máy: ${newHist.machine}`);
      }

      const current = getLocalState();
      saveLocalState({ ...current, repairHistory: next });
      syncNode("repairHistory", next);
      return next;
    });
    showToast("Đã lưu biên bản nhật ký sự cố.");
  };

  const handleDeleteHistory = (id: string) => {
    const target = repairHistory.find((h) => h.id === id);
    if (!target) return;
    if (!confirm(`Xóa biên bản sửa chữa sự cố này trên Cloud?`)) return;

    setRepairHistory((prev) => {
      const next = prev.filter((h) => h.id !== id);
      addActivity(`Xóa nhật ký sự cố máy: ${target.machine}`);

      const current = getLocalState();
      saveLocalState({ ...current, repairHistory: next });
      fbFetch(`repairHistory/${id}`, "DELETE");
      return next;
    });
    showToast("Đã xóa biên bản.");
  };

  // IoT CNC modifiers
  const handleAddCnc = (cncPayload: Omit<Cnc, "id"> & { id?: string }) => {
    const id = cncPayload.id || `cnc-${crypto.randomUUID()}`;
    const newCnc: Cnc = { ...cncPayload, id };

    setCncs((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      let next;
      if (idx >= 0) {
        next = [...prev];
        next[idx] = newCnc;
        addActivity(`Cập nhật kết nối máy CNC: ${newCnc.name}`);
      } else {
        next = [...prev, newCnc];
        addActivity(`Kích hoạt giám sát máy CNC mới: ${newCnc.name}`);
      }

      const current = getLocalState();
      saveLocalState({ ...current, cncs: next });
      syncNode("cncs", next);
      return next;
    });
    showToast("Lưu kết nối CNC thành công.");
  };

  const handleDeleteCnc = (id: string) => {
    const target = cncs.find((c) => c.id === id);
    if (!target) return;
    if (!confirm(`Ngắt kết nối và xóa máy CNC "${target.name}"?`)) return;

    setCncs((prev) => {
      const next = prev.filter((c) => c.id !== id);
      addActivity(`Xóa máy CNC khỏi giám sát: ${target.name}`);

      const current = getLocalState();
      saveLocalState({ ...current, cncs: next });
      fbFetch(`cncs/${id}`, "DELETE");
      return next;
    });
    showToast("Đã ngắt kết nối máy CNC.");
  };

  const handleClearCncAlarm = (cncId: string) => {
    const target = cncs.find((c) => c.id === cncId);
    if (!target) return;

    // Resolve matching active alarms in log history
    setCncAlarms((prevAlarms) => {
      const nextAlarms = prevAlarms.map((alarm) => {
        if (alarm.cncId === cncId && !alarm.resolvedAt) {
          return { ...alarm, resolvedAt: new Date().toISOString() };
        }
        return alarm;
      });
      const current = getLocalState();
      saveLocalState({ ...current, cncAlarms: nextAlarms });
      syncNode("cncAlarms", nextAlarms);
      return nextAlarms;
    });

    setCncs((prev) => {
      const next = prev.map((c) => {
        if (c.id === cncId) {
          return {
            ...c,
            status: "running" as const,
            alarm: "",
            spindleSpeed: c.targetSpindleSpeed,
            feedrate: c.targetFeedrate
          };
        }
        return c;
      });

      addActivity(`Xóa lỗi cảnh báo (Clear Alarm) máy CNC: ${target.name}`);
      const current = getLocalState();
      saveLocalState({ ...current, cncs: next });
      syncNode("cncs", next);
      return next;
    });

    showToast("Cảnh báo lỗi đã được xóa. Máy CNC trở lại Sẵn Sàng (RUN).");
  };

  // Auto pre-fill breakdown history report from a CNC FOCAS alarm
  const handleAutoCreateHistory = (cncName: string, alarmText: string) => {
    setActivePage("historyPage");
    showToast("Hệ thống đã tự động liên kết mã lỗi CNC vào biên bản!");
    setTimeout(() => {
      const addHistBtn = document.getElementById("addHistBtn");
      if (addHistBtn) addHistBtn.click();
      const machInput = document.getElementById("machine") as HTMLInputElement;
      const faultInput = document.getElementById("fault") as HTMLTextAreaElement;
      const fixInput = document.getElementById("fix") as HTMLTextAreaElement;
      if (machInput) machInput.value = cncName;
      if (faultInput)
        faultInput.value = `Ghi nhận lỗi IoT qua FOCAS Ethernet:\nMã lỗi phát hiện: ${alarmText}`;
      if (fixInput)
        fixInput.value = "Tiến hành đo kiểm tủ điện phụ máy CNC, thay thế vật tư...";
    }, 400);
  };

  // EXCEL / CSV Downloading Utility
  const downloadCsv = (headers: string[], rows: any[][], filename: string) => {
    const csvContent = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c ?? "").replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`Đã xuất file báo cáo ${filename}.csv`);
  };

  const handleExportData = () => {
    if (activePage === "inventoryPage") {
      const h = [
        "Tên linh kiện",
        "Mã SKU",
        "Nhóm linh kiện",
        "Thông số kỹ thuật",
        "Số lượng tồn",
        "Mức tối thiểu",
        "Vị trí kệ",
        "Thiết bị áp dụng",
        "Giá tham khảo"
      ];
      const r = items.map((i) => [
        i.name,
        i.sku,
        i.category,
        i.specs,
        i.quantity,
        i.min,
        i.location,
        i.supplier,
        i.price
      ]);
      downloadCsv(h, r, "kho-linh-kien-ltd");
    } else if (activePage === "machinesPage") {
      const h = ["Tên máy thiết bị", "Ngày lắp", "Hạn bảo hành", "Nhà cung cấp", "SĐT"];
      const r = machines.map((m) => [m.name, m.setupDate, m.warranty, m.vendor, m.phone]);
      downloadCsv(h, r, "danh-sach-may-ltd");
    } else if (activePage === "maintenanceJobsPage") {
      const h = [
        "Tên máy xưởng",
        "Tên Job bảo trì",
        "Chu kỳ (tháng)",
        "Ngày đến hạn tiếp theo",
        "Quy trình hướng dẫn"
      ];
      const r = maintenanceJobs.map((j) => [
        j.machineName,
        j.jobName,
        j.period,
        j.nextDate,
        j.desc
      ]);
      downloadCsv(h, r, "ke-hoach-job-bao-tri-ltd");
    } else if (activePage === "historyPage") {
      const h = [
        "Ngày sửa sự cố",
        "Máy bị lỗi",
        "Người sửa chữa",
        "Mô tả sự cố",
        "Biện pháp khắc phục"
      ];
      const r = repairHistory.map((rh) => [
        rh.faultTime,
        rh.machine,
        rh.staff,
        rh.fault,
        rh.fix
      ]);
      downloadCsv(h, r, "lich-su-sua-may-ltd");
    } else if (activePage === "cncMonitoringPage") {
      // Export historical CNC alarms list in Excel XML format
      const headers = [
        "Thời gian phát hiện",
        "Tên máy CNC",
        "Mã Alarm",
        "Mô tả chi tiết lỗi",
        "Nhóm linh kiện khắc phục",
        "Trạng thái",
        "Thời gian xử lý"
      ];
      const rows = cncAlarms.map((a) => {
        const keyword = getAlarmKeyword(a.alarmCode);
        return [
          a.timestamp,
          a.cncName,
          a.alarmCode,
          a.description,
          keyword,
          a.resolvedAt ? "Đã xử lý" : "Đang lỗi",
          a.resolvedAt || "—"
        ];
      });

      const esc = (v: any) =>
        String(v ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");

      let html = '<html><head><meta charset="UTF-8"></head><body><table border="1"><thead><tr>';
      html += headers.map((h) => `<th>${esc(h)}</th>`).join("");
      html += "</tr></thead><tbody>";
      rows.forEach((row) => {
        html += "<tr>" + row.map((c) => `<td>${esc(c)}</td>`).join("") + "</tr>";
      });
      html += "</tbody></table></body></html>";

      const blob = new Blob(["\ufeff" + html], { type: "application/vnd.ms-excel;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `lich-su-alarm-cnc-ltd-${new Date().toISOString().slice(0, 10)}.xls`;
      link.click();
      URL.revokeObjectURL(url);
      showToast("Đã xuất Excel lịch sử Alarm máy CNC.");
    }
  };

  // Reusable modal controllers
  const handleShowFullImage = (src: string) => {
    setFullImageSrc(src);
  };

  const handleShowFullText = (title: string, body: string) => {
    setFullTextTitle(title);
    setFullTextBody(body);
  };

  // Page specific details
  const getPageTitle = () => {
    switch (activePage) {
      case "overviewPage":
        return "TỔNG QUAN HỆ THỐNG LTD";
      case "inventoryPage":
        return "HỆ THỐNG KHO LTD";
      case "cncMonitoringPage":
        return "GIÁM SÁT MÁY CNC FANUC";
      case "machinesPage":
        return "HỒ SƠ MÁY XƯỞNG";
      case "maintenanceJobsPage":
        return "LỊCH TRÌNH BẢO TRÌ";
      case "historyPage":
        return "NHẬT KÝ SỰ CỐ";
      default:
        return "LTD VIET NAM";
    }
  };

  const getPageSubtitle = () => {
    switch (activePage) {
      case "overviewPage":
        return "Theo dõi trạng thái kho tàng, kế hoạch bảo trì thiết bị và IoT máy CNC xưởng.";
      case "inventoryPage":
        return "Quản lý vật tư linh kiện bảo dưỡng: vị trí kệ lưu trữ, mã SKU, thông số và cảnh báo hết hàng.";
      case "cncMonitoringPage":
        return "Kết nối trực tiếp bộ điều khiển Fanuc FOCAS qua mạng, theo dõi RPM, Feedrate, G-code và cross-check tồn kho vật tư sửa chữa.";
      case "machinesPage":
        return "Hồ sơ lưu trữ lý lịch thiết bị công nghiệp lắp đặt trong nhà xưởng.";
      case "maintenanceJobsPage":
        return "Thiết lập kế hoạch bảo trì định kỳ, checklist thao tác kỹ thuật và chu kỳ thay thế rơ le, cảm biến.";
      case "historyPage":
        return "Nhật ký lưu giữ biên bản báo cáo sửa chữa, khắc phục sự cố đột xuất cơ điện xưởng.";
      default:
        return "Hệ thống quản lý LTD VIET NAM";
    }
  };

  // Guard authentication
  if (!currentUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col md:flex-row relative">
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-full md:w-[260px] bg-[#0f241d] text-slate-200 p-6 flex flex-col gap-6 sticky top-0 md:h-screen border-r border-slate-800 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-white p-1 rounded-lg">
            <svg
              className="w-10 h-10 text-emerald-800"
              viewBox="0 0 50 50"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect width="50" height="50" rx="8" fill="#115e46" />
              <text
                x="50%"
                y="55%"
                dominantBaseline="middle"
                textAnchor="middle"
                fill="#ffffff"
                fontFamily="sans-serif"
                fontWeight="900"
                fontSize="18"
              >
                LTD
              </text>
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-sm text-white tracking-wide uppercase leading-tight font-display">
              LTD VIET NAM
            </span>
            <span className="text-[10px] text-emerald-400 font-bold tracking-wider uppercase">
              Cloud System
            </span>
          </div>
        </div>

        <nav className="flex flex-col gap-1 md:flex-1 py-4">
          <button
            onClick={() => setActivePage("overviewPage")}
            className={`w-full min-h-[44px] rounded-xl flex items-center gap-3 px-4 text-sm font-semibold transition-all cursor-pointer ${
              activePage === "overviewPage"
                ? "bg-white/10 text-white shadow-xs"
                : "text-[#a7c1b3] hover:bg-white/5 hover:text-white"
            }`}
          >
            <LayoutDashboard className="h-4.5 w-4.5" />
            Tổng quan
          </button>

          <button
            onClick={() => setActivePage("inventoryPage")}
            className={`w-full min-h-[44px] rounded-xl flex items-center gap-3 px-4 text-sm font-semibold transition-all cursor-pointer ${
              activePage === "inventoryPage"
                ? "bg-white/10 text-white shadow-xs"
                : "text-[#a7c1b3] hover:bg-white/5 hover:text-white"
            }`}
          >
            <Package className="h-4.5 w-4.5" />
            Linh kiện kho
          </button>

          <button
            onClick={() => setActivePage("cncMonitoringPage")}
            className={`w-full min-h-[44px] rounded-xl flex items-center gap-3 px-4 text-sm font-semibold transition-all cursor-pointer ${
              activePage === "cncMonitoringPage"
                ? "bg-white/10 text-white shadow-xs"
                : "text-[#a7c1b3] hover:bg-white/5 hover:text-white"
            }`}
          >
            <Cpu className="h-4.5 w-4.5" />
            Giám sát CNC
          </button>

          <button
            onClick={() => setActivePage("machinesPage")}
            className={`w-full min-h-[44px] rounded-xl flex items-center gap-3 px-4 text-sm font-semibold transition-all cursor-pointer ${
              activePage === "machinesPage"
                ? "bg-white/10 text-white shadow-xs"
                : "text-[#a7c1b3] hover:bg-white/5 hover:text-white"
            }`}
          >
            <Settings className="h-4.5 w-4.5" />
            Danh sách máy
          </button>

          <button
            onClick={() => setActivePage("maintenanceJobsPage")}
            className={`w-full min-h-[44px] rounded-xl flex items-center gap-3 px-4 text-sm font-semibold transition-all cursor-pointer ${
              activePage === "maintenanceJobsPage"
                ? "bg-white/10 text-white shadow-xs"
                : "text-[#a7c1b3] hover:bg-white/5 hover:text-white"
            }`}
          >
            <Calendar className="h-4.5 w-4.5" />
            Lịch bảo trì
          </button>

          <button
            onClick={() => setActivePage("historyPage")}
            className={`w-full min-h-[44px] rounded-xl flex items-center gap-3 px-4 text-sm font-semibold transition-all cursor-pointer ${
              activePage === "historyPage"
                ? "bg-white/10 text-white shadow-xs"
                : "text-[#a7c1b3] hover:bg-white/5 hover:text-white"
            }`}
          >
            <History className="h-4.5 w-4.5" />
            Lịch sử sửa chữa
          </button>
        </nav>

        {/* Sidebar Footer */}
        <div className="mt-auto bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-2 text-xs">
          <strong className="text-white block font-display">
            {new Date().toLocaleDateString("vi-VN", {
              weekday: "long",
              day: "2-digit",
              month: "2-digit",
              year: "numeric"
            })}
          </strong>
          <div className="text-emerald-400 font-bold flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>Đang truy cập: {onlineCount} người</span>
          </div>
          <span className="text-[10px] text-emerald-300 font-bold block mt-1">
            ● Đám mây (Firebase) đã kết nối
          </span>
        </div>
      </aside>

      {/* MAIN MAIN PANEL */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* TOPBAR */}
        <header className="bg-white/80 backdrop-blur-md sticky top-0 border-b border-slate-200 px-6 py-5 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between z-9">
          <div>
            <h2 className="text-xl font-extrabold text-[#0d201a] tracking-tight font-display">
              {getPageTitle()}
            </h2>
            <p className="text-xs text-slate-500 mt-1 font-semibold leading-relaxed">
              {getPageSubtitle()}
            </p>
          </div>

          <div className="flex gap-2 items-center justify-end self-stretch sm:self-auto flex-wrap">
            {activePage !== "overviewPage" && (
              <button
                onClick={handleExportData}
                className="bg-white border border-slate-200 hover:border-[#115e46] text-slate-700 hover:text-[#115e46] text-xs font-bold rounded-xl px-4 py-2 flex items-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <Download className="h-4 w-4" />
                {activePage === "cncMonitoringPage" ? "Xuất Alarm Excel" : "Xuất báo cáo CSV"}
              </button>
            )}

            <button
              onClick={handleLogout}
              className="bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-100 text-xs font-bold rounded-xl px-4 py-2 flex items-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              <LogOut className="h-4 w-4" />
              Đăng xuất
            </button>
          </div>
        </header>

        {/* CONTAINER CONTENT */}
        <div className="p-6 md:p-8 max-w-7xl w-full mx-auto flex-1">
          {activePage === "overviewPage" && (
            <Overview
              items={items}
              activities={activities}
              maintenanceJobs={maintenanceJobs}
              cncs={cncs}
              onNavigate={setActivePage}
              onAutoCreateHistory={handleAutoCreateHistory}
              onClearCncAlarm={handleClearCncAlarm}
            />
          )}

          {activePage === "inventoryPage" && (
            <Inventory
              items={items}
              onAddItem={handleAddItem}
              onDeleteItem={handleDeleteItem}
              onUpdateStock={handleUpdateStock}
              onShowFullImage={handleShowFullImage}
              onShowFullText={handleShowFullText}
            />
          )}

          {activePage === "cncMonitoringPage" && (
            <CncMonitoring
              cncs={cncs}
              cncAlarms={cncAlarms}
              items={items}
              onAddCnc={handleAddCnc}
              onDeleteCnc={handleDeleteCnc}
              onClearAlarm={handleClearCncAlarm}
              onAutoCreateHistory={handleAutoCreateHistory}
              onShowFullText={handleShowFullText}
            />
          )}

          {activePage === "machinesPage" && (
            <Machines
              machines={machines}
              onAddMachine={handleAddMachine}
              onDeleteMachine={handleDeleteMachine}
              onShowFullText={handleShowFullText}
            />
          )}

          {activePage === "maintenanceJobsPage" && (
            <MaintenanceJobs
              maintenanceJobs={maintenanceJobs}
              machines={machines}
              onAddJob={handleAddJob}
              onDeleteJob={handleDeleteJob}
              onCompleteAndRenew={handleCompleteAndRenewJob}
              onShowFullText={handleShowFullText}
            />
          )}

          {activePage === "historyPage" && (
            <RepairHistoryView
              repairHistory={repairHistory}
              onAddHistory={handleAddHistory}
              onDeleteHistory={handleDeleteHistory}
              onShowFullImage={handleShowFullImage}
              onShowFullText={handleShowFullText}
            />
          )}
        </div>
      </main>

      {/* TOAST SYSTEM */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-slate-900 border-l-4 border-[#115e46] text-white p-4 rounded-xl shadow-2xl flex items-center gap-3 z-50 animate-bounce max-w-md">
          <CheckCircle className="h-5 w-5 text-emerald-400 flex-shrink-0" />
          <span className="text-xs font-bold font-sans">{toastMessage}</span>
        </div>
      )}

      {/* ZOOMABLE FULL IMAGE VIEWER MODAL */}
      {fullImageSrc && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#080808] rounded-2xl border border-white/10 max-w-3xl w-full overflow-hidden shadow-2xl relative">
            <div className="px-6 py-4 bg-[#111] border-b border-white/5 flex justify-between items-center text-white">
              <span className="text-sm font-bold">Hình ảnh hiện trạng chi tiết</span>
              <button
                onClick={() => setFullImageSrc(null)}
                className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="p-6 flex justify-center bg-black/40">
              <img
                src={fullImageSrc}
                alt="Hình ảnh đầy đủ"
                className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-xl"
              />
            </div>
          </div>
        </div>
      )}

      {/* FULL DRILL-DOWN TEXT VIEWER MODAL */}
      {fullTextBody && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#115e46]" />
                {fullTextTitle}
              </h3>
              <button
                onClick={() => setFullTextBody(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-200/60 flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <div className="p-6 max-h-[50vh] overflow-y-auto">
              <p className="text-sm text-slate-800 leading-relaxed font-semibold whitespace-pre-wrap font-sans">
                {fullTextBody}
              </p>
            </div>
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setFullTextBody(null)}
                className="bg-[#115e46] hover:bg-[#093f2f] text-white font-bold px-4 py-2 rounded-lg text-xs"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
