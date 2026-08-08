-- =====================================================================
-- Run this in Supabase -> SQL Editor. It's safe to run once.
-- This sets up permissions so that ONLY a logged-in admin (not the
-- public website) can see full booking details and cancel bookings.
-- =====================================================================

-- Let logged-in (authenticated) users see every column of every booking,
-- including client name/email/phone. Public site visitors still can't --
-- they only ever go through get_busy_slots(), which never exposes this.
create policy "Authenticated users can view all bookings"
on bookings for select
to authenticated
using (true);

-- Let logged-in users update a booking (used for cancelling -- see below)
create policy "Authenticated users can update bookings"
on bookings for update
to authenticated
using (true)
with check (true);

-- Let a logged-in admin create a booking manually (e.g. a phone booking),
-- through the SAME safe function the public site uses, so the
-- no-double-booking rule still applies even to admin-entered bookings.
grant execute on function book_treatment(text, int, timestamptz, timestamptz, text, text, text) to authenticated;

-- Let a logged-in admin check availability the same way the public site does
grant execute on function get_busy_slots(date) to authenticated;
