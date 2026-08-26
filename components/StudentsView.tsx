"use client";

import StudentManager from "./StudentManager";

interface StudentsViewProps {
  onNavigate: (view: string, extraParams?: Record<string, string>) => void;
  groupId?: string;
}

export default function StudentsView({ onNavigate, groupId }: StudentsViewProps) {
  return <StudentManager onNavigate={onNavigate} initialGroupId={groupId} />;
}
