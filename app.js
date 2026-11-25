"use strict";

const form = document.querySelector("#trip-form");
const byId = (id) => document.getElementById(id);
const result = byId("result");
const emptyResult = result.innerHTML;
const resultActions = byId("result-actions");
const exportButton = byId("export-result");
let exportData = null;
const number = (id) => byId(id).valueAsNumber;
const money = new Intl.NumberFormat("ko-KR");
const won = (amount) => money.format(amount) + "원";
const koreanDate = (value) => {
  const [year, month, day] = value.split("-").map(Number);
  return year + "년 " + month + "월 " + day + "일";
};
const fareLabels = {
  rail: "철도", sea: "선박", air: "항공", bus: "버스 및 기타 자동차",
  car: "자가용 · 철도 또는 버스 기준", necessary: "부득이한 자가용 · 연료비·통행료 등",
  official: "공용 차량·선박·항공기",
};

function datesFromForm() {
  return TravelPay.tripDates(byId("departure").value, byId("return-date").value);
}

function updateDates() {
  const start = byId("departure");
  const end = byId("return-date");
  end.min = start.value;
  let hint = "출발일과 복귀일을 모두 포함합니다.";
  if (start.value && end.value) {
    try {
      const dates = datesFromForm();
      hint = "출장 기간 " + dates.days + "일";
      if (dates.earlier) hint += " · 2026년 10월 2일 이전 출장일이 있으므로 당시 기준을 확인하세요.";
    } catch (error) {
      hint = error.message;
    }
  }
  byId("date-hint").textContent = hint;
  if (byId("daily-options").open) updateDailyRows();
}

function updateType() {
  const isLocal = form.querySelector("[name=trip-type]:checked").value === "local";
  byId("local-fields").hidden = byId("local-fields").disabled = !isLocal;
  byId("away-fields").hidden = byId("away-fields").disabled = isLocal;
}

function updateGrade() {
  const grade = byId("grade").value;
  const actual = grade === "actual";
  byId("actual-fields").hidden = byId("actual-fields").disabled = !actual;
  for (const id of ["daily-options", "mileage-options"]) {
    const details = byId(id);
    details.hidden = actual;
    for (const field of details.querySelectorAll("input, select")) {
      field.disabled = actual || Boolean(field.closest(".overlap[hidden]"));
    }
  }
  byId("grade-hint").textContent = grade
    ? (grade === "2" ? "철도 일반실·선박 2등급 기준입니다." : "철도 특실·선박 1등급 기준입니다.") +
      " 할인 가능한 운임·숙박비는 할인 요금을 입력하세요."
    : "제1호·제2호의 적용 대상은 규정 별표 1에 따릅니다.";
  for (const row of byId("lodgings").children) {
    row.querySelector(".exception").hidden = grade !== "2";
  }
}

function createExpenseRow(container, markup) {
  const row = document.createElement("div");
  row.className = "entry";
  row.innerHTML = markup + '<button class="remove" type="button" aria-label="이 내역 삭제">삭제</button>';
  row.querySelector("button").addEventListener("click", () => {
    row.remove();
    markDirty();
    byId(container === "fares" ? "add-fare" : "add-lodging").focus();
  });
  byId(container).append(row);
  row.querySelector("select").focus();
  markDirty();
  return row;
}

byId("add-fare").addEventListener("click", () => {
  const row = createExpenseRow("fares", '<div class="grid"><label>교통수단<select>' +
    Object.entries(fareLabels).map(([value, label]) => '<option value="' + value + '">' + label + "</option>").join("") +
    '</select></label><label>지급 기준 운임 (원)<input type="number" min="0" step="1" required></label></div>' +
    '<p class="hint fare-hint" hidden></p>');
  const select = row.querySelector("select");
  const amount = row.querySelector("input");
  const hint = row.querySelector(".fare-hint");
  select.addEventListener("change", () => {
    amount.disabled = select.value === "official";
    hint.textContent = {
      car: "자가용의 실제 지출 대신 철도 또는 버스 기준 운임을 입력하세요.",
      necessary: "기관에서 인정한 연료비·통행료 등을 입력하세요.",
      official: "공용 교통수단 이용 구간은 운임이 0원입니다. 공무용 차량 이용일의 일비 조건도 확인하세요.",
      air: "기관 기준에 맞는 운임을 입력하세요. 공적 마일리지로 절약한 금액은 아래 일비 조건에서 입력할 수 있습니다.",
    }[select.value] || "";
    hint.hidden = !hint.textContent;
  });
});

byId("add-lodging").addEventListener("click", () => {
  const row = createExpenseRow("lodgings",
    '<div class="grid"><label>숙박 지역<select><option value="seoul">서울특별시</option>' +
    '<option value="metro">광역시</option><option value="other">그 밖의 지역</option></select></label>' +
    '<label>1박 실제 지출 (원)<input type="number" min="0" step="1" required></label></div>' +
    '<label class="check exception"><input type="checkbox">부득이한 상한 초과 지출로 추가 지급 신청</label>');
  row.querySelector(".exception").hidden = byId("grade").value !== "2";
});

const dayRows = new Map();

function updateDailyRows() {
  let dates;
  try {
    dates = datesFromForm();
  } catch {
    byId("daily-fields").textContent = "출장 기간을 먼저 입력하세요.";
    return;
  }
  const list = byId("daily-fields");
  const rows = document.createDocumentFragment();
  for (const key of dayRows.keys()) {
    if (key < dates.first || key > dates.last) dayRows.delete(key);
  }
  for (let day = dates.first; day <= dates.last; day++) {
    if (!dayRows.has(day)) {
      const row = document.createElement("fieldset");
      row.className = "entry daily";
      row.innerHTML = '<legend>' + koreanDate(TravelPay.isoDay(day)) + '</legend>' +
        '<label class="check"><input type="checkbox" data-reduced>공무용 차량 이용 등 일비 50% 대상</label>' +
        '<label class="check"><input type="checkbox" data-meal>선박·항공여행 중 별도 식비가 필요 없는 날</label>' +
        '<label>동일 지역 장기 체재 감액<select><option value="0">해당 없음</option>' +
        '<option value="0.1">15일 초과 구간 · 10%</option><option value="0.2">30일 초과 구간 · 20%</option>' +
        '<option value="0.3">60일 초과 구간 · 30%</option></select></label>' +
        '<label class="overlap" hidden>두 감액이 겹치는 날의 기관 확인 일비 (원)' +
        '<input type="number" min="0" max="12500" step="1" disabled required></label>';
      row.addEventListener("change", () => {
        const overlap = row.querySelector("[data-reduced]").checked && Number(row.querySelector("select").value) > 0;
        row.querySelector(".overlap").hidden = !overlap;
        row.querySelector("input[type=number]").disabled = !overlap;
      });
      dayRows.set(day, row);
    }
    rows.append(dayRows.get(day));
  }
  const note = document.createElement("p");
  note.className = "hint";
  note.textContent = "장기 체재는 도착 다음 날부터 세고, 체재 중 다른 지역 출장 기간은 뺍니다.";
  list.replaceChildren(note, rows);
}

byId("daily-options").addEventListener("toggle", () => {
  if (byId("daily-options").open) updateDailyRows();
});

function markDirty() {
  result.innerHTML = emptyResult;
  resultActions.hidden = true;
  exportData = null;
  byId("export-error").hidden = true;
  byId("error").hidden = true;
}

byId("print-result").addEventListener("click", () => {
  if (exportData) window.print();
});

exportButton.addEventListener("click", async () => {
  const current = exportData;
  if (!current) return;
  exportButton.disabled = true;
  const error = byId("export-error");
  error.hidden = true;
  try {
    const file = await TravelExcel.createWorkbook(current);
    if (current !== exportData) return;
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "출장여비_" + current.start + "_" + current.end + ".xlsx";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  } catch {
    if (current === exportData) {
      error.textContent = "엑셀 파일을 저장하지 못했습니다. 다시 시도해 주세요.";
      error.hidden = false;
    }
  } finally {
    exportButton.disabled = false;
  }
});

form.addEventListener("input", (event) => {
  markDirty();
  if (event.target.id === "departure" || event.target.id === "return-date") updateDates();
  if (event.target.name === "trip-type") updateType();
  if (event.target.id === "grade") updateGrade();
});

form.addEventListener("invalid", (event) => {
  const details = event.target.closest("details");
  if (details && !details.hidden) details.open = true;
}, true);

function awayInput(dates) {
  return {
    grade: byId("grade").value,
    fares: [...byId("fares").children].map((row) => ({
      method: row.querySelector("select").value,
      cost: row.querySelector("input").valueAsNumber,
    })),
    lodgings: [...byId("lodgings").children].map((row) => ({
      region: row.querySelector("select").value,
      cost: row.querySelector("input[type=number]").valueAsNumber,
      exception: row.querySelector("input[type=checkbox]").checked,
    })),
    daily: [...dayRows].filter(([day]) => day >= dates.first && day <= dates.last).map(([, row]) => ({
      reduced: row.querySelector("[data-reduced]").checked,
      excludesMeal: row.querySelector("[data-meal]").checked,
      stayRate: Number(row.querySelector("select").value),
      confirmedAllowance: row.querySelector("input[type=number]").valueAsNumber,
    })),
    actualAllowance: number("actual-allowance"),
    actualMeals: number("actual-meals"),
    mileageSaved: number("mileage-saved") || 0,
    mileageExtra: number("mileage-extra") || 0,
    deduction: number("deduction") || 0,
  };
}

function showResult(dates, local, item) {
  const lines = local ? [["근무지 내 출장 기본액", item.base]] : [
    ["운임", item.fare], ["일비", item.allowance], ["숙박비", item.lodging], ["식비", item.meals],
  ];
  if (item.lodgingExtra) lines.push(["숙박비 추가 신청액", item.lodgingExtra]);
  if (item.mileage) lines.push(["공적 항공마일리지 추가 일비", item.mileage]);
  if (item.deduction) lines.push(["차감액", -item.deduction]);
  const deadlines = local ? [] : [["운임·숙박비 일반 정산", dates.settlement]];
  if (item.lodgingExtra) deadlines.push(["숙박비 초과분 추가 신청", dates.lodgingSettlement]);
  const localGuidance = "근무지 내 출장 정산 일정은 소속 기관에 확인하세요.";
  const deadlineGuidance = "기한은 복귀일 다음 날부터 달력일로 계산했습니다. 휴일 등에 따른 기한 적용은 소속 기관에 확인하세요.";
  const notes = dates.earlier ? ["이 계산은 2026년 10월 2일 시행본 기준입니다. 그 이전 출장에는 당시 규정을 확인하세요."] : [];
  const start = TravelPay.isoDay(dates.first);
  const end = TravelPay.isoDay(dates.last);
  const type = local ? "근무지 내" : "근무지 외";
  const period = start === end ? koreanDate(start) : koreanDate(start) + " ~ " + koreanDate(end);
  exportData = {
    start, end, type, days: dates.days, total: item.total, lines, deadlines,
    notes: [local ? localGuidance : deadlineGuidance, ...notes],
  };
  result.innerHTML = '<p class="total"><span>청구액</span><strong>' + won(item.total) + '</strong></p>' +
    '<p class="trip-summary">' + type + " · " + dates.days + "일 출장</p>" +
    '<p class="trip-summary">출장 기간 ' + period + "</p>" +
    "<dl>" + lines.map(([label, amount]) => "<div><dt>" + label + "</dt><dd>" + won(amount) + "</dd></div>").join("") +
    '</dl><div class="deadlines">' + (local ? "<p>" + localGuidance + "</p>" : deadlines.map(([label, date]) =>
      "<p>" + label + "<strong>" + koreanDate(date) + "</strong></p>").join("")) + "</div>" +
    (local ? notes : [deadlineGuidance, ...notes]).map((note) => '<p class="result-note">' + note + "</p>").join("");
  resultActions.hidden = false;
  const heading = byId("result-heading");
  heading.focus({ preventScroll: true });
  const bounds = heading.getBoundingClientRect();
  if (bounds.top < 0 || bounds.bottom > window.innerHeight) {
    result.closest(".result-card").scrollIntoView({ block: "start" });
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  markDirty();
  try {
    const dates = datesFromForm();
    const local = form.querySelector("[name=trip-type]:checked").value === "local";
    const item = local
      ? TravelPay.localPay(dates, number("hours") * 60 + number("minutes"), byId("vehicle").value)
      : TravelPay.awayPay(dates, awayInput(dates));
    showResult(dates, local, item);
  } catch (error) {
    byId("error").textContent = error.message;
    byId("error").hidden = false;
  }
});

form.addEventListener("reset", () => {
  for (const id of ["fares", "lodgings", "daily-fields"]) byId(id).replaceChildren();
  for (const details of form.querySelectorAll("details")) details.open = false;
  dayRows.clear();
  markDirty();
  setTimeout(() => {
    updateDates();
    updateType();
    updateGrade();
    byId("departure").focus();
  }, 0);
});

updateDates();
updateType();
updateGrade();
