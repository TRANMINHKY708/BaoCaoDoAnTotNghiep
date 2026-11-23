import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWorkspace } from '../../app/context';
import { ApiError } from '../../api/errors';
import { EmptyState, ErrorState, LoadingState } from '../../components/states';
import { Pagination } from '../customers/CustomerShared';
import { dateTime, isCustomerId } from '../customers/customers';
import { checkedHistory, checkedSaved } from './whatIf';
import { WhatIfResults } from './WhatIfResults';

export function WhatIfHistory({ customerId }: { customerId: string }) {
  const { session, revision } = useWorkspace();
  const [opened, setOpened] = useState(false),
    [onlyCustomer, setOnlyCustomer] = useState(false),
    [version, setVersion] = useState<'' | '1.0.0' | '2.0.0-snapshot-conservative12'>(''),
    [offset, setOffset] = useState(0),
    [detail, setDetail] = useState('');
  const history = useQuery({
    queryKey: ['what-if-history', revision, onlyCustomer ? customerId : '', version, offset],
    enabled: opened && (!onlyCustomer || isCustomerId(customerId)),
    queryFn: async ({ signal }) =>
      checkedHistory(
        (
          await session.client.request('get', '/api/v1/what-if/scenarios', {
            signal,
            query: {
              offset,
              limit: 20,
              ...(onlyCustomer && isCustomerId(customerId) ? { customer_id: customerId } : {}),
              ...(version ? { classification_model_version: version } : {}),
            },
          })
        ).data,
      ),
  });
  const saved = useQuery({
    queryKey: ['what-if-detail', revision, detail],
    enabled: opened && !!detail,
    queryFn: async ({ signal }) => {
      const value = checkedSaved(
        (
          await session.client.request('get', '/api/v1/what-if/scenarios/{scenario_id}', {
            signal,
            params: { scenario_id: detail },
          })
        ).data,
      );
      if (value.scenario_id !== detail) throw new ApiError('protocol');
      return value;
    },
  });
  return (
    <section className="panel whatif-history" aria-label="Lịch sử What-if">
      <div className="prediction-section-heading">
        <div>
          <span className="eyebrow">LỊCH SỬ / DỮ LIỆU DÙNG CHUNG</span>
          <h2>Kịch bản đã lưu</h2>
        </div>
        <button
          className="button button-secondary"
          disabled={opened && onlyCustomer && !isCustomerId(customerId)}
          onClick={() => {
            if (opened) void history.refetch();
            else setOpened(true);
          }}
        >
          Tải lịch sử kịch bản
        </button>
      </div>
      <p className="prediction-help">Chỉ hiển thị kịch bản đã lưu.</p>
      {opened && (
        <>
          <div className="whatif-history-filters">
            <label>
              <input
                type="checkbox"
                checked={onlyCustomer}
                disabled={!isCustomerId(customerId)}
                onChange={(e) => {
                  setOnlyCustomer(e.target.checked);
                  setOffset(0);
                  setDetail('');
                }}
              />{' '}
              Chỉ khách hàng đang chọn
            </label>
            <label>
              Phiên bản lịch sử
              <select
                value={version}
                onChange={(e) => {
                  setVersion(e.target.value as typeof version);
                  setOffset(0);
                  setDetail('');
                }}
              >
                <option value="">Tất cả phiên bản</option>
                <option value="1.0.0">Mức mua · bản đầy đủ</option>
                <option value="2.0.0-snapshot-conservative12">Mức mua · bản chọn lọc</option>
              </select>
            </label>
          </div>
          {onlyCustomer && !isCustomerId(customerId) ? (
            <EmptyState
              title="Chọn khách hàng để lọc lịch sử"
              description="Không tự chuyển bộ lọc khách hàng thành toàn workspace."
            />
          ) : history.isPending ? (
            <LoadingState label="Đang đọc lịch sử kịch bản…" />
          ) : history.isError ? (
            <ErrorState
              error={history.error}
              onRetry={() => {
                void history.refetch();
              }}
            />
          ) : (
            history.data && (
              <>
                {!history.data.items.length ? (
                  <EmptyState
                    title="Chưa có kịch bản theo bộ lọc"
                    description="Phân tích và so sánh không tự lưu. Một số phiên bản chưa hỗ trợ lưu kết quả."
                  />
                ) : (
                  <ul className="whatif-history-list">
                    {history.data.items.map((r) => (
                      <li key={r.scenario_id}>
                        <div>
                          <strong>{r.name}</strong>
                          <small>
                            {dateTime(r.created_at)} ·{' '}
                            {r.integrity_status === 'verified'
                              ? `${r.baseline_label} → ${r.scenario_label}`
                              : 'Chưa xác minh tính toàn vẹn; không diễn giải nhãn'}
                          </small>
                          <details className="technical-details">
                            <summary>Mã kịch bản</summary>
                            <code>{r.scenario_id}</code>
                          </details>
                        </div>
                        <button
                          className="button button-secondary"
                          onClick={() => setDetail(r.scenario_id)}
                        >
                          Xem kịch bản
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <Pagination
                  offset={history.data.offset}
                  limit={history.data.limit}
                  total={history.data.total}
                  count={history.data.items.length}
                  onChange={(n) => {
                    setOffset(n);
                    setDetail('');
                  }}
                />
              </>
            )
          )}
          {!!detail &&
            (saved.isPending ? (
              <LoadingState label="Đang đọc chi tiết kịch bản…" />
            ) : saved.isError ? (
              <ErrorState error={saved.error} />
            ) : (
              saved.data && (
                <div className="whatif-stored-detail">
                  <h3>{saved.data.name}</h3>
                  <p>{saved.data.description}</p>
                  <p>
                    Đã lưu {dateTime(saved.data.created_at)} ·{' '}
                    {saved.data.source_link_status === 'attached'
                      ? 'Còn liên kết bản ghi gốc'
                      : saved.data.source_link_status === 'detached'
                        ? 'Liên kết nguồn đã tách; giữ dữ liệu lịch sử'
                        : 'Dữ liệu nhập trực tiếp'}
                  </p>
                  <WhatIfResults
                    preview={saved.data.comparison.baseline}
                    comparison={saved.data.comparison}
                    stored
                    storedExport={
                      saved.data.current_customer_id
                        ? {
                            source: 'stored',
                            kind: 'what_if',
                            customer_id: saved.data.current_customer_id,
                            record_id: saved.data.scenario_id,
                          }
                        : undefined
                    }
                  />
                </div>
              )
            ))}
        </>
      )}
    </section>
  );
}
