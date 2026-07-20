interface ActivityTagsProps {
  activities: string[];
}

export function ActivityTags({ activities }: ActivityTagsProps) {
  return (
    <span className="activity-tags">
      {activities.map((activity) => (
        <span className="activity-tag" key={activity}>
          {activity}
        </span>
      ))}
    </span>
  );
}
