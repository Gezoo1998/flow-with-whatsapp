"use client";

// Types definition matching offline persist requirements.
export interface DeltaSyncEvent {
  id: string;
  timestamp: string;
  action: 
    | "TOGGLE_ATTENDANCE" 
    | "ADD_STUDENT" 
    | "UPDATE_STUDENT" 
    | "DELETE_STUDENT" 
    | "ADD_PAYMENT" 
    | "DELETE_PAYMENT" 
    | "ADD_GROUP" 
    | "UPDATE_GROUP" 
    | "DELETE_GROUP"
    | "ADD_RECITATION"
    | "UPDATE_RECITATION"
    | "SAVE_RECITATION_SCORES"
    | "DELETE_RECITATION"
    | "ADD_EXAM"
    | "UPDATE_EXAM"
    | "SAVE_EXAM_SCORES"
    | "DELETE_EXAM"
    | "ADD_NOTE"
    | "DELETE_NOTE"
    | "LOG_ACTIVITY";
  payload: any;
  synced: boolean;
}

const LOCAL_STORAGE_QUEUE_KEY = "centerflow_pending_delta_events_v1";
const DB_NAME = "centerflow_offline_db";
const STORE_NAME = "delta_sync_events";
const DB_VERSION = 1;

let inMemoryDeltaEvents: DeltaSyncEvent[] = [];
let dbInstance: IDBDatabase | null = null;
let isLoadedFromStorage = false;

// Helper to open or return IndexedDB instance
export function initDB(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.resolve(null);
  }
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => {
        console.warn("[IndexedDB] Failed to open database, falling back to localStorage.");
        resolve(null);
      };
      request.onsuccess = (event: any) => {
        dbInstance = event.target.result;
        resolve(dbInstance);
      };
      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
    } catch {
      resolve(null);
    }
  });
}

// Fallback localStorage operations
function saveQueueToLocalStorage(events: DeltaSyncEvent[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_QUEUE_KEY, JSON.stringify(events));
  } catch (e) {
    console.warn("[localStorage] Failed to save pending queue:", e);
  }
}

function getQueueFromLocalStorage(): DeltaSyncEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Durable loader for pending events upon boot or refresh
async function loadPendingEventsFromStorage(): Promise<DeltaSyncEvent[]> {
  if (isLoadedFromStorage) return inMemoryDeltaEvents;

  let loaded: DeltaSyncEvent[] = [];
  const db = await initDB();

  if (db) {
    loaded = await new Promise<DeltaSyncEvent[]>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  }

  // If IndexedDB returned empty or was unavailable, try localStorage
  if (loaded.length === 0) {
    loaded = getQueueFromLocalStorage();
  }

  // Filter valid unsynced items
  inMemoryDeltaEvents = loaded.filter(
    (e) => e && typeof e === "object" && e.id && !e.synced
  );
  isLoadedFromStorage = true;
  return inMemoryDeltaEvents;
}

// Generic store functions
export async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  if (storeName === STORE_NAME) {
    const events = await loadPendingEventsFromStorage();
    return events as any;
  }
  return [];
}

export async function saveToStore<T>(storeName: string, item: T): Promise<void> {
  if (storeName === STORE_NAME) {
    const event = item as any as DeltaSyncEvent;
    const db = await initDB();
    if (db) {
      try {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(event);
      } catch (e) {
        console.warn("[IndexedDB] Save item error:", e);
      }
    }
  }
}

export async function deleteFromStore(storeName: string, id: string): Promise<void> {
  if (storeName === STORE_NAME) {
    const db = await initDB();
    if (db) {
      try {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).delete(id);
      } catch (e) {
        console.warn("[IndexedDB] Delete item error:", e);
      }
    }
  }
}

export async function clearStore(storeName: string): Promise<void> {
  if (storeName === STORE_NAME) {
    inMemoryDeltaEvents = [];
    saveQueueToLocalStorage([]);
    const db = await initDB();
    if (db) {
      try {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).clear();
      } catch (e) {
        console.warn("[IndexedDB] Clear store error:", e);
      }
    }
  }
}

const CACHED_STATE_KEY = "centerflow_cached_app_state_v1";

export async function persistWholeStateToIndexedDB(state: any): Promise<void> {
  if (typeof window === "undefined" || !state) return;
  try {
    const serialized = JSON.stringify(state);
    localStorage.setItem(CACHED_STATE_KEY, serialized);
  } catch (e) {
    console.warn("[IndexedDB] Failed to save offline state cache:", e);
  }
}

export async function getPersistedStateFromIndexedDB(): Promise<any | null> {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHED_STATE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn("[IndexedDB] Failed to load offline state cache:", e);
  }
  return null;
}

// Queue delta sync event durably and trigger background sync
export async function queueDeltaSyncEvent(
  action: DeltaSyncEvent["action"], 
  payload: any
): Promise<DeltaSyncEvent> {
  await loadPendingEventsFromStorage();

  const newEvent: DeltaSyncEvent = {
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    action,
    payload,
    synced: false,
  };

  inMemoryDeltaEvents.push(newEvent);

  // Persist to IndexedDB and localStorage
  const db = await initDB();
  if (db) {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(newEvent);
    } catch (e) {
      console.warn("[IndexedDB] Failed to enqueue event:", e);
    }
  }
  saveQueueToLocalStorage(inMemoryDeltaEvents);

  // Trigger background autosync
  if (typeof window !== "undefined") {
    import("./store").then(({ triggerBackgroundSync }) => {
      triggerBackgroundSync();
    });
  }

  return newEvent;
}

export async function getPendingDeltaSyncEvents(): Promise<DeltaSyncEvent[]> {
  const events = await loadPendingEventsFromStorage();
  return events
    .filter((e) => e && !e.synced)
    .sort((a, b) => (a.timestamp || "").localeCompare(b.timestamp || ""));
}

export async function markDeltaEventsAsSynced(eventIds: string[]): Promise<void> {
  if (!Array.isArray(eventIds) || eventIds.length === 0) return;

  await loadPendingEventsFromStorage();

  const db = await initDB();
  if (db) {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      eventIds.forEach((id) => store.delete(id));
    } catch (e) {
      console.warn("[IndexedDB] Failed to remove synced events:", e);
    }
  }

  inMemoryDeltaEvents = inMemoryDeltaEvents.filter((e) => !eventIds.includes(e.id));
  saveQueueToLocalStorage(inMemoryDeltaEvents);
}

// Collation and CRDT Operational Resolve function to simulate cloud consolidation
export function collateEvents(events: DeltaSyncEvent[]): DeltaSyncEvent[] {
  const attendanceRegistry: Record<string, DeltaSyncEvent> = {}; 
  const studentMap: Record<string, DeltaSyncEvent[]> = {}; 
  const otherEvents: DeltaSyncEvent[] = [];
  
  for (const event of events) {
    if (!event || !event.action) continue;
    if (event.action === "TOGGLE_ATTENDANCE") {
      const { studentId, date, groupId } = event.payload || {};
      const key = `${studentId}_${date}_${groupId}`;
      attendanceRegistry[key] = event; 
    } else if (event.action === "ADD_STUDENT" || event.action === "UPDATE_STUDENT" || event.action === "DELETE_STUDENT") {
      const sId = event.payload?.id;
      if (sId) {
        if (!studentMap[sId]) studentMap[sId] = [];
        studentMap[sId].push(event);
      } else {
        otherEvents.push(event);
      }
    } else {
      otherEvents.push(event);
    }
  }
  
  const results: DeltaSyncEvent[] = [];
  
  // Condense student events
  for (const sId in studentMap) {
    const sEvents = studentMap[sId];
    const hasDelete = sEvents.some((e) => e.action === "DELETE_STUDENT");
    const hasAdd = sEvents.some((e) => e.action === "ADD_STUDENT");
    
    if (hasDelete) {
      if (hasAdd) {
        continue;
      } else {
        const delEvent = sEvents.find((e) => e.action === "DELETE_STUDENT");
        if (delEvent) results.push(delEvent);
      }
    } else {
      const addEvent = sEvents.find((e) => e.action === "ADD_STUDENT");
      if (addEvent) {
        let mergedPayload = { ...addEvent.payload };
        for (const update of sEvents.filter((e) => e.action === "UPDATE_STUDENT")) {
          mergedPayload = { ...mergedPayload, ...update.payload };
        }
        results.push({ ...addEvent, payload: mergedPayload });
      } else {
        let mergedPayload = {};
        const latestEvent = sEvents[sEvents.length - 1];
        for (const update of sEvents) {
          mergedPayload = { ...mergedPayload, ...update.payload };
        }
        results.push({ ...latestEvent, payload: mergedPayload });
      }
    }
  }
  
  for (const key in attendanceRegistry) {
    results.push(attendanceRegistry[key]);
  }
  
  for (const ev of otherEvents) {
    results.push(ev);
  }
  
  return results.sort((a, b) => (a.timestamp || "").localeCompare(b.timestamp || ""));
}
