import React, { useState } from "react";
import { Machine } from "../types";
import { Search, Plus, Edit2, Trash2, Calendar, Phone, Home } from "lucide-react";

interface MachinesProps {
  machines: Machine[];
  onAddMachine: (machine: Omit<Machine, "id"> & { id?: string }) => void;
  onDeleteMachine: (id: string) => void;
  onShowFullText: (title: string, body: string) => void;
}

export default function Machines({
  machines,
  onAddMachine,
  onDeleteMachine,
  onShowFullText
}: MachinesProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [machineModalOpen, setMachineModalOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);

  // Form states
  const [mName, setMName] = useState("");
  const [mSetupDate, setMSetupDate] = useState("");
  const [mWarranty, setMWarranty] = useState("");
  const [mVendor, setMVendor] = useState("");
  const [mPhone, setMPhone] = useState("");

  const filteredMachines = machines.filter((m) => {
    return (
      !searchTerm ||
      [m.name, m.vendor].join(" ").toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleOpenMachineModal = (machine: Machine | null = null) => {
    setEditingMachine(machine);
    if (machine) {
      setMName(machine.name);
      setMSetupDate(machine.setupDate);
      setMWarranty(machine.warranty);
      setMVendor(machine.vendor);
      setMPhone(machine.phone);
    } else {
      setMName("");
      setMSetupDate(new Date().toISOString().slice(0, 10));
      setMWarranty(new Date().toISOString().slice(0, 10));
      setMVendor("");
      setMPhone("");
    }
    setMachineModalOpen(true);
  };

  const handleSubmitMachine = (e: React.FormEvent) => {
    e.preventDefault();
    onAddMachine({
      id: editingMachine?.id,
      name: mName,
      setupDate: mSetupDate,
      warranty: mWarranty,
      vendor: mVendor,
      phone: mPhone
    });
    setMachineModalOpen(false);
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
      {/* Search and Action Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
            <input
              type="search"
              placeholder="Tìm nhanh tên máy móc thiết bị, nhà cung cấp..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full min-h-[42px] pl-11 pr-4 rounded-xl border border-slate-200 bg-white text-slate-900 outline-none text-sm focus:border-[#115e46]"
            />
          </div>
          <button
            onClick={() => handleOpenMachineModal()}
            className="bg-[#115e46] hover:bg-[#093f2f] text-white font-bold rounded-xl px-5 text-sm transition-all min-h-[42px] flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            <Plus className="h-4 w-4" />
            <span>Thêm máy mới</span>
          </button>
        </div>
      </div>

      {/* Modern Horizontal Scroll Table for Machines */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-[#0f241d] text-base">
              Danh sách quản lý máy móc thiết bị xưởng
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Theo dõi lắp đặt, hạn bảo hành nhà cung cấp
            </p>
          </div>
          <span className="text-xs text-slate-500 font-bold">
            Tổng {filteredMachines.length} máy
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="p-4 min-w-[250px]">Tên máy thiết bị</th>
                <th className="p-4 min-w-[130px]">Ngày lắp đặt</th>
                <th className="p-4 min-w-[130px]">Hạn bảo hành</th>
                <th className="p-4 min-w-[200px]">Công ty cung cấp</th>
                <th className="p-4 min-w-[150px]">Số điện thoại liên hệ</th>
                <th className="p-4 min-w-[110px] text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMachines.length > 0 ? (
                filteredMachines.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-4 font-bold text-[#115e46]">
                      <button
                        onClick={() => onShowFullText("Tên máy móc", m.name)}
                        className="text-left font-extrabold hover:underline block"
                      >
                        ⚙️ {m.name}
                      </button>
                    </td>

                    <td className="p-4 font-semibold text-slate-800 font-mono">
                      {formatDateDisplay(m.setupDate)}
                    </td>

                    <td className="p-4 font-semibold text-slate-800 font-mono">
                      {formatDateDisplay(m.warranty)}
                    </td>

                    <td className="p-4">
                      <button
                        onClick={() => onShowFullText("Công ty cung cấp", m.vendor)}
                        className="text-left text-slate-500 font-semibold block truncate max-w-[180px] hover:text-[#115e46]"
                      >
                        {m.vendor}
                      </button>
                    </td>

                    <td className="p-4">
                      {m.phone ? (
                        <a
                          href={`tel:${m.phone}`}
                          className="font-bold text-slate-700 hover:text-[#115e46] flex items-center gap-1.5"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          {m.phone}
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenMachineModal(m)}
                          className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center hover:border-[#115e46] hover:bg-emerald-50/20 text-slate-600 hover:text-[#115e46] cursor-pointer"
                          title="Sửa thông tin"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onDeleteMachine(m.id)}
                          className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center hover:border-rose-200 hover:bg-rose-50 text-slate-600 hover:text-rose-600 cursor-pointer"
                          title="Xóa hồ sơ máy"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    Không tìm thấy máy thiết bị cơ điện nào trong cơ sở dữ liệu.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Machine Add/Edit Dialog */}
      {machineModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-zoom">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 text-base">
                {editingMachine ? "Cập nhật hồ sơ thiết bị máy" : "Thêm máy móc thiết bị mới"}
              </h3>
              <button
                onClick={() => setMachineModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-200/60 flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmitMachine}>
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600 uppercase">
                    Tên máy thiết bị chi tiết
                  </label>
                  <input
                    type="text"
                    required
                    value={mName}
                    onChange={(e) => setMName(e.target.value)}
                    placeholder="Ví dụ: Máy Cắt Laser Fiber CO2 CNC"
                    className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-600 uppercase">
                      Ngày bàn giao lắp đặt
                    </label>
                    <input
                      type="date"
                      required
                      value={mSetupDate}
                      onChange={(e) => setMSetupDate(e.target.value)}
                      className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-600 uppercase">
                      Ngày hết hạn bảo hành
                    </label>
                    <input
                      type="date"
                      required
                      value={mWarranty}
                      onChange={(e) => setMWarranty(e.target.value)}
                      className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600 uppercase">
                    Nhà cung cấp / Đối tác thiết bị
                  </label>
                  <input
                    type="text"
                    required
                    value={mVendor}
                    onChange={(e) => setMVendor(e.target.value)}
                    placeholder="Ví dụ: Công ty Cơ Điện Đại Việt"
                    className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600 uppercase">
                    Số điện thoại liên hệ sửa chữa
                  </label>
                  <input
                    type="tel"
                    required
                    value={mPhone}
                    onChange={(e) => setMPhone(e.target.value)}
                    placeholder="Ví dụ: 0912345678"
                    className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm outline-none"
                  />
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMachineModalOpen(false)}
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
    </div>
  );
}
