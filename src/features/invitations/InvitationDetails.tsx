import { useState } from 'react';
import type { DateBookingRepository } from '../../app/repository';
import {
  respondToInvitation,
  type InvitationResponse,
} from '../../domain/invitations';
import type { Invitation, PartnerId, Period } from '../../domain/models';
import type { NotificationKind } from '../../storage/schema';
import { AdjustmentForm } from './AdjustmentForm';
import { ActivityTags } from './ActivityTags';

const periodLabels: Record<Period, string> = {
  all_day: '全天',
  morning: '上午',
  afternoon: '下午',
  evening: '晚上',
};

const statusLabels: Record<Invitation['status'], string> = {
  pending: '待确认',
  adjustment_pending: '等待确认调整',
  confirmed: '已确认',
  rejected: '已拒绝',
  cancelled: '已取消',
};

const actionLabels: Record<Invitation['history'][number]['action'], string> = {
  created: '发起了约会',
  confirmed: '确认了约会',
  rejected: '拒绝了约会',
  cancelled: '取消了约会',
  adjustment_suggested: '提出了调整建议',
  adjustment_accepted: '接受了调整建议',
};

interface InvitationDetailsProps {
  invitation: Invitation;
  partnerId: PartnerId;
  repository: DateBookingRepository;
  onUpdated: (invitation: Invitation) => void;
}

function notificationKind(response: InvitationResponse): NotificationKind {
  switch (response.type) {
    case 'suggest-adjustment':
      return 'adjusted';
    case 'confirm':
    case 'accept-adjustment':
      return 'confirmed';
    case 'reject':
      return 'rejected';
    case 'cancel':
      return 'cancelled';
  }
}

export function InvitationDetails({
  invitation,
  partnerId,
  repository,
  onUpdated,
}: InvitationDetailsProps) {
  const [current, setCurrent] = useState(invitation);
  const [showAdjustment, setShowAdjustment] = useState(false);
  const [confirmation, setConfirmation] = useState<'reject' | 'cancel' | null>(
    null,
  );
  const [error, setError] = useState('');

  const isSender = current.senderId === partnerId;
  const isRecipient = current.recipientId === partnerId;
  const isTerminal = current.status === 'rejected' || current.status === 'cancelled';

  function applyResponse(response: InvitationResponse) {
    try {
      const updated = respondToInvitation(current, partnerId, response);
      const recipientId =
        partnerId === updated.senderId ? updated.recipientId : updated.senderId;
      repository.saveInvitationWithNotification(updated, {
        id: crypto.randomUUID(),
        recipientId,
        invitationId: updated.id,
        kind: notificationKind(response),
        createdAt: updated.updatedAt,
        readAt: null,
      });
      setCurrent(updated);
      setShowAdjustment(false);
      setConfirmation(null);
      setError('');
      onUpdated(updated);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '操作失败，请重试');
    }
  }

  const latestAdjustment = [...current.history]
    .reverse()
    .find((entry) => entry.action === 'adjustment_suggested');

  return (
    <article
      className="invitation-details card"
      aria-labelledby={`invitation-${current.id}`}
    >
      <h3 id={`invitation-${current.id}`}>
        <ActivityTags activities={current.activity} />
      </h3>
      <dl>
        <div>
          <dt>发起方</dt>
          <dd>{current.senderId === 'him' ? '他' : '她'}</dd>
        </div>
        <div>
          <dt>日期</dt>
          <dd>{current.date}</dd>
        </div>
        <div>
          <dt>时段</dt>
          <dd>{current.periods.map((period) => periodLabels[period]).join('、')}</dd>
        </div>
        <div>
          <dt>状态</dt>
          <dd>{statusLabels[current.status]}</dd>
        </div>
      </dl>
      {current.note && <p>{current.note}</p>}

      {current.status === 'adjustment_pending' && latestAdjustment && (
        <section aria-label="最新调整建议">
          <h4>最新调整建议</h4>
          <p>
            {latestAdjustment.proposedDate}
            {latestAdjustment.proposedPeriods?.length ? (
              <>
                {' · '}
                {latestAdjustment.proposedPeriods
                  .map((period) => periodLabels[period])
                  .join('、')}
              </>
            ) : null}
            {latestAdjustment.proposedActivity?.length ? (
              <>
                {' · '}
                <ActivityTags activities={latestAdjustment.proposedActivity} />
              </>
            ) : null}
          </p>
          {latestAdjustment.note && <p>{latestAdjustment.note}</p>}
        </section>
      )}

      <section aria-label="状态记录">
        <h4>状态记录</h4>
        <ol>
          {current.history.map((entry) => (
            <li key={entry.id}>
              {entry.actorId === 'him' ? '他' : '她'}{actionLabels[entry.action]}
            </li>
          ))}
        </ol>
      </section>

      {error && <p role="alert">{error}</p>}

      {!showAdjustment && current.status === 'pending' && isRecipient && (
        <div>
          <button type="button" onClick={() => applyResponse({ type: 'confirm' })}>
            确认约会
          </button>
          <button type="button" onClick={() => setConfirmation('reject')}>
            拒绝
          </button>
          <button type="button" onClick={() => setShowAdjustment(true)}>
            建议调整
          </button>
        </div>
      )}

      {showAdjustment && (
        <AdjustmentForm
          invitation={current}
          onCancel={() => setShowAdjustment(false)}
          onSubmit={(value) =>
            applyResponse({ type: 'suggest-adjustment', ...value })
          }
        />
      )}

      {current.status === 'adjustment_pending' && isSender && (
        <button
          type="button"
          onClick={() => applyResponse({ type: 'accept-adjustment' })}
        >
          接受调整
        </button>
      )}

      {!isTerminal && isSender && (
        <button type="button" onClick={() => setConfirmation('cancel')}>
          取消约会
        </button>
      )}

      {confirmation && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="destructive-confirmation-title"
        >
          <h4 id="destructive-confirmation-title">
            {confirmation === 'reject'
              ? '确认拒绝这个约会吗？'
              : '确认取消这个约会吗？'}
          </h4>
          <button
            type="button"
            onClick={() =>
              applyResponse({
                type: confirmation === 'reject' ? 'reject' : 'cancel',
              })
            }
          >
            {confirmation === 'reject' ? '确认拒绝' : '确认取消'}
          </button>
          <button type="button" onClick={() => setConfirmation(null)}>
            返回
          </button>
        </div>
      )}
    </article>
  );
}
