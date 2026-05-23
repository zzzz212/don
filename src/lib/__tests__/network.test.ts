import { describe, it, expect } from "vitest";
import {
  conversationPairKey,
  shapeNetworkUser,
  type NetworkUser,
} from "../network";

describe("conversationPairKey", () => {
  it("is independent of argument order", () => {
    expect(conversationPairKey("alice", "bob")).toBe(
      conversationPairKey("bob", "alice")
    );
  });

  it("joins the two ids with a colon, sorted ascending", () => {
    expect(conversationPairKey("bob", "alice")).toBe("alice:bob");
    expect(conversationPairKey("alice", "bob")).toBe("alice:bob");
  });

  it("maps distinct pairs to distinct keys", () => {
    const keys = new Set([
      conversationPairKey("a", "b"),
      conversationPairKey("a", "c"),
      conversationPairKey("b", "c"),
    ]);
    expect(keys.size).toBe(3);
  });

  it("sorts lexicographically — documents the contract", () => {
    // Plain string sort, so a future switch to numeric/locale ordering
    // would be a deliberate, test-breaking change.
    expect(conversationPairKey("z", "aa")).toBe("aa:z");
  });
});

describe("shapeNetworkUser", () => {
  const base: NetworkUser = {
    id: "u_1",
    name: "Аккаунт Имя",
    image: "https://cdn.example/avatar.png",
    profile: { displayName: "Профиль Имя", headline: "Корпоративный юрист" },
  };

  it("prefers the profile display name", () => {
    expect(shapeNetworkUser(base).displayName).toBe("Профиль Имя");
  });

  it("falls back to the account name when the profile has none", () => {
    const u = shapeNetworkUser({
      ...base,
      profile: { displayName: null, headline: null },
    });
    expect(u.displayName).toBe("Аккаунт Имя");
  });

  it("falls back to a generic label when neither name is set", () => {
    const u = shapeNetworkUser({ ...base, name: null, profile: null });
    expect(u.displayName).toBe("Пользователь");
  });

  it("carries the headline through, or null when absent", () => {
    expect(shapeNetworkUser(base).headline).toBe("Корпоративный юрист");
    expect(shapeNetworkUser({ ...base, profile: null }).headline).toBeNull();
  });

  it("exposes the id as userId and passes the image through", () => {
    const u = shapeNetworkUser(base);
    expect(u.userId).toBe("u_1");
    expect(u.image).toBe("https://cdn.example/avatar.png");
  });

  it("does not leak the raw account fields under their original keys", () => {
    // The shaped object is the public network card — exposing `name`
    // verbatim would bypass the profile-display-name indirection.
    const u = shapeNetworkUser(base);
    expect(u).not.toHaveProperty("name");
    expect(u).not.toHaveProperty("id");
  });
});
