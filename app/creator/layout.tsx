export default function CreatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full justify-center bg-black md:bg-zinc-950">
      <div className="relative min-h-[100dvh] w-full max-w-md overflow-x-hidden bg-zinc-950 md:border-x md:border-white/10 md:shadow-2xl">
        {children}
      </div>
    </div>
  );
}
