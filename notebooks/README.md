# Notebook nghiên cứu

Các notebook ghi lại quá trình làm việc với dữ liệu trước khi đưa mô hình vào sản phẩm. Notebook được lưu kèm kết quả
và biểu đồ của lần chạy, nên có thể đọc trực tiếp trên GitHub mà không cần chạy lại. Sản phẩm MK eAI không cần các
notebook này để hoạt động.

| Notebook | Nội dung |
|---|---|
| `02_eda.ipynb` | Khám phá dữ liệu: phân phối nhãn mức mua, thống kê biến số và biến phân loại, so sánh hành vi giữa ba mức mua, tương quan, rà soát các thuộc tính có nguy cơ rò rỉ nhãn |
| `03_classification.ipynb` | Thử bốn thuật toán phân loại (Logistic Regression, Random Forest, XGBoost, mạng nơ-ron MLP) và thí nghiệm bỏ Lifetime_Value, nơi lần đầu thấy điểm số phụ thuộc bất thường vào biến này |
| `04_model_evaluation.ipynb` | Đánh giá và chọn mô hình dự đoán mức mua ban đầu |
| `05_customer_segmentation.ipynb` | Phân khúc khách hàng bằng K-Means và đóng gói pipeline phân nhóm |

Đây là giai đoạn khám phá ban đầu. Quy trình đánh giá cuối cùng (12 thuộc tính, đánh giá chéo lặp lại kèm kiểm định thống
kê, tập kiểm tra chấm một lần) được trình bày trong báo cáo khóa luận và trong các trang nghiên cứu của ứng dụng (Khám phá
dữ liệu, Kết quả mô hình, Đánh giá phân cụm, Dự báo rời bỏ).

## Chạy lại notebook

Cài thêm Jupyter và thư viện vẽ biểu đồ vào môi trường của dự án, rồi mở JupyterLab từ thư mục gốc:

```powershell
.\.venv\Scripts\python.exe -m pip install -r notebooks\requirements.txt
.\.venv\Scripts\python.exe -m jupyterlab
```

Dữ liệu notebook đọc nằm ở `data/processed/`. Đường dẫn máy trong phần kết quả đã được rút gọn thành đường dẫn tương đối.
