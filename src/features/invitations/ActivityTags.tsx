import { Fragment } from 'react';

interface ActivityTagsProps {
  activities: string[];
}

export function ActivityTags({ activities }: ActivityTagsProps) {
  return (
    <span className="activity-tags">
      {activities.map((activity, index) => (
        <Fragment key={activity}>
          {index > 0 && <span className="visually-hidden">、</span>}
          <span className="activity-tag">{activity}</span>
        </Fragment>
      ))}
    </span>
  );
}
