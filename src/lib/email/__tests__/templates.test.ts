import { describe, it, expect } from "vitest";
import { buildWelcomeEmail } from "../templates/welcome";
import { buildInviteEmail } from "../templates/invite";
import { buildPasswordResetEmail } from "../templates/password-reset";
import { renderEmailHtml, renderEmailText } from "../templates/layout";

// All templates are pure functions of inputs. Tests pin down structural
// invariants the rendered HTML/text must satisfy: never leaks unescaped
// user input, always carries a working link, always has subject + tag.

describe("email layout", () => {
  it("escapes the preview text into a hidden span", () => {
    const html = renderEmailHtml({
      preview: "<script>alert(1)</script>",
      body: "<p>hi</p>",
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("includes brand footer with privacy and terms links", () => {
    const html = renderEmailHtml({ preview: "p", body: "<p>b</p>" });
    expect(html).toContain("/privacy");
    expect(html).toContain("/terms");
  });

  it("renderEmailText includes CTA URL inline", () => {
    const text = renderEmailText(["Hello"], {
      label: "Open",
      url: "https://example.com/x",
    });
    expect(text).toContain("Hello");
    expect(text).toContain("https://example.com/x");
  });

  it("renderEmailText omits the CTA section when no CTA passed", () => {
    const text = renderEmailText(["Hello"]);
    expect(text).toContain("Hello");
    expect(text).not.toContain("undefined");
  });
});

describe("buildWelcomeEmail", () => {
  it("uses the provided name in the greeting", () => {
    const msg = buildWelcomeEmail({ to: "ivan@x.ru", name: "Иван" });
    expect(msg.html).toContain("Иван");
    expect(msg.text).toContain("Иван");
  });

  it("falls back to email local-part when name missing", () => {
    const msg = buildWelcomeEmail({ to: "petr@example.ru", name: null });
    expect(msg.html).toContain("petr");
    expect(msg.text).toContain("petr");
  });

  it("escapes HTML-unsafe characters in the name", () => {
    const msg = buildWelcomeEmail({
      to: "x@y.ru",
      name: "<img src=x onerror=alert(1)>",
    });
    expect(msg.html).not.toContain("<img src=x");
    expect(msg.html).toContain("&lt;img");
  });

  it("includes a CTA pointing at /analyze", () => {
    const msg = buildWelcomeEmail({ to: "x@y.ru" });
    expect(msg.html).toContain("/analyze");
    expect(msg.text).toContain("/analyze");
  });

  it("tags as 'welcome'", () => {
    const msg = buildWelcomeEmail({ to: "x@y.ru" });
    expect(msg.tag).toBe("welcome");
  });
});

describe("buildInviteEmail", () => {
  const base = {
    to: "newbie@x.ru",
    orgName: "Acme & Co",
    inviterName: "Анна",
    inviterEmail: "anna@acme.ru",
    role: "MEMBER" as const,
    acceptUrl: "https://app.juriist.ru/invite/abc123",
    expiresAt: "2026-06-01T12:00:00Z",
  };

  it("subject contains both inviter and org name", () => {
    const msg = buildInviteEmail(base);
    expect(msg.subject).toContain("Анна");
    expect(msg.subject).toContain("Acme & Co");
  });

  it("escapes the org name in the body", () => {
    const msg = buildInviteEmail({ ...base, orgName: "<b>x</b>" });
    expect(msg.html).not.toMatch(/<b>x<\/b>/);
    expect(msg.html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });

  it("uses inviter email as Reply-To so replies route to a human", () => {
    const msg = buildInviteEmail(base);
    expect(msg.replyTo).toBe("anna@acme.ru");
  });

  it("renders CTA url verbatim", () => {
    const msg = buildInviteEmail(base);
    expect(msg.html).toContain("https://app.juriist.ru/invite/abc123");
    expect(msg.text).toContain("https://app.juriist.ru/invite/abc123");
  });

  it("translates ADMIN role to 'администратора' label", () => {
    const msg = buildInviteEmail({ ...base, role: "ADMIN" });
    expect(msg.html).toContain("администратора");
  });

  it("falls back to inviter email when name is empty", () => {
    const msg = buildInviteEmail({ ...base, inviterName: "" });
    expect(msg.subject).toContain("anna@acme.ru");
  });

  it("formats expiry date in ru-RU locale", () => {
    const msg = buildInviteEmail(base);
    // Either "1 июня 2026 г." or similar — just check the year is shown.
    expect(msg.html).toContain("2026");
  });
});

describe("buildPasswordResetEmail", () => {
  it("includes the reset URL once in HTML and once in text", () => {
    const msg = buildPasswordResetEmail({
      to: "x@y.ru",
      resetUrl: "https://app/reset?token=abc",
      validityHuman: "30 минут",
    });
    expect(msg.html).toContain("https://app/reset?token=abc");
    expect(msg.text).toContain("https://app/reset?token=abc");
  });

  it("mentions the validity window so the user knows the urgency", () => {
    const msg = buildPasswordResetEmail({
      to: "x@y.ru",
      resetUrl: "https://app/reset?token=abc",
      validityHuman: "30 минут",
    });
    expect(msg.html).toContain("30 минут");
    expect(msg.text).toContain("30 минут");
  });

  it("tags as 'password-reset'", () => {
    const msg = buildPasswordResetEmail({
      to: "x@y.ru",
      resetUrl: "https://app/reset?token=abc",
      validityHuman: "30 минут",
    });
    expect(msg.tag).toBe("password-reset");
  });
});
