(function() {
var CONFIG_PATH = 'settings/regConfig';
var currentUser = null;
var config = null;

function $(id) { return document.getElementById(id); }

firebase.auth().onAuthStateChanged(function(user) {
  if (!user) { window.location.href = 'login.html'; return; }
  currentUser = user;
  $('headerUser').textContent = user.email;
  loadConfig().then(renderAll);
});

function loadConfig() {
  return db.doc(CONFIG_PATH).get().then(function(snap) {
    if (!snap.exists) {
      config = getDefaultConfig();
      db.doc(CONFIG_PATH).set(config);
    } else {
      config = snap.data();
    }
    return config;
  });
}

function getDefaultConfig() {
  return {
    formTitle: '活動報名表',
    formDescription: '請填寫以下資料完成報名',
    headerImageUrl: '',
    formActive: true,
    totalAdultLimit: 200,
    totalAdultsBooked: 0,
    sessions: [
      { id: 'morning', name: '上午場 09:00-12:00', limit: 50, booked: 0 },
      { id: 'afternoon', name: '下午場 14:00-17:00', limit: 50, booked: 0 },
      { id: 'full', name: '全日場 09:00-17:00', limit: 30, booked: 0 }
    ]
  };
}

function renderAll() {
  renderSettings();
  renderSessions();
  loadRegistrations();
}

function renderSettings() {
  $('editTitle').value = config.formTitle || '';
  $('editDesc').value = config.formDescription || '';
  $('editHeaderImage').value = config.headerImageUrl || '';
  $('editTotalLimit').value = config.totalAdultLimit || 200;
  $('editTotalBooked').textContent = config.totalAdultsBooked || 0;
  $('editFormActive').checked = config.formActive !== false;

  if (config.headerImageUrl) {
    $('previewImage').src = config.headerImageUrl;
    $('previewImage').style.display = 'block';
  } else {
    $('previewImage').style.display = 'none';
  }
}

$('editHeaderImage').addEventListener('input', function() {
  var url = this.value.trim();
  if (url) {
    $('previewImage').src = url;
    $('previewImage').style.display = 'block';
  } else {
    $('previewImage').style.display = 'none';
  }
});

$('saveSettingsBtn').addEventListener('click', function() {
  var title = $('editTitle').value.trim();
  var desc = $('editDesc').value.trim();
  var headerImg = $('editHeaderImage').value.trim();
  var totalLimit = parseInt($('editTotalLimit').value, 10);
  var active = $('editFormActive').checked;

  if (!title) { alert('請填寫報名表標題'); return; }
  if (isNaN(totalLimit) || totalLimit < 1) { alert('請填寫有效的人數上限'); return; }

  var updates = {
    formTitle: title,
    formDescription: desc,
    headerImageUrl: headerImg,
    formActive: active,
    totalAdultLimit: totalLimit
  };

  db.doc(CONFIG_PATH).update(updates).then(function() {
    config.formTitle = title;
    config.formDescription = desc;
    config.headerImageUrl = headerImg;
    config.formActive = active;
    config.totalAdultLimit = totalLimit;
    $('settingsSaveMsg').textContent = '✅ 已儲存';
    setTimeout(function() { $('settingsSaveMsg').textContent = ''; }, 3000);
  }).catch(function(e) {
    alert('儲存失敗：' + e.message);
  });
});

$('resetTotalBtn').addEventListener('click', function() {
  if (!confirm('確定要將已報名大人總數歸零嗎？')) return;
  db.doc(CONFIG_PATH).update({ totalAdultsBooked: 0 }).then(function() {
    config.totalAdultsBooked = 0;
    $('editTotalBooked').textContent = '0';
    $('settingsSaveMsg').textContent = '✅ 已歸零';
    setTimeout(function() { $('settingsSaveMsg').textContent = ''; }, 3000);
  });
});

function renderSessions() {
  var container = $('sessionList');
  container.innerHTML = '';
  config.sessions.forEach(function(s, i) {
    var div = document.createElement('div');
    div.className = 'session-edit-item';
    div.innerHTML =
      '<div class="session-edit-fields">' +
        '<label>場次名稱 <input type="text" class="session-name" value="' + escHtml(s.name) + '"></label>' +
        '<label>人數上限 <input type="number" class="session-limit" value="' + s.limit + '" min="1"></label>' +
        '<span class="session-booked">已報名：<strong>' + s.booked + '</strong> 人</span>' +
        '<button class="btn btn-sm btn-outline session-reset" data-idx="' + i + '">歸零</button>' +
      '</div>';
    container.appendChild(div);
  });
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

$('sessionList').addEventListener('click', function(e) {
  if (e.target.classList.contains('session-reset')) {
    var idx = parseInt(e.target.getAttribute('data-idx'), 10);
    if (!confirm('確定要將此場次已報名人數歸零嗎？')) return;
    db.doc(CONFIG_PATH).update({
      ['sessions.' + idx + '.booked']: 0
    }).then(function() {
      config.sessions[idx].booked = 0;
      renderSessions();
      $('sessionsSaveMsg').textContent = '✅ 已歸零';
      setTimeout(function() { $('sessionsSaveMsg').textContent = ''; }, 3000);
    });
  }
});

$('saveSessionsBtn').addEventListener('click', function() {
  var nameInputs = document.querySelectorAll('.session-name');
  var limitInputs = document.querySelectorAll('.session-limit');
  var sessions = [];
  for (var i = 0; i < nameInputs.length; i++) {
    var name = nameInputs[i].value.trim();
    var limit = parseInt(limitInputs[i].value, 10);
    if (!name) { alert('請填寫第 ' + (i+1) + ' 個場次名稱'); return; }
    if (isNaN(limit) || limit < 1) { alert('請填寫第 ' + (i+1) + ' 個場次的人數上限'); return; }
    sessions.push({
      id: config.sessions[i] ? config.sessions[i].id : 'session' + i,
      name: name,
      limit: limit,
      booked: config.sessions[i] ? config.sessions[i].booked : 0
    });
  }
  db.doc(CONFIG_PATH).update({ sessions: sessions }).then(function() {
    config.sessions = sessions;
    $('sessionsSaveMsg').textContent = '✅ 已儲存';
    setTimeout(function() { $('sessionsSaveMsg').textContent = ''; }, 3000);
  }).catch(function(e) {
    alert('儲存失敗：' + e.message);
  });
});

function loadRegistrations() {
  $('regLoading').style.display = 'block';
  $('regBody').innerHTML = '';
  $('regEmpty').style.display = 'none';

  db.collection('registrations').orderBy('createdAt', 'desc').get().then(function(snap) {
    $('regLoading').style.display = 'none';
    if (snap.empty) {
      $('regEmpty').style.display = 'block';
      return;
    }
    var sessionNames = {};
    (config.sessions || []).forEach(function(s) { sessionNames[s.id] = s.name; });

    var html = '';
    snap.forEach(function(doc) {
      var d = doc.data();
      var timeStr = d.createdAt ? d.createdAt.toDate().toLocaleString('zh-TW') : '-';
      var sName = sessionNames[d.session] || d.session;
      html += '<tr>' +
        '<td>' + escHtml(d.parentName) + '</td>' +
        '<td>' + escHtml(d.childName) + '</td>' +
        '<td>' + escHtml(d.phone) + '</td>' +
        '<td>' + escHtml(d.email || '-') + '</td>' +
        '<td>' + escHtml(sName) + '</td>' +
        '<td>' + (d.adults || 1) + '</td>' +
        '<td>' + escHtml(d.notes || '-') + '</td>' +
        '<td>' + timeStr + '</td>' +
      '</tr>';
    });
    $('regBody').innerHTML = html;
  }).catch(function(e) {
    $('regLoading').style.display = 'none';
    $('regEmpty').style.display = 'block';
    $('regEmpty').textContent = '載入失敗：' + e.message;
  });
}

$('refreshRegBtn').addEventListener('click', loadRegistrations);

$('exportCsvBtn').addEventListener('click', function() {
  db.collection('registrations').orderBy('createdAt', 'desc').get().then(function(snap) {
    if (snap.empty) { alert('尚無報名資料'); return; }

    var sessionNames = {};
    (config.sessions || []).forEach(function(s) { sessionNames[s.id] = s.name; });

    var rows = [['家長姓名','幼兒姓名','電話','Email','場次','大人人數','備註','報名時間']];
    snap.forEach(function(doc) {
      var d = doc.data();
      var timeStr = d.createdAt ? d.createdAt.toDate().toLocaleString('zh-TW') : '';
      rows.push([
        d.parentName || '',
        d.childName || '',
        d.phone || '',
        d.email || '',
        sessionNames[d.session] || d.session || '',
        String(d.adults || 1),
        d.notes || '',
        timeStr
      ]);
    });

    var csv = rows.map(function(row) {
      return row.map(function(cell) {
        return '"' + String(cell).replace(/"/g, '""') + '"';
      }).join(',');
    }).join('\n');

    var bom = '\uFEFF';
    var blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = '報名資料_' + new Date().toISOString().slice(0,10) + '.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  });
});

$('logoutBtn').addEventListener('click', function() {
  firebase.auth().signOut();
});

var tabs = document.querySelectorAll('.tab-btn');
tabs.forEach(function(btn) {
  btn.addEventListener('click', function() {
    tabs.forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(function(tc) { tc.classList.remove('active'); });
    var tabId = 'tab-' + btn.getAttribute('data-tab');
    document.getElementById(tabId).classList.add('active');
  });
});

})();
