import { describe, it, expect } from "vitest";
import { buildConnectionRequestEmail } from "../templates/connection-request";
import { buildDocumentSharedEmail } from "../templates/document-shared";
import { buildNetworkMessageEmail } from "../templates/network-message";

// The three network-notification templates are pure functions of their
// inputs. Tests pin the same invariants as the other email templates:
// user input is always HTML-escaped, the CTA link survives verbatim,
// and subject + tag are always present.

describe("buildConnectionRequestEmail", () => {
  const base = {
    to: "target@x.ru",
    requesterName: "Анна Петрова",
    networkUrl: "https://app.juriist.ru/network",
  };

  it("subject names the requester", () => {
    expect(buildConnectionRequestEmail(base).subject).toContain("Анна Петрова");
  });

  it("escapes the requester name in the HTML body", () => {
    const msg = buildConnectionRequestEmail({
      ...base,
      requesterName: "<img src=x onerror=alert(1)>",
    });
    expect(msg.html).not.toContain("<img src=x");
    expect(msg.html).toContain("&lt;img");
  });

  it("renders the network URL verbatim in HTML and text", () => {
    const msg = buildConnectionRequestEmail(base);
    expect(msg.html).toContain("https://app.juriist.ru/network");
    expect(msg.text).toContain("https://app.juriist.ru/network");
  });

  it("falls back to a generic name when requesterName is blank", () => {
    const msg = buildConnectionRequestEmail({ ...base, requesterName: "  " });
    expect(msg.subject).toContain("Пользователь");
  });

  it("tags as 'network-connection'", () => {
    expect(buildConnectionRequestEmail(base).tag).toBe("network-connection");
  });
});

describe("buildDocumentSharedEmail", () => {
  const base = {
    to: "reviewer@x.ru",
    fromName: "Иван",
    documentName: "Договор аренды.pdf",
    shareUrl: "https://app.juriist.ru/network/shares/abc123",
  };

  it("subject names the sender", () => {
    expect(buildDocumentSharedEmail(base).subject).toContain("Иван");
  });

  it("escapes the document name in the body", () => {
    const msg = buildDocumentSharedEmail({
      ...base,
      documentName: "<b>x</b>.pdf",
    });
    expect(msg.html).not.toMatch(/<b>x<\/b>/);
    expect(msg.html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });

  it("renders the share URL verbatim in HTML and text", () => {
    const msg = buildDocumentSharedEmail(base);
    expect(msg.html).toContain("https://app.juriist.ru/network/shares/abc123");
    expect(msg.text).toContain("https://app.juriist.ru/network/shares/abc123");
  });

  it("mentions the document name so the reviewer knows what is waiting", () => {
    const msg = buildDocumentSharedEmail(base);
    expect(msg.html).toContain("Договор аренды.pdf");
    expect(msg.text).toContain("Договор аренды.pdf");
  });

  it("tags as 'network-share'", () => {
    expect(buildDocumentSharedEmail(base).tag).toBe("network-share");
  });
});

describe("buildNetworkMessageEmail", () => {
  const base = {
    to: "target@x.ru",
    fromName: "Пётр",
    preview: "Здравствуйте, посмотрите договор",
    threadUrl: "https://app.juriist.ru/network/messages/conv1",
  };

  it("subject names the sender", () => {
    expect(buildNetworkMessageEmail(base).subject).toContain("Пётр");
  });

  it("shows the message preview in the body", () => {
    const msg = buildNetworkMessageEmail(base);
    expect(msg.html).toContain("Здравствуйте, посмотрите договор");
    expect(msg.text).toContain("Здравствуйте, посмотрите договор");
  });

  it("escapes an HTML-unsafe preview", () => {
    const msg = buildNetworkMessageEmail({
      ...base,
      preview: "<script>alert(1)</script>",
    });
    expect(msg.html).not.toContain("<script>alert(1)</script>");
    expect(msg.html).toContain("&lt;script&gt;");
  });

  it("renders the thread URL verbatim", () => {
    const msg = buildNetworkMessageEmail(base);
    expect(msg.html).toContain("https://app.juriist.ru/network/messages/conv1");
    expect(msg.text).toContain(
      "https://app.juriist.ru/network/messages/conv1"
    );
  });

  it("tags as 'network-message'", () => {
    expect(buildNetworkMessageEmail(base).tag).toBe("network-message");
  });
});
