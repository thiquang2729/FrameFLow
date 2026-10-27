# FrameFlow — Document Assessment & Project Planning

> **Phiên bản:** 0.1  
> **Ngày tạo:** 27/10/2026  
> **Nguồn tham chiếu:** `doc/Tai_lieu_thiet_ke_AI_Video_Review_SRC_Intelligence.docx` + UI mockups (`UI/`)

---

## Mục lục

- [1. Document Assessment](#1-document-assessment)
  - [1.1. Tóm tắt sản phẩm](#11-tóm-tắt-sản-phẩm)
  - [1.2. Các module chính trong DOCX](#12-các-module-chính-trong-docx)
  - [1.3. Requirement thuộc MVP V0.1](#13-requirement-thuộc-mvp-v01)
  - [1.4. Requirement bị trì hoãn](#14-requirement-bị-trì-hoãn)
  - [1.5. Rủi ro kỹ thuật từ tài liệu](#15-rủi-ro-kỹ-thuật-từ-tài-liệu)
  - [1.6. Đề xuất thay đổi so với thiết kế gốc](#16-đề-xuất-thay-đổi-so-với-thiết-kế-gốc)
  - [1.7. Assumptions](#17-assumptions)
- [2. Repo Assessment](#2-repo-assessment)
- [3. Phân loại Requirement](#3-phân-loại-requirement)
  - [3.1. MVP V0.1 — IMPLEMENT NOW](#31-mvp-v01--implement-now)
  - [3.2. Next Phase — DESIGN FOR, DO NOT IMPLEMENT](#32-next-phase--design-for-do-not-implement)
  - [3.3. Future — OUT OF SCOPE](#33-future--out-of-scope)
- [4. Requirement Traceability](#4-requirement-traceability)
- [5. Database Review](#5-database-review)
  - [5.1. Bảng cần ngay cho V0.1](#51-bảng-cần-ngay-cho-v01-7-bảng)
  - [5.2. Bảng nên chuẩn bị schema](#52-bảng-nên-chuẩn-bị-schema)
  - [5.3. Bảng chưa nên tạo](#53-bảng-chưa-nên-tạo)
- [6. Architecture Proposal](#6-architecture-proposal)
  - [6.1. Tech Stack](#61-tech-stack)
  - [6.2. Architecture Pattern](#62-architecture-pattern)
- [7. Folder Structure](#7-folder-structure)
- [8. Task Breakdown](#8-task-breakdown)
  - [Milestone 1: Foundation](#milestone-1-foundation-task-fnd)
  - [Milestone 2: Project Management](#milestone-2-project-management-task-prj)
  - [Milestone 3: Video Player + Review Core](#milestone-3-video-player--review-core-task-ply--task-rev-)
  - [Milestone 4: Frame Capture + Annotation](#milestone-4-frame-capture--annotation-task-cap--task-ann-)
  - [Milestone 5: SRC Library Basic](#milestone-5-src-library-basic-task-src)
  - [Milestone 6: Revision Package Export](#milestone-6-revision-package-export-task-exp-)
  - [Milestone 7: Review Workspace Integration](#milestone-7-review-workspace-integration-task-int)
- [9. Dependency Graph](#9-dependency-graph)
- [10. Milestones & Definition of Done](#10-milestones--definition-of-done)
- [11. Technical Risks & Mitigations](#11-technical-risks--mitigations)

---

## 1. Document Assessment

### 1.1. Tóm tắt sản phẩm

**FrameFlow** là một **AI-assisted post-production workspace** — KHÔNG phải video editor. Sản phẩm đóng vai trò làm lớp trung gian giữa con người và AI Agent/Codex, biến quá trình review video và quản lý footage thành dữ liệu có cấu trúc.

**Giá trị cốt lõi:** Biến các feedback mơ hồ kiểu "đoạn này chưa ổn" thành dữ liệu chính xác với timestamp, frame capture, annotation trực quan, rồi đóng gói gửi cho AI agent sửa.

**Ba lõi chức năng (từ DOCX):**

| Lõi | Vai trò |
|-----|---------|
| SRC Intelligence | AI xem footage gốc, chia đoạn semantic, mô tả nội dung, phát hiện lỗi kỹ thuật, chấm điểm và tạo thư viện SRC có thể tìm kiếm |
| Review Workspace | Review bản dựng theo đúng timestamp/frame, ghi nhận xét, vẽ trực tiếp lên khung hình và theo dõi trạng thái từng feedback |
| Agent Bridge | Đóng gói project context, SRC intelligence, review notes, annotated frames và editing preferences thành gói dữ liệu có cấu trúc cho Agent/Codex |

**Workflow end-to-end (8 bước):**

1. **Import SRC** — Nhận footage, tạo proxy/thumbnail/waveform/metadata/hash
2. **SRC Intelligence** — AI phân tích theo segment: mô tả, điểm kỹ thuật, điểm editorial, lỗi, recommended use
3. **Project Brief** — User khai báo mục tiêu video, platform, duration, style, references
4. **Agent Edit** — Agent/Codex đọc brief + SRC Library → tạo Draft V1
5. **Video Review** — User xem draft, tạo comment theo timestamp/frame
6. **Visual Feedback** — User vẽ arrow/rectangle/circle/text lên frame (không phá ảnh gốc)
7. **Export to Agent** — App tạo Revision Package (review.json, frames, annotations, context, preferences)
8. **Fix & Memory** — Agent sửa thành V2/V3, user kiểm tra Fixed/Partial/Still wrong

### 1.2. Các module chính trong DOCX

| # | Module | Mô tả |
|---|--------|--------|
| 1 | **SRC Intelligence** | AI phân tích footage gốc theo segment, chấm điểm technical/editorial, phát hiện lỗi, tag, tạo thư viện searchable |
| 2 | **Review Workspace** | Xem video draft, tạo comment theo timestamp/frame, capture frame, vẽ annotation, theo dõi status |
| 3 | **Agent Bridge** | Đóng gói context + review + SRC + preferences thành Revision Package cho Agent/Codex |
| 4 | **Project Dashboard** | Tổng quan project: status, SRC count, versions, open reviews, quick actions |
| 5 | **Edit Versions** | Quản lý Draft V1/V2/V3, lineage giữa các version |
| 6 | **Editing Memory** | Lưu trữ editing preferences đã được user xác nhận (pattern detection → user confirm) |
| 7 | **Version Compare** | Phát đồng bộ 2 version, so sánh trạng thái Fixed/Partial/Still wrong |

### 1.3. Requirement thuộc MVP V0.1

Dựa trên tài liệu DOCX (đặc biệt phần kết luận: *"Nếu bắt đầu code, nên ưu tiên Video Review Workspace trước"*) kết hợp với prompt:

- ✅ Tạo/quản lý Project local
- ✅ Import video (draft version)
- ✅ Video player (play/pause/seek/frame step)
- ✅ Tạo comment tại timestamp chính xác
- ✅ Capture frame tại thời điểm comment
- ✅ Gắn category, priority, status cho comment
- ✅ Vẽ annotation lên frame (arrow, rectangle, circle, text)
- ✅ Timeline markers hiển thị vị trí feedback
- ✅ Quản lý EditVersion (V1 → V2 → V3)
- ✅ Theo dõi trạng thái comment (OPEN → FIXED/PARTIAL/REJECTED)
- ✅ SQLite persistence
- ✅ Revision Package Export (review.json, frames/, annotated/, instructions)
- ✅ Import SRC cơ bản (file metadata, không AI analysis)
- ✅ Project folder structure (project.db, source/, frames/, annotations/, versions/, exports/)

### 1.4. Requirement bị trì hoãn

**Next Phase (thiết kế schema, không implement):**

- SRC Intelligence (AI analysis, scoring, segment)
- SourceSegment, SourceAnalysis, SourceIssue, SourceTag
- Natural language SRC search
- Version Compare (sync playback)
- Quality scoring (technical + editorial)
- ReviewStatusHistory tracking chi tiết
- Agent Task management UI

**Future (out of scope hoàn toàn):**

- Editing Memory nâng cao (pattern detection)
- Cloud collaboration / Team permissions
- Mobile app
- Direct CapCut/Premiere integration
- Automated AI video editing
- AI-suggested fixes
- PreferenceRule inference engine

### 1.5. Rủi ro kỹ thuật từ tài liệu

| # | Rủi ro | Mức độ | Giải pháp đề xuất |
|---|--------|--------|-------------------|
| 1 | **Video playback performance** — Phát video 4K trong Electron/Tauri có thể lag, đặc biệt khi seek frame-by-frame | HIGH | Dùng HTML5 `<video>` native, cân nhắc proxy/transcoded preview. Không tự build video decoder |
| 2 | **Frame capture chính xác** — Canvas capture từ video element có thể không khớp exact frame do codec keyframe | HIGH | Sử dụng `requestVideoFrameCallback` API hoặc ffmpeg extract frame ở backend |
| 3 | **Annotation rendering + persistence** — Lưu drawing objects dạng JSON, render lại chính xác trên nhiều resolution | MEDIUM | Canvas overlay riêng biệt, normalize coordinates theo % thay vì pixel absolute |
| 4 | **SQLite concurrent access** — Nếu dùng Electron, main process vs renderer process đều cần access DB | MEDIUM | Dùng better-sqlite3 ở main process, IPC cho renderer. Hoặc Drizzle ORM |
| 5 | **File size — SRC footage có thể hàng trăm GB** | MEDIUM | Chỉ lưu path reference, KHÔNG copy file vào project folder. Tạo proxy/thumbnail lazy |
| 6 | **Revision Package size** — source_library.json 1.8MB trong mockup | LOW | MVP chỉ include review.json + frames + annotated. Source library là Next Phase |

### 1.6. Đề xuất thay đổi so với thiết kế gốc

| # | Thiết kế gốc | Đề xuất thay đổi | Lý do |
|---|-------------|-------------------|-------|
| 1 | 14 tables trong SQLite | MVP chỉ tạo 7 tables: Project, SourceAsset, EditVersion, ReviewComment, ReviewAttachment, Annotation, RevisionPackage | Giảm complexity. Các table SRC Intelligence + Memory + AgentTask thêm sau |
| 2 | UUID/PK cho tất cả ID | Dùng ULID (sortable, URL-safe) thay vì UUID v4 | Sortable by time, ngắn hơn, không cần thêm created_at index |
| 3 | Navigation 7 mục (Overview, SRC Library, Edit Versions, Review, Agent, Memory, Export) | MVP chỉ cần 4 mục: Projects, Review, Versions, Export | Tránh UI trống cho các module chưa có chức năng |
| 4 | SRC Library với AI analysis ngay từ đầu | MVP: SRC Library chỉ là file browser với metadata kỹ thuật (duration, resolution, codec). Không AI | AI integration là Next Phase |
| 5 | Team members (JD, MK, AL trong mockup) | MVP: Single user, local project. Không có team/sharing | Collaboration là Future scope |
| 6 | `review.json` + `source_library.json` + `preferences.json` trong package | MVP: Chỉ `review.json` + `frames/` + `annotated/` + `instructions.md` + `README.md` | Đủ cho Agent revision. Source library và preferences thêm khi có SRC Intelligence + Memory |

### 1.7. Assumptions

- **A1:** Tài liệu không chỉ rõ platform target (Electron vs Tauri vs Web). **Assumption: Dùng Electron + React** vì cần filesystem access, video playback native, SQLite local.
- **A2:** "Proxy nếu cần" — tài liệu không định nghĩa khi nào cần proxy. **Assumption: MVP không tạo proxy. Phát file gốc trực tiếp.**
- **A3:** "Frame number nếu xác định được" — **Assumption: Dùng `currentTime * fps` để estimate frame number. Không parse video container để lấy exact frame index.**
- **A4:** Annotation `data_json` không có schema cụ thể. **Assumption: Dùng format `{type, x, y, width, height, color, strokeWidth, text?, points?[]}` normalized theo % viewport.**
- **A5:** Export format — tài liệu show cả JSON và Markdown. **Assumption: MVP export JSON primary, Markdown as README.md summary.**

---

## 2. Repo Assessment

### Hiện trạng

**Repo hoàn toàn trống.** Không có source code, package.json, config files, hay `.git`. Chỉ có:

```
FrameFlow/
├── doc/
│   └── Tai_lieu_thiet_ke_AI_Video_Review_SRC_Intelligence.docx
└── UI/
    ├── Ảnh ChatGPT 16_29_47 27 thg 10, 2026-1.png   (Overview - Dark)
    ├── Ảnh ChatGPT 16_29_47 27 thg 10, 2026-2.png   (SRC Library - Dark)
    ├── Ảnh ChatGPT 16_29_48 27 thg 10, 2026-3.png   (Review - Dark)
    ├── Ảnh ChatGPT 16_29_49 27 thg 10, 2026-4.png   (Export - Dark)
    ├── Ảnh ChatGPT 16_31_01 27 thg 10, 2026-1.png   (Overview - Light/VN)
    ├── Ảnh ChatGPT 16_31_02 27 thg 10, 2026-2.png   (SRC Library - Light/VN)
    ├── Ảnh ChatGPT 16_31_04 27 thg 10, 2026-3.png   (Review - Light/VN)
    └── Ảnh ChatGPT 16_31_05 27 thg 10, 2026-4.png   (Export - Light/VN)
```

→ Đây là **greenfield project** — cần thiết kế architecture từ đầu.

---

## 3. Phân loại Requirement

### 3.1. MVP V0.1 — IMPLEMENT NOW

| ID | Requirement | Chi tiết |
|----|-------------|----------|
| MVP-01 | Create/Open/Delete Project | Local project với SQLite DB, folder structure |
| MVP-02 | Import Video (EditVersion) | Import file video làm Draft V1/V2/V3 |
| MVP-03 | Video Player | Play/Pause/Seek, frame step (←/→), timestamp display, keyboard shortcuts |
| MVP-04 | Create Review Comment | Pause → tạo comment tại timestamp, chọn category + priority |
| MVP-05 | Frame Capture | Auto-capture frame khi tạo comment |
| MVP-06 | Annotation Drawing | Arrow, Rectangle, Circle, Text trên captured frame. Undo/Redo |
| MVP-07 | Comment List Panel | Danh sách comment theo timestamp, click để seek video |
| MVP-08 | Timeline Markers | Hiển thị marker tại vị trí có comment trên timeline |
| MVP-09 | Comment Status Tracking | OPEN → FIXED / PARTIAL / REJECTED |
| MVP-10 | EditVersion Management | Tạo/import version, lineage (V1 → V2 → V3) |
| MVP-11 | Import SRC (Basic) | Import footage files, lưu metadata kỹ thuật (duration, resolution, codec, size) |
| MVP-12 | Revision Package Export | Export review.json + frames/ + annotated/ + instructions.md + README.md |
| MVP-13 | SQLite Persistence | Tất cả data persist qua app restart |
| MVP-14 | Project Dashboard (Basic) | Hiển thị project info, current draft, open review count, recent feedback |
| MVP-15 | Keyboard Shortcuts | Space, C, D, ←/→, Shift+←/→, 1/2/3, Ctrl+Enter |

### 3.2. Next Phase — DESIGN FOR, DO NOT IMPLEMENT

| ID | Requirement | Nguồn |
|----|-------------|-------|
| NP-01 | SRC Intelligence (AI Analysis) | DOCX Ch.1.2, 1.4 |
| NP-02 | SourceSegment (clip segmentation) | DOCX Ch.1.4 |
| NP-03 | Quality Scoring (Technical + Editorial) | DOCX Table 8 |
| NP-04 | SRC Natural Language Search | DOCX Ch.2.3 |
| NP-05 | Version Compare (sync playback) | DOCX Ch.2.6 |
| NP-06 | ReviewStatusHistory (audit trail) | DOCX Table 26 |
| NP-07 | RevisionPackageItem (link package ↔ comments) | DOCX Table 28 |
| NP-08 | Agent Task Management | DOCX Table 30 |
| NP-09 | SRC Library Advanced Filters | DOCX Ch.2.3 |
| NP-10 | source_library.json + preferences.json trong package | DOCX Ch.3.4 |

### 3.3. Future — OUT OF SCOPE

| ID | Requirement | Nguồn |
|----|-------------|-------|
| FU-01 | Editing Memory (pattern detection → rule) | DOCX Ch.2.7 |
| FU-02 | PreferenceRule inference engine | DOCX Table 29 |
| FU-03 | Cloud Collaboration | Implied |
| FU-04 | Team Permissions / Multi-user | UI mockup (JD, MK, AL) |
| FU-05 | Mobile App | Implied |
| FU-06 | Direct CapCut/Premiere Integration | DOCX Ch.1.2 |
| FU-07 | Automated AI Video Editing | Implied |
| FU-08 | Proxy/Waveform Generation | DOCX Ch.1.2 |
| FU-09 | Project Brief Builder | DOCX Ch.1.2 step 3 |
| FU-10 | Locked Segments / Approved Regions | DOCX Table 12 |

---

## 4. Requirement Traceability

| Requirement | Nguồn | Phase | Module | Task dự kiến |
|---|---|---|---|---|
| Tạo/mở/xóa project local | DOCX + Prompt | V0.1 | Project | TASK-PRJ-001 |
| Project folder structure (source/, frames/, etc.) | DOCX Table 15 | V0.1 | Project | TASK-PRJ-002 |
| SQLite database setup + migrations | DOCX Ch.3.1 + Prompt | V0.1 | Database | TASK-DB-001 |
| Project table schema | DOCX Table 16 | V0.1 | Database | TASK-DB-002 |
| SourceAsset table (basic metadata) | DOCX Table 17 | V0.1 | Database | TASK-DB-003 |
| EditVersion table schema | DOCX Table 22 | V0.1 | Database | TASK-DB-004 |
| ReviewComment table schema | DOCX Table 23 | V0.1 | Database | TASK-DB-005 |
| ReviewAttachment table schema | DOCX Table 24 | V0.1 | Database | TASK-DB-006 |
| Annotation table schema | DOCX Table 25 | V0.1 | Database | TASK-DB-007 |
| RevisionPackage table schema | DOCX Table 27 | V0.1 | Database | TASK-DB-008 |
| Import video file làm EditVersion | DOCX Ch.1.2 step 1 + Prompt | V0.1 | Version | TASK-VER-001 |
| Version lineage (parent_version_id) | DOCX Table 22 | V0.1 | Version | TASK-VER-002 |
| Video player (play/pause/seek) | DOCX Ch.2.4 + Prompt | V0.1 | Player | TASK-PLY-001 |
| Frame-by-frame step (←/→) | DOCX Table 11 | V0.1 | Player | TASK-PLY-002 |
| Keyboard shortcuts | DOCX Table 11 | V0.1 | Player | TASK-PLY-003 |
| Tạo comment tại timestamp | DOCX Ch.2.4 + Prompt | V0.1 | Review | TASK-REV-001 |
| Category + Priority cho comment | DOCX Ch.2.4 | V0.1 | Review | TASK-REV-002 |
| Comment list panel (click → seek) | DOCX Table 10 | V0.1 | Review | TASK-REV-003 |
| Comment status tracking | DOCX Table 23 + Prompt | V0.1 | Review | TASK-REV-004 |
| Timeline markers | DOCX Table 10 | V0.1 | Review | TASK-REV-005 |
| Frame capture khi tạo comment | DOCX Ch.1.2 step 5 + Prompt | V0.1 | Capture | TASK-CAP-001 |
| Vẽ arrow lên frame | DOCX Ch.1.2 step 6 + Prompt | V0.1 | Annotation | TASK-ANN-001 |
| Vẽ rectangle lên frame | DOCX Ch.1.2 step 6 + Prompt | V0.1 | Annotation | TASK-ANN-002 |
| Vẽ circle lên frame | DOCX Ch.1.2 step 6 | V0.1 | Annotation | TASK-ANN-003 |
| Vẽ text lên frame | DOCX Ch.1.2 step 6 | V0.1 | Annotation | TASK-ANN-004 |
| Undo/Redo annotation | DOCX Table 10 | V0.1 | Annotation | TASK-ANN-005 |
| Color picker + size cho annotation | UI Mockup 3 | V0.1 | Annotation | TASK-ANN-006 |
| Lưu annotation dưới dạng JSON objects | DOCX Ch.1.2 step 6 + Table 25 | V0.1 | Annotation | TASK-ANN-007 |
| Import SRC cơ bản (metadata only) | DOCX Ch.1.2 step 1 | V0.1 | SRC | TASK-SRC-001 |
| SRC list view (grid/list) | DOCX Ch.2.3 | V0.1 | SRC | TASK-SRC-002 |
| Export Revision Package | DOCX Ch.1.2 step 7 + Ch.3.4 | V0.1 | Export | TASK-EXP-001 |
| review.json generation | DOCX Table 32 | V0.1 | Export | TASK-EXP-002 |
| README.md generation | UI Mockup 4 | V0.1 | Export | TASK-EXP-003 |
| instructions.md (user input) | DOCX Table 12 | V0.1 | Export | TASK-EXP-004 |
| Copy frames/ + annotated/ vào package | DOCX Table 31 | V0.1 | Export | TASK-EXP-005 |
| Project Dashboard cơ bản | DOCX Ch.2.2 + Prompt | V0.1 | Dashboard | TASK-DSH-001 |
| AI phân tích SRC | DOCX Ch.1.2 step 2 | Next Phase | SRC Intelligence | — |
| SourceAnalysis / SourceIssue / SourceSegment tables | DOCX Tables 18–20 | Next Phase | Database | — |
| SRC scoring (technical + editorial) | DOCX Table 8 | Next Phase | SRC Intelligence | — |
| Natural language SRC search | DOCX Ch.2.3 | Next Phase | SRC Intelligence | — |
| Version Compare sync playback | DOCX Ch.2.6 | Next Phase | Compare | — |
| ReviewStatusHistory | DOCX Table 26 | Next Phase | Review | — |
| Agent Task management | DOCX Table 30 | Next Phase | Agent | — |
| Editing Memory / PreferenceRule | DOCX Ch.2.7 + Table 29 | Future | Memory | — |
| Team / Collaboration | UI Mockup | Future | Collab | — |
| Project Brief Builder | DOCX Ch.1.2 step 3 | Future | Brief | — |
| Locked Segments | DOCX Table 12 | Future | Review | — |

---

## 5. Database Review

### 5.1. Bảng cần ngay cho V0.1 (7 bảng)

| Bảng | Lý do |
|------|-------|
| **Project** | Core entity, mọi thứ khác thuộc về project |
| **SourceAsset** | Import SRC cơ bản, lưu metadata file. Các field AI-related để NULL |
| **EditVersion** | Quản lý Draft V1/V2/V3, video_path, lineage |
| **ReviewComment** | Core review workflow — timestamp, category, priority, content, status |
| **ReviewAttachment** | Lưu frame capture + annotated frame paths |
| **Annotation** | Drawing objects (arrow, rect, circle, text) dạng JSON |
| **RevisionPackage** | Export package metadata |

#### Schema chi tiết (từ DOCX)

**Project:**

| Field | Type | Ý nghĩa |
|-------|------|----------|
| id | ULID/PK | Định danh project |
| name | TEXT | Tên project |
| description | TEXT | Mô tả |
| target_platform | TEXT | TikTok/Reels/YouTube... |
| target_duration | REAL | Thời lượng mục tiêu (giây) |
| aspect_ratio | TEXT | 9:16, 16:9... |
| status | TEXT | PLANNING/EDITING/REVIEW/FINAL |
| created_at | DATETIME | Ngày tạo |
| updated_at | DATETIME | Ngày cập nhật |

**SourceAsset:**

| Field | Type | Ý nghĩa |
|-------|------|----------|
| id | ULID/PK | Định danh SRC |
| project_id | FK | Project sở hữu |
| original_path | TEXT | Đường dẫn file gốc |
| proxy_path | TEXT | Proxy nếu có |
| filename | TEXT | Tên file |
| duration | REAL | Thời lượng |
| width | INTEGER | Chiều rộng |
| height | INTEGER | Chiều cao |
| fps | REAL | Frame rate |
| codec | TEXT | Codec |
| file_size | INTEGER | Kích thước file |
| file_hash | TEXT | Phát hiện duplicate |
| imported_at | DATETIME | Ngày import |

**EditVersion:**

| Field | Type | Ý nghĩa |
|-------|------|----------|
| id | ULID/PK | Định danh version |
| project_id | FK | Project |
| version_number | INTEGER | 1, 2, 3... |
| name | TEXT | Draft V2 |
| video_path | TEXT | File preview/export |
| duration | REAL | Thời lượng |
| fps | REAL | Frame rate |
| width | INTEGER | Chiều rộng |
| height | INTEGER | Chiều cao |
| parent_version_id | FK | Version trước |
| created_by | TEXT | USER/AGENT |
| created_at | DATETIME | Ngày tạo |

**ReviewComment:**

| Field | Type | Ý nghĩa |
|-------|------|----------|
| id | ULID/PK | R021... |
| project_id | FK | Project |
| edit_version_id | FK | Version được review |
| timestamp | REAL | Giây tại comment |
| frame_number | INTEGER | Frame nếu có |
| category | TEXT | SUBTITLE/CUT/AUDIO... |
| priority | TEXT | LOW/MEDIUM/HIGH |
| content | TEXT | Nội dung feedback |
| status | TEXT | OPEN/FIXED/PARTIAL/REJECTED |
| created_by | TEXT | Người/Agent |
| created_at | DATETIME | Ngày tạo |
| resolved_at | DATETIME | Ngày resolve |

**ReviewAttachment:**

| Field | Type | Ý nghĩa |
|-------|------|----------|
| id | ULID/PK | Định danh file đính kèm |
| review_comment_id | FK | Review |
| type | TEXT | FRAME/ANNOTATED_FRAME/REFERENCE |
| file_path | TEXT | Đường dẫn |
| width | INTEGER | Chiều rộng |
| height | INTEGER | Chiều cao |
| created_at | DATETIME | Ngày tạo |

**Annotation:**

| Field | Type | Ý nghĩa |
|-------|------|----------|
| id | ULID/PK | Định danh object |
| review_comment_id | FK | Review |
| type | TEXT | ARROW/RECT/CIRCLE/TEXT |
| data_json | JSON/TEXT | Tọa độ và thuộc tính (normalized %) |
| created_at | DATETIME | Ngày tạo |

**RevisionPackage:**

| Field | Type | Ý nghĩa |
|-------|------|----------|
| id | ULID/PK | Định danh package |
| project_id | FK | Project |
| source_version_id | FK | Version nguồn |
| package_path | TEXT | Folder/file xuất |
| instructions | TEXT | Lệnh tổng quát |
| created_at | DATETIME | Ngày tạo |

### 5.2. Bảng nên chuẩn bị schema

Thiết kế migration file sẵn nhưng chưa chạy:

| Bảng | Lý do |
|------|-------|
| **SourceAnalysis** | SRC Intelligence — schema rõ trong DOCX |
| **SourceIssue** | Gắn với SourceAnalysis |
| **SourceSegment** | Gắn với SourceAnalysis |
| **SourceTag** | Filter/search SRC |
| **ReviewStatusHistory** | Audit trail — cần khi có Version Compare |
| **RevisionPackageItem** | Link package ↔ specific comments |

### 5.3. Bảng chưa nên tạo

| Bảng | Lý do |
|------|-------|
| **PreferenceRule** | Editing Memory là Future scope |
| **AgentTask** | Agent integration là Future scope |

### Quan hệ dữ liệu (ERD mức khái niệm)

```
Project 1──N SourceAsset
Project 1──N EditVersion
Project 1──N ReviewComment
Project 1──N RevisionPackage

EditVersion N──1 EditVersion (parent_version_id)

ReviewComment N──1 EditVersion
ReviewComment 1──N ReviewAttachment
ReviewComment 1──N Annotation

RevisionPackage N──1 EditVersion (source_version_id)
```

### Cấu trúc folder per project (từ DOCX)

```
MyProject/
├── project.db          # SQLite database
├── source/             # Raw footage files (hoặc symlinks)
├── proxy/              # Proxy files (Future)
├── thumbnails/         # Video thumbnails
├── frames/             # Captured frames (R021.jpg, R024.jpg...)
├── annotations/        # Annotated frames (R021.png, R024.png...)
├── versions/           # Draft video files
└── exports/            # Revision packages
    └── revision_V2_to_V3/
        ├── README.md
        ├── review.json
        ├── instructions.md
        ├── frames/
        └── annotated/
```

### Revision Package JSON format (từ DOCX)

```json
{
  "sourceVersion": "Draft V2",
  "targetVersion": "Draft V3",
  "reviews": [
    {
      "id": "R021",
      "timestamp": 17.42,
      "frame": 522,
      "category": "subtitle",
      "priority": "high",
      "comment": "Subtitle che mặt nhân vật. Đưa xuống và lệch trái.",
      "frameImage": "frames/R021.jpg",
      "annotationImage": "annotated/R021.png"
    }
  ]
}
```

### Enum/Status tiêu chuẩn (từ DOCX)

| Đối tượng | Enum đề xuất |
|-----------|-------------|
| ReviewComment | OPEN, IN_PROGRESS, FIXED, PARTIAL, REJECTED, NEED_REVIEW |
| AgentTask | PENDING, RUNNING, DONE, FAILED, CANCELLED |
| Project | PLANNING, INGESTING, EDITING, REVIEW, FINAL |
| Severity/Priority | LOW, MEDIUM, HIGH, CRITICAL (nếu cần) |

---

## 6. Architecture Proposal

### 6.1. Tech Stack

| Layer | Technology | Lý do |
|-------|-----------|-------|
| **Runtime** | Electron 33+ | Cần filesystem access, native video, SQLite. Tauri tốt nhưng Electron ecosystem mature hơn cho video apps |
| **Frontend** | React 19 + TypeScript | Component-based, excellent canvas/video APIs ecosystem |
| **Styling** | Tailwind CSS 4 + shadcn/ui | Nhanh, consistent, dark theme sẵn (match mockup blue accent) |
| **State** | Zustand | Lightweight, perfect cho desktop app, không boilerplate |
| **Database** | better-sqlite3 + Drizzle ORM | Sync SQLite (fast), type-safe queries, migration support |
| **Video** | HTML5 `<video>` + Canvas API | Native browser video, canvas overlay cho annotation |
| **Canvas Drawing** | Konva.js (react-konva) | Mature 2D canvas library, shapes/transforms/events built-in |
| **Build** | Vite + electron-vite | Fast HMR, modern bundling |
| **Package** | electron-builder | Cross-platform builds |

### 6.2. Architecture Pattern

```
┌─────────────────────────────────────────────────────┐
│                  Electron Main Process               │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ SQLite   │  │ File     │  │ IPC Bridge        │  │
│  │ Service  │  │ Service  │  │ (type-safe)       │  │
│  └──────────┘  └──────────┘  └───────────────────┘  │
├─────────────────────────────────────────────────────┤
│                  Electron Renderer                   │
│  ┌──────────────────────────────────────────────┐   │
│  │              React Application                │   │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────────┐  │   │
│  │  │ Zustand │ │ React    │ │ IPC Client   │  │   │
│  │  │ Stores  │ │ Router   │ │ (preload)    │  │   │
│  │  └─────────┘ └──────────┘ └──────────────┘  │   │
│  │  ┌─────────────────────────────────────────┐ │   │
│  │  │            UI Components                 │ │   │
│  │  │  Player │ Review │ Annotation │ Export   │ │   │
│  │  └─────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Tại sao kiến trúc này:**

- **Main process** giữ SQLite + File operations → thread-safe, không block UI
- **Renderer** chỉ làm UI → responsive
- **IPC Bridge** type-safe → không runtime errors khi gọi DB
- **Zustand stores** tách biệt per-module → dễ extend thêm SRC Intelligence, Memory sau này
- **Service layer** ở main process → dễ thêm AI service (Next Phase) mà không đụng UI

---

## 7. Folder Structure

```
FrameFlow/
├── doc/                              # Design document (existing)
├── UI/                               # Mockup images (existing)
├── src/
│   ├── main/                         # Electron main process
│   │   ├── index.ts                  # Entry point
│   │   ├── ipc/                      # IPC handlers
│   │   │   ├── project.ipc.ts
│   │   │   ├── review.ipc.ts
│   │   │   ├── version.ipc.ts
│   │   │   ├── source.ipc.ts
│   │   │   └── export.ipc.ts
│   │   ├── services/                 # Business logic
│   │   │   ├── project.service.ts
│   │   │   ├── review.service.ts
│   │   │   ├── version.service.ts
│   │   │   ├── source.service.ts
│   │   │   ├── capture.service.ts    # Frame capture via ffmpeg
│   │   │   └── export.service.ts     # Revision package builder
│   │   └── database/
│   │       ├── connection.ts         # SQLite connection manager
│   │       ├── schema.ts             # Drizzle schema definitions
│   │       └── migrations/           # SQL migration files
│   ├── preload/                      # Electron preload scripts
│   │   └── index.ts                  # Expose IPC to renderer
│   ├── renderer/                     # React frontend
│   │   ├── main.tsx                  # React entry
│   │   ├── App.tsx                   # Router + Layout
│   │   ├── stores/                   # Zustand stores
│   │   │   ├── project.store.ts
│   │   │   ├── player.store.ts
│   │   │   ├── review.store.ts
│   │   │   └── annotation.store.ts
│   │   ├── pages/                    # Route-level components
│   │   │   ├── ProjectList.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── ReviewWorkspace.tsx   # ⭐ Màn hình quan trọng nhất
│   │   │   ├── VersionList.tsx
│   │   │   ├── SourceLibrary.tsx
│   │   │   └── ExportPackage.tsx
│   │   ├── components/               # Reusable UI components
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── TopBar.tsx
│   │   │   │   └── AppShell.tsx
│   │   │   ├── player/
│   │   │   │   ├── VideoPlayer.tsx
│   │   │   │   ├── PlayerControls.tsx
│   │   │   │   ├── Timeline.tsx
│   │   │   │   └── TimelineMarkers.tsx
│   │   │   ├── review/
│   │   │   │   ├── CommentList.tsx
│   │   │   │   ├── CommentCard.tsx
│   │   │   │   ├── CommentForm.tsx
│   │   │   │   ├── ReviewPanel.tsx
│   │   │   │   └── StatusBadge.tsx
│   │   │   ├── annotation/
│   │   │   │   ├── AnnotationCanvas.tsx  # Konva stage
│   │   │   │   ├── DrawingToolbar.tsx
│   │   │   │   ├── shapes/
│   │   │   │   │   ├── ArrowShape.tsx
│   │   │   │   │   ├── RectShape.tsx
│   │   │   │   │   ├── CircleShape.tsx
│   │   │   │   │   └── TextShape.tsx
│   │   │   │   └── ColorPicker.tsx
│   │   │   ├── export/
│   │   │   │   ├── PackageBuilder.tsx
│   │   │   │   ├── CommentSelector.tsx
│   │   │   │   ├── PackagePreview.tsx
│   │   │   │   └── InstructionEditor.tsx
│   │   │   └── common/
│   │   │       ├── Badge.tsx
│   │   │       ├── Button.tsx
│   │   │       └── Modal.tsx
│   │   ├── hooks/                    # Custom React hooks
│   │   │   ├── useVideoPlayer.ts
│   │   │   ├── useKeyboardShortcuts.ts
│   │   │   ├── useAnnotation.ts
│   │   │   └── useIPC.ts
│   │   └── lib/                      # Utilities
│   │       ├── ipc-client.ts         # Type-safe IPC calls
│   │       ├── time.ts              # Timestamp formatting
│   │       └── constants.ts
│   └── shared/                       # Types shared main ↔ renderer
│       ├── types/
│       │   ├── project.ts
│       │   ├── review.ts
│       │   ├── annotation.ts
│       │   ├── version.ts
│       │   ├── source.ts
│       │   └── export.ts
│       └── ipc-channels.ts          # IPC channel definitions
├── resources/                        # Electron static assets
├── electron.vite.config.ts
├── package.json
├── tsconfig.json
└── tailwind.config.ts
```

**Thiết kế để mở rộng:**

- Thêm SRC Intelligence → thêm `src/main/services/analysis.service.ts` + `src/renderer/pages/SrcAnalysis.tsx`
- Thêm Editing Memory → thêm `src/main/services/memory.service.ts` + store + page
- Thêm Agent Bridge → thêm `src/main/services/agent.service.ts`
- Không cần refactor existing code

---

## 8. Task Breakdown

### Tiến độ triển khai — 27/10/2026

- Đã có scaffolding, schema 7 bảng, services/IPC và giao diện nền. Stack thực tế: React 18, Tailwind 3, `sql.js`; chưa dùng Drizzle/better-sqlite3 như đề xuất ban đầu.
- **Review Core đã nối dữ liệu thật:** chọn EditVersion, play/pause/seek, frame step ước tính, nhảy 5 giây, volume/fullscreen, tạo bình luận tại timestamp cố định, danh sách theo timestamp, chi tiết, lọc/cập nhật trạng thái và timeline markers.
- Phím tắt đã nối: Space, C, ←/→, Shift+←/→, Ctrl/Cmd+Enter. D dành cho annotation ở M4; 1/2/3 chỉ chọn ưu tiên khi không focus ô nhập liệu.
- Backend kiểm tra project–version, timestamp, nội dung, enums; sửa ID trùng khi xóa bình luận giữa danh sách và giữ frame 0.
- **Yêu cầu xác nhận:** ứng dụng local cho một người; không đăng nhập/tài khoản, nhóm, mời thành viên, chia sẻ cộng tác hay nhiều tác giả bình luận. Đã bỏ profile giả, avatar, nhóm và tên tác giả trên UI. Giữ field `created_by` hiện có để tương thích dữ liệu, không dùng làm hệ thống tài khoản.
- Kiểm thử tự động: `pnpm test` (ReviewService với SQLite thật: persistence khi mở lại, tách version, sort, frame 0, ID sau xóa, validation và trạng thái).
- **Bước tiếp theo:** M4 — capture frame tự động khi tạo bình luận, nối AnnotationCanvas/toolbar với ảnh thật và lưu annotation. Filmstrip thumbnail của TASK-PLY-003 và kiểm thử thao tác trực tiếp trong Electron vẫn chưa hoàn tất; chưa đánh dấu toàn bộ M3/MVP Done.

#### Checklist kiểm tra trực tiếp Review Core

1. Tạo/chọn dự án → Phiên bản → nhập MP4 H.264 → mở Review, chọn đúng phiên bản.
2. Phát/dừng, kéo seekbar, thử ←/→ và Shift+←/→; kiểm tra timestamp, âm lượng, fullscreen.
3. Nhấn C → nhập feedback, category/priority → Ctrl+Enter; bình luận xuất hiện đúng timestamp và marker.
4. Click bình luận/marker → video seek; đổi trạng thái → lọc theo trạng thái.
5. Đổi phiên bản/dự án → không lẫn bình luận; khởi động lại app → dữ liệu còn nguyên.
6. Thử phiên bản không có tệp hoặc codec không hỗ trợ → hiển thị lỗi; dự án chưa có video/bình luận → empty state, không dùng dữ liệu mẫu trong Review.

### Milestone 1: Foundation (TASK-FND)

| Task ID | Tên | Mô tả | Estimate |
|---------|-----|--------|----------|
| TASK-FND-001 | Project scaffolding | Electron + Vite + React + TypeScript setup | 1 session |
| TASK-FND-002 | Tailwind + shadcn/ui setup | Theme config (dark default, match mockup blue accent) | 0.5 session |
| TASK-FND-003 | SQLite + Drizzle setup | better-sqlite3, connection manager, migration runner | 1 session |
| TASK-FND-004 | Database schema V0.1 | 7 tables: Project, SourceAsset, EditVersion, ReviewComment, ReviewAttachment, Annotation, RevisionPackage | 1 session |
| TASK-FND-005 | IPC bridge setup | Type-safe IPC channels, preload script | 1 session |
| TASK-FND-006 | App shell + Router | Sidebar, top bar, routing (Projects, Review, Versions, Export) | 1 session |
| TASK-FND-007 | Shared types | TypeScript interfaces cho all entities | 0.5 session |

### Milestone 2: Project Management (TASK-PRJ)

| Task ID | Tên | Mô tả | Estimate |
|---------|-----|--------|----------|
| TASK-PRJ-001 | Create Project | Dialog tạo project (name, description, platform, duration, aspect_ratio), tạo folder structure + project.db | 1 session |
| TASK-PRJ-002 | Project List | Hiển thị danh sách projects, open/delete | 1 session |
| TASK-PRJ-003 | Project Dashboard (Basic) | Hiển thị project info, current draft, stats (SRC count, version count, open reviews) | 1 session |

### Milestone 3: Video Player + Review Core (TASK-PLY + TASK-REV) ⭐

| Task ID | Tên | Mô tả | Estimate |
|---------|-----|--------|----------|
| TASK-VER-001 | Import EditVersion | Import video file, extract metadata (duration, fps, resolution), save as version | 1 session |
| TASK-VER-002 | Version list + lineage | Hiển thị V1→V2→V3, select active version | 0.5 session |
| TASK-PLY-001 | Video Player component | HTML5 video, play/pause/seek, current time display | 1 session |
| TASK-PLY-002 | Player controls | Frame step (←/→), 5s skip (Shift+←/→), fullscreen, volume | 1 session |
| TASK-PLY-003 | Timeline component | Seekbar + timestamp markers + filmstrip thumbnail | 1 session |
| TASK-REV-001 | Create comment | Pause → chọn timestamp → nhập content, category, priority → save | 1 session |
| TASK-REV-002 | Comment list panel | Danh sách comments sorted by timestamp, click → seek video | 1 session |
| TASK-REV-003 | Review detail panel | Hiển thị chi tiết comment: timestamp, category, priority, status, content | 0.5 session |
| TASK-REV-004 | Comment status update | Dropdown OPEN/FIXED/PARTIAL/REJECTED | 0.5 session |
| TASK-REV-005 | Timeline markers | Điểm đánh dấu trên timeline tại mỗi comment position | 0.5 session |
| TASK-PLY-004 | Keyboard shortcuts | Space, C, D, ←/→, Shift+←/→, 1/2/3, Ctrl+Enter | 1 session |

### Milestone 4: Frame Capture + Annotation (TASK-CAP + TASK-ANN) ⭐

| Task ID | Tên | Mô tả | Estimate |
|---------|-----|--------|----------|
| TASK-CAP-001 | Frame capture | Capture current frame từ video → save JPG vào frames/ | 1 session |
| TASK-CAP-002 | Auto-capture khi tạo comment | Tự động capture + tạo ReviewAttachment khi comment mới | 0.5 session |
| TASK-ANN-001 | Annotation canvas setup | Konva stage overlay trên captured frame image | 1 session |
| TASK-ANN-002 | Arrow tool | Vẽ mũi tên, drag start→end | 1 session |
| TASK-ANN-003 | Rectangle tool | Vẽ hình chữ nhật, drag to resize | 0.5 session |
| TASK-ANN-004 | Circle tool | Vẽ hình tròn/ellipse | 0.5 session |
| TASK-ANN-005 | Text tool | Click to place, nhập text | 0.5 session |
| TASK-ANN-006 | Drawing toolbar | Tool selection, color picker, stroke size | 0.5 session |
| TASK-ANN-007 | Undo/Redo | History stack cho annotation actions | 0.5 session |
| TASK-ANN-008 | Save annotation | Serialize Konva objects → JSON → SQLite Annotation table | 0.5 session |
| TASK-ANN-009 | Export annotated frame | Render Konva stage → PNG, save to annotations/ folder | 0.5 session |

### Milestone 5: SRC Library Basic (TASK-SRC)

| Task ID | Tên | Mô tả | Estimate |
|---------|-----|--------|----------|
| TASK-SRC-001 | Import SRC files | Select folder/files → extract metadata → save SourceAsset records | 1 session |
| TASK-SRC-002 | SRC grid view | Thumbnail grid hiển thị filename, duration, resolution, size | 1 session |
| TASK-SRC-003 | SRC detail panel | Click → hiển thị metadata chi tiết, preview playback | 0.5 session |

### Milestone 6: Revision Package Export (TASK-EXP) ⭐

| Task ID | Tên | Mô tả | Estimate |
|---------|-----|--------|----------|
| TASK-EXP-001 | Export page UI | Source version → Target version, comment table với include toggles | 1 session |
| TASK-EXP-002 | Comment selector | Filter by priority/status, select/deselect comments cho export | 0.5 session |
| TASK-EXP-003 | Generate review.json | Build JSON structure theo DOCX format (id, timestamp, frame, category, priority, comment, frameImage, annotationImage) | 1 session |
| TASK-EXP-004 | Generate README.md | Summary markdown với project context, instructions | 0.5 session |
| TASK-EXP-005 | Instructions editor | Textarea cho user nhập instructions gửi agent | 0.5 session |
| TASK-EXP-006 | Build package folder | Copy frames/ + annotated/ + generate review.json + README.md + instructions.md → exports/ folder | 1 session |
| TASK-EXP-007 | Package preview | Hiển thị file list + sizes trước khi export (match mockup 4) | 0.5 session |

### Milestone 7: Review Workspace Integration (TASK-INT)

| Task ID | Tên | Mô tả | Estimate |
|---------|-----|--------|----------|
| TASK-INT-001 | ReviewWorkspace page assembly | Ghép Player + CommentList + ReviewPanel + AnnotationCanvas thành layout 3-panel (match mockup 3) | 1 session |
| TASK-INT-002 | Workflow integration test | E2E: Import video → Play → Pause → Comment → Capture → Annotate → Save → Export package | 1 session |
| TASK-INT-003 | Polish + edge cases | Empty states, error handling, loading states, responsive layout | 1 session |

**Tổng ước tính: ~30 sessions**

---

## 9. Dependency Graph

```
TASK-FND-001 (Scaffolding)
  ├── TASK-FND-002 (Tailwind)
  ├── TASK-FND-003 (SQLite) ──► TASK-FND-004 (Schema)
  ├── TASK-FND-005 (IPC)
  ├── TASK-FND-006 (App Shell)
  └── TASK-FND-007 (Types)
         │
         ▼
┌── TASK-PRJ-001/002/003 (Project) ◄── cần Schema + IPC + Shell
│
├── TASK-VER-001/002 (Versions) ◄── cần Project
│     │
│     ▼
├── TASK-PLY-001/002/003 (Player) ◄── cần Version (để biết video path)
│     │
│     ▼
├── TASK-REV-001~005 (Review) ◄── cần Player (timestamp), Version
│     │
│     ▼
├── TASK-CAP-001/002 (Capture) ◄── cần Player + Review
│     │
│     ▼
├── TASK-ANN-001~009 (Annotation) ◄── cần Capture (frame image)
│
├── TASK-SRC-001~003 (SRC) ◄── cần Project (song song với Player/Review)
│
└── TASK-EXP-001~007 (Export) ◄── cần Review + Annotation hoàn chỉnh
       │
       ▼
  TASK-INT-001~003 (Integration) ◄── cần tất cả modules
```

**Critical Path:** `FND → PRJ → VER → PLY → REV → CAP → ANN → EXP → INT`

**Parallel tracks:**

- SRC Library có thể phát triển song song với Player/Review
- Annotation tools (ANN-002~005) có thể phát triển song song với nhau

---

## 10. Milestones & Definition of Done

### Per-milestone

| Milestone | Deliverable | Definition of Done |
|-----------|------------|-------------------|
| **M1: Foundation** | App chạy được, mở ra thấy shell + sidebar + empty router | Electron window hiển thị, SQLite connected, navigation works |
| **M2: Project** | Tạo project, thấy dashboard | Create project → folder created → project.db exists → dashboard shows info |
| **M3: Review Core** ⭐ | Import video → play → comment → list | Import .mp4 → player plays → pause → create comment → comment appears in list → click comment seeks video |
| **M4: Annotation** ⭐ | Frame capture + draw + save | Comment created → frame captured → draw arrow/rect on frame → save → reopen → annotation preserved |
| **M5: SRC Basic** | Import footage → browse | Select folder → files imported → grid shows thumbnails + metadata |
| **M6: Export** ⭐ | Tạo revision package hoàn chỉnh | Select comments → configure → export → folder contains review.json + frames/ + annotated/ + README.md + instructions.md |
| **M7: Integration** | Full workflow E2E | Cameraman footage → Import → Create version → Review → Annotate → Export package → Package readable by AI agent |

### MVP V0.1 — Definition of Done tổng thể

- [ ] Tạo project local với folder structure
- [ ] Import video file làm Edit Version
- [ ] Video player hoạt động (play/pause/seek/frame step)
- [ ] Tạo review comment tại timestamp chính xác
- [ ] Auto-capture frame khi tạo comment
- [ ] Vẽ annotation (arrow, rect, circle, text) lên captured frame
- [ ] Comment list hiển thị + click to seek
- [ ] Timeline markers tại vị trí comment
- [ ] Comment status tracking (OPEN/FIXED/PARTIAL/REJECTED)
- [ ] Keyboard shortcuts hoạt động
- [ ] Import SRC files (metadata only)
- [ ] Export Revision Package (review.json + frames/ + annotated/)
- [ ] Tất cả data persist qua app restart (SQLite)
- [ ] App chạy trên Windows (primary), macOS (secondary)

---

## 11. Technical Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Video seek không chính xác (keyframe issues) | HIGH | MEDIUM | Dùng `video.currentTime` + `requestVideoFrameCallback`. Nếu cần exact frame, fallback ffmpeg |
| Canvas annotation không align với video resolution | MEDIUM | HIGH | Normalize tọa độ theo % (0–1), scale khi render. Test trên 720p, 1080p, 4K |
| Electron bundle size quá lớn (>200MB) | MEDIUM | LOW | Dùng electron-builder asar, exclude dev deps. Consider Tauri nếu size critical |
| better-sqlite3 native module build issues | MEDIUM | MEDIUM | Pin version, prebuild binaries, test trên CI trước |
| Video codec không supported (HEVC/AV1) | MEDIUM | MEDIUM | Document supported formats (H.264 primary). Suggest ffmpeg transcode cho unsupported |
| Large project (>100 comments) performance | LOW | LOW | Virtual list cho comment panel, lazy load frames |

---

## UI Reference (Mockup Summary)

Tham khảo 8 hình PNG trong thư mục `UI/`:

| Màn hình | File (Dark) | Mô tả |
|----------|-------------|-------|
| **Overview / Dashboard** | `Ảnh ChatGPT 16_29_47...1.png` | Project name, status "Đang duyệt", 128 SRC clips, 3 versions, 5 open reviews, current draft V3, recent feedback list, project goals, milestones, team |
| **SRC Library** | `Ảnh ChatGPT 16_29_47...2.png` | Grid view 128 clips (245.6 GB), filter chips (score ≥8, Ổn định, B-roll, Ngoài trời, Người: Quang), AI quality score badges, right panel: AI Summary + Quality breakdown + Issues + Best Use + AI Tags |
| **Review Workspace** ⭐ | `Ảnh ChatGPT 16_29_48...3.png` | 3-panel layout. Left: comment list (5 items). Center: video player + timeline + filmstrip + audio track + comment markers. Right: review note details + captured frame with annotations + drawing tools (Pen, Arrow, Rect, Circle, Text, Undo/Redo) + color picker + size |
| **Export / Revision Package** | `Ảnh ChatGPT 16_29_49...4.png` | Source V2 → Target V3, comment table with priority/status/include toggles, package preview sidebar (README.md, review.json, source_library.json, preferences.json, frames/, annotated/), instructions textarea |

> **Lưu ý:** Các mockup chỉ là DESIGN REFERENCE. MVP không yêu cầu pixel-perfect. Ưu tiên workflow > usability > architecture > persistence > UI gần thiết kế > animation/polish.

---

## Quyết định thiết kế cần giữ từ đầu (từ DOCX)

1. **Review luôn gắn với đúng EditVersion.** Timestamp 00:17.420 trong V2 ≠ cùng nội dung với 00:17.420 trong V3.
2. **Annotation lưu dưới dạng object riêng, không phá ảnh gốc.**
3. **SRC được phân tích theo segment, không chỉ theo file** (áp dụng khi implement SRC Intelligence).
4. **Technical score và Editorial score là hai khái niệm khác nhau.**
5. **Agent nhận dữ liệu có cấu trúc; không phụ thuộc vào một đoạn prompt dài duy nhất.**
6. **Editing Memory chỉ lưu rule đã được người dùng xác nhận.**
7. **Media nằm ngoài database; SQLite lưu metadata, quan hệ và lịch sử.**
