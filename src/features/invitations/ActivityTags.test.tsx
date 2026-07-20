import { render, screen } from '@testing-library/react';
import { ActivityTags } from './ActivityTags';

it('renders each activity as a readable tag in its original order', () => {
  const { container } = render(
    <ActivityTags activities={['一起吃饭', '看电影']} />,
  );

  const tags = container.querySelectorAll('.activity-tags .activity-tag');

  expect(container.querySelector('.activity-tags')).not.toHaveAttribute(
    'aria-hidden',
    'true',
  );
  expect(tags).toHaveLength(2);
  expect(tags[0]).toHaveTextContent('一起吃饭');
  expect(tags[1]).toHaveTextContent('看电影');
  expect(screen.getByText('一起吃饭')).toBeVisible();
  expect(screen.getByText('看电影')).toBeVisible();
});
