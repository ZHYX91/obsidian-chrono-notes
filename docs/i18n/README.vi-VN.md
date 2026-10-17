# Chrono Notes

[English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português](README.pt-BR.md) · [Русский](README.ru-RU.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Tiếng Việt](README.vi-VN.md) · [العربية](README.ar.md) · [فارسی](README.fa.md) · [עברית](README.he.md) · [አማርኛ](README.am.md) · [हिन्दी](README.hi.md)

Chrono Notes bổ sung cho Obsidian một không gian lịch để quản lý ghi chú định kỳ, công việc, ngày lễ khu vực, sự kiện trên máy và ghi chú theo khoảng ngày.

## Tính năng

- Xem lịch theo tuần, tháng, năm và thế kỷ, kèm trạng thái ghi chú, công việc, thống kê và xem trước.
- Ghi chú ngày, tuần, tháng, quý, năm, thập kỷ và thế kỷ với mẫu tích hợp hoặc Templater.
- Điều hướng giữa các ghi chú, theo dõi tiến độ công việc, bản đồ nhiệt và ghi chú cho khoảng ngày đã chọn.
- Hỗ trợ lịch âm Trung Quốc, can chi, lịch Ba Tư, Ethiopia, Do Thái, Ấn Độ, Hồi giáo và ngày nghỉ ở Trung Quốc đại lục, Singapore.
- Đọc tệp ICS trên máy ở chế độ chỉ đọc. Có thể thay đổi cách hiển thị thuộc tính ngày mà không sửa giá trị YAML.

## Yêu cầu và khả năng tương thích

Yêu cầu Obsidian 1.12.7 trở lên trên máy tính hoặc thiết bị di động. Tệp ICS trong Vault dùng được trên các nền tảng tương thích; đường dẫn ngoài Vault chỉ dùng trên máy tính. Lịch bổ sung phụ thuộc vào dữ liệu mà môi trường chạy cung cấp.

## Cài đặt

**Plugin cộng đồng:** mở **Cài đặt → Plugin cộng đồng → Duyệt**, tìm **Chrono Notes**, chọn **Cài đặt** rồi **Bật**.

**Cài thủ công:** tải `chrono-notes-<version>.zip` từ [bản phát hành mới nhất](https://github.com/ZHYX91/obsidian-chrono-notes/releases/latest), giải nén vào `Vault/.obsidian/plugins/`. Thư mục `chrono-notes/` chứa `main.js`, `manifest.json` và `styles.css`. Tải lại Obsidian rồi bật plugin.

**Nâng cấp:** sao lưu và giữ lại `data.json`; chỉ thay các tệp của plugin. Chỉ xóa `data.json` khi thật sự muốn đặt lại tùy chọn.

## Cách sử dụng

Chọn loại ghi chú, đường dẫn và mẫu trong phần cài đặt Chrono Notes, rồi mở lịch bằng biểu tượng bên hoặc bảng lệnh. **Nhấp một lần chỉ chọn ngày, không tự tạo ghi chú.** Nhấp đúp hoặc nhấn Enter để mở hay tạo ghi chú; trên màn hình cảm ứng thì nhấn giữ. Nhấp phải để mở các thao tác ngày. Ctrl/Cmd+nhấp hoặc nhấp nút giữa sẽ mở trong thẻ mới. Bật thêm lịch và nguồn ICS khi cần.

## Thiết lập

Bạn có thể chọn ngôn ngữ, ngày bắt đầu tuần, kiểu hiển thị ngày, đường dẫn và mẫu. Đổi ngôn ngữ dùng trong tên tệp không đổi tên ghi chú đã có; hãy kiểm tra bản xem trước đường dẫn. Có các mục riêng cho giao diện, công việc, thống kê, ghi chú khoảng thời gian và phần mở rộng.

## Giới hạn

Nguồn ICS chỉ đọc trên máy; plugin không tự tải lịch đăng ký từ xa. Mặc định mỗi lần làm mới chỉ đọc tối đa 32 nguồn. Sự kiện lặp `RRULE`/`RDATE` được đếm nhưng không mở rộng. Không dự đoán lịch nghỉ chưa được công bố chính thức. Một số hệ lịch chỉ xuất hiện khi môi trường hỗ trợ.

## Quyền riêng tư và bảo mật

Plugin đọc ghi chú Markdown cần thiết và các tệp ICS đã chọn để tạo chỉ mục và hiển thị lịch. Không tải nội dung lên mạng và không cần tài khoản. Chỉ mục dẫn xuất nằm trong IndexedDB trên thiết bị và có thể xây dựng lại. Plugin không đọc bộ nhớ tạm; nó chỉ ghi ngày khi bạn chọn 'Sao chép ngày'.

## Phát triển

Dùng Node.js 24.19.0 và npm 11.17.0; chạy `npm ci` và `npm run check`. Xem [kiến trúc](../architecture.en.md) và [chiến lược kiểm thử](../testing-strategy.en.md).

## Hỗ trợ

Đặt câu hỏi trong [Discussions](https://github.com/ZHYX91/obsidian-chrono-notes/discussions), báo lỗi tái hiện được qua [Issues](https://github.com/ZHYX91/obsidian-chrono-notes/issues/new/choose) và gửi vấn đề bảo mật [riêng tư](https://github.com/ZHYX91/obsidian-chrono-notes/security/advisories/new). Đừng công khai dữ liệu riêng trong Vault.

## Giấy phép

[MIT](../../LICENSE) © ZhengYX

## Lời cảm ơn

Lấy cảm hứng từ [Calendar](https://github.com/liamcain/obsidian-calendar-plugin) và [Dust Calendar](https://github.com/a-nano-dust/dust-obsidian-calendar).
