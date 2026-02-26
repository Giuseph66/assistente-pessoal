import { STTFinalEvent, STTPartialEvent } from '@neo/shared';
import { useSttState } from '../store/sttStore';

type Props = {
  partial?: STTPartialEvent | null;
  finals?: STTFinalEvent[];
  emptyLabel?: string;
};

export function CaptionsPanel({ partial, finals, emptyLabel }: Props): JSX.Element {
  const sttState = useSttState();
  const resolvedPartial = partial ?? sttState.partial;
  const resolvedFinals = finals ?? sttState.finals;
  const resolvedEmpty = emptyLabel ?? 'Nenhuma transcricao ainda.';

  return (
    <div className="captions-panel">
      {resolvedPartial?.text && <div className="caption-partial">{resolvedPartial.text}</div>}
      {resolvedFinals.length === 0 ? (
        <div className="caption-empty">{resolvedEmpty}</div>
      ) : (
        resolvedFinals.map((item, index) => (
          <div key={`${item.ts}-${index}`} className="caption-final">
            {item.text}
          </div>
        ))
      )}
    </div>
  );
}
