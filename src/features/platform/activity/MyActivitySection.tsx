"use client";

import { useState } from "react";
import type { AttendanceState, CreditPolicy, UserActivityItem } from "../data/types";
import { AttendanceCheckCard } from "./AttendanceCheckCard";
import { ActivityGrass } from "./ActivityGrass";
import { ActivityHistoryList } from "./ActivityHistoryList";

export interface MyActivitySectionProps {
  attendance: AttendanceState;
  policy: CreditPolicy;
  initialActivities: UserActivityItem[];
}

export function MyActivitySection({
  attendance,
  policy,
  initialActivities,
}: MyActivitySectionProps) {
  const [activities, setActivities] = useState<UserActivityItem[]>(initialActivities);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  function handleCheckedIn(result: { streak: number; granted: number; balance?: number }) {
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
    const time = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

    const newActivity: UserActivityItem = {
      id: `act_checkin_${Date.now()}`,
      date: today,
      type: "attendance",
      title: result.streak % policy.attendanceStreakDays === 0
        ? `연속 ${result.streak}일 출석 달성 (+${result.granted}C)`
        : `출석 체크 완료 (+${result.granted}C)`,
      description: result.streak % policy.attendanceStreakDays === 0
        ? `${policy.attendanceStreakDays}일 연속 보너스 +${policy.attendanceStreakBonus}C 지급!`
        : "매일 출석 보너스",
      creditDelta: result.granted,
      time,
      createdAt: new Date().toISOString(),
    };

    setActivities((prev) => [newActivity, ...prev]);
  }

  return (
    <section className="flex flex-col gap-5 pt-2">
      {/* 1. 출석 체크 & 7일 연속 보너스 로드맵 */}
      <AttendanceCheckCard
        attendance={attendance}
        policy={policy}
        onCheckedIn={handleCheckedIn}
      />

      {/* 2. 16주 연재 기록 (히트맵) */}
      <ActivityGrass
        activities={activities}
        selectedDate={selectedDate}
        onSelectDay={setSelectedDate}
      />

      {/* 3. 활동 및 사용 이력 타임라인 */}
      <ActivityHistoryList
        activities={activities}
        selectedDate={selectedDate}
        onClearDateFilter={() => setSelectedDate(null)}
      />
    </section>
  );
}
