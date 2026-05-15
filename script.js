const revealItems = document.querySelectorAll('.reveal');

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.16 });

  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add('visible'));
}

document.querySelectorAll('#year').forEach((year) => {
  year.textContent = new Date().getFullYear();
});

const menuBtn = document.querySelector('.menu-btn');
const nav = document.getElementById('site-nav');

if (menuBtn && nav) {
  menuBtn.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', String(isOpen));
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      menuBtn.setAttribute('aria-expanded', 'false');
    });
  });
}

const serviceDurations = [
  { name: 'Electrolysis', minutes: 45, note: 'Short consultation plus a focused treatment block.' },
  { name: 'Waxing', minutes: 45, note: 'Average block for common waxing services; large areas may need more time.' },
  { name: 'Pedicures', minutes: 60, note: 'Classic pedicure timing with room for polish and care notes.' },
  { name: 'Medical pedicures', minutes: 75, note: 'More detailed foot care and wellness-focused attention.' },
  { name: 'Manicures', minutes: 45, note: 'Standard manicure timing for shaping, care, and finish.' },
  { name: 'Facials', minutes: 75, note: 'Full skin reset timing with consultation and aftercare.' },
  { name: 'Eyebrow Tinting', minutes: 20, note: 'Quick color service with preparation and cleanup.' },
  { name: 'Lash tinting', minutes: 25, note: 'Lash preparation, tint processing, and cleanup.' }
];

const bookingForm = document.getElementById('bookingForm');

if (bookingForm) {
  const serviceChoices = document.getElementById('bookingServices');
  const dateInput = document.getElementById('bookingDate');
  const timeInput = document.getElementById('bookingTime');
  const slotGrid = document.getElementById('slotGrid');
  const durationPanel = document.getElementById('durationPanel');
  const durationList = document.getElementById('durationList');
  const bookingStatus = document.getElementById('bookingStatus');
  const clearBookings = document.getElementById('clearBookings');
  const storageKey = 'beeautyLightBookings';

  serviceDurations.forEach((service) => {
    const choice = document.createElement('label');
    choice.className = 'service-choice';
    choice.innerHTML = `
      <input type="checkbox" name="services" value="${service.name}" />
      <span>
        <strong>${service.name}</strong>
        <small>${service.minutes} min</small>
      </span>
    `;
    serviceChoices.appendChild(choice);

    const row = document.createElement('div');
    row.className = 'duration-item';
    row.innerHTML = `<strong>${service.name}</strong><span>${service.minutes} min</span>`;
    durationList.appendChild(row);
  });

  const today = new Date();
  const todayIso = toIsoDate(today);
  dateInput.min = todayIso;
  dateInput.value = todayIso;

  const serviceInputs = [...serviceChoices.querySelectorAll('input[name="services"]')];
  serviceInputs[0].checked = true;

  serviceChoices.addEventListener('change', () => {
    if (!getSelectedServices().length) {
      serviceInputs[0].checked = true;
    }
    renderAvailability();
  });
  dateInput.addEventListener('change', renderAvailability);

  bookingForm.addEventListener('submit', (event) => {
    event.preventDefault();

    if (!timeInput.value) {
      bookingStatus.textContent = 'Please choose an available time before submitting.';
      return;
    }

    const selectedServices = getSelectedServices();
    const totalMinutes = getTotalDuration(selectedServices);
    const formData = new FormData(bookingForm);
    const booking = {
      id: `${Date.now()}`,
      services: selectedServices.map((service) => service.name),
      date: dateInput.value,
      start: timeInput.value,
      end: addMinutes(timeInput.value, totalMinutes),
      minutes: totalMinutes,
      name: formData.get('name'),
      contact: formData.get('contact'),
      notes: formData.get('notes')
    };

    const bookings = getBookings();
    bookings.push(booking);
    localStorage.setItem(storageKey, JSON.stringify(bookings));

    bookingStatus.textContent = `Requested ${booking.services.join(' + ')} on ${formatDate(booking.date)} at ${formatTime(booking.start)}. That time is now unavailable.`;
    bookingForm.reset();
    dateInput.value = booking.date;
    serviceInputs.forEach((input) => {
      input.checked = booking.services.includes(input.value);
    });
    timeInput.value = '';
    renderAvailability();
  });

  clearBookings.addEventListener('click', () => {
    localStorage.removeItem(storageKey);
    bookingStatus.textContent = 'Demo bookings cleared. All valid times are available again.';
    timeInput.value = '';
    renderAvailability();
  });

  renderAvailability();

  function renderAvailability() {
    const selectedServices = getSelectedServices();
    const totalMinutes = getTotalDuration(selectedServices);
    const selectedDate = parseIsoDate(dateInput.value);
    const day = selectedDate.getDay();
    const hours = getHoursForDay(day);

    timeInput.value = '';
    slotGrid.innerHTML = '';
    durationPanel.innerHTML = `
      <strong>${selectedServices.map((service) => service.name).join(' + ')}</strong>
      <span>${totalMinutes} minutes total</span>
      <p>${selectedServices.length > 1 ? 'These services will be booked together as one longer appointment.' : selectedServices[0].note}</p>
    `;

    if (!hours) {
      slotGrid.innerHTML = '<p class="empty-slots">Closed on Sundays. Please choose another date.</p>';
      return;
    }

    const slots = buildSlots(hours.start, hours.end, totalMinutes);
    const bookings = getBookings().filter((booking) => booking.date === dateInput.value);
    const availableSlots = slots.filter((slot) => {
      const slotEnd = addMinutes(slot, totalMinutes);
      return !bookings.some((booking) => rangesOverlap(slot, slotEnd, booking.start, booking.end));
    });

    if (!availableSlots.length) {
      slotGrid.innerHTML = '<p class="empty-slots">No times left for these services on this date. Try another day.</p>';
      return;
    }

    availableSlots.forEach((slot) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'slot-button';
      button.textContent = formatTime(slot);
      button.addEventListener('click', () => {
        document.querySelectorAll('.slot-button.selected').forEach((item) => item.classList.remove('selected'));
        button.classList.add('selected');
        timeInput.value = slot;
        bookingStatus.textContent = `${formatTime(slot)} selected.`;
      });
      slotGrid.appendChild(button);
    });
  }

  function getSelectedServices() {
    return serviceInputs
      .filter((input) => input.checked)
      .map((input) => serviceDurations.find((service) => service.name === input.value))
      .filter(Boolean);
  }

  function getTotalDuration(services) {
    return services.reduce((total, service) => total + service.minutes, 0);
  }

  function getBookings() {
    try {
      return JSON.parse(localStorage.getItem(storageKey)) || [];
    } catch {
      return [];
    }
  }
}

function getHoursForDay(day) {
  if (day === 0) return null;
  if (day === 6) return { start: '10:00', end: '17:00' };
  return { start: '09:00', end: '19:00' };
}

function buildSlots(openTime, closeTime, duration) {
  const slots = [];
  let cursor = toMinutes(openTime);
  const latestStart = toMinutes(closeTime) - duration;

  while (cursor <= latestStart) {
    slots.push(fromMinutes(cursor));
    cursor += 15;
  }

  return slots;
}

function rangesOverlap(startA, endA, startB, endB) {
  return toMinutes(startA) < toMinutes(endB) && toMinutes(endA) > toMinutes(startB);
}

function addMinutes(time, minutes) {
  return fromMinutes(toMinutes(time) + minutes);
}

function toMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function fromMinutes(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function formatTime(time) {
  const [hours, minutes] = time.split(':').map(Number);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(value) {
  return parseIsoDate(value).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}