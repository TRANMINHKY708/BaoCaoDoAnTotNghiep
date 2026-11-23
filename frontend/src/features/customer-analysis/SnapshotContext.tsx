import { useState } from 'react';
import { EmptyState } from '../../components/states';
import { PurchaseCard, SegmentCard } from '../customers/CustomerRecords';
import { Pagination } from '../customers/CustomerShared';
import { dateTime } from '../customers/customers';
import { timeline, type AnalysisData, type Entry } from './analysis';

function ResultList({ rows }: { rows: Entry[] }) {
  const [offset, setOffset] = useState(0);
  return (
    <>
      {rows.slice(offset, offset + 20).map((row) =>
        row.kind === 'what-if' ? null : (
          <div key={`${row.kind}:${row.item.id}`}>
            <p className="snapshot-model-identity">
              {row.kind === 'predictions' ? 'Dự đoán mức mua' : 'Phân nhóm khách hàng'} ·{' '}
              {row.item.model_id} · Phiên bản {row.item.model_version}
            </p>
            {row.kind === 'predictions' ? (
              <PurchaseCard item={row.item} />
            ) : (
              <SegmentCard item={row.item} />
            )}
          </div>
        ),
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
    </>
  );
}

export function SnapshotContext({
  data,
  customerId,
  initialSnapshotId = '',
  onSelect,
}: {
  data: AnalysisData;
  customerId: string;
  initialSnapshotId?: string;
  onSelect?: (id: string) => void;
}) {
  const [selectedId, setSelectedId] = useState(initialSnapshotId);
  const [selectionLost, setSelectionLost] = useState(false);
  const snapshots = data.snapshots.filter((item) => item.customer_id === customerId);
  const selected = snapshots.find((item) => item.id === selectedId);
  const invalid = !!selectedId && !selected;
  if (invalid) {
    setSelectedId('');
    setSelectionLost(true);
  }
  const predictions = data.predictions.filter((item) => item.customer_id === customerId);
  const segments = data.segments.filter((item) => item.customer_id === customerId);
  const linked = selected
    ? timeline(
        predictions.filter((item) => item.behavior_snapshot_id === selected.id),
        segments.filter((item) => item.behavior_snapshot_id === selected.id),
        [],
        'all',
        'desc',
      )
    : [];
  const known = new Set(snapshots.map((item) => item.id));
  const unresolved = (item: { behavior_snapshot_id: string | null }) =>
    !item.behavior_snapshot_id || !known.has(item.behavior_snapshot_id);
  const unlinked = timeline(
    predictions.filter(unresolved),
    segments.filter(unresolved),
    [],
    'all',
    'desc',
  );
  return (
    <section className="panel snapshot-context" aria-labelledby="snapshot-context-heading">
      <h2 id="snapshot-context-heading">Ngữ cảnh phân tích</h2>
      {selectionLost && (
        <p role="status">
          Snapshot đã chọn không còn trong dữ liệu của khách hàng này. Đã trở về tổng quan.
        </p>
      )}
      <label>
        Chọn snapshot hành vi
        <select
          value={selected?.id ?? ''}
          onChange={(event) => {
            setSelectedId(event.target.value);
            setSelectionLost(false);
            onSelect?.(event.target.value);
          }}
        >
          <option value="">Tổng quan tất cả snapshot</option>
          {snapshots.map((item) => (
            <option key={item.id} value={item.id}>
              {item.id.slice(0, 8)} · {dateTime(item.captured_at)} · {item.source}
            </option>
          ))}
        </select>
      </label>
      {selected ? (
        <>
          <dl className="snapshot-context-meta">
            <div>
              <dt>Snapshot đang chọn</dt>
              <dd title={selected.id}>{selected.id.slice(0, 8)}</dd>
            </div>
            <div>
              <dt>Thời điểm ghi nhận hành vi</dt>
              <dd>{dateTime(selected.captured_at)}</dd>
            </div>
            <div>
              <dt>Nguồn</dt>
              <dd>{selected.source || 'Chưa có thông tin'}</dd>
            </div>
          </dl>
          <details className="technical-details">
            <summary>Thông tin snapshot</summary>
            <p>{selected.id}</p>
          </details>
          <section aria-label="Kết quả của snapshot đang chọn">
            <h3>Kết quả đã lưu của snapshot</h3>

            {!linked.some((row) => row.kind === 'predictions') && (
              <p>Snapshot này chưa có dự đoán đã lưu.</p>
            )}
            {!linked.some((row) => row.kind === 'segments') && (
              <p>Snapshot này chưa có phân nhóm đã lưu.</p>
            )}
            {linked.length ? (
              <ResultList
                key={
                  selected.id + linked.map((row) => ('id' in row.item ? row.item.id : '')).join(':')
                }
                rows={linked}
              />
            ) : (
              <EmptyState
                title="Chưa có kết quả liên kết snapshot"
                description="Không tự chạy mô hình để bổ sung kết quả còn thiếu."
              />
            )}
          </section>
        </>
      ) : null}
      <details className="snapshot-unlinked">
        <summary>Kết quả chưa xác định snapshot liên kết ({unlinked.length})</summary>
        <p>Kết quả chưa xác định được bản ghi hành vi nguồn.</p>
        {unlinked.length ? (
          <ResultList
            key={unlinked.map((row) => ('id' in row.item ? row.item.id : '')).join(':')}
            rows={unlinked}
          />
        ) : (
          <p>Không có kết quả chưa xác định snapshot.</p>
        )}
      </details>
      <p>Kịch bản mô phỏng nằm trong lịch sử bên dưới.</p>
    </section>
  );
}
