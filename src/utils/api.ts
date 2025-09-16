export class api {
  public static setPassword(newPassword: string) {
    return fetch("/api/sessions/", {
      method: "PATCH",
      body: JSON.stringify({
        password: newPassword,
      }),
    })
  }
}

