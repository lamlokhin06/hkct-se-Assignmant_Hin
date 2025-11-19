const backendUrl: string = 'http://localhost:3000';

// DOM Elements
const imageUpload = document.getElementById('imageUpload') as HTMLInputElement;
const uploadBtn = document.getElementById('uploadBtn') as HTMLButtonElement;
const uploadStatus = document.getElementById('uploadStatus') as HTMLDivElement;
const imageSelect = document.getElementById('imageSelect') as HTMLSelectElement;
const labelInput = document.getElementById('labelInput') as HTMLInputElement;
const addLabelBtn = document.getElementById('addLabelBtn') as HTMLButtonElement;
const labelStatus = document.getElementById('labelStatus') as HTMLDivElement;
const imagesGrid = document.getElementById('imagesGrid') as HTMLDivElement;

// Interfaces
interface Image {
  id: string;
  filename: string;
  file_path: string;
  labels?: string;
  labelIds?: string;
}

interface Label {
  id: string;
  name: string;
  image_id: string;
}

// Initialize: Load images on page load
window.onload = loadImages;

// ------------------- Helper Functions -------------------
// Show status message (success/error)
function showStatus(element: HTMLElement, message: string, isError: boolean = false): void {
  element.textContent = message;
  element.className = `status ${isError ? 'error' : 'success'}`;
  // Clear message after 5 seconds
  setTimeout(() => element.textContent = '', 5000);
}

// Load all images and render UI
function loadImages(): void {
  fetch(`${backendUrl}/api/images`)
    .then(res => {
      if (!res.ok) throw new Error('Failed to fetch images');
      return res.json();
    })
    .then((images: Image[]) => {
      renderImageGrid(images);
      updateImageSelect(images);
    })
    .catch(err => {
      showStatus(uploadStatus, err.message, true);
      console.error('Load images error:', err);
    });
}

// Render image grid with labels and delete buttons
function renderImageGrid(images: Image[]): void {
  imagesGrid.innerHTML = '';
  if (images.length === 0) {
    imagesGrid.innerHTML = '<p>No images uploaded yet. Upload your first image!</p>';
    return;
  }

  images.forEach(img => {
    const card = document.createElement('div');
    card.className = 'image-card';
    
    // Split labels and label IDs (for delete)
    const labels: string[] = img.labels ? img.labels.split(', ') : [];
    const labelIds: string[] = img.labelIds ? img.labelIds.split(', ') : [];
    
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
function updateImageSelect(images: Image[]): void {
  imageSelect.innerHTML = '<option value="">Select an uploaded image</option>';
  images.forEach(img => {
    const option = document.createElement('option');
    option.value = img.id;
    option.textContent = img.filename;
    imageSelect.appendChild(option);
  });
}

// Attach click listeners to delete buttons
function attachDeleteEventListeners(): void {
  // Delete image buttons
  document.querySelectorAll('.delete-image-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.target as HTMLButtonElement;
      const imageId = target.dataset.imageId;
      if (imageId && confirm('Are you sure you want to delete this image? This cannot be undone.')) {
        deleteImage(imageId);
      }
    });
  });

  // Delete label buttons
  document.querySelectorAll('.delete-label-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.target as HTMLButtonElement;
      const imageId = target.dataset.imageId;
      const labelId = target.dataset.labelId;
      if (imageId && labelId) {
        deleteLabelFromImage(imageId, labelId);
      }
    });
  });
}

// ------------------- Core Functions -------------------
// Upload image
uploadBtn.addEventListener('click', () => {
  const file = imageUpload.files?.[0];
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
    .then((data: Image) => {
      showStatus(uploadStatus, 'Image uploaded successfully!');
      loadImages();  // Refresh image grid
    })
    .catch(err => {
      showStatus(uploadStatus, err.message, true);
      console.error('Upload image error:', err);
    });
});

// Add label to image
addLabelBtn.addEventListener('click', () => {
  const selectedImageId = imageSelect.value;
  const labelText = labelInput.value.trim();

  if (!selectedImageId) {
    showStatus(labelStatus, 'Please select an image first.', true);
    return;
  }

  if (!labelText) {
    showStatus(labelStatus, 'Please enter a label.', true);
    return;
  }

  fetch(`${backendUrl}/api/images/${selectedImageId}/labels`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ label: labelText })
  })
    .then(res => {
      if (!res.ok) throw new Error('Failed to add label');
      return res.json();
    })
    .then((data: Label) => {
      showStatus(labelStatus, 'Label added successfully!');
      labelInput.value = ''; // Clear input
      loadImages(); // Refresh image grid
    })
    .catch(err => {
      showStatus(labelStatus, err.message, true);
      console.error('Add label error:', err);
    });
});

// Delete an image
function deleteImage(imageId: string): void {
  fetch(`${backendUrl}/api/images/${imageId}`, {
    method: 'DELETE'
  })
    .then(res => {
      if (!res.ok) throw new Error('Failed to delete image');
      return res.json();
    })
    .then(data => {
      showStatus(uploadStatus, 'Image deleted successfully!');
      loadImages(); // Refresh the grid
    })
    .catch(err => {
      showStatus(uploadStatus, err.message, true);
      console.error('Delete image error:', err);
    });
}

// Delete a label from an image
function deleteLabelFromImage(imageId: string, labelId: string): void {
  fetch(`${backendUrl}/api/images/${imageId}/labels/${labelId}`, {
    method: 'DELETE'
  })
    .then(res => {
      if (!res.ok) throw new Error('Failed to delete label');
      return res.json();
    })
    .then(data => {
      showStatus(labelStatus, 'Label deleted successfully!');
      loadImages(); // Refresh the grid
    })
    .catch(err => {
      showStatus(labelStatus, err.message, true);
      console.error('Delete label error:', err);
    });
}