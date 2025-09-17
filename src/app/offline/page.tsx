export default function OfflinePage() {
  return (
    <html>
      <head>
        <title>Offline</title>
        <script dangerouslySetInnerHTML={{ __html: "window.IS_OFFLINE = true;" }} />
      </head>
      <body>
        <div id="root"></div>
      </body>
    </html>
  );
}
