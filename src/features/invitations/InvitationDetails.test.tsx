import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createLocalRepository } from '../../storage/localRepository';
import { invitationBuilder } from '../../test/builders';
import { InvitationDetails } from './InvitationDetails';

beforeEach(() => {
  localStorage.clear();
});

it('shows response actions only to the recipient', () => {
  const invitation = invitationBuilder({ senderId: 'him', recipientId: 'her' });
  const repository = createLocalRepository(localStorage);
  const { rerender } = render(
    <InvitationDetails
      invitation={invitation}
      partnerId="him"
      repository={repository}
      onUpdated={vi.fn()}
    />,
  );

  expect(
    screen.queryByRole('button', { name: '确认约会' }),
  ).not.toBeInTheDocument();

  rerender(
    <InvitationDetails
      invitation={invitation}
      partnerId="her"
      repository={repository}
      onUpdated={vi.fn()}
    />,
  );
  expect(screen.getByRole('button', { name: '确认约会' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '建议调整' })).toBeInTheDocument();
});

it('requires confirmation before rejecting', async () => {
  const user = userEvent.setup();
  render(
    <InvitationDetails
      invitation={invitationBuilder()}
      partnerId="her"
      repository={createLocalRepository(localStorage)}
      onUpdated={vi.fn()}
    />,
  );

  await user.click(screen.getByRole('button', { name: '拒绝' }));

  expect(
    screen.getByRole('dialog', { name: '确认拒绝这个约会吗？' }),
  ).toBeInTheDocument();
});

it('confirms an invitation and notifies the sender', async () => {
  const repository = createLocalRepository(localStorage);
  const onUpdated = vi.fn();
  const user = userEvent.setup();
  render(
    <InvitationDetails
      invitation={invitationBuilder()}
      partnerId="her"
      repository={repository}
      onUpdated={onUpdated}
    />,
  );

  await user.click(screen.getByRole('button', { name: '确认约会' }));

  expect(repository.read().invitations[0].status).toBe('confirmed');
  expect(repository.read().notifications[0]).toMatchObject({
    recipientId: 'him',
    kind: 'confirmed',
  });
  expect(onUpdated).toHaveBeenCalled();
});

it('suggests multiple activities without replacing the original and applies them when accepted', async () => {
  const repository = createLocalRepository(localStorage);
  const user = userEvent.setup();
  const invitation = invitationBuilder({ activity: ['看电影'] });
  const recipientView = render(
    <InvitationDetails
      invitation={invitation}
      partnerId="her"
      repository={repository}
      onUpdated={vi.fn()}
    />,
  );

  await user.click(screen.getByRole('button', { name: '建议调整' }));
  expect(screen.getByRole('button', { name: '看电影' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await user.click(screen.getByRole('button', { name: '一起吃饭' }));
  await user.clear(screen.getByLabelText('调整后的日期'));
  await user.type(screen.getByLabelText('调整后的日期'), '2026-07-26');
  await user.click(screen.getByLabelText('调整为下午'));
  await user.click(screen.getByRole('button', { name: '发送调整建议' }));

  const saved = repository.read().invitations[0];
  expect(saved.date).toBe('2026-07-25');
  expect(saved.activity).toEqual(['看电影']);
  expect(saved.status).toBe('adjustment_pending');
  expect(saved.history.at(-1)?.proposedDate).toBe('2026-07-26');
  expect(saved.history.at(-1)?.proposedActivity).toEqual([
    '看电影',
    '一起吃饭',
  ]);
  const latestAdjustment = screen.getByLabelText('最新调整建议');
  const adjustmentTags = latestAdjustment.querySelectorAll('.activity-tag');
  expect(adjustmentTags).toHaveLength(2);
  expect(adjustmentTags[0]).toHaveTextContent('看电影');
  expect(adjustmentTags[1]).toHaveTextContent('一起吃饭');
  expect(latestAdjustment).toHaveTextContent('看电影、一起吃饭');

  recipientView.unmount();
  render(
    <InvitationDetails
      invitation={saved}
      partnerId="him"
      repository={repository}
      onUpdated={vi.fn()}
    />,
  );
  await user.click(screen.getByRole('button', { name: '接受调整' }));

  expect(repository.read().invitations[0].activity).toEqual([
    '看电影',
    '一起吃饭',
  ]);
  const heading = screen.getByRole('heading', {
    name: '看电影、一起吃饭',
    level: 3,
  });
  expect(heading).toHaveTextContent('看电影、一起吃饭');
  const headingTags = heading.querySelectorAll('.activity-tag');
  expect(headingTags).toHaveLength(2);
  expect(headingTags[0]).toHaveTextContent('看电影');
  expect(headingTags[1]).toHaveTextContent('一起吃饭');
});

it('submits preset and custom activities together', async () => {
  const repository = createLocalRepository(localStorage);
  const user = userEvent.setup();
  render(
    <InvitationDetails
      invitation={invitationBuilder({ activity: ['看电影'] })}
      partnerId="her"
      repository={repository}
      onUpdated={vi.fn()}
    />,
  );

  await user.click(screen.getByRole('button', { name: '建议调整' }));
  await user.click(screen.getByRole('button', { name: '自定义' }));
  await user.type(screen.getByLabelText('自定义活动'), '逛展');
  await user.click(screen.getByRole('button', { name: '发送调整建议' }));

  expect(
    repository.read().invitations[0].history.at(-1)?.proposedActivity,
  ).toEqual(['看电影', '逛展']);
});

it('does not submit lingering custom text after custom selection is cancelled', async () => {
  const repository = createLocalRepository(localStorage);
  const user = userEvent.setup();
  render(
    <InvitationDetails
      invitation={invitationBuilder({ activity: ['看电影'] })}
      partnerId="her"
      repository={repository}
      onUpdated={vi.fn()}
    />,
  );

  await user.click(screen.getByRole('button', { name: '建议调整' }));
  await user.click(screen.getByRole('button', { name: '自定义' }));
  await user.type(screen.getByLabelText('自定义活动'), '逛展');
  await user.click(screen.getByRole('button', { name: '自定义' }));
  await user.click(screen.getByRole('button', { name: '发送调整建议' }));

  expect(
    repository.read().invitations[0].history.at(-1)?.proposedActivity,
  ).toEqual(['看电影']);
});

it('validates an empty activity selection and an empty selected custom activity', async () => {
  const user = userEvent.setup();
  render(
    <InvitationDetails
      invitation={invitationBuilder({ activity: ['看电影'] })}
      partnerId="her"
      repository={createLocalRepository(localStorage)}
      onUpdated={vi.fn()}
    />,
  );

  await user.click(screen.getByRole('button', { name: '建议调整' }));
  await user.click(screen.getByRole('button', { name: '看电影' }));
  await user.click(screen.getByRole('button', { name: '发送调整建议' }));
  expect(screen.getByText('活动不能为空')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: '自定义' }));
  await user.click(screen.getByRole('button', { name: '发送调整建议' }));
  expect(screen.getByText('请填写自定义活动')).toBeInTheDocument();
});

it('initializes one custom activity in the input and preserves multiple unknown activities', async () => {
  const user = userEvent.setup();
  const repository = createLocalRepository(localStorage);
  const firstView = render(
    <InvitationDetails
      invitation={invitationBuilder({ activity: ['逛展', '看电影'] })}
      partnerId="her"
      repository={repository}
      onUpdated={vi.fn()}
    />,
  );

  await user.click(screen.getByRole('button', { name: '建议调整' }));
  expect(screen.getByRole('button', { name: '自定义' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(screen.getByLabelText('自定义活动')).toHaveValue('逛展');
  expect(screen.getByRole('button', { name: '看电影' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await user.click(screen.getByRole('button', { name: '发送调整建议' }));
  expect(
    repository.read().invitations[0].history.at(-1)?.proposedActivity,
  ).toEqual(['逛展', '看电影']);

  firstView.unmount();
  render(
    <InvitationDetails
      invitation={invitationBuilder({ activity: ['逛展', '喝咖啡'] })}
      partnerId="her"
      repository={repository}
      onUpdated={vi.fn()}
    />,
  );
  await user.click(screen.getByRole('button', { name: '建议调整' }));
  await user.click(screen.getByRole('button', { name: '逛展' }));
  expect(screen.getByRole('button', { name: '逛展' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await user.click(screen.getByRole('button', { name: '发送调整建议' }));

  expect(
    repository.read().invitations[0].history.at(-1)?.proposedActivity,
  ).toEqual(['喝咖啡']);
});
