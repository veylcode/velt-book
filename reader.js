(() => {
  'use strict';
  const root = document.documentElement;
  const storageKey = 'velt-reader-v1';
  let state = {fontSize: 21, theme: 'paper', font: 'book', spacing: 'normal', positions: {}};
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && typeof saved === 'object') {
      state = {...state, ...saved};
      if (!saved.positions || typeof saved.positions !== 'object') state.positions = {};
    }
  } catch (_) { /* Reading remains available without browser storage. */ }

  const store = () => {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch (_) {}
  };
  const applySettings = () => {
    state.fontSize = Math.max(16, Math.min(28, Number(state.fontSize) || 21));
    if (!['paper', 'light', 'gray', 'dark'].includes(state.theme)) state.theme = 'paper';
    if (!['book', 'classic', 'modern'].includes(state.font)) state.font = 'book';
    if (!['compact', 'normal', 'airy'].includes(state.spacing)) state.spacing = 'normal';
    root.dataset.theme = state.theme;
    root.style.setProperty('--reading-size', `${state.fontSize}px`);
    root.style.setProperty('--reading-family', {
      book: 'Georgia, "Times New Roman", serif',
      classic: '"Times New Roman", Times, serif',
      modern: 'Arial, Helvetica, sans-serif'
    }[state.font]);
    root.style.setProperty('--reading-leading', {compact: '1.55', normal: '1.8', airy: '2.05'}[state.spacing]);
    document.querySelector('#font-value').textContent = state.fontSize;
    document.querySelector('#font-less').disabled = state.fontSize <= 16;
    document.querySelector('#font-more').disabled = state.fontSize >= 28;
    document.querySelectorAll('[data-set-theme]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.setTheme === state.theme));
    });
    document.querySelector('meta[name="theme-color"]').content = {
      paper: '#f5f0e6', light: '#ffffff', gray: '#e8eaeb', dark: '#141b20'
    }[state.theme];
    ['font', 'spacing'].forEach(setting => {
      document.querySelectorAll(`[data-set-${setting}]`).forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset[setting === 'font' ? 'setFont' : 'setSpacing'] === state[setting]));
      });
    });
  };
  applySettings();

  const dialogs = [document.querySelector('#contents-dialog'), document.querySelector('#settings-dialog')];
  const openDialog = dialog => {
    dialogs.forEach(other => { if (other.open) other.close(); });
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  };
  document.querySelector('#contents-toggle').addEventListener('click', () => openDialog(dialogs[0]));
  document.querySelector('#settings-toggle').addEventListener('click', () => openDialog(dialogs[1]));
  dialogs.forEach(dialog => {
    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
    });
  });
  const changeFont = amount => { state.fontSize += amount; applySettings(); store(); };
  document.querySelector('#font-less').addEventListener('click', () => changeFont(-1));
  document.querySelector('#font-more').addEventListener('click', () => changeFont(1));
  document.querySelectorAll('[data-set-theme]').forEach(button => {
    button.addEventListener('click', () => { state.theme = button.dataset.setTheme; applySettings(); store(); });
  });
  ['font', 'spacing'].forEach(setting => {
    document.querySelectorAll(`[data-set-${setting}]`).forEach(button => {
      button.addEventListener('click', () => {
        state[setting] = button.dataset[setting === 'font' ? 'setFont' : 'setSpacing'];
        applySettings();
        store();
      });
    });
  });

  const continueButton = document.querySelector('#continue-reading');
  if (continueButton && state.lastPage && /^(prologue|chapter-(?:[1-9]|10))$/.test(state.lastPage)) {
    continueButton.href = `${state.lastPage}.html`;
    continueButton.innerHTML = 'Продолжить читать <span aria-hidden="true">→</span>';
    const chapter = state.lastPage === 'prologue' ? 'Пролог' : `Глава ${state.lastPage.split('-')[1]}`;
    document.querySelector('#resume-note').textContent = `${chapter} · вернуться к сохранённому месту`;
  }

  if (document.body.dataset.reading !== 'true') return;
  const pageId = document.body.dataset.page;
  const article = document.querySelector('.prose');
  const paragraphs = Array.from(article.querySelectorAll('p'));
  const bar = document.querySelector('#progress-fill');
  let ready = false;
  let pending = false;

  const updatePosition = () => {
    const bounds = article.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (90 - bounds.top) / Math.max(1, bounds.height - innerHeight + 110)));
    bar.style.width = `${ratio * 100}%`;
    if (!ready) return;
    let paragraph = paragraphs[0];
    for (const item of paragraphs) {
      if (item.getBoundingClientRect().top > 95) break;
      paragraph = item;
    }
    state.positions[pageId] = {paragraph: paragraph.id, offset: paragraph.getBoundingClientRect().top - 90, ratio};
    state.lastPage = pageId;
    store();
  };

  const restore = () => {
    const saved = state.positions[pageId];
    if (!location.hash && saved && /^p-\d+$/.test(saved.paragraph)) {
      const target = document.getElementById(saved.paragraph);
      if (target) scrollTo(0, Math.max(0, target.getBoundingClientRect().top + scrollY - 90 - (Number(saved.offset) || 0)));
    }
    ready = true;
    updatePosition();
  };
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => requestAnimationFrame(restore));
  addEventListener('scroll', () => {
    if (pending) return;
    pending = true;
    setTimeout(() => { pending = false; updatePosition(); }, 180);
  }, {passive: true});
  addEventListener('pagehide', updatePosition);
  addEventListener('resize', () => { if (ready) updatePosition(); }, {passive: true});
})();
