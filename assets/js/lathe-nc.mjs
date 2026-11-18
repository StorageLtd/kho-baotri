// Use integer micrometres so pass limits and shoulder positions remain exact.
function dimension(input, label, minimum = 1) {
  const value = Math.round(Number(input) * 1000);
  if (String(input ?? "").trim() === "" || !Number.isFinite(value) ||
      Math.abs(Number(input) * 1000 - value) > 1e-7 || value < minimum || value > 1_000_000) {
    throw new Error(label + " phải nằm trong khoảng " + minimum / 1000 + "–1000 mm, tối đa 3 chữ số thập phân.");
  }
  return value;
}

function ncNumber(value) {
  return (value / 1000).toFixed(3);
}

export function generateLatheNc(input, rows) {
  const stock = dimension(input.stock, "Ø phôi");
  const face = dimension(input.face, "Z mặt phôi", 0);
  const stickout = dimension(input.stickout, "Chiều dài nhô");
  const jawGap = dimension(input.jawGap, "Khe hở tới chấu");
  const depth = dimension(input.depth, "Chiều sâu thô");
  const finish = dimension(input.finish, "Lượng dư tinh", 0);
  const retractX = stock + 2 * dimension(input.radialClearance, "Khe hở X");
  const leadZ = face + dimension(input.axialClearance, "Khe hở Z");
  const feed = dimension(input.feed, "F thô");
  const finishFeed = dimension(input.finishFeed, "F tinh");
  const rpm = Number(input.rpm);
  const program = Number(input.program);
  if (!Number.isInteger(rpm) || rpm < 1 || rpm > 99999) throw new Error("Nhập số vòng/phút nguyên dương, tối đa 99999.");
  if (!Number.isInteger(program) || program < 1 || program > 7999) throw new Error("Nhập số O từ 1 đến 7999.");
  if (!/^[0-9]{4}$/.test(input.tool) || input.tool.startsWith("00") || input.tool.endsWith("00")) {
    throw new Error("Nhập 4 chữ số T, gồm số dao và offset khác 00.");
  }
  if (!["M03", "M04"].includes(input.rotation)) throw new Error("Chọn chiều quay theo gá dao.");
  if (rows.length < 1 || rows.length > 8) throw new Error("Nhập từ 1 đến 8 bậc.");

  let length = 0;
  let previous = 0;
  const steps = rows.map((row, i) => {
    const diameter = dimension(row.diameter, "Ø bậc " + (i + 1));
    const width = dimension(row.length, "Chiều dài bậc " + (i + 1));
    if (diameter <= previous) throw new Error("Đường kính các bậc phải tăng dần.");
    if (diameter + 2 * finish >= stock) throw new Error("Ø bậc cộng lượng dư tinh phải nhỏ hơn Ø phôi.");
    previous = diameter;
    length += width;
    return { diameter, z: -length };
  });
  if (length + jawGap > stickout) throw new Error("Biên dạng vượt giới hạn chiều dài nhô sau khi trừ khe hở tới chấu.");

  const id = String(program).padStart(4, "0");
  const lines = [
    "%", "O" + id, "(REVIEW IN SIMULATION BEFORE RUNNING)",
    "(START AT A VERIFIED CLEAR TOOL CHANGE POSITION)",
    "(G54 Z0 FINISHED FRONT FACE - X DIAMETER)",
    "G21 G18 G40 G80 G99", "G54", "T" + input.tool,
    "G00 X" + ncNumber(retractX), "G00 Z" + ncNumber(leadZ),
    "G97 S" + rpm + " " + input.rotation
  ];
  let roughPasses = 0;
  function cut(diameter, z, f) {
    lines.push(
      "G00 X" + ncNumber(diameter),
      "G01 Z" + ncNumber(z) + " F" + ncNumber(f),
      "G01 X" + ncNumber(retractX),
      "G00 Z" + ncNumber(leadZ)
    );
  }
  steps.forEach(({ diameter, z }, i) => {
    lines.push("(STEP " + (i + 1) + ")");
    const roughDiameter = diameter + 2 * finish;
    const passCount = Math.ceil((stock - roughDiameter) / (2 * depth));
    roughPasses += passCount;
    if (roughPasses > 500) throw new Error("Số lượt thô vượt 500. Kiểm tra kích thước hoặc chiều sâu cắt.");
    for (let pass = 1; pass <= passCount; pass += 1) {
      const target = Math.max(roughDiameter, stock - pass * 2 * depth);
      cut(target, z, finish === 0 && pass === passCount ? finishFeed : feed);
    }
    if (finish > 0) cut(diameter, z, finishFeed);
  });
  lines.push("M05", "M30", "%");
  return { code: lines.join("\r\n") + "\r\n", name: "O" + id + ".NC", steps, stock, length, roughPasses };
}

export function mountLatheNc(page) {
  const form = page.querySelector("form");
  const list = page.querySelector("#latheNcSteps");
  const add = page.querySelector("#latheNcAdd");
  const canvas = page.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const output = page.querySelector("pre");
  const summary = page.querySelector("#latheNcSummary");
  const status = page.querySelector("#latheNcStatus");
  const download = page.querySelector("#latheNcDownload");
  let result;

  function clear() {
    result = null;
    output.textContent = "";
    summary.textContent = "Tính chương trình để xem biên dạng.";
    status.textContent = "";
    status.dataset.error = "false";
    download.disabled = true;
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  }

  function updateRows() {
    [...list.children].forEach((row, i) => {
      row.querySelector("[data-diameter]").textContent = "Ø bậc " + (i + 1) + " (mm)";
      row.querySelector("button").disabled = list.children.length === 1;
      row.querySelector("button").setAttribute("aria-label", "Xóa bậc " + (i + 1));
    });
    add.disabled = list.children.length >= 8;
  }

  function addRow(diameter = "", length = "") {
    const row = document.createElement("div");
    row.className = "lathe-nc-step";
    row.innerHTML = '<label><span data-diameter></span><input name="diameter" type="number" step=".001" required></label>' +
      '<label>Chiều dài (mm)<input name="length" type="number" step=".001" required></label>' +
      '<button class="btn" type="button">Xóa</button>';
    row.querySelector('[name="diameter"]').value = diameter;
    row.querySelector('[name="length"]').value = length;
    row.querySelector("button").addEventListener("click", () => {
      row.remove();
      updateRows();
      clear();
    });
    list.append(row);
    updateRows();
    return row;
  }

  function draw(profile) {
    if (!ctx) return;
    const scale = Math.min(550 / profile.length, 135 / (profile.stock / 2));
    const right = 596;
    const base = 180;
    const left = right - profile.length * scale;
    const stockTop = base - profile.stock / 2 * scale;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#627a70";
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(left, stockTop, right - left, base - stockTop);
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(right, base);
    let lastX = right;
    for (const step of profile.steps) {
      const y = base - step.diameter / 2 * scale;
      ctx.lineTo(lastX, y);
      lastX = right + step.z * scale;
      ctx.lineTo(lastX, y);
    }
    ctx.lineTo(left, base);
    ctx.closePath();
    ctx.fillStyle = "#c7eadc";
    ctx.fill();
    ctx.strokeStyle = "#126846";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#18362a";
    ctx.font = "15px system-ui";
    ctx.fillText("Z0", right - 11, base + 24);
    ctx.fillText("Z " + ncNumber(-profile.length), Math.max(8, left - 30), base + 24);
    ctx.fillText("Ø phôi " + ncNumber(profile.stock), 18, 26);
  }

  function reset() {
    form.reset();
    list.replaceChildren();
    addRow(35, 20);
    addRow(42, 15);
    clear();
  }

  add.addEventListener("click", () => {
    if (list.children.length >= 8) return;
    clear();
    addRow().querySelector("input").focus();
  });
  form.addEventListener("input", clear);
  form.addEventListener("change", clear);
  form.addEventListener("submit", event => {
    event.preventDefault();
    clear();
    const data = new FormData(form);
    const rows = [...list.children].map(row => ({
      diameter: row.querySelector('[name="diameter"]').value,
      length: row.querySelector('[name="length"]').value
    }));
    try {
      result = generateLatheNc(Object.fromEntries(data), rows);
      output.textContent = result.code;
      summary.textContent = rows.length + " bậc · Chiều dài " + ncNumber(result.length) +
        " mm · " + result.roughPasses + " lượt xuống đường kính";
      draw(result);
      download.disabled = false;
      status.textContent = "Đã tạo " + result.name;
    } catch (error) {
      clear();
      status.dataset.error = "true";
      status.textContent = error.message;
    }
  });
  download.addEventListener("click", () => {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([result.code], { type: "application/octet-stream" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = result.name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  reset();
  return reset;
}
