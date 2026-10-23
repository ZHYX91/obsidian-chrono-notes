# Chrono Notes

[English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru-RU.md) · [Tiếng Việt](README.vi-VN.md) · [العربية](README.ar.md) · [فارسی](README.fa.md) · [עברית](README.he.md) · [አማርኛ](README.am.md) · [हिन्दी](README.hi.md)

Chrono Notes bổ sung cho Obsidian một không gian lịch để quản lý ghi chú định kỳ, công việc, ngày lễ khu vực, sự kiện trên máy và ghi chú theo khoảng ngày.

Đây là **hướng dẫn ngắn** cho các thao tác thường dùng. Cách thiết lập và các giới hạn chi tiết có trong tài liệu đầy đủ bằng [tiếng Anh](../../README.md) và [tiếng Trung giản thể](README.zh-CN.md).

## Tính năng

Giao diện lịch trên máy tính và Android:

![Lịch Chrono Notes trên máy tính](../assets/chrono-notes-desktop-en.png)

![Lịch Chrono Notes trên Android](../assets/chrono-notes-android-en.png)

- Xem lịch theo tuần, tháng, năm và thế kỷ, kèm trạng thái ghi chú, công việc, thống kê và xem trước.
- Ghi chú ngày, tuần, tháng, quý, năm, thập kỷ và thế kỷ với mẫu tích hợp hoặc Templater.
- Điều hướng giữa các ghi chú, theo dõi tiến độ công việc, bản đồ nhiệt và ghi chú cho khoảng ngày đã chọn.
- Hỗ trợ lịch âm Trung Quốc, can chi, lịch Ba Tư, Ethiopia, Do Thái, Ấn Độ, Hồi giáo và ngày nghỉ ở Trung Quốc đại lục, Singapore.
- Đọc tệp ICS trên máy ở chế độ chỉ đọc. Có thể thay đổi cách hiển thị thuộc tính ngày mà không sửa giá trị YAML.

## Yêu cầu và khả năng tương thích

Yêu cầu Obsidian 1.12.7 trở lên trên máy tính hoặc thiết bị di động. Tệp ICS trong Vault dùng được trên các nền tảng tương thích; đường dẫn ngoài Vault chỉ dùng trên máy tính. Lịch bổ sung phụ thuộc vào dữ liệu mà môi trường chạy cung cấp.

## Cài đặt

### Plugin cộng đồng

Mở **Cài đặt → Plugin cộng đồng → Duyệt**, tìm **Chrono Notes**, chọn **Cài đặt** rồi **Bật**.

### Cài thủ công

Tải `chrono-notes-<version>.zip` từ [bản phát hành mới nhất](https://github.com/ZHYX91/obsidian-chrono-notes/releases/latest), giải nén vào `Vault/.obsidian/plugins/`. Thư mục `chrono-notes/` chứa `main.js`, `manifest.json` và `styles.css`. Tải lại Obsidian rồi bật plugin.

### Nâng cấp

Sao lưu và giữ lại `data.json`; chỉ thay các tệp của plugin. Chỉ xóa `data.json` khi thật sự muốn đặt lại tùy chọn.

## Cách sử dụng

Lịch chính, bộ chọn tháng và hộp thoại ngày luôn dùng lịch Gregory. Đổi ngôn ngữ sẽ đổi tên tháng và cách hiển thị chữ số, không đổi hệ lịch. Hãy chọn tiện ích lịch riêng nếu cần hiển thị thêm thông tin từ lịch khác.

**Trước khi thêm ICS:** Chrono Notes chỉ đọc tệp cục bộ, không tải lịch đăng ký từ xa và không mở rộng các sự kiện lặp có `RRULE` hoặc `RDATE`. Số sự kiện bỏ qua được báo lại; vì thế lịch phụ thuộc vào lặp lại có thể hiển thị thiếu. Đường dẫn ngoài Vault chỉ dùng được trên máy tính.

Chọn loại ghi chú, đường dẫn và mẫu trong phần cài đặt Chrono Notes, rồi mở lịch bằng biểu tượng bên hoặc bảng lệnh. **Nhấp một lần chỉ chọn ngày, không tự tạo ghi chú.** Nhấp đúp hoặc nhấn Enter để mở hay tạo ghi chú. Nhấp phải để mở menu của ngày; nếu có sự kiện ICS, bạn có thể xem toàn bộ danh sách sự kiện từ menu này. Ctrl/Cmd+nhấp hoặc nhấp nút giữa sẽ mở ghi chú trong thẻ mới. Bật thêm lịch và nguồn ICS khi cần.

Trên màn hình cảm ứng, nhấn giữ một ngày để mở menu, rồi chọn thao tác mở hoặc tạo ghi chú ngày. Nếu không có menu xuất hiện, ghi chú sẽ được mở hoặc tạo khi bạn nhấc ngón tay. Nhấn giữ một mục tuần, tháng hoặc khoảng thời gian khác sẽ mở trực tiếp ghi chú tương ứng.

### Hiển thị công việc trên lịch

Thêm công việc có ô đánh dấu vào ghi chú và ghi ngày kèm ký hiệu:

```markdown
- [ ] Gửi báo cáo tuần 📅 2026-10-20
- [ ] Chuẩn bị tài liệu 🛫 2026-10-18 ⏳ 2026-10-19 📅 2026-10-20
- [ ] Kiểm tra báo cáo ⏳ 2026-10-20 📅 2026-10-20
```

`🛫` là ngày bắt đầu, `⏳` là ngày dự kiến và `📅` là hạn chót. Dùng định dạng `YYYY-MM-DD`. Chế độ xem tuần hiển thị công việc có một trong các ngày này nằm trong tuần đang xem. Một công việc xuất hiện ở từng ngày khác nhau; nhiều ký hiệu cùng chỉ một ngày sẽ được gộp thành một mục. Vì vậy, công việc cuối trong ví dụ chỉ xuất hiện một lần vào ngày 20 tháng 10. Công việc không có ngày vẫn được tính vào tiến độ của ghi chú.

Trong chế độ xem tuần, dùng danh sách chọn hạn chót để chuyển sang một ngày khác của tuần đó. Trên máy tính, bạn cũng có thể kéo công việc có hạn chót vào ngày muốn chọn. Các thao tác này sửa hạn chót đã có trong ghi chú gốc.

### Ghi chú thập kỷ và thế kỷ

Trong chế độ xem thế kỷ, mỗi thập kỷ nằm cạnh hai hàng, mỗi hàng có 5 năm. Trên màn hình hẹp, ô thập kỷ chuyển lên trên. Khi bảng hiển thị rất hẹp hoặc cỡ chữ lớn, các năm được xếp thành hai cột. Các năm ngoài thế kỷ để trống. Khi mở chế độ xem, ứng dụng đưa thập kỷ của năm đã chọn vào vùng nhìn thấy. Nút 'Thế kỷ này' đưa bạn về thập kỷ hiện tại, thanh điều hướng vẫn hiển thị khi cuộn.

Bật loại ghi chú thập kỷ và thế kỷ trong cài đặt rồi chọn Thế kỷ trên thanh bên. Thập kỷ và thế kỷ có ô riêng. Nhấp một lần chỉ để chọn; nhấp đúp hoặc nhấn Enter để mở hay tạo ghi chú. Ctrl/Cmd+nhấp hoặc nhấp chuột giữa để mở thẻ mới; trên màn hình cảm ứng có thể nhấn giữ. Dấu trạng thái, tiến độ công việc và xem trước giống chế độ xem năm. Đường dẫn mặc định là `[diary]/DEC[s]` (2020s) cho thập kỷ và `[diary]/[C]CEN` (C21) cho thế kỷ.

Một thập kỷ có thể gồm 2020–2029; thế kỷ 21 gồm 2001–2100. `DEC` và `CEN` luôn xuất chữ số cố định, bất kể ngôn ngữ giao diện. Nên chọn thư mục theo thế kỷ HOẶC thập kỷ thay vì lồng cả hai. Những năm 2000 trải qua C20/C21 nhưng ghi chú thập kỷ thuộc C20 do bắt đầu năm 2000. Ghi chú hiện có không bị di chuyển tự động.

Các mẫu hỗ trợ `{{date:DEC[s]}}`, `{{date:[C]CEN}}` và `{{start:YYYY}}–{{end:YYYY}}`. Mọi mẫu ghi chú định kỳ đều có ngày đầu, ngày cuối và số ngày `{{days}}` tính cả hai đầu. Từng trang cài đặt nêu các chỗ giữ nội dung, ví dụ và biểu thức Templater tương ứng; quy tắc chung nằm tại Chung → Cài đặt mẫu.

### Ghi chú khoảng thời gian

Trước tiên, chọn thư mục lưu trong **Cài đặt → Chrono Notes → Ghi chú khoảng thời gian**. Trên máy tính, kéo từ ngày bắt đầu đến một ngày kết thúc khác trong lịch tháng để tạo ghi chú. Bạn cũng có thể chọn thao tác tạo ghi chú khoảng thời gian từ menu của ngày hoặc bảng lệnh, rồi nhập ngày. Khi tạo mới, khoảng thời gian phải gồm ít nhất hai ngày trên lịch. Nếu ngày đầu và ngày cuối bị đảo ngược, plugin sẽ tự xếp lại đúng thứ tự.

Để một ghi chú có sẵn xuất hiện trên lịch như một khoảng thời gian, thêm các thuộc tính sau vào đầu tệp Markdown:

```yaml
---
chrono-notes: interval
start: 2026-10-18
end: 2026-10-20
---
```

Dùng ngày đầy đủ theo định dạng `YYYY-MM-DD`, với ngày đầu không muộn hơn ngày cuối. Khoảng hiển thị bao gồm cả hai ngày. Ghi chú có sẵn cũng có thể dùng ngày giờ ISO đầy đủ, ít nhất gồm giờ và phút, hoặc mô tả khoảng thời gian trong cùng một ngày.

Ghi chú khoảng thời gian cần có hai thuộc tính `start` và `end` với ngày hợp lệ. Ghi chú do Chrono Notes tạo còn có `chrono-notes: interval`, vì thế được nhận diện ở bất kỳ đâu trong Vault.

Nếu thiếu thuộc tính `chrono-notes`, ghi chú chỉ được nhận diện trong phạm vi tìm ghi chú chưa đánh dấu đã cài đặt. Nếu thuộc tính có giá trị khác `interval`, ghi chú không được nhận diện. Plugin không tự sửa các ghi chú hiện có.

## Thiết lập

Phần cài đặt chung có hướng dẫn sử dụng và mục báo lỗi. Khi đổi tiện ích lịch hoặc ngày lễ, thẻ cài đặt hiện tại vẫn nhìn thấy và tiêu điểm bàn phím vẫn ở điều khiển vừa dùng.

Bạn có thể chọn ngôn ngữ, ngày bắt đầu tuần, kiểu hiển thị ngày, đường dẫn và mẫu. Đổi ngôn ngữ dùng trong tên tệp không đổi tên ghi chú đã có; hãy kiểm tra bản xem trước đường dẫn. Có các mục riêng cho giao diện, công việc, thống kê, ghi chú khoảng thời gian và phần mở rộng.

## Giới hạn

- Nguồn ICS chỉ được đọc trên máy; plugin không tự tải lịch đăng ký từ xa. Mặc định mỗi lần làm mới chỉ đọc tối đa 32 nguồn và thông báo những nguồn bị bỏ qua do vượt giới hạn. Sự kiện lặp có `RRULE` hoặc `RDATE` được bỏ qua và báo số lượng.
- Múi giờ được định nghĩa trong tệp có thể dùng các ngày chuyển giờ ghi rõ và một số quy tắc theo năm (`FREQ=YEARLY`). Nếu định nghĩa không hợp lệ, không được hỗ trợ hoặc quá phức tạp, các sự kiện dùng múi giờ đó sẽ bị bỏ qua và được báo lại. Xem quy tắc và giới hạn trong [tài liệu về ngày và múi giờ](../calendar-boundaries.en.md) bằng tiếng Anh.
- Không dự đoán lịch nghỉ chưa được công bố chính thức. Lịch bổ sung chỉ thay đổi cách hiển thị; tên ghi chú, điều hướng ngày và ngày của công việc vẫn dùng lịch Gregory. Phần mở rộng mà môi trường không hỗ trợ sẽ được ẩn.

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
