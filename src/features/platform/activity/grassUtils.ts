import type { UserActivityItem } from "../data/types";

export interface DayGrassCell {
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 0 (Sun) ~ 6 (Sat)
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
  activities: UserActivityItem[];
}

export interface GrassWeek {
  weekIndex: number;
  days: (DayGrassCell | null)[];
}

/**
  * Calculate grass cells for the last N weeks (default 16 weeks)
  */
export function calculateGrassMatrix(
  activities: UserActivityItem[],
  totalWeeks = 16
): {
  weeks: GrassWeek[];
  totalActivities: number;
  activeDaysCount: number;
  currentStreak: number;
  longestStreak: number;
} {
  const activityMap = new Map<string, UserActivityItem[]>();
  for (const act of activities) {
    const list = activityMap.get(act.date) ?? [];
    list.push(act);
    activityMap.set(act.date, list);
  }

  const now = new Date();
  // Get date in KST
  const todayStr = now.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  const today = new Date(todayStr);

  const daysBack = totalWeeks * 7;
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - daysBack + 1);

  // Align start date to Sunday
  const startDayOfWeek = startDate.getDay();
  startDate.setDate(startDate.getDate() - startDayOfWeek);

  const weeks: GrassWeek[] = [];
  let currentWeek: (DayGrassCell | null)[] = [];
  let weekIndex = 0;

  const cursor = new Date(startDate);
  while (cursor <= today) {
    const dateStr = cursor.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
    const acts = activityMap.get(dateStr) ?? [];
    const count = acts.length;

    let level: 0 | 1 | 2 | 3 | 4 = 0;
    if (count >= 5) level = 4;
    else if (count >= 3) level = 3;
    else if (count >= 2) level = 2;
    else if (count >= 1) level = 1;

    currentWeek.push({
      date: dateStr,
      dayOfWeek: cursor.getDay(),
      count,
      level,
      activities: acts,
    });

    if (currentWeek.length === 7) {
      weeks.push({ weekIndex, days: currentWeek });
      currentWeek = [];
      weekIndex++;
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    weeks.push({ weekIndex, days: currentWeek });
  }

  // Calculate streaks
  let activeDaysCount = 0;
  for (const [, acts] of activityMap) {
    if (acts.length > 0) activeDaysCount++;
  }

  let longestStreak = 0;
  let tempStreak = 0;
  let currentStreak = 0;
  let isCurrentChecking = true;

  const testCursor = new Date(today);
  for (let i = 0; i < 365; i++) {
    const dStr = testCursor.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
    const hasActivity = (activityMap.get(dStr)?.length ?? 0) > 0;

    if (hasActivity) {
      tempStreak++;
      if (isCurrentChecking) currentStreak++;
      if (tempStreak > longestStreak) longestStreak = tempStreak;
    } else {
      if (isCurrentChecking && i > 0) isCurrentChecking = false;
      tempStreak = 0;
    }
    testCursor.setDate(testCursor.getDate() - 1);
  }

  return {
    weeks,
    totalActivities: activities.length,
    activeDaysCount,
    currentStreak,
    longestStreak: Math.max(longestStreak, currentStreak),
  };
}

