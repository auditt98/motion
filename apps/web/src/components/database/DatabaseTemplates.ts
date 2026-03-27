import type { DatabaseColumn } from "@motion/shared";

function col(name: string, type: DatabaseColumn["type"], width = 200, options?: string[]): DatabaseColumn {
  return { id: crypto.randomUUID(), name, type, width, ...(options ? { options } : {}) };
}

export function blankTemplate(): DatabaseColumn[] {
  return [col("Name", "text")];
}

export function projectTrackerTemplate(): DatabaseColumn[] {
  return [
    col("Task", "text", 250),
    col("Status", "select", 140, ["Todo", "In Progress", "Done"]),
    col("Assignee", "person", 150),
    col("Due Date", "date", 140),
    col("Priority", "select", 120, ["Low", "Medium", "High"]),
    col("Done", "checkbox", 80),
  ];
}

export function meetingLogTemplate(): DatabaseColumn[] {
  return [
    col("Title", "text", 250),
    col("Date", "date", 140),
    col("Attendees", "multi_select", 200),
    col("Notes", "text", 300),
    col("Action Items", "text", 250),
  ];
}

export function bugTrackerTemplate(): DatabaseColumn[] {
  return [
    col("Bug", "text", 250),
    col("Severity", "select", 120, ["Critical", "High", "Medium", "Low"]),
    col("Status", "select", 140, ["Open", "In Progress", "Fixed", "Closed"]),
    col("Assignee", "person", 150),
    col("Reported", "date", 140),
    col("URL", "url", 200),
  ];
}
