import type { Availability, Invitation, PartnerId } from './models';

export type SecondaryDateState =
  | 'him_available'
  | 'her_available'
  | 'needs_my_response'
  | 'waiting_for_partner';

export interface DateSummary {
  primary: 'confirmed' | 'none';
  secondary: SecondaryDateState[];
  hasPhoto: boolean;
  hasNote: boolean;
}

export interface DateSummaryInput {
  currentUserId: PartnerId;
  partnerId: PartnerId;
  date: string;
  availability: Availability[];
  invitations: Invitation[];
  hasPhoto: boolean;
  hasNote: boolean;
}

export function summarizeDateState(input: DateSummaryInput): DateSummary {
  const secondary: SecondaryDateState[] = [];
  const dayAvailability = input.availability.filter((value) => value.date === input.date);
  if (dayAvailability.some((value) => value.ownerId === 'him')) secondary.push('him_available');
  if (dayAvailability.some((value) => value.ownerId === 'her')) secondary.push('her_available');

  const dayInvitations = input.invitations.filter((value) => value.date === input.date);
  if (dayInvitations.some((value) => value.status === 'pending' && value.recipientId === input.currentUserId)) {
    secondary.push('needs_my_response');
  }
  if (dayInvitations.some((value) => value.status === 'pending' && value.senderId === input.currentUserId)) {
    secondary.push('waiting_for_partner');
  }

  return {
    primary: dayInvitations.some((value) => value.status === 'confirmed') ? 'confirmed' : 'none',
    secondary,
    hasPhoto: input.hasPhoto,
    hasNote: input.hasNote,
  };
}
