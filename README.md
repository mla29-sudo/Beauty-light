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

## Booking Notifications

The server can send confirmation emails with Resend and SMS messages with Twilio after a customer requests an appointment.

Set these environment variables in Render under **Environment**:

```bash
STUDIO_NAME=Beauty Light Studio
OWNER_EMAIL=your-email@example.com
RESEND_API_KEY=re_your_resend_key
RESEND_FROM_EMAIL=Beauty Light Studio <appointments@your-domain.com>
TWILIO_ACCOUNT_SID=AC_your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_FROM_NUMBER=+15065551234
```

Email requires `RESEND_API_KEY` and `RESEND_FROM_EMAIL`. SMS requires all three Twilio variables. If a customer types an email in the contact field, they receive an email. If they type a phone number, they receive a text message. The studio owner receives a new-booking email when `OWNER_EMAIL` is set.
