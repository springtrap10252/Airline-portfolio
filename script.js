const header = document.querySelector('.header');
const menuToggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');
const tabs = document.querySelectorAll('.booking-tabs .tab');
const bookingForm = document.getElementById('booking-form');
const resultsSection = document.getElementById('results');
const resultsList = document.getElementById('results-list');
const resultsSummary = document.getElementById('results-summary');
const priceRange = document.getElementById('price-range');
const priceMaxLabel = document.getElementById('price-max-label');
const sortBy = document.getElementById('sort-by');
const filterCheckboxes = document.querySelectorAll('.filters-panel input[type="checkbox"]');
const modeToggle = document.getElementById('mode-toggle');
const loader = document.getElementById('loader');
const manageForm = document.getElementById('manage-form');
const manageResult = document.getElementById('manage-result');
const checkinForm = document.getElementById('checkin-form');
const boardingPass = document.getElementById('boarding-pass');
const statusForm = document.getElementById('status-form');
const statusResult = document.getElementById('status-result');
const destinationButtons = document.querySelectorAll('[data-destination]');
const contactForm = document.getElementById('contact-form');

let currentTripType = 'roundtrip';
let flights = [];
let bookings = JSON.parse(localStorage.getItem('springfallBookings')) || [];
let selectedSeat = '';

const fakeFlights = [
  {
    airline: 'Springfall',
    logo: 'SF',
    duration: '9h 20m',
    stops: 0,
    departure: '06:45',
    arrival: '16:05',
    price: 429,
    cabinClass: 'Business'
  },
  {
    airline: 'Springfall',
    logo: 'SF',
    duration: '11h 15m',
    stops: 1,
    departure: '09:20',
    arrival: '20:35',
    price: 349,
    cabinClass: 'Economy'
  },
  {
    airline: 'Springfall',
    logo: 'SF',
    duration: '8h 50m',
    stops: 0,
    departure: '13:00',
    arrival: '21:50',
    price: 489,
    cabinClass: 'Premium Economy'
  },
  {
    airline: 'Springfall',
    logo: 'SF',
    duration: '12h 10m',
    stops: 1,
    departure: '18:30',
    arrival: '06:40',
    price: 299,
    cabinClass: 'Economy'
  },
  {
    airline: 'Springfall',
    logo: 'SF',
    duration: '7h 55m',
    stops: 0,
    departure: '05:15',
    arrival: '13:10',
    price: 529,
    cabinClass: 'First Class'
  }
];

function saveBookings() {
  localStorage.setItem('springfallBookings', JSON.stringify(bookings));
}

function showLoader(active = true) {
  loader.classList.toggle('hidden', !active);
}

function updateNavActive() {
  document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => navLinks.classList.remove('active'));
  });
}

function toggleMenu() {
  navLinks.classList.toggle('active');
  menuToggle.classList.toggle('active');
  document.querySelector('.menu-overlay').classList.toggle('active');
}

function setTripType(type) {
  currentTripType = type;
  tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.trip === type));
  const returnField = document.querySelector('.return-field');
  returnField.style.display = type === 'oneway' ? 'none' : 'block';
}

function generateBookingReference() {
  return `SF${Math.floor(1000 + Math.random() * 9000)}`;
}

function renderResults() {
  const maxPrice = parseInt(priceRange.value, 10);
  priceMaxLabel.textContent = `$${maxPrice}`;
  const stopFilters = Array.from(filterCheckboxes).filter(input => input.checked && ['0', '1'].includes(input.value)).map(input => input.value);
  const timeFilters = Array.from(filterCheckboxes).filter(input => input.checked && ['morning', 'afternoon', 'evening'].includes(input.value)).map(input => input.value);

  let filtered = flights.filter(flight => flight.price <= maxPrice);
  filtered = filtered.filter(flight => stopFilters.includes(flight.stops.toString()));
  if (timeFilters.length) {
    filtered = filtered.filter(flight => timeFilters.includes(flight.timeOfDay));
  }

  if (sortBy.value === 'cheapest') {
    filtered.sort((a, b) => a.price - b.price);
  } else if (sortBy.value === 'fastest') {
    filtered.sort((a, b) => a.durationMinutes - b.durationMinutes);
  }

  resultsList.innerHTML = filtered.map((flight, index) => `
    <article class="result-card">
      <header>
        <div>
          <span class="eyebrow">${flight.airline}</span>
          <div class="route">
            <strong>${flight.from} → ${flight.to}</strong>
            <span class="meta">${flight.departureTime} · ${flight.duration} · ${flight.arrivalTime}</span>
          </div>
        </div>
        <div class="price-block">
          <span class="price">$${flight.price}</span>
          <button class="button button-primary" onclick="bookFlight(${index})">Book</button>
        </div>
      </header>
      <div class="meta">${flight.stops === 0 ? 'Direct flight' : `${flight.stops} stop`}</div>
      <div class="meta">Class: ${flight.cabinClass}</div>
    </article>
  `).join('');

  resultsSummary.textContent = `${filtered.length} flights available`;
}

function bookFlight(index) {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Please log in to complete your booking');
    window.location.href = 'auth.html';
    return;
  }

  const flight = flights[index];
  const bookingData = {
    flightId: index,
    from: flight.from,
    to: flight.to,
    departure: flight.departureDate,
    departureTime: flight.departureTime,
    price: flight.price,
    cabin: flight.cabinClass,
    duration: flight.duration,
    airline: flight.airline,
    passengers: flight.passengers || 1
  };
  
  sessionStorage.setItem('bookingData', JSON.stringify(bookingData));
  sessionStorage.setItem('passengers', String(bookingData.passengers));
  window.location.href = 'seats.html';
}

function searchFlights(event) {
  if (event) event.preventDefault();
  const from = document.getElementById('search-from').value.trim();
  const to = document.getElementById('search-to').value.trim();
  const departure = document.getElementById('search-departure').value;
  const returnDate = document.getElementById('search-return').value;
  const cabin = document.getElementById('cabin-class').value;
  const adults = parseInt(document.getElementById('passengers-adults').value, 10) || 1;
  const children = parseInt(document.getElementById('passengers-children').value, 10) || 0;
  const totalPassengers = adults + children;

  if (!from || !to || !departure || (currentTripType !== 'oneway' && !returnDate)) {
    alert('Please fill in all required fields.');
    return;
  }

  showLoader(true);
  setTimeout(() => {
    showLoader(false);
    resultsSection.classList.remove('hidden');
    flights = fakeFlights.map((flight, index) => {
      const departureTime = flight.departure;
      const departureDate = departure;
      const durationMinutes = Math.floor(Math.random() * 240) + 310;
      const hours = Math.floor(durationMinutes / 60);
      const minutes = durationMinutes % 60;
      const arrivalTime = new Date(`${departure}T${departureTime}:00`);
      arrivalTime.setMinutes(arrivalTime.getMinutes() + durationMinutes);
      const formattedArrival = arrivalTime.toTimeString().slice(0,5);
      const timeOfDay = index % 3 === 0 ? 'morning' : index % 3 === 1 ? 'afternoon' : 'evening';

      return {
        ...flight,
        from,
        to,
        departureDate,
        departureTime,
        arrivalTime: formattedArrival,
        duration: `${hours}h ${minutes}m`,
        durationMinutes,
        timeOfDay,
        cabinClass: cabin,
        passengers: totalPassengers
      };
    });

    renderResults();
    window.scrollTo({ top: resultsSection.offsetTop - 80, behavior: 'smooth' });
  }, 700);
}

function lookupBooking(event) {
  event.preventDefault();
  const reference = document.getElementById('manage-reference').value.trim().toUpperCase();
  const booking = bookings.find(item => item.reference === reference);

  if (!booking) {
    manageResult.classList.remove('hidden');
    manageResult.innerHTML = `<h4>Booking not found</h4><p>Please check your reference and last name.</p>`;
    return;
  }

  manageResult.classList.remove('hidden');
  manageResult.innerHTML = `
    <h4>Itinerary</h4>
    <p><strong>${booking.from} → ${booking.to}</strong></p>
    <p>${booking.departureDate} · ${booking.departureTime}</p>
    <p>Cabin: ${booking.cabinClass}</p>
    <div class="meta">Reference: ${booking.reference}</div>
    <div class="meta">Status: ${booking.status}</div>
    <div class="booking-actions">
      <button class="button button-outline">Request change</button>
      <button class="button button-outline">Add baggage</button>
      <button class="button button-outline">Select seat</button>
    </div>
  `;
}

function renderBoardingPass(booking, passengerName) {
  boardingPass.classList.remove('hidden');
  boardingPass.innerHTML = `
    <h4>Your boarding pass</h4>
    <div class="boarding-row">
      <div>
        <span class="eyebrow">Passenger</span>
        <strong>${passengerName}</strong>
      </div>
      <div>
        <span class="eyebrow">Flight</span>
        <strong>${booking.reference}</strong>
      </div>
    </div>
    <div class="boarding-row">
      <div>
        <span class="eyebrow">Route</span>
        <strong>${booking.from} → ${booking.to}</strong>
      </div>
      <div>
        <span class="eyebrow">Boarding</span>
        <strong>${booking.departureTime}</strong>
      </div>
    </div>
    <div class="boarding-row">
      <div>
        <span class="eyebrow">Seat</span>
        <strong>${selectedSeat || '17A'}</strong>
      </div>
      <div>
        <span class="eyebrow">Gate</span>
        <strong>C12</strong>
      </div>
    </div>
    <div class="qr-code">SPRINGFALL</div>
  `;
}

function handleCheckin(event) {
  event.preventDefault();
  const reference = document.getElementById('checkin-reference').value.trim().toUpperCase();
  const passengerName = document.getElementById('checkin-name').value.trim();
  const booking = bookings.find(item => item.reference === reference);

  if (!booking) {
    boardingPass.classList.remove('hidden');
    boardingPass.innerHTML = `<h4>Booking not found</h4><p>Please verify your reference and passenger name.</p>`;
    return;
  }

  renderBoardingPass(booking, passengerName || booking.passenger);
}

function trackStatus(event) {
  event.preventDefault();
  const flightNumber = document.getElementById('status-flight').value.trim().toUpperCase();
  const date = document.getElementById('status-date').value;

  if (!flightNumber || !date) {
    alert('Please enter a flight number and date.');
    return;
  }

  const statuses = ['On time', 'Delayed', 'Gate open', 'Boarding', 'Departed'];
  const status = statuses[Math.floor(Math.random() * statuses.length)];

  statusResult.classList.remove('hidden');
  statusResult.innerHTML = `
    <h4>Flight ${flightNumber}</h4>
    <p>Date: ${date}</p>
    <p>Status: <strong>${status}</strong></p>
    <div class="status-steps">
      <p>Departure gate: B14</p>
      <p>Estimated arrival: ${(Math.floor(Math.random() * 3) + 10)}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}</p>
      <p>Aircraft: Airbus A350</p>
    </div>
  `;
}

function handleDestinationClick(event) {
  const destination = event.target.dataset.destination;
  if (!destination) return;
  document.getElementById('search-to').value = destination;
  document.getElementById('search-departure').value = new Date().toISOString().slice(0, 10);
  document.getElementById('search-return').value = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  window.location.hash = '#results';
  searchFlights();
}

function toggleTheme() {
  document.body.classList.toggle('dark-mode');
  const mode = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
  localStorage.setItem('springfallTheme', mode);
  const icon = modeToggle.querySelector('i');
  icon.classList.toggle('fa-sun', mode === 'dark');
  icon.classList.toggle('fa-moon', mode === 'light');
}

function loadTheme() {
  const mode = localStorage.getItem('springfallTheme') || 'light';
  if (mode === 'dark') {
    document.body.classList.add('dark-mode');
    const icon = modeToggle.querySelector('i');
    icon.classList.remove('fa-moon');
    icon.classList.add('fa-sun');
  }
}

window.addEventListener('scroll', () => {
  header.classList.toggle('scrolled', window.scrollY > 20);
});

menuToggle.addEventListener('click', toggleMenu);
updateNavActive();

tabs.forEach(tab => {
  tab.addEventListener('click', () => setTripType(tab.dataset.trip));
});

bookingForm.addEventListener('submit', searchFlights);
priceRange.addEventListener('input', renderResults);
sortBy.addEventListener('change', renderResults);
filterCheckboxes.forEach(input => input.addEventListener('change', renderResults));
manageForm.addEventListener('submit', lookupBooking);
checkinForm.addEventListener('submit', handleCheckin);
statusForm.addEventListener('submit', trackStatus);
destinationButtons.forEach(button => button.addEventListener('click', handleDestinationClick));
contactForm.addEventListener('submit', e => { e.preventDefault(); alert('Message sent successfully!'); contactForm.reset(); });
modeToggle.addEventListener('click', toggleTheme);
loadTheme();

setTripType('roundtrip');

window.bookFlight = bookFlight;

// Authentication and user profile management
function initAuthUI() {
  const token = localStorage.getItem('token');
  const authSection = document.getElementById('auth-section');
  const userProfile = document.getElementById('user-profile');
  const userName = document.getElementById('user-name');

  if (token) {
    const user = localStorage.getItem('user');
    if (user) {
      const userData = JSON.parse(user);
      userName.textContent = userData.fullName || 'User';
    }
    authSection.style.display = 'none';
    userProfile.style.display = 'flex';
    
    // Show welcome message if user just logged in
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('login') === 'success') {
      showWelcomeMessage();
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  } else {
    authSection.style.display = 'flex';
    userProfile.style.display = 'none';
  }
}

function showWelcomeMessage() {
  const user = localStorage.getItem('user');
  if (user) {
    const userData = JSON.parse(user);
    const message = document.createElement('div');
    message.className = 'welcome-message';
    message.innerHTML = `
      <div class="welcome-content">
        <i class="fas fa-check-circle"></i>
        <span>Welcome back, ${userData.fullName}! You're now logged in.</span>
      </div>
    `;
    document.body.appendChild(message);
    
    setTimeout(() => {
      message.classList.add('fade-out');
      setTimeout(() => message.remove(), 500);
    }, 3000);
  }
}

function toggleUserMenu() {
  const userMenu = document.querySelector('.user-menu');
  userMenu.classList.toggle('active');
  document.addEventListener('click', closeUserMenuOnClick);
}

function closeUserMenuOnClick(event) {
  const userProfile = document.querySelector('.user-profile');
  const userMenu = document.querySelector('.user-menu');
  if (userProfile && !userProfile.contains(event.target)) {
    userMenu.classList.remove('active');
    document.removeEventListener('click', closeUserMenuOnClick);
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  sessionStorage.clear();
  window.location.href = 'auth.html';
}

function showMyBookings() {
  // Hide search results and show bookings
  resultsSection.classList.remove('hidden');
  scrollToSection('results');
  
  // Clear existing results
  resultsList.innerHTML = '';
  resultsSummary.textContent = '';
  
  if (bookings.length === 0) {
    resultsList.innerHTML = `
      <div class="no-bookings">
        <i class="fas fa-ticket-alt"></i>
        <h3>No bookings found</h3>
        <p>You haven't made any bookings yet. Start by searching for flights!</p>
        <button class="button button-primary" onclick="scrollToSection('hero')">Search Flights</button>
      </div>
    `;
    return;
  }
  
  // Display bookings
  resultsSummary.textContent = `You have ${bookings.length} booking${bookings.length > 1 ? 's' : ''}`;
  
  bookings.forEach((booking, index) => {
    const bookingCard = document.createElement('div');
    bookingCard.className = 'result-card booking-card';
    bookingCard.innerHTML = `
      <header>
        <div class="airline">
          <span class="logo">${booking.airline || 'SF'}</span>
          <div>
            <strong>${booking.airline || 'Springfall Airlines'}</strong>
            <span class="flight-number">Booking #${booking.reference}</span>
          </div>
        </div>
        <div class="price-block">
          <div class="price">$${booking.price || 'TBD'}</div>
          <div class="cabin">${booking.cabin || 'Economy'}</div>
        </div>
      </header>
      <div class="route">
        <span class="from">${booking.from || 'TBD'}</span>
        <i class="fas fa-plane"></i>
        <span class="to">${booking.to || 'TBD'}</span>
      </div>
      <div class="meta">
        <span>${booking.departure || 'TBD'} • ${booking.departureTime || 'TBD'}</span>
        <span>${booking.duration || 'TBD'} • Direct</span>
        <span>${booking.passengers || 1} passenger${(booking.passengers || 1) > 1 ? 's' : ''}</span>
      </div>
      <div class="booking-actions">
        <button class="button button-outline" onclick="manageBooking('${booking.reference}')">Manage</button>
        <button class="button button-danger" onclick="cancelBooking(${index})">Cancel</button>
      </div>
    `;
    resultsList.appendChild(bookingCard);
  });
}

function manageBooking(reference) {
  // Scroll to manage booking section
  scrollToSection('manage');
  document.getElementById('manage-reference').value = reference;
}

function cancelBooking(index) {
  if (confirm('Are you sure you want to cancel this booking?')) {
    bookings.splice(index, 1);
    saveBookings();
    showMyBookings();
    alert('Booking cancelled successfully');
  }
}

function scrollToSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (section) {
    section.scrollIntoView({ behavior: 'smooth' });
  }
}

// Initialize auth UI on page load
initAuthUI();

