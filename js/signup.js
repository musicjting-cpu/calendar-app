(function() {
var CONFIG_PATH = 'settings/regConfig';
var REGISTRATIONS_COLL = 'registrations';

var config = null;

function $(id) { return document.getElementById(id); }

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

function renderQuota() {
  var remaining = config.totalAdultLimit - config.totalAdultsBooked;
  $('totalQuota').textContent = config.totalAdultsBooked + ' / ' + config.totalAdultLimit + ' 人';

  var container = $('sessionQuotaContainer');
  container.innerHTML = '';
  config.sessions.forEach(function(s) {
    var div = document.createElement('div');
    div.className = 'quota-item';
    div.innerHTML = '<span class="quota-label">' + s.name + '</span>' +
      '<span class="quota-count">' + s.booked + ' / ' + s.limit + ' 人</span>';
    container.appendChild(div);
  });
}

function renderSessions() {
  var container = $('sessionOptions');
  container.innerHTML = '';
  config.sessions.forEach(function(s, i) {
    var full = s.booked >= s.limit;
    var label = document.createElement('label');
    label.className = 'session-option' + (full ? ' session-full' : '');
    var radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'session';
    radio.value = s.id;
    radio.disabled = full;
    if (i === 0 && !full) radio.checked = true;
    label.appendChild(radio);
    var span = document.createElement('span');
    span.textContent = s.name + (full ? ' (已額滿)' : ' (' + (s.limit - s.booked) + ' 位名額)');
    label.appendChild(span);
    container.appendChild(label);
  });
}

function checkFormAvailability() {
  var totalFull = config.totalAdultsBooked >= config.totalAdultLimit;
  var allSessionsFull = config.sessions.every(function(s) { return s.booked >= s.limit; });
  var formActive = config.formActive;

  if (!formActive || totalFull || allSessionsFull) {
    $('formClosedMessage').style.display = 'block';
    $('signupForm').style.display = 'none';
  } else {
    $('formClosedMessage').style.display = 'none';
    $('signupForm').style.display = 'block';
  }
}

function renderForm() {
  if (config.headerImageUrl) {
    $('headerImage').src = config.headerImageUrl;
    $('headerImage').style.display = 'block';
  } else {
    $('headerImage').style.display = 'none';
  }
  $('formTitle').textContent = config.formTitle;
  $('formDesc').textContent = config.formDescription;
  renderQuota();
  renderSessions();
  checkFormAvailability();
}

function getFormData() {
  var selected = document.querySelector('input[name="session"]:checked');
  return {
    parentName: $('parentName').value.trim(),
    childName: $('childName').value.trim(),
    phone: $('phone').value.trim(),
    email: $('email').value.trim(),
    session: selected ? selected.value : '',
    adults: parseInt($('adults').value, 10),
    notes: $('notes').value.trim()
  };
}

function validateForm(data) {
  if (!data.parentName) return '請填寫家長姓名';
  if (!data.childName) return '請填寫幼兒姓名';
  if (!data.phone) return '請填寫聯絡電話';
  if (!data.session) return '請選擇場次';
  if (isNaN(data.adults) || data.adults < 1) return '請選擇大人人數';
  return null;
}

function submitRegistration() {
  var data = getFormData();
  var err = validateForm(data);
  if (err) { showError(err); return; }

  var btn = $('submitBtn');
  btn.disabled = true;
  btn.textContent = '送出中...';
  hideError();

  var dbRun = db;

  dbRun.runTransaction(function(transaction) {
    var ref = dbRun.doc(CONFIG_PATH);
    return transaction.get(ref).then(function(snap) {
      if (!snap.exists) throw new Error('設定不存在');
      var cfg = snap.data();

      if (!cfg.formActive) throw new Error('報名已停止');

      if (cfg.totalAdultsBooked + data.adults > cfg.totalAdultLimit) {
        throw new Error('總報名人數已額滿，無法再報名');
      }

      var sessionObj = null;
      for (var i = 0; i < cfg.sessions.length; i++) {
        if (cfg.sessions[i].id === data.session) {
          sessionObj = cfg.sessions[i];
          break;
        }
      }
      if (!sessionObj) throw new Error('無效的場次');

      if (sessionObj.booked + data.adults > sessionObj.limit) {
        throw new Error('該場次人數已額滿，請選擇其他場次');
      }

      transaction.update(ref, {
        totalAdultsBooked: firebase.firestore.FieldValue.increment(data.adults),
        ['sessions.' + cfg.sessions.indexOf(sessionObj) + '.booked']: firebase.firestore.FieldValue.increment(data.adults)
      });

      var regRef = dbRun.collection(REGISTRATIONS_COLL).doc();
      transaction.set(regRef, {
        parentName: data.parentName,
        childName: data.childName,
        phone: data.phone,
        email: data.email,
        session: data.session,
        adults: data.adults,
        notes: data.notes,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    });
  }).then(function() {
    $('formPage').style.display = 'none';
    $('successPage').style.display = 'block';
  }).catch(function(e) {
    btn.disabled = false;
    btn.textContent = '送出報名';
    showError(e.message);
  });
}

function showError(msg) {
  var el = $('formError');
  el.textContent = msg;
  el.style.display = 'block';
}

function hideError() {
  $('formError').style.display = 'none';
}

$('submitBtn').addEventListener('click', submitRegistration);

$('signupForm').addEventListener('submit', function(e) {
  e.preventDefault();
  submitRegistration();
});

loadConfig().then(function() {
  renderForm();
}).catch(function(e) {
  showError('無法載入表單設定：' + e.message);
});

})();
