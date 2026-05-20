const workGallery = document.getElementById('workGallery');

if (workGallery) {
  const customWorkItems = readWorkItems();

  customWorkItems.forEach((item) => {
    const card = document.createElement('article');
    card.className = getWorkCardClass(item.size);
    card.innerHTML = `
      <img src="${item.src}" alt="${escapeHtml(item.alt)}" />
      <div>
        <span>${escapeHtml(item.category)}</span>
        <h2>${escapeHtml(item.title)}</h2>
      </div>
    `;
    workGallery.prepend(card);
  });
}

function readWorkItems() {
  try {
    return JSON.parse(localStorage.getItem('beautyLightWorkItems')) || [];
  } catch {
    return [];
  }
}

function getWorkCardClass(size) {
  if (size === 'large') return 'work-card work-card-large';
  if (size === 'wide') return 'work-card work-card-wide';
  return 'work-card';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
