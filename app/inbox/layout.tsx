export default function InboxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full justify-center bg-black md:bg-zinc-950">
      <div className="relative h-[100dvh] w-full max-w-md overflow-hidden bg-zinc-950 md:border-x md:border-white/10 md:shadow-2xl">
        {children}
      </div>
    </div>
  );
}
