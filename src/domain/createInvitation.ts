import { isValid, parseISO } from 'date-fns';
import type { Invitation, PartnerId, Period } from './models';

interface CreateInvitationInput {
  senderId: PartnerId;
  date: string;
  period: Period | null;
  activity: string;
  note: string;
}

export function createInvitation(
  input: CreateInvitationInput,
  now = new Date().toISOString(),
): Invitation {
  const activity = input.activity.trim();
  if (!input.date || !input.period || !activity) {
    throw new Error('请完整填写日期、时段和活动');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !isValid(parseISO(input.date))) {
    throw new Error('日期格式不正确');
  }

  const id = crypto.randomUUID();
  const recipientId: PartnerId = input.senderId === 'him' ? 'her' : 'him';

  return {
    id,
    senderId: input.senderId,
    recipientId,
    date: input.date,
    period: input.period,
    activity,
    note: input.note.trim(),
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    history: [
      {
        id: crypto.randomUUID(),
        actorId: input.senderId,
        action: 'created',
        createdAt: now,
      },
    ],
  };
}
