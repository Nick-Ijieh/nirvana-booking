document.addEventListener("DOMContentLoaded", function () {
  const CAPE_TOWN_OFFSET_MS = 2 * 60 * 60 * 1000; // UTC+2, no daylight saving

  const loginScreen = document.querySelector("#login-screen");
  const dashboard = document.querySelector("#dashboard");
  const loginForm = document.querySelector("#login-form");
  const loginError = document.querySelector("#login-error");
  const logoutBtn = document.querySelector("#logout-btn");

  const dateFilter = document.querySelector("#date-filter");
  const showAllBtn = document.querySelector("#show-all-btn");
  const showCancelledToggle = document.querySelector("#show-cancelled-toggle");
  const addBookingBtn = document.querySelector("#add-booking-btn");
  const addModal = document.querySelector("#add-modal");
  const addForm = document.querySelector("#add-booking-form");
  const addCancelBtn = document.querySelector("#add-cancel-btn");
  const addError = document.querySelector("#add-error");

  const loadingMsg = document.querySelector("#loading-msg");
  const emptyMsg = document.querySelector("#empty-msg");
  const bookingsBody = document.querySelector("#bookings-body");

  let viewDate = null; // null = "all upcoming"
  let showCancelled = false;
  let allBookings = [];

  /* ---------------- Time helpers (Cape Town, UTC+2) ---------------- */
  function capeTownParts(isoString) {
    const shifted = new Date(new Date(isoString).getTime() + CAPE_TOWN_OFFSET_MS);
    const y = shifted.getUTCFullYear();
    const m = (shifted.getUTCMonth() + 1).toString().padStart(2, "0");
    const d = shifted.getUTCDate().toString().padStart(2, "0");
    const h = shifted.getUTCHours();
    const min = shifted.getUTCMinutes().toString().padStart(2, "0");
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return {
      dateKey: `${y}-${m}-${d}`,
      displayDate: `${d}/${m}/${y}`,
      displayTime: `${h12}:${min} ${period}`,
    };
  }

  function todayCapeTownKey() {
    return capeTownParts(new Date().toISOString()).dateKey;
  }

  /* ---------------- Auth ---------------- */
  async function checkSession() {
    const { data } = await supabaseClient.auth.getSession();
    if (data.session) {
      showDashboard();
    } else {
      showLogin();
    }
  }

  function showLogin() {
    loginScreen.style.display = "flex";
    dashboard.style.display = "none";
  }

  function showDashboard() {
    loginScreen.style.display = "none";
    dashboard.style.display = "block";
    loadBookings();
  }

  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    loginError.textContent = "";
    const email = document.querySelector("#login-email").value;
    const password = document.querySelector("#login-password").value;

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      loginError.textContent = "Incorrect email or password.";
      return;
    }
    showDashboard();
  });

  logoutBtn.addEventListener("click", async function () {
    await supabaseClient.auth.signOut();
    showLogin();
  });

  /* ---------------- Load & render bookings ---------------- */
  async function loadBookings() {
    loadingMsg.style.display = "block";
    bookingsBody.innerHTML = "";
    emptyMsg.style.display = "none";

    const { data, error } = await supabaseClient
      .from("bookings")
      .select("*")
      .order("start_time", { ascending: true });

    loadingMsg.style.display = "none";

    if (error) {
      emptyMsg.textContent = "Couldn't load bookings: " + error.message;
      emptyMsg.style.display = "block";
      return;
    }

    allBookings = data || [];
    renderTable();
  }

  function renderTable() {
    bookingsBody.innerHTML = "";
    const todayKey = todayCapeTownKey();

    let rows = allBookings.filter(function (b) {
      if (!showCancelled && b.status === "cancelled") return false;
      const bDateKey = capeTownParts(b.start_time).dateKey;
      if (viewDate) return bDateKey === viewDate;
      return bDateKey >= todayKey; // "all upcoming" = today onward
    });

    if (rows.length === 0) {
      emptyMsg.style.display = "block";
      return;
    }
    emptyMsg.style.display = "none";

    rows.forEach(function (b) {
      const start = capeTownParts(b.start_time);
      const end = capeTownParts(b.end_time);
      const created = capeTownParts(b.created_at);
      const isCancelled = b.status === "cancelled";

      const tr = document.createElement("tr");
      if (isCancelled) tr.className = "cancelled-row";

      tr.innerHTML = `
        <td>${start.displayDate}</td>
        <td>${start.displayTime} &ndash; ${end.displayTime}</td>
        <td>${escapeHtml(b.service_name || "")}</td>
        <td>${b.duration_minutes} min</td>
        <td><span class="staff-badge">Staff ${b.staff_index + 1}</span></td>
        <td>${escapeHtml(b.client_name || "")}</td>
        <td>${escapeHtml(b.client_phone || "")}</td>
        <td>${escapeHtml(b.client_email || "")}</td>
        <td><span class="badge ${isCancelled ? "badge-cancelled" : "badge-confirmed"}">${isCancelled ? "Cancelled" : "Confirmed"}</span></td>
        <td>${created.displayDate}</td>
        <td></td>
      `;

      const actionCell = tr.lastElementChild;
      if (!isCancelled) {
        const cancelBtn = document.createElement("button");
        cancelBtn.className = "btn btn-outline btn-sm";
        cancelBtn.textContent = "Cancel";
        cancelBtn.addEventListener("click", function () {
          cancelBooking(b.id, cancelBtn);
        });
        actionCell.appendChild(cancelBtn);
      }

      bookingsBody.appendChild(tr);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  async function cancelBooking(id, btn) {
    if (!confirm("Cancel this booking? This will free up the time slot again.")) return;
    btn.disabled = true;
    btn.textContent = "Cancelling...";

    const { error } = await supabaseClient
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", id);

    if (error) {
      alert("Couldn't cancel: " + error.message);
      btn.disabled = false;
      btn.textContent = "Cancel";
      return;
    }
    loadBookings();
  }

  /* ---------------- Filters ---------------- */
  dateFilter.addEventListener("change", function () {
    viewDate = dateFilter.value || null;
    renderTable();
  });
  showAllBtn.addEventListener("click", function () {
    viewDate = null;
    dateFilter.value = "";
    renderTable();
  });
  showCancelledToggle.addEventListener("click", function () {
    showCancelled = !showCancelled;
    showCancelledToggle.textContent = showCancelled ? "Hide Cancelled" : "Show Cancelled";
    renderTable();
  });

  /* ---------------- Add booking: availability helpers (same rules as the public site) ---------------- */
  const STAFF_COUNT = 2;
  const BUFFER_MINUTES = 15;
  const SLOT_STEP_MINUTES = 15;

  function toMinutes(timeStr) {
    const [h, m] = timeStr.split(":").map(Number);
    return h * 60 + m;
  }
  function toTimeStr(mins) {
    const h = Math.floor(mins / 60).toString().padStart(2, "0");
    const m = (mins % 60).toString().padStart(2, "0");
    return `${h}:${m}`;
  }
  function formatDisplayTime(timeStr) {
    const [h, m] = timeStr.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
  }
  function hoursForDate(dateStr) {
    const day = new Date(dateStr + "T12:00:00+02:00").getDay();
    if (day === 0) return { open: "10:00", close: "17:00" };
    if (day === 6) return { open: "09:00", close: "18:00" };
    return { open: "09:00", close: "19:00" };
  }
  function toCapeTownMinutes(isoString) {
    const d = new Date(isoString);
    return (d.getUTCHours() * 60 + d.getUTCMinutes() + 120) % 1440;
  }
  function fitsOnStaffTrack(staffBookings, start, end) {
    for (const b of staffBookings) {
      const blockedStart = b.start - BUFFER_MINUTES;
      const blockedEnd = b.end + BUFFER_MINUTES;
      if (start < blockedEnd && end > blockedStart) return false;
    }
    return true;
  }
  function isSlotAvailable(staffTimelines, start, end) {
    for (let i = 0; i < staffTimelines.length; i++) {
      if (fitsOnStaffTrack(staffTimelines[i], start, end)) return true;
    }
    return false;
  }
  function isSlotAvailableForBoth(staffTimelines, start, end) {
    return staffTimelines.every(function (timeline) {
      return fitsOnStaffTrack(timeline, start, end);
    });
  }
  function requiresBothStaff(serviceName) {
    return serviceName === "Couples Massage";
  }

  /* ---------------- Add booking: modal flow ---------------- */
  const addStep1 = document.querySelector("#add-step-1");
  const addStep2 = document.querySelector("#add-step-2");
  const addCheckBtn = document.querySelector("#add-check-btn");
  const addCheckError = document.querySelector("#add-check-error");
  const addSlotsContainer = document.querySelector("#add-slots");
  const addBackTo1Btn = document.querySelector("#add-back-to-1-btn");
  const addBackTo2Btn = document.querySelector("#add-back-to-2-btn");
  const addSelectedSummary = document.querySelector("#add-selected-summary");

  let selectedAddSlot = null;

  function resetAddModal() {
    document.querySelector("#add-service").value = "";
    document.querySelector("#add-date").value = "";
    addForm.reset();
    addCheckError.textContent = "";
    addError.textContent = "";
    addStep1.style.display = "block";
    addStep2.style.display = "none";
    addForm.style.display = "none";
  }

  addBookingBtn.addEventListener("click", function () {
    resetAddModal();
    addModal.style.display = "flex";
  });
  addCancelBtn.addEventListener("click", function () {
    addModal.style.display = "none";
  });
  addModal.addEventListener("click", function (e) {
    if (e.target === addModal) addModal.style.display = "none";
  });
  addBackTo1Btn.addEventListener("click", function () {
    addStep2.style.display = "none";
    addStep1.style.display = "block";
  });
  addBackTo2Btn.addEventListener("click", function () {
    addForm.style.display = "none";
    addStep2.style.display = "block";
  });

  addCheckBtn.addEventListener("click", async function () {
    addCheckError.textContent = "";
    const serviceSelect = document.querySelector("#add-service");
    const dateStr = document.querySelector("#add-date").value;

    if (!serviceSelect.value || !dateStr) {
      addCheckError.textContent = "Please choose a treatment and a date first.";
      return;
    }

    const option = serviceSelect.selectedOptions[0];
    const durationMinutes = parseInt(option.getAttribute("data-duration"), 10);
    const serviceName = option.textContent.split(" (")[0].trim();
    const needsBoth = requiresBothStaff(serviceName);

    addCheckBtn.disabled = true;
    addCheckBtn.textContent = "Checking...";

    try {
      const { data, error } = await supabaseClient.rpc("get_busy_slots", { p_date: dateStr });
      if (error) throw error;

      const staffTimelines = Array.from({ length: STAFF_COUNT }, () => []);
      (data || []).forEach(function (row) {
        const startMin = toCapeTownMinutes(row.start_time);
        const endMin = toCapeTownMinutes(row.end_time);
        if (staffTimelines[row.staff_index]) {
          staffTimelines[row.staff_index].push({ start: startMin, end: endMin });
        }
      });

      const { open, close } = hoursForDate(dateStr);
      const openMin = toMinutes(open);
      const closeMin = toMinutes(close);

      const availableTimes = [];
      for (let t = openMin; t + durationMinutes <= closeMin; t += SLOT_STEP_MINUTES) {
        const fits = needsBoth
          ? isSlotAvailableForBoth(staffTimelines, t, t + durationMinutes)
          : isSlotAvailable(staffTimelines, t, t + durationMinutes);
        if (fits) availableTimes.push(t);
      }

      renderAddSlots(availableTimes, durationMinutes, serviceName, dateStr);
    } catch (err) {
      console.error(err);
      addCheckError.textContent = "Something went wrong checking availability. Please try again.";
    } finally {
      addCheckBtn.disabled = false;
      addCheckBtn.textContent = "Check Available Times";
    }
  });

  function renderAddSlots(availableTimes, durationMinutes, serviceName, dateStr) {
    addSlotsContainer.innerHTML = "";

    if (availableTimes.length === 0) {
      addSlotsContainer.innerHTML = '<p class="empty-msg">No open times on this date for that treatment.</p>';
    } else {
      availableTimes.forEach(function (startMin) {
        const timeStr = toTimeStr(startMin);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "admin-slot-btn";
        btn.textContent = formatDisplayTime(timeStr);
        btn.addEventListener("click", function () {
          const startISO = `${dateStr}T${timeStr}:00+02:00`;
          const endISO = `${dateStr}T${toTimeStr(startMin + durationMinutes)}:00+02:00`;
          selectedAddSlot = {
            startISO: startISO,
            endISO: endISO,
            serviceName: serviceName,
            durationMinutes: durationMinutes,
            display: `${serviceName} &mdash; ${formatDisplayTime(timeStr)} on ${dateStr}`,
          };
          addSelectedSummary.innerHTML = selectedAddSlot.display;
          addStep2.style.display = "none";
          addForm.style.display = "block";
        });
        addSlotsContainer.appendChild(btn);
      });
    }

    addStep1.style.display = "none";
    addStep2.style.display = "block";
  }

  addForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    addError.textContent = "";

    const name = document.querySelector("#add-name").value;
    const phone = document.querySelector("#add-phone").value;
    const email = document.querySelector("#add-email").value || null;

    const submitBtn = addForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving...";

    const { error } = await supabaseClient.rpc("book_treatment", {
      p_service_name: selectedAddSlot.serviceName,
      p_duration_minutes: selectedAddSlot.durationMinutes,
      p_start_time: selectedAddSlot.startISO,
      p_end_time: selectedAddSlot.endISO,
      p_client_name: name,
      p_client_email: email,
      p_client_phone: phone,
      p_both_staff: requiresBothStaff(selectedAddSlot.serviceName),
    });

    submitBtn.disabled = false;
    submitBtn.textContent = "Save Booking";

    if (error) {
      addError.textContent = "That time was just taken. Please go back and choose another.";
      return;
    }

    addModal.style.display = "none";
    loadBookings();
  });

  checkSession();
});
