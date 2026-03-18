import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BNI Active — Network Dashboard",
  description: "BNI Chapter Activity Heatmap Dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
