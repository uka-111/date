import { act, render, screen, waitFor } from '@testing-library/react';
import { createFakeBookingRepository } from '../test/fakeBookingRepository';
import { useCloudBookingData } from './useBookingData';

function Probe({ repository }: { repository: ReturnType<typeof createFakeBookingRepository> }) {
  const { state, reload } = useCloudBookingData(repository);
  return <>
    <p>{state.status}</p>
    {state.status === 'error' && <p role="alert">{state.message}</p>}
    <button type="button" onClick={() => void reload()}>重试</button>
  </>;
}

it('loads the initial snapshot and refreshes when the repository invalidates it', async () => {
  const repository = createFakeBookingRepository();
  render(<Probe repository={repository} />);

  expect(screen.getByText('loading')).toBeInTheDocument();
  expect(await screen.findByText('ready')).toBeInTheDocument();

  await act(() => repository.saveViewPreference('year'));
  await waitFor(() => expect(screen.getByText('ready')).toBeInTheDocument());
});

it('shows a retryable error when the initial load fails', async () => {
  const repository = createFakeBookingRepository();
  repository.failNext('网络暂时不可用');
  render(<Probe repository={repository} />);

  expect(await screen.findByRole('alert')).toHaveTextContent('网络暂时不可用');
  await act(() => screen.getByRole('button', { name: '重试' }).click());
  expect(await screen.findByText('ready')).toBeInTheDocument();
});
