const STORAGE_KEY = 'lexington-lawyer-requests';

// Helper functions for LocalStorage management
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

// Convert uploaded files to base64 Data URLs so they can be kept in localStorage
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Unable to read file'));
    reader.readAsDataURL(file);
  });
}

/* ==========================================
   ADMIN DASHBOARD PORTAL LOGIC
   ========================================== */
async function renderAdminDashboard() {
  let requests = loadRequests();
  requests = requests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const list = document.getElementById('requestsList');
  const pendingCount = document.getElementById('pendingCount');
  const approvedCount = document.getElementById('approvedCount');
  const rejectedCount = document.getElementById('rejectedCount');

  if (!list) return;

  if (pendingCount) requests.filter(r => r.status === 'pending').length;
  if (approvedCount) requests.filter(r => r.status === 'approved').length;
  if (rejectedCount) requests.filter(r => r.status === 'rejected').length;

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
          <div class="request-meta">${new Date(request.createdAt).toLocaleString()}</div>
          <h3>${request.lawyerName} · ${request.firmName}</h3>
          <p><strong>Email:</strong> ${request.lawyerEmail}</p>
          <p><strong>Specialty:</strong> ${request.specialty || 'General Practice'}</p>
          <p>${request.requestMessage}</p>
          <ul class="doc-list">
            ${request.documents
              .map((doc) => `<li><a class="doc-link" href="${doc.dataUrl}" target="_blank" rel="noreferrer">📄 Open CV (PDF)</a></li>`)
              .join('')}
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
  const nextRequests = requests.map((request) => (request.id === id ? { ...request, status } : request));
  saveRequests(nextRequests);
  renderAdminDashboard();
  renderLawyerDashboard();
}

/* ==========================================
   LAWYER DASHBOARD PORTAL LOGIC
   ========================================== */
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
          <div class="request-meta">${new Date(request.createdAt).toLocaleString()}</div>
          <h3>${request.lawyerName}</h3>
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
          uploadedDocuments.push({ name: file.name, dataUrl });
        } catch (error) {
          if (messageBox) {
            messageBox.textContent = 'Error processing PDF document.';
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

/* ==========================================
   PUBLIC DIRECTORY FILTER LOGIC (index.html)
   ========================================== */
function renderApprovedLawyers() {
  const grid = document.getElementById('directory-grid');
  const countSpan = document.getElementById('approved-count');
  if (!grid) return;

  const requests = loadRequests();
  // Filter condition: ONLY APPROVED AND VERIFIED LAWYERS SHOW HERE
  const approvedLawyers = requests.filter(req => req.status === 'approved');

  if (countSpan) {
    countSpan.textContent = approvedLawyers.length;
  }

  if (approvedLawyers.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-12 text-center bg-white border border-outline-variant rounded-lg">
        <p class="text-on-surface-variant font-medium">No verified lawyers are available at the moment.</p>
      </div>`;
    return;
  }

  grid.innerHTML = approvedLawyers.map(lawyer => `
    <div class="group bg-surface-container-lowest border border-outline-variant hover:shadow-lg transition-all duration-300 flex flex-col overflow-hidden" data-name="${lawyer.lawyerName}" data-specialty="${lawyer.specialty}">
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
                ${lawyer.documents && lawyer.documents[0] ? `<a href="${lawyer.documents[0].dataUrl}" target="_blank" class="inline-block text-center bg-primary text-white px-4 py-2 rounded font-label-md text-label-md active:scale-95 transition-all">View CV (PDF)</a>` : ''}
            </div>
        </div>
    </div>
  `).join('');
}

// Global initialization logic on content load
document.addEventListener('DOMContentLoaded', () => {
  renderAdminDashboard();
  renderLawyerDashboard();
  initLawyerForm();
  renderApprovedLawyers();

  // Delegation listener for click verification actions inside the admin dashboard
  document.addEventListener('click', (event) => {
    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) return;

    const action = actionButton.getAttribute('data-action');
    const id = actionButton.getAttribute('data-id');

    if (action === 'approve') {
      updateRequestStatus(id, 'approved');
    } else if (action === 'reject') {
      updateRequestStatus(id, 'rejected');
    }
  });
});