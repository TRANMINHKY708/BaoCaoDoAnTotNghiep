import { ArrowRight, ArrowUpRight, Check, CircleDot, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWorkspace } from '../../app/context';
import { modules, modelTasks } from '../../routes/modules';

export default function DashboardPage() {
  const { status, session } = useWorkspace();
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">PHÂN TÍCH KHÁCH HÀNG</span>
          <h1>Tổng quan</h1>
        </div>
        <span className="scope-badge">
          <CircleDot size={14} />
          Phân tích dữ liệu hiện có
        </span>
      </div>
      <section className="welcome-card">
        <div className="welcome-copy">
          <span className="hero-kicker">
            <Sparkles size={15} /> HIỂU KHÁCH HÀNG TỪ DỮ LIỆU
          </span>
          <h2>
            Từ hành vi dữ liệu,
            <br />
            đến <em>hiểu biết khách hàng.</em>
          </h2>

          <div className="hero-actions">
            <Link
              className="button button-primary"
              to={session.accountMode ? '/account' : '/connect'}
            >
              {session.accountMode
                ? 'Tài khoản'
                : status === 'connected'
                  ? 'Quản lý kết nối'
                  : 'Kết nối workspace'}
              <ArrowRight size={16} />
            </Link>
            <Link className="text-link" to="/system">
              Tìm hiểu hệ thống <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="hero-proof">
            <ShieldCheck size={15} /> Rõ phiên bản mô hình <span>·</span> Giữ nguyên dữ liệu gốc
          </div>
        </div>
      </section>
      <div className="section-heading">
        <div>
          <h2>Không gian làm việc</h2>
        </div>
        <span className="subtle-tag">Các công cụ phân tích</span>
      </div>
      <div className="module-grid">
        {modules
          .filter(
            (item) => !['/dashboard', '/history', '/assistant', '/system'].includes(item.path),
          )
          .map((item, index) => (
            <Link className={`module-card module-${index}`} to={item.path} key={item.path}>
              <div className="module-card-top">
                <span className="module-icon">
                  <item.icon size={22} />
                </span>
                <ArrowUpRight size={17} />
              </div>
              <h3>{item.label}</h3>
              <p>{item.description}</p>
              <span className="module-stage">
                {item.path === '/history' ? 'Tra cứu trong hồ sơ' : 'Mở chức năng'}
                <ArrowRight size={14} />
              </span>
            </Link>
          ))}
        <Link className="module-card system-module" to="/system">
          <div className="module-card-top">
            <span className="module-icon">
              <ShieldCheck size={22} />
            </span>
            <ArrowUpRight size={17} />
          </div>
          <h3>Hệ thống & mô hình</h3>

          <span className="module-stage">
            Sẵn sàng kiểm tra <ArrowRight size={14} />
          </span>
        </Link>
      </div>
      <div className="lower-grid">
        <section className="panel model-overview">
          <div className="panel-heading">
            <h2>Hai bài toán AI, hai cách diễn giải</h2>
            <Link to="/system">
              Xem mô hình <ArrowUpRight size={14} />
            </Link>
          </div>
          {modelTasks.map((item) => (
            <div className="model-task" key={item.name}>
              <span className={`model-task-icon ${item.className}`}>
                <item.icon size={22} />
              </span>
              <div>
                <strong>{item.name}</strong>
                <p>{item.description}</p>
              </div>
              <span className="task-chip">{item.detail}</span>
            </div>
          ))}
          <p className="panel-note">
            Nhãn mức độ mua hàng không đồng nghĩa nhãn phân nhóm. Khoảng cách K-Means không phải xác
            suất.
          </p>
        </section>
        <section className="panel foundation-card">
          <span className="eyebrow">BẮT ĐẦU PHÂN TÍCH</span>
          <h2>Kết nối dữ liệu của bạn.</h2>
          <p>
            Kết nối không gian làm việc để xem tổng quan. Chưa hiển thị số liệu khách hàng khi chưa
            có kết nối.
          </p>
          <div className="foundation-check">
            <span>
              <Check size={14} /> Hồ sơ và lịch sử khách hàng
            </span>
            <span>
              <Check size={14} /> Dự đoán và phân nhóm khách hàng
            </span>
            <span>
              <Check size={14} /> Mô phỏng thay đổi hành vi
            </span>
          </div>
          <Link className="text-link" to="/system">
            Xem phạm vi & giới hạn <ArrowRight size={15} />
          </Link>
        </section>
      </div>
    </>
  );
}
