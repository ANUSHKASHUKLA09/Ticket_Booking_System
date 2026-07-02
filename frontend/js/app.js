// ===== STATE =====
let currentUser = null;
let currentShow = null;
let selectedSeats = [];
let heldSeats = [];
let holdTimer = null;
let holdExpiry = null;
let currentSection = 'home';
let selectedPaymentMethod = 'card';
let pendingBookingData = null;

const API_URL = 'http://localhost:5000/api';

// ===== TOAST SYSTEM =====
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// ===== HELPERS =====
function getAuthHeader() {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// ===== INR FORMATTER =====
function formatINR(amount) {
    return '₹' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ===== NAVIGATION =====
function showSection(section) {
    currentSection = section;
    
    document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    
    if (section === 'home') {
        document.getElementById('homeSection').style.display = 'block';
        document.querySelector('.nav-link[onclick*="home"]')?.classList.add('active');
        if (currentUser) loadShows();
    } else if (section === 'bookings') {
        if (currentUser) {
            document.getElementById('bookingsSection').style.display = 'block';
            document.querySelector('.nav-link[onclick*="bookings"]')?.classList.add('active');
            loadBookings();
        } else {
            showToast('Please login to view your bookings', 'info');
            openAuthModal();
        }
    } else if (section === 'admin') {
        if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'organiser')) {
            document.getElementById('adminSection').style.display = 'block';
            document.querySelector('.nav-link[onclick*="admin"]')?.classList.add('active');
            loadVenues();
            loadShows();
            loadRevenue();
        } else {
            showToast('Access denied. Admin/Organiser only.', 'error');
        }
    }
}

// ===== AUTH =====
function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    if (tab === 'login') {
        document.querySelector('.auth-tab:first-child').classList.add('active');
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('registerForm').style.display = 'none';
    } else {
        document.querySelector('.auth-tab:last-child').classList.add('active');
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'block';
    }
}

function openAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.remove('hidden');
    switchAuthTab('login');
}

function closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.add('hidden');
}

// ===== REGISTER =====
async function doRegister() {
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const role = document.getElementById('regRole').value;

    if (!name || !email || !password) {
        showToast('⚠️ Please fill all fields', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password, role })
        });
        
        const data = await res.json();
        console.log('Register response:', data);
        
        if (res.ok) {
            localStorage.setItem('token', data.token);
            currentUser = data.user;
            showToast(`✅ Welcome ${data.user.name}!`, 'success');
            closeAuthModal();
            updateUI();
        } else {
            const errorMsg = data.message || 'Registration failed. Please try again.';
            showToast(`❌ ${errorMsg}`, 'error');
            console.error('Register error:', errorMsg);
        }
    } catch (error) {
        console.error('Register error:', error);
        showToast(`❌ Network error: ${error.message}`, 'error');
    }
}

// ===== LOGIN =====
async function doLogin() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        showToast('⚠️ Please enter email and password', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await res.json();
        console.log('Login response:', data);
        
        if (res.ok) {
            localStorage.setItem('token', data.token);
            currentUser = data.user;
            showToast(`✅ Welcome back ${data.user.name}!`, 'success');
            closeAuthModal();
            updateUI();
        } else {
            const errorMsg = data.message || 'Login failed. Please try again.';
            showToast(`❌ ${errorMsg}`, 'error');
            console.error('Login error:', errorMsg);
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast(`❌ Network error: ${error.message}`, 'error');
    }
}

function doLogout() {
    localStorage.removeItem('token');
    currentUser = null;
    currentShow = null;
    selectedSeats = [];
    heldSeats = [];
    clearInterval(holdTimer);
    showToast('👋 Logged out', 'info');
    updateUI();
}

// ===== UPDATE UI =====
function updateUI() {
    const navAuth = document.getElementById('navAuth');
    const adminLink = document.getElementById('adminLink');
    const eventsNav = document.querySelector('.nav-link[onclick*="home"]');
    const bookingsNav = document.querySelector('.nav-link[onclick*="bookings"]');
    const eventsSection = document.getElementById('homeSection');
    const bookingsSection = document.getElementById('bookingsSection');
    const adminSection = document.getElementById('adminSection');

    if (currentUser) {
        navAuth.innerHTML = `
            <div class="user-info">
                <div class="avatar">${currentUser.name[0].toUpperCase()}</div>
                <span>${currentUser.name}</span>
                <span style="color:var(--text-muted);font-size:0.8rem;">(${currentUser.role})</span>
            </div>
            <button class="btn-secondary" onclick="doLogout()" style="padding:6px 16px;font-size:0.8rem;">Logout</button>
        `;
        
        if (currentUser.role === 'admin' || currentUser.role === 'organiser') {
            adminLink.style.display = 'inline-block';
        } else {
            adminLink.style.display = 'none';
        }

        if (currentUser.role === 'admin' || currentUser.role === 'organiser') {
            if (eventsSection) eventsSection.style.display = 'none';
            if (bookingsSection) bookingsSection.style.display = 'none';
            if (adminSection) adminSection.style.display = 'block';
            if (eventsNav) eventsNav.style.display = 'none';
            if (bookingsNav) bookingsNav.style.display = 'none';
            loadVenues();
            loadShows();
            loadRevenue();
            document.querySelector('.nav-link[onclick*="admin"]')?.classList.add('active');
        } else {
            if (eventsSection) eventsSection.style.display = 'block';
            if (bookingsSection) bookingsSection.style.display = 'block';
            if (adminSection) adminSection.style.display = 'none';
            if (eventsNav) eventsNav.style.display = 'inline-block';
            if (bookingsNav) bookingsNav.style.display = 'inline-block';
            loadShows();
            document.querySelector('.nav-link[onclick*="home"]')?.classList.add('active');
        }
        
    } else {
        navAuth.innerHTML = `<button class="btn-primary" onclick="openAuthModal()">Sign In</button>`;
        adminLink.style.display = 'none';
        if (eventsSection) eventsSection.style.display = 'block';
        if (bookingsSection) bookingsSection.style.display = 'none';
        if (adminSection) adminSection.style.display = 'none';
        if (eventsNav) eventsNav.style.display = 'inline-block';
        if (bookingsNav) bookingsNav.style.display = 'inline-block';
        loadShows();
        document.querySelector('.nav-link[onclick*="home"]')?.classList.add('active');
    }
}

// ===== SHOWS =====
async function loadShows() {
    try {
        const res = await fetch(`${API_URL}/shows`, {
            headers: getAuthHeader()
        });
        const shows = await res.json();
        const list = document.getElementById('showsList');
        const countEl = document.getElementById('eventCount');
        
        if (countEl) countEl.textContent = `${shows.length} events`;
        
        if (!shows || !shows.length) {
            if (list) {
                list.innerHTML = `
                    <div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted);">
                        <p style="font-size:1.2rem;">🎭 No shows available</p>
                        <p style="font-size:0.9rem;">Organisers can create shows in the Admin panel</p>
                    </div>
                `;
            }
            return;
        }

        if (list) {
            list.innerHTML = shows.map(show => {
                const available = show.seats ? show.seats.filter(s => s.status === 'available').length : 0;
                return `
                <div class="event-card" onclick="${currentUser ? `selectShow('${show._id}')` : `openAuthModal()`}">
                    <span class="event-type ${show.type}">${show.type}</span>
                    <h3>${show.title}</h3>
                    <div class="event-meta">🏛️ ${show.venueId?.name || 'Venue'}</div>
                    <div class="event-meta">📅 ${new Date(show.date).toLocaleDateString()} at ${show.time}</div>
                    <div class="event-availability">
                        <span>🎫 ${available} seats available</span>
                        <span class="available">${available > 0 ? (currentUser ? 'Book Now →' : 'Login to Book →') : 'Sold Out'}</span>
                    </div>
                </div>
            `}).join('');
        }
    } catch (error) {
        showToast(`❌ Error loading shows: ${error.message}`, 'error');
    }
}

// ===== SELECT SHOW =====
async function selectShow(showId) {
    try {
        const res = await fetch(`${API_URL}/shows/${showId}`, {
            headers: getAuthHeader()
        });
        currentShow = await res.json();
        const seatSection = document.getElementById('seatSection');
        if (seatSection) {
            seatSection.style.display = 'block';
            document.getElementById('seatSectionTitle').textContent = `💺 ${currentShow.title}`;
        }
        selectedSeats = [];
        heldSeats = [];
        clearInterval(holdTimer);
        document.getElementById('holdTimer').textContent = '';
        renderSeats();
        document.getElementById('seatSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
        showToast(`❌ Error loading show: ${error.message}`, 'error');
    }
}

function closeSeats() {
    const seatSection = document.getElementById('seatSection');
    if (seatSection) seatSection.style.display = 'none';
    currentShow = null;
    selectedSeats = [];
    heldSeats = [];
    clearInterval(holdTimer);
}

// ===== SEATS =====
function renderSeats() {
    if (!currentShow) return;
    
    const grid = document.getElementById('seatGrid');
    if (!grid) return;
    
    const seats = currentShow.seats;
    
    if (!seats || !seats.length) {
        grid.innerHTML = '<p style="color:var(--text-muted);">No seats available</p>';
        return;
    }
    
    const rows = {};
    seats.forEach(seat => {
        if (!rows[seat.row]) rows[seat.row] = [];
        rows[seat.row].push(seat);
    });

    const maxSeats = Math.max(...Object.values(rows).map(r => r.length));
    grid.style.gridTemplateColumns = `repeat(${maxSeats}, 44px)`;

    let html = '';
    for (let row in rows) {
        const rowSeats = rows[row].sort((a, b) => a.number - b.number);
        html += rowSeats.map(seat => {
            const seatId = `${seat.row}-${seat.number}`;
            let statusClass = seat.status;
            
            const isHeldByMe = seat.status === 'held' && seat.heldBy === currentUser?._id;
            const isSelected = selectedSeats.includes(seatId);
            
            if (isSelected) {
                statusClass = 'selected';
            } else if (isHeldByMe) {
                statusClass = 'held';
            }
            
            const isDisabled = seat.status === 'booked' || 
                              (seat.status === 'held' && !isHeldByMe);
            
            return `<div class="seat ${statusClass}" 
                         onclick="${isDisabled ? '' : `toggleSeat('${seatId}')`}"
                         title="Row ${seat.row}, Seat ${seat.number} (${seat.category})">
                    ${seat.number}
                   </div>`;
        }).join('');
    }

    grid.innerHTML = html;
    
    const countEl = document.getElementById('selectedCount');
    if (countEl) countEl.textContent = `${selectedSeats.length} seats selected`;
    
    updateHoldTimer();
}

// ===== TOGGLE SEAT =====
function toggleSeat(seatId) {
    if (!currentShow) {
        showToast('⚠️ No show selected', 'error');
        return;
    }
    
    const [row, number] = seatId.split('-').map(Number);
    const seat = currentShow.seats.find(s => s.row === row && s.number === number);
    
    if (!seat) {
        showToast('⚠️ Seat not found', 'error');
        return;
    }
    
    if (seat.status === 'booked') {
        showToast('⚠️ This seat is already booked', 'error');
        return;
    }
    
    if (seat.status === 'held' && seat.heldBy !== currentUser?._id) {
        showToast('⚠️ This seat is held by someone else', 'error');
        return;
    }
    
    const idx = selectedSeats.indexOf(seatId);
    if (idx > -1) {
        selectedSeats.splice(idx, 1);
    } else {
        selectedSeats.push(seatId);
    }
    
    renderSeats();
}

// ===== HOLD & BOOK =====
async function holdSelected() {
    if (!currentShow) {
        showToast('⚠️ No show selected', 'error');
        return;
    }
    
    if (!selectedSeats.length) {
        showToast('⚠️ Select at least one seat first', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/bookings/hold`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            },
            body: JSON.stringify({
                showId: currentShow._id,
                seatIds: selectedSeats
            })
        });

        const data = await res.json();
        if (res.ok) {
            heldSeats = [...selectedSeats];
            holdExpiry = new Date(data.expiresAt);
            showToast(`✅ Held ${heldSeats.length} seats for 10 minutes`, 'success');
            await refreshShow();
            selectedSeats = [];
            renderSeats();
            startHoldTimer();
        } else {
            showToast(`❌ ${data.message}`, 'error');
            if (data.errors) {
                data.errors.forEach(err => showToast(`   - ${err}`, 'error'));
            }
        }
    } catch (error) {
        showToast(`❌ ${error.message}`, 'error');
    }
}

async function releaseHeld() {
    if (!currentShow) {
        showToast('⚠️ No show selected', 'error');
        return;
    }
    
    if (!heldSeats.length) {
        showToast('⚠️ No held seats to release', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/bookings/release`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            },
            body: JSON.stringify({ showId: currentShow._id })
        });

        const data = await res.json();
        if (res.ok) {
            heldSeats = [];
            clearInterval(holdTimer);
            showToast(`✅ ${data.message}`, 'success');
            await refreshShow();
            renderSeats();
        } else {
            showToast(`❌ ${data.message}`, 'error');
        }
    } catch (error) {
        showToast(`❌ ${error.message}`, 'error');
    }
}

// ===== PAYMENT SYSTEM =====
function openPaymentModal() {
    if (!currentShow || !heldSeats.length) {
        showToast('⚠️ Hold seats first before booking', 'error');
        return;
    }

    let total = 0;
    let seatDetails = [];
    for (const seatId of heldSeats) {
        const [row, number] = seatId.split('-').map(Number);
        const seat = currentShow.seats.find(s => s.row === row && s.number === number);
        if (seat) {
            const price = seat.category === 'Premium' ? currentShow.basePrice * 1.5 : currentShow.basePrice;
            total += price;
            seatDetails.push(`${seat.category} (Row ${row}, Seat ${number})`);
        }
    }

    document.getElementById('paymentSummary').innerHTML = `
        <div class="summary-row">
            <span>🎬 ${currentShow.title}</span>
            <span>${new Date(currentShow.date).toLocaleDateString()} at ${currentShow.time}</span>
        </div>
        <div class="summary-row">
            <span>Seats (${heldSeats.length})</span>
            <span>${seatDetails.join(', ')}</span>
        </div>
        <div class="summary-row total">
            <span>Total Amount</span>
            <span class="amount">${formatINR(total)}</span>
        </div>
    `;

    pendingBookingData = {
        showId: currentShow._id,
        seatIds: heldSeats,
        total: total
    };

    document.getElementById('cardNumber').value = '';
    document.getElementById('cardExpiry').value = '';
    document.getElementById('cardCvv').value = '';
    document.getElementById('cardName').value = '';
    document.getElementById('upiId').value = '';
    
    selectPayment('card');
    document.getElementById('paymentModal').classList.remove('hidden');
}

function closePaymentModal() {
    document.getElementById('paymentModal').classList.add('hidden');
    pendingBookingData = null;
}

function selectPayment(method) {
    selectedPaymentMethod = method;
    
    document.querySelectorAll('.payment-option').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.payment-option[onclick="selectPayment('${method}')"]`)?.classList.add('active');
    
    document.getElementById('cardSection').style.display = method === 'card' ? 'block' : 'none';
    document.getElementById('upiSection').style.display = method === 'upi' ? 'block' : 'none';
    document.getElementById('walletSection').style.display = method === 'wallet' ? 'block' : 'none';
}

function formatCardNumber(input) {
    let value = input.value.replace(/\D/g, '');
    value = value.replace(/(\d{4})/g, '$1 ').trim();
    input.value = value;
}

function formatExpiry(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length >= 2) {
        value = value.substring(0, 2) + '/' + value.substring(2);
    }
    input.value = value;
}

// ===== PROCESS PAYMENT =====
async function processPayment() {
    if (!pendingBookingData) {
        showToast('❌ No booking data found', 'error');
        return;
    }

    if (selectedPaymentMethod === 'card') {
        const cardNumber = document.getElementById('cardNumber').value.replace(/\s/g, '');
        const expiry = document.getElementById('cardExpiry').value;
        const cvv = document.getElementById('cardCvv').value;
        const cardName = document.getElementById('cardName').value;

        if (cardNumber.length < 16) {
            showToast('⚠️ Please enter valid card number', 'error');
            return;
        }
        if (expiry.length < 5) {
            showToast('⚠️ Please enter valid expiry date', 'error');
            return;
        }
        if (cvv.length < 3) {
            showToast('⚠️ Please enter valid CVV', 'error');
            return;
        }
        if (!cardName) {
            showToast('⚠️ Please enter cardholder name', 'error');
            return;
        }
    } else if (selectedPaymentMethod === 'upi') {
        const upiId = document.getElementById('upiId').value;
        if (!upiId || !upiId.includes('@')) {
            showToast('⚠️ Please enter valid UPI ID (example@upi)', 'error');
            return;
        }
    }

    showToast('⏳ Processing payment...', 'info');
    const payBtn = document.querySelector('.payment-form .btn-success');
    payBtn.textContent = '⏳ Processing...';
    payBtn.disabled = true;

    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
        console.log('📝 Sending booking request:', pendingBookingData);
        
        const res = await fetch(`${API_URL}/bookings/confirm`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            },
            body: JSON.stringify({
                showId: pendingBookingData.showId,
                seatIds: pendingBookingData.seatIds
            })
        });

        const data = await res.json();
        console.log('📝 Booking response:', data);
        
        if (res.ok) {
            closePaymentModal();
            showToast(`🎉 Booking confirmed! Reference: ${data.booking.reference}`, 'success');
            
            // Show QR Code Popup
            showQRPopup(data.booking.reference);
            
            heldSeats = [];
            clearInterval(holdTimer);
            await refreshShow();
            renderSeats();
            loadBookings();
        } else {
            const errorMsg = data.message || 'Payment failed. Please try again.';
            showToast(`❌ ${errorMsg}`, 'error');
            
            if (errorMsg.includes('not held by you') || errorMsg.includes('hold seats again')) {
                showToast('🔄 Seats expired. Please hold seats again', 'info');
                heldSeats = [];
                clearInterval(holdTimer);
                await refreshShow();
                renderSeats();
            }
        }
    } catch (error) {
        console.error('❌ Payment error:', error);
        showToast(`❌ Payment error: ${error.message}`, 'error');
    }

    payBtn.textContent = '💰 Pay Now';
    payBtn.disabled = false;
}

// ===== QR CODE FUNCTIONS =====
function showQRPopup(reference) {
    const modal = document.getElementById('qrModal');
    const refEl = document.getElementById('qrReference');
    const imgEl = document.getElementById('qrImage');
    
    if (refEl) refEl.textContent = reference;
    if (imgEl) imgEl.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${reference}`;
    
    if (modal) modal.classList.remove('hidden');
}

function closeQRModal() {
    const modal = document.getElementById('qrModal');
    if (modal) modal.classList.add('hidden');
}

// ===== WAITLIST =====
async function joinWaitlist() {
    if (!currentShow) {
        showToast('⚠️ Select a show first', 'error');
        return;
    }

    const category = document.getElementById('waitlistCategory')?.value || 'Standard';

    try {
        const res = await fetch(`${API_URL}/waitlist/join`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            },
            body: JSON.stringify({
                showId: currentShow._id,
                category
            })
        });

        const data = await res.json();
        if (res.ok) {
            showToast(`📋 Joined waitlist (position ${data.position})`, 'success');
        } else {
            showToast(`❌ ${data.message}`, 'error');
        }
    } catch (error) {
        showToast(`❌ ${error.message}`, 'error');
    }
}

// ===== BOOKINGS =====
async function loadBookings() {
    try {
        const res = await fetch(`${API_URL}/bookings/my-bookings`, {
            headers: getAuthHeader()
        });
        const bookings = await res.json();
        const list = document.getElementById('bookingsList');
        const countEl = document.getElementById('bookingCount');
        
        if (countEl) countEl.textContent = `${bookings.length} bookings`;

        if (!bookings || !bookings.length) {
            if (list) {
                list.innerHTML = `
                    <div style="text-align:center;padding:40px;color:var(--text-muted);">
                        <p style="font-size:1.2rem;">🎫 No bookings yet</p>
                        <p style="font-size:0.9rem;">Browse events and book your first ticket!</p>
                    </div>
                `;
            }
            return;
        }

        if (list) {
            list.innerHTML = bookings.map(b => `
                <div class="booking-card" style="flex-direction:column;align-items:stretch;">
                    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
                        <div class="booking-info">
                            <div class="booking-title">${b.showId?.title || 'Event'}</div>
                            <div class="booking-meta">Seats: ${b.seatIds?.join(', ') || 'N/A'} · ${formatINR(b.totalAmount)}</div>
                            <div class="booking-meta">📅 ${new Date(b.bookedAt).toLocaleDateString()}</div>
                            <div class="booking-meta">🔑 Reference: ${b.reference || 'N/A'}</div>
                        </div>
                        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                            <span class="booking-status ${b.status}">${b.status?.toUpperCase() || 'UNKNOWN'}</span>
                            ${b.status === 'confirmed' ? 
                                `<button class="btn-secondary" onclick="cancelBooking('${b._id}')" style="padding:4px 14px;font-size:0.8rem;">Cancel</button>` : 
                                ''
                            }
                        </div>
                    </div>
                    ${b.status === 'confirmed' ? `
                        <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);display:flex;align-items:center;gap:20px;flex-wrap:wrap;">
                            <div style="text-align:center;">
                                <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:4px;">🎫 SCAN TO VERIFY</div>
                                <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${b.reference}" 
                                     alt="QR Code" 
                                     style="width:120px;height:120px;border-radius:8px;border:2px solid var(--border);background:white;padding:8px;" />
                                <div style="font-size:0.6rem;color:var(--text-muted);margin-top:4px;">${b.reference}</div>
                            </div>
                            <div style="font-size:0.8rem;color:var(--text-muted);">
                                <div>📧 QR also sent to your email</div>
                                <div style="margin-top:4px;font-size:0.7rem;">Show this QR at the venue entrance</div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            `).join('');
        }
    } catch (error) {
        showToast(`❌ Error loading bookings: ${error.message}`, 'error');
    }
}

async function cancelBooking(bookingId) {
    if (!confirm('Cancel this booking?')) return;

    try {
        const res = await fetch(`${API_URL}/bookings/${bookingId}/cancel`, {
            method: 'PUT',
            headers: getAuthHeader()
        });

        const data = await res.json();
        if (res.ok) {
            showToast(`✅ ${data.message}`, 'success');
            loadBookings();
            if (currentShow) {
                await refreshShow();
                renderSeats();
            }
        } else {
            showToast(`❌ ${data.message}`, 'error');
        }
    } catch (error) {
        showToast(`❌ ${error.message}`, 'error');
    }
}

// ===== ADMIN =====
async function createVenue() {
    const name = document.getElementById('venueName')?.value;
    const address = document.getElementById('venueAddress')?.value;
    const totalRows = parseInt(document.getElementById('venueRows')?.value);
    const seatsPerRow = parseInt(document.getElementById('venueSeatsPerRow')?.value);

    if (!name || !address || !totalRows || !seatsPerRow) {
        showToast('⚠️ Please fill all venue fields', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/venues`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            },
            body: JSON.stringify({ name, address, totalRows, seatsPerRow })
        });

        const data = await res.json();
        if (res.ok) {
            showToast(`✅ Venue created: ${data.name}`, 'success');
            document.getElementById('venueName').value = '';
            document.getElementById('venueAddress').value = '';
            loadVenues();
            loadShows();
        } else {
            showToast(`❌ ${data.message}`, 'error');
        }
    } catch (error) {
        showToast(`❌ ${error.message}`, 'error');
    }
}

async function loadVenues() {
    try {
        const res = await fetch(`${API_URL}/venues`, {
            headers: getAuthHeader()
        });
        const venues = await res.json();
        const select = document.getElementById('showVenue');
        
        if (select) {
            select.innerHTML = venues.map(v => 
                `<option value="${v._id}">${v.name}</option>`
            ).join('');
        }

        const list = document.getElementById('venueList');
        if (list) {
            list.innerHTML = venues.map(v => 
                `<div class="admin-list-item"><strong>${v.name}</strong> - ${v.address} (${v.totalRows}×${v.seatsPerRow})</div>`
            ).join('');
        }
    } catch (error) {
        console.error('Error loading venues:', error);
    }
}

async function createShow() {
    const venueId = document.getElementById('showVenue')?.value;
    const title = document.getElementById('showTitle')?.value;
    const type = document.getElementById('showType')?.value;
    const date = document.getElementById('showDate')?.value;
    const time = document.getElementById('showTime')?.value;
    const basePrice = parseFloat(document.getElementById('showPrice')?.value);

    if (!venueId || !title || !date || !time || !basePrice) {
        showToast('⚠️ Please fill all show fields', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/shows`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            },
            body: JSON.stringify({ venueId, title, description: '', type, date, time, basePrice })
        });

        const data = await res.json();
        if (res.ok) {
            showToast(`✅ Show created: ${data.title}`, 'success');
            document.getElementById('showTitle').value = '';
            document.getElementById('showDate').value = '';
            document.getElementById('showTime').value = '';
            loadShows();
        } else {
            showToast(`❌ ${data.message}`, 'error');
        }
    } catch (error) {
        showToast(`❌ ${error.message}`, 'error');
    }
}

// ===== REVENUE =====
async function loadRevenue() {
    try {
        const res = await fetch(`${API_URL}/bookings/revenue`, {
            headers: getAuthHeader()
        });
        const data = await res.json();
        
        document.getElementById('totalRevenue').textContent = formatINR(data.totalRevenue);
        document.getElementById('totalBookings').textContent = data.totalBookings;
        
        const container = document.getElementById('revenueByEvent');
        if (data.byEvent && data.byEvent.length > 0) {
            container.innerHTML = data.byEvent.map(e =>
                `<div class="admin-list-item" style="display:flex;justify-content:space-between;align-items:center;">
                    <strong>${e.title}</strong>
                    <span>${formatINR(e.revenue)} (${e.count} bookings)</span>
                </div>`
            ).join('');
        } else {
            container.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-muted);">No bookings yet</div>`;
        }
    } catch (error) {
        showToast(`❌ Error loading revenue: ${error.message}`, 'error');
    }
}

// ===== HELPERS =====
async function refreshShow() {
    if (!currentShow) return;
    try {
        const res = await fetch(`${API_URL}/shows/${currentShow._id}`, {
            headers: getAuthHeader()
        });
        currentShow = await res.json();
    } catch (error) {
        console.error('Error refreshing show:', error);
    }
}

function startHoldTimer() {
    clearInterval(holdTimer);
    holdTimer = setInterval(() => {
        if (!holdExpiry) return;
        const now = new Date();
        const diff = Math.floor((holdExpiry - now) / 1000);
        if (diff <= 0) {
            clearInterval(holdTimer);
            const timerEl = document.getElementById('holdTimer');
            if (timerEl) timerEl.textContent = '⏰ Expired';
            heldSeats = [];
            refreshShow();
            renderSeats();
        } else {
            const mins = Math.floor(diff / 60);
            const secs = diff % 60;
            const timerEl = document.getElementById('holdTimer');
            if (timerEl) timerEl.textContent = `⏱️ ${mins}:${String(secs).padStart(2, '0')}`;
        }
    }, 1000);
}

function updateHoldTimer() {
    if (heldSeats.length && holdExpiry) {
        startHoldTimer();
    } else {
        clearInterval(holdTimer);
        const timerEl = document.getElementById('holdTimer');
        if (timerEl) timerEl.textContent = '';
    }
}

// ===== AUTO-LOGIN CHECK =====
function checkAuth() {
    const token = localStorage.getItem('token');
    if (token) {
        fetch(`${API_URL}/auth/me`, {
            headers: getAuthHeader()
        })
        .then(res => res.json())
        .then(user => {
            if (user && user._id) {
                currentUser = user;
                updateUI();
            }
        })
        .catch(() => {
            localStorage.removeItem('token');
        });
    } else {
        updateUI();
    }
}

// ===== MAKE FUNCTIONS GLOBAL =====
window.doRegister = doRegister;
window.doLogin = doLogin;
window.doLogout = doLogout;
window.createVenue = createVenue;
window.createShow = createShow;
window.selectShow = selectShow;
window.closeSeats = closeSeats;
window.toggleSeat = toggleSeat;
window.holdSelected = holdSelected;
window.releaseHeld = releaseHeld;
window.openPaymentModal = openPaymentModal;
window.closePaymentModal = closePaymentModal;
window.selectPayment = selectPayment;
window.processPayment = processPayment;
window.formatCardNumber = formatCardNumber;
window.formatExpiry = formatExpiry;
window.joinWaitlist = joinWaitlist;
window.cancelBooking = cancelBooking;
window.showSection = showSection;
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.switchAuthTab = switchAuthTab;
window.loadRevenue = loadRevenue;
window.showQRPopup = showQRPopup;
window.closeQRModal = closeQRModal;

// ===== INIT =====
console.log('🎬 ShowTime - Premium Ticket Booking');
console.log('📖 API URL:', API_URL);
checkAuth();

// Auto-refresh shows every 30 seconds
setInterval(() => {
    if (currentUser) loadShows();
}, 30000);