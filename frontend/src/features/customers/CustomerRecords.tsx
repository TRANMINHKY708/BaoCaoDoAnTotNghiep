import { modelName } from '../../components/presentationLabels';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Activity, Database, History } from 'lucide-react';
import { useWorkspace } from '../../app/context';
import { EmptyState, ErrorState, LoadingState } from '../../components/states';
import { Pagination } from './CustomerShared';
import {
  dateTime,
  detailFilters,
  number,
  probability,
  type PurchaseHistory,
  type SegmentHistory,
  type Snapshot,
} from './customers';

const fields: Array<[keyof Snapshot, string, boolean?]> = [
  ['Age', 'Tuổi'],
  ['Gender', 'Giới tính'],
  ['Country', 'Quốc gia'],
  ['City', 'Thành phố'],
  ['Membership_Years', 'Số năm thành viên'],
  ['Signup_Quarter', 'Quý đăng ký'],
  ['Login_Frequency', 'Tần suất đăng nhập'],
  ['Session_Duration_Avg', 'Thời lượng phiên TB'],
  ['Pages_Per_Session', 'Số trang / phiên'],
  ['Wishlist_Items', 'Sản phẩm yêu thích'],
  ['Mobile_App_Usage', 'Sử dụng ứng dụng'],
  ['Social_Media_Engagement_Score', 'Điểm tương tác mạng xã hội'],
  ['Email_Open_Rate', 'Tỷ lệ mở email', true],
  ['Cart_Abandonment_Rate', 'Tỷ lệ bỏ giỏ hàng', true],
  ['Total_Purchases', 'Tổng lượt mua · dữ liệu ghi nhận'],
  ['Average_Order_Value', 'Giá trị đơn TB'],
  ['Days_Since_Last_Purchase', 'Ngày từ lần mua gần nhất'],
  ['Discount_Usage_Rate', 'Tỷ lệ sử dụng giảm giá', true],
  ['Returns_Rate', 'Tỷ lệ hoàn trả', true],
  ['Customer_Service_Calls', 'Cuộc gọi hỗ trợ'],
  ['Product_Reviews_Written', 'Đánh giá đã viết'],
  ['Payment_Method_Diversity', 'Đa dạng thanh toán'],
  ['Lifetime_Value', 'Giá trị vòng đời · dữ liệu ghi nhận'],
  ['Credit_Balance', 'Số dư tín dụng'],
  ['Churned', 'Trạng thái rời bỏ · dữ liệu ghi nhận'],
];

export function SnapshotCard({ item, first }: { item: Snapshot; first: boolean }) {
  return (
    <details className="customer-record customer-snapshot" open={first}>
      <summary>
        <span className="customer-record-icon">
          <Database size={18} />
        </span>
        <span>
          <strong>Bản ghi hành vi</strong>
          <small>
            {dateTime(item.captured_at)} · nguồn: {item.source}
          </small>
        </span>
        <span className="customer-record-action">Xem dữ liệu</span>
      </summary>
      <dl className="customer-feature-grid">
        {fields.map(([key, label, percent]) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>
              {typeof item[key] === 'boolean'
                ? item[key]
                  ? 'Có'
                  : 'Không'
                : typeof item[key] === 'number'
                  ? number(item[key] as number) + (percent ? '%' : '')
                  : String(item[key])}
            </dd>
          </div>
        ))}
      </dl>
      <p className="customer-help">
        Giá trị gốc; tỷ lệ ở thang 0–100. Đơn vị tiền tệ và thời lượng theo nguồn, chưa xác minh.
      </p>
      <details className="technical-details">
        <summary>Thông tin kỹ thuật</summary>
        <p className="customer-record-reference">Snapshot ID: {item.id}</p>
      </details>
    </details>
  );
}

function Provenance({ item }: { item: PurchaseHistory | SegmentHistory }) {
  return (
    <details className="customer-provenance">
      <summary>Thông tin kỹ thuật</summary>
      <dl>
        <div>
          <dt>Phiên bản mô hình</dt>
          <dd>{item.model_version}</dd>
        </div>
        <div>
          <dt>Mô hình</dt>
          <dd>
            {item.model_id} · {item.model_name}
          </dd>
        </div>
        <div>
          <dt>Registry ID</dt>
          <dd>{item.model_registry_id}</dd>
        </div>
        <div>
          <dt>Run ID</dt>
          <dd>{item.run_id}</dd>
        </div>
        <div>
          <dt>Kết quả ID</dt>
          <dd>{item.id}</dd>
        </div>
        <div>
          <dt>Snapshot ID</dt>
          <dd>{item.behavior_snapshot_id ?? 'Không liên kết snapshot'}</dd>
        </div>
      </dl>
      <p>
        Thời điểm là lúc lưu kết quả. API lịch sử không trả checksum hoặc toàn bộ preprocessing; xem
        danh mục mô hình để đối chiếu phiên bản. Không suy ra checksum lịch sử từ model hiện tại.
      </p>
    </details>
  );
}

export function PurchaseCard({ item }: { item: PurchaseHistory }) {
  return (
    <article className="customer-record">
      <div className="customer-record-heading">
        <div className="customer-result-label">
          <span className="customer-record-icon">
            <History size={19} />
          </span>
          <div>
            <span className={`customer-purchase level-${item.purchase_level.toLowerCase()}`}>
              {item.purchase_level}
            </span>
            <p>Mức độ mua hàng</p>
          </div>
        </div>
        <div className="customer-record-time">
          <strong>{modelName('classification', item.model_version)}</strong>
          <span>{dateTime(item.created_at)}</span>
        </div>
      </div>
      <div className="customer-probabilities">
        {(['Low', 'Medium', 'High'] as const).map((label) => {
          const value =
            label === 'Low'
              ? item.probability_low
              : label === 'Medium'
                ? item.probability_medium
                : item.probability_high;
          return (
            <div key={label}>
              <div>
                <span>{label}</span>
                <strong>{probability(value)}</strong>
              </div>
              <progress
                aria-label={`Xác suất ${label}`}
                max={1}
                value={Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0}
              />
            </div>
          );
        })}
      </div>
      <p className="customer-help">
        Xác suất chưa hiệu chuẩn; không cam kết mua hàng hoặc dự báo giao dịch tương lai.
      </p>
      <Provenance item={item} />
    </article>
  );
}

export function SegmentCard({ item }: { item: SegmentHistory }) {
  return (
    <article className="customer-record">
      <div className="customer-record-heading">
        <div className="customer-result-label">
          <span className="customer-record-icon teal">
            <Activity size={19} />
          </span>
          <div>
            <h3>{item.segment_name}</h3>
            <p>Phân nhóm tương tác · cluster {item.cluster}</p>
          </div>
        </div>
        <div className="customer-record-time">
          <strong>{modelName('segmentation', item.model_version)}</strong>
          <span>{dateTime(item.created_at)}</span>
        </div>
      </div>
      <dl className="customer-segment-values">
        <div>
          <dt>Namespace / segment ID</dt>
          <dd>
            <details className="technical-details">
              <summary>Mã nhóm</summary>
              {item.segment_id}
            </details>
          </dd>
        </div>
        <div>
          <dt>Khoảng cách đến tâm cụm</dt>
          <dd>{number(item.distance_to_centroid)}</dd>
        </div>
      </dl>
      <p className="customer-help">
        Khoảng cách trong không gian chuẩn hóa, không phải xác suất. Nhãn nhóm khác nhãn mức độ mua
        hàng.
      </p>
      <Provenance item={item} />
    </article>
  );
}

export function CustomerRecords({
  customerId,
  predictionPath = false,
}: {
  customerId: string;
  predictionPath?: boolean;
}) {
  const { session, revision } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const filters = detailFilters(params, predictionPath);
  const query = useQuery({
    queryKey: ['customer-records', revision, customerId, filters],
    queryFn: async ({ signal }) => {
      const options = {
        params: { customer_id: customerId },
        query: {
          offset: filters.offset,
          limit: filters.limit,
          ...(filters.model_version ? { model_version: filters.model_version } : {}),
        },
        signal,
      };
      if (filters.tab === 'predictions')
        return {
          kind: 'predictions' as const,
          ...(
            await session.client.request(
              'get',
              '/api/v1/customers/{customer_id}/predictions',
              options,
            )
          ).data,
        };
      if (filters.tab === 'segments')
        return {
          kind: 'segments' as const,
          ...(
            await session.client.request('get', '/api/v1/customers/{customer_id}/segments', options)
          ).data,
        };
      return {
        kind: 'behaviors' as const,
        ...(
          await session.client.request('get', '/api/v1/customers/{customer_id}/behaviors', {
            ...options,
            query: { offset: filters.offset, limit: filters.limit },
          })
        ).data,
      };
    },
  });
  const update = (values: Record<string, string | number>) => {
    const next = new URLSearchParams(params);
    Object.entries(values).forEach(([key, value]) =>
      value === '' ? next.delete(key) : next.set(key, String(value)),
    );
    setParams(next);
  };
  return (
    <section className="panel customer-history" aria-label="Dữ liệu và lịch sử khách hàng">
      <div className="customer-tabs" aria-label="Chọn loại dữ liệu">
        {(
          [
            ['behaviors', 'Bản ghi hành vi'],
            ['predictions', 'Lịch sử dự đoán'],
            ['segments', 'Lịch sử phân nhóm'],
          ] as const
        ).map(([tab, label]) => (
          <button
            className={filters.tab === tab ? 'selected' : ''}
            aria-pressed={filters.tab === tab}
            key={tab}
            onClick={() => update({ tab, offset: 0, model_version: '' })}
          >
            {label}
          </button>
        ))}
      </div>
      {filters.tab === 'predictions' && (
        <p className="customer-target-note">
          Mức mua theo tổng lượt mua: Low ≤ 10; 10 &lt; Medium ≤ 15; High &gt; 15.
        </p>
      )}
      <div className="customer-history-tools">
        {filters.tab !== 'behaviors' && (
          <form
            key={`${filters.tab}:${filters.model_version}`}
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              update({ model_version: String(data.get('model_version') ?? ''), offset: 0 });
            }}
          >
            <label>
              Phiên bản mô hình
              <input
                name="model_version"
                defaultValue={filters.model_version}
                maxLength={50}
                placeholder="Để trống: mọi phiên bản"
                autoComplete="off"
              />
            </label>
            <button className="button button-secondary">Lọc lịch sử</button>
          </form>
        )}
        <label>
          Mỗi trang
          <select
            value={filters.limit}
            onChange={(e) => update({ limit: e.target.value, offset: 0 })}
          >
            {[...new Set([10, 20, 50, 100, filters.limit])]
              .sort((a, b) => a - b)
              .map((n) => (
                <option value={n} key={n}>
                  {n} bản ghi
                </option>
              ))}
          </select>
        </label>
      </div>

      {query.isPending || query.isFetching ? (
        <LoadingState label="Đang tải dữ liệu hồ sơ…" />
      ) : query.isError ? (
        <ErrorState
          error={query.error}
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <>
          {!query.data.items.length ? (
            <>
              <EmptyState
                title="Chưa có bản ghi trong trang này"
                description="Khách hàng có thể chưa có snapshot/kết quả đã lưu, hoặc bộ lọc/trang không có dữ liệu. Đây không phải kết quả dự đoán bằng 0."
              />
              {filters.offset > 0 && (
                <button className="button button-secondary" onClick={() => update({ offset: 0 })}>
                  Về trang đầu lịch sử
                </button>
              )}
            </>
          ) : (
            <div className="customer-records">
              {query.data.kind === 'behaviors'
                ? query.data.items.map((item, index) => (
                    <SnapshotCard key={item.id} item={item} first={index === 0} />
                  ))
                : query.data.kind === 'predictions'
                  ? query.data.items.map((item) => <PurchaseCard key={item.id} item={item} />)
                  : query.data.items.map((item) => <SegmentCard key={item.id} item={item} />)}
            </div>
          )}
          <Pagination
            offset={filters.offset}
            limit={filters.limit}
            total={query.data.total}
            count={query.data.items.length}
            onChange={(offset) => update({ offset })}
          />
        </>
      )}
    </section>
  );
}
