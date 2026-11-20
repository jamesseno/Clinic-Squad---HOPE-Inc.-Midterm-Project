const sampleUsers = [
  { id: "u-101", name: "Avery Chen", email: "avery.chen@hope.example", role: "user", status: "active", active: "Today, 9:18 AM", added: 8 },
  { id: "u-102", name: "Morgan Patel", email: "morgan.patel@hope.example", role: "user", status: "pending", active: "Never", added: 7 },
  { id: "u-103", name: "Sam Rivera", email: "sam.rivera@hope.example", role: "user", status: "blocked", active: "Nov 12, 2026", added: 6 },
  { id: "u-104", name: "Taylor Brooks", email: "taylor.brooks@hope.example", role: "user", status: "active", active: "Yesterday", added: 5 },
  { id: "u-105", name: "Alex Morgan", email: "alex.morgan@hope.example", role: "superadmin", status: "active", active: "Today, 8:42 AM", added: 4 },
  { id: "u-106", name: "Riley Jordan", email: "riley.jordan@hope.example", role: "user", status: "active", active: "Nov 15, 2026", added: 3 },
  { id: "u-107", name: "Casey Kim", email: "casey.kim@hope.example", role: "admin", status: "active", active: "Today, 8:03 AM", added: 2 },
  { id: "u-108", name: "Jamie Singh", email: "jamie.singh@hope.example", role: "user", status: "blocked", active: "Oct 28, 2026", added: 1 },
];

const permissionModules = [
  {
    key: "customers",
    label: "Customers",
    rights: ["View customers", "Add customers", "Edit customers", "Archive customers", "Manage contacts", "Export customers", "View history"],
  },
  {
    key: "products",
    label: "Products",
    rights: ["View products", "Add products", "Edit products", "Delete products", "Manage inventory", "Adjust stock", "Export products"],
  },
  {
    key: "human-resources",
    label: "Human Resources",
    rights: ["View employees", "Add employees", "Edit employees", "Archive employees", "Manage roles", "View sensitive details", "Export employee data"],
  },
  {
    key: "sales",
    label: "Sales",
    rights: ["View sales", "Create sales", "Edit sales", "Cancel sales", "Manage discounts", "View performance", "Export sales"],
  },
  {
    key: "reports",
    label: "Reports",
    rights: ["View dashboard", "View sales reports", "View customer reports", "View product reports", "View HR reports", "Create reports", "Export reports", "Manage schedules"],
  },
];

const initialRights = Object.fromEntries(
  permissionModules.map((permissionModule) => [
    permissionModule.key,
    permissionModule.rights.map((_, index) => index < 2),
  ]),
);

let savedRights = structuredClone(initialRights);
let currentStatus = "all";
let currentPage = 1;
let pageSize = 5;
let isLoadingPreview = false;
let isEmptyPreview = false;
let toastTimer;
let selectedUser = null;

const userTableBody = document.querySelector("#user-table-body");
const searchInput = document.querySelector("#user-search");
const roleFilter = document.querySelector("#role-filter");
const sortOrder = document.querySelector("#sort-order");
const pageSizeSelect = document.querySelector("#page-size");
const emptyState = document.querySelector("#list-empty-state");
const loadingState = document.querySelector("#list-loading-state");
const table = document.querySelector(".table-wrap table");
const rightsDialog = document.querySelector("#rights-dialog");
const permissionGroups = document.querySelector("#permission-groups");
const toast = document.querySelector("#toast");

function initialsFor(name) {
  return name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}

function getVisibleUsers() {
  const search = searchInput.value.trim().toLowerCase();
  const roleContext = document.querySelector("#role-context").value;
  const scopedUsers = sampleUsers.filter((user) => {
    if (roleContext === "admin" && user.role !== "user") return false;
    if (currentStatus !== "all" && user.status !== currentStatus) return false;
    if (roleFilter.value !== "all" && user.role !== roleFilter.value) return false;
    return !search || `${user.name} ${user.email}`.toLowerCase().includes(search);
  });

  if (sortOrder.value === "recent") {
    scopedUsers.sort((first, second) => second.added - first.added);
  } else if (sortOrder.value === "role") {
    scopedUsers.sort((first, second) => first.role.localeCompare(second.role) || first.name.localeCompare(second.name));
  } else {
    scopedUsers.sort((first, second) => first.name.localeCompare(second.name));
  }
  return scopedUsers;
}

function makeStatusBadge(status) {
  const badge = document.createElement("span");
  badge.className = `account-status status-${status}`;
  badge.textContent = status[0].toUpperCase() + status.slice(1);
  return badge;
}

function makeRowAction(user) {
  const button = document.createElement("button");
  button.className = "row-action";
  button.type = "button";
  if (user.role !== "user") {
    button.textContent = "Protected";
    button.disabled = true;
    button.title = "Admin and Superadmin accounts are protected from rights changes here.";
  } else if (user.status !== "active") {
    button.textContent = "Rights unavailable";
    button.disabled = true;
    button.title = "Rights can be used after the account is active.";
  } else {
    button.textContent = "Manage rights";
    button.addEventListener("click", () => openRightsDialog(user));
  }
  return button;
}

function renderUsers() {
  const visibleUsers = getVisibleUsers();
  const pageCount = Math.max(1, Math.ceil(visibleUsers.length / pageSize));
  currentPage = Math.min(currentPage, pageCount);
  const start = (currentPage - 1) * pageSize;
  const pageUsers = visibleUsers.slice(start, start + pageSize);

  userTableBody.replaceChildren();
  for (const user of pageUsers) {
    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    const person = document.createElement("span");
    const avatar = document.createElement("span");
    const name = document.createElement("span");
    person.className = "person-cell";
    avatar.className = "person-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = initialsFor(user.name);
    name.className = "person-name";
    name.textContent = user.name;
    person.append(avatar, name);
    nameCell.append(person);

    const emailCell = document.createElement("td");
    emailCell.className = "email-cell";
    emailCell.textContent = user.email;
    const roleCell = document.createElement("td");
    const roleBadge = document.createElement("span");
    roleBadge.className = "role-badge";
    roleBadge.textContent = user.role[0].toUpperCase() + user.role.slice(1);
    roleCell.append(roleBadge);
    const statusCell = document.createElement("td");
    statusCell.append(makeStatusBadge(user.status));
    const lastActiveCell = document.createElement("td");
    lastActiveCell.className = "last-active";
    lastActiveCell.textContent = user.active;
    const actionCell = document.createElement("td");
    actionCell.className = "row-actions";
    actionCell.append(makeRowAction(user));
    row.append(nameCell, emailCell, roleCell, statusCell, lastActiveCell, actionCell);
    userTableBody.append(row);
  }

  const hasUsers = visibleUsers.length > 0 && !isEmptyPreview;
  const isEmpty = !hasUsers && !isLoadingPreview;
  table.hidden = isLoadingPreview || isEmpty;
  emptyState.hidden = !isEmpty;
  loadingState.hidden = !isLoadingPreview;
  document.querySelector("#empty-message").textContent = isEmptyPreview
    ? "This is the zero-results layout. Clear filters to return to the sample users."
    : "Try another search or clear the selected filters.";
  const displayedCount = isEmptyPreview ? 0 : visibleUsers.length;
  document.querySelector("#result-count").textContent = `${displayedCount} ${displayedCount === 1 ? "user" : "users"}`;
  document.querySelector("#pagination-summary").textContent = displayedCount
    ? `Showing ${start + 1}–${Math.min(start + pageSize, displayedCount)} of ${displayedCount} users`
    : "Showing 0 users";

  const pagination = document.querySelector("#pagination");
  pagination.replaceChildren();
  if (!isLoadingPreview && !isEmpty && pageCount > 1) {
    pagination.append(makePageButton("‹", Math.max(1, currentPage - 1), currentPage === 1, "Previous page"));
    for (let page = 1; page <= pageCount; page += 1) {
      pagination.append(makePageButton(String(page), page, false, `Page ${page}`, page === currentPage));
    }
    pagination.append(makePageButton("›", Math.min(pageCount, currentPage + 1), currentPage === pageCount, "Next page"));
  }
}

function makePageButton(label, page, disabled, accessibleName, current = false) {
  const button = document.createElement("button");
  button.className = "page-button";
  button.type = "button";
  button.textContent = label;
  button.setAttribute("aria-label", accessibleName);
  if (current) button.setAttribute("aria-current", "page");
  button.disabled = disabled;
  button.addEventListener("click", () => {
    currentPage = page;
    renderUsers();
  });
  return button;
}

function setStatus(status) {
  currentStatus = status;
  currentPage = 1;
  document.querySelectorAll(".status-tab").forEach((tab) => {
    const isSelected = tab.dataset.status === status;
    tab.classList.toggle("is-selected", isSelected);
    tab.setAttribute("aria-pressed", String(isSelected));
  });
  renderUsers();
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 3000);
}

function showView(viewName) {
  const dashboard = viewName === "dashboard";
  document.querySelector("#dashboard-view").hidden = !dashboard;
  document.querySelector("#users-view").hidden = dashboard;
  document.querySelectorAll("[data-view]").forEach((link) => {
    const isCurrent = link.dataset.view === viewName && link.classList.contains("nav-link");
    link.classList.toggle("is-current", isCurrent);
    if (link.classList.contains("nav-link")) {
      if (isCurrent) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
  });
  if (!dashboard) renderUsers();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderPermissionGroups(rightsState) {
  permissionGroups.replaceChildren();
  for (const permissionModule of permissionModules) {
    const fieldset = document.createElement("fieldset");
    fieldset.className = "permission-group";
    const legend = document.createElement("legend");
    const header = document.createElement("span");
    header.className = "module-permission-head";
    const moduleCheckbox = document.createElement("input");
    moduleCheckbox.type = "checkbox";
    moduleCheckbox.dataset.moduleSelect = permissionModule.key;
    moduleCheckbox.setAttribute("aria-label", `Select all ${permissionModule.label} rights`);
    const title = document.createElement("span");
    title.textContent = permissionModule.label;
    const count = document.createElement("span");
    count.className = "permission-count";
    count.dataset.moduleCount = permissionModule.key;
    header.append(moduleCheckbox, title, count);
    legend.append(header);
    const list = document.createElement("div");
    list.className = "permission-list";
    permissionModule.rights.forEach((right, index) => {
      const label = document.createElement("label");
      label.className = "permission-check";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.dataset.module = permissionModule.key;
      checkbox.dataset.rightIndex = String(index);
      checkbox.checked = Boolean(rightsState[permissionModule.key][index]);
      const text = document.createElement("span");
      text.textContent = right;
      label.append(checkbox, text);
      list.append(label);
    });
    fieldset.append(legend, list);
    permissionGroups.append(fieldset);
  }
  syncModuleCheckboxes();
}

function syncModuleCheckboxes() {
  for (const permissionModule of permissionModules) {
    const values = [...permissionGroups.querySelectorAll(`input[data-module="${permissionModule.key}"]`)];
    const selected = values.filter((checkbox) => checkbox.checked).length;
    const moduleCheckbox = permissionGroups.querySelector(`[data-module-select="${permissionModule.key}"]`);
    moduleCheckbox.checked = selected === values.length;
    moduleCheckbox.indeterminate = selected > 0 && selected < values.length;
    document.querySelector(`[data-module-count="${permissionModule.key}"]`).textContent = `${selected}/${values.length}`;
  }
}

function readDraftRights() {
  return Object.fromEntries(permissionModules.map((permissionModule) => [
    permissionModule.key,
    [...permissionGroups.querySelectorAll(`input[data-module="${permissionModule.key}"]`)].map((checkbox) => checkbox.checked),
  ]));
}

function setAllRights(checked) {
  permissionGroups.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.checked = checked;
  });
  syncModuleCheckboxes();
}

function openRightsDialog(user) {
  selectedUser = user;
  document.querySelector("#rights-user-context").textContent = `${user.name} · ${user.email} · Active User`;
  document.querySelector("#rights-validation").textContent = "";
  renderPermissionGroups(savedRights);
  rightsDialog.showModal();
  document.querySelector("#select-all-rights").focus();
}

document.querySelectorAll("[data-view]").forEach((control) => {
  control.addEventListener("click", (event) => {
    event.preventDefault();
    showView(control.dataset.view);
  });
});

document.querySelectorAll("[data-toast]").forEach((control) => {
  control.addEventListener("click", () => showToast(control.dataset.toast));
});

document.querySelectorAll(".status-tab").forEach((tab) => {
  tab.addEventListener("click", () => setStatus(tab.dataset.status));
});

searchInput.addEventListener("input", () => {
  currentPage = 1;
  isEmptyPreview = false;
  renderUsers();
});
roleFilter.addEventListener("change", () => {
  currentPage = 1;
  renderUsers();
});
sortOrder.addEventListener("change", renderUsers);
pageSizeSelect.addEventListener("change", () => {
  pageSize = Number(pageSizeSelect.value);
  currentPage = 1;
  renderUsers();
});

document.querySelector("#role-context").addEventListener("change", (event) => {
  const role = event.currentTarget.value;
  document.querySelector("#role-label").textContent = role === "admin" ? "Admin" : "Superadmin";
  roleFilter.value = "all";
  currentPage = 1;
  renderUsers();
});

document.querySelector("#toggle-module-access").addEventListener("click", () => {
  document.querySelector("#module-grid").hidden = true;
  document.querySelector("#toggle-module-access").hidden = true;
  document.querySelector("#no-modules-state").hidden = false;
  document.querySelector("#module-count").textContent = "00";
});
document.querySelector("#restore-module-access").addEventListener("click", () => {
  document.querySelector("#module-grid").hidden = false;
  document.querySelector("#toggle-module-access").hidden = false;
  document.querySelector("#no-modules-state").hidden = true;
  document.querySelector("#module-count").textContent = "05";
});

document.querySelector("#preview-loading").addEventListener("click", () => {
  isLoadingPreview = true;
  isEmptyPreview = false;
  renderUsers();
  window.setTimeout(() => {
    isLoadingPreview = false;
    renderUsers();
  }, 1100);
});
document.querySelector("#preview-empty").addEventListener("click", () => {
  isLoadingPreview = false;
  isEmptyPreview = true;
  renderUsers();
});
document.querySelector("#reset-list").addEventListener("click", () => {
  currentStatus = "all";
  currentPage = 1;
  isLoadingPreview = false;
  isEmptyPreview = false;
  searchInput.value = "";
  roleFilter.value = "all";
  sortOrder.value = "name";
  pageSize = 5;
  pageSizeSelect.value = "5";
  setStatus("all");
});
document.querySelector("#clear-filters").addEventListener("click", () => {
  isEmptyPreview = false;
  searchInput.value = "";
  roleFilter.value = "all";
  setStatus("all");
});

permissionGroups.addEventListener("change", (event) => {
  const target = event.target;
  if (target.matches("[data-module-select]")) {
    permissionGroups.querySelectorAll(`input[data-module="${target.dataset.moduleSelect}"]`).forEach((checkbox) => {
      checkbox.checked = target.checked;
    });
  }
  syncModuleCheckboxes();
  document.querySelector("#rights-validation").textContent = "";
});
document.querySelector("#select-all-rights").addEventListener("click", () => setAllRights(true));
document.querySelector("#clear-all-rights").addEventListener("click", () => setAllRights(false));
document.querySelector("#reset-rights").addEventListener("click", () => renderPermissionGroups(savedRights));
document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => rightsDialog.close());
});
document.querySelector("#save-rights").addEventListener("click", () => {
  if (!selectedUser || selectedUser.role !== "user" || selectedUser.status !== "active") {
    document.querySelector("#rights-validation").textContent = "Rights can only be saved for an active standard User account.";
    return;
  }
  savedRights = readDraftRights();
  rightsDialog.close();
  showToast(`Rights saved for ${selectedUser.name} in this preview only; nothing was persisted.`);
});

renderUsers();
