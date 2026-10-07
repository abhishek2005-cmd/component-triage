import { partElementId } from './PartCard.jsx';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default function DraftReply({ text, matches, onPartCitation }) {
  const partNumbers = matches
    .map((match) => match.part.partNumber)
    .filter(Boolean)
    .sort((first, second) => second.length - first.length);
  const numberToPart = new Map(partNumbers.map((partNumber) => [partNumber, partNumber]));
  const pattern = partNumbers.length
    ? new RegExp(`(${partNumbers.map(escapeRegExp).join('|')})`, 'g')
    : null;

  if (!text) {
    return <p className="draft-empty">No draft reply is available yet.</p>;
  }

  return (
    <p className="draft-copy">
      {(pattern ? text.split(pattern) : [text]).map((segment, index) => {
        if (numberToPart.has(segment)) {
          return (
            <button
              className="draft-citation"
              type="button"
              key={`${segment}-${index}`}
              aria-label={`Show catalog part ${segment}`}
              onClick={() => onPartCitation(partElementId(segment))}
            >
              {segment}
            </button>
          );
        }

        return segment.split('\n').map((line, lineIndex) => (
          <span key={`${index}-${lineIndex}`}>
            {line}
            {lineIndex < segment.split('\n').length - 1 ? <br /> : null}
          </span>
        ));
      })}
    </p>
  );
}