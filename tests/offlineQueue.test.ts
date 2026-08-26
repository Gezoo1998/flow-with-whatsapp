import { describe, it, expect, beforeEach } from "vitest";
import {
  queueDeltaSyncEvent,
  getPendingDeltaSyncEvents,
  markDeltaEventsAsSynced,
  collateEvents,
  clearStore,
} from "../lib/db";

describe("Durable Offline Queue (SEC-04)", () => {
  beforeEach(async () => {
    await clearStore("delta_sync_events");
  });

  it("should queue events and retrieve them sorted chronologically", async () => {
    const event1 = await queueDeltaSyncEvent("ADD_STUDENT", { id: "st_1", name: "Ahmed" });
    const event2 = await queueDeltaSyncEvent("TOGGLE_ATTENDANCE", { studentId: "st_1", date: "2026-08-10" });

    const pending = await getPendingDeltaSyncEvents();
    expect(pending.length).toBe(2);
    expect(pending[0].id).toBe(event1.id);
    expect(pending[1].id).toBe(event2.id);
  });

  it("should mark synced events as removed from queue", async () => {
    const event1 = await queueDeltaSyncEvent("ADD_STUDENT", { id: "st_1", name: "Ahmed" });
    const event2 = await queueDeltaSyncEvent("ADD_STUDENT", { id: "st_2", name: "Mona" });

    await markDeltaEventsAsSynced([event1.id]);

    const pending = await getPendingDeltaSyncEvents();
    expect(pending.length).toBe(1);
    expect(pending[0].id).toBe(event2.id);
  });

  it("should collapse student ADD + UPDATE operations cleanly during collation", () => {
    const events: any[] = [
      {
        id: "evt_1",
        timestamp: "2026-08-10T10:00:00Z",
        action: "ADD_STUDENT",
        payload: { id: "st_99", name: "Ali", phone: "01000000000" },
        synced: false,
      },
      {
        id: "evt_2",
        timestamp: "2026-08-10T10:05:00Z",
        action: "UPDATE_STUDENT",
        payload: { id: "st_99", notes: "Top Student" },
        synced: false,
      },
    ];

    const collated = collateEvents(events);
    expect(collated.length).toBe(1);
    expect(collated[0].action).toBe("ADD_STUDENT");
    expect(collated[0].payload.name).toBe("Ali");
    expect(collated[0].payload.notes).toBe("Top Student");
  });
});
