const authViews = {
  login: document.querySelector("#login-view"),
  register: document.querySelector("#register-view"),
  reset: document.querySelector("#reset-view"),
  "reset-sent": document.querySelector("#reset-sent-view"),
  "set-password": document.querySelector("#set-password-view"),
  "password-updated": document.querySelector("#password-updated-view"),
};

const authLabels = {
  login: "WELCOME BACK",
  register: "GET STARTED",
  reset: "ACCOUNT RECOVERY",
  "reset-sent": "CHECK YOUR EMAIL",
  "set-password": "NEW PASSWORD",
  "password-updated": "PASSWORD UPDATED",
};

const authStep = document.querySelector("#auth-step");
const themeButtons = document.querySelectorAll("[data-theme-value]");

function setTheme(theme) {
  if (theme !== "light" && theme !== "dark") return;

  document.body.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;

  themeButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.themeValue === theme));
  });
}

themeButtons.forEach((button) => {
  button.addEventListener("click", () => setTheme(button.dataset.themeValue));
});

function showAuthView(viewName) {
  if (!Object.hasOwn(authViews, viewName)) return;

  Object.entries(authViews).forEach(([name, view]) => {
    view.hidden = name !== viewName;
  });
  authStep.textContent = authLabels[viewName];

  document.querySelectorAll(".auth-form .form-message").forEach((message) => {
    message.textContent = "";
    message.classList.remove("is-visible");
    message.classList.remove("is-error");
  });

  const firstInput = authViews[viewName].querySelector("input");
  const heading = authViews[viewName].querySelector("h3");
  (firstInput || heading)?.focus({ preventScroll: true });
}

document.querySelectorAll("[data-show-view]").forEach((button) => {
  button.addEventListener("click", () => showAuthView(button.dataset.showView));
});

document.querySelector("[data-open-register]").addEventListener("click", () => {
  showAuthView("register");
  document.querySelector("#workspace-access").scrollIntoView({ behavior: "smooth" });
});

document.querySelectorAll("[data-toggle-password]").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.togglePassword);
    const shouldShow = input.type === "password";
    input.type = shouldShow ? "text" : "password";
    button.setAttribute("aria-label", shouldShow ? "Hide password" : "Show password");
    button.setAttribute("aria-pressed", String(shouldShow));
  });
});

document.querySelectorAll(".auth-form").forEach((form) => {
  const message = form.querySelector(".form-message");

  form.addEventListener("input", (event) => {
    message.textContent = "";
    message.classList.remove("is-visible");
    message.classList.remove("is-error");
    const target = event.target;
    if (target instanceof HTMLInputElement && (target.name === "password" || target.name === "confirmPassword" || target.name === "newPassword" || target.name === "confirmNewPassword")) {
      const passwordName = form.dataset.form === "set-password" ? "newPassword" : "password";
      const confirmName = form.dataset.form === "set-password" ? "confirmNewPassword" : "confirmPassword";
      const password = form.elements.namedItem(passwordName);
      const confirmation = form.elements.namedItem(confirmName);
      if (password instanceof HTMLInputElement && confirmation instanceof HTMLInputElement) {
        confirmation.setCustomValidity(confirmation.value && confirmation.value !== password.value ? "Passwords don’t match." : "");
      }
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (form.dataset.form === "register" || form.dataset.form === "set-password") {
      const passwordName = form.dataset.form === "set-password" ? "newPassword" : "password";
      const confirmName = form.dataset.form === "set-password" ? "confirmNewPassword" : "confirmPassword";
      const password = form.elements.namedItem(passwordName);
      const confirmation = form.elements.namedItem(confirmName);
      if (password instanceof HTMLInputElement && confirmation instanceof HTMLInputElement) {
        confirmation.setCustomValidity(confirmation.value && confirmation.value !== password.value ? "Passwords don’t match." : "");
      }
    }

    if (!form.checkValidity()) {
      form.reportValidity();
      message.textContent = "Please check the highlighted fields and try again.";
      message.classList.add("is-visible");
      message.classList.add("is-error");
      return;
    }

    if (form.dataset.form === "reset") {
      showAuthView("reset-sent");
      return;
    }
    if (form.dataset.form === "set-password") {
      showAuthView("password-updated");
      return;
    }

    message.textContent = form.dataset.form === "login"
      ? "Prototype only: sign-in isn’t connected, so these credentials weren’t checked."
      : "Prototype only: your account request hasn’t been sent.";
    message.classList.add("is-visible");
  });
});
