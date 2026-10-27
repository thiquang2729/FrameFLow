# Changelog

Tất cả các thay đổi đáng chú ý của dự án FrameFlow sẽ được ghi nhận trong file này.

Quy ước đặt phiên bản tuân theo [Semantic Versioning](https://semver.org/lang/vi/).

---

## [Unreleased]

### Added
- M5 SRC Library dùng dữ liệu thật: import nhiều file hoặc thư mục con, thumbnail JPEG, tìm/sắp xếp, grid/list và preview video/ảnh; giữ đường dẫn gốc, không copy footage.
- Migration thumbnail cho DB cũ và kiểm thử SourceService: persistence, dedupe, metadata unknown, validation, quét thư mục và rollback. Smoke test Electron mở rộng cho nhập SRC và cold restart.
- Smoke test `pnpm test:electron`: chạy Electron production với project/profile tạm, tạo WebM thật, thao tác vẽ bằng chuột, kiểm tra media/JSON và khởi động lại toàn bộ ứng dụng để xác nhận persistence.
- M4 trên nhánh `dev`: tự capture JPEG khi tạo bình luận; vẽ arrow/rect/ellipse/text, undo/redo, màu và kích thước; lưu annotation JSON + PNG riêng, đọc lại cùng bình luận.
- Kiểm thử geometry ngang/dọc/4K, capture/callback/fallback và lưu media/annotation qua restart.
- Nối Review Workspace với SQLite/IPC thật: chọn phiên bản, player và phím tắt, tạo bình luận theo timestamp, lọc/trạng thái và timeline markers.
- Kiểm thử ReviewService bằng SQLite: lưu/mở lại, cách ly phiên bản, validation, frame 0, ID sau xóa và cập nhật trạng thái.

### Changed
- Giao diện dành cho một người dùng local: bỏ hồ sơ tài khoản giả, nhóm/avatar/thêm thành viên, tên tác giả bình luận và thông báo giả; đổi chia sẻ thành xuất gói phản hồi. Không yêu cầu đăng nhập.

### Fixed
- Bỏ metadata SRC gán cứng 1080p/30fps/H.264 và các clip/AI score mẫu. File không giải mã được có cảnh báo, không dừng cả batch; nhập lại cùng path không tạo bản ghi trùng.
- Player xử lý duration WebM ban đầu là Infinity bằng metadata đã import và lắng nghe `durationchange`, tránh timeline 0/seek về đầu.
- Transaction cho lưu review + attachments + annotation; ghi SQLite qua tệp tạm và dọn ảnh mới khi lưu thất bại. Filename media có suffix ULID, không ghi đè ảnh cũ khi tái sử dụng review ID.
- Tránh ID bình luận trùng khi xóa một bình luận giữa danh sách; xác thực quan hệ project/version và dữ liệu feedback ở backend.

## [0.1.0] - 2026-10-27

### Added (Khởi tạo nền tảng & Kiến trúc V0.1)
- **Scaffolding & Architecture:**
  - Khởi tạo repo Git với branch `main` và cấu hình `.gitignore` chuẩn.
  - Setup cấu trúc Electron 33 + Vite 5 + React 18 + TypeScript + Tailwind CSS.
  - Tích hợp `sql.js` (SQLite WebAssembly) chạy local, độc lập không phụ thuộc môi trường biên dịch C++.
- **Data Layer & Services:**
  - Định nghĩa 7 schema cốt lõi trong `project.db`: `projects`, `edit_versions`, `source_assets`, `review_comments`, `review_attachments`, `annotations`, `revision_packages`.
  - Tự động sinh cấu trúc thư mục tiêu chuẩn theo DOCX Table 15: `source/`, `proxy/`, `thumbnails/`, `frames/`, `annotations/`, `versions/`, `exports/`.
  - Triển khai `ProjectService`, `VersionService`, `ReviewService`, `SourceService`, `ExportService`.
  - Thiết lập kênh giao tiếp an toàn IPC Bridge qua `preload/index.ts`.
- **UI Workspace & Components:**
  - App Shell: Sidebar điều hướng, TopBar breadcrumb, User workspace info.
  - **Project Dashboard:** Thống kê 4 chỉ số (SRC clips, versions, open reviews, status), bản dựng hiện tại, feedback gần nhất, mục tiêu dự án.
  - **Review Workspace:** 3-panel layout (danh sách bình luận theo timestamp, trình phát video kèm timeline marker, khung hình capture & công cụ vẽ chú thích).
  - **Drawing Toolbar & Annotation Canvas:** Hỗ trợ vẽ mũi tên (Arrow), hình chữ nhật (Rect), hình tròn (Circle), văn bản (Text), bảng màu và Undo/Redo.
  - **Version List:** Quản lý dòng lịch sử (Lineage) Draft V1 → V2 → V3 và import bản dựng.
  - **SRC Library:** Duyệt clip thô, hiển thị thông số kỹ thuật (duration, resolution, fps, size).
  - **Export Revision Package:** Tạo gói `review.json`, `instructions.md`, `README.md`, `frames/`, `annotated/` gửi AI Agent / Editor.
