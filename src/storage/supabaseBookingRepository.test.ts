import { expect, it, vi } from 'vitest';
import { createSupabaseBookingRepository } from './supabaseBookingRepository';

it('accepts a successful void RPC response when confirming an invitation', async () => {
  const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: null }) };
  const repository = createSupabaseBookingRepository(client as never, 'couple-1', 'user-1');

  await expect(repository.respondToInvitation('invite-1', { type: 'confirm' })).resolves.toBeUndefined();
  expect(client.rpc).toHaveBeenCalledWith('respond_to_invitation', expect.objectContaining({
    p_invitation_id: 'invite-1',
    p_action: 'confirm',
  }));
});
