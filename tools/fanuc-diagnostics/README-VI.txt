LTD CNC DIAGNOSTIC & STATUS — BẢN THỬ RIÊNG, CHỈ ĐỌC
Build: 20261109-diagnostics-readonly

CÁCH MỞ
1. Giải nén toàn bộ gói vào một thư mục mới trên laptop Windows 64-bit.
2. Chép 3 DLL đang dùng với cầu nối vào thư mục lib:
   Fwlib64.dll, fwlibe64.dll, fwlib30i64.dll.
   Gói không kèm DLL có bản quyền. Chỉ dùng bộ DLL tin cậy của anh.
3. Nhấp đúp START-DIAGNOSTICS.cmd. Không cần đăng nhập Firebase.
4. Nhập IP/cổng đúng của máy, ví dụ 192.168.1.1:8193.
   Hoặc bấm Nhập cấu hình máy, chọn bridge-config.json của máy đó.
   Chỉ lấy IP/cổng, không sửa file cấu hình và không nhập tài khoản.
5. Bấm Đọc một lần để xem STATUS trước.

DGN
- Chỉ bật Đọc DGN sau khi xác nhận dòng điều khiển.
- Nhập số DGN trên màn hình DGNOS của CNC. Trục 0 = không có trục;
  1 = trục thứ nhất, 2 = thứ hai... theo cấu hình CNC, không tự gán tên XYZ.
- Bản thử tự đọc metadata chính xác số DGN rồi xác định BIT/BYTE/WORD/
  DWORD/REAL, dấu và số chữ số thập phân. Không thay bằng số DGN kế tiếp.
- Hồ sơ metadata được hỗ trợ: FANUC 30i/31i/32i/35i, 0i model D/F
  (gồm 0i-MF Plus), Power Motion i model A. Có kiểm tra mã CNC/model
  trả về; mã model không xác minh được thì không giải mã DGN.
- Chưa hỗ trợ DGN theo spindle, ALL_AXES, Series 15/15i và profile cũ.
  Các trường hợp này hiện lỗi, không đoán giá trị.
- Ý nghĩa DGN cần đối chiếu maintenance manual đúng series; phần mềm
  không tự gán tên lỗi hay nguyên nhân theo một bảng chung.

PMC STATUS
- Bật Đọc PMC, nhập X10.1 hoặc R423.6; cũng có thể nhập X10/R423
  để xem cả byte. Cho phép X/Y/R/G/F, không đọc cả dải địa chỉ.
- Mỗi mẫu đọc đúng 1 byte và hiển thị từng bit 7 xuống 0, ON/OFF.
  Bit sau dấu chấm được đánh dấu • Đã chọn.
- X10.1 / R423.6 là địa chỉ anh đã cung cấp cho máy trước; không tự
  khẳng định chúng có cùng ý nghĩa trên máy CNC khác.
- Chỉ đọc Y/F/G cũng không có chức năng bật/tắt hoặc ép tín hiệu.

THEO DÕI
- Đọc một lần: một lượt STATUS + các mục đã bật.
- Theo dõi: lặp theo chu kỳ 1–60 giây (mặc định 5 giây), tính từ khi
  lượt trước hoàn tất. Chỉ một lượt đọc hoạt động; không chồng yêu cầu.
- Dừng đọc: ngừng lập lịch; lượt đang đọc được hoàn tất và giải phóng
  handle. Đóng cửa sổ cũng chờ lượt đang đọc hoàn tất.
- Giá trị cũ được xóa khi bắt đầu lượt mới. Lỗi không hiển thị thành 0/OFF.
- Đây là lấy mẫu định kỳ. Xung ngắn, ví dụ M30, có thể bị bỏ lỡ;
  không dùng công cụ này để khẳng định số lần bấm hoặc đếm chu kỳ.
- STATUS/DGN/PMC đọc tuần tự, không phải ảnh chụp đồng thời.

PHẠM VI
- Chạy riêng trên laptop; không thay cầu nối, không cập nhật web,
  không gửi Firebase/Internet, không lưu mật khẩu hoặc ghi dữ liệu CNC.
- Dùng IPv4 và cổng FOCAS trong LAN/VPN. Không mở router port-forward.
- Các API CNC chỉ gồm kết nối, sysinfo, statinfo, rddiaginfo,
  diagnoss, pmc_rdpmcrng và giải phóng handle.
- Không có API ghi, force bit, sửa ladder, sửa tham số, tải chương trình
  vào CNC, start/stop/reset hoặc thay đổi chế độ CNC.
- Có thể mở cùng cầu nối nhưng cần một kết nối FOCAS bổ sung. Nếu CNC
  hết handle/kết nối, tắt công cụ thử hoặc dừng cầu nối trên laptop rồi
  thử lại; không thay tham số CNC để vượt lỗi.
- FOCAS 3/4: đối chiếu số DGN, trục, địa chỉ và hỗ trợ của controller.
  FOCAS 6: tùy chọn/chức năng không có. Lỗi mạng/handle: kiểm tra LAN,
  IP/cổng và số kết nối. Giữ nguyên mã lỗi để chẩn đoán.

KIỂM CHỨNG
Đã kiểm tra parser PowerShell, biên dịch C#, allowlist native chỉ đọc,
metadata và giải mã DGN, byte/bit PMC, worker bất đồng bộ, xử lý lỗi và
đóng handle bằng native fixture trên Linux. Chưa chạy giao diện WinForms
trên Windows hoặc kiểm chứng với CNC thật. Cần đối chiếu giá trị với
màn hình máy khi thử; không thể cam kết không có mọi rủi ro vận hành.

Nguồn đối chiếu: Fwlib64.h anh cung cấp và tài liệu FANUC FOCAS
cnc_sysinfo, cnc_statinfo, cnc_rddiaginfo, cnc_diagnoss, pmc_rdpmcrng.
