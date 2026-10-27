# Windows local release check

## Build and verify

```powershell
pnpm test
pnpm build:unpack
pnpm test:packaged
pnpm test:electron
pnpm build:win
```

- `release/win-unpacked/FrameFlow.exe`: chạy trực tiếp; giữ nguyên toàn bộ thư mục `win-unpacked`, không chỉ copy riêng EXE.
- `release/FrameFlow-0.1.0-setup.exe`: installer NSIS x64, cài theo user, có chọn thư mục. Đã build, **chưa thử cài/gỡ**.
- Build scripts dùng `--publish never`. Không có auto-update hoặc gửi dữ liệu lên server.
- Đây là bản thử nghiệm **unsigned**, dùng icon mặc định Electron. Không xem build thành công là đã sẵn sàng phát hành công khai. Windows có thể cảnh báo vì chưa có chữ ký số.
- `release/` là artefact local, đã nằm trong `.gitignore`.

## Automated packaged smoke test

`pnpm test:packaged` cần Node.js 22+ và bản unpacked Windows đã build. Test khởi động **EXE thật**, không dùng `electron tests/...` làm ứng dụng thay thế.

- Profile/cache/registry/project/video đều ở thư mục tạm riêng; không dùng project hay registry của người dùng thật.
- Test bật DevTools Protocol trên localhost với port tạm **chỉ qua tham số tiến trình test**. App bình thường không bật port debug hoặc test hook.
- Chạy preload, IPC, SQLite/WASM trong `app.asar` và UI production thật; xác nhận target không phải dev server.
- Tự tạo WebM/VP8 3840×2160 và MP4/H.264 640×360 (nếu encoder có sẵn). Kiểm tra codec ID trong container, phát, capture đúng resolution, vẽ arrow, lưu JSON/JPEG/PNG, export package và cold restart.
- Test ghi rõ codec bị bỏ qua nếu encoder không sẵn; không được diễn giải PASS của test là mọi codec đều đã được thử. Xem `cases` và `notes` trong report.
- `result.json`, screenshot và `runtime.log` nằm ở đường dẫn test in ra. Không thêm footage/test profile vào Git.
- Video tự tạo ngắn và đơn giản chỉ xác nhận codec/flow/resolution; **không** thay thế thử footage camera dài, VFR, HEVC, bitrate cao hoặc benchmark GPU.

## Verified on the current Windows machine

- [x] Build/typecheck và 36 unit/service/store tests.
- [x] Full Electron UI smoke: tạo project, import hai version, review, annotation, SRC, export, đổi project và cold restart.
- [x] Windows unpacked executable chạy độc lập với preload/SQLite/WASM hoạt động.
- [x] WebM/VP8 4K: playback → capture → annotation → PNG export 3840×2160 → restart.
- [x] MP4/H.264 640×360: cùng workflow trên EXE thật; encoder có sẵn ở máy kiểm tra.
- [x] Build installer NSIS x64 thành công; không publish hoặc chạy installer trong kiểm thử.

## Remaining before a public release

- [ ] Cài, chạy, upgrade và gỡ installer trên máy Windows thử nghiệm sạch (không phải máy chứa project làm việc).
- [ ] Thử footage H.264 thực tế dài/nặng; video dọc, VFR, âm thanh và 4K bitrate cao; ghi lại codec không hỗ trợ.
- [ ] Fullscreen, native file/folder dialogs với thao tác người dùng thật; kiểm tra đường dẫn dài/ổ ngoài/tệp bị di chuyển.
- [ ] Filmstrip thumbnail của TASK-PLY-003; cảnh báo khi rời comment chưa lưu.
- [ ] Xem xét hardening Electron (`webSecurity: false` hiện dùng cho local media), chính sách external URL/navigation và nội dung không tin cậy trước khi phân phối rộng.
- [ ] Icon/branding riêng, chữ ký số/code-signing và kiểm tra Windows SmartScreen theo quy trình phát hành.
- [ ] Kiểm tra phiên bản Electron còn được hỗ trợ/cập nhật bảo mật trước khi phát hành công khai (bản build hiện dùng 33.4.11).
- [ ] Điều tra log Chromium GPU lúc đóng smoke test. Chưa thấy renderer crash/lỗi ảnh, nhưng chưa xác định nguyên nhân.
- [ ] macOS/Linux: build, chạy và kiểm thử riêng; chưa được xác nhận từ Windows.

Không merge `dev` vào `main` hoặc đánh dấu MVP hoàn tất chỉ dựa trên checklist tự động này.
