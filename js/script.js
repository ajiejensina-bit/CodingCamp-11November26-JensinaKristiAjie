const KEYS = {
  transactions: "ebv_transactions",
  limit: "ebv_limit",
  sort: "ebv_sort",
};

const COLORS = { Food: "rgb(234, 170, 33)", Transport: "#3498db", Fun: "#d21e1e" };
const CATEGORIES = Object.keys(COLORS);

//state
let transactions = loadJSON(KEYS.transactions, []);
let spendingLimit = Number(localStorage.getItem(KEYS.limit)) || 0;
let sortMode = localStorage.getItem(KEYS.sort) || "newest";
let selectedMonth = monthKey(new Date());
let chart = null;

//elements
const nameInput = document.getElementById("item-name");
const amountInput = document.getElementById("item-amount");
const categorySelect = document.getElementById("item-category");
const formError = document.getElementById("form-error");
const addBtn = document.getElementById("add-btn");

const totalEl = document.getElementById("total-balance");
const balanceCard = document.getElementById("balance-card");
const limitInput = document.getElementById("limit-input");
const limitWarning = document.getElementById("limit-warning");

const sortSelect = document.getElementById("sort-select");
const listEl = document.getElementById("transaction-list");

const monthSelect = document.getElementById("month-select");
const monthTotal = document.getElementById("month-total");
const monthCount = document.getElementById("month-count");
const monthCategories = document.getElementById("month-categories");

const canvas = document.getElementById("chart");
const chartEmpty = document.getElementById("chart-empty");

//helpers
function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function saveTransactions() {
  localStorage.setItem(KEYS.transactions, JSON.stringify(transactions));
}

function formatMoney(value) {
  return "$" + value.toFixed(2);
}

function getTotal() {
  return transactions.reduce((sum, t) => sum + t.amount, 0);
}

function sumByCategory(list, category) {
  return list.filter((t) => t.category === category).reduce((sum, t) => sum + t.amount, 0);
}

//month key
function monthKey(date) {
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
}

function monthLabel(key) {
  const parts = key.split("-");
  return new Date(Number(parts[0]), Number(parts[1]) - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function getDate(t) {
  return t.date ? new Date(t.date) : new Date(t.id);
}

function showMessage(el, message) {
  el.textContent = message;
  el.style.display = "block";
}

function hideMessage(el) {
  el.style.display = "none";
}

function getSortedTransactions() {
  const list = transactions.slice();
  if (sortMode === "amount-high") return list.sort((a, b) => b.amount - a.amount);
  if (sortMode === "amount-low") return list.sort((a, b) => a.amount - b.amount);
  if (sortMode === "category") {
    return list.sort((a, b) => a.category.localeCompare(b.category) || b.id - a.id);
  }
  return list.sort((a, b) => b.id - a.id); //newest
}

//render
function renderBalance() {
  const total = getTotal();
  totalEl.textContent = formatMoney(total);

  const over = spendingLimit > 0 && total > spendingLimit;
  balanceCard.classList.toggle("over-limit", over);
  if (over) {
    showMessage(
      limitWarning,
      "You are " + formatMoney(total - spendingLimit) + " over your " + formatMoney(spendingLimit) + " limit."
    );
  } else {
    hideMessage(limitWarning);
  }
}

function renderMonthly() {
  const keys = new Set(transactions.map((t) => monthKey(getDate(t))));
  keys.add(monthKey(new Date()));
  const sortedKeys = Array.from(keys).sort().reverse();
  if (!sortedKeys.includes(selectedMonth)) selectedMonth = sortedKeys[0];

  monthSelect.innerHTML = "";
  sortedKeys.forEach((key) => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = monthLabel(key);
    monthSelect.appendChild(opt);
  });
  monthSelect.value = selectedMonth;

  const items = transactions.filter((t) => monthKey(getDate(t)) === selectedMonth);
  const total = items.reduce((sum, t) => sum + t.amount, 0);

  monthTotal.textContent = formatMoney(total);
  monthCount.textContent =
    items.length === 0
      ? "No transactions in " + monthLabel(selectedMonth) + "."
      : items.length + (items.length === 1 ? " transaction" : " transactions");

  monthCategories.innerHTML = "";
  if (items.length === 0) return;

  CATEGORIES.forEach((cat) => {
    const catTotal = sumByCategory(items, cat);
    if (catTotal === 0) return;
    const percent = (catTotal / total) * 100;

    const row = document.createElement("div");
    row.className = "month-row";

    const top = document.createElement("div");
    top.className = "month-row-top";
    const label = document.createElement("span");
    label.textContent = cat + " (" + percent.toFixed(0) + "%)";
    const value = document.createElement("span");
    value.textContent = formatMoney(catTotal);
    top.append(label, value);

    const bar = document.createElement("div");
    bar.className = "bar";
    const fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.width = percent + "%";
    fill.style.background = COLORS[cat];
    bar.appendChild(fill);

    row.append(top, bar);
    monthCategories.appendChild(row);
  });
}

function renderList() {
  listEl.innerHTML = "";

  if (transactions.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No transactions yet. Add your first one above.";
    listEl.appendChild(empty);
    return;
  }

  getSortedTransactions().forEach((t) => {
    const item = document.createElement("div");
    item.className = "item";
    if (spendingLimit > 0 && t.amount > spendingLimit) item.classList.add("over-limit");

    const info = document.createElement("div");

    const name = document.createElement("strong");
    name.textContent = t.name;

    const amount = document.createElement("div");
    amount.className = "item-amount";
    amount.textContent = formatMoney(t.amount);

    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = t.category;
    tag.style.background = COLORS[t.category] || "#999999";

    const date = document.createElement("div");
    date.className = "item-date";
    date.textContent = getDate(t).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    info.append(name, amount, tag, date);

    const del = document.createElement("button");
    del.type = "button";
    del.className = "delete-btn";
    del.textContent = "Delete";
    del.addEventListener("click", () => deleteTransaction(t.id));

    item.append(info, del);
    listEl.appendChild(item);
  });
}

function renderChart() {
  const totals = CATEGORIES.map((cat) => sumByCategory(transactions, cat));
  const hasData = totals.some((v) => v > 0);

  canvas.style.display = hasData ? "block" : "none";
  chartEmpty.style.display = hasData ? "none" : "block";

  if (!hasData) {
    if (chart) {
      chart.destroy();
      chart = null;
    }
    return;
  }

  if (chart) {
    chart.data.datasets[0].data = totals;
    chart.update();
    return;
  }

  chart = new Chart(canvas, {
    type: "pie",
    data: {
      labels: CATEGORIES,
      datasets: [{ data: totals, backgroundColor: CATEGORIES.map((c) => COLORS[c]) }],
    },
    options: {
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: { label: (ctx) => " " + ctx.label + ": " + formatMoney(ctx.parsed) },
        },
      },
    },
  });
}

function render() {
  renderBalance();
  renderMonthly();
  renderList();
  renderChart();
}

//action
function addTransaction() {
  const name = nameInput.value.trim();
  const amount = parseFloat(amountInput.value);
  const category = categorySelect.value;

  if (!name || amountInput.value === "" || !category) {
    showMessage(formError, "Please fill in the item name, amount, and category.");
    return;
  }
  if (isNaN(amount) || amount <= 0) {
    showMessage(formError, "Amount must be a number greater than 0.");
    return;
  }

  hideMessage(formError);
  const now = new Date();
  transactions.push({ id: now.getTime(), name, amount, category, date: now.toISOString() });
  saveTransactions();

  selectedMonth = monthKey(now);
  nameInput.value = "";
  amountInput.value = "";
  categorySelect.value = "";
  nameInput.focus();
  render();
}

function deleteTransaction(id) {
  transactions = transactions.filter((t) => t.id !== id);
  saveTransactions();
  render();
}

//events
addBtn.addEventListener("click", addTransaction);

[nameInput, amountInput].forEach((input) => {
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addTransaction();
  });
});

sortSelect.addEventListener("change", () => {
  sortMode = sortSelect.value;
  localStorage.setItem(KEYS.sort, sortMode);
  renderList();
});

monthSelect.addEventListener("change", () => {
  selectedMonth = monthSelect.value;
  renderMonthly();
});

limitInput.addEventListener("input", () => {
  spendingLimit = parseFloat(limitInput.value) || 0;
  localStorage.setItem(KEYS.limit, String(spendingLimit));
  renderBalance();
  renderList();
});

//init
sortSelect.value = sortMode;
limitInput.value = spendingLimit > 0 ? spendingLimit : "";
render();