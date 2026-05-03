(() => {
  const storageKeys = {
    users: "harmony:users",
    currentUser: "harmony:current-user"
  };

  const els = {
    authTitle: document.getElementById("authTitle"),
    authEyebrow: document.getElementById("authEyebrow"),
    authMessage: document.getElementById("authMessage"),
    tabs: document.querySelectorAll("[data-auth-mode]"),
    switchButtons: document.querySelectorAll("[data-switch-auth]"),
    loginForm: document.getElementById("loginForm"),
    signupForm: document.getElementById("signupForm"),
    loginEmail: document.getElementById("loginEmail"),
    signupName: document.getElementById("signupName")
  };

  const titles = {
    login: {
      eyebrow: "Welcome back",
      title: "Log in"
    },
    signup: {
      eyebrow: "Start listening",
      title: "Create account"
    }
  };

  function init() {
    if (getCurrentUser()) {
      redirectToApp();
      return;
    }

    bindEvents();
    setMode("login");
  }

  function bindEvents() {
    els.tabs.forEach((tab) => {
      tab.addEventListener("click", () => setMode(tab.dataset.authMode));
    });

    els.switchButtons.forEach((button) => {
      button.addEventListener("click", () => setMode(button.dataset.switchAuth));
    });

    els.loginForm.addEventListener("submit", onLogin);
    els.signupForm.addEventListener("submit", onSignup);
  }

  function setMode(mode) {
    const safeMode = mode === "signup" ? "signup" : "login";
    const isSignup = safeMode === "signup";

    document.body.classList.toggle("is-signup", isSignup);
    els.authEyebrow.textContent = titles[safeMode].eyebrow;
    els.authTitle.textContent = titles[safeMode].title;

    els.tabs.forEach((tab) => {
      const isActive = tab.dataset.authMode === safeMode;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
    });

    els.loginForm.classList.toggle("is-active", !isSignup);
    els.signupForm.classList.toggle("is-active", isSignup);
    setMessage("");

    window.requestAnimationFrame(() => {
      const input = isSignup ? els.signupName : els.loginEmail;
      input?.focus();
    });
  }

  function onSignup(event) {
    event.preventDefault();

    const formData = new FormData(els.signupForm);
    const name = normalizeName(formData.get("name"));
    const email = normalizeEmail(formData.get("email"));
    const password = String(formData.get("password") || "");

    if (!name || !email || !password) {
      setMessage("Please fill in every field.", "error");
      return;
    }

    if (!isValidEmail(email)) {
      setMessage("Please enter a valid email address.", "error");
      return;
    }

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.", "error");
      return;
    }

    const users = readUsers();
    const duplicate = users.some((user) => normalizeEmail(user.email) === email);

    if (duplicate) {
      setMessage("An account with this email already exists.", "error");
      return;
    }

    const user = {
      id: createUserId(),
      name,
      email,
      password,
      createdAt: new Date().toISOString()
    };

    users.push(user);

    try {
      saveUsers(users);
      saveSession(user);
      setMessage("Account created. Opening Harmony...", "success");
      redirectToAppSoon();
    } catch {
      setMessage("Could not save your account in this browser.", "error");
    }
  }

  function onLogin(event) {
    event.preventDefault();

    const formData = new FormData(els.loginForm);
    const email = normalizeEmail(formData.get("email"));
    const password = String(formData.get("password") || "");

    if (!email || !password) {
      setMessage("Enter your email and password.", "error");
      return;
    }

    const user = readUsers().find((item) => {
      return normalizeEmail(item.email) === email && String(item.password) === password;
    });

    if (!user) {
      setMessage("Email or password is incorrect.", "error");
      return;
    }

    try {
      saveSession(user);
      setMessage("Logged in. Opening Harmony...", "success");
      redirectToAppSoon();
    } catch {
      setMessage("Could not start your session in this browser.", "error");
    }
  }

  function readUsers() {
    try {
      const users = JSON.parse(localStorage.getItem(storageKeys.users) || "[]");
      return Array.isArray(users) ? users : [];
    } catch {
      return [];
    }
  }

  function saveUsers(users) {
    localStorage.setItem(storageKeys.users, JSON.stringify(users));
  }

  function getCurrentUser() {
    try {
      const user = JSON.parse(localStorage.getItem(storageKeys.currentUser) || "null");
      return user && user.email ? user : null;
    } catch {
      localStorage.removeItem(storageKeys.currentUser);
      return null;
    }
  }

  function saveSession(user) {
    const session = {
      id: user.id,
      name: user.name,
      email: user.email,
      signedInAt: new Date().toISOString()
    };

    localStorage.setItem(storageKeys.currentUser, JSON.stringify(session));
  }

  function setMessage(message, type = "") {
    els.authMessage.textContent = message;
    els.authMessage.classList.toggle("is-error", type === "error");
    els.authMessage.classList.toggle("is-success", type === "success");
  }

  function redirectToAppSoon() {
    window.setTimeout(redirectToApp, 450);
  }

  function redirectToApp() {
    window.location.href = "index.html";
  }

  function createUserId() {
    return `user-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  }

  function normalizeName(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
  }

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  init();
})();
