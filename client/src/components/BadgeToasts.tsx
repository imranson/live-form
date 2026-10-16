import type { Badge } from '../../../shared/types.js';

export function BadgeToasts({ badges }: { badges: readonly Badge[] }) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {badges.map((b) => (
        <div key={b.id} className="toast">
          <span className="toast__emoji" aria-hidden="true">
            {b.emoji}
          </span>
          <div>
            <p className="toast__title">New badge: {b.name}</p>
            <p className="toast__desc">{b.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
