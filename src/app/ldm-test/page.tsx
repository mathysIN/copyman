import { cookies } from "next/headers";
import { getSessionWithCookies } from "~/utils/authenticate";

export default async function LDMTestPage() {
  const cookieStore = cookies();
  const session = await getSessionWithCookies(cookieStore);

  if (!session) {
    return (
      <html>
        <head>
          <title>LDM Test - Join</title>
        </head>
        <body>
          <h1>Copyman LDM Test</h1>
          <p>This is a test page for old browsers.</p>
          <hr />
          <form action="/api/sessions" method="POST">
            <input type="hidden" name="join" value="true" />
            <p>
              Session: <input type="text" name="session" />
            </p>
            <p>
              Password: <input type="password" name="password" />
            </p>
            <p>
              <button type="submit">Join</button>
            </p>
          </form>
        </body>
      </html>
    );
  }

  const content = await session.getAllContent();

  return (
    <html>
      <head>
        <title>LDM Test - {session.sessionId}</title>
      </head>
      <body>
        <h1>Session: #{session.sessionId}</h1>
        <p>
          <a href="/api/ldm/leave">Leave</a> | <a href="/ldm-test">Refresh</a>
        </p>
        <hr />

        <h2>Content ({content.length} items):</h2>

        {content.length === 0 ? (
          <p>
            <i>No content yet.</i>
          </p>
        ) : (
          <table border={1} cellPadding={5}>
            <tr>
              <th>Type</th>
              <th>Content</th>
            </tr>
            {content
              .filter((item) => item.type !== "folder")
              .map((item) => (
                <tr key={item.id}>
                  <td>{item.type === "note" ? "NOTE" : "FILE"}</td>
                  <td>
                    {item.type === "note" ? (
                      <pre>
                        {"isEncrypted" in item && item.isEncrypted
                          ? "[ENCRYPTED]"
                          : item.content}
                      </pre>
                    ) : item.type === "attachment" ? (
                      <div>
                        {item.attachmentPath}
                        <br />
                        <a href={item.attachmentURL} target="_blank">
                          Download
                        </a>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
          </table>
        )}
      </body>
    </html>
  );
}
