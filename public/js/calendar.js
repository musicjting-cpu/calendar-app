const MIN_YEAR = 2026, MIN_MONTH = 7;
const MAX_YEAR = 2027, MAX_MONTH = 1;

let curYear = 2026, curMonth = 7;
let eventsData = {};
let currentModalDate = null;

const monthNames = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
const dayNames = ['日','一','二','三','四','五','六'];

function rocYear(y) { return y - 1911; }

async function checkSession() {
  try {
    const res = await fetch('/api/session');
    const data = await res.json();
    if (!data.user) { window.location.href = '/login.html'; return false; }
    document.getElementById('headerUser').textContent = `👤 ${data.user}`;
    return true;
  } catch { window.location.href = '/login.html'; return false; }
}

async function fetchEvents() {
  try {
    const res = await fetch(`/api/events?month=${curMonth+1}&year=${curYear}`);
    if (!res.ok) throw new Error();
    eventsData = await res.json();
  } catch { eventsData = {}; }
}

function renderCalendar() {
  const firstDay = new Date(curYear, curMonth, 1).getDay();
  const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
  const grid = document.getElementById('calendarGrid');
  grid.innerHTML = '';

  for (const d of dayNames) {
    const h = document.createElement('div');
    h.className = 'day-header';
    h.textContent = d;
    grid.appendChild(h);
  }

  for (let i = 0; i < firstDay; i++) {
    const e = document.createElement('div');
    e.className = 'day-cell empty';
    grid.appendChild(e);
  }

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${curYear}-${String(curMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const cell = document.createElement('div');
    cell.className = 'day-cell';
    cell.dataset.date = dateStr;

    const dow = new Date(curYear, curMonth, day).getDay();
    if (dow === 0 || dow === 6) cell.classList.add('weekend');
    if (dateStr === todayStr) cell.classList.add('today');

    const num = document.createElement('div');
    num.className = 'day-number';
    num.textContent = day;
    cell.appendChild(num);

    const evts = eventsData[dateStr] || [];
    if (evts.length) {
      const list = document.createElement('div');
      list.className = 'event-list';
      for (const evt of evts) {
        const el = document.createElement('div');
        el.className = 'event-item';
        el.textContent = evt.text;
        el.title = evt.text;
        list.appendChild(el);
      }
      cell.appendChild(list);
    }

    cell.addEventListener('click', () => openModal(dateStr));
    grid.appendChild(cell);
  }

  document.getElementById('monthTitle').textContent = `${rocYear(curYear)}年${monthNames[curMonth]}`;
  document.getElementById('prevBtn').disabled = (curYear === MIN_YEAR && curMonth === MIN_MONTH);
  document.getElementById('nextBtn').disabled = (curYear === MAX_YEAR && curMonth === MAX_MONTH);
}

async function openModal(dateStr) {
  currentModalDate = dateStr;
  const dateObj = new Date(dateStr + 'T00:00:00');
  const weekdays = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
  document.getElementById('modalDate').textContent =
    `${dateStr} ${weekdays[dateObj.getDay()]}`;
  document.getElementById('eventModal').style.display = 'flex';
  document.getElementById('newEventInput').value = '';
  renderModalEvents();
}

function closeModal() {
  document.getElementById('eventModal').style.display = 'none';
  currentModalDate = null;
}

function renderModalEvents() {
  const container = document.getElementById('eventList');
  const evts = eventsData[currentModalDate] || [];
  if (!evts.length) {
    container.innerHTML = '<div class="no-events">尚無事項，請新增</div>';
    return;
  }
  container.innerHTML = '';
  for (const evt of evts) {
    const item = document.createElement('div');
    item.className = 'event-modal-item';
    item.dataset.id = evt.id;

    const textSpan = document.createElement('span');
    textSpan.className = 'event-modal-text';
    textSpan.textContent = evt.text;

    const actions = document.createElement('div');
    actions.className = 'event-modal-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-edit';
    editBtn.innerHTML = '✎';
    editBtn.title = '修改';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const newText = prompt('修改事項內容：', evt.text);
      if (newText && newText.trim()) editEvent(evt.id, newText.trim());
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-danger';
    delBtn.innerHTML = '✕';
    delBtn.title = '刪除';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`確定刪除「${evt.text}」？`)) deleteEvent(evt.id);
    });

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    item.appendChild(textSpan);
    item.appendChild(actions);
    container.appendChild(item);
  }
}

async function addEvent() {
  const input = document.getElementById('newEventInput');
  const text = input.value.trim();
  if (!text) return alert('請輸入事項內容');
  try {
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: currentModalDate, text })
    });
    if (!res.ok) { const d = await res.json(); alert(d.error || '新增失敗'); return; }
    const evt = await res.json();
    if (!eventsData[currentModalDate]) eventsData[currentModalDate] = [];
    eventsData[currentModalDate].push(evt);
    renderModalEvents();
    renderCalendar();
    input.value = '';
  } catch { alert('無法連線到伺服器'); }
}

async function editEvent(id, text) {
  try {
    const res = await fetch(`/api/events/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (!res.ok) { const d = await res.json(); alert(d.error || '修改失敗'); return; }
    const updated = await res.json();
    for (const date in eventsData) {
      const idx = eventsData[date].findIndex(e => e.id === id);
      if (idx !== -1) { eventsData[date][idx].text = updated.text; break; }
    }
    renderModalEvents();
    renderCalendar();
  } catch { alert('無法連線到伺服器'); }
}

async function deleteEvent(id) {
  try {
    const res = await fetch(`/api/events/${id}`, { method: 'DELETE' });
    if (!res.ok) { const d = await res.json(); alert(d.error || '刪除失敗'); return; }
    for (const date in eventsData) {
      eventsData[date] = eventsData[date].filter(e => e.id !== id);
      if (!eventsData[date].length) delete eventsData[date];
    }
    renderModalEvents();
    renderCalendar();
  } catch { alert('無法連線到伺服器'); }
}

function prevMonth() {
  curMonth--;
  if (curMonth < 0) { curMonth = 11; curYear--; }
  if (curYear < MIN_YEAR || (curYear === MIN_YEAR && curMonth < MIN_MONTH)) {
    curMonth = MIN_MONTH; curYear = MIN_YEAR;
  }
  refreshView();
}

function nextMonth() {
  curMonth++;
  if (curMonth > 11) { curMonth = 0; curYear++; }
  if (curYear > MAX_YEAR || (curYear === MAX_YEAR && curMonth > MAX_MONTH)) {
    curMonth = MAX_MONTH; curYear = MAX_YEAR;
  }
  refreshView();
}

function goToday() {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  if (y < MIN_YEAR || (y === MIN_YEAR && m < MIN_MONTH) ||
      y > MAX_YEAR || (y === MAX_YEAR && m > MAX_MONTH)) return;
  curYear = y; curMonth = m;
  refreshView();
}

async function refreshView() {
  await fetchEvents();
  renderCalendar();
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!(await checkSession())) return;
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login.html';
  });
  document.getElementById('prevBtn').addEventListener('click', prevMonth);
  document.getElementById('nextBtn').addEventListener('click', nextMonth);
  document.getElementById('todayBtn').addEventListener('click', goToday);
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('eventModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.getElementById('addEventBtn').addEventListener('click', addEvent);
  document.getElementById('newEventInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addEvent();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
  await refreshView();
});
