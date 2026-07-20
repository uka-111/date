import type {
  Invitation,
  InvitationAction,
  InvitationStatus,
  PartnerId,
  Period,
} from './models';
import { isValidDateInput } from './dateValidation';

export type InvitationResponse =
  | { type: 'confirm' }
  | { type: 'reject'; note?: string }
  | { type: 'cancel'; note?: string }
  | {
      type: 'suggest-adjustment';
      date: string;
      periods: Period[];
      activity: string[];
      note?: string;
    }
  | { type: 'accept-adjustment' };

function assertTransitionAllowed(
  invitation: Invitation,
  actorId: PartnerId,
  response: InvitationResponse,
) {
  if (invitation.status === 'rejected' || invitation.status === 'cancelled') {
    throw new Error('这个约会已经结束，不能再次修改');
  }

  if (response.type === 'accept-adjustment') {
    if (invitation.status !== 'adjustment_pending') {
      throw new Error('当前没有等待接受的调整建议');
    }
    if (actorId !== invitation.senderId) {
      throw new Error('只有原发起方可以接受调整');
    }
    return;
  }

  if (response.type === 'cancel') {
    if (actorId !== invitation.senderId) {
      throw new Error('只有发起方可以取消这个约会');
    }
    return;
  }

  if (invitation.status !== 'pending') {
    throw new Error('当前状态不能执行这个操作');
  }

  if (actorId !== invitation.recipientId) {
    if (response.type === 'confirm') {
      throw new Error('只有接收方可以确认这个约会');
    }
    throw new Error('只有接收方可以处理这个约会');
  }
}

function responseResult(response: InvitationResponse): {
  action: InvitationAction;
  status: InvitationStatus;
} {
  switch (response.type) {
    case 'confirm':
      return { action: 'confirmed', status: 'confirmed' };
    case 'reject':
      return { action: 'rejected', status: 'rejected' };
    case 'cancel':
      return { action: 'cancelled', status: 'cancelled' };
    case 'suggest-adjustment':
      return {
        action: 'adjustment_suggested',
        status: 'adjustment_pending',
      };
    case 'accept-adjustment':
      return { action: 'adjustment_accepted', status: 'confirmed' };
  }
}

export function respondToInvitation(
  invitation: Invitation,
  actorId: PartnerId,
  response: InvitationResponse,
  now = new Date().toISOString(),
): Invitation {
  if (response.type === 'suggest-adjustment' && response.periods.length === 0) {
    throw new Error('请至少选择一个时段');
  }
  if (
    response.type === 'suggest-adjustment' &&
    !isValidDateInput(response.date)
  ) {
    throw new Error('日期格式不正确');
  }
  const normalizedActivities =
    response.type === 'suggest-adjustment'
      ? [
          ...new Set(
            response.activity.map((activity) => activity.trim()).filter(Boolean),
          ),
        ]
      : undefined;
  if (
    response.type === 'suggest-adjustment' &&
    normalizedActivities?.length === 0
  ) {
    throw new Error('请至少选择一个活动');
  }
  assertTransitionAllowed(invitation, actorId, response);

  const { action, status } = responseResult(response);
  const acceptedAdjustment =
    response.type === 'accept-adjustment'
      ? [...invitation.history]
          .reverse()
          .find((entry) => entry.action === 'adjustment_suggested')
      : undefined;

  if (
    response.type === 'accept-adjustment' &&
    (!acceptedAdjustment?.proposedDate ||
      !acceptedAdjustment.proposedPeriods?.length ||
      !acceptedAdjustment.proposedActivity?.length)
  ) {
    throw new Error('没有可以接受的调整建议');
  }

  return {
    ...invitation,
    date: acceptedAdjustment?.proposedDate ?? invitation.date,
    periods: [
      ...(acceptedAdjustment?.proposedPeriods ?? invitation.periods),
    ],
    activity: [...(acceptedAdjustment?.proposedActivity ?? invitation.activity)],
    status,
    updatedAt: now,
    history: [
      ...invitation.history,
      {
        id: crypto.randomUUID(),
        actorId,
        action,
        createdAt: now,
        note: 'note' in response ? response.note : undefined,
        proposedDate:
          response.type === 'suggest-adjustment' ? response.date : undefined,
        proposedPeriods:
          response.type === 'suggest-adjustment' ? [...new Set(response.periods)] : undefined,
        proposedActivity: normalizedActivities
          ? [...normalizedActivities]
          : undefined,
      },
    ],
  };
}
