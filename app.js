const AUTH_KEY = 'guest-portal-authenticated';
const STORAGE_KEY = 'guest-portal-guests';
const AUTH_PASSWORD = 'pumpa pumpa';
const STATUS_OPTIONS = ['Пришел', 'Не пришёл'];

let guests = [];
let editingGuestId = null;

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'id-' + Math.random().toString(16).slice(2) + Date.now().toString(16);
}

const loginSection = document.getElementById('auth');
const appSection = document.getElementById('app');
const loginForm = document.getElementById('login-form');
const passwordInput = document.getElementById('password');
const togglePasswordButton = document.getElementById('toggle-password');
const logoutButton = document.getElementById('logout');
const addGuestButton = document.getElementById('add-guest');
const emptyAddButton = document.getElementById('empty-add');
const guestTable = document.getElementById('guest-table');
const emptyState = document.getElementById('empty-state');
const modal = document.getElementById('guest-modal');
const modalTitle = document.getElementById('modal-title');
const modalClose = document.querySelector('.modal-close');
const cancelModalButton = document.getElementById('cancel-modal');
const guestForm = document.getElementById('guest-form');
const guestIdInput = document.getElementById('guest-id');
const fullNameInput = document.getElementById('fullName');
const emailInput = document.getElementById('email');
const phoneInput = document.getElementById('phone');
const noteInput = document.getElementById('note');
const statusSelect = document.getElementById('status');
const importButton = document.getElementById('import-button');
const exportButton = document.getElementById('export-button');
const importInput = document.getElementById('import-input');
const toastElement = document.getElementById('toast');

function toggleView(isAuthenticated) {
  if (isAuthenticated) {
    loginSection.classList.remove('active');
    appSection.classList.add('active');
    loginSection.setAttribute('aria-hidden', 'true');
    appSection.removeAttribute('aria-hidden');
  } else {
    appSection.classList.remove('active');
    loginSection.classList.add('active');
    loginSection.removeAttribute('aria-hidden');
    appSection.setAttribute('aria-hidden', 'true');
  }
}

function showToast(message, type = 'success') {
  toastElement.textContent = message;
  toastElement.className = `toast visible ${type}`;
  clearTimeout(showToast.timeoutId);
  showToast.timeoutId = setTimeout(() => {
    toastElement.classList.remove('visible');
  }, 2600);
}

function loadGuests() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(data)) {
      guests = data;
    }
  } catch (error) {
    console.error('Ошибка загрузки гостей', error);
    guests = [];
  }
}

function persistGuests() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(guests));
}

function buildStatusBadge(status) {
  const normalized = status === STATUS_OPTIONS[0] ? 'arrived' : 'pending';
  return `<span class="badge ${normalized}">${status}</span>`;
}

function renderGuests() {
  if (!guests.length) {
    guestTable.innerHTML = '';
    emptyState.classList.add('visible');
    return;
  }

  emptyState.classList.remove('visible');
  guestTable.innerHTML = guests
    .map((guest) => {
      const { id, fullName, email, phone, note, status } = guest;
      return `
        <tr data-id="${id}">
          <td>${escapeHtml(fullName)}</td>
          <td><a href="mailto:${escapeHtml(email)}" class="link">${escapeHtml(email)}</a></td>
          <td><a href="tel:${escapeHtml(phone)}" class="link">${escapeHtml(phone)}</a></td>
          <td>${note ? escapeHtml(note) : '<span class="muted">—</span>'}</td>
          <td>${buildStatusBadge(status)}</td>
          <td>
            <div class="table-actions">
              <button type="button" class="edit" data-action="edit">Изменить</button>
              <button type="button" class="delete" data-action="delete">Удалить</button>
            </div>
          </td>
        </tr>`;
    })
    .join('');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function resetForm() {
  guestForm.reset();
  guestIdInput.value = '';
  editingGuestId = null;
}

function openModal(mode = 'create', guest = null) {
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  if (mode === 'edit' && guest) {
    modalTitle.textContent = 'Редактирование гостя';
    guestIdInput.value = guest.id;
    fullNameInput.value = guest.fullName;
    emailInput.value = guest.email;
    phoneInput.value = guest.phone;
    noteInput.value = guest.note || '';
    statusSelect.value = guest.status;
    editingGuestId = guest.id;
  } else {
    modalTitle.textContent = 'Добавление гостя';
    resetForm();
  }
  fullNameInput.focus();
}

function closeModal() {
  modal.classList.add('hidden');
  document.body.style.overflow = '';
  resetForm();
}

function upsertGuest(data) {
  if (editingGuestId) {
    guests = guests.map((guest) => (guest.id === editingGuestId ? { ...guest, ...data } : guest));
    showToast('Данные гостя обновлены');
  } else {
    guests.unshift({ id: generateId(), ...data });
    showToast('Гость добавлен');
  }
  persistGuests();
  renderGuests();
  closeModal();
}

function deleteGuest(id) {
  const guest = guests.find((item) => item.id === id);
  if (!guest) return;

  const confirmed = window.confirm(`Вы действительно хотите удалить гостя «${guest.fullName}»?`);
  if (!confirmed) return;

  guests = guests.filter((item) => item.id !== id);
  persistGuests();
  renderGuests();
  showToast('Гость удален', 'success');
}

function handleGuestAction(event) {
  const actionButton = event.target.closest('button[data-action]');
  if (!actionButton) return;

  const row = actionButton.closest('tr[data-id]');
  if (!row) return;

  const guest = guests.find((item) => item.id === row.dataset.id);
  if (!guest) return;

  const action = actionButton.dataset.action;
  if (action === 'edit') {
    openModal('edit', guest);
  } else if (action === 'delete') {
    deleteGuest(guest.id);
  }
}

function handleImport(event) {
  const [file] = event.target.files;
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const workbook = XLSX.read(e.target.result, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (!rows.length) {
        showToast('В файле нет данных', 'error');
        return;
      }

      const imported = rows
        .map((row) => {
          const fullName = String(row['ФИО'] || '').trim();
          const email = String(row['Email'] || '').trim();
          const phone = String(row['Телефон'] || '').trim();
          const note = String(row['Заметка'] || '').trim();
          const statusRaw = String(row['Статус'] || '').trim();
          const status = STATUS_OPTIONS.includes(statusRaw) ? statusRaw : STATUS_OPTIONS[0];
          if (!fullName || !email || !phone) {
            return null;
          }
          return {
            id: generateId(),
            fullName,
            email,
            phone,
            note,
            status,
          };
        })
        .filter(Boolean);

      if (!imported.length) {
        showToast('Не удалось импортировать данные', 'error');
        return;
      }

      guests = [...imported, ...guests];
      persistGuests();
      renderGuests();
      showToast(`Импортировано гостей: ${imported.length}`);
    } catch (error) {
      console.error('Ошибка импорта', error);
      showToast('Ошибка при чтении файла', 'error');
    } finally {
      importInput.value = '';
    }
  };
  reader.readAsArrayBuffer(file);
}

function handleExport() {
  if (!guests.length) {
    showToast('Нет данных для выгрузки', 'error');
    return;
  }

  const worksheetData = guests.map((guest) => ({
    ФИО: guest.fullName,
    Email: guest.email,
    Телефон: guest.phone,
    Заметка: guest.note,
    Статус: guest.status,
  }));

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Гости');
  const fileName = `гости_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, fileName);
  showToast('Файл Excel сформирован');
}

function initialize() {
  const authenticated = localStorage.getItem(AUTH_KEY) === 'true';
  toggleView(authenticated);
  if (authenticated) {
    loadGuests();
    renderGuests();
  }
}

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const password = passwordInput.value.trim();
  if (password === AUTH_PASSWORD) {
    localStorage.setItem(AUTH_KEY, 'true');
    toggleView(true);
    loadGuests();
    renderGuests();
    showToast('Добро пожаловать!');
  } else {
    showToast('Неверный пароль', 'error');
  }
  loginForm.reset();
});

logoutButton.addEventListener('click', () => {
  localStorage.removeItem(AUTH_KEY);
  toggleView(false);
  guests = [];
  guestTable.innerHTML = '';
  emptyState.classList.remove('visible');
  showToast('Вы вышли из системы');
});

addGuestButton.addEventListener('click', () => openModal('create'));
emptyAddButton.addEventListener('click', () => openModal('create'));
modalClose.addEventListener('click', closeModal);
cancelModalButton.addEventListener('click', closeModal);

modal.addEventListener('click', (event) => {
  if (event.target === modal) {
    closeModal();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
    closeModal();
  }
});

guestForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = {
    fullName: fullNameInput.value.trim(),
    email: emailInput.value.trim(),
    phone: phoneInput.value.trim(),
    note: noteInput.value.trim(),
    status: statusSelect.value,
  };
  upsertGuest(data);
});

guestTable.addEventListener('click', handleGuestAction);

importButton.addEventListener('click', () => importInput.click());
importInput.addEventListener('change', handleImport);
exportButton.addEventListener('click', handleExport);

togglePasswordButton.addEventListener('click', () => {
  const currentType = passwordInput.getAttribute('type');
  const showPassword = currentType === 'password';
  passwordInput.setAttribute('type', showPassword ? 'text' : 'password');
  togglePasswordButton.classList.toggle('revealed', showPassword);
  togglePasswordButton.setAttribute('aria-label', showPassword ? 'Скрыть пароль' : 'Показать пароль');
});

window.addEventListener('load', initialize);
