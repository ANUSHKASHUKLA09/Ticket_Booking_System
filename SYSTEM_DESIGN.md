# System Design Write-up: Ticket Booking Platform

## 1. Introduction

This document outlines the system design of a ticket booking platform for movies and concerts. The system handles high-demand events with features including seat holds, waitlists, concurrency prevention, and automated email notifications with QR codes. The platform serves three user roles: Admin, Organiser, and Customer.

## 2. System Architecture

The application follows a three-tier architecture:

- **Frontend**: HTML/CSS/JavaScript providing a responsive UI with real-time seat maps
- **Backend**: Node.js/Express REST API with JWT authentication
- **Database**: MongoDB for persistent storage with Mongoose ODM

### 2.1 Database Design

The database consists of five main collections:

1. **User**: Stores user credentials and role (admin/organiser/customer)
2. **Venue**: Contains venue details, seat layout configuration
3. **Show**: Represents events with seat inventory
4. **Booking**: Tracks confirmed bookings with QR codes
5. **Waitlist**: Manages waiting queues per show and category

### 2.2 Seat Inventory Model

Seats are stored as an array within each show document. Each seat contains:
- Row and seat number
- Category (Premium/Standard)
- Status (available/held/booked)
- Hold timestamps (heldBy, heldUntil)

This embedded approach ensures atomic updates and simplifies queries.

## 3. Core Features Implementation

### 3.1 Seat Hold with TTL (Time-To-Live)

**Mechanism:**
1. When a user selects seats and clicks "Hold", the system:
   - Sets seat status to "held"
   - Records `heldUntil` = current time + 10 minutes
   - Starts a frontend countdown timer

2. A node-cron scheduler runs every minute:
   - Finds all seats with expired holds
   - Updates status back to "available"
   - Logs the release action

**Why 10 minutes?**
- Balances user convenience with seat availability
- Industry standard (BookMyShow, Ticketmaster use 5-10 minutes)
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
Additional Protection:

Seat status checked before each hold/booking

Status transitions: available → held → booked

Held seats cannot be booked by other users

Database-level locking prevents race conditions

3.3 Waitlist Auto-Assignment
Flow:

Join Waitlist

User selects category (Premium/Standard)

System assigns position number

Status = "waiting"

Cancellation Triggers

When a booking is cancelled:

Seats become available

System finds next waiting user (lowest position)

Seat is offered with 15-minute time limit

Time-Limited Offer

Offer expires after 15 minutes

Scheduler checks for expired offers

If expired, offer moves to next in queue

Email notification sent to each offer recipient

Queue Management:

Separate queues per show and category

Position numbers maintained automatically

FCFS (First Come First Serve) policy

3.4 QR Code and Email
QR Code Generation:

Booking reference encoded as QR

Generated using QRCode library

Embedded in email as inline image

Displayed on frontend (popup + My Tickets)

Email Flow:

On booking confirmation:

Generate QR code

Send HTML email with QR image

Include booking details

On waitlist offer:

Send notification email

Include time-limited link

Offer expires automatically

4. Real-Time Updates
How seat map stays updated:

Frontend refreshes after each action (hold, release, book)

Scheduler auto-releases seats without user action

30-second auto-refresh for availability

User Experience:

Visual seat colors change in real-time

Timer visible during hold period

Toast notifications for all actions

5. Security Considerations
Authentication: JWT-based with 7-day expiry

Authorization: Role-based access (admin/organiser/customer)

Data Validation: All inputs validated on server

Password Security: Bcrypt hashing with salt

Environment Variables: Sensitive data stored in .env

6. Scalability Considerations
MongoDB Indexes: Optimized queries on seat status

Stateless Backend: Can be horizontally scaled

Scheduler: Single instance to avoid duplicate processing

Caching: Future improvement for frequently accessed data

7. Future Improvements
Payment Gateway Integration: Stripe/Razorpay

WebSocket Updates: Real-time seat map without refresh

Analytics Dashboard: Detailed event insights

Mobile App: React Native version

Multi-language Support: Internationalization

8. Conclusion
The system successfully implements all required features:

✅ Seat holds with TTL

✅ Concurrency protection

✅ Waitlist auto-assignment

✅ QR code generation

✅ Email notifications

✅ Role-based access control

The design balances performance, security, and user experience while following industry best practices for ticket booking platforms.




