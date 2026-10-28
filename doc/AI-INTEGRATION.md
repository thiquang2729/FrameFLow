# Antigravity qua CLIProxyAPI

## Sử dụng

1. Chạy `pnpm dev`, hoặc mở `release/win-unpacked/FrameFlow.exe` sau `pnpm build:unpack`.
2. Vào **Kết nối AI**. CLIProxyAPI tự chạy nền; không cần cài Go, Docker hoặc tự mở proxy.
3. Bấm **Đăng nhập Antigravity**, xác nhận tài khoản Google trong trình duyệt mặc định.
4. Bấm **Tải model**, chọn model và **Gửi kiểm tra**. Chỉ khi có phản hồi thật mới xác nhận tài khoản/model sử dụng được.

Đăng nhập đã lưu được dùng lại khi mở app. Có thể đăng nhập nhiều tài khoản; CLIProxyAPI quyết định tài khoản khả dụng. Model phụ thuộc quyền và hạn mức tài khoản, không được hard-code.

## Vòng đời và dữ liệu

- Proxy phiên bản **8.0.45**, kèm giấy phép MIT, được đóng gói qua `extraResources`, không nằm trong ASAR.
- `pnpm ai:prepare` tải release chính thức, kiểm tra SHA-256 archive đã ghim, trích binary và tạo manifest. Mỗi lần chạy app xác minh binary với manifest. Không tự cập nhật binary khi mở app.
- API chỉ bind `127.0.0.1`, ưu tiên cổng **18317**, tách khỏi cổng mặc định 8317 của CLIProxyAPI cài riêng. Nếu 18317 đã bận, tự chọn cổng trống khác; không kết nối hoặc dừng proxy bên ngoài. Mỗi lần khởi động sinh khóa client ngẫu nhiên mới, không đưa khóa qua preload/renderer.
- Management API, control panel, LAN discovery và plugins bị tắt. Không ghi nội dung câu hỏi hoặc phản hồi vào log của FrameFlow.
- Cấu hình phiên chạy: `<Electron userData>/ai-proxy/runtime.yaml`. Khóa client tồn tại trong file này vì Go cần đọc; file bị xóa khi thoát bình thường, ghi đè bằng khóa mới khi mở lại sau crash. Đây không phải khóa API upstream.
- OAuth: `<Electron userData>/ai-proxy/auth/`. **CLIProxyAPI lưu token dạng JSON theo định dạng native, không được mã hóa bằng Electron safeStorage.** Không chia sẻ thư mục này. Trên Unix dùng thư mục mode 0700; trên Windows dựa vào quyền truy cập hồ sơ người dùng. Đăng xuất/xóa tài khoản qua UI chưa thuộc phạm vi phiên bản này.
- Model đã chọn: `<Electron userData>/ai-proxy/settings.json`. Không lưu lịch sử câu hỏi.
- Luồng OAuth native mở callback tạm thời trên cổng trống, timeout tối đa 5 phút. CLIProxyAPI upstream bind callback trên mọi interface; chỉ API inference được giới hạn loopback. Không mở port forwarding/firewall cho callback này.
- Một watchdog giữ lease qua stdin: đóng app bình thường hoặc main process bị kill đều đóng pipe và dừng đúng Go child do app tạo. Không tìm/kill tiến trình theo tên. Nếu chính watchdog bị OS cưỡng chế kết thúc thì không thể bảo đảm cleanup Go.
- Single-instance lock tránh hai cửa sổ độc lập ghi đè runtime config.
- AI không tự gửi video, ảnh, source footage hoặc phản hồi dự án; chỉ nội dung nhập ở màn hình kiểm tra được gửi khi người dùng bấm nút. Dữ liệu này đi tới upstream, dù proxy chạy cục bộ.
- Tài khoản phải có quyền dùng Antigravity. Người dùng tự chịu trách nhiệm về điều khoản nhà cung cấp, quyền chia sẻ nội dung và hạn mức. Không bảo đảm model miễn phí hoặc luôn khả dụng.

## Kiểm thử

```sh
pnpm ai:prepare
pnpm test
pnpm build:unpack
pnpm test:ai:packaged
```

Unit/integration test dùng thư mục riêng, không đọc tài khoản thật. Bao gồm proxy binary thật, xác thực client, model rỗng khi chưa đăng nhập, restart, timeout/cancel, OAuth URL/cancel và watchdog cleanup. Bản Windows đóng gói được kiểm tra tự khởi động, UI, proxy crash/recovery, thoát, mở lại và main process bị kill.

**Test OAuth URL không đồng nghĩa đăng nhập hoặc inference thật đã thành công.** Cần người dùng hoàn tất đăng nhập và nhận câu trả lời trong app; không giả lập kết quả này thành PASS.

## Chuẩn bị nền tảng khác

`node scripts/prepare-ai-proxy.mjs [win32|darwin|linux] [x64|arm64]` chuẩn bị binary cho target tương ứng. Build mặc định chuẩn bị nền tảng/kiến trúc máy hiện tại. Cross-build phải tự chuẩn bị đúng target trước. Chỉ Windows x64 được kiểm thử trong phiên tích hợp này; macOS có thể cần ký/notarize binary đi kèm.

Tài liệu upstream: https://help.router-for.me/configuration/provider/antigravity.html
