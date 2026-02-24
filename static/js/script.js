const resultEl     = document.getElementById("result");
const expressionEl = document.getElementById("expression");
const historyList  = document.getElementById("historyList");

let currentInput      = "0";
let expression        = "";
let operator          = null;
let justEvaluated     = false;
let waitingForOperand = false; // ← FIX: new flag

// ─── Render ────────────────────────────────────────────────
function render(value, isError = false) {
  resultEl.classList.remove("small", "error", "pulse");
  if (isError) resultEl.classList.add("error");
  else if (String(value).length > 10) resultEl.classList.add("small");
  void resultEl.offsetWidth;
  resultEl.classList.add("pulse");
  resultEl.textContent = value;
}

function setExpression(expr) {
  expressionEl.textContent = expr;
}

// ─── History ───────────────────────────────────────────────
let history = [];

function addHistory(expr, result) {
  history.unshift({ expr, result });
  if (history.length > 6) history.pop();
  renderHistory();
}

function renderHistory() {
  historyList.innerHTML = history
    .map(h => `<li onclick="loadHistory('${h.result}')">${h.expr} = ${h.result}</li>`)
    .join("");
}

function loadHistory(val) {
  currentInput      = val;
  expression        = "";
  justEvaluated     = true;
  waitingForOperand = false;
  render(val);
  setExpression("");
}

// ─── API call to Flask ─────────────────────────────────────
async function calculate(expr) {
  try {
    const res  = await fetch("/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expression: expr })
    });
    const data = await res.json();
    return data;
  } catch {
    return { result: "Error", status: "error" };
  }
}

// ─── Highlight active operator ─────────────────────────────
function setActiveOperator(op) {
  document.querySelectorAll(".btn.operator").forEach(b => b.classList.remove("active"));
  if (op) {
    document.querySelectorAll(".btn.operator").forEach(b => {
      if (b.dataset.value === op) b.classList.add("active");
    });
  }
}

// ─── Button Handlers ───────────────────────────────────────
function handleDigit(value) {
  setActiveOperator(null);

  // ← FIX: reset input if operator was just pressed OR after equals
  if (waitingForOperand || justEvaluated) {
    currentInput      = value;
    waitingForOperand = false;
    justEvaluated     = false;
    if (justEvaluated) expression = "";
  } else {
    currentInput = currentInput === "0" ? value : currentInput + value;
  }

  render(currentInput);
}

function handleDot() {
  // ← FIX: start fresh if waiting for operand
  if (waitingForOperand) {
    currentInput      = "0.";
    waitingForOperand = false;
    justEvaluated     = false;
  } else if (justEvaluated) {
    currentInput  = "0.";
    justEvaluated = false;
  } else if (!currentInput.includes(".")) {
    currentInput += ".";
  }
  render(currentInput);
}

function handleOperator(op) {
  setActiveOperator(op);
  justEvaluated     = false;
  waitingForOperand = true; // ← FIX: next digit starts fresh

  if (expression && operator) {
    const full = `${expression}${currentInput}`;
    calculate(full).then(data => {
      if (data.status === "success") {
        expression   = `${data.result}${op}`;
        currentInput = data.result;
        render(currentInput);
        setExpression(expression);
      }
    });
  } else {
    expression = `${currentInput}${op}`;
    setExpression(expression);
  }
  operator = op;
}

function handleEquals() {
  setActiveOperator(null);
  if (!expression) return;

  const full = `${expression}${currentInput}`;
  const displayExpr = full
    .replace(/\*/g, "×")
    .replace(/\//g, "÷")
    .replace(/-/g, "−");

  calculate(full).then(data => {
    setExpression(`${displayExpr} =`);
    if (data.status === "success") {
      addHistory(displayExpr, data.result);
      render(data.result);
    } else {
      render(data.result, true);
    }
    currentInput      = data.result;
    expression        = "";
    operator          = null;
    justEvaluated     = true;
    waitingForOperand = false; // ← FIX: reset after equals
  });
}

function handleClear() {
  currentInput      = "0";
  expression        = "";
  operator          = null;
  justEvaluated     = false;
  waitingForOperand = false; // ← FIX: reset on clear
  setActiveOperator(null);
  setExpression("");
  render("0");
}

function handleSign() {
  if (currentInput === "0") return;
  currentInput = currentInput.startsWith("-")
    ? currentInput.slice(1)
    : `-${currentInput}`;
  render(currentInput);
}

function handlePercent() {
  currentInput = String(parseFloat(currentInput) / 100);
  render(currentInput);
}

// ─── Ripple Effect ─────────────────────────────────────────
function createRipple(btn, e) {
  const rect   = btn.getBoundingClientRect();
  const ripple = document.createElement("span");
  ripple.classList.add("ripple");
  ripple.style.left = `${e.clientX - rect.left - 40}px`;
  ripple.style.top  = `${e.clientY - rect.top - 40}px`;
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 500);
}

// ─── Click Events ──────────────────────────────────────────
document.querySelectorAll(".btn").forEach(btn => {
  btn.addEventListener("click", (e) => {
    createRipple(btn, e);
    const { action, value } = btn.dataset;
    if (action === "digit")    handleDigit(value);
    if (action === "operator") handleOperator(value);
    if (action === "equals")   handleEquals();
    if (action === "clear")    handleClear();
    if (action === "sign")     handleSign();
    if (action === "percent")  handlePercent();
    if (action === "dot")      handleDot();
  });
});

// ─── Keyboard Support ─────────────────────────────────────
document.addEventListener("keydown", (e) => {
  if ("0123456789".includes(e.key))               handleDigit(e.key);
  else if (e.key === ".")                          handleDot();
  else if (["+", "-", "*", "/"].includes(e.key))  handleOperator(e.key);
  else if (e.key === "Enter" || e.key === "=")     handleEquals();
  else if (e.key === "Escape")                     handleClear();
  else if (e.key === "Backspace") {
    if (waitingForOperand) return;
    currentInput = currentInput.length > 1 ? currentInput.slice(0, -1) : "0";
    render(currentInput);
  }
});
