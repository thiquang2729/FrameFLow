# FrameFlow

> **AI-Assisted Post-Production Video Review Workspace**  
> Không gian làm việc chuyên nghiệp dành cho Video Editor, Content Creator và Đội ngũ Hậu kỳ, hỗ trợ review video từng khung hình (frame-by-frame), vẽ chú thích trực quan và xuất gói phản hồi chuẩn hoá cho AI Agent & Editor.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)]()
[![Electron](https://img.shields.io/badge/Electron-33-47848F.svg)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6.svg)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC.svg)](https://tailwindcss.com/)

---

## 📖 Giới thiệu (Overview)

**FrameFlow** là ứng dụng desktop (Local-First) giải quyết triệt để vấn đề phản hồi hậu kỳ video rời rạc, thiếu chính xác và khó theo dõi. Với FrameFlow, mọi góp ý đều gắn liền với mốc thời gian (timestamp) và khung hình thực tế, kèm công cụ vẽ chú thích trực tiếp trên màn hình video.

Ứng dụng hoạt động **100% offline**, lưu trữ toàn bộ dữ liệu dự án trên máy cục bộ bằng cơ sở dữ liệu SQLite (WebAssembly), đảm bảo tính bảo mật và tốc độ phản hồi tức thì.

---

## ✨ Tính năng nổi bật (Key Features)

### 1. 🎬 Review Khung Hình Chính Xác (Frame-Accurate Review)
- Trình phát video chuyên dụng hỗ trợ **seek chính xác từng frame** dựa trên FPS thực tế.
- Tối ưu hiển thị cho cả định dạng **video ngang (16:9, 4K)** và **video dọc (9:16 - TikTok, Reels, Shorts)**.
- Timeline trực quan gắn cờ (markers) các điểm phản hồi với màu sắc phân biệt trạng thái và mức độ ưu tiên.

### 2. ✏️ Chú Thích Trực Quan Trên Khung Hình (Visual Annotations)
- **Tự động chụp frame gốc (JPEG)** ngay khi tạo bình luận tại vị trí phát.
- Bộ công cụ vẽ phong phú:
  - 🖊️ **Bút vẽ tự do (Pen)** & **Bút dạ quang (Highlight)**
  - ➡️ **Mũi tên chỉ dẫn (Arrow)** với tính toán góc xoay tự động
  - ⬛ **Hình khối**: Hình chữ nhật (Rectangle), Hình tròn (Circle / Ellipse)
  - 🔤 **Chèn văn bản (Text Annotation)** trực tiếp lên video
- Bảng màu trực quan, thanh trượt tùy chỉnh kích thước nét vẽ (px).
- Hỗ trợ **Undo / Redo** đa cấp độ (`Ctrl + Z` / `Ctrl + Shift + Z`).
- Lưu tách biệt ảnh chụp gốc và lớp phủ chú thích (transparent PNG), đảm bảo không làm hỏng frame video gốc.

### 3. 🧬 Quản Lý Phiên Bản Dựng (Version Lineage)
- Theo dõi tiến trình hậu kỳ theo dòng lịch sử: `Draft V1` → `Draft V2` → `Draft V3`...
- Quản lý các phiên bản dựng kèm thông số kỹ thuật (Resolution, Duration, FPS, Dung lượng).
- Tách biệt dữ liệu phản hồi giữa các phiên bản, tránh nhầm lẫn nội dung cần sửa.

### 4. 📁 Thư Viện Footage Gốc (SRC Library)
- Quét và liên kết hàng loạt video/footage từ thư mục hoặc tệp lẻ mà không sao chép trùng lặp tệp nguồn.
- Tự động tạo ảnh thu nhỏ (Thumbnail JPEG) chất lượng cao.
- Trình xem trước (Quick Preview), tìm kiếm và sắp xếp theo tên, dung lượng, thời lượng.

### 5. 📦 Xuất Gói Phản Hồi Chuẩn Hoá (Revision Package Export)
- Chọn lọc các bình luận cần xử lý (lọc theo trạng thái, mức độ ưu tiên hoặc chọn thủ công).
- Xuất thành thư mục độc lập sẵn sàng chuyển giao cho **Editor** hoặc **AI Agent** tự động hoá:
  - `review.json`: Dữ liệu có cấu trúc đầy đủ timestamp, frame, nội dung góp ý, độ ưu tiên, liên kết ảnh.
  - `instructions.md`: Bản ghi chú nhiệm vụ định dạng Markdown cho Editor.
  - `README.md`: Hướng dẫn tổng quan về gói sửa đổi.
  - `frames/`: Các frame gốc trích xuất từ video.
  - `annotated/`: Các hình ảnh kèm chú thích trực quan tương ứng.

### 6. 🔒 Hoàn Toàn Cục Bộ & Bảo Mật (100% Local-First)
- Toàn bộ cơ sở dữ liệu (`project.db`) chạy trên nền **SQLite WebAssembly (`sql.js`)** độc lập.
- Không cần tài khoản, không phụ thuộc dịch vụ đám mây, dữ liệu video và chú thích của bạn luôn nằm an toàn trên máy tính.

---

## ⌨️ Bảng Phím Tắt (Keyboard Shortcuts)

FrameFlow được thiết kế tối ưu cho thói quen thao tác của Editor:

| Phím tắt | Thao tác |
| :--- | :--- |
| <kbd>Space</kbd> | Phát / Tạm dừng video (Play / Pause) |
| <kbd>←</kbd> / <kbd>→</kbd> | Lùi / Tiến đúng **1 frame** (dựa theo FPS của video) |
| <kbd>Shift</kbd> + <kbd>←</kbd> / <kbd>→</kbd> | Lùi / Tiến nhanh **5 giây** |
| <kbd>C</kbd> | Tạo bình luận mới tại timestamp hiện tại & chụp frame |
| <kbd>D</kbd> | Bật / Tắt chế độ vẽ trên frame (Drawing Mode) |
| <kbd>1</kbd>, <kbd>2</kbd>, <kbd>3</kbd> | Đặt mức độ ưu tiên: `1 = Thấp`, `2 = Trung bình`, `3 = Cao` |
| <kbd>Ctrl</kbd> + <kbd>Enter</kbd> | Lưu bình luận / lưu chỉnh sửa |
| <kbd>Ctrl</kbd> + <kbd>Z</kbd> | Hoàn tác nét vẽ (Undo) |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd> | Làm lại nét vẽ (Redo) |
| <kbd>Esc</kbd> | Hủy / Thoát chế độ soạn thảo hoặc vẽ |

---

## 🛠️ Công Nghệ Sử Dụng (Tech Stack)

- **Desktop Framework**: [Electron 33](https://www.electronjs.org/) + [electron-vite 2](https://electron-vite.org/)
- **Frontend Core**: [React 18](https://react.dev/), [TypeScript 5.7](https://www.typescriptlang.org/)
- **Styling & UI**: [Tailwind CSS 3.4](https://tailwindcss.com/), [Lucide React Icons](https://lucide.dev/)
- **Canvas & Drawing**: HTML5 2D Canvas API & [Konva](https://konvajs.org/) / [react-konva](https://github.com/konvajs/react-konva)
- **State Management**: [Zustand 5](https://github.com/pmndrs/zustand)
- **Local Database**: [sql.js](https://sql.js.org/) (SQLite compiled to WebAssembly)
- **Packaging & Installer**: [electron-builder 25](https://www.electron.build/)

---

## 📂 Cấu Trúc Thư Mục Dự Án (Project Structure)

```text
FrameFlow/
├── src/
│   ├── main/               # Electron Main Process
│   │   ├── database/       # Khởi tạo và quản lý SQLite (sql.js WASM)
│   │   ├── ipc/            # Đăng ký IPC handlers bảo mật
│   │   └── services/       # Business logic (Project, Version, Review, Source, Export)
│   ├── preload/            # Preload scripts & ContextBridge API
│   ├── renderer/           # Giao diện React (Renderer Process)
│   │   ├── components/     # UI Components (Review, Drawing, Layout, Modals)
│   │   ├── pages/          # Các màn hình chính (Dashboard, Review, Versions, Library, Export)
│   │   ├── stores/         # State management với Zustand
│   │   └── lib/            # Tiện ích render canvas, capture frame, guards
│   └── shared/             # Type definitions và IPC Channels dùng chung
├── tests/                  # Bộ kiểm thử Unit test & Electron smoke tests
├── electron-builder.yml    # Cấu hình đóng gói ứng dụng
├── package.json
└── tsconfig.json
```

---

## 🚀 Cài Đặt & Phát Triển (Getting Started)

### Yêu cầu môi trường
- **Node.js**: Phiên bản `>= 20.0.0`
- Quản lý gói: khuyến nghị sử dụng **pnpm** (hoặc npm / yarn)

### 1. Clone repository
```bash
git clone https://github.com/thiquang2729/FrameFLow.git
cd FrameFLow
```

### 2. Cài đặt dependencies
```bash
pnpm install
```

### 3. Chạy ứng dụng trong môi trường phát triển (Dev Mode)
```bash
pnpm dev
```

### 4. Kiểm thử (Testing & Quality Assurance)
```bash
# Chạy bộ unit tests
pnpm test

# Kiểm tra kiểu TypeScript (Node + Web)
pnpm typecheck

# Chạy test Electron smoke với dữ liệu thực tế
pnpm test:electron
```

### 5. Đóng gói ứng dụng (Build & Package)
```bash
# Đóng gói bản cài đặt Windows (NSIS Installer / Unpacked)
pnpm build:win

# Đóng gói cho macOS
pnpm build:mac

# Đóng gói cho Linux
pnpm build:linux
```

Sau khi hoàn tất, tệp cài đặt thực thi sẽ được xuất ra trong thư mục `dist/`.

---

## 📦 Cấu Trúc Gói Xuất Revision Package

Khi xuất phản hồi từ màn hình **Xuất gói**, FrameFlow tạo ra một thư mục chuẩn hóa:

```text
RevisionPackage_Draft_V2/
├── README.md               # Tổng quan về gói phản hồi
├── instructions.md         # Danh sách chỉ dẫn dạng Markdown cho Editor
├── review.json             # Toàn bộ dữ liệu phản hồi dạng JSON cho công cụ tự động / AI Agent
├── frames/                 # Ảnh chụp gốc trích từ video tại timestamp
│   ├── R001.jpg
│   └── R002.jpg
└── annotated/              # Ảnh kèm hình vẽ chú thích trực quan
    ├── R001.png
    └── R002.png
```

---

## 📄 Giấy Phép (License)

Dự án được phát hành theo giấy phép [MIT](LICENSE). Toàn quyền sử dụng và tùy biến cho mục đích cá nhân cũng như thương mại.
