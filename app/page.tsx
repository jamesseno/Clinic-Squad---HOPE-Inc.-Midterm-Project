"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

type Theme = "light" | "dark";
type AuthView =
  | "login"
  | "register"
  | "reset"
  | "reset-sent"
  | "set-password"
  | "password-updated";
type PasswordField =
  | "login-password"
  | "register-password"
  | "register-confirm-password"
  | "new-password"
  | "new-password-confirm";

const authLabels: Record<AuthView, string> = {
  login: "WELCOME BACK",
  register: "GET STARTED",
  reset: "ACCOUNT RECOVERY",
  "reset-sent": "CHECK YOUR EMAIL",
  "set-password": "NEW PASSWORD",
  "password-updated": "PASSWORD UPDATED",
};

const authTitleIds: Record<AuthView, string> = {
  login: "auth-title",
  register: "register-title",
  reset: "reset-title",
  "reset-sent": "reset-sent-title",
  "set-password": "set-password-title",
  "password-updated": "password-updated-title",
};

const modules: {
  kind: "products" | "people" | "sales" | "customers";
  number: string;
  title: string;
  description: string;
}[] = [
  {
    kind: "products",
    number: "01 / PRODUCT",
    title: "Product management",
    description:
      "Keep your catalog, inventory, and product details organized in one place.",
  },
  {
    kind: "people",
    number: "02 / PEOPLE",
    title: "Human resources",
    description:
      "Support your team with clear employee records and people operations.",
  },
  {
    kind: "sales",
    number: "03 / GROWTH",
    title: "Sales management",
    description:
      "Follow sales activity and bring the numbers behind your growth together.",
  },
  {
    kind: "customers",
    number: "04 / RELATIONSHIPS",
    title: "Customer management",
    description:
      "Keep customer information and conversations easy for your team to find.",
  },
];

const metrics = [
  { label: "Active products", value: "248", change: "12%", kind: "purple", icon: "▦" },
  { label: "Team members", value: "36", change: "4%", kind: "orange", icon: "♙" },
  { label: "Sales this month", value: "$84.2k", change: "18%", kind: "pink", icon: "↗" },
  { label: "Happy customers", value: "1,204", change: "8%", kind: "green", icon: "♡" },
];

const stories = [
  {
    label: "THE WORKPLACE",
    title: "Better work happens together.",
    description: "Make room for collaboration, focus, and the people behind every idea.",
    image: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=700&q=80",
    alt: "Colleagues collaborating around a shared table in a bright workplace",
  },
  {
    label: "ENTREPRENEURSHIP",
    title: "Ideas deserve room to grow.",
    description: "Bring the people, plans, and everyday details behind a business into focus.",
    image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=700&q=80",
    alt: "Entrepreneur reviewing business plans and notes at a desk",
  },
];

function LogoMark({ className = "brand-mark" }: { className?: string }) {
  return (
    <span className={className} aria-hidden="true">
      <svg viewBox="0 0 48 48" fill="none">
        <rect
          x="4.5"
          y="4.5"
          width="39"
          height="39"
          rx="14"
          fill="#F6F2E9"
          stroke="#D8C49B"
        />
        <path
          d="M16 31V20m16 11V20M16 26h16m-8-6v-2"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M24 18c-2.8-4.1-6.2-4.4-8.1-4.1.3 3.5 3.2 5.9 8.1 6.1m0-2c2.8-4.1 6.2-4.4 8.1-4.1-.3 3.5-3.2 5.9-8.1 6.1"
          stroke="#71896D"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="24" cy="11.5" r="1.2" fill="#B88D53" />
      </svg>
    </span>
  );
}

function ArrowIcon({ down = false }: { down?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      {down ? (
        <path d="M10 4.5v11m-4.5-4.5L10 15.5l4.5-4.5" />
      ) : (
        <path d="M4.5 10h11m-4.5-4.5L15.5 10 11 14.5" />
      )}
    </svg>
  );
}

function ModuleIcon({ kind }: { kind: (typeof modules)[number]["kind"] }) {
  const icons: Record<typeof kind, ReactNode> = {
    products: (
      <>
        <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
        <path d="m4.5 7.7 7.5 4.2 7.5-4.2M12 12v9" />
      </>
    ),
    people: (
      <>
        <path d="M16 20v-1.6a3.4 3.4 0 0 0-3.4-3.4H6.4A3.4 3.4 0 0 0 3 18.4V20" />
        <circle cx="9.5" cy="7" r="3.5" />
        <path d="M17 11a3.5 3.5 0 0 0 0-7m4 16v-1.6a3.4 3.4 0 0 0-2.8-3.3" />
      </>
    ),
    sales: (
      <>
        <path d="M4 19V5m0 14h17" />
        <path d="m7 15 4-4 3 2 6-7" />
        <path d="M16 6h4v4" />
      </>
    ),
    customers: (
      <path d="M20.8 8.6c0 4.1-8.8 10.1-8.8 10.1S3.2 12.7 3.2 8.6A4.6 4.6 0 0 1 12 6.2a4.6 4.6 0 0 1 8.8 2.4Z" />
    ),
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {icons[kind]}
    </svg>
  );
}

function DashboardPreview() {
  const activity = [
    { initials: "JD", name: "Jordan Davis", detail: "added a new product", time: "10 min ago", kind: "purple" },
    { initials: "AK", name: "Alex Kim", detail: "welcomed a new teammate", time: "1 hour ago", kind: "orange" },
    { initials: "MR", name: "Morgan Reed", detail: "closed a new sale", time: "2 hours ago", kind: "green" },
  ];

  return (
    <div className="hero-visual" aria-label="Preview of the Hope workspace">
      <div className="visual-glow" />
      <div className="floating-note note-top">
        <span className="note-icon note-icon-green" aria-hidden="true">
          <svg viewBox="0 0 20 20"><path d="m5 10 3.2 3.2L15.5 6" /></svg>
        </span>
        <span><strong>All in sync</strong><small>Work moves forward</small></span>
      </div>
      <div className="workspace-preview">
        <div className="preview-topbar">
          <div className="preview-brand">
            <LogoMark className="preview-mark" />
            <span>hope<span className="preview-period">.</span></span>
          </div>
          <div className="preview-top-actions">
            <span className="preview-search">⌕ <span>Search anything</span></span>
            <span className="preview-user">JD</span>
          </div>
        </div>
        <div className="preview-body">
          <aside className="preview-sidebar" aria-hidden="true">
            <span className="sidebar-label">WORKSPACE</span>
            <span className="sidebar-item sidebar-active"><i className="sidebar-dot dot-purple" />Overview</span>
            <span className="sidebar-item"><i className="sidebar-dot dot-blue" />Products</span>
            <span className="sidebar-item"><i className="sidebar-dot dot-orange" />People</span>
            <span className="sidebar-item"><i className="sidebar-dot dot-pink" />Sales</span>
            <span className="sidebar-item"><i className="sidebar-dot dot-green" />Customers</span>
            <div className="sidebar-bottom">
              <span className="sidebar-label">YOUR TEAM</span>
              <span className="team-person"><b className="team-avatar team-purple">JD</b> Jordan Davis</span>
              <span className="team-person"><b className="team-avatar team-blue">AK</b> Alex Kim</span>
            </div>
          </aside>
          <div className="preview-content">
            <div className="preview-greeting">
              <div>
                <span className="preview-date">MONDAY, MAY 19</span>
                <h2>Good morning, Jordan <span aria-hidden="true">✦</span></h2>
                <p>Here’s what’s happening across your workspace.</p>
              </div>
              <span className="preview-period-select">This month <span aria-hidden="true">⌄</span></span>
            </div>
            <div className="metric-grid">
              {metrics.map((metric) => (
                <div className="metric-card" key={metric.label}>
                  <span className="metric-label">{metric.label}</span>
                  <strong>{metric.value}</strong>
                  <span className="metric-change"><b>↗ {metric.change}</b> vs last month</span>
                  <span className={`metric-symbol symbol-${metric.kind}`} aria-hidden="true">{metric.icon}</span>
                </div>
              ))}
            </div>
            <div className="preview-lower">
              <div className="chart-card">
                <div className="chart-heading">
                  <div><strong>Business overview</strong><span>Revenue across the year</span></div>
                  <span className="chart-legend"><i />Revenue</span>
                </div>
                <div className="chart-area" aria-label="Revenue trend chart rising through the year">
                  <div className="chart-y-labels" aria-hidden="true">
                    <span>$80k</span><span>$60k</span><span>$40k</span><span>$20k</span>
                  </div>
                  <svg viewBox="0 0 360 112" role="img" aria-label="Revenue is trending upward from January to June">
                    <defs>
                      <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#725676" stopOpacity=".2" />
                        <stop offset="100%" stopColor="#725676" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d="M0 86 C25 77 30 88 58 70 S94 75 119 58 S158 71 181 47 S220 52 241 36 S276 49 300 25 S337 31 360 10 V112 H0Z" fill="url(#chartFill)" />
                    <path d="M0 86 C25 77 30 88 58 70 S94 75 119 58 S158 71 181 47 S220 52 241 36 S276 49 300 25 S337 31 360 10" fill="none" stroke="#725676" strokeWidth="3" strokeLinecap="round" />
                    <circle cx="360" cy="10" r="4" fill="white" stroke="#725676" strokeWidth="3" />
                  </svg>
                  <div className="chart-months" aria-hidden="true">
                    <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
                  </div>
                </div>
              </div>
              <div className="activity-card">
                <div className="activity-heading"><strong>Recent activity</strong><span>•••</span></div>
                {activity.map((item) => (
                  <div className="activity-item" key={item.initials}>
                    <b className={`activity-avatar activity-avatar-${item.kind}`}>{item.initials}</b>
                    <span><strong>{item.name}</strong><small>{item.detail}</small><time>{item.time}</time></span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="floating-note note-bottom">
        <span className="note-icon note-icon-purple" aria-hidden="true">
          <svg viewBox="0 0 20 20"><path d="M4 14.5 8 10l3 2 5-6.5" /><path d="M12.5 5.5H16V9" /></svg>
        </span>
        <span><strong>Good things add up</strong><small>Your work, at a glance</small></span>
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>("light");
  const [authView, setAuthView] = useState<AuthView>("login");
  const [showPassword, setShowPassword] = useState<Record<PasswordField, boolean>>({
    "login-password": false,
    "register-password": false,
    "register-confirm-password": false,
    "new-password": false,
    "new-password-confirm": false,
  });
  const [formMessage, setFormMessage] = useState("");

  function changeTheme(nextTheme: Theme) {
    document.body.dataset.theme = nextTheme;
    document.documentElement.style.colorScheme = nextTheme;
    setTheme(nextTheme);
  }

  function showAuthView(view: AuthView) {
    setAuthView(view);
    setFormMessage("");
    window.requestAnimationFrame(() => {
      document.getElementById(authTitleIds[view])?.focus();
    });
  }

  async function submitAuthForm(
    event: FormEvent<HTMLFormElement>,
    view: "login" | "register" | "reset" | "set-password",
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = form.elements;

    if (view === "register" || view === "set-password") {
      const passwordName = view === "register" ? "password" : "newPassword";
      const confirmName = view === "register" ? "confirmPassword" : "confirmNewPassword";
      const password = fields.namedItem(passwordName);
      const confirmation = fields.namedItem(confirmName);
      if (password instanceof HTMLInputElement && confirmation instanceof HTMLInputElement) {
        confirmation.setCustomValidity(
          confirmation.value && confirmation.value !== password.value
            ? "Passwords don’t match."
            : "",
        );
      }
    }

    if (!form.checkValidity()) {
      form.reportValidity();
      setFormMessage("Please check the highlighted fields and try again.");
      return;
    }

    if (view === "reset") {
      const email = form.elements.namedItem("email");
      if (!(email instanceof HTMLInputElement)) return;
      setFormMessage("Sending reset link...");
      try {
        const response = await fetch("/api/auth/reset/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.value }),
        });
        const body = (await response.json()) as { message?: string; error?: string };
        if (!response.ok) {
          setFormMessage(body.error ?? "Reset request failed. Please try again.");
          return;
        }
        showAuthView("reset-sent");
      } catch {
        setFormMessage("Could not reach the reset service.");
      }
      return;
    }
    if (view === "set-password") {
      showAuthView("password-updated");
      return;
    }

    if (view === "login") {
      const email = form.elements.namedItem("email");
      const password = form.elements.namedItem("password");
      if (!(email instanceof HTMLInputElement) || !(password instanceof HTMLInputElement)) return;

      setFormMessage("Signing in...");
      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.value, password: password.value }),
        });
        const body = (await response.json()) as { error?: string };
        if (!response.ok) {
          setFormMessage(body.error ?? "Sign-in failed. Please try again.");
          return;
        }
        router.push("/dashboard");
      } catch {
        setFormMessage("Could not reach the sign-in service.");
      }
      return;
    }

    // Register
    const nameField = form.elements.namedItem("name");
    const emailField = form.elements.namedItem("email");
    const phoneField = form.elements.namedItem("phone");
    const passwordField = form.elements.namedItem("password");
    if (
      !(nameField instanceof HTMLInputElement) ||
      !(emailField instanceof HTMLInputElement) ||
      !(passwordField instanceof HTMLInputElement)
    ) {
      return;
    }
    const nameParts = nameField.value.trim().split(/\s+/);
    const firstName = nameParts[0] ?? "";
    const lastName = nameParts.slice(1).join(" ") || firstName;
    setFormMessage("Creating account...");
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email: emailField.value,
          phone: phoneField instanceof HTMLInputElement ? phoneField.value : null,
          password: passwordField.value,
        }),
      });
      const body = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        setFormMessage(body.error ?? "Registration failed. Please try again.");
        return;
      }
      setFormMessage(body.message ?? "Account created. Pending admin approval.");
      form.reset();
    } catch {
      setFormMessage("Could not reach the registration service.");
    }
    return;
  }

  function togglePassword(field: PasswordField) {
    setShowPassword((current) => ({ ...current, [field]: !current[field] }));
  }

  function openRegistration() {
    showAuthView("register");
    document.getElementById("workspace-access")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <>
      <header className="site-header">
        <div className="brand-group">
          <a className="brand" href="#" aria-label="Hope, Inc. home">
            <LogoMark />
            <span className="brand-name">hope<span>.</span></span>
          </a>
          <div className="theme-switch" role="group" aria-label="Color theme">
            <button
              className="theme-option"
              type="button"
              aria-pressed={theme === "light"}
              onClick={() => changeTheme("light")}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <circle cx="10" cy="10" r="3.2" />
                <path d="M10 2.2v1.5m0 12.6v1.5M2.2 10h1.5m12.6 0h1.5M4.5 4.5l1.1 1.1m8.8 8.8 1.1 1.1m0-11-1.1 1.1m-8.8 8.8-1.1 1.1" />
              </svg>
              <span>Light</span>
            </button>
            <button
              className="theme-option"
              type="button"
              aria-pressed={theme === "dark"}
              onClick={() => changeTheme("dark")}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M16.5 12.3A7 7 0 0 1 7.7 3.5a7.1 7.1 0 1 0 8.8 8.8Z" />
              </svg>
              <span>Dark</span>
            </button>
          </div>
        </div>

        <nav className="main-nav" aria-label="Main navigation">
          <a href="#modules">Platform</a>
          <a href="#how-it-works">Why Hope</a>
          <a href="#contact">Contact</a>
        </nav>

        <div className="header-actions">
          <a className="header-login" href="#workspace-access">Log in</a>
          <button className="button button-small button-dark" type="button" onClick={openRegistration}>
            Get started <ArrowIcon />
          </button>
        </div>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-dot" />A BETTER WAY TO WORK</div>
            <h1 id="hero-title">One clear view of your <span>entire business.</span></h1>
            <p className="hero-description">
              Bring your products, people, sales, and customer relationships together.
              Hope gives your team the clarity to do their best work.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#workspace-access">
                Explore your workspace <ArrowIcon />
              </a>
              <a className="text-link" href="#modules">
                Discover the platform <ArrowIcon down />
              </a>
            </div>
            <div className="hero-proof">
              <div className="avatar-stack" aria-hidden="true">
                <span className="avatar avatar-one">J</span>
                <span className="avatar avatar-two">M</span>
                <span className="avatar avatar-three">A</span>
                <span className="avatar avatar-four">S</span>
              </div>
              <p><strong>One team, moving forward.</strong><br />Everything important, working together.</p>
            </div>
          </div>
          <DashboardPreview />
        </section>

        <section className="modules-section" id="modules" aria-labelledby="modules-title">
          <div className="section-heading">
            <div>
              <span className="section-kicker">ONE CONNECTED PLATFORM</span>
              <h2 id="modules-title">Everything has its place.</h2>
            </div>
            <p>Four essential systems. One simpler way to see how your business is doing.</p>
          </div>
          <div className="module-grid">
            {modules.map((module) => (
              <article className="module-card" key={module.kind}>
                <span className={`module-icon module-${module.kind}`} aria-hidden="true">
                  <ModuleIcon kind={module.kind} />
                </span>
                <span className="module-number">{module.number}</span>
                <h3>{module.title}</h3>
                <p>{module.description}</p>
                <a href="#workspace-access" aria-label={`Explore ${module.title}`}>
                  Explore module <span aria-hidden="true">↗</span>
                </a>
              </article>
            ))}
          </div>
        </section>

        <section className="story-section" aria-labelledby="story-title">
          <div className="story-heading">
            <div>
              <span className="section-kicker">PEOPLE + POSSIBILITIES</span>
              <h2 id="story-title">Good work begins with people.</h2>
            </div>
            <p>From shared workspaces to the first spark of an idea, Hope helps bring it all together.</p>
          </div>
          <div className="story-grid">
            {stories.map((story) => (
              <article className="story-card" key={story.label}>
                <div className="story-media">
                  <Image
                    src={story.image}
                    alt={story.alt}
                    fill
                    sizes="(max-width: 600px) 100vw, 20vw"
                    className="story-photo"
                    unoptimized
                  />
                </div>
                <div className="story-copy">
                  <span className="story-label">{story.label}</span>
                  <h3>{story.title}</h3>
                  <p>{story.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="why-section" id="how-it-works" aria-labelledby="why-title">
          <div className="why-mark" aria-hidden="true">
            <span className="why-mark-shape">h</span>
            <span className="why-mark-orbit orbit-one" />
            <span className="why-mark-orbit orbit-two" />
            <span className="why-spark spark-one">✦</span>
            <span className="why-spark spark-two">✳</span>
          </div>
          <div className="why-copy">
            <span className="section-kicker">MADE FOR THE WAY YOU WORK</span>
            <h2 id="why-title">Less switching.<br /><span>More moving forward.</span></h2>
            <p>
              When your essential business tools work together, your team can spend less time
              searching and more time making progress. Hope brings the big picture into focus.
            </p>
            <a className="text-link" href="#workspace-access">Take a look inside <span aria-hidden="true">↗</span></a>
          </div>
          <div className="why-points">
            <div><span className="check-circle" aria-hidden="true">✓</span><span><strong>One place to start</strong><small>See the work that matters from one shared workspace.</small></span></div>
            <div><span className="check-circle" aria-hidden="true">✓</span><span><strong>Connected by design</strong><small>Bring business functions together, not farther apart.</small></span></div>
            <div><span className="check-circle" aria-hidden="true">✓</span><span><strong>Built around your team</strong><small>Clear, approachable tools that help people do their best work.</small></span></div>
          </div>
        </section>

        <section className="access-section" id="workspace-access" aria-labelledby="access-title">
          <div className="access-copy">
            <span className="section-kicker">YOUR WORKSPACE IS WAITING</span>
            <h2 id="access-title">Good work starts with a clear view.</h2>
            <p>Sign in to pick up where your team left off, or request an account to get started with Hope.</p>
            <div className="access-assurance">
              <span className="assurance-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 4.7 2.9 8.1 7 10 4.1-1.9 7-5.3 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></svg>
              </span>
              <span><strong>A workspace for your team</strong><small>Account access is managed by your organization.</small></span>
            </div>
          </div>

          <div className="auth-card">
            <div className="auth-heading">
              <a className="auth-back" href="#hero-title" aria-label="Back to top">←</a>
              <span className="auth-step">{authLabels[authView]}</span>
              <span className="auth-heading-spacer" />
            </div>

            <section className="auth-view" aria-labelledby="auth-title" hidden={authView !== "login"}>
              <h3 id="auth-title" tabIndex={-1}>Sign in to Hope</h3>
              <p className="auth-intro">Welcome back. Let’s get you to work.</p>
              <form className="auth-form" noValidate onSubmit={(event) => submitAuthForm(event, "login")} onInput={() => setFormMessage("")}>
                <label className="field-label" htmlFor="login-email">Email address or username</label>
                <div className="input-wrap">
                  <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="4" width="15" height="12" rx="2" /><path d="m3.5 5.5 6.5 5 6.5-5" /></svg>
                  <input id="login-email" name="email" type="text" placeholder="name@example.com or username" autoComplete="username" required />
                </div>
                <div className="field-row">
                  <label className="field-label" htmlFor="login-password">Password</label>
                  <button className="field-link" type="button" onClick={() => showAuthView("reset")}>Forgot password?</button>
                </div>
                <div className="input-wrap">
                  <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3.5" y="8.5" width="13" height="9" rx="2" /><path d="M6.5 8.5V6a3.5 3.5 0 1 1 7 0v2.5m-3.5 4v1.5" /></svg>
                  <input id="login-password" name="password" type={showPassword["login-password"] ? "text" : "password"} placeholder="Enter your password" autoComplete="current-password" required />
                  <button className="password-toggle" type="button" onClick={() => togglePassword("login-password")} aria-label={showPassword["login-password"] ? "Hide password" : "Show password"} aria-pressed={showPassword["login-password"]}>
                    <PasswordIcon />
                  </button>
                </div>
                <label className="remember-option">
                  <input type="checkbox" name="remember" />
                  <span className="custom-checkbox" aria-hidden="true" />
                  <span>Remember me</span>
                </label>
                <button className="button button-primary auth-submit" type="submit">Log In <span aria-hidden="true">→</span></button>
                <p className={`form-message${formMessage && authView === "login" ? " is-visible" : ""}${formMessage.startsWith("Please") && authView === "login" ? " is-error" : ""}`} role="status" aria-live="polite">{authView === "login" ? formMessage : ""}</p>
              </form>
              <p className="auth-switch">New to Hope? <button type="button" onClick={() => showAuthView("register")}>Create an account</button></p>
            </section>

            <section className="auth-view" aria-labelledby="register-title" hidden={authView !== "register"}>
              <h3 id="register-title" tabIndex={-1}>Create your account</h3>
              <p className="auth-intro">Start with your details. Your organization will confirm access.</p>
              <form className="auth-form" noValidate onSubmit={(event) => submitAuthForm(event, "register")} onInput={(event) => {
                const form = event.currentTarget;
                const password = form.elements.namedItem("password");
                const confirmation = form.elements.namedItem("confirmPassword");
                if (password instanceof HTMLInputElement && confirmation instanceof HTMLInputElement) {
                  confirmation.setCustomValidity(confirmation.value && confirmation.value !== password.value ? "Passwords don’t match." : "");
                }
                setFormMessage("");
              }}>
                <label className="field-label" htmlFor="register-name">Full name</label>
                <div className="input-wrap">
                  <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="6.5" r="3" /><path d="M3.5 17a6.5 6.5 0 0 1 13 0" /></svg>
                  <input id="register-name" name="name" type="text" placeholder="Your full name" autoComplete="name" required />
                </div>
                <label className="field-label" htmlFor="register-email">Email address</label>
                <div className="input-wrap">
                  <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="4" width="15" height="12" rx="2" /><path d="m3.5 5.5 6.5 5 6.5-5" /></svg>
                  <input id="register-email" name="email" type="email" placeholder="name@example.com" autoComplete="email" required />
                </div>
                <label className="field-label" htmlFor="register-phone">Phone number <span className="field-optional">(optional)</span></label>
                <div className="input-wrap">
                  <input id="register-phone" name="phone" type="tel" placeholder="+1 (555) 000-0000" autoComplete="tel" />
                </div>
                <label className="field-label" htmlFor="register-password">Create a password</label>
                <div className="input-wrap">
                  <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3.5" y="8.5" width="13" height="9" rx="2" /><path d="M6.5 8.5V6a3.5 3.5 0 1 1 7 0v2.5m-3.5 4v1.5" /></svg>
                  <input id="register-password" name="password" type={showPassword["register-password"] ? "text" : "password"} placeholder="At least 8 characters" autoComplete="new-password" aria-describedby="register-password-hint" minLength={8} required />
                  <button className="password-toggle" type="button" onClick={() => togglePassword("register-password")} aria-label={showPassword["register-password"] ? "Hide password" : "Show password"} aria-pressed={showPassword["register-password"]}>
                    <PasswordIcon />
                  </button>
                </div>
                <p className="field-hint" id="register-password-hint">Use at least 8 characters.</p>
                <label className="field-label" htmlFor="register-confirm-password">Confirm password</label>
                <div className="input-wrap">
                  <input id="register-confirm-password" name="confirmPassword" type={showPassword["register-confirm-password"] ? "text" : "password"} placeholder="Re-enter your password" autoComplete="new-password" required />
                  <button className="password-toggle" type="button" onClick={() => togglePassword("register-confirm-password")} aria-label={showPassword["register-confirm-password"] ? "Hide password" : "Show password"} aria-pressed={showPassword["register-confirm-password"]}>
                    <PasswordIcon />
                  </button>
                </div>
                <label className="remember-option terms-option">
                  <input type="checkbox" name="terms" required />
                  <span className="custom-checkbox" aria-hidden="true" />
                  <span>I agree to the Terms and Privacy Policy.</span>
                </label>
                <p className="field-hint">Your organization manages account access and role assignment.</p>
                <button className="button button-primary auth-submit" type="submit">Register <span aria-hidden="true">→</span></button>
                <p className={`form-message${formMessage && authView === "register" ? " is-visible" : ""}${formMessage.startsWith("Please") && authView === "register" ? " is-error" : ""}`} role="status" aria-live="polite">{authView === "register" ? formMessage : ""}</p>
              </form>
              <p className="auth-switch">Already have an account? <button type="button" onClick={() => showAuthView("login")}>Log in</button></p>
            </section>

            <section className="auth-view" aria-labelledby="reset-title" hidden={authView !== "reset"}>
              <h3 id="reset-title" tabIndex={-1}>Reset your password</h3>
              <p className="auth-intro">Enter your email and we’ll send instructions to reset your password.</p>
              <form className="auth-form reset-form" noValidate onSubmit={(event) => submitAuthForm(event, "reset")} onInput={() => setFormMessage("")}>
                <label className="field-label" htmlFor="reset-email">Email address</label>
                <div className="input-wrap">
                  <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="4" width="15" height="12" rx="2" /><path d="m3.5 5.5 6.5 5 6.5-5" /></svg>
                  <input id="reset-email" name="email" type="email" placeholder="name@example.com" autoComplete="email" required />
                </div>
                <button className="button button-primary auth-submit" type="submit">Send Reset Link <span aria-hidden="true">→</span></button>
                <p className={`form-message${formMessage && authView === "reset" ? " is-visible" : ""}${formMessage.startsWith("Please") && authView === "reset" ? " is-error" : ""}`} role="status" aria-live="polite">{authView === "reset" ? formMessage : ""}</p>
              </form>
              <p className="auth-switch"><button type="button" onClick={() => showAuthView("login")}>← Back to Log In</button></p>
            </section>

            <section className="auth-view" aria-labelledby="reset-sent-title" hidden={authView !== "reset-sent"}>
              <h3 id="reset-sent-title" tabIndex={-1}>Check your email</h3>
              <p className="auth-intro">If an account matches that email, reset instructions are on the way. Check your inbox.</p>
              <p className="auth-switch"><button type="button" onClick={() => showAuthView("reset")}>Request another link</button></p>
              <p className="auth-switch"><button type="button" onClick={() => showAuthView("login")}>← Back to Log In</button></p>
            </section>

            <section className="auth-view" aria-labelledby="set-password-title" hidden={authView !== "set-password"}>
              <h3 id="set-password-title" tabIndex={-1}>Create a new password</h3>
              <p className="auth-intro">Choose a new password for your account.</p>
              <form className="auth-form" noValidate onSubmit={(event) => submitAuthForm(event, "set-password")} onInput={(event) => {
                const form = event.currentTarget;
                const password = form.elements.namedItem("newPassword");
                const confirmation = form.elements.namedItem("confirmNewPassword");
                if (password instanceof HTMLInputElement && confirmation instanceof HTMLInputElement) {
                  confirmation.setCustomValidity(confirmation.value && confirmation.value !== password.value ? "Passwords don’t match." : "");
                }
                setFormMessage("");
              }}>
                <label className="field-label" htmlFor="new-password">New password</label>
                <div className="input-wrap">
                  <input id="new-password" name="newPassword" type={showPassword["new-password"] ? "text" : "password"} placeholder="At least 8 characters" autoComplete="new-password" aria-describedby="new-password-hint" minLength={8} required />
                  <button className="password-toggle" type="button" onClick={() => togglePassword("new-password")} aria-label={showPassword["new-password"] ? "Hide password" : "Show password"} aria-pressed={showPassword["new-password"]}>
                    <PasswordIcon />
                  </button>
                </div>
                <p className="field-hint" id="new-password-hint">Use at least 8 characters.</p>
                <label className="field-label" htmlFor="new-password-confirm">Confirm new password</label>
                <div className="input-wrap">
                  <input id="new-password-confirm" name="confirmNewPassword" type={showPassword["new-password-confirm"] ? "text" : "password"} placeholder="Re-enter your password" autoComplete="new-password" required />
                  <button className="password-toggle" type="button" onClick={() => togglePassword("new-password-confirm")} aria-label={showPassword["new-password-confirm"] ? "Hide password" : "Show password"} aria-pressed={showPassword["new-password-confirm"]}>
                    <PasswordIcon />
                  </button>
                </div>
                <button className="button button-primary auth-submit" type="submit">Update Password <span aria-hidden="true">→</span></button>
                <p className={`form-message${formMessage && authView === "set-password" ? " is-visible" : ""}${formMessage.startsWith("Please") && authView === "set-password" ? " is-error" : ""}`} role="status" aria-live="polite">{authView === "set-password" ? formMessage : ""}</p>
              </form>
            </section>

            <section className="auth-view" aria-labelledby="password-updated-title" hidden={authView !== "password-updated"}>
              <h3 id="password-updated-title" tabIndex={-1}>Password update confirmation</h3>
              <p className="auth-intro">In the connected version, your new password will be ready to use.</p>
              <p className="form-message is-visible" role="status">Your password has been updated. You can now sign in.</p>
              <button className="button button-primary auth-submit" type="button" onClick={() => showAuthView("login")}>Back to Log In <span aria-hidden="true">→</span></button>
            </section>

            <p className="auth-footnote"><span aria-hidden="true">◈</span> Secure access for your organization</p>
          </div>
        </section>
      </main>

      <footer className="site-footer" id="contact">
        <a className="brand footer-brand" href="#" aria-label="Hope, Inc. home">
          <LogoMark />
          <span className="brand-name">hope<span>.</span></span>
        </a>
        <span className="footer-caption">A little more clarity for all the good you do.</span>
        <span className="footer-legal">© 2026 Hope, Inc. All rights reserved.</span>
      </footer>
    </>
  );
}

function PasswordIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M2.5 10s2.7-5 7.5-5 7.5 5 7.5 5-2.7 5-7.5 5-7.5-5-7.5-5Z" />
      <circle cx="10" cy="10" r="2" />
    </svg>
  );
}
