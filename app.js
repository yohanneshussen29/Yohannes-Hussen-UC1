const STORAGE_KEY = 'lexington-lawyer-requests';
const DB_NAME = 'LexingtonDB';
const DB_VERSION = 1;

// ==========================================
// INDEXEDDB FUNCTIONS FOR PDF STORAGE
// ==========================================
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('documents')) {
        db.createObjectStore('documents', { keyPath: 'id' });
      }
    };
    
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

async function storeDocument(id, dataUrl) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['documents'], 'readwrite');
    const store = transaction.objectStore('documents');
    store.put({ id, dataUrl });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function getDocument(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['documents'], 'readonly');
    const store = transaction.objectStore('documents');
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ==========================================
// LOCALSTORAGE FUNCTIONS
// ==========================================
function loadRequests() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch (error) {
    console.warn('Unable to read stored requests', error);
    return [];
  }
}

function saveRequests(requests) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
}

// Convert uploaded files to base64 Data URLs
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Unable to read file'));
    reader.readAsDataURL(file);
  });
}

// ==========================================
// PDF VIEWER HELPER
// ==========================================
async function openPDFViewer(docId) {
  try {
    const doc = await getDocument(docId);
    if (doc && doc.dataUrl) {
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>PDF Viewer</title>
            <style>
              body { margin: 0; padding: 0; overflow: hidden; }
              iframe { width: 100%; height: 100vh; border: none; }
            </style>
          </head>
          <body>
            <iframe src="${doc.dataUrl}" width="100%" height="100%"></iframe>
          </body>
          </html>
        `);
        newWindow.document.close();
      } else {
        alert('Please allow pop-ups to view the PDF document.');
      }
    } else {
      alert('PDF document not found.');
    }
  } catch (error) {
    console.error('Error viewing PDF:', error);
    alert('Unable to load the PDF document. Error: ' + error.message);
  }
}

// ==========================================
// EXTRACT UNIQUE SPECIALTIES FROM APPROVED REQUESTS
// ==========================================
function getUniqueSpecialties(approvedLawyers) {
  const specialties = new Set();
  approvedLawyers.forEach(lawyer => {
    if (lawyer.specialty) {
      specialties.add(lawyer.specialty);
    }
  });
  return Array.from(specialties).sort();
}

// ==========================================
// RENDER SPECIALTY CHIPS
// ==========================================
function renderSpecialtyChips(approvedLawyers) {
  const chipsContainer = document.getElementById('specialtyChips');
  if (!chipsContainer) return;

  const specialties = getUniqueSpecialties(approvedLawyers);
  
  // Keep the "All Practices" button and add dynamic specialties
  chipsContainer.innerHTML = `
    <button class="specialty-chip flex-shrink-0 px-6 py-2.5 rounded-full border border-primary-container bg-primary-container text-on-primary font-label-md text-label-md transition-colors active" data-specialty="">
      All Practices
    </button>
  `;
  
  specialties.forEach(specialty => {
    const chip = document.createElement('button');
    chip.className = 'specialty-chip flex-shrink-0 px-6 py-2.5 rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low font-label-md text-label-md transition-colors';
    chip.dataset.specialty = specialty;
    chip.textContent = specialty;
    chipsContainer.appendChild(chip);
  });

  // Add click handlers for chips
  document.querySelectorAll('.specialty-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      // Update active state
      document.querySelectorAll('.specialty-chip').forEach(c => {
        c.classList.remove('bg-primary-container', 'text-on-primary', 'border-primary-container', 'active');
        c.classList.add('bg-surface-container-lowest', 'text-on-surface-variant', 'border-outline-variant');
      });
      chip.classList.add('bg-primary-container', 'text-on-primary', 'border-primary-container', 'active');
      chip.classList.remove('bg-surface-container-lowest', 'text-on-surface-variant', 'border-outline-variant');
      
      // Filter directory
      const specialty = chip.dataset.specialty;
      filterDirectoryBySpecialty(specialty);
    });
  });
}

// ==========================================
// FILTER DIRECTORY BY SPECIALTY
// ==========================================
function filterDirectoryBySpecialty(specialty) {
  const cards = document.querySelectorAll('#directory-grid .lawyer-card');
  cards.forEach(card => {
    if (!specialty || card.dataset.specialty === specialty) {
      card.style.display = '';
    } else {
      card.style.display = 'none';
    }
  });
  
  // Update count
  updateVisibleCount();
}

// ==========================================
// SEARCH FUNCTIONALITY
// ==========================================
function filterDirectoryBySearch(searchTerm) {
  const cards = document.querySelectorAll('#directory-grid .lawyer-card');
  const term = searchTerm.toLowerCase().trim();
  
  cards.forEach(card => {
    const name = card.dataset.name ? card.dataset.name.toLowerCase() : '';
    const specialty = card.dataset.specialty ? card.dataset.specialty.toLowerCase() : '';
    
    if (!term || name.includes(term) || specialty.includes(term)) {
      card.style.display = '';
    } else {
      card.style.display = 'none';
    }
  });
  
  // Update count
  updateVisibleCount();
}

// ==========================================
// UPDATE VISIBLE COUNT
// ==========================================
function updateVisibleCount() {
  const countSpan = document.getElementById('approved-count');
  if (!countSpan) return;
  
  const visibleCards = document.querySelectorAll('#directory-grid .lawyer-card[style*="display:"]');
  const allCards = document.querySelectorAll('#directory-grid .lawyer-card');
  const visibleCount = allCards.length - visibleCards.length;
  
  countSpan.textContent = visibleCount;
}

// ==========================================
// SORT FUNCTIONALITY
// ==========================================
function sortLawyers(lawyers, sortBy) {
  switch(sortBy) {
    case 'Newest':
      return [...lawyers].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    case 'Top Rated':
      // For demo purposes, sort by name as proxy for rating
      return [...lawyers].sort((a, b) => a.lawyerName.localeCompare(b.lawyerName));
    case 'Relevance':
    default:
      return lawyers;
  }
}

// ==========================================
// ADMIN DASHBOARD PORTAL LOGIC
// ==========================================
async function renderAdminDashboard() {
  const list = document.getElementById('requestsList');
  if (!list) return;

  let requests = loadRequests();
  requests = requests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const pendingCount = document.getElementById('pendingCount');
  const approvedCount = document.getElementById('approvedCount');
  const rejectedCount = document.getElementById('rejectedCount');

  if (pendingCount) pendingCount.textContent = requests.filter(r => r.status === 'pending').length;
  if (approvedCount) approvedCount.textContent = requests.filter(r => r.status === 'approved').length;
  if (rejectedCount) rejectedCount.textContent = requests.filter(r => r.status === 'rejected').length;

  if (!requests.length) {
    list.innerHTML = '<p class="status-message">No requests have been submitted yet.</p>';
    return;
  }

  list.innerHTML = requests
    .map((request) => {
      const statusClass = `status-${request.status}`;
      const isPending = request.status === 'pending';
      return `
        <article class="request-card">
          <div class="request-meta">Submitted: ${new Date(request.createdAt).toLocaleString()}</div>
          <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem;">${request.lawyerName} · ${request.firmName}</h3>
          <p><strong>Email:</strong> ${request.lawyerEmail}</p>
          <p><strong>Specialty:</strong> ${request.specialty || 'General Practice'}</p>
          <p style="margin: 0.5rem 0;">${request.requestMessage}</p>
          <ul class="doc-list">
            ${request.documents && request.documents.length > 0
              ? request.documents.map((doc) => 
                  `<li><a class="doc-link view-pdf" href="#" data-doc-id="${doc.id}">📄 Open CV (${doc.name || 'PDF'})</a></li>`
                ).join('')
              : '<li>No documents uploaded</li>'
            }
          </ul>
          <span class="status-badge ${statusClass}">${request.status.toUpperCase()}</span>
          <div class="request-actions">
            <button class="btn btn-success" data-action="approve" data-id="${request.id}" ${isPending ? '' : 'disabled'}>Approve</button>
            <button class="btn btn-danger" data-action="reject" data-id="${request.id}" ${isPending ? '' : 'disabled'}>Reject</button>
          </div>
        </article>
      `;
    })
    .join('');
}

async function updateRequestStatus(id, status) {
  const requests = loadRequests();
  const nextRequests = requests.map((request) => 
    request.id === id ? { ...request, status } : request
  );
  saveRequests(nextRequests);
  await renderAdminDashboard();
  renderLawyerDashboard();
  await renderApprovedLawyers(); // Refresh directory
}

// ==========================================
// LAWYER DASHBOARD PORTAL LOGIC
// ==========================================
function renderLawyerDashboard() {
  const list = document.getElementById('lawyerRequests');
  if (!list) return;

  const requests = loadRequests().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (!requests.length) {
    list.innerHTML = '<p class="status-message">You have not submitted any profile requests yet.</p>';
    return;
  }

  list.innerHTML = requests
    .map((request) => {
      const statusClass = `status-${request.status}`;
      return `
        <article class="request-card">
          <div class="request-meta">Submitted: ${new Date(request.createdAt).toLocaleString()}</div>
          <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem;">${request.lawyerName}</h3>
          <p><strong>Firm / Practice:</strong> ${request.firmName}</p>
          <p><strong>Specialty:</strong> ${request.specialty || 'General Practice'}</p>
          <span class="status-badge ${statusClass}">${request.status.toUpperCase()}</span>
        </article>
      `;
    })
    .join('');
}

function initLawyerForm() {
  const form = document.getElementById('lawyerRequestForm');
  const messageBox = document.getElementById('formMessage');

  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (messageBox) messageBox.textContent = '';

    const formData = new FormData(form);
    const files = formData.getAll('documents');

    const uploadedDocuments = [];
    for (const file of files) {
      if (file.size > 0) {
        try {
          const dataUrl = await fileToDataUrl(file);
          const docId = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          await storeDocument(docId, dataUrl);
          uploadedDocuments.push({ id: docId, name: file.name });
        } catch (error) {
          if (messageBox) {
            messageBox.textContent = 'Error processing PDF document. Please try again.';
            messageBox.style.color = '#ba1a1a';
          }
          return;
        }
      }
    }

    const request = {
      id: `request-${Date.now()}`,
      lawyerName: formData.get('lawyerName').toString().trim(),
      lawyerEmail: formData.get('lawyerEmail').toString().trim(),
      firmName: formData.get('firmName').toString().trim(),
      specialty: formData.get('specialty').toString().trim(),
      requestMessage: formData.get('requestMessage').toString().trim(),
      documents: uploadedDocuments,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    const requests = loadRequests();
    requests.push(request);
    saveRequests(requests);

    form.reset();
    if (messageBox) {
      messageBox.textContent = 'CV Request submitted successfully! Waiting for admin verification.';
      messageBox.style.color = '#15803d';
    }
    renderLawyerDashboard();
  });
}

// ==========================================
// PUBLIC DIRECTORY LOGIC (index.html)
// ==========================================
async function renderApprovedLawyers() {
  const grid = document.getElementById('directory-grid');
  const countSpan = document.getElementById('approved-count');
  if (!grid) return;

  const requests = loadRequests();
  const approvedLawyers = requests.filter(req => req.status === 'approved');
  
  // Get sort preference
  const sortSelect = document.getElementById('sortSelect');
  const sortBy = sortSelect ? sortSelect.value : 'Top Rated';
  const sortedLawyers = sortLawyers(approvedLawyers, sortBy);

  if (countSpan) {
    countSpan.textContent = sortedLawyers.length;
  }

  if (sortedLawyers.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-12 text-center bg-white border border-outline-variant rounded-lg">
        <p class="text-on-surface-variant font-medium">No verified lawyers are available at the moment.</p>
      </div>`;
    // Still render chips even if empty
    renderSpecialtyChips([]);
    return;
  }

  // Render specialty chips
  renderSpecialtyChips(sortedLawyers);
  
  // Clear existing content
  grid.innerHTML = '';
  
  // Build cards for each approved lawyer
  for (const lawyer of sortedLawyers) {
    const hasDocuments = lawyer.documents && lawyer.documents.length > 0;
    const docId = hasDocuments ? lawyer.documents[0].id : null;
    
    const card = document.createElement('div');
    card.className = 'lawyer-card group bg-surface-container-lowest border border-outline-variant hover:shadow-lg transition-all duration-300 flex flex-col overflow-hidden rounded-lg';
    card.dataset.name = lawyer.lawyerName;
    card.dataset.specialty = lawyer.specialty;
    
    card.innerHTML = `
      <div class="relative h-48 bg-primary-container flex items-center justify-center text-on-primary">
        <span class="material-symbols-outlined text-[64px]">gavel</span>
        <div class="absolute top-4 right-4 bg-surface/90 backdrop-blur-sm px-3 py-1 rounded-sm border border-outline-variant">
          <div class="flex items-center gap-1 text-secondary">
            <span class="material-symbols-outlined text-[16px]" style="font-variation-settings: 'FILL' 1;">verified</span>
            <span class="font-label-md text-label-md">Verified</span>
          </div>
        </div>
      </div>
      <div class="p-6 flex flex-col flex-grow">
        <div class="flex justify-between items-start mb-2">
          <span class="text-secondary font-label-md text-label-md uppercase tracking-wider">${lawyer.firmName}</span>
        </div>
        <h3 class="font-headline-md text-headline-md text-on-background mb-1">${lawyer.lawyerName}</h3>
        <p class="font-body-md text-primary font-bold mb-1">${lawyer.specialty}</p>
        <p class="font-body-md text-on-surface-variant mb-4 line-clamp-3">${lawyer.requestMessage}</p>
        <div class="mt-auto pt-4 flex flex-col gap-2 border-t border-outline-variant/30">
          <p class="text-xs text-on-surface-variant"><strong>Contact:</strong> ${lawyer.lawyerEmail}</p>
          ${hasDocuments 
            ? `<button class="view-pdf-btn inline-block text-center bg-primary text-white px-4 py-2 rounded font-label-md text-label-md" data-doc-id="${docId}">
                <span class="material-symbols-outlined text-[16px] align-middle" style="font-size: 16px;">description</span> 
                View CV (PDF)
               </button>` 
            : '<p class="text-xs text-on-surface-variant italic">No CV uploaded</p>'
          }
        </div>
      </div>
    `;
    
    // Add click event for PDF viewing
    const pdfBtn = card.querySelector('.view-pdf-btn');
    if (pdfBtn) {
      pdfBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await openPDFViewer(docId);
      });
    }
    
    grid.appendChild(card);
  }
}

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize all components
  await renderAdminDashboard();
  renderLawyerDashboard();
  initLawyerForm();
  await renderApprovedLawyers();

  // Setup search functionality
  const searchInput = document.getElementById('searchInput');
  const searchButton = document.getElementById('searchButton');
  
  if (searchInput && searchButton) {
    const performSearch = () => {
      filterDirectoryBySearch(searchInput.value);
      // Reset specialty chips
      document.querySelectorAll('.specialty-chip').forEach(c => {
        c.classList.remove('bg-primary-container', 'text-on-primary', 'border-primary-container', 'active');
        c.classList.add('bg-surface-container-lowest', 'text-on-surface-variant', 'border-outline-variant');
      });
      const allChip = document.querySelector('.specialty-chip[data-specialty=""]');
      if (allChip) {
        allChip.classList.add('bg-primary-container', 'text-on-primary', 'border-primary-container', 'active');
        allChip.classList.remove('bg-surface-container-lowest', 'text-on-surface-variant', 'border-outline-variant');
      }
    };
    
    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        performSearch();
      }
    });
  }

  // Setup sort functionality
  const sortSelect = document.getElementById('sortSelect');
  if (sortSelect) {
    sortSelect.addEventListener('change', async () => {
      await renderApprovedLawyers();
    });
  }

  // Global click delegation for PDF viewing in admin dashboard
  document.addEventListener('click', async (event) => {
    // Handle PDF viewing clicks
    const pdfLink = event.target.closest('.view-pdf');
    if (pdfLink) {
      event.preventDefault();
      const docId = pdfLink.dataset.docId;
      if (docId) {
        await openPDFViewer(docId);
      }
    }
    
    // Handle admin action buttons
    const actionButton = event.target.closest('[data-action]');
    if (actionButton) {
      const action = actionButton.getAttribute('data-action');
      const id = actionButton.getAttribute('data-id');

      if (action === 'approve') {
        await updateRequestStatus(id, 'approved');
      } else if (action === 'reject') {
        await updateRequestStatus(id, 'rejected');
      }
    }
  });
});