// Display names only. Wire values, model selection and permissions are unchanged.
export function modelName(task: string, version: string) {
  if (task === 'classification' && version === '1.0.0') return 'Mức mua · bản đầy đủ';
  if (task === 'classification' && version === '2.0.0-snapshot-conservative12')
    return 'Mức mua · bản chọn lọc';
  if (task === 'segmentation' && version === '1.0.0') return 'Phân nhóm · bản ban đầu';
  if (task === 'segmentation' && version === '2.0.0-snapshot-k3')
    return 'Phân nhóm tương tác · bản chọn lọc';
  return 'Phiên bản khác';
}

export function segmentCaption(id: string) {
  const engagement: Record<string, string> = {
    engagement_low: 'Tương tác thấp',
    engagement_medium: 'Tương tác trung bình',
    engagement_high: 'Tương tác cao',
  };
  if (engagement[id]) return engagement[id];
  const match = /^legacy:1\.0\.0:cluster:([012])$/.exec(id);
  return match ? `Nhóm ${match[1]} · bản ban đầu` : 'Nhóm chưa có tên';
}
