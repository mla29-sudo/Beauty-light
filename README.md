# Beauty Light Studio

Run the shared booking server locally:

```bash
npm start
```

Open `http://localhost:3000/booking.html`. Bookings are saved in `data/bookings.json`, so every device that uses the same running site sees the same unavailable time slots.

For another device on the same Wi-Fi, open `http://YOUR-COMPUTER-IP:3000/booking.html`. For public customer bookings, deploy this as a Node app on a hosting provider so everyone reaches the same server.

## Put It Online

Use a host that can run a Node server, not static-only hosting.

1. Push this folder to a GitHub repository.
2. Create a new Node web service on a host such as Render, Railway, Fly.io, DigitalOcean, or a VPS.
3. Set the start command to:

```bash
npm start
```

4. Make sure the host provides persistent storage for bookings.
5. If the host gives you a persistent folder path, set this environment variable:

```bash
DATA_DIR=/path/to/persistent/storage
```

Bookings are written to `bookings.json` inside that folder. Without persistent storage or a real database, appointments may disappear when the online server restarts.
