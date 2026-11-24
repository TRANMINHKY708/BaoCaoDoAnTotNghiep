# Hướng dẫn cài đặt MK eAI

Tài liệu này hướng dẫn cài MK eAI trên một máy Windows mới, từ lúc tải mã nguồn đến khi đăng nhập được vào ứng dụng.
Làm lần đầu mất khoảng 20–30 phút, phần lớn là thời gian tải thư viện.

MK eAI là ứng dụng web chạy trên máy cá nhân, gồm hai phần chạy song song: **backend** (Python, FastAPI) xử lý dữ liệu
và mô hình, **frontend** (React) là giao diện mở trong trình duyệt. Dữ liệu lưu trong **PostgreSQL**.

## 1. Chuẩn bị phần mềm

| Phần mềm | Phiên bản | Ghi chú |
|---|---|---|
| Windows | 10 hoặc 11, 64 bit | |
| Python | 3.11 | Khi cài, tích **Add python.exe to PATH** |
| Node.js | 20 trở lên (đã thử với 24) | Bản LTS trên nodejs.org |
| PostgreSQL | 17 (đã thử) | Ghi nhớ mật khẩu của tài khoản `postgres` đặt lúc cài |

Kiểm tra sau khi cài, mở PowerShell và gõ:

```powershell
python --version      # Python 3.11.x
node --version        # v20 trở lên
```

## 2. Tải mã nguồn

Kho GitHub đã chứa đủ mã nguồn, mô hình đã huấn luyện, dữ liệu và cơ sở dữ liệu mẫu. Chọn một trong hai cách:

- **Có Git:** mở PowerShell tại ổ D: rồi chạy
  `git clone https://github.com/TRANMINHKY708/BaoCaoDoAnTotNghiep.git D:\MK-eAI`
- **Không có Git:** trên trang GitHub, bấm **Code → Download ZIP**, rồi giải nén vào `D:\MK-eAI`.

Nên đặt dự án trong thư mục **không có dấu tiếng Việt và khoảng trắng**. Các lệnh từ đây trở đi đều chạy trong
PowerShell, tại thư mục dự án:

```powershell
cd D:\MK-eAI
```

## 3. Cài thư viện

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
cd frontend
npm ci
cd ..
```

Lệnh `pip` mất khoảng 3–5 phút, `npm ci` khoảng 2–5 phút tùy tốc độ mạng. Tệp `requirements.txt` đã khóa đúng phiên bản
thư viện dùng khi huấn luyện mô hình, nên không cần và không nên nâng cấp thư viện.

## 4. Tạo cơ sở dữ liệu từ bản mẫu

Thay `17` bằng phiên bản PostgreSQL trên máy nếu khác. Mỗi lệnh sẽ hỏi mật khẩu của tài khoản `postgres`.

```powershell
$pg = "C:\Program Files\PostgreSQL\17\bin"
& "$pg\createdb.exe" -U postgres ecommerce_ai
& "$pg\psql.exe" -U postgres -d ecommerce_ai -f database\MK-eAI-demo-database.sql
```

Lệnh thứ hai in ra nhiều dòng `CREATE TABLE`, `COPY …` là bình thường. Cơ sở dữ liệu mẫu có 29 khách hàng cùng các kết
quả phân tích đã lưu, để mở ứng dụng là có dữ liệu xem ngay.

## 5. Khai báo cấu hình

Tạo tệp cấu hình từ tệp mẫu:

```powershell
copy .env.example .env
notepad .env
```

Trong Notepad, sửa dòng `DATABASE_URL` cho đúng mật khẩu `postgres` trên máy, rồi lưu lại:

```
DATABASE_URL=postgresql+psycopg://postgres:MAT_KHAU_POSTGRES@localhost:5432/ecommerce_ai
```

Trợ lý AI là chức năng tùy chọn. Muốn dùng thì điền khóa Gemini vào dòng `GEMINI_API_KEY=` (tạo khóa miễn phí tại
aistudio.google.com). Bỏ trống thì mọi chức năng khác vẫn chạy bình thường.

## 6. Chạy ứng dụng

Mở **hai cửa sổ PowerShell** tại thư mục dự án.

Cửa sổ 1, chạy backend:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
. .\scripts\accounts_local.ps1
.\.venv\Scripts\python.exe -m scripts.run_accounts
```

Cửa sổ 2, chạy giao diện:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
. .\scripts\accounts_local.ps1
cd frontend
npm run dev
```

Dòng `Set-ExecutionPolicy` chỉ có hiệu lực trong cửa sổ đó, để PowerShell cho phép chạy tệp cấu hình `accounts_local.ps1`.
Giữ nguyên hai cửa sổ trong lúc dùng; đóng cửa sổ là dừng ứng dụng.

Mở trình duyệt và vào **http://127.0.0.1:5173**. Dùng đúng địa chỉ `127.0.0.1`, không dùng `localhost`, vì hệ thống chỉ
chấp nhận địa chỉ này khi chạy trên máy cá nhân.

## 7. Đăng nhập

Cơ sở dữ liệu mẫu có sẵn các tài khoản sau:

| Tài khoản | Vai trò | Mật khẩu | Quyền chính |
|---|---|---|---|
| `minhky` | Admin | `Admin@2026` | Toàn quyền, gồm quản lý người dùng, phiên đăng nhập, nhật ký |
| `operator1` | Operator | `Operator@2026` | Quản lý khách hàng, nhập dữ liệu, chạy và lưu phân tích |
| `viewer1` | Viewer | `Viewer@2026` | Chỉ xem dữ liệu và kết quả |

Nên đăng nhập bằng `minhky` để xem đủ mọi chức năng. Video hướng dẫn sử dụng đi kèm bài nộp giới thiệu lần lượt từng
màn hình.

## 8. Kiểm tra nhanh khi có trục trặc

Lệnh sau chỉ đọc, không sửa gì, và báo mục nào chưa sẵn sàng:

```powershell
.\.venv\Scripts\python.exe -m scripts.preflight_demo --live
```

| Hiện tượng | Cách xử lý |
|---|---|
| `python` không được nhận ra | Cài lại Python và tích **Add python.exe to PATH** |
| `createdb: password authentication failed` | Sai mật khẩu `postgres`, nhập lại mật khẩu đã đặt khi cài PostgreSQL |
| `database "ecommerce_ai" already exists` | Database đã có từ lần trước; bỏ qua lệnh `createdb`, hoặc xóa bằng `& "$pg\dropdb.exe" -U postgres ecommerce_ai` rồi làm lại |
| `running scripts is disabled on this system` | Chưa chạy dòng `Set-ExecutionPolicy -Scope Process Bypass` trong cửa sổ đó |
| Backend dừng ngay với dòng `Accounts startup refused` | Kiểm tra ba điều: tên database trong `DATABASE_URL` phải đúng là `ecommerce_ai` (backend từ chối chạy với tên khác để tránh dùng nhầm database); đã chạy bước 4 để tạo dữ liệu; không có cửa sổ backend khác đang chạy |
| Trang báo không kết nối được máy chủ | Cửa sổ backend chưa chạy hoặc đã bị đóng |
| Không đăng nhập được, dù đúng mật khẩu | Đang mở bằng `localhost`; đổi sang `http://127.0.0.1:5173` |
| Nút Xuất PDF hoặc Excel không tải được tệp | Phần mềm Internet Download Manager chặn tải; tạm tắt IDM |
| Trợ lý AI báo chưa cấu hình | Chưa điền `GEMINI_API_KEY` trong `.env` (chức năng tùy chọn) |

## 9. Dữ liệu đi kèm

| Tệp | Nội dung | Dùng để |
|---|---|---|
| `data/processed/ecommerce_customer_behavior_cleaned.csv` | Dữ liệu nghiên cứu đã làm sạch, 49.960 dòng | Trang Phân nhóm, nút phân tích dữ liệu nghiên cứu |
| `du-lieu-mau/01_khach_hang_moi_12.csv` | 12 khách hàng mới thuộc tập kiểm tra | Thử chức năng nhập dữ liệu hàng loạt |
| `du-lieu-mau/02_tep_co_loi_de_minh_hoa.csv` | Tệp có 2 dòng lỗi cố ý | Xem hệ thống báo lỗi từng dòng, từng cột (chỉ bấm Kiểm tra dữ liệu, không xác nhận nhập) |
| `du-lieu-mau/03_du_doan_theo_danh_sach.json` | Danh sách khách hàng dạng JSON | Thử dự đoán theo danh sách ở trang Dự đoán |
| `du-lieu-mau/MK_eAI_demo_50_customers.csv` | 50 khách hàng mẫu | Thử nhập dữ liệu số lượng lớn hơn |
| `du-lieu-mau/MK_eAI_kaggle_10_customers.csv` | 10 khách hàng lấy từ dữ liệu Kaggle | Đã có sẵn trong cơ sở dữ liệu mẫu |

Các trang nghiên cứu (Khám phá dữ liệu, Kết quả mô hình…) dùng số liệu đã tính sẵn, đóng gói trong giao diện, nên không cần
bộ dữ liệu gốc để chạy. Bộ dữ liệu gốc 50.000 dòng nằm trong thư mục dữ liệu của bài nộp.

## 10. Cài đặt không dùng database mẫu (tùy chọn)

Muốn bắt đầu với cơ sở dữ liệu trống, thay bước 4 bằng các lệnh dưới đây. Mỗi lệnh yêu cầu gõ xác nhận; lệnh cuối tạo
tài khoản Admin đầu tiên với mật khẩu do người cài tự đặt (8–128 ký tự).

```powershell
& "$pg\createdb.exe" -U postgres ecommerce_ai
.\.venv\Scripts\python.exe -m scripts.accounts_operations migrate
.\.venv\Scripts\python.exe -m scripts.bulk_operations migrate
.\.venv\Scripts\python.exe -m scripts.analysis_operations migrate
.\.venv\Scripts\python.exe -m scripts.accounts_operations bootstrap
```

