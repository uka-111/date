import { summarizeDateState } from './dateState';
import { invitationBuilder } from '../test/builders';

it('keeps the confirmed fill and all secondary markers together', () => {
  const state = summarizeDateState({
    currentUserId: 'him',
    partnerId: 'her',
    date: '2026-07-25',
    availability: [
      { id: 'him:date', ownerId: 'him', date: '2026-07-25', periods: ['evening'], note: '', updatedAt: '' },
      { id: 'her:date', ownerId: 'her', date: '2026-07-25', periods: ['afternoon'], note: '', updatedAt: '' },
    ],
    invitations: [invitationBuilder({ status: 'confirmed', date: '2026-07-25', periods: ['evening'] })],
    hasPhoto: true,
    hasNote: true,
  });

  expect(state.primary).toBe('confirmed');
  expect(state.secondary).toEqual(expect.arrayContaining(['him_available', 'her_available']));
  expect(state.hasPhoto).toBe(true);
  expect(state.hasNote).toBe(true);
});

it('distinguishes invitations needing my response from invitations waiting for me', () => {
  const received = summarizeDateState({
    currentUserId: 'him', partnerId: 'her', date: '2026-07-25', availability: [],
    invitations: [invitationBuilder({ senderId: 'her', recipientId: 'him', status: 'pending' })],
    hasPhoto: false, hasNote: false,
  });
  const sent = summarizeDateState({
    currentUserId: 'him', partnerId: 'her', date: '2026-07-25', availability: [],
    invitations: [invitationBuilder({ senderId: 'him', recipientId: 'her', status: 'pending' })],
    hasPhoto: false, hasNote: false,
  });

  expect(received.secondary).toContain('needs_my_response');
  expect(sent.secondary).toContain('waiting_for_partner');
});
