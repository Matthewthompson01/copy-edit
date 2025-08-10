export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Copy-Edit Review Tool</title>
      </head>
      <body>{children}</body>
    </html>
  );
}