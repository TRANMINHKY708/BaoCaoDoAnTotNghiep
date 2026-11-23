import { customerCode } from '../../components/customerIdentity';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useWorkspace } from '../../app/context';
import { useAssistant } from '../assistant/AssistantContext';
import { ExportButtons } from '../reports/ExportButtons';
import { ApiError } from '../../api/errors';
import { EmptyState, ErrorState, LoadingState } from '../../components/states';
import { StatusBadge, Pagination } from '../customers/CustomerShared';
import { dateTime, isCustomerId } from '../customers/customers';
import { SnapshotCard, PurchaseCard, SegmentCard } from '../customers/CustomerRecords';
import { checkedHistory, checkedSaved } from '../what-if/whatIf';
import { WhatIfResults } from '../what-if/WhatIfResults';
import {
  allPages,
  timeline,
  analysisLink,
  HistoryLimitError,
  type AnalysisData,
  type Scenario,
} from './analysis';
import '../customers/customers.css';
import '../predictions/predictions.css';
import './analysis.css';
import { SnapshotContext } from './SnapshotContext';
import { requestedContext } from './contextNavigation';
import { returnToBatch } from '../bulk-analytics/navigation';
import { BehaviourAdvice } from '../insights/BehaviourAdvice';
import { ChurnRiskCard } from '../churn/ChurnRiskCard';
export default function CustomerAnalysisPage() {
  const { customerId = '' } = useParams();
  const { revision } = useWorkspace();
  return <Analysis key={`${customerId}:${revision}`} customerId={customerId} />;
}
function ScenarioDetail({ item, customerId }: { item: Scenario; customerId: string }) {
  const { session, revision } = useWorkspace();
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ['customer-analysis-scenario', revision, customerId, item.scenario_id],
    enabled: open,
    queryFn: async ({ signal }) => {
      const saved = checkedSaved(
        (
          await session.client.request('get', '/api/v1/what-if/scenarios/{scenario_id}', {
            params: { scenario_id: item.scenario_id },
            signal,
          })
        ).data,
      );
      if (
        saved.scenario_id !== item.scenario_id ||
        saved.current_customer_id !== customerId ||
        saved.original_customer_id !== customerId
      )
        throw new ApiError('protocol');
      return saved;
    },
  });
  return (
    <article className="customer-record">
      <h3>What-if · {item.name}</h3>
      <p>{dateTime(item.created_at)} · Đã lưu</p>
      <p>
        {item.integrity_status === 'verified'
          ? `${item.baseline_label} → ${item.scenario_label}`
          : 'Nội dung chưa được xác minh; không suy diễn kết quả.'}
      </p>
      <p>
        Mô hình mức mua: {item.models?.classification ?? 'Chưa xác minh'} · Phân nhóm:{' '}
        {item.models?.segmentation ?? 'Không có thông tin'}
      </p>

      {item.integrity_status === 'verified' && (
        <button className="button button-secondary" onClick={() => setOpen(!open)}>
          {open ? 'Ẩn chi tiết kịch bản' : 'Xem chi tiết kịch bản'}
        </button>
      )}
      {open &&
        (query.isPending ? (
          <LoadingState label="Đang tải kịch bản đã lưu…" />
        ) : query.isError ? (
          <ErrorState error={query.error} />
        ) : (
          query.data && (
            <>
              <p>Snapshot nguồn: {query.data.current_snapshot_id ?? 'Không còn liên kết'}</p>
              <WhatIfResults
                preview={query.data.comparison.baseline}
                comparison={query.data.comparison}
                stored
                storedExport={{
                  source: 'stored',
                  kind: 'what_if',
                  customer_id: customerId,
                  record_id: item.scenario_id,
                }}
              />
            </>
          )
        ))}
    </article>
  );
}
function Analysis({ customerId }: { customerId: string }) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const batchReturn = returnToBatch(params, location.state);
  const { snapshotId: requestedSnapshotId } = requestedContext(params);
  const { session, status, revision } = useWorkspace();
  const assistant = useAssistant();
  const [kind, setKind] = useState('all'),
    [direction, setDirection] = useState<'asc' | 'desc'>('desc'),
    [offset, setOffset] = useState(0),
    [snapshotOffset, setSnapshotOffset] = useState(0);
  const customer = useQuery({
    queryKey: ['analysis-customer', revision, customerId],
    enabled: status === 'connected' && isCustomerId(customerId),
    queryFn: async ({ signal }) => {
      const row = (
        await session.client.request('get', '/api/v1/customers/{customer_id}', {
          params: { customer_id: customerId },
          signal,
        })
      ).data;
      if (row.id !== customerId) throw new ApiError('protocol');
      return row;
    },
  });
  const histories = useQuery({
    queryKey: ['customer-analysis-history', revision, customerId],
    enabled: !!customer.data && status === 'connected',
    queryFn: async ({ signal }): Promise<AnalysisData> => {
      const options = (offset: number) => ({
        params: { customer_id: customerId },
        query: { offset, limit: 100 },
        signal,
      });
      const [snapshots, predictions, segments, scenarios] = await Promise.all([
        allPages(
          async (offset) =>
            (
              await session.client.request(
                'get',
                '/api/v1/customers/{customer_id}/behaviors',
                options(offset),
              )
            ).data,
          (item) => item.customer_id === customerId,
          (item) => item.id,
        ),
        allPages(
          async (offset) =>
            (
              await session.client.request(
                'get',
                '/api/v1/customers/{customer_id}/predictions',
                options(offset),
              )
            ).data,
          (item) => item.customer_id === customerId,
          (item) => item.id,
        ),
        allPages(
          async (offset) =>
            (
              await session.client.request(
                'get',
                '/api/v1/customers/{customer_id}/segments',
                options(offset),
              )
            ).data,
          (item) => item.customer_id === customerId,
          (item) => item.id,
        ),
        allPages(
          async (offset) =>
            checkedHistory(
              (
                await session.client.request('get', '/api/v1/what-if/scenarios', {
                  query: { customer_id: customerId, offset, limit: 100 },
                  signal,
                })
              ).data,
            ),
          (item) => item.customer_id === customerId,
          (item) => item.scenario_id,
        ),
      ]);
      return {
        snapshots: snapshots.sort(
          (a, b) =>
            Date.parse(b.captured_at) - Date.parse(a.captured_at) || b.id.localeCompare(a.id),
        ),
        predictions,
        segments,
        scenarios,
      };
    },
  });
  const data = histories.data;
  const snapshotId =
    isCustomerId(requestedSnapshotId) &&
    !histories.isFetching &&
    !histories.isError &&
    data?.snapshots.some(
      (item) => item.customer_id === customerId && item.id === requestedSnapshotId,
    )
      ? requestedSnapshotId
      : undefined;
  const rows = data
    ? timeline(data.predictions, data.segments, data.scenarios, kind, direction)
    : [];
  return (
    <div className="customers-workspace customer-analysis">
      <Link className="text-link" to={`/customers/${customerId}`}>
        ← Về chi tiết khách hàng
      </Link>
      <h1>Hồ sơ phân tích khách hàng</h1>
      {batchReturn ? (
        <Link className="button button-secondary" to={batchReturn.to} state={batchReturn.state}>
          Về phân tích hàng loạt
        </Link>
      ) : (
        params.has('batch_filters') && (
          <p role="status">
            Ngữ cảnh quay lại dashboard không hợp lệ hoặc đã mất bộ lọc riêng; không tự mở đường dẫn
            thay thế.
          </p>
        )
      )}
      <p>Lịch sử phân tích đã lưu của khách hàng.</p>
      {status !== 'connected' ? (
        <EmptyState
          title="Kết nối để xem hồ sơ phân tích"
          description="Đăng nhập để đọc dữ liệu theo quyền hiện tại."
          connection
        />
      ) : !isCustomerId(customerId) ? (
        <EmptyState title="Customer ID không hợp lệ" description="Chọn khách hàng từ danh sách." />
      ) : customer.isPending ? (
        <LoadingState label="Đang tải khách hàng…" />
      ) : customer.isError ? (
        <ErrorState error={customer.error} />
      ) : (
        customer.data && (
          <>
            <section className="panel">
              <h2 title={customer.data.external_id}>{customerCode(customer.data.external_id)}</h2>
              <StatusBadge active={customer.data.is_active} />
              <p>Ngày tạo: {dateTime(customer.data.created_at)}</p>
              <ExportButtons target={{ source: 'customer', customer_id: customerId, limit: 20 }} />
              <div className="customer-context-links">
                <Link
                  className="button button-secondary"
                  to={analysisLink('/predictions', customerId, snapshotId)}
                >
                  Dự đoán khách hàng này
                </Link>
                <Link
                  className="button button-secondary"
                  to={analysisLink('/segmentation', customerId, snapshotId)}
                >
                  Phân nhóm khách hàng này
                </Link>
                <Link
                  className="button button-secondary"
                  to={analysisLink('/what-if', customerId, snapshotId)}
                >
                  Phân tích What-if
                </Link>
                <Link
                  className="button button-secondary"
                  to={analysisLink('/assistant', customerId)}
                  onClick={(event) => {
                    if (assistant) {
                      event.preventDefault();
                      assistant.open(customerId);
                    }
                  }}
                >
                  Hỏi Trợ lý AI
                </Link>
              </div>
            </section>
            {histories.isPending || histories.isFetching ? (
              <LoadingState label="Đang tổng hợp lịch sử đã lưu…" />
            ) : histories.isError ? (
              <section className="panel">
                {histories.error instanceof HistoryLimitError ? (
                  <p role="alert">{histories.error.message}</p>
                ) : (
                  <ErrorState error={histories.error} />
                )}
                <button
                  className="button button-secondary"
                  onClick={() => void histories.refetch()}
                >
                  Tải lại lịch sử
                </button>
              </section>
            ) : (
              data && (
                <>
                  <section className="panel">
                    <h2>Tổng quan dữ liệu đã lưu</h2>
                    <p>
                      {data.snapshots.length} snapshot · {data.predictions.length} dự đoán ·{' '}
                      {data.segments.length} phân nhóm · {data.scenarios.length} kịch bản What-if
                    </p>
                    <p>
                      Snapshot gần nhất:{' '}
                      {data.snapshots[0]
                        ? dateTime(data.snapshots[0].captured_at)
                        : 'Chưa có snapshot'}
                    </p>
                  </section>
                  <SnapshotContext
                    key={requestedSnapshotId}
                    data={data}
                    customerId={customerId}
                    initialSnapshotId={requestedSnapshotId}
                    onSelect={(id) => {
                      const next = new URLSearchParams(params);
                      if (id) next.set('snapshot_id', id);
                      else next.delete('snapshot_id');
                      setParams(next, { state: batchReturn?.state });
                    }}
                  />
                  {(() => {
                    const focus =
                      data.snapshots.find((item) => item.id === snapshotId) ?? data.snapshots[0];
                    return focus ? (
                      <>
                        <ChurnRiskCard
                          key={focus.id}
                          snapshot={focus}
                          capturedAt={dateTime(focus.captured_at)}
                        />
                        <BehaviourAdvice
                          values={focus as unknown as Record<string, number | null>}
                          capturedAt={dateTime(focus.captured_at)}
                        />
                      </>
                    ) : null;
                  })()}
                  <section className="panel">
                    <h2>Snapshot hành vi</h2>
                    {data.snapshots.length ? (
                      data.snapshots
                        .slice(snapshotOffset, snapshotOffset + 5)
                        .map((item, i) => (
                          <SnapshotCard key={item.id} item={item} first={i === 0} />
                        ))
                    ) : (
                      <EmptyState
                        title="Chưa có snapshot"
                        description="Không tự bổ sung dữ liệu hành vi còn thiếu."
                      />
                    )}
                    {data.snapshots.length > 5 && (
                      <Pagination
                        offset={snapshotOffset}
                        limit={5}
                        total={data.snapshots.length}
                        count={data.snapshots.slice(snapshotOffset, snapshotOffset + 5).length}
                        onChange={setSnapshotOffset}
                      />
                    )}
                  </section>
                  <section className="panel">
                    <h2>Lịch sử phân tích thống nhất</h2>
                    <div className="analysis-filters">
                      <label>
                        Loại phân tích
                        <select
                          value={kind}
                          onChange={(e) => {
                            setKind(e.target.value);
                            setOffset(0);
                          }}
                        >
                          <option value="all">Tất cả</option>
                          <option value="predictions">Dự đoán</option>
                          <option value="segments">Phân nhóm</option>
                          <option value="what-if">What-if</option>
                        </select>
                      </label>
                      <label>
                        Thứ tự thời gian
                        <select
                          value={direction}
                          onChange={(e) => {
                            setDirection(e.target.value as 'asc' | 'desc');
                            setOffset(0);
                          }}
                        >
                          <option value="desc">Mới nhất trước</option>
                          <option value="asc">Cũ nhất trước</option>
                        </select>
                      </label>
                    </div>
                    {rows.length ? (
                      rows.slice(offset, offset + 20).map((row) => (
                        <div
                          key={row.kind + ('id' in row.item ? row.item.id : row.item.scenario_id)}
                        >
                          {row.kind === 'predictions' ? (
                            <>
                              <p>
                                Dự đoán · Snapshot:{' '}
                                {row.item.behavior_snapshot_id ?? 'Không liên kết'}
                              </p>
                              <PurchaseCard item={row.item} />
                            </>
                          ) : row.kind === 'segments' ? (
                            <>
                              <p>
                                Phân nhóm · Snapshot:{' '}
                                {row.item.behavior_snapshot_id ?? 'Không liên kết'}
                              </p>
                              <SegmentCard item={row.item} />
                            </>
                          ) : (
                            <ScenarioDetail item={row.item} customerId={customerId} />
                          )}
                        </div>
                      ))
                    ) : (
                      <EmptyState
                        title="Chưa có lịch sử theo bộ lọc"
                        description="Chỉ kết quả đã lưu và liên kết đúng khách hàng mới xuất hiện."
                      />
                    )}
                    {rows.length > 20 && (
                      <Pagination
                        offset={offset}
                        limit={20}
                        total={rows.length}
                        count={rows.slice(offset, offset + 20).length}
                        onChange={setOffset}
                      />
                    )}
                  </section>
                </>
              )
            )}
          </>
        )
      )}
    </div>
  );
}
