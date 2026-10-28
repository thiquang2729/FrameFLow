# Xem và đánh giá SRC bằng video — triển khai bước đầu

## Cách sử dụng

1. Chạy `pnpm dev` để chuẩn bị CLIProxyAPI và FFmpeg/FFprobe đi kèm, sau đó mở ứng dụng.
2. Vào **Kết nối AI** và đăng nhập Antigravity.
3. Trong **Thư viện SRC**, chọn video rồi bấm **Xem và đánh giá SRC**.
4. Chọn model từ catalog Gemini thực tế, chọn khoảng thời gian tối đa **60 giây**.
5. Đọc xác nhận gửi video/âm thanh và sử dụng hạn mức. Chỉ khi bấm **Phân tích video**, backend mới đọc nội dung video để gửi lên AI.
6. Xem các segment và issue, bấm timestamp để seek trong video gốc. Chọn các lần phân tích trước để đối chiếu. Tag và nhận xét người dùng được lưu riêng với kết quả AI.

Nếu chỉ cần chuẩn bị media tools: `pnpm media:prepare`. Công cụ được tải lúc chuẩn bị dev/build, không tự tải khi mở bản ứng dụng đã đóng gói. Windows x64 và Linux x64 có cấu hình chuẩn bị binary; nền tảng khác chưa có bundle và sẽ báo thiếu công cụ. Chưa kiểm tra thực thi trên các nền tảng này.

Nếu tệp nguồn bị di chuyển/không phát được: nút **Liên kết lại tệp** ở bảng chi tiết SRC mở hộp thoại chọn tệp. Lịch sử phân tích vẫn giữ, được đánh dấu stale khi file identity thay đổi.

## Phạm vi thật sự đã viết

- Trình xem ảnh/video dạng dialog lớn, video controls và chọn khoảng thời gian.
- FFprobe đọc metadata kỹ thuật, gồm FPS trung bình; không tuyên bố exact frame hoặc phân loại VFR chỉ từ metadata này.
- Gửi một đoạn video thật qua Gemini native API, không gửi ảnh thay thế.
- Mỗi lần chỉ có một tác vụ phân tích video trong ứng dụng. Có hủy; tác vụ phiên trước bị gián đoạn được đánh dấu INTERRUPTED khi mở SRC của dự án.
- Lưu analysis run, segment, issue, AI tag, đánh giá và tag người dùng bằng migration `src-analysis-v1`.
- Technical/Editorial score riêng cho từng segment. Không tạo điểm tổng thay thế và không tự nhận diện người.
- Tiêu chí `src-video-v2-visual-only`: chỉ chấm hình ảnh, bỏ âm thanh/tạp âm và không trừ điểm chỉ vì footage xoay 90°/270° có thể chỉnh hướng ở hậu kỳ. Video gửi đi có thể vẫn chứa audio gốc, nhưng audio score luôn null và AUDIO issue không được công bố. Không sửa file gốc. Kết quả prompt cũ được đánh dấu cần phân tích lại; không tự viết lại điểm lịch sử.
- Menu ba chấm từng SRC có **Xóa khỏi thư viện**, kèm xác nhận. Tác vụ của SRC đó được hủy trước khi xóa source/analysis/segment/issue/tag trong một transaction. Không unlink footage gốc, thumbnail hoặc media đang được dùng chung.
- File identity gồm hash đường dẫn, kích thước, mtime và ctime; **không phải content hash**. File/brief thay đổi tạo cảnh báo stale; không ghi đè lịch sử.

Thư viện SRC hiển thị lưới/list, điểm KT/BT và tag trên thumbnail, bảng xem video và đánh giá bên phải. Điểm thumbnail lấy từ segment đầu của lần phân tích hoàn tất gần nhất, không phải điểm chung toàn clip; tooltip ghi phạm vi thời gian. Bảng chất lượng cho phép chọn segment, xem các điểm thành phần, vấn đề theo timestamp và gợi ý sử dụng. Kết quả stale/bị bác bỏ không được dùng làm điểm lọc/xếp hạng.

Bộ lọc hỗ trợ ngưỡng kỹ thuật/biên tập, loại cảnh, tag, vấn đề và thời lượng. Tìm kiếm cục bộ gồm tên/đường dẫn, summary và tag AI khả dụng. Thẻ của người dùng được lưu riêng. Không tạo ảnh/điểm/tag mẫu để lấp giao diện khi chưa có dữ liệu.

Chưa triển khai: tự chia và phân tích toàn bộ video dài, batch queue, resume chunk, tìm kiếm ngữ nghĩa, source_library.json export và sinh lại thumbnail sau relink. Không coi đây là hoàn tất toàn bộ kế hoạch SRC Intelligence.

## Protocol và trạng thái xác minh

Đã đọc source CLIProxyAPI **v8.0.45**:

- `internal/api/server_routes.go`: route `/v1beta/models/*action` tới Gemini handler.
- `sdk/api/handlers/gemini/gemini_handlers.go`: hỗ trợ `generateContent`.
- `internal/translator/antigravity/gemini/antigravity_gemini_request.go`: `ConvertGeminiRequestToAntigravity` bọc request Gemini trong envelope, giữ `contents` và `inlineData` cho lượt user thông thường.

Adapter dùng:

```text
POST http://127.0.0.1:<cổng-proxy-app>/v1beta/models/<model-id>:generateContent
contents[].parts[].inlineData = { mimeType: "video/...", data: "<base64 video>" }
```

Đây là **bằng chứng đường xử lý ở source**, không phải bằng chứng tài khoản Antigravity/upstream nhận được video. Catalog Gemini cũng không xác minh năng lực video/audio. Mọi model trong danh sách là ứng viên, không phải đã xác nhận hỗ trợ.

UI giữ trạng thái tuyến video chưa được xác minh độc lập. Backend không mặc định hai tên “3.8 Flash” và “4 Argon” là ID API. Nếu proxy/model từ chối request, tác vụ thất bại và hiển thị lỗi; **không fallback ảnh, Chat Completions hoặc provider khác**.

Phản hồi phải khai báo `videoObserved=true` trước khi được lưu, nhưng khai báo đó vẫn là tự báo cáo của model, **không nâng capability thành VERIFIED**. Cần một lần kiểm tra với video có nội dung biết trước, được người dùng cho phép và đối chiếu thủ công, trước khi mở rộng batch pipeline.

## Giới hạn video và chất lượng đánh giá

- Đầu vào tối đa 12 MiB cho mỗi request. Proxy app nâng body cap lên 20 MiB để chứa base64/JSON. Phải khởi động lại app để cấu hình mới có hiệu lực.
- Toàn file MP4/M4V/MOV/WebM phù hợp giới hạn được gửi nguyên bản.
- Chọn một phần file hoặc file quá lớn: tạo clip MPEG-4/AAC tối đa 1280×720 bằng FFmpeg; không thay đổi file gốc.
- Bản chuyển mã có thể bị upstream từ chối nếu không hỗ trợ codec/container. Không coi định dạng xuất ra là đã được xác minh chạy được.
- Metadata giới hạn container MOV/MP4, Matroska/WebM và AVI; không mở playlist hoặc network protocol trong FFmpeg.
- Điểm kỹ thuật của bản chuyển mã **chỉ phản ánh bản proxy**, không khẳng định độ nét/nén của bản gốc. UI lưu và hiển thị giới hạn này.
- Timestamp AI tương đối với đoạn đã gửi được kiểm tra và cộng offset để trở về video gốc. Cắt/chuyển mã có sai số khung hình/giải mã, chưa hứa frame-accurate.
- Audio score luôn null theo yêu cầu chỉ đánh giá hình ảnh; không hiển thị thanh điểm âm thanh hoặc bộ lọc lỗi AUDIO. Các nhận xét âm thanh cũ vẫn được giữ trong database lịch sử nhưng không hiển thị dưới dạng AUDIO issue; văn bản và điểm cũ có thể vẫn phản ánh tiêu chí trước đây nên cần phân tích lại.
- Request AI timeout 180 giây; FFprobe 30 giây, chuyển mã tối đa 180 giây. Đoạn gần cuối của video rất dài có thể timeout do giải mã chính xác từ đầu, cần tối ưu tiếp sau khi xác minh tuyến video.
- Kết quả phải là JSON đúng cấu trúc, không bị cắt, có timestamp/score hợp lệ. Không lưu segment một phần nếu request lỗi/hủy.

## Dữ liệu và vòng đời

- Media chỉ được đọc từ SourceAsset đã được kiểm tra project ownership ở backend. IPC renderer không nhận token hoặc proxy key.
- Video và âm thanh được gửi tới upstream khi người dùng xác nhận, cùng brief dự án; không chỉ xử lý local.
- File gốc không bị ghi đè; clip tạm nằm trong `<project>/analysis-cache/<run-id>/` và dọn khi tác vụ kết thúc bình thường.
- Cache không được trỏ ra ngoài project bằng symlink/junction.
- Thoát app bình thường hủy tác vụ trước khi dừng proxy. Nếu app bị kill/crash, file cache của tác vụ có thể còn; chưa tự xóa cache cũ hoặc có watchdog riêng cho FFmpeg.
- Kết quả AI là dữ liệu hiển thị dạng text, không thực thi HTML/lệnh.
- Các bảng mới khai báo FK; không bật `PRAGMA foreign_keys` toàn cục cho dữ liệu cũ trong đợt này. Service kiểm tra ownership, tồn tại source/run và lưu kết quả transactionally. Rà soát/bật enforcement toàn DB là việc còn lại trước hardening.

## Bundle và giấy phép media tools

Script pin BtbN release `autobuild-2026-10-27-18-38`, FFmpeg `n8.1.3-24-g92611900bb`, bản **LGPL shared**, kiểm tra archive SHA-256 và tạo manifest file checksum. Giữ DLL/shared libraries, license, tài liệu upstream và source notice trong resources. Không phụ thuộc GPL libx264; chuyển mã bằng MPEG-4 native/AAC.

Checksum runtime đối chiếu manifest đi kèm, không thay thế code signing. Trước khi phân phối công khai phải rà soát LGPL, build configuration, nghĩa vụ cung cấp corresponding source của FFmpeg và các thư viện phụ thuộc. Chưa tuyên bố bundle này đã hoàn tất audit pháp lý/phát hành.

## Kiểm tra đã thực hiện

Chỉ kiểm tra kiểu TypeScript; không chạy unit/integration/Electron test, không chạy phân tích video thật, không gửi footage hoặc đăng nhập thử và không commit theo yêu cầu người dùng. Build/runtime/media binary và upstream video vẫn cần được xác nhận riêng khi người dùng cho phép.
