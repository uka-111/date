import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { emptyBookingSnapshot } from './bookingSnapshot';
import { createCloudUiAdapter } from './cloudUiAdapter';
import { createFakeBookingRepository } from '../test/fakeBookingRepository';
import { invitationBuilder } from '../test/builders';
import { InvitationRoute } from './BookingDataScreen';

it('provides a return link on an invitation details page', () => {
  const invitation = invitationBuilder();
  const repository = createCloudUiAdapter(
    { ...emptyBookingSnapshot(), invitations: [invitation] },
    createFakeBookingRepository({ invitations: [invitation] }),
    vi.fn(),
    vi.fn(),
  );

  render(
    <MemoryRouter initialEntries={[`/invitations/${invitation.id}`]}>
      <Routes>
        <Route
          path="/invitations/:id"
          element={
            <InvitationRoute
              partnerId="her"
              repository={repository}
              onChanged={vi.fn()}
            />
          }
        />
      </Routes>
    </MemoryRouter>,
  );

  expect(screen.getByRole('link', { name: '返回' })).toHaveAttribute(
    'href',
    '/invitations',
  );
});
