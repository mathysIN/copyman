export class api {
  /**
   * Set or change session password using authKeys (derived from passwords client-side).
   * @param newAuthKey - The new derived authentication key
   * @param currentAuthKey - The current derived authentication key (required if password already set)
   */
  public static setPassword(newAuthKey: string, currentAuthKey?: string) {
    return fetch("/api/sessions/", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        newAuthKey: newAuthKey,
        currentAuthKey: currentAuthKey,
      }),
    });
  }
}
