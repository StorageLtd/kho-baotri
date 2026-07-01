import React, { useState } from "react";
import { MaintenanceJob, Machine } from "../types";
import { Search, Plus, Edit2, Trash2, Calendar, Check, Sliders, Info } from "lucide-react";

interface MaintenanceJobsProps {
  maintenanceJobs: MaintenanceJob[];
  machines: Machine[];
  onAddJob: (job: Omit<MaintenanceJob, "id"> & { id?: string }) => void;
  onDeleteJob: (id: string) => void;
  onCompleteAndRenew: (id: string) => void;
  onShowFullText: (title: string, body: string) => void;
}

export default function MaintenanceJobs({
  maintenanceJobs,
  machines,
  onAddJob,
  onDeleteJob,
  onCompleteAndRenew,
  onShowFullText
}: MaintenanceJobsProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<MaintenanceJob | null>(null);

  // Form states
  const [jMachineId, setJMachineId] = useState("");
  const [jName, setJName] = useState("");
  const [jPeriod, setJPeriod] = useState(3);
  const [jNextDate, setJNextDate] = useState("");
  const [jDesc, setJDesc] = useState("");

  const todayStr = new Date().toISOString().slice(0, 10);

  const filteredJobs = maintenanceJobs.filter((j) => {
    return (
      !searchTerm ||
      [j.machineName, j.jobName, j.desc].join(" ").toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleOpenJobModal = (job: MaintenanceJob | null = null) => {
    if (machines.length === 0) {
      alert("Lỗi: Bạn cần tạo dữ liệu Máy móc thiết bị trước khi lập kế hoạch bảo trì!");
      return;
    }
    setEditingJob(job);
    if (job) {
      setJMachineId(job.machineId);
      setJName(job.jobName);
      setJPeriod(job.period);
      setJNextDate(job.nextDate);
      setJDesc(job.desc);
    } else {
      setJMachineId(machines[0]?.id || "");
      setJName("");
      setJPeriod(3);
      setJNextDate(new Date().toISOString().slice(0, 10));
      setJDesc("");
    }
    setJobModalOpen(true);
  };

  const handleSubmitJob = (e: React.FormEvent) => {
    e.preventDefault();
    const targetMachine = machines.find((m) => m.id === jMachineId);
    if (!targetMachine) return;

    onAddJob({
      id: editingJob?.id,
      machineId: jMachineId,
      machineName: targetMachine.name,
      jobName: jName,
      period: Number(jPeriod),
      nextDate: jNextDate,
      desc: jDesc
    });
    setJobModalOpen(false);
  };

  const formatDateDisplay = (val: string) => {
    if (!val) return "—";
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return `${String(d.getDate()).padStart(2, "0")}/${String(
      d.getMonth() + 1
    ).padStart(2, "0")}/${d.getFullYear()}`;
  };

  return (
    <div className="space-y-6 animate-rise">
      {/* Search and action panel */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
            <input
              type="search"
              placeholder="Lọc kế hoạch bảo trì theo tên máy, tên công việc..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full min-h-[42px] pl-11 pr-4 rounded-xl border border-slate-200 bg-white text-slate-900 outline-none text-sm focus:border-[#115e46]"
            />
          </div>
          <button
            onClick={() => handleOpenJobModal()}
            className="bg-[#115e46] hover:bg-[#093f2f] text-white font-bold rounded-xl px-5 text-sm transition-all min-h-[42px] flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            <Plus className="h-4 w-4" />
            <span>Thêm kế hoạch mới</span>
          </button>
        </div>
      </div>

      {/* Sized Tables list */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-[#0f241d] text-base">
              Thiết lập kế hoạch bảo trì định kỳ toàn xưởng
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Tự động gia hạn và ghi biên bản khi hoàn tất chu kỳ
            </p>
          </div>
          <span className="text-xs text-slate-500 font-bold">
            Tổng {filteredJobs.length} kế hoạch
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="p-4 min-w-[200px]">Tên thiết bị máy</th>
                <th className="p-4 min-w-[240px]">Hạng mục bảo trì (Job)</th>
                <th className="p-4 min-w-[110px]">Chu kỳ lặp</th>
                <th className="p-4 min-w-[160px]">Ngày bảo trì kế tiếp</th>
                <th className="p-4 min-w-[280px]">Quy trình hướng dẫn kỹ thuật</th>
                <th className="p-4 min-w-[130px] text-center">Trạng thái</th>
                <th className="p-4 min-w-[130px] text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredJobs.length > 0 ? (
                filteredJobs.map((j) => {
                  const isOverdue = j.nextDate && j.nextDate <= todayStr;
                  return (
                    <tr key={j.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-4 font-bold text-slate-900">
                        {j.machineName}
                      </td>

                      <td className="p-4 font-bold text-[#115e46]">
                        📌 {j.jobName}
                      </td>

                      <td className="p-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded bg-emerald-50 text-[#115e46] text-xs font-extrabold border border-emerald-100">
                          {j.period} Tháng
                        </span>
                      </td>

                      <td className="p-4 font-bold">
                        <span
                          className={`font-mono text-sm ${
                            isOverdue ? "text-rose-600" : "text-emerald-700"
                          }`}
                        >
                          {formatDateDisplay(j.nextDate)}
                        </span>
                      </td>

                      <td className="p-4">
                        <button
                          onClick={() => onShowFullText("Quy trình hướng dẫn Job", j.desc)}
                          className="text-xs text-slate-500 max-w-[260px] truncate block text-left hover:text-[#115e46]"
                        >
                          {j.desc || "—"}
                        </button>
                      </td>

                      <td className="p-4 text-center">
                        {isOverdue ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-50 text-rose-600 border border-rose-100 animate-pulse">
                            🚨 Đến kỳ hạn
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                            Đang theo dõi
                          </span>
                        )}
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => onCompleteAndRenew(j.id)}
                            className="w-8 h-8 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 flex items-center justify-center cursor-pointer"
                            title="Xác nhận hoàn thành bảo dưỡng kỳ này"
                          >
                            <Check className="h-4.5 w-4.5" />
                          </button>
                          <button
                            onClick={() => handleOpenJobModal(j)}
                            className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center hover:border-[#115e46] hover:bg-emerald-50/20 text-slate-600 hover:text-[#115e46] cursor-pointer"
                            title="Chỉnh sửa"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onDeleteJob(j.id)}
                            className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center hover:border-rose-200 hover:bg-rose-50 text-slate-600 hover:text-rose-600 cursor-pointer"
                            title="Xóa kế hoạch"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    Không tìm thấy công việc (job) bảo trì nào được lên kế hoạch.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Maintenance Job Planner Dialog */}
      {jobModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-zoom">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 text-base">
                {editingJob ? "Sửa đổi lịch trình Job bảo trì" : "Thiết lập Job bảo trì định kỳ mới"}
              </h3>
              <button
                onClick={() => setJobModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-200/60 flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmitJob}>
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600 uppercase">
                    Chọn máy xưởng áp dụng
                  </label>
                  <select
                    value={jMachineId}
                    onChange={(e) => setJMachineId(e.target.value)}
                    required
                    className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm outline-none"
                  >
                    {machines.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600 uppercase">
                    Tên đầu mục công việc (Job Name)
                  </label>
                  <input
                    type="text"
                    required
                    value={jName}
                    onChange={(e) => setJName(e.target.value)}
                    placeholder="Ví dụ: Tra mỡ bạc đạn trục vít, vệ sinh lưới lọc nước..."
                    className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-600 uppercase">
                      Chu kỳ bảo dưỡng lặp lại
                    </label>
                    <select
                      value={jPeriod}
                      onChange={(e) => setJPeriod(Number(e.target.value))}
                      className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm outline-none"
                    >
                      <option value="1">Hằng Tháng (1 Tháng)</option>
                      <option value="2">Mỗi 2 Tháng</option>
                      <option value="3">Hằng Quý (3 Tháng)</option>
                      <option value="6">Mỗi Bán Niên (6 Tháng)</option>
                      <option value="12">Hằng Năm (12 Tháng)</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-600 uppercase">
                      Ngày thực hiện kỳ kế tiếp
                    </label>
                    <input
                      type="date"
                      required
                      value={jNextDate}
                      onChange={(e) => setJNextDate(e.target.value)}
                      className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600 uppercase">
                    Hướng dẫn quy trình kỹ thuật các bước
                  </label>
                  <textarea
                    value={jDesc}
                    onChange={(e) => setJDesc(e.target.value)}
                    placeholder="- Bước 1: Ngắt điện tổng tủ điều khiển xưởng...&#10;- Bước 2: Dùng tuốc-nơ-vít mở nắp hộp bảo vệ..."
                    className="w-full min-h-[120px] p-3 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm outline-none resize-y"
                  />
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setJobModalOpen(false)}
                  className="bg-white hover:bg-slate-50 text-slate-700 font-semibold px-4 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="bg-[#115e46] hover:bg-[#093f2f] text-white font-bold px-5 py-2 rounded-lg text-sm"
                >
                  Lưu kế hoạch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
