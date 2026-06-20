(function() {
var MIN_YEAR = 2026, MIN_MONTH = 5;
var MAX_YEAR = 2027, MAX_MONTH = 1;

var curYear = 2026, curMonth = 7;
var eventsData = {};
var currentModalDate = null;
var currentUser = null;
var lastActivity = Date.now();
var SESSION_TIMEOUT = 30 * 60 * 1000;

var monthNames = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
var dayNames = ['日','一','二','三','四','五','六'];

function rocYear(y) { return y - 1911; }

function resetActivity() { lastActivity = Date.now(); }

function checkSession() {
  if (Date.now() - lastActivity > SESSION_TIMEOUT) {
    firebase.auth().signOut();
    window.location.href = 'login.html';
  }
}

['click','keydown','mousemove','touchstart'].forEach(function(evt) {
  document.addEventListener(evt, resetActivity, { passive: true });
});

setInterval(checkSession, 60000);

firebase.auth().onAuthStateChanged(function(user) {
  if (!user) { window.location.href = 'login.html'; return; }
  currentUser = user;
  document.getElementById('headerUser').textContent = user.email;
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
    var snap = await db.collection('events')
      .where('date', '>=', start)
      .where('date', '<=', end)
      .get();
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
    container.innerHTML = '<div class="no-events">\u5C1A\u7121\u4E8B\u9805\uFF0C\u8ACB\u65B0\u589E</div>';
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
    var docRef = await db.collection('events').add({
      date: currentModalDate,
      text: text
    });
    if (!eventsData[currentModalDate]) eventsData[currentModalDate] = [];
    eventsData[currentModalDate].push({ id: docRef.id, text: text });
    renderModalEvents();
    renderCalendar();
    input.value = '';
  } catch (e) { alert('\u7121\u6CD5\u65B0\u589E\uFF1A' + e.message); }
}

async function editEvent(id, text) {
  try {
    await db.collection('events').doc(id).update({ text: text });
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
    await db.collection('events').doc(id).delete();
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

/* ── 刪除整月功能 ── */
var DELETED_MONTH_STACK = [];
var UNDO_TIMEOUT = 15000;

function parseStudent(text) {
  var match = text.match(/^(BB|BA|BO)_(\w+)([\u4e00-\u9fa5()（）]+)$/);
  if (!match) return null;
  return { group: match[1], studentId: match[2], name: match[3] };
}

function showDeleteToast(msg, undoCallback) {
  var t = document.getElementById('deleteToast');
  t.innerHTML = '';
  var span = document.createElement('span');
  span.textContent = msg;
  t.appendChild(span);
  if (undoCallback) {
    var btn = document.createElement('button');
    btn.textContent = '復原';
    btn.style.cssText = 'margin-left:12px;background:white;color:#16a34a;border:none;padding:4px 12px;border-radius:6px;font-weight:700;cursor:pointer;';
    btn.addEventListener('click', function() { undoCallback(); t.classList.remove('show'); });
    t.appendChild(btn);
  }
  t.classList.add('show');
  clearTimeout(t._hideTimer);
  t._hideTimer = setTimeout(function() { t.classList.remove('show'); }, undoCallback ? UNDO_TIMEOUT : 2000);
}

function confirmDeleteMonth() {
  var year = curYear, month = curMonth;
  var monthStr = rocYear(year) + '\u5E74' + monthNames[month];
  var prefix = year + '-' + String(month + 1).padStart(2, '0');

  var totalEvents = 0, studentMatches = [];
  for (var date in eventsData) {
    if (!date.startsWith(prefix)) continue;
    totalEvents += eventsData[date].length;
    for (var i = 0; i < eventsData[date].length; i++) {
      var parsed = parseStudent(eventsData[date][i].text);
      if (parsed) studentMatches.push(parsed);
    }
  }

  if (totalEvents === 0) {
    return alert(monthStr + ' \u5C1A\u7121\u4E8B\u9805\u53EF\u522A\u9664');
  }

  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:2000;';

  var card = document.createElement('div');
  card.style.cssText = 'background:white;border-radius:16px;padding:28px 24px;width:90%;max-width:400px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.2);';

  var rosterNote = '';
  if (studentMatches.length) {
    var names = studentMatches.map(function(s) { return s.group + '_' + s.studentId + s.name; }).join('\u3001');
    rosterNote = '<p style="color:#dc2626;font-size:13px;margin-bottom:16px;background:#fef2f2;padding:10px;border-radius:8px;">\u5C07\u540C\u6B65\u5F9E\u300C\u6838\u5C0D\u8868\u300D\u522A\u9664\u4E0B\u5217' + studentMatches.length + '\u4F4D\u5B78\u751F\uFF1A<br><strong>' + names + '</strong></p>';
  }

  card.innerHTML =
    '<div style="font-size:40px;margin-bottom:12px;">\u26A0\uFE0F</div>' +
    '<h3 style="font-size:20px;font-weight:700;color:#1e293b;margin-bottom:8px;">\u78BA\u8A8D\u522A\u9664\u6574\u6708</h3>' +
    '<p style="color:#64748b;font-size:14px;margin-bottom:8px;">\u78BA\u5B9A\u8981\u522A\u9664 <strong>' + monthStr + '</strong> \u7684\u6240\u6709\u4E8B\u9805\uFF1F</p>' +
    '<p style="color:#64748b;font-size:14px;margin-bottom:16px;">\u5171 <strong>' + totalEvents + '</strong> \u7B46\u4E8B\u9805</p>' +
    rosterNote +
    '<p style="color:#94a3b8;font-size:13px;margin-bottom:20px;">\u522A\u9664\u5F8C\u53EF\u9EDE\u300C\u5FA9\u539F\u300D\u9084\u539F</p>';

  var btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:10px;justify-content:center;';

  var cancelBtn = document.createElement('button');
  cancelBtn.textContent = '\u53D6\u6D88';
  cancelBtn.style.cssText = 'padding:10px 24px;border:2px solid #e2e8f0;border-radius:8px;background:white;color:#475569;font-weight:600;cursor:pointer;font-size:14px;';
  cancelBtn.addEventListener('click', function() { document.body.removeChild(overlay); });

  var delBtn = document.createElement('button');
  delBtn.textContent = '\u78BA\u5B9A\u522A\u9664';
  delBtn.style.cssText = 'padding:10px 24px;border:none;border-radius:8px;background:#dc2626;color:white;font-weight:600;cursor:pointer;font-size:14px;';
  delBtn.addEventListener('click', function() {
    document.body.removeChild(overlay);
    deleteMonth(year, month);
  });

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(delBtn);
  card.appendChild(btnRow);
  overlay.appendChild(card);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) document.body.removeChild(overlay); });
  document.body.appendChild(overlay);
}

async function deleteMonth(year, month) {
  var prefix = year + '-' + String(month + 1).padStart(2, '0');
  var monthStr = rocYear(year) + '\u5E74' + monthNames[month];

  try {
    /* 1. collect events to delete */
    var deletedEvents = [];
    for (var date in eventsData) {
      if (!date.startsWith(prefix)) continue;
      for (var i = 0; i < eventsData[date].length; i++) {
        deletedEvents.push({
          date: date,
          text: eventsData[date][i].text,
          id: eventsData[date][i].id
        });
      }
    }

    if (!deletedEvents.length) {
      showDeleteToast(monthStr + ' \u5C1A\u7121\u4E8B\u9805');
      return;
    }

    /* 2. find matching students & snapshot roster data before deletion */
    var studentsToDelete = [];
    var rosterBackup = {};
    for (var i = 0; i < deletedEvents.length; i++) {
      var parsed = parseStudent(deletedEvents[i].text);
      if (parsed) {
        var docId = parsed.group + '_' + parsed.studentId;
        if (!rosterBackup[docId]) {
          studentsToDelete.push({ docId: docId, group: parsed.group, studentId: parsed.studentId, name: parsed.name });
          /* snapshot current roster data */
          try {
            var snap = await db.collection('roster').doc(docId).get();
            if (snap.exists) rosterBackup[docId] = snap.data();
            else rosterBackup[docId] = null;
          } catch(e) { rosterBackup[docId] = null; }
        }
      }
    }

    /* 3. delete from Firestore events collection */
    var batch = db.batch();
    for (var i = 0; i < deletedEvents.length; i++) {
      var ref = db.collection('events').doc(deletedEvents[i].id);
      batch.delete(ref);
    }

    /* 4. delete from Firestore roster collection */
    for (var i = 0; i < studentsToDelete.length; i++) {
      var ref = db.collection('roster').doc(studentsToDelete[i].docId);
      batch.delete(ref);
    }

    await batch.commit();

    /* 5. update local data */
    for (var date in eventsData) {
      if (date.startsWith(prefix)) delete eventsData[date];
    }

    renderCalendar();

    /* 6. save undo info */
    DELETED_MONTH_STACK.push({
      year: year,
      month: month,
      events: deletedEvents,
      students: studentsToDelete,
      rosterBackup: rosterBackup
    });

    var undoMsg = '\u5DF2\u522A\u9664 ' + monthStr + ' \u5171 ' + deletedEvents.length + ' \u7B46\u4E8B\u9805';
    if (studentsToDelete.length) undoMsg += '\uFF0C\u4E26\u540C\u6B65\u522A\u9664 ' + studentsToDelete.length + ' \u4F4D\u5B78\u751F\u6838\u5C0D\u8868';
    showDeleteToast(undoMsg, function() { undoDeleteMonth(); });

  } catch(e) {
    alert('\u522A\u9664\u5931\u6557\uFF1A' + e.message);
  }
}

async function undoDeleteMonth() {
  if (!DELETED_MONTH_STACK.length) return;
  var data = DELETED_MONTH_STACK.pop();

  try {
    var batch = db.batch();

    /* restore events */
    for (var i = 0; i < data.events.length; i++) {
      var ref = db.collection('events').doc(data.events[i].id);
      batch.set(ref, { date: data.events[i].date, text: data.events[i].text });
    }

    /* restore roster entries */
    for (var i = 0; i < data.students.length; i++) {
      var docId = data.students[i].docId;
      if (data.rosterBackup[docId]) {
        var ref = db.collection('roster').doc(docId);
        batch.set(ref, data.rosterBackup[docId]);
      }
    }

    await batch.commit();

    /* re-fetch & re-render */
    await refreshView();
    showDeleteToast('\u5DF2\u5FA9\u539F ' + rocYear(data.year) + '\u5E74' + monthNames[data.month]);
  } catch(e) {
    alert('\u5FA9\u539F\u5931\u6557\uFF1A' + e.message);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('logoutBtn').addEventListener('click', function() {
    firebase.auth().signOut();
  });
  document.getElementById('prevBtn').addEventListener('click', prevMonth);
  document.getElementById('nextBtn').addEventListener('click', nextMonth);
  document.getElementById('todayBtn').addEventListener('click', goToday);
  document.getElementById('deleteMonthBtn').addEventListener('click', confirmDeleteMonth);
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
});

})();
