
  // Drag and drop interaction visual feedback
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');

  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());

    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.add('bg-surface-container-high');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.remove('bg-surface-container-high');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        alert('Received ' + files[0].name + ' for AI model analysis!');
      }
    });
  }
