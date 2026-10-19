# Hướng dẫn đăng nhập sinh trắc học (Passkey)

> Bản HTML hiển thị cho người dùng: `static/docs/biometric-login.html` — mở tại
> `/docs/biometric-login.html` từ trang đăng nhập.

Đăng nhập sinh trắc học dùng **Passkey (WebAuthn)**: vân tay / khuôn mặt / PIN thiết bị
thay mật khẩu. Mỗi thiết bị đăng ký một lần.

## Điều kiện

- **Windows**: bật Windows Hello (PIN / vân tay / khuôn mặt) — `Cài đặt → Tài khoản → Tùy chọn đăng nhập`.
- **macOS / iOS**: Touch ID / Face ID.
- **Android**: vân tay / khuôn mặt / mật khẩu màn hình khóa.
- Trình duyệt hỗ trợ WebAuthn (Chrome, Edge, Firefox, Safari mới).
- **Truy cập qua HTTPS đúng origin** khớp `webauthn_rp_id` + `webauthn_origin` trong `.env`
  (mặc định `https://192-168-2-30.sslip.io:3000`). IP thường / `localhost` → SecurityError
  “Sai miền truy cập” — cơ chế bảo mật chuẩn WebAuthn, không phải bug.

## Đăng ký thiết bị (1 lần / thiết bị)

1. Đăng nhập bằng mật khẩu.
2. **Hồ sơ cá nhân → tab Bảo mật** (Profile → Security).
3. Mục *Đăng nhập sinh trắc học (Passkey)* → **“Đăng ký thiết bị mới”**.
4. Xác nhận vân tay / khuôn mặt / PIN khi trình duyệt hỏi.
5. Thiết bị vào danh sách — đổi tên / xóa được mọi lúc.

## Đăng nhập

1. Mở trang đăng nhập qua HTTPS chính thức.
2. Bấm **“Đăng nhập bằng sinh trắc học”** (hàng trên nút Đăng nhập, dưới divider “hoặc”).
3. Xác nhận sinh trắc — vào thẳng hệ thống.

## Xử lý sự cố

| Hiện tượng | Nguyên nhân / cách xử lý |
| --- | --- |
| Không thấy nút sinh trắc học | Trình duyệt không hỗ trợ WebAuthn → Chrome/Edge mới |
| Nút mờ + “Thiết bị chưa có authenticator” | Bật Windows Hello / Touch ID → tải lại trang |
| “Thiết bị này chưa đăng ký passkey” | Đăng ký theo bước trên trước |
| “Sai miền truy cập” | Mở đúng địa chỉ HTTPS chính thức |
| Bấm không có gì xảy ra | Popup trình duyệt bị chặn — thử lại |

## Kiến trúc kỹ thuật (tham khảo)

- Server: `src/lib/server/db/webauthn.ts` — RP config từ env, challenge TTL 5 phút single-use
  (restart server giữa options → verify sẽ hủy challenge cũ), credential trong collection
  `webauthn_credentials`, DPoP bind `jkt` (refresh token).
- Client: `@simplewebauthn/browser` — `browserSupportsWebAuthn` + `platformAuthenticatorIsAvailable`
  (login: nút disabled + hint khi false; profile: tab Bảo mật đăng ký/liệt kê/xóa).
- Nút bấm được mà vault RSA chưa init xong → hiện “Đang khởi tạo mã hoá…” thay vì nuốt click.
