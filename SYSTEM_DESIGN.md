# System Design Write-up: Ticket Booking Platform

## 1. Introduction

This document outlines the system design of a ticket booking platform for movies and concerts. The system handles high-demand events with features including seat holds, waitlists, concurrency prevention, and automated email notifications with QR codes. The platform serves three user roles: **Admin**, **Organiser**, and **Customer**.

---

## 2. System Architecture

The application follows a three-tier architecture:

- **Frontend**: HTML/CSS/JavaScript providing a responsive UI with real-time seat maps
- **Backend**: Node.js/Express REST API with JWT authentication
- **Database**: MongoDB for persistent storage with Mongoose ODM

### 2.1 Database Design

The database consists of five main collections:

1. **User** — Stores user credentials and role (admin/organiser/customer)
2. **Venue** — Contains venue details, seat layout configuration
3. **Show** — Represents events with seat inventory
4. **Booking** — Tracks confirmed bookings with QR codes
5. **Waitlist** — Manages waiting queues per show and category

### 2.2 Seat Inventory Model

Seats are stored as an array within each show document. Each seat contains:
- Row and seat number
- Category (Premium/Standard)
- Status (available/held/booked)
- Hold timestamps (`heldBy`, `heldUntil`)

This embedded approach ensures atomic updates and simplifies queries.

---

## 3. Core Features Implementation

### 3.1 Seat Hold with TTL (Time-To-Live)

**Mechanism:**
1. When a user selects seats and clicks "Hold", the system:
   - Sets seat status to `held`
   - Records `heldUntil` = current time + 10 minutes
   - Starts a frontend countdown timer
2. A `node-cron` scheduler runs every minute:
   - Finds all seats with expired holds
   - Updates status back to `available`
   - Logs the release action

**Why 10 minutes?**
- Balances user convenience with seat availability
- Industry standard (BookMyShow, Ticketmaster use 5–10 minutes)
- Reduces cart abandonment while preventing indefinite holds

### 3.2 Concurrency Prevention

**Challenge:** Two users attempting to book the same seat simultaneously.

**Solution:** Atomic MongoDB operations with status checking.

```javascript
// Pseudocode
const seat = show.seats.find(s => s.id === seatId);
if (seat.status !== 'available') {
    return error;
}
seat.status = 'held';
seat.heldBy = userId;
seat.heldUntil = now + 10min;
await show.save();
```

**Additional Protection:**
- Seat status checked before each hold/booking
- Status transitions: `available` → `held` → `booked`
- Held seats cannot be booked by other users
- Database-level locking prevents race conditions

### 3.3 Waitlist Auto-Assignment

**Flow:**

1. **Join Waitlist**
   - User selects category (Premium/Standard)
   - System assigns position number
   - Status = `waiting`

2. **Cancellation Triggers**
   When a booking is cancelled:
   - Seat becomes available
   - System finds next waiting user (lowest position)
   - Seat is offered with a 15-minute time limit

3. **Time-Limited Offer**
   - Offer expires after 15 minutes
   - Scheduler checks for expired offers
   - If expired, offer moves to next in queue
   - Email notification sent to each offer recipient

**Queue Management:**
- Separate queues per show and category
- Position numbers maintained automatically
- FCFS (First Come First Serve) policy

### 3.4 QR Code and Email

**QR Code Generation:**
- Booking reference encoded as QR
- Generated using the `qrcode` library
- Embedded in email as inline image
- Displayed on frontend (popup + My Tickets)

**Email Flow:**
- On booking confirmation:
  1. Generate QR code
  2. Send HTML email with QR image
  3. Include booking details
- On waitlist offer:
  1. Send notification email
  2. Include time-limited link
  3. Offer expires automatically

---

## 4. Real-Time Updates

**How the seat map stays updated:**
- Frontend refreshes after each action (hold, release, book)
- Scheduler auto-releases seats without user action
- 30-second auto-refresh for availability

**User Experience:**
- Visual seat colors change in real-time
- Timer visible during hold period
- Toast notifications for all actions

---

## 5. Security Considerations

- **Authentication**: JWT-based with 7-day expiry
- **Authorization**: Role-based access (admin/organiser/customer)
- **Data Validation**: All inputs validated on server
- **Password Security**: Bcrypt hashing with salt
- **Environment Variables**: Sensitive data stored in `.env`

---

## 6. Error Handling

- Centralized Express error-handling middleware catches unhandled exceptions and returns consistent JSON error responses
- Mongoose validation errors are caught and mapped to user-friendly `400` responses
- Seat hold/booking conflicts return `409 Conflict` when a seat is no longer available
- Auth failures return `401 Unauthorized`; permission failures return `403 Forbidden`
- All async route handlers are wrapped to forward errors to the error middleware instead of crashing the process

---

## 7. Testing Approach

- **Manual end-to-end testing** of core flows: registration/login → browse shows → hold seats → payment simulation → booking confirmation → QR/email delivery → cancellation → waitlist offer
- **Role-based testing**: verified Admin (venue management), Organiser (show/revenue management), and Customer (booking) flows independently
- **Concurrency testing**: simulated two simultaneous hold requests on the same seat to confirm only one succeeds
- **Edge cases covered**: expired holds, sold-out shows triggering waitlist, cancelled bookings triggering waitlist offers

*(Future improvement: add automated unit/integration tests with Jest and Supertest for API routes.)*

---

## 8. Deployment Architecture

| Layer | Platform | Notes |
|-------|----------|-------|
| Frontend | Vercel | Static hosting, served from `frontend/` |
| Backend API | Render | Node.js/Express server, environment variables configured in dashboard |
| Database | MongoDB Atlas | Cloud-hosted, connected via `MONGO_URI` |
| Scheduler | Runs in-process on Render backend | `node-cron` job for seat-hold release and waitlist offer expiry |

**Request flow:**
```
Browser (Vercel frontend)
    │
    ▼  HTTPS/REST
Backend API (Render)
    │
    ▼  Mongoose
MongoDB Atlas
```

Environment variables (`MONGO_URI`, `JWT_SECRET`, `EMAIL_USER`, `EMAIL_PASS`, `FRONTEND_URL`) are set directly on the hosting platform rather than committed to the repository.

---

## 9. Scalability Considerations

- **MongoDB Indexes**: Optimized queries on seat status
- **Stateless Backend**: Can be horizontally scaled
- **Scheduler**: Single instance to avoid duplicate processing
- **Caching**: Future improvement for frequently accessed data

---

## 10. Future Improvements

- Payment Gateway Integration (Stripe/Razorpay)
- WebSocket Updates for real-time seat map without refresh
- Analytics Dashboard with detailed event insights
- Mobile App (React Native version)
- Multi-language Support (Internationalization)
- Automated test suite (Jest/Supertest)

---

## 11. Conclusion

The system successfully implements all required features:

- ✅ Seat holds with TTL
- ✅ Concurrency protection
- ✅ Waitlist auto-assignment
- ✅ QR code generation
- ✅ Email notifications
- ✅ Role-based access control

The design balances performance, security, and user experience while following industry best practices for ticket booking platforms.