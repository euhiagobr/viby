export const metadata = {
  robots: {
    index: true,
    follow: true
  }
};

export default function CityGuideLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
