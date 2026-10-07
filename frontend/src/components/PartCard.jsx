export function partElementId(partNumber) {
  return `part-${partNumber.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

function formatPrice(price) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(Number(price));
}

function formatSpecName(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ');
}

export default function PartCard({ match }) {
  const { part, relevance_score: relevanceScore } = match;

  return (
    <article
      className="part-card"
      id={partElementId(part.partNumber)}
      tabIndex={-1}
      aria-label={`${part.partNumber}, ${part.name}`}
    >
      <header className="part-card-header">
        <div>
          <p className="part-number">{part.partNumber}</p>
          <h3>{part.name}</h3>
        </div>
        <span className="relevance-score">
          {Math.round(Number(relevanceScore) * 100)}% match
        </span>
      </header>
      <dl className="part-facts">
        <div>
          <dt>Package</dt>
          <dd>{part.package}</dd>
        </div>
        <div>
          <dt>Price</dt>
          <dd>{formatPrice(part.price)}</dd>
        </div>
        <div>
          <dt>Stock</dt>
          <dd>{Number(part.stock).toLocaleString()}</dd>
        </div>
      </dl>
      <dl className="spec-list" aria-label="Key specifications">
        {Object.entries(part.keySpecs || {}).map(([name, value]) => (
          <div key={name}>
            <dt>{formatSpecName(name)}</dt>
            <dd>{String(value)}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}