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
    href: "https://github.com/sqlfluff/sqlfluff",
    statusHref: "https://github.com/sqlfluff/sqlfluff/pulls",
  },
  {
    source: "open-source",
    description: "review thread updated",
    status: "updated",
    href: "https://github.com/vetrovk",
    time: "2h ago",
  },
  {
    source: "omnifix.pro",
    description: "hero system design updated",
    status: "updated",
    href: "https://github.com/vetrovk",
    time: "today",
  },
  {
    source: "oracle-bot",
    description: "production service online",
    status: "live",
    href: "https://github.com/vetrovk/oracle-bot",
  },
];
