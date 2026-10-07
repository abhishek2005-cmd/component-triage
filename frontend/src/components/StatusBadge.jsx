export default function StatusBadge({ status, statuses }) {
  const metadata = statuses.find((item) => item.value === status);
  const label = metadata?.label || status || 'Unknown';
  const tone = metadata?.tone || 'neutral';

  return <span className={`status-badge tone-${tone}`}>{label}</span>;
}