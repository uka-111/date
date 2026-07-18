import type { PartnerId } from '../../domain/models';
import type { NotificationRecord } from '../../storage/schema';

const notificationLabels: Record<NotificationRecord['kind'], string> = {
  created: '新的约会邀请',
  adjusted: '新的调整建议',
  confirmed: '约会已经确认',
  rejected: '约会被拒绝',
  cancelled: '约会已取消',
};

interface NotificationListProps {
  partnerId: PartnerId;
  notifications: NotificationRecord[];
  onOpen: (notification: NotificationRecord) => void;
}

export function NotificationList({
  partnerId,
  notifications,
  onOpen,
}: NotificationListProps) {
  const visible = notifications
    .filter((notification) => notification.recipientId === partnerId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  if (visible.length === 0) return <p>暂时没有提醒。</p>;

  return (
    <ul aria-label="提醒列表">
      {visible.map((notification) => (
        <li key={notification.id}>
          <button type="button" onClick={() => onOpen(notification)}>
            {notificationLabels[notification.kind]}
            {notification.readAt === null && <span> · 未读</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}
