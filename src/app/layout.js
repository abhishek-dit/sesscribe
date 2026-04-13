import "./globals.css";

export const metadata = {
  title: "SesScribe — Live AI Session Transcription",
  description: "Real-time speaker-aware transcription, AI summaries, and automatic team notifications.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
