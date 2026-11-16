import { describe, expect, test } from "bun:test";
import { coverage, filterByForm, parseList, sortFilings, toFiling, toFilings, type Submissions } from "./filings";

const fixture = (name: string): Promise<Submissions> =>
  Bun.file(`${import.meta.dir}/../../../fixtures/${name}`).json();

const aapl = await fixture("AAPL.json");
const spot = await fixture("SPOT.json");

test("makes one filing per row of filings.recent", () => {
  expect(toFilings(aapl)).toHaveLength(1002);
  expect(toFilings(spot)).toHaveLength(390);
});

test("builds each filing from the same index in every column, in SEC order", () => {
  expect(toFilings(aapl)[0]).toEqual({
    accessionNumber: "0001140361-26-043484",
    form: "4",
    filingDate: "2026-11-12",
    reportDate: "2026-11-10",
    description: "FORM 4",
    url: "https://www.sec.gov/Archives/edgar/data/320193/000114036126043484/xslF345X06/form4.xml",
    acceptanceDateTime: "2026-11-12T23:58:20.000Z",
  });
});

test("returns null for an empty reportDate or description", () => {
  const filing = toFilings(aapl).find((f) => f.accessionNumber === "0001354457-26-001062");

  expect(filing?.reportDate).toBeNull();
  expect(filing?.description).toBeNull();
});

test("gives paper filings a url too", () => {
  const filing = toFilings(aapl).find((f) => f.accessionNumber === "9999999997-17-006550");

  expect(filing?.url).toBe(
    "https://www.sec.gov/Archives/edgar/data/320193/999999999717006550/9999999997-17-006550.paper",
  );
});

test("toFiling keeps only the response fields", () => {
  const filing = toFiling(toFilings(aapl)[0]);

  expect(Object.keys(filing).sort()).toEqual(
    ["accessionNumber", "description", "filingDate", "form", "reportDate", "url"],
  );
});

describe("parseList", () => {
  test("splits on commas, trims, uppercases, drops empties and duplicates", () => {
    expect(parseList(" 10-k , 10-K,,8-K ")).toEqual(["10-K", "8-K"]);
  });

  test("keeps spaces and slashes inside a value", () => {
    expect(parseList("def 14a,10-K/A")).toEqual(["DEF 14A", "10-K/A"]);
  });

  test("returns an empty list for nothing", () => {
    expect(parseList(undefined)).toEqual([]);
    expect(parseList("")).toEqual([]);
    expect(parseList(" , ")).toEqual([]);
  });
});

describe("filterByForm", () => {
  test("keeps only the exact forms, ignoring case", () => {
    const forms = filterByForm(toFilings(aapl), ["10-K", "SCHEDULE 13G"]).map((f) => f.form);

    expect(new Set(forms)).toEqual(new Set(["10-K", "SCHEDULE 13G"]));
  });

  test("10-K doesn't match 10-K/A", () => {
    const rows = [{ ...toFilings(aapl)[0], form: "10-K/A" }];

    expect(filterByForm(rows, ["10-K"])).toEqual([]);
  });

  test("no forms means no filter", () => {
    expect(filterByForm(toFilings(aapl), [])).toHaveLength(1002);
  });
});

describe("sortFilings", () => {
  // Six Form 4s SPOT filed on 2026-11-03: accession order and acceptance order differ, and two share a time
  const sameDay = toFilings(spot).filter((f) => f.filingDate === "2026-11-03");

  test("same filingDate: by acceptanceDateTime, then accessionNumber", () => {
    expect(sortFilings(sameDay, "asc").map((f) => f.accessionNumber)).toEqual([
      "0001140361-26-041800",
      "0001140361-26-041802",
      "0001140361-26-041799",
      "0001140361-26-041803",
      "0001140361-26-041801",
      "0001140361-26-041804",
    ]);
  });

  test("desc is the exact reverse of asc", () => {
    const rows = toFilings(spot);

    expect(sortFilings(rows, "desc")).toEqual(sortFilings(rows, "asc").reverse());
  });

  test("sorts by filingDate first", () => {
    const dates = sortFilings(toFilings(aapl), "asc").map((f) => f.filingDate);

    expect(dates).toEqual([...dates].sort());
  });

  test("doesn't change the input", () => {
    const rows = toFilings(spot);
    const copy = [...rows];
    sortFilings(rows, "asc");

    expect(rows).toEqual(copy);
  });
});

describe("coverage", () => {
  test("oldest and newest filingDate, incomplete when there are older files", () => {
    expect(coverage(aapl, toFilings(aapl))).toEqual({ from: "2015-10-07", to: "2026-11-12", complete: false });
  });

  test("complete when filings.files is empty", () => {
    expect(coverage(spot, toFilings(spot))).toEqual({ from: "2015-06-12", to: "2026-11-13", complete: true });
  });
});
