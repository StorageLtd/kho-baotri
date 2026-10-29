CẦU NỐI NEWAY 1260S - WINDOWS 11 X64

Máy: Neway 1260S | ID cố định: neway-1260s
FANUC 0i-MF Plus | IP: 192.168.1.1 | TCP: 8193

BẢN NÀY LÀM GÌ?
- Chỉ đọc thông tin/trạng thái, tốc độ trục chính và chạy dao thực tế, số O hiện tại/chính.
  API bổ sung: cnc_rdspeed, cnc_rdprgnumo8 và cnc_rdprgnum (dự phòng).
- Đọc lại sau mỗi chu kỳ khoảng 5 giây (cộng thời gian đọc/gửi); không điều khiển CNC.
- Gửi dữ liệu tới Firebase CMMS sau khi bạn đăng nhập tại laptop.
- Tạo/cập nhật duy nhất bản ghi cncs/neway-1260s; không thay danh sách máy hay dữ liệu kho.
- Web báo mất kết nối khi tín hiệu quá 30 giây. Không sử dụng để quyết định an toàn máy.
- Tốc độ chạy dao giữ đúng đơn vị do CNC trả về (mm/min, inch/min, mm/rev hoặc inch/rev).
- Số O là chương trình đang được chọn/đang thực hiện; không đọc nội dung chương trình.
- Chưa đọc tốc độ đặt, override, dòng lệnh NC, nội dung alarm chi tiết.
  Các mục chưa đo hoặc API bị lỗi sẽ để trống và hiện chẩn đoán, không tạo số liệu giả.

CHUẨN BỊ
1. Giải nén ZIP vào thư mục riêng, không chạy bên trong ZIP.
2. Chép ba DLL từ bộ 64-bit của bạn vào thư mục lib:
   Fwlib64.dll, fwlibe64.dll, fwlib30i64.dll.
   Không chép DLL vào Windows/System32. ZIP không kèm thư viện FANUC.
3. Laptop giữ kết nối Ethernet với CNC và Wi-Fi có Internet để truy cập Firebase.
4. Dùng tài khoản CMMS có email đã xác minh, hồ sơ users/<uid> với vai trò
   technician, manager hoặc admin. Có thể dùng tài khoản hiện đang đăng nhập web.
   Nên dùng tài khoản riêng cho cầu nối khi vận hành lâu dài.
   Không gửi mật khẩu cho người khác, không lưu mật khẩu trong config.
5. CNC dùng IP 192.168.1.1; Ethernet laptop dùng IP 192.168.1.10.
   Cả hai dùng subnet mask 255.255.255.0. IP laptop không cần khai báo trong cầu nối.
   Có thể kiểm tra: Test-NetConnection 192.168.1.1 -Port 8193

CẬP NHẬT TỪ BẢN CŨ
Dừng cầu nối bằng Ctrl+C rồi đóng cửa sổ PowerShell cũ (để bỏ lớp C# đã nạp).
Thay CẢ HAI file FanucReader.cs và Start-FanucBridge.ps1 bằng bản mới.
Giữ ba DLL và bridge-config.json hiện có. Mở PowerShell mới và làm các bước dưới.
Bản mới phải hiện Bridge build: 20261029-pmc-cycles.
Chép thêm ReportCollector.ps1 cùng thư mục với Start-FanucBridge.ps1.
Mở quyền chạy cho đúng file này bằng Unblock-File -LiteralPath .\ReportCollector.ps1.

CÁCH CHẠY
1. Trong File Explorer, mở thư mục có Start-FanucBridge.ps1, bấm thanh địa chỉ,
   nhập powershell rồi Enter. Dùng Windows PowerShell 64-bit, không cần Run as administrator.
2. Nếu quy định IT cho phép chạy mã từ repository này, như với bản thử trước:
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
   Unblock-File -LiteralPath .\Start-FanucBridge.ps1
   Unblock-File -LiteralPath .\FanucReader.cs
   Chỉ áp dụng cho các file đã kiểm tra nguồn; không dùng Bypass/Unrestricted.
3. Chạy:
   .\Start-FanucBridge.ps1
4. Sau khi đọc CNC thành công, nhập email CMMS rồi mật khẩu trong ô nhập ẩn.
   Không nhập mật khẩu trong câu lệnh. Chương trình không lưu mật khẩu/token vào file.
5. Dòng FIREBASE UPDATED xác nhận Firebase nhận bản cập nhật. Dòng tiếp theo hiện
   Spindle/Feed/Program/Main. Nếu WARNING, gửi mã lỗi; không đổi tham số CNC để ép API chạy.
6. Mở web bảo trì, tải lại bằng Ctrl+Shift+R, vào Giám sát CNC.
   Máy Neway 1260S sẽ xuất hiện sau khi đăng nhập cầu nối và gửi thành công.
   Nếu máy chưa xuất hiện, gửi dòng lỗi, KHÔNG gửi mật khẩu/token.
7. Giữ cửa sổ PowerShell mở. Ctrl+C dừng cầu nối. Đóng cửa sổ, laptop ngủ,
   mất Internet hoặc mất LAN sẽ khiến web chuyển mất kết nối sau thời gian chờ.

KIỂM TRA KHÔNG GỬI FIREBASE
   .\Start-FanucBridge.ps1 -LocalOnly -Once
Chỉ đọc một lần và lưu last-result.json, không yêu cầu tài khoản, không gửi dữ liệu.
   .\Start-FanucBridge.ps1 -Once
Đăng nhập, gửi một mẫu rồi dừng; bản ghi sẽ được đánh dấu ngắt kết nối khi kết thúc.

CẤU HÌNH
bridge-config.json chỉ chứa cấu hình không bí mật và Firebase Web API key công khai.
Không thay databaseUrl sang địa chỉ khác. Không thêm mật khẩu, service account
hoặc private key vào file này. Máy khác cần ID riêng, không dùng neway-1260s.
Không chạy hai cầu nối đồng thời với cùng machineId.
Dừng cầu nối trước khi xóa máy trên web; nếu không nó có thể tạo lại bản ghi.

LỖI THƯỜNG GẶP
- FOCAS -16: kiểm tra LAN, đúng giao diện EMBEDDED/PCMCIA, IP/cổng và phần mềm khác.
- HTTP 400 khi đăng nhập: kiểm tra thông tin tài khoản; không đăng nhập lặp liên tục.
- Email chưa xác minh hoặc vai trò viewer: xử lý tài khoản trước, không nới Firebase Rules.
- HTTP 401/403 hoặc Permission denied: cần quản trị viên kiểm tra Rules đã triển khai
  cho users/<uid> và cncs, không công khai quyền đọc/ghi database.
- Gửi thất bại: cầu nối báo lỗi rồi thử lại chu kỳ sau; tín hiệu cũ trên web sẽ hết hạn.
- Khi script bị chính sách công ty chặn, liên hệ IT; không vô hiệu hóa bảo vệ toàn máy.

GIỚI HẠN KIỂM CHỨNG
Mã đã được kiểm tra bằng PowerShell 7, biên dịch C#, thử luồng với CNC/Firebase giả lập
và thử giao diện Chromium. Cấu trúc dữ liệu theo header do bạn cung cấp. Bản đọc FOCAS
một lần trước đây đã chạy thành công trên CNC của bạn; bản cầu nối mới vẫn cần bạn
chạy trên Windows 11 để xác nhận việc gửi Firebase thật.
last-result.json chỉ lưu bản đọc CNC gần nhất, không chứa mật khẩu/token.
DLL được bạn cung cấp, chưa xác minh nguồn/chữ ký hoặc bảo đảm phiên bản từ nhà sản xuất.

BÁO CÁO TUẦN / THÁNG / QUÝ - CẦN BẬT QUYỀN FIREBASE MỘT LẦN
1. Sao lưu Rules hiện có trong Firebase Console > Realtime Database > Rules.
2. Thêm nhánh cncReports từ FIREBASE-REPORTS-RULES.json vào trong rules,
   cùng cấp với cncs. Đây là mảnh cấu hình, không thay toàn bộ Rules hiện có.
3. Publish Rules. Không đặt .read/.write công khai, không cung cấp khóa quản trị.
4. Chạy cầu nối. FIREBASE UPDATED là tín hiệu hiện tại; REPORTS UPDATED mới là
   báo tổng hợp ngày đã được lưu. Nếu thiếu quyền, file chờ vẫn nằm trong report-outbox.
5. Trên web bấm Báo cáo vận hành CNC (thay Xuất CNC CSV), chọn máy và kỳ,
   bấm Xem báo cáo, xuất Excel 2 sheet hoặc in/PDF.

CÁCH TÍNH VÀ SẢN LƯỢNG
- Đọc trạng thái theo chu kỳ; cộng khoảng giữa hai mẫu chỉ khi cách nhau <=15 giây.
- Giờ RUN là trạng thái START, không phải riêng thời gian cắt gọt. Giờ setup chưa thu thập.
- Kỳ theo lịch Việt Nam; phần trước khi cài hoặc mất kết nối là chưa có dữ liệu, không phải dừng.
- Tham số 6711 được CHỈ ĐỌC để lấy bộ đếm CNC; cần đối chiếu giá trị và cách tăng
  với màn hình máy trước khi gọi đó là sản lượng. Không ghi/reset tham số trên CNC.
- Mặc định partCounterVerified=false: báo mức tăng bộ đếm nhưng không coi là thành phẩm.
- Sau khi người phụ trách xác nhận, đặt partCounterVerified=true, partsPerCount
  bằng số chi tiết tương ứng một lần tăng (mặc định 1), rồi khởi động lại cầu nối.
  Chỉ phiên mới áp dụng quy đổi. Sản phẩm đạt/lỗi chưa được phân loại.
- Bộ đếm giảm/reset hoặc mất dữ liệu: không suy diễn sản lượng qua khoảng đó.
- Tổng hợp ngày/phiên gửi lại cùng ID, không cộng đôi. Chỉ chạy một cầu nối/máy.
- Giữ report-outbox khi cập nhật; chứa số liệu vận hành chờ gửi, không chứa mật khẩu/token.
  Mất Internet sau khi đã đăng nhập vẫn có thể thu thập cục bộ. Khởi động mới vẫn cần
  Internet để xác thực trước khi thu thập. Không tự chạy nền khi laptop ngủ/đóng PowerShell.
- Dữ liệu nhánh cncReports lưu dài hạn trên Firebase đến khi quản trị viên sao lưu/xóa;
  cần theo dõi dung lượng và thiết lập chính sách lưu trữ phù hợp quy định công ty.

BẢN GHI TỪNG CHU KỲ (QUAN SÁT QUA FOCAS)
- Web hiển thị RUN TIME và CYCLE TIME đọc từ CNC; nếu API không hỗ trợ sẽ báo lỗi/để trống.
  Cần đối chiếu với màn hình máy; nguồn dự phòng đọc tham số thời gian 6752/6751 và 6758/6757.
  Không ghi hoặc reset bất kỳ tham số nào.
- PART COUNT là tên hiển thị bộ đếm 6711. Không còn dòng đối chiếu trên thẻ máy.
- Excel chỉ hai sheet: Tổng quan (cộng theo máy/chương trình), Theo ngày (mỗi chu kỳ quan sát một hàng).
- Mở cầu nối trước khi chạy để ghi được chuyển trạng thái dừng -> START ở MEM/REMOTE.
  HOLD/tiếp tục và alarm trong cùng chu kỳ không tạo thêm hàng.
- Địa chỉ PMC được cung cấp ở phần dưới. Dù đọc PMC, thời điểm start/dừng
  là thời điểm đọc trạng thái, sai số theo chu kỳ đọc, không phải thời điểm nút bấm chính xác.
  Trạng thái RESET không được gọi là M30; chỉ xung R423.6 bắt được mới xác nhận M30.
- Chu kỳ ngắn hơn chu kỳ đọc có thể bị bỏ lỡ; khi máy lặp không dừng, chưa bảo đảm
  tách từng sản phẩm. Cần tín hiệu sự kiện/counter phù hợp do kỹ thuật máy xác nhận để làm chính xác.
- Nếu vào giữa chu kỳ, đổi chương trình, mất dữ liệu, ngắt cầu nối hoặc bộ đếm reset:
  giữ hàng quan sát nhưng để trống các mốc/đếm chưa đủ bằng chứng. Không bù số liệu.
- Chu kỳ được xếp vào ngày bắt đầu quan sát; chu kỳ qua nửa đêm giữ một hàng.
  Tổng giờ theo chương trình sử dụng các phần thời gian nằm trong kỳ báo cáo.
- Không tách ngược các tổng hợp ngày trước đây thành chu kỳ, không xác nhận số sản phẩm đạt.

PMC NEWAY 1260S - ĐỊA CHỈ NGƯỜI DÙNG CUNG CẤP
Cycle Start: X10.1 (area X=3, byte 10, bit 1). M30: R0423.6 (area R=5, byte 423, bit 6).
Bản mới có pmcCycleSignals=true và pmcPollMilliseconds=200 trong bridge-config.json.
Nếu giữ config cũ, thêm hai mục này hoặc chép config mới (giữ đúng IP CNC của bạn).
Chỉ dùng cho máy đã xác nhận địa chỉ; máy khác phải kiểm tra lại, không dùng mặc định.

- Cầu nối chỉ gọi pmc_rdpmcrng để đọc hai bit; không sửa ladder, không ghi PMC hoặc PWE.
- Luồng đọc PMC riêng dùng một kết nối FOCAS, đọc hai bit khoảng 200 ms một lượt;
  trạng thái/counter đọc khoảng mỗi giây và đọc thêm thông tin tại sự kiện.
- Xung ngắn hơn chu kỳ đọc hoặc phát trong lúc API đang xử lý có thể bị bỏ lỡ.
  Không bảo đảm bắt đủ từng lần bấm/M30. Không tự giảm chu kỳ quá thấp để ép bắt xung.
- Dòng PMC CAPTURED hiển thị số cạnh lên đã bắt được. Xem thêm Chẩn đoán tín hiệu chu kỳ trên web.
- Chỉ khi bắt được cạnh lên R423.6 mới ghi Đã quan sát M30 PMC. RESET không phải bằng chứng M30.
- Nếu xung bị bỏ lỡ, hàng ghi rõ không bắt được M30/thiếu Start. Không điền thời điểm giả.
- Bit đã ON lúc kết nối được coi là mức ban đầu, không tạo sự kiện cũ. Khi mất kết nối,
  chu kỳ đang mở bị đánh dấu thiếu dữ liệu. HOLD/tiếp tục vẫn nằm trong một chu kỳ.
- Trước khi dùng báo cáo để chốt sản lượng, cần thử đối chiếu nhiều chu kỳ thật và
  nhờ kỹ thuật máy cung cấp tín hiệu giữ hoặc bộ đếm sự kiện nếu phải bắt đủ xung ngắn.
- Không tự sửa ladder để kéo dài xung M30; cần người có chuyên môn kiểm tra ảnh hưởng.
- Khi dừng cầu nối: Ctrl+C, chờ kết thúc trước khi mở phiên mới. Không chạy hai cầu nối/máy.
