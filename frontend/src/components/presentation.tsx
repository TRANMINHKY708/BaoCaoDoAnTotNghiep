import type { ReactNode } from 'react';

export function TechnicalDetails({
  children,
  summary = 'Thông tin kỹ thuật',
}: {
  children: ReactNode;
  summary?: string;
}) {
  return (
    <details className="technical-details">
      <summary>{summary}</summary>
      <div className="technical-content">{children}</div>
    </details>
  );
}

export function ModelDetails({
  model,
}: {
  model: {
    model_version: string;
    model_id?: string;
    feature_count?: number;
    artifact_sha256?: string;
    label_namespace?: string;
    features?: string[];
  };
}) {
  return (
    <TechnicalDetails>
      <dl>
        {model.model_id && (
          <div>
            <dt>Mã mô hình</dt>
            <dd>{model.model_id}</dd>
          </div>
        )}
        <div>
          <dt>Mã phiên bản</dt>
          <dd>{model.model_version}</dd>
        </div>
        {model.feature_count !== undefined && (
          <div>
            <dt>Số biến đầu vào</dt>
            <dd>{model.feature_count}</dd>
          </div>
        )}
        {model.artifact_sha256 && (
          <div>
            <dt>Artifact checksum · SHA256</dt>
            <dd>
              <code>{model.artifact_sha256}</code>
            </dd>
          </div>
        )}
        {model.label_namespace && (
          <div>
            <dt>Hệ nhãn</dt>
            <dd>{model.label_namespace}</dd>
          </div>
        )}
        {model.features && (
          <div>
            <dt>Tên biến trong dữ liệu</dt>
            <dd>{model.features.join(', ')}</dd>
          </div>
        )}
      </dl>
    </TechnicalDetails>
  );
}
