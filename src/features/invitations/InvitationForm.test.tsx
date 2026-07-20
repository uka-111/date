import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createLocalRepository } from '../../storage/localRepository';
import { InvitationForm } from './InvitationForm';

beforeEach(() => {
  localStorage.clear();
});

it('shows field errors when required values are missing', async () => {
  const user = userEvent.setup();
  render(
    <InvitationForm
      partnerId="him"
      repository={createLocalRepository(localStorage)}
      onSaved={vi.fn()}
    />,
  );

  await user.click(screen.getByRole('button', { name: '发送约会邀请' }));

  expect(screen.getByText('日期不能为空')).toBeInTheDocument();
  expect(screen.getByText('时段不能为空')).toBeInTheDocument();
  expect(screen.getByText('活动不能为空')).toBeInTheDocument();
});

it('saves a preset invitation and recipient notification', async () => {
  const repository = createLocalRepository(localStorage);
  const user = userEvent.setup();
  render(
    <InvitationForm
      partnerId="him"
      repository={repository}
      onSaved={vi.fn()}
    />,
  );

  await user.type(screen.getByLabelText('日期'), '2026-07-25');
  await user.click(screen.getByLabelText('晚上'));
  await user.click(screen.getByRole('button', { name: '看电影' }));
  await user.type(screen.getByLabelText('想说的话'), '一起去看新电影');
  await user.click(screen.getByRole('button', { name: '发送约会邀请' }));

  expect(repository.read().invitations[0]).toMatchObject({
    senderId: 'him',
    recipientId: 'her',
    date: '2026-07-25',
    periods: ['evening'],
    activity: ['看电影'],
  });
  expect(repository.read().notifications[0]).toMatchObject({
    recipientId: 'her',
    kind: 'created',
  });
  expect(screen.getByText('邀请已经发给她啦')).toBeInTheDocument();
});

it('allows arbitrary multiple invitation periods', async () => {
  const user = userEvent.setup();
  const repository = createLocalRepository(localStorage);
  render(<InvitationForm partnerId="him" repository={repository} onSaved={vi.fn()} />);

  await user.type(screen.getByLabelText('日期'), '2026-07-25');
  await user.click(screen.getByLabelText('下午'));
  await user.click(screen.getByLabelText('晚上'));

  expect(screen.getByLabelText('下午')).toBeChecked();
  expect(screen.getByLabelText('晚上')).toBeChecked();
});

it('requires text when custom activity is selected', async () => {
  const user = userEvent.setup();
  render(
    <InvitationForm
      partnerId="her"
      repository={createLocalRepository(localStorage)}
      onSaved={vi.fn()}
    />,
  );

  await user.type(screen.getByLabelText('日期'), '2026-07-25');
  await user.click(screen.getByLabelText('下午'));
  await user.click(screen.getByRole('button', { name: '自定义' }));
  await user.click(screen.getByRole('button', { name: '发送约会邀请' }));

  expect(screen.getByText('请填写自定义活动')).toBeInTheDocument();
});
