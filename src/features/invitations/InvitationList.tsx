import type { Invitation, PartnerId, Period } from '../../domain/models';

const periodLabels: Record<Period, string> = {
  all_day: '全天',
  morning: '上午',
  afternoon: '下午',
  evening: '晚上',
};

interface InvitationListProps {
  partnerId: PartnerId;
  invitations: Invitation[];
  today?: string;
  onSelect: (invitation: Invitation) => void;
}

function InvitationGroup({
  title,
  invitations,
  onSelect,
}: {
  title: string;
  invitations: Invitation[];
  onSelect: (invitation: Invitation) => void;
}) {
  return (
    <section className="schedule-group card" aria-label={title}>
      <h2>{title}</h2>
      {invitations.length === 0 ? (
        <p>暂时没有安排。</p>
      ) : (
        <ul>
          {invitations.map((invitation) => (
            <li key={invitation.id}>
              <button className="schedule-card" type="button" onClick={() => onSelect(invitation)}>
                <strong>{invitation.activity}</strong>
                <span>
                  {invitation.date} · {periodLabels[invitation.period]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function InvitationList({
  partnerId,
  invitations,
  today = new Date().toISOString().slice(0, 10),
  onSelect,
}: InvitationListProps) {
  const ascending = (left: Invitation, right: Invitation) =>
    left.date.localeCompare(right.date) || left.createdAt.localeCompare(right.createdAt);
  const descending = (left: Invitation, right: Invitation) =>
    right.updatedAt.localeCompare(left.updatedAt);

  const needsAction = invitations
    .filter(
      (invitation) =>
        (invitation.status === 'pending' && invitation.recipientId === partnerId) ||
        (invitation.status === 'adjustment_pending' &&
          invitation.senderId === partnerId),
    )
    .sort(ascending);

  const sentByMe = invitations
    .filter(
      (invitation) =>
        invitation.senderId === partnerId && invitation.status === 'pending',
    )
    .sort(ascending);

  const confirmed = invitations
    .filter(
      (invitation) =>
        invitation.status === 'confirmed' && invitation.date >= today,
    )
    .sort(ascending);

  const history = invitations
    .filter(
      (invitation) =>
        invitation.status === 'rejected' ||
        invitation.status === 'cancelled' ||
        (invitation.status === 'confirmed' && invitation.date < today),
    )
    .sort(descending);

  return (
    <div className="schedule-list">
      <InvitationGroup title="待我处理" invitations={needsAction} onSelect={onSelect} />
      <InvitationGroup title="我发起的" invitations={sentByMe} onSelect={onSelect} />
      <InvitationGroup title="已确认" invitations={confirmed} onSelect={onSelect} />
      <InvitationGroup title="历史记录" invitations={history} onSelect={onSelect} />
    </div>
  );
}
