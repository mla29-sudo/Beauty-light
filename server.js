const http = require('http');
const fs = require('fs/promises');
const path = require('path');

const port = Number(process.env.PORT) || 3000;
const rootDir = __dirname;
const dataDir = process.env.DATA_DIR || path.join(rootDir, 'data');
const bookingFile = path.join(dataDir, 'bookings.json');
const studioName = process.env.STUDIO_NAME || 'Beauty Light Studio';
const ownerEmail = process.env.OWNER_EMAIL || '';
const resendApiKey = process.env.RESEND_API_KEY || '';
const resendFromEmail = process.env.RESEND_FROM_EMAIL || '';
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID || '';
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN || '';
const twilioFromNumber = process.env.TWILIO_FROM_NUMBER || '';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml'
};

const server = http.createServer(async (request, response) => {
  try {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname === '/api/bookings' && request.method === 'GET') {
      sendJson(response, await readBookings());
      return;
    }

    if (url.pathname === '/api/bookings' && request.method === 'POST') {
      const booking = normalizeBooking(await readJsonBody(request));
      const bookings = await readBookings();

      if (!booking.date || !booking.start || !booking.end || !booking.name || !booking.contact) {
        sendJson(response, { error: 'Missing required booking fields.' }, 400);
        return;
      }

      const conflict = bookings.some((item) => (
        blocksAvailability(item)
        && item.date === booking.date
        && rangesOverlap(booking.start, booking.end, item.start, item.end)
      ));

      if (conflict) {
        sendJson(response, { error: 'That time was just booked. Please choose another available time.' }, 409);
        return;
      }

      const savedBooking = {
        ...booking,
        id: booking.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        createdAt: booking.createdAt || new Date().toISOString()
      };

      bookings.push(savedBooking);
      await writeBookings(bookings);
      notifyBooking(savedBooking).catch((error) => {
        console.error('Booking notification failed:', error);
      });
      sendJson(response, savedBooking, 201);
      return;
    }

    if (url.pathname === '/api/bookings' && request.method === 'PUT') {
      const bookings = await readJsonBody(request);

      if (!Array.isArray(bookings)) {
        sendJson(response, { error: 'Expected a booking array.' }, 400);
        return;
      }

      await writeBookings(bookings);
      sendJson(response, await readBookings());
      return;
    }

    const statusMatch = url.pathname.match(/^\/api\/bookings\/([^/]+)\/status$/);
    if (statusMatch && request.method === 'PATCH') {
      const { status } = await readJsonBody(request);
      const bookings = await readBookings();
      const booking = bookings.find((item) => item.id === decodeURIComponent(statusMatch[1]));

      if (!booking) {
        sendJson(response, { error: 'Booking not found.' }, 404);
        return;
      }

      booking.status = status || booking.status;
      await writeBookings(bookings);
      sendJson(response, booking);
      return;
    }

    const deleteMatch = url.pathname.match(/^\/api\/bookings\/([^/]+)$/);
    if (deleteMatch && request.method === 'DELETE') {
      const id = decodeURIComponent(deleteMatch[1]);
      const bookings = await readBookings();
      await writeBookings(bookings.filter((booking) => booking.id !== id));
      sendJson(response, { ok: true });
      return;
    }

    await serveStatic(url.pathname, response);
  } catch (error) {
    console.error(error);
    sendJson(response, { error: 'Server error.' }, 500);
  }
});

server.listen(port, () => {
  console.log(`Beauty Light Studio is running at http://localhost:${port}`);
});

async function serveStatic(urlPath, response) {
  const decodedPath = decodeURIComponent(urlPath === '/' ? '/index.html' : urlPath);
  const requestedPath = path.normalize(path.join(rootDir, decodedPath));
  const relativePath = path.relative(rootDir, requestedPath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const file = await fs.readFile(requestedPath);
    response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(requestedPath).toLowerCase()] || 'application/octet-stream' });
    response.end(file);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
}

async function readBookings() {
  try {
    const raw = await fs.readFile(bookingFile, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeBooking) : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeBookings(bookings) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(bookingFile, `${JSON.stringify(bookings.map(normalizeBooking), null, 2)}\n`);
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1000000) {
        request.destroy();
        reject(new Error('Request body too large.'));
      }
    });
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

function sendJson(response, data, status = 200) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(data));
}

function normalizeBooking(booking) {
  return {
    ...booking,
    services: Array.isArray(booking.services) ? booking.services : splitServices(booking.services || ''),
    status: booking.status || 'requested'
  };
}

async function notifyBooking(booking) {
  const customerEmail = extractEmail(booking.contact);
  const customerPhone = extractPhone(booking.contact);
  const subject = `Appointment request received - ${studioName}`;
  const plainMessage = buildBookingMessage(booking);
  const htmlMessage = buildBookingHtml(booking);

  if (customerEmail) {
    await sendEmail({
      to: customerEmail,
      subject,
      html: htmlMessage
    });
  }

  if (ownerEmail) {
    await sendEmail({
      to: ownerEmail,
      subject: `New appointment request from ${booking.name}`,
      html: buildOwnerBookingHtml(booking)
    });
  }

  if (customerPhone) {
    await sendSms(customerPhone, plainMessage);
  }
}

async function sendEmail({ to, subject, html }) {
  if (!resendApiKey || !resendFromEmail) return;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: resendFromEmail,
      to,
      subject,
      html
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend email failed: ${errorText}`);
  }
}

async function sendSms(to, body) {
  if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) return;

  const params = new URLSearchParams({
    To: to,
    From: twilioFromNumber,
    Body: body
  });

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Twilio SMS failed: ${errorText}`);
  }
}

function buildBookingMessage(booking) {
  return `${studioName}: We received your appointment request for ${booking.services.join(' + ')} on ${formatDate(booking.date)} at ${formatTime(booking.start)}. We will confirm it soon.`;
}

function buildBookingHtml(booking) {
  return `
    <h1>Appointment request received</h1>
    <p>Hi ${escapeHtml(booking.name)}, we received your appointment request.</p>
    <p><strong>Service:</strong> ${escapeHtml(booking.services.join(' + '))}</p>
    <p><strong>Date:</strong> ${escapeHtml(formatDate(booking.date))}</p>
    <p><strong>Time:</strong> ${escapeHtml(formatTime(booking.start))} - ${escapeHtml(formatTime(booking.end))}</p>
    <p><strong>Estimated total:</strong> ${escapeHtml(formatPrice(booking.price || 0))}</p>
    <p>We will confirm your appointment soon.</p>
  `;
}

function buildOwnerBookingHtml(booking) {
  return `
    <h1>New appointment request</h1>
    <p><strong>Name:</strong> ${escapeHtml(booking.name)}</p>
    <p><strong>Contact:</strong> ${escapeHtml(booking.contact)}</p>
    <p><strong>Service:</strong> ${escapeHtml(booking.services.join(' + '))}</p>
    <p><strong>Date:</strong> ${escapeHtml(formatDate(booking.date))}</p>
    <p><strong>Time:</strong> ${escapeHtml(formatTime(booking.start))} - ${escapeHtml(formatTime(booking.end))}</p>
    <p><strong>Estimated total:</strong> ${escapeHtml(formatPrice(booking.price || 0))}</p>
    ${booking.notes ? `<p><strong>Notes:</strong> ${escapeHtml(booking.notes)}</p>` : ''}
  `;
}

function extractEmail(value) {
  const match = String(value).match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
  return match ? match[0] : '';
}

function extractPhone(value) {
  const normalized = String(value).replace(/[^\d+]/g, '');
  if (normalized.startsWith('+') && normalized.length >= 10) return normalized;
  if (normalized.length === 10) return `+1${normalized}`;
  if (normalized.length === 11 && normalized.startsWith('1')) return `+${normalized}`;
  return '';
}

function blocksAvailability(booking) {
  return booking.status !== 'cancelled';
}

function splitServices(value) {
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function rangesOverlap(startA, endA, startB, endB) {
  return toMinutes(startA) < toMinutes(endB) && toMinutes(endA) > toMinutes(startB);
}

function toMinutes(time) {
  const [hours, minutes] = String(time).split(':').map(Number);
  return hours * 60 + minutes;
}

function formatDate(value) {
  const [year, month, day] = String(value).split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatTime(time) {
  const [hours, minutes] = String(time).split(':').map(Number);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function formatPrice(price) {
  return `$${price}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
