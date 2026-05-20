const http = require('http');
const fs = require('fs/promises');
const path = require('path');

const port = Number(process.env.PORT) || 3000;
const rootDir = __dirname;
const dataDir = process.env.DATA_DIR || path.join(rootDir, 'data');
const bookingFile = path.join(dataDir, 'bookings.json');

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
