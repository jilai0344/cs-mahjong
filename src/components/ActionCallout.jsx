import React from 'react';

const TONES = {
  hu: 'bg-rose-600',
  gang: 'bg-amber-600',
  peng: 'bg-teal-700',
  chi: 'bg-blue-600',
  xi: 'bg-fuchsia-600'
};

/**
 * 桌上大字印章：吃 / 碰 / 杠 / 胡 / 喜。
 * 只做视觉提醒，pointer-events: none，不挡牌桌操作。
 */
export default function ActionCallout({ event }) {
  if (!event) return null;
  return (
    <div
      className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <div key={event.key} className={`action-callout ${TONES[event.tone] || TONES.peng}`}>
        <span className="action-callout-ring" aria-hidden="true" />
        <span className="action-callout-char">{event.char}</span>
        <span className="action-callout-label">
          {event.seatName ? `${event.seatName} · ` : ''}
          {event.label}
        </span>
      </div>
    </div>
  );
}
