import React from "react";
import { Item, Activity, MaintenanceJob, Cnc } from "../types";
import {
  Package,
  Layers,
  AlertTriangle,
  Cpu,
  Clock,
  TrendingUp,
  AlertCircle
} from "lucide-react";

interface OverviewProps {
  items: Item[];
  activities: Activity[];
  maintenanceJobs: MaintenanceJob[];
  cncs: Cnc[];
  onNavigate: (pageId: string) => void;
  onAutoCreateHistory: (cncName: string, alarmText: string) => void;
  onClearCncAlarm: (cncId: string) => void;
}

export default function Overview({
  items,
  activities,
  maintenanceJobs,
  cncs,
  onNavigate,
  onAutoCreateHistory,
  onClearCncAlarm
}: OverviewProps) {
  const number = new Intl.NumberFormat("vi-VN");
  const todayStr = new Date().toISOString().slice(0, 10);

  // Calculate metrics
  const totalItems = items.length;
  const totalUnits = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalShelves = new Set(items.map((i) => i.location).filter(Boolean)).size;
  
  const lowStockItems = items.filter((i) => {
    if (i.quantity <= 0) return true;
    if (i.quantity <= i.min) return true;
    return false;
  });
  const lowStockCount = lowStockItems.length;

  const cncTotal = cncs.length;
  const cncRun = cncs.filter((c) => c.status === "running").length;
  const cncHold = cncs.filter((c) => c.status === "hold").length;
  const cncAlarm = cncs.filter((c) => c.status === "alarm").length;

  const overdueJobs = maintenanceJobs.filter(
    (j) => j.nextDate && j.nextDate <= todayStr
  );
  const overdueJobsCount = overdueJobs.length;

  // Render recent Alerts (low stock, alarms, overdue jobs)
  const renderedAlerts = [];

  // 1. Overdue maintenance jobs
  overdueJobs.forEach((j) => {
    renderedAlerts.push({
      type: "job",
      level: "danger",
      title: "🚨 ĐẾN HẠN BẢO TRÌ",
      subtitle: `Thiết bị: ${j.machineName}`,
      detail: `Hạng mục: ${j.jobName}`,
      meta: `Hạn dự kiến: ${new Date(j.nextDate).toLocaleDateString("vi-VN")}. Chu kỳ: ${j.period} tháng.`,
      action: () => onNavigate("maintenanceJobsPage")
    });
  });

  // 2. Active CNC alarms
  cncs.forEach((c) => {
    if (c.status === "alarm" && c.alarm) {
      renderedAlerts.push({
        type: "cnc",
        level: "danger",
        title: "🚨 CNC ALARM (FANUC IoT)",
        subtitle: c.name,
        detail: c.alarm,
        meta: `IP: ${c.ip}. Hãy kiểm tra linh kiện và khắc phục gấp.`,
        action: () => onNavigate("cncMonitoringPage")
      });
    }
  });

  // 3. Low stock items
  lowStockItems.forEach((i) => {
    const isOut = i.quantity <= 0;
    renderedAlerts.push({
      type: "stock",
      level: isOut ? "danger" : "warn",
      title: isOut ? "❌ HẾT LINH KIỆN KHO" : "⚠️ SẮP HẾT LINH KIỆN",
      subtitle: i.name,
      detail: `Mã SKU: ${i.sku} | Vị trí: ${i.location || "Không rõ"}`,
      meta: `Tồn kho: ${i.quantity} (Tối thiểu cảnh báo: ${i.min})`,
      action: () => onNavigate("inventoryPage")
    });
  });

  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm relative overflow-hidden before:absolute before:top-0 before:left-0 before:w-1 before:h-full before:bg-[#115e46]">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Tổng mã linh kiện
            </span>
            <Package className="h-5 w-5 text-[#115e46]" />
          </div>
          <p className="text-3xl font-extrabold text-slate-900 mt-2 font-display">
            {number.format(totalItems)}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm relative overflow-hidden before:absolute before:top-0 before:left-0 before:w-1 before:h-full before:bg-[#115e46]">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Tổng số lượng tồn
            </span>
            <TrendingUp className="h-5 w-5 text-[#115e46]" />
          </div>
          <p className="text-3xl font-extrabold text-slate-900 mt-2 font-display">
            {number.format(totalUnits)}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm relative overflow-hidden before:absolute before:top-0 before:left-0 before:w-1 before:h-full before:bg-[#115e46]">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Kệ chứa linh kiện
            </span>
            <Layers className="h-5 w-5 text-[#115e46]" />
          </div>
          <p className="text-3xl font-extrabold text-slate-900 mt-2 font-display">
            {number.format(totalShelves)}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm relative overflow-hidden before:absolute before:top-0 before:left-0 before:w-1 before:h-full before:bg-rose-500">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-rose-500 uppercase tracking-wider">
              Sắp hết / Hết hàng
            </span>
            <AlertTriangle className="h-5 w-5 text-rose-500" />
          </div>
          <p className="text-3xl font-extrabold text-rose-600 mt-2 font-display">
            {number.format(lowStockCount)}
          </p>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Quick Summaries Card (Left) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-bold text-[#0f241d] text-lg">
                Tóm tắt nhanh xưởng máy
              </h3>
              <span className="text-xs text-slate-500">
                Đồng bộ trực tiếp Cloud LTD
              </span>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-5">
                <div className="text-xs font-bold text-[#115e46] uppercase tracking-wider mb-2">
                  Máy CNC Giám Sát (FOCAS IoT)
                </div>
                <div className="text-4xl font-black text-[#115e46] font-display">
                  {cncTotal}
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-slate-600 mt-4 border-t border-emerald-100/60 pt-3 font-semibold">
                  <span>RUN: <strong className="text-emerald-700">{cncRun}</strong></span>
                  <span>•</span>
                  <span>HOLD: <strong className="text-amber-700">{cncHold}</strong></span>
                  <span>•</span>
                  <span>ALARM: <strong className="text-rose-600">{cncAlarm}</strong></span>
                </div>
              </div>

              <div className="bg-amber-50/30 border border-amber-100 rounded-xl p-5">
                <div className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2">
                  Thiết bị & Bảo Trì Định Kỳ
                </div>
                <div className="text-4xl font-black text-amber-800 font-display">
                  {maintenanceJobs.length}
                </div>
                <div className="text-xs text-slate-600 mt-4 border-t border-amber-100/40 pt-3 font-semibold flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-rose-500" />
                  <span>
                    Job đến kỳ hạn:{" "}
                    <strong className="text-rose-600">{overdueJobsCount}</strong>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Nav Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
            <h3 className="font-bold text-[#0f241d] text-base">
              Lối tắt quản lý hệ thống
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                onClick={() => onNavigate("inventoryPage")}
                className="p-4 bg-slate-50 border border-slate-200 hover:border-[#115e46] hover:bg-emerald-50/30 rounded-xl text-center transition-all cursor-pointer group"
              >
                <div className="text-xs font-bold text-slate-700 group-hover:text-[#115e46]">
                  Linh kiện kho
                </div>
              </button>
              <button
                onClick={() => onNavigate("cncMonitoringPage")}
                className="p-4 bg-slate-50 border border-slate-200 hover:border-[#115e46] hover:bg-emerald-50/30 rounded-xl text-center transition-all cursor-pointer group"
              >
                <div className="text-xs font-bold text-slate-700 group-hover:text-[#115e46]">
                  Giám sát CNC
                </div>
              </button>
              <button
                onClick={() => onNavigate("maintenanceJobsPage")}
                className="p-4 bg-slate-50 border border-slate-200 hover:border-[#115e46] hover:bg-emerald-50/30 rounded-xl text-center transition-all cursor-pointer group"
              >
                <div className="text-xs font-bold text-slate-700 group-hover:text-[#115e46]">
                  Lịch bảo trì
                </div>
              </button>
              <button
                onClick={() => onNavigate("historyPage")}
                className="p-4 bg-slate-50 border border-slate-200 hover:border-[#115e46] hover:bg-emerald-50/30 rounded-xl text-center transition-all cursor-pointer group"
              >
                <div className="text-xs font-bold text-slate-700 group-hover:text-[#115e46]">
                  Nhật ký sự cố
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Panel Alerts and Activities (Right) */}
        <div className="space-y-6">
          {/* Alerts Card */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-[#0f241d] text-base">
                Cảnh báo hạn & tồn kho
              </h3>
            </div>
            <div className="p-4 flex flex-col gap-3 max-h-[400px] overflow-y-auto">
              {renderedAlerts.length > 0 ? (
                renderedAlerts.map((alert, index) => (
                  <div
                    key={index}
                    onClick={alert.action}
                    className={`p-3 rounded-xl border cursor-pointer transition-all hover:scale-102 flex flex-col gap-1 ${
                      alert.level === "danger"
                        ? "border-rose-100 bg-rose-50/30 hover:bg-rose-50"
                        : "border-amber-100 bg-amber-50/20 hover:bg-amber-50"
                    }`}
                  >
                    <span
                      className={`text-[10px] font-extrabold uppercase tracking-wide ${
                        alert.level === "danger"
                          ? "text-rose-600"
                          : "text-amber-700"
                      }`}
                    >
                      {alert.title}
                    </span>
                    <strong className="text-xs font-bold text-slate-900 mt-0.5">
                      {alert.subtitle}
                    </strong>
                    <p className="text-xs text-slate-700">{alert.detail}</p>
                    <span className="text-[10px] text-slate-500 mt-1 font-medium">
                      {alert.meta}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-400 text-center py-8">
                  Hệ thống ghi nhận không có cảnh báo nào.
                </div>
              )}
            </div>
          </div>

          {/* Activities Card */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-[#0f241d] text-base">
                Hoạt động gần đây
              </h3>
            </div>
            <div className="p-4 flex flex-col gap-3 max-h-[300px] overflow-y-auto">
              {activities.length > 0 ? (
                activities.slice(0, 6).map((activity, index) => (
                  <div
                    key={index}
                    className="p-3 bg-slate-50/80 border border-slate-100 rounded-xl flex flex-col gap-1 text-xs"
                  >
                    <p className="text-slate-800 font-semibold leading-relaxed">
                      ⚡ {activity.text}
                    </p>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-1 font-mono">
                      <Clock className="h-3 w-3" />
                      {new Date(activity.at).toLocaleTimeString("vi-VN")} -{" "}
                      {new Date(activity.at).toLocaleDateString("vi-VN")}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-400 text-center py-8">
                  Không có lịch sử hoạt động nào gần đây.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
