(function() {
  var EDITABLE_COLS = ['app','macall','basicInfo','emergencyContact','insurance','healthRecord','infectionNotice','contract','subsidy','notes'];
  var COL_MAP = { app:4, macall:5, basicInfo:6, emergencyContact:7, insurance:8, healthRecord:9, infectionNotice:10, contract:11, subsidy:12, notes:13 };
  var rosterData = {};
  var saveTimer = null;

  firebase.auth().onAuthStateChanged(function(user) {
    if (!user) { window.location.href = 'login.html'; return; }
    document.getElementById('headerUser') && (document.getElementById('headerUser').textContent = user.email);
    loadAll();
  });

  function showToast(msg) {
    var t = document.getElementById('saveToast');
    t.textContent = msg || '已儲存';
    t.classList.add('show');
    setTimeout(function() { t.classList.remove('show'); }, 1500);
  }

  async function loadAll() {
    var events = await loadStudentEvents();
    var roster = await loadRosterDocs();
    renderTable(events, roster);
  }

  async function loadStudentEvents() {
    var students = [];
    var years = [2026, 2027];
    var months = [];
    for (var m = 5; m <= 13; m++) months.push(m);

    for (var yi = 0; yi < years.length; yi++) {
      var y = years[yi];
      for (var mi = 0; mi < months.length; mi++) {
        var m = months[mi];
        if (m > 12) continue;
        var mStr = String(m).padStart(2,'0');
        var start = y + '-' + mStr + '-01';
        var end = y + '-' + mStr + '-31';
        try {
          var snap = await db.collection('events')
            .where('date', '>=', start)
            .where('date', '<=', end)
            .get();
          snap.forEach(function(doc) {
            var d = doc.data();
            var parsed = parseStudent(d.text);
            if (parsed) {
              students.push({
                eventId: doc.id,
                date: d.date,
                group: parsed.group,
                studentId: parsed.studentId,
                name: parsed.name,
                fullName: parsed.group + '_' + parsed.studentId + parsed.name
              });
            }
          });
        } catch(e) { console.error(e); }
      }
    }

    students.sort(function(a, b) {
      if (a.date < b.date) return -1;
      if (a.date > b.date) return 1;
      return 0;
    });

    return students;
  }

  function parseStudent(text) {
    var match = text.match(/^(BB|BA|BO)_(\w+)([\u4e00-\u9fa5()（）]+)$/);
    if (!match) return null;
    return { group: match[1], studentId: match[2], name: match[3] };
  }

  async function loadRosterDocs() {
    var data = {};
    try {
      var snap = await db.collection('roster').get();
      snap.forEach(function(doc) {
        data[doc.id] = doc.data();
      });
    } catch(e) { console.error(e); }
    return data;
  }

  function makeDocId(student) {
    return student.group + '_' + student.studentId;
  }

  function renderTable(students, roster) {
    var tbody = document.getElementById('rosterBody');
    if (!students.length) {
      tbody.innerHTML = '<tr><td colspan="13" class="roster-empty">目前沒有新生入園資料</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    for (var i = 0; i < students.length; i++) {
      var s = students[i];
      var docId = makeDocId(s);
      var saved = roster[docId] || {};

      var tr = document.createElement('tr');
      tr.dataset.docid = docId;
      tr.dataset.name = s.name;
      tr.dataset.group = s.group;
      tr.dataset.studentid = s.studentId;
      tr.dataset.date = s.date;

      var tdOrder = document.createElement('td');
      tdOrder.className = 'col-order';
      tdOrder.textContent = i + 1;
      tr.appendChild(tdOrder);

      var tdId = document.createElement('td');
      tdId.className = 'col-id';
      tdId.textContent = s.studentId + '\n' + s.name;
      tdId.style.whiteSpace = 'pre-line';
      tr.appendChild(tdId);

      var tdDate = document.createElement('td');
      tdDate.className = 'col-date';
      tdDate.textContent = formatRocDate(s.date);
      tr.appendChild(tdDate);

      for (var ci = 0; ci < EDITABLE_COLS.length; ci++) {
        var td = document.createElement('td');
        td.contentEditable = 'true';
        td.dataset.field = EDITABLE_COLS[ci];
        td.textContent = saved[EDITABLE_COLS[ci]] || '';
        td.addEventListener('blur', handleCellBlur);
        tr.appendChild(td);
      }

      tbody.appendChild(tr);
    }
  }

  function formatRocDate(dateStr) {
    var parts = dateStr.split('-');
    var y = parseInt(parts[0]) - 1911;
    return y + '/' + parseInt(parts[1]) + '/' + parseInt(parts[2]);
  }

  function handleCellBlur(e) {
    var td = e.target;
    var tr = td.closest('tr');
    var docId = tr.dataset.docid;
    var field = td.dataset.field;
    var value = td.textContent.trim();

    if (!rosterData[docId]) {
      rosterData[docId] = {
        name: tr.dataset.name,
        group: tr.dataset.group,
        studentId: tr.dataset.studentid,
        date: tr.dataset.date
      };
    }
    rosterData[docId][field] = value;

    clearTimeout(saveTimer);
    saveTimer = setTimeout(function() { saveAll(); }, 500);
  }

  async function saveAll() {
    var keys = Object.keys(rosterData);
    if (!keys.length) return;

    var promises = [];
    for (var i = 0; i < keys.length; i++) {
      var docId = keys[i];
      var data = rosterData[docId];
      promises.push(
        db.collection('roster').doc(docId).set(data, { merge: true })
      );
    }

    try {
      await Promise.all(promises);
      showToast('已儲存');
      rosterData = {};
    } catch(e) {
      console.error(e);
      showToast('儲存失敗：' + e.message);
    }
  }
})();
