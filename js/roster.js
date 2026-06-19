(function() {
  var EDITABLE_COLS = ['nameCol','dateCol','app','macall','basicInfo','emergencyContact','insurance','healthRecord','infectionNotice','contract','subsidy','notes'];
  var COL_HEADERS = ['學號_姓名','入園日期','APP','MA/MA/CALL','基本資料','緊急聯絡人鍵檔','團保回條','健康師檢紀錄卡','感控通知單','契約*2','補助','備註'];
  var allStudents = [];
  var rosterStatus = {};
  var saveTimer = null;

  firebase.auth().onAuthStateChanged(function(user) {
    if (!user) { window.location.href = 'login.html'; return; }
    loadAll();
  });

  function showToast(msg) {
    var t = document.getElementById('saveToast');
    t.textContent = msg || '已儲存';
    t.classList.add('show');
    setTimeout(function() { t.classList.remove('show'); }, 1500);
  }

  async function loadAll() {
    allStudents = await loadStudentEvents();
    rosterStatus = await loadRosterDocs();
    renderTable();
  }

  async function loadStudentEvents() {
    var students = [];
    var ranges = [
      {y:2026, mStart:5, mEnd:12},
      {y:2027, mStart:0, mEnd:1}
    ];
    for (var ri = 0; ri < ranges.length; ri++) {
      var r = ranges[ri];
      for (var m = r.mStart; m <= r.mEnd; m++) {
        var mStr = String(m + 1).padStart(2,'0');
        var start = r.y + '-' + mStr + '-01';
        var end = r.y + '-' + mStr + '-31';
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
                id: doc.id,
                date: d.date,
                group: parsed.group,
                studentId: parsed.studentId,
                name: parsed.name
              });
            }
          });
        } catch(e) { console.error(e); }
      }
    }
    students.sort(function(a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
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
      snap.forEach(function(doc) { data[doc.id] = doc.data(); });
    } catch(e) { console.error(e); }
    return data;
  }

  function makeDocId(student) {
    return student.group + '_' + student.studentId;
  }

  function formatRocDate(dateStr) {
    var parts = dateStr.split('-');
    var y = parseInt(parts[0]) - 1911;
    return y + '/' + parseInt(parts[1]) + '/' + parseInt(parts[2]);
  }

  function parseDateInput(val) {
    val = val.trim();
    var m = val.match(/^(\d{2,3})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
    if (m) {
      var year = parseInt(m[1]) + 1911;
      var month = String(parseInt(m[2])).padStart(2,'0');
      var day = String(parseInt(m[3])).padStart(2,'0');
      return year + '-' + month + '-' + day;
    }
    m = val.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
    if (m) {
      var month = String(parseInt(m[2])).padStart(2,'0');
      var day = String(parseInt(m[3])).padStart(2,'0');
      return m[1] + '-' + month + '-' + day;
    }
    return null;
  }

  function renderTable() {
    var tbody = document.getElementById('rosterBody');
    if (!allStudents.length) {
      tbody.innerHTML = '<tr><td colspan="14" class="roster-empty">目前沒有新生入園資料，請點「+ 新增學生」</td></tr>';
      return;
    }
    tbody.innerHTML = '';
    for (var i = 0; i < allStudents.length; i++) {
      var s = allStudents[i];
      var docId = makeDocId(s);
      var saved = rosterStatus[docId] || {};
      var tr = createRow(i, s, saved, docId);
      tbody.appendChild(tr);
    }
  }

  function createRow(index, student, saved, docId) {
    var tr = document.createElement('tr');
    tr.dataset.docid = docId;

    var tdOrder = document.createElement('td');
    tdOrder.className = 'col-order';
    tdOrder.textContent = index + 1;
    tr.appendChild(tdOrder);

    var tdName = document.createElement('td');
    tdName.className = 'col-id';
    tdName.contentEditable = 'true';
    tdName.dataset.field = 'nameCol';
    tdName.textContent = student.group + '_' + student.studentId + student.name;
    tdName.style.whiteSpace = 'pre-line';
    tdName.addEventListener('blur', handleCellBlur);
    tr.appendChild(tdName);

    var tdDate = document.createElement('td');
    tdDate.className = 'col-date';
    tdDate.contentEditable = 'true';
    tdDate.dataset.field = 'dateCol';
    tdDate.textContent = formatRocDate(student.date);
    tdDate.addEventListener('blur', handleCellBlur);
    tr.appendChild(tdDate);

    var editableFields = ['app','macall','basicInfo','emergencyContact','insurance','healthRecord','infectionNotice','contract','subsidy','notes'];
    for (var ci = 0; ci < editableFields.length; ci++) {
      var td = document.createElement('td');
      td.contentEditable = 'true';
      td.dataset.field = editableFields[ci];
      td.textContent = saved[editableFields[ci]] || '';
      td.addEventListener('blur', handleCellBlur);
      tr.appendChild(td);
    }

    var tdDel = document.createElement('td');
    var delBtn = document.createElement('button');
    delBtn.className = 'btn-delete-row';
    delBtn.innerHTML = '&#10005;';
    delBtn.title = '刪除此列';
    delBtn.addEventListener('click', (function(did, nm) {
      return function() { deleteRow(did, nm); };
    })(docId, student.group + '_' + student.studentId + student.name));
    tdDel.appendChild(delBtn);
    tr.appendChild(tdDel);

    return tr;
  }

  function handleCellBlur(e) {
    var td = e.target;
    var tr = td.closest('tr');
    var docId = tr.dataset.docid;
    var field = td.dataset.field;
    var value = td.textContent.trim();

    if (field === 'nameCol') {
      var parsed = parseStudent(value);
      if (parsed) {
        var newDocId = parsed.group + '_' + parsed.studentId;
        var oldIndex = allStudents.findIndex(function(s) { return makeDocId(s) === docId; });
        if (oldIndex >= 0) {
          allStudents[oldIndex].group = parsed.group;
          allStudents[oldIndex].studentId = parsed.studentId;
          allStudents[oldIndex].name = parsed.name;
        }
        if (newDocId !== docId) {
          tr.dataset.docid = newDocId;
          delete rosterStatus[docId];
          docId = newDocId;
        }
      }
    } else if (field === 'dateCol') {
      var newDate = parseDateInput(value);
      if (newDate) {
        var oldIndex = allStudents.findIndex(function(s) { return makeDocId(s) === docId; });
        if (oldIndex >= 0) {
          allStudents[oldIndex].date = newDate;
        }
        td.textContent = formatRocDate(newDate);
      }
    }

    if (!rosterStatus[docId]) {
      var s = allStudents.find(function(st) { return makeDocId(st) === docId; });
      if (s) {
        rosterStatus[docId] = { group: s.group, studentId: s.studentId, name: s.name, date: s.date };
      } else {
        rosterStatus[docId] = {};
      }
    }
    rosterStatus[docId][field] = value;

    clearTimeout(saveTimer);
    saveTimer = setTimeout(function() { saveAll(); }, 800);
  }

  async function deleteRow(docId, name) {
    if (!confirm('確定刪除此列「' + name + '」？')) return;

    var tr = document.querySelector('tr[data-docid="' + docId + '"]');
    if (tr) tr.remove();

    var idx = allStudents.findIndex(function(s) { return makeDocId(s) === docId; });
    if (idx >= 0) allStudents.splice(idx, 1);
    delete rosterStatus[docId];

    try {
      await db.collection('roster').doc(docId).delete();
    } catch(e) { console.error(e); }

    renumberRows();
    showToast('已刪除');
  }

  function renumberRows() {
    var rows = document.querySelectorAll('#rosterBody tr');
    for (var i = 0; i < rows.length; i++) {
      var td = rows[i].querySelector('.col-order');
      if (td) td.textContent = i + 1;
    }
  }

  document.getElementById('addStudentBtn').addEventListener('click', function() {
    var newStudent = {
      id: 'new_' + Date.now(),
      date: '2026-08-01',
      group: 'BB',
      studentId: '',
      name: ''
    };
    allStudents.push(newStudent);
    var docId = 'new_' + Date.now();
    rosterStatus[docId] = { group: 'BB', studentId: '', name: '', date: '2026-08-01' };

    var tbody = document.getElementById('rosterBody');
    if (tbody.querySelector('.roster-empty')) tbody.innerHTML = '';

    var tr = createRow(allStudents.length - 1, newStudent, rosterStatus[docId], docId);
    tbody.appendChild(tr);

    var nameCell = tr.querySelector('[data-field="nameCol"]');
    if (nameCell) { nameCell.focus(); }
    renumberRows();
  });

  async function saveAll() {
    var keys = Object.keys(rosterStatus);
    if (!keys.length) return;

    var promises = [];
    for (var i = 0; i < keys.length; i++) {
      var docId = keys[i];
      var data = rosterStatus[docId];
      promises.push(db.collection('roster').doc(docId).set(data, { merge: true }));
    }

    try {
      await Promise.all(promises);
      showToast('已儲存');
    } catch(e) {
      console.error(e);
      showToast('儲存失敗：' + e.message);
    }
  }
})();
