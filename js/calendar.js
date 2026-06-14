(function() {
var MIN_YEAR = 2026, MIN_MONTH = 7;
var MAX_YEAR = 2027, MAX_MONTH = 1;

var curYear = 2026, curMonth = 7;
var eventsData = {};
var currentModalDate = null;
var currentUser = null;

var monthNames = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
var dayNames = ['日','一','二','三','四','五','六'];

function rocYear(y) { return y - 1911; }

firebase.auth().onAuthStateChanged(function(user) {
  if (!user) { window.location.href = 'login.html'; return; }
  currentUser = user;
  document.getElementById('headerUser').textContent = '\u{1F464} ' + user.email;
  if (document.getElementById('calendarGrid').children.length === 0) {
    refreshView();
  }
});

async function fetchEvents() {
  eventsData = {};
  var monthStr = String(curMonth + 1).padStart(2, '0');
  var start = curYear + '-' + monthStr + '-01';
  var end = curYear + '-' + monthStr + '-31';
  try {
    var snap = await firebase.firestore.getDocs(
      firebase.firestore.query(
        firebase.firestore.collection(db, 'events'),
        firebase.firestore.where('date', '>=', start),
        firebase.firestore.where('date', '<=', end)
      )
    );
    snap.forEach(function(doc) {
      var d = doc.data();
      if (!eventsData[d.date]) eventsData[d.date] = [];
      eventsData[d.date].push({ id: doc.id, text: d.text });
    });
  } catch (e) { console.error(e); }
}

function renderCalendar() {
  var firstDay = new Date(curYear, curMonth, 1).getDay();
  var daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
  var grid = document.getElementById('calendarGrid');
  grid.innerHTML = '';

  for (var i = 0; i < dayNames.length; i++) {
    var h = document.createElement('div');
    h.className = 'day-header';
    h.textContent = dayNames[i];
    grid.appendChild(h);
  }

  for (var i = 0; i < firstDay; i++) {
    var e = document.createElement('div');
    e.className = 'day-cell empty';
    grid.appendChild(e);
  }

  var today = new Date();
  var todayStr = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');

  for (var day = 1; day <= daysInMonth; day++) {
    var dateStr = curYear + '-' + String(curMonth+1).padStart(2,'0') + '-' + String(day).padStart(2,'0');
    var cell = document.createElement('div');
    cell.className = 'day-cell';
    cell.dataset.date = dateStr;

    var dow = new Date(curYear, curMonth, day).getDay();
    if (dow === 0 || dow === 6) cell.classList.add('weekend');
    if (dateStr === todayStr) cell.classList.add('today');

    var num = document.createElement('div');
    num.className = 'day-number';
    num.textContent = day;
    cell.appendChild(num);

    var evts = eventsData[dateStr] || [];
    if (evts.length) {
      var list = document.createElement('div');
      list.className = 'event-list';
      for (var j = 0; j < evts.length; j++) {
        var el = document.createElement('div');
        el.className = 'event-item';
        el.textContent = evts[j].text;
        el.title = evts[j].text;
        list.appendChild(el);
      }
      cell.appendChild(list);
    }

    cell.addEventListener('click', (function(d) { return function() { openModal(d); }; })(dateStr));
    grid.appendChild(cell);
  }

  document.getElementById('monthTitle').textContent = rocYear(curYear) + '\u5E74' + monthNames[curMonth];
  document.getElementById('prevBtn').disabled = (curYear === MIN_YEAR && curMonth === MIN_MONTH);
  document.getElementById('nextBtn').disabled = (curYear === MAX_YEAR && curMonth === MAX_MONTH);
}

function openModal(dateStr) {
  currentModalDate = dateStr;
  var dateObj = new Date(dateStr + 'T00:00:00');
  var weekdays = ['\u661F\u671F\u65E5','\u661F\u671F\u4E00','\u661F\u671F\u4E8C','\u661F\u671F\u4E09','\u661F\u671F\u56DB','\u661F\u671F\u4E94','\u661F\u671F\u516D'];
  document.getElementById('modalDate').textContent = dateStr + ' ' + weekdays[dateObj.getDay()];
  document.getElementById('eventModal').style.display = 'flex';
  document.getElementById('newEventInput').value = '';
  renderModalEvents();
}

function closeModal() {
  document.getElementById('eventModal').style.display = 'none';
  currentModalDate = null;
}

function renderModalEvents() {
  var container = document.getElementById('eventList');
  var evts = eventsData[currentModalDate] || [];
  if (!evts.length) {
    container.innerHTML = '<div class="no-events">尚無事項，請新增</div>';
    return;
  }
  container.innerHTML = '';
  for (var i = 0; i < evts.length; i++) {
    var evt = evts[i];
    var item = document.createElement('div');
    item.className = 'event-modal-item';
    item.dataset.id = evt.id;

    var textSpan = document.createElement('span');
    textSpan.className = 'event-modal-text';
    textSpan.textContent = evt.text;

    var actions = document.createElement('div');
    actions.className = 'event-modal-actions';

    var editBtn = document.createElement('button');
    editBtn.className = 'btn-edit';
    editBtn.innerHTML = '\u270E';
    editBtn.title = '\u4FEE\u6539';
    editBtn.addEventListener('click', (function(id, txt) {
      return function(e) {
        e.stopPropagation();
        var newText = prompt('\u4FEE\u6539\u4E8B\u9805\u5167\u5BB9\uFF1A', txt);
        if (newText && newText.trim()) editEvent(id, newText.trim());
      };
    })(evt.id, evt.text));

    var delBtn = document.createElement('button');
    delBtn.className = 'btn-danger';
    delBtn.innerHTML = '\u2715';
    delBtn.title = '\u522A\u9664';
    delBtn.addEventListener('click', (function(id, txt) {
      return function(e) {
        e.stopPropagation();
        if (confirm('\u78BA\u5B9A\u522A\u9664\u300C' + txt + '\u300D\uFF1F')) deleteEvent(id);
      };
    })(evt.id, evt.text));

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    item.appendChild(textSpan);
    item.appendChild(actions);
    container.appendChild(item);
  }
}

async function addEvent() {
  var input = document.getElementById('newEventInput');
  var text = input.value.trim();
  if (!text) return alert('\u8ACB\u8F38\u5165\u4E8B\u9805\u5167\u5BB9');
  try {
    var docRef = await firebase.firestore.addDoc(
      firebase.firestore.collection(db, 'events'),
      { date: currentModalDate, text: text }
    );
    if (!eventsData[currentModalDate]) eventsData[currentModalDate] = [];
    eventsData[currentModalDate].push({ id: docRef.id, text: text });
    renderModalEvents();
    renderCalendar();
    input.value = '';
  } catch (e) { alert('\u7121\u6CD5\u65B0\u589E\uFF1A' + e.message); }
}

async function editEvent(id, text) {
  try {
    await firebase.firestore.updateDoc(
      firebase.firestore.doc(db, 'events', id),
      { text: text }
    );
    for (var date in eventsData) {
      for (var i = 0; i < eventsData[date].length; i++) {
        if (eventsData[date][i].id === id) {
          eventsData[date][i].text = text;
          renderModalEvents();
          renderCalendar();
          return;
        }
      }
    }
  } catch (e) { alert('\u7121\u6CD5\u4FEE\u6539\uFF1A' + e.message); }
}

async function deleteEvent(id) {
  try {
    await firebase.firestore.deleteDoc(firebase.firestore.doc(db, 'events', id));
    for (var date in eventsData) {
      for (var i = 0; i < eventsData[date].length; i++) {
        if (eventsData[date][i].id === id) {
          eventsData[date].splice(i, 1);
          if (!eventsData[date].length) delete eventsData[date];
          renderModalEvents();
          renderCalendar();
          return;
        }
      }
    }
  } catch (e) { alert('\u7121\u6CD5\u522A\u9664\uFF1A' + e.message); }
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
  var now = new Date();
  var y = now.getFullYear(), m = now.getMonth();
  if (y < MIN_YEAR || (y === MIN_YEAR && m < MIN_MONTH) ||
      y > MAX_YEAR || (y === MAX_YEAR && m > MAX_MONTH)) return;
  curYear = y; curMonth = m;
  refreshView();
}

async function refreshView() {
  await fetchEvents();
  renderCalendar();
}

document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('logoutBtn').addEventListener('click', function() {
    firebase.auth().signOut();
    window.location.href = 'login.html';
  });
  document.getElementById('prevBtn').addEventListener('click', prevMonth);
  document.getElementById('nextBtn').addEventListener('click', nextMonth);
  document.getElementById('todayBtn').addEventListener('click', goToday);
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('eventModal').addEventListener('click', function(e) {
    if (e.target === e.currentTarget) closeModal();
  });
  document.getElementById('addEventBtn').addEventListener('click', addEvent);
  document.getElementById('newEventInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') addEvent();
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeModal();
  });
  if (currentUser) refreshView();
});

})();
