import Link from 'next/link';

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/70 bg-white/80 backdrop-blur-xl">
      <div className="shell flex h-[76px] items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-3"
          aria-label="SpaceLink หน้าหลัก"
        >
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-violet text-lg font-black text-white shadow-lg shadow-violet/25">
            S
          </span>
          <span className="text-xl font-extrabold tracking-[-0.03em]">
            SpaceLink
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-semibold text-[#645f72] md:flex">
          <Link className="text-violet" href="/">
            ค้นหา Event
          </Link>
          <Link href="/#how-it-works">วิธีสำรวจพื้นที่</Link>
          <Link href="/#support">ช่วยเหลือ</Link>
        </nav>

        <Link
          href="/"
          className="rounded-full border border-[#e4dff0] bg-white px-4 py-2 text-sm font-bold text-violet shadow-sm"
        >
          หน้าค้นหา Event
        </Link>
      </div>
    </header>
  );
}
