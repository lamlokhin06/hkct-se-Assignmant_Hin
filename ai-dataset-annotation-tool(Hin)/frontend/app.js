document.getElementById('upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const imageInput = document.getElementById('image-upload');
    const labelInput = document.getElementById('label-input');

    const formData = new FormData();
    formData.append('image', imageInput.files[0]);
    formData.append('label', labelInput.value);

    const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
    });

    if (response.ok) {
        loadImages();
        imageInput.value = '';
        labelInput.value = '';
    } else {
        console.error('Upload failed');
    }
});

async function loadImages() {
    const response = await fetch('/api/images');
    const images = await response.json();
    
    const gallery = document.getElementById('image-gallery');
    gallery.innerHTML = '';

    images.forEach(img => {
        const container = document.createElement('div');
        container.className = 'image-container';
        container.innerHTML = `
            <img src="${img.path}" alt="Image" width="200" /><br/>
            <span>${img.label}</span>
        `;
        gallery.appendChild(container);
    });
}

loadImages();