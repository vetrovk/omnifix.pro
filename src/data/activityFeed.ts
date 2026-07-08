export type ActivityFeedItem = {
  source: string;
  description: string;
  status: string;
  href: string;
  statusHref?: string;
  time?: string;
};

export const activityFeed: ActivityFeedItem[] = [
  {
    source: "sqlfluff/sqlfluff",
    description: "Oracle SQLPlus parsing fix",
    status: "PR merged",
    href: "#",
    statusHref: "#",
  },
  {
    source: "open-source",
    description: "review thread updated",
    status: "updated",
    href: "#",
    time: "2h ago",
  },
  {
    source: "omnifix.pro",
    description: "hero system design updated",
    status: "updated",
    href: "#",
    time: "today",
  },
  {
    source: "oracle-bot",
    description: "production service online",
    status: "live",
    href: "#",
  },
];
