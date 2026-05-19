// Tasko UX Preview — theme toggle (vanilla JS, no framework).
// Cycles through: auto (system) → light → dark → auto.
(() => {
  function getStored() {
    return localStorage.getItem('tasko-theme');
  }

  function setStored(value) {
    if (value === null || value === 'auto') {
      localStorage.removeItem('tasko-theme');
    } else {
      localStorage.setItem('tasko-theme', value);
    }
  }

  function apply(theme) {
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.setAttribute('data-theme', theme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    var label = document.getElementById('theme-toggle-label');
    if (label) {
      var current = theme || 'auto';
      label.textContent = 'Theme: ' + current.charAt(0).toUpperCase() + current.slice(1);
    }
  }

  window.toggleTheme = () => {
    var current = getStored() || 'auto';
    var next = current === 'auto' ? 'light' : current === 'light' ? 'dark' : 'auto';
    setStored(next);
    apply(next === 'auto' ? null : next);
  };

  // On boot, set the label text correctly.
  document.addEventListener('DOMContentLoaded', () => {
    var stored = getStored();
    apply(stored || null);
  });
})();
