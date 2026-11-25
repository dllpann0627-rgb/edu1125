"use strict";

const TravelExcel = (() => {
  const spreadsheet = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  const documentRelationships = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const packageRelationships = "http://schemas.openxmlformats.org/package/2006/relationships";
  const mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  function escapeXml(value) {
    return String(value).replace(/[&<>"']/g, (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]);
  }

  function excelDate(value) {
    if (value < "1900-01-01") return value;
    // Excel's 1900 calendar reserves an extra day for the fictional February 29.
    const offset = value < "1900-03-01" ? 25_568 : 25_569;
    return Date.parse(value + "T00:00:00Z") / 86_400_000 + offset;
  }

  function sheetXml(data) {
    const rows = [];
    const merges = [];
    function add(label, value, style = 0) {
      const row = rows.length + 1;
      const cell = (column, content, cellStyle) => {
        const address = column + row;
        if (typeof content === "number") {
          return `<c r="${address}" s="${cellStyle}"><v>${content}</v></c>`;
        }
        return `<c r="${address}" s="${cellStyle}" t="inlineStr"><is><t>${escapeXml(content)}</t></is></c>`;
      };
      const wide = value === undefined;
      if (wide) merges.push(`<mergeCell ref="A${row}:B${row}"/>`);
      const height = style === 1 ? 30 : style === 6 ? 34 : 22;
      rows.push(`<row r="${row}" ht="${height}" customHeight="1">` +
        cell("A", label, style === 1 || style === 2 || style === 6 ? style : 0) +
        (wide ? "" : cell("B", value, style)) + "</row>");
    }

    add("국내 출장 여비 계산 결과", undefined, 1);
    add("출장 유형", data.type);
    add("출발일", excelDate(data.start), 3);
    add("복귀일", excelDate(data.end), 3);
    add("출장일수 (일)", data.days);
    add("청구액 (원)", data.total, 5);
    add("항목별 내역", "금액 (원)", 2);
    for (const [label, amount] of data.lines) add(label, amount, 4);
    if (data.deadlines.length) {
      add("정산 구분", "신청 기한", 2);
      for (const [label, date] of data.deadlines) add(label, excelDate(date), 3);
    }
    for (const note of data.notes) add(note, undefined, 6);

    return `<worksheet xmlns="${spreadsheet}">
      <cols><col min="1" max="1" width="38" customWidth="1"/><col min="2" max="2" width="25" customWidth="1"/></cols>
      <sheetData>${rows.join("")}</sheetData>
      <mergeCells count="${merges.length}">${merges.join("")}</mergeCells>
    </worksheet>`;
  }

  function stylesXml() {
    return `<styleSheet xmlns="${spreadsheet}">
      <numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/></numFmts>
      <fonts count="3">
        <font><sz val="11"/><name val="Malgun Gothic"/></font>
        <font><b/><sz val="16"/><color rgb="FFFFFFFF"/><name val="Malgun Gothic"/></font>
        <font><b/><sz val="11"/><color rgb="FF17674E"/><name val="Malgun Gothic"/></font>
      </fonts>
      <fills count="4">
        <fill><patternFill patternType="none"/></fill>
        <fill><patternFill patternType="gray125"/></fill>
        <fill><patternFill patternType="solid"><fgColor rgb="FF112F2B"/><bgColor indexed="64"/></patternFill></fill>
        <fill><patternFill patternType="solid"><fgColor rgb="FFEAF5EE"/><bgColor indexed="64"/></patternFill></fill>
      </fills>
      <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
      <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
      <cellXfs count="7">
        <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
        <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
        <xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
        <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
        <xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
        <xf numFmtId="3" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1"/>
        <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf>
      </cellXfs>
      <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
    </styleSheet>`;
  }

  function createWorkbook(data) {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="xml" ContentType="application/xml"/>
      <Override PartName="/xl/workbook.xml" ContentType="${mime}.main+xml"/>
      <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
      <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
    </Types>`);
    zip.file("_rels/.rels", `<Relationships xmlns="${packageRelationships}">
      <Relationship Id="rId1" Type="${documentRelationships}/officeDocument" Target="xl/workbook.xml"/>
    </Relationships>`);
    zip.file("xl/workbook.xml", `<workbook xmlns="${spreadsheet}" xmlns:r="${documentRelationships}">
      <sheets><sheet name="출장 여비" sheetId="1" r:id="rId1"/></sheets>
    </workbook>`);
    zip.file("xl/_rels/workbook.xml.rels", `<Relationships xmlns="${packageRelationships}">
      <Relationship Id="rId1" Type="${documentRelationships}/worksheet" Target="worksheets/sheet1.xml"/>
      <Relationship Id="rId2" Type="${documentRelationships}/styles" Target="styles.xml"/>
    </Relationships>`);
    zip.file("xl/styles.xml", stylesXml());
    zip.file("xl/worksheets/sheet1.xml", sheetXml(data));
    return zip.generateAsync({ type: "blob", compression: "DEFLATE", mimeType: mime });
  }

  return { createWorkbook };
})();
