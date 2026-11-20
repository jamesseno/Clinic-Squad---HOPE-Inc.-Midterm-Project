/*
 * S1-UIX-04 hi-fi prototype interactions.
 * Presentation only: no authentication, authorization, persistence, or audit writes.
 * All "success" feedback is in-memory and is documented as such in the handoff notes.
 */

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
  { key: "customers", label: "Customers", rights: ["View customers", "Add customers", "Edit customers", "Archive customers", "Manage contacts", "Export customers", "View history"] },
  { key: "products", label: "Products", rights: ["View products", "Add products", "Edit products", "Delete products", "Manage inventory", "Adjust stock", "Export products"] },
  { key: "human-resources", label: "Human Resources", rights: ["View employees", "Add employees", "Edit employees", "Archive employees", "Manage roles", "View sensitive details", "Export employee data"] },
  { key: "sales", label: "Sales", rights: ["View sales", "Create sales", "Edit sales", "Cancel sales", "Manage discounts", "View performance", "Export sales"] },
  { key: "reports", label: "Reports", rights: ["View dashboard", "View sales reports", "View customer reports", "View product reports", "View HR reports", "Create reports", "Export reports", "Manage schedules"] },
];

const initialRights = Object.fromEntries(
  permissionModules.map((module) => [module.key, module.rights.map((_, index) => index < 2)]),
);

const state = {
  view: "login",
  role: "superadmin",
  modulesVisible: true,
  list: {
    status: "all",
    page: 1,
    pageSize: 5,
    search: "",
    roleFilter: "all",
    sort: "name",
    loading: false,
    empty: false,
  },
  rights: {
    saved: structuredClone(initialRights),
    draft: structuredClone(initialRights),
    selectedUser: null,
  },
};

const appShell = document.querySelector("#app-shell");
const rightsDialog = document.querySelector("#rights-dialog");
const permissionGroups = document.querySelector("#permission-groups");
const toast = document.querySelector("#toast");
let toastTimer;

/* ------------------------------------------------------------- small helpers */

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.toggle("is-error", isError);
  toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 3600);
}

function setFieldError(inputId, message) {
  const input = document.getElementById(inputId);
  const error = document.getElementById(`${inputId}-error`);
  if (!input || !error) return;
  if (message) {
    input.setAttribute("aria-invalid", "true");
    error.textContent = message;
    error.hidden = false;
  } else {
    input.removeAttribute("aria-invalid");
    error.textContent = "";
    error.hidden = true;
  }
}

function showFeedback(id, message, kind = "error") {
  const feedback = document.getElementById(id);
  feedback.textContent = message;
  feedback.classList.toggle("is-error", kind === "error");
  feedback.classList.toggle("is-success", kind === "success");
  feedback.hidden = !message;
}

function setButtonLoading(button, loading) {
  button.classList.toggle("is-loading", loading);
  button.disabled = loading;
}

function clearAuthForm(formName) {
  const form = document.getElementById(`${formName}-form`);
  form.reset();
  form.querySelectorAll(".field-error").forEach((error) => {
    error.textContent = "";
    error.hidden = true;
  });
  form.querySelectorAll("[aria-invalid]").forEach((input) => input.removeAttribute("aria-invalid"));
  showFeedback(`${formName}-feedback`, "");
  setButtonLoading(form.querySelector('button[type="submit"]'), false);
}

/* ------------------------------------------------------------- view routing */

function showView(viewName) {
  const authViews = ["login", "register"];
  const appViews = ["mainpage", "users", "rights"];
  if (![...authViews, ...appViews].includes(viewName)) return;

  if (viewName === "users" || viewName === "rights") {
    if (state.role === "user") {
      showToast("A standard User cannot open User management in this prototype.", true);
      viewName = "mainpage";
    }
  }

  if (rightsDialog.open && viewName !== "rights") rightsDialog.close();

  state.view = viewName;
  const isAuth = authViews.includes(viewName);

  document.querySelectorAll("[data-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.panel !== viewName && !(isAuth === false && panel.dataset.panel === "mainpage");
  });
  appShell.hidden = isAuth;

  const pageName = viewName === "rights" ? "users" : viewName;
  document.querySelectorAll("[data-page]").forEach((page) => {
    page.hidden = page.dataset.page !== pageName;
  });

  document.querySelectorAll(".preview-bar__views [data-preview-view]").forEach((button) => {
    if (button.dataset.previewView === viewName) button.setAttribute("aria-current", "true");
    else button.removeAttribute("aria-current");
  });
  document.querySelectorAll(".side-link[data-preview-view]").forEach((link) => {
    const isCurrent = link.dataset.previewView === pageName;
    link.classList.toggle("is-current", isCurrent);
    if (isCurrent) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });

  document.querySelector("#breadcrumb").innerHTML = pageName === "users"
    ? 'Workspace <span aria-hidden="true">/</span> <strong>Administration</strong> <span aria-hidden="true">/</span> <strong>User management</strong>'
    : 'Workspace <span aria-hidden="true">/</span> <strong>Overview</strong>';

  applyState(viewName, "default");

  if (viewName === "rights") openRightsDialog(selectedActiveUser());
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function applyState(viewName, stateName) {
  const group = document.querySelector(`.state-group[data-state-for="${viewName}"]`);
  if (group) {
    group.querySelectorAll("[data-preview-state]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.previewState === stateName));
    });
  }

  if (viewName === "login") applyLoginState(stateName);
  if (viewName === "register") applyRegisterState(stateName);
  if (viewName === "mainpage") applyMainState(stateName);
  if (viewName === "users") applyListState(stateName);
  if (viewName === "rights") applyRightsState(stateName);
}

/* ----------------------------------------------------- login / register UI */

function applyLoginState(stateName) {
  clearAuthForm("login");
  const email = document.querySelector("#login-email");
  const password = document.querySelector("#login-password");

  if (stateName === "invalid") {
    email.value = "jordan@hope.example";
    password.value = "wrongpass";
    setFieldError("login-password", "Email or password is incorrect.");
    showFeedback("login-feedback", "Sign-in failed. Check your credentials and try again.");
  }
  if (stateName === "pending") {
    email.value = "pending@hope.example";
    password.value = "welcome123";
    showFeedback("login-feedback", "This account is pending approval. An administrator must approve it before sign-in.");
  }
  if (stateName === "blocked") {
    email.value = "blocked@hope.example";
    password.value = "welcome123";
    showFeedback("login-feedback", "This account is blocked. Contact an administrator to restore access.");
  }
  if (stateName === "loading") {
    email.value = "jordan@hope.example";
    password.value = "welcome123";
    setButtonLoading(document.querySelector('#login-form button[type="submit"]'), true);
  }
}

function applyRegisterState(stateName) {
  clearAuthForm("register");
  const form = document.querySelector("#register-form");

  if (stateName === "validation") {
    form.elements.namedItem("name").value = "";
    form.elements.namedItem("email").value = "not-an-email";
    form.elements.namedItem("password").value = "short";
    form.elements.namedItem("confirmPassword").value = "different";
    setFieldError("register-name", "Enter your full name.");
    setFieldError("register-email", "Enter a valid email address.");
    setFieldError("register-password", "Use at least 8 characters.");
    setFieldError("register-confirm", "Passwords do not match.");
    setFieldError("register-terms", "You must accept the Terms and Privacy Policy.");
    showFeedback("register-feedback", "Please check the highlighted fields and try again.");
  }
  if (stateName === "duplicate") {
    form.elements.namedItem("name").value = "Jordan Lee";
    form.elements.namedItem("email").value = "taken@hope.example";
    form.elements.namedItem("password").value = "welcome123";
    form.elements.namedItem("confirmPassword").value = "welcome123";
    form.elements.namedItem("terms").checked = true;
    setFieldError("register-email", "An account with this email already exists.");
    showFeedback("register-feedback", "That email is already registered. Try signing in instead.");
  }
  if (stateName === "loading") {
    form.elements.namedItem("name").value = "Jordan Lee";
    form.elements.namedItem("email").value = "jordan.lee@hope.example";
    form.elements.namedItem("password").value = "welcome123";
    form.elements.namedItem("confirmPassword").value = "welcome123";
    form.elements.namedItem("terms").checked = true;
    setButtonLoading(form.querySelector('button[type="submit"]'), true);
  }
  if (stateName === "success") {
    showFeedback("register-feedback", "Request received. Your account is pending; an administrator must approve it before you can sign in.", "success");
  }
}

function validateLogin() {
  const email = document.querySelector("#login-email");
  const password = document.querySelector("#login-password");
  setFieldError("login-email", email.value.trim() ? "" : "Enter your email address or username.");
  setFieldError("login-password", password.value ? "" : "Enter your password.");
  return email.value.trim() && password.value;
}

function validateRegister() {
  const form = document.querySelector("#register-form");
  const name = form.elements.namedItem("name");
  const email = form.elements.namedItem("email");
  const password = form.elements.namedItem("password");
  const confirm = form.elements.namedItem("confirmPassword");
  const terms = form.elements.namedItem("terms");
  let valid = true;

  const nameError = name.value.trim() ? "" : "Enter your full name.";
  const emailError = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()) ? "" : "Enter a valid email address.";
  const passwordError = password.value.length >= 8 ? "" : "Use at least 8 characters.";
  const confirmError = confirm.value && confirm.value !== password.value ? "Passwords do not match." : (confirm.value ? "" : "Re-enter your password.");
  const termsError = terms.checked ? "" : "You must accept the Terms and Privacy Policy.";

  setFieldError("register-name", nameError);
  setFieldError("register-email", emailError);
  setFieldError("register-password", passwordError);
  setFieldError("register-confirm", confirmError);
  setFieldError("register-terms", termsError);
  if (nameError || emailError || passwordError || confirmError || termsError) valid = false;
  return valid;
}

document.querySelector("#login-form").addEventListener("submit", (event) => {
  event.preventDefault();
  showFeedback("login-feedback", "");
  if (!validateLogin()) {
    showFeedback("login-feedback", "Please check the highlighted fields and try again.");
    return;
  }
  const email = document.querySelector("#login-email").value.trim().toLowerCase();
  const password = document.querySelector("#login-password").value;
  const button = event.currentTarget.querySelector('button[type="submit"]');
  setButtonLoading(button, true);

  window.setTimeout(() => {
    setButtonLoading(button, false);
    if (email.includes("pending")) {
      showFeedback("login-feedback", "This account is pending approval. An administrator must approve it before sign-in.");
    } else if (email.includes("blocked")) {
      showFeedback("login-feedback", "This account is blocked. Contact an administrator to restore access.");
    } else if (password === "wrongpass") {
      setFieldError("login-password", "Email or password is incorrect.");
      showFeedback("login-feedback", "Sign-in failed. Check your credentials and try again.");
    } else {
      showFeedback("login-feedback", "Preview only: sign-in succeeded. Use the preview bar to open the Main page.", "success");
    }
  }, 850);
});

document.querySelector("#register-form").addEventListener("submit", (event) => {
  event.preventDefault();
  showFeedback("register-feedback", "");
  if (!validateRegister()) {
    showFeedback("register-feedback", "Please check the highlighted fields and try again.");
    return;
  }
  const form = event.currentTarget;
  const email = form.elements.namedItem("email").value.trim().toLowerCase();
  const button = form.querySelector('button[type="submit"]');
  setButtonLoading(button, true);

  window.setTimeout(() => {
    setButtonLoading(button, false);
    if (email === "taken@hope.example") {
      setFieldError("register-email", "An account with this email already exists.");
      showFeedback("register-feedback", "That email is already registered. Try signing in instead.");
      return;
    }
    showFeedback("register-feedback", "Request received. Your account is pending; an administrator must approve it before you can sign in.", "success");
  }, 850);
});

document.querySelectorAll(".auth-form input").forEach((input) => {
  input.addEventListener("input", () => {
    const error = document.getElementById(`${input.id}-error`);
    if (error) setFieldError(input.id, "");
    showFeedback(input.closest("form").querySelector(".form-feedback").id, "");
    if (input.name === "password" || input.name === "confirmPassword") {
      const form = input.closest("form");
      const password = form.elements.namedItem("password");
      const confirm = form.elements.namedItem("confirmPassword");
      if (password && confirm && confirm.value) {
        setFieldError("register-confirm", confirm.value !== password.value ? "Passwords do not match." : "");
      }
    }
  });
});

document.querySelectorAll("[data-toggle-password]").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.togglePassword);
    const reveal = input.type === "password";
    input.type = reveal ? "text" : "password";
    button.setAttribute("aria-label", reveal ? "Hide password" : "Show password");
    button.setAttribute("aria-pressed", String(reveal));
  });
});

/* -------------------------------------------------------------- main page */

function applyMainState(stateName) {
  state.modulesVisible = stateName !== "no-modules";
  const count = state.modulesVisible ? "05" : "00";
  document.querySelector("#module-count").textContent = count;
  document.querySelector("#module-grid").hidden = !state.modulesVisible;
  document.querySelector("#no-modules-state").hidden = state.modulesVisible;
  document.querySelectorAll("#side-modules [data-module]").forEach((link) => {
    link.hidden = !state.modulesVisible;
  });
}

/* ------------------------------------------------------- user management */

function selectedActiveUser() {
  return sampleUsers.find((user) => user.role === "user" && user.status === "active") || sampleUsers[0];
}

function scopedUsers() {
  return sampleUsers.filter((user) => state.role !== "user" && (state.role !== "admin" || user.role === "user"));
}

function visibleUsers() {
  const { status, roleFilter, search, sort } = state.list;
  const term = search.trim().toLowerCase();
  const users = scopedUsers().filter((user) => {
    if (status !== "all" && user.status !== status) return false;
    if (roleFilter !== "all" && user.role !== roleFilter) return false;
    return !term || `${user.name} ${user.email}`.toLowerCase().includes(term);
  });
  if (sort === "recent") users.sort((a, b) => b.added - a.added);
  else if (sort === "role") users.sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name));
  else users.sort((a, b) => a.name.localeCompare(b.name));
  return users;
}

function initialsFor(name) {
  return name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}

function makeAction(label, action, userId, variant = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `row-action ${variant}`.trim();
  button.textContent = label;
  button.dataset.action = action;
  button.dataset.userId = userId;
  return button;
}

function makeRowActions(user) {
  const cell = document.createElement("td");
  cell.className = "row-actions";
  if (user.role !== "user") {
    const protectedButton = makeAction("Protected", "protected", user.id);
    protectedButton.disabled = true;
    protectedButton.title = "Admin and Superadmin accounts are protected from rights changes here.";
    cell.append(protectedButton);
    return cell;
  }
  if (user.status === "pending") {
    if (state.role === "superadmin") cell.append(makeAction("Approve", "approve", user.id));
    cell.append(makeAction("Rights unavailable", "protected", user.id));
  } else if (user.status === "blocked") {
    if (state.role === "superadmin") cell.append(makeAction("Unblock", "unblock", user.id));
    cell.append(makeAction("Rights unavailable", "protected", user.id));
  } else {
    cell.append(makeAction("Edit", "edit", user.id));
    if (state.role === "superadmin") cell.append(makeAction("Block", "block", user.id, "row-action--danger"));
    cell.append(makeAction("Manage rights", "rights", user.id));
  }
  cell.querySelectorAll('[data-action="protected"]').forEach((button) => {
    button.disabled = true;
    button.title = "Rights can only be managed for an active standard User account.";
  });
  return cell;
}

function renderUsers() {
  const users = visibleUsers();
  const { page, pageSize, loading, empty } = state.list;
  const pageCount = Math.max(1, Math.ceil(users.length / pageSize));
  state.list.page = Math.min(page, pageCount);
  const start = (state.list.page - 1) * pageSize;
  const pageUsers = users.slice(start, start + pageSize);

  const body = document.querySelector("#user-table-body");
  body.replaceChildren();
  pageUsers.forEach((user) => {
    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    const person = document.createElement("span");
    person.className = "person-cell";
    const avatar = document.createElement("span");
    avatar.className = "person-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = initialsFor(user.name);
    const name = document.createElement("span");
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
    const status = document.createElement("span");
    status.className = `account-status status-${user.status}`;
    status.textContent = user.status[0].toUpperCase() + user.status.slice(1);
    statusCell.append(status);
    const activeCell = document.createElement("td");
    activeCell.className = "last-active";
    activeCell.textContent = user.active;
    row.append(nameCell, emailCell, roleCell, statusCell, activeCell, makeRowActions(user));
    body.append(row);
  });

  const isEmpty = loading ? false : empty || users.length === 0;
  document.querySelector(".table-wrap table").hidden = loading || isEmpty;
  document.querySelector("#list-empty-state").hidden = !isEmpty;
  document.querySelector("#list-loading-state").hidden = !loading;
  document.querySelector("#empty-message").textContent = empty
    ? "This is the zero-results layout. Reset the list to return to the sample users."
    : "Try another search or clear the selected filters.";

  const count = empty ? 0 : users.length;
  document.querySelector("#result-count").textContent = `${count} ${count === 1 ? "user" : "users"}`;
  document.querySelector("#pagination-summary").textContent = count
    ? `Showing ${start + 1}–${Math.min(start + pageSize, count)} of ${count} users`
    : "Showing 0 users";

  const pagination = document.querySelector("#pagination");
  pagination.replaceChildren();
  if (!loading && !isEmpty && pageCount > 1) {
    pagination.append(makePageButton("‹", Math.max(1, state.list.page - 1), state.list.page === 1, "Previous page"));
    for (let index = 1; index <= pageCount; index += 1) {
      pagination.append(makePageButton(String(index), index, false, `Page ${index}`, index === state.list.page));
    }
    pagination.append(makePageButton("›", Math.min(pageCount, state.list.page + 1), state.list.page === pageCount, "Next page"));
  }

  const counts = { all: 0, pending: 0, active: 0, blocked: 0 };
  scopedUsers().forEach((user) => {
    counts.all += 1;
    counts[user.status] += 1;
  });
  document.querySelectorAll(".status-tab").forEach((tab) => {
    tab.querySelector("span").textContent = counts[tab.dataset.status];
    const selected = tab.dataset.status === state.list.status;
    tab.classList.toggle("is-selected", selected);
    tab.setAttribute("aria-pressed", String(selected));
  });
}

function makePageButton(label, page, disabled, accessibleName, current = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "page-button";
  button.textContent = label;
  button.setAttribute("aria-label", accessibleName);
  if (current) button.setAttribute("aria-current", "page");
  button.disabled = disabled;
  button.addEventListener("click", () => {
    state.list.page = page;
    renderUsers();
  });
  return button;
}

function applyListState(stateName) {
  state.list.loading = stateName === "loading";
  state.list.empty = stateName === "empty";
  if (stateName === "default") {
    state.list.search = "";
    state.list.roleFilter = "all";
    state.list.sort = "name";
    state.list.status = "all";
    state.list.page = 1;
    state.list.pageSize = 5;
    document.querySelector("#user-search").value = "";
    document.querySelector("#role-filter").value = "all";
    document.querySelector("#sort-order").value = "name";
    document.querySelector("#page-size").value = "5";
  }
  renderUsers();
}

document.querySelector("#user-table-body").addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button || button.disabled) return;
  const user = sampleUsers.find((entry) => entry.id === button.dataset.userId);
  if (!user) return;

  if (button.dataset.action === "approve") {
    user.status = "active";
    showToast(`${user.name} approved. The connected app would persist this and enforce role scope.`);
    renderUsers();
  }
  if (button.dataset.action === "block") {
    user.status = "blocked";
    showToast(`${user.name} blocked. Active sessions would be invalidated.`);
    renderUsers();
  }
  if (button.dataset.action === "unblock") {
    user.status = "active";
    showToast(`${user.name} unblocked in this preview.`);
    renderUsers();
  }
  if (button.dataset.action === "edit") {
    showToast(`Edit User is a Sprint 1 destination; this preview only shows the entry point.`);
  }
  if (button.dataset.action === "rights") openRightsDialog(user);
});

document.querySelectorAll(".status-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    state.list.status = tab.dataset.status;
    state.list.page = 1;
    state.list.empty = false;
    renderUsers();
  });
});

document.querySelector("#user-search").addEventListener("input", (event) => {
  state.list.search = event.target.value;
  state.list.page = 1;
  state.list.empty = false;
  renderUsers();
});

document.querySelector("#role-filter").addEventListener("change", (event) => {
  state.list.roleFilter = event.target.value;
  state.list.page = 1;
  renderUsers();
});

document.querySelector("#sort-order").addEventListener("change", (event) => {
  state.list.sort = event.target.value;
  renderUsers();
});

document.querySelector("#page-size").addEventListener("change", (event) => {
  state.list.pageSize = Number(event.target.value);
  state.list.page = 1;
  renderUsers();
});

document.querySelector("#reset-list").addEventListener("click", () => applyListState("default"));
document.querySelector("#clear-filters").addEventListener("click", () => applyListState("default"));

/* ----------------------------------------------------------- rights dialog */

function readDraft() {
  return Object.fromEntries(permissionModules.map((module) => [
    module.key,
    [...permissionGroups.querySelectorAll(`input[data-module="${module.key}"]`)].map((box) => box.checked),
  ]));
}

function syncModuleCheckboxes() {
  permissionModules.forEach((module) => {
    const boxes = [...permissionGroups.querySelectorAll(`input[data-module="${module.key}"]`)];
    const selected = boxes.filter((box) => box.checked).length;
    const header = permissionGroups.querySelector(`[data-module-select="${module.key}"]`);
    header.checked = selected === boxes.length;
    header.indeterminate = selected > 0 && selected < boxes.length;
    permissionGroups.querySelector(`[data-module-count="${module.key}"]`).textContent = `${selected}/${boxes.length}`;
  });
}

function renderPermissionGroups(rights) {
  permissionGroups.replaceChildren();
  permissionModules.forEach((module) => {
    const group = document.createElement("fieldset");
    group.className = "permission-group";
    const legend = document.createElement("legend");
    const head = document.createElement("span");
    head.className = "module-permission-head";
    const moduleBox = document.createElement("input");
    moduleBox.type = "checkbox";
    moduleBox.dataset.moduleSelect = module.key;
    moduleBox.setAttribute("aria-label", `Select all ${module.label} rights`);
    const title = document.createElement("span");
    title.textContent = module.label;
    const count = document.createElement("span");
    count.className = "permission-count";
    count.dataset.moduleCount = module.key;
    head.append(moduleBox, title, count);
    legend.append(head);

    const list = document.createElement("div");
    list.className = "permission-list";
    module.rights.forEach((right, index) => {
      const label = document.createElement("label");
      label.className = "permission-check";
      const box = document.createElement("input");
      box.type = "checkbox";
      box.dataset.module = module.key;
      box.dataset.rightIndex = String(index);
      box.checked = Boolean(rights[module.key][index]);
      const text = document.createElement("span");
      text.textContent = right;
      label.append(box, text);
      list.append(label);
    });
    group.append(legend, list);
    permissionGroups.append(group);
  });
  syncModuleCheckboxes();
}

function openRightsDialog(user) {
  if (!user) user = selectedActiveUser();
  state.rights.selectedUser = user;
  document.querySelector("#rights-context").textContent = `${user.name} · ${user.email} · ${user.status[0].toUpperCase()}${user.status.slice(1)} ${user.role[0].toUpperCase()}${user.role.slice(1)}`;
  document.querySelector("#rights-validation").textContent = "";
  renderPermissionGroups(state.rights.saved);
  if (!rightsDialog.open) rightsDialog.showModal();
  document.querySelector("#select-all-rights").focus();
}

function applyRightsState(stateName) {
  document.querySelector("#rights-validation").textContent = "";
  setButtonLoading(document.querySelector("#save-rights"), stateName === "saving");

  if (stateName === "partial") {
    const draft = structuredClone(state.rights.saved);
    draft.customers = draft.customers.map(() => true);
    draft.products = draft.products.map(() => false);
    renderPermissionGroups(draft);
  } else if (stateName === "error") {
    renderPermissionGroups(state.rights.draft);
    document.querySelector("#rights-validation").textContent = "Rights could not be saved. No changes were kept; retry after the permission scope is restored.";
  } else {
    renderPermissionGroups(state.rights.saved);
  }
}

permissionGroups.addEventListener("change", (event) => {
  const target = event.target;
  if (target.matches("[data-module-select]")) {
    permissionGroups.querySelectorAll(`input[data-module="${target.dataset.moduleSelect}"]`).forEach((box) => {
      box.checked = target.checked;
    });
  }
  syncModuleCheckboxes();
  document.querySelector("#rights-validation").textContent = "";
});

document.querySelector("#select-all-rights").addEventListener("click", () => {
  permissionGroups.querySelectorAll('input[type="checkbox"]').forEach((box) => { box.checked = true; });
  syncModuleCheckboxes();
});

document.querySelector("#clear-all-rights").addEventListener("click", () => {
  permissionGroups.querySelectorAll('input[type="checkbox"]').forEach((box) => { box.checked = false; });
  syncModuleCheckboxes();
});

document.querySelector("#reset-rights").addEventListener("click", () => {
  renderPermissionGroups(state.rights.saved);
  document.querySelector("#rights-validation").textContent = "";
  showToast("Draft rights reset to the last saved preview values.");
});

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => rightsDialog.close());
});

document.querySelector("#save-rights").addEventListener("click", () => {
  const validation = document.querySelector("#rights-validation");
  validation.textContent = "";
  const user = state.rights.selectedUser;
  if (!user || user.role !== "user" || user.status !== "active") {
    validation.textContent = "Rights can only be saved for an active standard User account.";
    return;
  }
  const button = document.querySelector("#save-rights");
  setButtonLoading(button, true);
  window.setTimeout(() => {
    setButtonLoading(button, false);
    state.rights.draft = readDraft();
    state.rights.saved = structuredClone(state.rights.draft);
    rightsDialog.close();
    showToast(`Rights saved for ${user.name} in this preview only; the connected app would write an audit_log entry.`);
  }, 800);
});

rightsDialog.addEventListener("close", () => {
  applyState("rights", "default");
});

/* --------------------------------------------------------- global controls */

document.addEventListener("click", (event) => {
  const viewButton = event.target.closest("[data-preview-view]");
  if (viewButton) {
    event.preventDefault();
    showView(viewButton.dataset.previewView);
    return;
  }
  const stateButton = event.target.closest("[data-preview-state]");
  if (stateButton) {
    applyState(stateButton.closest(".state-group")?.dataset.stateFor || state.view, stateButton.dataset.previewState);
    return;
  }
  const toastButton = event.target.closest("[data-toast]");
  if (toastButton) {
    event.preventDefault();
    showToast(toastButton.dataset.toast);
  }
});

document.querySelector("#preview-role").addEventListener("change", (event) => {
  state.role = event.target.value;
  const label = state.role[0].toUpperCase() + state.role.slice(1);
  document.querySelector("#side-role").textContent = label;
  document.querySelector("#topbar-role").textContent = label;
  document.querySelectorAll(".admin-only").forEach((element) => {
    element.hidden = state.role === "user";
  });
  document.querySelector("#scope-note").textContent = state.role === "admin"
    ? "Admins see standard User accounts only; Admin and Superadmin accounts are excluded."
    : "Superadmins can manage all accounts. Admins see standard User accounts only; Admin and Superadmin accounts are excluded.";
  renderUsers();
  if ((state.view === "users" || state.view === "rights") && state.role === "user") showView("mainpage");
});

applyState("login", "default");
renderUsers();
