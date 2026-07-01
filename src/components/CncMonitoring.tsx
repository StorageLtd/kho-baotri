import React, { useState } from "react";
import { Cnc, CncAlarm, Item } from "../types";
import {
  Search,
  Plus,
  Cpu,
  Trash2,
  Maximize2,
  TrendingUp,
  AlertTriangle,
  Heart,
  ExternalLink,
  Wrench,
  CheckCircle2
} from "lucide-react";

interface CncMonitoringProps {
  cncs: Cnc[];
  cncAlarms: CncAlarm[];
  items: Item[];
  onAddCnc: (cnc: Omit<Cnc, "id"> & { id?: string }) => void;
  onDeleteCnc: (id: string) => void;
  onClearAlarm: (cncId: string) => void;
  onAutoCreateHistory: (cncName: string, alarmText: string) => void;
  onShowFullText: (title: string, body: string) => void;
}

export default function CncMonitoring({
  cncs,
  cncAlarms,
  items,
  onAddCnc,
  onDeleteCnc,
  onClearAlarm,
  onAutoCreateHistory,
  onShowFullText
}: CncMonitoringProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [cncModalOpen, setCncModalOpen] = useState(false);
  const [editingCnc, setEditingCnc] = useState<Cnc | null>(null);

  // Individual machine history dialog state
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyCncId, setHistoryCncId] = useState("");

  // CNC Form States
  const [cncName, setCncName] = useState("");
  const [cncIp, setCncIp] = useState("");
  const [cncPort, setCncPort] = useState(8193);
  const [cncModel, setCncModel] = useState("Fanuc 0i-F");
  const [cncLocation, setCncLocation] = useState("");

  const filteredCncs = cncs.filter((c) => {
    return (
      !searchTerm ||
      [c.name, c.ip, c.model, c.location]
        .join(" ")
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
    );
  });

  const handleOpenCncModal = (cnc: Cnc | null = null) => {
    setEditingCnc(cnc);
    if (cnc) {
      setCncName(cnc.name);
      setCncIp(cnc.ip);
      setCncPort(cnc.port);
      setCncModel(cnc.model);
      setCncLocation(cnc.location);
    } else {
      setCncName("");
      setCncIp("");
      setCncPort(8193);
      setCncModel("Fanuc 0i-F");
      setCncLocation("");
    }
    setCncModalOpen(true);
  };

  const handleSubmitCnc = (e: React.FormEvent) => {
    e.preventDefault();
    onAddCnc({
      id: editingCnc?.id,
      name: cncName,
      ip: cncIp,
      port: Number(cncPort),
      model: cncModel,
      location: cncLocation,
      status: editingCnc?.status || "running",
      activeProgram: editingCnc?.activeProgram || "O1000 (DEMO_PROGRAM)",
      currentBlock: editingCnc?.currentBlock || "N10 G00 G90 G21",
      spindleSpeed: editingCnc?.spindleSpeed || 1200,
      targetSpindleSpeed: editingCnc?.targetSpindleSpeed || 1200,
      feedrate: editingCnc?.feedrate || 100,
      targetFeedrate: editingCnc?.targetFeedrate || 100,
      override: editingCnc?.override || 100,
      alarm: editingCnc?.alarm || ""
    });
    setCncModalOpen(false);
  };

  // Check matching inventory parts for a given alarm
  const getMatchedPartMarkup = (alarmText: string) => {
    let keyword = "";
    let categoryNeeded = "";

    const text = String(alarmText || "").toUpperCase();
    if (text.includes("SV") || text.includes("SERVO")) {
      keyword = "Servo";
      categoryNeeded = "Driver hoặc Động cơ Servo";
    } else if (text.includes("SP") || text.includes("SPINDLE") || text.includes("TRỤC CHÍNH")) {
      keyword = "Spindle";
      categoryNeeded = "Inverter hoặc Motor Trục chính";
    } else if (text.includes("OT") || text.includes("LIMIT") || text.includes("HÀNH TRÌNH")) {
      keyword = "Cảm biến";
      categoryNeeded = "Công tắc hành trình / Cảm biến";
    } else {
      keyword = "Nguồn";
      categoryNeeded = "Rơ le hoặc Nguồn tủ điện";
    }

    const matchedPart = items.find(
      (i) =>
        i.name.toLowerCase().includes(keyword.toLowerCase()) ||
        i.category.toLowerCase().includes(keyword.toLowerCase())
    );

    if (matchedPart) {
      const isAvailable = matchedPart.quantity > 0;
      return (
        <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3.5 text-xs text-slate-700 flex flex-col gap-1.5">
          <span className="font-bold text-slate-800 flex items-center gap-1">
            <Wrench className="h-4 w-4 text-[#115e46]" />
            Linh kiện đối chiếu kho LTD:
          </span>
          <div>
            Tên: <strong className="text-slate-900">{matchedPart.name}</strong> (
            <span className="font-mono text-[10px] font-bold bg-slate-100 px-1 py-0.5 rounded border border-slate-200">{matchedPart.sku}</span>)
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            Trạng thái tồn:
            {isAvailable ? (
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded font-extrabold font-display">
                Còn hàng ({matchedPart.quantity} cái) - Kệ {matchedPart.location || "Chưa xếp"}
              </span>
            ) : (
              <span className="bg-rose-50 text-rose-600 border border-rose-100 px-2 py-0.5 rounded font-extrabold font-display">
                HẾT HÀNG - Yêu cầu mua gấp
              </span>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3.5 text-xs text-slate-700 flex flex-col gap-1.5">
        <span className="font-bold text-slate-800 flex items-center gap-1">
          <Wrench className="h-4 w-4 text-amber-600" />
          Đề xuất linh kiện sửa chữa:
        </span>
        <div className="text-slate-500 font-medium">
          Chưa có linh kiện trùng chuẩn chính xác trong kho LTD.
        </div>
        <div>
          Yêu cầu nhập vật tư:{" "}
          <span className="bg-rose-50 text-rose-600 border border-rose-100 px-2 py-0.5 rounded font-bold">
            {categoryNeeded}
          </span>
        </div>
      </div>
    );
  };

  const getAlarmKeyword = (code: string) => {
    const text = String(code || "").toUpperCase();
    if (text.includes("SV")) return "Servo";
    if (text.includes("SP")) return "Spindle";
    if (text.includes("OT")) return "Cảm biến";
    return "Nguồn";
  };

  const activeCncHistory = cncAlarms
    .filter((a) => a.cncId === historyCncId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const currentHistoryCnc = cncs.find((c) => c.id === historyCncId);

  return (
    <div className="space-y-8 animate-rise">
      {/* Search and Telemetry Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
            <input
              type="search"
              placeholder="Tìm theo tên máy CNC, IP kết nối mạng..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full min-h-[42px] pl-11 pr-4 rounded-xl border border-slate-200 bg-white text-slate-900 outline-none text-sm focus:border-[#115e46]"
            />
          </div>
          <button
            onClick={() => handleOpenCncModal()}
            className="bg-[#115e46] hover:bg-[#093f2f] text-white font-bold rounded-xl px-5 text-sm transition-all min-h-[42px] flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            <Plus className="h-4 w-4" />
            <span>Thêm máy CNC mới</span>
          </button>
        </div>
      </div>

      {/* Realtime Grid of CNC Telemetry Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredCncs.length > 0 ? (
          filteredCncs.map((c) => {
            let statusText = "MẤT KẾT NỐI";
            let badgeClass = "bg-slate-50 text-slate-500 border-slate-200";

            if (c.status === "running") {
              statusText = "ĐANG CHẠY (RUN)";
              badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-100 animate-pulse";
            } else if (c.status === "hold") {
              statusText = "TẠM DỪNG (HOLD)";
              badgeClass = "bg-amber-50 text-amber-700 border-amber-100";
            } else if (c.status === "alarm") {
              statusText = "🚨 BÁO LỖI (ALARM)";
              badgeClass = "bg-rose-50 text-rose-600 border-rose-100 font-extrabold";
            }

            return (
              <div
                key={c.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col gap-4 relative"
              >
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <Cpu className="h-4.5 w-4.5 text-[#115e46]" />
                    {c.name}
                  </span>
                  <span
                    className={`text-[10px] font-extrabold tracking-wider px-2 py-0.5 rounded border ${badgeClass}`}
                  >
                    {statusText}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-2 gap-y-3 text-xs">
                  <div>
                    <span className="text-slate-400 block">Địa chỉ IP mạng</span>
                    <strong className="text-slate-800 font-semibold">{c.ip}:{c.port}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Hệ điều khiển</span>
                    <strong className="text-slate-800 font-semibold">{c.model}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Chương trình</span>
                    <strong className="text-amber-800 font-bold font-mono">
                      {c.activeProgram || "None"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Dòng lệnh</span>
                    <strong className="text-slate-700 font-mono truncate block max-w-[120px]" title={c.currentBlock}>
                      {c.currentBlock || "None"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Tốc độ trục chính</span>
                    <strong className="text-emerald-700 font-bold font-mono">
                      {c.spindleSpeed} / {c.targetSpindleSpeed} RPM
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Tốc độ ăn dao (F)</span>
                    <strong className="text-slate-800 font-mono">
                      {c.feedrate} mm/min ({c.override}%)
                    </strong>
                  </div>
                  <div className="col-span-2 border-t border-slate-50 pt-2.5">
                    <span className="text-slate-400 block">Vị trí lắp đặt xưởng</span>
                    <strong className="text-slate-700 font-semibold">{c.location || "Không rõ"}</strong>
                  </div>
                </div>

                {/* Alarm banner in case machine is down */}
                {c.status === "alarm" && c.alarm && (
                  <div className="space-y-3 mt-1 pt-2 border-t border-rose-50">
                    <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-3">
                      <span className="text-[10px] font-extrabold text-rose-600 block uppercase tracking-wider mb-1">
                        Lỗi phát hiện (realtime)
                      </span>
                      <p className="text-xs font-extrabold text-rose-600 leading-normal">
                        {c.alarm}
                      </p>
                    </div>
                    {getMatchedPartMarkup(c.alarm)}
                  </div>
                )}

                {/* Card footer control buttons */}
                <div className="flex justify-between items-center border-t border-slate-100 pt-3.5 mt-auto">
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => {
                        setHistoryCncId(c.id);
                        setHistoryModalOpen(true);
                      }}
                      className="text-xs bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold px-2.5 py-1.5 rounded-lg cursor-pointer"
                    >
                      Lịch sử lỗi
                    </button>
                    <button
                      onClick={() => handleOpenCncModal(c)}
                      className="text-xs bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold px-2.5 py-1.5 rounded-lg cursor-pointer"
                    >
                      Sửa IP
                    </button>
                  </div>

                  <div className="flex gap-1.5 items-center">
                    {c.status === "alarm" && (
                      <button
                        onClick={() => onClearAlarm(c.id)}
                        className="text-xs bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 text-[#115e46] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Clear
                      </button>
                    )}
                    <button
                      onClick={() => onDeleteCnc(c.id)}
                      className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:border-rose-200 hover:bg-rose-50 flex items-center justify-center text-slate-600 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-12 text-center text-slate-400 font-medium">
            Không tìm thấy máy CNC kết nối nào phù hợp.
          </div>
        )}
      </div>

      {/* CNC Alarms Logs Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h3 className="font-bold text-[#0f241d] text-base">
            Nhật ký sự cố máy CNC và Tồn kho giải pháp
          </h3>
          <span className="text-xs text-rose-500 font-bold">
            {cncAlarms.length} sự cố ghi nhận
          </span>
        </div>

        {/* Scrollable Alarms logs list table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="p-4 min-w-[160px]">Thời gian phát hiện</th>
                <th className="p-4 min-w-[200px]">Tên máy CNC</th>
                <th className="p-4 min-w-[110px]">Mã Alarm</th>
                <th className="p-4 min-w-[250px]">Mô tả chi tiết lỗi</th>
                <th className="p-4 min-w-[140px]">Nhóm linh kiện</th>
                <th className="p-4 min-w-[220px]">Trạng thái tồn kho LTD</th>
                <th className="p-4 min-w-[130px] text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cncAlarms.length > 0 ? (
                cncAlarms
                  .sort(
                    (a, b) =>
                      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                  )
                  .map((alarm) => {
                    const keyword = getAlarmKeyword(alarm.alarmCode);
                    const matched = items.find((i) =>
                      i.name.toLowerCase().includes(keyword.toLowerCase())
                    );

                    return (
                      <tr key={alarm.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4">
                          <strong className="text-slate-900 block font-display">
                            {new Date(alarm.timestamp).toLocaleDateString("vi-VN")}
                          </strong>
                          <span className="text-[10px] text-slate-400 block mt-0.5 font-semibold">
                            {new Date(alarm.timestamp).toLocaleTimeString("vi-VN")}
                          </span>
                        </td>

                        <td className="p-4 font-bold text-slate-800">
                          {alarm.cncName}
                        </td>

                        <td className="p-4">
                          <span className="inline-block bg-rose-50 text-rose-600 font-mono text-[10px] font-bold border border-rose-100 rounded px-2 py-0.5">
                            {alarm.alarmCode}
                          </span>
                        </td>

                        <td className="p-4">
                          <button
                            onClick={() =>
                              onShowFullText("Mô tả chi tiết lỗi CNC", alarm.description)
                            }
                            className="text-xs text-slate-600 font-semibold max-w-[230px] truncate block text-left hover:text-[#115e46]"
                          >
                            {alarm.description}
                          </button>
                        </td>

                        <td className="p-4 text-slate-600 font-semibold">
                          {keyword}
                        </td>

                        <td className="p-4 text-xs font-semibold">
                          {matched ? (
                            matched.quantity > 0 ? (
                              <div className="text-emerald-700 flex flex-col gap-0.5">
                                <span className="font-bold flex items-center gap-1 text-[11px]">
                                  ● {matched.name}
                                </span>
                                <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 w-max mt-0.5">
                                  Còn {matched.quantity} bộ (Kệ: {matched.location})
                                </span>
                              </div>
                            ) : (
                              <div className="text-rose-600 flex flex-col gap-0.5">
                                <span className="font-bold flex items-center gap-1 text-[11px]">
                                  ● {matched.name}
                                </span>
                                <span className="text-[10px] text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 w-max mt-0.5">
                                  HẾT HÀNG TRONG KHO
                                </span>
                              </div>
                            )
                          ) : (
                            <span className="text-slate-400">Không tìm thấy vật tư</span>
                          )}
                        </td>

                        <td className="p-4 text-right">
                          <button
                            onClick={() =>
                              onAutoCreateHistory(alarm.cncName, alarm.description)
                            }
                            className="text-xs bg-[#115e46] text-white hover:bg-[#093f2f] font-bold px-3 py-1.5 rounded-lg shadow-sm cursor-pointer inline-flex items-center gap-1"
                          >
                            Tạo Nhật ký
                          </button>
                        </td>
                      </tr>
                    );
                  })
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    Chưa ghi nhận sự cố lỗi máy CNC nào từ hệ FOCAS kết nối.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CNC Add/Edit Modal */}
      {cncModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-zoom">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 text-base">
                {editingCnc ? "Chỉnh sửa kết nối máy CNC" : "Thêm kết nối máy CNC mới"}
              </h3>
              <button
                onClick={() => setCncModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-200/60 flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmitCnc}>
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600 uppercase">
                    Tên máy CNC chi tiết
                  </label>
                  <input
                    type="text"
                    required
                    value={cncName}
                    onChange={(e) => setCncName(e.target.value)}
                    placeholder="Ví dụ: Máy Phay CNC Fanuc 03"
                    className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-600 uppercase">
                      Địa chỉ IP kết nối (Ethernet)
                    </label>
                    <input
                      type="text"
                      required
                      value={cncIp}
                      onChange={(e) => setCncIp(e.target.value)}
                      placeholder="Ví dụ: 192.168.1.103"
                      className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-600 uppercase">
                      Cổng FOCAS TCP Port
                    </label>
                    <input
                      type="number"
                      required
                      value={cncPort}
                      onChange={(e) => setCncPort(Number(e.target.value))}
                      className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600 uppercase">
                    Model Bộ điều khiển
                  </label>
                  <select
                    value={cncModel}
                    onChange={(e) => setCncModel(e.target.value)}
                    className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm outline-none cursor-pointer"
                  >
                    <option value="Fanuc 0i-F">Fanuc Series 0i-MODEL F</option>
                    <option value="Fanuc 31i-B">Fanuc Series 31i-MODEL B</option>
                    <option value="Fanuc 0i-D">Fanuc Series 0i-MODEL D</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600 uppercase">
                    Vị trí lắp đặt nhà xưởng
                  </label>
                  <input
                    type="text"
                    value={cncLocation}
                    onChange={(e) => setCncLocation(e.target.value)}
                    placeholder="Ví dụ: Lô B1 - Khu CNC phụ"
                    className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm outline-none"
                  />
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCncModalOpen(false)}
                  className="bg-white hover:bg-slate-50 text-slate-700 font-semibold px-4 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="bg-[#115e46] hover:bg-[#093f2f] text-white font-bold px-5 py-2 rounded-lg text-sm"
                >
                  Lưu thông tin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Machine Breakdown history tracker Modal */}
      {historyModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-zoom">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Lịch sử báo lỗi máy CNC
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Chi tiết thiết bị: {currentHistoryCnc?.name} | IP: {currentHistoryCnc?.ip}
                </p>
              </div>
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-200/60 flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full border-collapse text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="p-3">Thời gian phát hiện</th>
                      <th className="p-3">Mã Alarm</th>
                      <th className="p-3">Mô tả sự cố</th>
                      <th className="p-3 text-right">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeCncHistory.length > 0 ? (
                      activeCncHistory.map((a) => (
                        <tr key={a.id}>
                          <td className="p-3">
                            <strong className="text-slate-900 block font-display">
                              {new Date(a.timestamp).toLocaleDateString("vi-VN")}
                            </strong>
                            <span className="text-[10px] text-slate-400 block font-semibold mt-0.5">
                              {new Date(a.timestamp).toLocaleTimeString("vi-VN")}
                            </span>
                          </td>
                          <td className="p-3 font-mono">
                            <span className="bg-rose-50 text-rose-600 border border-rose-100 px-1.5 py-0.5 rounded font-bold">
                              {a.alarmCode}
                            </span>
                          </td>
                          <td className="p-3 text-slate-600 font-medium">
                            {a.description}
                          </td>
                          <td className="p-3 text-right">
                            {a.resolvedAt ? (
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded font-bold">
                                  Đã sửa
                                </span>
                                <span className="text-[9px] text-slate-400 font-mono">
                                  {new Date(a.resolvedAt).toLocaleDateString("vi-VN")}{" "}
                                  {new Date(a.resolvedAt).toLocaleTimeString("vi-VN")}
                                </span>
                              </div>
                            ) : (
                              <span className="bg-rose-50 text-rose-600 border border-rose-100 px-2 py-0.5 rounded font-bold">
                                Đang lỗi
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-slate-400">
                          Chưa ghi nhận sự cố lỗi nào cho máy CNC này.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setHistoryModalOpen(false)}
                className="bg-white hover:bg-slate-50 text-slate-700 font-semibold px-4 py-2 border border-slate-200 rounded-lg text-sm"
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
