import { ArrowRight, UsersRound, FlaskConical } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ModulePage() {
  return (
    <div className="history-entry">
      <div className="page-heading">
        <div>
          <span className="eyebrow">KẾT QUẢ ĐÃ LƯU</span>
          <h1>Lịch sử kết quả</h1>
        </div>
      </div>
      <div className="history-entry-grid">
        <section className="panel">
          <UsersRound size={26} />
          <h2>Lịch sử của khách hàng</h2>
          <p>Xem dự đoán và phân nhóm trong hồ sơ khách hàng.</p>
          <Link className="button button-primary" to="/customers">
            Chọn khách hàng <ArrowRight size={16} />
          </Link>
        </section>
        <section className="panel">
          <FlaskConical size={26} />
          <h2>Lịch sử kịch bản mô phỏng</h2>
          <p>Mở trang mô phỏng rồi chọn “Tải lịch sử kịch bản”.</p>
          <Link className="button button-secondary" to="/what-if">
            Xem công cụ mô phỏng <ArrowRight size={16} />
          </Link>
        </section>
      </div>
      <p className="history-availability">
        Chỉ hiển thị kết quả đã lưu.{' '}
        <Link className="text-link" to="/batch-analytics">
          Xem kết quả hàng loạt <ArrowRight size={14} />
        </Link>
      </p>
    </div>
  );
}
