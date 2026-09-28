import { useCallback, useEffect, useRef, useState } from 'react';
import type { PartnerId } from '../../src/domain/models';
import type { BookingSnapshot } from '../../src/app/bookingSnapshot';
import type { DateBookingRepository } from '../../src/app/bookingRepository';
import type { PhotoRepository } from '../../src/storage/photoRepository';
import { getSupabaseBrowserRuntime } from '../../src/lib/supabaseClient';
import { createSupabaseBookingRepository } from '../../src/storage/supabaseBookingRepository';
import { createSupabasePhotoRepository } from '../../src/storage/supabasePhotoRepository';

export type CloudSnapshotState =
  | { status: 'loading' }
  | { status: 'signed_out' }
  | { status: 'unpaired' }
  | { status: 'ready'; snapshot: BookingSnapshot; identity: PartnerId; repository: DateBookingRepository; photoRepository: PhotoRepository }
  | { status: 'unavailable' };

async function loadCloudSnapshot(): Promise<Exclude<CloudSnapshotState, { status: 'loading' }>> {
  try {
    const { client } = getSupabaseBrowserRuntime();
    const sessionResponse = await client.auth.getSession();
    if (sessionResponse.error) return { status: 'unavailable' };
    const user = sessionResponse.data.session?.user;
    if (!user) return { status: 'signed_out' };

    const membershipResponse = await client
      .from('couple_members')
      .select('couple_id, identity')
      .eq('user_id', user.id)
      .is('left_at', null)
      .maybeSingle();
    if (membershipResponse.error) return { status: 'unavailable' };
    if (!membershipResponse.data) return { status: 'unpaired' };

    const repository = createSupabaseBookingRepository(
      client,
      membershipResponse.data.couple_id,
      user.id,
    );
    const photoRepository = createSupabasePhotoRepository(
      client,
      membershipResponse.data.couple_id,
      user.id,
    );
    const snapshot = await repository.load();
    return { status: 'ready', snapshot, identity: membershipResponse.data.identity, repository, photoRepository };
  } catch {
    return { status: 'unavailable' };
  }
}

export function useCloudSnapshot(): { state: CloudSnapshotState; refresh: () => Promise<void> } {
  const [state, setState] = useState<CloudSnapshotState>({ status: 'loading' });
  const refreshRef = useRef<() => Promise<void>>(async () => undefined);

  useEffect(() => {
    let active = true;
    let timer: number | undefined;

    const refresh = async () => {
      const next = await loadCloudSnapshot();
      if (active) setState(next);
    };

    refreshRef.current = refresh;
    void refresh();
    timer = window.setInterval(() => void refresh(), 30_000);
    return () => {
      active = false;
      refreshRef.current = async () => undefined;
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, []);

  const refresh = useCallback(() => refreshRef.current(), []);
  return { state, refresh };
}
