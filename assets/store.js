/* =========================================================================
   SpaceLink Unified — Shared State Layer
   -------------------------------------------------------------------------
   A tiny localStorage-backed store shared by BOTH the Vendor App and the
   Admin Console. Because both apps run on the same origin, writes made here
   by the Vendor App are immediately visible to the Admin Console (and vice
   versa). This is what makes a booth booked in /vendor show up in the
   pending-bookings table in /admin.
   ========================================================================= */
(function () {
  const BOOKINGS_KEY = 'spacelink_bookings';
  const SESSION_KEY  = 'spacelink_session';

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }
  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  const Store = {
    /* ---------- Bookings ---------- */
    getBookings() {
      return read(BOOKINGS_KEY, []);
    },
    addBooking(booking) {
      const list = read(BOOKINGS_KEY, []);
      const id = 'BK-' + Date.now().toString().slice(-6) +
                 String(Math.floor(Math.random() * 90 + 10));
      const record = Object.assign(
        { id, createdAt: new Date().toISOString(), status: 'PENDING' },
        booking
      );
      list.unshift(record);
      write(BOOKINGS_KEY, list);
      return id;
    },
    updateBooking(id, patch) {
      const list = read(BOOKINGS_KEY, []);
      const i = list.findIndex(x => x.id === id);
      if (i >= 0) {
        list[i] = Object.assign({}, list[i], patch);
        write(BOOKINGS_KEY, list);
      }
      return i >= 0;
    },
    pendingCount() {
      return this.getBookings().filter(b => b.status === 'PENDING').length;
    },
    clearBookings() {
      write(BOOKINGS_KEY, []);
    },

    /* ---------- Session / routing ---------- */
    setSession(role, email) {
      write(SESSION_KEY, { role, email, ts: Date.now() });
    },
    getSession() {
      return read(SESSION_KEY, null);
    },
    clearSession() {
      localStorage.removeItem(SESSION_KEY);
    },
    /* Guard used by each sub-app on load. Returns true if allowed, otherwise
       redirects to the given login URL and returns false. */
    requireRole(role, loginUrl) {
      const s = this.getSession();
      if (!s || s.role !== role) {
        location.href = loginUrl;
        return false;
      }
      return true;
    }
  };

  /* Seed a couple of demo bookings the first time the app is ever opened so
     the Admin Console isn't empty before a vendor makes a live booking. */
  if (localStorage.getItem(BOOKINGS_KEY) === null) {
    write(BOOKINGS_KEY, [
      {
        id: 'BK-000101', status: 'PENDING',
        vendor: 'บ้านขนมคุณยาย', owner: 'พิมพ์ชนก สายใจ',
        event: 'มทส เกษตรแฟร์ 2569', eventId: 'agri',
        zone: 'Food Zone', booth: 'A05', tier: 'A', amount: 700,
        date: '10–16 ก.พ. 2569', createdAt: new Date().toISOString()
      },
      {
        id: 'BK-000102', status: 'PENDING',
        vendor: 'Korat Craft', owner: 'ธนกฤต ใจดี',
        event: 'งานผ้าไหมปักธงชัย 2569', eventId: 'silk',
        zone: 'OTOP Gift', booth: 'O03', tier: 'B', amount: 600,
        date: '5–9 มี.ค. 2569', createdAt: new Date().toISOString()
      }
    ]);
  }

  window.SpaceLinkStore = Store;
})();
