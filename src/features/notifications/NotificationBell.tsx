import type { PartnerId } from '../../domain/models';
import type { NotificationRecord } from '../../storage/schema';

interface NotificationBellProps {
  partnerId: PartnerId;
  notifications: NotificationRecord[];
  onClick: () => void;
}

export function NotificationBell({
  partnerId,
  notifications,
  onClick,
}: NotificationBellProps) {
  const unreadCount = notifications.filter(
    (notification) =>
      notification.recipientId === partnerId && notification.readAt === null,
  ).length;

  return (
    <button
      type="button"
      aria-label={`${unreadCount} 条未读提醒`}
      onClick={onClick}
    >
      <span aria-hidden="true">🔔</span>
      {unreadCount > 0 && <span aria-hidden="true">{unreadCount}</span>}
    </button>
  );
}
