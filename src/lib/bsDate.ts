import NepaliDateConverter from "nepali-date-converter";
const NepaliDate = NepaliDateConverter as unknown as new (...args: [Date] | [number, number, number]) => {
  format: (fmt: string) => string;
  toJsDate: () => Date;
};

// AD (JS Date) -> BS string "YYYY/MM/DD"
export function adToBs(date: Date | null | undefined): string | null {
  if (!date) return null;
  try {
    const nd = new NepaliDate(date);
    return nd.format("YYYY/MM/DD");
  } catch {
    return null;
  }
}

// BS string "YYYY/MM/DD" or "YYYY-MM-DD" -> AD Date
export function bsToAd(bs: string | null | undefined): Date | null {
  if (!bs) return null;
  const parts = bs.split(/[/-]/).map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  const [year, month, day] = parts;
  try {
    const nd = new NepaliDate(year, month - 1, day);
    return nd.toJsDate();
  } catch {
    return null;
  }
}

export function bsMonthName(date: Date | null | undefined): string | null {
  if (!date) return null;
  try {
    const nd = new NepaliDate(date);
    return nd.format("MMMM");
  } catch {
    return null;
  }
}

const WEEK_ORDINALS = ["First", "Second", "Third", "Fourth"];

export function bsWeekLabel(date: Date | null | undefined): string | null {
  if (!date) return null;
  try {
    const nd = new NepaliDate(date);
    const month = nd.format("MMMM");
    const day = parseInt(nd.format("DD"), 10);
    const weekIndex = Math.min(3, Math.floor((day - 1) / 7));
    return `${month} ${WEEK_ORDINALS[weekIndex]} Week`;
  } catch {
    return null;
  }
}
