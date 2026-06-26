import React, { useState, useMemo } from "react";
import { RepairHistory } from "../types";
import { Search, Plus, Edit2, Trash2, Calendar, Upload, ZoomIn, Eye } from "lucide-react";

interface RepairHistoryViewProps {
  repairHistory: RepairHistory[];
  onAddHistory: (history: Omit<RepairHistory, "id"> & { id?: string }) => void;
  onDeleteHistory: (id: string) => void;
  onShowFullImage: (src: string) => void;
  onShowFullText: (title: string, body: string) => void;
}

export default function RepairHistoryView({
  repairHistory,
  onAddHistory,
  onDeleteHistory,
  onShowFullImage,
  onShowFullText
}: RepairHistoryViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [editingHistory, setEditingHistory] = useState<RepairHistory | null>(null);

  // Form states
  const [hMachine, setHMachine] = useState("");
  const [hFaultTime, setHFaultTime] = useState("");
  const [hStaff, setHStaff] = useState("");
  const [hFault, setHFault] = useState("");
  const [hFix, setHFix] = useState("");
  const [hImage, setHImage] = useState("");

  const filteredHistory = useMemo(() => {
    return repairHistory
      .filter((h) => {
        const matchesSearch = [h.machine, h.staff, h.fault, h.fix]
          .join(" ")
          .toLowerCase()
          .includes(searchTerm.toLowerCase());

        const d = new Date(h.faultTime);
        const matchesFrom = !fromDate || d >= new Date(fromDate);
        const matchesTo = !toDate || d <= new Date(toDate);

        return matchesSearch && matchesFrom && matchesTo;
      })
      .sort((a, b) => new Date(b.faultTime).getTime() - new Date(a.faultTime).getTime());
  }, [repairHistory, searchTerm, fromDate, toDate]);

  const handleOpenHistoryModal = (h: RepairHistory | null = null) => {
    setEditingHistory(h);
    if (h) {
      setHMachine(h.machine);
      setHFaultTime(h.faultTime);
      setHStaff(h.staff);
      setHFault(h.fault);
      setHFix(h.fix);
      setHImage(h.image);
    } else {
      setHMachine("");
      setHFaultTime(new Date().toISOString().slice(0, 10));
      setHStaff("");
      setHFault("");
      setHFix("");
      setHImage("");
    }
    setHistoryModalOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 400;
        let width = img.width;
        let height = img.height;
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL("image/jpeg", 0.7);
          setHImage(compressed);
        } else {
          setHImage(evt.target?.result as string);
        }
      };
      img.src = evt.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitHistory = (e: React.FormEvent) => {
    e.preventDefault();
    onAddHistory({
      id: editingHistory?.id,
      machine: hMachine,
      faultTime: hFaultTime,
      staff: hStaff,
      fault: hFault,
      fix: hFix,
      image: hImage
    });
    setHistoryModalOpen(false);
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
      {/* Search filters toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-stretch justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
            <input
              type="search"
              placeholder="Tìm nhanh nhật ký sự cố, tên kỹ sư, linh kiện, lỗi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full min-h-[42px] pl-11 pr-4 rounded-xl border border-slate-200 bg-white text-slate-900 outline-none text-sm focus:border-[#115e46]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 md:w-[320px]">
            <div className="flex flex-col gap-1">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                title="Từ ngày xảy ra"
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                title="Đến ngày xảy ra"
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs outline-none"
              />
            </div>
          </div>

          <button
            onClick={() => handleOpenHistoryModal()}
            className="bg-[#115e46] hover:bg-[#093f2f] text-white font-bold rounded-xl px-5 text-sm transition-all min-h-[42px] flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            <Plus className="h-4 w-4" />
            <span>Thêm nhật ký mới</span>
          </button>
        </div>
      </div>

      {/* Modern Horizontal Scroll Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-[#0f241d] text-base">
              Nhật ký xử lý sự cố sửa chữa máy đột xuất
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Lưu giữ biên bản và hình ảnh hiện trạng sau bảo trì
            </p>
          </div>
          <span className="text-xs text-slate-500 font-bold">
            Hiển thị {filteredHistory.length} nhật ký
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="p-4 min-w-[120px]">Ngày xảy ra</th>
                <th className="p-4 min-w-[220px]">Thiết bị máy lỗi</th>
                <th className="p-4 min-w-[180px]">Kỹ sư xử lý</th>
                <th className="p-4 min-w-[260px]">Biểu hiện lỗi sự cố</th>
                <th className="p-4 min-w-[280px]">Phương án khắc phục thực tế</th>
                <th className="p-4 min-w-[100px] text-center">Hình ảnh</th>
                <th className="p-4 min-w-[100px] text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredHistory.length > 0 ? (
                filteredHistory.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-4 font-semibold text-slate-900 font-mono">
                      {formatDateDisplay(h.faultTime)}
                    </td>

                    <td className="p-4 font-bold text-slate-900">
                      {h.machine}
                    </td>

                    <td className="p-4 font-bold text-[#115e46]">
                      👷 {h.staff}
                    </td>

                    <td className="p-4">
                      <button
                        onClick={() => onShowFullText("Biểu hiện lỗi sự cố", h.fault)}
                        className="text-xs text-slate-500 max-w-[240px] truncate block text-left hover:text-[#115e46]"
                      >
                        {h.fault}
                      </button>
                    </td>

                    <td className="p-4">
                      <button
                        onClick={() => onShowFullText("Phương án khắc phục", h.fix)}
                        className="text-xs text-slate-500 max-w-[260px] truncate block text-left hover:text-[#115e46]"
                      >
                        {h.fix}
                      </button>
                    </td>

                    <td className="p-4 text-center">
                      {h.image ? (
                        <img
                          src={h.image}
                          alt="Sửa chữa máy"
                          onClick={() => onShowFullImage(h.image)}
                          className="w-10 h-10 object-cover rounded-lg border border-slate-200 shadow-sm mx-auto cursor-zoom-in transition-transform hover:scale-105"
                        />
                      ) : (
                        <span className="text-xs text-slate-400 font-semibold">—</span>
                      )}
                    </td>

                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenHistoryModal(h)}
                          className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center hover:border-[#115e46] hover:bg-emerald-50/20 text-slate-600 hover:text-[#115e46] cursor-pointer"
                          title="Sửa nhật ký"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onDeleteHistory(h.id)}
                          className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center hover:border-rose-200 hover:bg-rose-50 text-slate-600 hover:text-rose-600 cursor-pointer"
                          title="Xóa biên bản này"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    Không tìm thấy nhật ký sự cố sửa chữa nào phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Repair History Add/Edit Dialog */}
      {historyModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-zoom">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 text-base">
                {editingHistory ? "Cập nhật nhật ký biên bản sự cố" : "Ghi nhận sự cố sửa chữa mới"}
              </h3>
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-200/60 flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmitHistory}>
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-600 uppercase">
                      Thiết bị máy xảy ra sự cố
                    </label>
                    <input
                      type="text"
                      required
                      value={hMachine}
                      onChange={(e) => setHMachine(e.target.value)}
                      placeholder="Ví dụ: Máy ép nhựa trục dọc số 02"
                      className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-600 uppercase">
                      Ngày phát hiện và xử lý
                    </label>
                    <input
                      type="date"
                      required
                      value={hFaultTime}
                      onChange={(e) => setHFaultTime(e.target.value)}
                      className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600 uppercase">
                    Kỹ sư/Nhân viên trực tiếp chịu trách nhiệm sửa
                  </label>
                  <input
                    type="text"
                    required
                    value={hStaff}
                    onChange={(e) => setHStaff(e.target.value)}
                    placeholder="Ví dụ: Nguyễn Văn Bảo Trì"
                    className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600 uppercase">
                    Mô tả chi tiết biểu hiện lỗi sự cố
                  </label>
                  <textarea
                    required
                    value={hFault}
                    onChange={(e) => setHFault(e.target.value)}
                    placeholder="Ví dụ: Động cơ kêu rít to, chảy dầu nắp hộp số, màn hình hiển thị báo lỗi E04..."
                    className="w-full min-h-[90px] p-3 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm outline-none resize-y"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600 uppercase">
                    Phương án kỹ thuật xử lý khắc phục thực tế
                  </label>
                  <textarea
                    required
                    value={hFix}
                    onChange={(e) => setHFix(e.target.value)}
                    placeholder="Ví dụ: Đã tháo động cơ, thay ổ bi mới mã 6204, bổ sung dầu hộp số..."
                    className="w-full min-h-[90px] p-3 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm outline-none resize-y"
                  />
                </div>

                <div className="flex flex-col gap-1 border-t border-slate-100 pt-3">
                  <label className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5">
                    <Upload className="h-4 w-4" />
                    Hình ảnh hiện trạng sửa chữa
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                  />
                  {hImage && (
                    <div className="mt-2 flex justify-center">
                      <img
                        src={hImage}
                        alt="Preview"
                        className="max-w-[160px] max-h-[160px] object-contain rounded-lg border border-slate-200"
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setHistoryModalOpen(false)}
                  className="bg-white hover:bg-slate-50 text-slate-700 font-semibold px-4 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="bg-[#115e46] hover:bg-[#093f2f] text-white font-bold px-5 py-2 rounded-lg text-sm"
                >
                  Lưu nhật ký
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
