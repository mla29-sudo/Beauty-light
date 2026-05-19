const adminKeys = {
  bookings: 'beeautyLightBookings',
  work: 'beeautyLightWorkItems',
  notes: 'beeautyLightStudioNotes',
  unlocked: 'beeautyLightAdminUnlocked'
};

const defaultPasscode = 'beauty2026';
const dashboard = document.getElementById('adminDashboard');
const gate = document.getElementById('adminGate');
const loginForm = document.getElementById('adminLoginForm');
const loginStatus = document.getElementById('loginStatus');

const appointmentList = document.getElementById('appointmentList');
const bookingFilter = document.getElementById('bookingFilter');
const manualBookingForm = document.getElementById('manualBookingForm');
const workPhotoForm = document.getElementById('workPhotoForm');
const adminGallery = document.getElementById('adminGallery');
const photoStatus = document.getElementById('photoStatus');
const studioNotes = document.getElementById('studioNotes');
const notesStatus = document.getElementById('notesStatus');
const saveNotes = document.getElementById('saveNotes');
const exportData = document.getElementById('exportData');
const importData = document.getElementById('importData');

if (dashboard && gate) {
  document.getElementById('todayHeading').textContent = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });

  if (sessionStorage.getItem(adminKeys.unlocked) === 'true') {
    unlockDashboard();
  }

  loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const passcode = document.getElementById('adminPasscode').value.trim();

    if (passcode !== defaultPasscode) {
      loginStatus.textContent = 'Incorrect passcode.';
      return;
    }

    sessionStorage.setItem(adminKeys.unlocked, 'true');
    unlockDashboard();
  });

  bookingFilter.addEventListener('change', renderAppointments);
  manualBookingForm.addEventListener('submit', addManualBooking);
  workPhotoForm.addEventListener('submit', addWorkPhoto);
  saveNotes.addEventListener('click', saveStudioNotes);
  exportData.addEventListener('click', exportBackup);
  importData.addEventListener('change', importBackup);
}

function unlockDashboard() {
  gate.style.display = 'none';
  dashboard.classList.remove('is-locked');
  studioNotes.value = localStorage.getItem(adminKeys.notes) || '';
  renderAppointments();
  renderAdminGallery();
}

function addManualBooking(event) {
  event.preventDefault();

  const formData = new FormData(manualBookingForm);
  const minutes = Number(formData.get('minutes'));
  const start = formData.get('start');
  const booking = {
    id: `${Date.now()}`,
    services: splitServices(formData.get('services')),
    date: formData.get('date'),
    start,
    end: addMinutes(start, minutes),
    minutes,
    price: Number(formData.get('price')) || 0,
    name: formData.get('name'),
    contact: formData.get('contact'),
    notes: formData.get('notes'),
    status: 'confirmed',
    source: 'admin'
  };

  const bookings = getBookings();
  bookings.push(booking);
  saveBookings(bookings);
  manualBookingForm.reset();
  manualBookingForm.elements.minutes.value = 45;
  manualBookingForm.elements.price.value = 0;
  renderAppointments();
}

function renderAppointments() {
  const filter = bookingFilter.value;
  const bookings = getBookings()
    .map(normalizeBooking)
    .sort((a, b) => `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`));
  const visibleBookings = filter === 'all' ? bookings : bookings.filter((booking) => booking.status === filter);

  appointmentList.innerHTML = '';
  document.getElementById('totalBookings').textContent = bookings.length;
  document.getElementById('pendingBookings').textContent = bookings.filter((booking) => booking.status === 'requested').length;

  if (!visibleBookings.length) {
    appointmentList.innerHTML = '<p class="empty-admin">No appointments match this filter yet.</p>';
    return;
  }

  visibleBookings.forEach((booking) => {
    const card = document.createElement('article');
    card.className = 'appointment-card';
    card.innerHTML = `
      <header>
        <div>
          <h3>${escapeHtml(booking.name || 'Client')}</h3>
          <p class="appointment-meta">
            <span>${formatAdminDate(booking.date)}</span>
            <span>${formatTime(booking.start)} - ${formatTime(booking.end)}</span>
            <span>${booking.minutes} min</span>
            <span>${formatPrice(booking.price || 0)}</span>
          </p>
        </div>
        <span class="appointment-pill ${booking.status}">${booking.status}</span>
      </header>
      <p class="appointment-meta"><strong>Service:</strong> ${escapeHtml(booking.services.join(' + '))}</p>
      <p class="appointment-meta"><strong>Contact:</strong> ${escapeHtml(booking.contact || '')}</p>
      ${booking.notes ? `<p class="appointment-notes">${escapeHtml(booking.notes)}</p>` : ''}
      <div class="appointment-actions">
        <select data-status="${booking.id}" aria-label="Change status">
          <option value="requested" ${booking.status === 'requested' ? 'selected' : ''}>Requested</option>
          <option value="confirmed" ${booking.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
          <option value="completed" ${booking.status === 'completed' ? 'selected' : ''}>Completed</option>
          <option value="cancelled" ${booking.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
        </select>
        <button class="btn btn-secondary danger-button" type="button" data-delete="${booking.id}">Delete</button>
      </div>
    `;
    appointmentList.appendChild(card);
  });

  appointmentList.querySelectorAll('[data-status]').forEach((select) => {
    select.addEventListener('change', () => updateBookingStatus(select.dataset.status, select.value));
  });

  appointmentList.querySelectorAll('[data-delete]').forEach((button) => {
    button.addEventListener('click', () => deleteBooking(button.dataset.delete));
  });
}

function addWorkPhoto(event) {
  event.preventDefault();
  const formData = new FormData(workPhotoForm);
  const file = formData.get('photo');

  if (!file || !file.type.startsWith('image/')) {
    photoStatus.textContent = 'Please choose an image file.';
    return;
  }

  if (file.size > 1200000) {
    photoStatus.textContent = 'Please use an image under 1.2 MB so the browser can store it.';
    return;
  }

  const reader = new FileReader();
  reader.addEventListener('load', () => {
    const items = getWorkItems();
    items.unshift({
      id: `${Date.now()}`,
      src: reader.result,
      category: formData.get('category'),
      title: formData.get('title'),
      alt: formData.get('alt'),
      size: formData.get('size')
    });
    saveWorkItems(items);
    workPhotoForm.reset();
    photoStatus.textContent = 'Photo added. It will appear on the My Work page in this browser.';
    renderAdminGallery();
  });
  reader.readAsDataURL(file);
}

function renderAdminGallery() {
  const items = getWorkItems();
  adminGallery.innerHTML = '';
  document.getElementById('galleryCount').textContent = items.length;

  if (!items.length) {
    adminGallery.innerHTML = '<p class="empty-admin">No custom photos yet.</p>';
    return;
  }

  items.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'admin-gallery-card';
    card.innerHTML = `
      <img src="${item.src}" alt="${escapeHtml(item.alt)}" />
      <div>
        <h3>${escapeHtml(item.category)}</h3>
        <p>${escapeHtml(item.title)}</p>
        <button class="btn btn-secondary danger-button" type="button" data-photo-delete="${item.id}">Remove</button>
      </div>
    `;
    adminGallery.appendChild(card);
  });

  adminGallery.querySelectorAll('[data-photo-delete]').forEach((button) => {
    button.addEventListener('click', () => {
      saveWorkItems(getWorkItems().filter((item) => item.id !== button.dataset.photoDelete));
      renderAdminGallery();
    });
  });
}

function updateBookingStatus(id, status) {
  saveBookings(getBookings().map((booking) => {
    if (booking.id !== id) return booking;
    return { ...booking, status };
  }));
  renderAppointments();
}

function deleteBooking(id) {
  saveBookings(getBookings().filter((booking) => booking.id !== id));
  renderAppointments();
}

function saveStudioNotes() {
  localStorage.setItem(adminKeys.notes, studioNotes.value);
  notesStatus.textContent = 'Notes saved.';
}

function exportBackup() {
  const data = {
    exportedAt: new Date().toISOString(),
    bookings: getBookings(),
    workItems: getWorkItems(),
    notes: localStorage.getItem(adminKeys.notes) || ''
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `beeauty-admin-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener('load', () => {
    try {
      const data = JSON.parse(reader.result);
      if (Array.isArray(data.bookings)) saveBookings(data.bookings);
      if (Array.isArray(data.workItems)) saveWorkItems(data.workItems);
      if (typeof data.notes === 'string') localStorage.setItem(adminKeys.notes, data.notes);
      studioNotes.value = localStorage.getItem(adminKeys.notes) || '';
      renderAppointments();
      renderAdminGallery();
    } catch {
      notesStatus.textContent = 'Could not import that backup file.';
    }
  });
  reader.readAsText(file);
  event.target.value = '';
}

function getBookings() {
  return readJson(adminKeys.bookings);
}

function saveBookings(bookings) {
  localStorage.setItem(adminKeys.bookings, JSON.stringify(bookings.map(normalizeBooking)));
}

function getWorkItems() {
  return readJson(adminKeys.work);
}

function saveWorkItems(items) {
  localStorage.setItem(adminKeys.work, JSON.stringify(items));
}

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    return [];
  }
}

function normalizeBooking(booking) {
  return {
    ...booking,
    services: Array.isArray(booking.services) ? booking.services : splitServices(booking.services || ''),
    status: booking.status || 'requested'
  };
}

function splitServices(value) {
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatAdminDate(value) {
  return parseIsoDate(value).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
