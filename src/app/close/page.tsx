export default function ClosePage() {
  return (
    <html>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.close();
              setTimeout(() => {
                window.open('', '_self').close();
                document.body.innerHTML = "";
              }, 50);
            `,
          }}
        />
      </body>
    </html>
  );
}
