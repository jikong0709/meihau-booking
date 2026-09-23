const serviceCatalog = {
  cowork: {
    label: '共享辦公',
    plans: [
      ['cowork-2h', '2 小時', 99],
      ['cowork-half', '半日 4 小時', 150],
      ['cowork-day', '單日', 250],
      ['cowork-5', '5 日券', 1100],
      ['cowork-10', '10 日券', 2000],
      ['cowork-month', '月租自由座', 2800],
      ['cowork-fixed', '月租固定座', 4000]
    ]
  },
  record: {
    label: '錄音／Podcast',
    plans: [
      ['record-room', '純錄音空間／1 小時', 500],
      ['record-equip', '空間＋基本設備／1 小時', 700],
      ['record-assist', '設備＋基本操作協助／1 小時', 1000],
      ['record-2h', '2 小時設備方案', 1300],
      ['record-4h', '4 小時設備方案', 2400]
    ]
  },
  studio: {
    label: '攝影／直播',
    plans: [
      ['studio-room', '純場地／1 小時', 600],
      ['studio-light', '場地＋基本燈具／1 小時', 800],
      ['studio-gear', '場地＋攝錄設備／1 小時', 1000],
      ['studio-2h', '2 小時拍攝方案', 1500],
      ['studio-4h', '4 小時半日方案', 2800]
    ]
  },
  makeup: {
    label: '化妝／更衣',
    plans: [
      ['makeup-solo', '單獨租用／1 小時', 300],
      ['makeup-addon', '搭配錄音／攝影加購／1 小時', 200]
    ]
  },
  errand: {
    label: '跑腿／配送',
    plans: [
      ['motor', '機車預約配送', null],
      ['urgent', '機車急件（預約價 +30%）', null],
      ['car', '汽車配送', null],
      ['shopping', '代買（配送費 + $80）', null],
      ['task', '純跑腿／排隊／代辦／1 小時起', 200]
    ]
  }
};

const form = document.querySelector('#bookingForm');
const serviceType = document.querySelector('#serviceType');
const servicePlan = document.querySelector('#servicePlan');
const errandFields = document.querySelector('#errandFields');
const distanceKm = document.querySelector('#distanceKm');
const waitMinutes = document.querySelector('#waitMinutes');
const extraStops = document.querySelector('#extraStops');
const estimatePrice = document.querySelector('#estimatePrice');
const estimateNote = document.querySelector('#estimateNote');
const bookingDate = document.querySelector('#bookingDate');
const bookingResult = document.querySelector('#bookingResult');
const bookingSummary = document.querySelector('#bookingSummary');
const copySummary = document.querySelector('#copySummary');
const copyStatus = document.querySelector('#copyStatus');
const submitBooking = document.querySelector('#submitBooking');
const submitStatus = document.querySelector('#submitStatus');
const bookingEndpoint = 'https://tssvabclujwpljzupuvj.supabase.co/functions/v1/booking-submit';

function formatPrice(value) {
  if (!Number.isFinite(value)) return '—';
  return `NT$ ${Math.round(value).toLocaleString('zh-TW')}`;
}

function motorDeliveryPrice(distance) {
  if (!Number.isFinite(distance) || distance < 0) return null;
  if (distance <= 3) return 99;
  if (distance <= 5) return 130;
  if (distance <= 8) return 180;
  if (distance <= 10) return 220;
  return 220 + Math.ceil(distance - 10) * 15;
}

function carDeliveryPrice(distance) {
  if (!Number.isFinite(distance) || distance < 0) return null;
  if (distance <= 3) return 220;
  return 220 + Math.ceil(distance - 3) * 20;
}

function waitingFee(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 10) return 0;
  return Math.ceil((minutes - 10) / 10) * 50;
}

function stopsFee(stops) {
  if (!Number.isFinite(stops) || stops <= 0) return 0;
  return Math.floor(stops) * 50;
}

function selectedPlan() {
  const group = serviceCatalog[serviceType.value];
  if (!group) return null;
  return group.plans.find(([id]) => id === servicePlan.value) || null;
}

function calculateEstimate() {
  const plan = selectedPlan();
  if (!plan) return { price: null, note: '選擇服務方案後顯示' };

  const [planId, , fixedPrice] = plan;

  if (serviceType.value !== 'errand') {
    const note = planId === 'studio-gear'
      ? '基本起價；實際設備需求確認後報價'
      : '試營運估價';
    return { price: fixedPrice, note };
  }

  if (planId === 'task') {
    return { price: fixedPrice, note: '1 小時起；若另需配送，配送費另計' };
  }

  const distance = Number(distanceKm.value);
  if (!Number.isFinite(distance) || distance < 0 || distanceKm.value === '') {
    return { price: null, note: '請輸入預估配送距離' };
  }

  const wait = Number(waitMinutes.value || 0);
  const stops = Number(extraStops.value || 0);
  const extras = waitingFee(wait) + stopsFee(stops);

  if (planId === 'car') {
    return {
      price: carDeliveryPrice(distance) + extras,
      note: '不含停車費、通行費與特殊物件費用'
    };
  }

  const motorBase = motorDeliveryPrice(distance);
  const serviceFee = planId === 'shopping' ? 80 : 0;
  const delivery = planId === 'urgent' ? Math.round(motorBase * 1.3) : motorBase;

  return {
    price: delivery + serviceFee + extras,
    note: planId === 'shopping'
      ? '不含商品實支；採買時間超出基本範圍時可能另計'
      : '實際價格仍依取送地點、物品與時段確認'
  };
}

function renderEstimate() {
  const result = calculateEstimate();
  estimatePrice.textContent = result.price === null ? 'NT$ —' : formatPrice(result.price);
  estimateNote.textContent = result.note;
}

function fillPlans(type) {
  servicePlan.innerHTML = '';
  const group = serviceCatalog[type];

  if (!group) {
    servicePlan.disabled = true;
    servicePlan.innerHTML = '<option value="">請先選服務</option>';
    errandFields.hidden = true;
    renderEstimate();
    return;
  }

  servicePlan.disabled = false;
  servicePlan.append(new Option('請選擇方案', ''));
  group.plans.forEach(([id, label, price]) => {
    const suffix = price === null ? '' : `｜${formatPrice(price).replace('NT$ ', '$')}`;
    servicePlan.append(new Option(`${label}${suffix}`, id));
  });

  errandFields.hidden = type !== 'errand';
  renderEstimate();
}

serviceType.addEventListener('change', () => fillPlans(serviceType.value));
servicePlan.addEventListener('change', renderEstimate);
[distanceKm, waitMinutes, extraStops].forEach((input) => input.addEventListener('input', renderEstimate));

document.querySelectorAll('[data-preset]').forEach((link) => {
  link.addEventListener('click', () => {
    const preset = link.dataset.preset;
    serviceType.value = preset;
    fillPlans(preset);
  });
});

const today = new Date();
const tzOffset = today.getTimezoneOffset() * 60000;
bookingDate.min = new Date(today - tzOffset).toISOString().slice(0, 10);

function summaryLine(label, value) {
  return value ? `${label}：${value}` : null;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!form.reportValidity()) return;

  const group = serviceCatalog[serviceType.value];
  const plan = selectedPlan();
  const estimate = calculateEstimate();
  const rows = [
    '【莓好預約站｜預約需求單】',
    summaryLine('服務', group?.label),
    summaryLine('方案', plan?.[1]),
    summaryLine('希望日期', document.querySelector('#bookingDate').value),
    summaryLine('希望時間', document.querySelector('#bookingTime').value),
    summaryLine('稱呼', document.querySelector('#customerName').value.trim()),
    summaryLine('聯絡方式', document.querySelector('#customerContact').value.trim())
  ];

  if (serviceType.value === 'errand') {
    rows.push(
      summaryLine('預估距離', distanceKm.value ? `${distanceKm.value} km` : ''),
      summaryLine('等待時間', waitMinutes.value ? `${waitMinutes.value} 分鐘` : '0 分鐘'),
      summaryLine('額外停靠', extraStops.value ? `${extraStops.value} 站` : '0 站')
    );
  }

  rows.push(
    summaryLine('目前估價', estimate.price === null ? '待確認' : formatPrice(estimate.price)),
    summaryLine('估價備註', estimate.note),
    summaryLine('需求補充', document.querySelector('#bookingNote').value.trim()),
    '',
    '※ 此需求單由 MVP 測試版產生，不代表正式預約成立。',
    '※ 正式價格、付款、可預約時段與服務細節仍需確認。'
  );

  const payload = {
    service_type: serviceType.value === 'record' ? 'recording' : serviceType.value,
    service_plan: plan?.[0] || '',
    requested_date: document.querySelector('#bookingDate').value,
    requested_time: document.querySelector('#bookingTime').value,
    customer_name: document.querySelector('#customerName').value.trim(),
    contact: document.querySelector('#customerContact').value.trim(),
    note: document.querySelector('#bookingNote').value.trim(),
    estimate_amount: estimate.price,
    estimate_label: estimate.note,
    user_agent: navigator.userAgent,
    company: document.querySelector('#company').value
  };

  submitBooking.disabled = true;
  submitBooking.textContent = '送出中…';
  submitStatus.textContent = '';

  try {
    const response = await fetch(bookingEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      throw new Error(result.message || '暫時無法送出，請稍後再試。');
    }

    rows.splice(1, 0, summaryLine('需求編號', result.request_id));
    bookingSummary.textContent = rows.filter((row) => row !== null).join('\n');
    bookingResult.hidden = false;
    copyStatus.textContent = '';
    submitStatus.textContent = '需求單已安全送出。';
    bookingResult.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    submitStatus.textContent = error instanceof Error ? error.message : '暫時無法送出，請稍後再試。';
  } finally {
    submitBooking.disabled = false;
    submitBooking.textContent = '送出預約需求單';
  }
});

copySummary.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(bookingSummary.textContent);
    copyStatus.textContent = '已複製需求單';
  } catch {
    copyStatus.textContent = '瀏覽器未允許自動複製，請手動選取上方文字';
  }
});

renderEstimate();
