import React, { useState, useMemo } from "react";
import { Item } from "../types";
import {
  Search,
  Filter,
  Plus,
  Minus,
  Edit2,
  Trash2,
  Upload,
  Layers,
  Sparkles,
  Info
} from "lucide-react";

interface InventoryProps {
  items: Item[];
  onAddItem: (item: Omit<Item, "id"> & { id?: string }) => void;
  onDeleteItem: (id: string) => void;
  onUpdateStock: (id: string, amount: number, type: "in" | "out", note: string) => void;
  onShowFullImage: (src: string) => void;
  onShowFullText: (title: string, body: string) => void;
}

export default function Inventory({
  items,
  onAddItem,
  onDeleteItem,
  onUpdateStock,
  onShowFullImage,
  onShowFullText
}: InventoryProps) {
  const number = new Intl.NumberFormat("vi-VN");

  // Search & Filters State
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Active Dialog state
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [stockItemId, setStockItemId] = useState("");
  const [stockType, setStockType] = useState<"in" | "out">("in");
  const [stockAmount, setStockAmount] = useState(1);
  const [stockNote, setStockNote] = useState("");

  // Item Form states
  const [itemName, setItemName] = useState("");
  const [itemSku, setItemSku] = useState("");
  const [itemCategory, setItemCategory] = useState("");
  const [itemSupplier, setItemSupplier] = useState("");
  const [itemQuantity, setItemQuantity] = useState(0);
  const [itemMin, setItemMin] = useState(1);
  const [itemPrice, setItemPrice] = useState(0);
  const [itemLocation, setItemLocation] = useState("");
  const [itemSpecs, setItemSpecs] = useState("");
  const [itemNote, setItemNote] = useState("");
  const [itemImage, setItemImage] = useState("");

  const categories = useMemo(() => {
    return [...new Set(items.map((i) => i.category))].sort((a, b) =>
      a.localeCompare(b, "vi")
    );
  }, [items]);

  const itemStatus = (item: Item) => {
    if (item.quantity <= 0) return "out";
    if (item.quantity <= item.min) return "low";
    return "ok";
  };

  const filteredItems = useMemo(() => {
    return items
      .filter((i) => {
        const matchesSearch = [
          i.name,
          i.sku,
          i.supplier,
          i.location,
          i.specs,
          i.note
        ]
          .join(" ")
          .toLowerCase()
          .includes(searchTerm.toLowerCase());

        const matchesCategory =
          categoryFilter === "all" || i.category === categoryFilter;

        const matchesStatus =
          statusFilter === "all" || itemStatus(i) === statusFilter;

        return matchesSearch && matchesCategory && matchesStatus;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [items, searchTerm, categoryFilter, statusFilter]);

  const handleOpenItemModal = (item: Item | null = null) => {
    setEditingItem(item);
    if (item) {
      setItemName(item.name);
      setItemSku(item.sku);
      setItemCategory(item.category);
      setItemSupplier(item.supplier);
      setItemQuantity(item.quantity);
      setItemMin(item.min);
      setItemPrice(item.price);
      setItemLocation(item.location);
      setItemSpecs(item.specs);
      setItemNote(item.note);
      setItemImage(item.image);
    } else {
      setItemName("");
      setItemSku("");
      setItemCategory("");
      setItemSupplier("");
      setItemQuantity(0);
      setItemMin(1);
      setItemPrice(0);
      setItemLocation("");
      setItemSpecs("");
      setItemNote("");
      setItemImage("");
    }
    setItemModalOpen(true);
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
          setItemImage(compressed);
        } else {
          setItemImage(evt.target?.result as string);
        }
      };
      img.src = evt.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitItem = (e: React.FormEvent) => {
    e.preventDefault();
    onAddItem({
      id: editingItem?.id,
      name: itemName,
      sku: itemSku.toUpperCase(),
      category: itemCategory,
      supplier: itemSupplier,
      quantity: Number(itemQuantity),
      min: Number(itemMin),
      price: Number(itemPrice),
      location: itemLocation,
      specs: itemSpecs,
      note: itemNote,
      image: itemImage
    });
    setItemModalOpen(false);
  };

  const handleOpenStockModal = (id: string) => {
    setStockItemId(id);
    setStockType("in");
    setStockAmount(1);
    setStockNote("");
    setStockModalOpen(true);
  };

  const handleSubmitStock = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateStock(stockItemId, stockAmount, stockType, stockNote);
    setStockModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Search & Filters block */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
            <input
              type="search"
              placeholder="Tìm tên linh kiện, mã SKU, vị trí kệ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full min-h-[42px] pl-11 pr-4 rounded-xl border border-slate-200 bg-white text-slate-900 outline-none text-sm transition-all focus:border-[#115e46] focus:ring-4 focus:ring-emerald-700/10"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 md:w-[360px]">
            <div className="flex flex-col gap-1">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full min-h-[42px] px-3.5 rounded-xl border border-slate-200 bg-white text-slate-800 outline-none text-sm cursor-pointer transition-all focus:border-[#115e46]"
              >
                <option value="all">Tất cả nhóm</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full min-h-[42px] px-3.5 rounded-xl border border-slate-200 bg-white text-slate-800 outline-none text-sm cursor-pointer transition-all focus:border-[#115e46]"
              >
                <option value="all">Tất cả tồn kho</option>
                <option value="ok">Đủ dùng</option>
                <option value="low">Sắp hết</option>
                <option value="out">Hết linh kiện</option>
              </select>
            </div>
          </div>

          <button
            onClick={() => handleOpenItemModal()}
            className="bg-[#115e46] hover:bg-[#093f2f] text-white font-bold rounded-xl px-5 text-sm transition-all min-h-[42px] flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            <Plus className="h-4 w-4" />
            <span>Thêm linh kiện</span>
          </button>
        </div>
      </div>

      {/* Modern Horizontal Scroll Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h3 className="font-bold text-[#0f241d] text-base">
            Danh sách linh kiện trong kho
          </h3>
          <span className="text-xs text-slate-500 font-bold">
            Hiển thị {filteredItems.length} linh kiện
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="p-4 min-w-[240px]">Tên linh kiện & SKU</th>
                <th className="p-4 min-w-[140px]">Nhóm</th>
                <th className="p-4 min-w-[240px]">Thông số kỹ thuật</th>
                <th className="p-4 min-w-[100px] text-center">Số lượng</th>
                <th className="p-4 min-w-[100px] text-center">Cảnh báo</th>
                <th className="p-4 min-w-[130px]">Vị trí kệ</th>
                <th className="p-4 min-w-[160px]">Máy áp dụng</th>
                <th className="p-4 min-w-[100px] text-center">Hình ảnh</th>
                <th className="p-4 min-w-[200px]">Ghi chú</th>
                <th className="p-4 min-w-[130px] text-center">Trạng thái</th>
                <th className="p-4 min-w-[150px] text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => {
                  const status = itemStatus(item);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-4">
                        <button
                          onClick={() => onShowFullText("Tên linh kiện", item.name)}
                          className="font-bold text-slate-900 block text-left hover:text-[#115e46]"
                        >
                          {item.name}
                        </button>
                        <span className="inline-block mt-1 bg-emerald-50 text-[#115e46] text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-emerald-100">
                          {item.sku}
                        </span>
                      </td>

                      <td className="p-4 text-slate-600 font-semibold">
                        {item.category}
                      </td>

                      <td className="p-4">
                        <button
                          onClick={() => onShowFullText("Thông số kỹ thuật", item.specs)}
                          className="text-xs text-slate-500 max-w-[220px] truncate block text-left hover:text-[#115e46]"
                        >
                          {item.specs || "—"}
                        </button>
                      </td>

                      <td className="p-4 text-center font-bold text-base text-slate-900 font-display">
                        {number.format(item.quantity)}
                      </td>

                      <td className="p-4 text-center text-slate-500 font-medium">
                        {number.format(item.min)}
                      </td>

                      <td className="p-4 font-semibold text-emerald-800">
                        {item.location || "—"}
                      </td>

                      <td className="p-4">
                        <button
                          onClick={() => onShowFullText("Thiết bị dùng cho", item.supplier)}
                          className="text-xs text-slate-500 max-w-[140px] truncate block text-left hover:text-[#115e46]"
                        >
                          {item.supplier || "—"}
                        </button>
                      </td>

                      <td className="p-4 text-center">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            onClick={() => onShowFullImage(item.image)}
                            className="w-10 h-10 object-cover rounded-lg border border-slate-200 shadow-sm mx-auto cursor-zoom-in transition-transform hover:scale-105"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-slate-50 border border-dashed border-slate-200 rounded-lg flex items-center justify-center mx-auto text-[10px] text-slate-400 font-medium">
                            No PIC
                          </div>
                        )}
                      </td>

                      <td className="p-4">
                        <button
                          onClick={() => onShowFullText("Ghi chú", item.note)}
                          className="text-xs text-slate-500 max-w-[180px] truncate block text-left hover:text-[#115e46]"
                        >
                          {item.note || "—"}
                        </button>
                      </td>

                      <td className="p-4 text-center">
                        {status === "out" && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-600 border border-rose-100">
                            Hết linh kiện
                          </span>
                        )}
                        {status === "low" && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100">
                            Sắp hết
                          </span>
                        )}
                        {status === "ok" && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                            Đủ dùng
                          </span>
                        )}
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenStockModal(item.id)}
                            className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50 text-slate-600 cursor-pointer"
                            title="Nhập / Xuất nhanh"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleOpenItemModal(item)}
                            className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center hover:border-[#115e46] hover:bg-emerald-50/20 text-slate-600 hover:text-[#115e46] cursor-pointer"
                            title="Sửa thông tin"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onDeleteItem(item.id)}
                            className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center hover:border-rose-200 hover:bg-rose-50 text-slate-600 hover:text-rose-600 cursor-pointer"
                            title="Xóa"
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
                  <td colSpan={11} className="p-8 text-center text-slate-400">
                    Không tìm thấy linh kiện nào phù hợp với bộ lọc tìm kiếm.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Spare Part Add/Edit Dialog */}
      {itemModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-zoom">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 text-lg">
                {editingItem ? "Sửa thông tin linh kiện" : "Thêm linh kiện mới"}
              </h3>
              <button
                onClick={() => setItemModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-200/60 flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmitItem}>
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[65vh] overflow-y-auto">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600 uppercase">
                    Tên linh kiện
                  </label>
                  <input
                    type="text"
                    required
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="Ví dụ: Cảm biến quang"
                    className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm outline-none focus:border-[#115e46]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600 uppercase">
                    Mã SKU linh kiện
                  </label>
                  <input
                    type="text"
                    required
                    value={itemSku}
                    onChange={(e) => setItemSku(e.target.value)}
                    placeholder="Ví dụ: CB-QG-001"
                    className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm outline-none focus:border-[#115e46]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600 uppercase">
                    Nhóm linh kiện
                  </label>
                  <input
                    type="text"
                    required
                    value={itemCategory}
                    onChange={(e) => setItemCategory(e.target.value)}
                    placeholder="Ví dụ: Thiết bị cảm biến"
                    className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm outline-none focus:border-[#115e46]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600 uppercase">
                    Thiết bị sử dụng
                  </label>
                  <input
                    type="text"
                    required
                    value={itemSupplier}
                    onChange={(e) => setItemSupplier(e.target.value)}
                    placeholder="Ví dụ: Máy CNC Fanuc, Máy nén khí"
                    className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm outline-none focus:border-[#115e46]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600 uppercase">
                    Số lượng tồn ban đầu
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={itemQuantity}
                    onChange={(e) => setItemQuantity(Number(e.target.value))}
                    className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm outline-none focus:border-[#115e46]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600 uppercase">
                    Ngưỡng tối thiểu cảnh báo
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={itemMin}
                    onChange={(e) => setItemMin(Number(e.target.value))}
                    className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm outline-none focus:border-[#115e46]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600 uppercase">
                    Giá tham khảo (VNĐ)
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={itemPrice}
                    onChange={(e) => setItemPrice(Number(e.target.value))}
                    className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm outline-none focus:border-[#115e46]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600 uppercase">
                    Vị trí kệ chứa
                  </label>
                  <input
                    type="text"
                    value={itemLocation}
                    onChange={(e) => setItemLocation(e.target.value)}
                    placeholder="Ví dụ: Kệ A - Ngăn 3"
                    className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm outline-none focus:border-[#115e46]"
                  />
                </div>

                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-600 uppercase">
                    Thông số kỹ thuật chi tiết
                  </label>
                  <textarea
                    value={itemSpecs}
                    onChange={(e) => setItemSpecs(e.target.value)}
                    placeholder="Nhập điện áp, công suất, kích thước, độ dài..."
                    className="w-full min-h-[80px] p-3 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm outline-none resize-y focus:border-[#115e46]"
                  />
                </div>

                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-600 uppercase">
                    Ghi chú thêm
                  </label>
                  <textarea
                    value={itemNote}
                    onChange={(e) => setItemNote(e.target.value)}
                    placeholder="Các thông tin lưu ý khác khi sử dụng..."
                    className="w-full min-h-[80px] p-3 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm outline-none resize-y focus:border-[#115e46]"
                  />
                </div>

                <div className="flex flex-col gap-1 sm:col-span-2 border-t border-slate-100 pt-3">
                  <label className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5">
                    <Upload className="h-4 w-4" />
                    Tải lên hình ảnh sản phẩm
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                  />
                  {itemImage && (
                    <div className="mt-2 flex justify-center">
                      <img
                        src={itemImage}
                        alt="Preview"
                        className="max-w-[160px] max-h-[160px] object-contain rounded-lg border border-slate-200"
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setItemModalOpen(false)}
                  className="bg-white hover:bg-slate-50 text-slate-700 font-semibold px-4 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="bg-[#115e46] hover:bg-[#093f2f] text-white font-bold px-5 py-2 rounded-lg text-sm"
                >
                  Lưu lại
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Transaction Dialog */}
      {stockModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 text-base">
                Cập nhật số lượng kho nhanh
              </h3>
              <button
                onClick={() => setStockModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-200/60 flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmitStock}>
              <div className="p-6 space-y-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600 uppercase">
                    Loại giao dịch
                  </label>
                  <select
                    value={stockType}
                    onChange={(e) => setStockType(e.target.value as "in" | "out")}
                    className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm outline-none"
                  >
                    <option value="in">Nhập kho (Tăng số lượng)</option>
                    <option value="out">Xuất kho sử dụng (Giảm số lượng)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600 uppercase">
                    Số lượng thực hiện
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={stockAmount}
                    onChange={(e) => setStockAmount(Number(e.target.value))}
                    className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600 uppercase">
                    Lý do giao dịch / Ghi chú
                  </label>
                  <input
                    type="text"
                    required
                    value={stockNote}
                    onChange={(e) => setStockNote(e.target.value)}
                    placeholder="Ví dụ: Thay rơle hỏng máy CNC trục X, Nhập định kỳ..."
                    className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 bg-white text-slate-900 text-sm outline-none"
                  />
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setStockModalOpen(false)}
                  className="bg-white hover:bg-slate-50 text-slate-700 font-semibold px-4 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  Quay lại
                </button>
                <button
                  type="submit"
                  className="bg-[#115e46] hover:bg-[#093f2f] text-white font-bold px-5 py-2 rounded-lg text-sm"
                >
                  Xác nhận
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
