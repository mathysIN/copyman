import { cookies } from "next/headers";
import { getSessionWithCookies } from "~/utils/authenticate";

export default async function LDMPage() {
  const cookieStore = cookies();
  const session = await getSessionWithCookies(cookieStore);

  if (!session) {
    return (
      <html>
        <head>
          <title>Copyman LDM - Join Session</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>{`
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: Arial, Helvetica, sans-serif; 
              background: #287d7c; 
              padding: 10px;
              font-size: 14px;
              color: #fff;
            }
            .container { max-width: 600px; margin: 0 auto; background: #292524; border: 2px solid rgba(255,255,255,0.3); border-radius: 8px; }
            .header { background: #1f1c1b; color: #fff; padding: 15px; text-align: center; border-bottom: 2px dashed rgba(255,255,255,0.3); border-radius: 8px 8px 0 0; }
            .header h1 { font-size: 18px; margin: 0; color: #fff; }
            .header p { font-size: 11px; margin-top: 5px; color: rgba(255,255,255,0.6); }
            .content { padding: 20px; }
            .form-group { margin-bottom: 15px; }
            label { display: block; margin-bottom: 5px; font-weight: bold; font-size: 12px; color: #fff; }
            input[type="text"], input[type="password"] {
              width: 100%;
              padding: 10px;
              border: 2px solid #2563eb;
              border-radius: 8px;
              font-size: 14px;
              font-family: monospace;
              background: #fff;
              color: #000;
            }
            .btn {
              background: rgba(255,255,255,0.05);
              color: #fff;
              border: 2px dashed rgba(255,255,255,0.5);
              padding: 12px 24px;
              font-size: 14px;
              cursor: pointer;
              font-weight: bold;
              border-radius: 6px;
              width: 100%;
              margin-bottom: 10px;
            }
            .btn:hover { background: rgba(255,255,255,0.1); }
            .btn-create { 
              background: rgba(255,255,255,0.05);
              border-color: rgba(255,255,255,0.5);
            }
            .btn-create:hover { background: rgba(255,255,255,0.1); }
            .btn-temp { 
              background: rgba(250, 204, 21, 0.1); 
              color: #facc15; 
              border-color: rgba(250, 204, 21, 0.5); 
            }
            .btn-temp:hover { background: rgba(250, 204, 21, 0.2); }
            .section-title {
              font-size: 13px;
              color: rgba(255,255,255,0.7);
              margin: 20px 0 10px 0;
              padding-bottom: 5px;
              border-bottom: 1px solid rgba(255,255,255,0.2);
            }
            .note { 
              background: rgba(250, 204, 21, 0.1); 
              border: 2px dashed rgba(250, 204, 21, 0.5); 
              padding: 12px; 
              font-size: 11px; 
              margin-top: 20px;
              color: #facc15;
              border-radius: 6px;
            }
            .divider {
              text-align: center;
              margin: 15px 0;
              color: rgba(255,255,255,0.4);
              font-size: 12px;
            }
          `}</style>
        </head>
        <body>
          <div className="container">
            <div className="header">
              <h1>Copyman LDM</h1>
              <p>Low Detail Mode - For older browsers and devices</p>
            </div>
            <div className="content">
              <form action="/api/sessions" method="POST">
                <input type="hidden" name="join" value="true" />

                <div className="form-group">
                  <label>Session Name:</label>
                  <input
                    type="text"
                    name="session"
                    placeholder="Enter session name to join..."
                    autoFocus
                  />
                </div>

                <button type="submit" className="btn">
                  Join Session
                </button>
              </form>

              <div className="divider">— or —</div>

              <div className="section-title">Create New Session</div>

              <form action="/api/sessions" method="POST">
                <div className="form-group">
                  <label>Session Name:</label>
                  <input
                    type="text"
                    name="session"
                    placeholder="Enter session name..."
                  />
                </div>

                <button type="submit" className="btn btn-create">
                  Create Session
                </button>
              </form>

              <form
                action="/api/sessions"
                method="POST"
                style={{ marginTop: "10px" }}
              >
                <input type="hidden" name="temporary" value="true" />
                <input type="hidden" name="password" value="" />
                <button type="submit" className="btn btn-temp">
                  Create Temporary Session (4h)
                </button>
              </form>

              <div className="note">
                <strong>Note:</strong> LDM is a lightweight version for older
                devices. It does not support real-time updates or
                password-protected sessions. Refresh the page to see new
                content.
              </div>
            </div>
          </div>
        </body>
      </html>
    );
  }

  const content = await session.getAllContent();
  const sortedContent = content
    .filter((item) => item.type !== "folder")
    .sort((a, b) => {
      if (a.type === "attachment" && b.type !== "attachment") return 1;
      if (a.type !== "attachment" && b.type === "attachment") return -1;
      return 0;
    });

  return (
    <html>
      <head>
        <title>Copyman LDM - #{session.sessionId}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: Arial, Helvetica, sans-serif; 
            background: #287d7c; 
            padding: 5px;
            font-size: 13px;
            color: #fff;
          }
          .container { 
            max-width: 800px; 
            margin: 0 auto; 
            background: #292524; 
            border: 2px solid rgba(255,255,255,0.3);
            border-radius: 8px;
          }
          .header { 
            background: #1f1c1b; 
            color: #fff; 
            padding: 12px 15px; 
            border-bottom: 2px dashed rgba(255,255,255,0.3);
            border-radius: 8px 8px 0 0;
          }
          .header h1 { 
            font-size: 16px; 
            margin: 0; 
            display: inline;
          }
          .header .session-id {
            color: #fbbf24;
            font-family: monospace;
            font-size: 14px;
          }
          .header .meta {
            font-size: 10px;
            color: rgba(255,255,255,0.5);
            margin-top: 5px;
          }
          .toolbar {
            background: rgba(255,255,255,0.05);
            padding: 10px 15px;
            border-bottom: 1px solid rgba(255,255,255,0.2);
          }
          .toolbar a {
            color: #fff;
            text-decoration: none;
            font-size: 12px;
            margin-right: 15px;
            padding: 5px 10px;
            border: 2px dashed rgba(255,255,255,0.3);
            border-radius: 4px;
          }
          .toolbar a:hover {
            background: rgba(255,255,255,0.1);
          }
          .content-area { padding: 15px; }
          .empty {
            text-align: center;
            color: rgba(255,255,255,0.5);
            padding: 40px;
            font-style: italic;
          }
          .item {
            border: 1px solid rgba(255,255,255,0.2);
            margin-bottom: 12px;
            background: rgba(255,255,255,0.05);
            border-radius: 6px;
            overflow: hidden;
          }
          .item-header {
            background: rgba(255,255,255,0.1);
            padding: 8px 12px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            font-size: 11px;
            color: rgba(255,255,255,0.7);
          }
          .item-type {
            display: inline-block;
            padding: 3px 8px;
            background: #666;
            color: #fff;
            font-size: 10px;
            font-weight: bold;
            margin-right: 8px;
            text-transform: uppercase;
            border-radius: 3px;
          }
          .item-type.note { background: #2563eb; }
          .item-type.file { background: #facc15; color: #000; }
          .item-body {
            padding: 12px;
            color: #fff;
          }
          .note-content {
            white-space: pre-wrap;
            word-wrap: break-word;
            font-family: monospace;
            font-size: 12px;
            line-height: 1.4;
            background: #1f1c1b;
            border: 1px solid rgba(255,255,255,0.2);
            padding: 12px;
            max-height: 300px;
            overflow: auto;
            color: #fff;
            border-radius: 4px;
          }
          .file-info {
            font-size: 12px;
            color: #fff;
          }
          .file-name {
            font-weight: bold;
            color: #fff;
            font-size: 13px;
            margin-bottom: 8px;
          }
          .download-link {
            display: inline-block;
            margin-top: 8px;
            padding: 8px 16px;
            background: rgba(255,255,255,0.05);
            color: #fff;
            text-decoration: none;
            font-size: 11px;
            font-weight: bold;
            border: 2px dashed rgba(255,255,255,0.5);
            border-radius: 4px;
          }
          .download-link:hover {
            background: rgba(255,255,255,0.1);
          }
           .encrypted-badge {
            background: #ef4444;
            color: #fff;
            padding: 2px 6px;
            font-size: 10px;
            font-weight: bold;
            margin-left: 10px;
            border-radius: 3px;
          }
          .footer {
            background: #1f1c1b;
            padding: 12px 15px;
            border-top: 1px solid rgba(255,255,255,0.2);
            font-size: 11px;
            color: rgba(255,255,255,0.5);
            text-align: center;
            border-radius: 0 0 8px 8px;
          }
          .form-section {
            background: #1f1c1b;
            border-top: 2px dashed rgba(255,255,255,0.3);
            padding: 15px;
          }
          .form-title {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 12px;
            color: #fff;
            border-bottom: 1px solid rgba(255,255,255,0.2);
            padding-bottom: 8px;
          }
          .form-row {
            margin-bottom: 12px;
          }
          .form-row label {
            display: block;
            margin-bottom: 5px;
            font-size: 12px;
            color: rgba(255,255,255,0.8);
          }
          textarea {
            width: 100%;
            min-height: 80px;
            padding: 10px;
            border: 2px solid #2563eb;
            border-radius: 6px;
            font-family: monospace;
            font-size: 13px;
            background: #fff;
            color: #000;
            resize: vertical;
          }
          input[type="file"] {
            width: 100%;
            padding: 8px;
            background: rgba(255,255,255,0.1);
            border: 2px solid rgba(255,255,255,0.3);
            border-radius: 6px;
            color: #fff;
          }
          .btn-submit {
            background: rgba(255,255,255,0.05);
            color: #fff;
            border: 2px dashed rgba(255,255,255,0.5);
            padding: 10px 20px;
            font-size: 13px;
            cursor: pointer;
            font-weight: bold;
            border-radius: 6px;
          }
          .btn-submit:hover {
            background: rgba(255,255,255,0.1);
          }
          .btn-delete {
            background: #ef4444;
            color: #fff;
            border: 2px solid rgba(255,255,255,0.3);
            padding: 3px 8px;
            font-size: 10px;
            cursor: pointer;
            font-weight: bold;
            border-radius: 3px;
            text-decoration: none;
            display: inline-block;
            margin-left: 10px;
          }
          .btn-delete:hover {
            background: #dc2626;
          }
          .forms-container {
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
          }
          .form-box {
            flex: 1;
            min-width: 280px;
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 6px;
            padding: 15px;
          }
          table { width: 100%; border-collapse: collapse; }
          td { vertical-align: top; }
        `}</style>
      </head>
      <body>
        <div className="container">
          <div className="header">
            <h1>
              Session: <span className="session-id">#{session.sessionId}</span>
            </h1>
            {session.isEncrypted && (
              <span className="encrypted-badge">ENCRYPTED</span>
            )}
            <div className="meta">
              Created: {new Date(parseInt(session.createdAt)).toLocaleString()}
              {session.isTemporary &&
                ` | Expires: ${new Date(parseInt(session.expiresAt || "0")).toLocaleString()}`}
            </div>
          </div>

          <div className="toolbar">
            <a href="/api/ldm/leave">Leave Session</a>
            <a href="/">Refresh</a>
          </div>

          <div className="content-area">
            {sortedContent.length === 0 ? (
              <div className="empty">No content in this session yet.</div>
            ) : (
              sortedContent.map((item) => (
                <div key={item.id} className="item">
                  <div className="item-header">
                    <span
                      className={`item-type ${item.type === "attachment" ? "file" : "note"}`}
                    >
                      {item.type === "attachment" ? "FILE" : "NOTE"}
                    </span>
                    {new Date(item.createdAt).toLocaleString()}
                    {"isEncrypted" in item && item.isEncrypted && (
                      <span className="encrypted-badge">ENCRYPTED</span>
                    )}
                    <a
                      href={`/api/ldm/delete?contentId=${item.id}`}
                      className="btn-delete"
                    >
                      Delete
                    </a>
                  </div>
                  <div className="item-body">
                    {item.type === "note" ? (
                      <div className="note-content">
                        {item.isEncrypted
                          ? "[This note is encrypted and cannot be displayed in LDM mode]"
                          : item.content
                            .replace(/&/g, "&amp;")
                            .replace(/</g, "&lt;")
                            .replace(/>/g, "&gt;")
                            .replace(/"/g, "&quot;")}
                      </div>
                    ) : item.type === "attachment" ? (
                      <div className="file-info">
                        <div className="file-name">{item.attachmentPath}</div>
                        <a
                          href={item.attachmentURL}
                          className="download-link"
                          target="_blank"
                        >
                          Download
                        </a>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="form-section">
            <div className="forms-container">
              <div className="form-box">
                <div className="form-title">Add Note</div>
                <form action="/api/ldm/notes" method="POST">
                  <div className="form-row">
                    <textarea
                      name="content"
                      placeholder="Type your note here..."
                      required
                    ></textarea>
                  </div>
                  <button type="submit" className="btn-submit">
                    Add Note
                  </button>
                </form>
              </div>

              <div className="form-box">
                <div className="form-title">Upload File</div>
                <form
                  action="/api/ldm/upload"
                  method="POST"
                  encType="multipart/form-data"
                >
                  <div className="form-row">
                    <input type="file" name="files" multiple required />
                  </div>
                  <button type="submit" className="btn-submit">
                    Upload File
                  </button>
                </form>
              </div>
            </div>
          </div>

          <div className="footer">Copyman LDM | Low Detail Mode</div>
        </div>
      </body>
    </html>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
