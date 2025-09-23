export type OfflineSessionState<TContent, TOrder> = {
  sessionId: string;
  content: TContent[];
  order: TOrder;
  updatedAt: number;
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("copyman_offline", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("sessions")) {
        db.createObjectStore("sessions", { keyPath: "sessionId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadOfflineSession<TContent, TOrder>(
  sessionId: string,
): Promise<OfflineSessionState<TContent, TOrder> | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("sessions", "readonly");
    const store = tx.objectStore("sessions");
    const getReq = store.get(sessionId);
    getReq.onsuccess = () =>
      resolve((getReq.result as OfflineSessionState<TContent, TOrder>) ?? null);
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function saveOfflineSession<TContent, TOrder>(
  state: OfflineSessionState<TContent, TOrder>,
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("sessions", "readwrite");
    const store = tx.objectStore("sessions");
    const putReq = store.put(state);
    putReq.onsuccess = () => resolve();
    putReq.onerror = () => reject(putReq.error);
  });
}
