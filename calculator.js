"use strict";

const TravelPay = (() => {
  const dayMs = 86_400_000;
  const dailyRate = 25_000;
  const effectiveDate = "2026-10-02";
  const lodgingLimits = { seoul: 100_000, metro: 80_000, other: 70_000 };

  function calendarDay(value) {
    const date = new Date(value + "T00:00:00Z");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(+date) ||
        date.toISOString().slice(0, 10) !== value) {
      throw new Error("올바른 출발일과 복귀일을 입력하세요.");
    }
    return +date / dayMs;
  }

  function isoDay(day) {
    return new Date(day * dayMs).toISOString().slice(0, 10);
  }

  function tripDates(start, end) {
    const first = calendarDay(start);
    const last = calendarDay(end);
    if (last < first) throw new Error("복귀일은 출발일과 같거나 그 이후여야 합니다.");
    return {
      first, last, days: last - first + 1,
      settlement: isoDay(last + 14),
      lodgingSettlement: isoDay(last + 7),
      earlier: start < effectiveDate,
    };
  }

  function whole(value, label) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(label + "에는 0 이상의 정수를 입력하세요.");
    }
    return value;
  }

  function localPay(dates, minutes, vehicle) {
    whole(minutes, "출장 소요시간");
    if (!minutes || minutes > dates.days * 24 * 60) {
      throw new Error("출장 기간 안의 실제 소요시간을 입력하세요.");
    }
    const base = minutes >= 240 ? 20_000 : 10_000;
    const deduction = vehicle === "assigned" ? base : vehicle === "official" ? 10_000 : 0;
    return { base, deduction, total: base - deduction };
  }

  function awayPay(dates, input) {
    const { grade, fares, lodgings, daily } = input;
    if (!["1", "2", "actual"].includes(grade)) throw new Error("여비 지급 구분을 선택하세요.");
    if (lodgings.length > dates.days - 1) throw new Error("입력한 숙박 박수가 출장 기간을 초과합니다.");
    const fare = fares.reduce((total, item) =>
      total + (item.method === "official" ? 0 : whole(item.cost, "운임")), 0);
    let lodging = 0;
    let lodgingExtra = 0;
    for (const item of lodgings) {
      const cost = whole(item.cost, "숙박비");
      const limit = lodgingLimits[item.region];
      if (!limit) throw new Error("숙박 지역을 선택하세요.");
      const base = grade === "2" ? Math.min(cost, limit) : cost;
      lodging += base;
      if (grade === "2" && item.exception) {
        lodgingExtra += Math.min(cost - base, limit * 0.3);
      }
    }

    let allowance = grade === "actual" ? whole(input.actualAllowance, "일비 실지출") : dates.days * dailyRate;
    let meals = grade === "actual" ? whole(input.actualMeals, "식비 실지출") : dates.days * dailyRate;
    for (const item of grade === "actual" ? [] : daily) {
      const { reduced, stayRate, excludesMeal, confirmedAllowance } = item;
      const adjusted = reduced && stayRate
        ? whole(confirmedAllowance, "중복 감액일의 기관 확인 일비")
        : dailyRate * (reduced ? 0.5 : 1 - stayRate);
      if (reduced && stayRate && adjusted > dailyRate / 2) {
        throw new Error("중복 감액일의 기관 확인 일비는 12,500원 이하여야 합니다.");
      }
      allowance += adjusted - dailyRate;
      if (excludesMeal) meals -= dailyRate;
    }
    const mileage = grade === "actual" ? 0 : Math.min(
      whole(input.mileageExtra, "추가 일비"), whole(input.mileageSaved, "항공운임 절감액"), dates.days * dailyRate / 2,
    );
    const subtotal = fare + lodging + lodgingExtra + allowance + meals + mileage;
    const deduction = Math.min(whole(input.deduction, "여비 차감액"), subtotal);
    return { fare, lodging, lodgingExtra, allowance, meals, mileage, deduction, total: subtotal - deduction };
  }

  return { tripDates, isoDay, localPay, awayPay };
})();

if (typeof module === "object") module.exports = TravelPay;
