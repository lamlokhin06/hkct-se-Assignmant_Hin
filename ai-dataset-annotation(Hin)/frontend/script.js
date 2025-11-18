const backendUrl = 'http://localhost:3000';

// DOM Elements
const imageUpload = document.getElementById('imageUpload');
const uploadBtn = document.getElementById('uploadBtn');
const uploadStatus = document.getElementById('uploadStatus');
const imageSelect = document.getElementById('imageSelect');
const labelInput = document.getElementById('labelInput');
const addLabelBtn = document.getElementById('addLabelBtn');
const labelStatus = document.getElementById('labelStatus');
const imagesGrid = document.getElementById('imagesGrid');

// Initialize: Load images on page load
window.onload = loadImages;

// ------------------- Helper Functions -------------------
// Show status message (success/error)
function showStatus(element, message, isError = false) {
  element.textContent = message;
  element.className = `status ${isError ? 'error' : 'success'}`;
  // Clear message after 5 seconds
  setTimeout(() => element.textContent = '', 5000);
}

// Load all images and render UI
function loadImages() {
  fetch(`${backendUrl}/api/images`)
    .then(res => {
      if (!res.ok) throw new Error('Failed to fetch images');
      return res.json();
    })
    .then(images => {
      renderImageGrid(images);
      updateImageSelect(images);
    })
    .catch(err => {
      showStatus(uploadStatus, err.message, true);
      console.error('Load images error:', err);
    });
}

// Render image grid with labels and delete buttons
function renderImageGrid(images) {
  imagesGrid.innerHTML = '';
  if (images.length === 0) {
    imagesGrid.innerHTML = '<p>No images uploaded yet. Upload your first image!</p>';
    return;
  }

  images.forEach(img => {
    const card = document.createElement('div');
    card.className = 'image-card';
    
    // Split labels and label IDs (for delete)
    const labels = img.labels ? img.labels.split(', ') : [];
    const labelIds = img.labelIds ? img.labelIds.split(', ') : [];
    
    // Render labels with delete buttons
    const labelTags = labels.map((label, index) => `
      <span class="label-tag">
        ${label}
        <button class="btn-danger delete-label-btn" 
                data-image-id="${img.id}" 
                data-label-id="${labelIds[index]}">
          ×
        </button>
      </span>
    `).join('');

    card.innerHTML = `
      <img src="${backendUrl}/${img.file_path.replace('backend/', '')}" alt="${img.filename}">
      <div class="card-body">
        <div class="labels">${labelTags || 'No labels yet'}</div>
        <button class="btn-danger delete-image-btn" data-image-id="${img.id}">
          Delete Image
        </button>
      </div>
    `;
    imagesGrid.appendChild(card);
  });

  // Add event listeners to delete buttons
  attachDeleteEventListeners();
}

// Update image select dropdown
function updateImageSelect(images) {
  imageSelect.innerHTML = '<option value="">Select an uploaded image</option>';
  images.forEach(img => {
    const option = document.createElement('option');
    option.value = img.id;
    option.textContent = img.filename;
    imageSelect.appendChild(option);
  });
}

// Attach click listeners to delete buttons
function attachDeleteEventListeners() {
  // Delete image buttons
  document.querySelectorAll('.delete-image-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const imageId = e.target.dataset.imageId;
      if (confirm('Are you sure you want to delete this image? This cannot be undone.')) {
        deleteImage(imageId);
      }
    });
  });

  // Delete label buttons
  document.querySelectorAll('.delete-label-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const imageId = e.target.dataset.imageId;
      const labelId = e.target.dataset.labelId;
      deleteLabelFromImage(imageId, labelId);
    });
  });
}

// ------------------- Core Functions -------------------
// Upload image
uploadBtn.addEventListener('click', () => {
  const file = imageUpload.files[0];
  if (!file) {
    showStatus(uploadStatus, 'Please select an image to upload.', true);
    return;
  }

  const formData = new FormData();
  formData.append('image', file);

  fetch(`${backendUrl}/api/images`, {
    method: 'POST',
    body: formData
  })
    .then(res => {
      if (!res.ok) throw new Error('Failed to upload image');
      return res.json();
    })
    .then(data => {
      showStatus(uploadStatus, 'Image uploaded successfully!');
      loadImages();  // Refresh image grid
    })
    .catch(err => {
      showStatus(uploadStatus, err.message, true);
      console.error('Upload image error:', err);
    });
});