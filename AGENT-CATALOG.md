# AGENT-CATALOG — REST Schema Catalog cho AI Agent / LLM

Catalog REST mô tả toàn bộ cấu trúc dữ liệu của hệ thống (Couchbase: bucket → scope → collection), permission keys và quy ước truy vấn N1QL — để AI agent/LLM có thể tự viết truy vấn đọc dữ liệu đúng.

## Endpoint

```
GET /api/agent/schema
```

- **Trả về:** raw JSON (KHÔNG mã hoá RSA — ngoại lệ so với các API admin khác, vì agent cần đọc trực tiếp).
- **Auth:** bắt buộc đăng nhập (session cookie). Chỉ role **owner** — role khác nhận `403`.
- **401** khi chưa đăng nhập / phiên hết hạn.

### Ví dụ curl

```bash
# 1. Đăng nhập lấy cookie session (điền user/password owner thực tế)
curl -c cookies.txt -X POST http://localhost:5173/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@example.com","password":"***"}'

# 2. Gọi catalog
curl -b cookies.txt http://localhost:5173/api/agent/schema | jq .
```

## Cấu trúc JSON trả về

```jsonc
{
  "generatedAt": "2026-10-14T03:00:00.000Z",
  "bucket": "<tên bucket>",
  "scope": "<tên scope>",
  "keyspaceFormat": "`<bucket>`.`<scope>`.`<collection>`",
  "collections": [
    {
      "name": "products",
      "keyspace": "`bucket`.`scope`.`products`",
      "fields": [
        { "name": "name", "type": "string", "searchable": true, "sortable": true, "selectable": true },
        { "name": "status", "type": "string", "searchable": true, "sortable": true, "selectable": true }
      ]
    }
  ],
  "relationships": [
    { "from": "products", "to": "product_variants", "via": "product_variants.productId = products (META().id)", "note": "1 sản phẩm nhiều biến thể" }
  ],
  "permissions": [
    { "key": "products:read", "note": "Xem sản phẩm, biến thể, tồn kho" }
  ],
  "conventions": { "...": "xem bên dưới" },
  "queryExamples": ["SELECT ..."]
}
```

Danh sách `collections` sinh **tự động** từ `collectionSchemas` (`src/lib/modules/schema.ts`) — khi thêm collection mới vào schema, catalog tự cập nhật, không cần sửa endpoint.

## Quy ước quan trọng (đọc kỹ trường `conventions`)

- **Keyspace:** truy vấn luôn dùng `` `bucket`.`scope`.`collection` `` — bọc backtick.
- **Reserved words:** `key`, `scope`, `value` là từ khoá N1QL — không đặt alias trùng, cần escape nếu dùng làm tên cột.
- **Blind index:** `email`/`phone` KHÔNG query trực tiếp được — hệ thống lưu HMAC blind index (vd `phoneBlindIndex`). Không có key gốc thì không search chính xác; chỉ search các field đánh dấu `searchable: true`.
- **Legacy docs:** document import từ MongoDB cũ có field bọc lớp `{ value: X }`; `legacyId` là ID nguồn trong hệ cũ.
- **Date:** chuỗi ISO 8601 (vd `2026-10-14T02:30:00.000Z`).
- **Soft delete:** nhiều collection dùng `deletedAt` — lọc bản ghi còn hoạt động bằng `deletedAt IS NULL OR deletedAt IS MISSING`.
- **Mã hoá API:** các API admin khác trả response mã hoá RSA; endpoint này là ngoại lệ trả raw JSON cho agent.

## Quan hệ chính (relationships)

| Từ | Đến | Kết nối |
| --- | --- | --- |
| `products` | `product_variants` | `product_variants.productId = META(products).id` |
| `product_variants` | `inventory_stock` / `inventory_lots` | `variantId` |
| `inventory_lots` | `stock_movements` | `stock_movements.lotId` |
| `purchase_orders` | `suppliers` | `purchase_orders.supplierId` |
| `orders` | `payments` | `payments.orderId` |
| `price_history` | `product_variants` | `price_history.variantId` — lịch sử giá nhập/bán |
| `operating_expenses` / `cameras` | `name_branches` | `branchId` |

## Ví dụ truy vấn N1QL

```sql
-- Danh sách sản phẩm đang hoạt động
SELECT * FROM `bucket`.`scope`.`products` WHERE status='active' LIMIT 20;

-- Join variant → sản phẩm
SELECT p.name, v.sku, v.price
FROM `bucket`.`scope`.`product_variants` v
JOIN `bucket`.`scope`.`products` p ON v.productId = META(p).id
WHERE v.status='active' LIMIT 20;

-- Đếm đơn theo trạng thái
SELECT status, COUNT(*) AS cnt FROM `bucket`.`scope`.`orders` GROUP BY status;

-- Tổng tiền nhập đã nhận hàng
SELECT SUM(totalCost) AS total FROM `bucket`.`scope`.`purchase_orders` WHERE status='received';
```

(Thay `bucket`/`scope` bằng giá trị thật từ response.)

## Permission keys

Trường `permissions` liệt kê đầy đủ các key hệ thống dùng (vd `products:read`, `orders:refund`, `analytics:read`, `expenses:manage`, …) kèm mô tả tiếng Việt. Agent dùng danh sách này để biết API nào cần quyền gì — lưu ý một số resource chỉ có `manage` (gồm cả đọc) như `users:manage`, một số có cặp `read`/`manage`.

## Ghi chú tích hợp

- Catalog chỉ **đọc** — endpoint này không cung cấp mutation. Ghi dữ liệu phải qua các API admin tương ứng (mã hoá RSA).
- Nếu cần expose cho agent ngoài (không đăng nhập), cân nhắc thêm token riêng + rate limit — hiện chưa có (backlog).
